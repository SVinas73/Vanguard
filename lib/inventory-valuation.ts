import { supabase } from '@/lib/supabase';

// =====================================================
// Inventory Valuation — fuente única de verdad
// =====================================================
// Resuelve la discordancia entre Dashboard y Centro de
// Costos: ambos deben mostrar el mismo número.
//
// REGLA: el valor de un producto se calcula así:
//   1. Si tiene lotes activos (cantidad_disponible > 0)
//      → FIFO real: Σ (cantidad_disponible × costo_unitario)
//   2. Si NO tiene lotes pero tiene stock y costo_promedio
//      → Fallback: stock × costo_promedio
//   3. Si no tiene ni lotes ni costo → 0 (data quality issue)
//
// FIFO es la fuente preferida porque refleja el costo
// histórico real pagado por cada unidad. costo_promedio
// es un agregado que requiere mantenimiento.
// =====================================================

export interface ProductoMinimo {
  codigo: string;
  descripcion: string;
  stock: number;
  stockMinimo?: number;
  costoPromedio: number;
  categoria?: string;
  almacenId?: string | null;
  almacen?: { id: string; codigo: string; nombre: string } | null;
}

export interface LoteMinimo {
  codigo: string;          // codigo de producto (no del lote)
  cantidad_disponible: number;
  costo_unitario: number;
}

export interface ValuacionProducto {
  codigo: string;
  unidades: number;        // stock (de productos.stock)
  unidadesEnLotes: number; // suma de cantidad_disponible
  valorFifo: number;       // suma de cantidad_disponible * costo_unitario
  valorPromedio: number;   // stock * costo_promedio (puede ser 0)
  valor: number;           // valor final usado (FIFO si hay lotes, sino fallback)
  fuente: 'fifo' | 'promedio' | 'sin_valuar';
  desincronizado: boolean; // stock != unidadesEnLotes (si hay lotes)
}

export interface ValuacionAlmacen {
  id: string;
  nombre: string;
  codigo: string;
  productos: number;
  unidades: number;
  valor: number;
  criticos: number;
}

export interface ResultadoValuacion {
  total: number;
  totalUnidades: number;
  porProducto: ValuacionProducto[];
  porAlmacen: ValuacionAlmacen[];
  porCategoria: Array<{ nombre: string; valor: number }>;
  calidad: {
    productosTotales: number;
    conFifo: number;        // productos valuados con lotes
    conPromedio: number;    // productos valuados con costo promedio
    sinValuar: number;      // productos con stock pero sin costo
    desincronizados: number;// stock != Σ lotes
  };
}

const SIN_ALMACEN_KEY = '__sin_almacen__';

/**
 * Versión síncrona: recibe productos y lotes ya cargados.
 * Usar cuando el componente ya tiene esos datos en memoria.
 */
export function valuarInventarioSync(
  productos: ProductoMinimo[],
  lotes: LoteMinimo[],
): ResultadoValuacion {
  // Agrupar lotes por codigo de producto
  const lotesByCodigo = new Map<string, { unidades: number; valor: number }>();
  for (const l of lotes) {
    const cur = lotesByCodigo.get(l.codigo) ?? { unidades: 0, valor: 0 };
    cur.unidades += l.cantidad_disponible;
    cur.valor    += l.cantidad_disponible * l.costo_unitario;
    lotesByCodigo.set(l.codigo, cur);
  }

  // Valuar cada producto
  const porProducto: ValuacionProducto[] = productos.map((p) => {
    const lote = lotesByCodigo.get(p.codigo);
    const unidadesEnLotes = lote?.unidades ?? 0;
    const valorFifo      = lote?.valor ?? 0;
    const valorPromedio  = p.stock * p.costoPromedio;

    let valor = 0;
    let fuente: ValuacionProducto['fuente'] = 'sin_valuar';
    if (valorFifo > 0) {
      valor = valorFifo;
      fuente = 'fifo';
    } else if (valorPromedio > 0) {
      valor = valorPromedio;
      fuente = 'promedio';
    }

    // ¿Desincronizado? Si tiene lotes pero el stock de productos
    // no coincide con la suma de lotes (puede ser por ajustes
    // manuales o falta de movimientos cierre).
    const desincronizado = unidadesEnLotes > 0 && Math.abs(p.stock - unidadesEnLotes) > 0.5;

    return {
      codigo: p.codigo,
      unidades: p.stock,
      unidadesEnLotes,
      valorFifo,
      valorPromedio,
      valor,
      fuente,
      desincronizado,
    };
  });

  const total = porProducto.reduce((s, p) => s + p.valor, 0);
  const totalUnidades = porProducto.reduce((s, p) => s + p.unidades, 0);

  // Desglose por almacén
  const almacenAcc = new Map<string, ValuacionAlmacen>();
  porProducto.forEach((vp, idx) => {
    const p = productos[idx];
    const id = p.almacenId || SIN_ALMACEN_KEY;
    const nombre = p.almacen?.nombre ?? (id === SIN_ALMACEN_KEY ? 'Sin almacén asignado' : 'Almacén desconocido');
    const codigo = p.almacen?.codigo ?? (id === SIN_ALMACEN_KEY ? '—' : '');
    const cur = almacenAcc.get(id) ?? { id, nombre, codigo, productos: 0, unidades: 0, valor: 0, criticos: 0 };
    cur.productos += 1;
    cur.unidades  += vp.unidades;
    cur.valor     += vp.valor;
    if (p.stock <= (p.stockMinimo ?? 0)) cur.criticos += 1;
    almacenAcc.set(id, cur);
  });
  const porAlmacen = Array.from(almacenAcc.values()).sort((a, b) => b.valor - a.valor);

  // Desglose por categoría
  const catAcc = new Map<string, number>();
  porProducto.forEach((vp, idx) => {
    const cat = productos[idx].categoria || 'Sin categoría';
    catAcc.set(cat, (catAcc.get(cat) ?? 0) + vp.valor);
  });
  const porCategoria = Array.from(catAcc.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([nombre, valor]) => ({ nombre, valor }));

  // Calidad de datos
  const calidad = {
    productosTotales: porProducto.length,
    conFifo:          porProducto.filter(p => p.fuente === 'fifo').length,
    conPromedio:      porProducto.filter(p => p.fuente === 'promedio').length,
    sinValuar:        porProducto.filter(p => p.fuente === 'sin_valuar' && p.unidades > 0).length,
    desincronizados:  porProducto.filter(p => p.desincronizado).length,
  };

  return { total, totalUnidades, porProducto, porAlmacen, porCategoria, calidad };
}

/**
 * Wrapper async: si no se pasan productos/lotes, los carga de Supabase.
 */
export async function valuarInventario(input?: {
  productos?: ProductoMinimo[];
  lotes?: LoteMinimo[];
}): Promise<ResultadoValuacion> {
  let productos = input?.productos;
  let lotes     = input?.lotes;

  if (!productos) {
    const { data } = await supabase
      .from('productos')
      .select(`
        codigo, descripcion, stock, stock_minimo, costo_promedio, categoria,
        almacen_id, almacen:almacenes(id, codigo, nombre)
      `)
      .is('deleted_at', null);
    productos = (data || []).map((p: any) => ({
      codigo: p.codigo,
      descripcion: p.descripcion,
      stock: p.stock || 0,
      stockMinimo: p.stock_minimo || 0,
      costoPromedio: parseFloat(p.costo_promedio) || 0,
      categoria: p.categoria,
      almacenId: p.almacen_id,
      almacen: p.almacen,
    }));
  }

  if (!lotes) {
    const { data } = await supabase
      .from('lotes')
      .select('codigo, cantidad_disponible, costo_unitario')
      .gt('cantidad_disponible', 0);
    lotes = (data || []).map((l: any) => ({
      codigo: l.codigo,
      cantidad_disponible: l.cantidad_disponible || 0,
      costo_unitario: parseFloat(l.costo_unitario) || 0,
    }));
  }

  return valuarInventarioSync(productos, lotes);
}
