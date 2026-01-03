'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Almacen, Transferencia, TransferenciaEstado, Product } from '@/types';
import { Button, Input, Select, Modal } from '@/components/ui';
import { 
  Plus, Warehouse, ArrowRightLeft, MapPin, Phone, User,
  Edit, Trash2, CheckCircle, XCircle, Clock, Truck,
  ChevronDown, ChevronUp, Package, Search
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

// ============================================
// ALMACENES PANEL
// ============================================

export function AlmacenesPanel() {
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Almacen | null>(null);
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    direccion: '',
    ciudad: '',
    telefono: '',
    responsable: '',
  });

  useEffect(() => {
    fetchAlmacenes();
  }, []);

  const fetchAlmacenes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('almacenes')
      .select('*')
      .eq('activo', true)
      .order('es_principal', { ascending: false });

    if (data) {
      setAlmacenes(data.map(a => ({
        id: a.id,
        codigo: a.codigo,
        nombre: a.nombre,
        direccion: a.direccion,
        ciudad: a.ciudad,
        telefono: a.telefono,
        responsable: a.responsable,
        esPrincipal: a.es_principal,
        activo: a.activo,
      })));
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!formData.codigo || !formData.nombre) return;

    const data = {
      codigo: formData.codigo.toUpperCase(),
      nombre: formData.nombre,
      direccion: formData.direccion || null,
      ciudad: formData.ciudad || null,
      telefono: formData.telefono || null,
      responsable: formData.responsable || null,
    };

    if (editing) {
      await supabase.from('almacenes').update(data).eq('id', editing.id);
    } else {
      await supabase.from('almacenes').insert(data);
    }

    setShowModal(false);
    setEditing(null);
    setFormData({ codigo: '', nombre: '', direccion: '', ciudad: '', telefono: '', responsable: '' });
    fetchAlmacenes();
  };

  const handleEdit = (almacen: Almacen) => {
    setEditing(almacen);
    setFormData({
      codigo: almacen.codigo,
      nombre: almacen.nombre,
      direccion: almacen.direccion || '',
      ciudad: almacen.ciudad || '',
      telefono: almacen.telefono || '',
      responsable: almacen.responsable || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Desactivar este almacén?')) return;
    await supabase.from('almacenes').update({ activo: false }).eq('id', id);
    fetchAlmacenes();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Warehouse className="text-amber-400" size={24} />
          <h2 className="text-lg font-semibold">Almacenes</h2>
          <span className="text-sm text-slate-500">({almacenes.length})</span>
        </div>
        <Button onClick={() => { setEditing(null); setFormData({ codigo: '', nombre: '', direccion: '', ciudad: '', telefono: '', responsable: '' }); setShowModal(true); }}>
          <Plus size={18} className="mr-2" />
          Nuevo Almacén
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-500">Cargando...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {almacenes.map((almacen) => (
            <div
              key={almacen.id}
              className={cn(
                'p-4 rounded-xl border transition-all',
                almacen.esPrincipal 
                  ? 'bg-amber-500/10 border-amber-500/30' 
                  : 'bg-slate-900/50 border-slate-800/50'
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Warehouse size={20} className={almacen.esPrincipal ? 'text-amber-400' : 'text-slate-400'} />
                  <div>
                    <div className="font-semibold">{almacen.nombre}</div>
                    <div className="text-xs text-slate-500 font-mono">{almacen.codigo}</div>
                  </div>
                </div>
                {almacen.esPrincipal && (
                  <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400">
                    Principal
                  </span>
                )}
              </div>

              <div className="space-y-1 text-sm text-slate-400 mb-4">
                {almacen.direccion && (
                  <div className="flex items-center gap-2">
                    <MapPin size={14} />
                    <span>{almacen.direccion}</span>
                  </div>
                )}
                {almacen.ciudad && (
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="opacity-0" />
                    <span>{almacen.ciudad}</span>
                  </div>
                )}
                {almacen.telefono && (
                  <div className="flex items-center gap-2">
                    <Phone size={14} />
                    <span>{almacen.telefono}</span>
                  </div>
                )}
                {almacen.responsable && (
                  <div className="flex items-center gap-2">
                    <User size={14} />
                    <span>{almacen.responsable}</span>
                  </div>
                )}
              </div>

              {!almacen.esPrincipal && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(almacen)}
                    className="flex-1 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors text-sm"
                  >
                    <Edit size={14} className="inline mr-1" /> Editar
                  </button>
                  <button
                    onClick={() => handleDelete(almacen.id)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar Almacén' : 'Nuevo Almacén'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Código"
              value={formData.codigo}
              onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
              placeholder="ALM-01"
              disabled={!!editing}
            />
            <Input
              label="Nombre"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              placeholder="Almacén Norte"
            />
          </div>
          <Input
            label="Dirección"
            value={formData.direccion}
            onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
            placeholder="Calle 123"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Ciudad"
              value={formData.ciudad}
              onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
              placeholder="Montevideo"
            />
            <Input
              label="Teléfono"
              value={formData.telefono}
              onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
              placeholder="+598 99 123 456"
            />
          </div>
          <Input
            label="Responsable"
            value={formData.responsable}
            onChange={(e) => setFormData({ ...formData, responsable: e.target.value })}
            placeholder="Nombre del encargado"
          />
        </div>
        <div className="flex gap-3 mt-6">
          <Button variant="secondary" onClick={() => setShowModal(false)} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} className="flex-1">
            {editing ? 'Guardar' : 'Crear'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ============================================
// TRANSFERENCIAS PANEL
// ============================================

interface TransferenciasPanelProps {
  products: Product[];
  userEmail: string;
}

export function TransferenciasPanel({ products, userEmail }: TransferenciasPanelProps) {
  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [items, setItems] = useState<Array<{ codigo: string; cantidad: number }>>([]);
  const [notas, setNotas] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    const [{ data: almData }, { data: transData }] = await Promise.all([
      supabase.from('almacenes').select('*').eq('activo', true),
      supabase.from('transferencias').select(`
        *,
        almacen_origen:almacenes!transferencias_almacen_origen_id_fkey(id, codigo, nombre),
        almacen_destino:almacenes!transferencias_almacen_destino_id_fkey(id, codigo, nombre),
        transferencias_items(*)
      `).order('created_at', { ascending: false })
    ]);

    if (almData) {
      setAlmacenes(almData.map(a => ({
        id: a.id, codigo: a.codigo, nombre: a.nombre,
        direccion: a.direccion, ciudad: a.ciudad, telefono: a.telefono,
        responsable: a.responsable, esPrincipal: a.es_principal, activo: a.activo
      })));
    }

    if (transData) {
      setTransferencias(transData.map(t => ({
        id: t.id,
        numero: t.numero,
        almacenOrigenId: t.almacen_origen_id,
        almacenOrigen: t.almacen_origen,
        almacenDestinoId: t.almacen_destino_id,
        almacenDestino: t.almacen_destino,
        estado: t.estado,
        fechaSolicitud: new Date(t.fecha_solicitud),
        fechaEnvio: t.fecha_envio ? new Date(t.fecha_envio) : undefined,
        fechaRecepcion: t.fecha_recepcion ? new Date(t.fecha_recepcion) : undefined,
        notas: t.notas,
        creadoPor: t.creado_por,
        items: t.transferencias_items?.map((i: any) => ({
          id: i.id,
          transferenciaId: i.transferencia_id,
          productoCodigo: i.producto_codigo,
          cantidadSolicitada: i.cantidad_solicitada,
          cantidadEnviada: i.cantidad_enviada,
          cantidadRecibida: i.cantidad_recibida,
        }))
      })));
    }

    setLoading(false);
  };

  const handleCreate = async () => {
    if (!origen || !destino || items.length === 0) {
      alert('Selecciona origen, destino y al menos un producto');
      return;
    }

    const { data: numData } = await supabase.rpc('generar_numero_transferencia');
    const numero = numData || `TR-${Date.now()}`;

    const { data: trans, error } = await supabase.from('transferencias').insert({
      numero,
      almacen_origen_id: origen,
      almacen_destino_id: destino,
      notas: notas || null,
      creado_por: userEmail,
    }).select().single();

    if (error || !trans) {
      alert('Error al crear transferencia');
      return;
    }

    await supabase.from('transferencias_items').insert(
      items.map(i => ({
        transferencia_id: trans.id,
        producto_codigo: i.codigo,
        cantidad_solicitada: i.cantidad,
      }))
    );

    setShowNew(false);
    setOrigen('');
    setDestino('');
    setItems([]);
    setNotas('');
    fetchData();
  };

  const handleChangeEstado = async (id: string, nuevoEstado: TransferenciaEstado) => {
    const updates: any = { estado: nuevoEstado };
    
    if (nuevoEstado === 'en_transito') {
      updates.fecha_envio = new Date().toISOString();
    } else if (nuevoEstado === 'completada') {
      updates.fecha_recepcion = new Date().toISOString();
      
      // Actualizar stock en almacenes
      const trans = transferencias.find(t => t.id === id);
      if (trans?.items) {
        for (const item of trans.items) {
          // Restar del origen
          await supabase.rpc('actualizar_stock_almacen', {
            p_producto: item.productoCodigo,
            p_almacen: trans.almacenOrigenId,
            p_cantidad: -item.cantidadSolicitada
          });
          
          // Sumar al destino
          await supabase.rpc('actualizar_stock_almacen', {
            p_producto: item.productoCodigo,
            p_almacen: trans.almacenDestinoId,
            p_cantidad: item.cantidadSolicitada
          });
        }
      }
    }

    await supabase.from('transferencias').update(updates).eq('id', id);
    fetchData();
  };

  const getEstadoConfig = (estado: TransferenciaEstado) => {
    const configs = {
      pendiente: { color: 'text-slate-400', bg: 'bg-slate-500/20', icon: Clock, label: 'Pendiente' },
      en_transito: { color: 'text-cyan-400', bg: 'bg-cyan-500/20', icon: Truck, label: 'En Tránsito' },
      completada: { color: 'text-emerald-400', bg: 'bg-emerald-500/20', icon: CheckCircle, label: 'Completada' },
      cancelada: { color: 'text-red-400', bg: 'bg-red-500/20', icon: XCircle, label: 'Cancelada' },
    };
    return configs[estado];
  };

  const addItem = () => setItems([...items, { codigo: '', cantidad: 1 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, value: any) => {
    const updated = [...items];
    updated[i] = { ...updated[i], [field]: value };
    setItems(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="text-cyan-400" size={24} />
          <h2 className="text-lg font-semibold">Transferencias</h2>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus size={18} className="mr-2" />
          Nueva Transferencia
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-500">Cargando...</div>
      ) : transferencias.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <ArrowRightLeft size={48} className="mx-auto mb-2 opacity-50" />
          No hay transferencias
        </div>
      ) : (
        <div className="space-y-3">
          {transferencias.map((trans) => {
            const config = getEstadoConfig(trans.estado);
            const Icon = config.icon;
            const isExpanded = expanded === trans.id;

            return (
              <div key={trans.id} className="rounded-xl bg-slate-900/50 border border-slate-800/50 overflow-hidden">
                <div
                  className="p-4 cursor-pointer hover:bg-slate-800/30 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : trans.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn('p-2 rounded-lg', config.bg)}>
                        <Icon size={20} className={config.color} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold">{trans.numero}</span>
                          <span className={cn('px-2 py-0.5 rounded text-xs', config.bg, config.color)}>
                            {config.label}
                          </span>
                        </div>
                        <div className="text-sm text-slate-400">
                          {trans.almacenOrigen?.nombre} → {trans.almacenDestino?.nombre}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-slate-400">{formatDate(trans.fechaSolicitud)}</div>
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-800/50 p-4 bg-slate-950/50">
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-slate-400 mb-2">Productos</h4>
                      <div className="space-y-2">
                        {trans.items?.map((item) => {
                          const product = products.find(p => p.codigo === item.productoCodigo);
                          return (
                            <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30">
                              <div>
                                <span className="font-mono text-xs text-slate-500">{item.productoCodigo}</span>
                                <span className="ml-2">{product?.descripcion}</span>
                              </div>
                              <span className="text-sm">{item.cantidadSolicitada} unidades</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {trans.estado === 'pendiente' && (
                        <>
                          <Button onClick={() => handleChangeEstado(trans.id, 'en_transito')}>
                            <Truck size={16} className="mr-2" /> Enviar
                          </Button>
                          <Button variant="danger" onClick={() => handleChangeEstado(trans.id, 'cancelada')}>
                            <XCircle size={16} className="mr-2" /> Cancelar
                          </Button>
                        </>
                      )}
                      {trans.estado === 'en_transito' && (
                        <Button onClick={() => handleChangeEstado(trans.id, 'completada')}>
                          <CheckCircle size={16} className="mr-2" /> Confirmar Recepción
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

      <Modal isOpen={showNew} onClose={() => setShowNew(false)} title="Nueva Transferencia">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Almacén Origen"
              value={origen}
              onChange={(e) => setOrigen(e.target.value)}
              options={almacenes.map(a => ({ value: a.id, label: a.nombre }))}
              placeholder="Seleccionar..."
            />
            <Select
              label="Almacén Destino"
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              options={almacenes.filter(a => a.id !== origen).map(a => ({ value: a.id, label: a.nombre }))}
              placeholder="Seleccionar..."
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-slate-400">Productos</label>
              <button onClick={addItem} className="text-sm text-cyan-400 hover:text-cyan-300">
                + Agregar producto
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {items.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={item.codigo}
                    onChange={(e) => updateItem(i, 'codigo', e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm"
                  >
                    <option value="">Seleccionar...</option>
                    {products.map(p => (
                      <option key={p.codigo} value={p.codigo}>{p.codigo} - {p.descripcion}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={item.cantidad}
                    onChange={(e) => updateItem(i, 'cantidad', parseInt(e.target.value) || 0)}
                    className="w-20 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm"
                    min="1"
                  />
                  <button onClick={() => removeItem(i)} className="p-2 text-red-400">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <Input
            label="Notas"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Notas opcionales..."
          />
        </div>
        <div className="flex gap-3 mt-6">
          <Button variant="secondary" onClick={() => setShowNew(false)} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleCreate} className="flex-1">
            Crear Transferencia
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ============================================
// DASHBOARD PRINCIPAL
// ============================================

interface AlmacenesDashboardProps {
  products: Product[];
  userEmail: string;
}

export function AlmacenesDashboard({ products, userEmail }: AlmacenesDashboardProps) {
  const [view, setView] = useState<'almacenes' | 'transferencias'>('almacenes');

  return (
    <div className="space-y-6">
      <div className="flex gap-2 p-1 bg-slate-900/50 rounded-xl w-fit">
        <button
          onClick={() => setView('almacenes')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
            view === 'almacenes' ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-slate-200'
          )}
        >
          <Warehouse size={18} /> Almacenes
        </button>
        <button
          onClick={() => setView('transferencias')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
            view === 'transferencias' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-slate-200'
          )}
        >
          <ArrowRightLeft size={18} /> Transferencias
        </button>
      </div>

      {view === 'almacenes' ? (
        <AlmacenesPanel />
      ) : (
        <TransferenciasPanel products={products} userEmail={userEmail} />
      )}
    </div>
  );
}