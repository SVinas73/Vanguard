'use client';
import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TabType } from '@/types';

interface BreadcrumbsProps {
  activeTab: TabType;
  onNavigate: (tab: TabType) => void;
}

export function Breadcrumbs({ activeTab, onNavigate }: BreadcrumbsProps) {
  const { t } = useTranslation();

  const TAB_LABELS: Record<string, { label: string; parent?: string }> = {
    dashboard: { label: t('nav.dashboard') },
    stock: { label: t('nav.stock'), parent: t('modules.inventory') },
    movimientos: { label: t('nav.movements'), parent: t('modules.inventory') },
    comercial: { label: t('modules.comercial'), parent: t('modules.operations') },
    compras: { label: t('nav.purchases'), parent: t('modules.operations') },
    ventas: { label: t('nav.sales'), parent: t('modules.operations') },
    finanzas: { label: t('modules.finance'), parent: t('modules.operations') },
    proyectos: { label: t('modules.projects'), parent: t('modules.operations') },
    taller: { label: t('modules.workshop'), parent: t('modules.operations') },
    wms: { label: t('modules.wms'), parent: t('modules.operations') },
    costos: { label: t('nav.costs'), parent: t('modules.operations') },
    analytics: { label: t('nav.analytics'), parent: t('modules.analysis') },
    demand: { label: t('modules.demandPlanning'), parent: t('modules.analysis') },
    reportes: { label: t('nav.reports'), parent: t('modules.analysis') },
    qms: { label: t('modules.quality'), parent: t('modules.analysis') },
    seriales: { label: t('modules.serials'), parent: t('modules.control') },
    trazabilidad: { label: t('modules.traceability'), parent: t('modules.control') },
    rma: { label: t('modules.returns'), parent: t('modules.control') },
    bom: { label: t('modules.bom'), parent: t('modules.control') },
    ensamblajes: { label: t('modules.assemblies'), parent: t('modules.control') },
    integraciones: { label: t('nav.integrations'), parent: t('modules.config') },
    auditoria: { label: t('nav.audit'), parent: t('modules.config') },
    chat: { label: t('modules.chat') },
  };

  const tabInfo = TAB_LABELS[activeTab] || { label: activeTab };

  return (
    <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-4">
      <button
        onClick={() => onNavigate('dashboard')}
        className="flex items-center gap-1 hover:text-slate-300 transition-colors"
      >
        <Home size={14} />
        <span>{t('modules.home')}</span>
      </button>
      {tabInfo.parent && (
        <>
          <ChevronRight size={14} className="text-slate-600" />
          <span className="text-slate-600">{tabInfo.parent}</span>
        </>
      )}
      {activeTab !== 'dashboard' && (
        <>
          <ChevronRight size={14} className="text-slate-600" />
          <span className="text-slate-300 font-medium">{tabInfo.label}</span>
        </>
      )}
    </div>
  );
}
