'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText, Plus, RefreshCw, Search, Send, X, CheckCircle,
  XCircle, Clock, AlertTriangle, Settings, Eye, Receipt,
  Printer, Trash2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn, formatCurrency } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useWmsToast } from '@/components/wms/useWmsToast';
import {
  crearBorradorCFE, firmarCFE,
  registrarAceptacionDGI, registrarRechazoDGI,
  type CFE, type EstadoCFE, type LineaCFE, type TipoCFE, type Receptor,
} from '@/lib/uy-cfe';

const TIPO_CFE_LABEL: Record<number, string> = {
  101: 'e-Ticket',
  102: 'e-Ticket NC',
  103: 'e-Ticket ND',
  111: 'e-Factura',
  112: 'e-Factura NC',
  113: 'e-Factura ND',
  121: 'e-Factura Exportación',
  124: 'e-Remito',
  181: 'e-Resguardo',
};

const ESTADO_CONFIG: Record<EstadoCFE, { label: string; bg: string; color: string; icon: React.ElementType }> = {
  borrador:       { label: 'Borrador',       bg: 'bg-slate-500/15',   color: 'text-slate-300',   icon: Clock },
  firmado:        { label: 'Firmado',        bg: 'bg-blue-500/15',    color: 'text-blue-300',    icon: Send },
  aceptado_dgi:   { label: 'Aceptado DGI',   bg: 'bg-emerald-500/15', color: 'text-emerald-300', icon: CheckCircle },
  rechazado_dgi:  { label: 'Rechazado DGI',  bg: 'bg-red-500/15',     color: 'text-red-300',     icon: XCircle },
  anulado:        { label: 'Anulado',        bg: 'bg-slate-500/15',   color: 'text-slate-400',   icon: X },
};

export default function FacturasElectronicas() {
  const { user } = useAuth(false);
  const toast = useWmsToast();
  const [loading, setLoading] = useState(true);
  const [cfes, setCfes] = useState<CFE[]>([]);
  const [filtroEstado, setFiltroEstado] = useState<EstadoCFE | 'todos'>('todos');
  const [filtroTipo, setFiltroTipo] = useState<number | 'todos'>('todos');
  const [search, setSearch] = useState('');
  const [vista, setVista] = useState<'lista' | 'nuevo' | 'detalle' | 'config'>('lista');
  const [selected, setSelected] = useState<CFE | null>(null);
  const [emisor, setEmisor] = useState<any | null>(null);

  // Form nuevo CFE
  const [form, setForm] = useState({
    tipo_cfe: 111 as TipoCFE,
    receptor_tipo: 'rut' as Receptor['tipo'],
    receptor_documento: '',
    receptor_nombre: '',
    receptor_direccion: '',
    moneda: 'UYU',
    notas: '',
    lineas: [{ descripcion: '', cantidad: 1, precioUnitario: 0, ivaTasa: 22 as 0 | 10 | 22 }] as LineaCFE[],
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cfesRes, emisorRes] = await Promise.all([
        supabase.from('cfe_uy').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('cfe_emisor_config').select('*').eq('activo', true).limit(1).maybeSingle(),
      ]);
      setCfes((cfesRes.data || []) as CFE[]);
      setEmisor(emisorRes.data);
    } finally {
      setLoading(false);
    }
  };

  const filtrados = useMemo(() => {
    return cfes.filter(c => {
      if (filtroEstado !== 'todos' && c.estado !== filtroEstado) return false;
      if (filtroTipo !== 'todos' && c.tipo_cfe !== filtroTipo) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!(`${c.tipo_cfe}-${c.serie}-${c.numero}`.toLowerCase().includes(s) ||
              c.receptor_nombre?.toLowerCase().includes(s) ||
              c.origen_codigo?.toLowerCase().includes(s) ||
              c.cae?.toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [cfes, filtroEstado, filtroTipo, search]);

  const stats = useMemo(() => {
    const borradores = cfes.filter(c => c.estado === 'borrador').length;
    const firmados = cfes.filter(c => c.estado === 'firmado').length;
    const aceptados = cfes.filter(c => c.estado === 'aceptado_dgi').length;
    const rechazados = cfes.filter(c => c.estado === 'rechazado_dgi').length;
    const totalMes = cfes
      .filter(c => {
        if (!c.fecha_emision) return false;
        const f = new Date(c.fecha_emision);
        const hoy = new Date();
        return f.getMonth() === hoy.getMonth() && f.getFullYear() === hoy.getFullYear();
      })
      .reduce((s, c) => s + (c.monto_total || 0), 0);
    return { borradores, firmados, aceptados, rechazados, totalMes };
  }, [cfes]);

  const guardarBorrador = async () => {
    if (!emisor) {
      toast.error('No hay emisor configurado. Andá a "Datos del emisor" primero.');
      return;
    }
    if (!form.lineas[0]?.descripcion) {
      toast.warning('Agregá al menos una línea con descripción');
      return;
    }
    const cfe = await crearBorradorCFE({
      tipoCFE: form.tipo_cfe,
      origenTipo: 'orden_venta',
      receptor: form.receptor_documento ? {
        tipo: form.receptor_tipo,
        documento: form.receptor_documento,
        nombre: form.receptor_nombre,
        direccion: form.receptor_direccion,
      } : undefined,
      lineas: form.lineas.filter(l => l.descripcion && l.cantidad > 0),
      moneda: form.moneda,
      notas: form.notas,
      emitidoPor: user?.email || '',
    });
    if (cfe) {
      toast.success(`Borrador ${cfe.tipo_cfe}-${cfe.serie}-${cfe.numero} creado`);
      setVista('lista');
      setForm({
        tipo_cfe: 111, receptor_tipo: 'rut',
        receptor_documento: '', receptor_nombre: '', receptor_direccion: '',
        moneda: 'UYU', notas: '',
        lineas: [{ descripcion: '', cantidad: 1, precioUnitario: 0, ivaTasa: 22 }],
      });
      loadData();
    } else {
      toast.error('No se pudo crear el borrador');
    }
  };

  const firmar = async (cfe: CFE) => {
    const ok = await firmarCFE(cfe.id, user?.email || '');
    if (ok) {
      toast.success('CFE firmado');
      loadData();
    } else {
      toast.error('No se pudo firmar');
    }
  };

  const simularAceptacionDGI = async (cfe: CFE) => {
    // Hasta tener integración real con DGI, dejamos un botón
    // que simula la respuesta para poder testear el flujo.
    const cae = `CAE-${Date.now().toString().slice(-12)}`;
    const venc = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    const ok = await registrarAceptacionDGI(cfe.id, cae, venc, user?.email || '');
    if (ok) {
      toast.success(`CAE ${cae} registrado (simulado)`);
      loadData();
    }
  };

  const simularRechazoDGI = async (cfe: CFE) => {
    const motivo = prompt('Motivo del rechazo (simulado):') || 'Rechazo simulado';
    const ok = await registrarRechazoDGI(cfe.id, motivo, user?.email || '');
    if (ok) {
      toast.success('Rechazo registrado');
      loadData();
    }
  };

  const imprimir = (cfe: CFE) => {
    const w = window.open('', '_blank', 'width=600,height=800');
    if (!w) return;
    const html = `<html><head><title>CFE ${cfe.tipo_cfe}-${cfe.serie}-${cfe.numero}</title>
      <style>
        body { font-family: monospace; padding: 24px; }
        .box { border: 2px solid #000; padding: 16px; }
        h1 { margin: 0 0 8px 0; }
        .row { margin: 4px 0; }
        .lbl { font-weight: bold; }
        .total { font-size: 24px; margin-top: 16px; padding-top: 8px; border-top: 2px solid #000; }
        .qr { font-family: 'Courier New', monospace; font-size: 10px; word-break: break-all; margin-top: 12px; padding: 8px; border: 1px dashed #000; }
      </style></head>
      <body><div class="box">
        <h1>${TIPO_CFE_LABEL[cfe.tipo_cfe] || 'CFE'} ${cfe.serie}-${cfe.numero}</h1>
        <div class="row"><span class="lbl">Receptor:</span> ${cfe.receptor_nombre || '—'} (${cfe.receptor_documento || ''})</div>
        <div class="row"><span class="lbl">Moneda:</span> ${cfe.moneda}</div>
        <div class="row"><span class="lbl">Neto:</span> ${formatCurrency(cfe.monto_neto || 0)}</div>
        <div class="row"><span class="lbl">IVA:</span> ${formatCurrency(cfe.monto_iva || 0)}</div>
        <div class="total"><span class="lbl">Total:</span> ${formatCurrency(cfe.monto_total)}</div>
        <div class="row"><span class="lbl">CAE:</span> ${cfe.cae || 'Pendiente DGI'}</div>
        <div class="row"><span class="lbl">Estado:</span> ${cfe.estado}</div>
        <div class="qr">QR: ${cfe.qr_url || '—'}</div>
      </div>
      <script>window.onload=()=>window.print();</script></body></html>`;
    w.document.write(html);
    w.document.close();
  };

  const setLineaField = (idx: number, field: keyof LineaCFE, value: any) => {
    setForm(p => ({
      ...p,
      lineas: p.lineas.map((l, i) => i === idx ? { ...l, [field]: value } : l),
    }));
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12"><RefreshCw className="h-8 w-8 animate-spin text-blue-400" /></div>;
  }

  // ========== CONFIG EMISOR ==========
  if (vista === 'config') {
    return <EmisorConfigPanel emisor={emisor} onSaved={() => { loadData(); setVista('lista'); }} onCancel={() => setVista('lista')} />;
  }

  // ========== DETALLE ==========
  if (vista === 'detalle' && selected) {
    const cfg = ESTADO_CONFIG[selected.estado];
    const Icon = cfg.icon;
    return (
      <div className="space-y-6">
        <toast.Toast />
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Receipt className="h-6 w-6 text-blue-400" />
              {TIPO_CFE_LABEL[selected.tipo_cfe]} {selected.serie}-{selected.numero}
            </h3>
            <span className={cn('inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded text-xs font-medium', cfg.bg, cfg.color)}>
              <Icon className="h-3 w-3" />
              {cfg.label}
            </span>
          </div>
          <button onClick={() => { setVista('lista'); setSelected(null); }} className="p-2 hover:bg-slate-800 rounded-lg">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-2 text-sm">
            <Field label="Receptor" value={`${selected.receptor_nombre || '—'} (${selected.receptor_tipo || ''} ${selected.receptor_documento || ''})`} />
            {selected.receptor_direccion && <Field label="Dirección" value={selected.receptor_direccion} />}
            <Field label="Moneda" value={selected.moneda} />
            <Field label="Monto neto" value={formatCurrency(selected.monto_neto || 0)} />
            <Field label="IVA" value={formatCurrency(selected.monto_iva || 0)} />
            <Field label="Monto total" value={formatCurrency(selected.monto_total)} bold />
            {selected.cae && <Field label="CAE" value={selected.cae} mono />}
            {selected.cae_vencimiento && <Field label="CAE vencimiento" value={selected.cae_vencimiento} />}
            {selected.qr_url && (
              <div className="pt-2">
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">QR consulta DGI</div>
                <code className="text-[11px] text-slate-300 break-all block bg-slate-950 rounded p-2">{selected.qr_url}</code>
              </div>
            )}
            {selected.rechazo_motivo && (
              <div className="bg-red-500/10 border border-red-500/30 rounded p-2 mt-2">
                <div className="text-xs text-red-300 font-semibold mb-1">Motivo de rechazo</div>
                <div className="text-sm text-red-200">{selected.rechazo_motivo}</div>
              </div>
            )}
            {selected.emitido_por && <Field label="Emitido por" value={selected.emitido_por} />}
            {selected.fecha_emision && <Field label="Fecha emisión" value={new Date(selected.fecha_emision).toLocaleString('es-UY')} />}
          </div>

          <div className="space-y-3">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-2">
              <h4 className="text-sm font-semibold text-slate-200 mb-2">Acciones</h4>
              <button onClick={() => imprimir(selected)} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm">
                <Printer className="h-4 w-4" />
                Imprimir
              </button>
              {selected.estado === 'borrador' && (
                <button onClick={() => firmar(selected)} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm">
                  <Send className="h-4 w-4" />
                  Firmar y emitir
                </button>
              )}
              {selected.estado === 'firmado' && (
                <>
                  <button onClick={() => simularAceptacionDGI(selected)} className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm">
                    Simular aceptación DGI
                  </button>
                  <button onClick={() => simularRechazoDGI(selected)} className="w-full px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm">
                    Simular rechazo DGI
                  </button>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Hasta tener el certificado de DGI conectado, podés simular la respuesta para testear el flujo.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ========== NUEVO ==========
  if (vista === 'nuevo') {
    const totalLineas = form.lineas.reduce((s, l) => {
      const sub = l.cantidad * l.precioUnitario;
      const desc = (l.descuentoPct || 0) * sub / 100;
      const base = sub - desc;
      const iva = base * ((l.ivaTasa ?? 22) / 100);
      return s + base + iva;
    }, 0);

    return (
      <div className="space-y-6">
        <toast.Toast />
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Plus className="h-6 w-6 text-blue-400" />
            Nuevo CFE
          </h3>
          <button onClick={() => setVista('lista')} className="p-2 hover:bg-slate-800 rounded-lg">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-4 max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tipo CFE</label>
              <select value={form.tipo_cfe} onChange={e => setForm({ ...form, tipo_cfe: parseInt(e.target.value) as TipoCFE })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm">
                {Object.entries(TIPO_CFE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{k} — {v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Moneda</label>
              <select value={form.moneda} onChange={e => setForm({ ...form, moneda: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm">
                <option>UYU</option><option>USD</option><option>EUR</option>
              </select>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-3">
            <h4 className="text-sm font-semibold text-slate-200 mb-2">Receptor</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Tipo doc</label>
                <select value={form.receptor_tipo} onChange={e => setForm({ ...form, receptor_tipo: e.target.value as Receptor['tipo'] })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm">
                  <option value="rut">RUT</option>
                  <option value="ci">CI</option>
                  <option value="pasaporte">Pasaporte</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <Inp label="Documento" value={form.receptor_documento} onChange={v => setForm({ ...form, receptor_documento: v })} />
              <Inp label="Razón social / Nombre" value={form.receptor_nombre} onChange={v => setForm({ ...form, receptor_nombre: v })} />
            </div>
            <div className="mt-3">
              <Inp label="Dirección" value={form.receptor_direccion} onChange={v => setForm({ ...form, receptor_direccion: v })} />
            </div>
          </div>

          <div className="border-t border-slate-800 pt-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-slate-200">Líneas</h4>
              <button onClick={() => setForm(p => ({ ...p, lineas: [...p.lineas, { descripcion: '', cantidad: 1, precioUnitario: 0, ivaTasa: 22 }] }))}
                className="text-xs text-blue-400 flex items-center gap-1">
                <Plus className="h-3 w-3" /> Agregar línea
              </button>
            </div>
            <div className="space-y-2">
              {form.lineas.map((l, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 bg-slate-800/30 rounded-lg p-2">
                  <input value={l.descripcion} onChange={e => setLineaField(idx, 'descripcion', e.target.value)}
                    placeholder="Descripción"
                    className="col-span-5 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm" />
                  <input type="number" value={l.cantidad} onChange={e => setLineaField(idx, 'cantidad', parseFloat(e.target.value) || 0)}
                    placeholder="Cant"
                    className="col-span-2 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm" />
                  <input type="number" value={l.precioUnitario} onChange={e => setLineaField(idx, 'precioUnitario', parseFloat(e.target.value) || 0)}
                    placeholder="P. unit"
                    className="col-span-2 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm" />
                  <select value={l.ivaTasa ?? 22} onChange={e => setLineaField(idx, 'ivaTasa', parseInt(e.target.value) as 0|10|22)}
                    className="col-span-2 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm">
                    <option value={0}>0% Exento</option>
                    <option value={10}>10% Mínimo</option>
                    <option value={22}>22% Básica</option>
                  </select>
                  {form.lineas.length > 1 && (
                    <button onClick={() => setForm(p => ({ ...p, lineas: p.lineas.filter((_, i) => i !== idx) }))}
                      className="col-span-1 hover:bg-red-500/20 rounded text-red-400 flex items-center justify-center">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="text-right text-sm text-slate-300 mt-3">
              Total estimado: <span className="font-bold text-slate-100">{formatCurrency(totalLineas)} {form.moneda}</span>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-3">
            <label className="block text-xs text-slate-400 mb-1">Notas</label>
            <textarea rows={2} value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm resize-none" />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button onClick={() => setVista('lista')} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm">Cancelar</button>
            <button onClick={guardarBorrador} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Guardar borrador
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
            <Receipt className="h-6 w-6 text-blue-400" />
            Facturación electrónica (DGI Uruguay)
          </h3>
          <p className="text-sm text-slate-400 mt-0.5">
            Comprobantes Fiscales Electrónicos: e-Ticket, e-Factura, NC, ND, Remito.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setVista('config')} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg">
            <Settings className="h-4 w-4" />
            Datos del emisor
          </button>
          <button onClick={loadData} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={() => setVista('nuevo')}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg">
            <Plus className="h-4 w-4" />
            Nuevo CFE
          </button>
        </div>
      </div>

      {!emisor && (
        <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-3 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-300 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-amber-300">Falta configurar el emisor</h4>
            <p className="text-xs text-slate-400 mt-1">
              Antes de emitir el primer CFE configurá los datos fiscales de la empresa (RUT, razón social, serie autorizada).
              Hacé click en <strong>Datos del emisor</strong>.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Borradores" value={stats.borradores} color="text-slate-300" />
        <Kpi label="Firmados" value={stats.firmados} color="text-blue-300" />
        <Kpi label="Aceptados DGI" value={stats.aceptados} color="text-emerald-300" />
        <Kpi label="Rechazados" value={stats.rechazados} color="text-red-300" />
        <Kpi label="Facturado mes" value={formatCurrency(stats.totalMes)} color="text-amber-300" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por número, receptor o CAE"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm" />
        </div>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as any)}
          className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm">
          <option value="todos">Todos los estados</option>
          <option value="borrador">Borrador</option>
          <option value="firmado">Firmado</option>
          <option value="aceptado_dgi">Aceptado DGI</option>
          <option value="rechazado_dgi">Rechazado</option>
          <option value="anulado">Anulado</option>
        </select>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value === 'todos' ? 'todos' : parseInt(e.target.value))}
          className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm">
          <option value="todos">Todos los tipos</option>
          {Object.entries(TIPO_CFE_LABEL).map(([k, v]) => <option key={k} value={k}>{k} — {v}</option>)}
        </select>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 border-b border-slate-800">
              <tr className="text-left text-xs text-slate-400 uppercase">
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Receptor</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Emisión</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtrados.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500 text-sm">Sin CFE</td></tr>
              ) : filtrados.map(c => {
                const cfg = ESTADO_CONFIG[c.estado];
                const Icon = cfg.icon;
                return (
                  <tr key={c.id} className="hover:bg-slate-800/30 cursor-pointer" onClick={() => { setSelected(c); setVista('detalle'); }}>
                    <td className="px-4 py-3 text-slate-300 text-xs">{TIPO_CFE_LABEL[c.tipo_cfe]}</td>
                    <td className="px-4 py-3 font-mono text-slate-200">{c.serie}-{c.numero}</td>
                    <td className="px-4 py-3 text-slate-300">{c.receptor_nombre || '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-200 font-medium">{formatCurrency(c.monto_total)} <span className="text-xs text-slate-500">{c.moneda}</span></td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium', cfg.bg, cfg.color)}>
                        <Icon className="h-3 w-3" />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {c.fecha_emision ? new Date(c.fecha_emision).toLocaleDateString('es-UY') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-blue-400">
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

// ============================================
// PANEL DE CONFIG DEL EMISOR
// ============================================

function EmisorConfigPanel({ emisor, onSaved, onCancel }: { emisor: any; onSaved: () => void; onCancel: () => void }) {
  const { user } = useAuth(false);
  const toast = useWmsToast();
  const [form, setForm] = useState({
    rut: emisor?.rut || '',
    razon_social: emisor?.razon_social || '',
    nombre_comercial: emisor?.nombre_comercial || '',
    direccion: emisor?.direccion || '',
    ciudad: emisor?.ciudad || '',
    departamento: emisor?.departamento || '',
    telefono: emisor?.telefono || '',
    email: emisor?.email || '',
    ambiente: emisor?.ambiente || 'test',
    serie_actual: emisor?.serie_actual || 'A',
    proximo_numero_e_ticket: emisor?.proximo_numero_e_ticket || 1,
    proximo_numero_e_factura: emisor?.proximo_numero_e_factura || 1,
    proximo_numero_nc: emisor?.proximo_numero_nc || 1,
    proximo_numero_nd: emisor?.proximo_numero_nd || 1,
    proximo_numero_e_remito: emisor?.proximo_numero_e_remito || 1,
  });

  const guardar = async () => {
    if (!form.rut || !form.razon_social) {
      toast.warning('RUT y razón social son obligatorios');
      return;
    }
    const payload = { ...form, activo: true, updated_at: new Date().toISOString() };
    let res;
    if (emisor?.id) {
      res = await supabase.from('cfe_emisor_config').update(payload).eq('id', emisor.id);
    } else {
      res = await supabase.from('cfe_emisor_config').insert(payload);
    }
    if (res.error) { toast.error(res.error.message); return; }
    toast.success('Configuración guardada');
    void user;
    onSaved();
  };

  return (
    <div className="space-y-6">
      <toast.Toast />
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Settings className="h-6 w-6 text-blue-400" />
          Datos del emisor (DGI)
        </h3>
        <button onClick={onCancel} className="p-2 hover:bg-slate-800 rounded-lg">
          <X className="h-5 w-5 text-slate-400" />
        </button>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3 max-w-3xl">
        <h4 className="text-sm font-semibold text-slate-200">Datos fiscales</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Inp label="RUT *" value={form.rut} onChange={v => setForm({ ...form, rut: v })} />
          <Inp label="Razón social *" value={form.razon_social} onChange={v => setForm({ ...form, razon_social: v })} />
          <Inp label="Nombre comercial" value={form.nombre_comercial} onChange={v => setForm({ ...form, nombre_comercial: v })} />
          <Inp label="Dirección" value={form.direccion} onChange={v => setForm({ ...form, direccion: v })} />
          <Inp label="Ciudad" value={form.ciudad} onChange={v => setForm({ ...form, ciudad: v })} />
          <Inp label="Departamento" value={form.departamento} onChange={v => setForm({ ...form, departamento: v })} />
          <Inp label="Teléfono" value={form.telefono} onChange={v => setForm({ ...form, telefono: v })} />
          <Inp label="Email" value={form.email} onChange={v => setForm({ ...form, email: v })} />
        </div>

        <h4 className="text-sm font-semibold text-slate-200 mt-4 pt-3 border-t border-slate-800">Configuración DGI</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Ambiente</label>
            <select value={form.ambiente} onChange={e => setForm({ ...form, ambiente: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm">
              <option value="test">Test (homologación)</option>
              <option value="produccion">Producción</option>
            </select>
          </div>
          <Inp label="Serie autorizada" value={form.serie_actual} onChange={v => setForm({ ...form, serie_actual: v })} />
        </div>

        <h4 className="text-sm font-semibold text-slate-200 mt-4 pt-3 border-t border-slate-800">Numeración</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Inp label="e-Ticket próximo #" value={String(form.proximo_numero_e_ticket)}
            onChange={v => setForm({ ...form, proximo_numero_e_ticket: parseInt(v) || 1 })} type="number" />
          <Inp label="e-Factura próximo #" value={String(form.proximo_numero_e_factura)}
            onChange={v => setForm({ ...form, proximo_numero_e_factura: parseInt(v) || 1 })} type="number" />
          <Inp label="e-Remito próximo #" value={String(form.proximo_numero_e_remito)}
            onChange={v => setForm({ ...form, proximo_numero_e_remito: parseInt(v) || 1 })} type="number" />
          <Inp label="NC próximo #" value={String(form.proximo_numero_nc)}
            onChange={v => setForm({ ...form, proximo_numero_nc: parseInt(v) || 1 })} type="number" />
          <Inp label="ND próximo #" value={String(form.proximo_numero_nd)}
            onChange={v => setForm({ ...form, proximo_numero_nd: parseInt(v) || 1 })} type="number" />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
          <button onClick={onCancel} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm">Cancelar</button>
          <button onClick={guardar} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm">Guardar</button>
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

function Kpi({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={cn('text-xl font-bold', color)}>{value}</div>
    </div>
  );
}

function Field({ label, value, mono, bold }: { label: string; value: string; mono?: boolean; bold?: boolean }) {
  return (
    <div>
      <span className="text-xs uppercase tracking-wider text-slate-500">{label}: </span>
      <span className={cn('text-slate-200', mono && 'font-mono', bold && 'font-bold text-base')}>{value}</span>
    </div>
  );
}
