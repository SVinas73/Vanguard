'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { TabType } from '@/types';
import { cn } from '@/lib/utils';
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
  Warehouse,
  ChevronDown,
  Lock,
  LucideIcon
} from 'lucide-react';

interface TabPermissions {
  canViewCosts: boolean;
  canViewAudit: boolean;
  canViewReports: boolean;
}

interface NavTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  permissions: TabPermissions;
}

interface MenuTab {
  id: TabType;
  label: string;
  icon: LucideIcon;
  desc: string;
  permission?: keyof TabPermissions;
}

interface MenuGroup {
  label: string;
  icon: LucideIcon;
  tabs: MenuTab[];
}

export function NavTabs({ activeTab, onTabChange, permissions }: NavTabsProps) {
  const { t } = useTranslation();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isTabActive = (tabId: TabType) => activeTab === tabId;

  const mainTabs: Array<{ id: TabType; label: string; icon: LucideIcon }> = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { id: 'stock', label: t('nav.stock'), icon: Package },
    { id: 'movimientos', label: t('nav.movements'), icon: ArrowLeftRight },
  ];

  const menuGroups: Record<string, MenuGroup> = {
    operaciones: {
      label: t('nav.operations'),
      icon: ShoppingCart,
      tabs: [
        { id: 'compras', label: t('nav.purchases'), icon: ShoppingCart, desc: '' },
        { id: 'ventas', label: t('nav.sales'), icon: TrendingUp, desc: '' },
        { id: 'almacenes', label: t('nav.warehouses'), icon: Warehouse, desc: '' },
      ]
    },
    analisis: {
      label: t('nav.analysis'),
      icon: Brain,
      tabs: [
        { id: 'analytics', label: t('nav.analytics'), icon: Brain, desc: '' },
        { id: 'reportes', label: t('nav.reports'), icon: FileText, desc: '', permission: 'canViewReports' },
        { id: 'costos', label: t('nav.costs'), icon: DollarSign, desc: '', permission: 'canViewCosts' },
      ]
    },
    config: {
      label: t('nav.config'),
      icon: Plug,
      tabs: [
        { id: 'integraciones', label: t('nav.integrations'), icon: Plug, desc: '' },
        { id: 'auditoria', label: t('nav.audit'), icon: Shield, desc: '', permission: 'canViewAudit' },
      ]
    }
  };

  const isGroupActive = (groupKey: string) => {
    const group = menuGroups[groupKey];
    return group.tabs.some(t => t.id === activeTab);
  };

  const handleTabClick = (tabId: TabType) => {
    onTabChange(tabId);
    setOpenMenu(null);
  };

  const toggleMenu = (menuId: string) => {
    setOpenMenu(openMenu === menuId ? null : menuId);
  };

  const checkPermission = (tab: MenuTab): boolean => {
    if (!tab.permission) return true;
    return permissions[tab.permission];
  };

  return (
    <div className="mb-6" ref={menuRef}>
      <nav className="flex items-center gap-1 p-1.5 bg-slate-900/50 rounded-xl border border-slate-800/50">
        {/* Tabs principales */}
        {mainTabs.map((tab) => {
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium',
                isTabActive(tab.id)
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              )}
            >
              <IconComponent size={18} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}

        {/* Separador */}
        <div className="w-px h-6 bg-slate-700 mx-1" />

        {/* Dropdowns */}
        {Object.entries(menuGroups).map(([key, group]) => {
          const GroupIcon = group.icon;
          return (
            <div key={key} className="relative">
              <button
                onClick={() => toggleMenu(key)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium',
                  isGroupActive(key)
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                )}
              >
                <GroupIcon size={18} />
                <span className="hidden sm:inline">{group.label}</span>
                <ChevronDown 
                  size={14} 
                  className={cn(
                    'transition-transform duration-200',
                    openMenu === key && 'rotate-180'
                  )} 
                />
              </button>

              {/* Dropdown */}
              {openMenu === key && (
                <div className="absolute top-full left-0 mt-2 py-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 min-w-[220px]">
                  {group.tabs.map((tab) => {
                    const hasPermission = checkPermission(tab);
                    const TabIcon = tab.icon;
                    
                    return (
                      <button
                        key={tab.id}
                        onClick={() => hasPermission && handleTabClick(tab.id)}
                        disabled={!hasPermission}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 transition-all text-left',
                          !hasPermission && 'opacity-50 cursor-not-allowed',
                          isTabActive(tab.id)
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : hasPermission 
                              ? 'text-slate-300 hover:bg-slate-800'
                              : 'text-slate-500'
                        )}
                      >
                        <TabIcon size={18} />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{tab.label}</div>
                          <div className="text-xs text-slate-500">{tab.desc}</div>
                        </div>
                        {!hasPermission && <Lock size={14} className="text-slate-600" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}