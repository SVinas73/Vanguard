'use client';

// =====================================================
// Piezas visuales compartidas: Análisis de insumos y Reporte en USD
// =====================================================

import React, { useEffect, useRef, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Check, ChevronDown, Tags, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ETIQUETA_GRANULARIDAD, fmtFecha, fmtNum, fmtUsd,
  type CategoriaDisponible, type FilaCategoria, type FilaSerie, type Granularidad,
  type ResumenProducto, type VariacionPrecio,
} from '@/lib/reportes/insumos-usd';

// ---------------------------------------------------
// Indicador
// ---------------------------------------------------
type Tono = 'blue' | 'sky' | 'emerald' | 'red' | 'amber' | 'slate';
const TONOS: Record<Tono, string> = {
  blue: 'bg-blue-500/10 text-blue-400',
  sky: 'bg-cyan-500/10 text-cyan-400',
  emerald: 'bg-emerald-500/10 text-emerald-400',
  red: 'bg-red-500/10 text-red-400',
  amber: 'bg-amber-500/10 text-amber-400',
  slate: 'bg-slate-800 text-slate-300',
};

export function Kpi({ icon, label, value, hint, tone = 'blue', small }: {
  icon: React.ReactNode; label: string; value: string; hint?: string; tone?: Tono; small?: boolean;
}) {
  return (
    <div className={cn('rounded-2xl bg-slate-900 border border-slate-800', small ? 'p-4' : 'p-5')}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        <span className={cn('p-1.5 rounded-lg', TONOS[tone])}>{icon}</span>
      </div>
      <div className={cn('mt-2 font-bold text-white tabular-nums leading-tight', small ? 'text-xl' : 'text-2xl')}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

// ---------------------------------------------------
// Selector de categorías (varias a la vez)
// ---------------------------------------------------
export function SelectorCategorias({ disponibles, seleccion, onChange, className }: {
  disponibles: CategoriaDisponible[];
  seleccion: string[];
  onChange: (claves: string[]) => void;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc); };
  }, [abierto]);

  const set = new Set(seleccion);
  const alternar = (clave: string) => {
    const n = new Set(set);
    if (n.has(clave)) n.delete(clave); else n.add(clave);
    onChange(Array.from(n));
  };
  const nombres = disponibles.filter(c => set.has(c.clave)).map(c => c.etiqueta);
  const texto = nombres.length === 0
    ? 'Todas las categorías'
    : nombres.length <= 2 ? nombres.join(', ') : `${nombres.length} categorías`;

  return (
    <div ref={ref} className={cn('relative w-full sm:w-72', className)}>
      <button
        type="button"
        onClick={() => setAbierto(a => !a)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        className={cn(
          'w-full h-11 px-3 rounded-xl flex items-center gap-2.5 text-left border-2 transition-all',
          nombres.length > 0 ? 'bg-blue-500/10 border-blue-500/50' : 'bg-slate-900 border-slate-700 hover:border-slate-600',
          abierto && 'ring-4 ring-blue-500/10',
        )}
      >
        <Tags size={15} className="text-blue-400 shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Categoría</span>
          <span className="block truncate text-sm font-medium text-white">{texto}</span>
        </span>
        <ChevronDown size={15} className={cn('text-slate-500 transition-transform', abierto && 'rotate-180')} />
      </button>
      {abierto && (
        <div role="listbox" aria-multiselectable className="absolute z-40 mt-2 w-full rounded-xl bg-slate-900 border border-slate-700 shadow-2xl shadow-black/40 p-1.5 max-h-80 overflow-y-auto">
          <button
            type="button"
            onClick={() => onChange([])}
            className={cn('w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
              set.size === 0 ? 'bg-blue-500/10 text-blue-400' : 'text-slate-200 hover:bg-slate-800')}
          >
            <span className="flex-1 text-left font-medium">Todas las categorías</span>
            {set.size === 0 && <Check size={14} />}
          </button>
          <div className="my-1 border-t border-slate-800" />
          {disponibles.length === 0 && <div className="px-3 py-2 text-xs text-slate-500">Sin categorías</div>}
          {disponibles.map(c => {
            const activa = set.has(c.clave);
            return (
              <button
                key={c.clave}
                type="button"
                role="option"
                aria-selected={activa}
                onClick={() => alternar(c.clave)}
                className={cn('w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                  activa ? 'bg-blue-500/10 text-blue-400' : 'text-slate-200 hover:bg-slate-800')}
              >
                <span className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0',
                  activa ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-600')}>
                  {activa && <Check size={11} />}
                </span>
                <span className="flex-1 text-left truncate">{c.etiqueta}</span>
                <span className="text-xs font-mono text-slate-500">{c.insumos}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------
// Gráfico compras vs consumo (USD)
// ---------------------------------------------------
function TooltipUsd({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 shadow-xl text-xs">
      <div className="font-semibold text-slate-200 mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-slate-400">
          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: p.color }} />
          {p.name}: <span className="font-mono text-slate-200">{fmtUsd(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function GraficoComprasConsumo({ serie, granularidad, alto = 240 }: {
  serie: FilaSerie[]; granularidad: Granularidad; alto?: number;
}) {
  const vacio = serie.every(s => s.comprasUsd === 0 && s.consumoUsd === 0);
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h4 className="text-sm font-semibold text-slate-200">Compras y consumo</h4>
          <p className="text-xs text-slate-500">En USD, por {ETIQUETA_GRANULARIDAD[granularidad]}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-600" /> Compras</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-300" /> Consumo</span>
        </div>
      </div>
      {vacio ? (
        <div className="flex items-center justify-center text-sm text-slate-500" style={{ height: alto }}>
          Sin compras ni consumos en el período.
        </div>
      ) : (
        <div style={{ height: alto }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={serie} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
              <XAxis dataKey="etiqueta" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} minTickGap={12} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={70}
                tickFormatter={(v: number) => (v >= 1000 ? `US$ ${fmtNum(v / 1000, 1)}k` : `US$ ${fmtNum(v)}`)} />
              <Tooltip content={<TooltipUsd />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
              <Bar dataKey="comprasUsd" name="Compras" fill="#2f6fdc" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="consumoUsd" name="Consumo" fill="#8bbcff" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------
// Gasto por categoría
// ---------------------------------------------------
export function BarrasCategoria({ filas, titulo = 'Gasto por categoría' }: { filas: FilaCategoria[]; titulo?: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <h4 className="text-sm font-semibold text-slate-200 mb-4">{titulo}</h4>
      {filas.length === 0 ? (
        <div className="text-sm text-slate-500">Sin compras ni consumos en el período.</div>
      ) : (
        <div className="space-y-3.5">
          {filas.slice(0, 8).map(c => (
            <div key={c.categoria}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-300 truncate">{c.categoria}</span>
                <span className="font-mono text-slate-400 text-xs whitespace-nowrap">{fmtUsd(c.comprasUsd + c.consumoUsd)} · {fmtNum(c.participacion, 1)} %</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400" style={{ width: `${Math.max(2, c.participacion)}%` }} />
              </div>
              <div className="mt-1 flex gap-3 text-[11px] text-slate-500">
                <span>Compras {fmtUsd(c.comprasUsd)}</span>
                <span>Consumo {fmtUsd(c.consumoUsd)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------
// Variación de precios de compra
// ---------------------------------------------------
export function TablaVariacionPrecios({ filas, limite = 10, compacta }: { filas: VariacionPrecio[]; limite?: number; compacta?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h4 className="text-sm font-semibold text-slate-200">Variación de precios de compra</h4>
        <p className="text-xs text-slate-500 mt-0.5">Cada compra a su precio real. Referencia: última compra antes del período (o la primera dentro).</p>
      </div>
      {filas.length === 0 ? (
        <div className="px-5 pb-5 text-sm text-slate-500">Sin cambios de precio para comparar (hacen falta al menos dos compras con costo de un mismo insumo).</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/80">
              <tr className="text-xs uppercase tracking-wider text-slate-500">
                <th className="px-5 py-2.5 text-left font-semibold">Insumo</th>
                <th className="px-3 py-2.5 text-right font-semibold">Antes</th>
                <th className="px-3 py-2.5 text-right font-semibold">Ahora</th>
                {!compacta && <th className="px-3 py-2.5 text-right font-semibold">Mín. / Máx.</th>}
                <th className="px-5 py-2.5 text-right font-semibold">Variación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filas.slice(0, limite).map(v => (
                <tr key={v.codigo} className="hover:bg-slate-800/30">
                  <td className="px-5 py-2.5">
                    <div className="text-slate-200">{v.descripcion}</div>
                    <div className="text-xs font-mono text-slate-500">{v.codigo} · {v.compras} compra{v.compras === 1 ? '' : 's'}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="font-mono text-slate-300">{fmtUsd(v.precioInicialUsd)}</div>
                    <div className="text-xs text-slate-500">{fmtFecha(v.fechaInicial)}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="font-mono text-slate-300">{fmtUsd(v.precioFinalUsd)}</div>
                    <div className="text-xs text-slate-500">{fmtFecha(v.fechaFinal)}</div>
                  </td>
                  {!compacta && <td className="px-3 py-2.5 text-right font-mono text-xs text-slate-400">{fmtUsd(v.minUsd)} / {fmtUsd(v.maxUsd)}</td>}
                  <td className="px-5 py-2.5 text-right">
                    <span className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold',
                      v.variacionPct > 0.5 ? 'bg-red-500/10 text-red-400' : v.variacionPct < -0.5 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400',
                    )}>
                      {v.variacionPct > 0.5 ? <TrendingUp size={12} /> : v.variacionPct < -0.5 ? <TrendingDown size={12} /> : null}
                      {v.variacionPct > 0 ? '+' : ''}{fmtNum(v.variacionPct, 1)} %
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------
// Insumos con mayor gasto
// ---------------------------------------------------
export function TablaTopInsumos({ filas, limite = 10, titulo = 'Insumos con mayor gasto', orden = 'total' }: {
  filas: ResumenProducto[]; limite?: number; titulo?: string; orden?: 'total' | 'consumo';
}) {
  const lista = [...filas]
    .sort((a, b) => (orden === 'consumo' ? b.consumoUsd - a.consumoUsd : b.totalUsd - a.totalUsd))
    .filter(p => (orden === 'consumo' ? p.consumoUsd > 0 : true))
    .slice(0, limite);
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h4 className="text-sm font-semibold text-slate-200">{titulo}</h4>
      </div>
      {lista.length === 0 ? (
        <div className="px-5 pb-5 text-sm text-slate-500">Sin insumos con movimiento en el período.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/80">
              <tr className="text-xs uppercase tracking-wider text-slate-500">
                <th className="px-5 py-2.5 text-left font-semibold">Insumo</th>
                <th className="px-3 py-2.5 text-right font-semibold">Uds. compradas</th>
                <th className="px-3 py-2.5 text-right font-semibold">Costo prom. compra</th>
                <th className="px-3 py-2.5 text-right font-semibold">Compras</th>
                <th className="px-3 py-2.5 text-right font-semibold">Uds. consumidas</th>
                <th className="px-5 py-2.5 text-right font-semibold">Consumo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {lista.map(p => (
                <tr key={p.codigo} className="hover:bg-slate-800/30">
                  <td className="px-5 py-2.5">
                    <div className="text-slate-200">{p.descripcion}</div>
                    <div className="text-xs font-mono text-slate-500">{p.codigo} · {p.categoria}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-400">{fmtNum(p.unidadesCompradas)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-400">{p.unidadesCompradas > 0 ? fmtUsd(p.costoPromCompraUsd) : '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-200">{fmtUsd(p.comprasUsd)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-400">{fmtNum(p.unidadesConsumidas)}</td>
                  <td className="px-5 py-2.5 text-right font-mono text-slate-200">{fmtUsd(p.consumoUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
