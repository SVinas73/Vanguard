// =====================================================
// Recomendador de precios — pricing científico
// =====================================================
// Estima la elasticidad-precio de la demanda de cada producto a partir del
// histórico de transacciones y propone el precio que maximiza el margen total
// esperado, con guardarraíles para evitar recomendaciones extremas.
//
// METODOLOGÍA (mejoras sobre la versión inicial):
//   1. Agrupar ventas por NIVEL DE PRECIO (buckets relativos del 2% para
//      tolerar descuentos chicos / ruido), y usar la DEMANDA MEDIA POR
//      TRANSACCIÓN de cada nivel (tasa de demanda), no la suma total — así no
//      se sesga por cuántas veces apareció cada precio.
//   2. Regresión log-log PONDERADA por nº de transacciones:
//        log(Q) = a + e·log(P)  → e = elasticidad (típicamente < 0).
//      Se calcula el R² para medir la calidad del ajuste.
//   3. Precio óptimo (monopolio, costo lineal, elasticidad constante):
//        e < -1 (elástica):   P* = c·e/(e+1)
//        -1 ≤ e < 0 (inelástica): conviene subir → se sube hasta la banda.
//   4. GUARDARRAÍLES: el precio sugerido se acota a ±banda% del precio actual
//      (default 25%) y nunca cae por debajo de costo·(1+margenMínimo). Cuando
//      el ajuste (R²) es pobre, se ENCOGE la recomendación hacia el precio
//      actual (shrinkage) para no actuar sobre señales ruidosas.
//
// FALLBACK (datos insuficientes o sin variación de precio):
//   - Margen objetivo (default 40%): precio = costo/(1−margen). Confianza baja.
// =====================================================

export interface VentaItem {
  producto_codigo: string;
  cantidad: number;
  precio_unitario: number;
  costo_unitario?: number | null;
  fecha?: string | null;
}

export interface ProductoInput {
  codigo: string;
  nombre: string;
  precio_actual: number;
  costo_promedio: number;
  categoria?: string | null;
  stock_actual?: number;
}

export interface Recomendacion {
  codigo: string;
  nombre: string;
  precio_actual: number;
  precio_sugerido: number;
  delta_pct: number;
  margen_actual_pct: number;
  margen_sugerido_pct: number;
  elasticidad: number | null;
  r2: number | null;
  ingreso_esperado_anual_actual: number;
  ingreso_esperado_anual_sugerido: number;
  confianza: 'alta' | 'media' | 'baja';
  razon: string;
  oportunidad: 'subir' | 'bajar' | 'mantener';
  impacto_margen_anual: number;
  datos_usados: { transacciones: number; niveles_precio: number };
}

export interface PricingOpts {
  /** Máximo cambio relativo permitido vs precio actual (guardarraíl). */
  bandaMaxCambio?: number;
  /** Margen mínimo sobre costo que debe conservar el precio sugerido. */
  margenMinimo?: number;
  /** Margen objetivo del fallback heurístico. */
  margenObjetivoDefault?: number;
  minTransacciones?: number;
  minNiveles?: number;
}

interface NivelPrecio {
  precio: number;
  demandaMedia: number; // cantidad media por transacción a ese precio
  transacciones: number;
}

const DEFAULTS: Required<PricingOpts> = {
  bandaMaxCambio: 0.25,
  margenMinimo: 0.05,
  margenObjetivoDefault: 0.40,
  minTransacciones: 8,
  minNiveles: 2,
};

const MAX_ELASTICIDAD_ABS = 10; // descartar valores absurdos por ruido
const R2_CONFIABLE = 0.6;       // umbral de ajuste para confianza alta

/**
 * Agrupa ventas por nivel de precio (buckets relativos del 2%) y calcula la
 * demanda media por transacción en cada nivel. Usar la MEDIA evita sesgar la
 * elasticidad por la frecuencia con que apareció cada precio.
 */
function agruparPorNivelPrecio(items: VentaItem[]): NivelPrecio[] {
  if (items.length === 0) return [];
  const buckets: Record<string, { precioSum: number; cantidad: number; transacciones: number }> = {};
  for (const it of items) {
    const p = Number(it.precio_unitario) || 0;
    const q = Number(it.cantidad) || 0;
    if (p <= 0 || q <= 0) continue;
    // Bucket logarítmico: agrupa precios dentro del ~2% en el mismo nivel.
    const key = Math.round(Math.log(p) / 0.02).toString();
    if (!buckets[key]) buckets[key] = { precioSum: 0, cantidad: 0, transacciones: 0 };
    buckets[key].precioSum += p;
    buckets[key].cantidad += q;
    buckets[key].transacciones += 1;
  }
  return Object.values(buckets)
    .map((b) => ({
      precio: b.precioSum / b.transacciones,
      demandaMedia: b.cantidad / b.transacciones,
      transacciones: b.transacciones,
    }))
    .sort((a, b) => a.precio - b.precio);
}

/**
 * Regresión lineal ponderada: y = a + b·x. Devuelve { a, b, r2 }.
 * Los pesos (w) permiten dar más importancia a niveles con más transacciones.
 */
function regresionPonderada(
  xs: number[], ys: number[], ws: number[],
): { a: number; b: number; r2: number } | null {
  const n = xs.length;
  if (n < 2 || ys.length !== n || ws.length !== n) return null;
  const W = ws.reduce((s, v) => s + v, 0);
  if (W <= 0) return null;
  const meanX = xs.reduce((s, v, i) => s + v * ws[i], 0) / W;
  const meanY = ys.reduce((s, v, i) => s + v * ws[i], 0) / W;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    sxy += ws[i] * dx * dy;
    sxx += ws[i] * dx * dx;
    syy += ws[i] * dy * dy;
  }
  if (sxx === 0) return null;
  const b = sxy / sxx;
  const a = meanY - b * meanX;
  const r2 = syy === 0 ? 1 : Math.max(0, Math.min(1, (sxy * sxy) / (sxx * syy)));
  return { a, b, r2 };
}

/**
 * Estima la elasticidad por regresión log-log ponderada.
 * Devuelve { e, r2 } o null si no es confiable/finita.
 */
function estimarElasticidad(niveles: NivelPrecio[]): { e: number; r2: number } | null {
  if (niveles.length < 2) return null;
  const logP = niveles.map((n) => Math.log(n.precio));
  const logQ = niveles.map((n) => Math.log(n.demandaMedia));
  const ws = niveles.map((n) => n.transacciones);
  const r = regresionPonderada(logP, logQ, ws);
  if (!r) return null;
  if (!Number.isFinite(r.b) || Math.abs(r.b) > MAX_ELASTICIDAD_ABS) return null;
  return { e: r.b, r2: r.r2 };
}

/**
 * Precio óptimo bajo elasticidad constante, ya acotado por guardarraíles.
 * - e < -1 (elástica): P* = c·e/(e+1).
 * - -1 ≤ e < 0 (inelástica): subir conviene → vamos al tope de la banda.
 * - shrink (0..1, derivado de R²) encoge la recomendación hacia el precio
 *   actual cuando el ajuste es pobre.
 */
function precioOptimo(
  costo: number, elasticidad: number, precioActual: number,
  shrink: number, opts: Required<PricingOpts>,
): number {
  const pisoMargen = costo * (1 + opts.margenMinimo);
  const min = Math.max(precioActual * (1 - opts.bandaMaxCambio), pisoMargen);
  const max = precioActual * (1 + opts.bandaMaxCambio);

  let objetivo: number;
  if (elasticidad >= 0) {
    objetivo = precioActual; // dato espurio: no mover
  } else if (elasticidad >= -1) {
    // Inelástica: la teoría dice subir; subimos hacia el tope de la banda.
    objetivo = max;
  } else {
    const optimo = costo * (elasticidad / (elasticidad + 1));
    objetivo = Number.isFinite(optimo) && optimo > 0 ? optimo : precioActual;
  }

  // Shrinkage hacia el precio actual según calidad del ajuste.
  const ajustado = precioActual + (objetivo - precioActual) * shrink;
  // Guardarraíl final.
  return Math.min(max, Math.max(min, ajustado));
}

export function recomendarPrecios(
  productos: ProductoInput[],
  ventasItems: VentaItem[],
  opts: PricingOpts = {},
): Recomendacion[] {
  const cfg = { ...DEFAULTS, ...opts };

  const porProducto: Record<string, VentaItem[]> = {};
  for (const it of ventasItems) {
    if (!it.producto_codigo) continue;
    (porProducto[it.producto_codigo] ??= []).push(it);
  }

  const recomendaciones: Recomendacion[] = [];

  for (const prod of productos) {
    const items = porProducto[prod.codigo] || [];
    const costo = prod.costo_promedio > 0 ? prod.costo_promedio : prod.precio_actual * 0.6;
    const precioActual = prod.precio_actual;
    if (!(precioActual > 0) || !(costo > 0)) continue;

    const margenActualPct = ((precioActual - costo) / precioActual) * 100;
    const niveles = agruparPorNivelPrecio(items);
    const transacciones = items.length;
    const est = niveles.length >= cfg.minNiveles ? estimarElasticidad(niveles) : null;

    let precioSugerido: number;
    let confianza: 'alta' | 'media' | 'baja';
    let razon: string;
    let elasticidad: number | null = null;
    let r2: number | null = null;

    if (est !== null && transacciones >= cfg.minTransacciones) {
      elasticidad = est.e;
      r2 = est.r2;
      // shrink: 0 si ajuste nulo, 1 si perfecto (suave, no lineal puro).
      const shrink = Math.max(0.15, Math.min(1, est.r2 / R2_CONFIABLE));
      precioSugerido = precioOptimo(costo, est.e, precioActual, shrink, cfg);
      if (transacciones >= 30 && niveles.length >= 3 && est.r2 >= R2_CONFIABLE) confianza = 'alta';
      else if (est.r2 >= 0.3) confianza = 'media';
      else confianza = 'baja';
      razon = `Elasticidad ${est.e.toFixed(2)} (R²=${est.r2.toFixed(2)}, ${transacciones} ventas, ${niveles.length} niveles)`;
    } else {
      precioSugerido = costo / (1 - cfg.margenObjetivoDefault);
      confianza = 'baja';
      razon = transacciones < cfg.minTransacciones
        ? `Pocas ventas (${transacciones}). Sugerencia por margen objetivo del ${Math.round(cfg.margenObjetivoDefault * 100)}%.`
        : `Sin variación de precio histórica. Sugerencia por margen objetivo del ${Math.round(cfg.margenObjetivoDefault * 100)}%.`;
    }

    const margenSugeridoPct = ((precioSugerido - costo) / precioSugerido) * 100;
    const deltaPct = ((precioSugerido - precioActual) / precioActual) * 100;

    // Volumen observado (proxy anual) e impacto esperado vía elasticidad.
    const cantidadActual = items.reduce((s, it) => s + (Number(it.cantidad) || 0), 0);
    const ingresoActualAnual = cantidadActual * precioActual;
    let cantidadSugerida = cantidadActual;
    if (elasticidad !== null && precioActual > 0) {
      cantidadSugerida = cantidadActual * Math.pow(precioSugerido / precioActual, elasticidad);
    }
    const ingresoSugeridoAnual = cantidadSugerida * precioSugerido;
    const impactoMargenAnual =
      (precioSugerido - costo) * cantidadSugerida - (precioActual - costo) * cantidadActual;

    let oportunidad: 'subir' | 'bajar' | 'mantener';
    if (Math.abs(deltaPct) < 3) oportunidad = 'mantener';
    else if (deltaPct > 0) oportunidad = 'subir';
    else oportunidad = 'bajar';

    recomendaciones.push({
      codigo: prod.codigo,
      nombre: prod.nombre,
      precio_actual: precioActual,
      precio_sugerido: Number(precioSugerido.toFixed(2)),
      delta_pct: Number(deltaPct.toFixed(1)),
      margen_actual_pct: Number(margenActualPct.toFixed(1)),
      margen_sugerido_pct: Number(margenSugeridoPct.toFixed(1)),
      elasticidad: elasticidad !== null ? Number(elasticidad.toFixed(2)) : null,
      r2: r2 !== null ? Number(r2.toFixed(2)) : null,
      ingreso_esperado_anual_actual: Math.round(ingresoActualAnual),
      ingreso_esperado_anual_sugerido: Math.round(ingresoSugeridoAnual),
      confianza,
      razon,
      oportunidad,
      impacto_margen_anual: Math.round(impactoMargenAnual),
      datos_usados: { transacciones, niveles_precio: niveles.length },
    });
  }

  return recomendaciones.sort((a, b) => b.impacto_margen_anual - a.impacto_margen_anual);
}
