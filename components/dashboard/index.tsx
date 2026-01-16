'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

// ============================================
// STAT CARD PREMIUM
// ============================================

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'emerald' | 'cyan' | 'amber' | 'purple' | 'red' | 'slate' | 'blue' | 'pink';
  trend?: {
    value: number;
    label: string;
  };
  subtitle?: string;
}

const colorConfig = {
  emerald: {
    gradient: 'from-emerald-500/20 via-emerald-500/10 to-transparent',
    border: 'border-emerald-500/20 hover:border-emerald-500/40',
    text: 'text-emerald-400',
    glow: 'shadow-emerald-500/10',
    iconBg: 'bg-emerald-500/20',
  },
  cyan: {
    gradient: 'from-cyan-500/20 via-cyan-500/10 to-transparent',
    border: 'border-cyan-500/20 hover:border-cyan-500/40',
    text: 'text-cyan-400',
    glow: 'shadow-cyan-500/10',
    iconBg: 'bg-cyan-500/20',
  },
  amber: {
    gradient: 'from-amber-500/20 via-amber-500/10 to-transparent',
    border: 'border-amber-500/20 hover:border-amber-500/40',
    text: 'text-amber-400',
    glow: 'shadow-amber-500/10',
    iconBg: 'bg-amber-500/20',
  },
  purple: {
    gradient: 'from-purple-500/20 via-purple-500/10 to-transparent',
    border: 'border-purple-500/20 hover:border-purple-500/40',
    text: 'text-purple-400',
    glow: 'shadow-purple-500/10',
    iconBg: 'bg-purple-500/20',
  },
  red: {
    gradient: 'from-red-500/20 via-red-500/10 to-transparent',
    border: 'border-red-500/20 hover:border-red-500/40',
    text: 'text-red-400',
    glow: 'shadow-red-500/10',
    iconBg: 'bg-red-500/20',
  },
  slate: {
    gradient: 'from-slate-500/20 via-slate-500/10 to-transparent',
    border: 'border-slate-500/20 hover:border-slate-500/40',
    text: 'text-slate-400',
    glow: 'shadow-slate-500/10',
    iconBg: 'bg-slate-500/20',
  },
  blue: {
    gradient: 'from-blue-500/20 via-blue-500/10 to-transparent',
    border: 'border-blue-500/20 hover:border-blue-500/40',
    text: 'text-blue-400',
    glow: 'shadow-blue-500/10',
    iconBg: 'bg-blue-500/20',
  },
  pink: {
    gradient: 'from-pink-500/20 via-pink-500/10 to-transparent',
    border: 'border-pink-500/20 hover:border-pink-500/40',
    text: 'text-pink-400',
    glow: 'shadow-pink-500/10',
    iconBg: 'bg-pink-500/20',
  },
};

export function StatCard({ label, value, icon, color, trend, subtitle }: StatCardProps) {
  const config = colorConfig[color] || colorConfig.slate;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-slate-900/80 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-xl group',
        config.border,
        config.glow
      )}
    >
      {/* Gradient background */}
      <div className={cn(
        'absolute inset-0 bg-gradient-to-br opacity-50 group-hover:opacity-70 transition-opacity',
        config.gradient
      )} />
      
      {/* Decorative circle */}
      <div className={cn(
        'absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-10 group-hover:opacity-20 transition-opacity',
        config.iconBg
      )} />

      <div className="relative p-5">
        {/* Icon */}
        <div className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110',
          config.iconBg
        )}>
          <span className={config.text}>{icon}</span>
        </div>

        {/* Value */}
        <div className={cn(
          'text-3xl font-bold mb-1 tracking-tight',
          config.text
        )}>
          {value}
        </div>

        {/* Label */}
        <div className="text-sm text-slate-400 mb-2">{label}</div>

        {/* Trend or Subtitle */}
        {trend && (
          <div className={cn(
            'flex items-center gap-1 text-xs font-medium',
            trend.value >= 0 ? 'text-emerald-400' : 'text-red-400'
          )}>
            {trend.value >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>{trend.value >= 0 ? '+' : ''}{trend.value}%</span>
            <span className="text-slate-500">{trend.label}</span>
          </div>
        )}
        
        {subtitle && !trend && (
          <div className="text-xs text-slate-500">{subtitle}</div>
        )}
      </div>
    </div>
  );
}

// ============================================
// STATS GRID PREMIUM
// ============================================

interface StatItem {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  trend?: {
    value: number;
    label: string;
  };
  subtitle?: string;
}

interface StatsGridProps {
  stats: StatItem[];
}

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <StatCard
          key={i}
          label={stat.label}
          value={stat.value}
          icon={stat.icon}
          color={stat.color as any}
          trend={stat.trend}
          subtitle={stat.subtitle}
        />
      ))}
    </div>
  );
}

// ============================================
// WELCOME HEADER
// ============================================

interface WelcomeHeaderProps {
  userName?: string;
}

export function WelcomeHeader({ userName }: WelcomeHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-white">
        {t('greetings.welcome', 'Bienvenido')}{userName ? `, ${userName}` : ''}
      </h1>
    </div>
  );
}

// ============================================
// QUICK ACTION CARD
// ============================================

interface QuickActionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  color: 'emerald' | 'purple' | 'cyan' | 'amber';
}

export function QuickActionCard({ title, description, icon, onClick, color }: QuickActionProps) {
  const colors = {
    emerald: {
      gradient: 'from-emerald-500/10 to-cyan-500/10',
      border: 'border-emerald-500/20 hover:border-emerald-500/40',
      text: 'text-emerald-400',
    },
    purple: {
      gradient: 'from-purple-500/10 to-pink-500/10',
      border: 'border-purple-500/20 hover:border-purple-500/40',
      text: 'text-purple-400',
    },
    cyan: {
      gradient: 'from-cyan-500/10 to-blue-500/10',
      border: 'border-cyan-500/20 hover:border-cyan-500/40',
      text: 'text-cyan-400',
    },
    amber: {
      gradient: 'from-amber-500/10 to-orange-500/10',
      border: 'border-amber-500/20 hover:border-amber-500/40',
      text: 'text-amber-400',
    },
  };

  const config = colors[color];

  return (
    <button
      onClick={onClick}
      className={cn(
        'p-5 rounded-2xl bg-gradient-to-br border transition-all text-left group hover:scale-[1.02]',
        config.gradient,
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
// INVENTORY HEALTH INDICATOR
// ============================================

interface InventoryHealthProps {
  healthy: number;
  warning: number;
  critical: number;
}

export function InventoryHealth({ healthy, warning, critical }: InventoryHealthProps) {
  const { t } = useTranslation();
  const total = healthy + warning + critical;
  
  const healthyPercent = total > 0 ? (healthy / total) * 100 : 100;
  const warningPercent = total > 0 ? (warning / total) * 100 : 0;
  const criticalPercent = total > 0 ? (critical / total) * 100 : 0;

  const overallHealth = total > 0 
    ? Math.round((healthy * 100 + warning * 50) / total)
    : 100;

  const getHealthColor = () => {
    if (overallHealth >= 80) return 'text-emerald-400';
    if (overallHealth >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  const getHealthLabel = () => {
    if (overallHealth >= 80) return t('health.excellent');
    if (overallHealth >= 60) return t('health.good');
    if (overallHealth >= 40) return t('health.needsAttention');
    return t('health.critical');
  };

  return (
    <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-200">{t('dashboard.inventoryHealth')}</h3>
        <div className={cn('text-2xl font-bold', getHealthColor())}>
          {overallHealth}%
        </div>
      </div>

      {/* Health bar */}
      <div className="h-3 rounded-full bg-slate-800 overflow-hidden flex mb-3">
        {criticalPercent > 0 && (
          <div 
            className="h-full bg-gradient-to-r from-red-500 to-red-400 transition-all"
            style={{ width: `${criticalPercent}%` }}
          />
        )}
        {warningPercent > 0 && (
          <div 
            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all"
            style={{ width: `${warningPercent}%` }}
          />
        )}
        {healthyPercent > 0 && (
          <div 
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
            style={{ width: `${healthyPercent}%` }}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-slate-400">{t('health.healthy')}: {healthy}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-slate-400">{t('health.warning')}: {warning}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-slate-400">{t('health.critical')}: {critical}</span>
          </span>
        </div>
        <span className={cn('font-medium', getHealthColor())}>
          {getHealthLabel()}
        </span>
      </div>
    </div>
  );
}