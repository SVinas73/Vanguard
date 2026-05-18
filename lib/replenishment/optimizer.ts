// =====================================================
// Optimizador de Reabastecimiento — ML aplicado
// =====================================================
// Calcula el punto de reorden y cantidad óptima de compra
// por producto, priorizando:
//   1. NO comprar de más (capital de trabajo libre)
//   2. Evitar stockouts (pero con service level conservador 90%)
//   3. Detectar sobre-stock para liquidar y recuperar capital
//
// MODELO:
//   - Demanda diaria promedio + desvío estándar (último año).
//   - Stock de seguridad: z=1.28 (90% service level) · σ · √leadtime.
//     Esto es DELIBERADAMENTE bajo — preferimos riesgo controlado
//     de stockout que capital muerto en bodega.
//   - Punto de reorden ROP = demanda·leadtime + safety stock.
//   - Economic Order Quantity EOQ = √(2·D·S/H)
//       D = demanda anual
//       S = costo fijo por orden (default $50)
//       H = costo de mantenimiento por unidad/año = costo × 25%
//     Esto balancea costo de comprar vs costo de tener.
//
// DETECCIÓN DE SOBRE-STOCK:
//   - Si stock_actual > demanda·90días + safety_stock × 2
//     → marcamos como "excesivo" y calculamos capital atrapado.
// =====================================================

export interface ProductoStock {
  codigo: string;
  nombre: string;
  stock_actual: number;
  stock_en_transito: number;
  costo_promedio: number;
  precio_venta: number;
  categoria?: string | null;
  lead_time_dias?: number; // si no, default 14
  proveedor_id?: string | null;
}

export interface MovimientoSalida {
  producto_codigo: string;
  cantidad: number;
  fecha: string;
}

export interface Sugerencia {
  codigo: string;
  nombre: string;
  tipo: 'comprar' | 'reducir' | 'mantener';
  urgencia: 'critica' | 'alta' | 'media' | 'baja';
  // Stock state
  stock_actual: number;
  stock_en_transito: number;
  dias_de_cobertura: number;
  // Modelo
  demanda_diaria_promedio: number;
  desvio_diario: number;
  lead_time_dias: number;
  punto_reorden: number;
  stock_seguridad: number;
  cantidad_optima_compra: number;
  // Acción sugerida
  cantidad_sugerida: number; // positiva = comprar, negativa = reducir
  costo_accion: number; // capital a invertir (compra) o liberar (reducción)
  // Foco capital
  capital_inmovilizado_actual: number;
  capital_inmovilizado_optimo: number;
  capital_liberable: number;
  // Explicación
  razon: string;
  confianza: 'alta' | 'media' | 'baja';
  datos_usados: { ventas_90d: number; dias_con_movimiento: number };
}

// Default params (conservadores en capital)
const SERVICE_LEVEL_Z = 1.28; // 90% — preferimos liberar capital
const COSTO_ORDEN_DEFAULT = 50; // costo fijo por orden de compra (administrativo)
const TASA_MANTENIMIENTO_ANUAL = 0.25; // 25% del costo del item por año
const LEAD_TIME_DEFAULT = 14; // 2 semanas si no se sabe
const COBERTURA_EXCESIVA_DIAS = 90; // a partir de aquí marcamos como sobre-stock
const MIN_DIAS_DATA = 14; // mínimo de días con ventas para considerar la estadística

/**
 * Calcula media y desvío estándar de una serie.
 */
function statsSerie(xs: number[]): { mean: number; std: number } {
  const n = xs.length;
  if (n === 0) return { mean: 0, std: 0 };
  const mean = xs.reduce((s, v) => s + v, 0) / n;
  if (n === 1) return { mean, std: 0 };
  const variance = xs.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  return { mean, std: Math.sqrt(variance) };
}

/**
 * Agrupa movimientos por día → serie diaria de demanda.
 * Rellena días sin ventas con 0 (es información: no hubo demanda).
 */
function serieDemandaDiaria(
  movs: MovimientoSalida[],
  diasVentana: number
): { serie: number[]; diasConVenta: number; ventasTotal: number } {
  if (movs.length === 0) return { serie: [], diasConVenta: 0, ventasTotal: 0 };
  const hoy = new Date();
  const inicio = new Date(hoy);
  inicio.setDate(inicio.getDate() - diasVentana);
  const buckets: Record<string, number> = {};
  for (const m of movs) {
    const fecha = new Date(m.fecha);
    if (fecha < inicio) continue;
    const key = fecha.toISOString().slice(0, 10);
    buckets[key] = (buckets[key] || 0) + (Number(m.cantidad) || 0);
  }
  const serie: number[] = [];
  for (let i = 0; i < diasVentana; i++) {
    const d = new Date(inicio);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    serie.push(buckets[key] || 0);
  }
  const diasConVenta = Object.keys(buckets).length;
  const ventasTotal = serie.reduce((s, v) => s + v, 0);
  return { serie, diasConVenta, ventasTotal };
}

export function optimizarReabastecimiento(
  productos: ProductoStock[],
  movimientos: MovimientoSalida[],
  opts: {
    costoOrden?: number;
    tasaMantenimientoAnual?: number;
    leadTimeDefault?: number;
  } = {}
): Sugerencia[] {
  const costoOrden = opts.costoOrden ?? COSTO_ORDEN_DEFAULT;
  const tasaH = opts.tasaMantenimientoAnual ?? TASA_MANTENIMIENTO_ANUAL;
  const lt = opts.leadTimeDefault ?? LEAD_TIME_DEFAULT;

  // Agrupar movimientos por producto
  const porProducto: Record<string, MovimientoSalida[]> = {};
  for (const m of movimientos) {
    if (!m.producto_codigo) continue;
    if (!porProducto[m.producto_codigo]) porProducto[m.producto_codigo] = [];
    porProducto[m.producto_codigo].push(m);
  }

  const sugerencias: Sugerencia[] = [];

  for (const prod of productos) {
    const movs = porProducto[prod.codigo] || [];
    const leadTime = prod.lead_time_dias && prod.lead_time_dias > 0 ? prod.lead_time_dias : lt;
    const costo = prod.costo_promedio > 0 ? prod.costo_promedio : prod.precio_venta * 0.6;

    // Serie de 365 días para anualizar; 90 días para urgencia inmediata
    const { serie: serie365, ventasTotal: ventas365 } = serieDemandaDiaria(movs, 365);
    const { serie: serie90, diasConVenta: dias90, ventasTotal: ventas90 } = serieDemandaDiaria(movs, 90);

    const { mean: demandaDiaria, std: desvioDiario } = statsSerie(serie90);
    const demandaAnual = ventas365;

    // Confianza basada en suficiencia de datos
    let confianza: 'alta' | 'media' | 'baja';
    if (dias90 >= MIN_DIAS_DATA * 2 && ventas90 > 0) confianza = 'alta';
    else if (dias90 >= MIN_DIAS_DATA && ventas90 > 0) confianza = 'media';
    else confianza = 'baja';

    // Stock seguridad
    const stockSeguridad = SERVICE_LEVEL_Z * desvioDiario * Math.sqrt(leadTime);
    const puntoReorden = demandaDiaria * leadTime + stockSeguridad;

    // EOQ — Economic Order Quantity
    const H = costo * tasaH; // costo de tener una unidad un año
    let eoq = 0;
    if (demandaAnual > 0 && H > 0) {
      eoq = Math.sqrt((2 * demandaAnual * costoOrden) / H);
    }

    const stockTotal = prod.stock_actual + prod.stock_en_transito;
    const diasCobertura = demandaDiaria > 0 ? stockTotal / demandaDiaria : Infinity;

    // Capital inmovilizado
    const capitalActual = prod.stock_actual * costo;
    // Capital óptimo = EOQ/2 (promedio entre pedidos) + safety stock
    const stockOptimoPromedio = (eoq / 2) + stockSeguridad;
    const capitalOptimo = Math.max(0, stockOptimoPromedio * costo);
    const capitalLiberable = Math.max(0, capitalActual - capitalOptimo);

    // --- Decisión: comprar, reducir o mantener ---
    let tipo: 'comprar' | 'reducir' | 'mantener';
    let urgencia: 'critica' | 'alta' | 'media' | 'baja';
    let cantidadSugerida = 0;
    let razon = '';

    if (demandaDiaria === 0 && prod.stock_actual === 0) {
      tipo = 'mantener';
      urgencia = 'baja';
      razon = 'Sin ventas en 90 días y sin stock. No requiere acción.';
    } else if (demandaDiaria === 0 && prod.stock_actual > 0) {
      // Stock muerto
      tipo = 'reducir';
      urgencia = 'media';
      cantidadSugerida = -prod.stock_actual;
      razon = `Stock muerto: ${prod.stock_actual} unidades sin movimiento en 90 días. Capital atrapado: $${capitalActual.toFixed(0)}. Considerá liquidación o devolución.`;
    } else if (stockTotal < puntoReorden) {
      // Necesita ordenar
      tipo = 'comprar';
      const diasParaStockOut = demandaDiaria > 0 ? (stockTotal - stockSeguridad) / demandaDiaria : Infinity;
      if (diasParaStockOut <= leadTime / 2) urgencia = 'critica';
      else if (diasParaStockOut <= leadTime) urgencia = 'alta';
      else urgencia = 'media';
      // Comprar EOQ (no más)
      cantidadSugerida = Math.max(0, Math.ceil(eoq));
      razon = `Cobertura: ${diasCobertura === Infinity ? '∞' : diasCobertura.toFixed(0)} días. ROP=${puntoReorden.toFixed(0)}, stock=${stockTotal}. Demanda diaria: ${demandaDiaria.toFixed(1)}±${desvioDiario.toFixed(1)}.`;
    } else if (stockTotal > demandaDiaria * COBERTURA_EXCESIVA_DIAS + stockSeguridad * 2) {
      // Sobre-stock
      tipo = 'reducir';
      const exceso = stockTotal - (demandaDiaria * 45 + stockSeguridad); // dejar 45 días de cobertura
      cantidadSugerida = -Math.floor(exceso);
      const diasExc = diasCobertura === Infinity ? 999 : Math.floor(diasCobertura);
      urgencia = capitalLiberable > capitalActual * 0.5 ? 'alta' : 'media';
      razon = `Sobre-stock: ${diasExc} días de cobertura (objetivo ≤90). Capital recuperable: $${capitalLiberable.toFixed(0)}. Bajar precio, liquidar o devolver a proveedor.`;
    } else {
      tipo = 'mantener';
      urgencia = 'baja';
      razon = `Cobertura saludable: ${diasCobertura.toFixed(0)} días. Stock dentro de zona óptima.`;
    }

    const costoAccion = cantidadSugerida > 0
      ? cantidadSugerida * costo
      : cantidadSugerida * costo; // negativo = capital recuperable

    sugerencias.push({
      codigo: prod.codigo,
      nombre: prod.nombre,
      tipo,
      urgencia,
      stock_actual: prod.stock_actual,
      stock_en_transito: prod.stock_en_transito,
      dias_de_cobertura: Number.isFinite(diasCobertura) ? Number(diasCobertura.toFixed(1)) : -1,
      demanda_diaria_promedio: Number(demandaDiaria.toFixed(2)),
      desvio_diario: Number(desvioDiario.toFixed(2)),
      lead_time_dias: leadTime,
      punto_reorden: Math.ceil(puntoReorden),
      stock_seguridad: Math.ceil(stockSeguridad),
      cantidad_optima_compra: Math.ceil(eoq),
      cantidad_sugerida: cantidadSugerida,
      costo_accion: Math.round(costoAccion),
      capital_inmovilizado_actual: Math.round(capitalActual),
      capital_inmovilizado_optimo: Math.round(capitalOptimo),
      capital_liberable: Math.round(capitalLiberable),
      razon,
      confianza,
      datos_usados: { ventas_90d: ventas90, dias_con_movimiento: dias90 },
    });
  }

  // Ordenar: críticas + altas primero, luego por capital liberable desc
  const urgenciaOrden: Record<string, number> = { critica: 0, alta: 1, media: 2, baja: 3 };
  return sugerencias.sort((a, b) => {
    const u = urgenciaOrden[a.urgencia] - urgenciaOrden[b.urgencia];
    if (u !== 0) return u;
    return b.capital_liberable - a.capital_liberable;
  });
}
