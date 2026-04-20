'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import {
  BarChart3, ShoppingCart, TrendingUp, Landmark, CircleDollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Product } from '@/types';

import ComercialDashboard from './ComercialDashboard';
import ComprasEnterprisePanel from './ComprasEnterprisePanel';
import VentasEnterprisePanel from './VentasEnterprisePanel';
import FinanzasEnterprise from '@/components/finanzas/FinanzasEnterprise';
import CostosEnterprise from '@/components/costos/CostosEnterprise';

export type ComercialSubTab = 'dashboard' | 'compras' | 'ventas' | 'finanzas' | 'costos';

interface ComercialModuleProps {
  products: Product[];
  userEmail: string;
  activeSubTab?: ComercialSubTab;
  onSubTabChange?: (subTab: ComercialSubTab) => void;
}

export default function ComercialModule({
  products,
  userEmail,
  activeSubTab = 'dashboard',
  onSubTabChange,
}: ComercialModuleProps) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth(false);
  const [subTab, setSubTab] = useState<ComercialSubTab>(activeSubTab);

  useEffect(() => {
    setSubTab(activeSubTab);
  }, [activeSubTab]);

  const handleSubTabChange = (tab: ComercialSubTab) => {
    setSubTab(tab);
    onSubTabChange?.(tab);
  };

  const tabs: { id: ComercialSubTab; label: string; icon: React.ElementType; visible: boolean }[] = [
    { id: 'dashboard', label: t('comercial.overview', 'Resumen'), icon: BarChart3, visible: true },
    { id: 'compras', label: t('nav.purchases', 'Compras'), icon: ShoppingCart, visible: true },
    { id: 'ventas', label: t('nav.sales', 'Ventas'), icon: TrendingUp, visible: true },
    { id: 'finanzas', label: t('modules.finance', 'Finanzas'), icon: Landmark, visible: hasPermission('canViewFinanzas') },
    { id: 'costos', label: t('nav.costs', 'Costos'), icon: CircleDollarSign, visible: hasPermission('canViewCosts') },
  ];

  const visibleTabs = tabs.filter(tab => tab.visible);

  return (
    <div className="space-y-6">
      {/* Sub-tab navigation */}
      <div className="flex items-center gap-1 p-1 bg-slate-900/50 rounded-xl border border-slate-800/50 overflow-x-auto">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleSubTabChange(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                isActive
                  ? 'bg-blue-500/15 text-blue-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              )}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      {subTab === 'dashboard' && (
        <ComercialDashboard
          onNavigate={(view) => {
            if (view === 'compras') handleSubTabChange('compras');
            if (view === 'ventas') handleSubTabChange('ventas');
            if (view === 'cotizaciones') handleSubTabChange('ventas');
          }}
        />
      )}

      {subTab === 'compras' && (
        <ComprasEnterprisePanel products={products} userEmail={userEmail} />
      )}

      {subTab === 'ventas' && (
        <VentasEnterprisePanel products={products} userEmail={userEmail} />
      )}

      {subTab === 'finanzas' && (
        <FinanzasEnterprise />
      )}

      {subTab === 'costos' && (
        <CostosEnterprise />
      )}
    </div>
  );
}
