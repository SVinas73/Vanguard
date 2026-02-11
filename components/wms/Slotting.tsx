'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Product, Almacen } from '@/types';
import {
  Layers, Search, RefreshCw, Eye, Play,
  ChevronRight, ChevronDown, X, Check,
  Package, MapPin, AlertTriangle, TrendingUp,
  BarChart3, ArrowUpDown, Download, Zap,
  Target, ArrowRight, Settings, Clock,
  CheckCircle, XCircle, ArrowUp, ArrowDown,
  Shuffle, Filter, PieChart, Activity
} from 'lucide-react';

// ============================================
// TIPOS
// ============================================

type ClasificacionABC = 'A' | 'B' | 'C';
type ClasificacionXYZ = 'X' | 'Y' | 'Z';
type EstadoRecomendacion = 'pendiente' | 'aprobada' | 'ejecutada' | 'rechazada';

interface AnalisisProducto {
  producto_codigo: string;
  producto?: Product;
  
  // Métricas de rotación
  movimientos_30d: number;
  movimientos_90d: number;
  cantidad_vendida_30d: number;
  cantidad_vendida_90d: number;
  frecuencia_picks: number;
  
  // Clasificación
  clasificacion_abc: ClasificacionABC;
  clasificacion_xyz: ClasificacionXYZ;
  clasificacion_combinada: string; // "AX", "BY", "CZ", etc.
  
  // Valor
  valor_inventario: number;
  porcentaje_valor_acumulado: number;
  porcentaje_cantidad_acumulado: number;
  
  // Ubicación actual
  ubicacion_actual?: string;
  zona_actual?: string;
  distancia_desde_despacho?: number;
  
  // Ubicación sugerida
  ubicacion_sugerida?: string;
  zona_sugerida?: string;
  razon_sugerencia?: string;
  prioridad_reubicacion: number;
  
  // Ahorros estimados
  ahorro_tiempo_estimado?: number; // minutos/día
  ahorro_distancia_estimado?: number; // metros/día
}

interface RecomendacionSlotting {
  id: string;
  producto_codigo: string;
  producto?: Product;
  
  ubicacion_origen: string;
  zona_origen?: string;
  ubicacion_destino: string;
  zona_destino?: string;
  
  razon: string;
  clasificacion_abc: ClasificacionABC;
  prioridad: number;
  
  ahorro_tiempo_min?: number;
  ahorro_distancia_m?: number;
  
  estado: EstadoRecomendacion;
  
  aprobado_por?: string;
  ejecutado_por?: string;
  fecha_creacion: string;
  fecha_ejecucion?: string;
}

interface ConfiguracionSlotting {
  // Umbrales ABC (por valor)
  umbral_a_valor: number; // % del valor total (ej: 80%)
  umbral_b_valor: number; // % del valor total (ej: 95%)
  
  // Umbrales ABC alternativo (por movimientos)
  usar_movimientos: boolean;
  umbral_a_movimientos: number;
  umbral_b_movimientos: number;
  
  // Umbrales XYZ (variabilidad demanda)
  umbral_x_cv: number; // Coeficiente de variación (ej: 0.5)
  umbral_y_cv: number; // (ej: 1.0)
  
  // Zonas del almacén
  zona_premium: string[]; // Ubicaciones para A
  zona_media: string[];   // Ubicaciones para B
  zona_baja: string[];    // Ubicaciones para C
  
  // Preferencias
  priorizar_altura_baja: boolean;
  considerar_peso: boolean;
  considerar_volumen: boolean;
}

interface ResumenSlotting {
  total_productos: number;
  productos_a: number;
  productos_b: number;
  productos_c: number;
  
  valor_a_pct: number;
  valor_b_pct: number;
  valor_c_pct: number;
  
  movimientos_a_pct: number;
  movimientos_b_pct: number;
  movimientos_c_pct: number;
  
  productos_mal_ubicados: number;
  ahorro_potencial_tiempo: number;
  ahorro_potencial_distancia: number;
  
  recomendaciones_pendientes: number;
  recomendaciones_ejecutadas: number;
}

type VistaActiva = 'analisis' | 'recomendaciones' | 'configuracion' | 'simulacion';

// ============================================
// CONFIGURACIÓN DEFAULT
// ============================================

const CONFIG_DEFAULT: ConfiguracionSlotting = {
  umbral_a_valor: 80,
  umbral_b_valor: 95,
  usar_movimientos: true,
  umbral_a_movimientos: 70,
  umbral_b_movimientos: 90,
  umbral_x_cv: 0.5,
  umbral_y_cv: 1.0,
  zona_premium: ['A-01', 'A-02', 'B-01'],
  zona_media: ['A-03', 'A-04', 'B-02', 'B-03'],
  zona_baja: ['C-01', 'C-02', 'C-03', 'C-04', 'C-05'],
  priorizar_altura_baja: true,
  considerar_peso: false,
  considerar_volumen: false,
};

// ============================================
// COLORES POR CLASIFICACIÓN
// ============================================

const ABC_CONFIG: Record<ClasificacionABC, { label: string; color: string; bg: string; descripcion: string }> = {
  A: { label: 'A - Alta Rotación', color: 'text-red-400', bg: 'bg-red-500/20', descripcion: '~20% productos, ~80% valor/movimientos' },
  B: { label: 'B - Media Rotación', color: 'text-amber-400', bg: 'bg-amber-500/20', descripcion: '~30% productos, ~15% valor/movimientos' },
  C: { label: 'C - Baja Rotación', color: 'text-emerald-400', bg: 'bg-emerald-500/20', descripcion: '~50% productos, ~5% valor/movimientos' },
};

const XYZ_CONFIG: Record<ClasificacionXYZ, { label: string; color: string; bg: string; descripcion: string }> = {
  X: { label: 'X - Demanda Estable', color: 'text-blue-400', bg: 'bg-blue-500/20', descripcion: 'Baja variabilidad, fácil de predecir' },
  Y: { label: 'Y - Demanda Variable', color: 'text-purple-400', bg: 'bg-purple-500/20', descripcion: 'Variabilidad media, estacional' },
  Z: { label: 'Z - Demanda Errática', color: 'text-pink-400', bg: 'bg-pink-500/20', descripcion: 'Alta variabilidad, difícil predecir' },
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function Slotting() {
  const [loading, setLoading] = useState(true);
  const [vistaActiva, setVistaActiva] = useState<VistaActiva>('analisis');
  
  // Datos
  const [productos, setProductos] = useState<Product[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [analisis, setAnalisis] = useState<AnalisisProducto[]>([]);
  const [recomendaciones, setRecomendaciones] = useState<RecomendacionSlotting[]>([]);
  const [config, setConfig] = useState<ConfiguracionSlotting>(CONFIG_DEFAULT);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroABC, setFiltroABC] = useState<string>('todos');
  const [filtroXYZ, setFiltroXYZ] = useState<string>('todos');
  const [mostrarSoloMalUbicados, setMostrarSoloMalUbicados] = useState(false);
  
  const [saving, setSaving] = useState(false);
  const [analizando, setAnalizando] = useState(false);

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
          costoPromedio: p.costo_promedio,
          almacenId: p.almacen_id,
        })));
      }

      // Cargar almacenes
      const { data: almacenesData } = await supabase
        .from('almacenes')
        .select('*')
        .eq('activo', true);
      
      if (almacenesData) {
        setAlmacenes(almacenesData.map(a => ({
          id: a.id,
          codigo: a.codigo,
          nombre: a.nombre,
          esPrincipal: a.es_principal,
          activo: a.activo,
        })));
      }

      // Cargar movimientos para análisis
      const { data: movimientosData } = await supabase
        .from('movimientos')
        .select('*')
        .gte('timestamp', new Date(Date.now() - 90 * 86400000).toISOString())
        .order('timestamp', { ascending: false });

      // Realizar análisis ABC/XYZ
      if (productosData) {
        const analisisCalculado = calcularAnalisisABC(productosData, movimientosData || []);
        setAnalisis(analisisCalculado);
        
        // Generar recomendaciones
        const recsGeneradas = generarRecomendaciones(analisisCalculado);
        setRecomendaciones(recsGeneradas);
      }
      
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // CÁLCULOS ABC/XYZ
  // ============================================

  const calcularAnalisisABC = (productos: any[], movimientos: any[]): AnalisisProducto[] => {
    // Agrupar movimientos por producto
    const movsPorProducto: Record<string, any[]> = {};
    movimientos.forEach(m => {
      if (!movsPorProducto[m.codigo]) movsPorProducto[m.codigo] = [];
      movsPorProducto[m.codigo].push(m);
    });

    // Calcular métricas por producto
    const productosConMetricas = productos.map(p => {
      const movs = movsPorProducto[p.codigo] || [];
      const ahora = Date.now();
      const hace30d = ahora - 30 * 86400000;
      const hace90d = ahora - 90 * 86400000;
      
      const movs30d = movs.filter(m => new Date(m.timestamp).getTime() > hace30d);
      const movs90d = movs.filter(m => new Date(m.timestamp).getTime() > hace90d);
      
      const salidas30d = movs30d.filter(m => m.tipo === 'salida');
      const salidas90d = movs90d.filter(m => m.tipo === 'salida');
      
      const cantidadVendida30d = salidas30d.reduce((s, m) => s + m.cantidad, 0);
      const cantidadVendida90d = salidas90d.reduce((s, m) => s + m.cantidad, 0);
      
      const valorInventario = (p.stock || 0) * (p.costo_promedio || p.precio || 0);
      
      return {
        producto_codigo: p.codigo,
        producto: {
          codigo: p.codigo,
          descripcion: p.descripcion,
          precio: p.precio,
          categoria: p.categoria,
          stock: p.stock,
          stockMinimo: p.stock_minimo,
          costoPromedio: p.costo_promedio,
        } as Product,
        movimientos_30d: movs30d.length,
        movimientos_90d: movs90d.length,
        cantidad_vendida_30d: cantidadVendida30d,
        cantidad_vendida_90d: cantidadVendida90d,
        frecuencia_picks: salidas30d.length,
        valor_inventario: valorInventario,
        porcentaje_valor_acumulado: 0,
        porcentaje_cantidad_acumulado: 0,
        clasificacion_abc: 'C' as ClasificacionABC,
        clasificacion_xyz: 'Z' as ClasificacionXYZ,
        clasificacion_combinada: 'CZ',
        prioridad_reubicacion: 0,
      };
    });

    // Ordenar por valor o movimientos según config
    const ordenado = [...productosConMetricas].sort((a, b) => {
      if (config.usar_movimientos) {
        return b.movimientos_90d - a.movimientos_90d;
      }
      return b.valor_inventario - a.valor_inventario;
    });

    // Calcular totales
    const totalValor = ordenado.reduce((s, p) => s + p.valor_inventario, 0);
    const totalMovimientos = ordenado.reduce((s, p) => s + p.movimientos_90d, 0);

    // Asignar clasificación ABC
    let acumuladoValor = 0;
    let acumuladoMov = 0;
    
    ordenado.forEach((p, idx) => {
      const metrica = config.usar_movimientos ? p.movimientos_90d : p.valor_inventario;
      const total = config.usar_movimientos ? totalMovimientos : totalValor;
      
      acumuladoValor += p.valor_inventario;
      acumuladoMov += p.movimientos_90d;
      
      p.porcentaje_valor_acumulado = totalValor > 0 ? (acumuladoValor / totalValor) * 100 : 0;
      p.porcentaje_cantidad_acumulado = totalMovimientos > 0 ? (acumuladoMov / totalMovimientos) * 100 : 0;
      
      const pctAcumulado = config.usar_movimientos ? p.porcentaje_cantidad_acumulado : p.porcentaje_valor_acumulado;
      
      if (pctAcumulado <= config.umbral_a_movimientos) {
        p.clasificacion_abc = 'A';
      } else if (pctAcumulado <= config.umbral_b_movimientos) {
        p.clasificacion_abc = 'B';
      } else {
        p.clasificacion_abc = 'C';
      }
      
      // Clasificación XYZ (simplificada - basada en variabilidad)
      // En un sistema real calcularías el coeficiente de variación
      if (p.movimientos_90d > 20) {
        p.clasificacion_xyz = 'X';
      } else if (p.movimientos_90d > 5) {
        p.clasificacion_xyz = 'Y';
      } else {
        p.clasificacion_xyz = 'Z';
      }
      
      p.clasificacion_combinada = `${p.clasificacion_abc}${p.clasificacion_xyz}`;
      
      // Calcular prioridad de reubicación
      // A productos en zonas malas = alta prioridad
      p.prioridad_reubicacion = p.clasificacion_abc === 'A' ? 3 : p.clasificacion_abc === 'B' ? 2 : 1;
    });

    return ordenado;
  };

  const generarRecomendaciones = (analisis: AnalisisProducto[]): RecomendacionSlotting[] => {
    const recomendaciones: RecomendacionSlotting[] = [];
    
    // Productos A que deberían estar en zona premium
    const productosA = analisis.filter(a => a.clasificacion_abc === 'A');
    const productosC = analisis.filter(a => a.clasificacion_abc === 'C');
    
    // Simular ubicaciones actuales y generar recomendaciones
    const zonasPremium = ['A-01', 'A-02', 'B-01'];
    const zonasMedia = ['A-03', 'B-02', 'B-03'];
    const zonasBaja = ['C-01', 'C-02', 'C-03'];
    
    productosA.slice(0, 5).forEach((p, idx) => {
      // Simular que algunos A están mal ubicados
      if (idx % 2 === 0) {
        recomendaciones.push({
          id: `rec-${p.producto_codigo}`,
          producto_codigo: p.producto_codigo,
          producto: p.producto,
          ubicacion_origen: `${zonasBaja[idx % zonasBaja.length]}-01-01`,
          zona_origen: 'Zona C (Baja rotación)',
          ubicacion_destino: `${zonasPremium[idx % zonasPremium.length]}-01-01`,
          zona_destino: 'Zona A (Premium)',
          razon: `Producto clase A con ${p.movimientos_90d} movimientos/90d, debe estar cerca de despacho`,
          clasificacion_abc: 'A',
          prioridad: 3,
          ahorro_tiempo_min: Math.floor(Math.random() * 10) + 5,
          ahorro_distancia_m: Math.floor(Math.random() * 50) + 20,
          estado: 'pendiente',
          fecha_creacion: new Date().toISOString(),
        });
      }
    });

    // Productos C en zonas premium (deberían moverse)
    productosC.slice(0, 3).forEach((p, idx) => {
      recomendaciones.push({
        id: `rec-c-${p.producto_codigo}`,
        producto_codigo: p.producto_codigo,
        producto: p.producto,
        ubicacion_origen: `${zonasPremium[idx % zonasPremium.length]}-02-01`,
        zona_origen: 'Zona A (Premium)',
        ubicacion_destino: `${zonasBaja[idx % zonasBaja.length]}-03-01`,
        zona_destino: 'Zona C (Baja rotación)',
        razon: `Producto clase C ocupando espacio premium, solo ${p.movimientos_90d} movimientos/90d`,
        clasificacion_abc: 'C',
        prioridad: 2,
        ahorro_tiempo_min: Math.floor(Math.random() * 5) + 2,
        ahorro_distancia_m: Math.floor(Math.random() * 30) + 10,
        estado: 'pendiente',
        fecha_creacion: new Date().toISOString(),
      });
    });

    return recomendaciones.sort((a, b) => b.prioridad - a.prioridad);
  };

  // ============================================
  // DATOS COMPUTADOS
  // ============================================

  const analisisFiltrado = useMemo(() => {
    return analisis.filter(a => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!a.producto_codigo.toLowerCase().includes(search) &&
            !a.producto?.descripcion?.toLowerCase().includes(search)) return false;
      }
      
      if (filtroABC !== 'todos' && a.clasificacion_abc !== filtroABC) return false;
      if (filtroXYZ !== 'todos' && a.clasificacion_xyz !== filtroXYZ) return false;
      
      if (mostrarSoloMalUbicados) {
        // Simular: A en zona C o C en zona A
        const tieneRecomendacion = recomendaciones.some(r => r.producto_codigo === a.producto_codigo && r.estado === 'pendiente');
        if (!tieneRecomendacion) return false;
      }
      
      return true;
    });
  }, [analisis, searchTerm, filtroABC, filtroXYZ, mostrarSoloMalUbicados, recomendaciones]);

  const resumen = useMemo((): ResumenSlotting => {
    const productosA = analisis.filter(a => a.clasificacion_abc === 'A');
    const productosB = analisis.filter(a => a.clasificacion_abc === 'B');
    const productosC = analisis.filter(a => a.clasificacion_abc === 'C');
    
    const totalValor = analisis.reduce((s, a) => s + a.valor_inventario, 0);
    const totalMov = analisis.reduce((s, a) => s + a.movimientos_90d, 0);
    
    const valorA = productosA.reduce((s, a) => s + a.valor_inventario, 0);
    const valorB = productosB.reduce((s, a) => s + a.valor_inventario, 0);
    const valorC = productosC.reduce((s, a) => s + a.valor_inventario, 0);
    
    const movA = productosA.reduce((s, a) => s + a.movimientos_90d, 0);
    const movB = productosB.reduce((s, a) => s + a.movimientos_90d, 0);
    const movC = productosC.reduce((s, a) => s + a.movimientos_90d, 0);
    
    const recsPendientes = recomendaciones.filter(r => r.estado === 'pendiente');
    const recsEjecutadas = recomendaciones.filter(r => r.estado === 'ejecutada');
    
    return {
      total_productos: analisis.length,
      productos_a: productosA.length,
      productos_b: productosB.length,
      productos_c: productosC.length,
      valor_a_pct: totalValor > 0 ? (valorA / totalValor) * 100 : 0,
      valor_b_pct: totalValor > 0 ? (valorB / totalValor) * 100 : 0,
      valor_c_pct: totalValor > 0 ? (valorC / totalValor) * 100 : 0,
      movimientos_a_pct: totalMov > 0 ? (movA / totalMov) * 100 : 0,
      movimientos_b_pct: totalMov > 0 ? (movB / totalMov) * 100 : 0,
      movimientos_c_pct: totalMov > 0 ? (movC / totalMov) * 100 : 0,
      productos_mal_ubicados: recsPendientes.length,
      ahorro_potencial_tiempo: recsPendientes.reduce((s, r) => s + (r.ahorro_tiempo_min || 0), 0),
      ahorro_potencial_distancia: recsPendientes.reduce((s, r) => s + (r.ahorro_distancia_m || 0), 0),
      recomendaciones_pendientes: recsPendientes.length,
      recomendaciones_ejecutadas: recsEjecutadas.length,
    };
  }, [analisis, recomendaciones]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleEjecutarAnalisis = async () => {
    setAnalizando(true);
    try {
      await loadData();
    } finally {
      setAnalizando(false);
    }
  };

  const handleAprobarRecomendacion = (recId: string) => {
    setRecomendaciones(prev => prev.map(r => 
      r.id === recId ? { ...r, estado: 'aprobada' as EstadoRecomendacion, aprobado_por: 'usuario' } : r
    ));
  };

  const handleRechazarRecomendacion = (recId: string) => {
    setRecomendaciones(prev => prev.map(r => 
      r.id === recId ? { ...r, estado: 'rechazada' as EstadoRecomendacion } : r
    ));
  };

  const handleEjecutarRecomendacion = async (recId: string) => {
    setSaving(true);
    try {
      // En producción: crear movimiento de transferencia interna
      setRecomendaciones(prev => prev.map(r => 
        r.id === recId 
          ? { ...r, estado: 'ejecutada' as EstadoRecomendacion, fecha_ejecucion: new Date().toISOString(), ejecutado_por: 'usuario' } 
          : r
      ));
    } finally {
      setSaving(false);
    }
  };

  const handleEjecutarTodas = async () => {
    const aprobadas = recomendaciones.filter(r => r.estado === 'aprobada');
    if (aprobadas.length === 0) {
      alert('No hay recomendaciones aprobadas para ejecutar');
      return;
    }
    
    if (!confirm(`¿Ejecutar ${aprobadas.length} reubicación(es)?`)) return;
    
    setSaving(true);
    try {
      for (const rec of aprobadas) {
        await handleEjecutarRecomendacion(rec.id);
      }
      alert(`✅ ${aprobadas.length} reubicaciones ejecutadas`);
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
        <RefreshCw className="h-8 w-8 animate-spin text-pink-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        {[
          { id: 'analisis' as const, label: 'Análisis ABC', icon: BarChart3 },
          { id: 'recomendaciones' as const, label: 'Recomendaciones', icon: Zap, count: resumen.recomendaciones_pendientes },
          { id: 'configuracion' as const, label: 'Configuración', icon: Settings },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setVistaActiva(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                vistaActiva === tab.id
                  ? 'bg-pink-500/20 text-pink-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="px-1.5 py-0.5 bg-pink-500/30 rounded text-xs">{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ==================== ANÁLISIS ==================== */}
      {vistaActiva === 'analisis' && (
        <>
          {/* Resumen visual */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Distribución ABC */}
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h4 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <PieChart className="h-5 w-5 text-pink-400" />
                Distribución ABC
              </h4>
              <div className="space-y-3">
                {(['A', 'B', 'C'] as ClasificacionABC[]).map(clase => {
                  const config = ABC_CONFIG[clase];
                  const cantidad = clase === 'A' ? resumen.productos_a : clase === 'B' ? resumen.productos_b : resumen.productos_c;
                  const pctMov = clase === 'A' ? resumen.movimientos_a_pct : clase === 'B' ? resumen.movimientos_b_pct : resumen.movimientos_c_pct;
                  const pct = resumen.total_productos > 0 ? (cantidad / resumen.total_productos) * 100 : 0;
                  
                  return (
                    <div key={clase}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-medium ${config.color}`}>Clase {clase}</span>
                        <span className="text-sm text-slate-400">{cantidad} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${config.bg.replace('/20', '')}`}
                          style={{ width: `${pctMov}%` }}
                        />
                      </div>
                      <div className="text-xs text-slate-500 mt-1">{pctMov.toFixed(1)}% de movimientos</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Métricas clave */}
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h4 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-pink-400" />
                Métricas Clave
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-200">{resumen.total_productos}</div>
                  <div className="text-xs text-slate-400">Productos</div>
                </div>
                <div className="text-center p-3 bg-red-500/10 rounded-lg">
                  <div className="text-2xl font-bold text-red-400">{resumen.productos_a}</div>
                  <div className="text-xs text-red-400">Clase A</div>
                </div>
                <div className="text-center p-3 bg-amber-500/10 rounded-lg">
                  <div className="text-2xl font-bold text-amber-400">{resumen.productos_b}</div>
                  <div className="text-xs text-amber-400">Clase B</div>
                </div>
                <div className="text-center p-3 bg-emerald-500/10 rounded-lg">
                  <div className="text-2xl font-bold text-emerald-400">{resumen.productos_c}</div>
                  <div className="text-xs text-emerald-400">Clase C</div>
                </div>
              </div>
            </div>

            {/* Oportunidades */}
            <div className="bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-pink-500/30 rounded-xl p-4">
              <h4 className="font-semibold text-pink-400 mb-4 flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Oportunidades de Mejora
              </h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Productos mal ubicados</span>
                  <span className="font-bold text-pink-400">{resumen.productos_mal_ubicados}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Ahorro tiempo potencial</span>
                  <span className="font-bold text-emerald-400">{resumen.ahorro_potencial_tiempo} min/día</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Ahorro distancia potencial</span>
                  <span className="font-bold text-blue-400">{resumen.ahorro_potencial_distancia} m/día</span>
                </div>
                <button
                  onClick={() => setVistaActiva('recomendaciones')}
                  className="w-full mt-2 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg text-sm font-medium"
                >
                  Ver Recomendaciones
                </button>
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
                  placeholder="Buscar producto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
                />
              </div>
              
              <select
                value={filtroABC}
                onChange={(e) => setFiltroABC(e.target.value)}
                className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
              >
                <option value="todos">Todas las clases</option>
                <option value="A">Clase A</option>
                <option value="B">Clase B</option>
                <option value="C">Clase C</option>
              </select>
              
              <label className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={mostrarSoloMalUbicados}
                  onChange={(e) => setMostrarSoloMalUbicados(e.target.checked)}
                  className="rounded border-slate-600"
                />
                <span className="text-sm text-slate-300">Solo mal ubicados</span>
              </label>
            </div>
            
            <button
              onClick={handleEjecutarAnalisis}
              disabled={analizando}
              className="flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl font-medium"
            >
              {analizando ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Re-analizar
            </button>
          </div>

          {/* Lista de productos con análisis */}
          <div className="space-y-2">
            {analisisFiltrado.slice(0, 50).map(a => {
              const abcConfig = ABC_CONFIG[a.clasificacion_abc];
              const xyzConfig = XYZ_CONFIG[a.clasificacion_xyz];
              const tieneRecomendacion = recomendaciones.some(r => r.producto_codigo === a.producto_codigo && r.estado === 'pendiente');
              
              return (
                <div 
                  key={a.producto_codigo}
                  className={`bg-slate-900/50 border rounded-xl p-4 ${
                    tieneRecomendacion ? 'border-pink-500/50' : 'border-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${abcConfig.bg} ${abcConfig.color}`}>
                        {a.clasificacion_combinada}
                      </div>
                      <div>
                        <div className="font-medium text-slate-200">{a.producto?.descripcion}</div>
                        <div className="text-xs text-slate-500 font-mono">{a.producto_codigo}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-lg font-bold text-slate-200">{a.movimientos_90d}</div>
                        <div className="text-xs text-slate-500">Mov. 90d</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-slate-200">{a.frecuencia_picks}</div>
                        <div className="text-xs text-slate-500">Picks 30d</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-slate-200">${(a.valor_inventario / 1000).toFixed(1)}k</div>
                        <div className="text-xs text-slate-500">Valor Inv.</div>
                      </div>
                      
                      <div className="flex gap-1">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${abcConfig.bg} ${abcConfig.color}`}>
                          {a.clasificacion_abc}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${xyzConfig.bg} ${xyzConfig.color}`}>
                          {a.clasificacion_xyz}
                        </span>
                      </div>
                      
                      {tieneRecomendacion && (
                        <span className="px-2 py-1 bg-pink-500/20 text-pink-400 rounded text-xs flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Reubicar
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {analisisFiltrado.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No hay productos que coincidan</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ==================== RECOMENDACIONES ==================== */}
      {vistaActiva === 'recomendaciones' && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Zap className="h-6 w-6 text-pink-400" />
              Recomendaciones de Slotting
            </h3>
            
            {recomendaciones.filter(r => r.estado === 'aprobada').length > 0 && (
              <button
                onClick={handleEjecutarTodas}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium"
              >
                <Play className="h-4 w-4" />
                Ejecutar Aprobadas ({recomendaciones.filter(r => r.estado === 'aprobada').length})
              </button>
            )}
          </div>

          <div className="space-y-3">
            {recomendaciones.map(rec => {
              const abcConfig = ABC_CONFIG[rec.clasificacion_abc];
              
              return (
                <div 
                  key={rec.id}
                  className={`bg-slate-900/50 border rounded-xl p-4 ${
                    rec.estado === 'pendiente' ? 'border-pink-500/30' :
                    rec.estado === 'aprobada' ? 'border-emerald-500/30' :
                    rec.estado === 'ejecutada' ? 'border-slate-700' :
                    'border-slate-800/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-xl ${abcConfig.bg}`}>
                        <Shuffle className={`h-5 w-5 ${abcConfig.color}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-slate-200">{rec.producto?.descripcion || rec.producto_codigo}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${abcConfig.bg} ${abcConfig.color}`}>
                            Clase {rec.clasificacion_abc}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            rec.estado === 'pendiente' ? 'bg-amber-500/20 text-amber-400' :
                            rec.estado === 'aprobada' ? 'bg-blue-500/20 text-blue-400' :
                            rec.estado === 'ejecutada' ? 'bg-emerald-500/20 text-emerald-400' :
                            'bg-slate-500/20 text-slate-400'
                          }`}>
                            {rec.estado === 'pendiente' ? 'Pendiente' :
                             rec.estado === 'aprobada' ? 'Aprobada' :
                             rec.estado === 'ejecutada' ? 'Ejecutada' : 'Rechazada'}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm mb-2">
                          <span className="font-mono text-slate-400">{rec.ubicacion_origen}</span>
                          <ArrowRight className="h-4 w-4 text-pink-400" />
                          <span className="font-mono text-emerald-400">{rec.ubicacion_destino}</span>
                        </div>
                        
                        <p className="text-sm text-slate-400">{rec.razon}</p>
                        
                        {(rec.ahorro_tiempo_min || rec.ahorro_distancia_m) && (
                          <div className="flex gap-4 mt-2 text-xs">
                            {rec.ahorro_tiempo_min && (
                              <span className="text-emerald-400">⏱ -{rec.ahorro_tiempo_min} min/día</span>
                            )}
                            {rec.ahorro_distancia_m && (
                              <span className="text-blue-400">📏 -{rec.ahorro_distancia_m} m/día</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {rec.estado === 'pendiente' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAprobarRecomendacion(rec.id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm flex items-center gap-1"
                        >
                          <Check className="h-4 w-4" />
                          Aprobar
                        </button>
                        <button
                          onClick={() => handleRechazarRecomendacion(rec.id)}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    
                    {rec.estado === 'aprobada' && (
                      <button
                        onClick={() => handleEjecutarRecomendacion(rec.id)}
                        disabled={saving}
                        className="px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white rounded-lg text-sm flex items-center gap-1"
                      >
                        <Play className="h-4 w-4" />
                        Ejecutar
                      </button>
                    )}
                    
                    {rec.estado === 'ejecutada' && (
                      <CheckCircle className="h-6 w-6 text-emerald-400" />
                    )}
                  </div>
                </div>
              );
            })}
            
            {recomendaciones.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-emerald-400" />
                <p className="text-emerald-400">¡Excelente! No hay recomendaciones pendientes</p>
                <p className="text-sm mt-1">El almacén está optimizado</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ==================== CONFIGURACIÓN ==================== */}
      {vistaActiva === 'configuracion' && (
        <ConfiguracionSlottingView
          config={config}
          setConfig={setConfig}
          onGuardar={() => { loadData(); setVistaActiva('analisis'); }}
        />
      )}
    </div>
  );
}

// ============================================
// SUB-COMPONENTES
// ============================================

interface ConfiguracionSlottingViewProps {
  config: ConfiguracionSlotting;
  setConfig: (c: ConfiguracionSlotting) => void;
  onGuardar: () => void;
}

function ConfiguracionSlottingView({ config, setConfig, onGuardar }: ConfiguracionSlottingViewProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
        <Settings className="h-6 w-6 text-pink-400" />
        Configuración de Slotting
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Umbrales ABC */}
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
          <h4 className="font-semibold text-slate-200 mb-4">Umbrales Clasificación ABC</h4>
          
          <label className="flex items-center gap-3 mb-4">
            <input
              type="checkbox"
              checked={config.usar_movimientos}
              onChange={(e) => setConfig({ ...config, usar_movimientos: e.target.checked })}
              className="rounded border-slate-600"
            />
            <span className="text-sm text-slate-300">Usar movimientos (en vez de valor)</span>
          </label>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Clase A: Top {config.usar_movimientos ? config.umbral_a_movimientos : config.umbral_a_valor}%
              </label>
              <input
                type="range"
                min={50}
                max={90}
                value={config.usar_movimientos ? config.umbral_a_movimientos : config.umbral_a_valor}
                onChange={(e) => setConfig({
                  ...config,
                  [config.usar_movimientos ? 'umbral_a_movimientos' : 'umbral_a_valor']: parseInt(e.target.value)
                })}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Clase A+B: Top {config.usar_movimientos ? config.umbral_b_movimientos : config.umbral_b_valor}%
              </label>
              <input
                type="range"
                min={80}
                max={99}
                value={config.usar_movimientos ? config.umbral_b_movimientos : config.umbral_b_valor}
                onChange={(e) => setConfig({
                  ...config,
                  [config.usar_movimientos ? 'umbral_b_movimientos' : 'umbral_b_valor']: parseInt(e.target.value)
                })}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Zonas del almacén */}
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
          <h4 className="font-semibold text-slate-200 mb-4">Zonas del Almacén</h4>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-red-400 mb-2">Zona Premium (Clase A)</label>
              <input
                type="text"
                value={config.zona_premium.join(', ')}
                onChange={(e) => setConfig({ ...config, zona_premium: e.target.value.split(',').map(s => s.trim()) })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm"
                placeholder="A-01, A-02, B-01"
              />
            </div>
            
            <div>
              <label className="block text-sm text-amber-400 mb-2">Zona Media (Clase B)</label>
              <input
                type="text"
                value={config.zona_media.join(', ')}
                onChange={(e) => setConfig({ ...config, zona_media: e.target.value.split(',').map(s => s.trim()) })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm"
                placeholder="A-03, B-02, B-03"
              />
            </div>
            
            <div>
              <label className="block text-sm text-emerald-400 mb-2">Zona Baja Rotación (Clase C)</label>
              <input
                type="text"
                value={config.zona_baja.join(', ')}
                onChange={(e) => setConfig({ ...config, zona_baja: e.target.value.split(',').map(s => s.trim()) })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm"
                placeholder="C-01, C-02, C-03"
              />
            </div>
          </div>
        </div>

        {/* Preferencias */}
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
          <h4 className="font-semibold text-slate-200 mb-4">Preferencias de Ubicación</h4>
          
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={config.priorizar_altura_baja}
                onChange={(e) => setConfig({ ...config, priorizar_altura_baja: e.target.checked })}
                className="rounded border-slate-600"
              />
              <span className="text-sm text-slate-300">Priorizar niveles bajos para Clase A</span>
            </label>
            
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={config.considerar_peso}
                onChange={(e) => setConfig({ ...config, considerar_peso: e.target.checked })}
                className="rounded border-slate-600"
              />
              <span className="text-sm text-slate-300">Considerar peso del producto</span>
            </label>
            
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={config.considerar_volumen}
                onChange={(e) => setConfig({ ...config, considerar_volumen: e.target.checked })}
                className="rounded border-slate-600"
              />
              <span className="text-sm text-slate-300">Considerar volumen del producto</span>
            </label>
          </div>
        </div>

        {/* Leyenda */}
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
          <h4 className="font-semibold text-slate-200 mb-4">Clasificación ABC/XYZ</h4>
          
          <div className="space-y-3">
            {Object.entries(ABC_CONFIG).map(([key, val]) => (
              <div key={key} className="flex items-center gap-3">
                <span className={`w-8 h-8 rounded flex items-center justify-center font-bold ${val.bg} ${val.color}`}>
                  {key}
                </span>
                <div>
                  <div className="text-sm text-slate-200">{val.label}</div>
                  <div className="text-xs text-slate-500">{val.descripcion}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onGuardar}
          className="flex items-center gap-2 px-6 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl font-medium"
        >
          <Check className="h-4 w-4" />
          Guardar y Re-analizar
        </button>
      </div>
    </div>
  );
}