'use client';

import React, { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, TrendingUp, AlertTriangle, ArrowLeftRight, RefreshCw } from 'lucide-react';
import dynamic from 'next/dynamic';

import { Product, Movement, StockPrediction } from '@/types';
import { formatNumber } from '@/lib/utils';
import { WelcomeHeader, StatsGrid, InsightsPanel, InventoryTrendChart, PeriodSelector } from '@/components/dashboard';
import { InventoryValueCard } from '@/components/dashboard/enterprise';
import { ConsumptionChart } from '@/components/analytics';

// Loader compartido para los paneles de IA (lazy-load, igual que en page.tsx)
const ModuleLoader = () => (
  <div className="flex items-center justify-center p-12 text-slate-500 text-sm gap-2">
    <RefreshCw className="h-4 w-4 animate-spin" />
    Cargando módulo...
  </div>
);

const AIPredictionsPanel  = dynamic(() => import('@/components/ai').then(m => ({ default: m.AIPredictionsPanel })),  { loading: ModuleLoader });
const AIAnomaliesPanel    = dynamic(() => import('@/components/ai').then(m => ({ default: m.AIAnomaliesPanel })),    { loading: ModuleLoader });
const AIAssociationsPanel = dynamic(() => import('@/components/ai').then(m => ({ default: m.AIAssociationsPanel })), { loading: ModuleLoader });

export interface DashboardViewProps {
  products: Product[];
  movements: Movement[];
  predictions: Record<string, StockPrediction>;
  userName?: string;
  /** Período del dashboard: '7d' | '30d' | '90d' | '1a' */
  period: string;
  onPeriodChange: (p: string) => void;
  onNavigate: (tab: string) => void;
  onRefresh: () => void;
  /** Click en una categoría del card de Valor de Inventario. Por defecto usa onNavigate. */
  onCategoryClick?: (category: string) => void;
  /** Contenido adicional a la derecha del header (ej: selector de almacén). */
  headerRight?: ReactNode;
  /**
   * Fuente del gráfico de flujo. 'orders' (default) usa compras vs ventas.
   * 'movements' usa entradas vs salidas de stock — útil para inventarios que
   * no se venden (ej: insumos).
   */
  flowSource?: 'orders' | 'movements';
}

export function DashboardView({
  products,
  movements,
  predictions,
  userName,
  period,
  onPeriodChange,
  onNavigate,
  onRefresh,
  onCategoryClick,
  headerRight,
  flowSource = 'orders',
}: DashboardViewProps) {
  const { t } = useTranslation();
  const esMovimientos = flowSource === 'movements';

  // Período → días / etiqueta (misma lógica que vivía en page.tsx)
  const periodDays = period === '7d' ? 7
    : period === '90d' ? 90
    : period === '1a' ? 365
    : 30;
  const periodLabel = period === '7d' ? '7 días'
    : period === '90d' ? '90 días'
    : period === '1a' ? '1 año'
    : '30 días';

  // KPIs principales — réplica exacta del useMemo `stats` original.
  // Acá `products`/`movements` ya vienen filtrados por el padre, así que
  // no se vuelve a filtrar por almacén (equivale al caso "almacén concreto").
  const stats = useMemo(() => {
    const activeProducts = products.length;

    // Stock bajo = stock > 0 AND ≤ minimo (separar de agotados)
    const stockBajoSinAgotados = products.filter(p => p.stock > 0 && p.stockMinimo > 0 && p.stock <= p.stockMinimo).length;
    const agotados = products.filter(p => p.stock === 0).length;

    // Ventanas según el período del dashboard
    const now = Date.now();
    const periodStart = new Date(now - periodDays * 86400000);
    const prevPeriodStart = new Date(now - periodDays * 2 * 86400000);

    const movementsInPeriod = movements.filter(
      (m) => new Date(m.timestamp) >= periodStart
    );
    const movementsInPrevPeriod = movements.filter(
      (m) => {
        const t = new Date(m.timestamp);
        return t >= prevPeriodStart && t < periodStart;
      }
    );

    // ROTACIÓN — días de inventario reales en la ventana seleccionada.
    const salesInPeriod = movementsInPeriod.filter(m => m.tipo === 'salida');

    let avgRotation = 0;
    let dailyAvgSales = 0;
    if (salesInPeriod.length > 0) {
      const oldest = salesInPeriod.reduce((min, m) => {
        const ts = new Date(m.timestamp).getTime();
        return ts < min ? ts : min;
      }, now);
      const daysSpan = Math.max(1, Math.min(periodDays, Math.ceil((now - oldest) / 86400000)));
      const totalSales = salesInPeriod.reduce((sum, m) => sum + m.cantidad, 0);
      dailyAvgSales = totalSales / daysSpan;
      const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
      avgRotation = dailyAvgSales > 0 ? Math.round(totalStock / dailyAvgSales) : 0;
    }

    // Trend: movimientos en período vs período anterior
    const movsCount = movementsInPeriod.length;
    const prevMovsCount = movementsInPrevPeriod.length;
    const movementTrend = prevMovsCount > 0
      ? { value: Math.round(((movsCount - prevMovsCount) / prevMovsCount) * 100), label: `vs ${periodLabel} ant.` }
      : undefined;

    return [
      {
        label: t('dashboard.activeProducts', 'Productos Activos'),
        value: formatNumber(activeProducts),
        icon: <Package size={24} />,
        color: 'emerald',
        subtitle: 'SKUs en este almacén',
      },
      {
        label: t('dashboard.avgRotation', 'Rotación Promedio'),
        value: avgRotation > 0 ? `${avgRotation}d` : '—',
        icon: <TrendingUp size={24} />,
        color: 'cyan',
        subtitle: dailyAvgSales > 0
          ? `${dailyAvgSales.toFixed(1)} unid/día (${periodLabel})`
          : (esMovimientos ? `Sin consumo en ${periodLabel}` : `Sin ventas en ${periodLabel}`),
      },
      {
        label: t('dashboard.lowStock', 'Stock Bajo'),
        value: stockBajoSinAgotados.toString(),
        icon: <AlertTriangle size={24} />,
        color: stockBajoSinAgotados > 0 ? 'amber' : 'slate',
        subtitle: agotados > 0 ? `+ ${agotados} agotados` : 'Sin agotados',
      },
      {
        label: `Movimientos · ${periodLabel}`,
        value: movsCount.toString(),
        icon: <ArrowLeftRight size={24} />,
        color: 'purple',
        trend: movementTrend,
      },
    ];
  }, [products, movements, t, periodDays, periodLabel, esMovimientos]);

  return (
    <div className="space-y-5">
      {/* Header: saludo + (headerRight) + período + refresh */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <WelcomeHeader
            userName={userName}
            products={products}
            predictions={predictions}
          />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 pt-1">
          {headerRight}
          <PeriodSelector value={period} onChange={onPeriodChange} />
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
            title="Actualizar"
          >
            <RefreshCw size={14} className="text-slate-400 hover:text-slate-200 transition-colors" />
          </button>
        </div>
      </div>

      {/* KPIs principales */}
      <StatsGrid stats={stats} products={products} movements={movements} />

      {/* Valor del Inventario (con desglose por almacén) */}
      <InventoryValueCard
        products={products}
        movements={movements}
        periodDays={periodDays}
        periodLabel={periodLabel}
        onCategoryClick={(category: string) => {
          if (onCategoryClick) onCategoryClick(category);
          else onNavigate(category);
        }}
      />

      {/* Flujo de inventario */}
      <InventoryTrendChart
        movements={movements}
        products={products}
        days={periodDays}
        flowSource={flowSource}
      />

      {/* Top consumidos + Insights — lado a lado (60/40) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 rounded-xl p-6 bg-slate-900/40 border border-slate-800">
          <ConsumptionChart
            movements={movements}
            products={products}
            fixedPeriod={period as '7d' | '30d' | '90d' | '1a'}
          />
        </div>
        <div className="lg:col-span-2">
          <InsightsPanel
            products={products}
            movements={movements}
            predictions={predictions}
            onNavigate={onNavigate}
            flowSource={flowSource}
          />
        </div>
      </div>

      {/* Paneles de IA — predicciones, anomalías, asociaciones */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* En modo 'movements' (Análisis de Insumos) los datos ya vienen
            filtrados por almacén → los paneles usan SOLO cálculo local para no
            mezclar con datos globales del backend. */}
        <AIPredictionsPanel products={products} movements={movements} predictions={predictions} onRefresh={onRefresh} localOnly={esMovimientos} />
        <AIAnomaliesPanel products={products} movements={movements} onRefresh={onRefresh} localOnly={esMovimientos} />
        <AIAssociationsPanel products={products} movements={movements} onRefresh={onRefresh} localOnly={esMovimientos} />
      </div>
    </div>
  );
}

export default DashboardView;
