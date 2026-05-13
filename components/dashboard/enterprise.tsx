import { useState, useMemo, useEffect, type ReactNode } from 'react';
import {
  Package, RefreshCw, AlertTriangle, Zap, DollarSign,
  TrendingUp, Brain, BarChart3,
  XCircle, AlertCircle, ShieldAlert,
  Flame, ArrowRight, Activity, PackagePlus,
  Hourglass, ArrowUpRight, ArrowDownRight,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { valuarInventario, type ResultadoValuacion } from '@/lib/inventory-valuation';

// ============================================
// TYPES
// ============================================

interface KPIData {
  productosActivos: number;
  productosActivosPrev: number;
  rotacionPromedio: number;
  rotacionPromedioPrev: number;
  stockBajo: number;
  stockBajoPrev: number;
  movimientosHoy: number;
  movimientosAyer: number;
}

interface Categoria {
  nombre: string;
  valor: number;
  porcentaje: number;
  color: string;
}

interface AlmacenBreakdown {
  id: string;
  nombre: string;
  codigo: string;
  productos: number;
  unidades: number;
  valor: number;
  criticos: number;
}

interface ValorInventarioData {
  total: number;
  prev30d: number;
  categorias: Categoria[];
  capitalInmovilizado: number;
  productosInmovilizados: number;
  // Desglose por almacén — null = sin almacén asignado
  almacenes: AlmacenBreakdown[];
  // Productos con problemas de data quality
  sinCosto: number;       // costo_promedio = 0 → no aportan al valor
  sinAlmacen: number;     // sin almacen_id asignado
}

type AlertLevel = 'critical' | 'warning' | 'low';

interface AlertaItem {
  codigo: string;
  descripcion: string;
  stock: number;
  stockMin: number;
  dias: number;
  nivel: AlertLevel;
}

interface AlertasData {
  criticas: number;
  advertencias: number;
  bajas: number;
  total: number;
  items: AlertaItem[];
}

interface ConsumoItem {
  codigo: string;
  descripcion: string;
  cantidad: number;
  prevCantidad: number;
  categoria: string;
}

interface ActividadItem {
  tipo: 'entrada' | 'salida';
  descripcion: string;
  cantidad: number;
  usuario: string;
  tiempo: string;
}

type InsightTipo = 'urgente' | 'tendencia' | 'alerta';

interface InsightItem {
  tipo: InsightTipo;
  titulo: string;
  descripcion: string;
  accion: string;
}

interface DashboardData {
  kpis: KPIData;
  valorInventario: ValorInventarioData;
  alertas: AlertasData;
  topConsumo: ConsumoItem[];
  actividad: ActividadItem[];
  insights: InsightItem[];
}

type KPIColor = 'emerald' | 'cyan' | 'rose' | 'violet';

interface ColorConfig {
  bg: string;
  border: string;
  text: string;
  accent: string;
}

interface LevelConfig {
  color: string;
  bg: string;
  border: string;
  label: string;
  Icon: LucideIcon;
}

interface InsightConfig {
  color: string;
  bg: string;
  border: string;
  Icon: LucideIcon;
}

interface FilterOption {
  key: string;
  label: string;
  count: number;
  color?: string;
}

interface PeriodOption {
  key: string;
  label: string;
}


// ============================================
// MICRO CHART COMPONENTS
// ============================================

interface SparkLineProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
}

function SparkLine({ data, color = '#3d9a5f', height = 32, width = 80 }: SparkLineProps) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((v: number, i: number) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  const lastPoint = points.split(' ').pop()?.split(',')[1] ?? '0';

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#spark-${color.replace('#', '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={parseFloat(lastPoint)} r="2.5" fill={color} />
    </svg>
  );
}

interface DonutSegment {
  percent: number;
  color: string;
}

interface MiniDonutProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
}

function MiniDonut({ segments, size = 48, strokeWidth = 6 }: MiniDonutProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} />
      {segments.map((seg: DonutSegment, i: number) => {
        const dashLength = (seg.percent / 100) * circumference;
        const el = (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dashLength} ${circumference - dashLength}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
            style={{ transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
        );
        offset += dashLength;
        return el;
      })}
    </svg>
  );
}

// ============================================
// KPI CARD
// ============================================

interface KPICardProps {
  label: string;
  value: number | string;
  prevValue?: number;
  suffix?: string;
  icon: ReactNode;
  color: KPIColor;
  sparkData?: number[];
  description?: string;
}

function KPICard({ label, value, prevValue, suffix, icon, sparkData, description }: KPICardProps) {
  // Stripe-style: slate + indigo + verde/rojo solo para deltas.
  // El color ya no se elige por prop — todo es neutro.
  const delta = prevValue ? ((Number(value) - prevValue) / prevValue * 100) : null;
  const isPositive = delta !== null && delta >= 0;

  return (
    <div className="group rounded-xl bg-slate-900/40 border border-slate-800 p-5 transition-colors hover:border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-slate-500">{icon}</span>
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">{label}</span>
        </div>
        {sparkData && <SparkLine data={sparkData} color="#a1a1aa" width={56} height={20} />}
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-semibold tracking-tight text-slate-50 tabular-nums">
              {typeof value === 'number' ? value.toLocaleString('es-UY') : value}
            </span>
            {suffix && <span className="text-sm font-medium text-slate-400">{suffix}</span>}
          </div>
          {description && <p className="text-[11px] mt-1.5 text-slate-500">{description}</p>}
        </div>

        {delta !== null && Number.isFinite(delta) && (
          <span className={cn(
            'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums flex-shrink-0',
            isPositive ? 'text-green-400' : 'text-red-400',
          )}>
            {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================
// INVENTORY VALUE PANEL
// ============================================

interface InventoryValuePanelProps {
  data: ValorInventarioData;
}

function InventoryValuePanel({ data }: InventoryValuePanelProps) {
  const trend = data.prev30d > 0
    ? ((data.total - data.prev30d) / data.prev30d * 100)
    : 0;
  const isUp = trend >= 0;
  const hayProblemasDatos = data.sinCosto > 0 || data.sinAlmacen > 0;

  return (
    <div className="rounded-xl bg-slate-900/40 border border-slate-800 p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 tracking-tight">Valor del Inventario</h3>
          <p className="text-xs text-slate-500 mt-0.5">Capital total en stock</p>
        </div>
        {Number.isFinite(trend) && trend !== 0 && (
          <span className={cn(
            'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
            isUp ? 'text-green-400' : 'text-red-400',
          )}>
            {isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>

      {/* Big number */}
      <div className="mb-6">
        <div className="flex items-baseline gap-4">
          <span className="text-4xl font-semibold text-slate-50 tabular-nums tracking-tight">
            ${data.total.toLocaleString('es-UY', { minimumFractionDigits: 0 })}
          </span>
          <div className="text-xs text-slate-500">
            vs 30 días: <span className="tabular-nums">${data.prev30d.toLocaleString('es-UY', { minimumFractionDigits: 0 })}</span>
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      {data.categorias.length > 0 && (
        <div className="mb-6">
          <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500 mb-3">
            Por categoría
          </div>
          <div className="space-y-3">
            {data.categorias.map((cat: Categoria) => (
              <div key={cat.nombre} className="group">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-slate-300">{cat.nombre}</span>
                  <div className="flex items-center gap-3 tabular-nums">
                    <span className="text-xs font-medium text-slate-200">
                      ${cat.valor.toLocaleString('es-UY', { minimumFractionDigits: 0 })}
                    </span>
                    <span className="text-[11px] text-slate-500 w-9 text-right">{cat.porcentaje}%</span>
                  </div>
                </div>
                <div className="h-1 rounded-full overflow-hidden bg-slate-800">
                  <div
                    className="h-full bg-slate-400 rounded-full transition-all duration-500"
                    style={{ width: `${cat.porcentaje}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Desglose por almacén */}
      {data.almacenes.length > 0 && (
        <div className="mb-6 pt-6 border-t border-slate-800/60">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">
              Por almacén
            </div>
            <span className="text-[10px] text-slate-600 tabular-nums">
              {data.almacenes.length} {data.almacenes.length === 1 ? 'almacén' : 'almacenes'}
            </span>
          </div>
          <div className="space-y-2.5">
            {data.almacenes.map((a) => {
              const pct = data.total > 0 ? Math.round((a.valor / data.total) * 100) : 0;
              const esSinAlmacen = a.id === '__sin_almacen__';
              return (
                <div key={a.id}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={cn('text-xs font-medium', esSinAlmacen ? 'text-amber-300' : 'text-slate-200')}>
                      {a.codigo !== '—' && a.codigo !== '' && (
                        <span className="text-slate-600 mr-1.5 font-mono">{a.codigo}</span>
                      )}
                      {a.nombre}
                    </span>
                    <span className="text-xs text-slate-300 tabular-nums">
                      ${a.valor.toLocaleString('es-UY', { minimumFractionDigits: 0 })}
                      <span className="text-slate-600 ml-2">· {pct}%</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 tabular-nums">
                    <span>{a.productos} productos</span>
                    <span className="text-slate-700">·</span>
                    <span>{a.unidades.toLocaleString('es-UY')} unidades</span>
                    {a.criticos > 0 && (
                      <>
                        <span className="text-slate-700">·</span>
                        <span className="text-amber-400">{a.criticos} críticos</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Inmovilizado */}
      <div className="pt-6 border-t border-slate-800/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hourglass size={14} className="text-slate-500" strokeWidth={1.75} />
            <div>
              <div className="text-xs font-medium text-slate-200">Capital inmovilizado</div>
              <div className="text-[11px] text-slate-500">{data.productosInmovilizados} productos sin movimiento (60d)</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-slate-100 tabular-nums">
              ${data.capitalInmovilizado.toLocaleString('es-UY')}
            </div>
            <div className="text-[11px] text-slate-500 tabular-nums">
              {data.total > 0 ? ((data.capitalInmovilizado / data.total) * 100).toFixed(0) : 0}% del total
            </div>
          </div>
        </div>
      </div>

      {/* Calidad de datos — solo si hay problemas */}
      {hayProblemasDatos && (
        <div className="mt-4 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle size={11} className="text-red-400" strokeWidth={2} />
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-red-300">
              Calidad de datos
            </span>
          </div>
          <ul className="space-y-0.5 text-[11px] text-slate-400">
            {data.sinCosto > 0 && (
              <li>{data.sinCosto} producto(s) con stock pero sin costo promedio — no valúan</li>
            )}
            {data.sinAlmacen > 0 && (
              <li>{data.sinAlmacen} producto(s) sin almacén asignado</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================
// STOCK ALERTS PANEL
// ============================================

interface StockAlertsPanelProps {
  alertas: AlertasData;
}

function StockAlertsPanelLocal({ alertas }: StockAlertsPanelProps) {
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const filteredItems: AlertaItem[] = activeFilter === 'all'
    ? alertas.items
    : alertas.items.filter((item: AlertaItem) => item.nivel === activeFilter);

  // Tono semántico por nivel — solo color en el texto del estado, NO en fondos.
  const levelTone: Record<AlertLevel, { text: string; Icon: typeof XCircle; label: string }> = {
    critical: { text: 'text-red-400',    Icon: XCircle,       label: 'Sin stock' },
    warning:  { text: 'text-amber-400',  Icon: AlertCircle,   label: 'Stock bajo' },
    low:      { text: 'text-slate-400',   Icon: AlertTriangle, label: 'Atención' },
  };

  const filters = [
    { key: 'all',      label: 'Todas',    count: alertas.total },
    { key: 'critical', label: 'Críticas', count: alertas.criticas },
    { key: 'warning',  label: 'Alerta',   count: alertas.advertencias },
    { key: 'low',      label: 'Bajas',    count: alertas.bajas },
  ];

  return (
    <div className="rounded-xl bg-slate-900/40 border border-slate-800 p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 tracking-tight">Alertas de Stock</h3>
          <p className="text-xs text-slate-500 mt-0.5">Productos que requieren atención</p>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-red-500/10 text-red-300 ring-1 ring-inset ring-red-500/20 tabular-nums">
          {alertas.total}
        </span>
      </div>

      {/* Filter pills */}
      <div className="flex gap-1 mb-4 border-b border-slate-800 -mx-6 px-6">
        {filters.map(f => {
          const active = activeFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors',
                active
                  ? 'border-indigo-500 text-slate-100'
                  : 'border-transparent text-slate-500 hover:text-slate-300',
              )}
            >
              <span>{f.label}</span>
              <span className="tabular-nums text-slate-600">{f.count}</span>
            </button>
          );
        })}
      </div>

      {/* Alert items */}
      <div className="space-y-1 max-h-[280px] overflow-y-auto -mx-2">
        {filteredItems.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            Sin alertas en este filtro.
          </div>
        ) : (
          filteredItems.map((item: AlertaItem) => {
            const cfg = levelTone[item.nivel];
            const IconComp = cfg.Icon;
            return (
              <div
                key={item.codigo}
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-md hover:bg-slate-800/60 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <IconComp size={14} className={cn('flex-shrink-0', cfg.text)} strokeWidth={2} />
                  <div className="min-w-0">
                    <div className="font-medium text-[13px] text-slate-100 truncate">{item.descripcion}</div>
                    <div className="text-[11px] text-slate-500 tabular-nums">
                      <span className="font-mono text-slate-600">{item.codigo}</span>
                      <span className="mx-1.5 text-slate-700">·</span>
                      <span className={cfg.text}>
                        {item.stock === 0 ? 'Sin stock' : `${item.stock} / ${item.stockMin} mín`}
                      </span>
                    </div>
                  </div>
                </div>
                {item.dias !== null && (
                  <span className={cn('text-[11px] font-mono font-medium tabular-nums flex-shrink-0', cfg.text)}>
                    {item.dias === 0 ? 'HOY' : `${item.dias}d`}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* CTA */}
      <button className="w-full mt-4 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
        <PackagePlus size={14} />
        Crear orden de compra
        <ArrowRight size={14} />
      </button>
    </div>
  );
}

// ============================================
// TOP CONSUMPTION PANEL
// ============================================

interface TopConsumptionPanelProps {
  data: ConsumoItem[];
}

function TopConsumptionPanel({ data }: TopConsumptionPanelProps) {
  const [period, setPeriod] = useState<string>('mes');
  const maxVal = Math.max(...data.map((d: ConsumoItem) => d.cantidad));

  const periods: PeriodOption[] = [
    { key: 'semana', label: '7d' },
    { key: 'mes', label: '30d' },
    { key: 'semestre', label: '6m' },
    { key: 'año', label: '1y' },
  ];

  return (
    <div className="rounded-xl bg-slate-900/40 border border-slate-800 p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 tracking-tight">Productos Más Consumidos</h3>
          <p className="text-xs text-slate-500 mt-0.5">Ranking por unidades salidas</p>
        </div>

        <div className="flex gap-0.5 p-0.5 rounded-md bg-slate-900 border border-slate-800">
          {periods.map((p: PeriodOption) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                'px-2.5 py-1 rounded text-[11px] font-medium transition-colors',
                period === p.key
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-500 hover:text-slate-300',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3.5">
        {data.map((item: ConsumoItem, i: number) => {
          const pct = (item.cantidad / maxVal) * 100;
          const delta = item.prevCantidad > 0
            ? ((item.cantidad - item.prevCantidad) / item.prevCantidad * 100)
            : 0;
          const isUp = delta >= 0;

          return (
            <div key={item.codigo} className="group">
              <div className="flex items-center gap-3">
                <div className="w-5 text-center">
                  <span className={cn(
                    'text-[11px] font-medium tabular-nums',
                    i < 3 ? 'text-slate-300' : 'text-slate-600',
                  )}>
                    {i + 1}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5 gap-3">
                    <span className="text-[13px] text-slate-100 truncate">{item.descripcion}</span>
                    <div className="flex items-center gap-2.5 flex-shrink-0 tabular-nums">
                      <span className="text-sm font-semibold text-slate-100 font-mono">{item.cantidad}</span>
                      {Number.isFinite(delta) && delta !== 0 && (
                        <span className={cn(
                          'text-[11px] font-medium',
                          isUp ? 'text-green-400' : 'text-red-400',
                        )}>
                          {isUp ? '+' : ''}{delta.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="h-1 rounded-full overflow-hidden bg-slate-800">
                    <div
                      className="h-full bg-slate-400 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// AI INSIGHTS PANEL
// ============================================

interface InsightsPanelProps {
  insights: InsightItem[];
}

function InsightsPanel({ insights }: InsightsPanelProps) {
  const typeTone: Record<InsightTipo, { text: string; Icon: typeof Flame }> = {
    urgente:   { text: 'text-red-400',   Icon: Flame },
    tendencia: { text: 'text-green-400', Icon: TrendingUp },
    alerta:    { text: 'text-amber-400', Icon: AlertCircle },
  };

  return (
    <div className="rounded-xl bg-slate-900/40 border border-slate-800 p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 tracking-tight flex items-center gap-2">
            Insights
            <span className="px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider rounded bg-indigo-500/10 text-indigo-300 ring-1 ring-inset ring-indigo-500/20">
              AI
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Lo que necesitás saber ahora</p>
        </div>
        <Brain size={14} className="text-slate-600" strokeWidth={1.75} />
      </div>

      <div className="space-y-2 -mx-2">
        {insights.map((insight: InsightItem, i: number) => {
          const tone = typeTone[insight.tipo];
          const IconComp = tone.Icon;
          return (
            <div
              key={i}
              className="group px-3 py-3 rounded-lg hover:bg-slate-800/40 transition-colors cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <IconComp size={14} className={cn('flex-shrink-0 mt-0.5', tone.text)} strokeWidth={2} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-slate-100 mb-0.5">{insight.titulo}</div>
                  <p className="text-xs text-slate-400 leading-relaxed">{insight.descripcion}</p>
                  <button className="mt-2 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors inline-flex items-center gap-1">
                    {insight.accion} <ArrowRight size={11} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// RECENT ACTIVITY PANEL
// ============================================

interface RecentActivityPanelProps {
  actividad: ActividadItem[];
}

function RecentActivityPanelLocal({ actividad }: RecentActivityPanelProps) {
  const groupedByTime = useMemo(() => {
    const groups: Record<string, ActividadItem[]> = {};
    actividad.forEach((a: ActividadItem) => {
      const key = a.tiempo;
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    });
    return Object.entries(groups);
  }, [actividad]);

  return (
    <div className="rounded-xl bg-slate-900/40 border border-slate-800 p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 tracking-tight">Actividad Reciente</h3>
          <p className="text-xs text-slate-500 mt-0.5">Últimos movimientos de inventario</p>
        </div>
        <Activity size={14} className="text-slate-600" strokeWidth={1.75} />
      </div>

      <div className="space-y-4 max-h-[360px] overflow-y-auto -mx-2">
        {groupedByTime.map(([time, items]: [string, ActividadItem[]]) => (
          <div key={time}>
            <div className="flex items-center gap-2 mb-2 px-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">
                hace {time}
              </span>
              <div className="h-px flex-1 bg-slate-800/60" />
            </div>

            <div>
              {items.map((item: ActividadItem, i: number) => (
                <div
                  key={`${item.descripcion}-${i}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800/40 transition-colors"
                >
                  <span className={cn(
                    'inline-flex items-center justify-center w-7 h-7 rounded-md text-[11px] font-mono font-semibold tabular-nums flex-shrink-0',
                    item.tipo === 'entrada'
                      ? 'bg-green-500/10 text-green-300 ring-1 ring-inset ring-green-500/20'
                      : 'bg-slate-800 text-slate-300 ring-1 ring-inset ring-slate-700',
                  )}>
                    {item.tipo === 'entrada' ? '+' : '−'}{item.cantidad}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-slate-100 truncate">{item.descripcion}</div>
                    <div className="text-[11px] text-slate-500">{item.usuario}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


// ============================================
// PUBLIC EXPORTS para page.tsx
// ============================================

export function InventoryValueCard({ products, movements, onCategoryClick }: {
  products: any[];
  movements: any[];
  onCategoryClick: (category: string) => void;
}) {
  // Valuación unificada: FIFO sobre lotes (fuente de verdad) + fallback
  // a costo promedio. Misma lógica que el Centro de Costos.
  const [valuacion, setValuacion] = useState<ResultadoValuacion | null>(null);
  useEffect(() => {
    let cancelled = false;
    valuarInventario({
      productos: products.map((p: any) => ({
        codigo: p.codigo,
        descripcion: p.descripcion,
        stock: p.stock,
        stockMinimo: p.stockMinimo,
        costoPromedio: p.costoPromedio || 0,
        categoria: p.categoria,
        almacenId: p.almacenId,
        almacen: p.almacen,
      })),
    }).then(r => { if (!cancelled) setValuacion(r); });
    return () => { cancelled = true; };
  }, [products]);

  const data = useMemo(() => {
    const CATEGORY_COLORS: Record<string, string> = {
      'Estación de Servicio': '#3d9a5f', 'Ferretería': '#4a7fb5',
      'Papelería': '#836ba0', 'Ediltor': '#c8872e',
    };

    const totalValue = valuacion?.total ?? 0;
    const categorias = (valuacion?.porCategoria ?? []).slice(0, 5).map((c, i) => ({
      nombre: c.nombre,
      valor: c.valor,
      porcentaje: totalValue > 0 ? Math.round((c.valor / totalValue) * 100) : 0,
      color: CATEGORY_COLORS[c.nombre] ?? ['#3d9a5f','#4a7fb5','#836ba0','#c8872e','#b5547a'][i % 5],
    }));

    const almacenes = valuacion?.porAlmacen ?? [];

    // Mapa codigo → valor por producto, para reusar en inmovilizados y tendencia
    const valorPorCodigo = new Map<string, number>();
    (valuacion?.porProducto ?? []).forEach(vp => valorPorCodigo.set(vp.codigo, vp.valor));
    const valorProducto = (p: any) => valorPorCodigo.get(p.codigo) ?? 0;

    // CAPITAL INMOVILIZADO — productos sin movimiento en 60 días
    const sixtyDaysAgo = new Date(); sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const activeCodes = new Set(movements.filter((m) => new Date(m.timestamp) >= sixtyDaysAgo).map((m) => m.codigo));
    const inmovilizados = products.filter((p) => !activeCodes.has(p.codigo) && p.stock > 0);
    const capitalInmovilizado = inmovilizados.reduce((sum, p) => sum + valorProducto(p), 0);

    // VALOR 30 DÍAS ATRÁS — tendencia. Usamos valor unitario implícito por producto
    // (valor / stock) para aproximar. Si stock=0, no contribuye.
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const costoUnitMap = new Map<string, number>();
    (valuacion?.porProducto ?? []).forEach(vp => {
      const unit = vp.unidades > 0 ? vp.valor / vp.unidades : 0;
      costoUnitMap.set(vp.codigo, unit);
    });
    let netValueChange = 0;
    movements.forEach((m) => {
      if (new Date(m.timestamp) >= thirtyDaysAgo) {
        const cost = costoUnitMap.get(m.codigo) ?? 0;
        if (m.tipo === 'entrada') netValueChange += m.cantidad * cost;
        else                       netValueChange -= m.cantidad * cost;
      }
    });
    const prev30d = totalValue - netValueChange;

    const sinCosto = valuacion?.calidad.sinValuar ?? 0;
    const sinAlmacen = products.filter((p) => !p.almacenId).length;

    return {
      total: totalValue,
      prev30d: prev30d > 0 ? prev30d : 0,
      categorias,
      capitalInmovilizado,
      productosInmovilizados: inmovilizados.length,
      almacenes,
      sinCosto,
      sinAlmacen,
    };
  }, [valuacion, products, movements]);
  return <InventoryValuePanel data={data} />;
}

export function StockAlertsPanel({ products, predictions, onProductClick, onCreatePurchaseOrder }: {
  products: any[];
  predictions: any;
  onProductClick: (product: any) => void;
  onCreatePurchaseOrder: (products: any[]) => void;
}) {
  const alertas = useMemo(() => {
    const items = products.filter((p) => p.stock <= p.stockMinimo).map((p) => {
      const dias = predictions[p.codigo]?.days ?? 0;
      const nivel: AlertLevel = p.stock === 0 ? 'critical' : p.stock <= p.stockMinimo * 0.5 ? 'warning' : 'low';
      return { codigo: p.codigo, descripcion: p.descripcion, stock: p.stock, stockMin: p.stockMinimo, dias, nivel };
    }).sort((a, b) => a.stock - b.stock).slice(0, 20);
    return {
      criticas: items.filter((i) => i.nivel === 'critical').length,
      advertencias: items.filter((i) => i.nivel === 'warning').length,
      bajas: items.filter((i) => i.nivel === 'low').length,
      total: products.filter((p) => p.stock <= p.stockMinimo).length,
      items,
    };
  }, [products, predictions]);
  // Rename the local StockAlertsPanel to avoid conflict — use internal props shape
  return <StockAlertsPanelLocal alertas={alertas} />;
}

export function RecentActivityPanel({ movements, products, maxItems = 20 }: {
  movements: any[];
  products: any[];
  maxItems?: number;
}) {
  const actividad = useMemo(() => {
    const productMap = new Map(products.map((p) => [p.codigo, p.descripcion]));
    const now = new Date();
    return movements.slice().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, maxItems).map((m) => {
      const diffMs = now.getTime() - new Date(m.timestamp).getTime();
      const diffDays = Math.floor(diffMs / 86400000);
      const diffHours = Math.floor(diffMs / 3600000);
      return { tipo: m.tipo, descripcion: productMap.get(m.codigo) ?? m.codigo, cantidad: m.cantidad, usuario: m.usuario, tiempo: diffDays > 0 ? `${diffDays}d` : `${diffHours}h` };
    });
  }, [movements, products, maxItems]);
  return <RecentActivityPanelLocal actividad={actividad} />;
}