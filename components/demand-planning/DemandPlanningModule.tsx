'use client';

import React, { useState } from 'react';
import {
  TrendingUp, BarChart3, Bell, Package, Settings,
  Activity, Target, Zap, Calendar, RefreshCw
} from 'lucide-react';

// Importar sub-módulos
import ForecastDashboard from './ForecastDashboard';
import ProductForecast from './ProductForecast';
import CriticalAlerts from './CriticalAlerts';
import ReorderSuggestions from './ReorderSuggestions';
import TrendAnalysis from './TrendAnalysis';

// ============================================
// TIPOS
// ============================================

type ModuloDemand = 
  | 'dashboard'
  | 'forecast'
  | 'alertas'
  | 'reposicion'
  | 'tendencias'
  | 'configuracion';

interface MenuItemConfig {
  id: ModuloDemand;
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
    color: 'text-indigo-400',
    descripcion: 'Vista general y KPIs',
    disponible: true,
  },
  {
    id: 'forecast',
    label: 'Forecast',
    icon: TrendingUp,
    color: 'text-emerald-400',
    descripcion: 'Predicción por producto',
    disponible: true,
  },
  {
    id: 'alertas',
    label: 'Alertas',
    icon: Bell,
    color: 'text-red-400',
    descripcion: 'Productos críticos',
    disponible: true,
  },
  {
    id: 'reposicion',
    label: 'Reposición',
    icon: Package,
    color: 'text-amber-400',
    descripcion: 'Sugerencias de compra',
    disponible: true,
  },
  {
    id: 'tendencias',
    label: 'Tendencias',
    icon: Activity,
    color: 'text-purple-400',
    descripcion: 'Análisis histórico',
    disponible: true,
  },
  {
    id: 'configuracion',
    label: 'Configuración',
    icon: Settings,
    color: 'text-slate-400',
    descripcion: 'Parámetros del modelo',
    disponible: false,
  },
];

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function DemandPlanningModule() {
  const [moduloActivo, setModuloActivo] = useState<ModuloDemand>('dashboard');

  const moduloConfig = MENU_ITEMS.find(m => m.id === moduloActivo);

  // Renderizar el módulo activo
  const renderModulo = () => {
    switch (moduloActivo) {
      case 'dashboard':
        return <ForecastDashboard />;
      case 'forecast':
        return <ProductForecast />;
      case 'alertas':
        return <CriticalAlerts />;
      case 'reposicion':
        return <ReorderSuggestions />;
      case 'tendencias':
        return <TrendAnalysis />;
      case 'configuracion':
        return (
          <div className="flex items-center justify-center h-64 text-slate-500">
            <div className="text-center">
              <Settings className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Configuración - Próximamente</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-xl">
            <Zap className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">Demand Planning</h2>
            <p className="text-sm text-slate-400">Predicción y planificación de demanda con IA</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-full">
            <Activity className="h-3 w-3" />
            <span>API Conectada</span>
          </div>
          <span>Modelos: Holt-Winters, XGBoost</span>
        </div>
      </div>

      {/* Navegación */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = moduloActivo === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => item.disponible && setModuloActivo(item.id)}
              disabled={!item.disponible}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-200 whitespace-nowrap
                ${isActive
                  ? `bg-gradient-to-r from-indigo-500/20 to-purple-500/20 ${item.color} border border-indigo-500/30`
                  : item.disponible
                    ? 'bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent'
                    : 'bg-slate-900/30 text-slate-600 cursor-not-allowed border border-transparent'
                }
              `}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Breadcrumb del módulo activo */}
      {moduloConfig && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Demand Planning</span>
          <span className="text-slate-600">/</span>
          <span className={moduloConfig.color}>{moduloConfig.label}</span>
          <span className="text-slate-600">—</span>
          <span className="text-slate-500">{moduloConfig.descripcion}</span>
        </div>
      )}

      {/* Contenido del módulo */}
      <div className="min-h-[400px]">
        {renderModulo()}
      </div>
    </div>
  );
}