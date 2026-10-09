'use client';

// =====================================================
// Piezas del dashboard ejecutivo de insumos
// =====================================================
// Reglas de diseño (dataviz): marcas finas, extremos de datos redondeados
// de 4 px y base recta, líneas de 2 px, grilla de 1 px sólida y recesiva,
// leyenda siempre presente con 2+ series, el texto nunca usa el color de
// la serie, tooltip en todas las marcas (valor primero, nombre después) y
// vista de tabla en cada gráfico.
// =====================================================

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'framer-motion';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart,
  Pie, PieChart, ReferenceLine, ResponsiveContainer, Sector, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ArrowDownRight, ArrowUpRight, BarChart3, Minus, Table2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TemaGraficos } from '@/hooks/useTemaGraficos';
import { fmtFecha, fmtNum, fmtUsd, type FichaInsumo } from '@/lib/reportes/insumos-usd';

// ---------------------------------------------------
// Formato
// ---------------------------------------------------
export function usdCompacto(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `US$ ${fmtNum(n / 1_000_000, 1)} M`;
  if (a >= 100_000) return `US$ ${fmtNum(n / 1000, 0)} k`;
  return fmtUsd(n, 0);
}

function ejeUsd(v: number) {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${fmtNum(v / 1_000_000, 1)}M`;
  if (a >= 1000) return `${fmtNum(v / 1000, a >= 10_000 ? 0 : 1)}k`;
  return fmtNum(v);
}

// ---------------------------------------------------
// Tarjeta contenedora con vista de tabla
// ---------------------------------------------------
export function Tarjeta({
  titulo, subtitulo, acciones, tabla, children, className, delay = 0, refExterno,
}: {
  titulo: string;
  subtitulo?: string;
  acciones?: React.ReactNode;
  /** Si se pasa, aparece el botón para alternar gráfico ↔ tabla. */
  tabla?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  delay?: number;
  refExterno?: React.Ref<HTMLDivElement>;
}) {
  const [verTabla, setVerTabla] = useState(false);
  return (
    <motion.section
      ref={refExterno}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
      className={cn('rounded-2xl border border-slate-800 bg-slate-900 p-5 flex flex-col min-w-0', className)}
    >
      <header className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-100 tracking-tight">{titulo}</h3>
          {subtitulo && <p className="text-xs text-slate-500 mt-0.5">{subtitulo}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {acciones}
          {tabla && (
            <button
              type="button"
              onClick={() => setVerTabla(v => !v)}
              title={verTabla ? 'Ver gráfico' : 'Ver tabla'}
              aria-label={verTabla ? 'Ver gráfico' : 'Ver tabla'}
              className="h-8 w-8 rounded-lg border border-slate-800 text-slate-500 hover:text-slate-200 hover:border-slate-700 flex items-center justify-center transition-colors"
            >
              {verTabla ? <BarChart3 size={14} /> : <Table2 size={14} />}
            </button>
          )}
        </div>
      </header>
      <div className="flex-1 min-h-0">{verTabla && tabla ? tabla : children}</div>
    </motion.section>
  );
}

export function TablaSimple({ columnas, filas }: {
  columnas: Array<{ titulo: string; derecha?: boolean }>;
  filas: Array<Array<React.ReactNode>>;
}) {
  return (
    <div className="overflow-auto max-h-80 rounded-xl border border-slate-800">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-900">
          <tr className="text-[11px] uppercase tracking-wider text-slate-500">
            {columnas.map(c => (
              <th key={c.titulo} className={cn('px-3 py-2 font-semibold', c.derecha ? 'text-right' : 'text-left')}>{c.titulo}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {filas.map((f, i) => (
            <tr key={i}>
              {f.map((v, j) => (
                <td key={j} className={cn('px-3 py-2 tabular-nums', columnas[j]?.derecha ? 'text-right text-slate-200' : 'text-left text-slate-300')}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------
// Control segmentado
// ---------------------------------------------------
export function Segmentado<T extends string>({ opciones, valor, onChange, chico }: {
  opciones: Array<{ id: T; label: string }>;
  valor: T;
  onChange: (v: T) => void;
  chico?: boolean;
}) {
  return (
    <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800">
      {opciones.map(o => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            'relative rounded-md font-medium transition-colors whitespace-nowrap',
            chico ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
            valor === o.id ? 'text-white' : 'text-slate-500 hover:text-slate-300',
          )}
        >
          {valor === o.id && (
            <motion.span layoutId={`seg-${opciones.map(x => x.id).join('-')}`} className="absolute inset-0 rounded-md bg-slate-800" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------
// Números animados y deltas
// ---------------------------------------------------
export function NumeroAnimado({ valor, formato, className }: { valor: number; formato: (n: number) => string; className?: string }) {
  const mv = useMotionValue(valor);
  const texto = useTransform(mv, v => formato(v));
  useEffect(() => {
    const c = animate(mv, valor, { duration: 0.7, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [valor, mv]);
  return <motion.span className={className}>{texto}</motion.span>;
}

/** Variación vs período anterior. `subirEsMalo`: para gastos, subir es malo. */
export function Delta({ actual, anterior, subirEsMalo = true }: { actual: number; anterior: number | null; subirEsMalo?: boolean }) {
  if (anterior == null) return null;
  if (anterior === 0 && actual === 0) {
    return <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Minus size={12} /> sin cambios</span>;
  }
  if (anterior === 0) {
    return <span className="inline-flex items-center gap-1 text-xs text-slate-400">Nuevo vs período anterior</span>;
  }
  const pct = ((actual - anterior) / Math.abs(anterior)) * 100;
  const sube = pct > 0.5;
  const baja = pct < -0.5;
  const malo = (sube && subirEsMalo) || (baja && !subirEsMalo);
  const bueno = (baja && subirEsMalo) || (sube && !subirEsMalo);
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-xs font-medium',
      malo ? 'text-red-400' : bueno ? 'text-emerald-400' : 'text-slate-400',
    )}>
      {sube ? <ArrowUpRight size={13} /> : baja ? <ArrowDownRight size={13} /> : <Minus size={12} />}
      {pct > 0 ? '+' : ''}{fmtNum(pct, 1)} %
      <span className="text-slate-500 font-normal">vs período anterior</span>
    </span>
  );
}

// ---------------------------------------------------
// Sparkline
// ---------------------------------------------------
export function Sparkline({ datos, color, alto = 44 }: { datos: number[]; color: string; alto?: number }) {
  const data = datos.map((v, i) => ({ i, v }));
  const id = useMemo(() => `sp-${Math.random().toString(36).slice(2, 9)}`, []);
  if (data.length < 2) return <div style={{ height: alto }} />;
  return (
    <div style={{ height: alto }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity={0.28} />
              <stop offset="1" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${id})`} dot={false} isAnimationActive animationDuration={800} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------
// Tooltip: valor primero, nombre después, clave de línea
// ---------------------------------------------------
export function TooltipCaja({ titulo, filas }: {
  titulo?: React.ReactNode;
  filas: Array<{ color?: string; valor: React.ReactNode; nombre: React.ReactNode; extra?: React.ReactNode }>;
}) {
  return (
    <div className="rounded-xl bg-slate-900/95 border border-slate-700 px-3 py-2.5 shadow-2xl shadow-black/40 text-xs backdrop-blur min-w-[160px]">
      {titulo && <div className="text-slate-400 mb-1.5 font-medium">{titulo}</div>}
      <div className="space-y-1">
        {filas.map((f, i) => (
          <div key={i} className="flex items-center gap-2">
            {f.color && <span className="w-3 h-[3px] rounded-full shrink-0" style={{ backgroundColor: f.color }} />}
            <span className="font-semibold text-slate-100 tabular-nums">{f.valor}</span>
            <span className="text-slate-400">{f.nombre}</span>
            {f.extra && <span className="ml-auto pl-2 text-slate-500">{f.extra}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------
// Donut interactivo (parte-todo, ≤ 6 segmentos)
// ---------------------------------------------------
export interface SegmentoDonut {
  clave: string;
  nombre: string;
  valor: number;
  color: string;
  icono?: React.ReactNode;
}

function SectorActivo(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 7} startAngle={startAngle} endAngle={endAngle} fill={fill} cornerRadius={4} />
    </g>
  );
}

export function DonutInteractivo({
  segmentos, tema, formato, etiquetaTotal, seleccion, onSeleccion, alto = 200,
}: {
  segmentos: SegmentoDonut[];
  tema: TemaGraficos;
  formato: (n: number) => string;
  etiquetaTotal: string;
  /** Claves de los segmentos seleccionados (filtro activo). */
  seleccion?: string[];
  onSeleccion?: (clave: string) => void;
  alto?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = segmentos.reduce((s, x) => s + x.valor, 0);
  const sel = new Set(seleccion ?? []);
  const haySeleccion = segmentos.some(s => sel.has(s.clave));
  const unicoSel = segmentos.filter(s => sel.has(s.clave));
  const activo = hover ?? (unicoSel.length === 1 ? segmentos.indexOf(unicoSel[0]) : null);
  const enfoque = activo != null ? segmentos[activo] : null;
  const atenuado = (i: number) => (hover != null ? hover !== i : haySeleccion && !sel.has(segmentos[i].clave));

  if (total <= 0) {
    return <div className="flex items-center justify-center text-sm text-slate-500" style={{ height: alto }}>Sin datos en el período.</div>;
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div className="relative shrink-0" style={{ width: alto, height: alto }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={segmentos}
              dataKey="valor"
              nameKey="nombre"
              innerRadius="64%"
              outerRadius="86%"
              paddingAngle={1.2}
              cornerRadius={3}
              stroke={tema.superficie}
              strokeWidth={2}
              activeIndex={activo ?? undefined}
              activeShape={SectorActivo}
              onMouseEnter={(_: any, i: number) => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={(_: any, i: number) => { if (segmentos[i].clave !== '__otras') onSeleccion?.(segmentos[i].clave); }}
              isAnimationActive
              animationDuration={750}
            >
              {segmentos.map((s, i) => (
                <Cell
                  key={s.clave}
                  fill={s.color}
                  cursor={onSeleccion ? 'pointer' : 'default'}
                  opacity={atenuado(i) ? 0.3 : 1}
                  style={{ transition: 'opacity 160ms ease', outline: 'none' }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-8">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={enfoque ? enfoque.clave : 'total'}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              <div className="text-[10px] uppercase tracking-wider text-slate-500 truncate max-w-[96px] mx-auto" title={enfoque ? enfoque.nombre : etiquetaTotal}>{enfoque ? enfoque.nombre : etiquetaTotal}</div>
              <div className="text-xl font-bold text-white leading-tight mt-0.5">{formato(enfoque ? enfoque.valor : total)}</div>
              {enfoque && <div className="text-xs text-slate-400 mt-0.5">{fmtNum((enfoque.valor / total) * 100, 1)} %</div>}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Leyenda con valores (la identidad nunca es solo color) */}
      <ul className="flex-1 w-full space-y-1">
        {segmentos.map((s, i) => {
          const pct = (s.valor / total) * 100;
          const marcado = sel.has(s.clave);
          const clickeable = !!onSeleccion && s.clave !== '__otras';
          return (
            <li key={s.clave}>
              <button
                type="button"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                onClick={() => clickeable && onSeleccion?.(s.clave)}
                aria-pressed={clickeable ? marcado : undefined}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors',
                  marcado ? 'bg-blue-500/10 ring-1 ring-blue-500/30' : 'hover:bg-slate-800/60',
                  !clickeable && 'cursor-default',
                  atenuado(i) && 'opacity-50',
                )}
              >
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
                {s.icono && <span className="text-slate-400 shrink-0">{s.icono}</span>}
                <span className="flex-1 min-w-0 truncate text-[13px] text-slate-300" title={s.nombre}>{s.nombre}</span>
                <span className="text-[13px] font-medium text-slate-100 tabular-nums whitespace-nowrap">{formato(s.valor)}</span>
                <span className="w-10 text-right text-[11px] text-slate-500 tabular-nums">{fmtNum(pct, pct < 10 ? 1 : 0)} %</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------
// Evolución (crosshair, leyenda que oculta series, acumulado)
// ---------------------------------------------------
export interface PuntoEvolucion { etiqueta: string; compras: number; consumo: number }

export function GraficoEvolucion({ datos, tema, alto = 280 }: { datos: PuntoEvolucion[]; tema: TemaGraficos; alto?: number }) {
  const [modo, setModo] = useState<'periodo' | 'acumulado'>('periodo');
  const [ocultas, setOcultas] = useState<Set<string>>(new Set());
  const serie = useMemo(() => {
    if (modo === 'periodo') return datos;
    let c = 0; let u = 0;
    return datos.map(d => { c += d.compras; u += d.consumo; return { ...d, compras: c, consumo: u }; });
  }, [datos, modo]);
  const series = [
    { key: 'compras', nombre: 'Compras', color: tema.serie[0] },
    { key: 'consumo', nombre: 'Consumo', color: tema.serie[1] },
  ];
  const vacio = datos.every(d => d.compras === 0 && d.consumo === 0);
  const ultimo = serie.length - 1;
  const alternar = (k: string) => setOcultas(prev => {
    const n = new Set(prev);
    if (n.has(k)) n.delete(k); else if (n.size < series.length - 1) n.add(k);
    return n;
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-1.5" role="group" aria-label="Series">
          {series.map(s => {
            const oculta = ocultas.has(s.key);
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => alternar(s.key)}
                aria-pressed={!oculta}
                className={cn('inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
                  oculta ? 'border-slate-800 text-slate-600' : 'border-slate-700 text-slate-300 hover:border-slate-600')}
              >
                <span className="w-3 h-[3px] rounded-full" style={{ backgroundColor: oculta ? tema.otros : s.color }} />
                {s.nombre}
              </button>
            );
          })}
        </div>
        <Segmentado chico opciones={[{ id: 'periodo', label: 'Por período' }, { id: 'acumulado', label: 'Acumulado' }]} valor={modo} onChange={setModo} />
      </div>
      {vacio ? (
        <div className="flex items-center justify-center text-sm text-slate-500" style={{ height: alto }}>Sin compras ni consumos en el período.</div>
      ) : (
        <div style={{ height: alto }}>
          <ResponsiveContainer width="100%" height="100%">
            {modo === 'periodo' ? (
              <BarChart data={serie} margin={{ top: 12, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="22%">
                <CartesianGrid stroke={tema.grilla} vertical={false} />
                <XAxis dataKey="etiqueta" tick={{ fontSize: 11, fill: tema.textoTenue }} tickLine={false} axisLine={{ stroke: tema.eje }} minTickGap={18} />
                <YAxis tick={{ fontSize: 11, fill: tema.textoTenue }} tickLine={false} axisLine={false} width={44} tickFormatter={ejeUsd} />
                <Tooltip
                  cursor={{ fill: tema.oscuro ? 'rgba(148,163,184,0.06)' : 'rgba(15,23,42,0.04)' }}
                  content={({ active, payload, label }: any) => active && payload?.length ? (
                    <TooltipCaja titulo={label} filas={payload.map((p: any) => ({ color: p.color, valor: fmtUsd(p.value), nombre: p.name }))} />
                  ) : null}
                />
                {series.map(s => (
                  <Bar key={s.key} dataKey={s.key} name={s.nombre} hide={ocultas.has(s.key)} fill={s.color}
                    radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive animationDuration={650} />
                ))}
              </BarChart>
            ) : (
              <AreaChart data={serie} margin={{ top: 12, right: 64, bottom: 0, left: 0 }}>
                <defs>
                  {series.map(s => (
                    <linearGradient key={s.key} id={`ev-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor={s.color} stopOpacity={0.18} />
                      <stop offset="1" stopColor={s.color} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid stroke={tema.grilla} vertical={false} />
                <XAxis dataKey="etiqueta" tick={{ fontSize: 11, fill: tema.textoTenue }} tickLine={false} axisLine={{ stroke: tema.eje }} minTickGap={18} />
                <YAxis tick={{ fontSize: 11, fill: tema.textoTenue }} tickLine={false} axisLine={false} width={44} tickFormatter={ejeUsd} />
                <Tooltip
                  cursor={{ stroke: tema.eje, strokeWidth: 1 }}
                  content={({ active, payload, label }: any) => active && payload?.length ? (
                    <TooltipCaja titulo={`${label} · acumulado`} filas={payload.map((p: any) => ({ color: p.color, valor: fmtUsd(p.value), nombre: p.name }))} />
                  ) : null}
                />
                {series.map(s => (
                  <Area
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.nombre}
                    hide={ocultas.has(s.key)}
                    stroke={s.color}
                    strokeWidth={2}
                    fill={`url(#ev-${s.key})`}
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: tema.superficie, fill: s.color }}
                    isAnimationActive
                    animationDuration={700}
                  >
                    <LabelList
                      dataKey={s.key}
                      content={(p: any) => (p.index === ultimo && !ocultas.has(s.key) ? (
                        <text x={p.x + 8} y={p.y} dy={4} fontSize={11} fill={tema.textoSecundario} fontWeight={600}>
                          {usdCompacto(Number(p.value) || 0)}
                        </text>
                      ) : null)}
                    />
                  </Area>
                ))}
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------
// Barras horizontales (ranking) — una serie, un color
// ---------------------------------------------------
export interface FilaRanking { codigo: string; nombre: string; valor: number; detalle?: string }

export function BarrasRanking({ filas, tema, color, onClick, formato = (n: number) => fmtUsd(n, 0) }: {
  filas: FilaRanking[]; tema: TemaGraficos; color: string; onClick?: (codigo: string) => void; formato?: (n: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (filas.length === 0) return <div className="h-40 flex items-center justify-center text-sm text-slate-500">Sin datos en el período.</div>;
  const alto = Math.max(160, filas.length * 34 + 16);
  const truncar = (s: string) => (s.length > 26 ? `${s.slice(0, 25)}…` : s);
  return (
    <div style={{ height: alto }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={filas} layout="vertical" margin={{ top: 4, right: 76, bottom: 4, left: 4 }} barCategoryGap={8}
          onMouseLeave={() => setHover(null)}>
          <XAxis type="number" hide domain={[0, 'dataMax']} />
          <YAxis type="category" dataKey="nombre" width={170} tickLine={false} axisLine={false}
            tick={{ fontSize: 12, fill: tema.textoSecundario }} tickFormatter={truncar} />
          <Tooltip
            cursor={{ fill: tema.oscuro ? 'rgba(148,163,184,0.06)' : 'rgba(15,23,42,0.04)' }}
            content={({ active, payload }: any) => active && payload?.length ? (
              <TooltipCaja titulo={payload[0].payload.nombre}
                filas={[{ color, valor: formato(payload[0].value), nombre: payload[0].payload.detalle || '' }]} />
            ) : null}
          />
          <Bar dataKey="valor" barSize={16} radius={[0, 4, 4, 0]} isAnimationActive animationDuration={650}
            onMouseEnter={(_: any, i: number) => setHover(i)}
            onClick={(d: any) => onClick?.(d.codigo)} cursor={onClick ? 'pointer' : 'default'}>
            {filas.map((f, i) => (
              <Cell key={f.codigo} fill={color} opacity={hover == null || hover === i ? 1 : 0.45} style={{ transition: 'opacity 150ms' }} />
            ))}
            <LabelList dataKey="valor" position="right" offset={8}
              content={(p: any) => (
                <text x={p.x + p.width + 8} y={p.y + p.height / 2} dy={4} fontSize={12} fontWeight={600} fill={tema.texto}>{formato(Number(p.value) || 0)}</text>
              )} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------
// Barras divergentes (variación de precio)
// ---------------------------------------------------
function BarraDivergente(props: any) {
  const { x, y, width, height, fill, payload } = props;
  const izq = Math.min(x, x + width);
  const w = Math.abs(width);
  if (w < 0.5) return null;
  const r = Math.min(4, w, height / 2);
  const negativo = (payload?.valor ?? 0) < 0;
  // extremo de datos redondeado, base (en el 0) recta
  const d = negativo
    ? `M${izq + w},${y} L${izq + r},${y} Q${izq},${y} ${izq},${y + r} L${izq},${y + height - r} Q${izq},${y + height} ${izq + r},${y + height} L${izq + w},${y + height} Z`
    : `M${izq},${y} L${izq + w - r},${y} Q${izq + w},${y} ${izq + w},${y + r} L${izq + w},${y + height - r} Q${izq + w},${y + height} ${izq + w - r},${y + height} L${izq},${y + height} Z`;
  return <path d={d} fill={fill} />;
}

export function BarrasVariacion({ filas, tema, onClick }: {
  filas: Array<{ codigo: string; nombre: string; valor: number; antes: number; ahora: number }>;
  tema: TemaGraficos; onClick?: (codigo: string) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (filas.length === 0) {
    return <div className="h-40 flex items-center justify-center text-sm text-slate-500 text-center px-6">Sin cambios de precio para comparar en el período.</div>;
  }
  const max = Math.max(5, ...filas.map(f => Math.abs(f.valor)));
  const alto = Math.max(160, filas.length * 32 + 16);
  const truncar = (s: string) => (s.length > 24 ? `${s.slice(0, 23)}…` : s);
  return (
    <div style={{ height: alto }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={filas} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 4 }} barCategoryGap={8}
          onMouseLeave={() => setHover(null)}>
          <XAxis type="number" hide domain={[-max * 1.15, max * 1.15]} />
          <YAxis type="category" dataKey="nombre" width={160} tickLine={false} axisLine={false}
            tick={{ fontSize: 12, fill: tema.textoSecundario }} tickFormatter={truncar} />
          <ReferenceLine x={0} stroke={tema.eje} />
          <Tooltip
            cursor={{ fill: tema.oscuro ? 'rgba(148,163,184,0.06)' : 'rgba(15,23,42,0.04)' }}
            content={({ active, payload }: any) => {
              if (!active || !payload?.length) return null;
              const f = payload[0].payload;
              return (
                <TooltipCaja titulo={f.nombre} filas={[
                  { color: f.valor >= 0 ? tema.sube : tema.baja, valor: `${f.valor > 0 ? '+' : ''}${fmtNum(f.valor, 1)} %`, nombre: 'variación' },
                  { valor: fmtUsd(f.antes), nombre: 'antes' },
                  { valor: fmtUsd(f.ahora), nombre: 'ahora' },
                ]} />
              );
            }}
          />
          <Bar dataKey="valor" barSize={14} shape={<BarraDivergente />} isAnimationActive animationDuration={650}
            onMouseEnter={(_: any, i: number) => setHover(i)}
            onClick={(d: any) => onClick?.(d.codigo)} cursor={onClick ? 'pointer' : 'default'}>
            {filas.map((f, i) => (
              <Cell key={f.codigo} fill={f.valor >= 0 ? tema.sube : tema.baja} opacity={hover == null || hover === i ? 1 : 0.45} />
            ))}
            <LabelList dataKey="valor"
              content={(p: any) => {
                const v = Number(p.value) || 0;
                const xFin = v >= 0 ? p.x + p.width + 6 : p.x + p.width - 6;
                return (
                  <text x={xFin} y={p.y + p.height / 2} dy={4} fontSize={11} fontWeight={600}
                    textAnchor={v >= 0 ? 'start' : 'end'} fill={tema.texto}>
                    {`${v > 0 ? '+' : ''}${fmtNum(v, 1)} %`}
                  </text>
                );
              }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------
// Medidor (cobertura): la pista es un tono más claro del mismo color
// ---------------------------------------------------
export function Medidor({ valor, max, color, pista }: { valor: number; max: number; color: string; pista: string }) {
  const pct = Math.max(0, Math.min(100, max > 0 ? (valor / max) * 100 : 0));
  return (
    <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: pista }}>
      <motion.div className="h-full rounded-full" style={{ backgroundColor: color }}
        initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} />
    </div>
  );
}

// ---------------------------------------------------
// Ficha lateral de un insumo
// ---------------------------------------------------
export function FichaInsumoPanel({ ficha, tema, onCerrar }: { ficha: FichaInsumo | null; tema: TemaGraficos; onCerrar: () => void }) {
  useEffect(() => {
    if (!ficha) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [ficha, onCerrar]);

  const historial = (ficha?.compras ?? []).map(c => ({ ...c, etiqueta: fmtFecha(c.fecha) }));
  const variacion = ficha && ficha.ultimoPrecioUsd != null && ficha.precioAnteriorUsd
    ? ((ficha.ultimoPrecioUsd - ficha.precioAnteriorUsd) / ficha.precioAnteriorUsd) * 100
    : null;

  return (
    <AnimatePresence>
      {ficha && (
        <>
          <motion.div
            key="fondo"
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onCerrar}
          />
          <motion.aside
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-label={`Ficha de ${ficha.descripcion}`}
            className="fixed right-0 top-0 bottom-0 z-[61] w-full max-w-xl bg-slate-950 border-l border-slate-800 shadow-2xl overflow-y-auto"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 40 }}
          >
            <div className="sticky top-0 z-10 bg-slate-950 border-b border-slate-800 px-6 py-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs font-mono text-slate-500">{ficha.codigo} · {ficha.categoria}</div>
                <h3 className="text-lg font-semibold text-white leading-snug">{ficha.descripcion}</h3>
              </div>
              <button type="button" onClick={onCerrar} aria-label="Cerrar"
                className="h-9 w-9 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">Último precio</div>
                  <div className="mt-1 text-xl font-bold text-white">{ficha.ultimoPrecioUsd != null ? fmtUsd(ficha.ultimoPrecioUsd) : '—'}</div>
                  {variacion != null && (
                    <div className={cn('mt-1 text-xs font-medium inline-flex items-center gap-1', variacion > 0.5 ? 'text-red-400' : variacion < -0.5 ? 'text-emerald-400' : 'text-slate-400')}>
                      {variacion > 0.5 ? <ArrowUpRight size={13} /> : variacion < -0.5 ? <ArrowDownRight size={13} /> : <Minus size={12} />}
                      {variacion > 0 ? '+' : ''}{fmtNum(variacion, 1)} % <span className="text-slate-500 font-normal">vs compra anterior</span>
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">Costo promedio</div>
                  <div className="mt-1 text-xl font-bold text-white">{fmtUsd(ficha.costoPromedioUsd)}</div>
                  <div className="mt-1 text-xs text-slate-500">Valor en stock {fmtUsd(ficha.valorUsd)}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">Stock</div>
                  <div className="mt-1 text-xl font-bold text-white">{fmtNum(ficha.stock)} <span className="text-sm font-normal text-slate-500">/ mín. {fmtNum(ficha.stockMinimo)}</span></div>
                  <div className="mt-2">
                    <Medidor valor={ficha.stock} max={Math.max(ficha.stockMinimo * 2, ficha.stock, 1)}
                      color={ficha.stock <= 0 ? tema.estado.critico : ficha.stock <= ficha.stockMinimo ? tema.estado.atencion : tema.estado.bien}
                      pista={tema.grilla} />
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">Cobertura</div>
                  <div className="mt-1 text-xl font-bold text-white">{ficha.diasCobertura != null ? `${fmtNum(ficha.diasCobertura)} días` : '—'}</div>
                  <div className="mt-1 text-xs text-slate-500">{ficha.consumoDiario90 > 0 ? `${fmtNum(ficha.consumoDiario90, 2)} uds./día (últimos 90 días)` : 'Sin consumo en 90 días'}</div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-100">Precio de compra por unidad</h4>
                <p className="text-xs text-slate-500 mb-3">
                  Cada punto es una compra a su precio real, en USD
                  {ficha.minUsd != null && ficha.maxUsd != null && ` · mín. ${fmtUsd(ficha.minUsd)} · máx. ${fmtUsd(ficha.maxUsd)}`}
                  {ficha.promedioCompraUsd != null && ` · promedio ${fmtUsd(ficha.promedioCompraUsd)}`}
                </p>
                {historial.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-sm text-slate-500 rounded-xl border border-slate-800">Sin compras con costo registradas.</div>
                ) : (
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={historial} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                        <CartesianGrid stroke={tema.grilla} vertical={false} />
                        <XAxis dataKey="etiqueta" tick={{ fontSize: 10, fill: tema.textoTenue }} tickLine={false} axisLine={{ stroke: tema.eje }} minTickGap={16} />
                        <YAxis tick={{ fontSize: 10, fill: tema.textoTenue }} tickLine={false} axisLine={false} width={48}
                          domain={['auto', 'auto']} tickFormatter={(v: number) => fmtNum(v, v < 10 ? 2 : 0)} />
                        {ficha.promedioCompraUsd != null && (
                          <ReferenceLine y={ficha.promedioCompraUsd} stroke={tema.eje} label={{ value: 'promedio', fill: tema.textoTenue, fontSize: 10, position: 'insideTopRight' }} />
                        )}
                        <Tooltip
                          cursor={{ stroke: tema.eje, strokeWidth: 1 }}
                          content={({ active, payload }: any) => {
                            if (!active || !payload?.length) return null;
                            const c = payload[0].payload;
                            return (
                              <TooltipCaja titulo={fmtFecha(c.fecha)} filas={[
                                { color: tema.serie[0], valor: fmtUsd(c.usd), nombre: 'por unidad' },
                                ...(c.monedaOriginal === 'UYU' ? [{ valor: `$ ${fmtNum(c.costoOriginal, 2)}`, nombre: 'pagado en pesos' }] : []),
                                { valor: fmtNum(c.cantidad), nombre: 'unidades' },
                              ]} />
                            );
                          }}
                        />
                        <Line type="linear" dataKey="usd" stroke={tema.serie[0]} strokeWidth={2}
                          dot={{ r: 4, strokeWidth: 2, stroke: tema.superficie, fill: tema.serie[0] }}
                          activeDot={{ r: 6, strokeWidth: 2, stroke: tema.superficie, fill: tema.serie[0] }}
                          isAnimationActive animationDuration={700} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-100">Consumo mensual</h4>
                <p className="text-xs text-slate-500 mb-3">Unidades usadas en los últimos 12 meses</p>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ficha.consumoMensual} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                      <CartesianGrid stroke={tema.grilla} vertical={false} />
                      <XAxis dataKey="etiqueta" tick={{ fontSize: 10, fill: tema.textoTenue }} tickLine={false} axisLine={{ stroke: tema.eje }}
                        tickFormatter={(s: string) => s.split(' ')[0]} interval={0} />
                      <YAxis tick={{ fontSize: 10, fill: tema.textoTenue }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                      <Tooltip cursor={{ fill: tema.oscuro ? 'rgba(148,163,184,0.06)' : 'rgba(15,23,42,0.04)' }}
                        content={({ active, payload }: any) => active && payload?.length ? (
                          <TooltipCaja titulo={payload[0].payload.etiqueta} filas={[{ color: tema.serie[1], valor: fmtNum(payload[0].value), nombre: 'unidades' }]} />
                        ) : null} />
                      <Bar dataKey="unidades" fill={tema.serie[1]} radius={[4, 4, 0, 0]} barSize={14} isAnimationActive animationDuration={600} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {historial.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-100 mb-3">Últimas compras</h4>
                  <TablaSimple
                    columnas={[{ titulo: 'Fecha' }, { titulo: 'Cant.', derecha: true }, { titulo: 'Pagado', derecha: true }, { titulo: 'USD / u.', derecha: true }]}
                    filas={[...historial].reverse().slice(0, 10).map(c => [
                      fmtFecha(c.fecha), fmtNum(c.cantidad),
                      c.monedaOriginal === 'USD' ? fmtUsd(c.costoOriginal) : `$ ${fmtNum(c.costoOriginal, 2)}`,
                      fmtUsd(c.usd),
                    ])}
                  />
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
