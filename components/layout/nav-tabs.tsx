'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { TabType } from '@/types';
import { Lock } from 'lucide-react';

interface TabPermissions {
  canViewCosts: boolean;
  canViewAudit: boolean;
  canViewReports: boolean;
}

interface NavTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  permissions?: TabPermissions;
}

const tabs: Array<{ 
  id: TabType; 
  label: string; 
  icon: string;
  requiredPermission?: keyof TabPermissions;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: '◈' },
  { id: 'productos', label: 'Productos', icon: '▤' },
  { id: 'movimientos', label: 'Movimientos', icon: '↹' },
  { id: 'analytics', label: 'Analytics IA', icon: '◎' },
  { id: 'compras', label: 'Compras', icon: '🛒' },
  { id: 'ventas', label: 'Ventas', icon: '↹' },
  { id: 'reportes', label: 'Reportes', icon: '▦', requiredPermission: 'canViewReports' },
  { id: 'costos', label: 'Costos', icon: '◆', requiredPermission: 'canViewCosts' },
  { id: 'integraciones', label: 'Integraciones', icon: '⚡' },
  { id: 'almacenes', label: 'Almacenes', icon: '⊞' },
  { id: 'auditoria', label: 'Auditoría', icon: '◉', requiredPermission: 'canViewAudit' }
];

export function NavTabs({ activeTab, onTabChange, permissions }: NavTabsProps) {
  const hasAccess = (tab: typeof tabs[0]): boolean => {
    if (!tab.requiredPermission) return true;
    if (!permissions) return true; // Si no se pasan permisos, mostrar todo
    return permissions[tab.requiredPermission];
  };

  return (
    <nav className="flex gap-1 mb-6 p-1 bg-slate-900/50 rounded-xl w-fit">
      {tabs.map((tab) => {
        const canAccess = hasAccess(tab);
        
        return (
          <button
            key={tab.id}
            onClick={() => canAccess && onTabChange(tab.id)}
            disabled={!canAccess}
            title={!canAccess ? 'No tenés permiso para acceder a esta sección' : undefined}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
              activeTab === tab.id && canAccess
                ? 'bg-slate-800 text-emerald-400 shadow-lg shadow-emerald-500/10'
                : canAccess
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 cursor-not-allowed opacity-50'
            )}
          >
            <span>{tab.icon}</span>
            {tab.label}
            {!canAccess && <Lock size={12} className="text-slate-600" />}
          </button>
        );
      })}
    </nav>
  );
}