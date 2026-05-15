import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Product, Movement, StockPrediction } from '@/types';
import { CategoryBadge } from '@/components/productos';
import { Donut, CHART_COLORS } from '@/components/ui/charts-bi';
import { 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Filter,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  Clock,
  DollarSign,
  X,
} from 'lucide-react';

// ============================================
// CONFIDENCE BAR
// ============================================

interface ConfidenceBarProps {
  confidence: number;
  label?: string;
}

export function ConfidenceBar({ confidence, label }: ConfidenceBarProps) {
  const { t } = useTranslation();
  const displayLabel = label || t('analytics.modelConfidence');
  const percentage = Math.round(confidence * 100);

  return (
    <div>
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>{displayLabel}</span>
        <span>{percentage}%</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// ============================================
// PREDICTION CARD
// ============================================

interface PredictionCardProps {
  product: Product;
  prediction: StockPrediction;
}

export function PredictionCard({ product, prediction }: PredictionCardProps) {
  const { t } = useTranslation();

  const getTrendConfig = () => {
    switch (prediction.trend) {
      case 'acelerando':
        return { icon: <TrendingUp size={16} />, color: 'text-red-400', label: t('trends.increasing') };
      case 'desacelerando':
        return { icon: <TrendingDown size={16} />, color: 'text-emerald-400', label: t('trends.decreasing') };
      default:
        return { icon: <Minus size={16} />, color: 'text-slate-400', label: t('trends.stable') };
    }
  };

  const getDaysColor = () => {
    if (prediction.days === null) return 'text-slate-400';
    if (prediction.days < 7) return 'text-red-400';
    if (prediction.days < 14) return 'text-amber-400';
    return 'text-emerald-400';
  };

  const trend = getTrendConfig();

  return (
    <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/30">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-medium text-sm">{product.descripcion}</div>
          <div className="text-xs text-slate-500">{product.codigo}</div>
        </div>
        <CategoryBadge categoria={product.categoria} />
      </div>

      <div className="grid grid-cols-4 gap-4 text-center mb-3">
        <div className="p-2 rounded-lg bg-slate-900/50">
          <div className="text-xs text-slate-500 mb-1">{t('analytics.currentStock')}</div>
          <div className="font-mono font-semibold text-emerald-400">
            {product.stock}
          </div>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/50">
          <div className="text-xs text-slate-500 mb-1">{t('analytics.daysLeft')}</div>
          <div className={cn('font-mono font-semibold', getDaysColor())}>
            {prediction.days === null ? '—' : prediction.days === Infinity ? '∞' : prediction.days}
          </div>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/50">
          <div className="text-xs text-slate-500 mb-1">{t('analytics.dailyConsumption')}</div>
          <div className="font-mono font-semibold text-cyan-400">
            {prediction.dailyRate || '—'}
          </div>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/50">
          <div className="text-xs text-slate-500 mb-1">{t('analytics.trend')}</div>
          <div className={cn('font-semibold flex items-center justify-center gap-1', trend.color)}>
            {trend.icon} {trend.label}
          </div>
        </div>
      </div>

      <ConfidenceBar confidence={prediction.confidence} />
    </div>
  );
}

// ============================================
// STATS GRID
// ============================================

interface StatItem {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

interface StatsGridProps {
  stats: StatItem[];
}

export function StatsGrid({ stats }: StatsGridProps) {
  const colorClasses: Record<string, string> = {
    emerald: 'text-emerald-400',
    cyan: 'text-cyan-400',
    amber: 'text-amber-400',
    purple: 'text-purple-400',
    red: 'text-red-400',
    slate: 'text-slate-400',
  };

  return (
    <div className="grid grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <div
          key={i}
          className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/50 hover:border-slate-700/50 transition-all"
        >
          <div className="flex items-start justify-between mb-3">
            <span className={cn(colorClasses[stat.color] || 'text-slate-400')}>
              {stat.icon}
            </span>
          </div>
          <div className={cn('text-2xl font-bold mb-1', colorClasses[stat.color] || 'text-slate-200')}>
            {stat.value}
          </div>
          <div className="text-sm text-slate-500">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// ALERT LIST (Stock alerts with scroll and filter)
// ============================================

type UrgencyFilter = 'todas' | 'critica' | 'media' | 'baja';

interface AlertListProps {
  products: Product[];
  predictions: Record<string, StockPrediction>;
  maxItems?: number;
}

export function AlertList({ products, predictions, maxItems = 100 }: AlertListProps) {
  const { t } = useTranslation();
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('todas');

  const alertProducts = useMemo(() => {
    const classified = products
      .map((p) => {
        const pred = predictions[p.codigo];
        const ratio = p.stock / p.stockMinimo;
        const daysLeft = pred?.days;
        
        let urgency: 'critica' | 'media' | 'baja';
        if (p.stock === 0 || (daysLeft !== null && daysLeft !== Infinity && daysLeft < 3)) {
          urgency = 'critica';
        } else if (ratio < 1 || (daysLeft !== null && daysLeft !== Infinity && daysLeft < 7)) {
          urgency = 'media';
        } else {
          urgency = 'baja';
        }

        return { product: p, prediction: pred, urgency, ratio, daysLeft };
      })
      .filter(({ product, prediction }) => {
        const pred = prediction;
        return product.stock <= product.stockMinimo || (pred && pred.days !== null && pred.days < 14);
      });

    const urgencyOrder = { critica: 0, media: 1, baja: 2 };
    classified.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    if (urgencyFilter !== 'todas') {
      return classified.filter((item) => item.urgency === urgencyFilter);
    }

    return classified;
  }, [products, predictions, urgencyFilter]);

  const urgencyCounts = useMemo(() => {
    const counts = { critica: 0, media: 0, baja: 0 };
    products.forEach((p) => {
      const pred = predictions[p.codigo];
      const ratio = p.stock / p.stockMinimo;
      const daysLeft = pred?.days;
      
      const hasAlert = p.stock <= p.stockMinimo || (pred && pred.days !== null && pred.days < 14);
      if (!hasAlert) return;

      if (p.stock === 0 || (daysLeft !== null && daysLeft !== Infinity && daysLeft < 3)) {
        counts.critica++;
      } else if (ratio < 1 || (daysLeft !== null && daysLeft !== Infinity && daysLeft < 7)) {
        counts.media++;
      } else {
        counts.baja++;
      }
    });
    return counts;
  }, [products, predictions]);

  const getUrgencyConfig = (urgency: 'critica' | 'media' | 'baja') => {
    switch (urgency) {
      case 'critica':
        return { color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30', label: t('alerts.critical') };
      case 'media':
        return { color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/30', label: t('alerts.medium') };
      case 'baja':
        return { color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', label: t('alerts.low') };
    }
  };

  if (alertProducts.length === 0 && urgencyFilter === 'todas') {
    return (
      <div className="p-6 text-center text-slate-500 rounded-xl border border-slate-800/50">
        <CheckCircle size={24} className="mx-auto mb-2" />
        {t('alerts.noAlerts')}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={16} className="text-slate-400" />
        <button
          onClick={() => setUrgencyFilter('todas')}
          className={cn(
            'px-3 py-1 rounded-lg text-xs font-medium transition-all',
            urgencyFilter === 'todas'
              ? 'bg-slate-700 text-slate-200'
              : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
          )}
        >
          {t('common.all')} ({urgencyCounts.critica + urgencyCounts.media + urgencyCounts.baja})
        </button>
        <button
          onClick={() => setUrgencyFilter('critica')}
          className={cn(
            'px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5',
            urgencyFilter === 'critica'
              ? 'bg-red-500/30 text-red-300'
              : 'bg-slate-800/50 text-slate-400 hover:bg-red-500/20'
          )}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
          {t('alerts.critical')} ({urgencyCounts.critica})
        </button>
        <button
          onClick={() => setUrgencyFilter('media')}
          className={cn(
            'px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5',
            urgencyFilter === 'media'
              ? 'bg-amber-500/30 text-amber-300'
              : 'bg-slate-800/50 text-slate-400 hover:bg-amber-500/20'
          )}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          {t('alerts.medium')} ({urgencyCounts.media})
        </button>
        <button
          onClick={() => setUrgencyFilter('baja')}
          className={cn(
            'px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5',
            urgencyFilter === 'baja'
              ? 'bg-yellow-500/30 text-yellow-300'
              : 'bg-slate-800/50 text-slate-400 hover:bg-yellow-500/20'
          )}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
          {t('alerts.low')} ({urgencyCounts.baja})
        </button>
      </div>

      <div className="max-h-[400px] overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-800/50">
        {alertProducts.length === 0 ? (
          <div className="p-4 text-center text-slate-500">
            {t('alerts.noAlertsFilter')}
          </div>
        ) : (
          alertProducts.slice(0, maxItems).map(({ product, prediction, urgency }) => {
            const config = getUrgencyConfig(urgency);
            return (
              <div
                key={product.codigo}
                className={cn(
                  'flex items-center justify-between p-3 rounded-xl border',
                  config.bg,
                  config.border
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn('p-1.5 rounded-lg', config.bg)}>
                    <AlertTriangle size={16} className={config.color} />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{product.descripcion}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      {product.codigo}
                      <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium', config.bg, config.color)}>
                        {config.label}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn('text-sm font-mono', config.color)}>
                    {product.stock} / {product.stockMinimo} min
                  </div>
                  {prediction && prediction.days !== null && prediction.days !== Infinity && (
                    <div className="text-xs text-slate-500">
                      ~{prediction.days} {t('analytics.daysRemaining')}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

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
}

// Category color mapping
const CATEGORY_COLORS: Record<string, string> = {
  'Estación de Servicio': '#3d9a5f',
  'Ferretería': '#4a7fb5',
  'Papelería': '#6b5488',
  'Ediltor': '#c8872e',
  'Otros': '#986080',
};

const FALLBACK_COLORS = ['#3d9a5f', '#4a7fb5', '#6b5488', '#c8872e', '#986080', '#546280', '#3a9280'];

function getCatColor(categoria: string): string {
  return CATEGORY_COLORS[categoria] || FALLBACK_COLORS[Math.abs(categoria.split('').reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0)) % FALLBACK_COLORS.length];
}

export function ConsumptionChart({ movements, products }: ConsumptionChartProps) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<PeriodFilter>('mes');
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

        {/* Period selector */}
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
                          isUp ? 'text-emerald-400' : 'text-red-400',
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
                <div className="text-xl font-bold font-mono text-cyan-400">
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
                <div className="text-xl font-bold font-mono text-violet-400">
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

// ============================================
// AI STATUS INDICATOR
// ============================================

export function AIStatusIndicator() {
  const { t } = useTranslation();
  
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      <span className="text-slate-400">{t('ai.active')}</span>
    </div>
  );
}

export { AnalyticsDashboard } from './AnalyticsDashboard';