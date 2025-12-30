import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Product, Movement, StockPrediction } from '@/types';
import { CategoryBadge } from '@/components/productos';
import { 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Filter,
  BarChart3
} from 'lucide-react';

// ============================================
// CONFIDENCE BAR
// ============================================

interface ConfidenceBarProps {
  confidence: number;
  label?: string;
}

export function ConfidenceBar({ confidence, label = 'Confianza del modelo' }: ConfidenceBarProps) {
  const percentage = Math.round(confidence * 100);

  return (
    <div>
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>{label}</span>
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
  const getTrendConfig = () => {
    switch (prediction.trend) {
      case 'acelerando':
        return { icon: <TrendingUp size={16} />, color: 'text-red-400', label: 'Subiendo' };
      case 'desacelerando':
        return { icon: <TrendingDown size={16} />, color: 'text-emerald-400', label: 'Bajando' };
      default:
        return { icon: <Minus size={16} />, color: 'text-slate-400', label: 'Estable' };
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
          <div className="text-xs text-slate-500 mb-1">Stock Actual</div>
          <div className="font-mono font-semibold text-emerald-400">
            {product.stock}
          </div>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/50">
          <div className="text-xs text-slate-500 mb-1">Días Restantes</div>
          <div className={cn('font-mono font-semibold', getDaysColor())}>
            {prediction.days === null ? '—' : prediction.days === Infinity ? '∞' : prediction.days}
          </div>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/50">
          <div className="text-xs text-slate-500 mb-1">Consumo/Día</div>
          <div className="font-mono font-semibold text-cyan-400">
            {prediction.dailyRate || '—'}
          </div>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/50">
          <div className="text-xs text-slate-500 mb-1">Tendencia</div>
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
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('todas');

  // Classify and filter products with alerts
  const alertProducts = useMemo(() => {
    const classified = products
      .map((p) => {
        const pred = predictions[p.codigo];
        const ratio = p.stock / p.stockMinimo;
        const daysLeft = pred?.days;
        
        // Determine urgency level
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

    // Sort by urgency (critica first, then media, then baja)
    const urgencyOrder = { critica: 0, media: 1, baja: 2 };
    classified.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    // Filter by selected urgency
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
        return { color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30', label: 'Crítica' };
      case 'media':
        return { color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/30', label: 'Media' };
      case 'baja':
        return { color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', label: 'Baja' };
    }
  };

  if (alertProducts.length === 0 && urgencyFilter === 'todas') {
    return (
      <div className="p-6 text-center text-slate-500 rounded-xl border border-slate-800/50">
        <CheckCircle size={24} className="mx-auto mb-2" />
        No hay alertas de stock
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter buttons */}
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
          Todas ({urgencyCounts.critica + urgencyCounts.media + urgencyCounts.baja})
        </button>
        <button
          onClick={() => setUrgencyFilter('critica')}
          className={cn(
            'px-3 py-1 rounded-lg text-xs font-medium transition-all',
            urgencyFilter === 'critica'
              ? 'bg-red-500/30 text-red-300'
              : 'bg-slate-800/50 text-slate-400 hover:bg-red-500/20'
          )}
        >
          🔴 Crítica ({urgencyCounts.critica})
        </button>
        <button
          onClick={() => setUrgencyFilter('media')}
          className={cn(
            'px-3 py-1 rounded-lg text-xs font-medium transition-all',
            urgencyFilter === 'media'
              ? 'bg-amber-500/30 text-amber-300'
              : 'bg-slate-800/50 text-slate-400 hover:bg-amber-500/20'
          )}
        >
          🟠 Media ({urgencyCounts.media})
        </button>
        <button
          onClick={() => setUrgencyFilter('baja')}
          className={cn(
            'px-3 py-1 rounded-lg text-xs font-medium transition-all',
            urgencyFilter === 'baja'
              ? 'bg-yellow-500/30 text-yellow-300'
              : 'bg-slate-800/50 text-slate-400 hover:bg-yellow-500/20'
          )}
        >
          🟡 Baja ({urgencyCounts.baja})
        </button>
      </div>

      {/* Scrollable alert list */}
      <div className="max-h-[400px] overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-800/50">
        {alertProducts.length === 0 ? (
          <div className="p-4 text-center text-slate-500">
            No hay alertas con este filtro
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
                      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', config.bg, config.color)}>
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
                      ~{prediction.days} días restantes
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
// CONSUMPTION CHART (Top products by usage)
// ============================================

type PeriodFilter = 'semana' | 'mes' | 'semestre' | 'año';

interface ConsumptionChartProps {
  movements: Movement[];
  products: Product[];
}

export function ConsumptionChart({ movements, products }: ConsumptionChartProps) {
  const [period, setPeriod] = useState<PeriodFilter>('mes');

  const { chartData, trendLine, maxValue } = useMemo(() => {
    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'semana':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'mes':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'semestre':
        startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case 'año':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
    }

    // Filter movements by period and type (only salidas = consumption)
    const filteredMovements = movements.filter((m) => {
      const movDate = new Date(m.timestamp);
      return movDate >= startDate && m.tipo === 'salida';
    });

    // Aggregate by product
    const productConsumption: Record<string, number> = {};
    filteredMovements.forEach((m) => {
      productConsumption[m.codigo] = (productConsumption[m.codigo] || 0) + m.cantidad;
    });

    // Get top 10 products
    const sorted = Object.entries(productConsumption)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    const data = sorted.map(([codigo, cantidad], index) => {
      const product = products.find((p) => p.codigo === codigo);
      return {
        codigo,
        descripcion: product?.descripcion || codigo,
        cantidad,
        index,
      };
    });

    const max = Math.max(...data.map((d) => d.cantidad), 1);

    // Calculate trend line (linear regression)
    const n = data.length;
    if (n < 2) {
      return { chartData: data, trendLine: null, maxValue: max };
    }

    const sumX = data.reduce((sum, _, i) => sum + i, 0);
    const sumY = data.reduce((sum, d) => sum + d.cantidad, 0);
    const sumXY = data.reduce((sum, d, i) => sum + i * d.cantidad, 0);
    const sumX2 = data.reduce((sum, _, i) => sum + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const trend = {
      start: intercept,
      end: slope * (n - 1) + intercept,
    };

    return { chartData: data, trendLine: trend, maxValue: max };
  }, [movements, products, period]);

  const periodLabels: Record<PeriodFilter, string> = {
    semana: 'Última semana',
    mes: 'Último mes',
    semestre: 'Último semestre',
    año: 'Último año',
  };

  return (
    <div className="space-y-4">
      {/* Header with period selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={20} className="text-cyan-400" />
          <h3 className="font-semibold">Productos Más Consumidos</h3>
          <span className="text-xs text-slate-500">({periodLabels[period]})</span>
        </div>
        <div className="flex gap-1">
          {(['semana', 'mes', 'semestre', 'año'] as PeriodFilter[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-medium transition-all',
                period === p
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
              )}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {chartData.length === 0 ? (
        <div className="p-8 text-center text-slate-500 rounded-xl border border-slate-800/50">
          <BarChart3 size={32} className="mx-auto mb-2 opacity-50" />
          No hay datos de consumo en este período
        </div>
      ) : (
        <div className="relative">
          {/* Bars */}
          <div className="space-y-2">
            {chartData.map((item, index) => {
              const percentage = (item.cantidad / maxValue) * 100;
              const trendPercentage = trendLine
                ? ((trendLine.start + (trendLine.end - trendLine.start) * (index / (chartData.length - 1))) / maxValue) * 100
                : 0;

              return (
                <div key={item.codigo} className="group">
                  <div className="flex items-center gap-3">
                    <div className="w-24 text-xs text-slate-400 truncate" title={item.descripcion}>
                      {item.codigo}
                    </div>
                    <div className="flex-1 relative h-8">
                      {/* Background */}
                      <div className="absolute inset-0 bg-slate-800/50 rounded-lg" />
                      
                      {/* Bar */}
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-lg transition-all duration-500 flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(percentage, 5)}%` }}
                      >
                        <span className="text-xs font-mono font-semibold text-slate-950">
                          {item.cantidad}
                        </span>
                      </div>

                      {/* Trend line marker */}
                      {trendLine && (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-amber-400/60"
                          style={{ left: `${Math.min(Math.max(trendPercentage, 0), 100)}%` }}
                        />
                      )}
                    </div>
                  </div>
                  
                  {/* Tooltip on hover */}
                  <div className="hidden group-hover:block text-xs text-slate-400 pl-28 mt-1">
                    {item.descripcion}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          {trendLine && (
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-800/50">
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 bg-gradient-to-r from-cyan-500 to-emerald-500 rounded" />
                <span className="text-xs text-slate-400">Consumo real</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-amber-400/60" />
                <span className="text-xs text-slate-400">Línea de tendencia</span>
              </div>
              <div className="ml-auto text-xs text-slate-500">
                Tendencia: {trendLine.end > trendLine.start ? (
                  <span className="text-red-400">↗ Consumo en aumento</span>
                ) : trendLine.end < trendLine.start ? (
                  <span className="text-emerald-400">↘ Consumo en descenso</span>
                ) : (
                  <span className="text-slate-400">→ Estable</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// AI STATUS INDICATOR
// ============================================

export function AIStatusIndicator() {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      <span className="text-slate-400">IA Activa</span>
    </div>
  );
}