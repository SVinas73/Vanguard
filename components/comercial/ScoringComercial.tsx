'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Star, TrendingUp, AlertTriangle, Trophy, Users, RefreshCw,
  Search, ChevronDown, ChevronUp, Calendar, Target,
  CheckCircle, XCircle, Sparkles, Clock, DollarSign, ShoppingBag,
  ShieldAlert
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { cn, formatCurrency } from '@/lib/utils';

// ============================================
// TIPOS
// ============================================

type Segmento =
  | 'champions'
  | 'loyal'
  | 'potential'
  | 'new'
  | 'at_risk'
  | 'hibernating'
  | 'lost';

interface ClienteScoring {
  clienteId: string;
  codigo: string;
  nombre: string;
  // RFM raw
  diasUltimaCompra: number | null;
  ordenes: number;
  totalVentas: number;
  ticketPromedio: number;
  primerCompra: string | null;
  ultimaCompra: string | null;
  // RFM scores 1..5
  rScore: number;
  fScore: number;
  mScore: number;
  rfmTotal: number;
  segmento: Segmento;
  // Riesgo de pago
  saldoPendiente: number;
  limiteCredito: number;
  utilizacionCredito: number; // %
  bloqueado: boolean;
  diasPago: number;
  riesgoPago: 'bajo' | 'medio' | 'alto';
}

type Periodo = 30 | 90 | 180 | 365;
type SortField = 'rfm' | 'monetary' | 'frequency' | 'recency' | 'riesgo';

// ============================================
// CONFIG SEGMENTOS
// ============================================

const SEGMENTOS: Record<Segmento, { label: string; color: string; bg: string; border: string; icon: React.ElementType; descripcion: string }> = {
  champions:    { label: 'Campeones',    color: 'text-amber-300',   bg: 'bg-amber-500/15',   border: 'border-amber-500/30',   icon: Trophy,      descripcion: 'Compran reciente, frecuente y mucho. Tu mejor activo.' },
  loyal:        { label: 'Leales',       color: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', icon: Star,        descripcion: 'Frecuentes, valiosos. Mantenelos contentos.' },
  potential:    { label: 'Potenciales',  color: 'text-blue-300',    bg: 'bg-blue-500/15',    border: 'border-blue-500/30',    icon: TrendingUp,  descripcion: 'Compran reciente pero poco. Buen target para crecer.' },
  new:          { label: 'Nuevos',       color: 'text-cyan-300',    bg: 'bg-cyan-500/15',    border: 'border-cyan-500/30',    icon: Sparkles,    descripcion: 'Primera compra reciente. Onboardealos.' },
  at_risk:      { label: 'En Riesgo',    color: 'text-orange-300',  bg: 'bg-orange-500/15',  border: 'border-orange-500/30',  icon: AlertTriangle, descripcion: 'Eran buenos pero no compran hace tiempo. Recuperalos.' },
  hibernating:  { label: 'Hibernando',   color: 'text-slate-300',   bg: 'bg-slate-500/15',   border: 'border-slate-500/30',   icon: Clock,       descripcion: 'Poca actividad. Reactivar con campañas puntuales.' },
  lost:         { label: 'Perdidos',     color: 'text-red-300',     bg: 'bg-red-500/15',     border: 'border-red-500/30',     icon: XCircle,     descripcion: 'Sin actividad relevante. Costo de reactivación alto.' },
};

const SEGMENTO_ORDER: Segmento[] = ['champions', 'loyal', 'potential', 'new', 'at_risk', 'hibernating', 'lost'];

// ============================================
// SCORING HELPERS
// ============================================

function quintilScore(value: number, sortedAsc: number[], invert = false): number {
  if (sortedAsc.length === 0) return 1;
  const idx = sortedAsc.findIndex(v => v >= value);
  const pos = idx === -1 ? sortedAsc.length - 1 : idx;
  const pct = pos / Math.max(1, sortedAsc.length - 1);
  const score = Math.min(5, Math.max(1, Math.ceil(pct * 5)));
  return invert ? 6 - score : score;
}

function clasificarSegmento(r: number, f: number, m: number, ordenes: number, dias: number | null): Segmento {
  if (dias === null || ordenes === 0) return 'lost';
  // Nuevos: una sola compra muy reciente
  if (ordenes === 1 && r >= 4) return 'new';
  // Champions: top en todo
  if (r >= 4 && f >= 4 && m >= 4) return 'champions';
  // Loyal: frecuentes con ticket decente
  if (f >= 4 && m >= 3) return 'loyal';
  // Potencial: recientes pero todavía con baja frecuencia
  if (r >= 4 && f <= 3) return 'potential';
  // En riesgo: eran buenos pero no compran hace rato
  if (r <= 2 && (f >= 3 || m >= 3)) return 'at_risk';
  // Lost: vacíos en todo
  if (r <= 1 && f <= 1) return 'lost';
  return 'hibernating';
}

function calcularRiesgoPago(saldo: number, limite: number, bloqueado: boolean): 'bajo' | 'medio' | 'alto' {
  if (bloqueado) return 'alto';
  if (limite <= 0) return saldo > 0 ? 'medio' : 'bajo';
  const util = (saldo / limite) * 100;
  if (util >= 90) return 'alto';
  if (util >= 60) return 'medio';
  return 'bajo';
}

// ============================================
// COMPONENTE
// ============================================

export default function ScoringComercial() {
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState<ClienteScoring[]>([]);
  const [periodo, setPeriodo] = useState<Periodo>(180);
  const [search, setSearch] = useState('');
  const [filterSegmento, setFilterSegmento] = useState<Segmento | 'todos'>('todos');
  const [sortBy, setSortBy] = useState<SortField>('rfm');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandido, setExpandido] = useState<string | null>(null);

  useEffect(() => {
    loadScoring();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo]);

  const loadScoring = async () => {
    setLoading(true);
    try {
      const desde = new Date();
      desde.setDate(desde.getDate() - periodo);
      const desdeStr = desde.toISOString();

      // 1) Clientes
      const { data: clientes } = await supabase
        .from('clientes')
        .select('id, codigo, nombre, saldo_pendiente, limite_credito, dias_pago, bloqueado, activo')
        .eq('activo', true)
        .order('nombre');

      // 2) Órdenes en el período (todos los clientes, una sola query)
      const { data: ordenes } = await supabase
        .from('ordenes_venta')
        .select('cliente_id, fecha_orden, total, estado')
        .gte('fecha_orden', desdeStr)
        .not('estado', 'eq', 'cancelada');

      const hoy = Date.now();
      const aggMap = new Map<string, { ordenes: number; total: number; ultima: number; primera: number }>();

      ordenes?.forEach((o: any) => {
        if (!o.cliente_id) return;
        const t = parseFloat(o.total || 0);
        const fecha = new Date(o.fecha_orden).getTime();
        const cur = aggMap.get(o.cliente_id);
        if (cur) {
          cur.ordenes += 1;
          cur.total += t;
          if (fecha > cur.ultima) cur.ultima = fecha;
          if (fecha < cur.primera) cur.primera = fecha;
        } else {
          aggMap.set(o.cliente_id, { ordenes: 1, total: t, ultima: fecha, primera: fecha });
        }
      });

      // 3) Calcular cuantiles para R/F/M sobre clientes con actividad
      const clientesConActividad = (clientes || []).filter(c => aggMap.has(c.id));
      const recencyArr = clientesConActividad
        .map(c => Math.floor((hoy - aggMap.get(c.id)!.ultima) / (1000 * 60 * 60 * 24)))
        .sort((a, b) => a - b);
      const frequencyArr = clientesConActividad
        .map(c => aggMap.get(c.id)!.ordenes)
        .sort((a, b) => a - b);
      const monetaryArr = clientesConActividad
        .map(c => aggMap.get(c.id)!.total)
        .sort((a, b) => a - b);

      // 4) Construir scoring por cliente
      const result: ClienteScoring[] = (clientes || []).map((c: any) => {
        const agg = aggMap.get(c.id);
        const dias = agg ? Math.floor((hoy - agg.ultima) / (1000 * 60 * 60 * 24)) : null;
        const ordenesCount = agg?.ordenes || 0;
        const totalVentas = agg?.total || 0;

        const rScore = agg ? quintilScore(dias!, recencyArr, true) : 1;
        const fScore = agg ? quintilScore(ordenesCount, frequencyArr) : 1;
        const mScore = agg ? quintilScore(totalVentas, monetaryArr) : 1;
        const segmento = clasificarSegmento(rScore, fScore, mScore, ordenesCount, dias);

        const saldo = parseFloat(c.saldo_pendiente || 0);
        const limite = parseFloat(c.limite_credito || 0);
        const bloqueado = !!c.bloqueado;

        return {
          clienteId: c.id,
          codigo: c.codigo || '',
          nombre: c.nombre || 'Sin nombre',
          diasUltimaCompra: dias,
          ordenes: ordenesCount,
          totalVentas,
          ticketPromedio: ordenesCount > 0 ? totalVentas / ordenesCount : 0,
          primerCompra: agg ? new Date(agg.primera).toISOString() : null,
          ultimaCompra: agg ? new Date(agg.ultima).toISOString() : null,
          rScore,
          fScore,
          mScore,
          rfmTotal: rScore + fScore + mScore,
          segmento,
          saldoPendiente: saldo,
          limiteCredito: limite,
          utilizacionCredito: limite > 0 ? (saldo / limite) * 100 : 0,
          bloqueado,
          diasPago: c.dias_pago || 30,
          riesgoPago: calcularRiesgoPago(saldo, limite, bloqueado),
        };
      });

      setScoring(result);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // DERIVADOS
  // ============================================

  const distribucionSegmentos = useMemo(() => {
    const counts = new Map<Segmento, { count: number; ventas: number }>();
    SEGMENTO_ORDER.forEach(s => counts.set(s, { count: 0, ventas: 0 }));
    scoring.forEach(s => {
      const cur = counts.get(s.segmento)!;
      cur.count += 1;
      cur.ventas += s.totalVentas;
    });
    return SEGMENTO_ORDER.map(s => ({
      segmento: s,
      label: SEGMENTOS[s].label,
      count: counts.get(s)!.count,
      ventas: counts.get(s)!.ventas,
    }));
  }, [scoring]);

  const kpis = useMemo(() => {
    const total = scoring.length;
    const activos = scoring.filter(s => s.ordenes > 0).length;
    const champions = scoring.filter(s => s.segmento === 'champions').length;
    const enRiesgo = scoring.filter(s => s.segmento === 'at_risk').length;
    const ventasTotal = scoring.reduce((acc, s) => acc + s.totalVentas, 0);
    const altoRiesgo = scoring.filter(s => s.riesgoPago === 'alto').length;
    return { total, activos, champions, enRiesgo, ventasTotal, altoRiesgo };
  }, [scoring]);

  const filtrados = useMemo(() => {
    let arr = scoring;
    if (filterSegmento !== 'todos') arr = arr.filter(s => s.segmento === filterSegmento);
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(s => s.nombre.toLowerCase().includes(q) || s.codigo.toLowerCase().includes(q));
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    arr = [...arr].sort((a, b) => {
      switch (sortBy) {
        case 'rfm':       return (a.rfmTotal - b.rfmTotal) * dir;
        case 'monetary':  return (a.totalVentas - b.totalVentas) * dir;
        case 'frequency': return (a.ordenes - b.ordenes) * dir;
        case 'recency':   return ((a.diasUltimaCompra ?? 9999) - (b.diasUltimaCompra ?? 9999)) * dir;
        case 'riesgo': {
          const order = { alto: 3, medio: 2, bajo: 1 } as const;
          return (order[a.riesgoPago] - order[b.riesgoPago]) * dir;
        }
        default: return 0;
      }
    });
    return arr;
  }, [scoring, filterSegmento, search, sortBy, sortDir]);

  // ============================================
  // RENDER
  // ============================================

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-slate-200 transition-colors"
    >
      {label}
      {sortBy === field && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Star className="h-6 w-6 text-amber-400" />
            Scoring Comercial
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Análisis RFM (Recency · Frequency · Monetary) y segmentación de clientes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={periodo}
            onChange={e => setPeriodo(parseInt(e.target.value) as Periodo)}
            className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm"
          >
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
            <option value={180}>Últimos 180 días</option>
            <option value={365}>Último año</option>
          </select>
          <button
            onClick={loadScoring}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors"
            title="Recargar"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-6 w-6 animate-spin text-slate-500" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard icon={Users} label="Clientes" value={String(kpis.total)} color="text-slate-300" />
            <KpiCard icon={ShoppingBag} label="Activos" value={String(kpis.activos)} color="text-blue-300" />
            <KpiCard icon={Trophy} label="Campeones" value={String(kpis.champions)} color="text-amber-300" />
            <KpiCard icon={AlertTriangle} label="En Riesgo" value={String(kpis.enRiesgo)} color="text-orange-300" />
            <KpiCard icon={DollarSign} label="Ventas período" value={formatCurrency(kpis.ventasTotal)} color="text-emerald-300" />
            <KpiCard icon={ShieldAlert} label="Riesgo crédito alto" value={String(kpis.altoRiesgo)} color="text-red-300" />
          </div>

          {/* Distribución de segmentos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <Target className="h-4 w-4 text-violet-400" />
                Clientes por segmento
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={distribucionSegmentos}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {distribucionSegmentos.map(d => (
                      <Cell key={d.segmento} fill={segmentoColorHex(d.segmento)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-400" />
                Ventas por segmento
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={distribucionSegmentos.filter(d => d.ventas > 0)}
                    dataKey="ventas"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    label={(e: any) => e.label}
                    labelLine={false}
                  >
                    {distribucionSegmentos.filter(d => d.ventas > 0).map(d => (
                      <Cell key={d.segmento} fill={segmentoColorHex(d.segmento)} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: any) => formatCurrency(parseFloat(v))}
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#cbd5e1' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cards de segmentos clickeables */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            <button
              onClick={() => setFilterSegmento('todos')}
              className={cn(
                'px-3 py-2 rounded-lg border text-xs font-medium transition-all text-left',
                filterSegmento === 'todos'
                  ? 'bg-slate-700/50 border-slate-500 text-slate-100'
                  : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
              )}
            >
              <div className="font-semibold">Todos</div>
              <div className="text-[11px] opacity-70">{kpis.total}</div>
            </button>
            {SEGMENTO_ORDER.map(s => {
              const cfg = SEGMENTOS[s];
              const Icon = cfg.icon;
              const count = distribucionSegmentos.find(d => d.segmento === s)?.count || 0;
              const isActive = filterSegmento === s;
              return (
                <button
                  key={s}
                  onClick={() => setFilterSegmento(s)}
                  className={cn(
                    'px-3 py-2 rounded-lg border text-xs font-medium transition-all text-left',
                    isActive ? `${cfg.bg} ${cfg.border} ${cfg.color}` : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    <span>{cfg.label}</span>
                  </div>
                  <div className="text-[11px] opacity-80 mt-0.5">{count} clientes</div>
                </button>
              );
            })}
          </div>

          {/* Búsqueda */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre o código..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm placeholder:text-slate-500"
              />
            </div>
            <span className="text-xs text-slate-500">{filtrados.length} clientes</span>
          </div>

          {/* Tabla */}
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 border-b border-slate-800">
                  <tr className="text-left text-xs text-slate-400 uppercase tracking-wider">
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Segmento</th>
                    <th className="px-4 py-3"><SortHeader field="rfm" label="RFM" /></th>
                    <th className="px-4 py-3"><SortHeader field="recency" label="Recency" /></th>
                    <th className="px-4 py-3"><SortHeader field="frequency" label="Frequency" /></th>
                    <th className="px-4 py-3 text-right"><SortHeader field="monetary" label="Monetary" /></th>
                    <th className="px-4 py-3 text-right">Ticket prom.</th>
                    <th className="px-4 py-3"><SortHeader field="riesgo" label="Riesgo" /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filtrados.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-500 text-sm">
                        Sin clientes para los filtros seleccionados
                      </td>
                    </tr>
                  ) : filtrados.map(s => {
                    const cfg = SEGMENTOS[s.segmento];
                    const Icon = cfg.icon;
                    const isExpanded = expandido === s.clienteId;
                    return (
                      <React.Fragment key={s.clienteId}>
                        <tr
                          onClick={() => setExpandido(isExpanded ? null : s.clienteId)}
                          className="cursor-pointer hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-200">{s.nombre}</div>
                            {s.codigo && <div className="text-[11px] text-slate-500 font-mono">{s.codigo}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border',
                              cfg.bg, cfg.border, cfg.color
                            )}>
                              <Icon className="h-3 w-3" />
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <ScoreBadge score={s.rScore} />
                              <ScoreBadge score={s.fScore} />
                              <ScoreBadge score={s.mScore} />
                              <span className="ml-2 text-xs text-slate-500">∑ {s.rfmTotal}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {s.diasUltimaCompra === null
                              ? <span className="text-slate-500">—</span>
                              : <span>{s.diasUltimaCompra} días</span>
                            }
                          </td>
                          <td className="px-4 py-3 text-slate-300">{s.ordenes} órdenes</td>
                          <td className="px-4 py-3 text-right text-slate-200 font-medium">{formatCurrency(s.totalVentas)}</td>
                          <td className="px-4 py-3 text-right text-slate-400">{formatCurrency(s.ticketPromedio)}</td>
                          <td className="px-4 py-3">
                            <RiesgoBadge nivel={s.riesgoPago} bloqueado={s.bloqueado} />
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-slate-900/40">
                            <td colSpan={8} className="px-4 py-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                <DetalleItem label="Última compra" value={s.ultimaCompra ? new Date(s.ultimaCompra).toLocaleDateString() : '—'} />
                                <DetalleItem label="Primera compra" value={s.primerCompra ? new Date(s.primerCompra).toLocaleDateString() : '—'} />
                                <DetalleItem label="Días de pago" value={`${s.diasPago} días`} />
                                <DetalleItem label="Saldo pendiente" value={formatCurrency(s.saldoPendiente)} />
                                <DetalleItem label="Límite crédito" value={s.limiteCredito > 0 ? formatCurrency(s.limiteCredito) : 'Sin límite'} />
                                <DetalleItem
                                  label="Utilización crédito"
                                  value={s.limiteCredito > 0 ? `${s.utilizacionCredito.toFixed(1)}%` : '—'}
                                  highlight={s.utilizacionCredito >= 90 ? 'text-red-300' : s.utilizacionCredito >= 60 ? 'text-orange-300' : undefined}
                                />
                                <DetalleItem
                                  label="Bloqueado"
                                  value={s.bloqueado ? 'Sí' : 'No'}
                                  highlight={s.bloqueado ? 'text-red-300' : undefined}
                                />
                                <DetalleItem label="Recomendación" value={cfg.descripcion} />
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer leyenda */}
          <div className="bg-slate-900/30 rounded-xl border border-slate-800/50 p-4 text-xs text-slate-400">
            <div className="font-semibold text-slate-300 mb-2 flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />
              Cómo se calcula
            </div>
            <ul className="space-y-1 list-disc list-inside text-[12px]">
              <li><strong className="text-slate-300">Recency</strong>: días desde la última compra (1 = muy lejano, 5 = muy reciente).</li>
              <li><strong className="text-slate-300">Frequency</strong>: cantidad de órdenes en el período (1 = pocas, 5 = muchas).</li>
              <li><strong className="text-slate-300">Monetary</strong>: total facturado en el período (1 = bajo, 5 = alto).</li>
              <li>Las puntuaciones se calculan por <em>quintiles</em> sobre todos los clientes con actividad en el período.</li>
              <li><strong className="text-slate-300">Riesgo de crédito</strong>: utilización del límite (saldo / límite). Bloqueados → riesgo alto automático.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================
// SUBCOMPONENTES
// ============================================

function KpiCard({
  icon: Icon, label, value, color,
}: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-3">
      <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
        <Icon className={cn('h-3.5 w-3.5', color)} />
        {label}
      </div>
      <div className={cn('text-lg font-bold', color)}>{value}</div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 4 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
    score === 3 ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
    score === 2 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
    'bg-red-500/20 text-red-300 border-red-500/30';
  return (
    <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded text-[11px] font-bold border', color)}>
      {score}
    </span>
  );
}

function RiesgoBadge({ nivel, bloqueado }: { nivel: 'bajo' | 'medio' | 'alto'; bloqueado: boolean }) {
  if (bloqueado) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border bg-red-500/15 border-red-500/30 text-red-300">
        <ShieldAlert className="h-3 w-3" />
        Bloqueado
      </span>
    );
  }
  const cfg =
    nivel === 'alto' ? { label: 'Alto',  cls: 'bg-red-500/15 border-red-500/30 text-red-300' } :
    nivel === 'medio' ? { label: 'Medio', cls: 'bg-orange-500/15 border-orange-500/30 text-orange-300' } :
                        { label: 'Bajo',  cls: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' };
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border', cfg.cls)}>
      {cfg.label}
    </span>
  );
}

function DetalleItem({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div>
      <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-0.5">{label}</div>
      <div className={cn('text-sm', highlight || 'text-slate-200')}>{value}</div>
    </div>
  );
}

function segmentoColorHex(s: Segmento): string {
  switch (s) {
    case 'champions':   return '#fbbf24';
    case 'loyal':       return '#34d399';
    case 'potential':   return '#60a5fa';
    case 'new':         return '#22d3ee';
    case 'at_risk':     return '#fb923c';
    case 'hibernating': return '#94a3b8';
    case 'lost':        return '#f87171';
  }
}
