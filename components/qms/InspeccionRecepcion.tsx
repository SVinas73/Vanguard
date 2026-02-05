'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ClipboardCheck, Package, Search, Plus, Filter, Download,
  CheckCircle, XCircle, Clock, AlertTriangle, Eye, Edit,
  Camera, FileText, Truck, Building2, Calendar, User,
  ChevronRight, ChevronDown, MoreHorizontal, RefreshCw,
  Save, X, Upload, Trash2, AlertCircle, CheckSquare,
  Square, ArrowRight, Barcode, Scale, Ruler, ThermometerSun,
  FileCheck, Send, RotateCcw, Pause, Play, History,
  ClipboardList, Target, Zap, Info, HelpCircle, Printer
} from 'lucide-react';
import {
  QMSInspeccion, QMSPlanInspeccion, QMSCaracteristica, QMSResultadoInspeccion,
  QMS_ESTADO_INSPECCION_CONFIG, QMS_SEVERIDAD_NCR_CONFIG,
  EstadoInspeccion, DecisionInspeccion, TipoInspeccion, TipoDefecto,
  calcularTamanioMuestraAQL, formatearNumeroQMS, getDiasParaFecha,
  Proveedor, OrdenCompra, Product, Lote
} from '@/types';

// ============================================
// TIPOS LOCALES
// ============================================

interface InspeccionFormData {
  plan_id: string;
  tipo: TipoInspeccion;
  producto_id: string;
  producto_codigo: string;
  producto_descripcion: string;
  lote_id?: string;
  lote_numero?: string;
  orden_compra_id?: string;
  orden_compra_numero?: string;
  proveedor_id?: string;
  proveedor_nombre?: string;
  cantidad_recibida: number;
  cantidad_muestra: number;
  inspector: string;
  observaciones?: string;
}

interface ResultadoForm {
  caracteristica_id: string;
  caracteristica: QMSCaracteristica;
  valor_medido?: number;
  valor_texto?: string;
  conforme?: boolean;
  cantidad_defectos: number;
  tipo_defecto?: TipoDefecto;
  descripcion_defecto?: string;
  fotos: string[];
}

type VistaActiva = 'lista' | 'nueva' | 'detalle' | 'ejecutar';

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function InspeccionRecepcion() {
  // Estado principal
  const [loading, setLoading] = useState(true);
  const [vistaActiva, setVistaActiva] = useState<VistaActiva>('lista');
  const [inspeccionSeleccionada, setInspeccionSeleccionada] = useState<QMSInspeccion | null>(null);
  
  // Datos
  const [inspecciones, setInspecciones] = useState<QMSInspeccion[]>([]);
  const [planes, setPlanes] = useState<QMSPlanInspeccion[]>([]);
  const [productos, setProductos] = useState<Product[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [ordenesCompra, setOrdenesCompra] = useState<OrdenCompra[]>([]);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>('todos');
  
  // Form nueva inspección
  const [formData, setFormData] = useState<InspeccionFormData>({
    plan_id: '',
    tipo: 'recepcion',
    producto_id: '',
    producto_codigo: '',
    producto_descripcion: '',
    cantidad_recibida: 0,
    cantidad_muestra: 0,
    inspector: '',
  });
  
  // Resultados de inspección
  const [resultados, setResultados] = useState<ResultadoForm[]>([]);
  const [pasoActual, setPasoActual] = useState(1);
  
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
        loadInspecciones(),
        loadPlanes(),
        loadProductos(),
        loadProveedores(),
        loadOrdenesCompra(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInspecciones = async () => {
    const { data, error } = await supabase
      .from('qms_inspecciones')
      .select('*')
      .eq('tipo', 'recepcion')
      .order('fecha_inspeccion', { ascending: false })
      .limit(200);

    if (!error && data) {
      setInspecciones(data);
    }
  };

  const loadPlanes = async () => {
    const { data, error } = await supabase
      .from('qms_planes_inspeccion')
      .select(`
        *,
        caracteristicas:qms_caracteristicas(*)
      `)
      .eq('activo', true)
      .in('tipo', ['recepcion', 'todos']);

    if (!error && data) {
      setPlanes(data);
    }
  };

  const loadProductos = async () => {
    const { data, error } = await supabase
      .from('productos')
      .select('codigo, descripcion, categoria, precio')
      .eq('activo', true)
      .order('descripcion');

    if (!error && data) {
      setProductos(data as any);
    }
  };

  const loadProveedores = async () => {
    const { data, error } = await supabase
      .from('proveedores')
      .select('id, codigo, nombre')
      .eq('activo', true)
      .order('nombre');

    if (!error && data) {
      setProveedores(data as any);
    }
  };

  const loadOrdenesCompra = async () => {
    const { data, error } = await supabase
      .from('ordenes_compra')
      .select(`
        id, numero, proveedor_id, estado, fecha_orden,
        proveedor:proveedores(nombre)
      `)
      .in('estado', ['enviada', 'parcial'])
      .order('fecha_orden', { ascending: false })
      .limit(50);

    if (!error && data) {
      setOrdenesCompra(data as any);
    }
  };

  // ============================================
  // FILTRADO DE INSPECCIONES
  // ============================================

  const inspeccionesFiltradas = useMemo(() => {
    return inspecciones.filter(insp => {
      // Búsqueda
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchNumero = insp.numero?.toLowerCase().includes(search);
        const matchProducto = insp.producto_codigo?.toLowerCase().includes(search) ||
                             insp.producto_descripcion?.toLowerCase().includes(search);
        const matchProveedor = insp.proveedor_nombre?.toLowerCase().includes(search);
        const matchOC = insp.orden_compra_numero?.toLowerCase().includes(search);
        
        if (!matchNumero && !matchProducto && !matchProveedor && !matchOC) return false;
      }
      
      // Filtro estado
      if (filtroEstado !== 'todos' && insp.estado !== filtroEstado) return false;
      
      // Filtro tipo
      if (filtroTipo !== 'todos' && insp.tipo !== filtroTipo) return false;
      
      // Filtro período
      if (filtroPeriodo !== 'todos') {
        const fecha = new Date(insp.fecha_inspeccion);
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
  }, [inspecciones, searchTerm, filtroEstado, filtroTipo, filtroPeriodo]);

  // ============================================
  // ESTADÍSTICAS
  // ============================================

  const stats = useMemo(() => {
    const hoy = new Date().toDateString();
    const pendientes = inspecciones.filter(i => i.estado === 'pendiente').length;
    const enProceso = inspecciones.filter(i => i.estado === 'en_proceso').length;
    const aprobadas = inspecciones.filter(i => i.estado === 'aprobado').length;
    const rechazadas = inspecciones.filter(i => i.estado === 'rechazado').length;
    const hoyCount = inspecciones.filter(i => new Date(i.fecha_inspeccion).toDateString() === hoy).length;
    
    const completadas = aprobadas + rechazadas + 
      inspecciones.filter(i => i.estado === 'aprobado_condicional').length;
    const tasaAprobacion = completadas > 0 ? (aprobadas / completadas) * 100 : 100;
    
    return { pendientes, enProceso, aprobadas, rechazadas, hoyCount, tasaAprobacion };
  }, [inspecciones]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleNuevaInspeccion = () => {
    setFormData({
      plan_id: planes[0]?.id || '',
      tipo: 'recepcion',
      producto_id: '',
      producto_codigo: '',
      producto_descripcion: '',
      cantidad_recibida: 0,
      cantidad_muestra: 0,
      inspector: '',
    });
    setResultados([]);
    setPasoActual(1);
    setVistaActiva('nueva');
  };

  const handleSelectProducto = (producto: Product) => {
    setFormData(prev => ({
      ...prev,
      producto_id: producto.codigo,
      producto_codigo: producto.codigo,
      producto_descripcion: producto.descripcion,
    }));
  };

  const handleSelectOrdenCompra = (oc: OrdenCompra) => {
    const proveedor = proveedores.find(p => p.id === oc.proveedor_id);
    setFormData(prev => ({
      ...prev,
      orden_compra_id: oc.id,
      orden_compra_numero: oc.numero,
      proveedor_id: oc.proveedor_id,
      proveedor_nombre: proveedor?.nombre || (oc as any).proveedor?.nombre,
    }));
  };

  const handleCantidadChange = (cantidad: number) => {
    const plan = planes.find(p => p.id === formData.plan_id);
    let muestra = cantidad;
    
    if (plan) {
      switch (plan.metodo_muestreo) {
        case 'aql':
          muestra = calcularTamanioMuestraAQL(cantidad, 'II');
          break;
        case 'porcentaje':
          muestra = Math.ceil(cantidad * (plan.porcentaje_muestra || 10) / 100);
          break;
        case 'fijo':
          muestra = Math.min(cantidad, plan.cantidad_fija || 5);
          break;
        case '100%':
          muestra = cantidad;
          break;
      }
    }
    
    setFormData(prev => ({
      ...prev,
      cantidad_recibida: cantidad,
      cantidad_muestra: muestra,
    }));
  };

  const handlePlanChange = (planId: string) => {
    const plan = planes.find(p => p.id === planId);
    setFormData(prev => ({ ...prev, plan_id: planId }));
    
    if (plan?.caracteristicas) {
      setResultados(plan.caracteristicas
        .filter(c => c.activo)
        .sort((a, b) => a.orden - b.orden)
        .map(c => ({
          caracteristica_id: c.id,
          caracteristica: c,
          conforme: undefined,
          cantidad_defectos: 0,
          fotos: [],
        }))
      );
    }
    
    // Recalcular muestra
    if (formData.cantidad_recibida > 0) {
      handleCantidadChange(formData.cantidad_recibida);
    }
  };

  const handleResultadoChange = (index: number, field: keyof ResultadoForm, value: any) => {
    setResultados(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      
      // Auto-determinar conformidad para características numéricas
      const car = updated[index].caracteristica;
      if (field === 'valor_medido' && car.valor_nominal !== undefined) {
        const valor = value as number;
        const min = car.tolerancia_min ?? -Infinity;
        const max = car.tolerancia_max ?? Infinity;
        updated[index].conforme = valor >= min && valor <= max;
      }
      
      return updated;
    });
  };

  const handleGuardarInspeccion = async (estado: EstadoInspeccion = 'pendiente') => {
    try {
      setSaving(true);
      
      // Generar número
      const { data: lastInsp } = await supabase
        .from('qms_inspecciones')
        .select('numero')
        .order('creado_at', { ascending: false })
        .limit(1)
        .single();
      
      const lastSeq = lastInsp?.numero ? parseInt(lastInsp.numero.split('-')[2]) : 0;
      const numero = formatearNumeroQMS('INS', lastSeq + 1);
      
      // Calcular cantidades
      const aceptados = resultados.filter(r => r.conforme === true).length;
      const rechazados = resultados.filter(r => r.conforme === false).length;
      
      // Crear inspección
      const { data: inspeccion, error } = await supabase
        .from('qms_inspecciones')
        .insert({
          numero,
          plan_id: formData.plan_id || null,
          tipo: formData.tipo,
          producto_codigo: formData.producto_codigo,
          producto_descripcion: formData.producto_descripcion,
          lote_numero: formData.lote_numero || null,
          orden_compra_id: formData.orden_compra_id || null,
          orden_compra_numero: formData.orden_compra_numero || null,
          proveedor_id: formData.proveedor_id || null,
          proveedor_nombre: formData.proveedor_nombre || null,
          cantidad_recibida: formData.cantidad_recibida,
          cantidad_muestra: formData.cantidad_muestra,
          cantidad_aceptada: aceptados,
          cantidad_rechazada: rechazados,
          estado,
          inspector: formData.inspector,
          observaciones: formData.observaciones || null,
          fecha_inspeccion: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Guardar resultados si hay
      if (resultados.length > 0 && inspeccion) {
        const resultadosData = resultados.map(r => ({
          inspeccion_id: inspeccion.id,
          caracteristica_id: r.caracteristica_id,
          valor_medido: r.valor_medido || null,
          valor_texto: r.valor_texto || null,
          conforme: r.conforme,
          cantidad_defectos: r.cantidad_defectos,
          tipo_defecto: r.tipo_defecto || null,
          descripcion_defecto: r.descripcion_defecto || null,
          fotos: r.fotos.length > 0 ? r.fotos.map(url => ({ url })) : null,
        }));
        
        await supabase.from('qms_resultados_inspeccion').insert(resultadosData);
      }
      
      // Recargar y volver a lista
      await loadInspecciones();
      setVistaActiva('lista');
      
    } catch (error) {
      console.error('Error guardando inspección:', error);
      alert('Error al guardar la inspección');
    } finally {
      setSaving(false);
    }
  };

  const handleTomarDecision = async (inspeccionId: string, decision: DecisionInspeccion) => {
    try {
      setSaving(true);
      
      let estado: EstadoInspeccion = 'aprobado';
      if (decision === 'rechazar' || decision === 'devolver') {
        estado = 'rechazado';
      } else if (decision === 'usar_como_esta' || decision === 'concesion') {
        estado = 'aprobado_condicional';
      } else if (decision === 'retrabajo') {
        estado = 'retenido';
      }
      
      const { error } = await supabase
        .from('qms_inspecciones')
        .update({
          estado,
          decision,
          fecha_decision: new Date().toISOString(),
          supervisor_calidad: 'Usuario Actual', // TODO: usar usuario real
        })
        .eq('id', inspeccionId);
      
      if (error) throw error;
      
      // Si es rechazado, crear NCR automáticamente
      if (estado === 'rechazado') {
        // TODO: Crear NCR automática
      }
      
      await loadInspecciones();
      setVistaActiva('lista');
      
    } catch (error) {
      console.error('Error al tomar decisión:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleVerDetalle = async (inspeccion: QMSInspeccion) => {
    // Cargar resultados
    const { data: resultadosData } = await supabase
      .from('qms_resultados_inspeccion')
      .select(`
        *,
        caracteristica:qms_caracteristicas(*)
      `)
      .eq('inspeccion_id', inspeccion.id);
    
    setInspeccionSeleccionada({
      ...inspeccion,
      resultados: resultadosData || [],
    });
    setVistaActiva('detalle');
  };

  const handleEjecutarInspeccion = (inspeccion: QMSInspeccion) => {
    // Cargar plan y características
    const plan = planes.find(p => p.id === inspeccion.plan_id);
    
    setFormData({
      plan_id: inspeccion.plan_id || '',
      tipo: inspeccion.tipo,
      producto_id: inspeccion.producto_id || '',
      producto_codigo: inspeccion.producto_codigo,
      producto_descripcion: inspeccion.producto_descripcion,
      lote_numero: inspeccion.lote_numero,
      orden_compra_id: inspeccion.orden_compra_id,
      orden_compra_numero: inspeccion.orden_compra_numero,
      proveedor_id: inspeccion.proveedor_id,
      proveedor_nombre: inspeccion.proveedor_nombre,
      cantidad_recibida: inspeccion.cantidad_recibida,
      cantidad_muestra: inspeccion.cantidad_muestra,
      inspector: inspeccion.inspector || '',
    });
    
    if (plan?.caracteristicas) {
      setResultados(plan.caracteristicas
        .filter(c => c.activo)
        .sort((a, b) => a.orden - b.orden)
        .map(c => ({
          caracteristica_id: c.id,
          caracteristica: c,
          conforme: undefined,
          cantidad_defectos: 0,
          fotos: [],
        }))
      );
    }
    
    setInspeccionSeleccionada(inspeccion);
    setPasoActual(2);
    setVistaActiva('ejecutar');
  };

  // ============================================
  // RENDER HELPERS
  // ============================================

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-UY', { 
      day: '2-digit', month: '2-digit', year: 'numeric' 
    });
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('es-UY', { 
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-400" />
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
                <ClipboardCheck className="h-6 w-6 text-emerald-400" />
                Inspección de Recepción
              </h3>
              <p className="text-slate-400 text-sm mt-1">
                Control de calidad de materiales y productos recibidos
              </p>
            </div>
            
            {/* Stats rápidos */}
            <div className="flex gap-3">
              <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <div className="text-xs text-amber-400">Pendientes</div>
                <div className="text-xl font-bold text-amber-400">{stats.pendientes}</div>
              </div>
              <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <div className="text-xs text-blue-400">En Proceso</div>
                <div className="text-xl font-bold text-blue-400">{stats.enProceso}</div>
              </div>
              <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                <div className="text-xs text-emerald-400">Tasa Aprob.</div>
                <div className="text-xl font-bold text-emerald-400">{stats.tasaAprobacion.toFixed(1)}%</div>
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
                  placeholder="Buscar por número, producto, proveedor, OC..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
              
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-xl border transition-colors ${
                  showFilters ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Filter className="h-4 w-4" />
              </button>
              
              <button
                onClick={loadInspecciones}
                className="p-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-400 hover:text-slate-200 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            
            <button
              onClick={handleNuevaInspeccion}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nueva Inspección
            </button>
          </div>

          {/* Filtros expandibles */}
          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Estado</label>
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100"
                >
                  <option value="todos">Todos los estados</option>
                  <option value="pendiente">Pendientes</option>
                  <option value="en_proceso">En Proceso</option>
                  <option value="aprobado">Aprobados</option>
                  <option value="rechazado">Rechazados</option>
                  <option value="aprobado_condicional">Aprobado Condicional</option>
                  <option value="retenido">Retenidos</option>
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
              
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Proveedor</label>
                <select
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100"
                >
                  <option value="">Todos</option>
                  {proveedores.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setFiltroEstado('todos');
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

          {/* Tabla de inspecciones */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Número</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Producto</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Proveedor / OC</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Cantidad</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Muestra</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Inspector</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {inspeccionesFiltradas.map(insp => {
                    const estadoConfig = QMS_ESTADO_INSPECCION_CONFIG[insp.estado];
                    
                    return (
                      <tr key={insp.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm text-emerald-400">{insp.numero}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-slate-200 font-medium">{insp.producto_codigo}</div>
                          <div className="text-xs text-slate-500 truncate max-w-[200px]">{insp.producto_descripcion}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-slate-300">{insp.proveedor_nombre || '-'}</div>
                          {insp.orden_compra_numero && (
                            <div className="text-xs text-slate-500">OC: {insp.orden_compra_numero}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-slate-300">
                          {insp.cantidad_recibida.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-mono text-sm text-slate-400">{insp.cantidad_muestra}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${estadoConfig.bg} ${estadoConfig.color}`}>
                            {estadoConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-400">
                          {formatDate(insp.fecha_inspeccion)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-400">
                          {insp.inspector || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleVerDetalle(insp)}
                              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                              title="Ver detalle"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {insp.estado === 'pendiente' && (
                              <button
                                onClick={() => handleEjecutarInspeccion(insp)}
                                className="p-1.5 hover:bg-emerald-500/20 rounded-lg text-emerald-400 transition-colors"
                                title="Ejecutar inspección"
                              >
                                <Play className="h-4 w-4" />
                              </button>
                            )}
                            {insp.estado === 'en_proceso' && (
                              <button
                                onClick={() => handleVerDetalle(insp)}
                                className="p-1.5 hover:bg-blue-500/20 rounded-lg text-blue-400 transition-colors"
                                title="Continuar"
                              >
                                <ArrowRight className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {inspeccionesFiltradas.length === 0 && (
              <div className="p-12 text-center text-slate-500">
                <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg">No hay inspecciones</p>
                <p className="text-sm mt-1">
                  {searchTerm || filtroEstado !== 'todos' 
                    ? 'Intenta ajustar los filtros'
                    : 'Crea una nueva inspección para comenzar'
                  }
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ==================== VISTA NUEVA INSPECCIÓN ==================== */}
      {(vistaActiva === 'nueva' || vistaActiva === 'ejecutar') && (
        <NuevaInspeccionForm
          formData={formData}
          setFormData={setFormData}
          resultados={resultados}
          setResultados={setResultados}
          pasoActual={pasoActual}
          setPasoActual={setPasoActual}
          planes={planes}
          productos={productos}
          proveedores={proveedores}
          ordenesCompra={ordenesCompra}
          onPlanChange={handlePlanChange}
          onProductoSelect={handleSelectProducto}
          onOrdenCompraSelect={handleSelectOrdenCompra}
          onCantidadChange={handleCantidadChange}
          onResultadoChange={handleResultadoChange}
          onGuardar={handleGuardarInspeccion}
          onCancelar={() => setVistaActiva('lista')}
          saving={saving}
          modoEjecucion={vistaActiva === 'ejecutar'}
          inspeccionExistente={inspeccionSeleccionada}
        />
      )}

      {/* ==================== VISTA DETALLE ==================== */}
      {vistaActiva === 'detalle' && inspeccionSeleccionada && (
        <DetalleInspeccion
          inspeccion={inspeccionSeleccionada}
          onVolver={() => setVistaActiva('lista')}
          onTomarDecision={handleTomarDecision}
          saving={saving}
        />
      )}
    </div>
  );
}

// ============================================
// SUB-COMPONENTE: FORMULARIO NUEVA INSPECCIÓN
// ============================================

interface NuevaInspeccionFormProps {
  formData: InspeccionFormData;
  setFormData: React.Dispatch<React.SetStateAction<InspeccionFormData>>;
  resultados: ResultadoForm[];
  setResultados: React.Dispatch<React.SetStateAction<ResultadoForm[]>>;
  pasoActual: number;
  setPasoActual: React.Dispatch<React.SetStateAction<number>>;
  planes: QMSPlanInspeccion[];
  productos: Product[];
  proveedores: Proveedor[];
  ordenesCompra: OrdenCompra[];
  onPlanChange: (planId: string) => void;
  onProductoSelect: (producto: Product) => void;
  onOrdenCompraSelect: (oc: OrdenCompra) => void;
  onCantidadChange: (cantidad: number) => void;
  onResultadoChange: (index: number, field: keyof ResultadoForm, value: any) => void;
  onGuardar: (estado: EstadoInspeccion) => void;
  onCancelar: () => void;
  saving: boolean;
  modoEjecucion?: boolean;
  inspeccionExistente?: QMSInspeccion | null;
}

function NuevaInspeccionForm({
  formData, setFormData, resultados, setResultados,
  pasoActual, setPasoActual, planes, productos, proveedores, ordenesCompra,
  onPlanChange, onProductoSelect, onOrdenCompraSelect, onCantidadChange,
  onResultadoChange, onGuardar, onCancelar, saving, modoEjecucion, inspeccionExistente
}: NuevaInspeccionFormProps) {
  const [searchProducto, setSearchProducto] = useState('');
  const [showProductoDropdown, setShowProductoDropdown] = useState(false);

  const productosFiltrados = useMemo(() => {
    if (!searchProducto) return productos.slice(0, 20);
    const search = searchProducto.toLowerCase();
    return productos.filter(p => 
      p.codigo.toLowerCase().includes(search) ||
      p.descripcion.toLowerCase().includes(search)
    ).slice(0, 20);
  }, [productos, searchProducto]);

  const pasos = [
    { num: 1, label: 'Información', icon: FileText },
    { num: 2, label: 'Inspección', icon: ClipboardList },
    { num: 3, label: 'Decisión', icon: CheckSquare },
  ];

  const puedeAvanzar = () => {
    if (pasoActual === 1) {
      return formData.producto_codigo && formData.cantidad_recibida > 0;
    }
    if (pasoActual === 2) {
      return resultados.every(r => r.conforme !== undefined);
    }
    return true;
  };

  const totalConformes = resultados.filter(r => r.conforme === true).length;
  const totalNoConformes = resultados.filter(r => r.conforme === false).length;
  const totalPendientes = resultados.filter(r => r.conforme === undefined).length;

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
              {modoEjecucion ? `Ejecutar Inspección ${inspeccionExistente?.numero}` : 'Nueva Inspección de Recepción'}
            </h3>
            <p className="text-sm text-slate-400">
              {pasos[pasoActual - 1].label}
            </p>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-center gap-2">
        {pasos.map((paso, index) => {
          const Icon = paso.icon;
          const isActive = pasoActual === paso.num;
          const isCompleted = pasoActual > paso.num;
          
          return (
            <React.Fragment key={paso.num}>
              <button
                onClick={() => paso.num < pasoActual && setPasoActual(paso.num)}
                disabled={paso.num > pasoActual}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                  isActive 
                    ? 'bg-emerald-600 text-white' 
                    : isCompleted 
                      ? 'bg-emerald-500/20 text-emerald-400 cursor-pointer hover:bg-emerald-500/30'
                      : 'bg-slate-800 text-slate-500'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">{paso.label}</span>
              </button>
              {index < pasos.length - 1 && (
                <ChevronRight className={`h-4 w-4 ${isCompleted ? 'text-emerald-400' : 'text-slate-600'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Contenido del paso */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
        {/* PASO 1: Información básica */}
        {pasoActual === 1 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Plan de inspección */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Plan de Inspección
                </label>
                <select
                  value={formData.plan_id}
                  onChange={(e) => onPlanChange(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="">Sin plan específico</option>
                  {planes.map(plan => (
                    <option key={plan.id} value={plan.id}>
                      {plan.codigo} - {plan.nombre}
                    </option>
                  ))}
                </select>
                {formData.plan_id && (
                  <p className="text-xs text-slate-500 mt-1">
                    {planes.find(p => p.id === formData.plan_id)?.caracteristicas?.length || 0} características a inspeccionar
                  </p>
                )}
              </div>

              {/* Orden de compra */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Orden de Compra (opcional)
                </label>
                <select
                  value={formData.orden_compra_id || ''}
                  onChange={(e) => {
                    const oc = ordenesCompra.find(o => o.id === e.target.value);
                    if (oc) onOrdenCompraSelect(oc);
                  }}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="">Sin orden de compra</option>
                  {ordenesCompra.map(oc => (
                    <option key={oc.id} value={oc.id}>
                      {oc.numero} - {(oc as any).proveedor?.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Producto */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Producto a Inspeccionar *
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={formData.producto_codigo ? `${formData.producto_codigo} - ${formData.producto_descripcion}` : searchProducto}
                  onChange={(e) => {
                    setSearchProducto(e.target.value);
                    setShowProductoDropdown(true);
                    if (formData.producto_codigo) {
                      setFormData(prev => ({ ...prev, producto_codigo: '', producto_descripcion: '', producto_id: '' }));
                    }
                  }}
                  onFocus={() => setShowProductoDropdown(true)}
                  placeholder="Buscar producto por código o descripción..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                
                {showProductoDropdown && productosFiltrados.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                    {productosFiltrados.map(producto => (
                      <button
                        key={producto.codigo}
                        onClick={() => {
                          onProductoSelect(producto);
                          setShowProductoDropdown(false);
                          setSearchProducto('');
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-slate-700 transition-colors first:rounded-t-xl last:rounded-b-xl"
                      >
                        <div className="font-mono text-sm text-emerald-400">{producto.codigo}</div>
                        <div className="text-sm text-slate-300 truncate">{producto.descripcion}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Cantidad recibida */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Cantidad Recibida *
                </label>
                <input
                  type="number"
                  value={formData.cantidad_recibida || ''}
                  onChange={(e) => onCantidadChange(parseInt(e.target.value) || 0)}
                  min="1"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="Ej: 1000"
                />
              </div>

              {/* Tamaño muestra */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Tamaño de Muestra
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={formData.cantidad_muestra || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, cantidad_muestra: parseInt(e.target.value) || 0 }))}
                    min="1"
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  <div className="text-xs text-slate-500 whitespace-nowrap">
                    {formData.cantidad_recibida > 0 && (
                      <>({((formData.cantidad_muestra / formData.cantidad_recibida) * 100).toFixed(1)}%)</>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">Calculado según AQL nivel II</p>
              </div>

              {/* Lote */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Número de Lote
                </label>
                <input
                  type="text"
                  value={formData.lote_numero || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, lote_numero: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="Ej: LOT-2024-001"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Proveedor */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Proveedor
                </label>
                <select
                  value={formData.proveedor_id || ''}
                  onChange={(e) => {
                    const prov = proveedores.find(p => p.id === e.target.value);
                    setFormData(prev => ({
                      ...prev,
                      proveedor_id: e.target.value,
                      proveedor_nombre: prov?.nombre,
                    }));
                  }}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="">Seleccionar proveedor</option>
                  {proveedores.map(prov => (
                    <option key={prov.id} value={prov.id}>{prov.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Inspector */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Inspector
                </label>
                <input
                  type="text"
                  value={formData.inspector}
                  onChange={(e) => setFormData(prev => ({ ...prev, inspector: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="Nombre del inspector"
                />
              </div>
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Observaciones
              </label>
              <textarea
                value={formData.observaciones || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
                rows={3}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                placeholder="Notas adicionales sobre la recepción..."
              />
            </div>
          </div>
        )}

        {/* PASO 2: Ejecución de inspección */}
        {pasoActual === 2 && (
          <div className="space-y-6">
            {/* Resumen */}
            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl">
              <div className="flex items-center gap-4">
                <Package className="h-8 w-8 text-emerald-400" />
                <div>
                  <div className="font-medium text-slate-200">{formData.producto_codigo}</div>
                  <div className="text-sm text-slate-400">{formData.producto_descripcion}</div>
                </div>
              </div>
              <div className="flex gap-6 text-sm">
                <div className="text-center">
                  <div className="text-slate-400">Recibido</div>
                  <div className="font-bold text-slate-200">{formData.cantidad_recibida}</div>
                </div>
                <div className="text-center">
                  <div className="text-slate-400">Muestra</div>
                  <div className="font-bold text-emerald-400">{formData.cantidad_muestra}</div>
                </div>
              </div>
            </div>

            {/* Progreso */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-300"
                  style={{ width: `${((resultados.length - totalPendientes) / resultados.length) * 100}%` }}
                />
              </div>
              <div className="flex gap-3 text-sm">
                <span className="text-emerald-400">{totalConformes} ✓</span>
                <span className="text-red-400">{totalNoConformes} ✗</span>
                <span className="text-slate-400">{totalPendientes} pendientes</span>
              </div>
            </div>

            {/* Lista de características */}
            <div className="space-y-3">
              {resultados.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No hay características definidas en el plan</p>
                  <p className="text-sm mt-1">Puedes registrar observaciones generales</p>
                </div>
              ) : (
                resultados.map((resultado, index) => (
                  <CaracteristicaInspeccion
                    key={resultado.caracteristica_id}
                    resultado={resultado}
                    index={index}
                    onChange={onResultadoChange}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* PASO 3: Decisión */}
        {pasoActual === 3 && (
          <div className="space-y-6">
            {/* Resumen de resultados */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center">
                <CheckCircle className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-emerald-400">{totalConformes}</div>
                <div className="text-sm text-emerald-400/70">Conformes</div>
              </div>
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
                <XCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-red-400">{totalNoConformes}</div>
                <div className="text-sm text-red-400/70">No Conformes</div>
              </div>
              <div className="p-4 bg-slate-500/10 border border-slate-500/30 rounded-xl text-center">
                <Target className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-slate-400">
                  {resultados.length > 0 ? ((totalConformes / resultados.length) * 100).toFixed(0) : 100}%
                </div>
                <div className="text-sm text-slate-400/70">Tasa de conformidad</div>
              </div>
            </div>

            {/* Defectos encontrados */}
            {totalNoConformes > 0 && (
              <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                <h4 className="font-medium text-red-400 mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Defectos Encontrados
                </h4>
                <div className="space-y-2">
                  {resultados.filter(r => r.conforme === false).map(r => (
                    <div key={r.caracteristica_id} className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg">
                      <div>
                        <span className="text-slate-300">{r.caracteristica.nombre}</span>
                        {r.descripcion_defecto && (
                          <span className="text-slate-500 text-sm ml-2">- {r.descripcion_defecto}</span>
                        )}
                      </div>
                      {r.tipo_defecto && (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          r.tipo_defecto === 'critico' ? 'bg-red-500/20 text-red-400' :
                          r.tipo_defecto === 'mayor' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-amber-500/20 text-amber-400'
                        }`}>
                          {r.tipo_defecto}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recomendación automática */}
            <div className={`p-4 rounded-xl border ${
              totalNoConformes === 0 
                ? 'bg-emerald-500/10 border-emerald-500/30' 
                : resultados.some(r => r.tipo_defecto === 'critico')
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-amber-500/10 border-amber-500/30'
            }`}>
              <div className="flex items-center gap-3">
                <Zap className={`h-5 w-5 ${
                  totalNoConformes === 0 ? 'text-emerald-400' : 
                  resultados.some(r => r.tipo_defecto === 'critico') ? 'text-red-400' : 'text-amber-400'
                }`} />
                <div>
                  <div className="font-medium text-slate-200">Recomendación del Sistema</div>
                  <div className="text-sm text-slate-400">
                    {totalNoConformes === 0 
                      ? 'Aprobar - Todas las características cumplen especificaciones'
                      : resultados.some(r => r.tipo_defecto === 'critico')
                        ? 'Rechazar - Se encontraron defectos críticos'
                        : 'Revisar - Se encontraron defectos menores/mayores'
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer con botones */}
      <div className="flex items-center justify-between">
        <button
          onClick={onCancelar}
          className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors"
        >
          Cancelar
        </button>
        
        <div className="flex gap-3">
          {pasoActual > 1 && (
            <button
              onClick={() => setPasoActual(prev => prev - 1)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl transition-colors"
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
              Anterior
            </button>
          )}
          
          {pasoActual < 3 ? (
            <button
              onClick={() => setPasoActual(prev => prev + 1)}
              disabled={!puedeAvanzar()}
              className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-medium transition-colors"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => onGuardar('pendiente')}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl transition-colors"
              >
                <Save className="h-4 w-4" />
                Guardar Borrador
              </button>
              
              {totalNoConformes === 0 ? (
                <button
                  onClick={() => onGuardar('aprobado')}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors"
                >
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Aprobar
                </button>
              ) : (
                <>
                  <button
                    onClick={() => onGuardar('aprobado_condicional')}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium transition-colors"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    Aprobar Condicional
                  </button>
                  <button
                    onClick={() => onGuardar('rechazado')}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition-colors"
                  >
                    {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                    Rechazar
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTE: CARACTERÍSTICA DE INSPECCIÓN
// ============================================

interface CaracteristicaInspeccionProps {
  resultado: ResultadoForm;
  index: number;
  onChange: (index: number, field: keyof ResultadoForm, value: any) => void;
}

function CaracteristicaInspeccion({ resultado, index, onChange }: CaracteristicaInspeccionProps) {
  const [expanded, setExpanded] = useState(resultado.conforme === false);
  const car = resultado.caracteristica;

  const getIconoTipo = () => {
    switch (car.tipo) {
      case 'dimensional': return <Ruler className="h-4 w-4" />;
      case 'visual': return <Eye className="h-4 w-4" />;
      case 'funcional': return <Zap className="h-4 w-4" />;
      case 'documental': return <FileText className="h-4 w-4" />;
      case 'quimico': return <ThermometerSun className="h-4 w-4" />;
      case 'fisico': return <Scale className="h-4 w-4" />;
      default: return <ClipboardList className="h-4 w-4" />;
    }
  };

  return (
    <div className={`border rounded-xl transition-colors ${
      resultado.conforme === true ? 'border-emerald-500/30 bg-emerald-500/5' :
      resultado.conforme === false ? 'border-red-500/30 bg-red-500/5' :
      'border-slate-700/50 bg-slate-800/30'
    }`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className={`p-2 rounded-lg ${
              car.critico ? 'bg-red-500/20 text-red-400' :
              car.mayor ? 'bg-orange-500/20 text-orange-400' :
              'bg-slate-700/50 text-slate-400'
            }`}>
              {getIconoTipo()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-200">{car.nombre}</span>
                {car.critico && (
                  <span className="text-xs px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">CTQ</span>
                )}
                {car.mayor && !car.critico && (
                  <span className="text-xs px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded">Mayor</span>
                )}
              </div>
              {car.descripcion && (
                <p className="text-sm text-slate-500 mt-0.5">{car.descripcion}</p>
              )}
              
              {/* Especificaciones */}
              {(car.valor_nominal !== undefined || car.valores_aceptables?.length) && (
                <div className="flex flex-wrap gap-2 mt-2 text-xs">
                  {car.valor_nominal !== undefined && (
                    <span className="px-2 py-1 bg-slate-700/50 rounded text-slate-400">
                      Nominal: {car.valor_nominal} {car.unidad_medida}
                    </span>
                  )}
                  {car.tolerancia_min !== undefined && (
                    <span className="px-2 py-1 bg-slate-700/50 rounded text-slate-400">
                      Min: {car.tolerancia_min}
                    </span>
                  )}
                  {car.tolerancia_max !== undefined && (
                    <span className="px-2 py-1 bg-slate-700/50 rounded text-slate-400">
                      Max: {car.tolerancia_max}
                    </span>
                  )}
                  {car.valores_aceptables?.map((v, i) => (
                    <span key={i} className="px-2 py-1 bg-slate-700/50 rounded text-slate-400">
                      {v}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Input de valor o botones de conformidad */}
          <div className="flex items-center gap-3">
            {car.tipo === 'dimensional' || car.valor_nominal !== undefined ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={resultado.valor_medido ?? ''}
                  onChange={(e) => onChange(index, 'valor_medido', parseFloat(e.target.value) || undefined)}
                  placeholder="Valor"
                  className="w-24 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                {car.unidad_medida && (
                  <span className="text-sm text-slate-500">{car.unidad_medida}</span>
                )}
              </div>
            ) : car.valores_aceptables?.length ? (
              <select
                value={resultado.valor_texto || ''}
                onChange={(e) => {
                  onChange(index, 'valor_texto', e.target.value);
                  onChange(index, 'conforme', car.valores_aceptables?.includes(e.target.value));
                }}
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <option value="">Seleccionar...</option>
                {car.valores_aceptables.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            ) : null}

            {/* Botones conforme/no conforme */}
            <div className="flex gap-1">
              <button
                onClick={() => onChange(index, 'conforme', true)}
                className={`p-2 rounded-lg transition-colors ${
                  resultado.conforme === true
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-emerald-500/20 hover:text-emerald-400'
                }`}
              >
                <CheckCircle className="h-5 w-5" />
              </button>
              <button
                onClick={() => {
                  onChange(index, 'conforme', false);
                  setExpanded(true);
                }}
                className={`p-2 rounded-lg transition-colors ${
                  resultado.conforme === false
                    ? 'bg-red-500 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-red-500/20 hover:text-red-400'
                }`}
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Panel expandido para no conformes */}
        {resultado.conforme === false && expanded && (
          <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Tipo de Defecto</label>
                <select
                  value={resultado.tipo_defecto || ''}
                  onChange={(e) => onChange(index, 'tipo_defecto', e.target.value as TipoDefecto)}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100"
                >
                  <option value="">Seleccionar...</option>
                  <option value="critico">Crítico</option>
                  <option value="mayor">Mayor</option>
                  <option value="menor">Menor</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Cantidad Defectos</label>
                <input
                  type="number"
                  value={resultado.cantidad_defectos || ''}
                  onChange={(e) => onChange(index, 'cantidad_defectos', parseInt(e.target.value) || 0)}
                  min="0"
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Descripción del Defecto</label>
              <textarea
                value={resultado.descripcion_defecto || ''}
                onChange={(e) => onChange(index, 'descripcion_defecto', e.target.value)}
                rows={2}
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 resize-none"
                placeholder="Describir el defecto encontrado..."
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Evidencia Fotográfica</label>
              <button className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-dashed border-slate-600 rounded-lg text-sm text-slate-400 hover:border-slate-500 hover:text-slate-300 transition-colors w-full justify-center">
                <Camera className="h-4 w-4" />
                Agregar fotos
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTE: DETALLE DE INSPECCIÓN
// ============================================

interface DetalleInspeccionProps {
  inspeccion: QMSInspeccion;
  onVolver: () => void;
  onTomarDecision: (id: string, decision: DecisionInspeccion) => void;
  saving: boolean;
}

function DetalleInspeccion({ inspeccion, onVolver, onTomarDecision, saving }: DetalleInspeccionProps) {
  const estadoConfig = QMS_ESTADO_INSPECCION_CONFIG[inspeccion.estado];

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
              <h3 className="text-xl font-bold text-slate-100">{inspeccion.numero}</h3>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${estadoConfig.bg} ${estadoConfig.color}`}>
                {estadoConfig.label}
              </span>
            </div>
            <p className="text-sm text-slate-400">
              Inspección de Recepción • {new Date(inspeccion.fecha_inspeccion).toLocaleString('es-UY')}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 transition-colors">
            <Printer className="h-4 w-4" />
          </button>
          <button className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 transition-colors">
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <Package className="h-5 w-5 text-emerald-400" />
            <span className="text-sm text-slate-400">Producto</span>
          </div>
          <div className="font-mono text-lg text-slate-200">{inspeccion.producto_codigo}</div>
          <div className="text-sm text-slate-400 truncate">{inspeccion.producto_descripcion}</div>
        </div>
        
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <Building2 className="h-5 w-5 text-blue-400" />
            <span className="text-sm text-slate-400">Proveedor</span>
          </div>
          <div className="text-lg text-slate-200">{inspeccion.proveedor_nombre || '-'}</div>
          {inspeccion.orden_compra_numero && (
            <div className="text-sm text-slate-400">OC: {inspeccion.orden_compra_numero}</div>
          )}
        </div>
        
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <Scale className="h-5 w-5 text-amber-400" />
            <span className="text-sm text-slate-400">Cantidades</span>
          </div>
          <div className="flex gap-4">
            <div>
              <div className="text-lg font-bold text-slate-200">{inspeccion.cantidad_recibida}</div>
              <div className="text-xs text-slate-500">Recibido</div>
            </div>
            <div>
              <div className="text-lg font-bold text-emerald-400">{inspeccion.cantidad_muestra}</div>
              <div className="text-xs text-slate-500">Muestra</div>
            </div>
            <div>
              <div className="text-lg font-bold text-emerald-400">{inspeccion.cantidad_aceptada}</div>
              <div className="text-xs text-slate-500">Aceptado</div>
            </div>
            <div>
              <div className="text-lg font-bold text-red-400">{inspeccion.cantidad_rechazada}</div>
              <div className="text-xs text-slate-500">Rechazado</div>
            </div>
          </div>
        </div>
      </div>

      {/* Resultados */}
      {inspeccion.resultados && inspeccion.resultados.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl">
          <div className="p-4 border-b border-slate-800">
            <h4 className="font-semibold text-slate-200 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-emerald-400" />
              Resultados de Inspección
            </h4>
          </div>
          <div className="divide-y divide-slate-800/50">
            {inspeccion.resultados.map((res: any) => (
              <div key={res.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {res.conforme ? (
                    <CheckCircle className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-400" />
                  )}
                  <div>
                    <div className="text-slate-200">{res.caracteristica?.nombre || 'Característica'}</div>
                    {res.valor_medido !== null && (
                      <div className="text-sm text-slate-500">
                        Valor medido: {res.valor_medido} {res.caracteristica?.unidad_medida}
                      </div>
                    )}
                    {res.descripcion_defecto && (
                      <div className="text-sm text-red-400">{res.descripcion_defecto}</div>
                    )}
                  </div>
                </div>
                {res.tipo_defecto && (
                  <span className={`text-xs px-2 py-1 rounded ${
                    res.tipo_defecto === 'critico' ? 'bg-red-500/20 text-red-400' :
                    res.tipo_defecto === 'mayor' ? 'bg-orange-500/20 text-orange-400' :
                    'bg-amber-500/20 text-amber-400'
                  }`}>
                    {res.tipo_defecto}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Observaciones */}
      {inspeccion.observaciones && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <h4 className="font-semibold text-slate-200 mb-2">Observaciones</h4>
          <p className="text-slate-400">{inspeccion.observaciones}</p>
        </div>
      )}

      {/* Acciones si está pendiente o en proceso */}
      {(inspeccion.estado === 'pendiente' || inspeccion.estado === 'en_proceso') && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <h4 className="font-semibold text-slate-200 mb-4">Tomar Decisión</h4>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => onTomarDecision(inspeccion.id, 'aceptar')}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors"
            >
              <CheckCircle className="h-4 w-4" />
              Aprobar
            </button>
            <button
              onClick={() => onTomarDecision(inspeccion.id, 'usar_como_esta')}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium transition-colors"
            >
              <AlertTriangle className="h-4 w-4" />
              Usar Como Está
            </button>
            <button
              onClick={() => onTomarDecision(inspeccion.id, 'retrabajo')}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Retrabajo
            </button>
            <button
              onClick={() => onTomarDecision(inspeccion.id, 'rechazar')}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition-colors"
            >
              <XCircle className="h-4 w-4" />
              Rechazar
            </button>
            <button
              onClick={() => onTomarDecision(inspeccion.id, 'devolver')}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl font-medium transition-colors"
            >
              <Truck className="h-4 w-4" />
              Devolver a Proveedor
            </button>
          </div>
        </div>
      )}

      {/* Timeline / Historial */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
        <h4 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <History className="h-5 w-5 text-slate-400" />
          Historial
        </h4>
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="w-2 h-2 mt-2 rounded-full bg-emerald-400" />
            <div>
              <div className="text-sm text-slate-300">Inspección creada</div>
              <div className="text-xs text-slate-500">
                {new Date(inspeccion.creado_at).toLocaleString('es-UY')} por {inspeccion.creado_por || 'Sistema'}
              </div>
            </div>
          </div>
          {inspeccion.fecha_decision && (
            <div className="flex gap-3">
              <div className={`w-2 h-2 mt-2 rounded-full ${
                inspeccion.estado === 'aprobado' ? 'bg-emerald-400' :
                inspeccion.estado === 'rechazado' ? 'bg-red-400' : 'bg-amber-400'
              }`} />
              <div>
                <div className="text-sm text-slate-300">
                  Decisión: {inspeccion.decision?.replace('_', ' ')}
                </div>
                <div className="text-xs text-slate-500">
                  {new Date(inspeccion.fecha_decision).toLocaleString('es-UY')} por {inspeccion.supervisor_calidad || 'Supervisor'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}