'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import type { ProyectoTarea, ProyectoColumna } from '@/types';
import {
  Calendar,
  Paperclip,
  MessageSquare,
  CheckCircle2,
  Clock,
  Lock,
  GripVertical,
  MoreHorizontal,
  Edit3,
  Copy,
  Trash2,
  ArrowRight,
  CheckSquare,
  Square,
} from 'lucide-react';

interface TareaCardProps {
  tarea: ProyectoTarea;
  onClick: () => void;
  isDragging?: boolean;
  columnas?: ProyectoColumna[];
  onMoveTarea?: (tareaId: string, columnaId: string) => void;
  onDuplicateTarea?: (tarea: ProyectoTarea) => void;
  onDeleteTarea?: (tareaId: string) => void;
}

export function TareaCard({ 
  tarea, 
  onClick, 
  isDragging,
  columnas,
  onMoveTarea,
  onDuplicateTarea,
  onDeleteTarea
}: TareaCardProps) {
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

  const [showMenu, setShowMenu] = useState(false);
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isBeingDragged = isDragging || isSortableDragging;

  // Cerrar menú al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowMoveSubmenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleDelete = () => {
    if (onDeleteTarea) {
      onDeleteTarea(tarea.id);
    }
    setShowDeleteConfirm(false);
    setShowMenu(false);
  };

  const handleDuplicate = () => {
    if (onDuplicateTarea) {
      onDuplicateTarea(tarea);
    }
    setShowMenu(false);
  };

  const handleMoveTo = (columnaId: string) => {
    if (onMoveTarea) {
      onMoveTarea(tarea.id, columnaId);
    }
    setShowMoveSubmenu(false);
    setShowMenu(false);
  };

  return (
    <>
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
          <div className="flex-1 min-w-0">
            {/* Header con prioridad y menú */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2 flex-wrap" onClick={onClick}>
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

              <div className="flex items-center gap-1">
                {tarea.completado && (
                  <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
                )}
                
                {/* Menú de 3 puntos */}
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(!showMenu);
                    }}
                    className={cn(
                      "p-1 rounded-lg transition-all",
                      showMenu 
                        ? "bg-slate-700 text-slate-200" 
                        : "opacity-0 group-hover:opacity-100 hover:bg-slate-700 text-slate-400"
                    )}
                  >
                    <MoreHorizontal size={16} />
                  </button>

                  {/* Dropdown menú */}
                  {showMenu && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 py-1 overflow-visible">
                      {/* Editar */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onClick();
                          setShowMenu(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-700/50 transition-colors"
                      >
                        <Edit3 size={14} className="text-slate-400" />
                        Editar
                      </button>

                      {/* Marcar completado/pendiente */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Esto se manejará desde el padre
                          setShowMenu(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-700/50 transition-colors"
                      >
                        {tarea.completado ? (
                          <>
                            <Square size={14} className="text-slate-400" />
                            Marcar pendiente
                          </>
                        ) : (
                          <>
                            <CheckSquare size={14} className="text-emerald-400" />
                            Marcar completada
                          </>
                        )}
                      </button>

                      {/* Duplicar */}
                      {onDuplicateTarea && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicate();
                          }}
                          className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-700/50 transition-colors"
                        >
                          <Copy size={14} className="text-slate-400" />
                          Duplicar
                        </button>
                      )}

                      {/* Mover a columna */}
                      {columnas && columnas.length > 1 && onMoveTarea && (
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowMoveSubmenu(!showMoveSubmenu);
                            }}
                            className="w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-slate-700/50 transition-colors"
                          >
                            <span className="flex items-center gap-2">
                              <ArrowRight size={14} className="text-slate-400" />
                              Mover a...
                            </span>
                            <ArrowRight size={12} className="text-slate-500" />
                          </button>

                          {/* Submenu de columnas */}
                          {showMoveSubmenu && (
                            <div className="absolute left-full top-0 ml-1 w-40 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1 z-[60]">
                              {columnas
                                .filter(c => c.id !== tarea.columnaId)
                                .map(col => (
                                  <button
                                    key={col.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMoveTo(col.id);
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-700/50 transition-colors"
                                  >
                                    {col.color && (
                                      <div 
                                        className="w-2 h-2 rounded-full" 
                                        style={{ backgroundColor: col.color }}
                                      />
                                    )}
                                    {col.nombre}
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="border-t border-slate-700/50 my-1" />

                      {/* Eliminar */}
                      {onDeleteTarea && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteConfirm(true);
                          }}
                          className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-red-500/10 text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                          Eliminar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Título */}
            <h4 
              onClick={onClick}
              className={cn(
                'text-sm font-medium mb-2 cursor-pointer hover:text-emerald-400 transition-colors',
                tarea.completado && 'line-through text-slate-500'
              )}
            >
              {tarea.titulo}
            </h4>

            {/* Descripción */}
            {tarea.descripcion && (
              <p className="text-xs text-slate-400 mb-3 line-clamp-2" onClick={onClick}>
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

      {/* Modal confirmar eliminación */}
      {showDeleteConfirm && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" 
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div 
            className="bg-slate-900 border border-slate-700 rounded-xl p-4 w-80" 
            onClick={e => e.stopPropagation()}
          >
            <h4 className="font-semibold mb-2 text-red-400">Eliminar tarea</h4>
            <p className="text-sm text-slate-400 mb-4">
              ¿Estás seguro de eliminar la tarea "{tarea.titulo}"?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-3 py-2 rounded-lg bg-red-500 hover:bg-red-400 text-white font-medium text-sm transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}