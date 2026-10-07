import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Product, Movement } from '@/types';
import { Donut, CHART_COLORS } from '@/components/ui/charts-bi';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Package,
  Clock,
  DollarSign,
  X,
} from 'lucide-react';

// ============================================
// CONSUMPTION CHART — PREMIUM REDESIGN
// ============================================

type PeriodFilter = 'semana' | 'mes' | 'semestre' | 'año';

interface ProductDetail {
  codigo: string;
  descripcion: string;
  categoria: string;
  stock: number;
  stockMinimo: number;
  precio: number;
  consumoTotal: number;
  consumoDiario: number;
  diasRestantes: number | null;
  movimientos: Movement[];
}

interface ConsumptionChartProps {
  movements: Movement[];
  products: Product[];
  /** Si se provee, se usa este período en vez del state interno. Acepta 7d/30d/90d/1a. */
  fixedPeriod?: '7d' | '30d' | '90d' | '1a';
}

// Category color mapping
const CATEGORY_COLORS: Record<string, string> = {
  'Estación de Servicio': '#9ec9b1',
  'Ferretería': '#4a7fb5',
  'Papelería': '#6b5488',
  'Ediltor': '#d6b97a',
  'Otros': '#986080',
};

const FALLBACK_COLORS = ['#9ec9b1', '#4a7fb5', '#6b5488', '#d6b97a', '#986080', '#546280', '#3a9280'];

function getCatColor(categoria: string): string {
  return CATEGORY_COLORS[categoria] || FALLBACK_COLORS[Math.abs(categoria.split('').reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0)) % FALLBACK_COLORS.length];
}

export function ConsumptionChart({ movements, products, fixedPeriod }: ConsumptionChartProps) {
  const { t } = useTranslation();
  // Si recibe fixedPeriod del dashboard, lo usa; sino mantiene state interno.
  const externalPeriod: PeriodFilter | null =
    fixedPeriod === '7d' ? 'semana'
    : fixedPeriod === '90d' ? 'semestre'   // 90d ≈ semestre en nuestro mapping
    : fixedPeriod === '1a' ? 'año'
    : fixedPeriod === '30d' ? 'mes'
    : null;
  const [internalPeriod, setInternalPeriod] = useState<PeriodFilter>('mes');
  const period: PeriodFilter = externalPeriod ?? internalPeriod;
  const setPeriod = setInternalPeriod;
  const [selectedProduct, setSelectedProduct] = useState<ProductDetail | null>(null);

  const periodConfig: Record<PeriodFilter, { label: string; fullLabel: string; days: number }> = {
    semana: { label: '7d', fullLabel: t('periods.lastWeek', 'Última semana'), days: 7 },
    mes: { label: '30d', fullLabel: t('periods.lastMonth', 'Último mes'), days: 30 },
    semestre: { label: '6m', fullLabel: t('periods.lastSemester', 'Último semestre'), days: 180 },
    año: { label: '1a', fullLabel: t('periods.lastYear', 'Último año'), days: 365 },
  };

  const { chartData, maxValue, startDate, prevStartDate } = useMemo(() => {
    const now = new Date();
    const days = periodConfig[period].days;
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const prevStart = new Date(start.getTime() - days * 24 * 60 * 60 * 1000);

    // Current period
    const currentMovements = movements.filter((m: Movement) => {
      const d = new Date(m.timestamp);
      return d >= start && m.tipo === 'salida';
    });

    // Previous period (for comparison)
    const prevMovements = movements.filter((m: Movement) => {
      const d = new Date(m.timestamp);
      return d >= prevStart && d < start && m.tipo === 'salida';
    });

    // Aggregate current
    const currentMap: Record<string, number> = {};
    currentMovements.forEach((m: Movement) => {
      currentMap[m.codigo] = (currentMap[m.codigo] || 0) + m.cantidad;
    });

    // Aggregate previous
    const prevMap: Record<string, number> = {};
    prevMovements.forEach((m: Movement) => {
      prevMap[m.codigo] = (prevMap[m.codigo] || 0) + m.cantidad;
    });

    const sorted = Object.entries(currentMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    const data = sorted.map(([codigo, cantidad]) => {
      const product = products.find((p: Product) => p.codigo === codigo);
      const prevCantidad = prevMap[codigo] || 0;
      return {
        codigo,
        descripcion: product?.descripcion || codigo,
        categoria: product?.categoria || t('common.noCategory', 'Sin categoría'),
        cantidad,
        prevCantidad,
      };
    });

    const max = Math.max(...data.map((d) => d.cantidad), 1);

    return { chartData: data, maxValue: max, startDate: start, prevStartDate: prevStart };
  }, [movements, products, period, t, periodConfig]);

  // Handle bar click
  const handleBarClick = (codigo: string) => {
    const product = products.find((p: Product) => p.codigo === codigo);
    if (!product) return;

    const productMovements = movements.filter((m: Movement) => {
      const movDate = new Date(m.timestamp);
      return m.codigo === codigo && movDate >= startDate;
    });

    const salidas = productMovements.filter((m: Movement) => m.tipo === 'salida');
    const consumoTotal = salidas.reduce((sum: number, m: Movement) => sum + m.cantidad, 0);
    
    const daysInPeriod = Math.ceil((new Date().getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    const consumoDiario = daysInPeriod > 0 ? consumoTotal / daysInPeriod : 0;
    const diasRestantes = consumoDiario > 0 ? Math.round(product.stock / consumoDiario) : null;

    setSelectedProduct({
      codigo: product.codigo,
      descripcion: product.descripcion,
      categoria: product.categoria,
      stock: product.stock,
      stockMinimo: product.stockMinimo,
      precio: product.precio,
      consumoTotal,
      consumoDiario: Math.round(consumoDiario * 100) / 100,
      diasRestantes,
      movimientos: productMovements
        .sort((a: Movement, b: Movement) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10),
    });
  };

  return (
    <div className="space-y-4">
      {/* Header — más grande, ejecutivo */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-100 tracking-tight">
            {t('analytics.topConsumed', 'Productos más consumidos')}
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Ranking por unidades salidas · {periodConfig[period].fullLabel}
          </p>
        </div>

        {/* Period selector — solo si NO viene controlado desde afuera */}
        {!externalPeriod && (
        <div className="flex gap-0.5 p-0.5 rounded-md bg-slate-900 border border-slate-800">
          {(Object.keys(periodConfig) as PeriodFilter[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                period === p
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-500 hover:text-slate-300',
              )}
            >
              {periodConfig[p].label}
            </button>
          ))}
        </div>
        )}
      </div>

      {/* Visual: donut chart con leyenda + tabla detallada */}
      {chartData.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-500">
          {t('analytics.noConsumptionData', 'Sin datos de consumo en este período')}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <Donut
              data={chartData.map((d, i) => ({
                name: d.descripcion,
                value: d.cantidad,
                color: CHART_COLORS[i % CHART_COLORS.length],
              }))}
              size={200}
              centerLabel="Total"
              centerValue={chartData.reduce((s, d) => s + d.cantidad, 0).toLocaleString('es-UY')}
              valueFormatter={(v) => `${v.toLocaleString('es-UY')} uds`}
            />
            <div className="flex-1 w-full space-y-2.5">
              {chartData.map((d, i) => {
                const total = chartData.reduce((s, x) => s + x.cantidad, 0);
                const pct = total > 0 ? (d.cantidad / total * 100) : 0;
                return (
                  <div key={d.codigo} className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="flex-1 text-sm text-slate-200 font-medium truncate">{d.descripcion}</span>
                    <span className="text-sm font-semibold text-slate-100 tabular-nums">{d.cantidad.toLocaleString('es-UY')}</span>
                    <span className="text-xs text-slate-500 tabular-nums w-12 text-right">{pct.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {chartData.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-800">
          <table className="w-full">
            <thead className="bg-slate-800/60">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.08em] text-slate-400 w-10">#</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.08em] text-slate-400">Producto</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.08em] text-slate-400">Categoría</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-[0.08em] text-slate-400">Unidades</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-[0.08em] text-slate-400">vs ant.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {chartData.map((item, i: number) => {
                const delta = item.prevCantidad > 0
                  ? ((item.cantidad - item.prevCantidad) / item.prevCantidad * 100)
                  : null;
                const isUp = delta !== null && delta >= 0;
                return (
                  <tr
                    key={item.codigo}
                    onClick={() => handleBarClick(item.codigo)}
                    className="cursor-pointer hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-md text-sm font-bold tabular-nums text-slate-300">
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-100 max-w-[320px] truncate">{item.descripcion}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 truncate">{item.categoria}</td>
                    <td className="px-4 py-3 text-right text-base font-bold text-slate-100 tabular-nums">
                      {item.cantidad.toLocaleString('es-UY')}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {delta !== null && Number.isFinite(delta) ? (
                        <span className={cn(
                          'inline-flex items-center gap-1 text-sm font-semibold',
                          isUp ? 'text-slate-300' : 'text-slate-300',
                        )}>
                          {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {Math.abs(delta).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(15,23,42,0.98), rgba(15,23,42,0.95))',
              border: '1px solid rgba(51,65,85,0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-slate-100">{selectedProduct.descripcion}</h3>
                <p className="text-sm text-slate-500">
                  {selectedProduct.codigo} ·{' '}
                  <span style={{ color: getCatColor(selectedProduct.categoria) }}>
                    {selectedProduct.categoria}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-2 rounded-lg transition-colors"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                <X size={16} className="text-slate-400" />
              </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="p-3.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(51,65,85,0.2)' }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Package size={12} className="text-slate-500" />
                  <span className="text-xs text-slate-500">{t('analytics.currentStock', 'Stock actual')}</span>
                </div>
                <div
                  className="text-xl font-bold font-mono"
                  style={{ color: selectedProduct.stock <= selectedProduct.stockMinimo ? '#cc5555' : '#4aaa73' }}
                >
                  {selectedProduct.stock}
                </div>
                <div className="text-xs text-slate-600">{t('stock.minStock', 'Mín')}: {selectedProduct.stockMinimo}</div>
              </div>

              <div className="p-3.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(51,65,85,0.2)' }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <BarChart3 size={12} className="text-slate-500" />
                  <span className="text-xs text-slate-500">{t('analytics.consumption', 'Consumo')}</span>
                </div>
                <div className="text-xl font-bold font-mono text-slate-300">
                  {selectedProduct.consumoTotal}
                </div>
                <div className="text-xs text-slate-600">{selectedProduct.consumoDiario}/{t('analytics.dayAvg', 'día prom.')}</div>
              </div>

              <div className="p-3.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(51,65,85,0.2)' }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Clock size={12} className="text-slate-500" />
                  <span className="text-xs text-slate-500">{t('analytics.daysLeft', 'Días restantes')}</span>
                </div>
                <div
                  className="text-xl font-bold font-mono"
                  style={{
                    color:
                      selectedProduct.diasRestantes === null ? 'rgba(148,163,184,0.5)' :
                      selectedProduct.diasRestantes < 7 ? '#cc5555' :
                      selectedProduct.diasRestantes < 14 ? '#cc9a40' : '#4aaa73',
                  }}
                >
                  {selectedProduct.diasRestantes ?? '∞'}
                </div>
                <div className="text-xs text-slate-600">{t('analytics.estimatedCurrentRate', 'al ritmo actual')}</div>
              </div>

              <div className="p-3.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(51,65,85,0.2)' }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <DollarSign size={12} className="text-slate-500" />
                  <span className="text-xs text-slate-500">{t('stock.salePrice', 'Precio')}</span>
                </div>
                <div className="text-xl font-bold font-mono text-slate-300">
                  ${selectedProduct.precio.toLocaleString('es-UY')}
                </div>
                <div className="text-xs text-slate-600">{t('common.perUnit', 'por unidad')}</div>
              </div>
            </div>

            {/* Recent movements */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">
                {t('analytics.recentMovements', 'Movimientos recientes')}
              </h4>
              <div
                className="max-h-40 overflow-y-auto space-y-1.5 pr-1"
                style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(51,65,85,0.5) transparent' }}
              >
                {selectedProduct.movimientos.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">{t('analytics.noMovementsPeriod', 'Sin movimientos')}</p>
                ) : (
                  selectedProduct.movimientos.map((mov: Movement, i: number) => (
                    <div
                      key={`${mov.codigo}-${i}`}
                      className="flex items-center justify-between p-2.5 rounded-lg"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(51,65,85,0.15)' }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs px-2 py-0.5 rounded font-medium"
                          style={{
                            background: mov.tipo === 'entrada' ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
                            color: mov.tipo === 'entrada' ? '#4aaa73' : '#cc5555',
                          }}
                        >
                          {mov.tipo === 'entrada' ? t('movements.entry', 'Entrada') : t('movements.exit', 'Salida')}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(mov.timestamp).toLocaleDateString('es-UY')}
                        </span>
                      </div>
                      <span className="font-mono font-semibold text-sm text-slate-200">
                        {mov.tipo === 'entrada' ? '+' : '\u2212'}{mov.cantidad}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={() => setSelectedProduct(null)}
              className="w-full mt-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-[1.01]"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(51,65,85,0.3)',
                color: 'rgba(148,163,184,0.7)',
              }}
            >
              {t('common.close', 'Cerrar')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
