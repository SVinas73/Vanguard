'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Users, ShoppingCart, FileText, Search, Edit, Trash2, Send, CheckCircle,
  XCircle, Clock, ChevronDown, ChevronUp, RefreshCw, Eye, CreditCard,
  AlertTriangle, Calendar, DollarSign, Building, User, Package, X, ArrowRight
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn, formatCurrency } from '@/lib/utils';
import { Product } from '@/types';

// ============================================
// TIPOS
// ============================================

interface Cliente {
  id: string;
  codigo: string;
  tipo: 'persona' | 'empresa';
  nombre: string;
  rut?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  limiteCredito: number;
  saldoPendiente: number;
}

interface OrdenVentaItem {
  id: string;
  ordenId: string;
  productoCodigo: string;
  cantidad: number;
  precioUnitario: number;
  descuentoItem: number;
  subtotal: number;
}

interface OrdenVenta {
  id: string;
  numero: string;
  clienteId: string;
  cliente?: Cliente;
  estado: 'borrador' | 'confirmada' | 'en_proceso' | 'enviada' | 'entregada' | 'cancelada';
  estadoPago: 'pendiente' | 'parcial' | 'pagado' | 'vencido';
  fechaOrden: string;
  fechaEntregaEsperada?: string;
  fechaEntregada?: string;
  subtotal: number;
  descuento: number;
  impuestos: number;
  total: number;
  montoPagado: number;
  saldoPendiente: number;
  metodoPago?: string;
  notas?: string;
  direccionEnvio?: string;
  items: OrdenVentaItem[];
}

interface CotizacionItem {
  id: string;
  productoCodigo: string;
  cantidad: number;
  precioUnitario: number;
  descuentoItem: number;
  subtotal: number;
}

interface Cotizacion {
  id: string;
  numero: string;
  clienteId: string;
  cliente?: Cliente;
  estado: 'borrador' | 'enviada' | 'aceptada' | 'rechazada' | 'expirada' | 'convertida';
  fechaCotizacion: string;
  fechaValidez?: string;
  subtotal: number;
  descuento: number;
  total: number;
  notas?: string;
  ordenVentaId?: string;
  items: CotizacionItem[];
}

type TabActiva = 'ordenes' | 'cotizaciones';
type ModalType = 'crear-orden' | 'crear-cotizacion' | 'pago' | 'cliente' | 'ver-orden' | 'ver-cotizacion' | null;

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
        <div key={t.id} className={cn(
          'px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3',
          t.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' :
          t.type === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-400' :
          'bg-amber-500/20 border-amber-500/30 text-amber-400'
        )}>
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
// HELPERS
// ============================================

const getEstadoOrdenConfig = (estado: OrdenVenta['estado']) => {
  const configs = {
    borrador: { color: 'text-slate-400', bg: 'bg-slate-500/20', label: 'Borrador' },
    confirmada: { color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Confirmada' },
    en_proceso: { color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'En Proceso' },
    enviada: { color: 'text-purple-400', bg: 'bg-purple-500/20', label: 'Enviada' },
    entregada: { color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'Entregada' },
    cancelada: { color: 'text-red-400', bg: 'bg-red-500/20', label: 'Cancelada' },
  };
  return configs[estado];
};

const getEstadoPagoConfig = (estado: OrdenVenta['estadoPago']) => {
  const configs = {
    pendiente: { color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'Pendiente' },
    parcial: { color: 'text-cyan-400', bg: 'bg-cyan-500/20', label: 'Parcial' },
    pagado: { color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'Pagado' },
    vencido: { color: 'text-red-400', bg: 'bg-red-500/20', label: 'Vencido' },
  };
  return configs[estado];
};

const getEstadoCotizacionConfig = (estado: Cotizacion['estado']) => {
  const configs = {
    borrador: { color: 'text-slate-400', bg: 'bg-slate-500/20', label: 'Borrador' },
    enviada: { color: 'text-cyan-400', bg: 'bg-cyan-500/20', label: 'Enviada' },
    aceptada: { color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'Aceptada' },
    rechazada: { color: 'text-red-400', bg: 'bg-red-500/20', label: 'Rechazada' },
    expirada: { color: 'text-slate-400', bg: 'bg-slate-500/20', label: 'Expirada' },
    convertida: { color: 'text-purple-400', bg: 'bg-purple-500/20', label: 'Convertida' },
  };
  return configs[estado];
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

interface VentasEnterprisePanelProps {
  products: Product[];
  userEmail: string;
}

export default function VentasEnterprisePanel({ products, userEmail }: VentasEnterprisePanelProps) {
  const toast = useToast();

  // Estado principal
  const [tabActiva, setTabActiva] = useState<TabActiva>('ordenes');
  const [ordenes, setOrdenes] = useState<OrdenVenta[]>([]);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('todos');

  // UI
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [modalType, setModalType] = useState<ModalType>(null);
  const [selectedOrden, setSelectedOrden] = useState<OrdenVenta | null>(null);
  const [selectedCotizacion, setSelectedCotizacion] = useState<Cotizacion | null>(null);

  // Form orden
  const [ordenForm, setOrdenForm] = useState({
    clienteId: '',
    fechaEntrega: '',
    direccionEnvio: '',
    notas: '',
    items: [] as Array<{ productoCodigo: string; cantidad: number; precioUnitario: number; descuento: number }>,
  });

  // Form cotización
  const [cotizacionForm, setCotizacionForm] = useState({
    clienteId: '',
    fechaValidez: '',
    notas: '',
    items: [] as Array<{ productoCodigo: string; cantidad: number; precioUnitario: number; descuento: number }>,
  });

  // Form pago
  const [pagoForm, setPagoForm] = useState({
    monto: 0,
    metodoPago: 'efectivo',
    referencia: '',
    notas: '',
  });

  // Form cliente
  const [clienteForm, setClienteForm] = useState({
    codigo: '', tipo: 'persona' as 'persona' | 'empresa', nombre: '', rut: '', email: '', telefono: '', direccion: '', limiteCredito: 0,
  });
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);

  // ============================================
  // CARGA DE DATOS
  // ============================================

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [ordenesRes, cotizacionesRes, clientesRes] = await Promise.all([
        supabase
          .from('ordenes_venta')
          .select(`*, clientes(id, codigo, nombre, email, telefono), ordenes_venta_items(*)`)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('cotizaciones')
          .select(`*, clientes(id, codigo, nombre), cotizaciones_items(*)`)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('clientes')
          .select('*')
          .eq('activo', true)
          .order('nombre'),
      ]);

      if (ordenesRes.data) {
        setOrdenes(ordenesRes.data.map((o: any) => ({
          id: o.id,
          numero: o.numero,
          clienteId: o.cliente_id,
          cliente: o.clientes,
          estado: o.estado,
          estadoPago: o.estado_pago || 'pendiente',
          fechaOrden: o.fecha_orden,
          fechaEntregaEsperada: o.fecha_entrega_esperada,
          fechaEntregada: o.fecha_entregada,
          subtotal: parseFloat(o.subtotal) || 0,
          descuento: parseFloat(o.descuento) || 0,
          impuestos: parseFloat(o.impuestos) || 0,
          total: parseFloat(o.total) || 0,
          montoPagado: parseFloat(o.monto_pagado) || 0,
          saldoPendiente: parseFloat(o.saldo_pendiente) || parseFloat(o.total) || 0,
          metodoPago: o.metodo_pago,
          notas: o.notas,
          direccionEnvio: o.direccion_envio,
          items: (o.ordenes_venta_items || []).map((i: any) => ({
            id: i.id,
            ordenId: i.orden_id,
            productoCodigo: i.producto_codigo,
            cantidad: i.cantidad,
            precioUnitario: parseFloat(i.precio_unitario) || 0,
            descuentoItem: parseFloat(i.descuento_item) || 0,
            subtotal: parseFloat(i.subtotal) || 0,
          })),
        })));
      }

      if (cotizacionesRes.data) {
        setCotizaciones(cotizacionesRes.data.map((c: any) => ({
          id: c.id,
          numero: c.numero,
          clienteId: c.cliente_id,
          cliente: c.clientes,
          estado: c.estado,
          fechaCotizacion: c.fecha_cotizacion,
          fechaValidez: c.fecha_validez,
          subtotal: parseFloat(c.subtotal) || 0,
          descuento: parseFloat(c.descuento) || 0,
          total: parseFloat(c.total) || 0,
          notas: c.notas,
          ordenVentaId: c.orden_venta_id,
          items: (c.cotizaciones_items || []).map((i: any) => ({
            id: i.id,
            productoCodigo: i.producto_codigo,
            cantidad: i.cantidad,
            precioUnitario: parseFloat(i.precio_unitario) || 0,
            descuentoItem: parseFloat(i.descuento_item) || 0,
            subtotal: parseFloat(i.subtotal) || 0,
          })),
        })));
      }

      if (clientesRes.data) {
        setClientes(clientesRes.data.map((c: any) => ({
          id: c.id,
          codigo: c.codigo,
          tipo: c.tipo,
          nombre: c.nombre,
          rut: c.rut,
          email: c.email,
          telefono: c.telefono,
          direccion: c.direccion,
          limiteCredito: parseFloat(c.limite_credito) || 0,
          saldoPendiente: parseFloat(c.saldo_pendiente) || 0,
        })));
      }
    } catch (error: any) {
      toast.error('Error al cargar datos', error.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // STATS Y FILTROS
  // ============================================

  const stats = useMemo(() => {
    const activas = ordenes.filter(o => !['entregada', 'cancelada'].includes(o.estado));
    const porCobrar = ordenes.filter(o => o.estadoPago !== 'pagado' && o.estado !== 'cancelada');
    const cotActivas = cotizaciones.filter(c => ['borrador', 'enviada'].includes(c.estado));
    
    return {
      ordenesActivas: activas.length,
      totalPorCobrar: porCobrar.reduce((sum, o) => sum + o.saldoPendiente, 0),
      cotizacionesActivas: cotActivas.length,
      valorCotizaciones: cotActivas.reduce((sum, c) => sum + c.total, 0),
    };
  }, [ordenes, cotizaciones]);

  const ordenesFiltradas = useMemo(() => {
    return ordenes.filter(o => {
      if (searchTerm && !o.numero.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !o.cliente?.nombre.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (filterEstado !== 'todos' && o.estado !== filterEstado) return false;
      return true;
    });
  }, [ordenes, searchTerm, filterEstado]);

  const cotizacionesFiltradas = useMemo(() => {
    return cotizaciones.filter(c => {
      if (searchTerm && !c.numero.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !c.cliente?.nombre.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (filterEstado !== 'todos' && c.estado !== filterEstado) return false;
      return true;
    });
  }, [cotizaciones, searchTerm, filterEstado]);

  // ============================================
  // ACCIONES - ORDEN DE VENTA
  // ============================================

  const crearOrdenVenta = async (desdeCotizacion?: Cotizacion) => {
    const form = desdeCotizacion ? {
      clienteId: desdeCotizacion.clienteId,
      items: desdeCotizacion.items.map(i => ({
        productoCodigo: i.productoCodigo,
        cantidad: i.cantidad,
        precioUnitario: i.precioUnitario,
        descuento: i.descuentoItem,
      })),
    } : ordenForm;

    if (!form.clienteId || form.items.length === 0) {
      toast.warning('Datos incompletos', 'Seleccione cliente y productos');
      return;
    }

    // Verificar stock
    for (const item of form.items) {
      const producto = products.find(p => p.codigo === item.productoCodigo);
      if (producto && producto.stock < item.cantidad) {
        toast.error('Stock insuficiente', `${producto.descripcion}: disponible ${producto.stock}`);
        return;
      }
    }

    try {
      setProcesando('creating');

      const { count } = await supabase.from('ordenes_venta').select('*', { count: 'exact', head: true });
      const numero = `OV-${String((count || 0) + 1).padStart(6, '0')}`;
      
      const subtotal = form.items.reduce((sum, i) => sum + ((i.cantidad * i.precioUnitario) - (i.descuento || 0)), 0);

      const { data: ordenData, error } = await supabase
        .from('ordenes_venta')
        .insert({
          numero,
          cliente_id: form.clienteId,
          estado: 'borrador',
          estado_pago: 'pendiente',
          fecha_entrega_esperada: ordenForm.fechaEntrega || null,
          subtotal,
          total: subtotal,
          saldo_pendiente: subtotal,
          notas: ordenForm.notas || null,
          direccion_envio: ordenForm.direccionEnvio || null,
          cotizacion_origen_id: desdeCotizacion?.id || null,
          creado_por: userEmail,
        })
        .select()
        .single();

      if (error) throw error;

      const itemsToInsert = form.items.map(item => ({
        orden_id: ordenData.id,
        producto_codigo: item.productoCodigo,
        cantidad: item.cantidad,
        precio_unitario: item.precioUnitario,
        descuento_item: item.descuento || 0,
        subtotal: (item.cantidad * item.precioUnitario) - (item.descuento || 0),
      }));

      await supabase.from('ordenes_venta_items').insert(itemsToInsert);

      // Si viene de cotización, marcarla como convertida
      if (desdeCotizacion) {
        await supabase.from('cotizaciones').update({
          estado: 'convertida',
          orden_venta_id: ordenData.id,
        }).eq('id', desdeCotizacion.id);
      }

      toast.success('Orden creada', `${numero}`);
      setModalType(null);
      setOrdenForm({ clienteId: '', fechaEntrega: '', direccionEnvio: '', notas: '', items: [] });
      loadData();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  const cambiarEstadoOrden = async (orden: OrdenVenta, nuevoEstado: OrdenVenta['estado']) => {
    try {
      setProcesando(orden.id);

      const updateData: any = { estado: nuevoEstado, updated_at: new Date().toISOString() };
      
      if (nuevoEstado === 'entregada') {
        updateData.fecha_entregada = new Date().toISOString().split('T')[0];
      }

      // Si se confirma, descontar stock
      if (nuevoEstado === 'confirmada') {
        for (const item of orden.items) {
          const { data: prod } = await supabase
            .from('productos')
            .select('id, stock')
            .eq('codigo', item.productoCodigo)
            .single();

          if (prod) {
            if (prod.stock < item.cantidad) {
              toast.error('Stock insuficiente', `${item.productoCodigo}`);
              setProcesando(null);
              return;
            }

            await supabase.from('productos')
              .update({ stock: prod.stock - item.cantidad })
              .eq('codigo', item.productoCodigo);

            await supabase.from('movimientos').insert({
              producto_id: prod.id,
              codigo: item.productoCodigo,
              tipo: 'salida',
              cantidad: item.cantidad,
              notas: `Venta ${orden.numero}`,
              usuario_email: userEmail,
            });
          }
        }
      }

      await supabase.from('ordenes_venta').update(updateData).eq('id', orden.id);
      toast.success('Estado actualizado', `${orden.numero} → ${nuevoEstado}`);
      loadData();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // ACCIONES - PAGOS
  // ============================================

  const registrarPago = async () => {
    if (!selectedOrden || pagoForm.monto <= 0) {
      toast.warning('Ingrese monto válido');
      return;
    }

    if (pagoForm.monto > selectedOrden.saldoPendiente) {
      toast.warning('Monto excede saldo', `Saldo pendiente: ${formatCurrency(selectedOrden.saldoPendiente)}`);
      return;
    }

    try {
      setProcesando(selectedOrden.id);

      const { count } = await supabase.from('pagos_venta').select('*', { count: 'exact', head: true });
      const numero = `PAG-${String((count || 0) + 1).padStart(6, '0')}`;

      await supabase.from('pagos_venta').insert({
        orden_venta_id: selectedOrden.id,
        numero_recibo: numero,
        monto: pagoForm.monto,
        metodo_pago: pagoForm.metodoPago,
        referencia: pagoForm.referencia || null,
        notas: pagoForm.notas || null,
        recibido_por: userEmail,
      });

      // Actualizar orden (el trigger debería hacer esto, pero por si acaso)
      const nuevoMontoPagado = selectedOrden.montoPagado + pagoForm.monto;
      const nuevoSaldo = selectedOrden.total - nuevoMontoPagado;
      const nuevoEstadoPago = nuevoSaldo <= 0 ? 'pagado' : 'parcial';

      await supabase.from('ordenes_venta').update({
        monto_pagado: nuevoMontoPagado,
        saldo_pendiente: nuevoSaldo,
        estado_pago: nuevoEstadoPago,
        pagado: nuevoSaldo <= 0,
      }).eq('id', selectedOrden.id);

      toast.success('Pago registrado', `${numero} - ${formatCurrency(pagoForm.monto)}`);
      setModalType(null);
      setPagoForm({ monto: 0, metodoPago: 'efectivo', referencia: '', notas: '' });
      setSelectedOrden(null);
      loadData();
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
    if (!cotizacionForm.clienteId || cotizacionForm.items.length === 0) {
      toast.warning('Datos incompletos');
      return;
    }

    try {
      setProcesando('creating-cot');

      const { count } = await supabase.from('cotizaciones').select('*', { count: 'exact', head: true });
      const numero = `COT-${String((count || 0) + 1).padStart(6, '0')}`;
      
      const subtotal = cotizacionForm.items.reduce((sum, i) => sum + ((i.cantidad * i.precioUnitario) - (i.descuento || 0)), 0);

      const { data: cotData, error } = await supabase
        .from('cotizaciones')
        .insert({
          numero,
          cliente_id: cotizacionForm.clienteId,
          estado: 'borrador',
          fecha_validez: cotizacionForm.fechaValidez || null,
          subtotal,
          total: subtotal,
          notas: cotizacionForm.notas || null,
          creado_por: userEmail,
        })
        .select()
        .single();

      if (error) throw error;

      const itemsToInsert = cotizacionForm.items.map(item => ({
        cotizacion_id: cotData.id,
        producto_codigo: item.productoCodigo,
        cantidad: item.cantidad,
        precio_unitario: item.precioUnitario,
        descuento_item: item.descuento || 0,
        subtotal: (item.cantidad * item.precioUnitario) - (item.descuento || 0),
      }));

      await supabase.from('cotizaciones_items').insert(itemsToInsert);

      toast.success('Cotización creada', `${numero}`);
      setModalType(null);
      setCotizacionForm({ clienteId: '', fechaValidez: '', notas: '', items: [] });
      loadData();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  const cambiarEstadoCotizacion = async (cot: Cotizacion, nuevoEstado: Cotizacion['estado']) => {
    try {
      setProcesando(cot.id);
      await supabase.from('cotizaciones').update({ estado: nuevoEstado }).eq('id', cot.id);
      toast.success('Estado actualizado', `${cot.numero} → ${nuevoEstado}`);
      loadData();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  const convertirCotizacion = (cot: Cotizacion) => {
    setSelectedCotizacion(cot);
    crearOrdenVenta(cot);
  };

  // ============================================
  // ACCIONES - CLIENTE
  // ============================================

  const guardarCliente = async () => {
    if (!clienteForm.codigo || !clienteForm.nombre) {
      toast.warning('Código y nombre requeridos');
      return;
    }

    try {
      setProcesando('cliente');
      const data = {
        codigo: clienteForm.codigo.toUpperCase(),
        tipo: clienteForm.tipo,
        nombre: clienteForm.nombre,
        rut: clienteForm.rut || null,
        email: clienteForm.email || null,
        telefono: clienteForm.telefono || null,
        direccion: clienteForm.direccion || null,
        limite_credito: clienteForm.limiteCredito,
      };

      if (editingCliente) {
        await supabase.from('clientes').update(data).eq('id', editingCliente.id);
        toast.success('Cliente actualizado');
      } else {
        await supabase.from('clientes').insert(data);
        toast.success('Cliente creado');
      }

      setModalType(null);
      setEditingCliente(null);
      setClienteForm({ codigo: '', tipo: 'persona', nombre: '', rut: '', email: '', telefono: '', direccion: '', limiteCredito: 0 });
      loadData();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // HELPERS UI
  // ============================================

  const toggleRow = (id: string) => {
    const newSet = new Set(expandedRows);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setExpandedRows(newSet);
  };

  const addOrdenItem = () => {
    setOrdenForm({ ...ordenForm, items: [...ordenForm.items, { productoCodigo: '', cantidad: 1, precioUnitario: 0, descuento: 0 }] });
  };

  const updateOrdenItem = (idx: number, field: string, value: any) => {
    const items = [...ordenForm.items];
    items[idx] = { ...items[idx], [field]: value };
    if (field === 'productoCodigo') {
      const prod = products.find(p => p.codigo === value);
      if (prod) items[idx].precioUnitario = prod.precio;
    }
    setOrdenForm({ ...ordenForm, items });
  };

  const removeOrdenItem = (idx: number) => {
    setOrdenForm({ ...ordenForm, items: ordenForm.items.filter((_, i) => i !== idx) });
  };

  const addCotItem = () => {
    setCotizacionForm({ ...cotizacionForm, items: [...cotizacionForm.items, { productoCodigo: '', cantidad: 1, precioUnitario: 0, descuento: 0 }] });
  };

  const updateCotItem = (idx: number, field: string, value: any) => {
    const items = [...cotizacionForm.items];
    items[idx] = { ...items[idx], [field]: value };
    if (field === 'productoCodigo') {
      const prod = products.find(p => p.codigo === value);
      if (prod) items[idx].precioUnitario = prod.precio;
    }
    setCotizacionForm({ ...cotizacionForm, items });
  };

  const removeCotItem = (idx: number) => {
    setCotizacionForm({ ...cotizacionForm, items: cotizacionForm.items.filter((_, i) => i !== idx) });
  };

  // ============================================
  // FIN PARTE 1 - CONTINÚA EN PARTE 2 (RENDER)
  // ============================================
  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-8 w-8 animate-spin text-violet-400" />
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
            <ShoppingCart className="h-7 w-7 text-violet-400" />
            Ventas
          </h2>
          <p className="text-slate-400 text-sm mt-1">Órdenes, cotizaciones y clientes</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setEditingCliente(null); setClienteForm({ codigo: '', tipo: 'persona', nombre: '', rut: '', email: '', telefono: '', direccion: '', limiteCredito: 0 }); setModalType('cliente'); }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl"
          >
            <Users className="h-4 w-4" />
            Clientes
          </button>
          <button
            onClick={() => setModalType('crear-cotizacion')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl"
          >
            <FileText className="h-4 w-4" />
            Nueva Cotización
          </button>
          <button
            onClick={() => setModalType('crear-orden')}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl"
          >
            <Plus className="h-4 w-4" />
            Nueva Venta
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart className="h-4 w-4 text-violet-400" />
            <span className="text-xs text-slate-500">Órdenes Activas</span>
          </div>
          <div className="text-2xl font-bold text-violet-400">{stats.ordenesActivas}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-4 w-4 text-amber-400" />
            <span className="text-xs text-slate-500">Por Cobrar</span>
          </div>
          <div className="text-2xl font-bold text-amber-400">{formatCurrency(stats.totalPorCobrar)}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-cyan-400" />
            <span className="text-xs text-slate-500">Cotizaciones</span>
          </div>
          <div className="text-2xl font-bold text-cyan-400">{stats.cotizacionesActivas}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-emerald-400" />
            <span className="text-xs text-slate-500">Pipeline</span>
          </div>
          <div className="text-2xl font-bold text-emerald-400">{formatCurrency(stats.valorCotizaciones)}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-900/50 rounded-xl w-fit">
        <button
          onClick={() => { setTabActiva('ordenes'); setFilterEstado('todos'); }}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
            tabActiva === 'ordenes' ? 'bg-slate-800 text-violet-400' : 'text-slate-400 hover:text-slate-200'
          )}
        >
          <ShoppingCart className="h-4 w-4" />
          Órdenes ({ordenes.length})
        </button>
        <button
          onClick={() => { setTabActiva('cotizaciones'); setFilterEstado('todos'); }}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
            tabActiva === 'cotizaciones' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-slate-200'
          )}
        >
          <FileText className="h-4 w-4" />
          Cotizaciones ({cotizaciones.length})
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-100 placeholder-slate-500"
            />
          </div>
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-100"
          >
            <option value="todos">Todos</option>
            {tabActiva === 'ordenes' ? (
              <>
                <option value="borrador">Borrador</option>
                <option value="confirmada">Confirmada</option>
                <option value="en_proceso">En Proceso</option>
                <option value="enviada">Enviada</option>
                <option value="entregada">Entregada</option>
              </>
            ) : (
              <>
                <option value="borrador">Borrador</option>
                <option value="enviada">Enviada</option>
                <option value="aceptada">Aceptada</option>
                <option value="convertida">Convertida</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* TABLA ÓRDENES */}
      {tabActiva === 'ordenes' && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase w-8"></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Orden</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Pago</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {ordenesFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                      <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      No hay órdenes
                    </td>
                  </tr>
                ) : (
                  ordenesFiltradas.map((orden) => {
                    const estadoConfig = getEstadoOrdenConfig(orden.estado);
                    const pagoConfig = getEstadoPagoConfig(orden.estadoPago);
                    const isExpanded = expandedRows.has(orden.id);

                    return (
                      <React.Fragment key={orden.id}>
                        <tr className="hover:bg-slate-800/30">
                          <td className="px-4 py-4">
                            <button onClick={() => toggleRow(orden.id)} className="p-1 hover:bg-slate-700 rounded">
                              {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                            </button>
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-mono text-sm text-slate-200">{orden.numero}</div>
                            <div className="text-xs text-slate-500">{new Date(orden.fechaOrden).toLocaleDateString('es-UY')}</div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-slate-200">{orden.cliente?.nombre || '-'}</div>
                          </td>
                          <td className="px-4 py-4">
                            <span className={cn('px-2 py-1 rounded text-xs', estadoConfig.bg, estadoConfig.color)}>
                              {estadoConfig.label}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span className={cn('px-2 py-1 rounded text-xs', pagoConfig.bg, pagoConfig.color)}>
                              {pagoConfig.label}
                            </span>
                            {orden.estadoPago === 'parcial' && (
                              <div className="text-xs text-slate-500 mt-1">
                                {formatCurrency(orden.montoPagado)} / {formatCurrency(orden.total)}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-violet-400 font-medium">{formatCurrency(orden.total)}</div>
                            {orden.saldoPendiente > 0 && orden.estadoPago !== 'pagado' && (
                              <div className="text-xs text-amber-400">Debe: {formatCurrency(orden.saldoPendiente)}</div>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1">
                              {orden.estado === 'borrador' && (
                                <>
                                  <button onClick={() => cambiarEstadoOrden(orden, 'confirmada')} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Confirmar">
                                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                                  </button>
                                  <button onClick={() => cambiarEstadoOrden(orden, 'cancelada')} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Cancelar">
                                    <XCircle className="h-4 w-4 text-red-400" />
                                  </button>
                                </>
                              )}
                              {orden.estado === 'confirmada' && (
                                <button onClick={() => cambiarEstadoOrden(orden, 'en_proceso')} className="p-1.5 hover:bg-slate-700 rounded-lg" title="En proceso">
                                  <Package className="h-4 w-4 text-amber-400" />
                                </button>
                              )}
                              {orden.estado === 'en_proceso' && (
                                <button onClick={() => cambiarEstadoOrden(orden, 'enviada')} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Enviar">
                                  <Send className="h-4 w-4 text-purple-400" />
                                </button>
                              )}
                              {orden.estado === 'enviada' && (
                                <button onClick={() => cambiarEstadoOrden(orden, 'entregada')} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Entregar">
                                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                                </button>
                              )}
                              {orden.estadoPago !== 'pagado' && orden.estado !== 'cancelada' && (
                                <button onClick={() => { setSelectedOrden(orden); setPagoForm({ monto: orden.saldoPendiente, metodoPago: 'efectivo', referencia: '', notas: '' }); setModalType('pago'); }} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Pago">
                                  <CreditCard className="h-4 w-4 text-cyan-400" />
                                </button>
                              )}
                              <button onClick={() => { setSelectedOrden(orden); setModalType('ver-orden'); }} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Ver">
                                <Eye className="h-4 w-4 text-blue-400" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={7} className="px-4 py-4 bg-slate-800/20">
                              <div className="pl-8 space-y-2">
                                {orden.items.map(item => {
                                  const prod = products.find(p => p.codigo === item.productoCodigo);
                                  return (
                                    <div key={item.id} className="flex justify-between p-2 bg-slate-800/30 rounded-lg">
                                      <span className="text-sm text-slate-200">{prod?.descripcion || item.productoCodigo}</span>
                                      <div className="flex gap-4 text-sm">
                                        <span className="text-slate-400">{item.cantidad} x {formatCurrency(item.precioUnitario)}</span>
                                        <span className="text-violet-400">{formatCurrency(item.subtotal)}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TABLA COTIZACIONES */}
      {tabActiva === 'cotizaciones' && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Cotización</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Validez</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {cotizacionesFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                      <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      No hay cotizaciones
                    </td>
                  </tr>
                ) : (
                  cotizacionesFiltradas.map((cot) => {
                    const estadoConfig = getEstadoCotizacionConfig(cot.estado);
                    const vencida = cot.fechaValidez && new Date(cot.fechaValidez) < new Date() && cot.estado === 'enviada';

                    return (
                      <tr key={cot.id} className={cn('hover:bg-slate-800/30', vencida && 'bg-red-500/5')}>
                        <td className="px-4 py-4">
                          <div className="font-mono text-sm text-slate-200">{cot.numero}</div>
                          <div className="text-xs text-slate-500">{new Date(cot.fechaCotizacion).toLocaleDateString('es-UY')}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-slate-200">{cot.cliente?.nombre || '-'}</div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={cn('px-2 py-1 rounded text-xs', estadoConfig.bg, estadoConfig.color)}>
                            {estadoConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {cot.fechaValidez ? (
                            <div className={cn('flex items-center gap-1', vencida && 'text-red-400')}>
                              {vencida && <AlertTriangle className="h-4 w-4" />}
                              <span>{new Date(cot.fechaValidez).toLocaleDateString('es-UY')}</span>
                            </div>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-cyan-400 font-medium">{formatCurrency(cot.total)}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1">
                            {cot.estado === 'borrador' && (
                              <button onClick={() => cambiarEstadoCotizacion(cot, 'enviada')} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Enviar">
                                <Send className="h-4 w-4 text-cyan-400" />
                              </button>
                            )}
                            {cot.estado === 'enviada' && (
                              <>
                                <button onClick={() => cambiarEstadoCotizacion(cot, 'aceptada')} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Aceptar">
                                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                                </button>
                                <button onClick={() => cambiarEstadoCotizacion(cot, 'rechazada')} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Rechazar">
                                  <XCircle className="h-4 w-4 text-red-400" />
                                </button>
                              </>
                            )}
                            {(cot.estado === 'aceptada' || cot.estado === 'enviada') && (
                              <button onClick={() => convertirCotizacion(cot)} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Convertir a orden">
                                <ArrowRight className="h-4 w-4 text-purple-400" />
                              </button>
                            )}
                            <button onClick={() => { setSelectedCotizacion(cot); setModalType('ver-cotizacion'); }} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Ver">
                              <Eye className="h-4 w-4 text-blue-400" />
                            </button>
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
      )}

      {/* MODAL: CREAR ORDEN */}
      {modalType === 'crear-orden' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100">Nueva Orden de Venta</h3>
              <button onClick={() => setModalType(null)} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Cliente *</label>
                <select
                  value={ordenForm.clienteId}
                  onChange={(e) => setOrdenForm({ ...ordenForm, clienteId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                >
                  <option value="">Seleccionar...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Fecha entrega</label>
                  <input
                    type="date"
                    value={ordenForm.fechaEntrega}
                    onChange={(e) => setOrdenForm({ ...ordenForm, fechaEntrega: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Dirección envío</label>
                  <input
                    type="text"
                    value={ordenForm.direccionEnvio}
                    onChange={(e) => setOrdenForm({ ...ordenForm, direccionEnvio: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-slate-400">Productos *</label>
                  <button onClick={addOrdenItem} className="text-sm text-violet-400">+ Agregar</button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {ordenForm.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-xl">
                      <select
                        value={item.productoCodigo}
                        onChange={(e) => updateOrdenItem(idx, 'productoCodigo', e.target.value)}
                        className="flex-1 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm"
                      >
                        <option value="">Producto...</option>
                        {products.map(p => <option key={p.codigo} value={p.codigo}>{p.codigo} - {p.descripcion} (Stock: {p.stock})</option>)}
                      </select>
                      <input type="number" value={item.cantidad} onChange={(e) => updateOrdenItem(idx, 'cantidad', parseInt(e.target.value) || 0)} className="w-16 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm" min="1" />
                      <input type="number" value={item.precioUnitario} onChange={(e) => updateOrdenItem(idx, 'precioUnitario', parseFloat(e.target.value) || 0)} className="w-24 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm" step="0.01" />
                      <button onClick={() => removeOrdenItem(idx)} className="p-1 text-red-400"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                  {ordenForm.items.length === 0 && <div className="text-center py-4 text-slate-500 text-sm">Agregue productos</div>}
                </div>
                {ordenForm.items.length > 0 && (
                  <div className="mt-2 p-2 bg-violet-500/10 border border-violet-500/20 rounded-xl flex justify-between">
                    <span className="text-sm text-slate-400">Total:</span>
                    <span className="font-bold text-violet-400">{formatCurrency(ordenForm.items.reduce((s, i) => s + (i.cantidad * i.precioUnitario - (i.descuento || 0)), 0))}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Notas</label>
                <textarea value={ordenForm.notas} onChange={(e) => setOrdenForm({ ...ordenForm, notas: e.target.value })} rows={2} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 resize-none" />
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
              <button onClick={() => crearOrdenVenta()} disabled={!ordenForm.clienteId || ordenForm.items.length === 0 || procesando === 'creating'} className="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2">
                {procesando === 'creating' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Crear Orden
              </button>
              <button onClick={() => setModalType(null)} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREAR COTIZACIÓN */}
      {modalType === 'crear-cotizacion' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100">Nueva Cotización</h3>
              <button onClick={() => setModalType(null)} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Cliente *</label>
                  <select value={cotizacionForm.clienteId} onChange={(e) => setCotizacionForm({ ...cotizacionForm, clienteId: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                    <option value="">Seleccionar...</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Válida hasta</label>
                  <input type="date" value={cotizacionForm.fechaValidez} onChange={(e) => setCotizacionForm({ ...cotizacionForm, fechaValidez: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-slate-400">Productos *</label>
                  <button onClick={addCotItem} className="text-sm text-cyan-400">+ Agregar</button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {cotizacionForm.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-xl">
                      <select value={item.productoCodigo} onChange={(e) => updateCotItem(idx, 'productoCodigo', e.target.value)} className="flex-1 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm">
                        <option value="">Producto...</option>
                        {products.map(p => <option key={p.codigo} value={p.codigo}>{p.codigo} - {p.descripcion}</option>)}
                      </select>
                      <input type="number" value={item.cantidad} onChange={(e) => updateCotItem(idx, 'cantidad', parseInt(e.target.value) || 0)} className="w-16 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm" min="1" />
                      <input type="number" value={item.precioUnitario} onChange={(e) => updateCotItem(idx, 'precioUnitario', parseFloat(e.target.value) || 0)} className="w-24 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm" step="0.01" />
                      <button onClick={() => removeCotItem(idx)} className="p-1 text-red-400"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                  {cotizacionForm.items.length === 0 && <div className="text-center py-4 text-slate-500 text-sm">Agregue productos</div>}
                </div>
                {cotizacionForm.items.length > 0 && (
                  <div className="mt-2 p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl flex justify-between">
                    <span className="text-sm text-slate-400">Total:</span>
                    <span className="font-bold text-cyan-400">{formatCurrency(cotizacionForm.items.reduce((s, i) => s + (i.cantidad * i.precioUnitario - (i.descuento || 0)), 0))}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Notas</label>
                <textarea value={cotizacionForm.notas} onChange={(e) => setCotizacionForm({ ...cotizacionForm, notas: e.target.value })} rows={2} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 resize-none" />
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
              <button onClick={crearCotizacion} disabled={!cotizacionForm.clienteId || cotizacionForm.items.length === 0 || procesando === 'creating-cot'} className="flex-1 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2">
                {procesando === 'creating-cot' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Crear Cotización
              </button>
              <button onClick={() => setModalType(null)} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PAGO */}
      {modalType === 'pago' && selectedOrden && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-cyan-400" />
                Registrar Pago
              </h3>
              <button onClick={() => setModalType(null)} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="p-3 bg-slate-800/50 rounded-xl mb-4">
              <div className="text-sm text-slate-400">Orden</div>
              <div className="font-mono text-lg text-slate-200">{selectedOrden.numero}</div>
              <div className="text-sm text-slate-500">{selectedOrden.cliente?.nombre}</div>
              <div className="mt-2 flex justify-between">
                <span className="text-sm text-slate-400">Saldo pendiente:</span>
                <span className="font-bold text-amber-400">{formatCurrency(selectedOrden.saldoPendiente)}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Monto *</label>
                <input type="number" value={pagoForm.monto} onChange={(e) => setPagoForm({ ...pagoForm, monto: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-lg" step="0.01" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Método de pago</label>
                <select value={pagoForm.metodoPago} onChange={(e) => setPagoForm({ ...pagoForm, metodoPago: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Referencia</label>
                <input type="text" value={pagoForm.referencia} onChange={(e) => setPagoForm({ ...pagoForm, referencia: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" placeholder="Nro. transferencia, cheque..." />
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
              <button onClick={registrarPago} disabled={pagoForm.monto <= 0 || procesando === selectedOrden.id} className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2">
                {procesando === selectedOrden.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Registrar Pago
              </button>
              <button onClick={() => setModalType(null)} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CLIENTE */}
      {modalType === 'cliente' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100">{editingCliente ? 'Editar' : 'Nuevo'} Cliente</h3>
              <button onClick={() => setModalType(null)} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Código *</label>
                  <input type="text" value={clienteForm.codigo} onChange={(e) => setClienteForm({ ...clienteForm, codigo: e.target.value.toUpperCase() })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" disabled={!!editingCliente} />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Tipo</label>
                  <select value={clienteForm.tipo} onChange={(e) => setClienteForm({ ...clienteForm, tipo: e.target.value as any })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                    <option value="persona">Persona</option>
                    <option value="empresa">Empresa</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Nombre *</label>
                <input type="text" value={clienteForm.nombre} onChange={(e) => setClienteForm({ ...clienteForm, nombre: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">RUT</label>
                  <input type="text" value={clienteForm.rut} onChange={(e) => setClienteForm({ ...clienteForm, rut: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Teléfono</label>
                  <input type="text" value={clienteForm.telefono} onChange={(e) => setClienteForm({ ...clienteForm, telefono: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Email</label>
                <input type="email" value={clienteForm.email} onChange={(e) => setClienteForm({ ...clienteForm, email: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
              <button onClick={guardarCliente} disabled={!clienteForm.codigo || !clienteForm.nombre || procesando === 'cliente'} className="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl">
                {editingCliente ? 'Guardar' : 'Crear'}
              </button>
              <button onClick={() => setModalType(null)} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Cancelar</button>
            </div>

            {/* Lista clientes */}
            <div className="mt-6 pt-4 border-t border-slate-700">
              <h4 className="text-sm font-semibold text-slate-400 mb-3">Clientes ({clientes.length})</h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {clientes.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-2 bg-slate-800/30 rounded-lg">
                    <div>
                      <span className="text-sm text-slate-200">{c.codigo} - {c.nombre}</span>
                      <span className={cn('ml-2 text-xs', c.tipo === 'empresa' ? 'text-cyan-400' : 'text-slate-500')}>{c.tipo}</span>
                    </div>
                    <button onClick={() => { setEditingCliente(c); setClienteForm({ codigo: c.codigo, tipo: c.tipo, nombre: c.nombre, rut: c.rut || '', email: c.email || '', telefono: c.telefono || '', direccion: c.direccion || '', limiteCredito: c.limiteCredito }); }} className="p-1 hover:bg-slate-700 rounded">
                      <Edit className="h-4 w-4 text-slate-400" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VER ORDEN */}
      {modalType === 'ver-orden' && selectedOrden && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-100">Detalle de Orden</h3>
                <p className="text-sm text-slate-400 font-mono">{selectedOrden.numero}</p>
              </div>
              <button onClick={() => setModalType(null)} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-800/50 rounded-xl p-3">
                <div className="text-xs text-slate-500">Cliente</div>
                <div className="text-slate-200">{selectedOrden.cliente?.nombre}</div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-3">
                <div className="text-xs text-slate-500">Estado</div>
                <span className={cn('text-sm', getEstadoOrdenConfig(selectedOrden.estado).color)}>{getEstadoOrdenConfig(selectedOrden.estado).label}</span>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-3">
                <div className="text-xs text-slate-500">Pago</div>
                <span className={cn('text-sm', getEstadoPagoConfig(selectedOrden.estadoPago).color)}>{getEstadoPagoConfig(selectedOrden.estadoPago).label}</span>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-3">
                <div className="text-xs text-slate-500">Total</div>
                <div className="text-violet-400 font-semibold">{formatCurrency(selectedOrden.total)}</div>
              </div>
            </div>

            {selectedOrden.estadoPago !== 'pagado' && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-6">
                <div className="flex justify-between">
                  <span className="text-amber-400">Saldo pendiente:</span>
                  <span className="font-bold text-amber-400">{formatCurrency(selectedOrden.saldoPendiente)}</span>
                </div>
              </div>
            )}

            <h4 className="font-semibold text-slate-300 mb-3">Items</h4>
            <div className="space-y-2 mb-6">
              {selectedOrden.items.map(item => {
                const prod = products.find(p => p.codigo === item.productoCodigo);
                return (
                  <div key={item.id} className="flex justify-between p-3 bg-slate-800/30 rounded-lg">
                    <span className="text-sm text-slate-200">{prod?.descripcion || item.productoCodigo}</span>
                    <div className="flex gap-4 text-sm">
                      <span className="text-slate-400">{item.cantidad} x {formatCurrency(item.precioUnitario)}</span>
                      <span className="text-violet-400">{formatCurrency(item.subtotal)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-700">
              <button onClick={() => setModalType(null)} className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VER COTIZACIÓN */}
      {modalType === 'ver-cotizacion' && selectedCotizacion && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-100">Detalle de Cotización</h3>
                <p className="text-sm text-slate-400 font-mono">{selectedCotizacion.numero}</p>
              </div>
              <button onClick={() => setModalType(null)} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-800/50 rounded-xl p-3">
                <div className="text-xs text-slate-500">Cliente</div>
                <div className="text-slate-200">{selectedCotizacion.cliente?.nombre}</div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-3">
                <div className="text-xs text-slate-500">Estado</div>
                <span className={cn('text-sm', getEstadoCotizacionConfig(selectedCotizacion.estado).color)}>{getEstadoCotizacionConfig(selectedCotizacion.estado).label}</span>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-3">
                <div className="text-xs text-slate-500">Válida hasta</div>
                <div className="text-slate-200">{selectedCotizacion.fechaValidez ? new Date(selectedCotizacion.fechaValidez).toLocaleDateString('es-UY') : '-'}</div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-3">
                <div className="text-xs text-slate-500">Total</div>
                <div className="text-cyan-400 font-semibold">{formatCurrency(selectedCotizacion.total)}</div>
              </div>
            </div>

            <h4 className="font-semibold text-slate-300 mb-3">Items</h4>
            <div className="space-y-2 mb-6">
              {selectedCotizacion.items.map(item => {
                const prod = products.find(p => p.codigo === item.productoCodigo);
                return (
                  <div key={item.id} className="flex justify-between p-3 bg-slate-800/30 rounded-lg">
                    <span className="text-sm text-slate-200">{prod?.descripcion || item.productoCodigo}</span>
                    <div className="flex gap-4 text-sm">
                      <span className="text-slate-400">{item.cantidad} x {formatCurrency(item.precioUnitario)}</span>
                      <span className="text-cyan-400">{formatCurrency(item.subtotal)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-700">
              {(selectedCotizacion.estado === 'aceptada' || selectedCotizacion.estado === 'enviada') && (
                <button onClick={() => { convertirCotizacion(selectedCotizacion); setModalType(null); }} className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl flex items-center justify-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Convertir a Orden
                </button>
              )}
              <button onClick={() => setModalType(null)} className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}