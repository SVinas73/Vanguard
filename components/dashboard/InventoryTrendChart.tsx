'use client';

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp } from 'lucide-react';

interface InventoryTrendChartProps {
  movements: any[];
  products: any[];
  days?: number;
}

export function InventoryTrendChart({ movements, products, days = 30 }: InventoryTrendChartProps) {
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
    return { entradas: totalEntradas, salidas: totalSalidas, neto: totalEntradas - totalSalidas };
  }, [chartData]);

  return (
    <div className="rounded-xl p-6 bg-slate-900 border border-slate-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-800">
            <TrendingUp size={18} className="text-slate-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-200 text-sm">Flujo de Inventario</h3>
            <p className="text-[11px] text-slate-500">Entradas vs Salidas en valor ($) — últimos {days} días</p>
          </div>
        </div>
        {hasData && (
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-slate-500">Entradas: </span>
              <span className="font-semibold text-emerald-400">${totals.entradas.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-slate-500">Salidas: </span>
              <span className="font-semibold text-red-400">${totals.salidas.toLocaleString()}</span>
            </div>
            <div className="pl-3 border-l border-slate-800">
              <span className="text-slate-500">Neto: </span>
              <span className={`font-semibold ${totals.neto >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {totals.neto >= 0 ? '+' : ''}${totals.neto.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>

      {!hasData ? (
        <div className="flex items-center justify-center h-[200px] text-slate-600 text-sm">
          Sin movimientos en el período seleccionado
        </div>
      ) : (
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gradEntradas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3d9a5f" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3d9a5f" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradSalidas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#c94444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#c94444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" />
              <XAxis
                dataKey="date"
                tick={{ fill: 'rgba(148,163,184,0.5)', fontSize: 10 }}
                axisLine={{ stroke: 'rgba(51,65,85,0.3)' }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: 'rgba(148,163,184,0.5)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(15,23,42,0.95)',
                  border: '1px solid rgba(51,65,85,0.5)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(value: number, name: string) => [
                  `$${value.toLocaleString()}`,
                  name === 'entradas' ? 'Entradas' : 'Salidas',
                ]}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value: string) => (
                  <span style={{ color: 'rgba(148,163,184,0.7)', fontSize: '11px' }}>
                    {value === 'entradas' ? 'Entradas' : 'Salidas'}
                  </span>
                )}
              />
              <Area
                type="monotone"
                dataKey="entradas"
                stroke="#3d9a5f"
                fill="url(#gradEntradas)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="salidas"
                stroke="#c94444"
                fill="url(#gradSalidas)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
