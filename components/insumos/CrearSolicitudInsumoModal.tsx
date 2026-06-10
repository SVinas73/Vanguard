'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { X, Plus, Trash2, Save, AlertCircle, Loader2, Search, Package, PackagePlus, Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import NuevoArticuloInsumoModal, { NuevoArticuloInsumoData } from './NuevoArticuloInsumoModal';
import { PROVEEDORES_INSUMO, PROVEEDOR_OTRO, aprobadorRequerido } from '@/lib/insumos/proveedores';

interface Product {
  codigo: string;
  descripcion: string;
  stock?: number;
  categoria?: string;
  almacen_id?: string | null;
  costo_promedio?: number | null;
}

interface Almacen {
  id: string;
  nombre: string;
  es_insumos?: boolean;
}

interface ItemForm {
  id: string;
  producto_codigo: string;
  descripcion: string;
  stock_actual: number | null;
  cantidad: string;
  unidad: string;
  observaciones: string;
  // Costo unitario estimado al solicitar (opcional; se confirma al recibir)
  costo_estimado: string;
  // Moneda del costo (UYU o USD). Se propaga al producto al recibir.
  moneda: string;
  // Último costo conocido del producto existente (referencia; no se envía)
  costo_actual: number | null;
  // Artículo nuevo (todavía no existe en Stock; se crea al recibir la compra)
  es_nuevo: boolean;
  nuevo_codigo: string;
  nuevo_stock_minimo: number | null;
  nuevo_categoria: string;
}


interface Props {
  organizacionId: string | null;
  onClose: () => void;
  onCreated: () => void;
}

function uid(): string {
  return Math.random().toString(36).slice(2);
}

function emptyItem(): ItemForm {
  return {
    id: uid(),
    producto_codigo: '',
    descripcion: '',
    stock_actual: null,
    cantidad: '1',
    unidad: 'unidad',
    observaciones: '',
    costo_estimado: '',
    moneda: 'UYU',
    costo_actual: null,
    es_nuevo: false,
    nuevo_codigo: '',
    nuevo_stock_minimo: null,
    nuevo_categoria: '',
  };
}

export default function CrearSolicitudInsumoModal({ organizacionId, onClose, onCreated }: Props) {
  const { user } = useAuth(false);
  const [productos, setProductos] = useState<Product[]>([]);
  const [almacenesInsumos, setAlmacenesInsumos] = useState<Almacen[]>([]);
  const [fechaLimite, setFechaLimite] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [proveedorNombre, setProveedorNombre] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [emailsNotificar, setEmailsNotificar] = useState<string[]>([]);
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [items, setItems] = useState<ItemForm[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState<string | null>(null); // item.id que está buscando
  const [search, setSearch] = useState('');
  // item.id que está definiendo un artículo nuevo (abre NuevoArticuloInsumoModal)
  const [nuevoArticuloItemId, setNuevoArticuloItemId] = useState<string | null>(null);
  const [nuevoArticuloPrefill, setNuevoArticuloPrefill] = useState('');

  useEffect(() => {
    supabase
      .from('productos')
      .select('codigo, descripcion, stock, categoria, almacen_id, costo_promedio')
      .order('descripcion')
      .limit(2000)
      .then(({ data }) => setProductos((data as Product[]) || []));

    // Cargo solo los almacenes marcados como es_insumos = true
    supabase
      .from('almacenes')
      .select('id, nombre, es_insumos')
      .eq('es_insumos', true)
      .order('nombre')
      .then(({ data }) => setAlmacenesInsumos((data as Almacen[]) || []));
  }, [organizacionId]);

  const refetchProductos = async () => {
    const { data } = await supabase
      .from('productos')
      .select('codigo, descripcion, stock, categoria, almacen_id, costo_promedio')
      .order('descripcion')
      .limit(2000);
    setProductos((data as Product[]) || []);
  };

  const categoriaDetectada = useMemo<string | null>(() => {
    const primerConCat = items.find(i => i.producto_codigo)?.producto_codigo;
    if (!primerConCat) return null;
    const p = productos.find(p => p.codigo === primerConCat);
    return p?.categoria || null;
  }, [items, productos]);

  // ya no se usa pero lo mantenemos por si alguien lee categoria_label
  const categoriasMezcladas = useMemo<string[]>(() => {
    const cats = new Set<string>();
    for (const it of items) {
      if (!it.producto_codigo) continue;
      const p = productos.find(p => p.codigo === it.producto_codigo);
      if (p?.categoria) cats.add(p.categoria);
    }
    return Array.from(cats);
  }, [items, productos]);

  // IDs de almacenes marcados como de insumos (BD: almacenes.es_insumos)
  const idsInsumos = useMemo(() => new Set(almacenesInsumos.map(a => a.id)), [almacenesInsumos]);

  const productosFiltrados = useMemo(() => {
    // Solo productos cuyo almacén esté marcado como es_insumos = TRUE.
    // Si no hay ningún almacén marcado en la BD, muestra TODOS (fallback).
    let base = productos;
    if (idsInsumos.size > 0) {
      base = base.filter(p => p.almacen_id && idsInsumos.has(p.almacen_id));
    }
    if (!search.trim()) return base.slice(0, 50);
    const q = search.toLowerCase();
    return base
      .filter(p => p.codigo.toLowerCase().includes(q) || p.descripcion.toLowerCase().includes(q))
      .slice(0, 50);
  }, [search, productos, idsInsumos]);

  const seleccionarProducto = (itemId: string, p: Product) => {
    setItems(xs => xs.map(x => x.id === itemId ? {
      ...x,
      producto_codigo: p.codigo,
      descripcion: p.descripcion,
      stock_actual: p.stock ?? null,
      costo_actual: p.costo_promedio ?? null,
      es_nuevo: false,
      nuevo_codigo: '',
      nuevo_stock_minimo: null,
      nuevo_categoria: '',
    } : x));
    setSearchOpen(null);
    setSearch('');
  };

  // Abre el form de artículo nuevo para un item concreto (funciona en
  // cualquier posición de la lista: principio, medio o final).
  const abrirNuevoArticulo = (itemId: string, prefill: string) => {
    setNuevoArticuloItemId(itemId);
    setNuevoArticuloPrefill(prefill);
    setSearchOpen(null);
    setSearch('');
  };

  // Aplica los datos del artículo nuevo al item. NO crea nada en la BD:
  // se persiste en el item y el producto se crea recién al recibir la compra.
  const aplicarNuevoArticulo = (data: NuevoArticuloInsumoData) => {
    if (!nuevoArticuloItemId) return;
    setItem(nuevoArticuloItemId, {
      es_nuevo: true,
      producto_codigo: '',
      nuevo_codigo: data.codigo,
      descripcion: data.descripcion,
      nuevo_stock_minimo: data.stock_minimo,
      nuevo_categoria: data.categoria,
      stock_actual: null,
    });
    setNuevoArticuloItemId(null);
    setNuevoArticuloPrefill('');
  };

  const addItem = () => setItems(xs => [...xs, emptyItem()]);
  const removeItem = (id: string) => setItems(xs => xs.filter(x => x.id !== id));
  const setItem = (id: string, patch: Partial<ItemForm>) => {
    setItems(xs => xs.map(x => x.id === id ? { ...x, ...patch } : x));
  };

  const guardar = async () => {
    setError(null);
    if (!proveedor) return setError('Elegí un proveedor');
    if (proveedor === PROVEEDOR_OTRO && !proveedorNombre.trim()) return setError('Indicá el nombre del proveedor');
    if (items.length === 0) return setError('Al menos un item');
    for (const it of items) {
      if (!it.descripcion.trim()) return setError('Todos los items necesitan producto o descripción');
      const c = parseFloat(it.cantidad);
      if (!c || c <= 0) return setError('Cantidades deben ser positivas');
    }
    // Categoría auto-detectada del primer producto, fallback 'insumos'
    const categoriaFinal = categoriaDetectada || 'insumos';

    setSaving(true);
    try {
      const resp = await fetch('/api/insumos/solicitudes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizacion_id: organizacionId,
          categoria: categoriaFinal,
          proveedor: proveedor || null,
          proveedor_nombre: proveedor === PROVEEDOR_OTRO ? (proveedorNombre.trim() || null) : null,
          emails_notificar: emailsNotificar,
          fecha_limite: fechaLimite || null,
          observaciones: observaciones.trim() || null,
          items: items.map(it => ({
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
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      if (data.aviso) alert(data.aviso);
      onCreated();
    } catch (e: any) {
      setError(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-slate-800">
            <h3 className="font-semibold text-slate-100">Nueva solicitud de insumo</h3>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-200">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 overflow-y-auto space-y-4">
            {/* Info almacenes de insumos + fecha límite */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Almacén</label>
                <div className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-300">
                  {almacenesInsumos.length === 0
                    ? <span className="text-amber-400">Ningún almacén marcado como insumos</span>
                    : almacenesInsumos.map(a => a.nombre).join(' · ')}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Fecha límite (opcional)</label>
                <input
                  type="date"
                  value={fechaLimite}
                  onChange={e => setFechaLimite(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-200"
                />
              </div>
            </div>

            {/* Proveedor */}
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
                    La aprobación de este proveedor es exclusiva de {aprobadorRequerido(proveedor)}.
                  </p>
                )}
              </div>
              {proveedor === PROVEEDOR_OTRO && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Nombre del proveedor *</label>
                  <input
                    type="text"
                    value={proveedorNombre}
                    onChange={e => setProveedorNombre(e.target.value)}
                    placeholder="Escribí el nombre del proveedor"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-200"
                  />
                </div>
              )}
            </div>

            {/* Emails a notificar */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Notificar por email a
              </label>
              <div className="space-y-1.5 mb-2">
                {emailsNotificar.map(e => (
                  <div key={e} className="flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm">
                    <span className="text-slate-200 truncate">{e}</span>
                    <button
                      type="button"
                      onClick={() => setEmailsNotificar(xs => xs.filter(x => x !== e))}
                      className="text-slate-500 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={nuevoEmail}
                  onChange={e => setNuevoEmail(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const v = nuevoEmail.trim();
                      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { setError('Email inválido'); return; }
                      if (emailsNotificar.includes(v)) { setNuevoEmail(''); return; }
                      setError(null);
                      setEmailsNotificar([...emailsNotificar, v]);
                      setNuevoEmail('');
                    }
                  }}
                  placeholder="email@empresa.com"
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const v = nuevoEmail.trim();
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { setError('Email inválido'); return; }
                    if (emailsNotificar.includes(v)) { setNuevoEmail(''); return; }
                    setError(null);
                    setEmailsNotificar([...emailsNotificar, v]);
                    setNuevoEmail('');
                  }}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md text-sm text-slate-200"
                >
                  Agregar
                </button>
              </div>
            </div>

            {/* Items */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Insumos solicitados *</label>
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
                      {items.length > 1 && (
                        <button onClick={() => removeItem(it.id)} className="ml-auto text-slate-500 hover:text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {!it.producto_codigo && !it.es_nuevo ? (
                      // Selector de producto: buscar existente o crear artículo nuevo
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
                      // Ítem confirmado: producto existente o artículo nuevo
                      <div className="space-y-2">
                        <div className={`flex items-start gap-2 px-3 py-2 bg-slate-900 border rounded ${it.producto_codigo ? 'border-emerald-500/30' : 'border-blue-500/30'}`}>
                          {it.producto_codigo
                            ? <Package className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                            : <PackagePlus className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-slate-200 flex items-center gap-2">
                              {it.descripcion}
                              {!it.producto_codigo && (
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
                              {it.producto_codigo ? 'Costo unit. (si cambió)' : 'Costo unit. estimado'}
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
                              placeholder="Detalle, color, marca..."
                              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-slate-300"
                            />
                          </div>
                        </div>
                        {/* Referencia de costo para artículos existentes: avisamos
                            el último costo y si el estimado ingresado es distinto. */}
                        {it.producto_codigo && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                            <span>Último costo: <strong className="text-slate-300">{it.costo_actual != null ? it.costo_actual.toFixed(2) : '—'}</strong></span>
                            {it.costo_estimado.trim() && it.costo_actual != null && parseFloat(it.costo_estimado) !== it.costo_actual && (
                              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300">precio nuevo</span>
                            )}
                            <span className="text-slate-600">· se confirma al recibir</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  onClick={addItem}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs border border-slate-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar otro item
                </button>
              </div>
            </div>

            {/* Observaciones generales */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Observaciones generales (opcional)</label>
              <textarea
                value={observaciones}
                onChange={e => setObservaciones(e.target.value)}
                rows={3}
                placeholder="Notas, motivo de urgencia, contexto..."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
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
              {saving ? 'Guardando...' : 'Crear solicitud'}
            </button>
          </div>
        </div>
      </div>

      {nuevoArticuloItemId && (() => {
        const editing = items.find(i => i.id === nuevoArticuloItemId);
        return (
          <NuevoArticuloInsumoModal
            onClose={() => { setNuevoArticuloItemId(null); setNuevoArticuloPrefill(''); }}
            onConfirm={aplicarNuevoArticulo}
            codigoInicial={editing?.nuevo_codigo || ''}
            descripcionInicial={editing?.es_nuevo ? editing.descripcion : nuevoArticuloPrefill}
            stockMinimoInicial={editing?.nuevo_stock_minimo ?? null}
            categoriaInicial={editing?.nuevo_categoria || ''}
          />
        );
      })()}
    </>
  );
}
