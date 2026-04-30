'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Repeat, RefreshCw, Zap, CheckCircle, Search, X, Play,
  ArrowRight, AlertCircle, Package,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useWmsToast } from './useWmsToast';
import {
  escanearReposicionesNecesarias,
  ejecutarReposicion,
  type TareaReposicion,
} from '@/lib/wms-replenishment';
import { cn } from '@/lib/utils';

type EstadoTarea = 'pendiente' | 'asignada' | 'en_proceso' | 'ejecutada' | 'cancelada';

export default function Reposicion() {
  const { user } = useAuth(false);
  const toast = useWmsToast();
  const [loading, setLoading] = useState(true);
  const [escaneando, setEscaneando] = useState(false);
  const [tareas, setTareas] = useState<TareaReposicion[]>([]);
  const [filtro, setFiltro] = useState<EstadoTarea | 'todas'>('pendiente');
  const [search, setSearch] = useState('');
  const [ejecutando, setEjecutando] = useState<string | null>(null);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('wms_tareas_reposicion')
        .select('*')
        .order('prioridad', { ascending: true })
        .order('fecha_creacion', { ascending: false })
        .limit(200);
      setTareas((data || []) as TareaReposicion[]);
    } finally {
      setLoading(false);
    }
  };

  const escanear = async () => {
    setEscaneando(true);
    try {
      const creadas = await escanearReposicionesNecesarias(user?.email || '');
      if (creadas === 0) {
        toast.success('Sin reposiciones nuevas — todas las ubicaciones picking están sobre el mínimo');
      } else {
        toast.success(`${creadas} tarea(s) de reposición generadas`);
      }
      await loadData();
    } catch (e: any) {
      toast.error(e.message || 'Error al escanear');
    } finally {
      setEscaneando(false);
    }
  };

  const ejecutar = async (tarea: TareaReposicion) => {
    const cantidad = cantidades[tarea.id] || tarea.cantidad_sugerida;
    if (cantidad <= 0) {
      toast.warning('Cantidad inválida');
      return;
    }
    setEjecutando(tarea.id);
    try {
      const ok = await ejecutarReposicion(tarea.id, cantidad, user?.email || '');
      if (ok) {
        toast.success(`Reposición ejecutada: ${cantidad} uds`);
        await loadData();
      } else {
        toast.error('No se pudo ejecutar la reposición');
      }
    } finally {
      setEjecutando(null);
    }
  };

  const cancelar = async (tarea: TareaReposicion) => {
    await supabase.from('wms_tareas_reposicion')
      .update({ estado: 'cancelada' })
      .eq('id', tarea.id);
    toast.success('Tarea cancelada');
    await loadData();
  };

  const filtradas = useMemo(() => {
    return tareas.filter(t => {
      if (filtro !== 'todas' && t.estado !== filtro) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!(t.producto_codigo?.toLowerCase().includes(s) ||
              t.ubicacion_destino_codigo?.toLowerCase().includes(s) ||
              t.numero?.toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [tareas, filtro, search]);

  const stats = useMemo(() => ({
    pendientes: tareas.filter(t => t.estado === 'pendiente').length,
    enProceso: tareas.filter(t => t.estado === 'en_proceso' || t.estado === 'asignada').length,
    sinOrigen: tareas.filter(t => t.estado === 'pendiente' && !t.ubicacion_origen_id).length,
  }), [tareas]);

  if (loading) {
    return <div className="flex items-center justify-center p-12"><RefreshCw className="h-8 w-8 animate-spin text-cyan-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <toast.Toast />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Repeat className="h-6 w-6 text-cyan-400" />
            Reposición automática
          </h3>
          <p className="text-sm text-slate-400 mt-0.5">
            Pick-from-bulk: detecta ubicaciones picking bajo mínimo y propone reabastecerlas desde almacenamiento.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={escanear}
            disabled={escaneando}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium"
          >
            {escaneando ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {escaneando ? 'Escaneando...' : 'Detectar reposiciones'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Pendientes" value={stats.pendientes} color="text-amber-300" />
        <Kpi label="En proceso" value={stats.enProceso} color="text-blue-300" />
        <Kpi label="Sin origen (no hay bulk)" value={stats.sinOrigen} color="text-red-300" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por producto, destino o número"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm" />
        </div>
        <select value={filtro} onChange={e => setFiltro(e.target.value as any)}
          className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm">
          <option value="todas">Todas</option>
          <option value="pendiente">Pendientes</option>
          <option value="en_proceso">En proceso</option>
          <option value="ejecutada">Ejecutadas</option>
          <option value="cancelada">Canceladas</option>
        </select>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 border-b border-slate-800">
              <tr className="text-left text-xs text-slate-400 uppercase">
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">Origen → Destino</th>
                <th className="px-4 py-3">Sugerido</th>
                <th className="px-4 py-3">Real</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtradas.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-500 text-sm">
                  Sin tareas. Usá <strong>Detectar reposiciones</strong> arriba para escanear.
                </td></tr>
              ) : filtradas.map(t => (
                <tr key={t.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <div className="font-mono text-slate-200">{t.producto_codigo}</div>
                    {t.producto_nombre && <div className="text-xs text-slate-500">{t.producto_nombre}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className={t.ubicacion_origen_codigo ? 'text-slate-300' : 'text-red-400 italic'}>
                        {t.ubicacion_origen_codigo || 'Sin bulk'}
                      </span>
                      <ArrowRight className="h-3 w-3 text-slate-500" />
                      <span className="text-cyan-300 font-medium">{t.ubicacion_destino_codigo}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-200 font-medium">{t.cantidad_sugerida}</td>
                  <td className="px-4 py-3">
                    {t.estado === 'ejecutada' ? (
                      <span className="text-emerald-300">{t.cantidad_ejecutada}</span>
                    ) : t.estado === 'pendiente' ? (
                      <input
                        type="number"
                        min={0}
                        max={t.cantidad_sugerida}
                        value={cantidades[t.id] ?? t.cantidad_sugerida}
                        onChange={e => setCantidades({ ...cantidades, [t.id]: parseFloat(e.target.value) || 0 })}
                        className="w-20 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
                      />
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex px-2 py-0.5 rounded text-xs',
                      t.estado === 'ejecutada' ? 'bg-emerald-500/15 text-emerald-300' :
                      t.estado === 'cancelada' ? 'bg-slate-500/15 text-slate-400' :
                      t.estado === 'pendiente' ? 'bg-amber-500/15 text-amber-300' :
                      'bg-blue-500/15 text-blue-300'
                    )}>
                      {t.estado}
                    </span>
                    {t.motivo === 'bajo_minimo' && t.estado === 'pendiente' && (
                      <div className="text-[10px] text-orange-400 mt-0.5 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        bajo mínimo
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {t.estado === 'pendiente' && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          disabled={ejecutando === t.id || !t.ubicacion_origen_id}
                          onClick={() => ejecutar(t)}
                          title={t.ubicacion_origen_id ? 'Ejecutar reposición' : 'No hay ubicación bulk con stock'}
                          className="px-2.5 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 disabled:opacity-30 text-cyan-300 text-xs font-medium rounded-lg flex items-center gap-1"
                        >
                          {ejecutando === t.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                          Ejecutar
                        </button>
                        <button
                          onClick={() => cancelar(t)}
                          className="px-2 py-1 hover:bg-slate-700 text-slate-400 hover:text-red-400 text-xs rounded"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={cn('text-2xl font-bold', color)}>{value}</div>
    </div>
  );
}
