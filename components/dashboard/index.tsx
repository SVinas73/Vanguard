'use client';

import React, { useMemo, useState, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Product, Movement, StockPrediction } from '@/types';
import {
  Package,
  RefreshCw,
  AlertTriangle,
  Zap,
  TrendingUp,
  TrendingDown,
  Brain,
  Flame,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  ShieldAlert,
  Hourglass,
  BarChart3,
  Activity,
  type LucideIcon,
} from 'lucide-react';

// ============================================
// MICRO CHART: SPARKLINE
// ============================================

interface SparkLineProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
}

function SparkLine({ data, color = '#6b8baa', height = 28, width = 64 }: SparkLineProps) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data
    .map((v: number, i: number) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  const areaPoints = `0,${height} ${points} ${width},${height}`;
  const lastPoint = points.split(' ').pop()?.split(',')[1] ?? '0';
  const gradientId = `spark-${color.replace('#', '')}-${Math.random().toString(36).slice(2, 6)}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradientId})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={width} cy={parseFloat(lastPoint)} r="2" fill={color} />
    </svg>
  );
}

// ============================================
// MICRO CHART: HEALTH RING
// ============================================

interface HealthRingProps {
  score: number; // 0-100
  size?: number;
  strokeWidth?: number;
}

function HealthRing({ score, size = 52, strokeWidth = 5 }: HealthRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashLength = (Math.min(score, 100) / 100) * circumference;

  const color =
    score >= 70 ? '#3d9a5f' : score >= 40 ? '#c8872e' : '#c94444';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dashLength} ${circumference - dashLength}`}
          strokeLinecap="round"
          style={{ transition: 'all 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold" style={{ color }}>
          {score}
        </span>
      </div>
    </div>
  );
}

// ============================================
// COLOR CONFIGS
// ============================================

type KPIColor = 'emerald' | 'cyan' | 'rose' | 'violet' | 'amber';

interface ColorConfig {
  bg: string;
  border: string;
  text: string;
  accent: string;
}

const COLOR_MAP: Record<KPIColor, ColorConfig> = {
  emerald: {
    bg: 'rgba(61,154,95,0.06)',
    border: 'rgba(61,154,95,0.12)',
    text: '#3d9a5f',
    accent: '#4aaa73',
  },
  cyan: {
    bg: 'rgba(74,127,181,0.06)',
    border: 'rgba(74,127,181,0.12)',
    text: '#4a7fb5',
    accent: '#6b8baa',
  },
  rose: {
    bg: 'rgba(201,68,68,0.06)',
    border: 'rgba(201,68,68,0.12)',
    text: '#c94444',
    accent: '#cc5555',
  },
  violet: {
    bg: 'rgba(107,86,160,0.06)',
    border: 'rgba(107,86,160,0.12)',
    text: '#6b5488',
    accent: '#836ba0',
  },
  amber: {
    bg: 'rgba(200,135,46,0.06)',
    border: 'rgba(200,135,46,0.12)',
    text: '#c8872e',
    accent: '#cc9a40',
  },
};

// ============================================
// WELCOME HEADER — PREMIUM
// ============================================

interface WelcomeHeaderProps {
  userName?: string;
  products?: Product[];
  predictions?: Record<string, StockPrediction>;
}

export function WelcomeHeader({ userName, products, predictions }: WelcomeHeaderProps) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Calculate health score from real data
  const { healthScore, criticalCount, healthLabel } = useMemo(() => {
    if (!products || products.length === 0) {
      return { healthScore: 100, criticalCount: 0, healthLabel: t('health.excellent', 'Excelente') };
    }

    let healthy = 0;
    let warning = 0;
    let critical = 0;

    products.forEach((p: Product) => {
      const pred = predictions?.[p.codigo];
      const daysLeft = pred?.days;

      if (p.stock === 0) {
        critical++;
      } else if (
        p.stock <= p.stockMinimo ||
        (daysLeft !== null && daysLeft !== undefined && daysLeft !== Infinity && daysLeft < 7)
      ) {
        warning++;
      } else {
        healthy++;
      }
    });

    const total = healthy + warning + critical;
    const score = total > 0 ? Math.round(((healthy * 100 + warning * 40) / total)) : 100;

    let label: string;
    if (score >= 80) label = t('health.excellent', 'Excelente');
    else if (score >= 60) label = t('health.good', 'Bueno');
    else if (score >= 40) label = t('health.needsAttention', 'Atención');
    else label = t('health.critical', 'Crítico');

    return { healthScore: score, criticalCount: critical + warning, healthLabel: label };
  }, [products, predictions, t]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t('greetings.morning', 'Buenos días');
    if (hour < 18) return t('greetings.afternoon', 'Buenas tardes');
    return t('greetings.evening', 'Buenas noches');
  }, [t]);

  return (
    <div
      className={cn(
        'transition-all duration-700',
        mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      )}
    >
      <div className="flex items-center justify-between">
        {/* Left: greeting */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
            {greeting}
            {userName ? `, ${userName}` : ''}
          </h1>
          <p className="text-sm" style={{ color: 'rgba(148,163,184,0.6)' }}>
            {t('dashboard.businessSummary', 'Resumen de tu negocio')} ·{' '}
            {new Date().toLocaleDateString('es-UY', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>

        {/* Right: health score + alerts badge */}
        <div className="flex items-center gap-4">
          {/* Health score ring */}
          {products && products.length > 0 && (
            <div className="flex items-center gap-3">
              <HealthRing score={healthScore} />
              <div className="hidden sm:block">
                <div className="text-xs font-medium text-slate-400">
                  {t('dashboard.inventoryHealth', 'Salud del inventario')}
                </div>
                <div
                  className="text-sm font-semibold"
                  style={{
                    color:
                      healthScore >= 70
                        ? '#3d9a5f'
                        : healthScore >= 40
                        ? '#c8872e'
                        : '#c94444',
                  }}
                >
                  {healthLabel}
                </div>
              </div>
            </div>
          )}

          {/* Critical badge */}
          {criticalCount > 0 && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{
                background: 'rgba(201,68,68,0.06)',
                border: '1px solid rgba(201,68,68,0.12)',
                color: '#c94444',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {criticalCount} {t('dashboard.needAttention', 'requieren atención')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// STATS GRID — PREMIUM WITH SPARKLINES
// ============================================

interface StatsGridProps {
  stats: Array<{
    label: string;
    value: string | number;
    icon: ReactNode;
    color: string;
    subtitle?: string;
    trend?: { value: number; label: string };
  }>;
  products?: Product[];
  movements?: Movement[];
}

export function StatsGrid({ stats, products, movements }: StatsGridProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Generate sparkline data from real movements
  const sparklines = useMemo(() => {
    if (!movements || movements.length === 0) return {};

    const now = new Date();
    const result: Record<number, number[]> = {};

    // For each stat, generate 7 data points over the last 7 days
    // stat 0: products (use unique product codes per day)
    // stat 1: rotation (daily sales avg)
    // stat 2: low stock (count per day - trend)
    // stat 3: movements (count per day)

    const days = 7;
    const dailyMovements: number[] = [];
    const dailySales: number[] = [];

    for (let d = days - 1; d >= 0; d--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayMov = movements.filter((m: Movement) => {
        const t = new Date(m.timestamp);
        return t >= dayStart && t < dayEnd;
      });

      dailyMovements.push(dayMov.length);
      dailySales.push(
        dayMov
          .filter((m: Movement) => m.tipo === 'salida')
          .reduce((sum: number, m: Movement) => sum + m.cantidad, 0)
      );
    }

    result[3] = dailyMovements; // Movimientos
    result[1] = dailySales; // Rotación proxy

    return result;
  }, [movements]);

  // Map stat colors to KPI colors
  const colorMapping: Record<string, KPIColor> = {
    emerald: 'emerald',
    cyan: 'cyan',
    amber: 'rose',
    purple: 'violet',
    red: 'rose',
    slate: 'cyan',
    blue: 'cyan',
    pink: 'rose',
  };

  return (
    <div
      className={cn(
        'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 transition-all duration-700 delay-100',
        mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      )}
    >
      {stats.map((stat, i: number) => {
        const kpiColor = colorMapping[stat.color] || 'emerald';
        const c = COLOR_MAP[kpiColor];
        const spark = sparklines[i];

        return (
          <div
            key={i}
            className="relative group rounded-xl overflow-hidden transition-all duration-200 bg-slate-900 border border-slate-800 hover:border-slate-700"
          >

            <div className="relative p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg" style={{ background: c.bg }}>
                    <span style={{ color: c.text }}>{stat.icon}</span>
                  </div>
                  <span
                    className="text-xs font-medium uppercase tracking-wider"
                    style={{ color: 'rgba(148,163,184,0.8)' }}
                  >
                    {stat.label}
                  </span>
                </div>
                {spark && spark.length >= 2 && (
                  <SparkLine data={spark} color={c.text} width={56} height={22} />
                )}
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-bold tracking-tight text-white">
                      {stat.value}
                    </span>
                  </div>
                  {stat.subtitle && (
                    <p
                      className="text-[11px] mt-1"
                      style={{ color: 'rgba(148,163,184,0.6)' }}
                    >
                      {stat.subtitle}
                    </p>
                  )}
                </div>

                {stat.trend && (
                  <div
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
                    style={{
                      background:
                        stat.trend.value >= 0
                          ? 'rgba(61,154,95,0.08)'
                          : 'rgba(201,68,68,0.08)',
                      color:
                        stat.trend.value >= 0 ? '#3d9a5f' : '#c94444',
                    }}
                  >
                    {stat.trend.value >= 0 ? (
                      <ArrowUpRight size={12} />
                    ) : (
                      <ArrowDownRight size={12} />
                    )}
                    <span>{Math.abs(stat.trend.value)}%</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// AI INSIGHTS PANEL
// ============================================

type InsightType = 'urgente' | 'tendencia' | 'alerta' | 'oportunidad';

interface Insight {
  tipo: InsightType;
  titulo: string;
  descripcion: string;
  accion: string;
  metric?: string;
}

interface InsightConfig {
  color: string;
  bg: string;
  border: string;
  Icon: LucideIcon;
}

interface InsightsPanelProps {
  products: Product[];
  movements: Movement[];
  predictions: Record<string, StockPrediction>;
  onNavigate?: (tab: string) => void;
}

export function InsightsPanel({
  products,
  movements,
  predictions,
  onNavigate,
}: InsightsPanelProps) {
  const { t } = useTranslation();

  const insights = useMemo(() => {
    const result: Insight[] = [];

    // 1. Out of stock — URGENTE
    const outOfStock = products.filter((p: Product) => p.stock === 0);
    if (outOfStock.length > 0) {
      result.push({
        tipo: 'urgente',
        titulo: `${outOfStock.length} ${t('insights.productsNoStock', 'productos sin stock')}`,
        descripcion: t(
          'insights.outOfStockDesc',
          'Requieren reposición inmediata para evitar pérdida de ventas.'
        ),
        accion: t('insights.createPO', 'Crear orden de compra'),
        metric: `${outOfStock.length}`,
      });
    }

    // 2. Critical predictions — products running out in < 7 days
    const criticalPred = products.filter((p: Product) => {
      const pred = predictions[p.codigo];
      return (
        pred &&
        pred.days !== null &&
        pred.days !== Infinity &&
        pred.days < 7 &&
        p.stock > 0
      );
    });
    if (criticalPred.length > 0) {
      result.push({
        tipo: 'urgente',
        titulo: `${criticalPred.length} ${t('insights.runOutSoon', 'se agotan esta semana')}`,
        descripcion:
          criticalPred
            .slice(0, 3)
            .map((p: Product) => p.descripcion)
            .join(', ') + (criticalPred.length > 3 ? '...' : ''),
        accion: t('insights.viewProducts', 'Ver productos'),
      });
    }

    // 3. Top growing product — TENDENCIA
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000);

    const currentSales: Record<string, number> = {};
    const prevSales: Record<string, number> = {};

    movements.forEach((m: Movement) => {
      if (m.tipo !== 'salida') return;
      const d = new Date(m.timestamp);
      if (d >= thirtyDaysAgo) {
        currentSales[m.codigo] = (currentSales[m.codigo] || 0) + m.cantidad;
      } else if (d >= sixtyDaysAgo && d < thirtyDaysAgo) {
        prevSales[m.codigo] = (prevSales[m.codigo] || 0) + m.cantidad;
      }
    });

    let topGrowthProduct: Product | null = null;
    let topGrowthPct = 0;

    Object.entries(currentSales).forEach(([codigo, current]) => {
      const prev = prevSales[codigo] || 0;
      if (prev > 0) {
        const growth = ((current - prev) / prev) * 100;
        if (growth > topGrowthPct) {
          topGrowthPct = growth;
          topGrowthProduct = products.find((p: Product) => p.codigo === codigo) || null;
        }
      }
    });

    if (topGrowthProduct && topGrowthPct > 15) {
      result.push({
        tipo: 'tendencia',
        titulo: `${(topGrowthProduct as Product).descripcion} creció +${Math.round(topGrowthPct)}%`,
        descripcion: t(
          'insights.demandAccelerated',
          'La demanda aceleró vs. el mes anterior. Asegurar stock.'
        ),
        accion: t('insights.viewDetail', 'Ver detalle'),
      });
    }

    // 4. Slow movers — ALERTA
    const recentCodes = new Set(
      movements
        .filter((m: Movement) => new Date(m.timestamp) >= sixtyDaysAgo)
        .map((m: Movement) => m.codigo)
    );
    const slowMovers = products.filter(
      (p: Product) => p.stock > 0 && !recentCodes.has(p.codigo)
    );
    const slowValue = slowMovers.reduce(
      (sum: number, p: Product) => sum + p.stock * (p.costoPromedio || p.precio),
      0
    );

    if (slowMovers.length > 0 && slowValue > 0) {
      result.push({
        tipo: 'alerta',
        titulo: `$${Math.round(slowValue).toLocaleString()} ${t('insights.immobilized', 'inmovilizados')}`,
        descripcion: `${slowMovers.length} ${t(
          'insights.noMovement60d',
          'productos sin movimiento en 60 días.'
        )}`,
        accion: t('insights.reviewProducts', 'Revisar productos'),
        metric: `${slowMovers.length}`,
      });
    }

    // 5. Stock velocity improvement — OPORTUNIDAD
    const totalCurrentSales = Object.values(currentSales).reduce(
      (sum: number, v: number) => sum + v,
      0
    );
    const totalPrevSales = Object.values(prevSales).reduce(
      (sum: number, v: number) => sum + v,
      0
    );

    if (totalPrevSales > 0 && totalCurrentSales > totalPrevSales) {
      const velocityIncrease = Math.round(
        ((totalCurrentSales - totalPrevSales) / totalPrevSales) * 100
      );
      if (velocityIncrease > 5) {
        result.push({
          tipo: 'oportunidad',
          titulo: `${t('insights.velocityUp', 'Velocidad de salida')} +${velocityIncrease}%`,
          descripcion: t(
            'insights.velocityDesc',
            'El flujo de salidas aumentó vs. el mes anterior. Buen ritmo operativo.'
          ),
          accion: t('insights.viewAnalytics', 'Ver analytics'),
        });
      }
    }

    return result.slice(0, 4);
  }, [products, movements, predictions, t]);

  const typeConfig: Record<InsightType, InsightConfig> = {
    urgente: {
      color: '#c94444',
      bg: 'rgba(201,68,68,0.04)',
      border: 'rgba(201,68,68,0.10)',
      Icon: Flame,
    },
    tendencia: {
      color: '#3d9a5f',
      bg: 'rgba(61,154,95,0.04)',
      border: 'rgba(61,154,95,0.10)',
      Icon: TrendingUp,
    },
    alerta: {
      color: '#c8872e',
      bg: 'rgba(200,135,46,0.04)',
      border: 'rgba(200,135,46,0.10)',
      Icon: AlertCircle,
    },
    oportunidad: {
      color: '#4a7fb5',
      bg: 'rgba(74,127,181,0.04)',
      border: 'rgba(74,127,181,0.10)',
      Icon: Zap,
    },
  };

  if (insights.length === 0) return null;

  return (
    <div
      className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800"
    >
      <div className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div
            className="p-2.5 rounded-lg bg-slate-800"
          >
            <Brain size={18} className="text-slate-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
              {t('dashboard.insights', 'Insights')}
              <span
                className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-slate-800 text-slate-400"
              >
                AI
              </span>
            </h3>
            <p
              className="text-[11px]"
              style={{ color: 'rgba(148,163,184,0.5)' }}
            >
              {t('dashboard.insightsSubtitle', 'Lo que necesitás saber ahora')}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {insights.map((insight: Insight, i: number) => {
            const cfg = typeConfig[insight.tipo];
            const IconComp = cfg.Icon;
            return (
              <div
                key={i}
                className="p-4 rounded-lg cursor-pointer transition-all hover:brightness-110"
                style={{
                  background: cfg.bg,
                  border: `1px solid ${cfg.border}`,
                }}
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 mt-0.5">
                    <IconComp size={18} style={{ color: cfg.color }} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-sm text-slate-200 mb-1">
                        {insight.titulo}
                      </div>
                      {insight.metric && (
                        <span
                          className="text-xs font-bold font-mono px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{ background: cfg.bg, color: cfg.color }}
                        >
                          {insight.metric}
                        </span>
                      )}
                    </div>
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: 'rgba(148,163,184,0.7)' }}
                    >
                      {insight.descripcion}
                    </p>
                    <button
                      className="mt-2.5 text-xs font-semibold flex items-center gap-1 transition-colors hover:opacity-80"
                      style={{ color: cfg.color }}
                      onClick={() => {
                        if (insight.tipo === 'urgente') onNavigate?.('compras');
                        else if (insight.tipo === 'alerta') onNavigate?.('stock');
                        else onNavigate?.('analytics');
                      }}
                    >
                      {insight.accion} <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================
// QUICK ACTION CARD (kept for backward compat)
// ============================================

interface QuickActionProps {
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
  color: 'emerald' | 'purple' | 'cyan' | 'amber';
}

export function QuickActionCard({
  title,
  description,
  icon,
  onClick,
  color,
}: QuickActionProps) {
  const colors = {
    emerald: {
      gradient: '',
      border: 'border-slate-800 hover:border-slate-700',
      text: 'text-emerald-500',
    },
    purple: {
      gradient: '',
      border: 'border-slate-800 hover:border-slate-700',
      text: 'text-purple-500',
    },
    cyan: {
      gradient: '',
      border: 'border-slate-800 hover:border-slate-700',
      text: 'text-blue-500',
    },
    amber: {
      gradient: '',
      border: 'border-slate-800 hover:border-slate-700',
      text: 'text-amber-500',
    },
  };

  const config = colors[color];

  return (
    <button
      onClick={onClick}
      className={cn(
        'p-5 rounded-xl bg-slate-900 border transition-all text-left group hover:bg-slate-800/80',
        config.border
      )}
    >
      <div className="mb-3 group-hover:scale-110 transition-transform inline-block">
        <span className={config.text}>{icon}</span>
      </div>
      <div className={cn('font-semibold', config.text)}>{title}</div>
      <div className="text-sm text-slate-500">{description}</div>
    </button>
  );
}

// ============================================
// INVENTORY HEALTH (kept for backward compat)
// ============================================

interface InventoryHealthProps {
  healthy: number;
  warning: number;
  critical: number;
}

export function InventoryHealth({
  healthy,
  warning,
  critical,
}: InventoryHealthProps) {
  const { t } = useTranslation();
  const total = healthy + warning + critical;

  const healthyPercent = total > 0 ? (healthy / total) * 100 : 100;
  const warningPercent = total > 0 ? (warning / total) * 100 : 0;
  const criticalPercent = total > 0 ? (critical / total) * 100 : 0;

  const overallHealth =
    total > 0
      ? Math.round((healthy * 100 + warning * 50) / total)
      : 100;

  const getHealthColor = () => {
    if (overallHealth >= 80) return 'text-emerald-400';
    if (overallHealth >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-200">
          {t('dashboard.inventoryHealth', 'Salud del Inventario')}
        </h3>
        <div className={cn('text-2xl font-bold', getHealthColor())}>
          {overallHealth}%
        </div>
      </div>

      <div className="h-3 rounded-full bg-slate-800 overflow-hidden flex mb-3">
        {criticalPercent > 0 && (
          <div
            className="h-full bg-red-500 transition-all"
            style={{ width: `${criticalPercent}%` }}
          />
        )}
        {warningPercent > 0 && (
          <div
            className="h-full bg-amber-500 transition-all"
            style={{ width: `${warningPercent}%` }}
          />
        )}
        {healthyPercent > 0 && (
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${healthyPercent}%` }}
          />
        )}
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-slate-400">
              {t('health.healthy', 'Sano')}: {healthy}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-slate-400">
              {t('health.warning', 'Alerta')}: {warning}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-slate-400">
              {t('health.critical', 'Crítico')}: {critical}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// RE-EXPORT StatCard for backward compatibility
// ============================================

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  color:
    | 'emerald'
    | 'cyan'
    | 'amber'
    | 'purple'
    | 'red'
    | 'slate'
    | 'blue'
    | 'pink';
  trend?: { value: number; label: string };
  subtitle?: string;
}

export function StatCard({ label, value, icon, color, trend, subtitle }: StatCardProps) {
  const kpiColor = (
    {
      emerald: 'emerald',
      cyan: 'cyan',
      amber: 'amber',
      purple: 'violet',
      red: 'rose',
      slate: 'cyan',
      blue: 'cyan',
      pink: 'rose',
    } as Record<string, KPIColor>
  )[color] || 'emerald';

  const c = COLOR_MAP[kpiColor];

  return (
    <div
      className="relative group rounded-xl overflow-hidden transition-all duration-200 bg-slate-900 border border-slate-800 hover:border-slate-700"
    >
      <div className="p-5">
        <div className="p-1.5 rounded-lg inline-block mb-3 bg-slate-800">
          <span style={{ color: c.text }}>{icon}</span>
        </div>
        <div className="text-3xl font-bold tracking-tight text-white mb-1">
          {value}
        </div>
        <div className="text-sm text-slate-500">
          {label}
        </div>
        {trend && (
          <div
            className="flex items-center gap-1 mt-2 text-xs font-semibold"
            style={{
              color: trend.value >= 0 ? '#3d9a5f' : '#c94444',
            }}
          >
            {trend.value >= 0 ? (
              <ArrowUpRight size={14} />
            ) : (
              <ArrowDownRight size={14} />
            )}
            <span>
              {trend.value >= 0 ? '+' : ''}
              {trend.value}%
            </span>
            <span className="text-slate-600">
              {trend.label}
            </span>
          </div>
        )}
        {subtitle && !trend && (
          <div className="text-xs mt-1 text-slate-500">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}