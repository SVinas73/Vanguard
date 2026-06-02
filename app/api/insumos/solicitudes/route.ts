// =====================================================
// /api/insumos/solicitudes
// =====================================================
// GET  → lista solicitudes con filtros
// POST → crea solicitud + audit + notif + email (a gestores
//        y referentes configurados según categoría)
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/security/permissions';
import { parseSafe, crearSolicitudInsumoSchema } from '@/lib/security/zod-schemas';
import { chequearRateLimit, extraerIP } from '@/lib/security/rate-limit';
import { registrarAuditoriaSegura, extraerContextoAudit } from '@/lib/security/audit-enhanced';
import { crearNotificacion } from '@/lib/notifications';
import { enviarEmail } from '@/lib/email/send';
import { templateSolicitudInsumo, formatFechaHora } from '@/lib/email/templates';
import { reportarError } from '@/lib/security/error-reporting';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function generarNumero(supabase: any, orgId: string | null): Promise<string> {
  const año = new Date().getFullYear();
  const q = supabase
    .from('solicitudes_insumos')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', `${año}-01-01`);
  const { count } = orgId
    ? await q.eq('organizacion_id', orgId)
    : await q.is('organizacion_id', null);
  return `SI-${año}-${String((count || 0) + 1).padStart(4, '0')}`;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const orgId = request.nextUrl.searchParams.get('organizacion_id');
  const estado = request.nextUrl.searchParams.get('estado');
  const categoria = request.nextUrl.searchParams.get('categoria');
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '50'), 200);

  const supabase = createClient(supabaseUrl, supabaseKey);
  let q = supabase
    .from('solicitudes_insumos')
    .select(`
      *,
      items:solicitudes_insumos_items(*)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (orgId) q = q.eq('organizacion_id', orgId);
  if (estado) q = q.eq('estado', estado);
  if (categoria) q = q.eq('categoria', categoria);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ solicitudes: data || [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const parsed = parseSafe(crearSolicitudInsumoSchema, body);
  if (!parsed.ok) return NextResponse.json(parsed, { status: 400 });

  // Rate limit
  const ip = extraerIP(request);
  const rl = await chequearRateLimit({
    bucket: `insumos:crear:${auth.user.email}`,
    max: 30, windowSeconds: 3600,
    ip, usuarioEmail: auth.user.email, ruta: '/api/insumos/solicitudes',
  });
  if (rl.bloqueado) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes generadas', retry_after: rl.retryAfterSeconds },
      { status: 429 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Emails directos del form (single source of truth).
    //    El concepto "destinatarios por categoría" fue removido:
    //    el solicitante elige a quién notificar caso a caso.
    const orgId = parsed.data.organizacion_id || null;
    const destinatarios = parsed.data.emails_notificar || [];
    const categoriaLabel = parsed.data.categoria;

    // 2. Generar número y crear solicitud
    const numero = await generarNumero(supabase, orgId);

    const { data: solicitud, error: solError } = await supabase
      .from('solicitudes_insumos')
      .insert({
        numero,
        organizacion_id: orgId,
        categoria: parsed.data.categoria,
        proveedor: parsed.data.proveedor || null,
        proveedor_nombre: parsed.data.proveedor === 'OTRO' ? (parsed.data.proveedor_nombre || null) : null,
        solicitado_por: auth.user.email,
        fecha_limite: parsed.data.fecha_limite || null,
        observaciones: parsed.data.observaciones || null,
        estado: 'pendiente',
      })
      .select()
      .single();

    if (solError || !solicitud) {
      reportarError(new Error(`Insert solicitud falló: ${solError?.message}`), {
        modulo: 'insumos',
        accion: 'crear-solicitud',
        extra: { orgId, categoria: parsed.data.categoria, dbError: solError?.message, dbCode: (solError as any)?.code, dbHint: (solError as any)?.hint },
      });
      return NextResponse.json({
        error: solError?.message || 'Error creando solicitud',
        db_code: (solError as any)?.code,
        db_hint: (solError as any)?.hint,
      }, { status: 500 });
    }

    // 3. Items
    const itemsInsert = parsed.data.items.map(it => ({
      solicitud_id: solicitud.id,
      producto_codigo: it.producto_codigo || null,
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      unidad: it.unidad || 'unidad',
      observaciones: it.observaciones || null,
      // Artículo nuevo: estos datos se usan al RECIBIR para autocrear el producto.
      es_nuevo: it.es_nuevo || false,
      nuevo_codigo: it.es_nuevo ? (it.nuevo_codigo || null) : null,
      nuevo_stock_minimo: it.es_nuevo ? (it.nuevo_stock_minimo ?? null) : null,
      nuevo_categoria: it.es_nuevo ? (it.nuevo_categoria || null) : null,
      costo_estimado: it.costo_estimado ?? null,
    }));
    const { error: itemsError } = await supabase
      .from('solicitudes_insumos_items')
      .insert(itemsInsert);

    if (itemsError) {
      // Rollback
      await supabase.from('solicitudes_insumos').delete().eq('id', solicitud.id);
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    // 4. Audit log
    await registrarAuditoriaSegura({
      tabla: 'solicitudes_insumos',
      accion: 'CREAR',
      codigo: numero,
      datosNuevos: {
        id: solicitud.id,
        categoria: parsed.data.categoria,
        items_count: parsed.data.items.length,
        destinatarios_count: destinatarios.length,
      },
      usuarioEmail: auth.user.email,
      contexto: extraerContextoAudit(request),
    });

    // 5. Notificación in-app a los emails que el solicitante eligió
    for (const email of destinatarios) {
      await crearNotificacion({
        tipo: 'solicitud_insumo_creada',
        severidad: 'info',
        titulo: `Nueva solicitud ${numero}`,
        mensaje: `${auth.user.email} solicitó insumos. ${parsed.data.items.length} items.`,
        entidadTipo: 'solicitudes_insumos',
        entidadId: solicitud.id,
        entidadCodigo: numero,
        usuarioEmail: email,
        dedupKey: `solicitud_insumo:${solicitud.id}:${email}`,
        metadata: {
          solicitante: auth.user.email,
          fecha_limite: parsed.data.fecha_limite,
        },
      });
    }

    // 6. Email a destinatarios elegidos
    if (destinatarios.length > 0) {
      // formatFechaHora fuerza zona América/Montevideo. Sin esto, el server
      // (Vercel/Node) usa UTC y la hora del mail venía con offset.
      const fechaSolicitud = formatFechaHora(new Date());
      const tpl = templateSolicitudInsumo({
        numero,
        categoria: parsed.data.categoria,
        categoriaLabel,
        solicitadoPor: auth.user.email,
        fechaSolicitud,
        fechaLimite: parsed.data.fecha_limite || null,
        observaciones: parsed.data.observaciones || null,
        items: parsed.data.items.map(it => ({
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          unidad: it.unidad,
          observaciones: it.observaciones || null,
        })),
      });
      await enviarEmail({
        to: destinatarios,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        replyTo: auth.user.email,
        tags: { evento: 'solicitud_insumo', solicitud: numero },
        entidadTipo: 'solicitudes_insumos',
        entidadId: solicitud.id,
        organizacionId: orgId || undefined,
        creadoPor: auth.user.email,
      });
    }

    return NextResponse.json({
      ok: true,
      solicitud: { ...solicitud, items: itemsInsert },
      destinatarios_notificados: destinatarios.length,
      aviso: destinatarios.length === 0
        ? 'Solicitud creada sin destinatarios de email. Quedó como pendiente.'
        : null,
    });
  } catch (err: any) {
    reportarError(err, { modulo: 'insumos', accion: 'crear-solicitud', extra: { userEmail: auth.user.email } });
    return NextResponse.json({ error: err?.message || 'Error inesperado' }, { status: 500 });
  }
}
