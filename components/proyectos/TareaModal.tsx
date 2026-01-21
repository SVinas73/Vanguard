'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { Modal, Button, Input, Select, Card } from '@/components/ui';
import type { ProyectoTarea, ProyectoColumna, ProyectoEtiqueta, ProyectoSubtarea, ProyectoComentario } from '@/types';
import {
  Calendar,
  User,
  Tag,
  CheckSquare,
  MessageSquare,
  Paperclip,
  Clock,
  AlertTriangle,
  Plus,
  X,
  Send,
  Package,
  ShoppingCart,
  TrendingUp,
  RotateCcw,
  Wrench,
  Lock,
  Unlock,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

interface TareaModalProps {
  isOpen: boolean;
  onClose: () => void;
  proyectoId: string;
  tarea?: ProyectoTarea;
  columnas: ProyectoColumna[];
  etiquetas: ProyectoEtiqueta[];
  onSave: () => void;
}

export function TareaModal({
  isOpen,
  onClose,
  proyectoId,
  tarea,
  columnas,
  etiquetas,
  onSave,
}: TareaModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<'detalles' | 'subtareas' | 'comentarios' | 'adjuntos'>('detalles');

  // Form data
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    prioridad: 'media' as 'baja' | 'media' | 'alta' | 'urgente',
    columnaId: '',
    asignadoA: '',
    fechaLimite: '',
    fechaInicio: '',
    tiempoEstimadoHoras: '',
    progreso: 0,
    completado: false,
    bloqueado: false,
    razonBloqueo: '',
    productoCodigo: '',
    ordenCompraId: '',
    ordenVentaId: '',
    rmaId: '',
    ensamblajeId: '',
  });

  const [etiquetasSeleccionadas, setEtiquetasSeleccionadas] = useState<string[]>([]);
  const [subtareas, setSubtareas] = useState<ProyectoSubtarea[]>([]);
  const [nuevaSubtarea, setNuevaSubtarea] = useState('');
  const [comentarios, setComentarios] = useState<ProyectoComentario[]>([]);
  const [nuevoComentario, setNuevoComentario] = useState('');

  // Load data
  useEffect(() => {
    if (tarea) {
      setFormData({
        titulo: tarea.titulo,
        descripcion: tarea.descripcion || '',
        prioridad: tarea.prioridad,
        columnaId: tarea.columnaId || '',
        asignadoA: tarea.asignadoA || '',
        fechaLimite: tarea.fechaLimite ? tarea.fechaLimite.toISOString().split('T')[0] : '',
        fechaInicio: tarea.fechaInicio ? tarea.fechaInicio.toISOString().split('T')[0] : '',
        tiempoEstimadoHoras: tarea.tiempoEstimadoHoras?.toString() || '',
        progreso: tarea.progreso,
        completado: tarea.completado,
        bloqueado: tarea.bloqueado,
        razonBloqueo: tarea.razonBloqueo || '',
        productoCodigo: tarea.productoCodigo || '',
        ordenCompraId: tarea.ordenCompraId || '',
        ordenVentaId: tarea.ordenVentaId || '',
        rmaId: tarea.rmaId || '',
        ensamblajeId: tarea.ensamblajeId || '',
      });

      setEtiquetasSeleccionadas(tarea.etiquetas?.map(e => e.id) || []);
      setSubtareas(tarea.subtareas || []);
      
      // Cargar comentarios
      fetchComentarios(tarea.id);
    } else {
      // Default: primera columna
      if (columnas.length > 0) {
        setFormData(prev => ({ ...prev, columnaId: columnas[0].id }));
      }
    }
  }, [tarea, columnas]);

  const fetchComentarios = async (tareaId: string) => {
    const { data } = await supabase
      .from('proyecto_comentarios')
      .select('*')
      .eq('tarea_id', tareaId)
      .order('creado_at', { ascending: true });

    if (data) {
      setComentarios(data.map(c => ({
        id: c.id,
        tareaId: c.tarea_id,
        usuarioEmail: c.usuario_email,
        contenido: c.contenido,
        createdAt: new Date(c.creado_at),
        updatedAt: new Date(c.actualizado_at),
      })));
    }
  };

  // Handlers
  const handleSave = async () => {
    if (!formData.titulo.trim()) {
      alert('El título es obligatorio');
      return;
    }

    setLoading(true);

    try {
      const tareaData = {
        proyecto_id: proyectoId,
        columna_id: formData.columnaId || null,
        titulo: formData.titulo,
        descripcion: formData.descripcion || null,
        prioridad: formData.prioridad,
        fecha_limite: formData.fechaLimite || null,
        fecha_inicio: formData.fechaInicio || null,
        asignado_a: formData.asignadoA || null,
        tiempo_estimado_horas: formData.tiempoEstimadoHoras ? parseFloat(formData.tiempoEstimadoHoras) : null,
        progreso: formData.progreso,
        completado: formData.completado,
        bloqueado: formData.bloqueado,
        razon_bloqueo: formData.razonBloqueo || null,
        producto_codigo: formData.productoCodigo || null,
        orden_compra_id: formData.ordenCompraId || null,
        orden_venta_id: formData.ordenVentaId || null,
        rma_id: formData.rmaId || null,
        ensamblaje_id: formData.ensamblajeId || null,
        orden: tarea?.orden || 0,
      };

      let tareaId = tarea?.id;

      if (tarea) {
        // Update
        await supabase
          .from('proyecto_tareas')
          .update(tareaData)
          .eq('id', tarea.id);
      } else {
        // Create
        const { data, error } = await supabase
          .from('proyecto_tareas')
          .insert(tareaData)
          .select()
          .single();

        if (error) throw error;
        tareaId = data.id;
      }

      // Guardar etiquetas
      if (tareaId) {
        // Eliminar etiquetas anteriores
        await supabase
          .from('proyecto_tareas_etiquetas')
          .delete()
          .eq('tarea_id', tareaId);

        // Insertar nuevas etiquetas
        if (etiquetasSeleccionadas.length > 0) {
          await supabase
            .from('proyecto_tareas_etiquetas')
            .insert(
              etiquetasSeleccionadas.map(etId => ({
                tarea_id: tareaId,
                etiqueta_id: etId,
              }))
            );
        }

        // Guardar subtareas
        if (!tarea) {
          // Solo insertar subtareas si es una tarea nueva
          for (const sub of subtareas) {
            await supabase.from('proyecto_subtareas').insert({
              tarea_id: tareaId,
              titulo: sub.titulo,
              completado: sub.completado,
              orden: sub.orden,
            });
          }
        }
      }

      onSave();
    } catch (error) {
      console.error('Error guardando tarea:', error);
      alert('Error guardando tarea');
    } finally {
      setLoading(false);
    }
  };

  const handleAgregarSubtarea = () => {
    if (!nuevaSubtarea.trim()) return;

    setSubtareas([
      ...subtareas,
      {
        id: `temp-${Date.now()}`,
        tareaId: tarea?.id || '',
        titulo: nuevaSubtarea,
        completado: false,
        orden: subtareas.length,
        createdAt: new Date(),
      },
    ]);
    setNuevaSubtarea('');
  };

  const handleToggleSubtarea = async (subtareaId: string) => {
    const subtarea = subtareas.find(s => s.id === subtareaId);
    if (!subtarea) return;

    if (tarea && !subtareaId.startsWith('temp-')) {
      // Update en DB
      await supabase
        .from('proyecto_subtareas')
        .update({ completado: !subtarea.completado })
        .eq('id', subtareaId);
    }

    setSubtareas(subtareas.map(s =>
      s.id === subtareaId ? { ...s, completado: !s.completado } : s
    ));
  };

  const handleEliminarSubtarea = async (subtareaId: string) => {
    if (tarea && !subtareaId.startsWith('temp-')) {
      await supabase
        .from('proyecto_subtareas')
        .delete()
        .eq('id', subtareaId);
    }

    setSubtareas(subtareas.filter(s => s.id !== subtareaId));
  };

  const handleEnviarComentario = async () => {
    if (!nuevoComentario.trim() || !tarea) return;

    const { data, error } = await supabase
      .from('proyecto_comentarios')
      .insert({
        tarea_id: tarea.id,
        usuario_email: 'usuario@ejemplo.com', // Reemplazar con usuario actual
        contenido: nuevoComentario,
      })
      .select()
      .single();

    if (!error && data) {
      setComentarios([
        ...comentarios,
        {
          id: data.id,
          tareaId: data.tarea_id,
          usuarioEmail: data.usuario_email,
          contenido: data.contenido,
          createdAt: new Date(data.creado_at),
          updatedAt: new Date(data.actualizado_at),
        },
      ]);
      setNuevoComentario('');
    }
  };

  const prioridadOptions = [
    { value: 'baja', label: 'Baja' },
    { value: 'media', label: 'Media' },
    { value: 'alta', label: 'Alta' },
    { value: 'urgente', label: 'Urgente' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={tarea ? 'Editar Tarea' : 'Nueva Tarea'}
    >
      <div className="flex flex-col max-h-[80vh]">
        {/* Tabs - Fijos arriba */}
        <div className="flex gap-2 border-b border-slate-700/50 pb-2 mb-4">
          <button
            onClick={() => setActiveTab('detalles')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'detalles'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            Detalles
          </button>
          <button
            onClick={() => setActiveTab('subtareas')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'subtareas'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <div className="flex items-center gap-2">
              Subtareas
              {subtareas.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-slate-700 rounded-full">
                  {subtareas.filter(s => s.completado).length}/{subtareas.length}
                </span>
              )}
            </div>
          </button>
          {tarea && (
            <>
              <button
                onClick={() => setActiveTab('comentarios')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  activeTab === 'comentarios'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <div className="flex items-center gap-2">
                  Comentarios
                  {comentarios.length > 0 && (
                    <span className="px-1.5 py-0.5 text-xs bg-slate-700 rounded-full">
                      {comentarios.length}
                    </span>
                  )}
                </div>
              </button>
              <button
                onClick={() => setActiveTab('adjuntos')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  activeTab === 'adjuntos'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                Adjuntos
              </button>
            </>
          )}
        </div>

        {/* Tab: Detalles */}
        {activeTab === 'detalles' && (
          <div className="space-y-4">
            {/* Título */}
            <Input
              label="Título *"
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              placeholder="¿Qué hay que hacer?"
            />

            {/* Descripción */}
            <div>
              <label className="block text-sm text-slate-400 mb-2">Descripción</label>
              <textarea
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Detalles adicionales..."
                rows={4}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm resize-none"
              />
            </div>

            {/* Columna y Prioridad */}
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Columna"
                value={formData.columnaId}
                onChange={(e) => setFormData({ ...formData, columnaId: e.target.value })}
                options={columnas.map(c => ({ value: c.id, label: c.nombre }))}
              />

              <Select
                label="Prioridad"
                value={formData.prioridad}
                onChange={(e) => setFormData({ ...formData, prioridad: e.target.value as any })}
                options={prioridadOptions}
              />
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Fecha inicio"
                type="date"
                value={formData.fechaInicio}
                onChange={(e) => setFormData({ ...formData, fechaInicio: e.target.value })}
              />

              <Input
                label="Fecha límite"
                type="date"
                value={formData.fechaLimite}
                onChange={(e) => setFormData({ ...formData, fechaLimite: e.target.value })}
              />
            </div>

            {/* Asignado y Tiempo estimado */}
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Asignado a"
                value={formData.asignadoA}
                onChange={(e) => setFormData({ ...formData, asignadoA: e.target.value })}
                placeholder="Email del usuario"
              />

              <Input
                label="Tiempo estimado (horas)"
                type="number"
                step="0.5"
                value={formData.tiempoEstimadoHoras}
                onChange={(e) => setFormData({ ...formData, tiempoEstimadoHoras: e.target.value })}
                placeholder="0"
              />
            </div>

            {/* Progreso */}
            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Progreso: {formData.progreso}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={formData.progreso}
                onChange={(e) => setFormData({ ...formData, progreso: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>

            {/* Etiquetas */}
            <div>
              <label className="block text-sm text-slate-400 mb-2">Etiquetas</label>
              <div className="flex flex-wrap gap-2">
                {etiquetas.map(etiqueta => {
                  const isSelected = etiquetasSeleccionadas.includes(etiqueta.id);
                  return (
                    <button
                      key={etiqueta.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setEtiquetasSeleccionadas(etiquetasSeleccionadas.filter(id => id !== etiqueta.id));
                        } else {
                          setEtiquetasSeleccionadas([...etiquetasSeleccionadas, etiqueta.id]);
                        }
                      }}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm border transition-all',
                        isSelected
                          ? 'border-opacity-100'
                          : 'border-opacity-30 opacity-60 hover:opacity-100'
                      )}
                      style={{
                        backgroundColor: isSelected ? `${etiqueta.color}20` : 'transparent',
                        borderColor: etiqueta.color,
                        color: etiqueta.color,
                      }}
                    >
                      {etiqueta.nombre}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Vínculos */}
            <Card className="p-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Package size={16} />
                Vínculos a otras entidades
              </h4>
              <div className="space-y-3">
                <Input
                  label="Código de Producto"
                  value={formData.productoCodigo}
                  onChange={(e) => setFormData({ ...formData, productoCodigo: e.target.value })}
                  placeholder="Ej: PROD-001"
                />
                <Input
                  label="ID Orden de Compra"
                  value={formData.ordenCompraId}
                  onChange={(e) => setFormData({ ...formData, ordenCompraId: e.target.value })}
                  placeholder="UUID"
                />
                <Input
                  label="ID Orden de Venta"
                  value={formData.ordenVentaId}
                  onChange={(e) => setFormData({ ...formData, ordenVentaId: e.target.value })}
                  placeholder="UUID"
                />
                <Input
                  label="ID RMA"
                  value={formData.rmaId}
                  onChange={(e) => setFormData({ ...formData, rmaId: e.target.value })}
                  placeholder="UUID"
                />
                <Input
                  label="ID Ensamblaje"
                  value={formData.ensamblajeId}
                  onChange={(e) => setFormData({ ...formData, ensamblajeId: e.target.value })}
                  placeholder="UUID"
                />
              </div>
            </Card>

            {/* Estado */}
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/30 border border-slate-700/30 cursor-pointer hover:bg-slate-800/50 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.completado}
                  onChange={(e) => setFormData({ ...formData, completado: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500/20"
                />
                <span className="text-sm">Marcar como completada</span>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/30 border border-slate-700/30 cursor-pointer hover:bg-slate-800/50 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.bloqueado}
                  onChange={(e) => setFormData({ ...formData, bloqueado: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 text-red-500 focus:ring-red-500/20"
                />
                <span className="text-sm">Tarea bloqueada</span>
              </label>

              {formData.bloqueado && (
                <Input
                  label="Razón del bloqueo"
                  value={formData.razonBloqueo}
                  onChange={(e) => setFormData({ ...formData, razonBloqueo: e.target.value })}
                  placeholder="¿Por qué está bloqueada?"
                />
              )}
            </div>
          </div>
        )}

        {/* Tab: Subtareas */}
        {activeTab === 'subtareas' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={nuevaSubtarea}
                onChange={(e) => setNuevaSubtarea(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAgregarSubtarea()}
                placeholder="Nueva subtarea..."
                className="flex-1 px-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm"
              />
              <Button onClick={handleAgregarSubtarea} size="sm">
                <Plus size={18} />
              </Button>
            </div>

            <div className="space-y-2">
              {subtareas.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  No hay subtareas. Agregá una arriba.
                </div>
              ) : (
                subtareas.map(subtarea => (
                  <div
                    key={subtarea.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/30 border border-slate-700/30 group"
                  >
                    <input
                      type="checkbox"
                      checked={subtarea.completado}
                      onChange={() => handleToggleSubtarea(subtarea.id)}
                      className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500/20"
                    />
                    <span
                      className={cn(
                        'flex-1 text-sm',
                        subtarea.completado && 'line-through text-slate-500'
                      )}
                    >
                      {subtarea.titulo}
                    </span>
                    <button
                      onClick={() => handleEliminarSubtarea(subtarea.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded-lg text-red-400 transition-all"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab: Comentarios */}
        {activeTab === 'comentarios' && tarea && (
          <div className="space-y-4">
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {comentarios.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  No hay comentarios aún
                </div>
              ) : (
                comentarios.map(comentario => (
                  <div
                    key={comentario.id}
                    className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/30"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
                        {comentario.usuarioEmail.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs text-slate-400">
                        {comentario.usuarioEmail}
                      </span>
                      <span className="text-xs text-slate-600">•</span>
                      <span className="text-xs text-slate-600">
                        {formatDate(comentario.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300">{comentario.contenido}</p>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={nuevoComentario}
                onChange={(e) => setNuevoComentario(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleEnviarComentario()}
                placeholder="Escribí un comentario..."
                className="flex-1 px-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm"
              />
              <Button onClick={handleEnviarComentario} size="sm">
                <Send size={18} />
              </Button>
            </div>
          </div>
        )}

        {/* Tab: Adjuntos */}
        {activeTab === 'adjuntos' && tarea && (
          <div className="text-center py-12 text-slate-500">
            Funcionalidad de adjuntos próximamente
          </div>
        )}

        {/* Botones - Fijos abajo */}
        <div className="flex gap-3 pt-4 mt-4 border-t border-slate-700/50">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading} className="flex-1">
            {loading ? 'Guardando...' : tarea ? 'Guardar Cambios' : 'Crear Tarea'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}