import { createClient } from '@supabase/supabase-js';

// =====================================================
// Rate limiting basado en Supabase (sin Redis)
// =====================================================
// Implementa "sliding window log" simple:
//  - cada request loguea una fila en rate_limit_hits
//  - el chequeo cuenta cuántos hits hubo en la ventana
//  - si supera el límite → bloquea
//
// Para volúmenes altos se puede migrar a Redis/Upstash,
// pero para este sistema (mid-market) Supabase alcanza.
// =====================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export interface RateLimitConfig {
  /** Identificador del bucket (ruta + usuario, ip, etc) */
  bucket: string;
  /** Máximo de hits permitidos en la ventana */
  max: number;
  /** Ventana en segundos */
  windowSeconds: number;
  /** Datos opcionales para auditoría */
  ip?: string;
  usuarioEmail?: string;
  ruta?: string;
}

export interface RateLimitResult {
  /** Si true, el request debe ser rechazado con 429 */
  bloqueado: boolean;
  /** Cuántos hits van en la ventana actual (antes del request) */
  hitsActuales: number;
  /** Límite configurado */
  limite: number;
  /** Segundos hasta que se libere un slot */
  retryAfterSeconds?: number;
}

/**
 * Chequea + registra un hit. Devuelve si bloquea.
 *
 * Uso:
 *   const r = await chequearRateLimit({
 *     bucket: `chat:${email}:${ip}`,
 *     max: 30, windowSeconds: 60,
 *     ip, usuarioEmail: email, ruta: '/api/asistente/chat',
 *   });
 *   if (r.bloqueado) return NextResponse.json({error:'rate limit'}, {status:429});
 */
export async function chequearRateLimit(cfg: RateLimitConfig): Promise<RateLimitResult> {
  const desde = new Date(Date.now() - cfg.windowSeconds * 1000).toISOString();

  // Contar hits en la ventana
  const { count } = await supabase
    .from('rate_limit_hits')
    .select('id', { count: 'exact', head: true })
    .eq('bucket', cfg.bucket)
    .gte('hit_at', desde);

  const hitsActuales = count ?? 0;

  if (hitsActuales >= cfg.max) {
    // Buscar el hit más viejo dentro de la ventana para
    // calcular cuánto falta para que se libere un slot.
    const { data: viejo } = await supabase
      .from('rate_limit_hits')
      .select('hit_at')
      .eq('bucket', cfg.bucket)
      .gte('hit_at', desde)
      .order('hit_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    let retryAfterSeconds = cfg.windowSeconds;
    if (viejo?.hit_at) {
      const elapsed = (Date.now() - new Date(viejo.hit_at).getTime()) / 1000;
      retryAfterSeconds = Math.max(1, Math.ceil(cfg.windowSeconds - elapsed));
    }

    return {
      bloqueado: true,
      hitsActuales,
      limite: cfg.max,
      retryAfterSeconds,
    };
  }

  // Registrar el hit (no esperamos al insert para responder rápido,
  // pero lo lanzamos)
  await supabase.from('rate_limit_hits').insert({
    bucket: cfg.bucket,
    ip: cfg.ip || null,
    usuario_email: cfg.usuarioEmail || null,
    ruta: cfg.ruta || null,
  });

  return { bloqueado: false, hitsActuales: hitsActuales + 1, limite: cfg.max };
}

/**
 * Helper para extraer IP desde NextRequest. Maneja
 * proxies (x-forwarded-for) priorizando el primer hop.
 */
export function extraerIP(req: { headers: Headers | { get(name: string): string | null } }): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

/**
 * Limpia hits viejos. Llamar ocasionalmente desde un cron
 * o desde algún endpoint admin. No es bloqueante.
 */
export async function limpiarRateLimitsViejos(retentionHours: number = 24): Promise<number> {
  const { data } = await supabase.rpc('rate_limit_cleanup', { retention_hours: retentionHours });
  return Number(data) || 0;
}
