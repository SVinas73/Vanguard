'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Thermometer, Search, Plus, Filter, Download, RefreshCw,
  CheckCircle, XCircle, Clock, Eye, Edit, Trash2,
  Calendar, Building2, ChevronRight, ChevronDown,
  AlertTriangle, AlertCircle, X, Save, Upload,
  Wrench, MapPin, User, FileText, History, Bell,
  Settings, Activity, TrendingUp, BarChart3, Award,
  ExternalLink, Printer, Mail, QrCode
} from 'lucide-react';

// ============================================
// TIPOS LOCALES
// ============================================

type EstadoInstrumento = 'activo' | 'en_calibracion' | 'fuera_servicio' | 'dado_baja' | 'prestado';
type TipoInstrumento = 'dimensional' | 'temperatura' | 'presion' | 'peso' | 'electrico' | 'quimico' | 'otro';
type ResultadoCalibracion = 'aprobado' | 'ajustado' | 'rechazado' | 'fuera_tolerancia';

interface Instrumento {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  
  // Clasificación
  tipo: TipoInstrumento;
  marca?: string;
  modelo?: string;
  numero_serie?: string;
  
  // Ubicación
  ubicacion?: string;
  almacen_id?: string;
  responsable?: string;
  
  // Especificaciones técnicas
  rango_min?: number;
  rango_max?: number;
  unidad_medida?: string;
  resolucion?: number;
  exactitud?: number;
  clase_precision?: string;
  
  // Calibración
  requiere_calibracion: boolean;
  frecuencia_calibracion_dias: number;
  proveedor_calibracion?: string;
  costo_calibracion?: number;
  
  ultima_calibracion?: string;
  proxima_calibracion?: string;
  certificado_calibracion_url?: string;
  
  // Estado
  estado: EstadoInstrumento;
  
  // Calculado
  dias_para_calibracion: number | null;
  
  // Historial
  historial_calibraciones?: CalibracionHistorial[];
  
  // Documentación
  manual_url?: string;
  ficha_tecnica_url?: string;
  
  // Notas
  notas?: string;
  
  // Auditoría
  creado_por?: string;
  creado_at: string;
  actualizado_por?: string;
  actualizado_at?: string;
}

interface CalibracionHistorial {
  id: string;
  instrumento_id: string;
  fecha_calibracion: string;
  fecha_vencimiento: string;
  proveedor: string;
  resultado: ResultadoCalibracion;
  certificado_numero?: string;
  certificado_url?: string;
  costo?: number;
  
  // Mediciones de referencia
  patron_usado?: string;
  lecturas_antes?: LecturaCalibracion[];
  lecturas_despues?: LecturaCalibracion[];
  
  // Ajustes realizados
  ajustes_realizados?: string;
  
  notas?: string;
  calibrado_por?: string;
  aprobado_por?: string;
  created_at: string;
}

interface LecturaCalibracion {
  punto: number;
  valor_patron: number;
  valor_instrumento: number;
  error: number;
  tolerancia: number;
  conforme: boolean;
}

interface InstrumentoFormData {
  codigo: string;
  nombre: string;
  descripcion?: string;
  tipo: TipoInstrumento;
  marca?: string;
  modelo?: string;
  numero_serie?: string;
  ubicacion?: string;
  responsable?: string;
  rango_min?: number;
  rango_max?: number;
  unidad_medida?: string;
  resolucion?: number;
  exactitud?: number;
  requiere_calibracion: boolean;
  frecuencia_calibracion_dias: number;
  proveedor_calibracion?: string;
  costo_calibracion?: number;
  notas?: string;
}

interface CalibracionFormData {
  fecha_calibracion: string;
  proveedor: string;
  resultado: ResultadoCalibracion;
  certificado_numero?: string;
  certificado_url?: string;
  costo?: number;
  patron_usado?: string;
  ajustes_realizados?: string;
  notas?: string;
}

type VistaActiva = 'lista' | 'nuevo' | 'detalle' | 'editar' | 'calibrar';

// ============================================
// CONFIGURACIONES
// ============================================

const ESTADO_CONFIG: Record<EstadoInstrumento, { label: string; color: string; bg: string }> = {
  activo: { label: 'Activo', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  en_calibracion: { label: 'En Calibración', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  fuera_servicio: { label: 'Fuera de Servicio', color: 'text-red-400', bg: 'bg-red-500/20' },
  dado_baja: { label: 'Dado de Baja', color: 'text-slate-400', bg: 'bg-slate-500/20' },
  prestado: { label: 'Prestado', color: 'text-purple-400', bg: 'bg-purple-500/20' },
};

const TIPO_CONFIG: Record<TipoInstrumento, { label: string; icon: React.ElementType; color: string }> = {
  dimensional: { label: 'Dimensional', icon: Wrench, color: 'text-blue-400' },
  temperatura: { label: 'Temperatura', icon: Thermometer, color: 'text-orange-400' },
  presion: { label: 'Presión', icon: Activity, color: 'text-purple-400' },
  peso: { label: 'Peso/Masa', icon: BarChart3, color: 'text-emerald-400' },
  electrico: { label: 'Eléctrico', icon: Activity, color: 'text-yellow-400' },
  quimico: { label: 'Químico', icon: Activity, color: 'text-cyan-400' },
  otro: { label: 'Otro', icon: Settings, color: 'text-slate-400' },
};

const RESULTADO_CALIBRACION_CONFIG: Record<ResultadoCalibracion, { label: string; color: string; bg: string }> = {
  aprobado: { label: 'Aprobado', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  ajustado: { label: 'Ajustado', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  rechazado: { label: 'Rechazado', color: 'text-red-400', bg: 'bg-red-500/20' },
  fuera_tolerancia: { label: 'Fuera de Tolerancia', color: 'text-orange-400', bg: 'bg-orange-500/20' },
};

// ============================================
// HELPERS
// ============================================

const formatDate = (date: string | null | undefined): string => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('es-UY', { 
    day: '2-digit', month: '2-digit', year: 'numeric' 
  });
};

const getDiasParaCalibracion = (proxima: string | null | undefined): number | null => {
  if (!proxima) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const objetivo = new Date(proxima);
  objetivo.setHours(0, 0, 0, 0);
  return Math.ceil((objetivo.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
};

const getColorPorDias = (dias: number | null): { color: string; bg: string } => {
  if (dias === null) return { color: 'text-slate-400', bg: 'bg-slate-500/20' };
  if (dias < 0) return { color: 'text-red-500', bg: 'bg-red-500/20' };
  if (dias <= 7) return { color: 'text-red-400', bg: 'bg-red-500/10' };
  if (dias <= 30) return { color: 'text-amber-400', bg: 'bg-amber-500/10' };
  if (dias <= 60) return { color: 'text-yellow-400', bg: 'bg-yellow-500/10' };
  return { color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
};

const formatearCodigoInstrumento = (tipo: TipoInstrumento, secuencia: number): string => {
  const prefijos: Record<TipoInstrumento, string> = {
    dimensional: 'DIM',
    temperatura: 'TMP',
    presion: 'PRS',
    peso: 'PES',
    electrico: 'ELE',
    quimico: 'QUI',
    otro: 'INS',
  };
  return `${prefijos[tipo]}-${secuencia.toString().padStart(4, '0')}`;
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function Instrumentos() {
  // Estado principal
  const [loading, setLoading] = useState(true);
  const [vistaActiva, setVistaActiva] = useState<VistaActiva>('lista');
  const [instrumentoSeleccionado, setInstrumentoSeleccionado] = useState<Instrumento | null>(null);
  
  // Datos
  const [instrumentos, setInstrumentos] = useState<Instrumento[]>([]);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroCalibracion, setFiltroCalibracion] = useState<string>('todos');
  
  // Form
  const [formData, setFormData] = useState<InstrumentoFormData>({
    codigo: '',
    nombre: '',
    tipo: 'dimensional',
    requiere_calibracion: true,
    frecuencia_calibracion_dias: 365,
  });
  
  const [calibracionForm, setCalibracionForm] = useState<CalibracionFormData>({
    fecha_calibracion: new Date().toISOString().split('T')[0],
    proveedor: '',
    resultado: 'aprobado',
  });
  
  // UI
  const [saving, setSaving] = useState(false);
  const [tabActivo, setTabActivo] = useState<'info' | 'calibraciones' | 'documentos'>('info');

  // ============================================
  // CARGA DE DATOS
  // ============================================

  useEffect(() => {
    loadInstrumentos();
  }, []);

  const loadInstrumentos = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('qms_instrumentos')
        .select('*')
        .order('proxima_calibracion', { ascending: true, nullsFirst: false })
        .limit(500);

      if (!error && data) {
        // Calcular días para calibración
        const instrumentosConDias = data.map(inst => ({
          ...inst,
          dias_para_calibracion: getDiasParaCalibracion(inst.proxima_calibracion),
        }));
        setInstrumentos(instrumentosConDias);
      }
    } catch (error) {
      console.error('Error loading instrumentos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHistorialCalibraciones = async (instrumentoId: string) => {
    const { data } = await supabase
      .from('qms_calibraciones')
      .select('*')
      .eq('instrumento_id', instrumentoId)
      .order('fecha_calibracion', { ascending: false });
    
    if (data && instrumentoSeleccionado) {
      setInstrumentoSeleccionado({
        ...instrumentoSeleccionado,
        historial_calibraciones: data,
      });
    }
  };

  // ============================================
  // FILTRADO
  // ============================================

  const instrumentosFiltrados = useMemo(() => {
    return instrumentos.filter(inst => {
      // Búsqueda
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchCodigo = inst.codigo?.toLowerCase().includes(search);
        const matchNombre = inst.nombre?.toLowerCase().includes(search);
        const matchMarca = inst.marca?.toLowerCase().includes(search);
        const matchUbicacion = inst.ubicacion?.toLowerCase().includes(search);
        if (!matchCodigo && !matchNombre && !matchMarca && !matchUbicacion) return false;
      }
      
      // Filtro estado
      if (filtroEstado !== 'todos' && inst.estado !== filtroEstado) return false;
      
      // Filtro tipo
      if (filtroTipo !== 'todos' && inst.tipo !== filtroTipo) return false;
      
      // Filtro calibración
      if (filtroCalibracion === 'vencidos' && (inst.dias_para_calibracion === null || inst.dias_para_calibracion >= 0)) return false;
      if (filtroCalibracion === 'proximos_30' && (inst.dias_para_calibracion === null || inst.dias_para_calibracion < 0 || inst.dias_para_calibracion > 30)) return false;
      if (filtroCalibracion === 'proximos_60' && (inst.dias_para_calibracion === null || inst.dias_para_calibracion < 0 || inst.dias_para_calibracion > 60)) return false;
      
      return true;
    });
  }, [instrumentos, searchTerm, filtroEstado, filtroTipo, filtroCalibracion]);

  // ============================================
  // ESTADÍSTICAS
  // ============================================

  const stats = useMemo(() => {
    const activos = instrumentos.filter(i => i.estado === 'activo');
    const vencidos = instrumentos.filter(i => i.dias_para_calibracion !== null && i.dias_para_calibracion < 0);
    const proximos30 = instrumentos.filter(i => i.dias_para_calibracion !== null && i.dias_para_calibracion >= 0 && i.dias_para_calibracion <= 30);
    const enCalibracion = instrumentos.filter(i => i.estado === 'en_calibracion');
    const fueraServicio = instrumentos.filter(i => i.estado === 'fuera_servicio');
    
    const costoAnualCalibracion = instrumentos
      .filter(i => i.requiere_calibracion && i.costo_calibracion)
      .reduce((sum, i) => {
        const calibracionesPorAnio = 365 / (i.frecuencia_calibracion_dias || 365);
        return sum + (i.costo_calibracion || 0) * calibracionesPorAnio;
      }, 0);
    
    return {
      total: instrumentos.length,
      activos: activos.length,
      vencidos: vencidos.length,
      proximos30: proximos30.length,
      enCalibracion: enCalibracion.length,
      fueraServicio: fueraServicio.length,
      costoAnualCalibracion,
    };
  }, [instrumentos]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleNuevoInstrumento = () => {
    setFormData({
      codigo: '',
      nombre: '',
      tipo: 'dimensional',
      requiere_calibracion: true,
      frecuencia_calibracion_dias: 365,
    });
    setVistaActiva('nuevo');
  };

  const handleVerDetalle = async (inst: Instrumento) => {
    setInstrumentoSeleccionado(inst);
    setTabActivo('info');
    setVistaActiva('detalle');
    
    // Cargar historial de calibraciones
    const { data } = await supabase
      .from('qms_calibraciones')
      .select('*')
      .eq('instrumento_id', inst.id)
      .order('fecha_calibracion', { ascending: false });
    
    if (data) {
      setInstrumentoSeleccionado({ ...inst, historial_calibraciones: data });
    }
  };

  const handleEditarInstrumento = (inst: Instrumento) => {
    setFormData({
      codigo: inst.codigo,
      nombre: inst.nombre,
      descripcion: inst.descripcion,
      tipo: inst.tipo,
      marca: inst.marca,
      modelo: inst.modelo,
      numero_serie: inst.numero_serie,
      ubicacion: inst.ubicacion,
      responsable: inst.responsable,
      rango_min: inst.rango_min,
      rango_max: inst.rango_max,
      unidad_medida: inst.unidad_medida,
      resolucion: inst.resolucion,
      exactitud: inst.exactitud,
      requiere_calibracion: inst.requiere_calibracion,
      frecuencia_calibracion_dias: inst.frecuencia_calibracion_dias,
      proveedor_calibracion: inst.proveedor_calibracion,
      costo_calibracion: inst.costo_calibracion,
      notas: inst.notas,
    });
    setVistaActiva('editar');
  };

  const handleIniciarCalibracion = (inst: Instrumento) => {
    setInstrumentoSeleccionado(inst);
    setCalibracionForm({
      fecha_calibracion: new Date().toISOString().split('T')[0],
      proveedor: inst.proveedor_calibracion || '',
      resultado: 'aprobado',
    });
    setVistaActiva('calibrar');
  };

  const handleGuardarInstrumento = async () => {
    try {
      setSaving(true);
      
      if (vistaActiva === 'nuevo') {
        // Generar código si no tiene
        let codigo = formData.codigo;
        if (!codigo) {
          const { data: lastInst } = await supabase
            .from('qms_instrumentos')
            .select('codigo')
            .eq('tipo', formData.tipo)
            .order('creado_at', { ascending: false })
            .limit(1)
            .single();
          
          const lastSeq = lastInst?.codigo ? parseInt(lastInst.codigo.split('-')[1]) : 0;
          codigo = formatearCodigoInstrumento(formData.tipo, lastSeq + 1);
        }
        
        const { error } = await supabase
          .from('qms_instrumentos')
          .insert({
            ...formData,
            codigo,
            estado: 'activo',
            creado_por: 'Usuario Actual',
          });
        
        if (error) throw error;
      } else {
        // Actualizar
        const { error } = await supabase
          .from('qms_instrumentos')
          .update({
            ...formData,
            actualizado_at: new Date().toISOString(),
            actualizado_por: 'Usuario Actual',
          })
          .eq('id', instrumentoSeleccionado?.id);
        
        if (error) throw error;
      }
      
      await loadInstrumentos();
      setVistaActiva('lista');
      
    } catch (error) {
      console.error('Error guardando instrumento:', error);
      alert('Error al guardar el instrumento');
    } finally {
      setSaving(false);
    }
  };

  const handleGuardarCalibracion = async () => {
    if (!instrumentoSeleccionado) return;
    
    try {
      setSaving(true);
      
      // Calcular próxima calibración
      const fechaCalibracion = new Date(calibracionForm.fecha_calibracion);
      const proximaCalibracion = new Date(fechaCalibracion);
      proximaCalibracion.setDate(proximaCalibracion.getDate() + instrumentoSeleccionado.frecuencia_calibracion_dias);
      
      // Crear registro de calibración
      const { error: errorCal } = await supabase
        .from('qms_calibraciones')
        .insert({
          instrumento_id: instrumentoSeleccionado.id,
          ...calibracionForm,
          fecha_vencimiento: proximaCalibracion.toISOString(),
          calibrado_por: 'Usuario Actual',
        });
      
      if (errorCal) throw errorCal;
      
      // Actualizar instrumento
      const nuevoEstado = calibracionForm.resultado === 'rechazado' ? 'fuera_servicio' : 'activo';
      
      const { error: errorInst } = await supabase
        .from('qms_instrumentos')
        .update({
          ultima_calibracion: calibracionForm.fecha_calibracion,
          proxima_calibracion: proximaCalibracion.toISOString(),
          certificado_calibracion_url: calibracionForm.certificado_url,
          estado: nuevoEstado,
          actualizado_at: new Date().toISOString(),
        })
        .eq('id', instrumentoSeleccionado.id);
      
      if (errorInst) throw errorInst;
      
      await loadInstrumentos();
      setVistaActiva('lista');
      
    } catch (error) {
      console.error('Error guardando calibración:', error);
      alert('Error al guardar la calibración');
    } finally {
      setSaving(false);
    }
  };

  const handleCambiarEstado = async (instId: string, nuevoEstado: EstadoInstrumento) => {
    try {
      const { error } = await supabase
        .from('qms_instrumentos')
        .update({
          estado: nuevoEstado,
          actualizado_at: new Date().toISOString(),
        })
        .eq('id', instId);
      
      if (error) throw error;
      
      await loadInstrumentos();
      if (instrumentoSeleccionado?.id === instId) {
        setInstrumentoSeleccionado({ ...instrumentoSeleccionado, estado: nuevoEstado });
      }
    } catch (error) {
      console.error('Error cambiando estado:', error);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ==================== VISTA LISTA ==================== */}
      {vistaActiva === 'lista' && (
        <>
          {/* Alertas */}
          {stats.vencidos > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-4">
              <div className="p-3 bg-red-500/20 rounded-xl">
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-red-400">
                  {stats.vencidos} instrumento(s) con calibración vencida
                </h4>
                <p className="text-sm text-red-300/70">
                  Estos instrumentos no deben usarse hasta ser recalibrados
                </p>
              </div>
              <button
                onClick={() => setFiltroCalibracion('vencidos')}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium text-sm"
              >
                Ver Vencidos
              </button>
            </div>
          )}

          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Thermometer className="h-6 w-6 text-amber-400" />
                Control de Instrumentos
              </h3>
              <p className="text-slate-400 text-sm mt-1">
                Gestión de equipos de medición y calibración
              </p>
            </div>
            
            {/* Stats */}
            <div className="flex gap-3">
              <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                <div className="text-xs text-emerald-400">Activos</div>
                <div className="text-xl font-bold text-emerald-400">{stats.activos}</div>
              </div>
              <div className={`px-4 py-2 rounded-xl ${stats.vencidos > 0 ? 'bg-red-500/20 border border-red-500/30' : 'bg-slate-800/50 border border-slate-700/50'}`}>
                <div className="text-xs text-red-400">Vencidos</div>
                <div className={`text-xl font-bold ${stats.vencidos > 0 ? 'text-red-400' : 'text-slate-500'}`}>{stats.vencidos}</div>
              </div>
              <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <div className="text-xs text-amber-400">Próx. 30 días</div>
                <div className="text-xl font-bold text-amber-400">{stats.proximos30}</div>
              </div>
              <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <div className="text-xs text-blue-400">En Calibración</div>
                <div className="text-xl font-bold text-blue-400">{stats.enCalibracion}</div>
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
                  placeholder="Buscar por código, nombre, marca..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
              
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
              >
                <option value="todos">Todos los estados</option>
                <option value="activo">Activos</option>
                <option value="en_calibracion">En Calibración</option>
                <option value="fuera_servicio">Fuera de Servicio</option>
                <option value="dado_baja">Dados de Baja</option>
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
                value={filtroCalibracion}
                onChange={(e) => setFiltroCalibracion(e.target.value)}
                className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
              >
                <option value="todos">Todas las calibraciones</option>
                <option value="vencidos">Vencidos</option>
                <option value="proximos_30">Próximos 30 días</option>
                <option value="proximos_60">Próximos 60 días</option>
              </select>
              
              <button
                onClick={loadInstrumentos}
                className="p-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-400 hover:text-slate-200 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            
            <button
              onClick={handleNuevoInstrumento}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nuevo Instrumento
            </button>
          </div>

          {/* Lista de instrumentos */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Código</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Instrumento</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Ubicación</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Próx. Calibración</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {instrumentosFiltrados.map(inst => {
                    const estadoConfig = ESTADO_CONFIG[inst.estado];
                    const tipoConfig = TIPO_CONFIG[inst.tipo];
                    const TipoIcon = tipoConfig.icon;
                    const diasColor = getColorPorDias(inst.dias_para_calibracion);
                    
                    return (
                      <tr key={inst.id} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm text-amber-400">{inst.codigo}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-slate-200 font-medium">{inst.nombre}</div>
                          {inst.marca && (
                            <div className="text-xs text-slate-500">{inst.marca} {inst.modelo}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`flex items-center gap-1.5 text-sm ${tipoConfig.color}`}>
                            <TipoIcon className="h-4 w-4" />
                            {tipoConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-400">
                          {inst.ubicacion || '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs ${estadoConfig.bg} ${estadoConfig.color}`}>
                            {estadoConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {inst.requiere_calibracion ? (
                            <div>
                              <div className="text-sm text-slate-300">{formatDate(inst.proxima_calibracion)}</div>
                              <div className={`text-xs ${diasColor.color}`}>
                                {inst.dias_para_calibracion !== null ? (
                                  inst.dias_para_calibracion < 0
                                    ? `Vencido hace ${Math.abs(inst.dias_para_calibracion)} días`
                                    : inst.dias_para_calibracion === 0
                                      ? 'Vence hoy'
                                      : `En ${inst.dias_para_calibracion} días`
                                ) : '-'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">No requiere</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleVerDetalle(inst)}
                              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200"
                              title="Ver detalle"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {inst.estado === 'activo' && inst.requiere_calibracion && (
                              <button
                                onClick={() => handleIniciarCalibracion(inst)}
                                className="p-1.5 hover:bg-amber-500/20 rounded-lg text-amber-400 hover:text-amber-300"
                                title="Registrar calibración"
                              >
                                <Award className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleEditarInstrumento(inst)}
                              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200"
                              title="Editar"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {instrumentosFiltrados.length === 0 && (
              <div className="p-12 text-center text-slate-500">
                <Thermometer className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No se encontraron instrumentos</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ==================== VISTA NUEVO/EDITAR ==================== */}
      {(vistaActiva === 'nuevo' || vistaActiva === 'editar') && (
        <InstrumentoForm
          formData={formData}
          setFormData={setFormData}
          onGuardar={handleGuardarInstrumento}
          onCancelar={() => setVistaActiva('lista')}
          saving={saving}
          isEditing={vistaActiva === 'editar'}
        />
      )}

      {/* ==================== VISTA DETALLE ==================== */}
      {vistaActiva === 'detalle' && instrumentoSeleccionado && (
        <InstrumentoDetalle
          inst={instrumentoSeleccionado}
          tabActivo={tabActivo}
          setTabActivo={setTabActivo}
          onVolver={() => setVistaActiva('lista')}
          onEditar={() => handleEditarInstrumento(instrumentoSeleccionado)}
          onCalibrar={() => handleIniciarCalibracion(instrumentoSeleccionado)}
          onCambiarEstado={handleCambiarEstado}
        />
      )}

      {/* ==================== VISTA CALIBRACIÓN ==================== */}
      {vistaActiva === 'calibrar' && instrumentoSeleccionado && (
        <CalibracionForm
          inst={instrumentoSeleccionado}
          formData={calibracionForm}
          setFormData={setCalibracionForm}
          onGuardar={handleGuardarCalibracion}
          onCancelar={() => setVistaActiva('detalle')}
          saving={saving}
        />
      )}
    </div>
  );
}

// ============================================
// SUB-COMPONENTE: FORMULARIO INSTRUMENTO
// ============================================

interface InstrumentoFormProps {
  formData: InstrumentoFormData;
  setFormData: React.Dispatch<React.SetStateAction<InstrumentoFormData>>;
  onGuardar: () => void;
  onCancelar: () => void;
  saving: boolean;
  isEditing: boolean;
}

function InstrumentoForm({ formData, setFormData, onGuardar, onCancelar, saving, isEditing }: InstrumentoFormProps) {
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
            {isEditing ? 'Editar Instrumento' : 'Nuevo Instrumento'}
          </h3>
          <p className="text-sm text-slate-400">Complete la información del equipo de medición</p>
        </div>
      </div>

      {/* Información básica */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6 space-y-4">
        <h4 className="font-semibold text-slate-200">Información Básica</h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Código</label>
            <input
              type="text"
              value={formData.codigo}
              onChange={(e) => setFormData(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="Auto-generado si vacío"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Tipo *</label>
            <select
              value={formData.tipo}
              onChange={(e) => setFormData(prev => ({ ...prev, tipo: e.target.value as TipoInstrumento }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            >
              {Object.entries(TIPO_CONFIG).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Nombre *</label>
          <input
            type="text"
            value={formData.nombre}
            onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            placeholder="Ej: Calibrador Digital Mitutoyo"
          />
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Marca</label>
            <input
              type="text"
              value={formData.marca || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, marca: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="Ej: Mitutoyo"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Modelo</label>
            <input
              type="text"
              value={formData.modelo || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, modelo: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="Ej: CD-6"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Nº Serie</label>
            <input
              type="text"
              value={formData.numero_serie || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, numero_serie: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="Número de serie"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Ubicación</label>
            <input
              type="text"
              value={formData.ubicacion || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, ubicacion: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="Ej: Laboratorio QC"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Responsable</label>
            <input
              type="text"
              value={formData.responsable || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, responsable: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="Persona responsable"
            />
          </div>
        </div>
      </div>

      {/* Especificaciones técnicas */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6 space-y-4">
        <h4 className="font-semibold text-slate-200">Especificaciones Técnicas</h4>
        
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Rango Mín</label>
            <input
              type="number"
              step="any"
              value={formData.rango_min || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, rango_min: parseFloat(e.target.value) || undefined }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="0"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Rango Máx</label>
            <input
              type="number"
              step="any"
              value={formData.rango_max || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, rango_max: parseFloat(e.target.value) || undefined }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="100"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Unidad</label>
            <input
              type="text"
              value={formData.unidad_medida || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, unidad_medida: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="mm, °C, kg..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Resolución</label>
            <input
              type="number"
              step="any"
              value={formData.resolucion || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, resolucion: parseFloat(e.target.value) || undefined }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="0.01"
            />
          </div>
        </div>
      </div>

      {/* Calibración */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-slate-200">Calibración</h4>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.requiere_calibracion}
              onChange={(e) => setFormData(prev => ({ ...prev, requiere_calibracion: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500"
            />
            <span className="text-sm text-slate-300">Requiere calibración periódica</span>
          </label>
        </div>
        
        {formData.requiere_calibracion && (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Frecuencia (días)</label>
              <input
                type="number"
                value={formData.frecuencia_calibracion_dias}
                onChange={(e) => setFormData(prev => ({ ...prev, frecuencia_calibracion_dias: parseInt(e.target.value) || 365 }))}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Proveedor</label>
              <input
                type="text"
                value={formData.proveedor_calibracion || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, proveedor_calibracion: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                placeholder="Laboratorio de calibración"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Costo ($)</label>
              <input
                type="number"
                step="0.01"
                value={formData.costo_calibracion || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, costo_calibracion: parseFloat(e.target.value) || undefined }))}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                placeholder="0.00"
              />
            </div>
          </div>
        )}
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
          disabled={saving || !formData.nombre}
          className="flex items-center gap-2 px-6 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-medium transition-colors"
        >
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isEditing ? 'Guardar Cambios' : 'Crear Instrumento'}
        </button>
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTE: DETALLE
// ============================================

interface InstrumentoDetalleProps {
  inst: Instrumento;
  tabActivo: 'info' | 'calibraciones' | 'documentos';
  setTabActivo: (tab: 'info' | 'calibraciones' | 'documentos') => void;
  onVolver: () => void;
  onEditar: () => void;
  onCalibrar: () => void;
  onCambiarEstado: (id: string, estado: EstadoInstrumento) => void;
}

function InstrumentoDetalle({ inst, tabActivo, setTabActivo, onVolver, onEditar, onCalibrar, onCambiarEstado }: InstrumentoDetalleProps) {
  const estadoConfig = ESTADO_CONFIG[inst.estado];
  const tipoConfig = TIPO_CONFIG[inst.tipo];
  const TipoIcon = tipoConfig.icon;
  const diasColor = getColorPorDias(inst.dias_para_calibracion);

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
              <span className="font-mono text-lg text-amber-400">{inst.codigo}</span>
              <span className={`px-2 py-1 rounded-full text-xs ${estadoConfig.bg} ${estadoConfig.color}`}>
                {estadoConfig.label}
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-100">{inst.nombre}</h3>
          </div>
        </div>
        
        <div className="flex gap-2">
          {inst.estado === 'activo' && inst.requiere_calibracion && (
            <button
              onClick={onCalibrar}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium"
            >
              <Award className="h-4 w-4" />
              Registrar Calibración
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

      {/* Estado de calibración */}
      {inst.requiere_calibracion && (
        <div className={`rounded-xl p-4 ${diasColor.bg} border border-slate-700/50`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className={`h-5 w-5 ${diasColor.color}`} />
              <div>
                <div className="text-sm text-slate-300">Próxima Calibración</div>
                <div className={`text-lg font-bold ${diasColor.color}`}>
                  {formatDate(inst.proxima_calibracion)}
                  {inst.dias_para_calibracion !== null && (
                    <span className="text-sm font-normal ml-2">
                      ({inst.dias_para_calibracion < 0
                        ? `Vencido hace ${Math.abs(inst.dias_para_calibracion)} días`
                        : inst.dias_para_calibracion === 0
                          ? 'Vence hoy'
                          : `En ${inst.dias_para_calibracion} días`})
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {inst.certificado_calibracion_url && (
              <a
                href={inst.certificado_calibracion_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300"
              >
                <FileText className="h-4 w-4" />
                Ver Certificado
              </a>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <div className="flex gap-1">
          {[
            { id: 'info' as const, label: 'Información', icon: Settings },
            { id: 'calibraciones' as const, label: 'Historial Calibraciones', icon: History },
            { id: 'documentos' as const, label: 'Documentos', icon: FileText },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setTabActivo(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  tabActivo === tab.id
                    ? 'border-amber-500 text-amber-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenido del tab */}
      {tabActivo === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Info principal */}
          <div className="space-y-4">
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h4 className="font-semibold text-slate-200 mb-3">Identificación</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500">Tipo</label>
                  <div className={`flex items-center gap-1.5 ${tipoConfig.color}`}>
                    <TipoIcon className="h-4 w-4" />
                    {tipoConfig.label}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Marca</label>
                  <div className="text-slate-200">{inst.marca || '-'}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Modelo</label>
                  <div className="text-slate-200">{inst.modelo || '-'}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Nº Serie</label>
                  <div className="text-slate-200 font-mono">{inst.numero_serie || '-'}</div>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h4 className="font-semibold text-slate-200 mb-3">Especificaciones</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500">Rango</label>
                  <div className="text-slate-200">
                    {inst.rango_min !== undefined && inst.rango_max !== undefined
                      ? `${inst.rango_min} - ${inst.rango_max} ${inst.unidad_medida || ''}`
                      : '-'}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Resolución</label>
                  <div className="text-slate-200">
                    {inst.resolucion ? `${inst.resolucion} ${inst.unidad_medida || ''}` : '-'}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Exactitud</label>
                  <div className="text-slate-200">
                    {inst.exactitud ? `±${inst.exactitud} ${inst.unidad_medida || ''}` : '-'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 space-y-3">
              <h4 className="font-semibold text-slate-200 text-sm">Ubicación y Responsable</h4>
              
              {inst.ubicacion && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-500" />
                  <span className="text-slate-300">{inst.ubicacion}</span>
                </div>
              )}
              
              {inst.responsable && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-slate-500" />
                  <span className="text-slate-300">{inst.responsable}</span>
                </div>
              )}
            </div>
            
            {inst.requiere_calibracion && (
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 space-y-3">
                <h4 className="font-semibold text-slate-200 text-sm">Calibración</h4>
                
                <div>
                  <label className="text-xs text-slate-500">Frecuencia</label>
                  <div className="text-slate-200">{inst.frecuencia_calibracion_dias} días</div>
                </div>
                
                {inst.proveedor_calibracion && (
                  <div>
                    <label className="text-xs text-slate-500">Proveedor</label>
                    <div className="text-slate-200">{inst.proveedor_calibracion}</div>
                  </div>
                )}
                
                {inst.costo_calibracion && (
                  <div>
                    <label className="text-xs text-slate-500">Costo</label>
                    <div className="text-slate-200">${inst.costo_calibracion.toLocaleString()}</div>
                  </div>
                )}
                
                {inst.ultima_calibracion && (
                  <div>
                    <label className="text-xs text-slate-500">Última Calibración</label>
                    <div className="text-slate-200">{formatDate(inst.ultima_calibracion)}</div>
                  </div>
                )}
              </div>
            )}
            
            {/* Cambiar estado */}
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 space-y-2">
              <h4 className="font-semibold text-slate-200 text-sm mb-3">Cambiar Estado</h4>
              
              {inst.estado !== 'en_calibracion' && (
                <button
                  onClick={() => onCambiarEstado(inst.id, 'en_calibracion')}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-sm"
                >
                  Enviar a Calibración
                </button>
              )}
              
              {inst.estado === 'en_calibracion' && (
                <button
                  onClick={() => onCambiarEstado(inst.id, 'activo')}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-sm"
                >
                  Marcar Activo
                </button>
              )}
              
              {inst.estado !== 'fuera_servicio' && (
                <button
                  onClick={() => onCambiarEstado(inst.id, 'fuera_servicio')}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm"
                >
                  Fuera de Servicio
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {tabActivo === 'calibraciones' && (
        <div className="space-y-3">
          {inst.historial_calibraciones && inst.historial_calibraciones.length > 0 ? (
            inst.historial_calibraciones.map(cal => {
              const resultadoConfig = RESULTADO_CALIBRACION_CONFIG[cal.resultado];
              return (
                <div key={cal.id} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-slate-200 font-medium">{formatDate(cal.fecha_calibracion)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${resultadoConfig.bg} ${resultadoConfig.color}`}>
                          {resultadoConfig.label}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <label className="text-xs text-slate-500">Proveedor</label>
                          <div className="text-slate-300">{cal.proveedor}</div>
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Nº Certificado</label>
                          <div className="text-slate-300">{cal.certificado_numero || '-'}</div>
                        </div>
                        {cal.costo && (
                          <div>
                            <label className="text-xs text-slate-500">Costo</label>
                            <div className="text-slate-300">${cal.costo.toLocaleString()}</div>
                          </div>
                        )}
                      </div>
                      
                      {cal.notas && (
                        <p className="text-sm text-slate-400 mt-2">{cal.notas}</p>
                      )}
                    </div>
                    
                    {cal.certificado_url && (
                      <a
                        href={cal.certificado_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-12 text-center">
              <History className="h-12 w-12 mx-auto mb-3 text-slate-600" />
              <p className="text-slate-400">No hay calibraciones registradas</p>
            </div>
          )}
        </div>
      )}

      {tabActivo === 'documentos' && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-12 text-center">
          <FileText className="h-12 w-12 mx-auto mb-3 text-slate-600" />
          <p className="text-slate-400">Gestión de documentos próximamente</p>
          <p className="text-sm text-slate-500 mt-1">Manual, ficha técnica, certificados...</p>
        </div>
      )}
    </div>
  );
}

// ============================================
// SUB-COMPONENTE: FORMULARIO CALIBRACIÓN
// ============================================

interface CalibracionFormProps {
  inst: Instrumento;
  formData: CalibracionFormData;
  setFormData: React.Dispatch<React.SetStateAction<CalibracionFormData>>;
  onGuardar: () => void;
  onCancelar: () => void;
  saving: boolean;
}

function CalibracionForm({ inst, formData, setFormData, onGuardar, onCancelar, saving }: CalibracionFormProps) {
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
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Award className="h-6 w-6 text-amber-400" />
            Registrar Calibración
          </h3>
          <p className="text-sm text-slate-400">
            {inst.codigo} - {inst.nombre}
          </p>
        </div>
      </div>

      {/* Formulario */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Fecha de Calibración *</label>
            <input
              type="date"
              value={formData.fecha_calibracion}
              onChange={(e) => setFormData(prev => ({ ...prev, fecha_calibracion: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Resultado *</label>
            <select
              value={formData.resultado}
              onChange={(e) => setFormData(prev => ({ ...prev, resultado: e.target.value as ResultadoCalibracion }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            >
              {Object.entries(RESULTADO_CALIBRACION_CONFIG).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Proveedor/Laboratorio *</label>
          <input
            type="text"
            value={formData.proveedor}
            onChange={(e) => setFormData(prev => ({ ...prev, proveedor: e.target.value }))}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            placeholder="Nombre del laboratorio de calibración"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Nº Certificado</label>
            <input
              type="text"
              value={formData.certificado_numero || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, certificado_numero: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="Número del certificado"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Costo ($)</label>
            <input
              type="number"
              step="0.01"
              value={formData.costo || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, costo: parseFloat(e.target.value) || undefined }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="0.00"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">URL Certificado</label>
          <input
            type="url"
            value={formData.certificado_url || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, certificado_url: e.target.value }))}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            placeholder="https://..."
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Patrón Utilizado</label>
          <input
            type="text"
            value={formData.patron_usado || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, patron_usado: e.target.value }))}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            placeholder="Patrón de referencia utilizado"
          />
        </div>
        
        {formData.resultado === 'ajustado' && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Ajustes Realizados</label>
            <textarea
              value={formData.ajustes_realizados || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, ajustes_realizados: e.target.value }))}
              rows={2}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 resize-none"
              placeholder="Describir los ajustes realizados..."
            />
          </div>
        )}
        
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Notas</label>
          <textarea
            value={formData.notas || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, notas: e.target.value }))}
            rows={2}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 resize-none"
            placeholder="Observaciones adicionales..."
          />
        </div>
      </div>

      {/* Info */}
      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
        <p className="text-sm text-amber-300">
          <strong>Próxima calibración:</strong> Se calculará automáticamente sumando {inst.frecuencia_calibracion_dias} días a la fecha de calibración.
        </p>
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
          disabled={saving || !formData.proveedor || !formData.fecha_calibracion}
          className="flex items-center gap-2 px-6 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-medium transition-colors"
        >
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
          Guardar Calibración
        </button>
      </div>
    </div>
  );
}