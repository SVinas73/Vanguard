-- =====================================================
-- wms_ubicaciones: columnas que usa la app
-- =====================================================
-- La tabla wms_ubicaciones se creó con un esquema reducido y le faltan columnas
-- que el código usa (codigo_completo, pasillo, rack, nivel, posicion) y la de
-- prioridad de picking. Sin ellas, "Generar ubicaciones" falla:
--   Could not find the 'codigo_completo' column of 'wms_ubicaciones'.
-- Este script las agrega (idempotente).

ALTER TABLE wms_ubicaciones
  ADD COLUMN IF NOT EXISTS codigo_completo    text,
  ADD COLUMN IF NOT EXISTS pasillo            text,
  ADD COLUMN IF NOT EXISTS rack               text,
  ADD COLUMN IF NOT EXISTS nivel              text,
  ADD COLUMN IF NOT EXISTS posicion           text,
  ADD COLUMN IF NOT EXISTS prioridad_picking  integer DEFAULT 50;

COMMENT ON COLUMN wms_ubicaciones.codigo_completo IS 'Código completo de la ubicación (ej. ALM-A-01-02-03).';
COMMENT ON COLUMN wms_ubicaciones.prioridad_picking IS 'Prioridad de recorrido en picking (menor = primero).';
