import { Product, Movement, StockPrediction, TrendType } from '@/types';
import { AI_CONFIG } from '@/lib/constants';

/**
 * Predice los días hasta que un producto se quede sin stock
 * basándose en el historial de movimientos (entradas y salidas).
 */
export function predictDaysUntilStockout(
  product: Product,
  movements: Movement[]
): StockPrediction {
  // Filtrar movimientos de este producto
  const productMovements = movements
    .filter((m) => m.codigo === product.codigo)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Si no hay movimientos, retornar sin predicción
  if (productMovements.length < 1) {
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

  // Calcular totales
  const totalSalidas = productMovements
    .filter(m => m.tipo === 'salida')
    .reduce((sum, m) => sum + m.cantidad, 0);
  
  const totalEntradas = productMovements
    .filter(m => m.tipo === 'entrada')
    .reduce((sum, m) => sum + m.cantidad, 0);

  // Tasa diaria de consumo neto (salidas - entradas por día)
  const dailyConsumption = totalSalidas / daysPeriod;
  const dailyIncome = totalEntradas / daysPeriod;
  const netDailyRate = dailyConsumption - dailyIncome;

  // Si el consumo neto es <= 0 (más entradas que salidas), stock "infinito"
  if (netDailyRate <= 0) {
    return {
      days: Infinity,
      confidence: 0.5,
      trend: totalEntradas > totalSalidas ? 'creciendo' : 'estable',
      dailyRate: dailyConsumption.toFixed(2),
      dailyIncome: dailyIncome.toFixed(2),
    };
  }

  // Calcular días restantes basado en consumo neto
  const daysRemaining = Math.round(product.stock / netDailyRate);

  // Determinar tendencia
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
    dailyRate: dailyConsumption.toFixed(2),
    dailyIncome: dailyIncome.toFixed(2),
  };
}

/**
 * Calcula la tendencia de consumo comparando movimientos recientes vs históricos
 */
function calculateTrend(movements: Movement[]): TrendType {
  if (movements.length < 4) {
    return 'estable';
  }

  // Calcular consumo neto (salidas - entradas) por movimiento
  const getNetValue = (m: Movement) => m.tipo === 'salida' ? m.cantidad : -m.cantidad;

  // Dividir en recientes (primeros 3) y antiguos (resto)
  const recentMovements = movements.slice(0, 3);
  const olderMovements = movements.slice(3);

  if (olderMovements.length === 0) {
    return 'estable';
  }

  // Calcular consumo neto promedio
  const recentNetAvg = recentMovements.reduce((s, m) => s + getNetValue(m), 0) / recentMovements.length;
  const olderNetAvg = olderMovements.reduce((s, m) => s + getNetValue(m), 0) / olderMovements.length;

  // Comparar con un margen del 20%
  if (recentNetAvg > olderNetAvg * 1.2) {
    return 'acelerando'; // Consumiendo más rápido
  } else if (recentNetAvg < olderNetAvg * 0.8) {
    return 'desacelerando'; // Consumiendo más lento
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
