// ============================================
// QMS - Quality Management System
// Módulo de Gestión de Calidad ISO 9001 / FDA
// ============================================

// Módulo completo (con navegación interna)
export { default as QMSModule } from './QMSModule';

// Dashboard principal
export { default as QMSDashboard } from './QMSDashboard';

// Módulos implementados
export { default as InspeccionRecepcion } from './InspeccionRecepcion';
export { default as NoConformidades } from './NoConformidades';
export { default as AccionesCorrectivas } from './AccionesCorrectivas';
export { default as Certificados } from './Certificados';
export { default as RecallManagement } from './RecallManagement';
export { default as Instrumentos } from './Instrumentos';
export { default as Auditorias } from './Auditorias';
export { default as ControlProceso } from './ControlProceso';

// Types locales del módulo QMS
export * from './types';