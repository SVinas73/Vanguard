'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react';

// =====================================================
// Design System — Stripe-style corporate
// =====================================================
// Paleta:
//   - Neutros: zinc-*  (fondo zinc-950, surface zinc-900)
//   - Marca:   indigo-600 (único acento "vivo")
//   - Sem.:    green-500 (éxito), red-500 (error), amber-500 (warning, raro)
//
// Reglas:
//   - Hierarchy via tipografía y whitespace, NO colores
//   - Cards planas (sin fondos coloreados)
//   - Sin emojis, sin glow, sin gradientes saturados
//   - tabular-nums en todos los números
// =====================================================

// ─────────────────────────────────────────────────────
// CARD — contenedor base
// ─────────────────────────────────────────────────────
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'subtle' | 'outline';
}

export function Card({
  children, className, padding = 'md', variant = 'default', ...rest
}: CardProps) {
  const padMap = { none: '', sm: 'p-4', md: 'p-6', lg: 'p-8' };
  const variants = {
    default: 'bg-zinc-900/40 border border-zinc-800',
    subtle:  'bg-zinc-900/20 border border-zinc-800/50',
    outline: 'bg-transparent border border-zinc-800',
  };
  return (
    <div className={cn('rounded-xl', variants[variant], padMap[padding], className)} {...rest}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// CARD HEADER — título + descripción opcional + action
// ─────────────────────────────────────────────────────
export function CardHeader({
  title, description, action, className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 mb-5', className)}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-zinc-100 tracking-tight">{title}</h3>
        {description && (
          <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// KPI — métrica grande con label, valor, delta opcional
// ─────────────────────────────────────────────────────
export interface KPIProps {
  label: string;
  value: string | number;
  hint?: string;          // texto bajo el valor (ej: "Capital total en stock")
  delta?: number;         // porcentaje de cambio. positivo = verde, negativo = rojo
  deltaLabel?: string;    // ej: "vs mes anterior"
  icon?: LucideIcon;
  loading?: boolean;
  className?: string;
}

export function KPI({
  label, value, hint, delta, deltaLabel, icon: Icon, loading, className,
}: KPIProps) {
  const hasDelta = delta !== undefined && Number.isFinite(delta);
  const isUp = hasDelta && delta! >= 0;

  return (
    <div className={cn(
      'group rounded-xl bg-zinc-900/40 border border-zinc-800 p-5 transition-colors',
      'hover:border-zinc-700',
      className,
    )}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          {label}
        </span>
        {Icon && <Icon className="h-3.5 w-3.5 text-zinc-600" strokeWidth={2} />}
      </div>

      {loading ? (
        <div className="h-8 w-32 bg-zinc-800 rounded animate-pulse" />
      ) : (
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-3xl font-semibold text-zinc-50 tabular-nums tracking-tight">
            {value}
          </span>
          {hasDelta && (
            <span className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
              isUp ? 'text-green-400' : 'text-red-400',
            )}>
              {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(delta!).toFixed(1)}%
            </span>
          )}
        </div>
      )}

      {(hint || deltaLabel) && (
        <p className="text-xs text-zinc-500 mt-2">
          {hint}{hint && deltaLabel ? ' · ' : ''}{deltaLabel}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// BADGE — etiquetas pequeñas. Sólo 5 variantes.
// ─────────────────────────────────────────────────────
export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  const tones: Record<BadgeTone, string> = {
    neutral: 'bg-zinc-800 text-zinc-300 ring-zinc-700/50',
    brand:   'bg-indigo-500/10 text-indigo-300 ring-indigo-500/30',
    success: 'bg-green-500/10 text-green-300 ring-green-500/30',
    warning: 'bg-amber-500/10 text-amber-300 ring-amber-500/30',
    danger:  'bg-red-500/10 text-red-300 ring-red-500/30',
  };
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium',
      'ring-1 ring-inset',
      tones[tone],
      className,
    )}>
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────
// SECTION — agrupar contenido con un título de jerarquía
// ─────────────────────────────────────────────────────
export function Section({
  title, description, action, children, className,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-4', className)}>
      {(title || action) && (
        <div className="flex items-end justify-between gap-4">
          <div>
            {title && (
              <h2 className="text-lg font-semibold text-zinc-100 tracking-tight">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-sm text-zinc-500 mt-1">{description}</p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// ─────────────────────────────────────────────────────
// BUTTON — variantes mínimas
// ─────────────────────────────────────────────────────
export interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  icon?: LucideIcon;
}

export function Button({
  variant = 'secondary', size = 'md', icon: Icon,
  children, className, ...rest
}: BtnProps) {
  const variants = {
    primary:   'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm',
    secondary: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700',
    ghost:     'bg-transparent hover:bg-zinc-800 text-zinc-300',
    danger:    'bg-red-600/90 hover:bg-red-500 text-white',
  };
  const sizes = {
    sm: 'px-2.5 py-1.5 text-xs gap-1.5',
    md: 'px-3.5 py-2 text-sm gap-2',
  };
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant], sizes[size], className,
      )}
      {...rest}
    >
      {Icon && <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />}
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────
// EMPTY STATE — para listas vacías
// ─────────────────────────────────────────────────────
export function EmptyState({
  icon: Icon, title, description, action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-12 px-6">
      {Icon && (
        <div className="inline-flex p-3 rounded-full bg-zinc-900 border border-zinc-800 mb-4">
          <Icon className="h-5 w-5 text-zinc-500" />
        </div>
      )}
      <h3 className="text-sm font-medium text-zinc-300">{title}</h3>
      {description && (
        <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// DIVIDER — separador horizontal
// ─────────────────────────────────────────────────────
export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px bg-zinc-800', className)} />;
}
