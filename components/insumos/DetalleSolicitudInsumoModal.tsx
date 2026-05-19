'use client';

import React, { useState } from 'react';
import { X, AlertCircle, Loader2, Calendar, User, Tag, ClipboardList } from 'lucide-react';

interface ItemSolicitud {
  id: number;
  producto_codigo?: string | null;
  descripcion: string;
  cantidad: number;
  unidad?: string;
  observaciones?: string | null;
  cantidad_recibida?: number | null;
}

interface Solicitud {
  id: string;
  numero: string;
  categoria: string;
  solicitado_por: string;
  fecha_solicitud: string;
  fecha_limite?: string | null;
  fecha_ingreso?: string | null;
  estado: 'pendiente' | 'en_gestion' | 'comprada' | 'recibida' | 'cerrada' | 'cancelada';
  estado_motivo?: string | null;
  gestor_asignado?: string | null;
  observaciones?: string | null;
  items: ItemSolicitud[];
}

const ESTADO_LABEL: Record<Solicitud['estado'], string> = {
  pendiente: 'Pendiente',
  en_gestion: 'En gestión',
  comprada: 'Comprada',
  recibida: 'Recibida',
  cerrada: 'Cerrada',
  cancelada: 'Cancelada',
};

const TRANSICIONES: Record<Solicitud['estado'], Solicitud['estado'][]> = {
  pendiente: ['en_gestion', 'cancelada'],
  en_gestion: ['comprada', 'recibida', 'cancelada'],
  comprada: ['recibida', 'cancelada'],
  recibida: ['cerrada'],
  cerrada: [],
  cancelada: [],
};

interface Props {
  solicitud: Solicitud;
  puedeGestionar: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export default function DetalleSolicitudInsumoModal({ solicitud, puedeGestionar, onClose, onChanged }: Props) {
  const [accion, setAccion] = useState<Solicitud['estado'] | ''>('');
  const [motivo, setMotivo] = useState('');
  const [fechaIngreso, setFechaIngreso] = useState(solicitud.fecha_ingreso || new Date().toISOString().split('T')[0]);
  const [itemsRecibidos, setItemsRecibidos] = useState<Record<number, string>>(() => {
    const m: Record<number, string> = {};
    for (const it of solicitud.items) {
      m[it.id] = String(it.cantidad_recibida ?? it.cantidad);
    }
    return m;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transicionesPosibles = TRANSICIONES[solicitud.estado];

  const ejecutar = async () => {
    if (!accion) return;
    setError(null);
    setSaving(true);
    try {
      const body: any = { estado: accion };
      if (motivo.trim()) body.motivo = motivo.trim();
      if (accion === 'recibida') {
        body.fecha_ingreso = fechaIngreso;
        body.items_recibidos = solicitud.items.map(it => ({
          item_id: it.id,
          cantidad_recibida: parseFloat(itemsRecibidos[it.id] || '0'),
        }));
      }
      const resp = await fetch(`/api/insumos/solicitudes/${solicitud.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const b = await resp.json().catch(() => ({}));
        throw new Error(b.error || `HTTP ${resp.status}`);
      }
      onChanged();
    } catch (e: any) {
      setError(e.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div>
            <div className="font-mono text-xs text-slate-500">{solicitud.numero}</div>
            <h3 className="font-semibold text-slate-100">Solicitud de insumo</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-slate-500 mb-0.5 flex items-center gap-1"><Tag className="w-3 h-3" /> Categoría</div>
              <div className="text-slate-200 font-medium">{solicitud.categoria}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-0.5">Estado actual</div>
              <div className="text-slate-200 font-medium">{ESTADO_LABEL[solicitud.estado]}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-0.5 flex items-center gap-1"><User className="w-3 h-3" /> Solicitante</div>
              <div className="text-slate-200">{solicitud.solicitado_por}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-0.5 flex items-center gap-1"><Calendar className="w-3 h-3" /> Fecha solicitud</div>
              <div className="text-slate-200">{new Date(solicitud.fecha_solicitud).toLocaleString('es-UY')}</div>
            </div>
            {solicitud.fecha_limite && (
              <div>
                <div className="text-xs text-slate-500 mb-0.5">Fecha límite</div>
                <div className="text-amber-400 font-medium">{new Date(solicitud.fecha_limite).toLocaleDateString('es-UY')}</div>
              </div>
            )}
            {solicitud.fecha_ingreso && (
              <div>
                <div className="text-xs text-slate-500 mb-0.5">Fecha ingreso</div>
                <div className="text-emerald-400 font-medium">{new Date(solicitud.fecha_ingreso).toLocaleDateString('es-UY')}</div>
              </div>
            )}
            {solicitud.gestor_asignado && (
              <div className="col-span-2">
                <div className="text-xs text-slate-500 mb-0.5">Gestor asignado</div>
                <div className="text-slate-200">{solicitud.gestor_asignado}</div>
              </div>
            )}
          </div>

          {solicitud.observaciones && (
            <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-md">
              <div className="text-xs text-amber-400 font-medium mb-1">Observaciones</div>
              <div className="text-sm text-slate-200">{solicitud.observaciones}</div>
            </div>
          )}

          {solicitud.estado_motivo && (
            <div className="p-3 bg-slate-800 border border-slate-700 rounded-md">
              <div className="text-xs text-slate-500 font-medium mb-1">Motivo de estado</div>
              <div className="text-sm text-slate-300">{solicitud.estado_motivo}</div>
            </div>
          )}

          {/* Items */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-200">Items ({solicitud.items.length})</span>
            </div>
            <div className="space-y-1.5">
              {solicitud.items.map(it => (
                <div key={it.id} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-slate-200 flex-1">{it.descripcion}</div>
                    <div className="text-slate-400 whitespace-nowrap">
                      {it.cantidad} {it.unidad}
                      {it.cantidad_recibida != null && (
                        <span className="ml-2 text-emerald-400">→ {it.cantidad_recibida} recibido</span>
                      )}
                    </div>
                  </div>
                  {(it.producto_codigo || it.observaciones) && (
                    <div className="mt-1 text-xs text-slate-500 flex items-center gap-3">
                      {it.producto_codigo && <span className="font-mono">SKU: {it.producto_codigo}</span>}
                      {it.observaciones && <span>· {it.observaciones}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Acciones de gestión */}
          {puedeGestionar && transicionesPosibles.length > 0 && (
            <div className="mt-4 p-4 bg-slate-950 border border-slate-700 rounded-lg">
              <div className="text-sm font-medium text-slate-200 mb-2">Cambiar estado</div>
              <div className="flex flex-wrap gap-2 mb-3">
                {transicionesPosibles.map(t => (
                  <button
                    key={t}
                    onClick={() => setAccion(t)}
                    className={`px-3 py-1.5 rounded text-sm transition border ${
                      accion === t
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    → {ESTADO_LABEL[t]}
                  </button>
                ))}
              </div>

              {accion && (
                <div className="space-y-3">
                  {(accion === 'cancelada' || accion === 'comprada') && (
                    <input
                      placeholder={accion === 'cancelada' ? 'Motivo de cancelación' : 'Notas (referencia OC, proveedor)'}
                      value={motivo}
                      onChange={e => setMotivo(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  )}

                  {accion === 'recibida' && (
                    <>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Fecha de ingreso</label>
                        <input
                          type="date"
                          value={fechaIngreso}
                          onChange={e => setFechaIngreso(e.target.value)}
                          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Cantidades recibidas (si algún item se compone como producto, genera movimiento de entrada al stock)</label>
                        <div className="space-y-1">
                          {solicitud.items.map(it => (
                            <div key={it.id} className="flex items-center gap-2 text-sm">
                              <span className="flex-1 text-slate-300 truncate">{it.descripcion}</span>
                              <input
                                type="number"
                                value={itemsRecibidos[it.id]}
                                onChange={e => setItemsRecibidos(m => ({ ...m, [it.id]: e.target.value }))}
                                className="w-24 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 text-right"
                              />
                              <span className="text-xs text-slate-500 w-12">{it.unidad}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <button
                    onClick={ejecutar}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm transition disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Confirmar
                  </button>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-md text-sm text-red-300">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end p-4 border-t border-slate-800 bg-slate-900/60">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-300 hover:text-slate-100">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
