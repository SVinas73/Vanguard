// Componentes principales
export { ProyectosDashboard } from './ProyectosDashboard';
export { KanbanBoard } from './KanbanBoard';
export { TareaModal } from './TareaModal';
export { ProyectoModal } from './ProyectoModal';
export { ProyectoMiembrosModal } from './ProyectoMiembrosModal';
export { NotificacionesBell } from './NotificacionesBell';

// Vistas alternativas
export { TareasListView } from './TareasListView';
export { TareasCalendarView, MiniCalendar } from './TareasCalendarView';

// Métricas y estadísticas
export { ProyectoStats } from './ProyectoStats';
export { ProyectoCharts } from './ProyectoCharts';

// Actividad
export { ActividadFeed, ActividadReciente } from './ActividadFeed';

// Plantillas
export { PlantillasProyecto, CrearDesdeTemplateModal } from './PlantillasProyecto';

// Time Tracking
export { TiempoTrabajadoTab } from './TiempoTrabajadoTab';

// Hooks y utilidades
export { 
  useKeyboardShortcuts, 
  useProyectoShortcuts, 
  KeyboardShortcutsHelp,
  formatShortcutKey 
} from './useKeyboardShortcuts';