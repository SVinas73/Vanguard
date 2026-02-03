'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Wrench, Car, Truck, Package, Settings, ClipboardList, Hammer,
  Plus, Search, Filter, RefreshCw, Eye, Edit, Trash2, X,
  ChevronRight, ChevronDown, ChevronLeft, Phone, Mail, Building2,
  User, FileText, Calendar, Clock, AlertTriangle, CheckCircle, XCircle,
  DollarSign, Receipt, Send, Printer, Camera, Upload, Download,
  MessageSquare, Bell, History, MoreHorizontal, ExternalLink,
  ArrowRight, ArrowLeft, Play, Pause, Check, Minus, AlertCircle,
  Shield, Tag, Hash, Barcode, MapPin, Clipboard, FileCheck,
  UserCheck, Banknote, CreditCard, PackageCheck, Truck as TruckIcon,
  RotateCcw, Archive, Star, Flag, Timer, Zap, Box, Cog,
  ClipboardCheck, ShoppingCart, BadgeCheck, CircleDot, Circle,
  GripVertical, Layers, LayoutGrid, List, Kanban
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

// ============================================
// TIPOS Y ESTADOS DEL FLUJO DE TRABAJO
// ============================================

type EstadoOrden = 
  | 'recepcion'      // Ingresado, esperando asignación
  | 'diagnostico'    // En revisión/diagnóstico
  | 'cotizacion'     // Cotización enviada, esperando respuesta
  | 'aprobado'       // Cliente aprobó, pendiente reparación
  | 'rechazado'      // Cliente rechazó cotización
  | 'en_reparacion'  // En proceso de reparación
  | 'reparado'       // Reparación completada
  | 'facturado'      // Facturado/cobrado
  | 'listo_entrega'  // Listo para entregar/enviar
  | 'entregado'      // Entregado al cliente
  | 'cancelado';     // Orden cancelada

type TipoOrden = 'garantia' | 'presupuesto' | 'mantenimiento';
type TipoEquipo = 'herramienta' | 'vehiculo' | 'maquinaria' | 'electronico' | 'electrodomestico' | 'otro';
type Prioridad = 'baja' | 'normal' | 'alta' | 'urgente';
type VistaActiva = 'kanban' | 'lista' | 'detalle';

// ============================================
// INTERFACES
// ============================================

interface Cliente {
  id: string;
  tipo: 'empresa' | 'persona';
  nombre: string;
  rut?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  contacto?: string;
  notas?: string;
}

interface OrdenTrabajo {
  id: string;
  numero: string;
  
  // Cliente
  clienteId?: string;
  cliente?: Cliente;
  clienteNombre: string;
  clienteRut?: string;
  clienteTelefono?: string;
  clienteEmail?: string;
  
  // Equipo/Item
  tipoEquipo: TipoEquipo;
  marca?: string;
  modelo?: string;
  serie?: string;
  lote?: string;
  matricula?: string;
  color?: string;
  descripcionEquipo: string;
  estadoIngreso: string; // Cómo viene el equipo
  accesorios?: string;
  
  // Orden
  tipoOrden: TipoOrden;
  prioridad: Prioridad;
  estado: EstadoOrden;
  
  // Garantía
  esGarantia: boolean;
  facturaGarantia?: string;
  fechaCompra?: string;
  
  // Problema reportado
  problemaReportado: string;
  
  // Diagnóstico
  diagnostico?: string;
  fechaDiagnostico?: string;
  tecnicoDiagnostico?: string;
  
  // Cotización
  cotizacion?: CotizacionTaller;
  cotizacionAprobada?: boolean;
  fechaRespuestaCotizacion?: string;
  
  // Reparación
  trabajoRealizado?: string;
  repuestosUsados?: RepuestoUsado[];
  tecnicoReparacion?: string;
  fechaInicioReparacion?: string;
  fechaFinReparacion?: string;
  
  // Comunicación
  clienteNotificado: boolean;
  fechaNotificacion?: string;
  medioNotificacion?: 'telefono' | 'email' | 'whatsapp';
  
  // Facturación
  facturado: boolean;
  numeroFactura?: string;
  montoTotal?: number;
  
  // Entrega
  fechaEntregaEstimada?: string;
  fechaEntregaReal?: string;
  entregadoA?: string;
  metodoEntrega?: 'retiro' | 'envio' | 'instalacion';
  
  // Metadata
  creadoPor?: string;
  asignadoA?: string;
  createdAt: string;
  updatedAt: string;
  
  // Historial
  historial?: HistorialOrden[];
  notas?: NotaOrden[];
  fotos?: FotoOrden[];
}

interface CotizacionTaller {
  id: string;
  ordenId: string;
  numero: string;
  fecha: string;
  validezDias: number;
  
  items: ItemCotizacion[];
  subtotal: number;
  descuento: number;
  impuestos: number;
  total: number;
  
  observaciones?: string;
  condiciones?: string;
  tiempoEstimado?: string;
  
  estado: 'pendiente' | 'aprobada' | 'rechazada' | 'vencida';
  creadoPor?: string;
}

interface ItemCotizacion {
  id: string;
  tipo: 'repuesto' | 'mano_obra' | 'servicio';
  productoId?: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  total: number;
  
  // Para repuestos - reserva de stock
  reservado: boolean;
  stockId?: string;
}

interface RepuestoUsado {
  id: string;
  productoId: string;
  productoNombre: string;
  cantidad: number;
  costo: number;
  lote?: string;
  // Se da de baja del stock al usar
}

interface HistorialOrden {
  id: string;
  ordenId: string;
  fecha: string;
  estadoAnterior?: EstadoOrden;
  estadoNuevo: EstadoOrden;
  accion: string;
  descripcion?: string;
  realizadoPor?: string;
}

interface NotaOrden {
  id: string;
  ordenId: string;
  fecha: string;
  tipo: 'interna' | 'cliente';
  contenido: string;
  creadoPor?: string;
}

interface FotoOrden {
  id: string;
  ordenId: string;
  url: string;
  descripcion?: string;
  momento: 'ingreso' | 'diagnostico' | 'reparacion' | 'entrega';
  fecha: string;
}

// ============================================
// CONFIGURACIÓN DE ESTADOS Y FLUJO
// ============================================

const ESTADO_CONFIG: Record<EstadoOrden, {
  label: string;
  color: string;
  bg: string;
  icon: React.ReactNode;
  siguientes: EstadoOrden[];
}> = {
  recepcion: {
    label: 'Recepción',
    color: 'text-slate-400',
    bg: 'bg-slate-500/20 border-slate-500/30',
    icon: <ClipboardList className="h-4 w-4" />,
    siguientes: ['diagnostico', 'cancelado'],
  },
  diagnostico: {
    label: 'Diagnóstico',
    color: 'text-blue-400',
    bg: 'bg-blue-500/20 border-blue-500/30',
    icon: <Search className="h-4 w-4" />,
    siguientes: ['cotizacion', 'en_reparacion', 'cancelado'], // en_reparacion si es garantía
  },
  cotizacion: {
    label: 'Cotización',
    color: 'text-amber-400',
    bg: 'bg-amber-500/20 border-amber-500/30',
    icon: <Receipt className="h-4 w-4" />,
    siguientes: ['aprobado', 'rechazado'],
  },
  aprobado: {
    label: 'Aprobado',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20 border-emerald-500/30',
    icon: <CheckCircle className="h-4 w-4" />,
    siguientes: ['en_reparacion'],
  },
  rechazado: {
    label: 'Rechazado',
    color: 'text-red-400',
    bg: 'bg-red-500/20 border-red-500/30',
    icon: <XCircle className="h-4 w-4" />,
    siguientes: ['listo_entrega', 'cancelado'],
  },
  en_reparacion: {
    label: 'En Reparación',
    color: 'text-purple-400',
    bg: 'bg-purple-500/20 border-purple-500/30',
    icon: <Wrench className="h-4 w-4" />,
    siguientes: ['reparado'],
  },
  reparado: {
    label: 'Reparado',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/20 border-cyan-500/30',
    icon: <BadgeCheck className="h-4 w-4" />,
    siguientes: ['facturado', 'listo_entrega'], // listo_entrega si es garantía
  },
  facturado: {
    label: 'Facturado',
    color: 'text-green-400',
    bg: 'bg-green-500/20 border-green-500/30',
    icon: <FileCheck className="h-4 w-4" />,
    siguientes: ['listo_entrega'],
  },
  listo_entrega: {
    label: 'Listo Entrega',
    color: 'text-orange-400',
    bg: 'bg-orange-500/20 border-orange-500/30',
    icon: <PackageCheck className="h-4 w-4" />,
    siguientes: ['entregado'],
  },
  entregado: {
    label: 'Entregado',
    color: 'text-teal-400',
    bg: 'bg-teal-500/20 border-teal-500/30',
    icon: <TruckIcon className="h-4 w-4" />,
    siguientes: [],
  },
  cancelado: {
    label: 'Cancelado',
    color: 'text-gray-400',
    bg: 'bg-gray-500/20 border-gray-500/30',
    icon: <XCircle className="h-4 w-4" />,
    siguientes: [],
  },
};

const TIPO_EQUIPO_CONFIG: Record<TipoEquipo, { label: string; icon: React.ReactNode }> = {
  herramienta: { label: 'Herramienta', icon: <Wrench className="h-4 w-4" /> },
  vehiculo: { label: 'Vehículo', icon: <Car className="h-4 w-4" /> },
  maquinaria: { label: 'Maquinaria', icon: <Cog className="h-4 w-4" /> },
  electronico: { label: 'Electrónico', icon: <Zap className="h-4 w-4" /> },
  electrodomestico: { label: 'Electrodoméstico', icon: <Box className="h-4 w-4" /> },
  otro: { label: 'Otro', icon: <Package className="h-4 w-4" /> },
};

const TIPO_ORDEN_CONFIG: Record<TipoOrden, { label: string; color: string; icon: React.ReactNode }> = {
  garantia: { label: 'Garantía', color: 'text-emerald-400', icon: <Shield className="h-4 w-4" /> },
  presupuesto: { label: 'Presupuesto', color: 'text-amber-400', icon: <Receipt className="h-4 w-4" /> },
  mantenimiento: { label: 'Mantenimiento', color: 'text-blue-400', icon: <Settings className="h-4 w-4" /> },
};

const PRIORIDAD_CONFIG: Record<Prioridad, { label: string; color: string; bg: string }> = {
  baja: { label: 'Baja', color: 'text-slate-400', bg: 'bg-slate-500/20' },
  normal: { label: 'Normal', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  alta: { label: 'Alta', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  urgente: { label: 'Urgente', color: 'text-red-400', bg: 'bg-red-500/20' },
};

// Estados para vista Kanban por rol
const COLUMNAS_KANBAN_RECEPCION: EstadoOrden[] = ['recepcion', 'diagnostico', 'cotizacion', 'aprobado', 'rechazado'];
const COLUMNAS_KANBAN_TALLER: EstadoOrden[] = ['diagnostico', 'en_reparacion', 'reparado'];
const COLUMNAS_KANBAN_ENTREGA: EstadoOrden[] = ['reparado', 'facturado', 'listo_entrega', 'entregado'];
const COLUMNAS_KANBAN_TODAS: EstadoOrden[] = ['recepcion', 'diagnostico', 'cotizacion', 'aprobado', 'en_reparacion', 'reparado', 'facturado', 'listo_entrega', 'entregado'];

// ============================================
// HELPERS
// ============================================

const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('es-UY', { 
    day: '2-digit', month: '2-digit', year: 'numeric' 
  });
};

const formatDateTime = (date: string): string => {
  return new Date(date).toLocaleString('es-UY', { 
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const formatCurrency = (value: number): string => {
  return `$ ${value.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getDiasDesde = (fecha: string): number => {
  const hoy = new Date();
  const f = new Date(fecha);
  return Math.floor((hoy.getTime() - f.getTime()) / (1000 * 60 * 60 * 24));
};

const generarNumeroOrden = (): string => {
  const año = new Date().getFullYear().toString().slice(-2);
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `OT-${año}-${random}`;
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

export default function TallerEnterprise() {
  const { user } = useAuth();
  const toast = useToast();

  // Estado principal
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);

  // Datos
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<any[]>([]); // Para repuestos
  const [tecnicos, setTecnicos] = useState<Array<{ id: string; nombre: string }>>([]);

  // UI
  const [vistaActiva, setVistaActiva] = useState<VistaActiva>('kanban');
  const [filtroEstado, setFiltroEstado] = useState<EstadoOrden | 'todos'>('todos');
  const [filtroTipo, setFiltroTipo] = useState<TipoOrden | 'todos'>('todos');
  const [filtroPrioridad, setFiltroPrioridad] = useState<Prioridad | 'todos'>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [columnasKanban, setColumnasKanban] = useState<EstadoOrden[]>(['recepcion', 'diagnostico', 'cotizacion', 'aprobado', 'en_reparacion', 'reparado', 'facturado', 'listo_entrega', 'entregado']);

  // Modales
  const [modalType, setModalType] = useState<string | null>(null);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<OrdenTrabajo | null>(null);

  // Form de ingreso
  const [ingresoForm, setIngresoForm] = useState({
    // Cliente
    clienteId: '',
    clienteNombre: '',
    clienteRut: '',
    clienteTelefono: '',
    clienteEmail: '',
    buscarCliente: '',
    
    // Equipo
    tipoEquipo: 'herramienta' as TipoEquipo,
    marca: '',
    modelo: '',
    serie: '',
    lote: '',
    matricula: '',
    color: '',
    descripcionEquipo: '',
    estadoIngreso: '',
    accesorios: '',
    
    // Orden
    tipoOrden: 'presupuesto' as TipoOrden,
    prioridad: 'normal' as Prioridad,
    
    // Garantía
    esGarantia: false,
    facturaGarantia: '',
    fechaCompra: '',
    
    // Problema
    problemaReportado: '',
  });

  // Form de diagnóstico
  const [diagnosticoForm, setDiagnosticoForm] = useState({
    diagnostico: '',
    tecnico: '',
  });

  // Form de cotización
  const [cotizacionForm, setCotizacionForm] = useState({
    items: [] as ItemCotizacion[],
    descuento: 0,
    observaciones: '',
    tiempoEstimado: '',
    validezDias: 15,
  });

  // Form de reparación
  const [reparacionForm, setReparacionForm] = useState({
    trabajoRealizado: '',
    repuestosUsados: [] as RepuestoUsado[],
    tecnico: '',
  });

  // Form de notificación
  const [notificacionForm, setNotificacionForm] = useState({
    medio: 'telefono' as 'telefono' | 'email' | 'whatsapp',
    mensaje: '',
  });

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
        loadOrdenes(),
        loadClientes(),
        loadProductos(),
        loadTecnicos(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const loadOrdenes = async () => {
    const { data } = await supabase
      .from('ordenes_taller')
      .select(`
        *,
        cliente:clientes(id, nombre, rut, telefono, email),
        cotizacion:cotizaciones_taller(*),
        repuestos:repuestos_usados_taller(*),
        historial:historial_ordenes_taller(*),
        notas:notas_ordenes_taller(*)
      `)
      .order('created_at', { ascending: false });

    if (data) {
      setOrdenes(data.map((o: any) => ({
        id: o.id,
        numero: o.numero,
        clienteId: o.cliente_id,
        cliente: o.cliente,
        clienteNombre: o.cliente_nombre,
        clienteRut: o.cliente_rut,
        clienteTelefono: o.cliente_telefono,
        clienteEmail: o.cliente_email,
        tipoEquipo: o.tipo_equipo,
        marca: o.marca,
        modelo: o.modelo,
        serie: o.serie,
        lote: o.lote,
        matricula: o.matricula,
        color: o.color,
        descripcionEquipo: o.descripcion_equipo,
        estadoIngreso: o.estado_ingreso,
        accesorios: o.accesorios,
        tipoOrden: o.tipo_orden,
        prioridad: o.prioridad || 'normal',
        estado: o.estado,
        esGarantia: o.es_garantia || false,
        facturaGarantia: o.factura_garantia,
        fechaCompra: o.fecha_compra,
        problemaReportado: o.problema_reportado,
        diagnostico: o.diagnostico,
        fechaDiagnostico: o.fecha_diagnostico,
        tecnicoDiagnostico: o.tecnico_diagnostico,
        cotizacion: o.cotizacion?.[0] ? {
          id: o.cotizacion[0].id,
          ordenId: o.cotizacion[0].orden_id,
          numero: o.cotizacion[0].numero,
          fecha: o.cotizacion[0].fecha,
          validezDias: o.cotizacion[0].validez_dias,
          items: o.cotizacion[0].items || [],
          subtotal: parseFloat(o.cotizacion[0].subtotal) || 0,
          descuento: parseFloat(o.cotizacion[0].descuento) || 0,
          impuestos: parseFloat(o.cotizacion[0].impuestos) || 0,
          total: parseFloat(o.cotizacion[0].total) || 0,
          observaciones: o.cotizacion[0].observaciones,
          tiempoEstimado: o.cotizacion[0].tiempo_estimado,
          estado: o.cotizacion[0].estado,
        } : undefined,
        cotizacionAprobada: o.cotizacion_aprobada,
        trabajoRealizado: o.trabajo_realizado,
        repuestosUsados: (o.repuestos || []).map((r: any) => ({
          id: r.id,
          productoId: r.producto_id,
          productoNombre: r.producto_nombre,
          cantidad: r.cantidad,
          costo: parseFloat(r.costo) || 0,
          lote: r.lote,
        })),
        tecnicoReparacion: o.tecnico_reparacion,
        fechaInicioReparacion: o.fecha_inicio_reparacion,
        fechaFinReparacion: o.fecha_fin_reparacion,
        clienteNotificado: o.cliente_notificado || false,
        fechaNotificacion: o.fecha_notificacion,
        medioNotificacion: o.medio_notificacion,
        facturado: o.facturado || false,
        numeroFactura: o.numero_factura,
        montoTotal: parseFloat(o.monto_total) || 0,
        fechaEntregaEstimada: o.fecha_entrega_estimada,
        fechaEntregaReal: o.fecha_entrega_real,
        entregadoA: o.entregado_a,
        metodoEntrega: o.metodo_entrega,
        creadoPor: o.creado_por,
        asignadoA: o.asignado_a,
        createdAt: o.created_at,
        updatedAt: o.updated_at,
        historial: o.historial || [],
        notas: o.notas || [],
      })));
    }
  };

  const loadClientes = async () => {
    const { data } = await supabase
      .from('clientes')
      .select('id, nombre, rut, telefono, email, direccion')
      .eq('activo', true)
      .order('nombre');

    if (data) {
      setClientes(data.map((c: any) => ({
        id: c.id,
        tipo: c.rut?.length > 12 ? 'empresa' : 'persona',
        nombre: c.nombre,
        rut: c.rut,
        telefono: c.telefono,
        email: c.email,
        direccion: c.direccion,
      })));
    }
  };

  const loadProductos = async () => {
    const { data } = await supabase
      .from('productos')
      .select('id, nombre, codigo, precio_venta, stock_actual')
      .eq('activo', true)
      .order('nombre');

    if (data) setProductos(data);
  };

  const loadTecnicos = async () => {
    // Cargar usuarios que son técnicos
    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre')
      .or('rol.eq.tecnico,rol.eq.admin');

    if (data) {
      setTecnicos(data);
    } else {
      // Si no hay tabla usuarios, usar datos de ejemplo
      setTecnicos([
        { id: '1', nombre: 'Técnico 1' },
        { id: '2', nombre: 'Técnico 2' },
      ]);
    }
  };

  // Continúa en parte 2...
  // ============================================
  // ACCIONES - CREAR ORDEN
  // ============================================

  const crearOrden = async () => {
    if (!ingresoForm.clienteNombre || !ingresoForm.descripcionEquipo || !ingresoForm.problemaReportado) {
      toast.warning('Complete los campos requeridos');
      return;
    }

    try {
      setProcesando('crear');

      const numero = generarNumeroOrden();
      const tipoOrden = ingresoForm.esGarantia ? 'garantia' : ingresoForm.tipoOrden;

      const { data, error } = await supabase.from('ordenes_taller').insert({
        numero,
        cliente_id: ingresoForm.clienteId || null,
        cliente_nombre: ingresoForm.clienteNombre,
        cliente_rut: ingresoForm.clienteRut || null,
        cliente_telefono: ingresoForm.clienteTelefono || null,
        cliente_email: ingresoForm.clienteEmail || null,
        tipo_equipo: ingresoForm.tipoEquipo,
        marca: ingresoForm.marca || null,
        modelo: ingresoForm.modelo || null,
        serie: ingresoForm.serie || null,
        lote: ingresoForm.lote || null,
        matricula: ingresoForm.matricula || null,
        color: ingresoForm.color || null,
        descripcion_equipo: ingresoForm.descripcionEquipo,
        estado_ingreso: ingresoForm.estadoIngreso || null,
        accesorios: ingresoForm.accesorios || null,
        tipo_orden: tipoOrden,
        prioridad: ingresoForm.prioridad,
        estado: 'recepcion',
        es_garantia: ingresoForm.esGarantia,
        factura_garantia: ingresoForm.esGarantia ? ingresoForm.facturaGarantia : null,
        fecha_compra: ingresoForm.esGarantia ? ingresoForm.fechaCompra : null,
        problema_reportado: ingresoForm.problemaReportado,
        cliente_notificado: false,
        facturado: false,
        creado_por: user?.email,
      }).select().single();

      if (error) throw error;

      // Registrar en historial
      await registrarHistorial(data.id, undefined, 'recepcion', 'Orden creada');

      toast.success('Orden creada', `Número: ${numero}`);
      setModalType(null);
      resetIngresoForm();
      loadOrdenes();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // ACCIONES - CAMBIAR ESTADO
  // ============================================

  const cambiarEstado = async (orden: OrdenTrabajo, nuevoEstado: EstadoOrden, datos?: any) => {
    try {
      setProcesando(orden.id);

      const updateData: any = {
        estado: nuevoEstado,
        updated_at: new Date().toISOString(),
      };

      // Agregar datos específicos según el estado
      switch (nuevoEstado) {
        case 'diagnostico':
          updateData.asignado_a = datos?.tecnico || user?.email;
          break;
        case 'en_reparacion':
          updateData.fecha_inicio_reparacion = new Date().toISOString();
          updateData.tecnico_reparacion = datos?.tecnico || user?.email;
          break;
        case 'reparado':
          updateData.fecha_fin_reparacion = new Date().toISOString();
          updateData.trabajo_realizado = datos?.trabajoRealizado;
          break;
        case 'facturado':
          updateData.facturado = true;
          updateData.numero_factura = datos?.numeroFactura;
          updateData.monto_total = datos?.montoTotal;
          break;
        case 'entregado':
          updateData.fecha_entrega_real = new Date().toISOString();
          updateData.entregado_a = datos?.entregadoA;
          updateData.metodo_entrega = datos?.metodoEntrega;
          break;
      }

      const { error } = await supabase
        .from('ordenes_taller')
        .update(updateData)
        .eq('id', orden.id);

      if (error) throw error;

      // Registrar en historial
      await registrarHistorial(orden.id, orden.estado, nuevoEstado, datos?.descripcion || `Estado cambiado a ${ESTADO_CONFIG[nuevoEstado].label}`);

      toast.success('Estado actualizado');
      loadOrdenes();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // ACCIONES - DIAGNÓSTICO
  // ============================================

  const guardarDiagnostico = async () => {
    if (!ordenSeleccionada || !diagnosticoForm.diagnostico) {
      toast.warning('Ingrese el diagnóstico');
      return;
    }

    try {
      setProcesando('diagnostico');

      const { error } = await supabase
        .from('ordenes_taller')
        .update({
          diagnostico: diagnosticoForm.diagnostico,
          fecha_diagnostico: new Date().toISOString(),
          tecnico_diagnostico: diagnosticoForm.tecnico || user?.email,
          estado: ordenSeleccionada.esGarantia ? 'en_reparacion' : 'cotizacion',
        })
        .eq('id', ordenSeleccionada.id);

      if (error) throw error;

      const nuevoEstado = ordenSeleccionada.esGarantia ? 'en_reparacion' : 'cotizacion';
      await registrarHistorial(
        ordenSeleccionada.id, 
        ordenSeleccionada.estado, 
        nuevoEstado,
        `Diagnóstico realizado: ${diagnosticoForm.diagnostico.substring(0, 100)}...`
      );

      toast.success('Diagnóstico guardado');
      setModalType(null);
      setDiagnosticoForm({ diagnostico: '', tecnico: '' });
      loadOrdenes();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // ACCIONES - COTIZACIÓN
  // ============================================

  const crearCotizacion = async () => {
    if (!ordenSeleccionada || cotizacionForm.items.length === 0) {
      toast.warning('Agregue items a la cotización');
      return;
    }

    try {
      setProcesando('cotizacion');

      const subtotal = cotizacionForm.items.reduce((s, i) => s + i.total, 0);
      const descuento = cotizacionForm.descuento;
      const impuestos = (subtotal - descuento) * 0.22; // IVA 22%
      const total = subtotal - descuento + impuestos;

      const numeroCot = `COT-${ordenSeleccionada.numero.replace('OT-', '')}`;

      // Crear cotización
      const { data: cotData, error: cotError } = await supabase
        .from('cotizaciones_taller')
        .insert({
          orden_id: ordenSeleccionada.id,
          numero: numeroCot,
          fecha: new Date().toISOString().split('T')[0],
          validez_dias: cotizacionForm.validezDias,
          items: cotizacionForm.items,
          subtotal,
          descuento,
          impuestos,
          total,
          observaciones: cotizacionForm.observaciones || null,
          tiempo_estimado: cotizacionForm.tiempoEstimado || null,
          estado: 'pendiente',
          creado_por: user?.email,
        })
        .select()
        .single();

      if (cotError) throw cotError;

      // Reservar stock de repuestos
      for (const item of cotizacionForm.items) {
        if (item.tipo === 'repuesto' && item.productoId) {
          await reservarStock(item.productoId, item.cantidad, ordenSeleccionada.id);
        }
      }

      // Actualizar orden
      await supabase
        .from('ordenes_taller')
        .update({
          estado: 'cotizacion',
        })
        .eq('id', ordenSeleccionada.id);

      await registrarHistorial(
        ordenSeleccionada.id,
        ordenSeleccionada.estado,
        'cotizacion',
        `Cotización creada: ${numeroCot} - Total: ${formatCurrency(total)}`
      );

      toast.success('Cotización creada', `Total: ${formatCurrency(total)}`);
      setModalType(null);
      setCotizacionForm({ items: [], descuento: 0, observaciones: '', tiempoEstimado: '', validezDias: 15 });
      loadOrdenes();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  const responderCotizacion = async (aprobada: boolean) => {
    if (!ordenSeleccionada) return;

    try {
      setProcesando('respuesta');

      const nuevoEstado: EstadoOrden = aprobada ? 'aprobado' : 'rechazado';

      // Actualizar cotización
      if (ordenSeleccionada.cotizacion) {
        await supabase
          .from('cotizaciones_taller')
          .update({ estado: aprobada ? 'aprobada' : 'rechazada' })
          .eq('id', ordenSeleccionada.cotizacion.id);

        // Si rechazada, liberar stock reservado
        if (!aprobada) {
          for (const item of ordenSeleccionada.cotizacion.items) {
            if (item.tipo === 'repuesto' && item.productoId && item.reservado) {
              await liberarStock(item.productoId, item.cantidad);
            }
          }
        }
      }

      // Actualizar orden
      await supabase
        .from('ordenes_taller')
        .update({
          estado: nuevoEstado,
          cotizacion_aprobada: aprobada,
          fecha_respuesta_cotizacion: new Date().toISOString(),
        })
        .eq('id', ordenSeleccionada.id);

      await registrarHistorial(
        ordenSeleccionada.id,
        ordenSeleccionada.estado,
        nuevoEstado,
        aprobada ? 'Cliente aprobó cotización' : 'Cliente rechazó cotización'
      );

      toast.success(aprobada ? 'Cotización aprobada' : 'Cotización rechazada');
      setModalType(null);
      loadOrdenes();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // ACCIONES - REPARACIÓN
  // ============================================

  const iniciarReparacion = async () => {
    if (!ordenSeleccionada) return;

    try {
      setProcesando('reparacion');

      await supabase
        .from('ordenes_taller')
        .update({
          estado: 'en_reparacion',
          fecha_inicio_reparacion: new Date().toISOString(),
          tecnico_reparacion: user?.email,
        })
        .eq('id', ordenSeleccionada.id);

      await registrarHistorial(
        ordenSeleccionada.id,
        ordenSeleccionada.estado,
        'en_reparacion',
        'Reparación iniciada'
      );

      toast.success('Reparación iniciada');
      setModalType(null);
      loadOrdenes();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  const finalizarReparacion = async () => {
    if (!ordenSeleccionada || !reparacionForm.trabajoRealizado) {
      toast.warning('Describa el trabajo realizado');
      return;
    }

    try {
      setProcesando('finalizar');

      // Dar de baja repuestos usados
      for (const repuesto of reparacionForm.repuestosUsados) {
        await darBajaStock(repuesto.productoId, repuesto.cantidad, ordenSeleccionada.id);

        // Registrar repuesto usado
        await supabase.from('repuestos_usados_taller').insert({
          orden_id: ordenSeleccionada.id,
          producto_id: repuesto.productoId,
          producto_nombre: repuesto.productoNombre,
          cantidad: repuesto.cantidad,
          costo: repuesto.costo,
          lote: repuesto.lote || null,
        });
      }

      // Actualizar orden
      await supabase
        .from('ordenes_taller')
        .update({
          estado: 'reparado',
          trabajo_realizado: reparacionForm.trabajoRealizado,
          fecha_fin_reparacion: new Date().toISOString(),
        })
        .eq('id', ordenSeleccionada.id);

      await registrarHistorial(
        ordenSeleccionada.id,
        ordenSeleccionada.estado,
        'reparado',
        `Reparación completada: ${reparacionForm.trabajoRealizado.substring(0, 100)}...`
      );

      toast.success('Reparación finalizada');
      setModalType(null);
      setReparacionForm({ trabajoRealizado: '', repuestosUsados: [], tecnico: '' });
      loadOrdenes();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // ACCIONES - NOTIFICACIÓN CLIENTE
  // ============================================

  const notificarCliente = async () => {
    if (!ordenSeleccionada) return;

    try {
      setProcesando('notificar');

      await supabase
        .from('ordenes_taller')
        .update({
          cliente_notificado: true,
          fecha_notificacion: new Date().toISOString(),
          medio_notificacion: notificacionForm.medio,
        })
        .eq('id', ordenSeleccionada.id);

      // Agregar nota
      await supabase.from('notas_ordenes_taller').insert({
        orden_id: ordenSeleccionada.id,
        tipo: 'cliente',
        contenido: `Notificación por ${notificacionForm.medio}: ${notificacionForm.mensaje}`,
        creado_por: user?.email,
      });

      await registrarHistorial(
        ordenSeleccionada.id,
        ordenSeleccionada.estado,
        ordenSeleccionada.estado,
        `Cliente notificado por ${notificacionForm.medio}`
      );

      toast.success('Cliente notificado');
      setModalType(null);
      setNotificacionForm({ medio: 'telefono', mensaje: '' });
      loadOrdenes();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // ACCIONES - FACTURACIÓN Y ENTREGA
  // ============================================

  const marcarFacturado = async (numeroFactura: string, monto: number) => {
    if (!ordenSeleccionada) return;

    try {
      setProcesando('facturar');

      await supabase
        .from('ordenes_taller')
        .update({
          estado: 'facturado',
          facturado: true,
          numero_factura: numeroFactura,
          monto_total: monto,
        })
        .eq('id', ordenSeleccionada.id);

      await registrarHistorial(
        ordenSeleccionada.id,
        ordenSeleccionada.estado,
        'facturado',
        `Facturado: ${numeroFactura} - ${formatCurrency(monto)}`
      );

      toast.success('Facturación registrada');
      setModalType(null);
      loadOrdenes();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  const marcarListoEntrega = async () => {
    if (!ordenSeleccionada) return;

    try {
      setProcesando('listo');

      await supabase
        .from('ordenes_taller')
        .update({
          estado: 'listo_entrega',
        })
        .eq('id', ordenSeleccionada.id);

      await registrarHistorial(
        ordenSeleccionada.id,
        ordenSeleccionada.estado,
        'listo_entrega',
        'Listo para entrega'
      );

      toast.success('Listo para entrega');
      loadOrdenes();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  const registrarEntrega = async (entregadoA: string, metodo: 'retiro' | 'envio' | 'instalacion') => {
    if (!ordenSeleccionada) return;

    try {
      setProcesando('entregar');

      await supabase
        .from('ordenes_taller')
        .update({
          estado: 'entregado',
          fecha_entrega_real: new Date().toISOString(),
          entregado_a: entregadoA,
          metodo_entrega: metodo,
        })
        .eq('id', ordenSeleccionada.id);

      await registrarHistorial(
        ordenSeleccionada.id,
        ordenSeleccionada.estado,
        'entregado',
        `Entregado a ${entregadoA} (${metodo})`
      );

      toast.success('Entrega registrada');
      setModalType(null);
      loadOrdenes();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // FUNCIONES AUXILIARES - STOCK
  // ============================================

  const reservarStock = async (productoId: string, cantidad: number, ordenId: string) => {
    // Crear reserva de stock
    await supabase.from('reservas_stock').insert({
      producto_id: productoId,
      cantidad,
      orden_taller_id: ordenId,
      estado: 'reservado',
    });

    // Actualizar stock disponible (no el actual)
    const producto = productos.find(p => p.id === productoId);
    if (producto) {
      await supabase
        .from('productos')
        .update({ stock_reservado: (producto.stock_reservado || 0) + cantidad })
        .eq('id', productoId);
    }
  };

  const liberarStock = async (productoId: string, cantidad: number) => {
    const producto = productos.find(p => p.id === productoId);
    if (producto) {
      await supabase
        .from('productos')
        .update({ stock_reservado: Math.max(0, (producto.stock_reservado || 0) - cantidad) })
        .eq('id', productoId);
    }
  };

  const darBajaStock = async (productoId: string, cantidad: number, ordenId: string) => {
    const producto = productos.find(p => p.id === productoId);
    if (producto) {
      await supabase
        .from('productos')
        .update({ 
          stock_actual: Math.max(0, producto.stock_actual - cantidad),
          stock_reservado: Math.max(0, (producto.stock_reservado || 0) - cantidad),
        })
        .eq('id', productoId);

      // Registrar movimiento
      await supabase.from('movimientos_inventario').insert({
        producto_id: productoId,
        tipo: 'salida',
        cantidad,
        motivo: 'uso_taller',
        referencia_tipo: 'orden_taller',
        referencia_id: ordenId,
        realizado_por: user?.email,
      });
    }
  };

  // ============================================
  // FUNCIONES AUXILIARES - HISTORIAL
  // ============================================

  const registrarHistorial = async (
    ordenId: string, 
    estadoAnterior: EstadoOrden | undefined, 
    estadoNuevo: EstadoOrden,
    descripcion: string
  ) => {
    await supabase.from('historial_ordenes_taller').insert({
      orden_id: ordenId,
      estado_anterior: estadoAnterior || null,
      estado_nuevo: estadoNuevo,
      accion: descripcion,
      realizado_por: user?.email,
    });
  };

  // ============================================
  // RESET FORMS
  // ============================================

  const resetIngresoForm = () => {
    setIngresoForm({
      clienteId: '',
      clienteNombre: '',
      clienteRut: '',
      clienteTelefono: '',
      clienteEmail: '',
      buscarCliente: '',
      tipoEquipo: 'herramienta',
      marca: '',
      modelo: '',
      serie: '',
      lote: '',
      matricula: '',
      color: '',
      descripcionEquipo: '',
      estadoIngreso: '',
      accesorios: '',
      tipoOrden: 'presupuesto',
      prioridad: 'normal',
      esGarantia: false,
      facturaGarantia: '',
      fechaCompra: '',
      problemaReportado: '',
    });
  };

  // ============================================
  // SELECCIONAR CLIENTE
  // ============================================

  const seleccionarCliente = (cliente: Cliente) => {
    setIngresoForm(prev => ({
      ...prev,
      clienteId: cliente.id,
      clienteNombre: cliente.nombre,
      clienteRut: cliente.rut || '',
      clienteTelefono: cliente.telefono || '',
      clienteEmail: cliente.email || '',
      buscarCliente: '',
    }));
  };

  // Clientes filtrados para autocompletado
  const clientesFiltrados = useMemo(() => {
    if (!ingresoForm.buscarCliente || ingresoForm.buscarCliente.length < 2) return [];
    const search = ingresoForm.buscarCliente.toLowerCase();
    return clientes.filter(c => 
      c.nombre.toLowerCase().includes(search) ||
      c.rut?.toLowerCase().includes(search)
    ).slice(0, 5);
  }, [clientes, ingresoForm.buscarCliente]);

  // Continúa en parte 3...
  // ============================================
  // MÉTRICAS
  // ============================================

  const metricas = useMemo(() => {
    const porEstado: Record<EstadoOrden, number> = {
      recepcion: 0,
      diagnostico: 0,
      cotizacion: 0,
      aprobado: 0,
      rechazado: 0,
      en_reparacion: 0,
      reparado: 0,
      facturado: 0,
      listo_entrega: 0,
      entregado: 0,
      cancelado: 0,
    };

    ordenes.forEach(o => {
      porEstado[o.estado]++;
    });

    const activas = ordenes.filter(o => !['entregado', 'cancelado'].includes(o.estado));
    const garantias = ordenes.filter(o => o.esGarantia && !['entregado', 'cancelado'].includes(o.estado));
    const pendientesNotificar = ordenes.filter(o => !o.clienteNotificado && ['reparado', 'listo_entrega'].includes(o.estado));
    const urgentes = ordenes.filter(o => o.prioridad === 'urgente' && !['entregado', 'cancelado'].includes(o.estado));

    return {
      porEstado,
      total: ordenes.length,
      activas: activas.length,
      garantias: garantias.length,
      pendientesNotificar: pendientesNotificar.length,
      urgentes: urgentes.length,
      enRecepcion: porEstado.recepcion,
      enDiagnostico: porEstado.diagnostico,
      enReparacion: porEstado.en_reparacion,
      listosEntrega: porEstado.listo_entrega,
    };
  }, [ordenes]);

  // ============================================
  // FILTROS
  // ============================================

  const ordenesFiltradas = useMemo(() => {
    return ordenes.filter(o => {
      if (filtroEstado !== 'todos' && o.estado !== filtroEstado) return false;
      if (filtroTipo !== 'todos' && o.tipoOrden !== filtroTipo) return false;
      if (filtroPrioridad !== 'todos' && o.prioridad !== filtroPrioridad) return false;
      
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (
          !o.numero.toLowerCase().includes(search) &&
          !o.clienteNombre.toLowerCase().includes(search) &&
          !o.descripcionEquipo.toLowerCase().includes(search) &&
          !(o.serie?.toLowerCase().includes(search)) &&
          !(o.matricula?.toLowerCase().includes(search))
        ) return false;
      }
      
      return true;
    });
  }, [ordenes, filtroEstado, filtroTipo, filtroPrioridad, searchTerm]);

  // Órdenes agrupadas por estado para Kanban
  const ordenesPorEstado = useMemo(() => {
    const grouped: Record<EstadoOrden, OrdenTrabajo[]> = {
      recepcion: [],
      diagnostico: [],
      cotizacion: [],
      aprobado: [],
      rechazado: [],
      en_reparacion: [],
      reparado: [],
      facturado: [],
      listo_entrega: [],
      entregado: [],
      cancelado: [],
    };

    ordenesFiltradas.forEach(o => {
      grouped[o.estado].push(o);
    });

    return grouped;
  }, [ordenesFiltradas]);

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-8 w-8 animate-spin text-orange-400" />
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
            <Wrench className="h-7 w-7 text-orange-400" />
            Taller / Servicio Técnico
          </h2>
          <p className="text-slate-400 text-sm mt-1">Gestión de órdenes de trabajo y reparaciones</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalType('nueva_orden')}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-medium"
          >
            <Plus className="h-4 w-4" />
            Nueva Orden
          </button>
          <button onClick={loadAllData} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList className="h-5 w-5 text-slate-400" />
            <span className="text-sm text-slate-400">En Recepción</span>
          </div>
          <div className="text-2xl font-bold text-slate-200">{metricas.enRecepcion}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Search className="h-5 w-5 text-blue-400" />
            <span className="text-sm text-slate-400">En Diagnóstico</span>
          </div>
          <div className="text-2xl font-bold text-blue-400">{metricas.enDiagnostico}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Wrench className="h-5 w-5 text-purple-400" />
            <span className="text-sm text-slate-400">En Reparación</span>
          </div>
          <div className="text-2xl font-bold text-purple-400">{metricas.enReparacion}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <PackageCheck className="h-5 w-5 text-orange-400" />
            <span className="text-sm text-slate-400">Listos Entrega</span>
          </div>
          <div className="text-2xl font-bold text-orange-400">{metricas.listosEntrega}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="h-5 w-5 text-amber-400" />
            <span className="text-sm text-slate-400">Sin Notificar</span>
          </div>
          <div className="text-2xl font-bold text-amber-400">{metricas.pendientesNotificar}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex flex-wrap gap-3">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar orden, cliente, equipo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100 w-64"
            />
          </div>
          
          {/* Filtro tipo */}
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value as any)}
            className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
          >
            <option value="todos">Todos los tipos</option>
            <option value="garantia">🛡️ Garantía</option>
            <option value="presupuesto">📋 Presupuesto</option>
            <option value="mantenimiento">🔧 Mantenimiento</option>
          </select>

          {/* Filtro prioridad */}
          <select
            value={filtroPrioridad}
            onChange={(e) => setFiltroPrioridad(e.target.value as any)}
            className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
          >
            <option value="todos">Todas prioridades</option>
            <option value="urgente">🔴 Urgente</option>
            <option value="alta">🟠 Alta</option>
            <option value="normal">🔵 Normal</option>
            <option value="baja">⚪ Baja</option>
          </select>
        </div>

        {/* Vista toggle */}
        <div className="flex items-center gap-1 bg-slate-900/50 p-1 rounded-xl">
          <button
            onClick={() => setVistaActiva('kanban')}
            className={`p-2 rounded-lg ${vistaActiva === 'kanban' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
            title="Vista Kanban"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setVistaActiva('lista')}
            className={`p-2 rounded-lg ${vistaActiva === 'lista' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
            title="Vista Lista"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ==================== VISTA KANBAN ==================== */}
      {vistaActiva === 'kanban' && (
        <div className="w-full">
          <div className="grid grid-cols-9 gap-2">
            {columnasKanban.map(estado => {
              const config = ESTADO_CONFIG[estado];
              const ordenesColumna = ordenesPorEstado[estado];
              
              return (
                <div key={estado} className="min-w-0">
                  {/* Header columna */}
                  <div className={`flex items-center gap-1 p-2 rounded-t-xl border-b-2 ${config.bg}`}>
                    {config.icon}
                    <span className={`font-medium text-xs truncate ${config.color}`}>{config.label}</span>
                    <span className="ml-auto bg-slate-800 px-1.5 py-0.5 rounded-full text-xs text-slate-300">
                      {ordenesColumna.length}
                    </span>
                  </div>
                  
                  {/* Cards */}
                  <div className="bg-slate-900/30 rounded-b-xl p-1.5 min-h-[400px] space-y-1.5">
                    {ordenesColumna.map(orden => (
                      <KanbanCard 
                        key={orden.id} 
                        orden={orden} 
                        onClick={() => {
                          setOrdenSeleccionada(orden);
                          setModalType('detalle');
                        }}
                      />
                    ))}
                    
                    {ordenesColumna.length === 0 && (
                      <div className="text-center py-6 text-slate-600 text-xs">
                        Sin órdenes
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== VISTA LISTA ==================== */}
      {vistaActiva === 'lista' && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Orden</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Equipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Prioridad</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {ordenesFiltradas.map(orden => {
                  const estadoConfig = ESTADO_CONFIG[orden.estado];
                  const tipoConfig = TIPO_ORDEN_CONFIG[orden.tipoOrden];
                  const prioridadConfig = PRIORIDAD_CONFIG[orden.prioridad];
                  const equipoConfig = TIPO_EQUIPO_CONFIG[orden.tipoEquipo];
                  const dias = getDiasDesde(orden.createdAt);

                  return (
                    <tr key={orden.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3">
                        <div className="font-mono text-sm text-slate-200">{orden.numero}</div>
                        <div className="text-xs text-slate-500">{dias} días</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-slate-200">{orden.clienteNombre}</div>
                        {orden.clienteTelefono && (
                          <div className="text-xs text-slate-500">{orden.clienteTelefono}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {equipoConfig.icon}
                          <div>
                            <div className="text-sm text-slate-200">{orden.descripcionEquipo}</div>
                            {orden.marca && (
                              <div className="text-xs text-slate-500">{orden.marca} {orden.modelo}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${tipoConfig.color}`}>
                          {tipoConfig.icon}
                          {tipoConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs border ${estadoConfig.bg} ${estadoConfig.color}`}>
                          {estadoConfig.icon}
                          {estadoConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs ${prioridadConfig.bg} ${prioridadConfig.color}`}>
                          {prioridadConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {formatDate(orden.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            setOrdenSeleccionada(orden);
                            setModalType('detalle');
                          }}
                          className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Continúa con modales en parte 4... */}
      {/* ==================== MODAL: NUEVA ORDEN ==================== */}
      {modalType === 'nueva_orden' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full p-6 my-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-orange-400" />
                Nueva Orden de Trabajo
              </h3>
              <button onClick={() => { setModalType(null); resetIngresoForm(); }} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
              {/* Sección: Tipo de servicio */}
              <div className="p-4 bg-slate-800/30 rounded-xl">
                <h4 className="text-sm font-semibold text-slate-400 mb-3">Tipo de Servicio</h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setIngresoForm({ ...ingresoForm, esGarantia: false, tipoOrden: 'presupuesto' })}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium ${
                      !ingresoForm.esGarantia && ingresoForm.tipoOrden === 'presupuesto'
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    <Receipt className="h-4 w-4" />
                    Para Presupuestar
                  </button>
                  <button
                    onClick={() => setIngresoForm({ ...ingresoForm, esGarantia: true, tipoOrden: 'garantia' })}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium ${
                      ingresoForm.esGarantia
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    <Shield className="h-4 w-4" />
                    Garantía
                  </button>
                  <button
                    onClick={() => setIngresoForm({ ...ingresoForm, esGarantia: false, tipoOrden: 'mantenimiento' })}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium ${
                      !ingresoForm.esGarantia && ingresoForm.tipoOrden === 'mantenimiento'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    <Settings className="h-4 w-4" />
                    Mantenimiento
                  </button>
                </div>

                {ingresoForm.esGarantia && (
                  <div className="grid grid-cols-2 gap-3 mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                    <div>
                      <label className="block text-sm text-emerald-400 mb-1">Nº Factura de Compra</label>
                      <input
                        type="text"
                        value={ingresoForm.facturaGarantia}
                        onChange={(e) => setIngresoForm({ ...ingresoForm, facturaGarantia: e.target.value })}
                        placeholder="FAC-123456"
                        className="w-full px-3 py-2 bg-slate-800 border border-emerald-500/30 rounded-xl text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-emerald-400 mb-1">Fecha de Compra</label>
                      <input
                        type="date"
                        value={ingresoForm.fechaCompra}
                        onChange={(e) => setIngresoForm({ ...ingresoForm, fechaCompra: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-emerald-500/30 rounded-xl text-slate-100"
                      />
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <label className="block text-sm text-slate-400 mb-2">Prioridad</label>
                  <div className="flex gap-2">
                    {(['baja', 'normal', 'alta', 'urgente'] as Prioridad[]).map(p => (
                      <button
                        key={p}
                        onClick={() => setIngresoForm({ ...ingresoForm, prioridad: p })}
                        className={`px-3 py-1.5 rounded-lg text-sm ${
                          ingresoForm.prioridad === p
                            ? `${PRIORIDAD_CONFIG[p].bg} ${PRIORIDAD_CONFIG[p].color} ring-2 ring-offset-2 ring-offset-slate-900`
                            : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {PRIORIDAD_CONFIG[p].label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sección: Cliente */}
              <div className="p-4 bg-slate-800/30 rounded-xl">
                <h4 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Datos del Cliente
                </h4>
                
                <div className="relative mb-4">
                  <label className="block text-sm text-slate-400 mb-1">Buscar cliente existente</label>
                  <input
                    type="text"
                    value={ingresoForm.buscarCliente}
                    onChange={(e) => setIngresoForm({ ...ingresoForm, buscarCliente: e.target.value })}
                    placeholder="Escriba nombre o RUT..."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  />
                  
                  {clientesFiltrados.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {clientesFiltrados.map(c => (
                        <button
                          key={c.id}
                          onClick={() => seleccionarCliente(c)}
                          className="w-full px-4 py-3 text-left hover:bg-slate-700 flex justify-between items-center"
                        >
                          <div>
                            <div className="text-sm text-slate-200">{c.nombre}</div>
                            <div className="text-xs text-slate-500">{c.rut} • {c.telefono}</div>
                          </div>
                          <Building2 className="h-4 w-4 text-slate-500" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm text-slate-400 mb-1">Nombre / Empresa *</label>
                    <input
                      type="text"
                      value={ingresoForm.clienteNombre}
                      onChange={(e) => setIngresoForm({ ...ingresoForm, clienteNombre: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">RUT (opcional)</label>
                    <input
                      type="text"
                      value={ingresoForm.clienteRut}
                      onChange={(e) => setIngresoForm({ ...ingresoForm, clienteRut: e.target.value })}
                      placeholder="12345678-9"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Teléfono</label>
                    <input
                      type="tel"
                      value={ingresoForm.clienteTelefono}
                      onChange={(e) => setIngresoForm({ ...ingresoForm, clienteTelefono: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm text-slate-400 mb-1">Email (opcional)</label>
                    <input
                      type="email"
                      value={ingresoForm.clienteEmail}
                      onChange={(e) => setIngresoForm({ ...ingresoForm, clienteEmail: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                    />
                  </div>
                </div>
              </div>

              {/* Sección: Equipo */}
              <div className="p-4 bg-slate-800/30 rounded-xl">
                <h4 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Datos del Equipo
                </h4>
                
                <div className="mb-4">
                  <label className="block text-sm text-slate-400 mb-2">Tipo de equipo</label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(TIPO_EQUIPO_CONFIG) as TipoEquipo[]).map(tipo => (
                      <button
                        key={tipo}
                        onClick={() => setIngresoForm({ ...ingresoForm, tipoEquipo: tipo })}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${
                          ingresoForm.tipoEquipo === tipo
                            ? 'bg-orange-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {TIPO_EQUIPO_CONFIG[tipo].icon}
                        {TIPO_EQUIPO_CONFIG[tipo].label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Marca</label>
                    <input type="text" value={ingresoForm.marca} onChange={(e) => setIngresoForm({ ...ingresoForm, marca: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Modelo</label>
                    <input type="text" value={ingresoForm.modelo} onChange={(e) => setIngresoForm({ ...ingresoForm, modelo: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Color</label>
                    <input type="text" value={ingresoForm.color} onChange={(e) => setIngresoForm({ ...ingresoForm, color: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Nº Serie</label>
                    <input type="text" value={ingresoForm.serie} onChange={(e) => setIngresoForm({ ...ingresoForm, serie: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Lote</label>
                    <input type="text" value={ingresoForm.lote} onChange={(e) => setIngresoForm({ ...ingresoForm, lote: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Matrícula / Patente</label>
                    <input type="text" value={ingresoForm.matricula} onChange={(e) => setIngresoForm({ ...ingresoForm, matricula: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-sm text-slate-400 mb-1">Descripción del equipo *</label>
                  <input type="text" value={ingresoForm.descripcionEquipo} onChange={(e) => setIngresoForm({ ...ingresoForm, descripcionEquipo: e.target.value })} placeholder="Ej: Taladro percutor 800W, Camioneta Ford Ranger..." className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                </div>

                <div className="mt-3">
                  <label className="block text-sm text-slate-400 mb-1">Estado de ingreso (cómo viene)</label>
                  <textarea value={ingresoForm.estadoIngreso} onChange={(e) => setIngresoForm({ ...ingresoForm, estadoIngreso: e.target.value })} placeholder="Ej: Carcasa rayada, falta tornillo, sin batería..." rows={2} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                </div>

                <div className="mt-3">
                  <label className="block text-sm text-slate-400 mb-1">Accesorios</label>
                  <input type="text" value={ingresoForm.accesorios} onChange={(e) => setIngresoForm({ ...ingresoForm, accesorios: e.target.value })} placeholder="Ej: Cargador, maletín, 2 baterías..." className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                </div>
              </div>

              {/* Sección: Problema */}
              <div className="p-4 bg-slate-800/30 rounded-xl">
                <h4 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Problema Reportado *
                </h4>
                <textarea value={ingresoForm.problemaReportado} onChange={(e) => setIngresoForm({ ...ingresoForm, problemaReportado: e.target.value })} placeholder="Describa qué le pasa al equipo..." rows={4} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-800">
              <button onClick={crearOrden} disabled={procesando === 'crear'} className="flex-1 px-4 py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-xl font-medium flex items-center justify-center gap-2">
                {procesando === 'crear' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <><ClipboardCheck className="h-4 w-4" /> Crear Orden</>}
              </button>
              <button onClick={() => { setModalType(null); resetIngresoForm(); }} className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Continúa con modal de detalle... */}
      {/* ==================== MODAL: DETALLE ORDEN ==================== */}
      {modalType === 'detalle' && ordenSeleccionada && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full p-6 my-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <span className="font-mono">{ordenSeleccionada.numero}</span>
                  <span className={`px-2 py-1 rounded-lg text-xs border ${ESTADO_CONFIG[ordenSeleccionada.estado].bg} ${ESTADO_CONFIG[ordenSeleccionada.estado].color}`}>
                    {ESTADO_CONFIG[ordenSeleccionada.estado].label}
                  </span>
                </h3>
                <p className="text-slate-400 text-sm mt-1">
                  Creada: {formatDateTime(ordenSeleccionada.createdAt)} • {getDiasDesde(ordenSeleccionada.createdAt)} días
                </p>
              </div>
              <button onClick={() => { setModalType(null); setOrdenSeleccionada(null); }} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-6 max-h-[70vh] overflow-y-auto">
              {/* Columna izquierda - Info */}
              <div className="col-span-2 space-y-4">
                {/* Info del equipo */}
                <div className="p-4 bg-slate-800/30 rounded-xl">
                  <h4 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                    {TIPO_EQUIPO_CONFIG[ordenSeleccionada.tipoEquipo].icon}
                    Equipo
                  </h4>
                  <div className="space-y-2">
                    <div className="text-lg font-medium text-slate-200">{ordenSeleccionada.descripcionEquipo}</div>
                    {ordenSeleccionada.marca && (
                      <div className="text-sm text-slate-400">{ordenSeleccionada.marca} {ordenSeleccionada.modelo}</div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {ordenSeleccionada.serie && (
                        <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">Serie: {ordenSeleccionada.serie}</span>
                      )}
                      {ordenSeleccionada.lote && (
                        <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">Lote: {ordenSeleccionada.lote}</span>
                      )}
                      {ordenSeleccionada.matricula && (
                        <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">Matrícula: {ordenSeleccionada.matricula}</span>
                      )}
                      {ordenSeleccionada.color && (
                        <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">Color: {ordenSeleccionada.color}</span>
                      )}
                    </div>
                    {ordenSeleccionada.estadoIngreso && (
                      <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                        <span className="text-xs text-amber-400">Estado de ingreso:</span>
                        <p className="text-sm text-slate-300">{ordenSeleccionada.estadoIngreso}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Problema reportado */}
                <div className="p-4 bg-slate-800/30 rounded-xl">
                  <h4 className="text-sm font-semibold text-slate-400 mb-2">Problema Reportado</h4>
                  <p className="text-slate-200">{ordenSeleccionada.problemaReportado}</p>
                </div>

                {/* Diagnóstico */}
                {ordenSeleccionada.diagnostico ? (
                  <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                    <h4 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2">
                      <Search className="h-4 w-4" />
                      Diagnóstico
                    </h4>
                    <p className="text-slate-200">{ordenSeleccionada.diagnostico}</p>
                    <p className="text-xs text-slate-500 mt-2">
                      Por: {ordenSeleccionada.tecnicoDiagnostico} • {ordenSeleccionada.fechaDiagnostico && formatDate(ordenSeleccionada.fechaDiagnostico)}
                    </p>
                  </div>
                ) : ordenSeleccionada.estado === 'diagnostico' && (
                  <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                    <h4 className="text-sm font-semibold text-blue-400 mb-3">Registrar Diagnóstico</h4>
                    <textarea
                      value={diagnosticoForm.diagnostico}
                      onChange={(e) => setDiagnosticoForm({ ...diagnosticoForm, diagnostico: e.target.value })}
                      placeholder="Describa el diagnóstico técnico..."
                      rows={3}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 mb-3"
                    />
                    <button
                      onClick={guardarDiagnostico}
                      disabled={procesando === 'diagnostico'}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm"
                    >
                      {procesando === 'diagnostico' ? 'Guardando...' : 'Guardar Diagnóstico'}
                    </button>
                  </div>
                )}

                {/* Cotización */}
                {ordenSeleccionada.cotizacion && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                    <h4 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      Cotización {ordenSeleccionada.cotizacion.numero}
                    </h4>
                    <div className="space-y-2">
                      {ordenSeleccionada.cotizacion.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-slate-300">{item.cantidad}x {item.descripcion}</span>
                          <span className="text-slate-400">{formatCurrency(item.total)}</span>
                        </div>
                      ))}
                      <div className="border-t border-slate-700 pt-2 mt-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Subtotal:</span>
                          <span className="text-slate-300">{formatCurrency(ordenSeleccionada.cotizacion.subtotal)}</span>
                        </div>
                        {ordenSeleccionada.cotizacion.descuento > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Descuento:</span>
                            <span className="text-emerald-400">-{formatCurrency(ordenSeleccionada.cotizacion.descuento)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">IVA:</span>
                          <span className="text-slate-300">{formatCurrency(ordenSeleccionada.cotizacion.impuestos)}</span>
                        </div>
                        <div className="flex justify-between font-bold mt-2">
                          <span className="text-slate-200">TOTAL:</span>
                          <span className="text-amber-400">{formatCurrency(ordenSeleccionada.cotizacion.total)}</span>
                        </div>
                      </div>
                    </div>
                    
                    {ordenSeleccionada.estado === 'cotizacion' && (
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => responderCotizacion(true)}
                          disabled={procesando === 'respuesta'}
                          className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm flex items-center justify-center gap-2"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Cliente Aprueba
                        </button>
                        <button
                          onClick={() => responderCotizacion(false)}
                          disabled={procesando === 'respuesta'}
                          className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm flex items-center justify-center gap-2"
                        >
                          <XCircle className="h-4 w-4" />
                          Cliente Rechaza
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Trabajo realizado */}
                {ordenSeleccionada.trabajoRealizado && (
                  <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                    <h4 className="text-sm font-semibold text-purple-400 mb-2 flex items-center gap-2">
                      <Wrench className="h-4 w-4" />
                      Trabajo Realizado
                    </h4>
                    <p className="text-slate-200">{ordenSeleccionada.trabajoRealizado}</p>
                    {ordenSeleccionada.repuestosUsados && ordenSeleccionada.repuestosUsados.length > 0 && (
                      <div className="mt-3">
                        <span className="text-xs text-slate-500">Repuestos utilizados:</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {ordenSeleccionada.repuestosUsados.map((r, idx) => (
                            <span key={idx} className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">
                              {r.cantidad}x {r.productoNombre}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Columna derecha - Cliente y acciones */}
              <div className="space-y-4">
                {/* Tipo de orden */}
                <div className={`p-3 rounded-xl ${TIPO_ORDEN_CONFIG[ordenSeleccionada.tipoOrden].color} bg-slate-800/50`}>
                  <div className="flex items-center gap-2">
                    {TIPO_ORDEN_CONFIG[ordenSeleccionada.tipoOrden].icon}
                    <span className="font-medium">{TIPO_ORDEN_CONFIG[ordenSeleccionada.tipoOrden].label}</span>
                  </div>
                  {ordenSeleccionada.esGarantia && ordenSeleccionada.facturaGarantia && (
                    <div className="text-xs mt-1 text-slate-400">
                      Factura: {ordenSeleccionada.facturaGarantia}
                    </div>
                  )}
                </div>

                {/* Cliente */}
                <div className="p-4 bg-slate-800/30 rounded-xl">
                  <h4 className="text-sm font-semibold text-slate-400 mb-2">Cliente</h4>
                  <div className="text-slate-200 font-medium">{ordenSeleccionada.clienteNombre}</div>
                  {ordenSeleccionada.clienteRut && (
                    <div className="text-sm text-slate-400">{ordenSeleccionada.clienteRut}</div>
                  )}
                  {ordenSeleccionada.clienteTelefono && (
                    <div className="flex items-center gap-2 mt-2 text-sm text-slate-300">
                      <Phone className="h-4 w-4" />
                      {ordenSeleccionada.clienteTelefono}
                    </div>
                  )}
                  {ordenSeleccionada.clienteEmail && (
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <Mail className="h-4 w-4" />
                      {ordenSeleccionada.clienteEmail}
                    </div>
                  )}
                </div>

                {/* Estado de notificación */}
                <div className={`p-3 rounded-xl ${ordenSeleccionada.clienteNotificado ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-amber-500/10 border border-amber-500/30'}`}>
                  <div className="flex items-center gap-2">
                    {ordenSeleccionada.clienteNotificado ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                        <span className="text-emerald-400 text-sm">Cliente notificado</span>
                      </>
                    ) : (
                      <>
                        <Bell className="h-4 w-4 text-amber-400" />
                        <span className="text-amber-400 text-sm">Sin notificar</span>
                      </>
                    )}
                  </div>
                  {ordenSeleccionada.fechaNotificacion && (
                    <div className="text-xs text-slate-500 mt-1">
                      {formatDateTime(ordenSeleccionada.fechaNotificacion)} vía {ordenSeleccionada.medioNotificacion}
                    </div>
                  )}
                </div>

                {/* Acciones según estado */}
                <div className="p-4 bg-slate-800/30 rounded-xl">
                  <h4 className="text-sm font-semibold text-slate-400 mb-3">Acciones</h4>
                  <div className="space-y-2">
                    {/* Asignar a diagnóstico */}
                    {ordenSeleccionada.estado === 'recepcion' && (
                      <button
                        onClick={() => cambiarEstado(ordenSeleccionada, 'diagnostico')}
                        disabled={procesando === ordenSeleccionada.id}
                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm flex items-center justify-center gap-2"
                      >
                        <Search className="h-4 w-4" />
                        Enviar a Diagnóstico
                      </button>
                    )}

                    {/* Crear cotización */}
                    {ordenSeleccionada.estado === 'diagnostico' && !ordenSeleccionada.esGarantia && ordenSeleccionada.diagnostico && (
                      <button
                        onClick={() => setModalType('cotizacion')}
                        className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm flex items-center justify-center gap-2"
                      >
                        <Receipt className="h-4 w-4" />
                        Crear Cotización
                      </button>
                    )}

                    {/* Iniciar reparación */}
                    {(ordenSeleccionada.estado === 'aprobado' || (ordenSeleccionada.estado === 'diagnostico' && ordenSeleccionada.esGarantia)) && (
                      <button
                        onClick={iniciarReparacion}
                        disabled={procesando === 'reparacion'}
                        className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm flex items-center justify-center gap-2"
                      >
                        <Wrench className="h-4 w-4" />
                        Iniciar Reparación
                      </button>
                    )}

                    {/* Finalizar reparación */}
                    {ordenSeleccionada.estado === 'en_reparacion' && (
                      <button
                        onClick={() => setModalType('reparacion')}
                        className="w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm flex items-center justify-center gap-2"
                      >
                        <BadgeCheck className="h-4 w-4" />
                        Finalizar Reparación
                      </button>
                    )}

                    {/* Notificar cliente */}
                    {!ordenSeleccionada.clienteNotificado && ['reparado', 'listo_entrega', 'cotizacion'].includes(ordenSeleccionada.estado) && (
                      <button
                        onClick={() => setModalType('notificar')}
                        className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm flex items-center justify-center gap-2"
                      >
                        <Bell className="h-4 w-4" />
                        Notificar Cliente
                      </button>
                    )}

                    {/* Facturar */}
                    {ordenSeleccionada.estado === 'reparado' && !ordenSeleccionada.esGarantia && (
                      <button
                        onClick={() => setModalType('facturar')}
                        className="w-full px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm flex items-center justify-center gap-2"
                      >
                        <FileCheck className="h-4 w-4" />
                        Registrar Factura
                      </button>
                    )}

                    {/* Marcar listo entrega */}
                    {(ordenSeleccionada.estado === 'facturado' || (ordenSeleccionada.estado === 'reparado' && ordenSeleccionada.esGarantia)) && (
                      <button
                        onClick={marcarListoEntrega}
                        disabled={procesando === 'listo'}
                        className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-sm flex items-center justify-center gap-2"
                      >
                        <PackageCheck className="h-4 w-4" />
                        Listo para Entrega
                      </button>
                    )}

                    {/* Entregar */}
                    {ordenSeleccionada.estado === 'listo_entrega' && (
                      <button
                        onClick={() => setModalType('entregar')}
                        className="w-full px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm flex items-center justify-center gap-2"
                      >
                        <TruckIcon className="h-4 w-4" />
                        Registrar Entrega
                      </button>
                    )}
                  </div>
                </div>

                {/* Prioridad */}
                <div className={`p-3 rounded-xl ${PRIORIDAD_CONFIG[ordenSeleccionada.prioridad].bg}`}>
                  <span className={`text-sm font-medium ${PRIORIDAD_CONFIG[ordenSeleccionada.prioridad].color}`}>
                    Prioridad: {PRIORIDAD_CONFIG[ordenSeleccionada.prioridad].label}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Continúa con más modales... */}
      {/* ==================== MODAL: COTIZACIÓN ==================== */}
      {modalType === 'cotizacion' && ordenSeleccionada && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100">Crear Cotización</h3>
              <button onClick={() => setModalType('detalle')} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Items de cotización */}
              <div className="p-4 bg-slate-800/30 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-slate-400">Items</h4>
                  <button
                    onClick={() => {
                      setCotizacionForm({
                        ...cotizacionForm,
                        items: [...cotizacionForm.items, {
                          id: Date.now().toString(),
                          tipo: 'mano_obra',
                          descripcion: '',
                          cantidad: 1,
                          precioUnitario: 0,
                          descuento: 0,
                          total: 0,
                          reservado: false,
                        }],
                      });
                    }}
                    className="text-sm text-orange-400 hover:text-orange-300"
                  >
                    + Agregar item
                  </button>
                </div>

                <div className="space-y-3">
                  {cotizacionForm.items.map((item, idx) => (
                    <div key={item.id} className="p-3 bg-slate-800/50 rounded-lg">
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-3">
                          <select
                            value={item.tipo}
                            onChange={(e) => {
                              const items = [...cotizacionForm.items];
                              items[idx].tipo = e.target.value as any;
                              setCotizacionForm({ ...cotizacionForm, items });
                            }}
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-slate-100"
                          >
                            <option value="mano_obra">Mano de obra</option>
                            <option value="repuesto">Repuesto</option>
                            <option value="servicio">Servicio</option>
                          </select>
                        </div>
                        <div className="col-span-5">
                          {item.tipo === 'repuesto' ? (
                            <select
                              value={item.productoId || ''}
                              onChange={(e) => {
                                const items = [...cotizacionForm.items];
                                const prod = productos.find(p => p.id === e.target.value);
                                items[idx].productoId = e.target.value;
                                items[idx].descripcion = prod?.nombre || '';
                                items[idx].precioUnitario = prod?.precio_venta || 0;
                                items[idx].total = items[idx].cantidad * items[idx].precioUnitario;
                                setCotizacionForm({ ...cotizacionForm, items });
                              }}
                              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-slate-100"
                            >
                              <option value="">Seleccionar...</option>
                              {productos.map(p => (
                                <option key={p.id} value={p.id}>{p.codigo} - {p.nombre} (Stock: {p.stock_actual})</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={item.descripcion}
                              onChange={(e) => {
                                const items = [...cotizacionForm.items];
                                items[idx].descripcion = e.target.value;
                                setCotizacionForm({ ...cotizacionForm, items });
                              }}
                              placeholder="Descripción"
                              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-slate-100"
                            />
                          )}
                        </div>
                        <div className="col-span-1">
                          <input
                            type="number"
                            value={item.cantidad}
                            onChange={(e) => {
                              const items = [...cotizacionForm.items];
                              items[idx].cantidad = parseInt(e.target.value) || 1;
                              items[idx].total = items[idx].cantidad * items[idx].precioUnitario;
                              setCotizacionForm({ ...cotizacionForm, items });
                            }}
                            min="1"
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-slate-100 text-center"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            value={item.precioUnitario}
                            onChange={(e) => {
                              const items = [...cotizacionForm.items];
                              items[idx].precioUnitario = parseFloat(e.target.value) || 0;
                              items[idx].total = items[idx].cantidad * items[idx].precioUnitario;
                              setCotizacionForm({ ...cotizacionForm, items });
                            }}
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-slate-100"
                            step="0.01"
                          />
                        </div>
                        <div className="col-span-1 flex items-center justify-center">
                          <button
                            onClick={() => {
                              const items = cotizacionForm.items.filter((_, i) => i !== idx);
                              setCotizacionForm({ ...cotizacionForm, items });
                            }}
                            className="p-1 hover:bg-slate-700 rounded text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totales */}
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">Subtotal:</span>
                  <span className="text-slate-200">{formatCurrency(cotizacionForm.items.reduce((s, i) => s + i.total, 0))}</span>
                </div>
                <div className="flex justify-between items-center text-sm mb-2">
                  <span className="text-slate-400">Descuento:</span>
                  <input
                    type="number"
                    value={cotizacionForm.descuento}
                    onChange={(e) => setCotizacionForm({ ...cotizacionForm, descuento: parseFloat(e.target.value) || 0 })}
                    className="w-24 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-right text-slate-100"
                    step="0.01"
                  />
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">IVA (22%):</span>
                  <span className="text-slate-200">
                    {formatCurrency((cotizacionForm.items.reduce((s, i) => s + i.total, 0) - cotizacionForm.descuento) * 0.22)}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-amber-500/30">
                  <span className="text-slate-200">TOTAL:</span>
                  <span className="text-amber-400">
                    {formatCurrency(
                      (cotizacionForm.items.reduce((s, i) => s + i.total, 0) - cotizacionForm.descuento) * 1.22
                    )}
                  </span>
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Observaciones</label>
                <textarea
                  value={cotizacionForm.observaciones}
                  onChange={(e) => setCotizacionForm({ ...cotizacionForm, observaciones: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Tiempo estimado</label>
                  <input
                    type="text"
                    value={cotizacionForm.tiempoEstimado}
                    onChange={(e) => setCotizacionForm({ ...cotizacionForm, tiempoEstimado: e.target.value })}
                    placeholder="Ej: 3-5 días hábiles"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Validez (días)</label>
                  <input
                    type="number"
                    value={cotizacionForm.validezDias}
                    onChange={(e) => setCotizacionForm({ ...cotizacionForm, validezDias: parseInt(e.target.value) || 15 })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={crearCotizacion} disabled={procesando === 'cotizacion'} className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl">
                {procesando === 'cotizacion' ? 'Creando...' : 'Crear Cotización'}
              </button>
              <button onClick={() => setModalType('detalle')} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Volver</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: REPARACIÓN ==================== */}
      {modalType === 'reparacion' && ordenSeleccionada && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100">Finalizar Reparación</h3>
              <button onClick={() => setModalType('detalle')} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Trabajo realizado *</label>
                <textarea
                  value={reparacionForm.trabajoRealizado}
                  onChange={(e) => setReparacionForm({ ...reparacionForm, trabajoRealizado: e.target.value })}
                  placeholder="Describa el trabajo realizado..."
                  rows={4}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                />
              </div>

              {/* Repuestos usados */}
              <div className="p-4 bg-slate-800/30 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-slate-400">Repuestos utilizados</h4>
                  <button
                    onClick={() => {
                      setReparacionForm({
                        ...reparacionForm,
                        repuestosUsados: [...reparacionForm.repuestosUsados, {
                          id: Date.now().toString(),
                          productoId: '',
                          productoNombre: '',
                          cantidad: 1,
                          costo: 0,
                        }],
                      });
                    }}
                    className="text-sm text-orange-400 hover:text-orange-300"
                  >
                    + Agregar repuesto
                  </button>
                </div>

                <div className="space-y-2">
                  {reparacionForm.repuestosUsados.map((rep, idx) => (
                    <div key={rep.id} className="flex gap-2 items-center">
                      <select
                        value={rep.productoId}
                        onChange={(e) => {
                          const repuestos = [...reparacionForm.repuestosUsados];
                          const prod = productos.find(p => p.id === e.target.value);
                          repuestos[idx].productoId = e.target.value;
                          repuestos[idx].productoNombre = prod?.nombre || '';
                          repuestos[idx].costo = prod?.precio_venta || 0;
                          setReparacionForm({ ...reparacionForm, repuestosUsados: repuestos });
                        }}
                        className="flex-1 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-100"
                      >
                        <option value="">Seleccionar...</option>
                        {productos.map(p => (
                          <option key={p.id} value={p.id}>{p.nombre} (Stock: {p.stock_actual})</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        value={rep.cantidad}
                        onChange={(e) => {
                          const repuestos = [...reparacionForm.repuestosUsados];
                          repuestos[idx].cantidad = parseInt(e.target.value) || 1;
                          setReparacionForm({ ...reparacionForm, repuestosUsados: repuestos });
                        }}
                        min="1"
                        className="w-20 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-100 text-center"
                      />
                      <button
                        onClick={() => {
                          const repuestos = reparacionForm.repuestosUsados.filter((_, i) => i !== idx);
                          setReparacionForm({ ...reparacionForm, repuestosUsados: repuestos });
                        }}
                        className="p-1.5 hover:bg-slate-700 rounded text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={finalizarReparacion} disabled={procesando === 'finalizar'} className="flex-1 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl">
                {procesando === 'finalizar' ? 'Guardando...' : 'Finalizar Reparación'}
              </button>
              <button onClick={() => setModalType('detalle')} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Volver</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: NOTIFICAR ==================== */}
      {modalType === 'notificar' && ordenSeleccionada && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100">Notificar Cliente</h3>
              <button onClick={() => setModalType('detalle')} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-slate-800/50 rounded-xl">
                <div className="font-medium text-slate-200">{ordenSeleccionada.clienteNombre}</div>
                <div className="text-sm text-slate-400">{ordenSeleccionada.clienteTelefono}</div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Medio de contacto</label>
                <div className="flex gap-2">
                  {(['telefono', 'email', 'whatsapp'] as const).map(medio => (
                    <button
                      key={medio}
                      onClick={() => setNotificacionForm({ ...notificacionForm, medio })}
                      className={`flex-1 px-3 py-2 rounded-xl text-sm capitalize ${
                        notificacionForm.medio === medio
                          ? 'bg-orange-600 text-white'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {medio === 'telefono' && <Phone className="h-4 w-4 inline mr-1" />}
                      {medio === 'email' && <Mail className="h-4 w-4 inline mr-1" />}
                      {medio === 'whatsapp' && <MessageSquare className="h-4 w-4 inline mr-1" />}
                      {medio}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Notas del contacto</label>
                <textarea
                  value={notificacionForm.mensaje}
                  onChange={(e) => setNotificacionForm({ ...notificacionForm, mensaje: e.target.value })}
                  placeholder="Qué se le comunicó al cliente..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={notificarCliente} disabled={procesando === 'notificar'} className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl">
                {procesando === 'notificar' ? 'Guardando...' : 'Marcar como Notificado'}
              </button>
              <button onClick={() => setModalType('detalle')} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Volver</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: FACTURAR ==================== */}
      {modalType === 'facturar' && ordenSeleccionada && (
        <ModalFacturar 
          orden={ordenSeleccionada} 
          onFacturar={marcarFacturado} 
          onClose={() => setModalType('detalle')} 
          procesando={procesando === 'facturar'}
        />
      )}

      {/* ==================== MODAL: ENTREGAR ==================== */}
      {modalType === 'entregar' && ordenSeleccionada && (
        <ModalEntregar 
          orden={ordenSeleccionada} 
          onEntregar={registrarEntrega} 
          onClose={() => setModalType('detalle')} 
          procesando={procesando === 'entregar'}
        />
      )}

    </div>
  );
}

// ============================================
// COMPONENTE: KANBAN CARD
// ============================================

function KanbanCard({ orden, onClick }: { orden: OrdenTrabajo; onClick: () => void }) {
  const tipoConfig = TIPO_ORDEN_CONFIG[orden.tipoOrden];
  const prioridadConfig = PRIORIDAD_CONFIG[orden.prioridad];
  const equipoConfig = TIPO_EQUIPO_CONFIG[orden.tipoEquipo];
  const dias = getDiasDesde(orden.createdAt);

  return (
    <div
      onClick={onClick}
      className="p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-xl cursor-pointer transition-colors"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <span className="font-mono text-xs text-slate-400">{orden.numero}</span>
        <div className="flex items-center gap-1">
          {orden.esGarantia && <Shield className="h-3 w-3 text-emerald-400" />}
          {orden.prioridad === 'urgente' && <Flag className="h-3 w-3 text-red-400" />}
          {!orden.clienteNotificado && ['reparado', 'listo_entrega'].includes(orden.estado) && (
            <Bell className="h-3 w-3 text-amber-400" />
          )}
        </div>
      </div>

      {/* Cliente */}
      <div className="text-sm font-medium text-slate-200 mb-1">{orden.clienteNombre}</div>

      {/* Equipo */}
      <div className="flex items-center gap-1 text-xs text-slate-400 mb-2">
        {equipoConfig.icon}
        <span className="truncate">{orden.descripcionEquipo}</span>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1">
        <span className={`px-1.5 py-0.5 rounded text-xs ${tipoConfig.color}`}>
          {tipoConfig.label}
        </span>
        <span className={`px-1.5 py-0.5 rounded text-xs ${prioridadConfig.bg} ${prioridadConfig.color}`}>
          {prioridadConfig.label}
        </span>
        <span className="px-1.5 py-0.5 rounded text-xs bg-slate-700 text-slate-400">
          {dias}d
        </span>
      </div>
    </div>
  );
}

// ============================================
// COMPONENTE: MODAL FACTURAR
// ============================================

function ModalFacturar({ orden, onFacturar, onClose, procesando }: { 
  orden: OrdenTrabajo; 
  onFacturar: (numero: string, monto: number) => void; 
  onClose: () => void;
  procesando: boolean;
}) {
  const [numero, setNumero] = useState('');
  const [monto, setMonto] = useState(orden.cotizacion?.total || 0);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-100">Registrar Factura</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Número de Factura</label>
            <input
              type="text"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="FAC-000123"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Monto Total</label>
            <input
              type="number"
              value={monto}
              onChange={(e) => setMonto(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              step="0.01"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={() => onFacturar(numero, monto)} disabled={procesando || !numero} className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-xl">
            {procesando ? 'Guardando...' : 'Registrar Factura'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Volver</button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// COMPONENTE: MODAL ENTREGAR
// ============================================

function ModalEntregar({ orden, onEntregar, onClose, procesando }: { 
  orden: OrdenTrabajo; 
  onEntregar: (entregadoA: string, metodo: 'retiro' | 'envio' | 'instalacion') => void; 
  onClose: () => void;
  procesando: boolean;
}) {
  const [entregadoA, setEntregadoA] = useState(orden.clienteNombre);
  const [metodo, setMetodo] = useState<'retiro' | 'envio' | 'instalacion'>('retiro');

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-100">Registrar Entrega</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Entregado a</label>
            <input
              type="text"
              value={entregadoA}
              onChange={(e) => setEntregadoA(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">Método de entrega</label>
            <div className="flex gap-2">
              {[
                { value: 'retiro', label: 'Retiro en local', icon: <User className="h-4 w-4" /> },
                { value: 'envio', label: 'Envío', icon: <TruckIcon className="h-4 w-4" /> },
                { value: 'instalacion', label: 'Instalación', icon: <Wrench className="h-4 w-4" /> },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setMetodo(opt.value as any)}
                  className={`flex-1 px-3 py-2 rounded-xl text-sm flex items-center justify-center gap-1 ${
                    metodo === opt.value
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={() => onEntregar(entregadoA, metodo)} disabled={procesando || !entregadoA} className="flex-1 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-xl">
            {procesando ? 'Guardando...' : 'Confirmar Entrega'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Volver</button>
        </div>
      </div>
    </div>
  );
}