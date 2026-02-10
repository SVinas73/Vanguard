'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Package, MapPin, TrendingUp, TrendingDown, AlertTriangle,
  Clock, CheckCircle, XCircle, RefreshCw, ArrowRight,
  Warehouse, Layers, Target, Zap, BarChart3, Activity,
  Calendar, Users, Truck, Box, Archive, AlertCircle,
  ChevronRight, ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react';

// ============================================
// TIPOS LOCALES
// ============================================

interface MetricasWMS {
  ubicaciones_totales: number;
  ubicaciones_ocupadas: number;
  ubicaciones_disponibles: number;
  porcentaje_ocupacion: number;
  
  recepciones_pendientes: number;
  recepciones_hoy: number;
  unidades_recibidas_hoy: number;
  
  ordenes_picking_pendientes: number;
  ordenes_picking_en_proceso: number;
  ordenes_picking_completadas_hoy: number;
  unidades_pickeadas_hoy: number;
  
  picks_por_hora: number;
  putaways_por_hora: number;
  tiempo_promedio_picking_min: number;
  
  precision_inventario: number;
  precision_picking: number;
  
  productos_sin_stock: number;
  productos_bajo_minimo: number;
  lotes_proximos_vencer: number;
  ubicaciones_bloqueadas: number;
}

interface ActividadReciente {
  id: string;
  tipo: 'recepcion' | 'picking' | 'putaway' | 'movimiento' | 'conteo';
  descripcion: string;
  usuario: string;
  fecha: string;
  estado: 'completado' | 'en_proceso' | 'pendiente';
}

interface AlertaWMS {
  id: string;
  tipo: 'stock' | 'vencimiento' | 'capacidad' | 'pendiente';
  severidad: 'alta' | 'media' | 'baja';
  titulo: string;
  descripcion: string;
  cantidad?: number;
}

interface OcupacionZona {
  zona_id: string;
  zona_nombre: string;
  zona_tipo: string;
  ubicaciones_totales: number;
  ubicaciones_ocupadas: number;
  porcentaje: number;
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function WMSDashboard() {
  const [loading, setLoading] = useState(true);
  const [metricas, setMetricas] = useState<MetricasWMS | null>(null);
  const [actividades, setActividades] = useState<ActividadReciente[]>([]);
  const [alertas, setAlertas] = useState<AlertaWMS[]>([]);
  const [ocupacionZonas, setOcupacionZonas] = useState<OcupacionZona[]>([]);

  // ============================================
  // CARGA DE DATOS
  // ============================================

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // En producción, estos datos vendrían de queries reales
      // Por ahora, simulamos datos para demostración
      
      // Simular métricas
      setMetricas({
        ubicaciones_totales: 1250,
        ubicaciones_ocupadas: 847,
        ubicaciones_disponibles: 403,
        porcentaje_ocupacion: 67.8,
        
        recepciones_pendientes: 5,
        recepciones_hoy: 12,
        unidades_recibidas_hoy: 3420,
        
        ordenes_picking_pendientes: 23,
        ordenes_picking_en_proceso: 8,
        ordenes_picking_completadas_hoy: 45,
        unidades_pickeadas_hoy: 1890,
        
        picks_por_hora: 48.5,
        putaways_por_hora: 32.2,
        tiempo_promedio_picking_min: 4.2,
        
        precision_inventario: 99.2,
        precision_picking: 99.8,
        
        productos_sin_stock: 3,
        productos_bajo_minimo: 12,
        lotes_proximos_vencer: 8,
        ubicaciones_bloqueadas: 2,
      });
      
      // Simular ocupación por zonas
      setOcupacionZonas([
        { zona_id: '1', zona_nombre: 'Zona A - Alta Rotación', zona_tipo: 'picking', ubicaciones_totales: 200, ubicaciones_ocupadas: 185, porcentaje: 92.5 },
        { zona_id: '2', zona_nombre: 'Zona B - Media Rotación', zona_tipo: 'almacenamiento', ubicaciones_totales: 400, ubicaciones_ocupadas: 312, porcentaje: 78 },
        { zona_id: '3', zona_nombre: 'Zona C - Baja Rotación', zona_tipo: 'almacenamiento', ubicaciones_totales: 450, ubicaciones_ocupadas: 280, porcentaje: 62.2 },
        { zona_id: '4', zona_nombre: 'Refrigerado', zona_tipo: 'almacenamiento', ubicaciones_totales: 100, ubicaciones_ocupadas: 45, porcentaje: 45 },
        { zona_id: '5', zona_nombre: 'Recepción', zona_tipo: 'recepcion', ubicaciones_totales: 50, ubicaciones_ocupadas: 15, porcentaje: 30 },
        { zona_id: '6', zona_nombre: 'Despacho', zona_tipo: 'despacho', ubicaciones_totales: 50, ubicaciones_ocupadas: 10, porcentaje: 20 },
      ]);
      
      // Simular alertas
      setAlertas([
        { id: '1', tipo: 'vencimiento', severidad: 'alta', titulo: 'Lotes próximos a vencer', descripcion: '8 lotes vencen en los próximos 30 días', cantidad: 8 },
        { id: '2', tipo: 'stock', severidad: 'alta', titulo: 'Productos sin stock', descripcion: '3 productos con stock cero', cantidad: 3 },
        { id: '3', tipo: 'stock', severidad: 'media', titulo: 'Stock bajo mínimo', descripcion: '12 productos bajo punto de reorden', cantidad: 12 },
        { id: '4', tipo: 'pendiente', severidad: 'media', titulo: 'Órdenes atrasadas', descripcion: '5 órdenes de picking pendientes desde ayer', cantidad: 5 },
      ]);
      
      // Simular actividades recientes
      setActividades([
        { id: '1', tipo: 'picking', descripcion: 'Orden #ORD-2024-0892 completada', usuario: 'Carlos M.', fecha: new Date(Date.now() - 5 * 60000).toISOString(), estado: 'completado' },
        { id: '2', tipo: 'recepcion', descripcion: 'Recepción #REC-2024-0156 en proceso', usuario: 'María L.', fecha: new Date(Date.now() - 12 * 60000).toISOString(), estado: 'en_proceso' },
        { id: '3', tipo: 'putaway', descripcion: 'Put-away de 45 unidades en A-03-02-01', usuario: 'Juan P.', fecha: new Date(Date.now() - 18 * 60000).toISOString(), estado: 'completado' },
        { id: '4', tipo: 'picking', descripcion: 'Wave #WAV-0023 liberada (8 órdenes)', usuario: 'Sistema', fecha: new Date(Date.now() - 25 * 60000).toISOString(), estado: 'pendiente' },
        { id: '5', tipo: 'movimiento', descripcion: 'Reposición de SKU-1234 a picking', usuario: 'Roberto G.', fecha: new Date(Date.now() - 35 * 60000).toISOString(), estado: 'completado' },
      ]);
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // HELPERS
  // ============================================

  const formatTime = (date: string): string => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `Hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours}h`;
    return `Hace ${Math.floor(hours / 24)}d`;
  };

  const getColorOcupacion = (porcentaje: number) => {
    if (porcentaje >= 90) return { bg: 'bg-red-500', text: 'text-red-400' };
    if (porcentaje >= 75) return { bg: 'bg-amber-500', text: 'text-amber-400' };
    if (porcentaje >= 50) return { bg: 'bg-emerald-500', text: 'text-emerald-400' };
    return { bg: 'bg-blue-500', text: 'text-blue-400' };
  };

  const getIconActividad = (tipo: ActividadReciente['tipo']) => {
    switch (tipo) {
      case 'recepcion': return Truck;
      case 'picking': return Target;
      case 'putaway': return Archive;
      case 'movimiento': return ArrowRight;
      case 'conteo': return BarChart3;
      default: return Package;
    }
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!metricas) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Warehouse className="h-6 w-6 text-blue-400" />
            Dashboard WMS
          </h3>
          <p className="text-slate-400 text-sm mt-1">
            Gestión de Almacenes en Tiempo Real
          </p>
        </div>
        
        <button
          onClick={loadDashboardData}
          className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 rounded-xl text-slate-300 text-sm"
        >
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </button>
      </div>

      {/* Alertas críticas */}
      {alertas.filter(a => a.severidad === 'alta').length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-red-400 mb-2">Alertas Críticas</h4>
              <div className="space-y-1">
                {alertas.filter(a => a.severidad === 'alta').map(alerta => (
                  <div key={alerta.id} className="flex items-center justify-between text-sm">
                    <span className="text-red-300">{alerta.titulo}: {alerta.descripcion}</span>
                    {alerta.cantidad && (
                      <span className="px-2 py-0.5 bg-red-500/20 rounded-full text-red-400 font-medium">
                        {alerta.cantidad}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPIs principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {/* Ocupación */}
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Ocupación</span>
            <Layers className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">{metricas.porcentaje_ocupacion}%</div>
          <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full ${getColorOcupacion(metricas.porcentaje_ocupacion).bg}`}
              style={{ width: `${metricas.porcentaje_ocupacion}%` }}
            />
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {metricas.ubicaciones_ocupadas} / {metricas.ubicaciones_totales}
          </div>
        </div>

        {/* Recepciones pendientes */}
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Recepciones Pend.</span>
            <Truck className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">{metricas.recepciones_pendientes}</div>
          <div className="text-xs text-slate-500 mt-1">
            {metricas.unidades_recibidas_hoy.toLocaleString()} uds hoy
          </div>
        </div>

        {/* Picking pendiente */}
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Picking Pend.</span>
            <Target className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-400">{metricas.ordenes_picking_pendientes}</div>
          <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
            <span>{metricas.ordenes_picking_en_proceso} en proceso</span>
          </div>
        </div>

        {/* Completados hoy */}
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Completados Hoy</span>
            <CheckCircle className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">{metricas.ordenes_picking_completadas_hoy}</div>
          <div className="text-xs text-slate-500 mt-1">
            {metricas.unidades_pickeadas_hoy.toLocaleString()} unidades
          </div>
        </div>

        {/* Picks/hora */}
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Picks/Hora</span>
            <Zap className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-cyan-400">{metricas.picks_por_hora}</div>
          <div className="flex items-center gap-1 text-xs text-emerald-400 mt-1">
            <ArrowUpRight className="h-3 w-3" />
            <span>+12% vs ayer</span>
          </div>
        </div>

        {/* Precisión */}
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Precisión Picking</span>
            <Activity className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">{metricas.precision_picking}%</div>
          <div className="text-xs text-slate-500 mt-1">
            Inv: {metricas.precision_inventario}%
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ocupación por zonas */}
        <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800/50 rounded-xl">
          <div className="p-4 border-b border-slate-800/50">
            <h4 className="font-semibold text-slate-200 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-400" />
              Ocupación por Zonas
            </h4>
          </div>
          <div className="p-4 space-y-3">
            {ocupacionZonas.map(zona => {
              const colorConfig = getColorOcupacion(zona.porcentaje);
              return (
                <div key={zona.zona_id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-200">{zona.zona_nombre}</span>
                      <span className="px-1.5 py-0.5 bg-slate-800 rounded text-xs text-slate-400">
                        {zona.zona_tipo}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">
                        {zona.ubicaciones_ocupadas}/{zona.ubicaciones_totales}
                      </span>
                      <span className={`font-medium ${colorConfig.text}`}>
                        {zona.porcentaje}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${colorConfig.bg} transition-all`}
                      style={{ width: `${zona.porcentaje}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actividad reciente */}
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl">
          <div className="p-4 border-b border-slate-800/50">
            <h4 className="font-semibold text-slate-200 flex items-center gap-2">
              <Clock className="h-5 w-5 text-slate-400" />
              Actividad Reciente
            </h4>
          </div>
          <div className="divide-y divide-slate-800/50">
            {actividades.map(act => {
              const Icon = getIconActividad(act.tipo);
              return (
                <div key={act.id} className="p-3 flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    act.estado === 'completado' ? 'bg-emerald-500/20' :
                    act.estado === 'en_proceso' ? 'bg-blue-500/20' : 'bg-slate-800'
                  }`}>
                    <Icon className={`h-4 w-4 ${
                      act.estado === 'completado' ? 'text-emerald-400' :
                      act.estado === 'en_proceso' ? 'text-blue-400' : 'text-slate-400'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{act.descripcion}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <span>{act.usuario}</span>
                      <span>•</span>
                      <span>{formatTime(act.fecha)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fila inferior */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Productos sin stock */}
        <div className={`rounded-xl p-4 ${metricas.productos_sin_stock > 0 ? 'bg-red-500/10 border border-red-500/30' : 'bg-slate-900/50 border border-slate-800/50'}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 mb-1">Sin Stock</div>
              <div className={`text-2xl font-bold ${metricas.productos_sin_stock > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                {metricas.productos_sin_stock}
              </div>
              <div className="text-xs text-slate-500 mt-1">productos</div>
            </div>
            <XCircle className={`h-8 w-8 ${metricas.productos_sin_stock > 0 ? 'text-red-400' : 'text-slate-600'}`} />
          </div>
        </div>

        {/* Bajo mínimo */}
        <div className={`rounded-xl p-4 ${metricas.productos_bajo_minimo > 0 ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-slate-900/50 border border-slate-800/50'}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 mb-1">Bajo Mínimo</div>
              <div className={`text-2xl font-bold ${metricas.productos_bajo_minimo > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                {metricas.productos_bajo_minimo}
              </div>
              <div className="text-xs text-slate-500 mt-1">productos</div>
            </div>
            <AlertCircle className={`h-8 w-8 ${metricas.productos_bajo_minimo > 0 ? 'text-amber-400' : 'text-slate-600'}`} />
          </div>
        </div>

        {/* Próximos a vencer */}
        <div className={`rounded-xl p-4 ${metricas.lotes_proximos_vencer > 0 ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-slate-900/50 border border-slate-800/50'}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 mb-1">Próx. Vencer</div>
              <div className={`text-2xl font-bold ${metricas.lotes_proximos_vencer > 0 ? 'text-orange-400' : 'text-slate-400'}`}>
                {metricas.lotes_proximos_vencer}
              </div>
              <div className="text-xs text-slate-500 mt-1">lotes (30 días)</div>
            </div>
            <Calendar className={`h-8 w-8 ${metricas.lotes_proximos_vencer > 0 ? 'text-orange-400' : 'text-slate-600'}`} />
          </div>
        </div>

        {/* Ubicaciones bloqueadas */}
        <div className={`rounded-xl p-4 ${metricas.ubicaciones_bloqueadas > 0 ? 'bg-slate-700/50 border border-slate-600/50' : 'bg-slate-900/50 border border-slate-800/50'}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 mb-1">Bloqueadas</div>
              <div className={`text-2xl font-bold ${metricas.ubicaciones_bloqueadas > 0 ? 'text-slate-300' : 'text-slate-400'}`}>
                {metricas.ubicaciones_bloqueadas}
              </div>
              <div className="text-xs text-slate-500 mt-1">ubicaciones</div>
            </div>
            <Box className={`h-8 w-8 ${metricas.ubicaciones_bloqueadas > 0 ? 'text-slate-400' : 'text-slate-600'}`} />
          </div>
        </div>
      </div>

      {/* Resumen de productividad */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
        <h4 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-emerald-400" />
          Resumen de Productividad - Hoy
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-slate-800/30 rounded-xl">
            <div className="text-3xl font-bold text-slate-100">{metricas.recepciones_hoy}</div>
            <div className="text-sm text-slate-400 mt-1">Recepciones</div>
            <div className="text-xs text-emerald-400 mt-1">
              {metricas.unidades_recibidas_hoy.toLocaleString()} unidades
            </div>
          </div>
          
          <div className="text-center p-4 bg-slate-800/30 rounded-xl">
            <div className="text-3xl font-bold text-slate-100">{metricas.ordenes_picking_completadas_hoy}</div>
            <div className="text-sm text-slate-400 mt-1">Órdenes Picking</div>
            <div className="text-xs text-emerald-400 mt-1">
              {metricas.unidades_pickeadas_hoy.toLocaleString()} unidades
            </div>
          </div>
          
          <div className="text-center p-4 bg-slate-800/30 rounded-xl">
            <div className="text-3xl font-bold text-slate-100">{metricas.picks_por_hora}</div>
            <div className="text-sm text-slate-400 mt-1">Picks/Hora</div>
            <div className="text-xs text-cyan-400 mt-1">
              {metricas.tiempo_promedio_picking_min} min promedio
            </div>
          </div>
          
          <div className="text-center p-4 bg-slate-800/30 rounded-xl">
            <div className="text-3xl font-bold text-slate-100">{metricas.putaways_por_hora}</div>
            <div className="text-sm text-slate-400 mt-1">Put-aways/Hora</div>
            <div className="text-xs text-blue-400 mt-1">
              Eficiencia alta
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}