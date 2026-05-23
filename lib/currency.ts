// ============================================
// CURRENCY — formato y conversión multi-moneda
// ============================================
// Toda la app debe pasar por aquí para mostrar valores monetarios.
// Reglas:
//   - Cada producto tiene su `moneda` propia (la que se eligió al crearlo).
//   - Los reportes/dashboards pueden mostrar en una moneda objetivo
//     (org.config.display_currency) convirtiendo con `tipos_cambio`.
//   - Si no hay tasa cargada para algún par, devolvemos null y la UI
//     debe avisar al usuario (no inventamos números).

import type { Moneda } from '@/types';

export const MONEDAS_DISPONIBLES: Moneda[] = ['UYU', 'USD'];

/**
 * Formatea un valor en la moneda dada. NO convierte: usa la moneda tal cual.
 * Si querés convertir antes, llamá a `convertir()` y después a `formatMoney`.
 *
 * Usamos siempre el locale 'es-UY' (no el locale "nativo" de cada moneda)
 * para que el separador de miles/decimales sea consistente (1.234,56)
 * y el símbolo de la moneda quede inequívoco (US$, UYU $U, AR$, R$, €).
 * Antes alternábamos entre 'en-US' / 'es-AR' / etc. y eso hacía que el
 * mismo número se mostrara con símbolos parecidos pero monedas distintas,
 * confundiendo al usuario al cambiar el selector.
 */
export function formatMoney(
  value: number | null | undefined,
  moneda: Moneda = 'UYU',
  opts: { maximumFractionDigits?: number; minimumFractionDigits?: number } = {}
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: moneda,
    currencyDisplay: 'symbol',
    minimumFractionDigits: opts.minimumFractionDigits ?? 0,
    maximumFractionDigits: opts.maximumFractionDigits ?? 2,
  }).format(value);
}

// ============================================
// TIPOS DE CAMBIO
// ============================================

export interface TipoCambio {
  id?: string;
  moneda_origen: Moneda;
  moneda_destino: Moneda;
  tasa: number;
  fecha: string; // ISO date
}

/**
 * Tabla de cotizaciones cargadas, indexada por par.
 * Mantiene la más reciente por par.
 */
export type RatesTable = Map<string, TipoCambio>;

const key = (from: Moneda, to: Moneda) => `${from}->${to}`;

export function buildRatesTable(rates: TipoCambio[]): RatesTable {
  const table: RatesTable = new Map();
  // Ordenamos por fecha desc para quedarnos con la más reciente por par
  const sorted = [...rates].sort((a, b) => b.fecha.localeCompare(a.fecha));
  for (const r of sorted) {
    const k = key(r.moneda_origen, r.moneda_destino);
    if (!table.has(k)) table.set(k, r);
  }
  return table;
}

/**
 * Convierte un valor entre dos monedas. Estrategia:
 *   1. Misma moneda → devuelve tal cual.
 *   2. Hay tasa directa origen→destino → la usa.
 *   3. Hay tasa inversa destino→origen → invierte.
 *   4. Triangula por USD si existen ambos pares.
 *   5. Si nada de eso aplica → null (señal para que la UI avise).
 */
export function convertir(
  value: number,
  from: Moneda,
  to: Moneda,
  rates: RatesTable
): number | null {
  if (!Number.isFinite(value)) return null;
  if (from === to) return value;

  const direct = rates.get(key(from, to));
  if (direct) return value * direct.tasa;

  const inverse = rates.get(key(to, from));
  if (inverse) return value / inverse.tasa;

  // Triangulación por USD
  if (from !== 'USD' && to !== 'USD') {
    const fromToUsd = rates.get(key(from, 'USD')) ?? null;
    const usdFromInverse = rates.get(key('USD', from));
    const usdToDest = rates.get(key('USD', to)) ?? null;
    const destToUsdInverse = rates.get(key(to, 'USD'));

    const fromUsd = fromToUsd ? value * fromToUsd.tasa
                  : usdFromInverse ? value / usdFromInverse.tasa
                  : null;
    if (fromUsd === null) return null;

    if (usdToDest) return fromUsd * usdToDest.tasa;
    if (destToUsdInverse) return fromUsd / destToUsdInverse.tasa;
  }

  return null;
}

/**
 * Convierte y formatea en un paso. Si la conversión falla,
 * formatea en la moneda original y deja una marca visible.
 */
export function convertirYFormatear(
  value: number,
  from: Moneda,
  to: Moneda,
  rates: RatesTable
): { texto: string; convertido: boolean } {
  if (from === to) {
    return { texto: formatMoney(value, to), convertido: true };
  }
  const conv = convertir(value, from, to, rates);
  if (conv === null) {
    return { texto: `${formatMoney(value, from)} *`, convertido: false };
  }
  return { texto: formatMoney(conv, to), convertido: true };
}

/**
 * Agrega múltiples montos en distintas monedas a una moneda objetivo.
 * Devuelve total convertido + lista de items que no pudieron convertirse.
 */
export function agregarEnMoneda(
  items: Array<{ valor: number; moneda: Moneda }>,
  destino: Moneda,
  rates: RatesTable
): { total: number; sinConversion: Array<{ valor: number; moneda: Moneda }> } {
  let total = 0;
  const sinConversion: Array<{ valor: number; moneda: Moneda }> = [];
  for (const item of items) {
    const conv = convertir(item.valor, item.moneda, destino, rates);
    if (conv === null) sinConversion.push(item);
    else total += conv;
  }
  return { total, sinConversion };
}
