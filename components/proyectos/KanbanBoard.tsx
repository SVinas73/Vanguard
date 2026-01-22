'use client';

import React, { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  KeyboardSensor,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { KanbanColumn } from './KanbanColumn';
import { TareaCard } from './TareaCard';
import type { ProyectoColumna, ProyectoTarea } from '@/types';
import { Plus } from 'lucide-react';

interface KanbanBoardProps {
  columnas: ProyectoColumna[];
  tareas: ProyectoTarea[];
  onTareaClick: (tarea: ProyectoTarea) => void;
  onTareaMover: (tareaId: string, nuevaColumnaId: string, nuevoOrden: number) => void;
  onAddTarea?: (columnaId: string) => void;
  onUpdateColumna?: (columnaId: string, data: Partial<ProyectoColumna>) => void;
  onDeleteColumna?: (columnaId: string) => void;
  onMoveColumna?: (columnaId: string, direction: 'left' | 'right') => void;
  onDuplicateTarea?: (tarea: ProyectoTarea) => void;
  onDeleteTarea?: (tareaId: string) => void;
  onAddColumna?: () => void;
}

export function KanbanBoard({ 
  columnas, 
  tareas, 
  onTareaClick, 
  onTareaMover,
  onAddTarea,
  onUpdateColumna,
  onDeleteColumna,
  onMoveColumna,
  onDuplicateTarea,
  onDeleteTarea,
  onAddColumna
}: KanbanBoardProps) {
  const [activeTarea, setActiveTarea] = useState<ProyectoTarea | null>(null);
  const [activeColumnaId, setActiveColumnaId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const findColumnaId = (id: string): string | null => {
    const columna = columnas.find(c => c.id === id);
    if (columna) return columna.id;

    const tarea = tareas.find(t => t.id === id);
    if (tarea) return tarea.columnaId || null;

    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const tarea = tareas.find(t => t.id === active.id);
    
    if (tarea) {
      setActiveTarea(tarea);
      setActiveColumnaId(tarea.columnaId || null);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeColumna = findColumnaId(activeId);
    const overColumna = findColumnaId(overId);

    if (!activeColumna || !overColumna || activeColumna === overColumna) {
      return;
    }

    setActiveColumnaId(overColumna);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveTarea(null);
      setActiveColumnaId(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    const tareaMovida = tareas.find(t => t.id === activeId);
    if (!tareaMovida) {
      setActiveTarea(null);
      setActiveColumnaId(null);
      return;
    }

    let columnaDestinoId: string | null = null;
    let nuevoOrden = 0;

    const columnaDirecta = columnas.find(c => c.id === overId);
    if (columnaDirecta) {
      columnaDestinoId = columnaDirecta.id;
      const tareasEnColumna = tareas.filter(t => t.columnaId === columnaDestinoId && t.id !== activeId);
      nuevoOrden = tareasEnColumna.length;
    } else {
      const tareaDestino = tareas.find(t => t.id === overId);
      if (tareaDestino) {
        columnaDestinoId = tareaDestino.columnaId || null;
        
        if (columnaDestinoId) {
          const tareasEnColumna = tareas
            .filter(t => t.columnaId === columnaDestinoId)
            .sort((a, b) => a.orden - b.orden);
          
          const indexDestino = tareasEnColumna.findIndex(t => t.id === overId);
          nuevoOrden = indexDestino >= 0 ? indexDestino : tareasEnColumna.length;
        }
      }
    }

    if (columnaDestinoId) {
      onTareaMover(activeId, columnaDestinoId, nuevoOrden);
    }

    setActiveTarea(null);
    setActiveColumnaId(null);
  };

  const handleDragCancel = () => {
    setActiveTarea(null);
    setActiveColumnaId(null);
  };

  const handleMoveTarea = (tareaId: string, columnaId: string) => {
    const tareasEnColumna = tareas.filter(t => t.columnaId === columnaId);
    onTareaMover(tareaId, columnaId, tareasEnColumna.length);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columnas.map((columna, index) => {
          const tareasColumna = tareas
            .filter(t => t.columnaId === columna.id)
            .sort((a, b) => a.orden - b.orden);

          return (
            <KanbanColumn
              key={columna.id}
              columna={columna}
              tareas={tareasColumna}
              onTareaClick={onTareaClick}
              isOver={activeColumnaId === columna.id && activeTarea?.columnaId !== columna.id}
              onAddTarea={onAddTarea}
              onUpdateColumna={onUpdateColumna}
              onDeleteColumna={onDeleteColumna}
              onMoveColumna={onMoveColumna}
              isFirst={index === 0}
              isLast={index === columnas.length - 1}
              columnas={columnas}
              onMoveTarea={handleMoveTarea}
              onDuplicateTarea={onDuplicateTarea}
              onDeleteTarea={onDeleteTarea}
            />
          );
        })}

        {/* Botón agregar columna */}
        {onAddColumna && (
          <button
            onClick={onAddColumna}
            className="flex-shrink-0 w-80 min-w-[320px] min-h-[200px] rounded-2xl border-2 border-dashed border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/20 transition-all flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-slate-400"
          >
            <Plus size={24} />
            <span className="text-sm font-medium">Agregar columna</span>
          </button>
        )}
      </div>

      <DragOverlay dropAnimation={{
        duration: 200,
        easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
      }}>
        {activeTarea && (
          <div className="rotate-2 scale-105">
            <TareaCard tarea={activeTarea} onClick={() => {}} isDragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}