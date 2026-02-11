// ============================================
// TIPOS - DEMAND PLANNING MODULE
// ============================================

// ============================================
// FORECAST
// ============================================

export type ModeloPrediccion = 'Holt-Winters' | 'XGBoost' | 'Prophet' | 'LSTM' | 'promedio_simple' | 'local_fallback';
export type NivelConfianza = 'alta' | 'media' | 'baja';
export type TendenciaDemanda = 'creciendo' | 'estable' | 'decreciendo' | 'estacional' | 'erratica';
export type UrgenciaReposicion = 'critica' | 'alta' | 'media' | 'baja' | 'ninguna';

export interface ForecastProducto {
  producto_codigo: string;
  producto_nombre: string;
  categoria?: string;
  
  // Stock actual
  stock_actual: number;
  stock_minimo: number;
  
  // Predicción
  demanda_diaria_promedio: number;
  demanda_semanal: number;
  demanda_mensual: number;
  
  // Agotamiento
  dias_hasta_agotamiento: number | null;
  fecha_agotamiento_estimada: string | null;
  
  // Tendencia
  tendencia: TendenciaDemanda;
  variacion_vs_periodo_anterior: number; // porcentaje
  
  // Modelo
  modelo_usado: ModeloPrediccion;
  confianza: number;
  nivel_confianza: NivelConfianza;
  
  // Reposición
  urgencia_reposicion: UrgenciaReposicion;
  cantidad_sugerida_reposicion: number;
  punto_reorden_sugerido: number;
  
  // Predicción detallada
  prediccion_proximos_7_dias?: number[];
  prediccion_proximos_30_dias?: number[];
}

export interface ResumenForecast {
  fecha_analisis: string;
  periodo_analizado_dias: number;
  
  // Totales
  total_productos: number;
  total_con_prediccion: number;
  total_sin_datos: number;
  
  // Por urgencia
  productos_criticos: number;
  productos_urgencia_alta: number;
  productos_urgencia_media: number;
  productos_ok: number;
  
  // Métricas de modelo
  confianza_promedio: number;
  modelo_predominante: ModeloPrediccion;
  
  // Valor en riesgo
  valor_inventario_critico: number;
  valor_inventario_total: number;
  
  // Demanda proyectada
  demanda_total_semana: number;
  demanda_total_mes: number;
}

// ============================================
// ALERTAS Y REPOSICIÓN
// ============================================

export interface AlertaReposicion {
  id: string;
  producto_codigo: string;
  producto_nombre: string;
  
  tipo: 'agotamiento_inminente' | 'bajo_stock' | 'demanda_inusual' | 'tendencia_creciente';
  urgencia: UrgenciaReposicion;
  
  mensaje: string;
  detalle: string;
  
  stock_actual: number;
  stock_minimo: number;
  dias_restantes: number | null;
  
  accion_sugerida: string;
  cantidad_sugerida: number;
  
  fecha_creacion: string;
  leida: boolean;
}

export interface SugerenciaReposicion {
  producto_codigo: string;
  producto_nombre: string;
  categoria?: string;
  
  stock_actual: number;
  punto_reorden: number;
  cantidad_sugerida: number;
  
  lead_time_dias: number;
  safety_stock: number;
  
  costo_unitario?: number;
  costo_total_reposicion?: number;
  
  prioridad: number;
  urgencia: UrgenciaReposicion;
  razon: string;
  
  proveedor_sugerido?: string;
  fecha_pedido_sugerida: string;
  fecha_entrega_estimada: string;
}

// ============================================
// ANÁLISIS DE TENDENCIAS
// ============================================

export interface AnalisisTendencia {
  producto_codigo: string;
  producto_nombre: string;
  
  tendencia_7d: TendenciaDemanda;
  tendencia_30d: TendenciaDemanda;
  tendencia_90d: TendenciaDemanda;
  
  variacion_7d: number;
  variacion_30d: number;
  variacion_90d: number;
  
  estacionalidad_detectada: boolean;
  patron_estacional?: string; // "semanal", "mensual", "trimestral"
  
  pico_demanda_dia_semana?: number; // 0-6
  pico_demanda_semana_mes?: number; // 1-4
  
  correlaciones?: {
    producto_codigo: string;
    coeficiente: number;
  }[];
}

export interface TendenciaCategoria {
  categoria: string;
  productos_count: number;
  
  demanda_actual: number;
  demanda_periodo_anterior: number;
  variacion_porcentaje: number;
  
  tendencia: TendenciaDemanda;
  productos_creciendo: number;
  productos_decreciendo: number;
  productos_estables: number;
}

// ============================================
// CONFIGURACIÓN
// ============================================

export interface ConfiguracionDemandPlanning {
  // Períodos de análisis
  dias_historico_default: number;
  dias_forecast_default: number;
  
  // Umbrales de alerta
  dias_alerta_critica: number;
  dias_alerta_alta: number;
  dias_alerta_media: number;
  
  // Safety stock
  factor_safety_stock: number;
  lead_time_default_dias: number;
  
  // Modelos
  modelo_preferido: ModeloPrediccion;
  usar_api_remota: boolean;
  timeout_api_ms: number;
  
  // Notificaciones
  enviar_alertas_email: boolean;
  enviar_alertas_slack: boolean;
}

export const CONFIG_DEMAND_PLANNING_DEFAULT: ConfiguracionDemandPlanning = {
  dias_historico_default: 90,
  dias_forecast_default: 30,
  dias_alerta_critica: 3,
  dias_alerta_alta: 7,
  dias_alerta_media: 14,
  factor_safety_stock: 1.5,
  lead_time_default_dias: 7,
  modelo_preferido: 'XGBoost',
  usar_api_remota: true,
  timeout_api_ms: 30000,
  enviar_alertas_email: false,
  enviar_alertas_slack: false,
};

// ============================================
// COMPARATIVA FORECAST VS REAL
// ============================================

export interface ComparativaForecast {
  producto_codigo: string;
  periodo: string;
  
  demanda_predicha: number;
  demanda_real: number;
  
  error_absoluto: number;
  error_porcentaje: number;
  
  modelo_usado: ModeloPrediccion;
  prediccion_acertada: boolean; // error < 20%
}

export interface MetricasPrecision {
  periodo: string;
  
  total_predicciones: number;
  predicciones_acertadas: number;
  tasa_acierto: number;
  
  mae: number; // Mean Absolute Error
  mape: number; // Mean Absolute Percentage Error
  rmse: number; // Root Mean Square Error
  
  mejor_modelo: ModeloPrediccion;
  peor_modelo: ModeloPrediccion;
}