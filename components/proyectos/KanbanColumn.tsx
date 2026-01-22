'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { TareaCard } from './TareaCard';
import type { ProyectoColumna, ProyectoTarea } from '@/types';
import { 
  MoreVertical, 
  Plus, 
  Edit3, 
  Trash2, 
  Palette, 
  ArrowLeft, 
  ArrowRight,
  AlertCircle
} from 'lucide-react';

interface KanbanColumnProps {
  columna: ProyectoColumna;
  tareas: ProyectoTarea[];
  onTareaClick: (tarea: ProyectoTarea) => void;
  isOver?: boolean;
  onAddTarea?: (columnaId: string) => void;
  onDeleteColumna?: (columnaId: string) => void;
  onMoveColumna?: (columnaId: string, direction: 'left' | 'right') => void;
  onUpdateColumna?: (columnaId: string, data: Partial<ProyectoColumna>) => void;
  isFirst?: boolean;
  isLast?: boolean;
  columnas?: ProyectoColumna[];
  onMoveTarea?: (tareaId: string, columnaId: string) => void;
  onDuplicateTarea?: (tarea: ProyectoTarea) => void;
  onDeleteTarea?: (tareaId: string) => void;
}

export function KanbanColumn({ 
  columna, 
  tareas, 
  onTareaClick, 
  isOver: isOverProp,
  onAddTarea,
  onDeleteColumna,
  onMoveColumna,
  onUpdateColumna,
  isFirst,
  isLast,
  columnas,
  onMoveTarea,
  onDuplicateTarea,
  onDeleteTarea
}: KanbanColumnProps) {
  const { setNodeRef, isOver: isDroppableOver } = useDroppable({
    id: columna.id,
    data: {
      type: 'columna',
      columna,
    },
  });

  const [showMenu, setShowMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showWipModal, setShowWipModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState(columna.nombre);
  const [nuevoWip, setNuevoWip] = useState(columna.limiteWip?.toString() || '');
  
  const menuRef = useRef<HTMLDivElement>(null);

  const isHighlighted = isOverProp || isDroppableOver;
  const completadas = tareas.filter(t => t.completado).length;
  const total = tareas.length;
  const isOverWipLimit = columna.limiteWip && tareas.length > columna.limiteWip;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowColorPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const colores = [
    '#10b981', '#3b82f6', '#f59e0b', '#ef4444', 
    '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
    '#6366f1', '#84cc16', '#06b6d4', '#a855f7'
  ];

  const handleRename = () => {
    if (nuevoNombre.trim() && onUpdateColumna) {
      onUpdateColumna(columna.id, { nombre: nuevoNombre.trim() });
    }
    setShowRenameModal(false);
    setShowMenu(false);
  };

  const handleSetWip = () => {
    if (onUpdateColumna) {
      onUpdateColumna(columna.id, { 
        limiteWip: nuevoWip ? parseInt(nuevoWip) : undefined 
      });
    }
    setShowWipModal(false);
    setShowMenu(false);
  };

  const handleColorChange = (color: string) => {
    if (onUpdateColumna) {
      onUpdateColumna(columna.id, { color });
    }
    setShowColorPicker(false);
    setShowMenu(false);
  };

  const handleDelete = () => {
    if (onDeleteColumna) {
      onDeleteColumna(columna.id);
    }
    setShowDeleteConfirm(false);
    setShowMenu(false);
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col w-80 min-w-[320px] min-h-[600px] bg-slate-900/30 rounded-2xl border transition-all duration-200',
        isHighlighted 
          ? 'border-emerald-500/50 bg-emerald-500/5 shadow-lg shadow-emerald-500/10' 
          : 'border-slate-800/50',
        isOverWipLimit && 'border-red-500/30'
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-800/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {columna.color && (
              <div
                className="w-3 h-3 rounded-full ring-2 ring-offset-2 ring-offset-slate-900"
                style={{ 
                  backgroundColor: columna.color,
                  '--tw-ring-color': columna.color 
                } as React.CSSProperties}
              />
            )}
            <h3 className="font-semibold text-sm">{columna.nombre}</h3>
            <span className="text-xs text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded-full">
              {total}
            </span>
          </div>
          
          <div className="flex items-center gap-1 relative" ref={menuRef}>
            {onAddTarea && (
              <button 
                onClick={() => onAddTarea(columna.id)}
                className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-emerald-400"
                title="Agregar tarea"
              >
                <Plus size={16} />
              </button>
            )}
            
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className={cn(
                "p-1.5 hover:bg-slate-800 rounded-lg transition-colors",
                showMenu ? "bg-slate-800 text-slate-200" : "text-slate-500"
              )}
            >
              <MoreVertical size={16} />
            </button>

            {/* Menú dropdown */}
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                <button
                  onClick={() => {
                    setNuevoNombre(columna.nombre);
                    setShowRenameModal(true);
                  }}
                  className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-700/50 transition-colors"
                >
                  <Edit3 size={14} className="text-slate-400" />
                  Renombrar
                </button>

                <button
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-700/50 transition-colors"
                >
                  <Palette size={14} className="text-slate-400" />
                  Cambiar color
                </button>

                {showColorPicker && (
                  <div className="px-3 py-2 border-t border-slate-700/50">
                    <div className="grid grid-cols-6 gap-1">
                      {colores.map(color => (
                        <button
                          key={color}
                          onClick={() => handleColorChange(color)}
                          className={cn(
                            "w-6 h-6 rounded-full transition-transform hover:scale-110",
                            columna.color === color && "ring-2 ring-white ring-offset-2 ring-offset-slate-800"
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    setNuevoWip(columna.limiteWip?.toString() || '');
                    setShowWipModal(true);
                  }}
                  className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-700/50 transition-colors"
                >
                  <AlertCircle size={14} className="text-slate-400" />
                  Límite WIP {columna.limiteWip && `(${columna.limiteWip})`}
                </button>

                <div className="border-t border-slate-700/50 my-1" />

                {!isFirst && onMoveColumna && (
                  <button
                    onClick={() => {
                      onMoveColumna(columna.id, 'left');
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-700/50 transition-colors"
                  >
                    <ArrowLeft size={14} className="text-slate-400" />
                    Mover a la izquierda
                  </button>
                )}

                {!isLast && onMoveColumna && (
                  <button
                    onClick={() => {
                      onMoveColumna(columna.id, 'right');
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-700/50 transition-colors"
                  >
                    <ArrowRight size={14} className="text-slate-400" />
                    Mover a la derecha
                  </button>
                )}

                <div className="border-t border-slate-700/50 my-1" />

                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-red-500/10 text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                  Eliminar columna
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          {columna.limiteWip ? (
            <span
              className={cn(
                'px-2 py-0.5 rounded-full font-medium',
                isOverWipLimit
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-slate-700/50 text-slate-400'
              )}
            >
              WIP: {total}/{columna.limiteWip}
            </span>
          ) : (
            <span />
          )}

          {completadas > 0 && (
            <span className="text-emerald-400">
              ✓ {completadas}/{total}
            </span>
          )}
        </div>
      </div>

      {/* Tareas */}
      <div className="flex-1 p-3 space-y-3 overflow-y-auto">
        <SortableContext 
          items={tareas.map(t => t.id)} 
          strategy={verticalListSortingStrategy}
        >
          {tareas.length === 0 ? (
            <div 
              className={cn(
                'text-center py-12 rounded-xl border-2 border-dashed transition-all',
                isHighlighted 
                  ? 'border-emerald-500/50 bg-emerald-500/5 text-emerald-400' 
                  : 'border-slate-700/50 text-slate-600'
              )}
            >
              <p className="text-sm">
                {isHighlighted ? 'Soltar aquí' : 'Sin tareas'}
              </p>
            </div>
          ) : (
            tareas.map(tarea => (
              <TareaCard
                key={tarea.id}
                tarea={tarea}
                onClick={() => onTareaClick(tarea)}
                columnas={columnas}
                onMoveTarea={onMoveTarea}
                onDuplicateTarea={onDuplicateTarea}
                onDeleteTarea={onDeleteTarea}
              />
            ))
          )}
        </SortableContext>

        {tareas.length > 0 && isHighlighted && (
          <div className="h-16 rounded-xl border-2 border-dashed border-emerald-500/50 bg-emerald-500/5 flex items-center justify-center">
            <p className="text-sm text-emerald-400">Soltar aquí</p>
          </div>
        )}
      </div>

      {/* Modal Renombrar */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={() => setShowRenameModal(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 w-80" onClick={e => e.stopPropagation()}>
            <h4 className="font-semibold mb-3">Renombrar columna</h4>
            <input
              type="text"
              value={nuevoNombre}
              onChange={e => setNuevoNombre(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRename()}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:outline-none text-sm mb-3"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowRenameModal(false)}
                className="flex-1 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRename}
                className="flex-1 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-medium text-sm transition-colors"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal WIP */}
      {showWipModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={() => setShowWipModal(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 w-80" onClick={e => e.stopPropagation()}>
            <h4 className="font-semibold mb-2">Límite WIP</h4>
            <p className="text-xs text-slate-400 mb-3">
              Cantidad máxima de tareas en esta columna. Dejá vacío para sin límite.
            </p>
            <input
              type="number"
              min="0"
              value={nuevoWip}
              onChange={e => setNuevoWip(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSetWip()}
              placeholder="Sin límite"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:outline-none text-sm mb-3"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowWipModal(false)}
                className="flex-1 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSetWip}
                className="flex-1 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-medium text-sm transition-colors"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar eliminación */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 w-80" onClick={e => e.stopPropagation()}>
            <h4 className="font-semibold mb-2 text-red-400">Eliminar columna</h4>
            <p className="text-sm text-slate-400 mb-4">
              ¿Estás seguro de eliminar la columna "{columna.nombre}"? 
              {tareas.length > 0 && (
                <span className="text-red-400 block mt-1">
                  ⚠️ Tiene {tareas.length} tarea{tareas.length > 1 ? 's' : ''} que también se eliminarán.
                </span>
              )}
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
    </div>
  );
}