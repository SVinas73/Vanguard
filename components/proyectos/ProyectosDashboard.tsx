'use client';

import { ProyectoMiembrosModal } from './ProyectoMiembrosModal';
import { TareaModal } from './TareaModal';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Button, Card, Select } from '@/components/ui';
import { KanbanBoard } from './KanbanBoard';
import { TareasListView } from './TareasListView';
import { TareasCalendarView, MiniCalendar } from './TareasCalendarView';
import { ProyectoStats } from './ProyectoStats';
import { ProyectoCharts } from './ProyectoCharts';
import { ActividadFeed, ActividadReciente } from './ActividadFeed';
import { PlantillasProyecto, CrearDesdeTemplateModal } from './PlantillasProyecto';
import { useProyectoShortcuts, KeyboardShortcutsHelp } from './useKeyboardShortcuts';
import type { Proyecto, ProyectoTarea, ProyectoColumna, ProyectoEtiqueta } from '@/types';
import { cn } from '@/lib/utils';
import {
  Plus,
  TrendingUp,
  Filter,
  Search,
  X,
  ChevronDown,
  RotateCcw,
  LayoutGrid,
  List,
  Calendar,
  BarChart3,
  Activity,
  Settings,
  Keyboard,
  PanelRightOpen,
  PanelRightClose,
  RefreshCw,
  Users,
} from 'lucide-react';

// Tipos de vista disponibles
type VistaProyecto = 'kanban' | 'lista' | 'calendario' | 'metricas';

// Interfaz para plantilla
interface PlantillaProyecto {
  id: string;
  nombre: string;
  descripcion: string;
  color: string;
  columnasConfig: { nombre: string; orden: number; color?: string; limite_wip?: number }[];
  tareasConfig: { titulo: string; prioridad: string; columna_index: number }[];
  etiquetasConfig: { nombre: string; color: string }[];
  esPublica: boolean;
}

export function ProyectosDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();

  // ============================================
  // STATE PRINCIPAL
  // ============================================
  
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [proyectoActual, setProyectoActual] = useState<Proyecto | null>(null);
  const [columnas, setColumnas] = useState<ProyectoColumna[]>([]);
  const [tareas, setTareas] = useState<ProyectoTarea[]>([]);
  const [etiquetas, setEtiquetas] = useState<ProyectoEtiqueta[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ============================================
  // STATE DE VISTAS Y UI
  // ============================================
  
  const [vistaActual, setVistaActual] = useState<VistaProyecto>('kanban');
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'actividad' | 'calendario'>('actividad');

  // ============================================
  // STATE DE MODALES
  // ============================================
  
  const [showProyectoModal, setShowProyectoModal] = useState(false);
  const [showPlantillasModal, setShowPlantillasModal] = useState(false);
  const [showTareaModal, setShowTareaModal] = useState(false);
  const [showColumnaModal, setShowColumnaModal] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showCrearDesdeTemplate, setShowCrearDesdeTemplate] = useState(false);
  const [showMiembrosModal, setShowMiembrosModal] = useState(false);
  
  const [tareaEdit, setTareaEdit] = useState<ProyectoTarea | null>(null);
  const [tareaSeleccionada, setTareaSeleccionada] = useState<ProyectoTarea | null>(null);
  const [columnaPreseleccionada, setColumnaPreseleccionada] = useState<string | null>(null);
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<PlantillaProyecto | null>(null);
  const [nuevaColumnaNombre, setNuevaColumnaNombre] = useState('');

  // ============================================
  // STATE DE FILTROS
  // ============================================
  
  const [showFiltrosAvanzados, setShowFiltrosAvanzados] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtroPrioridad, setFiltroPrioridad] = useState<string>('');
  const [filtroAsignado, setFiltroAsignado] = useState<string>('');
  const [filtroEtiqueta, setFiltroEtiqueta] = useState<string>('');
  const [filtroEstado, setFiltroEstado] = useState<string>('');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState<string>('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState<string>('');
  const [filtroColumna, setFiltroColumna] = useState<string>('');

  // ============================================
  // KEYBOARD SHORTCUTS
  // ============================================
  
  const { showHelp, setShowHelp } = useProyectoShortcuts({
    onNuevaTarea: () => handleNuevaTarea(),
    onNuevoProyecto: () => setShowPlantillasModal(true),
    onBuscar: () => document.getElementById('search-input')?.focus(),
    onCerrarModal: () => {
      if (showTareaModal) setShowTareaModal(false);
      else if (showProyectoModal) setShowProyectoModal(false);
      else if (showPlantillasModal) setShowPlantillasModal(false);
      else if (showShortcutsHelp) setShowShortcutsHelp(false);
    },
    onGuardar: () => {/* El modal maneja su propio guardado */},
    onToggleVista: () => {
      const vistas: VistaProyecto[] = ['kanban', 'lista', 'calendario', 'metricas'];
      const currentIndex = vistas.indexOf(vistaActual);
      setVistaActual(vistas[(currentIndex + 1) % vistas.length]);
    },
    onToggleFiltros: () => setShowFiltrosAvanzados(!showFiltrosAvanzados),
    onRefresh: () => handleRefresh(),
    onEditarTarea: () => {
      if (tareaSeleccionada) handleEditarTarea(tareaSeleccionada);
    },
    onEliminarTarea: () => {
      if (tareaSeleccionada) handleDeleteTarea(tareaSeleccionada.id);
    },
    onDuplicarTarea: () => {
      if (tareaSeleccionada) handleDuplicateTarea(tareaSeleccionada);
    },
    onCompletarTarea: () => {
      if (tareaSeleccionada) {
        handleUpdateTarea(tareaSeleccionada.id, { completado: !tareaSeleccionada.completado });
      }
    },
  });

  // Sincronizar estado de ayuda de shortcuts
  useEffect(() => {
    setShowShortcutsHelp(showHelp);
  }, [showHelp]);

  // ============================================
  // CARGAR DATOS
  // ============================================
  
  useEffect(() => {
    if (user?.email) {
      fetchProyectos();
    }
  }, [user?.email]);

  useEffect(() => {
    if (proyectoActual) {
      fetchProyectoData(proyectoActual.id);
    }
  }, [proyectoActual]);

  // Cerrar todos los modales al cambiar de vista
  useEffect(() => {
    // Forzar cierre de todos los modales cuando cambias de vista
    setShowPlantillasModal(false);
    setShowProyectoModal(false);
    setShowCrearDesdeTemplate(false);
    setShowTareaModal(false);
    setShowColumnaModal(false);
    setShowShortcutsHelp(false);
  }, [vistaActual]);

  const fetchProyectos = async () => {
    if (!user?.email) return;
    
    setLoading(true);
    
    const { data, error } = await supabase
      .from('proyectos')
      .select('*')
      .eq('creado_por', user.email)
      .order('creado_at', { ascending: false });

    if (error) {
      console.error('Error cargando proyectos:', error);
    } else {
      const mapped = (data || []).map(mapProyecto);
      setProyectos(mapped);
      
      const primerActivo = mapped.find(p => p.estado === 'activo');
      if (primerActivo) {
        setProyectoActual(primerActivo);
      }
    }
    setLoading(false);
  };

  const fetchProyectoData = async (proyectoId: string) => {
    const { data: colsData } = await supabase
      .from('proyecto_columnas')
      .select('*')
      .eq('proyecto_id', proyectoId)
      .order('orden');

    setColumnas((colsData || []).map(mapColumna));

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

    const { data: etiqData } = await supabase
      .from('proyecto_etiquetas')
      .select('*')
      .eq('proyecto_id', proyectoId);

    setEtiquetas((etiqData || []).map(mapEtiqueta));
  };

  const handleRefresh = async () => {
    if (!proyectoActual) return;
    setRefreshing(true);
    await fetchProyectoData(proyectoActual.id);
    setRefreshing(false);
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
  // FILTROS
  // ============================================

  const usuariosUnicos = useMemo(() => {
    const usuarios = new Set<string>();
    tareas.forEach(t => {
      if (t.asignadoA) usuarios.add(t.asignadoA);
      if (t.creadoPor) usuarios.add(t.creadoPor);
    });
    return Array.from(usuarios);
  }, [tareas]);

  const filtrosActivos = useMemo(() => {
    let count = 0;
    if (searchQuery) count++;
    if (filtroPrioridad) count++;
    if (filtroAsignado) count++;
    if (filtroEtiqueta) count++;
    if (filtroEstado) count++;
    if (filtroFechaDesde) count++;
    if (filtroFechaHasta) count++;
    if (filtroColumna) count++;
    return count;
  }, [searchQuery, filtroPrioridad, filtroAsignado, filtroEtiqueta, filtroEstado, filtroFechaDesde, filtroFechaHasta, filtroColumna]);

  const limpiarFiltros = () => {
    setSearchQuery('');
    setFiltroPrioridad('');
    setFiltroAsignado('');
    setFiltroEtiqueta('');
    setFiltroEstado('');
    setFiltroFechaDesde('');
    setFiltroFechaHasta('');
    setFiltroColumna('');
  };

  const tareasFiltradas = useMemo(() => {
    return tareas.filter(t => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchTitulo = t.titulo.toLowerCase().includes(query);
        const matchDescripcion = t.descripcion?.toLowerCase().includes(query);
        if (!matchTitulo && !matchDescripcion) return false;
      }
      if (filtroPrioridad && t.prioridad !== filtroPrioridad) return false;
      if (filtroAsignado && t.asignadoA !== filtroAsignado) return false;
      if (filtroEtiqueta && !t.etiquetas?.some(e => e.id === filtroEtiqueta)) return false;
      if (filtroColumna && t.columnaId !== filtroColumna) return false;

      if (filtroEstado) {
        const now = new Date();
        switch (filtroEstado) {
          case 'completado':
            if (!t.completado) return false;
            break;
          case 'pendiente':
            if (t.completado) return false;
            break;
          case 'bloqueado':
            if (!t.bloqueado) return false;
            break;
          case 'vencido':
            if (!t.fechaLimite || new Date(t.fechaLimite) >= now || t.completado) return false;
            break;
          case 'proximo':
            if (!t.fechaLimite) return false;
            const diasRestantes = (new Date(t.fechaLimite).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
            if (diasRestantes < 0 || diasRestantes > 7 || t.completado) return false;
            break;
        }
      }

      if (filtroFechaDesde) {
        const desde = new Date(filtroFechaDesde);
        if (!t.fechaLimite || new Date(t.fechaLimite) < desde) return false;
      }
      if (filtroFechaHasta) {
        const hasta = new Date(filtroFechaHasta);
        if (!t.fechaLimite || new Date(t.fechaLimite) > hasta) return false;
      }

      return true;
    });
  }, [tareas, searchQuery, filtroPrioridad, filtroAsignado, filtroEtiqueta, filtroEstado, filtroFechaDesde, filtroFechaHasta, filtroColumna]);

  // ============================================
  // HANDLERS - PROYECTO
  // ============================================
  
  const handleCrearProyectoVacio = () => {
    setShowPlantillasModal(false);
    setShowProyectoModal(true);
  };

  const handleSelectPlantilla = (plantilla: PlantillaProyecto) => {
    setPlantillaSeleccionada(plantilla);
    setShowPlantillasModal(false);
    setShowCrearDesdeTemplate(true);
  };

  const handleCrearDesdeTemplate = async (nombre: string, plantilla: PlantillaProyecto) => {
    if (!user?.email) return;

    // Crear proyecto
    const { data: proyectoData, error: proyectoError } = await supabase
      .from('proyectos')
      .insert({
        nombre,
        descripcion: plantilla.descripcion,
        color: plantilla.color,
        estado: 'activo',
        creado_por: user.email,
      })
      .select()
      .single();

    if (proyectoError || !proyectoData) {
      console.error('Error creando proyecto:', proyectoError);
      alert('Error creando proyecto');
      return;
    }

    // Crear columnas desde plantilla
    if (plantilla.columnasConfig.length > 0) {
      await supabase.from('proyecto_columnas').insert(
        plantilla.columnasConfig.map(c => ({
          proyecto_id: proyectoData.id,
          nombre: c.nombre,
          orden: c.orden,
          color: c.color || null,
          limite_wip: c.limite_wip || null,
        }))
      );
    }

    // Crear etiquetas desde plantilla
    if (plantilla.etiquetasConfig.length > 0) {
      await supabase.from('proyecto_etiquetas').insert(
        plantilla.etiquetasConfig.map(e => ({
          proyecto_id: proyectoData.id,
          nombre: e.nombre,
          color: e.color,
        }))
      );
    }

    // Obtener columnas creadas para las tareas
    const { data: columnasCreadas } = await supabase
      .from('proyecto_columnas')
      .select('id, orden')
      .eq('proyecto_id', proyectoData.id)
      .order('orden');

    // Crear tareas desde plantilla
    if (plantilla.tareasConfig.length > 0 && columnasCreadas) {
      await supabase.from('proyecto_tareas').insert(
        plantilla.tareasConfig.map((t, index) => ({
          proyecto_id: proyectoData.id,
          columna_id: columnasCreadas[t.columna_index]?.id || columnasCreadas[0]?.id,
          titulo: t.titulo,
          prioridad: t.prioridad,
          orden: index,
          creado_por: user.email,
        }))
      );
    }

    await fetchProyectos();
    setShowCrearDesdeTemplate(false);
    setPlantillaSeleccionada(null);
  };

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
      alert('Error creando proyecto: ' + error.message);
      return;
    }

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

  // ============================================
  // HANDLERS - TAREA
  // ============================================

  const handleNuevaTarea = (columnaId?: string) => {
    setTareaEdit(null);
    setColumnaPreseleccionada(columnaId || null);
    setShowTareaModal(true);
  };

  const handleEditarTarea = (tarea: ProyectoTarea) => {
    setTareaEdit(tarea);
    setColumnaPreseleccionada(null);
    setShowTareaModal(true);
  };

  const handleUpdateTarea = async (tareaId: string, data: Partial<ProyectoTarea>) => {
    if (!proyectoActual) return;

    const updateData: any = {};
    if (data.titulo !== undefined) updateData.titulo = data.titulo;
    if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;
    if (data.prioridad !== undefined) updateData.prioridad = data.prioridad;
    if (data.columnaId !== undefined) updateData.columna_id = data.columnaId;
    if (data.asignadoA !== undefined) updateData.asignado_a = data.asignadoA;
    if (data.fechaLimite !== undefined) updateData.fecha_limite = data.fechaLimite?.toISOString() || null;
    if (data.completado !== undefined) {
      updateData.completado = data.completado;
      if (data.completado) {
        updateData.fecha_completado = new Date().toISOString();
      } else {
        updateData.fecha_completado = null;
      }
    }
    if (data.progreso !== undefined) updateData.progreso = data.progreso;

    const { error } = await supabase
      .from('proyecto_tareas')
      .update(updateData)
      .eq('id', tareaId);

    if (error) {
      console.error('Error actualizando tarea:', error);
      alert('Error al actualizar tarea');
    } else {
      fetchProyectoData(proyectoActual.id);
    }
  };

  const handleDuplicateTarea = async (tarea: ProyectoTarea) => {
    if (!proyectoActual) return;

    const { error } = await supabase
      .from('proyecto_tareas')
      .insert({
        proyecto_id: proyectoActual.id,
        columna_id: tarea.columnaId,
        titulo: `${tarea.titulo} (copia)`,
        descripcion: tarea.descripcion,
        prioridad: tarea.prioridad,
        orden: tarea.orden + 1,
        fecha_limite: tarea.fechaLimite?.toISOString(),
        fecha_inicio: tarea.fechaInicio?.toISOString(),
        asignado_a: tarea.asignadoA,
        tiempo_estimado_horas: tarea.tiempoEstimadoHoras,
        creado_por: user?.email,
      });

    if (error) {
      console.error('Error duplicando tarea:', error);
      alert('Error al duplicar tarea');
    } else {
      fetchProyectoData(proyectoActual.id);
    }
  };

  const handleDeleteTarea = async (tareaId: string) => {
    if (!proyectoActual || !user?.email) return;

    const confirmDelete = window.confirm('¿Estás seguro de eliminar esta tarea?');
    if (!confirmDelete) return;

    // Obtener datos de la tarea antes de eliminar (para el log)
    const tareaAEliminar = tareas.find(t => t.id === tareaId);

    const { error } = await supabase
      .from('proyecto_tareas')
      .delete()
      .eq('id', tareaId);

    if (error) {
      console.error('Error eliminando tarea:', error);
      alert('Error al eliminar tarea');
    } else {
      // Registrar actividad manualmente
      if (tareaAEliminar) {
        await supabase.from('proyecto_actividades').insert({
          proyecto_id: proyectoActual.id,
          usuario_email: user.email,  // ← ESTO FALTABA
          tipo: 'tarea_eliminada',
          descripcion: `Eliminó la tarea "${tareaAEliminar.titulo}"`,
          tarea_id: null,  // Ya no existe
        });
      }
      
      setTareaSeleccionada(null);
      fetchProyectoData(proyectoActual.id);
    }
  };

  const handleMoverTarea = async (tareaId: string, nuevaColumnaId: string, nuevoOrden?: number) => {
    if (!proyectoActual) return;

    const updateData: any = { columna_id: nuevaColumnaId };
    if (nuevoOrden !== undefined) updateData.orden = nuevoOrden;

    const { error } = await supabase
      .from('proyecto_tareas')
      .update(updateData)
      .eq('id', tareaId);

    if (error) {
      console.error('Error moviendo tarea:', error);
    } else {
      fetchProyectoData(proyectoActual.id);
    }
  };

  // ============================================
  // HANDLERS - COLUMNA
  // ============================================

  const handleUpdateColumna = async (columnaId: string, data: Partial<ProyectoColumna>) => {
    const updateData: any = {};
    if (data.nombre !== undefined) updateData.nombre = data.nombre;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.limiteWip !== undefined) updateData.limite_wip = data.limiteWip || null;

    const { error } = await supabase
      .from('proyecto_columnas')
      .update(updateData)
      .eq('id', columnaId);

    if (error) {
      console.error('Error actualizando columna:', error);
      alert('Error al actualizar columna');
    } else if (proyectoActual) {
      fetchProyectoData(proyectoActual.id);
    }
  };

  const handleDeleteColumna = async (columnaId: string) => {
    if (!proyectoActual) return;

    const tareasEnColumna = tareas.filter(t => t.columnaId === columnaId);
    if (tareasEnColumna.length > 0) {
      const confirmar = window.confirm(
        `Esta columna tiene ${tareasEnColumna.length} tareas. ¿Eliminar columna y todas sus tareas?`
      );
      if (!confirmar) return;
    }

    await supabase
      .from('proyecto_tareas')
      .delete()
      .eq('columna_id', columnaId);

    const { error } = await supabase
      .from('proyecto_columnas')
      .delete()
      .eq('id', columnaId);

    if (error) {
      console.error('Error eliminando columna:', error);
      alert('Error al eliminar columna');
    } else {
      fetchProyectoData(proyectoActual.id);
    }
  };

  const handleMoveColumna = async (columnaId: string, direction: 'left' | 'right') => {
    if (!proyectoActual) return;

    const columnaIndex = columnas.findIndex(c => c.id === columnaId);
    if (columnaIndex === -1) return;

    const newIndex = direction === 'left' ? columnaIndex - 1 : columnaIndex + 1;
    if (newIndex < 0 || newIndex >= columnas.length) return;

    const columnaActual = columnas[columnaIndex];
    const columnaIntercambio = columnas[newIndex];

    await supabase
      .from('proyecto_columnas')
      .update({ orden: newIndex })
      .eq('id', columnaActual.id);

    await supabase
      .from('proyecto_columnas')
      .update({ orden: columnaIndex })
      .eq('id', columnaIntercambio.id);

    fetchProyectoData(proyectoActual.id);
  };

  const handleAddColumna = async () => {
    if (!proyectoActual || !nuevaColumnaNombre.trim()) return;

    const { error } = await supabase
      .from('proyecto_columnas')
      .insert({
        proyecto_id: proyectoActual.id,
        nombre: nuevaColumnaNombre.trim(),
        orden: columnas.length,
      });

    if (error) {
      console.error('Error creando columna:', error);
      alert('Error al crear columna');
    } else {
      setNuevaColumnaNombre('');
      setShowColumnaModal(false);
      fetchProyectoData(proyectoActual.id);
    }
  };

  // Handler para calendario
  const handleAddTareaFromCalendar = (fecha: Date) => {
    setTareaEdit(null);
    setColumnaPreseleccionada(columnas[0]?.id || null);
    // Aquí podrías pasar la fecha preseleccionada al modal
    setShowTareaModal(true);
  };

  // ============================================
  // MODAL PROYECTO (Vacío)
  // ============================================
  
  const ModalProyectoVacio = () => (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]"
      onClick={() => setShowProyectoModal(false)}
    >
      <div 
        className="bg-slate-900 rounded-2xl border border-slate-700 p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-semibold mb-6">Nuevo Proyecto</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Nombre del Proyecto *</label>
            <input
              id="proyecto-nombre"
              type="text"
              placeholder="Ej: Implementación Q1 2026"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 focus:border-emerald-500/50 focus:outline-none text-sm"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Descripción</label>
            <textarea
              id="proyecto-descripcion"
              placeholder="Detalles del proyecto..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 focus:border-emerald-500/50 focus:outline-none text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'].map(color => (
                <button
                  key={color}
                  type="button"
                  id={`color-${color}`}
                  className="w-10 h-10 rounded-lg border-2 border-transparent hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  onClick={(e) => {
                    const buttons = e.currentTarget.parentElement?.querySelectorAll('button');
                    buttons?.forEach(btn => (btn as HTMLElement).style.borderColor = 'transparent');
                    e.currentTarget.style.borderColor = 'white';
                  }}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Fecha Inicio</label>
              <input
                id="proyecto-fecha-inicio"
                type="date"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 focus:border-emerald-500/50 focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Fecha Fin</label>
              <input
                id="proyecto-fecha-fin"
                type="date"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 focus:border-emerald-500/50 focus:outline-none text-sm"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-700/50">
            <Button variant="secondary" onClick={() => setShowProyectoModal(false)} className="flex-1">
              Cancelar
            </Button>
            <Button 
              onClick={async () => {
                const nombre = (document.getElementById('proyecto-nombre') as HTMLInputElement)?.value;
                const descripcion = (document.getElementById('proyecto-descripcion') as HTMLTextAreaElement)?.value;
                const fechaInicio = (document.getElementById('proyecto-fecha-inicio') as HTMLInputElement)?.value;
                const fechaFin = (document.getElementById('proyecto-fecha-fin') as HTMLInputElement)?.value;
                
                const colorSeleccionado = Array.from(document.querySelectorAll('[id^="color-"]'))
                  .find(btn => (btn as HTMLElement).style.borderColor === 'white')
                  ?.id.replace('color-', '') || '#10b981';
                
                if (!nombre?.trim()) {
                  alert('El nombre es obligatorio');
                  return;
                }

                await handleNuevoProyecto({
                  nombre,
                  descripcion: descripcion || undefined,
                  color: colorSeleccionado,
                  estado: 'activo',
                  fechaInicio: fechaInicio ? new Date(fechaInicio) : undefined,
                  fechaFin: fechaFin ? new Date(fechaFin) : undefined,
                  creadoPor: user?.email || '',
                });
              }}
              className="flex-1"
            >
              Crear Proyecto
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  // ============================================
  // MODAL PLANTILLAS
  // ============================================
  
  const ModalPlantillas = () => (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]"
      onClick={() => setShowPlantillasModal(false)}
    >
      <div 
        className="bg-slate-900 rounded-2xl border border-slate-700 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">Nuevo Proyecto</h3>
          <button 
            onClick={() => setShowPlantillasModal(false)}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <PlantillasProyecto
          onSelectPlantilla={handleSelectPlantilla}
          onCrearVacio={handleCrearProyectoVacio}
        />
      </div>
    </div>
  );

  // ============================================
  // RENDER - VISTA ACTUAL
  // ============================================

  const renderVistaActual = () => {
    if (!proyectoActual) return null;

    switch (vistaActual) {
      case 'kanban':
        return (
          <KanbanBoard
            columnas={columnas}
            tareas={tareasFiltradas}
            onTareaClick={handleEditarTarea}
            onTareaMover={handleMoverTarea}
            onAddTarea={handleNuevaTarea}
            onUpdateColumna={handleUpdateColumna}
            onDeleteColumna={handleDeleteColumna}
            onMoveColumna={handleMoveColumna}
            onDuplicateTarea={handleDuplicateTarea}
            onDeleteTarea={handleDeleteTarea}
            onAddColumna={() => setShowColumnaModal(true)}
          />
        );

      case 'lista':
        return (
          <TareasListView
            tareas={tareasFiltradas}
            columnas={columnas}
            etiquetas={etiquetas}
            onTareaClick={handleEditarTarea}
            onTareaUpdate={handleUpdateTarea}
            onTareaDelete={handleDeleteTarea}
            onTareaDuplicate={handleDuplicateTarea}
            onTareaMove={handleMoverTarea}
          />
        );

      case 'calendario':
        return (
          <TareasCalendarView
            tareas={tareasFiltradas}
            columnas={columnas}
            onTareaClick={handleEditarTarea}
            onAddTarea={handleAddTareaFromCalendar}
          />
        );

      case 'metricas':
        return (
          <ProyectoCharts
            tareas={tareas}
            columnas={columnas}
            fechaInicio={proyectoActual.fechaInicio}
            fechaFin={proyectoActual.fechaFin}
          />
        );

      default:
        return null;
    }
  };

  // ============================================
  // RENDER PRINCIPAL
  // ============================================
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="animate-spin text-emerald-400 mr-2" size={24} />
        <span className="text-emerald-400">Cargando proyectos...</span>
      </div>
    );
  }

  if (proyectos.length === 0) {
    return (
      <>
        <div className="max-w-2xl mx-auto text-center py-12">
          <div className="w-20 h-20 bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <TrendingUp size={40} className="text-slate-600" />
          </div>
          <h2 className="text-2xl font-bold mb-3">No hay proyectos</h2>
          <p className="text-slate-400 mb-6">
            Creá tu primer proyecto para organizar tareas y gestionar el trabajo del equipo
          </p>
          <Button onClick={() => setShowPlantillasModal(true)}>
            <Plus size={18} className="mr-2" />
            Crear Primer Proyecto
          </Button>
        </div>
        
        {showPlantillasModal && <ModalPlantillas />}
        {showProyectoModal && <ModalProyectoVacio />}
        {showCrearDesdeTemplate && (
          <CrearDesdeTemplateModal
            isOpen={showCrearDesdeTemplate}
            onClose={() => {
              setShowCrearDesdeTemplate(false);
              setPlantillaSeleccionada(null);
            }}
            plantilla={plantillaSeleccionada}
            onCrear={handleCrearDesdeTemplate}
          />
        )}
      </>
    );
  }

  return (
    <div className="flex h-full w-full">
      {/* ============================================
          CONTENIDO PRINCIPAL
          ============================================ */}
      <div className={cn('flex-1 space-y-6 transition-all w-full', showSidebar ? 'pr-80' : '')}>
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

            {/* Botón refresh */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              title="Actualizar"
            >
              <RefreshCw size={18} className={cn(refreshing && 'animate-spin')} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Selector de vista */}
            <div className="flex items-center bg-slate-800/50 rounded-xl p-1">
              <button
                onClick={() => setVistaActual('kanban')}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  vistaActual === 'kanban' 
                    ? 'bg-emerald-500/20 text-emerald-400' 
                    : 'text-slate-400 hover:text-slate-200'
                )}
                title="Vista Kanban"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                onClick={() => setVistaActual('lista')}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  vistaActual === 'lista' 
                    ? 'bg-emerald-500/20 text-emerald-400' 
                    : 'text-slate-400 hover:text-slate-200'
                )}
                title="Vista Lista"
              >
                <List size={18} />
              </button>
              <button
                onClick={() => setVistaActual('calendario')}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  vistaActual === 'calendario' 
                    ? 'bg-emerald-500/20 text-emerald-400' 
                    : 'text-slate-400 hover:text-slate-200'
                )}
                title="Vista Calendario"
              >
                <Calendar size={18} />
              </button>
              <button
                onClick={() => setVistaActual('metricas')}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  vistaActual === 'metricas' 
                    ? 'bg-emerald-500/20 text-emerald-400' 
                    : 'text-slate-400 hover:text-slate-200'
                )}
                title="Métricas"
              >
                <BarChart3 size={18} />
              </button>
            </div>

            {/* Filtros */}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowFiltrosAvanzados(!showFiltrosAvanzados)}
              className={cn(filtrosActivos > 0 && 'text-emerald-400')}
            >
              <Filter size={18} />
              {filtrosActivos > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-emerald-500/20 rounded-full">
                  {filtrosActivos}
                </span>
              )}
            </Button>

            {/* Toggle sidebar */}
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className={cn(
                'p-2 rounded-lg transition-colors',
                showSidebar 
                  ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              )}
              title={showSidebar ? 'Ocultar panel (clic para cerrar)' : 'Mostrar panel de actividad'}
            >
              {showSidebar ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
            </button>

            {/* Keyboard shortcuts */}
            <button
              onClick={() => setShowShortcutsHelp(true)}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              title="Atajos de teclado (Shift + ?)"
            >
              <Keyboard size={18} />
            </button>

            {/* Botón Equipo */}
            <Button variant="ghost" onClick={() => setShowMiembrosModal(true)}>
              <Users size={18} className="mr-2" />
              Equipo
            </Button>

            {/* Acciones principales */}
            <Button variant="secondary" onClick={() => setShowPlantillasModal(true)}>
              <Plus size={18} className="mr-2" />
              Nuevo Proyecto
            </Button>
            <Button onClick={() => handleNuevaTarea()}>
              <Plus size={18} className="mr-2" />
              Nueva Tarea
            </Button>
          </div>
        </div>

        {/* Stats */}
        {proyectoActual && vistaActual !== 'metricas' && (
          <ProyectoStats tareas={tareas} columnas={columnas} />
        )}

        {/* Filtros */}
        <Card className="p-4">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-md">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                id="search-input"
                type="text"
                placeholder="Buscar por título o descripción... (Ctrl+F)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  <X size={16} />
                </button>
              )}
            </div>

            <Select
              placeholder="Prioridad"
              options={[
                { value: '', label: 'Todas las prioridades' },
                { value: 'urgente', label: '🔴 Urgente' },
                { value: 'alta', label: '🟠 Alta' },
                { value: 'media', label: '🔵 Media' },
                { value: 'baja', label: '⚪ Baja' },
              ]}
              value={filtroPrioridad}
              onChange={(e) => setFiltroPrioridad(e.target.value)}
              className="w-48"
            />

            <Select
              placeholder="Estado"
              options={[
                { value: '', label: 'Todos los estados' },
                { value: 'pendiente', label: '⏳ Pendientes' },
                { value: 'completado', label: '✅ Completadas' },
                { value: 'bloqueado', label: '🔒 Bloqueadas' },
                { value: 'vencido', label: '⚠️ Vencidas' },
                { value: 'proximo', label: '📅 Próximas 7 días' },
              ]}
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="w-48"
            />

            <button
              onClick={() => setShowFiltrosAvanzados(!showFiltrosAvanzados)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors',
                showFiltrosAvanzados 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : 'bg-slate-800/50 text-slate-400 hover:text-slate-200'
              )}
            >
              Más filtros
              <ChevronDown size={16} className={cn('transition-transform', showFiltrosAvanzados && 'rotate-180')} />
            </button>

            {filtrosActivos > 0 && (
              <button
                onClick={limpiarFiltros}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <RotateCcw size={16} />
                Limpiar ({filtrosActivos})
              </button>
            )}
          </div>

          {showFiltrosAvanzados && (
            <div className="mt-4 pt-4 border-t border-slate-700/50 grid grid-cols-4 gap-4">
              <Select
                label="Columna"
                placeholder="Todas las columnas"
                options={[
                  { value: '', label: 'Todas las columnas' },
                  ...columnas.map(c => ({ value: c.id, label: c.nombre }))
                ]}
                value={filtroColumna}
                onChange={(e) => setFiltroColumna(e.target.value)}
              />

              <Select
                label="Asignado a"
                placeholder="Todos los usuarios"
                options={[
                  { value: '', label: 'Todos los usuarios' },
                  ...usuariosUnicos.map(u => ({ value: u, label: u }))
                ]}
                value={filtroAsignado}
                onChange={(e) => setFiltroAsignado(e.target.value)}
              />

              <Select
                label="Etiqueta"
                placeholder="Todas las etiquetas"
                options={[
                  { value: '', label: 'Todas las etiquetas' },
                  ...etiquetas.map(e => ({ value: e.id, label: e.nombre }))
                ]}
                value={filtroEtiqueta}
                onChange={(e) => setFiltroEtiqueta(e.target.value)}
              />

              <div className="space-y-1">
                <label className="block text-sm text-slate-400">Rango de fechas</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={filtroFechaDesde}
                    onChange={(e) => setFiltroFechaDesde(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 focus:border-emerald-500/50 focus:outline-none text-sm"
                  />
                  <input
                    type="date"
                    value={filtroFechaHasta}
                    onChange={(e) => setFiltroFechaHasta(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 focus:border-emerald-500/50 focus:outline-none text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {filtrosActivos > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center justify-between">
              <span className="text-sm text-slate-400">
                Mostrando <span className="text-emerald-400 font-medium">{tareasFiltradas.length}</span> de{' '}
                <span className="font-medium">{tareas.length}</span> tareas
              </span>
            </div>
          )}
        </Card>

        {/* Vista actual */}
        {renderVistaActual()}
      </div>

      {/* ============================================
          SIDEBAR DERECHO
          ============================================ */}
      <div className={cn(
        "fixed right-0 top-0 h-full w-80 bg-slate-900/95 border-l border-slate-700/50 p-4 overflow-y-auto backdrop-blur-sm z-40 transition-all duration-300 ease-in-out",
        showSidebar ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"
      )}>
        {proyectoActual && (
          <div className="pt-16 space-y-4">
            {/* Tabs del sidebar */}
            <div className="flex gap-2 p-1 bg-slate-800/50 rounded-xl">
              <button
                onClick={() => setSidebarTab('actividad')}
                className={cn(
                  'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2',
                  sidebarTab === 'actividad'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <Activity size={16} />
                Actividad
              </button>
              <button
                onClick={() => setSidebarTab('calendario')}
                className={cn(
                  'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2',
                  sidebarTab === 'calendario'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <Calendar size={16} />
                Calendario
              </button>
            </div>

            {/* Contenido del sidebar */}
            {sidebarTab === 'actividad' ? (
              <ActividadReciente proyectoId={proyectoActual.id} />
            ) : (
              <div className="space-y-4">
                <MiniCalendar
                  tareas={tareas}
                  onDateClick={(fecha) => {
                    setVistaActual('calendario');
                  }}
                />
                
                {/* Tareas próximas */}
                <Card className="p-4">
                  <h4 className="font-semibold mb-3 text-sm">Próximas a vencer</h4>
                  <div className="space-y-2">
                    {tareas
                      .filter(t => 
                        t.fechaLimite && 
                        !t.completado && 
                        new Date(t.fechaLimite) > new Date() &&
                        new Date(t.fechaLimite) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                      )
                      .sort((a, b) => 
                        (a.fechaLimite?.getTime() || 0) - (b.fechaLimite?.getTime() || 0)
                      )
                      .slice(0, 5)
                      .map(tarea => (
                        <div
                          key={tarea.id}
                          onClick={() => handleEditarTarea(tarea)}
                          className="p-2 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 cursor-pointer transition-colors"
                        >
                          <p className="text-sm truncate">{tarea.titulo}</p>
                          <p className="text-xs text-slate-500">
                            {tarea.fechaLimite?.toLocaleDateString('es-AR', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short'
                            })}
                          </p>
                        </div>
                      ))
                    }
                    {tareas.filter(t => 
                      t.fechaLimite && 
                      !t.completado && 
                      new Date(t.fechaLimite) > new Date() &&
                      new Date(t.fechaLimite) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                    ).length === 0 && (
                      <p className="text-sm text-slate-500 text-center py-4">
                        No hay tareas próximas
                      </p>
                    )}
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================
          MODALES
          ============================================ */}
      
      {showPlantillasModal && <ModalPlantillas />}
      {showProyectoModal && <ModalProyectoVacio />}
      
      {showCrearDesdeTemplate && (
        <CrearDesdeTemplateModal
          isOpen={showCrearDesdeTemplate}
          onClose={() => {
            setShowCrearDesdeTemplate(false);
            setPlantillaSeleccionada(null);
          }}
          plantilla={plantillaSeleccionada}
          onCrear={handleCrearDesdeTemplate}
        />
      )}

      {showTareaModal && proyectoActual && (
        <TareaModal
          isOpen={showTareaModal}
          onClose={() => {
            setShowTareaModal(false);
            setColumnaPreseleccionada(null);
            setTareaEdit(null);
          }}
          proyectoId={proyectoActual.id}
          tarea={tareaEdit || undefined}
          columnas={columnas}
          etiquetas={etiquetas}
          columnaPreseleccionada={columnaPreseleccionada}
          onSave={() => {
            fetchProyectoData(proyectoActual.id);
            setShowTareaModal(false);
            setColumnaPreseleccionada(null);
            setTareaEdit(null);
          }}
        />
      )}

      {/* Modal nueva columna */}
      {showColumnaModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" 
          onClick={() => setShowColumnaModal(false)}
        >
          <div 
            className="bg-slate-900 border border-slate-700 rounded-xl p-4 w-80" 
            onClick={e => e.stopPropagation()}
          >
            <h4 className="font-semibold mb-3">Nueva columna</h4>
            <input
              type="text"
              value={nuevaColumnaNombre}
              onChange={e => setNuevaColumnaNombre(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddColumna()}
              placeholder="Nombre de la columna"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:outline-none text-sm mb-3"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowColumnaModal(false)}
                className="flex-1 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddColumna}
                className="flex-1 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-medium text-sm transition-colors"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de atajos de teclado */}
      <KeyboardShortcutsHelp
        shortcuts={[
          { key: 'n', action: () => {}, description: 'Nueva tarea', category: 'Creación' },
          { key: 'n', shift: true, action: () => {}, description: 'Nuevo proyecto', category: 'Creación' },
          { key: 'f', ctrl: true, action: () => {}, description: 'Buscar', category: 'Navegación' },
          { key: 'Escape', action: () => {}, description: 'Cerrar modal', category: 'General' },
          { key: 's', ctrl: true, action: () => {}, description: 'Guardar', category: 'General' },
          { key: 'v', action: () => {}, description: 'Cambiar vista', category: 'Vistas' },
          { key: 'f', action: () => {}, description: 'Filtros', category: 'Vistas' },
          { key: 'r', action: () => {}, description: 'Actualizar', category: 'General' },
          { key: 'e', action: () => {}, description: 'Editar tarea seleccionada', category: 'Tareas' },
          { key: 'd', action: () => {}, description: 'Duplicar tarea seleccionada', category: 'Tareas' },
          { key: 'Delete', action: () => {}, description: 'Eliminar tarea seleccionada', category: 'Tareas' },
          { key: 'x', action: () => {}, description: 'Completar/Reabrir tarea', category: 'Tareas' },
        ]}
        isOpen={showShortcutsHelp}
        onClose={() => {
          setShowShortcutsHelp(false);
          setShowHelp(false);
        }}
      />

      {/* Modal de miembros del equipo */}
      {showMiembrosModal && proyectoActual && (
        <ProyectoMiembrosModal
          isOpen={showMiembrosModal}
          onClose={() => setShowMiembrosModal(false)}
          proyectoId={proyectoActual.id}
          proyectoNombre={proyectoActual.nombre}
        />
      )}
    </div>
  );
}