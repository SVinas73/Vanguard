'use client';

import React, { useState } from 'react';
import {
  Warehouse, MapPin, Truck, Target, ArrowRight,
  Package, BarChart3, Layers, Settings,
  ChevronRight, RefreshCw, ClipboardCheck
} from 'lucide-react';

// Importar componentes WMS
import WMSDashboard from './WMSDashboard';
import Ubicaciones from './Ubicaciones';
import Recepcion from './Recepcion';
import Picking from './Picking';
// Los demás se importarán cuando se creen:
// import Inventario from './Inventario';
// import Movimientos from './Movimientos';
// import Slotting from './Slotting';

// ============================================
// TIPOS
// ============================================

type ModuloWMS = 
  | 'dashboard' 
  | 'ubicaciones' 
  | 'recepcion'
  | 'picking' 
  | 'inventario' 
  | 'movimientos'
  | 'slotting'
  | 'configuracion';

interface MenuItemConfig {
  id: ModuloWMS;
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
    color: 'text-blue-400',
    descripcion: 'Vista general y KPIs',
    disponible: true,
  },
  {
    id: 'ubicaciones',
    label: 'Ubicaciones',
    icon: MapPin,
    color: 'text-emerald-400',
    descripcion: 'Pasillo-Rack-Nivel-Pos',
    disponible: true,
  },
  {
    id: 'recepcion',
    label: 'Recepción',
    icon: Truck,
    color: 'text-amber-400',
    descripcion: 'Put-away automático',
    disponible: true,
  },
  {
    id: 'picking',
    label: 'Picking',
    icon: Target,
    color: 'text-purple-400',
    descripcion: 'Wave picking y rutas',
    disponible: true,
  },
  {
    id: 'inventario',
    label: 'Inventario',
    icon: Package,
    color: 'text-cyan-400',
    descripcion: 'Stock por ubicación',
    disponible: false,
  },
  {
    id: 'movimientos',
    label: 'Movimientos',
    icon: ArrowRight,
    color: 'text-orange-400',
    descripcion: 'Transferencias internas',
    disponible: false,
  },
  {
    id: 'slotting',
    label: 'Slotting',
    icon: Layers,
    color: 'text-pink-400',
    descripcion: 'Optimización ABC',
    disponible: false,
  },
  {
    id: 'configuracion',
    label: 'Configuración',
    icon: Settings,
    color: 'text-slate-400',
    descripcion: 'Almacenes y zonas',
    disponible: false,
  },
];

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function WMSModule() {
  const [moduloActivo, setModuloActivo] = useState<ModuloWMS>('dashboard');

  const moduloConfig = MENU_ITEMS.find(m => m.id === moduloActivo);

  // Renderizar el módulo activo
  const renderModulo = () => {
    switch (moduloActivo) {
      case 'dashboard':
        return <WMSDashboard />;
      case 'ubicaciones':
        return <Ubicaciones />;
      case 'recepcion':
        return <Recepcion />;
      case 'picking':
        return <Picking />;
      // Módulos pendientes
      case 'inventario':
      case 'movimientos':
      case 'slotting':
      case 'configuracion':
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
        return <WMSDashboard />;
    }
  };

  return (
    <div className="flex h-full min-h-[calc(100vh-120px)]">
      {/* Sidebar de navegación WMS */}
      <div className="w-56 bg-slate-900/30 border-r border-slate-800/50 flex flex-col shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-slate-800/50">
          <div className="flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-blue-400" />
            <div>
              <h2 className="font-bold text-slate-100 text-sm">WMS</h2>
              <p className="text-[10px] text-slate-500">Gestión de Almacén</p>
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
            <div>WMS Avanzado</div>
            <div>Picking Optimizado con IA</div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 overflow-auto">
        <div className="p-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
            <Warehouse className="h-3 w-3" />
            <span>WMS</span>
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