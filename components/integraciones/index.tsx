'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { IntegracionEcommerce, PlataformaEcommerce } from '@/types';
import { Button, Input, Modal } from '@/components/ui';
import { 
  Plus, 
  Settings, 
  Trash2, 
  RefreshCw, 
  CheckCircle, 
  XCircle,
  ShoppingBag,
  Globe,
  Link2,
  Key,
  AlertTriangle,
  ArrowUpDown,
  Clock
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

// Logos/iconos de plataformas
const PLATAFORMAS: Record<PlataformaEcommerce, { 
  nombre: string; 
  color: string; 
  bg: string;
  descripcion: string;
}> = {
  shopify: { 
    nombre: 'Shopify', 
    color: 'text-green-400', 
    bg: 'bg-green-500/20',
    descripcion: 'Sincroniza productos y órdenes con tu tienda Shopify'
  },
  woocommerce: { 
    nombre: 'WooCommerce', 
    color: 'text-purple-400', 
    bg: 'bg-purple-500/20',
    descripcion: 'Conecta con tu tienda WordPress + WooCommerce'
  },
  mercadolibre: { 
    nombre: 'MercadoLibre', 
    color: 'text-yellow-400', 
    bg: 'bg-yellow-500/20',
    descripcion: 'Sincroniza publicaciones y ventas de MercadoLibre'
  },
  tiendanube: { 
    nombre: 'TiendaNube', 
    color: 'text-cyan-400', 
    bg: 'bg-cyan-500/20',
    descripcion: 'Integración con TiendaNube / Nuvemshop'
  },
};

// ============================================
// TARJETA DE PLATAFORMA (para agregar nueva)
// ============================================

interface PlataformaCardProps {
  plataforma: PlataformaEcommerce;
  onSelect: () => void;
}

function PlataformaCard({ plataforma, onSelect }: PlataformaCardProps) {
  const config = PLATAFORMAS[plataforma];
  
  return (
    <button
      onClick={onSelect}
      className={cn(
        'p-4 rounded-xl border-2 border-dashed border-slate-700 hover:border-slate-500 transition-all text-left',
        'hover:bg-slate-800/30'
      )}
    >
      <div className={cn('inline-flex p-2 rounded-lg mb-3', config.bg)}>
        <ShoppingBag size={24} className={config.color} />
      </div>
      <div className={cn('font-semibold mb-1', config.color)}>{config.nombre}</div>
      <div className="text-xs text-slate-500">{config.descripcion}</div>
    </button>
  );
}

// ============================================
// TARJETA DE INTEGRACIÓN ACTIVA
// ============================================

interface IntegracionCardProps {
  integracion: IntegracionEcommerce;
  onSync: () => void;
  onEdit: () => void;
  onDelete: () => void;
  syncing: boolean;
}

function IntegracionCard({ integracion, onSync, onEdit, onDelete, syncing }: IntegracionCardProps) {
  const config = PLATAFORMAS[integracion.plataforma];
  
  return (
    <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', config.bg)}>
            <ShoppingBag size={24} className={config.color} />
          </div>
          <div>
            <div className="font-semibold">{integracion.nombreTienda}</div>
            <div className={cn('text-sm', config.color)}>{config.nombre}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {integracion.activo ? (
            <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs">
              <CheckCircle size={14} /> Activo
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/20 text-red-400 text-xs">
              <XCircle size={14} /> Inactivo
            </span>
          )}
        </div>
      </div>

      {integracion.urlTienda && (
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-3">
          <Globe size={14} />
          <a href={integracion.urlTienda} target="_blank" rel="noopener noreferrer" className="hover:text-slate-200">
            {integracion.urlTienda}
          </a>
        </div>
      )}

      {integracion.ultimaSincronizacion && (
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
          <Clock size={14} />
          Última sincronización: {formatDate(integracion.ultimaSincronizacion)}
        </div>
      )}

      <div className="flex gap-2">
        <Button 
          variant="secondary" 
          onClick={onSync}
          disabled={syncing || !integracion.activo}
          className="flex-1"
        >
          <RefreshCw size={16} className={cn('mr-2', syncing && 'animate-spin')} />
          {syncing ? 'Sincronizando...' : 'Sincronizar'}
        </Button>
        <button
          onClick={onEdit}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <Settings size={18} />
        </button>
        <button
          onClick={onDelete}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-colors"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}

// ============================================
// PANEL PRINCIPAL DE INTEGRACIONES
// ============================================

export function IntegracionesDashboard() {
  const [integraciones, setIntegraciones] = useState<IntegracionEcommerce[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedPlataforma, setSelectedPlataforma] = useState<PlataformaEcommerce | null>(null);
  const [editingIntegracion, setEditingIntegracion] = useState<IntegracionEcommerce | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    nombreTienda: '',
    urlTienda: '',
    apiKey: '',
    apiSecret: '',
  });

  useEffect(() => {
    fetchIntegraciones();
  }, []);

  const fetchIntegraciones = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('integraciones_ecommerce')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setIntegraciones(data.map(i => ({
        id: i.id,
        plataforma: i.plataforma as PlataformaEcommerce,
        nombreTienda: i.nombre_tienda,
        apiKey: i.api_key,
        apiSecret: i.api_secret,
        urlTienda: i.url_tienda,
        activo: i.activo,
        ultimaSincronizacion: i.ultima_sincronizacion ? new Date(i.ultima_sincronizacion) : undefined,
        config: i.config || {},
      })));
    }
    setLoading(false);
  };

  const handleSelectPlataforma = (plataforma: PlataformaEcommerce) => {
    setSelectedPlataforma(plataforma);
    setShowNewModal(false);
    setShowConfigModal(true);
    setFormData({
      nombreTienda: '',
      urlTienda: '',
      apiKey: '',
      apiSecret: '',
    });
  };

  const handleSaveIntegracion = async () => {
    if (!formData.nombreTienda || !selectedPlataforma) return;

    const integracionData = {
      plataforma: selectedPlataforma,
      nombre_tienda: formData.nombreTienda,
      url_tienda: formData.urlTienda || null,
      api_key: formData.apiKey || null,
      api_secret: formData.apiSecret || null,
      activo: true,
    };

    if (editingIntegracion) {
      await supabase
        .from('integraciones_ecommerce')
        .update({ ...integracionData, updated_at: new Date().toISOString() })
        .eq('id', editingIntegracion.id);
    } else {
      await supabase.from('integraciones_ecommerce').insert(integracionData);
    }

    setShowConfigModal(false);
    setSelectedPlataforma(null);
    setEditingIntegracion(null);
    fetchIntegraciones();
  };

  const handleEdit = (integracion: IntegracionEcommerce) => {
    setEditingIntegracion(integracion);
    setSelectedPlataforma(integracion.plataforma);
    setFormData({
      nombreTienda: integracion.nombreTienda,
      urlTienda: integracion.urlTienda || '',
      apiKey: integracion.apiKey || '',
      apiSecret: integracion.apiSecret || '',
    });
    setShowConfigModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta integración?')) return;
    await supabase.from('integraciones_ecommerce').delete().eq('id', id);
    fetchIntegraciones();
  };

  const handleSync = async (integracion: IntegracionEcommerce) => {
    setSyncing(integracion.id);

    // Simular sincronización (aquí iría la lógica real)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Actualizar última sincronización
    await supabase
      .from('integraciones_ecommerce')
      .update({ ultima_sincronizacion: new Date().toISOString() })
      .eq('id', integracion.id);

    // Log de sincronización
    await supabase.from('sync_ecommerce_log').insert({
      integracion_id: integracion.id,
      tipo: 'sync_manual',
      direccion: 'entrada',
      estado: 'completado',
      datos: { productos_sincronizados: 0, ordenes_sincronizadas: 0 },
    });

    setSyncing(null);
    fetchIntegraciones();
  };

  const getPlaceholders = (plataforma: PlataformaEcommerce | null) => {
    switch (plataforma) {
      case 'shopify':
        return {
          url: 'https://tu-tienda.myshopify.com',
          apiKey: 'API Key de Shopify',
          apiSecret: 'API Secret de Shopify',
        };
      case 'woocommerce':
        return {
          url: 'https://tu-sitio.com',
          apiKey: 'Consumer Key',
          apiSecret: 'Consumer Secret',
        };
      case 'mercadolibre':
        return {
          url: 'ID de vendedor',
          apiKey: 'Client ID',
          apiSecret: 'Client Secret',
        };
      case 'tiendanube':
        return {
          url: 'https://tu-tienda.mitiendanube.com',
          apiKey: 'Access Token',
          apiSecret: 'User ID',
        };
      default:
        return {
          url: 'URL de la tienda',
          apiKey: 'API Key',
          apiSecret: 'API Secret',
        };
    }
  };

  const placeholders = getPlaceholders(selectedPlataforma);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-pink-500/20">
            <Link2 size={28} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Integraciones eCommerce</h1>
            <p className="text-sm text-slate-400">Conecta tu inventario con tiendas online</p>
          </div>
        </div>
        <Button onClick={() => setShowNewModal(true)}>
          <Plus size={18} className="mr-2" />
          Nueva Integración
        </Button>
      </div>

      {/* Integraciones activas */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Cargando integraciones...</div>
      ) : integraciones.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-flex p-4 rounded-full bg-slate-800/50 mb-4">
            <ShoppingBag size={48} className="text-slate-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-400 mb-2">Sin integraciones</h3>
          <p className="text-sm text-slate-500 mb-4">
            Conecta tu primera tienda online para sincronizar productos y órdenes
          </p>
          <Button onClick={() => setShowNewModal(true)}>
            <Plus size={18} className="mr-2" />
            Agregar Integración
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integraciones.map((integracion) => (
            <IntegracionCard
              key={integracion.id}
              integracion={integracion}
              onSync={() => handleSync(integracion)}
              onEdit={() => handleEdit(integracion)}
              onDelete={() => handleDelete(integracion.id)}
              syncing={syncing === integracion.id}
            />
          ))}
        </div>
      )}

      

      {/* Modal: Seleccionar plataforma */}
      <Modal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="Nueva Integración"
      >
        <p className="text-sm text-slate-400 mb-4">
          Selecciona la plataforma que deseas conectar:
        </p>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(PLATAFORMAS) as PlataformaEcommerce[]).map((plataforma) => (
            <PlataformaCard
              key={plataforma}
              plataforma={plataforma}
              onSelect={() => handleSelectPlataforma(plataforma)}
            />
          ))}
        </div>
      </Modal>

      {/* Modal: Configurar integración */}
      <Modal
        isOpen={showConfigModal}
        onClose={() => {
          setShowConfigModal(false);
          setSelectedPlataforma(null);
          setEditingIntegracion(null);
        }}
        title={editingIntegracion ? 'Editar Integración' : `Configurar ${selectedPlataforma ? PLATAFORMAS[selectedPlataforma].nombre : ''}`}
      >
        <div className="space-y-4">
          {selectedPlataforma && (
            <div className={cn('p-3 rounded-lg flex items-center gap-3', PLATAFORMAS[selectedPlataforma].bg)}>
              <ShoppingBag size={24} className={PLATAFORMAS[selectedPlataforma].color} />
              <div>
                <div className={cn('font-semibold', PLATAFORMAS[selectedPlataforma].color)}>
                  {PLATAFORMAS[selectedPlataforma].nombre}
                </div>
                <div className="text-xs text-slate-400">{PLATAFORMAS[selectedPlataforma].descripcion}</div>
              </div>
            </div>
          )}

          <Input
            label="Nombre de la tienda"
            value={formData.nombreTienda}
            onChange={(e) => setFormData({ ...formData, nombreTienda: e.target.value })}
            placeholder="Mi Tienda Online"
          />

          <Input
            label="URL de la tienda"
            value={formData.urlTienda}
            onChange={(e) => setFormData({ ...formData, urlTienda: e.target.value })}
            placeholder={placeholders.url}
          />

          <Input
            label="API Key / Client ID"
            value={formData.apiKey}
            onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
            placeholder={placeholders.apiKey}
            type="password"
          />

          <Input
            label="API Secret / Access Token"
            value={formData.apiSecret}
            onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
            placeholder={placeholders.apiSecret}
            type="password"
          />

          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
            <AlertTriangle size={18} className="text-amber-400 mt-0.5" />
            <div className="text-xs text-amber-200">
              Las credenciales se guardan de forma segura. Necesitarás obtenerlas desde el panel de administración de tu tienda.
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="secondary" onClick={() => setShowConfigModal(false)} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSaveIntegracion} className="flex-1">
            {editingIntegracion ? 'Guardar Cambios' : 'Conectar'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}