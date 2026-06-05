'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useOrganizacion } from '@/hooks/useOrganizacion';
import { useAuth } from '@/hooks/useAuth';
import DetalleSolicitudInsumoModal from './DetalleSolicitudInsumoModal';
import { Package, RefreshCw, Search, Clock, AlertTriangle, ChevronRight } from 'lucide-react';

// =====================================================
// Insumos pendientes de aprobación (desglose por item)
// =====================================================
// Muestra TODOS los items de insumos que están en solicitudes PENDIENTES de
// aprobación, sin importar la solicitud. En cuanto la solicitud se aprueba
// (pasa de 'pendiente' a 'en_gestion'), sus items desaparecen de esta vista.

interface ItemSolicitud {
  id: number;
  descripcion: string;
  cantidad: number;
  unidad?: string;
  producto_codigo?: string | null;
  observaciones?: string | null;
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

interface ItemPendiente extends ItemSolicitud {
  solicitud: Solicitud;
  solicitudNumero: string;
  solicitante: string;
  categoria: string;
  fechaSolicitud: string;
  fechaLimite?: string | null;
}

export default function InsumosPendientes() {
  const { orgActivaId } = useOrganizacion();
  const { user } = useAuth(false);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [detalle, setDetalle] = useState<Solicitud | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      // Solo solicitudes PENDIENTES de aprobación, filtradas por la org activa
      // (la API incluye además las solicitudes sin organización).
      const params = new URLSearchParams({ limit: '200', estado: 'pendiente' });
      if (orgActivaId) params.set('organizacion_id', orgActivaId);
      const resp = await fetch(`/api/insumos/solicitudes?${params}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setSolicitudes(data.solicitudes || []);
    } catch (e: any) {
      setError(e.message || 'No se pudieron cargar los insumos pendientes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [orgActivaId]);

  // Desglosar: un renglón por item, de las solicitudes pendientes.
  const items = useMemo<ItemPendiente[]>(() => {
    const out: ItemPendiente[] = [];
    for (const s of solicitudes) {
      if (s.estado !== 'pendiente') continue; // refuerzo: solo pendientes
      for (const it of s.items || []) {
        out.push({
          ...it,
          solicitud: s,
          solicitudNumero: s.numero,
          solicitante: s.solicitado_por,
          categoria: s.categoria,
          fechaSolicitud: s.fecha_solicitud,
          fechaLimite: s.fecha_limite,
        });
      }
    }
    return out;
  }, [solicitudes]);

  const filtrados = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(i =>
      i.descripcion?.toLowerCase().includes(q) ||
      i.solicitudNumero?.toLowerCase().includes(q) ||
      i.solicitante?.toLowerCase().includes(q) ||
      (i.producto_codigo || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  // Consolidado por descripción (cuántas unidades pendientes en total).
  const totalUnidades = useMemo(
    () => filtrados.reduce((s, i) => s + (Number(i.cantidad) || 0), 0),
    [filtrados]
  );

  const fmtFecha = (f?: string | null) => f ? new Date(f).toLocaleDateString('es-UY') : '—';
  const vencida = (f?: string | null) => !!f && new Date(f) < new Date();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-400" /> Insumos pendientes de aprobación
          </h3>
          <p className="text-sm text-slate-500">Desglose de todos los insumos en solicitudes aún no aprobadas. Al aprobar la solicitud, desaparecen de acá.</p>
        </div>
        <button onClick={cargar} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">Items pendientes</div>
          <div className="text-2xl font-bold text-amber-400">{items.length}</div>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">Unidades pendientes</div>
          <div className="text-2xl font-bold text-slate-100">{totalUnidades}</div>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">Solicitudes pendientes</div>
          <div className="text-2xl font-bold text-slate-100">{solicitudes.length}</div>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar insumo, solicitud o solicitante…"
          className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-200" />
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-md text-sm text-red-300">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-10 text-center text-slate-500 text-sm">Cargando…</div>
        ) : filtrados.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-sm flex flex-col items-center gap-2">
            <Package className="h-8 w-8 opacity-40" />
            No hay insumos pendientes de aprobación.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-900/80 text-slate-400 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Insumo</th>
                <th className="px-4 py-2 text-center">Cantidad</th>
                <th className="px-4 py-2 text-left">Solicitud</th>
                <th className="px-4 py-2 text-left">Solicitante</th>
                <th className="px-4 py-2 text-left">Categoría</th>
                <th className="px-4 py-2 text-left">Fecha límite</th>
                <th className="px-4 py-2 text-right">Solicitud</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filtrados.map((i) => (
                <tr
                  key={`${i.solicitudNumero}-${i.id}`}
                  className="hover:bg-slate-800/30 cursor-pointer"
                  onClick={() => setDetalle(i.solicitud)}
                  title="Ver la solicitud de origen"
                >
                  <td className="px-4 py-2.5">
                    <div className="text-slate-200">{i.descripcion}</div>
                    {i.observaciones && <div className="text-[11px] text-slate-500">{i.observaciones}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-center text-slate-300">{i.cantidad} {i.unidad || ''}</td>
                  <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">{i.solicitudNumero}</td>
                  <td className="px-4 py-2.5 text-slate-400">{i.solicitante}</td>
                  <td className="px-4 py-2.5 text-slate-400">{i.categoria}</td>
                  <td className={`px-4 py-2.5 ${vencida(i.fechaLimite) ? 'text-red-400' : 'text-slate-400'}`}>{fmtFecha(i.fechaLimite)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="inline-flex items-center gap-1 text-xs text-blue-400">Ver <ChevronRight className="h-3.5 w-3.5" /></span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detalle de la solicitud de origen */}
      {detalle && (
        <DetalleSolicitudInsumoModal
          solicitud={detalle as any}
          puedeGestionar={user?.email === detalle.gestor_asignado || (user as any)?.rol === 'admin'}
          onClose={() => setDetalle(null)}
          onChanged={() => { setDetalle(null); cargar(); }}
        />
      )}
    </div>
  );
}
