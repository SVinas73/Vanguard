'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { cn, formatDate } from '@/lib/utils';
import {
  Activity,
  Plus,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  MessageSquare,
  User,
  AlertTriangle,
  Edit3,
  Trash2,
  Clock,
  Filter,
  RefreshCw,
} from 'lucide-react';

interface Actividad {
  id: string;
  proyectoId: string;
  tareaId: string | null;
  tipo: string;
  accion: string;
  campoModificado: string | null;
  valorAnterior: string | null;
  valorNuevo: string | null;
  usuarioEmail: string;
  creadoAt: Date;
  tareaTitulo?: string;
}

interface ActividadFeedProps {
  proyectoId: string;
  tareaId?: string; // Si se pasa, filtra solo esa tarea
  limit?: number;
  showFilters?: boolean;
  compact?: boolean;
}

const tipoIconos: Record<string, React.ReactNode> = {
  tarea_creada: <Plus size={14} className="text-emerald-400" />,
  tarea_movida: <ArrowRight size={14} className="text-blue-400" />,
  tarea_completada: <CheckCircle2 size={14} className="text-emerald-400" />,
  tarea_reabierta: <RotateCcw size={14} className="text-amber-400" />,
  tarea_modificada: <Edit3 size={14} className="text-slate-400" />,
  tarea_eliminada: <Trash2 size={14} className="text-red-400" />,
  tarea_asignada: <User size={14} className="text-purple-400" />,
  comentario_agregado: <MessageSquare size={14} className="text-cyan-400" />,
  subtarea_completada: <CheckCircle2 size={14} className="text-emerald-400" />,
};

const tipoColores: Record<string, string> = {
  tarea_creada: 'border-emerald-500/30 bg-emerald-500/10',
  tarea_movida: 'border-blue-500/30 bg-blue-500/10',
  tarea_completada: 'border-emerald-500/30 bg-emerald-500/10',
  tarea_reabierta: 'border-amber-500/30 bg-amber-500/10',
  tarea_modificada: 'border-slate-500/30 bg-slate-500/10',
  tarea_eliminada: 'border-red-500/30 bg-red-500/10',
  tarea_asignada: 'border-purple-500/30 bg-purple-500/10',
  comentario_agregado: 'border-cyan-500/30 bg-cyan-500/10',
};

export function ActividadFeed({ 
  proyectoId, 
  tareaId, 
  limit = 50, 
  showFilters = true,
  compact = false 
}: ActividadFeedProps) {
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<string>('');
  const [filtroUsuario, setFiltroUsuario] = useState<string>('');

  useEffect(() => {
    fetchActividades();
  }, [proyectoId, tareaId]);

  const fetchActividades = async () => {
    setLoading(true);

    let query = supabase
      .from('proyecto_actividades')
      .select(`
        *,
        tarea:proyecto_tareas(titulo)
      `)
      .eq('proyecto_id', proyectoId)
      .order('creado_at', { ascending: false })
      .limit(limit);

    if (tareaId) {
      query = query.eq('tarea_id', tareaId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error cargando actividades:', error);
    } else {
      setActividades((data || []).map(a => ({
        id: a.id,
        proyectoId: a.proyecto_id,
        tareaId: a.tarea_id,
        tipo: a.tipo,
        accion: a.accion,
        campoModificado: a.campo_modificado,
        valorAnterior: a.valor_anterior,
        valorNuevo: a.valor_nuevo,
        usuarioEmail: a.usuario_email,
        creadoAt: new Date(a.creado_at),
        tareaTitulo: a.tarea?.titulo,
      })));
    }

    setLoading(false);
  };

  // Obtener usuarios únicos
  const usuariosUnicos = [...new Set(actividades.map(a => a.usuarioEmail))];
  
  // Obtener tipos únicos
  const tiposUnicos = [...new Set(actividades.map(a => a.tipo))];

  // Filtrar actividades
  const actividadesFiltradas = actividades.filter(a => {
    if (filtroTipo && a.tipo !== filtroTipo) return false;
    if (filtroUsuario && a.usuarioEmail !== filtroUsuario) return false;
    return true;
  });

  // Agrupar por fecha
  const actividadesPorFecha = actividadesFiltradas.reduce((acc, actividad) => {
    const fecha = actividad.creadoAt.toLocaleDateString('es-AR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!acc[fecha]) acc[fecha] = [];
    acc[fecha].push(actividad);
    return acc;
  }, {} as Record<string, Actividad[]>);

  const formatTiempoRelativo = (fecha: Date) => {
    const ahora = new Date();
    const diff = ahora.getTime() - fecha.getTime();
    const minutos = Math.floor(diff / 60000);
    const horas = Math.floor(diff / 3600000);
    const dias = Math.floor(diff / 86400000);

    if (minutos < 1) return 'ahora mismo';
    if (minutos < 60) return `hace ${minutos} min`;
    if (horas < 24) return `hace ${horas}h`;
    if (dias < 7) return `hace ${dias}d`;
    return fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  };

  const getIniciales = (email: string) => {
    const nombre = email.split('@')[0];
    return nombre.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw size={20} className="animate-spin text-emerald-400" />
        <span className="ml-2 text-slate-400">Cargando actividad...</span>
      </div>
    );
  }

  if (actividades.length === 0) {
    return (
      <div className="text-center py-12">
        <Activity size={48} className="mx-auto mb-4 text-slate-600" />
        <p className="text-slate-500">No hay actividad registrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      {showFilters && !compact && (
        <div className="flex gap-3 items-center pb-4 border-b border-slate-700/50">
          <Filter size={16} className="text-slate-500" />
          
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-sm focus:outline-none focus:border-emerald-500/50"
          >
            <option value="">Todas las acciones</option>
            {tiposUnicos.map(tipo => (
              <option key={tipo} value={tipo}>
                {tipo.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          <select
            value={filtroUsuario}
            onChange={(e) => setFiltroUsuario(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-sm focus:outline-none focus:border-emerald-500/50"
          >
            <option value="">Todos los usuarios</option>
            {usuariosUnicos.map(usuario => (
              <option key={usuario} value={usuario}>{usuario}</option>
            ))}
          </select>

          <button
            onClick={fetchActividades}
            className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
            title="Actualizar"
          >
            <RefreshCw size={16} />
          </button>

          <span className="text-xs text-slate-500 ml-auto">
            {actividadesFiltradas.length} actividades
          </span>
        </div>
      )}

      {/* Lista de actividades */}
      {compact ? (
        // Vista compacta (para sidebar o modal)
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {actividadesFiltradas.slice(0, 20).map(actividad => (
            <div
              key={actividad.id}
              className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-800/30 transition-colors"
            >
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
                tipoColores[actividad.tipo] || 'border-slate-500/30 bg-slate-500/10'
              )}>
                {tipoIconos[actividad.tipo] || <Activity size={12} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-300 truncate">
                  <span className="font-medium">{actividad.usuarioEmail.split('@')[0]}</span>
                  {' '}{actividad.accion}
                </p>
                <span className="text-xs text-slate-500">
                  {formatTiempoRelativo(actividad.creadoAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Vista completa con agrupación por fecha
        <div className="space-y-6">
          {Object.entries(actividadesPorFecha).map(([fecha, acts]) => (
            <div key={fecha}>
              <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3 sticky top-0 bg-slate-900/95 py-2 backdrop-blur-sm">
                {fecha}
              </h4>
              
              <div className="space-y-3 pl-4 border-l-2 border-slate-700/50">
                {acts.map(actividad => (
                  <div
                    key={actividad.id}
                    className="relative flex items-start gap-3 group"
                  >
                    {/* Punto en la línea de tiempo */}
                    <div className={cn(
                      'absolute -left-[25px] w-4 h-4 rounded-full border-2 flex items-center justify-center',
                      tipoColores[actividad.tipo] || 'border-slate-600 bg-slate-800'
                    )}>
                      <div className="w-1.5 h-1.5 rounded-full bg-current" />
                    </div>

                    {/* Avatar */}
                    <div 
                      className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-400 flex-shrink-0"
                      title={actividad.usuarioEmail}
                    >
                      {getIniciales(actividad.usuarioEmail)}
                    </div>

                    {/* Contenido */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-slate-200">
                          {actividad.usuarioEmail.split('@')[0]}
                        </span>
                        <span className="text-sm text-slate-400">
                          {actividad.accion}
                        </span>
                        {actividad.tareaTitulo && !tareaId && (
                          <span className="text-sm text-emerald-400 truncate max-w-[200px]">
                            "{actividad.tareaTitulo}"
                          </span>
                        )}
                      </div>

                      {/* Detalles del cambio */}
                      {actividad.campoModificado && actividad.valorAnterior && actividad.valorNuevo && (
                        <div className="mt-1 text-xs text-slate-500 flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 line-through">
                            {actividad.valorAnterior}
                          </span>
                          <ArrowRight size={12} />
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                            {actividad.valorNuevo}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-1">
                        <Clock size={12} className="text-slate-600" />
                        <span className="text-xs text-slate-500">
                          {actividad.creadoAt.toLocaleTimeString('es-AR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Icono de tipo */}
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity',
                      tipoColores[actividad.tipo] || 'bg-slate-700/50'
                    )}>
                      {tipoIconos[actividad.tipo] || <Activity size={16} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cargar más */}
      {actividadesFiltradas.length >= limit && (
        <button
          onClick={() => {/* Implementar paginación */}}
          className="w-full py-2 text-sm text-slate-400 hover:text-emerald-400 transition-colors"
        >
          Cargar más actividad...
        </button>
      )}
    </div>
  );
}

// Componente helper para usar en otros lugares
export function ActividadReciente({ proyectoId }: { proyectoId: string }) {
  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Activity size={18} className="text-emerald-400" />
        Actividad Reciente
      </h3>
      <ActividadFeed 
        proyectoId={proyectoId} 
        limit={10} 
        showFilters={false}
        compact={true}
      />
    </div>
  );
}