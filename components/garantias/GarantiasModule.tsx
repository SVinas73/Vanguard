'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck, Plus, Search, RefreshCw, X, AlertTriangle,
  CheckCircle, Clock, Calendar, Eye, FileText,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { crearGarantia, type Garantia, type EstadoGarantia } from '@/lib/garantias';
import { useWmsToast } from '@/components/wms/useWmsToast';

const ESTADO_CONFIG: Record<EstadoGarantia, { label: string; bg: string; color: string }> = {
  activa:    { label: 'Activa',    bg: 'bg-emerald-500/15', color: 'text-emerald-300' },
  vencida:   { label: 'Vencida',   bg: 'bg-slate-500/15',   color: 'text-slate-400' },
  reclamada: { label: 'Reclamada', bg: 'bg-amber-500/15',   color: 'text-amber-300' },
  anulada:   { label: 'Anulada',   bg: 'bg-red-500/15',     color: 'text-red-300' },
};

export default function GarantiasModule() {
  const { user } = useAuth(false);
  const toast = useWmsToast();
  const [loading, setLoading] = useState(true);
  const [garantias, setGarantias] = useState<Garantia[]>([]);
  const [filtroEstado, setFiltroEstado] = useState<EstadoGarantia | 'todas'>('activa');
  const [search, setSearch] = useState('');
  const [vista, setVista] = useState<'lista' | 'nueva' | 'detalle'>('lista');
  const [selected, setSelected] = useState<Garantia | null>(null);

  const [form, setForm] = useState({
    cliente_nombre: '',
    producto_codigo: '',
    producto_nombre: '',
    serial_numero: '',
    lote_numero: '',
    cantidad: '1',
    duracion_meses: '12',
    fecha_inicio: new Date().toISOString().split('T')[0],
    cobertura: 'Defectos de fábrica y desperfectos de funcionamiento.',
    exclusiones: 'Daños por mal uso, golpes o intervenciones no autorizadas.',
    notas: '',
    orden_venta_numero: '',
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('garantias').select('*')
        .order('fecha_vencimiento', { ascending: true })
        .limit(300);
      setGarantias((data || []) as Garantia[]);
    } finally { setLoading(false); }
  };

  const filtradas = useMemo(() => {
    return garantias.filter(g => {
      if (filtroEstado !== 'todas' && g.estado !== filtroEstado) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!(g.numero?.toLowerCase().includes(s) ||
              g.producto_codigo?.toLowerCase().includes(s) ||
              g.producto_nombre?.toLowerCase().includes(s) ||
              g.cliente_nombre?.toLowerCase().includes(s) ||
              g.serial_numero?.toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [garantias, filtroEstado, search]);

  const stats = useMemo(() => {
    const activas = garantias.filter(g => g.estado === 'activa').length;
    const vencidas = garantias.filter(g => g.estado === 'vencida').length;
    const reclamadas = garantias.filter(g => g.estado === 'reclamada').length;
    const proximasVencer = garantias.filter(g => {
      if (g.estado !== 'activa') return false;
      const dias = (new Date(g.fecha_vencimiento).getTime() - Date.now()) / 86400000;
      return dias > 0 && dias <= 30;
    }).length;
    return { activas, vencidas, reclamadas, proximasVencer };
  }, [garantias]);

  const guardar = async () => {
    if (!form.producto_codigo.trim()) {
      toast.warning('Falta el código del producto');
      return;
    }
    const g = await crearGarantia({
      cliente_nombre: form.cliente_nombre || undefined,
      producto_codigo: form.producto_codigo,
      producto_nombre: form.producto_nombre || undefined,
      serial_numero: form.serial_numero || undefined,
      lote_numero: form.lote_numero || undefined,
      cantidad: parseFloat(form.cantidad) || 1,
      duracion_meses: parseInt(form.duracion_meses) || 12,
      fecha_inicio: form.fecha_inicio,
      cobertura: form.cobertura || undefined,
      exclusiones: form.exclusiones || undefined,
      notas: form.notas || undefined,
      orden_venta_numero: form.orden_venta_numero || undefined,
      emitida_por: user?.email || '',
    });
    if (g) {
      toast.success(`Garantía ${g.numero} emitida`);
      setVista('lista');
      loadData();
    } else toast.error('No se pudo emitir la garantía');
  };

  const imprimir = (g: Garantia) => {
    const w = window.open('', '_blank', 'width=600,height=800');
    if (!w) return;
    w.document.write(`<html><head><title>Garantía ${g.numero}</title>
      <style>
        body{font-family:sans-serif;padding:32px;color:#222}
        .box{border:2px solid #000;padding:24px;border-radius:8px}
        h1{margin:0 0 8px 0}
        .row{margin:6px 0}
        .lbl{font-weight:bold}
        .total{font-size:20px;margin-top:16px;padding-top:8px;border-top:2px solid #000}
        .firma{margin-top:48px;border-top:1px dashed #000;padding-top:8px;text-align:center}
      </style></head><body>
      <div class="box">
        <h1>CERTIFICADO DE GARANTÍA</h1>
        <div class="row"><span class="lbl">N°:</span> ${g.numero}</div>
        <div class="row"><span class="lbl">Cliente:</span> ${g.cliente_nombre || '—'}</div>
        <div class="row"><span class="lbl">Producto:</span> ${g.producto_nombre || g.producto_codigo}</div>
        ${g.serial_numero ? `<div class="row"><span class="lbl">Serial:</span> ${g.serial_numero}</div>` : ''}
        <div class="row"><span class="lbl">Cantidad:</span> ${g.cantidad}</div>
        <div class="row"><span class="lbl">Inicio:</span> ${g.fecha_inicio}</div>
        <div class="total"><span class="lbl">Vence:</span> ${g.fecha_vencimiento} (${g.duracion_meses} meses)</div>
        ${g.cobertura ? `<div class="row" style="margin-top:16px"><span class="lbl">Cobertura:</span><br>${g.cobertura}</div>` : ''}
        ${g.exclusiones ? `<div class="row"><span class="lbl">Exclusiones:</span><br>${g.exclusiones}</div>` : ''}
        ${g.condiciones ? `<div class="row"><span class="lbl">Condiciones:</span><br>${g.condiciones}</div>` : ''}
        <div class="firma">Firma autorizada</div>
      </div>
      <script>window.onload=()=>window.print();</script></body></html>`);
    w.document.close();
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12"><RefreshCw className="h-8 w-8 animate-spin text-emerald-400" /></div>;
  }

  // ========== DETALLE ==========
  if (vista === 'detalle' && selected) {
    const cfg = ESTADO_CONFIG[selected.estado];
    const dias = Math.ceil((new Date(selected.fecha_vencimiento).getTime() - Date.now()) / 86400000);
    return (
      <div className="space-y-6">
        <toast.Toast />
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-emerald-400" />
              {selected.numero}
            </h3>
            <span className={cn('inline-flex mt-2 px-2 py-0.5 rounded text-xs font-medium', cfg.bg, cfg.color)}>
              {cfg.label}
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => imprimir(selected)} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm rounded-lg flex items-center gap-2">
              <FileText className="h-4 w-4" /> Imprimir certificado
            </button>
            <button onClick={() => { setVista('lista'); setSelected(null); }} className="p-2 hover:bg-slate-800 rounded-lg">
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-2 text-sm">
            <h4 className="text-xs uppercase tracking-wider text-slate-500 mb-2">Producto</h4>
            <Row label="Código" value={selected.producto_codigo} />
            <Row label="Nombre" value={selected.producto_nombre || '—'} />
            {selected.serial_numero && <Row label="Serial" value={selected.serial_numero} mono />}
            {selected.lote_numero && <Row label="Lote" value={selected.lote_numero} mono />}
            <Row label="Cantidad" value={String(selected.cantidad)} />

            <h4 className="text-xs uppercase tracking-wider text-slate-500 mt-4 mb-2">Vigencia</h4>
            <Row label="Inicio" value={selected.fecha_inicio} />
            <Row label="Vencimiento" value={`${selected.fecha_vencimiento} (${selected.duracion_meses} meses)`} bold />
            {selected.estado === 'activa' && (
              <Row label="Días restantes" value={`${dias} día(s)`}
                highlight={dias <= 7 ? 'text-red-300' : dias <= 30 ? 'text-amber-300' : 'text-slate-200'} />
            )}
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-2 text-sm">
            <h4 className="text-xs uppercase tracking-wider text-slate-500 mb-2">Cliente</h4>
            <Row label="Cliente" value={selected.cliente_nombre || '—'} />
            {selected.orden_venta_numero && <Row label="OV referencia" value={selected.orden_venta_numero} />}
            {selected.emitida_por && <Row label="Emitida por" value={selected.emitida_por} />}

            {selected.cobertura && (
              <>
                <h4 className="text-xs uppercase tracking-wider text-slate-500 mt-4 mb-2">Cobertura</h4>
                <p className="text-slate-200 text-xs whitespace-pre-line">{selected.cobertura}</p>
              </>
            )}
            {selected.exclusiones && (
              <>
                <h4 className="text-xs uppercase tracking-wider text-slate-500 mt-3 mb-2">Exclusiones</h4>
                <p className="text-slate-200 text-xs whitespace-pre-line">{selected.exclusiones}</p>
              </>
            )}
            {selected.estado === 'reclamada' && (
              <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs">
                <div className="font-semibold text-amber-300 mb-1">Reclamada</div>
                <div className="text-slate-300">{selected.motivo_reclamo || '—'}</div>
                {selected.fecha_reclamo && (
                  <div className="text-slate-500 mt-1">
                    {new Date(selected.fecha_reclamo).toLocaleString('es-UY')}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
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
            <Plus className="h-6 w-6 text-emerald-400" />
            Nueva garantía
          </h3>
          <button onClick={() => setVista('lista')} className="p-2 hover:bg-slate-800 rounded-lg">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-4 max-w-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Inp label="Cliente" value={form.cliente_nombre} onChange={v => setForm({ ...form, cliente_nombre: v })} />
            <Inp label="OV referencia" value={form.orden_venta_numero} onChange={v => setForm({ ...form, orden_venta_numero: v })} />
            <Inp label="Código producto *" value={form.producto_codigo} onChange={v => setForm({ ...form, producto_codigo: v })} />
            <Inp label="Nombre producto" value={form.producto_nombre} onChange={v => setForm({ ...form, producto_nombre: v })} />
            <Inp label="Serial" value={form.serial_numero} onChange={v => setForm({ ...form, serial_numero: v })} />
            <Inp label="Lote" value={form.lote_numero} onChange={v => setForm({ ...form, lote_numero: v })} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Inp label="Cantidad" type="number" value={form.cantidad} onChange={v => setForm({ ...form, cantidad: v })} />
            <Inp label="Duración (meses) *" type="number" value={form.duracion_meses} onChange={v => setForm({ ...form, duracion_meses: v })} />
            <Inp label="Fecha inicio" type="date" value={form.fecha_inicio} onChange={v => setForm({ ...form, fecha_inicio: v })} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Cobertura</label>
            <textarea rows={2} value={form.cobertura} onChange={e => setForm({ ...form, cobertura: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm resize-none" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Exclusiones</label>
            <textarea rows={2} value={form.exclusiones} onChange={e => setForm({ ...form, exclusiones: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button onClick={() => setVista('lista')} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm">Cancelar</button>
            <button onClick={guardar} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm">Emitir garantía</button>
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
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
            Garantías
          </h3>
          <p className="text-sm text-slate-400 mt-0.5">
            Cobertura post-venta · alertas de vencimiento · trazabilidad por serial
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={() => setVista('nueva')}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg">
            <Plus className="h-4 w-4" /> Nueva garantía
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={CheckCircle} label="Activas" value={stats.activas} color="text-emerald-300" />
        <Kpi icon={Clock} label="Próx. a vencer (30d)" value={stats.proximasVencer} color="text-amber-300" />
        <Kpi icon={AlertTriangle} label="Reclamadas" value={stats.reclamadas} color="text-amber-300" />
        <Kpi icon={Calendar} label="Vencidas" value={stats.vencidas} color="text-slate-400" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por número, producto, cliente, serial..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm" />
        </div>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as any)}
          className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm">
          <option value="todas">Todas</option>
          <option value="activa">Activas</option>
          <option value="vencida">Vencidas</option>
          <option value="reclamada">Reclamadas</option>
          <option value="anulada">Anuladas</option>
        </select>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 border-b border-slate-800">
              <tr className="text-left text-xs text-slate-400 uppercase">
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Serial</th>
                <th className="px-4 py-3">Vence</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtradas.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500 text-sm">Sin garantías</td></tr>
              ) : filtradas.map(g => {
                const cfg = ESTADO_CONFIG[g.estado];
                const dias = Math.ceil((new Date(g.fecha_vencimiento).getTime() - Date.now()) / 86400000);
                return (
                  <tr key={g.id} className="hover:bg-slate-800/30 cursor-pointer" onClick={() => { setSelected(g); setVista('detalle'); }}>
                    <td className="px-4 py-3 font-mono text-slate-200 text-xs">{g.numero}</td>
                    <td className="px-4 py-3 text-slate-300">
                      <div className="font-medium">{g.producto_nombre || g.producto_codigo}</div>
                      {g.producto_nombre && <div className="text-[11px] text-slate-500 font-mono">{g.producto_codigo}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{g.cliente_nombre || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs font-mono">{g.serial_numero || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-slate-300">{g.fecha_vencimiento}</div>
                      {g.estado === 'activa' && (
                        <div className={cn('text-[10px]',
                          dias <= 7 ? 'text-red-400' :
                          dias <= 30 ? 'text-amber-400' : 'text-slate-500')}>
                          {dias > 0 ? `${dias}d restantes` : 'vencida'}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-medium', cfg.bg, cfg.color)}>{cfg.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-emerald-400">
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

function Inp({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm" />
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

function Row({ label, value, bold, mono, highlight }: { label: string; value: string; bold?: boolean; mono?: boolean; highlight?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={cn(highlight || 'text-slate-200', mono && 'font-mono', bold && 'font-bold text-base')}>{value}</span>
    </div>
  );
}
