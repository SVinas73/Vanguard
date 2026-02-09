'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Activity, Search, Plus, Filter, Download, RefreshCw,
  CheckCircle, XCircle, Clock, Eye, Edit, Trash2,
  Calendar, Building2, ChevronRight, ChevronDown,
  AlertTriangle, AlertCircle, X, Save, Play, Pause,
  BarChart3, TrendingUp, TrendingDown, Target, Zap,
  Layers, Package, Thermometer, Gauge, FlaskConical,
  ClipboardCheck, Timer, User, FileText, History,
  ArrowUp, ArrowDown, Minus, MoreHorizontal
} from 'lucide-react';

// ============================================
// TIPOS LOCALES
// ============================================

type TipoPuntoControl = 'dimensional' | 'visual' | 'peso' | 'temperatura' | 'presion' | 'ph' | 'humedad' | 'densidad' | 'otro';
type EstadoPuntoControl = 'activo' | 'inactivo' | 'en_revision';
type ResultadoMedicion = 'conforme' | 'no_conforme' | 'alerta';
type TipoGraficoSPC = 'xbar_r' | 'xbar_s' | 'p' | 'np' | 'c' | 'u' | 'imr';

interface PuntoControl {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  
  // Ubicación en proceso
  proceso: string;
  etapa: string;
  linea_produccion?: string;
  
  // Tipo de control
  tipo: TipoPuntoControl;
  caracteristica: string;
  unidad_medida?: string;
  
  // Especificaciones
  valor_nominal?: number;
  tolerancia_superior?: number;
  tolerancia_inferior?: number;
  limite_especificacion_superior?: number; // USL
  limite_especificacion_inferior?: number; // LSL
  
  // Control estadístico
  usar_spc: boolean;
  tipo_grafico?: TipoGraficoSPC;
  limite_control_superior?: number; // UCL
  limite_control_inferior?: number; // LCL
  linea_central?: number; // CL
  
  // Frecuencia de muestreo
  frecuencia_minutos?: number;
  tamano_muestra: number;
  
  // Instrumento asociado
  instrumento_id?: string;
  instrumento_codigo?: string;
  
  // Estado
  estado: EstadoPuntoControl;
  
  // Últimas mediciones
  ultima_medicion?: Medicion;
  tendencia?: 'estable' | 'ascendente' | 'descendente' | 'fuera_control';
  
  // Estadísticas calculadas
  promedio_actual?: number;
  desviacion_estandar?: number;
  cp?: number;
  cpk?: number;
  
  // Auditoría
  creado_por?: string;
  creado_at: string;
  actualizado_at?: string;
}

interface Medicion {
  id: string;
  punto_control_id: string;
  
  // Valores
  valores: number[]; // Array para múltiples lecturas del subgrupo
  promedio: number;
  rango?: number;
  desviacion?: number;
  
  // Resultado
  resultado: ResultadoMedicion;
  fuera_especificacion: boolean;
  fuera_control: boolean;
  
  // Contexto
  orden_produccion?: string;
  lote?: string;
  producto_codigo?: string;
  producto_nombre?: string;
  
  // Operador
  operador: string;
  turno?: string;
  
  // Acciones
  accion_tomada?: string;
  ncr_generada?: string;
  
  notas?: string;
  created_at: string;
}

interface RegistroProduccion {
  id: string;
  orden_produccion: string;
  producto_codigo: string;
  producto_nombre: string;
  lote: string;
  linea_produccion: string;
  fecha_inicio: string;
  fecha_fin?: string;
  estado: 'en_proceso' | 'completada' | 'detenida';
  cantidad_planificada: number;
  cantidad_producida: number;
  
  // Resumen de calidad
  total_mediciones: number;
  mediciones_conformes: number;
  mediciones_no_conformes: number;
  porcentaje_calidad: number;
}

interface PuntoControlFormData {
  codigo: string;
  nombre: string;
  descripcion?: string;
  proceso: string;
  etapa: string;
  linea_produccion?: string;
  tipo: TipoPuntoControl;
  caracteristica: string;
  unidad_medida?: string;
  valor_nominal?: number;
  tolerancia_superior?: number;
  tolerancia_inferior?: number;
  limite_especificacion_superior?: number;
  limite_especificacion_inferior?: number;
  usar_spc: boolean;
  tipo_grafico?: TipoGraficoSPC;
  frecuencia_minutos?: number;
  tamano_muestra: number;
}

interface MedicionFormData {
  valores: number[];
  orden_produccion?: string;
  lote?: string;
  producto_codigo?: string;
  operador: string;
  turno?: string;
  notas?: string;
}

type VistaActiva = 'monitoreo' | 'puntos_control' | 'nuevo_punto' | 'detalle_punto' | 'historial' | 'spc';

// ============================================
// CONFIGURACIONES
// ============================================

const TIPO_CONTROL_CONFIG: Record<TipoPuntoControl, { label: string; icon: React.ElementType; color: string; unidadDefault: string }> = {
  dimensional: { label: 'Dimensional', icon: Gauge, color: 'text-blue-400', unidadDefault: 'mm' },
  visual: { label: 'Visual', icon: Eye, color: 'text-purple-400', unidadDefault: '' },
  peso: { label: 'Peso', icon: Package, color: 'text-emerald-400', unidadDefault: 'kg' },
  temperatura: { label: 'Temperatura', icon: Thermometer, color: 'text-orange-400', unidadDefault: '°C' },
  presion: { label: 'Presión', icon: Gauge, color: 'text-cyan-400', unidadDefault: 'bar' },
  ph: { label: 'pH', icon: FlaskConical, color: 'text-lime-400', unidadDefault: 'pH' },
  humedad: { label: 'Humedad', icon: Activity, color: 'text-sky-400', unidadDefault: '%' },
  densidad: { label: 'Densidad', icon: Layers, color: 'text-amber-400', unidadDefault: 'g/cm³' },
  otro: { label: 'Otro', icon: Target, color: 'text-slate-400', unidadDefault: '' },
};

const ESTADO_PUNTO_CONFIG: Record<EstadoPuntoControl, { label: string; color: string; bg: string }> = {
  activo: { label: 'Activo', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  inactivo: { label: 'Inactivo', color: 'text-slate-400', bg: 'bg-slate-500/20' },
  en_revision: { label: 'En Revisión', color: 'text-amber-400', bg: 'bg-amber-500/20' },
};

const RESULTADO_CONFIG: Record<ResultadoMedicion, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  conforme: { label: 'Conforme', color: 'text-emerald-400', bg: 'bg-emerald-500/20', icon: CheckCircle },
  no_conforme: { label: 'No Conforme', color: 'text-red-400', bg: 'bg-red-500/20', icon: XCircle },
  alerta: { label: 'Alerta', color: 'text-amber-400', bg: 'bg-amber-500/20', icon: AlertTriangle },
};

const TIPO_GRAFICO_CONFIG: Record<TipoGraficoSPC, { label: string; descripcion: string }> = {
  xbar_r: { label: 'X̄-R', descripcion: 'Media y Rango (n<10)' },
  xbar_s: { label: 'X̄-S', descripcion: 'Media y Desviación (n≥10)' },
  imr: { label: 'I-MR', descripcion: 'Individual y Rango Móvil' },
  p: { label: 'p', descripcion: 'Proporción defectuosos' },
  np: { label: 'np', descripcion: 'Número defectuosos' },
  c: { label: 'c', descripcion: 'Número defectos' },
  u: { label: 'u', descripcion: 'Defectos por unidad' },
};

const TENDENCIA_CONFIG = {
  estable: { label: 'Estable', color: 'text-emerald-400', icon: Minus },
  ascendente: { label: 'Ascendente', color: 'text-amber-400', icon: ArrowUp },
  descendente: { label: 'Descendente', color: 'text-amber-400', icon: ArrowDown },
  fuera_control: { label: 'Fuera de Control', color: 'text-red-400', icon: AlertTriangle },
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

const formatDateTime = (date: string | null | undefined): string => {
  if (!date) return '-';
  return new Date(date).toLocaleString('es-UY', { 
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
};

const formatTime = (date: string | null | undefined): string => {
  if (!date) return '-';
  return new Date(date).toLocaleTimeString('es-UY', { 
    hour: '2-digit', minute: '2-digit'
  });
};

const calcularPromedio = (valores: number[]): number => {
  if (valores.length === 0) return 0;
  return valores.reduce((a, b) => a + b, 0) / valores.length;
};

const calcularRango = (valores: number[]): number => {
  if (valores.length === 0) return 0;
  return Math.max(...valores) - Math.min(...valores);
};

const calcularDesviacion = (valores: number[]): number => {
  if (valores.length <= 1) return 0;
  const promedio = calcularPromedio(valores);
  const sumaCuadrados = valores.reduce((sum, val) => sum + Math.pow(val - promedio, 2), 0);
  return Math.sqrt(sumaCuadrados / (valores.length - 1));
};

const evaluarResultado = (
  promedio: number, 
  lsl: number | undefined, 
  usl: number | undefined,
  lcl: number | undefined,
  ucl: number | undefined
): { resultado: ResultadoMedicion; fueraEspec: boolean; fueraControl: boolean } => {
  let fueraEspec = false;
  let fueraControl = false;
  
  // Verificar especificaciones
  if (lsl !== undefined && promedio < lsl) fueraEspec = true;
  if (usl !== undefined && promedio > usl) fueraEspec = true;
  
  // Verificar límites de control
  if (lcl !== undefined && promedio < lcl) fueraControl = true;
  if (ucl !== undefined && promedio > ucl) fueraControl = true;
  
  let resultado: ResultadoMedicion = 'conforme';
  if (fueraEspec) resultado = 'no_conforme';
  else if (fueraControl) resultado = 'alerta';
  
  return { resultado, fueraEspec, fueraControl };
};

const formatearCodigoPunto = (proceso: string, secuencia: number): string => {
  const prefijo = proceso.substring(0, 3).toUpperCase();
  return `PC-${prefijo}-${secuencia.toString().padStart(3, '0')}`;
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function ControlProceso() {
  // Estado principal
  const [loading, setLoading] = useState(true);
  const [vistaActiva, setVistaActiva] = useState<VistaActiva>('monitoreo');
  const [puntoSeleccionado, setPuntoSeleccionado] = useState<PuntoControl | null>(null);
  
  // Datos
  const [puntosControl, setPuntosControl] = useState<PuntoControl[]>([]);
  const [medicionesRecientes, setMedicionesRecientes] = useState<Medicion[]>([]);
  const [registrosProduccion, setRegistrosProduccion] = useState<RegistroProduccion[]>([]);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroProceso, setFiltroProceso] = useState<string>('todos');
  const [filtroLinea, setFiltroLinea] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<string>('activo');
  
  // Form punto de control
  const [formData, setFormData] = useState<PuntoControlFormData>({
    codigo: '',
    nombre: '',
    proceso: '',
    etapa: '',
    tipo: 'dimensional',
    caracteristica: '',
    usar_spc: true,
    tamano_muestra: 5,
  });
  
  // Form medición
  const [medicionForm, setMedicionForm] = useState<MedicionFormData>({
    valores: [],
    operador: '',
  });
  const [showMedicionModal, setShowMedicionModal] = useState(false);
  const [valoresInput, setValoresInput] = useState<string>('');
  
  // UI
  const [saving, setSaving] = useState(false);
  const [tabActivo, setTabActivo] = useState<'info' | 'mediciones' | 'spc' | 'historial'>('info');

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
        loadPuntosControl(),
        loadMedicionesRecientes(),
        loadRegistrosProduccion(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPuntosControl = async () => {
    const { data, error } = await supabase
      .from('qms_puntos_control')
      .select('*')
      .order('proceso', { ascending: true })
      .order('etapa', { ascending: true });

    if (!error && data) {
      setPuntosControl(data);
    }
  };

  const loadMedicionesRecientes = async () => {
    const { data, error } = await supabase
      .from('qms_mediciones_proceso')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      setMedicionesRecientes(data);
    }
  };

  const loadRegistrosProduccion = async () => {
    const { data, error } = await supabase
      .from('qms_registros_produccion')
      .select('*')
      .eq('estado', 'en_proceso')
      .order('fecha_inicio', { ascending: false })
      .limit(20);

    if (!error && data) {
      setRegistrosProduccion(data);
    }
  };

  const loadMedicionesPunto = async (puntoId: string) => {
    const { data } = await supabase
      .from('qms_mediciones_proceso')
      .select('*')
      .eq('punto_control_id', puntoId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    return data || [];
  };

  // ============================================
  // FILTRADO
  // ============================================

  const puntosFiltrados = useMemo(() => {
    return puntosControl.filter(punto => {
      // Búsqueda
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchCodigo = punto.codigo?.toLowerCase().includes(search);
        const matchNombre = punto.nombre?.toLowerCase().includes(search);
        const matchCaracteristica = punto.caracteristica?.toLowerCase().includes(search);
        if (!matchCodigo && !matchNombre && !matchCaracteristica) return false;
      }
      
      // Filtro proceso
      if (filtroProceso !== 'todos' && punto.proceso !== filtroProceso) return false;
      
      // Filtro línea
      if (filtroLinea !== 'todos' && punto.linea_produccion !== filtroLinea) return false;
      
      // Filtro estado
      if (filtroEstado !== 'todos' && punto.estado !== filtroEstado) return false;
      
      return true;
    });
  }, [puntosControl, searchTerm, filtroProceso, filtroLinea, filtroEstado]);

  // Obtener valores únicos para filtros
  const procesosUnicos = useMemo(() => 
    [...new Set(puntosControl.map(p => p.proceso).filter(Boolean))],
    [puntosControl]
  );
  
  const lineasUnicas = useMemo(() => 
    [...new Set(puntosControl.map(p => p.linea_produccion).filter(Boolean))],
    [puntosControl]
  );

  // ============================================
  // ESTADÍSTICAS
  // ============================================

  const stats = useMemo(() => {
    const activos = puntosControl.filter(p => p.estado === 'activo');
    const hoy = new Date().toISOString().split('T')[0];
    const medicionesHoy = medicionesRecientes.filter(m => m.created_at.startsWith(hoy));
    
    const conformes = medicionesHoy.filter(m => m.resultado === 'conforme').length;
    const noConformes = medicionesHoy.filter(m => m.resultado === 'no_conforme').length;
    const alertas = medicionesHoy.filter(m => m.resultado === 'alerta').length;
    
    const porcentajeCalidad = medicionesHoy.length > 0 
      ? Math.round((conformes / medicionesHoy.length) * 100) 
      : 100;
    
    const puntosConProblemas = activos.filter(p => 
      p.tendencia === 'fuera_control' || 
      medicionesRecientes.some(m => m.punto_control_id === p.id && m.resultado === 'no_conforme')
    ).length;
    
    return {
      puntosActivos: activos.length,
      medicionesHoy: medicionesHoy.length,
      conformes,
      noConformes,
      alertas,
      porcentajeCalidad,
      puntosConProblemas,
      ordenesEnProceso: registrosProduccion.length,
    };
  }, [puntosControl, medicionesRecientes, registrosProduccion]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleNuevoPunto = () => {
    setFormData({
      codigo: '',
      nombre: '',
      proceso: '',
      etapa: '',
      tipo: 'dimensional',
      caracteristica: '',
      usar_spc: true,
      tamano_muestra: 5,
    });
    setVistaActiva('nuevo_punto');
  };

  const handleVerDetalle = async (punto: PuntoControl) => {
    setPuntoSeleccionado(punto);
    setTabActivo('info');
    setVistaActiva('detalle_punto');
  };

  const handleRegistrarMedicion = (punto: PuntoControl) => {
    setPuntoSeleccionado(punto);
    setMedicionForm({
      valores: [],
      operador: '',
    });
    setValoresInput('');
    setShowMedicionModal(true);
  };

  const handleGuardarPunto = async () => {
    try {
      setSaving(true);
      
      // Generar código si no tiene
      let codigo = formData.codigo;
      if (!codigo) {
        const { data: lastPunto } = await supabase
          .from('qms_puntos_control')
          .select('codigo')
          .ilike('codigo', `PC-${formData.proceso.substring(0, 3).toUpperCase()}%`)
          .order('creado_at', { ascending: false })
          .limit(1)
          .single();
        
        const lastSeq = lastPunto?.codigo ? parseInt(lastPunto.codigo.split('-')[2]) : 0;
        codigo = formatearCodigoPunto(formData.proceso, lastSeq + 1);
      }
      
      // Calcular límites si usa SPC
      let limitesControl = {};
      if (formData.usar_spc && formData.valor_nominal !== undefined) {
        const tolerancia = (formData.tolerancia_superior || 0) + (formData.tolerancia_inferior || 0);
        // Límites de control iniciales (se recalcularán con datos reales)
        limitesControl = {
          linea_central: formData.valor_nominal,
          limite_control_superior: formData.valor_nominal + tolerancia / 2,
          limite_control_inferior: formData.valor_nominal - tolerancia / 2,
        };
      }
      
      const { error } = await supabase
        .from('qms_puntos_control')
        .insert({
          ...formData,
          codigo,
          ...limitesControl,
          limite_especificacion_superior: formData.valor_nominal !== undefined && formData.tolerancia_superior !== undefined 
            ? formData.valor_nominal + formData.tolerancia_superior 
            : undefined,
          limite_especificacion_inferior: formData.valor_nominal !== undefined && formData.tolerancia_inferior !== undefined 
            ? formData.valor_nominal - formData.tolerancia_inferior 
            : undefined,
          estado: 'activo',
          creado_por: 'Usuario Actual',
        });
      
      if (error) throw error;
      
      await loadPuntosControl();
      setVistaActiva('puntos_control');
      
    } catch (error) {
      console.error('Error guardando punto de control:', error);
      alert('Error al guardar el punto de control');
    } finally {
      setSaving(false);
    }
  };

  const handleGuardarMedicion = async () => {
    if (!puntoSeleccionado) return;
    
    try {
      setSaving(true);
      
      // Parsear valores
      const valores = valoresInput
        .split(/[,;\s]+/)
        .map(v => parseFloat(v.trim()))
        .filter(v => !isNaN(v));
      
      if (valores.length === 0) {
        alert('Ingrese al menos un valor');
        return;
      }
      
      const promedio = calcularPromedio(valores);
      const rango = calcularRango(valores);
      const desviacion = calcularDesviacion(valores);
      
      // Evaluar resultado
      const { resultado, fueraEspec, fueraControl } = evaluarResultado(
        promedio,
        puntoSeleccionado.limite_especificacion_inferior,
        puntoSeleccionado.limite_especificacion_superior,
        puntoSeleccionado.limite_control_inferior,
        puntoSeleccionado.limite_control_superior
      );
      
      const { error } = await supabase
        .from('qms_mediciones_proceso')
        .insert({
          punto_control_id: puntoSeleccionado.id,
          valores,
          promedio,
          rango,
          desviacion,
          resultado,
          fuera_especificacion: fueraEspec,
          fuera_control: fueraControl,
          operador: medicionForm.operador,
          orden_produccion: medicionForm.orden_produccion,
          lote: medicionForm.lote,
          producto_codigo: medicionForm.producto_codigo,
          turno: medicionForm.turno,
          notas: medicionForm.notas,
        });
      
      if (error) throw error;
      
      await loadMedicionesRecientes();
      setShowMedicionModal(false);
      
      // Si es no conforme, preguntar si generar NCR
      if (resultado === 'no_conforme') {
        // TODO: Integrar con NoConformidades
        alert('⚠️ Medición NO CONFORME registrada. Considere generar un NCR.');
      }
      
    } catch (error) {
      console.error('Error guardando medición:', error);
      alert('Error al guardar la medición');
    } finally {
      setSaving(false);
    }
  };

  const handleCambiarEstadoPunto = async (puntoId: string, nuevoEstado: EstadoPuntoControl) => {
    try {
      const { error } = await supabase
        .from('qms_puntos_control')
        .update({
          estado: nuevoEstado,
          actualizado_at: new Date().toISOString(),
        })
        .eq('id', puntoId);
      
      if (error) throw error;
      await loadPuntosControl();
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
        <RefreshCw className="h-8 w-8 animate-spin text-teal-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ==================== TABS PRINCIPALES ==================== */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        {[
          { id: 'monitoreo' as const, label: 'Monitoreo en Vivo', icon: Activity },
          { id: 'puntos_control' as const, label: 'Puntos de Control', icon: Target },
          { id: 'historial' as const, label: 'Historial', icon: History },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setVistaActiva(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                vistaActiva === tab.id
                  ? 'bg-teal-500/20 text-teal-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ==================== VISTA MONITOREO EN VIVO ==================== */}
      {vistaActiva === 'monitoreo' && (
        <>
          {/* Alertas */}
          {stats.noConformes > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-4">
              <div className="p-3 bg-red-500/20 rounded-xl">
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-red-400">
                  {stats.noConformes} medición(es) no conforme(s) hoy
                </h4>
                <p className="text-sm text-red-300/70">
                  Revise los puntos de control afectados y tome acciones correctivas
                </p>
              </div>
            </div>
          )}

          {/* Header con stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="text-xs text-slate-400 mb-1">Puntos Activos</div>
              <div className="text-2xl font-bold text-slate-200">{stats.puntosActivos}</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="text-xs text-slate-400 mb-1">Mediciones Hoy</div>
              <div className="text-2xl font-bold text-slate-200">{stats.medicionesHoy}</div>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
              <div className="text-xs text-emerald-400 mb-1">Conformes</div>
              <div className="text-2xl font-bold text-emerald-400">{stats.conformes}</div>
            </div>
            <div className={`rounded-xl p-4 ${stats.noConformes > 0 ? 'bg-red-500/20 border border-red-500/30' : 'bg-slate-900/50 border border-slate-800/50'}`}>
              <div className="text-xs text-red-400 mb-1">No Conformes</div>
              <div className={`text-2xl font-bold ${stats.noConformes > 0 ? 'text-red-400' : 'text-slate-500'}`}>{stats.noConformes}</div>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <div className="text-xs text-amber-400 mb-1">Alertas</div>
              <div className="text-2xl font-bold text-amber-400">{stats.alertas}</div>
            </div>
            <div className={`rounded-xl p-4 ${stats.porcentajeCalidad >= 95 ? 'bg-emerald-500/10 border border-emerald-500/30' : stats.porcentajeCalidad >= 90 ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
              <div className="text-xs text-slate-400 mb-1">% Calidad</div>
              <div className={`text-2xl font-bold ${stats.porcentajeCalidad >= 95 ? 'text-emerald-400' : stats.porcentajeCalidad >= 90 ? 'text-amber-400' : 'text-red-400'}`}>
                {stats.porcentajeCalidad}%
              </div>
            </div>
          </div>

          {/* Puntos de control activos - Vista de monitoreo */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl">
            <div className="p-4 border-b border-slate-800/50 flex items-center justify-between">
              <h4 className="font-semibold text-slate-200 flex items-center gap-2">
                <Activity className="h-5 w-5 text-teal-400" />
                Puntos de Control en Monitoreo
              </h4>
              <button
                onClick={loadAllData}
                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {puntosControl.filter(p => p.estado === 'activo').slice(0, 12).map(punto => {
                const tipoConfig = TIPO_CONTROL_CONFIG[punto.tipo];
                const TipoIcon = tipoConfig.icon;
                const ultimaMedicion = medicionesRecientes.find(m => m.punto_control_id === punto.id);
                const resultadoConfig = ultimaMedicion ? RESULTADO_CONFIG[ultimaMedicion.resultado] : null;
                const ResultadoIcon = resultadoConfig?.icon || CheckCircle;
                
                return (
                  <div 
                    key={punto.id}
                    className={`bg-slate-800/30 border rounded-xl p-4 cursor-pointer hover:bg-slate-800/50 transition-colors ${
                      ultimaMedicion?.resultado === 'no_conforme' 
                        ? 'border-red-500/50' 
                        : ultimaMedicion?.resultado === 'alerta'
                          ? 'border-amber-500/50'
                          : 'border-slate-700/50'
                    }`}
                    onClick={() => handleVerDetalle(punto)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg bg-slate-800`}>
                          <TipoIcon className={`h-4 w-4 ${tipoConfig.color}`} />
                        </div>
                        <div>
                          <div className="font-mono text-xs text-teal-400">{punto.codigo}</div>
                          <div className="text-sm text-slate-200 font-medium">{punto.nombre}</div>
                        </div>
                      </div>
                      
                      {resultadoConfig && (
                        <div className={`p-1.5 rounded-lg ${resultadoConfig.bg}`}>
                          <ResultadoIcon className={`h-4 w-4 ${resultadoConfig.color}`} />
                        </div>
                      )}
                    </div>
                    
                    <div className="text-xs text-slate-500 mb-2">
                      {punto.proceso} → {punto.etapa}
                    </div>
                    
                    {ultimaMedicion ? (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-400">Última medición</span>
                          <span className="text-xs text-slate-500">{formatTime(ultimaMedicion.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-slate-200">
                            {ultimaMedicion.promedio.toFixed(2)}
                          </span>
                          <span className="text-xs text-slate-500">{punto.unidad_medida}</span>
                        </div>
                        
                        {/* Mini barra de tolerancia */}
                        {punto.limite_especificacion_inferior !== undefined && punto.limite_especificacion_superior !== undefined && (
                          <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div className="absolute inset-y-0 bg-emerald-500/30" style={{
                              left: '20%',
                              right: '20%'
                            }} />
                            <div 
                              className={`absolute top-0 bottom-0 w-1 rounded-full ${
                                ultimaMedicion.resultado === 'conforme' ? 'bg-emerald-400' : 
                                ultimaMedicion.resultado === 'alerta' ? 'bg-amber-400' : 'bg-red-400'
                              }`}
                              style={{
                                left: `${Math.max(0, Math.min(100, 
                                  ((ultimaMedicion.promedio - punto.limite_especificacion_inferior) / 
                                  (punto.limite_especificacion_superior - punto.limite_especificacion_inferior)) * 100
                                ))}%`
                              }}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-2 text-xs text-slate-500">
                        Sin mediciones recientes
                      </div>
                    )}
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRegistrarMedicion(punto);
                      }}
                      className="w-full mt-3 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Registrar
                    </button>
                  </div>
                );
              })}
            </div>
            
            {puntosControl.filter(p => p.estado === 'activo').length === 0 && (
              <div className="p-12 text-center text-slate-500">
                <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No hay puntos de control activos</p>
                <button
                  onClick={handleNuevoPunto}
                  className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm"
                >
                  Crear Punto de Control
                </button>
              </div>
            )}
          </div>

          {/* Mediciones recientes */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl">
            <div className="p-4 border-b border-slate-800/50">
              <h4 className="font-semibold text-slate-200">Últimas Mediciones</h4>
            </div>
            
            <div className="divide-y divide-slate-800/50">
              {medicionesRecientes.slice(0, 10).map(medicion => {
                const punto = puntosControl.find(p => p.id === medicion.punto_control_id);
                const resultadoConfig = RESULTADO_CONFIG[medicion.resultado];
                const ResultadoIcon = resultadoConfig.icon;
                
                return (
                  <div key={medicion.id} className="p-3 flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${resultadoConfig.bg}`}>
                      <ResultadoIcon className={`h-4 w-4 ${resultadoConfig.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-teal-400">{punto?.codigo}</span>
                        <span className="text-sm text-slate-300">{punto?.nombre}</span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {medicion.operador} • {medicion.lote && `Lote: ${medicion.lote}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-slate-200">
                        {medicion.promedio.toFixed(2)} {punto?.unidad_medida}
                      </div>
                      <div className="text-xs text-slate-500">{formatTime(medicion.created_at)}</div>
                    </div>
                  </div>
                );
              })}
              
              {medicionesRecientes.length === 0 && (
                <div className="p-8 text-center text-slate-500">
                  No hay mediciones registradas
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ==================== VISTA PUNTOS DE CONTROL ==================== */}
      {vistaActiva === 'puntos_control' && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-100">Puntos de Control</h3>
              <p className="text-slate-400 text-sm">Gestión de puntos de inspección en proceso</p>
            </div>
            <button
              onClick={handleNuevoPunto}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-medium"
            >
              <Plus className="h-4 w-4" />
              Nuevo Punto
            </button>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar punto de control..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
              />
            </div>
            
            <select
              value={filtroProceso}
              onChange={(e) => setFiltroProceso(e.target.value)}
              className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
            >
              <option value="todos">Todos los procesos</option>
              {procesosUnicos.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
            >
              <option value="todos">Todos los estados</option>
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
            </select>
          </div>

          {/* Lista */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Código</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Proceso</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Especificación</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {puntosFiltrados.map(punto => {
                  const tipoConfig = TIPO_CONTROL_CONFIG[punto.tipo];
                  const estadoConfig = ESTADO_PUNTO_CONFIG[punto.estado];
                  const TipoIcon = tipoConfig.icon;
                  
                  return (
                    <tr key={punto.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-teal-400">{punto.codigo}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-slate-200">{punto.nombre}</div>
                        <div className="text-xs text-slate-500">{punto.caracteristica}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {punto.proceso} → {punto.etapa}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1.5 text-sm ${tipoConfig.color}`}>
                          <TipoIcon className="h-4 w-4" />
                          {tipoConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {punto.valor_nominal !== undefined ? (
                          <>
                            {punto.valor_nominal}
                            {punto.tolerancia_superior !== undefined && punto.tolerancia_inferior !== undefined && (
                              <span className="text-slate-500">
                                {' '}±{punto.tolerancia_superior}/{punto.tolerancia_inferior}
                              </span>
                            )}
                            {punto.unidad_medida && <span className="text-slate-500"> {punto.unidad_medida}</span>}
                          </>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs ${estadoConfig.bg} ${estadoConfig.color}`}>
                          {estadoConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleVerDetalle(punto)}
                            className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {punto.estado === 'activo' && (
                            <button
                              onClick={() => handleRegistrarMedicion(punto)}
                              className="p-1.5 hover:bg-teal-500/20 rounded-lg text-teal-400"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {puntosFiltrados.length === 0 && (
              <div className="p-12 text-center text-slate-500">
                <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No se encontraron puntos de control</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ==================== VISTA NUEVO PUNTO ==================== */}
      {vistaActiva === 'nuevo_punto' && (
        <PuntoControlForm
          formData={formData}
          setFormData={setFormData}
          onGuardar={handleGuardarPunto}
          onCancelar={() => setVistaActiva('puntos_control')}
          saving={saving}
        />
      )}

      {/* ==================== VISTA DETALLE PUNTO ==================== */}
      {vistaActiva === 'detalle_punto' && puntoSeleccionado && (
        <PuntoControlDetalle
          punto={puntoSeleccionado}
          mediciones={medicionesRecientes.filter(m => m.punto_control_id === puntoSeleccionado.id)}
          tabActivo={tabActivo}
          setTabActivo={setTabActivo}
          onVolver={() => setVistaActiva('puntos_control')}
          onRegistrarMedicion={() => handleRegistrarMedicion(puntoSeleccionado)}
          onCambiarEstado={handleCambiarEstadoPunto}
        />
      )}

      {/* ==================== VISTA HISTORIAL ==================== */}
      {vistaActiva === 'historial' && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-slate-100">Historial de Mediciones</h3>
          
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Fecha/Hora</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Punto Control</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Valores</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Promedio</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">Resultado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Operador</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Lote</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {medicionesRecientes.map(med => {
                  const punto = puntosControl.find(p => p.id === med.punto_control_id);
                  const resultadoConfig = RESULTADO_CONFIG[med.resultado];
                  
                  return (
                    <tr key={med.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {formatDateTime(med.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-teal-400">{punto?.codigo}</span>
                        <div className="text-sm text-slate-300">{punto?.nombre}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {med.valores.map(v => v.toFixed(2)).join(', ')}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-200">
                        {med.promedio.toFixed(2)} {punto?.unidad_medida}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs ${resultadoConfig.bg} ${resultadoConfig.color}`}>
                          {resultadoConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {med.operador}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {med.lote || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== MODAL MEDICIÓN ==================== */}
      {showMedicionModal && puntoSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-100">Registrar Medición</h3>
                <p className="text-sm text-slate-400">{puntoSeleccionado.codigo} - {puntoSeleccionado.nombre}</p>
              </div>
              <button
                onClick={() => setShowMedicionModal(false)}
                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Info del punto */}
            <div className="bg-slate-800/50 rounded-lg p-3 mb-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-xs text-slate-500">Nominal</div>
                  <div className="text-slate-200">{puntoSeleccionado.valor_nominal} {puntoSeleccionado.unidad_medida}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">LSL</div>
                  <div className="text-slate-200">{puntoSeleccionado.limite_especificacion_inferior}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">USL</div>
                  <div className="text-slate-200">{puntoSeleccionado.limite_especificacion_superior}</div>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Valores de Medición * (separar con coma o espacio)
                </label>
                <input
                  type="text"
                  value={valoresInput}
                  onChange={(e) => setValoresInput(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  placeholder={`Ej: 10.2, 10.1, 10.3 (${puntoSeleccionado.tamano_muestra} valores)`}
                  autoFocus
                />
                <p className="text-xs text-slate-500 mt-1">
                  Tamaño de muestra recomendado: {puntoSeleccionado.tamano_muestra}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Operador *</label>
                  <input
                    type="text"
                    value={medicionForm.operador}
                    onChange={(e) => setMedicionForm(prev => ({ ...prev, operador: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                    placeholder="Nombre del operador"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Turno</label>
                  <select
                    value={medicionForm.turno || ''}
                    onChange={(e) => setMedicionForm(prev => ({ ...prev, turno: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  >
                    <option value="">Seleccionar</option>
                    <option value="mañana">Mañana</option>
                    <option value="tarde">Tarde</option>
                    <option value="noche">Noche</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Orden de Producción</label>
                  <input
                    type="text"
                    value={medicionForm.orden_produccion || ''}
                    onChange={(e) => setMedicionForm(prev => ({ ...prev, orden_produccion: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                    placeholder="OP-2024-001"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Lote</label>
                  <input
                    type="text"
                    value={medicionForm.lote || ''}
                    onChange={(e) => setMedicionForm(prev => ({ ...prev, lote: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                    placeholder="LOT-2024-001"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Notas</label>
                <textarea
                  value={medicionForm.notas || ''}
                  onChange={(e) => setMedicionForm(prev => ({ ...prev, notas: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 resize-none"
                  placeholder="Observaciones..."
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowMedicionModal(false)}
                className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarMedicion}
                disabled={saving || !valoresInput || !medicionForm.operador}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 text-white rounded-xl"
              >
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// SUB-COMPONENTE: FORMULARIO PUNTO CONTROL
// ============================================

interface PuntoControlFormProps {
  formData: PuntoControlFormData;
  setFormData: React.Dispatch<React.SetStateAction<PuntoControlFormData>>;
  onGuardar: () => void;
  onCancelar: () => void;
  saving: boolean;
}

function PuntoControlForm({ formData, setFormData, onGuardar, onCancelar, saving }: PuntoControlFormProps) {
  const tipoConfig = TIPO_CONTROL_CONFIG[formData.tipo];
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onCancelar} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400">
          <X className="h-5 w-5" />
        </button>
        <div>
          <h3 className="text-xl font-bold text-slate-100">Nuevo Punto de Control</h3>
          <p className="text-sm text-slate-400">Defina un punto de inspección en el proceso</p>
        </div>
      </div>

      {/* Identificación */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6 space-y-4">
        <h4 className="font-semibold text-slate-200">Identificación</h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Código</label>
            <input
              type="text"
              value={formData.codigo}
              onChange={(e) => setFormData(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="Auto-generado"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Tipo *</label>
            <select
              value={formData.tipo}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                tipo: e.target.value as TipoPuntoControl,
                unidad_medida: TIPO_CONTROL_CONFIG[e.target.value as TipoPuntoControl].unidadDefault
              }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            >
              {Object.entries(TIPO_CONTROL_CONFIG).map(([key, val]) => (
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
            placeholder="Ej: Diámetro exterior tubo"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Característica a Medir *</label>
          <input
            type="text"
            value={formData.caracteristica}
            onChange={(e) => setFormData(prev => ({ ...prev, caracteristica: e.target.value }))}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            placeholder="Ej: Diámetro, Peso, Temperatura"
          />
        </div>
      </div>

      {/* Ubicación en proceso */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6 space-y-4">
        <h4 className="font-semibold text-slate-200">Ubicación en Proceso</h4>
        
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Proceso *</label>
            <input
              type="text"
              value={formData.proceso}
              onChange={(e) => setFormData(prev => ({ ...prev, proceso: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="Ej: Extrusión"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Etapa *</label>
            <input
              type="text"
              value={formData.etapa}
              onChange={(e) => setFormData(prev => ({ ...prev, etapa: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="Ej: Salida extrusora"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Línea</label>
            <input
              type="text"
              value={formData.linea_produccion || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, linea_produccion: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="Ej: Línea 1"
            />
          </div>
        </div>
      </div>

      {/* Especificaciones */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6 space-y-4">
        <h4 className="font-semibold text-slate-200">Especificaciones</h4>
        
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Valor Nominal</label>
            <input
              type="number"
              step="any"
              value={formData.valor_nominal || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, valor_nominal: parseFloat(e.target.value) || undefined }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="10.0"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Tol. Superior (+)</label>
            <input
              type="number"
              step="any"
              value={formData.tolerancia_superior || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, tolerancia_superior: parseFloat(e.target.value) || undefined }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="0.5"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Tol. Inferior (-)</label>
            <input
              type="number"
              step="any"
              value={formData.tolerancia_inferior || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, tolerancia_inferior: parseFloat(e.target.value) || undefined }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="0.5"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Unidad</label>
            <input
              type="text"
              value={formData.unidad_medida || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, unidad_medida: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder={tipoConfig.unidadDefault}
            />
          </div>
        </div>
      </div>

      {/* Muestreo y SPC */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-slate-200">Control Estadístico</h4>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.usar_spc}
              onChange={(e) => setFormData(prev => ({ ...prev, usar_spc: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-teal-500 focus:ring-teal-500"
            />
            <span className="text-sm text-slate-300">Usar gráficos de control SPC</span>
          </label>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Tamaño de Muestra</label>
            <input
              type="number"
              value={formData.tamano_muestra}
              onChange={(e) => setFormData(prev => ({ ...prev, tamano_muestra: parseInt(e.target.value) || 5 }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Frecuencia (min)</label>
            <input
              type="number"
              value={formData.frecuencia_minutos || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, frecuencia_minutos: parseInt(e.target.value) || undefined }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="30"
            />
          </div>
          
          {formData.usar_spc && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de Gráfico</label>
              <select
                value={formData.tipo_grafico || 'xbar_r'}
                onChange={(e) => setFormData(prev => ({ ...prev, tipo_grafico: e.target.value as TipoGraficoSPC }))}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              >
                {Object.entries(TIPO_GRAFICO_CONFIG).map(([key, val]) => (
                  <option key={key} value={key}>{val.label} - {val.descripcion}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <button onClick={onCancelar} className="px-4 py-2 text-slate-400 hover:text-slate-200">
          Cancelar
        </button>
        
        <button
          onClick={onGuardar}
          disabled={saving || !formData.nombre || !formData.proceso || !formData.etapa || !formData.caracteristica}
          className="flex items-center gap-2 px-6 py-2 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-medium"
        >
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Crear Punto de Control
        </button>
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTE: DETALLE PUNTO CONTROL
// ============================================

interface PuntoControlDetalleProps {
  punto: PuntoControl;
  mediciones: Medicion[];
  tabActivo: 'info' | 'mediciones' | 'spc' | 'historial';
  setTabActivo: (tab: 'info' | 'mediciones' | 'spc' | 'historial') => void;
  onVolver: () => void;
  onRegistrarMedicion: () => void;
  onCambiarEstado: (id: string, estado: EstadoPuntoControl) => void;
}

function PuntoControlDetalle({ 
  punto, mediciones, tabActivo, setTabActivo, onVolver, onRegistrarMedicion, onCambiarEstado 
}: PuntoControlDetalleProps) {
  const tipoConfig = TIPO_CONTROL_CONFIG[punto.tipo];
  const estadoConfig = ESTADO_PUNTO_CONFIG[punto.estado];
  const TipoIcon = tipoConfig.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onVolver} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400">
            <ChevronRight className="h-5 w-5 rotate-180" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-lg text-teal-400">{punto.codigo}</span>
              <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${tipoConfig.color} bg-slate-800`}>
                <TipoIcon className="h-3 w-3" />
                {tipoConfig.label}
              </span>
              <span className={`px-2 py-1 rounded-full text-xs ${estadoConfig.bg} ${estadoConfig.color}`}>
                {estadoConfig.label}
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-100 mt-1">{punto.nombre}</h3>
          </div>
        </div>
        
        {punto.estado === 'activo' && (
          <button
            onClick={onRegistrarMedicion}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-medium"
          >
            <Plus className="h-4 w-4" />
            Registrar Medición
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <div className="flex gap-1">
          {[
            { id: 'info' as const, label: 'Información', icon: Target },
            { id: 'mediciones' as const, label: 'Mediciones', icon: ClipboardCheck, count: mediciones.length },
            { id: 'spc' as const, label: 'Gráficos SPC', icon: BarChart3 },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setTabActivo(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  tabActivo === tab.id
                    ? 'border-teal-500 text-teal-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {tab.count !== undefined && (
                  <span className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">{tab.count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Info */}
      {tabActivo === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h4 className="font-semibold text-slate-200 mb-3">Ubicación en Proceso</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-400">Proceso:</span>
                  <span className="text-sm text-slate-200">{punto.proceso}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-400">Etapa:</span>
                  <span className="text-sm text-slate-200">{punto.etapa}</span>
                </div>
                {punto.linea_produccion && (
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-400">Línea:</span>
                    <span className="text-sm text-slate-200">{punto.linea_produccion}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h4 className="font-semibold text-slate-200 mb-3">Especificaciones</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-slate-800/50 rounded-lg">
                  <div className="text-xs text-slate-500">LSL</div>
                  <div className="text-lg font-bold text-red-400">
                    {punto.limite_especificacion_inferior ?? '-'}
                  </div>
                </div>
                <div className="p-3 bg-slate-800/50 rounded-lg">
                  <div className="text-xs text-slate-500">Nominal</div>
                  <div className="text-lg font-bold text-slate-200">
                    {punto.valor_nominal ?? '-'}
                  </div>
                  <div className="text-xs text-slate-500">{punto.unidad_medida}</div>
                </div>
                <div className="p-3 bg-slate-800/50 rounded-lg">
                  <div className="text-xs text-slate-500">USL</div>
                  <div className="text-lg font-bold text-red-400">
                    {punto.limite_especificacion_superior ?? '-'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h4 className="font-semibold text-slate-200 mb-3">Muestreo</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-400">Tamaño muestra:</span>
                  <span className="text-sm text-slate-200">{punto.tamano_muestra}</span>
                </div>
                {punto.frecuencia_minutos && (
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-400">Frecuencia:</span>
                    <span className="text-sm text-slate-200">Cada {punto.frecuencia_minutos} min</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-slate-400">SPC:</span>
                  <span className="text-sm text-slate-200">{punto.usar_spc ? 'Sí' : 'No'}</span>
                </div>
              </div>
            </div>
            
            {punto.usar_spc && (
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                <h4 className="font-semibold text-slate-200 mb-3">Límites de Control</h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 bg-slate-800/50 rounded-lg">
                    <div className="text-xs text-slate-500">LCL</div>
                    <div className="text-lg font-bold text-amber-400">
                      {punto.limite_control_inferior?.toFixed(2) ?? '-'}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-800/50 rounded-lg">
                    <div className="text-xs text-slate-500">CL</div>
                    <div className="text-lg font-bold text-slate-200">
                      {punto.linea_central?.toFixed(2) ?? '-'}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-800/50 rounded-lg">
                    <div className="text-xs text-slate-500">UCL</div>
                    <div className="text-lg font-bold text-amber-400">
                      {punto.limite_control_superior?.toFixed(2) ?? '-'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Mediciones */}
      {tabActivo === 'mediciones' && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Fecha/Hora</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Valores</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">X̄</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">R</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400">Resultado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Operador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {mediciones.map(med => {
                const resultadoConfig = RESULTADO_CONFIG[med.resultado];
                return (
                  <tr key={med.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 text-sm text-slate-400">{formatDateTime(med.created_at)}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {med.valores.map(v => v.toFixed(2)).join(', ')}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-200">
                      {med.promedio.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">{med.rango?.toFixed(2) ?? '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs ${resultadoConfig.bg} ${resultadoConfig.color}`}>
                        {resultadoConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">{med.operador}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {mediciones.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No hay mediciones registradas</p>
            </div>
          )}
        </div>
      )}

      {/* Tab SPC */}
      {tabActivo === 'spc' && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-8 text-center">
          <BarChart3 className="h-16 w-16 mx-auto mb-4 text-slate-600" />
          <h4 className="text-lg font-semibold text-slate-300 mb-2">Gráficos de Control SPC</h4>
          <p className="text-slate-500 max-w-md mx-auto">
            Los gráficos de control X̄-R, I-MR y otros estarán disponibles próximamente con análisis de tendencias y reglas Western Electric.
          </p>
        </div>
      )}
    </div>
  );
}