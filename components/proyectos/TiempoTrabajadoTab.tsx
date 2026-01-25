'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Button, Input } from '@/components/ui';
import { cn, formatDate } from '@/lib/utils';
import {
  Clock,
  Play,
  Pause,
  Plus,
  Trash2,
  Calendar,
  User,
  Timer,
  BarChart3,
  X,
  Edit2,
  Check,
} from 'lucide-react';

interface TiempoRegistro {
  id: string;
  tareaId: string;
  usuarioEmail: string;
  fecha: Date;
  horas: number;
  descripcion: string | null;
  creadoAt: Date;
}

interface TiempoTrabajadoTabProps {
  tareaId: string;
  proyectoId: string;
  tiempoEstimado?: number | null;
}

export function TiempoTrabajadoTab({ tareaId, proyectoId, tiempoEstimado }: TiempoTrabajadoTabProps) {
  const { user } = useAuth();
  const [registros, setRegistros] = useState<TiempoRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form para nuevo registro
  const [showForm, setShowForm] = useState(false);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [horas, setHoras] = useState('');
  const [minutos, setMinutos] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [saving, setSaving] = useState(false);

  // Timer
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerStartTime, setTimerStartTime] = useState<Date | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Edición
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHoras, setEditHoras] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');

  useEffect(() => {
    fetchRegistros();
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [tareaId]);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [timerRunning]);

  const fetchRegistros = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('proyecto_tiempo_trabajado')
      .select('*')
      .eq('tarea_id', tareaId)
      .order('fecha', { ascending: false });

    if (data) {
      setRegistros(data.map(r => ({
        id: r.id,
        tareaId: r.tarea_id,
        usuarioEmail: r.usuario_email,
        fecha: new Date(r.fecha),
        horas: parseFloat(r.horas),
        descripcion: r.descripcion,
        creadoAt: new Date(r.creado_at),
      })));
    }
    setLoading(false);
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatHoras = (horas: number) => {
    const hrs = Math.floor(horas);
    const mins = Math.round((horas - hrs) * 60);
    if (hrs === 0) return `${mins}min`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}min`;
  };

  const totalHoras = registros.reduce((acc, r) => acc + r.horas, 0);
  const porcentajeCompletado = tiempoEstimado ? Math.min((totalHoras / tiempoEstimado) * 100, 100) : 0;

  const handleStartTimer = () => {
    setTimerStartTime(new Date());
    setTimerRunning(true);
  };

  const handlePauseTimer = () => {
    setTimerRunning(false);
  };

  const handleStopAndSaveTimer = async () => {
    if (timerSeconds < 60) {
      alert('El tiempo mínimo es 1 minuto');
      return;
    }

    setTimerRunning(false);
    const horasDecimal = timerSeconds / 3600;

    const { data, error } = await supabase
      .from('proyecto_tiempo_trabajado')
      .insert({
        tarea_id: tareaId,
        usuario_email: user?.email,
        fecha: new Date().toISOString().split('T')[0],
        horas: parseFloat(horasDecimal.toFixed(2)),
        descripcion: `Timer: ${formatTime(timerSeconds)}`,
      })
      .select()
      .single();

    if (!error && data) {
      setRegistros([{
        id: data.id,
        tareaId: data.tarea_id,
        usuarioEmail: data.usuario_email,
        fecha: new Date(data.fecha),
        horas: parseFloat(data.horas),
        descripcion: data.descripcion,
        creadoAt: new Date(data.creado_at),
      }, ...registros]);

      // Registrar actividad
      await supabase.from('proyecto_actividades').insert({
        proyecto_id: proyectoId,
        tarea_id: tareaId,
        usuario_email: user?.email,
        tipo: 'tiempo_registrado',
        descripcion: `Registró ${formatHoras(horasDecimal)} de trabajo`,
      });
    }

    setTimerSeconds(0);
    setTimerStartTime(null);
  };

  const handleResetTimer = () => {
    setTimerRunning(false);
    setTimerSeconds(0);
    setTimerStartTime(null);
  };

  const handleAddManual = async () => {
    const horasNum = parseFloat(horas) || 0;
    const minutosNum = parseFloat(minutos) || 0;
    const totalHorasDecimal = horasNum + (minutosNum / 60);

    if (totalHorasDecimal <= 0) {
      alert('Ingresá un tiempo válido');
      return;
    }

    setSaving(true);

    const { data, error } = await supabase
      .from('proyecto_tiempo_trabajado')
      .insert({
        tarea_id: tareaId,
        usuario_email: user?.email,
        fecha: fecha,
        horas: parseFloat(totalHorasDecimal.toFixed(2)),
        descripcion: descripcion || null,
      })
      .select()
      .single();

    if (!error && data) {
      setRegistros([{
        id: data.id,
        tareaId: data.tarea_id,
        usuarioEmail: data.usuario_email,
        fecha: new Date(data.fecha),
        horas: parseFloat(data.horas),
        descripcion: data.descripcion,
        creadoAt: new Date(data.creado_at),
      }, ...registros]);

      // Registrar actividad
      await supabase.from('proyecto_actividades').insert({
        proyecto_id: proyectoId,
        tarea_id: tareaId,
        usuario_email: user?.email,
        tipo: 'tiempo_registrado',
        descripcion: `Registró ${formatHoras(totalHorasDecimal)} de trabajo`,
      });

      // Reset form
      setHoras('');
      setMinutos('');
      setDescripcion('');
      setShowForm(false);
    }

    setSaving(false);
  };

  const handleDeleteRegistro = async (id: string) => {
    const confirmar = window.confirm('¿Eliminar este registro de tiempo?');
    if (!confirmar) return;

    const { error } = await supabase
      .from('proyecto_tiempo_trabajado')
      .delete()
      .eq('id', id);

    if (!error) {
      setRegistros(registros.filter(r => r.id !== id));
    }
  };

  const handleStartEdit = (registro: TiempoRegistro) => {
    setEditingId(registro.id);
    setEditHoras(registro.horas.toString());
    setEditDescripcion(registro.descripcion || '');
  };

  const handleSaveEdit = async (id: string) => {
    const horasNum = parseFloat(editHoras);
    if (isNaN(horasNum) || horasNum <= 0) {
      alert('Ingresá un tiempo válido');
      return;
    }

    const { error } = await supabase
      .from('proyecto_tiempo_trabajado')
      .update({
        horas: horasNum,
        descripcion: editDescripcion || null,
      })
      .eq('id', id);

    if (!error) {
      setRegistros(registros.map(r => 
        r.id === id ? { ...r, horas: horasNum, descripcion: editDescripcion || null } : r
      ));
      setEditingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Clock size={14} />
            <span className="text-xs">Tiempo registrado</span>
          </div>
          <p className="text-xl font-bold text-emerald-400">{formatHoras(totalHoras)}</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Timer size={14} />
            <span className="text-xs">Estimado</span>
          </div>
          <p className="text-xl font-bold">
            {tiempoEstimado ? formatHoras(tiempoEstimado) : '-'}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <BarChart3 size={14} />
            <span className="text-xs">Progreso</span>
          </div>
          <p className={cn(
            'text-xl font-bold',
            porcentajeCompletado > 100 ? 'text-red-400' : 
            porcentajeCompletado > 75 ? 'text-amber-400' : 'text-blue-400'
          )}>
            {tiempoEstimado ? `${Math.round(porcentajeCompletado)}%` : '-'}
          </p>
        </div>
      </div>

      {/* Barra de progreso */}
      {tiempoEstimado && tiempoEstimado > 0 && (
        <div className="space-y-1">
          <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-500',
                porcentajeCompletado > 100 ? 'bg-red-500' :
                porcentajeCompletado > 75 ? 'bg-amber-500' : 'bg-emerald-500'
              )}
              style={{ width: `${Math.min(porcentajeCompletado, 100)}%` }}
            />
          </div>
          {porcentajeCompletado > 100 && (
            <p className="text-xs text-red-400">
              ⚠️ Excedido por {formatHoras(totalHoras - tiempoEstimado)}
            </p>
          )}
        </div>
      )}

      {/* Timer */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Timer size={16} className="text-emerald-400" />
              Timer en vivo
            </h4>
            <p className="text-3xl font-mono font-bold mt-2">
              {formatTime(timerSeconds)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!timerRunning ? (
              <Button onClick={handleStartTimer} size="sm">
                <Play size={16} className="mr-1" />
                {timerSeconds > 0 ? 'Continuar' : 'Iniciar'}
              </Button>
            ) : (
              <Button onClick={handlePauseTimer} size="sm" variant="secondary">
                <Pause size={16} className="mr-1" />
                Pausar
              </Button>
            )}

            {timerSeconds > 0 && (
              <>
                <Button 
                  onClick={handleStopAndSaveTimer} 
                  size="sm" 
                  className="bg-emerald-600 hover:bg-emerald-500"
                >
                  <Check size={16} className="mr-1" />
                  Guardar
                </Button>
                <button
                  onClick={handleResetTimer}
                  className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-slate-200"
                  title="Reiniciar"
                >
                  <X size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Agregar manual */}
      <div>
        {!showForm ? (
          <Button onClick={() => setShowForm(true)} variant="secondary" className="w-full">
            <Plus size={16} className="mr-2" />
            Agregar tiempo manualmente
          </Button>
        ) : (
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Registrar tiempo</h4>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-200">
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
              <Input
                label="Horas"
                type="number"
                min="0"
                max="24"
                value={horas}
                onChange={(e) => setHoras(e.target.value)}
                placeholder="0"
              />
              <Input
                label="Minutos"
                type="number"
                min="0"
                max="59"
                value={minutos}
                onChange={(e) => setMinutos(e.target.value)}
                placeholder="0"
              />
            </div>

            <Input
              label="Descripción (opcional)"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="¿En qué trabajaste?"
            />

            <div className="flex gap-2">
              <Button onClick={() => setShowForm(false)} variant="secondary" className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleAddManual} disabled={saving} className="flex-1">
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Lista de registros */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-slate-400">
          Registros ({registros.length})
        </h4>

        {loading ? (
          <div className="text-center py-8 text-slate-500">
            Cargando...
          </div>
        ) : registros.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            <Clock size={32} className="mx-auto mb-2 opacity-50" />
            No hay tiempo registrado
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {registros.map(registro => (
              <div
                key={registro.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/30 border border-slate-700/30 group hover:bg-slate-800/50 transition-colors"
              >
                {editingId === registro.id ? (
                  // Modo edición
                  <>
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="number"
                        step="0.25"
                        value={editHoras}
                        onChange={(e) => setEditHoras(e.target.value)}
                        className="w-20 px-2 py-1 rounded bg-slate-700 border border-slate-600 text-sm"
                      />
                      <span className="text-sm text-slate-400">horas</span>
                      <input
                        type="text"
                        value={editDescripcion}
                        onChange={(e) => setEditDescripcion(e.target.value)}
                        placeholder="Descripción"
                        className="flex-1 px-2 py-1 rounded bg-slate-700 border border-slate-600 text-sm"
                      />
                    </div>
                    <button
                      onClick={() => handleSaveEdit(registro.id)}
                      className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  // Modo vista
                  <>
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                      <Clock size={16} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">
                          {formatHoras(registro.horas)}
                        </p>
                        <span className="text-xs text-slate-500">•</span>
                        <span className="text-xs text-slate-500">
                          {registro.fecha.toLocaleDateString('es-AR', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>
                      {registro.descripcion && (
                        <p className="text-xs text-slate-400 truncate">{registro.descripcion}</p>
                      )}
                      <p className="text-xs text-slate-600">{registro.usuarioEmail}</p>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {registro.usuarioEmail === user?.email && (
                        <>
                          <button
                            onClick={() => handleStartEdit(registro)}
                            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200"
                            title="Editar"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteRegistro(registro.id)}
                            className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400"
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}