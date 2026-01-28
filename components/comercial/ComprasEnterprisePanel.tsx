'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Truck, Package, FileText, Search, Edit, Trash2, Send, CheckCircle,
  XCircle, Clock, ChevronDown, ChevronUp, RefreshCw, Eye, AlertTriangle,
  Calendar, DollarSign, Building, PackageCheck, X
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn, formatCurrency } from '@/lib/utils';
import { Product } from '@/types';

// ============================================
// TIPOS
// ============================================

interface Proveedor {
  id: string;
  codigo: string;
  nombre: string;
  nombreContacto?: string;
  email?: string;
  telefono?: string;
}

interface OrdenCompraItem {
  id: string;
  ordenId: string;
  productoCodigo: string;
  cantidadOrdenada: number;
  cantidadRecibida: number;
  costoUnitario: number;
  subtotal: number;
}

interface OrdenCompra {
  id: string;
  numero: string;
  proveedorId: string;
  proveedor?: Proveedor;
  estado: 'borrador' | 'enviada' | 'parcial' | 'recibida' | 'cancelada';
  prioridad: 'baja' | 'normal' | 'alta' | 'urgente';
  fechaOrden: string;
  fechaEsperada?: string;
  fechaRecibida?: string;
  subtotal: number;
  impuestos: number;
  total: number;
  moneda: string;
  notas?: string;
  items: OrdenCompraItem[];
}

type ModalType = 'create' | 'view' | 'recepcion' | 'proveedor' | null;

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
          'px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3 animate-in slide-in-from-right',
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

const getEstadoConfig = (estado: OrdenCompra['estado']) => {
  const configs = {
    borrador: { color: 'text-slate-400', bg: 'bg-slate-500/20', label: 'Borrador' },
    enviada: { color: 'text-cyan-400', bg: 'bg-cyan-500/20', label: 'Enviada' },
    parcial: { color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'Parcial' },
    recibida: { color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'Recibida' },
    cancelada: { color: 'text-red-400', bg: 'bg-red-500/20', label: 'Cancelada' },
  };
  return configs[estado];
};

const getPrioridadConfig = (prioridad: OrdenCompra['prioridad']) => {
  const configs = {
    baja: { color: 'text-slate-400', bg: 'bg-slate-500/20' },
    normal: { color: 'text-blue-400', bg: 'bg-blue-500/20' },
    alta: { color: 'text-amber-400', bg: 'bg-amber-500/20' },
    urgente: { color: 'text-red-400', bg: 'bg-red-500/20' },
  };
  return configs[prioridad];
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

interface ComprasEnterprisePanelProps {
  products: Product[];
  userEmail: string;
}

export default function ComprasEnterprisePanel({ products, userEmail }: ComprasEnterprisePanelProps) {
  const toast = useToast();

  // Estado principal
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState<OrdenCompra['estado'] | 'todos'>('todos');

  // UI
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [modalType, setModalType] = useState<ModalType>(null);
  const [selectedOrden, setSelectedOrden] = useState<OrdenCompra | null>(null);

  // Form nueva orden
  const [newOrden, setNewOrden] = useState({
    proveedorId: '',
    fechaEsperada: '',
    prioridad: 'normal' as OrdenCompra['prioridad'],
    notas: '',
    items: [] as Array<{ productoCodigo: string; cantidad: number; costoUnitario: number }>,
  });

  // Form recepción
  const [recepcionForm, setRecepcionForm] = useState({
    documentoProveedor: '',
    notas: '',
    items: [] as Array<{ ordenItemId: string; cantidadRecibida: number; cantidadRechazada: number; motivoRechazo: string }>,
  });

  // Form proveedor
  const [proveedorForm, setProveedorForm] = useState({
    codigo: '', nombre: '', nombreContacto: '', email: '', telefono: '', direccion: '', ciudad: '', pais: 'Uruguay',
  });
  const [editingProveedor, setEditingProveedor] = useState<Proveedor | null>(null);

  // ============================================
  // CARGA DE DATOS
  // ============================================

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [ordenesRes, proveedoresRes] = await Promise.all([
        supabase
          .from('ordenes_compra')
          .select(`*, proveedores(id, codigo, nombre, email, telefono), ordenes_compra_items(*)`)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('proveedores')
          .select('*')
          .eq('activo', true)
          .order('nombre'),
      ]);

      if (ordenesRes.data) {
        setOrdenes(ordenesRes.data.map((o: any) => ({
          id: o.id,
          numero: o.numero,
          proveedorId: o.proveedor_id,
          proveedor: o.proveedores,
          estado: o.estado,
          prioridad: o.prioridad || 'normal',
          fechaOrden: o.fecha_orden,
          fechaEsperada: o.fecha_esperada,
          fechaRecibida: o.fecha_recibida,
          subtotal: parseFloat(o.subtotal) || 0,
          impuestos: parseFloat(o.impuestos) || 0,
          total: parseFloat(o.total) || 0,
          moneda: o.moneda,
          notas: o.notas,
          items: (o.ordenes_compra_items || []).map((i: any) => ({
            id: i.id,
            ordenId: i.orden_id,
            productoCodigo: i.producto_codigo,
            cantidadOrdenada: i.cantidad_ordenada,
            cantidadRecibida: i.cantidad_recibida || 0,
            costoUnitario: parseFloat(i.costo_unitario) || 0,
            subtotal: parseFloat(i.subtotal) || 0,
          })),
        })));
      }

      if (proveedoresRes.data) {
        setProveedores(proveedoresRes.data.map((p: any) => ({
          id: p.id,
          codigo: p.codigo,
          nombre: p.nombre,
          nombreContacto: p.nombre_contacto,
          email: p.email,
          telefono: p.telefono,
        })));
      }
    } catch (error: any) {
      toast.error('Error al cargar datos', error.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // FILTROS Y STATS
  // ============================================

  const ordenesFiltradas = useMemo(() => {
    return ordenes.filter(o => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!o.numero.toLowerCase().includes(search) && !o.proveedor?.nombre.toLowerCase().includes(search)) {
          return false;
        }
      }
      if (filterEstado !== 'todos' && o.estado !== filterEstado) return false;
      return true;
    });
  }, [ordenes, searchTerm, filterEstado]);

  const stats = useMemo(() => {
    const pendientes = ordenes.filter(o => !['recibida', 'cancelada'].includes(o.estado));
    const enTransito = ordenes.filter(o => o.estado === 'enviada');
    const parciales = ordenes.filter(o => o.estado === 'parcial');
    const atrasadas = ordenes.filter(o => 
      o.estado === 'enviada' && o.fechaEsperada && new Date(o.fechaEsperada) < new Date()
    );

    return {
      total: ordenes.length,
      pendientes: pendientes.length,
      enTransito: enTransito.length,
      parciales: parciales.length,
      totalTransito: enTransito.reduce((sum, o) => sum + o.total, 0),
      atrasadas: atrasadas.length,
    };
  }, [ordenes]);

  // ============================================
  // ACCIONES - CREAR ORDEN
  // ============================================

  const crearOrden = async () => {
    if (!newOrden.proveedorId || newOrden.items.length === 0) {
      toast.warning('Datos incompletos', 'Seleccione proveedor y agregue productos');
      return;
    }

    try {
      setProcesando('creating');

      // Generar número
      const { count } = await supabase.from('ordenes_compra').select('*', { count: 'exact', head: true });
      const numero = `OC-${String((count || 0) + 1).padStart(6, '0')}`;
      
      const subtotal = newOrden.items.reduce((sum, i) => sum + (i.cantidad * i.costoUnitario), 0);

      const { data: ordenData, error: ordenError } = await supabase
        .from('ordenes_compra')
        .insert({
          numero,
          proveedor_id: newOrden.proveedorId,
          estado: 'borrador',
          prioridad: newOrden.prioridad,
          fecha_esperada: newOrden.fechaEsperada || null,
          subtotal,
          total: subtotal,
          notas: newOrden.notas || null,
          creado_por: userEmail,
        })
        .select()
        .single();

      if (ordenError) throw ordenError;

      // Insertar items
      const itemsToInsert = newOrden.items.map(item => ({
        orden_id: ordenData.id,
        producto_codigo: item.productoCodigo,
        cantidad_ordenada: item.cantidad,
        costo_unitario: item.costoUnitario,
        subtotal: item.cantidad * item.costoUnitario,
      }));

      await supabase.from('ordenes_compra_items').insert(itemsToInsert);

      toast.success('Orden creada', `Orden ${numero} creada correctamente`);
      setModalType(null);
      setNewOrden({ proveedorId: '', fechaEsperada: '', prioridad: 'normal', notas: '', items: [] });
      loadData();
    } catch (error: any) {
      toast.error('Error al crear orden', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // ACCIONES - CAMBIAR ESTADO
  // ============================================

  const cambiarEstado = async (orden: OrdenCompra, nuevoEstado: OrdenCompra['estado']) => {
    try {
      setProcesando(orden.id);

      const updateData: any = { estado: nuevoEstado, updated_at: new Date().toISOString() };
      if (nuevoEstado === 'recibida') {
        updateData.fecha_recibida = new Date().toISOString().split('T')[0];
      }

      await supabase.from('ordenes_compra').update(updateData).eq('id', orden.id);
      toast.success('Estado actualizado', `Orden ${orden.numero} → ${nuevoEstado}`);
      loadData();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // ACCIONES - RECEPCIÓN PARCIAL
  // ============================================

  const abrirRecepcion = (orden: OrdenCompra) => {
    setSelectedOrden(orden);
    setRecepcionForm({
      documentoProveedor: '',
      notas: '',
      items: orden.items.map(item => ({
        ordenItemId: item.id,
        cantidadRecibida: item.cantidadOrdenada - item.cantidadRecibida,
        cantidadRechazada: 0,
        motivoRechazo: '',
      })),
    });
    setModalType('recepcion');
  };

  const registrarRecepcion = async () => {
    if (!selectedOrden) return;

    try {
      setProcesando(selectedOrden.id);

      // Generar número recepción
      const { count } = await supabase.from('recepciones_compra').select('*', { count: 'exact', head: true });
      const numero = `REC-${String((count || 0) + 1).padStart(6, '0')}`;

      // Crear recepción
      const { data: recepcionData, error: recError } = await supabase
        .from('recepciones_compra')
        .insert({
          orden_compra_id: selectedOrden.id,
          numero,
          documento_proveedor: recepcionForm.documentoProveedor || null,
          notas: recepcionForm.notas || null,
          recibido_por: userEmail,
        })
        .select()
        .single();

      if (recError) throw recError;

      // Procesar cada item
      for (const item of recepcionForm.items) {
        if (item.cantidadRecibida <= 0) continue;

        const ordenItem = selectedOrden.items.find(i => i.id === item.ordenItemId);
        if (!ordenItem) continue;

        // Insertar item de recepción
        await supabase.from('recepciones_compra_items').insert({
          recepcion_id: recepcionData.id,
          orden_item_id: item.ordenItemId,
          producto_codigo: ordenItem.productoCodigo,
          cantidad_recibida: item.cantidadRecibida,
          cantidad_rechazada: item.cantidadRechazada,
          motivo_rechazo: item.motivoRechazo || null,
        });

        // Actualizar cantidad recibida en OC
        await supabase
          .from('ordenes_compra_items')
          .update({ cantidad_recibida: ordenItem.cantidadRecibida + item.cantidadRecibida })
          .eq('id', item.ordenItemId);

        // Actualizar stock
        const { data: prod } = await supabase
          .from('productos')
          .select('id, stock')
          .eq('codigo', ordenItem.productoCodigo)
          .single();

        if (prod) {
          await supabase.from('productos')
            .update({ stock: prod.stock + item.cantidadRecibida })
            .eq('codigo', ordenItem.productoCodigo);

          // Movimiento de entrada
          await supabase.from('movimientos').insert({
            producto_id: prod.id,
            codigo: ordenItem.productoCodigo,
            tipo: 'entrada',
            cantidad: item.cantidadRecibida,
            costo_compra: ordenItem.costoUnitario,
            notas: `Recepción ${numero} - OC ${selectedOrden.numero}`,
            usuario_email: userEmail,
          });

          // Crear lote
          await supabase.from('lotes').insert({
            codigo: ordenItem.productoCodigo,
            cantidad_inicial: item.cantidadRecibida,
            cantidad_disponible: item.cantidadRecibida,
            costo_unitario: ordenItem.costoUnitario,
            usuario: userEmail,
            notas: `Recepción ${numero}`,
          });
        }
      }

      // Verificar si OC está completa
      const { data: itemsActualizados } = await supabase
        .from('ordenes_compra_items')
        .select('cantidad_ordenada, cantidad_recibida')
        .eq('orden_id', selectedOrden.id);

      const todosRecibidos = itemsActualizados?.every(i => i.cantidad_recibida >= i.cantidad_ordenada);
      const algunoRecibido = itemsActualizados?.some(i => i.cantidad_recibida > 0);

      let nuevoEstado = selectedOrden.estado;
      if (todosRecibidos) nuevoEstado = 'recibida';
      else if (algunoRecibido) nuevoEstado = 'parcial';

      if (nuevoEstado !== selectedOrden.estado) {
        await supabase.from('ordenes_compra').update({
          estado: nuevoEstado,
          fecha_recibida: todosRecibidos ? new Date().toISOString().split('T')[0] : null,
        }).eq('id', selectedOrden.id);
      }

      toast.success('Recepción registrada', `${numero} - Stock actualizado`);
      setModalType(null);
      setSelectedOrden(null);
      loadData();
    } catch (error: any) {
      toast.error('Error', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // ACCIONES - PROVEEDOR
  // ============================================

  const guardarProveedor = async () => {
    if (!proveedorForm.codigo || !proveedorForm.nombre) {
      toast.warning('Datos incompletos', 'Código y nombre requeridos');
      return;
    }

    try {
      setProcesando('proveedor');
      const data = {
        codigo: proveedorForm.codigo.toUpperCase(),
        nombre: proveedorForm.nombre,
        nombre_contacto: proveedorForm.nombreContacto || null,
        email: proveedorForm.email || null,
        telefono: proveedorForm.telefono || null,
      };

      if (editingProveedor) {
        await supabase.from('proveedores').update(data).eq('id', editingProveedor.id);
        toast.success('Proveedor actualizado');
      } else {
        await supabase.from('proveedores').insert(data);
        toast.success('Proveedor creado');
      }

      setModalType(null);
      setEditingProveedor(null);
      setProveedorForm({ codigo: '', nombre: '', nombreContacto: '', email: '', telefono: '', direccion: '', ciudad: '', pais: 'Uruguay' });
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

  const addItem = () => {
    setNewOrden({
      ...newOrden,
      items: [...newOrden.items, { productoCodigo: '', cantidad: 1, costoUnitario: 0 }],
    });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const items = [...newOrden.items];
    items[index] = { ...items[index], [field]: value };
    setNewOrden({ ...newOrden, items });
  };

  const removeItem = (index: number) => {
    setNewOrden({ ...newOrden, items: newOrden.items.filter((_, i) => i !== index) });
  };

  // ============================================
  // CONTINÚA EN PARTE 2 (RENDER)
  // ============================================
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
            <Truck className="h-7 w-7 text-cyan-400" />
            Órdenes de Compra
          </h2>
          <p className="text-slate-400 text-sm mt-1">Gestión con recepciones parciales</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setEditingProveedor(null); setProveedorForm({ codigo: '', nombre: '', nombreContacto: '', email: '', telefono: '', direccion: '', ciudad: '', pais: 'Uruguay' }); setModalType('proveedor'); }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl"
          >
            <Building className="h-4 w-4" />
            Proveedores
          </button>
          <button
            onClick={() => setModalType('create')}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl"
          >
            <Plus className="h-4 w-4" />
            Nueva Orden
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-slate-500" />
            <span className="text-xs text-slate-500">Total</span>
          </div>
          <div className="text-2xl font-bold text-slate-200">{stats.total}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Send className="h-4 w-4 text-cyan-400" />
            <span className="text-xs text-slate-500">En Tránsito</span>
          </div>
          <div className="text-2xl font-bold text-cyan-400">{stats.enTransito}</div>
          <div className="text-xs text-slate-500">{formatCurrency(stats.totalTransito)}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-amber-400" />
            <span className="text-xs text-slate-500">Parciales</span>
          </div>
          <div className="text-2xl font-bold text-amber-400">{stats.parciales}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span className="text-xs text-slate-500">Atrasadas</span>
          </div>
          <div className="text-2xl font-bold text-red-400">{stats.atrasadas}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por número, proveedor..."
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
            <option value="borrador">Borrador</option>
            <option value="enviada">Enviada</option>
            <option value="parcial">Parcial</option>
            <option value="recibida">Recibida</option>
            <option value="cancelada">Cancelada</option>
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
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Orden</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Proveedor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Recepción</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Fecha Esp.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {ordenesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <Truck className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    No hay órdenes de compra
                  </td>
                </tr>
              ) : (
                ordenesFiltradas.map((orden) => {
                  const estadoConfig = getEstadoConfig(orden.estado);
                  const prioridadConfig = getPrioridadConfig(orden.prioridad);
                  const isExpanded = expandedRows.has(orden.id);
                  
                  const totalOrdenado = orden.items.reduce((sum, i) => sum + i.cantidadOrdenada, 0);
                  const totalRecibido = orden.items.reduce((sum, i) => sum + i.cantidadRecibida, 0);
                  const porcRecibido = totalOrdenado > 0 ? (totalRecibido / totalOrdenado) * 100 : 0;
                  const atrasada = orden.estado === 'enviada' && orden.fechaEsperada && new Date(orden.fechaEsperada) < new Date();

                  return (
                    <React.Fragment key={orden.id}>
                      <tr className={cn('hover:bg-slate-800/30', atrasada && 'bg-red-500/5')}>
                        <td className="px-4 py-4">
                          <button onClick={() => toggleRow(orden.id)} className="p-1 hover:bg-slate-700 rounded">
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                          </button>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-slate-200">{orden.numero}</span>
                            {orden.prioridad !== 'normal' && (
                              <span className={cn('px-1.5 py-0.5 rounded text-xs', prioridadConfig.bg, prioridadConfig.color)}>
                                {orden.prioridad}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">{new Date(orden.fechaOrden).toLocaleDateString('es-UY')}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-slate-200">{orden.proveedor?.nombre || '-'}</div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={cn('px-2.5 py-1 rounded-lg text-xs', estadoConfig.bg, estadoConfig.color)}>
                            {estadoConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="w-24">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-400">{totalRecibido}/{totalOrdenado}</span>
                              <span className="text-slate-500">{porcRecibido.toFixed(0)}%</span>
                            </div>
                            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <div 
                                className={cn('h-full', porcRecibido >= 100 ? 'bg-emerald-400' : porcRecibido > 0 ? 'bg-amber-400' : 'bg-slate-600')}
                                style={{ width: `${Math.min(porcRecibido, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-slate-200 font-medium">{formatCurrency(orden.total)}</div>
                          <div className="text-xs text-slate-500">{orden.items.length} items</div>
                        </td>
                        <td className="px-4 py-4">
                          {orden.fechaEsperada ? (
                            <div className={cn('flex items-center gap-1', atrasada && 'text-red-400')}>
                              {atrasada && <AlertTriangle className="h-4 w-4" />}
                              <span>{new Date(orden.fechaEsperada).toLocaleDateString('es-UY')}</span>
                            </div>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1">
                            {orden.estado === 'borrador' && (
                              <>
                                <button onClick={() => cambiarEstado(orden, 'enviada')} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Enviar">
                                  <Send className="h-4 w-4 text-cyan-400" />
                                </button>
                                <button onClick={() => cambiarEstado(orden, 'cancelada')} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Cancelar">
                                  <XCircle className="h-4 w-4 text-red-400" />
                                </button>
                              </>
                            )}
                            {(orden.estado === 'enviada' || orden.estado === 'parcial') && (
                              <button onClick={() => abrirRecepcion(orden)} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Recibir">
                                <PackageCheck className="h-4 w-4 text-emerald-400" />
                              </button>
                            )}
                            <button onClick={() => { setSelectedOrden(orden); setModalType('view'); }} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Ver">
                              <Eye className="h-4 w-4 text-blue-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="px-4 py-4 bg-slate-800/20">
                            <div className="pl-8 space-y-2">
                              {orden.items.map((item) => {
                                const producto = products.find(p => p.codigo === item.productoCodigo);
                                const pendiente = item.cantidadOrdenada - item.cantidadRecibida;
                                return (
                                  <div key={item.id} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                                    <div>
                                      <span className="font-mono text-xs text-slate-500">{item.productoCodigo}</span>
                                      <span className="ml-2 text-sm text-slate-200">{producto?.descripcion || '-'}</span>
                                    </div>
                                    <div className="flex items-center gap-6 text-sm">
                                      <span className="text-slate-400">Ord: {item.cantidadOrdenada}</span>
                                      <span className="text-emerald-400">Rec: {item.cantidadRecibida}</span>
                                      <span className={pendiente > 0 ? 'text-amber-400' : 'text-slate-500'}>Pend: {pendiente}</span>
                                      <span className="text-cyan-400">{formatCurrency(item.subtotal)}</span>
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

      {/* MODAL: CREAR ORDEN */}
      {modalType === 'create' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100">Nueva Orden de Compra</h3>
              <button onClick={() => setModalType(null)} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Proveedor *</label>
                  <select
                    value={newOrden.proveedorId}
                    onChange={(e) => setNewOrden({ ...newOrden, proveedorId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  >
                    <option value="">Seleccionar...</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.codigo} - {p.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Prioridad</label>
                  <select
                    value={newOrden.prioridad}
                    onChange={(e) => setNewOrden({ ...newOrden, prioridad: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  >
                    <option value="baja">Baja</option>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Fecha esperada</label>
                <input
                  type="date"
                  value={newOrden.fechaEsperada}
                  onChange={(e) => setNewOrden({ ...newOrden, fechaEsperada: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                />
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-slate-400">Productos *</label>
                  <button onClick={addItem} className="text-sm text-cyan-400 hover:text-cyan-300">+ Agregar</button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {newOrden.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-xl">
                      <select
                        value={item.productoCodigo}
                        onChange={(e) => updateItem(idx, 'productoCodigo', e.target.value)}
                        className="flex-1 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm"
                      >
                        <option value="">Producto...</option>
                        {products.map(p => <option key={p.codigo} value={p.codigo}>{p.codigo} - {p.descripcion}</option>)}
                      </select>
                      <input
                        type="number"
                        value={item.cantidad}
                        onChange={(e) => updateItem(idx, 'cantidad', parseInt(e.target.value) || 0)}
                        className="w-16 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm"
                        placeholder="Cant"
                        min="1"
                      />
                      <input
                        type="number"
                        value={item.costoUnitario}
                        onChange={(e) => updateItem(idx, 'costoUnitario', parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm"
                        placeholder="Costo"
                        step="0.01"
                      />
                      <button onClick={() => removeItem(idx)} className="p-1 text-red-400 hover:text-red-300">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {newOrden.items.length === 0 && (
                    <div className="text-center py-4 text-slate-500 text-sm">Agregue productos</div>
                  )}
                </div>
                {newOrden.items.length > 0 && (
                  <div className="mt-2 p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl flex justify-between">
                    <span className="text-sm text-slate-400">Total:</span>
                    <span className="font-bold text-cyan-400">
                      {formatCurrency(newOrden.items.reduce((s, i) => s + i.cantidad * i.costoUnitario, 0))}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Notas</label>
                <textarea
                  value={newOrden.notas}
                  onChange={(e) => setNewOrden({ ...newOrden, notas: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
              <button
                onClick={crearOrden}
                disabled={!newOrden.proveedorId || newOrden.items.length === 0 || procesando === 'creating'}
                className="flex-1 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2"
              >
                {procesando === 'creating' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Crear Orden
              </button>
              <button onClick={() => setModalType(null)} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RECEPCIÓN */}
      {modalType === 'recepcion' && selectedOrden && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <PackageCheck className="h-5 w-5 text-emerald-400" />
                Registrar Recepción
              </h3>
              <button onClick={() => setModalType(null)} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="p-3 bg-slate-800/50 rounded-xl mb-4">
              <div className="text-sm text-slate-400">Orden</div>
              <div className="font-mono text-lg text-slate-200">{selectedOrden.numero}</div>
              <div className="text-sm text-slate-500">{selectedOrden.proveedor?.nombre}</div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Documento proveedor</label>
                <input
                  type="text"
                  value={recepcionForm.documentoProveedor}
                  onChange={(e) => setRecepcionForm({ ...recepcionForm, documentoProveedor: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  placeholder="Remito, factura..."
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Productos</label>
                <div className="space-y-2">
                  {selectedOrden.items.map((item, idx) => {
                    const producto = products.find(p => p.codigo === item.productoCodigo);
                    const pendiente = item.cantidadOrdenada - item.cantidadRecibida;
                    const formItem = recepcionForm.items[idx];
                    
                    return (
                      <div key={item.id} className="p-3 bg-slate-800/30 rounded-xl">
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-slate-200">{producto?.descripcion || item.productoCodigo}</span>
                          <span className="text-sm text-amber-400">Pend: {pendiente}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Recibir</label>
                            <input
                              type="number"
                              value={formItem?.cantidadRecibida || 0}
                              onChange={(e) => {
                                const items = [...recepcionForm.items];
                                items[idx] = { ...items[idx], cantidadRecibida: parseInt(e.target.value) || 0 };
                                setRecepcionForm({ ...recepcionForm, items });
                              }}
                              min="0"
                              max={pendiente}
                              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-emerald-400"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Rechazar</label>
                            <input
                              type="number"
                              value={formItem?.cantidadRechazada || 0}
                              onChange={(e) => {
                                const items = [...recepcionForm.items];
                                items[idx] = { ...items[idx], cantidadRechazada: parseInt(e.target.value) || 0 };
                                setRecepcionForm({ ...recepcionForm, items });
                              }}
                              min="0"
                              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-red-400"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Motivo</label>
                            <input
                              type="text"
                              value={formItem?.motivoRechazo || ''}
                              onChange={(e) => {
                                const items = [...recepcionForm.items];
                                items[idx] = { ...items[idx], motivoRechazo: e.target.value };
                                setRecepcionForm({ ...recepcionForm, items });
                              }}
                              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
              <button
                onClick={registrarRecepcion}
                disabled={procesando === selectedOrden.id}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2"
              >
                {procesando === selectedOrden.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
                Registrar Recepción
              </button>
              <button onClick={() => setModalType(null)} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PROVEEDOR */}
      {modalType === 'proveedor' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100">{editingProveedor ? 'Editar' : 'Nuevo'} Proveedor</h3>
              <button onClick={() => setModalType(null)} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Código *</label>
                  <input
                    type="text"
                    value={proveedorForm.codigo}
                    onChange={(e) => setProveedorForm({ ...proveedorForm, codigo: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                    disabled={!!editingProveedor}
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={proveedorForm.nombre}
                    onChange={(e) => setProveedorForm({ ...proveedorForm, nombre: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Contacto</label>
                  <input
                    type="text"
                    value={proveedorForm.nombreContacto}
                    onChange={(e) => setProveedorForm({ ...proveedorForm, nombreContacto: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={proveedorForm.email}
                    onChange={(e) => setProveedorForm({ ...proveedorForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Teléfono</label>
                <input
                  type="text"
                  value={proveedorForm.telefono}
                  onChange={(e) => setProveedorForm({ ...proveedorForm, telefono: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
              <button
                onClick={guardarProveedor}
                disabled={!proveedorForm.codigo || !proveedorForm.nombre || procesando === 'proveedor'}
                className="flex-1 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl"
              >
                {editingProveedor ? 'Guardar' : 'Crear'}
              </button>
              <button onClick={() => setModalType(null)} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">
                Cancelar
              </button>
            </div>

            {/* Lista proveedores */}
            <div className="mt-6 pt-4 border-t border-slate-700">
              <h4 className="text-sm font-semibold text-slate-400 mb-3">Proveedores ({proveedores.length})</h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {proveedores.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 bg-slate-800/30 rounded-lg">
                    <span className="text-sm text-slate-200">{p.codigo} - {p.nombre}</span>
                    <button
                      onClick={() => {
                        setEditingProveedor(p);
                        setProveedorForm({ ...proveedorForm, codigo: p.codigo, nombre: p.nombre, nombreContacto: p.nombreContacto || '', email: p.email || '', telefono: p.telefono || '' });
                      }}
                      className="p-1 hover:bg-slate-700 rounded"
                    >
                      <Edit className="h-4 w-4 text-slate-400" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VER DETALLES */}
      {modalType === 'view' && selectedOrden && (
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
                <div className="text-xs text-slate-500">Proveedor</div>
                <div className="text-slate-200">{selectedOrden.proveedor?.nombre}</div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-3">
                <div className="text-xs text-slate-500">Estado</div>
                <span className={cn('text-sm', getEstadoConfig(selectedOrden.estado).color)}>
                  {getEstadoConfig(selectedOrden.estado).label}
                </span>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-3">
                <div className="text-xs text-slate-500">Total</div>
                <div className="text-cyan-400 font-semibold">{formatCurrency(selectedOrden.total)}</div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-3">
                <div className="text-xs text-slate-500">Fecha</div>
                <div className="text-slate-200">{new Date(selectedOrden.fechaOrden).toLocaleDateString('es-UY')}</div>
              </div>
            </div>

            <h4 className="font-semibold text-slate-300 mb-3">Items</h4>
            <div className="space-y-2 mb-6">
              {selectedOrden.items.map(item => {
                const producto = products.find(p => p.codigo === item.productoCodigo);
                return (
                  <div key={item.id} className="flex justify-between p-3 bg-slate-800/30 rounded-lg">
                    <div>
                      <span className="font-mono text-xs text-slate-500">{item.productoCodigo}</span>
                      <span className="ml-2 text-sm text-slate-200">{producto?.descripcion}</span>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <span className="text-slate-400">{item.cantidadRecibida}/{item.cantidadOrdenada}</span>
                      <span className="text-cyan-400">{formatCurrency(item.subtotal)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

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