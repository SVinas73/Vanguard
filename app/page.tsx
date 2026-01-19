'use client';



import { WelcomeHeader, StatsGrid } from '@/components/dashboard';
import { InventoryValueCard, StockAlertsPanel, RecentActivityPanel } from '@/components/dashboard/enterprise';
import { AlmacenesDashboard } from '@/components/almacenes';
import { ImportCSV } from '@/components/import';
import { IntegracionesDashboard } from '@/components/integraciones';
import { ProductImage } from '@/components/productos';
import { VentasDashboard } from '@/components/ventas';
import { ComprasDashboard } from '@/components/compras';
import { OfflineIndicator } from '@/components/ui/offline-indicator';
import { AuditLogPanel } from '@/components/audit';
import { CostAnalysisDashboard } from '@/components/costs';
import { GlobalSearch } from '@/components/search';
import { ChatbotWidget } from '@/components/chatbot';
import { ExecutiveDashboard } from '@/components/reports';
import { QuickScanner } from '@/components/scanner';
import { AIPredictionsPanel, AIAnomaliesPanel, AIAssociationsPanel, AIStatusBadge } from '@/components/ai';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { Bot, Search, ArrowLeftRight, Plus, Package, User, Clock, DollarSign, TrendingUp, Box, AlertTriangle } from 'lucide-react';
import React, { useState, useMemo, useEffect } from 'react';
import { TabType, CategorySuggestion, AnomalyResult, Product, Almacen } from '@/types';
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
import { Sidebar } from '@/components/layout';
import { Button, Input, Select, Modal, Card, AIAlert } from '@/components/ui';
import { ProductTable } from '@/components/productos';
import { MovementList, MovementTypeSelector } from '@/components/movimientos';
import { AlertList, PredictionCard, ConsumptionChart } from '@/components/analytics';

export default function HomePage() {
  // ============================================
  // TODOS LOS HOOKS PRIMERO (antes de cualquier return)
  // ============================================
  
  // i18n
  const { t } = useTranslation();
  
  // Auth
  const { user, loading, hasPermission, isAdmin, rol } = useAuth();
  
  // Store
  const {
    products,
    movements,
    predictions,
    isLoading: storeLoading,
    error: storeError,
    isInitialized,
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

  // Almacenes State
  const [almacenes, setAlmacenes] = useState<Array<{ id: string; nombre: string }>>([]);

  // Form State - New Product
  const [newProduct, setNewProduct] = useState({
    codigo: '',
    descripcion: '',
    precio: '',
    categoria: '',
    stockMinimo: '10',
    almacenId: '',
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
    
    // Cargar almacenes
    const fetchAlmacenes = async () => {
      const { data } = await supabase
        .from('almacenes')
        .select('id, nombre')
        .eq('activo', true)
        .order('es_principal', { ascending: false });
      if (data) setAlmacenes(data);
    };
    fetchAlmacenes();
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

  // Dashboard stats - ACTUALIZADO
  const stats = useMemo(() => {
    const activeProducts = products.length;
    const lowStockCount = products.filter((p) => p.stock <= p.stockMinimo).length;
    const today = new Date();
    const todayMovements = movements.filter(
      (m) => new Date(m.timestamp).toDateString() === today.toDateString()
    ).length;

    // Calcular rotación promedio (días de inventario)
    // Fórmula: Stock actual / Consumo diario promedio
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const salesLast30Days = movements
      .filter(m => m.tipo === 'salida' && new Date(m.timestamp) >= thirtyDaysAgo)
      .reduce((sum, m) => sum + m.cantidad, 0);
    
    const dailyAvgSales = salesLast30Days / 30;
    const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
    const avgRotation = dailyAvgSales > 0 ? Math.round(totalStock / dailyAvgSales) : 0;

    return [
      { 
        label: t('dashboard.activeProducts', 'Productos Activos'), 
        value: formatNumber(activeProducts), 
        icon: <Package size={24} />, 
        color: 'emerald',
        subtitle: 'SKUs en catálogo'
      },
      { 
        label: t('dashboard.avgRotation', 'Rotación Promedio'), 
        value: avgRotation > 0 ? `${avgRotation}d` : '—', 
        icon: <TrendingUp size={24} />, 
        color: 'cyan',
        subtitle: t('dashboard.daysOfInventory', 'días de inventario')
      },
      { 
        label: t('dashboard.lowStock', 'Stock Bajo'), 
        value: lowStockCount.toString(), 
        icon: <AlertTriangle size={24} />, 
        color: lowStockCount > 0 ? 'amber' : 'slate' 
      },
      { 
        label: t('dashboard.movementsToday', 'Movimientos Hoy'), 
        value: todayMovements.toString(), 
        icon: <ArrowLeftRight size={24} />, 
        color: 'purple' 
      },
    ];
  }, [products, movements, t]);

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

  const almacenOptions = useMemo(() => {
    return almacenes.map((a) => ({ value: a.id, label: a.nombre }));
  }, [almacenes]);

  // ============================================
  // RETURNS CONDICIONALES (después de todos los hooks)
  // ============================================

  // Mostrar loading mientras verifica autenticación
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-emerald-400">{t('common.loading')}</div>
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

  // POR ESTE:
  // Mostrar loading mientras carga los datos del store
  if (!isInitialized || storeLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-solid border-emerald-500 border-r-transparent"></div>
          <div className="text-emerald-400">{t('common.loadingData', 'Cargando inventario...')}</div>
          {storeError && (
            <div className="text-red-400 text-sm max-w-md mx-auto mt-4">
              {storeError}
              <button 
                onClick={() => {
                  fetchProducts();
                  fetchMovements();
                }}
                className="block mx-auto mt-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 rounded-lg text-slate-950 font-medium"
              >
                Reintentar
              </button>
            </div>
          )}
        </div>
      </div>
    );
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
      almacenId: newProduct.almacenId || null,
    }, user?.email || 'Sistema');

    setNewProduct({ codigo: '', descripcion: '', precio: '', categoria: '', stockMinimo: '10', almacenId: '' });
    setShowNewProduct(false);
    setAiSuggestion(null);
  };

  // Edit product handler
  const handleEditProduct = () => {
    console.log('handleEditProduct called', editProduct);
    if (!editProduct) return;
    updateProduct(editProduct.codigo, {
      descripcion: editProduct.descripcion,
      precio: editProduct.precio,
      categoria: editProduct.categoria,
      stockMinimo: editProduct.stockMinimo,
      stock: editProduct.stock,
      almacenId: editProduct.almacenId,
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
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        permissions={{
          canViewCosts: hasPermission('canViewCosts'),
          canViewAudit: hasPermission('canViewAudit'),
          canViewReports: hasPermission('canViewReports'),
        }}
      />

      <main className="ml-[260px] transition-all duration-300 min-h-screen">
        <div className="max-w-7xl mx-auto px-6 py-6">

        {/* ==================== DASHBOARD ==================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Welcome Header */}
            <WelcomeHeader userName={user?.nombre || user?.email?.split('@')[0]} />

            {/* Stats */}
            <StatsGrid stats={stats} />

            {/* Enterprise Panels Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <InventoryValueCard 
                products={products}
                movements={movements}
                onCategoryClick={(category) => {
                  setSelectedCategory(category);
                  setActiveTab('stock');
                }}
              />
              <StockAlertsPanel 
                products={products}
                predictions={predictions}
                onProductClick={(product) => handleOpenEdit(product)}
                onCreatePurchaseOrder={(productsAtRisk) => {
                  setActiveTab('compras');
                }}
              />
            </div>

            {/* Activity + Chart Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <Card>
                  <ConsumptionChart movements={movements} products={products} />
                </Card>
              </div>
              <RecentActivityPanel 
                movements={movements}
                products={products}
                maxItems={8}
              />
            </div>

            {/* AI Panels */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <AIPredictionsPanel />
              <AIAnomaliesPanel />
              <AIAssociationsPanel />
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
                  placeholder={t('stock.search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-3 pl-10 rounded-xl bg-slate-900/50 border border-slate-800/50 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm"
                />
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                {searchQuery && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-emerald-400">{t('stock.aiActive')}</span>
                )}
              </div>
              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                options={[{ value: 'all', label: t('stock.allCategories') }, ...categoryOptions]}
                className="min-w-[180px]"
              />
              {hasPermission('canCreateProducts') && (
                <div className="flex gap-2">
                  <ImportCSV onImportComplete={fetchProducts} userEmail={user?.email || ''} />
                  <Button onClick={() => setShowNewProduct(true)}>+ {t('stock.new')}</Button>
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
              <h2 className="text-lg font-semibold">{t('movements.title')}</h2>
              <Button onClick={() => setShowNewMovement(true)}>+ {t('movements.register')}</Button>
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
                <h2 className="text-lg font-semibold">{t('analytics.title')}</h2>
              </div>
              <p className="text-sm text-slate-400 mb-6">
                {t('analytics.description')}
              </p>

              <div className="grid gap-4">
                {productsWithPredictions.map(({ product, prediction }) => (
                  <PredictionCard key={product.codigo} product={product} prediction={prediction} />
                ))}
                {productsWithPredictions.length === 0 && (
                  <div className="p-8 text-center text-slate-500">
                    {t('analytics.noData')}
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
      </main>

      {/* ==================== MODAL: NUEVO PRODUCTO ==================== */}
      <Modal isOpen={showNewProduct} onClose={() => setShowNewProduct(false)} title={t('stock.newProduct')}>
        <div className="space-y-4">
          <Input
            label={t('stock.code')}
            value={newProduct.codigo}
            onChange={(e) => setNewProduct({ ...newProduct, codigo: e.target.value.toUpperCase() })}
            placeholder="EJ: ACE-001"
          />
          <Input
            label={t('stock.description')}
            value={newProduct.descripcion}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            placeholder={t('stock.description')}
          />

          {aiSuggestion && aiSuggestion.categoria && (
            <AIAlert type="info">
              {t('common.suggestion')}: <strong>{aiSuggestion.categoria}</strong> ({Math.round(aiSuggestion.confidence * 100)}% {t('common.confidence')})
              <button
                onClick={() => {
                  setNewProduct({ ...newProduct, categoria: aiSuggestion.categoria! });
                  setAiSuggestion(null);
                }}
                className="ml-2 text-emerald-400 hover:underline"
              >
                {t('common.apply')}
              </button>
            </AIAlert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('stock.salePrice')}
              type="number"
              step="0.01"
              value={newProduct.precio}
              onChange={(e) => setNewProduct({ ...newProduct, precio: e.target.value })}
              placeholder="0.00"
            />
            <Input
              label={t('stock.minStock')}
              type="number"
              value={newProduct.stockMinimo}
              onChange={(e) => setNewProduct({ ...newProduct, stockMinimo: e.target.value })}
              placeholder="10"
            />
          </div>

          <Select
            label={t('stock.category')}
            value={newProduct.categoria}
            onChange={(e) => setNewProduct({ ...newProduct, categoria: e.target.value })}
            options={categoryOptions}
            placeholder={t('stock.selectCategory')}
          />

          <Select
            label={t('stock.warehouse')}
            value={newProduct.almacenId}
            onChange={(e) => setNewProduct({ ...newProduct, almacenId: e.target.value })}
            options={almacenOptions}
            placeholder={t('common.select')}
          />
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="secondary" onClick={() => setShowNewProduct(false)} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button onClick={handleAddProduct} className="flex-1">
            {t('stock.addProduct')}
          </Button>
        </div>
      </Modal>

      {/* ==================== MODAL: EDITAR PRODUCTO ==================== */}
      <Modal isOpen={showEditProduct} onClose={() => setShowEditProduct(false)} title={t('stock.editProduct')}>
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
                  <div className="font-medium text-slate-200 mb-1">{t('stock.productImage')}</div>
                  <div>{t('stock.clickToUpload')}</div>
                  <div className="text-xs">{t('stock.maxSize')}</div>
                </div>
              </div>
              <Input
                label={t('stock.code')}
                value={editProduct.codigo}
                disabled
                className="opacity-50"
              />
              <Input
                label={t('stock.description')}
                value={editProduct.descripcion}
                onChange={(e) => handleDescriptionChange(e.target.value, true)}
                placeholder={t('stock.description')}
              />

              {aiSuggestion && aiSuggestion.categoria && (
                <AIAlert type="info">
                  {t('common.suggestion')}: <strong>{aiSuggestion.categoria}</strong> ({Math.round(aiSuggestion.confidence * 100)}% {t('common.confidence')})
                  <button
                    onClick={() => {
                      setEditProduct({ ...editProduct, categoria: aiSuggestion.categoria! });
                      setAiSuggestion(null);
                    }}
                    className="ml-2 text-emerald-400 hover:underline"
                  >
                    {t('common.apply')}
                  </button>
                </AIAlert>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label={t('stock.salePrice')}
                  type="number"
                  step="0.01"
                  value={editProduct.precio.toString()}
                  onChange={(e) => setEditProduct({ ...editProduct, precio: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
                <Input
                  label={t('stock.minStock')}
                  type="number"
                  value={editProduct.stockMinimo.toString()}
                  onChange={(e) => setEditProduct({ ...editProduct, stockMinimo: parseInt(e.target.value) || 0 })}
                  placeholder="10"
                />
              </div>

              <Select
                label={t('stock.category')}
                value={editProduct.categoria}
                onChange={(e) => setEditProduct({ ...editProduct, categoria: e.target.value })}
                options={categoryOptions}
                placeholder={t('stock.selectCategory')}
              />

              <Select
                label={t('stock.warehouse')}
                value={editProduct.almacenId || ''}
                onChange={(e) => setEditProduct({ ...editProduct, almacenId: e.target.value || null })}
                options={almacenOptions}
                placeholder={t('common.select')}
              />

              <Input
                label={t('stock.currentStock')}
                type="number"
                value={editProduct.stock.toString()}
                onChange={(e) => setEditProduct({ ...editProduct, stock: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="secondary" onClick={() => setShowEditProduct(false)} className="flex-1">
                {t('common.cancel')}
              </Button>
              <Button onClick={handleEditProduct} className="flex-1">
                {t('stock.saveChanges')}
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* ==================== MODAL: NUEVO MOVIMIENTO ==================== */}
      <Modal isOpen={showNewMovement} onClose={() => setShowNewMovement(false)} title={t('movements.register')}>
        <div className="space-y-4">
          <Select
            label={t('movements.product')}
            value={newMovement.codigo}
            onChange={(e) => setNewMovement({ ...newMovement, codigo: e.target.value })}
            options={productOptions}
            placeholder={t('movements.selectProduct')}
          />

          <div>
            <label className="block text-sm text-slate-400 mb-2">{t('movements.type')}</label>
            <MovementTypeSelector
              value={newMovement.tipo}
              onChange={(tipo) => setNewMovement({ ...newMovement, tipo, costoCompra: tipo === 'salida' ? '' : newMovement.costoCompra })}
            />
          </div>

          <Input
            label={t('movements.quantity')}
            type="number"
            value={newMovement.cantidad}
            onChange={(e) => handleMovementQuantityChange(e.target.value)}
            placeholder="0"
          />

          {newMovement.tipo === 'entrada' && (
            <Input
              label={t('movements.purchaseCost')}
              type="number"
              step="0.01"
              value={newMovement.costoCompra}
              onChange={(e) => setNewMovement({ ...newMovement, costoCompra: e.target.value })}
              placeholder={t('movements.howMuchPaid')}
            />
          )}

          {anomalyWarning && (
            <AIAlert type="warning">{anomalyWarning.reason}</AIAlert>
          )}

          <Input
            label={t('movements.notes')}
            value={newMovement.notas}
            onChange={(e) => setNewMovement({ ...newMovement, notas: e.target.value })}
            placeholder={t('movements.notesPlaceholder')}
          />

          <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/30 text-sm">
            <div className="flex items-center gap-2 text-slate-400">
              <User size={16} />
              <span>{t('movements.user')}: <strong className="text-slate-200">{user.email}</strong></span>
              <span className="mx-2">•</span>
              <Clock size={16} />
              <span>{formatDate(new Date())}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="secondary" onClick={() => setShowNewMovement(false)} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button
            variant={newMovement.tipo === 'entrada' ? 'primary' : 'danger'}
            onClick={handleAddMovement}
            className="flex-1"
          >
            {newMovement.tipo === 'entrada' ? t('movements.registerEntry') : t('movements.registerExit')}
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

      {/* Buscador Global - Ctrl+K */}
      <GlobalSearch 
        onNavigate={(tab) => setActiveTab(tab as TabType)}
        onSelectProduct={(product) => handleOpenEdit(product)}
      />
      
    </div>
  );
}