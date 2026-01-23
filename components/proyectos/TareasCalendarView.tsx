'use client';

import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { ProyectoTarea, ProyectoColumna } from '@/types';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Plus,
  CheckCircle2,
  Clock,
  Lock,
  AlertCircle,
} from 'lucide-react';

interface TareasCalendarViewProps {
  tareas: ProyectoTarea[];
  columnas: ProyectoColumna[];
  onTareaClick: (tarea: ProyectoTarea) => void;
  onAddTarea: (fecha: Date) => void;
}

const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const mesesNombres = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const prioridadConfig = {
  urgente: { color: 'bg-red-500', border: 'border-red-500/50' },
  alta: { color: 'bg-orange-500', border: 'border-orange-500/50' },
  media: { color: 'bg-blue-500', border: 'border-blue-500/50' },
  baja: { color: 'bg-slate-500', border: 'border-slate-500/50' },
};

export function TareasCalendarView({
  tareas,
  columnas,
  onTareaClick,
  onAddTarea,
}: TareasCalendarViewProps) {
  const [fechaActual, setFechaActual] = useState(new Date());
  const [vistaExpandida, setVistaExpandida] = useState<string | null>(null);

  const año = fechaActual.getFullYear();
  const mes = fechaActual.getMonth();

  // Calcular días del mes
  const diasDelMes = useMemo(() => {
    const primerDia = new Date(año, mes, 1);
    const ultimoDia = new Date(año, mes + 1, 0);
    const diasEnMes = ultimoDia.getDate();
    const diaInicio = primerDia.getDay();

    const dias: { fecha: Date; esMesActual: boolean }[] = [];

    // Días del mes anterior
    const diasMesAnterior = new Date(año, mes, 0).getDate();
    for (let i = diaInicio - 1; i >= 0; i--) {
      dias.push({
        fecha: new Date(año, mes - 1, diasMesAnterior - i),
        esMesActual: false,
      });
    }

    // Días del mes actual
    for (let i = 1; i <= diasEnMes; i++) {
      dias.push({
        fecha: new Date(año, mes, i),
        esMesActual: true,
      });
    }

    // Días del mes siguiente para completar la grilla
    const diasRestantes = 42 - dias.length; // 6 semanas x 7 días
    for (let i = 1; i <= diasRestantes; i++) {
      dias.push({
        fecha: new Date(año, mes + 1, i),
        esMesActual: false,
      });
    }

    return dias;
  }, [año, mes]);

  // Agrupar tareas por fecha
  const tareasPorFecha = useMemo(() => {
    const mapa: Record<string, ProyectoTarea[]> = {};
    
    tareas.forEach(tarea => {
      if (tarea.fechaLimite) {
        const fechaKey = tarea.fechaLimite.toISOString().split('T')[0];
        if (!mapa[fechaKey]) mapa[fechaKey] = [];
        mapa[fechaKey].push(tarea);
      }
    });

    // Ordenar por prioridad
    Object.keys(mapa).forEach(key => {
      mapa[key].sort((a, b) => {
        const orden = { urgente: 0, alta: 1, media: 2, baja: 3 };
        return orden[a.prioridad] - orden[b.prioridad];
      });
    });

    return mapa;
  }, [tareas]);

  const navegarMes = (direccion: number) => {
    setFechaActual(new Date(año, mes + direccion, 1));
  };

  const irAHoy = () => {
    setFechaActual(new Date());
  };

  const esHoy = (fecha: Date) => {
    const hoy = new Date();
    return fecha.toDateString() === hoy.toDateString();
  };

  const getColumna = (columnaId: string | undefined) => {
    return columnas.find(c => c.id === columnaId);
  };

  const getTareasDia = (fecha: Date) => {
    const fechaKey = fecha.toISOString().split('T')[0];
    return tareasPorFecha[fechaKey] || [];
  };

  const formatFechaKey = (fecha: Date) => {
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-900/30 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header del calendario */}
      <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navegarMes(-1)}
            className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>

          <h2 className="text-lg font-semibold min-w-[200px] text-center">
            {mesesNombres[mes]} {año}
          </h2>

          <button
            onClick={() => navegarMes(1)}
            className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
          >
            <ChevronRight size={20} />
          </button>

          <button
            onClick={irAHoy}
            className="px-3 py-1.5 text-sm rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
          >
            Hoy
          </button>
        </div>

        {/* Leyenda */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-slate-400">Urgente</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-slate-400">Alta</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-slate-400">Media</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-slate-500" />
            <span className="text-slate-400">Baja</span>
          </div>
        </div>
      </div>

      {/* Días de la semana */}
      <div className="grid grid-cols-7 border-b border-slate-700/50">
        {diasSemana.map((dia, i) => (
          <div
            key={dia}
            className={cn(
              'px-2 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider',
              i === 0 || i === 6 ? 'text-slate-500' : ''
            )}
          >
            {dia}
          </div>
        ))}
      </div>

      {/* Grilla de días */}
      <div className="grid grid-cols-7">
        {diasDelMes.map(({ fecha, esMesActual }, index) => {
          const tareasDia = getTareasDia(fecha);
          const fechaKey = formatFechaKey(fecha);
          const esExpanded = vistaExpandida === fechaKey;
          const hoy = esHoy(fecha);
          const esPasado = fecha < new Date(new Date().setHours(0, 0, 0, 0)) && !hoy;
          const tareasVencidas = tareasDia.filter(t => !t.completado && esPasado);

          return (
            <div
              key={index}
              className={cn(
                'min-h-[120px] border-b border-r border-slate-700/30 p-2 transition-colors relative group',
                !esMesActual && 'bg-slate-900/50',
                hoy && 'bg-emerald-500/5',
                esPasado && tareasVencidas.length > 0 && 'bg-red-500/5'
              )}
            >
              {/* Número del día */}
              <div className="flex items-center justify-between mb-2">
                <span
                  className={cn(
                    'text-sm font-medium w-7 h-7 rounded-full flex items-center justify-center',
                    hoy && 'bg-emerald-500 text-slate-900',
                    !esMesActual && 'text-slate-600',
                    esMesActual && !hoy && 'text-slate-300'
                  )}
                >
                  {fecha.getDate()}
                </span>

                {/* Botón agregar tarea (visible en hover) */}
                <button
                  onClick={() => onAddTarea(fecha)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-slate-700/50 text-slate-500 hover:text-emerald-400 transition-all"
                  title="Agregar tarea"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Tareas del día */}
              <div className="space-y-1">
                {(esExpanded ? tareasDia : tareasDia.slice(0, 3)).map(tarea => {
                  const prioridad = prioridadConfig[tarea.prioridad];
                  const columna = getColumna(tarea.columnaId);

                  return (
                    <div
                      key={tarea.id}
                      onClick={() => onTareaClick(tarea)}
                      className={cn(
                        'px-2 py-1 rounded text-xs cursor-pointer transition-all hover:scale-[1.02]',
                        'border-l-2',
                        prioridad.border,
                        tarea.completado 
                          ? 'bg-slate-700/30 text-slate-500 line-through' 
                          : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
                      )}
                    >
                      <div className="flex items-center gap-1">
                        {tarea.completado && <CheckCircle2 size={10} className="text-emerald-400 flex-shrink-0" />}
                        {tarea.bloqueado && <Lock size={10} className="text-red-400 flex-shrink-0" />}
                        {esPasado && !tarea.completado && <AlertCircle size={10} className="text-red-400 flex-shrink-0" />}
                        <span className="truncate">{tarea.titulo}</span>
                      </div>
                      {columna && (
                        <div 
                          className="text-[10px] mt-0.5 opacity-60"
                          style={{ color: columna.color }}
                        >
                          {columna.nombre}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Mostrar más */}
                {tareasDia.length > 3 && !esExpanded && (
                  <button
                    onClick={() => setVistaExpandida(fechaKey)}
                    className="w-full text-[10px] text-slate-500 hover:text-emerald-400 py-1 transition-colors"
                  >
                    +{tareasDia.length - 3} más
                  </button>
                )}

                {esExpanded && (
                  <button
                    onClick={() => setVistaExpandida(null)}
                    className="w-full text-[10px] text-slate-500 hover:text-emerald-400 py-1 transition-colors"
                  >
                    Mostrar menos
                  </button>
                )}
              </div>

              {/* Indicador de cantidad */}
              {tareasDia.length > 0 && !esExpanded && (
                <div className="absolute bottom-1 right-1 text-[10px] text-slate-600">
                  {tareasDia.filter(t => t.completado).length}/{tareasDia.length}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Resumen del mes */}
      <div className="px-6 py-3 border-t border-slate-700/50 bg-slate-800/30 flex items-center justify-between text-sm">
        <div className="flex items-center gap-6">
          <span className="text-slate-400">
            <span className="font-medium text-slate-200">{tareas.filter(t => t.fechaLimite).length}</span> tareas con fecha
          </span>
          <span className="text-slate-400">
            <span className="font-medium text-emerald-400">{tareas.filter(t => t.completado).length}</span> completadas
          </span>
          <span className="text-slate-400">
            <span className="font-medium text-red-400">
              {tareas.filter(t => t.fechaLimite && new Date(t.fechaLimite) < new Date() && !t.completado).length}
            </span> vencidas
          </span>
        </div>

        <div className="flex items-center gap-2 text-slate-500">
          <Calendar size={14} />
          <span>Vista mensual</span>
        </div>
      </div>
    </div>
  );
}

// Mini calendario para sidebar
export function MiniCalendar({ 
  tareas, 
  onDateClick 
}: { 
  tareas: ProyectoTarea[]; 
  onDateClick: (fecha: Date) => void;
}) {
  const [fechaActual, setFechaActual] = useState(new Date());
  const año = fechaActual.getFullYear();
  const mes = fechaActual.getMonth();

  const diasDelMes = useMemo(() => {
    const primerDia = new Date(año, mes, 1);
    const ultimoDia = new Date(año, mes + 1, 0);
    const diasEnMes = ultimoDia.getDate();
    const diaInicio = primerDia.getDay();

    const dias: Date[] = [];
    for (let i = 0; i < diaInicio; i++) {
      dias.push(new Date(año, mes, -diaInicio + i + 1));
    }
    for (let i = 1; i <= diasEnMes; i++) {
      dias.push(new Date(año, mes, i));
    }
    return dias;
  }, [año, mes]);

  const getTareasCount = (fecha: Date) => {
    return tareas.filter(t => 
      t.fechaLimite && 
      t.fechaLimite.toDateString() === fecha.toDateString()
    ).length;
  };

  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-3">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setFechaActual(new Date(año, mes - 1, 1))} className="p-1 hover:bg-slate-700 rounded">
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs font-medium">{mesesNombres[mes]} {año}</span>
        <button onClick={() => setFechaActual(new Date(año, mes + 1, 1))} className="p-1 hover:bg-slate-700 rounded">
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => (
          <div key={i} className="text-[10px] text-slate-500 py-1">{d}</div>
        ))}
        {diasDelMes.map((fecha, i) => {
          const count = getTareasCount(fecha);
          const esHoy = fecha.toDateString() === new Date().toDateString();
          const esMesActual = fecha.getMonth() === mes;

          return (
            <button
              key={i}
              onClick={() => onDateClick(fecha)}
              className={cn(
                'w-6 h-6 rounded text-[10px] relative transition-colors',
                esHoy && 'bg-emerald-500 text-slate-900 font-bold',
                !esHoy && esMesActual && 'hover:bg-slate-700',
                !esMesActual && 'text-slate-600'
              )}
            >
              {fecha.getDate()}
              {count > 0 && (
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}