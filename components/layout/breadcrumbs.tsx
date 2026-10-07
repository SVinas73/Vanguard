'use client';
import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TabType } from '@/types';

interface BreadcrumbsProps {
  activeTab: TabType;
}

export function Breadcrumbs({ activeTab }: BreadcrumbsProps) {
  const { t } = useTranslation();

  const TAB_LABELS: Record<string, { label: string; parent?: string }> = {
    stock: { label: t('nav.stock'), parent: t('modules.inventory') },
    movimientos: { label: t('nav.movements'), parent: t('modules.inventory') },
    comercial: { label: t('modules.comercial'), parent: t('modules.operations') },
    taller: { label: t('modules.workshop'), parent: t('modules.operations') },
    trazabilidad: { label: t('modules.traceability'), parent: t('modules.control') },
    rma: { label: t('modules.returns'), parent: t('modules.control') },
    auditoria: { label: t('nav.audit'), parent: t('modules.config') },
  };

  const tabInfo = TAB_LABELS[activeTab] || { label: activeTab };

  return (
    <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-4">
      {tabInfo.parent && (
        <>
          <span className="text-slate-600">{tabInfo.parent}</span>
          <ChevronRight size={14} className="text-slate-600" />
        </>
      )}
      <span className="text-slate-300 font-medium">{tabInfo.label}</span>
    </div>
  );
}
