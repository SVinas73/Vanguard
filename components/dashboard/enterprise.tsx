'use client';

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';
import { Product, Movement, StockPrediction } from '@/types';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  AlertTriangle,
  Clock,
  Package,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Filter
} from 'lucide-react';

// ============================================
// INVENTORY VALUE CARD
// ============================================

interface InventoryValueCardProps {
  products: Product[];
  movements: Movement[];
  onCategoryClick?: (category: string) => void;
}

export function InventoryValueCard({ products, movements, onCategoryClick }: InventoryValueCardProps) {
  const { t } = useTranslation();

  const { 
    totalValue, 
    previousValue, 
    trend, 
    trendPercent,
    categoryBreakdown,
    slowMoversValue,
    slowMoversCount
  } = useMemo(() => {
    const total = products.reduce((sum, p) => sum + (p.precio * p.stock), 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let valueChange = 0;
    movements
      .filter(m => new Date(m.timestamp) >= thirtyDaysAgo)
      .forEach(m => {
        const product = products.find(p => p.codigo === m.codigo);
        if (product) {
          if (m.tipo === 'entrada') {
            valueChange += m.cantidad * product.precio;
          } else {
            valueChange -= m.cantidad * product.precio;
          }
        }
      });

    const previous = total - valueChange;
    const trendValue = previous > 0 ? ((total - previous) / previous) * 100 : 0;

    const byCategory: Record<string, { value: number; count: number }> = {};
    products.forEach(p => {
      const cat = p.categoria || t('common.noCategory', 'Sin categoría');
      if (!byCategory[cat]) {
        byCategory[cat] = { value: 0, count: 0 };
      }
      byCategory[cat].value += p.precio * p.stock;
      byCategory[cat].count += 1;
    });

    const breakdown = Object.entries(byCategory)
      .map(([name, data]) => ({
        name,
        value: data.value,
        count: data.count,
        percent: total > 0 ? (data.value / total) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    const recentlyMoved = new Set(
      movements
        .filter(m => new Date(m.timestamp) >= sixtyDaysAgo)
        .map(m => m.codigo)
    );

    const slowMovers = products.filter(p => 
      p.stock > 0 && !recentlyMoved.has(p.codigo)
    );
    const slowValue = slowMovers.reduce((sum, p) => sum + (p.precio * p.stock), 0);

    return {
      totalValue: total,
      previousValue: previous,
      trend: trendValue >= 0 ? 'up' : 'down',
      trendPercent: Math.abs(trendValue).toFixed(1),
      categoryBreakdown: breakdown,
      slowMoversValue: slowValue,
      slowMoversCount: slowMovers.length
    };
  }, [products, movements, t]);

  const categoryColors = [
    'from-emerald-500 to-emerald-400',
    'from-cyan-500 to-cyan-400',
    'from-purple-500 to-purple-400',
    'from-amber-500 to-amber-400',
    'from-pink-500 to-pink-400',
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/80 backdrop-blur-sm">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-cyan-500/5" />
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl" />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20">
              <DollarSign size={20} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-200">{t('dashboard.inventoryValue', 'Valor del Inventario')}</h3>
              <p className="text-xs text-slate-500">{t('dashboard.capitalInStock', 'Capital en stock')}</p>
            </div>
          </div>
          
          {/* Trend badge */}
          <div className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium',
            trend === 'up' 
              ? 'bg-emerald-500/20 text-emerald-400' 
              : 'bg-red-500/20 text-red-400'
          )}>
            {trend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>{trend === 'up' ? '+' : '-'}{trendPercent}%</span>
          </div>
        </div>

        {/* Main value */}
        <div className="mb-5">
          <div className="text-3xl font-bold text-white tracking-tight mb-1">
            {formatCurrency(totalValue)}
          </div>
          <div className="text-xs text-slate-500">
            {t('dashboard.vs30DaysAgo', 'vs hace 30 días')}: {formatCurrency(previousValue)}
          </div>
        </div>

        {/* Category breakdown */}
        <div className="mb-4">
          <div className="text-xs text-slate-400 mb-2">{t('dashboard.byCategory', 'Por categoría')}</div>
          
          {/* Stacked bar */}
          <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden flex mb-3">
            {categoryBreakdown.map((cat, i) => (
              <div
                key={cat.name}
                className={cn(
                  'h-full transition-all cursor-pointer hover:opacity-80',
                  `bg-gradient-to-r ${categoryColors[i % categoryColors.length]}`
                )}
                style={{ width: `${cat.percent}%` }}
                onClick={() => onCategoryClick?.(cat.name)}
                title={`${cat.name}: ${formatCurrency(cat.value)}`}
              />
            ))}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {categoryBreakdown.slice(0, 4).map((cat, i) => (
              <div 
                key={cat.name} 
                className="flex items-center justify-between text-xs cursor-pointer hover:bg-slate-800/50 rounded px-1 py-0.5 transition-colors"
                onClick={() => onCategoryClick?.(cat.name)}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <div className={cn(
                    'w-2 h-2 rounded-full bg-gradient-to-r',
                    categoryColors[i % categoryColors.length]
                  )} />
                  <span className="text-slate-400 truncate">{cat.name}</span>
                </div>
                <span className="text-slate-500 ml-2">{cat.percent.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Slow movers warning */}
        {slowMoversValue > 0 && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-medium mb-1">
              <Clock size={14} />
              {t('dashboard.slowMovers', 'Capital inmovilizado')}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-amber-300">
                {formatCurrency(slowMoversValue)}
              </span>
              <span className="text-xs text-amber-400/70">
                {slowMoversCount} {t('dashboard.productsNoMovement', 'productos sin movimiento (60d)')}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// STOCK ALERTS PANEL (reemplaza Riesgo de Quiebre)
// ============================================

type AlertFilter = 'all' | 'critical' | 'warning' | 'low';

interface StockAlertsPanelProps {
  products: Product[];
  predictions: Record<string, StockPrediction>;
  onProductClick?: (product: Product) => void;
  onCreatePurchaseOrder?: (products: Product[]) => void;
}

export function StockAlertsPanel({ 
  products, 
  predictions, 
  onProductClick,
  onCreatePurchaseOrder
}: StockAlertsPanelProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<AlertFilter>('all');
  const [isExpanded, setIsExpanded] = useState(false);

  const { alertProducts, counts } = useMemo(() => {
    const alerts = products
      .map(product => {
        const pred = predictions[product.codigo];
        const daysLeft = pred?.days;
        const ratio = product.stockMinimo > 0 ? product.stock / product.stockMinimo : 999;
        
        let riskLevel: 'critical' | 'warning' | 'low' | 'none' = 'none';
        let urgencyScore = 0;

        // Crítico: sin stock o menos de 3 días
        if (product.stock === 0) {
          riskLevel = 'critical';
          urgencyScore = 100;
        } else if (daysLeft !== null && daysLeft !== undefined && daysLeft !== Infinity && daysLeft <= 3) {
          riskLevel = 'critical';
          urgencyScore = 90 - daysLeft * 10;
        }
        // Advertencia: bajo stock mínimo o menos de 7 días
        else if (ratio < 1 || (daysLeft !== null && daysLeft !== undefined && daysLeft !== Infinity && daysLeft <= 7)) {
          riskLevel = 'warning';
          urgencyScore = 60 - (daysLeft || 7) * 5;
        }
        // Bajo: cerca del mínimo o menos de 14 días
        else if (ratio < 1.5 || (daysLeft !== null && daysLeft !== undefined && daysLeft !== Infinity && daysLeft <= 14)) {
          riskLevel = 'low';
          urgencyScore = 30;
        }

        if (riskLevel === 'none') return null;

        return {
          product,
          prediction: pred,
          daysLeft: daysLeft ?? null,
          riskLevel,
          urgencyScore
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.urgencyScore - a.urgencyScore);

    const criticalCount = alerts.filter(a => a.riskLevel === 'critical').length;
    const warningCount = alerts.filter(a => a.riskLevel === 'warning').length;
    const lowCount = alerts.filter(a => a.riskLevel === 'low').length;

    return {
      alertProducts: alerts,
      counts: {
        all: alerts.length,
        critical: criticalCount,
        warning: warningCount,
        low: lowCount
      }
    };
  }, [products, predictions]);

  const filteredAlerts = useMemo(() => {
    if (filter === 'all') return alertProducts;
    return alertProducts.filter(a => a.riskLevel === filter);
  }, [alertProducts, filter]);

  const displayedAlerts = isExpanded ? filteredAlerts : filteredAlerts.slice(0, 5);
  const hasMore = filteredAlerts.length > 5;

  const getRiskConfig = (level: 'critical' | 'warning' | 'low') => {
    switch (level) {
      case 'critical':
        return {
          bg: 'bg-red-500/10',
          border: 'border-red-500/30',
          text: 'text-red-400',
          icon: <XCircle size={14} className="text-red-400 flex-shrink-0" />
        };
      case 'warning':
        return {
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/30',
          text: 'text-amber-400',
          icon: <AlertCircle size={14} className="text-amber-400 flex-shrink-0" />
        };
      case 'low':
        return {
          bg: 'bg-yellow-500/10',
          border: 'border-yellow-500/30',
          text: 'text-yellow-400',
          icon: <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0" />
        };
    }
  };

  if (alertProducts.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/80 backdrop-blur-sm p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/20">
            <Package size={20} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-200">{t('dashboard.stockAlerts', 'Alertas de Stock')}</h3>
            <p className="text-xs text-slate-500">{t('dashboard.inventoryStatus', 'Estado del inventario')}</p>
          </div>
        </div>
        
        <div className="text-center py-6">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
            <CheckCircle size={24} className="text-emerald-400" />
          </div>
          <p className="text-sm text-emerald-400 font-medium">
            {t('dashboard.noAlerts', 'Sin alertas')}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {t('dashboard.allProductsOk', 'Todos los productos están en niveles óptimos')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/80 backdrop-blur-sm">
      <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-transparent to-amber-500/5" />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-500/20">
              <AlertTriangle size={20} className="text-red-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-200">{t('dashboard.stockAlerts', 'Alertas de Stock')}</h3>
              <p className="text-xs text-slate-500">{t('dashboard.inventoryStatus', 'Estado del inventario')}</p>
            </div>
          </div>

          {/* Total count */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/50 text-slate-300 text-xs font-medium">
            <Filter size={12} />
            {counts.all}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mb-4 p-1 bg-slate-800/50 rounded-lg">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all',
              filter === 'all'
                ? 'bg-slate-700 text-slate-200'
                : 'text-slate-400 hover:text-slate-300'
            )}
          >
            {t('common.all', 'Todas')} ({counts.all})
          </button>
          <button
            onClick={() => setFilter('critical')}
            className={cn(
              'flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1',
              filter === 'critical'
                ? 'bg-red-500/20 text-red-300'
                : 'text-slate-400 hover:text-red-400'
            )}
          >
            <XCircle size={12} />
            {counts.critical}
          </button>
          <button
            onClick={() => setFilter('warning')}
            className={cn(
              'flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1',
              filter === 'warning'
                ? 'bg-amber-500/20 text-amber-300'
                : 'text-slate-400 hover:text-amber-400'
            )}
          >
            <AlertCircle size={12} />
            {counts.warning}
          </button>
          <button
            onClick={() => setFilter('low')}
            className={cn(
              'flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1',
              filter === 'low'
                ? 'bg-yellow-500/20 text-yellow-300'
                : 'text-slate-400 hover:text-yellow-400'
            )}
          >
            <AlertTriangle size={12} />
            {counts.low}
          </button>
        </div>

        {/* Alerts list */}
        <div className={cn(
          'space-y-2 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700',
          isExpanded ? 'max-h-[320px]' : 'max-h-[200px]'
        )}>
          {displayedAlerts.length === 0 ? (
            <div className="text-center py-4 text-slate-500 text-sm">
              {t('dashboard.noAlertsInCategory', 'Sin alertas en esta categoría')}
            </div>
          ) : (
            displayedAlerts.map(({ product, daysLeft, riskLevel }) => {
              const config = getRiskConfig(riskLevel);
              
              return (
                <div
                  key={product.codigo}
                  onClick={() => onProductClick?.(product)}
                  className={cn(
                    'flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all hover:scale-[1.01]',
                    config.bg,
                    config.border
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {config.icon}
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-slate-200 truncate">
                        {product.descripcion}
                      </div>
                      <div className="text-xs text-slate-500">
                        {product.codigo} · <span className={config.text}>
                          {product.stock === 0 
                            ? t('dashboard.outOfStock', 'Sin stock')
                            : `${product.stock} / ${product.stockMinimo} min`
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right flex-shrink-0 ml-2">
                    {daysLeft !== null && daysLeft !== Infinity && (
                      <div className={cn('text-xs font-mono font-semibold', config.text)}>
                        {daysLeft === 0 ? t('dashboard.today', 'Hoy') : `${daysLeft}d`}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Ver más / Ver menos */}
        {hasMore && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full mt-3 flex items-center justify-center gap-1 py-2 text-xs text-slate-400 hover:text-slate-300 transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronUp size={14} />
                {t('common.showLess', 'Ver menos')}
              </>
            ) : (
              <>
                <ChevronDown size={14} />
                {t('common.showMore', 'Ver más')} ({filteredAlerts.length - 5} {t('common.more', 'más')})
              </>
            )}
          </button>
        )}

        {/* Action button */}
        {onCreatePurchaseOrder && counts.critical > 0 && (
          <button
            onClick={() => onCreatePurchaseOrder(alertProducts.filter(a => a.riskLevel === 'critical').map(a => a.product))}
            className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-medium hover:from-emerald-500/30 hover:to-cyan-500/30 transition-all"
          >
            <Package size={16} />
            {t('dashboard.createPurchaseOrder', 'Crear orden de compra')}
            <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================
// RECENT ACTIVITY PANEL
// ============================================

interface RecentActivityPanelProps {
  movements: Movement[];
  products: Product[];
  maxItems?: number;
}

export function RecentActivityPanel({ movements, products, maxItems = 10 }: RecentActivityPanelProps) {
  const { t } = useTranslation();

  const recentMovements = useMemo(() => {
    return [...movements]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, maxItems)
      .map(mov => {
        const product = products.find(p => p.codigo === mov.codigo);
        return { ...mov, product };
      });
  }, [movements, products, maxItems]);

  const formatRelativeTime = (date: Date | string) => {
    const now = new Date();
    const d = typeof date === 'string' ? new Date(date) : date;
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('time.justNow', 'Ahora');
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return d.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' });
  };

  if (recentMovements.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800/50 bg-slate-900/80 backdrop-blur-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-purple-500/20">
            <Clock size={20} className="text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-200">{t('dashboard.recentActivity', 'Actividad Reciente')}</h3>
            <p className="text-xs text-slate-500">{t('dashboard.latestMovements', 'Últimos movimientos')}</p>
          </div>
        </div>
        
        <div className="text-center py-6 text-slate-500 text-sm">
          {t('dashboard.noRecentActivity', 'Sin actividad reciente')}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800/50 bg-slate-900/80 backdrop-blur-sm p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 rounded-xl bg-purple-500/20">
          <Clock size={20} className="text-purple-400" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-200">{t('dashboard.recentActivity', 'Actividad Reciente')}</h3>
          <p className="text-xs text-slate-500">{t('dashboard.latestMovements', 'Últimos movimientos')}</p>
        </div>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700">
        {recentMovements.map((mov, idx) => (
          <div 
            key={mov.id || idx}
            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/30 border border-slate-700/30"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0',
                mov.tipo === 'entrada' 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : 'bg-orange-500/20 text-orange-400'
              )}>
                {mov.tipo === 'entrada' ? '+' : '-'}{mov.cantidad}
              </div>
              <div className="min-w-0">
                <div className="text-sm text-slate-200 truncate">
                  {mov.product?.descripcion || mov.codigo}
                </div>
                <div className="text-xs text-slate-500">
                  {mov.usuario?.split('@')[0] || 'Sistema'}
                </div>
              </div>
            </div>
            <div className="text-xs text-slate-500 flex-shrink-0 ml-2">
              {formatRelativeTime(mov.timestamp)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}