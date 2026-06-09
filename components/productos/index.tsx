import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Product, StockPrediction } from '@/types';
import { useTranslation } from 'react-i18next';
import { CATEGORY_COLORS } from '@/lib/constants';
import { Badge } from '@/components/ui';
import {
  Check, AlertTriangle, Pencil, Trash2, TrendingUp, TrendingDown,
  Minus, Warehouse, ChevronUp, ChevronDown, Download, Plus,
  ArrowDownLeft, ArrowUpRight, Square, CheckSquare, MinusSquare,
  DollarSign, Package, AlertCircle, ArrowLeftRight, History,
} from 'lucide-react';
import { ProductThumbnail } from './product-image';
import HistorialCostoModal from './HistorialCostoModal';
import { formatMoney, convertir } from '@/lib/currency';
import { valuarInventario, type ResultadoValuacion } from '@/lib/inventory-valuation';
import { useModulosHabilitados } from '@/hooks/useModulosHabilitados';
import { useTiposCambio } from '@/hooks/useTiposCambio';
import type { Moneda } from '@/types';

// ============================================
// CATEGORY BADGE
// ============================================

interface CategoryBadgeProps {
  categoria: string;
}

export function CategoryBadge({ categoria }: CategoryBadgeProps) {
  // Mismo color que la descripción del producto (neutral), sin colores
  // por categoría. Solo las gráficas llevan color.
  return <span className="text-sm text-slate-300">{categoria}</span>;
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
  trend: 'acelerando' | 'desacelerando' | 'estable' | 'sin_datos' | 'creciendo';
}

export function TrendIndicator({ trend }: TrendIndicatorProps) {
  const { t } = useTranslation();
  
  const config = {
    acelerando: { icon: <TrendingUp size={18} />, color: 'text-red-400', label: t('trends.increasing') },
    desacelerando: { icon: <TrendingDown size={18} />, color: 'text-emerald-400', label: t('trends.decreasing') },
    estable: { icon: <Minus size={18} />, color: 'text-slate-500', label: t('trends.stable') },
    sin_datos: { icon: <Minus size={18} />, color: 'text-slate-600', label: t('trends.noData') },
    creciendo: { icon: <TrendingUp size={18} />, color: 'text-blue-400', label: t('trends.growing', 'Creciendo') },
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
  onQuickMovement?: (product: Product, tipo: 'entrada' | 'salida') => void;
  onBulkAction?: (action: string, products: Product[], value?: string) => void;
  showAlmacen?: boolean;
}

type SortCol = 'codigo' | 'descripcion' | 'categoria' | 'precio' | 'costo' | 'stock';

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ChevronDown size={12} className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />;
  return dir === 'asc' ? <ChevronUp size={12} className="text-emerald-400" /> : <ChevronDown size={12} className="text-emerald-400" />;
}

export function ProductTable({
  products,
  predictions,
  onRowClick,
  onDelete,
  onEdit,
  onQuickMovement,
  onBulkAction,
  showAlmacen = true,
}: ProductTableProps) {
  const { t } = useTranslation();
  const [sortCol, setSortCol] = useState<SortCol>('codigo');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Producto cuyo historial de costos se está mostrando (modal).
  const [historialProducto, setHistorialProducto] = useState<Product | null>(null);

  const handleSort = useCallback((col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }, [sortCol]);

  const sorted = useMemo(() => {
    return [...products].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'codigo': cmp = a.codigo.localeCompare(b.codigo); break;
        case 'descripcion': cmp = a.descripcion.localeCompare(b.descripcion); break;
        case 'categoria': cmp = a.categoria.localeCompare(b.categoria); break;
        case 'precio': cmp = a.precio - b.precio; break;
        case 'costo': cmp = (a.costoPromedio || 0) - (b.costoPromedio || 0); break;
        case 'stock': cmp = a.stock - b.stock; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [products, sortCol, sortDir]);

  const allSelected = products.length > 0 && selected.size === products.length;
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(products.map(p => p.codigo)));
  };

  const toggleOne = (codigo: string) => {
    const s = new Set(selected);
    if (s.has(codigo)) s.delete(codigo); else s.add(codigo);
    setSelected(s);
  };

  const selectedProducts = useMemo(
    () => products.filter(p => selected.has(p.codigo)),
    [products, selected]
  );

  const handleExport = useCallback((toExport: Product[]) => {
    const headers = ['Código', 'Descripción', 'Categoría', 'Almacén', 'Último costo', 'Stock', 'Stock Mínimo'];
    const rows = toExport.map(p => [
      p.codigo,
      `"${p.descripcion}"`,
      p.categoria,
      p.almacen?.nombre || 'Sin almacén',
      (p.costoPromedio || 0).toFixed(2),
      p.stock,
      p.stockMinimo,
    ]);
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleDelete = (e: React.MouseEvent, codigo: string) => {
    e.stopPropagation();
    if (window.confirm(t('stock.confirmDelete'))) onDelete?.(codigo);
  };

  const handleEdit = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    onEdit?.(product);
  };

  // Valuación unificada: misma fuente de verdad que Dashboard y Reportes
  // (FIFO sobre lotes + fallback a costo_promedio). Antes calculábamos
  // localmente con `stock × (costoPromedio || precio)`, lo que daba
  // números distintos al Dashboard porque caía al precio de VENTA.
  const [valuacion, setValuacion] = useState<ResultadoValuacion | null>(null);
  useEffect(() => {
    let cancelled = false;
    valuarInventario({
      productos: products.map(p => ({
        codigo: p.codigo,
        descripcion: p.descripcion,
        stock: p.stock,
        stockMinimo: p.stockMinimo,
        costoPromedio: p.costoPromedio || 0,
        categoria: p.categoria,
        almacenId: p.almacenId,
        almacen: p.almacen,
      })),
    }).then(r => { if (!cancelled) setValuacion(r); });
    return () => { cancelled = true; };
  }, [products]);

  // Origen = UYU (hardcoded: así guardan los productos). Destino =
  // moneda elegida en Configuración. Si destino = UYU no convierte.
  const { config: orgConfig } = useModulosHabilitados();
  const { rates: ratesTable } = useTiposCambio();
  const monedaBase: Moneda = 'UYU';
  const monedaTarget: Moneda = (orgConfig.display_currency as Moneda) ?? 'UYU';

  const summary = useMemo(() => {
    const critical = products.filter(p => p.stock <= p.stockMinimo).length;
    const valorBase = valuacion?.total ?? 0;
    const conv = monedaTarget === monedaBase
      ? valorBase
      : convertir(valorBase, monedaBase, monedaTarget, ratesTable);
    return {
      count: products.length,
      valor: conv,
      valorOrigen: valorBase,
      monedaOrigen: monedaBase,
      sinTasa: conv === null,
      critical,
    };
  }, [products, valuacion, monedaBase, monedaTarget, ratesTable]);

  const thClass = 'px-3 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer select-none group';

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-6 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <span className="flex items-center gap-1.5 text-slate-400">
            <Package size={13} />
            <strong className="text-white">{summary.count}</strong> productos
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <DollarSign size={13} />
            Valor: <strong className="text-white">
              {summary.sinTasa
                ? `${formatMoney(summary.valorOrigen, summary.monedaOrigen)} *`
                : formatMoney(summary.valor ?? 0, monedaTarget)}
            </strong>
            {summary.sinTasa && (
              <span title="Falta tasa de cambio en Configuración" className="text-amber-400">⚠</span>
            )}
          </span>
          {summary.critical > 0 && (
            <span className="flex items-center gap-1.5 text-red-400">
              <AlertCircle size={13} />
              <strong>{summary.critical}</strong> críticos
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {someSelected && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs">
              <span className="text-blue-400 font-medium">{selected.size} seleccionados</span>
              {onBulkAction && (
                <>
                  <button
                    onClick={() => onBulkAction('category', selectedProducts)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  >
                    Categoría
                  </button>
                  <button
                    onClick={() => onBulkAction('minStock', selectedProducts)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  >
                    Mínimo
                  </button>
                </>
              )}
              <button
                onClick={() => handleExport(selectedProducts)}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Exportar
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="text-slate-500 hover:text-slate-300 ml-1"
              >
                ✕
              </button>
            </div>
          )}
          <button
            onClick={() => handleExport(products)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/50 text-xs text-slate-300 transition-colors"
            title="Exportar CSV"
          >
            <Download size={13} />
            CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-800/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900/80">
              <tr>
                <th className="px-3 py-3 w-10">
                  <button onClick={toggleAll} className="text-slate-400 hover:text-white transition-colors">
                    {allSelected
                      ? <CheckSquare size={16} className="text-emerald-400" />
                      : someSelected
                        ? <MinusSquare size={16} className="text-blue-400" />
                        : <Square size={16} />}
                  </button>
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-12">
                  {t('stock.image')}
                </th>
                <th className={thClass} onClick={() => handleSort('codigo')}>
                  <span className="flex items-center gap-1">{t('stock.code')} <SortIcon active={sortCol === 'codigo'} dir={sortDir} /></span>
                </th>
                <th className={thClass} onClick={() => handleSort('descripcion')}>
                  <span className="flex items-center gap-1">{t('stock.description')} <SortIcon active={sortCol === 'descripcion'} dir={sortDir} /></span>
                </th>
                <th className={thClass} onClick={() => handleSort('categoria')}>
                  <span className="flex items-center gap-1">{t('stock.category')} <SortIcon active={sortCol === 'categoria'} dir={sortDir} /></span>
                </th>
                {showAlmacen && (
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {t('stock.warehouse')}
                  </th>
                )}
                <th className={cn(thClass, 'text-right')} onClick={() => handleSort('costo')}>
                  <span className="flex items-center justify-end gap-1">Último costo <SortIcon active={sortCol === 'costo'} dir={sortDir} /></span>
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Historial
                </th>
                <th className={cn(thClass, 'text-center')} onClick={() => handleSort('stock')}>
                  <span className="flex items-center justify-center gap-1">{t('stock.stockCol')} <SortIcon active={sortCol === 'stock'} dir={sortDir} /></span>
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">IA</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {t('stock.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {sorted.map((product) => {
                const pred = predictions[product.codigo];
                const isSelected = selected.has(product.codigo);
                return (
                  <tr
                    key={product.codigo}
                    className={cn(
                      'transition-colors',
                      isSelected ? 'bg-blue-500/5' : 'hover:bg-slate-800/30'
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <button onClick={() => toggleOne(product.codigo)} className="text-slate-400 hover:text-white transition-colors">
                        {isSelected ? <CheckSquare size={16} className="text-emerald-400" /> : <Square size={16} />}
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <ProductThumbnail imageUrl={product.imagenUrl} />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-sm text-slate-300">{product.codigo}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-sm">{product.descripcion}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <CategoryBadge categoria={product.categoria} />
                    </td>
                    {showAlmacen && (
                      <td className="px-3 py-2.5">
                        <AlmacenBadge almacen={product.almacen} />
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-right">
                      <span className="font-mono text-sm text-slate-300">
                        {product.costoPromedio
                          ? formatMoney(product.costoPromedio, product.moneda ?? 'UYU', { minimumFractionDigits: 2 })
                          : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); setHistorialProducto(product); }}
                          title="Ver historial del producto (costos, movimientos y observaciones)"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-700/40 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 text-xs font-medium transition-all"
                        >
                          <History size={14} />
                          Ver historial
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-center">
                        <StockIndicator stock={product.stock} stockMinimo={product.stockMinimo} prediction={pred} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {pred && pred.trend !== 'sin_datos' && <TrendIndicator trend={pred.trend} />}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        {onQuickMovement && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); onQuickMovement(product, 'entrada'); }}
                              className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-all"
                              title="Entrada rápida"
                            >
                              <Plus size={14} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onQuickMovement(product, 'salida'); }}
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
                              title="Salida rápida"
                            >
                              <Minus size={14} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={(e) => handleEdit(e, product)}
                          className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-all"
                          title={t('common.edit')}
                        >
                          <Pencil size={14} />
                        </button>
                        {onDelete && (
                          <button
                            onClick={(e) => handleDelete(e, product.codigo)}
                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
                            title={t('common.delete')}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {products.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            {t('stock.noProducts')}
          </div>
        )}
      </div>

      {historialProducto && (
        <HistorialCostoModal
          codigo={historialProducto.codigo}
          descripcion={historialProducto.descripcion}
          moneda={historialProducto.moneda ?? 'UYU'}
          costoActual={historialProducto.costoPromedio ?? null}
          onClose={() => setHistorialProducto(null)}
        />
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
        <span className="font-mono text-emerald-400">{formatMoney(product.precio, product.moneda ?? 'UYU', { minimumFractionDigits: 2 })}</span>
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