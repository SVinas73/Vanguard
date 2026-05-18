// =====================================================
// Recomendador de precios — ML aplicado
// =====================================================
// Estima la elasticidad de demanda de cada producto a partir
// del histórico de transacciones (precio × cantidad), luego
// propone el precio que maximiza el margen total esperado.
//
// MODELO:
//   1. Para cada producto, agrupar ventas por nivel de precio.
//   2. Calcular demanda promedio por nivel de precio.
//   3. Regresión log-log: log(Q) = a + b·log(P) → b = elasticidad.
//   4. Precio óptimo P* = costo · (e / (e + 1)) donde e = elasticidad (negativa).
//      Equivalente a la fórmula de monopolio con costos lineales.
//
// FALLBACK (datos insuficientes):
//   - Heurística: margen objetivo 40%, sugerir precio = costo / 0.6.
//   - Marcar confianza = "baja".
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
  ingreso_esperado_anual_actual: number;
  ingreso_esperado_anual_sugerido: number;
  confianza: 'alta' | 'media' | 'baja';
  razon: string;
  oportunidad: 'subir' | 'bajar' | 'mantener';
  impacto_margen_anual: number;
  datos_usados: { transacciones: number; niveles_precio: number };
}

interface NivelPrecio {
  precio: number;
  cantidad: number;
  transacciones: number;
}

// Margen objetivo por defecto cuando no hay datos
const MARGEN_OBJETIVO_DEFAULT = 0.40;
const MIN_TRANSACCIONES = 8;
const MIN_NIVELES_PRECIO = 2;

/**
 * Agrupa ventas por nivel de precio (redondeado al 2%).
 * Esto detecta cambios de precio reales (no ruido).
 */
function agruparPorNivelPrecio(items: VentaItem[]): NivelPrecio[] {
  if (items.length === 0) return [];
  // Bucket de precios redondeando al 2% para tolerar pequeños descuentos
  const buckets: Record<string, { precio: number; cantidad: number; transacciones: number }> = {};
  for (const it of items) {
    const p = Number(it.precio_unitario) || 0;
    if (p <= 0) continue;
    const q = Number(it.cantidad) || 0;
    if (q <= 0) continue;
    // Redondear al 2% para detectar niveles distintos
    const bucket = Math.round(p / (p * 0.02 || 1)) * (p * 0.02 || 1);
    const key = String(Math.round(p * 100) / 100);
    if (!buckets[key]) buckets[key] = { precio: p, cantidad: 0, transacciones: 0 };
    buckets[key].cantidad += q;
    buckets[key].transacciones += 1;
  }
  return Object.values(buckets).sort((a, b) => a.precio - b.precio);
}

/**
 * Regresión lineal simple: y = a + b·x.
 * Devuelve [a, b].
 */
function regresionLineal(xs: number[], ys: number[]): [number, number] | null {
  if (xs.length < 2 || xs.length !== ys.length) return null;
  const n = xs.length;
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  if (den === 0) return null;
  const b = num / den;
  const a = meanY - b * meanX;
  return [a, b];
}

/**
 * Estima la elasticidad de demanda por regresión log-log.
 * Demanda Q = A · P^e → log(Q) = log(A) + e · log(P)
 * Devuelve el exponente e (típicamente negativo).
 */
function estimarElasticidad(niveles: NivelPrecio[]): number | null {
  if (niveles.length < MIN_NIVELES_PRECIO) return null;
  const logP = niveles.map(n => Math.log(n.precio));
  const logQ = niveles.map(n => Math.log(n.cantidad));
  const r = regresionLineal(logP, logQ);
  if (!r) return null;
  const [, e] = r;
  // Filtrar valores absurdos (problema de datos ruidosos)
  if (!Number.isFinite(e)) return null;
  if (Math.abs(e) > 10) return null;
  return e;
}

/**
 * Calcula el precio óptimo bajo elasticidad constante.
 * Fórmula del monopolio: P* = costo · e / (e + 1), donde e < -1 para que sea válido.
 * Si |e| ≤ 1 → demanda inelástica, subir precio siempre conviene (capeamos al +20%).
 * Si e > 0 → datos espurios, no usar.
 */
function precioOptimoElasticidad(costo: number, elasticidad: number, precioActual: number): number {
  if (elasticidad > 0) return precioActual; // dato espurio
  if (elasticidad >= -1) {
    // Demanda inelástica → ley dice subir, pero capeamos para evitar saltos extremos
    return Math.min(precioActual * 1.2, costo * 2.5);
  }
  // Demanda elástica → fórmula del óptimo
  const optimo = costo * (elasticidad / (elasticidad + 1));
  if (!Number.isFinite(optimo) || optimo <= 0) return precioActual;
  // No permitir que el precio caiga por debajo del costo + 10% mínimo
  return Math.max(optimo, costo * 1.1);
}

/**
 * Calcula recomendaciones para una lista de productos.
 */
export function recomendarPrecios(
  productos: ProductoInput[],
  ventasItems: VentaItem[]
): Recomendacion[] {
  // Agrupar items por producto
  const porProducto: Record<string, VentaItem[]> = {};
  for (const it of ventasItems) {
    if (!it.producto_codigo) continue;
    if (!porProducto[it.producto_codigo]) porProducto[it.producto_codigo] = [];
    porProducto[it.producto_codigo].push(it);
  }

  const recomendaciones: Recomendacion[] = [];

  for (const prod of productos) {
    const items = porProducto[prod.codigo] || [];
    const costo = prod.costo_promedio > 0 ? prod.costo_promedio : (prod.precio_actual * 0.6);
    const precioActual = prod.precio_actual;
    if (precioActual <= 0 || costo <= 0) continue;

    const margenActualPct = ((precioActual - costo) / precioActual) * 100;

    const niveles = agruparPorNivelPrecio(items);
    const elasticidad = niveles.length >= MIN_NIVELES_PRECIO ? estimarElasticidad(niveles) : null;
    const transacciones = items.length;

    let precioSugerido: number;
    let confianza: 'alta' | 'media' | 'baja';
    let razon: string;

    if (elasticidad !== null && transacciones >= MIN_TRANSACCIONES) {
      precioSugerido = precioOptimoElasticidad(costo, elasticidad, precioActual);
      confianza = transacciones >= 30 && niveles.length >= 3 ? 'alta' : 'media';
      razon = `Elasticidad estimada: ${elasticidad.toFixed(2)} (${transacciones} ventas, ${niveles.length} niveles de precio)`;
    } else {
      // Fallback heurístico
      precioSugerido = costo / (1 - MARGEN_OBJETIVO_DEFAULT);
      confianza = 'baja';
      razon = transacciones < MIN_TRANSACCIONES
        ? `Pocas ventas (${transacciones}). Sugerencia basada en margen objetivo del 40%.`
        : 'Sin variación de precio histórica. Sugerencia basada en margen objetivo del 40%.';
    }

    const margenSugeridoPct = ((precioSugerido - costo) / precioSugerido) * 100;
    const deltaPct = ((precioSugerido - precioActual) / precioActual) * 100;

    // Estimar ingreso anual: usar volumen anualizado (proyección lineal desde transacciones)
    const cantidadAnualActual = items.reduce((s, it) => s + (Number(it.cantidad) || 0), 0);
    const ingresoActualAnual = cantidadAnualActual * precioActual;

    // Demanda esperada al precio sugerido (con elasticidad)
    let cantidadAnualSugerida = cantidadAnualActual;
    if (elasticidad !== null && precioActual > 0) {
      // Q' = Q · (P'/P)^e
      const ratio = precioSugerido / precioActual;
      cantidadAnualSugerida = cantidadAnualActual * Math.pow(ratio, elasticidad);
    }
    const ingresoSugeridoAnual = cantidadAnualSugerida * precioSugerido;
    const impactoMargenAnual = (precioSugerido - costo) * cantidadAnualSugerida - (precioActual - costo) * cantidadAnualActual;

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
      ingreso_esperado_anual_actual: Math.round(ingresoActualAnual),
      ingreso_esperado_anual_sugerido: Math.round(ingresoSugeridoAnual),
      confianza,
      razon,
      oportunidad,
      impacto_margen_anual: Math.round(impactoMargenAnual),
      datos_usados: { transacciones, niveles_precio: niveles.length },
    });
  }

  // Ordenar por impacto de margen anual descendente (oportunidades más grandes primero)
  return recomendaciones.sort((a, b) => b.impacto_margen_anual - a.impacto_margen_anual);
}
