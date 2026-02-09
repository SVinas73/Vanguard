'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  AlertOctagon, Search, Plus, Filter, Download, RefreshCw,
  CheckCircle, XCircle, Clock, Eye, Edit, Trash2,
  Package, Users, Calendar, Building2, ChevronRight, ChevronDown,
  MoreHorizontal, FileText, Link2, Mail, Phone, MapPin,
  AlertTriangle, AlertCircle, TrendingUp, TrendingDown,
  X, Save, Send, Truck, Globe, BarChart3, PieChart,
  Activity, Zap, Flag, History, ExternalLink, Bell,
  UserCheck, UserX, CheckSquare, Square, Megaphone
} from 'lucide-react';

// ============================================
// TIPOS LOCALES
// ============================================

type ClaseRecall = 'I' | 'II' | 'III';
type TipoRecall = 'recall' | 'retiro_mercado' | 'alerta_seguridad';
type EstadoRecall = 'iniciado' | 'notificando' | 'en_proceso' | 'completado' | 'cerrado';
type AlcanceRecall = 'consumidor' | 'mayorista' | 'distribuidor' | 'interno';

type EstadoSeguimiento = 'pendiente' | 'notificado' | 'confirmado' | 'en_proceso' | 'recuperado' | 'no_recuperable';
type MetodoNotificacion = 'email' | 'telefono' | 'carta' | 'visita' | 'sms';
type DisposicionRecall = 'devuelto' | 'destruido_cliente' | 'destruido_sitio' | 'reparado' | 'reemplazado';

interface Recall {
  id: string;
  numero: string;
  
  // Clasificación FDA
  clase: ClaseRecall;
  tipo: TipoRecall;
  alcance: AlcanceRecall;
  
  // Producto afectado
  producto_id?: string;
  producto_codigo: string;
  producto_descripcion: string;
  
  // Lotes afectados
  lotes_afectados: string[];
  cantidad_total_afectada: number;
  unidad_medida?: string;
  
  // Motivo
  motivo: string;
  descripcion: string;
  riesgo_salud?: string;
  instrucciones_consumidor?: string;
  
  // NCR relacionada
  ncr_id?: string;
  ncr_numero?: string;
  
  // Regiones
  regiones_afectadas?: string[];
  paises_afectados?: string[];
  
  // Estado y métricas
  estado: EstadoRecall;
  unidades_recuperadas: number;
  unidades_destruidas: number;
  unidades_reparadas: number;
  porcentaje_recuperacion: number;
  
  // Comunicaciones
  comunicado_publico?: string;
  comunicado_autoridades?: string;
  fecha_notificacion_autoridad?: string;
  numero_expediente_autoridad?: string;
  
  // Costos
  costo_estimado?: number;
  costo_real?: number;
  
  // Fechas
  fecha_inicio: string;
  fecha_limite?: string;
  fecha_cierre?: string;
  
  // Responsables
  coordinador?: string;
  equipo?: string[];
  
  // Seguimientos
  seguimientos?: RecallSeguimiento[];
  
  // Timeline
  eventos?: RecallEvento[];
  
  // Documentos
  documentos?: { nombre: string; url: string; tipo: string }[];
  
  // Auditoría
  creado_por?: string;
  creado_at: string;
  actualizado_por?: string;
  actualizado_at?: string;
}

interface RecallSeguimiento {
  id: string;
  recall_id: string;
  
  // Cliente
  cliente_id?: string;
  cliente_nombre: string;
  cliente_contacto?: string;
  cliente_email?: string;
  cliente_telefono?: string;
  cliente_direccion?: string;
  
  // Venta original
  orden_venta_id?: string;
  orden_venta_numero?: string;
  fecha_venta?: string;
  
  // Lote específico
  lote_numero: string;
  cantidad_enviada: number;
  cantidad_recuperada: number;
  
  // Estado
  estado: EstadoSeguimiento;
  
  // Notificación
  fecha_notificacion?: string;
  metodo_notificacion?: MetodoNotificacion;
  intentos_contacto: number;
  respuesta_cliente?: string;
  
  // Disposición
  disposicion?: DisposicionRecall;
  fecha_disposicion?: string;
  evidencia_url?: string;
  
  // Logística
  numero_guia?: string;
  transportista?: string;
  fecha_recogida?: string;
  fecha_recepcion?: string;
  
  notas?: string;
  created_at: string;
  updated_at?: string;
}

interface RecallEvento {
  id: string;
  fecha: string;
  tipo: string;
  descripcion: string;
  usuario?: string;
}

interface RecallFormData {
  clase: ClaseRecall;
  tipo: TipoRecall;
  alcance: AlcanceRecall;
  producto_codigo: string;
  producto_descripcion: string;
  lotes_afectados: string[];
  cantidad_total_afectada: number;
  motivo: string;
  descripcion: string;
  riesgo_salud?: string;
  instrucciones_consumidor?: string;
  regiones_afectadas?: string[];
  coordinador?: string;
  fecha_limite?: string;
  costo_estimado?: number;
}

type VistaActiva = 'lista' | 'nuevo' | 'detalle' | 'editar';

// ============================================
// CONFIGURACIONES
// ============================================

const CLASE_CONFIG: Record<ClaseRecall, { 
  label: string; 
  color: string; 
  bg: string; 
  descripcion: string;
  prioridad: number;
  tiempoRespuesta: string;
}> = {
  I: { 
    label: 'Clase I', 
    color: 'text-red-500', 
    bg: 'bg-red-500/20', 
    descripcion: 'Riesgo serio de salud o muerte',
    prioridad: 1,
    tiempoRespuesta: '24-48 horas'
  },
  II: { 
    label: 'Clase II', 
    color: 'text-orange-400', 
    bg: 'bg-orange-500/20', 
    descripcion: 'Riesgo temporal o reversible',
    prioridad: 2,
    tiempoRespuesta: '72 horas'
  },
  III: { 
    label: 'Clase III', 
    color: 'text-amber-400', 
    bg: 'bg-amber-500/20', 
    descripcion: 'Improbable causa de problemas de salud',
    prioridad: 3,
    tiempoRespuesta: '7 días'
  },
};

const ESTADO_CONFIG: Record<EstadoRecall, { label: string; color: string; bg: string }> = {
  iniciado: { label: 'Iniciado', color: 'text-red-400', bg: 'bg-red-500/20' },
  notificando: { label: 'Notificando', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  en_proceso: { label: 'En Proceso', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  completado: { label: 'Completado', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  cerrado: { label: 'Cerrado', color: 'text-slate-400', bg: 'bg-slate-500/20' },
};

const TIPO_CONFIG: Record<TipoRecall, { label: string; descripcion: string }> = {
  recall: { label: 'Recall', descripcion: 'Retiro formal del producto' },
  retiro_mercado: { label: 'Retiro de Mercado', descripcion: 'Retiro voluntario del mercado' },
  alerta_seguridad: { label: 'Alerta de Seguridad', descripcion: 'Comunicación de riesgo sin retiro físico' },
};

const ALCANCE_CONFIG: Record<AlcanceRecall, { label: string; descripcion: string }> = {
  consumidor: { label: 'Consumidor Final', descripcion: 'Llegó a usuarios finales' },
  mayorista: { label: 'Mayorista', descripcion: 'En distribuidores mayoristas' },
  distribuidor: { label: 'Distribuidor', descripcion: 'En distribuidores regionales' },
  interno: { label: 'Interno', descripcion: 'Solo en almacenes propios' },
};

const ESTADO_SEGUIMIENTO_CONFIG: Record<EstadoSeguimiento, { label: string; color: string; bg: string }> = {
  pendiente: { label: 'Pendiente', color: 'text-slate-400', bg: 'bg-slate-500/20' },
  notificado: { label: 'Notificado', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  confirmado: { label: 'Confirmado', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  en_proceso: { label: 'En Proceso', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  recuperado: { label: 'Recuperado', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  no_recuperable: { label: 'No Recuperable', color: 'text-red-400', bg: 'bg-red-500/20' },
};

const DISPOSICION_CONFIG: Record<DisposicionRecall, { label: string; descripcion: string }> = {
  devuelto: { label: 'Devuelto', descripcion: 'Retornado al almacén' },
  destruido_cliente: { label: 'Destruido en Sitio', descripcion: 'Destruido por el cliente' },
  destruido_sitio: { label: 'Destruido en Planta', descripcion: 'Destruido en nuestras instalaciones' },
  reparado: { label: 'Reparado', descripcion: 'Reparado y devuelto' },
  reemplazado: { label: 'Reemplazado', descripcion: 'Reemplazado por producto nuevo' },
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

const formatearNumeroRecall = (secuencia: number): string => {
  const year = new Date().getFullYear();
  return `RCL-${year}-${secuencia.toString().padStart(5, '0')}`;
};

const calcularPorcentajeRecuperacion = (recall: Recall): number => {
  if (recall.cantidad_total_afectada <= 0) return 0;
  const recuperadas = recall.unidades_recuperadas + recall.unidades_destruidas + recall.unidades_reparadas;
  return Math.round((recuperadas / recall.cantidad_total_afectada) * 100);
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function RecallManagement() {
  // Estado principal
  const [loading, setLoading] = useState(true);
  const [vistaActiva, setVistaActiva] = useState<VistaActiva>('lista');
  const [recallSeleccionado, setRecallSeleccionado] = useState<Recall | null>(null);
  
  // Datos
  const [recalls, setRecalls] = useState<Recall[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nombre: string; email?: string; telefono?: string }[]>([]);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('activos');
  const [filtroClase, setFiltroClase] = useState<string>('todos');
  
  // Form
  const [formData, setFormData] = useState<RecallFormData>({
    clase: 'III',
    tipo: 'recall',
    alcance: 'distribuidor',
    producto_codigo: '',
    producto_descripcion: '',
    lotes_afectados: [],
    cantidad_total_afectada: 0,
    motivo: '',
    descripcion: '',
  });
  const [nuevoLote, setNuevoLote] = useState('');
  
  // UI
  const [saving, setSaving] = useState(false);
  const [tabActivo, setTabActivo] = useState<'resumen' | 'seguimientos' | 'comunicaciones' | 'timeline'>('resumen');

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
        loadRecalls(),
        loadClientes(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecalls = async () => {
    const { data, error } = await supabase
      .from('qms_recalls')
      .select('*')
      .order('fecha_inicio', { ascending: false })
      .limit(200);

    if (!error && data) {
      // Calcular porcentaje de recuperación para cada recall
      const recallsConPorcentaje = data.map(r => ({
        ...r,
        porcentaje_recuperacion: calcularPorcentajeRecuperacion(r),
      }));
      setRecalls(recallsConPorcentaje);
    }
  };

  const loadClientes = async () => {
    const { data } = await supabase
      .from('clientes')
      .select('id, nombre, email, telefono')
      .eq('activo', true)
      .order('nombre');
    if (data) setClientes(data);
  };

  const loadSeguimientos = async (recallId: string) => {
    const { data } = await supabase
      .from('qms_recall_seguimientos')
      .select('*')
      .eq('recall_id', recallId)
      .order('created_at', { ascending: false });
    
    if (data && recallSeleccionado) {
      setRecallSeleccionado({ ...recallSeleccionado, seguimientos: data });
    }
  };

  // ============================================
  // FILTRADO
  // ============================================

  const recallsFiltrados = useMemo(() => {
    return recalls.filter(recall => {
      // Búsqueda
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchNumero = recall.numero?.toLowerCase().includes(search);
        const matchProducto = recall.producto_codigo?.toLowerCase().includes(search);
        const matchMotivo = recall.motivo?.toLowerCase().includes(search);
        if (!matchNumero && !matchProducto && !matchMotivo) return false;
      }
      
      // Filtro estado
      if (filtroEstado === 'activos') {
        if (['completado', 'cerrado'].includes(recall.estado)) return false;
      } else if (filtroEstado !== 'todos' && recall.estado !== filtroEstado) {
        return false;
      }
      
      // Filtro clase
      if (filtroClase !== 'todos' && recall.clase !== filtroClase) return false;
      
      return true;
    });
  }, [recalls, searchTerm, filtroEstado, filtroClase]);

  // ============================================
  // ESTADÍSTICAS
  // ============================================

  const stats = useMemo(() => {
    const activos = recalls.filter(r => !['completado', 'cerrado'].includes(r.estado));
    const claseI = activos.filter(r => r.clase === 'I').length;
    const claseII = activos.filter(r => r.clase === 'II').length;
    const claseIII = activos.filter(r => r.clase === 'III').length;
    
    const unidadesAfectadas = activos.reduce((sum, r) => sum + (r.cantidad_total_afectada || 0), 0);
    const unidadesRecuperadas = activos.reduce((sum, r) => sum + (r.unidades_recuperadas || 0) + (r.unidades_destruidas || 0), 0);
    const porcentajeGlobal = unidadesAfectadas > 0 ? Math.round((unidadesRecuperadas / unidadesAfectadas) * 100) : 0;
    
    const costoTotal = activos.reduce((sum, r) => sum + (r.costo_real || r.costo_estimado || 0), 0);
    
    return { 
      activos: activos.length, 
      claseI, 
      claseII, 
      claseIII,
      unidadesAfectadas,
      unidadesRecuperadas,
      porcentajeGlobal,
      costoTotal
    };
  }, [recalls]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleNuevoRecall = () => {
    setFormData({
      clase: 'III',
      tipo: 'recall',
      alcance: 'distribuidor',
      producto_codigo: '',
      producto_descripcion: '',
      lotes_afectados: [],
      cantidad_total_afectada: 0,
      motivo: '',
      descripcion: '',
    });
    setVistaActiva('nuevo');
  };

  const handleVerDetalle = async (recall: Recall) => {
    setRecallSeleccionado(recall);
    setTabActivo('resumen');
    setVistaActiva('detalle');
    
    // Cargar seguimientos
    const { data } = await supabase
      .from('qms_recall_seguimientos')
      .select('*')
      .eq('recall_id', recall.id)
      .order('created_at', { ascending: false });
    
    if (data) {
      setRecallSeleccionado({ ...recall, seguimientos: data });
    }
  };

  const handleAgregarLote = () => {
    if (nuevoLote.trim() && !formData.lotes_afectados.includes(nuevoLote.trim())) {
      setFormData(prev => ({
        ...prev,
        lotes_afectados: [...prev.lotes_afectados, nuevoLote.trim()]
      }));
      setNuevoLote('');
    }
  };

  const handleQuitarLote = (lote: string) => {
    setFormData(prev => ({
      ...prev,
      lotes_afectados: prev.lotes_afectados.filter(l => l !== lote)
    }));
  };

  const handleGuardarRecall = async () => {
    try {
      setSaving(true);
      
      if (vistaActiva === 'nuevo') {
        // Generar número
        const { data: lastRecall } = await supabase
          .from('qms_recalls')
          .select('numero')
          .order('creado_at', { ascending: false })
          .limit(1)
          .single();
        
        const lastSeq = lastRecall?.numero ? parseInt(lastRecall.numero.split('-')[2]) : 0;
        const numero = formatearNumeroRecall(lastSeq + 1);
        
        const { error } = await supabase
          .from('qms_recalls')
          .insert({
            numero,
            ...formData,
            estado: 'iniciado',
            unidades_recuperadas: 0,
            unidades_destruidas: 0,
            unidades_reparadas: 0,
            porcentaje_recuperacion: 0,
            fecha_inicio: new Date().toISOString(),
            creado_por: 'Usuario Actual',
          });
        
        if (error) throw error;
      } else {
        // Actualizar
        const { error } = await supabase
          .from('qms_recalls')
          .update({
            ...formData,
            actualizado_at: new Date().toISOString(),
            actualizado_por: 'Usuario Actual',
          })
          .eq('id', recallSeleccionado?.id);
        
        if (error) throw error;
      }
      
      await loadRecalls();
      setVistaActiva('lista');
      
    } catch (error) {
      console.error('Error guardando recall:', error);
      alert('Error al guardar el recall');
    } finally {
      setSaving(false);
    }
  };

  const handleCambiarEstado = async (recallId: string, nuevoEstado: EstadoRecall) => {
    try {
      setSaving(true);
      
      const updates: any = {
        estado: nuevoEstado,
        actualizado_at: new Date().toISOString(),
      };
      
      if (nuevoEstado === 'cerrado') {
        updates.fecha_cierre = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('qms_recalls')
        .update(updates)
        .eq('id', recallId);
      
      if (error) throw error;
      
      await loadRecalls();
      if (recallSeleccionado?.id === recallId) {
        setRecallSeleccionado({ ...recallSeleccionado, ...updates });
      }
      
    } catch (error) {
      console.error('Error cambiando estado:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleActualizarSeguimiento = async (seguimientoId: string, updates: Partial<RecallSeguimiento>) => {
    try {
      const { error } = await supabase
        .from('qms_recall_seguimientos')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', seguimientoId);
      
      if (error) throw error;
      
      // Recargar seguimientos
      if (recallSeleccionado) {
        await loadSeguimientos(recallSeleccionado.id);
        
        // Recalcular totales del recall
        const { data: seguimientos } = await supabase
          .from('qms_recall_seguimientos')
          .select('cantidad_recuperada')
          .eq('recall_id', recallSeleccionado.id);
        
        const totalRecuperado = seguimientos?.reduce((sum, s) => sum + (s.cantidad_recuperada || 0), 0) || 0;
        
        await supabase
          .from('qms_recalls')
          .update({
            unidades_recuperadas: totalRecuperado,
            porcentaje_recuperacion: Math.round((totalRecuperado / recallSeleccionado.cantidad_total_afectada) * 100),
          })
          .eq('id', recallSeleccionado.id);
        
        await loadRecalls();
      }
      
    } catch (error) {
      console.error('Error actualizando seguimiento:', error);
    }
  };

  const handleCrearSeguimientosAutomaticos = async (recallId: string) => {
    // TODO: Buscar todas las ventas de los lotes afectados y crear seguimientos
    alert('Funcionalidad de creación automática de seguimientos próximamente');
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-8 w-8 animate-spin text-red-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ==================== VISTA LISTA ==================== */}
      {vistaActiva === 'lista' && (
        <>
          {/* Header con alerta si hay Clase I */}
          {stats.claseI > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-4">
              <div className="p-3 bg-red-500/20 rounded-xl">
                <AlertOctagon className="h-8 w-8 text-red-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-red-400">⚠️ RECALL CLASE I ACTIVO</h3>
                <p className="text-sm text-red-300/80">
                  Hay {stats.claseI} recall(s) de Clase I que requieren atención inmediata (24-48 horas)
                </p>
              </div>
              <button
                onClick={() => setFiltroClase('I')}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium"
              >
                Ver Ahora
              </button>
            </div>
          )}

          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <AlertOctagon className="h-6 w-6 text-red-400" />
                Gestión de Recalls
              </h3>
              <p className="text-slate-400 text-sm mt-1">
                Retiros de producto según clasificación FDA
              </p>
            </div>
            
            {/* Stats */}
            <div className="flex gap-3">
              <div className={`px-4 py-2 rounded-xl ${stats.claseI > 0 ? 'bg-red-500/20 border border-red-500/30' : 'bg-slate-800/50 border border-slate-700/50'}`}>
                <div className="text-xs text-red-400">Clase I</div>
                <div className={`text-xl font-bold ${stats.claseI > 0 ? 'text-red-400' : 'text-slate-500'}`}>{stats.claseI}</div>
              </div>
              <div className="px-4 py-2 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                <div className="text-xs text-orange-400">Clase II</div>
                <div className="text-xl font-bold text-orange-400">{stats.claseII}</div>
              </div>
              <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <div className="text-xs text-amber-400">Clase III</div>
                <div className="text-xl font-bold text-amber-400">{stats.claseIII}</div>
              </div>
              <div className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl">
                <div className="text-xs text-slate-400">Recuperación</div>
                <div className="text-xl font-bold text-slate-300">{stats.porcentajeGlobal}%</div>
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
                  placeholder="Buscar por número, producto, motivo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>
              
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
              >
                <option value="activos">Activos</option>
                <option value="todos">Todos</option>
                <option value="iniciado">Iniciados</option>
                <option value="notificando">Notificando</option>
                <option value="en_proceso">En Proceso</option>
                <option value="completado">Completados</option>
                <option value="cerrado">Cerrados</option>
              </select>
              
              <select
                value={filtroClase}
                onChange={(e) => setFiltroClase(e.target.value)}
                className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
              >
                <option value="todos">Todas las clases</option>
                <option value="I">Clase I (Crítico)</option>
                <option value="II">Clase II (Moderado)</option>
                <option value="III">Clase III (Menor)</option>
              </select>
              
              <button
                onClick={loadRecalls}
                className="p-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-400 hover:text-slate-200 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            
            <button
              onClick={handleNuevoRecall}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition-colors"
            >
              <Plus className="h-4 w-4" />
              Iniciar Recall
            </button>
          </div>

          {/* Lista de Recalls */}
          <div className="space-y-3">
            {recallsFiltrados.map(recall => {
              const claseConfig = CLASE_CONFIG[recall.clase];
              const estadoConfig = ESTADO_CONFIG[recall.estado];
              const porcentaje = calcularPorcentajeRecuperacion(recall);
              
              return (
                <div 
                  key={recall.id} 
                  className={`bg-slate-900/50 border rounded-xl p-4 hover:border-slate-600 transition-colors cursor-pointer ${
                    recall.clase === 'I' ? 'border-red-500/50' : 'border-slate-800/50'
                  }`}
                  onClick={() => handleVerDetalle(recall)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className="font-mono text-sm text-red-400">{recall.numero}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${claseConfig.bg} ${claseConfig.color}`}>
                          {claseConfig.label}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${estadoConfig.bg} ${estadoConfig.color}`}>
                          {estadoConfig.label}
                        </span>
                        <span className="text-xs text-slate-500">
                          {TIPO_CONFIG[recall.tipo]?.label}
                        </span>
                      </div>
                      
                      {/* Producto */}
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="h-4 w-4 text-slate-500" />
                        <span className="font-mono text-sm text-slate-300">{recall.producto_codigo}</span>
                        <span className="text-sm text-slate-400">- {recall.producto_descripcion}</span>
                      </div>
                      
                      {/* Motivo */}
                      <p className="text-sm text-slate-400 mb-3 line-clamp-1">{recall.motivo}</p>
                      
                      {/* Barra de progreso */}
                      <div className="mb-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400">Recuperación</span>
                          <span className={porcentaje >= 90 ? 'text-emerald-400' : porcentaje >= 50 ? 'text-amber-400' : 'text-red-400'}>
                            {porcentaje}% ({recall.unidades_recuperadas + recall.unidades_destruidas}/{recall.cantidad_total_afectada})
                          </span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all ${
                              porcentaje >= 90 ? 'bg-emerald-500' : porcentaje >= 50 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${porcentaje}%` }}
                          />
                        </div>
                      </div>
                      
                      {/* Metadata */}
                      <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Inicio: {formatDate(recall.fecha_inicio)}
                        </span>
                        {recall.lotes_afectados && (
                          <span className="flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            {recall.lotes_afectados.length} lote(s)
                          </span>
                        )}
                        {recall.coordinador && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {recall.coordinador}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Indicador de prioridad */}
                    <div className="flex flex-col items-center gap-2">
                      <div className={`p-3 rounded-xl ${claseConfig.bg}`}>
                        <AlertOctagon className={`h-6 w-6 ${claseConfig.color}`} />
                      </div>
                      <span className="text-xs text-slate-500 text-center">
                        {claseConfig.tiempoRespuesta}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {recallsFiltrados.length === 0 && (
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-emerald-400" />
                <p className="text-slate-400">No hay recalls activos</p>
                <p className="text-sm text-slate-500 mt-1">¡Excelente! No hay retiros de producto pendientes</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ==================== VISTA NUEVO ==================== */}
      {vistaActiva === 'nuevo' && (
        <RecallForm
          formData={formData}
          setFormData={setFormData}
          nuevoLote={nuevoLote}
          setNuevoLote={setNuevoLote}
          onAgregarLote={handleAgregarLote}
          onQuitarLote={handleQuitarLote}
          onGuardar={handleGuardarRecall}
          onCancelar={() => setVistaActiva('lista')}
          saving={saving}
        />
      )}

      {/* ==================== VISTA DETALLE ==================== */}
      {vistaActiva === 'detalle' && recallSeleccionado && (
        <RecallDetalle
          recall={recallSeleccionado}
          tabActivo={tabActivo}
          setTabActivo={setTabActivo}
          onVolver={() => setVistaActiva('lista')}
          onCambiarEstado={handleCambiarEstado}
          onActualizarSeguimiento={handleActualizarSeguimiento}
          onCrearSeguimientosAutomaticos={handleCrearSeguimientosAutomaticos}
          saving={saving}
        />
      )}
    </div>
  );
}

// ============================================
// SUB-COMPONENTE: FORMULARIO
// ============================================

interface RecallFormProps {
  formData: RecallFormData;
  setFormData: React.Dispatch<React.SetStateAction<RecallFormData>>;
  nuevoLote: string;
  setNuevoLote: (v: string) => void;
  onAgregarLote: () => void;
  onQuitarLote: (lote: string) => void;
  onGuardar: () => void;
  onCancelar: () => void;
  saving: boolean;
}

function RecallForm({ 
  formData, setFormData, nuevoLote, setNuevoLote, onAgregarLote, onQuitarLote,
  onGuardar, onCancelar, saving 
}: RecallFormProps) {
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
            <AlertOctagon className="h-6 w-6 text-red-400" />
            Iniciar Nuevo Recall
          </h3>
          <p className="text-sm text-slate-400">Complete la información del retiro de producto</p>
        </div>
      </div>

      {/* Clasificación FDA */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
        <h4 className="font-semibold text-slate-200 mb-4">Clasificación FDA</h4>
        
        <div className="grid grid-cols-3 gap-4 mb-6">
          {Object.entries(CLASE_CONFIG).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setFormData(prev => ({ ...prev, clase: key as ClaseRecall }))}
              className={`p-4 rounded-xl border text-left transition-colors ${
                formData.clase === key
                  ? `${config.bg} border-current ${config.color}`
                  : 'border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertOctagon className={`h-5 w-5 ${formData.clase === key ? config.color : 'text-slate-400'}`} />
                <span className={`font-bold ${formData.clase === key ? config.color : 'text-slate-200'}`}>
                  {config.label}
                </span>
              </div>
              <p className="text-xs text-slate-500">{config.descripcion}</p>
              <p className="text-xs text-slate-600 mt-1">Respuesta: {config.tiempoRespuesta}</p>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de Recall</label>
            <select
              value={formData.tipo}
              onChange={(e) => setFormData(prev => ({ ...prev, tipo: e.target.value as TipoRecall }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            >
              {Object.entries(TIPO_CONFIG).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Alcance</label>
            <select
              value={formData.alcance}
              onChange={(e) => setFormData(prev => ({ ...prev, alcance: e.target.value as AlcanceRecall }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            >
              {Object.entries(ALCANCE_CONFIG).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Producto */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6 space-y-4">
        <h4 className="font-semibold text-slate-200">Producto Afectado</h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Código Producto *</label>
            <input
              type="text"
              value={formData.producto_codigo}
              onChange={(e) => setFormData(prev => ({ ...prev, producto_codigo: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="Ej: PROD-001"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Cantidad Afectada *</label>
            <input
              type="number"
              value={formData.cantidad_total_afectada || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, cantidad_total_afectada: parseInt(e.target.value) || 0 }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="0"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Descripción Producto *</label>
          <input
            type="text"
            value={formData.producto_descripcion}
            onChange={(e) => setFormData(prev => ({ ...prev, producto_descripcion: e.target.value }))}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            placeholder="Descripción del producto"
          />
        </div>

        {/* Lotes */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Lotes Afectados *</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={nuevoLote}
              onChange={(e) => setNuevoLote(e.target.value)}
              className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="Número de lote"
              onKeyDown={(e) => e.key === 'Enter' && onAgregarLote()}
            />
            <button
              onClick={onAgregarLote}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-200"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
          
          {formData.lotes_afectados.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.lotes_afectados.map(lote => (
                <span
                  key={lote}
                  className="flex items-center gap-1 px-3 py-1 bg-slate-800 rounded-lg text-sm text-slate-300"
                >
                  {lote}
                  <button
                    onClick={() => onQuitarLote(lote)}
                    className="ml-1 hover:text-red-400"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Motivo */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6 space-y-4">
        <h4 className="font-semibold text-slate-200">Motivo del Recall</h4>
        
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Motivo *</label>
          <input
            type="text"
            value={formData.motivo}
            onChange={(e) => setFormData(prev => ({ ...prev, motivo: e.target.value }))}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            placeholder="Resumen del motivo del recall"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Descripción Detallada *</label>
          <textarea
            value={formData.descripcion}
            onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
            rows={3}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 resize-none"
            placeholder="Descripción detallada del problema..."
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Riesgo para la Salud</label>
          <textarea
            value={formData.riesgo_salud || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, riesgo_salud: e.target.value }))}
            rows={2}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 resize-none"
            placeholder="Descripción del riesgo potencial para la salud..."
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Instrucciones para Consumidores</label>
          <textarea
            value={formData.instrucciones_consumidor || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, instrucciones_consumidor: e.target.value }))}
            rows={2}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 resize-none"
            placeholder="Qué deben hacer los consumidores con el producto..."
          />
        </div>
      </div>

      {/* Gestión */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6 space-y-4">
        <h4 className="font-semibold text-slate-200">Gestión</h4>
        
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Coordinador</label>
            <input
              type="text"
              value={formData.coordinador || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, coordinador: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="Responsable del recall"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Fecha Límite</label>
            <input
              type="date"
              value={formData.fecha_limite?.split('T')[0] || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, fecha_limite: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Costo Estimado ($)</label>
            <input
              type="number"
              value={formData.costo_estimado || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, costo_estimado: parseFloat(e.target.value) || undefined }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="0.00"
            />
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
          disabled={saving || !formData.producto_codigo || !formData.motivo || formData.lotes_afectados.length === 0}
          className="flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-medium transition-colors"
        >
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <AlertOctagon className="h-4 w-4" />}
          Iniciar Recall
        </button>
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTE: DETALLE
// ============================================

interface RecallDetalleProps {
  recall: Recall;
  tabActivo: 'resumen' | 'seguimientos' | 'comunicaciones' | 'timeline';
  setTabActivo: (tab: 'resumen' | 'seguimientos' | 'comunicaciones' | 'timeline') => void;
  onVolver: () => void;
  onCambiarEstado: (id: string, estado: EstadoRecall) => void;
  onActualizarSeguimiento: (id: string, updates: Partial<RecallSeguimiento>) => void;
  onCrearSeguimientosAutomaticos: (recallId: string) => void;
  saving: boolean;
}

function RecallDetalle({ 
  recall, tabActivo, setTabActivo, onVolver, onCambiarEstado, 
  onActualizarSeguimiento, onCrearSeguimientosAutomaticos, saving 
}: RecallDetalleProps) {
  const claseConfig = CLASE_CONFIG[recall.clase];
  const estadoConfig = ESTADO_CONFIG[recall.estado];
  const porcentaje = calcularPorcentajeRecuperacion(recall);

  const siguienteEstado: Partial<Record<EstadoRecall, EstadoRecall>> = {
    iniciado: 'notificando',
    notificando: 'en_proceso',
    en_proceso: 'completado',
    completado: 'cerrado',
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
              <h3 className="text-xl font-bold text-slate-100">{recall.numero}</h3>
              <span className={`px-2 py-1 rounded-full text-xs font-bold ${claseConfig.bg} ${claseConfig.color}`}>
                {claseConfig.label}
              </span>
              <span className={`px-2 py-1 rounded-full text-xs ${estadoConfig.bg} ${estadoConfig.color}`}>
                {estadoConfig.label}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              {recall.producto_codigo} - {recall.producto_descripcion}
            </p>
          </div>
        </div>
        
        {recall.estado !== 'cerrado' && siguienteEstado[recall.estado] && (
          <button
            onClick={() => onCambiarEstado(recall.id, siguienteEstado[recall.estado]!)}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium"
          >
            <CheckCircle className="h-4 w-4" />
            Avanzar a {ESTADO_CONFIG[siguienteEstado[recall.estado]!].label}
          </button>
        )}
      </div>

      {/* Progreso general */}
      <div className={`rounded-xl p-4 ${claseConfig.bg} border ${recall.clase === 'I' ? 'border-red-500/50' : 'border-slate-700/50'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-300">Progreso de Recuperación</span>
          <span className={`text-2xl font-bold ${porcentaje >= 90 ? 'text-emerald-400' : porcentaje >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
            {porcentaje}%
          </span>
        </div>
        <div className="h-3 bg-slate-800 rounded-full overflow-hidden mb-2">
          <div 
            className={`h-full transition-all ${
              porcentaje >= 90 ? 'bg-emerald-500' : porcentaje >= 50 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${porcentaje}%` }}
          />
        </div>
        <div className="grid grid-cols-4 gap-4 text-center text-xs">
          <div>
            <div className="text-slate-400">Afectadas</div>
            <div className="text-lg font-bold text-slate-200">{recall.cantidad_total_afectada}</div>
          </div>
          <div>
            <div className="text-slate-400">Recuperadas</div>
            <div className="text-lg font-bold text-emerald-400">{recall.unidades_recuperadas}</div>
          </div>
          <div>
            <div className="text-slate-400">Destruidas</div>
            <div className="text-lg font-bold text-amber-400">{recall.unidades_destruidas}</div>
          </div>
          <div>
            <div className="text-slate-400">Pendientes</div>
            <div className="text-lg font-bold text-red-400">
              {recall.cantidad_total_afectada - recall.unidades_recuperadas - recall.unidades_destruidas}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <div className="flex gap-1">
          {[
            { id: 'resumen' as const, label: 'Resumen', icon: FileText },
            { id: 'seguimientos' as const, label: 'Seguimientos', icon: Users },
            { id: 'comunicaciones' as const, label: 'Comunicaciones', icon: Megaphone },
            { id: 'timeline' as const, label: 'Timeline', icon: History },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setTabActivo(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  tabActivo === tab.id
                    ? 'border-red-500 text-red-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {tab.id === 'seguimientos' && recall.seguimientos && (
                  <span className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">
                    {recall.seguimientos.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenido del tab */}
      {tabActivo === 'resumen' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Info principal */}
          <div className="space-y-4">
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h4 className="font-semibold text-slate-200 mb-3">Motivo del Recall</h4>
              <p className="text-slate-300 font-medium mb-2">{recall.motivo}</p>
              <p className="text-sm text-slate-400">{recall.descripcion}</p>
              
              {recall.riesgo_salud && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <h5 className="text-sm font-medium text-red-400 mb-1">Riesgo para la Salud</h5>
                  <p className="text-sm text-slate-300">{recall.riesgo_salud}</p>
                </div>
              )}
            </div>
            
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h4 className="font-semibold text-slate-200 mb-3">Lotes Afectados</h4>
              <div className="flex flex-wrap gap-2">
                {recall.lotes_afectados?.map(lote => (
                  <span key={lote} className="px-3 py-1 bg-slate-800 rounded-lg text-sm font-mono text-slate-300">
                    {lote}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 space-y-3">
              <h4 className="font-semibold text-slate-200 text-sm">Información</h4>
              
              <div>
                <label className="text-xs text-slate-500">Tipo</label>
                <div className="text-slate-200">{TIPO_CONFIG[recall.tipo]?.label}</div>
              </div>
              
              <div>
                <label className="text-xs text-slate-500">Alcance</label>
                <div className="text-slate-200">{ALCANCE_CONFIG[recall.alcance]?.label}</div>
              </div>
              
              <div>
                <label className="text-xs text-slate-500">Fecha Inicio</label>
                <div className="text-slate-200">{formatDate(recall.fecha_inicio)}</div>
              </div>
              
              {recall.fecha_limite && (
                <div>
                  <label className="text-xs text-slate-500">Fecha Límite</label>
                  <div className="text-slate-200">{formatDate(recall.fecha_limite)}</div>
                </div>
              )}
              
              {recall.coordinador && (
                <div>
                  <label className="text-xs text-slate-500">Coordinador</label>
                  <div className="text-slate-200">{recall.coordinador}</div>
                </div>
              )}
              
              {recall.costo_estimado && (
                <div>
                  <label className="text-xs text-slate-500">Costo Estimado</label>
                  <div className="text-slate-200 font-medium">${recall.costo_estimado.toLocaleString()}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tabActivo === 'seguimientos' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-slate-400">Seguimiento por cliente/destino del producto</p>
            <button
              onClick={() => onCrearSeguimientosAutomaticos(recall.id)}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"
            >
              <Zap className="h-4 w-4" />
              Crear Automáticamente
            </button>
          </div>

          {recall.seguimientos && recall.seguimientos.length > 0 ? (
            <div className="space-y-3">
              {recall.seguimientos.map(seg => {
                const estadoSeg = ESTADO_SEGUIMIENTO_CONFIG[seg.estado];
                return (
                  <div key={seg.id} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-medium text-slate-200">{seg.cliente_nombre}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${estadoSeg.bg} ${estadoSeg.color}`}>
                            {estadoSeg.label}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-4 text-sm mb-3">
                          <div>
                            <div className="text-xs text-slate-500">Lote</div>
                            <div className="font-mono text-slate-300">{seg.lote_numero}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500">Enviadas</div>
                            <div className="text-slate-300">{seg.cantidad_enviada}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500">Recuperadas</div>
                            <div className="text-emerald-400 font-medium">{seg.cantidad_recuperada}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500">Pendientes</div>
                            <div className="text-amber-400">{seg.cantidad_enviada - seg.cantidad_recuperada}</div>
                          </div>
                        </div>
                        
                        {seg.cliente_email && (
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {seg.cliente_email}
                            </span>
                            {seg.cliente_telefono && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {seg.cliente_telefono}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {seg.estado === 'pendiente' && (
                          <button
                            onClick={() => onActualizarSeguimiento(seg.id, { estado: 'notificado', fecha_notificacion: new Date().toISOString() })}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs"
                          >
                            Marcar Notificado
                          </button>
                        )}
                        {seg.estado === 'notificado' && (
                          <button
                            onClick={() => onActualizarSeguimiento(seg.id, { estado: 'confirmado' })}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs"
                          >
                            Confirmar Respuesta
                          </button>
                        )}
                        {(seg.estado === 'confirmado' || seg.estado === 'en_proceso') && (
                          <button
                            onClick={() => onActualizarSeguimiento(seg.id, { 
                              estado: 'recuperado', 
                              cantidad_recuperada: seg.cantidad_enviada,
                              fecha_disposicion: new Date().toISOString()
                            })}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs"
                          >
                            Marcar Recuperado
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
              <Users className="h-12 w-12 mx-auto mb-3 text-slate-600" />
              <p className="text-slate-400">No hay seguimientos creados</p>
              <p className="text-sm text-slate-500 mt-1">
                Crea seguimientos automáticamente o agrega manualmente
              </p>
            </div>
          )}
        </div>
      )}

      {tabActivo === 'comunicaciones' && (
        <div className="space-y-4">
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <h4 className="font-semibold text-slate-200 mb-3">Comunicado Público</h4>
            {recall.comunicado_publico ? (
              <p className="text-slate-300 whitespace-pre-wrap">{recall.comunicado_publico}</p>
            ) : (
              <p className="text-slate-500 italic">No hay comunicado público definido</p>
            )}
          </div>
          
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <h4 className="font-semibold text-slate-200 mb-3">Comunicado a Autoridades</h4>
            {recall.comunicado_autoridades ? (
              <p className="text-slate-300 whitespace-pre-wrap">{recall.comunicado_autoridades}</p>
            ) : (
              <p className="text-slate-500 italic">No hay comunicado a autoridades definido</p>
            )}
            
            {recall.fecha_notificacion_autoridad && (
              <div className="mt-3 p-2 bg-slate-800/50 rounded-lg text-sm">
                <span className="text-slate-400">Notificado el:</span>{' '}
                <span className="text-slate-200">{formatDate(recall.fecha_notificacion_autoridad)}</span>
                {recall.numero_expediente_autoridad && (
                  <>
                    {' '}• <span className="text-slate-400">Expediente:</span>{' '}
                    <span className="text-slate-200">{recall.numero_expediente_autoridad}</span>
                  </>
                )}
              </div>
            )}
          </div>
          
          {recall.instrucciones_consumidor && (
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h4 className="font-semibold text-slate-200 mb-3">Instrucciones para Consumidores</h4>
              <p className="text-slate-300 whitespace-pre-wrap">{recall.instrucciones_consumidor}</p>
            </div>
          )}
        </div>
      )}

      {tabActivo === 'timeline' && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-0.5 h-full bg-slate-700" />
              </div>
              <div className="flex-1 pb-4">
                <div className="text-sm text-slate-200">Recall iniciado</div>
                <div className="text-xs text-slate-500">{formatDateTime(recall.creado_at)} por {recall.creado_por}</div>
              </div>
            </div>
            
            {recall.eventos?.map((evento, idx) => (
              <div key={evento.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-slate-600" />
                  {idx < (recall.eventos?.length || 0) - 1 && <div className="w-0.5 h-full bg-slate-700" />}
                </div>
                <div className="flex-1 pb-4">
                  <div className="text-sm text-slate-200">{evento.descripcion}</div>
                  <div className="text-xs text-slate-500">{formatDateTime(evento.fecha)} {evento.usuario && `por ${evento.usuario}`}</div>
                </div>
              </div>
            ))}
            
            {recall.fecha_cierre && (
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-slate-200">Recall cerrado</div>
                  <div className="text-xs text-slate-500">{formatDateTime(recall.fecha_cierre)}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}