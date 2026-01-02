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
// CONSUMPTION CHART (Interactive - Click to see details)
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

export function ConsumptionChart({ movements, products }: ConsumptionChartProps) {
  const [period, setPeriod] = useState<PeriodFilter>('mes');
  const [selectedProduct, setSelectedProduct] = useState<ProductDetail | null>(null);
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);

  const { chartData, trendLine, maxValue, startDate } = useMemo(() => {
    const now = new Date();
    let start: Date;
    
    switch (period) {
      case 'semana':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'mes':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'semestre':
        start = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case 'año':
        start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
    }

    const filteredMovements = movements.filter((m) => {
      const movDate = new Date(m.timestamp);
      return movDate >= start && m.tipo === 'salida';
    });

    const productConsumption: Record<string, number> = {};
    filteredMovements.forEach((m) => {
      productConsumption[m.codigo] = (productConsumption[m.codigo] || 0) + m.cantidad;
    });

    const sorted = Object.entries(productConsumption)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    const data = sorted.map(([codigo, cantidad], index) => {
      const product = products.find((p) => p.codigo === codigo);
      return {
        codigo,
        descripcion: product?.descripcion || codigo,
        categoria: product?.categoria || 'Sin categoría',
        cantidad,
        index,
      };
    });

    const max = Math.max(...data.map((d) => d.cantidad), 1);

    const n = data.length;
    if (n < 2) {
      return { chartData: data, trendLine: null, maxValue: max, startDate: start };
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

    return { chartData: data, trendLine: trend, maxValue: max, startDate: start };
  }, [movements, products, period]);

  // Handle bar click - show product details
  const handleBarClick = (codigo: string) => {
    const product = products.find((p) => p.codigo === codigo);
    if (!product) return;

    // Get movements for this product in the period
    const productMovements = movements.filter((m) => {
      const movDate = new Date(m.timestamp);
      return m.codigo === codigo && movDate >= startDate;
    });

    const salidas = productMovements.filter((m) => m.tipo === 'salida');
    const consumoTotal = salidas.reduce((sum, m) => sum + m.cantidad, 0);
    
    // Calculate days in period
    const daysInPeriod = Math.ceil((new Date().getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    const consumoDiario = consumoTotal / daysInPeriod;
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
      movimientos: productMovements.slice(0, 10),
    });
  };

  const periodLabels: Record<PeriodFilter, string> = {
    semana: 'Última semana',
    mes: 'Último mes',
    semestre: 'Último semestre',
    año: 'Último año',
  };

  const periodDays: Record<PeriodFilter, number> = {
    semana: 7,
    mes: 30,
    semestre: 180,
    año: 365,
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
          {/* Instruction */}
          <p className="text-xs text-slate-500 mb-3">
            💡 Click en una barra para ver detalles del producto
          </p>

          {/* Bars */}
          <div className="space-y-2">
            {chartData.map((item, index) => {
              const percentage = (item.cantidad / maxValue) * 100;
              const trendPercentage = trendLine
                ? ((trendLine.start + (trendLine.end - trendLine.start) * (index / (chartData.length - 1))) / maxValue) * 100
                : 0;
              const isHovered = hoveredBar === item.codigo;

              return (
                <div 
                  key={item.codigo} 
                  className="group cursor-pointer"
                  onClick={() => handleBarClick(item.codigo)}
                  onMouseEnter={() => setHoveredBar(item.codigo)}
                  onMouseLeave={() => setHoveredBar(null)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-24 text-xs text-slate-400 truncate" title={item.descripcion}>
                      {item.codigo}
                    </div>
                    <div className="flex-1 relative h-8">
                      {/* Background */}
                      <div className={cn(
                        "absolute inset-0 rounded-lg transition-all",
                        isHovered ? "bg-slate-700/70" : "bg-slate-800/50"
                      )} />
                      
                      {/* Bar */}
                      <div
                        className={cn(
                          "absolute inset-y-0 left-0 rounded-lg transition-all duration-300 flex items-center justify-end pr-2",
                          isHovered 
                            ? "bg-gradient-to-r from-cyan-400 to-emerald-400 shadow-lg shadow-cyan-500/20" 
                            : "bg-gradient-to-r from-cyan-500 to-emerald-500"
                        )}
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

                      {/* Hover tooltip */}
                      {isHovered && (
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-slate-800 rounded-lg shadow-xl border border-slate-700 z-10 whitespace-nowrap">
                          <span className="text-xs text-slate-200">{item.descripcion}</span>
                          <span className="text-xs text-cyan-400 ml-2">({item.categoria})</span>
                        </div>
                      )}
                    </div>
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

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setSelectedProduct(null)}
        >
          <div 
            className="bg-slate-900 rounded-2xl border border-slate-800 p-6 max-w-lg w-full mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-100">{selectedProduct.descripcion}</h3>
                <p className="text-sm text-slate-500">{selectedProduct.codigo} • {selectedProduct.categoria}</p>
              </div>
              <button 
                onClick={() => setSelectedProduct(null)}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <span className="text-slate-400 text-xl">×</span>
              </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/30">
                <div className="text-xs text-slate-500 mb-1">Stock Actual</div>
                <div className={cn(
                  "text-xl font-bold font-mono",
                  selectedProduct.stock <= selectedProduct.stockMinimo ? "text-red-400" : "text-emerald-400"
                )}>
                  {selectedProduct.stock}
                </div>
                <div className="text-xs text-slate-500">Mínimo: {selectedProduct.stockMinimo}</div>
              </div>
              
              <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/30">
                <div className="text-xs text-slate-500 mb-1">Consumo ({periodLabels[period]})</div>
                <div className="text-xl font-bold font-mono text-cyan-400">
                  {selectedProduct.consumoTotal}
                </div>
                <div className="text-xs text-slate-500">{selectedProduct.consumoDiario}/día promedio</div>
              </div>
              
              <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/30">
                <div className="text-xs text-slate-500 mb-1">Días Restantes</div>
                <div className={cn(
                  "text-xl font-bold font-mono",
                  selectedProduct.diasRestantes === null ? "text-slate-400" :
                  selectedProduct.diasRestantes < 7 ? "text-red-400" :
                  selectedProduct.diasRestantes < 14 ? "text-amber-400" : "text-emerald-400"
                )}>
                  {selectedProduct.diasRestantes ?? '∞'}
                </div>
                <div className="text-xs text-slate-500">Estimado al ritmo actual</div>
              </div>
              
              <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/30">
                <div className="text-xs text-slate-500 mb-1">Precio Venta</div>
                <div className="text-xl font-bold font-mono text-purple-400">
                  ${selectedProduct.precio.toLocaleString('es-UY')}
                </div>
                <div className="text-xs text-slate-500">Por unidad</div>
              </div>
            </div>

            {/* Recent movements */}
            <div>
              <h4 className="text-sm font-semibold text-slate-400 mb-2">Últimos Movimientos</h4>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {selectedProduct.movimientos.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No hay movimientos en este período</p>
                ) : (
                  selectedProduct.movimientos.map((mov, i) => (
                    <div 
                      key={i}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded font-medium",
                          mov.tipo === 'entrada' 
                            ? "bg-emerald-500/20 text-emerald-400" 
                            : "bg-orange-500/20 text-orange-400"
                        )}>
                          {mov.tipo === 'entrada' ? '↓ Entrada' : '↑ Salida'}
                        </span>
                        <span className="text-slate-400">
                          {new Date(mov.timestamp).toLocaleDateString('es-UY')}
                        </span>
                      </div>
                      <span className="font-mono font-semibold text-slate-200">
                        {mov.tipo === 'entrada' ? '+' : '-'}{mov.cantidad}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={() => setSelectedProduct(null)}
              className="w-full mt-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
            >
              Cerrar
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
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      <span className="text-slate-400">IA Activa</span>
    </div>
  );
}