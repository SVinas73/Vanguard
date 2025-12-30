import React from 'react';
import { cn } from '@/lib/utils';
import { Product, StockPrediction } from '@/types';
import { CategoryBadge } from '@/components/productos';
import { CheckCircle, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

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
          <div className={cn('font-semibold', trend.color)}>
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
// ALERT LIST (Stock alerts with AI predictions)
// ============================================

interface AlertListProps {
  products: Product[];
  predictions: Record<string, StockPrediction>;
  maxItems?: number;
}

export function AlertList({ products, predictions, maxItems = 5 }: AlertListProps) {
  // Filter products with alerts
  const alertProducts = products
    .filter((p) => {
      const pred = predictions[p.codigo];
      return p.stock <= p.stockMinimo || (pred && pred.days !== null && pred.days < 14);
    })
    .slice(0, maxItems);

  if (alertProducts.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500 rounded-xl border border-slate-800/50">
        <CheckCircle size={24} className="mx-auto mb-2" />
        No hay alertas de stock
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alertProducts.map((product) => {
        const pred = predictions[product.codigo];
        return (
          <div
            key={product.codigo}
            className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700/30"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} className="text-amber-400" />
              <div>
                <div className="font-medium text-sm">{product.descripcion}</div>
                <div className="text-xs text-slate-500">{product.codigo}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-mono text-amber-400">
                {product.stock} / {product.stockMinimo} min
              </div>
              {pred && pred.days !== null && pred.days !== Infinity && (
                <div className="text-xs text-slate-500">
                  Agotamiento: ~{pred.days} días ({Math.round(pred.confidence * 100)}% conf.)
                </div>
              )}
            </div>
          </div>
        );
      })}
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
