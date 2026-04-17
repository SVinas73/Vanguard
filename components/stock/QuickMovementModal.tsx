'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Plus, Minus, ArrowDownLeft, ArrowUpRight, Loader2 } from 'lucide-react';
import { Product } from '@/types';

interface QuickMovementModalProps {
  product: Product;
  tipo: 'entrada' | 'salida';
  onSubmit: (data: { codigo: string; tipo: 'entrada' | 'salida'; cantidad: number; notas: string; costoCompra?: number }) => Promise<void>;
  onClose: () => void;
}

export function QuickMovementModal({ product, tipo, onSubmit, onClose }: QuickMovementModalProps) {
  const [cantidad, setCantidad] = useState(1);
  const [notas, setNotas] = useState('');
  const [costoCompra, setCostoCompra] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const cantidadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    cantidadRef.current?.focus();
    cantidadRef.current?.select();
  }, []);

  const maxSalida = tipo === 'salida' ? product.stock : Infinity;
  const isValid = cantidad > 0 && (tipo === 'entrada' || cantidad <= maxSalida);
  const newStock = tipo === 'entrada' ? product.stock + cantidad : product.stock - cantidad;
  const isEntrada = tipo === 'entrada';

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        codigo: product.codigo,
        tipo,
        cantidad,
        notas,
        costoCompra: isEntrada && costoCompra ? parseFloat(costoCompra) : undefined,
      });
      onClose();
    } catch {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid) handleSubmit();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${isEntrada ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isEntrada ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
              {isEntrada
                ? <ArrowDownLeft size={18} className="text-emerald-400" />
                : <ArrowUpRight size={18} className="text-red-400" />}
            </div>
            <div>
              <div className="text-sm font-semibold text-white">
                {isEntrada ? 'Registrar Entrada' : 'Registrar Salida'}
              </div>
              <div className="text-xs text-slate-500">{product.codigo}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        {/* Product info */}
        <div className="px-4 pt-4">
          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <div className="text-sm font-medium text-slate-200 mb-1">{product.descripcion}</div>
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span>Stock actual: <strong className="text-white">{product.stock}</strong></span>
              <span>Mínimo: <strong className="text-slate-300">{product.stockMinimo}</strong></span>
              {product.costoPromedio ? (
                <span>Costo prom: <strong className="text-slate-300">${product.costoPromedio.toFixed(2)}</strong></span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="p-4 space-y-4">
          {/* Quantity */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-2 block">Cantidad</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
              >
                <Minus size={16} className="text-slate-300" />
              </button>
              <input
                ref={cantidadRef}
                type="number"
                value={cantidad}
                onChange={(e) => setCantidad(Math.max(0, parseInt(e.target.value) || 0))}
                min={1}
                max={tipo === 'salida' ? product.stock : undefined}
                className="flex-1 text-center text-2xl font-bold bg-slate-800/50 border border-slate-700/50 rounded-xl py-3 text-white focus:outline-none focus:border-slate-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                onClick={() => setCantidad(tipo === 'salida' ? Math.min(product.stock, cantidad + 1) : cantidad + 1)}
                className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
              >
                <Plus size={16} className="text-slate-300" />
              </button>
            </div>
            {tipo === 'salida' && cantidad > product.stock && (
              <div className="text-xs text-red-400 mt-1">No hay suficiente stock disponible</div>
            )}
          </div>

          {/* Cost for entrada */}
          {isEntrada && (
            <div>
              <label className="text-xs font-medium text-slate-400 mb-2 block">Costo unitario (opcional)</label>
              <input
                type="number"
                step="0.01"
                value={costoCompra}
                onChange={(e) => setCostoCompra(e.target.value)}
                placeholder={product.costoPromedio ? `Último: $${product.costoPromedio.toFixed(2)}` : '0.00'}
                className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-600"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-2 block">Notas (opcional)</label>
            <input
              type="text"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Razón del movimiento..."
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-600"
            />
          </div>

          {/* Preview */}
          <div className={`p-3 rounded-xl border ${isEntrada ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Stock resultante:</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">{product.stock}</span>
                <span className="text-slate-600">&rarr;</span>
                <span className={`font-bold text-lg ${newStock <= product.stockMinimo ? 'text-red-400' : 'text-emerald-400'}`}>
                  {newStock}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-300 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              isEntrada
                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                : 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                {isEntrada ? <Plus size={16} /> : <Minus size={16} />}
                Confirmar {isEntrada ? 'Entrada' : 'Salida'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
