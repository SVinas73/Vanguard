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
  MessageCircle
} from 'lucide-react';
import { LanguageSelector } from '@/components/ui/language-selector';
import { NotificacionesBell } from '@/components/proyectos/NotificacionesBell';
import { ChatBadge } from '@/components/chat';

// ============================================
// TIPOS
// ============================================

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  permissions: {
    canViewCosts: boolean;
    canViewAudit: boolean;
    canViewReports: boolean;
  };
}

interface NavItem {
  id: TabType;
  label: string;
  icon: LucideIcon;
  permission?: 'canViewCosts' | 'canViewAudit' | 'canViewReports';
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
  const [collapsed, setCollapsed] = useState(false);
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
        { id: 'chat', label: 'Mensajes', icon: MessageCircle },
      ]
    },
    {
      title: t('nav.operations') || 'Operaciones',
      defaultOpen: true,
      items: [
        { id: 'comercial', label: 'Comercial', icon: DollarSign },
        { id: 'compras', label: t('nav.purchases'), icon: ShoppingCart },
        { id: 'ventas', label: t('nav.sales'), icon: TrendingUp },
        { id: 'finanzas', label: 'Finanzas', icon: Landmark },
        { id: 'proyectos', label: 'Proyectos', icon: Kanban },
        { id: 'taller', label: 'Taller', icon: Wrench },
        { id: 'wms', label: 'WMS', icon: Warehouse },
        { id: 'costos', label: 'Costos', icon: CircleDollarSign },
      ]
    },
    {
      title: t('nav.analysis') || 'Análisis',
      defaultOpen: true,
      items: [
        { id: 'analytics', label: t('nav.analytics'), icon: Brain, badge: 'AI' },
        { id: 'demand', label: 'Demand Planning', icon: Zap, badge: 'AI' },
        { id: 'reportes', label: t('nav.reports'), icon: FileText, permission: 'canViewReports' },
        { id: 'qms', label: 'Calidad (QMS)', icon: Shield },
      ]
    },
    {
      title: t('nav.controlTracking', 'Control & Seguimiento'),
      defaultOpen: false,
      items: [
        { id: 'seriales', label: 'Seriales', icon: QrCode },
        { id: 'trazabilidad', label: 'Trazabilidad', icon: GitBranch },
        { id: 'rma', label: 'Devoluciones', icon: RotateCcw },
        { id: 'bom', label: 'BOM', icon: Boxes },
        { id: 'ensamblajes', label: 'Ensamblajes', icon: Wrench },
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
    <aside 
      className={cn(
        'fixed left-0 top-0 h-screen flex flex-col transition-all duration-200 z-50',
        'bg-[#0f1117] border-r border-[#1e2028]',
        collapsed ? 'w-[68px]' : 'w-[240px]'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 h-16 px-4 border-b border-[#1e2028]',
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
                  className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-medium text-[#64748b] uppercase tracking-wider hover:text-[#94a3b8] transition-colors"
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
                      onClick={() => hasPermission && onTabChange(item.id)}
                      disabled={!hasPermission}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 group relative',
                        isActive 
                          ? 'bg-blue-500/10 text-blue-400' 
                          : hasPermission
                            ? 'text-[#94a3b8] hover:text-white hover:bg-[#1c1f26]'
                            : 'text-[#475569] cursor-not-allowed',
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
                            <Lock size={12} className="text-[#475569]" />
                          )}
                        </>
                      )}

                      {/* Tooltip for collapsed state */}
                      {collapsed && (
                        <div className="absolute left-full ml-2 px-2 py-1.5 bg-[#1c1f26] border border-[#2e323d] text-white text-xs font-medium rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg">
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
        'border-t border-[#1e2028] p-3 space-y-2',
        collapsed && 'px-2'
      )}>
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
                  className="p-1.5 rounded-md hover:bg-[#1c1f26] text-[#64748b] hover:text-red-400 transition-colors"
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
          'absolute -right-3 top-[72px] w-6 h-6 bg-[#1c1f26] border border-[#2e323d] rounded-full',
          'flex items-center justify-center text-[#64748b] hover:text-white hover:bg-[#242830] transition-colors'
        )}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
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
    <header className="h-14 border-b border-[#1e2028] bg-[#0f1117]/80 backdrop-blur-sm flex items-center justify-between px-6">
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
  permissions: {
    canViewCosts: boolean;
    canViewAudit: boolean;
    canViewReports: boolean;
  };
}

export function AppLayout({ children, activeTab, onTabChange, permissions }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[#0f1117]">
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={onTabChange}
        permissions={permissions}
      />
      <main className={cn(
        'transition-all duration-200',
        sidebarCollapsed ? 'ml-[68px]' : 'ml-[240px]'
      )}>
        {children}
      </main>
    </div>
  );
}