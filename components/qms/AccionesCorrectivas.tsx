'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Target, Search, Plus, Filter, Download, RefreshCw,
  CheckCircle, XCircle, Clock, Eye, Edit, Trash2,
  Users, Calendar, ChevronRight, ChevronDown, MoreHorizontal,
  FileText, Link2, AlertTriangle, AlertCircle, TrendingUp,
  Clipboard, Send, X, Save, ListChecks, Play, Pause,
  CheckSquare, Square, ArrowRight, Zap, Flag, History,
  BarChart3, CircleDot, Circle, Layers, GitBranch
} from 'lucide-react';

// ============================================
// TIPOS LOCALES
// ============================================

type TipoCAPA = 'correctiva' | 'preventiva' | 'mejora';
type EstadoCAPA = 'abierta' | 'en_analisis' | 'en_implementacion' | 'verificacion' | 'cerrada' | 'cancelada';
type MetodoAnalisis = '5_whys' | 'ishikawa' | 'fmea' | 'pareto' | 'otro';
type EstadoAccion = 'pendiente' | 'en_proceso' | 'completada' | 'cancelada' | 'vencida';

interface AccionCorrectiva {
  id: string;
  numero: string;
  tipo: TipoCAPA;
  titulo: string;
  descripcion_problema: string;
  
  // Origen
  ncr_id?: string;
  ncr_numero?: string;
  auditoria_id?: string;
  origen_descripcion?: string;
  
  // Metodología 8D
  d1_equipo?: string;
  d2_descripcion?: string;
  d3_contencion?: string;
  d4_causa_raiz?: string;
  d4_metodo?: MetodoAnalisis;
  d5_acciones_correctivas?: string;
  d6_implementacion?: string;
  d7_prevencion?: string;
  d8_reconocimiento?: string;
  
  // Plan de acciones
  acciones?: AccionPlan[];
  
  // Verificación
  verificacion_requerida: boolean;
  verificacion_fecha?: string;
  verificacion_resultado?: string;
  verificacion_efectiva?: boolean;
  verificado_por?: string;
  
  // Estado y progreso
  estado: EstadoCAPA;
  porcentaje_avance: number;
  
  // Fechas
  fecha_inicio: string;
  fecha_objetivo?: string;
  fecha_cierre?: string;
  
  // Responsables
  responsable?: string;
  aprobado_por?: string;
  
  // Documentos
  documentos?: { nombre: string; url: string; tipo: string }[];
  
  // Auditoría
  creado_por?: string;
  creado_at: string;
  actualizado_por?: string;
  actualizado_at?: string;
}

interface AccionPlan {
  id: string;
  descripcion: string;
  responsable: string;
  fecha_objetivo: string;
  fecha_completada?: string;
  estado: EstadoAccion;
  notas?: string;
  evidencia_url?: string;
  orden: number;
}

interface CAPAFormData {
  tipo: TipoCAPA;
  titulo: string;
  descripcion_problema: string;
  ncr_id?: string;
  ncr_numero?: string;
  origen_descripcion?: string;
  responsable?: string;
  fecha_objetivo?: string;
  verificacion_requerida: boolean;
}

type VistaActiva = 'lista' | 'nueva' | 'detalle' | 'editar';
type PasoActual = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

// ============================================
// CONFIGURACIONES
// ============================================

const TIPO_CONFIG: Record<TipoCAPA, { label: string; color: string; bg: string; descripcion: string }> = {
  correctiva: { label: 'Correctiva', color: 'text-red-400', bg: 'bg-red-500/20', descripcion: 'Eliminar causa de NC existente' },
  preventiva: { label: 'Preventiva', color: 'text-blue-400', bg: 'bg-blue-500/20', descripcion: 'Prevenir NC potencial' },
  mejora: { label: 'Mejora', color: 'text-emerald-400', bg: 'bg-emerald-500/20', descripcion: 'Mejora continua del sistema' },
};

const ESTADO_CONFIG: Record<EstadoCAPA, { label: string; color: string; bg: string }> = {
  abierta: { label: 'Abierta', color: 'text-red-400', bg: 'bg-red-500/20' },
  en_analisis: { label: 'En Análisis', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  en_implementacion: { label: 'Implementación', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  verificacion: { label: 'Verificación', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  cerrada: { label: 'Cerrada', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  cancelada: { label: 'Cancelada', color: 'text-slate-400', bg: 'bg-slate-500/20' },
};

const ESTADO_ACCION_CONFIG: Record<EstadoAccion, { label: string; color: string; bg: string }> = {
  pendiente: { label: 'Pendiente', color: 'text-slate-400', bg: 'bg-slate-500/20' },
  en_proceso: { label: 'En Proceso', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  completada: { label: 'Completada', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  cancelada: { label: 'Cancelada', color: 'text-slate-400', bg: 'bg-slate-500/20' },
  vencida: { label: 'Vencida', color: 'text-red-400', bg: 'bg-red-500/20' },
};

const METODO_ANALISIS_CONFIG: Record<MetodoAnalisis, { label: string; descripcion: string }> = {
  '5_whys': { label: '5 Por Qués', descripcion: 'Preguntar "por qué" repetidamente hasta llegar a la causa raíz' },
  ishikawa: { label: 'Diagrama Ishikawa', descripcion: 'Diagrama de espina de pescado (causa-efecto)' },
  fmea: { label: 'FMEA', descripcion: 'Análisis de Modo y Efecto de Falla' },
  pareto: { label: 'Análisis Pareto', descripcion: 'Identificar las causas más significativas (80/20)' },
  otro: { label: 'Otro método', descripcion: 'Otro método de análisis' },
};

const PASOS_8D = [
  { num: 1, titulo: 'D1 - Equipo', descripcion: 'Formar el equipo de trabajo', campo: 'd1_equipo' },
  { num: 2, titulo: 'D2 - Problema', descripcion: 'Describir el problema', campo: 'd2_descripcion' },
  { num: 3, titulo: 'D3 - Contención', descripcion: 'Acciones de contención inmediata', campo: 'd3_contencion' },
  { num: 4, titulo: 'D4 - Causa Raíz', descripcion: 'Análisis de causa raíz', campo: 'd4_causa_raiz' },
  { num: 5, titulo: 'D5 - Acciones', descripcion: 'Acciones correctivas permanentes', campo: 'd5_acciones_correctivas' },
  { num: 6, titulo: 'D6 - Implementar', descripcion: 'Implementar y validar', campo: 'd6_implementacion' },
  { num: 7, titulo: 'D7 - Prevenir', descripcion: 'Prevenir recurrencia', campo: 'd7_prevencion' },
  { num: 8, titulo: 'D8 - Reconocer', descripcion: 'Reconocer al equipo', campo: 'd8_reconocimiento' },
];

// ============================================
// HELPERS
// ============================================

const formatDate = (date: string | null | undefined): string => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('es-UY', { 
    day: '2-digit', month: '2-digit', year: 'numeric' 
  });
};

const formatDateTime = (date: string | null | undefined): string => {
  if (!date) return '-';
  return new Date(date).toLocaleString('es-UY', { 
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const getDiasRestantes = (fecha: string | null | undefined): number | null => {
  if (!fecha) return null;
  const hoy = new Date();
  const objetivo = new Date(fecha);
  return Math.ceil((objetivo.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
};

const formatearNumeroCAPA = (secuencia: number): string => {
  const year = new Date().getFullYear();
  return `CAPA-${year}-${secuencia.toString().padStart(5, '0')}`;
};

const calcularProgreso = (capa: AccionCorrectiva): number => {
  if (!capa.acciones || capa.acciones.length === 0) {
    // Si no hay acciones, calcular por pasos 8D completados
    let completados = 0;
    if (capa.d1_equipo) completados++;
    if (capa.d2_descripcion) completados++;
    if (capa.d3_contencion) completados++;
    if (capa.d4_causa_raiz) completados++;
    if (capa.d5_acciones_correctivas) completados++;
    if (capa.d6_implementacion) completados++;
    if (capa.d7_prevencion) completados++;
    if (capa.d8_reconocimiento) completados++;
    return Math.round((completados / 8) * 100);
  }
  
  const completadas = capa.acciones.filter(a => a.estado === 'completada').length;
  return Math.round((completadas / capa.acciones.length) * 100);
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function AccionesCorrectivas() {
  // Estado principal
  const [loading, setLoading] = useState(true);
  const [vistaActiva, setVistaActiva] = useState<VistaActiva>('lista');
  const [capaSeleccionada, setCapaSeleccionada] = useState<AccionCorrectiva | null>(null);
  
  // Datos
  const [capas, setCapas] = useState<AccionCorrectiva[]>([]);
  const [ncrsDisponibles, setNcrsDisponibles] = useState<{ id: string; numero: string; titulo: string }[]>([]);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('activas');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  
  // Form
  const [formData, setFormData] = useState<CAPAFormData>({
    tipo: 'correctiva',
    titulo: '',
    descripcion_problema: '',
    verificacion_requerida: true,
  });
  
  // UI
  const [showFilters, setShowFilters] = useState(false);
  const [saving, setSaving] = useState(false);

  // ============================================
  // CARGA DE DATOS
  // ============================================

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadCAPAs(),
        loadNCRsDisponibles(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCAPAs = async () => {
    const { data, error } = await supabase
      .from('qms_acciones_correctivas')
      .select('*')
      .order('fecha_inicio', { ascending: false })
      .limit(500);

    if (!error && data) {
      // Calcular progreso para cada CAPA
      const capasConProgreso = data.map(capa => ({
        ...capa,
        porcentaje_avance: calcularProgreso(capa),
      }));
      setCapas(capasConProgreso);
    }
  };

  const loadNCRsDisponibles = async () => {
    const { data } = await supabase
      .from('qms_no_conformidades')
      .select('id, numero, titulo')
      .in('estado', ['abierta', 'en_analisis', 'en_implementacion'])
      .order('fecha_deteccion', { ascending: false });
    if (data) setNcrsDisponibles(data);
  };

  // ============================================
  // FILTRADO
  // ============================================

  const capasFiltradas = useMemo(() => {
    return capas.filter(capa => {
      // Búsqueda
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchNumero = capa.numero?.toLowerCase().includes(search);
        const matchTitulo = capa.titulo?.toLowerCase().includes(search);
        const matchNCR = capa.ncr_numero?.toLowerCase().includes(search);
        if (!matchNumero && !matchTitulo && !matchNCR) return false;
      }
      
      // Filtro estado
      if (filtroEstado === 'activas') {
        if (['cerrada', 'cancelada'].includes(capa.estado)) return false;
      } else if (filtroEstado !== 'todos' && capa.estado !== filtroEstado) {
        return false;
      }
      
      // Filtro tipo
      if (filtroTipo !== 'todos' && capa.tipo !== filtroTipo) return false;
      
      return true;
    });
  }, [capas, searchTerm, filtroEstado, filtroTipo]);

  // ============================================
  // ESTADÍSTICAS
  // ============================================

  const stats = useMemo(() => {
    const activas = capas.filter(c => !['cerrada', 'cancelada'].includes(c.estado));
    const correctivas = activas.filter(c => c.tipo === 'correctiva').length;
    const preventivas = activas.filter(c => c.tipo === 'preventiva').length;
    const mejoras = activas.filter(c => c.tipo === 'mejora').length;
    
    const vencidas = activas.filter(c => {
      const dias = getDiasRestantes(c.fecha_objetivo);
      return dias !== null && dias < 0;
    }).length;
    
    const porVencer = activas.filter(c => {
      const dias = getDiasRestantes(c.fecha_objetivo);
      return dias !== null && dias >= 0 && dias <= 7;
    }).length;
    
    const enVerificacion = activas.filter(c => c.estado === 'verificacion').length;
    
    // Efectividad (CAPAs cerradas que fueron efectivas)
    const cerradas = capas.filter(c => c.estado === 'cerrada');
    const efectivas = cerradas.filter(c => c.verificacion_efectiva === true).length;
    const efectividad = cerradas.length > 0 ? Math.round((efectivas / cerradas.length) * 100) : 100;
    
    return { 
      total: activas.length, 
      correctivas, 
      preventivas, 
      mejoras,
      vencidas, 
      porVencer, 
      enVerificacion,
      efectividad 
    };
  }, [capas]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleNuevaCAPA = (ncrId?: string, ncrNumero?: string) => {
    setFormData({
      tipo: 'correctiva',
      titulo: '',
      descripcion_problema: '',
      ncr_id: ncrId,
      ncr_numero: ncrNumero,
      verificacion_requerida: true,
    });
    setVistaActiva('nueva');
  };

  const handleVerDetalle = (capa: AccionCorrectiva) => {
    setCapaSeleccionada(capa);
    setVistaActiva('detalle');
  };

  const handleGuardarCAPA = async () => {
    try {
      setSaving(true);
      
      if (vistaActiva === 'nueva') {
        // Generar número
        const { data: lastCAPA } = await supabase
          .from('qms_acciones_correctivas')
          .select('numero')
          .order('creado_at', { ascending: false })
          .limit(1)
          .single();
        
        const lastSeq = lastCAPA?.numero ? parseInt(lastCAPA.numero.split('-')[2]) : 0;
        const numero = formatearNumeroCAPA(lastSeq + 1);
        
        const { error } = await supabase
          .from('qms_acciones_correctivas')
          .insert({
            numero,
            ...formData,
            estado: 'abierta',
            porcentaje_avance: 0,
            fecha_inicio: new Date().toISOString(),
            creado_por: 'Usuario Actual',
          });
        
        if (error) throw error;
      } else {
        // Actualizar
        const { error } = await supabase
          .from('qms_acciones_correctivas')
          .update({
            ...formData,
            actualizado_at: new Date().toISOString(),
            actualizado_por: 'Usuario Actual',
          })
          .eq('id', capaSeleccionada?.id);
        
        if (error) throw error;
      }
      
      await loadCAPAs();
      setVistaActiva('lista');
      
    } catch (error) {
      console.error('Error guardando CAPA:', error);
      alert('Error al guardar la CAPA');
    } finally {
      setSaving(false);
    }
  };

  const handleActualizar8D = async (capaId: string, campo: string, valor: string) => {
    try {
      const { error } = await supabase
        .from('qms_acciones_correctivas')
        .update({
          [campo]: valor,
          actualizado_at: new Date().toISOString(),
        })
        .eq('id', capaId);
      
      if (error) throw error;
      
      // Actualizar estado local
      if (capaSeleccionada?.id === capaId) {
        const updated = { ...capaSeleccionada, [campo]: valor };
        updated.porcentaje_avance = calcularProgreso(updated);
        setCapaSeleccionada(updated);
      }
      
      await loadCAPAs();
      
    } catch (error) {
      console.error('Error actualizando 8D:', error);
    }
  };

  const handleCambiarEstado = async (capaId: string, nuevoEstado: EstadoCAPA) => {
    try {
      setSaving(true);
      
      const updates: any = {
        estado: nuevoEstado,
        actualizado_at: new Date().toISOString(),
      };
      
      if (nuevoEstado === 'cerrada') {
        updates.fecha_cierre = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('qms_acciones_correctivas')
        .update(updates)
        .eq('id', capaId);
      
      if (error) throw error;
      
      await loadCAPAs();
      if (capaSeleccionada?.id === capaId) {
        setCapaSeleccionada({ ...capaSeleccionada, ...updates });
      }
      
    } catch (error) {
      console.error('Error cambiando estado:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleVerificarEfectividad = async (capaId: string, efectiva: boolean, resultado: string) => {
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('qms_acciones_correctivas')
        .update({
          verificacion_efectiva: efectiva,
          verificacion_resultado: resultado,
          verificacion_fecha: new Date().toISOString(),
          verificado_por: 'Usuario Actual',
          estado: efectiva ? 'cerrada' : 'en_implementacion',
          fecha_cierre: efectiva ? new Date().toISOString() : null,
          actualizado_at: new Date().toISOString(),
        })
        .eq('id', capaId);
      
      if (error) throw error;
      
      await loadCAPAs();
      
    } catch (error) {
      console.error('Error verificando efectividad:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAgregarAccion = async (capaId: string, accion: Omit<AccionPlan, 'id'>) => {
    try {
      const capa = capas.find(c => c.id === capaId);
      const acciones = capa?.acciones || [];
      
      acciones.push({
        ...accion,
        id: Date.now().toString(),
      });
      
      const { error } = await supabase
        .from('qms_acciones_correctivas')
        .update({ 
          acciones,
          actualizado_at: new Date().toISOString(),
        })
        .eq('id', capaId);
      
      if (error) throw error;
      
      await loadCAPAs();
      if (capaSeleccionada?.id === capaId) {
        setCapaSeleccionada({ ...capaSeleccionada, acciones });
      }
      
    } catch (error) {
      console.error('Error agregando acción:', error);
    }
  };

  const handleActualizarAccion = async (capaId: string, accionId: string, updates: Partial<AccionPlan>) => {
    try {
      const capa = capas.find(c => c.id === capaId);
      const acciones = capa?.acciones?.map(a => 
        a.id === accionId ? { ...a, ...updates } : a
      ) || [];
      
      const { error } = await supabase
        .from('qms_acciones_correctivas')
        .update({ 
          acciones,
          porcentaje_avance: calcularProgreso({ ...capa!, acciones }),
          actualizado_at: new Date().toISOString(),
        })
        .eq('id', capaId);
      
      if (error) throw error;
      
      await loadCAPAs();
      if (capaSeleccionada?.id === capaId) {
        setCapaSeleccionada({ ...capaSeleccionada, acciones });
      }
      
    } catch (error) {
      console.error('Error actualizando acción:', error);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ==================== VISTA LISTA ==================== */}
      {vistaActiva === 'lista' && (
        <>
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Target className="h-6 w-6 text-purple-400" />
                Acciones Correctivas y Preventivas (CAPA)
              </h3>
              <p className="text-slate-400 text-sm mt-1">
                Gestión de CAPAs con metodología 8D
              </p>
            </div>
            
            {/* Stats */}
            <div className="flex gap-3">
              <div className="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-xl">
                <div className="text-xs text-red-400">Correctivas</div>
                <div className="text-xl font-bold text-red-400">{stats.correctivas}</div>
              </div>
              <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <div className="text-xs text-blue-400">Preventivas</div>
                <div className="text-xl font-bold text-blue-400">{stats.preventivas}</div>
              </div>
              <div className="px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                <div className="text-xs text-purple-400">Verificación</div>
                <div className="text-xl font-bold text-purple-400">{stats.enVerificacion}</div>
              </div>
              <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                <div className="text-xs text-emerald-400">Efectividad</div>
                <div className="text-xl font-bold text-emerald-400">{stats.efectividad}%</div>
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-3 items-center flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar por número, título, NCR..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>
              
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
              >
                <option value="activas">Activas</option>
                <option value="todos">Todas</option>
                <option value="abierta">Abiertas</option>
                <option value="en_analisis">En Análisis</option>
                <option value="en_implementacion">Implementación</option>
                <option value="verificacion">Verificación</option>
                <option value="cerrada">Cerradas</option>
              </select>
              
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
              >
                <option value="todos">Todos los tipos</option>
                <option value="correctiva">Correctivas</option>
                <option value="preventiva">Preventivas</option>
                <option value="mejora">Mejoras</option>
              </select>
              
              <button
                onClick={loadCAPAs}
                className="p-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-400 hover:text-slate-200 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            
            <button
              onClick={() => handleNuevaCAPA()}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nueva CAPA
            </button>
          </div>

          {/* Alertas */}
          {(stats.vencidas > 0 || stats.porVencer > 0) && (
            <div className="flex gap-3">
              {stats.vencidas > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <span className="text-sm text-red-400">{stats.vencidas} CAPA(s) vencida(s)</span>
                </div>
              )}
              {stats.porVencer > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <Clock className="h-4 w-4 text-amber-400" />
                  <span className="text-sm text-amber-400">{stats.porVencer} próxima(s) a vencer</span>
                </div>
              )}
            </div>
          )}

          {/* Lista de CAPAs */}
          <div className="space-y-3">
            {capasFiltradas.map(capa => {
              const tipoConfig = TIPO_CONFIG[capa.tipo];
              const estadoConfig = ESTADO_CONFIG[capa.estado];
              const diasRestantes = getDiasRestantes(capa.fecha_objetivo);
              
              return (
                <div 
                  key={capa.id} 
                  className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 hover:border-slate-600 transition-colors cursor-pointer"
                  onClick={() => handleVerDetalle(capa)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className="font-mono text-sm text-purple-400">{capa.numero}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tipoConfig.bg} ${tipoConfig.color}`}>
                          {tipoConfig.label}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${estadoConfig.bg} ${estadoConfig.color}`}>
                          {estadoConfig.label}
                        </span>
                        {capa.ncr_numero && (
                          <span className="flex items-center gap-1 text-xs text-orange-400">
                            <Link2 className="h-3 w-3" />
                            {capa.ncr_numero}
                          </span>
                        )}
                      </div>
                      
                      {/* Título */}
                      <h4 className="text-slate-200 font-medium mb-2 truncate">{capa.titulo}</h4>
                      
                      {/* Barra de progreso */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400">Progreso</span>
                          <span className="text-slate-300">{capa.porcentaje_avance}%</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-300 ${
                              capa.porcentaje_avance >= 100 ? 'bg-emerald-500' :
                              capa.porcentaje_avance >= 75 ? 'bg-purple-500' :
                              capa.porcentaje_avance >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${capa.porcentaje_avance}%` }}
                          />
                        </div>
                      </div>
                      
                      {/* Metadata */}
                      <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                        {capa.responsable && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {capa.responsable}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Inicio: {formatDate(capa.fecha_inicio)}
                        </span>
                        {diasRestantes !== null && (
                          <span className={`flex items-center gap-1 font-medium ${
                            diasRestantes < 0 ? 'text-red-400' : 
                            diasRestantes <= 7 ? 'text-amber-400' : ''
                          }`}>
                            <Clock className="h-3 w-3" />
                            {diasRestantes < 0 
                              ? `Vencida hace ${Math.abs(diasRestantes)}d`
                              : `${diasRestantes}d restantes`
                            }
                          </span>
                        )}
                        {capa.acciones && capa.acciones.length > 0 && (
                          <span className="flex items-center gap-1">
                            <ListChecks className="h-3 w-3" />
                            {capa.acciones.filter(a => a.estado === 'completada').length}/{capa.acciones.length} acciones
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Acciones */}
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleVerDetalle(capa)}
                        className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                        title="Ver detalle"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {capasFiltradas.length === 0 && (
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-12 text-center">
                <Target className="h-12 w-12 mx-auto mb-3 text-slate-600" />
                <p className="text-slate-400">No se encontraron CAPAs</p>
                <p className="text-sm text-slate-500 mt-1">
                  {filtroEstado === 'activas' ? 'No hay CAPAs activas' : 'Intenta ajustar los filtros'}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ==================== VISTA NUEVA ==================== */}
      {vistaActiva === 'nueva' && (
        <CAPAForm
          formData={formData}
          setFormData={setFormData}
          ncrsDisponibles={ncrsDisponibles}
          onGuardar={handleGuardarCAPA}
          onCancelar={() => setVistaActiva('lista')}
          saving={saving}
        />
      )}

      {/* ==================== VISTA DETALLE ==================== */}
      {vistaActiva === 'detalle' && capaSeleccionada && (
        <CAPADetalle
          capa={capaSeleccionada}
          onVolver={() => setVistaActiva('lista')}
          onActualizar8D={handleActualizar8D}
          onCambiarEstado={handleCambiarEstado}
          onVerificarEfectividad={handleVerificarEfectividad}
          onAgregarAccion={handleAgregarAccion}
          onActualizarAccion={handleActualizarAccion}
          saving={saving}
        />
      )}
    </div>
  );
}

// ============================================
// SUB-COMPONENTE: FORMULARIO CAPA
// ============================================

interface CAPAFormProps {
  formData: CAPAFormData;
  setFormData: React.Dispatch<React.SetStateAction<CAPAFormData>>;
  ncrsDisponibles: { id: string; numero: string; titulo: string }[];
  onGuardar: () => void;
  onCancelar: () => void;
  saving: boolean;
}

function CAPAForm({ formData, setFormData, ncrsDisponibles, onGuardar, onCancelar, saving }: CAPAFormProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onCancelar}
          className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
        <div>
          <h3 className="text-xl font-bold text-slate-100">Nueva CAPA</h3>
          <p className="text-sm text-slate-400">Crear acción correctiva o preventiva</p>
        </div>
      </div>

      {/* Formulario */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6 space-y-6">
        {/* Tipo */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">Tipo de Acción *</label>
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(TIPO_CONFIG).map(([key, val]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, tipo: key as TipoCAPA }))}
                className={`p-4 rounded-xl border text-left transition-colors ${
                  formData.tipo === key
                    ? `${val.bg} border-current ${val.color}`
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className={`font-medium ${formData.tipo === key ? val.color : 'text-slate-200'}`}>
                  {val.label}
                </div>
                <div className="text-xs text-slate-500 mt-1">{val.descripcion}</div>
              </button>
            ))}
          </div>
        </div>

        {/* NCR vinculada */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            NCR Vinculada (opcional)
          </label>
          <select
            value={formData.ncr_id || ''}
            onChange={(e) => {
              const ncr = ncrsDisponibles.find(n => n.id === e.target.value);
              setFormData(prev => ({
                ...prev,
                ncr_id: e.target.value || undefined,
                ncr_numero: ncr?.numero,
              }));
            }}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
          >
            <option value="">Sin NCR vinculada</option>
            {ncrsDisponibles.map(ncr => (
              <option key={ncr.id} value={ncr.id}>
                {ncr.numero} - {ncr.titulo}
              </option>
            ))}
          </select>
        </div>

        {/* Título */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Título *</label>
          <input
            type="text"
            value={formData.titulo}
            onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            placeholder="Descripción breve de la acción"
          />
        </div>

        {/* Descripción del problema */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Descripción del Problema *</label>
          <textarea
            value={formData.descripcion_problema}
            onChange={(e) => setFormData(prev => ({ ...prev, descripcion_problema: e.target.value }))}
            rows={4}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 resize-none"
            placeholder="Describa el problema que origina esta acción..."
          />
        </div>

        {/* Responsable y fecha */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Responsable</label>
            <input
              type="text"
              value={formData.responsable || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, responsable: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="Nombre del responsable"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Fecha Objetivo</label>
            <input
              type="date"
              value={formData.fecha_objetivo?.split('T')[0] || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, fecha_objetivo: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            />
          </div>
          
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.verificacion_requerida}
                onChange={(e) => setFormData(prev => ({ ...prev, verificacion_requerida: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500"
              />
              <span className="text-sm text-slate-300">Requiere verificación de efectividad</span>
            </label>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <button
          onClick={onCancelar}
          className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors"
        >
          Cancelar
        </button>
        
        <button
          onClick={onGuardar}
          disabled={saving || !formData.titulo || !formData.descripcion_problema}
          className="flex items-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-medium transition-colors"
        >
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Crear CAPA
        </button>
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTE: DETALLE CAPA
// ============================================

interface CAPADetalleProps {
  capa: AccionCorrectiva;
  onVolver: () => void;
  onActualizar8D: (capaId: string, campo: string, valor: string) => void;
  onCambiarEstado: (capaId: string, estado: EstadoCAPA) => void;
  onVerificarEfectividad: (capaId: string, efectiva: boolean, resultado: string) => void;
  onAgregarAccion: (capaId: string, accion: Omit<AccionPlan, 'id'>) => void;
  onActualizarAccion: (capaId: string, accionId: string, updates: Partial<AccionPlan>) => void;
  saving: boolean;
}

function CAPADetalle({ 
  capa, onVolver, onActualizar8D, onCambiarEstado, 
  onVerificarEfectividad, onAgregarAccion, onActualizarAccion, saving 
}: CAPADetalleProps) {
  const [pasoActivo, setPasoActivo] = useState<number>(1);
  const [editando8D, setEditando8D] = useState<string | null>(null);
  const [valor8D, setValor8D] = useState('');
  const [showNuevaAccion, setShowNuevaAccion] = useState(false);
  const [nuevaAccion, setNuevaAccion] = useState({ descripcion: '', responsable: '', fecha_objetivo: '' });
  const [showVerificacion, setShowVerificacion] = useState(false);
  const [verificacionResultado, setVerificacionResultado] = useState('');
  
  const tipoConfig = TIPO_CONFIG[capa.tipo];
  const estadoConfig = ESTADO_CONFIG[capa.estado];
  const diasRestantes = getDiasRestantes(capa.fecha_objetivo);

  const handleGuardar8D = () => {
    if (editando8D && valor8D.trim()) {
      onActualizar8D(capa.id, editando8D, valor8D);
      setEditando8D(null);
      setValor8D('');
    }
  };

  const handleAgregarAccionSubmit = () => {
    if (nuevaAccion.descripcion && nuevaAccion.responsable && nuevaAccion.fecha_objetivo) {
      onAgregarAccion(capa.id, {
        ...nuevaAccion,
        estado: 'pendiente',
        orden: (capa.acciones?.length || 0) + 1,
      });
      setNuevaAccion({ descripcion: '', responsable: '', fecha_objetivo: '' });
      setShowNuevaAccion(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onVolver}
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
          >
            <ChevronRight className="h-5 w-5 rotate-180" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-bold text-slate-100">{capa.numero}</h3>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${tipoConfig.bg} ${tipoConfig.color}`}>
                {tipoConfig.label}
              </span>
              <span className={`px-2 py-1 rounded-full text-xs ${estadoConfig.bg} ${estadoConfig.color}`}>
                {estadoConfig.label}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">{capa.titulo}</p>
          </div>
        </div>
        
        {capa.estado !== 'cerrada' && capa.estado !== 'cancelada' && (
          <div className="flex gap-2">
            {capa.estado === 'verificacion' && capa.verificacion_requerida && (
              <button
                onClick={() => setShowVerificacion(true)}
                className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white transition-colors"
              >
                <CheckCircle className="h-4 w-4" />
                Verificar Efectividad
              </button>
            )}
          </div>
        )}
      </div>

      {/* Progreso general */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">Progreso General</span>
          <span className="text-lg font-bold text-slate-200">{capa.porcentaje_avance}%</span>
        </div>
        <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${
              capa.porcentaje_avance >= 100 ? 'bg-emerald-500' :
              capa.porcentaje_avance >= 75 ? 'bg-purple-500' :
              capa.porcentaje_avance >= 50 ? 'bg-blue-500' : 'bg-amber-500'
            }`}
            style={{ width: `${capa.porcentaje_avance}%` }}
          />
        </div>
        
        <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
          <span>Inicio: {formatDate(capa.fecha_inicio)}</span>
          {capa.responsable && <span>Responsable: {capa.responsable}</span>}
          {diasRestantes !== null && (
            <span className={diasRestantes < 0 ? 'text-red-400' : diasRestantes <= 7 ? 'text-amber-400' : ''}>
              {diasRestantes < 0 ? `Vencida hace ${Math.abs(diasRestantes)}d` : `${diasRestantes}d restantes`}
            </span>
          )}
        </div>
      </div>

      {/* Contenido principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Metodología 8D */}
        <div className="lg:col-span-2 space-y-4">
          <h4 className="font-semibold text-slate-200 flex items-center gap-2">
            <Layers className="h-5 w-5 text-purple-400" />
            Metodología 8D
          </h4>
          
          {/* Navegación de pasos */}
          <div className="flex gap-1 overflow-x-auto pb-2">
            {PASOS_8D.map(paso => {
              const valor = capa[paso.campo as keyof AccionCorrectiva];
              const completado = !!valor;
              
              return (
                <button
                  key={paso.num}
                  onClick={() => setPasoActivo(paso.num)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap transition-colors ${
                    pasoActivo === paso.num
                      ? 'bg-purple-600 text-white'
                      : completado
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {completado ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                  <span className="text-sm font-medium">D{paso.num}</span>
                </button>
              );
            })}
          </div>

          {/* Contenido del paso activo */}
          {PASOS_8D.map(paso => {
            if (paso.num !== pasoActivo) return null;
            
            const valor = capa[paso.campo as keyof AccionCorrectiva] as string | undefined;
            const isEditing = editando8D === paso.campo;
            
            return (
              <div key={paso.num} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h5 className="font-medium text-slate-200">{paso.titulo}</h5>
                    <p className="text-sm text-slate-500">{paso.descripcion}</p>
                  </div>
                  {!isEditing && capa.estado !== 'cerrada' && (
                    <button
                      onClick={() => {
                        setEditando8D(paso.campo);
                        setValor8D(valor || '');
                      }}
                      className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  )}
                </div>
                
                {isEditing ? (
                  <div className="space-y-3">
                    <textarea
                      value={valor8D}
                      onChange={(e) => setValor8D(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 resize-none"
                      placeholder={`Ingrese ${paso.titulo.toLowerCase()}...`}
                      autoFocus
                    />
                    
                    {paso.num === 4 && (
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Método de análisis</label>
                        <select
                          value={capa.d4_metodo || ''}
                          onChange={(e) => onActualizar8D(capa.id, 'd4_metodo', e.target.value)}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100"
                        >
                          <option value="">Seleccionar método...</option>
                          {Object.entries(METODO_ANALISIS_CONFIG).map(([key, val]) => (
                            <option key={key} value={key}>{val.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <button
                        onClick={handleGuardar8D}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm"
                      >
                        <Save className="h-4 w-4" />
                        Guardar
                      </button>
                      <button
                        onClick={() => {
                          setEditando8D(null);
                          setValor8D('');
                        }}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : valor ? (
                  <div className="text-slate-300 whitespace-pre-wrap">{valor}</div>
                ) : (
                  <div className="text-slate-500 italic">No completado</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Info */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 space-y-3">
            <h4 className="font-semibold text-slate-200 text-sm">Información</h4>
            
            {capa.ncr_numero && (
              <div>
                <label className="text-xs text-slate-500">NCR Vinculada</label>
                <div className="font-mono text-orange-400">{capa.ncr_numero}</div>
              </div>
            )}
            
            <div>
              <label className="text-xs text-slate-500">Fecha Inicio</label>
              <div className="text-slate-200">{formatDate(capa.fecha_inicio)}</div>
            </div>
            
            {capa.fecha_objetivo && (
              <div>
                <label className="text-xs text-slate-500">Fecha Objetivo</label>
                <div className={`font-medium ${
                  diasRestantes !== null && diasRestantes < 0 ? 'text-red-400' :
                  diasRestantes !== null && diasRestantes <= 7 ? 'text-amber-400' : 'text-slate-200'
                }`}>
                  {formatDate(capa.fecha_objetivo)}
                </div>
              </div>
            )}
            
            {capa.responsable && (
              <div>
                <label className="text-xs text-slate-500">Responsable</label>
                <div className="text-slate-200">{capa.responsable}</div>
              </div>
            )}
            
            <div>
              <label className="text-xs text-slate-500">Verificación</label>
              <div className="text-slate-200">
                {capa.verificacion_requerida ? 'Requerida' : 'No requerida'}
              </div>
            </div>
            
            {capa.verificacion_efectiva !== undefined && (
              <div>
                <label className="text-xs text-slate-500">Resultado Verificación</label>
                <div className={capa.verificacion_efectiva ? 'text-emerald-400' : 'text-red-400'}>
                  {capa.verificacion_efectiva ? 'Efectiva' : 'No Efectiva'}
                </div>
              </div>
            )}
          </div>

          {/* Cambiar estado */}
          {capa.estado !== 'cerrada' && capa.estado !== 'cancelada' && (
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h4 className="font-semibold text-slate-200 text-sm mb-3">Cambiar Estado</h4>
              <div className="space-y-2">
                {capa.estado === 'abierta' && (
                  <button
                    onClick={() => onCambiarEstado(capa.id, 'en_analisis')}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm"
                  >
                    <ArrowRight className="h-4 w-4" />
                    Iniciar Análisis
                  </button>
                )}
                {capa.estado === 'en_analisis' && (
                  <button
                    onClick={() => onCambiarEstado(capa.id, 'en_implementacion')}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"
                  >
                    <ArrowRight className="h-4 w-4" />
                    Pasar a Implementación
                  </button>
                )}
                {capa.estado === 'en_implementacion' && (
                  <button
                    onClick={() => onCambiarEstado(capa.id, capa.verificacion_requerida ? 'verificacion' : 'cerrada')}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm"
                  >
                    <ArrowRight className="h-4 w-4" />
                    {capa.verificacion_requerida ? 'Pasar a Verificación' : 'Cerrar CAPA'}
                  </button>
                )}
                <button
                  onClick={() => onCambiarEstado(capa.id, 'cancelada')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm"
                >
                  <XCircle className="h-4 w-4" />
                  Cancelar CAPA
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Plan de acciones */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-slate-200 flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-blue-400" />
            Plan de Acciones ({capa.acciones?.length || 0})
          </h4>
          {capa.estado !== 'cerrada' && capa.estado !== 'cancelada' && (
            <button
              onClick={() => setShowNuevaAccion(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"
            >
              <Plus className="h-4 w-4" />
              Agregar
            </button>
          )}
        </div>

        {/* Nueva acción form */}
        {showNuevaAccion && (
          <div className="mb-4 p-4 bg-slate-800/50 rounded-lg space-y-3">
            <input
              type="text"
              value={nuevaAccion.descripcion}
              onChange={(e) => setNuevaAccion(prev => ({ ...prev, descripcion: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100"
              placeholder="Descripción de la acción"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={nuevaAccion.responsable}
                onChange={(e) => setNuevaAccion(prev => ({ ...prev, responsable: e.target.value }))}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100"
                placeholder="Responsable"
              />
              <input
                type="date"
                value={nuevaAccion.fecha_objetivo}
                onChange={(e) => setNuevaAccion(prev => ({ ...prev, fecha_objetivo: e.target.value }))}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAgregarAccionSubmit}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"
              >
                Agregar
              </button>
              <button
                onClick={() => setShowNuevaAccion(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Lista de acciones */}
        <div className="space-y-2">
          {capa.acciones?.map(accion => {
            const estadoAccion = ESTADO_ACCION_CONFIG[accion.estado];
            const diasAccion = getDiasRestantes(accion.fecha_objetivo);
            
            return (
              <div 
                key={accion.id} 
                className={`p-3 rounded-lg border ${
                  accion.estado === 'completada' ? 'bg-emerald-500/5 border-emerald-500/20' :
                  accion.estado === 'vencida' || (diasAccion !== null && diasAccion < 0) ? 'bg-red-500/5 border-red-500/20' :
                  'bg-slate-800/30 border-slate-700/30'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <button
                      onClick={() => onActualizarAccion(capa.id, accion.id, {
                        estado: accion.estado === 'completada' ? 'pendiente' : 'completada',
                        fecha_completada: accion.estado === 'completada' ? undefined : new Date().toISOString(),
                      })}
                      disabled={capa.estado === 'cerrada'}
                      className="mt-0.5"
                    >
                      {accion.estado === 'completada' ? (
                        <CheckSquare className="h-5 w-5 text-emerald-400" />
                      ) : (
                        <Square className="h-5 w-5 text-slate-500 hover:text-slate-300" />
                      )}
                    </button>
                    <div className="flex-1">
                      <div className={`text-sm ${accion.estado === 'completada' ? 'text-slate-400 line-through' : 'text-slate-200'}`}>
                        {accion.descripcion}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span>{accion.responsable}</span>
                        <span className={diasAccion !== null && diasAccion < 0 && accion.estado !== 'completada' ? 'text-red-400' : ''}>
                          {formatDate(accion.fecha_objetivo)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs ${estadoAccion.bg} ${estadoAccion.color}`}>
                    {estadoAccion.label}
                  </span>
                </div>
              </div>
            );
          })}
          
          {(!capa.acciones || capa.acciones.length === 0) && (
            <div className="text-center py-8 text-slate-500">
              <ListChecks className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No hay acciones definidas</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de verificación */}
      {showVerificacion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full mx-4">
            <h4 className="text-lg font-semibold text-slate-200 mb-4">Verificar Efectividad</h4>
            
            <textarea
              value={verificacionResultado}
              onChange={(e) => setVerificacionResultado(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 resize-none mb-4"
              placeholder="Describa el resultado de la verificación..."
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  onVerificarEfectividad(capa.id, true, verificacionResultado);
                  setShowVerificacion(false);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
              >
                <CheckCircle className="h-4 w-4" />
                Efectiva
              </button>
              <button
                onClick={() => {
                  onVerificarEfectividad(capa.id, false, verificacionResultado);
                  setShowVerificacion(false);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg"
              >
                <XCircle className="h-4 w-4" />
                No Efectiva
              </button>
            </div>
            
            <button
              onClick={() => setShowVerificacion(false)}
              className="w-full mt-3 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}