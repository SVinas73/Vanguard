'use client';

import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Product, Movement, StockPrediction } from '@/types';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';
import { Card } from '@/components/ui';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Package,
  AlertTriangle,
  DollarSign,
  BarChart3,
  PieChart as PieChartIcon,
  Zap,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Lightbulb,
  Target,
  Activity,
  Layers,
  RefreshCw,
  Download,
  Filter,
  Calendar,
  ChevronRight,
  Sparkles,
  ShoppingCart,
  Boxes,
  AlertCircle,
  CheckCircle,
  Info,
} from 'lucide-react';

// ============================================
// TIPOS
// ============================================

interface AnalyticsDashboardProps {
  products: Product[];
  movements: Movement[];
  predictions: Record<string, StockPrediction>;
}

type TabType = 'overview' | 'predictions' | 'abc' | 'trends' | 'insights';
type PeriodType = 'week' | 'month' | 'quarter' | 'year';

interface ABCProduct extends Product {
  totalValue: number;
  totalMovements: number;
  classification: 'A' | 'B' | 'C';
  percentageValue: number;
  cumulativePercentage: number;
}

interface Insight {
  id: string;
  type: 'warning' | 'success' | 'info' | 'action';
  title: string;
  description: string;
  metric?: string;
  action?: string;
  priority: number;
}

// ============================================
// COLORES
// ============================================

const COLORS = {
  primary: '#10b981',
  secondary: '#06b6d4',
  accent: '#8b5cf6',
  warning: '#f59e0b',
  danger: '#ef4444',
  success: '#22c55e',
  muted: '#64748b',
  chart: ['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'],
};

const ABC_COLORS = {
  A: '#10b981',
  B: '#f59e0b', 
  C: '#64748b',
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export function AnalyticsDashboard({ products, movements, predictions }: AnalyticsDashboardProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [period, setPeriod] = useState<PeriodType>('month');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // ============================================
  // CÁLCULOS Y MÉTRICAS
  // ============================================

  // Filtrar movimientos por período
  const filteredMovements = useMemo(() => {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
    }

    return movements.filter(m => new Date(m.timestamp) >= startDate);
  }, [movements, period]);

  // KPIs principales
  const kpis = useMemo(() => {
    const totalProducts = products.length;
    const totalValue = products.reduce((sum, p) => sum + (p.stock * p.precio), 0);
    const avgCost = products.reduce((sum, p) => sum + (p.costoPromedio || 0), 0) / totalProducts || 0;
    
    const productsAtRisk = products.filter(p => {
      const pred = predictions[p.codigo];
      return p.stock <= p.stockMinimo || (pred && pred.days !== null && pred.days < 14 && pred.days !== Infinity);
    }).length;

    const totalSalidas = filteredMovements
      .filter(m => m.tipo === 'salida')
      .reduce((sum, m) => sum + m.cantidad, 0);

    const totalEntradas = filteredMovements
      .filter(m => m.tipo === 'entrada')
      .reduce((sum, m) => sum + m.cantidad, 0);

    // Calcular rotación (días de inventario)
    const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
    const daysInPeriod = period === 'week' ? 7 : period === 'month' ? 30 : period === 'quarter' ? 90 : 365;
    const dailyAvgSales = totalSalidas / daysInPeriod;
    const rotationDays = dailyAvgSales > 0 ? Math.round(totalStock / dailyAvgSales) : 0;

    // Productos sin movimiento
    const productCodes = new Set(filteredMovements.map(m => m.codigo));
    const productsNoMovement = products.filter(p => !productCodes.has(p.codigo)).length;

    return {
      totalProducts,
      totalValue,
      avgCost,
      productsAtRisk,
      totalSalidas,
      totalEntradas,
      rotationDays,
      productsNoMovement,
      movementsCount: filteredMovements.length,
    };
  }, [products, predictions, filteredMovements, period]);

  // Análisis ABC
  const abcAnalysis = useMemo(() => {
    // Calcular valor total de movimientos por producto
    const productValues = products.map(p => {
      const productMovements = filteredMovements.filter(m => m.codigo === p.codigo);
      const totalMovements = productMovements.length;
      const totalValue = productMovements
        .filter(m => m.tipo === 'salida')
        .reduce((sum, m) => sum + (m.cantidad * p.precio), 0);

      return {
        ...p,
        totalValue,
        totalMovements,
      };
    });

    // Ordenar por valor descendente
    const sorted = productValues.sort((a, b) => b.totalValue - a.totalValue);
    const totalValue = sorted.reduce((sum, p) => sum + p.totalValue, 0);

    // Clasificar ABC
    let cumulative = 0;
    const classified: ABCProduct[] = sorted.map(p => {
      cumulative += p.totalValue;
      const cumulativePercentage = totalValue > 0 ? (cumulative / totalValue) * 100 : 0;
      const percentageValue = totalValue > 0 ? (p.totalValue / totalValue) * 100 : 0;

      let classification: 'A' | 'B' | 'C';
      if (cumulativePercentage <= 80) {
        classification = 'A';
      } else if (cumulativePercentage <= 95) {
        classification = 'B';
      } else {
        classification = 'C';
      }

      return {
        ...p,
        classification,
        percentageValue,
        cumulativePercentage,
      };
    });

    const summary = {
      A: classified.filter(p => p.classification === 'A'),
      B: classified.filter(p => p.classification === 'B'),
      C: classified.filter(p => p.classification === 'C'),
    };

    return { classified, summary, totalValue };
  }, [products, filteredMovements]);

  // Datos para gráfico de tendencias
  const trendData = useMemo(() => {
    const days = period === 'week' ? 7 : period === 'month' ? 30 : period === 'quarter' ? 90 : 365;
    const groupBy = period === 'week' ? 1 : period === 'month' ? 1 : period === 'quarter' ? 7 : 30;
    
    const data: { date: string; entradas: number; salidas: number; neto: number }[] = [];
    const now = new Date();

    for (let i = days; i >= 0; i -= groupBy) {
      const startDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const endDate = new Date(now.getTime() - (i - groupBy) * 24 * 60 * 60 * 1000);

      const periodMovements = movements.filter(m => {
        const date = new Date(m.timestamp);
        return date >= startDate && date < endDate;
      });

      const entradas = periodMovements
        .filter(m => m.tipo === 'entrada')
        .reduce((sum, m) => sum + m.cantidad, 0);

      const salidas = periodMovements
        .filter(m => m.tipo === 'salida')
        .reduce((sum, m) => sum + m.cantidad, 0);

      data.push({
        date: startDate.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
        entradas,
        salidas,
        neto: entradas - salidas,
      });
    }

    return data;
  }, [movements, period]);

  // Datos por categoría
  const categoryData = useMemo(() => {
    const categories: Record<string, { value: number; stock: number; products: number }> = {};

    products.forEach(p => {
      if (!categories[p.categoria]) {
        categories[p.categoria] = { value: 0, stock: 0, products: 0 };
      }
      categories[p.categoria].value += p.stock * p.precio;
      categories[p.categoria].stock += p.stock;
      categories[p.categoria].products += 1;
    });

    return Object.entries(categories)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.value - a.value);
  }, [products]);

  // Insights automáticos
  const insights = useMemo(() => {
    const insightsList: Insight[] = [];

    // Productos en riesgo crítico (se agotan en menos de 7 días)
    const criticalProducts = products.filter(p => {
      const pred = predictions[p.codigo];
      return pred && pred.days !== null && pred.days < 7 && pred.days !== Infinity;
    });

    if (criticalProducts.length > 0) {
      insightsList.push({
        id: 'critical-stock',
        type: 'warning',
        title: `${criticalProducts.length} productos en riesgo crítico`,
        description: `Se agotarán en menos de 7 días: ${criticalProducts.slice(0, 3).map(p => p.descripcion).join(', ')}${criticalProducts.length > 3 ? '...' : ''}`,
        metric: `${criticalProducts.length} productos`,
        action: 'Generar orden de compra',
        priority: 1,
      });
    }

    // Productos sin stock
    const outOfStock = products.filter(p => p.stock === 0);
    if (outOfStock.length > 0) {
      insightsList.push({
        id: 'out-of-stock',
        type: 'warning',
        title: `${outOfStock.length} productos sin stock`,
        description: `Productos agotados que requieren reposición inmediata`,
        metric: `${outOfStock.length} productos`,
        action: 'Ver productos',
        priority: 2,
      });
    }

    // Categoría con mayor crecimiento
    const categoryGrowth = categoryData.map(cat => {
      const categoryMovements = filteredMovements.filter(m => {
        const product = products.find(p => p.codigo === m.codigo);
        return product?.categoria === cat.name;
      });
      const salidas = categoryMovements.filter(m => m.tipo === 'salida').reduce((sum, m) => sum + m.cantidad, 0);
      return { ...cat, salidas };
    }).sort((a, b) => b.salidas - a.salidas);

    if (categoryGrowth.length > 0 && categoryGrowth[0].salidas > 0) {
      insightsList.push({
        id: 'top-category',
        type: 'success',
        title: `${categoryGrowth[0].name} lidera las ventas`,
        description: `Mayor volumen de salidas en el período seleccionado`,
        metric: `${formatNumber(categoryGrowth[0].salidas)} unidades`,
        priority: 3,
      });
    }

    // Productos clase A sin suficiente stock
    const classAAtRisk = abcAnalysis.summary.A.filter(p => p.stock <= p.stockMinimo);
    if (classAAtRisk.length > 0) {
      insightsList.push({
        id: 'class-a-risk',
        type: 'action',
        title: `${classAAtRisk.length} productos clase A con stock bajo`,
        description: `Productos de alta rotación que necesitan reposición`,
        metric: `${classAAtRisk.length} de ${abcAnalysis.summary.A.length}`,
        action: 'Priorizar reposición',
        priority: 2,
      });
    }

    // Productos sin movimiento
    if (kpis.productsNoMovement > 0) {
      const percentage = Math.round((kpis.productsNoMovement / kpis.totalProducts) * 100);
      insightsList.push({
        id: 'no-movement',
        type: 'info',
        title: `${kpis.productsNoMovement} productos sin movimiento`,
        description: `${percentage}% del catálogo no tuvo actividad en el período`,
        metric: `${kpis.productsNoMovement} productos`,
        action: 'Revisar catálogo',
        priority: 4,
      });
    }

    // Rotación saludable
    if (kpis.rotationDays > 0 && kpis.rotationDays < 30) {
      insightsList.push({
        id: 'healthy-rotation',
        type: 'success',
        title: 'Rotación de inventario saludable',
        description: `El stock actual cubre aproximadamente ${kpis.rotationDays} días de operación`,
        metric: `${kpis.rotationDays} días`,
        priority: 5,
      });
    }

    return insightsList.sort((a, b) => a.priority - b.priority);
  }, [products, predictions, categoryData, filteredMovements, abcAnalysis, kpis]);

  // Predicciones ordenadas por urgencia
  const sortedPredictions = useMemo(() => {
    return products
      .map(p => ({ product: p, prediction: predictions[p.codigo] }))
      .filter(({ prediction }) => prediction && prediction.days !== null)
      .sort((a, b) => {
        const daysA = a.prediction.days === Infinity ? 9999 : (a.prediction.days || 9999);
        const daysB = b.prediction.days === Infinity ? 9999 : (b.prediction.days || 9999);
        return daysA - daysB;
      })
      .slice(0, 20);
  }, [products, predictions]);

  // Categorías únicas
  const categories = useMemo(() => {
    return ['all', ...new Set(products.map(p => p.categoria))];
  }, [products]);

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30">
            <Brain size={28} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Analytics IA</h1>
            <p className="text-sm text-slate-400">Análisis predictivo e insights de inventario</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Selector de período */}
          <div className="flex items-center gap-1 p-1 bg-slate-800/50 rounded-xl">
            {(['week', 'month', 'quarter', 'year'] as PeriodType[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                  period === p
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                {p === 'week' ? '7D' : p === 'month' ? '30D' : p === 'quarter' ? '90D' : '1A'}
              </button>
            ))}
          </div>

          {/* Botón exportar */}
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 text-sm font-medium transition-colors">
            <Download size={16} />
            Exportar
          </button>
        </div>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Valor del Inventario"
          value={formatCurrency(kpis.totalValue)}
          icon={<DollarSign size={20} />}
          color="emerald"
          trend={12}
          subtitle="Total en stock"
        />
        <KPICard
          title="Productos en Riesgo"
          value={kpis.productsAtRisk.toString()}
          icon={<AlertTriangle size={20} />}
          color={kpis.productsAtRisk > 0 ? 'amber' : 'slate'}
          subtitle={`de ${kpis.totalProducts} productos`}
        />
        <KPICard
          title="Rotación"
          value={kpis.rotationDays > 0 ? `${kpis.rotationDays}d` : '—'}
          icon={<RefreshCw size={20} />}
          color="cyan"
          subtitle="Días de inventario"
        />
        <KPICard
          title="Movimientos"
          value={formatNumber(kpis.movementsCount)}
          icon={<Activity size={20} />}
          color="purple"
          subtitle={`${formatNumber(kpis.totalEntradas)} ent. / ${formatNumber(kpis.totalSalidas)} sal.`}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800/50 pb-2 overflow-x-auto">
        {[
          { id: 'overview', label: 'Resumen', icon: <BarChart3 size={16} /> },
          { id: 'predictions', label: 'Predicciones', icon: <TrendingUp size={16} /> },
          { id: 'abc', label: 'Análisis ABC', icon: <Target size={16} /> },
          { id: 'trends', label: 'Tendencias', icon: <Activity size={16} /> },
          { id: 'insights', label: 'Insights', icon: <Lightbulb size={16} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
              activeTab === tab.id
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico de tendencias */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Activity size={18} className="text-cyan-400" />
                Flujo de Inventario
              </h3>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorSalidas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.warning} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={COLORS.warning} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="entradas"
                    stroke={COLORS.primary}
                    fillOpacity={1}
                    fill="url(#colorEntradas)"
                    name="Entradas"
                  />
                  <Area
                    type="monotone"
                    dataKey="salidas"
                    stroke={COLORS.warning}
                    fillOpacity={1}
                    fill="url(#colorSalidas)"
                    name="Salidas"
                  />
                  <Legend />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Distribución por categoría */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <PieChartIcon size={18} className="text-purple-400" />
                Valor por Categoría
              </h3>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS.chart[index % COLORS.chart.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '12px',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Insights rápidos */}
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Sparkles size={18} className="text-amber-400" />
                Insights Principales
              </h3>
              <button
                onClick={() => setActiveTab('insights')}
                className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                Ver todos <ChevronRight size={14} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {insights.slice(0, 3).map(insight => (
                <InsightCard key={insight.id} insight={insight} compact />
              ))}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'predictions' && (
        <div className="space-y-6">
          {/* Resumen de predicciones */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4 border-red-500/30 bg-red-500/5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/20">
                  <AlertTriangle size={20} className="text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-400">
                    {sortedPredictions.filter(p => p.prediction.days !== null && p.prediction.days < 7 && p.prediction.days !== Infinity).length}
                  </p>
                  <p className="text-sm text-slate-400">Crítico (&lt;7 días)</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 border-amber-500/30 bg-amber-500/5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <Clock size={20} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-400">
                    {sortedPredictions.filter(p => p.prediction.days !== null && p.prediction.days >= 7 && p.prediction.days < 14).length}
                  </p>
                  <p className="text-sm text-slate-400">Atención (7-14 días)</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 border-emerald-500/30 bg-emerald-500/5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <CheckCircle size={20} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-400">
                    {sortedPredictions.filter(p => p.prediction.days === null || p.prediction.days === Infinity || p.prediction.days >= 14).length}
                  </p>
                  <p className="text-sm text-slate-400">Saludable (&gt;14 días)</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Lista de predicciones */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-emerald-400" />
              Predicción de Agotamiento
            </h3>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {sortedPredictions.map(({ product, prediction }) => (
                <PredictionRow key={product.codigo} product={product} prediction={prediction} />
              ))}
              {sortedPredictions.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <Package size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No hay suficientes datos para generar predicciones</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'abc' && (
        <div className="space-y-6">
          {/* Resumen ABC */}
          <div className="grid grid-cols-3 gap-4">
            {(['A', 'B', 'C'] as const).map(classification => {
              const items = abcAnalysis.summary[classification];
              const value = items.reduce((sum, p) => sum + p.totalValue, 0);
              const percentage = abcAnalysis.totalValue > 0 ? (value / abcAnalysis.totalValue) * 100 : 0;
              
              return (
                <Card 
                  key={classification} 
                  className="p-4"
                  style={{ borderColor: `${ABC_COLORS[classification]}40` }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
                      style={{ backgroundColor: `${ABC_COLORS[classification]}20`, color: ABC_COLORS[classification] }}
                    >
                      {classification}
                    </div>
                    <span className="text-2xl font-bold" style={{ color: ABC_COLORS[classification] }}>
                      {items.length}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mb-1">
                    {classification === 'A' ? 'Alta rotación' : classification === 'B' ? 'Media rotación' : 'Baja rotación'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {percentage.toFixed(1)}% del valor ({formatCurrency(value)})
                  </p>
                </Card>
              );
            })}
          </div>

          {/* Gráfico ABC */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Target size={18} className="text-emerald-400" />
              Curva de Pareto (ABC)
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={abcAnalysis.classified.slice(0, 20)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="codigo" stroke="#64748b" fontSize={10} angle={-45} textAnchor="end" height={60} />
                  <YAxis yAxisId="left" stroke="#64748b" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={12} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '12px',
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === 'cumulativePercentage') return `${value.toFixed(1)}%`;
                      return formatCurrency(value);
                    }}
                  />
                  <Bar yAxisId="left" dataKey="totalValue" name="Valor">
                    {abcAnalysis.classified.slice(0, 20).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={ABC_COLORS[entry.classification]} />
                    ))}
                  </Bar>
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="cumulativePercentage"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                    name="% Acumulado"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Tabla ABC */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Detalle por Clasificación</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left py-2 px-3 text-xs text-slate-400">Clase</th>
                    <th className="text-left py-2 px-3 text-xs text-slate-400">Código</th>
                    <th className="text-left py-2 px-3 text-xs text-slate-400">Descripción</th>
                    <th className="text-right py-2 px-3 text-xs text-slate-400">Stock</th>
                    <th className="text-right py-2 px-3 text-xs text-slate-400">Valor Total</th>
                    <th className="text-right py-2 px-3 text-xs text-slate-400">% Acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {abcAnalysis.classified.slice(0, 15).map(product => (
                    <tr key={product.codigo} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="py-2 px-3">
                        <span 
                          className="px-2 py-0.5 rounded text-xs font-bold"
                          style={{ backgroundColor: `${ABC_COLORS[product.classification]}20`, color: ABC_COLORS[product.classification] }}
                        >
                          {product.classification}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono text-sm">{product.codigo}</td>
                      <td className="py-2 px-3 text-sm truncate max-w-[200px]">{product.descripcion}</td>
                      <td className="py-2 px-3 text-right font-mono text-sm">{product.stock}</td>
                      <td className="py-2 px-3 text-right font-mono text-sm">{formatCurrency(product.totalValue)}</td>
                      <td className="py-2 px-3 text-right text-sm text-slate-400">{product.cumulativePercentage.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'trends' && (
        <div className="space-y-6">
          {/* Gráfico de líneas detallado */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Activity size={18} className="text-cyan-400" />
              Tendencia de Movimientos
            </h3>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '12px',
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="entradas" stroke={COLORS.primary} strokeWidth={2} dot={{ r: 3 }} name="Entradas" />
                  <Line type="monotone" dataKey="salidas" stroke={COLORS.warning} strokeWidth={2} dot={{ r: 3 }} name="Salidas" />
                  <Line type="monotone" dataKey="neto" stroke={COLORS.secondary} strokeWidth={2} dot={{ r: 3 }} name="Neto" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Comparativa de categorías */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Layers size={18} className="text-purple-400" />
              Stock por Categoría
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" stroke="#64748b" fontSize={12} />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={12} width={100} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '12px',
                    }}
                  />
                  <Bar dataKey="stock" fill={COLORS.primary} name="Unidades en Stock" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'insights' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Lightbulb size={18} className="text-amber-400" />
              Insights Generados por IA
            </h3>
            <span className="text-sm text-slate-400">{insights.length} insights detectados</span>
          </div>

          {insights.length === 0 ? (
            <Card className="p-8 text-center">
              <Sparkles size={48} className="mx-auto mb-4 text-slate-600" />
              <p className="text-slate-400">No hay insights disponibles para el período seleccionado</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insights.map(insight => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// COMPONENTES AUXILIARES
// ============================================

interface KPICardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: 'emerald' | 'cyan' | 'amber' | 'purple' | 'red' | 'slate';
  trend?: number;
  subtitle?: string;
}

function KPICard({ title, value, icon, color, trend, subtitle }: KPICardProps) {
  const colorClasses = {
    emerald: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
    cyan: 'text-cyan-400 bg-cyan-500/20 border-cyan-500/30',
    amber: 'text-amber-400 bg-amber-500/20 border-amber-500/30',
    purple: 'text-purple-400 bg-purple-500/20 border-purple-500/30',
    red: 'text-red-400 bg-red-500/20 border-red-500/30',
    slate: 'text-slate-400 bg-slate-500/20 border-slate-500/30',
  };

  const [textColor, bgColor, borderColor] = colorClasses[color].split(' ');

  return (
    <Card className={cn('p-5 border', borderColor)}>
      <div className="flex items-start justify-between mb-3">
        <div className={cn('p-2 rounded-xl', bgColor)}>
          <span className={textColor}>{icon}</span>
        </div>
        {trend !== undefined && (
          <span className={cn('flex items-center text-xs font-medium', trend >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className={cn('text-2xl font-bold mb-1', textColor)}>{value}</p>
      <p className="text-sm text-slate-500">{title}</p>
      {subtitle && <p className="text-xs text-slate-600 mt-1">{subtitle}</p>}
    </Card>
  );
}

interface PredictionRowProps {
  product: Product;
  prediction: StockPrediction;
}

function PredictionRow({ product, prediction }: PredictionRowProps) {
  const days = prediction.days;
  const isInfinity = days === Infinity;
  const isCritical = days !== null && days < 7 && !isInfinity;
  const isWarning = days !== null && days >= 7 && days < 14;
  const isHealthy = days === null || isInfinity || days >= 14;

  return (
    <div className={cn(
      'flex items-center justify-between p-4 rounded-xl border transition-colors',
      isCritical ? 'bg-red-500/5 border-red-500/30' :
      isWarning ? 'bg-amber-500/5 border-amber-500/30' :
      'bg-slate-800/30 border-slate-700/30'
    )}>
      <div className="flex items-center gap-4">
        <div className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center',
          isCritical ? 'bg-red-500/20' :
          isWarning ? 'bg-amber-500/20' :
          'bg-emerald-500/20'
        )}>
          {isCritical ? <AlertTriangle size={20} className="text-red-400" /> :
           isWarning ? <Clock size={20} className="text-amber-400" /> :
           <CheckCircle size={20} className="text-emerald-400" />}
        </div>
        <div>
          <p className="font-medium text-sm">{product.descripcion}</p>
          <p className="text-xs text-slate-500">{product.codigo} • Stock: {product.stock}</p>
        </div>
      </div>
      <div className="text-right">
        <p className={cn(
          'text-lg font-bold font-mono',
          isCritical ? 'text-red-400' :
          isWarning ? 'text-amber-400' :
          'text-emerald-400'
        )}>
          {isInfinity ? '∞' : days ?? '—'} días
        </p>
        {prediction.dailyRate && (
          <p className="text-xs text-slate-500">
            {prediction.dailyRate}/día consumo
          </p>
        )}
        <div className="flex items-center justify-end gap-1 mt-1">
          <div className="h-1.5 w-20 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className={cn('h-full rounded-full', 
                isCritical ? 'bg-red-500' :
                isWarning ? 'bg-amber-500' :
                'bg-emerald-500'
              )}
              style={{ width: `${Math.round(prediction.confidence * 100)}%` }}
            />
          </div>
          <span className="text-xs text-slate-500">{Math.round(prediction.confidence * 100)}%</span>
        </div>
      </div>
    </div>
  );
}

interface InsightCardProps {
  insight: Insight;
  compact?: boolean;
}

function InsightCard({ insight, compact }: InsightCardProps) {
  const typeConfig = {
    warning: { icon: <AlertTriangle size={18} />, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
    success: { icon: <CheckCircle size={18} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
    info: { icon: <Info size={18} />, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
    action: { icon: <Zap size={18} />, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  };

  const config = typeConfig[insight.type];

  if (compact) {
    return (
      <div className={cn('p-4 rounded-xl border', config.bg, config.border)}>
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded-lg', config.bg)}>
            <span className={config.color}>{config.icon}</span>
          </div>
          <div>
            <p className="font-medium text-sm">{insight.title}</p>
            {insight.metric && (
              <p className={cn('text-lg font-bold font-mono', config.color)}>{insight.metric}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className={cn('p-5 border', config.border)}>
      <div className="flex items-start gap-4">
        <div className={cn('p-3 rounded-xl', config.bg)}>
          <span className={config.color}>{config.icon}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold">{insight.title}</p>
              <p className="text-sm text-slate-400 mt-1">{insight.description}</p>
            </div>
            {insight.metric && (
              <span className={cn('text-lg font-bold font-mono', config.color)}>
                {insight.metric}
              </span>
            )}
          </div>
          {insight.action && (
            <button className={cn(
              'mt-3 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
              config.bg, config.color, 'hover:opacity-80'
            )}>
              {insight.action}
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

export default AnalyticsDashboard;