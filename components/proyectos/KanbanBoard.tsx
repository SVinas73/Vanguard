'use client';

import React, { useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { KanbanColumn } from './KanbanColumn';
import { TareaCard } from './TareaCard';
import type { ProyectoColumna, ProyectoTarea } from '@/types';

interface KanbanBoardProps {
  columnas: ProyectoColumna[];
  tareas: ProyectoTarea[];
  onTareaClick: (tarea: ProyectoTarea) => void;
  onTareaMover: (tareaId: string, nuevaColumnaId: string, nuevoOrden: number) => void;
}

export function KanbanBoard({ columnas, tareas, onTareaClick, onTareaMover }: KanbanBoardProps) {
  const [activeTarea, setActiveTarea] = useState<ProyectoTarea | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const tarea = tareas.find(t => t.id === event.active.id);
    setActiveTarea(tarea || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveTarea(null);
      return;
    }

    const tareaId = active.id as string;
    const overColumnaId = over.id as string;

    // Encontrar la columna destino
    const columnaDestino = columnas.find(c => c.id === overColumnaId);
    if (!columnaDestino) {
      setActiveTarea(null);
      return;
    }

    // Calcular el nuevo orden
    const tareasEnColumna = tareas.filter(t => t.columnaId === columnaDestino.id);
    const nuevoOrden = tareasEnColumna.length;

    onTareaMover(tareaId, columnaDestino.id, nuevoOrden);
    setActiveTarea(null);
  };

  const handleDragCancel = () => {
    setActiveTarea(null);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="grid grid-cols-4 gap-4 overflow-x-auto pb-4">
        {columnas.map(columna => {
          const tareasColumna = tareas
            .filter(t => t.columnaId === columna.id)
            .sort((a, b) => a.orden - b.orden);

          return (
            <KanbanColumn
              key={columna.id}
              columna={columna}
              tareas={tareasColumna}
              onTareaClick={onTareaClick}
            />
          );
        })}
      </div>

      <DragOverlay>
        {activeTarea && (
          <div className="rotate-3 opacity-80">
            <TareaCard tarea={activeTarea} onClick={() => {}} isDragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}