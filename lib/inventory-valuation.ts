import { supabase } from '@/lib/supabase';
import { convertir, buildRatesTable, type RatesTable } from '@/lib/currency';
import type { Moneda } from '@/types';

// =====================================================
// Inventory Valuation — fuente única de verdad
// =====================================================
// Resuelve la discordancia entre Dashboard y Centro de
// Costos: ambos deben mostrar el mismo número.
//
// REGLA: el valor de un producto se calcula así:
//   1. Si tiene lotes activos (cantidad_disponible > 0)
//      → FIFO real sobre las `stock` unidades más NUEVAS:
//        Σ (cantidad × costo_unitario) convirtiendo cada lote
//        desde SU moneda. Si los lotes suman más unidades que el
//        stock (salidas que no descontaron lotes), se descartan
//        los más viejos. Si suman menos (stock inicial, ajustes,
//        devoluciones sin lote), las unidades faltantes se valúan
//        al costo promedio del producto.
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
  /** Moneda en la que está expresado el costo del producto (default UYU). */
  moneda?: Moneda;
}

/** Opciones de valuación: convierte el valor de cada producto a `monedaBase`. */
export interface ValuacionOpts {
  rates?: RatesTable;
  monedaBase?: Moneda; // default 'UYU'
}

export interface LoteMinimo {
  codigo: string;          // codigo de producto (no del lote)
  cantidad_disponible: number;
  costo_unitario: number;
  /** Moneda del costo del lote. Si falta, se asume la del producto. */
  moneda?: Moneda | null;
  /** Fecha de compra (para descartar los lotes más viejos primero). */
  fecha_compra?: string | null;
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
  opts?: ValuacionOpts,
): ResultadoValuacion {
  const monedaBase: Moneda = opts?.monedaBase ?? 'UYU';
  // Sin tasas cargadas se usa la cotización de referencia (USD↔UYU).
  const rates = opts?.rates ?? buildRatesTable([]);
  // Normaliza un valor desde su moneda a la moneda base, para que todo se
  // sume en la misma moneda (productos/lotes en USD + en UYU).
  const aBase = (valor: number, moneda?: Moneda): number => {
    if (!valor || !moneda || moneda === monedaBase) return valor;
    const conv = convertir(valor, moneda, monedaBase, rates);
    return conv == null ? valor : conv;
  };
  // Agrupar lotes por codigo de producto (orden: más viejo primero)
  const lotesByCodigo = new Map<string, LoteMinimo[]>();
  for (const l of lotes) {
    if (!(l.cantidad_disponible > 0)) continue;
    const arr = lotesByCodigo.get(l.codigo) ?? [];
    arr.push(l);
    lotesByCodigo.set(l.codigo, arr);
  }
  for (const arr of lotesByCodigo.values()) {
    arr.sort((a, b) => (a.fecha_compra ?? '').localeCompare(b.fecha_compra ?? ''));
  }

  // Valuar cada producto
  const porProducto: ValuacionProducto[] = productos.map((p) => {
    const lotesProd = lotesByCodigo.get(p.codigo) ?? [];
    const stock = Math.max(0, Number(p.stock) || 0);
    const unidadesEnLotes = lotesProd.reduce((s, l) => s + l.cantidad_disponible, 0);
    // Costo promedio expresado en la moneda base.
    const costoPromBase = aBase(p.costoPromedio || 0, p.moneda);
    const valorPromedio  = stock * costoPromBase;

    // FIFO: las unidades en stock son las de los lotes más nuevos.
    let valorFifo = 0;
    let unidadesValuadas = 0;
    let aDescartar = Math.max(0, unidadesEnLotes - stock);
    for (const l of lotesProd) {
      let cant = l.cantidad_disponible;
      if (aDescartar > 0) {
        const quita = Math.min(aDescartar, cant);
        cant -= quita;
        aDescartar -= quita;
      }
      if (cant <= 0) continue;
      valorFifo += cant * aBase(l.costo_unitario || 0, (l.moneda as Moneda) || p.moneda);
      unidadesValuadas += cant;
    }

    let valor = 0;
    let fuente: ValuacionProducto['fuente'] = 'sin_valuar';
    if (unidadesValuadas > 0 && valorFifo > 0) {
      // Unidades en stock que no tienen lote → al costo promedio.
      const sinLote = Math.max(0, stock - unidadesValuadas);
      valor = valorFifo + sinLote * costoPromBase;
      fuente = 'fifo';
    } else if (valorPromedio > 0) {
      valor = valorPromedio;
      fuente = 'promedio';
    }

    // ¿Desincronizado? Si tiene lotes pero el stock de productos
    // no coincide con la suma de lotes (puede ser por ajustes
    // manuales o falta de movimientos cierre).
    const desincronizado = unidadesEnLotes > 0 && Math.abs(stock - unidadesEnLotes) > 0.5;

    return {
      codigo: p.codigo,
      unidades: stock,
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
  rates?: RatesTable;
  monedaBase?: Moneda;
}): Promise<ResultadoValuacion> {
  let productos = input?.productos;
  let lotes     = input?.lotes;

  if (!productos) {
    const { data } = await supabase
      .from('productos')
      .select(`
        codigo, descripcion, stock, stock_minimo, costo_promedio, categoria, moneda,
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
      moneda: p.moneda,
      almacenId: p.almacen_id,
      almacen: p.almacen,
    }));
  }

  if (!lotes) {
    // Paginado: Supabase devuelve como máximo 1000 filas por request.
    const acumulado: LoteMinimo[] = [];
    for (let page = 0; page < 200; page++) {
      const from = page * 1000;
      const { data } = await supabase
        .from('lotes')
        .select('codigo, cantidad_disponible, costo_unitario, moneda, fecha_compra')
        .gt('cantidad_disponible', 0)
        .order('fecha_compra', { ascending: true })
        .range(from, from + 999);
      const rows = data || [];
      for (const l of rows as any[]) {
        acumulado.push({
          codigo: l.codigo,
          cantidad_disponible: Number(l.cantidad_disponible) || 0,
          costo_unitario: parseFloat(l.costo_unitario) || 0,
          moneda: l.moneda ?? null,
          fecha_compra: l.fecha_compra ?? null,
        });
      }
      if (rows.length < 1000) break;
    }
    lotes = acumulado;
  }

  return valuarInventarioSync(productos, lotes, { rates: input?.rates, monedaBase: input?.monedaBase });
}
