'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Product, Almacen } from '@/types';
import {
  Package, Search, RefreshCw, Eye, Filter,
  ChevronRight, ChevronDown, X, Check,
  Box, MapPin, AlertTriangle, Clock,
  CheckCircle, BarChart3, Layers, Calendar,
  ClipboardList, ArrowUpDown, Download, History,
  Edit, Save, XCircle, Plus, Minus
} from 'lucide-react';

// ============================================
// TIPOS
// ============================================

interface StockUbicacion {
  id: string;
  producto_codigo: string;
  producto?: Product;
  ubicacion_codigo: string;
  almacen_id: string;
  cantidad: number;
  cantidad_reservada: number;
  cantidad_disponible: number;
  lote_numero?: string;
  fecha_vencimiento?: string;
  ultimo_movimiento?: string;
  ultimo_conteo?: string;
}

interface ConteoInventario {
  id: string;
  numero: string;
  tipo: 'ciclico' | 'completo' | 'aleatorio';
  estado: 'planificado' | 'en_proceso' | 'completado' | 'cancelado';
  almacen_id: string;
  ubicaciones_total: number;
  ubicaciones_contadas: number;
  diferencias_encontradas: number;
  fecha_planificada?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  ejecutado_por?: string;
  created_at: string;
}

interface LineaConteo {
  id: string;
  conteo_id: string;
  producto_codigo: string;
  producto_nombre?: string;
  ubicacion_codigo: string;
  cantidad_sistema: number;
  cantidad_contada?: number;
  diferencia?: number;
  estado: 'pendiente' | 'contado' | 'verificado' | 'ajustado';
  notas?: string;
  contado_por?: string;
  fecha_conteo?: string;
}

type VistaActiva = 'stock' | 'conteos' | 'nuevo_conteo' | 'ejecutar_conteo' | 'historial';
type VistaStock = 'por_producto' | 'por_ubicacion' | 'alertas';

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function Inventario() {
  const [loading, setLoading] = useState(true);
  const [vistaActiva, setVistaActiva] = useState<VistaActiva>('stock');
  const [vistaStock, setVistaStock] = useState<VistaStock>('por_producto');
  
  // Datos
  const [productos, setProductos] = useState<Product[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [stockUbicaciones, setStockUbicaciones] = useState<StockUbicacion[]>([]);
  const [conteos, setConteos] = useState<ConteoInventario[]>([]);
  const [conteoActivo, setConteoActivo] = useState<ConteoInventario | null>(null);
  const [lineasConteo, setLineasConteo] = useState<LineaConteo[]>([]);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [almacenFiltro, setAlmacenFiltro] = useState<string>('todos');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todas');
  const [mostrarSoloBajoStock, setMostrarSoloBajoStock] = useState(false);
  
  // Conteo
  const [lineaConteoActual, setLineaConteoActual] = useState(0);
  const [cantidadContada, setCantidadContada] = useState<string>('');
  
  const [saving, setSaving] = useState(false);

  // ============================================
  // CARGA DE DATOS
  // ============================================

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Cargar productos reales
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
          imagenUrl: p.imagen_url,
          almacenId: p.almacen_id,
        })));
      }

      // Cargar almacenes reales
      const { data: almacenesData } = await supabase
        .from('almacenes')
        .select('*')
        .eq('activo', true)
        .order('es_principal', { ascending: false });
      
      if (almacenesData) {
        setAlmacenes(almacenesData.map(a => ({
          id: a.id,
          codigo: a.codigo,
          nombre: a.nombre,
          direccion: a.direccion,
          ciudad: a.ciudad,
          telefono: a.telefono,
          responsable: a.responsable,
          esPrincipal: a.es_principal,
          activo: a.activo,
        })));
      }

      // Cargar stock por ubicación (si existe la tabla)
      const { data: stockData } = await supabase
        .from('wms_stock_ubicacion')
        .select('*')
        .order('ubicacion_codigo');
      
      if (stockData) {
        setStockUbicaciones(stockData);
      } else {
        // Generar datos de ejemplo basados en productos reales
        if (productosData && productosData.length > 0) {
          const stockEjemplo: StockUbicacion[] = [];
          const ubicaciones = ['A-01-01-01', 'A-01-02-01', 'A-02-01-01', 'B-01-01-01', 'B-02-01-01'];
          
          productosData.slice(0, 10).forEach((p, idx) => {
            stockEjemplo.push({
              id: `stock-${idx}`,
              producto_codigo: p.codigo,
              ubicacion_codigo: ubicaciones[idx % ubicaciones.length],
              almacen_id: almacenesData?.[0]?.id || '1',
              cantidad: p.stock || Math.floor(Math.random() * 100) + 10,
              cantidad_reservada: Math.floor(Math.random() * 10),
              cantidad_disponible: p.stock || Math.floor(Math.random() * 90) + 5,
              ultimo_movimiento: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
            });
          });
          setStockUbicaciones(stockEjemplo);
        }
      }

      // Cargar conteos
      const { data: conteosData } = await supabase
        .from('wms_conteos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (conteosData) {
        setConteos(conteosData);
      } else {
        setConteos([
          {
            id: 'c1',
            numero: 'CNT-2024-001',
            tipo: 'ciclico',
            estado: 'completado',
            almacen_id: almacenesData?.[0]?.id || '1',
            ubicaciones_total: 25,
            ubicaciones_contadas: 25,
            diferencias_encontradas: 2,
            fecha_inicio: new Date(Date.now() - 172800000).toISOString(),
            fecha_fin: new Date(Date.now() - 86400000).toISOString(),
            ejecutado_por: 'operador@example.com',
            created_at: new Date(Date.now() - 172800000).toISOString(),
          }
        ]);
      }
      
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // DATOS COMPUTADOS
  // ============================================

  // Combinar stock con datos de producto
  const stockConProducto = useMemo(() => {
    return stockUbicaciones.map(s => ({
      ...s,
      producto: productos.find(p => p.codigo === s.producto_codigo),
    }));
  }, [stockUbicaciones, productos]);

  // Filtrar stock
  const stockFiltrado = useMemo(() => {
    return stockConProducto.filter(s => {
      // Búsqueda
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchProducto = s.producto?.descripcion?.toLowerCase().includes(search) ||
                             s.producto_codigo.toLowerCase().includes(search);
        const matchUbicacion = s.ubicacion_codigo.toLowerCase().includes(search);
        if (!matchProducto && !matchUbicacion) return false;
      }
      
      // Almacén
      if (almacenFiltro !== 'todos' && s.almacen_id !== almacenFiltro) return false;
      
      // Categoría
      if (categoriaFiltro !== 'todas' && s.producto?.categoria !== categoriaFiltro) return false;
      
      // Bajo stock
      if (mostrarSoloBajoStock) {
        const stockMin = s.producto?.stockMinimo || 0;
        if (s.cantidad >= stockMin) return false;
      }
      
      return true;
    });
  }, [stockConProducto, searchTerm, almacenFiltro, categoriaFiltro, mostrarSoloBajoStock]);

  // Agrupar por producto
  const stockPorProducto = useMemo(() => {
    const grupos: Record<string, { producto: Product; ubicaciones: StockUbicacion[]; totalStock: number }> = {};
    
    stockFiltrado.forEach(s => {
      if (!grupos[s.producto_codigo]) {
        grupos[s.producto_codigo] = {
          producto: s.producto || { codigo: s.producto_codigo, descripcion: s.producto_codigo, precio: 0, categoria: '', stock: 0, stockMinimo: 0 },
          ubicaciones: [],
          totalStock: 0,
        };
      }
      grupos[s.producto_codigo].ubicaciones.push(s);
      grupos[s.producto_codigo].totalStock += s.cantidad;
    });
    
    return Object.values(grupos).sort((a, b) => a.producto.descripcion.localeCompare(b.producto.descripcion));
  }, [stockFiltrado]);

  // Agrupar por ubicación
  const stockPorUbicacion = useMemo(() => {
    const grupos: Record<string, StockUbicacion[]> = {};
    
    stockFiltrado.forEach(s => {
      const pasillo = s.ubicacion_codigo.split('-')[0];
      if (!grupos[pasillo]) grupos[pasillo] = [];
      grupos[pasillo].push(s);
    });
    
    return Object.entries(grupos)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([pasillo, items]) => ({ pasillo, items: items.sort((a, b) => a.ubicacion_codigo.localeCompare(b.ubicacion_codigo)) }));
  }, [stockFiltrado]);

  // Alertas (bajo stock, sin movimiento, próximos a vencer)
  const alertas = useMemo(() => {
    const items: { tipo: 'bajo_stock' | 'sin_movimiento' | 'proximo_vencer'; stock: StockUbicacion & { producto?: Product }; mensaje: string }[] = [];
    
    stockConProducto.forEach(s => {
      // Bajo stock
      if (s.producto && s.cantidad <= (s.producto.stockMinimo || 0)) {
        items.push({
          tipo: 'bajo_stock',
          stock: s,
          mensaje: `Stock bajo mínimo (${s.cantidad} de ${s.producto.stockMinimo})`,
        });
      }
      
      // Sin movimiento > 30 días
      if (s.ultimo_movimiento) {
        const dias = Math.floor((Date.now() - new Date(s.ultimo_movimiento).getTime()) / 86400000);
        if (dias > 30) {
          items.push({
            tipo: 'sin_movimiento',
            stock: s,
            mensaje: `Sin movimiento hace ${dias} días`,
          });
        }
      }
      
      // Próximo a vencer
      if (s.fecha_vencimiento) {
        const dias = Math.floor((new Date(s.fecha_vencimiento).getTime() - Date.now()) / 86400000);
        if (dias <= 30 && dias > 0) {
          items.push({
            tipo: 'proximo_vencer',
            stock: s,
            mensaje: `Vence en ${dias} días`,
          });
        }
      }
    });
    
    return items;
  }, [stockConProducto]);

  // Categorías únicas
  const categorias = useMemo(() => {
    const cats = new Set(productos.map(p => p.categoria).filter(Boolean));
    return Array.from(cats).sort();
  }, [productos]);

  // Stats
  const stats = useMemo(() => {
    const totalProductos = new Set(stockUbicaciones.map(s => s.producto_codigo)).size;
    const totalUbicaciones = new Set(stockUbicaciones.map(s => s.ubicacion_codigo)).size;
    const totalUnidades = stockUbicaciones.reduce((sum, s) => sum + s.cantidad, 0);
    const bajoStock = alertas.filter(a => a.tipo === 'bajo_stock').length;
    
    return { totalProductos, totalUbicaciones, totalUnidades, bajoStock };
  }, [stockUbicaciones, alertas]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleIniciarConteo = async (tipo: 'ciclico' | 'completo' | 'aleatorio') => {
    setSaving(true);
    try {
      // Seleccionar productos para conteo
      let productosParaConteo = stockFiltrado;
      
      if (tipo === 'ciclico') {
        // Solo productos de alta rotación (ABC-A)
        productosParaConteo = productosParaConteo.slice(0, Math.ceil(productosParaConteo.length * 0.2));
      } else if (tipo === 'aleatorio') {
        // 10% aleatorio
        productosParaConteo = productosParaConteo
          .sort(() => Math.random() - 0.5)
          .slice(0, Math.ceil(productosParaConteo.length * 0.1));
      }
      
      const nuevoConteo: ConteoInventario = {
        id: `cnt-${Date.now()}`,
        numero: `CNT-${new Date().getFullYear()}-${String(conteos.length + 1).padStart(3, '0')}`,
        tipo,
        estado: 'en_proceso',
        almacen_id: almacenFiltro !== 'todos' ? almacenFiltro : (almacenes[0]?.id || '1'),
        ubicaciones_total: productosParaConteo.length,
        ubicaciones_contadas: 0,
        diferencias_encontradas: 0,
        fecha_inicio: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      
      const lineas: LineaConteo[] = productosParaConteo.map((s, idx) => ({
        id: `linea-${idx}`,
        conteo_id: nuevoConteo.id,
        producto_codigo: s.producto_codigo,
        producto_nombre: s.producto?.descripcion,
        ubicacion_codigo: s.ubicacion_codigo,
        cantidad_sistema: s.cantidad,
        estado: 'pendiente',
      }));
      
      setConteos(prev => [nuevoConteo, ...prev]);
      setConteoActivo(nuevoConteo);
      setLineasConteo(lineas);
      setLineaConteoActual(0);
      setCantidadContada('');
      setVistaActiva('ejecutar_conteo');
      
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmarLineaConteo = () => {
    if (!conteoActivo) return;
    
    const cantidad = parseInt(cantidadContada) || 0;
    const lineaActual = lineasConteo[lineaConteoActual];
    const diferencia = cantidad - lineaActual.cantidad_sistema;
    
    // Actualizar línea
    const lineasActualizadas = lineasConteo.map((l, idx) => 
      idx === lineaConteoActual 
        ? { 
            ...l, 
            cantidad_contada: cantidad,
            diferencia,
            estado: 'contado' as const,
            fecha_conteo: new Date().toISOString(),
          }
        : l
    );
    setLineasConteo(lineasActualizadas);
    
    // Actualizar conteo
    const contadas = lineasActualizadas.filter(l => l.estado !== 'pendiente').length;
    const diferencias = lineasActualizadas.filter(l => l.diferencia && l.diferencia !== 0).length;
    
    const conteoActualizado: ConteoInventario = {
      ...conteoActivo,
      ubicaciones_contadas: contadas,
      diferencias_encontradas: diferencias,
    };
    
    // ¿Es la última línea?
    if (lineaConteoActual >= lineasConteo.length - 1) {
      conteoActualizado.estado = 'completado';
      conteoActualizado.fecha_fin = new Date().toISOString();
      
      setConteoActivo(conteoActualizado);
      setConteos(prev => prev.map(c => c.id === conteoActualizado.id ? conteoActualizado : c));
      
      alert(`✅ Conteo completado. ${diferencias} diferencia(s) encontrada(s).`);
      setVistaActiva('conteos');
    } else {
      setConteoActivo(conteoActualizado);
      setConteos(prev => prev.map(c => c.id === conteoActualizado.id ? conteoActualizado : c));
      setLineaConteoActual(lineaConteoActual + 1);
      setCantidadContada('');
    }
  };

  const handleAplicarAjustes = async () => {
    if (!conteoActivo) return;
    
    const lineasConDiferencia = lineasConteo.filter(l => l.diferencia && l.diferencia !== 0);
    
    if (lineasConDiferencia.length === 0) {
      alert('No hay diferencias para ajustar');
      return;
    }
    
    if (!confirm(`¿Aplicar ${lineasConDiferencia.length} ajuste(s) de inventario?`)) return;
    
    setSaving(true);
    try {
      // Actualizar stock en las ubicaciones
      for (const linea of lineasConDiferencia) {
        const stockItem = stockUbicaciones.find(
          s => s.producto_codigo === linea.producto_codigo && s.ubicacion_codigo === linea.ubicacion_codigo
        );
        
        if (stockItem && linea.cantidad_contada !== undefined) {
          // Actualizar stock local
          setStockUbicaciones(prev => prev.map(s => 
            s.id === stockItem.id 
              ? { ...s, cantidad: linea.cantidad_contada!, cantidad_disponible: linea.cantidad_contada! - s.cantidad_reservada }
              : s
          ));
          
          // También actualizar stock del producto en tabla productos
          await supabase
            .from('productos')
            .update({ stock: linea.cantidad_contada })
            .eq('codigo', linea.producto_codigo);
        }
      }
      
      // Marcar líneas como ajustadas
      setLineasConteo(prev => prev.map(l => 
        l.diferencia && l.diferencia !== 0 ? { ...l, estado: 'ajustado' as const } : l
      ));
      
      alert('✅ Ajustes aplicados correctamente');
      await loadData(); // Recargar datos
      
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
        <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs principales */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        {[
          { id: 'stock' as const, label: 'Stock', icon: Package, count: stats.totalProductos },
          { id: 'conteos' as const, label: 'Conteos', icon: ClipboardList, count: conteos.filter(c => c.estado === 'en_proceso').length },
          { id: 'historial' as const, label: 'Historial', icon: History },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setVistaActiva(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                vistaActiva === tab.id
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ==================== STOCK ==================== */}
      {vistaActiva === 'stock' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-slate-200">{stats.totalProductos}</div>
              <div className="text-xs text-slate-400">Productos</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-slate-200">{stats.totalUbicaciones}</div>
              <div className="text-xs text-slate-400">Ubicaciones</div>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">{stats.totalUnidades.toLocaleString()}</div>
              <div className="text-xs text-blue-400">Unidades</div>
            </div>
            {stats.bajoStock > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-red-400">{stats.bajoStock}</div>
                <div className="text-xs text-red-400">Bajo Stock</div>
              </div>
            )}
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-3 items-center flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar producto o ubicación..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
                />
              </div>
              
              <select
                value={almacenFiltro}
                onChange={(e) => setAlmacenFiltro(e.target.value)}
                className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
              >
                <option value="todos">Todos los almacenes</option>
                {almacenes.map(a => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
              
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
              
              <button onClick={loadData} className="p-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-400">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            
            <div className="flex gap-2">
              <label className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={mostrarSoloBajoStock}
                  onChange={(e) => setMostrarSoloBajoStock(e.target.checked)}
                  className="rounded border-slate-600"
                />
                <span className="text-sm text-slate-300">Solo bajo stock</span>
              </label>
            </div>
          </div>

          {/* Vista switches */}
          <div className="flex gap-2">
            {[
              { id: 'por_producto' as const, label: 'Por Producto', icon: Package },
              { id: 'por_ubicacion' as const, label: 'Por Ubicación', icon: MapPin },
              { id: 'alertas' as const, label: 'Alertas', icon: AlertTriangle, count: alertas.length },
            ].map(v => {
              const Icon = v.icon;
              return (
                <button
                  key={v.id}
                  onClick={() => setVistaStock(v.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    vistaStock === v.id
                      ? 'bg-slate-700 text-slate-100'
                      : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {v.label}
                  {v.count !== undefined && v.count > 0 && (
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      v.id === 'alertas' ? 'bg-red-500/20 text-red-400' : 'bg-slate-600'
                    }`}>{v.count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Contenido según vista */}
          {vistaStock === 'por_producto' && (
            <div className="space-y-2">
              {stockPorProducto.map(({ producto, ubicaciones, totalStock }) => (
                <ProductoStockCard
                  key={producto.codigo}
                  producto={producto}
                  ubicaciones={ubicaciones}
                  totalStock={totalStock}
                />
              ))}
              {stockPorProducto.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No hay productos en stock</p>
                </div>
              )}
            </div>
          )}

          {vistaStock === 'por_ubicacion' && (
            <div className="space-y-4">
              {stockPorUbicacion.map(({ pasillo, items }) => (
                <div key={pasillo} className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-800/50 flex items-center justify-between">
                    <span className="font-semibold text-slate-200">Pasillo {pasillo}</span>
                    <span className="text-sm text-slate-400">{items.length} ubicaciones</span>
                  </div>
                  <div className="divide-y divide-slate-800/50">
                    {items.map(s => (
                      <div key={s.id} className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm text-emerald-400">{s.ubicacion_codigo}</span>
                          <div>
                            <div className="text-sm text-slate-200">{s.producto?.descripcion || s.producto_codigo}</div>
                            <div className="text-xs text-slate-500">{s.producto_codigo}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-slate-200">{s.cantidad}</div>
                          {s.cantidad_reservada > 0 && (
                            <div className="text-xs text-amber-400">-{s.cantidad_reservada} reserv.</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {vistaStock === 'alertas' && (
            <div className="space-y-2">
              {alertas.map((alerta, idx) => (
                <div 
                  key={idx}
                  className={`p-4 rounded-xl border flex items-center gap-4 ${
                    alerta.tipo === 'bajo_stock' ? 'bg-red-500/10 border-red-500/30' :
                    alerta.tipo === 'proximo_vencer' ? 'bg-amber-500/10 border-amber-500/30' :
                    'bg-slate-800/50 border-slate-700/50'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${
                    alerta.tipo === 'bajo_stock' ? 'bg-red-500/20' :
                    alerta.tipo === 'proximo_vencer' ? 'bg-amber-500/20' :
                    'bg-slate-700'
                  }`}>
                    {alerta.tipo === 'bajo_stock' && <AlertTriangle className="h-5 w-5 text-red-400" />}
                    {alerta.tipo === 'proximo_vencer' && <Calendar className="h-5 w-5 text-amber-400" />}
                    {alerta.tipo === 'sin_movimiento' && <Clock className="h-5 w-5 text-slate-400" />}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-slate-200">{alerta.stock.producto?.descripcion || alerta.stock.producto_codigo}</div>
                    <div className="text-sm text-slate-400">{alerta.stock.ubicacion_codigo}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${
                      alerta.tipo === 'bajo_stock' ? 'text-red-400' :
                      alerta.tipo === 'proximo_vencer' ? 'text-amber-400' :
                      'text-slate-400'
                    }`}>{alerta.mensaje}</div>
                  </div>
                </div>
              ))}
              {alertas.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 text-emerald-400" />
                  <p className="text-emerald-400">Sin alertas pendientes</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ==================== CONTEOS ==================== */}
      {vistaActiva === 'conteos' && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <ClipboardList className="h-6 w-6 text-blue-400" />
              Conteos de Inventario
            </h3>
            
            <div className="flex gap-2">
              <button
                onClick={() => handleIniciarConteo('ciclico')}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium"
              >
                Conteo Cíclico
              </button>
              <button
                onClick={() => handleIniciarConteo('completo')}
                disabled={saving}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-medium"
              >
                Conteo Completo
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {conteos.map(conteo => {
              const almacen = almacenes.find(a => a.id === conteo.almacen_id);
              const progreso = conteo.ubicaciones_total > 0 
                ? Math.round((conteo.ubicaciones_contadas / conteo.ubicaciones_total) * 100)
                : 0;
              
              return (
                <div key={conteo.id} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-blue-400">{conteo.numero}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        conteo.estado === 'completado' ? 'bg-emerald-500/20 text-emerald-400' :
                        conteo.estado === 'en_proceso' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {conteo.estado === 'completado' ? 'Completado' : 
                         conteo.estado === 'en_proceso' ? 'En Proceso' : 'Planificado'}
                      </span>
                      <span className="text-xs text-slate-500">{conteo.tipo}</span>
                    </div>
                    {almacen && (
                      <span className="text-sm text-slate-400">{almacen.nombre}</span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 mb-2">
                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${conteo.estado === 'completado' ? 'bg-emerald-500' : 'bg-blue-500'}`}
                        style={{ width: `${progreso}%` }}
                      />
                    </div>
                    <span className="text-sm text-slate-300 w-20 text-right">
                      {conteo.ubicaciones_contadas}/{conteo.ubicaciones_total}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {conteo.fecha_inicio && `Inicio: ${new Date(conteo.fecha_inicio).toLocaleDateString()}`}
                    </span>
                    {conteo.diferencias_encontradas > 0 && (
                      <span className="text-amber-400">
                        {conteo.diferencias_encontradas} diferencia(s)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ==================== EJECUTAR CONTEO ==================== */}
      {vistaActiva === 'ejecutar_conteo' && conteoActivo && lineasConteo.length > 0 && (
        <EjecutarConteo
          conteo={conteoActivo}
          lineas={lineasConteo}
          lineaActual={lineaConteoActual}
          cantidadContada={cantidadContada}
          setCantidadContada={setCantidadContada}
          onConfirmar={handleConfirmarLineaConteo}
          onAplicarAjustes={handleAplicarAjustes}
          onSalir={() => setVistaActiva('conteos')}
          saving={saving}
        />
      )}

      {/* ==================== HISTORIAL ==================== */}
      {vistaActiva === 'historial' && (
        <div className="text-center py-12 text-slate-500">
          <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Historial de movimientos por ubicación</p>
          <p className="text-sm mt-1">Próximamente</p>
        </div>
      )}
    </div>
  );
}

// ============================================
// SUB-COMPONENTES
// ============================================

interface ProductoStockCardProps {
  producto: Product;
  ubicaciones: StockUbicacion[];
  totalStock: number;
}

function ProductoStockCard({ producto, ubicaciones, totalStock }: ProductoStockCardProps) {
  const [expandido, setExpandido] = useState(false);
  const bajosStock = totalStock <= (producto.stockMinimo || 0);
  
  return (
    <div className={`bg-slate-900/50 border rounded-xl overflow-hidden ${
      bajosStock ? 'border-red-500/30' : 'border-slate-800/50'
    }`}>
      <button
        onClick={() => setExpandido(!expandido)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <ChevronRight className={`h-4 w-4 text-slate-500 transition-transform ${expandido ? 'rotate-90' : ''}`} />
          <div className="text-left">
            <div className="font-medium text-slate-200">{producto.descripcion}</div>
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span className="font-mono">{producto.codigo}</span>
              <span>•</span>
              <span>{producto.categoria}</span>
              <span>•</span>
              <span>{ubicaciones.length} ubicación(es)</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-xl font-bold ${bajosStock ? 'text-red-400' : 'text-slate-200'}`}>
            {totalStock}
          </div>
          {bajosStock && (
            <div className="text-xs text-red-400">Mín: {producto.stockMinimo}</div>
          )}
        </div>
      </button>
      
      {expandido && (
        <div className="border-t border-slate-800/50 divide-y divide-slate-800/50">
          {ubicaciones.map(s => (
            <div key={s.id} className="px-4 py-2 flex items-center justify-between bg-slate-800/20">
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-emerald-400" />
                <span className="font-mono text-sm text-emerald-400">{s.ubicacion_codigo}</span>
                {s.lote_numero && (
                  <span className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-400">
                    Lote: {s.lote_numero}
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="font-bold text-slate-200">{s.cantidad}</span>
                {s.cantidad_reservada > 0 && (
                  <span className="text-xs text-amber-400 ml-2">(-{s.cantidad_reservada})</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface EjecutarConteoProps {
  conteo: ConteoInventario;
  lineas: LineaConteo[];
  lineaActual: number;
  cantidadContada: string;
  setCantidadContada: (v: string) => void;
  onConfirmar: () => void;
  onAplicarAjustes: () => void;
  onSalir: () => void;
  saving: boolean;
}

function EjecutarConteo({ 
  conteo, lineas, lineaActual, cantidadContada, setCantidadContada, 
  onConfirmar, onAplicarAjustes, onSalir, saving 
}: EjecutarConteoProps) {
  const linea = lineas[lineaActual];
  const progreso = lineas.length > 0 ? Math.round((lineaActual / lineas.length) * 100) : 0;
  const conteoTerminado = lineaActual >= lineas.length || conteo.estado === 'completado';
  const diferencias = lineas.filter(l => l.diferencia && l.diferencia !== 0);
  
  if (conteoTerminado) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-100">Conteo Completado</h3>
          <button onClick={onSalir} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl">
            Cerrar
          </button>
        </div>
        
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 text-center">
          <CheckCircle className="h-16 w-16 mx-auto mb-4 text-emerald-400" />
          <h4 className="text-xl font-bold text-emerald-400 mb-2">{conteo.numero}</h4>
          <p className="text-slate-300">
            {conteo.ubicaciones_contadas} ubicaciones contadas
          </p>
        </div>
        
        {diferencias.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
            <h4 className="font-semibold text-amber-400 mb-3">
              {diferencias.length} Diferencia(s) Encontrada(s)
            </h4>
            <div className="space-y-2 mb-4">
              {diferencias.map(l => (
                <div key={l.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-slate-200">{l.producto_nombre || l.producto_codigo}</span>
                    <span className="text-slate-500 ml-2">@ {l.ubicacion_codigo}</span>
                  </div>
                  <div className={`font-mono ${l.diferencia! > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {l.diferencia! > 0 ? '+' : ''}{l.diferencia}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={onAplicarAjustes}
              disabled={saving}
              className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium"
            >
              {saving ? 'Aplicando...' : 'Aplicar Ajustes'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg text-blue-400">{conteo.numero}</span>
            <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs">
              En Proceso
            </span>
          </div>
        </div>
        <button onClick={onSalir} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl">
          Pausar
        </button>
      </div>

      {/* Progreso */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">Progreso</span>
          <span className="text-sm text-slate-200">{lineaActual + 1} de {lineas.length}</span>
        </div>
        <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 transition-all" style={{ width: `${progreso}%` }} />
        </div>
      </div>

      {/* Línea actual */}
      <div className="bg-blue-500/10 border-2 border-blue-500/50 rounded-xl p-6">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 rounded-full mb-4">
            <MapPin className="h-5 w-5 text-blue-400" />
            <span className="text-2xl font-bold text-blue-400">{linea.ubicacion_codigo}</span>
          </div>
          
          <div className="text-lg text-slate-200 mb-1">{linea.producto_nombre || linea.producto_codigo}</div>
          <div className="font-mono text-sm text-slate-400">{linea.producto_codigo}</div>
        </div>
        
        <div className="flex items-center justify-center gap-8 mb-6">
          <div className="text-center">
            <div className="text-sm text-slate-500 mb-1">Stock Sistema</div>
            <div className="text-3xl font-bold text-slate-400">{linea.cantidad_sistema}</div>
          </div>
        </div>
        
        <div className="max-w-xs mx-auto">
          <label className="block text-sm text-slate-400 mb-2 text-center">Cantidad Contada</label>
          <input
            type="number"
            min={0}
            value={cantidadContada}
            onChange={(e) => setCantidadContada(e.target.value)}
            placeholder={String(linea.cantidad_sistema)}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-2xl text-center text-slate-100"
            autoFocus
          />
        </div>
      </div>

      {/* Acciones */}
      <div className="flex gap-3">
        <button
          onClick={() => {
            setCantidadContada(String(linea.cantidad_sistema));
          }}
          className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl font-medium"
        >
          Igual al Sistema
        </button>
        <button
          onClick={onConfirmar}
          className="flex-[2] px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 text-lg"
        >
          <Check className="h-5 w-5" />
          Confirmar
        </button>
      </div>
    </div>
  );
}