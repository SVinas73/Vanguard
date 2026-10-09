// =====================================================
// Insumos en USD — motor único del Análisis y del Reporte
// =====================================================
// Los insumos solo se COMPRAN y se USAN (no se venden). Reglas:
//   • Todo se expresa en USD. Un costo cargado en USD se toma tal cual; uno
//     cargado en pesos uruguayos se divide por la cotización de referencia
//     (40 UYU = 1 USD).
//   • Compras: cada entrada es una compra. Si tiene costo, se toma el precio
//     REAL pagado en esa compra (en su moneda original, convertido a USD):
//     un mismo insumo comprado hoy a un precio y mañana a otro cuenta cada
//     compra a su propio precio. Si no tiene costo cargado, se valoriza al
//     costo promedio vigente y se marca como estimada.
//   • No son compras: la carga de stock inicial (alta del producto o
//     importación CSV) ni las devoluciones/reingresos.
//   • Consumos (salidas, incluidas las órdenes internas): al costo promedio
//     MÓVIL vigente en la fecha de cada salida, recalculado recorriendo TODO
//     el historial (también el anterior al período).
//   • Ajustes y transferencias no son compras ni consumos.
// Función pura: recibe los datos ya cargados y devuelve el resultado.
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
  stockMinimo?: number;
  /** false si el insumo fue dado de baja (su historial igual cuenta). */
  activo?: boolean;
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
  /** Historial completo de movimientos de los insumos. */
  movimientos: MovimientoReporte[];
  solicitudes: SolicitudReporte[];
  /** Valor actual (USD) por insumo: FIFO por lote + costo promedio. */
  inventarioPorCodigoUsd?: Record<string, number>;
  /** Valor del inventario actual en USD (si no se pasa el detalle por insumo). */
  inventarioActualUsd?: number | null;
  /** Etiquetas de categoría (clave → nombre visible), p. ej. del routing. */
  categoriaLabels?: Record<string, string>;
  /** Claves de categoría (ver `clavesCategoria`) a incluir. Vacío = todas. */
  categorias?: string[];
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
  /** Costo cargado en la compra (0 si no se cargó). */
  costoUnitOriginal: number;
  monedaOriginal: 'USD' | 'UYU';
  costoUnitUsd: number;
  totalUsd: number;
  /** true si la compra no tenía costo cargado y se usó el costo promedio. */
  costoEstimado: boolean;
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

export type Granularidad = 'dia' | 'semana' | 'mes' | 'trimestre' | 'anio';

export interface FilaSerie {
  clave: string;
  etiqueta: string;
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

export interface EstadoStockInsumo {
  codigo: string;
  descripcion: string;
  categoria: string;
  stock: number;
  stockMinimo: number;
  /** Unidades consumidas por día en el período. */
  consumoDiario: number;
  /** Días hasta agotarse al ritmo de consumo del período (null sin consumo). */
  diasCobertura: number | null;
  ultimoPrecioUsd: number | null;
  fechaUltimaCompra: Date | null;
  costoPromedioUsd: number;
  valorUsd: number;
}

export interface CategoriaDisponible {
  clave: string;
  etiqueta: string;
  insumos: number;
}

export interface ReporteInsumosUSD {
  desde: Date;
  hasta: Date;
  tasa: number;
  dias: number;
  /** Etiquetas de las categorías filtradas (vacío = todas). */
  categoriasFiltradas: string[];
  kpis: {
    comprasUsd: number;
    consumoUsd: number;
    netoUsd: number;
    consumoDiarioUsd: number;
    cantidadCompras: number;
    comprasSinCosto: number;
    cantidadConsumos: number;
    unidadesCompradas: number;
    unidadesConsumidas: number;
    ordenesInternas: number;
    stockInicialUnidades: number;
    stockInicialUsd: number;
    devolucionesUnidades: number;
    ajustes: number;
    insumosConMovimiento: number;
    insumosConAumento: number;
    insumosConBaja: number;
    insumosActivos: number;
    insumosBajoMinimo: number;
    insumosAgotados: number;
    solicitudes: number;
    solicitudesRecibidas: number;
    solicitudesAbiertas: number;
    estimadoSolicitudesUsd: number;
    inventarioActualUsd: number | null;
  };
  granularidad: Granularidad;
  serie: FilaSerie[];
  mensual: FilaMensual[];
  porCategoria: FilaCategoria[];
  porProducto: ResumenProducto[];
  variacionPrecios: VariacionPrecio[];
  stock: EstadoStockInsumo[];
  solicitudesPorEstado: FilaSolicitudes[];
  solicitudesPorCategoria: FilaSolicitudes[];
  compras: LineaCompra[];
  consumos: LineaConsumo[];
  categoriasDisponibles: CategoriaDisponible[];
  advertencias: string[];
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DIA_MS = 86_400_000;

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

// ---------------------------------------------------
// Categorías: "Estación de Servicio", "estacion_servicio" y
// "Estación de servicio" son la misma categoría.
// ---------------------------------------------------
const PALABRAS_VACIAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y']);

export function normalizarCategoria(s: string | null | undefined): string {
  const base = (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(w => w && !PALABRAS_VACIAS.has(w))
    .join(' ');
  return base || 'sin categoria';
}

function etiquetaBonita(s: string): string {
  const t = (s || '').replace(/_/g, ' ').trim();
  if (!t) return 'Sin categoría';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Construye el resolvedor clave/etiqueta de categorías. */
export function crearResolverCategorias(
  labels: Record<string, string> = {},
  textos: string[] = [],
) {
  const alias = new Map<string, string>();
  const etiquetas = new Map<string, string>();
  for (const [k, l] of Object.entries(labels)) {
    const ck = normalizarCategoria(k);
    alias.set(ck, ck);
    if (l) {
      alias.set(normalizarCategoria(l), ck);
      etiquetas.set(ck, l);
    }
  }
  const clave = (c: string | null | undefined) => {
    const n = normalizarCategoria(c);
    return alias.get(n) ?? n;
  };
  // Etiqueta por defecto: el primer texto "lindo" visto (con tildes) para esa clave.
  for (const t of textos) {
    const k = clave(t);
    if (!etiquetas.has(k) && t && /[A-ZÁÉÍÓÚÑ]/.test(t)) etiquetas.set(k, t.trim());
  }
  const etiqueta = (c: string | null | undefined) => {
    const k = clave(c);
    return etiquetas.get(k) ?? etiquetaBonita(c || '');
  };
  return { clave, etiqueta };
}

function claveMes(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

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

/** Entrada que NO es una compra: carga de stock inicial. */
export function esStockInicial(notas: string | null | undefined) {
  return /^(stock inicial|alta del producto|importaci[oó]n csv)/i.test((notas || '').trim());
}

/** Entrada que NO es una compra: devolución / reingreso. */
export function esDevolucion(notas: string | null | undefined) {
  return /^(reingreso|devoluci[oó]n)/i.test((notas || '').trim());
}

/** "... stock 12 → 30 ..." → 30 (ajustes registrados con el cambio de stock). */
function stockFinalDeAjuste(notas: string | null | undefined): number | null {
  const m = /stock\s+(-?\d+(?:[.,]\d+)?)\s*(?:→|->)\s*(-?\d+(?:[.,]\d+)?)/i.exec(notas || '');
  if (!m) return null;
  const v = Number(m[2].replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}

function inicioDia(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Lunes de la semana de la fecha. */
function inicioSemana(d: Date) {
  const x = inicioDia(d);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return x;
}

function granularidadPara(dias: number): Granularidad {
  if (dias <= 31) return 'dia';
  if (dias <= 120) return 'semana';
  if (dias <= 24 * 31) return 'mes';
  if (dias <= 72 * 31) return 'trimestre';
  return 'anio';
}

function claveSerie(d: Date, g: Granularidad): { clave: string; etiqueta: string } {
  const dd = (n: number) => String(n).padStart(2, '0');
  switch (g) {
    case 'dia': return { clave: `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`, etiqueta: `${dd(d.getDate())}/${dd(d.getMonth() + 1)}` };
    case 'semana': {
      const s = inicioSemana(d);
      return { clave: `${s.getFullYear()}-${dd(s.getMonth() + 1)}-${dd(s.getDate())}`, etiqueta: `Sem ${dd(s.getDate())}/${dd(s.getMonth() + 1)}` };
    }
    case 'mes': return { clave: claveMes(d), etiqueta: etiquetaMes(claveMes(d)) };
    case 'trimestre': {
      const q = Math.floor(d.getMonth() / 3) + 1;
      return { clave: `${d.getFullYear()}-T${q}`, etiqueta: `T${q} ${d.getFullYear()}` };
    }
    case 'anio': return { clave: `${d.getFullYear()}`, etiqueta: `${d.getFullYear()}` };
  }
}

function clavesDelPeriodo(desde: Date, hasta: Date, g: Granularidad) {
  const out: Array<{ clave: string; etiqueta: string }> = [];
  const vistos = new Set<string>();
  const d = g === 'semana' ? inicioSemana(desde) : inicioDia(desde);
  let guard = 0;
  while (d <= hasta && guard < 4000) {
    const k = claveSerie(d, g);
    if (!vistos.has(k.clave)) { vistos.add(k.clave); out.push(k); }
    if (g === 'dia') d.setDate(d.getDate() + 1);
    else if (g === 'semana') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    guard++;
  }
  return out;
}

export function generarReporteInsumosUSD(entrada: ReporteInput): ReporteInsumosUSD {
  const tasa = entrada.tasaUyuPorUsd && entrada.tasaUyuPorUsd > 0 ? entrada.tasaUyuPorUsd : TASA_REPORTE_UYU_POR_USD;
  const resolver = crearResolverCategorias(entrada.categoriaLabels, [
    ...entrada.productos.map(p => p.categoria),
    ...entrada.solicitudes.map(s => s.categoria),
  ]);

  // ---- Categorías disponibles (sobre todos los insumos, sin filtrar)
  const disp = new Map<string, CategoriaDisponible>();
  for (const p of entrada.productos) {
    if (p.activo === false) continue;
    const k = resolver.clave(p.categoria);
    const f = disp.get(k) || { clave: k, etiqueta: resolver.etiqueta(p.categoria), insumos: 0 };
    f.insumos++;
    disp.set(k, f);
  }
  for (const s of entrada.solicitudes) {
    const k = resolver.clave(s.categoria);
    if (!disp.has(k)) disp.set(k, { clave: k, etiqueta: resolver.etiqueta(s.categoria), insumos: 0 });
  }
  const categoriasDisponibles = Array.from(disp.values())
    .sort((a, b) => b.insumos - a.insumos || a.etiqueta.localeCompare(b.etiqueta));

  // ---- Filtro por categoría
  const filtro = new Set((entrada.categorias || []).filter(Boolean));
  const incluye = (cat: string) => filtro.size === 0 || filtro.has(resolver.clave(cat));
  const productosLista = entrada.productos.filter(p => incluye(p.categoria));
  const productos = new Map(productosLista.map(p => [p.codigo, p]));
  const solicitudesBase = entrada.solicitudes.filter(s => incluye(s.categoria));

  // ---- Período ("todo el historial" arranca en el primer registro)
  let desde = entrada.desde;
  const hasta = entrada.hasta;
  if (entrada.recortarInicio) {
    const fechas = [
      ...entrada.movimientos.filter(m => productos.has(m.codigo)).map(m => m.fecha.getTime()),
      ...solicitudesBase.map(s => s.fecha.getTime()),
    ].filter(t => t >= entrada.desde.getTime() && t <= hasta.getTime());
    if (fechas.length > 0) desde = inicioDia(new Date(Math.min(...fechas)));
  }
  const desdeMs = desde.getTime();
  const hastaMs = hasta.getTime();
  const dias = Math.max(1, Math.ceil((hastaMs - desdeMs + 1) / DIA_MS));
  const enPeriodo = (d: Date) => d.getTime() >= desdeMs && d.getTime() <= hastaMs;
  const labelCat = (c: string) => resolver.etiqueta(c);
  const advertencias: string[] = [];

  // ---- Recorrido cronológico por insumo (costo promedio móvil en USD)
  const porCodigo = new Map<string, MovimientoReporte[]>();
  for (const m of entrada.movimientos) {
    if (!productos.has(m.codigo)) continue;
    if (m.fecha.getTime() > hastaMs) continue;
    const arr = porCodigo.get(m.codigo) || [];
    arr.push(m);
    porCodigo.set(m.codigo, arr);
  }

  const compras: LineaCompra[] = [];
  const consumos: LineaConsumo[] = [];
  // precios de compra (USD) reales, por insumo y en orden: para la variación
  const preciosPorCodigo = new Map<string, Array<{ fecha: Date; usd: number }>>();
  let stockInicialUnidades = 0;
  let stockInicialUsd = 0;
  let devolucionesUnidades = 0;
  let ajustes = 0;
  let consumosSinCostoPrevio = 0;
  let comprasSinMoneda = 0;

  for (const [codigo, movs] of Array.from(porCodigo)) {
    const prod = productos.get(codigo)!;
    const monedaProd = monedaDe(prod.moneda, 'UYU');
    const promedioActualUsd = aUsd(prod.costoPromedio || 0, monedaProd, tasa);
    movs.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    let stock = 0;
    let promUsd = 0;

    for (const m of movs) {
      const cant = Math.abs(Number(m.cantidad) || 0);
      const dentro = enPeriodo(m.fecha);

      if (m.tipo === 'ajuste') {
        const final = stockFinalDeAjuste(m.notas);
        if (final != null) stock = final;
        if (dentro) ajustes++;
        continue;
      }
      if (cant <= 0) continue;

      if (m.tipo === 'entrada') {
        const costo = Number(m.costoCompra) || 0;
        const inicial = esStockInicial(m.notas);
        const devolucion = !inicial && esDevolucion(m.notas);
        const base = Math.max(0, stock);
        let unitUsd: number;
        let moneda: 'USD' | 'UYU' = monedaProd;

        if (costo > 0) {
          moneda = monedaDe(m.monedaCosto, prod.moneda);
          if (!m.monedaCosto && dentro && !inicial && !devolucion) comprasSinMoneda++;
          unitUsd = aUsd(costo, moneda, tasa);
          promUsd = (base * promUsd + cant * unitUsd) / (base + cant);
          if (!devolucion) {
            const precios = preciosPorCodigo.get(codigo) || [];
            precios.push({ fecha: m.fecha, usd: unitUsd });
            preciosPorCodigo.set(codigo, precios);
          }
        } else {
          // Sin costo: entra al promedio vigente (no lo diluye).
          unitUsd = promUsd > 0 ? promUsd : promedioActualUsd;
          if (promUsd <= 0 && unitUsd > 0) promUsd = unitUsd;
        }
        stock = base + cant;

        if (!dentro) continue;
        if (inicial) {
          stockInicialUnidades += cant;
          stockInicialUsd += unitUsd * cant;
        } else if (devolucion) {
          devolucionesUnidades += cant;
        } else {
          compras.push({
            fecha: m.fecha,
            codigo,
            descripcion: prod.descripcion,
            categoria: labelCat(prod.categoria),
            cantidad: cant,
            costoUnitOriginal: costo > 0 ? costo : 0,
            monedaOriginal: moneda,
            costoUnitUsd: unitUsd,
            totalUsd: unitUsd * cant,
            costoEstimado: costo <= 0,
            usuario: m.usuario || '',
            notas: m.notas || '',
          });
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
      }
    }
  }

  compras.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  consumos.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

  // ---- Serie temporal (granularidad según el largo del período)
  const granularidad = granularidadPara(dias);
  const serieMap = new Map<string, FilaSerie>();
  for (const k of clavesDelPeriodo(desde, hasta, granularidad)) {
    serieMap.set(k.clave, { ...k, comprasUsd: 0, consumoUsd: 0 });
  }
  for (const c of compras) {
    const f = serieMap.get(claveSerie(c.fecha, granularidad).clave);
    if (f) f.comprasUsd += c.totalUsd;
  }
  for (const c of consumos) {
    const f = serieMap.get(claveSerie(c.fecha, granularidad).clave);
    if (f) f.consumoUsd += c.totalUsd;
  }
  const serie = Array.from(serieMap.values()).map(f => ({ ...f, comprasUsd: r2(f.comprasUsd), consumoUsd: r2(f.consumoUsd) }));

  // ---- Mensual (para tablas)
  const mensualMap = new Map<string, FilaMensual>();
  for (const k of mesesEntre(desde, hasta)) {
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

  // ---- Variación de precios: referencia = última compra ANTES del período
  // (si existe) o la primera dentro; precio final = última dentro.
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

  // ---- Estado de stock actual (insumos activos)
  const consumoUdsPorCodigo = new Map<string, number>();
  for (const c of consumos) consumoUdsPorCodigo.set(c.codigo, (consumoUdsPorCodigo.get(c.codigo) || 0) + c.cantidad);
  const inventarioDetalle = entrada.inventarioPorCodigoUsd;
  const activos = productosLista.filter(p => p.activo !== false);
  const stockEstado: EstadoStockInsumo[] = activos.map(p => {
    const costoPromedioUsd = aUsd(p.costoPromedio || 0, monedaDe(p.moneda, 'UYU'), tasa);
    const precios = (preciosPorCodigo.get(p.codigo) || []).filter(x => x.fecha.getTime() <= hastaMs);
    const ultimo = precios.length > 0 ? precios[precios.length - 1] : null;
    const consumoDiario = (consumoUdsPorCodigo.get(p.codigo) || 0) / dias;
    const stock = Number(p.stock) || 0;
    return {
      codigo: p.codigo,
      descripcion: p.descripcion,
      categoria: labelCat(p.categoria),
      stock,
      stockMinimo: Number(p.stockMinimo) || 0,
      consumoDiario: r2(consumoDiario),
      diasCobertura: consumoDiario > 0 ? Math.max(0, Math.floor(stock / consumoDiario)) : null,
      ultimoPrecioUsd: ultimo ? r2(ultimo.usd) : null,
      fechaUltimaCompra: ultimo ? ultimo.fecha : null,
      costoPromedioUsd: r2(costoPromedioUsd),
      valorUsd: r2(inventarioDetalle?.[p.codigo] ?? Math.max(0, stock) * costoPromedioUsd),
    };
  });
  const inventarioActualUsd = inventarioDetalle
    ? r2(stockEstado.reduce((s, x) => s + x.valorUsd, 0))
    : (entrada.inventarioActualUsd ?? null);

  // ---- Solicitudes
  const solsPeriodo = solicitudesBase.filter(s => enPeriodo(s.fecha));
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
    const ck = resolver.clave(s.categoria);
    const c = catSolMap.get(ck) || { clave: ck, etiqueta: labelCat(s.categoria), cantidad: 0, estimadoUsd: 0 };
    c.cantidad++;
    if (s.estado !== 'cancelada') c.estimadoUsd += estimado;
    catSolMap.set(ck, c);
  }
  const ordenEstados = Object.keys(ESTADOS_SOLICITUD);
  const solicitudesPorEstado = Array.from(estMap.values())
    .map(f => ({ ...f, estimadoUsd: r2(f.estimadoUsd) }))
    .sort((a, b) => ordenEstados.indexOf(a.clave) - ordenEstados.indexOf(b.clave));
  const solicitudesPorCategoria = Array.from(catSolMap.values())
    .map(f => ({ ...f, estimadoUsd: r2(f.estimadoUsd) }))
    .sort((a, b) => b.cantidad - a.cantidad);

  // ---- KPIs y avisos
  const comprasUsd = r2(compras.reduce((s, c) => s + c.totalUsd, 0));
  const consumoUsd = r2(consumos.reduce((s, c) => s + c.totalUsd, 0));
  const comprasSinCosto = compras.filter(c => c.costoEstimado).length;
  const insumosConMovimiento = new Set([...compras.map(c => c.codigo), ...consumos.map(c => c.codigo)]).size;

  if (comprasSinCosto > 0) {
    advertencias.push(`${comprasSinCosto} compra(s) no tenían costo cargado: se valorizaron al costo promedio vigente.`);
  }
  if (consumosSinCostoPrevio > 0) {
    advertencias.push(`${consumosSinCostoPrevio} consumo(s) sin compras previas con costo se valorizaron al costo promedio actual del insumo.`);
  }
  if (comprasSinMoneda > 0) {
    advertencias.push(`${comprasSinMoneda} compra(s) antiguas no tenían moneda registrada: se tomó la moneda del insumo.`);
  }
  if (stockInicialUnidades > 0) {
    advertencias.push(`Se excluyó de las compras la carga de stock inicial (${stockInicialUnidades} uds., ${fmtUsd(stockInicialUsd)}).`);
  }

  return {
    desde,
    hasta,
    tasa,
    dias,
    categoriasFiltradas: categoriasDisponibles.filter(c => filtro.has(c.clave)).map(c => c.etiqueta),
    kpis: {
      comprasUsd,
      consumoUsd,
      netoUsd: r2(comprasUsd - consumoUsd),
      consumoDiarioUsd: r2(consumoUsd / dias),
      cantidadCompras: compras.length,
      comprasSinCosto,
      cantidadConsumos: consumos.length,
      unidadesCompradas: compras.reduce((s, c) => s + c.cantidad, 0),
      unidadesConsumidas: consumos.reduce((s, c) => s + c.cantidad, 0),
      ordenesInternas: consumos.filter(c => c.ordenInterna).length,
      stockInicialUnidades,
      stockInicialUsd: r2(stockInicialUsd),
      devolucionesUnidades,
      ajustes,
      insumosConMovimiento,
      insumosConAumento: variacionPrecios.filter(v => v.variacionPct > 0.5).length,
      insumosConBaja: variacionPrecios.filter(v => v.variacionPct < -0.5).length,
      insumosActivos: activos.length,
      insumosBajoMinimo: stockEstado.filter(s => s.stock > 0 && s.stockMinimo > 0 && s.stock <= s.stockMinimo).length,
      insumosAgotados: stockEstado.filter(s => s.stock <= 0).length,
      solicitudes: solsPeriodo.length,
      solicitudesRecibidas,
      solicitudesAbiertas,
      estimadoSolicitudesUsd: r2(estimadoSolicitudesUsd),
      inventarioActualUsd,
    },
    granularidad,
    serie,
    mensual,
    porCategoria,
    porProducto,
    variacionPrecios,
    stock: stockEstado,
    solicitudesPorEstado,
    solicitudesPorCategoria,
    compras: compras.map(c => ({ ...c, costoUnitUsd: r2(c.costoUnitUsd), totalUsd: r2(c.totalUsd) })),
    consumos: consumos.map(c => ({ ...c, costoUnitUsd: r2(c.costoUnitUsd), totalUsd: r2(c.totalUsd) })),
    categoriasDisponibles,
    advertencias,
  };
}

// ---------------------------------------------------
// Ficha de un insumo: historial de precios de compra (USD) y consumo
// ---------------------------------------------------
export interface CompraHistorica {
  fecha: Date;
  cantidad: number;
  costoOriginal: number;
  monedaOriginal: 'USD' | 'UYU';
  usd: number;
}

export interface FichaInsumo {
  codigo: string;
  descripcion: string;
  categoria: string;
  stock: number;
  stockMinimo: number;
  costoPromedioUsd: number;
  valorUsd: number;
  compras: CompraHistorica[];
  ultimoPrecioUsd: number | null;
  precioAnteriorUsd: number | null;
  minUsd: number | null;
  maxUsd: number | null;
  promedioCompraUsd: number | null;
  /** Unidades consumidas por mes, últimos 12 meses (incluye el actual). */
  consumoMensual: Array<{ clave: string; etiqueta: string; unidades: number }>;
  consumoDiario90: number;
  diasCobertura: number | null;
}

export function fichaInsumo(
  entrada: Pick<ReporteInput, 'productos' | 'movimientos' | 'inventarioPorCodigoUsd' | 'categoriaLabels' | 'tasaUyuPorUsd'>,
  codigo: string,
  hoy = new Date(),
): FichaInsumo | null {
  const prod = entrada.productos.find(p => p.codigo === codigo);
  if (!prod) return null;
  const tasa = entrada.tasaUyuPorUsd && entrada.tasaUyuPorUsd > 0 ? entrada.tasaUyuPorUsd : TASA_REPORTE_UYU_POR_USD;
  const resolver = crearResolverCategorias(entrada.categoriaLabels, entrada.productos.map(p => p.categoria));
  const movs = entrada.movimientos.filter(m => m.codigo === codigo).sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

  const compras: CompraHistorica[] = [];
  for (const m of movs) {
    const costo = Number(m.costoCompra) || 0;
    if (m.tipo !== 'entrada' || costo <= 0 || esDevolucion(m.notas)) continue;
    const moneda = monedaDe(m.monedaCosto, prod.moneda);
    compras.push({ fecha: m.fecha, cantidad: Math.abs(Number(m.cantidad) || 0), costoOriginal: costo, monedaOriginal: moneda, usd: r2(aUsd(costo, moneda, tasa)) });
  }

  const meses: Array<{ clave: string; etiqueta: string; unidades: number }> = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push({ clave: claveMes(d), etiqueta: etiquetaMes(claveMes(d)), unidades: 0 });
  }
  const porMes = new Map(meses.map(m => [m.clave, m]));
  const hace90 = hoy.getTime() - 90 * DIA_MS;
  let uds90 = 0;
  for (const m of movs) {
    if (m.tipo !== 'salida') continue;
    const cant = Math.abs(Number(m.cantidad) || 0);
    const f = porMes.get(claveMes(m.fecha));
    if (f) f.unidades += cant;
    if (m.fecha.getTime() >= hace90 && m.fecha.getTime() <= hoy.getTime()) uds90 += cant;
  }

  const usds = compras.map(c => c.usd);
  const totalUds = compras.reduce((s, c) => s + c.cantidad, 0);
  const costoPromedioUsd = r2(aUsd(prod.costoPromedio || 0, monedaDe(prod.moneda, 'UYU'), tasa));
  const stock = Number(prod.stock) || 0;
  const consumoDiario90 = uds90 / 90;
  return {
    codigo,
    descripcion: prod.descripcion,
    categoria: resolver.etiqueta(prod.categoria),
    stock,
    stockMinimo: Number(prod.stockMinimo) || 0,
    costoPromedioUsd,
    valorUsd: r2(entrada.inventarioPorCodigoUsd?.[codigo] ?? Math.max(0, stock) * costoPromedioUsd),
    compras,
    ultimoPrecioUsd: compras.length ? compras[compras.length - 1].usd : null,
    precioAnteriorUsd: compras.length > 1 ? compras[compras.length - 2].usd : null,
    minUsd: usds.length ? Math.min(...usds) : null,
    maxUsd: usds.length ? Math.max(...usds) : null,
    promedioCompraUsd: totalUds > 0 ? r2(compras.reduce((s, c) => s + c.usd * c.cantidad, 0) / totalUds) : null,
    consumoMensual: meses,
    consumoDiario90: r2(consumoDiario90),
    diasCobertura: consumoDiario90 > 0 ? Math.floor(Math.max(0, stock) / consumoDiario90) : null,
  };
}

export const ETIQUETA_GRANULARIDAD: Record<Granularidad, string> = {
  dia: 'día',
  semana: 'semana',
  mes: 'mes',
  trimestre: 'trimestre',
  anio: 'año',
};

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

/** Formato USD: "US$ 1.234,56". */
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
