'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, Percent, Wallet, Clock,
  AlertTriangle, Award, ChevronRight, Calendar, RefreshCw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

// =====================================================
// Vista Ejecutiva — Dashboard C-level
// =====================================================
// Acompaña al Dashboard operativo (que mira al día a día)
// con una vista financiera + estratégica orientada a gerencia.
// Datos: ordenes_venta, ordenes_compra, cxc, aprobaciones, alertas.
// =====================================================

type Periodo = 'mtd' | 'qtd' | 'ytd' | '12m';

interface KpiData {
  revenueActual: number;
  revenueAnterior: number;
  cogsActual: number;
  margenBrutoPct: number;
  cashOnHand: number;
  dsoDias: number;
  serieMensual: { mes: string; ingresos: number; costos: number; margen: number }[];
  topProductosMargen: { codigo: string; nombre: string; ingresos: number; margen: number; margenPct: number }[];
  alertas: { tipo: string; mensaje: string; severidad: 'critica' | 'alta' | 'media' }[];
  cxcVencidas: number;
  cxcVencidasTotal: number;
  aprobacionesPend: number;
}

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: 'mtd', label: 'MTD' },
  { key: 'qtd', label: 'QTD' },
  { key: 'ytd', label: 'YTD' },
  { key: '12m', label: '12M' },
];

function getRangoFecha(periodo: Periodo): { inicio: Date; fin: Date; inicioAnterior: Date; finAnterior: Date } {
  const ahora = new Date();
  const fin = new Date(ahora);
  let inicio: Date;
  switch (periodo) {
    case 'mtd':
      inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      break;
    case 'qtd': {
      const trimestre = Math.floor(ahora.getMonth() / 3);
      inicio = new Date(ahora.getFullYear(), trimestre * 3, 1);
      break;
    }
    case 'ytd':
      inicio = new Date(ahora.getFullYear(), 0, 1);
      break;
    case '12m':
      inicio = new Date(ahora.getFullYear() - 1, ahora.getMonth(), 1);
      break;
  }
  const dur = fin.getTime() - inicio.getTime();
  const finAnterior = new Date(inicio.getTime() - 1);
  const inicioAnterior = new Date(inicio.getTime() - dur);
  return { inicio, fin, inicioAnterior, finAnterior };
}

const fmtMoney = (v: number, compact = false) => {
  if (compact && Math.abs(v) >= 1000) {
    if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    return `$${(v / 1000).toFixed(1)}k`;
  }
  return `$${v.toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

export function ExecutiveDashboard() {
  const { t } = useTranslation();
  const [periodo, setPeriodo] = useState<Periodo>('ytd');
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo]);

  async function cargar() {
    setLoading(true);
    const { inicio, fin, inicioAnterior, finAnterior } = getRangoFecha(periodo);

    // --- Ventas ---
    const [resActual, resAnterior, res12m] = await Promise.all([
      supabase
        .from('ordenes_venta')
        .select('total, fecha_orden, estado, costo_total')
        .gte('fecha_orden', inicio.toISOString())
        .lte('fecha_orden', fin.toISOString())
        .not('estado', 'eq', 'cancelada'),
      supabase
        .from('ordenes_venta')
        .select('total')
        .gte('fecha_orden', inicioAnterior.toISOString())
        .lte('fecha_orden', finAnterior.toISOString())
        .not('estado', 'eq', 'cancelada'),
      supabase
        .from('ordenes_venta')
        .select('total, costo_total, fecha_orden')
        .gte('fecha_orden', new Date(new Date().getFullYear() - 1, new Date().getMonth(), 1).toISOString())
        .not('estado', 'eq', 'cancelada'),
    ]);

    const ventasActual = resActual.data || [];
    const ventasAnterior = resAnterior.data || [];
    const ventas12m = res12m.data || [];

    const revenueActual = ventasActual.reduce((s, o: any) => s + (Number(o.total) || 0), 0);
    const revenueAnterior = ventasAnterior.reduce((s, o: any) => s + (Number(o.total) || 0), 0);
    const cogsActual = ventasActual.reduce((s, o: any) => s + (Number(o.costo_total) || 0), 0);
    const margenBrutoPct = revenueActual > 0 ? ((revenueActual - cogsActual) / revenueActual) * 100 : 0;

    // --- Serie mensual ---
    const meses: Record<string, { ingresos: number; costos: number }> = {};
    ventas12m.forEach((o: any) => {
      const d = new Date(o.fecha_orden);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!meses[key]) meses[key] = { ingresos: 0, costos: 0 };
      meses[key].ingresos += Number(o.total) || 0;
      meses[key].costos += Number(o.costo_total) || 0;
    });
    const serieMensual = Object.entries(meses)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        const [_, m] = key.split('-');
        const nombre = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][Number(m) - 1];
        return {
          mes: nombre,
          ingresos: v.ingresos,
          costos: v.costos,
          margen: v.ingresos > 0 ? ((v.ingresos - v.costos) / v.ingresos) * 100 : 0,
        };
      });

    // --- CxC para Cash + DSO ---
    const { data: cxcData } = await supabase
      .from('cuentas_por_cobrar')
      .select('monto_pendiente, dias_vencido, fecha_emision, fecha_cobro');
    const cxc = cxcData || [];
    const cashPendiente = cxc.reduce((s: number, c: any) => s + (Number(c.monto_pendiente) || 0), 0);
    const cxcVencidasArr = cxc.filter((c: any) => Number(c.dias_vencido) > 0);
    const cxcVencidasTotal = cxcVencidasArr.reduce((s: number, c: any) => s + (Number(c.monto_pendiente) || 0), 0);
    const dsoDias = cxc.length > 0
      ? cxc.reduce((s: number, c: any) => s + (Number(c.dias_vencido) || 0), 0) / cxc.length
      : 0;

    // --- Aprobaciones pendientes ---
    const { count: aprobacionesPend } = await supabase
      .from('aprobaciones')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente');

    // --- Top productos por margen ---
    const { data: itemsData } = await supabase
      .from('ordenes_venta_items')
      .select('producto_codigo, cantidad, precio_unitario, costo_unitario, productos(nombre)')
      .limit(2000);
    const itemsByProd: Record<string, { nombre: string; ingresos: number; margen: number }> = {};
    (itemsData || []).forEach((it: any) => {
      const code = it.producto_codigo;
      if (!code) return;
      const ingreso = Number(it.cantidad || 0) * Number(it.precio_unitario || 0);
      const costo = Number(it.cantidad || 0) * Number(it.costo_unitario || 0);
      if (!itemsByProd[code]) itemsByProd[code] = { nombre: it.productos?.nombre || code, ingresos: 0, margen: 0 };
      itemsByProd[code].ingresos += ingreso;
      itemsByProd[code].margen += ingreso - costo;
    });
    const topProductosMargen = Object.entries(itemsByProd)
      .map(([codigo, v]) => ({
        codigo,
        nombre: v.nombre,
        ingresos: v.ingresos,
        margen: v.margen,
        margenPct: v.ingresos > 0 ? (v.margen / v.ingresos) * 100 : 0,
      }))
      .sort((a, b) => b.margen - a.margen)
      .slice(0, 8);

    // --- Alertas operativas ---
    const alertas: { tipo: string; mensaje: string; severidad: 'critica' | 'alta' | 'media' }[] = [];
    if (cxcVencidasArr.length > 0) {
      alertas.push({
        tipo: 'cobranza',
        mensaje: `${cxcVencidasArr.length} facturas vencidas (${fmtMoney(cxcVencidasTotal, true)})`,
        severidad: cxcVencidasTotal > revenueActual * 0.1 ? 'critica' : 'alta',
      });
    }
    if ((aprobacionesPend || 0) > 0) {
      alertas.push({
        tipo: 'aprobaciones',
        mensaje: `${aprobacionesPend} aprobaciones pendientes`,
        severidad: (aprobacionesPend || 0) > 10 ? 'alta' : 'media',
      });
    }
    if (margenBrutoPct < 20 && revenueActual > 0) {
      alertas.push({
        tipo: 'margen',
        mensaje: `Margen bruto bajo (${margenBrutoPct.toFixed(1)}%)`,
        severidad: 'alta',
      });
    }

    setData({
      revenueActual,
      revenueAnterior,
      cogsActual,
      margenBrutoPct,
      cashOnHand: cashPendiente,
      dsoDias,
      serieMensual,
      topProductosMargen,
      alertas,
      cxcVencidas: cxcVencidasArr.length,
      cxcVencidasTotal,
      aprobacionesPend: aprobacionesPend || 0,
    });
    setLoading(false);
  }

  const varRevenue = useMemo(() => {
    if (!data || data.revenueAnterior === 0) return null;
    return ((data.revenueActual - data.revenueAnterior) / data.revenueAnterior) * 100;
  }, [data]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100 tracking-tight">{t('executive.title') || 'Vista Ejecutiva'}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{t('executive.subtitle') || 'Indicadores estratégicos y financieros · C-level'}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-900/60 border border-slate-800 rounded-md p-0.5">
            {PERIODOS.map(p => (
              <button
                key={p.key}
                onClick={() => setPeriodo(p.key)}
                className={cn(
                  'px-2.5 py-1 text-[12px] font-medium rounded-sm transition-colors',
                  periodo === p.key
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={cargar}
            className="p-1.5 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-md hover:bg-slate-900"
            title="Recargar"
          >
            <RefreshCw size={13} className={cn(loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* KPIs grandes (4) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label={t('executive.revenue') || 'Ingresos'}
          value={data ? fmtMoney(data.revenueActual, true) : '—'}
          variation={varRevenue}
          icon={<DollarSign size={14} />}
          loading={loading}
        />
        <KpiCard
          label={t('executive.grossMargin') || 'Margen Bruto'}
          value={data ? `${data.margenBrutoPct.toFixed(1)}%` : '—'}
          subtext={data ? `Costo: ${fmtMoney(data.cogsActual, true)}` : undefined}
          icon={<Percent size={14} />}
          loading={loading}
          accent={data && data.margenBrutoPct >= 30 ? 'good' : data && data.margenBrutoPct < 20 ? 'bad' : 'neutral'}
        />
        <KpiCard
          label={t('executive.cashOnHand') || 'CxC Pendiente'}
          value={data ? fmtMoney(data.cashOnHand, true) : '—'}
          subtext={data && data.cxcVencidasTotal > 0 ? `Vencido: ${fmtMoney(data.cxcVencidasTotal, true)}` : undefined}
          icon={<Wallet size={14} />}
          loading={loading}
        />
        <KpiCard
          label={t('executive.dso') || 'DSO promedio'}
          value={data ? `${data.dsoDias.toFixed(0)} días` : '—'}
          subtext={t('executive.dsoHint') || 'Días promedio de cobro'}
          icon={<Clock size={14} />}
          loading={loading}
          accent={data && data.dsoDias > 60 ? 'bad' : data && data.dsoDias < 30 ? 'good' : 'neutral'}
        />
      </div>

      {/* P&L mensual + Margen line */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 bg-slate-900/40 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">{t('executive.plMensual') || 'P&L mensual'}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">{t('executive.plMensualSubtitle') || 'Últimos 12 meses · ingresos vs costos'}</p>
            </div>
          </div>
          <div className="h-[280px]">
            {data && data.serieMensual.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.serieMensual} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6, fontSize: 12 }}
                    formatter={(v: any, name: string) => [fmtMoney(Number(v)), name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                  <Bar dataKey="ingresos" name="Ingresos" fill="#4a7fb5" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="costos" name="Costos" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState loading={loading} />
            )}
          </div>
        </div>

        {/* Margen % line */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-100">{t('executive.marginTrend') || 'Tendencia de margen'}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">%</p>
          </div>
          <div className="h-[280px]">
            {data && data.serieMensual.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.serieMensual} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6, fontSize: 12 }}
                    formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'Margen']}
                  />
                  <Line type="monotone" dataKey="margen" stroke="#9ec9b1" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState loading={loading} />
            )}
          </div>
        </div>
      </div>

      {/* Top productos por margen + Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 bg-slate-900/40 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Award size={13} className="text-amber-400" />
                {t('executive.topMargin') || 'Top productos por margen'}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">{t('executive.topMarginSubtitle') || 'Donde se gana más plata, hoy'}</p>
            </div>
          </div>
          {data && data.topProductosMargen.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                    <th className="text-left font-medium py-2">Producto</th>
                    <th className="text-right font-medium py-2">Ingresos</th>
                    <th className="text-right font-medium py-2">Margen $</th>
                    <th className="text-right font-medium py-2">Margen %</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topProductosMargen.map(p => (
                    <tr key={p.codigo} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="py-2">
                        <span className="text-slate-100">{p.nombre}</span>
                        <span className="text-slate-500 ml-2">·</span>
                        <span className="text-slate-500 ml-2 font-mono">{p.codigo}</span>
                      </td>
                      <td className="text-right tabular-nums text-slate-300">{fmtMoney(p.ingresos, true)}</td>
                      <td className="text-right tabular-nums text-slate-100 font-medium">{fmtMoney(p.margen, true)}</td>
                      <td className="text-right">
                        <span className={cn(
                          'inline-block px-1.5 py-0.5 rounded text-[11px] font-medium tabular-nums',
                          p.margenPct >= 40 ? 'bg-emerald-500/10 text-emerald-300'
                            : p.margenPct >= 25 ? 'bg-slate-700/40 text-slate-300'
                            : 'bg-red-500/10 text-red-300'
                        )}>
                          {p.margenPct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState loading={loading} />
          )}
        </div>

        {/* Alertas operativas */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <AlertTriangle size={13} className="text-amber-400" />
              {t('executive.alertsTitle') || 'Alertas críticas'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{t('executive.alertsSubtitle') || 'Cosas que requieren tu atención'}</p>
          </div>
          {data && data.alertas.length > 0 ? (
            <ul className="space-y-2">
              {data.alertas.map((a, i) => (
                <li
                  key={i}
                  className={cn(
                    'flex items-start gap-2 p-2.5 rounded-md border text-[12px]',
                    a.severidad === 'critica' && 'bg-red-500/10 border-red-500/20',
                    a.severidad === 'alta' && 'bg-amber-500/10 border-amber-500/20',
                    a.severidad === 'media' && 'bg-slate-800/50 border-slate-700'
                  )}
                >
                  <div className="flex-1">
                    <p className={cn(
                      'font-medium',
                      a.severidad === 'critica' && 'text-red-200',
                      a.severidad === 'alta' && 'text-amber-200',
                      a.severidad === 'media' && 'text-slate-200'
                    )}>{a.mensaje}</p>
                    <p className="text-[10px] uppercase tracking-wider mt-1 opacity-60">{a.tipo}</p>
                  </div>
                  <ChevronRight size={13} className="opacity-40 mt-0.5" />
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center justify-center py-8 text-[12px] text-slate-500">
              {loading ? 'Cargando…' : '✓ Sin alertas críticas'}
            </div>
          )}
        </div>
      </div>

      {/* Footer: período y nota */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2">
        <span className="flex items-center gap-1.5">
          <Calendar size={11} />
          {t('executive.dataFromSource') || 'Datos en vivo desde Supabase'}
        </span>
        <span>{t('executive.footerNote') || 'Vista ejecutiva — Vanguard'}</span>
      </div>
    </div>
  );
}

// =====================================================
// Subcomponentes
// =====================================================

function KpiCard({
  label, value, subtext, variation, icon, loading, accent = 'neutral',
}: {
  label: string;
  value: string;
  subtext?: string;
  variation?: number | null;
  icon?: React.ReactNode;
  loading?: boolean;
  accent?: 'good' | 'bad' | 'neutral';
}) {
  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-slate-500">{icon}</span>
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">{label}</span>
        </div>
      </div>
      <div className="flex items-baseline justify-between">
        <span className={cn(
          'text-3xl font-semibold tabular-nums tracking-tight',
          accent === 'good' && 'text-emerald-300',
          accent === 'bad' && 'text-red-300',
          accent === 'neutral' && 'text-slate-50'
        )}>
          {loading ? '…' : value}
        </span>
        {variation !== null && variation !== undefined && Number.isFinite(variation) && (
          <span className={cn(
            'flex items-center gap-0.5 text-[11px] font-medium tabular-nums',
            variation >= 0 ? 'text-emerald-400' : 'text-red-400'
          )}>
            {variation >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {fmtPct(variation)}
          </span>
        )}
      </div>
      {subtext && <p className="text-[11px] text-slate-500 mt-2">{subtext}</p>}
    </div>
  );
}

function EmptyState({ loading }: { loading: boolean }) {
  return (
    <div className="flex items-center justify-center h-full text-[12px] text-slate-500">
      {loading ? 'Cargando…' : 'Sin datos en el período'}
    </div>
  );
}

export default ExecutiveDashboard;
