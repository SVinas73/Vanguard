'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Package, MapPin, AlertTriangle, Clock, CheckCircle,
  RefreshCw, Warehouse, Layers, Target, Truck, Box,
  AlertCircle, Calendar, XCircle, ArrowRight, Archive,
  BarChart3,
} from 'lucide-react';

// ============================================
// TIPOS
// ============================================

interface MetricasWMS {
  ubicaciones_totales: number;
  ubicaciones_ocupadas: number;
  porcentaje_ocupacion: number;
  ubicaciones_bloqueadas: number;

  recepciones_pendientes: number;
  recepciones_en_proceso: number;
  recepciones_hoy: number;
  unidades_recibidas_hoy: number;

  picking_pendientes: number;
  picking_en_proceso: number;
  picking_completados_hoy: number;
  unidades_pickeadas_hoy: number;

  putaway_pendientes: number;

  productos_sin_stock: number;
  productos_bajo_minimo: number;
  lotes_proximos_vencer: number;
}

interface ActividadReciente {
  id: string;
  tipo: 'recepcion' | 'picking' | 'movimiento';
  descripcion: string;
  usuario: string;
  fecha: string;
  estado: string;
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
// COMPONENTE
// ============================================

export default function WMSDashboard() {
  const [loading, setLoading] = useState(true);
  const [metricas, setMetricas] = useState<MetricasWMS | null>(null);
  const [actividades, setActividades] = useState<ActividadReciente[]>([]);
  const [ocupacionZonas, setOcupacionZonas] = useState<OcupacionZona[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const hoy = new Date();
      const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString();

      // ---- KPIs (queries reales) ----
      const [
        ubicacionesRes,
        recepcionesRes,
        recepcionesHoyRes,
        pickingRes,
        pickingHoyRes,
        putawayRes,
        zonasRes,
        productosRes,
        lotesRes,
        actividadRecepRes,
        actividadPickRes,
        actividadMovRes,
      ] = await Promise.all([
        supabase
          .from('wms_ubicaciones')
          .select('id, zona_id, estado'),
        supabase
          .from('wms_ordenes_recepcion')
          .select('estado, unidades_recibidas')
          .in('estado', ['pendiente', 'en_proceso']),
        supabase
          .from('wms_ordenes_recepcion')
          .select('id, unidades_recibidas, fecha_recepcion')
          .gte('fecha_recepcion', inicioHoy),
        supabase
          .from('wms_ordenes_picking')
          .select('estado')
          .in('estado', ['pendiente', 'en_proceso']),
        supabase
          .from('wms_ordenes_picking')
          .select('id, unidades_pickeadas, fecha_completada, estado')
          .gte('fecha_completada', inicioHoy)
          .eq('estado', 'completada'),
        supabase
          .from('wms_tareas_putaway')
          .select('id', { count: 'exact', head: true })
          .eq('estado', 'pendiente'),
        supabase
          .from('wms_zonas')
          .select('id, codigo, nombre, tipo, activo')
          .eq('activo', true),
        supabase
          .from('productos')
          .select('codigo, stock, stockMinimo:stock_minimo'),
        supabase
          .from('lotes')
          .select('id, fecha_vencimiento')
          .not('fecha_vencimiento', 'is', null)
          .gte('fecha_vencimiento', new Date().toISOString().split('T')[0])
          .lte('fecha_vencimiento', new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]),
        supabase
          .from('wms_ordenes_recepcion')
          .select('id, numero, estado, created_at, creado_por, unidades_recibidas')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('wms_ordenes_picking')
          .select('id, numero, estado, created_at, creado_por, unidades_pickeadas')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('wms_movimientos')
          .select('id, numero, tipo, estado, created_at, creado_por')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      // ---- Calcular ocupación ----
      const ubics = ubicacionesRes.data || [];
      const totales = ubics.length;
      const ocupadas = ubics.filter((u: any) => u.estado === 'ocupada' || u.estado === 'reservada').length;
      const bloqueadas = ubics.filter((u: any) => u.estado === 'bloqueada' || u.estado === 'mantenimiento').length;

      // Por zona
      const zonas = zonasRes.data || [];
      const ocupacionPorZona: OcupacionZona[] = zonas.map((z: any) => {
        const ubicsZona = ubics.filter((u: any) => u.zona_id === z.id);
        const totZ = ubicsZona.length;
        const ocZ = ubicsZona.filter((u: any) => u.estado === 'ocupada' || u.estado === 'reservada').length;
        return {
          zona_id: z.id,
          zona_nombre: z.nombre,
          zona_tipo: z.tipo,
          ubicaciones_totales: totZ,
          ubicaciones_ocupadas: ocZ,
          porcentaje: totZ > 0 ? Math.round((ocZ / totZ) * 1000) / 10 : 0,
        };
      });

      // ---- Productos ----
      const prods = productosRes.data || [];
      const sinStock = prods.filter((p: any) => (p.stock ?? 0) === 0).length;
      const bajoMin = prods.filter((p: any) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= (p.stockMinimo ?? 0)).length;

      // ---- Métricas finales ----
      const recepcionesHoy = (recepcionesHoyRes.data || []);
      const pickingHoy = (pickingHoyRes.data || []);
      const recPend = (recepcionesRes.data || []);

      setMetricas({
        ubicaciones_totales: totales,
        ubicaciones_ocupadas: ocupadas,
        porcentaje_ocupacion: totales > 0 ? Math.round((ocupadas / totales) * 1000) / 10 : 0,
        ubicaciones_bloqueadas: bloqueadas,

        recepciones_pendientes: recPend.filter((r: any) => r.estado === 'pendiente').length,
        recepciones_en_proceso: recPend.filter((r: any) => r.estado === 'en_proceso').length,
        recepciones_hoy: recepcionesHoy.length,
        unidades_recibidas_hoy: recepcionesHoy.reduce((s: number, r: any) => s + (parseInt(r.unidades_recibidas) || 0), 0),

        picking_pendientes: (pickingRes.data || []).filter((p: any) => p.estado === 'pendiente').length,
        picking_en_proceso: (pickingRes.data || []).filter((p: any) => p.estado === 'en_proceso').length,
        picking_completados_hoy: pickingHoy.length,
        unidades_pickeadas_hoy: pickingHoy.reduce((s: number, p: any) => s + (parseInt(p.unidades_pickeadas) || 0), 0),

        putaway_pendientes: putawayRes.count || 0,

        productos_sin_stock: sinStock,
        productos_bajo_minimo: bajoMin,
        lotes_proximos_vencer: (lotesRes.data || []).length,
      });

      setOcupacionZonas(ocupacionPorZona);

      // ---- Actividad reciente ----
      const acts: ActividadReciente[] = [];
      (actividadRecepRes.data || []).forEach((r: any) => {
        acts.push({
          id: `r-${r.id}`,
          tipo: 'recepcion',
          descripcion: `Recepción ${r.numero || ''} (${r.unidades_recibidas || 0} uds)`,
          usuario: r.creado_por || 'Sistema',
          fecha: r.created_at,
          estado: r.estado,
        });
      });
      (actividadPickRes.data || []).forEach((p: any) => {
        acts.push({
          id: `p-${p.id}`,
          tipo: 'picking',
          descripcion: `Picking ${p.numero || ''} (${p.unidades_pickeadas || 0} uds)`,
          usuario: p.creado_por || 'Sistema',
          fecha: p.created_at,
          estado: p.estado,
        });
      });
      (actividadMovRes.data || []).forEach((m: any) => {
        acts.push({
          id: `m-${m.id}`,
          tipo: 'movimiento',
          descripcion: `${(m.tipo || 'Movimiento').replace(/_/g, ' ')} ${m.numero || ''}`,
          usuario: m.creado_por || 'Sistema',
          fecha: m.created_at,
          estado: m.estado,
        });
      });
      acts.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      setActividades(acts.slice(0, 8));
    } catch (error) {
      console.error('Error cargando dashboard WMS:', error);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // HELPERS
  // ============================================

  const formatTime = (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `hace ${hours}h`;
    return `hace ${Math.floor(hours / 24)}d`;
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
      case 'movimiento': return ArrowRight;
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

  if (!metricas) {
    return (
      <div className="text-center p-12 text-slate-500 text-sm">
        Sin datos de WMS aún.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Warehouse className="h-6 w-6 text-blue-400" />
            Dashboard WMS
          </h3>
          <p className="text-slate-400 text-sm mt-1">
            Datos en tiempo real desde la base
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

      {/* KPIs principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <KpiCard
          icon={Layers}
          color="text-blue-400"
          label="Ocupación"
          value={`${metricas.porcentaje_ocupacion}%`}
          sub={`${metricas.ubicaciones_ocupadas} / ${metricas.ubicaciones_totales}`}
          progress={metricas.porcentaje_ocupacion}
        />
        <KpiCard
          icon={Truck}
          color="text-amber-400"
          label="Recepciones Pend."
          value={String(metricas.recepciones_pendientes)}
          sub={`${metricas.recepciones_en_proceso} en proceso`}
        />
        <KpiCard
          icon={Target}
          color="text-purple-400"
          label="Picking Pend."
          value={String(metricas.picking_pendientes)}
          sub={`${metricas.picking_en_proceso} en proceso`}
        />
        <KpiCard
          icon={Archive}
          color="text-cyan-400"
          label="Putaway Pend."
          value={String(metricas.putaway_pendientes)}
          sub="tareas por acomodar"
        />
        <KpiCard
          icon={CheckCircle}
          color="text-emerald-400"
          label="Recibidas Hoy"
          value={String(metricas.recepciones_hoy)}
          sub={`${metricas.unidades_recibidas_hoy.toLocaleString()} uds`}
        />
        <KpiCard
          icon={CheckCircle}
          color="text-emerald-400"
          label="Pickeadas Hoy"
          value={String(metricas.picking_completados_hoy)}
          sub={`${metricas.unidades_pickeadas_hoy.toLocaleString()} uds`}
        />
      </div>

      {/* Contenido principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ocupación por zonas */}
        <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800/50 rounded-xl">
          <div className="p-4 border-b border-slate-800/50">
            <h4 className="font-semibold text-slate-200 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-400" />
              Ocupación por zonas
            </h4>
          </div>
          <div className="p-4 space-y-3">
            {ocupacionZonas.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-sm">
                Sin zonas configuradas todavía. Andá a Ubicaciones para crearlas.
              </div>
            ) : ocupacionZonas.map(zona => {
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
              Actividad reciente
            </h4>
          </div>
          <div className="divide-y divide-slate-800/50">
            {actividades.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">Sin actividad reciente</div>
            ) : actividades.map(act => {
              const Icon = getIconActividad(act.tipo);
              const ok = act.estado === 'completada' || act.estado === 'completado';
              const inProc = act.estado === 'en_proceso';
              return (
                <div key={act.id} className="p-3 flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${ok ? 'bg-emerald-500/20' : inProc ? 'bg-blue-500/20' : 'bg-slate-800'}`}>
                    <Icon className={`h-4 w-4 ${ok ? 'text-emerald-400' : inProc ? 'text-blue-400' : 'text-slate-400'}`} />
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

      {/* Alertas inferiores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AlertCard
          icon={XCircle}
          label="Sin stock"
          value={metricas.productos_sin_stock}
          unit="productos"
          color="red"
        />
        <AlertCard
          icon={AlertCircle}
          label="Bajo mínimo"
          value={metricas.productos_bajo_minimo}
          unit="productos"
          color="amber"
        />
        <AlertCard
          icon={Calendar}
          label="Próx. vencer (30 días)"
          value={metricas.lotes_proximos_vencer}
          unit="lotes"
          color="orange"
        />
        <AlertCard
          icon={Box}
          label="Bloqueadas"
          value={metricas.ubicaciones_bloqueadas}
          unit="ubicaciones"
          color="slate"
        />
      </div>
    </div>
  );
}

// ============================================
// SUBCOMPONENTES
// ============================================

function KpiCard({
  icon: Icon, color, label, value, sub, progress,
}: {
  icon: React.ElementType;
  color: string;
  label: string;
  value: string;
  sub?: string;
  progress?: number;
}) {
  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400">{label}</span>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {progress !== undefined && (
        <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full ${progress >= 90 ? 'bg-red-500' : progress >= 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      )}
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function AlertCard({
  icon: Icon, label, value, unit, color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  unit: string;
  color: 'red' | 'amber' | 'orange' | 'slate';
}) {
  const isActive = value > 0;
  const palette = {
    red: { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-400' },
    amber: { bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-400' },
    orange: { bg: 'bg-orange-500/10 border-orange-500/30', text: 'text-orange-400' },
    slate: { bg: 'bg-slate-700/30 border-slate-600/50', text: 'text-slate-300' },
  }[color];

  return (
    <div className={`rounded-xl p-4 border ${isActive ? palette.bg : 'bg-slate-900/50 border-slate-800/50'}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-400 mb-1">{label}</div>
          <div className={`text-2xl font-bold ${isActive ? palette.text : 'text-slate-400'}`}>{value}</div>
          <div className="text-xs text-slate-500 mt-1">{unit}</div>
        </div>
        <Icon className={`h-8 w-8 ${isActive ? palette.text : 'text-slate-600'}`} />
      </div>
    </div>
  );
}
