'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck, Check, X, RefreshCw, Search, AlertCircle,
  Clock, CheckCircle, XCircle, FileText, Settings, Eye,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn, formatCurrency } from '@/lib/utils';
import {
  getAprobacionesPendientes, aprobar, rechazar,
  type Aprobacion, type Prioridad, type EstadoAprobacion,
} from '@/lib/approvals';
import { supabase } from '@/lib/supabase';
import { useWmsToast } from '@/components/wms/useWmsToast';

const PRIORIDAD_CONFIG: Record<Prioridad, { label: string; bg: string; color: string }> = {
  baja:    { label: 'Baja',    bg: 'bg-slate-500/15',  color: 'text-slate-300' },
  normal:  { label: 'Normal',  bg: 'bg-blue-500/15',   color: 'text-blue-300' },
  alta:    { label: 'Alta',    bg: 'bg-amber-500/15',  color: 'text-amber-300' },
  critica: { label: 'Crítica', bg: 'bg-red-500/15',    color: 'text-red-300' },
};

const ORIGEN_LABEL: Record<string, string> = {
  nota_credito_debito: 'Nota Crédito / Débito',
  comision: 'Comisión',
  ajuste_stock: 'Ajuste de stock',
  orden_compra: 'Orden de compra',
  cotizacion: 'Cotización',
  reposicion_grande: 'Reposición grande',
};

export default function ApprovalsInbox() {
  const { user } = useAuth(false);
  const toast = useWmsToast();
  const [loading, setLoading] = useState(true);
  const [aprobaciones, setAprobaciones] = useState<Aprobacion[]>([]);
  const [todas, setTodas] = useState<Aprobacion[]>([]);
  const [filtroEstado, setFiltroEstado] = useState<EstadoAprobacion | 'pendiente'>('pendiente');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Aprobacion | null>(null);
  const [comentario, setComentario] = useState('');
  const [accion, setAccion] = useState<'aprobar' | 'rechazar' | null>(null);
  const [vistaConfig, setVistaConfig] = useState(false);

  // Config de umbrales
  const [configs, setConfigs] = useState<any[]>([]);

  useEffect(() => { loadData(); }, [filtroEstado]);
  useEffect(() => { loadConfigs(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      if (filtroEstado === 'pendiente') {
        const data = await getAprobacionesPendientes(user?.email);
        setAprobaciones(data);
      } else {
        const { data } = await supabase
          .from('aprobaciones').select('*')
          .eq('estado', filtroEstado)
          .order('fecha_solicitud', { ascending: false }).limit(100);
        setAprobaciones((data || []) as Aprobacion[]);
      }
      const { data: all } = await supabase
        .from('aprobaciones').select('*')
        .order('fecha_solicitud', { ascending: false }).limit(200);
      setTodas((all || []) as Aprobacion[]);
    } finally {
      setLoading(false);
    }
  };

  const loadConfigs = async () => {
    const { data } = await supabase.from('aprobaciones_config').select('*').order('tipo');
    setConfigs(data || []);
  };

  const filtrados = useMemo(() => {
    if (!search) return aprobaciones;
    const s = search.toLowerCase();
    return aprobaciones.filter(a =>
      a.numero?.toLowerCase().includes(s) ||
      a.titulo?.toLowerCase().includes(s) ||
      a.solicitado_por?.toLowerCase().includes(s) ||
      a.origen_codigo?.toLowerCase().includes(s)
    );
  }, [aprobaciones, search]);

  const stats = useMemo(() => {
    const pendientes = todas.filter(a => a.estado === 'pendiente').length;
    const criticas = todas.filter(a => a.estado === 'pendiente' && a.prioridad === 'critica').length;
    const aprobadas7d = todas.filter(a => {
      if (a.estado !== 'aprobada' || !a.fecha_resolucion) return false;
      return Date.now() - new Date(a.fecha_resolucion).getTime() < 7 * 86400000;
    }).length;
    const rechazadas7d = todas.filter(a => {
      if (a.estado !== 'rechazada' || !a.fecha_resolucion) return false;
      return Date.now() - new Date(a.fecha_resolucion).getTime() < 7 * 86400000;
    }).length;
    return { pendientes, criticas, aprobadas7d, rechazadas7d };
  }, [todas]);

  const ejecutarAccion = async () => {
    if (!selected || !accion) return;
    if (!comentario.trim()) {
      toast.warning('Agregá un comentario antes de continuar');
      return;
    }
    const ok = accion === 'aprobar'
      ? await aprobar(selected.id, comentario, user?.email || '')
      : await rechazar(selected.id, comentario, user?.email || '');
    if (ok) {
      toast.success(accion === 'aprobar' ? 'Aprobada' : 'Rechazada');
      setSelected(null);
      setAccion(null);
      setComentario('');
      loadData();
    } else {
      toast.error('No se pudo procesar — quizás ya estaba resuelta');
    }
  };

  const guardarConfig = async (cfg: any) => {
    const { error } = await supabase.from('aprobaciones_config')
      .update({
        umbral_monto: cfg.umbral_monto !== '' ? parseFloat(cfg.umbral_monto) : null,
        umbral_cantidad: cfg.umbral_cantidad !== '' ? parseFloat(cfg.umbral_cantidad) : null,
        moneda: cfg.moneda,
        activa: cfg.activa,
        updated_at: new Date().toISOString(),
        updated_by: user?.email,
      })
      .eq('id', cfg.id);
    if (!error) {
      toast.success('Configuración actualizada');
      loadConfigs();
    } else {
      toast.error(error.message);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12"><RefreshCw className="h-8 w-8 animate-spin text-violet-400" /></div>;
  }

  // ========== CONFIG ==========
  if (vistaConfig) {
    return (
      <div className="space-y-6">
        <toast.Toast />
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Settings className="h-6 w-6 text-violet-400" />
            Umbrales de aprobación
          </h3>
          <button onClick={() => setVistaConfig(false)} className="px-3 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm">
            Volver al inbox
          </button>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
          {configs.map(cfg => (
            <ConfigRow key={cfg.id} cfg={cfg} onSave={guardarConfig} />
          ))}
        </div>
      </div>
    );
  }

  // ========== DETALLE ==========
  if (selected) {
    const cfg = PRIORIDAD_CONFIG[selected.prioridad];
    return (
      <div className="space-y-6">
        <toast.Toast />
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-violet-400" />
              {selected.numero}
            </h3>
            <p className="text-sm text-slate-400 mt-0.5">{selected.titulo}</p>
          </div>
          <button onClick={() => { setSelected(null); setAccion(null); setComentario(''); }} className="p-2 hover:bg-slate-800 rounded-lg">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
            <Field label="Origen" value={ORIGEN_LABEL[selected.origen_tipo] || selected.origen_tipo} />
            <Field label="Documento referencia" value={selected.origen_codigo || '—'} mono />
            {selected.descripcion && <Field label="Descripción" value={selected.descripcion} multiline />}
            {selected.monto != null && (
              <Field label="Monto" value={formatCurrency(selected.monto) + ' ' + (selected.moneda || '')} />
            )}
            {selected.cantidad != null && (
              <Field label="Cantidad" value={String(selected.cantidad)} />
            )}
            <Field label="Solicitado por" value={selected.solicitado_por} />
            <Field label="Fecha solicitud" value={new Date(selected.fecha_solicitud).toLocaleString('es-UY')} />
            {selected.fecha_limite && (
              <Field label="Fecha límite" value={new Date(selected.fecha_limite).toLocaleString('es-UY')} />
            )}
            {Object.keys(selected.payload || {}).length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Payload</div>
                <pre className="text-xs bg-slate-950 border border-slate-800 rounded p-2 overflow-x-auto text-slate-300">
                  {JSON.stringify(selected.payload, null, 2)}
                </pre>
              </div>
            )}
            {selected.estado !== 'pendiente' && (
              <>
                <Field label="Resuelto por" value={selected.resuelto_por || '—'} />
                <Field label="Fecha resolución" value={selected.fecha_resolucion ? new Date(selected.fecha_resolucion).toLocaleString('es-UY') : '—'} />
                <Field label="Comentario" value={selected.comentario_resolucion || '—'} multiline />
              </>
            )}
          </div>

          <div className="space-y-3">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Estado</div>
              <div className="flex flex-wrap items-center gap-2">
                <EstadoBadge estado={selected.estado} />
                <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-medium', cfg.bg, cfg.color)}>
                  Prioridad: {cfg.label}
                </span>
              </div>
            </div>

            {selected.estado === 'pendiente' && (
              <div className="bg-slate-900/50 border border-violet-500/30 rounded-xl p-4 space-y-3">
                <h4 className="text-sm font-semibold text-violet-300">Resolver</h4>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Comentario *</label>
                  <textarea rows={4} value={comentario} onChange={e => setComentario(e.target.value)}
                    placeholder="Describí brevemente el motivo de la decisión..."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm resize-none" />
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => { setAccion('aprobar'); ejecutarAccion(); }}
                    className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                    <Check className="h-4 w-4" />
                    Aprobar
                  </button>
                  <button onClick={() => { setAccion('rechazar'); ejecutarAccion(); }}
                    className="w-full px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                    <X className="h-4 w-4" />
                    Rechazar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ========== INBOX ==========
  return (
    <div className="space-y-6">
      <toast.Toast />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-violet-400" />
            Inbox de Aprobaciones
          </h3>
          <p className="text-sm text-slate-400 mt-0.5">
            NC/ND grandes, comisiones, ajustes de stock — todo lo que requiere sign-off pasa por acá.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setVistaConfig(true)} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg">
            <Settings className="h-4 w-4" />
            Umbrales
          </button>
          <button onClick={loadData} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={Clock} label="Pendientes" value={stats.pendientes} color="text-amber-300" />
        <Kpi icon={AlertCircle} label="Críticas" value={stats.criticas} color="text-red-300" />
        <Kpi icon={CheckCircle} label="Aprobadas (7d)" value={stats.aprobadas7d} color="text-emerald-300" />
        <Kpi icon={XCircle} label="Rechazadas (7d)" value={stats.rechazadas7d} color="text-slate-300" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por número, título o solicitante"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm" />
        </div>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as any)}
          className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm">
          <option value="pendiente">Pendientes</option>
          <option value="aprobada">Aprobadas</option>
          <option value="rechazada">Rechazadas</option>
          <option value="cancelada">Canceladas</option>
        </select>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 border-b border-slate-800">
              <tr className="text-left text-xs text-slate-400 uppercase">
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Origen</th>
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3 text-right">Monto / Cantidad</th>
                <th className="px-4 py-3">Solicitante</th>
                <th className="px-4 py-3">Prioridad</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtrados.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-500 text-sm">Sin aprobaciones {filtroEstado}</td></tr>
              ) : filtrados.map(a => {
                const cfg = PRIORIDAD_CONFIG[a.prioridad];
                return (
                  <tr key={a.id} className="hover:bg-slate-800/30 cursor-pointer" onClick={() => setSelected(a)}>
                    <td className="px-4 py-3 font-mono text-slate-200">{a.numero}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{ORIGEN_LABEL[a.origen_tipo] || a.origen_tipo}</td>
                    <td className="px-4 py-3 text-slate-200">{a.titulo}</td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {a.monto != null ? formatCurrency(a.monto) :
                       a.cantidad != null ? `${a.cantidad} u` : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{a.solicitado_por}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-medium', cfg.bg, cfg.color)}>{cfg.label}</span>
                    </td>
                    <td className="px-4 py-3"><EstadoBadge estado={a.estado} /></td>
                    <td className="px-4 py-3 text-right">
                      <button className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-violet-400">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ConfigRow({ cfg, onSave }: { cfg: any; onSave: (cfg: any) => void }) {
  const [local, setLocal] = useState({
    ...cfg,
    umbral_monto: cfg.umbral_monto ?? '',
    umbral_cantidad: cfg.umbral_cantidad ?? '',
  });
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end pb-3 border-b border-slate-800 last:border-0">
      <div>
        <div className="text-xs text-slate-400 mb-1">Tipo</div>
        <div className="text-sm text-slate-200 font-medium">{ORIGEN_LABEL[cfg.tipo] || cfg.tipo}</div>
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Umbral monto</label>
        <input type="number" value={local.umbral_monto} onChange={e => setLocal({ ...local, umbral_monto: e.target.value })}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm" />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Umbral cantidad</label>
        <input type="number" value={local.umbral_cantidad} onChange={e => setLocal({ ...local, umbral_cantidad: e.target.value })}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm" />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Moneda</label>
        <select value={local.moneda || 'UYU'} onChange={e => setLocal({ ...local, moneda: e.target.value })}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm">
          <option value="UYU">UYU</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-slate-300 flex-1">
          <input type="checkbox" checked={local.activa} onChange={e => setLocal({ ...local, activa: e.target.checked })} />
          Activa
        </label>
        <button onClick={() => onSave(local)} className="px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm">
          Guardar
        </button>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-400">{label}</span>
        <Icon className={cn('h-3.5 w-3.5', color)} />
      </div>
      <div className={cn('text-2xl font-bold', color)}>{value}</div>
    </div>
  );
}

function Field({ label, value, multiline, mono }: { label: string; value: string; multiline?: boolean; mono?: boolean }) {
  return (
    <div>
      <span className="text-xs uppercase tracking-wider text-slate-500">{label}: </span>
      <span className={cn('text-slate-200', mono && 'font-mono', multiline && 'block whitespace-pre-line mt-1')}>{value}</span>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: EstadoAprobacion }) {
  const cfg = {
    pendiente:  { label: 'Pendiente', bg: 'bg-amber-500/15',   color: 'text-amber-300',   icon: Clock },
    aprobada:   { label: 'Aprobada',  bg: 'bg-emerald-500/15', color: 'text-emerald-300', icon: CheckCircle },
    rechazada:  { label: 'Rechazada', bg: 'bg-red-500/15',     color: 'text-red-300',     icon: XCircle },
    cancelada:  { label: 'Cancelada', bg: 'bg-slate-500/15',   color: 'text-slate-300',   icon: X },
  }[estado];
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium', cfg.bg, cfg.color)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}
