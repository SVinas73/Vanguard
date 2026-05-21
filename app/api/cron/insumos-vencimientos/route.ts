// =====================================================
// GET /api/cron/insumos-vencimientos
// =====================================================
// Job idempotente que corre 1x al día (o más).
// Para cada solicitud activa (pendiente/en_gestion/comprada) con
// fecha_limite definida:
//   - Si fecha_limite es en 3 días o menos (futuro) → notif "por vencer"
//   - Si fecha_limite ya pasó → notif "vencida" + email a gestores
//
// Idempotencia: dedupKey en notificaciones evita duplicados.
// Para emails usamos email_outbox.entidad_id como tracker.
//
// Auth: requiere header `Authorization: Bearer <CRON_SECRET>` o ser
// invocado por Vercel Cron (que también pasa ese header).
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { crearNotificacion } from '@/lib/notifications';
import { enviarEmail } from '@/lib/email/send';
import { templateSolicitudInsumo } from '@/lib/email/templates';
import { reportarError } from '@/lib/security/error-reporting';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const DIAS_AVISO_PREVIO = 3;

interface Solicitud {
  id: string;
  numero: string;
  categoria: string;
  solicitado_por: string;
  fecha_solicitud: string;
  fecha_limite: string | null;
  estado: string;
  observaciones: string | null;
  organizacion_id: string | null;
  items: any[];
}

function isAutorizado(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production'; // en dev permite sin secret
  const auth = request.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAutorizado(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const ahora = new Date();
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

  const limiteVencimientoFuturo = new Date(hoy);
  limiteVencimientoFuturo.setDate(limiteVencimientoFuturo.getDate() + DIAS_AVISO_PREVIO);

  try {
    // 1. Cargar solicitudes activas con fecha_limite
    const { data: solicitudesRaw, error } = await supabase
      .from('solicitudes_insumos')
      .select(`
        id, numero, categoria, solicitado_por, fecha_solicitud,
        fecha_limite, estado, observaciones, organizacion_id,
        items:solicitudes_insumos_items(*)
      `)
      .in('estado', ['pendiente', 'en_gestion', 'comprada'])
      .not('fecha_limite', 'is', null)
      .lte('fecha_limite', limiteVencimientoFuturo.toISOString().split('T')[0]);

    if (error) {
      reportarError(new Error(`Query vencimientos: ${error.message}`), { modulo: 'insumos', accion: 'cron-vencimientos' });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const solicitudes = (solicitudesRaw as unknown as Solicitud[]) || [];
    let porVencer = 0;
    let vencidas = 0;
    let mailsEncolados = 0;

    for (const s of solicitudes) {
      if (!s.fecha_limite) continue;
      const limite = new Date(s.fecha_limite);
      limite.setHours(0, 0, 0, 0);
      const yaVencio = limite.getTime() < hoy.getTime();

      // Cargar routing para saber destinatarios
      const routingQuery = supabase
        .from('org_categorias_insumos_routing')
        .select('gestor_emails, referente_emails, categoria_label')
        .eq('categoria', s.categoria);
      const { data: routingRaw } = s.organizacion_id
        ? await routingQuery.eq('organizacion_id', s.organizacion_id).maybeSingle()
        : await routingQuery.is('organizacion_id', null).maybeSingle();
      const routing = routingRaw as { gestor_emails?: string[]; referente_emails?: string[]; categoria_label?: string } | null;
      const gestores = routing?.gestor_emails || [];
      const referentes = routing?.referente_emails || [];

      const destinatariosInApp = [
        ...new Set([s.solicitado_por, ...gestores, ...referentes]),
      ];

      if (yaVencio) {
        vencidas++;
        // Notif in-app para todos los involucrados — dedupKey diario
        const fechaKey = hoy.toISOString().split('T')[0];
        for (const email of destinatariosInApp) {
          await crearNotificacion({
            tipo: 'solicitud_insumo_estado',
            severidad: 'error',
            titulo: `Solicitud ${s.numero} VENCIDA`,
            mensaje: `La solicitud "${s.numero}" (${routing?.categoria_label || s.categoria}) venció el ${new Date(s.fecha_limite).toLocaleDateString('es-UY')}.`,
            entidadTipo: 'solicitudes_insumos',
            entidadId: s.id,
            entidadCodigo: s.numero,
            usuarioEmail: email,
            dedupKey: `solicitud_vencida:${s.id}:${email}:${fechaKey}`,
            metadata: { estado: s.estado, fecha_limite: s.fecha_limite },
          });
        }

        // Email a gestores (una sola vez por solicitud — dedupKey por ID)
        if (gestores.length > 0 || referentes.length > 0) {
          const yaEnviado = await supabase
            .from('email_outbox')
            .select('id')
            .eq('entidad_tipo', 'solicitudes_insumos')
            .eq('entidad_id', s.id)
            .like('subject', '%VENCIDA%')
            .maybeSingle();
          if (!yaEnviado.data) {
            const tpl = templateSolicitudInsumo({
              numero: s.numero,
              categoria: s.categoria,
              categoriaLabel: routing?.categoria_label || s.categoria,
              solicitadoPor: s.solicitado_por,
              fechaSolicitud: new Date(s.fecha_solicitud).toLocaleString('es-UY', { dateStyle: 'short' }),
              fechaLimite: s.fecha_limite,
              observaciones: s.observaciones,
              items: (s.items || []).map((it: any) => ({
                descripcion: it.descripcion,
                cantidad: Number(it.cantidad),
                unidad: it.unidad,
                observaciones: it.observaciones,
              })),
            });
            // Sobreescribir subject para que sea claramente "vencida"
            await enviarEmail({
              to: gestores.length > 0 ? gestores : referentes,
              cc: gestores.length > 0 ? referentes : undefined,
              subject: `[VENCIDA] Solicitud ${s.numero} — ${routing?.categoria_label || s.categoria}`,
              html: tpl.html,
              text: `SOLICITUD VENCIDA\n\n${tpl.text}`,
              tags: { evento: 'solicitud_vencida', solicitud: s.numero },
              entidadTipo: 'solicitudes_insumos',
              entidadId: s.id,
              organizacionId: s.organizacion_id || undefined,
              creadoPor: 'cron-job',
            });
            mailsEncolados++;
          }
        }
      } else {
        // Por vencer (≤ DIAS_AVISO_PREVIO días)
        porVencer++;
        const dias = Math.round((limite.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        const fechaKey = hoy.toISOString().split('T')[0];
        for (const email of destinatariosInApp) {
          await crearNotificacion({
            tipo: 'solicitud_insumo_estado',
            severidad: 'warning',
            titulo: `Solicitud ${s.numero} por vencer`,
            mensaje: `La solicitud "${s.numero}" vence en ${dias} ${dias === 1 ? 'día' : 'días'} (${new Date(s.fecha_limite).toLocaleDateString('es-UY')}).`,
            entidadTipo: 'solicitudes_insumos',
            entidadId: s.id,
            entidadCodigo: s.numero,
            usuarioEmail: email,
            dedupKey: `solicitud_porvencer:${s.id}:${email}:${fechaKey}`,
            metadata: { estado: s.estado, fecha_limite: s.fecha_limite, dias_restantes: dias },
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      revisadas: solicitudes.length,
      por_vencer: porVencer,
      vencidas,
      mails_encolados: mailsEncolados,
    });
  } catch (err: any) {
    reportarError(err, { modulo: 'insumos', accion: 'cron-vencimientos' });
    return NextResponse.json({ error: err?.message || 'Error inesperado' }, { status: 500 });
  }
}
