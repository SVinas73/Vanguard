import React from 'react';
import { cn } from '@/lib/utils';
import { Product, StockPrediction } from '@/types';
import { useTranslation } from 'react-i18next';
import { CATEGORY_COLORS } from '@/lib/constants';
import { Badge } from '@/components/ui';
import { Check, AlertTriangle, Pencil, Trash2, TrendingUp, TrendingDown, Minus, Warehouse } from 'lucide-react';
import { ProductThumbnail } from './product-image';

// ============================================
// CATEGORY BADGE
// ============================================

interface CategoryBadgeProps {
  categoria: string;
}

export function CategoryBadge({ categoria }: CategoryBadgeProps) {
  const textColors: Record<string, string> = {
    'Estación de Servicio': 'text-blue-400',
    'Ferretería': 'text-orange-400',
    'Edintor': 'text-purple-400',
    'Papelería': 'text-green-400',
    'Oficina': 'text-cyan-400',
    'Embalaje': 'text-pink-400',
  };

  const colorClass = textColors[categoria] || 'text-slate-400';
  
  return <span className={`text-sm font-medium ${colorClass}`}>{categoria}</span>;
}

// ============================================
// ALMACEN BADGE
// ============================================

interface AlmacenBadgeProps {
  almacen?: { id: string; codigo: string; nombre: string } | null;
}

export function AlmacenBadge({ almacen }: AlmacenBadgeProps) {
  const { t } = useTranslation();
  
  if (!almacen) {
    return (
      <span className="flex items-center gap-1 text-xs text-slate-500 italic">
        <Warehouse size={12} />
        {t('stock.noWarehouse')}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-xs text-amber-400">
      <Warehouse size={12} />
      {almacen.nombre}
    </span>
  );
}

// ============================================
// STOCK INDICATOR
// ============================================

interface StockIndicatorProps {
  stock: number;
  stockMinimo: number;
  prediction?: StockPrediction;
}

export function StockIndicator({ stock, stockMinimo, prediction }: StockIndicatorProps) {
  const ratio = stock / stockMinimo;
  
  let color = 'text-emerald-400';
  let bg = 'bg-emerald-500/20';
  let icon = <Check size={12} />;

  if (ratio < 1) {
    color = 'text-red-400';
    bg = 'bg-red-500/20';
    icon = <AlertTriangle size={12} />;
  } else if (ratio < 1.5) {
    color = 'text-amber-400';
    bg = 'bg-amber-500/20';
    icon = <AlertTriangle size={12} />;
  }

  return (
    <div className="flex items-center gap-2">
      <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-lg', bg)}>
        <span className={cn('text-xs', color)}>{icon}</span>
        <span className={cn('font-mono font-semibold', color)}>{stock}</span>
      </div>
      {prediction && prediction.days !== null && prediction.days < 30 && prediction.days !== Infinity && (
        <span className="text-xs text-slate-400">~{prediction.days}d</span>
      )}
    </div>
  );
}

// ============================================
// TREND INDICATOR
// ============================================

interface TrendIndicatorProps {
  trend: 'acelerando' | 'desacelerando' | 'estable' | 'sin_datos';
}

export function TrendIndicator({ trend }: TrendIndicatorProps) {
  const { t } = useTranslation();
  
  const config = {
    acelerando: { icon: <TrendingUp size={18} />, color: 'text-red-400', label: t('trends.increasing') },
    desacelerando: { icon: <TrendingDown size={18} />, color: 'text-emerald-400', label: t('trends.decreasing') },
    estable: { icon: <Minus size={18} />, color: 'text-slate-500', label: t('trends.stable') },
    sin_datos: { icon: <Minus size={18} />, color: 'text-slate-600', label: t('trends.noData') },
  };

  const { icon, color, label } = config[trend];

  return (
    <span className={cn('text-lg', color)} title={label}>
      {icon}
    </span>
  );
}

// ============================================
// PRODUCT TABLE
// ============================================

interface ProductTableProps {
  products: Product[];
  predictions: Record<string, StockPrediction>;
  onRowClick?: (product: Product) => void;
  onDelete?: (codigo: string) => void;
  onEdit?: (product: Product) => void;
}

export function ProductTable({ products, predictions, onRowClick, onDelete, onEdit }: ProductTableProps) {
  const { t } = useTranslation();
  
  const handleDelete = (e: React.MouseEvent, codigo: string) => {
    e.stopPropagation();
    if (window.confirm(t('stock.confirmDelete'))) {
      onDelete?.(codigo);
    }
  };

  const handleEdit = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    onEdit?.(product);
  };

  return (
    <div className="rounded-2xl border border-slate-800/50 overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-900/80">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t('stock.image')}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t('stock.code')}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t('stock.description')}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t('stock.category')}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t('stock.warehouse')}
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t('stock.price')}
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t('stock.stockCol')}
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
              IA
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t('stock.actions')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {products.map((product) => {
            const pred = predictions[product.codigo];
            return (
              <tr
                key={product.codigo}
                className="hover:bg-slate-800/30 transition-colors"
              >
                <td className="px-4 py-3">
                  <ProductThumbnail imageUrl={product.imagenUrl} />
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-sm text-slate-300">
                    {product.codigo}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm">{product.descripcion}</span>
                </td>
                <td className="px-4 py-3">
                  <CategoryBadge categoria={product.categoria} />
                </td>
                <td className="px-4 py-3">
                  <AlmacenBadge almacen={product.almacen} />
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-mono text-sm text-slate-300">
                    ${product.precio.toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center">
                    <StockIndicator
                      stock={product.stock}
                      stockMinimo={product.stockMinimo}
                      prediction={pred}
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  {pred && pred.trend !== 'sin_datos' && (
                    <TrendIndicator trend={pred.trend} />
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={(e) => handleEdit(e, product)}
                      className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 transition-all"
                      title={t('common.edit')}
                    >
                      <Pencil size={16} />
                    </button>
                    {onDelete && (
                      <button
                        onClick={(e) => handleDelete(e, product.codigo)}
                        className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all"
                        title={t('common.delete')}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      
      {products.length === 0 && (
        <div className="p-8 text-center text-slate-500">
          {t('stock.noProducts')}
        </div>
      )}
    </div>
  );
}

// ============================================
// PRODUCT CARD (for grid view)
// ============================================

interface ProductCardProps {
  product: Product;
  prediction?: StockPrediction;
  onClick?: () => void;
}

export function ProductCard({ product, prediction, onClick }: ProductCardProps) {
  return (
    <div
      onClick={onClick}
      className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50 hover:border-slate-700/50 transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between mb-2">
        <span className="font-mono text-xs text-slate-500">{product.codigo}</span>
        <CategoryBadge categoria={product.categoria} />
      </div>
      
      <h3 className="font-medium text-sm mb-3 line-clamp-2">{product.descripcion}</h3>
      
      <div className="flex items-center justify-between">
        <span className="font-mono text-emerald-400">${product.precio.toFixed(2)}</span>
        <StockIndicator
          stock={product.stock}
          stockMinimo={product.stockMinimo}
          prediction={prediction}
        />
      </div>
      
      <div className="mt-2">
        <AlmacenBadge almacen={product.almacen} />
      </div>
    </div>
  );
}

export { ProductImage, ProductThumbnail } from './product-image';