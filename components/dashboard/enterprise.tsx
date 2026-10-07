import { useState, useMemo, useEffect } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { valuarInventario, type ResultadoValuacion } from '@/lib/inventory-valuation';
import { Donut, HorizontalBars, CHART_COLORS } from '@/components/ui/charts-bi';
import { formatMoney, convertir } from '@/lib/currency';
import { useModulosHabilitados } from '@/hooks/useModulosHabilitados';
import { useTiposCambio } from '@/hooks/useTiposCambio';
import type { Moneda } from '@/types';

// ============================================
// TYPES
// ============================================

interface Categoria {
  nombre: string;
  valor: number;
  porcentaje: number;
  color: string;
}

interface AlmacenBreakdown {
  id: string;
  nombre: string;
  codigo: string;
  productos: number;
  unidades: number;
  valor: number;
  criticos: number;
}

interface ValorInventarioData {
  total: number;
  prev30d: number;
  categorias: Categoria[];
  capitalInmovilizado: number;
  productosInmovilizados: number;
  // Desglose por almacén — null = sin almacén asignado
  almacenes: AlmacenBreakdown[];
  // Productos con problemas de data quality
  sinCosto: number;       // costo_promedio = 0 → no aportan al valor
  sinAlmacen: number;     // sin almacen_id asignado
}


// ============================================
// INVENTORY VALUE PANEL
// ============================================

interface InventoryValuePanelProps {
  periodLabel?: string;
  data: ValorInventarioData;
}

function InventoryValuePanel({ data, periodLabel = '30 días' }: InventoryValuePanelProps) {
  const trend = data.prev30d > 0
    ? ((data.total - data.prev30d) / data.prev30d * 100)
    : 0;
  const isUp = trend >= 0;
  const hayProblemasDatos = data.sinCosto > 0 || data.sinAlmacen > 0;

  // Datos para donut chart (categorías)
  const donutData = data.categorias.slice(0, 6).map((cat, i) => ({
    name: cat.nombre,
    value: cat.valor,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  // Top almacenes en barras horizontales
  const almacenesBarData = data.almacenes.slice(0, 6).map(a => ({
    name: a.id === '__sin_almacen__' ? 'Sin asignar' : a.nombre,
    value: a.valor,
  }));

  // Origen = UYU (hardcoded: así guardan los datos). Destino = moneda
  // elegida en Configuración. Si destino = UYU no convierte.
  const { config: orgConfig } = useModulosHabilitados();
  const { rates: ratesTable } = useTiposCambio();
  const monedaBase: Moneda   = 'UYU';
  const monedaTarget: Moneda = (orgConfig.display_currency as Moneda) ?? 'UYU';

  const convertirSiCorresponde = (v: number): { valor: number; sinTasa: boolean } => {
    if (monedaTarget === monedaBase) return { valor: v, sinTasa: false };
    const c = convertir(v, monedaBase, monedaTarget, ratesTable);
    return c === null ? { valor: v, sinTasa: true } : { valor: c, sinTasa: false };
  };

  const fmtMoney = (v: number) => {
    const { valor } = convertirSiCorresponde(v);
    return `${formatMoney(valor / 1000, monedaTarget, { maximumFractionDigits: 1 })}k`;
  };
  const fmtMoneyFull = (v: number) => {
    const { valor, sinTasa } = convertirSiCorresponde(v);
    return sinTasa
      ? `${formatMoney(v, monedaBase)} *`
      : formatMoney(valor, monedaTarget);
  };

  return (
    <div className="rounded-xl bg-slate-900/40 border border-slate-800 p-6">
      {/* Header — título más grande y profesional */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-xl font-bold text-slate-100 tracking-tight">Valor del Inventario</h3>
        </div>
        {Number.isFinite(trend) && trend !== 0 && (
          <span className={cn(
            'inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-sm font-semibold tabular-nums ring-1 ring-inset',
            isUp ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20' : 'bg-red-500/10 text-red-300 ring-red-500/20',
          )}>
            {isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>

      {/* Hero: valor BIG + donut grande */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-6 items-center mb-6">
        <div>
          <div className="text-xs uppercase tracking-[0.08em] text-slate-400 mb-2 font-medium">Total en stock</div>
          {/* Resultado final → se mantiene en semibold pero más compacto */}
          <div className="text-4xl font-semibold text-slate-50 tabular-nums tracking-tight leading-none">
            {fmtMoneyFull(data.total)}
          </div>
          <div className="text-base text-slate-400 mt-3 tabular-nums">
            vs {periodLabel}: <span className="text-slate-200 font-semibold">{fmtMoneyFull(data.prev30d)}</span>
          </div>

          {/* 3 mini KPIs — bigger */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-slate-900/60 border border-slate-800 p-4">
              <div className="text-xs uppercase tracking-[0.08em] text-slate-400 font-bold">Inmovilizado</div>
              <div className="text-2xl font-bold text-amber-300 tabular-nums mt-1.5">
                {fmtMoney(data.capitalInmovilizado)}
              </div>
              <div className="text-xs text-slate-500 tabular-nums mt-1">
                {data.productosInmovilizados} prod · 60d
              </div>
            </div>
            <div className="rounded-lg bg-slate-900/60 border border-slate-800 p-4">
              <div className="text-xs uppercase tracking-[0.08em] text-slate-400 font-bold">Categorías</div>
              <div className="text-2xl font-bold text-slate-100 tabular-nums mt-1.5">
                {data.categorias.length}
              </div>
              <div className="text-xs text-slate-500 truncate mt-1">
                {data.categorias[0]?.nombre ?? '—'}
              </div>
            </div>
            <div className="rounded-lg bg-slate-900/60 border border-slate-800 p-4">
              <div className="text-xs uppercase tracking-[0.08em] text-slate-400 font-bold">Almacenes</div>
              <div className="text-2xl font-bold text-slate-100 tabular-nums mt-1.5">
                {data.almacenes.length}
              </div>
              <div className="text-xs text-slate-500 truncate mt-1">
                {data.almacenes[0]?.nombre ?? '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Donut grande con leyenda */}
        {donutData.length > 0 && (
          <div className="flex items-center justify-center">
            <div className="flex flex-col items-center">
              <Donut
                data={donutData}
                size={220}
                centerLabel="Categorías"
                centerValue={String(data.categorias.length)}
                valueFormatter={fmtMoneyFull}
              />
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-sm">
                {donutData.slice(0, 6).map(d => (
                  <div key={d.name} className="flex items-center gap-2 min-w-0">
                    <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: d.color }} />
                    <span className="text-slate-300 truncate font-medium">{d.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Almacenes como barras horizontales */}
      {data.almacenes.length > 1 && (
        <div className="pt-5 border-t border-slate-800/60">
          <div className="flex items-center justify-between mb-3">
            <span className="text-base font-bold text-slate-200 tracking-tight">
              Top almacenes por valor
            </span>
            <span className="text-sm text-slate-400 tabular-nums">
              {data.almacenes.length} en total
            </span>
          </div>
          <HorizontalBars
            data={almacenesBarData}
            height={Math.max(160, almacenesBarData.length * 36)}
            valueFormatter={fmtMoney}
            color="#4a7fb5"
          />
        </div>
      )}

      {/* Calidad de datos compacta */}
      {hayProblemasDatos && (
        <div className="mt-4 pt-4 border-t border-slate-800/60 flex items-start gap-2 text-sm text-slate-400">
          <AlertTriangle size={14} className="text-red-400 mt-0.5 flex-shrink-0" strokeWidth={2} />
          <span>
            {data.sinCosto > 0 && <span>{data.sinCosto} sin costo · </span>}
            {data.sinAlmacen > 0 && <span>{data.sinAlmacen} sin almacén</span>}
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================
// PUBLIC EXPORTS para page.tsx
// ============================================

export function InventoryValueCard({ products, movements, onCategoryClick, periodDays = 30, periodLabel = '30 días' }: {
  products: any[];
  movements: any[];
  onCategoryClick: (category: string) => void;
  /** Cuántos días atrás comparar (viene del PeriodSelector del dashboard) */
  periodDays?: number;
  periodLabel?: string;
}) {
  // Valuación unificada: FIFO sobre lotes (fuente de verdad) + fallback
  // a costo promedio. Misma lógica que el Centro de Costos.
  const [valuacion, setValuacion] = useState<ResultadoValuacion | null>(null);
  // Tasas para normalizar productos en distintas monedas (USD/UYU) a UYU antes
  // de sumar. Así el valor de inventario contempla los precios en USD.
  const { rates: ratesValuacion } = useTiposCambio();
  useEffect(() => {
    let cancelled = false;
    valuarInventario({
      productos: products.map((p: any) => ({
        codigo: p.codigo,
        descripcion: p.descripcion,
        stock: p.stock,
        stockMinimo: p.stockMinimo,
        costoPromedio: p.costoPromedio || 0,
        categoria: p.categoria,
        moneda: p.moneda,
        almacenId: p.almacenId,
        almacen: p.almacen,
      })),
      rates: ratesValuacion,
      monedaBase: 'UYU',
    }).then(r => { if (!cancelled) setValuacion(r); });
    return () => { cancelled = true; };
  }, [products, ratesValuacion]);

  const data = useMemo(() => {
    const CATEGORY_COLORS: Record<string, string> = {
      'Estación de Servicio': '#9ec9b1', 'Ferretería': '#4a7fb5',
      'Papelería': '#836ba0', 'Ediltor': '#d6b97a',
    };

    const totalValue = valuacion?.total ?? 0;
    const categorias = (valuacion?.porCategoria ?? []).slice(0, 5).map((c, i) => ({
      nombre: c.nombre,
      valor: c.valor,
      porcentaje: totalValue > 0 ? Math.round((c.valor / totalValue) * 100) : 0,
      color: CATEGORY_COLORS[c.nombre] ?? ['#9ec9b1','#4a7fb5','#836ba0','#d6b97a','#b5547a'][i % 5],
    }));

    const almacenes = valuacion?.porAlmacen ?? [];

    // Mapa codigo → valor por producto, para reusar en inmovilizados y tendencia
    const valorPorCodigo = new Map<string, number>();
    (valuacion?.porProducto ?? []).forEach(vp => valorPorCodigo.set(vp.codigo, vp.valor));
    const valorProducto = (p: any) => valorPorCodigo.get(p.codigo) ?? 0;

    // CAPITAL INMOVILIZADO — productos sin movimiento en 60 días
    const sixtyDaysAgo = new Date(); sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const activeCodes = new Set(movements.filter((m) => new Date(m.timestamp) >= sixtyDaysAgo).map((m) => m.codigo));
    const inmovilizados = products.filter((p) => !activeCodes.has(p.codigo) && p.stock > 0);
    const capitalInmovilizado = inmovilizados.reduce((sum, p) => sum + valorProducto(p), 0);

    // VALOR EN EL PERÍODO ANTERIOR — tendencia. Usamos valor unitario implícito
    // por producto (valor / stock). Ventana = periodDays (controlado por el selector).
    const periodStart = new Date(Date.now() - periodDays * 86400000);
    const costoUnitMap = new Map<string, number>();
    (valuacion?.porProducto ?? []).forEach(vp => {
      const unit = vp.unidades > 0 ? vp.valor / vp.unidades : 0;
      costoUnitMap.set(vp.codigo, unit);
    });
    let netValueChange = 0;
    movements.forEach((m) => {
      if (new Date(m.timestamp) >= periodStart) {
        const cost = costoUnitMap.get(m.codigo) ?? 0;
        if (m.tipo === 'entrada') netValueChange += m.cantidad * cost;
        else                       netValueChange -= m.cantidad * cost;
      }
    });
    const prev30d = totalValue - netValueChange;

    const sinCosto = valuacion?.calidad.sinValuar ?? 0;
    const sinAlmacen = products.filter((p) => !p.almacenId).length;

    return {
      total: totalValue,
      prev30d: prev30d > 0 ? prev30d : 0,
      categorias,
      capitalInmovilizado,
      productosInmovilizados: inmovilizados.length,
      almacenes,
      sinCosto,
      sinAlmacen,
    };
  }, [valuacion, products, movements, periodDays]);
  return <InventoryValuePanel data={data} periodLabel={periodLabel} />;
}
