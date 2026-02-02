'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DollarSign, CreditCard, Wallet, TrendingUp, TrendingDown, Building2,
  Receipt, FileText, Calendar, Clock, AlertTriangle, CheckCircle, XCircle,
  Plus, Search, Filter, Download, RefreshCw, Eye, Edit, Trash2, X,
  ChevronRight, ChevronDown, ArrowUpRight, ArrowDownRight, Banknote,
  PiggyBank, Calculator, BarChart3, PieChart, Target, Users, Building,
  Send, FileCheck, AlertCircle, Check, Minus, ArrowRight, Landmark,
  CircleDollarSign, BadgeDollarSign, HandCoins, Coins, BanknoteIcon,
  ClipboardList, History, Settings, MoreHorizontal, ExternalLink
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

type Moneda = 'USD' | 'UYU' | 'EUR' | 'BRL' | 'ARS';

type TipoCuenta = 'banco' | 'caja' | 'digital' | 'inversion';

type TipoTransaccion = 'ingreso' | 'egreso' | 'transferencia' | 'ajuste';

type EstadoDocumento = 'pendiente' | 'parcial' | 'pagado' | 'vencido' | 'anulado';

type EstadoCheque = 'cartera' | 'depositado' | 'cobrado' | 'rechazado' | 'entregado';

type MetodoPago = 'efectivo' | 'transferencia' | 'cheque' | 'tarjeta' | 'digital' | 'compensacion';

type TabActiva = 'dashboard' | 'cxc' | 'cxp' | 'flujo' | 'transacciones' | 'cheques' | 'presupuesto';

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
  cliente?: { id: string; nombre: string; codigo: string };
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

interface Presupuesto {
  id: string;
  año: number;
  mes: number;
  categoria: string;
  tipo: 'ingreso' | 'egreso';
  montoPresupuestado: number;
  montoReal: number;
  variacion: number;
  notas?: string;
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

const AGING_BUCKETS = ['0-30', '31-60', '61-90', '90+'];

const COLORS_CHART = ['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];

const CATEGORIAS_GASTO = [
  'Mercadería', 'Servicios', 'Salarios', 'Alquiler', 'Impuestos', 
  'Servicios Públicos', 'Marketing', 'Transporte', 'Mantenimiento', 'Otros'
];

const CATEGORIAS_INGRESO = [
  'Ventas', 'Servicios', 'Intereses', 'Comisiones', 'Otros'
];

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

  // Datos
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [documentosCxC, setDocumentosCxC] = useState<DocumentoCxC[]>([]);
  const [documentosCxP, setDocumentosCxP] = useState<DocumentoCxP[]>([]);
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [tiposCambio, setTiposCambio] = useState<TipoCambio[]>([]);
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);

  // Catálogos
  const [clientes, setClientes] = useState<Array<{ id: string; nombre: string; codigo: string }>>([]);
  const [proveedores, setProveedores] = useState<Array<{ id: string; nombre: string; codigo: string }>>([]);

  // UI
  const [tabActiva, setTabActiva] = useState<TabActiva>('dashboard');
  const [monedaActiva, setMonedaActiva] = useState<Moneda>('USD');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState<EstadoDocumento | 'todos'>('todos');
  const [filterEstadoCheque, setFilterEstadoCheque] = useState<EstadoCheque | 'todos'>('todos');

  // Modales
  const [modalType, setModalType] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);

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
      .select('*, cliente:clientes(id, nombre, codigo), pagos:pagos_recibidos(*)')
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
        conciliado: t.conciliado,
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
      supabase.from('clientes').select('id, nombre, codigo').eq('activo', true).order('nombre'),
      supabase.from('proveedores').select('id, nombre, codigo').eq('activo', true).order('nombre'),
    ]);

    if (cliRes.data) setClientes(cliRes.data);
    if (provRes.data) setProveedores(provRes.data);
  };

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
  // ACCIONES - PAGOS CXC (COBROS)
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
  // ACCIONES - PAGOS CXP
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

      // Actualizar documento (monto pagado incluye retenciones)
      const nuevoMontoPagado = doc.montoPagado + montoTotal;
      const nuevoSaldo = doc.total - nuevoMontoPagado;
      const nuevoEstado: EstadoDocumento = nuevoSaldo <= 0 ? 'pagado' : 'parcial';

      await supabase.from('cuentas_por_pagar').update({
        monto_pagado: nuevoMontoPagado,
        saldo: nuevoSaldo,
        estado: nuevoEstado,
      }).eq('id', pagoForm.documentoId);

      // Actualizar saldo cuenta (solo el monto efectivo, no retenciones)
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
        estado: chequeForm.tipo === 'recibido' ? 'cartera' : 'emitido',
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
  // HELPERS RESET FORMS
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

  // ============================================
  // CÁLCULOS Y MÉTRICAS
  // ============================================

  const metricas = useMemo(() => {
    // Saldos por moneda
    const saldosPorMoneda: Record<Moneda, number> = { USD: 0, UYU: 0, EUR: 0, BRL: 0, ARS: 0 };
    cuentas.filter(c => c.activo).forEach(c => {
      saldosPorMoneda[c.moneda] += c.saldoActual;
    });

    // CxC
    const totalCxC = documentosCxC.filter(d => d.estado !== 'anulado').reduce((s, d) => s + d.saldo, 0);
    const cxcVencidas = documentosCxC.filter(d => d.estado !== 'anulado' && d.estado !== 'pagado' && getDiasVencimiento(d.fechaVencimiento) < 0);
    const totalCxCVencido = cxcVencidas.reduce((s, d) => s + d.saldo, 0);

    // CxP
    const totalCxP = documentosCxP.filter(d => d.estado !== 'anulado').reduce((s, d) => s + d.saldo, 0);
    const cxpVencidas = documentosCxP.filter(d => d.estado !== 'anulado' && d.estado !== 'pagado' && getDiasVencimiento(d.fechaVencimiento) < 0);
    const totalCxPVencido = cxpVencidas.reduce((s, d) => s + d.saldo, 0);

    // Cheques
    const chequesCartera = cheques.filter(ch => ch.tipo === 'recibido' && ch.estado === 'cartera');
    const totalChequesCartera = chequesCartera.reduce((s, ch) => s + ch.monto, 0);
    const chequesEmitidos = cheques.filter(ch => ch.tipo === 'emitido' && ch.estado === 'entregado');
    const totalChequesEmitidos = chequesEmitidos.reduce((s, ch) => s + ch.monto, 0);

    // Transacciones del mes
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
    const transMes = transacciones.filter(t => t.fecha >= inicioMes);
    const ingresosMes = transMes.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.monto, 0);
    const egresosMes = transMes.filter(t => t.tipo === 'egreso').reduce((s, t) => s + t.monto, 0);

    // Aging CxC y CxP
    const agingCxC = calcularAging(documentosCxC.filter(d => d.estado !== 'anulado' && d.estado !== 'pagado'));
    const agingCxP = calcularAging(documentosCxP.filter(d => d.estado !== 'anulado' && d.estado !== 'pagado'));

    // Próximos vencimientos (7 días)
    const proxVencCxC = documentosCxC.filter(d => {
      const dias = getDiasVencimiento(d.fechaVencimiento);
      return d.saldo > 0 && dias >= 0 && dias <= 7;
    });
    const proxVencCxP = documentosCxP.filter(d => {
      const dias = getDiasVencimiento(d.fechaVencimiento);
      return d.saldo > 0 && dias >= 0 && dias <= 7;
    });

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
      ingresosMes,
      egresosMes,
      flujoNetoMes: ingresosMes - egresosMes,
      agingCxC,
      agingCxP,
      proxVencCxC,
      proxVencCxP,
    };
  }, [cuentas, documentosCxC, documentosCxP, cheques, transacciones]);

  // Proyección de flujo de caja (30 días)
  const proyeccionFlujo = useMemo((): ProyeccionFlujo[] => {
    const proyeccion: ProyeccionFlujo[] = [];
    const hoy = new Date();
    let saldoAcumulado = cuentas.filter(c => c.activo && c.moneda === monedaActiva).reduce((s, c) => s + c.saldoActual, 0);

    for (let i = 0; i < 30; i++) {
      const fecha = new Date(hoy);
      fecha.setDate(fecha.getDate() + i);
      const fechaStr = fecha.toISOString().split('T')[0];

      // Ingresos esperados (CxC que vencen ese día)
      const ingresosDelDia = documentosCxC
        .filter(d => d.fechaVencimiento === fechaStr && d.saldo > 0 && d.moneda === monedaActiva)
        .map(d => ({ concepto: `${d.numero} - ${d.cliente?.nombre}`, monto: d.saldo }));
      const totalIngresos = ingresosDelDia.reduce((s, i) => s + i.monto, 0);

      // Egresos esperados (CxP que vencen ese día)
      const egresosDelDia = documentosCxP
        .filter(d => d.fechaVencimiento === fechaStr && d.saldo > 0 && d.moneda === monedaActiva)
        .map(d => ({ concepto: `${d.numero} - ${d.proveedor?.nombre}`, monto: d.saldo }));
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
  }, [documentosCxC, documentosCxP, cuentas, monedaActiva]);

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

  // ============================================
  // CONTINÚA EN PARTE 3 (RENDER)
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
          {/* Selector de moneda */}
          <select
            value={monedaActiva}
            onChange={(e) => setMonedaActiva(e.target.value as Moneda)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100"
          >
            {Object.entries(MONEDAS_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.simbolo} {config.nombre}</option>
            ))}
          </select>
          <button
            onClick={() => setModalType('tipoCambio')}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400"
            title="Tipo de cambio"
          >
            <Calculator className="h-4 w-4" />
          </button>
          <button
            onClick={loadAllData}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400"
          >
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
          { id: 'flujo', label: 'Flujo de Caja', icon: <TrendingUp className="h-4 w-4" /> },
          { id: 'transacciones', label: 'Transacciones', icon: <History className="h-4 w-4" /> },
          { id: 'cheques', label: 'Cheques', icon: <FileCheck className="h-4 w-4" /> },
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

          {/* Segunda fila - Cheques y alertas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileCheck className="h-5 w-5 text-blue-400" />
                <span className="text-sm font-medium text-slate-300">Cheques en Cartera</span>
              </div>
              <div className="text-xl font-bold text-blue-400">
                {formatCurrency(metricas.totalChequesCartera, monedaActiva)}
              </div>
              <div className="text-xs text-slate-500">{metricas.chequesCartera} cheques</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileCheck className="h-5 w-5 text-orange-400" />
                <span className="text-sm font-medium text-slate-300">Cheques Emitidos</span>
              </div>
              <div className="text-xl font-bold text-orange-400">
                {formatCurrency(metricas.totalChequesEmitidos, monedaActiva)}
              </div>
              <div className="text-xs text-slate-500">{metricas.chequesEmitidos} cheques</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                <span className="text-sm font-medium text-slate-300">Vencimientos Próximos</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">CxC (7 días)</span>
                  <span className="text-cyan-400">{metricas.proxVencCxC.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">CxP (7 días)</span>
                  <span className="text-amber-400">{metricas.proxVencCxP.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Aging CxC */}
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

            {/* Aging CxP */}
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

            {/* Flujo proyectado */}
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 lg:col-span-2">
              <h3 className="text-sm font-semibold text-slate-400 mb-4">Flujo de Caja Proyectado (30 días)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={proyeccionFlujo}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis 
                      dataKey="fecha" 
                      tick={{ fill: '#94a3b8', fontSize: 10 }} 
                      tickFormatter={(v) => formatDateShort(v)}
                    />
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
          </div>

          {/* Cuentas bancarias */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-400">Cuentas</h3>
              <button
                onClick={() => setModalType('cuenta')}
                className="text-sm text-emerald-400 hover:text-emerald-300"
              >
                + Nueva cuenta
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {cuentas.filter(c => c.activo).map(cuenta => {
                const tipoConfig = TIPOS_CUENTA_CONFIG[cuenta.tipo];
                return (
                  <div key={cuenta.id} className="p-3 bg-slate-800/30 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      {tipoConfig.icono}
                      <span className="text-sm font-medium text-slate-200">{cuenta.nombre}</span>
                    </div>
                    {cuenta.banco && (
                      <div className="text-xs text-slate-500 mb-1">{cuenta.banco}</div>
                    )}
                    <div className="text-lg font-bold text-emerald-400">
                      {formatCurrency(cuenta.saldoActual, cuenta.moneda)}
                    </div>
                  </div>
                );
              })}
              {cuentas.filter(c => c.activo).length === 0 && (
                <div className="col-span-full text-center py-6 text-slate-500">
                  No hay cuentas configuradas
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== CUENTAS POR COBRAR ==================== */}
      {tabActiva === 'cxc' && (
        <div className="space-y-4">
          {/* Header CxC */}
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
            <button
              onClick={() => setModalType('nuevoCxC')}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl"
            >
              <Plus className="h-4 w-4" />
              Nuevo Documento
            </button>
          </div>

          {/* Tabla CxC */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Documento</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Cliente</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Emisión</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Vencimiento</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Saldo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {documentosCxCFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        No hay documentos
                      </td>
                    </tr>
                  ) : (
                    documentosCxCFiltrados.map(doc => {
                      const estadoConfig = ESTADO_DOCUMENTO_CONFIG[doc.estado];
                      const diasVenc = getDiasVencimiento(doc.fechaVencimiento);
                      const estaVencido = diasVenc < 0 && doc.saldo > 0;

                      return (
                        <tr key={doc.id} className="hover:bg-slate-800/30">
                          <td className="px-4 py-3">
                            <div className="font-mono text-sm text-slate-200">{doc.numero}</div>
                            <div className="text-xs text-slate-500 capitalize">{doc.tipo}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-300">{doc.cliente?.nombre || '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-400">{formatDate(doc.fechaEmision)}</td>
                          <td className="px-4 py-3">
                            <div className={`text-sm ${estaVencido ? 'text-red-400' : 'text-slate-400'}`}>
                              {formatDate(doc.fechaVencimiento)}
                            </div>
                            {estaVencido && (
                              <div className="text-xs text-red-400">{Math.abs(diasVenc)} días vencido</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-300">
                            {formatCurrency(doc.total, doc.moneda)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-cyan-400">
                            {formatCurrency(doc.saldo, doc.moneda)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs border ${estadoConfig.bg} ${estadoConfig.color}`}>
                              {estadoConfig.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <button
                                onClick={() => { setSelectedItem(doc); setModalType('verCxC'); }}
                                className="p-1.5 hover:bg-slate-700 rounded-lg"
                                title="Ver detalle"
                              >
                                <Eye className="h-4 w-4 text-blue-400" />
                              </button>
                              {doc.saldo > 0 && (
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
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== CUENTAS POR PAGAR ==================== */}
      {tabActiva === 'cxp' && (
        <div className="space-y-4">
          {/* Header CxP */}
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
            <button
              onClick={() => setModalType('nuevoCxP')}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl"
            >
              <Plus className="h-4 w-4" />
              Nuevo Documento
            </button>
          </div>

          {/* Tabla CxP */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Documento</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Proveedor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Emisión</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Vencimiento</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Saldo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {documentosCxPFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        No hay documentos
                      </td>
                    </tr>
                  ) : (
                    documentosCxPFiltrados.map(doc => {
                      const estadoConfig = ESTADO_DOCUMENTO_CONFIG[doc.estado];
                      const diasVenc = getDiasVencimiento(doc.fechaVencimiento);
                      const estaVencido = diasVenc < 0 && doc.saldo > 0;

                      return (
                        <tr key={doc.id} className="hover:bg-slate-800/30">
                          <td className="px-4 py-3">
                            <div className="font-mono text-sm text-slate-200">{doc.numero}</div>
                            <div className="text-xs text-slate-500 capitalize">{doc.tipo}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-300">{doc.proveedor?.nombre || '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-400">{formatDate(doc.fechaEmision)}</td>
                          <td className="px-4 py-3">
                            <div className={`text-sm ${estaVencido ? 'text-red-400' : 'text-slate-400'}`}>
                              {formatDate(doc.fechaVencimiento)}
                            </div>
                            {estaVencido && (
                              <div className="text-xs text-red-400">{Math.abs(diasVenc)} días vencido</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-300">
                            {formatCurrency(doc.total, doc.moneda)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-amber-400">
                            {formatCurrency(doc.saldo, doc.moneda)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs border ${estadoConfig.bg} ${estadoConfig.color}`}>
                              {estadoConfig.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <button
                                onClick={() => { setSelectedItem(doc); setModalType('verCxP'); }}
                                className="p-1.5 hover:bg-slate-700 rounded-lg"
                                title="Ver detalle"
                              >
                                <Eye className="h-4 w-4 text-blue-400" />
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
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CONTINÚA EN PARTE 4 */}
      {/* ==================== FLUJO DE CAJA ==================== */}
      {tabActiva === 'flujo' && (
        <div className="space-y-4">
          {/* Resumen */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="text-sm text-slate-400 mb-1">Saldo Actual</div>
              <div className="text-2xl font-bold text-emerald-400">
                {formatCurrency(metricas.saldosPorMoneda[monedaActiva], monedaActiva)}
              </div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="text-sm text-slate-400 mb-1">Ingresos Esperados (30d)</div>
              <div className="text-2xl font-bold text-cyan-400">
                {formatCurrency(proyeccionFlujo.reduce((s, p) => s + p.ingresos, 0), monedaActiva)}
              </div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="text-sm text-slate-400 mb-1">Egresos Esperados (30d)</div>
              <div className="text-2xl font-bold text-amber-400">
                {formatCurrency(proyeccionFlujo.reduce((s, p) => s + p.egresos, 0), monedaActiva)}
              </div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="text-sm text-slate-400 mb-1">Saldo Proyectado</div>
              <div className={`text-2xl font-bold ${proyeccionFlujo[29]?.saldoProyectado >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(proyeccionFlujo[29]?.saldoProyectado || 0, monedaActiva)}
              </div>
            </div>
          </div>

          {/* Gráfico grande */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-400 mb-4">Proyección de Flujo de Caja</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={proyeccionFlujo}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis 
                    dataKey="fecha" 
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickFormatter={(v) => formatDateShort(v)}
                  />
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

          {/* Detalle por día */}
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
          {/* Header */}
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex-1 flex gap-3">
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
            </div>
            <button
              onClick={() => setModalType('transaccion')}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl"
            >
              <Plus className="h-4 w-4" />
              Nueva Transacción
            </button>
          </div>

          {/* Tabla */}
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Referencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {transacciones.filter(t => 
                    !searchTerm || t.concepto.toLowerCase().includes(searchTerm.toLowerCase())
                  ).slice(0, 100).map(trans => (
                    <tr key={trans.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-sm text-slate-400">{formatDate(trans.fecha)}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{trans.cuenta?.nombre || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-slate-200">{trans.concepto}</div>
                        {trans.notas && <div className="text-xs text-slate-500">{trans.notas}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">{trans.categoria || '-'}</td>
                      <td className={`px-4 py-3 text-right font-mono font-bold ${
                        trans.tipo === 'ingreso' ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {trans.tipo === 'ingreso' ? '+' : '-'}{formatCurrency(trans.monto, trans.moneda)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{trans.referencia || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== CHEQUES ==================== */}
      {tabActiva === 'cheques' && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setFilterEstadoCheque('todos')}
                className={`px-3 py-1.5 rounded-lg text-sm ${filterEstadoCheque === 'todos' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                >
                Todos
                </button>
                <button
                onClick={() => setFilterEstadoCheque('cartera')}
                className={`px-3 py-1.5 rounded-lg text-sm ${filterEstadoCheque === 'cartera' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                >
                En Cartera
                </button>
                <button
                onClick={() => setFilterEstadoCheque('depositado')}
                className={`px-3 py-1.5 rounded-lg text-sm ${filterEstadoCheque === 'depositado' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                >
                Depositados
                </button>
            </div>
            <button
              onClick={() => setModalType('cheque')}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl"
            >
              <Plus className="h-4 w-4" />
              Nuevo Cheque
            </button>
          </div>

          {/* Grid de cheques */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cheques.filter(ch => 
              filterEstadoCheque === 'todos' || ch.estado === filterEstadoCheque
            ).map(cheque => {
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
                    <span className={`px-2 py-1 rounded-lg text-xs border ${estadoConfig.bg} ${estadoConfig.color}`}>
                      {estadoConfig.label}
                    </span>
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
                    {cheque.tipo === 'recibido' && cheque.librador && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Librador</span>
                        <span className="text-slate-300">{cheque.librador}</span>
                      </div>
                    )}
                    {cheque.tipo === 'emitido' && cheque.beneficiario && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Beneficiario</span>
                        <span className="text-slate-300">{cheque.beneficiario}</span>
                      </div>
                    )}
                  </div>

                  {/* Acciones */}
                  {cheque.estado === 'cartera' && cheque.tipo === 'recibido' && (
                    <div className="mt-4 pt-3 border-t border-slate-800 flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedItem(cheque);
                          setModalType('depositarCheque');
                        }}
                        className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"
                      >
                        Depositar
                      </button>
                      <button
                        onClick={() => cambiarEstadoCheque(cheque, 'cobrado', cuentas[0]?.id)}
                        disabled={procesando === cheque.id}
                        className="flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm"
                      >
                        Cobrado
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {cheques.filter(ch => filterEstadoCheque === 'todos' || ch.estado === filterEstadoCheque).length === 0 && (
              <div className="col-span-full text-center py-12 text-slate-500">
                No hay cheques
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTINÚA EN PARTE 5 - MODALES */}
      {/* ==================== MODALES ==================== */}

      {/* MODAL: NUEVA CUENTA */}
      {modalType === 'cuenta' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100">Nueva Cuenta</h3>
              <button onClick={() => setModalType(null)} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={cuentaForm.nombre}
                  onChange={(e) => setCuentaForm({ ...cuentaForm, nombre: e.target.value })}
                  placeholder="Ej: Banco Santander USD"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Tipo</label>
                  <select
                    value={cuentaForm.tipo}
                    onChange={(e) => setCuentaForm({ ...cuentaForm, tipo: e.target.value as TipoCuenta })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  >
                    {Object.entries(TIPOS_CUENTA_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>{config.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Moneda</label>
                  <select
                    value={cuentaForm.moneda}
                    onChange={(e) => setCuentaForm({ ...cuentaForm, moneda: e.target.value as Moneda })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  >
                    {Object.entries(MONEDAS_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>{config.simbolo} {config.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Banco</label>
                <input
                  type="text"
                  value={cuentaForm.banco}
                  onChange={(e) => setCuentaForm({ ...cuentaForm, banco: e.target.value })}
                  placeholder="Nombre del banco"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Número de Cuenta</label>
                <input
                  type="text"
                  value={cuentaForm.numeroCuenta}
                  onChange={(e) => setCuentaForm({ ...cuentaForm, numeroCuenta: e.target.value })}
                  placeholder="Número de cuenta"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Saldo Inicial</label>
                <input
                  type="number"
                  value={cuentaForm.saldoActual}
                  onChange={(e) => setCuentaForm({ ...cuentaForm, saldoActual: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  step="0.01"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={crearCuenta}
                disabled={procesando === 'cuenta'}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl"
              >
                {procesando === 'cuenta' ? <RefreshCw className="h-4 w-4 animate-spin mx-auto" /> : 'Crear Cuenta'}
              </button>
              <button onClick={() => setModalType(null)} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">
                Cancelar
              </button>
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
              <button onClick={() => { setModalType(null); resetPagoForm(); }} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl mb-4">
              <div className="text-sm text-slate-400">Documento</div>
              <div className="font-mono text-lg text-slate-200">{selectedItem.numero}</div>
              <div className="text-sm text-slate-400">{selectedItem.cliente?.nombre}</div>
              <div className="flex justify-between mt-2">
                <span className="text-slate-500">Saldo pendiente:</span>
                <span className="font-bold text-cyan-400">{formatCurrency(selectedItem.saldo, selectedItem.moneda)}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Cuenta destino *</label>
                <select
                  value={pagoForm.cuentaId}
                  onChange={(e) => setPagoForm({ ...pagoForm, cuentaId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                >
                  <option value="">Seleccionar...</option>
                  {cuentas.filter(c => c.activo).map(c => (
                    <option key={c.id} value={c.id}>{c.nombre} ({formatCurrency(c.saldoActual, c.moneda)})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Fecha *</label>
                  <input
                    type="date"
                    value={pagoForm.fecha}
                    onChange={(e) => setPagoForm({ ...pagoForm, fecha: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Monto *</label>
                  <input
                    type="number"
                    value={pagoForm.monto}
                    onChange={(e) => setPagoForm({ ...pagoForm, monto: parseFloat(e.target.value) || 0 })}
                    max={selectedItem.saldo}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                    step="0.01"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Método de pago</label>
                <select
                  value={pagoForm.metodoPago}
                  onChange={(e) => setPagoForm({ ...pagoForm, metodoPago: e.target.value as MetodoPago })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                >
                  {Object.entries(METODOS_PAGO_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>{config.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Referencia</label>
                <input
                  type="text"
                  value={pagoForm.referencia}
                  onChange={(e) => setPagoForm({ ...pagoForm, referencia: e.target.value })}
                  placeholder="Nº transferencia, recibo, etc."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={registrarCobro}
                disabled={procesando === 'cobro' || !pagoForm.cuentaId || pagoForm.monto <= 0}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl"
              >
                {procesando === 'cobro' ? <RefreshCw className="h-4 w-4 animate-spin mx-auto" /> : 'Registrar Cobro'}
              </button>
              <button onClick={() => { setModalType(null); resetPagoForm(); }} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">
                Cancelar
              </button>
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
              <button onClick={() => { setModalType(null); resetPagoForm(); }} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-4">
              <div className="text-sm text-slate-400">Documento</div>
              <div className="font-mono text-lg text-slate-200">{selectedItem.numero}</div>
              <div className="text-sm text-slate-400">{selectedItem.proveedor?.nombre}</div>
              <div className="flex justify-between mt-2">
                <span className="text-slate-500">Saldo pendiente:</span>
                <span className="font-bold text-amber-400">{formatCurrency(selectedItem.saldo, selectedItem.moneda)}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Cuenta origen *</label>
                <select
                  value={pagoForm.cuentaId}
                  onChange={(e) => setPagoForm({ ...pagoForm, cuentaId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                >
                  <option value="">Seleccionar...</option>
                  {cuentas.filter(c => c.activo).map(c => (
                    <option key={c.id} value={c.id}>{c.nombre} ({formatCurrency(c.saldoActual, c.moneda)})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Fecha *</label>
                  <input
                    type="date"
                    value={pagoForm.fecha}
                    onChange={(e) => setPagoForm({ ...pagoForm, fecha: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Monto efectivo *</label>
                  <input
                    type="number"
                    value={pagoForm.monto}
                    onChange={(e) => setPagoForm({ ...pagoForm, monto: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                    step="0.01"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Método de pago</label>
                <select
                  value={pagoForm.metodoPago}
                  onChange={(e) => setPagoForm({ ...pagoForm, metodoPago: e.target.value as MetodoPago })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                >
                  {Object.entries(METODOS_PAGO_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>{config.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Retenciones */}
              <div className="p-3 bg-slate-800/50 rounded-xl">
                <div className="text-sm text-slate-400 mb-2">Retenciones (DGI)</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Ret. IVA</label>
                    <input
                      type="number"
                      value={pagoForm.retencionIVA}
                      onChange={(e) => setPagoForm({ ...pagoForm, retencionIVA: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Ret. Renta</label>
                    <input
                      type="number"
                      value={pagoForm.retencionRenta}
                      onChange={(e) => setPagoForm({ ...pagoForm, retencionRenta: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100"
                      step="0.01"
                    />
                  </div>
                </div>
                <div className="flex justify-between mt-2 text-sm">
                  <span className="text-slate-500">Total aplicado:</span>
                  <span className="text-emerald-400 font-bold">
                    {formatCurrency(pagoForm.monto + pagoForm.retencionIVA + pagoForm.retencionRenta, selectedItem.moneda)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Referencia</label>
                <input
                  type="text"
                  value={pagoForm.referencia}
                  onChange={(e) => setPagoForm({ ...pagoForm, referencia: e.target.value })}
                  placeholder="Nº transferencia, cheque, etc."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={registrarPago}
                disabled={procesando === 'pago' || !pagoForm.cuentaId || pagoForm.monto <= 0}
                className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl"
              >
                {procesando === 'pago' ? <RefreshCw className="h-4 w-4 animate-spin mx-auto" /> : 'Registrar Pago'}
              </button>
              <button onClick={() => { setModalType(null); resetPagoForm(); }} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NUEVA TRANSACCIÓN */}
      {modalType === 'transaccion' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100">Nueva Transacción</h3>
              <button onClick={() => { setModalType(null); resetTransaccionForm(); }} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Tipo *</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTransaccionForm({ ...transaccionForm, tipo: 'ingreso' })}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium ${
                      transaccionForm.tipo === 'ingreso' 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    Ingreso
                  </button>
                  <button
                    onClick={() => setTransaccionForm({ ...transaccionForm, tipo: 'egreso' })}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium ${
                      transaccionForm.tipo === 'egreso' 
                        ? 'bg-red-600 text-white' 
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    Egreso
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Cuenta *</label>
                <select
                  value={transaccionForm.cuentaId}
                  onChange={(e) => setTransaccionForm({ ...transaccionForm, cuentaId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                >
                  <option value="">Seleccionar...</option>
                  {cuentas.filter(c => c.activo).map(c => (
                    <option key={c.id} value={c.id}>{c.nombre} ({formatCurrency(c.saldoActual, c.moneda)})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Fecha *</label>
                  <input
                    type="date"
                    value={transaccionForm.fecha}
                    onChange={(e) => setTransaccionForm({ ...transaccionForm, fecha: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Monto *</label>
                  <input
                    type="number"
                    value={transaccionForm.monto}
                    onChange={(e) => setTransaccionForm({ ...transaccionForm, monto: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                    step="0.01"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Concepto *</label>
                <input
                  type="text"
                  value={transaccionForm.concepto}
                  onChange={(e) => setTransaccionForm({ ...transaccionForm, concepto: e.target.value })}
                  placeholder="Descripción de la transacción"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Categoría</label>
                <select
                  value={transaccionForm.categoria}
                  onChange={(e) => setTransaccionForm({ ...transaccionForm, categoria: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                >
                  <option value="">Sin categoría</option>
                  {(transaccionForm.tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_GASTO).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Referencia</label>
                <input
                  type="text"
                  value={transaccionForm.referencia}
                  onChange={(e) => setTransaccionForm({ ...transaccionForm, referencia: e.target.value })}
                  placeholder="Nº comprobante, factura, etc."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={crearTransaccion}
                disabled={procesando === 'transaccion' || !transaccionForm.cuentaId || transaccionForm.monto <= 0 || !transaccionForm.concepto}
                className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl"
              >
                {procesando === 'transaccion' ? <RefreshCw className="h-4 w-4 animate-spin mx-auto" /> : 'Registrar'}
              </button>
              <button onClick={() => { setModalType(null); resetTransaccionForm(); }} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NUEVO CHEQUE */}
      {modalType === 'cheque' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100">Nuevo Cheque</h3>
              <button onClick={() => { setModalType(null); resetChequeForm(); }} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Tipo *</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setChequeForm({ ...chequeForm, tipo: 'recibido' })}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium ${
                      chequeForm.tipo === 'recibido' 
                        ? 'bg-cyan-600 text-white' 
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    Recibido
                  </button>
                  <button
                    onClick={() => setChequeForm({ ...chequeForm, tipo: 'emitido' })}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium ${
                      chequeForm.tipo === 'emitido' 
                        ? 'bg-orange-600 text-white' 
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    Emitido
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Número *</label>
                  <input
                    type="text"
                    value={chequeForm.numero}
                    onChange={(e) => setChequeForm({ ...chequeForm, numero: e.target.value })}
                    placeholder="Nº cheque"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Banco *</label>
                  <input
                    type="text"
                    value={chequeForm.banco}
                    onChange={(e) => setChequeForm({ ...chequeForm, banco: e.target.value })}
                    placeholder="Banco emisor"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Monto *</label>
                  <input
                    type="number"
                    value={chequeForm.monto}
                    onChange={(e) => setChequeForm({ ...chequeForm, monto: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Moneda</label>
                  <select
                    value={chequeForm.moneda}
                    onChange={(e) => setChequeForm({ ...chequeForm, moneda: e.target.value as Moneda })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  >
                    {Object.entries(MONEDAS_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>{config.simbolo} {config.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Fecha Emisión</label>
                  <input
                    type="date"
                    value={chequeForm.fechaEmision}
                    onChange={(e) => setChequeForm({ ...chequeForm, fechaEmision: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Fecha Vencimiento</label>
                  <input
                    type="date"
                    value={chequeForm.fechaVencimiento}
                    onChange={(e) => setChequeForm({ ...chequeForm, fechaVencimiento: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
              </div>
              {chequeForm.tipo === 'recibido' ? (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Librador</label>
                  <input
                    type="text"
                    value={chequeForm.librador}
                    onChange={(e) => setChequeForm({ ...chequeForm, librador: e.target.value })}
                    placeholder="Quien emitió el cheque"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Beneficiario</label>
                  <input
                    type="text"
                    value={chequeForm.beneficiario}
                    onChange={(e) => setChequeForm({ ...chequeForm, beneficiario: e.target.value })}
                    placeholder="A quien va dirigido"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={crearCheque}
                disabled={procesando === 'cheque' || !chequeForm.numero || !chequeForm.banco || chequeForm.monto <= 0}
                className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl"
              >
                {procesando === 'cheque' ? <RefreshCw className="h-4 w-4 animate-spin mx-auto" /> : 'Registrar Cheque'}
              </button>
              <button onClick={() => { setModalType(null); resetChequeForm(); }} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TIPO DE CAMBIO */}
      {modalType === 'tipoCambio' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100">Tipo de Cambio</h3>
              <button onClick={() => setModalType(null)} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            {/* Últimos tipos de cambio */}
            {tiposCambio.length > 0 && (
              <div className="mb-4 p-3 bg-slate-800/50 rounded-xl">
                <div className="text-xs text-slate-500 mb-2">Últimos registrados</div>
                <div className="space-y-1">
                  {tiposCambio.slice(0, 3).map(tc => (
                    <div key={tc.id} className="flex justify-between text-sm">
                      <span className="text-slate-400">{tc.monedaOrigen}/{tc.monedaDestino}</span>
                      <span className="text-slate-200">{tc.tasa.toFixed(4)}</span>
                      <span className="text-slate-500">{formatDate(tc.fecha)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Moneda Origen</label>
                  <select
                    value={tipoCambioForm.monedaOrigen}
                    onChange={(e) => setTipoCambioForm({ ...tipoCambioForm, monedaOrigen: e.target.value as Moneda })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  >
                    {Object.entries(MONEDAS_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>{config.simbolo} {key}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Moneda Destino</label>
                  <select
                    value={tipoCambioForm.monedaDestino}
                    onChange={(e) => setTipoCambioForm({ ...tipoCambioForm, monedaDestino: e.target.value as Moneda })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  >
                    {Object.entries(MONEDAS_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>{config.simbolo} {key}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Tasa</label>
                  <input
                    type="number"
                    value={tipoCambioForm.tasa}
                    onChange={(e) => setTipoCambioForm({ ...tipoCambioForm, tasa: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                    step="0.0001"
                    placeholder="Ej: 40.50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Fecha</label>
                  <input
                    type="date"
                    value={tipoCambioForm.fecha}
                    onChange={(e) => setTipoCambioForm({ ...tipoCambioForm, fecha: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={guardarTipoCambio}
                disabled={procesando === 'tipocambio' || tipoCambioForm.tasa <= 0}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl"
              >
                {procesando === 'tipocambio' ? <RefreshCw className="h-4 w-4 animate-spin mx-auto" /> : 'Guardar'}
              </button>
              <button onClick={() => setModalType(null)} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}