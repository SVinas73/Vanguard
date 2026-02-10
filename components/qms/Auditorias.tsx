'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Search, Plus, Filter, Download, RefreshCw,
  CheckCircle, XCircle, Clock, Eye, Edit, Trash2,
  Calendar, Building2, ChevronRight, ChevronDown,
  AlertTriangle, AlertCircle, X, Save,
  Users, FileText, History, ClipboardList,
  Target, Flag, CheckSquare, Square, ExternalLink,
  BookOpen, Award, Shield, Briefcase, UserCheck,
  MessageSquare, Paperclip, MoreHorizontal, Play, Pause
} from 'lucide-react';

// ============================================
// TIPOS LOCALES
// ============================================

type TipoAuditoria = 'interna' | 'externa' | 'cliente' | 'certificacion' | 'proveedor';
type EstadoAuditoria = 'planificada' | 'en_preparacion' | 'en_proceso' | 'informe_pendiente' | 'completada' | 'cancelada';
type TipoHallazgo = 'no_conformidad_mayor' | 'no_conformidad_menor' | 'observacion' | 'oportunidad_mejora' | 'fortaleza';
type EstadoHallazgo = 'abierto' | 'en_seguimiento' | 'verificado' | 'cerrado';

interface Auditoria {
  id: string;
  numero: string;
  
  // Tipo y alcance
  tipo: TipoAuditoria;
  titulo: string;
  objetivo?: string;
  alcance: string;
  criterios: string; // Normas o estándares (ISO 9001, FDA, etc.)
  
  // Entidad auditada
  area_auditada?: string;
  proceso_auditado?: string;
  proveedor_id?: string;
  proveedor_nombre?: string;
  
  // Equipo auditor
  auditor_lider: string;
  auditores?: string[];
  auditor_externo?: string;
  organismo_certificador?: string;
  
  // Fechas
  fecha_planificada: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  duracion_dias?: number;
  
  // Estado
  estado: EstadoAuditoria;
  
  // Resultados
  hallazgos?: Hallazgo[];
  total_hallazgos?: number;
  nc_mayores?: number;
  nc_menores?: number;
  observaciones?: number;
  fortalezas?: number;
  
  // Conclusión
  conclusion?: string;
  recomendacion_certificacion?: 'recomendar' | 'condicional' | 'no_recomendar';
  
  // Documentos
  plan_url?: string;
  checklist_url?: string;
  informe_url?: string;
  documentos?: { nombre: string; url: string; tipo: string }[];
  
  // Notas
  notas?: string;
  
  // Auditoría
  creado_por?: string;
  creado_at: string;
  actualizado_por?: string;
  actualizado_at?: string;
}

interface Hallazgo {
  id: string;
  auditoria_id: string;
  numero: number;
  
  // Clasificación
  tipo: TipoHallazgo;
  
  // Detalle
  requisito: string; // Cláusula de norma (ej: "8.5.1")
  descripcion: string;
  evidencia?: string;
  area?: string;
  proceso?: string;
  
  // Estado y seguimiento
  estado: EstadoHallazgo;
  responsable?: string;
  fecha_compromiso?: string;
  fecha_cierre?: string;
  
  // Acciones vinculadas
  ncr_id?: string;
  ncr_numero?: string;
  capa_id?: string;
  capa_numero?: string;
  
  // Verificación
  verificado_por?: string;
  fecha_verificacion?: string;
  evidencia_cierre?: string;
  
  notas?: string;
  created_at: string;
}

interface AuditoriaFormData {
  tipo: TipoAuditoria;
  titulo: string;
  objetivo?: string;
  alcance: string;
  criterios: string;
  area_auditada?: string;
  proceso_auditado?: string;
  auditor_lider: string;
  auditores?: string[];
  fecha_planificada: string;
  duracion_dias?: number;
  notas?: string;
}

interface HallazgoFormData {
  tipo: TipoHallazgo;
  requisito: string;
  descripcion: string;
  evidencia?: string;
  area?: string;
  responsable?: string;
  fecha_compromiso?: string;
}

type VistaActiva = 'lista' | 'nuevo' | 'detalle' | 'editar';

// ============================================
// CONFIGURACIONES
// ============================================

const TIPO_CONFIG: Record<TipoAuditoria, { label: string; color: string; bg: string; icon: React.ElementType; descripcion: string }> = {
  interna: { label: 'Interna', color: 'text-blue-400', bg: 'bg-blue-500/20', icon: Building2, descripcion: 'Auditoría realizada por personal interno' },
  externa: { label: 'Externa', color: 'text-purple-400', bg: 'bg-purple-500/20', icon: ExternalLink, descripcion: 'Auditoría realizada por terceros' },
  cliente: { label: 'Cliente', color: 'text-cyan-400', bg: 'bg-cyan-500/20', icon: Users, descripcion: 'Auditoría realizada por el cliente' },
  certificacion: { label: 'Certificación', color: 'text-emerald-400', bg: 'bg-emerald-500/20', icon: Award, descripcion: 'Auditoría de organismo certificador' },
  proveedor: { label: 'Proveedor', color: 'text-amber-400', bg: 'bg-amber-500/20', icon: Briefcase, descripcion: 'Auditoría a proveedores' },
};

const ESTADO_CONFIG: Record<EstadoAuditoria, { label: string; color: string; bg: string }> = {
  planificada: { label: 'Planificada', color: 'text-slate-400', bg: 'bg-slate-500/20' },
  en_preparacion: { label: 'En Preparación', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  en_proceso: { label: 'En Proceso', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  informe_pendiente: { label: 'Informe Pendiente', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  completada: { label: 'Completada', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  cancelada: { label: 'Cancelada', color: 'text-red-400', bg: 'bg-red-500/20' },
};

const TIPO_HALLAZGO_CONFIG: Record<TipoHallazgo, { label: string; color: string; bg: string; severidad: number }> = {
  no_conformidad_mayor: { label: 'NC Mayor', color: 'text-red-500', bg: 'bg-red-500/20', severidad: 1 },
  no_conformidad_menor: { label: 'NC Menor', color: 'text-orange-400', bg: 'bg-orange-500/20', severidad: 2 },
  observacion: { label: 'Observación', color: 'text-amber-400', bg: 'bg-amber-500/20', severidad: 3 },
  oportunidad_mejora: { label: 'Oportunidad de Mejora', color: 'text-blue-400', bg: 'bg-blue-500/20', severidad: 4 },
  fortaleza: { label: 'Fortaleza', color: 'text-emerald-400', bg: 'bg-emerald-500/20', severidad: 5 },
};

const ESTADO_HALLAZGO_CONFIG: Record<EstadoHallazgo, { label: string; color: string; bg: string }> = {
  abierto: { label: 'Abierto', color: 'text-red-400', bg: 'bg-red-500/20' },
  en_seguimiento: { label: 'En Seguimiento', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  verificado: { label: 'Verificado', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  cerrado: { label: 'Cerrado', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
};

const CRITERIOS_COMUNES = [
  'ISO 9001:2015',
  'ISO 14001:2015',
  'ISO 45001:2018',
  'ISO 22000:2018',
  'FDA 21 CFR Part 11',
  'FDA 21 CFR Part 820',
  'GMP',
  'HACCP',
  'BRC',
  'IFS',
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

const getDiasParaFecha = (fecha: string | null | undefined): number | null => {
  if (!fecha) return null;
  const hoy = new Date();
  const objetivo = new Date(fecha);
  return Math.ceil((objetivo.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
};

const formatearNumeroAuditoria = (tipo: TipoAuditoria, secuencia: number): string => {
  const year = new Date().getFullYear();
  const prefijos: Record<TipoAuditoria, string> = {
    interna: 'AI',
    externa: 'AE',
    cliente: 'AC',
    certificacion: 'CERT',
    proveedor: 'AP',
  };
  return `${prefijos[tipo]}-${year}-${secuencia.toString().padStart(4, '0')}`;
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function Auditorias() {
  // Estado principal
  const [loading, setLoading] = useState(true);
  const [vistaActiva, setVistaActiva] = useState<VistaActiva>('lista');
  const [auditoriaSeleccionada, setAuditoriaSeleccionada] = useState<Auditoria | null>(null);
  
  // Datos
  const [auditorias, setAuditorias] = useState<Auditoria[]>([]);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('activas');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroAnio, setFiltroAnio] = useState<string>(new Date().getFullYear().toString());
  
  // Form
  const [formData, setFormData] = useState<AuditoriaFormData>({
    tipo: 'interna',
    titulo: '',
    alcance: '',
    criterios: 'ISO 9001:2015',
    auditor_lider: '',
    fecha_planificada: '',
  });
  
  // Hallazgo Form
  const [hallazgoForm, setHallazgoForm] = useState<HallazgoFormData>({
    tipo: 'observacion',
    requisito: '',
    descripcion: '',
  });
  const [showHallazgoModal, setShowHallazgoModal] = useState(false);
  
  // UI
  const [saving, setSaving] = useState(false);
  const [tabActivo, setTabActivo] = useState<'resumen' | 'hallazgos' | 'documentos' | 'timeline'>('resumen');

  // ============================================
  // CARGA DE DATOS
  // ============================================

  useEffect(() => {
    loadAuditorias();
  }, []);

  const loadAuditorias = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('qms_auditorias')
        .select('*')
        .order('fecha_planificada', { ascending: false })
        .limit(200);

      if (!error && data) {
        setAuditorias(data);
      }
    } catch (error) {
      console.error('Error loading auditorias:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHallazgos = async (auditoriaId: string) => {
    const { data } = await supabase
      .from('qms_hallazgos')
      .select('*')
      .eq('auditoria_id', auditoriaId)
      .order('numero', { ascending: true });
    
    if (data && auditoriaSeleccionada) {
      // Calcular totales
      const ncMayores = data.filter(h => h.tipo === 'no_conformidad_mayor').length;
      const ncMenores = data.filter(h => h.tipo === 'no_conformidad_menor').length;
      const observaciones = data.filter(h => h.tipo === 'observacion').length;
      const fortalezas = data.filter(h => h.tipo === 'fortaleza').length;
      
      setAuditoriaSeleccionada({
        ...auditoriaSeleccionada,
        hallazgos: data,
        total_hallazgos: data.length,
        nc_mayores: ncMayores,
        nc_menores: ncMenores,
        observaciones,
        fortalezas,
      });
    }
  };

  // ============================================
  // FILTRADO
  // ============================================

  const auditoriasFiltradas = useMemo(() => {
    return auditorias.filter(aud => {
      // Búsqueda
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchNumero = aud.numero?.toLowerCase().includes(search);
        const matchTitulo = aud.titulo?.toLowerCase().includes(search);
        const matchAuditor = aud.auditor_lider?.toLowerCase().includes(search);
        if (!matchNumero && !matchTitulo && !matchAuditor) return false;
      }
      
      // Filtro estado
      if (filtroEstado === 'activas') {
        if (['completada', 'cancelada'].includes(aud.estado)) return false;
      } else if (filtroEstado !== 'todos' && aud.estado !== filtroEstado) {
        return false;
      }
      
      // Filtro tipo
      if (filtroTipo !== 'todos' && aud.tipo !== filtroTipo) return false;
      
      // Filtro año
      if (filtroAnio !== 'todos') {
        const anioAuditoria = new Date(aud.fecha_planificada).getFullYear().toString();
        if (anioAuditoria !== filtroAnio) return false;
      }
      
      return true;
    });
  }, [auditorias, searchTerm, filtroEstado, filtroTipo, filtroAnio]);

  // ============================================
  // ESTADÍSTICAS
  // ============================================

  const stats = useMemo(() => {
    const year = new Date().getFullYear();
    const esteAnio = auditorias.filter(a => new Date(a.fecha_planificada).getFullYear() === year);
    
    const planificadas = esteAnio.filter(a => a.estado === 'planificada').length;
    const enProceso = esteAnio.filter(a => ['en_preparacion', 'en_proceso', 'informe_pendiente'].includes(a.estado)).length;
    const completadas = esteAnio.filter(a => a.estado === 'completada').length;
    
    const totalHallazgos = esteAnio.reduce((sum, a) => sum + (a.total_hallazgos || 0), 0);
    const ncMayores = esteAnio.reduce((sum, a) => sum + (a.nc_mayores || 0), 0);
    
    const proximaSemana = auditorias.filter(a => {
      const dias = getDiasParaFecha(a.fecha_planificada);
      return dias !== null && dias >= 0 && dias <= 7 && a.estado === 'planificada';
    }).length;
    
    return { planificadas, enProceso, completadas, totalHallazgos, ncMayores, proximaSemana };
  }, [auditorias]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleNuevaAuditoria = () => {
    setFormData({
      tipo: 'interna',
      titulo: '',
      alcance: '',
      criterios: 'ISO 9001:2015',
      auditor_lider: '',
      fecha_planificada: '',
    });
    setVistaActiva('nuevo');
  };

  const handleVerDetalle = async (aud: Auditoria) => {
    setAuditoriaSeleccionada(aud);
    setTabActivo('resumen');
    setVistaActiva('detalle');
    
    // Cargar hallazgos
    const { data } = await supabase
      .from('qms_hallazgos')
      .select('*')
      .eq('auditoria_id', aud.id)
      .order('numero', { ascending: true });
    
    if (data) {
      const ncMayores = data.filter(h => h.tipo === 'no_conformidad_mayor').length;
      const ncMenores = data.filter(h => h.tipo === 'no_conformidad_menor').length;
      const observaciones = data.filter(h => h.tipo === 'observacion').length;
      const fortalezas = data.filter(h => h.tipo === 'fortaleza').length;
      
      setAuditoriaSeleccionada({
        ...aud,
        hallazgos: data,
        total_hallazgos: data.length,
        nc_mayores: ncMayores,
        nc_menores: ncMenores,
        observaciones,
        fortalezas,
      });
    }
  };

  const handleGuardarAuditoria = async () => {
    try {
      setSaving(true);
      
      if (vistaActiva === 'nuevo') {
        // Generar número
        const { data: lastAud } = await supabase
          .from('qms_auditorias')
          .select('numero')
          .eq('tipo', formData.tipo)
          .order('creado_at', { ascending: false })
          .limit(1)
          .single();
        
        const lastSeq = lastAud?.numero ? parseInt(lastAud.numero.split('-')[2]) : 0;
        const numero = formatearNumeroAuditoria(formData.tipo, lastSeq + 1);
        
        const { error } = await supabase
          .from('qms_auditorias')
          .insert({
            numero,
            ...formData,
            estado: 'planificada',
            creado_por: 'Usuario Actual',
          });
        
        if (error) throw error;
      } else {
        // Actualizar
        const { error } = await supabase
          .from('qms_auditorias')
          .update({
            ...formData,
            actualizado_at: new Date().toISOString(),
            actualizado_por: 'Usuario Actual',
          })
          .eq('id', auditoriaSeleccionada?.id);
        
        if (error) throw error;
      }
      
      await loadAuditorias();
      setVistaActiva('lista');
      
    } catch (error) {
      console.error('Error guardando auditoria:', error);
      alert('Error al guardar la auditoría');
    } finally {
      setSaving(false);
    }
  };

  const handleCambiarEstado = async (audId: string, nuevoEstado: EstadoAuditoria) => {
    try {
      const updates: any = {
        estado: nuevoEstado,
        actualizado_at: new Date().toISOString(),
      };
      
      if (nuevoEstado === 'en_proceso' && !auditoriaSeleccionada?.fecha_inicio) {
        updates.fecha_inicio = new Date().toISOString();
      }
      
      if (nuevoEstado === 'completada') {
        updates.fecha_fin = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('qms_auditorias')
        .update(updates)
        .eq('id', audId);
      
      if (error) throw error;
      
      await loadAuditorias();
      if (auditoriaSeleccionada?.id === audId) {
        setAuditoriaSeleccionada({ ...auditoriaSeleccionada, ...updates });
      }
    } catch (error) {
      console.error('Error cambiando estado:', error);
    }
  };

  const handleAgregarHallazgo = async () => {
    if (!auditoriaSeleccionada) return;
    
    try {
      setSaving(true);
      
      // Obtener siguiente número
      const siguienteNumero = (auditoriaSeleccionada.hallazgos?.length || 0) + 1;
      
      const { error } = await supabase
        .from('qms_hallazgos')
        .insert({
          auditoria_id: auditoriaSeleccionada.id,
          numero: siguienteNumero,
          ...hallazgoForm,
          estado: 'abierto',
        });
      
      if (error) throw error;
      
      // Recargar hallazgos
      await loadHallazgos(auditoriaSeleccionada.id);
      
      setHallazgoForm({
        tipo: 'observacion',
        requisito: '',
        descripcion: '',
      });
      setShowHallazgoModal(false);
      
    } catch (error) {
      console.error('Error agregando hallazgo:', error);
      alert('Error al agregar el hallazgo');
    } finally {
      setSaving(false);
    }
  };

  const handleCambiarEstadoHallazgo = async (hallazgoId: string, nuevoEstado: EstadoHallazgo) => {
    try {
      const updates: any = {
        estado: nuevoEstado,
      };
      
      if (nuevoEstado === 'cerrado') {
        updates.fecha_cierre = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('qms_hallazgos')
        .update(updates)
        .eq('id', hallazgoId);
      
      if (error) throw error;
      
      if (auditoriaSeleccionada) {
        await loadHallazgos(auditoriaSeleccionada.id);
      }
    } catch (error) {
      console.error('Error cambiando estado hallazgo:', error);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ==================== VISTA LISTA ==================== */}
      {vistaActiva === 'lista' && (
        <>
          {/* Alertas próximas */}
          {stats.proximaSemana > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-4">
              <div className="p-3 bg-amber-500/20 rounded-xl">
                <Calendar className="h-6 w-6 text-amber-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-amber-400">
                  {stats.proximaSemana} auditoría(s) programada(s) para esta semana
                </h4>
                <p className="text-sm text-amber-300/70">
                  Revise la preparación y documentación necesaria
                </p>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <ClipboardList className="h-6 w-6 text-indigo-400" />
                Gestión de Auditorías
              </h3>
              <p className="text-slate-400 text-sm mt-1">
                Auditorías internas, externas, de certificación y proveedores
              </p>
            </div>
            
            {/* Stats */}
            <div className="flex gap-3">
              <div className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl">
                <div className="text-xs text-slate-400">Planificadas</div>
                <div className="text-xl font-bold text-slate-300">{stats.planificadas}</div>
              </div>
              <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <div className="text-xs text-blue-400">En Proceso</div>
                <div className="text-xl font-bold text-blue-400">{stats.enProceso}</div>
              </div>
              <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                <div className="text-xs text-emerald-400">Completadas</div>
                <div className="text-xl font-bold text-emerald-400">{stats.completadas}</div>
              </div>
              {stats.ncMayores > 0 && (
                <div className="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <div className="text-xs text-red-400">NC Mayores</div>
                  <div className="text-xl font-bold text-red-400">{stats.ncMayores}</div>
                </div>
              )}
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-3 items-center flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar por número, título, auditor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
              >
                <option value="activas">Activas</option>
                <option value="todos">Todas</option>
                <option value="planificada">Planificadas</option>
                <option value="en_proceso">En Proceso</option>
                <option value="completada">Completadas</option>
              </select>
              
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
              >
                <option value="todos">Todos los tipos</option>
                {Object.entries(TIPO_CONFIG).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
              
              <select
                value={filtroAnio}
                onChange={(e) => setFiltroAnio(e.target.value)}
                className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
              >
                <option value="todos">Todos los años</option>
                {[2026, 2025, 2024, 2023].map(anio => (
                  <option key={anio} value={anio.toString()}>{anio}</option>
                ))}
              </select>
              
              <button
                onClick={loadAuditorias}
                className="p-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-400 hover:text-slate-200 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            
            <button
              onClick={handleNuevaAuditoria}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nueva Auditoría
            </button>
          </div>

          {/* Accesos rápidos por tipo */}
          <div className="flex gap-2 flex-wrap">
            {Object.entries(TIPO_CONFIG).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <button
                  key={key}
                  onClick={() => {
                    setFormData(prev => ({ ...prev, tipo: key as TipoAuditoria }));
                    setVistaActiva('nuevo');
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 ${config.bg} border border-current/30 rounded-lg ${config.color} text-sm hover:opacity-80 transition-opacity`}
                >
                  <Icon className="h-4 w-4" />
                  + {config.label}
                </button>
              );
            })}
          </div>

          {/* Lista de auditorías */}
          <div className="space-y-3">
            {auditoriasFiltradas.map(aud => {
              const tipoConfig = TIPO_CONFIG[aud.tipo];
              const estadoConfig = ESTADO_CONFIG[aud.estado];
              const TipoIcon = tipoConfig.icon;
              const diasParaAuditoria = getDiasParaFecha(aud.fecha_planificada);
              
              return (
                <div 
                  key={aud.id} 
                  className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 hover:border-slate-600 transition-colors cursor-pointer"
                  onClick={() => handleVerDetalle(aud)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className="font-mono text-sm text-indigo-400">{aud.numero}</span>
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${tipoConfig.bg} ${tipoConfig.color}`}>
                          <TipoIcon className="h-3 w-3" />
                          {tipoConfig.label}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${estadoConfig.bg} ${estadoConfig.color}`}>
                          {estadoConfig.label}
                        </span>
                      </div>
                      
                      {/* Título */}
                      <h4 className="font-medium text-slate-200 mb-1">{aud.titulo}</h4>
                      
                      {/* Alcance y criterios */}
                      <p className="text-sm text-slate-400 mb-2 line-clamp-1">
                        {aud.alcance} • {aud.criterios}
                      </p>
                      
                      {/* Métricas de hallazgos */}
                      {(aud.total_hallazgos || 0) > 0 && (
                        <div className="flex gap-3 mb-2">
                          {(aud.nc_mayores || 0) > 0 && (
                            <span className="text-xs text-red-400">{aud.nc_mayores} NC Mayor</span>
                          )}
                          {(aud.nc_menores || 0) > 0 && (
                            <span className="text-xs text-orange-400">{aud.nc_menores} NC Menor</span>
                          )}
                          {(aud.observaciones || 0) > 0 && (
                            <span className="text-xs text-amber-400">{aud.observaciones} Obs.</span>
                          )}
                          {(aud.fortalezas || 0) > 0 && (
                            <span className="text-xs text-emerald-400">{aud.fortalezas} Fortalezas</span>
                          )}
                        </div>
                      )}
                      
                      {/* Metadata */}
                      <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(aud.fecha_planificada)}
                          {diasParaAuditoria !== null && diasParaAuditoria >= 0 && aud.estado === 'planificada' && (
                            <span className={diasParaAuditoria <= 7 ? 'text-amber-400' : ''}>
                              (en {diasParaAuditoria} días)
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-1">
                          <UserCheck className="h-3 w-3" />
                          {aud.auditor_lider}
                        </span>
                        {aud.area_auditada && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {aud.area_auditada}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Indicador */}
                    <div className={`p-3 rounded-xl ${tipoConfig.bg}`}>
                      <TipoIcon className={`h-6 w-6 ${tipoConfig.color}`} />
                    </div>
                  </div>
                </div>
              );
            })}
            
            {auditoriasFiltradas.length === 0 && (
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-12 text-center">
                <ClipboardList className="h-12 w-12 mx-auto mb-3 text-slate-600" />
                <p className="text-slate-400">No se encontraron auditorías</p>
                <p className="text-sm text-slate-500 mt-1">Crea una nueva auditoría para comenzar</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ==================== VISTA NUEVO/EDITAR ==================== */}
      {(vistaActiva === 'nuevo' || vistaActiva === 'editar') && (
        <AuditoriaForm
          formData={formData}
          setFormData={setFormData}
          onGuardar={handleGuardarAuditoria}
          onCancelar={() => setVistaActiva('lista')}
          saving={saving}
          isEditing={vistaActiva === 'editar'}
        />
      )}

      {/* ==================== VISTA DETALLE ==================== */}
      {vistaActiva === 'detalle' && auditoriaSeleccionada && (
        <AuditoriaDetalle
          aud={auditoriaSeleccionada}
          tabActivo={tabActivo}
          setTabActivo={setTabActivo}
          onVolver={() => setVistaActiva('lista')}
          onEditar={() => {
            setFormData({
              tipo: auditoriaSeleccionada.tipo,
              titulo: auditoriaSeleccionada.titulo,
              objetivo: auditoriaSeleccionada.objetivo,
              alcance: auditoriaSeleccionada.alcance,
              criterios: auditoriaSeleccionada.criterios,
              area_auditada: auditoriaSeleccionada.area_auditada,
              proceso_auditado: auditoriaSeleccionada.proceso_auditado,
              auditor_lider: auditoriaSeleccionada.auditor_lider,
              auditores: auditoriaSeleccionada.auditores,
              fecha_planificada: auditoriaSeleccionada.fecha_planificada.split('T')[0],
              duracion_dias: auditoriaSeleccionada.duracion_dias,
              notas: auditoriaSeleccionada.notas,
            });
            setVistaActiva('editar');
          }}
          onCambiarEstado={handleCambiarEstado}
          onAgregarHallazgo={() => setShowHallazgoModal(true)}
          onCambiarEstadoHallazgo={handleCambiarEstadoHallazgo}
        />
      )}

      {/* ==================== MODAL HALLAZGO ==================== */}
      {showHallazgoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-100">Agregar Hallazgo</h3>
              <button
                onClick={() => setShowHallazgoModal(false)}
                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Tipo de hallazgo */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de Hallazgo *</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(TIPO_HALLAZGO_CONFIG).map(([key, config]) => (
                    <button
                      key={key}
                      onClick={() => setHallazgoForm(prev => ({ ...prev, tipo: key as TipoHallazgo }))}
                      className={`p-2 rounded-lg border text-sm text-left transition-colors ${
                        hallazgoForm.tipo === key
                          ? `${config.bg} border-current ${config.color}`
                          : 'border-slate-700 hover:border-slate-600 text-slate-300'
                      }`}
                    >
                      {config.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Requisito/Cláusula *</label>
                <input
                  type="text"
                  value={hallazgoForm.requisito}
                  onChange={(e) => setHallazgoForm(prev => ({ ...prev, requisito: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  placeholder="Ej: 8.5.1, 7.1.5.2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Descripción *</label>
                <textarea
                  value={hallazgoForm.descripcion}
                  onChange={(e) => setHallazgoForm(prev => ({ ...prev, descripcion: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 resize-none"
                  placeholder="Descripción detallada del hallazgo..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Evidencia</label>
                <textarea
                  value={hallazgoForm.evidencia || ''}
                  onChange={(e) => setHallazgoForm(prev => ({ ...prev, evidencia: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 resize-none"
                  placeholder="Evidencia objetiva del hallazgo..."
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Área/Proceso</label>
                  <input
                    type="text"
                    value={hallazgoForm.area || ''}
                    onChange={(e) => setHallazgoForm(prev => ({ ...prev, area: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                    placeholder="Área donde se detectó"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Responsable</label>
                  <input
                    type="text"
                    value={hallazgoForm.responsable || ''}
                    onChange={(e) => setHallazgoForm(prev => ({ ...prev, responsable: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                    placeholder="Responsable de la acción"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Fecha Compromiso</label>
                <input
                  type="date"
                  value={hallazgoForm.fecha_compromiso || ''}
                  onChange={(e) => setHallazgoForm(prev => ({ ...prev, fecha_compromiso: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowHallazgoModal(false)}
                className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleAgregarHallazgo}
                disabled={saving || !hallazgoForm.requisito || !hallazgoForm.descripcion}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white rounded-xl"
              >
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Agregar Hallazgo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// SUB-COMPONENTE: FORMULARIO
// ============================================

interface AuditoriaFormProps {
  formData: AuditoriaFormData;
  setFormData: React.Dispatch<React.SetStateAction<AuditoriaFormData>>;
  onGuardar: () => void;
  onCancelar: () => void;
  saving: boolean;
  isEditing: boolean;
}

function AuditoriaForm({ formData, setFormData, onGuardar, onCancelar, saving, isEditing }: AuditoriaFormProps) {
  const tipoConfig = TIPO_CONFIG[formData.tipo];
  
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
          <h3 className="text-xl font-bold text-slate-100">
            {isEditing ? 'Editar Auditoría' : 'Nueva Auditoría'}
          </h3>
          <p className="text-sm text-slate-400">{tipoConfig.descripcion}</p>
        </div>
      </div>

      {/* Tipo de auditoría */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
        <label className="block text-sm font-medium text-slate-300 mb-3">Tipo de Auditoría *</label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(TIPO_CONFIG).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <button
                key={key}
                onClick={() => setFormData(prev => ({ ...prev, tipo: key as TipoAuditoria }))}
                className={`p-3 rounded-xl border text-left transition-colors ${
                  formData.tipo === key
                    ? `${config.bg} border-current ${config.color}`
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <Icon className={`h-5 w-5 mb-1 ${formData.tipo === key ? config.color : 'text-slate-400'}`} />
                <div className={`font-medium text-sm ${formData.tipo === key ? config.color : 'text-slate-200'}`}>
                  {config.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Información básica */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6 space-y-4">
        <h4 className="font-semibold text-slate-200">Información de la Auditoría</h4>
        
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Título *</label>
          <input
            type="text"
            value={formData.titulo}
            onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            placeholder="Ej: Auditoría Interna Q1 2024 - Producción"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Objetivo</label>
          <textarea
            value={formData.objetivo || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, objetivo: e.target.value }))}
            rows={2}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 resize-none"
            placeholder="Objetivo de la auditoría..."
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Alcance *</label>
          <textarea
            value={formData.alcance}
            onChange={(e) => setFormData(prev => ({ ...prev, alcance: e.target.value }))}
            rows={2}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 resize-none"
            placeholder="Procesos, áreas y actividades a auditar..."
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Criterios de Auditoría *</label>
          <select
            value={formData.criterios}
            onChange={(e) => setFormData(prev => ({ ...prev, criterios: e.target.value }))}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
          >
            {CRITERIOS_COMUNES.map(criterio => (
              <option key={criterio} value={criterio}>{criterio}</option>
            ))}
          </select>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Área Auditada</label>
            <input
              type="text"
              value={formData.area_auditada || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, area_auditada: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="Ej: Producción, Calidad, Almacén"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Proceso Auditado</label>
            <input
              type="text"
              value={formData.proceso_auditado || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, proceso_auditado: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="Ej: Control de Documentos"
            />
          </div>
        </div>
      </div>

      {/* Equipo y fechas */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6 space-y-4">
        <h4 className="font-semibold text-slate-200">Equipo Auditor y Programación</h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Auditor Líder *</label>
            <input
              type="text"
              value={formData.auditor_lider}
              onChange={(e) => setFormData(prev => ({ ...prev, auditor_lider: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="Nombre del auditor líder"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Fecha Planificada *</label>
            <input
              type="date"
              value={formData.fecha_planificada}
              onChange={(e) => setFormData(prev => ({ ...prev, fecha_planificada: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Duración Estimada (días)</label>
          <input
            type="number"
            value={formData.duracion_dias || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, duracion_dias: parseInt(e.target.value) || undefined }))}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            placeholder="1"
          />
        </div>
      </div>

      {/* Notas */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
        <label className="block text-sm font-medium text-slate-300 mb-2">Notas</label>
        <textarea
          value={formData.notas || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, notas: e.target.value }))}
          rows={3}
          className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 resize-none"
          placeholder="Observaciones adicionales..."
        />
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
          disabled={saving || !formData.titulo || !formData.alcance || !formData.auditor_lider || !formData.fecha_planificada}
          className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-medium transition-colors"
        >
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isEditing ? 'Guardar Cambios' : 'Crear Auditoría'}
        </button>
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTE: DETALLE
// ============================================

interface AuditoriaDetalleProps {
  aud: Auditoria;
  tabActivo: 'resumen' | 'hallazgos' | 'documentos' | 'timeline';
  setTabActivo: (tab: 'resumen' | 'hallazgos' | 'documentos' | 'timeline') => void;
  onVolver: () => void;
  onEditar: () => void;
  onCambiarEstado: (id: string, estado: EstadoAuditoria) => void;
  onAgregarHallazgo: () => void;
  onCambiarEstadoHallazgo: (id: string, estado: EstadoHallazgo) => void;
}

function AuditoriaDetalle({ 
  aud, tabActivo, setTabActivo, onVolver, onEditar, 
  onCambiarEstado, onAgregarHallazgo, onCambiarEstadoHallazgo 
}: AuditoriaDetalleProps) {
  const tipoConfig = TIPO_CONFIG[aud.tipo];
  const estadoConfig = ESTADO_CONFIG[aud.estado];
  const TipoIcon = tipoConfig.icon;

  const siguienteEstado: Partial<Record<EstadoAuditoria, EstadoAuditoria>> = {
    planificada: 'en_preparacion',
    en_preparacion: 'en_proceso',
    en_proceso: 'informe_pendiente',
    informe_pendiente: 'completada',
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
              <span className="font-mono text-lg text-indigo-400">{aud.numero}</span>
              <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${tipoConfig.bg} ${tipoConfig.color}`}>
                <TipoIcon className="h-3 w-3" />
                {tipoConfig.label}
              </span>
              <span className={`px-2 py-1 rounded-full text-xs ${estadoConfig.bg} ${estadoConfig.color}`}>
                {estadoConfig.label}
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-100 mt-1">{aud.titulo}</h3>
          </div>
        </div>
        
        <div className="flex gap-2">
          {aud.estado !== 'completada' && aud.estado !== 'cancelada' && siguienteEstado[aud.estado] && (
            <button
              onClick={() => onCambiarEstado(aud.id, siguienteEstado[aud.estado]!)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium"
            >
              <Play className="h-4 w-4" />
              {ESTADO_CONFIG[siguienteEstado[aud.estado]!].label}
            </button>
          )}
          <button
            onClick={onEditar}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl"
          >
            <Edit className="h-4 w-4" />
            Editar
          </button>
        </div>
      </div>

      {/* Resumen de hallazgos */}
      <div className="grid grid-cols-5 gap-3">
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-slate-200">{aud.total_hallazgos || 0}</div>
          <div className="text-xs text-slate-400">Total</div>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-red-400">{aud.nc_mayores || 0}</div>
          <div className="text-xs text-red-400">NC Mayores</div>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-orange-400">{aud.nc_menores || 0}</div>
          <div className="text-xs text-orange-400">NC Menores</div>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-amber-400">{aud.observaciones || 0}</div>
          <div className="text-xs text-amber-400">Observaciones</div>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-emerald-400">{aud.fortalezas || 0}</div>
          <div className="text-xs text-emerald-400">Fortalezas</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <div className="flex gap-1">
          {[
            { id: 'resumen' as const, label: 'Resumen', icon: FileText },
            { id: 'hallazgos' as const, label: 'Hallazgos', icon: AlertTriangle, count: aud.total_hallazgos },
            { id: 'documentos' as const, label: 'Documentos', icon: Paperclip },
            { id: 'timeline' as const, label: 'Timeline', icon: History },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setTabActivo(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  tabActivo === tab.id
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">{tab.count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenido del tab */}
      {tabActivo === 'resumen' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h4 className="font-semibold text-slate-200 mb-3">Alcance y Criterios</h4>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500">Alcance</label>
                  <p className="text-slate-300">{aud.alcance}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Criterios</label>
                  <p className="text-slate-300">{aud.criterios}</p>
                </div>
                {aud.objetivo && (
                  <div>
                    <label className="text-xs text-slate-500">Objetivo</label>
                    <p className="text-slate-300">{aud.objetivo}</p>
                  </div>
                )}
              </div>
            </div>
            
            {aud.conclusion && (
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                <h4 className="font-semibold text-slate-200 mb-3">Conclusión</h4>
                <p className="text-slate-300">{aud.conclusion}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 space-y-3">
              <h4 className="font-semibold text-slate-200 text-sm">Información</h4>
              
              <div>
                <label className="text-xs text-slate-500">Fecha Planificada</label>
                <div className="text-slate-200">{formatDate(aud.fecha_planificada)}</div>
              </div>
              
              {aud.fecha_inicio && (
                <div>
                  <label className="text-xs text-slate-500">Fecha Inicio</label>
                  <div className="text-slate-200">{formatDate(aud.fecha_inicio)}</div>
                </div>
              )}
              
              {aud.fecha_fin && (
                <div>
                  <label className="text-xs text-slate-500">Fecha Fin</label>
                  <div className="text-slate-200">{formatDate(aud.fecha_fin)}</div>
                </div>
              )}
              
              <div>
                <label className="text-xs text-slate-500">Auditor Líder</label>
                <div className="text-slate-200">{aud.auditor_lider}</div>
              </div>
              
              {aud.area_auditada && (
                <div>
                  <label className="text-xs text-slate-500">Área Auditada</label>
                  <div className="text-slate-200">{aud.area_auditada}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tabActivo === 'hallazgos' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-slate-400">Hallazgos detectados durante la auditoría</p>
            {aud.estado === 'en_proceso' && (
              <button
                onClick={onAgregarHallazgo}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm"
              >
                <Plus className="h-4 w-4" />
                Agregar Hallazgo
              </button>
            )}
          </div>

          {aud.hallazgos && aud.hallazgos.length > 0 ? (
            <div className="space-y-3">
              {aud.hallazgos.map(hallazgo => {
                const tipoHallazgoConfig = TIPO_HALLAZGO_CONFIG[hallazgo.tipo];
                const estadoHallazgoConfig = ESTADO_HALLAZGO_CONFIG[hallazgo.estado];
                
                return (
                  <div key={hallazgo.id} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-sm text-slate-400">#{hallazgo.numero}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${tipoHallazgoConfig.bg} ${tipoHallazgoConfig.color}`}>
                            {tipoHallazgoConfig.label}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${estadoHallazgoConfig.bg} ${estadoHallazgoConfig.color}`}>
                            {estadoHallazgoConfig.label}
                          </span>
                          <span className="text-xs text-slate-500 font-mono">Req: {hallazgo.requisito}</span>
                        </div>
                        
                        <p className="text-slate-200 mb-2">{hallazgo.descripcion}</p>
                        
                        {hallazgo.evidencia && (
                          <p className="text-sm text-slate-400 italic mb-2">Evidencia: {hallazgo.evidencia}</p>
                        )}
                        
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          {hallazgo.responsable && (
                            <span>Responsable: {hallazgo.responsable}</span>
                          )}
                          {hallazgo.fecha_compromiso && (
                            <span>Fecha compromiso: {formatDate(hallazgo.fecha_compromiso)}</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-1">
                        {hallazgo.estado === 'abierto' && (
                          <button
                            onClick={() => onCambiarEstadoHallazgo(hallazgo.id, 'en_seguimiento')}
                            className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded text-xs"
                          >
                            Seguimiento
                          </button>
                        )}
                        {hallazgo.estado === 'en_seguimiento' && (
                          <button
                            onClick={() => onCambiarEstadoHallazgo(hallazgo.id, 'verificado')}
                            className="px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded text-xs"
                          >
                            Verificar
                          </button>
                        )}
                        {hallazgo.estado === 'verificado' && (
                          <button
                            onClick={() => onCambiarEstadoHallazgo(hallazgo.id, 'cerrado')}
                            className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded text-xs"
                          >
                            Cerrar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-12 text-center">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-emerald-400" />
              <p className="text-slate-400">No hay hallazgos registrados</p>
              {aud.estado === 'en_proceso' && (
                <p className="text-sm text-slate-500 mt-1">Agregue hallazgos durante la auditoría</p>
              )}
            </div>
          )}
        </div>
      )}

      {tabActivo === 'documentos' && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-12 text-center">
          <Paperclip className="h-12 w-12 mx-auto mb-3 text-slate-600" />
          <p className="text-slate-400">Gestión de documentos próximamente</p>
          <p className="text-sm text-slate-500 mt-1">Plan, checklist, informe, evidencias...</p>
        </div>
      )}

      {tabActivo === 'timeline' && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-indigo-500" />
                <div className="w-0.5 h-full bg-slate-700" />
              </div>
              <div className="flex-1 pb-4">
                <div className="text-sm text-slate-200">Auditoría creada</div>
                <div className="text-xs text-slate-500">{formatDateTime(aud.creado_at)} por {aud.creado_por}</div>
              </div>
            </div>
            
            {aud.fecha_inicio && (
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <div className="w-0.5 h-full bg-slate-700" />
                </div>
                <div className="flex-1 pb-4">
                  <div className="text-sm text-slate-200">Auditoría iniciada</div>
                  <div className="text-xs text-slate-500">{formatDateTime(aud.fecha_inicio)}</div>
                </div>
              </div>
            )}
            
            {aud.fecha_fin && (
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-slate-200">Auditoría completada</div>
                  <div className="text-xs text-slate-500">{formatDateTime(aud.fecha_fin)}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}