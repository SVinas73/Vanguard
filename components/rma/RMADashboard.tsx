'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Package, Plus, RefreshCw, CheckCircle, XCircle, Clock,
  AlertTriangle, Truck, Eye, Search, X, Edit, Trash2,
  ClipboardCheck, DollarSign, RotateCcw, FileText, Send,
  Camera, MessageSquare, TrendingUp, BarChart3, Calendar,
  ChevronDown, ChevronRight, User, History, CreditCard,
  PackageCheck, AlertCircle, Box, ArrowRight
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { cn, formatCurrency } from '@/lib/utils';

// ============================================
// TIPOS
// ============================================

type EstadoRMA = 
  | 'solicitada' | 'aprobada' | 'rechazada' | 'en_transito' 
  | 'recibida' | 'inspeccionada' | 'procesada' | 'completada' | 'cancelada';

type TipoRMA = 'garantia' | 'defecto' | 'error_envio' | 'no_conforme' | 'cambio' | 'otro';

type ResolucionRMA = 'reembolso' | 'reemplazo' | 'credito' | 'reparacion' | 'rechazo';

type ResultadoInspeccion = 'aprobado' | 'rechazado' | 'parcial';

interface Cliente {
  id: string;
  codigo: string;
  nombre: string;
  email?: string;
  telefono?: string;
}

interface RMAItem {
  id: string;
  rmaId: string;
  productoCodigo: string;
  productoDescripcion?: string;
  cantidad: number;
  cantidadAprobada?: number;
  cantidadRechazada?: number;
  motivoItem?: string;
  serialNumber?: string;
  loteCodigo?: string;
  precioUnitario: number;
  subtotal: number;
  estadoInspeccion?: 'pendiente' | 'aprobado' | 'rechazado';
  notasInspeccion?: string;
}

interface RMAOperacion {
  id: string;
  rmaId: string;
  tipo: string;
  descripcion: string;
  datos?: any;
  ejecutadoPor: string;
  createdAt: string;
}

interface RMA {
  id: string;
  numero: string;
  clienteId: string;
  cliente?: Cliente;
  tipo: TipoRMA;
  estado: EstadoRMA;
  motivo: string;
  resolucionEsperada: ResolucionRMA;
  resolucionFinal?: ResolucionRMA;
  fechaSolicitud: string;
  fechaAprobacion?: string;
  fechaRecepcion?: string;
  fechaInspeccion?: string;
  fechaResolucion?: string;
  aprobadoPor?: string;
  inspeccionadoPor?: string;
  valorProductos: number;
  valorReembolso?: number;
  notaCredito?: string;
  ordenReemplazo?: string;
  trackingDevolucion?: string;
  notas?: string;
  notasInternas?: string;
  items: RMAItem[];
  operaciones?: RMAOperacion[];
  creadoPor?: string;
}

interface Producto {
  codigo: string;
  descripcion: string;
  precio: number;
  stock: number;
}

type ModalType = 'crear' | 'ver' | 'items' | 'inspeccion' | 'resolucion' | 'cliente' | null;
type VistaActiva = 'lista' | 'metricas';

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

const getEstadoConfig = (estado: EstadoRMA) => {
  const configs: Record<EstadoRMA, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
    solicitada: { color: 'text-yellow-400', bg: 'bg-yellow-500/20 border-yellow-500/30', icon: <Clock className="h-4 w-4" />, label: 'Solicitada' },
    aprobada: { color: 'text-blue-400', bg: 'bg-blue-500/20 border-blue-500/30', icon: <CheckCircle className="h-4 w-4" />, label: 'Aprobada' },
    rechazada: { color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30', icon: <XCircle className="h-4 w-4" />, label: 'Rechazada' },
    en_transito: { color: 'text-purple-400', bg: 'bg-purple-500/20 border-purple-500/30', icon: <Truck className="h-4 w-4" />, label: 'En Tránsito' },
    recibida: { color: 'text-cyan-400', bg: 'bg-cyan-500/20 border-cyan-500/30', icon: <Package className="h-4 w-4" />, label: 'Recibida' },
    inspeccionada: { color: 'text-indigo-400', bg: 'bg-indigo-500/20 border-indigo-500/30', icon: <ClipboardCheck className="h-4 w-4" />, label: 'Inspeccionada' },
    procesada: { color: 'text-teal-400', bg: 'bg-teal-500/20 border-teal-500/30', icon: <RefreshCw className="h-4 w-4" />, label: 'Procesada' },
    completada: { color: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/30', icon: <CheckCircle className="h-4 w-4" />, label: 'Completada' },
    cancelada: { color: 'text-slate-400', bg: 'bg-slate-500/20 border-slate-500/30', icon: <XCircle className="h-4 w-4" />, label: 'Cancelada' },
  };
  return configs[estado];
};

const getTipoConfig = (tipo: TipoRMA) => {
  const configs: Record<TipoRMA, { label: string; color: string }> = {
    garantia: { label: 'Garantía', color: 'text-blue-400' },
    defecto: { label: 'Defecto', color: 'text-red-400' },
    error_envio: { label: 'Error Envío', color: 'text-amber-400' },
    no_conforme: { label: 'No Conforme', color: 'text-purple-400' },
    cambio: { label: 'Cambio', color: 'text-cyan-400' },
    otro: { label: 'Otro', color: 'text-slate-400' },
  };
  return configs[tipo] || configs.otro;
};

const getResolucionConfig = (resolucion: ResolucionRMA) => {
  const configs: Record<ResolucionRMA, { label: string; color: string; icon: React.ReactNode }> = {
    reembolso: { label: 'Reembolso', color: 'text-emerald-400', icon: <DollarSign className="h-4 w-4" /> },
    reemplazo: { label: 'Reemplazo', color: 'text-blue-400', icon: <RotateCcw className="h-4 w-4" /> },
    credito: { label: 'Nota Crédito', color: 'text-purple-400', icon: <CreditCard className="h-4 w-4" /> },
    reparacion: { label: 'Reparación', color: 'text-amber-400', icon: <Package className="h-4 w-4" /> },
    rechazo: { label: 'Rechazo', color: 'text-red-400', icon: <XCircle className="h-4 w-4" /> },
  };
  return configs[resolucion] || configs.rechazo;
};

const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('es-UY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatDateTime = (date: string): string => {
  return new Date(date).toLocaleString('es-UY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Flujo de estados válidos
const TRANSICIONES_VALIDAS: Record<EstadoRMA, EstadoRMA[]> = {
  solicitada: ['aprobada', 'rechazada', 'cancelada'],
  aprobada: ['en_transito', 'cancelada'],
  rechazada: [],
  en_transito: ['recibida'],
  recibida: ['inspeccionada'],
  inspeccionada: ['procesada'],
  procesada: ['completada'],
  completada: [],
  cancelada: [],
};

// ============================================
// COMPONENTE PRINCIPAL - CONTINÚA EN PARTE 2
// ============================================
// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function RMAEnterprise() {
  const { user } = useAuth();
  const toast = useToast();

  // Estado principal
  const [rmas, setRmas] = useState<RMA[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);

  // Vista y filtros
  const [vistaActiva, setVistaActiva] = useState<VistaActiva>('lista');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState<EstadoRMA | 'todos'>('todos');
  const [filterTipo, setFilterTipo] = useState<TipoRMA | 'todos'>('todos');

  // UI
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [modalType, setModalType] = useState<ModalType>(null);
  const [selectedRMA, setSelectedRMA] = useState<RMA | null>(null);

  // Form crear RMA
  const [rmaForm, setRmaForm] = useState({
    clienteId: '',
    tipo: 'defecto' as TipoRMA,
    motivo: '',
    resolucionEsperada: 'reembolso' as ResolucionRMA,
    trackingDevolucion: '',
    notas: '',
    items: [] as Array<{
      productoCodigo: string;
      cantidad: number;
      motivoItem: string;
      serialNumber: string;
      loteCodigo: string;
      precioUnitario: number;
    }>,
  });

  // Form inspección
  const [inspeccionForm, setInspeccionForm] = useState({
    items: [] as Array<{
      itemId: string;
      cantidadAprobada: number;
      cantidadRechazada: number;
      estadoInspeccion: 'aprobado' | 'rechazado';
      notas: string;
    }>,
    notasGenerales: '',
  });

  // Form resolución
  const [resolucionForm, setResolucionForm] = useState({
    resolucionFinal: 'reembolso' as ResolucionRMA,
    valorReembolso: 0,
    notaCredito: '',
    ordenReemplazo: '',
    notasInternas: '',
    reingresoStock: false,
  });

  // ============================================
  // CARGA DE DATOS
  // ============================================

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [rmasRes, clientesRes, productosRes] = await Promise.all([
        supabase
          .from('rma')
          .select(`
            *,
            cliente:clientes(id, codigo, nombre, email, telefono),
            items:rma_items(*)
          `)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('clientes')
          .select('id, codigo, nombre, email, telefono')
          .eq('activo', true)
          .order('nombre'),
        supabase
          .from('productos')
          .select('codigo, descripcion, precio, stock')
          .order('descripcion')
          .limit(500),
      ]);

      if (rmasRes.data) {
        setRmas(rmasRes.data.map((r: any) => ({
          id: r.id,
          numero: r.numero,
          clienteId: r.cliente_id,
          cliente: r.cliente,
          tipo: r.tipo,
          estado: r.estado,
          motivo: r.motivo,
          resolucionEsperada: r.resolucion_esperada,
          resolucionFinal: r.resolucion_final,
          fechaSolicitud: r.fecha_solicitud,
          fechaAprobacion: r.fecha_aprobacion,
          fechaRecepcion: r.fecha_recepcion,
          fechaInspeccion: r.fecha_inspeccion,
          fechaResolucion: r.fecha_resolucion,
          aprobadoPor: r.aprobado_por,
          inspeccionadoPor: r.inspeccionado_por,
          valorProductos: parseFloat(r.valor_productos) || 0,
          valorReembolso: parseFloat(r.valor_reembolso) || 0,
          notaCredito: r.nota_credito,
          ordenReemplazo: r.orden_reemplazo,
          trackingDevolucion: r.tracking_devolucion,
          notas: r.notas,
          notasInternas: r.notas_internas,
          creadoPor: r.creado_por,
          items: (r.items || []).map((i: any) => ({
            id: i.id,
            rmaId: i.rma_id,
            productoCodigo: i.producto_codigo,
            productoDescripcion: i.producto_descripcion,
            cantidad: i.cantidad,
            cantidadAprobada: i.cantidad_aprobada,
            cantidadRechazada: i.cantidad_rechazada,
            motivoItem: i.motivo_item,
            serialNumber: i.serial_number,
            loteCodigo: i.lote_codigo,
            precioUnitario: parseFloat(i.precio_unitario) || 0,
            subtotal: parseFloat(i.subtotal) || 0,
            estadoInspeccion: i.estado_inspeccion,
            notasInspeccion: i.notas_inspeccion,
          })),
        })));
      }

      if (clientesRes.data) setClientes(clientesRes.data);
      if (productosRes.data) setProductos(productosRes.data);

    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos', error.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // REGISTRAR OPERACIÓN
  // ============================================

  const registrarOperacion = async (rmaId: string, tipo: string, descripcion: string, datos?: any) => {
    try {
      await supabase.from('rma_operaciones').insert({
        rma_id: rmaId,
        tipo,
        descripcion,
        datos: datos || null,
        ejecutado_por: user?.email || 'Sistema',
      });
    } catch (error) {
      console.error('Error registrando operación:', error);
    }
  };

  // ============================================
  // CREAR RMA
  // ============================================

  const crearRMA = async () => {
    if (!rmaForm.clienteId || !rmaForm.motivo || rmaForm.items.length === 0) {
      toast.warning('Datos incompletos', 'Complete cliente, motivo y agregue productos');
      return;
    }

    try {
      setProcesando('creating');

      // Generar número
      const { count } = await supabase.from('rma').select('*', { count: 'exact', head: true });
      const numero = `RMA-${String((count || 0) + 1).padStart(6, '0')}`;

      // Calcular valor total
      const valorTotal = rmaForm.items.reduce((sum, i) => sum + (i.cantidad * i.precioUnitario), 0);

      // Crear RMA
      const { data: rmaData, error: rmaError } = await supabase
        .from('rma')
        .insert({
          numero,
          cliente_id: rmaForm.clienteId,
          tipo: rmaForm.tipo,
          estado: 'solicitada',
          motivo: rmaForm.motivo,
          resolucion_esperada: rmaForm.resolucionEsperada,
          fecha_solicitud: new Date().toISOString(),
          valor_productos: valorTotal,
          tracking_devolucion: rmaForm.trackingDevolucion || null,
          notas: rmaForm.notas || null,
          creado_por: user?.email,
        })
        .select()
        .single();

      if (rmaError) throw rmaError;

      // Insertar items
      const itemsToInsert = rmaForm.items.map(item => {
        const producto = productos.find(p => p.codigo === item.productoCodigo);
        return {
          rma_id: rmaData.id,
          producto_codigo: item.productoCodigo,
          producto_descripcion: producto?.descripcion || item.productoCodigo,
          cantidad: item.cantidad,
          motivo_item: item.motivoItem || null,
          serial_number: item.serialNumber || null,
          lote_codigo: item.loteCodigo || null,
          precio_unitario: item.precioUnitario,
          subtotal: item.cantidad * item.precioUnitario,
          estado_inspeccion: 'pendiente',
        };
      });

      await supabase.from('rma_items').insert(itemsToInsert);

      // Registrar operación
      await registrarOperacion(rmaData.id, 'creacion', `RMA ${numero} creado con ${rmaForm.items.length} items`);

      toast.success('RMA creado', `Número: ${numero}`);
      setModalType(null);
      resetRmaForm();
      loadData();
    } catch (error: any) {
      toast.error('Error al crear RMA', error.message);
    } finally {
      setProcesando(null);
    }
  };

  const resetRmaForm = () => {
    setRmaForm({
      clienteId: '',
      tipo: 'defecto',
      motivo: '',
      resolucionEsperada: 'reembolso',
      trackingDevolucion: '',
      notas: '',
      items: [],
    });
  };

  // ============================================
  // CAMBIAR ESTADO
  // ============================================

  const cambiarEstado = async (rma: RMA, nuevoEstado: EstadoRMA) => {
    // Validar transición
    if (!TRANSICIONES_VALIDAS[rma.estado].includes(nuevoEstado)) {
      toast.error('Transición inválida', `No se puede pasar de ${rma.estado} a ${nuevoEstado}`);
      return;
    }

    try {
      setProcesando(rma.id);

      const updateData: any = {
        estado: nuevoEstado,
        actualizado_por: user?.email,
      };

      // Campos según estado
      if (nuevoEstado === 'aprobada') {
        updateData.fecha_aprobacion = new Date().toISOString();
        updateData.aprobado_por = user?.email;
      } else if (nuevoEstado === 'recibida') {
        updateData.fecha_recepcion = new Date().toISOString();
      } else if (nuevoEstado === 'inspeccionada') {
        updateData.fecha_inspeccion = new Date().toISOString();
        updateData.inspeccionado_por = user?.email;
      } else if (nuevoEstado === 'completada') {
        updateData.fecha_resolucion = new Date().toISOString();
      }

      await supabase.from('rma').update(updateData).eq('id', rma.id);

      await registrarOperacion(rma.id, 'cambio_estado', `Estado cambiado de ${rma.estado} a ${nuevoEstado}`);

      toast.success('Estado actualizado', `${rma.numero} → ${nuevoEstado}`);
      loadData();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // INSPECCIÓN
  // ============================================

  const abrirInspeccion = (rma: RMA) => {
    setSelectedRMA(rma);
    setInspeccionForm({
      items: rma.items.map(item => ({
        itemId: item.id,
        cantidadAprobada: item.cantidad,
        cantidadRechazada: 0,
        estadoInspeccion: 'aprobado',
        notas: '',
      })),
      notasGenerales: '',
    });
    setModalType('inspeccion');
  };

  const guardarInspeccion = async () => {
    if (!selectedRMA) return;

    try {
      setProcesando(selectedRMA.id);

      // Actualizar cada item
      for (const item of inspeccionForm.items) {
        await supabase.from('rma_items').update({
          cantidad_aprobada: item.cantidadAprobada,
          cantidad_rechazada: item.cantidadRechazada,
          estado_inspeccion: item.estadoInspeccion,
          notas_inspeccion: item.notas || null,
        }).eq('id', item.itemId);
      }

      // Actualizar RMA
      await supabase.from('rma').update({
        estado: 'inspeccionada',
        fecha_inspeccion: new Date().toISOString(),
        inspeccionado_por: user?.email,
        notas_internas: inspeccionForm.notasGenerales || null,
      }).eq('id', selectedRMA.id);

      await registrarOperacion(selectedRMA.id, 'inspeccion', 'Inspección completada');

      toast.success('Inspección guardada');
      setModalType(null);
      loadData();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // RESOLUCIÓN
  // ============================================

  const abrirResolucion = (rma: RMA) => {
    setSelectedRMA(rma);
    setResolucionForm({
      resolucionFinal: rma.resolucionEsperada,
      valorReembolso: rma.valorProductos,
      notaCredito: '',
      ordenReemplazo: '',
      notasInternas: '',
      reingresoStock: false,
    });
    setModalType('resolucion');
  };

  const procesarResolucion = async () => {
    if (!selectedRMA) return;

    try {
      setProcesando(selectedRMA.id);

      // Actualizar RMA
      await supabase.from('rma').update({
        estado: 'procesada',
        resolucion_final: resolucionForm.resolucionFinal,
        valor_reembolso: resolucionForm.resolucionFinal === 'reembolso' ? resolucionForm.valorReembolso : null,
        nota_credito: resolucionForm.resolucionFinal === 'credito' ? resolucionForm.notaCredito : null,
        orden_reemplazo: resolucionForm.resolucionFinal === 'reemplazo' ? resolucionForm.ordenReemplazo : null,
        notas_internas: resolucionForm.notasInternas || null,
      }).eq('id', selectedRMA.id);

      // Si es reingreso a stock
      if (resolucionForm.reingresoStock && resolucionForm.resolucionFinal !== 'rechazo') {
        for (const item of selectedRMA.items) {
          if (item.estadoInspeccion === 'aprobado' || item.cantidadAprobada) {
            const cantidadReingreso = item.cantidadAprobada || item.cantidad;
            
            // Actualizar stock
            const { data: prod } = await supabase
              .from('productos')
              .select('stock')
              .eq('codigo', item.productoCodigo)
              .single();

            if (prod) {
              await supabase.from('productos')
                .update({ stock: prod.stock + cantidadReingreso })
                .eq('codigo', item.productoCodigo);

              // Registrar movimiento
              await supabase.from('movimientos').insert({
                codigo: item.productoCodigo,
                tipo: 'entrada',
                cantidad: cantidadReingreso,
                notas: `Reingreso RMA ${selectedRMA.numero}`,
                usuario_email: user?.email,
              });
            }
          }
        }
      }

      await registrarOperacion(selectedRMA.id, 'resolucion', `Resolución: ${resolucionForm.resolucionFinal}`);

      toast.success('Resolución procesada');
      setModalType(null);
      loadData();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // COMPLETAR RMA
  // ============================================

  const completarRMA = async (rma: RMA) => {
    try {
      setProcesando(rma.id);

      await supabase.from('rma').update({
        estado: 'completada',
        fecha_resolucion: new Date().toISOString(),
      }).eq('id', rma.id);

      await registrarOperacion(rma.id, 'completado', 'RMA completado');

      toast.success('RMA completado', rma.numero);
      loadData();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // CARGAR OPERACIONES
  // ============================================

  const cargarOperaciones = async (rmaId: string): Promise<RMAOperacion[]> => {
    const { data } = await supabase
      .from('rma_operaciones')
      .select('*')
      .eq('rma_id', rmaId)
      .order('created_at', { ascending: false });

    return (data || []).map((o: any) => ({
      id: o.id,
      rmaId: o.rma_id,
      tipo: o.tipo,
      descripcion: o.descripcion,
      datos: o.datos,
      ejecutadoPor: o.ejecutado_por,
      createdAt: o.created_at,
    }));
  };

  // ============================================
  // HELPERS UI
  // ============================================

  const toggleRow = (id: string) => {
    const newSet = new Set(expandedRows);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setExpandedRows(newSet);
  };

  const addItem = () => {
    setRmaForm({
      ...rmaForm,
      items: [...rmaForm.items, {
        productoCodigo: '',
        cantidad: 1,
        motivoItem: '',
        serialNumber: '',
        loteCodigo: '',
        precioUnitario: 0,
      }],
    });
  };

  const updateItem = (idx: number, field: string, value: any) => {
    const items = [...rmaForm.items];
    items[idx] = { ...items[idx], [field]: value };
    
    // Auto-completar precio
    if (field === 'productoCodigo') {
      const prod = productos.find(p => p.codigo === value);
      if (prod) items[idx].precioUnitario = prod.precio;
    }
    
    setRmaForm({ ...rmaForm, items });
  };

  const removeItem = (idx: number) => {
    setRmaForm({
      ...rmaForm,
      items: rmaForm.items.filter((_, i) => i !== idx),
    });
  };

  const verDetalles = async (rma: RMA) => {
    const operaciones = await cargarOperaciones(rma.id);
    setSelectedRMA({ ...rma, operaciones });
    setModalType('ver');
  };

  // ============================================
  // FILTROS Y STATS
  // ============================================

  const rmasFiltrados = useMemo(() => {
    return rmas.filter(r => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!r.numero.toLowerCase().includes(search) && 
            !r.cliente?.nombre?.toLowerCase().includes(search)) {
          return false;
        }
      }
      if (filterEstado !== 'todos' && r.estado !== filterEstado) return false;
      if (filterTipo !== 'todos' && r.tipo !== filterTipo) return false;
      return true;
    });
  }, [rmas, searchTerm, filterEstado, filterTipo]);

  const stats = useMemo(() => {
    const total = rmas.length;
    const pendientes = rmas.filter(r => ['solicitada', 'aprobada', 'en_transito'].includes(r.estado)).length;
    const enProceso = rmas.filter(r => ['recibida', 'inspeccionada', 'procesada'].includes(r.estado)).length;
    const completadas = rmas.filter(r => r.estado === 'completada').length;
    const rechazadas = rmas.filter(r => r.estado === 'rechazada').length;

    const valorTotal = rmas.reduce((sum, r) => sum + (r.valorProductos || 0), 0);
    const valorReembolsado = rmas
      .filter(r => r.estado === 'completada' && r.resolucionFinal === 'reembolso')
      .reduce((sum, r) => sum + (r.valorReembolso || 0), 0);

    // Métricas por tipo
    const porTipo: Record<TipoRMA, number> = {
      garantia: 0, defecto: 0, error_envio: 0, no_conforme: 0, cambio: 0, otro: 0,
    };
    rmas.forEach(r => { if (porTipo[r.tipo] !== undefined) porTipo[r.tipo]++; });

    // Tiempo promedio de resolución (solo completadas)
    const completadasConFechas = rmas.filter(r => r.estado === 'completada' && r.fechaSolicitud && r.fechaResolucion);
    const tiempoPromedio = completadasConFechas.length > 0
      ? completadasConFechas.reduce((sum, r) => {
          const inicio = new Date(r.fechaSolicitud).getTime();
          const fin = new Date(r.fechaResolucion!).getTime();
          return sum + (fin - inicio);
        }, 0) / completadasConFechas.length / (1000 * 60 * 60 * 24) // días
      : 0;

    return {
      total, pendientes, enProceso, completadas, rechazadas,
      valorTotal, valorReembolsado, porTipo, tiempoPromedio,
    };
  }, [rmas]);

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
            <RotateCcw className="h-7 w-7 text-amber-400" />
            Gestión de Devoluciones (RMA)
          </h2>
          <p className="text-slate-400 text-sm mt-1">Return Merchandise Authorization - Control completo</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setVistaActiva(vistaActiva === 'lista' ? 'metricas' : 'lista')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl transition-colors',
              vistaActiva === 'metricas' 
                ? 'bg-cyan-600 text-white' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            )}
          >
            <BarChart3 className="h-4 w-4" />
            {vistaActiva === 'metricas' ? 'Ver Lista' : 'Métricas'}
          </button>
          <button
            onClick={() => setModalType('crear')}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nueva Devolución
          </button>
          <button onClick={loadData} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl">
            <RefreshCw className={cn('h-4 w-4 text-slate-400', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Stats principales */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-4 w-4 text-blue-400" />
            <span className="text-xs text-slate-500">Total</span>
          </div>
          <div className="text-2xl font-bold text-blue-400">{stats.total}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-yellow-400" />
            <span className="text-xs text-slate-500">Pendientes</span>
          </div>
          <div className="text-2xl font-bold text-yellow-400">{stats.pendientes}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw className="h-4 w-4 text-purple-400" />
            <span className="text-xs text-slate-500">En Proceso</span>
          </div>
          <div className="text-2xl font-bold text-purple-400">{stats.enProceso}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            <span className="text-xs text-slate-500">Completadas</span>
          </div>
          <div className="text-2xl font-bold text-emerald-400">{stats.completadas}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-cyan-400" />
            <span className="text-xs text-slate-500">Valor Total</span>
          </div>
          <div className="text-2xl font-bold text-cyan-400">{formatCurrency(stats.valorTotal)}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-amber-400" />
            <span className="text-xs text-slate-500">Tiempo Prom.</span>
          </div>
          <div className="text-2xl font-bold text-amber-400">{stats.tiempoPromedio.toFixed(1)}d</div>
        </div>
      </div>

      {/* Vista Métricas */}
      {vistaActiva === 'metricas' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Por tipo */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-cyan-400" />
              Devoluciones por Tipo
            </h3>
            <div className="space-y-3">
              {Object.entries(stats.porTipo).map(([tipo, cantidad]) => {
                const config = getTipoConfig(tipo as TipoRMA);
                const pct = stats.total > 0 ? (cantidad / stats.total) * 100 : 0;
                return (
                  <div key={tipo}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className={config.color}>{config.label}</span>
                      <span className="text-slate-400">{cantidad} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className={cn('h-full', tipo === 'garantia' ? 'bg-blue-500' : tipo === 'defecto' ? 'bg-red-500' : tipo === 'error_envio' ? 'bg-amber-500' : 'bg-slate-500')}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Resumen financiero */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-400" />
              Resumen Financiero
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-xl">
                <span className="text-slate-400">Valor productos devueltos</span>
                <span className="text-xl font-bold text-cyan-400">{formatCurrency(stats.valorTotal)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-xl">
                <span className="text-slate-400">Total reembolsado</span>
                <span className="text-xl font-bold text-emerald-400">{formatCurrency(stats.valorReembolsado)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-xl">
                <span className="text-slate-400">Tasa de reembolso</span>
                <span className="text-xl font-bold text-amber-400">
                  {stats.valorTotal > 0 ? ((stats.valorReembolsado / stats.valorTotal) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Flujo de estados */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6 md:col-span-2">
            <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-purple-400" />
              Flujo de Proceso
            </h3>
            <div className="flex items-center justify-between overflow-x-auto pb-2">
              {['solicitada', 'aprobada', 'en_transito', 'recibida', 'inspeccionada', 'procesada', 'completada'].map((estado, idx, arr) => {
                const config = getEstadoConfig(estado as EstadoRMA);
                const count = rmas.filter(r => r.estado === estado).length;
                return (
                  <React.Fragment key={estado}>
                    <div className="flex flex-col items-center min-w-[100px]">
                      <div className={cn('w-12 h-12 rounded-xl border flex items-center justify-center', config.bg)}>
                        {config.icon}
                      </div>
                      <span className={cn('text-xs mt-2', config.color)}>{config.label}</span>
                      <span className="text-lg font-bold text-slate-300">{count}</span>
                    </div>
                    {idx < arr.length - 1 && (
                      <ChevronRight className="h-5 w-5 text-slate-600 flex-shrink-0" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Vista Lista */}
      {vistaActiva === 'lista' && (
        <>
          {/* Filtros */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar por número o cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-100 placeholder-slate-500"
                />
              </div>
              <select
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value as any)}
                className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-100"
              >
                <option value="todos">Todos los estados</option>
                <option value="solicitada">Solicitadas</option>
                <option value="aprobada">Aprobadas</option>
                <option value="rechazada">Rechazadas</option>
                <option value="en_transito">En Tránsito</option>
                <option value="recibida">Recibidas</option>
                <option value="inspeccionada">Inspeccionadas</option>
                <option value="procesada">Procesadas</option>
                <option value="completada">Completadas</option>
              </select>
              <select
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value as any)}
                className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-100"
              >
                <option value="todos">Todos los tipos</option>
                <option value="garantia">Garantía</option>
                <option value="defecto">Defecto</option>
                <option value="error_envio">Error Envío</option>
                <option value="no_conforme">No Conforme</option>
                <option value="cambio">Cambio</option>
              </select>
            </div>
          </div>

          {/* Tabla */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase w-8"></th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">RMA</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Cliente</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Items</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Valor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {rmasFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                        <RotateCcw className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        No hay devoluciones
                      </td>
                    </tr>
                  ) : (
                    rmasFiltrados.map((rma) => {
                      const estadoConfig = getEstadoConfig(rma.estado);
                      const tipoConfig = getTipoConfig(rma.tipo);
                      const isExpanded = expandedRows.has(rma.id);

                      return (
                        <React.Fragment key={rma.id}>
                          <tr className="hover:bg-slate-800/30">
                            <td className="px-4 py-4">
                              <button onClick={() => toggleRow(rma.id)} className="p-1 hover:bg-slate-700 rounded">
                                {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                              </button>
                            </td>
                            <td className="px-4 py-4">
                              <div className="font-mono text-sm text-slate-200">{rma.numero}</div>
                              {rma.trackingDevolucion && (
                                <div className="text-xs text-slate-500">Track: {rma.trackingDevolucion}</div>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-slate-200">{rma.cliente?.nombre || '-'}</div>
                              <div className="text-xs text-slate-500">{rma.cliente?.email}</div>
                            </td>
                            <td className="px-4 py-4">
                              <span className={cn('text-sm', tipoConfig.color)}>{tipoConfig.label}</span>
                            </td>
                            <td className="px-4 py-4">
                              <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs border', estadoConfig.bg, estadoConfig.color)}>
                                {estadoConfig.icon}
                                {estadoConfig.label}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <span className="text-slate-300">{rma.items.length}</span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-amber-400 font-medium">{formatCurrency(rma.valorProductos)}</div>
                              {rma.valorReembolso && rma.valorReembolso > 0 && (
                                <div className="text-xs text-emerald-400">Reemb: {formatCurrency(rma.valorReembolso)}</div>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-sm text-slate-400">{formatDate(rma.fechaSolicitud)}</div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-1">
                                <button onClick={() => verDetalles(rma)} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Ver detalles">
                                  <Eye className="h-4 w-4 text-blue-400" />
                                </button>
                                
                                {/* Acciones según estado */}
                                {rma.estado === 'solicitada' && (
                                  <>
                                    <button onClick={() => cambiarEstado(rma, 'aprobada')} disabled={procesando === rma.id} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Aprobar">
                                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                                    </button>
                                    <button onClick={() => cambiarEstado(rma, 'rechazada')} disabled={procesando === rma.id} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Rechazar">
                                      <XCircle className="h-4 w-4 text-red-400" />
                                    </button>
                                  </>
                                )}
                                {rma.estado === 'aprobada' && (
                                  <button onClick={() => cambiarEstado(rma, 'en_transito')} disabled={procesando === rma.id} className="p-1.5 hover:bg-slate-700 rounded-lg" title="En tránsito">
                                    <Truck className="h-4 w-4 text-purple-400" />
                                  </button>
                                )}
                                {rma.estado === 'en_transito' && (
                                  <button onClick={() => cambiarEstado(rma, 'recibida')} disabled={procesando === rma.id} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Recibida">
                                    <PackageCheck className="h-4 w-4 text-cyan-400" />
                                  </button>
                                )}
                                {rma.estado === 'recibida' && (
                                  <button onClick={() => abrirInspeccion(rma)} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Inspeccionar">
                                    <ClipboardCheck className="h-4 w-4 text-indigo-400" />
                                  </button>
                                )}
                                {rma.estado === 'inspeccionada' && (
                                  <button onClick={() => abrirResolucion(rma)} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Procesar">
                                    <DollarSign className="h-4 w-4 text-emerald-400" />
                                  </button>
                                )}
                                {rma.estado === 'procesada' && (
                                  <button onClick={() => completarRMA(rma)} disabled={procesando === rma.id} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Completar">
                                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          
                          {/* Fila expandida - Items */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={9} className="px-4 py-4 bg-slate-800/20">
                                <div className="pl-8">
                                  <h4 className="text-sm font-semibold text-slate-400 mb-3">Productos ({rma.items.length})</h4>
                                  <div className="space-y-2">
                                    {rma.items.map(item => (
                                      <div key={item.id} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                                        <div className="flex-1">
                                          <span className="font-mono text-xs text-slate-500">{item.productoCodigo}</span>
                                          <span className="ml-2 text-sm text-slate-200">{item.productoDescripcion}</span>
                                          {item.serialNumber && <span className="ml-2 text-xs text-cyan-400">SN: {item.serialNumber}</span>}
                                          {item.loteCodigo && <span className="ml-2 text-xs text-purple-400">Lote: {item.loteCodigo}</span>}
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                          <span className="text-slate-400">Cant: {item.cantidad}</span>
                                          {item.cantidadAprobada !== undefined && (
                                            <span className="text-emerald-400">Aprob: {item.cantidadAprobada}</span>
                                          )}
                                          {item.cantidadRechazada !== undefined && item.cantidadRechazada > 0 && (
                                            <span className="text-red-400">Rech: {item.cantidadRechazada}</span>
                                          )}
                                          <span className="text-amber-400">{formatCurrency(item.subtotal)}</span>
                                          {item.estadoInspeccion && item.estadoInspeccion !== 'pendiente' && (
                                            <span className={cn(
                                              'px-2 py-0.5 rounded text-xs',
                                              item.estadoInspeccion === 'aprobado' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                                            )}>
                                              {item.estadoInspeccion}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  {rma.motivo && (
                                    <div className="mt-3 p-2 bg-slate-800/20 rounded-lg">
                                      <span className="text-xs text-slate-500">Motivo: </span>
                                      <span className="text-sm text-slate-300">{rma.motivo}</span>
                                    </div>
                                  )}
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
        </>
      )}

      {/* CONTINÚA EN PARTE 4 (MODALES) */}
      {/* MODAL: CREAR RMA */}
      {modalType === 'crear' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Plus className="h-5 w-5 text-amber-400" />
                Nueva Devolución (RMA)
              </h3>
              <button onClick={() => { setModalType(null); resetRmaForm(); }} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Cliente y Tipo */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Cliente *</label>
                  <select
                    value={rmaForm.clienteId}
                    onChange={(e) => setRmaForm({ ...rmaForm, clienteId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  >
                    <option value="">Seleccionar...</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Tipo *</label>
                  <select
                    value={rmaForm.tipo}
                    onChange={(e) => setRmaForm({ ...rmaForm, tipo: e.target.value as TipoRMA })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  >
                    <option value="garantia">Garantía</option>
                    <option value="defecto">Defecto</option>
                    <option value="error_envio">Error de Envío</option>
                    <option value="no_conforme">No Conforme</option>
                    <option value="cambio">Cambio</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>

              {/* Motivo */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Motivo de la devolución *</label>
                <textarea
                  value={rmaForm.motivo}
                  onChange={(e) => setRmaForm({ ...rmaForm, motivo: e.target.value })}
                  rows={2}
                  placeholder="Describa el motivo..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 resize-none"
                />
              </div>

              {/* Resolución y Tracking */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Resolución esperada</label>
                  <select
                    value={rmaForm.resolucionEsperada}
                    onChange={(e) => setRmaForm({ ...rmaForm, resolucionEsperada: e.target.value as ResolucionRMA })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  >
                    <option value="reembolso">Reembolso</option>
                    <option value="reemplazo">Reemplazo</option>
                    <option value="credito">Nota de Crédito</option>
                    <option value="reparacion">Reparación</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Tracking devolución</label>
                  <input
                    type="text"
                    value={rmaForm.trackingDevolucion}
                    onChange={(e) => setRmaForm({ ...rmaForm, trackingDevolucion: e.target.value })}
                    placeholder="Número de guía..."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
              </div>

              {/* Productos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-slate-400">Productos a devolver *</label>
                  <button onClick={addItem} className="text-sm text-amber-400 hover:text-amber-300">+ Agregar producto</button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {rmaForm.items.map((item, idx) => (
                    <div key={idx} className="p-3 bg-slate-800/50 rounded-xl space-y-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={item.productoCodigo}
                          onChange={(e) => updateItem(idx, 'productoCodigo', e.target.value)}
                          className="flex-1 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm"
                        >
                          <option value="">Producto...</option>
                          {productos.map(p => <option key={p.codigo} value={p.codigo}>{p.codigo} - {p.descripcion}</option>)}
                        </select>
                        <input
                          type="number"
                          value={item.cantidad}
                          onChange={(e) => updateItem(idx, 'cantidad', parseInt(e.target.value) || 1)}
                          className="w-16 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm"
                          min="1"
                          placeholder="Cant"
                        />
                        <input
                          type="number"
                          value={item.precioUnitario}
                          onChange={(e) => updateItem(idx, 'precioUnitario', parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm"
                          step="0.01"
                          placeholder="Precio"
                        />
                        <button onClick={() => removeItem(idx)} className="p-1 text-red-400 hover:text-red-300">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={item.serialNumber}
                          onChange={(e) => updateItem(idx, 'serialNumber', e.target.value)}
                          placeholder="Serial (opcional)"
                          className="flex-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs"
                        />
                        <input
                          type="text"
                          value={item.loteCodigo}
                          onChange={(e) => updateItem(idx, 'loteCodigo', e.target.value)}
                          placeholder="Lote (opcional)"
                          className="flex-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs"
                        />
                        <input
                          type="text"
                          value={item.motivoItem}
                          onChange={(e) => updateItem(idx, 'motivoItem', e.target.value)}
                          placeholder="Motivo específico"
                          className="flex-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  ))}
                  {rmaForm.items.length === 0 && (
                    <div className="text-center py-6 text-slate-500 text-sm">
                      Agregue los productos a devolver
                    </div>
                  )}
                </div>
                {rmaForm.items.length > 0 && (
                  <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex justify-between">
                    <span className="text-sm text-slate-400">Valor total:</span>
                    <span className="font-bold text-amber-400">
                      ${rmaForm.items.reduce((sum, i) => sum + (i.cantidad * i.precioUnitario), 0).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notas adicionales</label>
                <textarea
                  value={rmaForm.notas}
                  onChange={(e) => setRmaForm({ ...rmaForm, notas: e.target.value })}
                  rows={2}
                  placeholder="Observaciones..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
              <button
                onClick={crearRMA}
                disabled={!rmaForm.clienteId || !rmaForm.motivo || rmaForm.items.length === 0 || procesando === 'creating'}
                className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2"
              >
                {procesando === 'creating' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Crear RMA
              </button>
              <button onClick={() => { setModalType(null); resetRmaForm(); }} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INSPECCIÓN */}
      {modalType === 'inspeccion' && selectedRMA && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-indigo-400" />
                Inspección de Calidad
              </h3>
              <button onClick={() => setModalType(null)} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="p-3 bg-slate-800/50 rounded-xl mb-4">
              <div className="text-sm text-slate-400">RMA</div>
              <div className="font-mono text-lg text-slate-200">{selectedRMA.numero}</div>
              <div className="text-sm text-slate-500">{selectedRMA.cliente?.nombre}</div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-400">Inspeccionar Items</h4>
              {selectedRMA.items.map((item, idx) => {
                const formItem = inspeccionForm.items[idx];
                return (
                  <div key={item.id} className="p-4 bg-slate-800/30 rounded-xl">
                    <div className="flex justify-between mb-3">
                      <div>
                        <span className="font-mono text-xs text-slate-500">{item.productoCodigo}</span>
                        <span className="ml-2 text-sm text-slate-200">{item.productoDescripcion}</span>
                      </div>
                      <span className="text-slate-400">Recibido: {item.cantidad}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Aprobadas</label>
                        <input
                          type="number"
                          value={formItem?.cantidadAprobada || 0}
                          onChange={(e) => {
                            const items = [...inspeccionForm.items];
                            const val = parseInt(e.target.value) || 0;
                            items[idx] = { 
                              ...items[idx], 
                              cantidadAprobada: val,
                              cantidadRechazada: item.cantidad - val,
                              estadoInspeccion: val === item.cantidad ? 'aprobado' : val === 0 ? 'rechazado' : 'aprobado',
                            };
                            setInspeccionForm({ ...inspeccionForm, items });
                          }}
                          min="0"
                          max={item.cantidad}
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-emerald-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Rechazadas</label>
                        <input
                          type="number"
                          value={formItem?.cantidadRechazada || 0}
                          onChange={(e) => {
                            const items = [...inspeccionForm.items];
                            const val = parseInt(e.target.value) || 0;
                            items[idx] = { 
                              ...items[idx], 
                              cantidadRechazada: val,
                              cantidadAprobada: item.cantidad - val,
                              estadoInspeccion: val === item.cantidad ? 'rechazado' : 'aprobado',
                            };
                            setInspeccionForm({ ...inspeccionForm, items });
                          }}
                          min="0"
                          max={item.cantidad}
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-red-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Estado</label>
                        <select
                          value={formItem?.estadoInspeccion || 'aprobado'}
                          onChange={(e) => {
                            const items = [...inspeccionForm.items];
                            items[idx] = { ...items[idx], estadoInspeccion: e.target.value as any };
                            setInspeccionForm({ ...inspeccionForm, items });
                          }}
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm"
                        >
                          <option value="aprobado">Aprobado</option>
                          <option value="rechazado">Rechazado</option>
                        </select>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={formItem?.notas || ''}
                      onChange={(e) => {
                        const items = [...inspeccionForm.items];
                        items[idx] = { ...items[idx], notas: e.target.value };
                        setInspeccionForm({ ...inspeccionForm, items });
                      }}
                      placeholder="Notas de inspección..."
                      className="w-full mt-2 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm"
                    />
                  </div>
                );
              })}

              <div>
                <label className="block text-sm text-slate-400 mb-1">Notas generales</label>
                <textarea
                  value={inspeccionForm.notasGenerales}
                  onChange={(e) => setInspeccionForm({ ...inspeccionForm, notasGenerales: e.target.value })}
                  rows={2}
                  placeholder="Observaciones de la inspección..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
              <button
                onClick={guardarInspeccion}
                disabled={procesando === selectedRMA.id}
                className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2"
              >
                {procesando === selectedRMA.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                Guardar Inspección
              </button>
              <button onClick={() => setModalType(null)} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RESOLUCIÓN */}
      {modalType === 'resolucion' && selectedRMA && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-400" />
                Procesar Resolución
              </h3>
              <button onClick={() => setModalType(null)} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="p-3 bg-slate-800/50 rounded-xl mb-4">
              <div className="flex justify-between">
                <div>
                  <div className="text-sm text-slate-400">RMA</div>
                  <div className="font-mono text-lg text-slate-200">{selectedRMA.numero}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-400">Valor</div>
                  <div className="text-lg font-bold text-amber-400">${selectedRMA.valorProductos.toLocaleString()}</div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Resolución final *</label>
                <select
                  value={resolucionForm.resolucionFinal}
                  onChange={(e) => setResolucionForm({ ...resolucionForm, resolucionFinal: e.target.value as ResolucionRMA })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                >
                  <option value="reembolso">Reembolso</option>
                  <option value="reemplazo">Reemplazo</option>
                  <option value="credito">Nota de Crédito</option>
                  <option value="reparacion">Reparación</option>
                  <option value="rechazo">Rechazo (sin compensación)</option>
                </select>
              </div>

              {resolucionForm.resolucionFinal === 'reembolso' && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Monto a reembolsar</label>
                  <input
                    type="number"
                    value={resolucionForm.valorReembolso}
                    onChange={(e) => setResolucionForm({ ...resolucionForm, valorReembolso: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-lg"
                    step="0.01"
                  />
                </div>
              )}

              {resolucionForm.resolucionFinal === 'credito' && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Número de Nota de Crédito</label>
                  <input
                    type="text"
                    value={resolucionForm.notaCredito}
                    onChange={(e) => setResolucionForm({ ...resolucionForm, notaCredito: e.target.value })}
                    placeholder="NC-000001"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
              )}

              {resolucionForm.resolucionFinal === 'reemplazo' && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Número de Orden de Reemplazo</label>
                  <input
                    type="text"
                    value={resolucionForm.ordenReemplazo}
                    onChange={(e) => setResolucionForm({ ...resolucionForm, ordenReemplazo: e.target.value })}
                    placeholder="OV-000001"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
              )}

              {resolucionForm.resolucionFinal !== 'rechazo' && (
                <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl">
                  <input
                    type="checkbox"
                    id="reingresoStock"
                    checked={resolucionForm.reingresoStock}
                    onChange={(e) => setResolucionForm({ ...resolucionForm, reingresoStock: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <label htmlFor="reingresoStock" className="text-sm text-slate-300">
                    Reingresar productos aprobados al stock
                  </label>
                </div>
              )}

              <div>
                <label className="block text-sm text-slate-400 mb-1">Notas internas</label>
                <textarea
                  value={resolucionForm.notasInternas}
                  onChange={(e) => setResolucionForm({ ...resolucionForm, notasInternas: e.target.value })}
                  rows={2}
                  placeholder="Notas para uso interno..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
              <button
                onClick={procesarResolucion}
                disabled={procesando === selectedRMA.id}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2"
              >
                {procesando === selectedRMA.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Procesar
              </button>
              <button onClick={() => setModalType(null)} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VER DETALLES */}
      {modalType === 'ver' && selectedRMA && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-100">Detalle RMA</h3>
                <p className="text-sm text-slate-400 font-mono">{selectedRMA.numero}</p>
              </div>
              <button onClick={() => setModalType(null)} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            {/* Info general */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-800/50 rounded-xl p-3">
                <div className="text-xs text-slate-500">Cliente</div>
                <div className="text-slate-200">{selectedRMA.cliente?.nombre}</div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-3">
                <div className="text-xs text-slate-500">Tipo</div>
                <div className={getTipoConfig(selectedRMA.tipo).color}>{getTipoConfig(selectedRMA.tipo).label}</div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-3">
                <div className="text-xs text-slate-500">Estado</div>
                <span className={`inline-flex items-center gap-1 ${getEstadoConfig(selectedRMA.estado).color}`}>
                  {getEstadoConfig(selectedRMA.estado).icon}
                  {getEstadoConfig(selectedRMA.estado).label}
                </span>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-3">
                <div className="text-xs text-slate-500">Valor</div>
                <div className="text-amber-400 font-semibold">${selectedRMA.valorProductos.toLocaleString()}</div>
              </div>
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-800/30 rounded-xl p-3">
                <div className="text-xs text-slate-500">Solicitado</div>
                <div className="text-slate-300 text-sm">{formatDate(selectedRMA.fechaSolicitud)}</div>
              </div>
              {selectedRMA.fechaAprobacion && (
                <div className="bg-slate-800/30 rounded-xl p-3">
                  <div className="text-xs text-slate-500">Aprobado</div>
                  <div className="text-slate-300 text-sm">{formatDate(selectedRMA.fechaAprobacion)}</div>
                </div>
              )}
              {selectedRMA.fechaRecepcion && (
                <div className="bg-slate-800/30 rounded-xl p-3">
                  <div className="text-xs text-slate-500">Recibido</div>
                  <div className="text-slate-300 text-sm">{formatDate(selectedRMA.fechaRecepcion)}</div>
                </div>
              )}
              {selectedRMA.fechaResolucion && (
                <div className="bg-slate-800/30 rounded-xl p-3">
                  <div className="text-xs text-slate-500">Resuelto</div>
                  <div className="text-slate-300 text-sm">{formatDate(selectedRMA.fechaResolucion)}</div>
                </div>
              )}
            </div>

            {/* Resolución */}
            {selectedRMA.resolucionFinal && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl mb-6">
                <h4 className="text-sm font-semibold text-emerald-400 mb-2">Resolución</h4>
                <div className="flex items-center gap-2">
                  {getResolucionConfig(selectedRMA.resolucionFinal).icon}
                  <span className={getResolucionConfig(selectedRMA.resolucionFinal).color}>
                    {getResolucionConfig(selectedRMA.resolucionFinal).label}
                  </span>
                  {selectedRMA.valorReembolso && selectedRMA.valorReembolso > 0 && (
                    <span className="text-emerald-400 ml-2">
                      ${selectedRMA.valorReembolso.toLocaleString()}
                    </span>
                  )}
                </div>
                {selectedRMA.notaCredito && (
                  <div className="text-sm text-slate-400 mt-1">Nota Crédito: {selectedRMA.notaCredito}</div>
                )}
                {selectedRMA.ordenReemplazo && (
                  <div className="text-sm text-slate-400 mt-1">Orden Reemplazo: {selectedRMA.ordenReemplazo}</div>
                )}
              </div>
            )}

            {/* Items */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-slate-400 mb-3">Productos ({selectedRMA.items.length})</h4>
              <div className="space-y-2">
                {selectedRMA.items.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                    <div className="flex-1">
                      <span className="font-mono text-xs text-slate-500">{item.productoCodigo}</span>
                      <span className="ml-2 text-sm text-slate-200">{item.productoDescripcion}</span>
                      {item.motivoItem && <div className="text-xs text-slate-500 mt-1">Motivo: {item.motivoItem}</div>}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-slate-400">Cant: {item.cantidad}</span>
                      {item.estadoInspeccion && item.estadoInspeccion !== 'pendiente' && (
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          item.estadoInspeccion === 'aprobado' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {item.estadoInspeccion}
                        </span>
                      )}
                      <span className="text-amber-400">${item.subtotal.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Motivo */}
            {selectedRMA.motivo && (
              <div className="p-3 bg-slate-800/30 rounded-xl mb-6">
                <div className="text-xs text-slate-500">Motivo</div>
                <div className="text-slate-200 mt-1">{selectedRMA.motivo}</div>
              </div>
            )}

            {/* Timeline/Operaciones */}
            {selectedRMA.operaciones && selectedRMA.operaciones.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Historial de Operaciones
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedRMA.operaciones.map(op => (
                    <div key={op.id} className="flex items-center gap-3 p-2 bg-slate-800/20 rounded-lg">
                      <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
                      <div className="flex-1">
                        <div className="text-sm text-slate-200">{op.descripcion}</div>
                        <div className="text-xs text-slate-500">
                          {formatDateTime(op.createdAt)} • {op.ejecutadoPor}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-slate-700">
              <button onClick={() => setModalType(null)} className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}