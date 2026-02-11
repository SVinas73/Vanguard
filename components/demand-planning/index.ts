// ============================================
// DEMAND PLANNING MODULE - EXPORTS
// ============================================

// Componente principal
export { default as DemandPlanningModule } from './DemandPlanningModule';

// Sub-módulos
export { default as ForecastDashboard } from './ForecastDashboard';
export { default as ProductForecast } from './ProductForecast';
export { default as CriticalAlerts } from './CriticalAlerts';
export { default as ReorderSuggestions } from './ReorderSuggestions';
export { default as TrendAnalysis } from './TrendAnalysis';

// Tipos
export * from './types';