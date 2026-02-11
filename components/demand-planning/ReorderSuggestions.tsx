'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Product } from '@/types';
import { vanguardIA, CriticalProduct } from '@/lib/ai/vanguard-ia-client';
import {
  Package, ShoppingCart, RefreshCw, Download,
  Check, X, AlertTriangle, TrendingUp,
  Calendar, DollarSign, Truck, Clock,
  ChevronDown, ChevronUp, Filter
} from 'lucide-react';

// ============================================
// TIPOS
// ============================================

interface SugerenciaReposicion {
  producto_codigo: string;
  producto_nombre: string;
  categoria?: string;
  
  stock_actual: number;
  stock_minimo: number;
  punto_reorden: number;
  
  cantidad_sugerida: number;
  lead_time_dias: number;
  safety_stock: number;
  
  costo_unitario: number;
  costo_total: number;
  
  urgencia: 'critica' | 'alta' | 'media' | 'baja';
  dias_cobertura_actual: number;
  dias_cobertura_post_reposicion: number;
  
  seleccionada: boolean;
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function ReorderSuggestions() {
  const [loading, setLoading] = useState(true);
  const [sugerencias, setSugerencias] = useState<SugerenciaReposicion[]>([]);
  const [filtroUrgencia, setFiltroUrgencia] = useState<string>('todas');
  const [ordenarPor, setOrdenarPor] = useState<'urgencia' | 'costo' | 'nombre'>('urgencia');
  
  const [leadTimeDefault, setLeadTimeDefault] = useState(7);
  const [factorSafetyStock, setFactorSafetyStock] = useState(1.5);
  
  const [generandoOrden, setGenerandoOrden] = useState(false);

  useEffect(() => {
    loadSugerencias();
  }, []);

  const loadSugerencias = async () => {
    setLoading(true);
    try {
      // Cargar productos
      const { data: productosData } = await supabase
        .from('productos')
        .select('*');
      
      if (!productosData) return;

      // Obtener datos de predicción de la API
      let productosCriticos: CriticalProduct[] = [];
      try {
        const summary = await vanguardIA.getPredictionsSummary();
        productosCriticos = summary.productos_criticos;
      } catch {
        console.warn('API no disponible, calculando localmente');
      }

      // Generar sugerencias
      const sugerenciasGeneradas: SugerenciaReposicion[] = [];

      for (const producto of productosData) {
        const critico = productosCriticos.find(c => c.codigo === producto.codigo);
        const consumoDiario = critico?.consumo_diario || 0;
        const diasRestantes = critico?.dias_restantes || 999;
        
        // Calcular si necesita reposición
        const necesitaReposicion = 
          producto.stock <= producto.stock_minimo ||
          diasRestantes <= leadTimeDefault * 2 ||
          producto.stock === 0;
        
        if (!necesitaReposicion && !critico) continue;
        
        // Calcular cantidad óptima de reposición
        const safetyStock = Math.ceil(consumoDiario * leadTimeDefault * factorSafetyStock);
        const puntoReorden = Math.ceil(consumoDiario * leadTimeDefault + safetyStock);
        const cantidadSugerida = Math.max(
          puntoReorden - producto.stock + Math.ceil(consumoDiario * 30),
          producto.stock_minimo * 2
        );
        
        const costoUnitario = producto.costo_promedio || producto.precio || 0;
        
        // Determinar urgencia
        let urgencia: SugerenciaReposicion['urgencia'] = 'baja';
        if (producto.stock === 0 || diasRestantes <= 3) {
          urgencia = 'critica';
        } else if (diasRestantes <= 7 || producto.stock <= producto.stock_minimo) {
          urgencia = 'alta';
        } else if (diasRestantes <= 14) {
          urgencia = 'media';
        }
        
        // Calcular días de cobertura post-reposición
        const diasCoberturaPost = consumoDiario > 0 
          ? Math.round((producto.stock + cantidadSugerida) / consumoDiario)
          : 999;
        
        sugerenciasGeneradas.push({
          producto_codigo: producto.codigo,
          producto_nombre: producto.descripcion,
          categoria: producto.categoria,
          stock_actual: producto.stock,
          stock_minimo: producto.stock_minimo,
          punto_reorden: puntoReorden,
          cantidad_sugerida: Math.ceil(cantidadSugerida),
          lead_time_dias: leadTimeDefault,
          safety_stock: safetyStock,
          costo_unitario: costoUnitario,
          costo_total: Math.ceil(cantidadSugerida) * costoUnitario,
          urgencia,
          dias_cobertura_actual: diasRestantes,
          dias_cobertura_post_reposicion: diasCoberturaPost,
          seleccionada: urgencia === 'critica' || urgencia === 'alta',
        });
      }

      // Ordenar por urgencia por defecto
      sugerenciasGeneradas.sort((a, b) => {
        const prioridadMap = { critica: 4, alta: 3, media: 2, baja: 1 };
        return prioridadMap[b.urgencia] - prioridadMap[a.urgencia];
      });
      
      setSugerencias(sugerenciasGeneradas);
    } finally {
      setLoading(false);
    }
  };

  // Toggle selección
  const toggleSeleccion = (codigo: string) => {
    setSugerencias(prev => prev.map(s => 
      s.producto_codigo === codigo ? { ...s, seleccionada: !s.seleccionada } : s
    ));
  };

  const seleccionarTodas = () => {
    setSugerencias(prev => prev.map(s => ({ ...s, seleccionada: true })));
  };

  const deseleccionarTodas = () => {
    setSugerencias(prev => prev.map(s => ({ ...s, seleccionada: false })));
  };

  // Filtrado y ordenamiento
  const sugerenciasFiltradas = useMemo(() => {
    let filtered = sugerencias;
    
    if (filtroUrgencia !== 'todas') {
      filtered = filtered.filter(s => s.urgencia === filtroUrgencia);
    }
    
    // Ordenar
    filtered = [...filtered].sort((a, b) => {
      if (ordenarPor === 'urgencia') {
        const prioridadMap = { critica: 4, alta: 3, media: 2, baja: 1 };
        return prioridadMap[b.urgencia] - prioridadMap[a.urgencia];
      }
      if (ordenarPor === 'costo') {
        return b.costo_total - a.costo_total;
      }
      return a.producto_nombre.localeCompare(b.producto_nombre);
    });
    
    return filtered;
  }, [sugerencias, filtroUrgencia, ordenarPor]);

  // Totales
  const totales = useMemo(() => {
    const seleccionadas = sugerencias.filter(s => s.seleccionada);
    return {
      cantidad: seleccionadas.length,
      costoTotal: seleccionadas.reduce((sum, s) => sum + s.costo_total, 0),
      unidadesTotales: seleccionadas.reduce((sum, s) => sum + s.cantidad_sugerida, 0),
    };
  }, [sugerencias]);

  // Generar orden de compra
  const handleGenerarOrden = async () => {
    const seleccionadas = sugerencias.filter(s => s.seleccionada);
    if (seleccionadas.length === 0) {
      alert('Selecciona al menos un producto');
      return;
    }
    
    setGenerandoOrden(true);
    try {
      // Simular generación de orden
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Generar CSV para descargar
      const csvContent = [
        ['Código', 'Producto', 'Cantidad', 'Costo Unit.', 'Costo Total', 'Urgencia'].join(','),
        ...seleccionadas.map(s => [
          s.producto_codigo,
          `"${s.producto_nombre}"`,
          s.cantidad_sugerida,
          s.costo_unitario.toFixed(2),
          s.costo_total.toFixed(2),
          s.urgencia
        ].join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `orden_reposicion_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      
      alert(`✅ Orden generada con ${seleccionadas.length} productos\nCosto total: $${totales.costoTotal.toLocaleString()}`);
    } finally {
      setGenerandoOrden(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">Productos a reponer</div>
          <div className="text-2xl font-bold text-slate-200">{sugerencias.length}</div>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="text-xs text-amber-400 mb-1">Seleccionados</div>
          <div className="text-2xl font-bold text-amber-400">{totales.cantidad}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">Unidades totales</div>
          <div className="text-2xl font-bold text-slate-200">{totales.unidadesTotales.toLocaleString()}</div>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
          <div className="text-xs text-emerald-400 mb-1">Costo total</div>
          <div className="text-2xl font-bold text-emerald-400">${totales.costoTotal.toLocaleString()}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-3 items-center">
          <select
            value={filtroUrgencia}
            onChange={(e) => setFiltroUrgencia(e.target.value)}
            className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
          >
            <option value="todas">Todas las urgencias</option>
            <option value="critica">Crítica</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
          
          <select
            value={ordenarPor}
            onChange={(e) => setOrdenarPor(e.target.value as any)}
            className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
          >
            <option value="urgencia">Ordenar por urgencia</option>
            <option value="costo">Ordenar por costo</option>
            <option value="nombre">Ordenar por nombre</option>
          </select>
          
          <div className="flex gap-1">
            <button
              onClick={seleccionarTodas}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
            >
              Seleccionar todas
            </button>
            <button
              onClick={deseleccionarTodas}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
            >
              Ninguna
            </button>
          </div>
        </div>
        
        <button
          onClick={handleGenerarOrden}
          disabled={generandoOrden || totales.cantidad === 0}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 text-white rounded-xl font-medium"
        >
          {generandoOrden ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <ShoppingCart className="h-4 w-4" />
          )}
          Generar Orden ({totales.cantidad})
        </button>
      </div>

      {/* Parámetros */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-500" />
            <span className="text-sm text-slate-400">Lead Time:</span>
            <input
              type="number"
              min={1}
              max={30}
              value={leadTimeDefault}
              onChange={(e) => setLeadTimeDefault(parseInt(e.target.value) || 7)}
              className="w-16 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-slate-100"
            />
            <span className="text-sm text-slate-500">días</span>
          </div>
          
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-slate-500" />
            <span className="text-sm text-slate-400">Safety Stock Factor:</span>
            <input
              type="number"
              min={1}
              max={3}
              step={0.1}
              value={factorSafetyStock}
              onChange={(e) => setFactorSafetyStock(parseFloat(e.target.value) || 1.5)}
              className="w-16 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-slate-100"
            />
            <span className="text-sm text-slate-500">x</span>
          </div>
          
          <button
            onClick={loadSugerencias}
            className="ml-auto px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm flex items-center gap-2"
          >
            <RefreshCw className="h-3 w-3" />
            Recalcular
          </button>
        </div>
      </div>

      {/* Lista de sugerencias */}
      <div className="space-y-2">
        {sugerenciasFiltradas.map(sug => (
          <div
            key={sug.producto_codigo}
            className={`bg-slate-900/50 border rounded-xl p-4 transition-all cursor-pointer ${
              sug.seleccionada 
                ? 'border-amber-500/50 bg-amber-500/5' 
                : sug.urgencia === 'critica' ? 'border-red-500/30'
                : 'border-slate-800/50 hover:border-slate-700'
            }`}
            onClick={() => toggleSeleccion(sug.producto_codigo)}
          >
            <div className="flex items-center gap-4">
              {/* Checkbox */}
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                sug.seleccionada 
                  ? 'bg-amber-500 border-amber-500' 
                  : 'border-slate-600'
              }`}>
                {sug.seleccionada && <Check className="h-3 w-3 text-white" />}
              </div>
              
              {/* Info producto */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-slate-200 truncate">{sug.producto_nombre}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    sug.urgencia === 'critica' ? 'bg-red-500/20 text-red-400' :
                    sug.urgencia === 'alta' ? 'bg-amber-500/20 text-amber-400' :
                    sug.urgencia === 'media' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-slate-500/20 text-slate-400'
                  }`}>
                    {sug.urgencia}
                  </span>
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-3">
                  <span className="font-mono">{sug.producto_codigo}</span>
                  <span>Stock: {sug.stock_actual} / Mín: {sug.stock_minimo}</span>
                  <span>Cobertura: {sug.dias_cobertura_actual < 999 ? `${sug.dias_cobertura_actual}d` : '∞'}</span>
                </div>
              </div>
              
              {/* Cantidad sugerida */}
              <div className="text-center min-w-[100px]">
                <div className="text-xs text-slate-500">Cantidad</div>
                <div className="text-xl font-bold text-amber-400">{sug.cantidad_sugerida}</div>
              </div>
              
              {/* Costo */}
              <div className="text-right min-w-[100px]">
                <div className="text-xs text-slate-500">Costo</div>
                <div className="text-lg font-bold text-slate-200">${sug.costo_total.toLocaleString()}</div>
                <div className="text-xs text-slate-500">${sug.costo_unitario.toFixed(2)}/u</div>
              </div>
              
              {/* Cobertura post */}
              <div className="text-center min-w-[80px]">
                <div className="text-xs text-slate-500">Post-repo</div>
                <div className="text-lg font-bold text-emerald-400">
                  {sug.dias_cobertura_post_reposicion < 999 ? `${sug.dias_cobertura_post_reposicion}d` : '∞'}
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {sugerenciasFiltradas.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No hay sugerencias de reposición</p>
          </div>
        )}
      </div>
    </div>
  );
}