'use client';

import { useMemo, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';

// =====================================================
// Flujo de Inventario — estilo dashboard ejecutivo
// =====================================================
// Inspirado en mockup de Claude Design:
//   - Header título + subtítulo a la izquierda
//   - Selector de período compacto a la derecha (30d/90d/1a)
//   - Gráfica área suavizada con dos series (Entradas, Salidas)
//   - Panel grande al pie con ENTRADAS / SALIDAS / NETO
// =====================================================

interface InventoryTrendChartProps {
  movements: any[];
  products: any[];
  /** Período inicial. El componente expone su propio selector. */
  days?: number;
  /** Si no quieres que muestre el selector interno, pasalo controlado. */
  showPeriodSelector?: boolean;
}

const PERIOD_OPTIONS = [
  { key: 30,  label: '30d' },
  { key: 90,  label: '90d' },
  { key: 365, label: '1a' },
];

export function InventoryTrendChart({
  movements, products, days: initialDays = 30, showPeriodSelector = true,
}: InventoryTrendChartProps) {
  const [days, setDays] = useState(initialDays);

  const chartData = useMemo(() => {
    const productCostMap = new Map(
      products.map((p: any) => [p.codigo, p.costoPromedio ?? p.precio])
    );

    const now = new Date();
    const data: Array<{ date: string; entradas: number; salidas: number; neto: number }> = [];

    for (let d = days - 1; d >= 0; d--) {
      const day = new Date(now);
      day.setDate(day.getDate() - d);
      const dayStr = day.toISOString().slice(0, 10);

      let entradas = 0;
      let salidas = 0;

      movements.forEach((m: any) => {
        const mDate = new Date(m.timestamp).toISOString().slice(0, 10);
        if (mDate === dayStr) {
          const cost = productCostMap.get(m.codigo) ?? 0;
          const value = m.cantidad * cost;
          if (m.tipo === 'entrada') entradas += value;
          else salidas += value;
        }
      });

      data.push({
        date: day.toLocaleDateString('es-UY', { day: '2-digit', month: 'short' }),
        entradas: Math.round(entradas),
        salidas: Math.round(salidas),
        neto: Math.round(entradas - salidas),
      });
    }

    return data;
  }, [movements, products, days]);

  const hasData = chartData.some(d => d.entradas > 0 || d.salidas > 0);

  const totals = useMemo(() => {
    const totalEntradas = chartData.reduce((s, d) => s + d.entradas, 0);
    const totalSalidas = chartData.reduce((s, d) => s + d.salidas, 0);
    return {
      entradas: totalEntradas,
      salidas: totalSalidas,
      neto: totalEntradas - totalSalidas,
    };
  }, [chartData]);

  const fmt = (v: number) =>
    `$${v.toLocaleString('es-UY', { minimumFractionDigits: 0 })}`;
  const fmtShort = (v: number) =>
    v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`;

  return (
    <div className="rounded-xl p-6 bg-slate-900/40 border border-slate-800">
      {/* Header: título + selector */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-slate-100 tracking-tight">
            Flujo de inventario
          </h3>
          <p className="text-sm text-slate-400 mt-0.5">
            Entradas vs salidas en valor ($) · últimos {days === 365 ? '12 meses' : `${days} días`}
          </p>
        </div>

        {showPeriodSelector && (
          <div className="flex gap-0.5 p-0.5 rounded-md bg-slate-900 border border-slate-800">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setDays(opt.key)}
                className={cn(
                  'px-3 py-1 rounded text-sm font-medium transition-colors tabular-nums',
                  days === opt.key
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-500 hover:text-slate-300',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Gráfica */}
      {!hasData ? (
        <div className="flex items-center justify-center h-[280px] text-slate-500 text-sm">
          Sin movimientos en el período seleccionado
        </div>
      ) : (
        <>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="gradEntradas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9ec9b1" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#9ec9b1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradSalidas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#dfa6a6" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#dfa6a6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'currentColor', fontSize: 11, opacity: 0.5 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={40}
                />
                <YAxis
                  tick={{ fill: 'currentColor', fontSize: 11, opacity: 0.5 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtShort}
                  width={50}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--background, #0f172a)',
                    border: '1px solid var(--surface-border, #334155)',
                    borderRadius: '8px',
                    fontSize: '13px',
                    padding: '8px 12px',
                  }}
                  labelStyle={{ color: 'var(--content-secondary, #94a3b8)' }}
                  formatter={(value: number, name: string) => [
                    fmt(value),
                    name === 'entradas' ? 'Entradas' : 'Salidas',
                  ]}
                  cursor={{ stroke: 'currentColor', strokeOpacity: 0.15, strokeWidth: 1 }}
                />
                <Area
                  type="natural"
                  dataKey="entradas"
                  stroke="#9ec9b1"
                  fill="url(#gradEntradas)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
                <Area
                  type="natural"
                  dataKey="salidas"
                  stroke="#dfa6a6"
                  fill="url(#gradSalidas)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Leyenda mini */}
          <div className="flex items-center gap-5 mt-3 mb-5 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-400" />
              <span className="text-slate-400">Entradas</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-400" />
              <span className="text-slate-400">Salidas</span>
            </div>
          </div>

          {/* Panel ENTRADAS / SALIDAS / NETO — estilo mockup */}
          <div className="grid grid-cols-3 gap-4 pt-5 border-t border-slate-800/60">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.08em] text-slate-400">
                Entradas
              </div>
              <div className="text-3xl font-bold text-emerald-400 tabular-nums mt-1 leading-none">
                {fmt(totals.entradas)}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.08em] text-slate-400">
                Salidas
              </div>
              <div className="text-3xl font-bold text-red-400 tabular-nums mt-1 leading-none">
                {fmt(totals.salidas)}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.08em] text-slate-400">
                Neto
              </div>
              <div className={cn(
                'text-3xl font-bold tabular-nums mt-1 leading-none',
                totals.neto >= 0 ? 'text-emerald-400' : 'text-red-400',
              )}>
                {totals.neto >= 0 ? '+' : ''}{fmt(Math.abs(totals.neto))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
