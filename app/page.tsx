'use client';

import { AlmacenesDashboard } from '@/components/almacenes';
import { ImportCSV } from '@/components/import';
import { IntegracionesDashboard } from '@/components/integraciones';
import { ProductImage } from '@/components/productos';
import { VentasDashboard } from '@/components/ventas';
import { ComprasDashboard } from '@/components/compras';
import { OfflineIndicator } from '@/components/ui/offline-indicator';
import { AuditLogPanel } from '@/components/audit';
import { CostAnalysisDashboard } from '@/components/costs';
import { ChatbotWidget } from '@/components/chatbot';
import { ExecutiveDashboard } from '@/components/reports';
import { QuickScanner } from '@/components/scanner';
import { AIPredictionsPanel, AIAnomaliesPanel, AIAssociationsPanel, AIStatusBadge } from '@/components/ai';
import { useAuth } from '@/hooks/useAuth';
import { Bot, Search, ArrowLeftRight, Plus, Package, User, Clock, DollarSign, Box, AlertTriangle } from 'lucide-react';
import React, { useState, useMemo, useEffect } from 'react';
import { TabType, CategorySuggestion, AnomalyResult, Product } from '@/types';
import { useInventoryStore } from '@/store';
import { CATEGORIA_NOMBRES } from '@/lib/constants';
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils';
import {
  semanticSearch,
  suggestCategory,
  checkMovementAnomaly,
  getStockAlerts,
} from '@/lib/ai';

// Components
import { Header, NavTabs } from '@/components/layout';
import { Button, Input, Select, Modal, Card, AIAlert } from '@/components/ui';
import { ProductTable } from '@/components/productos';
import { MovementList, MovementTypeSelector } from '@/components/movimientos';
import { StatsGrid, AlertList, PredictionCard, ConsumptionChart } from '@/components/analytics';

export default function HomePage() {
  // ============================================
  // TODOS LOS HOOKS PRIMERO (antes de cualquier return)
  // ============================================
  
  // Auth
  const { user, loading, hasPermission, isAdmin, rol } = useAuth();
  
  // Store
  const {
    products,
    movements,
    predictions,
    isLoading: storeLoading,
    error: storeError,
    addProduct,
    updateProduct,
    deleteProduct,
    addMovement,
    fetchProducts,
    fetchMovements,
    refreshPredictions,
  } = useInventoryStore();

  // UI State
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Modal State
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [showNewMovement, setShowNewMovement] = useState(false);
  const [showEditProduct, setShowEditProduct] = useState(false);

  // Form State - New Product
  const [newProduct, setNewProduct] = useState({
    codigo: '',
    descripcion: '',
    precio: '',
    categoria: '',
    stockMinimo: '10',
  });
  const [aiSuggestion, setAiSuggestion] = useState<CategorySuggestion | null>(null);

  // Form State - Edit Product
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  // Form State - New Movement
  const [newMovement, setNewMovement] = useState({
    codigo: '',
    tipo: 'entrada' as 'entrada' | 'salida',
    cantidad: '',
    notas: '',
    costoCompra: '',
  });
  const [anomalyWarning, setAnomalyWarning] = useState<AnomalyResult | null>(null);

  // Cargar datos de Supabase al inicio
  useEffect(() => {
    fetchProducts();
    fetchMovements();
  }, [fetchProducts, fetchMovements]);

  // Filtered products with semantic search
  const filteredProducts = useMemo(() => {
    let result = products;
    if (searchQuery.trim()) {
      result = semanticSearch(searchQuery, products);
    }
    if (selectedCategory !== 'all') {
      result = result.filter((p) => p.categoria === selectedCategory);
    }
    return result;
  }, [products, searchQuery, selectedCategory]);

  // Stock alerts
  const stockAlerts = useMemo(() => {
    return getStockAlerts(products, predictions);
  }, [products, predictions]);

  // Dashboard stats
  const stats = useMemo(() => {
    const totalValue = products.reduce((sum, p) => sum + p.precio * p.stock, 0);
    const totalItems = products.reduce((sum, p) => sum + p.stock, 0);
    const lowStockCount = products.filter((p) => p.stock <= p.stockMinimo).length;
    const today = new Date();
    const todayMovements = movements.filter(
      (m) => new Date(m.timestamp).toDateString() === today.toDateString()
    ).length;

    return [
      { label: 'Valor Total', value: formatCurrency(totalValue), icon: <DollarSign size={24} />, color: 'emerald' },
      { label: 'Items en Stock', value: formatNumber(totalItems), icon: <Box size={24} />, color: 'cyan' },
      { label: 'Stock Bajo', value: lowStockCount.toString(), icon: <AlertTriangle size={24} />, color: lowStockCount > 0 ? 'amber' : 'slate' },
      { label: 'Movimientos Hoy', value: todayMovements.toString(), icon: <ArrowLeftRight size={24} />, color: 'purple' },
    ];
  }, [products, movements]);

  // Products with predictions for analytics
  const productsWithPredictions = useMemo(() => {
    return products
      .map((p) => ({ product: p, prediction: predictions[p.codigo] }))
      .filter((p) => p.prediction && p.prediction.days !== null && p.prediction.days !== Infinity)
      .sort((a, b) => (a.prediction.days || 0) - (b.prediction.days || 0))
      .slice(0, 8);
  }, [products, predictions]);

  // Options for selects
  const categoryOptions = useMemo(() => {
    return CATEGORIA_NOMBRES.map((c) => ({ value: c, label: c }));
  }, []);
  
  const productOptions = useMemo(() => {
    return products.map((p) => ({ value: p.codigo, label: `${p.codigo} - ${p.descripcion}` }));
  }, [products]);

  // ============================================
  // RETURNS CONDICIONALES (después de todos los hooks)
  // ============================================

  // Mostrar loading mientras verifica autenticación
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-emerald-400">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Mostrar error si hay
  if (storeError) {
    console.error('Error de Supabase:', storeError);
  }

  // ============================================
  // HANDLERS (funciones normales, no hooks)
  // ============================================

  // Handle description change (AI category suggestion)
  const handleDescriptionChange = (desc: string, isEdit: boolean = false) => {
    if (isEdit && editProduct) {
      setEditProduct({ ...editProduct, descripcion: desc });
    } else {
      setNewProduct({ ...newProduct, descripcion: desc });
    }
    
    if (desc.length > 5) {
      const suggestion = suggestCategory(desc);
      setAiSuggestion(suggestion.confidence > 0.5 ? suggestion : null);
    } else {
      setAiSuggestion(null);
    }
  };

  // Handle movement quantity change (anomaly detection)
  const handleMovementQuantityChange = (cantidad: string) => {
    setNewMovement({ ...newMovement, cantidad });
    if (cantidad && newMovement.codigo) {
      const anomaly = checkMovementAnomaly(
        newMovement.codigo,
        newMovement.tipo,
        parseInt(cantidad) || 0,
        products,
        movements
      );
      setAnomalyWarning(anomaly.isAnomaly ? anomaly : null);
    } else {
      setAnomalyWarning(null);
    }
  };

  // Add product handler
  const handleAddProduct = () => {
    if (!newProduct.codigo || !newProduct.descripcion || !newProduct.precio || !newProduct.categoria) {
      return;
    }
    addProduct({
      codigo: newProduct.codigo.toUpperCase(),
      descripcion: newProduct.descripcion,
      precio: parseFloat(newProduct.precio),
      categoria: newProduct.categoria,
      stockMinimo: parseInt(newProduct.stockMinimo) || 10,
    }, user?.email || 'Sistema');

    setNewProduct({ codigo: '', descripcion: '', precio: '', categoria: '', stockMinimo: '10' });
    setShowNewProduct(false);
    setAiSuggestion(null);
  };

  // Edit product handler
  const handleEditProduct = () => {
    if (!editProduct) return;
    updateProduct(editProduct.codigo, {
      descripcion: editProduct.descripcion,
      precio: editProduct.precio,
      categoria: editProduct.categoria,
      stockMinimo: editProduct.stockMinimo,
      stock: editProduct.stock,
    }, user?.email || 'Sistema');

    setEditProduct(null);
    setShowEditProduct(false);
    setAiSuggestion(null);
  };

  // Open edit modal
  const handleOpenEdit = (product: Product) => {
    setEditProduct({ ...product });
    setShowEditProduct(true);
  };

  // Add movement handler
  const handleAddMovement = () => {
    if (!newMovement.codigo || !newMovement.cantidad) return;
    
    const movementData: any = {
      codigo: newMovement.codigo,
      tipo: newMovement.tipo,
      cantidad: parseInt(newMovement.cantidad),
      notas: newMovement.notas,
    };

    // Agregar costo de compra solo si es entrada y tiene valor
    if (newMovement.tipo === 'entrada' && newMovement.costoCompra) {
      movementData.costoCompra = parseFloat(newMovement.costoCompra);
    }

    addMovement(movementData, user?.email || 'Sistema');
    setNewMovement({ codigo: '', tipo: 'entrada', cantidad: '', notas: '', costoCompra: '' });
    setShowNewMovement(false);
    setAnomalyWarning(null);
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />

      <div className="max-w-7xl mx-auto px-6 py-6">
        <NavTabs 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          permissions={{
            canViewCosts: hasPermission('canViewCosts'),
            canViewAudit: hasPermission('canViewAudit'),
            canViewReports: hasPermission('canViewReports'),
          }}
        />

        {/* ==================== DASHBOARD ==================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <StatsGrid stats={stats} />

            {stockAlerts.length > 0 && (
              <Card variant="gradient">
                <h3 className="text-sm font-semibold text-amber-400 mb-4 flex items-center gap-2">
                  <Bot size={18} /> Alertas Inteligentes
                </h3>
                <AlertList products={stockAlerts} predictions={predictions} maxItems={100} />
              </Card>
            )}

            {/* Gráfica de consumo */}
            <Card>
              <ConsumptionChart movements={movements} products={products} />
            </Card>

            {/* Paneles de IA */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <AIPredictionsPanel />
              <AIAnomaliesPanel />
              <AIAssociationsPanel />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setShowNewMovement(true)}
                className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 hover:border-emerald-500/40 transition-all text-left group"
              >
                <div className="mb-2 group-hover:scale-110 transition-transform inline-block"><ArrowLeftRight size={28} /></div>
                <div className="font-semibold text-emerald-400">Registrar Movimiento</div>
                <div className="text-sm text-slate-500">Entrada o salida de inventario</div>
              </button>
              <button
                onClick={() => setShowNewProduct(true)}
                className="p-5 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 hover:border-purple-500/40 transition-all text-left group"
              >
                <div className="mb-2 group-hover:scale-110 transition-transform inline-block"><Plus size={28} /></div>
                <div className="font-semibold text-purple-400">Nuevo Producto</div>
                <div className="text-sm text-slate-500">Agregar al catálogo</div>
              </button>
            </div>
          </div>
        )}

        {/* ==================== PRODUCTOS ==================== */}
        {activeTab === 'stock' && (
          <div className="space-y-4">
            <div className="flex gap-4 items-center">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Buscar productos (búsqueda inteligente)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-3 pl-10 rounded-xl bg-slate-900/50 border border-slate-800/50 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm"
                />
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                {searchQuery && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-emerald-400">IA activa</span>
                )}
              </div>
              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                options={[{ value: 'all', label: 'Todas las categorías' }, ...categoryOptions]}
                className="min-w-[180px]"
              />
              {hasPermission('canCreateProducts') && (
                <div className="flex gap-2">
                  <ImportCSV onImportComplete={fetchProducts} userEmail={user?.email || ''} />
                  <Button onClick={() => setShowNewProduct(true)}>+ Nuevo</Button>
                </div>
              )}
            </div>

            <ProductTable 
              products={filteredProducts} 
              predictions={predictions} 
              onDelete={hasPermission('canDeleteProducts') ? (codigo) => deleteProduct(codigo, user?.email || 'Sistema') : undefined}
              onEdit={handleOpenEdit}
            />
          </div>
        )}

        {/* ==================== MOVIMIENTOS ==================== */}
        {activeTab === 'movimientos' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Historial de Movimientos</h2>
              <Button onClick={() => setShowNewMovement(true)}>+ Registrar</Button>
            </div>
            <MovementList movements={movements} products={products} />
          </div>
        )}

        {/* ==================== COMPRAS ==================== */}
        {activeTab === 'compras' && (
          <div className="space-y-4">
            <ComprasDashboard products={products} userEmail={user?.email || ''} />
          </div>
        )}

        {/* ==================== VENTAS ==================== */}
        {activeTab === 'ventas' && (
          <div className="space-y-4">
            <VentasDashboard products={products} userEmail={user?.email || ''} />
          </div>
        )}

        {/* ==================== ANALYTICS ==================== */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <Card variant="gradient">
              <div className="flex items-center gap-3 mb-4">
                <Bot size={28} />
                <h2 className="text-lg font-semibold">Análisis Predictivo de Inventario</h2>
              </div>
              <p className="text-sm text-slate-400 mb-6">
                Predicciones basadas en patrones históricos de consumo usando modelos estadísticos locales.
              </p>

              <div className="grid gap-4">
                {productsWithPredictions.map(({ product, prediction }) => (
                  <PredictionCard key={product.codigo} product={product} prediction={prediction} />
                ))}
                {productsWithPredictions.length === 0 && (
                  <div className="p-8 text-center text-slate-500">
                    No hay suficientes datos para generar predicciones. Registra más movimientos.
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ==================== REPORTES ==================== */}
        {activeTab === 'reportes' && (
          <div className="max-w-5xl mx-auto">
            <ExecutiveDashboard products={products} movements={movements} />
          </div>
        )}

        {/* ==================== COSTOS ==================== */}
        {activeTab === 'costos' && (
          <div className="max-w-5xl mx-auto">
            <CostAnalysisDashboard products={products} />
          </div>
        )}

        {/* ==================== AUDITORÍA ==================== */}
        {activeTab === 'auditoria' && (
          <div className="max-w-5xl mx-auto">
            <AuditLogPanel />
          </div>
        )}

        {/* ==================== INTEGRACIONES ==================== */}
        {activeTab === 'integraciones' && (
          <div className="max-w-4xl mx-auto">
            <IntegracionesDashboard />
          </div>
        )}

        {/* ==================== ALMACENES ==================== */}
        {activeTab === 'almacenes' && (
          <div className="max-w-5xl mx-auto">
            <AlmacenesDashboard products={products} userEmail={user?.email || ''} />
          </div>
        )}
      </div>

      {/* ==================== MODAL: NUEVO PRODUCTO ==================== */}
      <Modal isOpen={showNewProduct} onClose={() => setShowNewProduct(false)} title="Nuevo Producto">
        <div className="space-y-4">
          <Input
            label="Código"
            value={newProduct.codigo}
            onChange={(e) => setNewProduct({ ...newProduct, codigo: e.target.value.toUpperCase() })}
            placeholder="EJ: ACE-001"
          />
          <Input
            label="Descripción"
            value={newProduct.descripcion}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            placeholder="Descripción del producto..."
          />

          {aiSuggestion && aiSuggestion.categoria && (
            <AIAlert type="info">
              Sugerencia: <strong>{aiSuggestion.categoria}</strong> ({Math.round(aiSuggestion.confidence * 100)}% confianza)
              <button
                onClick={() => {
                  setNewProduct({ ...newProduct, categoria: aiSuggestion.categoria! });
                  setAiSuggestion(null);
                }}
                className="ml-2 text-emerald-400 hover:underline"
              >
                Aplicar
              </button>
            </AIAlert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Precio de Venta"
              type="number"
              step="0.01"
              value={newProduct.precio}
              onChange={(e) => setNewProduct({ ...newProduct, precio: e.target.value })}
              placeholder="0.00"
            />
            <Input
              label="Stock Mínimo"
              type="number"
              value={newProduct.stockMinimo}
              onChange={(e) => setNewProduct({ ...newProduct, stockMinimo: e.target.value })}
              placeholder="10"
            />
          </div>

          <Select
            label="Categoría"
            value={newProduct.categoria}
            onChange={(e) => setNewProduct({ ...newProduct, categoria: e.target.value })}
            options={categoryOptions}
            placeholder="Seleccionar categoría..."
          />
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="secondary" onClick={() => setShowNewProduct(false)} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleAddProduct} className="flex-1">
            Agregar Producto
          </Button>
        </div>
      </Modal>

      {/* ==================== MODAL: EDITAR PRODUCTO ==================== */}
      <Modal isOpen={showEditProduct} onClose={() => setShowEditProduct(false)} title="Editar Producto">
        {editProduct && (
          <>
            <div className="space-y-4">
              {/* Imagen del producto */}
              <div className="flex items-center gap-4">
                <ProductImage 
                  productoCodigo={editProduct.codigo} 
                  imageUrl={editProduct.imagenUrl}
                  size="lg"
                  onImageChange={(url) => setEditProduct({ ...editProduct, imagenUrl: url })}
                />
                <div className="text-sm text-slate-400">
                  <div className="font-medium text-slate-200 mb-1">Imagen del producto</div>
                  <div>Click para subir o cambiar</div>
                  <div className="text-xs">Máximo 2MB (JPG, PNG)</div>
                </div>
              </div>
              <Input
                label="Código"
                value={editProduct.codigo}
                disabled
                className="opacity-50"
              />
              <Input
                label="Descripción"
                value={editProduct.descripcion}
                onChange={(e) => handleDescriptionChange(e.target.value, true)}
                placeholder="Descripción del producto..."
              />

              {aiSuggestion && aiSuggestion.categoria && (
                <AIAlert type="info">
                  Sugerencia: <strong>{aiSuggestion.categoria}</strong> ({Math.round(aiSuggestion.confidence * 100)}% confianza)
                  <button
                    onClick={() => {
                      setEditProduct({ ...editProduct, categoria: aiSuggestion.categoria! });
                      setAiSuggestion(null);
                    }}
                    className="ml-2 text-emerald-400 hover:underline"
                  >
                    Aplicar
                  </button>
                </AIAlert>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Precio de Venta"
                  type="number"
                  step="0.01"
                  value={editProduct.precio.toString()}
                  onChange={(e) => setEditProduct({ ...editProduct, precio: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
                <Input
                  label="Stock Mínimo"
                  type="number"
                  value={editProduct.stockMinimo.toString()}
                  onChange={(e) => setEditProduct({ ...editProduct, stockMinimo: parseInt(e.target.value) || 0 })}
                  placeholder="10"
                />
              </div>

              <Select
                label="Categoría"
                value={editProduct.categoria}
                onChange={(e) => setEditProduct({ ...editProduct, categoria: e.target.value })}
                options={categoryOptions}
                placeholder="Seleccionar categoría..."
              />

              <Input
                label="Stock Actual (para ajuste de inventario)"
                type="number"
                value={editProduct.stock.toString()}
                onChange={(e) => setEditProduct({ ...editProduct, stock: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="secondary" onClick={() => setShowEditProduct(false)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleEditProduct} className="flex-1">
                Guardar Cambios
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* ==================== MODAL: NUEVO MOVIMIENTO ==================== */}
      <Modal isOpen={showNewMovement} onClose={() => setShowNewMovement(false)} title="Registrar Movimiento">
        <div className="space-y-4">
          <Select
            label="Producto"
            value={newMovement.codigo}
            onChange={(e) => setNewMovement({ ...newMovement, codigo: e.target.value })}
            options={productOptions}
            placeholder="Seleccionar producto..."
          />

          <div>
            <label className="block text-sm text-slate-400 mb-2">Tipo de Movimiento</label>
            <MovementTypeSelector
              value={newMovement.tipo}
              onChange={(tipo) => setNewMovement({ ...newMovement, tipo, costoCompra: tipo === 'salida' ? '' : newMovement.costoCompra })}
            />
          </div>

          <Input
            label="Cantidad"
            type="number"
            value={newMovement.cantidad}
            onChange={(e) => handleMovementQuantityChange(e.target.value)}
            placeholder="0"
          />

          {newMovement.tipo === 'entrada' && (
            <Input
              label="Costo de Compra (por unidad)"
              type="number"
              step="0.01"
              value={newMovement.costoCompra}
              onChange={(e) => setNewMovement({ ...newMovement, costoCompra: e.target.value })}
              placeholder="¿A cuánto compraste?"
            />
          )}

          {anomalyWarning && (
            <AIAlert type="warning">{anomalyWarning.reason}</AIAlert>
          )}

          <Input
            label="Notas (opcional)"
            value={newMovement.notas}
            onChange={(e) => setNewMovement({ ...newMovement, notas: e.target.value })}
            placeholder="Ej: Compra proveedor X, Factura #123"
          />

          <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/30 text-sm">
            <div className="flex items-center gap-2 text-slate-400">
              <User size={16} />
              <span>Usuario: <strong className="text-slate-200">{user.email}</strong></span>
              <span className="mx-2">•</span>
              <Clock size={16} />
              <span>{formatDate(new Date())}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="secondary" onClick={() => setShowNewMovement(false)} className="flex-1">
            Cancelar
          </Button>
          <Button
            variant={newMovement.tipo === 'entrada' ? 'primary' : 'danger'}
            onClick={handleAddMovement}
            className="flex-1"
          >
            Registrar {newMovement.tipo === 'entrada' ? 'Entrada' : 'Salida'}
          </Button>
        </div>
      </Modal>

      {/* Scanner de código de barras */}
      <QuickScanner
        products={products}
        onProductFound={(product) => console.log('Producto encontrado:', product)}
        onOpenMovement={(product, tipo) => {
          setNewMovement({ ...newMovement, codigo: product.codigo, tipo });
          setShowNewMovement(true);
        }}
      />

      {/* Chatbot IA */}
      <ChatbotWidget />

      {/* Indicador offline */}
      <OfflineIndicator />
      
    </div>
  );
}