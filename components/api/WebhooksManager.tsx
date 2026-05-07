'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Webhook, Plus, RefreshCw, Trash2, Play, X, AlertTriangle,
  CheckCircle, XCircle, Eye, ExternalLink, Send,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useWmsToast } from '@/components/wms/useWmsToast';

const EVENTOS_DISPONIBLES = [
  'orden_venta.creada', 'orden_venta.confirmada', 'orden_venta.entregada', 'orden_venta.cancelada',
  'orden_compra.creada', 'orden_compra.recibida',
  'cotizacion.creada', 'cotizacion.aprobada', 'cotizacion.rechazada',
  'cliente.creado', 'cliente.actualizado',
  'producto.bajo_stock', 'producto.sin_stock',
  'ticket.abierto', 'ticket.resuelto', 'ticket.cerrado', 'ticket.sla_breached',
  'garantia.creada', 'garantia.por_vencer', 'garantia.reclamada',
  'rma.creado', 'rma.cerrado',
  'cfe.emitido', 'cfe.aceptado', 'cfe.rechazado',
  'aprobacion.creada', 'aprobacion.aprobada', 'aprobacion.rechazada',
];

interface WebhookRow {
  id: string;
  nombre: string;
  url: string;
  eventos: string[];
  activo: boolean;
  ultimo_envio_at?: string | null;
  ultimo_status?: number | null;
  fallos_consecutivos: number;
  creado_por: string;
  notas?: string;
  created_at: string;
}

interface DeliveryRow {
  id: string;
  evento: string;
  estado: string;
  status?: number | null;
  intentos: number;
  error?: string;
  created_at: string;
}

export default function WebhooksManager() {
  const { user } = useAuth(false);
  const toast = useWmsToast();
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<'lista' | 'nuevo' | 'detalle'>('lista');
  const [selected, setSelected] = useState<WebhookRow | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [procesando, setProcesando] = useState(false);

  const [form, setForm] = useState({
    nombre: '', url: '',
    eventos: [] as string[],
    notas: '',
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('webhooks')
        .select('*').order('created_at', { ascending: false });
      setWebhooks((data || []) as WebhookRow[]);
    } finally { setLoading(false); }
  };

  const loadDeliveries = async (id: string) => {
    const { data } = await supabase.from('webhook_deliveries')
      .select('id, evento, estado, status, intentos, error, created_at')
      .eq('webhook_id', id).order('created_at', { ascending: false }).limit(50);
    setDeliveries((data || []) as DeliveryRow[]);
  };

  const verDetalle = (w: WebhookRow) => {
    setSelected(w);
    loadDeliveries(w.id);
    setVista('detalle');
  };

  const crear = async () => {
    if (!form.nombre.trim() || !form.url.trim() || form.eventos.length === 0) {
      toast.warning('Completá nombre, URL y al menos un evento');
      return;
    }
    if (!form.url.startsWith('https://') && !form.url.startsWith('http://localhost')) {
      toast.warning('La URL debe ser HTTPS (o http://localhost para tests)');
      return;
    }
    try {
      const { crearWebhook } = await import('@/lib/api-gateway/webhooks');
      const wh = await crearWebhook({
        nombre: form.nombre,
        url: form.url,
        eventos: form.eventos as any,
        notas: form.notas || undefined,
        creadoPor: user?.email || '',
      });
      if (wh) {
        toast.success(`Webhook "${wh.nombre}" creado`);
        setVista('lista');
        setForm({ nombre: '', url: '', eventos: [], notas: '' });
        loadData();
      } else {
        toast.error('No se pudo crear');
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const eliminar = async (w: WebhookRow) => {
    if (!confirm(`¿Eliminar webhook "${w.nombre}"?`)) return;
    const { eliminarWebhook } = await import('@/lib/api-gateway/webhooks');
    const ok = await eliminarWebhook(w.id);
    if (ok) {
      toast.success('Webhook eliminado');
      loadData();
    }
  };

  const procesarPendientes = async () => {
    setProcesando(true);
    try {
      const res = await fetch('/api/internal/webhooks-dispatch?limit=50', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Procesados: ${data.procesados ?? 0} · ${data.ok ?? 0} OK · ${data.fallidos ?? 0} fallaron · ${data.descartados ?? 0} descartados`);
        if (selected) loadDeliveries(selected.id);
        loadData();
      } else {
        toast.error(data.error || 'Error');
      }
    } finally { setProcesando(false); }
  };

  const stats = useMemo(() => ({
    activos: webhooks.filter(w => w.activo).length,
    inactivos: webhooks.filter(w => !w.activo).length,
    conFallos: webhooks.filter(w => w.fallos_consecutivos > 0).length,
  }), [webhooks]);

  if (loading) {
    return <div className="flex items-center justify-center p-12"><RefreshCw className="h-8 w-8 animate-spin text-purple-400" /></div>;
  }

  // ========== Detalle ==========
  if (vista === 'detalle' && selected) {
    return (
      <div className="space-y-6">
        <toast.Toast />
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Webhook className="h-6 w-6 text-purple-400" />
              {selected.nombre}
            </h3>
            <a href={selected.url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:underline flex items-center gap-1 mt-1">
              {selected.url} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <button onClick={() => { setVista('lista'); setSelected(null); }} className="p-2 hover:bg-slate-800 rounded-lg">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 text-sm space-y-2">
            <h4 className="text-xs uppercase tracking-wider text-slate-500 mb-2">Configuración</h4>
            <div><span className="text-slate-500">Estado:</span> {selected.activo ? <span className="text-emerald-300">Activo</span> : <span className="text-red-300">Inactivo</span>}</div>
            <div><span className="text-slate-500">Eventos:</span></div>
            <div className="flex flex-wrap gap-1">
              {selected.eventos.map(e => (
                <span key={e} className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300">{e}</span>
              ))}
            </div>
            {selected.ultimo_envio_at && (
              <div className="pt-2 border-t border-slate-800">
                <div><span className="text-slate-500">Último envío:</span> {new Date(selected.ultimo_envio_at).toLocaleString('es-UY')}</div>
                <div><span className="text-slate-500">Status:</span> {selected.ultimo_status || '—'}</div>
              </div>
            )}
            {selected.fallos_consecutivos > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded p-2 mt-2 text-xs text-amber-300 flex items-center gap-2">
                <AlertTriangle className="h-3 w-3" />
                {selected.fallos_consecutivos} fallos consecutivos
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-xl">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-200">Últimas entregas (50)</h4>
              <button onClick={procesarPendientes} disabled={procesando}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs rounded-lg flex items-center gap-1.5">
                {procesando ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                Procesar pendientes
              </button>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/50 sticky top-0">
                  <tr className="text-left text-xs text-slate-400 uppercase">
                    <th className="px-3 py-2">Evento</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Intentos</th>
                    <th className="px-3 py-2">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {deliveries.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-6 text-slate-500 text-xs">Sin entregas</td></tr>
                  ) : deliveries.map(d => (
                    <tr key={d.id}>
                      <td className="px-3 py-2 font-mono text-xs text-slate-300">{d.evento}</td>
                      <td className="px-3 py-2">
                        <span className={cn('inline-flex px-1.5 py-0.5 rounded text-[10px]',
                          d.estado === 'enviado' ? 'bg-emerald-500/15 text-emerald-300' :
                          d.estado === 'fallido' || d.estado === 'descartado' ? 'bg-red-500/15 text-red-300' :
                          'bg-amber-500/15 text-amber-300',
                        )}>{d.estado}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-400">{d.status || '—'}</td>
                      <td className="px-3 py-2 text-xs text-slate-400">{d.intentos}</td>
                      <td className="px-3 py-2 text-[10px] text-slate-500">{new Date(d.created_at).toLocaleString('es-UY')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ========== Nuevo ==========
  if (vista === 'nuevo') {
    return (
      <div className="space-y-6">
        <toast.Toast />
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Plus className="h-6 w-6 text-purple-400" /> Nuevo Webhook
          </h3>
          <button onClick={() => setVista('lista')} className="p-2 hover:bg-slate-800 rounded-lg">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-4 max-w-2xl">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nombre *</label>
            <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
              placeholder="ej: Slack #ventas"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">URL del endpoint *</label>
            <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })}
              placeholder="https://tu-app.com/webhooks/vanguard"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm font-mono" />
            <p className="text-[10px] text-slate-500 mt-1">
              Cada payload va firmado con HMAC-SHA256 en <code>X-Vanguard-Signature</code>.
            </p>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-2">Eventos</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto bg-slate-950/30 p-2 rounded">
              {EVENTOS_DISPONIBLES.map(e => (
                <label key={e} className="flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-slate-800/50">
                  <input type="checkbox" checked={form.eventos.includes(e)}
                    onChange={ev => setForm(p => ({
                      ...p,
                      eventos: ev.target.checked ? [...p.eventos, e] : p.eventos.filter(x => x !== e),
                    }))} />
                  <span className="text-[11px] text-slate-300 font-mono">{e}</span>
                </label>
              ))}
            </div>
            <button type="button"
              onClick={() => setForm(p => ({ ...p, eventos: [...EVENTOS_DISPONIBLES] }))}
              className="text-[10px] text-purple-400 hover:text-purple-300 mt-1">
              Seleccionar todos
            </button>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Notas</label>
            <textarea rows={2} value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm resize-none" />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button onClick={() => setVista('lista')} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm">Cancelar</button>
            <button onClick={crear} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm">Crear webhook</button>
          </div>
        </div>
      </div>
    );
  }

  // ========== Lista ==========
  return (
    <div className="space-y-6">
      <toast.Toast />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Webhook className="h-6 w-6 text-purple-400" />
            Webhooks
          </h3>
          <p className="text-sm text-slate-400 mt-0.5">
            Endpoints externos que reciben eventos del sistema en tiempo real (Slack, Discord, Make, Zapier, tu propia app, etc).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={procesarPendientes} disabled={procesando}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-sm rounded-lg">
            {procesando ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Procesar pendientes
          </button>
          <button onClick={() => setVista('nuevo')}
            className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg">
            <Plus className="h-4 w-4" /> Nuevo webhook
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Activos" value={stats.activos} color="text-emerald-300" />
        <Kpi label="Inactivos" value={stats.inactivos} color="text-slate-400" />
        <Kpi label="Con fallos" value={stats.conFallos} color="text-amber-300" />
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 border-b border-slate-800">
              <tr className="text-left text-xs text-slate-400 uppercase">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">URL</th>
                <th className="px-4 py-3">Eventos</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Último envío</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {webhooks.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-500 text-sm">
                  Sin webhooks. Creá el primero arriba.
                </td></tr>
              ) : webhooks.map(w => (
                <tr key={w.id} className="hover:bg-slate-800/30 cursor-pointer" onClick={() => verDetalle(w)}>
                  <td className="px-4 py-3 text-slate-200">{w.nombre}</td>
                  <td className="px-4 py-3 text-xs text-slate-400 font-mono max-w-xs truncate">{w.url}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{w.eventos.length} eventos</td>
                  <td className="px-4 py-3">
                    {w.activo ? (
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/15 text-emerald-300">Activo</span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-red-500/15 text-red-300">Inactivo</span>
                    )}
                    {w.fallos_consecutivos > 0 && (
                      <span className="ml-1 inline-flex px-1.5 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-300">
                        {w.fallos_consecutivos} fallos
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {w.ultimo_envio_at ? new Date(w.ultimo_envio_at).toLocaleString('es-UY') : 'Nunca'}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <button onClick={() => eliminar(w)}
                      className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400" title="Eliminar">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={cn('text-2xl font-bold', color)}>{value}</div>
    </div>
  );
}
