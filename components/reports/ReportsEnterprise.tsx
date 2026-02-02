'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText, Download, TrendingUp, TrendingDown, DollarSign, Package,
  AlertTriangle, Calendar, Loader2, BarChart3, PieChart, Filter,
  X, RefreshCw, ChevronRight, ChevronDown, FileSpreadsheet,
  Warehouse, ShoppingCart, Truck, Users, RotateCcw, CreditCard,
  Clock, Target, Layers, ArrowUpDown, CheckCircle, XCircle,
  TrendingUp as TrendUp, Box, Settings, ClipboardList, Receipt,
  Building, UserCheck, PackageCheck, Percent, Calculator, Search
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart as RechartsPie, Pie, Cell,
  LineChart, Line, AreaChart, Area, ComposedChart
} from 'recharts';

// ============================================
// TIPOS
// ============================================

type CategoriaReporte = 
  | 'inventario' | 'movimientos' | 'compras' | 'ventas' 
  | 'produccion' | 'rma' | 'financiero';

type TipoReporte =
  // Inventario
  | 'inv_valorizacion' | 'inv_abc' | 'inv_por_almacen' | 'inv_antiguedad' | 'inv_sin_movimiento' | 'inv_stock_minimo'
  // Movimientos
  | 'mov_periodo' | 'mov_por_almacen' | 'mov_transferencias' | 'mov_ajustes'
  // Compras
  | 'com_por_proveedor' | 'com_costos' | 'com_lead_times' | 'com_recepciones' | 'com_ordenes_pendientes'
  // Ventas
  | 'ven_por_cliente' | 'ven_por_producto' | 'ven_rentabilidad' | 'ven_cotizaciones' | 'ven_cuentas_cobrar'
  // Producción
  | 'pro_ensamblajes' | 'pro_eficiencia' | 'pro_consumo_materiales' | 'pro_qc'
  // RMA
  | 'rma_periodo' | 'rma_motivos' | 'rma_costos' | 'rma_tiempo_resolucion'
  // Financiero
  | 'fin_cuentas_cobrar' | 'fin_cuentas_pagar' | 'fin_flujo_caja';

type FormatoExport = 'pdf' | 'excel' | 'csv';

interface FiltrosReporte {
  fechaInicio: string;
  fechaFin: string;
  almacenId?: string;
  categoriaProducto?: string;
  proveedorId?: string;
  clienteId?: string;
  estado?: string;
}

interface ConfigReporte {
  id: TipoReporte;
  nombre: string;
  descripcion: string;
  icono: React.ReactNode;
  categoria: CategoriaReporte;
  filtrosDisponibles: string[];
  tieneGrafico: boolean;
}

interface DatosReporte {
  titulo: string;
  subtitulo?: string;
  columnas: Array<{ key: string; label: string; tipo?: 'texto' | 'numero' | 'moneda' | 'fecha' | 'porcentaje' }>;
  filas: any[];
  totales?: Record<string, number>;
  graficoData?: any[];
  graficoTipo?: 'bar' | 'line' | 'pie' | 'area' | 'composed';
  kpis?: Array<{ label: string; valor: string | number; color: string; icono?: React.ReactNode }>;
}

// ============================================
// CONFIGURACIÓN DE REPORTES
// ============================================

const REPORTES_CONFIG: ConfigReporte[] = [
  // INVENTARIO
  {
    id: 'inv_valorizacion',
    nombre: 'Valorización de Stock',
    descripcion: 'Valor total del inventario por producto y categoría',
    icono: <DollarSign className="h-5 w-5" />,
    categoria: 'inventario',
    filtrosDisponibles: ['fechas', 'almacen', 'categoria'],
    tieneGrafico: true,
  },
  {
    id: 'inv_abc',
    nombre: 'Análisis ABC / Pareto',
    descripcion: 'Clasificación de productos por valor (80/20)',
    icono: <Target className="h-5 w-5" />,
    categoria: 'inventario',
    filtrosDisponibles: ['categoria'],
    tieneGrafico: true,
  },
  {
    id: 'inv_por_almacen',
    nombre: 'Stock por Almacén',
    descripcion: 'Distribución de inventario por ubicación',
    icono: <Warehouse className="h-5 w-5" />,
    categoria: 'inventario',
    filtrosDisponibles: ['almacen', 'categoria'],
    tieneGrafico: true,
  },
  {
    id: 'inv_antiguedad',
    nombre: 'Antigüedad de Inventario',
    descripcion: 'Productos por tiempo en stock (aging)',
    icono: <Clock className="h-5 w-5" />,
    categoria: 'inventario',
    filtrosDisponibles: ['almacen', 'categoria'],
    tieneGrafico: true,
  },
  {
    id: 'inv_sin_movimiento',
    nombre: 'Productos Sin Movimiento',
    descripcion: 'Items sin rotación en período seleccionado',
    icono: <Package className="h-5 w-5" />,
    categoria: 'inventario',
    filtrosDisponibles: ['fechas', 'categoria'],
    tieneGrafico: false,
  },
  {
    id: 'inv_stock_minimo',
    nombre: 'Alertas de Stock Mínimo',
    descripcion: 'Productos bajo punto de reorden',
    icono: <AlertTriangle className="h-5 w-5" />,
    categoria: 'inventario',
    filtrosDisponibles: ['almacen', 'categoria'],
    tieneGrafico: true,
  },

  // MOVIMIENTOS
  {
    id: 'mov_periodo',
    nombre: 'Movimientos por Período',
    descripcion: 'Entradas y salidas en rango de fechas',
    icono: <ArrowUpDown className="h-5 w-5" />,
    categoria: 'movimientos',
    filtrosDisponibles: ['fechas', 'almacen', 'categoria'],
    tieneGrafico: true,
  },
  {
    id: 'mov_por_almacen',
    nombre: 'Movimientos por Almacén',
    descripcion: 'Actividad de cada ubicación',
    icono: <Warehouse className="h-5 w-5" />,
    categoria: 'movimientos',
    filtrosDisponibles: ['fechas', 'almacen'],
    tieneGrafico: true,
  },
  {
    id: 'mov_transferencias',
    nombre: 'Transferencias',
    descripcion: 'Movimientos entre almacenes',
    icono: <Truck className="h-5 w-5" />,
    categoria: 'movimientos',
    filtrosDisponibles: ['fechas', 'almacen'],
    tieneGrafico: false,
  },
  {
    id: 'mov_ajustes',
    nombre: 'Ajustes de Inventario',
    descripcion: 'Correcciones y ajustes realizados',
    icono: <Settings className="h-5 w-5" />,
    categoria: 'movimientos',
    filtrosDisponibles: ['fechas', 'almacen'],
    tieneGrafico: true,
  },

  // COMPRAS
  {
    id: 'com_por_proveedor',
    nombre: 'Compras por Proveedor',
    descripcion: 'Volumen y monto por proveedor',
    icono: <Building className="h-5 w-5" />,
    categoria: 'compras',
    filtrosDisponibles: ['fechas', 'proveedor'],
    tieneGrafico: true,
  },
  {
    id: 'com_costos',
    nombre: 'Análisis de Costos',
    descripcion: 'Evolución de precios de compra',
    icono: <TrendUp className="h-5 w-5" />,
    categoria: 'compras',
    filtrosDisponibles: ['fechas', 'proveedor', 'categoria'],
    tieneGrafico: true,
  },
  {
    id: 'com_lead_times',
    nombre: 'Lead Times',
    descripcion: 'Tiempos de entrega por proveedor',
    icono: <Clock className="h-5 w-5" />,
    categoria: 'compras',
    filtrosDisponibles: ['fechas', 'proveedor'],
    tieneGrafico: true,
  },
  {
    id: 'com_recepciones',
    nombre: 'Recepciones',
    descripcion: 'Detalle de mercadería recibida',
    icono: <PackageCheck className="h-5 w-5" />,
    categoria: 'compras',
    filtrosDisponibles: ['fechas', 'proveedor', 'almacen'],
    tieneGrafico: false,
  },
  {
    id: 'com_ordenes_pendientes',
    nombre: 'Órdenes Pendientes',
    descripcion: 'OC sin recibir completamente',
    icono: <ClipboardList className="h-5 w-5" />,
    categoria: 'compras',
    filtrosDisponibles: ['proveedor'],
    tieneGrafico: false,
  },

  // VENTAS
  {
    id: 'ven_por_cliente',
    nombre: 'Ventas por Cliente',
    descripcion: 'Ranking y detalle por cliente',
    icono: <Users className="h-5 w-5" />,
    categoria: 'ventas',
    filtrosDisponibles: ['fechas', 'cliente'],
    tieneGrafico: true,
  },
  {
    id: 'ven_por_producto',
    nombre: 'Ventas por Producto',
    descripcion: 'Productos más vendidos',
    icono: <Package className="h-5 w-5" />,
    categoria: 'ventas',
    filtrosDisponibles: ['fechas', 'categoria'],
    tieneGrafico: true,
  },
  {
    id: 'ven_rentabilidad',
    nombre: 'Rentabilidad',
    descripcion: 'Margen por producto y cliente',
    icono: <Percent className="h-5 w-5" />,
    categoria: 'ventas',
    filtrosDisponibles: ['fechas', 'categoria', 'cliente'],
    tieneGrafico: true,
  },
  {
    id: 'ven_cotizaciones',
    nombre: 'Cotizaciones',
    descripcion: 'Tasa de conversión y pipeline',
    icono: <Receipt className="h-5 w-5" />,
    categoria: 'ventas',
    filtrosDisponibles: ['fechas', 'cliente'],
    tieneGrafico: true,
  },
  {
    id: 'ven_cuentas_cobrar',
    nombre: 'Cuentas por Cobrar',
    descripcion: 'Saldos pendientes por cliente',
    icono: <CreditCard className="h-5 w-5" />,
    categoria: 'ventas',
    filtrosDisponibles: ['cliente'],
    tieneGrafico: true,
  },

  // PRODUCCIÓN
  {
    id: 'pro_ensamblajes',
    nombre: 'Ensamblajes',
    descripcion: 'Órdenes de producción completadas',
    icono: <Settings className="h-5 w-5" />,
    categoria: 'produccion',
    filtrosDisponibles: ['fechas', 'almacen'],
    tieneGrafico: true,
  },
  {
    id: 'pro_eficiencia',
    nombre: 'Eficiencia Productiva',
    descripcion: 'Variación de costos planificado vs real',
    icono: <Target className="h-5 w-5" />,
    categoria: 'produccion',
    filtrosDisponibles: ['fechas'],
    tieneGrafico: true,
  },
  {
    id: 'pro_consumo_materiales',
    nombre: 'Consumo de Materiales',
    descripcion: 'Componentes utilizados en producción',
    icono: <Layers className="h-5 w-5" />,
    categoria: 'produccion',
    filtrosDisponibles: ['fechas', 'categoria'],
    tieneGrafico: true,
  },
  {
    id: 'pro_qc',
    nombre: 'Control de Calidad',
    descripcion: 'Inspecciones y resultados QC',
    icono: <CheckCircle className="h-5 w-5" />,
    categoria: 'produccion',
    filtrosDisponibles: ['fechas'],
    tieneGrafico: true,
  },

  // RMA
  {
    id: 'rma_periodo',
    nombre: 'Devoluciones por Período',
    descripcion: 'RMAs en rango de fechas',
    icono: <RotateCcw className="h-5 w-5" />,
    categoria: 'rma',
    filtrosDisponibles: ['fechas', 'cliente'],
    tieneGrafico: true,
  },
  {
    id: 'rma_motivos',
    nombre: 'Motivos de Devolución',
    descripcion: 'Análisis de causas de RMA',
    icono: <PieChart className="h-5 w-5" />,
    categoria: 'rma',
    filtrosDisponibles: ['fechas'],
    tieneGrafico: true,
  },
  {
    id: 'rma_costos',
    nombre: 'Costos de Devoluciones',
    descripcion: 'Impacto financiero de RMAs',
    icono: <DollarSign className="h-5 w-5" />,
    categoria: 'rma',
    filtrosDisponibles: ['fechas', 'cliente'],
    tieneGrafico: true,
  },
  {
    id: 'rma_tiempo_resolucion',
    nombre: 'Tiempo de Resolución',
    descripcion: 'SLA y tiempos de proceso',
    icono: <Clock className="h-5 w-5" />,
    categoria: 'rma',
    filtrosDisponibles: ['fechas'],
    tieneGrafico: true,
  },

  // FINANCIERO
  {
    id: 'fin_cuentas_cobrar',
    nombre: 'Aging Cuentas por Cobrar',
    descripcion: 'Antigüedad de deuda de clientes',
    icono: <CreditCard className="h-5 w-5" />,
    categoria: 'financiero',
    filtrosDisponibles: ['cliente'],
    tieneGrafico: true,
  },
  {
    id: 'fin_cuentas_pagar',
    nombre: 'Aging Cuentas por Pagar',
    descripcion: 'Antigüedad de deuda a proveedores',
    icono: <Receipt className="h-5 w-5" />,
    categoria: 'financiero',
    filtrosDisponibles: ['proveedor'],
    tieneGrafico: true,
  },
  {
    id: 'fin_flujo_caja',
    nombre: 'Flujo de Caja Proyectado',
    descripcion: 'Ingresos y egresos esperados',
    icono: <TrendUp className="h-5 w-5" />,
    categoria: 'financiero',
    filtrosDisponibles: ['fechas'],
    tieneGrafico: true,
  },
];

const CATEGORIAS_CONFIG: Record<CategoriaReporte, { nombre: string; icono: React.ReactNode; color: string }> = {
  inventario: { nombre: 'Inventario', icono: <Package className="h-5 w-5" />, color: 'emerald' },
  movimientos: { nombre: 'Movimientos', icono: <ArrowUpDown className="h-5 w-5" />, color: 'blue' },
  compras: { nombre: 'Compras', icono: <ShoppingCart className="h-5 w-5" />, color: 'purple' },
  ventas: { nombre: 'Ventas', icono: <TrendUp className="h-5 w-5" />, color: 'cyan' },
  produccion: { nombre: 'Producción', icono: <Settings className="h-5 w-5" />, color: 'amber' },
  rma: { nombre: 'Devoluciones', icono: <RotateCcw className="h-5 w-5" />, color: 'red' },
  financiero: { nombre: 'Financiero', icono: <DollarSign className="h-5 w-5" />, color: 'indigo' },
};

const COLORS_CHART = ['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];

// ============================================
// HELPERS
// ============================================

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);
};

const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('es-UY').format(value);
};

const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getColorClass = (color: string) => {
  const classes: Record<string, { bg: string; border: string; text: string }> = {
    emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400' },
    blue: { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400' },
    purple: { bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-400' },
    cyan: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', text: 'text-cyan-400' },
    amber: { bg: 'bg-amber-500/20', border: 'border-amber-500/30', text: 'text-amber-400' },
    red: { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-400' },
    indigo: { bg: 'bg-indigo-500/20', border: 'border-indigo-500/30', text: 'text-indigo-400' },
  };
  return classes[color] || classes.emerald;
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
// COMPONENTE PRINCIPAL - CONTINÚA EN PARTE 2
// ============================================
// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function ReportsEnterprise() {
  const { user } = useAuth();
  const toast = useToast();

  // Estado principal
  const [loading, setLoading] = useState(false);
  const [generando, setGenerando] = useState(false);

  // Datos para filtros
  const [almacenes, setAlmacenes] = useState<Array<{ id: string; nombre: string }>>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [proveedores, setProveedores] = useState<Array<{ id: string; nombre: string }>>([]);
  const [clientes, setClientes] = useState<Array<{ id: string; nombre: string }>>([]);

  // Selección de reporte
  const [categoriaActiva, setCategoriaActiva] = useState<CategoriaReporte>('inventario');
  const [reporteSeleccionado, setReporteSeleccionado] = useState<TipoReporte | null>(null);
  const [categoriasExpandidas, setCategoriasExpandidas] = useState<Set<CategoriaReporte>>(new Set(['inventario']));

  // Filtros
  const [filtros, setFiltros] = useState<FiltrosReporte>({
    fechaInicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    fechaFin: new Date().toISOString().split('T')[0],
  });

  // Datos del reporte generado
  const [datosReporte, setDatosReporte] = useState<DatosReporte | null>(null);

  // ============================================
  // CARGAR DATOS PARA FILTROS
  // ============================================

  useEffect(() => {
    loadFiltrosData();
  }, []);

  const loadFiltrosData = async () => {
    try {
      const [almRes, provRes, cliRes, prodRes] = await Promise.all([
        supabase.from('almacenes').select('id, nombre').eq('activo', true),
        supabase.from('proveedores').select('id, nombre').eq('activo', true).order('nombre'),
        supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre'),
        supabase.from('productos').select('categoria').order('categoria'),
      ]);

      if (almRes.data) setAlmacenes(almRes.data);
      if (provRes.data) setProveedores(provRes.data);
      if (cliRes.data) setClientes(cliRes.data);
      if (prodRes.data) {
        const cats = [...new Set(prodRes.data.map(p => p.categoria).filter(Boolean))];
        setCategorias(cats);
      }
    } catch (error) {
      console.error('Error loading filter data:', error);
    }
  };

  // ============================================
  // OBTENER CONFIG DEL REPORTE SELECCIONADO
  // ============================================

  const configReporte = useMemo(() => {
    return REPORTES_CONFIG.find(r => r.id === reporteSeleccionado);
  }, [reporteSeleccionado]);

  // ============================================
  // GENERADORES DE REPORTES
  // ============================================

  const generarReporte = async () => {
    if (!reporteSeleccionado) return;

    setGenerando(true);
    setDatosReporte(null);

    try {
      let datos: DatosReporte | null = null;

      switch (reporteSeleccionado) {
        // INVENTARIO
        case 'inv_valorizacion':
          datos = await generarReporteValorizacion();
          break;
        case 'inv_abc':
          datos = await generarReporteABC();
          break;
        case 'inv_por_almacen':
          datos = await generarReporteStockAlmacen();
          break;
        case 'inv_stock_minimo':
          datos = await generarReporteStockMinimo();
          break;
        case 'inv_sin_movimiento':
          datos = await generarReporteSinMovimiento();
          break;

        // MOVIMIENTOS
        case 'mov_periodo':
          datos = await generarReporteMovimientos();
          break;
        case 'mov_ajustes':
          datos = await generarReporteAjustes();
          break;

        // COMPRAS
        case 'com_por_proveedor':
          datos = await generarReporteComprasProveedor();
          break;
        case 'com_ordenes_pendientes':
          datos = await generarReporteOrdenesPendientes();
          break;

        // VENTAS
        case 'ven_por_cliente':
          datos = await generarReporteVentasCliente();
          break;
        case 'ven_por_producto':
          datos = await generarReporteVentasProducto();
          break;
        case 'ven_cuentas_cobrar':
          datos = await generarReporteCuentasCobrar();
          break;

        // PRODUCCIÓN
        case 'pro_ensamblajes':
          datos = await generarReporteEnsamblajes();
          break;
        case 'pro_eficiencia':
          datos = await generarReporteEficiencia();
          break;

        // RMA
        case 'rma_periodo':
          datos = await generarReporteRMAPeriodo();
          break;
        case 'rma_motivos':
          datos = await generarReporteRMAMotivos();
          break;

        default:
          toast.warning('Reporte no implementado', 'Este reporte estará disponible próximamente');
          return;
      }

      if (datos) {
        setDatosReporte(datos);
        toast.success('Reporte generado');
      }
    } catch (error: any) {
      console.error('Error generando reporte:', error);
      toast.error('Error al generar reporte', error.message);
    } finally {
      setGenerando(false);
    }
  };

  // ============================================
  // GENERADORES ESPECÍFICOS
  // ============================================

  // VALORIZACIÓN DE STOCK
  const generarReporteValorizacion = async (): Promise<DatosReporte> => {
    let query = supabase.from('productos').select('codigo, descripcion, categoria, stock, precio, costo_promedio');
    if (filtros.categoriaProducto) query = query.eq('categoria', filtros.categoriaProducto);

    const { data } = await query.order('descripcion');
    const productos = data || [];

    const filas = productos.map(p => ({
      codigo: p.codigo,
      descripcion: p.descripcion,
      categoria: p.categoria,
      stock: p.stock,
      costoUnitario: p.costo_promedio || p.precio,
      valorTotal: p.stock * (p.costo_promedio || p.precio),
    }));

    const valorTotal = filas.reduce((sum, f) => sum + f.valorTotal, 0);
    const totalItems = filas.reduce((sum, f) => sum + f.stock, 0);

    // Datos para gráfico por categoría
    const porCategoria: Record<string, number> = {};
    filas.forEach(f => {
      porCategoria[f.categoria || 'Sin categoría'] = (porCategoria[f.categoria || 'Sin categoría'] || 0) + f.valorTotal;
    });
    const graficoData = Object.entries(porCategoria).map(([name, value]) => ({ name, value }));

    return {
      titulo: 'Valorización de Stock',
      subtitulo: filtros.categoriaProducto ? `Categoría: ${filtros.categoriaProducto}` : 'Todas las categorías',
      columnas: [
        { key: 'codigo', label: 'Código' },
        { key: 'descripcion', label: 'Descripción' },
        { key: 'categoria', label: 'Categoría' },
        { key: 'stock', label: 'Stock', tipo: 'numero' },
        { key: 'costoUnitario', label: 'Costo Unit.', tipo: 'moneda' },
        { key: 'valorTotal', label: 'Valor Total', tipo: 'moneda' },
      ],
      filas,
      totales: { valorTotal, totalItems },
      graficoData,
      graficoTipo: 'pie',
      kpis: [
        { label: 'Valor Total', valor: formatCurrency(valorTotal), color: 'emerald' },
        { label: 'Items en Stock', valor: formatNumber(totalItems), color: 'cyan' },
        { label: 'Productos', valor: filas.length, color: 'purple' },
      ],
    };
  };

  // ANÁLISIS ABC
  const generarReporteABC = async (): Promise<DatosReporte> => {
    const { data } = await supabase.from('productos').select('codigo, descripcion, categoria, stock, precio, costo_promedio');
    const productos = (data || []).map(p => ({
      ...p,
      valorTotal: p.stock * (p.costo_promedio || p.precio),
    })).sort((a, b) => b.valorTotal - a.valorTotal);

    const valorTotal = productos.reduce((sum, p) => sum + p.valorTotal, 0);
    let acumulado = 0;

    const filas = productos.map(p => {
      acumulado += p.valorTotal;
      const porcentajeAcumulado = (acumulado / valorTotal) * 100;
      let clasificacion = 'C';
      if (porcentajeAcumulado <= 80) clasificacion = 'A';
      else if (porcentajeAcumulado <= 95) clasificacion = 'B';

      return {
        codigo: p.codigo,
        descripcion: p.descripcion,
        categoria: p.categoria,
        stock: p.stock,
        valorTotal: p.valorTotal,
        porcentaje: (p.valorTotal / valorTotal) * 100,
        acumulado: porcentajeAcumulado,
        clasificacion,
      };
    });

    const countA = filas.filter(f => f.clasificacion === 'A').length;
    const countB = filas.filter(f => f.clasificacion === 'B').length;
    const countC = filas.filter(f => f.clasificacion === 'C').length;

    const graficoData = filas.slice(0, 20).map(f => ({
      name: f.codigo,
      valor: f.valorTotal,
      acumulado: f.acumulado,
    }));

    return {
      titulo: 'Análisis ABC / Pareto',
      subtitulo: 'Clasificación de productos por valor de inventario',
      columnas: [
        { key: 'clasificacion', label: 'ABC' },
        { key: 'codigo', label: 'Código' },
        { key: 'descripcion', label: 'Descripción' },
        { key: 'stock', label: 'Stock', tipo: 'numero' },
        { key: 'valorTotal', label: 'Valor', tipo: 'moneda' },
        { key: 'porcentaje', label: '%', tipo: 'porcentaje' },
        { key: 'acumulado', label: '% Acum.', tipo: 'porcentaje' },
      ],
      filas,
      graficoData,
      graficoTipo: 'composed',
      kpis: [
        { label: 'Clase A (80%)', valor: countA, color: 'emerald' },
        { label: 'Clase B (15%)', valor: countB, color: 'amber' },
        { label: 'Clase C (5%)', valor: countC, color: 'red' },
      ],
    };
  };

  // STOCK POR ALMACÉN
  const generarReporteStockAlmacen = async (): Promise<DatosReporte> => {
    const { data: lotes } = await supabase
      .from('lotes')
      .select('producto_codigo, cantidad_disponible, almacen_id, almacenes(nombre)')
      .gt('cantidad_disponible', 0);

    const { data: productos } = await supabase.from('productos').select('codigo, descripcion, precio');
    const prodMap = new Map(productos?.map(p => [p.codigo, p]) || []);

    const porAlmacen: Record<string, { items: number; valor: number }> = {};
    
    (lotes || []).forEach((l: any) => {
      const almacen = l.almacenes?.nombre || 'Sin almacén';
      const prod = prodMap.get(l.producto_codigo);
      const valor = l.cantidad_disponible * (prod?.precio || 0);
      
      if (!porAlmacen[almacen]) porAlmacen[almacen] = { items: 0, valor: 0 };
      porAlmacen[almacen].items += l.cantidad_disponible;
      porAlmacen[almacen].valor += valor;
    });

    const filas = Object.entries(porAlmacen).map(([almacen, data]) => ({
      almacen,
      items: data.items,
      valor: data.valor,
    }));

    const graficoData = filas.map(f => ({ name: f.almacen, value: f.valor }));

    return {
      titulo: 'Stock por Almacén',
      columnas: [
        { key: 'almacen', label: 'Almacén' },
        { key: 'items', label: 'Items', tipo: 'numero' },
        { key: 'valor', label: 'Valor', tipo: 'moneda' },
      ],
      filas,
      totales: {
        totalItems: filas.reduce((s, f) => s + f.items, 0),
        valorTotal: filas.reduce((s, f) => s + f.valor, 0),
      },
      graficoData,
      graficoTipo: 'pie',
      kpis: [
        { label: 'Almacenes', valor: filas.length, color: 'purple' },
        { label: 'Total Items', valor: formatNumber(filas.reduce((s, f) => s + f.items, 0)), color: 'cyan' },
        { label: 'Valor Total', valor: formatCurrency(filas.reduce((s, f) => s + f.valor, 0)), color: 'emerald' },
      ],
    };
  };

  // STOCK MÍNIMO
  const generarReporteStockMinimo = async (): Promise<DatosReporte> => {
    const { data } = await supabase
      .from('productos')
      .select('codigo, descripcion, categoria, stock, stock_minimo, precio')
      .gt('stock_minimo', 0);

    const filas = (data || [])
      .filter(p => p.stock <= p.stock_minimo)
      .map(p => ({
        codigo: p.codigo,
        descripcion: p.descripcion,
        categoria: p.categoria,
        stock: p.stock,
        stockMinimo: p.stock_minimo,
        diferencia: p.stock - p.stock_minimo,
        estado: p.stock === 0 ? 'Sin Stock' : 'Bajo',
      }))
      .sort((a, b) => a.diferencia - b.diferencia);

    const sinStock = filas.filter(f => f.stock === 0).length;
    const bajo = filas.filter(f => f.stock > 0).length;

    const graficoData = [
      { name: 'Sin Stock', value: sinStock },
      { name: 'Stock Bajo', value: bajo },
    ];

    return {
      titulo: 'Alertas de Stock Mínimo',
      subtitulo: 'Productos que requieren reposición',
      columnas: [
        { key: 'estado', label: 'Estado' },
        { key: 'codigo', label: 'Código' },
        { key: 'descripcion', label: 'Descripción' },
        { key: 'categoria', label: 'Categoría' },
        { key: 'stock', label: 'Stock', tipo: 'numero' },
        { key: 'stockMinimo', label: 'Mínimo', tipo: 'numero' },
        { key: 'diferencia', label: 'Diferencia', tipo: 'numero' },
      ],
      filas,
      graficoData,
      graficoTipo: 'pie',
      kpis: [
        { label: 'Sin Stock', valor: sinStock, color: 'red' },
        { label: 'Stock Bajo', valor: bajo, color: 'amber' },
        { label: 'Total Alertas', valor: filas.length, color: 'purple' },
      ],
    };
  };

  // SIN MOVIMIENTO
  const generarReporteSinMovimiento = async (): Promise<DatosReporte> => {
    const { data: productos } = await supabase.from('productos').select('codigo, descripcion, categoria, stock, precio');
    const { data: movimientos } = await supabase
      .from('movimientos')
      .select('codigo')
      .gte('timestamp', filtros.fechaInicio)
      .lte('timestamp', filtros.fechaFin);

    const codigosConMov = new Set(movimientos?.map(m => m.codigo) || []);
    
    const filas = (productos || [])
      .filter(p => !codigosConMov.has(p.codigo) && p.stock > 0)
      .map(p => ({
        codigo: p.codigo,
        descripcion: p.descripcion,
        categoria: p.categoria,
        stock: p.stock,
        valorInmovilizado: p.stock * p.precio,
      }));

    const valorTotal = filas.reduce((s, f) => s + f.valorInmovilizado, 0);

    return {
      titulo: 'Productos Sin Movimiento',
      subtitulo: `Período: ${formatDate(filtros.fechaInicio)} - ${formatDate(filtros.fechaFin)}`,
      columnas: [
        { key: 'codigo', label: 'Código' },
        { key: 'descripcion', label: 'Descripción' },
        { key: 'categoria', label: 'Categoría' },
        { key: 'stock', label: 'Stock', tipo: 'numero' },
        { key: 'valorInmovilizado', label: 'Valor Inmovilizado', tipo: 'moneda' },
      ],
      filas,
      kpis: [
        { label: 'Productos', valor: filas.length, color: 'amber' },
        { label: 'Valor Inmovilizado', valor: formatCurrency(valorTotal), color: 'red' },
      ],
    };
  };

  // MOVIMIENTOS POR PERÍODO
  const generarReporteMovimientos = async (): Promise<DatosReporte> => {
    let query = supabase
      .from('movimientos')
      .select('*, producto:productos(descripcion)')
      .gte('timestamp', filtros.fechaInicio)
      .lte('timestamp', `${filtros.fechaFin}T23:59:59`);

    const { data } = await query.order('timestamp', { ascending: false });

    const filas = (data || []).map((m: any) => ({
      fecha: m.timestamp,
      tipo: m.tipo,
      codigo: m.codigo,
      descripcion: m.producto?.descripcion || m.codigo,
      cantidad: m.cantidad,
      usuario: m.usuario_email || m.usuario,
      notas: m.notas,
    }));

    const entradas = filas.filter(f => f.tipo === 'entrada').reduce((s, f) => s + f.cantidad, 0);
    const salidas = filas.filter(f => f.tipo === 'salida').reduce((s, f) => s + f.cantidad, 0);

    // Agrupar por día para gráfico
    const porDia: Record<string, { entradas: number; salidas: number }> = {};
    filas.forEach(f => {
      const dia = f.fecha.split('T')[0];
      if (!porDia[dia]) porDia[dia] = { entradas: 0, salidas: 0 };
      if (f.tipo === 'entrada') porDia[dia].entradas += f.cantidad;
      else porDia[dia].salidas += f.cantidad;
    });

    const graficoData = Object.entries(porDia)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, data]) => ({
        name: fecha.slice(5),
        entradas: data.entradas,
        salidas: data.salidas,
      }));

    return {
      titulo: 'Movimientos por Período',
      subtitulo: `${formatDate(filtros.fechaInicio)} - ${formatDate(filtros.fechaFin)}`,
      columnas: [
        { key: 'fecha', label: 'Fecha', tipo: 'fecha' },
        { key: 'tipo', label: 'Tipo' },
        { key: 'codigo', label: 'Código' },
        { key: 'descripcion', label: 'Descripción' },
        { key: 'cantidad', label: 'Cantidad', tipo: 'numero' },
        { key: 'usuario', label: 'Usuario' },
      ],
      filas,
      graficoData,
      graficoTipo: 'bar',
      kpis: [
        { label: 'Total Movimientos', valor: filas.length, color: 'purple' },
        { label: 'Entradas', valor: formatNumber(entradas), color: 'emerald' },
        { label: 'Salidas', valor: formatNumber(salidas), color: 'red' },
      ],
    };
  };

  // AJUSTES DE INVENTARIO
  const generarReporteAjustes = async (): Promise<DatosReporte> => {
    const { data } = await supabase
      .from('movimientos')
      .select('*, producto:productos(descripcion)')
      .eq('tipo', 'ajuste')
      .gte('timestamp', filtros.fechaInicio)
      .lte('timestamp', `${filtros.fechaFin}T23:59:59`)
      .order('timestamp', { ascending: false });

    const filas = (data || []).map((m: any) => ({
      fecha: m.timestamp,
      codigo: m.codigo,
      descripcion: m.producto?.descripcion || m.codigo,
      cantidad: m.cantidad,
      usuario: m.usuario_email || m.usuario,
      notas: m.notas,
    }));

    const positivos = filas.filter(f => f.cantidad > 0).reduce((s, f) => s + f.cantidad, 0);
    const negativos = filas.filter(f => f.cantidad < 0).reduce((s, f) => s + Math.abs(f.cantidad), 0);

    return {
      titulo: 'Ajustes de Inventario',
      subtitulo: `${formatDate(filtros.fechaInicio)} - ${formatDate(filtros.fechaFin)}`,
      columnas: [
        { key: 'fecha', label: 'Fecha', tipo: 'fecha' },
        { key: 'codigo', label: 'Código' },
        { key: 'descripcion', label: 'Descripción' },
        { key: 'cantidad', label: 'Cantidad', tipo: 'numero' },
        { key: 'usuario', label: 'Usuario' },
        { key: 'notas', label: 'Motivo' },
      ],
      filas,
      kpis: [
        { label: 'Total Ajustes', valor: filas.length, color: 'purple' },
        { label: 'Ajustes (+)', valor: formatNumber(positivos), color: 'emerald' },
        { label: 'Ajustes (-)', valor: formatNumber(negativos), color: 'red' },
      ],
    };
  };

  // COMPRAS POR PROVEEDOR
  const generarReporteComprasProveedor = async (): Promise<DatosReporte> => {
    let query = supabase
      .from('ordenes_compra')
      .select('*, proveedor:proveedores(nombre)')
      .gte('fecha_orden', filtros.fechaInicio)
      .lte('fecha_orden', filtros.fechaFin);

    if (filtros.proveedorId) query = query.eq('proveedor_id', filtros.proveedorId);

    const { data } = await query;

    const porProveedor: Record<string, { ordenes: number; total: number }> = {};
    (data || []).forEach((oc: any) => {
      const prov = oc.proveedor?.nombre || 'Sin proveedor';
      if (!porProveedor[prov]) porProveedor[prov] = { ordenes: 0, total: 0 };
      porProveedor[prov].ordenes++;
      porProveedor[prov].total += parseFloat(oc.total) || 0;
    });

    const filas = Object.entries(porProveedor)
      .map(([proveedor, data]) => ({ proveedor, ...data }))
      .sort((a, b) => b.total - a.total);

    const graficoData = filas.slice(0, 10).map(f => ({ name: f.proveedor, value: f.total }));

    return {
      titulo: 'Compras por Proveedor',
      subtitulo: `${formatDate(filtros.fechaInicio)} - ${formatDate(filtros.fechaFin)}`,
      columnas: [
        { key: 'proveedor', label: 'Proveedor' },
        { key: 'ordenes', label: 'Órdenes', tipo: 'numero' },
        { key: 'total', label: 'Total', tipo: 'moneda' },
      ],
      filas,
      graficoData,
      graficoTipo: 'bar',
      kpis: [
        { label: 'Proveedores', valor: filas.length, color: 'purple' },
        { label: 'Total Órdenes', valor: (data || []).length, color: 'cyan' },
        { label: 'Monto Total', valor: formatCurrency(filas.reduce((s, f) => s + f.total, 0)), color: 'emerald' },
      ],
    };
  };

  // ÓRDENES PENDIENTES
  const generarReporteOrdenesPendientes = async (): Promise<DatosReporte> => {
    const { data } = await supabase
      .from('ordenes_compra')
      .select('*, proveedor:proveedores(nombre)')
      .in('estado', ['borrador', 'enviada', 'parcial'])
      .order('fecha_esperada');

    const filas = (data || []).map((oc: any) => ({
      numero: oc.numero,
      proveedor: oc.proveedor?.nombre || '-',
      estado: oc.estado,
      fechaOrden: oc.fecha_orden,
      fechaEsperada: oc.fecha_esperada,
      total: parseFloat(oc.total) || 0,
      diasPendiente: oc.fecha_esperada 
        ? Math.floor((new Date().getTime() - new Date(oc.fecha_esperada).getTime()) / (1000 * 60 * 60 * 24))
        : null,
    }));

    const atrasadas = filas.filter(f => f.diasPendiente && f.diasPendiente > 0).length;

    return {
      titulo: 'Órdenes de Compra Pendientes',
      columnas: [
        { key: 'numero', label: 'Número' },
        { key: 'proveedor', label: 'Proveedor' },
        { key: 'estado', label: 'Estado' },
        { key: 'fechaOrden', label: 'Fecha Orden', tipo: 'fecha' },
        { key: 'fechaEsperada', label: 'Fecha Esperada', tipo: 'fecha' },
        { key: 'total', label: 'Total', tipo: 'moneda' },
        { key: 'diasPendiente', label: 'Días', tipo: 'numero' },
      ],
      filas,
      kpis: [
        { label: 'Pendientes', valor: filas.length, color: 'amber' },
        { label: 'Atrasadas', valor: atrasadas, color: 'red' },
        { label: 'Monto Pendiente', valor: formatCurrency(filas.reduce((s, f) => s + f.total, 0)), color: 'purple' },
      ],
    };
  };

  // VENTAS POR CLIENTE
  const generarReporteVentasCliente = async (): Promise<DatosReporte> => {
    let query = supabase
      .from('ordenes_venta')
      .select('*, cliente:clientes(nombre)')
      .in('estado', ['confirmada', 'en_proceso', 'enviada', 'entregada'])
      .gte('fecha_orden', filtros.fechaInicio)
      .lte('fecha_orden', filtros.fechaFin);

    if (filtros.clienteId) query = query.eq('cliente_id', filtros.clienteId);

    const { data } = await query;

    const porCliente: Record<string, { ordenes: number; total: number; pagado: number }> = {};
    (data || []).forEach((ov: any) => {
      const cli = ov.cliente?.nombre || 'Sin cliente';
      if (!porCliente[cli]) porCliente[cli] = { ordenes: 0, total: 0, pagado: 0 };
      porCliente[cli].ordenes++;
      porCliente[cli].total += parseFloat(ov.total) || 0;
      porCliente[cli].pagado += parseFloat(ov.monto_pagado) || 0;
    });

    const filas = Object.entries(porCliente)
      .map(([cliente, data]) => ({ cliente, ...data, pendiente: data.total - data.pagado }))
      .sort((a, b) => b.total - a.total);

    const graficoData = filas.slice(0, 10).map(f => ({ name: f.cliente, value: f.total }));

    return {
      titulo: 'Ventas por Cliente',
      subtitulo: `${formatDate(filtros.fechaInicio)} - ${formatDate(filtros.fechaFin)}`,
      columnas: [
        { key: 'cliente', label: 'Cliente' },
        { key: 'ordenes', label: 'Órdenes', tipo: 'numero' },
        { key: 'total', label: 'Total', tipo: 'moneda' },
        { key: 'pagado', label: 'Pagado', tipo: 'moneda' },
        { key: 'pendiente', label: 'Pendiente', tipo: 'moneda' },
      ],
      filas,
      graficoData,
      graficoTipo: 'bar',
      kpis: [
        { label: 'Clientes', valor: filas.length, color: 'cyan' },
        { label: 'Total Ventas', valor: formatCurrency(filas.reduce((s, f) => s + f.total, 0)), color: 'emerald' },
        { label: 'Por Cobrar', valor: formatCurrency(filas.reduce((s, f) => s + f.pendiente, 0)), color: 'amber' },
      ],
    };
  };

  // VENTAS POR PRODUCTO
  const generarReporteVentasProducto = async (): Promise<DatosReporte> => {
    const { data: items } = await supabase
      .from('ordenes_venta_items')
      .select('*, orden:ordenes_venta(fecha_orden, estado)')
      .gte('orden.fecha_orden', filtros.fechaInicio)
      .lte('orden.fecha_orden', filtros.fechaFin);

    const porProducto: Record<string, { descripcion: string; cantidad: number; total: number }> = {};
    (items || []).forEach((i: any) => {
      if (!i.orden || !['confirmada', 'en_proceso', 'enviada', 'entregada'].includes(i.orden.estado)) return;
      
      if (!porProducto[i.producto_codigo]) {
        porProducto[i.producto_codigo] = { descripcion: i.producto_descripcion, cantidad: 0, total: 0 };
      }
      porProducto[i.producto_codigo].cantidad += i.cantidad;
      porProducto[i.producto_codigo].total += parseFloat(i.subtotal) || 0;
    });

    const filas = Object.entries(porProducto)
      .map(([codigo, data]) => ({ codigo, ...data }))
      .sort((a, b) => b.total - a.total);

    const graficoData = filas.slice(0, 10).map(f => ({ name: f.codigo, value: f.total }));

    return {
      titulo: 'Ventas por Producto',
      subtitulo: `${formatDate(filtros.fechaInicio)} - ${formatDate(filtros.fechaFin)}`,
      columnas: [
        { key: 'codigo', label: 'Código' },
        { key: 'descripcion', label: 'Descripción' },
        { key: 'cantidad', label: 'Cantidad', tipo: 'numero' },
        { key: 'total', label: 'Total', tipo: 'moneda' },
      ],
      filas,
      graficoData,
      graficoTipo: 'bar',
      kpis: [
        { label: 'Productos', valor: filas.length, color: 'purple' },
        { label: 'Unidades', valor: formatNumber(filas.reduce((s, f) => s + f.cantidad, 0)), color: 'cyan' },
        { label: 'Total', valor: formatCurrency(filas.reduce((s, f) => s + f.total, 0)), color: 'emerald' },
      ],
    };
  };

  // CUENTAS POR COBRAR
  const generarReporteCuentasCobrar = async (): Promise<DatosReporte> => {
    const { data } = await supabase
      .from('ordenes_venta')
      .select('*, cliente:clientes(nombre)')
      .in('estado_pago', ['pendiente', 'parcial'])
      .in('estado', ['confirmada', 'en_proceso', 'enviada', 'entregada']);

    const filas = (data || []).map((ov: any) => ({
      numero: ov.numero,
      cliente: ov.cliente?.nombre || '-',
      fechaOrden: ov.fecha_orden,
      total: parseFloat(ov.total) || 0,
      pagado: parseFloat(ov.monto_pagado) || 0,
      saldo: (parseFloat(ov.total) || 0) - (parseFloat(ov.monto_pagado) || 0),
      diasVencido: Math.floor((new Date().getTime() - new Date(ov.fecha_orden).getTime()) / (1000 * 60 * 60 * 24)),
    })).sort((a, b) => b.saldo - a.saldo);

    const totalPorCobrar = filas.reduce((s, f) => s + f.saldo, 0);

    // Aging
    const aging = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    filas.forEach(f => {
      if (f.diasVencido <= 30) aging['0-30'] += f.saldo;
      else if (f.diasVencido <= 60) aging['31-60'] += f.saldo;
      else if (f.diasVencido <= 90) aging['61-90'] += f.saldo;
      else aging['90+'] += f.saldo;
    });

    const graficoData = Object.entries(aging).map(([name, value]) => ({ name, value }));

    return {
      titulo: 'Cuentas por Cobrar',
      columnas: [
        { key: 'numero', label: 'Orden' },
        { key: 'cliente', label: 'Cliente' },
        { key: 'fechaOrden', label: 'Fecha', tipo: 'fecha' },
        { key: 'total', label: 'Total', tipo: 'moneda' },
        { key: 'pagado', label: 'Pagado', tipo: 'moneda' },
        { key: 'saldo', label: 'Saldo', tipo: 'moneda' },
        { key: 'diasVencido', label: 'Días', tipo: 'numero' },
      ],
      filas,
      graficoData,
      graficoTipo: 'bar',
      kpis: [
        { label: 'Por Cobrar', valor: formatCurrency(totalPorCobrar), color: 'amber' },
        { label: 'Documentos', valor: filas.length, color: 'purple' },
        { label: 'Vencidos (+90d)', valor: formatCurrency(aging['90+']), color: 'red' },
      ],
    };
  };

  // ENSAMBLAJES
  const generarReporteEnsamblajes = async (): Promise<DatosReporte> => {
    const { data } = await supabase
      .from('ensamblajes')
      .select('*')
      .gte('created_at', filtros.fechaInicio)
      .lte('created_at', `${filtros.fechaFin}T23:59:59`)
      .order('created_at', { ascending: false });

    const filas = (data || []).map((e: any) => ({
      numero: e.numero,
      producto: e.producto_descripcion || e.producto_codigo,
      cantidadPlanificada: e.cantidad_planificada,
      cantidadProducida: e.cantidad_producida || 0,
      estado: e.estado,
      costoPlan: parseFloat(e.costo_total_planificado) || 0,
      costoReal: parseFloat(e.costo_total_real) || 0,
      variacion: e.costo_total_planificado > 0 
        ? (((parseFloat(e.costo_total_real) || 0) - (parseFloat(e.costo_total_planificado) || 0)) / parseFloat(e.costo_total_planificado) * 100)
        : 0,
    }));

    const completados = filas.filter(f => f.estado === 'completado').length;
    const enProceso = filas.filter(f => f.estado === 'en_proceso').length;

    const graficoData = [
      { name: 'Completados', value: completados },
      { name: 'En Proceso', value: enProceso },
      { name: 'Planificados', value: filas.filter(f => f.estado === 'planificado').length },
    ];

    return {
      titulo: 'Ensamblajes',
      subtitulo: `${formatDate(filtros.fechaInicio)} - ${formatDate(filtros.fechaFin)}`,
      columnas: [
        { key: 'numero', label: 'Orden' },
        { key: 'producto', label: 'Producto' },
        { key: 'cantidadPlanificada', label: 'Plan.', tipo: 'numero' },
        { key: 'cantidadProducida', label: 'Prod.', tipo: 'numero' },
        { key: 'estado', label: 'Estado' },
        { key: 'costoPlan', label: 'Costo Plan', tipo: 'moneda' },
        { key: 'costoReal', label: 'Costo Real', tipo: 'moneda' },
        { key: 'variacion', label: 'Var %', tipo: 'porcentaje' },
      ],
      filas,
      graficoData,
      graficoTipo: 'pie',
      kpis: [
        { label: 'Total Órdenes', valor: filas.length, color: 'purple' },
        { label: 'Completadas', valor: completados, color: 'emerald' },
        { label: 'En Proceso', valor: enProceso, color: 'amber' },
      ],
    };
  };

  // EFICIENCIA PRODUCTIVA
  const generarReporteEficiencia = async (): Promise<DatosReporte> => {
    const { data } = await supabase
      .from('ensamblajes')
      .select('*')
      .eq('estado', 'completado')
      .gte('created_at', filtros.fechaInicio)
      .lte('created_at', `${filtros.fechaFin}T23:59:59`);

    const filas = (data || []).map((e: any) => {
      const costoPlan = parseFloat(e.costo_total_planificado) || 0;
      const costoReal = parseFloat(e.costo_total_real) || 0;
      return {
        numero: e.numero,
        producto: e.producto_descripcion || e.producto_codigo,
        cantidad: e.cantidad_producida || e.cantidad_planificada,
        costoPlan,
        costoReal,
        variacion: costoPlan > 0 ? ((costoReal - costoPlan) / costoPlan * 100) : 0,
        duracion: e.duracion_real_minutos,
      };
    });

    const variacionPromedio = filas.length > 0 
      ? filas.reduce((s, f) => s + f.variacion, 0) / filas.length 
      : 0;

    const graficoData = filas.slice(0, 15).map(f => ({
      name: f.numero,
      planificado: f.costoPlan,
      real: f.costoReal,
    }));

    return {
      titulo: 'Eficiencia Productiva',
      subtitulo: `${formatDate(filtros.fechaInicio)} - ${formatDate(filtros.fechaFin)}`,
      columnas: [
        { key: 'numero', label: 'Orden' },
        { key: 'producto', label: 'Producto' },
        { key: 'cantidad', label: 'Cantidad', tipo: 'numero' },
        { key: 'costoPlan', label: 'Costo Plan', tipo: 'moneda' },
        { key: 'costoReal', label: 'Costo Real', tipo: 'moneda' },
        { key: 'variacion', label: 'Variación %', tipo: 'porcentaje' },
      ],
      filas,
      graficoData,
      graficoTipo: 'bar',
      kpis: [
        { label: 'Completadas', valor: filas.length, color: 'emerald' },
        { label: 'Variación Prom.', valor: formatPercent(variacionPromedio), color: variacionPromedio > 5 ? 'red' : 'emerald' },
        { label: 'Costo Total', valor: formatCurrency(filas.reduce((s, f) => s + f.costoReal, 0)), color: 'purple' },
      ],
    };
  };

  // RMA POR PERÍODO
  const generarReporteRMAPeriodo = async (): Promise<DatosReporte> => {
    const { data } = await supabase
      .from('rma')
      .select('*, cliente:clientes(nombre)')
      .gte('fecha_solicitud', filtros.fechaInicio)
      .lte('fecha_solicitud', `${filtros.fechaFin}T23:59:59`)
      .order('fecha_solicitud', { ascending: false });

    const filas = (data || []).map((r: any) => ({
      numero: r.numero,
      cliente: r.cliente?.nombre || '-',
      tipo: r.tipo,
      estado: r.estado,
      fechaSolicitud: r.fecha_solicitud,
      valor: parseFloat(r.valor_productos) || 0,
      resolucion: r.resolucion_final,
    }));

    const porEstado = { solicitada: 0, aprobada: 0, completada: 0, rechazada: 0 };
    filas.forEach(f => {
      if (porEstado[f.estado as keyof typeof porEstado] !== undefined) {
        porEstado[f.estado as keyof typeof porEstado]++;
      }
    });

    const graficoData = Object.entries(porEstado).map(([name, value]) => ({ name, value }));

    return {
      titulo: 'Devoluciones (RMA)',
      subtitulo: `${formatDate(filtros.fechaInicio)} - ${formatDate(filtros.fechaFin)}`,
      columnas: [
        { key: 'numero', label: 'RMA' },
        { key: 'cliente', label: 'Cliente' },
        { key: 'tipo', label: 'Tipo' },
        { key: 'estado', label: 'Estado' },
        { key: 'fechaSolicitud', label: 'Fecha', tipo: 'fecha' },
        { key: 'valor', label: 'Valor', tipo: 'moneda' },
        { key: 'resolucion', label: 'Resolución' },
      ],
      filas,
      graficoData,
      graficoTipo: 'pie',
      kpis: [
        { label: 'Total RMAs', valor: filas.length, color: 'purple' },
        { label: 'Valor Total', valor: formatCurrency(filas.reduce((s, f) => s + f.valor, 0)), color: 'amber' },
        { label: 'Completadas', valor: porEstado.completada, color: 'emerald' },
      ],
    };
  };

  // RMA MOTIVOS
  const generarReporteRMAMotivos = async (): Promise<DatosReporte> => {
    const { data } = await supabase
      .from('rma')
      .select('tipo, valor_productos')
      .gte('fecha_solicitud', filtros.fechaInicio)
      .lte('fecha_solicitud', `${filtros.fechaFin}T23:59:59`);

    const porTipo: Record<string, { cantidad: number; valor: number }> = {};
    (data || []).forEach((r: any) => {
      const tipo = r.tipo || 'otro';
      if (!porTipo[tipo]) porTipo[tipo] = { cantidad: 0, valor: 0 };
      porTipo[tipo].cantidad++;
      porTipo[tipo].valor += parseFloat(r.valor_productos) || 0;
    });

    const filas = Object.entries(porTipo)
      .map(([tipo, data]) => ({ tipo, ...data, porcentaje: 0 }))
      .sort((a, b) => b.cantidad - a.cantidad);

    const total = filas.reduce((s, f) => s + f.cantidad, 0);
    filas.forEach(f => f.porcentaje = total > 0 ? (f.cantidad / total) * 100 : 0);

    const graficoData = filas.map(f => ({ name: f.tipo, value: f.cantidad }));

    return {
      titulo: 'Motivos de Devolución',
      subtitulo: `${formatDate(filtros.fechaInicio)} - ${formatDate(filtros.fechaFin)}`,
      columnas: [
        { key: 'tipo', label: 'Motivo' },
        { key: 'cantidad', label: 'Cantidad', tipo: 'numero' },
        { key: 'porcentaje', label: '%', tipo: 'porcentaje' },
        { key: 'valor', label: 'Valor', tipo: 'moneda' },
      ],
      filas,
      graficoData,
      graficoTipo: 'pie',
      kpis: [
        { label: 'Total RMAs', valor: total, color: 'purple' },
        { label: 'Principal', valor: filas[0]?.tipo || '-', color: 'amber' },
        { label: 'Valor Total', valor: formatCurrency(filas.reduce((s, f) => s + f.valor, 0)), color: 'red' },
      ],
    };
  };

  // ============================================
  // CONTINÚA EN PARTE 3 (RENDER)
  // ============================================
  // ============================================
  // EXPORTAR
  // ============================================

  const exportarCSV = () => {
    if (!datosReporte) return;

    const headers = datosReporte.columnas.map(c => c.label).join(',');
    const rows = datosReporte.filas.map(f => 
      datosReporte.columnas.map(c => {
        let val = f[c.key];
        if (c.tipo === 'fecha' && val) val = formatDate(val);
        if (typeof val === 'string' && val.includes(',')) val = `"${val}"`;
        return val ?? '';
      }).join(',')
    );

    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${datosReporte.titulo.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado');
  };

  const exportarExcel = async () => {
    if (!datosReporte) return;
    toast.warning('Exportando...', 'Generando archivo Excel');
    exportarCSV();
  };

  // ============================================
  // TOGGLE CATEGORÍA
  // ============================================

  const toggleCategoria = (cat: CategoriaReporte) => {
    const newSet = new Set(categoriasExpandidas);
    if (newSet.has(cat)) newSet.delete(cat);
    else newSet.add(cat);
    setCategoriasExpandidas(newSet);
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      <toast.ToastContainer />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <BarChart3 className="h-7 w-7 text-cyan-400" />
            Centro de Reportes
          </h2>
          <p className="text-slate-400 text-sm mt-1">Genera reportes detallados de todo el sistema</p>
        </div>
        {datosReporte && (
          <div className="flex gap-2">
            <button
              onClick={exportarCSV}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
            <button
              onClick={exportarExcel}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar - Selector de reportes */}
        <div className="lg:col-span-1 space-y-2">
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Reportes Disponibles
            </h3>

            <div className="space-y-1 max-h-[600px] overflow-y-auto">
              {Object.entries(CATEGORIAS_CONFIG).map(([catKey, catConfig]) => {
                const cat = catKey as CategoriaReporte;
                const reportesCat = REPORTES_CONFIG.filter(r => r.categoria === cat);
                const isExpanded = categoriasExpandidas.has(cat);
                const colorClass = getColorClass(catConfig.color);

                return (
                  <div key={cat}>
                    <button
                      onClick={() => toggleCategoria(cat)}
                      className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors ${
                        isExpanded ? `${colorClass.bg} ${colorClass.border} border` : 'hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={colorClass.text}>{catConfig.icono}</span>
                        <span className={`text-sm font-medium ${isExpanded ? colorClass.text : 'text-slate-300'}`}>
                          {catConfig.nombre}
                        </span>
                        <span className="text-xs text-slate-600">({reportesCat.length})</span>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-slate-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-500" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-1 ml-4 space-y-0.5">
                        {reportesCat.map(rep => (
                          <button
                            key={rep.id}
                            onClick={() => {
                              setReporteSeleccionado(rep.id);
                              setDatosReporte(null);
                            }}
                            className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${
                              reporteSeleccionado === rep.id
                                ? 'bg-slate-800 text-slate-100'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                            }`}
                          >
                            {rep.icono}
                            <span className="text-sm truncate">{rep.nombre}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Contenido principal */}
        <div className="lg:col-span-3 space-y-4">
          {/* Sin selección */}
          {!configReporte && (
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-12 text-center">
              <FileText className="h-16 w-16 mx-auto text-slate-700 mb-4" />
              <h3 className="text-lg font-semibold text-slate-400 mb-2">Selecciona un reporte</h3>
              <p className="text-sm text-slate-500">Elige un reporte del panel izquierdo para comenzar</p>
            </div>
          )}

          {/* Reporte seleccionado info + filtros */}
          {configReporte && (
            <>
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ${getColorClass(CATEGORIAS_CONFIG[configReporte.categoria].color).bg}`}>
                      {configReporte.icono}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-100">{configReporte.nombre}</h3>
                      <p className="text-sm text-slate-500">{configReporte.descripcion}</p>
                    </div>
                  </div>
                  <button
                    onClick={generarReporte}
                    disabled={generando}
                    className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl transition-colors"
                  >
                    {generando ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Generar Reporte
                  </button>
                </div>

                {/* Filtros */}
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <div className="flex items-center gap-2 mb-3">
                    <Filter className="h-4 w-4 text-slate-500" />
                    <span className="text-sm text-slate-400">Filtros</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {configReporte.filtrosDisponibles.includes('fechas') && (
                      <>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Desde</label>
                          <input
                            type="date"
                            value={filtros.fechaInicio}
                            onChange={(e) => setFiltros({ ...filtros, fechaInicio: e.target.value })}
                            className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Hasta</label>
                          <input
                            type="date"
                            value={filtros.fechaFin}
                            onChange={(e) => setFiltros({ ...filtros, fechaFin: e.target.value })}
                            className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100"
                          />
                        </div>
                      </>
                    )}
                    {configReporte.filtrosDisponibles.includes('almacen') && (
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Almacén</label>
                        <select
                          value={filtros.almacenId || ''}
                          onChange={(e) => setFiltros({ ...filtros, almacenId: e.target.value || undefined })}
                          className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100"
                        >
                          <option value="">Todos</option>
                          {almacenes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                        </select>
                      </div>
                    )}
                    {configReporte.filtrosDisponibles.includes('categoria') && (
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Categoría</label>
                        <select
                          value={filtros.categoriaProducto || ''}
                          onChange={(e) => setFiltros({ ...filtros, categoriaProducto: e.target.value || undefined })}
                          className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100"
                        >
                          <option value="">Todas</option>
                          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    )}
                    {configReporte.filtrosDisponibles.includes('proveedor') && (
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Proveedor</label>
                        <select
                          value={filtros.proveedorId || ''}
                          onChange={(e) => setFiltros({ ...filtros, proveedorId: e.target.value || undefined })}
                          className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100"
                        >
                          <option value="">Todos</option>
                          {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select>
                      </div>
                    )}
                    {configReporte.filtrosDisponibles.includes('cliente') && (
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Cliente</label>
                        <select
                          value={filtros.clienteId || ''}
                          onChange={(e) => setFiltros({ ...filtros, clienteId: e.target.value || undefined })}
                          className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100"
                        >
                          <option value="">Todos</option>
                          {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Loading */}
              {generando && (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                </div>
              )}

              {/* Resultado del reporte */}
              {datosReporte && !generando && (
                <div className="space-y-4">
                  {/* KPIs */}
                  {datosReporte.kpis && datosReporte.kpis.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {datosReporte.kpis.map((kpi, idx) => {
                        const colorClass = getColorClass(kpi.color);
                        return (
                          <div key={idx} className={`p-4 rounded-xl border ${colorClass.bg} ${colorClass.border}`}>
                            <div className={`text-2xl font-bold ${colorClass.text}`}>{kpi.valor}</div>
                            <div className="text-sm text-slate-400">{kpi.label}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Gráfico */}
                  {datosReporte.graficoData && datosReporte.graficoData.length > 0 && (
                    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                      <h4 className="text-sm font-semibold text-slate-400 mb-4">Visualización</h4>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          {datosReporte.graficoTipo === 'pie' ? (
                            <RechartsPie>
                              <Pie
                                data={datosReporte.graficoData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                              >
                                {datosReporte.graficoData.map((_, index) => (
                                  <Cell key={index} fill={COLORS_CHART[index % COLORS_CHART.length]} />
                                ))}
                              </Pie>
                              <Tooltip 
                                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                                formatter={(value: number) => formatCurrency(value)}
                              />
                              <Legend />
                            </RechartsPie>
                          ) : datosReporte.graficoTipo === 'composed' ? (
                            <ComposedChart data={datosReporte.graficoData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                              <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                              <Legend />
                              <Bar yAxisId="left" dataKey="valor" fill="#10b981" name="Valor" />
                              <Line yAxisId="right" type="monotone" dataKey="acumulado" stroke="#f59e0b" name="% Acumulado" />
                            </ComposedChart>
                          ) : datosReporte.graficoTipo === 'line' ? (
                            <LineChart data={datosReporte.graficoData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                              <Legend />
                              <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} />
                            </LineChart>
                          ) : datosReporte.graficoTipo === 'area' ? (
                            <AreaChart data={datosReporte.graficoData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                              <Area type="monotone" dataKey="value" stroke="#10b981" fill="#10b98133" />
                            </AreaChart>
                          ) : (
                            <BarChart data={datosReporte.graficoData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                              <Legend />
                              {datosReporte.graficoData[0]?.entradas !== undefined ? (
                                <>
                                  <Bar dataKey="entradas" fill="#10b981" name="Entradas" />
                                  <Bar dataKey="salidas" fill="#ef4444" name="Salidas" />
                                </>
                              ) : datosReporte.graficoData[0]?.planificado !== undefined ? (
                                <>
                                  <Bar dataKey="planificado" fill="#8b5cf6" name="Planificado" />
                                  <Bar dataKey="real" fill="#10b981" name="Real" />
                                </>
                              ) : (
                                <Bar dataKey="value" fill="#06b6d4" name="Valor" />
                              )}
                            </BarChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Tabla de datos */}
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-slate-400">
                        {datosReporte.titulo}
                        {datosReporte.subtitulo && (
                          <span className="font-normal text-slate-500 ml-2">• {datosReporte.subtitulo}</span>
                        )}
                      </h4>
                      <span className="text-xs text-slate-500">{datosReporte.filas.length} registros</span>
                    </div>
                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                      <table className="w-full">
                        <thead className="bg-slate-800/50 sticky top-0">
                          <tr>
                            {datosReporte.columnas.map(col => (
                              <th 
                                key={col.key} 
                                className={`px-4 py-3 text-xs font-medium text-slate-400 uppercase ${
                                  col.tipo === 'numero' || col.tipo === 'moneda' || col.tipo === 'porcentaje' 
                                    ? 'text-right' : 'text-left'
                                }`}
                              >
                                {col.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {datosReporte.filas.length === 0 ? (
                            <tr>
                              <td colSpan={datosReporte.columnas.length} className="px-4 py-8 text-center text-slate-500">
                                Sin datos para mostrar
                              </td>
                            </tr>
                          ) : (
                            datosReporte.filas.map((fila, idx) => (
                              <tr key={idx} className="hover:bg-slate-800/30">
                                {datosReporte.columnas.map(col => {
                                  let valor = fila[col.key];
                                  let className = 'px-4 py-3 text-sm ';

                                  if (col.tipo === 'moneda') {
                                    valor = formatCurrency(valor || 0);
                                    className += 'text-right text-emerald-400 font-mono';
                                  } else if (col.tipo === 'numero') {
                                    valor = formatNumber(valor || 0);
                                    className += 'text-right text-slate-300 font-mono';
                                  } else if (col.tipo === 'porcentaje') {
                                    valor = formatPercent(valor || 0);
                                    className += 'text-right text-cyan-400 font-mono';
                                  } else if (col.tipo === 'fecha') {
                                    valor = valor ? formatDate(valor) : '-';
                                    className += 'text-slate-400';
                                  } else {
                                    className += 'text-slate-300';
                                  }

                                  // Colores especiales para ciertas columnas
                                  if (col.key === 'clasificacion') {
                                    if (valor === 'A') className = 'px-4 py-3 text-sm text-emerald-400 font-bold';
                                    else if (valor === 'B') className = 'px-4 py-3 text-sm text-amber-400 font-bold';
                                    else if (valor === 'C') className = 'px-4 py-3 text-sm text-red-400 font-bold';
                                  }
                                  if (col.key === 'estado') {
                                    if (['completado', 'completada', 'entregada', 'aprobado'].includes(valor)) {
                                      className = 'px-4 py-3 text-sm text-emerald-400';
                                    } else if (['pendiente', 'solicitada', 'borrador'].includes(valor)) {
                                      className = 'px-4 py-3 text-sm text-amber-400';
                                    } else if (['rechazado', 'rechazada', 'cancelada'].includes(valor)) {
                                      className = 'px-4 py-3 text-sm text-red-400';
                                    }
                                  }
                                  if (col.key === 'diferencia' && valor < 0) {
                                    className = 'px-4 py-3 text-sm text-right text-red-400 font-mono';
                                  }
                                  if (col.key === 'variacion') {
                                    const numVal = parseFloat(String(valor).replace('%', ''));
                                    if (numVal > 5) className = 'px-4 py-3 text-sm text-right text-red-400 font-mono';
                                    else if (numVal < -5) className = 'px-4 py-3 text-sm text-right text-emerald-400 font-mono';
                                  }

                                  return (
                                    <td key={col.key} className={className}>
                                      {valor ?? '-'}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))
                          )}
                        </tbody>
                        {datosReporte.totales && (
                          <tfoot className="bg-slate-800/50 border-t border-slate-700">
                            <tr>
                              <td colSpan={datosReporte.columnas.length - Object.keys(datosReporte.totales).length} className="px-4 py-3 text-sm font-semibold text-slate-400">
                                TOTALES
                              </td>
                              {Object.entries(datosReporte.totales).map(([key, val]) => (
                                <td key={key} className="px-4 py-3 text-sm font-bold text-right text-emerald-400 font-mono">
                                  {typeof val === 'number' && key.toLowerCase().includes('valor') 
                                    ? formatCurrency(val) 
                                    : formatNumber(val)}
                                </td>
                              ))}
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Sin datos aún */}
              {!datosReporte && !generando && (
                <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-12 text-center">
                  <RefreshCw className="h-12 w-12 mx-auto text-slate-700 mb-4" />
                  <p className="text-slate-500">Configura los filtros y haz clic en "Generar Reporte"</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}