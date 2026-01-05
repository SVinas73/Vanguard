'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { Proveedor, OrdenCompra, OrdenCompraItem, Product, OrdenCompraEstado } from '@/types';
import { Button, Input, Select, Modal, Card } from '@/components/ui';
import { 
  Plus, 
  Truck, 
  Package, 
  FileText, 
  Search, 
  Edit, 
  Trash2, 
  Send, 
  CheckCircle, 
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

// ============================================
// PROVEEDORES PANEL
// ============================================

interface ProveedoresPanelProps {
  onSelectProveedor?: (proveedor: Proveedor) => void;
}

export function ProveedoresPanel({ onSelectProveedor }: ProveedoresPanelProps) {
  const { t } = useTranslation();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState<Proveedor | null>(null);
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    nombreContacto: '',
    email: '',
    telefono: '',
    direccion: '',
    ciudad: '',
    pais: 'Uruguay',
    notas: '',
  });

  useEffect(() => {
    fetchProveedores();
  }, []);

  const fetchProveedores = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('proveedores')
      .select('*')
      .eq('activo', true)
      .order('nombre');

    if (!error && data) {
      setProveedores(data.map(p => ({
        id: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        nombreContacto: p.nombre_contacto,
        email: p.email,
        telefono: p.telefono,
        direccion: p.direccion,
        ciudad: p.ciudad,
        pais: p.pais,
        notas: p.notas,
        activo: p.activo,
      })));
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!formData.codigo || !formData.nombre) return;

    const proveedorData = {
      codigo: formData.codigo.toUpperCase(),
      nombre: formData.nombre,
      nombre_contacto: formData.nombreContacto || null,
      email: formData.email || null,
      telefono: formData.telefono || null,
      direccion: formData.direccion || null,
      ciudad: formData.ciudad || null,
      pais: formData.pais,
      notas: formData.notas || null,
    };

    if (editingProveedor) {
      await supabase
        .from('proveedores')
        .update({ ...proveedorData, updated_at: new Date().toISOString() })
        .eq('id', editingProveedor.id);
    } else {
      await supabase.from('proveedores').insert(proveedorData);
    }

    setShowModal(false);
    setEditingProveedor(null);
    setFormData({
      codigo: '',
      nombre: '',
      nombreContacto: '',
      email: '',
      telefono: '',
      direccion: '',
      ciudad: '',
      pais: 'Uruguay',
      notas: '',
    });
    fetchProveedores();
  };

  const handleEdit = (proveedor: Proveedor) => {
    setEditingProveedor(proveedor);
    setFormData({
      codigo: proveedor.codigo,
      nombre: proveedor.nombre,
      nombreContacto: proveedor.nombreContacto || '',
      email: proveedor.email || '',
      telefono: proveedor.telefono || '',
      direccion: proveedor.direccion || '',
      ciudad: proveedor.ciudad || '',
      pais: proveedor.pais,
      notas: proveedor.notas || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('purchases.deactivateSupplier'))) return;
    await supabase.from('proveedores').update({ activo: false }).eq('id', id);
    fetchProveedores();
  };

  const filteredProveedores = proveedores.filter(p =>
    p.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.codigo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="text-emerald-400" size={24} />
          <h2 className="text-lg font-semibold">{t('purchases.suppliers')}</h2>
          <span className="text-sm text-slate-500">({proveedores.length})</span>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={18} className="mr-2" />
          {t('purchases.newSupplier')}
        </Button>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder={t('purchases.searchSuppliers')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/50 border border-slate-800/50 focus:border-emerald-500/50 focus:outline-none text-sm"
        />
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-500">{t('purchases.loadingSuppliers')}</div>
      ) : filteredProveedores.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <Truck size={48} className="mx-auto mb-2 opacity-50" />
          {t('purchases.noSuppliers')}
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredProveedores.map((proveedor) => (
            <div
              key={proveedor.id}
              className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50 hover:border-slate-700/50 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-500">{proveedor.codigo}</span>
                    <span className="font-semibold">{proveedor.nombre}</span>
                  </div>
                  <div className="mt-1 text-sm text-slate-400 space-y-0.5">
                    {proveedor.nombreContacto && <div>👤 {proveedor.nombreContacto}</div>}
                    {proveedor.email && <div>✉️ {proveedor.email}</div>}
                    {proveedor.telefono && <div>📞 {proveedor.telefono}</div>}
                    {proveedor.ciudad && <div>📍 {proveedor.ciudad}, {proveedor.pais}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {onSelectProveedor && (
                    <Button variant="secondary" onClick={() => onSelectProveedor(proveedor)}>
                      {t('common.select')}
                    </Button>
                  )}
                  <button
                    onClick={() => handleEdit(proveedor)}
                    className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(proveedor.id)}
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

      {/* Modal Nuevo/Editar Proveedor */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingProveedor(null);
        }}
        title={editingProveedor ? t('purchases.editSupplier') : t('purchases.newSupplier')}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('stock.code')}
              value={formData.codigo}
              onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
              placeholder="PROV-001"
              disabled={!!editingProveedor}
            />
            <Input
              label={t('stock.description')}
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              placeholder={t('purchases.supplier')}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('purchases.contact')}
              value={formData.nombreContacto}
              onChange={(e) => setFormData({ ...formData, nombreContacto: e.target.value })}
              placeholder={t('purchases.contact')}
            />
            <Input
              label={t('purchases.email')}
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@ejemplo.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('purchases.phone')}
              value={formData.telefono}
              onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
              placeholder="+598 99 123 456"
            />
            <Input
              label={t('purchases.city')}
              value={formData.ciudad}
              onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
              placeholder={t('purchases.city')}
            />
          </div>
          <Input
            label={t('purchases.address')}
            value={formData.direccion}
            onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
            placeholder={t('purchases.address')}
          />
          <Input
            label={t('purchases.notes')}
            value={formData.notas}
            onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
            placeholder={t('purchases.notes')}
          />
        </div>
        <div className="flex gap-3 mt-6">
          <Button variant="secondary" onClick={() => setShowModal(false)} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} className="flex-1">
            {editingProveedor ? t('common.save') : t('purchases.createSupplier')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ============================================
// ÓRDENES DE COMPRA PANEL
// ============================================

interface OrdenesCompraPanelProps {
  products: Product[];
  userEmail: string;
}

export function OrdenesCompraPanel({ products, userEmail }: OrdenesCompraPanelProps) {
  const { t } = useTranslation();
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewOrden, setShowNewOrden] = useState(false);
  const [selectedOrden, setSelectedOrden] = useState<OrdenCompra | null>(null);
  const [expandedOrden, setExpandedOrden] = useState<string | null>(null);

  // Form state para nueva orden
  const [selectedProveedor, setSelectedProveedor] = useState<string>('');
  const [fechaEsperada, setFechaEsperada] = useState('');
  const [ordenItems, setOrdenItems] = useState<Array<{
    productoCodigo: string;
    cantidad: number;
    costoUnitario: number;
  }>>([]);
  const [notas, setNotas] = useState('');

  useEffect(() => {
    fetchOrdenes();
    fetchProveedores();
  }, []);

  const fetchProveedores = async () => {
    const { data } = await supabase
      .from('proveedores')
      .select('*')
      .eq('activo', true)
      .order('nombre');

    if (data) {
      setProveedores(data.map(p => ({
        id: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        nombreContacto: p.nombre_contacto,
        email: p.email,
        telefono: p.telefono,
        direccion: p.direccion,
        ciudad: p.ciudad,
        pais: p.pais,
        notas: p.notas,
        activo: p.activo,
      })));
    }
  };

  const fetchOrdenes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ordenes_compra')
      .select(`
        *,
        proveedores (id, codigo, nombre),
        ordenes_compra_items (*)
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setOrdenes(data.map(o => ({
        id: o.id,
        numero: o.numero,
        proveedorId: o.proveedor_id,
        proveedor: o.proveedores ? {
          id: o.proveedores.id,
          codigo: o.proveedores.codigo,
          nombre: o.proveedores.nombre,
        } as Proveedor : undefined,
        estado: o.estado as OrdenCompraEstado,
        fechaOrden: new Date(o.fecha_orden),
        fechaEsperada: o.fecha_esperada ? new Date(o.fecha_esperada) : undefined,
        fechaRecibida: o.fecha_recibida ? new Date(o.fecha_recibida) : undefined,
        subtotal: parseFloat(o.subtotal) || 0,
        impuestos: parseFloat(o.impuestos) || 0,
        total: parseFloat(o.total) || 0,
        moneda: o.moneda,
        notas: o.notas,
        creadoPor: o.creado_por,
        items: o.ordenes_compra_items?.map((i: any) => ({
          id: i.id,
          ordenId: i.orden_id,
          productoCodigo: i.producto_codigo,
          cantidadOrdenada: i.cantidad_ordenada,
          cantidadRecibida: i.cantidad_recibida,
          costoUnitario: parseFloat(i.costo_unitario),
          subtotal: parseFloat(i.subtotal),
          notas: i.notas,
        })),
      })));
    }
    setLoading(false);
  };

  const generarNumeroOrden = async (): Promise<string> => {
    const { data } = await supabase.rpc('generar_numero_orden');
    return data || `OC-${Date.now()}`;
  };

  const handleCrearOrden = async () => {
    if (!selectedProveedor || ordenItems.length === 0) {
      alert(t('warehouses.selectOriginDestination'));
      return;
    }

    const numero = await generarNumeroOrden();
    const subtotal = ordenItems.reduce((sum, item) => sum + (item.cantidad * item.costoUnitario), 0);
    const total = subtotal;

    // Crear orden
    const { data: ordenData, error: ordenError } = await supabase
      .from('ordenes_compra')
      .insert({
        numero,
        proveedor_id: selectedProveedor,
        estado: 'borrador',
        fecha_esperada: fechaEsperada || null,
        subtotal,
        total,
        notas: notas || null,
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
      cantidad_ordenada: item.cantidad,
      costo_unitario: item.costoUnitario,
      subtotal: item.cantidad * item.costoUnitario,
    }));

    await supabase.from('ordenes_compra_items').insert(itemsToInsert);

    // Reset form
    setShowNewOrden(false);
    setSelectedProveedor('');
    setFechaEsperada('');
    setOrdenItems([]);
    setNotas('');
    fetchOrdenes();
  };

  const handleCambiarEstado = async (ordenId: string, nuevoEstado: OrdenCompraEstado) => {
    const updateData: any = { estado: nuevoEstado, updated_at: new Date().toISOString() };
    
    if (nuevoEstado === 'recibida') {
      updateData.fecha_recibida = new Date().toISOString().split('T')[0];
    }

    await supabase.from('ordenes_compra').update(updateData).eq('id', ordenId);

    // Si se recibe la orden, actualizar el stock
    if (nuevoEstado === 'recibida') {
      const orden = ordenes.find(o => o.id === ordenId);
      if (orden?.items) {
        for (const item of orden.items) {
          // Actualizar cantidad recibida
          await supabase
            .from('ordenes_compra_items')
            .update({ cantidad_recibida: item.cantidadOrdenada })
            .eq('id', item.id);

          // Crear movimiento de entrada
          const { data: productData } = await supabase
            .from('productos')
            .select('id, stock')
            .eq('codigo', item.productoCodigo)
            .single();

          if (productData) {
            // Insertar movimiento
            await supabase.from('movimientos').insert({
              producto_id: productData.id,
              codigo: item.productoCodigo,
              tipo: 'entrada',
              cantidad: item.cantidadOrdenada,
              costo_compra: item.costoUnitario,
              notas: `Recepción OC: ${orden.numero}`,
              usuario_email: userEmail,
            });

            // Actualizar stock
            await supabase
              .from('productos')
              .update({ stock: productData.stock + item.cantidadOrdenada })
              .eq('codigo', item.productoCodigo);

            // Crear lote
            await supabase.from('lotes').insert({
              codigo: item.productoCodigo,
              cantidad_inicial: item.cantidadOrdenada,
              cantidad_disponible: item.cantidadOrdenada,
              costo_unitario: item.costoUnitario,
              usuario: userEmail,
              notas: `OC: ${orden.numero}`,
            });
          }
        }
      }
    }

    fetchOrdenes();
  };

  const addItem = () => {
    setOrdenItems([...ordenItems, { productoCodigo: '', cantidad: 1, costoUnitario: 0 }]);
  };

  const removeItem = (index: number) => {
    setOrdenItems(ordenItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...ordenItems];
    updated[index] = { ...updated[index], [field]: value };
    setOrdenItems(updated);
  };

  const getEstadoConfig = (estado: OrdenCompraEstado) => {
    switch (estado) {
      case 'borrador':
        return { color: 'text-slate-400', bg: 'bg-slate-500/20', icon: FileText, label: t('purchases.states.draft') };
      case 'enviada':
        return { color: 'text-cyan-400', bg: 'bg-cyan-500/20', icon: Send, label: t('purchases.states.sent') };
      case 'parcial':
        return { color: 'text-amber-400', bg: 'bg-amber-500/20', icon: Clock, label: t('purchases.states.partial') };
      case 'recibida':
        return { color: 'text-emerald-400', bg: 'bg-emerald-500/20', icon: CheckCircle, label: t('purchases.states.received') };
      case 'cancelada':
        return { color: 'text-red-400', bg: 'bg-red-500/20', icon: XCircle, label: t('purchases.states.cancelled') };
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="text-cyan-400" size={24} />
          <h2 className="text-lg font-semibold">{t('purchases.purchaseOrders')}</h2>
          <span className="text-sm text-slate-500">({ordenes.length})</span>
        </div>
        <Button onClick={() => setShowNewOrden(true)}>
          <Plus size={18} className="mr-2" />
          {t('purchases.newOrder')}
        </Button>
      </div>

      {/* Lista de órdenes */}
      {loading ? (
        <div className="text-center py-8 text-slate-500">{t('purchases.loadingOrders')}</div>
      ) : ordenes.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <FileText size={48} className="mx-auto mb-2 opacity-50" />
          {t('purchases.noOrders')}
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
                {/* Header de la orden */}
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
                        </div>
                        <div className="text-sm text-slate-400">
                          {orden.proveedor?.nombre || t('purchases.supplier')} • {formatDate(orden.fechaOrden)}
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

                {/* Detalles expandidos */}
                {isExpanded && (
                  <div className="border-t border-slate-800/50 p-4 bg-slate-950/50">
                    {/* Items */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-slate-400 mb-2">{t('purchases.products')}</h4>
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
                                <span>{item.cantidadRecibida}/{item.cantidadOrdenada} {t('purchases.received')}</span>
                                <span className="text-slate-400">{formatCurrency(item.costoUnitario)}/u</span>
                                <span className="font-semibold">{formatCurrency(item.subtotal)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="flex gap-2">
                      {orden.estado === 'borrador' && (
                        <>
                          <Button
                            variant="secondary"
                            onClick={() => handleCambiarEstado(orden.id, 'enviada')}
                          >
                            <Send size={16} className="mr-2" />
                            {t('purchases.markAsSent')}
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => handleCambiarEstado(orden.id, 'cancelada')}
                          >
                            <XCircle size={16} className="mr-2" />
                            {t('common.cancel')}
                          </Button>
                        </>
                      )}
                      {orden.estado === 'enviada' && (
                        <Button onClick={() => handleCambiarEstado(orden.id, 'recibida')}>
                          <CheckCircle size={16} className="mr-2" />
                          {t('purchases.markAsReceived')}
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
        title={t('purchases.newOrder')}
      >
        <div className="space-y-4">
          <Select
            label={t('purchases.supplier')}
            value={selectedProveedor}
            onChange={(e) => setSelectedProveedor(e.target.value)}
            options={proveedores.map(p => ({ value: p.id, label: `${p.codigo} - ${p.nombre}` }))}
            placeholder={t('purchases.selectSupplier')}
          />

          <Input
            label={t('purchases.expectedDate')}
            type="date"
            value={fechaEsperada}
            onChange={(e) => setFechaEsperada(e.target.value)}
          />

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-slate-400">{t('purchases.products')}</label>
              <button
                onClick={addItem}
                className="text-sm text-emerald-400 hover:text-emerald-300"
              >
                {t('purchases.addProduct')}
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {ordenItems.map((item, index) => (
                <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/30">
                  <select
                    value={item.productoCodigo}
                    onChange={(e) => updateItem(index, 'productoCodigo', e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm"
                  >
                    <option value="">{t('purchases.selectProduct')}</option>
                    {products.map(p => (
                      <option key={p.codigo} value={p.codigo}>
                        {p.codigo} - {p.descripcion}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={item.cantidad}
                    onChange={(e) => updateItem(index, 'cantidad', parseInt(e.target.value) || 0)}
                    className="w-20 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm"
                    placeholder={t('purchases.quantity')}
                    min="1"
                  />
                  <input
                    type="number"
                    value={item.costoUnitario}
                    onChange={(e) => updateItem(index, 'costoUnitario', parseFloat(e.target.value) || 0)}
                    className="w-28 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm"
                    placeholder={t('purchases.unitCost')}
                    step="0.01"
                  />
                  <button
                    onClick={() => removeItem(index)}
                    className="p-2 text-red-400 hover:text-red-300"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            {ordenItems.length > 0 && (
              <div className="mt-2 text-right text-sm">
                <span className="text-slate-400">{t('common.total')}: </span>
                <span className="font-semibold text-emerald-400">
                  {formatCurrency(ordenItems.reduce((sum, item) => sum + (item.cantidad * item.costoUnitario), 0))}
                </span>
              </div>
            )}
          </div>

          <Input
            label={t('purchases.notes')}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder={t('purchases.notes')}
          />
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="secondary" onClick={() => setShowNewOrden(false)} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button onClick={handleCrearOrden} className="flex-1">
            {t('purchases.createOrder')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ============================================
// COMPRAS DASHBOARD (Componente principal)
// ============================================

interface ComprasDashboardProps {
  products: Product[];
  userEmail: string;
}

export function ComprasDashboard({ products, userEmail }: ComprasDashboardProps) {
  const { t } = useTranslation();
  const [activeView, setActiveView] = useState<'ordenes' | 'proveedores'>('ordenes');

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-900/50 rounded-xl w-fit">
        <button
          onClick={() => setActiveView('ordenes')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
            activeView === 'ordenes'
              ? 'bg-slate-800 text-cyan-400'
              : 'text-slate-400 hover:text-slate-200'
          )}
        >
          <FileText size={18} />
          {t('purchases.purchaseOrders')}
        </button>
        <button
          onClick={() => setActiveView('proveedores')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
            activeView === 'proveedores'
              ? 'bg-slate-800 text-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          )}
        >
          <Truck size={18} />
          {t('purchases.suppliers')}
        </button>
      </div>

      {/* Content */}
      {activeView === 'ordenes' ? (
        <OrdenesCompraPanel products={products} userEmail={userEmail} />
      ) : (
        <ProveedoresPanel />
      )}
    </div>
  );
}