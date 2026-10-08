'use client';

// =====================================================
// Reportes de insumos en USD (Comercial → Análisis de insumos)
// =====================================================
// El usuario elige cualquier período (también historial antiguo), ve una
// vista previa y descarga el PDF con el símbolo de Vanguard. Todo en
// dólares: lo cargado en USD se toma tal cual y lo cargado en pesos se
// convierte con la referencia de 40 UYU por dólar.
// =====================================================

import React, { useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  AlertTriangle, CalendarRange, Download, FileSpreadsheet, FileText, Info, Loader2,
  PackageMinus, Scale, ShoppingCart, TrendingDown, TrendingUp, Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';
import { useOrganizacion } from '@/hooks/useOrganizacion';
import { cargarReporteInsumosUSD } from '@/lib/reportes/insumos-usd-data';
import {
  agruparSerie, fmtFecha, fmtNum, fmtUsd, TASA_REPORTE_UYU_POR_USD, type ReporteInsumosUSD,
} from '@/lib/reportes/insumos-usd';

type Preset = 'mes' | 'mes_anterior' | 'tres_meses' | 'doce_meses' | 'anio' | 'anio_anterior' | 'todo' | 'custom';

const PRESETS: Array<{ id: Exclude<Preset, 'custom'>; label: string }> = [
  { id: 'mes', label: 'Este mes' },
  { id: 'mes_anterior', label: 'Mes anterior' },
  { id: 'tres_meses', label: 'Últimos 3 meses' },
  { id: 'doce_meses', label: 'Últimos 12 meses' },
  { id: 'anio', label: 'Este año' },
  { id: 'anio_anterior', label: 'Año anterior' },
  { id: 'todo', label: 'Todo el historial' },
];

const INICIO_HISTORIAL = new Date(2000, 0, 1);

function rangoPreset(p: Exclude<Preset, 'custom'>): { desde: Date; hasta: Date } {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = hoy.getMonth();
  const finHoy = new Date(y, m, hoy.getDate(), 23, 59, 59, 999);
  switch (p) {
    case 'mes': return { desde: new Date(y, m, 1), hasta: finHoy };
    case 'mes_anterior': return { desde: new Date(y, m - 1, 1), hasta: new Date(y, m, 0, 23, 59, 59, 999) };
    case 'tres_meses': return { desde: new Date(y, m - 2, 1), hasta: finHoy };
    case 'doce_meses': return { desde: new Date(y, m - 11, 1), hasta: finHoy };
    case 'anio': return { desde: new Date(y, 0, 1), hasta: finHoy };
    case 'anio_anterior': return { desde: new Date(y - 1, 0, 1), hasta: new Date(y - 1, 11, 31, 23, 59, 59, 999) };
    case 'todo': return { desde: INICIO_HISTORIAL, hasta: finHoy };
  }
}

const aInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function desdeInput(s: string, finDelDia: boolean): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = finDelDia
    ? new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 59, 999)
    : new Date(+m[1], +m[2] - 1, +m[3]);
  return Number.isNaN(d.getTime()) ? null : d;
}

function exportarCsv(rep: ReporteInsumosUSD) {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const num = (n: number) => n.toFixed(2).replace('.', ',');
  const filas: Array<Array<string | number>> = [
    ['Tipo', 'Fecha', 'Código', 'Descripción', 'Categoría', 'Cantidad', 'Costo unit. original', 'Moneda original', 'Costo unit. USD', 'Total USD', 'Usuario', 'Notas'],
    ...rep.compras.map(c => ['Compra', fmtFecha(c.fecha), c.codigo, c.descripcion, c.categoria, c.cantidad, num(c.costoUnitOriginal), c.monedaOriginal, num(c.costoUnitUsd), num(c.totalUsd), c.usuario, c.notas]),
    ...rep.consumos.map(c => [c.ordenInterna ? 'Orden interna' : 'Salida', fmtFecha(c.fecha), c.codigo, c.descripcion, c.categoria, c.cantidad, '', '', num(c.costoUnitUsd), num(c.totalUsd), c.usuario, c.notas]),
  ];
  const csv = filas.map(f => f.map(esc).join(';')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Vanguard_Reporte_Insumos_USD_${aInput(rep.desde)}_al_${aInput(rep.hasta)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------
// Piezas visuales
// ---------------------------------------------------

function Kpi({ icon, label, value, hint, tone = 'blue', small }: {
  icon: React.ReactNode; label: string; value: string; hint?: string;
  tone?: 'blue' | 'sky' | 'emerald' | 'red' | 'slate'; small?: boolean;
}) {
  const tones = {
    blue: 'bg-blue-500/10 text-blue-400',
    sky: 'bg-cyan-500/10 text-cyan-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
    red: 'bg-red-500/10 text-red-400',
    slate: 'bg-slate-800 text-slate-300',
  };
  return (
    <div className={cn('rounded-2xl bg-slate-900 border border-slate-800', small ? 'p-4' : 'p-5')}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        <span className={cn('p-1.5 rounded-lg', tones[tone])}>{icon}</span>
      </div>
      <div className={cn('mt-2 font-bold text-white tabular-nums leading-tight', small ? 'text-xl' : 'text-2xl')}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

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

// ---------------------------------------------------
// Componente principal
// ---------------------------------------------------

export default function ReportesInsumosUSD({ userEmail }: { userEmail?: string }) {
  const { orgActiva } = useOrganizacion();
  const inicial = rangoPreset('mes');
  const [preset, setPreset] = useState<Preset>('mes');
  const [desdeStr, setDesdeStr] = useState(aInput(inicial.desde));
  const [hastaStr, setHastaStr] = useState(aInput(inicial.hasta));
  const [cargando, setCargando] = useState(false);
  const [paso, setPaso] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [reporte, setReporte] = useState<ReporteInsumosUSD | null>(null);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  const desde = preset === 'todo' ? INICIO_HISTORIAL : desdeInput(desdeStr, false);
  const hasta = desdeInput(hastaStr, true);
  const rangoValido = !!desde && !!hasta && desde.getTime() <= hasta.getTime();

  const elegirPreset = (p: Exclude<Preset, 'custom'>) => {
    const r = rangoPreset(p);
    setPreset(p);
    setDesdeStr(p === 'todo' ? '' : aInput(r.desde));
    setHastaStr(aInput(r.hasta));
    setReporte(null);
    setError(null);
  };

  const generar = async () => {
    if (!rangoValido || !desde || !hasta) return;
    setCargando(true);
    setError(null);
    setReporte(null);
    try {
      const r = await cargarReporteInsumosUSD(desde, hasta, p => setPaso(p.paso), { todoElHistorial: preset === 'todo' });
      setReporte(r);
    } catch (e: any) {
      setError(e?.message || 'No se pudo generar el reporte');
    } finally {
      setCargando(false);
      setPaso('');
    }
  };

  const descargarPdf = async () => {
    if (!reporte) return;
    setGenerandoPdf(true);
    try {
      const { construirPdfReporteInsumos, nombreArchivoReporte } = await import('@/lib/reportes/insumos-usd-pdf');
      const doc = await construirPdfReporteInsumos(reporte, { usuario: userEmail, empresa: orgActiva?.nombre });
      doc.save(nombreArchivoReporte(reporte));
    } catch (e: any) {
      alert(`No se pudo generar el PDF: ${e?.message || e}`);
    } finally {
      setGenerandoPdf(false);
    }
  };

  const serie = useMemo(() => (reporte ? agruparSerie(reporte.mensual) : []), [reporte]);
  const k = reporte?.kpis;

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="absolute -right-6 -top-8 opacity-[0.07] pointer-events-none">
          <Logo size={170} />
        </div>
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Logo size={44} />
            <div>
              <h3 className="text-lg font-bold text-white">Reportes de insumos</h3>
              <p className="text-sm text-slate-400">Compras, consumos y evolución de costos. Siempre en dólares.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 font-medium">
            <Scale size={13} /> USD · pesos a {fmtNum(TASA_REPORTE_UYU_POR_USD)} UYU por dólar
          </div>
        </div>
      </div>

      {/* Período */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <CalendarRange size={16} className="text-blue-400" /> Período del reporte
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => elegirPreset(p.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors',
                preset === p.id
                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                  : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <span className="block text-xs text-slate-500">Desde</span>
            <input
              type="date"
              value={preset === 'todo' ? '' : desdeStr}
              placeholder="Inicio del historial"
              onChange={e => { setDesdeStr(e.target.value); setPreset('custom'); setReporte(null); }}
              className="vg-date h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-slate-500">Hasta</span>
            <input
              type="date"
              value={hastaStr}
              onChange={e => { setHastaStr(e.target.value); if (preset !== 'todo') setPreset('custom'); setReporte(null); }}
              className="vg-date h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </label>
          <button
            type="button"
            onClick={generar}
            disabled={!rangoValido || cargando}
            className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
          >
            {cargando ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
            Generar reporte
          </button>
          <span className="text-xs text-slate-500 pb-2.5">
            {preset === 'todo'
              ? 'Desde el primer registro hasta la fecha elegida'
              : !rangoValido ? 'Revisá las fechas: "Desde" debe ser anterior a "Hasta"' : ''}
          </span>
        </div>
      </div>

      {cargando && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 flex flex-col items-center gap-3 text-slate-400">
          <Loader2 size={26} className="animate-spin text-blue-400" />
          <span className="text-sm">{paso || 'Preparando reporte'}…</span>
          <span className="text-xs text-slate-500">Se recorre todo el historial de costos para valorizar cada consumo.</span>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {reporte && k && !cargando && (
        <div className="space-y-5">
          {/* Barra de acciones */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-5 py-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Reporte listo</div>
              <div className="text-sm text-slate-200 font-medium">
                Del {fmtFecha(reporte.desde)} al {fmtFecha(reporte.hasta)}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => exportarCsv(reporte)}
                className="h-10 px-4 rounded-xl border border-slate-700 text-sm text-slate-300 hover:text-white hover:border-slate-600 inline-flex items-center gap-2 transition-colors"
              >
                <FileSpreadsheet size={16} /> Exportar CSV
              </button>
              <button
                type="button"
                onClick={descargarPdf}
                disabled={generandoPdf}
                className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60 shadow-lg shadow-blue-500/20"
              >
                {generandoPdf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                Descargar PDF
              </button>
            </div>
          </div>

          {/* Indicadores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Kpi icon={<ShoppingCart size={16} />} label="Compras" value={fmtUsd(k.comprasUsd)}
              hint={`${fmtNum(k.cantidadCompras)} compras · ${fmtNum(k.unidadesCompradas)} uds.`} />
            <Kpi icon={<PackageMinus size={16} />} label="Consumo" tone="sky" value={fmtUsd(k.consumoUsd)}
              hint={`${fmtNum(k.cantidadConsumos)} salidas · ${fmtNum(k.ordenesInternas)} órdenes internas`} />
            <Kpi icon={<Scale size={16} />} label="Compras - consumo" tone={k.netoUsd >= 0 ? 'emerald' : 'red'} value={fmtUsd(k.netoUsd)}
              hint={k.netoUsd >= 0 ? 'Aumento neto de stock' : 'Reducción neta de stock'} />
            <Kpi icon={<Wallet size={16} />} label="Inventario hoy" tone="slate"
              value={k.inventarioActualUsd != null ? fmtUsd(k.inventarioActualUsd) : '—'} hint="Insumos valorizados al costo" />
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <Kpi small icon={<FileText size={14} />} label="Solicitudes" value={fmtNum(k.solicitudes)}
              hint={`${fmtNum(k.solicitudesRecibidas)} recibidas · ${fmtNum(k.solicitudesAbiertas)} abiertas`} />
            <Kpi small icon={<ShoppingCart size={14} />} label="Estimado solicitado" value={fmtUsd(k.estimadoSolicitudesUsd)} hint="Sin contar las canceladas" />
            <Kpi small icon={<TrendingUp size={14} />} label="Subas de precio" tone={k.insumosConAumento > 0 ? 'red' : 'emerald'}
              value={fmtNum(k.insumosConAumento)} hint={`${fmtNum(k.insumosConBaja)} bajaron de precio`} />
            <Kpi small icon={<PackageMinus size={14} />} label="Insumos movidos" tone="slate" value={fmtNum(k.insumosConMovimiento)}
              hint={`${fmtNum(k.otrosIngresosUnidades)} uds. ingresaron sin costo`} />
          </div>

          {/* Evolución + categorías */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            <div className="xl:col-span-3 rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-slate-200">Evolución de compras y consumo</h4>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-600" /> Compras</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-300" /> Consumo</span>
                </div>
              </div>
              {serie.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-sm text-slate-500">Sin compras ni consumos en el período.</div>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={serie} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                      <XAxis dataKey="etiqueta" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={64}
                        tickFormatter={(v: number) => (v >= 1000 ? `US$ ${fmtNum(v / 1000, 1)}k` : `US$ ${fmtNum(v)}`)} />
                      <Tooltip content={<TooltipUsd />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                      <Bar dataKey="comprasUsd" name="Compras" fill="#2f6fdc" radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="consumoUsd" name="Consumo" fill="#8bbcff" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <div className="xl:col-span-2 rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h4 className="text-sm font-semibold text-slate-200 mb-4">Gasto por categoría</h4>
              {reporte.porCategoria.length === 0 ? (
                <div className="text-sm text-slate-500">Sin movimientos valorizados.</div>
              ) : (
                <div className="space-y-3.5">
                  {reporte.porCategoria.slice(0, 7).map(c => (
                    <div key={c.categoria}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-300 truncate">{c.categoria}</span>
                        <span className="font-mono text-slate-400 text-xs">{fmtUsd(c.comprasUsd + c.consumoUsd)} · {fmtNum(c.participacion, 1)} %</span>
                      </div>
                      <div className="mt-1.5 h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400" style={{ width: `${Math.max(2, c.participacion)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Variación de precios */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <h4 className="text-sm font-semibold text-slate-200">Variación de precios de compra</h4>
              <p className="text-xs text-slate-500 mt-0.5">Un mismo insumo comprado a distintos precios: referencia = última compra antes del período (o la primera dentro).</p>
            </div>
            {reporte.variacionPrecios.length === 0 ? (
              <div className="px-5 pb-5 text-sm text-slate-500">No hay cambios de precio para comparar (se necesitan al menos dos compras de un mismo insumo).</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-900/80">
                    <tr className="text-xs uppercase tracking-wider text-slate-500">
                      <th className="px-5 py-2.5 text-left font-semibold">Insumo</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Precio inicial</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Precio final</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Mín. / Máx.</th>
                      <th className="px-5 py-2.5 text-right font-semibold">Variación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {reporte.variacionPrecios.slice(0, 10).map(v => (
                      <tr key={v.codigo} className="hover:bg-slate-800/30">
                        <td className="px-5 py-2.5">
                          <div className="text-slate-200">{v.descripcion}</div>
                          <div className="text-xs font-mono text-slate-500">{v.codigo} · {v.compras} compra{v.compras === 1 ? '' : 's'} en el período</div>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="font-mono text-slate-300">{fmtUsd(v.precioInicialUsd)}</div>
                          <div className="text-xs text-slate-500">{fmtFecha(v.fechaInicial)}</div>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="font-mono text-slate-300">{fmtUsd(v.precioFinalUsd)}</div>
                          <div className="text-xs text-slate-500">{fmtFecha(v.fechaFinal)}</div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs text-slate-400">{fmtUsd(v.minUsd)} / {fmtUsd(v.maxUsd)}</td>
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

          {/* Insumos con mayor gasto */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <h4 className="text-sm font-semibold text-slate-200">Insumos con mayor gasto</h4>
            </div>
            {reporte.porProducto.length === 0 ? (
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
                    {[...reporte.porProducto].sort((a, b) => b.totalUsd - a.totalUsd).slice(0, 10).map(p => (
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

          {/* Notas */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-500 space-y-1.5">
            <div className="flex items-center gap-2 text-slate-400 font-medium"><Info size={14} /> Cómo se calcula</div>
            <p>Compras al precio real de cada compra (USD tal cual; pesos ÷ {fmtNum(reporte.tasa)}). Consumos al costo promedio móvil vigente en cada fecha, usando todo el historial.</p>
            <p>El PDF incluye además el detalle completo de {fmtNum(reporte.compras.length)} compras y {fmtNum(reporte.consumos.length)} consumos.</p>
            {reporte.advertencias.map(a => (
              <p key={a} className="text-amber-400 flex items-start gap-1.5"><AlertTriangle size={12} className="mt-0.5 shrink-0" /> {a}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
