// =====================================================
// POST /api/compras/[id]/enviar-proveedor
// =====================================================
// Acción MANUAL: el usuario clickea "Enviar al proveedor"
// en la vista de detalle de la OC. Esto:
//   1. Valida que la OC exista y el proveedor tenga email
//   2. Construye el email con el template de proveedor
//   3. Lo manda vía Resend (o queda en outbox)
//   4. Cambia estado de OC a 'enviada' si estaba en 'borrador'
//   5. Registra en auditoría
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/security/permissions';
import { registrarAuditoriaSegura, extraerContextoAudit } from '@/lib/security/audit-enhanced';
import { enviarEmail } from '@/lib/email/send';
import { templateOCProveedor, formatFechaHora } from '@/lib/email/templates';
import { reportarError } from '@/lib/security/error-reporting';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const ocId = params.id;
  if (!ocId) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Cargar OC + items + proveedor
    const { data: oc, error: ocError } = await supabase
      .from('ordenes_compra')
      .select(`*, ordenes_compra_items(*), proveedores(id, nombre, email, contacto)`)
      .eq('id', ocId)
      .maybeSingle();

    if (ocError || !oc) {
      return NextResponse.json({ error: 'OC no encontrada' }, { status: 404 });
    }

    const proveedor = (oc.proveedores as any) || null;
    if (!proveedor?.email) {
      return NextResponse.json(
        { error: 'El proveedor no tiene email configurado. Editá la ficha del proveedor primero.' },
        { status: 400 },
      );
    }

    // 2. Cargar organización (para nombre de empresa en el template)
    let nombreEmpresa = 'Vanguard';
    if (oc.organizacion_id) {
      const { data: org } = await supabase
        .from('organizaciones')
        .select('nombre')
        .eq('id', oc.organizacion_id)
        .maybeSingle();
      if (org?.nombre) nombreEmpresa = org.nombre as string;
    }

    // 3. Cargar nombres de productos para legibilidad
    const codigos = (oc.ordenes_compra_items as any[]).map(i => i.producto_codigo);
    const { data: productos } = await supabase
      .from('productos')
      .select('codigo, descripcion')
      .in('codigo', codigos);
    const descMap = new Map((productos || []).map((p: any) => [p.codigo, p.descripcion as string]));

    // 4. Construir email
    const tpl = templateOCProveedor({
      numero: oc.numero,
      proveedorNombre: proveedor.nombre,
      fechaCreacion: formatFechaHora(oc.created_at),
      fechaEsperada: oc.fecha_esperada,
      creadoPor: oc.creado_por,
      contactoCompras: oc.creado_por,
      total: Number(oc.total),
      items: (oc.ordenes_compra_items as any[]).map(it => ({
        codigo: it.producto_codigo,
        descripcion: descMap.get(it.producto_codigo) || '',
        cantidad: Number(it.cantidad_ordenada),
        costoUnitario: Number(it.costo_unitario),
      })),
      notas: oc.notas,
      nombreEmpresa,
    });

    // 5. Enviar
    const result = await enviarEmail({
      to: proveedor.email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      tags: { evento: 'oc_enviada_proveedor', oc: oc.numero },
      entidadTipo: 'ordenes_compra',
      entidadId: oc.id,
      organizacionId: oc.organizacion_id || undefined,
      creadoPor: auth.user.email,
    });

    // 6. Si el envío fue OK, actualizar estado de la OC
    if (result.ok && oc.estado === 'borrador') {
      await supabase
        .from('ordenes_compra')
        .update({ estado: 'enviada' })
        .eq('id', ocId);
    }

    // 7. Audit
    await registrarAuditoriaSegura({
      tabla: 'ordenes_compra',
      accion: 'ENVIAR_PROVEEDOR',
      codigo: oc.numero,
      datosNuevos: {
        oc_id: oc.id,
        proveedor_email: proveedor.email,
        email_outbox_id: result.outboxId,
        estado_envio: result.estado,
      },
      usuarioEmail: auth.user.email,
      contexto: extraerContextoAudit(request),
    });

    return NextResponse.json({
      ok: result.ok,
      estado: result.estado,
      outbox_id: result.outboxId,
      mensaje:
        result.estado === 'enviado'
          ? `Email enviado al proveedor (${proveedor.email})`
          : result.estado === 'pendiente'
            ? `Email queda pendiente en outbox (Resend no configurado)`
            : `Falló: ${result.error}`,
    });
  } catch (err: any) {
    reportarError(err, { modulo: 'compras', accion: 'enviar-proveedor', extra: { ocId } });
    return NextResponse.json({ error: err?.message || 'Error inesperado' }, { status: 500 });
  }
}
