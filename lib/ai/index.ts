// ============================================
// MÓDULO DE IA - INVENTORYAI
// ============================================

export {
  predictDaysUntilStockout,
  predictAllProducts,
  getStockAlerts,
} from './predictor';

export {
  detectAnomaly,
  checkMovementAnomaly,
  findAllAnomalies,
} from './anomaly-detector';

export {
  suggestCategory,
  suggestTopCategories,
  matchesCategory,
} from './category-suggester';

export {
  semanticSearch,
  searchWithCategory,
  getSearchSuggestions,
} from './semantic-search';
