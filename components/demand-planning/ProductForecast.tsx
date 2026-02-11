'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Product, Movement } from '@/types';
import { vanguardIA, StockDepletionResponse, DemandForecastItem } from '@/lib/ai/vanguard-ia-client';
import { predictDaysUntilStockout } from '@/lib/ai/predictor';
import {
  TrendingUp, TrendingDown, Search, RefreshCw, Eye,
  Package, AlertTriangle, Clock, Calendar, Activity,
  ChevronRight, X, BarChart3, Target, Zap,
  ArrowUp, ArrowDown, Minus
} from 'lucide-react';

// ============================================
// TIPOS
// ============================================

interface ForecastProductoExtendido {
  producto: Product;
  forecast: StockDepletionResponse | null;
  demandaSemanal?: number;
  tendencia: 'subiendo' | 'bajando' | 'estable';
  loading: boolean;
  error?: string;
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function ProductForecast() {
  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState<Product[]>([]);
  const [movimientos, setMovimientos] = useState<Movement[]>([]);
  const [forecastsMap, setForecastsMap] = useState<Record<string, ForecastProductoExtendido>>({});
  
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas');
  const [ordenarPor, setOrdenarPor] = useState<'dias' | 'demanda' | 'nombre'>('dias');
  
  const [productoSeleccionado, setProductoSeleccionado] = useState<string | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  // ============================================
  // CARGA INICIAL
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
        const prods: Product[] = productosData.map(p => ({
          codigo: p.codigo,
          descripcion: p.descripcion,
          precio: p.precio,
          categoria: p.categoria,
          stock: p.stock,
          stockMinimo: p.stock_minimo,
          costoPromedio: p.costo_promedio,
        }));
        setProductos(prods);
        
        // Inicializar mapa de forecasts
        const initialMap: Record<string, ForecastProductoExtendido> = {};
        prods.forEach(p => {
          initialMap[p.codigo] = {
            producto: p,
            forecast: null,
            tendencia: 'estable',
            loading: false,
          };
        });
        setForecastsMap(initialMap);
      }

      // Cargar movimientos para fallback local
      const { data: movData } = await supabase
        .from('movimientos')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(500);
      
      if (movData) {
        setMovimientos(movData.map(m => ({
          id: m.id,
          codigo: m.codigo,
          tipo: m.tipo,
          cantidad: m.cantidad,
          usuario: m.usuario,
          timestamp: new Date(m.timestamp),
          notas: m.notas,
        })));
      }

      // Obtener forecast general de la API
      try {
        const demandForecast = await vanguardIA.getDemandForecast(90, 7);
        
        // Actualizar mapa con datos de demanda
        setForecastsMap(prev => {
          const updated = { ...prev };
          demandForecast.predicciones.forEach(pred => {
            if (updated[pred.codigo]) {
              updated[pred.codigo] = {
                ...updated[pred.codigo],
                demandaSemanal: pred.demanda_predicha_semana,
              };
            }
          });
          return updated;
        });
      } catch (apiError) {
        console.warn('No se pudo obtener forecast de API:', apiError);
      }

    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // CARGAR DETALLE DE PRODUCTO
  // ============================================

  const loadProductoDetalle = async (codigo: string) => {
    setLoadingDetalle(true);
    setProductoSeleccionado(codigo);
    
    try {
      // Intentar API primero
      try {
        const forecast = await vanguardIA.getStockDepletion(codigo, 30);
        
        setForecastsMap(prev => ({
          ...prev,
          [codigo]: {
            ...prev[codigo],
            forecast,
            loading: false,
          }
        }));
      } catch (apiError) {
        // Fallback a cálculo local
        const producto = productos.find(p => p.codigo === codigo);
        if (producto) {
          const localPred = predictDaysUntilStockout(producto, movimientos);
          
          setForecastsMap(prev => ({
            ...prev,
            [codigo]: {
              ...prev[codigo],
              forecast: {
                codigo,
                stock_actual: producto.stock,
                dias_hasta_agotamiento: localPred.days === Infinity ? null : localPred.days,
                fecha_estimada_agotamiento: localPred.days && localPred.days !== Infinity
                  ? new Date(Date.now() + localPred.days * 86400000).toISOString()
                  : null,
                consumo_diario_predicho: localPred.dailyRate ? parseFloat(localPred.dailyRate) : undefined,
                modelo: 'local_fallback',
                confianza: localPred.confidence,
              },
              tendencia: localPred.trend === 'acelerando' ? 'subiendo' : 
                        localPred.trend === 'desacelerando' ? 'bajando' : 'estable',
              loading: false,
            }
          }));
        }
      }
    } finally {
      setLoadingDetalle(false);
    }
  };

  // ============================================
  // FILTRADO Y ORDENAMIENTO
  // ============================================

  const categorias = useMemo(() => {
    const cats = new Set(productos.map(p => p.categoria).filter(Boolean));
    return Array.from(cats).sort();
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    let filtered = productos.filter(p => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!p.codigo.toLowerCase().includes(search) &&
            !p.descripcion.toLowerCase().includes(search)) return false;
      }
      if (categoriaFiltro !== 'todas' && p.categoria !== categoriaFiltro) return false;
      return true;
    });

    // Ordenar
    filtered.sort((a, b) => {
      const forecastA = forecastsMap[a.codigo];
      const forecastB = forecastsMap[b.codigo];
      
      if (ordenarPor === 'dias') {
        const diasA = forecastA?.forecast?.dias_hasta_agotamiento ?? Infinity;
        const diasB = forecastB?.forecast?.dias_hasta_agotamiento ?? Infinity;
        return diasA - diasB;
      }
      if (ordenarPor === 'demanda') {
        const demA = forecastA?.demandaSemanal ?? 0;
        const demB = forecastB?.demandaSemanal ?? 0;
        return demB - demA;
      }
      return a.descripcion.localeCompare(b.descripcion);
    });

    return filtered;
  }, [productos, searchTerm, categoriaFiltro, ordenarPor, forecastsMap]);

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

  const detalleProducto = productoSeleccionado ? forecastsMap[productoSeleccionado] : null;

  return (
    <div className="space-y-6">
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
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
          >
            <option value="todas">Todas las categorías</option>
            {categorias.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          
          <select
            value={ordenarPor}
            onChange={(e) => setOrdenarPor(e.target.value as any)}
            className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
          >
            <option value="dias">Ordenar por días restantes</option>
            <option value="demanda">Ordenar por demanda</option>
            <option value="nombre">Ordenar por nombre</option>
          </select>
        </div>
        
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium"
        >
          <RefreshCw className="h-4 w-4" />
          Actualizar Forecasts
        </button>
      </div>

      {/* Grid de productos + Panel detalle */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de productos */}
        <div className="lg:col-span-2 space-y-2">
          {productosFiltrados.map(producto => {
            const forecastData = forecastsMap[producto.codigo];
            const dias = forecastData?.forecast?.dias_hasta_agotamiento ?? null;
            const urgencia = (dias === null || dias === undefined) ? 'ok' : dias <= 3 ? 'critica' : dias <= 7 ? 'alta' : dias <= 14 ? 'media' : 'ok';
            const isSelected = productoSeleccionado === producto.codigo;
            
            return (
              <button
                key={producto.codigo}
                onClick={() => loadProductoDetalle(producto.codigo)}
                className={`w-full text-left bg-slate-900/50 border rounded-xl p-4 transition-all ${
                  isSelected 
                    ? 'border-emerald-500/50 bg-emerald-500/5' 
                    : urgencia === 'critica' ? 'border-red-500/30' 
                    : urgencia === 'alta' ? 'border-amber-500/30'
                    : 'border-slate-800/50 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`w-2 h-10 rounded-full ${
                      urgencia === 'critica' ? 'bg-red-500' :
                      urgencia === 'alta' ? 'bg-amber-500' :
                      urgencia === 'media' ? 'bg-yellow-500' : 'bg-emerald-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-200 truncate">{producto.descripcion}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span className="font-mono">{producto.codigo}</span>
                        <span>•</span>
                        <span>{producto.categoria}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm text-slate-400">Stock</div>
                      <div className={`font-bold ${
                        producto.stock <= producto.stockMinimo ? 'text-red-400' : 'text-slate-200'
                      }`}>
                        {producto.stock}
                      </div>
                    </div>
                    
                    <div className="text-right min-w-[80px]">
                      <div className="text-sm text-slate-400">Días</div>
                      <div className={`font-bold ${
                        urgencia === 'critica' ? 'text-red-400' :
                        urgencia === 'alta' ? 'text-amber-400' :
                        urgencia === 'media' ? 'text-yellow-400' : 'text-emerald-400'
                      }`}>
                        {dias !== null && dias !== undefined ? dias.toFixed(0) : '∞'}
                      </div>
                    </div>
                    
                    {forecastData?.demandaSemanal !== undefined && (
                      <div className="text-right min-w-[80px]">
                        <div className="text-sm text-slate-400">Dem/sem</div>
                        <div className="font-bold text-indigo-400">
                          {forecastData.demandaSemanal.toFixed(0)}
                        </div>
                      </div>
                    )}
                    
                    <ChevronRight className={`h-5 w-5 text-slate-500 transition-transform ${
                      isSelected ? 'rotate-90' : ''
                    }`} />
                  </div>
                </div>
              </button>
            );
          })}
          
          {productosFiltrados.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No hay productos que coincidan</p>
            </div>
          )}
        </div>

        {/* Panel de detalle */}
        <div className="lg:col-span-1">
          {productoSeleccionado && detalleProducto ? (
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6 sticky top-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-200">Detalle Forecast</h3>
                <button
                  onClick={() => setProductoSeleccionado(null)}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              {loadingDetalle ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-emerald-400" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-slate-400 mb-1">Producto</div>
                    <div className="font-medium text-slate-200">{detalleProducto.producto.descripcion}</div>
                    <div className="text-xs text-slate-500 font-mono">{detalleProducto.producto.codigo}</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <div className="text-xs text-slate-500">Stock Actual</div>
                      <div className="text-xl font-bold text-slate-200">{detalleProducto.producto.stock}</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <div className="text-xs text-slate-500">Stock Mínimo</div>
                      <div className="text-xl font-bold text-slate-200">{detalleProducto.producto.stockMinimo}</div>
                    </div>
                  </div>
                  
                  {detalleProducto.forecast && (
                    <>
                      <div className="bg-gradient-to-r from-emerald-500/10 to-indigo-500/10 border border-emerald-500/30 rounded-xl p-4">
                        <div className="text-xs text-emerald-400 mb-1">Días hasta agotamiento</div>
                        <div className="text-3xl font-bold text-emerald-400">
                          {detalleProducto.forecast.dias_hasta_agotamiento?.toFixed(0) ?? '∞'}
                          <span className="text-sm font-normal text-emerald-400/70 ml-2">días</span>
                        </div>
                        {detalleProducto.forecast.fecha_estimada_agotamiento && (
                          <div className="text-xs text-slate-400 mt-1">
                            Fecha: {new Date(detalleProducto.forecast.fecha_estimada_agotamiento).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-800/50 rounded-lg p-3">
                          <div className="text-xs text-slate-500">Consumo/día</div>
                          <div className="text-lg font-bold text-indigo-400">
                            {detalleProducto.forecast.consumo_diario_predicho?.toFixed(1) ?? '-'}
                          </div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-3">
                          <div className="text-xs text-slate-500">Confianza</div>
                          <div className="text-lg font-bold text-slate-200">
                            {(detalleProducto.forecast.confianza * 100).toFixed(0)}%
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Zap className="h-3 w-3" />
                        <span>Modelo: {detalleProducto.forecast.modelo}</span>
                      </div>
                      
                      {/* Gráfico de predicción próximos días */}
                      {detalleProducto.forecast.prediccion_proximos_dias && (
                        <div>
                          <div className="text-xs text-slate-500 mb-2">Predicción próximos 7 días</div>
                          <div className="flex items-end gap-1 h-16">
                            {detalleProducto.forecast.prediccion_proximos_dias.map((val, idx) => {
                              const max = Math.max(...detalleProducto.forecast!.prediccion_proximos_dias!);
                              const pct = max > 0 ? (val / max) * 100 : 0;
                              return (
                                <div
                                  key={idx}
                                  className="flex-1 bg-indigo-500/30 rounded-t"
                                  style={{ height: `${Math.max(pct, 5)}%` }}
                                  title={`Día ${idx + 1}: ${val.toFixed(1)}`}
                                />
                              );
                            })}
                          </div>
                          <div className="flex justify-between text-xs text-slate-500 mt-1">
                            <span>Hoy</span>
                            <span>+7d</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6 text-center">
              <Eye className="h-10 w-10 mx-auto mb-3 text-slate-600" />
              <p className="text-slate-500">Selecciona un producto para ver el forecast detallado</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}