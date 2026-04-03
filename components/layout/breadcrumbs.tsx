'use client';
import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { TabType } from '@/types';

const TAB_LABELS: Record<string, { label: string; parent?: string }> = {
  dashboard: { label: 'Dashboard' },
  stock: { label: 'Stock', parent: 'Inventario' },
  movimientos: { label: 'Movimientos', parent: 'Inventario' },
  comercial: { label: 'Comercial', parent: 'Operaciones' },
  compras: { label: 'Compras', parent: 'Operaciones' },
  ventas: { label: 'Ventas', parent: 'Operaciones' },
  finanzas: { label: 'Finanzas', parent: 'Operaciones' },
  proyectos: { label: 'Proyectos', parent: 'Operaciones' },
  taller: { label: 'Taller', parent: 'Operaciones' },
  wms: { label: 'WMS', parent: 'Operaciones' },
  costos: { label: 'Costos', parent: 'Operaciones' },
  analytics: { label: 'Analytics', parent: 'Análisis' },
  demand: { label: 'Demand Planning', parent: 'Análisis' },
  reportes: { label: 'Reportes', parent: 'Análisis' },
  qms: { label: 'QMS', parent: 'Análisis' },
  seriales: { label: 'Seriales', parent: 'Control' },
  trazabilidad: { label: 'Trazabilidad', parent: 'Control' },
  rma: { label: 'RMA', parent: 'Control' },
  bom: { label: 'BOM', parent: 'Control' },
  ensamblajes: { label: 'Ensamblajes', parent: 'Control' },
  integraciones: { label: 'Integraciones', parent: 'Config' },
  auditoria: { label: 'Auditoría', parent: 'Config' },
  chat: { label: 'Chat' },
};

interface BreadcrumbsProps {
  activeTab: TabType;
  onNavigate: (tab: TabType) => void;
}

export function Breadcrumbs({ activeTab, onNavigate }: BreadcrumbsProps) {
  const tabInfo = TAB_LABELS[activeTab] || { label: activeTab };

  return (
    <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-4">
      <button
        onClick={() => onNavigate('dashboard')}
        className="flex items-center gap-1 hover:text-slate-300 transition-colors"
      >
        <Home size={14} />
        <span>Inicio</span>
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
