'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck, AlertTriangle, Plus, Search, RefreshCw, X,
  CheckCircle, XCircle, ClipboardList, FileText, Eye,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { registrarAuditoria } from '@/lib/audit';
import { useAuth } from '@/hooks/useAuth';
import { useWmsToast } from './useWmsToast';
import { cn } from '@/lib/utils';

type Severidad = 'baja' | 'media' | 'alta' | 'critica';
type EstadoNC  = 'abierta' | 'en_revision' | 'cerrada';
type AccionNC  = 'aceptar' | 'rechazar' | 'cuarentena' | 'devolver_proveedor' | 'aceptar_con_descuento';

interface NoConformidad {
  id: string;
  numero: string;
  orden_recepcion_id?: string | null;
  linea_recepcion_id?: string | null;
  producto_codigo?: string | null;
  producto_nombre?: string | null;
  cantidad_afectada?: number | null;
  lote_numero?: string | null;
  tipo: string;
  severidad: Severidad;
  accion?: AccionNC | null;
  motivo: string;
  notas?: string | null;
  estado: EstadoNC;
  reportado_por?: string | null;
  resuelto_por?: string | null;
  fecha_apertura: string;
  fecha_cierre?: string | null;
}

interface RecepcionItem {
  id: string;
  numero: string;
  proveedor_nombre?: string;
  estado: string;
}

const SEV_CONFIG: Record<Severidad, { label: string; bg: string; color: string }> = {
  baja:    { label: 'Baja',    bg: 'bg-blue-500/15',    color: 'text-blue-300' },
  media:   { label: 'Media',   bg: 'bg-amber-500/15',   color: 'text-amber-300' },
  alta:    { label: 'Alta',    bg: 'bg-orange-500/15',  color: 'text-orange-300' },
  critica: { label: 'Crítica', bg: 'bg-red-500/15',     color: 'text-red-300' },
};

const TIPO_OPTIONS = [
  { value: 'roto', label: 'Producto roto' },
  { value: 'incompleto', label: 'Faltante / incompleto' },
  { value: 'vencido', label: 'Vencido o por vencer' },
  { value: 'mal_etiquetado', label: 'Mal etiquetado' },
  { value: 'producto_incorrecto', label: 'Producto incorrecto' },
  { value: 'cantidad_incorrecta', label: 'Cantidad incorrecta' },
  { value: 'otro', label: 'Otro' },
];

const ACCION_OPTIONS: Array<{ value: AccionNC; label: string }> = [
  { value: 'aceptar', label: 'Aceptar (sin acción)' },
  { value: 'aceptar_con_descuento', label: 'Aceptar con descuento' },
  { value: 'cuarentena', label: 'Mover a cuarentena' },
  { value: 'rechazar', label: 'Rechazar' },
  { value: 'devolver_proveedor', label: 'Devolver al proveedor' },
];

export default function ControlCalidad() {
  const { user } = useAuth(false);
  const toast = useWmsToast();
  const [loading, setLoading] = useState(true);
  const [ncs, setNcs] = useState<NoConformidad[]>([]);
  const [recepciones, setRecepciones] = useState<RecepcionItem[]>([]);
  const [vista, setVista] = useState<'lista' | 'nueva' | 'detalle'>('lista');
  const [selected, setSelected] = useState<NoConformidad | null>(null);
  const [filtro, setFiltro] = useState<EstadoNC | 'todos'>('abierta');
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    orden_recepcion_id: '',
    producto_codigo: '',
    producto_nombre: '',
    cantidad_afectada: '',
    lote_numero: '',
    tipo: 'roto',
    severidad: 'media' as Severidad,
    motivo: '',
    notas: '',
  });

  const [accionForm, setAccionForm] = useState<{ accion: AccionNC | ''; notas: string }>({
    accion: '', notas: '',
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ncsRes, recRes] = await Promise.all([
        supabase.from('wms_no_conformidades').select('*').order('fecha_apertura', { ascending: false }).limit(100),
        supabase
          .from('wms_ordenes_recepcion')
          .select('id, numero, proveedor_nombre, estado')
          .in('estado', ['en_proceso', 'parcial', 'completada'])
          .order('created_at', { ascending: false })
          .limit(50),
      ]);
      setNcs(ncsRes.data || []);
      setRecepciones(recRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  const filtrados = useMemo(() => {
    return ncs.filter(n => {
      if (filtro !== 'todos' && n.estado !== filtro) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!(n.numero?.toLowerCase().includes(s) ||
              n.producto_codigo?.toLowerCase().includes(s) ||
              n.motivo?.toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [ncs, filtro, search]);

  const stats = useMemo(() => {
    const abiertas = ncs.filter(n => n.estado === 'abierta').length;
    const criticas = ncs.filter(n => n.estado !== 'cerrada' && n.severidad === 'critica').length;
    const enRevision = ncs.filter(n => n.estado === 'en_revision').length;
    return { abiertas, criticas, enRevision };
  }, [ncs]);

  const guardar = async () => {
    if (!form.motivo.trim()) {
      toast.warning('Describí el motivo');
      return;
    }
    const numero = `NC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const { error } = await supabase.from('wms_no_conformidades').insert({
      numero,
      orden_recepcion_id: form.orden_recepcion_id || null,
      producto_codigo: form.producto_codigo || null,
      producto_nombre: form.producto_nombre || null,
      cantidad_afectada: form.cantidad_afectada ? parseFloat(form.cantidad_afectada) : null,
      lote_numero: form.lote_numero || null,
      tipo: form.tipo,
      severidad: form.severidad,
      motivo: form.motivo,
      notas: form.notas || null,
      estado: 'abierta',
      reportado_por: user?.email || null,
    });
    if (error) { toast.error(error.message); return; }
    await registrarAuditoria('wms_no_conformidades', 'CREAR', numero, null,
      { tipo: form.tipo, severidad: form.severidad, producto: form.producto_codigo },
      user?.email || '');
    toast.success(`NC ${numero} registrada`);
    setForm({
      orden_recepcion_id: '', producto_codigo: '', producto_nombre: '',
      cantidad_afectada: '', lote_numero: '', tipo: 'roto', severidad: 'media',
      motivo: '', notas: '',
    });
    setVista('lista');
    loadData();
  };

  const cerrarConAccion = async (nc: NoConformidad) => {
    if (!accionForm.accion) {
      toast.warning('Seleccioná una acción');
      return;
    }
    const { error } = await supabase.from('wms_no_conformidades').update({
      estado: 'cerrada',
      accion: accionForm.accion,
      notas: nc.notas ? `${nc.notas}\n\n[Resolución] ${accionForm.notas}` : accionForm.notas,
      resuelto_por: user?.email || null,
      fecha_cierre: new Date().toISOString(),
    }).eq('id', nc.id);
    if (error) { toast.error(error.message); return; }
    await registrarAuditoria('wms_no_conformidades', 'CERRAR', nc.numero,
      { estado: nc.estado }, { accion: accionForm.accion }, user?.email || '');
    toast.success(`${nc.numero} cerrada — ${accionForm.accion}`);
    setSelected(null);
    setVista('lista');
    setAccionForm({ accion: '', notas: '' });
    loadData();
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12"><RefreshCw className="h-8 w-8 animate-spin text-orange-400" /></div>;
  }

  // ========== DETALLE ==========
  if (vista === 'detalle' && selected) {
    const cfgSev = SEV_CONFIG[selected.severidad];
    return (
      <div className="space-y-6">
        <toast.Toast />
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-orange-400" />
              {selected.numero}
            </h3>
            <span className={cn('inline-flex mt-2 px-2 py-0.5 rounded text-xs font-medium', cfgSev.bg, cfgSev.color)}>
              Severidad: {cfgSev.label}
            </span>
          </div>
          <button onClick={() => { setVista('lista'); setSelected(null); }} className="p-2 hover:bg-slate-800 rounded-lg">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-2 text-sm">
          <Field label="Tipo" value={TIPO_OPTIONS.find(t => t.value === selected.tipo)?.label || selected.tipo} />
          <Field label="Producto" value={`${selected.producto_codigo || ''} ${selected.producto_nombre || ''}`.trim() || '—'} />
          <Field label="Cantidad afectada" value={selected.cantidad_afectada?.toString() || '—'} />
          <Field label="Lote" value={selected.lote_numero || '—'} />
          <Field label="Motivo" value={selected.motivo} multiline />
          {selected.notas && <Field label="Notas" value={selected.notas} multiline />}
          <Field label="Reportado por" value={selected.reportado_por || '—'} />
          <Field label="Fecha apertura" value={new Date(selected.fecha_apertura).toLocaleString('es-UY')} />
          {selected.estado === 'cerrada' && (
            <>
              <Field label="Acción tomada" value={ACCION_OPTIONS.find(a => a.value === selected.accion)?.label || selected.accion || '—'} />
              <Field label="Resuelto por" value={selected.resuelto_por || '—'} />
              <Field label="Fecha cierre" value={selected.fecha_cierre ? new Date(selected.fecha_cierre).toLocaleString('es-UY') : '—'} />
            </>
          )}
        </div>

        {selected.estado !== 'cerrada' && (
          <div className="bg-slate-900/50 border border-amber-500/30 rounded-xl p-4 space-y-3 max-w-2xl">
            <h4 className="text-sm font-semibold text-amber-300">Cerrar con acción</h4>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Acción a tomar</label>
              <select
                value={accionForm.accion}
                onChange={e => setAccionForm({ ...accionForm, accion: e.target.value as AccionNC })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm"
              >
                <option value="">Seleccionar...</option>
                {ACCION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Notas de resolución</label>
              <textarea
                rows={3}
                value={accionForm.notas}
                onChange={e => setAccionForm({ ...accionForm, notas: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => cerrarConAccion(selected)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Cerrar NC
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ========== NUEVA ==========
  if (vista === 'nueva') {
    return (
      <div className="space-y-6">
        <toast.Toast />
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-orange-400" />
            Reportar no conformidad
          </h3>
          <button onClick={() => setVista('lista')} className="p-2 hover:bg-slate-800 rounded-lg">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-4 max-w-2xl">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Recepción asociada (opcional)</label>
            <select
              value={form.orden_recepcion_id}
              onChange={e => setForm({ ...form, orden_recepcion_id: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm"
            >
              <option value="">Sin recepción / manual</option>
              {recepciones.map(r => (
                <option key={r.id} value={r.id}>{r.numero} — {r.proveedor_nombre || 'Sin proveedor'}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Código producto" value={form.producto_codigo} onChange={v => setForm({ ...form, producto_codigo: v })} />
            <Input label="Nombre producto" value={form.producto_nombre} onChange={v => setForm({ ...form, producto_nombre: v })} />
            <Input label="Cantidad afectada" type="number" value={form.cantidad_afectada} onChange={v => setForm({ ...form, cantidad_afectada: v })} />
            <Input label="Lote (opcional)" value={form.lote_numero} onChange={v => setForm({ ...form, lote_numero: v })} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tipo</label>
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm">
                {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Severidad</label>
              <select value={form.severidad} onChange={e => setForm({ ...form, severidad: e.target.value as Severidad })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm">
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Motivo *</label>
            <textarea rows={2} value={form.motivo} onChange={e => setForm({ ...form, motivo: e.target.value })}
              placeholder="Describí qué pasa con el producto..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm resize-none" />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Notas adicionales</label>
            <textarea rows={2} value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm resize-none" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setVista('lista')} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm">
              Cancelar
            </button>
            <button onClick={guardar} className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Registrar NC
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ========== LISTA ==========
  return (
    <div className="space-y-6">
      <toast.Toast />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-orange-400" />
            Control de Calidad
          </h3>
          <p className="text-sm text-slate-400 mt-0.5">Inspección de recepciones y registro de no conformidades</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={() => setVista('nueva')}
            className="flex items-center gap-2 px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm rounded-lg">
            <Plus className="h-4 w-4" />
            Nueva NC
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Abiertas" value={stats.abiertas} color="text-amber-300" />
        <KpiCard label="En revisión" value={stats.enRevision} color="text-blue-300" />
        <KpiCard label="Críticas activas" value={stats.criticas} color="text-red-300" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por número, producto o motivo"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm" />
        </div>
        <select value={filtro} onChange={e => setFiltro(e.target.value as any)}
          className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm">
          <option value="todos">Todas</option>
          <option value="abierta">Abiertas</option>
          <option value="en_revision">En revisión</option>
          <option value="cerrada">Cerradas</option>
        </select>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 border-b border-slate-800">
              <tr className="text-left text-xs text-slate-400 uppercase">
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Severidad</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Apertura</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtrados.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500 text-sm">Sin no conformidades</td></tr>
              ) : filtrados.map(n => {
                const cfg = SEV_CONFIG[n.severidad];
                return (
                  <tr key={n.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono text-slate-200">{n.numero}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {n.producto_codigo || '—'}
                      {n.producto_nombre && <div className="text-xs text-slate-500">{n.producto_nombre}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{TIPO_OPTIONS.find(t => t.value === n.tipo)?.label || n.tipo}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-medium', cfg.bg, cfg.color)}>{cfg.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex px-2 py-0.5 rounded text-xs',
                        n.estado === 'cerrada' ? 'bg-emerald-500/15 text-emerald-300' :
                        n.estado === 'en_revision' ? 'bg-blue-500/15 text-blue-300' :
                        'bg-amber-500/15 text-amber-300'
                      )}>
                        {n.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(n.fecha_apertura).toLocaleDateString('es-UY')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => { setSelected(n); setVista('detalle'); }}
                        className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-orange-400">
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

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm" />
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={cn('text-2xl font-bold', color)}>{value}</div>
    </div>
  );
}

function Field({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <span className="text-xs uppercase tracking-wider text-slate-500">{label}: </span>
      <span className={cn('text-slate-200', multiline && 'block whitespace-pre-line mt-1')}>{value}</span>
    </div>
  );
}
