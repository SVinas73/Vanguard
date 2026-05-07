import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// =====================================================
// Webhooks — sistema de despacho con retries
// =====================================================
// Cuando ocurre un evento del sistema (orden creada,
// ticket abierto, garantía vencida, etc) se buscan los
// webhooks suscritos al evento y se enqueuean entregas
// en webhook_deliveries con estado 'pendiente'.
//
// Un worker (manual o cron) procesa los pendientes con
// backoff exponencial (1m, 5m, 15m, 1h, 6h, 24h).
// Después de 6 reintentos se descartan.
//
// Cada payload va firmado con HMAC-SHA256 usando el
// secret del webhook → header X-Vanguard-Signature.
// =====================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export type EventoWebhook =
  | 'orden_venta.creada' | 'orden_venta.confirmada' | 'orden_venta.entregada' | 'orden_venta.cancelada'
  | 'orden_compra.creada' | 'orden_compra.recibida'
  | 'cotizacion.creada' | 'cotizacion.aprobada' | 'cotizacion.rechazada'
  | 'cliente.creado' | 'cliente.actualizado'
  | 'producto.bajo_stock' | 'producto.sin_stock'
  | 'ticket.abierto' | 'ticket.resuelto' | 'ticket.cerrado' | 'ticket.sla_breached'
  | 'garantia.creada' | 'garantia.por_vencer' | 'garantia.reclamada'
  | 'rma.creado' | 'rma.cerrado'
  | 'cfe.emitido' | 'cfe.aceptado' | 'cfe.rechazado'
  | 'aprobacion.creada' | 'aprobacion.aprobada' | 'aprobacion.rechazada';

const RETRY_BACKOFF_SECONDS = [60, 300, 900, 3600, 21600, 86400]; // 1m, 5m, 15m, 1h, 6h, 24h
const MAX_INTENTOS = RETRY_BACKOFF_SECONDS.length;

export interface Webhook {
  id: string;
  nombre: string;
  url: string;
  eventos: string[];
  activo: boolean;
  ultimo_envio_at?: string | null;
  ultimo_status?: number | null;
  fallos_consecutivos: number;
  headers_extra?: Record<string, string>;
  creado_por: string;
  notas?: string | null;
  created_at: string;
}

// =====================================================
// EMITIR EVENTO — encola entregas
// =====================================================

/**
 * Llamar desde cualquier flujo cuando sucede un evento
 * relevante. No-op si no hay webhooks suscritos.
 *
 *   await emitirEvento('orden_venta.creada', {
 *     numero: 'OV-001', total: 1234, cliente: 'ACME',
 *   });
 */
export async function emitirEvento(
  evento: EventoWebhook,
  payload: Record<string, unknown>
): Promise<number> {
  // Buscar webhooks que escuchan este evento o que escuchan '*'
  const { data: webhooks } = await supabase
    .from('webhooks').select('id, eventos')
    .eq('activo', true)
    .or(`eventos.cs.{${evento}},eventos.cs.{*}`);

  if (!webhooks || webhooks.length === 0) return 0;

  const enriched = {
    evento,
    payload,
    timestamp: new Date().toISOString(),
    request_id: crypto.randomBytes(8).toString('hex'),
  };

  const inserts = webhooks.map(w => ({
    webhook_id: w.id,
    evento,
    payload: enriched,
    estado: 'pendiente',
    proximo_reintento_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from('webhook_deliveries')
    .insert(inserts)
    .select('id');
  if (error) {
    console.error('emitirEvento insert error:', error);
    return 0;
  }
  return data?.length || 0;
}

// =====================================================
// FIRMA HMAC del payload
// =====================================================

function firmarPayload(payload: any, secret: string): string {
  const str = JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(str).digest('hex');
}

// =====================================================
// ENTREGA INDIVIDUAL
// =====================================================

interface EntregaResult {
  ok: boolean;
  status?: number;
  error?: string;
  duracionMs: number;
}

async function entregar(
  url: string,
  payload: any,
  secret: string,
  headersExtra: Record<string, string> = {}
): Promise<EntregaResult> {
  const start = Date.now();
  const signature = firmarPayload(payload, secret);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Vanguard-Signature': signature,
        'X-Vanguard-Event': payload.evento || 'unknown',
        'User-Agent': 'Vanguard-Webhook/1.0',
        ...headersExtra,
      },
      body: JSON.stringify(payload),
      // 10s timeout
      signal: AbortSignal.timeout(10000),
    });
    const duracion = Date.now() - start;
    return {
      ok: res.ok,
      status: res.status,
      error: res.ok ? undefined : `HTTP ${res.status}`,
      duracionMs: duracion,
    };
  } catch (e: any) {
    return {
      ok: false,
      error: e.message || 'fetch error',
      duracionMs: Date.now() - start,
    };
  }
}

// =====================================================
// PROCESAR PENDIENTES
// =====================================================
// Llamá esto desde un cron / manualmente desde el admin.
// Procesa hasta `limite` entregas pendientes cuya fecha
// proxima_reintento_at ya pasó.

export async function procesarWebhooksPendientes(limite: number = 50): Promise<{
  procesados: number; ok: number; fallidos: number; descartados: number;
}> {
  const ahora = new Date().toISOString();
  const { data: pendientes } = await supabase
    .from('webhook_deliveries')
    .select('id, webhook_id, payload, intentos')
    .eq('estado', 'pendiente')
    .lte('proximo_reintento_at', ahora)
    .order('created_at', { ascending: true })
    .limit(limite);

  if (!pendientes || pendientes.length === 0) {
    return { procesados: 0, ok: 0, fallidos: 0, descartados: 0 };
  }

  let okCount = 0, falCount = 0, dscCount = 0;

  for (const d of pendientes as any[]) {
    const { data: wh } = await supabase
      .from('webhooks').select('url, secret, headers_extra, fallos_consecutivos, activo')
      .eq('id', d.webhook_id).maybeSingle();

    if (!wh || !wh.activo) {
      await supabase.from('webhook_deliveries').update({
        estado: 'descartado', error: 'webhook inactivo o eliminado',
      }).eq('id', d.id);
      dscCount++;
      continue;
    }

    const result = await entregar(wh.url, d.payload, wh.secret, wh.headers_extra || {});
    const intentos = (d.intentos || 0) + 1;

    if (result.ok) {
      await supabase.from('webhook_deliveries').update({
        estado: 'enviado',
        status: result.status,
        intentos,
        enviado_at: new Date().toISOString(),
      }).eq('id', d.id);
      await supabase.from('webhooks').update({
        ultimo_envio_at: new Date().toISOString(),
        ultimo_status: result.status,
        fallos_consecutivos: 0,
      }).eq('id', d.webhook_id);
      okCount++;
    } else {
      const proximoIdx = Math.min(intentos, MAX_INTENTOS - 1);
      const proximoSecs = RETRY_BACKOFF_SECONDS[proximoIdx];
      const proxima = new Date(Date.now() + proximoSecs * 1000).toISOString();

      const haDescartar = intentos >= MAX_INTENTOS;
      await supabase.from('webhook_deliveries').update({
        estado: haDescartar ? 'descartado' : 'pendiente',
        status: result.status || null,
        intentos,
        error: result.error,
        proximo_reintento_at: haDescartar ? null : proxima,
      }).eq('id', d.id);

      const nuevosFallos = (wh.fallos_consecutivos || 0) + 1;
      const desactivar = nuevosFallos >= 10;
      await supabase.from('webhooks').update({
        ultimo_status: result.status || null,
        fallos_consecutivos: nuevosFallos,
        activo: desactivar ? false : wh.activo,
      }).eq('id', d.webhook_id);

      if (haDescartar) dscCount++; else falCount++;
    }
  }

  return {
    procesados: pendientes.length,
    ok: okCount, fallidos: falCount, descartados: dscCount,
  };
}

// =====================================================
// HELPERS para gestionar webhooks
// =====================================================

export async function crearWebhook(args: {
  nombre: string;
  url: string;
  eventos: EventoWebhook[];
  headersExtra?: Record<string, string>;
  notas?: string;
  creadoPor: string;
}): Promise<Webhook | null> {
  const secret = 'whsec_' + crypto.randomBytes(24).toString('hex');
  const { data, error } = await supabase.from('webhooks').insert({
    nombre: args.nombre,
    url: args.url,
    secret,
    eventos: args.eventos,
    headers_extra: args.headersExtra || {},
    notas: args.notas || null,
    creado_por: args.creadoPor,
  }).select().single();
  if (error || !data) {
    console.error('crearWebhook error:', error);
    return null;
  }
  return data as Webhook;
}

export async function eliminarWebhook(id: string): Promise<boolean> {
  const { error } = await supabase.from('webhooks').delete().eq('id', id);
  return !error;
}
