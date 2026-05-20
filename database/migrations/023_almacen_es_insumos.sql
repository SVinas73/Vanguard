-- =====================================================
-- MIGRATION 023 — Marcar almacenes "de insumos"
-- =====================================================
-- El usuario quiere controlar desde la BD qué almacenes son
-- de insumos (vs almacenes de mercadería para venta, MPR, etc.).
--
-- Flag binario en `almacenes.es_insumos`. Default false.
-- Se gestiona MANUALMENTE en la BD (no expuesto en UI por
-- decisión explícita del usuario):
--
--   -- Marcar el almacén "Insumos" como de insumos:
--   UPDATE almacenes SET es_insumos = TRUE WHERE nombre = 'Insumos';
--
--   -- Desmarcarlo:
--   UPDATE almacenes SET es_insumos = FALSE WHERE nombre = 'Insumos';
--
-- El form de solicitudes filtra automáticamente productos
-- cuyo almacén tenga es_insumos = TRUE.
-- =====================================================

ALTER TABLE almacenes
  ADD COLUMN IF NOT EXISTS es_insumos BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_almacenes_es_insumos
  ON almacenes(es_insumos) WHERE es_insumos = TRUE;

COMMENT ON COLUMN almacenes.es_insumos IS
  'TRUE = almacén de uso interno (papelería, ferretería, edintor, etc.). '
  'El módulo de Solicitudes de Insumos filtra productos por esta flag. '
  'Se configura manualmente con UPDATE — no expuesto en UI.';
