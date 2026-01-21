'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { Button, Card, Select, Modal } from '@/components/ui';
import { KanbanBoard } from './KanbanBoard';
import { ProyectoModal } from './ProyectoModal';
import { TareaModal } from './TareaModal';
import { ProyectoStats } from './ProyectoStats';
import type { Proyecto, ProyectoTarea, ProyectoColumna, ProyectoEtiqueta } from '@/types';
import {
  Plus,
  Settings,
  Archive,
  CheckCircle,
  TrendingUp,
  Clock,
  AlertTriangle,
  Filter,
  Search,
} from 'lucide-react';

export function ProyectosDashboard() {
  const { t } = useTranslation();
  
  // State
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [proyectoActual, setProyectoActual] = useState<Proyecto | null>(null);
  const [columnas, setColumnas] = useState<ProyectoColumna[]>([]);
  const [tareas, setTareas] = useState<ProyectoTarea[]>([]);
  const [etiquetas, setEtiquetas] = useState<ProyectoEtiqueta[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [showProyectoModal, setShowProyectoModal] = useState(false);
  const [showTareaModal, setShowTareaModal] = useState(false);
  const [tareaEdit, setTareaEdit] = useState<ProyectoTarea | null>(null);
  
  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activo' | 'completado' | 'archivado'>('activo');
  const [filtroAsignado, setFiltroAsignado] = useState<string>('');
  const [filtroPrioridad, setFiltroPrioridad] = useState<string>('');
  const [filtroEtiqueta, setFiltroEtiqueta] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // ============================================
  // CARGAR PROYECTOS
  // ============================================
  
  useEffect(() => {
    fetchProyectos();
  }, []);

  useEffect(() => {
    if (proyectoActual) {
      fetchProyectoData(proyectoActual.id);
    }
  }, [proyectoActual]);

  const fetchProyectos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('proyectos')
      .select('*')
      .order('creado_at', { ascending: false });

    if (error) {
      console.error('Error cargando proyectos:', error);
    } else {
      const mapped = (data || []).map(mapProyecto);
      setProyectos(mapped);
      
      // Seleccionar primer proyecto activo
      const primerActivo = mapped.find(p => p.estado === 'activo');
      if (primerActivo) {
        setProyectoActual(primerActivo);
      }
    }
    setLoading(false);
  };

  const fetchProyectoData = async (proyectoId: string) => {
    // Cargar columnas
    const { data: colsData } = await supabase
      .from('proyecto_columnas')
      .select('*')
      .eq('proyecto_id', proyectoId)
      .order('orden');

    setColumnas((colsData || []).map(mapColumna));

    // Cargar tareas con relaciones
    const { data: tareasData } = await supabase
      .from('proyecto_tareas')
      .select(`
        *,
        subtareas:proyecto_subtareas(*),
        etiquetas:proyecto_tareas_etiquetas(etiqueta:proyecto_etiquetas(*))
      `)
      .eq('proyecto_id', proyectoId)
      .order('orden');

    setTareas((tareasData || []).map(mapTarea));

    // Cargar etiquetas
    const { data: etiqData } = await supabase
      .from('proyecto_etiquetas')
      .select('*')
      .eq('proyecto_id', proyectoId);

    setEtiquetas((etiqData || []).map(mapEtiqueta));
  };

  // ============================================
  // MAPPERS
  // ============================================
  
  const mapProyecto = (p: any): Proyecto => ({
    id: p.id,
    nombre: p.nombre,
    descripcion: p.descripcion,
    color: p.color || '#10b981',
    estado: p.estado,
    fechaInicio: p.fecha_inicio ? new Date(p.fecha_inicio) : undefined,
    fechaFin: p.fecha_fin ? new Date(p.fecha_fin) : undefined,
    creadoPor: p.creado_por,
    createdAt: new Date(p.creado_at),
    updatedAt: new Date(p.actualizado_at),
  });

  const mapColumna = (c: any): ProyectoColumna => ({
    id: c.id,
    proyectoId: c.proyecto_id,
    nombre: c.nombre,
    orden: c.orden,
    color: c.color,
    limiteWip: c.limite_wip,
    createdAt: new Date(c.creado_at),
  });

  const mapTarea = (t: any): ProyectoTarea => ({
    id: t.id,
    proyectoId: t.proyecto_id,
    columnaId: t.columna_id,
    titulo: t.titulo,
    descripcion: t.descripcion,
    prioridad: t.prioridad,
    orden: t.orden,
    fechaLimite: t.fecha_limite ? new Date(t.fecha_limite) : undefined,
    fechaInicio: t.fecha_inicio ? new Date(t.fecha_inicio) : undefined,
    fechaCompletado: t.fecha_completado ? new Date(t.fecha_completado) : undefined,
    asignadoA: t.asignado_a,
    productoCodigo: t.producto_codigo,
    ordenCompraId: t.orden_compra_id,
    ordenVentaId: t.orden_venta_id,
    rmaId: t.rma_id,
    ensamblajeId: t.ensamblaje_id,
    completado: t.completado,
    bloqueado: t.bloqueado,
    razonBloqueo: t.razon_bloqueo,
    tiempoEstimadoHoras: t.tiempo_estimado_horas,
    tiempoRealHoras: t.tiempo_real_horas,
    progreso: t.progreso,
    subtareas: (t.subtareas || []).map((s: any) => ({
      id: s.id,
      tareaId: s.tarea_id,
      titulo: s.titulo,
      completado: s.completado,
      orden: s.orden,
      createdAt: new Date(s.creado_at),
    })),
    etiquetas: (t.etiquetas || []).map((e: any) => e.etiqueta).filter(Boolean),
    creadoPor: t.creado_por,
    createdAt: new Date(t.creado_at),
    actualizadoPor: t.actualizado_por,
    updatedAt: new Date(t.actualizado_at),
  });

  const mapEtiqueta = (e: any): ProyectoEtiqueta => ({
    id: e.id,
    proyectoId: e.proyecto_id,
    nombre: e.nombre,
    color: e.color,
    createdAt: new Date(e.creado_at),
  });

  // ============================================
  // HANDLERS
  // ============================================
  
  const handleNuevoProyecto = async (proyecto: Omit<Proyecto, 'id' | 'createdAt' | 'updatedAt'>) => {
    const { data, error } = await supabase
      .from('proyectos')
      .insert({
        nombre: proyecto.nombre,
        descripcion: proyecto.descripcion,
        color: proyecto.color,
        estado: proyecto.estado,
        fecha_inicio: proyecto.fechaInicio?.toISOString(),
        fecha_fin: proyecto.fechaFin?.toISOString(),
        creado_por: proyecto.creadoPor,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creando proyecto:', error);
      return;
    }

    // Crear columnas por defecto
    const columnasDefault = [
      { nombre: 'Por hacer', orden: 0 },
      { nombre: 'En proceso', orden: 1 },
      { nombre: 'Revisión', orden: 2 },
      { nombre: 'Completado', orden: 3 },
    ];

    await supabase.from('proyecto_columnas').insert(
      columnasDefault.map(c => ({
        proyecto_id: data.id,
        ...c,
      }))
    );

    fetchProyectos();
    setShowProyectoModal(false);
  };

  const handleNuevaTarea = () => {
    setTareaEdit(null);
    setShowTareaModal(true);
  };

  const handleEditarTarea = (tarea: ProyectoTarea) => {
    setTareaEdit(tarea);
    setShowTareaModal(true);
  };

  // Aplicar filtros
  const tareasFiltradas = tareas.filter(t => {
    if (searchQuery && !t.titulo.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filtroAsignado && t.asignadoA !== filtroAsignado) return false;
    if (filtroPrioridad && t.prioridad !== filtroPrioridad) return false;
    if (filtroEtiqueta && !t.etiquetas?.some(e => e.id === filtroEtiqueta)) return false;
    return true;
  });

  // ============================================
  // RENDER
  // ============================================
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-emerald-400">Cargando proyectos...</div>
      </div>
    );
  }

  

  if (proyectos.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="w-20 h-20 bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <TrendingUp size={40} className="text-slate-600" />
        </div>
        <h2 className="text-2xl font-bold mb-3">No hay proyectos</h2>
        <p className="text-slate-400 mb-6">
          Creá tu primer proyecto para organizar tareas y gestionar el trabajo del equipo
        </p>
        <Button onClick={() => setShowProyectoModal(true)}>
          <Plus size={18} className="mr-2" />
          Crear Primer Proyecto
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select
            options={proyectos.map(p => ({ value: p.id, label: p.nombre }))}
            value={proyectoActual?.id || ''}
            onChange={(e) => {
              const p = proyectos.find(pr => pr.id === e.target.value);
              if (p) setProyectoActual(p);
            }}
            className="min-w-[250px]"
          />
          
          {proyectoActual && (
            <div
              className="w-6 h-6 rounded-full border-2 border-slate-700"
              style={{ backgroundColor: proyectoActual.color }}
            />
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm">
            <Filter size={18} />
          </Button>
          <Button variant="secondary" onClick={() => setShowProyectoModal(true)}>
            <Plus size={18} className="mr-2" />
            Nuevo Proyecto
          </Button>
          <Button onClick={handleNuevaTarea}>
            <Plus size={18} className="mr-2" />
            Nueva Tarea
          </Button>
        </div>
      </div>

      {/* Stats */}
      {proyectoActual && (
        <ProyectoStats 
          tareas={tareas}
          columnas={columnas}
        />
      )}

      {/* Filtros */}
      <Card className="p-4">
        <div className="grid grid-cols-4 gap-4">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar tareas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm"
            />
          </div>

          <Select
            placeholder="Prioridad"
            options={[
              { value: '', label: 'Todas las prioridades' },
              { value: 'urgente', label: 'Urgente' },
              { value: 'alta', label: 'Alta' },
              { value: 'media', label: 'Media' },
              { value: 'baja', label: 'Baja' },
            ]}
            value={filtroPrioridad}
            onChange={(e) => setFiltroPrioridad(e.target.value)}
          />

          <Select
            placeholder="Asignado"
            options={[
              { value: '', label: 'Todos los usuarios' },
              // Aquí deberías cargar los usuarios reales
            ]}
            value={filtroAsignado}
            onChange={(e) => setFiltroAsignado(e.target.value)}
          />

          <Select
            placeholder="Etiqueta"
            options={[
              { value: '', label: 'Todas las etiquetas' },
              ...etiquetas.map(e => ({ value: e.id, label: e.nombre }))
            ]}
            value={filtroEtiqueta}
            onChange={(e) => setFiltroEtiqueta(e.target.value)}
          />
        </div>
      </Card>

      {/* Kanban Board */}
      {proyectoActual && (
        <KanbanBoard
          columnas={columnas}
          tareas={tareasFiltradas}
          onTareaClick={handleEditarTarea}
          onTareaMover={async (tareaId, nuevaColumnaId, nuevoOrden) => {
            await supabase
              .from('proyecto_tareas')
              .update({ columna_id: nuevaColumnaId, orden: nuevoOrden })
              .eq('id', tareaId);
            fetchProyectoData(proyectoActual.id);
          }}
        />
      )}

      {/* Modals */}
      {showProyectoModal && (
        <ProyectoModal
          isOpen={showProyectoModal}
          onClose={() => setShowProyectoModal(false)}
          onSave={handleNuevoProyecto}
        />
      )}

      {showTareaModal && proyectoActual && (
        <TareaModal
          isOpen={showTareaModal}
          onClose={() => setShowTareaModal(false)}
          proyectoId={proyectoActual.id}
          tarea={tareaEdit || undefined}
          columnas={columnas}
          etiquetas={etiquetas}
          onSave={() => {
            fetchProyectoData(proyectoActual.id);
            setShowTareaModal(false);
          }}
        />
      )}
    </div>
  );
}