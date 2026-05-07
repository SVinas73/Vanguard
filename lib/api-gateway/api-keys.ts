import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// =====================================================
// API Keys — generación, validación, revocación
// =====================================================
// Formato de la key:    ak_live_<32 hex chars>
// Lo que se guarda:     prefix (primeros 12 chars visible)
//                       + sha256(key) (hash completo)
//
// La key plana SOLO se devuelve UNA VEZ al crearla. Si el
// admin la pierde tiene que rotarla.
// =====================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export type Scope =
  | 'productos:read' | 'productos:write'
  | 'clientes:read' | 'clientes:write'
  | 'proveedores:read' | 'proveedores:write'
  | 'ordenes_venta:read' | 'ordenes_venta:write'
  | 'ordenes_compra:read' | 'ordenes_compra:write'
  | 'tickets:read' | 'tickets:write'
  | 'garantias:read' | 'garantias:write'
  | 'webhooks:manage'
  | '*';

export interface ApiKey {
  id: string;
  nombre: string;
  prefix: string;
  scopes: Scope[];
  rate_limit_por_minuto: number;
  activa: boolean;
  expira_en?: string | null;
  ultimo_uso_at?: string | null;
  ultimo_uso_ip?: string | null;
  revocada_at?: string | null;
  revocada_motivo?: string | null;
  creada_por: string;
  notas?: string | null;
  created_at: string;
}

// =====================================================
// CREAR
// =====================================================

export interface CrearApiKey {
  nombre: string;
  scopes: Scope[];
  rate_limit_por_minuto?: number;
  expira_en?: string | null;
  creada_por: string;
  notas?: string;
}

export interface ApiKeyConSecreto extends ApiKey {
  /** Solo presente al crear — la key en claro para mostrarle al admin UNA vez */
  secret: string;
}

function generarKey(): { secret: string; prefix: string; hash: string } {
  const ambient = process.env.NODE_ENV === 'production' ? 'live' : 'test';
  const random = crypto.randomBytes(24).toString('hex');
  const secret = `ak_${ambient}_${random}`;
  const prefix = secret.slice(0, 12);  // ak_live_xxx
  const hash = crypto.createHash('sha256').update(secret).digest('hex');
  return { secret, prefix, hash };
}

export async function crearApiKey(args: CrearApiKey): Promise<ApiKeyConSecreto | null> {
  const { secret, prefix, hash } = generarKey();
  const { data, error } = await supabase.from('api_keys').insert({
    nombre: args.nombre,
    prefix,
    hash,
    scopes: args.scopes,
    rate_limit_por_minuto: args.rate_limit_por_minuto ?? 120,
    expira_en: args.expira_en || null,
    creada_por: args.creada_por,
    notas: args.notas || null,
  }).select().single();

  if (error || !data) {
    console.error('crearApiKey error:', error);
    return null;
  }

  return { ...(data as ApiKey), secret };
}

// =====================================================
// VALIDAR (en cada request)
// =====================================================

export interface ApiKeyContext {
  id: string;
  prefix: string;
  scopes: Scope[];
  rate_limit_por_minuto: number;
}

/**
 * Valida una key recibida en headers. Si es válida y
 * está activa, retorna el contexto para que el endpoint
 * decida si permite la acción según scopes.
 */
export async function validarApiKey(secret: string): Promise<ApiKeyContext | null> {
  if (!secret || !secret.startsWith('ak_')) return null;
  const hash = crypto.createHash('sha256').update(secret).digest('hex');

  const { data } = await supabase
    .from('api_keys')
    .select('id, prefix, scopes, rate_limit_por_minuto, activa, expira_en')
    .eq('hash', hash)
    .maybeSingle();

  if (!data || !data.activa) return null;
  if (data.expira_en && new Date(data.expira_en) < new Date()) return null;

  // Tocamos ultimo_uso_at de forma asincrónica (no bloquea
  // la respuesta del endpoint).
  void supabase.from('api_keys')
    .update({ ultimo_uso_at: new Date().toISOString() })
    .eq('id', data.id);

  return {
    id: data.id, prefix: data.prefix,
    scopes: data.scopes as Scope[],
    rate_limit_por_minuto: data.rate_limit_por_minuto,
  };
}

/**
 * Verifica si un contexto tiene un scope. El scope '*'
 * habilita todo.
 */
export function tieneScope(ctx: ApiKeyContext, requerido: Scope): boolean {
  if (ctx.scopes.includes('*')) return true;
  return ctx.scopes.includes(requerido);
}

// =====================================================
// REVOCAR
// =====================================================

export async function revocarApiKey(id: string, motivo: string, usuario: string): Promise<boolean> {
  const { error } = await supabase.from('api_keys').update({
    activa: false,
    revocada_at: new Date().toISOString(),
    revocada_motivo: motivo,
  }).eq('id', id);
  if (error) return false;
  void usuario;
  return true;
}

// =====================================================
// EXTRACTOR DE HEADERS
// =====================================================

export function extraerApiKey(req: { headers: Headers | { get(name: string): string | null } }): string | null {
  // Convención flexible: aceptamos varios formatos
  const direct = req.headers.get('x-vanguard-api-key');
  if (direct) return direct.trim();

  const auth = req.headers.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return null;
}

// =====================================================
// LOGGING DE REQUESTS
// =====================================================

export interface LogApiArgs {
  apiKeyId?: string;
  apiKeyPrefix?: string;
  metodo: string;
  ruta: string;
  status: number;
  duracionMs: number;
  ip?: string;
  userAgent?: string;
  requestBody?: any;
  responseSummary?: string;
  error?: string;
}

export async function logApiRequest(args: LogApiArgs): Promise<void> {
  try {
    await supabase.from('api_logs').insert({
      api_key_id: args.apiKeyId || null,
      api_key_prefix: args.apiKeyPrefix || null,
      metodo: args.metodo,
      ruta: args.ruta,
      status: args.status,
      duracion_ms: args.duracionMs,
      ip: args.ip || null,
      user_agent: args.userAgent || null,
      request_body: args.requestBody || null,
      response_summary: args.responseSummary || null,
      error: args.error || null,
    });
  } catch {
    /* logging best-effort */
  }
}
