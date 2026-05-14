'use client';

import dynamic from 'next/dynamic';
import { ComercialSubTab } from '@/components/comercial';

// Módulos del dashboard que se ven al toque (no se splittean)
import { WelcomeHeader, StatsGrid, InsightsPanel, CrossModuleSummary, InventoryTrendChart, PeriodSelector } from '@/components/dashboard';
import { InventoryValueCard, StockAlertsPanel, RecentActivityPanel } from '@/components/dashboard/enterprise';
import { OfflineIndicator } from '@/components/ui/offline-indicator';
import { GlobalSearch } from '@/components/search';
import { ChatbotWidget } from '@/components/chatbot';
import { CommandPalette, useCommandPalette, type CommandAction } from '@/components/ui/command-palette';
import { useFocusMode, FocusModeToggle, FocusModeBanner } from '@/components/ui/focus-mode';
import { useStressDetector, setDeteccionStressDeshabilitada } from '@/hooks/useStressDetector';
import StressPrompt from '@/components/ui/StressPrompt';
import MiDia from '@/components/dashboard/MiDia';
import { AIStatusBadge } from '@/components/ai';
import { ProductImage } from '@/components/productos';

// Loader compartido para los módulos splitteados
const ModuleLoader = () => (
  <div className="flex items-center justify-center p-12 text-slate-500 text-sm gap-2">
    <RefreshCw className="h-4 w-4 animate-spin" />
    Cargando módulo...
  </div>
);

// Módulos pesados: lazy-load con next/dynamic.
// Esto reduce el bundle inicial dramáticamente.
const ComercialModule       = dynamic(() => import('@/components/comercial').then(m => ({ default: m.ComercialModule })),       { loading: ModuleLoader });
const ChatModule            = dynamic(() => import('@/components/chat').then(m => ({ default: m.ChatModule })),                  { loading: ModuleLoader });
const DemandPlanningModule  = dynamic(() => import('@/components/demand-planning').then(m => ({ default: m.DemandPlanningModule })), { loading: ModuleLoader });
const WMSModule             = dynamic(() => import('@/components/wms').then(m => ({ default: m.WMSModule })),                    { loading: ModuleLoader });
const QMSModule             = dynamic(() => import('@/components/qms').then(m => ({ default: m.QMSModule })),                    { loading: ModuleLoader });
const ProyectosDashboard    = dynamic(() => import('@/components/proyectos').then(m => ({ default: m.ProyectosDashboard })),     { loading: ModuleLoader });
const StockDashboard        = dynamic(() => import('@/components/stock').then(m => ({ default: m.StockDashboard })),             { loading: ModuleLoader });
const ImportCSV             = dynamic(() => import('@/components/import').then(m => ({ default: m.ImportCSV })),                 { loading: ModuleLoader });
const IntegracionesDashboard = dynamic(() => import('@/components/integraciones/IntegracionesModule'), { loading: ModuleLoader });
const TallerEnterprise      = dynamic(() => import('@/components/taller'),                                                       { loading: ModuleLoader });
const AuditLogPanel         = dynamic(() => import('@/components/audit').then(m => ({ default: m.AuditLogPanel })),              { loading: ModuleLoader });
const ReportsEnterprise     = dynamic(() => import('@/components/reports').then(m => ({ default: m.ReportsEnterprise })),        { loading: ModuleLoader });
const QuickScanner          = dynamic(() => import('@/components/scanner').then(m => ({ default: m.QuickScanner })),             { loading: ModuleLoader });
const AIPredictionsPanel    = dynamic(() => import('@/components/ai').then(m => ({ default: m.AIPredictionsPanel })),            { loading: ModuleLoader });
const AIAnomaliesPanel      = dynamic(() => import('@/components/ai').then(m => ({ default: m.AIAnomaliesPanel })),              { loading: ModuleLoader });
const AIAssociationsPanel   = dynamic(() => import('@/components/ai').then(m => ({ default: m.AIAssociationsPanel })),           { loading: ModuleLoader });
const SerialManagement      = dynamic(() => import('@/components/serialization/SerialManagement'),                               { loading: ModuleLoader });
const TraceabilityViewer    = dynamic(() => import('@/components/traceability/TraceabilityViewer'),                              { loading: ModuleLoader });
const RMADashboard          = dynamic(() => import('@/components/rma/RMADashboard'),                                             { loading: ModuleLoader });
const BOMManager            = dynamic(() => import('@/components/bom/BOMManager'),                                               { loading: ModuleLoader });
const AssemblyDashboard     = dynamic(() => import('@/components/assembly/AssemblyDashboard'),                                   { loading: ModuleLoader });
const ApprovalsInbox        = dynamic(() => import('@/components/approvals/ApprovalsInbox'),                                     { loading: ModuleLoader });
const FacturasElectronicas  = dynamic(() => import('@/components/facturacion/FacturasElectronicas'),                             { loading: ModuleLoader });
const TicketsModule         = dynamic(() => import('@/components/tickets/TicketsModule'),                                        { loading: ModuleLoader });
const GarantiasModule       = dynamic(() => import('@/components/garantias/GarantiasModule'),                                    { loading: ModuleLoader });
const RRHHModule            = dynamic(() => import('@/components/rrhh/RRHHModule'),                                                { loading: ModuleLoader });
const HistorialCliente      = dynamic(() => import('@/components/clientes/HistorialCliente'),                                    { loading: ModuleLoader });
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { Bot, Search, ArrowLeftRight, Plus, Package, User, Clock, DollarSign, TrendingUp, Box, AlertTriangle, RefreshCw, ShoppingCart, FileText, Wrench } from 'lucide-react';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Button, Input, Select, SearchableSelect, Modal, Card, AIAlert } from '@/components/ui';
import { NotificationBell } from '@/components/ui/notifications';
import { ShortcutsHelp } from '@/components/ui/shortcuts-help';
import { OnboardingTour } from '@/components/ui/onboarding-tour';
import { ProductTable } from '@/components/productos';
import { MovementList, MovementTypeSelector, TransferenciasDashboard } from '@/components/movimientos';
import { AlertList, PredictionCard, ConsumptionChart, AnalyticsDashboard } from '@/components/analytics';

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
  const [dashboardPeriod, setDashboardPeriod] = useState('30d');
  const [dashboardAlmacenId, setDashboardAlmacenId] = useState<string>('todos');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [comercialSubTab, setComercialSubTab] = useState<ComercialSubTab>('dashboard');

  const handleTabChange = useCallback((tab: TabType) => {
    const comercialSubTabs = ['compras', 'ventas', 'finanzas', 'costos'];
    if (comercialSubTabs.includes(tab)) {
      setActiveTab('comercial');
      setComercialSubTab(tab as ComercialSubTab);
    } else {
      setActiveTab(tab);
      if (tab === 'comercial') {
        setComercialSubTab('dashboard');
      }
    }
    // Emitimos para alimentar el detector de estrés (cuenta
    // cambios de tab en los últimos 5 minutos como señal de
    // frenesí navegando).
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vg:tab-change', { detail: { tab } }));
    }
  }, []);

  // ===== Sprint D: Command Palette + Focus Mode =====
  const { open: paletteOpen, setOpen: setPaletteOpen } = useCommandPalette();
  const { enabled: focusEnabled, toggle: toggleFocus, setEnabled: setFocusEnabled } = useFocusMode();

  // ===== Modo anti-estrés inteligente =====
  // Detecta sobrecarga (notificaciones, aprobaciones, tickets
  // SLA, comportamiento) y sugiere activar Focus Mode. NUNCA
  // se activa solo — siempre pide confirmación al usuario.
  const {
    score: stressScore,
    debeMostrarPrompt: mostrarStressPrompt,
    marcarComoMostrado,
    marcarComoIgnorado,
  } = useStressDetector({
    usuarioEmail: user?.email || '',
    rol: user?.rol || '',
    // Si Focus Mode YA está activo, no insistimos
    habilitado: !!user?.email && !focusEnabled,
  });

  const activarFocusDesdeStress = useCallback(() => {
    setFocusEnabled(true);
    marcarComoMostrado();
  }, [setFocusEnabled, marcarComoMostrado]);

  const askAI = useCallback((prompt: string) => {
    // Disparamos un evento custom que el ChatbotWidget escucha:
    // abre el chat y rellena el input con el prompt.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vg:ask-ai', { detail: { prompt } }));
    }
  }, []);

  const handleCommand = useCallback((action: CommandAction) => {
    switch (action.type) {
      case 'navigate':
        handleTabChange(action.tab);
        break;
      case 'navigate-sub':
        setActiveTab(action.tab);
        if (action.tab === 'comercial') {
          setComercialSubTab(action.subTab as ComercialSubTab);
        }
        break;
      case 'chat':
        askAI(action.prompt);
        break;
      case 'modal':
        if (action.modal === 'focus-toggle') toggleFocus();
        break;
      case 'external':
        if (typeof window !== 'undefined') window.open(action.url, '_blank');
        break;
    }
  }, [handleTabChange, askAI, toggleFocus]);

  // Persistent filters
  useEffect(() => {
    const saved = localStorage.getItem('vanguard-filters');
    if (saved) {
      try {
        const { searchQuery: sq, selectedCategory: sc } = JSON.parse(saved);
        if (sq) setSearchQuery(sq);
        if (sc) setSelectedCategory(sc);
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('vanguard-filters', JSON.stringify({ searchQuery, selectedCategory }));
  }, [searchQuery, selectedCategory]);

  // Modal State
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [showNewMovement, setShowNewMovement] = useState(false);
  const [showEditProduct, setShowEditProduct] = useState(false);

  // Almacenes State
  const [almacenes, setAlmacenes] = useState<Array<{ id: string; nombre: string }>>([]);

  // Form State - New Product (UPDATED: added stockInicial and costoInicial)
  const [newProduct, setNewProduct] = useState({
    codigo: '',
    descripcion: '',
    precio: '',
    categoria: '',
    stockMinimo: '10',
    almacenId: '',
    stockInicial: '',      // NUEVO: stock inicial
    costoInicial: '',      // NUEVO: costo de compra inicial
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

  // Effect para cargar datos
  useEffect(() => {
    // Solo cargar si el usuario está autenticado y no se han inicializado los datos
    if (user && !isInitialized) {
      console.log('🔄 Iniciando carga de datos...');
      fetchProducts();
      fetchMovements();
    }
    
    // Cargar almacenes
    const fetchAlmacenes = async () => {
      const { data } = await supabase
        .from('almacenes')
        .select('id, nombre')
        .eq('activo', true)
        .order('es_principal', { ascending: false });
      if (data) setAlmacenes(data);
    };
    
    if (user) {
      fetchAlmacenes();
    }
  }, [user, isInitialized, fetchProducts, fetchMovements]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!user || !isInitialized) return;
    const interval = setInterval(() => {
      fetchProducts();
      fetchMovements();
      setLastRefresh(new Date());
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, isInitialized, fetchProducts, fetchMovements]);

  const handleManualRefresh = useCallback(() => {
    fetchProducts();
    fetchMovements();
    refreshPredictions();
    setLastRefresh(new Date());
  }, [fetchProducts, fetchMovements, refreshPredictions]);

  // Period days mapping
  const periodDays = dashboardPeriod === '7d' ? 7 : dashboardPeriod === '90d' ? 90 : 30;

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

  // Dashboard stats — filtered by warehouse if selected
  const stats = useMemo(() => {
    const filteredProducts = dashboardAlmacenId === 'todos'
      ? products
      : products.filter(p => p.almacenId === dashboardAlmacenId);

    // Movement filter: si hay almacén seleccionado, solo movs cuyo producto pertenece
    const productCodesInAlmacen = new Set(filteredProducts.map(p => p.codigo));
    const filteredMovements = dashboardAlmacenId === 'todos'
      ? movements
      : movements.filter(m => productCodesInAlmacen.has(m.codigo));

    const activeProducts = filteredProducts.length;

    // Stock bajo = stock > 0 AND ≤ minimo (separar de agotados)
    const stockBajoSinAgotados = filteredProducts.filter(p => p.stock > 0 && p.stockMinimo > 0 && p.stock <= p.stockMinimo).length;
    const agotados = filteredProducts.filter(p => p.stock === 0).length;

    const today = new Date();
    const todayMovements = filteredMovements.filter(
      (m) => new Date(m.timestamp).toDateString() === today.toDateString()
    ).length;

    // ROTACIÓN — días de inventario reales.
    // Antes dividía siempre por 30 aunque el histórico fuera menor → infla días.
    // Ahora calcula el rango efectivo desde el primer movimiento (max 30 días).
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const salesLast30 = filteredMovements
      .filter(m => m.tipo === 'salida' && new Date(m.timestamp) >= thirtyDaysAgo);

    let avgRotation = 0;
    let dailyAvgSales = 0;
    if (salesLast30.length > 0) {
      const oldest = salesLast30.reduce((min, m) => {
        const t = new Date(m.timestamp).getTime();
        return t < min ? t : min;
      }, Date.now());
      const daysSpan = Math.max(1, Math.min(30, Math.ceil((Date.now() - oldest) / 86400000)));
      const totalSales = salesLast30.reduce((sum, m) => sum + m.cantidad, 0);
      dailyAvgSales = totalSales / daysSpan;
      const totalStock = filteredProducts.reduce((sum, p) => sum + p.stock, 0);
      avgRotation = dailyAvgSales > 0 ? Math.round(totalStock / dailyAvgSales) : 0;
    }

    // Trend movs hoy vs ayer
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayMovements = filteredMovements.filter(
      (m) => new Date(m.timestamp).toDateString() === yesterday.toDateString()
    ).length;
    const movementTrend = yesterdayMovements > 0
      ? { value: Math.round(((todayMovements - yesterdayMovements) / yesterdayMovements) * 100), label: 'vs ayer' }
      : undefined;

    return [
      {
        label: t('dashboard.activeProducts', 'Productos Activos'),
        value: formatNumber(activeProducts),
        icon: <Package size={24} />,
        color: 'emerald',
        subtitle: dashboardAlmacenId === 'todos' ? 'SKUs en catálogo' : 'SKUs en este almacén',
      },
      {
        label: t('dashboard.avgRotation', 'Rotación Promedio'),
        value: avgRotation > 0 ? `${avgRotation}d` : '—',
        icon: <TrendingUp size={24} />,
        color: 'cyan',
        subtitle: dailyAvgSales > 0 ? `${dailyAvgSales.toFixed(1)} unid/día` : 'Sin ventas en 30 días',
      },
      {
        label: t('dashboard.lowStock', 'Stock Bajo'),
        value: stockBajoSinAgotados.toString(),
        icon: <AlertTriangle size={24} />,
        color: stockBajoSinAgotados > 0 ? 'amber' : 'slate',
        subtitle: agotados > 0 ? `+ ${agotados} agotados` : 'Sin agotados',
      },
      {
        label: t('dashboard.movementsToday', 'Movimientos Hoy'),
        value: todayMovements.toString(),
        icon: <ArrowLeftRight size={24} />,
        color: 'purple',
        trend: movementTrend,
      },
    ];
  }, [products, movements, t, dashboardAlmacenId]);

  // Productos / movimientos filtrados por almacén — usados en cards del dashboard
  const dashboardProducts = useMemo(() => {
    if (dashboardAlmacenId === 'todos') return products;
    return products.filter(p => p.almacenId === dashboardAlmacenId);
  }, [products, dashboardAlmacenId]);

  const dashboardMovements = useMemo(() => {
    if (dashboardAlmacenId === 'todos') return movements;
    const codes = new Set(dashboardProducts.map(p => p.codigo));
    return movements.filter(m => codes.has(m.codigo));
  }, [movements, dashboardProducts, dashboardAlmacenId]);

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

  // Add product handler - UPDATED: now creates initial movement if stock > 0
  const handleAddProduct = async () => {
    if (!newProduct.codigo || !newProduct.descripcion || !newProduct.precio || !newProduct.categoria) {
      return;
    }
    
    const stockInicial = parseInt(newProduct.stockInicial) || 0;
    const costoInicial = parseFloat(newProduct.costoInicial) || 0;
    
    // Primero crear el producto (con stock 0)
    await addProduct({
      codigo: newProduct.codigo.toUpperCase(),
      descripcion: newProduct.descripcion,
      precio: parseFloat(newProduct.precio),
      categoria: newProduct.categoria,
      stockMinimo: parseInt(newProduct.stockMinimo) || 10,
      almacenId: newProduct.almacenId || null,
    }, user?.email || 'Sistema');

    // Si hay stock inicial, crear un movimiento de entrada
    if (stockInicial > 0) {
      // Pequeño delay para asegurar que el producto se creó
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await addMovement({
        codigo: newProduct.codigo.toUpperCase(),
        tipo: 'entrada',
        cantidad: stockInicial,
        notas: 'Stock inicial al crear producto',
        costoCompra: costoInicial > 0 ? costoInicial : undefined,
      }, user?.email || 'Sistema');
    }

    // Reset form
    setNewProduct({ 
      codigo: '', 
      descripcion: '', 
      precio: '', 
      categoria: '', 
      stockMinimo: '10', 
      almacenId: '',
      stockInicial: '',
      costoInicial: '',
    });
    setShowNewProduct(false);
    setAiSuggestion(null);
  };

  // Edit product handler
  const handleEditProduct = () => {
    if (!editProduct) return;
    const updates: Partial<Product> = {
      descripcion: editProduct.descripcion,
      precio: editProduct.precio,
      categoria: editProduct.categoria,
      stockMinimo: editProduct.stockMinimo,
      almacenId: editProduct.almacenId,
    };
    if (isAdmin) {
      updates.stock = editProduct.stock;
    }
    updateProduct(editProduct.codigo, updates, user?.email || 'Sistema');

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
        onTabChange={handleTabChange}
        permissions={{
          canViewCosts: hasPermission('canViewCosts'),
          canViewAudit: hasPermission('canViewAudit'),
          canViewReports: hasPermission('canViewReports'),
          canViewFinanzas: hasPermission('canViewFinanzas'),
          canViewTaller: hasPermission('canViewTaller'),
          canViewWMS: hasPermission('canViewWMS'),
          canViewProyectos: hasPermission('canViewProyectos'),
          canViewComercial: hasPermission('canViewComercial'),
          canViewDemand: hasPermission('canViewDemand'),
          canViewSeriales: hasPermission('canViewSeriales'),
          canViewRMA: hasPermission('canViewRMA'),
          canViewBOM: hasPermission('canViewBOM'),
          canViewQMS: hasPermission('canViewQMS'),
          canExportData: hasPermission('canExportData'),
        }}
      />

      <main className="ml-0 lg:ml-[260px] transition-all duration-300 min-h-screen">
        <div className="w-full px-6 py-6">

        {/* Breadcrumbs + Notifications */}
        <div className="flex items-center justify-between mb-2">
          <Breadcrumbs activeTab={activeTab} onNavigate={handleTabChange} />
          <NotificationBell />
        </div>

        {/* ==================== DASHBOARD ==================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-5">
            {/* Header: saludo + selector almacén + período + refresh */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <WelcomeHeader
                  userName={user?.nombre || user?.email?.split('@')[0]}
                  products={dashboardProducts}
                  predictions={predictions}
                />
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 pt-1">
                {/* Selector de almacén — el dashboard se filtra entero */}
                <select
                  value={dashboardAlmacenId}
                  onChange={(e) => setDashboardAlmacenId(e.target.value)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-sm text-slate-200 transition-colors focus:outline-none focus:border-indigo-500"
                  title="Filtrar dashboard por almacén"
                >
                  <option value="todos">Todos los almacenes</option>
                  {almacenes.map(a => (
                    <option key={a.id} value={a.id}>{a.nombre}</option>
                  ))}
                </select>
                <PeriodSelector value={dashboardPeriod} onChange={setDashboardPeriod} />
                <button
                  onClick={handleManualRefresh}
                  className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
                  title={`Última actualización: ${lastRefresh.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}`}
                >
                  <RefreshCw size={14} className="text-slate-400 hover:text-slate-200 transition-colors" />
                </button>
              </div>
            </div>

            {/* KPIs principales */}
            <StatsGrid stats={stats} products={dashboardProducts} movements={dashboardMovements} />

            {/* Valor del Inventario (con desglose por almacén) */}
            <InventoryValueCard
              products={dashboardProducts}
              movements={dashboardMovements}
              onCategoryClick={(category: string) => {
                setSelectedCategory(category);
                handleTabChange('stock');
              }}
            />

            {/* Flujo de inventario */}
            <InventoryTrendChart
              movements={dashboardMovements}
              products={dashboardProducts}
              days={periodDays}
            />

            {/* Top consumidos (lista compacta sin barras) */}
            <div className="rounded-xl p-6 bg-slate-900/40 border border-slate-800">
              <ConsumptionChart movements={dashboardMovements} products={dashboardProducts} />
            </div>

            {/* Insights IA */}
            <InsightsPanel
              products={dashboardProducts}
              movements={dashboardMovements}
              predictions={predictions}
              onNavigate={(tab) => handleTabChange(tab as TabType)}
            />

            {/* Paneles de IA — predicciones, anomalías, asociaciones */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <AIPredictionsPanel />
              <AIAnomaliesPanel />
              <AIAssociationsPanel />
            </div>
          </div>
        )}

        {/* ==================== STOCK (con Almacenes embebido) ==================== */}
        {activeTab === 'stock' && (
          <StockDashboard
            products={products}
            predictions={predictions}
            onDeleteProduct={hasPermission('canDeleteProducts') 
              ? (codigo: string) => deleteProduct(codigo, user?.email || 'Sistema')
              : undefined
            }
            onEditProduct={handleOpenEdit}
            onAddProduct={() => setShowNewProduct(true)}
            onRefreshProducts={fetchProducts}
            userEmail={user?.email || ''}
            hasCreatePermission={hasPermission('canCreateProducts')}
            hasDeletePermission={hasPermission('canDeleteProducts')}
          />
        )}

        {/* ==================== MOVIMIENTOS (Transferencias) ==================== */}
        {activeTab === 'movimientos' && (
          <TransferenciasDashboard
            products={products}
            userEmail={user?.email || ''}
            onRefreshProducts={fetchProducts}
          />
        )}

        {/* ==================== COMERCIAL (Compras, Ventas, Finanzas, Costos) ==================== */}
        {activeTab === 'comercial' && (
          <ComercialModule
            products={products}
            userEmail={user?.email || ''}
            activeSubTab={comercialSubTab}
            onSubTabChange={setComercialSubTab}
          />
        )}

        {activeTab === 'taller' && (
          <div className="w-full">
            <TallerEnterprise />
          </div>
        )}

        {activeTab === 'qms' && (
          <div className="w-full">
            <QMSModule />
          </div>
        )}

        {activeTab === 'wms' && (
          <div className="w-full">
            <WMSModule />
          </div>
        )}

        

        {/* ==================== ANALYTICS ==================== */}
        {activeTab === 'analytics' && (
          <AnalyticsDashboard 
            products={products}
            movements={movements}
            predictions={predictions}
          />
        )}
        
        {activeTab === 'reportes' && (
          <div className="w-full">
            <ReportsEnterprise />
          </div>
        )}

        {/* ==================== AUDITORÍA ==================== */}
        {activeTab === 'auditoria' && (
          <AuditLogPanel />
        )}

        {/* ==================== APROBACIONES ==================== */}
        {activeTab === 'aprobaciones' && (
          <ApprovalsInbox />
        )}

        {/* ==================== FACTURACIÓN ELECTRÓNICA ==================== */}
        {activeTab === 'facturacion' && (
          <FacturasElectronicas />
        )}

        {/* ==================== TICKETS DE SOPORTE ==================== */}
        {activeTab === 'tickets' && (
          <TicketsModule />
        )}

        {/* ==================== GARANTÍAS ==================== */}
        {activeTab === 'garantias' && (
          <GarantiasModule />
        )}

        {/* ==================== RRHH ==================== */}
        {activeTab === 'rrhh' && (
          <RRHHModule />
        )}

        {/* ==================== HISTORIAL CLIENTE 360 ==================== */}
        {activeTab === 'clientes_360' && (
          <HistorialCliente />
        )}

        {/* ==================== INTEGRACIONES ==================== */}
        {activeTab === 'integraciones' && (
          <div className="max-w-4xl mx-auto">
            <IntegracionesDashboard />
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="w-full">
            <ChatModule />
          </div>
        )}

        {/* ==================== SERIALES ==================== */}
        {activeTab === 'seriales' && (
          <div className="max-w-7xl mx-auto">
            <SerialManagement />
          </div>
        )}

        {/* ==================== TRAZABILIDAD ==================== */}
        {activeTab === 'trazabilidad' && (
          <div className="max-w-7xl mx-auto">
            <TraceabilityViewer />
          </div>
        )}

        {/* ==================== DEVOLUCIONES (RMA) ==================== */}
        {activeTab === 'rma' && (
          <div className="max-w-7xl mx-auto">
            <RMADashboard />
          </div>
        )}

        {/* ==================== BOM ==================== */}
        {activeTab === 'bom' && (
          <div className="max-w-7xl mx-auto">
            <BOMManager />
          </div>
        )}

        {/* ==================== ENSAMBLAJES ==================== */}
        {activeTab === 'ensamblajes' && (
          <div className="max-w-7xl mx-auto">
            <AssemblyDashboard />
          </div>
        )}

        
        {activeTab === 'proyectos' && (
          <div className="w-full">
            <ProyectosDashboard />
          </div>
        )}

        {activeTab === 'demand' && (
          <div className="w-full">
            <DemandPlanningModule />
          </div>
        )}

        </div>
      </main>

      {/* ==================== MODAL: NUEVO PRODUCTO (UPDATED) ==================== */}
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

          {/* NUEVO: Stock Inicial y Costo */}
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <h4 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
              <Package size={16} />
              {t('stock.initialStock', 'Stock Inicial')} ({t('common.optional', 'opcional')})
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={t('stock.initialQuantity', 'Cantidad Inicial')}
                type="number"
                value={newProduct.stockInicial}
                onChange={(e) => setNewProduct({ ...newProduct, stockInicial: e.target.value })}
                placeholder="0"
              />
              <Input
                label={t('stock.unitCost', 'Costo Unitario')}
                type="number"
                step="0.01"
                value={newProduct.costoInicial}
                onChange={(e) => setNewProduct({ ...newProduct, costoInicial: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {t('stock.initialStockHint', 'Si agregas stock inicial, se creará automáticamente un movimiento de entrada.')}
            </p>
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

              <div>
                <Input
                  label={t('stock.currentStock')}
                  type="number"
                  value={editProduct.stock.toString()}
                  onChange={(e) => setEditProduct({ ...editProduct, stock: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                  disabled={!isAdmin}
                />
                {!isAdmin && (
                  <p className="text-xs text-slate-500 mt-1">Solo administradores pueden editar stock. Usa Movimientos para entradas/salidas.</p>
                )}
              </div>
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
          <SearchableSelect
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
        onProductFound={(product) => handleOpenEdit(product)}
        onOpenMovement={(product, tipo) => {
          setNewMovement({ ...newMovement, codigo: product.codigo, tipo });
          setShowNewMovement(true);
        }}
      />

      {/* Chatbot IA */}
      <ChatbotWidget />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onAction={handleCommand}
      />
      <FocusModeToggle enabled={focusEnabled} onToggle={toggleFocus} />
      <FocusModeBanner enabled={focusEnabled} />
      {stressScore && (
        <StressPrompt
          score={stressScore}
          visible={mostrarStressPrompt}
          onActivar={activarFocusDesdeStress}
          onDespues={marcarComoIgnorado}
          onDeshabilitar={() => {
            setDeteccionStressDeshabilitada(true);
            marcarComoIgnorado();
          }}
        />
      )}

      {/* Indicador offline */}
      <OfflineIndicator />

      {/* Buscador Global - Ctrl+K */}
      <GlobalSearch
        onNavigate={(tab) => handleTabChange(tab as TabType)}
        onSelectProduct={(product) => handleOpenEdit(product)}
      />

      {/* Atajos de teclado */}
      <ShortcutsHelp />

      {/* Tour de onboarding */}
      <OnboardingTour />

    </div>
  );
}