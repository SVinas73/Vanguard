'use client';

import dynamic from 'next/dynamic';
import { ComercialSubTab } from '@/components/comercial';

// Módulos del dashboard que se ven al toque (no se splittean)
import { WelcomeHeader, StatsGrid, InsightsPanel, CrossModuleSummary, InventoryTrendChart, PeriodSelector, DashboardView } from '@/components/dashboard';
import { InventoryValueCard, StockAlertsPanel, RecentActivityPanel } from '@/components/dashboard/enterprise';
import { OfflineIndicator } from '@/components/ui/offline-indicator';
import { GlobalSearch } from '@/components/search';
import { ChatbotWidget } from '@/components/chatbot';
import { CommandPalette, useCommandPalette, type CommandAction } from '@/components/ui/command-palette';
import { useFocusMode, FocusModeBanner } from '@/components/ui/focus-mode';
import { useCalmMode, CalmMode, type CalmFoco } from '@/components/ui/CalmMode';
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
const DistribucionModule    = dynamic(() => import('@/components/distribucion/DistribucionModule'),                            { loading: ModuleLoader });
const QMSModule             = dynamic(() => import('@/components/qms').then(m => ({ default: m.QMSModule })),                    { loading: ModuleLoader });
const ProyectosDashboard    = dynamic(() => import('@/components/proyectos').then(m => ({ default: m.ProyectosDashboard })),     { loading: ModuleLoader });
const StockDashboard        = dynamic(() => import('@/components/stock').then(m => ({ default: m.StockDashboard })),             { loading: ModuleLoader });
const ImportCSV             = dynamic(() => import('@/components/import').then(m => ({ default: m.ImportCSV })),                 { loading: ModuleLoader });
const IntegracionesDashboard = dynamic(() => import('@/components/integraciones/IntegracionesModule'), { loading: ModuleLoader });
const TallerEnterprise      = dynamic(() => import('@/components/taller'),                                                       { loading: ModuleLoader });
const AuditLogPanel         = dynamic(() => import('@/components/audit').then(m => ({ default: m.AuditLogPanel })),              { loading: ModuleLoader });
const ReportsEnterprise     = dynamic(() => import('@/components/reports').then(m => ({ default: m.ReportsEnterprise })),        { loading: ModuleLoader });
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
const ExecutiveDashboard    = dynamic(() => import('@/components/executive/ExecutiveDashboard'),                                  { loading: ModuleLoader });
const PricingRecommender    = dynamic(() => import('@/components/pricing/PricingRecommender'),                                    { loading: ModuleLoader });
const ReplenishmentDashboard = dynamic(() => import('@/components/replenishment/ReplenishmentDashboard'),                          { loading: ModuleLoader });
const CustomerRiskModule    = dynamic(() => import('@/components/customer-risk/CustomerRiskModule'),                              { loading: ModuleLoader });
const ConfigModulos         = dynamic(() => import('@/components/configuracion/ConfigModulos').then(m => m.ConfigModulos),         { loading: ModuleLoader });
const MisEmpresasModule     = dynamic(() => import('@/components/organization/MisEmpresasModule'),                                  { loading: ModuleLoader });
const InicioHome            = dynamic(() => import('@/components/inicio/InicioHome').then(m => m.InicioHome),                        { loading: ModuleLoader });
const GestionClientes       = dynamic(() => import('@/components/clientes/GestionClientes').then(m => m.GestionClientes),            { loading: ModuleLoader });
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { Bot, Search, ArrowLeftRight, Plus, Package, User, Clock, DollarSign, TrendingUp, Box, AlertTriangle, RefreshCw, ShoppingCart, FileText, Wrench } from 'lucide-react';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { TabType, CategorySuggestion, AnomalyResult, Product, Almacen } from '@/types';
import { useInventoryStore } from '@/store';
import { recordModuleVisit } from '@/lib/home/routine';
import { CATEGORIAS_VENTA } from '@/lib/constants';
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
import { ShortcutsModal } from '@/components/ui/shortcuts-help';
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
  const [activeTab, setActiveTab] = useState<TabType>('inicio');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [dashboardPeriod, setDashboardPeriod] = useState('30d');
  const [dashboardAlmacenId, setDashboardAlmacenId] = useState<string>('');
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
    // Aprendizaje de rutina: registrar qué módulo usa y cuándo (local).
    recordModuleVisit(user?.email || 'anon', tab);
  }, [user?.email]);

  // Bienestar (Modo Calma + Focus Mode + detector de estrés): OCULTO por ahora.
  // Poner en true para reactivarlo en el futuro.
  const BIENESTAR_HABILITADO = false;

  // ===== Sprint D: Command Palette + Focus Mode =====
  const { open: paletteOpen, setOpen: setPaletteOpen } = useCommandPalette();
  const { enabled: focusEnabled, toggle: toggleFocus, setEnabled: setFocusEnabled } = useFocusMode({ shortcut: BIENESTAR_HABILITADO });

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
    // Si Focus Mode YA está activo, no insistimos. Apagado mientras BIENESTAR off.
    habilitado: BIENESTAR_HABILITADO && !!user?.email && !focusEnabled,
  });

  const activarFocusDesdeStress = useCallback(() => {
    setFocusEnabled(true);
    marcarComoMostrado();
  }, [setFocusEnabled, marcarComoMostrado]);

  // Atajos de teclado (modal abierto desde Configuración del sidebar)
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // ===== Modo Calma (anti-estrés visual, activado por el usuario) =====
  const calm = useCalmMode();
  // Focos = SOLO señales reales del sistema (no comportamiento), mostradas de a
  // una y con acción para ir a resolverlas. Las conductuales (frenesí, hora,
  // etc.) no son "focos" accionables, así que se excluyen.
  const calmFocos = useMemo<CalmFoco[]>(() => {
    if (!stressScore) return [];
    const FOCO_NAV: Record<string, { tab: TabType; label: string }> = {
      'Aprobaciones pendientes': { tab: 'aprobaciones' as TabType, label: 'Ver aprobaciones' },
      'Tickets con SLA vencido': { tab: 'taller' as TabType, label: 'Ver tickets' },
      'Productos agotados':      { tab: 'stock' as TabType, label: 'Ver stock' },
      'CxC vencidas':            { tab: 'finanzas' as TabType, label: 'Ver finanzas' },
      'Picking sin asignar':     { tab: 'wms' as TabType, label: 'Ver picking' },
    };
    const SISTEMA = new Set([...Object.keys(FOCO_NAV), 'Notificaciones críticas']);
    return stressScore.componentes
      .filter(c => SISTEMA.has(c.fuente) && c.valor > 0)
      .sort((a, b) => (b.valor * b.peso) - (a.valor * a.peso))
      .map(c => {
        const nav = FOCO_NAV[c.fuente];
        return {
          titulo: c.fuente,
          detalle: c.descripcion,
          accion: nav ? () => { calm.setOpen(false); handleTabChange(nav.tab); } : undefined,
          accionLabel: nav?.label,
        };
      });
  }, [stressScore, calm, handleTabChange]);

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
  const [ubicaciones, setUbicaciones] = useState<Array<{ id: string; codigo_completo: string }>>([]);

  // Form State - New Product (UPDATED: added stockInicial and costoInicial)
  const [newProduct, setNewProduct] = useState({
    codigo: '',
    descripcion: '',
    precio: '',
    moneda: 'UYU' as 'USD' | 'UYU',
    unidad: 'unidad',     // unidad de medida: unidad/litro/paquete/kg/metro
    ubicacionId: '',      // ubicación WMS opcional (donde colocar el stock inicial)
    categoria: '',
    stockMinimo: '10',
    almacenId: '',
    stockInicial: '',      // stock inicial (en unidades)
    costoInicial: '',      // precio de compra (por unidad, o por pack si compraPorPack)
    compraPorPack: false,  // si el precio de compra es por pack
    unidadesPorPack: '',   // cuántas unidades trae el pack
    comentarios: '',       // observaciones (se ven en el historial del producto)
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
      if (data) {
        setAlmacenes(data);
        // El dashboard principal muestra SOLO almacenes de venta (NO insumos).
        // Un almacén es de insumos si su nombre contiene "insumo" (case-insensitive).
        const ventaAlmacenes = data.filter(a => !(a.nombre || '').toLowerCase().includes('insumo'));
        // El dashboard se filtra siempre por un almacén de venta concreto (sin opción
        // "todos"). Si el seleccionado no existe en la lista de venta, default al primero.
        setDashboardAlmacenId(prev =>
          ventaAlmacenes.some(a => a.id === prev) ? prev : (ventaAlmacenes[0]?.id ?? '')
        );
      }
    };
    
    if (user) {
      fetchAlmacenes();
      // Ubicaciones disponibles (para asignar al crear un producto).
      (async () => {
        const { data } = await supabase
          .from('wms_ubicaciones')
          .select('id, codigo_completo')
          .order('codigo_completo')
          .limit(1000);
        if (data) setUbicaciones(data as Array<{ id: string; codigo_completo: string }>);
      })();
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

  // Auto-refresh ante eventos de la app que cambian stock (recepciones de
  // solicitudes de insumos, recepciones de OC, etc.) — así el módulo Stock
  // queda en vivo sin necesidad de F5.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => {
      fetchProducts();
      fetchMovements();
      setLastRefresh(new Date());
    };
    window.addEventListener('vg:stock-changed', handler);
    return () => window.removeEventListener('vg:stock-changed', handler);
  }, [fetchProducts, fetchMovements]);

  // Period days mapping — fuente única de período para todo el dashboard
  const periodDays = dashboardPeriod === '7d' ? 7
    : dashboardPeriod === '90d' ? 90
    : dashboardPeriod === '1a' ? 365
    : 30;
  const periodLabel = dashboardPeriod === '7d' ? '7 días'
    : dashboardPeriod === '90d' ? '90 días'
    : dashboardPeriod === '1a' ? '1 año'
    : '30 días';

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

  // Almacenes de venta (NO insumos). El dashboard principal muestra SOLO
  // artículos de venta; un almacén es de insumos si su nombre contiene "insumo".
  const almacenesVenta = useMemo(
    () => almacenes.filter(a => !(a.nombre || '').toLowerCase().includes('insumo')),
    [almacenes]
  );

  // Almacén destino del alta de producto. Por defecto, el depósito de ventas
  // actual; pero el usuario puede elegir otro (ej. insumos). La ubicación solo
  // aplica a Depósito de Ventas (insumos NO lleva ubicación).
  const almacenDefaultId = useMemo(() => {
    return (dashboardAlmacenId && dashboardAlmacenId !== 'todos')
      ? dashboardAlmacenId
      : (almacenesVenta[0]?.id ?? '');
  }, [dashboardAlmacenId, almacenesVenta]);
  const almacenSeleccionadoId = newProduct.almacenId || almacenDefaultId;
  const esInsumoImplicito = useMemo(() => {
    const alm = almacenes.find(a => a.id === almacenSeleccionadoId);
    return !!alm && (alm.nombre || '').toLowerCase().includes('insumo');
  }, [almacenSeleccionadoId, almacenes]);

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
  // Categorías del DEPÓSITO DE VENTAS (separadas de insumos; editar en
  // lib/constants.ts → CATEGORIAS_VENTA).
  const categoryOptions = useMemo(() => {
    return CATEGORIAS_VENTA.map((c) => ({ value: c, label: c }));
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

  // Add product handler - INSERT directo a Supabase (sin store) para que los
  // errores no se silencien. Mismo patrón que usó PR #63 en NuevoProductoModal.
  const handleAddProduct = async () => {
    if (!newProduct.codigo || !newProduct.descripcion || !newProduct.categoria) {
      alert('Completá código, descripción y categoría.');
      return;
    }

    const codigoFinal = newProduct.codigo.toUpperCase().trim();
    const stockInicial = parseInt(newProduct.stockInicial) || 0;
    // Si la compra es por pack, el costo unitario = precio del pack / unidades por pack.
    const precioCompra = parseFloat(newProduct.costoInicial) || 0;
    const unidadesPack = parseInt(newProduct.unidadesPorPack) || 0;
    const costoInicial = (newProduct.compraPorPack && unidadesPack > 0)
      ? precioCompra / unidadesPack
      : precioCompra;
    const userEmail = user?.email || 'Sistema';

    // Almacén destino: el que eligió el usuario, o el de ventas por defecto.
    const almacenImplicito = newProduct.almacenId || almacenDefaultId || null;
    // ¿Es de insumos? (los insumos no llevan ubicación).
    const almSel = almacenes.find(a => a.id === almacenImplicito);
    const esInsumoDestino = !!almSel && (almSel.nombre || '').toLowerCase().includes('insumo');

    // 1. INSERT directo (no usamos addProduct del store: silencia errores).
    const productoData = {
      codigo: codigoFinal,
      descripcion: newProduct.descripcion.trim(),
      // El precio de VENTA no se define en el alta (solo precio de compra/costo);
      // se configura después. Queda en 0 al crear.
      precio: 0,
      moneda: newProduct.moneda,
      unidad: newProduct.unidad,
      categoria: newProduct.categoria,
      stock: 0,
      stock_minimo: parseInt(newProduct.stockMinimo) || 10,
      // El costo inicial cargado en el alta queda como costo promedio del producto,
      // así "Último costo" lo refleja de inmediato (no espera a un movimiento aparte).
      costo_promedio: costoInicial > 0 ? costoInicial : 0,
      almacen_id: almacenImplicito,
      creado_por: userEmail,
      creado_at: new Date().toISOString(),
      actualizado_por: userEmail,
      actualizado_at: new Date().toISOString(),
    };

    let { error: insertError } = await supabase
      .from('productos')
      .insert(productoData);

    // Si la BD no tiene alguna columna opcional (ej. 'unidad' no migrada aún),
    // reintentamos SIN esa columna para que el producto igual se cree.
    if (insertError && (
      (insertError as any).code === 'PGRST204' ||
      /Could not find the '?\w+'? column/i.test(insertError.message || '')
    )) {
      const { unidad: _u, moneda: _m, ...base } = productoData as any;
      // Reintento 1: sin 'unidad'.
      let retry = await supabase.from('productos').insert({ ...base, moneda: productoData.moneda });
      // Reintento 2: sin 'unidad' ni 'moneda' (por si tampoco existe moneda).
      if (retry.error && (retry.error as any).code === 'PGRST204') {
        retry = await supabase.from('productos').insert(base);
      }
      insertError = retry.error;
    }

    if (insertError) {
      const code = (insertError as any).code ?? '';
      const detalle = code ? ` (${code})` : '';
      alert(`No se pudo crear el producto${detalle}: ${insertError.message}`);
      return;
    }

    // 2. Si hay stock inicial, generar movimiento de entrada.
    //    Usamos los nombres reales de columnas (codigo / notas / costo_compra)
    //    y resolvemos el producto_id recién creado para no depender de timings.
    if (stockInicial > 0) {
      const { data: prodRow } = await supabase
        .from('productos')
        .select('id')
        .eq('codigo', codigoFinal)
        .single();

      if (prodRow) {
        const { error: movError } = await supabase.from('movimientos').insert({
          producto_id: prodRow.id,
          codigo: codigoFinal,
          tipo: 'entrada',
          cantidad: stockInicial,
          costo_compra: costoInicial > 0 ? costoInicial : null,
          moneda_costo: newProduct.moneda,
          notas: newProduct.comentarios.trim()
            ? `Alta del producto · ${newProduct.comentarios.trim()}`
            : 'Stock inicial al crear producto',
          usuario_email: userEmail,
        });
        if (movError) {
          // El producto ya se creó; mostramos warning pero no rompemos el flujo.
          console.warn('Producto creado pero falló el movimiento inicial:', movError.message);
        } else {
          await supabase
            .from('productos')
            .update({ stock: stockInicial })
            .eq('codigo', codigoFinal);
          // Si se eligió una ubicación (solo Depósito de Ventas), colocamos ahí
          // el stock inicial para que el picker lo vea.
          if (newProduct.ubicacionId && !esInsumoDestino) {
            const ub = ubicaciones.find(u => u.id === newProduct.ubicacionId);
            await supabase.from('wms_stock_ubicacion').insert({
              ubicacion_id: newProduct.ubicacionId,
              ubicacion_codigo: ub?.codigo_completo || '',
              producto_codigo: codigoFinal,
              cantidad: stockInicial,
              cantidad_reservada: 0,
              cantidad_disponible: stockInicial,
              ultimo_movimiento: new Date().toISOString(),
            });
            await supabase.from('wms_ubicaciones').update({ estado: 'ocupada' }).eq('id', newProduct.ubicacionId);
          }
        }
      }
    } else if (newProduct.comentarios.trim()) {
      // Sin stock inicial pero CON observación: la registramos igual para que
      // aparezca en el historial del producto.
      const { data: prodRow } = await supabase
        .from('productos').select('id').eq('codigo', codigoFinal).single();
      if (prodRow) {
        await supabase.from('movimientos').insert({
          producto_id: prodRow.id,
          codigo: codigoFinal,
          tipo: 'ajuste',
          cantidad: 0,
          notas: `Alta del producto · ${newProduct.comentarios.trim()}`,
          usuario_email: userEmail,
        });
      }
    }

    // 3. Refrescar el catálogo en memoria + broadcast a otros módulos
    await fetchProducts();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vg:stock-changed', {
        detail: { source: 'producto-creado', codigo: codigoFinal },
      }));
    }

    // Reset form
    setNewProduct({
      codigo: '',
      descripcion: '',
      precio: '',
      moneda: 'UYU',
      unidad: 'unidad',
      ubicacionId: '',
      categoria: '',
      stockMinimo: '10',
      almacenId: '',
      stockInicial: '',
      costoInicial: '',
      compraPorPack: false,
      unidadesPorPack: '',
      comentarios: '',
    });
    setShowNewProduct(false);
    setAiSuggestion(null);
    const dondeNombre = almSel?.nombre || 'el almacén';
    alert(`Producto ${codigoFinal} creado en ${dondeNombre}.`);

  };

  // ¿El producto que se edita es de un almacén de insumos? (no se venden:
  // se edita el costo, no el precio de venta)
  const editEsInsumo = useMemo(() => {
    if (!editProduct?.almacenId) return false;
    const alm = almacenes.find(a => a.id === editProduct.almacenId);
    return !!alm && (alm.nombre || '').toLowerCase().includes('insumo');
  }, [editProduct?.almacenId, almacenes]);

  // Edit product handler
  const handleEditProduct = async () => {
    if (!editProduct) return;
    const updates: Partial<Product> = {
      descripcion: editProduct.descripcion,
      categoria: editProduct.categoria,
      stockMinimo: editProduct.stockMinimo,
      almacenId: editProduct.almacenId,
    };
    // Insumos: el campo edita el COSTO. Venta: edita el precio de venta.
    if (editEsInsumo) updates.costoPromedio = editProduct.costoPromedio ?? 0;
    else updates.precio = editProduct.precio;
    if (isAdmin) {
      updates.stock = editProduct.stock;
    }
    await updateProduct(editProduct.codigo, updates, user?.email || 'Sistema');

    // El store guarda el error en su estado; si falló, avisamos en vez de
    // cerrar como si nada ("edito y no pasa nada").
    const errorGuardar = useInventoryStore.getState().error;
    if (errorGuardar) {
      alert(`No se pudo guardar el producto: ${errorGuardar}`);
      return;
    }

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
        onOpenShortcuts={() => setShortcutsOpen(true)}
        focusEnabled={focusEnabled}
        onToggleFocus={BIENESTAR_HABILITADO ? toggleFocus : undefined}
        onOpenCalm={BIENESTAR_HABILITADO ? () => calm.setOpen(true) : undefined}
        calmAmbient={calm.ambient}
      />

      <main className="ml-0 lg:ml-[260px] transition-all duration-300 min-h-screen">
        <div className="w-full px-6 py-6">

        {/* Breadcrumbs + Notifications */}
        <div className="flex items-center justify-between mb-2">
          <Breadcrumbs activeTab={activeTab} onNavigate={handleTabChange} />
          <NotificationBell />
        </div>

        {/* ==================== INICIO (escritorio) ==================== */}
        {activeTab === 'inicio' && (
          <InicioHome
            user={user}
            onTabChange={handleTabChange}
            products={products}
            movements={movements}
            predictions={predictions}
          />
        )}

        {/* ==================== DASHBOARD ==================== */}
        {activeTab === 'dashboard' && (
          <DashboardView
            products={dashboardProducts}
            movements={dashboardMovements}
            predictions={predictions}
            userName={user?.nombre || user?.email?.split('@')[0]}
            period={dashboardPeriod}
            onPeriodChange={setDashboardPeriod}
            onNavigate={(tab) => handleTabChange(tab as TabType)}
            onRefresh={handleManualRefresh}
            onCategoryClick={(category: string) => {
              setSelectedCategory(category);
              handleTabChange('stock');
            }}
            headerRight={
              /* Selector de almacén — lista SOLO almacenes de venta (NO insumos).
                 El dashboard se filtra por el almacén elegido; default al primero. */
              almacenesVenta.length > 0 ? (
                <select
                  value={dashboardAlmacenId}
                  onChange={(e) => setDashboardAlmacenId(e.target.value)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-sm text-slate-200 transition-colors focus:outline-none focus:border-indigo-500"
                  title="Filtrar dashboard por almacén"
                >
                  {almacenesVenta.map(a => (
                    <option key={a.id} value={a.id}>{a.nombre}</option>
                  ))}
                </select>
              ) : undefined
            }
          />
        )}

        {/* ==================== STOCK (con Almacenes embebido) ==================== */}
        {activeTab === 'stock' && (
          <StockDashboard
            products={products}
            predictions={predictions}
            onDeleteProduct={hasPermission('canDeleteProducts')
              ? async (codigo: string) => {
                  // Defensa extra: el botón ya está gateado por permisos,
                  // pero alguien podría llamar el callback desde la consola.
                  if (!hasPermission('canDeleteProducts')) {
                    alert('No tenés permisos para eliminar productos. Solo administradores.');
                    return;
                  }

                  // DELETE directo a Supabase, sin el store que silencia
                  // errores. Mismo patrón que el fix de creación (PR #63).
                  const { data: prev } = await supabase
                    .from('productos')
                    .select('*')
                    .eq('codigo', codigo)
                    .single();

                  const { error } = await supabase
                    .from('productos')
                    .delete()
                    .eq('codigo', codigo);

                  if (error) {
                    // 23503 = foreign_key_violation. Caso típico: hay
                    // movimientos / lotes / BOM / órdenes que referencian
                    // el producto y no tienen ON DELETE CASCADE.
                    if ((error as any).code === '23503') {
                      alert(
                        `No se puede eliminar el producto "${codigo}" porque tiene ` +
                        `registros relacionados (movimientos, lotes, BOM, órdenes u otros).\n\n` +
                        `Detalle: ${error.message}`
                      );
                    } else {
                      const c = (error as any).code ?? 'sin código';
                      alert(`Error al eliminar el producto: ${error.message} (${c})`);
                    }
                    return;
                  }

                  // Auditoría — no bloqueante
                  if (prev) {
                    await supabase.from('auditoria').insert({
                      tabla: 'productos',
                      accion: 'ELIMINAR',
                      codigo,
                      datos_anteriores: prev,
                      datos_nuevos: null,
                      usuario_email: user?.email || 'Sistema',
                    });
                  }

                  // Refresh inmediato + broadcast para que otros módulos
                  // (Dashboard, Reportes, etc.) también recalculen.
                  await fetchProducts();
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('vg:stock-changed', {
                      detail: { source: 'producto-eliminado', codigo },
                    }));
                  }
                }
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

        {activeTab === 'distribucion' && (
          <div className="w-full">
            <DistribucionModule />
          </div>
        )}

        

        {/* ==================== VISTA EJECUTIVA ==================== */}
        {activeTab === 'executive' && (
          <ExecutiveDashboard />
        )}

        {/* ==================== RECOMENDADOR DE PRECIOS ==================== */}
        {activeTab === 'pricing' && (
          <PricingRecommender />
        )}

        {/* ==================== REABASTECIMIENTO IA ==================== */}
        {activeTab === 'replenishment' && (
          <ReplenishmentDashboard />
        )}

        {/* ==================== CLIENTES EN RIESGO ==================== */}
        {activeTab === 'customer_risk' && (
          <CustomerRiskModule />
        )}


        {/* ==================== CONFIGURACIÓN MODO LITE/FULL ==================== */}
        {activeTab === 'configuracion' && (
          <ConfigModulos />
        )}

        {/* ==================== MIS EMPRESAS ==================== */}
        {activeTab === 'empresas' && (
          <MisEmpresasModule />
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

        {activeTab === 'gestion_clientes' && (
          <GestionClientes userEmail={user?.email || ''} />
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

          <div className="grid grid-cols-3 gap-4">
            <Select
              label="Unidad"
              value={newProduct.unidad}
              onChange={(e) => setNewProduct({ ...newProduct, unidad: e.target.value })}
              options={[
                { value: 'unidad', label: 'Por unidad' },
                { value: 'litro', label: 'Por litro' },
                { value: 'paquete', label: 'Por paquete' },
                { value: 'kg', label: 'Por kg' },
                { value: 'metro', label: 'Por metro' },
              ]}
            />
            <Select
              label="Moneda"
              value={newProduct.moneda}
              onChange={(e) => setNewProduct({ ...newProduct, moneda: e.target.value as typeof newProduct.moneda })}
              options={[
                { value: 'UYU', label: 'UYU — Pesos uruguayos' },
                { value: 'USD', label: 'USD — Dólares' },
              ]}
            />
            <Input
              label={t('stock.minStock')}
              type="number"
              value={newProduct.stockMinimo}
              onChange={(e) => setNewProduct({ ...newProduct, stockMinimo: e.target.value })}
              placeholder="10"
            />
          </div>

          {/* Stock inicial + precio de compra (con opción de pack) */}
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <h4 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2">
              <Package size={16} />
              Stock inicial y compra (opcional)
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Cantidad inicial (unidades)"
                type="number"
                value={newProduct.stockInicial}
                onChange={(e) => setNewProduct({ ...newProduct, stockInicial: e.target.value })}
                placeholder="0"
              />
              <Input
                label={newProduct.compraPorPack ? 'Precio de compra (por pack)' : 'Precio de compra (por unidad)'}
                type="number"
                step="0.01"
                value={newProduct.costoInicial}
                onChange={(e) => setNewProduct({ ...newProduct, costoInicial: e.target.value })}
                placeholder="0.00"
              />
            </div>

            {/* Compra por pack */}
            <label className="flex items-center gap-2 mt-3 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                className="accent-blue-500"
                checked={newProduct.compraPorPack}
                onChange={(e) => setNewProduct({ ...newProduct, compraPorPack: e.target.checked })}
              />
              El precio de compra es por pack (no por unidad)
            </label>
            {newProduct.compraPorPack && (
              <div className="mt-2">
                <Input
                  label="Unidades por pack"
                  type="number"
                  value={newProduct.unidadesPorPack}
                  onChange={(e) => setNewProduct({ ...newProduct, unidadesPorPack: e.target.value })}
                  placeholder="Ej: 12"
                />
                {(() => {
                  const pc = parseFloat(newProduct.costoInicial) || 0;
                  const up = parseInt(newProduct.unidadesPorPack) || 0;
                  return up > 0 && pc > 0 ? (
                    <p className="text-xs text-blue-300 mt-1">
                      Costo unitario calculado: {(pc / up).toFixed(2)} {newProduct.moneda}
                    </p>
                  ) : null;
                })()}
              </div>
            )}

            <p className="text-xs text-slate-500 mt-2">
              Si cargás cantidad inicial, se crea automáticamente un movimiento de entrada con este costo.
            </p>
          </div>

          <Select
            label={t('stock.category')}
            value={newProduct.categoria}
            onChange={(e) => setNewProduct({ ...newProduct, categoria: e.target.value })}
            options={categoryOptions}
            placeholder={t('stock.selectCategory')}
          />

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Observaciones (opcional)</label>
            <textarea
              value={newProduct.comentarios}
              onChange={(e) => setNewProduct({ ...newProduct, comentarios: e.target.value })}
              rows={2}
              placeholder="Notas sobre el producto, motivo del alta, etc. — quedan en el historial."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Almacén: por defecto el depósito de ventas; el usuario puede elegir
              otro (ej. insumos). El producto se crea en este almacén. */}
          {almacenes.length > 1 && (
            <Select
              label="Almacén"
              value={almacenSeleccionadoId}
              onChange={(e) => setNewProduct({ ...newProduct, almacenId: e.target.value, ubicacionId: '' })}
              options={almacenes.map(a => ({ value: a.id, label: a.nombre }))}
            />
          )}

          {/* Ubicación WMS (opcional): SOLO para Depósito de Ventas. Los
              insumos NO llevan ubicación. Si cargás stock inicial, lo coloca ahí. */}
          {ubicaciones.length > 0 && !esInsumoImplicito && (
            <Select
              label="Ubicación (opcional — coloca el stock inicial ahí)"
              value={newProduct.ubicacionId}
              onChange={(e) => setNewProduct({ ...newProduct, ubicacionId: e.target.value })}
              options={ubicaciones.map(u => ({ value: u.id, label: u.codigo_completo }))}
              placeholder="Sin ubicación"
            />
          )}
          {/* El almacén es implícito (depósito de ventas actual); no se elige. */}
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
                {editEsInsumo ? (
                  /* Insumos: no se venden → se edita el COSTO, no el precio de venta. */
                  <Input
                    label="Precio de costo"
                    type="number"
                    step="0.01"
                    value={(editProduct.costoPromedio ?? 0).toString()}
                    onChange={(e) => setEditProduct({ ...editProduct, costoPromedio: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                ) : (
                  <Input
                    label={t('stock.salePrice')}
                    type="number"
                    step="0.01"
                    value={editProduct.precio.toString()}
                    onChange={(e) => setEditProduct({ ...editProduct, precio: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                )}
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

      {/* Asistente Vanguard (IA) */}
      <ChatbotWidget />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onAction={handleCommand}
      />
      {/* Bienestar (Focus / Calma) oculto por ahora — se reactiva con BIENESTAR_HABILITADO. */}
      {BIENESTAR_HABILITADO && (
        <>
          <FocusModeBanner enabled={focusEnabled} />
          <CalmMode
            open={calm.open}
            onClose={() => calm.setOpen(false)}
            userName={user?.nombre || user?.email?.split('@')[0]}
            focos={calmFocos}
            ambient={calm.ambient}
            onToggleAmbient={calm.toggleAmbient}
          />
        </>
      )}
      {BIENESTAR_HABILITADO && stressScore && (
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

      {/* Atajos de teclado (se abre desde Configuración → Preferencias) */}
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* Tour de onboarding */}
      <OnboardingTour />

    </div>
  );
}