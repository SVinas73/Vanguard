'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import {
  BarChart3, ShoppingCart, TrendingUp, Landmark, CircleDollarSign,
  Brain, Tag, Award, Star, ClipboardList, FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Product } from '@/types';
import { useInventoryStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { DashboardView } from '@/components/dashboard';

import ComercialDashboard from './ComercialDashboard';
import ComprasEnterprisePanel from './ComprasEnterprisePanel';
import VentasEnterprisePanel from './VentasEnterprisePanel';
import ComercialAnalytics from './ComercialAnalytics';
import CondicionesComerciales from './CondicionesComerciales';
import ComisionesVendedores from './ComisionesVendedores';
import ScoringComercial from './ScoringComercial';
import FinanzasEnterprise from '@/components/finanzas/FinanzasEnterprise';
import CostosEnterprise from '@/components/costos/CostosEnterprise';
import SolicitudesInsumosPanel from '@/components/insumos/SolicitudesInsumosPanel';
import InsumosPendientes from '@/components/insumos/InsumosPendientes';
import OrdenInternaInsumos from '@/components/insumos/OrdenInternaInsumos';
import FacturasElectronicas from '@/components/facturacion/FacturasElectronicas';

export type ComercialSubTab = 'dashboard' | 'compras' | 'ventas' | 'facturacion' | 'finanzas' | 'costos' | 'analytics' | 'condiciones' | 'comisiones' | 'scoring' | 'insumos';

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

  // Sub-subtabs internos del panel "Solicitudes de insumos":
  // - 'solicitud' → SolicitudesInsumosPanel (lo actual)
  // - 'analisis'  → DashboardView (réplica del Dashboard) filtrado a insumos
  const [insumosSubTab, setInsumosSubTab] = useState<'solicitud' | 'orden_interna' | 'pendientes' | 'analisis'>('solicitud');
  const [insumosPeriod, setInsumosPeriod] = useState('30d');

  // Datos del store para el "Análisis de insumos"
  const { products: allProducts, movements: allMovements, predictions, fetchProducts, fetchMovements } = useInventoryStore();

  // Lista de almacenes para identificar cuáles son de insumos (nombre contiene "insumo")
  const [almacenes, setAlmacenes] = useState<Array<{ id: string; nombre: string }>>([]);
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('almacenes')
      .select('id, nombre')
      .then(({ data }) => {
        if (!cancelled && data) setAlmacenes(data);
      });
    return () => { cancelled = true; };
  }, []);

  const insumosAlmacenIds = useMemo(
    () => new Set(
      almacenes
        .filter(a => (a.nombre || '').toLowerCase().includes('insumo'))
        .map(a => a.id)
    ),
    [almacenes]
  );

  // Productos / movimientos filtrados al/los almacén(es) de insumos
  const insumosProducts = useMemo(
    () => allProducts.filter(p => p.almacenId != null && insumosAlmacenIds.has(p.almacenId)),
    [allProducts, insumosAlmacenIds]
  );
  const insumosMovements = useMemo(() => {
    const codes = new Set(insumosProducts.map(p => p.codigo));
    return allMovements.filter(m => codes.has(m.codigo));
  }, [allMovements, insumosProducts]);

  // Compras y Ventas trabajan SOLO con el depósito de ventas, NUNCA con
  // insumos. Filtramos la lista de productos excluyendo los almacenes de
  // insumos (los insumos no se compran/venden por estos submódulos).
  const productsVenta = useMemo(
    () => products.filter(p => !p.almacenId || !insumosAlmacenIds.has(p.almacenId)),
    [products, insumosAlmacenIds]
  );

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
    { id: 'facturacion', label: 'Facturación electrónica', icon: FileText, visible: true },
    { id: 'insumos', label: 'Solicitudes de insumos', icon: ClipboardList, visible: true },
    { id: 'finanzas', label: t('modules.finance', 'Finanzas'), icon: Landmark, visible: hasPermission('canViewFinanzas') },
    { id: 'costos', label: t('nav.costs', 'Costos'), icon: CircleDollarSign, visible: hasPermission('canViewCosts') },
    { id: 'analytics', label: 'Inteligencia', icon: Brain, visible: true },
    { id: 'condiciones', label: 'Condiciones', icon: Tag, visible: true },
    { id: 'comisiones', label: 'Comisiones', icon: Award, visible: true },
    { id: 'scoring', label: 'Scoring', icon: Star, visible: true },
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
        <ComprasEnterprisePanel products={productsVenta} userEmail={userEmail} />
      )}

      {subTab === 'ventas' && (
        <VentasEnterprisePanel products={productsVenta} userEmail={userEmail} />
      )}

      {subTab === 'finanzas' && (
        <FinanzasEnterprise />
      )}

      {subTab === 'costos' && (
        <CostosEnterprise />
      )}

      {subTab === 'analytics' && (
        <ComercialAnalytics />
      )}

      {subTab === 'condiciones' && (
        <CondicionesComerciales />
      )}

      {subTab === 'comisiones' && (
        <ComisionesVendedores />
      )}

      {subTab === 'scoring' && (
        <ScoringComercial />
      )}

      {subTab === 'insumos' && (
        <div className="space-y-5">
          {/* Sub-subtabs internos (pestañas secundarias tipo pill) */}
          <div className="flex items-center gap-1">
            {([
              { id: 'solicitud' as const, label: 'Solicitud de insumos' },
              { id: 'orden_interna' as const, label: 'Orden Interna' },
              { id: 'pendientes' as const, label: 'Pendientes de aprobación' },
              { id: 'analisis' as const, label: 'Análisis de insumos' },
            ]).map((s) => {
              const isActive = insumosSubTab === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setInsumosSubTab(s.id)}
                  className={cn(
                    'px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap',
                    isActive
                      ? 'bg-blue-500/15 text-blue-400 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  )}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          {insumosSubTab === 'solicitud' && <SolicitudesInsumosPanel />}

          {insumosSubTab === 'orden_interna' && <OrdenInternaInsumos />}

          {insumosSubTab === 'pendientes' && <InsumosPendientes />}

          {insumosSubTab === 'analisis' && (
            <DashboardView
              products={insumosProducts}
              movements={insumosMovements}
              predictions={predictions}
              userName={userEmail?.split('@')[0]}
              period={insumosPeriod}
              onPeriodChange={setInsumosPeriod}
              onNavigate={() => setInsumosSubTab('solicitud')}
              onRefresh={() => { fetchProducts(); fetchMovements(); }}
              flowSource="movements"
            />
          )}
        </div>
      )}

      {subTab === 'facturacion' && (
        <FacturasElectronicas />
      )}
    </div>
  );
}
