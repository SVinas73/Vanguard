'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Product, Movement } from '@/types';
import {
  TrendingUp, TrendingDown, Minus, RefreshCw,
  Calendar, BarChart3, Activity, Filter,
  ArrowUp, ArrowDown, Package, Search
} from 'lucide-react';

// ============================================
// TIPOS
// ============================================

interface TendenciaProducto {
  producto_codigo: string;
  producto_nombre: string;
  categoria?: string;
  
  // Métricas
  movimientos_7d: number;
  movimientos_30d: number;
  movimientos_90d: number;
  
  cantidad_7d: number;
  cantidad_30d: number;
  cantidad_90d: number;
  
  // Tendencia calculada
  tendencia: 'creciendo' | 'estable' | 'decreciendo';
  variacion_7d_vs_30d: number;
  variacion_30d_vs_90d: number;
  
  // Promedio diario
  promedio_diario_7d: number;
  promedio_diario_30d: number;
  promedio_diario_90d: number;
}

interface TendenciaCategoria {
  categoria: string;
  productos_count: number;
  
  cantidad_total_30d: number;
  cantidad_total_90d: number;
  
  variacion: number;
  tendencia: 'creciendo' | 'estable' | 'decreciendo';
  
  productos_creciendo: number;
  productos_decreciendo: number;
  productos_estables: number;
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function TrendAnalysis() {
  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState<Product[]>([]);
  const [movimientos, setMovimientos] = useState<Movement[]>([]);
  const [tendencias, setTendencias] = useState<TendenciaProducto[]>([]);
  
  const [vista, setVista] = useState<'productos' | 'categorias'>('productos');
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroTendencia, setFiltroTendencia] = useState<string>('todas');
  const [ordenarPor, setOrdenarPor] = useState<'variacion' | 'cantidad' | 'nombre'>('variacion');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Cargar productos
      const { data: productosData } = await supabase
        .from('productos')
        .select('*');
      
      if (productosData) {
        setProductos(productosData.map(p => ({
          codigo: p.codigo,
          descripcion: p.descripcion,
          precio: p.precio,
          categoria: p.categoria,
          stock: p.stock,
          stockMinimo: p.stock_minimo,
        })));
      }

      // Cargar movimientos de los últimos 90 días
      const hace90d = new Date(Date.now() - 90 * 86400000).toISOString();
      const { data: movData } = await supabase
        .from('movimientos')
        .select('*')
        .gte('timestamp', hace90d)
        .order('timestamp', { ascending: false });
      
      if (movData) {
        const movs: Movement[] = movData.map(m => ({
          id: m.id,
          codigo: m.codigo,
          tipo: m.tipo,
          cantidad: m.cantidad,
          usuario: m.usuario,
          timestamp: new Date(m.timestamp),
        }));
        setMovimientos(movs);
        
        // Calcular tendencias
        const tendenciasCalc = calcularTendencias(productosData || [], movs);
        setTendencias(tendenciasCalc);
      }
    } finally {
      setLoading(false);
    }
  };

  const calcularTendencias = (productos: any[], movimientos: Movement[]): TendenciaProducto[] => {
    const ahora = Date.now();
    const hace7d = ahora - 7 * 86400000;
    const hace30d = ahora - 30 * 86400000;
    const hace90d = ahora - 90 * 86400000;
    
    const tendencias: TendenciaProducto[] = [];
    
    for (const producto of productos) {
      const movsProd = movimientos.filter(m => m.codigo === producto.codigo && m.tipo === 'salida');
      
      const movs7d = movsProd.filter(m => m.timestamp.getTime() > hace7d);
      const movs30d = movsProd.filter(m => m.timestamp.getTime() > hace30d);
      const movs90d = movsProd;
      
      const cant7d = movs7d.reduce((s, m) => s + m.cantidad, 0);
      const cant30d = movs30d.reduce((s, m) => s + m.cantidad, 0);
      const cant90d = movs90d.reduce((s, m) => s + m.cantidad, 0);
      
      const prom7d = cant7d / 7;
      const prom30d = cant30d / 30;
      const prom90d = cant90d / 90;
      
      // Calcular variaciones
      const var7d_vs_30d = prom30d > 0 ? ((prom7d - prom30d) / prom30d) * 100 : 0;
      const var30d_vs_90d = prom90d > 0 ? ((prom30d - prom90d) / prom90d) * 100 : 0;
      
      // Determinar tendencia
      let tendencia: TendenciaProducto['tendencia'] = 'estable';
      if (var7d_vs_30d > 15) {
        tendencia = 'creciendo';
      } else if (var7d_vs_30d < -15) {
        tendencia = 'decreciendo';
      }
      
      tendencias.push({
        producto_codigo: producto.codigo,
        producto_nombre: producto.descripcion,
        categoria: producto.categoria,
        movimientos_7d: movs7d.length,
        movimientos_30d: movs30d.length,
        movimientos_90d: movs90d.length,
        cantidad_7d: cant7d,
        cantidad_30d: cant30d,
        cantidad_90d: cant90d,
        tendencia,
        variacion_7d_vs_30d: var7d_vs_30d,
        variacion_30d_vs_90d: var30d_vs_90d,
        promedio_diario_7d: prom7d,
        promedio_diario_30d: prom30d,
        promedio_diario_90d: prom90d,
      });
    }
    
    return tendencias;
  };

  // Calcular tendencias por categoría
  const tendenciasCategorias = useMemo((): TendenciaCategoria[] => {
    const categorias: Record<string, TendenciaCategoria> = {};
    
    tendencias.forEach(t => {
      const cat = t.categoria || 'Sin categoría';
      if (!categorias[cat]) {
        categorias[cat] = {
          categoria: cat,
          productos_count: 0,
          cantidad_total_30d: 0,
          cantidad_total_90d: 0,
          variacion: 0,
          tendencia: 'estable',
          productos_creciendo: 0,
          productos_decreciendo: 0,
          productos_estables: 0,
        };
      }
      
      categorias[cat].productos_count++;
      categorias[cat].cantidad_total_30d += t.cantidad_30d;
      categorias[cat].cantidad_total_90d += t.cantidad_90d;
      
      if (t.tendencia === 'creciendo') categorias[cat].productos_creciendo++;
      else if (t.tendencia === 'decreciendo') categorias[cat].productos_decreciendo++;
      else categorias[cat].productos_estables++;
    });
    
    // Calcular variación y tendencia de categoría
    Object.values(categorias).forEach(cat => {
      const prom30d = cat.cantidad_total_30d / 30;
      const prom90d = cat.cantidad_total_90d / 90;
      cat.variacion = prom90d > 0 ? ((prom30d - prom90d) / prom90d) * 100 : 0;
      
      if (cat.variacion > 10) cat.tendencia = 'creciendo';
      else if (cat.variacion < -10) cat.tendencia = 'decreciendo';
    });
    
    return Object.values(categorias).sort((a, b) => b.cantidad_total_30d - a.cantidad_total_30d);
  }, [tendencias]);

  // Filtrado y ordenamiento
  const tendenciasFiltradas = useMemo(() => {
    let filtered = tendencias;
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(t => 
        t.producto_codigo.toLowerCase().includes(search) ||
        t.producto_nombre.toLowerCase().includes(search)
      );
    }
    
    if (filtroTendencia !== 'todas') {
      filtered = filtered.filter(t => t.tendencia === filtroTendencia);
    }
    
    // Ordenar
    filtered = [...filtered].sort((a, b) => {
      if (ordenarPor === 'variacion') {
        return Math.abs(b.variacion_7d_vs_30d) - Math.abs(a.variacion_7d_vs_30d);
      }
      if (ordenarPor === 'cantidad') {
        return b.cantidad_30d - a.cantidad_30d;
      }
      return a.producto_nombre.localeCompare(b.producto_nombre);
    });
    
    return filtered;
  }, [tendencias, searchTerm, filtroTendencia, ordenarPor]);

  // Stats resumen
  const statsResumen = useMemo(() => {
    return {
      total: tendencias.length,
      creciendo: tendencias.filter(t => t.tendencia === 'creciendo').length,
      estables: tendencias.filter(t => t.tendencia === 'estable').length,
      decreciendo: tendencias.filter(t => t.tendencia === 'decreciendo').length,
      mayorCrecimiento: tendencias.reduce((max, t) => 
        t.variacion_7d_vs_30d > (max?.variacion_7d_vs_30d || -Infinity) ? t : max, 
        null as TendenciaProducto | null
      ),
      mayorDecrecimiento: tendencias.reduce((min, t) => 
        t.variacion_7d_vs_30d < (min?.variacion_7d_vs_30d || Infinity) ? t : min, 
        null as TendenciaProducto | null
      ),
    };
  }, [tendencias]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-slate-200">{statsResumen.total}</div>
          <div className="text-xs text-slate-400">Productos analizados</div>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{statsResumen.creciendo}</div>
          <div className="text-xs text-emerald-400">En crecimiento</div>
        </div>
        <div className="bg-slate-500/10 border border-slate-500/30 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-slate-400">{statsResumen.estables}</div>
          <div className="text-xs text-slate-400">Estables</div>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-red-400">{statsResumen.decreciendo}</div>
          <div className="text-xs text-red-400">En declive</div>
        </div>
      </div>

      {/* Vista toggle */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setVista('productos')}
          className={`px-4 py-2 rounded-lg text-sm ${
            vista === 'productos' 
              ? 'bg-purple-500/20 text-purple-400' 
              : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          Por Producto
        </button>
        <button
          onClick={() => setVista('categorias')}
          className={`px-4 py-2 rounded-lg text-sm ${
            vista === 'categorias' 
              ? 'bg-purple-500/20 text-purple-400' 
              : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          Por Categoría
        </button>
      </div>

      {/* Vista por productos */}
      {vista === 'productos' && (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap gap-3 items-center">
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
              value={filtroTendencia}
              onChange={(e) => setFiltroTendencia(e.target.value)}
              className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
            >
              <option value="todas">Todas las tendencias</option>
              <option value="creciendo">En crecimiento</option>
              <option value="estable">Estables</option>
              <option value="decreciendo">En declive</option>
            </select>
            
            <select
              value={ordenarPor}
              onChange={(e) => setOrdenarPor(e.target.value as any)}
              className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
            >
              <option value="variacion">Mayor variación</option>
              <option value="cantidad">Mayor cantidad</option>
              <option value="nombre">Por nombre</option>
            </select>
          </div>

          {/* Lista */}
          <div className="space-y-2">
            {tendenciasFiltradas.slice(0, 50).map(t => {
              const TrendIcon = t.tendencia === 'creciendo' ? TrendingUp : 
                               t.tendencia === 'decreciendo' ? TrendingDown : Minus;
              
              return (
                <div 
                  key={t.producto_codigo}
                  className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-xl ${
                        t.tendencia === 'creciendo' ? 'bg-emerald-500/20' :
                        t.tendencia === 'decreciendo' ? 'bg-red-500/20' :
                        'bg-slate-500/20'
                      }`}>
                        <TrendIcon className={`h-5 w-5 ${
                          t.tendencia === 'creciendo' ? 'text-emerald-400' :
                          t.tendencia === 'decreciendo' ? 'text-red-400' :
                          'text-slate-400'
                        }`} />
                      </div>
                      <div>
                        <div className="font-medium text-slate-200">{t.producto_nombre}</div>
                        <div className="text-xs text-slate-500">{t.categoria}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-sm font-bold text-slate-200">{t.cantidad_7d}</div>
                        <div className="text-xs text-slate-500">7 días</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold text-slate-200">{t.cantidad_30d}</div>
                        <div className="text-xs text-slate-500">30 días</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold text-slate-200">{t.cantidad_90d}</div>
                        <div className="text-xs text-slate-500">90 días</div>
                      </div>
                      
                      <div className={`min-w-[80px] text-right font-bold ${
                        t.variacion_7d_vs_30d > 0 ? 'text-emerald-400' :
                        t.variacion_7d_vs_30d < 0 ? 'text-red-400' :
                        'text-slate-400'
                      }`}>
                        {t.variacion_7d_vs_30d > 0 ? '+' : ''}{t.variacion_7d_vs_30d.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Vista por categorías */}
      {vista === 'categorias' && (
        <div className="space-y-3">
          {tendenciasCategorias.map(cat => (
            <div 
              key={cat.categoria}
              className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${
                    cat.tendencia === 'creciendo' ? 'bg-emerald-500/20' :
                    cat.tendencia === 'decreciendo' ? 'bg-red-500/20' :
                    'bg-slate-500/20'
                  }`}>
                    {cat.tendencia === 'creciendo' ? (
                      <TrendingUp className="h-5 w-5 text-emerald-400" />
                    ) : cat.tendencia === 'decreciendo' ? (
                      <TrendingDown className="h-5 w-5 text-red-400" />
                    ) : (
                      <Minus className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-slate-200">{cat.categoria}</div>
                    <div className="text-xs text-slate-500">{cat.productos_count} productos</div>
                  </div>
                </div>
                
                <div className={`text-xl font-bold ${
                  cat.variacion > 0 ? 'text-emerald-400' :
                  cat.variacion < 0 ? 'text-red-400' :
                  'text-slate-400'
                }`}>
                  {cat.variacion > 0 ? '+' : ''}{cat.variacion.toFixed(1)}%
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <div className="font-bold text-emerald-400">{cat.productos_creciendo}</div>
                  <div className="text-xs text-emerald-400/70">Creciendo</div>
                </div>
                <div className="p-2 bg-slate-500/10 rounded-lg">
                  <div className="font-bold text-slate-400">{cat.productos_estables}</div>
                  <div className="text-xs text-slate-400/70">Estables</div>
                </div>
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <div className="font-bold text-red-400">{cat.productos_decreciendo}</div>
                  <div className="text-xs text-red-400/70">Decreciendo</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}