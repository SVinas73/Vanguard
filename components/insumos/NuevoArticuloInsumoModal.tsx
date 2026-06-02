'use client';

import React, { useState } from 'react';
import { X, PackagePlus, Loader2 } from 'lucide-react';
import { CATEGORIA_NOMBRES } from '@/lib/constants';

export interface NuevoArticuloInsumoData {
  codigo: string;
  descripcion: string;
  stock_minimo: number;
  categoria: string;
}

interface Props {
  onClose: () => void;
  /** Devuelve los datos del artículo nuevo. NO crea nada en la BD: el
   *  producto se crea recién cuando se RECIBE la compra. */
  onConfirm: (data: NuevoArticuloInsumoData) => void;
  codigoInicial?: string;
  descripcionInicial?: string;
  stockMinimoInicial?: number | null;
  categoriaInicial?: string;
}

/**
 * Formulario para definir un ARTÍCULO NUEVO dentro de una solicitud de insumo.
 *
 * A diferencia del viejo NuevoProductoModal, este NO inserta en `productos`:
 * solo captura los datos (código, descripción, stock mínimo, categoría) que
 * se guardan en el item de la solicitud. El producto se crea en Stock recién
 * cuando la compra se recibe, con la cantidad realmente recibida.
 */
export default function NuevoArticuloInsumoModal({
  onClose,
  onConfirm,
  codigoInicial = '',
  descripcionInicial = '',
  stockMinimoInicial = null,
  categoriaInicial = '',
}: Props) {
  const [codigo, setCodigo] = useState(codigoInicial.toUpperCase());
  const [descripcion, setDescripcion] = useState(descripcionInicial);
  const [stockMinimo, setStockMinimo] = useState(
    stockMinimoInicial != null ? String(stockMinimoInicial) : '10',
  );
  const [categoria, setCategoria] = useState(categoriaInicial || 'Insumos');
  const [error, setError] = useState<string | null>(null);

  const confirmar = () => {
    setError(null);
    if (!codigo.trim()) return setError('Código requerido');
    if (!descripcion.trim()) return setError('Descripción requerida');
    onConfirm({
      codigo: codigo.toUpperCase().trim(),
      descripcion: descripcion.trim(),
      stock_minimo: parseInt(stockMinimo) || 10,
      categoria: categoria || 'Insumos',
    });
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-lg overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <PackagePlus className="w-4 h-4 text-blue-400" />
            <h3 className="font-semibold text-slate-100">Artículo nuevo</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-blue-500/5 border border-blue-500/20 text-xs text-blue-200">
            <PackagePlus className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Este artículo todavía no existe en Stock. Se creará automáticamente
              <strong> al recibir la compra</strong>, con la cantidad realmente recibida.
              El costo se carga en la recepción.
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-xs text-slate-400 mb-1">Código *</label>
              <input
                value={codigo}
                onChange={e => setCodigo(e.target.value.toUpperCase())}
                placeholder="TORXT25"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 font-mono"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Descripción *</label>
              <input
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                placeholder="Nombre del artículo"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Stock mínimo</label>
              <input
                type="number"
                value={stockMinimo}
                onChange={e => setStockMinimo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Categoría</label>
              <select
                value={categoria}
                onChange={e => setCategoria(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200"
              >
                <option value="Insumos">Insumos</option>
                {CATEGORIA_NOMBRES.map(nombre => (
                  <option key={nombre} value={nombre}>{nombre}</option>
                ))}
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
            onClick={confirmar}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm"
          >
            <PackagePlus className="w-4 h-4" />
            Agregar a la solicitud
          </button>
        </div>
      </div>
    </div>
  );
}
