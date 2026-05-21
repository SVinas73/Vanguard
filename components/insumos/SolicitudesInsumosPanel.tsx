'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Plus, Filter, Calendar, User, Tag, RefreshCw, AlertCircle, ClipboardList, ChevronRight, Building2 } from 'lucide-react';
import { useOrganizacion } from '@/hooks/useOrganizacion';
import { useAuth } from '@/hooks/useAuth';
import CrearSolicitudInsumoModal from './CrearSolicitudInsumoModal';
import DetalleSolicitudInsumoModal from './DetalleSolicitudInsumoModal';
import { estadoEfectivo, ESTADO_LABEL as LABEL_EFECTIVO, ESTADO_COLOR as COLOR_EFECTIVO, diasParaLimite } from '@/lib/insumos/estado';

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
  organizacion_id?: string | null;
  created_at: string;
}

export default function SolicitudesInsumosPanel() {
  const { orgActivaId } = useOrganizacion();
  const { user } = useAuth(false);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCrear, setShowCrear] = useState(false);
  const [showDetalle, setShowDetalle] = useState<Solicitud | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<string>('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('');

  const fetchSolicitudes = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (orgActivaId) params.set('organizacion_id', orgActivaId);
      if (filtroEstado) params.set('estado', filtroEstado);
      if (filtroCategoria) params.set('categoria', filtroCategoria);
      const resp = await fetch(`/api/insumos/solicitudes?${params}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setSolicitudes(data.solicitudes || []);
    } catch (e: any) {
      setError(e.message || 'Error cargando solicitudes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSolicitudes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgActivaId, filtroEstado, filtroCategoria]);

  const categorias = useMemo(() => {
    return Array.from(new Set(solicitudes.map(s => s.categoria))).sort();
  }, [solicitudes]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Solicitudes de Insumos</h3>
        </div>
        <div className="flex-1" />
        <button
          onClick={fetchSolicitudes}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-sm border border-slate-700"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Actualizar
        </button>
        <button
          onClick={() => setShowCrear(true)}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm transition"
        >
          <Plus className="w-4 h-4" />
          Nueva solicitud
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center px-3 py-2 bg-slate-900 border border-slate-800 rounded-md">
        <Filter className="w-3.5 h-3.5 text-slate-500" />
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
          className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200"
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="en_gestion">Aprobado</option>
          <option value="comprada">Comprada</option>
          <option value="recibida">Recibida</option>
          <option value="cerrada">Cerrada</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <select
          value={filtroCategoria}
          onChange={e => setFiltroCategoria(e.target.value)}
          className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200"
        >
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="text-xs text-slate-500 ml-2">{solicitudes.length} resultados</span>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-md text-sm text-red-300">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-slate-500">Cargando...</div>
      )}

      {!loading && solicitudes.length === 0 && (
        <div className="text-center py-12 px-4">
          <ClipboardList className="w-12 h-12 mx-auto text-slate-700 mb-3" />
          <h4 className="text-slate-300 font-medium">No hay solicitudes</h4>
          <p className="text-sm text-slate-500 mt-1">
            Creá la primera con el botón <strong>Nueva solicitud</strong>.
            <br />
            Antes de empezar, configurá los emails que reciben cada categoría en <strong>Integraciones → Insumos</strong>.
          </p>
        </div>
      )}

      {!loading && solicitudes.length > 0 && (
        <div className="space-y-2">
          {solicitudes.map(s => (
            <button
              key={s.id}
              onClick={() => setShowDetalle(s)}
              className="w-full text-left p-4 bg-slate-900 hover:bg-slate-800/60 border border-slate-800 rounded-lg transition"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  {(() => {
                    const efectivo = estadoEfectivo(s.estado, s.fecha_limite);
                    const dias = diasParaLimite(s.fecha_limite);
                    return (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-slate-500">{s.numero}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${COLOR_EFECTIVO[efectivo]}`}>
                          {LABEL_EFECTIVO[efectivo]}
                        </span>
                        {efectivo === 'vencida' && dias !== null && (
                          <span className="text-[11px] text-red-400">hace {-dias} {-dias === 1 ? 'día' : 'días'}</span>
                        )}
                        {efectivo === 'por_vencer' && dias !== null && (
                          <span className="text-[11px] text-orange-400">en {dias} {dias === 1 ? 'día' : 'días'}</span>
                        )}
                        <span className="inline-flex items-center gap-1 text-xs text-purple-400">
                          <Tag className="w-3 h-3" />
                          {s.categoria}
                        </span>
                      </div>
                    );
                  })()}
                  <div className="mt-1.5 text-sm text-slate-200">
                    {s.items.length} {s.items.length === 1 ? 'item' : 'items'}
                    {s.items[0] && <span className="text-slate-500"> · {s.items[0].descripcion}{s.items.length > 1 ? '...' : ''}</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {s.solicitado_por}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(s.fecha_solicitud).toLocaleDateString('es-UY')}
                    </span>
                    {s.fecha_limite && (
                      <span className="inline-flex items-center gap-1 text-amber-400">
                        <Calendar className="w-3 h-3" />
                        Límite: {new Date(s.fecha_limite).toLocaleDateString('es-UY')}
                      </span>
                    )}
                    {s.fecha_ingreso && (
                      <span className="inline-flex items-center gap-1 text-emerald-400">
                        <Calendar className="w-3 h-3" />
                        Ingreso: {new Date(s.fecha_ingreso).toLocaleDateString('es-UY')}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 mt-1" />
              </div>
            </button>
          ))}
        </div>
      )}

      {showCrear && (
        <CrearSolicitudInsumoModal
          organizacionId={orgActivaId}
          onClose={() => setShowCrear(false)}
          onCreated={() => { setShowCrear(false); fetchSolicitudes(); }}
        />
      )}

      {showDetalle && (
        <DetalleSolicitudInsumoModal
          solicitud={showDetalle}
          puedeGestionar={user?.email === showDetalle.gestor_asignado || user?.rol === 'admin'}
          onClose={() => setShowDetalle(null)}
          onChanged={() => { setShowDetalle(null); fetchSolicitudes(); }}
        />
      )}
    </div>
  );
}

