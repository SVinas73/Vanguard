'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Product, Almacen, Movement } from '@/types';
import {
  ArrowRight, Search, RefreshCw, Eye, Plus,
  ChevronRight, X, Check, Package, MapPin,
  AlertTriangle, Clock, CheckCircle, Truck,
  ArrowLeftRight, Filter, Calendar, User,
  Play, Pause, RotateCcw, Send, Download,
  ArrowDown, ArrowUp, Shuffle, History
} from 'lucide-react';

// ============================================
// TIPOS
// ============================================

type TipoMovimientoWMS = 
  | 'transferencia'      // Entre ubicaciones mismo almacén
  | 'reposicion'         // De almacenamiento a picking
  | 'consolidacion'      // Unificar mismo producto en una ubicación
  | 'reubicacion'        // Cambio de ubicación por slotting
  | 'entrada'            // Desde recepción (tu Movement entrada)
  | 'salida'             // Hacia despacho (tu Movement salida)
  | 'ajuste';            // Ajuste de inventario

type EstadoMovimientoWMS = 'pendiente' | 'en_proceso' | 'completado' | 'cancelado';

interface MovimientoWMS {
  id: string;
  numero: string;
  tipo: TipoMovimientoWMS;
  estado: EstadoMovimientoWMS;
  
  // Producto
  producto_codigo: string;
  producto?: Product;
  cantidad: number;
  unidad_medida?: string;
  lote_numero?: string;
  
  // Origen
  almacen_origen_id?: string;
  almacen_origen?: Almacen;
  ubicacion_origen_codigo?: string;
  
  // Destino
  almacen_destino_id?: string;
  almacen_destino?: Almacen;
  ubicacion_destino_codigo?: string;
  
  // Razón/Notas
  razon?: string;
  notas?: string;
  
  // Relación con Movement original
  movement_id?: number;
  
  // Tracking
  solicitado_por?: string;
  ejecutado_por?: string;
  fecha_solicitud: string;
  fecha_ejecucion?: string;
  
  created_at: string;
}

interface TransferenciaAlmacen {
  id: string;
  numero: string;
  almacen_origen_id: string;
  almacen_origen?: Almacen;
  almacen_destino_id: string;
  almacen_destino?: Almacen;
  estado: 'borrador' | 'enviada' | 'en_transito' | 'recibida' | 'cancelada';
  fecha_solicitud: string;
  fecha_envio?: string;
  fecha_recepcion?: string;
  items: TransferenciaItem[];
  notas?: string;
  solicitado_por?: string;
  enviado_por?: string;
  recibido_por?: string;
}

interface TransferenciaItem {
  id: string;
  transferencia_id: string;
  producto_codigo: string;
  producto?: Product;
  cantidad_solicitada: number;
  cantidad_enviada: number;
  cantidad_recibida: number;
  ubicacion_origen?: string;
  ubicacion_destino?: string;
  lote_numero?: string;
}

type VistaActiva = 'movimientos' | 'transferencias' | 'nuevo' | 'nueva_transferencia' | 'detalle_transferencia';
type FiltroTipo = 'todos' | TipoMovimientoWMS;

// ============================================
// CONFIGURACIONES
// ============================================

const TIPO_MOVIMIENTO_CONFIG: Record<TipoMovimientoWMS, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  transferencia: { label: 'Transferencia', color: 'text-blue-400', bg: 'bg-blue-500/20', icon: ArrowLeftRight },
  reposicion: { label: 'Reposición', color: 'text-purple-400', bg: 'bg-purple-500/20', icon: ArrowDown },
  consolidacion: { label: 'Consolidación', color: 'text-cyan-400', bg: 'bg-cyan-500/20', icon: Package },
  reubicacion: { label: 'Reubicación', color: 'text-orange-400', bg: 'bg-orange-500/20', icon: Shuffle },
  entrada: { label: 'Entrada', color: 'text-emerald-400', bg: 'bg-emerald-500/20', icon: ArrowDown },
  salida: { label: 'Salida', color: 'text-red-400', bg: 'bg-red-500/20', icon: ArrowUp },
  ajuste: { label: 'Ajuste', color: 'text-amber-400', bg: 'bg-amber-500/20', icon: RotateCcw },
};

const ESTADO_MOVIMIENTO_CONFIG: Record<EstadoMovimientoWMS, { label: string; color: string; bg: string }> = {
  pendiente: { label: 'Pendiente', color: 'text-slate-400', bg: 'bg-slate-500/20' },
  en_proceso: { label: 'En Proceso', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  completado: { label: 'Completado', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  cancelado: { label: 'Cancelado', color: 'text-red-400', bg: 'bg-red-500/20' },
};

const ESTADO_TRANSFERENCIA_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  borrador: { label: 'Borrador', color: 'text-slate-400', bg: 'bg-slate-500/20' },
  enviada: { label: 'Enviada', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  en_transito: { label: 'En Tránsito', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  recibida: { label: 'Recibida', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  cancelada: { label: 'Cancelada', color: 'text-red-400', bg: 'bg-red-500/20' },
};

// ============================================
// HELPERS
// ============================================

const formatDateTime = (date: string | null | undefined): string => {
  if (!date) return '-';
  return new Date(date).toLocaleString('es-UY', { 
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
  });
};

const generarNumeroMovimiento = (): string => {
  const now = new Date();
  const seq = Math.floor(Math.random() * 9000) + 1000;
  return `MOV-${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}-${seq}`;
};

const generarNumeroTransferencia = (): string => {
  const now = new Date();
  const seq = Math.floor(Math.random() * 900) + 100;
  return `TRF-${now.getFullYear()}-${seq}`;
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function Movimientos() {
  const [loading, setLoading] = useState(true);
  const [vistaActiva, setVistaActiva] = useState<VistaActiva>('movimientos');
  
  // Datos
  const [productos, setProductos] = useState<Product[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [movimientosWMS, setMovimientosWMS] = useState<MovimientoWMS[]>([]);
  const [movimientosOriginales, setMovimientosOriginales] = useState<Movement[]>([]);
  const [transferencias, setTransferencias] = useState<TransferenciaAlmacen[]>([]);
  const [transferenciaSeleccionada, setTransferenciaSeleccionada] = useState<TransferenciaAlmacen | null>(null);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>('hoy');
  
  // Formulario nuevo movimiento
  const [formMovimiento, setFormMovimiento] = useState({
    tipo: 'transferencia' as TipoMovimientoWMS,
    producto_codigo: '',
    cantidad: '',
    ubicacion_origen: '',
    ubicacion_destino: '',
    lote_numero: '',
    notas: '',
  });
  
  // Formulario nueva transferencia
  const [formTransferencia, setFormTransferencia] = useState({
    almacen_origen_id: '',
    almacen_destino_id: '',
    notas: '',
    items: [] as { producto_codigo: string; cantidad: number; ubicacion_origen?: string }[],
  });
  const [itemTemp, setItemTemp] = useState({ producto_codigo: '', cantidad: '' });
  
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
      // Cargar productos
      const { data: productosData } = await supabase
        .from('productos')
        .select('*')
        .order('descripcion');
      
      if (productosData) {
        setProductos(productosData.map(p => ({
          codigo: p.codigo,
          descripcion: p.descripcion,
          precio: p.precio,
          categoria: p.categoria,
          stock: p.stock,
          stockMinimo: p.stock_minimo,
          almacenId: p.almacen_id,
        })));
      }

      // Cargar almacenes
      const { data: almacenesData } = await supabase
        .from('almacenes')
        .select('*')
        .eq('activo', true)
        .order('es_principal', { ascending: false });
      
      if (almacenesData) {
        setAlmacenes(almacenesData.map(a => ({
          id: a.id,
          codigo: a.codigo,
          nombre: a.nombre,
          direccion: a.direccion,
          ciudad: a.ciudad,
          telefono: a.telefono,
          responsable: a.responsable,
          esPrincipal: a.es_principal,
          activo: a.activo,
        })));
      }

      // Cargar movimientos originales (tu tabla movimientos)
      const { data: movData } = await supabase
        .from('movimientos')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);
      
      if (movData) {
        setMovimientosOriginales(movData.map(m => ({
          id: m.id,
          codigo: m.codigo,
          tipo: m.tipo,
          cantidad: m.cantidad,
          usuario: m.usuario,
          timestamp: new Date(m.timestamp),
          notas: m.notas,
          costoCompra: m.costo_compra,
        })));
        
        // Convertir a MovimientoWMS para mostrar en la lista unificada
        const movWMS: MovimientoWMS[] = movData.map(m => ({
          id: `mov-${m.id}`,
          numero: `MOV-${m.id}`,
          tipo: m.tipo as TipoMovimientoWMS,
          estado: 'completado' as EstadoMovimientoWMS,
          producto_codigo: m.codigo,
          cantidad: m.cantidad,
          notas: m.notas,
          movement_id: m.id,
          solicitado_por: m.usuario,
          ejecutado_por: m.usuario,
          fecha_solicitud: m.timestamp,
          fecha_ejecucion: m.timestamp,
          created_at: m.timestamp,
        }));
        
        setMovimientosWMS(movWMS);
      }

      // Cargar movimientos WMS específicos (si existe la tabla)
      const { data: wmsMovData } = await supabase
        .from('wms_movimientos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (wmsMovData && wmsMovData.length > 0) {
        setMovimientosWMS(prev => [...wmsMovData, ...prev]);
      }

      // Cargar transferencias entre almacenes
      const { data: transData } = await supabase
        .from('transferencias')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (transData) {
        setTransferencias(transData);
      } else {
        // Datos ejemplo si no hay tabla
        setTransferencias([
          {
            id: 't1',
            numero: 'TRF-2024-001',
            almacen_origen_id: almacenesData?.[0]?.id || '1',
            almacen_destino_id: almacenesData?.[1]?.id || '2',
            estado: 'recibida',
            fecha_solicitud: new Date(Date.now() - 172800000).toISOString(),
            fecha_envio: new Date(Date.now() - 86400000).toISOString(),
            fecha_recepcion: new Date().toISOString(),
            items: [],
            solicitado_por: 'admin@example.com',
          }
        ]);
      }
      
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // DATOS COMPUTADOS
  // ============================================

  // Enriquecer movimientos con producto
  const movimientosConProducto = useMemo(() => {
    return movimientosWMS.map(m => ({
      ...m,
      producto: productos.find(p => p.codigo === m.producto_codigo),
      almacen_origen: almacenes.find(a => a.id === m.almacen_origen_id),
      almacen_destino: almacenes.find(a => a.id === m.almacen_destino_id),
    }));
  }, [movimientosWMS, productos, almacenes]);

  // Filtrar movimientos
  const movimientosFiltrados = useMemo(() => {
    return movimientosConProducto.filter(m => {
      // Búsqueda
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!m.numero?.toLowerCase().includes(search) &&
            !m.producto_codigo?.toLowerCase().includes(search) &&
            !m.producto?.descripcion?.toLowerCase().includes(search)) return false;
      }
      
      // Tipo
      if (filtroTipo !== 'todos' && m.tipo !== filtroTipo) return false;
      
      // Estado
      if (filtroEstado !== 'todos' && m.estado !== filtroEstado) return false;
      
      // Período
      if (filtroPeriodo !== 'todos') {
        const fecha = new Date(m.created_at);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        
        if (filtroPeriodo === 'hoy' && fecha < hoy) return false;
        if (filtroPeriodo === 'semana') {
          const hace7Dias = new Date(hoy.getTime() - 7 * 86400000);
          if (fecha < hace7Dias) return false;
        }
        if (filtroPeriodo === 'mes') {
          const hace30Dias = new Date(hoy.getTime() - 30 * 86400000);
          if (fecha < hace30Dias) return false;
        }
      }
      
      return true;
    });
  }, [movimientosConProducto, searchTerm, filtroTipo, filtroEstado, filtroPeriodo]);

  // Enriquecer transferencias
  const transferenciasConDatos = useMemo(() => {
    return transferencias.map(t => ({
      ...t,
      almacen_origen: almacenes.find(a => a.id === t.almacen_origen_id),
      almacen_destino: almacenes.find(a => a.id === t.almacen_destino_id),
    }));
  }, [transferencias, almacenes]);

  // Stats
  const stats = useMemo(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const movHoy = movimientosWMS.filter(m => new Date(m.created_at) >= hoy);
    const entradas = movHoy.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.cantidad, 0);
    const salidas = movHoy.filter(m => m.tipo === 'salida').reduce((s, m) => s + m.cantidad, 0);
    const transferenciasActivas = transferencias.filter(t => ['enviada', 'en_transito'].includes(t.estado)).length;
    const pendientes = movimientosWMS.filter(m => m.estado === 'pendiente').length;
    
    return { movHoy: movHoy.length, entradas, salidas, transferenciasActivas, pendientes };
  }, [movimientosWMS, transferencias]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleCrearMovimiento = async () => {
    if (!formMovimiento.producto_codigo || !formMovimiento.cantidad) return;
    
    setSaving(true);
    try {
      const cantidad = parseInt(formMovimiento.cantidad) || 0;
      
      const nuevoMov: MovimientoWMS = {
        id: `wms-${Date.now()}`,
        numero: generarNumeroMovimiento(),
        tipo: formMovimiento.tipo,
        estado: 'pendiente',
        producto_codigo: formMovimiento.producto_codigo,
        cantidad,
        ubicacion_origen_codigo: formMovimiento.ubicacion_origen || undefined,
        ubicacion_destino_codigo: formMovimiento.ubicacion_destino || undefined,
        lote_numero: formMovimiento.lote_numero || undefined,
        notas: formMovimiento.notas || undefined,
        fecha_solicitud: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      
      setMovimientosWMS(prev => [nuevoMov, ...prev]);
      
      // Resetear form
      setFormMovimiento({
        tipo: 'transferencia',
        producto_codigo: '',
        cantidad: '',
        ubicacion_origen: '',
        ubicacion_destino: '',
        lote_numero: '',
        notas: '',
      });
      
      setVistaActiva('movimientos');
      
    } finally {
      setSaving(false);
    }
  };

  const handleEjecutarMovimiento = async (movId: string) => {
    const mov = movimientosWMS.find(m => m.id === movId);
    if (!mov) return;
    
    setSaving(true);
    try {
      // Actualizar estado
      setMovimientosWMS(prev => prev.map(m => 
        m.id === movId 
          ? { ...m, estado: 'completado' as EstadoMovimientoWMS, fecha_ejecucion: new Date().toISOString() }
          : m
      ));
      
      // Si es entrada/salida, también crear en tabla movimientos original para mantener sincronía
      if (mov.tipo === 'entrada' || mov.tipo === 'salida') {
        // Actualizar stock del producto
        const producto = productos.find(p => p.codigo === mov.producto_codigo);
        if (producto) {
          const nuevoStock = mov.tipo === 'entrada' 
            ? producto.stock + mov.cantidad 
            : producto.stock - mov.cantidad;
          
          await supabase
            .from('productos')
            .update({ stock: Math.max(0, nuevoStock) })
            .eq('codigo', mov.producto_codigo);
          
          // Crear movimiento en tabla original
          await supabase.from('movimientos').insert({
            codigo: mov.producto_codigo,
            tipo: mov.tipo,
            cantidad: mov.cantidad,
            usuario: 'wms_system',
            notas: `[WMS] ${mov.notas || ''} - Ubicación: ${mov.ubicacion_origen_codigo || ''} → ${mov.ubicacion_destino_codigo || ''}`,
          });
        }
      }
      
    } finally {
      setSaving(false);
    }
  };

  const handleCancelarMovimiento = (movId: string) => {
    setMovimientosWMS(prev => prev.map(m => 
      m.id === movId ? { ...m, estado: 'cancelado' as EstadoMovimientoWMS } : m
    ));
  };

  const handleAgregarItemTransferencia = () => {
    if (!itemTemp.producto_codigo || !itemTemp.cantidad) return;
    
    setFormTransferencia(prev => ({
      ...prev,
      items: [...prev.items, { 
        producto_codigo: itemTemp.producto_codigo, 
        cantidad: parseInt(itemTemp.cantidad) || 0 
      }],
    }));
    setItemTemp({ producto_codigo: '', cantidad: '' });
  };

  const handleCrearTransferencia = async () => {
    if (!formTransferencia.almacen_origen_id || 
        !formTransferencia.almacen_destino_id || 
        formTransferencia.items.length === 0) return;
    
    setSaving(true);
    try {
      const nuevaTrans: TransferenciaAlmacen = {
        id: `trf-${Date.now()}`,
        numero: generarNumeroTransferencia(),
        almacen_origen_id: formTransferencia.almacen_origen_id,
        almacen_destino_id: formTransferencia.almacen_destino_id,
        estado: 'borrador',
        fecha_solicitud: new Date().toISOString(),
        items: formTransferencia.items.map((item, idx) => ({
          id: `item-${idx}`,
          transferencia_id: '',
          producto_codigo: item.producto_codigo,
          cantidad_solicitada: item.cantidad,
          cantidad_enviada: 0,
          cantidad_recibida: 0,
          ubicacion_origen: item.ubicacion_origen,
        })),
        notas: formTransferencia.notas || undefined,
      };
      
      setTransferencias(prev => [nuevaTrans, ...prev]);
      
      // Resetear form
      setFormTransferencia({
        almacen_origen_id: '',
        almacen_destino_id: '',
        notas: '',
        items: [],
      });
      
      setVistaActiva('transferencias');
      
    } finally {
      setSaving(false);
    }
  };

  const handleEnviarTransferencia = (transId: string) => {
    setTransferencias(prev => prev.map(t => 
      t.id === transId 
        ? { ...t, estado: 'enviada' as const, fecha_envio: new Date().toISOString() }
        : t
    ));
  };

  const handleRecibirTransferencia = async (transId: string) => {
    const trans = transferencias.find(t => t.id === transId);
    if (!trans) return;
    
    setSaving(true);
    try {
      // Actualizar stock: restar del origen, sumar al destino
      for (const item of trans.items) {
        const producto = productos.find(p => p.codigo === item.producto_codigo);
        if (producto) {
          // En un sistema real actualizarías stock_almacen, aquí simplificamos
          await supabase
            .from('productos')
            .update({ almacen_id: trans.almacen_destino_id })
            .eq('codigo', item.producto_codigo);
        }
      }
      
      setTransferencias(prev => prev.map(t => 
        t.id === transId 
          ? { 
              ...t, 
              estado: 'recibida' as const, 
              fecha_recepcion: new Date().toISOString(),
              items: t.items.map(i => ({ ...i, cantidad_recibida: i.cantidad_solicitada }))
            }
          : t
      ));
      
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
        <RefreshCw className="h-8 w-8 animate-spin text-orange-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs principales */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        {[
          { id: 'movimientos' as const, label: 'Movimientos', icon: ArrowLeftRight, count: stats.movHoy },
          { id: 'transferencias' as const, label: 'Transferencias', icon: Truck, count: stats.transferenciasActivas },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setVistaActiva(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                vistaActiva === tab.id
                  ? 'bg-orange-500/20 text-orange-400'
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

      {/* ==================== MOVIMIENTOS ==================== */}
      {vistaActiva === 'movimientos' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-slate-200">{stats.movHoy}</div>
              <div className="text-xs text-slate-400">Mov. Hoy</div>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-emerald-400">+{stats.entradas}</div>
              <div className="text-xs text-emerald-400">Entradas</div>
            </div>
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-red-400">-{stats.salidas}</div>
              <div className="text-xs text-red-400">Salidas</div>
            </div>
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-purple-400">{stats.transferenciasActivas}</div>
              <div className="text-xs text-purple-400">En Tránsito</div>
            </div>
            {stats.pendientes > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-amber-400">{stats.pendientes}</div>
                <div className="text-xs text-amber-400">Pendientes</div>
              </div>
            )}
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-3 items-center flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar movimiento, producto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
                />
              </div>
              
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value as FiltroTipo)}
                className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
              >
                <option value="todos">Todos los tipos</option>
                {Object.entries(TIPO_MOVIMIENTO_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              
              <select
                value={filtroPeriodo}
                onChange={(e) => setFiltroPeriodo(e.target.value)}
                className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
              >
                <option value="hoy">Hoy</option>
                <option value="semana">Última semana</option>
                <option value="mes">Último mes</option>
                <option value="todos">Todo</option>
              </select>
              
              <button onClick={loadData} className="p-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-400">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            
            <button
              onClick={() => setVistaActiva('nuevo')}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-medium"
            >
              <Plus className="h-4 w-4" />
              Nuevo Movimiento
            </button>
          </div>

          {/* Lista de movimientos */}
          <div className="space-y-2">
            {movimientosFiltrados.map(mov => {
              const tipoConfig = TIPO_MOVIMIENTO_CONFIG[mov.tipo] || TIPO_MOVIMIENTO_CONFIG.transferencia;
              const estadoConfig = ESTADO_MOVIMIENTO_CONFIG[mov.estado];
              const TipoIcon = tipoConfig.icon;
              
              return (
                <div key={mov.id} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-xl ${tipoConfig.bg}`}>
                        <TipoIcon className={`h-5 w-5 ${tipoConfig.color}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm text-orange-400">{mov.numero}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${estadoConfig.bg} ${estadoConfig.color}`}>
                            {estadoConfig.label}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${tipoConfig.bg} ${tipoConfig.color}`}>
                            {tipoConfig.label}
                          </span>
                        </div>
                        <div className="text-sm text-slate-200">
                          {mov.producto?.descripcion || mov.producto_codigo}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                          {mov.ubicacion_origen_codigo && (
                            <span className="font-mono">{mov.ubicacion_origen_codigo}</span>
                          )}
                          {mov.ubicacion_origen_codigo && mov.ubicacion_destino_codigo && (
                            <ArrowRight className="h-3 w-3" />
                          )}
                          {mov.ubicacion_destino_codigo && (
                            <span className="font-mono text-emerald-400">{mov.ubicacion_destino_codigo}</span>
                          )}
                          <span>•</span>
                          <span>{formatDateTime(mov.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className={`text-xl font-bold ${
                        mov.tipo === 'entrada' ? 'text-emerald-400' :
                        mov.tipo === 'salida' ? 'text-red-400' : 'text-slate-200'
                      }`}>
                        {mov.tipo === 'entrada' ? '+' : mov.tipo === 'salida' ? '-' : ''}{mov.cantidad}
                      </div>
                      
                      {mov.estado === 'pendiente' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEjecutarMovimiento(mov.id)}
                            disabled={saving}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm"
                          >
                            Ejecutar
                          </button>
                          <button
                            onClick={() => handleCancelarMovimiento(mov.id)}
                            className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-400 rounded-lg"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {movimientosFiltrados.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No hay movimientos en este período</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ==================== TRANSFERENCIAS ==================== */}
      {vistaActiva === 'transferencias' && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Truck className="h-6 w-6 text-orange-400" />
              Transferencias entre Almacenes
            </h3>
            
            <button
              onClick={() => setVistaActiva('nueva_transferencia')}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-medium"
            >
              <Plus className="h-4 w-4" />
              Nueva Transferencia
            </button>
          </div>

          <div className="space-y-3">
            {transferenciasConDatos.map(trans => {
              const estadoConfig = ESTADO_TRANSFERENCIA_CONFIG[trans.estado];
              
              return (
                <div key={trans.id} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm text-orange-400">{trans.numero}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${estadoConfig.bg} ${estadoConfig.color}`}>
                          {estadoConfig.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-slate-200">{trans.almacen_origen?.nombre || 'Origen'}</span>
                        <ArrowRight className="h-4 w-4 text-slate-500" />
                        <span className="text-emerald-400 font-medium">{trans.almacen_destino?.nombre || 'Destino'}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {trans.items.length} producto(s) • {formatDateTime(trans.fecha_solicitud)}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      {trans.estado === 'borrador' && (
                        <button
                          onClick={() => handleEnviarTransferencia(trans.id)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm flex items-center gap-1"
                        >
                          <Send className="h-4 w-4" />
                          Enviar
                        </button>
                      )}
                      {(trans.estado === 'enviada' || trans.estado === 'en_transito') && (
                        <button
                          onClick={() => handleRecibirTransferencia(trans.id)}
                          disabled={saving}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm flex items-center gap-1"
                        >
                          <Check className="h-4 w-4" />
                          Recibir
                        </button>
                      )}
                      <button
                        onClick={() => { setTransferenciaSeleccionada(trans); setVistaActiva('detalle_transferencia'); }}
                        className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-400 rounded-lg"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {transferenciasConDatos.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <Truck className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No hay transferencias</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ==================== NUEVO MOVIMIENTO ==================== */}
      {vistaActiva === 'nuevo' && (
        <NuevoMovimientoForm
          productos={productos}
          form={formMovimiento}
          setForm={setFormMovimiento}
          onGuardar={handleCrearMovimiento}
          onCancelar={() => setVistaActiva('movimientos')}
          saving={saving}
        />
      )}

      {/* ==================== NUEVA TRANSFERENCIA ==================== */}
      {vistaActiva === 'nueva_transferencia' && (
        <NuevaTransferenciaForm
          almacenes={almacenes}
          productos={productos}
          form={formTransferencia}
          setForm={setFormTransferencia}
          itemTemp={itemTemp}
          setItemTemp={setItemTemp}
          onAgregarItem={handleAgregarItemTransferencia}
          onGuardar={handleCrearTransferencia}
          onCancelar={() => setVistaActiva('transferencias')}
          saving={saving}
        />
      )}

      {/* ==================== DETALLE TRANSFERENCIA ==================== */}
      {vistaActiva === 'detalle_transferencia' && transferenciaSeleccionada && (
        <DetalleTransferencia
          transferencia={transferenciaSeleccionada}
          almacenes={almacenes}
          productos={productos}
          onVolver={() => setVistaActiva('transferencias')}
          onEnviar={() => handleEnviarTransferencia(transferenciaSeleccionada.id)}
          onRecibir={() => handleRecibirTransferencia(transferenciaSeleccionada.id)}
          saving={saving}
        />
      )}
    </div>
  );
}

// ============================================
// SUB-COMPONENTES
// ============================================

interface NuevoMovimientoFormProps {
  productos: Product[];
  form: any;
  setForm: (f: any) => void;
  onGuardar: () => void;
  onCancelar: () => void;
  saving: boolean;
}

function NuevoMovimientoForm({ productos, form, setForm, onGuardar, onCancelar, saving }: NuevoMovimientoFormProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onCancelar} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400">
          <X className="h-5 w-5" />
        </button>
        <h3 className="text-xl font-bold text-slate-100">Nuevo Movimiento</h3>
      </div>

      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de Movimiento *</label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(TIPO_MOVIMIENTO_CONFIG).filter(([k]) => !['entrada', 'salida'].includes(k)).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm({ ...form, tipo: key })}
                  className={`p-3 rounded-xl border text-sm flex flex-col items-center gap-2 transition-colors ${
                    form.tipo === key 
                      ? `${config.bg} border-current ${config.color}`
                      : 'border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {config.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Producto *</label>
          <select
            value={form.producto_codigo}
            onChange={(e) => setForm({ ...form, producto_codigo: e.target.value })}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
          >
            <option value="">Seleccionar producto</option>
            {productos.map(p => (
              <option key={p.codigo} value={p.codigo}>
                {p.codigo} - {p.descripcion} (Stock: {p.stock})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Cantidad *</label>
            <input
              type="number"
              min={1}
              value={form.cantidad}
              onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="0"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Ubicación Origen</label>
            <input
              type="text"
              value={form.ubicacion_origen}
              onChange={(e) => setForm({ ...form, ubicacion_origen: e.target.value.toUpperCase() })}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 font-mono"
              placeholder="A-01-02-01"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Ubicación Destino</label>
            <input
              type="text"
              value={form.ubicacion_destino}
              onChange={(e) => setForm({ ...form, ubicacion_destino: e.target.value.toUpperCase() })}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 font-mono"
              placeholder="B-03-01-02"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Notas</label>
          <textarea
            value={form.notas}
            onChange={(e) => setForm({ ...form, notas: e.target.value })}
            rows={2}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 resize-none"
            placeholder="Observaciones..."
          />
        </div>
      </div>

      <div className="flex justify-between">
        <button onClick={onCancelar} className="px-4 py-2 text-slate-400">Cancelar</button>
        <button
          onClick={onGuardar}
          disabled={saving || !form.producto_codigo || !form.cantidad}
          className="flex items-center gap-2 px-6 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-slate-700 text-white rounded-xl font-medium"
        >
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Crear Movimiento
        </button>
      </div>
    </div>
  );
}

interface NuevaTransferenciaFormProps {
  almacenes: Almacen[];
  productos: Product[];
  form: any;
  setForm: (f: any) => void;
  itemTemp: { producto_codigo: string; cantidad: string };
  setItemTemp: (i: any) => void;
  onAgregarItem: () => void;
  onGuardar: () => void;
  onCancelar: () => void;
  saving: boolean;
}

function NuevaTransferenciaForm({ 
  almacenes, productos, form, setForm, itemTemp, setItemTemp, 
  onAgregarItem, onGuardar, onCancelar, saving 
}: NuevaTransferenciaFormProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onCancelar} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400">
          <X className="h-5 w-5" />
        </button>
        <h3 className="text-xl font-bold text-slate-100">Nueva Transferencia</h3>
      </div>

      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Almacén Origen *</label>
            <select
              value={form.almacen_origen_id}
              onChange={(e) => setForm({ ...form, almacen_origen_id: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            >
              <option value="">Seleccionar</option>
              {almacenes.map(a => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Almacén Destino *</label>
            <select
              value={form.almacen_destino_id}
              onChange={(e) => setForm({ ...form, almacen_destino_id: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            >
              <option value="">Seleccionar</option>
              {almacenes.filter(a => a.id !== form.almacen_origen_id).map(a => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Agregar productos */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Productos a Transferir</label>
          <div className="flex gap-2 mb-3">
            <select
              value={itemTemp.producto_codigo}
              onChange={(e) => setItemTemp({ ...itemTemp, producto_codigo: e.target.value })}
              className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            >
              <option value="">Seleccionar producto</option>
              {productos.map(p => (
                <option key={p.codigo} value={p.codigo}>
                  {p.codigo} - {p.descripcion}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={itemTemp.cantidad}
              onChange={(e) => setItemTemp({ ...itemTemp, cantidad: e.target.value })}
              placeholder="Cant."
              className="w-24 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            />
            <button
              onClick={onAgregarItem}
              disabled={!itemTemp.producto_codigo || !itemTemp.cantidad}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-slate-200 rounded-xl"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
          
          {form.items.length > 0 && (
            <div className="space-y-2">
              {form.items.map((item: any, idx: number) => {
                const producto = productos.find(p => p.codigo === item.producto_codigo);
                return (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                    <div>
                      <span className="text-sm text-slate-200">{producto?.descripcion || item.producto_codigo}</span>
                      <span className="text-xs text-slate-500 ml-2">{item.producto_codigo}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-200">{item.cantidad}</span>
                      <button
                        onClick={() => setForm({ ...form, items: form.items.filter((_: any, i: number) => i !== idx) })}
                        className="p-1 text-slate-500 hover:text-red-400"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Notas</label>
          <textarea
            value={form.notas}
            onChange={(e) => setForm({ ...form, notas: e.target.value })}
            rows={2}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 resize-none"
            placeholder="Observaciones..."
          />
        </div>
      </div>

      <div className="flex justify-between">
        <button onClick={onCancelar} className="px-4 py-2 text-slate-400">Cancelar</button>
        <button
          onClick={onGuardar}
          disabled={saving || !form.almacen_origen_id || !form.almacen_destino_id || form.items.length === 0}
          className="flex items-center gap-2 px-6 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-slate-700 text-white rounded-xl font-medium"
        >
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Crear Transferencia
        </button>
      </div>
    </div>
  );
}

interface DetalleTransferenciaProps {
  transferencia: TransferenciaAlmacen;
  almacenes: Almacen[];
  productos: Product[];
  onVolver: () => void;
  onEnviar: () => void;
  onRecibir: () => void;
  saving: boolean;
}

function DetalleTransferencia({ 
  transferencia, almacenes, productos, onVolver, onEnviar, onRecibir, saving 
}: DetalleTransferenciaProps) {
  const almacenOrigen = almacenes.find(a => a.id === transferencia.almacen_origen_id);
  const almacenDestino = almacenes.find(a => a.id === transferencia.almacen_destino_id);
  const estadoConfig = ESTADO_TRANSFERENCIA_CONFIG[transferencia.estado];
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onVolver} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400">
            <ChevronRight className="h-5 w-5 rotate-180" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-lg text-orange-400">{transferencia.numero}</span>
              <span className={`px-2 py-1 rounded-full text-xs ${estadoConfig.bg} ${estadoConfig.color}`}>
                {estadoConfig.label}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          {transferencia.estado === 'borrador' && (
            <button
              onClick={onEnviar}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              Enviar
            </button>
          )}
          {(transferencia.estado === 'enviada' || transferencia.estado === 'en_transito') && (
            <button
              onClick={onRecibir}
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center gap-2"
            >
              <Check className="h-4 w-4" />
              Recibir
            </button>
          )}
        </div>
      </div>

      {/* Info de almacenes */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 text-center">
          <div className="text-xs text-slate-500 mb-1">Origen</div>
          <div className="font-semibold text-slate-200">{almacenOrigen?.nombre || '-'}</div>
        </div>
        <div className="flex items-center justify-center">
          <ArrowRight className="h-8 w-8 text-slate-600" />
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
          <div className="text-xs text-emerald-400 mb-1">Destino</div>
          <div className="font-semibold text-emerald-400">{almacenDestino?.nombre || '-'}</div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800/50">
          <h4 className="font-semibold text-slate-200">Productos ({transferencia.items.length})</h4>
        </div>
        <div className="divide-y divide-slate-800/50">
          {transferencia.items.map(item => {
            const producto = productos.find(p => p.codigo === item.producto_codigo);
            return (
              <div key={item.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-200">{producto?.descripcion || item.producto_codigo}</div>
                  <div className="text-xs text-slate-500 font-mono">{item.producto_codigo}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-200">{item.cantidad_solicitada}</div>
                  {transferencia.estado === 'recibida' && (
                    <div className="text-xs text-emerald-400">Recibido: {item.cantidad_recibida}</div>
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