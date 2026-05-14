'use client';

import React, { useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Legend,
} from 'recharts';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react';

// =====================================================
// Charts BI — estilo dashboard ejecutivo
// =====================================================
// Componentes data-dense con color funcional.
// Pensados para Dashboard, Reportes, Analytics.
// =====================================================

// Paleta BI — colores legibles sobre fondo oscuro y claro
export const CHART_COLORS = [
  '#6366f1', // indigo (brand)
  '#10b981', // emerald
  '#f59e0b', // amber
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#84cc16', // lime
  '#f43f5e', // rose
];

const TooltipStyle = {
  contentStyle: {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '8px',
    fontSize: '12px',
    padding: '8px 12px',
  } as React.CSSProperties,
  labelStyle: { color: '#cbd5e1', fontWeight: 500 } as React.CSSProperties,
  itemStyle: { color: '#e2e8f0' } as React.CSSProperties,
};

// =====================================================
// DONUT — pie chart con hueco, valor central
// =====================================================
export interface DonutDataItem {
  name: string;
  value: number;
  color?: string;
}

export function Donut({
  data, size = 200, centerLabel, centerValue, valueFormatter,
}: {
  data: DonutDataItem[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
  valueFormatter?: (v: number) => string;
}) {
  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            innerRadius={size * 0.32}
            outerRadius={size * 0.45}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color ?? CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            {...TooltipStyle}
            formatter={(v: number) => [valueFormatter ? valueFormatter(v) : v.toLocaleString('es-UY'), '']}
          />
        </PieChart>
      </ResponsiveContainer>
      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            {centerLabel && <div className="text-[10px] uppercase tracking-wider text-slate-500">{centerLabel}</div>}
            {centerValue && <div className="text-xl font-semibold text-slate-50 tabular-nums">{centerValue}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================
// BARS HORIZONTAL — tipo "Top 5 Clients", "Quantity by City"
// =====================================================
export function HorizontalBars({
  data, height = 220, valueFormatter, color = CHART_COLORS[0],
}: {
  data: Array<{ name: string; value: number }>;
  height?: number;
  valueFormatter?: (v: number) => string;
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid horizontal={false} stroke="#1e293b" strokeDasharray="3 3" />
        <XAxis
          type="number"
          tick={{ fill: '#64748b', fontSize: 10 }}
          axisLine={{ stroke: '#334155' }}
          tickLine={false}
          tickFormatter={valueFormatter}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: '#cbd5e1', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={100}
        />
        <Tooltip
          {...TooltipStyle}
          cursor={{ fill: 'rgba(99,102,241,0.06)' }}
          formatter={(v: number) => [valueFormatter ? valueFormatter(v) : v.toLocaleString('es-UY'), '']}
        />
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// =====================================================
// GAUGE — semicírculo con flecha. Para "salud" del KPI.
// (SVG nativo para tener control total del estilo)
// =====================================================
export function Gauge({
  value, max = 100, size = 160, label, valueFormatter, color,
}: {
  value: number;
  max?: number;
  size?: number;
  label?: string;
  valueFormatter?: (v: number) => string;
  color?: string;
}) {
  const pct = Math.max(0, Math.min(1, value / max));
  const angle = -90 + pct * 180;
  const radius = size * 0.4;
  const cx = size / 2;
  const cy = size * 0.65;
  const strokeWidth = size * 0.08;

  // Color por nivel si no se pasa
  const segColor = color ?? (pct < 0.34 ? '#ef4444' : pct < 0.67 ? '#f59e0b' : '#10b981');

  // Arco completo (-90 a 90)
  const arcPath = (startAngle: number, endAngle: number) => {
    const start = polarToCartesian(cx, cy, radius, endAngle);
    const end = polarToCartesian(cx, cy, radius, startAngle);
    const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`;
  };

  function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const a = (angleDeg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  const needle = polarToCartesian(cx, cy, radius - strokeWidth / 2, angle);

  return (
    <div className="inline-block text-center">
      <svg width={size} height={size * 0.75}>
        {/* Track */}
        <path d={arcPath(-90, 90)} stroke="#1e293b" strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
        {/* Fill */}
        <path d={arcPath(-90, angle)} stroke={segColor} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
        {/* Needle */}
        <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke="#e2e8f0" strokeWidth={2} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={4} fill="#e2e8f0" />
      </svg>
      <div className="mt-1">
        <div className="text-lg font-semibold text-slate-100 tabular-nums">
          {valueFormatter ? valueFormatter(value) : value.toLocaleString('es-UY')}
        </div>
        {label && <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>}
      </div>
    </div>
  );
}

// =====================================================
// KPI STAT — tarjeta con valor grande, label, delta, color de marca
// =====================================================
export type KpiAccent = 'indigo' | 'emerald' | 'amber' | 'red' | 'cyan' | 'violet' | 'slate';

const accentMap: Record<KpiAccent, { text: string; bg: string; ring: string }> = {
  indigo:  { text: 'text-indigo-300',  bg: 'bg-indigo-500/10',  ring: 'ring-indigo-500/20' },
  emerald: { text: 'text-emerald-300', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20' },
  amber:   { text: 'text-amber-300',   bg: 'bg-amber-500/10',   ring: 'ring-amber-500/20' },
  red:     { text: 'text-red-300',     bg: 'bg-red-500/10',     ring: 'ring-red-500/20' },
  cyan:    { text: 'text-cyan-300',    bg: 'bg-cyan-500/10',    ring: 'ring-cyan-500/20' },
  violet:  { text: 'text-violet-300',  bg: 'bg-violet-500/10',  ring: 'ring-violet-500/20' },
  slate:   { text: 'text-slate-300',   bg: 'bg-slate-700/30',   ring: 'ring-slate-700/40' },
};

export function KpiStat({
  label, value, sublabel, icon: Icon, accent = 'indigo', delta, sparkData,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: LucideIcon;
  accent?: KpiAccent;
  delta?: { value: number; label?: string };
  sparkData?: number[];
}) {
  const a = accentMap[accent];
  const isUp = (delta?.value ?? 0) >= 0;

  return (
    <div className="rounded-xl bg-slate-900/40 border border-slate-800 p-5">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {Icon && (
            <span className={cn('inline-flex p-1.5 rounded-md ring-1 ring-inset', a.bg, a.ring)}>
              <Icon className={cn('h-3.5 w-3.5', a.text)} />
            </span>
          )}
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
            {label}
          </span>
        </div>
        {sparkData && sparkData.length > 1 && (
          <Sparkline data={sparkData} color={a.text.includes('emerald') ? '#10b981' : a.text.includes('red') ? '#ef4444' : '#6366f1'} width={64} height={22} />
        )}
      </div>

      <div className="flex items-baseline gap-3 mt-1">
        <span className="text-3xl font-semibold text-slate-50 tabular-nums tracking-tight leading-none">
          {value}
        </span>
        {delta && Number.isFinite(delta.value) && delta.value !== 0 && (
          <span className={cn(
            'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
            isUp ? 'text-emerald-400' : 'text-red-400',
          )}>
            {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(delta.value).toFixed(1)}%
          </span>
        )}
      </div>

      {sublabel && (
        <p className="text-[11px] text-slate-500 mt-1.5">{sublabel}</p>
      )}
    </div>
  );
}

// =====================================================
// SPARKLINE — mini line chart
// =====================================================
export function Sparkline({
  data, color = '#6366f1', width = 80, height = 28,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  const areaPoints = `0,${height} ${points} ${width},${height}`;
  const lastY = points.split(' ').pop()!.split(',')[1];

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`spk-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#spk-${color.replace('#', '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={parseFloat(lastY)} r={2} fill={color} />
    </svg>
  );
}

// =====================================================
// DATA TABLE — tabla densa estilo "Top 10 Customers"
// =====================================================
export interface TableColumn<T> {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  format?: (row: T) => React.ReactNode;
}

export function DataTable<T extends Record<string, any>>({
  data, columns, onRowClick, emptyMessage = 'Sin datos',
}: {
  data: T[];
  columns: TableColumn<T>[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-800/60">
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                className={cn(
                  'px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400',
                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-8 text-xs text-slate-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-slate-800/40',
                )}
              >
                {columns.map(col => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-3 py-2 text-[13px]',
                      col.align === 'right' ? 'text-right tabular-nums' : col.align === 'center' ? 'text-center' : 'text-left',
                    )}
                  >
                    {col.format ? col.format(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
