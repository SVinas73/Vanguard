'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  DollarSign, CreditCard, Wallet, TrendingUp, TrendingDown, Building2,
  Receipt, FileText, Calendar, Clock, AlertTriangle, CheckCircle, XCircle,
  Plus, Search, Filter, Download, RefreshCw, Eye, Edit, Trash2, X,
  ChevronRight, ChevronDown, ArrowUpRight, ArrowDownRight, Banknote,
  PiggyBank, Calculator, BarChart3, PieChart, Target, Users, Building,
  Send, FileCheck, AlertCircle, Check, Minus, ArrowRight, Landmark,
  CircleDollarSign, BadgeDollarSign, HandCoins, Coins, BanknoteIcon,
  ClipboardList, History, Settings, MoreHorizontal, ExternalLink,
  Upload, FileSpreadsheet, Link2, Unlink, Phone, Mail, MessageSquare,
  CalendarDays, CalendarClock, Bell, Scale, FileDown, Printer,
  CheckSquare, Square, ArrowLeftRight, Percent, BadgePercent, Wallet2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart as RechartsPie, Pie, Cell,
  LineChart, Line, AreaChart, Area, ComposedChart
} from 'recharts';

// ============================================
// TIPOS BASE
// ============================================

type Moneda = 'USD' | 'UYU' | 'EUR' | 'BRL' | 'ARS';
type TipoCuenta = 'banco' | 'caja' | 'digital' | 'inversion';
type TipoTransaccion = 'ingreso' | 'egreso' | 'transferencia' | 'ajuste';
type EstadoDocumento = 'pendiente' | 'parcial' | 'pagado' | 'vencido' | 'anulado';
type EstadoCheque = 'cartera' | 'depositado' | 'cobrado' | 'rechazado' | 'entregado';
type MetodoPago = 'efectivo' | 'transferencia' | 'cheque' | 'tarjeta' | 'digital' | 'compensacion';
type TabActiva = 'dashboard' | 'cxc' | 'cxp' | 'flujo' | 'transacciones' | 'cheques' | 'conciliacion' | 'presupuesto' | 'cobranza';

// ============================================
// TIPOS EXTENDIDOS - CONCILIACIÓN
// ============================================

type EstadoConciliacion = 'pendiente' | 'conciliado' | 'diferencia' | 'ignorado';

interface MovimientoBancario {
  id: string;
  cuentaId: string;
  fecha: string;
  descripcion: string;
  referencia?: string;
  monto: number;
  tipo: 'credito' | 'debito';
  saldoPosterior?: number;
  estadoConciliacion: EstadoConciliacion;
  transaccionId?: string;
  notasConciliacion?: string;
  importadoDesde?: string;
  createdAt: string;
}

interface SesionConciliacion {
  id: string;
  cuentaId: string;
  fechaInicio: string;
  fechaFin: string;
  saldoInicial: number;
  saldoFinal: number;
  saldoSistema: number;
  diferencia: number;
  estado: 'en_proceso' | 'completada' | 'con_diferencias';
  movimientosConciliados: number;
  movimientosPendientes: number;
  realizadoPor?: string;
  completadoEn?: string;
  createdAt: string;
}

// ============================================
// TIPOS EXTENDIDOS - NOTAS CRÉDITO/DÉBITO
// ============================================

type TipoNota = 'credito' | 'debito';
type OrigenNota = 'cliente' | 'proveedor';
type EstadoNota = 'pendiente' | 'aplicada' | 'parcial' | 'anulada';

interface NotaCreditoDebito {
  id: string;
  numero: string;
  tipo: TipoNota;
  origen: OrigenNota;
  entidadId: string;
  entidadNombre?: string;
  documentoOrigenId?: string;
  documentoOrigenNumero?: string;
  fecha: string;
  moneda: Moneda;
  monto: number;
  montoAplicado: number;
  saldo: number;
  motivo: string;
  estado: EstadoNota;
  aplicaciones?: AplicacionNota[];
  creadoPor?: string;
  createdAt: string;
}

interface AplicacionNota {
  id: string;
  notaId: string;
  documentoId: string;
  documentoNumero: string;
  monto: number;
  fecha: string;
  creadoPor?: string;
}

// ============================================
// TIPOS EXTENDIDOS - COBRANZA
// ============================================

type EstadoCobranza = 'pendiente' | 'contactado' | 'promesa_pago' | 'en_gestion' | 'legal' | 'incobrable' | 'cobrado';
type TipoContactoCobranza = 'llamada' | 'email' | 'whatsapp' | 'visita' | 'carta' | 'otro';
type ResultadoContacto = 'exitoso' | 'no_contesta' | 'promesa' | 'rechazo' | 'incorrecto';

interface GestionCobranza {
  id: string;
  documentoId: string;
  documento?: DocumentoCxC;
  clienteId: string;
  clienteNombre?: string;
  estado: EstadoCobranza;
  prioridad: 'baja' | 'media' | 'alta' | 'urgente';
  montoOriginal: number;
  montoPendiente: number;
  diasVencido: number;
  fechaUltimoContacto?: string;
  fechaProximoContacto?: string;
  promesaPagoFecha?: string;
  promesaPagoMonto?: number;
  asignadoA?: string;
  contactos?: ContactoCobranza[];
  notas?: string;
  createdAt: string;
  updatedAt: string;
}

interface ContactoCobranza {
  id: string;
  gestionId: string;
  tipo: TipoContactoCobranza;
  fecha: string;
  resultado: ResultadoContacto;
  descripcion: string;
  promesaPago?: boolean;
  promesaFecha?: string;
  promesaMonto?: number;
  proximoContacto?: string;
  realizadoPor?: string;
  createdAt: string;
}

// ============================================
// TIPOS EXTENDIDOS - PRESUPUESTO
// ============================================

interface Presupuesto {
  id: string;
  año: number;
  mes: number;
  categoria: string;
  tipo: 'ingreso' | 'egreso';
  montoPresupuestado: number;
  montoReal: number;
  variacion: number;
  variacionPct: number;
  notas?: string;
}

interface ResumenPresupuesto {
  año: number;
  mes: number;
  totalPresupuestadoIngresos: number;
  totalRealIngresos: number;
  totalPresupuestadoEgresos: number;
  totalRealEgresos: number;
  balancePresupuestado: number;
  balanceReal: number;
  variacionBalance: number;
}

// ============================================
// TIPOS EXTENDIDOS - PROGRAMACIÓN PAGOS
// ============================================

type EstadoProgramacion = 'programado' | 'aprobado' | 'ejecutado' | 'cancelado';

interface ProgramacionPago {
  id: string;
  documentoId: string;
  documento?: DocumentoCxP;
  proveedorId: string;
  proveedorNombre?: string;
  fechaProgramada: string;
  monto: number;
  moneda: Moneda;
  cuentaId?: string;
  cuentaNombre?: string;
  metodoPago: MetodoPago;
  estado: EstadoProgramacion;
  prioridad: number;
  aprobadoPor?: string;
  ejecutadoPor?: string;
  transaccionId?: string;
  notas?: string;
  createdAt: string;
}

// ============================================
// INTERFACES EXISTENTES (del archivo anterior)
// ============================================

interface CuentaBancaria {
  id: string;
  nombre: string;
  banco?: string;
  numeroCuenta?: string;
  tipo: TipoCuenta;
  moneda: Moneda;
  saldoActual: number;
  saldoDisponible?: number;
  activo: boolean;
}

interface Transaccion {
  id: string;
  cuentaId: string;
  cuenta?: CuentaBancaria;
  tipo: TipoTransaccion;
  monto: number;
  moneda: Moneda;
  fecha: string;
  concepto: string;
  categoria?: string;
  referencia?: string;
  documentoTipo?: string;
  documentoId?: string;
  conciliado: boolean;
  notas?: string;
  creadoPor?: string;
  createdAt: string;
}

interface DocumentoCxC {
  id: string;
  numero: string;
  clienteId: string;
  cliente?: { id: string; nombre: string; codigo: string; email?: string; telefono?: string };
  ordenVentaId?: string;
  tipo: 'factura' | 'nota_debito' | 'otro';
  fechaEmision: string;
  fechaVencimiento: string;
  moneda: Moneda;
  subtotal: number;
  impuestos: number;
  total: number;
  montoPagado: number;
  saldo: number;
  estado: EstadoDocumento;
  notas?: string;
  pagos?: PagoRecibido[];
}

interface DocumentoCxP {
  id: string;
  numero: string;
  proveedorId: string;
  proveedor?: { id: string; nombre: string; codigo: string };
  ordenCompraId?: string;
  tipo: 'factura' | 'nota_debito' | 'gasto' | 'otro';
  fechaEmision: string;
  fechaVencimiento: string;
  moneda: Moneda;
  subtotal: number;
  impuestos: number;
  retenciones: number;
  total: number;
  montoPagado: number;
  saldo: number;
  estado: EstadoDocumento;
  notas?: string;
  pagos?: PagoRealizado[];
}

interface PagoRecibido {
  id: string;
  documentoId: string;
  cuentaId: string;
  cuenta?: CuentaBancaria;
  fecha: string;
  monto: number;
  moneda: Moneda;
  tipoCambio?: number;
  metodoPago: MetodoPago;
  referencia?: string;
  chequeId?: string;
  notas?: string;
  creadoPor?: string;
}

interface PagoRealizado {
  id: string;
  documentoId: string;
  cuentaId: string;
  cuenta?: CuentaBancaria;
  fecha: string;
  monto: number;
  moneda: Moneda;
  tipoCambio?: number;
  metodoPago: MetodoPago;
  referencia?: string;
  chequeId?: string;
  retencionIVA?: number;
  retencionRenta?: number;
  notas?: string;
  creadoPor?: string;
}

interface Cheque {
  id: string;
  tipo: 'recibido' | 'emitido';
  numero: string;
  banco: string;
  monto: number;
  moneda: Moneda;
  fechaEmision: string;
  fechaVencimiento: string;
  beneficiario?: string;
  librador?: string;
  estado: EstadoCheque;
  cuentaId?: string;
  documentoId?: string;
  notas?: string;
}

interface TipoCambio {
  id: string;
  monedaOrigen: Moneda;
  monedaDestino: Moneda;
  tasa: number;
  fecha: string;
}

interface ProyeccionFlujo {
  fecha: string;
  ingresos: number;
  egresos: number;
  saldoProyectado: number;
  detalleIngresos: Array<{ concepto: string; monto: number }>;
  detalleEgresos: Array<{ concepto: string; monto: number }>;
}

interface AgingBucket {
  rango: string;
  monto: number;
  cantidad: number;
  porcentaje: number;
}

// ============================================
// CONFIGURACIÓN
// ============================================

const MONEDAS_CONFIG: Record<Moneda, { simbolo: string; nombre: string; decimales: number }> = {
  USD: { simbolo: '$', nombre: 'Dólar Americano', decimales: 2 },
  UYU: { simbolo: '$U', nombre: 'Peso Uruguayo', decimales: 0 },
  EUR: { simbolo: '€', nombre: 'Euro', decimales: 2 },
  BRL: { simbolo: 'R$', nombre: 'Real Brasileño', decimales: 2 },
  ARS: { simbolo: 'AR$', nombre: 'Peso Argentino', decimales: 0 },
};

const TIPOS_CUENTA_CONFIG: Record<TipoCuenta, { nombre: string; icono: React.ReactNode }> = {
  banco: { nombre: 'Cuenta Bancaria', icono: <Building2 className="h-4 w-4" /> },
  caja: { nombre: 'Caja', icono: <Wallet className="h-4 w-4" /> },
  digital: { nombre: 'Billetera Digital', icono: <CreditCard className="h-4 w-4" /> },
  inversion: { nombre: 'Inversión', icono: <TrendingUp className="h-4 w-4" /> },
};

const METODOS_PAGO_CONFIG: Record<MetodoPago, { nombre: string; icono: React.ReactNode }> = {
  efectivo: { nombre: 'Efectivo', icono: <Banknote className="h-4 w-4" /> },
  transferencia: { nombre: 'Transferencia', icono: <ArrowRight className="h-4 w-4" /> },
  cheque: { nombre: 'Cheque', icono: <FileCheck className="h-4 w-4" /> },
  tarjeta: { nombre: 'Tarjeta', icono: <CreditCard className="h-4 w-4" /> },
  digital: { nombre: 'Pago Digital', icono: <CircleDollarSign className="h-4 w-4" /> },
  compensacion: { nombre: 'Compensación', icono: <RefreshCw className="h-4 w-4" /> },
};

const ESTADO_DOCUMENTO_CONFIG: Record<EstadoDocumento, { color: string; bg: string; label: string }> = {
  pendiente: { color: 'text-amber-400', bg: 'bg-amber-500/20 border-amber-500/30', label: 'Pendiente' },
  parcial: { color: 'text-blue-400', bg: 'bg-blue-500/20 border-blue-500/30', label: 'Parcial' },
  pagado: { color: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/30', label: 'Pagado' },
  vencido: { color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30', label: 'Vencido' },
  anulado: { color: 'text-slate-400', bg: 'bg-slate-500/20 border-slate-500/30', label: 'Anulado' },
};

const ESTADO_CHEQUE_CONFIG: Record<EstadoCheque, { color: string; bg: string; label: string }> = {
  cartera: { color: 'text-amber-400', bg: 'bg-amber-500/20 border-amber-500/30', label: 'En Cartera' },
  depositado: { color: 'text-blue-400', bg: 'bg-blue-500/20 border-blue-500/30', label: 'Depositado' },
  cobrado: { color: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/30', label: 'Cobrado' },
  rechazado: { color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30', label: 'Rechazado' },
  entregado: { color: 'text-purple-400', bg: 'bg-purple-500/20 border-purple-500/30', label: 'Entregado' },
};

const ESTADO_COBRANZA_CONFIG: Record<EstadoCobranza, { color: string; bg: string; label: string }> = {
  pendiente: { color: 'text-slate-400', bg: 'bg-slate-500/20 border-slate-500/30', label: 'Pendiente' },
  contactado: { color: 'text-blue-400', bg: 'bg-blue-500/20 border-blue-500/30', label: 'Contactado' },
  promesa_pago: { color: 'text-cyan-400', bg: 'bg-cyan-500/20 border-cyan-500/30', label: 'Promesa de Pago' },
  en_gestion: { color: 'text-amber-400', bg: 'bg-amber-500/20 border-amber-500/30', label: 'En Gestión' },
  legal: { color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30', label: 'Gestión Legal' },
  incobrable: { color: 'text-red-600', bg: 'bg-red-600/20 border-red-600/30', label: 'Incobrable' },
  cobrado: { color: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/30', label: 'Cobrado' },
};

const TIPO_CONTACTO_CONFIG: Record<TipoContactoCobranza, { icono: React.ReactNode; label: string }> = {
  llamada: { icono: <Phone className="h-4 w-4" />, label: 'Llamada' },
  email: { icono: <Mail className="h-4 w-4" />, label: 'Email' },
  whatsapp: { icono: <MessageSquare className="h-4 w-4" />, label: 'WhatsApp' },
  visita: { icono: <Users className="h-4 w-4" />, label: 'Visita' },
  carta: { icono: <FileText className="h-4 w-4" />, label: 'Carta' },
  otro: { icono: <MoreHorizontal className="h-4 w-4" />, label: 'Otro' },
};

const PRIORIDAD_CONFIG = {
  baja: { color: 'text-slate-400', bg: 'bg-slate-500/20', label: 'Baja' },
  media: { color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Media' },
  alta: { color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'Alta' },
  urgente: { color: 'text-red-400', bg: 'bg-red-500/20', label: 'Urgente' },
};

const CATEGORIAS_GASTO = [
  'Mercadería', 'Servicios', 'Salarios', 'Alquiler', 'Impuestos', 
  'Servicios Públicos', 'Marketing', 'Transporte', 'Mantenimiento', 
  'Bancarios', 'Seguros', 'Honorarios', 'Otros'
];

const CATEGORIAS_INGRESO = [
  'Ventas', 'Servicios', 'Intereses', 'Comisiones', 'Alquileres', 'Otros'
];

const COLORS_CHART = ['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];

// ============================================
// HELPERS
// ============================================

const formatCurrency = (value: number, moneda: Moneda = 'USD'): string => {
  const config = MONEDAS_CONFIG[moneda];
  return `${config.simbolo} ${value.toLocaleString('es-UY', { 
    minimumFractionDigits: config.decimales, 
    maximumFractionDigits: config.decimales 
  })}`;
};

const formatNumber = (value: number): string => {
  return value.toLocaleString('es-UY');
};

const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('es-UY', { 
    day: '2-digit', month: '2-digit', year: 'numeric' 
  });
};

const formatDateShort = (date: string): string => {
  return new Date(date).toLocaleDateString('es-UY', { 
    day: '2-digit', month: 'short'
  });
};

const formatDateTime = (date: string): string => {
  return new Date(date).toLocaleString('es-UY', { 
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const getDiasVencimiento = (fechaVencimiento: string): number => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = new Date(fechaVencimiento);
  venc.setHours(0, 0, 0, 0);
  return Math.floor((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
};

const getAgingBucket = (fechaVencimiento: string): string => {
  const dias = -getDiasVencimiento(fechaVencimiento);
  if (dias <= 0) return 'vigente';
  if (dias <= 30) return '0-30';
  if (dias <= 60) return '31-60';
  if (dias <= 90) return '61-90';
  return '90+';
};

const calcularAging = (documentos: Array<{ fechaVencimiento: string; saldo: number }>): AgingBucket[] => {
  const buckets: Record<string, { monto: number; cantidad: number }> = {
    'vigente': { monto: 0, cantidad: 0 },
    '0-30': { monto: 0, cantidad: 0 },
    '31-60': { monto: 0, cantidad: 0 },
    '61-90': { monto: 0, cantidad: 0 },
    '90+': { monto: 0, cantidad: 0 },
  };

  documentos.forEach(doc => {
    if (doc.saldo > 0) {
      const bucket = getAgingBucket(doc.fechaVencimiento);
      buckets[bucket].monto += doc.saldo;
      buckets[bucket].cantidad++;
    }
  });

  const total = Object.values(buckets).reduce((s, b) => s + b.monto, 0);

  return Object.entries(buckets).map(([rango, data]) => ({
    rango,
    monto: data.monto,
    cantidad: data.cantidad,
    porcentaje: total > 0 ? (data.monto / total) * 100 : 0,
  }));
};

const getMesNombre = (mes: number): string => {
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return meses[mes - 1] || '';
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

export default function FinanzasEnterprise() {
  const { user } = useAuth();
  const toast = useToast();

  // Estado principal
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);

  // Datos base
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [documentosCxC, setDocumentosCxC] = useState<DocumentoCxC[]>([]);
  const [documentosCxP, setDocumentosCxP] = useState<DocumentoCxP[]>([]);
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [tiposCambio, setTiposCambio] = useState<TipoCambio[]>([]);

  // Datos extendidos
  const [movimientosBancarios, setMovimientosBancarios] = useState<MovimientoBancario[]>([]);
  const [notasCD, setNotasCD] = useState<NotaCreditoDebito[]>([]);
  const [gestionesCobranza, setGestionesCobranza] = useState<GestionCobranza[]>([]);
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [programacionesPago, setProgramacionesPago] = useState<ProgramacionPago[]>([]);

  // Catálogos
  const [clientes, setClientes] = useState<Array<{ id: string; nombre: string; codigo: string; email?: string; telefono?: string }>>([]);
  const [proveedores, setProveedores] = useState<Array<{ id: string; nombre: string; codigo: string }>>([]);

  // UI
  const [tabActiva, setTabActiva] = useState<TabActiva>('dashboard');
  const [monedaActiva, setMonedaActiva] = useState<Moneda>('USD');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState<EstadoDocumento | 'todos'>('todos');
  const [filterEstadoCheque, setFilterEstadoCheque] = useState<EstadoCheque | 'todos'>('todos');
  const [filterEstadoCobranza, setFilterEstadoCobranza] = useState<EstadoCobranza | 'todos'>('todos');

  // Modales
  const [modalType, setModalType] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Conciliación
  const [cuentaConciliacion, setCuentaConciliacion] = useState<string>('');
  const [movimientosParaConciliar, setMovimientosParaConciliar] = useState<MovimientoBancario[]>([]);
  const [transaccionesParaConciliar, setTransaccionesParaConciliar] = useState<Transaccion[]>([]);
  const [matchesConciliacion, setMatchesConciliacion] = useState<Map<string, string>>(new Map());

  // Presupuesto
  const [añoPresupuesto, setAñoPresupuesto] = useState(new Date().getFullYear());
  const [mesPresupuesto, setMesPresupuesto] = useState(new Date().getMonth() + 1);

  // Forms
  const [cuentaForm, setCuentaForm] = useState({
    nombre: '',
    banco: '',
    numeroCuenta: '',
    tipo: 'banco' as TipoCuenta,
    moneda: 'USD' as Moneda,
    saldoActual: 0,
  });

  const [pagoForm, setPagoForm] = useState({
    documentoId: '',
    cuentaId: '',
    fecha: new Date().toISOString().split('T')[0],
    monto: 0,
    metodoPago: 'transferencia' as MetodoPago,
    referencia: '',
    retencionIVA: 0,
    retencionRenta: 0,
    notas: '',
  });

  const [transaccionForm, setTransaccionForm] = useState({
    cuentaId: '',
    tipo: 'ingreso' as TipoTransaccion,
    monto: 0,
    fecha: new Date().toISOString().split('T')[0],
    concepto: '',
    categoria: '',
    referencia: '',
    notas: '',
  });

  const [chequeForm, setChequeForm] = useState({
    tipo: 'recibido' as 'recibido' | 'emitido',
    numero: '',
    banco: '',
    monto: 0,
    moneda: 'USD' as Moneda,
    fechaEmision: new Date().toISOString().split('T')[0],
    fechaVencimiento: '',
    beneficiario: '',
    librador: '',
    notas: '',
  });

  const [tipoCambioForm, setTipoCambioForm] = useState({
    monedaOrigen: 'USD' as Moneda,
    monedaDestino: 'UYU' as Moneda,
    tasa: 0,
    fecha: new Date().toISOString().split('T')[0],
  });

  const [notaForm, setNotaForm] = useState({
    tipo: 'credito' as TipoNota,
    origen: 'cliente' as OrigenNota,
    entidadId: '',
    documentoOrigenId: '',
    monto: 0,
    motivo: '',
  });

  const [contactoForm, setContactoForm] = useState({
    tipo: 'llamada' as TipoContactoCobranza,
    resultado: 'exitoso' as ResultadoContacto,
    descripcion: '',
    promesaPago: false,
    promesaFecha: '',
    promesaMonto: 0,
    proximoContacto: '',
  });

  const [presupuestoForm, setPresupuestoForm] = useState({
    categoria: '',
    tipo: 'egreso' as 'ingreso' | 'egreso',
    monto: 0,
  });

  const [cxcForm, setCxcForm] = useState({
    clienteId: '',
    tipo: 'factura' as 'factura' | 'nota_debito' | 'otro',
    numero: '',
    fechaEmision: new Date().toISOString().split('T')[0],
    fechaVencimiento: '',
    subtotal: 0,
    impuestos: 0,
    notas: '',
  });

  const [cxpForm, setCxpForm] = useState({
    proveedorId: '',
    tipo: 'factura' as 'factura' | 'nota_debito' | 'gasto' | 'otro',
    numero: '',
    fechaEmision: new Date().toISOString().split('T')[0],
    fechaVencimiento: '',
    subtotal: 0,
    impuestos: 0,
    notas: '',
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
        loadCuentas(),
        loadDocumentosCxC(),
        loadDocumentosCxP(),
        loadTransacciones(),
        loadCheques(),
        loadTiposCambio(),
        loadCatalogos(),
        loadNotasCD(),
        loadGestionesCobranza(),
        loadPresupuestos(),
        loadProgramacionesPago(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const loadCuentas = async () => {
    const { data } = await supabase
      .from('cuentas_bancarias')
      .select('*')
      .order('nombre');

    if (data) {
      setCuentas(data.map((c: any) => ({
        id: c.id,
        nombre: c.nombre,
        banco: c.banco,
        numeroCuenta: c.numero_cuenta,
        tipo: c.tipo,
        moneda: c.moneda,
        saldoActual: parseFloat(c.saldo_actual) || 0,
        saldoDisponible: parseFloat(c.saldo_disponible) || 0,
        activo: c.activo,
      })));
    }
  };

  const loadDocumentosCxC = async () => {
    const { data } = await supabase
      .from('cuentas_por_cobrar')
      .select('*, cliente:clientes(id, nombre, codigo, email, telefono), pagos:pagos_recibidos(*)')
      .order('fecha_vencimiento');

    if (data) {
      setDocumentosCxC(data.map((d: any) => ({
        id: d.id,
        numero: d.numero,
        clienteId: d.cliente_id,
        cliente: d.cliente,
        ordenVentaId: d.orden_venta_id,
        tipo: d.tipo,
        fechaEmision: d.fecha_emision,
        fechaVencimiento: d.fecha_vencimiento,
        moneda: d.moneda || 'USD',
        subtotal: parseFloat(d.subtotal) || 0,
        impuestos: parseFloat(d.impuestos) || 0,
        total: parseFloat(d.total) || 0,
        montoPagado: parseFloat(d.monto_pagado) || 0,
        saldo: parseFloat(d.saldo) || 0,
        estado: d.estado,
        notas: d.notas,
        pagos: d.pagos || [],
      })));
    }
  };

  const loadDocumentosCxP = async () => {
    const { data } = await supabase
      .from('cuentas_por_pagar')
      .select('*, proveedor:proveedores(id, nombre, codigo), pagos:pagos_realizados(*)')
      .order('fecha_vencimiento');

    if (data) {
      setDocumentosCxP(data.map((d: any) => ({
        id: d.id,
        numero: d.numero,
        proveedorId: d.proveedor_id,
        proveedor: d.proveedor,
        ordenCompraId: d.orden_compra_id,
        tipo: d.tipo,
        fechaEmision: d.fecha_emision,
        fechaVencimiento: d.fecha_vencimiento,
        moneda: d.moneda || 'USD',
        subtotal: parseFloat(d.subtotal) || 0,
        impuestos: parseFloat(d.impuestos) || 0,
        retenciones: parseFloat(d.retenciones) || 0,
        total: parseFloat(d.total) || 0,
        montoPagado: parseFloat(d.monto_pagado) || 0,
        saldo: parseFloat(d.saldo) || 0,
        estado: d.estado,
        notas: d.notas,
        pagos: d.pagos || [],
      })));
    }
  };

  const loadTransacciones = async () => {
    const { data } = await supabase
      .from('transacciones_financieras')
      .select('*, cuenta:cuentas_bancarias(id, nombre, moneda)')
      .order('fecha', { ascending: false })
      .limit(500);

    if (data) {
      setTransacciones(data.map((t: any) => ({
        id: t.id,
        cuentaId: t.cuenta_id,
        cuenta: t.cuenta,
        tipo: t.tipo,
        monto: parseFloat(t.monto) || 0,
        moneda: t.moneda || 'USD',
        fecha: t.fecha,
        concepto: t.concepto,
        categoria: t.categoria,
        referencia: t.referencia,
        documentoTipo: t.documento_tipo,
        documentoId: t.documento_id,
        conciliado: t.conciliado || false,
        notas: t.notas,
        creadoPor: t.creado_por,
        createdAt: t.created_at,
      })));
    }
  };

  const loadCheques = async () => {
    const { data } = await supabase
      .from('cheques')
      .select('*')
      .order('fecha_vencimiento');

    if (data) {
      setCheques(data.map((ch: any) => ({
        id: ch.id,
        tipo: ch.tipo,
        numero: ch.numero,
        banco: ch.banco,
        monto: parseFloat(ch.monto) || 0,
        moneda: ch.moneda || 'USD',
        fechaEmision: ch.fecha_emision,
        fechaVencimiento: ch.fecha_vencimiento,
        beneficiario: ch.beneficiario,
        librador: ch.librador,
        estado: ch.estado,
        cuentaId: ch.cuenta_id,
        documentoId: ch.documento_id,
        notas: ch.notas,
      })));
    }
  };

  const loadTiposCambio = async () => {
    const { data } = await supabase
      .from('tipos_cambio')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(30);

    if (data) {
      setTiposCambio(data.map((tc: any) => ({
        id: tc.id,
        monedaOrigen: tc.moneda_origen,
        monedaDestino: tc.moneda_destino,
        tasa: parseFloat(tc.tasa) || 0,
        fecha: tc.fecha,
      })));
    }
  };

  const loadCatalogos = async () => {
    const [cliRes, provRes] = await Promise.all([
      supabase.from('clientes').select('id, nombre, codigo, email, telefono').eq('activo', true).order('nombre'),
      supabase.from('proveedores').select('id, nombre, codigo').eq('activo', true).order('nombre'),
    ]);

    if (cliRes.data) setClientes(cliRes.data);
    if (provRes.data) setProveedores(provRes.data);
  };

  const loadNotasCD = async () => {
    const { data } = await supabase
      .from('notas_credito_debito')
      .select('*')
      .order('fecha', { ascending: false });

    if (data) {
      setNotasCD(data.map((n: any) => ({
        id: n.id,
        numero: n.numero,
        tipo: n.tipo,
        origen: n.origen,
        entidadId: n.entidad_id,
        entidadNombre: n.entidad_nombre,
        documentoOrigenId: n.documento_origen_id,
        documentoOrigenNumero: n.documento_origen_numero,
        fecha: n.fecha,
        moneda: n.moneda || 'USD',
        monto: parseFloat(n.monto) || 0,
        montoAplicado: parseFloat(n.monto_aplicado) || 0,
        saldo: parseFloat(n.saldo) || parseFloat(n.monto) || 0,
        motivo: n.motivo,
        estado: n.estado,
        creadoPor: n.creado_por,
        createdAt: n.created_at,
      })));
    }
  };

  const loadGestionesCobranza = async () => {
    const { data } = await supabase
      .from('gestiones_cobranza')
      .select('*, contactos:contactos_cobranza(*)')
      .order('dias_vencido', { ascending: false });

    if (data) {
      setGestionesCobranza(data.map((g: any) => ({
        id: g.id,
        documentoId: g.documento_id,
        clienteId: g.cliente_id,
        clienteNombre: g.cliente_nombre,
        estado: g.estado,
        prioridad: g.prioridad || 'media',
        montoOriginal: parseFloat(g.monto_original) || 0,
        montoPendiente: parseFloat(g.monto_pendiente) || 0,
        diasVencido: g.dias_vencido || 0,
        fechaUltimoContacto: g.fecha_ultimo_contacto,
        fechaProximoContacto: g.fecha_proximo_contacto,
        promesaPagoFecha: g.promesa_pago_fecha,
        promesaPagoMonto: parseFloat(g.promesa_pago_monto) || 0,
        asignadoA: g.asignado_a,
        contactos: (g.contactos || []).map((c: any) => ({
          id: c.id,
          gestionId: c.gestion_id,
          tipo: c.tipo,
          fecha: c.fecha,
          resultado: c.resultado,
          descripcion: c.descripcion,
          promesaPago: c.promesa_pago,
          promesaFecha: c.promesa_fecha,
          promesaMonto: parseFloat(c.promesa_monto) || 0,
          proximoContacto: c.proximo_contacto,
          realizadoPor: c.realizado_por,
          createdAt: c.created_at,
        })),
        notas: g.notas,
        createdAt: g.created_at,
        updatedAt: g.updated_at,
      })));
    }
  };

  const loadPresupuestos = async () => {
    const { data } = await supabase
      .from('presupuestos_financieros')
      .select('*')
      .eq('año', añoPresupuesto)
      .order('mes')
      .order('categoria');

    if (data) {
      setPresupuestos(data.map((p: any) => ({
        id: p.id,
        año: p.año,
        mes: p.mes,
        categoria: p.categoria,
        tipo: p.tipo,
        montoPresupuestado: parseFloat(p.monto_presupuestado) || 0,
        montoReal: parseFloat(p.monto_real) || 0,
        variacion: (parseFloat(p.monto_real) || 0) - (parseFloat(p.monto_presupuestado) || 0),
        variacionPct: parseFloat(p.monto_presupuestado) > 0 
          ? (((parseFloat(p.monto_real) || 0) - (parseFloat(p.monto_presupuestado) || 0)) / parseFloat(p.monto_presupuestado)) * 100
          : 0,
        notas: p.notas,
      })));
    }
  };

  const loadProgramacionesPago = async () => {
    const { data } = await supabase
      .from('programacion_pagos')
      .select('*')
      .in('estado', ['programado', 'aprobado'])
      .order('fecha_programada');

    if (data) {
      setProgramacionesPago(data.map((p: any) => ({
        id: p.id,
        documentoId: p.documento_id,
        proveedorId: p.proveedor_id,
        proveedorNombre: p.proveedor_nombre,
        fechaProgramada: p.fecha_programada,
        monto: parseFloat(p.monto) || 0,
        moneda: p.moneda || 'USD',
        cuentaId: p.cuenta_id,
        cuentaNombre: p.cuenta_nombre,
        metodoPago: p.metodo_pago,
        estado: p.estado,
        prioridad: p.prioridad || 1,
        aprobadoPor: p.aprobado_por,
        ejecutadoPor: p.ejecutado_por,
        transaccionId: p.transaccion_id,
        notas: p.notas,
        createdAt: p.created_at,
      })));
    }
  };

  // Recargar presupuestos cuando cambia año
  useEffect(() => {
    if (!loading) {
      loadPresupuestos();
    }
  }, [añoPresupuesto]);

  // ============================================
  // CONTINÚA EN PARTE 3
  // ============================================
  // ============================================
  // ACCIONES - CUENTAS
  // ============================================

  const crearCuenta = async () => {
    if (!cuentaForm.nombre) {
      toast.warning('Ingrese nombre de cuenta');
      return;
    }

    try {
      setProcesando('cuenta');

      const { error } = await supabase.from('cuentas_bancarias').insert({
        nombre: cuentaForm.nombre,
        banco: cuentaForm.banco || null,
        numero_cuenta: cuentaForm.numeroCuenta || null,
        tipo: cuentaForm.tipo,
        moneda: cuentaForm.moneda,
        saldo_actual: cuentaForm.saldoActual,
        saldo_disponible: cuentaForm.saldoActual,
        activo: true,
      });

      if (error) throw error;

      toast.success('Cuenta creada');
      setModalType(null);
      setCuentaForm({ nombre: '', banco: '', numeroCuenta: '', tipo: 'banco', moneda: 'USD', saldoActual: 0 });
      loadCuentas();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // ACCIONES - CREAR DOCUMENTO CxC
  // ============================================

  const crearDocumentoCxC = async () => {
    if (!cxcForm.clienteId || !cxcForm.numero || cxcForm.subtotal <= 0) {
      toast.warning('Complete los campos requeridos');
      return;
    }

    try {
      setProcesando('cxc');

      const total = cxcForm.subtotal + cxcForm.impuestos;
      const cliente = clientes.find(c => c.id === cxcForm.clienteId);

      const { error } = await supabase.from('cuentas_por_cobrar').insert({
        numero: cxcForm.numero,
        cliente_id: cxcForm.clienteId,
        tipo: cxcForm.tipo,
        fecha_emision: cxcForm.fechaEmision,
        fecha_vencimiento: cxcForm.fechaVencimiento || cxcForm.fechaEmision,
        moneda: monedaActiva,
        subtotal: cxcForm.subtotal,
        impuestos: cxcForm.impuestos,
        total: total,
        monto_pagado: 0,
        saldo: total,
        estado: 'pendiente',
        notas: cxcForm.notas || null,
      });

      if (error) throw error;

      toast.success('Documento creado');
      setModalType(null);
      setCxcForm({
        clienteId: '',
        tipo: 'factura',
        numero: '',
        fechaEmision: new Date().toISOString().split('T')[0],
        fechaVencimiento: '',
        subtotal: 0,
        impuestos: 0,
        notas: '',
      });
      loadDocumentosCxC();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // ACCIONES - CREAR DOCUMENTO CxP
  // ============================================

  const crearDocumentoCxP = async () => {
    if (!cxpForm.proveedorId || !cxpForm.numero || cxpForm.subtotal <= 0) {
      toast.warning('Complete los campos requeridos');
      return;
    }

    try {
      setProcesando('cxp');

      const total = cxpForm.subtotal + cxpForm.impuestos;
      const proveedor = proveedores.find(p => p.id === cxpForm.proveedorId);

      const { error } = await supabase.from('cuentas_por_pagar').insert({
        numero: cxpForm.numero,
        proveedor_id: cxpForm.proveedorId,
        tipo: cxpForm.tipo,
        fecha_emision: cxpForm.fechaEmision,
        fecha_vencimiento: cxpForm.fechaVencimiento || cxpForm.fechaEmision,
        moneda: monedaActiva,
        subtotal: cxpForm.subtotal,
        impuestos: cxpForm.impuestos,
        retenciones: 0,
        total: total,
        monto_pagado: 0,
        saldo: total,
        estado: 'pendiente',
        notas: cxpForm.notas || null,
      });

      if (error) throw error;

      toast.success('Documento creado');
      setModalType(null);
      setCxpForm({
        proveedorId: '',
        tipo: 'factura',
        numero: '',
        fechaEmision: new Date().toISOString().split('T')[0],
        fechaVencimiento: '',
        subtotal: 0,
        impuestos: 0,
        notas: '',
      });
      loadDocumentosCxP();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // ACCIONES - COBROS (CxC)
  // ============================================

  const registrarCobro = async () => {
    if (!pagoForm.documentoId || !pagoForm.cuentaId || pagoForm.monto <= 0) {
      toast.warning('Complete los datos del cobro');
      return;
    }

    try {
      setProcesando('cobro');

      const doc = documentosCxC.find(d => d.id === pagoForm.documentoId);
      if (!doc) throw new Error('Documento no encontrado');

      if (pagoForm.monto > doc.saldo) {
        toast.warning('El monto excede el saldo pendiente');
        return;
      }

      // Insertar pago
      const { error: pagoError } = await supabase.from('pagos_recibidos').insert({
        documento_id: pagoForm.documentoId,
        cuenta_id: pagoForm.cuentaId,
        fecha: pagoForm.fecha,
        monto: pagoForm.monto,
        moneda: doc.moneda,
        metodo_pago: pagoForm.metodoPago,
        referencia: pagoForm.referencia || null,
        notas: pagoForm.notas || null,
        creado_por: user?.email,
      });

      if (pagoError) throw pagoError;

      // Actualizar documento
      const nuevoMontoPagado = doc.montoPagado + pagoForm.monto;
      const nuevoSaldo = doc.total - nuevoMontoPagado;
      const nuevoEstado: EstadoDocumento = nuevoSaldo <= 0 ? 'pagado' : 'parcial';

      await supabase.from('cuentas_por_cobrar').update({
        monto_pagado: nuevoMontoPagado,
        saldo: nuevoSaldo,
        estado: nuevoEstado,
      }).eq('id', pagoForm.documentoId);

      // Actualizar saldo cuenta
      const cuenta = cuentas.find(c => c.id === pagoForm.cuentaId);
      if (cuenta) {
        await supabase.from('cuentas_bancarias').update({
          saldo_actual: cuenta.saldoActual + pagoForm.monto,
          saldo_disponible: (cuenta.saldoDisponible || cuenta.saldoActual) + pagoForm.monto,
        }).eq('id', pagoForm.cuentaId);
      }

      // Registrar transacción
      await supabase.from('transacciones_financieras').insert({
        cuenta_id: pagoForm.cuentaId,
        tipo: 'ingreso',
        monto: pagoForm.monto,
        moneda: doc.moneda,
        fecha: pagoForm.fecha,
        concepto: `Cobro ${doc.numero} - ${doc.cliente?.nombre || 'Cliente'}`,
        categoria: 'Ventas',
        referencia: pagoForm.referencia,
        documento_tipo: 'cxc',
        documento_id: pagoForm.documentoId,
        creado_por: user?.email,
      });

      // Si la gestión de cobranza existe, actualizarla
      const gestion = gestionesCobranza.find(g => g.documentoId === pagoForm.documentoId);
      if (gestion && nuevoSaldo <= 0) {
        await supabase.from('gestiones_cobranza').update({
          estado: 'cobrado',
          monto_pendiente: 0,
        }).eq('id', gestion.id);
      }

      toast.success('Cobro registrado');
      setModalType(null);
      resetPagoForm();
      loadAllData();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // ACCIONES - PAGOS (CxP)
  // ============================================

  const registrarPago = async () => {
    if (!pagoForm.documentoId || !pagoForm.cuentaId || pagoForm.monto <= 0) {
      toast.warning('Complete los datos del pago');
      return;
    }

    try {
      setProcesando('pago');

      const doc = documentosCxP.find(d => d.id === pagoForm.documentoId);
      if (!doc) throw new Error('Documento no encontrado');

      const montoTotal = pagoForm.monto + pagoForm.retencionIVA + pagoForm.retencionRenta;
      if (montoTotal > doc.saldo) {
        toast.warning('El monto total excede el saldo pendiente');
        return;
      }

      // Insertar pago
      const { error: pagoError } = await supabase.from('pagos_realizados').insert({
        documento_id: pagoForm.documentoId,
        cuenta_id: pagoForm.cuentaId,
        fecha: pagoForm.fecha,
        monto: pagoForm.monto,
        moneda: doc.moneda,
        metodo_pago: pagoForm.metodoPago,
        referencia: pagoForm.referencia || null,
        retencion_iva: pagoForm.retencionIVA || 0,
        retencion_renta: pagoForm.retencionRenta || 0,
        notas: pagoForm.notas || null,
        creado_por: user?.email,
      });

      if (pagoError) throw pagoError;

      // Actualizar documento
      const nuevoMontoPagado = doc.montoPagado + montoTotal;
      const nuevoSaldo = doc.total - nuevoMontoPagado;
      const nuevoEstado: EstadoDocumento = nuevoSaldo <= 0 ? 'pagado' : 'parcial';

      await supabase.from('cuentas_por_pagar').update({
        monto_pagado: nuevoMontoPagado,
        saldo: nuevoSaldo,
        estado: nuevoEstado,
      }).eq('id', pagoForm.documentoId);

      // Actualizar saldo cuenta
      const cuenta = cuentas.find(c => c.id === pagoForm.cuentaId);
      if (cuenta) {
        await supabase.from('cuentas_bancarias').update({
          saldo_actual: cuenta.saldoActual - pagoForm.monto,
          saldo_disponible: (cuenta.saldoDisponible || cuenta.saldoActual) - pagoForm.monto,
        }).eq('id', pagoForm.cuentaId);
      }

      // Registrar transacción
      await supabase.from('transacciones_financieras').insert({
        cuenta_id: pagoForm.cuentaId,
        tipo: 'egreso',
        monto: pagoForm.monto,
        moneda: doc.moneda,
        fecha: pagoForm.fecha,
        concepto: `Pago ${doc.numero} - ${doc.proveedor?.nombre || 'Proveedor'}`,
        categoria: doc.tipo === 'gasto' ? 'Gastos' : 'Mercadería',
        referencia: pagoForm.referencia,
        documento_tipo: 'cxp',
        documento_id: pagoForm.documentoId,
        creado_por: user?.email,
      });

      toast.success('Pago registrado');
      setModalType(null);
      resetPagoForm();
      loadAllData();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // ACCIONES - TRANSACCIONES
  // ============================================

  const crearTransaccion = async () => {
    if (!transaccionForm.cuentaId || transaccionForm.monto <= 0 || !transaccionForm.concepto) {
      toast.warning('Complete los datos de la transacción');
      return;
    }

    try {
      setProcesando('transaccion');

      const cuenta = cuentas.find(c => c.id === transaccionForm.cuentaId);
      if (!cuenta) throw new Error('Cuenta no encontrada');

      // Insertar transacción
      const { error } = await supabase.from('transacciones_financieras').insert({
        cuenta_id: transaccionForm.cuentaId,
        tipo: transaccionForm.tipo,
        monto: transaccionForm.monto,
        moneda: cuenta.moneda,
        fecha: transaccionForm.fecha,
        concepto: transaccionForm.concepto,
        categoria: transaccionForm.categoria || null,
        referencia: transaccionForm.referencia || null,
        notas: transaccionForm.notas || null,
        creado_por: user?.email,
      });

      if (error) throw error;

      // Actualizar saldo cuenta
      const ajuste = transaccionForm.tipo === 'ingreso' ? transaccionForm.monto : -transaccionForm.monto;
      await supabase.from('cuentas_bancarias').update({
        saldo_actual: cuenta.saldoActual + ajuste,
        saldo_disponible: (cuenta.saldoDisponible || cuenta.saldoActual) + ajuste,
      }).eq('id', transaccionForm.cuentaId);

      // Actualizar presupuesto real si hay categoría
      if (transaccionForm.categoria) {
        await actualizarPresupuestoReal(
          transaccionForm.fecha,
          transaccionForm.categoria,
          transaccionForm.tipo === 'ingreso' ? 'ingreso' : 'egreso',
          transaccionForm.monto
        );
      }

      toast.success('Transacción registrada');
      setModalType(null);
      resetTransaccionForm();
      loadAllData();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // ACCIONES - CHEQUES
  // ============================================

  const crearCheque = async () => {
    if (!chequeForm.numero || !chequeForm.banco || chequeForm.monto <= 0) {
      toast.warning('Complete los datos del cheque');
      return;
    }

    try {
      setProcesando('cheque');

      const { error } = await supabase.from('cheques').insert({
        tipo: chequeForm.tipo,
        numero: chequeForm.numero,
        banco: chequeForm.banco,
        monto: chequeForm.monto,
        moneda: chequeForm.moneda,
        fecha_emision: chequeForm.fechaEmision,
        fecha_vencimiento: chequeForm.fechaVencimiento || null,
        beneficiario: chequeForm.beneficiario || null,
        librador: chequeForm.librador || null,
        estado: chequeForm.tipo === 'recibido' ? 'cartera' : 'entregado',
        notas: chequeForm.notas || null,
      });

      if (error) throw error;

      toast.success('Cheque registrado');
      setModalType(null);
      resetChequeForm();
      loadCheques();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  const cambiarEstadoCheque = async (cheque: Cheque, nuevoEstado: EstadoCheque, cuentaId?: string) => {
    try {
      setProcesando(cheque.id);

      await supabase.from('cheques').update({
        estado: nuevoEstado,
        cuenta_id: cuentaId || cheque.cuentaId,
      }).eq('id', cheque.id);

      // Si se cobra/deposita, actualizar saldo de cuenta
      if (nuevoEstado === 'cobrado' && cuentaId) {
        const cuenta = cuentas.find(c => c.id === cuentaId);
        if (cuenta) {
          const ajuste = cheque.tipo === 'recibido' ? cheque.monto : -cheque.monto;
          await supabase.from('cuentas_bancarias').update({
            saldo_actual: cuenta.saldoActual + ajuste,
          }).eq('id', cuentaId);

          // Registrar transacción
          await supabase.from('transacciones_financieras').insert({
            cuenta_id: cuentaId,
            tipo: cheque.tipo === 'recibido' ? 'ingreso' : 'egreso',
            monto: cheque.monto,
            moneda: cheque.moneda,
            fecha: new Date().toISOString().split('T')[0],
            concepto: `Cheque ${cheque.numero} - ${cheque.banco}`,
            categoria: 'Cheques',
            documento_tipo: 'cheque',
            documento_id: cheque.id,
            creado_por: user?.email,
          });
        }
      }

      toast.success('Cheque actualizado');
      loadAllData();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // ACCIONES - TIPO DE CAMBIO
  // ============================================

  const guardarTipoCambio = async () => {
    if (tipoCambioForm.tasa <= 0) {
      toast.warning('Ingrese una tasa válida');
      return;
    }

    try {
      setProcesando('tipocambio');

      const { error } = await supabase.from('tipos_cambio').insert({
        moneda_origen: tipoCambioForm.monedaOrigen,
        moneda_destino: tipoCambioForm.monedaDestino,
        tasa: tipoCambioForm.tasa,
        fecha: tipoCambioForm.fecha,
      });

      if (error) throw error;

      toast.success('Tipo de cambio guardado');
      setModalType(null);
      loadTiposCambio();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // ACCIONES - NOTAS CRÉDITO/DÉBITO
  // ============================================

  const crearNota = async () => {
    if (!notaForm.entidadId || notaForm.monto <= 0 || !notaForm.motivo) {
      toast.warning('Complete los datos de la nota');
      return;
    }

    try {
      setProcesando('nota');

      const entidad = notaForm.origen === 'cliente' 
        ? clientes.find(c => c.id === notaForm.entidadId)
        : proveedores.find(p => p.id === notaForm.entidadId);

      const numero = `NC-${Date.now().toString().slice(-8)}`;

      const { error } = await supabase.from('notas_credito_debito').insert({
        numero,
        tipo: notaForm.tipo,
        origen: notaForm.origen,
        entidad_id: notaForm.entidadId,
        entidad_nombre: entidad?.nombre,
        documento_origen_id: notaForm.documentoOrigenId || null,
        fecha: new Date().toISOString().split('T')[0],
        moneda: monedaActiva,
        monto: notaForm.monto,
        monto_aplicado: 0,
        saldo: notaForm.monto,
        motivo: notaForm.motivo,
        estado: 'pendiente',
        creado_por: user?.email,
      });

      if (error) throw error;

      toast.success('Nota creada');
      setModalType(null);
      setNotaForm({ tipo: 'credito', origen: 'cliente', entidadId: '', documentoOrigenId: '', monto: 0, motivo: '' });
      loadNotasCD();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  const aplicarNota = async (nota: NotaCreditoDebito, documentoId: string, monto: number) => {
    try {
      setProcesando(nota.id);

      if (monto > nota.saldo) {
        toast.warning('El monto excede el saldo de la nota');
        return;
      }

      // Aplicar al documento
      if (nota.origen === 'cliente') {
        const doc = documentosCxC.find(d => d.id === documentoId);
        if (doc) {
          const nuevoSaldo = doc.saldo - monto;
          await supabase.from('cuentas_por_cobrar').update({
            monto_pagado: doc.montoPagado + monto,
            saldo: nuevoSaldo,
            estado: nuevoSaldo <= 0 ? 'pagado' : 'parcial',
          }).eq('id', documentoId);
        }
      } else {
        const doc = documentosCxP.find(d => d.id === documentoId);
        if (doc) {
          const nuevoSaldo = doc.saldo - monto;
          await supabase.from('cuentas_por_pagar').update({
            monto_pagado: doc.montoPagado + monto,
            saldo: nuevoSaldo,
            estado: nuevoSaldo <= 0 ? 'pagado' : 'parcial',
          }).eq('id', documentoId);
        }
      }

      // Actualizar nota
      const nuevoMontoAplicado = nota.montoAplicado + monto;
      const nuevoSaldoNota = nota.monto - nuevoMontoAplicado;

      await supabase.from('notas_credito_debito').update({
        monto_aplicado: nuevoMontoAplicado,
        saldo: nuevoSaldoNota,
        estado: nuevoSaldoNota <= 0 ? 'aplicada' : 'parcial',
      }).eq('id', nota.id);

      toast.success('Nota aplicada');
      loadAllData();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // ACCIONES - COBRANZA
  // ============================================

  const crearGestionCobranza = async (documentoId: string) => {
    try {
      setProcesando('gestion');

      const doc = documentosCxC.find(d => d.id === documentoId);
      if (!doc) throw new Error('Documento no encontrado');

      const diasVencido = -getDiasVencimiento(doc.fechaVencimiento);

      const { error } = await supabase.from('gestiones_cobranza').insert({
        documento_id: documentoId,
        cliente_id: doc.clienteId,
        cliente_nombre: doc.cliente?.nombre,
        estado: 'pendiente',
        prioridad: diasVencido > 90 ? 'urgente' : diasVencido > 60 ? 'alta' : diasVencido > 30 ? 'media' : 'baja',
        monto_original: doc.total,
        monto_pendiente: doc.saldo,
        dias_vencido: diasVencido,
        asignado_a: user?.email,
      });

      if (error) throw error;

      toast.success('Gestión de cobranza creada');
      loadGestionesCobranza();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  const registrarContactoCobranza = async (gestionId: string) => {
    if (!contactoForm.descripcion) {
      toast.warning('Ingrese una descripción');
      return;
    }

    try {
      setProcesando('contacto');

      const { error } = await supabase.from('contactos_cobranza').insert({
        gestion_id: gestionId,
        tipo: contactoForm.tipo,
        fecha: new Date().toISOString(),
        resultado: contactoForm.resultado,
        descripcion: contactoForm.descripcion,
        promesa_pago: contactoForm.promesaPago,
        promesa_fecha: contactoForm.promesaPago ? contactoForm.promesaFecha : null,
        promesa_monto: contactoForm.promesaPago ? contactoForm.promesaMonto : null,
        proximo_contacto: contactoForm.proximoContacto || null,
        realizado_por: user?.email,
      });

      if (error) throw error;

      // Actualizar gestión
      const nuevoEstado = contactoForm.promesaPago ? 'promesa_pago' : 'contactado';
      await supabase.from('gestiones_cobranza').update({
        estado: nuevoEstado,
        fecha_ultimo_contacto: new Date().toISOString(),
        fecha_proximo_contacto: contactoForm.proximoContacto || null,
        promesa_pago_fecha: contactoForm.promesaPago ? contactoForm.promesaFecha : null,
        promesa_pago_monto: contactoForm.promesaPago ? contactoForm.promesaMonto : null,
      }).eq('id', gestionId);

      toast.success('Contacto registrado');
      setModalType(null);
      resetContactoForm();
      loadGestionesCobranza();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // ACCIONES - PRESUPUESTO
  // ============================================

  const guardarPresupuesto = async () => {
    if (!presupuestoForm.categoria || presupuestoForm.monto <= 0) {
      toast.warning('Complete los datos del presupuesto');
      return;
    }

    try {
      setProcesando('presupuesto');

      const { error } = await supabase.from('presupuestos_financieros').upsert({
        año: añoPresupuesto,
        mes: mesPresupuesto,
        categoria: presupuestoForm.categoria,
        tipo: presupuestoForm.tipo,
        monto_presupuestado: presupuestoForm.monto,
      }, {
        onConflict: 'año,mes,categoria,tipo'
      });

      if (error) throw error;

      toast.success('Presupuesto guardado');
      setModalType(null);
      setPresupuestoForm({ categoria: '', tipo: 'egreso', monto: 0 });
      loadPresupuestos();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  const actualizarPresupuestoReal = async (fecha: string, categoria: string, tipo: 'ingreso' | 'egreso', monto: number) => {
    try {
      const fechaObj = new Date(fecha);
      const año = fechaObj.getFullYear();
      const mes = fechaObj.getMonth() + 1;

      // Buscar presupuesto existente
      const { data } = await supabase
        .from('presupuestos_financieros')
        .select('*')
        .eq('año', año)
        .eq('mes', mes)
        .eq('categoria', categoria)
        .eq('tipo', tipo)
        .single();

      if (data) {
        await supabase.from('presupuestos_financieros').update({
          monto_real: (parseFloat(data.monto_real) || 0) + monto,
        }).eq('id', data.id);
      }
    } catch (error) {
      console.error('Error actualizando presupuesto real:', error);
    }
  };

  // ============================================
  // ACCIONES - CONCILIACIÓN
  // ============================================

  const importarExtractoBancario = async (file: File) => {
    try {
      setProcesando('import');
      
      const text = await file.text();
      const lines = text.split('\n');
      const movimientos: any[] = [];

      // Parsear CSV (formato: fecha, descripcion, referencia, debito, credito, saldo)
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
        if (cols.length >= 5) {
          const debito = parseFloat(cols[3]) || 0;
          const credito = parseFloat(cols[4]) || 0;
          
          movimientos.push({
            cuenta_id: cuentaConciliacion,
            fecha: cols[0],
            descripcion: cols[1],
            referencia: cols[2] || null,
            monto: credito > 0 ? credito : debito,
            tipo: credito > 0 ? 'credito' : 'debito',
            saldo_posterior: cols[5] ? parseFloat(cols[5]) : null,
            estado_conciliacion: 'pendiente',
            importado_desde: file.name,
          });
        }
      }

      if (movimientos.length > 0) {
        const { error } = await supabase.from('movimientos_bancarios').insert(movimientos);
        if (error) throw error;
        
        toast.success(`${movimientos.length} movimientos importados`);
        loadMovimientosBancarios();
      } else {
        toast.warning('No se encontraron movimientos válidos');
      }
    } catch (error: any) {
      toast.error('Error importando', error.message);
    } finally {
      setProcesando(null);
    }
  };

  const loadMovimientosBancarios = async () => {
    if (!cuentaConciliacion) return;

    const { data } = await supabase
      .from('movimientos_bancarios')
      .select('*')
      .eq('cuenta_id', cuentaConciliacion)
      .eq('estado_conciliacion', 'pendiente')
      .order('fecha');

    if (data) {
      setMovimientosParaConciliar(data.map((m: any) => ({
        id: m.id,
        cuentaId: m.cuenta_id,
        fecha: m.fecha,
        descripcion: m.descripcion,
        referencia: m.referencia,
        monto: parseFloat(m.monto) || 0,
        tipo: m.tipo,
        saldoPosterior: parseFloat(m.saldo_posterior) || undefined,
        estadoConciliacion: m.estado_conciliacion,
        transaccionId: m.transaccion_id,
        notasConciliacion: m.notas_conciliacion,
        importadoDesde: m.importado_desde,
        createdAt: m.created_at,
      })));
    }

    // Cargar transacciones no conciliadas de la cuenta
    const { data: trans } = await supabase
      .from('transacciones_financieras')
      .select('*')
      .eq('cuenta_id', cuentaConciliacion)
      .eq('conciliado', false)
      .order('fecha');

    if (trans) {
      setTransaccionesParaConciliar(trans.map((t: any) => ({
        id: t.id,
        cuentaId: t.cuenta_id,
        tipo: t.tipo,
        monto: parseFloat(t.monto) || 0,
        moneda: t.moneda,
        fecha: t.fecha,
        concepto: t.concepto,
        categoria: t.categoria,
        referencia: t.referencia,
        conciliado: t.conciliado,
        createdAt: t.created_at,
      })));
    }
  };

  const conciliarMovimiento = async (movimientoId: string, transaccionId: string) => {
    try {
      setProcesando(movimientoId);

      // Marcar movimiento bancario como conciliado
      await supabase.from('movimientos_bancarios').update({
        estado_conciliacion: 'conciliado',
        transaccion_id: transaccionId,
      }).eq('id', movimientoId);

      // Marcar transacción como conciliada
      await supabase.from('transacciones_financieras').update({
        conciliado: true,
      }).eq('id', transaccionId);

      toast.success('Conciliación exitosa');
      loadMovimientosBancarios();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  const autoMatchConciliacion = () => {
    const matches = new Map<string, string>();

    movimientosParaConciliar.forEach(mov => {
      // Buscar transacción con mismo monto y fecha cercana
      const match = transaccionesParaConciliar.find(trans => {
        const montoMatch = Math.abs(trans.monto - mov.monto) < 0.01;
        const fechaMov = new Date(mov.fecha);
        const fechaTrans = new Date(trans.fecha);
        const diasDif = Math.abs((fechaMov.getTime() - fechaTrans.getTime()) / (1000 * 60 * 60 * 24));
        const fechaMatch = diasDif <= 3;
        const tipoMatch = (mov.tipo === 'credito' && trans.tipo === 'ingreso') || 
                         (mov.tipo === 'debito' && trans.tipo === 'egreso');
        
        return montoMatch && fechaMatch && tipoMatch && !Array.from(matches.values()).includes(trans.id);
      });

      if (match) {
        matches.set(mov.id, match.id);
      }
    });

    setMatchesConciliacion(matches);
    toast.success(`${matches.size} coincidencias encontradas`);
  };

  const aplicarMatchesConciliacion = async () => {
    try {
      setProcesando('conciliar');

      for (const [movId, transId] of matchesConciliacion.entries()) {
        await conciliarMovimiento(movId, transId);
      }

      setMatchesConciliacion(new Map());
      toast.success('Conciliación completada');
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // RESET FORMS
  // ============================================

  const resetPagoForm = () => {
    setPagoForm({
      documentoId: '',
      cuentaId: '',
      fecha: new Date().toISOString().split('T')[0],
      monto: 0,
      metodoPago: 'transferencia',
      referencia: '',
      retencionIVA: 0,
      retencionRenta: 0,
      notas: '',
    });
  };

  const resetTransaccionForm = () => {
    setTransaccionForm({
      cuentaId: '',
      tipo: 'ingreso',
      monto: 0,
      fecha: new Date().toISOString().split('T')[0],
      concepto: '',
      categoria: '',
      referencia: '',
      notas: '',
    });
  };

  const resetChequeForm = () => {
    setChequeForm({
      tipo: 'recibido',
      numero: '',
      banco: '',
      monto: 0,
      moneda: 'USD',
      fechaEmision: new Date().toISOString().split('T')[0],
      fechaVencimiento: '',
      beneficiario: '',
      librador: '',
      notas: '',
    });
  };

  const resetContactoForm = () => {
    setContactoForm({
      tipo: 'llamada',
      resultado: 'exitoso',
      descripcion: '',
      promesaPago: false,
      promesaFecha: '',
      promesaMonto: 0,
      proximoContacto: '',
    });
  };

  // ============================================
  // CONTINÚA EN PARTE 4
  // ============================================
  // ============================================
  // GENERACIÓN DE ESTADOS DE CUENTA (PDF)
  // ============================================

  const generarEstadoCuentaCliente = async (clienteId: string) => {
    const cliente = clientes.find(c => c.id === clienteId);
    if (!cliente) return;

    const docs = documentosCxC.filter(d => d.clienteId === clienteId && d.saldo > 0);
    
    let html = `
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          h1 { color: #1e293b; border-bottom: 2px solid #10b981; padding-bottom: 10px; }
          .cliente-info { background: #f1f5f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #1e293b; color: white; padding: 12px; text-align: left; }
          td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
          .monto { text-align: right; font-family: monospace; }
          .total { font-weight: bold; font-size: 18px; }
          .vencido { color: #ef4444; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
        </style>
      </head>
      <body>
        <h1>Estado de Cuenta</h1>
        <div class="cliente-info">
          <strong>${cliente.nombre}</strong><br>
          Código: ${cliente.codigo}<br>
          ${cliente.email ? `Email: ${cliente.email}` : ''}
        </div>
        <p>Fecha: ${formatDate(new Date().toISOString())}</p>
        <table>
          <thead>
            <tr>
              <th>Documento</th>
              <th>Emisión</th>
              <th>Vencimiento</th>
              <th>Total</th>
              <th>Pagado</th>
              <th>Saldo</th>
              <th>Días</th>
            </tr>
          </thead>
          <tbody>
    `;

    let totalSaldo = 0;
    docs.forEach(doc => {
      const dias = -getDiasVencimiento(doc.fechaVencimiento);
      const claseVencido = dias > 0 ? 'vencido' : '';
      totalSaldo += doc.saldo;
      
      html += `
        <tr>
          <td>${doc.numero}</td>
          <td>${formatDate(doc.fechaEmision)}</td>
          <td class="${claseVencido}">${formatDate(doc.fechaVencimiento)}</td>
          <td class="monto">${formatCurrency(doc.total, doc.moneda)}</td>
          <td class="monto">${formatCurrency(doc.montoPagado, doc.moneda)}</td>
          <td class="monto">${formatCurrency(doc.saldo, doc.moneda)}</td>
          <td class="${claseVencido}">${dias > 0 ? dias : '-'}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
          <tfoot>
            <tr>
              <td colspan="5" style="text-align: right;"><strong>TOTAL PENDIENTE:</strong></td>
              <td class="monto total">${formatCurrency(totalSaldo, 'USD')}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        <div class="footer">
          Documento generado automáticamente el ${formatDateTime(new Date().toISOString())}
        </div>
      </body>
      </html>
    `;

    const ventana = window.open('', '_blank');
    if (ventana) {
      ventana.document.write(html);
      ventana.document.close();
      ventana.print();
    }
    toast.success('Estado de cuenta generado');
  };

  const generarEstadoCuentaProveedor = async (proveedorId: string) => {
    const proveedor = proveedores.find(p => p.id === proveedorId);
    if (!proveedor) return;

    const docs = documentosCxP.filter(d => d.proveedorId === proveedorId && d.saldo > 0);
    
    let html = `
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          h1 { color: #1e293b; border-bottom: 2px solid #f59e0b; padding-bottom: 10px; }
          .proveedor-info { background: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #1e293b; color: white; padding: 12px; text-align: left; }
          td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
          .monto { text-align: right; font-family: monospace; }
          .total { font-weight: bold; font-size: 18px; }
          .vencido { color: #ef4444; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
        </style>
      </head>
      <body>
        <h1>Estado de Cuenta - Proveedor</h1>
        <div class="proveedor-info">
          <strong>${proveedor.nombre}</strong><br>
          Código: ${proveedor.codigo}
        </div>
        <p>Fecha: ${formatDate(new Date().toISOString())}</p>
        <table>
          <thead>
            <tr>
              <th>Documento</th>
              <th>Emisión</th>
              <th>Vencimiento</th>
              <th>Total</th>
              <th>Pagado</th>
              <th>Saldo</th>
              <th>Días</th>
            </tr>
          </thead>
          <tbody>
    `;

    let totalSaldo = 0;
    docs.forEach(doc => {
      const dias = -getDiasVencimiento(doc.fechaVencimiento);
      const claseVencido = dias > 0 ? 'vencido' : '';
      totalSaldo += doc.saldo;
      
      html += `
        <tr>
          <td>${doc.numero}</td>
          <td>${formatDate(doc.fechaEmision)}</td>
          <td class="${claseVencido}">${formatDate(doc.fechaVencimiento)}</td>
          <td class="monto">${formatCurrency(doc.total, doc.moneda)}</td>
          <td class="monto">${formatCurrency(doc.montoPagado, doc.moneda)}</td>
          <td class="monto">${formatCurrency(doc.saldo, doc.moneda)}</td>
          <td class="${claseVencido}">${dias > 0 ? dias : '-'}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
          <tfoot>
            <tr>
              <td colspan="5" style="text-align: right;"><strong>TOTAL ADEUDADO:</strong></td>
              <td class="monto total">${formatCurrency(totalSaldo, 'USD')}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        <div class="footer">
          Documento generado automáticamente el ${formatDateTime(new Date().toISOString())}
        </div>
      </body>
      </html>
    `;

    const ventana = window.open('', '_blank');
    if (ventana) {
      ventana.document.write(html);
      ventana.document.close();
      ventana.print();
    }
    toast.success('Estado de cuenta generado');
  };

  // ============================================
  // CÁLCULOS Y MÉTRICAS
  // ============================================

  const metricas = useMemo(() => {
    const saldosPorMoneda: Record<Moneda, number> = { USD: 0, UYU: 0, EUR: 0, BRL: 0, ARS: 0 };
    cuentas.filter(c => c.activo).forEach(c => {
      saldosPorMoneda[c.moneda] += c.saldoActual;
    });

    const totalCxC = documentosCxC.filter(d => d.estado !== 'anulado').reduce((s, d) => s + d.saldo, 0);
    const cxcVencidas = documentosCxC.filter(d => d.estado !== 'anulado' && d.estado !== 'pagado' && getDiasVencimiento(d.fechaVencimiento) < 0);
    const totalCxCVencido = cxcVencidas.reduce((s, d) => s + d.saldo, 0);

    const totalCxP = documentosCxP.filter(d => d.estado !== 'anulado').reduce((s, d) => s + d.saldo, 0);
    const cxpVencidas = documentosCxP.filter(d => d.estado !== 'anulado' && d.estado !== 'pagado' && getDiasVencimiento(d.fechaVencimiento) < 0);
    const totalCxPVencido = cxpVencidas.reduce((s, d) => s + d.saldo, 0);

    const chequesCartera = cheques.filter(ch => ch.tipo === 'recibido' && ch.estado === 'cartera');
    const totalChequesCartera = chequesCartera.reduce((s, ch) => s + ch.monto, 0);
    const chequesEmitidos = cheques.filter(ch => ch.tipo === 'emitido' && ch.estado === 'entregado');
    const totalChequesEmitidos = chequesEmitidos.reduce((s, ch) => s + ch.monto, 0);

    const notasCreditoPendientes = notasCD.filter(n => n.tipo === 'credito' && n.saldo > 0);
    const totalNotasCredito = notasCreditoPendientes.reduce((s, n) => s + n.saldo, 0);

    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
    const transMes = transacciones.filter(t => t.fecha >= inicioMes);
    const ingresosMes = transMes.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.monto, 0);
    const egresosMes = transMes.filter(t => t.tipo === 'egreso').reduce((s, t) => s + t.monto, 0);

    const agingCxC = calcularAging(documentosCxC.filter(d => d.estado !== 'anulado' && d.estado !== 'pagado'));
    const agingCxP = calcularAging(documentosCxP.filter(d => d.estado !== 'anulado' && d.estado !== 'pagado'));

    const proxVencCxC = documentosCxC.filter(d => {
      const dias = getDiasVencimiento(d.fechaVencimiento);
      return d.saldo > 0 && dias >= 0 && dias <= 7;
    });
    const proxVencCxP = documentosCxP.filter(d => {
      const dias = getDiasVencimiento(d.fechaVencimiento);
      return d.saldo > 0 && dias >= 0 && dias <= 7;
    });

    const gestionesPendientes = gestionesCobranza.filter(g => !['cobrado', 'incobrable'].includes(g.estado));
    const montoEnGestion = gestionesPendientes.reduce((s, g) => s + g.montoPendiente, 0);

    const pagosProximos7Dias = programacionesPago.filter(p => {
      const dias = getDiasVencimiento(p.fechaProgramada);
      return dias >= 0 && dias <= 7;
    });
    const montoPagosProximos = pagosProximos7Dias.reduce((s, p) => s + p.monto, 0);

    return {
      saldosPorMoneda,
      totalCxC,
      totalCxCVencido,
      cxcVencidas: cxcVencidas.length,
      totalCxP,
      totalCxPVencido,
      cxpVencidas: cxpVencidas.length,
      totalChequesCartera,
      chequesCartera: chequesCartera.length,
      totalChequesEmitidos,
      chequesEmitidos: chequesEmitidos.length,
      totalNotasCredito,
      notasCreditoPendientes: notasCreditoPendientes.length,
      ingresosMes,
      egresosMes,
      flujoNetoMes: ingresosMes - egresosMes,
      agingCxC,
      agingCxP,
      proxVencCxC,
      proxVencCxP,
      gestionesPendientes: gestionesPendientes.length,
      montoEnGestion,
      pagosProximos7Dias: pagosProximos7Dias.length,
      montoPagosProximos,
    };
  }, [cuentas, documentosCxC, documentosCxP, cheques, notasCD, transacciones, gestionesCobranza, programacionesPago]);

  const proyeccionFlujo = useMemo((): ProyeccionFlujo[] => {
    const proyeccion: ProyeccionFlujo[] = [];
    const hoy = new Date();
    let saldoAcumulado = cuentas.filter(c => c.activo && c.moneda === monedaActiva).reduce((s, c) => s + c.saldoActual, 0);

    for (let i = 0; i < 30; i++) {
      const fecha = new Date(hoy);
      fecha.setDate(fecha.getDate() + i);
      const fechaStr = fecha.toISOString().split('T')[0];

      const ingresosDelDia = documentosCxC
        .filter(d => d.fechaVencimiento === fechaStr && d.saldo > 0 && d.moneda === monedaActiva)
        .map(d => ({ concepto: `${d.numero} - ${d.cliente?.nombre}`, monto: d.saldo }));
      const totalIngresos = ingresosDelDia.reduce((s, i) => s + i.monto, 0);

      const egresosDelDia = documentosCxP
        .filter(d => d.fechaVencimiento === fechaStr && d.saldo > 0 && d.moneda === monedaActiva)
        .map(d => ({ concepto: `${d.numero} - ${d.proveedor?.nombre}`, monto: d.saldo }));
      
      programacionesPago
        .filter(p => p.fechaProgramada === fechaStr && p.moneda === monedaActiva)
        .forEach(p => egresosDelDia.push({ concepto: `Prog: ${p.proveedorNombre}`, monto: p.monto }));

      const totalEgresos = egresosDelDia.reduce((s, e) => s + e.monto, 0);
      saldoAcumulado += totalIngresos - totalEgresos;

      proyeccion.push({
        fecha: fechaStr,
        ingresos: totalIngresos,
        egresos: totalEgresos,
        saldoProyectado: saldoAcumulado,
        detalleIngresos: ingresosDelDia,
        detalleEgresos: egresosDelDia,
      });
    }
    return proyeccion;
  }, [documentosCxC, documentosCxP, programacionesPago, cuentas, monedaActiva]);

  const resumenPresupuesto = useMemo((): ResumenPresupuesto => {
    const presupuestosMes = presupuestos.filter(p => p.mes === mesPresupuesto);
    
    const totalPresupuestadoIngresos = presupuestosMes.filter(p => p.tipo === 'ingreso').reduce((s, p) => s + p.montoPresupuestado, 0);
    const totalRealIngresos = presupuestosMes.filter(p => p.tipo === 'ingreso').reduce((s, p) => s + p.montoReal, 0);
    const totalPresupuestadoEgresos = presupuestosMes.filter(p => p.tipo === 'egreso').reduce((s, p) => s + p.montoPresupuestado, 0);
    const totalRealEgresos = presupuestosMes.filter(p => p.tipo === 'egreso').reduce((s, p) => s + p.montoReal, 0);

    return {
      año: añoPresupuesto,
      mes: mesPresupuesto,
      totalPresupuestadoIngresos,
      totalRealIngresos,
      totalPresupuestadoEgresos,
      totalRealEgresos,
      balancePresupuestado: totalPresupuestadoIngresos - totalPresupuestadoEgresos,
      balanceReal: totalRealIngresos - totalRealEgresos,
      variacionBalance: (totalRealIngresos - totalRealEgresos) - (totalPresupuestadoIngresos - totalPresupuestadoEgresos),
    };
  }, [presupuestos, añoPresupuesto, mesPresupuesto]);

  // ============================================
  // FILTROS
  // ============================================

  const documentosCxCFiltrados = useMemo(() => {
    return documentosCxC.filter(d => {
      if (filterEstado !== 'todos' && d.estado !== filterEstado) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!d.numero.toLowerCase().includes(search) && 
            !d.cliente?.nombre?.toLowerCase().includes(search)) return false;
      }
      return true;
    });
  }, [documentosCxC, filterEstado, searchTerm]);

  const documentosCxPFiltrados = useMemo(() => {
    return documentosCxP.filter(d => {
      if (filterEstado !== 'todos' && d.estado !== filterEstado) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!d.numero.toLowerCase().includes(search) && 
            !d.proveedor?.nombre?.toLowerCase().includes(search)) return false;
      }
      return true;
    });
  }, [documentosCxP, filterEstado, searchTerm]);

  const gestionesCobranzaFiltradas = useMemo(() => {
    return gestionesCobranza.filter(g => {
      if (filterEstadoCobranza !== 'todos' && g.estado !== filterEstadoCobranza) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!g.clienteNombre?.toLowerCase().includes(search)) return false;
      }
      return true;
    });
  }, [gestionesCobranza, filterEstadoCobranza, searchTerm]);

  // ============================================
  // CONTINÚA EN PARTE 5 (RENDER)
  // ============================================
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

  return (
    <div className="space-y-6">
      <toast.ToastContainer />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <CircleDollarSign className="h-7 w-7 text-emerald-400" />
            Finanzas
          </h2>
          <p className="text-slate-400 text-sm mt-1">Gestión financiera integral</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={monedaActiva}
            onChange={(e) => setMonedaActiva(e.target.value as Moneda)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100"
          >
            {Object.entries(MONEDAS_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.simbolo} {config.nombre}</option>
            ))}
          </select>
          <button onClick={() => setModalType('tipoCambio')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400" title="Tipo de cambio">
            <Calculator className="h-4 w-4" />
          </button>
          <button onClick={loadAllData} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900/50 p-1 rounded-xl overflow-x-auto">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="h-4 w-4" /> },
          { id: 'cxc', label: 'Cuentas por Cobrar', icon: <ArrowUpRight className="h-4 w-4" /> },
          { id: 'cxp', label: 'Cuentas por Pagar', icon: <ArrowDownRight className="h-4 w-4" /> },
          { id: 'cobranza', label: 'Cobranza', icon: <Phone className="h-4 w-4" /> },
          { id: 'flujo', label: 'Flujo de Caja', icon: <TrendingUp className="h-4 w-4" /> },
          { id: 'transacciones', label: 'Transacciones', icon: <History className="h-4 w-4" /> },
          { id: 'cheques', label: 'Cheques', icon: <FileCheck className="h-4 w-4" /> },
          { id: 'conciliacion', label: 'Conciliación', icon: <Scale className="h-4 w-4" /> },
          { id: 'presupuesto', label: 'Presupuesto', icon: <Target className="h-4 w-4" /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setTabActiva(tab.id as TabActiva)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              tabActiva === tab.id
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
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
                <Wallet className="h-5 w-5 text-emerald-400" />
                <span className="text-sm text-slate-400">Saldo Disponible</span>
              </div>
              <div className="text-2xl font-bold text-emerald-400">
                {formatCurrency(metricas.saldosPorMoneda[monedaActiva], monedaActiva)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {cuentas.filter(c => c.activo && c.moneda === monedaActiva).length} cuentas
              </div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowUpRight className="h-5 w-5 text-cyan-400" />
                <span className="text-sm text-slate-400">Por Cobrar</span>
              </div>
              <div className="text-2xl font-bold text-cyan-400">
                {formatCurrency(metricas.totalCxC, monedaActiva)}
              </div>
              {metricas.cxcVencidas > 0 && (
                <div className="text-xs text-red-400 mt-1">
                  {metricas.cxcVencidas} vencidas ({formatCurrency(metricas.totalCxCVencido, monedaActiva)})
                </div>
              )}
            </div>
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowDownRight className="h-5 w-5 text-amber-400" />
                <span className="text-sm text-slate-400">Por Pagar</span>
              </div>
              <div className="text-2xl font-bold text-amber-400">
                {formatCurrency(metricas.totalCxP, monedaActiva)}
              </div>
              {metricas.cxpVencidas > 0 && (
                <div className="text-xs text-red-400 mt-1">
                  {metricas.cxpVencidas} vencidas ({formatCurrency(metricas.totalCxPVencido, monedaActiva)})
                </div>
              )}
            </div>
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-purple-400" />
                <span className="text-sm text-slate-400">Flujo del Mes</span>
              </div>
              <div className={`text-2xl font-bold ${metricas.flujoNetoMes >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {metricas.flujoNetoMes >= 0 ? '+' : ''}{formatCurrency(metricas.flujoNetoMes, monedaActiva)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Ing: {formatCurrency(metricas.ingresosMes, monedaActiva)} / Egr: {formatCurrency(metricas.egresosMes, monedaActiva)}
              </div>
            </div>
          </div>

          {/* Segunda fila KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileCheck className="h-5 w-5 text-blue-400" />
                <span className="text-sm text-slate-400">Cheques Cartera</span>
              </div>
              <div className="text-xl font-bold text-blue-400">{formatCurrency(metricas.totalChequesCartera, monedaActiva)}</div>
              <div className="text-xs text-slate-500">{metricas.chequesCartera} cheques</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="h-5 w-5 text-orange-400" />
                <span className="text-sm text-slate-400">En Cobranza</span>
              </div>
              <div className="text-xl font-bold text-orange-400">{formatCurrency(metricas.montoEnGestion, monedaActiva)}</div>
              <div className="text-xs text-slate-500">{metricas.gestionesPendientes} gestiones</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CalendarClock className="h-5 w-5 text-pink-400" />
                <span className="text-sm text-slate-400">Pagos Próximos (7d)</span>
              </div>
              <div className="text-xl font-bold text-pink-400">{formatCurrency(metricas.montoPagosProximos, monedaActiva)}</div>
              <div className="text-xs text-slate-500">{metricas.pagosProximos7Dias} pagos</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Receipt className="h-5 w-5 text-teal-400" />
                <span className="text-sm text-slate-400">NC Pendientes</span>
              </div>
              <div className="text-xl font-bold text-teal-400">{formatCurrency(metricas.totalNotasCredito, monedaActiva)}</div>
              <div className="text-xs text-slate-500">{metricas.notasCreditoPendientes} notas</div>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-400 mb-4">Antigüedad CxC</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metricas.agingCxC}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="rango" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip 
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      formatter={(value: number) => formatCurrency(value, monedaActiva)}
                    />
                    <Bar dataKey="monto" fill="#06b6d4" name="Monto" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-400 mb-4">Antigüedad CxP</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metricas.agingCxP}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="rango" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip 
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      formatter={(value: number) => formatCurrency(value, monedaActiva)}
                    />
                    <Bar dataKey="monto" fill="#f59e0b" name="Monto" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Flujo proyectado */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-400 mb-4">Flujo de Caja Proyectado (30 días)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={proyeccionFlujo}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="fecha" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => formatDateShort(v)} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    formatter={(value: number) => formatCurrency(value, monedaActiva)}
                    labelFormatter={(v) => formatDate(v)}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="saldoProyectado" stroke="#10b981" fill="#10b98133" name="Saldo Proyectado" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cuentas */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-400">Cuentas</h3>
              <button onClick={() => setModalType('cuenta')} className="text-sm text-emerald-400 hover:text-emerald-300">
                + Nueva cuenta
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {cuentas.filter(c => c.activo).map(cuenta => (
                <div key={cuenta.id} className="p-3 bg-slate-800/30 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    {TIPOS_CUENTA_CONFIG[cuenta.tipo].icono}
                    <span className="text-sm font-medium text-slate-200">{cuenta.nombre}</span>
                  </div>
                  {cuenta.banco && <div className="text-xs text-slate-500 mb-1">{cuenta.banco}</div>}
                  <div className="text-lg font-bold text-emerald-400">{formatCurrency(cuenta.saldoActual, cuenta.moneda)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================== CUENTAS POR COBRAR ==================== */}
      {tabActiva === 'cxc' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex-1 flex gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar por número o cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
                />
              </div>
              <select
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value as any)}
                className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
              >
                <option value="todos">Todos</option>
                <option value="pendiente">Pendientes</option>
                <option value="parcial">Parciales</option>
                <option value="vencido">Vencidos</option>
                <option value="pagado">Pagados</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setModalType('nota')} className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl">
                <Receipt className="h-4 w-4" />
                Nueva NC
              </button>
              <button onClick={() => setModalType('nuevoCxC')} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl">
                <Plus className="h-4 w-4" />
                Nuevo Documento
              </button>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Documento</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Cliente</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Vencimiento</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Saldo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {documentosCxCFiltrados.map(doc => {
                    const estadoConfig = ESTADO_DOCUMENTO_CONFIG[doc.estado];
                    const diasVenc = getDiasVencimiento(doc.fechaVencimiento);
                    const estaVencido = diasVenc < 0 && doc.saldo > 0;

                    return (
                      <tr key={doc.id} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3">
                          <div className="font-mono text-sm text-slate-200">{doc.numero}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{doc.cliente?.nombre || '-'}</td>
                        <td className="px-4 py-3">
                          <div className={`text-sm ${estaVencido ? 'text-red-400' : 'text-slate-400'}`}>
                            {formatDate(doc.fechaVencimiento)}
                          </div>
                          {estaVencido && <div className="text-xs text-red-400">{Math.abs(diasVenc)}d vencido</div>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-300">{formatCurrency(doc.total, doc.moneda)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-cyan-400">{formatCurrency(doc.saldo, doc.moneda)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs border ${estadoConfig.bg} ${estadoConfig.color}`}>
                            {estadoConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => generarEstadoCuentaCliente(doc.clienteId)} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Estado de cuenta">
                              <FileDown className="h-4 w-4 text-purple-400" />
                            </button>
                            {doc.saldo > 0 && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedItem(doc);
                                    setPagoForm({ ...pagoForm, documentoId: doc.id, monto: doc.saldo });
                                    setModalType('cobro');
                                  }}
                                  className="p-1.5 hover:bg-slate-700 rounded-lg"
                                  title="Registrar cobro"
                                >
                                  <DollarSign className="h-4 w-4 text-emerald-400" />
                                </button>
                                {!gestionesCobranza.find(g => g.documentoId === doc.id) && diasVenc < 0 && (
                                  <button
                                    onClick={() => crearGestionCobranza(doc.id)}
                                    className="p-1.5 hover:bg-slate-700 rounded-lg"
                                    title="Iniciar cobranza"
                                  >
                                    <Phone className="h-4 w-4 text-orange-400" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CONTINÚA EN PARTE 6 */}
      {/* ==================== CUENTAS POR PAGAR ==================== */}
      {tabActiva === 'cxp' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex-1 flex gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar por número o proveedor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
                />
              </div>
              <select
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value as any)}
                className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
              >
                <option value="todos">Todos</option>
                <option value="pendiente">Pendientes</option>
                <option value="parcial">Parciales</option>
                <option value="vencido">Vencidos</option>
                <option value="pagado">Pagados</option>
              </select>
            </div>
            <button onClick={() => setModalType('nuevoCxP')} className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl">
              <Plus className="h-4 w-4" />
              Nuevo Documento
            </button>
          </div>

          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Documento</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Proveedor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Vencimiento</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Saldo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {documentosCxPFiltrados.map(doc => {
                    const estadoConfig = ESTADO_DOCUMENTO_CONFIG[doc.estado];
                    const diasVenc = getDiasVencimiento(doc.fechaVencimiento);
                    const estaVencido = diasVenc < 0 && doc.saldo > 0;

                    return (
                      <tr key={doc.id} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3">
                          <div className="font-mono text-sm text-slate-200">{doc.numero}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{doc.proveedor?.nombre || '-'}</td>
                        <td className="px-4 py-3">
                          <div className={`text-sm ${estaVencido ? 'text-red-400' : 'text-slate-400'}`}>
                            {formatDate(doc.fechaVencimiento)}
                          </div>
                          {estaVencido && <div className="text-xs text-red-400">{Math.abs(diasVenc)}d vencido</div>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-300">{formatCurrency(doc.total, doc.moneda)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-amber-400">{formatCurrency(doc.saldo, doc.moneda)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs border ${estadoConfig.bg} ${estadoConfig.color}`}>
                            {estadoConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => generarEstadoCuentaProveedor(doc.proveedorId)} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Estado de cuenta">
                              <FileDown className="h-4 w-4 text-purple-400" />
                            </button>
                            {doc.saldo > 0 && (
                              <button
                                onClick={() => {
                                  setSelectedItem(doc);
                                  setPagoForm({ ...pagoForm, documentoId: doc.id, monto: doc.saldo });
                                  setModalType('pago');
                                }}
                                className="p-1.5 hover:bg-slate-700 rounded-lg"
                                title="Registrar pago"
                              >
                                <DollarSign className="h-4 w-4 text-emerald-400" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== COBRANZA ==================== */}
      {tabActiva === 'cobranza' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex-1 flex gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar por cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
                />
              </div>
              <select
                value={filterEstadoCobranza}
                onChange={(e) => setFilterEstadoCobranza(e.target.value as any)}
                className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
              >
                <option value="todos">Todos</option>
                <option value="pendiente">Pendientes</option>
                <option value="contactado">Contactados</option>
                <option value="promesa_pago">Promesa Pago</option>
                <option value="en_gestion">En Gestión</option>
                <option value="legal">Legal</option>
              </select>
            </div>
          </div>

          {/* KPIs Cobranza */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(ESTADO_COBRANZA_CONFIG).filter(([k]) => !['cobrado', 'incobrable'].includes(k)).map(([estado, config]) => {
              const count = gestionesCobranza.filter(g => g.estado === estado).length;
              const monto = gestionesCobranza.filter(g => g.estado === estado).reduce((s, g) => s + g.montoPendiente, 0);
              return (
                <div key={estado} className={`p-3 rounded-xl border ${config.bg}`}>
                  <div className={`text-sm ${config.color}`}>{config.label}</div>
                  <div className="text-xl font-bold text-slate-200">{count}</div>
                  <div className="text-xs text-slate-500">{formatCurrency(monto, monedaActiva)}</div>
                </div>
              );
            })}
          </div>

          {/* Lista de gestiones */}
          <div className="space-y-3">
            {gestionesCobranzaFiltradas.map(gestion => {
              const estadoConfig = ESTADO_COBRANZA_CONFIG[gestion.estado];
              const prioridadConfig = PRIORIDAD_CONFIG[gestion.prioridad];
              
              return (
                <div key={gestion.id} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-medium text-slate-200">{gestion.clienteNombre}</div>
                      <div className="text-sm text-slate-500">{gestion.diasVencido} días vencido</div>
                    </div>
                    <div className="flex gap-2">
                      <span className={`px-2 py-1 rounded-lg text-xs ${prioridadConfig.bg} ${prioridadConfig.color}`}>
                        {prioridadConfig.label}
                      </span>
                      <span className={`px-2 py-1 rounded-lg text-xs border ${estadoConfig.bg} ${estadoConfig.color}`}>
                        {estadoConfig.label}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3 text-sm">
                    <div>
                      <span className="text-slate-500">Monto Original:</span>
                      <span className="ml-2 text-slate-300">{formatCurrency(gestion.montoOriginal, monedaActiva)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Pendiente:</span>
                      <span className="ml-2 text-amber-400 font-bold">{formatCurrency(gestion.montoPendiente, monedaActiva)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Último contacto:</span>
                      <span className="ml-2 text-slate-300">{gestion.fechaUltimoContacto ? formatDate(gestion.fechaUltimoContacto) : '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Próximo:</span>
                      <span className="ml-2 text-slate-300">{gestion.fechaProximoContacto ? formatDate(gestion.fechaProximoContacto) : '-'}</span>
                    </div>
                  </div>

                  {gestion.promesaPagoFecha && (
                    <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg mb-3 text-sm">
                      <span className="text-cyan-400">Promesa de pago:</span>
                      <span className="ml-2 text-slate-300">{formatDate(gestion.promesaPagoFecha)}</span>
                      <span className="ml-4 text-slate-300">{formatCurrency(gestion.promesaPagoMonto || 0, monedaActiva)}</span>
                    </div>
                  )}

                  {/* Timeline de contactos */}
                  {gestion.contactos && gestion.contactos.length > 0 && (
                    <div className="border-t border-slate-800 pt-3 mt-3">
                      <div className="text-xs text-slate-500 mb-2">Últimos contactos:</div>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {gestion.contactos.slice(0, 3).map(contacto => (
                          <div key={contacto.id} className="flex items-start gap-2 text-sm">
                            {TIPO_CONTACTO_CONFIG[contacto.tipo].icono}
                            <div className="flex-1">
                              <div className="text-slate-300">{contacto.descripcion}</div>
                              <div className="text-xs text-slate-500">{formatDateTime(contacto.fecha)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => {
                        setSelectedItem(gestion);
                        setModalType('contacto');
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm"
                    >
                      <Phone className="h-3 w-3" />
                      Registrar Contacto
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== FLUJO DE CAJA ==================== */}
      {tabActiva === 'flujo' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="text-sm text-slate-400 mb-1">Saldo Actual</div>
              <div className="text-2xl font-bold text-emerald-400">{formatCurrency(metricas.saldosPorMoneda[monedaActiva], monedaActiva)}</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="text-sm text-slate-400 mb-1">Ingresos Esperados (30d)</div>
              <div className="text-2xl font-bold text-cyan-400">{formatCurrency(proyeccionFlujo.reduce((s, p) => s + p.ingresos, 0), monedaActiva)}</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="text-sm text-slate-400 mb-1">Egresos Esperados (30d)</div>
              <div className="text-2xl font-bold text-amber-400">{formatCurrency(proyeccionFlujo.reduce((s, p) => s + p.egresos, 0), monedaActiva)}</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="text-sm text-slate-400 mb-1">Saldo Proyectado</div>
              <div className={`text-2xl font-bold ${proyeccionFlujo[29]?.saldoProyectado >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(proyeccionFlujo[29]?.saldoProyectado || 0, monedaActiva)}
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-400 mb-4">Proyección de Flujo de Caja</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={proyeccionFlujo}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="fecha" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => formatDateShort(v)} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    formatter={(value: number) => formatCurrency(value, monedaActiva)}
                    labelFormatter={(v) => formatDate(v)}
                  />
                  <Legend />
                  <Bar dataKey="ingresos" fill="#06b6d4" name="Ingresos" />
                  <Bar dataKey="egresos" fill="#f59e0b" name="Egresos" />
                  <Line type="monotone" dataKey="saldoProyectado" stroke="#10b981" strokeWidth={2} name="Saldo" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-slate-400">Detalle por Día</h3>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full">
                <thead className="bg-slate-800/50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Fecha</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">Ingresos</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">Egresos</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">Neto</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {proyeccionFlujo.map((dia, idx) => {
                    const neto = dia.ingresos - dia.egresos;
                    const tieneMov = dia.ingresos > 0 || dia.egresos > 0;
                    return (
                      <tr key={dia.fecha} className={tieneMov ? 'bg-slate-800/20' : ''}>
                        <td className="px-4 py-2 text-sm text-slate-300">
                          {formatDate(dia.fecha)}
                          {idx === 0 && <span className="ml-2 text-xs text-emerald-400">Hoy</span>}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-sm text-cyan-400">
                          {dia.ingresos > 0 ? formatCurrency(dia.ingresos, monedaActiva) : '-'}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-sm text-amber-400">
                          {dia.egresos > 0 ? formatCurrency(dia.egresos, monedaActiva) : '-'}
                        </td>
                        <td className={`px-4 py-2 text-right font-mono text-sm ${neto >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {tieneMov ? (neto >= 0 ? '+' : '') + formatCurrency(neto, monedaActiva) : '-'}
                        </td>
                        <td className={`px-4 py-2 text-right font-mono text-sm font-bold ${dia.saldoProyectado >= 0 ? 'text-slate-200' : 'text-red-400'}`}>
                          {formatCurrency(dia.saldoProyectado, monedaActiva)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TRANSACCIONES ==================== */}
      {tabActiva === 'transacciones' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar por concepto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
              />
            </div>
            <button onClick={() => setModalType('transaccion')} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl">
              <Plus className="h-4 w-4" />
              Nueva Transacción
            </button>
          </div>

          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Cuenta</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Concepto</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Categoría</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Monto</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">Conc.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {transacciones.filter(t => !searchTerm || t.concepto.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 100).map(trans => (
                    <tr key={trans.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-sm text-slate-400">{formatDate(trans.fecha)}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{trans.cuenta?.nombre || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-slate-200">{trans.concepto}</div>
                        {trans.referencia && <div className="text-xs text-slate-500">Ref: {trans.referencia}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">{trans.categoria || '-'}</td>
                      <td className={`px-4 py-3 text-right font-mono font-bold ${trans.tipo === 'ingreso' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {trans.tipo === 'ingreso' ? '+' : '-'}{formatCurrency(trans.monto, trans.moneda)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {trans.conciliado ? (
                          <CheckCircle className="h-4 w-4 text-emerald-400 mx-auto" />
                        ) : (
                          <div className="h-4 w-4 border border-slate-600 rounded mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CONTINÚA EN PARTE 7 */}
      {/* ==================== CHEQUES ==================== */}
      {tabActiva === 'cheques' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex gap-2">
              <button onClick={() => setFilterEstadoCheque('todos')} className={`px-3 py-1.5 rounded-lg text-sm ${filterEstadoCheque === 'todos' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>Todos</button>
              <button onClick={() => setFilterEstadoCheque('cartera')} className={`px-3 py-1.5 rounded-lg text-sm ${filterEstadoCheque === 'cartera' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>En Cartera</button>
              <button onClick={() => setFilterEstadoCheque('depositado')} className={`px-3 py-1.5 rounded-lg text-sm ${filterEstadoCheque === 'depositado' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>Depositados</button>
            </div>
            <button onClick={() => setModalType('cheque')} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl">
              <Plus className="h-4 w-4" />
              Nuevo Cheque
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cheques.filter(ch => filterEstadoCheque === 'todos' || ch.estado === filterEstadoCheque).map(cheque => {
              const estadoConfig = ESTADO_CHEQUE_CONFIG[cheque.estado];
              const diasVenc = getDiasVencimiento(cheque.fechaVencimiento);
              
              return (
                <div key={cheque.id} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <FileCheck className={`h-4 w-4 ${cheque.tipo === 'recibido' ? 'text-cyan-400' : 'text-orange-400'}`} />
                        <span className="text-xs text-slate-500 uppercase">{cheque.tipo}</span>
                      </div>
                      <div className="font-mono text-lg text-slate-200 mt-1">#{cheque.numero}</div>
                    </div>
                    <span className={`px-2 py-1 rounded-lg text-xs border ${estadoConfig.bg} ${estadoConfig.color}`}>{estadoConfig.label}</span>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Banco</span>
                      <span className="text-slate-300">{cheque.banco}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Monto</span>
                      <span className="font-bold text-emerald-400">{formatCurrency(cheque.monto, cheque.moneda)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Vencimiento</span>
                      <span className={diasVenc < 0 ? 'text-red-400' : diasVenc <= 7 ? 'text-amber-400' : 'text-slate-300'}>
                        {formatDate(cheque.fechaVencimiento)}
                      </span>
                    </div>
                  </div>

                  {cheque.estado === 'cartera' && cheque.tipo === 'recibido' && (
                    <div className="mt-4 pt-3 border-t border-slate-800 flex gap-2">
                      <button onClick={() => cambiarEstadoCheque(cheque, 'depositado')} className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm">Depositar</button>
                      <button onClick={() => cambiarEstadoCheque(cheque, 'cobrado', cuentas[0]?.id)} disabled={procesando === cheque.id} className="flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm">Cobrado</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== CONCILIACIÓN ==================== */}
      {tabActiva === 'conciliacion' && (
        <div className="space-y-4">
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-400 mb-4">Conciliación Bancaria</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Cuenta a conciliar</label>
                <select
                  value={cuentaConciliacion}
                  onChange={(e) => { setCuentaConciliacion(e.target.value); }}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                >
                  <option value="">Seleccionar cuenta...</option>
                  {cuentas.filter(c => c.tipo === 'banco').map(c => (
                    <option key={c.id} value={c.id}>{c.nombre} - {c.banco}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Importar extracto (CSV)</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => e.target.files?.[0] && importarExtractoBancario(e.target.files[0])}
                  disabled={!cuentaConciliacion}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-300"
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={loadMovimientosBancarios}
                  disabled={!cuentaConciliacion}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl disabled:opacity-50"
                >
                  Cargar Pendientes
                </button>
                <button
                  onClick={autoMatchConciliacion}
                  disabled={movimientosParaConciliar.length === 0}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl disabled:opacity-50"
                >
                  Auto-Match
                </button>
              </div>
            </div>

            {matchesConciliacion.size > 0 && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl mb-4 flex items-center justify-between">
                <span className="text-emerald-400">{matchesConciliacion.size} coincidencias encontradas</span>
                <button
                  onClick={aplicarMatchesConciliacion}
                  disabled={procesando === 'conciliar'}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl"
                >
                  Aplicar Todas
                </button>
              </div>
            )}
          </div>

          {cuentaConciliacion && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Movimientos bancarios */}
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-slate-400 mb-3">Extracto Bancario ({movimientosParaConciliar.length})</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {movimientosParaConciliar.map(mov => {
                    const matched = matchesConciliacion.has(mov.id);
                    return (
                      <div key={mov.id} className={`p-3 rounded-xl border ${matched ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800/30 border-slate-700/30'}`}>
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-sm text-slate-300">{mov.descripcion}</div>
                            <div className="text-xs text-slate-500">{formatDate(mov.fecha)} {mov.referencia && `• ${mov.referencia}`}</div>
                          </div>
                          <div className={`font-mono font-bold ${mov.tipo === 'credito' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {mov.tipo === 'credito' ? '+' : '-'}{formatCurrency(mov.monto, monedaActiva)}
                          </div>
                        </div>
                        {matched && <div className="text-xs text-emerald-400 mt-1">✓ Match encontrado</div>}
                      </div>
                    );
                  })}
                  {movimientosParaConciliar.length === 0 && (
                    <div className="text-center py-8 text-slate-500">No hay movimientos pendientes</div>
                  )}
                </div>
              </div>

              {/* Transacciones del sistema */}
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-slate-400 mb-3">Transacciones Sistema ({transaccionesParaConciliar.length})</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {transaccionesParaConciliar.map(trans => {
                    const matched = Array.from(matchesConciliacion.values()).includes(trans.id);
                    return (
                      <div key={trans.id} className={`p-3 rounded-xl border ${matched ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800/30 border-slate-700/30'}`}>
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-sm text-slate-300">{trans.concepto}</div>
                            <div className="text-xs text-slate-500">{formatDate(trans.fecha)} {trans.referencia && `• ${trans.referencia}`}</div>
                          </div>
                          <div className={`font-mono font-bold ${trans.tipo === 'ingreso' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {trans.tipo === 'ingreso' ? '+' : '-'}{formatCurrency(trans.monto, trans.moneda)}
                          </div>
                        </div>
                        {matched && <div className="text-xs text-emerald-400 mt-1">✓ Match encontrado</div>}
                      </div>
                    );
                  })}
                  {transaccionesParaConciliar.length === 0 && (
                    <div className="text-center py-8 text-slate-500">No hay transacciones pendientes</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== PRESUPUESTO ==================== */}
      {tabActiva === 'presupuesto' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex gap-3">
              <select
                value={añoPresupuesto}
                onChange={(e) => setAñoPresupuesto(parseInt(e.target.value))}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              >
                {[2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select
                value={mesPresupuesto}
                onChange={(e) => setMesPresupuesto(parseInt(e.target.value))}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{getMesNombre(m)}</option>
                ))}
              </select>
            </div>
            <button onClick={() => setModalType('presupuesto')} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl">
              <Plus className="h-4 w-4" />
              Agregar Presupuesto
            </button>
          </div>

          {/* Resumen */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="text-sm text-slate-400 mb-2">Ingresos</div>
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-xs text-slate-500">Presupuestado</div>
                  <div className="text-lg font-bold text-slate-300">{formatCurrency(resumenPresupuesto.totalPresupuestadoIngresos, monedaActiva)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Real</div>
                  <div className="text-lg font-bold text-emerald-400">{formatCurrency(resumenPresupuesto.totalRealIngresos, monedaActiva)}</div>
                </div>
              </div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="text-sm text-slate-400 mb-2">Egresos</div>
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-xs text-slate-500">Presupuestado</div>
                  <div className="text-lg font-bold text-slate-300">{formatCurrency(resumenPresupuesto.totalPresupuestadoEgresos, monedaActiva)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Real</div>
                  <div className="text-lg font-bold text-red-400">{formatCurrency(resumenPresupuesto.totalRealEgresos, monedaActiva)}</div>
                </div>
              </div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="text-sm text-slate-400 mb-2">Balance</div>
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-xs text-slate-500">Presupuestado</div>
                  <div className={`text-lg font-bold ${resumenPresupuesto.balancePresupuestado >= 0 ? 'text-slate-300' : 'text-red-400'}`}>
                    {formatCurrency(resumenPresupuesto.balancePresupuestado, monedaActiva)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Real</div>
                  <div className={`text-lg font-bold ${resumenPresupuesto.balanceReal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(resumenPresupuesto.balanceReal, monedaActiva)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Detalle por categoría */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Categoría</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Tipo</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Presupuestado</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Real</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Variación</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {presupuestos.filter(p => p.mes === mesPresupuesto).map(p => (
                    <tr key={p.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-slate-300">{p.categoria}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${p.tipo === 'ingreso' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                          {p.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-300">{formatCurrency(p.montoPresupuestado, monedaActiva)}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-300">{formatCurrency(p.montoReal, monedaActiva)}</td>
                      <td className={`px-4 py-3 text-right font-mono ${p.variacion >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {p.variacion >= 0 ? '+' : ''}{formatCurrency(p.variacion, monedaActiva)}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono ${p.variacionPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {p.variacionPct >= 0 ? '+' : ''}{formatPercent(p.variacionPct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODALES ==================== */}

      {/* MODAL: NUEVA CUENTA */}
      {modalType === 'cuenta' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100">Nueva Cuenta</h3>
              <button onClick={() => setModalType(null)} className="p-2 hover:bg-slate-800 rounded-lg"><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Nombre *</label>
                <input type="text" value={cuentaForm.nombre} onChange={(e) => setCuentaForm({ ...cuentaForm, nombre: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Tipo</label>
                  <select value={cuentaForm.tipo} onChange={(e) => setCuentaForm({ ...cuentaForm, tipo: e.target.value as TipoCuenta })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                    {Object.entries(TIPOS_CUENTA_CONFIG).map(([key, config]) => (<option key={key} value={key}>{config.nombre}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Moneda</label>
                  <select value={cuentaForm.moneda} onChange={(e) => setCuentaForm({ ...cuentaForm, moneda: e.target.value as Moneda })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                    {Object.entries(MONEDAS_CONFIG).map(([key, config]) => (<option key={key} value={key}>{config.simbolo} {config.nombre}</option>))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Banco</label>
                <input type="text" value={cuentaForm.banco} onChange={(e) => setCuentaForm({ ...cuentaForm, banco: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Saldo Inicial</label>
                <input type="number" value={cuentaForm.saldoActual} onChange={(e) => setCuentaForm({ ...cuentaForm, saldoActual: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" step="0.01" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={crearCuenta} disabled={procesando === 'cuenta'} className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl">
                {procesando === 'cuenta' ? <RefreshCw className="h-4 w-4 animate-spin mx-auto" /> : 'Crear Cuenta'}
              </button>
              <button onClick={() => setModalType(null)} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR COBRO */}
      {modalType === 'cobro' && selectedItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100">Registrar Cobro</h3>
              <button onClick={() => { setModalType(null); resetPagoForm(); }} className="p-2 hover:bg-slate-800 rounded-lg"><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl mb-4">
              <div className="font-mono text-lg text-slate-200">{selectedItem.numero}</div>
              <div className="text-sm text-slate-400">{selectedItem.cliente?.nombre}</div>
              <div className="flex justify-between mt-2">
                <span className="text-slate-500">Saldo:</span>
                <span className="font-bold text-cyan-400">{formatCurrency(selectedItem.saldo, selectedItem.moneda)}</span>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Cuenta destino *</label>
                <select value={pagoForm.cuentaId} onChange={(e) => setPagoForm({ ...pagoForm, cuentaId: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                  <option value="">Seleccionar...</option>
                  {cuentas.filter(c => c.activo).map(c => (<option key={c.id} value={c.id}>{c.nombre}</option>))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Fecha</label>
                  <input type="date" value={pagoForm.fecha} onChange={(e) => setPagoForm({ ...pagoForm, fecha: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Monto</label>
                  <input type="number" value={pagoForm.monto} onChange={(e) => setPagoForm({ ...pagoForm, monto: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" step="0.01" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Método</label>
                <select value={pagoForm.metodoPago} onChange={(e) => setPagoForm({ ...pagoForm, metodoPago: e.target.value as MetodoPago })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                  {Object.entries(METODOS_PAGO_CONFIG).map(([key, config]) => (<option key={key} value={key}>{config.nombre}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Referencia</label>
                <input type="text" value={pagoForm.referencia} onChange={(e) => setPagoForm({ ...pagoForm, referencia: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={registrarCobro} disabled={procesando === 'cobro'} className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl">
                {procesando === 'cobro' ? <RefreshCw className="h-4 w-4 animate-spin mx-auto" /> : 'Registrar Cobro'}
              </button>
              <button onClick={() => { setModalType(null); resetPagoForm(); }} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR PAGO */}
      {modalType === 'pago' && selectedItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100">Registrar Pago</h3>
              <button onClick={() => { setModalType(null); resetPagoForm(); }} className="p-2 hover:bg-slate-800 rounded-lg"><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-4">
              <div className="font-mono text-lg text-slate-200">{selectedItem.numero}</div>
              <div className="text-sm text-slate-400">{selectedItem.proveedor?.nombre}</div>
              <div className="flex justify-between mt-2">
                <span className="text-slate-500">Saldo:</span>
                <span className="font-bold text-amber-400">{formatCurrency(selectedItem.saldo, selectedItem.moneda)}</span>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Cuenta origen *</label>
                <select value={pagoForm.cuentaId} onChange={(e) => setPagoForm({ ...pagoForm, cuentaId: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                  <option value="">Seleccionar...</option>
                  {cuentas.filter(c => c.activo).map(c => (<option key={c.id} value={c.id}>{c.nombre}</option>))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Fecha</label>
                  <input type="date" value={pagoForm.fecha} onChange={(e) => setPagoForm({ ...pagoForm, fecha: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Monto</label>
                  <input type="number" value={pagoForm.monto} onChange={(e) => setPagoForm({ ...pagoForm, monto: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" step="0.01" />
                </div>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-xl">
                <div className="text-sm text-slate-400 mb-2">Retenciones (DGI)</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Ret. IVA</label>
                    <input type="number" value={pagoForm.retencionIVA} onChange={(e) => setPagoForm({ ...pagoForm, retencionIVA: parseFloat(e.target.value) || 0 })} className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100" step="0.01" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Ret. Renta</label>
                    <input type="number" value={pagoForm.retencionRenta} onChange={(e) => setPagoForm({ ...pagoForm, retencionRenta: parseFloat(e.target.value) || 0 })} className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100" step="0.01" />
                  </div>
                </div>
                <div className="flex justify-between mt-2 text-sm">
                  <span className="text-slate-500">Total aplicado:</span>
                  <span className="text-emerald-400 font-bold">{formatCurrency(pagoForm.monto + pagoForm.retencionIVA + pagoForm.retencionRenta, selectedItem.moneda)}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={registrarPago} disabled={procesando === 'pago'} className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl">
                {procesando === 'pago' ? <RefreshCw className="h-4 w-4 animate-spin mx-auto" /> : 'Registrar Pago'}
              </button>
              <button onClick={() => { setModalType(null); resetPagoForm(); }} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TRANSACCIÓN */}
      {modalType === 'transaccion' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100">Nueva Transacción</h3>
              <button onClick={() => { setModalType(null); resetTransaccionForm(); }} className="p-2 hover:bg-slate-800 rounded-lg"><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Tipo</label>
                <div className="flex gap-2">
                  <button onClick={() => setTransaccionForm({ ...transaccionForm, tipo: 'ingreso' })} className={`flex-1 py-2 rounded-xl text-sm font-medium ${transaccionForm.tipo === 'ingreso' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Ingreso</button>
                  <button onClick={() => setTransaccionForm({ ...transaccionForm, tipo: 'egreso' })} className={`flex-1 py-2 rounded-xl text-sm font-medium ${transaccionForm.tipo === 'egreso' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Egreso</button>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Cuenta *</label>
                <select value={transaccionForm.cuentaId} onChange={(e) => setTransaccionForm({ ...transaccionForm, cuentaId: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                  <option value="">Seleccionar...</option>
                  {cuentas.filter(c => c.activo).map(c => (<option key={c.id} value={c.id}>{c.nombre}</option>))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Fecha</label>
                  <input type="date" value={transaccionForm.fecha} onChange={(e) => setTransaccionForm({ ...transaccionForm, fecha: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Monto *</label>
                  <input type="number" value={transaccionForm.monto} onChange={(e) => setTransaccionForm({ ...transaccionForm, monto: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" step="0.01" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Concepto *</label>
                <input type="text" value={transaccionForm.concepto} onChange={(e) => setTransaccionForm({ ...transaccionForm, concepto: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Categoría</label>
                <select value={transaccionForm.categoria} onChange={(e) => setTransaccionForm({ ...transaccionForm, categoria: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                  <option value="">Sin categoría</option>
                  {(transaccionForm.tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_GASTO).map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={crearTransaccion} disabled={procesando === 'transaccion'} className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl">
                {procesando === 'transaccion' ? <RefreshCw className="h-4 w-4 animate-spin mx-auto" /> : 'Registrar'}
              </button>
              <button onClick={() => { setModalType(null); resetTransaccionForm(); }} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CHEQUE */}
      {modalType === 'cheque' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100">Nuevo Cheque</h3>
              <button onClick={() => { setModalType(null); resetChequeForm(); }} className="p-2 hover:bg-slate-800 rounded-lg"><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Tipo</label>
                <div className="flex gap-2">
                  <button onClick={() => setChequeForm({ ...chequeForm, tipo: 'recibido' })} className={`flex-1 py-2 rounded-xl text-sm font-medium ${chequeForm.tipo === 'recibido' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Recibido</button>
                  <button onClick={() => setChequeForm({ ...chequeForm, tipo: 'emitido' })} className={`flex-1 py-2 rounded-xl text-sm font-medium ${chequeForm.tipo === 'emitido' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Emitido</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Número *</label>
                  <input type="text" value={chequeForm.numero} onChange={(e) => setChequeForm({ ...chequeForm, numero: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Banco *</label>
                  <input type="text" value={chequeForm.banco} onChange={(e) => setChequeForm({ ...chequeForm, banco: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Monto *</label>
                  <input type="number" value={chequeForm.monto} onChange={(e) => setChequeForm({ ...chequeForm, monto: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" step="0.01" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Moneda</label>
                  <select value={chequeForm.moneda} onChange={(e) => setChequeForm({ ...chequeForm, moneda: e.target.value as Moneda })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                    {Object.entries(MONEDAS_CONFIG).map(([key, config]) => (<option key={key} value={key}>{config.simbolo}</option>))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Emisión</label>
                  <input type="date" value={chequeForm.fechaEmision} onChange={(e) => setChequeForm({ ...chequeForm, fechaEmision: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Vencimiento</label>
                  <input type="date" value={chequeForm.fechaVencimiento} onChange={(e) => setChequeForm({ ...chequeForm, fechaVencimiento: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={crearCheque} disabled={procesando === 'cheque'} className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl">
                {procesando === 'cheque' ? <RefreshCw className="h-4 w-4 animate-spin mx-auto" /> : 'Registrar'}
              </button>
              <button onClick={() => { setModalType(null); resetChequeForm(); }} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONTACTO COBRANZA */}
      {modalType === 'contacto' && selectedItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100">Registrar Contacto</h3>
              <button onClick={() => { setModalType(null); resetContactoForm(); }} className="p-2 hover:bg-slate-800 rounded-lg"><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl mb-4">
              <div className="font-medium text-slate-200">{selectedItem.clienteNombre}</div>
              <div className="text-sm text-slate-400">Pendiente: {formatCurrency(selectedItem.montoPendiente, monedaActiva)}</div>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Tipo</label>
                  <select value={contactoForm.tipo} onChange={(e) => setContactoForm({ ...contactoForm, tipo: e.target.value as TipoContactoCobranza })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                    {Object.entries(TIPO_CONTACTO_CONFIG).map(([key, config]) => (<option key={key} value={key}>{config.label}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Resultado</label>
                  <select value={contactoForm.resultado} onChange={(e) => setContactoForm({ ...contactoForm, resultado: e.target.value as ResultadoContacto })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                    <option value="exitoso">Exitoso</option>
                    <option value="no_contesta">No contesta</option>
                    <option value="promesa">Promesa</option>
                    <option value="rechazo">Rechazo</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Descripción *</label>
                <textarea value={contactoForm.descripcion} onChange={(e) => setContactoForm({ ...contactoForm, descripcion: e.target.value })} rows={3} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={contactoForm.promesaPago} onChange={(e) => setContactoForm({ ...contactoForm, promesaPago: e.target.checked })} className="rounded" />
                <label className="text-sm text-slate-400">Promesa de pago</label>
              </div>
              {contactoForm.promesaPago && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Fecha promesa</label>
                    <input type="date" value={contactoForm.promesaFecha} onChange={(e) => setContactoForm({ ...contactoForm, promesaFecha: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Monto</label>
                    <input type="number" value={contactoForm.promesaMonto} onChange={(e) => setContactoForm({ ...contactoForm, promesaMonto: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" step="0.01" />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Próximo contacto</label>
                <input type="date" value={contactoForm.proximoContacto} onChange={(e) => setContactoForm({ ...contactoForm, proximoContacto: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => registrarContactoCobranza(selectedItem.id)} disabled={procesando === 'contacto'} className="flex-1 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-xl">
                {procesando === 'contacto' ? <RefreshCw className="h-4 w-4 animate-spin mx-auto" /> : 'Registrar'}
              </button>
              <button onClick={() => { setModalType(null); resetContactoForm(); }} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PRESUPUESTO */}
      {modalType === 'presupuesto' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100">Agregar Presupuesto</h3>
              <button onClick={() => setModalType(null)} className="p-2 hover:bg-slate-800 rounded-lg"><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="p-3 bg-violet-500/10 border border-violet-500/30 rounded-xl mb-4">
              <span className="text-violet-400">{getMesNombre(mesPresupuesto)} {añoPresupuesto}</span>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Tipo</label>
                <div className="flex gap-2">
                  <button onClick={() => setPresupuestoForm({ ...presupuestoForm, tipo: 'ingreso' })} className={`flex-1 py-2 rounded-xl text-sm font-medium ${presupuestoForm.tipo === 'ingreso' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Ingreso</button>
                  <button onClick={() => setPresupuestoForm({ ...presupuestoForm, tipo: 'egreso' })} className={`flex-1 py-2 rounded-xl text-sm font-medium ${presupuestoForm.tipo === 'egreso' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Egreso</button>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Categoría *</label>
                <select value={presupuestoForm.categoria} onChange={(e) => setPresupuestoForm({ ...presupuestoForm, categoria: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                  <option value="">Seleccionar...</option>
                  {(presupuestoForm.tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_GASTO).map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Monto presupuestado *</label>
                <input type="number" value={presupuestoForm.monto} onChange={(e) => setPresupuestoForm({ ...presupuestoForm, monto: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" step="0.01" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={guardarPresupuesto} disabled={procesando === 'presupuesto'} className="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl">
                {procesando === 'presupuesto' ? <RefreshCw className="h-4 w-4 animate-spin mx-auto" /> : 'Guardar'}
              </button>
              <button onClick={() => setModalType(null)} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TIPO CAMBIO */}
      {modalType === 'tipoCambio' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100">Tipo de Cambio</h3>
              <button onClick={() => setModalType(null)} className="p-2 hover:bg-slate-800 rounded-lg"><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            {tiposCambio.length > 0 && (
              <div className="mb-4 p-3 bg-slate-800/50 rounded-xl">
                <div className="text-xs text-slate-500 mb-2">Últimos registrados</div>
                {tiposCambio.slice(0, 3).map(tc => (
                  <div key={tc.id} className="flex justify-between text-sm">
                    <span className="text-slate-400">{tc.monedaOrigen}/{tc.monedaDestino}</span>
                    <span className="text-slate-200">{tc.tasa.toFixed(4)}</span>
                    <span className="text-slate-500">{formatDate(tc.fecha)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Origen</label>
                  <select value={tipoCambioForm.monedaOrigen} onChange={(e) => setTipoCambioForm({ ...tipoCambioForm, monedaOrigen: e.target.value as Moneda })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                    {Object.keys(MONEDAS_CONFIG).map(k => (<option key={k} value={k}>{k}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Destino</label>
                  <select value={tipoCambioForm.monedaDestino} onChange={(e) => setTipoCambioForm({ ...tipoCambioForm, monedaDestino: e.target.value as Moneda })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                    {Object.keys(MONEDAS_CONFIG).map(k => (<option key={k} value={k}>{k}</option>))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Tasa</label>
                  <input type="number" value={tipoCambioForm.tasa} onChange={(e) => setTipoCambioForm({ ...tipoCambioForm, tasa: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" step="0.0001" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Fecha</label>
                  <input type="date" value={tipoCambioForm.fecha} onChange={(e) => setTipoCambioForm({ ...tipoCambioForm, fecha: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={guardarTipoCambio} disabled={procesando === 'tipocambio'} className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl">Guardar</button>
              <button onClick={() => setModalType(null)} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOTA C/D */}
      {modalType === 'nota' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100">Nueva Nota</h3>
              <button onClick={() => setModalType(null)} className="p-2 hover:bg-slate-800 rounded-lg"><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Tipo</label>
                  <select value={notaForm.tipo} onChange={(e) => setNotaForm({ ...notaForm, tipo: e.target.value as TipoNota })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                    <option value="credito">Crédito</option>
                    <option value="debito">Débito</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Origen</label>
                  <select value={notaForm.origen} onChange={(e) => setNotaForm({ ...notaForm, origen: e.target.value as OrigenNota, entidadId: '' })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                    <option value="cliente">Cliente</option>
                    <option value="proveedor">Proveedor</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">{notaForm.origen === 'cliente' ? 'Cliente' : 'Proveedor'} *</label>
                <select value={notaForm.entidadId} onChange={(e) => setNotaForm({ ...notaForm, entidadId: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                  <option value="">Seleccionar...</option>
                  {(notaForm.origen === 'cliente' ? clientes : proveedores).map(e => (<option key={e.id} value={e.id}>{e.nombre}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Monto *</label>
                <input type="number" value={notaForm.monto} onChange={(e) => setNotaForm({ ...notaForm, monto: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" step="0.01" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Motivo *</label>
                <textarea value={notaForm.motivo} onChange={(e) => setNotaForm({ ...notaForm, motivo: e.target.value })} rows={2} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={crearNota} disabled={procesando === 'nota'} className="flex-1 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-xl">
                {procesando === 'nota' ? <RefreshCw className="h-4 w-4 animate-spin mx-auto" /> : 'Crear Nota'}
              </button>
              <button onClick={() => setModalType(null)} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NUEVO DOCUMENTO CxC */}
      {modalType === 'nuevoCxC' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100">Nuevo Documento por Cobrar</h3>
              <button onClick={() => setModalType(null)} className="p-2 hover:bg-slate-800 rounded-lg"><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Cliente *</label>
                <select value={cxcForm.clienteId} onChange={(e) => setCxcForm({ ...cxcForm, clienteId: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                  <option value="">Seleccionar cliente...</option>
                  {clientes.map(c => (<option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Tipo</label>
                  <select value={cxcForm.tipo} onChange={(e) => setCxcForm({ ...cxcForm, tipo: e.target.value as any })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                    <option value="factura">Factura</option>
                    <option value="nota_debito">Nota Débito</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Número *</label>
                  <input type="text" value={cxcForm.numero} onChange={(e) => setCxcForm({ ...cxcForm, numero: e.target.value })} placeholder="FAC-001" className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Fecha Emisión</label>
                  <input type="date" value={cxcForm.fechaEmision} onChange={(e) => setCxcForm({ ...cxcForm, fechaEmision: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Fecha Vencimiento</label>
                  <input type="date" value={cxcForm.fechaVencimiento} onChange={(e) => setCxcForm({ ...cxcForm, fechaVencimiento: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Subtotal *</label>
                  <input type="number" value={cxcForm.subtotal} onChange={(e) => setCxcForm({ ...cxcForm, subtotal: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" step="0.01" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Impuestos</label>
                  <input type="number" value={cxcForm.impuestos} onChange={(e) => setCxcForm({ ...cxcForm, impuestos: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" step="0.01" />
                </div>
              </div>
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total:</span>
                  <span className="text-xl font-bold text-cyan-400">{formatCurrency(cxcForm.subtotal + cxcForm.impuestos, monedaActiva)}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notas</label>
                <textarea value={cxcForm.notas} onChange={(e) => setCxcForm({ ...cxcForm, notas: e.target.value })} rows={2} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={crearDocumentoCxC} disabled={procesando === 'cxc'} className="flex-1 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl">
                {procesando === 'cxc' ? <RefreshCw className="h-4 w-4 animate-spin mx-auto" /> : 'Crear Documento'}
              </button>
              <button onClick={() => setModalType(null)} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NUEVO DOCUMENTO CxP */}
      {modalType === 'nuevoCxP' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100">Nuevo Documento por Pagar</h3>
              <button onClick={() => setModalType(null)} className="p-2 hover:bg-slate-800 rounded-lg"><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Proveedor *</label>
                <select value={cxpForm.proveedorId} onChange={(e) => setCxpForm({ ...cxpForm, proveedorId: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                  <option value="">Seleccionar proveedor...</option>
                  {proveedores.map(p => (<option key={p.id} value={p.id}>{p.codigo} - {p.nombre}</option>))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Tipo</label>
                  <select value={cxpForm.tipo} onChange={(e) => setCxpForm({ ...cxpForm, tipo: e.target.value as any })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                    <option value="factura">Factura</option>
                    <option value="nota_debito">Nota Débito</option>
                    <option value="gasto">Gasto</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Número *</label>
                  <input type="text" value={cxpForm.numero} onChange={(e) => setCxpForm({ ...cxpForm, numero: e.target.value })} placeholder="FAC-PROV-001" className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Fecha Emisión</label>
                  <input type="date" value={cxpForm.fechaEmision} onChange={(e) => setCxpForm({ ...cxpForm, fechaEmision: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Fecha Vencimiento</label>
                  <input type="date" value={cxpForm.fechaVencimiento} onChange={(e) => setCxpForm({ ...cxpForm, fechaVencimiento: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Subtotal *</label>
                  <input type="number" value={cxpForm.subtotal} onChange={(e) => setCxpForm({ ...cxpForm, subtotal: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" step="0.01" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Impuestos</label>
                  <input type="number" value={cxpForm.impuestos} onChange={(e) => setCxpForm({ ...cxpForm, impuestos: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" step="0.01" />
                </div>
              </div>
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total:</span>
                  <span className="text-xl font-bold text-amber-400">{formatCurrency(cxpForm.subtotal + cxpForm.impuestos, monedaActiva)}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notas</label>
                <textarea value={cxpForm.notas} onChange={(e) => setCxpForm({ ...cxpForm, notas: e.target.value })} rows={2} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={crearDocumentoCxP} disabled={procesando === 'cxp'} className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl">
                {procesando === 'cxp' ? <RefreshCw className="h-4 w-4 animate-spin mx-auto" /> : 'Crear Documento'}
              </button>
              <button onClick={() => setModalType(null)} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}