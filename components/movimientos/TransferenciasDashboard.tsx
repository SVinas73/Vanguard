'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Product, Almacen, Transferencia, TransferenciaItem, TransferenciaEstado } from '@/types';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  ArrowLeftRight, Plus, Search, Package, Warehouse,
  ChevronRight, Clock, CheckCircle2, XCircle, Truck,
  Loader2, X, ChevronLeft, Filter, FileText,
} from 'lucide-react';

interface TransferenciasDashboardProps {
  products: Product[];
  userEmail: string;
  onRefreshProducts: () => void;
}

interface TransferenciaRow {
  id: string;
  numero: string;
  almacen_origen_id: string;
  almacen_destino_id: string;
  estado: TransferenciaEstado;
  fecha_solicitud: string;
  fecha_envio: string | null;
  fecha_recepcion: string | null;
  notas: string | null;
  creado_por: string;
  origen?: { nombre: string; codigo: string };
  destino?: { nombre: string; codigo: string };
  items?: TransferenciaItemRow[];
}

interface TransferenciaItemRow {
  id: string;
  transferencia_id: string;
  producto_codigo: string;
  cantidad_solicitada: number;
  cantidad_enviada: number;
  cantidad_recibida: number;
}

const ESTADO_CONFIG: Record<TransferenciaEstado, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pendiente: { label: 'Pendiente', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', icon: <Clock size={14} /> },
  en_transito: { label: 'En Tránsito', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', icon: <Truck size={14} /> },
  completada: { label: 'Completada', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: <CheckCircle2 size={14} /> },
  cancelada: { label: 'Cancelada', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20', icon: <XCircle size={14} /> },
};

export function TransferenciasDashboard({ products, userEmail, onRefreshProducts }: TransferenciasDashboardProps) {
  const [transferencias, setTransferencias] = useState<TransferenciaRow[]>([]);
  const [almacenes, setAlmacenes] = useState<{ id: string; nombre: string; codigo: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [selectedTransferencia, setSelectedTransferencia] = useState<TransferenciaRow | null>(null);
  const [filterEstado, setFilterEstado] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // New transfer form
  const [form, setForm] = useState({
    almacenOrigenId: '',
    almacenDestinoId: '',
    notas: '',
    items: [] as { codigo: string; cantidad: number }[],
  });
  const [itemSearch, setItemSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [transferRes, almacenRes] = await Promise.all([
      supabase
        .from('transferencias')
        .select('*, origen:almacenes!transferencias_almacen_origen_id_fkey(nombre, codigo), destino:almacenes!transferencias_almacen_destino_id_fkey(nombre, codigo)')
        .order('fecha_solicitud', { ascending: false })
        .limit(100),
      supabase.from('almacenes').select('id, nombre, codigo').eq('activo', true).order('es_principal', { ascending: false }),
    ]);

    if (transferRes.data) {
      setTransferencias(transferRes.data as TransferenciaRow[]);
    }
    if (almacenRes.data) {
      setAlmacenes(almacenRes.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredTransferencias = useMemo(() => {
    let result = transferencias;
    if (filterEstado !== 'all') {
      result = result.filter(t => t.estado === filterEstado);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.numero.toLowerCase().includes(q) ||
        t.origen?.nombre?.toLowerCase().includes(q) ||
        t.destino?.nombre?.toLowerCase().includes(q) ||
        t.creado_por?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [transferencias, filterEstado, searchQuery]);

  const stats = useMemo(() => ({
    total: transferencias.length,
    pendientes: transferencias.filter(t => t.estado === 'pendiente').length,
    enTransito: transferencias.filter(t => t.estado === 'en_transito').length,
    completadas: transferencias.filter(t => t.estado === 'completada').length,
  }), [transferencias]);

  // Products available from origin warehouse
  const originProducts = useMemo(() => {
    if (!form.almacenOrigenId) return [];
    return products
      .filter(p => p.almacenId === form.almacenOrigenId && p.stock > 0)
      .filter(p => {
        if (!itemSearch.trim()) return true;
        const q = itemSearch.toLowerCase();
        return p.codigo.toLowerCase().includes(q) || p.descripcion.toLowerCase().includes(q);
      });
  }, [products, form.almacenOrigenId, itemSearch]);

  const addItem = (product: Product) => {
    if (form.items.some(i => i.codigo === product.codigo)) return;
    setForm({ ...form, items: [...form.items, { codigo: product.codigo, cantidad: 1 }] });
    setItemSearch('');
  };

  const updateItemQty = (codigo: string, qty: number) => {
    const product = products.find(p => p.codigo === codigo);
    const max = product?.stock || 1;
    setForm({
      ...form,
      items: form.items.map(i => i.codigo === codigo ? { ...i, cantidad: Math.max(1, Math.min(max, qty)) } : i),
    });
  };

  const removeItem = (codigo: string) => {
    setForm({ ...form, items: form.items.filter(i => i.codigo !== codigo) });
  };

  const handleCreateTransferencia = async () => {
    if (!form.almacenOrigenId || !form.almacenDestinoId || form.items.length === 0) return;
    if (form.almacenOrigenId === form.almacenDestinoId) return;
    setSubmitting(true);

    try {
      const numero = `TRF-${Date.now().toString(36).toUpperCase()}`;

      const { data: transferencia, error } = await supabase
        .from('transferencias')
        .insert({
          numero,
          almacen_origen_id: form.almacenOrigenId,
          almacen_destino_id: form.almacenDestinoId,
          estado: 'pendiente',
          fecha_solicitud: new Date().toISOString(),
          notas: form.notas || null,
          creado_por: userEmail,
        })
        .select('id')
        .single();

      if (error || !transferencia) throw error;

      const itemsToInsert = form.items.map(item => ({
        transferencia_id: transferencia.id,
        producto_codigo: item.codigo,
        cantidad_solicitada: item.cantidad,
        cantidad_enviada: 0,
        cantidad_recibida: 0,
      }));

      await supabase.from('transferencia_items').insert(itemsToInsert);

      await supabase.from('auditoria').insert({
        tabla: 'transferencias',
        accion: 'CREAR',
        codigo: numero,
        datos_anteriores: null,
        datos_nuevos: { origen: form.almacenOrigenId, destino: form.almacenDestinoId, items: form.items },
        usuario_email: userEmail,
      });

      setShowNew(false);
      setForm({ almacenOrigenId: '', almacenDestinoId: '', notas: '', items: [] });
      fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateEstado = async (transferencia: TransferenciaRow, nuevoEstado: TransferenciaEstado) => {
    const updates: Record<string, any> = { estado: nuevoEstado };

    if (nuevoEstado === 'en_transito') {
      updates.fecha_envio = new Date().toISOString();
    }

    if (nuevoEstado === 'completada') {
      updates.fecha_recepcion = new Date().toISOString();

      // Fetch items for this transfer
      const { data: items } = await supabase
        .from('transferencia_items')
        .select('*')
        .eq('transferencia_id', transferencia.id);

      if (items && items.length > 0) {
        for (const item of items) {
          const qty = item.cantidad_solicitada;

          // Deduct from origin
          const { data: originProd } = await supabase
            .from('productos')
            .select('stock')
            .eq('codigo', item.producto_codigo)
            .eq('almacen_id', transferencia.almacen_origen_id)
            .single();

          if (originProd) {
            await supabase
              .from('productos')
              .update({ stock: Math.max(0, originProd.stock - qty) })
              .eq('codigo', item.producto_codigo)
              .eq('almacen_id', transferencia.almacen_origen_id);
          }

          // Add to destination — check if product exists there
          const { data: destProd } = await supabase
            .from('productos')
            .select('stock')
            .eq('codigo', item.producto_codigo)
            .eq('almacen_id', transferencia.almacen_destino_id)
            .single();

          if (destProd) {
            await supabase
              .from('productos')
              .update({ stock: destProd.stock + qty })
              .eq('codigo', item.producto_codigo)
              .eq('almacen_id', transferencia.almacen_destino_id);
          }

          // Update item as sent and received
          await supabase
            .from('transferencia_items')
            .update({ cantidad_enviada: qty, cantidad_recibida: qty })
            .eq('id', item.id);
        }
      }

      onRefreshProducts();
    }

    await supabase.from('transferencias').update(updates).eq('id', transferencia.id);

    await supabase.from('auditoria').insert({
      tabla: 'transferencias',
      accion: `ESTADO_${nuevoEstado.toUpperCase()}`,
      codigo: transferencia.numero,
      datos_anteriores: { estado: transferencia.estado },
      datos_nuevos: { estado: nuevoEstado },
      usuario_email: userEmail,
    });

    fetchData();
    setSelectedTransferencia(null);
  };

  // ========== DETAIL VIEW ==========
  if (selectedTransferencia) {
    const t = selectedTransferencia;
    const cfg = ESTADO_CONFIG[t.estado];
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setSelectedTransferencia(null)} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-bold">Transferencia {t.numero}</h2>
            <p className="text-sm text-slate-500">Creada por {t.creado_por} · {formatDate(new Date(t.fecha_solicitud))}</p>
          </div>
          <div className={cn('ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium', cfg.bg, cfg.color)}>
            {cfg.icon} {cfg.label}
          </div>
        </div>

        {/* Route */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="flex-1 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Origen</div>
              <div className="flex items-center gap-2">
                <Warehouse size={16} className="text-amber-400" />
                <span className="font-semibold text-slate-200">{t.origen?.nombre || 'N/A'}</span>
              </div>
            </div>
            <ArrowLeftRight size={20} className="text-slate-600 flex-shrink-0" />
            <div className="flex-1 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Destino</div>
              <div className="flex items-center gap-2">
                <Warehouse size={16} className="text-blue-400" />
                <span className="font-semibold text-slate-200">{t.destino?.nombre || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Línea de tiempo</h3>
          <div className="space-y-3">
            <TimelineStep done label="Solicitud creada" date={t.fecha_solicitud} user={t.creado_por} />
            <TimelineStep done={!!t.fecha_envio || t.estado === 'completada'} label="Enviada" date={t.fecha_envio} />
            <TimelineStep done={t.estado === 'completada'} label="Recibida" date={t.fecha_recepcion} />
          </div>
        </div>

        {t.notas && (
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Notas</h3>
            <p className="text-sm text-slate-400">{t.notas}</p>
          </div>
        )}

        {/* Items (loaded dynamically) */}
        <TransferenciaItemsList transferenciaId={t.id} products={products} />

        {/* Actions */}
        {t.estado !== 'completada' && t.estado !== 'cancelada' && (
          <div className="flex gap-3">
            {t.estado === 'pendiente' && (
              <>
                <button
                  onClick={() => handleUpdateEstado(t, 'en_transito')}
                  className="flex-1 py-3 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <Truck size={16} /> Marcar como Enviada
                </button>
                <button
                  onClick={() => handleUpdateEstado(t, 'cancelada')}
                  className="py-3 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
              </>
            )}
            {t.estado === 'en_transito' && (
              <button
                onClick={() => handleUpdateEstado(t, 'completada')}
                className="flex-1 py-3 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <CheckCircle2 size={16} /> Confirmar Recepción
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ========== NEW TRANSFER FORM ==========
  if (showNew) {
    const formValid = form.almacenOrigenId && form.almacenDestinoId && form.almacenOrigenId !== form.almacenDestinoId && form.items.length > 0;
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setShowNew(false)} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-bold">Nueva Transferencia</h2>
            <p className="text-sm text-slate-500">Mover productos entre almacenes</p>
          </div>
        </div>

        {/* Warehouses */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-400 mb-2 block">Almacén Origen</label>
            <select
              value={form.almacenOrigenId}
              onChange={(e) => setForm({ ...form, almacenOrigenId: e.target.value, items: [] })}
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-slate-600"
            >
              <option value="">Seleccionar...</option>
              {almacenes.filter(a => a.id !== form.almacenDestinoId).map(a => (
                <option key={a.id} value={a.id}>{a.nombre} ({a.codigo})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 mb-2 block">Almacén Destino</label>
            <select
              value={form.almacenDestinoId}
              onChange={(e) => setForm({ ...form, almacenDestinoId: e.target.value })}
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-slate-600"
            >
              <option value="">Seleccionar...</option>
              {almacenes.filter(a => a.id !== form.almacenOrigenId).map(a => (
                <option key={a.id} value={a.id}>{a.nombre} ({a.codigo})</option>
              ))}
            </select>
          </div>
        </div>

        {form.almacenOrigenId === form.almacenDestinoId && form.almacenOrigenId && (
          <div className="text-xs text-red-400">Origen y destino no pueden ser el mismo almacén</div>
        )}

        {/* Product search */}
        {form.almacenOrigenId && (
          <div>
            <label className="text-xs font-medium text-slate-400 mb-2 block">Agregar productos</label>
            <div className="relative">
              <input
                type="text"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Buscar por código o descripción..."
                className="w-full px-3 py-2.5 pl-9 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-600"
              />
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            </div>
            {itemSearch.trim() && originProducts.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 divide-y divide-slate-800/50">
                {originProducts.slice(0, 10).map(p => (
                  <button
                    key={p.codigo}
                    onClick={() => addItem(p)}
                    disabled={form.items.some(i => i.codigo === p.codigo)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-800/50 transition-colors disabled:opacity-30"
                  >
                    <span>
                      <span className="font-mono text-slate-400 text-xs mr-2">{p.codigo}</span>
                      <span className="text-slate-200">{p.descripcion}</span>
                    </span>
                    <span className="text-xs text-slate-500">Stock: {p.stock}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Selected items */}
        {form.items.length > 0 && (
          <div className="rounded-xl border border-slate-800 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-900/80">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-400 uppercase">Producto</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-400 uppercase w-28">Cantidad</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-400 uppercase w-20">Stock</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {form.items.map(item => {
                  const p = products.find(pr => pr.codigo === item.codigo);
                  return (
                    <tr key={item.codigo}>
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs text-slate-400 mr-2">{item.codigo}</span>
                        <span className="text-sm text-slate-200">{p?.descripcion || item.codigo}</span>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={item.cantidad}
                          onChange={(e) => updateItemQty(item.codigo, parseInt(e.target.value) || 1)}
                          min={1}
                          max={p?.stock || 1}
                          className="w-full text-center py-1 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-slate-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </td>
                      <td className="px-3 py-2 text-center text-xs text-slate-500">{p?.stock || 0}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => removeItem(item.codigo)} className="p-1 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors">
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="text-xs font-medium text-slate-400 mb-2 block">Notas (opcional)</label>
          <textarea
            value={form.notas}
            onChange={(e) => setForm({ ...form, notas: e.target.value })}
            placeholder="Motivo de la transferencia, instrucciones especiales..."
            rows={2}
            className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-600 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => setShowNew(false)}
            className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-300 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreateTransferencia}
            disabled={!formValid || submitting}
            className="flex-1 py-3 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowLeftRight size={16} />}
            Crear Transferencia
          </button>
        </div>
      </div>
    );
  }

  // ========== MAIN LIST VIEW ==========
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-slate-800">
            <ArrowLeftRight size={24} className="text-slate-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Transferencias entre Almacenes</h2>
            <p className="text-sm text-slate-500">Gestión de movimientos entre ubicaciones</p>
          </div>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Nueva Transferencia
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-white', bg: 'bg-slate-900 border-slate-800' },
          { label: 'Pendientes', value: stats.pendientes, color: 'text-amber-400', bg: 'bg-amber-500/5 border-amber-500/20' },
          { label: 'En Tránsito', value: stats.enTransito, color: 'text-blue-400', bg: 'bg-blue-500/5 border-blue-500/20' },
          { label: 'Completadas', value: stats.completadas, color: 'text-emerald-400', bg: 'bg-emerald-500/5 border-emerald-500/20' },
        ].map(s => (
          <div key={s.label} className={cn('p-4 rounded-xl border text-center', s.bg)}>
            <div className={cn('text-2xl font-bold', s.color)}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por número, almacén o usuario..."
            className="w-full px-4 py-2.5 pl-10 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-600"
          />
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800">
          {['all', 'pendiente', 'en_transito', 'completada'].map(f => (
            <button
              key={f}
              onClick={() => setFilterEstado(f)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                filterEstado === f ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              {f === 'all' ? 'Todas' : ESTADO_CONFIG[f as TransferenciaEstado]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-slate-600" />
        </div>
      ) : filteredTransferencias.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-dashed border-slate-800">
          <ArrowLeftRight size={32} className="mx-auto text-slate-700 mb-3" />
          <p className="text-slate-500 text-sm">
            {transferencias.length === 0 ? 'No hay transferencias registradas' : 'No se encontraron resultados'}
          </p>
          {transferencias.length === 0 && (
            <button onClick={() => setShowNew(true)} className="mt-3 text-blue-400 text-sm hover:underline">
              Crear primera transferencia
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTransferencias.map(t => {
            const cfg = ESTADO_CONFIG[t.estado];
            return (
              <button
                key={t.id}
                onClick={() => setSelectedTransferencia(t)}
                className="w-full p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all text-left group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-slate-800">
                      <ArrowLeftRight size={16} className="text-slate-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-sm font-semibold text-slate-200">{t.numero}</span>
                        <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-medium', cfg.bg, cfg.color)}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        <span className="text-amber-400">{t.origen?.nombre || '?'}</span>
                        <span className="mx-2">→</span>
                        <span className="text-blue-400">{t.destino?.nombre || '?'}</span>
                        <span className="mx-2">·</span>
                        <span>{formatDate(new Date(t.fecha_solicitud))}</span>
                        <span className="mx-2">·</span>
                        <span>{t.creado_por}</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ========== HELPER COMPONENTS ==========

function TimelineStep({ done, label, date, user }: { done: boolean; label: string; date?: string | null; user?: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className={cn('mt-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2', done ? 'bg-emerald-500/20 border-emerald-500' : 'border-slate-700')}>
        {done && <CheckCircle2 size={12} className="text-emerald-400" />}
      </div>
      <div>
        <div className={cn('text-sm font-medium', done ? 'text-slate-200' : 'text-slate-500')}>{label}</div>
        {date && <div className="text-xs text-slate-500">{formatDate(new Date(date))}{user ? ` · ${user}` : ''}</div>}
      </div>
    </div>
  );
}

function TransferenciaItemsList({ transferenciaId, products }: { transferenciaId: string; products: Product[] }) {
  const [items, setItems] = useState<TransferenciaItemRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('transferencia_items')
      .select('*')
      .eq('transferencia_id', transferenciaId)
      .then(({ data }) => {
        if (data) setItems(data as TransferenciaItemRow[]);
        setLoading(false);
      });
  }, [transferenciaId]);

  if (loading) return <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-slate-600" /></div>;
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-800 overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-900/80 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <Package size={14} /> Productos ({items.length})
        </h3>
      </div>
      <table className="w-full">
        <thead>
          <tr className="text-xs text-slate-500 uppercase">
            <th className="px-4 py-2 text-left">Producto</th>
            <th className="px-4 py-2 text-center">Solicitada</th>
            <th className="px-4 py-2 text-center">Enviada</th>
            <th className="px-4 py-2 text-center">Recibida</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {items.map(item => {
            const p = products.find(pr => pr.codigo === item.producto_codigo);
            return (
              <tr key={item.id}>
                <td className="px-4 py-2.5">
                  <span className="font-mono text-xs text-slate-400 mr-2">{item.producto_codigo}</span>
                  <span className="text-sm text-slate-200">{p?.descripcion || item.producto_codigo}</span>
                </td>
                <td className="px-4 py-2.5 text-center font-mono text-sm text-slate-300">{item.cantidad_solicitada}</td>
                <td className="px-4 py-2.5 text-center font-mono text-sm text-slate-300">{item.cantidad_enviada}</td>
                <td className="px-4 py-2.5 text-center font-mono text-sm text-slate-300">{item.cantidad_recibida}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
