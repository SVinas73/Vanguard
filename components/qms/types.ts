// ============================================
// TIPOS LOCALES PARA QMS DASHBOARD
// (Re-exports con tipos ajustados para Supabase)
// ============================================

// Inspeccion - con fechas como string (como viene de Supabase)
export interface Inspeccion {
  id: string;
  numero: string;
  tipo: string;
  producto_codigo: string;
  producto_descripcion: string;
  lote_numero?: string;
  proveedor_nombre?: string;
  cantidad_recibida: number;
  cantidad_muestra: number;
  estado: string;
  fecha_inspeccion: string;
  inspector?: string;
  creado_at: string;
}

// No Conformidad
export interface NoConformidad {
  id: string;
  numero: string;
  titulo: string;
  descripcion: string;
  tipo: string;
  severidad: string;
  estado: string;
  producto_codigo?: string;
  responsable?: string;
  fecha_deteccion: string;
  fecha_objetivo?: string;
  costo_estimado?: number;
}

// Acción Correctiva
export interface AccionCorrectiva {
  id: string;
  numero: string;
  titulo: string;
  tipo: string;
  estado: string;
  porcentaje_avance: number;
  responsable?: string;
  fecha_inicio: string;
  fecha_objetivo?: string;
}

// Recall
export interface Recall {
  id: string;
  numero: string;
  clase: string;
  tipo: string;
  producto_codigo: string;
  producto_descripcion: string;
  motivo: string;
  estado: string;
  cantidad_total_afectada: number;
  porcentaje_recuperacion?: number;
  fecha_inicio: string;
}

// Instrumento
export interface Instrumento {
  id: string;
  codigo: string;
  nombre: string;
  tipo?: string;
  ubicacion?: string;
  estado: string;
  proxima_calibracion?: string;
  dias_para_calibracion: number | null;
}

// Métricas del Dashboard
export interface MetricasQMS {
  inspeccionesHoy: number;
  inspeccionesPendientes: number;
  tasaAprobacion: number;
  tasaAprobacionTendencia: number;
  ncrsAbiertas: number;
  ncrsCriticas: number;
  capasAbiertas: number;
  capasVencidas: number;
  recallsActivos: number;
  instrumentosPorCalibrar: number;
  ppmDefectos: number;
  costoNoCalidad: number;
}

// ============================================
// CONFIGURACIONES
// ============================================

export const ESTADO_INSPECCION_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pendiente: { label: 'Pendiente', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  en_proceso: { label: 'En Proceso', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  aprobado: { label: 'Aprobado', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  rechazado: { label: 'Rechazado', color: 'text-red-400', bg: 'bg-red-500/20' },
  aprobado_condicional: { label: 'Aprobado Cond.', color: 'text-orange-400', bg: 'bg-orange-500/20' },
  retenido: { label: 'Retenido', color: 'text-purple-400', bg: 'bg-purple-500/20' },
};

export const SEVERIDAD_NCR_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  critica: { label: 'Crítica', color: 'text-red-500', bg: 'bg-red-500/20' },
  mayor: { label: 'Mayor', color: 'text-orange-400', bg: 'bg-orange-500/20' },
  menor: { label: 'Menor', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  observacion: { label: 'Observación', color: 'text-slate-400', bg: 'bg-slate-500/20' },
};

export const CLASE_RECALL_CONFIG: Record<string, { label: string; color: string; descripcion: string }> = {
  I: { label: 'Clase I', color: 'text-red-500', descripcion: 'Riesgo serio de salud o muerte' },
  II: { label: 'Clase II', color: 'text-orange-400', descripcion: 'Riesgo temporal o reversible' },
  III: { label: 'Clase III', color: 'text-amber-400', descripcion: 'Improbable causa de problemas de salud' },
};