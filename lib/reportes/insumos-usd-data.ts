// =====================================================
// Datos de insumos para el Análisis y el Reporte en USD
// =====================================================
// Una sola carga con TODO el historial (paginando: PostgREST corta en 1000
// filas por consulta), compartida por el panel de Análisis de insumos y por
// el Reporte, así los dos muestran exactamente los mismos números:
//   • insumos (productos de almacenes de insumos, incluidos los dados de baja),
//   • todos los movimientos de esos insumos (hace falta el historial completo
//     para el costo promedio móvil y la variación de precios),
//   • todas las solicitudes de insumos con sus ítems,
//   • valor actual de cada insumo en USD (FIFO por lote + costo promedio).
// =====================================================

import { supabase } from '@/lib/supabase';
import { getAlmacenesInsumoIds } from '@/lib/wms-insumos-filter';
import { buildRatesTable } from '@/lib/currency';
import { valuarInventario } from '@/lib/inventory-valuation';
import {
  generarReporteInsumosUSD,
  type MovimientoReporte,
  type ProductoReporte,
  type ReporteInsumosUSD,
  type SolicitudReporte,
} from '@/lib/reportes/insumos-usd';

const PAGINA = 1000;
const MAX_PAGINAS = 500;
const CODIGOS_POR_CONSULTA = 120;
/** Los datos se reutilizan durante este tiempo (entre panel y reporte). */
const VIGENCIA_CACHE_MS = 3 * 60 * 1000;

async function paginar<T>(build: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  for (let p = 0; p < MAX_PAGINAS; p++) {
    const from = p * PAGINA;
    const { data, error } = await build(from, from + PAGINA - 1);
    if (error) throw new Error(error.message || 'Error consultando la base de datos');
    const filas = (data || []) as T[];
    out.push(...filas);
    if (filas.length < PAGINA) break;
  }
  return out;
}

export interface ProgresoCarga {
  paso: string;
}

export interface DatosInsumos {
  productos: ProductoReporte[];
  movimientos: MovimientoReporte[];
  solicitudes: SolicitudReporte[];
  categoriaLabels: Record<string, string>;
  inventarioPorCodigoUsd: Record<string, number>;
  cargadoEn: Date;
}

export async function cargarDatosInsumos(onProgreso?: (p: ProgresoCarga) => void): Promise<DatosInsumos> {
  onProgreso?.({ paso: 'Buscando almacenes de insumos' });
  const almacenes = Array.from(await getAlmacenesInsumoIds());

  onProgreso?.({ paso: 'Cargando insumos' });
  const productosRaw = almacenes.length === 0 ? [] : await paginar<any>((from, to) =>
    supabase
      .from('productos')
      .select('codigo, descripcion, categoria, moneda, costo_promedio, stock, stock_minimo, almacen_id, deleted_at')
      .in('almacen_id', almacenes)
      .order('codigo')
      .range(from, to),
  );
  // Los insumos dados de baja se incluyen: su historial de compras y
  // consumos sigue contando. Solo quedan fuera del stock y del valor actual.
  const productos: ProductoReporte[] = productosRaw.map(p => ({
    codigo: p.codigo,
    descripcion: p.descripcion || p.codigo,
    categoria: p.categoria || 'Sin categoría',
    moneda: p.moneda,
    costoPromedio: Number(p.costo_promedio) || 0,
    stock: Number(p.stock) || 0,
    stockMinimo: Number(p.stock_minimo) || 0,
    activo: !p.deleted_at,
  }));

  onProgreso?.({ paso: 'Cargando historial de compras y consumos' });
  const codigos = productos.map(p => p.codigo);
  const movimientos: MovimientoReporte[] = [];
  for (let i = 0; i < codigos.length; i += CODIGOS_POR_CONSULTA) {
    const lote = codigos.slice(i, i + CODIGOS_POR_CONSULTA);
    const filas = await paginar<any>((from, to) =>
      supabase
        .from('movimientos')
        .select('id, codigo, tipo, cantidad, costo_compra, moneda_costo, notas, usuario_email, created_at')
        .in('codigo', lote)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    );
    for (const m of filas) {
      movimientos.push({
        codigo: m.codigo,
        tipo: m.tipo,
        cantidad: Number(m.cantidad) || 0,
        costoCompra: m.costo_compra != null ? Number(m.costo_compra) : null,
        monedaCosto: m.moneda_costo ?? null,
        notas: m.notas ?? null,
        usuario: m.usuario_email ?? null,
        fecha: new Date(m.created_at),
      });
    }
  }

  onProgreso?.({ paso: 'Cargando solicitudes de insumos' });
  let solicitudes: SolicitudReporte[] = [];
  try {
    const sols = await paginar<any>((from, to) =>
      supabase
        .from('solicitudes_insumos')
        .select('numero, categoria, estado, solicitado_por, fecha_solicitud, items:solicitudes_insumos_items(*)')
        .order('fecha_solicitud', { ascending: true })
        .range(from, to),
    );
    solicitudes = sols.map(s => ({
      numero: s.numero,
      categoria: s.categoria,
      estado: s.estado,
      solicitadoPor: s.solicitado_por,
      fecha: new Date(s.fecha_solicitud),
      items: (s.items || []).map((it: any) => ({
        descripcion: it.descripcion,
        cantidad: Number(it.cantidad) || 0,
        cantidadRecibida: it.cantidad_recibida != null ? Number(it.cantidad_recibida) : null,
        costoEstimado: it.costo_estimado != null ? Number(it.costo_estimado) : null,
        moneda: it.moneda ?? null,
      })),
    }));
  } catch (e) {
    console.warn('Insumos USD: no se pudieron cargar las solicitudes', e);
  }

  // Etiquetas de categorías de insumos (si están configuradas)
  const categoriaLabels: Record<string, string> = {};
  try {
    const { data } = await supabase.from('org_categorias_insumos_routing').select('categoria, categoria_label');
    for (const c of (data || []) as any[]) {
      if (c.categoria && c.categoria_label) categoriaLabels[c.categoria] = c.categoria_label;
    }
  } catch { /* opcional */ }

  onProgreso?.({ paso: 'Valorizando inventario actual' });
  const inventarioPorCodigoUsd: Record<string, number> = {};
  try {
    const val = await valuarInventario({
      productos: productos.filter(p => p.activo !== false).map(p => ({
        codigo: p.codigo,
        descripcion: p.descripcion,
        stock: p.stock,
        costoPromedio: p.costoPromedio,
        categoria: p.categoria,
        moneda: (p.moneda === 'USD' ? 'USD' : 'UYU'),
      })),
      // Tabla vacía → cotización de referencia 40, igual que el resto.
      rates: buildRatesTable([]),
      monedaBase: 'USD',
    });
    for (const v of val.porProducto) inventarioPorCodigoUsd[v.codigo] = Math.round(v.valor * 100) / 100;
  } catch (e) {
    console.warn('Insumos USD: no se pudo valorizar el inventario', e);
  }

  return { productos, movimientos, solicitudes, categoriaLabels, inventarioPorCodigoUsd, cargadoEn: new Date() };
}

// ---------------------------------------------------
// Caché compartida (panel ↔ reporte)
// ---------------------------------------------------
let cache: { promesa: Promise<DatosInsumos>; en: number; version?: number } | null = null;

export function invalidarDatosInsumos() {
  cache = null;
}

/**
 * `version`: algo que cambia cuando hay movimientos nuevos (p. ej. la cantidad
 * de movimientos del store). Si cambió, no se reutiliza la caché.
 */
export function obtenerDatosInsumos(opts: { forzar?: boolean; version?: number; onProgreso?: (p: ProgresoCarga) => void } = {}): Promise<DatosInsumos> {
  const vigente = cache
    && Date.now() - cache.en < VIGENCIA_CACHE_MS
    && (opts.version === undefined || cache.version === opts.version);
  if (!opts.forzar && vigente) return cache!.promesa;
  const promesa = cargarDatosInsumos(opts.onProgreso);
  cache = { promesa, en: Date.now(), version: opts.version };
  promesa.catch(() => { if (cache?.promesa === promesa) cache = null; });
  return promesa;
}

export interface FiltrosReporte {
  desde: Date;
  hasta: Date;
  /** Claves de categoría (vacío = todas). */
  categorias?: string[];
  todoElHistorial?: boolean;
}

export function reporteDesdeDatos(datos: DatosInsumos, f: FiltrosReporte): ReporteInsumosUSD {
  return generarReporteInsumosUSD({
    desde: f.desde,
    hasta: f.hasta,
    productos: datos.productos,
    movimientos: datos.movimientos,
    solicitudes: datos.solicitudes,
    inventarioPorCodigoUsd: datos.inventarioPorCodigoUsd,
    categoriaLabels: datos.categoriaLabels,
    categorias: f.categorias,
    recortarInicio: f.todoElHistorial,
  });
}
