'use client';

import React, { useEffect, useState } from 'react';
import { X, Plus, Trash2, Save, AlertCircle, Loader2 } from 'lucide-react';

interface ItemForm {
  id: string;  // client-only id for keying
  producto_codigo: string;
  descripcion: string;
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
  organizacionId: string;
  onClose: () => void;
  onCreated: () => void;
}

function uid(): string {
  return Math.random().toString(36).slice(2);
}

export default function CrearSolicitudInsumoModal({ organizacionId, onClose, onCreated }: Props) {
  const [categorias, setCategorias] = useState<CategoriaRouting[]>([]);
  const [categoriaSel, setCategoriaSel] = useState<string>('');
  const [fechaLimite, setFechaLimite] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [items, setItems] = useState<ItemForm[]>([
    { id: uid(), producto_codigo: '', descripcion: '', cantidad: '1', unidad: 'unidad', observaciones: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/insumos/routing?organizacion_id=${organizacionId}`)
      .then(r => r.json())
      .then(data => setCategorias((data.routing || []).filter((r: CategoriaRouting) => r.activa)))
      .catch(() => setCategorias([]));
  }, [organizacionId]);

  const catActual = categorias.find(c => c.categoria === categoriaSel);

  const addItem = () => {
    setItems(xs => [...xs, { id: uid(), producto_codigo: '', descripcion: '', cantidad: '1', unidad: 'unidad', observaciones: '' }]);
  };

  const removeItem = (id: string) => {
    setItems(xs => xs.filter(x => x.id !== id));
  };

  const setItem = (id: string, patch: Partial<ItemForm>) => {
    setItems(xs => xs.map(x => x.id === id ? { ...x, ...patch } : x));
  };

  const guardar = async () => {
    setError(null);
    if (!categoriaSel) return setError('Seleccioná una categoría');
    if (items.length === 0) return setError('Al menos un item');
    for (const it of items) {
      if (!it.descripcion.trim()) return setError('Todos los items necesitan descripción');
      if (!parseFloat(it.cantidad) || parseFloat(it.cantidad) <= 0) return setError('Cantidades deben ser positivas');
    }

    setSaving(true);
    try {
      const resp = await fetch('/api/insumos/solicitudes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizacion_id: organizacionId,
          categoria: categoriaSel,
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
      if (data.aviso) {
        alert(data.aviso);
      }
      onCreated();
    } catch (e: any) {
      setError(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h3 className="font-semibold text-slate-100">Nueva solicitud de insumo</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {/* Categoría */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Categoría *</label>
            <select
              value={categoriaSel}
              onChange={e => setCategoriaSel(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="">— elegí una categoría —</option>
              {categorias.map(c => (
                <option key={c.id} value={c.categoria}>
                  {c.categoria_label || c.categoria} ({c.gestor_emails.length} gestores · {c.referente_emails.length} referentes)
                </option>
              ))}
            </select>
            {categorias.length === 0 && (
              <p className="text-xs text-amber-400 mt-1.5">
                No hay categorías configuradas. Pedile a un admin que configure las categorías en <strong>Integraciones → Insumos</strong>.
              </p>
            )}
            {catActual && (
              <div className="mt-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-xs">
                <div className="text-slate-500">Se notificará por email a:</div>
                {catActual.gestor_emails.length > 0 && (
                  <div className="mt-1 text-slate-300">
                    <strong>Gestores:</strong> {catActual.gestor_emails.join(', ')}
                  </div>
                )}
                {catActual.referente_emails.length > 0 && (
                  <div className="text-slate-400">
                    <strong>Referentes (CC):</strong> {catActual.referente_emails.join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Fecha límite */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Fecha límite (opcional)</label>
            <input
              type="date"
              value={fechaLimite}
              onChange={e => setFechaLimite(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">Para cuándo necesitás los insumos.</p>
          </div>

          {/* Items */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Items solicitados *</label>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={it.id} className="p-3 bg-slate-800 border border-slate-700 rounded-md">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-slate-500">Item {idx + 1}</span>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(it.id)} className="ml-auto text-slate-500 hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-12 gap-2">
                    <input
                      placeholder="Descripción *"
                      value={it.descripcion}
                      onChange={e => setItem(it.id, { descripcion: e.target.value })}
                      className="col-span-6 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="number"
                      placeholder="Cant."
                      value={it.cantidad}
                      onChange={e => setItem(it.id, { cantidad: e.target.value })}
                      className="col-span-2 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-blue-500 text-right"
                    />
                    <select
                      value={it.unidad}
                      onChange={e => setItem(it.id, { unidad: e.target.value })}
                      className="col-span-2 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200"
                    >
                      <option value="unidad">unidad</option>
                      <option value="kg">kg</option>
                      <option value="lt">lt</option>
                      <option value="mt">mt</option>
                      <option value="caja">caja</option>
                      <option value="paquete">paquete</option>
                      <option value="rollo">rollo</option>
                    </select>
                    <input
                      placeholder="SKU (opc.)"
                      value={it.producto_codigo}
                      onChange={e => setItem(it.id, { producto_codigo: e.target.value })}
                      className="col-span-2 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      placeholder="Observaciones (opcional)"
                      value={it.observaciones}
                      onChange={e => setItem(it.id, { observaciones: e.target.value })}
                      className="col-span-12 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-slate-300 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={addItem}
              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs border border-slate-700"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar item
            </button>
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
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-300 hover:text-slate-100"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={saving || !categoriaSel}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Guardando...' : 'Crear solicitud'}
          </button>
        </div>
      </div>
    </div>
  );
}
