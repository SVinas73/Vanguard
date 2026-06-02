'use client';

import React, { useState } from 'react';
import { X, Save, Loader2, AlertCircle, Pencil } from 'lucide-react';
import { PROVEEDORES_INSUMO, PROVEEDOR_OTRO, aprobadorRequerido } from '@/lib/insumos/proveedores';

interface ItemEdit {
  id: number;
  descripcion: string;
  cantidad: string;
  unidad: string;
  observaciones: string;
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
    descripcion: string;
    cantidad: number;
    unidad?: string | null;
    observaciones?: string | null;
  }>;
}

interface Props {
  solicitud: SolicitudEditable;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Edición de una solicitud ya creada. EXCLUSIVO de admins (el backend lo
 * vuelve a validar). Permite corregir proveedor, fecha límite, observaciones
 * y las cantidades/descripciones de los items existentes.
 */
export default function EditarSolicitudInsumoModal({ solicitud, onClose, onSaved }: Props) {
  const [proveedor, setProveedor] = useState(solicitud.proveedor || '');
  const [proveedorNombre, setProveedorNombre] = useState(solicitud.proveedor_nombre || '');
  const [fechaLimite, setFechaLimite] = useState(solicitud.fecha_limite || '');
  const [observaciones, setObservaciones] = useState(solicitud.observaciones || '');
  const [items, setItems] = useState<ItemEdit[]>(() =>
    solicitud.items.map(it => ({
      id: it.id,
      descripcion: it.descripcion,
      cantidad: String(it.cantidad),
      unidad: it.unidad || 'unidad',
      observaciones: it.observaciones || '',
    })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setItem = (id: number, patch: Partial<ItemEdit>) =>
    setItems(xs => xs.map(x => x.id === id ? { ...x, ...patch } : x));

  const guardar = async () => {
    setError(null);
    if (!proveedor) return setError('Elegí un proveedor');
    if (proveedor === PROVEEDOR_OTRO && !proveedorNombre.trim()) return setError('Indicá el nombre del proveedor');
    for (const it of items) {
      if (!it.descripcion.trim()) return setError('Todos los items necesitan descripción');
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
            descripcion: it.descripcion.trim(),
            cantidad: parseFloat(it.cantidad),
            unidad: it.unidad,
            observaciones: it.observaciones.trim() || null,
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
            {proveedor === PROVEEDOR_OTRO && (
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
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Fecha límite (opcional)</label>
            <input
              type="date"
              value={fechaLimite ? fechaLimite.split('T')[0] : ''}
              onChange={e => setFechaLimite(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Items</label>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={it.id} className="p-3 bg-slate-800 border border-slate-700 rounded-md space-y-2">
                  <div className="text-xs text-slate-500">Item {idx + 1}</div>
                  <input
                    value={it.descripcion}
                    onChange={e => setItem(it.id, { descripcion: e.target.value })}
                    placeholder="Descripción"
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200"
                  />
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
                      <label className="block text-[11px] text-slate-500 mb-0.5">Observaciones</label>
                      <input
                        value={it.observaciones}
                        onChange={e => setItem(it.id, { observaciones: e.target.value })}
                        className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-slate-300"
                      />
                    </div>
                  </div>
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
    </div>
  );
}
