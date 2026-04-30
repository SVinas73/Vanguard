'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Package, Plus, Search, RefreshCw, Truck, Printer,
  CheckCircle, X, Edit, Send, Box, Tag, ClipboardCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { registrarAuditoria } from '@/lib/audit';
import { useAuth } from '@/hooks/useAuth';
import { useWmsToast } from './useWmsToast';
import { cn } from '@/lib/utils';

type EstadoPaquete = 'en_armado' | 'cerrado' | 'despachado' | 'entregado' | 'devuelto';

interface Paquete {
  id: string;
  numero: string;
  orden_picking_id?: string | null;
  orden_venta_id?: string | null;
  cliente_nombre?: string | null;
  peso_kg?: number | null;
  largo_cm?: number | null;
  ancho_cm?: number | null;
  alto_cm?: number | null;
  transportista?: string | null;
  tracking_numero?: string | null;
  servicio?: string | null;
  estado: EstadoPaquete;
  notas?: string | null;
  empaquetado_por?: string | null;
  fecha_armado?: string | null;
  fecha_despacho?: string | null;
  fecha_entrega?: string | null;
  created_at: string;
}

interface OrdenListaParaPack {
  id: string;
  numero: string;
  cliente_nombre?: string;
  unidades_pickeadas: number;
  fecha_completada?: string;
  paquete_id?: string | null;
}

const ESTADO_CONFIG: Record<EstadoPaquete, { label: string; color: string; bg: string }> = {
  en_armado:  { label: 'En armado',   color: 'text-amber-300',   bg: 'bg-amber-500/15' },
  cerrado:    { label: 'Cerrado',     color: 'text-blue-300',    bg: 'bg-blue-500/15' },
  despachado: { label: 'Despachado',  color: 'text-purple-300',  bg: 'bg-purple-500/15' },
  entregado:  { label: 'Entregado',   color: 'text-emerald-300', bg: 'bg-emerald-500/15' },
  devuelto:   { label: 'Devuelto',    color: 'text-red-300',     bg: 'bg-red-500/15' },
};

export default function Packing() {
  const { user } = useAuth(false);
  const toast = useWmsToast();
  const [loading, setLoading] = useState(true);
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [ordenesListas, setOrdenesListas] = useState<OrdenListaParaPack[]>([]);
  const [vista, setVista] = useState<'lista' | 'nuevo' | 'detalle'>('lista');
  const [selected, setSelected] = useState<Paquete | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<EstadoPaquete | 'todos'>('todos');
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    orden_picking_id: '',
    cliente_nombre: '',
    peso_kg: '',
    largo_cm: '',
    ancho_cm: '',
    alto_cm: '',
    transportista: '',
    tracking_numero: '',
    servicio: 'estandar',
    notas: '',
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [paquetesRes, ordenesRes] = await Promise.all([
        supabase
          .from('wms_paquetes')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('wms_ordenes_picking')
          .select('id, numero, cliente_nombre, unidades_pickeadas, fecha_completada')
          .eq('estado', 'completada')
          .order('fecha_completada', { ascending: false })
          .limit(50),
      ]);

      setPaquetes(paquetesRes.data || []);

      // Marcar las órdenes que ya están empaquetadas
      const idsEmpaquetadas = new Set(
        (paquetesRes.data || [])
          .map((p: any) => p.orden_picking_id)
          .filter(Boolean)
      );
      setOrdenesListas(
        (ordenesRes.data || []).map((o: any) => ({
          ...o,
          paquete_id: idsEmpaquetadas.has(o.id) ? 'sí' : null,
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  const filtrados = useMemo(() => {
    return paquetes.filter(p => {
      if (filtroEstado !== 'todos' && p.estado !== filtroEstado) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!(p.numero?.toLowerCase().includes(s) ||
              p.tracking_numero?.toLowerCase().includes(s) ||
              p.cliente_nombre?.toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [paquetes, filtroEstado, search]);

  const abrirNuevo = (orden?: OrdenListaParaPack) => {
    setForm({
      orden_picking_id: orden?.id || '',
      cliente_nombre: orden?.cliente_nombre || '',
      peso_kg: '', largo_cm: '', ancho_cm: '', alto_cm: '',
      transportista: '', tracking_numero: '',
      servicio: 'estandar', notas: '',
    });
    setVista('nuevo');
  };

  const guardar = async () => {
    if (!form.orden_picking_id) {
      toast.warning('Seleccioná una orden completada para empaquetar');
      return;
    }
    const numero = `PKG-${new Date().getFullYear()}${String(Date.now()).slice(-6)}`;
    const { data, error } = await supabase
      .from('wms_paquetes')
      .insert({
        numero,
        orden_picking_id: form.orden_picking_id || null,
        cliente_nombre: form.cliente_nombre || null,
        peso_kg: form.peso_kg ? parseFloat(form.peso_kg) : null,
        largo_cm: form.largo_cm ? parseFloat(form.largo_cm) : null,
        ancho_cm: form.ancho_cm ? parseFloat(form.ancho_cm) : null,
        alto_cm: form.alto_cm ? parseFloat(form.alto_cm) : null,
        transportista: form.transportista || null,
        tracking_numero: form.tracking_numero || null,
        servicio: form.servicio,
        notas: form.notas || null,
        estado: 'en_armado',
        empaquetado_por: user?.email || null,
        fecha_armado: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !data) {
      toast.error(error?.message || 'Error al crear paquete');
      return;
    }

    // Llenar items del paquete a partir de las líneas pickeadas
    // de la orden de picking de origen. Esto deja constancia de
    // qué productos / lotes / cantidades viajan en el paquete.
    if (form.orden_picking_id) {
      const { data: lineas } = await supabase
        .from('wms_ordenes_picking_lineas')
        .select('producto_codigo, producto_nombre, cantidad_pickeada, unidad_medida, lote_numero')
        .eq('orden_picking_id', form.orden_picking_id)
        .gt('cantidad_pickeada', 0);

      if (lineas && lineas.length > 0) {
        await supabase.from('wms_paquetes_items').insert(
          lineas.map((l: any) => ({
            paquete_id: data.id,
            producto_codigo: l.producto_codigo,
            producto_nombre: l.producto_nombre,
            cantidad: parseFloat(l.cantidad_pickeada) || 0,
            unidad_medida: l.unidad_medida || 'UND',
            lote_numero: l.lote_numero || null,
          }))
        );
      }
    }

    await registrarAuditoria('wms_paquetes', 'CREAR', numero, null,
      { orden: form.orden_picking_id, transportista: form.transportista },
      user?.email || '');

    toast.success(`Paquete ${numero} creado`);
    setVista('lista');
    loadData();
  };

  const cambiarEstado = async (paquete: Paquete, nuevoEstado: EstadoPaquete) => {
    const updates: any = { estado: nuevoEstado, updated_at: new Date().toISOString() };
    if (nuevoEstado === 'despachado') updates.fecha_despacho = new Date().toISOString();
    if (nuevoEstado === 'entregado') updates.fecha_entrega = new Date().toISOString();

    const { error } = await supabase.from('wms_paquetes').update(updates).eq('id', paquete.id);
    if (error) { toast.error(error.message); return; }

    await registrarAuditoria('wms_paquetes', `ESTADO_${nuevoEstado.toUpperCase()}`,
      paquete.numero, { estado: paquete.estado }, updates, user?.email || '');

    toast.success(`${paquete.numero} → ${nuevoEstado}`);
    loadData();
  };

  const imprimirEtiqueta = (p: Paquete) => {
    // Etiqueta simple para imprimir desde el navegador
    const w = window.open('', '_blank', 'width=400,height=600');
    if (!w) return;
    const html = `
      <html>
      <head><title>Etiqueta ${p.numero}</title>
      <style>
        body { font-family: monospace; padding: 20px; }
        .box { border: 2px solid #000; padding: 16px; }
        h1 { margin: 0 0 8px 0; font-size: 22px; }
        .row { margin: 6px 0; }
        .lbl { font-weight: bold; }
        .barcode { letter-spacing: -1px; font-size: 28px; text-align: center; margin: 16px 0; font-family: 'Courier New', monospace; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 8px; }
      </style></head>
      <body>
        <div class="box">
          <h1>${p.numero}</h1>
          <div class="row"><span class="lbl">Cliente:</span> ${p.cliente_nombre || '—'}</div>
          <div class="row"><span class="lbl">Transportista:</span> ${p.transportista || '—'}</div>
          <div class="row"><span class="lbl">Servicio:</span> ${p.servicio || '—'}</div>
          <div class="row"><span class="lbl">Peso:</span> ${p.peso_kg || '—'} kg</div>
          <div class="row"><span class="lbl">Dim:</span> ${p.largo_cm || '?'}×${p.ancho_cm || '?'}×${p.alto_cm || '?'} cm</div>
          <div class="barcode">*${p.tracking_numero || p.numero}*</div>
        </div>
        <script>window.onload=()=>{window.print();}</script>
      </body></html>
    `;
    w.document.write(html);
    w.document.close();
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12"><RefreshCw className="h-8 w-8 animate-spin text-blue-400" /></div>;
  }

  // ========== LISTA ==========
  if (vista === 'lista') {
    return (
      <div className="space-y-6">
        <toast.Toast />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Package className="h-6 w-6 text-blue-400" />
              Packing & Despacho
            </h3>
            <p className="text-sm text-slate-400 mt-0.5">Armado de bultos, asignación de transportista y tracking</p>
          </div>
          <button onClick={loadData} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Órdenes listas para empaquetar */}
        {ordenesListas.filter(o => !o.paquete_id).length > 0 && (
          <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-amber-300 mb-2 flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Picking completado, listo para empaquetar
            </h4>
            <div className="space-y-2">
              {ordenesListas.filter(o => !o.paquete_id).slice(0, 8).map(o => (
                <div key={o.id} className="flex items-center justify-between bg-slate-900/50 rounded-lg p-2">
                  <div className="text-sm">
                    <div className="text-slate-200 font-medium">{o.numero}</div>
                    <div className="text-xs text-slate-500">{o.cliente_nombre || 'Sin cliente'} · {o.unidades_pickeadas} uds</div>
                  </div>
                  <button
                    onClick={() => abrirNuevo(o)}
                    className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-xs font-medium rounded-lg"
                  >
                    Empaquetar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por número, tracking o cliente"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm"
            />
          </div>
          <select
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value as any)}
            className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm"
          >
            <option value="todos">Todos los estados</option>
            <option value="en_armado">En armado</option>
            <option value="cerrado">Cerrado</option>
            <option value="despachado">Despachado</option>
            <option value="entregado">Entregado</option>
            <option value="devuelto">Devuelto</option>
          </select>
          <button
            onClick={() => abrirNuevo()}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg"
          >
            <Plus className="h-4 w-4" />
            Nuevo paquete
          </button>
        </div>

        {/* Lista */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 border-b border-slate-800">
                <tr className="text-left text-xs text-slate-400 uppercase">
                  <th className="px-4 py-3">Número</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Transportista</th>
                  <th className="px-4 py-3">Tracking</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Creado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filtrados.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-500 text-sm">Sin paquetes</td></tr>
                ) : filtrados.map(p => {
                  const cfg = ESTADO_CONFIG[p.estado];
                  return (
                    <tr key={p.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono text-slate-200">{p.numero}</td>
                      <td className="px-4 py-3 text-slate-300">{p.cliente_nombre || '—'}</td>
                      <td className="px-4 py-3 text-slate-300">{p.transportista || '—'}</td>
                      <td className="px-4 py-3 text-slate-300 font-mono text-xs">{p.tracking_numero || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-medium', cfg.bg, cfg.color)}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(p.created_at).toLocaleDateString('es-UY')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => imprimirEtiqueta(p)}
                            className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-blue-400"
                            title="Imprimir etiqueta"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                          {p.estado === 'en_armado' && (
                            <button
                              onClick={() => cambiarEstado(p, 'cerrado')}
                              className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-blue-400"
                              title="Cerrar"
                            >
                              <Box className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {p.estado === 'cerrado' && (
                            <button
                              onClick={() => cambiarEstado(p, 'despachado')}
                              className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-purple-400"
                              title="Despachar"
                            >
                              <Send className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {p.estado === 'despachado' && (
                            <button
                              onClick={() => cambiarEstado(p, 'entregado')}
                              className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-emerald-400"
                              title="Marcar entregado"
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
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

  // ========== FORM NUEVO ==========
  return (
    <div className="space-y-6">
      <toast.Toast />
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Package className="h-6 w-6 text-blue-400" />
          Nuevo paquete
        </h3>
        <button onClick={() => setVista('lista')} className="p-2 hover:bg-slate-800 rounded-lg">
          <X className="h-5 w-5 text-slate-400" />
        </button>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-4 max-w-2xl">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Orden de picking</label>
          <select
            value={form.orden_picking_id}
            onChange={e => {
              const o = ordenesListas.find(x => x.id === e.target.value);
              setForm({ ...form, orden_picking_id: e.target.value, cliente_nombre: o?.cliente_nombre || '' });
            }}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm"
          >
            <option value="">Seleccionar...</option>
            {ordenesListas.filter(o => !o.paquete_id).map(o => (
              <option key={o.id} value={o.id}>{o.numero} — {o.cliente_nombre || 'Sin cliente'} ({o.unidades_pickeadas} uds)</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Cliente" value={form.cliente_nombre} onChange={v => setForm({ ...form, cliente_nombre: v })} />
          <Input label="Servicio" value={form.servicio} onChange={v => setForm({ ...form, servicio: v })} placeholder="estandar / express / retiro" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Input label="Peso (kg)" type="number" value={form.peso_kg} onChange={v => setForm({ ...form, peso_kg: v })} />
          <Input label="Largo (cm)" type="number" value={form.largo_cm} onChange={v => setForm({ ...form, largo_cm: v })} />
          <Input label="Ancho (cm)" type="number" value={form.ancho_cm} onChange={v => setForm({ ...form, ancho_cm: v })} />
          <Input label="Alto (cm)" type="number" value={form.alto_cm} onChange={v => setForm({ ...form, alto_cm: v })} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Transportista" value={form.transportista} onChange={v => setForm({ ...form, transportista: v })} />
          <Input label="Tracking" value={form.tracking_numero} onChange={v => setForm({ ...form, tracking_numero: v })} />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Notas</label>
          <textarea
            value={form.notas}
            onChange={e => setForm({ ...form, notas: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => setVista('lista')}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
          >Cancelar</button>
          <button
            onClick={guardar}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm flex items-center gap-2"
          >
            <Tag className="h-4 w-4" />
            Crear paquete
          </button>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm"
      />
    </div>
  );
}
