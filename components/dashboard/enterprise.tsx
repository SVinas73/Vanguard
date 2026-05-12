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

function KPICard({ label, value, prevValue, suffix, icon, color, sparkData, description }: KPICardProps) {
  const delta = prevValue ? ((Number(value) - prevValue) / prevValue * 100).toFixed(1) : null;
  const isPositive = delta !== null && parseFloat(delta) >= 0;

  const colorMap: Record<KPIColor, ColorConfig> = {
    emerald: { bg: 'rgba(61,154,95,0.08)', border: 'rgba(61,154,95,0.15)', text: '#3d9a5f', accent: '#4aaa73' },
    cyan: { bg: 'rgba(74,127,181,0.08)', border: 'rgba(74,127,181,0.15)', text: '#4a7fb5', accent: '#6b8baa' },
    rose: { bg: 'rgba(201,68,68,0.08)', border: 'rgba(201,68,68,0.15)', text: '#c94444', accent: '#cc5555' },
    violet: { bg: 'rgba(107,84,136,0.08)', border: 'rgba(107,84,136,0.15)', text: '#6b5488', accent: '#836ba0' },
  };

  const c = colorMap[color];

  return (
    <div
      className="relative group rounded-xl overflow-hidden transition-all duration-300 bg-slate-900 border border-slate-800 hover:border-slate-700"
    >
      <div className="hidden" />

      <div className="relative p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg" style={{ background: c.bg }}>
              <span style={{ color: c.text }}>{icon}</span>
            </div>
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'rgba(148,163,184,0.8)' }}>{label}</span>
          </div>
          {sparkData && <SparkLine data={sparkData} color={c.text} width={60} height={24} />}
        </div>

        <div className="flex items-end justify-between">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold tracking-tight text-white">{typeof value === 'number' ? value.toLocaleString() : value}</span>
              {suffix && <span className="text-sm font-medium" style={{ color: c.text }}>{suffix}</span>}
            </div>
            {description && <p className="text-[11px] mt-1" style={{ color: 'rgba(148,163,184,0.6)' }}>{description}</p>}
          </div>

          {delta !== null && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold" style={{
              background: isPositive ? 'rgba(61,154,95,0.12)' : 'rgba(201,68,68,0.12)',
              color: isPositive ? '#4aaa73' : '#cc5555',
            }}>
              <span>{isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}</span>
              <span>{Math.abs(parseFloat(delta))}%</span>
            </div>
          )}
        </div>
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
    ? ((data.total - data.prev30d) / data.prev30d * 100).toFixed(1)
    : '0.0';
  const isUp = parseFloat(trend) >= 0;
  const hayProblemasDatos = data.sinCosto > 0 || data.sinAlmacen > 0;

  return (
    <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
      <div className="hidden" />
      <div className="hidden" />

      <div className="relative p-6">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ background: 'rgba(61,154,95,0.12)' }}>
              <DollarSign size={18} style={{ color: '#3d9a5f' }} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-200 text-sm">Valor del Inventario</h3>
              <p className="text-[11px]" style={{ color: 'rgba(148,163,184,0.5)' }}>Capital total en stock</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold" style={{
            background: isUp ? 'rgba(61,154,95,0.1)' : 'rgba(201,68,68,0.1)',
            color: isUp ? '#4aaa73' : '#cc5555',
          }}>
            <span>{isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}</span>
            <span>{trend}%</span>
          </div>
        </div>

        {/* Big number + donut */}
        <div className="flex items-center gap-6 mb-6">
          <div className="flex-1">
            <div className="text-4xl font-bold text-white tracking-tight" style={{ fontFeatureSettings: "'tnum'" }}>
              ${data.total.toLocaleString('es-UY', { minimumFractionDigits: 0 })}
            </div>
            <div className="text-xs mt-1" style={{ color: 'rgba(148,163,184,0.5)' }}>
              vs 30 días: ${data.prev30d.toLocaleString('es-UY', { minimumFractionDigits: 0 })}
            </div>
          </div>
          <div className="relative">
            <MiniDonut
              segments={data.categorias.map((cat: Categoria) => ({ percent: cat.porcentaje, color: cat.color }))}
              size={72}
              strokeWidth={8}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] font-bold text-slate-300">{data.categorias.length}</span>
            </div>
          </div>
        </div>

        {/* Category breakdown */}
        <div className="space-y-2.5 mb-5">
          {data.categorias.map((cat: Categoria) => (
            <div key={cat.nombre} className="group cursor-pointer">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: cat.color }} />
                  <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors">{cat.nombre}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-medium text-slate-300">${(cat.valor / 1000).toFixed(1)}k</span>
                  <span className="text-[10px] text-slate-500 w-8 text-right">{cat.porcentaje}%</span>
                </div>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700 group-hover:opacity-80"
                  style={{
                    width: `${cat.porcentaje}%`,
                    background: `linear-gradient(90deg, ${cat.color}, ${cat.color}88)`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Desglose por almacén */}
        {data.almacenes.length > 0 && (
          <div className="mb-5 p-3.5 rounded-xl" style={{ background: 'rgba(74,127,181,0.05)', border: '1px solid rgba(74,127,181,0.15)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Package size={13} className="text-blue-400" />
              <span className="text-xs font-medium text-blue-300">Desglose por almacén</span>
              <span className="ml-auto text-[10px] text-blue-400/50">{data.almacenes.length} almac{data.almacenes.length === 1 ? 'én' : 'enes'}</span>
            </div>
            <div className="space-y-2">
              {data.almacenes.map((a) => {
                const pct = data.total > 0 ? Math.round((a.valor / data.total) * 100) : 0;
                const esSinAlmacen = a.id === '__sin_almacen__';
                return (
                  <div key={a.id} className="text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn('font-medium', esSinAlmacen ? 'text-amber-300' : 'text-slate-200')}>
                        {a.codigo !== '—' && a.codigo !== '' && <span className="text-slate-500 mr-1.5">{a.codigo}</span>}
                        {a.nombre}
                      </span>
                      <span className="font-mono text-slate-300">
                        ${(a.valor / 1000).toFixed(1)}k <span className="text-slate-500">· {pct}%</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      <span>{a.productos} productos</span>
                      <span>·</span>
                      <span>{a.unidades.toLocaleString('es-UY')} unid.</span>
                      {a.criticos > 0 && (
                        <>
                          <span>·</span>
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
        <div className="p-3.5 rounded-xl" style={{ background: 'rgba(200,135,46,0.06)', border: '1px solid rgba(200,135,46,0.12)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hourglass size={14} className="text-amber-400" />
              <div>
                <div className="text-xs font-medium text-amber-400">Capital inmovilizado</div>
                <div className="text-[10px] text-amber-400/50">{data.productosInmovilizados} productos sin movimiento (60d)</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-amber-300">${data.capitalInmovilizado.toLocaleString()}</div>
              <div className="text-[10px] text-amber-400/50">
                {data.total > 0 ? ((data.capitalInmovilizado / data.total) * 100).toFixed(0) : 0}% del total
              </div>
            </div>
          </div>
        </div>

        {/* Calidad de datos — sólo aparece si hay problemas */}
        {hayProblemasDatos && (
          <div className="mt-3 p-3 rounded-xl text-[11px]" style={{ background: 'rgba(201,68,68,0.05)', border: '1px solid rgba(201,68,68,0.15)' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <AlertTriangle size={12} className="text-red-400" />
              <span className="font-medium text-red-300">Calidad de datos</span>
            </div>
            <ul className="space-y-0.5 text-red-400/70">
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

  const levelConfig: Record<AlertLevel, LevelConfig> = {
    critical: { color: '#c94444', bg: 'rgba(201,68,68,0.08)', border: 'rgba(201,68,68,0.2)', label: 'Sin stock', Icon: XCircle },
    warning: { color: '#c8872e', bg: 'rgba(200,135,46,0.08)', border: 'rgba(200,135,46,0.2)', label: 'Stock bajo', Icon: AlertCircle },
    low: { color: '#b89a2e', bg: 'rgba(184,154,46,0.08)', border: 'rgba(184,154,46,0.2)', label: 'Atención', Icon: AlertTriangle },
  };

  const filters: FilterOption[] = [
    { key: 'all', label: 'Todas', count: alertas.total },
    { key: 'critical', label: 'Críticas', count: alertas.criticas, color: '#c94444' },
    { key: 'warning', label: 'Alerta', count: alertas.advertencias, color: '#c8872e' },
    { key: 'low', label: 'Bajas', count: alertas.bajas, color: '#b89a2e' },
  ];

  return (
    <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
      <div className="hidden" />

      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ background: 'rgba(201,68,68,0.12)' }}>
              <ShieldAlert size={18} style={{ color: '#c94444' }} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-200 text-sm">Alertas de Stock</h3>
              <p className="text-[11px]" style={{ color: 'rgba(148,163,184,0.5)' }}>Productos que requieren atención</p>
            </div>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold" style={{ background: 'rgba(201,68,68,0.1)', color: '#cc5555' }}>
            {alertas.total}
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex gap-1.5 mb-4">
          {filters.map((f: FilterOption) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: activeFilter === f.key ? (f.color ? `${f.color}18` : 'rgba(255,255,255,0.08)') : 'rgba(255,255,255,0.03)',
                color: activeFilter === f.key ? (f.color || '#e2e8f0') : 'rgba(148,163,184,0.6)',
                border: `1px solid ${activeFilter === f.key ? (f.color ? `${f.color}30` : 'rgba(255,255,255,0.1)') : 'transparent'}`,
              }}
            >
              <span>{f.label}</span>
              <span className="font-bold">{f.count}</span>
            </button>
          ))}
        </div>

        {/* Alert items */}
        <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(51,65,85,0.5) transparent' }}>
          {filteredItems.map((item: AlertaItem) => {
            const cfg = levelConfig[item.nivel];
            const IconComp = cfg.Icon;
            return (
              <div
                key={item.codigo}
                className="flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all hover:border-slate-700"
                style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex-shrink-0"><IconComp size={15} style={{ color: cfg.color }} /></span>
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-slate-200 truncate">{item.descripcion}</div>
                    <div className="text-[11px]" style={{ color: 'rgba(148,163,184,0.5)' }}>
                      {item.codigo} · <span style={{ color: cfg.color }}>
                        {item.stock === 0 ? 'Sin stock' : `${item.stock} / ${item.stockMin} min`}
                      </span>
                    </div>
                  </div>
                </div>
                {item.dias !== null && (
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                    <span className="text-xs font-mono font-bold" style={{ color: cfg.color }}>
                      {item.dias === 0 ? 'HOY' : `${item.dias}d`}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filteredItems.length < alertas.total && (
          <button className="w-full mt-3 py-2 rounded-lg text-xs font-medium transition-all" style={{ color: 'rgba(148,163,184,0.5)' }}>
            Ver {alertas.total - filteredItems.length} alertas más
          </button>
        )}

        {/* CTA */}
        <button className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-[1.01]" style={{
          background: 'linear-gradient(135deg, rgba(61,154,95,0.15), rgba(6,182,212,0.15))',
          border: '1px solid rgba(61,154,95,0.2)',
          color: '#4aaa73',
        }}>
          <PackagePlus size={16} />
          <span>Crear orden de compra</span>
          <ArrowRight size={16} />
        </button>
      </div>
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

  const catColors: Record<string, string> = {
    'Estación': '#3d9a5f',
    'Ferretería': '#4a7fb5',
    'Papelería': '#836ba0',
  };

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(15,23,42,0.8))', border: '1px solid rgba(51,65,85,0.3)' }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 10% 80%, rgba(6,182,212,0.04), transparent 60%)' }} />

      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ background: 'rgba(6,182,212,0.12)' }}>
              <BarChart3 size={18} className="text-cyan-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-200 text-sm">Productos Más Consumidos</h3>
              <p className="text-[11px]" style={{ color: 'rgba(148,163,184,0.5)' }}>Ranking por unidades salidas</p>
            </div>
          </div>

          {/* Period selector */}
          <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
            {periods.map((p: PeriodOption) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-all"
                style={{
                  background: period === p.key ? 'rgba(6,182,212,0.15)' : 'transparent',
                  color: period === p.key ? '#6b8baa' : 'rgba(148,163,184,0.5)',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Product rows */}
        <div className="space-y-3">
          {data.map((item: ConsumoItem, i: number) => {
            const pct = (item.cantidad / maxVal) * 100;
            const delta = ((item.cantidad - item.prevCantidad) / item.prevCantidad * 100).toFixed(0);
            const isUp = parseFloat(delta) >= 0;
            const barColor = catColors[item.categoria] || '#64748b';

            return (
              <div key={item.codigo} className="group cursor-pointer">
                <div className="flex items-center gap-3">
                  {/* Rank */}
                  <div className="w-5 text-center">
                    <span className="text-[11px] font-bold" style={{ color: i < 3 ? '#6b8baa' : 'rgba(148,163,184,0.3)' }}>
                      {i + 1}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm text-slate-200 font-medium truncate group-hover:text-white transition-colors">
                          {item.descripcion}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0" style={{
                          background: `${barColor}15`,
                          color: `${barColor}cc`,
                        }}>
                          {item.categoria}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 flex-shrink-0 ml-3">
                        <span className="text-sm font-bold text-white font-mono">{item.cantidad}</span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{
                          background: isUp ? 'rgba(61,154,95,0.1)' : 'rgba(201,68,68,0.1)',
                          color: isUp ? '#4aaa73' : '#cc5555',
                        }}>
                          {isUp ? '+' : ''}{delta}%
                        </span>
                      </div>
                    </div>

                    {/* Bar */}
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-700 group-hover:opacity-90"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${barColor}cc, ${barColor}44)`,
                        }}
                      />
                    </div>
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
// AI INSIGHTS PANEL
// ============================================

interface InsightsPanelProps {
  insights: InsightItem[];
}

function InsightsPanel({ insights }: InsightsPanelProps) {
  const typeConfig: Record<InsightTipo, InsightConfig> = {
    urgente: { color: '#c94444', bg: 'rgba(201,68,68,0.06)', border: 'rgba(201,68,68,0.15)', Icon: Flame },
    tendencia: { color: '#3d9a5f', bg: 'rgba(61,154,95,0.06)', border: 'rgba(61,154,95,0.15)', Icon: TrendingUp },
    alerta: { color: '#c8872e', bg: 'rgba(200,135,46,0.06)', border: 'rgba(200,135,46,0.15)', Icon: AlertCircle },
  };

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(15,23,42,0.8))', border: '1px solid rgba(51,65,85,0.3)' }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(107,84,136,0.05), transparent 60%)' }} />

      <div className="relative p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl" style={{ background: 'rgba(107,84,136,0.12)' }}>
            <Brain size={18} className="text-violet-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
              Insights
              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded" style={{ background: 'rgba(107,84,136,0.15)', color: '#836ba0' }}>AI</span>
            </h3>
            <p className="text-[11px]" style={{ color: 'rgba(148,163,184,0.5)' }}>Lo que necesitás saber ahora</p>
          </div>
        </div>

        <div className="space-y-3">
          {insights.map((insight: InsightItem, i: number) => {
            const cfg = typeConfig[insight.tipo];
            const IconComp = cfg.Icon;
            return (
              <div
                key={i}
                className="p-4 rounded-xl cursor-pointer transition-all hover:scale-[1.01]"
                style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 mt-0.5"><IconComp size={18} style={{ color: cfg.color }} /></span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-slate-200 mb-1">{insight.titulo}</div>
                    <p className="text-xs leading-relaxed" style={{ color: 'rgba(148,163,184,0.7)' }}>{insight.descripcion}</p>
                    <button className="mt-2.5 text-xs font-semibold flex items-center gap-1 transition-colors" style={{ color: cfg.color }}>
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
    <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
      <div className="relative p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-lg bg-slate-800">
            <Activity size={18} className="text-slate-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-200 text-sm">Actividad Reciente</h3>
            <p className="text-[11px]" style={{ color: 'rgba(148,163,184,0.5)' }}>Últimos movimientos de inventario</p>
          </div>
        </div>

        <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(51,65,85,0.5) transparent' }}>
          {groupedByTime.map(([time, items]: [string, ActividadItem[]]) => (
            <div key={time}>
              {/* Time label */}
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px flex-1" style={{ background: 'rgba(51,65,85,0.3)' }} />
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(148,163,184,0.5)' }}>
                  hace {time}
                </span>
                <div className="h-px flex-1" style={{ background: 'rgba(51,65,85,0.3)' }} />
              </div>

              {/* Items */}
              <div className="space-y-1.5">
                {items.map((item: ActividadItem, i: number) => (
                  <div
                    key={`${item.descripcion}-${i}`}
                    className="flex items-center justify-between p-2.5 rounded-xl transition-all hover:scale-[1.005]"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(51,65,85,0.2)' }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0" style={{
                        background: item.tipo === 'entrada' ? 'rgba(61,154,95,0.12)' : 'rgba(201,68,68,0.12)',
                        color: item.tipo === 'entrada' ? '#4aaa73' : '#cc5555',
                      }}>
                        {item.tipo === 'entrada' ? '+' : '\u2212'}{item.cantidad}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm text-slate-200 truncate">{item.descripcion}</div>
                        <div className="text-[10px]" style={{ color: 'rgba(148,163,184,0.4)' }}>{item.usuario}</div>
                      </div>
                    </div>
                    <span className="text-[10px] flex-shrink-0 ml-2 px-2 py-0.5 rounded" style={{
                      background: item.tipo === 'entrada' ? 'rgba(61,154,95,0.08)' : 'rgba(201,68,68,0.08)',
                      color: item.tipo === 'entrada' ? 'rgba(74,170,115,0.6)' : 'rgba(204,85,85,0.6)',
                    }}>
                      {item.tipo}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
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