import { Movement, Product, AnomalyResult } from '@/types';
import { AI_CONFIG } from '@/lib/constants';

/**
 * Detecta si un movimiento es anómalo comparándolo con el historial
 * usando el Z-score (desviación estándar)
 */
export function detectAnomaly(
  movement: Movement,
  product: Product,
  historicalMovements: Movement[]
): AnomalyResult {
  // Filtrar movimientos del mismo producto y tipo
  const sameTypeMovements = historicalMovements.filter(
    (m) => m.codigo === movement.codigo && m.tipo === movement.tipo && m.id !== movement.id
  );

  // Necesitamos al menos 3 movimientos para detectar anomalías
  if (sameTypeMovements.length < 3) {
    return {
      isAnomaly: false,
      reason: null,
      severity: 0,
    };
  }

  // Calcular estadísticas
  const quantities = sameTypeMovements.map((m) => m.cantidad);
  const mean = quantities.reduce((a, b) => a + b, 0) / quantities.length;
  const variance = quantities.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / quantities.length;
  const stdDev = Math.sqrt(variance);

  // Calcular Z-score
  const zScore = stdDev > 0 ? (movement.cantidad - mean) / stdDev : 0;

  // Verificar si supera el umbral
  if (Math.abs(zScore) > AI_CONFIG.ANOMALY_THRESHOLD) {
    const isHigh = zScore > 0;
    
    return {
      isAnomaly: true,
      reason: isHigh
        ? `Cantidad inusualmente alta (${movement.cantidad} vs promedio ${mean.toFixed(0)})`
        : `Cantidad inusualmente baja (${movement.cantidad} vs promedio ${mean.toFixed(0)})`,
      severity: Math.min(1, Math.abs(zScore) / 4),
      zScore: zScore.toFixed(2),
    };
  }

  return {
    isAnomaly: false,
    reason: null,
    severity: 0,
  };
}

/**
 * Verifica anomalías antes de registrar un movimiento (preview)
 */
export function checkMovementAnomaly(
  codigo: string,
  tipo: 'entrada' | 'salida',
  cantidad: number,
  products: Product[],
  movements: Movement[]
): AnomalyResult {
  const product = products.find((p) => p.codigo === codigo);
  
  if (!product) {
    return { isAnomaly: false, reason: null, severity: 0 };
  }

  const tempMovement: Movement = {
    id: -1, // ID temporal
    codigo,
    tipo,
    cantidad,
    usuario: 'temp',
    timestamp: new Date(),
  };

  return detectAnomaly(tempMovement, product, movements);
}

/**
 * Analiza todos los movimientos y retorna los anómalos
 */
export function findAllAnomalies(
  products: Product[],
  movements: Movement[]
): Array<{ movement: Movement; anomaly: AnomalyResult }> {
  const anomalies: Array<{ movement: Movement; anomaly: AnomalyResult }> = [];

  for (const movement of movements) {
    const product = products.find((p) => p.codigo === movement.codigo);
    if (!product) continue;

    const anomaly = detectAnomaly(
      movement,
      product,
      movements.filter((m) => m.id !== movement.id)
    );

    if (anomaly.isAnomaly) {
      anomalies.push({ movement, anomaly });
    }
  }

  return anomalies.sort((a, b) => b.anomaly.severity - a.anomaly.severity);
}
