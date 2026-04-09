/**
 * Predictive Maintenance (PdM) API Service
 *
 * Communicates with the Python AI backend for predictions,
 * and with Supabase for PdM data CRUD.
 *
 * Non-invasive: does NOT touch existing taller/inventario tables.
 */

import { supabase } from './supabase';

const AI_URL = process.env.NEXT_PUBLIC_AI_API_URL || 'http://localhost:8000';

// ============================================
// TYPES
// ============================================

export interface PdmEquipo {
  id: string;
  tipo_equipo: string;
  marca: string | null;
  modelo: string | null;
  serie: string | null;
  matricula: string | null;
  cliente_id: string | null;
  cliente_nombre: string | null;
  horas_uso_acumuladas: number;
  km_acumulados: number;
  fecha_puesta_servicio: string | null;
  fecha_ultimo_service: string | null;
  mtbf_horas: number | null;
  mtbf_dias: number | null;
  total_fallas_historicas: number;
  indice_criticidad: 'bajo' | 'medio' | 'alto' | 'critico';
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface PdmPrediccion {
  id: string;
  equipo_id: string;
  probabilidad_fallo: number;
  ttf_dias: number | null;
  ttf_horas: number | null;
  nivel_riesgo: 'verde' | 'amarillo' | 'rojo';
  confianza_modelo: number | null;
  modelo_usado: string | null;
  version_modelo: string | null;
  accion_recomendada: string | null;
  repuestos_sugeridos: RepuestoSugerido[];
  proxima_fecha_service: string | null;
  fecha_prediccion: string;
  activa: boolean;
}

export interface RepuestoSugerido {
  producto_id: string;
  nombre: string;
  cantidad_sugerida: number;
  motivo: string;
}

export interface PdmEvento {
  id: string;
  equipo_id: string;
  orden_taller_id: string | null;
  tipo_evento: 'preventivo' | 'correctivo' | 'predictivo' | 'inspeccion';
  categoria_falla: string | null;
  severidad: 'baja' | 'media' | 'alta' | 'critica';
  horas_uso_al_evento: number | null;
  km_al_evento: number | null;
  dias_desde_ultimo_service: number | null;
  descripcion_falla: string | null;
  diagnostico: string | null;
  trabajo_realizado: string | null;
  repuestos_json: any[];
  costo_total_repuestos: number;
  costo_mano_obra: number;
  fecha_evento: string;
  fecha_inicio_reparacion: string | null;
  fecha_fin_reparacion: string | null;
  duracion_reparacion_horas: number | null;
  tecnico: string | null;
  created_at: string;
}

export interface PdmAlerta {
  id: string;
  equipo_id: string;
  prediccion_id: string | null;
  tipo_alerta: 'fallo_inminente' | 'service_programado' | 'desgaste_acelerado' | 'anomalia';
  nivel: 'info' | 'warning' | 'critical';
  titulo: string;
  mensaje: string;
  leida: boolean;
  resuelta: boolean;
  created_at: string;
}

export interface PdmLectura {
  id?: string;
  equipo_id: string;
  tipo_medidor: 'horometro' | 'odometro' | 'temperatura' | 'vibracion' | 'presion';
  valor: number;
  unidad: string;
  fecha_lectura?: string;
  registrado_por?: string;
}

export interface PdmPlan {
  id: string;
  equipo_id: string;
  tipo: 'preventivo' | 'predictivo';
  descripcion: string;
  frecuencia_dias: number | null;
  frecuencia_horas: number | null;
  proxima_ejecucion: string | null;
  repuestos_planificados: any[];
  costo_estimado: number | null;
  activo: boolean;
  ultima_ejecucion: string | null;
}

export interface DashboardEquipo {
  equipo_id: string;
  tipo_equipo: string;
  marca: string | null;
  modelo: string | null;
  serie: string | null;
  matricula: string | null;
  cliente_nombre: string | null;
  horas_uso_acumuladas: number;
  km_acumulados: number;
  fecha_ultimo_service: string | null;
  mtbf_dias: number | null;
  total_fallas_historicas: number;
  indice_criticidad: string;
  probabilidad_fallo: number | null;
  ttf_dias: number | null;
  ttf_horas: number | null;
  nivel_riesgo: 'verde' | 'amarillo' | 'rojo' | null;
  confianza_modelo: number | null;
  accion_recomendada: string | null;
  repuestos_sugeridos: RepuestoSugerido[];
  proxima_fecha_service: string | null;
  fecha_prediccion: string | null;
  alertas_pendientes: number;
}

// ============================================
// SUPABASE CRUD
// ============================================

export const pdmApi = {

  // --- Dashboard ---
  async getDashboard(): Promise<DashboardEquipo[]> {
    const { data, error } = await supabase
      .from('pdm_dashboard_equipos')
      .select('*')
      .order('orden_urgencia', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  // --- Equipos ---
  async getEquipos(): Promise<PdmEquipo[]> {
    const { data, error } = await supabase
      .from('pdm_equipos')
      .select('*')
      .eq('activo', true)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getEquipo(id: string): Promise<PdmEquipo | null> {
    const { data, error } = await supabase
      .from('pdm_equipos')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async updateEquipo(id: string, updates: Partial<PdmEquipo>): Promise<void> {
    const { error } = await supabase
      .from('pdm_equipos')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  // --- Sync from Taller ---
  async syncFromTaller(): Promise<number> {
    const { data, error } = await supabase.rpc('pdm_sync_equipos_from_taller');
    if (error) throw error;
    return data || 0;
  },

  // --- Eventos ---
  async getEventos(equipoId: string): Promise<PdmEvento[]> {
    const { data, error } = await supabase
      .from('pdm_eventos_mantenimiento')
      .select('*')
      .eq('equipo_id', equipoId)
      .order('fecha_evento', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createEvento(evento: Omit<PdmEvento, 'id' | 'created_at'>): Promise<PdmEvento> {
    const { data, error } = await supabase
      .from('pdm_eventos_mantenimiento')
      .insert(evento)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // --- Lecturas ---
  async getLecturas(equipoId: string, limit = 50): Promise<PdmLectura[]> {
    const { data, error } = await supabase
      .from('pdm_lecturas_medidores')
      .select('*')
      .eq('equipo_id', equipoId)
      .order('fecha_lectura', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async createLectura(lectura: PdmLectura): Promise<void> {
    const { error } = await supabase
      .from('pdm_lecturas_medidores')
      .insert(lectura);
    if (error) throw error;

    // Also update equipment accumulated hours/km
    if (lectura.tipo_medidor === 'horometro') {
      await supabase
        .from('pdm_equipos')
        .update({ horas_uso_acumuladas: lectura.valor, updated_at: new Date().toISOString() })
        .eq('id', lectura.equipo_id);
    } else if (lectura.tipo_medidor === 'odometro') {
      await supabase
        .from('pdm_equipos')
        .update({ km_acumulados: lectura.valor, updated_at: new Date().toISOString() })
        .eq('id', lectura.equipo_id);
    }
  },

  // --- Predicciones ---
  async getPrediccion(equipoId: string): Promise<PdmPrediccion | null> {
    const { data, error } = await supabase
      .from('pdm_predicciones')
      .select('*')
      .eq('equipo_id', equipoId)
      .eq('activa', true)
      .order('fecha_prediccion', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getHistorialPredicciones(equipoId: string): Promise<PdmPrediccion[]> {
    const { data, error } = await supabase
      .from('pdm_predicciones')
      .select('*')
      .eq('equipo_id', equipoId)
      .order('fecha_prediccion', { ascending: false })
      .limit(20);
    if (error) throw error;
    return data || [];
  },

  // --- Alertas ---
  async getAlertas(soloNoLeidas = false): Promise<PdmAlerta[]> {
    let query = supabase
      .from('pdm_alertas')
      .select('*')
      .eq('resuelta', false)
      .order('created_at', { ascending: false });
    if (soloNoLeidas) query = query.eq('leida', false);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getAlertasEquipo(equipoId: string): Promise<PdmAlerta[]> {
    const { data, error } = await supabase
      .from('pdm_alertas')
      .select('*')
      .eq('equipo_id', equipoId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return data || [];
  },

  async marcarAlertaLeida(id: string): Promise<void> {
    const { error } = await supabase
      .from('pdm_alertas')
      .update({ leida: true })
      .eq('id', id);
    if (error) throw error;
  },

  async resolverAlerta(id: string, accion: string, usuario: string): Promise<void> {
    const { error } = await supabase
      .from('pdm_alertas')
      .update({
        resuelta: true,
        accion_tomada: accion,
        resuelta_por: usuario,
        fecha_resolucion: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;
  },

  // --- Planes ---
  async getPlanes(equipoId?: string): Promise<PdmPlan[]> {
    let query = supabase
      .from('pdm_planes_mantenimiento')
      .select('*')
      .eq('activo', true)
      .order('proxima_ejecucion', { ascending: true });
    if (equipoId) query = query.eq('equipo_id', equipoId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async createPlan(plan: Omit<PdmPlan, 'id' | 'created_at' | 'updated_at'>): Promise<PdmPlan> {
    const { data, error } = await supabase
      .from('pdm_planes_mantenimiento')
      .insert(plan)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ============================================
  // AI BACKEND CALLS
  // ============================================

  /** Request prediction for a specific equipment */
  async requestPrediction(equipoId: string): Promise<PdmPrediccion> {
    const response = await fetch(`${AI_URL}/api/pdm/predict/${equipoId}`, {
      method: 'POST',
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`PdM prediction failed: ${err}`);
    }
    return response.json();
  },

  /** Batch predict all active equipment */
  async requestBatchPredictions(): Promise<{ processed: number; errors: number }> {
    const response = await fetch(`${AI_URL}/api/pdm/predict-all`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Batch prediction failed');
    return response.json();
  },

  /** Get model training status */
  async getModelStatus(): Promise<{
    trained: boolean;
    last_trained: string | null;
    samples: number;
    accuracy: number | null;
    model_type: string;
  }> {
    const response = await fetch(`${AI_URL}/api/pdm/model/status`);
    if (!response.ok) throw new Error('Model status check failed');
    return response.json();
  },

  /** Trigger model retraining */
  async retrainModel(): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${AI_URL}/api/pdm/model/retrain`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Model retrain failed');
    return response.json();
  },

  /** Health check for PdM AI service */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${AI_URL}/api/pdm/health`);
      return response.ok;
    } catch {
      return false;
    }
  },

  // ============================================
  // METRICS & ANALYTICS
  // ============================================

  async getMetricasGlobales(): Promise<{
    totalEquipos: number;
    equiposRiesgoAlto: number;
    equiposRiesgoMedio: number;
    equiposRiesgoBajo: number;
    alertasPendientes: number;
    mtbfPromedio: number | null;
    proximosServices: number;
  }> {
    const dashboard = await this.getDashboard();
    const alertas = await this.getAlertas();

    const rojo = dashboard.filter(d => d.nivel_riesgo === 'rojo').length;
    const amarillo = dashboard.filter(d => d.nivel_riesgo === 'amarillo').length;
    const verde = dashboard.filter(d => d.nivel_riesgo === 'verde' || d.nivel_riesgo === null).length;

    const mtbfs = dashboard
      .filter(d => d.mtbf_dias !== null)
      .map(d => d.mtbf_dias!);
    const mtbfPromedio = mtbfs.length > 0
      ? mtbfs.reduce((a, b) => a + b, 0) / mtbfs.length
      : null;

    const hoy = new Date();
    const en30Dias = new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000);
    const proximosServices = dashboard.filter(d =>
      d.proxima_fecha_service && new Date(d.proxima_fecha_service) <= en30Dias
    ).length;

    return {
      totalEquipos: dashboard.length,
      equiposRiesgoAlto: rojo,
      equiposRiesgoMedio: amarillo,
      equiposRiesgoBajo: verde,
      alertasPendientes: alertas.length,
      mtbfPromedio,
      proximosServices,
    };
  },
};
