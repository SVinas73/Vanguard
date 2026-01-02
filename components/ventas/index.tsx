'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Cliente, OrdenVenta, OrdenVentaItem, Product, OrdenVentaEstado } from '@/types';
import { Button, Input, Select, Modal } from '@/components/ui';
import { 
  Plus, 
  Users, 
  ShoppingCart, 
  FileText, 
  Search, 
  Edit, 
  Trash2, 
  Send, 
  CheckCircle, 
  XCircle,
  Clock,
  Package,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Building,
  User
} from 'lucide-react';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

// ============================================
// CLIENTES PANEL
// ============================================

export function ClientesPanel() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [formData, setFormData] = useState({
    codigo: '',
    tipo: 'persona' as 'persona' | 'empresa',
    nombre: '',
    rut: '',
    email: '',
    telefono: '',
    direccion: '',
    ciudad: '',
    pais: 'Uruguay',
    notas: '',
    limiteCredito: 0,
  });

  useEffect(() => {
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('activo', true)
      .order('nombre');

    if (!error && data) {
      setClientes(data.map(c => ({
        id: c.id,
        codigo: c.codigo,
        tipo: c.tipo,
        nombre: c.nombre,
        rut: c.rut,
        email: c.email,
        telefono: c.telefono,
        direccion: c.direccion,
        ciudad: c.ciudad,
        pais: c.pais,
        notas: c.notas,
        limiteCredito: parseFloat(c.limite_credito) || 0,
        saldoPendiente: parseFloat(c.saldo_pendiente) || 0,
        activo: c.activo,
      })));
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!formData.codigo || !formData.nombre) return;

    const clienteData = {
      codigo: formData.codigo.toUpperCase(),
      tipo: formData.tipo,
      nombre: formData.nombre,
      rut: formData.rut || null,
      email: formData.email || null,
      telefono: formData.telefono || null,
      direccion: formData.direccion || null,
      ciudad: formData.ciudad || null,
      pais: formData.pais,
      notas: formData.notas || null,
      limite_credito: formData.limiteCredito,
    };

    if (editingCliente) {
      await supabase
        .from('clientes')
        .update({ ...clienteData, updated_at: new Date().toISOString() })
        .eq('id', editingCliente.id);
    } else {
      await supabase.from('clientes').insert(clienteData);
    }

    setShowModal(false);
    setEditingCliente(null);
    setFormData({
      codigo: '',
      tipo: 'persona',
      nombre: '',
      rut: '',
      email: '',
      telefono: '',
      direccion: '',
      ciudad: '',
      pais: 'Uruguay',
      notas: '',
      limiteCredito: 0,
    });
    fetchClientes();
  };

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setFormData({
      codigo: cliente.codigo,
      tipo: cliente.tipo,
      nombre: cliente.nombre,
      rut: cliente.rut || '',
      email: cliente.email || '',
      telefono: cliente.telefono || '',
      direccion: cliente.direccion || '',
      ciudad: cliente.ciudad || '',
      pais: cliente.pais,
      notas: cliente.notas || '',
      limiteCredito: cliente.limiteCredito,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de desactivar este cliente?')) return;
    await supabase.from('clientes').update({ activo: false }).eq('id', id);
    fetchClientes();
  };

  const filteredClientes = clientes.filter(c =>
    c.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.rut && c.rut.includes(searchQuery))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="text-violet-400" size={24} />
          <h2 className="text-lg font-semibold">Clientes</h2>
          <span className="text-sm text-slate-500">({clientes.length})</span>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={18} className="mr-2" />
          Nuevo Cliente
        </Button>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Buscar clientes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/50 border border-slate-800/50 focus:border-violet-500/50 focus:outline-none text-sm"
        />
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-500">Cargando clientes...</div>
      ) : filteredClientes.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <Users size={48} className="mx-auto mb-2 opacity-50" />
          No hay clientes registrados
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredClientes.map((cliente) => (
            <div
              key={cliente.id}
              className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50 hover:border-slate-700/50 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {cliente.tipo === 'empresa' ? (
                      <Building size={16} className="text-violet-400" />
                    ) : (
                      <User size={16} className="text-cyan-400" />
                    )}
                    <span className="font-mono text-xs text-slate-500">{cliente.codigo}</span>
                    <span className="font-semibold">{cliente.nombre}</span>
                    {cliente.saldoPendiente > 0 && (
                      <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400">
                        Debe: {formatCurrency(cliente.saldoPendiente)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-slate-400 space-y-0.5">
                    {cliente.rut && <div>RUT: {cliente.rut}</div>}
                    {cliente.email && <div>✉️ {cliente.email}</div>}
                    {cliente.telefono && <div>📞 {cliente.telefono}</div>}
                    {cliente.ciudad && <div>📍 {cliente.ciudad}, {cliente.pais}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(cliente)}
                    className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(cliente.id)}
                    className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Nuevo/Editar Cliente */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingCliente(null);
        }}
        title={editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Código"
              value={formData.codigo}
              onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
              placeholder="CLI-001"
              disabled={!!editingCliente}
            />
            <Select
              label="Tipo"
              value={formData.tipo}
              onChange={(e) => setFormData({ ...formData, tipo: e.target.value as 'persona' | 'empresa' })}
              options={[
                { value: 'persona', label: 'Persona' },
                { value: 'empresa', label: 'Empresa' },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nombre"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              placeholder="Nombre completo"
            />
            <Input
              label="RUT/CI"
              value={formData.rut}
              onChange={(e) => setFormData({ ...formData, rut: e.target.value })}
              placeholder="12345678-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@ejemplo.com"
            />
            <Input
              label="Teléfono"
              value={formData.telefono}
              onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
              placeholder="+598 99 123 456"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Ciudad"
              value={formData.ciudad}
              onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
              placeholder="Montevideo"
            />
            <Input
              label="Límite de Crédito"
              type="number"
              value={formData.limiteCredito}
              onChange={(e) => setFormData({ ...formData, limiteCredito: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
            />
          </div>
          <Input
            label="Dirección"
            value={formData.direccion}
            onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
            placeholder="Dirección completa"
          />
          <Input
            label="Notas"
            value={formData.notas}
            onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
            placeholder="Notas adicionales..."
          />
        </div>
        <div className="flex gap-3 mt-6">
          <Button variant="secondary" onClick={() => setShowModal(false)} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} className="flex-1">
            {editingCliente ? 'Guardar Cambios' : 'Crear Cliente'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ============================================
// ÓRDENES DE VENTA PANEL
// ============================================

interface OrdenesVentaPanelProps {
  products: Product[];
  userEmail: string;
}

export function OrdenesVentaPanel({ products, userEmail }: OrdenesVentaPanelProps) {
  const [ordenes, setOrdenes] = useState<OrdenVenta[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewOrden, setShowNewOrden] = useState(false);
  const [expandedOrden, setExpandedOrden] = useState<string | null>(null);

  // Form state
  const [selectedCliente, setSelectedCliente] = useState<string>('');
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [ordenItems, setOrdenItems] = useState<Array<{
    productoCodigo: string;
    cantidad: number;
    precioUnitario: number;
  }>>([]);
  const [metodoPago, setMetodoPago] = useState('');
  const [notas, setNotas] = useState('');
  const [direccionEnvio, setDireccionEnvio] = useState('');

  useEffect(() => {
    fetchOrdenes();
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    const { data } = await supabase
      .from('clientes')
      .select('*')
      .eq('activo', true)
      .order('nombre');

    if (data) {
      setClientes(data.map(c => ({
        id: c.id,
        codigo: c.codigo,
        tipo: c.tipo,
        nombre: c.nombre,
        rut: c.rut,
        email: c.email,
        telefono: c.telefono,
        direccion: c.direccion,
        ciudad: c.ciudad,
        pais: c.pais,
        notas: c.notas,
        limiteCredito: parseFloat(c.limite_credito) || 0,
        saldoPendiente: parseFloat(c.saldo_pendiente) || 0,
        activo: c.activo,
      })));
    }
  };

  const fetchOrdenes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ordenes_venta')
      .select(`
        *,
        clientes (id, codigo, nombre),
        ordenes_venta_items (*)
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setOrdenes(data.map(o => ({
        id: o.id,
        numero: o.numero,
        clienteId: o.cliente_id,
        cliente: o.clientes ? {
          id: o.clientes.id,
          codigo: o.clientes.codigo,
          nombre: o.clientes.nombre,
        } as Cliente : undefined,
        estado: o.estado as OrdenVentaEstado,
        fechaOrden: new Date(o.fecha_orden),
        fechaEntregaEsperada: o.fecha_entrega_esperada ? new Date(o.fecha_entrega_esperada) : undefined,
        fechaEntregada: o.fecha_entregada ? new Date(o.fecha_entregada) : undefined,
        subtotal: parseFloat(o.subtotal) || 0,
        descuento: parseFloat(o.descuento) || 0,
        impuestos: parseFloat(o.impuestos) || 0,
        total: parseFloat(o.total) || 0,
        moneda: o.moneda,
        metodoPago: o.metodo_pago,
        pagado: o.pagado,
        notas: o.notas,
        direccionEnvio: o.direccion_envio,
        creadoPor: o.creado_por,
        items: o.ordenes_venta_items?.map((i: any) => ({
          id: i.id,
          ordenId: i.orden_id,
          productoCodigo: i.producto_codigo,
          cantidad: i.cantidad,
          precioUnitario: parseFloat(i.precio_unitario),
          descuentoItem: parseFloat(i.descuento_item) || 0,
          subtotal: parseFloat(i.subtotal),
          notas: i.notas,
        })),
      })));
    }
    setLoading(false);
  };

  const generarNumeroOrden = async (): Promise<string> => {
    const { data } = await supabase.rpc('generar_numero_orden_venta');
    return data || `OV-${Date.now()}`;
  };

  const handleCrearOrden = async () => {
    if (!selectedCliente || ordenItems.length === 0) {
      alert('Selecciona un cliente y agrega al menos un producto');
      return;
    }

    // Verificar stock
    for (const item of ordenItems) {
      const product = products.find(p => p.codigo === item.productoCodigo);
      if (product && product.stock < item.cantidad) {
        alert(`Stock insuficiente para ${product.descripcion}. Disponible: ${product.stock}`);
        return;
      }
    }

    const numero = await generarNumeroOrden();
    const subtotal = ordenItems.reduce((sum, item) => sum + (item.cantidad * item.precioUnitario), 0);
    const total = subtotal;

    // Crear orden
    const { data: ordenData, error: ordenError } = await supabase
      .from('ordenes_venta')
      .insert({
        numero,
        cliente_id: selectedCliente,
        estado: 'borrador',
        fecha_entrega_esperada: fechaEntrega || null,
        subtotal,
        total,
        metodo_pago: metodoPago || null,
        notas: notas || null,
        direccion_envio: direccionEnvio || null,
        creado_por: userEmail,
      })
      .select()
      .single();

    if (ordenError || !ordenData) {
      alert('Error al crear la orden');
      return;
    }

    // Crear items
    const itemsToInsert = ordenItems.map(item => ({
      orden_id: ordenData.id,
      producto_codigo: item.productoCodigo,
      cantidad: item.cantidad,
      precio_unitario: item.precioUnitario,
      subtotal: item.cantidad * item.precioUnitario,
    }));

    await supabase.from('ordenes_venta_items').insert(itemsToInsert);

    // Reset form
    setShowNewOrden(false);
    setSelectedCliente('');
    setFechaEntrega('');
    setOrdenItems([]);
    setMetodoPago('');
    setNotas('');
    setDireccionEnvio('');
    fetchOrdenes();
  };

  const handleCambiarEstado = async (ordenId: string, nuevoEstado: OrdenVentaEstado) => {
    const orden = ordenes.find(o => o.id === ordenId);
    if (!orden) return;

    const updateData: any = { estado: nuevoEstado, updated_at: new Date().toISOString() };
    
    if (nuevoEstado === 'entregada') {
      updateData.fecha_entregada = new Date().toISOString().split('T')[0];
    }

    await supabase.from('ordenes_venta').update(updateData).eq('id', ordenId);

    // Si se confirma la orden, descontar stock
    if (nuevoEstado === 'confirmada' && orden.items) {
      for (const item of orden.items) {
        const { data: productData } = await supabase
          .from('productos')
          .select('id, stock')
          .eq('codigo', item.productoCodigo)
          .single();

        if (productData) {
          // Insertar movimiento de salida
          await supabase.from('movimientos').insert({
            producto_id: productData.id,
            codigo: item.productoCodigo,
            tipo: 'salida',
            cantidad: item.cantidad,
            notas: `Venta OV: ${orden.numero}`,
            usuario_email: userEmail,
          });

          // Actualizar stock
          await supabase
            .from('productos')
            .update({ stock: Math.max(0, productData.stock - item.cantidad) })
            .eq('codigo', item.productoCodigo);
        }
      }
    }

    fetchOrdenes();
  };

  const addItem = () => {
    setOrdenItems([...ordenItems, { productoCodigo: '', cantidad: 1, precioUnitario: 0 }]);
  };

  const removeItem = (index: number) => {
    setOrdenItems(ordenItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...ordenItems];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-fill price from product
    if (field === 'productoCodigo') {
      const product = products.find(p => p.codigo === value);
      if (product) {
        updated[index].precioUnitario = product.precio;
      }
    }
    
    setOrdenItems(updated);
  };

  const getEstadoConfig = (estado: OrdenVentaEstado) => {
    switch (estado) {
      case 'borrador':
        return { color: 'text-slate-400', bg: 'bg-slate-500/20', icon: FileText, label: 'Borrador' };
      case 'confirmada':
        return { color: 'text-cyan-400', bg: 'bg-cyan-500/20', icon: CheckCircle, label: 'Confirmada' };
      case 'en_proceso':
        return { color: 'text-amber-400', bg: 'bg-amber-500/20', icon: Package, label: 'En Proceso' };
      case 'enviada':
        return { color: 'text-violet-400', bg: 'bg-violet-500/20', icon: Send, label: 'Enviada' };
      case 'entregada':
        return { color: 'text-emerald-400', bg: 'bg-emerald-500/20', icon: CheckCircle, label: 'Entregada' };
      case 'cancelada':
        return { color: 'text-red-400', bg: 'bg-red-500/20', icon: XCircle, label: 'Cancelada' };
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="text-violet-400" size={24} />
          <h2 className="text-lg font-semibold">Órdenes de Venta</h2>
          <span className="text-sm text-slate-500">({ordenes.length})</span>
        </div>
        <Button onClick={() => setShowNewOrden(true)}>
          <Plus size={18} className="mr-2" />
          Nueva Venta
        </Button>
      </div>

      {/* Lista de órdenes */}
      {loading ? (
        <div className="text-center py-8 text-slate-500">Cargando órdenes...</div>
      ) : ordenes.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <ShoppingCart size={48} className="mx-auto mb-2 opacity-50" />
          No hay órdenes de venta
        </div>
      ) : (
        <div className="space-y-3">
          {ordenes.map((orden) => {
            const estadoConfig = getEstadoConfig(orden.estado);
            const EstadoIcon = estadoConfig.icon;
            const isExpanded = expandedOrden === orden.id;

            return (
              <div
                key={orden.id}
                className="rounded-xl bg-slate-900/50 border border-slate-800/50 overflow-hidden"
              >
                <div
                  className="p-4 cursor-pointer hover:bg-slate-800/30 transition-colors"
                  onClick={() => setExpandedOrden(isExpanded ? null : orden.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn('p-2 rounded-lg', estadoConfig.bg)}>
                        <EstadoIcon size={20} className={estadoConfig.color} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold">{orden.numero}</span>
                          <span className={cn('px-2 py-0.5 rounded text-xs font-medium', estadoConfig.bg, estadoConfig.color)}>
                            {estadoConfig.label}
                          </span>
                          {orden.pagado && (
                            <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-400">
                              Pagado
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-400">
                          {orden.cliente?.nombre || 'Sin cliente'} • {formatDate(orden.fechaOrden)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-semibold text-emerald-400">
                          {formatCurrency(orden.total)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {orden.items?.length || 0} items
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-800/50 p-4 bg-slate-950/50">
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-slate-400 mb-2">Productos</h4>
                      <div className="space-y-2">
                        {orden.items?.map((item) => {
                          const product = products.find(p => p.codigo === item.productoCodigo);
                          return (
                            <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30">
                              <div>
                                <span className="font-mono text-xs text-slate-500">{item.productoCodigo}</span>
                                <span className="ml-2">{product?.descripcion || item.productoCodigo}</span>
                              </div>
                              <div className="flex items-center gap-4 text-sm">
                                <span>{item.cantidad} unidades</span>
                                <span className="text-slate-400">{formatCurrency(item.precioUnitario)}/u</span>
                                <span className="font-semibold">{formatCurrency(item.subtotal)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {orden.estado === 'borrador' && (
                        <>
                          <Button onClick={() => handleCambiarEstado(orden.id, 'confirmada')}>
                            <CheckCircle size={16} className="mr-2" />
                            Confirmar
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => handleCambiarEstado(orden.id, 'cancelada')}
                          >
                            <XCircle size={16} className="mr-2" />
                            Cancelar
                          </Button>
                        </>
                      )}
                      {orden.estado === 'confirmada' && (
                        <Button onClick={() => handleCambiarEstado(orden.id, 'en_proceso')}>
                          <Package size={16} className="mr-2" />
                          En Proceso
                        </Button>
                      )}
                      {orden.estado === 'en_proceso' && (
                        <Button onClick={() => handleCambiarEstado(orden.id, 'enviada')}>
                          <Send size={16} className="mr-2" />
                          Marcar Enviada
                        </Button>
                      )}
                      {orden.estado === 'enviada' && (
                        <Button onClick={() => handleCambiarEstado(orden.id, 'entregada')}>
                          <CheckCircle size={16} className="mr-2" />
                          Marcar Entregada
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Nueva Orden */}
      <Modal
        isOpen={showNewOrden}
        onClose={() => setShowNewOrden(false)}
        title="Nueva Orden de Venta"
      >
        <div className="space-y-4">
          <Select
            label="Cliente"
            value={selectedCliente}
            onChange={(e) => {
              setSelectedCliente(e.target.value);
              const cliente = clientes.find(c => c.id === e.target.value);
              if (cliente?.direccion) {
                setDireccionEnvio(cliente.direccion);
              }
            }}
            options={clientes.map(c => ({ value: c.id, label: `${c.codigo} - ${c.nombre}` }))}
            placeholder="Seleccionar cliente..."
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Fecha de Entrega"
              type="date"
              value={fechaEntrega}
              onChange={(e) => setFechaEntrega(e.target.value)}
            />
            <Select
              label="Método de Pago"
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value)}
              options={[
                { value: 'efectivo', label: 'Efectivo' },
                { value: 'transferencia', label: 'Transferencia' },
                { value: 'tarjeta', label: 'Tarjeta' },
                { value: 'credito', label: 'Crédito' },
              ]}
              placeholder="Seleccionar..."
            />
          </div>

          <Input
            label="Dirección de Envío"
            value={direccionEnvio}
            onChange={(e) => setDireccionEnvio(e.target.value)}
            placeholder="Dirección de entrega"
          />

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-slate-400">Productos</label>
              <button
                onClick={addItem}
                className="text-sm text-violet-400 hover:text-violet-300"
              >
                + Agregar producto
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {ordenItems.map((item, index) => {
                const product = products.find(p => p.codigo === item.productoCodigo);
                return (
                  <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/30">
                    <select
                      value={item.productoCodigo}
                      onChange={(e) => updateItem(index, 'productoCodigo', e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm"
                    >
                      <option value="">Seleccionar producto...</option>
                      {products.map(p => (
                        <option key={p.codigo} value={p.codigo}>
                          {p.codigo} - {p.descripcion} (Stock: {p.stock})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={item.cantidad}
                      onChange={(e) => updateItem(index, 'cantidad', parseInt(e.target.value) || 0)}
                      className="w-20 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm"
                      placeholder="Cant."
                      min="1"
                      max={product?.stock || 999}
                    />
                    <input
                      type="number"
                      value={item.precioUnitario}
                      onChange={(e) => updateItem(index, 'precioUnitario', parseFloat(e.target.value) || 0)}
                      className="w-28 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm"
                      placeholder="Precio/u"
                      step="0.01"
                    />
                    <button
                      onClick={() => removeItem(index)}
                      className="p-2 text-red-400 hover:text-red-300"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>

            {ordenItems.length > 0 && (
              <div className="mt-2 text-right text-sm">
                <span className="text-slate-400">Total: </span>
                <span className="font-semibold text-emerald-400">
                  {formatCurrency(ordenItems.reduce((sum, item) => sum + (item.cantidad * item.precioUnitario), 0))}
                </span>
              </div>
            )}
          </div>

          <Input
            label="Notas"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Notas adicionales..."
          />
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="secondary" onClick={() => setShowNewOrden(false)} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleCrearOrden} className="flex-1">
            Crear Venta
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ============================================
// VENTAS DASHBOARD (Componente principal)
// ============================================

interface VentasDashboardProps {
  products: Product[];
  userEmail: string;
}

export function VentasDashboard({ products, userEmail }: VentasDashboardProps) {
  const [activeView, setActiveView] = useState<'ordenes' | 'clientes'>('ordenes');

  return (
    <div className="space-y-6">
      <div className="flex gap-2 p-1 bg-slate-900/50 rounded-xl w-fit">
        <button
          onClick={() => setActiveView('ordenes')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
            activeView === 'ordenes'
              ? 'bg-slate-800 text-violet-400'
              : 'text-slate-400 hover:text-slate-200'
          )}
        >
          <ShoppingCart size={18} />
          Órdenes de Venta
        </button>
        <button
          onClick={() => setActiveView('clientes')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
            activeView === 'clientes'
              ? 'bg-slate-800 text-cyan-400'
              : 'text-slate-400 hover:text-slate-200'
          )}
        >
          <Users size={18} />
          Clientes
        </button>
      </div>

      {activeView === 'ordenes' ? (
        <OrdenesVentaPanel products={products} userEmail={userEmail} />
      ) : (
        <ClientesPanel />
      )}
    </div>
  );
}