'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { ProyectoTarea, ProyectoColumna } from '@/types';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  PieChart,
} from 'lucide-react';

interface ProyectoChartsProps {
  tareas: ProyectoTarea[];
  columnas: ProyectoColumna[];
  fechaInicio?: Date;
  fechaFin?: Date;
}

export function ProyectoCharts({ tareas, columnas, fechaInicio, fechaFin }: ProyectoChartsProps) {
  // Calcular métricas
  const metricas = useMemo(() => {
    const total = tareas.length;
    const completadas = tareas.filter(t => t.completado).length;
    const enProgreso = tareas.filter(t => !t.completado && !t.bloqueado).length;
    const bloqueadas = tareas.filter(t => t.bloqueado).length;
    const vencidas = tareas.filter(t => 
      t.fechaLimite && 
      new Date(t.fechaLimite) < new Date() && 
      !t.completado
    ).length;

    const porcentajeCompletado = total > 0 ? Math.round((completadas / total) * 100) : 0;

    // Tiempo estimado vs real
    const tiempoEstimadoTotal = tareas.reduce((acc, t) => acc + (t.tiempoEstimadoHoras || 0), 0);
    const tiempoRealTotal = tareas.reduce((acc, t) => acc + (t.tiempoRealHoras || 0), 0);

    // Tareas por columna
    const tareasPorColumna = columnas.map(col => ({
      columna: col,
      cantidad: tareas.filter(t => t.columnaId === col.id).length,
      completadas: tareas.filter(t => t.columnaId === col.id && t.completado).length,
    }));

    // Tareas por prioridad
    const tareasPorPrioridad = {
      urgente: tareas.filter(t => t.prioridad === 'urgente').length,
      alta: tareas.filter(t => t.prioridad === 'alta').length,
      media: tareas.filter(t => t.prioridad === 'media').length,
      baja: tareas.filter(t => t.prioridad === 'baja').length,
    };

    // Progreso promedio
    const progresoPromedio = total > 0 
      ? Math.round(tareas.reduce((acc, t) => acc + t.progreso, 0) / total)
      : 0;

    return {
      total,
      completadas,
      enProgreso,
      bloqueadas,
      vencidas,
      porcentajeCompletado,
      tiempoEstimadoTotal,
      tiempoRealTotal,
      tareasPorColumna,
      tareasPorPrioridad,
      progresoPromedio,
    };
  }, [tareas, columnas]);

  // Generar datos para burndown (simulado basado en fechas de completado)
  const burndownData = useMemo(() => {
    if (!fechaInicio || !fechaFin) return [];

    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    const diasTotal = Math.ceil((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
    const tareasPorDia = metricas.total / diasTotal;

    const data = [];
    const ahora = new Date();

    for (let i = 0; i <= diasTotal; i++) {
      const fecha = new Date(inicio);
      fecha.setDate(fecha.getDate() + i);

      // Ideal (línea recta descendente)
      const ideal = Math.max(0, metricas.total - (tareasPorDia * i));

      // Real (basado en tareas completadas hasta esa fecha)
      const completadasHastaFecha = fecha <= ahora
        ? tareas.filter(t => 
            t.completado && 
            t.fechaCompletado && 
            new Date(t.fechaCompletado) <= fecha
          ).length
        : null;

      const real = completadasHastaFecha !== null 
        ? metricas.total - completadasHastaFecha 
        : null;

      data.push({
        fecha: fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
        ideal: Math.round(ideal),
        real,
      });
    }

    return data;
  }, [tareas, metricas.total, fechaInicio, fechaFin]);

  return (
    <div className="space-y-6">
      {/* Métricas principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<Target size={20} />}
          label="Completadas"
          value={metricas.completadas}
          total={metricas.total}
          color="emerald"
        />
        <MetricCard
          icon={<Clock size={20} />}
          label="En Progreso"
          value={metricas.enProgreso}
          total={metricas.total}
          color="blue"
        />
        <MetricCard
          icon={<AlertCircle size={20} />}
          label="Bloqueadas"
          value={metricas.bloqueadas}
          total={metricas.total}
          color="red"
        />
        <MetricCard
          icon={<TrendingDown size={20} />}
          label="Vencidas"
          value={metricas.vencidas}
          total={metricas.total}
          color="amber"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Gráfico de Progreso Circular */}
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <PieChart size={18} className="text-emerald-400" />
            Progreso General
          </h3>
          
          <div className="flex items-center justify-center">
            <div className="relative w-40 h-40">
              {/* SVG Circular */}
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  className="fill-none stroke-slate-700"
                  strokeWidth="12"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  className="fill-none stroke-emerald-500"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 70}`}
                  strokeDashoffset={`${2 * Math.PI * 70 * (1 - metricas.porcentajeCompletado / 100)}`}
                  style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-emerald-400">
                  {metricas.porcentajeCompletado}%
                </span>
                <span className="text-xs text-slate-500">completado</span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <div className="text-lg font-semibold text-emerald-400">{metricas.completadas}</div>
              <div className="text-xs text-slate-500">Completadas</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-blue-400">{metricas.enProgreso}</div>
              <div className="text-xs text-slate-500">En progreso</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-slate-400">{metricas.total}</div>
              <div className="text-xs text-slate-500">Total</div>
            </div>
          </div>
        </div>

        {/* Distribución por Columna */}
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <BarChart3 size={18} className="text-blue-400" />
            Distribución por Estado
          </h3>
          
          <div className="space-y-3">
            {metricas.tareasPorColumna.map(({ columna, cantidad, completadas }) => (
              <div key={columna.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm flex items-center gap-2">
                    {columna.color && (
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: columna.color }}
                      />
                    )}
                    {columna.nombre}
                  </span>
                  <span className="text-sm text-slate-400">{cantidad}</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${metricas.total > 0 ? (cantidad / metricas.total) * 100 : 0}%`,
                      backgroundColor: columna.color || '#10b981',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Distribución por Prioridad */}
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
          <h3 className="font-semibold mb-4">Distribución por Prioridad</h3>
          
          <div className="space-y-3">
            <PrioridadBar 
              label="Urgente" 
              count={metricas.tareasPorPrioridad.urgente} 
              total={metricas.total}
              color="bg-red-500"
            />
            <PrioridadBar 
              label="Alta" 
              count={metricas.tareasPorPrioridad.alta} 
              total={metricas.total}
              color="bg-orange-500"
            />
            <PrioridadBar 
              label="Media" 
              count={metricas.tareasPorPrioridad.media} 
              total={metricas.total}
              color="bg-blue-500"
            />
            <PrioridadBar 
              label="Baja" 
              count={metricas.tareasPorPrioridad.baja} 
              total={metricas.total}
              color="bg-slate-500"
            />
          </div>
        </div>

        {/* Tiempo Estimado vs Real */}
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Clock size={18} className="text-amber-400" />
            Tiempo Estimado vs Real
          </h3>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1 text-sm">
                <span className="text-slate-400">Estimado</span>
                <span className="text-slate-200">{metricas.tiempoEstimadoTotal}h</span>
              </div>
              <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full"
                  style={{ 
                    width: metricas.tiempoEstimadoTotal > 0 ? '100%' : '0%' 
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1 text-sm">
                <span className="text-slate-400">Real</span>
                <span className={cn(
                  metricas.tiempoRealTotal > metricas.tiempoEstimadoTotal 
                    ? 'text-red-400' 
                    : 'text-emerald-400'
                )}>
                  {metricas.tiempoRealTotal}h
                </span>
              </div>
              <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    'h-full rounded-full transition-all',
                    metricas.tiempoRealTotal > metricas.tiempoEstimadoTotal 
                      ? 'bg-red-500' 
                      : 'bg-emerald-500'
                  )}
                  style={{ 
                    width: metricas.tiempoEstimadoTotal > 0 
                      ? `${Math.min(100, (metricas.tiempoRealTotal / metricas.tiempoEstimadoTotal) * 100)}%`
                      : '0%'
                  }}
                />
              </div>
            </div>

            {metricas.tiempoEstimadoTotal > 0 && (
              <div className="text-center pt-2">
                <span className={cn(
                  'text-sm font-medium',
                  metricas.tiempoRealTotal > metricas.tiempoEstimadoTotal 
                    ? 'text-red-400' 
                    : 'text-emerald-400'
                )}>
                  {metricas.tiempoRealTotal > metricas.tiempoEstimadoTotal ? (
                    <>+{metricas.tiempoRealTotal - metricas.tiempoEstimadoTotal}h sobre el estimado</>
                  ) : (
                    <>{metricas.tiempoEstimadoTotal - metricas.tiempoRealTotal}h restantes</>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Burndown Chart (si hay fechas) */}
      {burndownData.length > 0 && metricas.total > 0 && (
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingDown size={18} className="text-purple-400" />
            Burndown Chart
          </h3>
          
          <div className="h-64 flex items-end gap-1 relative">
            {burndownData.map((point, i) => {
              const idealHeight = Math.min(100, Math.max(0, (point.ideal / metricas.total) * 100));
              const realHeight = point.real !== null 
                ? Math.min(100, Math.max(0, (point.real / metricas.total) * 100))
                : null;
              
              return (
                <div key={i} className="flex-1 h-full flex flex-col justify-end relative">
                  {/* Barra ideal */}
                  <div 
                    className="w-full bg-slate-600/50 rounded-t"
                    style={{ 
                      height: `${idealHeight}%`,
                      minHeight: '2px'
                    }}
                  />
                  {/* Barra real */}
                  {realHeight !== null && point.real !== null && (
                    <div 
                      className={cn(
                        'w-full rounded-t absolute bottom-0',
                        point.real > point.ideal ? 'bg-red-500/70' : 'bg-emerald-500/70'
                      )}
                      style={{ 
                        height: `${realHeight}%`,
                        minHeight: '2px',
                        maxHeight: '100%'
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
          
          <div className="flex justify-between mt-2 text-xs text-slate-500">
            <span>{burndownData[0]?.fecha}</span>
            <span>{burndownData[burndownData.length - 1]?.fecha}</span>
          </div>

          <div className="flex justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-slate-600 rounded" />
              <span className="text-slate-400">Ideal</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-emerald-500 rounded" />
              <span className="text-slate-400">Real</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Componentes auxiliares
function MetricCard({ 
  icon, 
  label, 
  value, 
  total, 
  color 
}: { 
  icon: React.ReactNode;
  label: string;
  value: number;
  total: number;
  color: 'emerald' | 'blue' | 'red' | 'amber';
}) {
  const colorClasses = {
    emerald: 'text-emerald-400 bg-emerald-500/20',
    blue: 'text-blue-400 bg-blue-500/20',
    red: 'text-red-400 bg-red-500/20',
    amber: 'text-amber-400 bg-amber-500/20',
  };

  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center mb-3', colorClasses[color])}>
        {icon}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-xs text-slate-600 mt-1">
        {total > 0 ? Math.round((value / total) * 100) : 0}% del total
      </div>
    </div>
  );
}

function PrioridadBar({ 
  label, 
  count, 
  total, 
  color 
}: { 
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const porcentaje = total > 0 ? (count / total) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-slate-400">{label}</span>
        <span className="text-sm">{count}</span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  );
}