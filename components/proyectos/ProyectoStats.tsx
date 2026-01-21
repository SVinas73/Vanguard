'use client';

import React, { useMemo } from 'react';
import { Card } from '@/components/ui';
import type { ProyectoTarea, ProyectoColumna, ProyectoStats as ProyectoStatsType } from '@/types';
import { CheckCircle2, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProyectoStatsProps {
  tareas: ProyectoTarea[];
  columnas: ProyectoColumna[];
}

export function ProyectoStats({ tareas, columnas }: ProyectoStatsProps) {
  const stats: ProyectoStatsType = useMemo(() => {
    const totalTareas = tareas.length;
    const tareasCompletadas = tareas.filter(t => t.completado).length;
    const tareasPendientes = totalTareas - tareasCompletadas;
    const tareasBloqueadas = tareas.filter(t => t.bloqueado).length;
    const porcentajeCompletado = totalTareas > 0 ? Math.round((tareasCompletadas / totalTareas) * 100) : 0;

    const tareasPorPrioridad = {
      urgente: tareas.filter(t => t.prioridad === 'urgente').length,
      alta: tareas.filter(t => t.prioridad === 'alta').length,
      media: tareas.filter(t => t.prioridad === 'media').length,
      baja: tareas.filter(t => t.prioridad === 'baja').length,
    };

    const tareasPorColumna = columnas.reduce((acc, col) => {
      acc[col.nombre] = tareas.filter(t => t.columnaId === col.id).length;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalTareas,
      tareasCompletadas,
      tareasPendientes,
      tareasBloqueadas,
      porcentajeCompletado,
      tareasPorPrioridad,
      tareasPorColumna,
    };
  }, [tareas, columnas]);

  return (
    <div className="grid grid-cols-4 gap-4">
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 size={24} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.porcentajeCompletado}%</p>
            <p className="text-xs text-slate-500">Completado</p>
          </div>
        </div>
        <div className="mt-3 h-2 bg-slate-700/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${stats.porcentajeCompletado}%` }}
          />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Clock size={24} className="text-blue-400" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.tareasPendientes}</p>
            <p className="text-xs text-slate-500">Pendientes</p>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <AlertTriangle size={24} className="text-amber-400" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.tareasBloqueadas}</p>
            <p className="text-xs text-slate-500">Bloqueadas</p>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <TrendingUp size={24} className="text-purple-400" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.totalTareas}</p>
            <p className="text-xs text-slate-500">Total Tareas</p>
          </div>
        </div>
      </Card>
    </div>
  );
}