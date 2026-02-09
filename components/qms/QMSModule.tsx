'use client';

import React, { useState } from 'react';
import {
  Shield, ClipboardCheck, AlertTriangle, Target, FileCheck,
  AlertOctagon, Thermometer, Search, BarChart3,
  ChevronRight, Activity, Layers
} from 'lucide-react';

// Importar componentes QMS
import QMSDashboard from './QMSDashboard';
import InspeccionRecepcion from './InspeccionRecepcion';
import NoConformidades from './NoConformidades';
import AccionesCorrectivas from './AccionesCorrectivas';
import Certificados from './Certificados';
import RecallManagement from './RecallManagement';

// ============================================
// TIPOS
// ============================================

type ModuloQMS = 
  | 'dashboard' 
  | 'inspeccion-recepcion' 
  | 'control-proceso'
  | 'no-conformidades' 
  | 'acciones-correctivas' 
  | 'certificados'
  | 'recalls'
  | 'instrumentos'
  | 'auditorias';

interface MenuItemConfig {
  id: ModuloQMS;
  label: string;
  icon: React.ElementType;
  color: string;
  descripcion: string;
  disponible: boolean;
}

// ============================================
// CONFIGURACIÓN DEL MENÚ
// ============================================

const MENU_ITEMS: MenuItemConfig[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: BarChart3,
    color: 'text-cyan-400',
    descripcion: 'Vista general y KPIs de calidad',
    disponible: true,
  },
  {
    id: 'inspeccion-recepcion',
    label: 'Inspección Recepción',
    icon: ClipboardCheck,
    color: 'text-emerald-400',
    descripcion: 'Control de calidad en recepción',
    disponible: true,
  },
  {
    id: 'control-proceso',
    label: 'Control en Proceso',
    icon: Activity,
    color: 'text-blue-400',
    descripcion: 'QC durante producción',
    disponible: false,
  },
  {
    id: 'no-conformidades',
    label: 'No Conformidades',
    icon: AlertTriangle,
    color: 'text-orange-400',
    descripcion: 'Gestión de NCRs',
    disponible: true,
  },
  {
    id: 'acciones-correctivas',
    label: 'CAPAs',
    icon: Target,
    color: 'text-purple-400',
    descripcion: 'Acciones correctivas/preventivas',
    disponible: true,
  },
  {
    id: 'certificados',
    label: 'Certificados',
    icon: FileCheck,
    color: 'text-cyan-400',
    descripcion: 'COA, COC, COO',
    disponible: true,
  },
  {
    id: 'recalls',
    label: 'Recalls',
    icon: AlertOctagon,
    color: 'text-red-400',
    descripcion: 'Retiros de producto',
    disponible: true,
  },
  {
    id: 'instrumentos',
    label: 'Instrumentos',
    icon: Thermometer,
    color: 'text-amber-400',
    descripcion: 'Control de calibración',
    disponible: false,
  },
  {
    id: 'auditorias',
    label: 'Auditorías',
    icon: Search,
    color: 'text-indigo-400',
    descripcion: 'Auditorías internas/externas',
    disponible: false,
  },
];

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function QMSModule() {
  const [moduloActivo, setModuloActivo] = useState<ModuloQMS>('dashboard');

  const moduloConfig = MENU_ITEMS.find(m => m.id === moduloActivo);

  // Renderizar el módulo activo
  const renderModulo = () => {
    switch (moduloActivo) {
      case 'dashboard':
        return <QMSDashboard />;
      case 'inspeccion-recepcion':
        return <InspeccionRecepcion />;
      case 'no-conformidades':
        return <NoConformidades />;
      case 'acciones-correctivas':
        return <AccionesCorrectivas />;
      case 'certificados':
        return <Certificados />;
      case 'recalls':
        return <RecallManagement />;
      // Módulos pendientes
      case 'control-proceso':
      case 'instrumentos':
      case 'auditorias':
        return (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Layers className="h-16 w-16 text-slate-600 mb-4" />
            <h3 className="text-xl font-semibold text-slate-300 mb-2">
              Módulo en Desarrollo
            </h3>
            <p className="text-slate-500 max-w-md">
              El módulo de {moduloConfig?.label} está siendo desarrollado y estará disponible próximamente.
            </p>
          </div>
        );
      default:
        return <QMSDashboard />;
    }
  };

  return (
    <div className="flex h-full min-h-[calc(100vh-120px)]">
      {/* Sidebar de navegación QMS */}
      <div className="w-56 bg-slate-900/30 border-r border-slate-800/50 flex flex-col shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-slate-800/50">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-cyan-400" />
            <div>
              <h2 className="font-bold text-slate-100 text-sm">QMS</h2>
              <p className="text-[10px] text-slate-500">Sistema de Calidad</p>
            </div>
          </div>
        </div>

        {/* Menú */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {MENU_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = moduloActivo === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => item.disponible && setModuloActivo(item.id)}
                disabled={!item.disponible}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left ${
                  isActive
                    ? 'bg-slate-800 text-white'
                    : item.disponible
                      ? 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                      : 'text-slate-600 cursor-not-allowed'
                }`}
              >
                <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? item.color : ''}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{item.label}</div>
                  {!item.disponible && (
                    <div className="text-[10px] text-slate-600">Próximamente</div>
                  )}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800/50">
          <div className="text-[10px] text-slate-600">
            <div>ISO 9001:2015</div>
            <div>FDA 21 CFR Part 11</div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 overflow-auto">
        <div className="p-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
            <Shield className="h-3 w-3" />
            <span>QMS</span>
            <ChevronRight className="h-3 w-3" />
            <span className={moduloConfig?.color}>{moduloConfig?.label}</span>
          </div>

          {/* Contenido del módulo */}
          {renderModulo()}
        </div>
      </div>
    </div>
  );
}