// =====================================================
// POST /api/compras — crear orden de compra
// =====================================================
// Flujo completo server-side:
//   1. Validar payload (zod)
//   2. Generar número de OC único
//   3. Insertar OC + items en transacción
//   4. Registrar en auditoría (hash chain)
//   5. Crear notificación in-app para destinatarios
//      configurados de la organización
//   6. Encolar email interno a esos mismos destinatarios
//   7. Devolver la OC creada
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/security/permissions';
import { parseSafe, crearOrdenCompraSchema } from '@/lib/security/zod-schemas';
import { chequearRateLimit, extraerIP } from '@/lib/security/rate-limit';
import { registrarAuditoriaSegura, extraerContextoAudit } from '@/lib/security/audit-enhanced';
import { crearNotificacion } from '@/lib/notifications';
import { enviarEmail } from '@/lib/email/send';
import { templateOCInterno, formatFechaHora } from '@/lib/email/templates';
import { reportarError } from '@/lib/security/error-reporting';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function generarNumeroOC(supabase: any): Promise<string> {
  const año = new Date().getFullYear();
  const { count } = await supabase
    .from('ordenes_compra')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', `${año}-01-01`);
  return `OC-${año}-${String((count || 0) + 1).padStart(4, '0')}`;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const parsed = parseSafe(crearOrdenCompraSchema, body);
  if (!parsed.ok) return NextResponse.json(parsed, { status: 400 });

  // Rate limit: 30 OC/hora/usuario es generoso pero protege de loops
  const ip = extraerIP(request);
  const rl = await chequearRateLimit({
    bucket: `compras:crear:${auth.user.email}`,
    max: 30, windowSeconds: 3600,
    ip, usuarioEmail: auth.user.email, ruta: '/api/compras',
  });
  if (rl.bloqueado) {
    return NextResponse.json(
      { error: 'Demasiadas órdenes de compra creadas', retry_after: rl.retryAfterSeconds },
      { status: 429 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const ctxAudit = extraerContextoAudit(request);

  try {
    // 1. Generar número
    const numero = await generarNumeroOC(supabase);

    // 2. Calcular totales
    const subtotal = parsed.data.productos.reduce((s, p) => s + p.cantidad * p.precio, 0);
    const total = subtotal; // (sin impuestos en este endpoint base)

    // 3. Buscar nombre del proveedor (para audit + notif + email)
    const { data: prov } = await supabase
      .from('proveedores')
      .select('id, nombre, email, contacto')
      .eq('id', parsed.data.proveedor_id)
      .maybeSingle();

    const proveedorNombre = (prov?.nombre as string) || '(sin nombre)';

    // 4. Insertar OC
    const { data: ordenData, error: ordenError } = await supabase
      .from('ordenes_compra')
      .insert({
        numero,
        proveedor_id: parsed.data.proveedor_id,
        estado: 'borrador',
        fecha_esperada: parsed.data.fecha_esperada || null,
        subtotal,
        total,
        notas: parsed.data.notas || null,
        creado_por: auth.user.email,
        organizacion_id: parsed.data.organizacion_id || null,
      })
      .select()
      .single();

    if (ordenError || !ordenData) {
      return NextResponse.json({ error: ordenError?.message || 'Error creando OC' }, { status: 500 });
    }

    // 5. Insertar items
    const itemsToInsert = parsed.data.productos.map(p => ({
      orden_id: ordenData.id,
      producto_codigo: p.codigo,
      cantidad_ordenada: p.cantidad,
      costo_unitario: p.precio,
      subtotal: p.cantidad * p.precio,
    }));
    const { error: itemsError } = await supabase
      .from('ordenes_compra_items')
      .insert(itemsToInsert);

    if (itemsError) {
      // Rollback parcial: borrar la OC
      await supabase.from('ordenes_compra').delete().eq('id', ordenData.id);
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    // 6. Audit log (con hash chain)
    await registrarAuditoriaSegura({
      tabla: 'ordenes_compra',
      accion: 'CREAR',
      codigo: numero,
      datosNuevos: {
        id: ordenData.id,
        numero,
        proveedor_id: parsed.data.proveedor_id,
        proveedor_nombre: proveedorNombre,
        total,
        items_count: parsed.data.productos.length,
      },
      usuarioEmail: auth.user.email,
      contexto: ctxAudit,
    });

    // 7. Notificaciones in-app + email a destinatarios configurados
    const destinatarios = await obtenerDestinatariosOC(supabase, parsed.data.organizacion_id);

    // 7a. Notif in-app para cada destinatario
    if (destinatarios.notif_in_app) {
      for (const email of destinatarios.emails) {
        await crearNotificacion({
          tipo: 'orden_compra_creada',
          severidad: 'info',
          titulo: `Nueva OC ${numero}`,
          mensaje: `${auth.user.email} creó la OC ${numero} para ${proveedorNombre} por ${total}`,
          entidadTipo: 'ordenes_compra',
          entidadId: ordenData.id,
          entidadCodigo: numero,
          usuarioEmail: email,
          dedupKey: `oc_creada:${ordenData.id}:${email}`,
          metadata: { proveedor: proveedorNombre, total, creado_por: auth.user.email },
        });
      }
    }

    // 7b. Email interno (si está habilitado)
    if (destinatarios.enviar_email && destinatarios.emails.length > 0) {
      // Zona horaria fija de Montevideo: el server corre en UTC.
      const fechaCreacion = formatFechaHora(new Date());
      const tpl = templateOCInterno({
        numero,
        proveedorNombre,
        fechaCreacion,
        fechaEsperada: parsed.data.fecha_esperada || null,
        creadoPor: auth.user.email,
        total,
        items: parsed.data.productos.map(p => ({ codigo: p.codigo, cantidad: p.cantidad, costoUnitario: p.precio })),
        notas: parsed.data.notas || null,
      });
      await enviarEmail({
        to: destinatarios.emails,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        tags: { evento: 'oc_creada', oc: numero },
        entidadTipo: 'ordenes_compra',
        entidadId: ordenData.id,
        organizacionId: parsed.data.organizacion_id || undefined,
        creadoPor: auth.user.email,
      });
    }

    return NextResponse.json({
      ok: true,
      orden: { ...ordenData, items: itemsToInsert },
      destinatarios_notificados: destinatarios.emails.length,
    });
  } catch (err: any) {
    reportarError(err, { modulo: 'compras', accion: 'crear-oc', extra: { userEmail: auth.user.email } });
    return NextResponse.json({ error: err?.message || 'Error inesperado' }, { status: 500 });
  }
}

// =====================================================
// Helper: obtiene los destinatarios para evento OC creada
// =====================================================
async function obtenerDestinatariosOC(
  supabase: any,
  organizacionId?: string | null,
): Promise<{ emails: string[]; enviar_email: boolean; notif_in_app: boolean }> {
  if (!organizacionId) {
    return { emails: [], enviar_email: false, notif_in_app: true };
  }
  const { data } = await supabase
    .from('org_notification_recipients')
    .select('emails, enviar_email, notif_in_app')
    .eq('organizacion_id', organizacionId)
    .eq('evento', 'orden_compra_creada')
    .maybeSingle();
  const row = data as { emails?: string[]; enviar_email?: boolean; notif_in_app?: boolean } | null;
  return {
    emails: row?.emails || [],
    enviar_email: row?.enviar_email !== false,
    notif_in_app: row?.notif_in_app !== false,
  };
}
