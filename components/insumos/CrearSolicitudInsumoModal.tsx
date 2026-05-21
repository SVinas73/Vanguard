'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { X, Plus, Trash2, Save, AlertCircle, Loader2, Search, Package, PackagePlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import NuevoProductoModal from '@/components/productos/NuevoProductoModal';

interface Product {
  codigo: string;
  descripcion: string;
  stock?: number;
  categoria?: string;
  almacen_id?: string | null;
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
}

interface CategoriaRouting {
  id: number;
  categoria: string;
  categoria_label: string | null;
  gestor_emails: string[];
  referente_emails: string[];
  activa: boolean;
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
  };
}

export default function CrearSolicitudInsumoModal({ organizacionId, onClose, onCreated }: Props) {
  const { user } = useAuth(false);
  const [categorias, setCategorias] = useState<CategoriaRouting[]>([]);
  const [productos, setProductos] = useState<Product[]>([]);
  const [almacenesInsumos, setAlmacenesInsumos] = useState<Almacen[]>([]);
  const [fechaLimite, setFechaLimite] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [items, setItems] = useState<ItemForm[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState<string | null>(null); // item.id que está buscando
  const [search, setSearch] = useState('');
  const [showNuevoProducto, setShowNuevoProducto] = useState<string | null>(null); // item.id que va a recibir el producto nuevo

  useEffect(() => {
    fetch(organizacionId ? `/api/insumos/routing?organizacion_id=${organizacionId}` : `/api/insumos/routing`)
      .then(r => r.json())
      .then(data => setCategorias((data.routing || []).filter((r: CategoriaRouting) => r.activa)))
      .catch(() => setCategorias([]));

    supabase
      .from('productos')
      .select('codigo, descripcion, stock, categoria, almacen_id')
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
      .select('codigo, descripcion, stock, categoria, almacen_id')
      .order('descripcion')
      .limit(2000);
    setProductos((data as Product[]) || []);
  };

  // Autodetectar categoría del primer producto seleccionado.
  // El routing del email usa esta categoría — no se le pide al usuario.
  const categoriaDetectada = useMemo<string | null>(() => {
    const primerConCat = items.find(i => i.producto_codigo)?.producto_codigo;
    if (!primerConCat) return null;
    const p = productos.find(p => p.codigo === primerConCat);
    return p?.categoria || null;
  }, [items, productos]);

  const catActual = categorias.find(c => c.categoria === categoriaDetectada);

  // Si hay items de múltiples categorías, advertir
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
    } : x));
    setSearchOpen(null);
    setSearch('');
  };

  const addItem = () => setItems(xs => [...xs, emptyItem()]);
  const removeItem = (id: string) => setItems(xs => xs.filter(x => x.id !== id));
  const setItem = (id: string, patch: Partial<ItemForm>) => {
    setItems(xs => xs.map(x => x.id === id ? { ...x, ...patch } : x));
  };

  const guardar = async () => {
    setError(null);
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
          fecha_limite: fechaLimite || null,
          observaciones: observaciones.trim() || null,
          items: items.map(it => ({
            producto_codigo: it.producto_codigo.trim() || null,
            descripcion: it.descripcion.trim(),
            cantidad: parseFloat(it.cantidad),
            unidad: it.unidad,
            observaciones: it.observaciones.trim() || null,
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

            {/* Categoría detectada del primer producto */}
            {categoriaDetectada && (
              <div className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-xs space-y-1">
                <div className="text-slate-300">
                  <strong>Categoría:</strong> <span className="text-blue-300">{categoriaDetectada}</span>
                  <span className="text-slate-500 ml-2">(detectada del primer producto)</span>
                </div>
                {categoriasMezcladas.length > 1 && (
                  <div className="text-amber-400">
                    ⚠ Hay productos de varias categorías ({categoriasMezcladas.join(', ')}).
                    Se va a usar "{categoriaDetectada}" para el destinatario.
                  </div>
                )}
                {catActual ? (
                  <>
                    {catActual.gestor_emails.length > 0 && (
                      <div className="text-slate-400"><strong>Para:</strong> {catActual.gestor_emails.join(', ')}</div>
                    )}
                    {catActual.referente_emails.length > 0 && (
                      <div className="text-slate-500"><strong>CC:</strong> {catActual.referente_emails.join(', ')}</div>
                    )}
                  </>
                ) : (
                  <div className="text-amber-400">
                    No hay destinatarios configurados para esta categoría. Configurá en
                    <strong> Comercial → Destinatarios</strong>.
                  </div>
                )}
              </div>
            )}

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
                      {items.length > 1 && (
                        <button onClick={() => removeItem(it.id)} className="ml-auto text-slate-500 hover:text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {!it.producto_codigo ? (
                      // Selector de producto
                      <div>
                        <div className="relative">
                          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                          <input
                            type="text"
                            placeholder="Buscar producto por código o nombre..."
                            value={searchOpen === it.id ? search : it.descripcion}
                            onChange={e => { setSearchOpen(it.id); setSearch(e.target.value); setItem(it.id, { descripcion: e.target.value }); }}
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
                                  onClick={() => { setShowNuevoProducto(it.id); setSearchOpen(null); }}
                                  className="block w-full mt-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs"
                                >
                                  + Crear nuevo artículo
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
                                  onClick={() => { setShowNuevoProducto(it.id); setSearchOpen(null); }}
                                  className="w-full text-left px-3 py-2 hover:bg-emerald-500/10 border-t border-slate-700 text-sm text-emerald-400 flex items-center gap-2"
                                >
                                  <PackagePlus className="w-4 h-4" />
                                  ¿No lo encontrás? Crear nuevo artículo
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      // Producto seleccionado
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 px-3 py-2 bg-slate-900 border border-emerald-500/30 rounded">
                          <Package className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-slate-200">{it.descripcion}</div>
                            <div className="text-xs text-slate-500 font-mono">{it.producto_codigo} · stock actual: {it.stock_actual ?? 0}</div>
                          </div>
                          <button
                            onClick={() => setItem(it.id, { producto_codigo: '', descripcion: '', stock_actual: null })}
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
                          <div className="col-span-3">
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
                          <div className="col-span-6">
                            <label className="block text-[11px] text-slate-500 mb-0.5">Observaciones (opcional)</label>
                            <input
                              value={it.observaciones}
                              onChange={e => setItem(it.id, { observaciones: e.target.value })}
                              placeholder="Detalle, color, marca preferida..."
                              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-slate-300"
                            />
                          </div>
                        </div>
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

      {showNuevoProducto && (
        <NuevoProductoModal
          userEmail={user?.email || ''}
          descripcionInicial={search}
          onClose={() => setShowNuevoProducto(null)}
          onCreated={async (codigo) => {
            await refetchProductos();
            // Buscar el producto recién creado y asignarlo al item.
            // NO usamos 'unidad' porque esa columna no existe en productos;
            // la unidad se elige en el item de la solicitud.
            const { data, error: queryErr } = await supabase
              .from('productos')
              .select('codigo, descripcion, stock, categoria, almacen_id')
              .eq('codigo', codigo)
              .maybeSingle();
            if (queryErr) {
              setError(`No se pudo cargar el producto recién creado: ${queryErr.message}`);
            } else if (data && showNuevoProducto) {
              seleccionarProducto(showNuevoProducto, data as Product);
            } else {
              setError(`Producto "${codigo}" no encontrado tras crearlo. Recargá la página.`);
            }
            setShowNuevoProducto(null);
            setSearch('');
          }}
        />
      )}
    </>
  );
}
