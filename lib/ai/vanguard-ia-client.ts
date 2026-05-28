// ============================================
// CLIENTE API - VANGUARD IA (Render)
// ============================================

import { AI_API_URL } from './api-url';

const API_BASE_URL = AI_API_URL;

// ============================================
// TIPOS DE RESPUESTA DE LA API
// ============================================

export interface StockDepletionResponse {
  codigo: string;
  stock_actual: number;
  dias_hasta_agotamiento: number | null;
  fecha_estimada_agotamiento: string | null;
  consumo_diario_predicho?: number;
  prediccion_proximos_dias?: number[];
  modelo: string;
  confianza: number;
  mensaje?: string;
}

export interface DemandForecastItem {
  codigo: string;
  descripcion: string;
  demanda_predicha_semana: number;
  demanda_por_dia?: number[];
  modelo: string;
  confianza: number;
}

export interface DemandForecastResponse {
  periodo: string;
  predicciones: DemandForecastItem[];
  total_productos_analizados: number;
}

export interface CriticalProduct {
  codigo: string;
  descripcion: string;
  stock_actual: number;
  stock_minimo: number;
  consumo_diario: number;
  dias_restantes: number;
  urgencia: 'critica' | 'media' | 'baja';
}

export interface PredictionsSummaryResponse {
  productos_criticos: CriticalProduct[];
  total_analizado: number;
  total_criticos: number;
}

export interface AnomalyResponse {
  codigo: string;
  es_anomalia: boolean;
  tipo_anomalia?: string;
  descripcion?: string;
  severidad?: 'baja' | 'media' | 'alta';
  valor_esperado?: number;
  valor_real?: number;
  desviacion_porcentaje?: number;
}

export interface AnomalyItem {
  id: string;
  codigo: string;
  descripcion: string;
  tipo: string;
  cantidad: number;
  fecha: string;
  usuario: string;
  anomaly_score: number;
  razon: string;
  severidad: 'alta' | 'media' | 'baja';
}

export interface AnomaliesResult {
  anomalias: AnomalyItem[];
  total_analizado: number;
  total_anomalias: number;
  periodo_dias?: number;
  modelo?: string;
  mensaje?: string;
}

export interface RealtimeAnomalyResult {
  is_anomaly: boolean;
  z_score?: number;
  cantidad_promedio?: number;
  cantidad_maxima_historica?: number;
  alertas?: string[];
  severidad?: string;
  mensaje?: string;
}

export interface AssociationRuleItem {
  si_compran: Array<{ codigo: string; descripcion: string }>;
  tambien_compran: Array<{ codigo: string; descripcion: string }>;
  confianza: number;
  soporte: number;
  lift: number;
  interpretacion: string;
}

export interface AssociationRulesResult {
  reglas: AssociationRuleItem[];
  total_transacciones: number;
  mensaje?: string;
}

export interface RecommendationResponse {
  codigo: string;
  descripcion: string;
  cantidad_sugerida: number;
  razon: string;
  prioridad: number;
  ahorro_estimado?: number;
}

// ============================================
// CLIENTE API
// ============================================

class VanguardIAClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string = API_BASE_URL, timeout: number = 30000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout - API no responde');
      }
      throw error;
    }
  }

  // ============================================
  // PREDICTIONS
  // ============================================

  /**
   * Predice días hasta agotamiento de un producto usando Holt-Winters
   */
  async getStockDepletion(codigo: string, diasFuturo: number = 30): Promise<StockDepletionResponse> {
    return this.fetch<StockDepletionResponse>(
      `/api/predictions/stock-depletion/${codigo}?dias_futuro=${diasFuturo}`,
      { method: 'POST' }
    );
  }

  /**
   * Obtiene forecast de demanda para todos los productos usando XGBoost
   */
  async getDemandForecast(diasHistorico: number = 90, diasFuturo: number = 7): Promise<DemandForecastResponse> {
    return this.fetch<DemandForecastResponse>('/api/predictions/demand-forecast', {
      method: 'POST',
      body: JSON.stringify({
        dias_historico: diasHistorico,
        dias_futuro: diasFuturo,
      }),
    });
  }

  /**
   * Obtiene resumen de productos críticos
   */
  async getPredictionsSummary(): Promise<PredictionsSummaryResponse> {
    return this.fetch<PredictionsSummaryResponse>('/api/predictions/summary');
  }

  // ============================================
  // ANOMALIES
  // ============================================

  /**
   * Detecta anomalías en movimientos recientes (Isolation Forest).
   * El backend devuelve un objeto { anomalias, total_analizado, ... }.
   */
  async detectAnomalies(dias: number = 30): Promise<AnomaliesResult> {
    return this.fetch<AnomaliesResult>(`/api/anomalies/detect?dias=${dias}`);
  }

  /**
   * Verifica en tiempo real si un movimiento sería anómalo antes de registrarlo.
   * Mapea al endpoint real /api/anomalies/realtime-check (GET con query params).
   */
  async checkMovementAnomaly(
    codigo: string,
    cantidad: number,
    tipo: 'entrada' | 'salida'
  ): Promise<RealtimeAnomalyResult> {
    const params = new URLSearchParams({ codigo, tipo, cantidad: String(cantidad) });
    return this.fetch<RealtimeAnomalyResult>(`/api/anomalies/realtime-check?${params}`);
  }

  // ============================================
  // ASSOCIATIONS / RECOMMENDATIONS
  // ============================================

  /**
   * Reglas de asociación "si sale X también sale Y" (Apriori).
   */
  async getAssociationRules(
    minSupport: number = 0.1,
    minConfidence: number = 0.5,
    dias: number = 90
  ): Promise<AssociationRulesResult> {
    const params = new URLSearchParams({
      min_support: String(minSupport),
      min_confidence: String(minConfidence),
      dias: String(dias),
    });
    return this.fetch<AssociationRulesResult>(`/api/associations/rules?${params}`);
  }

  /**
   * Productos frecuentemente movidos juntos (itemsets).
   */
  async getProductAssociations(minSupport: number = 0.1, dias: number = 90): Promise<any> {
    const params = new URLSearchParams({ min_support: String(minSupport), dias: String(dias) });
    return this.fetch(`/api/associations/frequent-items?${params}`);
  }

  /**
   * Productos relacionados a uno dado (recomendaciones por co-ocurrencia).
   */
  async getRelatedProducts(codigo: string, dias: number = 90): Promise<any> {
    return this.fetch(`/api/associations/recommendations/${codigo}?dias=${dias}`);
  }

  // ============================================
  // HEALTH CHECK
  // ============================================

  /**
   * Verifica si la API está disponible
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetch<{ status: string }>('/health');
      return response.status === 'healthy';
    } catch {
      return false;
    }
  }
}

// ============================================
// INSTANCIA SINGLETON
// ============================================

export const vanguardIA = new VanguardIAClient();

// ============================================
// FUNCIONES HELPER CON FALLBACK
// ============================================

import { predictDaysUntilStockout, predictAllProducts } from './predictor';
import { Product, Movement } from '@/types';

/**
 * Obtiene predicción de agotamiento con fallback a cálculo local
 */
export async function getStockPredictionWithFallback(
  product: Product,
  movements: Movement[],
  useRemote: boolean = true
): Promise<StockDepletionResponse | null> {
  // Intentar API remota primero
  if (useRemote) {
    try {
      const remoteResult = await vanguardIA.getStockDepletion(product.codigo);
      return remoteResult;
    } catch (error) {
      console.warn(`[VanguardIA] API no disponible, usando fallback local para ${product.codigo}`);
    }
  }

  // Fallback a cálculo local
  const localPrediction = predictDaysUntilStockout(product, movements);
  
  return {
    codigo: product.codigo,
    stock_actual: product.stock,
    dias_hasta_agotamiento: localPrediction.days === Infinity ? null : localPrediction.days,
    fecha_estimada_agotamiento: localPrediction.days && localPrediction.days !== Infinity
      ? new Date(Date.now() + localPrediction.days * 86400000).toISOString()
      : null,
    consumo_diario_predicho: localPrediction.dailyRate ? parseFloat(localPrediction.dailyRate) : undefined,
    modelo: 'local_fallback',
    confianza: localPrediction.confidence,
  };
}

/**
 * Obtiene predicciones de todos los productos con fallback
 */
export async function getAllPredictionsWithFallback(
  products: Product[],
  movements: Movement[],
  useRemote: boolean = true
): Promise<Record<string, StockDepletionResponse>> {
  const results: Record<string, StockDepletionResponse> = {};

  // Intentar obtener forecast remoto
  if (useRemote) {
    try {
      const forecast = await vanguardIA.getDemandForecast();
      
      for (const pred of forecast.predicciones) {
        const product = products.find(p => p.codigo === pred.codigo);
        if (product) {
          // Convertir formato de forecast a StockDepletion
          const consumoDiario = pred.demanda_predicha_semana / 7;
          const diasHastaAgotamiento = consumoDiario > 0 
            ? Math.round(product.stock / consumoDiario) 
            : null;
          
          results[pred.codigo] = {
            codigo: pred.codigo,
            stock_actual: product.stock,
            dias_hasta_agotamiento: diasHastaAgotamiento,
            fecha_estimada_agotamiento: diasHastaAgotamiento 
              ? new Date(Date.now() + diasHastaAgotamiento * 86400000).toISOString()
              : null,
            consumo_diario_predicho: consumoDiario,
            prediccion_proximos_dias: pred.demanda_por_dia,
            modelo: pred.modelo,
            confianza: pred.confianza,
          };
        }
      }
      
      return results;
    } catch (error) {
      console.warn('[VanguardIA] API no disponible, usando fallback local');
    }
  }

  // Fallback local
  const localPredictions = predictAllProducts(products, movements);
  
  for (const [codigo, pred] of Object.entries(localPredictions)) {
    const product = products.find(p => p.codigo === codigo);
    if (product) {
      results[codigo] = {
        codigo,
        stock_actual: product.stock,
        dias_hasta_agotamiento: pred.days === Infinity ? null : pred.days,
        fecha_estimada_agotamiento: pred.days && pred.days !== Infinity
          ? new Date(Date.now() + pred.days * 86400000).toISOString()
          : null,
        consumo_diario_predicho: pred.dailyRate ? parseFloat(pred.dailyRate) : undefined,
        modelo: 'local_fallback',
        confianza: pred.confidence,
      };
    }
  }

  return results;
}

export default vanguardIA;