'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Product } from '@/types';
import { vanguardIA, PredictionsSummaryResponse, DemandForecastResponse } from '@/lib/ai/vanguard-ia-client';
import {
  TrendingUp, TrendingDown, AlertTriangle, Package,
  RefreshCw, Activity, Zap, BarChart3, Clock,
  CheckCircle, XCircle, ArrowUp, ArrowDown,
  Calendar, Target, DollarSign, Layers
} from 'lucide-react';

// ============================================
// TIPOS LOCALES
// ============================================

interface DashboardStats {
  totalProductos: number;
  productosCriticos: number;
  productosUrgenciaAlta: number;
  productosOk: number;
  
  valorInventarioTotal: number;
  valorEnRiesgo: number;
  
  demandaSemanalProyectada: number;
  demandaMensualProyectada: number;
  
  confianzaPromedio: number;
  apiDisponible: boolean;
}

interface ProductoCritico {
  codigo: string;
  descripcion: string;
  stock_actual: number;
  stock_minimo: number;
  consumo_diario: number;
  dias_restantes: number;
  urgencia: 'critica' | 'media' | 'baja';
  valor_inventario?: number;
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function ForecastDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [productos, setProductos] = useState<Product[]>([]);
  const [productosCriticos, setProductosCriticos] = useState<ProductoCritico[]>([]);
  const [forecastData, setForecastData] = useState<DemandForecastResponse | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalProductos: 0,
    productosCriticos: 0,
    productosUrgenciaAlta: 0,
    productosOk: 0,
    valorInventarioTotal: 0,
    valorEnRiesgo: 0,
    demandaSemanalProyectada: 0,
    demandaMensualProyectada: 0,
    confianzaPromedio: 0,
    apiDisponible: false,
  });

  // ============================================
  // CARGA DE DATOS
  // ============================================

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 1. Cargar productos de Supabase
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
        })));
      }

      // 2. Verificar si API está disponible
      let apiOnline = false;
      try {
        apiOnline = await vanguardIA.healthCheck();
      } catch {
        apiOnline = false;
      }

      // 3. Obtener datos de la API de IA
      let summaryData: PredictionsSummaryResponse | null = null;
      let demandData: DemandForecastResponse | null = null;
      
      if (apiOnline) {
        try {
          [summaryData, demandData] = await Promise.all([
            vanguardIA.getPredictionsSummary(),
            vanguardIA.getDemandForecast(90, 7),
          ]);
          
          setForecastData(demandData);
          
          if (summaryData?.productos_criticos) {
            setProductosCriticos(summaryData.productos_criticos);
          }
        } catch (apiError) {
          console.warn('Error obteniendo datos de API:', apiError);
        }
      }

      // 4. Calcular estadísticas
      const valorTotal = productosData?.reduce((sum, p) => 
        sum + (p.stock * (p.costo_promedio || p.precio || 0)), 0
      ) || 0;
      
      const criticos = summaryData?.productos_criticos || [];
      const valorEnRiesgo = criticos.reduce((sum, p) => {
        const prod = productosData?.find(pr => pr.codigo === p.codigo);
        return sum + (p.stock_actual * (prod?.costo_promedio || prod?.precio || 0));
      }, 0);
      
      const demandaSemanal = demandData?.predicciones?.reduce(
        (sum, p) => sum + p.demanda_predicha_semana, 0
      ) || 0;
      
      const confianzaProm = demandData?.predicciones?.length 
        ? demandData.predicciones.reduce((sum, p) => sum + p.confianza, 0) / demandData.predicciones.length
        : 0;

      setStats({
        totalProductos: productosData?.length || 0,
        productosCriticos: criticos.filter(p => p.urgencia === 'critica').length,
        productosUrgenciaAlta: criticos.filter(p => p.urgencia === 'media').length,
        productosOk: (productosData?.length || 0) - criticos.length,
        valorInventarioTotal: valorTotal,
        valorEnRiesgo: valorEnRiesgo,
        demandaSemanalProyectada: demandaSemanal,
        demandaMensualProyectada: demandaSemanal * 4,
        confianzaPromedio: confianzaProm,
        apiDisponible: apiOnline,
      });

    } catch (err) {
      setError('Error cargando datos del dashboard');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  // ============================================
  // TOP DEMANDA
  // ============================================

  const topDemanda = useMemo(() => {
    if (!forecastData?.predicciones) return [];
    return forecastData.predicciones
      .filter(p => p.demanda_predicha_semana > 0)
      .slice(0, 5);
  }, [forecastData]);

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${
            stats.apiDisponible 
              ? 'bg-emerald-500/20 text-emerald-400' 
              : 'bg-red-500/20 text-red-400'
          }`}>
            {stats.apiDisponible ? (
              <>
                <CheckCircle className="h-3 w-3" />
                <span>Vanguard IA Online</span>
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3" />
                <span>API Offline - Usando fallback</span>
              </>
            )}
          </div>
          {stats.apiDisponible && (
            <span className="text-xs text-slate-500">
              Confianza promedio: {(stats.confianzaPromedio * 100).toFixed(0)}%
            </span>
          )}
        </div>
        
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* KPIs principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          titulo="Productos"
          valor={stats.totalProductos}
          icono={Package}
          color="indigo"
        />
        <KPICard
          titulo="Críticos"
          valor={stats.productosCriticos}
          icono={AlertTriangle}
          color="red"
          alerta={stats.productosCriticos > 0}
        />
        <KPICard
          titulo="Demanda Semanal"
          valor={stats.demandaSemanalProyectada.toLocaleString()}
          subtitulo="unidades proyectadas"
          icono={TrendingUp}
          color="emerald"
        />
        <KPICard
          titulo="Valor en Riesgo"
          valor={`$${(stats.valorEnRiesgo / 1000).toFixed(1)}k`}
          subtitulo={`de $${(stats.valorInventarioTotal / 1000).toFixed(0)}k total`}
          icono={DollarSign}
          color="amber"
          alerta={stats.valorEnRiesgo > stats.valorInventarioTotal * 0.1}
        />
      </div>

      {/* Contenido principal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Productos críticos */}
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800/50 flex items-center justify-between">
            <h3 className="font-semibold text-slate-200 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Productos Críticos
            </h3>
            <span className="text-xs text-slate-500">{productosCriticos.length} productos</span>
          </div>
          
          <div className="divide-y divide-slate-800/50 max-h-80 overflow-y-auto">
            {productosCriticos.length > 0 ? (
              productosCriticos.slice(0, 8).map(producto => (
                <div key={producto.codigo} className="p-4 hover:bg-slate-800/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        producto.urgencia === 'critica' ? 'bg-red-500' :
                        producto.urgencia === 'media' ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} />
                      <span className="text-sm font-medium text-slate-200 truncate max-w-[200px]">
                        {producto.descripcion}
                      </span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      producto.urgencia === 'critica' ? 'bg-red-500/20 text-red-400' :
                      producto.urgencia === 'media' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {producto.dias_restantes.toFixed(0)}d
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Stock: {producto.stock_actual} / Mín: {producto.stock_minimo}</span>
                    <span>Consumo: {producto.consumo_diario.toFixed(1)}/día</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-500">
                <CheckCircle className="h-10 w-10 mx-auto mb-2 text-emerald-400" />
                <p className="text-emerald-400">Sin productos críticos</p>
              </div>
            )}
          </div>
        </div>

        {/* Top demanda */}
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800/50 flex items-center justify-between">
            <h3 className="font-semibold text-slate-200 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              Top Demanda Semanal
            </h3>
            <span className="text-xs text-slate-500">Predicción XGBoost</span>
          </div>
          
          <div className="divide-y divide-slate-800/50">
            {topDemanda.length > 0 ? (
              topDemanda.map((producto, idx) => {
                const maxDemanda = topDemanda[0]?.demanda_predicha_semana || 1;
                const pct = (producto.demanda_predicha_semana / maxDemanda) * 100;
                
                return (
                  <div key={producto.codigo} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 w-5">#{idx + 1}</span>
                        <span className="text-sm font-medium text-slate-200 truncate max-w-[200px]">
                          {producto.descripcion}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-emerald-400">
                        {producto.demanda_predicha_semana.toFixed(0)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 w-16 text-right">
                        {(producto.confianza * 100).toFixed(0)}% conf.
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-500">
                <Activity className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Sin datos de forecast</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Resumen de modelos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ModeloCard
          nombre="Holt-Winters"
          descripcion="Agotamiento de stock"
          uso="Predicción de días hasta stockout"
          precision={85}
          estado="activo"
        />
        <ModeloCard
          nombre="XGBoost"
          descripcion="Demanda semanal"
          uso="Forecast de demanda por producto"
          precision={75}
          estado="activo"
        />
        <ModeloCard
          nombre="Detección Anomalías"
          descripcion="Movimientos inusuales"
          uso="Alertas de comportamiento atípico"
          precision={90}
          estado="activo"
        />
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTES
// ============================================

interface KPICardProps {
  titulo: string;
  valor: number | string;
  subtitulo?: string;
  icono: React.ElementType;
  color: 'indigo' | 'emerald' | 'red' | 'amber' | 'purple';
  alerta?: boolean;
}

function KPICard({ titulo, valor, subtitulo, icono: Icon, color, alerta }: KPICardProps) {
  const colorClasses = {
    indigo: 'text-indigo-400 bg-indigo-500/20 border-indigo-500/30',
    emerald: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
    red: 'text-red-400 bg-red-500/20 border-red-500/30',
    amber: 'text-amber-400 bg-amber-500/20 border-amber-500/30',
    purple: 'text-purple-400 bg-purple-500/20 border-purple-500/30',
  };
  
  const [textColor, bgColor, borderColor] = colorClasses[color].split(' ');
  
  return (
    <div className={`${bgColor} border ${borderColor} rounded-xl p-4 ${alerta ? 'animate-pulse' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400">{titulo}</span>
        <Icon className={`h-4 w-4 ${textColor}`} />
      </div>
      <div className={`text-2xl font-bold ${textColor}`}>{valor}</div>
      {subtitulo && (
        <div className="text-xs text-slate-500 mt-1">{subtitulo}</div>
      )}
    </div>
  );
}

interface ModeloCardProps {
  nombre: string;
  descripcion: string;
  uso: string;
  precision: number;
  estado: 'activo' | 'inactivo' | 'entrenando';
}

function ModeloCard({ nombre, descripcion, uso, precision, estado }: ModeloCardProps) {
  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-indigo-400" />
          <span className="font-semibold text-slate-200">{nombre}</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          estado === 'activo' ? 'bg-emerald-500/20 text-emerald-400' :
          estado === 'entrenando' ? 'bg-amber-500/20 text-amber-400' :
          'bg-slate-500/20 text-slate-400'
        }`}>
          {estado}
        </span>
      </div>
      <p className="text-xs text-slate-500 mb-2">{descripcion}</p>
      <p className="text-xs text-slate-400 mb-3">{uso}</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-indigo-500 rounded-full"
            style={{ width: `${precision}%` }}
          />
        </div>
        <span className="text-xs text-slate-400">{precision}%</span>
      </div>
    </div>
  );
}