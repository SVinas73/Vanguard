// =====================================================
// Reporte de insumos — SIEMPRE en dólares
// =====================================================
// Reglas:
//   • Todo se expresa en USD. Un costo cargado en USD se toma tal cual; uno
//     cargado en pesos uruguayos se divide por la cotización de referencia
//     (40 UYU = 1 USD, fija para el reporte).
//   • Compras: entradas con costo → precio REAL pagado en cada compra, en su
//     moneda original, convertido a USD. Así se ve que un mismo insumo se
//     compró a precios distintos en fechas distintas.
//   • Consumos (salidas, incluidas las órdenes internas): se valorizan al
//     costo promedio MÓVIL vigente en la fecha de cada salida, recalculado
//     recorriendo todo el historial (también el anterior al período). Si un
//     insumo no tiene compras con costo antes de la salida, se usa su costo
//     promedio actual.
//   • Ingresos sin costo (devoluciones, etc.) no cuentan como compras y no
//     alteran el costo promedio.
//   • Ajustes y transferencias no son compras ni consumos.
// Función pura: recibe los datos ya cargados y devuelve el reporte.
// =====================================================

import { TC_REFERENCIA_UYU_POR_USD } from '@/lib/currency';

export const TASA_REPORTE_UYU_POR_USD = TC_REFERENCIA_UYU_POR_USD;

export interface ProductoReporte {
  codigo: string;
  descripcion: string;
  categoria: string;
  moneda?: string | null;
  costoPromedio: number;
  stock: number;
}

export interface MovimientoReporte {
  codigo: string;
  tipo: string;
  cantidad: number;
  costoCompra?: number | null;
  monedaCosto?: string | null;
  notas?: string | null;
  usuario?: string | null;
  fecha: Date;
}

export interface SolicitudItemReporte {
  descripcion: string;
  cantidad: number;
  cantidadRecibida?: number | null;
  costoEstimado?: number | null;
  moneda?: string | null;
}

export interface SolicitudReporte {
  numero: string;
  categoria: string;
  estado: string;
  solicitadoPor: string;
  fecha: Date;
  items: SolicitudItemReporte[];
}

export interface ReporteInput {
  desde: Date;
  hasta: Date;
  productos: ProductoReporte[];
  /** Historial completo de movimientos de los insumos (hasta `hasta` o más). */
  movimientos: MovimientoReporte[];
  solicitudes: SolicitudReporte[];
  /** Valor del inventario actual de insumos en USD (opcional, snapshot). */
  inventarioActualUsd?: number | null;
  /** Etiquetas de categoría (clave → nombre visible). */
  categoriaLabels?: Record<string, string>;
  tasaUyuPorUsd?: number;
  /** "Todo el historial": el período empieza en el primer registro real. */
  recortarInicio?: boolean;
}

export interface LineaCompra {
  fecha: Date;
  codigo: string;
  descripcion: string;
  categoria: string;
  cantidad: number;
  costoUnitOriginal: number;
  monedaOriginal: 'USD' | 'UYU';
  costoUnitUsd: number;
  totalUsd: number;
  usuario: string;
  notas: string;
}

export interface LineaConsumo {
  fecha: Date;
  codigo: string;
  descripcion: string;
  categoria: string;
  cantidad: number;
  costoUnitUsd: number;
  totalUsd: number;
  usuario: string;
  notas: string;
  ordenInterna: boolean;
  /** true si no había compras previas con costo y se usó el promedio actual. */
  costoEstimado: boolean;
}

export interface ResumenProducto {
  codigo: string;
  descripcion: string;
  categoria: string;
  unidadesCompradas: number;
  comprasUsd: number;
  costoPromCompraUsd: number;
  unidadesConsumidas: number;
  consumoUsd: number;
  totalUsd: number;
}

export interface VariacionPrecio {
  codigo: string;
  descripcion: string;
  categoria: string;
  compras: number;
  precioInicialUsd: number;
  fechaInicial: Date;
  precioFinalUsd: number;
  fechaFinal: Date;
  minUsd: number;
  maxUsd: number;
  variacionPct: number;
}

export interface FilaMensual {
  clave: string; // YYYY-MM
  etiqueta: string; // "Ene 2026"
  comprasUsd: number;
  consumoUsd: number;
}

export interface FilaCategoria {
  categoria: string;
  comprasUsd: number;
  consumoUsd: number;
  participacion: number; // % de compras + consumo sobre el total
}

export interface FilaSolicitudes {
  clave: string;
  etiqueta: string;
  cantidad: number;
  estimadoUsd: number;
}

export interface ReporteInsumosUSD {
  desde: Date;
  hasta: Date;
  tasa: number;
  kpis: {
    comprasUsd: number;
    consumoUsd: number;
    netoUsd: number;
    cantidadCompras: number;
    cantidadConsumos: number;
    unidadesCompradas: number;
    unidadesConsumidas: number;
    ordenesInternas: number;
    otrosIngresosUnidades: number;
    otrosIngresosUsd: number;
    ajustes: number;
    insumosConMovimiento: number;
    insumosConAumento: number;
    insumosConBaja: number;
    solicitudes: number;
    solicitudesRecibidas: number;
    solicitudesAbiertas: number;
    estimadoSolicitudesUsd: number;
    inventarioActualUsd: number | null;
  };
  mensual: FilaMensual[];
  porCategoria: FilaCategoria[];
  porProducto: ResumenProducto[];
  variacionPrecios: VariacionPrecio[];
  solicitudesPorEstado: FilaSolicitudes[];
  solicitudesPorCategoria: FilaSolicitudes[];
  compras: LineaCompra[];
  consumos: LineaConsumo[];
  advertencias: string[];
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const ESTADOS_SOLICITUD: Record<string, string> = {
  pendiente: 'Pendiente',
  en_gestion: 'Aprobada / en gestión',
  comprada: 'Comprada',
  recibida: 'Recibida',
  cerrada: 'Cerrada',
  cancelada: 'Cancelada',
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function aUsd(valor: number, moneda: string | null | undefined, tasa = TASA_REPORTE_UYU_POR_USD): number {
  const v = Number(valor) || 0;
  if (moneda === 'USD') return v;
  const t = tasa > 0 ? tasa : TASA_REPORTE_UYU_POR_USD;
  return v / t;
}

function monedaDe(m: string | null | undefined, fallback: string | null | undefined): 'USD' | 'UYU' {
  const x = m || fallback;
  return x === 'USD' ? 'USD' : 'UYU';
}

function claveMes(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Lista de meses (YYYY-MM) entre dos fechas, ambas incluidas. */
function mesesEntre(desde: Date, hasta: Date): string[] {
  const out: string[] = [];
  const d = new Date(desde.getFullYear(), desde.getMonth(), 1);
  const fin = new Date(hasta.getFullYear(), hasta.getMonth(), 1);
  let guard = 0;
  while (d <= fin && guard < 600) {
    out.push(claveMes(d));
    d.setMonth(d.getMonth() + 1);
    guard++;
  }
  return out;
}

export function etiquetaMes(clave: string) {
  const [y, m] = clave.split('-').map(Number);
  return `${MESES[(m || 1) - 1]} ${y}`;
}

export function esOrdenInterna(notas: string | null | undefined) {
  return (notas || '').trim().toLowerCase().startsWith('orden interna');
}

export function generarReporteInsumosUSD(entrada: ReporteInput): ReporteInsumosUSD {
  let input = entrada;
  if (entrada.recortarInicio) {
    const codigos = new Set(entrada.productos.map(p => p.codigo));
    const fechas = [
      ...entrada.movimientos.filter(m => codigos.has(m.codigo)).map(m => m.fecha.getTime()),
      ...entrada.solicitudes.map(s => s.fecha.getTime()),
    ].filter(t => t >= entrada.desde.getTime() && t <= entrada.hasta.getTime());
    if (fechas.length > 0) {
      const primero = new Date(Math.min(...fechas));
      input = { ...entrada, desde: new Date(primero.getFullYear(), primero.getMonth(), primero.getDate()) };
    }
  }
  const tasa = input.tasaUyuPorUsd && input.tasaUyuPorUsd > 0 ? input.tasaUyuPorUsd : TASA_REPORTE_UYU_POR_USD;
  const desdeMs = input.desde.getTime();
  const hastaMs = input.hasta.getTime();
  const enPeriodo = (d: Date) => d.getTime() >= desdeMs && d.getTime() <= hastaMs;
  const labelCat = (c: string) => input.categoriaLabels?.[c] || c || 'Sin categoría';

  const productos = new Map(input.productos.map(p => [p.codigo, p]));
  const advertencias: string[] = [];

  // ---- Recorrido cronológico por insumo (costo promedio móvil en USD)
  const porCodigo = new Map<string, MovimientoReporte[]>();
  for (const m of input.movimientos) {
    if (!productos.has(m.codigo)) continue;
    if (m.fecha.getTime() > hastaMs) continue;
    const arr = porCodigo.get(m.codigo) || [];
    arr.push(m);
    porCodigo.set(m.codigo, arr);
  }

  const compras: LineaCompra[] = [];
  const consumos: LineaConsumo[] = [];
  // precios de compra (USD) por insumo: todos, para la variación
  const preciosPorCodigo = new Map<string, Array<{ fecha: Date; usd: number }>>();
  let otrosIngresosUnidades = 0;
  let otrosIngresosUsd = 0;
  let ajustes = 0;
  let consumosSinCostoPrevio = 0;

  for (const [codigo, movs] of Array.from(porCodigo)) {
    const prod = productos.get(codigo)!;
    const promedioActualUsd = aUsd(prod.costoPromedio || 0, monedaDe(prod.moneda, 'UYU'), tasa);
    movs.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    let stock = 0;
    let promUsd = 0;

    for (const m of movs) {
      const cant = Math.abs(Number(m.cantidad) || 0);
      if (cant <= 0) continue;
      const dentro = enPeriodo(m.fecha);

      if (m.tipo === 'entrada') {
        const costo = Number(m.costoCompra) || 0;
        if (costo > 0) {
          const moneda = monedaDe(m.monedaCosto, prod.moneda);
          const unitUsd = aUsd(costo, moneda, tasa);
          const base = Math.max(0, stock);
          promUsd = (base * promUsd + cant * unitUsd) / (base + cant);
          stock = base + cant;
          const precios = preciosPorCodigo.get(codigo) || [];
          precios.push({ fecha: m.fecha, usd: unitUsd });
          preciosPorCodigo.set(codigo, precios);
          if (dentro) {
            compras.push({
              fecha: m.fecha,
              codigo,
              descripcion: prod.descripcion,
              categoria: labelCat(prod.categoria),
              cantidad: cant,
              costoUnitOriginal: costo,
              monedaOriginal: moneda,
              costoUnitUsd: unitUsd,
              totalUsd: unitUsd * cant,
              usuario: m.usuario || '',
              notas: m.notas || '',
            });
          }
        } else {
          stock += cant;
          if (dentro) {
            otrosIngresosUnidades += cant;
            otrosIngresosUsd += cant * (promUsd > 0 ? promUsd : promedioActualUsd);
          }
        }
      } else if (m.tipo === 'salida') {
        const sinPrevio = promUsd <= 0;
        const unitUsd = sinPrevio ? promedioActualUsd : promUsd;
        stock -= cant;
        if (dentro) {
          if (sinPrevio) consumosSinCostoPrevio++;
          consumos.push({
            fecha: m.fecha,
            codigo,
            descripcion: prod.descripcion,
            categoria: labelCat(prod.categoria),
            cantidad: cant,
            costoUnitUsd: unitUsd,
            totalUsd: unitUsd * cant,
            usuario: m.usuario || '',
            notas: m.notas || '',
            ordenInterna: esOrdenInterna(m.notas),
            costoEstimado: sinPrevio,
          });
        }
      } else if (m.tipo === 'ajuste') {
        if (dentro) ajustes++;
      }
    }
  }

  compras.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  consumos.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

  // ---- Mensual
  const mensualMap = new Map<string, FilaMensual>();
  for (const k of mesesEntre(input.desde, input.hasta)) {
    mensualMap.set(k, { clave: k, etiqueta: etiquetaMes(k), comprasUsd: 0, consumoUsd: 0 });
  }
  for (const c of compras) {
    const f = mensualMap.get(claveMes(c.fecha));
    if (f) f.comprasUsd += c.totalUsd;
  }
  for (const c of consumos) {
    const f = mensualMap.get(claveMes(c.fecha));
    if (f) f.consumoUsd += c.totalUsd;
  }
  let mensual = Array.from(mensualMap.values());
  // Período muy largo ("todo el historial"): recortamos meses vacíos del inicio.
  const primerConDatos = mensual.findIndex(f => f.comprasUsd > 0 || f.consumoUsd > 0);
  if (primerConDatos > 0) mensual = mensual.slice(primerConDatos);
  mensual = mensual.map(f => ({ ...f, comprasUsd: r2(f.comprasUsd), consumoUsd: r2(f.consumoUsd) }));

  // ---- Por producto
  const prodMap = new Map<string, ResumenProducto>();
  const filaProd = (codigo: string, descripcion: string, categoria: string) => {
    let f = prodMap.get(codigo);
    if (!f) {
      f = { codigo, descripcion, categoria, unidadesCompradas: 0, comprasUsd: 0, costoPromCompraUsd: 0, unidadesConsumidas: 0, consumoUsd: 0, totalUsd: 0 };
      prodMap.set(codigo, f);
    }
    return f;
  };
  for (const c of compras) {
    const f = filaProd(c.codigo, c.descripcion, c.categoria);
    f.unidadesCompradas += c.cantidad;
    f.comprasUsd += c.totalUsd;
  }
  for (const c of consumos) {
    const f = filaProd(c.codigo, c.descripcion, c.categoria);
    f.unidadesConsumidas += c.cantidad;
    f.consumoUsd += c.totalUsd;
  }
  const porProducto = Array.from(prodMap.values()).map(f => ({
    ...f,
    costoPromCompraUsd: f.unidadesCompradas > 0 ? r2(f.comprasUsd / f.unidadesCompradas) : 0,
    comprasUsd: r2(f.comprasUsd),
    consumoUsd: r2(f.consumoUsd),
    totalUsd: r2(f.comprasUsd + f.consumoUsd),
  })).sort((a, b) => b.comprasUsd - a.comprasUsd || b.consumoUsd - a.consumoUsd);

  // ---- Por categoría
  const catMap = new Map<string, FilaCategoria>();
  for (const p of porProducto) {
    const f = catMap.get(p.categoria) || { categoria: p.categoria, comprasUsd: 0, consumoUsd: 0, participacion: 0 };
    f.comprasUsd += p.comprasUsd;
    f.consumoUsd += p.consumoUsd;
    catMap.set(p.categoria, f);
  }
  const totalCat = Array.from(catMap.values()).reduce((s, f) => s + f.comprasUsd + f.consumoUsd, 0);
  const porCategoria = Array.from(catMap.values()).map(f => ({
    ...f,
    comprasUsd: r2(f.comprasUsd),
    consumoUsd: r2(f.consumoUsd),
    participacion: totalCat > 0 ? r2(((f.comprasUsd + f.consumoUsd) / totalCat) * 100) : 0,
  })).sort((a, b) => (b.comprasUsd + b.consumoUsd) - (a.comprasUsd + a.consumoUsd));

  // ---- Variación de precios: precio de referencia = última compra ANTES del
  // período (si existe) o la primera dentro; precio final = última dentro.
  const variacionPrecios: VariacionPrecio[] = [];
  for (const [codigo, precios] of Array.from(preciosPorCodigo)) {
    const dentro = precios.filter(p => enPeriodo(p.fecha));
    if (dentro.length === 0) continue;
    const antes = precios.filter(p => p.fecha.getTime() < desdeMs);
    const ref = antes.length > 0 ? antes[antes.length - 1] : dentro[0];
    const fin = dentro[dentro.length - 1];
    const puntos = antes.length > 0 ? [ref, ...dentro] : dentro;
    if (puntos.length < 2) continue;
    const prod = productos.get(codigo)!;
    const usds = puntos.map(p => p.usd);
    variacionPrecios.push({
      codigo,
      descripcion: prod.descripcion,
      categoria: labelCat(prod.categoria),
      compras: dentro.length,
      precioInicialUsd: r2(ref.usd),
      fechaInicial: ref.fecha,
      precioFinalUsd: r2(fin.usd),
      fechaFinal: fin.fecha,
      minUsd: r2(Math.min(...usds)),
      maxUsd: r2(Math.max(...usds)),
      variacionPct: ref.usd > 0 ? r2(((fin.usd - ref.usd) / ref.usd) * 100) : 0,
    });
  }
  variacionPrecios.sort((a, b) => Math.abs(b.variacionPct) - Math.abs(a.variacionPct));

  // ---- Solicitudes
  const solsPeriodo = input.solicitudes.filter(s => enPeriodo(s.fecha));
  const estMap = new Map<string, FilaSolicitudes>();
  const catSolMap = new Map<string, FilaSolicitudes>();
  let estimadoSolicitudesUsd = 0;
  let solicitudesRecibidas = 0;
  let solicitudesAbiertas = 0;
  for (const s of solsPeriodo) {
    const estimado = s.items.reduce(
      (acc, it) => acc + (Number(it.costoEstimado) > 0 ? aUsd(Number(it.costoEstimado) * (Number(it.cantidad) || 0), monedaDe(it.moneda, 'UYU'), tasa) : 0),
      0,
    );
    if (s.estado !== 'cancelada') estimadoSolicitudesUsd += estimado;
    if (s.estado === 'recibida' || s.estado === 'cerrada') solicitudesRecibidas++;
    if (['pendiente', 'en_gestion', 'comprada'].includes(s.estado)) solicitudesAbiertas++;
    const e = estMap.get(s.estado) || { clave: s.estado, etiqueta: ESTADOS_SOLICITUD[s.estado] || s.estado, cantidad: 0, estimadoUsd: 0 };
    e.cantidad++;
    e.estimadoUsd += estimado;
    estMap.set(s.estado, e);
    const c = catSolMap.get(s.categoria) || { clave: s.categoria, etiqueta: labelCat(s.categoria), cantidad: 0, estimadoUsd: 0 };
    c.cantidad++;
    if (s.estado !== 'cancelada') c.estimadoUsd += estimado;
    catSolMap.set(s.categoria, c);
  }
  const ordenEstados = Object.keys(ESTADOS_SOLICITUD);
  const solicitudesPorEstado = Array.from(estMap.values())
    .map(f => ({ ...f, estimadoUsd: r2(f.estimadoUsd) }))
    .sort((a, b) => ordenEstados.indexOf(a.clave) - ordenEstados.indexOf(b.clave));
  const solicitudesPorCategoria = Array.from(catSolMap.values())
    .map(f => ({ ...f, estimadoUsd: r2(f.estimadoUsd) }))
    .sort((a, b) => b.cantidad - a.cantidad);

  // ---- KPIs
  const comprasUsd = r2(compras.reduce((s, c) => s + c.totalUsd, 0));
  const consumoUsd = r2(consumos.reduce((s, c) => s + c.totalUsd, 0));
  const insumosConMovimiento = new Set([...compras.map(c => c.codigo), ...consumos.map(c => c.codigo)]).size;

  if (consumosSinCostoPrevio > 0) {
    advertencias.push(
      `${consumosSinCostoPrevio} consumo(s) de insumos sin compras previas con costo se valorizaron al costo promedio actual.`,
    );
  }
  const comprasSinMoneda = input.movimientos.filter(m =>
    m.tipo === 'entrada' && (Number(m.costoCompra) || 0) > 0 && !m.monedaCosto && enPeriodo(m.fecha) && productos.has(m.codigo),
  ).length;
  if (comprasSinMoneda > 0) {
    advertencias.push(
      `${comprasSinMoneda} compra(s) antiguas no tenían moneda registrada: se tomó la moneda del insumo.`,
    );
  }

  return {
    desde: input.desde,
    hasta: input.hasta,
    tasa,
    kpis: {
      comprasUsd,
      consumoUsd,
      netoUsd: r2(comprasUsd - consumoUsd),
      cantidadCompras: compras.length,
      cantidadConsumos: consumos.length,
      unidadesCompradas: compras.reduce((s, c) => s + c.cantidad, 0),
      unidadesConsumidas: consumos.reduce((s, c) => s + c.cantidad, 0),
      ordenesInternas: consumos.filter(c => c.ordenInterna).length,
      otrosIngresosUnidades,
      otrosIngresosUsd: r2(otrosIngresosUsd),
      ajustes,
      insumosConMovimiento,
      insumosConAumento: variacionPrecios.filter(v => v.variacionPct > 0.5).length,
      insumosConBaja: variacionPrecios.filter(v => v.variacionPct < -0.5).length,
      solicitudes: solsPeriodo.length,
      solicitudesRecibidas,
      solicitudesAbiertas,
      estimadoSolicitudesUsd: r2(estimadoSolicitudesUsd),
      inventarioActualUsd: input.inventarioActualUsd ?? null,
    },
    mensual,
    porCategoria,
    porProducto,
    variacionPrecios,
    solicitudesPorEstado,
    solicitudesPorCategoria,
    compras: compras.map(c => ({ ...c, costoUnitUsd: r2(c.costoUnitUsd), totalUsd: r2(c.totalUsd) })),
    consumos: consumos.map(c => ({ ...c, costoUnitUsd: r2(c.costoUnitUsd), totalUsd: r2(c.totalUsd) })),
    advertencias,
  };
}

/** Agrupa la serie mensual si el período es muy largo (trimestres / años). */
export function agruparSerie(mensual: FilaMensual[]): FilaMensual[] {
  if (mensual.length <= 24) return mensual;
  const porTrimestre = mensual.length <= 72;
  const map = new Map<string, FilaMensual>();
  for (const f of mensual) {
    const [y, m] = f.clave.split('-').map(Number);
    const clave = porTrimestre ? `${y}-T${Math.floor((m - 1) / 3) + 1}` : `${y}`;
    const etiqueta = porTrimestre ? `T${Math.floor((m - 1) / 3) + 1} ${y}` : `${y}`;
    const g = map.get(clave) || { clave, etiqueta, comprasUsd: 0, consumoUsd: 0 };
    g.comprasUsd += f.comprasUsd;
    g.consumoUsd += f.consumoUsd;
    map.set(clave, g);
  }
  return Array.from(map.values());
}

/** Formato USD para el reporte: "US$ 1.234,56". */
export function fmtUsd(n: number, decimales = 2): string {
  const v = Number.isFinite(n) ? n : 0;
  const s = new Intl.NumberFormat('es-UY', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(Math.abs(v));
  return `${v < 0 ? '-' : ''}US$ ${s}`;
}

export function fmtNum(n: number, decimales = 0): string {
  return new Intl.NumberFormat('es-UY', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(Number.isFinite(n) ? n : 0);
}

export function fmtFecha(d: Date): string {
  return d.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
