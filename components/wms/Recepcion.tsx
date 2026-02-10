'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Truck, Search, Plus, RefreshCw, Eye, Edit,
  ChevronRight, ChevronDown, X, Save, Check,
  Package, Box, MapPin, ClipboardCheck, AlertTriangle,
  Clock, CheckCircle, XCircle, ArrowRight, Layers,
  Barcode, Calendar, User, FileText, Target,
  Play, Pause, SkipForward, AlertCircle, Zap
} from 'lucide-react';

// ============================================
// TIPOS
// ============================================

type EstadoRecepcion = 'pendiente' | 'en_proceso' | 'parcial' | 'completada' | 'con_diferencias';
type EstadoPutaway = 'pendiente' | 'asignado' | 'en_proceso' | 'completado' | 'cancelado';
type TipoOrigen = 'compra' | 'transferencia' | 'devolucion' | 'produccion';

interface OrdenRecepcion {
  id: string;
  numero: string;
  tipo_origen: TipoOrigen;
  orden_compra_numero?: string;
  proveedor_id?: string;
  proveedor_nombre?: string;
  almacen_id: string;
  almacen_nombre?: string;
  fecha_esperada?: string;
  fecha_recepcion?: string;
  estado: EstadoRecepcion;
  lineas_totales: number;
  lineas_recibidas: number;
  unidades_esperadas: number;
  unidades_recibidas: number;
  guia_remision?: string;
  requiere_inspeccion: boolean;
  notas?: string;
  recibido_por?: string;
  created_at: string;
  lineas?: LineaRecepcion[];
}

interface LineaRecepcion {
  id: string;
  orden_recepcion_id: string;
  producto_id: string;
  producto_codigo: string;
  producto_nombre: string;
  cantidad_esperada: number;
  cantidad_recibida: number;
  cantidad_rechazada: number;
  unidad_medida: string;
  lote_numero?: string;
  fecha_vencimiento?: string;
  estado: 'pendiente' | 'parcial' | 'completa' | 'con_diferencias';
  putaway_completado: boolean;
  notas?: string;
}

interface TareaPutaway {
  id: string;
  orden_recepcion_id: string;
  linea_recepcion_id: string;
  producto_id: string;
  producto_codigo: string;
  producto_nombre: string;
  lote_numero?: string;
  cantidad: number;
  unidad_medida: string;
  ubicacion_origen_codigo?: string;
  ubicacion_destino_id: string;
  ubicacion_destino_codigo: string;
  razon_sugerencia?: string;
  estado: EstadoPutaway;
  asignado_a?: string;
  fecha_completado?: string;
  ubicacion_real_codigo?: string;
  prioridad: number;
  created_at: string;
}

interface UbicacionSugerida {
  ubicacion_id: string;
  ubicacion_codigo: string;
  zona_nombre: string;
  razon: string;
  score: number;
  disponible: number;
}

type VistaActiva = 'lista' | 'nueva' | 'detalle' | 'recibir' | 'putaway';

// ============================================
// CONFIGURACIONES
// ============================================

const ESTADO_RECEPCION_CONFIG: Record<EstadoRecepcion, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pendiente: { label: 'Pendiente', color: 'text-slate-400', bg: 'bg-slate-500/20', icon: Clock },
  en_proceso: { label: 'En Proceso', color: 'text-blue-400', bg: 'bg-blue-500/20', icon: Play },
  parcial: { label: 'Parcial', color: 'text-amber-400', bg: 'bg-amber-500/20', icon: AlertCircle },
  completada: { label: 'Completada', color: 'text-emerald-400', bg: 'bg-emerald-500/20', icon: CheckCircle },
  con_diferencias: { label: 'Con Diferencias', color: 'text-red-400', bg: 'bg-red-500/20', icon: AlertTriangle },
};

const ESTADO_PUTAWAY_CONFIG: Record<EstadoPutaway, { label: string; color: string; bg: string }> = {
  pendiente: { label: 'Pendiente', color: 'text-slate-400', bg: 'bg-slate-500/20' },
  asignado: { label: 'Asignado', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  en_proceso: { label: 'En Proceso', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  completado: { label: 'Completado', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  cancelado: { label: 'Cancelado', color: 'text-red-400', bg: 'bg-red-500/20' },
};

const TIPO_ORIGEN_CONFIG: Record<TipoOrigen, { label: string; color: string }> = {
  compra: { label: 'Orden de Compra', color: 'text-blue-400' },
  transferencia: { label: 'Transferencia', color: 'text-purple-400' },
  devolucion: { label: 'Devolución', color: 'text-orange-400' },
  produccion: { label: 'Producción', color: 'text-emerald-400' },
};

// ============================================
// HELPERS
// ============================================

const formatDate = (date: string | null | undefined): string => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatDateTime = (date: string | null | undefined): string => {
  if (!date) return '-';
  return new Date(date).toLocaleString('es-UY', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const generarNumeroRecepcion = (): string => {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 9000) + 1000;
  return `REC-${year}-${seq}`;
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function Recepcion() {
  const [loading, setLoading] = useState(true);
  const [vistaActiva, setVistaActiva] = useState<VistaActiva>('lista');
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<OrdenRecepcion | null>(null);
  
  const [ordenes, setOrdenes] = useState<OrdenRecepcion[]>([]);
  const [tareasPutaway, setTareasPutaway] = useState<TareaPutaway[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('activas');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  
  // Form nueva recepción
  const [formData, setFormData] = useState({
    tipo_origen: 'compra' as TipoOrigen,
    orden_compra_numero: '',
    proveedor_nombre: '',
    guia_remision: '',
    fecha_esperada: '',
    requiere_inspeccion: false,
    notas: '',
  });
  
  // Recepción de líneas
  const [lineasRecibiendo, setLineasRecibiendo] = useState<Record<string, { cantidad: number; lote?: string; vencimiento?: string }>>({});
  
  const [saving, setSaving] = useState(false);
  const [tabActivo, setTabActivo] = useState<'lineas' | 'putaway' | 'historial'>('lineas');

  // ============================================
  // CARGA DE DATOS
  // ============================================

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Cargar órdenes de recepción
      const { data: ordenesData } = await supabase
        .from('wms_ordenes_recepcion')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (ordenesData) {
        setOrdenes(ordenesData);
      } else {
        // Datos de ejemplo
        setOrdenes([
          {
            id: '1',
            numero: 'REC-2024-0156',
            tipo_origen: 'compra',
            orden_compra_numero: 'OC-2024-0892',
            proveedor_nombre: 'Proveedor ABC S.A.',
            almacen_id: '1',
            almacen_nombre: 'Almacén Principal',
            fecha_esperada: new Date(Date.now() + 86400000).toISOString(),
            estado: 'pendiente',
            lineas_totales: 5,
            lineas_recibidas: 0,
            unidades_esperadas: 500,
            unidades_recibidas: 0,
            guia_remision: 'GR-001234',
            requiere_inspeccion: true,
            created_at: new Date().toISOString(),
            lineas: [
              { id: 'l1', orden_recepcion_id: '1', producto_id: 'p1', producto_codigo: 'SKU-1001', producto_nombre: 'Producto Alpha', cantidad_esperada: 100, cantidad_recibida: 0, cantidad_rechazada: 0, unidad_medida: 'UND', estado: 'pendiente', putaway_completado: false },
              { id: 'l2', orden_recepcion_id: '1', producto_id: 'p2', producto_codigo: 'SKU-1002', producto_nombre: 'Producto Beta', cantidad_esperada: 150, cantidad_recibida: 0, cantidad_rechazada: 0, unidad_medida: 'UND', estado: 'pendiente', putaway_completado: false },
              { id: 'l3', orden_recepcion_id: '1', producto_id: 'p3', producto_codigo: 'SKU-1003', producto_nombre: 'Producto Gamma', cantidad_esperada: 250, cantidad_recibida: 0, cantidad_rechazada: 0, unidad_medida: 'UND', estado: 'pendiente', putaway_completado: false },
            ]
          },
          {
            id: '2',
            numero: 'REC-2024-0155',
            tipo_origen: 'compra',
            orden_compra_numero: 'OC-2024-0891',
            proveedor_nombre: 'Distribuidora XYZ',
            almacen_id: '1',
            almacen_nombre: 'Almacén Principal',
            fecha_recepcion: new Date(Date.now() - 3600000).toISOString(),
            estado: 'en_proceso',
            lineas_totales: 3,
            lineas_recibidas: 2,
            unidades_esperadas: 300,
            unidades_recibidas: 200,
            requiere_inspeccion: false,
            created_at: new Date(Date.now() - 86400000).toISOString(),
            lineas: [
              { id: 'l4', orden_recepcion_id: '2', producto_id: 'p4', producto_codigo: 'SKU-2001', producto_nombre: 'Componente X', cantidad_esperada: 100, cantidad_recibida: 100, cantidad_rechazada: 0, unidad_medida: 'UND', lote_numero: 'LOT-2024-001', estado: 'completa', putaway_completado: true },
              { id: 'l5', orden_recepcion_id: '2', producto_id: 'p5', producto_codigo: 'SKU-2002', producto_nombre: 'Componente Y', cantidad_esperada: 100, cantidad_recibida: 100, cantidad_rechazada: 0, unidad_medida: 'UND', lote_numero: 'LOT-2024-002', estado: 'completa', putaway_completado: false },
              { id: 'l6', orden_recepcion_id: '2', producto_id: 'p6', producto_codigo: 'SKU-2003', producto_nombre: 'Componente Z', cantidad_esperada: 100, cantidad_recibida: 0, cantidad_rechazada: 0, unidad_medida: 'UND', estado: 'pendiente', putaway_completado: false },
            ]
          },
          {
            id: '3',
            numero: 'REC-2024-0154',
            tipo_origen: 'devolucion',
            proveedor_nombre: 'Cliente Retail SA',
            almacen_id: '1',
            almacen_nombre: 'Almacén Principal',
            fecha_recepcion: new Date(Date.now() - 172800000).toISOString(),
            estado: 'completada',
            lineas_totales: 2,
            lineas_recibidas: 2,
            unidades_esperadas: 50,
            unidades_recibidas: 48,
            requiere_inspeccion: true,
            created_at: new Date(Date.now() - 172800000).toISOString(),
          },
        ]);
      }

      // Cargar tareas de putaway
      const { data: putawayData } = await supabase
        .from('wms_tareas_putaway')
        .select('*')
        .in('estado', ['pendiente', 'asignado', 'en_proceso'])
        .order('prioridad', { ascending: true });
      
      if (putawayData) {
        setTareasPutaway(putawayData);
      } else {
        setTareasPutaway([
          {
            id: 't1',
            orden_recepcion_id: '2',
            linea_recepcion_id: 'l5',
            producto_id: 'p5',
            producto_codigo: 'SKU-2002',
            producto_nombre: 'Componente Y',
            lote_numero: 'LOT-2024-002',
            cantidad: 100,
            unidad_medida: 'UND',
            ubicacion_origen_codigo: 'REC-01',
            ubicacion_destino_id: 'ub1',
            ubicacion_destino_codigo: 'A-03-02-01',
            razon_sugerencia: 'Misma familia de productos',
            estado: 'pendiente',
            prioridad: 1,
            created_at: new Date().toISOString(),
          }
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // FILTRADO
  // ============================================

  const ordenesFiltradas = useMemo(() => {
    return ordenes.filter(orden => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!orden.numero?.toLowerCase().includes(search) &&
            !orden.proveedor_nombre?.toLowerCase().includes(search) &&
            !orden.orden_compra_numero?.toLowerCase().includes(search)) return false;
      }
      
      if (filtroEstado === 'activas') {
        if (['completada'].includes(orden.estado)) return false;
      } else if (filtroEstado !== 'todos' && orden.estado !== filtroEstado) {
        return false;
      }
      
      if (filtroTipo !== 'todos' && orden.tipo_origen !== filtroTipo) return false;
      
      return true;
    });
  }, [ordenes, searchTerm, filtroEstado, filtroTipo]);

  // ============================================
  // ESTADÍSTICAS
  // ============================================

  const stats = useMemo(() => {
    const pendientes = ordenes.filter(o => o.estado === 'pendiente').length;
    const enProceso = ordenes.filter(o => o.estado === 'en_proceso').length;
    const hoy = new Date().toISOString().split('T')[0];
    const recibidasHoy = ordenes.filter(o => o.fecha_recepcion?.startsWith(hoy)).length;
    const tareasPendientes = tareasPutaway.filter(t => t.estado === 'pendiente').length;
    
    return { pendientes, enProceso, recibidasHoy, tareasPendientes };
  }, [ordenes, tareasPutaway]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleVerDetalle = (orden: OrdenRecepcion) => {
    setOrdenSeleccionada(orden);
    setTabActivo('lineas');
    setVistaActiva('detalle');
  };

  const handleIniciarRecepcion = (orden: OrdenRecepcion) => {
    setOrdenSeleccionada(orden);
    // Inicializar cantidades a recibir
    const inicial: Record<string, { cantidad: number; lote?: string; vencimiento?: string }> = {};
    orden.lineas?.forEach(linea => {
      inicial[linea.id] = { 
        cantidad: linea.cantidad_esperada - linea.cantidad_recibida,
        lote: linea.lote_numero,
        vencimiento: linea.fecha_vencimiento?.split('T')[0]
      };
    });
    setLineasRecibiendo(inicial);
    setVistaActiva('recibir');
  };

  const handleConfirmarRecepcion = async () => {
    if (!ordenSeleccionada) return;
    
    setSaving(true);
    try {
      // Actualizar líneas recibidas
      const lineasActualizadas: LineaRecepcion[] | undefined = ordenSeleccionada.lineas?.map(linea => {
        const recibido = lineasRecibiendo[linea.id];
        if (!recibido) return linea;
        
        const nuevaCantidad = linea.cantidad_recibida + recibido.cantidad;
        const nuevoEstadoLinea: 'pendiente' | 'parcial' | 'completa' | 'con_diferencias' = 
          nuevaCantidad >= linea.cantidad_esperada ? 'completa' : 
          nuevaCantidad > 0 ? 'parcial' : 'pendiente';
        
        return {
          ...linea,
          cantidad_recibida: nuevaCantidad,
          lote_numero: recibido.lote || linea.lote_numero,
          fecha_vencimiento: recibido.vencimiento || linea.fecha_vencimiento,
          estado: nuevoEstadoLinea,
        };
      });

      // Calcular totales
      const totalRecibido = lineasActualizadas?.reduce((sum, l) => sum + l.cantidad_recibida, 0) || 0;
      const lineasCompletas = lineasActualizadas?.filter(l => l.estado === 'completa').length || 0;
      
      let nuevoEstado: EstadoRecepcion = 'en_proceso';
      if (lineasCompletas === ordenSeleccionada.lineas_totales) {
        nuevoEstado = 'completada';
      } else if (lineasCompletas > 0) {
        nuevoEstado = 'parcial';
      }

      // Actualizar orden local
      const ordenActualizada: OrdenRecepcion = {
        ...ordenSeleccionada,
        lineas: lineasActualizadas || [],
        lineas_recibidas: lineasCompletas,
        unidades_recibidas: totalRecibido,
        estado: nuevoEstado,
        fecha_recepcion: ordenSeleccionada.fecha_recepcion || new Date().toISOString(),
      };

      setOrdenes(prev => prev.map(o => o.id === ordenActualizada.id ? ordenActualizada : o));
      setOrdenSeleccionada(ordenActualizada);

      // Generar tareas de put-away para líneas recibidas
      const nuevasTareas: TareaPutaway[] = [];
      lineasActualizadas?.forEach(linea => {
        const recibido = lineasRecibiendo[linea.id];
        if (recibido && recibido.cantidad > 0 && !linea.putaway_completado) {
          // Sugerir ubicación inteligente
          const sugerencia = sugerirUbicacion(linea.producto_codigo);
          
          nuevasTareas.push({
            id: `put-${linea.id}-${Date.now()}`,
            orden_recepcion_id: ordenSeleccionada.id,
            linea_recepcion_id: linea.id,
            producto_id: linea.producto_id,
            producto_codigo: linea.producto_codigo,
            producto_nombre: linea.producto_nombre,
            lote_numero: recibido.lote,
            cantidad: recibido.cantidad,
            unidad_medida: linea.unidad_medida,
            ubicacion_origen_codigo: 'RECEPCION',
            ubicacion_destino_id: sugerencia.ubicacion_id,
            ubicacion_destino_codigo: sugerencia.ubicacion_codigo,
            razon_sugerencia: sugerencia.razon,
            estado: 'pendiente',
            prioridad: 1,
            created_at: new Date().toISOString(),
          });
        }
      });

      if (nuevasTareas.length > 0) {
        setTareasPutaway(prev => [...nuevasTareas, ...prev]);
      }

      alert(`✅ Recepción confirmada. ${nuevasTareas.length} tarea(s) de put-away generada(s).`);
      setVistaActiva('detalle');
      setTabActivo('putaway');
      
    } finally {
      setSaving(false);
    }
  };

  const sugerirUbicacion = (productoCodigo: string): UbicacionSugerida => {
    // Lógica de sugerencia inteligente (simulada)
    // En producción: buscar ubicaciones con mismo producto, familia, zona ABC, etc.
    const zonas = ['A', 'B', 'C'];
    const zona = zonas[Math.floor(Math.random() * zonas.length)];
    const rack = Math.floor(Math.random() * 10) + 1;
    const nivel = Math.floor(Math.random() * 4) + 1;
    const pos = Math.floor(Math.random() * 3) + 1;
    
    const razones = [
      'Misma familia de productos',
      'Zona de alta rotación (ABC-A)',
      'Ubicación más cercana disponible',
      'FEFO - Optimización por vencimiento',
      'Consolidación de lotes',
    ];
    
    return {
      ubicacion_id: `ub-${zona}-${rack}-${nivel}-${pos}`,
      ubicacion_codigo: `${zona}-${rack.toString().padStart(2, '0')}-${nivel.toString().padStart(2, '0')}-${pos.toString().padStart(2, '0')}`,
      zona_nombre: `Zona ${zona}`,
      razon: razones[Math.floor(Math.random() * razones.length)],
      score: Math.floor(Math.random() * 30) + 70,
      disponible: Math.floor(Math.random() * 100) + 50,
    };
  };

  const handleCompletarPutaway = async (tareaId: string) => {
    setTareasPutaway(prev => prev.map(t => 
      t.id === tareaId 
        ? { ...t, estado: 'completado' as EstadoPutaway, fecha_completado: new Date().toISOString() }
        : t
    ));
  };

  const handleCrearRecepcion = async () => {
    setSaving(true);
    try {
      const nuevaOrden: OrdenRecepcion = {
        id: `rec-${Date.now()}`,
        numero: generarNumeroRecepcion(),
        tipo_origen: formData.tipo_origen,
        orden_compra_numero: formData.orden_compra_numero || undefined,
        proveedor_nombre: formData.proveedor_nombre,
        almacen_id: '1',
        almacen_nombre: 'Almacén Principal',
        fecha_esperada: formData.fecha_esperada || undefined,
        estado: 'pendiente',
        lineas_totales: 0,
        lineas_recibidas: 0,
        unidades_esperadas: 0,
        unidades_recibidas: 0,
        guia_remision: formData.guia_remision || undefined,
        requiere_inspeccion: formData.requiere_inspeccion,
        notas: formData.notas || undefined,
        created_at: new Date().toISOString(),
        lineas: [],
      };

      setOrdenes(prev => [nuevaOrden, ...prev]);
      setOrdenSeleccionada(nuevaOrden);
      setVistaActiva('detalle');
      
    } finally {
      setSaving(false);
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
      {/* ==================== LISTA ==================== */}
      {vistaActiva === 'lista' && (
        <>
          {/* Alerta de tareas pendientes */}
          {stats.tareasPendientes > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-4">
              <div className="p-3 bg-amber-500/20 rounded-xl">
                <MapPin className="h-6 w-6 text-amber-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-amber-400">
                  {stats.tareasPendientes} tarea(s) de Put-away pendiente(s)
                </h4>
                <p className="text-sm text-amber-300/70">
                  Productos esperando ser ubicados en el almacén
                </p>
              </div>
              <button 
                onClick={() => setVistaActiva('putaway')}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-medium"
              >
                Ver Tareas
              </button>
            </div>
          )}

          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Truck className="h-6 w-6 text-amber-400" />
                Recepción de Mercadería
              </h3>
              <p className="text-slate-400 text-sm mt-1">
                Recepción y put-away automático
              </p>
            </div>
            
            <div className="flex gap-3">
              <div className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-center">
                <div className="text-xs text-slate-400">Pendientes</div>
                <div className="text-xl font-bold text-slate-200">{stats.pendientes}</div>
              </div>
              <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-xl text-center">
                <div className="text-xs text-blue-400">En Proceso</div>
                <div className="text-xl font-bold text-blue-400">{stats.enProceso}</div>
              </div>
              <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center">
                <div className="text-xs text-emerald-400">Recibidas Hoy</div>
                <div className="text-xl font-bold text-emerald-400">{stats.recibidasHoy}</div>
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
                  placeholder="Buscar por número, proveedor, OC..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
                />
              </div>
              
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
              >
                <option value="activas">Activas</option>
                <option value="todos">Todas</option>
                <option value="pendiente">Pendientes</option>
                <option value="en_proceso">En Proceso</option>
                <option value="completada">Completadas</option>
              </select>
              
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
              >
                <option value="todos">Todos los tipos</option>
                {Object.entries(TIPO_ORIGEN_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              
              <button onClick={loadData} className="p-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-400 hover:text-slate-200">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            
            <button
              onClick={() => setVistaActiva('nueva')}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium"
            >
              <Plus className="h-4 w-4" />
              Nueva Recepción
            </button>
          </div>

          {/* Lista de órdenes */}
          <div className="space-y-3">
            {ordenesFiltradas.map(orden => {
              const estadoConfig = ESTADO_RECEPCION_CONFIG[orden.estado];
              const EstadoIcon = estadoConfig.icon;
              const tipoConfig = TIPO_ORIGEN_CONFIG[orden.tipo_origen];
              const progreso = orden.unidades_esperadas > 0 
                ? Math.round((orden.unidades_recibidas / orden.unidades_esperadas) * 100) 
                : 0;
              
              return (
                <div 
                  key={orden.id}
                  className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className="font-mono text-sm text-amber-400">{orden.numero}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${estadoConfig.bg} ${estadoConfig.color}`}>
                          {estadoConfig.label}
                        </span>
                        <span className={`text-xs ${tipoConfig.color}`}>{tipoConfig.label}</span>
                        {orden.requiere_inspeccion && (
                          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full text-xs">
                            Req. Inspección
                          </span>
                        )}
                      </div>
                      
                      <h4 className="font-medium text-slate-200 mb-1">{orden.proveedor_nombre}</h4>
                      
                      {orden.orden_compra_numero && (
                        <p className="text-sm text-slate-400 mb-2">OC: {orden.orden_compra_numero}</p>
                      )}
                      
                      {/* Barra de progreso */}
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all ${
                              progreso === 100 ? 'bg-emerald-500' : 
                              progreso > 0 ? 'bg-blue-500' : 'bg-slate-700'
                            }`}
                            style={{ width: `${progreso}%` }}
                          />
                        </div>
                        <span className="text-sm text-slate-400 w-24 text-right">
                          {orden.unidades_recibidas}/{orden.unidades_esperadas} uds
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {orden.fecha_esperada ? `Esperada: ${formatDate(orden.fecha_esperada)}` : 'Sin fecha'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          {orden.lineas_recibidas}/{orden.lineas_totales} líneas
                        </span>
                        {orden.guia_remision && (
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {orden.guia_remision}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleVerDetalle(orden)}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm flex items-center gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        Ver
                      </button>
                      {orden.estado !== 'completada' && (
                        <button
                          onClick={() => handleIniciarRecepcion(orden)}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm flex items-center gap-2"
                        >
                          <ClipboardCheck className="h-4 w-4" />
                          Recibir
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {ordenesFiltradas.length === 0 && (
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-12 text-center">
                <Truck className="h-12 w-12 mx-auto mb-3 text-slate-600" />
                <p className="text-slate-400">No hay órdenes de recepción</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ==================== NUEVA RECEPCIÓN ==================== */}
      {vistaActiva === 'nueva' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setVistaActiva('lista')} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400">
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-xl font-bold text-slate-100">Nueva Orden de Recepción</h3>
          </div>

          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de Origen *</label>
                <select
                  value={formData.tipo_origen}
                  onChange={(e) => setFormData(p => ({ ...p, tipo_origen: e.target.value as TipoOrigen }))}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                >
                  {Object.entries(TIPO_ORIGEN_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Nº Orden de Compra</label>
                <input
                  type="text"
                  value={formData.orden_compra_numero}
                  onChange={(e) => setFormData(p => ({ ...p, orden_compra_numero: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  placeholder="OC-2024-XXXX"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Proveedor / Origen *</label>
              <input
                type="text"
                value={formData.proveedor_nombre}
                onChange={(e) => setFormData(p => ({ ...p, proveedor_nombre: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                placeholder="Nombre del proveedor"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Guía de Remisión</label>
                <input
                  type="text"
                  value={formData.guia_remision}
                  onChange={(e) => setFormData(p => ({ ...p, guia_remision: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  placeholder="GR-XXXXXX"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Fecha Esperada</label>
                <input
                  type="date"
                  value={formData.fecha_esperada}
                  onChange={(e) => setFormData(p => ({ ...p, fecha_esperada: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                />
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.requiere_inspeccion}
                onChange={(e) => setFormData(p => ({ ...p, requiere_inspeccion: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500"
              />
              <span className="text-sm text-slate-300">Requiere inspección de calidad (QC)</span>
            </label>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Notas</label>
              <textarea
                value={formData.notas}
                onChange={(e) => setFormData(p => ({ ...p, notas: e.target.value }))}
                rows={2}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 resize-none"
                placeholder="Observaciones..."
              />
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setVistaActiva('lista')} className="px-4 py-2 text-slate-400">Cancelar</button>
            <button
              onClick={handleCrearRecepcion}
              disabled={saving || !formData.proveedor_nombre}
              className="flex items-center gap-2 px-6 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 text-white rounded-xl font-medium"
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Crear Orden
            </button>
          </div>
        </div>
      )}

      {/* ==================== DETALLE ==================== */}
      {vistaActiva === 'detalle' && ordenSeleccionada && (
        <RecepcionDetalle
          orden={ordenSeleccionada}
          tareasPutaway={tareasPutaway.filter(t => t.orden_recepcion_id === ordenSeleccionada.id)}
          tabActivo={tabActivo}
          setTabActivo={setTabActivo}
          onVolver={() => setVistaActiva('lista')}
          onRecibir={() => handleIniciarRecepcion(ordenSeleccionada)}
          onCompletarPutaway={handleCompletarPutaway}
        />
      )}

      {/* ==================== RECIBIR ==================== */}
      {vistaActiva === 'recibir' && ordenSeleccionada && (
        <RecibirMercaderia
          orden={ordenSeleccionada}
          lineasRecibiendo={lineasRecibiendo}
          setLineasRecibiendo={setLineasRecibiendo}
          onVolver={() => setVistaActiva('detalle')}
          onConfirmar={handleConfirmarRecepcion}
          saving={saving}
        />
      )}

      {/* ==================== PUTAWAY ==================== */}
      {vistaActiva === 'putaway' && (
        <PutawayList
          tareas={tareasPutaway}
          onVolver={() => setVistaActiva('lista')}
          onCompletar={handleCompletarPutaway}
        />
      )}
    </div>
  );
}

// ============================================
// SUB-COMPONENTES
// ============================================

interface RecepcionDetalleProps {
  orden: OrdenRecepcion;
  tareasPutaway: TareaPutaway[];
  tabActivo: 'lineas' | 'putaway' | 'historial';
  setTabActivo: (tab: 'lineas' | 'putaway' | 'historial') => void;
  onVolver: () => void;
  onRecibir: () => void;
  onCompletarPutaway: (id: string) => void;
}

function RecepcionDetalle({ orden, tareasPutaway, tabActivo, setTabActivo, onVolver, onRecibir, onCompletarPutaway }: RecepcionDetalleProps) {
  const estadoConfig = ESTADO_RECEPCION_CONFIG[orden.estado];
  const EstadoIcon = estadoConfig.icon;
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onVolver} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400">
            <ChevronRight className="h-5 w-5 rotate-180" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-lg text-amber-400">{orden.numero}</span>
              <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${estadoConfig.bg} ${estadoConfig.color}`}>
                <EstadoIcon className="h-3 w-3" />
                {estadoConfig.label}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">{orden.proveedor_nombre}</p>
          </div>
        </div>
        
        {orden.estado !== 'completada' && (
          <button onClick={onRecibir} className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium">
            <ClipboardCheck className="h-4 w-4" />
            Recibir Mercadería
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <div className="flex gap-1">
          {[
            { id: 'lineas' as const, label: 'Líneas', icon: Package, count: orden.lineas_totales },
            { id: 'putaway' as const, label: 'Put-away', icon: MapPin, count: tareasPutaway.length },
            { id: 'historial' as const, label: 'Historial', icon: Clock },
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
                {tab.count !== undefined && (
                  <span className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">{tab.count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenido tabs */}
      {tabActivo === 'lineas' && (
        <div className="space-y-2">
          {orden.lineas?.map(linea => {
            const progreso = linea.cantidad_esperada > 0 
              ? Math.round((linea.cantidad_recibida / linea.cantidad_esperada) * 100) 
              : 0;
            
            return (
              <div key={linea.id} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono text-sm text-blue-400">{linea.producto_codigo}</span>
                      {linea.lote_numero && (
                        <span className="px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-400">
                          Lote: {linea.lote_numero}
                        </span>
                      )}
                      {linea.putaway_completado && (
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs">
                          Ubicado ✓
                        </span>
                      )}
                    </div>
                    <p className="text-slate-200">{linea.producto_nombre}</p>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-lg font-bold text-slate-200">
                      {linea.cantidad_recibida} / {linea.cantidad_esperada}
                    </div>
                    <div className="text-xs text-slate-400">{linea.unidad_medida}</div>
                  </div>
                </div>
                
                <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${progreso === 100 ? 'bg-emerald-500' : progreso > 0 ? 'bg-blue-500' : 'bg-slate-700'}`}
                    style={{ width: `${progreso}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tabActivo === 'putaway' && (
        <div className="space-y-2">
          {tareasPutaway.length > 0 ? tareasPutaway.map(tarea => {
            const estadoPutaway = ESTADO_PUTAWAY_CONFIG[tarea.estado];
            return (
              <div key={tarea.id} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono text-sm text-blue-400">{tarea.producto_codigo}</span>
                      <ArrowRight className="h-4 w-4 text-slate-600" />
                      <span className="font-mono text-sm text-emerald-400">{tarea.ubicacion_destino_codigo}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${estadoPutaway.bg} ${estadoPutaway.color}`}>
                        {estadoPutaway.label}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">{tarea.producto_nombre} • {tarea.cantidad} {tarea.unidad_medida}</p>
                    {tarea.razon_sugerencia && (
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <Zap className="h-3 w-3 text-amber-400" />
                        {tarea.razon_sugerencia}
                      </p>
                    )}
                  </div>
                  
                  {tarea.estado === 'pendiente' && (
                    <button
                      onClick={() => onCompletarPutaway(tarea.id)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm"
                    >
                      Completar
                    </button>
                  )}
                </div>
              </div>
            );
          }) : (
            <div className="text-center py-8 text-slate-500">
              <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No hay tareas de put-away</p>
            </div>
          )}
        </div>
      )}

      {tabActivo === 'historial' && (
        <div className="text-center py-8 text-slate-500">
          <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Historial próximamente</p>
        </div>
      )}
    </div>
  );
}

interface RecibirMercaderiaProps {
  orden: OrdenRecepcion;
  lineasRecibiendo: Record<string, { cantidad: number; lote?: string; vencimiento?: string }>;
  setLineasRecibiendo: React.Dispatch<React.SetStateAction<Record<string, { cantidad: number; lote?: string; vencimiento?: string }>>>;
  onVolver: () => void;
  onConfirmar: () => void;
  saving: boolean;
}

function RecibirMercaderia({ orden, lineasRecibiendo, setLineasRecibiendo, onVolver, onConfirmar, saving }: RecibirMercaderiaProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onVolver} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400">
          <ChevronRight className="h-5 w-5 rotate-180" />
        </button>
        <div>
          <h3 className="text-xl font-bold text-slate-100">Recibir Mercadería</h3>
          <p className="text-sm text-slate-400">{orden.numero} - {orden.proveedor_nombre}</p>
        </div>
      </div>

      <div className="space-y-3">
        {orden.lineas?.filter(l => l.estado !== 'completa').map(linea => {
          const recibiendo = lineasRecibiendo[linea.id] || { cantidad: 0 };
          const pendiente = linea.cantidad_esperada - linea.cantidad_recibida;
          
          return (
            <div key={linea.id} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-mono text-sm text-blue-400">{linea.producto_codigo}</div>
                  <div className="text-slate-200">{linea.producto_nombre}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Esperado: {linea.cantidad_esperada} | Pendiente: {pendiente} {linea.unidad_medida}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Cantidad a Recibir</label>
                  <input
                    type="number"
                    min={0}
                    max={pendiente}
                    value={recibiendo.cantidad}
                    onChange={(e) => setLineasRecibiendo(prev => ({
                      ...prev,
                      [linea.id]: { ...prev[linea.id], cantidad: parseInt(e.target.value) || 0 }
                    }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nº Lote</label>
                  <input
                    type="text"
                    value={recibiendo.lote || ''}
                    onChange={(e) => setLineasRecibiendo(prev => ({
                      ...prev,
                      [linea.id]: { ...prev[linea.id], lote: e.target.value }
                    }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100"
                    placeholder="LOT-XXXX"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Vencimiento</label>
                  <input
                    type="date"
                    value={recibiendo.vencimiento || ''}
                    onChange={(e) => setLineasRecibiendo(prev => ({
                      ...prev,
                      [linea.id]: { ...prev[linea.id], vencimiento: e.target.value }
                    }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between">
        <button onClick={onVolver} className="px-4 py-2 text-slate-400">Cancelar</button>
        <button
          onClick={onConfirmar}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white rounded-xl font-medium"
        >
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Confirmar Recepción
        </button>
      </div>
    </div>
  );
}

interface PutawayListProps {
  tareas: TareaPutaway[];
  onVolver: () => void;
  onCompletar: (id: string) => void;
}

function PutawayList({ tareas, onVolver, onCompletar }: PutawayListProps) {
  const pendientes = tareas.filter(t => t.estado === 'pendiente');
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onVolver} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400">
            <ChevronRight className="h-5 w-5 rotate-180" />
          </button>
          <div>
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <MapPin className="h-6 w-6 text-amber-400" />
              Tareas de Put-away
            </h3>
            <p className="text-sm text-slate-400">{pendientes.length} pendientes</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {pendientes.map(tarea => (
          <div key={tarea.id} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-500/20 rounded-xl">
                  <Package className="h-6 w-6 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono text-sm text-blue-400">{tarea.producto_codigo}</span>
                    <ArrowRight className="h-4 w-4 text-slate-600" />
                    <span className="font-mono text-sm text-emerald-400 font-bold">{tarea.ubicacion_destino_codigo}</span>
                  </div>
                  <p className="text-slate-200">{tarea.producto_nombre}</p>
                  <p className="text-sm text-slate-400">{tarea.cantidad} {tarea.unidad_medida} {tarea.lote_numero && `• Lote: ${tarea.lote_numero}`}</p>
                  {tarea.razon_sugerencia && (
                    <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      {tarea.razon_sugerencia}
                    </p>
                  )}
                </div>
              </div>
              
              <button
                onClick={() => onCompletar(tarea.id)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium flex items-center gap-2"
              >
                <Check className="h-4 w-4" />
                Completar
              </button>
            </div>
          </div>
        ))}
        
        {pendientes.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <CheckCircle className="h-16 w-16 mx-auto mb-4 text-emerald-400" />
            <p className="text-lg text-slate-300">¡Todas las tareas completadas!</p>
            <p className="text-sm">No hay productos pendientes de ubicar</p>
          </div>
        )}
      </div>
    </div>
  );
}