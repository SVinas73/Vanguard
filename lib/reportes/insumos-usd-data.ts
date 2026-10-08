// =====================================================
// Carga de datos para el reporte de insumos en USD
// =====================================================
// Trae TODO el historial necesario, paginando (PostgREST corta en 1000
// filas por consulta):
//   • insumos (productos de almacenes de insumos),
//   • movimientos de esos insumos desde el inicio hasta la fecha "hasta"
//     (el historial previo hace falta para el costo promedio móvil),
//   • solicitudes de insumos del período con sus ítems,
//   • valor actual del inventario de insumos en USD.
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

export async function cargarReporteInsumosUSD(
  desde: Date,
  hasta: Date,
  onProgreso?: (p: ProgresoCarga) => void,
  opciones: { todoElHistorial?: boolean } = {},
): Promise<ReporteInsumosUSD> {
  onProgreso?.({ paso: 'Buscando almacenes de insumos' });
  const almacenes = Array.from(await getAlmacenesInsumoIds());

  onProgreso?.({ paso: 'Cargando insumos' });
  const productosRaw = almacenes.length === 0 ? [] : await paginar<any>((from, to) =>
    supabase
      .from('productos')
      .select('codigo, descripcion, categoria, moneda, costo_promedio, stock, almacen_id, deleted_at')
      .in('almacen_id', almacenes)
      .order('codigo')
      .range(from, to),
  );
  // Los insumos dados de baja se incluyen: su historial de compras y
  // consumos sigue contando para el período. Solo se excluyen del valor
  // del inventario actual.
  const activos = new Set(productosRaw.filter(p => !p.deleted_at).map(p => p.codigo));
  const productos: ProductoReporte[] = productosRaw.map(p => ({
    codigo: p.codigo,
    descripcion: p.descripcion || p.codigo,
    categoria: p.categoria || 'Sin categoría',
    moneda: p.moneda,
    costoPromedio: Number(p.costo_promedio) || 0,
    stock: Number(p.stock) || 0,
  }));

  onProgreso?.({ paso: 'Cargando historial de movimientos' });
  const codigos = productos.map(p => p.codigo);
  const hastaIso = hasta.toISOString();
  const movimientos: MovimientoReporte[] = [];
  for (let i = 0; i < codigos.length; i += CODIGOS_POR_CONSULTA) {
    const lote = codigos.slice(i, i + CODIGOS_POR_CONSULTA);
    const filas = await paginar<any>((from, to) =>
      supabase
        .from('movimientos')
        .select('id, codigo, tipo, cantidad, costo_compra, moneda_costo, notas, usuario_email, created_at')
        .in('codigo', lote)
        .lte('created_at', hastaIso)
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
        .gte('fecha_solicitud', desde.toISOString())
        .lte('fecha_solicitud', hastaIso)
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
    console.warn('Reporte insumos: no se pudieron cargar las solicitudes', e);
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
  let inventarioActualUsd: number | null = null;
  try {
    const val = await valuarInventario({
      productos: productos.filter(p => activos.has(p.codigo)).map(p => ({
        codigo: p.codigo,
        descripcion: p.descripcion,
        stock: p.stock,
        costoPromedio: p.costoPromedio,
        categoria: p.categoria,
        moneda: (p.moneda === 'USD' ? 'USD' : 'UYU'),
      })),
      // Tabla vacía → cotización de referencia 40, igual que el resto del reporte.
      rates: buildRatesTable([]),
      monedaBase: 'USD',
    });
    inventarioActualUsd = Math.round(val.total * 100) / 100;
  } catch (e) {
    console.warn('Reporte insumos: no se pudo valorizar el inventario', e);
  }

  onProgreso?.({ paso: 'Calculando reporte' });
  return generarReporteInsumosUSD({
    desde,
    hasta,
    productos,
    movimientos,
    solicitudes,
    inventarioActualUsd,
    categoriaLabels,
    recortarInicio: opciones.todoElHistorial,
  });
}
