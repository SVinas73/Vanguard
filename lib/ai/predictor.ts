import { Product, Movement, StockPrediction, TrendType } from '@/types';
import { AI_CONFIG } from '@/lib/constants';

/**
 * Predice los días hasta que un producto se quede sin stock
 * basándose en el historial de movimientos de salida.
 */
export function predictDaysUntilStockout(
  product: Product,
  movements: Movement[]
): StockPrediction {
  // Filtrar solo las salidas de este producto
  const productMovements = movements
    .filter((m) => m.codigo === product.codigo && m.tipo === 'salida')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Si no hay suficientes datos, retornar sin predicción
  if (productMovements.length < AI_CONFIG.MIN_MOVEMENTS_FOR_PREDICTION) {
    return {
      days: null,
      confidence: 0,
      trend: 'sin_datos',
    };
  }

  // Calcular el período de tiempo analizado
  const now = new Date();
  const oldestMovement = productMovements[productMovements.length - 1];
  const daysPeriod = Math.max(
    1,
    (now.getTime() - new Date(oldestMovement.timestamp).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Calcular total de salidas y tasa diaria
  const totalSalidas = productMovements.reduce((sum, m) => sum + m.cantidad, 0);
  const dailyRate = totalSalidas / daysPeriod;

  // Si no hay consumo, el stock dura "infinito"
  if (dailyRate === 0) {
    return {
      days: Infinity,
      confidence: 0.3,
      trend: 'estable',
    };
  }

  // Calcular días restantes
  const daysRemaining = Math.round(product.stock / dailyRate);

  // Determinar tendencia comparando movimientos recientes vs antiguos
  const trend = calculateTrend(productMovements);

  // Calcular confianza basada en cantidad de datos
  const confidence = Math.min(
    AI_CONFIG.MAX_CONFIDENCE,
    AI_CONFIG.BASE_CONFIDENCE + productMovements.length * AI_CONFIG.CONFIDENCE_INCREMENT
  );

  return {
    days: daysRemaining,
    confidence,
    trend,
    dailyRate: dailyRate.toFixed(2),
  };
}

/**
 * Calcula la tendencia de consumo comparando movimientos recientes vs históricos
 */
function calculateTrend(movements: Movement[]): TrendType {
  if (movements.length < 4) {
    return 'estable';
  }

  // Dividir en recientes (primeros 3) y antiguos (resto)
  const recentMovements = movements.slice(0, 3);
  const olderMovements = movements.slice(3);

  if (olderMovements.length === 0) {
    return 'estable';
  }

  // Calcular promedios
  const recentAvg = recentMovements.reduce((s, m) => s + m.cantidad, 0) / recentMovements.length;
  const olderAvg = olderMovements.reduce((s, m) => s + m.cantidad, 0) / olderMovements.length;

  // Comparar con un margen del 20%
  if (recentAvg > olderAvg * 1.2) {
    return 'acelerando';
  } else if (recentAvg < olderAvg * 0.8) {
    return 'desacelerando';
  }

  return 'estable';
}

/**
 * Calcula predicciones para todos los productos
 */
export function predictAllProducts(
  products: Product[],
  movements: Movement[]
): Record<string, StockPrediction> {
  const predictions: Record<string, StockPrediction> = {};

  for (const product of products) {
    predictions[product.codigo] = predictDaysUntilStockout(product, movements);
  }

  return predictions;
}

/**
 * Obtiene productos con stock bajo o próximos a agotarse
 */
export function getStockAlerts(
  products: Product[],
  predictions: Record<string, StockPrediction>,
  alertDays: number = AI_CONFIG.LOW_STOCK_ALERT_DAYS
): Product[] {
  return products.filter((product) => {
    const pred = predictions[product.codigo];
    
    // Alerta si stock actual <= mínimo
    if (product.stock <= product.stockMinimo) {
      return true;
    }
    
    // Alerta si predicción indica agotamiento próximo
    if (pred && pred.days !== null && pred.days < alertDays) {
      return true;
    }
    
    return false;
  });
}
