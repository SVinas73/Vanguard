'use client';

import React, { useState } from 'react';
import { X, AlertCircle, Loader2, Calendar, User, Tag, ClipboardList, FileDown, Building2, Pencil, History } from 'lucide-react';
import { LinkifiedText } from '@/components/ui/LinkifiedText';
import { puedeAprobarProveedor, aprobadorRequerido, labelProveedor } from '@/lib/insumos/proveedores';
import EditarSolicitudInsumoModal from './EditarSolicitudInsumoModal';

interface ItemSolicitud {
  id: number;
  producto_codigo?: string | null;
  descripcion: string;
  cantidad: number;
  unidad?: string;
  observaciones?: string | null;
  cantidad_recibida?: number | null;
  costo_estimado?: number | null;
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
  proveedor?: string | null;
  proveedor_nombre?: string | null;
  modificado_por?: string | null;
  modificado_at?: string | null;
  items: ItemSolicitud[];
}

const ESTADO_LABEL: Record<Solicitud['estado'], string> = {
  pendiente: 'Pendiente',
  en_gestion: 'Aprobado',
  comprada: 'Comprada',
  recibida: 'Recibida',
  cerrada: 'Cerrada',
  cancelada: 'Cancelada',
};

// Flujo lineal estricto: pendiente → en_gestion → comprada → recibida → cerrada.
// Cancelar disponible en cualquier estado activo (decisión de negocio).
// NO se puede saltear etapas: ej. desde en_gestion no se puede pasar
// directo a 'recibida' sin pasar por 'comprada'.
const TRANSICIONES: Record<Solicitud['estado'], Solicitud['estado'][]> = {
  pendiente:  ['en_gestion', 'cancelada'],
  en_gestion: ['comprada', 'cancelada'],
  comprada:   ['recibida', 'cancelada'],
  recibida:   ['cerrada'],
  cerrada:    [],
  cancelada:  [],
};

interface Props {
  solicitud: Solicitud;
  puedeGestionar: boolean;
  /** Email del usuario actual (para el gate de aprobación por proveedor). */
  currentUserEmail?: string | null;
  /** Solo los admins pueden EDITAR el contenido de la solicitud. */
  isAdmin?: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export default function DetalleSolicitudInsumoModal({ solicitud, puedeGestionar, currentUserEmail, isAdmin, onClose, onChanged }: Props) {
  const [showEditar, setShowEditar] = useState(false);
  // ¿Este usuario puede aprobar (pendiente→en_gestion) según el proveedor?
  const puedeAprobar = puedeAprobarProveedor(solicitud.proveedor, currentUserEmail);
  // La edición solo aplica antes de comprar.
  const editable = isAdmin && (solicitud.estado === 'pendiente' || solicitud.estado === 'en_gestion');
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
  // Costo unitario confirmado al recibir, prellenado con el estimado de la solicitud.
  const [costosUnitarios, setCostosUnitarios] = useState<Record<number, string>>(() => {
    const m: Record<number, string> = {};
    for (const it of solicitud.items) {
      m[it.id] = it.costo_estimado != null ? String(it.costo_estimado) : '';
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
          costo_unitario: costosUnitarios[it.id]?.trim() ? parseFloat(costosUnitarios[it.id]) : null,
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

      // Si la transición fue a 'recibida', el backend acaba de sumar al stock
      // (crea/actualiza productos, movimientos y lotes). Avisamos al resto
      // de la app para que refresque sin requerir reload manual.
      if (accion === 'recibida' && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vg:stock-changed', {
          detail: { source: 'solicitud-insumo', solicitudId: solicitud.id },
        }));
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
          <div className="flex items-center gap-2">
            {editable && (
              <button
                onClick={() => setShowEditar(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-sm text-slate-200"
                title="Editar solicitud (solo admins)"
              >
                <Pencil className="w-3.5 h-3.5" />
                Editar
              </button>
            )}
            <button onClick={onClose} className="text-slate-500 hover:text-slate-200">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-slate-500 mb-0.5 flex items-center gap-1"><Building2 className="w-3 h-3" /> Proveedor</div>
              <div className="text-slate-200 font-medium">{labelProveedor(solicitud.proveedor, solicitud.proveedor_nombre)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-0.5">Estado actual</div>
              <div className="text-slate-200 font-medium">{ESTADO_LABEL[solicitud.estado]}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-0.5 flex items-center gap-1"><Tag className="w-3 h-3" /> Categoría</div>
              <div className="text-slate-200 font-medium">{solicitud.categoria}</div>
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
            {solicitud.modificado_por && (
              <div className="col-span-2">
                <div className="text-xs text-slate-500 mb-0.5 flex items-center gap-1"><History className="w-3 h-3" /> Última modificación</div>
                <div className="text-slate-300 text-xs">
                  {solicitud.modificado_por}
                  {solicitud.modificado_at && <span className="text-slate-500"> · {new Date(solicitud.modificado_at).toLocaleString('es-UY')}</span>}
                </div>
              </div>
            )}
          </div>

          {solicitud.observaciones && (
            <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-md">
              <div className="text-xs text-amber-400 font-medium mb-1">Observaciones</div>
              <LinkifiedText text={solicitud.observaciones} className="text-sm text-slate-200" />
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
                {transicionesPosibles.map(t => {
                  // Aprobación (pendiente→en_gestion) bloqueada si el proveedor
                  // exige un aprobador puntual y no es el usuario actual.
                  const bloqueadoPorProveedor = t === 'en_gestion' && !puedeAprobar;
                  return (
                    <button
                      key={t}
                      disabled={bloqueadoPorProveedor}
                      onClick={() => !bloqueadoPorProveedor && setAccion(t)}
                      title={bloqueadoPorProveedor ? `Solo ${aprobadorRequerido(solicitud.proveedor)} puede aprobar este proveedor` : undefined}
                      className={`px-3 py-1.5 rounded text-sm transition border ${
                        bloqueadoPorProveedor
                          ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                          : accion === t
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      → {ESTADO_LABEL[t]}
                    </button>
                  );
                })}
              </div>
              {!puedeAprobar && aprobadorRequerido(solicitud.proveedor) && solicitud.estado === 'pendiente' && (
                <div className="text-[11px] text-amber-400 mb-2">
                  La aprobación de este proveedor es exclusiva de {aprobadorRequerido(solicitud.proveedor)}.
                </div>
              )}

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
                        <label className="block text-xs text-slate-400 mb-1">
                          Cantidades y costo unitario recibidos — confirmá o corregí antes
                          de cerrar. El costo actualiza el promedio ponderado y el historial.
                        </label>
                        <div className="space-y-2">
                          {solicitud.items.map(it => (
                            <div key={it.id} className="flex items-end gap-2 text-sm">
                              <div className="flex-1 min-w-0">
                                <div className="text-slate-300 truncate">{it.descripcion}</div>
                                <div className="text-[11px] text-slate-500">
                                  Solicitado: {it.cantidad} {it.unidad}
                                  {it.producto_codigo
                                    ? <span className="ml-2 text-emerald-400">→ entra a stock ({it.producto_codigo})</span>
                                    : <span className="ml-2 text-amber-400">→ se crea al recibir</span>
                                  }
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] text-slate-500 mb-0.5">Cantidad</div>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={itemsRecibidos[it.id]}
                                  onChange={e => setItemsRecibidos(m => ({ ...m, [it.id]: e.target.value }))}
                                  className="w-20 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 text-right"
                                />
                              </div>
                              <div>
                                <div className="text-[10px] text-slate-500 mb-0.5">Costo unit.</div>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={costosUnitarios[it.id] ?? ''}
                                  onChange={e => setCostosUnitarios(m => ({ ...m, [it.id]: e.target.value }))}
                                  placeholder="0.00"
                                  className="w-24 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 text-right"
                                />
                              </div>
                              <span className="text-xs text-slate-500 w-10 pb-1.5">{it.unidad}</span>
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

        <div className="flex justify-between items-center p-4 border-t border-slate-800 bg-slate-900/60">
          <a
            href={`/api/insumos/solicitudes/${solicitud.id}/pdf`}
            download={`solicitud-${solicitud.numero}.pdf`}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-sm text-slate-200"
          >
            <FileDown className="w-4 h-4" />
            Descargar PDF
          </a>
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-300 hover:text-slate-100">
            Cerrar
          </button>
        </div>
      </div>

      {showEditar && (
        <EditarSolicitudInsumoModal
          solicitud={{
            id: solicitud.id,
            numero: solicitud.numero,
            categoria: solicitud.categoria,
            proveedor: solicitud.proveedor,
            proveedor_nombre: solicitud.proveedor_nombre,
            fecha_limite: solicitud.fecha_limite,
            observaciones: solicitud.observaciones,
            items: solicitud.items.map(it => ({
              id: it.id,
              descripcion: it.descripcion,
              cantidad: it.cantidad,
              unidad: it.unidad,
              observaciones: it.observaciones,
            })),
          }}
          onClose={() => setShowEditar(false)}
          onSaved={() => { setShowEditar(false); onChanged(); }}
        />
      )}
    </div>
  );
}
