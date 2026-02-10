'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Target, Search, Plus, RefreshCw, Eye, Edit,
  ChevronRight, ChevronDown, X, Save, Check,
  Package, Box, MapPin, ClipboardCheck, AlertTriangle,
  Clock, CheckCircle, XCircle, ArrowRight, Layers,
  Users, Calendar, User, FileText, Zap, Route,
  Play, Pause, SkipForward, AlertCircle, Truck,
  BarChart3, Timer, Navigation, List, Grid3X3
} from 'lucide-react';

// ============================================
// TIPOS
// ============================================

type TipoPicking = 'orden_unica' | 'batch' | 'wave' | 'cluster' | 'zone';
type EstadoWave = 'borrador' | 'planificada' | 'liberada' | 'en_proceso' | 'completada' | 'cancelada';
type EstadoOrdenPicking = 'pendiente' | 'asignada' | 'en_proceso' | 'completada' | 'parcial' | 'cancelada';
type EstadoLineaPicking = 'pendiente' | 'en_proceso' | 'completada' | 'short_pick' | 'cancelada';
type TipoOrigenPicking = 'venta' | 'transferencia' | 'produccion' | 'reposicion';

interface WavePicking {
  id: string;
  numero: string;
  nombre?: string;
  tipo: TipoPicking;
  estado: EstadoWave;
  ordenes_ids: string[];
  ordenes_count: number;
  fecha_creacion: string;
  fecha_liberacion?: string;
  fecha_inicio?: string;
  fecha_completado?: string;
  fecha_limite?: string;
  lineas_totales: number;
  lineas_completadas: number;
  unidades_totales: number;
  unidades_pickeadas: number;
  pickers_asignados?: string[];
  ruta_optimizada: boolean;
  tiempo_estimado_min?: number;
  distancia_estimada_m?: number;
  prioridad: number;
  created_by?: string;
}

interface OrdenPicking {
  id: string;
  numero: string;
  tipo_origen: TipoOrigenPicking;
  orden_venta_numero?: string;
  cliente_id?: string;
  cliente_nombre?: string;
  wave_id?: string;
  wave_numero?: string;
  almacen_id: string;
  fecha_requerida?: string;
  fecha_liberacion?: string;
  fecha_inicio?: string;
  fecha_completado?: string;
  estado: EstadoOrdenPicking;
  lineas_totales: number;
  lineas_completadas: number;
  unidades_totales: number;
  unidades_pickeadas: number;
  picker_asignado?: string;
  secuencia_ruta?: number;
  prioridad: number;
  notas?: string;
  created_at: string;
  lineas?: LineaPicking[];
}

interface LineaPicking {
  id: string;
  orden_picking_id: string;
  producto_id: string;
  producto_codigo: string;
  producto_nombre: string;
  cantidad_solicitada: number;
  cantidad_pickeada: number;
  cantidad_short: number;
  unidad_medida: string;
  ubicacion_id: string;
  ubicacion_codigo: string;
  lote_numero?: string;
  fecha_vencimiento?: string;
  estado: EstadoLineaPicking;
  secuencia: number;
  fecha_picking?: string;
  pickeado_por?: string;
  notas?: string;
}

type VistaActiva = 'ordenes' | 'waves' | 'nueva_wave' | 'detalle_wave' | 'picking_activo' | 'detalle_orden';

// ============================================
// CONFIGURACIONES
// ============================================

const ESTADO_WAVE_CONFIG: Record<EstadoWave, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  borrador: { label: 'Borrador', color: 'text-slate-400', bg: 'bg-slate-500/20', icon: Edit },
  planificada: { label: 'Planificada', color: 'text-blue-400', bg: 'bg-blue-500/20', icon: Calendar },
  liberada: { label: 'Liberada', color: 'text-purple-400', bg: 'bg-purple-500/20', icon: Play },
  en_proceso: { label: 'En Proceso', color: 'text-amber-400', bg: 'bg-amber-500/20', icon: Zap },
  completada: { label: 'Completada', color: 'text-emerald-400', bg: 'bg-emerald-500/20', icon: CheckCircle },
  cancelada: { label: 'Cancelada', color: 'text-red-400', bg: 'bg-red-500/20', icon: XCircle },
};

const ESTADO_ORDEN_CONFIG: Record<EstadoOrdenPicking, { label: string; color: string; bg: string }> = {
  pendiente: { label: 'Pendiente', color: 'text-slate-400', bg: 'bg-slate-500/20' },
  asignada: { label: 'Asignada', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  en_proceso: { label: 'En Proceso', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  completada: { label: 'Completada', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  parcial: { label: 'Parcial', color: 'text-orange-400', bg: 'bg-orange-500/20' },
  cancelada: { label: 'Cancelada', color: 'text-red-400', bg: 'bg-red-500/20' },
};

const ESTADO_LINEA_CONFIG: Record<EstadoLineaPicking, { label: string; color: string; bg: string }> = {
  pendiente: { label: 'Pendiente', color: 'text-slate-400', bg: 'bg-slate-500/20' },
  en_proceso: { label: 'En Proceso', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  completada: { label: 'Completada', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  short_pick: { label: 'Short Pick', color: 'text-red-400', bg: 'bg-red-500/20' },
  cancelada: { label: 'Cancelada', color: 'text-slate-400', bg: 'bg-slate-500/20' },
};

const TIPO_PICKING_CONFIG: Record<TipoPicking, { label: string; descripcion: string }> = {
  orden_unica: { label: 'Orden Única', descripcion: 'Una orden a la vez' },
  batch: { label: 'Batch', descripcion: 'Múltiples órdenes, mismo producto' },
  wave: { label: 'Wave', descripcion: 'Grupo de órdenes optimizado' },
  cluster: { label: 'Cluster', descripcion: 'Múltiples órdenes en un carro' },
  zone: { label: 'Por Zona', descripcion: 'Picking dividido por zonas' },
};

// ============================================
// HELPERS
// ============================================

const formatDate = (date: string | null | undefined): string => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatTime = (date: string | null | undefined): string => {
  if (!date) return '-';
  return new Date(date).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' });
};

const formatDateTime = (date: string | null | undefined): string => {
  if (!date) return '-';
  return new Date(date).toLocaleString('es-UY', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const generarNumeroWave = (): string => {
  const date = new Date();
  const seq = Math.floor(Math.random() * 900) + 100;
  return `WAV-${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2,'0')}${date.getDate().toString().padStart(2,'0')}-${seq}`;
};

// Optimizar ruta de picking (algoritmo simplificado - nearest neighbor)
const optimizarRuta = (lineas: LineaPicking[]): LineaPicking[] => {
  if (lineas.length <= 1) return lineas;
  
  // Ordenar por ubicación (pasillo -> rack -> nivel -> posición)
  return [...lineas].sort((a, b) => {
    return a.ubicacion_codigo.localeCompare(b.ubicacion_codigo);
  }).map((linea, idx) => ({ ...linea, secuencia: idx + 1 }));
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function Picking() {
  const [loading, setLoading] = useState(true);
  const [vistaActiva, setVistaActiva] = useState<VistaActiva>('ordenes');
  const [waveSeleccionada, setWaveSeleccionada] = useState<WavePicking | null>(null);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<OrdenPicking | null>(null);
  
  const [waves, setWaves] = useState<WavePicking[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenPicking[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('activas');
  
  // Selección para crear wave
  const [ordenesSeleccionadas, setOrdenesSeleccionadas] = useState<Set<string>>(new Set());
  
  // Picking activo
  const [lineaActual, setLineaActual] = useState<number>(0);
  const [cantidadPickeada, setCantidadPickeada] = useState<number>(0);
  
  const [saving, setSaving] = useState(false);

  // ============================================
  // CARGA DE DATOS
  // ============================================

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Cargar waves
      const { data: wavesData } = await supabase
        .from('wms_waves_picking')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (wavesData) {
        setWaves(wavesData);
      } else {
        // Datos de ejemplo
        setWaves([
          {
            id: 'w1',
            numero: 'WAV-20240210-001',
            nombre: 'Wave Mañana',
            tipo: 'wave',
            estado: 'en_proceso',
            ordenes_ids: ['o1', 'o2', 'o3'],
            ordenes_count: 3,
            fecha_creacion: new Date(Date.now() - 3600000).toISOString(),
            fecha_liberacion: new Date(Date.now() - 1800000).toISOString(),
            fecha_inicio: new Date(Date.now() - 900000).toISOString(),
            lineas_totales: 12,
            lineas_completadas: 5,
            unidades_totales: 150,
            unidades_pickeadas: 65,
            pickers_asignados: ['Juan P.', 'María L.'],
            ruta_optimizada: true,
            tiempo_estimado_min: 45,
            distancia_estimada_m: 320,
            prioridad: 1,
          },
          {
            id: 'w2',
            numero: 'WAV-20240210-002',
            nombre: 'Wave Tarde',
            tipo: 'wave',
            estado: 'liberada',
            ordenes_ids: ['o4', 'o5'],
            ordenes_count: 2,
            fecha_creacion: new Date().toISOString(),
            fecha_liberacion: new Date().toISOString(),
            lineas_totales: 8,
            lineas_completadas: 0,
            unidades_totales: 95,
            unidades_pickeadas: 0,
            ruta_optimizada: true,
            tiempo_estimado_min: 30,
            prioridad: 2,
          },
        ]);
      }

      // Cargar órdenes de picking
      const { data: ordenesData } = await supabase
        .from('wms_ordenes_picking')
        .select('*')
        .order('prioridad', { ascending: true })
        .order('fecha_requerida', { ascending: true })
        .limit(100);
      
      if (ordenesData) {
        setOrdenes(ordenesData);
      } else {
        // Datos de ejemplo
        setOrdenes([
          {
            id: 'o1',
            numero: 'PICK-2024-0892',
            tipo_origen: 'venta',
            orden_venta_numero: 'OV-2024-1234',
            cliente_nombre: 'Cliente ABC S.A.',
            wave_id: 'w1',
            wave_numero: 'WAV-20240210-001',
            almacen_id: '1',
            fecha_requerida: new Date().toISOString(),
            estado: 'en_proceso',
            lineas_totales: 4,
            lineas_completadas: 2,
            unidades_totales: 50,
            unidades_pickeadas: 25,
            picker_asignado: 'Juan P.',
            prioridad: 1,
            created_at: new Date(Date.now() - 7200000).toISOString(),
            lineas: [
              { id: 'l1', orden_picking_id: 'o1', producto_id: 'p1', producto_codigo: 'SKU-1001', producto_nombre: 'Producto Alpha', cantidad_solicitada: 10, cantidad_pickeada: 10, cantidad_short: 0, unidad_medida: 'UND', ubicacion_id: 'u1', ubicacion_codigo: 'A-01-02-01', estado: 'completada', secuencia: 1 },
              { id: 'l2', orden_picking_id: 'o1', producto_id: 'p2', producto_codigo: 'SKU-1002', producto_nombre: 'Producto Beta', cantidad_solicitada: 15, cantidad_pickeada: 15, cantidad_short: 0, unidad_medida: 'UND', ubicacion_id: 'u2', ubicacion_codigo: 'A-02-01-03', estado: 'completada', secuencia: 2 },
              { id: 'l3', orden_picking_id: 'o1', producto_id: 'p3', producto_codigo: 'SKU-1003', producto_nombre: 'Producto Gamma', cantidad_solicitada: 20, cantidad_pickeada: 0, cantidad_short: 0, unidad_medida: 'UND', ubicacion_id: 'u3', ubicacion_codigo: 'B-01-03-02', estado: 'pendiente', secuencia: 3 },
              { id: 'l4', orden_picking_id: 'o1', producto_id: 'p4', producto_codigo: 'SKU-1004', producto_nombre: 'Producto Delta', cantidad_solicitada: 5, cantidad_pickeada: 0, cantidad_short: 0, unidad_medida: 'UND', ubicacion_id: 'u4', ubicacion_codigo: 'B-02-02-01', estado: 'pendiente', secuencia: 4 },
            ]
          },
          {
            id: 'o2',
            numero: 'PICK-2024-0893',
            tipo_origen: 'venta',
            orden_venta_numero: 'OV-2024-1235',
            cliente_nombre: 'Distribuidora XYZ',
            wave_id: 'w1',
            wave_numero: 'WAV-20240210-001',
            almacen_id: '1',
            fecha_requerida: new Date().toISOString(),
            estado: 'asignada',
            lineas_totales: 3,
            lineas_completadas: 0,
            unidades_totales: 45,
            unidades_pickeadas: 0,
            picker_asignado: 'María L.',
            prioridad: 1,
            created_at: new Date(Date.now() - 5400000).toISOString(),
          },
          {
            id: 'o3',
            numero: 'PICK-2024-0894',
            tipo_origen: 'transferencia',
            cliente_nombre: 'Almacén Secundario',
            almacen_id: '1',
            fecha_requerida: new Date(Date.now() + 86400000).toISOString(),
            estado: 'pendiente',
            lineas_totales: 5,
            lineas_completadas: 0,
            unidades_totales: 120,
            unidades_pickeadas: 0,
            prioridad: 2,
            created_at: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            id: 'o4',
            numero: 'PICK-2024-0895',
            tipo_origen: 'venta',
            orden_venta_numero: 'OV-2024-1236',
            cliente_nombre: 'Retail Plus',
            almacen_id: '1',
            fecha_requerida: new Date().toISOString(),
            estado: 'pendiente',
            lineas_totales: 6,
            lineas_completadas: 0,
            unidades_totales: 80,
            unidades_pickeadas: 0,
            prioridad: 1,
            created_at: new Date(Date.now() - 1800000).toISOString(),
          },
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
            !orden.cliente_nombre?.toLowerCase().includes(search) &&
            !orden.orden_venta_numero?.toLowerCase().includes(search)) return false;
      }
      
      if (filtroEstado === 'activas') {
        if (['completada', 'cancelada'].includes(orden.estado)) return false;
      } else if (filtroEstado === 'sin_wave') {
        if (orden.wave_id) return false;
      } else if (filtroEstado !== 'todos' && orden.estado !== filtroEstado) {
        return false;
      }
      
      return true;
    });
  }, [ordenes, searchTerm, filtroEstado]);

  const wavesFiltradas = useMemo(() => {
    return waves.filter(wave => {
      if (filtroEstado === 'activas') {
        if (['completada', 'cancelada'].includes(wave.estado)) return false;
      }
      return true;
    });
  }, [waves, filtroEstado]);

  const ordenesSinWave = useMemo(() => 
    ordenes.filter(o => !o.wave_id && o.estado === 'pendiente'),
    [ordenes]
  );

  // ============================================
  // ESTADÍSTICAS
  // ============================================

  const stats = useMemo(() => {
    const pendientes = ordenes.filter(o => o.estado === 'pendiente').length;
    const enProceso = ordenes.filter(o => o.estado === 'en_proceso').length;
    const hoy = new Date().toISOString().split('T')[0];
    const completadasHoy = ordenes.filter(o => o.fecha_completado?.startsWith(hoy)).length;
    const wavesActivas = waves.filter(w => ['liberada', 'en_proceso'].includes(w.estado)).length;
    const sinAsignar = ordenesSinWave.length;
    
    return { pendientes, enProceso, completadasHoy, wavesActivas, sinAsignar };
  }, [ordenes, waves, ordenesSinWave]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleSeleccionarOrden = (ordenId: string) => {
    const newSet = new Set(ordenesSeleccionadas);
    if (newSet.has(ordenId)) {
      newSet.delete(ordenId);
    } else {
      newSet.add(ordenId);
    }
    setOrdenesSeleccionadas(newSet);
  };

  const handleCrearWave = async () => {
    if (ordenesSeleccionadas.size === 0) return;
    
    setSaving(true);
    try {
      const ordenesParaWave = ordenes.filter(o => ordenesSeleccionadas.has(o.id));
      
      // Calcular totales
      const lineasTotales = ordenesParaWave.reduce((sum, o) => sum + o.lineas_totales, 0);
      const unidadesTotales = ordenesParaWave.reduce((sum, o) => sum + o.unidades_totales, 0);
      
      const nuevaWave: WavePicking = {
        id: `wave-${Date.now()}`,
        numero: generarNumeroWave(),
        tipo: 'wave',
        estado: 'planificada',
        ordenes_ids: Array.from(ordenesSeleccionadas),
        ordenes_count: ordenesSeleccionadas.size,
        fecha_creacion: new Date().toISOString(),
        lineas_totales: lineasTotales,
        lineas_completadas: 0,
        unidades_totales: unidadesTotales,
        unidades_pickeadas: 0,
        ruta_optimizada: false,
        prioridad: 1,
      };

      setWaves(prev => [nuevaWave, ...prev]);
      
      // Actualizar órdenes con wave_id
      setOrdenes(prev => prev.map(o => 
        ordenesSeleccionadas.has(o.id) 
          ? { ...o, wave_id: nuevaWave.id, wave_numero: nuevaWave.numero }
          : o
      ));
      
      setOrdenesSeleccionadas(new Set());
      setWaveSeleccionada(nuevaWave);
      setVistaActiva('detalle_wave');
      
    } finally {
      setSaving(false);
    }
  };

  const handleLiberarWave = async (waveId: string) => {
    setWaves(prev => prev.map(w => 
      w.id === waveId 
        ? { ...w, estado: 'liberada' as EstadoWave, fecha_liberacion: new Date().toISOString(), ruta_optimizada: true }
        : w
    ));
    
    // Actualizar órdenes a asignada
    setOrdenes(prev => prev.map(o => 
      o.wave_id === waveId 
        ? { ...o, estado: 'asignada' as EstadoOrdenPicking }
        : o
    ));
  };

  const handleIniciarPicking = (orden: OrdenPicking) => {
    setOrdenSeleccionada(orden);
    setLineaActual(0);
    setCantidadPickeada(0);
    setVistaActiva('picking_activo');
    
    // Actualizar estado
    setOrdenes(prev => prev.map(o => 
      o.id === orden.id ? { ...o, estado: 'en_proceso' as EstadoOrdenPicking, fecha_inicio: new Date().toISOString() } : o
    ));
  };

  const handleConfirmarLinea = () => {
    if (!ordenSeleccionada?.lineas) return;
    
    const lineas = ordenSeleccionada.lineas;
    const lineaActualData = lineas[lineaActual];
    
    const cantidad = cantidadPickeada || lineaActualData.cantidad_solicitada;
    const esShortPick = cantidad < lineaActualData.cantidad_solicitada;
    
    const nuevoEstadoLinea: EstadoLineaPicking = esShortPick ? 'short_pick' : 'completada';
    
    // Actualizar línea
    const lineasActualizadas = lineas.map((l, idx) => 
      idx === lineaActual 
        ? { 
            ...l, 
            cantidad_pickeada: cantidad,
            cantidad_short: lineaActualData.cantidad_solicitada - cantidad,
            estado: nuevoEstadoLinea,
            fecha_picking: new Date().toISOString(),
          }
        : l
    );
    
    const ordenActualizada: OrdenPicking = {
      ...ordenSeleccionada,
      lineas: lineasActualizadas,
      lineas_completadas: lineasActualizadas.filter(l => ['completada', 'short_pick'].includes(l.estado)).length,
      unidades_pickeadas: lineasActualizadas.reduce((sum, l) => sum + l.cantidad_pickeada, 0),
    };
    
    // ¿Es la última línea?
    if (lineaActual >= lineas.length - 1) {
      // Completar orden
      const estadoFinal: EstadoOrdenPicking = lineasActualizadas.some(l => l.estado === 'short_pick') ? 'parcial' : 'completada';
      ordenActualizada.estado = estadoFinal;
      ordenActualizada.fecha_completado = new Date().toISOString();
      
      setOrdenes(prev => prev.map(o => o.id === ordenActualizada.id ? ordenActualizada : o));
      setOrdenSeleccionada(null);
      setVistaActiva('ordenes');
      alert('✅ Picking completado');
    } else {
      // Siguiente línea
      setOrdenSeleccionada(ordenActualizada);
      setOrdenes(prev => prev.map(o => o.id === ordenActualizada.id ? ordenActualizada : o));
      setLineaActual(lineaActual + 1);
      setCantidadPickeada(0);
    }
  };

  const handleShortPick = () => {
    // Confirmar con cantidad actual (menor a solicitada)
    handleConfirmarLinea();
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
      {/* Tabs principales */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        {[
          { id: 'ordenes' as const, label: 'Órdenes', icon: ClipboardCheck, count: stats.pendientes },
          { id: 'waves' as const, label: 'Waves', icon: Layers, count: stats.wavesActivas },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setVistaActiva(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                vistaActiva === tab.id
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.count > 0 && (
                <span className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ==================== ORDENES ==================== */}
      {vistaActiva === 'ordenes' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-slate-200">{stats.pendientes}</div>
              <div className="text-xs text-slate-400">Pendientes</div>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-amber-400">{stats.enProceso}</div>
              <div className="text-xs text-amber-400">En Proceso</div>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-emerald-400">{stats.completadasHoy}</div>
              <div className="text-xs text-emerald-400">Completadas Hoy</div>
            </div>
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-purple-400">{stats.wavesActivas}</div>
              <div className="text-xs text-purple-400">Waves Activas</div>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-blue-400">{stats.sinAsignar}</div>
              <div className="text-xs text-blue-400">Sin Wave</div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-3 items-center flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar orden, cliente..."
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
                <option value="sin_wave">Sin Wave</option>
                <option value="pendiente">Pendientes</option>
                <option value="en_proceso">En Proceso</option>
              </select>
              
              <button onClick={loadData} className="p-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-400">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            
            {ordenesSeleccionadas.size > 0 && (
              <button
                onClick={handleCrearWave}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium"
              >
                <Layers className="h-4 w-4" />
                Crear Wave ({ordenesSeleccionadas.size})
              </button>
            )}
          </div>

          {/* Lista de órdenes */}
          <div className="space-y-2">
            {ordenesFiltradas.map(orden => {
              const estadoConfig = ESTADO_ORDEN_CONFIG[orden.estado];
              const isSelected = ordenesSeleccionadas.has(orden.id);
              const progreso = orden.unidades_totales > 0 
                ? Math.round((orden.unidades_pickeadas / orden.unidades_totales) * 100) 
                : 0;
              
              return (
                <div 
                  key={orden.id}
                  className={`bg-slate-900/50 border rounded-xl p-4 transition-colors ${
                    isSelected ? 'border-purple-500' : 'border-slate-800/50 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox para wave */}
                    {orden.estado === 'pendiente' && !orden.wave_id && (
                      <button
                        onClick={() => handleSeleccionarOrden(orden.id)}
                        className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          isSelected 
                            ? 'bg-purple-500 border-purple-500 text-white' 
                            : 'border-slate-600 hover:border-purple-400'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </button>
                    )}
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className="font-mono text-sm text-purple-400">{orden.numero}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${estadoConfig.bg} ${estadoConfig.color}`}>
                          {estadoConfig.label}
                        </span>
                        {orden.wave_numero && (
                          <span className="px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-400">
                            {orden.wave_numero}
                          </span>
                        )}
                        {orden.picker_asignado && (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <User className="h-3 w-3" />
                            {orden.picker_asignado}
                          </span>
                        )}
                      </div>
                      
                      <h4 className="font-medium text-slate-200 mb-1">{orden.cliente_nombre}</h4>
                      
                      {orden.orden_venta_numero && (
                        <p className="text-sm text-slate-400 mb-2">OV: {orden.orden_venta_numero}</p>
                      )}
                      
                      {/* Barra de progreso */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${progreso === 100 ? 'bg-emerald-500' : progreso > 0 ? 'bg-purple-500' : 'bg-slate-700'}`}
                            style={{ width: `${progreso}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400 w-20">
                          {orden.lineas_completadas}/{orden.lineas_totales} líneas
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      {orden.estado === 'asignada' && (
                        <button
                          onClick={() => handleIniciarPicking(orden)}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm flex items-center gap-2"
                        >
                          <Play className="h-4 w-4" />
                          Iniciar
                        </button>
                      )}
                      {orden.estado === 'en_proceso' && (
                        <button
                          onClick={() => handleIniciarPicking(orden)}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm flex items-center gap-2"
                        >
                          <Play className="h-4 w-4" />
                          Continuar
                        </button>
                      )}
                      <button
                        onClick={() => { setOrdenSeleccionada(orden); setVistaActiva('detalle_orden'); }}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ==================== WAVES ==================== */}
      {vistaActiva === 'waves' && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Layers className="h-6 w-6 text-purple-400" />
              Waves de Picking
            </h3>
          </div>

          <div className="space-y-3">
            {wavesFiltradas.map(wave => {
              const estadoConfig = ESTADO_WAVE_CONFIG[wave.estado];
              const EstadoIcon = estadoConfig.icon;
              const progreso = wave.lineas_totales > 0 
                ? Math.round((wave.lineas_completadas / wave.lineas_totales) * 100) 
                : 0;
              
              return (
                <div key={wave.id} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm text-purple-400">{wave.numero}</span>
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${estadoConfig.bg} ${estadoConfig.color}`}>
                          <EstadoIcon className="h-3 w-3" />
                          {estadoConfig.label}
                        </span>
                        {wave.ruta_optimizada && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full text-xs">
                            <Route className="h-3 w-3" />
                            Ruta Optimizada
                          </span>
                        )}
                      </div>
                      
                      {wave.nombre && <h4 className="font-medium text-slate-200 mb-2">{wave.nombre}</h4>}
                      
                      <div className="flex items-center gap-4 text-sm text-slate-400 mb-2">
                        <span>{wave.ordenes_count} órdenes</span>
                        <span>{wave.lineas_totales} líneas</span>
                        <span>{wave.unidades_totales} unidades</span>
                        {wave.tiempo_estimado_min && (
                          <span className="flex items-center gap-1">
                            <Timer className="h-3 w-3" />
                            ~{wave.tiempo_estimado_min} min
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${progreso === 100 ? 'bg-emerald-500' : 'bg-purple-500'}`}
                            style={{ width: `${progreso}%` }}
                          />
                        </div>
                        <span className="text-sm text-slate-300">{progreso}%</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      {wave.estado === 'planificada' && (
                        <button
                          onClick={() => handleLiberarWave(wave.id)}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm flex items-center gap-2"
                        >
                          <Play className="h-4 w-4" />
                          Liberar
                        </button>
                      )}
                      <button
                        onClick={() => { setWaveSeleccionada(wave); setVistaActiva('detalle_wave'); }}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm"
                      >
                        Ver Detalle
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {wavesFiltradas.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <Layers className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No hay waves activas</p>
                <p className="text-sm mt-1">Seleccione órdenes y cree una wave</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ==================== PICKING ACTIVO ==================== */}
      {vistaActiva === 'picking_activo' && ordenSeleccionada?.lineas && (
        <PickingActivo
          orden={ordenSeleccionada}
          lineaActual={lineaActual}
          cantidadPickeada={cantidadPickeada}
          setCantidadPickeada={setCantidadPickeada}
          onConfirmar={handleConfirmarLinea}
          onShortPick={handleShortPick}
          onSalir={() => setVistaActiva('ordenes')}
        />
      )}

      {/* ==================== DETALLE ORDEN ==================== */}
      {vistaActiva === 'detalle_orden' && ordenSeleccionada && (
        <OrdenDetalleView
          orden={ordenSeleccionada}
          onVolver={() => setVistaActiva('ordenes')}
          onIniciarPicking={() => handleIniciarPicking(ordenSeleccionada)}
        />
      )}

      {/* ==================== DETALLE WAVE ==================== */}
      {vistaActiva === 'detalle_wave' && waveSeleccionada && (
        <WaveDetalleView
          wave={waveSeleccionada}
          ordenes={ordenes.filter(o => o.wave_id === waveSeleccionada.id)}
          onVolver={() => setVistaActiva('waves')}
          onLiberar={() => handleLiberarWave(waveSeleccionada.id)}
        />
      )}
    </div>
  );
}

// ============================================
// SUB-COMPONENTES
// ============================================

interface PickingActivoProps {
  orden: OrdenPicking;
  lineaActual: number;
  cantidadPickeada: number;
  setCantidadPickeada: (v: number) => void;
  onConfirmar: () => void;
  onShortPick: () => void;
  onSalir: () => void;
}

function PickingActivo({ orden, lineaActual, cantidadPickeada, setCantidadPickeada, onConfirmar, onShortPick, onSalir }: PickingActivoProps) {
  const lineas = orden.lineas || [];
  const linea = lineas[lineaActual];
  const progreso = lineas.length > 0 ? Math.round(((lineaActual) / lineas.length) * 100) : 0;
  
  if (!linea) return null;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg text-purple-400">{orden.numero}</span>
            <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs">
              Picking Activo
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">{orden.cliente_nombre}</p>
        </div>
        <button onClick={onSalir} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl">
          Pausar
        </button>
      </div>

      {/* Progreso */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">Progreso</span>
          <span className="text-sm text-slate-200">{lineaActual + 1} de {lineas.length}</span>
        </div>
        <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-purple-500 transition-all" style={{ width: `${progreso}%` }} />
        </div>
      </div>

      {/* Línea actual */}
      <div className="bg-purple-500/10 border-2 border-purple-500/50 rounded-xl p-6">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 rounded-full mb-4">
            <MapPin className="h-5 w-5 text-purple-400" />
            <span className="text-2xl font-bold text-purple-400">{linea.ubicacion_codigo}</span>
          </div>
          
          <div className="text-lg text-slate-200 mb-1">{linea.producto_nombre}</div>
          <div className="font-mono text-sm text-slate-400">{linea.producto_codigo}</div>
          {linea.lote_numero && (
            <div className="text-sm text-slate-500 mt-1">Lote: {linea.lote_numero}</div>
          )}
        </div>
        
        <div className="flex items-center justify-center gap-8 mb-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-slate-100">{linea.cantidad_solicitada}</div>
            <div className="text-sm text-slate-400">{linea.unidad_medida} solicitadas</div>
          </div>
        </div>
        
        <div className="max-w-xs mx-auto">
          <label className="block text-sm text-slate-400 mb-2 text-center">Cantidad Pickeada</label>
          <input
            type="number"
            min={0}
            max={linea.cantidad_solicitada}
            value={cantidadPickeada || linea.cantidad_solicitada}
            onChange={(e) => setCantidadPickeada(parseInt(e.target.value) || 0)}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-2xl text-center text-slate-100"
          />
        </div>
      </div>

      {/* Acciones */}
      <div className="flex gap-3">
        <button
          onClick={onShortPick}
          className="flex-1 px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl font-medium flex items-center justify-center gap-2"
        >
          <AlertTriangle className="h-5 w-5" />
          Short Pick
        </button>
        <button
          onClick={onConfirmar}
          className="flex-[2] px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 text-lg"
        >
          <Check className="h-5 w-5" />
          Confirmar
        </button>
      </div>

      {/* Lista de líneas */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
        <h4 className="font-semibold text-slate-200 mb-3">Todas las líneas</h4>
        <div className="space-y-2">
          {lineas.map((l, idx) => {
            const estadoLinea = ESTADO_LINEA_CONFIG[l.estado];
            const esCurrent = idx === lineaActual;
            
            return (
              <div 
                key={l.id} 
                className={`flex items-center gap-3 p-2 rounded-lg ${
                  esCurrent ? 'bg-purple-500/20 border border-purple-500/50' : 
                  l.estado === 'completada' ? 'bg-emerald-500/10' :
                  l.estado === 'short_pick' ? 'bg-red-500/10' : 'bg-slate-800/30'
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  l.estado === 'completada' ? 'bg-emerald-500 text-white' :
                  l.estado === 'short_pick' ? 'bg-red-500 text-white' :
                  esCurrent ? 'bg-purple-500 text-white' : 'bg-slate-700 text-slate-400'
                }`}>
                  {l.estado === 'completada' ? '✓' : idx + 1}
                </span>
                <div className="flex-1">
                  <div className="text-sm text-slate-200">{l.producto_codigo}</div>
                  <div className="text-xs text-slate-500">{l.ubicacion_codigo}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-300">{l.cantidad_pickeada || 0}/{l.cantidad_solicitada}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface OrdenDetalleViewProps {
  orden: OrdenPicking;
  onVolver: () => void;
  onIniciarPicking: () => void;
}

function OrdenDetalleView({ orden, onVolver, onIniciarPicking }: OrdenDetalleViewProps) {
  const estadoConfig = ESTADO_ORDEN_CONFIG[orden.estado];
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onVolver} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400">
            <ChevronRight className="h-5 w-5 rotate-180" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-lg text-purple-400">{orden.numero}</span>
              <span className={`px-2 py-1 rounded-full text-xs ${estadoConfig.bg} ${estadoConfig.color}`}>
                {estadoConfig.label}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">{orden.cliente_nombre}</p>
          </div>
        </div>
        
        {['asignada', 'en_proceso'].includes(orden.estado) && (
          <button onClick={onIniciarPicking} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl">
            <Play className="h-4 w-4" />
            {orden.estado === 'en_proceso' ? 'Continuar' : 'Iniciar'} Picking
          </button>
        )}
      </div>

      {orden.lineas && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800/50">
            <h4 className="font-semibold text-slate-200">Líneas de Picking</h4>
          </div>
          <div className="divide-y divide-slate-800/50">
            {orden.lineas.map((linea, idx) => {
              const estadoLinea = ESTADO_LINEA_CONFIG[linea.estado];
              return (
                <div key={linea.id} className="p-4 flex items-center gap-4">
                  <span className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-400">
                    {linea.secuencia || idx + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-blue-400">{linea.producto_codigo}</span>
                      <span className="font-mono text-xs text-emerald-400">@ {linea.ubicacion_codigo}</span>
                    </div>
                    <div className="text-sm text-slate-300">{linea.producto_nombre}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-slate-200">
                      {linea.cantidad_pickeada}/{linea.cantidad_solicitada}
                    </div>
                    <span className={`text-xs ${estadoLinea.color}`}>{estadoLinea.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface WaveDetalleViewProps {
  wave: WavePicking;
  ordenes: OrdenPicking[];
  onVolver: () => void;
  onLiberar: () => void;
}

function WaveDetalleView({ wave, ordenes, onVolver, onLiberar }: WaveDetalleViewProps) {
  const estadoConfig = ESTADO_WAVE_CONFIG[wave.estado];
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
              <span className="font-mono text-lg text-purple-400">{wave.numero}</span>
              <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${estadoConfig.bg} ${estadoConfig.color}`}>
                <EstadoIcon className="h-3 w-3" />
                {estadoConfig.label}
              </span>
            </div>
            {wave.nombre && <p className="text-sm text-slate-400 mt-1">{wave.nombre}</p>}
          </div>
        </div>
        
        {wave.estado === 'planificada' && (
          <button onClick={onLiberar} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl">
            <Play className="h-4 w-4" />
            Liberar Wave
          </button>
        )}
      </div>

      {/* Stats de la wave */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-slate-200">{wave.ordenes_count}</div>
          <div className="text-xs text-slate-400">Órdenes</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-slate-200">{wave.lineas_totales}</div>
          <div className="text-xs text-slate-400">Líneas</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-slate-200">{wave.unidades_totales}</div>
          <div className="text-xs text-slate-400">Unidades</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-slate-200">{wave.tiempo_estimado_min || '-'}</div>
          <div className="text-xs text-slate-400">Min. Est.</div>
        </div>
      </div>

      {/* Órdenes de la wave */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800/50">
          <h4 className="font-semibold text-slate-200">Órdenes en esta Wave</h4>
        </div>
        <div className="divide-y divide-slate-800/50">
          {ordenes.map(orden => {
            const estadoOrden = ESTADO_ORDEN_CONFIG[orden.estado];
            return (
              <div key={orden.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-purple-400">{orden.numero}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${estadoOrden.bg} ${estadoOrden.color}`}>
                      {estadoOrden.label}
                    </span>
                  </div>
                  <div className="text-sm text-slate-300">{orden.cliente_nombre}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-200">{orden.lineas_completadas}/{orden.lineas_totales} líneas</div>
                  {orden.picker_asignado && (
                    <div className="text-xs text-slate-500">{orden.picker_asignado}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}