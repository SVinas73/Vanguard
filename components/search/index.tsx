'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { 
  Search, 
  X, 
  Package, 
  ArrowLeftRight, 
  Users, 
  Truck, 
  ShoppingCart,
  FileText,
  Command,
  CornerDownLeft,
  Loader2,
  Warehouse
} from 'lucide-react';
import { cn, formatDate, formatCurrency } from '@/lib/utils';
import { Product, Movement, Cliente, Proveedor, OrdenCompra, OrdenVenta } from '@/types';

// ============================================
// TIPOS
// ============================================

type SearchResultType = 'product' | 'movement' | 'customer' | 'supplier' | 'purchase' | 'sale';

interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  meta?: string;
  data: any;
}

interface GlobalSearchProps {
  onSelectProduct?: (product: Product) => void;
  onSelectMovement?: (movement: Movement) => void;
  onSelectCustomer?: (customer: Cliente) => void;
  onSelectSupplier?: (supplier: Proveedor) => void;
  onNavigate?: (tab: string) => void;
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export function GlobalSearch({ 
  onSelectProduct, 
  onSelectMovement,
  onSelectCustomer,
  onSelectSupplier,
  onNavigate 
}: GlobalSearchProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Atajo de teclado Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus en input cuando se abre
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Búsqueda con debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const searchTimeout = setTimeout(async () => {
      await performSearch(query);
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [query]);

  // Scroll al item seleccionado
  useEffect(() => {
    if (resultsRef.current && results.length > 0) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, results.length]);

  const performSearch = async (searchQuery: string) => {
    setLoading(true);
    const searchResults: SearchResult[] = [];
    const lowerQuery = searchQuery.toLowerCase();

    try {
      // Buscar productos
      const { data: productos } = await supabase
        .from('productos')
        .select('codigo, descripcion, precio, stock, categoria')
        .or(`codigo.ilike.%${searchQuery}%,descripcion.ilike.%${searchQuery}%`)
        .limit(5);

      if (productos) {
        productos.forEach(p => {
          searchResults.push({
            id: `product-${p.codigo}`,
            type: 'product',
            title: p.descripcion,
            subtitle: p.codigo,
            meta: `${formatCurrency(p.precio)} • Stock: ${p.stock}`,
            data: p
          });
        });
      }

      // Buscar movimientos (por código de producto o notas)
      const { data: movimientos } = await supabase
        .from('movimientos')
        .select('id, codigo, tipo, cantidad, notas, created_at, usuario_email')
        .or(`codigo.ilike.%${searchQuery}%,notas.ilike.%${searchQuery}%`)
        .order('created_at', { ascending: false })
        .limit(5);

      if (movimientos) {
        movimientos.forEach(m => {
          searchResults.push({
            id: `movement-${m.id}`,
            type: 'movement',
            title: `${m.tipo === 'entrada' ? '↓' : '↑'} ${m.codigo}`,
            subtitle: `${m.cantidad} unidades • ${m.usuario_email}`,
            meta: formatDate(new Date(m.created_at)),
            data: m
          });
        });
      }

      // Buscar clientes
      const { data: clientes } = await supabase
        .from('clientes')
        .select('id, codigo, nombre, email, telefono')
        .or(`codigo.ilike.%${searchQuery}%,nombre.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .eq('activo', true)
        .limit(5);

      if (clientes) {
        clientes.forEach(c => {
          searchResults.push({
            id: `customer-${c.id}`,
            type: 'customer',
            title: c.nombre,
            subtitle: c.codigo,
            meta: c.email || c.telefono || '',
            data: c
          });
        });
      }

      // Buscar proveedores
      const { data: proveedores } = await supabase
        .from('proveedores')
        .select('id, codigo, nombre, email, telefono')
        .or(`codigo.ilike.%${searchQuery}%,nombre.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .eq('activo', true)
        .limit(5);

      if (proveedores) {
        proveedores.forEach(p => {
          searchResults.push({
            id: `supplier-${p.id}`,
            type: 'supplier',
            title: p.nombre,
            subtitle: p.codigo,
            meta: p.email || p.telefono || '',
            data: p
          });
        });
      }

      // Buscar órdenes de compra
      const { data: ordenesCompra } = await supabase
        .from('ordenes_compra')
        .select('id, numero, estado, total, created_at')
        .ilike('numero', `%${searchQuery}%`)
        .order('created_at', { ascending: false })
        .limit(3);

      if (ordenesCompra) {
        ordenesCompra.forEach(o => {
          searchResults.push({
            id: `purchase-${o.id}`,
            type: 'purchase',
            title: o.numero,
            subtitle: t(`purchases.states.${o.estado}`),
            meta: formatCurrency(o.total),
            data: o
          });
        });
      }

      // Buscar órdenes de venta
      const { data: ordenesVenta } = await supabase
        .from('ordenes_venta')
        .select('id, numero, estado, total, created_at')
        .ilike('numero', `%${searchQuery}%`)
        .order('created_at', { ascending: false })
        .limit(3);

      if (ordenesVenta) {
        ordenesVenta.forEach(o => {
          searchResults.push({
            id: `sale-${o.id}`,
            type: 'sale',
            title: o.numero,
            subtitle: t(`sales.states.${o.estado}`),
            meta: formatCurrency(o.total),
            data: o
          });
        });
      }

    } catch (error) {
      console.error('Error en búsqueda global:', error);
    }

    setResults(searchResults);
    setLoading(false);
    setSelectedIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  };

  const handleSelect = (result: SearchResult) => {
    setIsOpen(false);
    
    switch (result.type) {
      case 'product':
        onSelectProduct?.(result.data);
        onNavigate?.('stock');
        break;
      case 'movement':
        onNavigate?.('movimientos');
        break;
      case 'customer':
        onSelectCustomer?.(result.data);
        onNavigate?.('ventas');
        break;
      case 'supplier':
        onSelectSupplier?.(result.data);
        onNavigate?.('compras');
        break;
      case 'purchase':
        onNavigate?.('compras');
        break;
      case 'sale':
        onNavigate?.('ventas');
        break;
    }
  };

  const getIcon = (type: SearchResultType) => {
    switch (type) {
      case 'product': return <Package size={18} className="text-emerald-400" />;
      case 'movement': return <ArrowLeftRight size={18} className="text-cyan-400" />;
      case 'customer': return <Users size={18} className="text-purple-400" />;
      case 'supplier': return <Truck size={18} className="text-amber-400" />;
      case 'purchase': return <ShoppingCart size={18} className="text-blue-400" />;
      case 'sale': return <FileText size={18} className="text-pink-400" />;
    }
  };

  const getTypeLabel = (type: SearchResultType) => {
    switch (type) {
      case 'product': return t('stock.title');
      case 'movement': return t('movements.title');
      case 'customer': return t('sales.customers');
      case 'supplier': return t('purchases.suppliers');
      case 'purchase': return t('purchases.purchaseOrders');
      case 'sale': return t('sales.salesOrders');
    }
  };

  // Agrupar resultados por tipo
  const groupedResults = useMemo(() => {
    const groups: Record<SearchResultType, SearchResult[]> = {
      product: [],
      movement: [],
      customer: [],
      supplier: [],
      purchase: [],
      sale: [],
    };
    
    results.forEach(r => {
      groups[r.type].push(r);
    });
    
    return groups;
  }, [results]);

  const flatResults = useMemo(() => {
    return Object.values(groupedResults).flat();
  }, [groupedResults]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-800">
          {loading ? (
            <Loader2 size={20} className="text-slate-400 animate-spin" />
          ) : (
            <Search size={20} className="text-slate-400" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`${t('common.search')} productos, movimientos, clientes, proveedores...`}
            className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 outline-none text-lg"
          />
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Results */}
        <div 
          ref={resultsRef}
          className="max-h-[50vh] overflow-y-auto"
        >
          {query && results.length === 0 && !loading && (
            <div className="p-8 text-center text-slate-500">
              <Search size={32} className="mx-auto mb-2 opacity-50" />
              <p>No se encontraron resultados para "{query}"</p>
            </div>
          )}

          {!query && (
            <div className="p-6 text-center text-slate-500">
              <p className="mb-4">Busca en todo tu inventario</p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  { icon: <Package size={14} />, label: t('stock.title') },
                  { icon: <ArrowLeftRight size={14} />, label: t('movements.title') },
                  { icon: <Users size={14} />, label: t('sales.customers') },
                  { icon: <Truck size={14} />, label: t('purchases.suppliers') },
                ].map((item, i) => (
                  <span key={i} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/50 text-xs">
                    {item.icon} {item.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {Object.entries(groupedResults).map(([type, items]) => {
            if (items.length === 0) return null;
            
            return (
              <div key={type}>
                <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-900/50 sticky top-0">
                  {getTypeLabel(type as SearchResultType)}
                </div>
                {items.map((result, index) => {
                  const globalIndex = flatResults.indexOf(result);
                  const isSelected = globalIndex === selectedIndex;
                  
                  return (
                    <button
                      key={result.id}
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                        isSelected ? 'bg-slate-800' : 'hover:bg-slate-800/50'
                      )}
                    >
                      <div className="p-2 rounded-lg bg-slate-800/50">
                        {getIcon(result.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-200 truncate">
                          {result.title}
                        </div>
                        <div className="text-sm text-slate-500 truncate">
                          {result.subtitle}
                        </div>
                      </div>
                      {result.meta && (
                        <div className="text-sm text-slate-400 whitespace-nowrap">
                          {result.meta}
                        </div>
                      )}
                      {isSelected && (
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <CornerDownLeft size={14} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800">↓</kbd>
              navegar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800">↵</kbd>
              seleccionar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800">esc</kbd>
              cerrar
            </span>
          </div>
          <div>
            {results.length > 0 && `${results.length} resultados`}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// BOTÓN PARA HEADER
// ============================================

export function GlobalSearchButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/50 border border-slate-800/50 hover:border-slate-700/50 transition-all text-sm text-slate-400"
    >
      <Search size={16} />
      <span className="hidden md:inline">{t('common.search')}...</span>
      <kbd className="hidden md:flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-xs text-slate-500">
        <Command size={12} />K
      </kbd>
    </button>
  );
}