'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import type { ProyectoTarea } from '@/types';
import {
  Calendar,
  Paperclip,
  MessageSquare,
  CheckCircle2,
  Clock,
  Lock,
  GripVertical,
} from 'lucide-react';

interface TareaCardProps {
  tarea: ProyectoTarea;
  onClick: () => void;
  isDragging?: boolean;
}

export function TareaCard({ tarea, onClick, isDragging }: TareaCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ 
    id: tarea.id,
    data: {
      type: 'tarea',
      tarea,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isBeingDragged = isDragging || isSortableDragging;

  // Prioridad colors
  const prioridadConfig = {
    urgente: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', dot: 'bg-red-500' },
    alta: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30', dot: 'bg-orange-500' },
    media: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', dot: 'bg-blue-500' },
    baja: { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30', dot: 'bg-slate-500' },
  };

  const prioridad = prioridadConfig[tarea.prioridad];

  // Fecha límite warning
  const now = new Date();
  const fechaLimite = tarea.fechaLimite ? new Date(tarea.fechaLimite) : null;
  const isOverdue = fechaLimite && fechaLimite < now && !tarea.completado;
  const isDueSoon = fechaLimite && 
    fechaLimite > now && 
    fechaLimite.getTime() - now.getTime() < 24 * 60 * 60 * 1000 &&
    !tarea.completado;

  // Calcular progreso de subtareas
  const subtareasTotal = tarea.subtareas?.length || 0;
  const subtareasCompletadas = tarea.subtareas?.filter(s => s.completado).length || 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 transition-all',
        'hover:border-slate-600/50 hover:bg-slate-800/70 hover:shadow-lg',
        tarea.completado && 'opacity-60',
        tarea.bloqueado && 'border-red-500/30 bg-red-500/5',
        isBeingDragged && 'opacity-0',
      )}
    >
      {/* Drag handle + Content wrapper */}
      <div className="flex gap-2">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="flex-shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity pt-1"
        >
          <GripVertical size={16} className="text-slate-500" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0" onClick={onClick}>
          {/* Header con prioridad */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              {tarea.bloqueado && (
                <Lock size={14} className="text-red-400 flex-shrink-0" />
              )}
              <div className="flex items-center gap-1.5">
                <div className={cn('w-2 h-2 rounded-full', prioridad.dot)} />
                <span className={cn('text-xs font-medium capitalize', prioridad.text)}>
                  {tarea.prioridad}
                </span>
              </div>
            </div>

            {tarea.completado && (
              <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
            )}
          </div>

          {/* Título */}
          <h4 
            className={cn(
              'text-sm font-medium mb-2 cursor-pointer hover:text-emerald-400 transition-colors',
              tarea.completado && 'line-through text-slate-500'
            )}
          >
            {tarea.titulo}
          </h4>

          {/* Descripción */}
          {tarea.descripcion && (
            <p className="text-xs text-slate-400 mb-3 line-clamp-2">
              {tarea.descripcion}
            </p>
          )}

          {/* Etiquetas */}
          {tarea.etiquetas && tarea.etiquetas.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {tarea.etiquetas.slice(0, 3).map(etiqueta => (
                <span
                  key={etiqueta.id}
                  className="px-2 py-0.5 text-xs rounded-full border font-medium"
                  style={{
                    backgroundColor: `${etiqueta.color}15`,
                    borderColor: `${etiqueta.color}30`,
                    color: etiqueta.color,
                  }}
                >
                  {etiqueta.nombre}
                </span>
              ))}
              {tarea.etiquetas.length > 3 && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-slate-700/50 text-slate-400">
                  +{tarea.etiquetas.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Progreso bar */}
          {tarea.progreso > 0 && tarea.progreso < 100 && (
            <div className="mb-3">
              <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all duration-300',
                    tarea.progreso >= 75 ? 'bg-emerald-500' : 
                    tarea.progreso >= 50 ? 'bg-blue-500' : 
                    tarea.progreso >= 25 ? 'bg-amber-500' : 'bg-slate-500'
                  )}
                  style={{ width: `${tarea.progreso}%` }}
                />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-700/30">
            <div className="flex items-center gap-3">
              {/* Fecha límite */}
              {fechaLimite && (
                <div
                  className={cn(
                    'flex items-center gap-1 text-xs',
                    isOverdue && 'text-red-400',
                    isDueSoon && 'text-amber-400',
                    !isOverdue && !isDueSoon && 'text-slate-500'
                  )}
                >
                  <Calendar size={12} />
                  <span>{formatDate(fechaLimite)}</span>
                </div>
              )}

              {/* Subtareas */}
              {subtareasTotal > 0 && (
                <div className={cn(
                  'flex items-center gap-1 text-xs',
                  subtareasCompletadas === subtareasTotal ? 'text-emerald-400' : 'text-slate-500'
                )}>
                  <CheckCircle2 size={12} />
                  <span>{subtareasCompletadas}/{subtareasTotal}</span>
                </div>
              )}

              {/* Tiempo estimado */}
              {tarea.tiempoEstimadoHoras && (
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock size={12} />
                  <span>{tarea.tiempoEstimadoHoras}h</span>
                </div>
              )}

              {/* Comentarios */}
              {tarea.comentarios && tarea.comentarios.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <MessageSquare size={12} />
                  <span>{tarea.comentarios.length}</span>
                </div>
              )}

              {/* Adjuntos */}
              {tarea.adjuntos && tarea.adjuntos.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Paperclip size={12} />
                  <span>{tarea.adjuntos.length}</span>
                </div>
              )}
            </div>

            {/* Asignado */}
            {tarea.asignadoA && (
              <div 
                className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold border border-emerald-500/30"
                title={tarea.asignadoA}
              >
                {tarea.asignadoA.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}