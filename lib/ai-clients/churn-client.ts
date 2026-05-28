// =====================================================
// Churn Client — combina Vanguard-IA + postsale-mvp
// =====================================================
// Vanguard-IA   → score numérico de churn (XGBoost)
// postsale-mvp  → análisis cualitativo (LLM sobre emails)
// =====================================================

import { AI_API_URL } from '@/lib/ai/api-url';

const VANGUARD_IA_URL = AI_API_URL;
const POSTSALE_URL = process.env.NEXT_PUBLIC_POSTSALE_URL || '';

const FETCH_TIMEOUT_MS = 30_000;

/** fetch con timeout vía AbortController (evita requests colgados). */
async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export interface ChurnScore {
  cliente_id: string;
  cliente_nombre: string;
  probabilidad_churn: number;
  nivel_riesgo: 'critico' | 'alto' | 'medio' | 'bajo';
  razon_principal: string;
  features: Record<string, number>;
  fecha_calculo: string;
}

export interface ChurnSummary {
  total_clientes: number;
  criticos: number;
  alto_riesgo: number;
  medio_riesgo: number;
  bajo_riesgo: number;
  fecha_calculo: string;
}

export interface PostsaleClienteResumen {
  id: number;
  nombre: string;
  plan_actual: string;
  ultimo_nivel_riesgo: string | null;
  ultima_probabilidad_churn: number | null;
  ultima_accion_recomendada: string | null;
  fecha_ultimo_analisis: string | null;
  total_analisis: number;
}

export interface PostsaleAnalisis {
  cliente_id: number;
  cliente_nombre: string;
  nivel_riesgo: string;
  probabilidad_churn_porcentaje: number;
  razon_principal: string;
  accion_recomendada_para_el_gestor: string;
  score_confianza: number;
  requiere_revision_manual: boolean;
  fecha_analisis: string;
}

export interface PostsaleTarea {
  id: number;
  cliente_id: number;
  cliente_nombre: string;
  nivel_riesgo: string;
  accion_sugerida: string;
  estado: string;
  fecha_creacion: string;
  gestor: string | null;
  notas: string | null;
}

// ============================================
// Vanguard-IA: score numérico ML
// ============================================

async function fetchVanguardIA<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (!VANGUARD_IA_URL) return null;
  try {
    const r = await fetchWithTimeout(`${VANGUARD_IA_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function getChurnScores(opts: { limit?: number; min_risk?: number } = {}): Promise<ChurnScore[]> {
  const params = new URLSearchParams();
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.min_risk !== undefined) params.set('min_risk', String(opts.min_risk));
  const r = await fetchVanguardIA<ChurnScore[]>(`/churn/scores?${params}`);
  return r || [];
}

export async function getChurnScoreCliente(clienteId: string): Promise<ChurnScore | null> {
  return await fetchVanguardIA<ChurnScore>(`/churn/score/${encodeURIComponent(clienteId)}`);
}

export async function getChurnSummary(): Promise<ChurnSummary | null> {
  return await fetchVanguardIA<ChurnSummary>('/churn/summary');
}

export async function trainChurnModel(): Promise<{ entrenado: boolean; auc_test: number } | null> {
  return await fetchVanguardIA('/churn/train', { method: 'POST' });
}

// ============================================
// postsale-mvp: análisis cualitativo LLM
// ============================================

async function fetchPostsale<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (!POSTSALE_URL) return null;
  try {
    const r = await fetchWithTimeout(`${POSTSALE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function getPostsaleClientes(): Promise<PostsaleClienteResumen[]> {
  const r = await fetchPostsale<PostsaleClienteResumen[]>('/clientes');
  return r || [];
}

export async function getPostsaleClienteDetalle(clienteId: number): Promise<{
  cliente: PostsaleClienteResumen;
  historial: PostsaleAnalisis[];
  tendencia: string;
} | null> {
  return await fetchPostsale(`/clientes/${clienteId}`);
}

export async function getPostsaleTareas(estado?: string): Promise<PostsaleTarea[]> {
  const q = estado ? `?estado=${estado}` : '';
  const r = await fetchPostsale<PostsaleTarea[]>(`/tareas${q}`);
  return r || [];
}

export async function actualizarPostsaleTarea(id: number, patch: Partial<PostsaleTarea>): Promise<PostsaleTarea | null> {
  return await fetchPostsale(`/tareas/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

// ============================================
// Disponibilidad de cada backend
// ============================================

export async function checkAiBackends(): Promise<{ vanguardIA: boolean; postsale: boolean }> {
  const [v, p] = await Promise.all([
    fetchVanguardIA<{ status: string }>('/health'),
    fetchPostsale<{ estado: string }>('/'),
  ]);
  return { vanguardIA: !!v, postsale: !!p };
}
