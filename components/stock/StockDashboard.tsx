'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { Product, Almacen, StockPrediction, Moneda } from '@/types';
import { Button, Input, Select, Modal } from '@/components/ui';
import { ProductTable } from '@/components/productos';
import { ImportCSV } from '@/components/import';
import { QuickMovementModal } from './QuickMovementModal';
import { useInventoryStore } from '@/store';
import {
  Package, Warehouse, Plus, Search, ArrowLeft,
  ChevronRight, MapPin, User, Edit, Trash2,
  Layers, Loader2, ChevronDown, Check, AlertTriangle,
  Wallet, Tags, X, List,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORIA_NOMBRES } from '@/lib/constants';
import { registrarAuditoria } from '@/lib/audit';
import { formatMoney } from '@/lib/currency';
import { useResumenInventario } from '@/hooks/useResumenInventario';

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

type ViewMode = 'almacenes' | 'productos' | 'todos';

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
        'p-5 rounded-xl border cursor-pointer transition-all hover:scale-[1.02] hover:shadow-sm',
        almacen.esPrincipal
          ? 'bg-slate-900 border-amber-500/30 hover:border-amber-400/50'
          : 'bg-slate-900 border-slate-800 hover:border-slate-700/50'
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
          <Package size={16} className="text-slate-400" />
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
      className="p-5 rounded-xl border border-dashed border-slate-700 bg-slate-900 cursor-pointer transition-all hover:border-slate-600 hover:bg-slate-800/50"
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
// KPI CARD (resumen de stock)
// ============================================

type KpiTone = 'blue' | 'emerald' | 'red';

const KPI_TONES: Record<KpiTone, { chip: string; icon: string; ring: string }> = {
  blue:    { chip: 'bg-blue-500/10',    icon: 'text-blue-400',    ring: 'border-blue-500/40 ring-2 ring-blue-500/20' },
  emerald: { chip: 'bg-emerald-500/10', icon: 'text-emerald-400', ring: 'border-emerald-500/40 ring-2 ring-emerald-500/20' },
  red:     { chip: 'bg-red-500/10',     icon: 'text-red-400',     ring: 'border-red-500/40 ring-2 ring-red-500/20' },
};

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone: KpiTone;
  active?: boolean;
  loading?: boolean;
  onClick?: () => void;
}

function KpiCard({ icon, label, value, hint, tone, active, loading, onClick }: KpiCardProps) {
  const t = KPI_TONES[tone];
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'w-full text-left p-5 rounded-2xl bg-slate-900 border border-slate-800 transition-all',
        onClick && 'cursor-pointer hover:border-slate-700 hover:-translate-y-0.5',
        active && t.ring,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        <span className={cn('p-2 rounded-xl', t.chip, t.icon)}>{icon}</span>
      </div>
      <div className="mt-3 text-3xl font-bold text-white tabular-nums leading-tight">
        {loading ? <Loader2 size={24} className="animate-spin text-slate-500" /> : value}
      </div>
      {hint && <div className="mt-1.5 text-xs text-slate-500">{hint}</div>}
    </Tag>
  );
}

// ============================================
// SELECTOR DE CATEGORÍA (desplegable destacado)
// ============================================

/** '' = ninguna elegida todavía; 'all' = todas las categorías. */
type CategoriaFiltro = string;

interface CategoriaPickerProps {
  value: CategoriaFiltro;
  onChange: (v: CategoriaFiltro) => void;
  opciones: Array<{ nombre: string; cantidad: number }>;
  total: number;
}

function CategoriaPicker({ value, onChange, opciones, total }: CategoriaPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const elegir = (v: CategoriaFiltro) => { onChange(v); setOpen(false); };
  const etiqueta = value === '' ? 'Elegí una categoría' : value === 'all' ? 'Todas las categorías' : value;
  const cantidadSel = value === 'all' ? total : opciones.find(o => o.nombre === value)?.cantidad;

  return (
    <div ref={ref} className="relative w-full md:w-80">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'w-full h-12 pl-3 pr-3 rounded-xl flex items-center gap-3 text-left transition-all border-2',
          value === ''
            ? 'bg-blue-500/10 border-blue-500/50 hover:border-blue-500/80'
            : 'bg-slate-900 border-slate-700 hover:border-slate-600',
          open && 'border-blue-500/70 ring-4 ring-blue-500/10',
        )}
      >
        <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400"><Tags size={16} /></span>
        <span className="flex-1 min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Categoría</span>
          <span className={cn('block truncate text-sm font-medium', value === '' ? 'text-blue-400' : 'text-white')}>
            {etiqueta}
          </span>
        </span>
        {cantidadSel != null && value !== '' && (
          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-xs font-mono text-slate-300">{cantidadSel}</span>
        )}
        <ChevronDown size={16} className={cn('text-slate-500 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-40 mt-2 w-full rounded-xl bg-slate-900 border border-slate-700 shadow-2xl shadow-black/40 p-1.5 max-h-80 overflow-y-auto"
        >
          <button
            type="button"
            onClick={() => elegir('all')}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
              value === 'all' ? 'bg-blue-500/10 text-blue-400' : 'text-slate-200 hover:bg-slate-800',
            )}
          >
            <Layers size={15} className="shrink-0" />
            <span className="flex-1 text-left font-medium">Todas las categorías</span>
            <span className="text-xs font-mono text-slate-500">{total}</span>
            {value === 'all' && <Check size={14} />}
          </button>
          <div className="my-1 border-t border-slate-800" />
          {opciones.map(o => (
            <button
              key={o.nombre}
              type="button"
              onClick={() => elegir(o.nombre)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                value === o.nombre ? 'bg-blue-500/10 text-blue-400' : 'text-slate-200 hover:bg-slate-800',
                o.cantidad === 0 && value !== o.nombre && 'opacity-60',
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
              <span className="flex-1 text-left truncate">{o.nombre}</span>
              <span className="text-xs font-mono text-slate-500">{o.cantidad}</span>
              {value === o.nombre && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
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
  // viewMode + selectedAlmacen se persisten en sessionStorage para que, al borrar
  // un artículo (que provoca un remount del dashboard), el usuario se quede en la
  // MISMA pantalla en la que estaba y no vuelva al listado de almacenes.
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'almacenes';
    return (sessionStorage.getItem('vg:stock:viewMode') as ViewMode) || 'almacenes';
  });
  const [selectedAlmacen, setSelectedAlmacen] = useState<Almacen | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem('vg:stock:selectedAlmacen');
      return raw ? (JSON.parse(raw) as Almacen) : null;
    } catch { return null; }
  });
  const [showSinAlmacen, setShowSinAlmacen] = useState(false);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters for productos view. Por defecto NO hay categoría elegida: se ve
  // solo el resumen (cantidad, valor, críticos) y el listado aparece al
  // elegir una categoría, buscar o tocar "Críticos".
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoriaFiltro>('');
  const [soloCriticos, setSoloCriticos] = useState(false);
  
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

  // Quick movement modal state
  const [movementProduct, setMovementProduct] = useState<Product | null>(null);
  const [movementTipo, setMovementTipo] = useState<'entrada' | 'salida'>('entrada');
  const [showMovementModal, setShowMovementModal] = useState(false);

  // Bulk action modal state
  const [bulkActionType, setBulkActionType] = useState<string | null>(null);
  const [bulkProducts, setBulkProducts] = useState<Product[]>([]);
  const [bulkValue, setBulkValue] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Store access
  const addMovement = useInventoryStore((s) => s.addMovement);

  // Persistir la vista actual para sobrevivir remounts (p. ej. al borrar artículo).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem('vg:stock:viewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (selectedAlmacen) sessionStorage.setItem('vg:stock:selectedAlmacen', JSON.stringify(selectedAlmacen));
    else sessionStorage.removeItem('vg:stock:selectedAlmacen');
  }, [selectedAlmacen]);

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

  // Productos del alcance actual (almacén elegido, sin almacén o todos)
  const scopeProducts = useMemo(() => {
    if (viewMode !== 'productos') return products;
    if (selectedAlmacen) return products.filter(p => p.almacenId === selectedAlmacen.id);
    if (showSinAlmacen) return products.filter(p => !p.almacenId);
    return products;
  }, [products, viewMode, selectedAlmacen, showSinAlmacen]);

  // Alcance + categoría elegida: base de las tarjetas de resumen
  const categoryProducts = useMemo(() => {
    if (selectedCategory === '' || selectedCategory === 'all') return scopeProducts;
    return scopeProducts.filter(p => p.categoria === selectedCategory);
  }, [scopeProducts, selectedCategory]);

  const filteredProducts = useMemo(() => {
    let result = categoryProducts;
    if (soloCriticos) result = result.filter(p => p.stock <= p.stockMinimo);
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.codigo.toLowerCase().includes(query) ||
        p.descripcion.toLowerCase().includes(query)
      );
    }
    return result;
  }, [categoryProducts, soloCriticos, searchQuery]);

  const mostrarListado = selectedCategory !== '' || soloCriticos || searchQuery.trim() !== '';

  const resumen = useResumenInventario(
    categoryProducts,
    viewMode === 'productos' || viewMode === 'todos',
  );

  // Category options (para cambios masivos)
  const categoryOptions = useMemo(() => {
    return CATEGORIA_NOMBRES.map(c => ({ value: c, label: c }));
  }, []);

  // Categorías con cantidad de productos del alcance actual. Incluye las
  // predefinidas y cualquier otra que venga en los datos (p. ej. por CSV).
  const categoriasConCantidad = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of CATEGORIA_NOMBRES) counts.set(c, 0);
    for (const p of scopeProducts) {
      const c = p.categoria || 'Sin categoría';
      counts.set(c, (counts.get(c) || 0) + 1);
    }
    return Array.from(counts, ([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => (b.cantidad - a.cantidad) || a.nombre.localeCompare(b.nombre));
  }, [scopeProducts]);

  const resetFiltros = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSoloCriticos(false);
  };

  // Handlers
  const handleSelectAlmacen = (almacen: Almacen) => {
    setSelectedAlmacen(almacen);
    setShowSinAlmacen(false);
    setViewMode('productos');
    resetFiltros();
  };

  const handleSelectSinAlmacen = () => {
    setSelectedAlmacen(null);
    setShowSinAlmacen(true);
    setViewMode('productos');
    resetFiltros();
  };

  const handleSelectTodos = () => {
    setSelectedAlmacen(null);
    setShowSinAlmacen(false);
    setViewMode('todos');
    resetFiltros();
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
    await registrarAuditoria('almacenes', 'DESACTIVAR', almacen.codigo, almacen, { ...almacen, activo: false }, userEmail);
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
      await registrarAuditoria('almacenes', 'ACTUALIZAR', data.codigo, editingAlmacen, data, userEmail);
    } else {
      await supabase.from('almacenes').insert(data);
      await registrarAuditoria('almacenes', 'CREAR', data.codigo, null, data, userEmail);
    }

    setShowAlmacenModal(false);
    setEditingAlmacen(null);
    fetchAlmacenes();
  };

  // Quick movement handlers
  const handleQuickMovement = useCallback((product: Product, tipo: 'entrada' | 'salida') => {
    setMovementProduct(product);
    setMovementTipo(tipo);
    setShowMovementModal(true);
  }, []);

  const handleMovementSubmit = useCallback(async (data: {
    codigo: string;
    tipo: 'entrada' | 'salida';
    cantidad: number;
    notas: string;
    costoCompra?: number;
    monedaCosto?: Moneda;
    factura?: string;
  }) => {
    await addMovement(
      { codigo: data.codigo, tipo: data.tipo, cantidad: data.cantidad, notas: data.notas, costoCompra: data.costoCompra, monedaCosto: data.monedaCosto },
      userEmail
    );
    onRefreshProducts();
  }, [addMovement, userEmail, onRefreshProducts]);

  // Bulk action handlers
  const handleBulkAction = useCallback((action: string, prods: Product[]) => {
    setBulkActionType(action);
    setBulkProducts(prods);
    setBulkValue('');
  }, []);

  const handleBulkSubmit = useCallback(async () => {
    if (!bulkActionType || bulkProducts.length === 0) return;
    setBulkSubmitting(true);
    try {
      const codigos = bulkProducts.map(p => p.codigo);
      if (bulkActionType === 'category' && bulkValue) {
        await supabase.from('productos').update({ categoria: bulkValue }).in('codigo', codigos);
        await registrarAuditoria('productos', 'CAMBIO_MASIVO_CATEGORIA', null, { codigos, cantidad: codigos.length }, { categoria: bulkValue, codigos }, userEmail);
      } else if (bulkActionType === 'minStock' && bulkValue) {
        const val = parseInt(bulkValue);
        if (!isNaN(val) && val >= 0) {
          await supabase.from('productos').update({ stock_minimo: val }).in('codigo', codigos);
          await registrarAuditoria('productos', 'CAMBIO_MASIVO_STOCK_MINIMO', null, { codigos, cantidad: codigos.length }, { stock_minimo: val, codigos }, userEmail);
        }
      }
      onRefreshProducts();
    } finally {
      setBulkSubmitting(false);
      setBulkActionType(null);
      setBulkProducts([]);
      setBulkValue('');
    }
  }, [bulkActionType, bulkProducts, bulkValue, onRefreshProducts]);

  // ============================================
  // RENDER: ALMACENES VIEW
  // ============================================
  
  // Shared modals rendered in all views
  const renderModals = () => (
    <>
      {/* Quick Movement Modal */}
      {showMovementModal && movementProduct && (
        <QuickMovementModal
          product={movementProduct}
          tipo={movementTipo}
          userEmail={userEmail}
          onSubmit={handleMovementSubmit}
          onClose={() => { setShowMovementModal(false); setMovementProduct(null); }}
        />
      )}

      {/* Bulk Action Modal */}
      <Modal
        isOpen={!!bulkActionType}
        onClose={() => { setBulkActionType(null); setBulkProducts([]); setBulkValue(''); }}
        title={bulkActionType === 'category' ? 'Cambiar Categoría' : 'Cambiar Stock Mínimo'}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Aplicar a <strong className="text-white">{bulkProducts.length}</strong> productos seleccionados
          </p>
          {bulkActionType === 'category' ? (
            <Select
              value={bulkValue}
              onChange={(e) => setBulkValue(e.target.value)}
              options={[{ value: '', label: 'Seleccionar categoría...' }, ...categoryOptions]}
            />
          ) : (
            <Input
              type="number"
              label="Nuevo stock mínimo"
              value={bulkValue}
              onChange={(e) => setBulkValue(e.target.value)}
              placeholder="0"
              min={0}
            />
          )}
        </div>
        <div className="flex gap-3 mt-6">
          <Button variant="secondary" onClick={() => { setBulkActionType(null); setBulkProducts([]); setBulkValue(''); }} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button onClick={handleBulkSubmit} disabled={!bulkValue || bulkSubmitting} className="flex-1">
            {bulkSubmitting ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
            Aplicar
          </Button>
        </div>
      </Modal>

      {/* Almacén CRUD Modal */}
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
    </>
  );

  if (viewMode === 'almacenes') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-800">
              <Warehouse size={24} className="text-slate-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{t('stock.title')}</h2>
              <p className="text-sm text-slate-500">{t('stock.selectWarehouse')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleSelectTodos}>
              <Layers size={18} className="mr-2" />
              Todos los productos
            </Button>
            <Button variant="secondary" onClick={handleNewAlmacen}>
              <Plus size={18} className="mr-2" />
              {t('warehouses.newWarehouse')}
            </Button>
          </div>
        </div>

        {/* Almacenes Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="inline-flex h-8 w-8 animate-spin rounded-full border-4 border-solid border-slate-500 border-r-transparent" />
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
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">{t('stock.totalProducts')}</span>
            <span className="text-2xl font-bold text-slate-200">{products.length}</span>
          </div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // ============================================
  // RENDER: PRODUCTOS / TODOS VIEW
  // ============================================

  const isTodos = viewMode === 'todos';
  const viewTitle = isTodos
    ? 'Todos los productos'
    : (selectedAlmacen?.nombre || t('stock.noWarehouse'));

  const valorTexto = resumen.sinTasa
    ? `${formatMoney(resumen.valorOrigen, resumen.monedaOrigen, { maximumFractionDigits: 0 })} *`
    : formatMoney(resumen.valor ?? 0, resumen.monedaDestino, { maximumFractionDigits: 0 });
  const alcanceCategoria = selectedCategory && selectedCategory !== 'all' ? selectedCategory : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            title="Volver a almacenes"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-xl',
              isTodos ? 'bg-blue-500/20' : selectedAlmacen?.esPrincipal ? 'bg-amber-500/20' : 'bg-slate-800'
            )}>
              {isTodos
                ? <Layers size={24} className="text-blue-400" />
                : <Warehouse size={24} className={selectedAlmacen?.esPrincipal ? 'text-amber-400' : 'text-slate-400'} />}
            </div>
            <div>
              <h2 className="text-xl font-bold">{viewTitle}</h2>
              <p className="text-sm text-slate-500">
                {scopeProducts.length} {t('stock.products')}
                {isTodos && almacenes.length > 0 && ` · ${almacenes.length} almacenes`}
              </p>
            </div>
          </div>
        </div>

        {hasCreatePermission && (
          <div className="flex flex-wrap gap-3">
            <ImportCSV
              onImportComplete={onRefreshProducts}
              userEmail={userEmail}
              triggerClassName="h-11 px-5 text-sm rounded-xl border-slate-700 hover:border-slate-600"
            />
            <Button
              onClick={onAddProduct}
              className="h-11 px-5 text-sm rounded-xl font-semibold shadow-lg shadow-blue-500/20"
            >
              <Plus size={18} className="mr-1" />
              Nuevo producto
            </Button>
          </div>
        )}
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          tone="blue"
          icon={<Package size={18} />}
          label="Productos"
          value={resumen.count.toLocaleString('es-UY')}
          hint={alcanceCategoria ? `En ${alcanceCategoria}` : isTodos ? 'En todos los almacenes' : 'En este almacén'}
        />
        <KpiCard
          tone="emerald"
          icon={<Wallet size={18} />}
          label="Valor del inventario"
          value={valorTexto}
          loading={resumen.cargando}
          hint={resumen.sinTasa
            ? 'Falta tasa de cambio para convertir'
            : 'Al costo · FIFO por lote, cada compra en su moneda'}
        />
        <KpiCard
          tone="red"
          icon={<AlertTriangle size={18} />}
          label="Críticos"
          value={resumen.criticos.toLocaleString('es-UY')}
          active={soloCriticos}
          onClick={() => setSoloCriticos(v => !v)}
          hint={soloCriticos ? 'Mostrando solo críticos · tocá para quitar' : 'Stock en o bajo el mínimo · tocá para ver'}
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <CategoriaPicker
          value={selectedCategory}
          onChange={setSelectedCategory}
          opciones={categoriasConCantidad}
          total={scopeProducts.length}
        />
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder={t('stock.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 px-4 pl-11 rounded-xl bg-slate-900 border-2 border-slate-800 focus:border-slate-600 focus:outline-none focus:ring-4 focus:ring-slate-500/20 text-sm"
          />
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
        </div>
        {mostrarListado && (
          <button
            type="button"
            onClick={resetFiltros}
            className="h-12 px-4 rounded-xl border-2 border-slate-800 text-sm text-slate-400 hover:text-white hover:border-slate-700 transition-colors inline-flex items-center gap-2"
          >
            <X size={15} /> Limpiar
          </button>
        )}
      </div>

      {mostrarListado ? (
        <ProductTable
          products={filteredProducts}
          predictions={predictions}
          onDelete={hasDeletePermission ? onDeleteProduct : undefined}
          onEdit={onEditProduct}
          onQuickMovement={handleQuickMovement}
          onBulkAction={handleBulkAction}
          showAlmacen={isTodos}
          showSummary={false}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-800 py-10 px-6 text-center">
          <div className="mx-auto mb-3 w-11 h-11 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
            <List size={20} />
          </div>
          <p className="text-sm text-slate-300 font-medium">Elegí una categoría o buscá un producto para ver el listado</p>
          <p className="text-xs text-slate-500 mt-1">También podés tocar “Críticos” para ver solo lo que hay que reponer.</p>
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 transition-colors"
          >
            <Layers size={15} /> Ver todos los productos
          </button>
        </div>
      )}

      {renderModals()}
    </div>
  );
}

export default StockDashboard;
