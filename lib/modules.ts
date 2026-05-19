// ============================================
// MÓDULOS HABILITADOS — modo Lite / Full / Custom
// ============================================
// Permite que una PYME use sólo lo que necesita,
// sin perder los datos del resto. Toggle reversible.

import type { TabType } from '@/types';

export type ModulePreset = 'lite' | 'full' | 'custom';

/**
 * Módulos del preset LITE: lo mínimo viable para una PYME.
 * Cubre control de inventario + facturación + reportes básicos.
 */
export const LITE_MODULES: TabType[] = [
  'dashboard',
  'stock',
  'movimientos',
  'reportes',
  'facturacion',
  'ayuda',
  'configuracion',
];

/**
 * Lista completa de módulos disponibles en el sistema.
 * Espejo de la navegación en components/layout/sidebar.tsx.
 * Si agregás un módulo nuevo al sidebar, agregalo acá también.
 */
export const ALL_MODULES: TabType[] = [
  'dashboard', 'executive', 'stock', 'movimientos', 'chat',
  'comercial', 'replenishment', 'proyectos', 'wms', 'facturacion',
  'clientes_360', 'bom', 'ensamblajes',
  'taller', 'garantias', 'tickets', 'customer_risk', 'rma',
  'rrhh',
  'analytics', 'demand', 'pricing', 'reportes',
  'aprobaciones', 'seriales', 'trazabilidad', 'qms', 'auditoria',
  'integraciones', 'ayuda', 'configuracion',
];

/**
 * Módulos que SIEMPRE deben estar visibles, sin importar el preset.
 * (Si no, el usuario podría dejarse sin manera de configurar nada.)
 */
export const PINNED_MODULES: TabType[] = ['dashboard', 'ayuda', 'configuracion'];

export interface ModuleConfig {
  preset: ModulePreset;
  enabled_modules: TabType[];
  display_currency?: string;
}

export const DEFAULT_CONFIG: ModuleConfig = {
  preset: 'full',
  enabled_modules: ALL_MODULES,
  display_currency: 'UYU',
};

/**
 * Resuelve la lista efectiva de módulos visibles para una organización.
 * Acepta el JSON `config` de la fila de organizaciones (puede venir null/undefined).
 *
 *   - preset 'full' (o sin config) → todos
 *   - preset 'lite'                → LITE_MODULES
 *   - preset 'custom'              → enabled_modules tal como se guardó
 *
 * Siempre garantiza los PINNED_MODULES.
 */
export function resolverModulosHabilitados(
  config: Partial<ModuleConfig> | null | undefined
): TabType[] {
  if (!config || !config.preset || config.preset === 'full') {
    return ALL_MODULES;
  }
  const base = config.preset === 'lite'
    ? LITE_MODULES
    : (config.enabled_modules ?? LITE_MODULES);

  // Garantizar pinneados sin duplicar
  const set = new Set<TabType>(base);
  for (const m of PINNED_MODULES) set.add(m);
  return ALL_MODULES.filter(m => set.has(m));
}

/**
 * Etiquetas legibles para mostrar en la pantalla de configuración.
 */
export const MODULE_LABELS: Record<TabType, string> = {
  dashboard: 'Dashboard',
  executive: 'Vista Ejecutiva',
  stock: 'Stock',
  movimientos: 'Movimientos',
  chat: 'Mensajes',
  comercial: 'Comercial',
  replenishment: 'Reabastecimiento IA',
  proyectos: 'Proyectos',
  wms: 'WMS (depósitos)',
  facturacion: 'Facturación',
  clientes_360: 'Clientes 360°',
  bom: 'BOM (lista de materiales)',
  ensamblajes: 'Ensamblajes',
  taller: 'Taller',
  garantias: 'Garantías',
  tickets: 'Tickets soporte',
  customer_risk: 'Clientes en riesgo',
  rma: 'Devoluciones (RMA)',
  rrhh: 'RRHH',
  analytics: 'Analytics IA',
  demand: 'Demand planning',
  pricing: 'Precios IA',
  reportes: 'Reportes',
  aprobaciones: 'Aprobaciones',
  seriales: 'Seriales',
  trazabilidad: 'Trazabilidad',
  qms: 'Calidad (QMS)',
  auditoria: 'Auditoría',
  integraciones: 'Integraciones',
  ayuda: 'Centro de Ayuda',
  configuracion: 'Configuración',
} as Record<TabType, string>;
