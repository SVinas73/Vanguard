'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { TabType } from '@/types';
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  Brain,
  ShoppingCart,
  TrendingUp,
  FileText,
  DollarSign,
  CircleDollarSign,
  Shield,
  Plug,
  ChevronLeft,
  ChevronRight,
  Lock,
  LogOut,
  LucideIcon,
  QrCode,
  GitBranch,
  RotateCcw,
  Landmark,
  Kanban,
  Boxes,
  Warehouse,
  Wrench,
  Zap,
  ChevronDown,
  MessageCircle,
  Users,
  Menu,
  X,
  Sun,
  Moon,
  Briefcase,
  Sparkles,
  Truck,
  ShieldAlert,
  Building2,
  Home
} from 'lucide-react';
import { useTheme } from '@/components/providers/theme-provider';
import { LanguageSelector } from '@/components/ui/language-selector';
import { useModulosHabilitados } from '@/hooks/useModulosHabilitados';
import { Logo } from '@/components/ui/Logo';
import { ChatBadge } from '@/components/chat';
import { ApprovalsBadge } from '@/components/approvals/ApprovalsBadge';

// ============================================
// TIPOS
// ============================================

interface SidebarPermissions {
  canViewCosts: boolean;
  canViewAudit: boolean;
  canViewReports: boolean;
  canViewFinanzas: boolean;
  canViewTaller: boolean;
  canViewWMS: boolean;
  canViewProyectos: boolean;
  canViewComercial: boolean;
  canViewDemand: boolean;
  canViewSeriales: boolean;
  canViewRMA: boolean;
  canViewBOM: boolean;
  canViewQMS: boolean;
  canExportData: boolean;
}

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  permissions: SidebarPermissions;
}

type PermissionName = keyof SidebarPermissions;

interface NavItem {
  id: TabType;
  label: string;
  icon: LucideIcon;
  permission?: PermissionName;
  badge?: string;
}

interface NavSection {
  key: string;        // estable, independiente del idioma
  title: string;     // traducido
  items: NavItem[];
  defaultOpen?: boolean;
}

// ============================================
// SIDEBAR COMPONENT
// ============================================

export function Sidebar({ activeTab, onTabChange, permissions }: SidebarProps) {
  const { t } = useTranslation();
  const { user, signOut, rol } = useAuth(false);
  const { theme, toggleTheme } = useTheme();
  const { modulos: modulosHabilitados, config: moduleConfig } = useModulosHabilitados();
  const moduloSet = React.useMemo(() => new Set<string>(modulosHabilitados), [modulosHabilitados]);
  const esLite = moduleConfig.preset === 'lite';
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    main: false,
    operations: false,
    postSales: false,
    people: false,
    analysis: false,
    control: false,
    config: false,
  });

  // Configuración de roles - colores más sutiles (Linear style)
  const rolConfig: Record<string, { label: string; color: string; bg: string }> = {
    admin: { label: 'Admin', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    vendedor: { label: t('roles.seller') || 'Vendedor', color: 'text-slate-300', bg: 'bg-slate-800' },
    bodeguero: { label: t('roles.warehouse') || 'Bodeguero', color: 'text-slate-300', bg: 'bg-slate-800' },
    operador: { label: t('roles.operator') || 'Operador', color: 'text-slate-300', bg: 'bg-slate-800' },
  };

  const currentRol = rolConfig[rol] || rolConfig.vendedor;

  // Navegación organizada por secciones
  const navigation: NavSection[] = [
    {
      key: 'main',
      title: t('nav.main') || 'Principal',
      defaultOpen: true,
      items: [
        { id: 'inicio', label: 'Inicio', icon: Home },
        { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
        { id: 'executive', label: t('nav.executive') || 'Vista Ejecutiva', icon: Briefcase, badge: 'C' },
        { id: 'comercial', label: t('modules.comercial'), icon: DollarSign, permission: 'canViewComercial' },
      ]
    },
    {
      key: 'logistica',
      title: 'Logística',
      defaultOpen: false,
      items: [
        { id: 'movimientos', label: t('nav.movements'), icon: ArrowLeftRight },
        { id: 'stock', label: t('nav.stock'), icon: Package },
        { id: 'wms', label: t('modules.wms'), icon: Warehouse, permission: 'canViewWMS' },
        { id: 'distribucion', label: 'Distribución', icon: Truck },
        { id: 'replenishment', label: t('nav.replenishment') || 'Reabastecimiento IA', icon: Truck, badge: 'AI' },
        { id: 'demand', label: t('modules.demandPlanning'), icon: Zap, badge: 'AI', permission: 'canViewDemand' },
      ]
    },
    {
      key: 'clientes',
      title: 'Clientes',
      defaultOpen: false,
      items: [
        { id: 'gestion_clientes', label: 'Gestión de clientes', icon: Users },
        { id: 'clientes_360', label: t('modules.customers360') || 'Cliente 360°', icon: Users },
        { id: 'customer_risk', label: t('nav.customerRisk') || 'Clientes en riesgo', icon: ShieldAlert, badge: 'AI' },
      ]
    },
    {
      key: 'postSales',
      title: t('nav.postSales') || 'Post-venta',
      defaultOpen: true,
      items: [
        { id: 'taller', label: t('modules.workshop'), icon: Wrench, permission: 'canViewTaller' },
        { id: 'garantias', label: t('modules.warranties') || 'Garantías', icon: Shield },
        { id: 'tickets', label: t('modules.tickets') || 'Tickets soporte', icon: MessageCircle },
        { id: 'rma', label: t('modules.returns'), icon: RotateCcw, permission: 'canViewRMA' },
      ]
    },
    {
      key: 'people',
      title: t('nav.people') || 'Personal',
      defaultOpen: true,
      items: [
        { id: 'rrhh', label: t('modules.hr') || 'Recursos Humanos', icon: Users },
        { id: 'proyectos', label: t('modules.projects'), icon: Kanban, permission: 'canViewProyectos' },
        { id: 'chat', label: t('modules.messages'), icon: MessageCircle },
      ]
    },
    {
      key: 'analysis',
      title: t('nav.analysis') || 'Análisis',
      defaultOpen: true,
      items: [
        { id: 'analytics', label: t('nav.analytics'), icon: Brain, badge: 'AI' },
        { id: 'pricing', label: t('nav.pricing') || 'Precios IA', icon: Sparkles, badge: 'AI' },
        { id: 'reportes', label: t('nav.reports'), icon: FileText, permission: 'canViewReports' },
      ]
    },
    {
      key: 'control',
      title: t('nav.controlTracking', 'Control & Seguimiento'),
      defaultOpen: false,
      items: [
        { id: 'aprobaciones', label: t('nav.approvals') || 'Aprobaciones', icon: Shield },
        { id: 'seriales', label: t('modules.serials'), icon: QrCode, permission: 'canViewSeriales' },
        { id: 'trazabilidad', label: t('modules.traceability'), icon: GitBranch, permission: 'canViewSeriales' },
        { id: 'qms', label: t('modules.quality'), icon: Shield, permission: 'canViewQMS' },
        { id: 'auditoria', label: t('nav.audit'), icon: Shield, permission: 'canViewAudit' },
      ]
    },
    {
      key: 'config',
      title: t('nav.config') || 'Configuración',
      defaultOpen: false,
      items: [
        { id: 'empresas', label: 'Mis empresas', icon: Building2 },
        { id: 'configuracion', label: 'General', icon: Sparkles },
        { id: 'integraciones', label: t('nav.integrations'), icon: Plug },
      ]
    },
  ];

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const checkPermission = (item: NavItem): boolean => {
    if (!item.permission) return true;
    return permissions[item.permission];
  };

  // Filtramos por módulos habilitados (preset Lite/Custom). Si el preset es 'full',
  // moduloSet contiene todos y nada se filtra.
  const navegacionFiltrada = navigation
    .map(section => ({
      ...section,
      items: section.items.filter(it => moduloSet.has(it.id as string)),
    }))
    .filter(section => section.items.length > 0);

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-[#0D0D0D] border border-[#2E2E2E] text-[#A0A0A0] hover:text-[#F1F1F1] hover:bg-[#1A1A1A] transition-colors"
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>

      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-[55] transition-opacity duration-200"
          onClick={() => setMobileOpen(false)}
        />
      )}

    <aside
      className={cn(
        'fixed left-0 top-0 h-screen flex flex-col transition-transform duration-200 lg:transition-all lg:duration-150 z-[60]',
        'bg-[#0D0D0D] border-r border-[#1A1A1A]',
        collapsed ? 'w-[56px]' : 'w-[220px]',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:translate-x-0'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-2.5 h-14 px-4 border-b border-[#1A1A1A]',
        collapsed && 'justify-center px-2'
      )}>
        <Logo size={38} />
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <h1 className="text-[13px] font-medium text-[#F1F1F1] tracking-tight">
              Vanguard
            </h1>
          </div>
        )}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1 rounded text-[#6B6B6B] hover:text-[#F1F1F1] hover:bg-[#1A1A1A] transition-colors"
          aria-label="Close menu"
        >
          <X size={16} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {esLite && !collapsed && (
          <div className="mx-1 mb-2 px-2.5 py-1.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 flex items-center justify-between">
            <span className="font-medium">Modo Lite</span>
            <span className="text-[10px] text-indigo-400/80">{modulosHabilitados.length} módulos</span>
          </div>
        )}
        {navegacionFiltrada.map((section) => {
          const isOpen = openSections[section.key] ?? section.defaultOpen;

          return (
            <div key={section.key} className="mb-0.5">
              {!collapsed && (
                <button
                  onClick={() => toggleSection(section.key)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 text-[10px] font-medium text-[#6B6B6B] uppercase tracking-[0.06em] hover:text-[#A0A0A0] transition-colors"
                >
                  <span>{section.title}</span>
                  <ChevronDown
                    size={10}
                    className={cn(
                      'transition-transform duration-150',
                      isOpen && 'rotate-180'
                    )}
                  />
                </button>
              )}

              <div className={cn(
                'space-y-px',
                !collapsed && !isOpen && 'hidden'
              )}>
                {section.items.map((item) => {
                  const hasPermission = checkPermission(item);
                  const isActive = activeTab === item.id;
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.id}
                      onClick={() => { if (hasPermission) { onTabChange(item.id); setMobileOpen(false); } }}
                      disabled={!hasPermission}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded transition-colors duration-100 group relative',
                        isActive
                          ? 'bg-[#1A1A1A] text-[#F1F1F1]'
                          : hasPermission
                            ? 'text-[#A0A0A0] hover:text-[#F1F1F1] hover:bg-[#1A1A1A]/60'
                            : 'text-[#4A4A4A] cursor-not-allowed',
                        collapsed && 'justify-center px-2'
                      )}
                    >
                      {/* Active indicator */}
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-3.5 bg-indigo-500 rounded-r-full" />
                      )}

                      <Icon
                        size={15}
                        strokeWidth={isActive ? 2 : 1.5}
                        className={cn('flex-shrink-0', isActive && 'text-indigo-400')}
                      />

                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left text-[12px] font-medium">
                            {item.label}
                          </span>

                          {item.id === 'chat' && <ChatBadge />}
                          {item.id === 'aprobaciones' && <ApprovalsBadge />}

                          {item.badge && (
                            <span className="px-1 py-0.5 text-[9px] font-semibold bg-indigo-500/10 text-indigo-400 rounded">
                              {item.badge}
                            </span>
                          )}

                          {!hasPermission && (
                            <Lock size={10} className="text-[#4A4A4A]" />
                          )}
                        </>
                      )}

                      {collapsed && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-[#1A1A1A] border border-[#2E2E2E] text-[#F1F1F1] text-[11px] font-medium rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg">
                          {item.label}
                          {item.badge && (
                            <span className="ml-1 text-indigo-400">{item.badge}</span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={cn(
        'border-t border-[#1A1A1A] p-2 space-y-0.5',
        collapsed && 'px-1.5'
      )}>
        <button
          onClick={toggleTheme}
          className={cn(
            'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-[#A0A0A0] hover:text-[#F1F1F1] hover:bg-[#1A1A1A]/60 transition-colors',
            collapsed && 'justify-center px-2'
          )}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={15} strokeWidth={1.5} /> : <Moon size={15} strokeWidth={1.5} />}
          {!collapsed && (
            <span className="text-[12px] font-medium">
              {theme === 'dark' ? t('theme.lightMode') : t('theme.darkMode')}
            </span>
          )}
        </button>

        <LanguageSelector collapsed={collapsed} />

        {user && (
          <div className={cn(
            'flex items-center gap-2.5 p-2 mt-1 rounded border-t border-[#1A1A1A]/60 pt-2.5',
            collapsed && 'justify-center p-2 border-t-0 pt-2'
          )}>
            <div className="w-6 h-6 rounded flex items-center justify-center text-[11px] font-medium bg-[#1A1A1A] text-[#F1F1F1] ring-1 ring-inset ring-[#2E2E2E]">
              {(user.nombre || user.email || 'U').charAt(0).toUpperCase()}
            </div>

            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-[#F1F1F1] truncate">
                    {user.nombre || user.email?.split('@')[0]}
                  </p>
                  <p className="text-[10px] text-[#6B6B6B]">
                    {currentRol.label}
                  </p>
                </div>

                <button
                  onClick={signOut}
                  className="p-1 rounded hover:bg-[#1A1A1A] text-[#6B6B6B] hover:text-red-400 transition-colors"
                  title={t('header.logout') || 'Cerrar sesión'}
                >
                  <LogOut size={13} />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Collapse button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          'absolute -right-3 top-[52px] w-5 h-5 bg-[#0D0D0D] border border-[#2E2E2E] rounded-full',
          'flex items-center justify-center text-[#6B6B6B] hover:text-[#F1F1F1] hover:bg-[#1A1A1A] transition-colors'
        )}
      >
        {collapsed ? <ChevronRight size={10} /> : <ChevronLeft size={10} />}
      </button>
    </aside>
    </>
  );
}

// ============================================
// TOP BAR
// ============================================

interface TopBarProps {
  title?: string;
  children?: React.ReactNode;
}

export function TopBar({ title, children }: TopBarProps) {
  return (
    <header className="h-12 border-b border-[#1A1A1A] bg-[#0D0D0D]/80 backdrop-blur-sm flex items-center justify-between px-5">
      <div>
        {title && (
          <h1 className="text-[13px] font-medium text-[#F1F1F1] tracking-tight">{title}</h1>
        )}
      </div>
      <div className="flex items-center gap-2">
        {children}
      </div>
    </header>
  );
}

// ============================================
// APP LAYOUT
// ============================================

interface AppLayoutProps {
  children: React.ReactNode;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  permissions: SidebarPermissions;
}

export function AppLayout({ children, activeTab, onTabChange, permissions }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[#0D0D0D]">
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={onTabChange}
        permissions={permissions}
      />
      <main className={cn(
        'transition-all duration-150',
        sidebarCollapsed ? 'ml-0 lg:ml-[56px]' : 'ml-0 lg:ml-[220px]'
      )}>
        {children}
      </main>
    </div>
  );
}
