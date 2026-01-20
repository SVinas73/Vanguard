'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { Product, Almacen, StockPrediction } from '@/types';
import { Button, Input, Select, Modal } from '@/components/ui';
import { ProductTable } from '@/components/productos';
import { ImportCSV } from '@/components/import';
import { 
  Package, Warehouse, Plus, Search, ArrowLeft, 
  ChevronRight, MapPin, Phone, User, Edit, Trash2,
  LayoutGrid, List, Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORIA_NOMBRES } from '@/lib/constants';

// ============================================
// TYPES
// ============================================

interface StockDashboardProps {
  products: Product[];
  predictions: Record<string, StockPrediction>;
  onDeleteProduct?: (codigo: string) => void;
  onEditProduct: (product: Product) => void;
  onAddProduct: () => void;
  onRefreshProducts: () => void;
  userEmail: string;
  hasCreatePermission: boolean;
  hasDeletePermission: boolean;
}

type ViewMode = 'almacenes' | 'productos';

// ============================================
// ALMACEN CARD
// ============================================

interface AlmacenCardProps {
  almacen: Almacen;
  productCount: number;
  onClick: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

function AlmacenCard({ almacen, productCount, onClick, onEdit, onDelete }: AlmacenCardProps) {
  const { t } = useTranslation();
  
  return (
    <div
      onClick={onClick}
      className={cn(
        'p-5 rounded-2xl border cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-emerald-500/10',
        almacen.esPrincipal 
          ? 'bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/30 hover:border-amber-400/50' 
          : 'bg-slate-900/50 border-slate-800/50 hover:border-slate-700/50'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            'p-3 rounded-xl',
            almacen.esPrincipal ? 'bg-amber-500/20' : 'bg-slate-800'
          )}>
            <Warehouse size={24} className={almacen.esPrincipal ? 'text-amber-400' : 'text-slate-400'} />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{almacen.nombre}</h3>
            <span className="text-xs text-slate-500 font-mono">{almacen.codigo}</span>
          </div>
        </div>
        {almacen.esPrincipal && (
          <span className="px-2 py-1 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-400">
            Principal
          </span>
        )}
      </div>

      {/* Info */}
      <div className="space-y-2 text-sm text-slate-400 mb-4">
        {almacen.direccion && (
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-slate-500" />
            <span className="truncate">{almacen.direccion}</span>
          </div>
        )}
        {almacen.responsable && (
          <div className="flex items-center gap-2">
            <User size={14} className="text-slate-500" />
            <span>{almacen.responsable}</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-800/50">
        <div className="flex items-center gap-2">
          <Package size={16} className="text-emerald-400" />
          <span className="text-2xl font-bold text-white">{productCount}</span>
          <span className="text-sm text-slate-500">{t('stock.products')}</span>
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <span className="text-xs">{t('common.view')}</span>
          <ChevronRight size={16} />
        </div>
      </div>

      {/* Actions (solo si no es principal) */}
      {!almacen.esPrincipal && (
        <div className="flex gap-2 mt-4 pt-4 border-t border-slate-800/50">
          <button
            onClick={onEdit}
            className="flex-1 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors text-sm flex items-center justify-center gap-2"
          >
            <Edit size={14} /> {t('common.edit')}
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================
// "SIN ALMACÉN" CARD
// ============================================

interface SinAlmacenCardProps {
  productCount: number;
  onClick: () => void;
}

function SinAlmacenCard({ productCount, onClick }: SinAlmacenCardProps) {
  const { t } = useTranslation();
  
  if (productCount === 0) return null;
  
  return (
    <div
      onClick={onClick}
      className="p-5 rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 cursor-pointer transition-all hover:border-slate-600 hover:bg-slate-900/50"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-slate-800">
            <Package size={24} className="text-slate-500" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-slate-400">{t('stock.noWarehouse')}</h3>
            <span className="text-xs text-slate-600">{t('stock.productsWithoutWarehouse')}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-800/50">
        <div className="flex items-center gap-2">
          <Package size={16} className="text-slate-500" />
          <span className="text-2xl font-bold text-slate-400">{productCount}</span>
          <span className="text-sm text-slate-600">{t('stock.products')}</span>
        </div>
        <div className="flex items-center gap-1 text-slate-500">
          <span className="text-xs">{t('common.view')}</span>
          <ChevronRight size={16} />
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function StockDashboard({
  products,
  predictions,
  onDeleteProduct,
  onEditProduct,
  onAddProduct,
  onRefreshProducts,
  userEmail,
  hasCreatePermission,
  hasDeletePermission,
}: StockDashboardProps) {
  const { t } = useTranslation();
  
  // State
  const [viewMode, setViewMode] = useState<ViewMode>('almacenes');
  const [selectedAlmacen, setSelectedAlmacen] = useState<Almacen | null>(null);
  const [showSinAlmacen, setShowSinAlmacen] = useState(false);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters for productos view
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Modal state for almacén CRUD
  const [showAlmacenModal, setShowAlmacenModal] = useState(false);
  const [editingAlmacen, setEditingAlmacen] = useState<Almacen | null>(null);
  const [almacenForm, setAlmacenForm] = useState({
    codigo: '',
    nombre: '',
    direccion: '',
    ciudad: '',
    telefono: '',
    responsable: '',
  });

  // Load almacenes
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

  // Count products per almacén
  const productCountByAlmacen = useMemo(() => {
    const counts: Record<string, number> = {};
    let sinAlmacen = 0;
    
    products.forEach(p => {
      if (p.almacenId) {
        counts[p.almacenId] = (counts[p.almacenId] || 0) + 1;
      } else {
        sinAlmacen++;
      }
    });
    
    return { counts, sinAlmacen };
  }, [products]);

  // Filtered products based on selected almacén
  const filteredProducts = useMemo(() => {
    let result = products;
    
    // Filter by almacén
    if (selectedAlmacen) {
      result = result.filter(p => p.almacenId === selectedAlmacen.id);
    } else if (showSinAlmacen) {
      result = result.filter(p => !p.almacenId);
    }
    
    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.codigo.toLowerCase().includes(query) ||
        p.descripcion.toLowerCase().includes(query)
      );
    }
    
    // Filter by category
    if (selectedCategory !== 'all') {
      result = result.filter(p => p.categoria === selectedCategory);
    }
    
    return result;
  }, [products, selectedAlmacen, showSinAlmacen, searchQuery, selectedCategory]);

  // Category options
  const categoryOptions = useMemo(() => {
    return CATEGORIA_NOMBRES.map(c => ({ value: c, label: c }));
  }, []);

  // Handlers
  const handleSelectAlmacen = (almacen: Almacen) => {
    setSelectedAlmacen(almacen);
    setShowSinAlmacen(false);
    setViewMode('productos');
    setSearchQuery('');
    setSelectedCategory('all');
  };

  const handleSelectSinAlmacen = () => {
    setSelectedAlmacen(null);
    setShowSinAlmacen(true);
    setViewMode('productos');
    setSearchQuery('');
    setSelectedCategory('all');
  };

  const handleBack = () => {
    setViewMode('almacenes');
    setSelectedAlmacen(null);
    setShowSinAlmacen(false);
  };

  const handleEditAlmacen = (e: React.MouseEvent, almacen: Almacen) => {
    e.stopPropagation();
    setEditingAlmacen(almacen);
    setAlmacenForm({
      codigo: almacen.codigo,
      nombre: almacen.nombre,
      direccion: almacen.direccion || '',
      ciudad: almacen.ciudad || '',
      telefono: almacen.telefono || '',
      responsable: almacen.responsable || '',
    });
    setShowAlmacenModal(true);
  };

  const handleDeleteAlmacen = async (e: React.MouseEvent, almacen: Almacen) => {
    e.stopPropagation();
    if (!confirm(t('warehouses.confirmDeactivate'))) return;
    await supabase.from('almacenes').update({ activo: false }).eq('id', almacen.id);
    fetchAlmacenes();
  };

  const handleNewAlmacen = () => {
    setEditingAlmacen(null);
    setAlmacenForm({
      codigo: '',
      nombre: '',
      direccion: '',
      ciudad: '',
      telefono: '',
      responsable: '',
    });
    setShowAlmacenModal(true);
  };

  const handleSaveAlmacen = async () => {
    if (!almacenForm.codigo || !almacenForm.nombre) return;

    const data = {
      codigo: almacenForm.codigo.toUpperCase(),
      nombre: almacenForm.nombre,
      direccion: almacenForm.direccion || null,
      ciudad: almacenForm.ciudad || null,
      telefono: almacenForm.telefono || null,
      responsable: almacenForm.responsable || null,
    };

    if (editingAlmacen) {
      await supabase.from('almacenes').update(data).eq('id', editingAlmacen.id);
    } else {
      await supabase.from('almacenes').insert(data);
    }

    setShowAlmacenModal(false);
    setEditingAlmacen(null);
    fetchAlmacenes();
  };

  // ============================================
  // RENDER: ALMACENES VIEW
  // ============================================
  
  if (viewMode === 'almacenes') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10">
              <Warehouse size={24} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{t('stock.title')}</h2>
              <p className="text-sm text-slate-500">{t('stock.selectWarehouse')}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleNewAlmacen}>
              <Plus size={18} className="mr-2" />
              {t('warehouses.newWarehouse')}
            </Button>
          </div>
        </div>

        {/* Almacenes Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="inline-flex h-8 w-8 animate-spin rounded-full border-4 border-solid border-emerald-500 border-r-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {almacenes.map(almacen => (
              <AlmacenCard
                key={almacen.id}
                almacen={almacen}
                productCount={productCountByAlmacen.counts[almacen.id] || 0}
                onClick={() => handleSelectAlmacen(almacen)}
                onEdit={(e) => handleEditAlmacen(e, almacen)}
                onDelete={(e) => handleDeleteAlmacen(e, almacen)}
              />
            ))}
            
            {/* Sin Almacén card */}
            <SinAlmacenCard
              productCount={productCountByAlmacen.sinAlmacen}
              onClick={handleSelectSinAlmacen}
            />
          </div>
        )}

        {/* Summary */}
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">{t('stock.totalProducts')}</span>
            <span className="text-2xl font-bold text-emerald-400">{products.length}</span>
          </div>
        </div>

        {/* Almacén Modal */}
        <Modal 
          isOpen={showAlmacenModal} 
          onClose={() => setShowAlmacenModal(false)} 
          title={editingAlmacen ? t('warehouses.editWarehouse') : t('warehouses.newWarehouse')}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={t('warehouses.code')}
                value={almacenForm.codigo}
                onChange={(e) => setAlmacenForm({ ...almacenForm, codigo: e.target.value.toUpperCase() })}
                placeholder="ALM-01"
                disabled={!!editingAlmacen}
              />
              <Input
                label={t('warehouses.name')}
                value={almacenForm.nombre}
                onChange={(e) => setAlmacenForm({ ...almacenForm, nombre: e.target.value })}
                placeholder="Almacén Principal"
              />
            </div>
            <Input
              label={t('warehouses.address')}
              value={almacenForm.direccion}
              onChange={(e) => setAlmacenForm({ ...almacenForm, direccion: e.target.value })}
              placeholder="Calle 123"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={t('warehouses.city')}
                value={almacenForm.ciudad}
                onChange={(e) => setAlmacenForm({ ...almacenForm, ciudad: e.target.value })}
                placeholder="Montevideo"
              />
              <Input
                label={t('warehouses.phone')}
                value={almacenForm.telefono}
                onChange={(e) => setAlmacenForm({ ...almacenForm, telefono: e.target.value })}
                placeholder="+598 99 123 456"
              />
            </div>
            <Input
              label={t('warehouses.manager')}
              value={almacenForm.responsable}
              onChange={(e) => setAlmacenForm({ ...almacenForm, responsable: e.target.value })}
              placeholder="Nombre del encargado"
            />
          </div>
          <div className="flex gap-3 mt-6">
            <Button variant="secondary" onClick={() => setShowAlmacenModal(false)} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveAlmacen} className="flex-1">
              {editingAlmacen ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </Modal>
      </div>
    );
  }

  // ============================================
  // RENDER: PRODUCTOS VIEW
  // ============================================
  
  return (
    <div className="space-y-4">
      {/* Header with Back button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-xl',
              selectedAlmacen?.esPrincipal ? 'bg-amber-500/20' : 'bg-slate-800'
            )}>
              <Warehouse 
                size={24} 
                className={selectedAlmacen?.esPrincipal ? 'text-amber-400' : 'text-slate-400'} 
              />
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {selectedAlmacen?.nombre || t('stock.noWarehouse')}
              </h2>
              <p className="text-sm text-slate-500">
                {filteredProducts.length} {t('stock.products')}
              </p>
            </div>
          </div>
        </div>

        {hasCreatePermission && (
          <div className="flex gap-2">
            <ImportCSV onImportComplete={onRefreshProducts} userEmail={userEmail} />
            <Button onClick={onAddProduct}>
              <Plus size={18} className="mr-2" />
              {t('stock.new')}
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder={t('stock.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 pl-10 rounded-xl bg-slate-900/50 border border-slate-800/50 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm"
          />
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        </div>
        <Select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          options={[{ value: 'all', label: t('stock.allCategories') }, ...categoryOptions]}
          className="min-w-[180px]"
        />
      </div>

      {/* Products Table */}
      <ProductTable 
        products={filteredProducts} 
        predictions={predictions} 
        onDelete={hasDeletePermission ? onDeleteProduct : undefined}
        onEdit={onEditProduct}
      />
    </div>
  );
}

export default StockDashboard;