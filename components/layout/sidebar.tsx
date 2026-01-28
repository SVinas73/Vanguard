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
  Shield,
  Plug,
  ChevronLeft,
  ChevronRight,
  Lock,
  LogOut,
  User,
  Settings,
  Sparkles,
  LucideIcon,
  QrCode,
  GitBranch,
  RotateCcw,
  Kanban,
  Boxes,
  BarChart3,
  Wrench
} from 'lucide-react';
import { LanguageSelector } from '@/components/ui/language-selector';
import { NotificacionesBell } from '@/components/proyectos/NotificacionesBell';


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
}

// ============================================
// SIDEBAR COMPONENT
// ============================================

export function Sidebar({ activeTab, onTabChange, permissions }: SidebarProps) {
  const { t } = useTranslation();
  const { user, signOut, rol } = useAuth(false);
  const [collapsed, setCollapsed] = useState(false);

  // Configuración de roles
  const rolConfig: Record<string, { label: string; color: string; bg: string }> = {
    admin: { label: 'Admin', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    vendedor: { label: t('roles.seller') || 'Vendedor', color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
    bodeguero: { label: t('roles.warehouse') || 'Bodeguero', color: 'text-amber-400', bg: 'bg-amber-500/20' },
    operador: { label: t('roles.operator') || 'Operador', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  };

  const currentRol = rolConfig[rol] || rolConfig.vendedor;

  // Navegación organizada por secciones
  // NOTA: "almacenes" fue removido porque ahora está embebido en "stock"
  const navigation: NavSection[] = [
    {
      title: t('nav.main') || 'Principal',
      items: [
        { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
        { id: 'stock', label: t('nav.stock'), icon: Package },
        { id: 'movimientos', label: t('nav.movements'), icon: ArrowLeftRight },
      ]
    },
    {
      title: t('nav.operations') || 'Operaciones',
      items: [
        { id: 'comercial', label: 'Comercial', icon: DollarSign },
        { id: 'compras', label: t('nav.purchases'), icon: ShoppingCart },
        { id: 'ventas', label: t('nav.sales'), icon: TrendingUp },
        { id: 'proyectos', label: 'Gestión de Proyectos', icon: Kanban },
        // Almacenes removido de aquí - ahora está dentro de Stock
      ]
    },
    {
      title: t('nav.analysis') || 'Análisis',
      items: [
        { id: 'analytics', label: t('nav.analytics'), icon: Brain, badge: 'IA' },
        { id: 'reportes', label: t('nav.reports'), icon: FileText, permission: 'canViewReports' },
        { id: 'costos', label: t('nav.costs'), icon: DollarSign, permission: 'canViewCosts' },
      ]
    },
    {
      title: t('nav.controlTracking', 'Control & Seguimiento'),
      items: [
        { id: 'seriales', label: 'Seriales', icon: QrCode },
        { id: 'trazabilidad', label: 'Trazabilidad', icon: GitBranch },
        { id: 'rma', label: 'Devoluciones (RMA)', icon: RotateCcw },
        { id: 'bom', label: 'BOM', icon: Boxes },
        { id: 'ensamblajes', label: 'Ensamblajes', icon: Wrench },
      ]
    },
    {
      title: t('nav.config') || 'Configuración',
      items: [
        { id: 'integraciones', label: t('nav.integrations'), icon: Plug },
        { id: 'auditoria', label: t('nav.audit'), icon: Shield, permission: 'canViewAudit' },
      ]
    },
  ];

  const checkPermission = (item: NavItem): boolean => {
    if (!item.permission) return true;
    return permissions[item.permission];
  };

  return (
    <aside 
      className={cn(
        'fixed left-0 top-0 h-screen bg-slate-950 border-r border-slate-800/50 flex flex-col transition-all duration-300 z-50',
        collapsed ? 'w-[72px]' : 'w-[260px]'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-5 border-b border-slate-800/50',
        collapsed && 'justify-center px-2'
      )}>
        <div className="relative">
          <img 
            src="/vang.png" 
            alt="Vanguard" 
            className="w-10 h-10 object-contain rounded-xl"
            style={{ backgroundColor: '#020617' }}
          />
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-white">
              Vanguard
            </h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">
              Inventory AI
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {navigation.map((section, sectionIndex) => (
          <div key={section.title} className={cn(sectionIndex > 0 && 'mt-6')}>
            {!collapsed && (
              <h3 className="px-3 mb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                {section.title}
              </h3>
            )}
            <div className="space-y-1">
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
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative',
                      isActive 
                        ? 'bg-emerald-500/10 text-emerald-400' 
                        : hasPermission
                          ? 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                          : 'text-slate-600 cursor-not-allowed',
                      collapsed && 'justify-center px-2'
                    )}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />
                    )}
                    
                    <Icon size={20} className={cn(
                      'flex-shrink-0 transition-transform duration-200',
                      isActive && 'scale-110'
                    )} />
                    
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left text-sm font-medium">
                          {item.label}
                        </span>
                        
                        {item.badge && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-md flex items-center gap-1">
                            <Sparkles size={10} />
                            {item.badge}
                          </span>
                        )}
                        
                        {!hasPermission && (
                          <Lock size={14} className="text-slate-600" />
                        )}
                      </>
                    )}

                    {/* Tooltip for collapsed state */}
                    {collapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                        {item.label}
                        {item.badge && (
                          <span className="ml-2 text-purple-400 text-xs">{item.badge}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Language selector & User section */}
      <div className={cn(
        'border-t border-slate-800/50 p-3 space-y-3',
        collapsed && 'px-2'
      )}>
        {/* Notificaciones */}
        <NotificacionesBell collapsed={collapsed} />
        
        {/* Language Selector */}
        <LanguageSelector collapsed={collapsed} />
        
        {/* User */}
        {user && (
          <div className={cn(
            'flex items-center gap-3 p-2 rounded-xl bg-slate-900/50',
            collapsed && 'justify-center p-2'
          )}>
            <div className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold',
              currentRol.bg, currentRol.color
            )}>
              {(user.nombre || user.email || 'U').charAt(0).toUpperCase()}
            </div>
            
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user.nombre || user.email}
                </p>
                <p className={cn('text-xs', currentRol.color)}>
                  {currentRol.label}
                </p>
              </div>
            )}
            
            {!collapsed && (
              <button
                onClick={signOut}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-colors"
                title={t('header.logout') || 'Cerrar sesión'}
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Collapse button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          'absolute -right-3 top-20 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors'
        )}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </aside>
  );
}

// ============================================
// HEADER MINIMALISTA (para usar con sidebar)
// ============================================

interface TopBarProps {
  title?: string;
  children?: React.ReactNode;
}

export function TopBar({ title, children }: TopBarProps) {
  const { t } = useTranslation();
  
  return (
    <header className="h-16 border-b border-slate-800/50 bg-slate-900/30 backdrop-blur-sm flex items-center justify-between px-6">
      <div>
        {title && (
          <h1 className="text-lg font-semibold text-white">{title}</h1>
        )}
      </div>
      <div className="flex items-center gap-4">
        {children}
      </div>
    </header>
  );
}

// ============================================
// LAYOUT WRAPPER
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
    <div className="min-h-screen bg-slate-950">
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={onTabChange}
        permissions={permissions}
      />
      <main className={cn(
        'transition-all duration-300',
        sidebarCollapsed ? 'ml-[72px]' : 'ml-[260px]'
      )}>
        {children}
      </main>
    </div>
  );
}