'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus, Edit, Trash2, CheckCircle, XCircle, AlertTriangle,
  RefreshCw, Tag, Percent, Shield, CreditCard, ChevronDown,
  ChevronUp, Save, X, Building, Users
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn, formatCurrency } from '@/lib/utils';
import { registrarAuditoria } from '@/lib/audit';
import { useAuth } from '@/hooks/useAuth';

// ============================================
// TIPOS
// ============================================

interface ListaPrecio {
  id: string;
  nombre: string;
  descripcion?: string;
  moneda: string;
  descuento_global_pct: number;
  activa: boolean;
  created_at: string;
}

interface DescuentoVolumen {
  id: string;
  nombre: string;
  producto_codigo?: string;
  categoria?: string;
  min_cantidad: number;
  max_cantidad?: number;
  descuento_pct: number;
  activa: boolean;
}

interface CondicionCliente {
  id: string;
  nombre: string;
  limite_credito: number;
  saldo_pendiente: number;
  dias_pago: number;
  lista_precio_id?: string;
  lista_precio?: string;
  bloqueado: boolean;
  codigo: string;
}

type SeccionActiva = 'listas' | 'descuentos' | 'credito';

// ============================================
// TOAST HOOK
// ============================================

function useToast() {
  const [toasts, setToasts] = useState<Array<{ id: string; type: string; title: string }>>([]);
  const add = (type: string, title: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, title }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  };
  const Toast = () => toasts.length > 0 ? (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map(t => (
        <div key={t.id} className={cn(
          'px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3',
          t.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' :
          t.type === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-400' :
          'bg-amber-500/20 border-amber-500/30 text-amber-400'
        )}>
          {t.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          <span className="text-sm font-medium">{t.title}</span>
        </div>
      ))}
    </div>
  ) : null;
  return { success: (t: string) => add('success', t), error: (t: string) => add('error', t), warning: (t: string) => add('warning', t), Toast };
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function CondicionesComerciales() {
  const { user } = useAuth(false);
  const toast = useToast();
  const [seccion, setSeccion] = useState<SeccionActiva>('listas');
  const [loading, setLoading] = useState(true);

  // Listas de precios
  const [listas, setListas] = useState<ListaPrecio[]>([]);
  const [showListaForm, setShowListaForm] = useState(false);
  const [editLista, setEditLista] = useState<ListaPrecio | null>(null);
  const [listaForm, setListaForm] = useState({ nombre: '', descripcion: '', moneda: 'UYU', descuento_global_pct: '0' });

  // Descuentos por volumen
  const [descuentos, setDescuentos] = useState<DescuentoVolumen[]>([]);
  const [showDescForm, setShowDescForm] = useState(false);
  const [editDesc, setEditDesc] = useState<DescuentoVolumen | null>(null);
  const [descForm, setDescForm] = useState({ nombre: '', producto_codigo: '', categoria: '', min_cantidad: '1', max_cantidad: '', descuento_pct: '5' });

  // Condiciones de crédito por cliente
  const [condiciones, setCondiciones] = useState<CondicionCliente[]>([]);
  const [editCondicion, setEditCondicion] = useState<string | null>(null);
  const [condicionForm, setCondicionForm] = useState<Record<string, { limite_credito: string; dias_pago: string; lista_precio_id: string }>>({});

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadListas(), loadDescuentos(), loadCondiciones()]);
    setLoading(false);
  };

  const loadListas = async () => {
    const { data } = await supabase.from('listas_precios').select('*').order('created_at', { ascending: false });
    setListas(data || []);
  };

  const loadDescuentos = async () => {
    const { data } = await supabase.from('descuentos_volumen').select('*').order('min_cantidad', { ascending: true });
    setDescuentos(data || []);
  };

  const loadCondiciones = async () => {
    const { data } = await supabase
      .from('clientes')
      .select('id, codigo, nombre, limite_credito, saldo_pendiente, dias_pago, lista_precio_id, bloqueado, listas_precios(nombre)')
      .order('nombre', { ascending: true });

    const mapped: CondicionCliente[] = (data || []).map((c: any) => ({
      id: c.id,
      codigo: c.codigo,
      nombre: c.nombre,
      limite_credito: parseFloat(c.limite_credito || 0),
      saldo_pendiente: parseFloat(c.saldo_pendiente || 0),
      dias_pago: c.dias_pago || 30,
      lista_precio_id: c.lista_precio_id,
      lista_precio: c.listas_precios?.nombre,
      bloqueado: c.bloqueado || false,
    }));
    setCondiciones(mapped);
  };

  // ---- LISTAS DE PRECIOS ----

  const saveLista = async () => {
    if (!listaForm.nombre.trim()) return;
    try {
      const payload = {
        nombre: listaForm.nombre.trim(),
        descripcion: listaForm.descripcion.trim() || null,
        moneda: listaForm.moneda,
        descuento_global_pct: parseFloat(listaForm.descuento_global_pct) || 0,
        activa: true,
      };

      if (editLista) {
        const { error } = await supabase.from('listas_precios').update(payload).eq('id', editLista.id);
        if (error) throw error;
        await registrarAuditoria('listas_precios', 'ACTUALIZAR', editLista.id, editLista, payload, user?.email || '');
        toast.success('Lista de precios actualizada');
      } else {
        const { data, error } = await supabase.from('listas_precios').insert(payload).select().single();
        if (error) throw error;
        await registrarAuditoria('listas_precios', 'CREAR', data.id, null, payload, user?.email || '');
        toast.success('Lista de precios creada');
      }

      setShowListaForm(false);
      setEditLista(null);
      setListaForm({ nombre: '', descripcion: '', moneda: 'UYU', descuento_global_pct: '0' });
      loadListas();
    } catch {
      toast.error('Error al guardar lista de precios');
    }
  };

  const toggleLista = async (lista: ListaPrecio) => {
    const { error } = await supabase.from('listas_precios').update({ activa: !lista.activa }).eq('id', lista.id);
    if (!error) {
      await registrarAuditoria('listas_precios', lista.activa ? 'DESACTIVAR' : 'ACTIVAR', lista.id, lista, { activa: !lista.activa }, user?.email || '');
      loadListas();
    }
  };

  const eliminarLista = async (lista: ListaPrecio) => {
    if (!confirm(`¿Eliminar la lista "${lista.nombre}"?`)) return;
    const { error } = await supabase.from('listas_precios').delete().eq('id', lista.id);
    if (!error) {
      await registrarAuditoria('listas_precios', 'ELIMINAR', lista.id, lista, null, user?.email || '');
      toast.success('Lista eliminada');
      loadListas();
    }
  };

  // ---- DESCUENTOS POR VOLUMEN ----

  const saveDescuento = async () => {
    if (!descForm.nombre.trim() || !descForm.min_cantidad) return;
    try {
      const payload = {
        nombre: descForm.nombre.trim(),
        producto_codigo: descForm.producto_codigo.trim() || null,
        categoria: descForm.categoria.trim() || null,
        min_cantidad: parseInt(descForm.min_cantidad),
        max_cantidad: descForm.max_cantidad ? parseInt(descForm.max_cantidad) : null,
        descuento_pct: parseFloat(descForm.descuento_pct),
        activa: true,
      };

      if (editDesc) {
        const { error } = await supabase.from('descuentos_volumen').update(payload).eq('id', editDesc.id);
        if (error) throw error;
        await registrarAuditoria('descuentos_volumen', 'ACTUALIZAR', editDesc.id, editDesc, payload, user?.email || '');
        toast.success('Regla actualizada');
      } else {
        const { data, error } = await supabase.from('descuentos_volumen').insert(payload).select().single();
        if (error) throw error;
        await registrarAuditoria('descuentos_volumen', 'CREAR', data.id, null, payload, user?.email || '');
        toast.success('Regla de descuento creada');
      }

      setShowDescForm(false);
      setEditDesc(null);
      setDescForm({ nombre: '', producto_codigo: '', categoria: '', min_cantidad: '1', max_cantidad: '', descuento_pct: '5' });
      loadDescuentos();
    } catch {
      toast.error('Error al guardar regla de descuento');
    }
  };

  const eliminarDescuento = async (d: DescuentoVolumen) => {
    if (!confirm(`¿Eliminar la regla "${d.nombre}"?`)) return;
    await supabase.from('descuentos_volumen').delete().eq('id', d.id);
    await registrarAuditoria('descuentos_volumen', 'ELIMINAR', d.id, d, null, user?.email || '');
    toast.success('Regla eliminada');
    loadDescuentos();
  };

  // ---- CONDICIONES DE CRÉDITO ----

  const saveCondicion = async (clienteId: string) => {
    const form = condicionForm[clienteId];
    if (!form) return;
    const cliente = condiciones.find(c => c.id === clienteId);
    const payload = {
      limite_credito: parseFloat(form.limite_credito) || 0,
      dias_pago: parseInt(form.dias_pago) || 30,
      lista_precio_id: form.lista_precio_id || null,
    };
    const { error } = await supabase.from('clientes').update(payload).eq('id', clienteId);
    if (!error) {
      await registrarAuditoria('clientes', 'ACTUALIZAR_CONDICIONES', clienteId, cliente, payload, user?.email || '');
      toast.success('Condiciones actualizadas');
      setEditCondicion(null);
      loadCondiciones();
    } else {
      toast.error('Error al guardar condiciones');
    }
  };

  const toggleBloqueo = async (c: CondicionCliente) => {
    const { error } = await supabase.from('clientes').update({ bloqueado: !c.bloqueado }).eq('id', c.id);
    if (!error) {
      await registrarAuditoria('clientes', c.bloqueado ? 'DESBLOQUEAR' : 'BLOQUEAR', c.id, c, { bloqueado: !c.bloqueado }, user?.email || '');
      toast.success(c.bloqueado ? 'Cliente desbloqueado' : 'Cliente bloqueado');
      loadCondiciones();
    }
  };

  // ============================================
  // RENDER
  // ============================================

  const secciones: { id: SeccionActiva; label: string; icon: React.ElementType }[] = [
    { id: 'listas', label: 'Listas de Precios', icon: Tag },
    { id: 'descuentos', label: 'Descuentos por Volumen', icon: Percent },
    { id: 'credito', label: 'Control de Crédito', icon: Shield },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Tag className="h-6 w-6 text-violet-400" />
            Condiciones Comerciales
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">Listas de precios, descuentos por volumen y control de crédito</p>
        </div>
        <button onClick={loadAll} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Navegación de sección */}
      <div className="flex items-center gap-1 p-1 bg-slate-900/50 rounded-xl border border-slate-800/50">
        {secciones.map(s => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => setSeccion(s.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                seccion === s.id ? 'bg-violet-500/15 text-violet-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              )}
            >
              <Icon size={15} />
              {s.label}
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="flex items-center justify-center p-12">
          <RefreshCw className="h-6 w-6 animate-spin text-violet-400" />
        </div>
      )}

      {/* ============ LISTAS DE PRECIOS ============ */}
      {!loading && seccion === 'listas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">Define listas con descuento global. Asígnalas a clientes específicos.</p>
            <button
              onClick={() => { setShowListaForm(true); setEditLista(null); setListaForm({ nombre: '', descripcion: '', moneda: 'UYU', descuento_global_pct: '0' }); }}
              className="flex items-center gap-2 px-3 py-2 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 rounded-xl text-sm font-medium transition-colors"
            >
              <Plus className="h-4 w-4" /> Nueva Lista
            </button>
          </div>

          {/* Formulario */}
          {showListaForm && (
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-5">
              <h3 className="font-semibold text-slate-200 mb-4">{editLista ? 'Editar Lista' : 'Nueva Lista de Precios'}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nombre *</label>
                  <input value={listaForm.nombre} onChange={e => setListaForm(p => ({ ...p, nombre: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-violet-500"
                    placeholder="Ej: Lista Mayorista" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Moneda</label>
                  <select value={listaForm.moneda} onChange={e => setListaForm(p => ({ ...p, moneda: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-violet-500">
                    <option value="UYU">UYU — Peso Uruguayo</option>
                    <option value="USD">USD — Dólar</option>
                    <option value="EUR">EUR — Euro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Descuento Global (%)</label>
                  <input type="number" step="0.1" min="0" max="100" value={listaForm.descuento_global_pct}
                    onChange={e => setListaForm(p => ({ ...p, descuento_global_pct: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-violet-500"
                    placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Descripción</label>
                  <input value={listaForm.descripcion} onChange={e => setListaForm(p => ({ ...p, descripcion: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-violet-500"
                    placeholder="Opcional" />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={saveLista} className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-400 text-white rounded-lg text-sm font-medium transition-colors">
                  <Save className="h-4 w-4" /> Guardar
                </button>
                <button onClick={() => { setShowListaForm(false); setEditLista(null); }} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors">
                  <X className="h-4 w-4" /> Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Tabla de listas */}
          {listas.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-12 text-center">
              <Tag className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">No hay listas de precios</p>
              <p className="text-slate-500 text-sm mt-1">Crea tu primera lista para asignar a clientes</p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-800">
                  <tr className="text-left text-xs text-slate-500">
                    <th className="px-4 py-3 font-medium">Nombre</th>
                    <th className="px-4 py-3 font-medium">Moneda</th>
                    <th className="px-4 py-3 font-medium">Descuento Global</th>
                    <th className="px-4 py-3 font-medium">Descripción</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {listas.map(lista => (
                    <tr key={lista.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-200">{lista.nombre}</td>
                      <td className="px-4 py-3 text-slate-400">{lista.moneda}</td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-1 rounded text-xs font-medium', lista.descuento_global_pct > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400')}>
                          {lista.descuento_global_pct}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 truncate max-w-[200px]">{lista.descripcion || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-1 rounded text-xs font-medium', lista.activa ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-500')}>
                          {lista.activa ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => { setEditLista(lista); setShowListaForm(true); setListaForm({ nombre: lista.nombre, descripcion: lista.descripcion || '', moneda: lista.moneda, descuento_global_pct: String(lista.descuento_global_pct) }); }}
                            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"><Edit className="h-4 w-4" /></button>
                          <button onClick={() => toggleLista(lista)}
                            className={cn('p-1.5 rounded-lg transition-colors', lista.activa ? 'hover:bg-amber-500/20 text-amber-400' : 'hover:bg-emerald-500/20 text-emerald-400')}>
                            {lista.activa ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                          </button>
                          <button onClick={() => eliminarLista(lista)}
                            className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============ DESCUENTOS POR VOLUMEN ============ */}
      {!loading && seccion === 'descuentos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">Define rangos de cantidad con descuento automático por volumen.</p>
            <button
              onClick={() => { setShowDescForm(true); setEditDesc(null); setDescForm({ nombre: '', producto_codigo: '', categoria: '', min_cantidad: '1', max_cantidad: '', descuento_pct: '5' }); }}
              className="flex items-center gap-2 px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-xl text-sm font-medium transition-colors"
            >
              <Plus className="h-4 w-4" /> Nueva Regla
            </button>
          </div>

          {showDescForm && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
              <h3 className="font-semibold text-slate-200 mb-4">{editDesc ? 'Editar Regla' : 'Nueva Regla de Descuento'}</h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nombre de la Regla *</label>
                  <input value={descForm.nombre} onChange={e => setDescForm(p => ({ ...p, nombre: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                    placeholder="Ej: Descuento mayorista" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Código Producto (o vacío = todos)</label>
                  <input value={descForm.producto_codigo} onChange={e => setDescForm(p => ({ ...p, producto_codigo: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                    placeholder="ACE-001 (opcional)" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Categoría (o vacío = todas)</label>
                  <input value={descForm.categoria} onChange={e => setDescForm(p => ({ ...p, categoria: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                    placeholder="Electrónica (opcional)" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Cantidad Mínima *</label>
                  <input type="number" min="1" value={descForm.min_cantidad} onChange={e => setDescForm(p => ({ ...p, min_cantidad: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Cantidad Máxima (vacío = sin límite)</label>
                  <input type="number" min="1" value={descForm.max_cantidad} onChange={e => setDescForm(p => ({ ...p, max_cantidad: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                    placeholder="∞" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Descuento % *</label>
                  <input type="number" step="0.1" min="0" max="100" value={descForm.descuento_pct} onChange={e => setDescForm(p => ({ ...p, descuento_pct: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500" />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={saveDescuento} className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-lg text-sm font-medium transition-colors">
                  <Save className="h-4 w-4" /> Guardar
                </button>
                <button onClick={() => { setShowDescForm(false); setEditDesc(null); }} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors">
                  <X className="h-4 w-4" /> Cancelar
                </button>
              </div>
            </div>
          )}

          {descuentos.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-12 text-center">
              <Percent className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">No hay reglas de descuento</p>
              <p className="text-slate-500 text-sm mt-1">Crea reglas para aplicar descuentos automáticos por cantidad</p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-800">
                  <tr className="text-left text-xs text-slate-500">
                    <th className="px-4 py-3 font-medium">Nombre</th>
                    <th className="px-4 py-3 font-medium">Aplica a</th>
                    <th className="px-4 py-3 font-medium">Rango Cantidad</th>
                    <th className="px-4 py-3 font-medium">Descuento</th>
                    <th className="px-4 py-3 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {descuentos.map(d => (
                    <tr key={d.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-200">{d.nombre}</td>
                      <td className="px-4 py-3 text-slate-400">
                        {d.producto_codigo ? <span className="font-mono text-xs bg-slate-800 px-1.5 py-0.5 rounded">{d.producto_codigo}</span>
                          : d.categoria ? d.categoria
                          : <span className="text-slate-500 italic">Todos los productos</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {d.min_cantidad} — {d.max_cantidad ? d.max_cantidad : '∞'} uds.
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded text-xs font-bold bg-amber-500/20 text-amber-400">{d.descuento_pct}%</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => { setEditDesc(d); setShowDescForm(true); setDescForm({ nombre: d.nombre, producto_codigo: d.producto_codigo || '', categoria: d.categoria || '', min_cantidad: String(d.min_cantidad), max_cantidad: d.max_cantidad ? String(d.max_cantidad) : '', descuento_pct: String(d.descuento_pct) }); }}
                            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"><Edit className="h-4 w-4" /></button>
                          <button onClick={() => eliminarDescuento(d)}
                            className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============ CONTROL DE CRÉDITO ============ */}
      {!loading && seccion === 'credito' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">Gestiona límites de crédito, plazos de pago y bloqueo por cliente.</p>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span> Bloqueado</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span> &gt;80% límite</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span> OK</span>
            </div>
          </div>

          {condiciones.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-12 text-center">
              <Users className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">No hay clientes</p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-800">
                  <tr className="text-left text-xs text-slate-500">
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Saldo Pend.</th>
                    <th className="px-4 py-3 font-medium">Límite Crédito</th>
                    <th className="px-4 py-3 font-medium">Uso</th>
                    <th className="px-4 py-3 font-medium">Días Pago</th>
                    <th className="px-4 py-3 font-medium">Lista Precio</th>
                    <th className="px-4 py-3 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {condiciones.map(c => {
                    const usoPct = c.limite_credito > 0 ? (c.saldo_pendiente / c.limite_credito) * 100 : 0;
                    const isEdit = editCondicion === c.id;
                    const form = condicionForm[c.id] || { limite_credito: String(c.limite_credito), dias_pago: String(c.dias_pago), lista_precio_id: c.lista_precio_id || '' };

                    return (
                      <React.Fragment key={c.id}>
                        <tr className={cn('transition-colors', c.bloqueado ? 'bg-red-500/5' : 'hover:bg-slate-800/30')}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {c.bloqueado && <Shield className="h-3 w-3 text-red-400 flex-shrink-0" />}
                              <div>
                                <div className="font-medium text-slate-200 text-xs">{c.nombre}</div>
                                <div className="text-xs text-slate-500 font-mono">{c.codigo}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-amber-400 font-medium">{formatCurrency(c.saldo_pendiente)}</td>
                          <td className="px-4 py-3 text-slate-300">{formatCurrency(c.limite_credito)}</td>
                          <td className="px-4 py-3">
                            {c.limite_credito > 0 ? (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-slate-800 rounded-full h-1.5 w-20">
                                  <div className={cn('h-1.5 rounded-full transition-all', usoPct >= 100 ? 'bg-red-500' : usoPct >= 80 ? 'bg-amber-500' : 'bg-emerald-500')}
                                    style={{ width: `${Math.min(100, usoPct)}%` }} />
                                </div>
                                <span className={cn('text-xs font-medium', usoPct >= 100 ? 'text-red-400' : usoPct >= 80 ? 'text-amber-400' : 'text-slate-400')}>
                                  {usoPct.toFixed(0)}%
                                </span>
                              </div>
                            ) : <span className="text-slate-600 text-xs">Sin límite</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-400">{c.dias_pago}d</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{c.lista_precio || '—'}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                onClick={() => {
                                  setEditCondicion(isEdit ? null : c.id);
                                  if (!isEdit) setCondicionForm(prev => ({ ...prev, [c.id]: form }));
                                }}
                                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button onClick={() => toggleBloqueo(c)}
                                className={cn('p-1.5 rounded-lg transition-colors', c.bloqueado ? 'hover:bg-emerald-500/20 text-emerald-400' : 'hover:bg-red-500/20 text-red-400')}>
                                <Shield className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isEdit && (
                          <tr className="bg-violet-500/5">
                            <td colSpan={7} className="px-4 py-3">
                              <div className="flex items-center gap-4 flex-wrap">
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Límite de Crédito</label>
                                  <input type="number" step="100" min="0" value={form.limite_credito}
                                    onChange={e => setCondicionForm(prev => ({ ...prev, [c.id]: { ...prev[c.id], limite_credito: e.target.value } }))}
                                    className="w-36 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-violet-500" />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Días de Pago</label>
                                  <select value={form.dias_pago}
                                    onChange={e => setCondicionForm(prev => ({ ...prev, [c.id]: { ...prev[c.id], dias_pago: e.target.value } }))}
                                    className="w-28 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-violet-500">
                                    <option value="0">Contado</option>
                                    <option value="15">15 días</option>
                                    <option value="30">30 días</option>
                                    <option value="45">45 días</option>
                                    <option value="60">60 días</option>
                                    <option value="90">90 días</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Lista de Precios</label>
                                  <select value={form.lista_precio_id}
                                    onChange={e => setCondicionForm(prev => ({ ...prev, [c.id]: { ...prev[c.id], lista_precio_id: e.target.value } }))}
                                    className="w-44 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-violet-500">
                                    <option value="">Sin lista especial</option>
                                    {listas.filter(l => l.activa).map(l => (
                                      <option key={l.id} value={l.id}>{l.nombre}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="flex items-end gap-2">
                                  <button onClick={() => saveCondicion(c.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500 hover:bg-violet-400 text-white rounded-lg text-sm font-medium transition-colors">
                                    <Save className="h-3.5 w-3.5" /> Guardar
                                  </button>
                                  <button onClick={() => setEditCondicion(null)}
                                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors">
                                    Cancelar
                                  </button>
                                </div>
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
          )}
        </div>
      )}

      <toast.Toast />
    </div>
  );
}
