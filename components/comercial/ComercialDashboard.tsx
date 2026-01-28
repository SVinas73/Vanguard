'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Truck, Users,
  Package, FileText, Clock, AlertTriangle, CheckCircle, ArrowRight,
  ArrowUpRight, ArrowDownRight, Calendar, CreditCard, BarChart3,
  PieChart, Activity, RefreshCw, ChevronRight, Building, User,
  Send, XCircle, Filter, Eye
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';

// ============================================
// TIPOS
// ============================================

interface ComercialStats {
  // Ventas
  ventasMes: number;
  ventasMesAnterior: number;
  ventasPendientes: number;
  ventasPendientesCount: number;
  cuentasPorCobrar: number;
  cotizacionesActivas: number;
  cotizacionesValor: number;
  
  // Compras
  comprasMes: number;
  comprasMesAnterior: number;
  comprasPendientes: number;
  comprasPendientesCount: number;
  comprasEnTransito: number;
  
  // Margen
  margenBruto: number;
  margenPorcentaje: number;
}

interface OrdenReciente {
  id: string;
  numero: string;
  tipo: 'compra' | 'venta' | 'cotizacion';
  entidad: string;
  total: number;
  estado: string;
  fecha: string;
}

interface TopEntidad {
  id: string;
  codigo: string;
  nombre: string;
  total: number;
  ordenes: number;
}

interface AlertaComercial {
  tipo: 'vencimiento' | 'pago' | 'entrega' | 'cotizacion';
  mensaje: string;
  entidad: string;
  fecha?: string;
  monto?: number;
  urgencia: 'alta' | 'media' | 'baja';
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

interface ComercialDashboardProps {
  onNavigate?: (view: 'compras' | 'ventas' | 'cotizaciones') => void;
}

export default function ComercialDashboard({ onNavigate }: ComercialDashboardProps) {
  const [stats, setStats] = useState<ComercialStats | null>(null);
  const [ordenesRecientes, setOrdenesRecientes] = useState<OrdenReciente[]>([]);
  const [topClientes, setTopClientes] = useState<TopEntidad[]>([]);
  const [topProveedores, setTopProveedores] = useState<TopEntidad[]>([]);
  const [alertas, setAlertas] = useState<AlertaComercial[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodoFiltro, setPeriodoFiltro] = useState<'mes' | 'trimestre' | 'año'>('mes');

  useEffect(() => {
    loadDashboardData();
  }, [periodoFiltro]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Fechas para filtros
      const hoy = new Date();
      const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0);

      // 1. Cargar estadísticas de ventas
      const [ventasMesRes, ventasMesAntRes, ventasPendRes, cuentasCobrarRes] = await Promise.all([
        supabase
          .from('ordenes_venta')
          .select('total')
          .gte('fecha_orden', inicioMes.toISOString().split('T')[0])
          .not('estado', 'eq', 'cancelada'),
        supabase
          .from('ordenes_venta')
          .select('total')
          .gte('fecha_orden', inicioMesAnterior.toISOString().split('T')[0])
          .lte('fecha_orden', finMesAnterior.toISOString().split('T')[0])
          .not('estado', 'eq', 'cancelada'),
        supabase
          .from('ordenes_venta')
          .select('id, total')
          .not('estado', 'in', '("cancelada","entregada")'),
        supabase
          .from('ordenes_venta')
          .select('saldo_pendiente')
          .or('estado_pago.eq.pendiente,estado_pago.eq.parcial'),
      ]);

      // 2. Cargar estadísticas de compras
      const [comprasMesRes, comprasMesAntRes, comprasPendRes, comprasTransitoRes] = await Promise.all([
        supabase
          .from('ordenes_compra')
          .select('total')
          .gte('fecha_orden', inicioMes.toISOString().split('T')[0])
          .not('estado', 'eq', 'cancelada'),
        supabase
          .from('ordenes_compra')
          .select('total')
          .gte('fecha_orden', inicioMesAnterior.toISOString().split('T')[0])
          .lte('fecha_orden', finMesAnterior.toISOString().split('T')[0])
          .not('estado', 'eq', 'cancelada'),
        supabase
          .from('ordenes_compra')
          .select('id, total')
          .not('estado', 'in', '("cancelada","recibida")'),
        supabase
          .from('ordenes_compra')
          .select('total')
          .eq('estado', 'enviada'),
      ]);

      // 3. Cotizaciones activas
      const cotizacionesRes = await supabase
        .from('cotizaciones')
        .select('id, total')
        .in('estado', ['borrador', 'enviada']);

      // Calcular estadísticas
      const ventasMes = ventasMesRes.data?.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0) || 0;
      const ventasMesAnterior = ventasMesAntRes.data?.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0) || 0;
      const ventasPendientes = ventasPendRes.data?.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0) || 0;
      const cuentasPorCobrar = cuentasCobrarRes.data?.reduce((sum, o) => sum + (parseFloat(o.saldo_pendiente) || 0), 0) || 0;
      
      const comprasMes = comprasMesRes.data?.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0) || 0;
      const comprasMesAnterior = comprasMesAntRes.data?.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0) || 0;
      const comprasPendientes = comprasPendRes.data?.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0) || 0;
      const comprasEnTransito = comprasTransitoRes.data?.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0) || 0;
      
      const cotizacionesValor = cotizacionesRes.data?.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0) || 0;

      const margenBruto = ventasMes - comprasMes;
      const margenPorcentaje = ventasMes > 0 ? (margenBruto / ventasMes) * 100 : 0;

      setStats({
        ventasMes,
        ventasMesAnterior,
        ventasPendientes,
        ventasPendientesCount: ventasPendRes.data?.length || 0,
        cuentasPorCobrar,
        cotizacionesActivas: cotizacionesRes.data?.length || 0,
        cotizacionesValor,
        comprasMes,
        comprasMesAnterior,
        comprasPendientes,
        comprasPendientesCount: comprasPendRes.data?.length || 0,
        comprasEnTransito,
        margenBruto,
        margenPorcentaje,
      });

      // 4. Órdenes recientes (últimas 10)
      const [ordenesVentaRecientes, ordenesCompraRecientes] = await Promise.all([
        supabase
          .from('ordenes_venta')
          .select('id, numero, total, estado, fecha_orden, clientes(nombre)')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('ordenes_compra')
          .select('id, numero, total, estado, fecha_orden, proveedores(nombre)')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const recientes: OrdenReciente[] = [
        ...(ordenesVentaRecientes.data || []).map((o: any) => ({
          id: o.id,
          numero: o.numero,
          tipo: 'venta' as const,
          entidad: o.clientes?.nombre || 'Sin cliente',
          total: parseFloat(o.total) || 0,
          estado: o.estado,
          fecha: o.fecha_orden,
        })),
        ...(ordenesCompraRecientes.data || []).map((o: any) => ({
          id: o.id,
          numero: o.numero,
          tipo: 'compra' as const,
          entidad: o.proveedores?.nombre || 'Sin proveedor',
          total: parseFloat(o.total) || 0,
          estado: o.estado,
          fecha: o.fecha_orden,
        })),
      ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()).slice(0, 8);

      setOrdenesRecientes(recientes);

      // Intentar cargar top clientes/proveedores (las funciones RPC son opcionales)
        let topClientesRes = { data: null };
        let topProveedoresRes = { data: null };

        try {
        const [clientesRpc, proveedoresRpc] = await Promise.all([
            supabase.rpc('get_top_clientes', { limite: 5 }),
            supabase.rpc('get_top_proveedores', { limite: 5 }),
        ]);
        topClientesRes = clientesRpc;
        topProveedoresRes = proveedoresRpc;
        } catch {
        // Si las funciones RPC no existen, se calculará manualmente abajo
        }

      // Si no hay funciones RPC, calcular manualmente
      if (!topClientesRes.data) {
        const { data: ventasCliente } = await supabase
          .from('ordenes_venta')
          .select('cliente_id, total, clientes(id, codigo, nombre)')
          .not('estado', 'eq', 'cancelada')
          .gte('fecha_orden', inicioMes.toISOString().split('T')[0]);

        const clienteMap = new Map<string, TopEntidad>();
        ventasCliente?.forEach((v: any) => {
          if (v.cliente_id && v.clientes) {
            const existing = clienteMap.get(v.cliente_id);
            if (existing) {
              existing.total += parseFloat(v.total) || 0;
              existing.ordenes += 1;
            } else {
              clienteMap.set(v.cliente_id, {
                id: v.cliente_id,
                codigo: v.clientes.codigo,
                nombre: v.clientes.nombre,
                total: parseFloat(v.total) || 0,
                ordenes: 1,
              });
            }
          }
        });
        setTopClientes(Array.from(clienteMap.values()).sort((a, b) => b.total - a.total).slice(0, 5));
      } else {
        setTopClientes(topClientesRes.data || []);
      }

      if (!topProveedoresRes.data) {
        const { data: comprasProveedor } = await supabase
          .from('ordenes_compra')
          .select('proveedor_id, total, proveedores(id, codigo, nombre)')
          .not('estado', 'eq', 'cancelada')
          .gte('fecha_orden', inicioMes.toISOString().split('T')[0]);

        const proveedorMap = new Map<string, TopEntidad>();
        comprasProveedor?.forEach((c: any) => {
          if (c.proveedor_id && c.proveedores) {
            const existing = proveedorMap.get(c.proveedor_id);
            if (existing) {
              existing.total += parseFloat(c.total) || 0;
              existing.ordenes += 1;
            } else {
              proveedorMap.set(c.proveedor_id, {
                id: c.proveedor_id,
                codigo: c.proveedores.codigo,
                nombre: c.proveedores.nombre,
                total: parseFloat(c.total) || 0,
                ordenes: 1,
              });
            }
          }
        });
        setTopProveedores(Array.from(proveedorMap.values()).sort((a, b) => b.total - a.total).slice(0, 5));
      } else {
        setTopProveedores(topProveedoresRes.data || []);
      }

      // 6. Generar alertas
      const alertasGeneradas: AlertaComercial[] = [];

      // Alertas de cotizaciones por vencer
      const { data: cotizacionesVencer } = await supabase
        .from('cotizaciones')
        .select('numero, fecha_validez, total, clientes(nombre)')
        .eq('estado', 'enviada')
        .lte('fecha_validez', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

      cotizacionesVencer?.forEach((c: any) => {
        alertasGeneradas.push({
          tipo: 'cotizacion',
          mensaje: `Cotización ${c.numero} por vencer`,
          entidad: c.clientes?.nombre || 'Cliente',
          fecha: c.fecha_validez,
          monto: parseFloat(c.total),
          urgencia: new Date(c.fecha_validez) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) ? 'alta' : 'media',
        });
      });

      // Alertas de entregas pendientes
      const { data: entregasPendientes } = await supabase
        .from('ordenes_venta')
        .select('numero, fecha_entrega_esperada, clientes(nombre)')
        .in('estado', ['confirmada', 'en_proceso'])
        .lte('fecha_entrega_esperada', new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

      entregasPendientes?.forEach((o: any) => {
        alertasGeneradas.push({
          tipo: 'entrega',
          mensaje: `Entrega pendiente ${o.numero}`,
          entidad: o.clientes?.nombre || 'Cliente',
          fecha: o.fecha_entrega_esperada,
          urgencia: new Date(o.fecha_entrega_esperada) <= new Date() ? 'alta' : 'media',
        });
      });

      // Alertas de compras esperadas
      const { data: comprasEsperadas } = await supabase
        .from('ordenes_compra')
        .select('numero, fecha_esperada, proveedores(nombre)')
        .eq('estado', 'enviada')
        .lte('fecha_esperada', new Date().toISOString().split('T')[0]);

      comprasEsperadas?.forEach((o: any) => {
        alertasGeneradas.push({
          tipo: 'entrega',
          mensaje: `OC ${o.numero} atrasada`,
          entidad: o.proveedores?.nombre || 'Proveedor',
          fecha: o.fecha_esperada,
          urgencia: 'alta',
        });
      });

      setAlertas(alertasGeneradas.sort((a, b) => {
        const prioridad = { alta: 0, media: 1, baja: 2 };
        return prioridad[a.urgencia] - prioridad[b.urgencia];
      }).slice(0, 5));

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // HELPERS
  // ============================================

  const getTendencia = (actual: number, anterior: number) => {
    if (anterior === 0) return { valor: 0, direccion: 'neutral' };
    const cambio = ((actual - anterior) / anterior) * 100;
    return {
      valor: Math.abs(cambio).toFixed(1),
      direccion: cambio >= 0 ? 'up' : 'down',
    };
  };

  const getEstadoConfig = (estado: string, tipo: 'compra' | 'venta' | 'cotizacion') => {
    const configs: Record<string, { color: string; bg: string }> = {
      borrador: { color: 'text-slate-400', bg: 'bg-slate-500/20' },
      enviada: { color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
      confirmada: { color: 'text-blue-400', bg: 'bg-blue-500/20' },
      en_proceso: { color: 'text-amber-400', bg: 'bg-amber-500/20' },
      parcial: { color: 'text-amber-400', bg: 'bg-amber-500/20' },
      recibida: { color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
      entregada: { color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
      aceptada: { color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
      cancelada: { color: 'text-red-400', bg: 'bg-red-500/20' },
      rechazada: { color: 'text-red-400', bg: 'bg-red-500/20' },
    };
    return configs[estado] || configs.borrador;
  };

  const formatRelativeDate = (fecha: string) => {
    const date = new Date(fecha);
    const hoy = new Date();
    const diffDays = Math.floor((hoy.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return date.toLocaleDateString('es-UY', { day: '2-digit', month: 'short' });
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

  const tendenciaVentas = getTendencia(stats?.ventasMes || 0, stats?.ventasMesAnterior || 0);
  const tendenciaCompras = getTendencia(stats?.comprasMes || 0, stats?.comprasMesAnterior || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <BarChart3 className="h-7 w-7 text-emerald-400" />
            Dashboard Comercial
          </h2>
          <p className="text-slate-400 text-sm mt-1">Resumen de compras, ventas y cotizaciones</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={periodoFiltro}
            onChange={(e) => setPeriodoFiltro(e.target.value as any)}
            className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-200"
          >
            <option value="mes">Este mes</option>
            <option value="trimestre">Trimestre</option>
            <option value="año">Este año</option>
          </select>
          <button
            onClick={loadDashboardData}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            <RefreshCw className="h-4 w-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ventas del mes */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-slate-900/80 p-5">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-emerald-500/20">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
              </div>
              <div className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium',
                tendenciaVentas.direccion === 'up' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
              )}>
                {tendenciaVentas.direccion === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {tendenciaVentas.valor}%
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-400 mb-1">
              {formatCurrency(stats?.ventasMes || 0)}
            </div>
            <div className="text-sm text-slate-400">Ventas del mes</div>
          </div>
        </div>

        {/* Compras del mes */}
        <div className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-slate-900/80 p-5">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-transparent" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-cyan-500/20">
                <ShoppingCart className="h-5 w-5 text-cyan-400" />
              </div>
              <div className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium',
                tendenciaCompras.direccion === 'up' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
              )}>
                {tendenciaCompras.direccion === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {tendenciaCompras.valor}%
              </div>
            </div>
            <div className="text-2xl font-bold text-cyan-400 mb-1">
              {formatCurrency(stats?.comprasMes || 0)}
            </div>
            <div className="text-sm text-slate-400">Compras del mes</div>
          </div>
        </div>

        {/* Margen */}
        <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-slate-900/80 p-5">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-transparent" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-purple-500/20">
                <DollarSign className="h-5 w-5 text-purple-400" />
              </div>
              <span className={cn(
                'px-2 py-1 rounded-lg text-xs font-medium',
                (stats?.margenPorcentaje || 0) >= 20 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
              )}>
                {(stats?.margenPorcentaje || 0).toFixed(1)}%
              </span>
            </div>
            <div className={cn(
              'text-2xl font-bold mb-1',
              (stats?.margenBruto || 0) >= 0 ? 'text-purple-400' : 'text-red-400'
            )}>
              {formatCurrency(stats?.margenBruto || 0)}
            </div>
            <div className="text-sm text-slate-400">Margen bruto</div>
          </div>
        </div>

        {/* Cuentas por cobrar */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-slate-900/80 p-5">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-amber-500/20">
                <CreditCard className="h-5 w-5 text-amber-400" />
              </div>
            </div>
            <div className="text-2xl font-bold text-amber-400 mb-1">
              {formatCurrency(stats?.cuentasPorCobrar || 0)}
            </div>
            <div className="text-sm text-slate-400">Por cobrar</div>
          </div>
        </div>
      </div>

      {/* Segunda fila de stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => onNavigate?.('ventas')}
          className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50 hover:border-emerald-500/30 transition-all group text-left"
        >
          <div className="flex items-center justify-between mb-2">
            <Package className="h-5 w-5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
            <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
          </div>
          <div className="text-xl font-bold text-slate-200">{stats?.ventasPendientesCount || 0}</div>
          <div className="text-sm text-slate-500">Ventas pendientes</div>
          <div className="text-xs text-emerald-400 mt-1">{formatCurrency(stats?.ventasPendientes || 0)}</div>
        </button>

        <button
          onClick={() => onNavigate?.('compras')}
          className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50 hover:border-cyan-500/30 transition-all group text-left"
        >
          <div className="flex items-center justify-between mb-2">
            <Truck className="h-5 w-5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
            <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
          </div>
          <div className="text-xl font-bold text-slate-200">{stats?.comprasPendientesCount || 0}</div>
          <div className="text-sm text-slate-500">Compras pendientes</div>
          <div className="text-xs text-cyan-400 mt-1">{formatCurrency(stats?.comprasEnTransito || 0)} en tránsito</div>
        </button>

        <button
          onClick={() => onNavigate?.('cotizaciones')}
          className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50 hover:border-violet-500/30 transition-all group text-left"
        >
          <div className="flex items-center justify-between mb-2">
            <FileText className="h-5 w-5 text-slate-500 group-hover:text-violet-400 transition-colors" />
            <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
          </div>
          <div className="text-xl font-bold text-slate-200">{stats?.cotizacionesActivas || 0}</div>
          <div className="text-sm text-slate-500">Cotizaciones activas</div>
          <div className="text-xs text-violet-400 mt-1">{formatCurrency(stats?.cotizacionesValor || 0)} potencial</div>
        </button>

        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50">
          <div className="flex items-center justify-between mb-2">
            <Activity className="h-5 w-5 text-slate-500" />
          </div>
          <div className="text-xl font-bold text-slate-200">
            {formatNumber((stats?.cotizacionesActivas || 0) > 0 
              ? Math.round(((stats?.cotizacionesValor || 0) / (stats?.ventasMes || 1)) * 100) 
              : 0)}%
          </div>
          <div className="text-sm text-slate-500">Pipeline/Ventas</div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Órdenes recientes */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800/50 bg-slate-900/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-200 flex items-center gap-2">
              <Clock className="h-5 w-5 text-slate-500" />
              Actividad Reciente
            </h3>
          </div>

          <div className="space-y-2">
            {ordenesRecientes.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                Sin actividad reciente
              </div>
            ) : (
              ordenesRecientes.map((orden) => {
                const estadoConfig = getEstadoConfig(orden.estado, orden.tipo);
                return (
                  <div
                    key={`${orden.tipo}-${orden.id}`}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-800/30 hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-2 rounded-lg',
                        orden.tipo === 'venta' ? 'bg-emerald-500/20' : orden.tipo === 'compra' ? 'bg-cyan-500/20' : 'bg-violet-500/20'
                      )}>
                        {orden.tipo === 'venta' ? (
                          <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                        ) : orden.tipo === 'compra' ? (
                          <ArrowDownRight className="h-4 w-4 text-cyan-400" />
                        ) : (
                          <FileText className="h-4 w-4 text-violet-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-slate-200">{orden.numero}</span>
                          <span className={cn('px-2 py-0.5 rounded text-xs', estadoConfig.bg, estadoConfig.color)}>
                            {orden.estado}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">{orden.entidad}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        'font-semibold text-sm',
                        orden.tipo === 'venta' ? 'text-emerald-400' : 'text-cyan-400'
                      )}>
                        {orden.tipo === 'venta' ? '+' : '-'}{formatCurrency(orden.total)}
                      </div>
                      <div className="text-xs text-slate-500">{formatRelativeDate(orden.fecha)}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Alertas */}
        <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-200 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              Alertas
            </h3>
            {alertas.length > 0 && (
              <span className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-medium">
                {alertas.length}
              </span>
            )}
          </div>

          <div className="space-y-2">
            {alertas.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Sin alertas pendientes</p>
              </div>
            ) : (
              alertas.map((alerta, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'p-3 rounded-xl border',
                    alerta.urgencia === 'alta' ? 'bg-red-500/10 border-red-500/30' :
                    alerta.urgencia === 'media' ? 'bg-amber-500/10 border-amber-500/30' :
                    'bg-slate-800/30 border-slate-700/30'
                  )}
                >
                  <div className="flex items-start gap-2">
                    {alerta.urgencia === 'alta' ? (
                      <XCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-200">{alerta.mensaje}</div>
                      <div className="text-xs text-slate-500">{alerta.entidad}</div>
                      {alerta.monto && (
                        <div className="text-xs text-emerald-400 mt-1">{formatCurrency(alerta.monto)}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Top Clientes y Proveedores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Clientes */}
        <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-200 flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-400" />
              Top Clientes del Mes
            </h3>
          </div>

          <div className="space-y-3">
            {topClientes.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-sm">Sin datos del período</div>
            ) : (
              topClientes.map((cliente, idx) => (
                <div key={cliente.id} className="flex items-center gap-3">
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold',
                    idx === 0 ? 'bg-amber-500/20 text-amber-400' :
                    idx === 1 ? 'bg-slate-500/20 text-slate-400' :
                    idx === 2 ? 'bg-orange-500/20 text-orange-400' :
                    'bg-slate-800 text-slate-500'
                  )}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-200 truncate">{cliente.nombre}</div>
                    <div className="text-xs text-slate-500">{cliente.ordenes} órdenes</div>
                  </div>
                  <div className="text-sm font-semibold text-emerald-400">
                    {formatCurrency(cliente.total)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Proveedores */}
        <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-200 flex items-center gap-2">
              <Truck className="h-5 w-5 text-cyan-400" />
              Top Proveedores del Mes
            </h3>
          </div>

          <div className="space-y-3">
            {topProveedores.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-sm">Sin datos del período</div>
            ) : (
              topProveedores.map((proveedor, idx) => (
                <div key={proveedor.id} className="flex items-center gap-3">
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold',
                    idx === 0 ? 'bg-amber-500/20 text-amber-400' :
                    idx === 1 ? 'bg-slate-500/20 text-slate-400' :
                    idx === 2 ? 'bg-orange-500/20 text-orange-400' :
                    'bg-slate-800 text-slate-500'
                  )}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-200 truncate">{proveedor.nombre}</div>
                    <div className="text-xs text-slate-500">{proveedor.ordenes} órdenes</div>
                  </div>
                  <div className="text-sm font-semibold text-cyan-400">
                    {formatCurrency(proveedor.total)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}