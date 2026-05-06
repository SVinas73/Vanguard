'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  User, Search, RefreshCw, ShoppingCart, FileText, Headphones,
  ShieldCheck, RotateCcw, DollarSign, MessageSquare, X,
  TrendingUp, AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn, formatCurrency } from '@/lib/utils';

// =====================================================
// HISTORIAL 360° DEL CLIENTE
// =====================================================
// Vista única que reúne TODA la actividad del cliente:
// - Datos básicos + saldo + límite de crédito
// - Órdenes de venta
// - Cotizaciones
// - Tickets de soporte
// - Garantías activas/reclamadas
// - RMAs
// - CxC pendientes
// - Resumen financiero
// =====================================================

interface ClienteCard {
  id: string;
  codigo?: string;
  nombre: string;
  email?: string;
  telefono?: string;
  saldo_pendiente: number;
  limite_credito: number;
  bloqueado: boolean;
}

interface HistorialData {
  ordenes: any[];
  cotizaciones: any[];
  tickets: any[];
  garantias: any[];
  rmas: any[];
  cxc: any[];
}

const TABS = [
  { id: 'resumen',    label: 'Resumen',     icon: TrendingUp },
  { id: 'ordenes',    label: 'Órdenes',     icon: ShoppingCart },
  { id: 'cotizaciones', label: 'Cotizaciones', icon: FileText },
  { id: 'tickets',    label: 'Tickets',     icon: Headphones },
  { id: 'garantias',  label: 'Garantías',   icon: ShieldCheck },
  { id: 'rmas',       label: 'RMAs',        icon: RotateCcw },
  { id: 'cxc',        label: 'CxC',         icon: DollarSign },
] as const;

type TabId = typeof TABS[number]['id'];

export default function HistorialCliente() {
  const [busqueda, setBusqueda] = useState('');
  const [clientes, setClientes] = useState<ClienteCard[]>([]);
  const [seleccionado, setSeleccionado] = useState<ClienteCard | null>(null);
  const [historial, setHistorial] = useState<HistorialData | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<TabId>('resumen');

  useEffect(() => {
    if (!busqueda.trim()) { setClientes([]); return; }
    const t = setTimeout(() => buscarClientes(busqueda), 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  const buscarClientes = async (q: string) => {
    const { data } = await supabase
      .from('clientes')
      .select('id, codigo, nombre, email, telefono, saldo_pendiente, limite_credito, bloqueado')
      .or(`nombre.ilike.%${q}%,codigo.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(15);
    setClientes((data || []).map((c: any) => ({
      id: c.id, codigo: c.codigo, nombre: c.nombre,
      email: c.email, telefono: c.telefono,
      saldo_pendiente: parseFloat(c.saldo_pendiente) || 0,
      limite_credito: parseFloat(c.limite_credito) || 0,
      bloqueado: !!c.bloqueado,
    })));
  };

  const cargarHistorial = async (cliente: ClienteCard) => {
    setLoading(true);
    setSeleccionado(cliente);
    setHistorial(null);
    setTab('resumen');
    try {
      const [ordenes, cotizaciones, tickets, garantias, rmas, cxc] = await Promise.all([
        supabase.from('ordenes_venta')
          .select('numero, total, estado, estado_pago, fecha_orden, fecha_entregada')
          .eq('cliente_id', cliente.id).order('fecha_orden', { ascending: false }).limit(50),
        supabase.from('cotizaciones')
          .select('numero, total, estado, fecha_validez, created_at')
          .eq('cliente_id', cliente.id).order('created_at', { ascending: false }).limit(30),
        supabase.from('tickets_soporte')
          .select('numero, asunto, prioridad, estado, fecha_apertura, fecha_resolucion')
          .eq('cliente_id', cliente.id).order('fecha_apertura', { ascending: false }).limit(50),
        supabase.from('garantias')
          .select('numero, producto_codigo, producto_nombre, serial_numero, estado, fecha_vencimiento, duracion_meses')
          .eq('cliente_id', cliente.id).order('fecha_vencimiento', { ascending: false }).limit(50),
        supabase.from('rma')
          .select('numero, motivo, estado, fecha_solicitud')
          .eq('cliente_id', cliente.id).order('fecha_solicitud', { ascending: false }).limit(30)
          .then(r => r.data ? r : ({ data: [] })),  // tabla puede no existir
        supabase.from('cuentas_por_cobrar')
          .select('numero, monto, saldo, fecha_vencimiento, estado')
          .eq('cliente_id', cliente.id).neq('estado', 'pagada').order('fecha_vencimiento', { ascending: true }),
      ]);

      setHistorial({
        ordenes: ordenes.data || [],
        cotizaciones: cotizaciones.data || [],
        tickets: tickets.data || [],
        garantias: garantias.data || [],
        rmas: rmas.data || [],
        cxc: cxc.data || [],
      });
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    if (!historial || !seleccionado) return null;
    const totalGastado = historial.ordenes
      .filter((o: any) => o.estado !== 'cancelada')
      .reduce((s: number, o: any) => s + (parseFloat(o.total) || 0), 0);
    const ultimaCompra = historial.ordenes[0]?.fecha_orden;
    const ticketsAbiertos = historial.tickets.filter((t: any) =>
      !['cerrado', 'cancelado'].includes(t.estado)).length;
    const garantiasActivas = historial.garantias.filter((g: any) => g.estado === 'activa').length;
    const cxcVencido = historial.cxc.filter((c: any) =>
      new Date(c.fecha_vencimiento) < new Date()
    ).reduce((s: number, c: any) => s + (parseFloat(c.saldo) || 0), 0);

    return { totalGastado, ultimaCompra, ticketsAbiertos, garantiasActivas, cxcVencido };
  }, [historial, seleccionado]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <User className="h-6 w-6 text-blue-400" />
          Historial 360° del Cliente
        </h3>
        <p className="text-sm text-slate-400 mt-0.5">
          Toda la actividad de un cliente en una sola vista: órdenes, soporte, garantías, RMAs, finanzas.
        </p>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar cliente por nombre, código o email..."
          className="w-full pl-9 pr-3 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-sm"
        />
        {clientes.length > 0 && !seleccionado && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-10 max-h-80 overflow-y-auto">
            {clientes.map(c => (
              <button
                key={c.id}
                onClick={() => { cargarHistorial(c); setBusqueda(''); setClientes([]); }}
                className="w-full text-left px-3 py-2 hover:bg-slate-800 border-b border-slate-800 last:border-0"
              >
                <div className="text-sm text-slate-200">{c.nombre}</div>
                <div className="text-xs text-slate-500">{c.codigo || ''} · {c.email || c.telefono || '—'}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cliente seleccionado */}
      {seleccionado && (
        <>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h4 className="text-lg font-bold text-slate-100">{seleccionado.nombre}</h4>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                  {seleccionado.codigo && <span>#{seleccionado.codigo}</span>}
                  {seleccionado.email && <span>{seleccionado.email}</span>}
                  {seleccionado.telefono && <span>{seleccionado.telefono}</span>}
                  {seleccionado.bloqueado && (
                    <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-medium">Bloqueado</span>
                  )}
                </div>
              </div>
              <button onClick={() => setSeleccionado(null)} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>

            {/* KPIs rápidos */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                <Kpi label="Total comprado" value={formatCurrency(stats.totalGastado)} color="text-emerald-300" />
                <Kpi label="Saldo pendiente" value={formatCurrency(seleccionado.saldo_pendiente)}
                  color={seleccionado.saldo_pendiente > 0 ? 'text-amber-300' : 'text-slate-400'} />
                <Kpi label="CxC vencidas" value={formatCurrency(stats.cxcVencido)}
                  color={stats.cxcVencido > 0 ? 'text-red-300' : 'text-slate-400'} />
                <Kpi label="Tickets abiertos" value={String(stats.ticketsAbiertos)}
                  color={stats.ticketsAbiertos > 0 ? 'text-amber-300' : 'text-slate-400'} />
                <Kpi label="Garantías activas" value={String(stats.garantiasActivas)} color="text-emerald-300" />
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-800 overflow-x-auto">
            {TABS.map(t => {
              const Icon = t.icon;
              const isActive = tab === t.id;
              const count = historial && counter(historial, t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-slate-400 hover:text-slate-200',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                  {count !== null && count > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400">{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Contenido */}
          {loading ? (
            <div className="flex items-center justify-center p-12"><RefreshCw className="h-6 w-6 animate-spin text-slate-500" /></div>
          ) : historial && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl">
              {tab === 'resumen' && stats && <ResumenTab stats={stats} historial={historial} />}
              {tab === 'ordenes' && <Tabla rows={historial.ordenes} columns={[
                { key: 'numero', label: 'Número', mono: true },
                { key: 'fecha_orden', label: 'Fecha', format: (v) => v ? new Date(v).toLocaleDateString('es-UY') : '—' },
                { key: 'total', label: 'Total', format: (v) => formatCurrency(parseFloat(v) || 0), align: 'right' },
                { key: 'estado', label: 'Estado', badge: true },
                { key: 'estado_pago', label: 'Pago', badge: true },
              ]} />}
              {tab === 'cotizaciones' && <Tabla rows={historial.cotizaciones} columns={[
                { key: 'numero', label: 'Número', mono: true },
                { key: 'created_at', label: 'Fecha', format: (v) => v ? new Date(v).toLocaleDateString('es-UY') : '—' },
                { key: 'total', label: 'Total', format: (v) => formatCurrency(parseFloat(v) || 0), align: 'right' },
                { key: 'estado', label: 'Estado', badge: true },
                { key: 'fecha_validez', label: 'Validez' },
              ]} />}
              {tab === 'tickets' && <Tabla rows={historial.tickets} columns={[
                { key: 'numero', label: 'Número', mono: true },
                { key: 'asunto', label: 'Asunto' },
                { key: 'prioridad', label: 'Prioridad', badge: true },
                { key: 'estado', label: 'Estado', badge: true },
                { key: 'fecha_apertura', label: 'Apertura', format: (v) => v ? new Date(v).toLocaleDateString('es-UY') : '—' },
              ]} />}
              {tab === 'garantias' && <Tabla rows={historial.garantias} columns={[
                { key: 'numero', label: 'Número', mono: true },
                { key: 'producto_nombre', label: 'Producto', format: (v, r) => v || r.producto_codigo },
                { key: 'serial_numero', label: 'Serial', mono: true },
                { key: 'fecha_vencimiento', label: 'Vence' },
                { key: 'estado', label: 'Estado', badge: true },
              ]} />}
              {tab === 'rmas' && <Tabla rows={historial.rmas} columns={[
                { key: 'numero', label: 'Número', mono: true },
                { key: 'motivo', label: 'Motivo' },
                { key: 'estado', label: 'Estado', badge: true },
                { key: 'fecha_solicitud', label: 'Fecha', format: (v) => v ? new Date(v).toLocaleDateString('es-UY') : '—' },
              ]} />}
              {tab === 'cxc' && <Tabla rows={historial.cxc} columns={[
                { key: 'numero', label: 'Número', mono: true },
                { key: 'monto', label: 'Monto', format: (v) => formatCurrency(parseFloat(v) || 0), align: 'right' },
                { key: 'saldo', label: 'Saldo', format: (v) => formatCurrency(parseFloat(v) || 0), align: 'right' },
                { key: 'fecha_vencimiento', label: 'Vence' },
                { key: 'estado', label: 'Estado', badge: true },
              ]} />}
            </div>
          )}
        </>
      )}

      {!seleccionado && (
        <div className="text-center py-12 text-slate-500">
          <User className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Buscá un cliente arriba para ver su historial completo.</p>
        </div>
      )}
    </div>
  );
}

function counter(h: HistorialData, id: TabId): number | null {
  switch (id) {
    case 'ordenes': return h.ordenes.length;
    case 'cotizaciones': return h.cotizaciones.length;
    case 'tickets': return h.tickets.length;
    case 'garantias': return h.garantias.length;
    case 'rmas': return h.rmas.length;
    case 'cxc': return h.cxc.length;
    default: return null;
  }
}

function ResumenTab({ stats, historial }: { stats: any; historial: HistorialData }) {
  const ultimaCompra = stats.ultimaCompra
    ? new Date(stats.ultimaCompra).toLocaleDateString('es-UY')
    : 'Nunca';
  const ultimoTicket = historial.tickets[0];
  const proximaGarantia = historial.garantias.find((g: any) => g.estado === 'activa');

  return (
    <div className="p-4 space-y-3 text-sm">
      <div className="flex items-center gap-2 text-slate-300">
        <ShoppingCart className="h-4 w-4 text-emerald-400" />
        Última compra: <span className="text-slate-200">{ultimaCompra}</span>
      </div>
      {ultimoTicket && (
        <div className="flex items-center gap-2 text-slate-300">
          <Headphones className="h-4 w-4 text-blue-400" />
          Último ticket: <span className="text-slate-200">{ultimoTicket.numero} · {ultimoTicket.estado}</span>
        </div>
      )}
      {proximaGarantia && (
        <div className="flex items-center gap-2 text-slate-300">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          Próxima garantía a vencer: <span className="text-slate-200">{proximaGarantia.numero} · {proximaGarantia.fecha_vencimiento}</span>
        </div>
      )}
      {stats.cxcVencido > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mt-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-red-300 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-red-300">CxC vencidas: {formatCurrency(stats.cxcVencido)}</div>
            <div className="text-xs text-red-200/80">Pasá a la pestaña CxC para detalle.</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Tabla({ rows, columns }: {
  rows: any[];
  columns: Array<{ key: string; label: string; mono?: boolean; format?: (v: any, row?: any) => any; align?: 'right'; badge?: boolean }>;
}) {
  if (rows.length === 0) {
    return <div className="p-8 text-center text-sm text-slate-500">Sin registros</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-900 border-b border-slate-800">
          <tr className="text-left text-xs text-slate-400 uppercase">
            {columns.map(c => (
              <th key={c.key} className={cn('px-4 py-2', c.align === 'right' && 'text-right')}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-slate-800/30">
              {columns.map(c => {
                const raw = r[c.key];
                const value = c.format ? c.format(raw, r) : (raw ?? '—');
                return (
                  <td key={c.key} className={cn(
                    'px-4 py-2',
                    c.mono && 'font-mono text-xs',
                    c.align === 'right' && 'text-right',
                    !c.mono && 'text-slate-300',
                  )}>
                    {c.badge ? (
                      <span className="inline-flex px-2 py-0.5 rounded bg-slate-800 text-xs text-slate-300">{String(value)}</span>
                    ) : value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={cn('text-lg font-bold mt-0.5', color)}>{value}</div>
    </div>
  );
}
