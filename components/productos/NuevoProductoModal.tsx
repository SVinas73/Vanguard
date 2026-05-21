'use client';

import React, { useState } from 'react';
import { X, Plus, Package, Loader2 } from 'lucide-react';
import { useInventoryStore } from '@/store';
import { CATEGORIA_NOMBRES } from '@/lib/constants';
import { supabase } from '@/lib/supabase';

interface Props {
  onClose: () => void;
  /** Llamado con el código del producto recién creado */
  onCreated: (codigo: string) => void;
  userEmail: string;
  /** Pre-completa el código */
  codigoInicial?: string;
  /** Pre-completa la descripción */
  descripcionInicial?: string;
  /** Pre-selecciona almacén (útil si lo creás desde un módulo que ya filtra por almacén) */
  almacenIdInicial?: string;
}

interface Almacen {
  id: string;
  nombre: string;
}

/**
 * Modal para crear un producto nuevo desde cualquier módulo. Replica el
 * form de creación que vive en /stock pero auto-contenido y reusable.
 * Crea el producto vía el store y opcionalmente carga stock inicial.
 */
export default function NuevoProductoModal({
  onClose,
  onCreated,
  userEmail,
  codigoInicial = '',
  descripcionInicial = '',
  almacenIdInicial = '',
}: Props) {
  const addProduct = useInventoryStore(s => s.addProduct);
  const [codigo, setCodigo] = useState(codigoInicial.toUpperCase());
  const [descripcion, setDescripcion] = useState(descripcionInicial);
  const [precio, setPrecio] = useState('');
  const [stockMinimo, setStockMinimo] = useState('10');
  const [categoria, setCategoria] = useState('');
  const [almacenId, setAlmacenId] = useState(almacenIdInicial);
  const [stockInicial, setStockInicial] = useState('');
  const [costoInicial, setCostoInicial] = useState('');
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    supabase.from('almacenes').select('id, nombre').order('nombre')
      .then(({ data }) => setAlmacenes((data as Almacen[]) || []));
  }, []);

  const guardar = async () => {
    setError(null);
    if (!codigo.trim()) return setError('Código requerido');
    if (!descripcion.trim()) return setError('Descripción requerida');
    if (!precio || parseFloat(precio) <= 0) return setError('Precio inválido');
    if (!categoria) return setError('Categoría requerida');

    setSaving(true);
    try {
      await addProduct(
        {
          codigo: codigo.toUpperCase().trim(),
          descripcion: descripcion.trim(),
          precio: parseFloat(precio),
          categoria,
          stockMinimo: parseInt(stockMinimo) || 10,
          almacenId: almacenId || null,
        } as any,
        userEmail,
      );

      // Si hay stock inicial, generar movimiento de entrada
      const cantidadInicial = parseInt(stockInicial) || 0;
      const costo = parseFloat(costoInicial) || 0;
      if (cantidadInicial > 0) {
        await new Promise(r => setTimeout(r, 250));
        await supabase.from('movimientos').insert({
          producto_codigo: codigo.toUpperCase().trim(),
          tipo: 'entrada',
          cantidad: cantidadInicial,
          costo_unitario: costo || null,
          motivo: 'Stock inicial al crear producto',
          usuario_email: userEmail,
        });
      }

      onCreated(codigo.toUpperCase().trim());
    } catch (e: any) {
      setError(e?.message || 'Error creando producto');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold text-slate-100">Nuevo artículo</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-xs text-slate-400 mb-1">Código *</label>
              <input
                value={codigo}
                onChange={e => setCodigo(e.target.value.toUpperCase())}
                placeholder="ACE-001"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 font-mono"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Descripción *</label>
              <input
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                placeholder="Nombre del producto"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Precio de venta *</label>
              <input
                type="number"
                step="0.01"
                value={precio}
                onChange={e => setPrecio(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Stock mínimo</label>
              <input
                type="number"
                value={stockMinimo}
                onChange={e => setStockMinimo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200"
              />
            </div>
          </div>

          {/* Stock inicial (opcional) */}
          <div className="p-3 rounded-md bg-emerald-500/5 border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Package size={14} className="text-emerald-400" />
              <span className="text-sm text-emerald-300 font-medium">Stock inicial (opcional)</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Cantidad inicial</label>
                <input
                  type="number"
                  value={stockInicial}
                  onChange={e => setStockInicial(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Costo unitario</label>
                <input
                  type="number"
                  step="0.01"
                  value={costoInicial}
                  onChange={e => setCostoInicial(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Si cargás stock inicial, se genera automáticamente un movimiento de entrada.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Categoría *</label>
              <select
                value={categoria}
                onChange={e => setCategoria(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200"
              >
                <option value="">— elegir —</option>
                {Object.entries(CATEGORIA_NOMBRES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Almacén</label>
              <select
                value={almacenId}
                onChange={e => setAlmacenId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200"
              >
                <option value="">— ninguno —</option>
                {almacenes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
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
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Crear artículo
          </button>
        </div>
      </div>
    </div>
  );
}
