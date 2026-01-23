'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn, formatDate } from '@/lib/utils';
import type { ProyectoTarea, ProyectoColumna, ProyectoEtiqueta } from '@/types';
import {
  ChevronDown,
  ChevronUp,
  Calendar,
  User,
  CheckCircle2,
  Circle,
  Clock,
  Lock,
  MoreHorizontal,
  Edit3,
  Trash2,
  Copy,
  ArrowRight,
  GripVertical,
  CheckSquare,
  Tag,
  AlertCircle,
} from 'lucide-react';

interface TareasListViewProps {
  tareas: ProyectoTarea[];
  columnas: ProyectoColumna[];
  etiquetas: ProyectoEtiqueta[];
  onTareaClick: (tarea: ProyectoTarea) => void;
  onTareaUpdate: (tareaId: string, data: Partial<ProyectoTarea>) => void;
  onTareaDelete: (tareaId: string) => void;
  onTareaDuplicate: (tarea: ProyectoTarea) => void;
  onTareaMove: (tareaId: string, columnaId: string) => void;
}

type SortField = 'titulo' | 'prioridad' | 'fechaLimite' | 'columna' | 'asignadoA' | 'createdAt' | 'progreso';
type SortOrder = 'asc' | 'desc';

const prioridadOrden = { urgente: 0, alta: 1, media: 2, baja: 3 };
const prioridadConfig = {
  urgente: { color: 'text-red-400', bg: 'bg-red-500/20', label: 'Urgente' },
  alta: { color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Alta' },
  media: { color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Media' },
  baja: { color: 'text-slate-400', bg: 'bg-slate-500/20', label: 'Baja' },
};

export function TareasListView({
  tareas,
  columnas,
  etiquetas,
  onTareaClick,
  onTareaUpdate,
  onTareaDelete,
  onTareaDuplicate,
  onTareaMove,
}: TareasListViewProps) {
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [editingCell, setEditingCell] = useState<{ tareaId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [selectedTareas, setSelectedTareas] = useState<Set<string>>(new Set());
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus en input cuando se activa edición
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = () => setMenuAbierto(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Ordenar tareas
  const tareasOrdenadas = [...tareas].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'titulo':
        comparison = a.titulo.localeCompare(b.titulo);
        break;
      case 'prioridad':
        comparison = prioridadOrden[a.prioridad] - prioridadOrden[b.prioridad];
        break;
      case 'fechaLimite':
        const fechaA = a.fechaLimite?.getTime() || Infinity;
        const fechaB = b.fechaLimite?.getTime() || Infinity;
        comparison = fechaA - fechaB;
        break;
      case 'columna':
        const colA = columnas.findIndex(c => c.id === a.columnaId);
        const colB = columnas.findIndex(c => c.id === b.columnaId);
        comparison = colA - colB;
        break;
      case 'asignadoA':
        comparison = (a.asignadoA || '').localeCompare(b.asignadoA || '');
        break;
      case 'createdAt':
        comparison = a.createdAt.getTime() - b.createdAt.getTime();
        break;
      case 'progreso':
        comparison = a.progreso - b.progreso;
        break;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleStartEdit = (tareaId: string, field: string, currentValue: string) => {
    setEditingCell({ tareaId, field });
    setEditValue(currentValue);
  };

  const handleSaveEdit = async (tareaId: string) => {
    if (!editingCell) return;

    const updateData: any = {};
    
    switch (editingCell.field) {
      case 'titulo':
        if (editValue.trim()) updateData.titulo = editValue.trim();
        break;
      case 'asignadoA':
        updateData.asignadoA = editValue || null;
        break;
      case 'fechaLimite':
        updateData.fechaLimite = editValue ? new Date(editValue) : null;
        break;
    }

    if (Object.keys(updateData).length > 0) {
      onTareaUpdate(tareaId, updateData);
    }

    setEditingCell(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, tareaId: string) => {
    if (e.key === 'Enter') {
      handleSaveEdit(tareaId);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleToggleCompletado = (tarea: ProyectoTarea) => {
    onTareaUpdate(tarea.id, { completado: !tarea.completado });
  };

  const handleToggleSelect = (tareaId: string) => {
    const newSelected = new Set(selectedTareas);
    if (newSelected.has(tareaId)) {
      newSelected.delete(tareaId);
    } else {
      newSelected.add(tareaId);
    }
    setSelectedTareas(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedTareas.size === tareas.length) {
      setSelectedTareas(new Set());
    } else {
      setSelectedTareas(new Set(tareas.map(t => t.id)));
    }
  };

  const getColumna = (columnaId: string | undefined) => {
    return columnas.find(c => c.id === columnaId);
  };

  const isOverdue = (tarea: ProyectoTarea) => {
    return tarea.fechaLimite && new Date(tarea.fechaLimite) < new Date() && !tarea.completado;
  };

  const SortHeader = ({ field, label, className }: { field: SortField; label: string; className?: string }) => (
    <th
      onClick={() => handleSort(field)}
      className={cn(
        'px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 transition-colors select-none',
        className
      )}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortField === field && (
          sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
        )}
      </div>
    </th>
  );

  return (
    <div className="bg-slate-900/30 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Barra de acciones masivas */}
      {selectedTareas.size > 0 && (
        <div className="px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center gap-4">
          <span className="text-sm text-emerald-400">
            {selectedTareas.size} tarea{selectedTareas.size > 1 ? 's' : ''} seleccionada{selectedTareas.size > 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                selectedTareas.forEach(id => onTareaDelete(id));
                setSelectedTareas(new Set());
              }}
              className="px-3 py-1 text-xs rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            >
              Eliminar
            </button>
            <button
              onClick={() => setSelectedTareas(new Set())}
              className="px-3 py-1 text-xs rounded-lg bg-slate-700/50 text-slate-400 hover:bg-slate-700 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-800/50 border-b border-slate-700/50">
            <tr>
              {/* Checkbox */}
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedTareas.size === tareas.length && tareas.length > 0}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500/20"
                />
              </th>
              
              {/* Completado */}
              <th className="w-10 px-2 py-3" />
              
              <SortHeader field="titulo" label="Título" className="min-w-[250px]" />
              <SortHeader field="columna" label="Estado" className="w-32" />
              <SortHeader field="prioridad" label="Prioridad" className="w-28" />
              <SortHeader field="asignadoA" label="Asignado" className="w-36" />
              <SortHeader field="fechaLimite" label="Fecha límite" className="w-32" />
              <SortHeader field="progreso" label="Progreso" className="w-28" />
              
              {/* Acciones */}
              <th className="w-16 px-4 py-3" />
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-700/30">
            {tareasOrdenadas.map(tarea => {
              const columna = getColumna(tarea.columnaId);
              const prioridad = prioridadConfig[tarea.prioridad];
              const vencida = isOverdue(tarea);

              return (
                <tr
                  key={tarea.id}
                  className={cn(
                    'hover:bg-slate-800/30 transition-colors group',
                    tarea.completado && 'opacity-60',
                    tarea.bloqueado && 'bg-red-500/5',
                    selectedTareas.has(tarea.id) && 'bg-emerald-500/10'
                  )}
                >
                  {/* Checkbox */}
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedTareas.has(tarea.id)}
                      onChange={() => handleToggleSelect(tarea.id)}
                      className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500/20"
                    />
                  </td>

                  {/* Toggle completado */}
                  <td className="px-2 py-3">
                    <button
                      onClick={() => handleToggleCompletado(tarea)}
                      className="p-1 rounded hover:bg-slate-700/50 transition-colors"
                    >
                      {tarea.completado ? (
                        <CheckCircle2 size={18} className="text-emerald-400" />
                      ) : (
                        <Circle size={18} className="text-slate-500 hover:text-emerald-400" />
                      )}
                    </button>
                  </td>

                  {/* Título (editable inline) */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {tarea.bloqueado && <Lock size={14} className="text-red-400 flex-shrink-0" />}
                      
                      {editingCell?.tareaId === tarea.id && editingCell?.field === 'titulo' ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleSaveEdit(tarea.id)}
                          onKeyDown={(e) => handleKeyDown(e, tarea.id)}
                          className="flex-1 px-2 py-1 rounded bg-slate-800 border border-emerald-500/50 focus:outline-none text-sm"
                        />
                      ) : (
                        <span
                          onClick={() => handleStartEdit(tarea.id, 'titulo', tarea.titulo)}
                          className={cn(
                            'cursor-pointer hover:text-emerald-400 transition-colors',
                            tarea.completado && 'line-through text-slate-500'
                          )}
                        >
                          {tarea.titulo}
                        </span>
                      )}

                      {/* Etiquetas */}
                      {tarea.etiquetas && tarea.etiquetas.length > 0 && (
                        <div className="flex gap-1 ml-2">
                          {tarea.etiquetas.slice(0, 2).map(et => (
                            <span
                              key={et.id}
                              className="px-1.5 py-0.5 text-xs rounded"
                              style={{
                                backgroundColor: `${et.color}20`,
                                color: et.color,
                              }}
                            >
                              {et.nombre}
                            </span>
                          ))}
                          {tarea.etiquetas.length > 2 && (
                            <span className="text-xs text-slate-500">+{tarea.etiquetas.length - 2}</span>
                          )}
                        </div>
                      )}

                      {/* Subtareas */}
                      {tarea.subtareas && tarea.subtareas.length > 0 && (
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <CheckSquare size={12} />
                          {tarea.subtareas.filter(s => s.completado).length}/{tarea.subtareas.length}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Columna/Estado */}
                  <td className="px-4 py-3">
                    <select
                      value={tarea.columnaId || ''}
                      onChange={(e) => onTareaMove(tarea.id, e.target.value)}
                      className="w-full px-2 py-1 rounded-lg bg-transparent border border-transparent hover:border-slate-600 focus:border-emerald-500 focus:outline-none text-sm cursor-pointer"
                      style={{
                        color: columna?.color || '#94a3b8',
                      }}
                    >
                      {columnas.map(col => (
                        <option key={col.id} value={col.id}>
                          {col.nombre}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Prioridad */}
                  <td className="px-4 py-3">
                    <select
                      value={tarea.prioridad}
                      onChange={(e) => onTareaUpdate(tarea.id, { prioridad: e.target.value as any })}
                      className={cn(
                        'px-2 py-1 rounded-lg text-xs font-medium cursor-pointer border-0 focus:outline-none focus:ring-2 focus:ring-emerald-500/20',
                        prioridad.bg,
                        prioridad.color
                      )}
                    >
                      <option value="urgente">🔴 Urgente</option>
                      <option value="alta">🟠 Alta</option>
                      <option value="media">🔵 Media</option>
                      <option value="baja">⚪ Baja</option>
                    </select>
                  </td>

                  {/* Asignado (editable inline) */}
                  <td className="px-4 py-3">
                    {editingCell?.tareaId === tarea.id && editingCell?.field === 'asignadoA' ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleSaveEdit(tarea.id)}
                        onKeyDown={(e) => handleKeyDown(e, tarea.id)}
                        placeholder="email@ejemplo.com"
                        className="w-full px-2 py-1 rounded bg-slate-800 border border-emerald-500/50 focus:outline-none text-sm"
                      />
                    ) : (
                      <div
                        onClick={() => handleStartEdit(tarea.id, 'asignadoA', tarea.asignadoA || '')}
                        className="cursor-pointer flex items-center gap-2 hover:text-emerald-400 transition-colors"
                      >
                        {tarea.asignadoA ? (
                          <>
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-400">
                              {tarea.asignadoA.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm truncate max-w-[100px]">
                              {tarea.asignadoA.split('@')[0]}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-500 text-sm">Sin asignar</span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Fecha límite (editable inline) */}
                  <td className="px-4 py-3">
                    {editingCell?.tareaId === tarea.id && editingCell?.field === 'fechaLimite' ? (
                      <input
                        ref={inputRef}
                        type="date"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleSaveEdit(tarea.id)}
                        onKeyDown={(e) => handleKeyDown(e, tarea.id)}
                        className="px-2 py-1 rounded bg-slate-800 border border-emerald-500/50 focus:outline-none text-sm"
                      />
                    ) : (
                      <div
                        onClick={() => handleStartEdit(
                          tarea.id, 
                          'fechaLimite', 
                          tarea.fechaLimite ? tarea.fechaLimite.toISOString().split('T')[0] : ''
                        )}
                        className={cn(
                          'cursor-pointer flex items-center gap-1 text-sm hover:text-emerald-400 transition-colors',
                          vencida && 'text-red-400'
                        )}
                      >
                        {tarea.fechaLimite ? (
                          <>
                            <Calendar size={14} />
                            {formatDate(tarea.fechaLimite)}
                            {vencida && <AlertCircle size={14} className="text-red-400" />}
                          </>
                        ) : (
                          <span className="text-slate-500">Sin fecha</span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Progreso */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full transition-all',
                            tarea.progreso >= 100 ? 'bg-emerald-500' :
                            tarea.progreso >= 50 ? 'bg-blue-500' :
                            'bg-slate-500'
                          )}
                          style={{ width: `${tarea.progreso}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 w-8">{tarea.progreso}%</span>
                    </div>
                  </td>

                  {/* Acciones */}
                  <td className="px-4 py-3">
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuAbierto(menuAbierto === tarea.id ? null : tarea.id);
                        }}
                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-slate-700 transition-all"
                      >
                        <MoreHorizontal size={16} />
                      </button>

                      {menuAbierto === tarea.id && (
                        <div 
                          className="absolute right-0 top-full mt-1 w-40 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 py-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              onTareaClick(tarea);
                              setMenuAbierto(null);
                            }}
                            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-700/50"
                          >
                            <Edit3 size={14} />
                            Editar
                          </button>
                          <button
                            onClick={() => {
                              onTareaDuplicate(tarea);
                              setMenuAbierto(null);
                            }}
                            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-700/50"
                          >
                            <Copy size={14} />
                            Duplicar
                          </button>
                          <div className="border-t border-slate-700/50 my-1" />
                          <button
                            onClick={() => {
                              onTareaDelete(tarea.id);
                              setMenuAbierto(null);
                            }}
                            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-red-500/10 text-red-400"
                          >
                            <Trash2 size={14} />
                            Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {tareas.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          No hay tareas para mostrar
        </div>
      )}
    </div>
  );
}