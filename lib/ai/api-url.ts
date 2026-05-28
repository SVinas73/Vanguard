// ============================================
// URL única del backend Vanguard-IA
// ============================================
// Históricamente convivían dos variables (NEXT_PUBLIC_VANGUARD_IA_URL y
// NEXT_PUBLIC_AI_API_URL) con defaults distintos (render vs localhost), lo
// que provocaba que algunos módulos apuntaran a localhost en producción.
//
// Esta función resuelve una sola URL con prioridad clara y un default seguro
// (el deploy en Render), no localhost.

const DEFAULT_AI_URL = 'https://vanguard-ia.onrender.com';

export function getAiApiUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_VANGUARD_IA_URL ||
    process.env.NEXT_PUBLIC_AI_API_URL ||
    DEFAULT_AI_URL;
  return url.replace(/\/+$/, ''); // sin trailing slash
}

export const AI_API_URL = getAiApiUrl();
