'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import {
  Package,
  History,
  TrendingUp,
  TrendingDown,
  Calendar,
  User,
  Layers,
  DollarSign,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Product } from '@/types';

// ============================================
// TYPES
// ============================================

interface Lote {
  id: string;
  codigo: string;
  cantidad_inicial: number;
  cantidad_disponible: number;
  costo_unitario: number;
  fecha_compra: string;
  usuario: string;
  notas: string;
}

interface HistorialPrecio {
  id: string;
  codigo: string;
  precio_anterior: number;
  precio_nuevo: number;
  usuario: string;
  motivo: string;
  created_at: string;
}

// ============================================
// LOTES PANEL
// ============================================

interface LotesPanelProps {
  product: Product;
}

export function LotesPanel({ product }: LotesPanelProps) {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchLotes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lotes')
        .select('*')
        .eq('codigo', product.codigo)
        .order('fecha_compra', { ascending: true });

      if (error) throw error;
      setLotes(data || []);
    } catch (error) {
      console.error('Error fetching lotes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLotes();
  }, [product.codigo]);

  const lotesDisponibles = lotes.filter(l => l.cantidad_disponible > 0);
  const valorTotal = lotesDisponibles.reduce(
    (sum, l) => sum + l.cantidad_disponible * l.costo_unitario,
    0
  );

  return (
    <div className="space-y-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Layers size={18} className="text-cyan-400" />
          <span className="font-medium">Lotes de Inventario</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">
            {lotesDisponibles.length} activos
          </span>
        </div>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded && (
        <div className="space-y-2 pl-2">
          {loading ? (
            <div className="text-center py-4 text-slate-500">
              <RefreshCw size={20} className="animate-spin mx-auto" />
            </div>
          ) : lotesDisponibles.length === 0 ? (
            <div className="text-center py-4 text-slate-500 text-sm">
              <AlertCircle size={20} className="mx-auto mb-2 opacity-50" />
              No hay lotes registrados
            </div>
          ) : (
            <>
              {lotesDisponibles.map((lote, index) => (
                <div
                  key={lote.id}
                  className={cn(
                    'p-3 rounded-xl border',
                    index === 0
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-slate-800/30 border-slate-700/30'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {index === 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                          FIFO
                        </span>
                      )}
                      <span className="text-xs text-slate-500">
                        Lote #{index + 1}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {new Date(lote.fecha_compra).toLocaleDateString('es-UY')}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-slate-500 text-xs">Disponible</div>
                      <div className="font-mono font-semibold">
                        {lote.cantidad_disponible}
                        <span className="text-slate-500 text-xs">
                          /{lote.cantidad_inicial}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs">Costo Unit.</div>
                      <div className="font-mono font-semibold text-cyan-400">
                        ${lote.costo_unitario.toLocaleString('es-UY')}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs">Valor Lote</div>
                      <div className="font-mono font-semibold">
                        ${(lote.cantidad_disponible * lote.costo_unitario).toLocaleString('es-UY')}
                      </div>
                    </div>
                  </div>

                  {lote.usuario && (
                    <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                      <User size={12} />
                      {lote.usuario}
                    </div>
                  )}
                </div>
              ))}

              {/* Resumen */}
              <div className="p-3 rounded-xl bg-gradient-to-r from-cyan-500/10 to-emerald-500/10 border border-cyan-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Valor Total en Stock (FIFO)</span>
                  <span className="font-mono font-bold text-lg text-emerald-400">
                    ${valorTotal.toLocaleString('es-UY', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-slate-500">Costo Promedio Ponderado</span>
                  <span className="font-mono text-sm text-cyan-400">
                    ${product.costoPromedio?.toLocaleString('es-UY', { minimumFractionDigits: 2 }) || '0.00'}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// HISTORIAL DE PRECIOS PANEL
// ============================================

interface HistorialPreciosPanelProps {
  product: Product;
}

export function HistorialPreciosPanel({ product }: HistorialPreciosPanelProps) {
  const [historial, setHistorial] = useState<HistorialPrecio[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchHistorial = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('historial_precios')
        .select('*')
        .eq('codigo', product.codigo)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistorial(data || []);
    } catch (error) {
      console.error('Error fetching historial:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistorial();
  }, [product.codigo]);

  return (
    <div className="space-y-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <History size={18} className="text-purple-400" />
          <span className="font-medium">Historial de Precios</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
            {historial.length} cambios
          </span>
        </div>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded && (
        <div className="space-y-2 pl-2">
          {loading ? (
            <div className="text-center py-4 text-slate-500">
              <RefreshCw size={20} className="animate-spin mx-auto" />
            </div>
          ) : historial.length === 0 ? (
            <div className="text-center py-4 text-slate-500 text-sm">
              <History size={20} className="mx-auto mb-2 opacity-50" />
              No hay cambios de precio registrados
            </div>
          ) : (
            historial.map((h) => {
              const cambio = h.precio_nuevo - h.precio_anterior;
              const porcentaje = h.precio_anterior > 0 
                ? ((cambio / h.precio_anterior) * 100).toFixed(1)
                : 0;
              const subio = cambio > 0;

              return (
                <div
                  key={h.id}
                  className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/30"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {subio ? (
                        <TrendingUp size={16} className="text-red-400" />
                      ) : (
                        <TrendingDown size={16} className="text-emerald-400" />
                      )}
                      <span className={cn(
                        'text-sm font-medium',
                        subio ? 'text-red-400' : 'text-emerald-400'
                      )}>
                        {subio ? '+' : ''}{porcentaje}%
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Calendar size={12} />
                      {new Date(h.created_at).toLocaleDateString('es-UY')}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500">De:</span>
                      <span className="font-mono line-through text-slate-400">
                        ${h.precio_anterior.toLocaleString('es-UY')}
                      </span>
                    </div>
                    <span className="text-slate-600">→</span>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500">A:</span>
                      <span className="font-mono font-semibold">
                        ${h.precio_nuevo.toLocaleString('es-UY')}
                      </span>
                    </div>
                  </div>

                  {h.usuario && (
                    <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                      <User size={12} />
                      {h.usuario}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// ANÁLISIS DE COSTOS DASHBOARD
// ============================================

interface CostAnalysisDashboardProps {
  products: Product[];
}

export function CostAnalysisDashboard({ products }: CostAnalysisDashboardProps) {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllLotes = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('lotes')
          .select('*')
          .gt('cantidad_disponible', 0)
          .order('fecha_compra', { ascending: true });

        if (error) throw error;
        setLotes(data || []);
      } catch (error) {
        console.error('Error fetching lotes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllLotes();
  }, [products]);

  // Calcular métricas
  const valorTotalFIFO = lotes.reduce(
    (sum, l) => sum + l.cantidad_disponible * l.costo_unitario,
    0
  );

  const valorTotalVenta = products.reduce(
    (sum, p) => sum + p.stock * p.precio,
    0
  );

  const valorTotalCostoPromedio = products.reduce(
    (sum, p) => sum + p.stock * (p.costoPromedio || 0),
    0
  );

  const margenBruto = valorTotalVenta - valorTotalFIFO;
  const margenPorcentaje = valorTotalVenta > 0 ? (margenBruto / valorTotalVenta) * 100 : 0;

  // Productos con mayor valor en stock
  const productosPorValor = [...products]
    .map(p => ({
        ...p,
        valorStock: p.stock * (p.costoPromedio || p.precio || 0),
        usaCosto: (p.costoPromedio || 0) > 0
    }))
    .filter(p => p.valorStock > 0)
    .sort((a, b) => b.valorStock - a.valorStock)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* KPIs de Costos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-cyan-400 mb-2">
            <Layers size={18} />
            <span className="text-xs text-slate-500">Costo Inventario (FIFO)</span>
          </div>
          <div className="text-2xl font-bold font-mono">
            ${valorTotalFIFO.toLocaleString('es-UY', { minimumFractionDigits: 0 })}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-emerald-400 mb-2">
            <DollarSign size={18} />
            <span className="text-xs text-slate-500">Valor Venta</span>
          </div>
          <div className="text-2xl font-bold font-mono">
            ${valorTotalVenta.toLocaleString('es-UY', { minimumFractionDigits: 0 })}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-purple-400 mb-2">
            <TrendingUp size={18} />
            <span className="text-xs text-slate-500">Margen Bruto</span>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            ${margenBruto.toLocaleString('es-UY', { minimumFractionDigits: 0 })}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-amber-400 mb-2">
            <TrendingUp size={18} />
            <span className="text-xs text-slate-500">% Margen</span>
          </div>
          <div className={cn(
            'text-2xl font-bold font-mono',
            margenPorcentaje >= 20 ? 'text-emerald-400' : 
            margenPorcentaje >= 10 ? 'text-amber-400' : 'text-red-400'
          )}>
            {margenPorcentaje.toFixed(1)}%
          </div>
        </Card>
      </div>

      {/* Top productos por valor */}
      <Card>
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Package size={18} className="text-cyan-400" />
          Top 5 Productos por Valor en Stock
        </h3>
        
        {loading ? (
          <div className="text-center py-4">
            <RefreshCw size={20} className="animate-spin mx-auto text-slate-500" />
          </div>
        ) : productosPorValor.length === 0 ? (
          <div className="text-center py-4 text-slate-500 text-sm">
            No hay productos con costo registrado
          </div>
        ) : (
          <div className="space-y-2">
            {productosPorValor.map((p, i) => (
              <div
                key={p.codigo}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-800/30"
              >
                <div className="flex items-center gap-3">
                  <span className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                    i === 0 ? 'bg-amber-500 text-slate-900' :
                    i === 1 ? 'bg-slate-400 text-slate-900' :
                    i === 2 ? 'bg-amber-700 text-white' :
                    'bg-slate-700 text-slate-300'
                  )}>
                    {i + 1}
                  </span>
                  <div>
                    <div className="font-medium text-sm">{p.codigo}</div>
                    <div className="text-xs text-slate-500 truncate max-w-[200px]">
                      {p.descripcion}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold text-cyan-400">
                    ${p.valorStock.toLocaleString('es-UY', { minimumFractionDigits: 0 })}
                  </div>
                  <div className="text-xs text-slate-500">
                    {p.stock} × ${(p.costoPromedio || p.precio)?.toLocaleString('es-UY') || 0}
                    {!p.costoPromedio && <span className="text-amber-400 ml-1">(precio venta)</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Lista de lotes activos */}
      <Card>
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Layers size={18} className="text-purple-400" />
          Lotes Activos ({lotes.length})
        </h3>

        {loading ? (
          <div className="text-center py-4">
            <RefreshCw size={20} className="animate-spin mx-auto text-slate-500" />
          </div>
        ) : lotes.length === 0 ? (
          <div className="text-center py-4 text-slate-500 text-sm">
            No hay lotes activos
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
            {lotes.slice(0, 20).map((lote) => (
              <div
                key={lote.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-800/30 border border-slate-700/30"
              >
                <div>
                  <div className="font-medium text-sm">{lote.codigo}</div>
                  <div className="text-xs text-slate-500">
                    {new Date(lote.fecha_compra).toLocaleDateString('es-UY')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm">
                    {lote.cantidad_disponible}/{lote.cantidad_inicial}
                  </div>
                  <div className="text-xs text-cyan-400 font-mono">
                    ${lote.costo_unitario.toLocaleString('es-UY')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}