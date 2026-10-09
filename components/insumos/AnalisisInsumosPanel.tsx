'use client';

// =====================================================
// Análisis de insumos — dashboard ejecutivo (USD)
// =====================================================
// Los insumos solo se compran y se usan. Mismo motor que el Reporte en USD
// (lib/reportes/insumos-usd.ts): compras a su precio real, consumos al
// costo promedio móvil de cada fecha, historial completo. Todo lo que hay
// debajo de los filtros responde al mismo recorte (período + categorías);
// tocar un segmento del gráfico de categorías también filtra todo.
// =====================================================

import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ClipboardList, Loader2, PackageX, RefreshCw, TrendingUp, X, MinusCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDatosInsumos } from '@/hooks/useDatosInsumos';
import { useTemaGraficos } from '@/hooks/useTemaGraficos';
import { reporteDesdeDatos } from '@/lib/reportes/insumos-usd-data';
import { fichaInsumo, fmtFecha, fmtNum, fmtUsd, ETIQUETA_GRANULARIDAD } from '@/lib/reportes/insumos-usd';
import { rangoAnterior, rangoPreset, type PresetPeriodo } from '@/lib/reportes/periodos';
import { SelectorCategorias } from './analisis-ui';
import {
  BarrasRanking, BarrasVariacion, Delta, DonutInteractivo, FichaInsumoPanel, GraficoEvolucion,
  Medidor, NumeroAnimado, Segmentado, Sparkline, TablaSimple, Tarjeta, usdCompacto,
  type SegmentoDonut,
} from './dashboard-ui';

const PERIODOS: Array<{ id: PresetPeriodo; label: string }> = [
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
  { id: '90d', label: '90 días' },
  { id: 'doce_meses', label: '12 meses' },
  { id: 'anio', label: 'Este año' },
  { id: 'todo', label: 'Todo' },
];

type FiltroStock = 'todos' | 'agotado' | 'bajo' | 'cobertura';

export default function AnalisisInsumosPanel() {
  const tema = useTemaGraficos();
  const { datos, cargando, paso, error, recargar } = useDatosInsumos();
  const [preset, setPreset] = useState<PresetPeriodo>('30d');
  const [categorias, setCategorias] = useState<string[]>([]);
  const [metricaCat, setMetricaCat] = useState<'compras' | 'consumo'>('compras');
  const [metricaTop, setMetricaTop] = useState<'compras' | 'consumo'>('compras');
  const [filtroStock, setFiltroStock] = useState<FiltroStock>('todos');
  const [fichaCodigo, setFichaCodigo] = useState<string | null>(null);
  const refReponer = useRef<HTMLDivElement>(null);
  const refPrecios = useRef<HTMLDivElement>(null);

  const rango = useMemo(() => rangoPreset(preset), [preset]);
  const rep = useMemo(
    () => (datos ? reporteDesdeDatos(datos, { ...rango, categorias, todoElHistorial: preset === 'todo' }) : null),
    [datos, rango, categorias, preset],
  );
  // Mismo período sin filtro de categoría: el gráfico de categorías muestra
  // todas y resalta las elegidas (filtro cruzado).
  const repTodas = useMemo(
    () => (datos ? reporteDesdeDatos(datos, { ...rango, categorias: [], todoElHistorial: preset === 'todo' }) : null),
    [datos, rango, preset],
  );
  const repAnterior = useMemo(() => {
    if (!datos || preset === 'todo') return null;
    return reporteDesdeDatos(datos, { ...rangoAnterior(rango.desde, rango.hasta), categorias });
  }, [datos, rango, categorias, preset]);
  const ficha = useMemo(() => (datos && fichaCodigo ? fichaInsumo(datos, fichaCodigo) : null), [datos, fichaCodigo]);

  // Color estable por categoría (sigue a la categoría, no a su posición).
  const colorCategoria = useMemo(() => {
    const m = new Map<string, string>();
    // orden alfabético: estable aunque cambie la cantidad de insumos
    [...(repTodas?.categoriasDisponibles ?? [])]
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'))
      .forEach((c, i) => m.set(c.etiqueta, tema.serie[i] ?? tema.otros));
    return m;
  }, [repTodas, tema]);
  const claveDeEtiqueta = useMemo(() => {
    const m = new Map<string, string>();
    (repTodas?.categoriasDisponibles ?? []).forEach(c => m.set(c.etiqueta, c.clave));
    return m;
  }, [repTodas]);

  const segmentosCategoria: SegmentoDonut[] = useMemo(() => {
    if (!repTodas) return [];
    const filas = repTodas.porCategoria
      .map(c => ({ etiqueta: c.categoria, valor: metricaCat === 'compras' ? c.comprasUsd : c.consumoUsd }))
      .filter(c => c.valor > 0)
      .sort((a, b) => b.valor - a.valor);
    // Las 5 más grandes, ordenadas como la paleta (alfabético): así cada par
    // de segmentos vecinos es un par de colores validado.
    const top = filas.slice(0, 5)
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'))
      .map(c => ({
        clave: claveDeEtiqueta.get(c.etiqueta) ?? c.etiqueta,
        nombre: c.etiqueta,
        valor: c.valor,
        color: colorCategoria.get(c.etiqueta) ?? tema.otros,
      }));
    const resto = filas.slice(5).reduce((s, c) => s + c.valor, 0);
    return resto > 0 ? [...top, { clave: '__otras', nombre: 'Otras', valor: resto, color: tema.otros }] : top;
  }, [repTodas, metricaCat, claveDeEtiqueta, colorCategoria, tema]);

  const stockClasificado = useMemo(() => {
    const s = rep?.stock ?? [];
    return {
      agotado: s.filter(x => x.stock <= 0),
      bajo: s.filter(x => x.stock > 0 && x.stockMinimo > 0 && x.stock <= x.stockMinimo),
      ok: s.filter(x => x.stock > 0 && x.stockMinimo > 0 && x.stock > x.stockMinimo),
      sinMinimo: s.filter(x => x.stock > 0 && x.stockMinimo <= 0),
    };
  }, [rep]);

  const segmentosStock: SegmentoDonut[] = [
    { clave: 'ok', nombre: 'Stock suficiente', valor: stockClasificado.ok.length, color: tema.estado.bien, icono: <CheckCircle2 size={13} /> },
    { clave: 'bajo', nombre: 'Bajo el mínimo', valor: stockClasificado.bajo.length, color: tema.estado.atencion, icono: <AlertTriangle size={13} /> },
    { clave: 'agotado', nombre: 'Agotados', valor: stockClasificado.agotado.length, color: tema.estado.critico, icono: <PackageX size={13} /> },
    { clave: 'sinMinimo', nombre: 'Sin mínimo definido', valor: stockClasificado.sinMinimo.length, color: tema.estado.neutro, icono: <MinusCircle size={13} /> },
  ].filter(s => s.valor > 0);

  const aReponer = useMemo(() => {
    if (!rep) return [];
    return rep.stock
      .filter(s => s.stock <= 0 || (s.stockMinimo > 0 && s.stock <= s.stockMinimo) || (s.diasCobertura != null && s.diasCobertura < 15))
      .filter(s => filtroStock === 'todos'
        || (filtroStock === 'agotado' && s.stock <= 0)
        || (filtroStock === 'bajo' && s.stock > 0 && s.stockMinimo > 0 && s.stock <= s.stockMinimo)
        || (filtroStock === 'cobertura' && s.stock > 0 && s.diasCobertura != null && s.diasCobertura < 15))
      .map(s => {
        const faltante = Math.max(0, s.stockMinimo - s.stock);
        const precio = s.ultimoPrecioUsd ?? s.costoPromedioUsd;
        return { ...s, faltante, costoFaltanteUsd: faltante * precio };
      })
      .sort((a, b) => (a.stock <= 0 ? -1 : a.diasCobertura ?? 9999) - (b.stock <= 0 ? -1 : b.diasCobertura ?? 9999));
  }, [rep, filtroStock]);

  const alternarCategoria = (clave: string) =>
    setCategorias(prev => (prev.includes(clave) ? prev.filter(c => c !== clave) : [...prev, clave]));
  const irA = (ref: React.RefObject<HTMLDivElement>) => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // ---------------- Estados de carga / error ----------------
  if (!datos && cargando) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-12 flex flex-col items-center gap-3 text-slate-400">
        <Loader2 size={26} className="animate-spin text-blue-400" />
        <span className="text-sm">{paso || 'Cargando datos de insumos'}…</span>
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
  if (!rep || !datos || !repTodas) return null;
  const k = rep.kpis;
  const ka = repAnterior?.kpis ?? null;
  const periodoTxt = `${fmtFecha(rep.desde)} – ${fmtFecha(rep.hasta)}`;
  const etiquetasFiltro = rep.categoriasDisponibles.filter(c => categorias.includes(c.clave));

  const topFilas = [...rep.porProducto]
    .filter(p => (metricaTop === 'compras' ? p.comprasUsd : p.consumoUsd) > 0)
    .sort((a, b) => (metricaTop === 'compras' ? b.comprasUsd - a.comprasUsd : b.consumoUsd - a.consumoUsd))
    .slice(0, 8)
    .map(p => ({
      codigo: p.codigo,
      nombre: p.descripcion,
      valor: metricaTop === 'compras' ? p.comprasUsd : p.consumoUsd,
      detalle: metricaTop === 'compras'
        ? `${fmtNum(p.unidadesCompradas)} uds. · prom. ${fmtUsd(p.costoPromCompraUsd)}`
        : `${fmtNum(p.unidadesConsumidas)} uds. consumidas`,
    }));

  const variacionFilas = [...rep.variacionPrecios]
    .slice(0, 10)
    .sort((a, b) => b.variacionPct - a.variacionPct)
    .map(v => ({ codigo: v.codigo, nombre: v.descripcion, valor: v.variacionPct, antes: v.precioInicialUsd, ahora: v.precioFinalUsd }));

  const maxSolicitudes = Math.max(1, ...rep.solicitudesPorEstado.map(s => s.cantidad));

  return (
    <div className={cn('space-y-5 transition-opacity', cargando && 'opacity-60')}>
      {/* ================= Filtros (una fila, arriba de todo) ================= */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="overflow-x-auto">
          <Segmentado opciones={PERIODOS} valor={preset} onChange={setPreset} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {etiquetasFiltro.map(c => (
            <button key={c.clave} type="button" onClick={() => alternarCategoria(c.clave)}
              className="inline-flex items-center gap-1.5 h-8 pl-2.5 pr-2 rounded-full bg-blue-500/10 border border-blue-500/30 text-xs font-medium text-blue-400 hover:bg-blue-500/15">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorCategoria.get(c.etiqueta) ?? tema.otros }} />
              {c.etiqueta}
              <X size={12} />
            </button>
          ))}
          <SelectorCategorias disponibles={repTodas.categoriasDisponibles} seleccion={categorias} onChange={setCategorias} />
          <button
            type="button"
            onClick={recargar}
            disabled={cargando}
            title={`Actualizar datos (última lectura ${datos.cargadoEn.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit', hour12: false })})`}
            aria-label="Actualizar datos"
            className="h-11 w-11 shrink-0 rounded-xl border-2 border-slate-700 hover:border-slate-600 text-slate-400 hover:text-white flex items-center justify-center transition-colors disabled:opacity-60"
          >
            <RefreshCw size={16} className={cn(cargando && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* ================= Cifra principal + indicadores ================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <section className="vg-hero md:col-span-2 xl:col-span-2 rounded-2xl border border-slate-800 p-6 flex flex-col justify-between min-h-[220px]">
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Compras del período</span>
              <span className="text-xs text-slate-500 tabular-nums">{periodoTxt}</span>
            </div>
            <NumeroAnimado valor={k.comprasUsd} formato={n => fmtUsd(n, 0)} className="block mt-3 text-5xl font-semibold tracking-tight text-white" />
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <Delta actual={k.comprasUsd} anterior={ka?.comprasUsd ?? null} />
              <span className="text-xs text-slate-500">{fmtNum(k.cantidadCompras)} compras · {fmtNum(k.unidadesCompradas)} uds.</span>
            </div>
          </div>
          <div className="mt-4 -mx-1">
            <Sparkline datos={rep.serie.map(s => s.comprasUsd)} color={tema.serie[0]} alto={56} />
          </div>
        </section>

        {[
          {
            label: 'Consumo valorizado', valor: k.consumoUsd, anterior: ka?.consumoUsd ?? null,
            pie: `${fmtNum(k.cantidadConsumos)} salidas · ${fmtNum(k.ordenesInternas)} órdenes internas`,
            spark: rep.serie.map(s => s.consumoUsd), color: tema.serie[1],
          },
          {
            label: 'Inventario actual', valor: k.inventarioActualUsd ?? 0, anterior: null,
            pie: `${fmtNum(k.insumosActivos)} insumos en stock`,
            spark: null, color: tema.serie[2],
          },
          {
            label: 'Consumo promedio diario', valor: k.consumoDiarioUsd, anterior: ka?.consumoDiarioUsd ?? null,
            pie: `Promedio de ${fmtNum(rep.dias)} días`,
            spark: null, color: tema.serie[1],
          },
        ].map((t, i) => (
          <section key={t.label} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 flex flex-col justify-between min-h-[220px]">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t.label}</span>
              <NumeroAnimado valor={t.valor} formato={n => fmtUsd(n, i === 2 ? 2 : 0)} className="block mt-3 text-3xl font-semibold tracking-tight text-white" />
              <div className="mt-2 space-y-1">
                <Delta actual={t.valor} anterior={t.anterior} />
                <div className="text-xs text-slate-500">{t.pie}</div>
              </div>
            </div>
            {t.spark ? (
              <div className="mt-3 -mx-1"><Sparkline datos={t.spark} color={t.color} alto={40} /></div>
            ) : i === 1 ? (
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>{fmtNum(stockClasificado.ok.length + stockClasificado.sinMinimo.length)} con stock</span>
                  <span>{fmtNum(stockClasificado.bajo.length + stockClasificado.agotado.length)} a reponer</span>
                </div>
                <Medidor
                  valor={stockClasificado.ok.length + stockClasificado.sinMinimo.length}
                  max={Math.max(1, k.insumosActivos)}
                  color={tema.estado.bien}
                  pista={tema.oscuro ? 'rgba(208,59,59,0.35)' : 'rgba(208,59,59,0.25)'}
                />
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-slate-800/40 border border-slate-800 px-3 py-2.5">
                <div className="text-[11px] uppercase tracking-wider text-slate-500">Proyección a 30 días</div>
                <div className="text-sm font-semibold text-slate-100 tabular-nums">{fmtUsd(k.consumoDiarioUsd * 30, 0)}</div>
              </div>
            )}
          </section>
        ))}
      </div>

      {/* ================= Alertas accionables ================= */}
      <div className="flex flex-wrap gap-2">
        {[
          { n: k.insumosAgotados, label: k.insumosAgotados === 1 ? 'agotado' : 'agotados', icono: <PackageX size={14} />, color: tema.estado.critico, accion: () => { setFiltroStock('agotado'); irA(refReponer); } },
          { n: k.insumosBajoMinimo, label: 'bajo el mínimo', icono: <AlertTriangle size={14} />, color: tema.estado.atencion, accion: () => { setFiltroStock('bajo'); irA(refReponer); } },
          { n: k.insumosConAumento, label: k.insumosConAumento === 1 ? 'insumo subió de precio' : 'insumos subieron de precio', icono: <TrendingUp size={14} />, color: tema.sube, accion: () => irA(refPrecios) },
          { n: k.solicitudesAbiertas, label: k.solicitudesAbiertas === 1 ? 'solicitud abierta' : 'solicitudes abiertas', icono: <ClipboardList size={14} />, color: tema.otros, accion: undefined },
        ].map(a => {
          const contenido = (
            <>
              <span style={{ color: a.color }}>{a.icono}</span>
              <span className="font-semibold text-slate-100 tabular-nums">{fmtNum(a.n)}</span>
              <span className="text-slate-400">{a.label}</span>
            </>
          );
          const clases = 'inline-flex items-center gap-2 h-9 px-3.5 rounded-full border border-slate-800 bg-slate-900 text-sm transition-colors';
          return a.accion ? (
            <button key={a.label} type="button" onClick={a.accion} className={cn(clases, 'hover:border-slate-700 hover:bg-slate-800/60')}>{contenido}</button>
          ) : (
            <span key={a.label} className={clases}>{contenido}</span>
          );
        })}
      </div>

      {/* ================= Evolución + categorías ================= */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <Tarjeta
          className="xl:col-span-3"
          titulo="Evolución de compras y consumo"
          subtitulo={`En USD, por ${ETIQUETA_GRANULARIDAD[rep.granularidad]}`}
          delay={0.05}
          tabla={
            <TablaSimple
              columnas={[{ titulo: 'Período' }, { titulo: 'Compras', derecha: true }, { titulo: 'Consumo', derecha: true }]}
              filas={rep.serie.filter(s => s.comprasUsd > 0 || s.consumoUsd > 0).map(s => [s.etiqueta, fmtUsd(s.comprasUsd), fmtUsd(s.consumoUsd)])}
            />
          }
        >
          <GraficoEvolucion tema={tema} datos={rep.serie.map(s => ({ etiqueta: s.etiqueta, compras: s.comprasUsd, consumo: s.consumoUsd }))} />
        </Tarjeta>

        <Tarjeta
          className="xl:col-span-2"
          titulo="Gasto por categoría"
          subtitulo="Tocá una categoría para filtrar todo el panel"
          delay={0.1}
          acciones={<Segmentado chico opciones={[{ id: 'compras', label: 'Compras' }, { id: 'consumo', label: 'Consumo' }]} valor={metricaCat} onChange={setMetricaCat} />}
          tabla={
            <TablaSimple
              columnas={[{ titulo: 'Categoría' }, { titulo: 'Compras', derecha: true }, { titulo: 'Consumo', derecha: true }, { titulo: '%', derecha: true }]}
              filas={repTodas.porCategoria.map(c => [c.categoria, fmtUsd(c.comprasUsd), fmtUsd(c.consumoUsd), `${fmtNum(c.participacion, 1)} %`])}
            />
          }
        >
          <DonutInteractivo
            segmentos={segmentosCategoria}
            tema={tema}
            formato={usdCompacto}
            etiquetaTotal={metricaCat === 'compras' ? 'Compras' : 'Consumo'}
            seleccion={categorias}
            onSeleccion={alternarCategoria}
          />
        </Tarjeta>
      </div>

      {/* ================= Ranking + estado del stock ================= */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <Tarjeta
          className="xl:col-span-3"
          titulo="Insumos con mayor gasto"
          subtitulo="Tocá un insumo para ver su historial de precios"
          delay={0.15}
          acciones={<Segmentado chico opciones={[{ id: 'compras', label: 'Compras' }, { id: 'consumo', label: 'Consumo' }]} valor={metricaTop} onChange={setMetricaTop} />}
          tabla={
            <TablaSimple
              columnas={[{ titulo: 'Insumo' }, { titulo: 'Uds.', derecha: true }, { titulo: metricaTop === 'compras' ? 'Compras' : 'Consumo', derecha: true }]}
              filas={topFilas.map(f => [f.nombre, f.detalle.split(' ')[0], fmtUsd(f.valor)])}
            />
          }
        >
          <BarrasRanking filas={topFilas} tema={tema} color={metricaTop === 'compras' ? tema.serie[0] : tema.serie[1]} onClick={setFichaCodigo} />
        </Tarjeta>

        <Tarjeta
          className="xl:col-span-2"
          titulo="Estado del stock"
          subtitulo="Tocá un estado para ver esos insumos"
          delay={0.2}
          tabla={
            <TablaSimple
              columnas={[{ titulo: 'Estado' }, { titulo: 'Insumos', derecha: true }]}
              filas={segmentosStock.map(s => [s.nombre, fmtNum(s.valor)])}
            />
          }
        >
          <DonutInteractivo
            segmentos={segmentosStock}
            tema={tema}
            formato={n => fmtNum(n)}
            etiquetaTotal="Insumos"
            seleccion={filtroStock === 'agotado' ? ['agotado'] : filtroStock === 'bajo' ? ['bajo'] : []}
            onSeleccion={clave => {
              if (clave === 'agotado' || clave === 'bajo') {
                setFiltroStock(prev => (prev === clave ? 'todos' : clave));
                irA(refReponer);
              }
            }}
          />
        </Tarjeta>
      </div>

      {/* ================= Precios + solicitudes ================= */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <Tarjeta
          refExterno={refPrecios}
          className="xl:col-span-3 scroll-mt-6"
          titulo="Variación de precios de compra"
          subtitulo="Último precio vs. la compra anterior al período · tocá para ver el historial"
          delay={0.25}
          tabla={
            <TablaSimple
              columnas={[{ titulo: 'Insumo' }, { titulo: 'Antes', derecha: true }, { titulo: 'Ahora', derecha: true }, { titulo: 'Variación', derecha: true }]}
              filas={variacionFilas.map(v => [v.nombre, fmtUsd(v.antes), fmtUsd(v.ahora), `${v.valor > 0 ? '+' : ''}${fmtNum(v.valor, 1)} %`])}
            />
          }
        >
          <div className="flex items-center gap-4 mb-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: tema.sube }} /> Subió</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: tema.baja }} /> Bajó</span>
          </div>
          <BarrasVariacion filas={variacionFilas} tema={tema} onClick={setFichaCodigo} />
        </Tarjeta>

        <Tarjeta className="xl:col-span-2" titulo="Solicitudes de insumos" subtitulo="Creadas en el período" delay={0.3}>
          {rep.solicitudesPorEstado.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-sm text-slate-500">Sin solicitudes en el período.</div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-3xl font-semibold text-white">{fmtNum(k.solicitudes)} <span className="text-sm font-normal text-slate-500">{k.solicitudes === 1 ? 'solicitud' : 'solicitudes'}</span></div>
                  <div className="text-xs text-slate-500">
                    {fmtNum(k.solicitudesRecibidas)} {k.solicitudesRecibidas === 1 ? 'recibida' : 'recibidas'} · {fmtNum(k.solicitudesAbiertas)} {k.solicitudesAbiertas === 1 ? 'abierta' : 'abiertas'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-200">{fmtUsd(k.estimadoSolicitudesUsd, 0)}</div>
                  <div className="text-xs text-slate-500">estimado solicitado</div>
                </div>
              </div>
              <ul className="space-y-2.5">
                {rep.solicitudesPorEstado.map(s => (
                  <li key={s.clave}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">{s.etiqueta}</span>
                      <span className="tabular-nums text-slate-100 font-medium">{fmtNum(s.cantidad)}</span>
                    </div>
                    <div className="mt-1">
                      <Medidor valor={s.cantidad} max={maxSolicitudes} color={tema.serie[0]} pista={tema.grilla} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Tarjeta>
      </div>

      {/* ================= Para reponer ================= */}
      <Tarjeta
        refExterno={refReponer}
        className="scroll-mt-6"
        titulo="Insumos para reponer"
        subtitulo="Agotados, bajo el mínimo o con menos de 15 días de cobertura · tocá una fila para ver la ficha"
        delay={0.35}
        acciones={
          <Segmentado chico
            opciones={[
              { id: 'todos', label: 'Todos' },
              { id: 'agotado', label: 'Agotados' },
              { id: 'bajo', label: 'Bajo mínimo' },
              { id: 'cobertura', label: '< 15 días' },
            ]}
            valor={filtroStock}
            onChange={setFiltroStock}
          />
        }
      >
        {aReponer.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            <CheckCircle2 size={22} className="mx-auto mb-2" style={{ color: tema.estado.bien }} />
            No hay insumos para reponer con este filtro.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                  <th className="px-5 py-2.5 text-left font-semibold">Insumo</th>
                  <th className="px-3 py-2.5 text-left font-semibold w-48">Stock vs. mínimo</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Cobertura</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Últ. precio</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Para llegar al mínimo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {aReponer.slice(0, 15).map(s => {
                  const sev = s.stock <= 0 ? tema.estado.critico : s.stock <= s.stockMinimo || (s.diasCobertura != null && s.diasCobertura < 7) ? tema.estado.atencion : tema.estado.bien;
                  return (
                    <tr key={s.codigo} onClick={() => setFichaCodigo(s.codigo)}
                      className="cursor-pointer hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-3">
                        <div className="text-slate-100">{s.descripcion}</div>
                        <div className="text-xs font-mono text-slate-500">{s.codigo} · {s.categoria}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-between text-xs mb-1.5 tabular-nums">
                          <span className="font-semibold text-slate-100">{fmtNum(s.stock)}</span>
                          <span className="text-slate-500">mín. {fmtNum(s.stockMinimo)}</span>
                        </div>
                        <Medidor valor={s.stock} max={Math.max(s.stockMinimo * 2, s.stock, 1)} color={sev} pista={tema.grilla} />
                      </td>
                      <td className="px-3 py-3 text-right">
                        {s.stock <= 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: tema.estado.critico }}><PackageX size={13} /> Agotado</span>
                        ) : s.diasCobertura != null ? (
                          <span className="tabular-nums text-slate-200">{fmtNum(s.diasCobertura)} días</span>
                        ) : (
                          <span className="text-xs text-slate-500">Sin consumo</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        <div className="text-slate-200">{fmtUsd(s.ultimoPrecioUsd ?? s.costoPromedioUsd)}</div>
                        <div className="text-xs text-slate-500">{s.fechaUltimaCompra ? fmtFecha(s.fechaUltimaCompra) : 'costo promedio'}</div>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        {s.faltante > 0 ? (
                          <>
                            <div className="font-semibold text-slate-100">{fmtUsd(s.costoFaltanteUsd)}</div>
                            <div className="text-xs text-slate-500">{fmtNum(s.faltante)} uds.</div>
                          </>
                        ) : <span className="text-xs text-slate-500">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>

      <FichaInsumoPanel ficha={ficha} tema={tema} onCerrar={() => setFichaCodigo(null)} />
    </div>
  );
}
