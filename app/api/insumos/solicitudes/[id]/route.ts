// =====================================================
// /api/insumos/solicitudes/[id]
// =====================================================
// GET   → detalle de una solicitud con items
// PATCH → cambiar estado, asignar gestor, marcar recibido
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/security/permissions';
import { parseSafe, cambiarEstadoSolicitudSchema } from '@/lib/security/zod-schemas';
import { registrarAuditoriaSegura, extraerContextoAudit } from '@/lib/security/audit-enhanced';
import { crearNotificacion } from '@/lib/notifications';
import { reportarError } from '@/lib/security/error-reporting';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from('solicitudes_insumos')
    .select(`*, items:solicitudes_insumos_items(*)`)
    .eq('id', params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
  return NextResponse.json({ solicitud: data });
}

const TRANSICIONES_VALIDAS: Record<string, string[]> = {
  pendiente: ['en_gestion', 'cancelada'],
  en_gestion: ['comprada', 'recibida', 'cancelada'],
  comprada: ['recibida', 'cancelada'],
  recibida: ['cerrada'],
  cerrada: [],
  cancelada: [],
};

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const parsed = parseSafe(cambiarEstadoSolicitudSchema, body);
  if (!parsed.ok) return NextResponse.json(parsed, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Cargar solicitud actual
    const { data: actual, error: errGet } = await supabase
      .from('solicitudes_insumos')
      .select('*, items:solicitudes_insumos_items(*)')
      .eq('id', params.id)
      .maybeSingle();

    if (errGet || !actual) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    // 2. Validar transición
    const transicionesPermitidas = TRANSICIONES_VALIDAS[actual.estado] || [];
    if (actual.estado !== parsed.data.estado && !transicionesPermitidas.includes(parsed.data.estado)) {
      return NextResponse.json(
        { error: `Transición inválida: ${actual.estado} → ${parsed.data.estado}` },
        { status: 400 },
      );
    }

    // 3. Update
    const update: any = {
      estado: parsed.data.estado,
      estado_motivo: parsed.data.motivo || null,
    };
    if (parsed.data.estado === 'en_gestion' && !actual.gestor_asignado) {
      update.gestor_asignado = auth.user.email;
    }
    if (parsed.data.estado === 'recibida' && parsed.data.fecha_ingreso) {
      update.fecha_ingreso = parsed.data.fecha_ingreso;
    }
    if (parsed.data.estado === 'recibida' && !parsed.data.fecha_ingreso) {
      update.fecha_ingreso = new Date().toISOString().split('T')[0];
    }
    if (parsed.data.orden_compra_id) {
      update.orden_compra_id = parsed.data.orden_compra_id;
    }

    const { error: errUpdate } = await supabase
      .from('solicitudes_insumos')
      .update(update)
      .eq('id', params.id);

    if (errUpdate) return NextResponse.json({ error: errUpdate.message }, { status: 500 });

    // 4. Si recibió items, actualizar cantidad_recibida y generar movimientos de stock
    if (parsed.data.estado === 'recibida' && parsed.data.items_recibidos?.length) {
      for (const ir of parsed.data.items_recibidos) {
        await supabase
          .from('solicitudes_insumos_items')
          .update({ cantidad_recibida: ir.cantidad_recibida })
          .eq('id', ir.item_id);

        // Si el item está vinculado a un producto existente, generar movimiento de entrada
        const item = actual.items.find((i: any) => i.id === ir.item_id);
        if (item?.producto_codigo && ir.cantidad_recibida > 0) {
          await supabase.from('movimientos').insert({
            producto_codigo: item.producto_codigo,
            tipo: 'entrada',
            cantidad: ir.cantidad_recibida,
            motivo: `Ingreso por solicitud de insumo ${actual.numero}`,
            referencia_tipo: 'solicitud_insumo',
            referencia_id: actual.id,
            usuario_email: auth.user.email,
            organizacion_id: actual.organizacion_id,
          }).select();
        }
      }
    }

    // 5. Audit
    await registrarAuditoriaSegura({
      tabla: 'solicitudes_insumos',
      accion: 'CAMBIO_ESTADO',
      codigo: actual.numero,
      datosAnteriores: { estado: actual.estado },
      datosNuevos: {
        estado: parsed.data.estado,
        motivo: parsed.data.motivo,
        gestor: update.gestor_asignado || actual.gestor_asignado,
        fecha_ingreso: update.fecha_ingreso || null,
      },
      usuarioEmail: auth.user.email,
      contexto: extraerContextoAudit(request),
    });

    // 6. Notificar al solicitante el cambio
    await crearNotificacion({
      tipo: 'solicitud_insumo_estado',
      severidad: parsed.data.estado === 'cancelada' ? 'warning' : 'info',
      titulo: `Solicitud ${actual.numero}: ${parsed.data.estado}`,
      mensaje: `${auth.user.email} cambió el estado de tu solicitud a "${parsed.data.estado}"${parsed.data.motivo ? `. Motivo: ${parsed.data.motivo}` : ''}.`,
      entidadTipo: 'solicitudes_insumos',
      entidadId: actual.id,
      entidadCodigo: actual.numero,
      usuarioEmail: actual.solicitado_por,
      dedupKey: `solicitud_estado:${actual.id}:${parsed.data.estado}`,
      metadata: { estado_anterior: actual.estado, estado_nuevo: parsed.data.estado },
    });

    return NextResponse.json({ ok: true, estado: parsed.data.estado });
  } catch (err: any) {
    reportarError(err, { modulo: 'insumos', accion: 'cambiar-estado', extra: { solicitudId: params.id } });
    return NextResponse.json({ error: err?.message || 'Error inesperado' }, { status: 500 });
  }
}
