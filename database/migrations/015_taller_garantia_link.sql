-- =====================================================
-- MIGRATION 015 — Link Taller ↔ Garantías
-- =====================================================
-- Agrega FK opcional desde órdenes de taller a la garantía
-- correspondiente, validada en el ingreso.
-- =====================================================

-- Agregar columna garantia_id (FK opcional)
ALTER TABLE IF EXISTS ordenes_taller
  ADD COLUMN IF NOT EXISTS garantia_id UUID REFERENCES garantias(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ordenes_taller_garantia_id
  ON ordenes_taller(garantia_id) WHERE garantia_id IS NOT NULL;

-- Comentario para documentación
COMMENT ON COLUMN ordenes_taller.garantia_id IS
  'Garantía validada al ingreso (cuando es_garantia=true). NULL si la orden no es por garantía o si no se hizo el lookup.';
