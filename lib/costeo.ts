// =====================================================
// Costeo de inventario — reglas únicas para toda la app
// =====================================================
// Un mismo artículo puede comprarse hoy a un precio y mañana a otro, y en
// monedas distintas. Reglas:
//
//   • Cada producto tiene su `moneda` (la de su costo). `costo_promedio`
//     SIEMPRE está expresado en esa moneda.
//   • Cada entrada guarda en `movimientos` el costo REAL pagado y su moneda
//     (`costo_compra` + `moneda_costo`), y crea un LOTE con ese mismo costo y
//     moneda. Así el historial y la valuación FIFO reflejan lo pagado.
//   • El costo promedio ponderado se recalcula convirtiendo el costo de la
//     entrada a la moneda del producto (cotización cargada o, si no hay,
//     la de referencia).
//   • Una entrada SIN costo (devolución, ajuste) no diluye el promedio: entra
//     al costo promedio vigente.
// =====================================================

import { TC_REFERENCIA_UYU_POR_USD } from '@/lib/currency';

export type MonedaCosto = 'UYU' | 'USD';

export function normalizarMoneda(m: unknown): MonedaCosto {
  return m === 'USD' ? 'USD' : 'UYU';
}

/**
 * Convierte un costo entre UYU y USD con la tasa dada (pesos por dólar).
 * Si las monedas coinciden devuelve el mismo valor.
 */
export function convertirCosto(
  valor: number,
  desde: MonedaCosto,
  hacia: MonedaCosto,
  tasaUyuPorUsd: number = TC_REFERENCIA_UYU_POR_USD,
): number {
  if (!Number.isFinite(valor)) return 0;
  if (desde === hacia) return valor;
  const tasa = tasaUyuPorUsd > 0 ? tasaUyuPorUsd : TC_REFERENCIA_UYU_POR_USD;
  return desde === 'USD' ? valor * tasa : valor / tasa;
}

/**
 * Costo promedio ponderado tras una entrada. `costoEntrada` debe venir ya
 * en la moneda del producto. Si es null/0 se asume el promedio vigente.
 */
export function calcularCostoPromedio(
  stockPrevio: number,
  costoPrevio: number,
  cantidad: number,
  costoEntrada: number | null | undefined,
): number {
  const stockBase = Math.max(0, Number(stockPrevio) || 0);
  const previo = Math.max(0, Number(costoPrevio) || 0);
  const cant = Math.max(0, Number(cantidad) || 0);
  const entrada = costoEntrada != null && costoEntrada > 0 ? costoEntrada : previo;
  const total = stockBase + cant;
  if (total <= 0) return entrada;
  const promedio = (stockBase * previo + cant * entrada) / total;
  return Math.round(promedio * 10000) / 10000;
}

type SupabaseLike = { from: (tabla: string) => any };

/**
 * Tasa vigente (pesos por dólar) de la organización. Toma la cotización más
 * reciente USD→UYU (o la inversa). Si no hay ninguna, usa la de referencia.
 */
export async function obtenerTasaUyuPorUsd(
  supabase: SupabaseLike,
  organizacionId?: string | null,
): Promise<number> {
  try {
    let q = supabase
      .from('tipos_cambio')
      .select('moneda_origen, moneda_destino, tasa, fecha')
      .in('moneda_origen', ['USD', 'UYU'])
      .in('moneda_destino', ['USD', 'UYU'])
      .order('fecha', { ascending: false })
      .limit(1);
    if (organizacionId) q = q.eq('organizacion_id', organizacionId);
    const { data } = await q;
    const r = data?.[0];
    if (r && Number(r.tasa) > 0) {
      return r.moneda_origen === 'USD' ? Number(r.tasa) : 1 / Number(r.tasa);
    }
  } catch {
    // sin tabla o sin permisos: usamos la referencia
  }
  return TC_REFERENCIA_UYU_POR_USD;
}
