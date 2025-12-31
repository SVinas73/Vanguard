const API_URL = process.env.NEXT_PUBLIC_AI_API_URL || 'http://localhost:8000';

export const aiApi = {
  // Predicción de agotamiento de stock (Holt-Winters)
  async predictStockDepletion(codigo: string, diasFuturo: number = 30) {
    const response = await fetch(`${API_URL}/api/predictions/stock-depletion/${codigo}?dias_futuro=${diasFuturo}`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Error en predicción');
    return response.json();
  },

  // Predicción de demanda (XGBoost)
  async predictDemand(diasHistorico: number = 90, diasFuturo: number = 7) {
    const response = await fetch(`${API_URL}/api/predictions/demand-forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dias_historico: diasHistorico, dias_futuro: diasFuturo }),
    });
    if (!response.ok) throw new Error('Error en predicción de demanda');
    return response.json();
  },

  // Resumen de predicciones
  async getPredictionsSummary() {
    const response = await fetch(`${API_URL}/api/predictions/summary`);
    if (!response.ok) throw new Error('Error obteniendo resumen');
    return response.json();
  },

  // Detectar anomalías (Isolation Forest)
  async detectAnomalies(dias: number = 30) {
    const response = await fetch(`${API_URL}/api/anomalies/detect?dias=${dias}`);
    if (!response.ok) throw new Error('Error detectando anomalías');
    return response.json();
  },

  // Verificar anomalía en tiempo real
  async checkRealTimeAnomaly(codigo: string, tipo: string, cantidad: number) {
    const response = await fetch(
      `${API_URL}/api/anomalies/realtime-check?codigo=${codigo}&tipo=${tipo}&cantidad=${cantidad}`
    );
    if (!response.ok) throw new Error('Error verificando anomalía');
    return response.json();
  },

  // Patrones de usuarios
  async getUserPatterns(dias: number = 30) {
    const response = await fetch(`${API_URL}/api/anomalies/user-patterns?dias=${dias}`);
    if (!response.ok) throw new Error('Error obteniendo patrones');
    return response.json();
  },

  // Productos frecuentemente comprados juntos (Apriori)
  async getFrequentItemsets(minSupport: number = 0.1, dias: number = 90) {
    const response = await fetch(
      `${API_URL}/api/associations/frequent-items?min_support=${minSupport}&dias=${dias}`
    );
    if (!response.ok) throw new Error('Error obteniendo itemsets');
    return response.json();
  },

  // Reglas de asociación
  async getAssociationRules(minSupport: number = 0.1, minConfidence: number = 0.5, dias: number = 90) {
    const response = await fetch(
      `${API_URL}/api/associations/rules?min_support=${minSupport}&min_confidence=${minConfidence}&dias=${dias}`
    );
    if (!response.ok) throw new Error('Error obteniendo reglas');
    return response.json();
  },

  // Recomendaciones para un producto
  async getProductRecommendations(codigo: string, dias: number = 90) {
    const response = await fetch(`${API_URL}/api/associations/recommendations/${codigo}?dias=${dias}`);
    if (!response.ok) throw new Error('Error obteniendo recomendaciones');
    return response.json();
  },

  // Health check
  async healthCheck() {
    const response = await fetch(`${API_URL}/health`);
    return response.ok;
  },
};