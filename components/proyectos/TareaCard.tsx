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
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  Lock,
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
  } = useSortable({ id: tarea.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Prioridad colors
  const prioridadConfig = {
    urgente: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
    alta: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
    media: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
    baja: { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30' },
  };

  const prioridad = prioridadConfig[tarea.prioridad];

  // Fecha límite warning
  const isOverdue = tarea.fechaLimite && new Date(tarea.fechaLimite) < new Date() && !tarea.completado;
  const isDueSoon = tarea.fechaLimite && 
    new Date(tarea.fechaLimite) > new Date() && 
    new Date(tarea.fechaLimite).getTime() - new Date().getTime() < 24 * 60 * 60 * 1000;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 cursor-pointer transition-all hover:border-slate-600/50 hover:bg-slate-800/70 group',
        tarea.completado && 'opacity-60',
        tarea.bloqueado && 'border-red-500/50',
        (isDragging || isSortableDragging) && 'opacity-50 rotate-3 scale-105 shadow-xl',
      )}
    >
      {/* Header con prioridad */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {tarea.bloqueado && (
              <Lock size={14} className="text-red-400 flex-shrink-0" />
            )}
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full font-medium',
                prioridad.bg,
                prioridad.text
              )}
            >
              {tarea.prioridad}
            </span>
          </div>
          <h4 className={cn(
            'text-sm font-medium',
            tarea.completado && 'line-through text-slate-500'
          )}>
            {tarea.titulo}
          </h4>
        </div>

        {tarea.completado && (
          <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
        )}
      </div>

      {/* Descripción */}
      {tarea.descripcion && (
        <p className="text-xs text-slate-400 mb-3 line-clamp-2">
          {tarea.descripcion}
        </p>
      )}

      {/* Etiquetas */}
      {tarea.etiquetas && tarea.etiquetas.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {tarea.etiquetas.map(etiqueta => (
            <span
              key={etiqueta.id}
              className="px-2 py-0.5 text-xs rounded-full border"
              style={{
                backgroundColor: `${etiqueta.color}20`,
                borderColor: `${etiqueta.color}40`,
                color: etiqueta.color,
              }}
            >
              {etiqueta.nombre}
            </span>
          ))}
        </div>
      )}

      {/* Progreso bar */}
      {tarea.progreso > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">Progreso</span>
            <span className="text-xs text-slate-400 font-medium">{tarea.progreso}%</span>
          </div>
          <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${tarea.progreso}%` }}
            />
          </div>
        </div>
      )}

      {/* Subtareas */}
      {tarea.subtareas && tarea.subtareas.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
          <CheckCircle2 size={14} />
          <span>
            {tarea.subtareas.filter(s => s.completado).length}/{tarea.subtareas.length} subtareas
          </span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
        <div className="flex items-center gap-3">
          {/* Fecha límite */}
          {tarea.fechaLimite && (
            <div
              className={cn(
                'flex items-center gap-1 text-xs',
                isOverdue && 'text-red-400',
                isDueSoon && 'text-amber-400',
                !isOverdue && !isDueSoon && 'text-slate-500'
              )}
            >
              <Calendar size={12} />
              <span>{formatDate(tarea.fechaLimite)}</span>
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
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
              {tarea.asignadoA.charAt(0).toUpperCase()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}