'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  AlertTriangle, Search, Plus, Filter, Download, RefreshCw,
  CheckCircle, XCircle, Clock, Eye, Edit, Trash2,
  Package, Users, Calendar, Building2, ChevronRight, ChevronDown,
  MoreHorizontal, FileText, Link2, Target, AlertCircle,
  TrendingUp, DollarSign, Clipboard, Send, X, Save,
  Camera, Upload, MessageSquare, History, ArrowRight,
  BarChart3, PieChart, Activity, Zap, Flag, AlertOctagon
} from 'lucide-react';

// ============================================
// TIPOS LOCALES
// ============================================

type TipoNCR = 'producto' | 'proceso' | 'sistema' | 'proveedor' | 'cliente';
type OrigenNCR = 'inspeccion_recepcion' | 'inspeccion_proceso' | 'auditoria' | 'cliente' | 'interno';
type SeveridadNCR = 'critica' | 'mayor' | 'menor' | 'observacion';
type DisposicionNCR = 'usar' | 'retrabajo' | 'reparar' | 'rechazar' | 'devolver' | 'concesion' | 'scrap';
type EstadoNCR = 'abierta' | 'en_analisis' | 'en_implementacion' | 'verificacion' | 'cerrada' | 'cancelada';

interface NoConformidad {
  id: string;
  numero: string;
  tipo: TipoNCR;
  origen: OrigenNCR;
  severidad: SeveridadNCR;
  titulo: string;
  descripcion: string;
  evidencia?: string;
  
  // Referencias
  inspeccion_id?: string;
  inspeccion_numero?: string;
  producto_codigo?: string;
  producto_descripcion?: string;
  lote_numero?: string;
  orden_compra_id?: string;
  orden_compra_numero?: string;
  proveedor_id?: string;
  proveedor_nombre?: string;
  cliente_id?: string;
  cliente_nombre?: string;
  
  // Cantidades y costos
  cantidad_afectada?: number;
  unidad_medida?: string;
  costo_estimado?: number;
  costo_real?: number;
  
  // Disposición
  disposicion?: DisposicionNCR;
  disposicion_detalle?: string;
  disposicion_fecha?: string;
  disposicion_por?: string;
  
  // Estado y fechas
  estado: EstadoNCR;
  fecha_deteccion: string;
  fecha_objetivo?: string;
  fecha_cierre?: string;
  
  // Responsables
  detectado_por?: string;
  responsable?: string;
  aprobado_por?: string;
  
  // Análisis causa raíz
  causa_raiz?: string;
  metodo_analisis?: string;
  
  // Documentos
  documentos?: { nombre: string; url: string; tipo: string }[];
  fotos?: { url: string; descripcion?: string }[];
  
  // CAPAs vinculadas
  capas?: { id: string; numero: string; tipo: string; estado: string }[];
  
  // Comentarios
  comentarios?: NCRComentario[];
  
  // Auditoría
  creado_por?: string;
  creado_at: string;
  actualizado_por?: string;
  actualizado_at?: string;
}

interface NCRComentario {
  id: string;
  usuario: string;
  contenido: string;
  fecha: string;
}

interface NCRFormData {
  tipo: TipoNCR;
  origen: OrigenNCR;
  severidad: SeveridadNCR;
  titulo: string;
  descripcion: string;
  producto_codigo?: string;
  producto_descripcion?: string;
  lote_numero?: string;
  proveedor_id?: string;
  proveedor_nombre?: string;
  cliente_id?: string;
  cliente_nombre?: string;
  cantidad_afectada?: number;
  unidad_medida?: string;
  costo_estimado?: number;
  fecha_objetivo?: string;
  responsable?: string;
  evidencia?: string;
}

type VistaActiva = 'lista' | 'nueva' | 'detalle' | 'editar';

// ============================================
// CONFIGURACIONES
// ============================================

const SEVERIDAD_CONFIG: Record<SeveridadNCR, { label: string; color: string; bg: string; prioridad: number }> = {
  critica: { label: 'Crítica', color: 'text-red-500', bg: 'bg-red-500/20', prioridad: 1 },
  mayor: { label: 'Mayor', color: 'text-orange-400', bg: 'bg-orange-500/20', prioridad: 2 },
  menor: { label: 'Menor', color: 'text-amber-400', bg: 'bg-amber-500/20', prioridad: 3 },
  observacion: { label: 'Observación', color: 'text-slate-400', bg: 'bg-slate-500/20', prioridad: 4 },
};

const ESTADO_CONFIG: Record<EstadoNCR, { label: string; color: string; bg: string }> = {
  abierta: { label: 'Abierta', color: 'text-red-400', bg: 'bg-red-500/20' },
  en_analisis: { label: 'En Análisis', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  en_implementacion: { label: 'Implementación', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  verificacion: { label: 'Verificación', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  cerrada: { label: 'Cerrada', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  cancelada: { label: 'Cancelada', color: 'text-slate-400', bg: 'bg-slate-500/20' },
};

const TIPO_CONFIG: Record<TipoNCR, { label: string; icon: React.ElementType }> = {
  producto: { label: 'Producto', icon: Package },
  proceso: { label: 'Proceso', icon: Activity },
  sistema: { label: 'Sistema', icon: Clipboard },
  proveedor: { label: 'Proveedor', icon: Building2 },
  cliente: { label: 'Cliente', icon: Users },
};

const ORIGEN_CONFIG: Record<OrigenNCR, { label: string }> = {
  inspeccion_recepcion: { label: 'Inspección de Recepción' },
  inspeccion_proceso: { label: 'Inspección en Proceso' },
  auditoria: { label: 'Auditoría' },
  cliente: { label: 'Reclamo Cliente' },
  interno: { label: 'Detección Interna' },
};

const DISPOSICION_CONFIG: Record<DisposicionNCR, { label: string; descripcion: string }> = {
  usar: { label: 'Usar Como Está', descripcion: 'Aceptar sin modificaciones' },
  retrabajo: { label: 'Retrabajo', descripcion: 'Reprocesar para cumplir especificaciones' },
  reparar: { label: 'Reparar', descripcion: 'Corregir defectos específicos' },
  rechazar: { label: 'Rechazar', descripcion: 'No aceptar el material/producto' },
  devolver: { label: 'Devolver', descripcion: 'Retornar al proveedor' },
  concesion: { label: 'Concesión', descripcion: 'Aceptar con aprobación especial' },
  scrap: { label: 'Scrap', descripcion: 'Desechar/destruir' },
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

const formatearNumeroNCR = (secuencia: number): string => {
  const year = new Date().getFullYear();
  return `NCR-${year}-${secuencia.toString().padStart(5, '0')}`;
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function NoConformidades() {
  // Estado principal
  const [loading, setLoading] = useState(true);
  const [vistaActiva, setVistaActiva] = useState<VistaActiva>('lista');
  const [ncrSeleccionada, setNcrSeleccionada] = useState<NoConformidad | null>(null);
  
  // Datos
  const [ncrs, setNcrs] = useState<NoConformidad[]>([]);
  const [proveedores, setProveedores] = useState<{ id: string; nombre: string }[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nombre: string }[]>([]);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('activas');
  const [filtroSeveridad, setFiltroSeveridad] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>('todos');
  
  // Form
  const [formData, setFormData] = useState<NCRFormData>({
    tipo: 'producto',
    origen: 'interno',
    severidad: 'menor',
    titulo: '',
    descripcion: '',
  });
  
  // UI
  const [showFilters, setShowFilters] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nuevoComentario, setNuevoComentario] = useState('');

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
        loadNCRs(),
        loadProveedores(),
        loadClientes(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadNCRs = async () => {
    const { data, error } = await supabase
      .from('qms_no_conformidades')
      .select('*')
      .order('fecha_deteccion', { ascending: false })
      .limit(500);

    if (!error && data) {
      setNcrs(data);
    }
  };

  const loadProveedores = async () => {
    const { data } = await supabase
      .from('proveedores')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre');
    if (data) setProveedores(data);
  };

  const loadClientes = async () => {
    const { data } = await supabase
      .from('clientes')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre');
    if (data) setClientes(data);
  };

  // ============================================
  // FILTRADO
  // ============================================

  const ncrsFiltradas = useMemo(() => {
    return ncrs.filter(ncr => {
      // Búsqueda
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchNumero = ncr.numero?.toLowerCase().includes(search);
        const matchTitulo = ncr.titulo?.toLowerCase().includes(search);
        const matchProducto = ncr.producto_codigo?.toLowerCase().includes(search);
        const matchProveedor = ncr.proveedor_nombre?.toLowerCase().includes(search);
        if (!matchNumero && !matchTitulo && !matchProducto && !matchProveedor) return false;
      }
      
      // Filtro estado
      if (filtroEstado === 'activas') {
        if (['cerrada', 'cancelada'].includes(ncr.estado)) return false;
      } else if (filtroEstado !== 'todos' && ncr.estado !== filtroEstado) {
        return false;
      }
      
      // Filtro severidad
      if (filtroSeveridad !== 'todos' && ncr.severidad !== filtroSeveridad) return false;
      
      // Filtro tipo
      if (filtroTipo !== 'todos' && ncr.tipo !== filtroTipo) return false;
      
      // Filtro período
      if (filtroPeriodo !== 'todos') {
        const fecha = new Date(ncr.fecha_deteccion);
        const hoy = new Date();
        
        switch (filtroPeriodo) {
          case 'hoy':
            if (fecha.toDateString() !== hoy.toDateString()) return false;
            break;
          case 'semana':
            const inicioSemana = new Date(hoy);
            inicioSemana.setDate(hoy.getDate() - hoy.getDay());
            if (fecha < inicioSemana) return false;
            break;
          case 'mes':
            if (fecha.getMonth() !== hoy.getMonth() || fecha.getFullYear() !== hoy.getFullYear()) return false;
            break;
        }
      }
      
      return true;
    });
  }, [ncrs, searchTerm, filtroEstado, filtroSeveridad, filtroTipo, filtroPeriodo]);

  // ============================================
  // ESTADÍSTICAS
  // ============================================

  const stats = useMemo(() => {
    const activas = ncrs.filter(n => !['cerrada', 'cancelada'].includes(n.estado));
    const criticas = activas.filter(n => n.severidad === 'critica').length;
    const mayores = activas.filter(n => n.severidad === 'mayor').length;
    const vencidas = activas.filter(n => {
      const dias = getDiasRestantes(n.fecha_objetivo);
      return dias !== null && dias < 0;
    }).length;
    const porVencer = activas.filter(n => {
      const dias = getDiasRestantes(n.fecha_objetivo);
      return dias !== null && dias >= 0 && dias <= 7;
    }).length;
    const costoTotal = activas.reduce((sum, n) => sum + (n.costo_estimado || 0), 0);
    const esteMes = ncrs.filter(n => {
      const fecha = new Date(n.fecha_deteccion);
      const hoy = new Date();
      return fecha.getMonth() === hoy.getMonth() && fecha.getFullYear() === hoy.getFullYear();
    }).length;
    
    // Por tipo
    const porTipo = {
      producto: activas.filter(n => n.tipo === 'producto').length,
      proceso: activas.filter(n => n.tipo === 'proceso').length,
      proveedor: activas.filter(n => n.tipo === 'proveedor').length,
      cliente: activas.filter(n => n.tipo === 'cliente').length,
      sistema: activas.filter(n => n.tipo === 'sistema').length,
    };
    
    return { 
      total: activas.length, 
      criticas, 
      mayores, 
      vencidas, 
      porVencer, 
      costoTotal, 
      esteMes,
      porTipo 
    };
  }, [ncrs]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleNuevaNCR = () => {
    setFormData({
      tipo: 'producto',
      origen: 'interno',
      severidad: 'menor',
      titulo: '',
      descripcion: '',
    });
    setVistaActiva('nueva');
  };

  const handleVerDetalle = async (ncr: NoConformidad) => {
    // Cargar datos relacionados si es necesario
    setNcrSeleccionada(ncr);
    setVistaActiva('detalle');
  };

  const handleEditarNCR = (ncr: NoConformidad) => {
    setFormData({
      tipo: ncr.tipo,
      origen: ncr.origen,
      severidad: ncr.severidad,
      titulo: ncr.titulo,
      descripcion: ncr.descripcion,
      producto_codigo: ncr.producto_codigo,
      producto_descripcion: ncr.producto_descripcion,
      lote_numero: ncr.lote_numero,
      proveedor_id: ncr.proveedor_id,
      proveedor_nombre: ncr.proveedor_nombre,
      cliente_id: ncr.cliente_id,
      cliente_nombre: ncr.cliente_nombre,
      cantidad_afectada: ncr.cantidad_afectada,
      costo_estimado: ncr.costo_estimado,
      fecha_objetivo: ncr.fecha_objetivo,
      responsable: ncr.responsable,
      evidencia: ncr.evidencia,
    });
    setNcrSeleccionada(ncr);
    setVistaActiva('editar');
  };

  const handleGuardarNCR = async () => {
    try {
      setSaving(true);
      
      if (vistaActiva === 'nueva') {
        // Generar número
        const { data: lastNCR } = await supabase
          .from('qms_no_conformidades')
          .select('numero')
          .order('creado_at', { ascending: false })
          .limit(1)
          .single();
        
        const lastSeq = lastNCR?.numero ? parseInt(lastNCR.numero.split('-')[2]) : 0;
        const numero = formatearNumeroNCR(lastSeq + 1);
        
        const { error } = await supabase
          .from('qms_no_conformidades')
          .insert({
            numero,
            ...formData,
            estado: 'abierta',
            fecha_deteccion: new Date().toISOString(),
            detectado_por: 'Usuario Actual', // TODO: usar usuario real
          });
        
        if (error) throw error;
      } else {
        // Actualizar
        const { error } = await supabase
          .from('qms_no_conformidades')
          .update({
            ...formData,
            actualizado_at: new Date().toISOString(),
            actualizado_por: 'Usuario Actual',
          })
          .eq('id', ncrSeleccionada?.id);
        
        if (error) throw error;
      }
      
      await loadNCRs();
      setVistaActiva('lista');
      
    } catch (error) {
      console.error('Error guardando NCR:', error);
      alert('Error al guardar la NCR');
    } finally {
      setSaving(false);
    }
  };

  const handleCambiarEstado = async (ncrId: string, nuevoEstado: EstadoNCR) => {
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
        .from('qms_no_conformidades')
        .update(updates)
        .eq('id', ncrId);
      
      if (error) throw error;
      
      await loadNCRs();
      if (ncrSeleccionada?.id === ncrId) {
        setNcrSeleccionada({ ...ncrSeleccionada, ...updates });
      }
      
    } catch (error) {
      console.error('Error cambiando estado:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDisposicion = async (ncrId: string, disposicion: DisposicionNCR, detalle?: string) => {
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('qms_no_conformidades')
        .update({
          disposicion,
          disposicion_detalle: detalle,
          disposicion_fecha: new Date().toISOString(),
          disposicion_por: 'Usuario Actual',
          estado: 'en_implementacion',
          actualizado_at: new Date().toISOString(),
        })
        .eq('id', ncrId);
      
      if (error) throw error;
      
      await loadNCRs();
      
    } catch (error) {
      console.error('Error aplicando disposición:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCrearCAPA = async (ncr: NoConformidad) => {
    // TODO: Navegar a crear CAPA vinculada a esta NCR
    alert(`Crear CAPA vinculada a ${ncr.numero} - Funcionalidad próximamente`);
  };

  const handleAgregarComentario = async () => {
    if (!nuevoComentario.trim() || !ncrSeleccionada) return;
    
    try {
      const comentarios = ncrSeleccionada.comentarios || [];
      comentarios.push({
        id: Date.now().toString(),
        usuario: 'Usuario Actual',
        contenido: nuevoComentario,
        fecha: new Date().toISOString(),
      });
      
      await supabase
        .from('qms_no_conformidades')
        .update({ comentarios })
        .eq('id', ncrSeleccionada.id);
      
      setNcrSeleccionada({ ...ncrSeleccionada, comentarios });
      setNuevoComentario('');
      
    } catch (error) {
      console.error('Error agregando comentario:', error);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-8 w-8 animate-spin text-orange-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ==================== VISTA LISTA ==================== */}
      {vistaActiva === 'lista' && (
        <>
          {/* Header con stats */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-orange-400" />
                No Conformidades (NCR)
              </h3>
              <p className="text-slate-400 text-sm mt-1">
                Gestión de desviaciones y no conformidades del sistema de calidad
              </p>
            </div>
            
            {/* Stats rápidos */}
            <div className="flex gap-3">
              <div className={`px-4 py-2 rounded-xl ${stats.criticas > 0 ? 'bg-red-500/20 border border-red-500/30' : 'bg-slate-800/50 border border-slate-700/50'}`}>
                <div className="text-xs text-red-400">Críticas</div>
                <div className={`text-xl font-bold ${stats.criticas > 0 ? 'text-red-400' : 'text-slate-500'}`}>{stats.criticas}</div>
              </div>
              <div className="px-4 py-2 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                <div className="text-xs text-orange-400">Abiertas</div>
                <div className="text-xl font-bold text-orange-400">{stats.total}</div>
              </div>
              <div className={`px-4 py-2 rounded-xl ${stats.vencidas > 0 ? 'bg-red-500/10 border border-red-500/30' : 'bg-slate-800/50 border border-slate-700/50'}`}>
                <div className="text-xs text-slate-400">Vencidas</div>
                <div className={`text-xl font-bold ${stats.vencidas > 0 ? 'text-red-400' : 'text-slate-500'}`}>{stats.vencidas}</div>
              </div>
              <div className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl">
                <div className="text-xs text-slate-400">Costo Est.</div>
                <div className="text-xl font-bold text-slate-300">${stats.costoTotal.toLocaleString()}</div>
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
                  placeholder="Buscar por número, título, producto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>
              
              {/* Filtro rápido de estado */}
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
              
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-xl border transition-colors ${
                  showFilters ? 'bg-orange-600 border-orange-500 text-white' : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Filter className="h-4 w-4" />
              </button>
              
              <button
                onClick={loadNCRs}
                className="p-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-400 hover:text-slate-200 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            
            <button
              onClick={handleNuevaNCR}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-medium transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nueva NCR
            </button>
          </div>

          {/* Filtros expandibles */}
          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Severidad</label>
                <select
                  value={filtroSeveridad}
                  onChange={(e) => setFiltroSeveridad(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100"
                >
                  <option value="todos">Todas</option>
                  <option value="critica">Críticas</option>
                  <option value="mayor">Mayores</option>
                  <option value="menor">Menores</option>
                  <option value="observacion">Observaciones</option>
                </select>
              </div>
              
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Tipo</label>
                <select
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100"
                >
                  <option value="todos">Todos</option>
                  <option value="producto">Producto</option>
                  <option value="proceso">Proceso</option>
                  <option value="proveedor">Proveedor</option>
                  <option value="cliente">Cliente</option>
                  <option value="sistema">Sistema</option>
                </select>
              </div>
              
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Período</label>
                <select
                  value={filtroPeriodo}
                  onChange={(e) => setFiltroPeriodo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100"
                >
                  <option value="todos">Todo el historial</option>
                  <option value="hoy">Hoy</option>
                  <option value="semana">Esta semana</option>
                  <option value="mes">Este mes</option>
                </select>
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setFiltroEstado('activas');
                    setFiltroSeveridad('todos');
                    setFiltroTipo('todos');
                    setFiltroPeriodo('todos');
                    setSearchTerm('');
                  }}
                  className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
                >
                  Limpiar filtros
                </button>
              </div>
            </div>
          )}

          {/* Lista de NCRs */}
          <div className="space-y-3">
            {ncrsFiltradas.map(ncr => {
              const severidadConfig = SEVERIDAD_CONFIG[ncr.severidad];
              const estadoConfig = ESTADO_CONFIG[ncr.estado];
              const tipoConfig = TIPO_CONFIG[ncr.tipo];
              const TipoIcon = tipoConfig.icon;
              const diasRestantes = getDiasRestantes(ncr.fecha_objetivo);
              
              return (
                <div 
                  key={ncr.id} 
                  className={`bg-slate-900/50 border rounded-xl p-4 hover:border-slate-600 transition-colors cursor-pointer ${
                    ncr.severidad === 'critica' ? 'border-red-500/30' : 'border-slate-800/50'
                  }`}
                  onClick={() => handleVerDetalle(ncr)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className="font-mono text-sm text-orange-400">{ncr.numero}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${severidadConfig.bg} ${severidadConfig.color}`}>
                          {severidadConfig.label}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${estadoConfig.bg} ${estadoConfig.color}`}>
                          {estadoConfig.label}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <TipoIcon className="h-3 w-3" />
                          {tipoConfig.label}
                        </span>
                      </div>
                      
                      {/* Título */}
                      <h4 className="text-slate-200 font-medium mb-1 truncate">{ncr.titulo}</h4>
                      
                      {/* Descripción */}
                      <p className="text-sm text-slate-400 line-clamp-2 mb-3">{ncr.descripcion}</p>
                      
                      {/* Metadata */}
                      <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                        {ncr.producto_codigo && (
                          <span className="flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            {ncr.producto_codigo}
                          </span>
                        )}
                        {ncr.proveedor_nombre && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {ncr.proveedor_nombre}
                          </span>
                        )}
                        {ncr.responsable && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {ncr.responsable}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(ncr.fecha_deteccion)}
                        </span>
                        {diasRestantes !== null && (
                          <span className={`flex items-center gap-1 font-medium ${
                            diasRestantes < 0 ? 'text-red-400' : 
                            diasRestantes <= 3 ? 'text-amber-400' : 
                            diasRestantes <= 7 ? 'text-yellow-400' : ''
                          }`}>
                            <Clock className="h-3 w-3" />
                            {diasRestantes < 0 
                              ? `Vencida hace ${Math.abs(diasRestantes)}d`
                              : `${diasRestantes}d restantes`
                            }
                          </span>
                        )}
                        {ncr.costo_estimado && ncr.costo_estimado > 0 && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            ${ncr.costo_estimado.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Acciones */}
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleVerDetalle(ncr)}
                        className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                        title="Ver detalle"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEditarNCR(ncr)}
                        className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      {!ncr.capas?.length && ncr.estado !== 'cerrada' && (
                        <button
                          onClick={() => handleCrearCAPA(ncr)}
                          className="p-1.5 hover:bg-purple-500/20 rounded-lg text-purple-400 transition-colors"
                          title="Crear CAPA"
                        >
                          <Target className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {ncrsFiltradas.length === 0 && (
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-12 text-center">
                {filtroEstado === 'activas' && ncrs.filter(n => !['cerrada', 'cancelada'].includes(n.estado)).length === 0 ? (
                  <>
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-emerald-400" />
                    <p className="text-slate-400">No hay NCRs activas</p>
                    <p className="text-sm text-slate-500 mt-1">¡Excelente trabajo en calidad!</p>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-slate-600" />
                    <p className="text-slate-400">No se encontraron NCRs</p>
                    <p className="text-sm text-slate-500 mt-1">Intenta ajustar los filtros</p>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ==================== VISTA NUEVA/EDITAR ==================== */}
      {(vistaActiva === 'nueva' || vistaActiva === 'editar') && (
        <NCRForm
          formData={formData}
          setFormData={setFormData}
          proveedores={proveedores}
          clientes={clientes}
          onGuardar={handleGuardarNCR}
          onCancelar={() => setVistaActiva('lista')}
          saving={saving}
          isEditing={vistaActiva === 'editar'}
        />
      )}

      {/* ==================== VISTA DETALLE ==================== */}
      {vistaActiva === 'detalle' && ncrSeleccionada && (
        <NCRDetalle
          ncr={ncrSeleccionada}
          onVolver={() => setVistaActiva('lista')}
          onEditar={() => handleEditarNCR(ncrSeleccionada)}
          onCambiarEstado={handleCambiarEstado}
          onDisposicion={handleDisposicion}
          onCrearCAPA={handleCrearCAPA}
          onAgregarComentario={handleAgregarComentario}
          nuevoComentario={nuevoComentario}
          setNuevoComentario={setNuevoComentario}
          saving={saving}
        />
      )}
    </div>
  );
}

// ============================================
// SUB-COMPONENTE: FORMULARIO NCR
// ============================================

interface NCRFormProps {
  formData: NCRFormData;
  setFormData: React.Dispatch<React.SetStateAction<NCRFormData>>;
  proveedores: { id: string; nombre: string }[];
  clientes: { id: string; nombre: string }[];
  onGuardar: () => void;
  onCancelar: () => void;
  saving: boolean;
  isEditing: boolean;
}

function NCRForm({ formData, setFormData, proveedores, clientes, onGuardar, onCancelar, saving, isEditing }: NCRFormProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancelar}
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <div>
            <h3 className="text-xl font-bold text-slate-100">
              {isEditing ? 'Editar NCR' : 'Nueva No Conformidad'}
            </h3>
            <p className="text-sm text-slate-400">
              {isEditing ? 'Modificar datos de la NCR' : 'Registrar una nueva no conformidad'}
            </p>
          </div>
        </div>
      </div>

      {/* Formulario */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6 space-y-6">
        {/* Clasificación */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Tipo *</label>
            <select
              value={formData.tipo}
              onChange={(e) => setFormData(prev => ({ ...prev, tipo: e.target.value as TipoNCR }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            >
              {Object.entries(TIPO_CONFIG).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Origen *</label>
            <select
              value={formData.origen}
              onChange={(e) => setFormData(prev => ({ ...prev, origen: e.target.value as OrigenNCR }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            >
              {Object.entries(ORIGEN_CONFIG).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Severidad *</label>
            <select
              value={formData.severidad}
              onChange={(e) => setFormData(prev => ({ ...prev, severidad: e.target.value as SeveridadNCR }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            >
              {Object.entries(SEVERIDAD_CONFIG).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Título y descripción */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Título *</label>
          <input
            type="text"
            value={formData.titulo}
            onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            placeholder="Descripción breve del problema"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Descripción Detallada *</label>
          <textarea
            value={formData.descripcion}
            onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
            rows={4}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 resize-none"
            placeholder="Describa el problema en detalle: qué ocurrió, cuándo, dónde, cómo se detectó..."
          />
        </div>

        {/* Referencias */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Código Producto</label>
            <input
              type="text"
              value={formData.producto_codigo || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, producto_codigo: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="Ej: PROD-001"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Número de Lote</label>
            <input
              type="text"
              value={formData.lote_numero || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, lote_numero: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="Ej: LOT-2024-001"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Proveedor</label>
            <select
              value={formData.proveedor_id || ''}
              onChange={(e) => {
                const prov = proveedores.find(p => p.id === e.target.value);
                setFormData(prev => ({ 
                  ...prev, 
                  proveedor_id: e.target.value,
                  proveedor_nombre: prov?.nombre
                }));
              }}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            >
              <option value="">Seleccionar...</option>
              {proveedores.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Cantidades y costos */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Cantidad Afectada</label>
            <input
              type="number"
              value={formData.cantidad_afectada || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, cantidad_afectada: parseInt(e.target.value) || undefined }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="0"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Unidad</label>
            <input
              type="text"
              value={formData.unidad_medida || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, unidad_medida: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="Ej: unidades, kg"
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
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Fecha Objetivo</label>
            <input
              type="date"
              value={formData.fecha_objetivo?.split('T')[0] || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, fecha_objetivo: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            />
          </div>
        </div>

        {/* Responsable y evidencia */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Responsable</label>
            <input
              type="text"
              value={formData.responsable || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, responsable: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="Nombre del responsable de resolver"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Evidencia</label>
            <input
              type="text"
              value={formData.evidencia || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, evidencia: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="Descripción de la evidencia recolectada"
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
          disabled={saving || !formData.titulo || !formData.descripcion}
          className="flex items-center gap-2 px-6 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-medium transition-colors"
        >
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isEditing ? 'Guardar Cambios' : 'Crear NCR'}
        </button>
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTE: DETALLE NCR
// ============================================

interface NCRDetalleProps {
  ncr: NoConformidad;
  onVolver: () => void;
  onEditar: () => void;
  onCambiarEstado: (id: string, estado: EstadoNCR) => void;
  onDisposicion: (id: string, disposicion: DisposicionNCR, detalle?: string) => void;
  onCrearCAPA: (ncr: NoConformidad) => void;
  onAgregarComentario: () => void;
  nuevoComentario: string;
  setNuevoComentario: (v: string) => void;
  saving: boolean;
}

function NCRDetalle({ 
  ncr, onVolver, onEditar, onCambiarEstado, onDisposicion, onCrearCAPA,
  onAgregarComentario, nuevoComentario, setNuevoComentario, saving 
}: NCRDetalleProps) {
  const [showDisposicion, setShowDisposicion] = useState(false);
  const [disposicionSeleccionada, setDisposicionSeleccionada] = useState<DisposicionNCR | ''>('');
  const [disposicionDetalle, setDisposicionDetalle] = useState('');
  
  const severidadConfig = SEVERIDAD_CONFIG[ncr.severidad];
  const estadoConfig = ESTADO_CONFIG[ncr.estado];
  const tipoConfig = TIPO_CONFIG[ncr.tipo];
  const TipoIcon = tipoConfig.icon;
  const diasRestantes = getDiasRestantes(ncr.fecha_objetivo);

  const siguienteEstado: Partial<Record<EstadoNCR, EstadoNCR>> = {
    abierta: 'en_analisis',
    en_analisis: 'en_implementacion',
    en_implementacion: 'verificacion',
    verificacion: 'cerrada',
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
              <h3 className="text-xl font-bold text-slate-100">{ncr.numero}</h3>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${severidadConfig.bg} ${severidadConfig.color}`}>
                {severidadConfig.label}
              </span>
              <span className={`px-2 py-1 rounded-full text-xs ${estadoConfig.bg} ${estadoConfig.color}`}>
                {estadoConfig.label}
              </span>
            </div>
            <p className="text-sm text-slate-400 flex items-center gap-2 mt-1">
              <TipoIcon className="h-4 w-4" />
              {tipoConfig.label} • {ORIGEN_CONFIG[ncr.origen]?.label}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={onEditar}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition-colors"
          >
            <Edit className="h-4 w-4" />
            Editar
          </button>
          {ncr.estado !== 'cerrada' && ncr.estado !== 'cancelada' && (
            <button
              onClick={() => onCrearCAPA(ncr)}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-white transition-colors"
            >
              <Target className="h-4 w-4" />
              Crear CAPA
            </button>
          )}
        </div>
      </div>

      {/* Contenido principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Descripción */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <h4 className="font-semibold text-slate-200 mb-3">{ncr.titulo}</h4>
            <p className="text-slate-400 whitespace-pre-wrap">{ncr.descripcion}</p>
            
            {ncr.evidencia && (
              <div className="mt-4 pt-4 border-t border-slate-800">
                <h5 className="text-sm font-medium text-slate-300 mb-2">Evidencia</h5>
                <p className="text-sm text-slate-400">{ncr.evidencia}</p>
              </div>
            )}
          </div>

          {/* Disposición */}
          {ncr.estado !== 'cerrada' && ncr.estado !== 'cancelada' && !ncr.disposicion && (
            <div className="bg-slate-900/50 border border-amber-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-slate-200 flex items-center gap-2">
                  <Flag className="h-5 w-5 text-amber-400" />
                  Definir Disposición
                </h4>
                <button
                  onClick={() => setShowDisposicion(!showDisposicion)}
                  className="text-sm text-amber-400 hover:text-amber-300"
                >
                  {showDisposicion ? 'Cancelar' : 'Seleccionar'}
                </button>
              </div>
              
              {showDisposicion && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(DISPOSICION_CONFIG).map(([key, val]) => (
                      <button
                        key={key}
                        onClick={() => setDisposicionSeleccionada(key as DisposicionNCR)}
                        className={`p-3 rounded-lg border text-left transition-colors ${
                          disposicionSeleccionada === key
                            ? 'border-amber-500 bg-amber-500/10'
                            : 'border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        <div className="font-medium text-slate-200 text-sm">{val.label}</div>
                        <div className="text-xs text-slate-500 mt-1">{val.descripcion}</div>
                      </button>
                    ))}
                  </div>
                  
                  {disposicionSeleccionada && (
                    <>
                      <textarea
                        value={disposicionDetalle}
                        onChange={(e) => setDisposicionDetalle(e.target.value)}
                        placeholder="Detalle de la disposición (opcional)"
                        rows={2}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 resize-none"
                      />
                      <button
                        onClick={() => {
                          onDisposicion(ncr.id, disposicionSeleccionada, disposicionDetalle);
                          setShowDisposicion(false);
                          setDisposicionSeleccionada('');
                          setDisposicionDetalle('');
                        }}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Aplicar Disposición
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Disposición aplicada */}
          {ncr.disposicion && (
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h4 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <Flag className="h-5 w-5 text-emerald-400" />
                Disposición Aplicada
              </h4>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg font-medium">
                  {DISPOSICION_CONFIG[ncr.disposicion]?.label}
                </span>
                <span className="text-sm text-slate-500">
                  por {ncr.disposicion_por} el {formatDate(ncr.disposicion_fecha)}
                </span>
              </div>
              {ncr.disposicion_detalle && (
                <p className="text-sm text-slate-400">{ncr.disposicion_detalle}</p>
              )}
            </div>
          )}

          {/* Análisis de causa raíz */}
          {ncr.causa_raiz && (
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h4 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <Zap className="h-5 w-5 text-purple-400" />
                Análisis de Causa Raíz
              </h4>
              <p className="text-slate-400">{ncr.causa_raiz}</p>
              {ncr.metodo_analisis && (
                <p className="text-sm text-slate-500 mt-2">Método: {ncr.metodo_analisis}</p>
              )}
            </div>
          )}

          {/* Comentarios */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <h4 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-400" />
              Comentarios ({ncr.comentarios?.length || 0})
            </h4>
            
            <div className="space-y-3 mb-4">
              {ncr.comentarios?.map(com => (
                <div key={com.id} className="p-3 bg-slate-800/50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-300">{com.usuario}</span>
                    <span className="text-xs text-slate-500">{formatDateTime(com.fecha)}</span>
                  </div>
                  <p className="text-sm text-slate-400">{com.contenido}</p>
                </div>
              ))}
              
              {(!ncr.comentarios || ncr.comentarios.length === 0) && (
                <p className="text-sm text-slate-500 text-center py-4">No hay comentarios</p>
              )}
            </div>
            
            {ncr.estado !== 'cerrada' && ncr.estado !== 'cancelada' && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nuevoComentario}
                  onChange={(e) => setNuevoComentario(e.target.value)}
                  placeholder="Agregar comentario..."
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100"
                  onKeyDown={(e) => e.key === 'Enter' && onAgregarComentario()}
                />
                <button
                  onClick={onAgregarComentario}
                  disabled={!nuevoComentario.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white rounded-lg"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Info card */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 space-y-4">
            {ncr.producto_codigo && (
              <div>
                <label className="text-xs text-slate-500">Producto</label>
                <div className="font-mono text-slate-200">{ncr.producto_codigo}</div>
                {ncr.producto_descripcion && (
                  <div className="text-sm text-slate-400 truncate">{ncr.producto_descripcion}</div>
                )}
              </div>
            )}
            
            {ncr.lote_numero && (
              <div>
                <label className="text-xs text-slate-500">Lote</label>
                <div className="font-mono text-slate-200">{ncr.lote_numero}</div>
              </div>
            )}
            
            {ncr.proveedor_nombre && (
              <div>
                <label className="text-xs text-slate-500">Proveedor</label>
                <div className="text-slate-200">{ncr.proveedor_nombre}</div>
              </div>
            )}
            
            {ncr.cliente_nombre && (
              <div>
                <label className="text-xs text-slate-500">Cliente</label>
                <div className="text-slate-200">{ncr.cliente_nombre}</div>
              </div>
            )}
            
            {ncr.cantidad_afectada && (
              <div>
                <label className="text-xs text-slate-500">Cantidad Afectada</label>
                <div className="text-slate-200">{ncr.cantidad_afectada} {ncr.unidad_medida}</div>
              </div>
            )}
            
            {ncr.costo_estimado && (
              <div>
                <label className="text-xs text-slate-500">Costo Estimado</label>
                <div className="text-slate-200 font-medium">${ncr.costo_estimado.toLocaleString()}</div>
              </div>
            )}
            
            <div>
              <label className="text-xs text-slate-500">Fecha Detección</label>
              <div className="text-slate-200">{formatDate(ncr.fecha_deteccion)}</div>
            </div>
            
            {ncr.fecha_objetivo && (
              <div>
                <label className="text-xs text-slate-500">Fecha Objetivo</label>
                <div className={`font-medium ${
                  diasRestantes !== null && diasRestantes < 0 ? 'text-red-400' :
                  diasRestantes !== null && diasRestantes <= 7 ? 'text-amber-400' : 'text-slate-200'
                }`}>
                  {formatDate(ncr.fecha_objetivo)}
                  {diasRestantes !== null && (
                    <span className="text-xs ml-2">
                      ({diasRestantes < 0 ? `Vencida` : `${diasRestantes}d`})
                    </span>
                  )}
                </div>
              </div>
            )}
            
            {ncr.responsable && (
              <div>
                <label className="text-xs text-slate-500">Responsable</label>
                <div className="text-slate-200">{ncr.responsable}</div>
              </div>
            )}
            
            <div>
              <label className="text-xs text-slate-500">Detectado por</label>
              <div className="text-slate-200">{ncr.detectado_por || '-'}</div>
            </div>
          </div>

          {/* Acciones de estado */}
          {ncr.estado !== 'cerrada' && ncr.estado !== 'cancelada' && (
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h4 className="text-sm font-medium text-slate-300 mb-3">Cambiar Estado</h4>
              <div className="space-y-2">
                {siguienteEstado[ncr.estado] && (
                  <button
                    onClick={() => onCambiarEstado(ncr.id, siguienteEstado[ncr.estado]!)}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <ArrowRight className="h-4 w-4" />
                    Avanzar a {ESTADO_CONFIG[siguienteEstado[ncr.estado]!].label}
                  </button>
                )}
                <button
                  onClick={() => onCambiarEstado(ncr.id, 'cancelada')}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
                >
                  <XCircle className="h-4 w-4" />
                  Cancelar NCR
                </button>
              </div>
            </div>
          )}

          {/* CAPAs vinculadas */}
          {ncr.capas && ncr.capas.length > 0 && (
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                <Target className="h-4 w-4 text-purple-400" />
                CAPAs Vinculadas
              </h4>
              <div className="space-y-2">
                {ncr.capas.map(capa => (
                  <div key={capa.id} className="p-2 bg-slate-800/50 rounded-lg">
                    <div className="font-mono text-sm text-purple-400">{capa.numero}</div>
                    <div className="text-xs text-slate-500 capitalize">{capa.tipo} - {capa.estado}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
              <History className="h-4 w-4 text-slate-400" />
              Historial
            </h4>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="w-2 h-2 mt-2 rounded-full bg-orange-400" />
                <div>
                  <div className="text-sm text-slate-300">NCR creada</div>
                  <div className="text-xs text-slate-500">
                    {formatDateTime(ncr.creado_at)} por {ncr.creado_por || 'Sistema'}
                  </div>
                </div>
              </div>
              {ncr.disposicion_fecha && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 mt-2 rounded-full bg-amber-400" />
                  <div>
                    <div className="text-sm text-slate-300">Disposición aplicada</div>
                    <div className="text-xs text-slate-500">
                      {formatDateTime(ncr.disposicion_fecha)} por {ncr.disposicion_por}
                    </div>
                  </div>
                </div>
              )}
              {ncr.fecha_cierre && (
                <div className="flex gap-3">
                  <div className="w-2 h-2 mt-2 rounded-full bg-emerald-400" />
                  <div>
                    <div className="text-sm text-slate-300">NCR cerrada</div>
                    <div className="text-xs text-slate-500">{formatDateTime(ncr.fecha_cierre)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}