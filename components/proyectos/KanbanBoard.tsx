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
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
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

  // Encontrar la columna de una tarea o ID
  const findColumnaId = (id: string): string | null => {
    // Si es una columna directamente
    const columna = columnas.find(c => c.id === id);
    if (columna) return columna.id;

    // Si es una tarea, buscar su columna
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

    // Encontrar columnas
    const activeColumna = findColumnaId(activeId);
    const overColumna = findColumnaId(overId);

    if (!activeColumna || !overColumna || activeColumna === overColumna) {
      return;
    }

    // Actualizar visualmente mientras arrastramos
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

    // Encontrar la tarea que estamos moviendo
    const tareaMovida = tareas.find(t => t.id === activeId);
    if (!tareaMovida) {
      setActiveTarea(null);
      setActiveColumnaId(null);
      return;
    }

    // Determinar la columna destino
    let columnaDestinoId: string | null = null;
    let nuevoOrden = 0;

    // Verificar si soltamos sobre una columna
    const columnaDirecta = columnas.find(c => c.id === overId);
    if (columnaDirecta) {
      columnaDestinoId = columnaDirecta.id;
      const tareasEnColumna = tareas.filter(t => t.columnaId === columnaDestinoId && t.id !== activeId);
      nuevoOrden = tareasEnColumna.length;
    } else {
      // Soltamos sobre otra tarea
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

    // Ejecutar el movimiento si hay columna destino
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
              isOver={activeColumnaId === columna.id && activeTarea?.columnaId !== columna.id}
            />
          );
        })}
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