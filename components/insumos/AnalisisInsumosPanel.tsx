'use client';

// =====================================================
// Análisis de insumos (Comercial) — siempre en USD
// =====================================================
// Los insumos solo se compran y se usan: acá no hay ventas ni márgenes.
// Usa el MISMO motor que el Reporte en USD (lib/reportes/insumos-usd.ts),
// así los números del panel y del PDF coinciden siempre:
//   • compras al precio real de cada compra (USD tal cual, pesos ÷ 40),
//   • consumos al costo promedio móvil vigente en cada fecha,
//   • historial completo, incluso el anterior al período elegido.
// =====================================================

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, Info, Loader2, PackageMinus, PackageX, RefreshCw, Scale,
  ShoppingCart, TrendingUp, Wallet, ClipboardList, CalendarRange,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDatosInsumos } from '@/hooks/useDatosInsumos';
import { reporteDesdeDatos } from '@/lib/reportes/insumos-usd-data';
import { fmtFecha, fmtNum, fmtUsd, TASA_REPORTE_UYU_POR_USD } from '@/lib/reportes/insumos-usd';
import { ETIQUETAS_PERIODO, rangoPreset, type PresetPeriodo } from '@/lib/reportes/periodos';
import {
  BarrasCategoria, GraficoComprasConsumo, Kpi, SelectorCategorias, TablaTopInsumos, TablaVariacionPrecios,
} from './analisis-ui';

const PRESETS_PANEL: PresetPeriodo[] = ['7d', '30d', '90d', 'doce_meses', 'anio', 'todo'];

export default function AnalisisInsumosPanel() {
  const { datos, cargando, paso, error, recargar } = useDatosInsumos();
  const [preset, setPreset] = useState<PresetPeriodo>('30d');
  const [categorias, setCategorias] = useState<string[]>([]);

  const rep = useMemo(() => {
    if (!datos) return null;
    const { desde, hasta } = rangoPreset(preset);
    return reporteDesdeDatos(datos, { desde, hasta, categorias, todoElHistorial: preset === 'todo' });
  }, [datos, preset, categorias]);

  // Insumos a reponer: agotados, bajo mínimo o con menos de 15 días de cobertura.
  const aReponer = useMemo(() => {
    if (!rep) return [];
    return rep.stock
      .filter(s => s.stock <= 0 || (s.stockMinimo > 0 && s.stock <= s.stockMinimo) || (s.diasCobertura != null && s.diasCobertura < 15))
      .map(s => {
        const faltante = Math.max(0, s.stockMinimo - s.stock);
        const precio = s.ultimoPrecioUsd ?? s.costoPromedioUsd;
        return { ...s, faltante, costoFaltanteUsd: faltante * precio };
      })
      .sort((a, b) => (a.diasCobertura ?? (a.stock <= 0 ? -1 : 9999)) - (b.diasCobertura ?? (b.stock <= 0 ? -1 : 9999)))
      .slice(0, 12);
  }, [rep]);

  if (!datos && cargando) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 flex flex-col items-center gap-3 text-slate-400">
        <Loader2 size={26} className="animate-spin text-blue-400" />
        <span className="text-sm">{paso || 'Cargando datos de insumos'}…</span>
        <span className="text-xs text-slate-500">Se lee todo el historial de compras y consumos.</span>
      </div>
    );
  }
  if (error && !datos) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2"><AlertTriangle size={16} /> {error}</span>
        <button onClick={recargar} className="px-3 py-1.5 rounded-lg border border-red-500/30 hover:bg-red-500/10">Reintentar</button>
      </div>
    );
  }
  if (!rep || !datos) return null;
  const k = rep.kpis;

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200 shrink-0">
          <CalendarRange size={16} className="text-blue-400" /> Período
        </div>
        <div className="flex flex-wrap gap-1.5 flex-1">
          {PRESETS_PANEL.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPreset(p)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                preset === p
                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                  : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600',
              )}
            >
              {ETIQUETAS_PERIODO[p]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <SelectorCategorias disponibles={rep.categoriasDisponibles} seleccion={categorias} onChange={setCategorias} />
          <button
            type="button"
            onClick={recargar}
            disabled={cargando}
            title={`Actualizar · datos de las ${datos.cargadoEn.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit', hour12: false })}`}
            className="h-11 w-11 shrink-0 rounded-xl border-2 border-slate-700 hover:border-slate-600 text-slate-400 hover:text-white flex items-center justify-center transition-colors disabled:opacity-60"
          >
            <RefreshCw size={16} className={cn(cargando && 'animate-spin')} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 -mt-1 px-1">
        <span>
          Del {fmtFecha(rep.desde)} al {fmtFecha(rep.hasta)}
          {rep.categoriasFiltradas.length > 0 && ` · ${rep.categoriasFiltradas.join(', ')}`}
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 font-medium">
          <Scale size={12} /> Todo en USD · pesos ÷ {fmtNum(TASA_REPORTE_UYU_POR_USD)}
        </span>
      </div>

      {/* Indicadores principales (USD) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi icon={<ShoppingCart size={16} />} label="Compras" value={fmtUsd(k.comprasUsd)}
          hint={`${fmtNum(k.cantidadCompras)} compras · ${fmtNum(k.unidadesCompradas)} uds.`} />
        <Kpi icon={<PackageMinus size={16} />} label="Consumo" tone="sky" value={fmtUsd(k.consumoUsd)}
          hint={`${fmtNum(k.cantidadConsumos)} salidas · ${fmtNum(k.ordenesInternas)} órdenes internas`} />
        <Kpi icon={<Wallet size={16} />} label="Inventario actual" tone="slate"
          value={k.inventarioActualUsd != null ? fmtUsd(k.inventarioActualUsd) : '—'}
          hint={`${fmtNum(k.insumosActivos)} insumos · valorizado al costo`} />
        <Kpi icon={<TrendingUp size={16} />} label="Consumo por día" tone="emerald" value={fmtUsd(k.consumoDiarioUsd)}
          hint={`Promedio de ${fmtNum(rep.dias)} días`} />
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi small icon={<AlertTriangle size={14} />} label="Bajo mínimo" tone={k.insumosBajoMinimo > 0 ? 'amber' : 'slate'}
          value={fmtNum(k.insumosBajoMinimo)} hint="Stock en o bajo el mínimo" />
        <Kpi small icon={<PackageX size={14} />} label="Agotados" tone={k.insumosAgotados > 0 ? 'red' : 'slate'}
          value={fmtNum(k.insumosAgotados)} hint="Sin stock" />
        <Kpi small icon={<TrendingUp size={14} />} label="Subas de precio" tone={k.insumosConAumento > 0 ? 'red' : 'emerald'}
          value={fmtNum(k.insumosConAumento)} hint={`${fmtNum(k.insumosConBaja)} bajaron de precio`} />
        <Kpi small icon={<ClipboardList size={14} />} label="Solicitudes abiertas" tone="slate"
          value={fmtNum(k.solicitudesAbiertas)} hint={`${fmtNum(k.solicitudes)} en el período`} />
      </div>

      {/* Evolución + categorías */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3">
          <GraficoComprasConsumo serie={rep.serie} granularidad={rep.granularidad} />
        </div>
        <div className="xl:col-span-2">
          <BarrasCategoria filas={rep.porCategoria} />
        </div>
      </div>

      {/* Reposición */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <h4 className="text-sm font-semibold text-slate-200">Insumos para reponer</h4>
          <p className="text-xs text-slate-500 mt-0.5">Agotados, bajo mínimo o con menos de 15 días de cobertura al ritmo de consumo del período.</p>
        </div>
        {aReponer.length === 0 ? (
          <div className="px-5 pb-5 text-sm text-slate-500">No hay insumos para reponer.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/80">
                <tr className="text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-2.5 text-left font-semibold">Insumo</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Stock / mín.</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Consumo / día</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Cobertura</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Últ. precio</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Para llegar al mínimo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {aReponer.map(s => (
                  <tr key={s.codigo} className="hover:bg-slate-800/30">
                    <td className="px-5 py-2.5">
                      <div className="text-slate-200">{s.descripcion}</div>
                      <div className="text-xs font-mono text-slate-500">{s.codigo} · {s.categoria}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      <span className={cn(s.stock <= 0 ? 'text-red-400' : s.stock <= s.stockMinimo ? 'text-amber-400' : 'text-slate-300')}>{fmtNum(s.stock)}</span>
                      <span className="text-slate-500"> / {fmtNum(s.stockMinimo)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-400">{s.consumoDiario > 0 ? fmtNum(s.consumoDiario, 2) : '—'}</td>
                    <td className="px-3 py-2.5 text-right">
                      {s.stock <= 0
                        ? <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-red-500/10 text-red-400">Agotado</span>
                        : s.diasCobertura != null
                          ? <span className={cn('font-mono', s.diasCobertura < 7 ? 'text-red-400' : 'text-amber-400')}>{fmtNum(s.diasCobertura)} días</span>
                          : <span className="text-xs text-slate-500">Sin consumo</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="font-mono text-slate-300">{s.ultimoPrecioUsd != null ? fmtUsd(s.ultimoPrecioUsd) : fmtUsd(s.costoPromedioUsd)}</div>
                      <div className="text-xs text-slate-500">{s.fechaUltimaCompra ? fmtFecha(s.fechaUltimaCompra) : 'costo promedio'}</div>
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {s.faltante > 0
                        ? <><div className="font-mono text-slate-200">{fmtUsd(s.costoFaltanteUsd)}</div><div className="text-xs text-slate-500">{fmtNum(s.faltante)} uds.</div></>
                        : <span className="text-xs text-slate-500">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Consumo + precios */}
      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
        <TablaTopInsumos filas={rep.porProducto} limite={8} titulo="Insumos más consumidos" orden="consumo" />
        <TablaVariacionPrecios filas={rep.variacionPrecios} limite={8} compacta />
      </div>

      {/* Cómo se calcula */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-500 space-y-1.5">
        <div className="flex items-center gap-2 text-slate-400 font-medium"><Info size={14} /> Cómo se calcula</div>
        <p>Todo en dólares: lo cargado en USD se toma tal cual y lo cargado en pesos se divide por {fmtNum(TASA_REPORTE_UYU_POR_USD)}.</p>
        <p>Compras: cada una a su precio real (si un insumo se compró a distintos precios, cada compra cuenta al suyo). Consumos: al costo promedio vigente en la fecha de cada salida, usando todo el historial.</p>
        <p>Inventario actual: FIFO por lote (cada lote en la moneda en que se compró) y costo promedio para el resto.</p>
        {rep.advertencias.map(a => (
          <p key={a} className="text-amber-400 flex items-start gap-1.5"><AlertTriangle size={12} className="mt-0.5 shrink-0" /> {a}</p>
        ))}
      </div>
    </div>
  );
}
