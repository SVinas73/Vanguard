'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Package, History, TrendingUp, TrendingDown, Calendar, User, Layers,
  DollarSign, RefreshCw, ChevronDown, ChevronUp, AlertCircle, Search,
  Upload, Download, FileSpreadsheet, Filter, Settings, BarChart3,
  PieChart, Target, AlertTriangle, CheckCircle, XCircle, Plus, Edit,
  Trash2, X, Eye, Calculator, Percent, Tag, Truck, Shield, Box,
  ArrowUpRight, ArrowDownRight, TrendingUp as Trend, Activity,
  FileText, Printer, MoreHorizontal, Zap, Award, Star, Flag,
  ChevronRight, ArrowRight, Info, HelpCircle, Sparkles, Scale,
  BarChart2, LineChart, PiggyBank, Wallet, Receipt, CreditCard,
  Building2, Users, Clock, CalendarDays, Hash, Boxes, PackageCheck,
  CircleDollarSign, BadgePercent, Banknote, Coins, HandCoins
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart as RechartsPie, Pie, Cell,
  LineChart as RechartsLine, Line, AreaChart, Area, ComposedChart
} from 'recharts';

// ============================================
// TIPOS
// ============================================

interface Producto {
  id: string;
  codigo: string;
  descripcion: string;
  categoria?: string;
  subcategoria?: string;
  marca?: string;
  proveedor_id?: string;
  proveedor_nombre?: string;
  precio: number;
  costo: number;
  costoPromedio: number;
  costoUltimaCompra: number;
  costoReposicion: number;
  stock: number;
  stockMinimo: number;
  activo: boolean;
  // Costos indirectos
  costoFlete?: number;
  costoSeguro?: number;
  costoAduanas?: number;
  comisionVenta?: number;
  // Calculados
  margen?: number;
  margenPorcentaje?: number;
  valorStock?: number;
  clasificacionABC?: 'A' | 'B' | 'C';
}

interface Lote {
  id: string;
  producto_id: string;
  codigo: string;
  cantidad_inicial: number;
  cantidad_disponible: number;
  costo_unitario: number;
  fecha_compra: string;
  fecha_vencimiento?: string;
  proveedor_id?: string;
  proveedor_nombre?: string;
  numero_factura?: string;
  usuario: string;
  notas?: string;
  created_at: string;
}

interface HistorialPrecio {
  id: string;
  producto_id: string;
  codigo: string;
  tipo: 'costo' | 'precio_venta';
  valor_anterior: number;
  valor_nuevo: number;
  variacion: number;
  variacion_porcentaje: number;
  usuario: string;
  motivo?: string;
  created_at: string;
}

interface HistorialCosto {
  id: string;
  producto_id: string;
  codigo: string;
  costo_anterior: number;
  costo_nuevo: number;
  cantidad: number;
  proveedor_id?: string;
  proveedor_nombre?: string;
  numero_factura?: string;
  fecha: string;
  usuario: string;
  created_at: string;
}

interface CostoIndirecto {
  id: string;
  nombre: string;
  tipo: 'fijo' | 'porcentaje';
  valor: number;
  aplicaA: 'todos' | 'categoria' | 'proveedor' | 'producto';
  filtroId?: string;
  filtroNombre?: string;
  activo: boolean;
}

interface SimulacionPrecio {
  producto: Producto;
  precioActual: number;
  precioNuevo: number;
  costoTotal: number;
  margenActual: number;
  margenNuevo: number;
  margenActualPct: number;
  margenNuevoPct: number;
  diferencia: number;
  diferenciaPct: number;
}

interface AlertaMargen {
  producto: Producto;
  margen: number;
  margenPorcentaje: number;
  tipo: 'critico' | 'bajo' | 'negativo';
}

interface ComparativaProveedor {
  proveedor_id: string;
  proveedor_nombre: string;
  costo_promedio: number;
  ultimo_costo: number;
  cantidad_compras: number;
  ultima_compra: string;
}

type TabActiva = 'dashboard' | 'productos' | 'lotes' | 'historial' | 'simulador' | 'masivo' | 'indirectos' | 'reportes';
type VistaProductos = 'tabla' | 'abc' | 'alertas';

// ============================================
// CONFIGURACIÓN
// ============================================

const CLASIFICACION_ABC = {
  A: { label: 'Clase A', color: 'text-emerald-400', bg: 'bg-emerald-500/20', porcentaje: 80, descripcion: '80% del valor' },
  B: { label: 'Clase B', color: 'text-amber-400', bg: 'bg-amber-500/20', porcentaje: 15, descripcion: '15% del valor' },
  C: { label: 'Clase C', color: 'text-slate-400', bg: 'bg-slate-500/20', porcentaje: 5, descripcion: '5% del valor' },
};

const ALERTA_MARGEN = {
  negativo: { label: 'Margen Negativo', color: 'text-red-500', bg: 'bg-red-500/20', umbral: 0 },
  critico: { label: 'Margen Crítico', color: 'text-red-400', bg: 'bg-red-500/10', umbral: 5 },
  bajo: { label: 'Margen Bajo', color: 'text-amber-400', bg: 'bg-amber-500/10', umbral: 15 },
};

const COLORES_GRAFICO = ['#10b981', '#f59e0b', '#64748b', '#06b6d4', '#8b5cf6', '#ec4899', '#f97316'];

// ============================================
// HELPERS
// ============================================

const formatCurrency = (value: number): string => {
  return `$ ${value.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const calcularMargen = (precio: number, costo: number): number => {
  return precio - costo;
};

const calcularMargenPorcentaje = (precio: number, costo: number): number => {
  if (precio === 0) return 0;
  return ((precio - costo) / precio) * 100;
};

const calcularCostoTotal = (producto: Producto): number => {
  const costoBase = producto.costoPromedio || producto.costo || 0;
  const flete = producto.costoFlete || 0;
  const seguro = producto.costoSeguro || 0;
  const aduanas = producto.costoAduanas || 0;
  return costoBase + flete + seguro + aduanas;
};

const clasificarABC = (productos: Producto[]): Producto[] => {
  // Calcular valor de stock para cada producto
  const productosConValor = productos.map(p => ({
    ...p,
    valorStock: p.stock * (p.costoPromedio || p.costo || 0),
  }));

  // Ordenar por valor descendente
  productosConValor.sort((a, b) => b.valorStock - a.valorStock);

  // Calcular valor total
  const valorTotal = productosConValor.reduce((sum, p) => sum + p.valorStock, 0);

  // Asignar clasificación ABC
  let acumulado = 0;
  return productosConValor.map(p => {
    acumulado += p.valorStock;
    const porcentajeAcumulado = (acumulado / valorTotal) * 100;

    let clasificacion: 'A' | 'B' | 'C';
    if (porcentajeAcumulado <= 80) {
      clasificacion = 'A';
    } else if (porcentajeAcumulado <= 95) {
      clasificacion = 'B';
    } else {
      clasificacion = 'C';
    }

    return { ...p, clasificacionABC: clasificacion };
  });
};

// ============================================
// HOOK TOAST
// ============================================

function useToast() {
  const [toasts, setToasts] = useState<Array<{ id: string; type: string; title: string; message?: string }>>([]);

  const addToast = (type: string, title: string, message?: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const ToastContainer = () => toasts.length > 0 ? (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map(t => (
        <div key={t.id} className={`px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3 ${
          t.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' :
          t.type === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-400' :
          'bg-amber-500/20 border-amber-500/30 text-amber-400'
        }`}>
          {t.type === 'success' ? <CheckCircle className="h-5 w-5" /> :
           t.type === 'error' ? <XCircle className="h-5 w-5" /> :
           <AlertTriangle className="h-5 w-5" />}
          <div>
            <div className="font-medium">{t.title}</div>
            {t.message && <div className="text-sm opacity-80">{t.message}</div>}
          </div>
        </div>
      ))}
    </div>
  ) : null;

  return {
    success: (title: string, msg?: string) => addToast('success', title, msg),
    error: (title: string, msg?: string) => addToast('error', title, msg),
    warning: (title: string, msg?: string) => addToast('warning', title, msg),
    ToastContainer,
  };
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function CostosEnterprise() {
  const { user } = useAuth();
  const toast = useToast();

  // Estado principal
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);

  // Datos
  const [productos, setProductos] = useState<Producto[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [historialPrecios, setHistorialPrecios] = useState<HistorialPrecio[]>([]);
  const [historialCostos, setHistorialCostos] = useState<HistorialCosto[]>([]);
  const [costosIndirectos, setCostosIndirectos] = useState<CostoIndirecto[]>([]);
  const [proveedores, setProveedores] = useState<Array<{ id: string; nombre: string }>>([]);
  const [categorias, setCategorias] = useState<string[]>([]);

  // UI
  const [tabActiva, setTabActiva] = useState<TabActiva>('dashboard');
  const [vistaProductos, setVistaProductos] = useState<VistaProductos>('tabla');
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas');
  const [filtroProveedor, setFiltroProveedor] = useState<string>('todos');
  const [filtroABC, setFiltroABC] = useState<'A' | 'B' | 'C' | 'todos'>('todos');
  const [ordenarPor, setOrdenarPor] = useState<'valor' | 'margen' | 'stock' | 'codigo'>('valor');

  // Modales
  const [modalType, setModalType] = useState<string | null>(null);
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);

  // Forms
  const [actualizacionMasivaForm, setActualizacionMasivaForm] = useState({
    tipo: 'porcentaje' as 'porcentaje' | 'fijo',
    valor: 0,
    aplicaA: 'todos' as 'todos' | 'categoria' | 'proveedor' | 'seleccionados',
    filtroId: '',
    campo: 'precio' as 'precio' | 'costo',
    productosSeleccionados: [] as string[],
  });

  const [simuladorForm, setSimuladorForm] = useState({
    tipo: 'porcentaje' as 'porcentaje' | 'fijo' | 'margen_objetivo',
    valor: 0,
    aplicaA: 'todos' as 'todos' | 'categoria' | 'producto',
    filtroId: '',
  });

  const [costoIndirectoForm, setCostoIndirectoForm] = useState({
    nombre: '',
    tipo: 'porcentaje' as 'fijo' | 'porcentaje',
    valor: 0,
    aplicaA: 'todos' as 'todos' | 'categoria' | 'proveedor' | 'producto',
    filtroId: '',
  });

  const [loteForm, setLoteForm] = useState({
    productoId: '',
    cantidad: 0,
    costoUnitario: 0,
    proveedorId: '',
    numeroFactura: '',
    fechaCompra: new Date().toISOString().split('T')[0],
    notas: '',
  });

  // Continúa en parte 2...
  // ============================================
  // CARGA DE DATOS
  // ============================================

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadProductos(),
        loadLotes(),
        loadHistorialPrecios(),
        loadHistorialCostos(),
        loadCostosIndirectos(),
        loadCatalogos(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const loadProductos = async () => {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .is('deleted_at', null)
      .order('codigo');

    if (error) {
      console.error('Error cargando productos:', error);
      return;
    }

    if (data) {
      const productosFormateados: Producto[] = data.map((p: any) => {
        const costoBase = parseFloat(p.costo_promedio) || 0;
        const precio = parseFloat(p.precio) || 0;
        const stock = p.stock ?? 0;
        const costoFlete = parseFloat(p.costo_flete) || 0;
        const costoSeguro = parseFloat(p.costo_seguro) || 0;
        const costoAduanas = parseFloat(p.costo_aduanas) || 0;
        
        // Calcular costo total y márgenes inline
        const costoTotal = costoBase + costoFlete + costoSeguro + costoAduanas;
        const margen = precio - costoTotal;
        const margenPorcentaje = precio > 0 ? ((precio - costoTotal) / precio) * 100 : 0;
        const valorStock = stock * costoBase;

        return {
          id: p.id,
          codigo: p.codigo,
          descripcion: p.descripcion,
          categoria: p.categoria,
          subcategoria: p.subcategoria,
          marca: p.marca,
          proveedor_id: undefined,
          proveedor_nombre: undefined,
          precio,
          costo: costoBase,
          costoPromedio: costoBase,
          costoUltimaCompra: parseFloat(p.costo_ultima_compra || p.costo_promedio) || 0,
          costoReposicion: parseFloat(p.costo_reposicion || p.costo_promedio) || 0,
          stock,
          stockMinimo: p.stock_minimo ?? 0,
          activo: p.deleted_at === null,
          costoFlete,
          costoSeguro,
          costoAduanas,
          comisionVenta: parseFloat(p.comision_venta) || 0,
          margen,
          margenPorcentaje,
          valorStock,
        };
      });

      // Clasificar ABC
      const productosClasificados = clasificarABC(productosFormateados);
      setProductos(productosClasificados);
    }
  };

  const loadLotes = async () => {
    const { data } = await supabase
      .from('lotes')
      .select(`
        *,
        proveedor:proveedores(id, nombre)
      `)
      .gt('cantidad_disponible', 0)
      .order('fecha_compra', { ascending: true });

    if (data) {
      setLotes(data.map((l: any) => ({
        id: l.id,
        producto_id: l.producto_id,
        codigo: l.codigo,
        cantidad_inicial: l.cantidad_inicial,
        cantidad_disponible: l.cantidad_disponible,
        costo_unitario: parseFloat(l.costo_unitario) || 0,
        fecha_compra: l.fecha_compra,
        fecha_vencimiento: l.fecha_vencimiento,
        proveedor_id: l.proveedor_id,
        proveedor_nombre: l.proveedor?.nombre,
        numero_factura: l.numero_factura,
        usuario: l.usuario,
        notas: l.notas,
        created_at: l.created_at,
      })));
    }
  };

  const loadHistorialPrecios = async () => {
    const { data } = await supabase
      .from('historial_precios')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (data) {
      setHistorialPrecios(data.map((h: any) => ({
        id: h.id,
        producto_id: h.producto_id,
        codigo: h.codigo,
        tipo: h.tipo || 'precio_venta',
        valor_anterior: parseFloat(h.precio_anterior) || 0,
        valor_nuevo: parseFloat(h.precio_nuevo) || 0,
        variacion: (parseFloat(h.precio_nuevo) || 0) - (parseFloat(h.precio_anterior) || 0),
        variacion_porcentaje: h.precio_anterior > 0 
          ? (((parseFloat(h.precio_nuevo) || 0) - (parseFloat(h.precio_anterior) || 0)) / (parseFloat(h.precio_anterior) || 1)) * 100
          : 0,
        usuario: h.usuario,
        motivo: h.motivo,
        created_at: h.created_at,
      })));
    }
  };

  const loadHistorialCostos = async () => {
    const { data } = await supabase
      .from('historial_costos')
      .select(`
        *,
        proveedor:proveedores(id, nombre)
      `)
      .order('created_at', { ascending: false })
      .limit(500);

    if (data) {
      setHistorialCostos(data.map((h: any) => ({
        id: h.id,
        producto_id: h.producto_id,
        codigo: h.codigo,
        costo_anterior: parseFloat(h.costo_anterior) || 0,
        costo_nuevo: parseFloat(h.costo_nuevo) || 0,
        cantidad: h.cantidad || 0,
        proveedor_id: h.proveedor_id,
        proveedor_nombre: h.proveedor?.nombre,
        numero_factura: h.numero_factura,
        fecha: h.fecha,
        usuario: h.usuario,
        created_at: h.created_at,
      })));
    }
  };

  const loadCostosIndirectos = async () => {
    const { data } = await supabase
      .from('costos_indirectos')
      .select('*')
      .order('nombre');

    if (data) {
      setCostosIndirectos(data.map((c: any) => ({
        id: c.id,
        nombre: c.nombre,
        tipo: c.tipo,
        valor: parseFloat(c.valor) || 0,
        aplicaA: c.aplica_a,
        filtroId: c.filtro_id,
        filtroNombre: c.filtro_nombre,
        activo: c.activo,
      })));
    }
  };

  const loadCatalogos = async () => {
    // Proveedores
    const { data: provData } = await supabase
      .from('proveedores')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre');
    if (provData) setProveedores(provData);

    // Categorías únicas
    const { data: catData } = await supabase
      .from('productos')
      .select('categoria')
      .not('categoria', 'is', null)
      .order('categoria');
    if (catData) {
      const cats = [...new Set(catData.map(c => c.categoria).filter(Boolean))];
      setCategorias(cats);
    }
  };

  // ============================================
  // MÉTRICAS CALCULADAS
  // ============================================

  const metricas = useMemo(() => {
    // Valor total del inventario (FIFO - por lotes)
    const valorInventarioFIFO = lotes.reduce(
      (sum, l) => sum + l.cantidad_disponible * l.costo_unitario,
      0
    );

    // Valor a precio de venta
    const valorVenta = productos.reduce(
      (sum, p) => sum + p.stock * p.precio,
      0
    );

    // Valor por costo promedio
    const valorCostoPromedio = productos.reduce(
      (sum, p) => sum + p.stock * (p.costoPromedio || p.costo || 0),
      0
    );

    // Margen bruto total
    const margenBruto = valorVenta - valorInventarioFIFO;
    const margenPorcentaje = valorVenta > 0 ? (margenBruto / valorVenta) * 100 : 0;

    // Productos por clasificación ABC
    const productosA = productos.filter(p => p.clasificacionABC === 'A');
    const productosB = productos.filter(p => p.clasificacionABC === 'B');
    const productosC = productos.filter(p => p.clasificacionABC === 'C');

    const valorA = productosA.reduce((sum, p) => sum + (p.valorStock || 0), 0);
    const valorB = productosB.reduce((sum, p) => sum + (p.valorStock || 0), 0);
    const valorC = productosC.reduce((sum, p) => sum + (p.valorStock || 0), 0);

    // Alertas de margen
    const alertasMargen: AlertaMargen[] = [];
    productos.forEach(p => {
      if ((p.margenPorcentaje || 0) < 0) {
        alertasMargen.push({ producto: p, margen: p.margen || 0, margenPorcentaje: p.margenPorcentaje || 0, tipo: 'negativo' });
      } else if ((p.margenPorcentaje || 0) < 5) {
        alertasMargen.push({ producto: p, margen: p.margen || 0, margenPorcentaje: p.margenPorcentaje || 0, tipo: 'critico' });
      } else if ((p.margenPorcentaje || 0) < 15) {
        alertasMargen.push({ producto: p, margen: p.margen || 0, margenPorcentaje: p.margenPorcentaje || 0, tipo: 'bajo' });
      }
    });

    // Margen promedio
    const margenPromedio = productos.length > 0
      ? productos.reduce((sum, p) => sum + (p.margenPorcentaje || 0), 0) / productos.length
      : 0;

    // Costos indirectos totales
    const totalCostosIndirectos = costosIndirectos
      .filter(c => c.activo)
      .reduce((sum, c) => {
        if (c.tipo === 'fijo') return sum + c.valor;
        // Para porcentajes, calcular sobre el valor del inventario
        return sum + (valorCostoPromedio * c.valor / 100);
      }, 0);

    // Tendencia de costos (últimos 30 días vs anteriores)
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);
    const hace60Dias = new Date();
    hace60Dias.setDate(hace60Dias.getDate() - 60);

    const costosUltimos30 = historialCostos.filter(h => new Date(h.created_at) >= hace30Dias);
    const costos30a60 = historialCostos.filter(h => {
      const fecha = new Date(h.created_at);
      return fecha >= hace60Dias && fecha < hace30Dias;
    });

    const promedio30 = costosUltimos30.length > 0
      ? costosUltimos30.reduce((sum, h) => sum + h.costo_nuevo, 0) / costosUltimos30.length
      : 0;
    const promedio60 = costos30a60.length > 0
      ? costos30a60.reduce((sum, h) => sum + h.costo_nuevo, 0) / costos30a60.length
      : 0;

    const tendenciaCostos = promedio60 > 0 ? ((promedio30 - promedio60) / promedio60) * 100 : 0;

    return {
      valorInventarioFIFO,
      valorVenta,
      valorCostoPromedio,
      margenBruto,
      margenPorcentaje,
      margenPromedio,
      totalProductos: productos.length,
      totalLotes: lotes.length,
      productosA: productosA.length,
      productosB: productosB.length,
      productosC: productosC.length,
      valorA,
      valorB,
      valorC,
      alertasMargen,
      alertasNegativos: alertasMargen.filter(a => a.tipo === 'negativo').length,
      alertasCriticos: alertasMargen.filter(a => a.tipo === 'critico').length,
      alertasBajos: alertasMargen.filter(a => a.tipo === 'bajo').length,
      totalCostosIndirectos,
      tendenciaCostos,
    };
  }, [productos, lotes, historialCostos, costosIndirectos]);

  // Datos para gráficos
  const datosABC = useMemo(() => [
    { name: 'Clase A', value: metricas.valorA, cantidad: metricas.productosA, color: '#10b981' },
    { name: 'Clase B', value: metricas.valorB, cantidad: metricas.productosB, color: '#f59e0b' },
    { name: 'Clase C', value: metricas.valorC, cantidad: metricas.productosC, color: '#64748b' },
  ], [metricas]);

  const datosMargenPorCategoria = useMemo(() => {
    const porCategoria: Record<string, { total: number; count: number }> = {};
    productos.forEach(p => {
      const cat = p.categoria || 'Sin categoría';
      if (!porCategoria[cat]) porCategoria[cat] = { total: 0, count: 0 };
      porCategoria[cat].total += p.margenPorcentaje || 0;
      porCategoria[cat].count++;
    });

    return Object.entries(porCategoria)
      .map(([categoria, data]) => ({
        categoria,
        margen: data.count > 0 ? data.total / data.count : 0,
      }))
      .sort((a, b) => b.margen - a.margen)
      .slice(0, 10);
  }, [productos]);

  const tendenciaCostosMensual = useMemo(() => {
    const porMes: Record<string, { total: number; count: number }> = {};
    
    historialCostos.forEach(h => {
      const fecha = new Date(h.created_at);
      const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      if (!porMes[mes]) porMes[mes] = { total: 0, count: 0 };
      porMes[mes].total += h.costo_nuevo;
      porMes[mes].count++;
    });

    return Object.entries(porMes)
      .map(([mes, data]) => ({
        mes,
        costoPromedio: data.count > 0 ? data.total / data.count : 0,
        cantidad: data.count,
      }))
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .slice(-12);
  }, [historialCostos]);

  // Continúa en parte 3...
  // ============================================
  // PRODUCTOS FILTRADOS
  // ============================================

  const productosFiltrados = useMemo(() => {
    return productos.filter(p => {
      if (filtroCategoria !== 'todas' && p.categoria !== filtroCategoria) return false;
      if (filtroProveedor !== 'todos' && p.proveedor_id !== filtroProveedor) return false;
      if (filtroABC !== 'todos' && p.clasificacionABC !== filtroABC) return false;

      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (
          !p.codigo.toLowerCase().includes(search) &&
          !p.descripcion.toLowerCase().includes(search) &&
          !(p.marca?.toLowerCase().includes(search))
        ) return false;
      }

      return true;
    }).sort((a, b) => {
      switch (ordenarPor) {
        case 'valor': return (b.valorStock || 0) - (a.valorStock || 0);
        case 'margen': return (a.margenPorcentaje || 0) - (b.margenPorcentaje || 0);
        case 'stock': return b.stock - a.stock;
        default: return a.codigo.localeCompare(b.codigo);
      }
    });
  }, [productos, filtroCategoria, filtroProveedor, filtroABC, searchTerm, ordenarPor]);

  // ============================================
  // ACCIONES - ACTUALIZAR PRECIO/COSTO INDIVIDUAL
  // ============================================

  const actualizarPrecio = async (producto: Producto, nuevoPrecio: number, motivo?: string) => {
    try {
      setProcesando(producto.id);

      // Registrar historial
      await supabase.from('historial_precios').insert({
        producto_id: producto.id,
        codigo: producto.codigo,
        tipo: 'precio_venta',
        precio_anterior: producto.precio,
        precio_nuevo: nuevoPrecio,
        usuario: user?.email,
        motivo: motivo || 'Actualización manual',
      });

      // Actualizar producto
      await supabase
        .from('productos')
        .update({ precio_venta: nuevoPrecio })
        .eq('id', producto.id);

      toast.success('Precio actualizado');
      loadProductos();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  const actualizarCosto = async (producto: Producto, nuevoCosto: number, motivo?: string) => {
    try {
      setProcesando(producto.id);

      // Registrar historial
      await supabase.from('historial_costos').insert({
        producto_id: producto.id,
        codigo: producto.codigo,
        costo_anterior: producto.costo,
        costo_nuevo: nuevoCosto,
        usuario: user?.email,
        motivo: motivo || 'Actualización manual',
      });

      // Actualizar producto
      await supabase
        .from('productos')
        .update({ 
          costo: nuevoCosto,
          costo_ultima_compra: nuevoCosto,
        })
        .eq('id', producto.id);

      toast.success('Costo actualizado');
      loadProductos();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // ACCIONES - ACTUALIZACIÓN MASIVA
  // ============================================

  const ejecutarActualizacionMasiva = async () => {
    try {
      setProcesando('masivo');

      let productosAActualizar: Producto[] = [];

      // Determinar qué productos actualizar
      if (actualizacionMasivaForm.aplicaA === 'todos') {
        productosAActualizar = productos;
      } else if (actualizacionMasivaForm.aplicaA === 'categoria') {
        productosAActualizar = productos.filter(p => p.categoria === actualizacionMasivaForm.filtroId);
      } else if (actualizacionMasivaForm.aplicaA === 'proveedor') {
        productosAActualizar = productos.filter(p => p.proveedor_id === actualizacionMasivaForm.filtroId);
      } else if (actualizacionMasivaForm.aplicaA === 'seleccionados') {
        productosAActualizar = productos.filter(p => 
          actualizacionMasivaForm.productosSeleccionados.includes(p.id)
        );
      }

      if (productosAActualizar.length === 0) {
        toast.warning('No hay productos para actualizar');
        return;
      }

      // Calcular nuevos valores y preparar actualizaciones
      const updates = productosAActualizar.map(p => {
        const valorActual = actualizacionMasivaForm.campo === 'precio' ? p.precio : p.costo;
        let nuevoValor: number;

        if (actualizacionMasivaForm.tipo === 'porcentaje') {
          nuevoValor = valorActual * (1 + actualizacionMasivaForm.valor / 100);
        } else {
          nuevoValor = valorActual + actualizacionMasivaForm.valor;
        }

        nuevoValor = Math.max(0, Math.round(nuevoValor * 100) / 100);

        return {
          producto: p,
          valorAnterior: valorActual,
          valorNuevo: nuevoValor,
        };
      });

      // Ejecutar actualizaciones
      for (const update of updates) {
        // Registrar historial
        if (actualizacionMasivaForm.campo === 'precio') {
          await supabase.from('historial_precios').insert({
            producto_id: update.producto.id,
            codigo: update.producto.codigo,
            tipo: 'precio_venta',
            precio_anterior: update.valorAnterior,
            precio_nuevo: update.valorNuevo,
            usuario: user?.email,
            motivo: `Actualización masiva: ${actualizacionMasivaForm.tipo === 'porcentaje' ? actualizacionMasivaForm.valor + '%' : formatCurrency(actualizacionMasivaForm.valor)}`,
          });

          await supabase
            .from('productos')
            .update({ precio_venta: update.valorNuevo })
            .eq('id', update.producto.id);
        } else {
          await supabase.from('historial_costos').insert({
            producto_id: update.producto.id,
            codigo: update.producto.codigo,
            costo_anterior: update.valorAnterior,
            costo_nuevo: update.valorNuevo,
            usuario: user?.email,
          });

          await supabase
            .from('productos')
            .update({ costo: update.valorNuevo })
            .eq('id', update.producto.id);
        }
      }

      toast.success(`${updates.length} productos actualizados`);
      setModalType(null);
      setActualizacionMasivaForm({
        tipo: 'porcentaje',
        valor: 0,
        aplicaA: 'todos',
        filtroId: '',
        campo: 'precio',
        productosSeleccionados: [],
      });
      loadProductos();
      loadHistorialPrecios();
      loadHistorialCostos();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // ACCIONES - IMPORTAR COSTOS DESDE CSV
  // ============================================

  const importarCostosCSV = async (file: File) => {
    try {
      setProcesando('importar');

      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      
      if (lines.length < 2) {
        toast.error('Archivo vacío o inválido');
        return;
      }

      // Parsear header
      const header = lines[0].split(',').map(h => h.trim().toLowerCase());
      const codigoIdx = header.findIndex(h => h === 'codigo' || h === 'código' || h === 'sku');
      const costoIdx = header.findIndex(h => h === 'costo' || h === 'cost' || h === 'precio_costo');
      const precioIdx = header.findIndex(h => h === 'precio' || h === 'price' || h === 'precio_venta');

      if (codigoIdx === -1) {
        toast.error('Columna "codigo" no encontrada');
        return;
      }

      let actualizados = 0;
      let errores = 0;

      // Procesar líneas
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        const codigo = cols[codigoIdx];
        
        if (!codigo) continue;

        const producto = productos.find(p => p.codigo === codigo);
        if (!producto) {
          errores++;
          continue;
        }

        const updates: any = {};
        
        if (costoIdx !== -1 && cols[costoIdx]) {
          const nuevoCosto = parseFloat(cols[costoIdx].replace(/[^0-9.,]/g, '').replace(',', '.'));
          if (!isNaN(nuevoCosto)) {
            updates.costo = nuevoCosto;
            updates.costo_ultima_compra = nuevoCosto;

            // Historial
            await supabase.from('historial_costos').insert({
              producto_id: producto.id,
              codigo: producto.codigo,
              costo_anterior: producto.costo,
              costo_nuevo: nuevoCosto,
              usuario: user?.email,
            });
          }
        }

        if (precioIdx !== -1 && cols[precioIdx]) {
          const nuevoPrecio = parseFloat(cols[precioIdx].replace(/[^0-9.,]/g, '').replace(',', '.'));
          if (!isNaN(nuevoPrecio)) {
            updates.precio_venta = nuevoPrecio;

            // Historial
            await supabase.from('historial_precios').insert({
              producto_id: producto.id,
              codigo: producto.codigo,
              tipo: 'precio_venta',
              precio_anterior: producto.precio,
              precio_nuevo: nuevoPrecio,
              usuario: user?.email,
              motivo: 'Importación CSV',
            });
          }
        }

        if (Object.keys(updates).length > 0) {
          await supabase
            .from('productos')
            .update(updates)
            .eq('id', producto.id);
          actualizados++;
        }
      }

      toast.success(`Importación completada`, `${actualizados} actualizados, ${errores} errores`);
      loadAllData();
    } catch (error: any) {
      toast.error('Error al importar', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // ACCIONES - EXPORTAR DATOS
  // ============================================

  const exportarProductosCSV = () => {
    const headers = ['Codigo', 'Descripcion', 'Categoria', 'Costo', 'Costo Promedio', 'Precio Venta', 'Margen %', 'Stock', 'Valor Stock', 'ABC'];
    const rows = productosFiltrados.map(p => [
      p.codigo,
      p.descripcion,
      p.categoria || '',
      p.costo.toFixed(2),
      (p.costoPromedio || 0).toFixed(2),
      p.precio.toFixed(2),
      (p.margenPorcentaje || 0).toFixed(1),
      p.stock,
      (p.valorStock || 0).toFixed(2),
      p.clasificacionABC || '',
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `costos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast.success('Exportación completada');
  };

  const exportarAnalisisABC = () => {
    const headers = ['Clasificación', 'Código', 'Descripción', 'Valor Stock', '% Acumulado'];
    
    let acumulado = 0;
    const valorTotal = productos.reduce((sum, p) => sum + (p.valorStock || 0), 0);
    
    const productosOrdenados = [...productos].sort((a, b) => (b.valorStock || 0) - (a.valorStock || 0));
    
    const rows = productosOrdenados.map(p => {
      acumulado += p.valorStock || 0;
      const pctAcum = valorTotal > 0 ? (acumulado / valorTotal) * 100 : 0;
      return [
        p.clasificacionABC || '',
        p.codigo,
        p.descripcion,
        (p.valorStock || 0).toFixed(2),
        pctAcum.toFixed(1) + '%',
      ];
    });

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analisis_abc_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast.success('Análisis ABC exportado');
  };

  // ============================================
  // ACCIONES - COSTOS INDIRECTOS
  // ============================================

  const guardarCostoIndirecto = async () => {
    if (!costoIndirectoForm.nombre || costoIndirectoForm.valor <= 0) {
      toast.warning('Complete los campos requeridos');
      return;
    }

    try {
      setProcesando('indirecto');

      await supabase.from('costos_indirectos').insert({
        nombre: costoIndirectoForm.nombre,
        tipo: costoIndirectoForm.tipo,
        valor: costoIndirectoForm.valor,
        aplica_a: costoIndirectoForm.aplicaA,
        filtro_id: costoIndirectoForm.filtroId || null,
        activo: true,
      });

      toast.success('Costo indirecto creado');
      setModalType(null);
      setCostoIndirectoForm({ nombre: '', tipo: 'porcentaje', valor: 0, aplicaA: 'todos', filtroId: '' });
      loadCostosIndirectos();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  const toggleCostoIndirecto = async (costo: CostoIndirecto) => {
    try {
      await supabase
        .from('costos_indirectos')
        .update({ activo: !costo.activo })
        .eq('id', costo.id);

      loadCostosIndirectos();
    } catch (error: any) {
      toast.error('Error', error.message);
    }
  };

  const eliminarCostoIndirecto = async (id: string) => {
    try {
      await supabase
        .from('costos_indirectos')
        .delete()
        .eq('id', id);

      toast.success('Costo indirecto eliminado');
      loadCostosIndirectos();
    } catch (error: any) {
      toast.error('Error', error.message);
    }
  };

  // ============================================
  // ACCIONES - CREAR LOTE
  // ============================================

  const crearLote = async () => {
    if (!loteForm.productoId || loteForm.cantidad <= 0 || loteForm.costoUnitario <= 0) {
      toast.warning('Complete los campos requeridos');
      return;
    }

    try {
      setProcesando('lote');

      const producto = productos.find(p => p.id === loteForm.productoId);
      if (!producto) throw new Error('Producto no encontrado');

      // Crear lote
      await supabase.from('lotes').insert({
        producto_id: loteForm.productoId,
        codigo: producto.codigo,
        cantidad_inicial: loteForm.cantidad,
        cantidad_disponible: loteForm.cantidad,
        costo_unitario: loteForm.costoUnitario,
        fecha_compra: loteForm.fechaCompra,
        proveedor_id: loteForm.proveedorId || null,
        numero_factura: loteForm.numeroFactura || null,
        usuario: user?.email,
        notas: loteForm.notas || null,
      });

      // Actualizar stock y costo promedio del producto
      const nuevoStock = producto.stock + loteForm.cantidad;
      const costoTotal = (producto.stock * (producto.costoPromedio || producto.costo)) + 
                        (loteForm.cantidad * loteForm.costoUnitario);
      const nuevoCostoPromedio = nuevoStock > 0 ? costoTotal / nuevoStock : loteForm.costoUnitario;

      await supabase
        .from('productos')
        .update({
          stock_actual: nuevoStock,
          costo_promedio: nuevoCostoPromedio,
          costo_ultima_compra: loteForm.costoUnitario,
        })
        .eq('id', loteForm.productoId);

      // Registrar historial de costo
      await supabase.from('historial_costos').insert({
        producto_id: loteForm.productoId,
        codigo: producto.codigo,
        costo_anterior: producto.costoPromedio || producto.costo,
        costo_nuevo: nuevoCostoPromedio,
        cantidad: loteForm.cantidad,
        proveedor_id: loteForm.proveedorId || null,
        numero_factura: loteForm.numeroFactura || null,
        fecha: loteForm.fechaCompra,
        usuario: user?.email,
      });

      toast.success('Lote creado', `Stock actualizado: ${nuevoStock}`);
      setModalType(null);
      setLoteForm({
        productoId: '',
        cantidad: 0,
        costoUnitario: 0,
        proveedorId: '',
        numeroFactura: '',
        fechaCompra: new Date().toISOString().split('T')[0],
        notas: '',
      });
      loadAllData();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // SIMULADOR DE PRECIOS
  // ============================================

  const resultadosSimulacion = useMemo((): SimulacionPrecio[] => {
    if (simuladorForm.valor === 0) return [];

    let productosSimular: Producto[] = [];

    if (simuladorForm.aplicaA === 'todos') {
      productosSimular = productos;
    } else if (simuladorForm.aplicaA === 'categoria') {
      productosSimular = productos.filter(p => p.categoria === simuladorForm.filtroId);
    } else if (simuladorForm.aplicaA === 'producto') {
      productosSimular = productos.filter(p => p.id === simuladorForm.filtroId);
    }

    return productosSimular.map(p => {
      const costoTotal = calcularCostoTotal(p);
      let precioNuevo: number;

      if (simuladorForm.tipo === 'porcentaje') {
        precioNuevo = p.precio * (1 + simuladorForm.valor / 100);
      } else if (simuladorForm.tipo === 'fijo') {
        precioNuevo = p.precio + simuladorForm.valor;
      } else {
        // Margen objetivo
        precioNuevo = costoTotal / (1 - simuladorForm.valor / 100);
      }

      precioNuevo = Math.max(0, Math.round(precioNuevo * 100) / 100);

      const margenActual = calcularMargen(p.precio, costoTotal);
      const margenNuevo = calcularMargen(precioNuevo, costoTotal);
      const margenActualPct = calcularMargenPorcentaje(p.precio, costoTotal);
      const margenNuevoPct = calcularMargenPorcentaje(precioNuevo, costoTotal);

      return {
        producto: p,
        precioActual: p.precio,
        precioNuevo,
        costoTotal,
        margenActual,
        margenNuevo,
        margenActualPct,
        margenNuevoPct,
        diferencia: precioNuevo - p.precio,
        diferenciaPct: p.precio > 0 ? ((precioNuevo - p.precio) / p.precio) * 100 : 0,
      };
    });
  }, [productos, simuladorForm]);

  // Continúa en parte 4...
  // ============================================
  // COMPARATIVA POR PROVEEDOR
  // ============================================

  const comparativaProveedores = useMemo(() => {
    if (!productoSeleccionado) return [];

    const lotesProd = lotes.filter(l => l.codigo === productoSeleccionado.codigo);
    const porProveedor: Record<string, ComparativaProveedor> = {};

    lotesProd.forEach(l => {
      const provId = l.proveedor_id || 'sin_proveedor';
      const provNombre = l.proveedor_nombre || 'Sin proveedor';

      if (!porProveedor[provId]) {
        porProveedor[provId] = {
          proveedor_id: provId,
          proveedor_nombre: provNombre,
          costo_promedio: 0,
          ultimo_costo: 0,
          cantidad_compras: 0,
          ultima_compra: '',
        };
      }

      porProveedor[provId].cantidad_compras++;
      porProveedor[provId].costo_promedio = 
        (porProveedor[provId].costo_promedio * (porProveedor[provId].cantidad_compras - 1) + l.costo_unitario) / 
        porProveedor[provId].cantidad_compras;

      if (!porProveedor[provId].ultima_compra || l.fecha_compra > porProveedor[provId].ultima_compra) {
        porProveedor[provId].ultima_compra = l.fecha_compra;
        porProveedor[provId].ultimo_costo = l.costo_unitario;
      }
    });

    return Object.values(porProveedor).sort((a, b) => a.costo_promedio - b.costo_promedio);
  }, [productoSeleccionado, lotes]);

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <toast.ToastContainer />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <CircleDollarSign className="h-7 w-7 text-cyan-400" />
            Centro de Costos
          </h2>
          <p className="text-slate-400 text-sm mt-1">Gestión integral de costos, márgenes y rentabilidad</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadAllData} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-900/50 rounded-xl overflow-x-auto">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="h-4 w-4" /> },
          { id: 'productos', label: 'Productos', icon: <Package className="h-4 w-4" /> },
          { id: 'lotes', label: 'Lotes FIFO', icon: <Layers className="h-4 w-4" /> },
          { id: 'historial', label: 'Historial', icon: <History className="h-4 w-4" /> },
          { id: 'simulador', label: 'Simulador', icon: <Calculator className="h-4 w-4" /> },
          { id: 'masivo', label: 'Masivo', icon: <Zap className="h-4 w-4" /> },
          { id: 'indirectos', label: 'Indirectos', icon: <Truck className="h-4 w-4" /> },
          { id: 'reportes', label: 'Reportes', icon: <FileText className="h-4 w-4" /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setTabActiva(tab.id as TabActiva)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tabActiva === tab.id
                ? 'bg-cyan-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ==================== DASHBOARD ==================== */}
      {tabActiva === 'dashboard' && (
        <div className="space-y-6">
          {/* KPIs principales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Layers className="h-5 w-5 text-cyan-400" />
                <span className="text-sm text-slate-400">Costo Inventario</span>
              </div>
              <div className="text-2xl font-bold text-cyan-400">{formatCurrency(metricas.valorInventarioFIFO)}</div>
              <div className="text-xs text-slate-500 mt-1">Valoración FIFO</div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-5 w-5 text-emerald-400" />
                <span className="text-sm text-slate-400">Valor a Venta</span>
              </div>
              <div className="text-2xl font-bold text-emerald-400">{formatCurrency(metricas.valorVenta)}</div>
              <div className="text-xs text-slate-500 mt-1">{productos.length} productos</div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-purple-400" />
                <span className="text-sm text-slate-400">Margen Bruto</span>
              </div>
              <div className="text-2xl font-bold text-purple-400">{formatCurrency(metricas.margenBruto)}</div>
              <div className={`text-xs mt-1 ${metricas.margenPorcentaje >= 20 ? 'text-emerald-400' : metricas.margenPorcentaje >= 10 ? 'text-amber-400' : 'text-red-400'}`}>
                {formatPercent(metricas.margenPorcentaje)}
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-5 w-5 text-amber-400" />
                <span className="text-sm text-slate-400">Margen Promedio</span>
              </div>
              <div className={`text-2xl font-bold ${metricas.margenPromedio >= 20 ? 'text-emerald-400' : metricas.margenPromedio >= 10 ? 'text-amber-400' : 'text-red-400'}`}>
                {formatPercent(metricas.margenPromedio)}
              </div>
              <div className="text-xs text-slate-500 mt-1">Por producto</div>
            </div>
          </div>

          {/* Alertas y tendencia */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Alertas de margen */}
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                Alertas de Margen
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 rounded-lg bg-red-500/10">
                  <span className="text-sm text-red-400">Margen negativo</span>
                  <span className="font-bold text-red-400">{metricas.alertasNegativos}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-red-500/5">
                  <span className="text-sm text-red-300">Margen crítico (&lt;5%)</span>
                  <span className="font-bold text-red-300">{metricas.alertasCriticos}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/10">
                  <span className="text-sm text-amber-400">Margen bajo (&lt;15%)</span>
                  <span className="font-bold text-amber-400">{metricas.alertasBajos}</span>
                </div>
              </div>
              {metricas.alertasMargen.length > 0 && (
                <button 
                  onClick={() => { setTabActiva('productos'); setVistaProductos('alertas'); }}
                  className="w-full mt-3 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
                >
                  Ver productos con alertas
                </button>
              )}
            </div>

            {/* Tendencia de costos */}
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                <Trend className="h-4 w-4 text-purple-400" />
                Tendencia de Costos
              </h3>
              <div className={`text-3xl font-bold ${metricas.tendenciaCostos > 0 ? 'text-red-400' : metricas.tendenciaCostos < 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                {metricas.tendenciaCostos > 0 ? '+' : ''}{formatPercent(metricas.tendenciaCostos)}
              </div>
              <div className="text-xs text-slate-500 mt-1">Últimos 30 días vs anteriores</div>
              <div className={`flex items-center gap-1 mt-2 text-sm ${metricas.tendenciaCostos > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {metricas.tendenciaCostos > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                {metricas.tendenciaCostos > 0 ? 'Costos subiendo' : 'Costos estables/bajando'}
              </div>
            </div>

            {/* Costos indirectos */}
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                <Truck className="h-4 w-4 text-orange-400" />
                Costos Indirectos
              </h3>
              <div className="text-2xl font-bold text-orange-400">{formatCurrency(metricas.totalCostosIndirectos)}</div>
              <div className="text-xs text-slate-500 mt-1">{costosIndirectos.filter(c => c.activo).length} conceptos activos</div>
              <button 
                onClick={() => setTabActiva('indirectos')}
                className="w-full mt-3 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
              >
                Gestionar indirectos
              </button>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Análisis ABC */}
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-400 mb-4 flex items-center gap-2">
                <PieChart className="h-4 w-4 text-cyan-400" />
                Análisis ABC
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={datosABC}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {datosABC.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                    />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4">
                {datosABC.map(d => (
                  <div key={d.name} className="text-center p-2 rounded-lg" style={{ backgroundColor: d.color + '20' }}>
                    <div className="font-bold" style={{ color: d.color }}>{d.cantidad}</div>
                    <div className="text-xs text-slate-400">{d.name}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Margen por categoría */}
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-400 mb-4 flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-purple-400" />
                Margen por Categoría
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={datosMargenPorCategoria} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                    <YAxis dataKey="categoria" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} width={100} />
                    <Tooltip
                      formatter={(value: number) => `${value.toFixed(1)}%`}
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                    />
                    <Bar dataKey="margen" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Tendencia mensual */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-400 mb-4 flex items-center gap-2">
              <LineChart className="h-4 w-4 text-emerald-400" />
              Evolución de Costos (últimos 12 meses)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={tendenciaCostosMensual}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="mes" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                  />
                  <Area type="monotone" dataKey="costoPromedio" stroke="#10b981" fill="#10b98130" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top productos por valor */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-400 mb-4 flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-400" />
              Top 10 Productos por Valor en Stock
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {productos.slice(0, 10).map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-xl">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    i === 0 ? 'bg-amber-500 text-slate-900' :
                    i === 1 ? 'bg-slate-400 text-slate-900' :
                    i === 2 ? 'bg-amber-700 text-white' :
                    'bg-slate-700 text-slate-300'
                  }`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-slate-200 truncate">{p.codigo}</div>
                    <div className="text-xs text-slate-500 truncate">{p.descripcion}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-cyan-400">{formatCurrency(p.valorStock || 0)}</div>
                    <div className={`text-xs ${CLASIFICACION_ABC[p.clasificacionABC || 'C'].color}`}>
                      {CLASIFICACION_ABC[p.clasificacionABC || 'C'].label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================== PRODUCTOS ==================== */}
      {tabActiva === 'productos' && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar código o descripción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100 w-full"
              />
            </div>
            <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}
              className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100">
              <option value="todas">Todas las categorías</option>
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filtroABC} onChange={(e) => setFiltroABC(e.target.value as any)}
              className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100">
              <option value="todos">Todas las clases</option>
              <option value="A">Clase A</option>
              <option value="B">Clase B</option>
              <option value="C">Clase C</option>
            </select>
            <select value={ordenarPor} onChange={(e) => setOrdenarPor(e.target.value as any)}
              className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100">
              <option value="valor">Mayor valor</option>
              <option value="margen">Menor margen</option>
              <option value="stock">Mayor stock</option>
              <option value="codigo">Código</option>
            </select>
            <div className="flex gap-1 ml-auto">
              {(['tabla', 'alertas'] as const).map(v => (
                <button key={v} onClick={() => setVistaProductos(v)}
                  className={`px-3 py-2 rounded-lg text-sm ${vistaProductos === v ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {v === 'alertas' ? `Alertas (${metricas.alertasMargen.length})` : 'Tabla'}
                </button>
              ))}
            </div>
          </div>

          {/* Vista Tabla */}
          {vistaProductos === 'tabla' && (
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Código</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Descripción</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Costo</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Precio</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Margen</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Stock</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Valor</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">ABC</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {productosFiltrados.slice(0, 100).map(p => (
                      <tr key={p.id} className="hover:bg-slate-800/30 cursor-pointer" onClick={() => { setProductoSeleccionado(p); setModalType('detalle_producto'); }}>
                        <td className="px-4 py-3 font-mono text-sm text-slate-200">{p.codigo}</td>
                        <td className="px-4 py-3 text-sm text-slate-300 truncate max-w-[200px]">{p.descripcion}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-slate-400">{formatCurrency(p.costoPromedio || p.costo)}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-slate-200">{formatCurrency(p.precio)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-mono text-sm ${(p.margenPorcentaje || 0) < 0 ? 'text-red-400' : (p.margenPorcentaje || 0) < 10 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {formatPercent(p.margenPorcentaje || 0)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-slate-300">{p.stock}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-cyan-400">{formatCurrency(p.valorStock || 0)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${CLASIFICACION_ABC[p.clasificacionABC || 'C'].bg} ${CLASIFICACION_ABC[p.clasificacionABC || 'C'].color}`}>
                            {p.clasificacionABC}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button className="p-1.5 hover:bg-slate-700 rounded-lg">
                            <Eye className="h-4 w-4 text-slate-400" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 bg-slate-800/30 text-sm text-slate-500">
                Mostrando {Math.min(100, productosFiltrados.length)} de {productosFiltrados.length} productos
              </div>
            </div>
          )}

          {/* Vista Alertas */}
          {vistaProductos === 'alertas' && (
            <div className="space-y-4">
              {(['negativo', 'critico', 'bajo'] as const).map(tipo => {
                const alertas = metricas.alertasMargen.filter(a => a.tipo === tipo);
                if (alertas.length === 0) return null;
                const config = ALERTA_MARGEN[tipo];
                return (
                  <div key={tipo} className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                    <div className={`p-3 ${config.bg} flex justify-between items-center`}>
                      <span className={`font-medium ${config.color}`}>{config.label}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${config.bg} ${config.color}`}>{alertas.length}</span>
                    </div>
                    <div className="divide-y divide-slate-800/50">
                      {alertas.slice(0, 20).map(a => (
                        <div key={a.producto.id} className="p-3 flex justify-between items-center hover:bg-slate-800/30 cursor-pointer"
                          onClick={() => { setProductoSeleccionado(a.producto); setModalType('detalle_producto'); }}>
                          <div>
                            <div className="font-mono text-sm text-slate-200">{a.producto.codigo}</div>
                            <div className="text-xs text-slate-500 truncate max-w-[300px]">{a.producto.descripcion}</div>
                          </div>
                          <div className="text-right">
                            <div className={`font-mono font-bold ${config.color}`}>{formatPercent(a.margenPorcentaje)}</div>
                            <div className="text-xs text-slate-500">C: {formatCurrency(a.producto.costoPromedio || a.producto.costo)} → P: {formatCurrency(a.producto.precio)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {metricas.alertasMargen.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 text-emerald-400" />
                  <p>Todos los productos tienen márgenes saludables</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================== LOTES FIFO ==================== */}
      {tabActiva === 'lotes' && (
        <div className="space-y-6">
          {/* KPIs de lotes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Layers className="h-5 w-5 text-cyan-400" />
                <span className="text-sm text-slate-400">Total Lotes</span>
              </div>
              <div className="text-2xl font-bold text-slate-200">{lotes.length}</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="text-sm text-slate-400">Unidades en Lotes</div>
              <div className="text-2xl font-bold text-slate-200">
                {lotes.reduce((sum, l) => sum + l.cantidad_disponible, 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="text-sm text-slate-400">Costo Promedio</div>
              <div className="text-2xl font-bold text-emerald-400">
                {formatCurrency(lotes.length > 0 
                  ? lotes.reduce((sum, l) => sum + l.costo_unitario, 0) / lotes.length 
                  : 0
                )}
              </div>
            </div>
          </div>

          

          {/* Tabla de lotes */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Código</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Fecha Compra</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Proveedor</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Cantidad</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Costo Unit.</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Valor Lote</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Factura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {lotes
                    .filter(l => !searchTerm || l.codigo.toLowerCase().includes(searchTerm.toLowerCase()))
                    .slice(0, 100)
                    .map((lote, idx) => (
                    <tr key={lote.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {idx === 0 || lotes[idx - 1]?.codigo !== lote.codigo ? (
                            <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded">FIFO</span>
                          ) : null}
                          <span className="font-mono text-sm text-slate-200">{lote.codigo}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">{formatDate(lote.fecha_compra)}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{lote.proveedor_nombre || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-sm text-slate-200">{lote.cantidad_disponible}</span>
                        <span className="text-slate-500 text-xs">/{lote.cantidad_inicial}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-cyan-400">
                        {formatCurrency(lote.costo_unitario)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-slate-200">
                        {formatCurrency(lote.cantidad_disponible * lote.costo_unitario)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">{lote.numero_factura || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== HISTORIAL ==================== */}
      {tabActiva === 'historial' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar por código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100 w-full max-w-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Historial de Precios */}
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl">
              <div className="p-4 border-b border-slate-800">
                <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-emerald-400" />
                  Historial de Precios
                </h3>
              </div>
              <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-800/50">
                {historialPrecios
                  .filter(h => !searchTerm || h.codigo.toLowerCase().includes(searchTerm.toLowerCase()))
                  .slice(0, 50)
                  .map(h => (
                  <div key={h.id} className="p-3 hover:bg-slate-800/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-sm font-medium text-slate-200">{h.codigo}</span>
                      <span className="text-xs text-slate-500">{formatDate(h.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-400 line-through">{formatCurrency(h.valor_anterior)}</span>
                      <ArrowRight className="h-3 w-3 text-slate-600" />
                      <span className="text-sm font-medium text-slate-200">{formatCurrency(h.valor_nuevo)}</span>
                      <span className={`text-xs font-medium ${h.variacion > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {h.variacion > 0 ? '+' : ''}{formatPercent(h.variacion_porcentaje)}
                      </span>
                    </div>
                    {h.motivo && <div className="text-xs text-slate-500 mt-1">{h.motivo}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Historial de Costos */}
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl">
              <div className="p-4 border-b border-slate-800">
                <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                  <Layers className="h-5 w-5 text-cyan-400" />
                  Historial de Costos
                </h3>
              </div>
              <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-800/50">
                {historialCostos
                  .filter(h => !searchTerm || h.codigo.toLowerCase().includes(searchTerm.toLowerCase()))
                  .slice(0, 50)
                  .map(h => (
                  <div key={h.id} className="p-3 hover:bg-slate-800/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-sm font-medium text-slate-200">{h.codigo}</span>
                      <span className="text-xs text-slate-500">{formatDate(h.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-400 line-through">{formatCurrency(h.costo_anterior)}</span>
                      <ArrowRight className="h-3 w-3 text-slate-600" />
                      <span className="text-sm font-medium text-cyan-400">{formatCurrency(h.costo_nuevo)}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {h.cantidad > 0 && `${h.cantidad} uds • `}
                      {h.proveedor_nombre || 'Sin proveedor'}
                      {h.numero_factura && ` • Fact: ${h.numero_factura}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SIMULADOR ==================== */}
      {tabActiva === 'simulador' && (
        <div className="space-y-6">
          {/* Panel de configuración */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Calculator className="h-5 w-5 text-purple-400" />
              Simulador de Precios
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Tipo de ajuste</label>
                <select
                  value={simuladorForm.tipo}
                  onChange={(e) => setSimuladorForm({ ...simuladorForm, tipo: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                >
                  <option value="porcentaje">Porcentaje (+/-)</option>
                  <option value="fijo">Monto fijo (+/-)</option>
                  <option value="margen_objetivo">Margen objetivo (%)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  {simuladorForm.tipo === 'margen_objetivo' ? 'Margen objetivo (%)' : 'Valor'}
                </label>
                <input
                  type="number"
                  value={simuladorForm.valor}
                  onChange={(e) => setSimuladorForm({ ...simuladorForm, valor: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  step={simuladorForm.tipo === 'fijo' ? '0.01' : '1'}
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Aplicar a</label>
                <select
                  value={simuladorForm.aplicaA}
                  onChange={(e) => setSimuladorForm({ ...simuladorForm, aplicaA: e.target.value as any, filtroId: '' })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                >
                  <option value="todos">Todos los productos</option>
                  <option value="categoria">Por categoría</option>
                  <option value="producto">Producto específico</option>
                </select>
              </div>
              
              {simuladorForm.aplicaA === 'categoria' && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Categoría</label>
                  <select
                    value={simuladorForm.filtroId}
                    onChange={(e) => setSimuladorForm({ ...simuladorForm, filtroId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  >
                    <option value="">Seleccionar...</option>
                    {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
              
              {simuladorForm.aplicaA === 'producto' && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Producto</label>
                  <select
                    value={simuladorForm.filtroId}
                    onChange={(e) => setSimuladorForm({ ...simuladorForm, filtroId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  >
                    <option value="">Seleccionar...</option>
                    {productos.slice(0, 100).map(p => (
                      <option key={p.id} value={p.id}>{p.codigo} - {p.descripcion}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Resultados de simulación */}
          {resultadosSimulacion.length > 0 && (
            <>
              {/* Resumen */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                  <div className="text-sm text-slate-400">Productos afectados</div>
                  <div className="text-2xl font-bold text-slate-200">{resultadosSimulacion.length}</div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                  <div className="text-sm text-slate-400">Variación promedio</div>
                  <div className={`text-2xl font-bold ${
                    resultadosSimulacion.reduce((s, r) => s + r.diferenciaPct, 0) / resultadosSimulacion.length > 0 
                      ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {formatPercent(resultadosSimulacion.reduce((s, r) => s + r.diferenciaPct, 0) / resultadosSimulacion.length)}
                  </div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                  <div className="text-sm text-slate-400">Margen actual promedio</div>
                  <div className="text-2xl font-bold text-slate-300">
                    {formatPercent(resultadosSimulacion.reduce((s, r) => s + r.margenActualPct, 0) / resultadosSimulacion.length)}
                  </div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                  <div className="text-sm text-slate-400">Margen nuevo promedio</div>
                  <div className="text-2xl font-bold text-purple-400">
                    {formatPercent(resultadosSimulacion.reduce((s, r) => s + r.margenNuevoPct, 0) / resultadosSimulacion.length)}
                  </div>
                </div>
              </div>

              {/* Tabla de simulación */}
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-800/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Código</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Costo</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Precio Actual</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Precio Nuevo</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Diferencia</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Margen Actual</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Margen Nuevo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {resultadosSimulacion.slice(0, 50).map(r => (
                        <tr key={r.producto.id} className="hover:bg-slate-800/30">
                          <td className="px-4 py-3">
                            <div className="font-mono text-sm text-slate-200">{r.producto.codigo}</div>
                            <div className="text-xs text-slate-500 truncate max-w-[150px]">{r.producto.descripcion}</div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm text-slate-400">
                            {formatCurrency(r.costoTotal)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm text-slate-300">
                            {formatCurrency(r.precioActual)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm font-medium text-purple-400">
                            {formatCurrency(r.precioNuevo)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-mono text-sm ${r.diferencia > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {r.diferencia > 0 ? '+' : ''}{formatCurrency(r.diferencia)}
                            </span>
                            <div className={`text-xs ${r.diferenciaPct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {r.diferenciaPct > 0 ? '+' : ''}{formatPercent(r.diferenciaPct)}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm text-slate-400">
                            {formatPercent(r.margenActualPct)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-mono text-sm font-medium ${
                              r.margenNuevoPct < 0 ? 'text-red-400' :
                              r.margenNuevoPct < 10 ? 'text-amber-400' :
                              'text-emerald-400'
                            }`}>
                              {formatPercent(r.margenNuevoPct)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Botón aplicar */}
              <div className="flex justify-end">
                <button
                  onClick={() => setModalType('confirmar_simulacion')}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium flex items-center gap-2"
                >
                  <Zap className="h-4 w-4" />
                  Aplicar cambios a {resultadosSimulacion.length} productos
                </button>
              </div>
            </>
          )}

          {simuladorForm.valor === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Calculator className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Configure los parámetros para ver la simulación</p>
            </div>
          )}
        </div>
      )}

      {/* Continúa en parte 6... */}
      {/* ==================== ACTUALIZACIÓN MASIVA ==================== */}
      {tabActiva === 'masivo' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Actualización por porcentaje/fijo */}
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <Percent className="h-5 w-5 text-amber-400" />
                Actualización Masiva
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Campo a actualizar</label>
                  <select
                    value={actualizacionMasivaForm.campo}
                    onChange={(e) => setActualizacionMasivaForm({ ...actualizacionMasivaForm, campo: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  >
                    <option value="precio">Precio de venta</option>
                    <option value="costo">Costo</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Tipo</label>
                    <select
                      value={actualizacionMasivaForm.tipo}
                      onChange={(e) => setActualizacionMasivaForm({ ...actualizacionMasivaForm, tipo: e.target.value as any })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                    >
                      <option value="porcentaje">Porcentaje</option>
                      <option value="fijo">Monto fijo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Valor</label>
                    <input
                      type="number"
                      value={actualizacionMasivaForm.valor}
                      onChange={(e) => setActualizacionMasivaForm({ ...actualizacionMasivaForm, valor: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                      placeholder={actualizacionMasivaForm.tipo === 'porcentaje' ? 'Ej: 10 para +10%' : 'Ej: 100'}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Aplicar a</label>
                  <select
                    value={actualizacionMasivaForm.aplicaA}
                    onChange={(e) => setActualizacionMasivaForm({ ...actualizacionMasivaForm, aplicaA: e.target.value as any, filtroId: '' })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  >
                    <option value="todos">Todos los productos</option>
                    <option value="categoria">Por categoría</option>
                    <option value="proveedor">Por proveedor</option>
                  </select>
                </div>

                {actualizacionMasivaForm.aplicaA === 'categoria' && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Categoría</label>
                    <select
                      value={actualizacionMasivaForm.filtroId}
                      onChange={(e) => setActualizacionMasivaForm({ ...actualizacionMasivaForm, filtroId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                    >
                      <option value="">Seleccionar...</option>
                      {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}

                {actualizacionMasivaForm.aplicaA === 'proveedor' && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Proveedor</label>
                    <select
                      value={actualizacionMasivaForm.filtroId}
                      onChange={(e) => setActualizacionMasivaForm({ ...actualizacionMasivaForm, filtroId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                    >
                      <option value="">Seleccionar...</option>
                      {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                )}

                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <div className="flex items-center gap-2 text-amber-400 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    <span>
                      {actualizacionMasivaForm.tipo === 'porcentaje' 
                        ? `Se aplicará ${actualizacionMasivaForm.valor > 0 ? '+' : ''}${actualizacionMasivaForm.valor}% al ${actualizacionMasivaForm.campo}`
                        : `Se sumará ${formatCurrency(actualizacionMasivaForm.valor)} al ${actualizacionMasivaForm.campo}`
                      }
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setModalType('confirmar_masivo')}
                  disabled={actualizacionMasivaForm.valor === 0}
                  className="w-full px-4 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl font-medium"
                >
                  Previsualizar cambios
                </button>
              </div>
            </div>

            {/* Importar CSV */}
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <Upload className="h-5 w-5 text-cyan-400" />
                Importar desde CSV
              </h3>
              
              <div className="space-y-4">
                <div className="p-4 border-2 border-dashed border-slate-700 rounded-xl text-center">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-slate-500" />
                  <p className="text-sm text-slate-400 mb-2">Arrastra un archivo CSV o haz clic para seleccionar</p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => e.target.files?.[0] && importarCostosCSV(e.target.files[0])}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label
                    htmlFor="csv-upload"
                    className="inline-block px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
                  >
                    Seleccionar archivo
                  </label>
                </div>

                <div className="p-3 bg-slate-800/50 rounded-xl text-sm text-slate-400">
                  <p className="font-medium text-slate-300 mb-2">Formato esperado:</p>
                  <code className="block bg-slate-900 p-2 rounded text-xs">
                    codigo,costo,precio<br/>
                    PROD001,100.50,150.00<br/>
                    PROD002,200.00,300.00
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== COSTOS INDIRECTOS ==================== */}
      {tabActiva === 'indirectos' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-slate-200">Costos Indirectos</h3>
              <p className="text-sm text-slate-400">Flete, seguros, comisiones y otros costos adicionales</p>
            </div>
            <button
              onClick={() => setModalType('nuevo_indirecto')}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl"
            >
              <Plus className="h-4 w-4" />
              Nuevo Costo
            </button>
          </div>

          {/* Lista de costos indirectos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {costosIndirectos.map(costo => (
              <div 
                key={costo.id} 
                className={`p-4 rounded-xl border ${
                  costo.activo 
                    ? 'bg-slate-900/50 border-slate-800/50' 
                    : 'bg-slate-900/30 border-slate-800/30 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-slate-200">{costo.nombre}</h4>
                    <p className="text-xs text-slate-500">
                      Aplica a: {costo.aplicaA === 'todos' ? 'Todos' : costo.filtroNombre || costo.aplicaA}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => toggleCostoIndirecto(costo)}
                      className={`p-1.5 rounded-lg ${costo.activo ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}
                    >
                      {costo.activo ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => eliminarCostoIndirecto(costo.id)}
                      className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="text-2xl font-bold text-orange-400">
                  {costo.tipo === 'porcentaje' ? `${costo.valor}%` : formatCurrency(costo.valor)}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {costo.tipo === 'porcentaje' ? 'Del costo del producto' : 'Monto fijo por unidad'}
                </div>
              </div>
            ))}

            {costosIndirectos.length === 0 && (
              <div className="col-span-full text-center py-12 text-slate-500">
                <Truck className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No hay costos indirectos configurados</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== REPORTES ==================== */}
      {tabActiva === 'reportes' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Exportar productos */}
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-cyan-500/20 rounded-xl">
                  <FileSpreadsheet className="h-6 w-6 text-cyan-400" />
                </div>
                <div>
                  <h4 className="font-medium text-slate-200">Lista de Costos</h4>
                  <p className="text-xs text-slate-500">Todos los productos con costos y márgenes</p>
                </div>
              </div>
              <button
                onClick={exportarProductosCSV}
                className="w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl flex items-center justify-center gap-2"
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </button>
            </div>

            {/* Análisis ABC */}
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-emerald-500/20 rounded-xl">
                  <PieChart className="h-6 w-6 text-emerald-400" />
                </div>
                <div>
                  <h4 className="font-medium text-slate-200">Análisis ABC</h4>
                  <p className="text-xs text-slate-500">Clasificación por valor de inventario</p>
                </div>
              </div>
              <button
                onClick={exportarAnalisisABC}
                className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center justify-center gap-2"
              >
                <Download className="h-4 w-4" />
                Exportar ABC
              </button>
            </div>

            {/* Alertas */}
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-amber-500/20 rounded-xl">
                  <AlertTriangle className="h-6 w-6 text-amber-400" />
                </div>
                <div>
                  <h4 className="font-medium text-slate-200">Alertas de Margen</h4>
                  <p className="text-xs text-slate-500">{metricas.alertasMargen.length} productos con alertas</p>
                </div>
              </div>
              <button
                onClick={() => {
                  const headers = ['Código', 'Descripción', 'Costo', 'Precio', 'Margen', 'Margen %', 'Tipo Alerta'];
                  const rows = metricas.alertasMargen.map(a => [
                    a.producto.codigo,
                    a.producto.descripcion,
                    (a.producto.costoPromedio || a.producto.costo).toFixed(2),
                    a.producto.precio.toFixed(2),
                    a.margen.toFixed(2),
                    a.margenPorcentaje.toFixed(1),
                    a.tipo,
                  ]);
                  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `alertas_margen_${new Date().toISOString().split('T')[0]}.csv`;
                  link.click();
                  toast.success('Alertas exportadas');
                }}
                className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl flex items-center justify-center gap-2"
              >
                <Download className="h-4 w-4" />
                Exportar Alertas
              </button>
            </div>

            {/* Historial de precios */}
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-purple-500/20 rounded-xl">
                  <History className="h-6 w-6 text-purple-400" />
                </div>
                <div>
                  <h4 className="font-medium text-slate-200">Historial de Precios</h4>
                  <p className="text-xs text-slate-500">Últimos {historialPrecios.length} cambios</p>
                </div>
              </div>
              <button
                onClick={() => {
                  const headers = ['Fecha', 'Código', 'Anterior', 'Nuevo', 'Variación', 'Usuario'];
                  const rows = historialPrecios.map(h => [
                    formatDate(h.created_at),
                    h.codigo,
                    h.valor_anterior.toFixed(2),
                    h.valor_nuevo.toFixed(2),
                    `${h.variacion_porcentaje.toFixed(1)}%`,
                    h.usuario || '',
                  ]);
                  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `historial_precios_${new Date().toISOString().split('T')[0]}.csv`;
                  link.click();
                  toast.success('Historial exportado');
                }}
                className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl flex items-center justify-center gap-2"
              >
                <Download className="h-4 w-4" />
                Exportar Historial
              </button>
            </div>

            {/* Lotes FIFO */}
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-blue-500/20 rounded-xl">
                  <Layers className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <h4 className="font-medium text-slate-200">Inventario FIFO</h4>
                  <p className="text-xs text-slate-500">{lotes.length} lotes activos</p>
                </div>
              </div>
              <button
                onClick={() => {
                  const headers = ['Código', 'Fecha Compra', 'Proveedor', 'Cantidad', 'Costo Unit.', 'Valor'];
                  const rows = lotes.map(l => [
                    l.codigo,
                    formatDate(l.fecha_compra),
                    l.proveedor_nombre || '',
                    `${l.cantidad_disponible}/${l.cantidad_inicial}`,
                    l.costo_unitario.toFixed(2),
                    (l.cantidad_disponible * l.costo_unitario).toFixed(2),
                  ]);
                  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `lotes_fifo_${new Date().toISOString().split('T')[0]}.csv`;
                  link.click();
                  toast.success('Lotes exportados');
                }}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center gap-2"
              >
                <Download className="h-4 w-4" />
                Exportar Lotes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODALES ==================== */}
      
      {/* Modal Nuevo Lote */}
      {modalType === 'nuevo_lote' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100">Nuevo Lote</h3>
              <button onClick={() => setModalType(null)} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Producto *</label>
                <select
                  value={loteForm.productoId}
                  onChange={(e) => setLoteForm({ ...loteForm, productoId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                >
                  <option value="">Seleccionar...</option>
                  {productos.map(p => (
                    <option key={p.id} value={p.id}>{p.codigo} - {p.descripcion}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Cantidad *</label>
                  <input
                    type="number"
                    value={loteForm.cantidad || ''}
                    onChange={(e) => setLoteForm({ ...loteForm, cantidad: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Costo Unitario *</label>
                  <input
                    type="number"
                    value={loteForm.costoUnitario || ''}
                    onChange={(e) => setLoteForm({ ...loteForm, costoUnitario: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                    step="0.01"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Proveedor</label>
                <select
                  value={loteForm.proveedorId}
                  onChange={(e) => setLoteForm({ ...loteForm, proveedorId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                >
                  <option value="">Sin proveedor</option>
                  {proveedores.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Fecha Compra</label>
                  <input
                    type="date"
                    value={loteForm.fechaCompra}
                    onChange={(e) => setLoteForm({ ...loteForm, fechaCompra: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Nº Factura</label>
                  <input
                    type="text"
                    value={loteForm.numeroFactura}
                    onChange={(e) => setLoteForm({ ...loteForm, numeroFactura: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
              </div>

              {loteForm.productoId && loteForm.cantidad > 0 && loteForm.costoUnitario > 0 && (
                <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                  <div className="text-sm text-cyan-400">Valor del lote:</div>
                  <div className="text-xl font-bold text-cyan-400">
                    {formatCurrency(loteForm.cantidad * loteForm.costoUnitario)}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={crearLote}
                disabled={procesando === 'lote'}
                className="flex-1 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl"
              >
                {procesando === 'lote' ? 'Creando...' : 'Crear Lote'}
              </button>
              <button onClick={() => setModalType(null)} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuevo Costo Indirecto */}
      {modalType === 'nuevo_indirecto' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100">Nuevo Costo Indirecto</h3>
              <button onClick={() => setModalType(null)} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={costoIndirectoForm.nombre}
                  onChange={(e) => setCostoIndirectoForm({ ...costoIndirectoForm, nombre: e.target.value })}
                  placeholder="Ej: Flete marítimo, Seguro, Comisión..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Tipo</label>
                  <select
                    value={costoIndirectoForm.tipo}
                    onChange={(e) => setCostoIndirectoForm({ ...costoIndirectoForm, tipo: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  >
                    <option value="porcentaje">Porcentaje</option>
                    <option value="fijo">Monto fijo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Valor *</label>
                  <input
                    type="number"
                    value={costoIndirectoForm.valor || ''}
                    onChange={(e) => setCostoIndirectoForm({ ...costoIndirectoForm, valor: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                    step={costoIndirectoForm.tipo === 'fijo' ? '0.01' : '0.1'}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Aplicar a</label>
                <select
                  value={costoIndirectoForm.aplicaA}
                  onChange={(e) => setCostoIndirectoForm({ ...costoIndirectoForm, aplicaA: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                >
                  <option value="todos">Todos los productos</option>
                  <option value="categoria">Por categoría</option>
                  <option value="proveedor">Por proveedor</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={guardarCostoIndirecto}
                disabled={procesando === 'indirecto'}
                className="flex-1 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-xl"
              >
                {procesando === 'indirecto' ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => setModalType(null)} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle Producto */}
      {modalType === 'detalle_producto' && productoSeleccionado && (
        <ModalDetalleProducto
          producto={productoSeleccionado}
          lotes={lotes.filter(l => l.codigo === productoSeleccionado.codigo)}
          comparativa={comparativaProveedores}
          onClose={() => { setModalType(null); setProductoSeleccionado(null); }}
          onActualizarPrecio={(precio) => actualizarPrecio(productoSeleccionado, precio)}
          onActualizarCosto={(costo) => actualizarCosto(productoSeleccionado, costo)}
        />
      )}

      {/* Modal Confirmar Masivo */}
      {modalType === 'confirmar_masivo' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100">Confirmar Actualización Masiva</h3>
              <button onClick={() => setModalType(null)} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-4">
              <div className="flex items-center gap-2 text-amber-400 mb-2">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">Esta acción no se puede deshacer</span>
              </div>
              <p className="text-sm text-slate-300">
                Se actualizará el {actualizacionMasivaForm.campo} de{' '}
                <strong>
                  {actualizacionMasivaForm.aplicaA === 'todos' 
                    ? `${productos.length} productos`
                    : actualizacionMasivaForm.aplicaA === 'categoria'
                    ? `productos en categoría "${actualizacionMasivaForm.filtroId}"`
                    : `productos del proveedor seleccionado`
                  }
                </strong>
                {' '}aplicando{' '}
                <strong>
                  {actualizacionMasivaForm.tipo === 'porcentaje'
                    ? `${actualizacionMasivaForm.valor > 0 ? '+' : ''}${actualizacionMasivaForm.valor}%`
                    : formatCurrency(actualizacionMasivaForm.valor)
                  }
                </strong>
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={ejecutarActualizacionMasiva}
                disabled={procesando === 'masivo'}
                className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl"
              >
                {procesando === 'masivo' ? 'Actualizando...' : 'Confirmar y Actualizar'}
              </button>
              <button onClick={() => setModalType(null)} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ============================================
// COMPONENTE: MODAL DETALLE PRODUCTO
// ============================================

function ModalDetalleProducto({ 
  producto, 
  lotes, 
  comparativa,
  onClose, 
  onActualizarPrecio, 
  onActualizarCosto 
}: { 
  producto: Producto;
  lotes: Lote[];
  comparativa: ComparativaProveedor[];
  onClose: () => void;
  onActualizarPrecio: (precio: number) => void;
  onActualizarCosto: (costo: number) => void;
}) {
  const [editandoPrecio, setEditandoPrecio] = useState(false);
  const [editandoCosto, setEditandoCosto] = useState(false);
  const [nuevoPrecio, setNuevoPrecio] = useState(producto.precio);
  const [nuevoCosto, setNuevoCosto] = useState(producto.costo);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full p-6 my-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-100">{producto.codigo}</h3>
            <p className="text-slate-400">{producto.descripcion}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Info principal */}
          <div className="space-y-4">
            <div className="p-4 bg-slate-800/30 rounded-xl">
              <h4 className="text-sm font-semibold text-slate-400 mb-3">Precios y Costos</h4>
              
              {/* Costo */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-400">Costo promedio:</span>
                {editandoCosto ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={nuevoCosto}
                      onChange={(e) => setNuevoCosto(parseFloat(e.target.value) || 0)}
                      className="w-28 px-2 py-1 bg-slate-800 border border-cyan-500 rounded text-right text-slate-100"
                      step="0.01"
                      autoFocus
                    />
                    <button onClick={() => { onActualizarCosto(nuevoCosto); setEditandoCosto(false); }} className="p-1 bg-cyan-600 rounded">
                      <CheckCircle className="h-4 w-4 text-white" />
                    </button>
                    <button onClick={() => setEditandoCosto(false)} className="p-1 bg-slate-700 rounded">
                      <X className="h-4 w-4 text-slate-400" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-cyan-400">{formatCurrency(producto.costoPromedio || producto.costo)}</span>
                    <button onClick={() => setEditandoCosto(true)} className="p-1 hover:bg-slate-700 rounded">
                      <Edit className="h-3 w-3 text-slate-500" />
                    </button>
                  </div>
                )}
              </div>

              {/* Precio */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-400">Precio venta:</span>
                {editandoPrecio ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={nuevoPrecio}
                      onChange={(e) => setNuevoPrecio(parseFloat(e.target.value) || 0)}
                      className="w-28 px-2 py-1 bg-slate-800 border border-emerald-500 rounded text-right text-slate-100"
                      step="0.01"
                      autoFocus
                    />
                    <button onClick={() => { onActualizarPrecio(nuevoPrecio); setEditandoPrecio(false); }} className="p-1 bg-emerald-600 rounded">
                      <CheckCircle className="h-4 w-4 text-white" />
                    </button>
                    <button onClick={() => setEditandoPrecio(false)} className="p-1 bg-slate-700 rounded">
                      <X className="h-4 w-4 text-slate-400" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-emerald-400">{formatCurrency(producto.precio)}</span>
                    <button onClick={() => setEditandoPrecio(true)} className="p-1 hover:bg-slate-700 rounded">
                      <Edit className="h-3 w-3 text-slate-500" />
                    </button>
                  </div>
                )}
              </div>

              {/* Margen */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-700">
                <span className="text-slate-400">Margen:</span>
                <span className={`font-mono font-bold ${
                  (producto.margenPorcentaje || 0) < 0 ? 'text-red-400' :
                  (producto.margenPorcentaje || 0) < 10 ? 'text-amber-400' :
                  'text-emerald-400'
                }`}>
                  {formatCurrency(producto.margen || 0)} ({formatPercent(producto.margenPorcentaje || 0)})
                </span>
              </div>
            </div>

            {/* Stock */}
            <div className="p-4 bg-slate-800/30 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Stock:</span>
                <span className="font-mono font-bold text-slate-200">{producto.stock}</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-slate-400">Valor en stock:</span>
                <span className="font-mono font-bold text-cyan-400">{formatCurrency(producto.valorStock || 0)}</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-slate-400">Clasificación:</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${CLASIFICACION_ABC[producto.clasificacionABC || 'C'].bg} ${CLASIFICACION_ABC[producto.clasificacionABC || 'C'].color}`}>
                  {CLASIFICACION_ABC[producto.clasificacionABC || 'C'].label}
                </span>
              </div>
            </div>
          </div>

          {/* Lotes y comparativa */}
          <div className="space-y-4">
            {/* Lotes FIFO */}
            <div className="p-4 bg-slate-800/30 rounded-xl">
              <h4 className="text-sm font-semibold text-slate-400 mb-3">Lotes FIFO ({lotes.length})</h4>
              {lotes.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {lotes.map((l, idx) => (
                    <div key={l.id} className={`p-2 rounded-lg ${idx === 0 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-slate-700/30'}`}>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-300">{l.cantidad_disponible} uds @ {formatCurrency(l.costo_unitario)}</span>
                        <span className="text-slate-500">{formatDate(l.fecha_compra)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Sin lotes registrados</p>
              )}
            </div>

            {/* Comparativa proveedores */}
            {comparativa.length > 0 && (
              <div className="p-4 bg-slate-800/30 rounded-xl">
                <h4 className="text-sm font-semibold text-slate-400 mb-3">Comparativa Proveedores</h4>
                <div className="space-y-2">
                  {comparativa.map((c, idx) => (
                    <div key={c.proveedor_id} className={`p-2 rounded-lg ${idx === 0 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-slate-700/30'}`}>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-300">{c.proveedor_nombre}</span>
                        <span className="font-mono text-sm text-cyan-400">{formatCurrency(c.costo_promedio)}</span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {c.cantidad_compras} compras • Último: {formatCurrency(c.ultimo_costo)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}