'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { TareaCard } from './TareaCard';
import type { ProyectoColumna, ProyectoTarea } from '@/types';
import { MoreVertical } from 'lucide-react';

interface KanbanColumnProps {
  columna: ProyectoColumna;
  tareas: ProyectoTarea[];
  onTareaClick: (tarea: ProyectoTarea) => void;
}

export function KanbanColumn({ columna, tareas, onTareaClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: columna.id,
  });

  // Contar tareas completadas
  const completadas = tareas.filter(t => t.completado).length;
  const total = tareas.length;

  // WIP limit warning
  const isOverWipLimit = columna.limiteWip && tareas.length > columna.limiteWip;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col min-h-[600px] bg-slate-900/30 rounded-2xl border transition-all',
        isOver ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-800/50'
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-800/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {columna.color && (
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: columna.color }}
              />
            )}
            <h3 className="font-semibold text-sm">{columna.nombre}</h3>
          </div>
          <button className="p-1 hover:bg-slate-800 rounded-lg transition-colors">
            <MoreVertical size={16} className="text-slate-500" />
          </button>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">
            {total} tarea{total !== 1 && 's'}
          </span>
          
          {columna.limiteWip && (
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
          )}

          {completadas > 0 && (
            <span className="text-emerald-400">
              {completadas}/{total}
            </span>
          )}
        </div>
      </div>

      {/* Tareas */}
      <div className="flex-1 p-3 space-y-3 overflow-y-auto">
        <SortableContext items={tareas.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tareas.length === 0 ? (
            <div className="text-center py-12 text-slate-600 text-sm">
              Sin tareas
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
      </div>
    </div>
  );
}