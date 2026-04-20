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
  Menu,
  X,
  Sun,
  Moon
} from 'lucide-react';
import { useTheme } from '@/components/providers/theme-provider';
import { LanguageSelector } from '@/components/ui/language-selector';
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
  title: string;
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
    'Principal': true,
    'Operaciones': true,
    'Análisis': true,
    'Control & Seguimiento': false,
    'Configuración': false,
  });

  // Configuración de roles - colores más sutiles
  const rolConfig: Record<string, { label: string; color: string; bg: string }> = {
    admin: { label: 'Admin', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    vendedor: { label: t('roles.seller') || 'Vendedor', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    bodeguero: { label: t('roles.warehouse') || 'Bodeguero', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    operador: { label: t('roles.operator') || 'Operador', color: 'text-violet-400', bg: 'bg-violet-500/10' },
  };

  const currentRol = rolConfig[rol] || rolConfig.vendedor;

  // Navegación organizada por secciones
  const navigation: NavSection[] = [
    {
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
      title: t('nav.operations') || 'Operaciones',
      defaultOpen: true,
      items: [
        { id: 'comercial', label: t('modules.comercial'), icon: DollarSign, permission: 'canViewComercial' },
        { id: 'proyectos', label: t('modules.projects'), icon: Kanban, permission: 'canViewProyectos' },
        { id: 'taller', label: t('modules.workshop'), icon: Wrench, permission: 'canViewTaller' },
        { id: 'wms', label: t('modules.wms'), icon: Warehouse, permission: 'canViewWMS' },
      ]
    },
    {
      title: t('nav.analysis') || 'Análisis',
      defaultOpen: true,
      items: [
        { id: 'analytics', label: t('nav.analytics'), icon: Brain, badge: 'AI' },
        { id: 'demand', label: t('modules.demandPlanning'), icon: Zap, badge: 'AI', permission: 'canViewDemand' },
        { id: 'reportes', label: t('nav.reports'), icon: FileText, permission: 'canViewReports' },
        { id: 'qms', label: t('modules.quality'), icon: Shield, permission: 'canViewQMS' },
      ]
    },
    {
      title: t('nav.controlTracking', 'Control & Seguimiento'),
      defaultOpen: false,
      items: [
        { id: 'seriales', label: t('modules.serials'), icon: QrCode, permission: 'canViewSeriales' },
        { id: 'trazabilidad', label: t('modules.traceability'), icon: GitBranch, permission: 'canViewSeriales' },
        { id: 'rma', label: t('modules.returns'), icon: RotateCcw, permission: 'canViewRMA' },
        { id: 'bom', label: t('modules.bom'), icon: Boxes, permission: 'canViewBOM' },
        { id: 'ensamblajes', label: t('modules.assemblies'), icon: Wrench, permission: 'canViewBOM' },
      ]
    },
    {
      title: t('nav.config') || 'Configuración',
      defaultOpen: false,
      items: [
        { id: 'integraciones', label: t('nav.integrations'), icon: Plug },
        { id: 'auditoria', label: t('nav.audit'), icon: Shield, permission: 'canViewAudit' },
      ]
    },
  ];

  const toggleSection = (title: string) => {
    setOpenSections(prev => ({ ...prev, [title]: !prev[title] }));
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
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-colors"
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
        'bg-slate-900 border-r border-slate-800',
        collapsed ? 'w-[68px]' : 'w-[240px]',
        // Mobile: off-screen by default, slide in when open
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:translate-x-0'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 h-16 px-4 border-b border-slate-800',
        collapsed && 'justify-center px-2'
      )}>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
          <span className="text-white font-bold text-sm">V</span>
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <h1 className="text-[15px] font-semibold text-white tracking-tight">
              Vanguard
            </h1>
          </div>
        )}
        {/* Mobile close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 rounded-md hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {navigation.map((section) => {
          const isOpen = openSections[section.title] ?? section.defaultOpen;
          
          return (
            <div key={section.title} className="mb-1">
              {/* Section header */}
              {!collapsed && (
                <button
                  onClick={() => toggleSection(section.title)}
                  className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider hover:text-slate-400 transition-colors"
                >
                  <span>{section.title}</span>
                  <ChevronDown 
                    size={14} 
                    className={cn(
                      'transition-transform duration-200',
                      isOpen && 'rotate-180'
                    )}
                  />
                </button>
              )}
              
              {/* Section items */}
              <div className={cn(
                'space-y-0.5',
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
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 group relative',
                        isActive 
                          ? 'bg-blue-500/10 text-blue-400' 
                          : hasPermission
                            ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                            : 'text-slate-600 cursor-not-allowed',
                        collapsed && 'justify-center px-2'
                      )}
                    >
                      {/* Active indicator */}
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-500 rounded-r-full" />
                      )}
                      
                      <Icon 
                        size={18} 
                        strokeWidth={isActive ? 2 : 1.5}
                        className="flex-shrink-0"
                      />
                      
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left text-[13px] font-medium">
                            {item.label}
                          </span>
                          
                          {item.id === 'chat' && (
                            <ChatBadge />
                          )}
                          
                          {item.badge && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/15 text-blue-400 rounded">
                              {item.badge}
                            </span>
                          )}
                          
                          {!hasPermission && (
                            <Lock size={12} className="text-slate-600" />
                          )}
                        </>
                      )}

                      {/* Tooltip for collapsed state */}
                      {collapsed && (
                        <div className="absolute left-full ml-2 px-2 py-1.5 bg-slate-800 border border-slate-700 text-white text-xs font-medium rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg">
                          {item.label}
                          {item.badge && (
                            <span className="ml-1.5 text-blue-400">{item.badge}</span>
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

      {/* Footer section */}
      <div className={cn(
        'border-t border-slate-800 p-3 space-y-2',
        collapsed && 'px-2'
      )}>
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors',
            collapsed && 'justify-center px-2'
          )}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
          {!collapsed && (
            <span className="text-[13px] font-medium">
              {theme === 'dark' ? t('theme.lightMode') : t('theme.darkMode')}
            </span>
          )}
        </button>

        {/* Notificaciones */}
        <NotificacionesBell collapsed={collapsed} />
        
        {/* Language Selector */}
        <LanguageSelector collapsed={collapsed} />
        
        {/* User */}
        {user && (
          <div className={cn(
            'flex items-center gap-3 p-2 rounded-lg',
            collapsed && 'justify-center p-2'
          )}>
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold',
              currentRol.bg, currentRol.color
            )}>
              {(user.nombre || user.email || 'U').charAt(0).toUpperCase()}
            </div>
            
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {user.nombre || user.email?.split('@')[0]}
                  </p>
                  <p className={cn('text-xs', currentRol.color)}>
                    {currentRol.label}
                  </p>
                </div>
                
                <button
                  onClick={signOut}
                  className="p-1.5 rounded-md hover:bg-slate-800 text-slate-500 hover:text-red-400 transition-colors"
                  title={t('header.logout') || 'Cerrar sesión'}
                >
                  <LogOut size={16} />
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
          'absolute -right-3 top-[72px] w-6 h-6 bg-slate-800 border border-slate-700 rounded-full',
          'flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-700 transition-colors'
        )}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
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
    <header className="h-14 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm flex items-center justify-between px-6">
      <div>
        {title && (
          <h1 className="text-base font-semibold text-white">{title}</h1>
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
    <div className="min-h-screen bg-slate-900">
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