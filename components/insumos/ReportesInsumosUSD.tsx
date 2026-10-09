'use client';

// =====================================================
// Reportes de insumos en USD (Comercial → Análisis de insumos)
// =====================================================
// Período libre (también todo el historial) y categorías de insumo. La
// vista previa se actualiza al instante y el PDF lleva el símbolo de
// Vanguard. Mismo motor y mismos datos que el panel de Análisis.
// =====================================================

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, CalendarRange, ClipboardList, Download, FileSpreadsheet, Loader2,
  PackageMinus, RefreshCw, Scale, ShoppingCart, TrendingUp, Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';
import { useOrganizacion } from '@/hooks/useOrganizacion';
import { useDatosInsumos } from '@/hooks/useDatosInsumos';
import { reporteDesdeDatos } from '@/lib/reportes/insumos-usd-data';
import { fmtFecha, fmtNum, fmtUsd, type ReporteInsumosUSD } from '@/lib/reportes/insumos-usd';
import {
  aInputFecha, desdeInputFecha, ETIQUETAS_PERIODO, INICIO_HISTORIAL, rangoPreset, type PresetPeriodo,
} from '@/lib/reportes/periodos';
import {
  BarrasCategoria, GraficoComprasConsumo, Kpi, SelectorCategorias, TablaTopInsumos, TablaVariacionPrecios,
} from './analisis-ui';

const PRESETS_REPORTE: PresetPeriodo[] = ['mes', 'mes_anterior', 'tres_meses', 'doce_meses', 'anio', 'anio_anterior', 'todo'];

function exportarCsv(rep: ReporteInsumosUSD) {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const num = (n: number) => n.toFixed(2).replace('.', ',');
  const filas: Array<Array<string | number>> = [
    ['Tipo', 'Fecha', 'Código', 'Descripción', 'Categoría', 'Cantidad', 'Costo unit. cargado', 'Moneda', 'Costo unit. USD', 'Total USD', 'Costo estimado', 'Usuario', 'Notas'],
    ...rep.compras.map(c => ['Compra', fmtFecha(c.fecha), c.codigo, c.descripcion, c.categoria, c.cantidad,
      c.costoEstimado ? '' : num(c.costoUnitOriginal), c.costoEstimado ? '' : c.monedaOriginal,
      num(c.costoUnitUsd), num(c.totalUsd), c.costoEstimado ? 'Sí' : 'No', c.usuario, c.notas]),
    ...rep.consumos.map(c => [c.ordenInterna ? 'Orden interna' : 'Salida', fmtFecha(c.fecha), c.codigo, c.descripcion, c.categoria, c.cantidad,
      '', '', num(c.costoUnitUsd), num(c.totalUsd), c.costoEstimado ? 'Sí' : 'No', c.usuario, c.notas]),
  ];
  const csv = filas.map(f => f.map(esc).join(';')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Vanguard_Reporte_Insumos_USD_${aInputFecha(rep.desde)}_al_${aInputFecha(rep.hasta)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportesInsumosUSD({ userEmail }: { userEmail?: string }) {
  const { orgActiva } = useOrganizacion();
  const { datos, cargando, paso, error, recargar } = useDatosInsumos();
  const inicial = rangoPreset('mes');
  const [preset, setPreset] = useState<PresetPeriodo | 'custom'>('mes');
  const [desdeStr, setDesdeStr] = useState(aInputFecha(inicial.desde));
  const [hastaStr, setHastaStr] = useState(aInputFecha(inicial.hasta));
  const [categorias, setCategorias] = useState<string[]>([]);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  const desde = preset === 'todo' ? INICIO_HISTORIAL : desdeInputFecha(desdeStr, false);
  const hasta = desdeInputFecha(hastaStr, true);
  const rangoValido = !!desde && !!hasta && desde.getTime() <= hasta.getTime();

  const reporte = useMemo(() => {
    if (!datos || !rangoValido || !desde || !hasta) return null;
    return reporteDesdeDatos(datos, { desde, hasta, categorias, todoElHistorial: preset === 'todo' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos, rangoValido, desde?.getTime(), hasta?.getTime(), categorias, preset]);

  const elegirPreset = (p: PresetPeriodo) => {
    const r = rangoPreset(p);
    setPreset(p);
    setDesdeStr(p === 'todo' ? '' : aInputFecha(r.desde));
    setHastaStr(aInputFecha(r.hasta));
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
        </div>
      </div>

      {/* Período y categorías */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <CalendarRange size={16} className="text-blue-400" /> Período y categorías
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS_REPORTE.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => elegirPreset(p)}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors',
                preset === p
                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                  : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600',
              )}
            >
              {ETIQUETAS_PERIODO[p]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <span className="block text-xs text-slate-500">Desde</span>
            <input
              type="date"
              value={preset === 'todo' ? '' : desdeStr}
              onChange={e => { setDesdeStr(e.target.value); setPreset('custom'); }}
              className="vg-date h-11 px-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-slate-500">Hasta</span>
            <input
              type="date"
              value={hastaStr}
              onChange={e => { setHastaStr(e.target.value); if (preset !== 'todo') setPreset('custom'); }}
              className="vg-date h-11 px-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </label>
          <div className="space-y-1">
            <span className="block text-xs text-slate-500">Categorías de insumo</span>
            <SelectorCategorias
              disponibles={reporte?.categoriasDisponibles ?? []}
              seleccion={categorias}
              onChange={setCategorias}
            />
          </div>
          <button
            type="button"
            onClick={recargar}
            disabled={cargando}
            title="Volver a leer los datos"
            className="h-11 w-11 rounded-xl border-2 border-slate-700 hover:border-slate-600 text-slate-400 hover:text-white flex items-center justify-center transition-colors disabled:opacity-60"
          >
            <RefreshCw size={16} className={cn(cargando && 'animate-spin')} />
          </button>
          <span className="text-xs text-slate-500 pb-3">
            {preset === 'todo'
              ? 'Desde el primer registro hasta la fecha elegida'
              : !rangoValido ? 'Revisá las fechas: "Desde" debe ser anterior a "Hasta"' : ''}
          </span>
        </div>
      </div>

      {!datos && cargando && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 flex flex-col items-center gap-3 text-slate-400">
          <Loader2 size={26} className="animate-spin text-blue-400" />
          <span className="text-sm">{paso || 'Cargando datos de insumos'}…</span>
          <span className="text-xs text-slate-500">Se lee todo el historial de compras y consumos.</span>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {reporte && k && (
        <div className="space-y-5">
          {/* Barra de acciones */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-5 py-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Vista previa del reporte</div>
              <div className="text-sm text-slate-200 font-medium">
                Del {fmtFecha(reporte.desde)} al {fmtFecha(reporte.hasta)}
                <span className="text-slate-500"> · {reporte.categoriasFiltradas.length > 0 ? reporte.categoriasFiltradas.join(', ') : 'Todas las categorías'}</span>
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
              value={k.inventarioActualUsd != null ? fmtUsd(k.inventarioActualUsd) : '—'} hint={`${fmtNum(k.insumosActivos)} insumos · al costo`} />
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <Kpi small icon={<ClipboardList size={14} />} label="Solicitudes" value={fmtNum(k.solicitudes)}
              hint={`${fmtNum(k.solicitudesRecibidas)} recibidas · ${fmtNum(k.solicitudesAbiertas)} abiertas`} />
            <Kpi small icon={<ShoppingCart size={14} />} label="Estimado solicitado" value={fmtUsd(k.estimadoSolicitudesUsd)} hint="Sin contar las canceladas" />
            <Kpi small icon={<TrendingUp size={14} />} label="Subas de precio" tone={k.insumosConAumento > 0 ? 'red' : 'emerald'}
              value={fmtNum(k.insumosConAumento)} hint={`${fmtNum(k.insumosConBaja)} bajaron de precio`} />
            <Kpi small icon={<TrendingUp size={14} />} label="Consumo por día" tone="emerald"
              value={fmtUsd(k.consumoDiarioUsd)} hint={`Promedio de ${fmtNum(reporte.dias)} días`} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            <div className="xl:col-span-3">
              <GraficoComprasConsumo serie={reporte.serie} granularidad={reporte.granularidad} />
            </div>
            <div className="xl:col-span-2">
              <BarrasCategoria filas={reporte.porCategoria} />
            </div>
          </div>

          <TablaVariacionPrecios filas={reporte.variacionPrecios} limite={10} />
          <TablaTopInsumos filas={reporte.porProducto} limite={10} />

        </div>
      )}
    </div>
  );
}
