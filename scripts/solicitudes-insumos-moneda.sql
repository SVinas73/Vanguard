-- =====================================================
-- Moneda del costo en los ítems de solicitudes de insumos
-- =====================================================
-- Permite cargar el costo de cada insumo en UYU o USD. La moneda se hereda al
-- producto al recibir, para que la valuación (Stock / Análisis de insumos)
-- convierta correctamente USD <-> UYU. Idempotente.

ALTER TABLE solicitudes_insumos_items
  ADD COLUMN IF NOT EXISTS moneda text DEFAULT 'UYU';

COMMENT ON COLUMN solicitudes_insumos_items.moneda IS 'Moneda del costo del insumo: UYU o USD.';
