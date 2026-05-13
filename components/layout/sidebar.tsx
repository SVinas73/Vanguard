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
  Moon
} from 'lucide-react';
import { useTheme } from '@/components/providers/theme-provider';
import { LanguageSelector } from '@/components/ui/language-selector';
import { Logo } from '@/components/ui/Logo';
import { NotificacionesBell } from '@/components/proyectos/NotificacionesBell';
import { ChatBadge } from '@/components/chat';

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
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    main: true,
    operations: true,
    postSales: true,
    people: true,
    analysis: true,
    control: false,
    config: false,
  });

  // Configuración de roles - colores más sutiles
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
        { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
        { id: 'stock', label: t('nav.stock'), icon: Package },
        { id: 'movimientos', label: t('nav.movements'), icon: ArrowLeftRight },
        { id: 'chat', label: t('modules.messages'), icon: MessageCircle },
      ]
    },
    {
      key: 'operations',
      title: t('nav.operations') || 'Operaciones',
      defaultOpen: true,
      items: [
        { id: 'comercial', label: t('modules.comercial'), icon: DollarSign, permission: 'canViewComercial' },
        { id: 'proyectos', label: t('modules.projects'), icon: Kanban, permission: 'canViewProyectos' },
        { id: 'wms', label: t('modules.wms'), icon: Warehouse, permission: 'canViewWMS' },
        { id: 'facturacion', label: t('nav.invoicing') || 'Facturación electrónica', icon: FileText },
        { id: 'clientes_360', label: t('modules.customers360') || 'Cliente 360°', icon: Users },
        { id: 'bom', label: t('modules.bom'), icon: Boxes, permission: 'canViewBOM' },
        { id: 'ensamblajes', label: t('modules.assemblies'), icon: Wrench, permission: 'canViewBOM' },
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
      ]
    },
    {
      key: 'analysis',
      title: t('nav.analysis') || 'Análisis',
      defaultOpen: true,
      items: [
        { id: 'analytics', label: t('nav.analytics'), icon: Brain, badge: 'AI' },
        { id: 'demand', label: t('modules.demandPlanning'), icon: Zap, badge: 'AI', permission: 'canViewDemand' },
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

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-[55] transition-opacity duration-300"
          onClick={() => setMobileOpen(false)}
        />
      )}

    <aside
      className={cn(
        'fixed left-0 top-0 h-screen flex flex-col transition-transform duration-300 lg:transition-all lg:duration-200 z-[60]',
        'bg-slate-950 border-r border-slate-800',
        collapsed ? 'w-[68px]' : 'w-[240px]',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:translate-x-0'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 h-16 px-4 border-b border-slate-800',
        collapsed && 'justify-center px-2'
      )}>
        <Logo size={28} />
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <h1 className="text-[14px] font-semibold text-slate-100 tracking-tight">
              Vanguard
            </h1>
          </div>
        )}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 rounded-md hover:bg-slate-900 text-slate-500 hover:text-slate-100 transition-colors"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {navigation.map((section) => {
          const isOpen = openSections[section.key] ?? section.defaultOpen;

          return (
            <div key={section.key} className="mb-1">
              {!collapsed && (
                <button
                  onClick={() => toggleSection(section.key)}
                  className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-medium text-slate-500 uppercase tracking-[0.08em] hover:text-slate-300 transition-colors"
                >
                  <span>{section.title}</span>
                  <ChevronDown
                    size={12}
                    className={cn(
                      'transition-transform duration-200',
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
                        'w-full flex items-center gap-3 px-3 py-1.5 rounded-md transition-colors duration-150 group relative',
                        isActive
                          ? 'bg-slate-900 text-slate-100'
                          : hasPermission
                            ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60'
                            : 'text-slate-700 cursor-not-allowed',
                        collapsed && 'justify-center px-2'
                      )}
                    >
                      {/* Active indicator — barra fina indigo */}
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-indigo-500 rounded-r-full" />
                      )}

                      <Icon
                        size={16}
                        strokeWidth={isActive ? 2 : 1.75}
                        className={cn('flex-shrink-0', isActive && 'text-indigo-400')}
                      />

                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left text-[13px] font-medium">
                            {item.label}
                          </span>

                          {item.id === 'chat' && <ChatBadge />}

                          {item.badge && (
                            <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-indigo-500/10 text-indigo-300 rounded ring-1 ring-inset ring-indigo-500/20">
                              {item.badge}
                            </span>
                          )}

                          {!hasPermission && (
                            <Lock size={11} className="text-slate-700" />
                          )}
                        </>
                      )}

                      {collapsed && (
                        <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-slate-900 border border-slate-800 text-slate-100 text-xs font-medium rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg">
                          {item.label}
                          {item.badge && (
                            <span className="ml-1.5 text-indigo-400">{item.badge}</span>
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
        'border-t border-slate-800 p-2 space-y-1',
        collapsed && 'px-1.5'
      )}>
        <button
          onClick={toggleTheme}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-900/60 transition-colors',
            collapsed && 'justify-center px-2'
          )}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
          {!collapsed && (
            <span className="text-[13px] font-medium">
              {theme === 'dark' ? t('theme.lightMode') : t('theme.darkMode')}
            </span>
          )}
        </button>

        <NotificacionesBell collapsed={collapsed} />
        <LanguageSelector collapsed={collapsed} />

        {user && (
          <div className={cn(
            'flex items-center gap-3 p-2 mt-1 rounded-md border-t border-slate-800/60 pt-3',
            collapsed && 'justify-center p-2 border-t-0 pt-2'
          )}>
            <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-semibold bg-slate-800 text-slate-200 ring-1 ring-inset ring-slate-700">
              {(user.nombre || user.email || 'U').charAt(0).toUpperCase()}
            </div>

            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-slate-100 truncate">
                    {user.nombre || user.email?.split('@')[0]}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {currentRol.label}
                  </p>
                </div>

                <button
                  onClick={signOut}
                  className="p-1.5 rounded-md hover:bg-slate-900 text-slate-500 hover:text-red-400 transition-colors"
                  title={t('header.logout') || 'Cerrar sesión'}
                >
                  <LogOut size={14} />
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
          'absolute -right-3 top-[64px] w-6 h-6 bg-slate-900 border border-slate-800 rounded-full',
          'flex items-center justify-center text-slate-500 hover:text-slate-100 hover:bg-slate-800 transition-colors'
        )}
      >
        {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
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
    <header className="h-14 border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm flex items-center justify-between px-6">
      <div>
        {title && (
          <h1 className="text-sm font-semibold text-slate-100 tracking-tight">{title}</h1>
        )}
      </div>
      <div className="flex items-center gap-3">
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
    <div className="min-h-screen bg-slate-950">
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={onTabChange}
        permissions={permissions}
      />
      <main className={cn(
        'transition-all duration-200',
        sidebarCollapsed ? 'ml-0 lg:ml-[68px]' : 'ml-0 lg:ml-[240px]'
      )}>
        {children}
      </main>
    </div>
  );
}