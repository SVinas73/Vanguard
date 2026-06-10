'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X, Save, Loader2, AlertCircle, Pencil, Search, Package, PackagePlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PROVEEDORES_INSUMO, PROVEEDOR_OTRO, aprobadorRequerido } from '@/lib/insumos/proveedores';
import NuevoArticuloInsumoModal, { NuevoArticuloInsumoData } from './NuevoArticuloInsumoModal';

interface Product {
  codigo: string;
  descripcion: string;
  stock?: number;
  almacen_id?: string | null;
  costo_promedio?: number | null;
}

interface ItemEdit {
  id: number;
  producto_codigo: string;
  descripcion: string;
  stock_actual: number | null;
  costo_actual: number | null;
  costo_estimado: string;
  moneda: string;
  cantidad: string;
  unidad: string;
  observaciones: string;
  es_nuevo: boolean;
  nuevo_codigo: string;
  nuevo_stock_minimo: number | null;
  nuevo_categoria: string;
}

interface SolicitudEditable {
  id: string;
  numero: string;
  categoria: string;
  proveedor?: string | null;
  proveedor_nombre?: string | null;
  fecha_limite?: string | null;
  observaciones?: string | null;
  items: Array<{
    id: number;
    producto_codigo?: string | null;
    descripcion: string;
    cantidad: number;
    unidad?: string | null;
    observaciones?: string | null;
    costo_estimado?: number | null;
    es_nuevo?: boolean | null;
    nuevo_codigo?: string | null;
    nuevo_stock_minimo?: number | null;
    nuevo_categoria?: string | null;
  }>;
}

interface Props {
  solicitud: SolicitudEditable;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Edición de una solicitud ya creada (EXCLUSIVO de admins; el backend lo
 * revalida y solo permite estado 'pendiente').
 *
 * Cada item se maneja como en la creación: se elige un ARTÍCULO EXISTENTE
 * (cuya descripción queda BLOQUEADA — solo se cambia en Stock) o se crea/edita
 * un ARTÍCULO NUEVO (descripción, código, stock mínimo, categoría editables).
 */
export default function EditarSolicitudInsumoModal({ solicitud, onClose, onSaved }: Props) {
  const [proveedor, setProveedor] = useState(solicitud.proveedor || '');
  const [proveedorNombre, setProveedorNombre] = useState(solicitud.proveedor_nombre || '');
  const [fechaLimite, setFechaLimite] = useState(solicitud.fecha_limite || '');
  const [observaciones, setObservaciones] = useState(solicitud.observaciones || '');
  const [items, setItems] = useState<ItemEdit[]>(() =>
    solicitud.items.map(it => ({
      id: it.id,
      producto_codigo: it.producto_codigo || '',
      descripcion: it.descripcion,
      stock_actual: null,
      costo_actual: null,
      costo_estimado: it.costo_estimado != null ? String(it.costo_estimado) : '',
      moneda: (it as any).moneda || 'UYU',
      cantidad: String(it.cantidad),
      unidad: it.unidad || 'unidad',
      observaciones: it.observaciones || '',
      es_nuevo: !!it.es_nuevo,
      nuevo_codigo: it.nuevo_codigo || '',
      nuevo_stock_minimo: it.nuevo_stock_minimo ?? null,
      nuevo_categoria: it.nuevo_categoria || '',
    })),
  );
  const [productos, setProductos] = useState<Product[]>([]);
  const [insumosAlmacenIds, setInsumosAlmacenIds] = useState<Set<string>>(new Set());
  const [searchOpen, setSearchOpen] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [nuevoArticuloItemId, setNuevoArticuloItemId] = useState<number | null>(null);
  const [nuevoArticuloPrefill, setNuevoArticuloPrefill] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargo productos (para el buscador) y los almacenes de insumos.
  useEffect(() => {
    supabase
      .from('productos')
      .select('codigo, descripcion, stock, almacen_id, costo_promedio')
      .order('descripcion')
      .limit(2000)
      .then(({ data }) => setProductos((data as Product[]) || []));
    supabase
      .from('almacenes')
      .select('id, es_insumos')
      .eq('es_insumos', true)
      .then(({ data }) => setInsumosAlmacenIds(new Set((data || []).map((a: any) => a.id))));
  }, []);

  // Completo stock_actual / costo_actual de los items que ya tienen producto.
  useEffect(() => {
    if (productos.length === 0) return;
    setItems(xs => xs.map(x => {
      if (!x.producto_codigo) return x;
      const p = productos.find(pp => pp.codigo === x.producto_codigo);
      if (!p) return x;
      return { ...x, stock_actual: p.stock ?? null, costo_actual: p.costo_promedio ?? null };
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    let base = productos;
    if (insumosAlmacenIds.size > 0) {
      base = base.filter(p => p.almacen_id && insumosAlmacenIds.has(p.almacen_id));
    }
    if (!search.trim()) return base.slice(0, 50);
    const q = search.toLowerCase();
    return base.filter(p => p.codigo.toLowerCase().includes(q) || p.descripcion.toLowerCase().includes(q)).slice(0, 50);
  }, [search, productos, insumosAlmacenIds]);

  const setItem = (id: number, patch: Partial<ItemEdit>) =>
    setItems(xs => xs.map(x => x.id === id ? { ...x, ...patch } : x));

  const seleccionarProducto = (id: number, p: Product) => {
    setItem(id, {
      producto_codigo: p.codigo,
      descripcion: p.descripcion,
      stock_actual: p.stock ?? null,
      costo_actual: p.costo_promedio ?? null,
      es_nuevo: false,
      nuevo_codigo: '',
      nuevo_stock_minimo: null,
      nuevo_categoria: '',
    });
    setSearchOpen(null);
    setSearch('');
  };

  const abrirNuevoArticulo = (id: number, prefill: string) => {
    setNuevoArticuloItemId(id);
    setNuevoArticuloPrefill(prefill);
    setSearchOpen(null);
    setSearch('');
  };

  const aplicarNuevoArticulo = (data: NuevoArticuloInsumoData) => {
    if (nuevoArticuloItemId == null) return;
    setItem(nuevoArticuloItemId, {
      es_nuevo: true,
      producto_codigo: '',
      nuevo_codigo: data.codigo,
      descripcion: data.descripcion,
      nuevo_stock_minimo: data.stock_minimo,
      nuevo_categoria: data.categoria,
      stock_actual: null,
      costo_actual: null,
    });
    setNuevoArticuloItemId(null);
    setNuevoArticuloPrefill('');
  };

  const guardar = async () => {
    setError(null);
    if (!proveedor) return setError('Elegí un proveedor');
    if (proveedor === PROVEEDOR_OTRO && !proveedorNombre.trim()) return setError('Indicá el nombre del proveedor');
    for (const it of items) {
      if (!it.producto_codigo && !it.es_nuevo) return setError('Cada item necesita un artículo (existente o nuevo)');
      const c = parseFloat(it.cantidad);
      if (!c || c <= 0) return setError('Las cantidades deben ser positivas');
    }
    setSaving(true);
    try {
      const resp = await fetch(`/api/insumos/solicitudes/${solicitud.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proveedor: proveedor || null,
          proveedor_nombre: proveedor === PROVEEDOR_OTRO ? (proveedorNombre.trim() || null) : null,
          fecha_limite: fechaLimite || null,
          observaciones: observaciones.trim() || null,
          items: items.map(it => ({
            id: it.id,
            producto_codigo: it.producto_codigo.trim() || null,
            descripcion: it.descripcion.trim(),
            cantidad: parseFloat(it.cantidad),
            unidad: it.unidad,
            observaciones: it.observaciones.trim() || null,
            costo_estimado: it.costo_estimado.trim() ? parseFloat(it.costo_estimado) : null,
            moneda: it.moneda || 'UYU',
            es_nuevo: it.es_nuevo,
            nuevo_codigo: it.es_nuevo ? (it.nuevo_codigo.trim() || null) : null,
            nuevo_stock_minimo: it.es_nuevo ? it.nuevo_stock_minimo : null,
            nuevo_categoria: it.es_nuevo ? (it.nuevo_categoria || null) : null,
          })),
        }),
      });
      if (!resp.ok) {
        const b = await resp.json().catch(() => ({}));
        throw new Error(b.error || `HTTP ${resp.status}`);
      }
      onSaved();
    } catch (e: any) {
      setError(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const editingItem = nuevoArticuloItemId != null ? items.find(i => i.id === nuevoArticuloItemId) : null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-blue-400" />
            <div>
              <div className="font-mono text-xs text-slate-500">{solicitud.numero}</div>
              <h3 className="font-semibold text-slate-100">Editar solicitud</h3>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {/* Proveedor + fecha límite */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Proveedor *</label>
              <select
                value={proveedor}
                onChange={e => setProveedor(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-200"
              >
                <option value="">— elegir proveedor —</option>
                {PROVEEDORES_INSUMO.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              {aprobadorRequerido(proveedor) && (
                <p className="text-[11px] text-amber-400 mt-1">
                  Aprobación exclusiva de {aprobadorRequerido(proveedor)}.
                </p>
              )}
            </div>
            {proveedor === PROVEEDOR_OTRO ? (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Nombre del proveedor *</label>
                <input
                  type="text"
                  value={proveedorNombre}
                  onChange={e => setProveedorNombre(e.target.value)}
                  placeholder="Nombre del proveedor"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-200"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Fecha límite (opcional)</label>
                <input
                  type="date"
                  value={fechaLimite ? fechaLimite.split('T')[0] : ''}
                  onChange={e => setFechaLimite(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-200"
                />
              </div>
            )}
          </div>
          {proveedor === PROVEEDOR_OTRO && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Fecha límite (opcional)</label>
              <input
                type="date"
                value={fechaLimite ? fechaLimite.split('T')[0] : ''}
                onChange={e => setFechaLimite(e.target.value)}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-200"
              />
            </div>
          )}

          {/* Items */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Items</label>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={it.id} className="p-3 bg-slate-800 border border-slate-700 rounded-md">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-slate-500">Item {idx + 1}</span>
                    {it.producto_codigo && (
                      <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-[10px] text-emerald-400 font-mono">
                        {it.producto_codigo} · stock: {it.stock_actual ?? '?'}
                      </span>
                    )}
                    {it.es_nuevo && (
                      <span className="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/30 rounded text-[10px] text-blue-300 font-mono">
                        {it.nuevo_codigo || 'nuevo'} · artículo nuevo
                      </span>
                    )}
                  </div>

                  {!it.producto_codigo && !it.es_nuevo ? (
                    // Selector: buscar existente o crear nuevo
                    <div>
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Buscar producto por código o nombre..."
                          value={searchOpen === it.id ? search : ''}
                          onChange={e => { setSearchOpen(it.id); setSearch(e.target.value); }}
                          onFocus={() => setSearchOpen(it.id)}
                          className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      {searchOpen === it.id && (
                        <div className="mt-1 bg-slate-900 border border-slate-700 rounded max-h-56 overflow-y-auto">
                          {productosFiltrados.length === 0 ? (
                            <div className="p-3 text-sm text-slate-500 text-center">
                              Sin resultados.
                              <button
                                onClick={() => abrirNuevoArticulo(it.id, search.trim())}
                                className="block w-full mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs"
                              >
                                + Crear artículo nuevo
                              </button>
                            </div>
                          ) : (
                            <>
                              {productosFiltrados.map(p => (
                                <button
                                  key={p.codigo}
                                  onClick={() => seleccionarProducto(it.id, p)}
                                  className="w-full text-left px-3 py-2 hover:bg-slate-800 border-b border-slate-800 last:border-0"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="text-sm text-slate-200 truncate">{p.descripcion}</div>
                                      <div className="text-xs text-slate-500 font-mono">{p.codigo}</div>
                                    </div>
                                    <div className="text-xs text-slate-400 whitespace-nowrap">
                                      stock: <strong className="text-slate-200">{p.stock ?? 0}</strong>
                                    </div>
                                  </div>
                                </button>
                              ))}
                              <button
                                onClick={() => abrirNuevoArticulo(it.id, search.trim())}
                                className="w-full text-left px-3 py-2 hover:bg-blue-500/10 border-t border-slate-700 text-sm text-blue-300 flex items-center gap-2"
                              >
                                <PackagePlus className="w-4 h-4" />
                                ¿No lo encontrás? Crear artículo nuevo
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    // Item confirmado: existente (descripción bloqueada) o nuevo (editable)
                    <div className="space-y-2">
                      <div className={`flex items-start gap-2 px-3 py-2 bg-slate-900 border rounded ${it.producto_codigo ? 'border-emerald-500/30' : 'border-blue-500/30'}`}>
                        {it.producto_codigo
                          ? <Package className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                          : <PackagePlus className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-slate-200 flex items-center gap-2">
                            {it.descripcion}
                            {it.producto_codigo && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400 whitespace-nowrap">descripción se edita en Stock</span>
                            )}
                            {it.es_nuevo && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 whitespace-nowrap">Artículo nuevo</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 font-mono">
                            {it.producto_codigo
                              ? `${it.producto_codigo} · stock actual: ${it.stock_actual ?? 0}`
                              : `${it.nuevo_codigo || '(sin código)'} · se creará al recibir la compra`}
                          </div>
                        </div>
                        {it.es_nuevo && (
                          <button
                            onClick={() => abrirNuevoArticulo(it.id, it.descripcion)}
                            className="text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap flex items-center gap-1"
                            title="Editar artículo nuevo"
                          >
                            <Pencil className="w-3 h-3" />
                            editar
                          </button>
                        )}
                        <button
                          onClick={() => setItem(it.id, { producto_codigo: '', descripcion: '', stock_actual: null, costo_actual: null, es_nuevo: false, nuevo_codigo: '', nuevo_stock_minimo: null, nuevo_categoria: '' })}
                          className="text-xs text-slate-500 hover:text-slate-300 whitespace-nowrap"
                        >
                          cambiar
                        </button>
                      </div>
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-3">
                          <label className="block text-[11px] text-slate-500 mb-0.5">Cantidad *</label>
                          <input
                            type="number"
                            step="0.01"
                            value={it.cantidad}
                            onChange={e => setItem(it.id, { cantidad: e.target.value })}
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[11px] text-slate-500 mb-0.5">Unidad</label>
                          <select
                            value={it.unidad}
                            onChange={e => setItem(it.id, { unidad: e.target.value })}
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200"
                          >
                            <option value="unidad">unidad</option>
                            <option value="kg">kg</option>
                            <option value="lt">lt</option>
                            <option value="mt">mt</option>
                            <option value="caja">caja</option>
                            <option value="paquete">paquete</option>
                            <option value="rollo">rollo</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[11px] text-slate-500 mb-0.5">
                            {it.producto_codigo ? 'Costo (si cambió)' : 'Costo estimado'}
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={it.costo_estimado}
                            onChange={e => setItem(it.id, { costo_estimado: e.target.value })}
                            placeholder={it.costo_actual != null ? String(it.costo_actual) : '0.00'}
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[11px] text-slate-500 mb-0.5">Moneda</label>
                          <select
                            value={it.moneda}
                            onChange={e => setItem(it.id, { moneda: e.target.value })}
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200"
                          >
                            <option value="UYU">$ (UYU)</option>
                            <option value="USD">US$ (USD)</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[11px] text-slate-500 mb-0.5">Observaciones</label>
                          <input
                            value={it.observaciones}
                            onChange={e => setItem(it.id, { observaciones: e.target.value })}
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-slate-300"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Observaciones generales</label>
            <textarea
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-200 resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-md text-sm text-red-300">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-slate-800 bg-slate-900/60">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-300 hover:text-slate-100">
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {nuevoArticuloItemId != null && (
        <NuevoArticuloInsumoModal
          onClose={() => { setNuevoArticuloItemId(null); setNuevoArticuloPrefill(''); }}
          onConfirm={aplicarNuevoArticulo}
          codigoInicial={editingItem?.nuevo_codigo || ''}
          descripcionInicial={editingItem?.es_nuevo ? editingItem.descripcion : nuevoArticuloPrefill}
          stockMinimoInicial={editingItem?.nuevo_stock_minimo ?? null}
          categoriaInicial={editingItem?.nuevo_categoria || ''}
        />
      )}
    </div>
  );
}
