'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { TareaCard } from './TareaCard';
import type { ProyectoColumna, ProyectoTarea } from '@/types';
import { MoreVertical, Plus } from 'lucide-react';

interface KanbanColumnProps {
  columna: ProyectoColumna;
  tareas: ProyectoTarea[];
  onTareaClick: (tarea: ProyectoTarea) => void;
  isOver?: boolean;
  onAddTarea?: () => void;
}

export function KanbanColumn({ 
  columna, 
  tareas, 
  onTareaClick, 
  isOver: isOverProp,
  onAddTarea 
}: KanbanColumnProps) {
  const { setNodeRef, isOver: isDroppableOver } = useDroppable({
    id: columna.id,
    data: {
      type: 'columna',
      columna,
    },
  });

  const isHighlighted = isOverProp || isDroppableOver;

  // Contar tareas completadas
  const completadas = tareas.filter(t => t.completado).length;
  const total = tareas.length;

  // WIP limit warning
  const isOverWipLimit = columna.limiteWip && tareas.length > columna.limiteWip;

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
          <div className="flex items-center gap-1">
            {onAddTarea && (
              <button 
                onClick={onAddTarea}
                className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-emerald-400"
              >
                <Plus size={16} />
              </button>
            )}
            <button className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors">
              <MoreVertical size={16} className="text-slate-500" />
            </button>
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
              />
            ))
          )}
        </SortableContext>

        {/* Drop zone indicator at bottom when has tasks */}
        {tareas.length > 0 && isHighlighted && (
          <div className="h-16 rounded-xl border-2 border-dashed border-emerald-500/50 bg-emerald-500/5 flex items-center justify-center">
            <p className="text-sm text-emerald-400">Soltar aquí</p>
          </div>
        )}
      </div>
    </div>
  );
}