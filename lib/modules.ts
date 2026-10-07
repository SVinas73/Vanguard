// ============================================
// CONFIGURACIÓN DE LA ORGANIZACIÓN — monedas
// ============================================

export interface ModuleConfig {
  /** Moneda en la que el sistema almacena precios/costos (base). */
  base_currency?: string;
  /** Moneda en la que se muestran reportes/dashboards (convierte desde la base). */
  display_currency?: string;
}

export const DEFAULT_CONFIG: ModuleConfig = {
  base_currency: 'UYU',
  display_currency: 'UYU',
};
