// =====================================================
// Aprendizaje de rutina del usuario (local, privacy-first)
// =====================================================
// Registra qué módulos usa cada usuario y CUÁNDO (hora del día + día de
// semana). Con eso predice, en cada momento, qué tareas/módulos es probable
// que necesite — "aprendiendo su rutina diaria".
//
// Todo se guarda en localStorage por usuario: no viaja a ningún servidor,
// no expone datos sensibles y funciona offline. Si en el futuro se quiere
// sincronizar entre dispositivos, esta misma lógica puede moverse a una
// tabla `user_activity` en Supabase sin cambiar la interfaz.

export interface RoutineEvent {
  tab: string;
  h: number;   // hora local 0-23
  d: number;   // día de semana 0-6 (0=domingo)
  ts: number;  // epoch ms
}

export interface RoutineSuggestion {
  tab: string;
  score: number;       // 0..1 normalizado
  /** Por qué se sugiere (para mostrar al usuario). */
  motivo: string;
}

const MAX_EVENTS = 800;
const MIN_EVENTS_TO_LEARN = 10;
const KEY_PREFIX = 'vg:routine:';

function keyFor(userKey: string) {
  return `${KEY_PREFIX}${userKey || 'anon'}`;
}

function load(userKey: string): RoutineEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(keyFor(userKey));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function save(userKey: string, events: RoutineEvent[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(keyFor(userKey), JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {
    /* cuota llena / modo privado: ignorar */
  }
}

/** Registra una visita a un módulo. No registra 'inicio' (es el punto de partida). */
export function recordModuleVisit(userKey: string, tab: string, now: Date = new Date()): void {
  if (!tab || tab === 'inicio') return;
  const events = load(userKey);
  const last = events[events.length - 1];
  // Anti-ruido: no contar la misma pestaña dos veces seguidas en < 3s.
  // (diff >= 0 evita falsos positivos con inserciones fuera de orden.)
  const diff = now.getTime() - (last?.ts ?? -Infinity);
  if (last && last.tab === tab && diff >= 0 && diff < 3000) return;
  events.push({ tab, h: now.getHours(), d: now.getDay(), ts: now.getTime() });
  save(userKey, events);
}

/** Distancia circular entre dos horas (0..12). */
function hourDistance(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, 24 - diff);
}

/**
 * Calcula sugerencias para el momento actual combinando:
 *   - Frecuencia total del módulo (cuánto lo usás).
 *   - Recencia (decaimiento exponencial, vida media ~14 días).
 *   - Coincidencia con la hora del día actual (±2h pesa más).
 *   - Coincidencia con el día de semana actual.
 */
export function getRoutineSuggestions(
  userKey: string,
  opts: { now?: Date; limit?: number; exclude?: string[] } = {},
): RoutineSuggestion[] {
  const now = opts.now ?? new Date();
  const limit = opts.limit ?? 4;
  const exclude = new Set(opts.exclude ?? []);
  const events = load(userKey);
  if (events.length < MIN_EVENTS_TO_LEARN) return [];

  const HALF_LIFE_MS = 14 * 24 * 3600 * 1000;
  const nowMs = now.getTime();
  const curH = now.getHours();
  const curD = now.getDay();

  const agg: Record<string, { score: number; count: number; hourHits: number }> = {};

  for (const e of events) {
    if (exclude.has(e.tab)) continue;
    const recency = Math.pow(0.5, (nowMs - e.ts) / HALF_LIFE_MS); // 1 reciente → 0 viejo
    const hDist = hourDistance(e.h, curH);
    const hourW = hDist <= 2 ? 1.6 : hDist <= 4 ? 1.0 : 0.45;
    const dayW = e.d === curD ? 1.35 : 1.0;
    const w = recency * hourW * dayW;

    if (!agg[e.tab]) agg[e.tab] = { score: 0, count: 0, hourHits: 0 };
    agg[e.tab].score += w;
    agg[e.tab].count += 1;
    if (hDist <= 2) agg[e.tab].hourHits += 1;
  }

  const entries = Object.entries(agg);
  if (entries.length === 0) return [];
  const maxScore = Math.max(...entries.map(([, v]) => v.score)) || 1;

  return entries
    .map(([tab, v]) => {
      const norm = v.score / maxScore;
      const motivo = v.hourHits >= 2
        ? 'Sueles usarlo a esta hora'
        : v.count >= 5
          ? 'De los que más usás'
          : 'Parte de tu rutina';
      return { tab, score: Number(norm.toFixed(3)), motivo };
    })
    .filter((s) => s.score >= 0.15) // descartar ruido marginal
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Métrica simple para saber cuánto "sabe" el sistema de la rutina del usuario. */
export function getRoutineMaturity(userKey: string): { events: number; learning: boolean } {
  const events = load(userKey);
  return { events: events.length, learning: events.length >= MIN_EVENTS_TO_LEARN };
}
