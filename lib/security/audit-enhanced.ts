import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// =====================================================
// Auditoría enterprise-grade
// =====================================================
// Mejoras sobre lib/audit.ts:
//   • IP del cliente
//   • User-Agent
//   • Request ID (para trazar un request end-to-end)
//   • Hash chain (HMAC-SHA256 enlazado al hash anterior
//     del mismo usuario) → si alguien borra/altera un row
//     del log la cadena se rompe y es detectable.
//
// El hash es:
//   HMAC(key, prev_hash || tabla || accion || codigo ||
//        usuario || created_at || JSON(datos_nuevos))
//
// La key vive en process.env.AUDIT_HMAC_KEY
// =====================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const HMAC_KEY = process.env.AUDIT_HMAC_KEY || 'vanguard-audit-default-key-change-me';

export interface AuditContext {
  ip?: string;
  userAgent?: string;
  requestId?: string;
}

export interface AuditEntry {
  tabla: string;
  accion: string;
  codigo?: string | null;
  datosAnteriores?: any;
  datosNuevos?: any;
  usuarioEmail: string;
  contexto?: AuditContext;
}

/**
 * Calcula el hash HMAC del entry, encadenado con el hash
 * anterior del mismo usuario (o cadena global si no se
 * encuentra un previo).
 */
function calcularHashChain(entry: AuditEntry, hashPrevio: string, createdAt: string): string {
  const payload = [
    hashPrevio,
    entry.tabla,
    entry.accion,
    entry.codigo || '',
    entry.usuarioEmail,
    createdAt,
    JSON.stringify(entry.datosNuevos || null),
  ].join('|');

  return crypto.createHmac('sha256', HMAC_KEY).update(payload).digest('hex');
}

/**
 * Versión enhanced de registrarAuditoria. Agrega IP, UA,
 * request_id y arma la cadena de hashes.
 *
 * Uso desde un route handler:
 *   await registrarAuditoriaSegura({
 *     tabla: 'ordenes_venta', accion: 'CREAR', codigo: 'OV-001',
 *     datosNuevos: { ... }, usuarioEmail: user.email,
 *     contexto: { ip, userAgent, requestId },
 *   });
 */
export async function registrarAuditoriaSegura(entry: AuditEntry): Promise<void> {
  try {
    // Obtener el último hash del usuario (para encadenar)
    const { data: ultimo } = await supabase
      .from('auditoria')
      .select('hash_actual')
      .eq('usuario_email', entry.usuarioEmail)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    const hashPrevio = ultimo?.hash_actual || 'GENESIS';
    const createdAt = new Date().toISOString();
    const hashActual = calcularHashChain(entry, hashPrevio, createdAt);

    await supabase.from('auditoria').insert({
      tabla: entry.tabla,
      accion: entry.accion,
      codigo: entry.codigo || null,
      datos_anteriores: entry.datosAnteriores || null,
      datos_nuevos: entry.datosNuevos || null,
      usuario_email: entry.usuarioEmail,
      created_at: createdAt,
      ip: entry.contexto?.ip || null,
      user_agent: entry.contexto?.userAgent || null,
      request_id: entry.contexto?.requestId || null,
      hash_previo: hashPrevio,
      hash_actual: hashActual,
    });
  } catch (err) {
    console.error('Error registrando auditoría enhanced:', err);
  }
}

/**
 * Verifica la integridad de la cadena para un usuario
 * dado. Recorre desde el principio y recalcula cada hash.
 * Devuelve la primera ruptura encontrada (o null si OK).
 */
export interface RupturaCadena {
  id: number;
  esperado: string;
  encontrado: string | null;
  created_at: string;
}

export async function verificarCadenaAuditoria(
  usuarioEmail: string
): Promise<{ ok: boolean; total: number; ruptura?: RupturaCadena }> {
  const { data: rows } = await supabase
    .from('auditoria')
    .select('id, tabla, accion, codigo, usuario_email, created_at, datos_nuevos, hash_previo, hash_actual')
    .eq('usuario_email', usuarioEmail)
    .order('id', { ascending: true });

  if (!rows || rows.length === 0) return { ok: true, total: 0 };

  let prev = 'GENESIS';
  for (const r of rows as any[]) {
    const esperado = calcularHashChain(
      {
        tabla: r.tabla, accion: r.accion, codigo: r.codigo,
        datosNuevos: r.datos_nuevos, usuarioEmail: r.usuario_email,
      },
      prev,
      r.created_at,
    );
    if (r.hash_actual !== esperado || r.hash_previo !== prev) {
      return {
        ok: false,
        total: rows.length,
        ruptura: {
          id: r.id,
          esperado,
          encontrado: r.hash_actual,
          created_at: r.created_at,
        },
      };
    }
    prev = r.hash_actual;
  }

  return { ok: true, total: rows.length };
}

/**
 * Helper para extraer contexto desde un NextRequest.
 */
export function extraerContextoAudit(
  req: { headers: Headers | { get(name: string): string | null } },
  usuarioEmail?: string
): AuditContext {
  const xff = req.headers.get('x-forwarded-for');
  const ip = xff ? xff.split(',')[0].trim() : (req.headers.get('x-real-ip') || 'unknown');
  const userAgent = req.headers.get('user-agent') || 'unknown';
  // requestId: si el cliente lo manda, usarlo; si no, generar uno
  const requestId = req.headers.get('x-request-id') ||
    crypto.randomBytes(8).toString('hex') + '-' + Date.now().toString(36);
  void usuarioEmail;
  return { ip, userAgent, requestId };
}
