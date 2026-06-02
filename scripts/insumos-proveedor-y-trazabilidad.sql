-- =====================================================
-- Proveedor + trazabilidad de edición en solicitudes de insumos
-- =====================================================
-- - proveedor / proveedor_nombre: proveedor elegido al crear la solicitud.
--   proveedor guarda la clave (ej. 'MERCADO LIBRE'); proveedor_nombre el
--   nombre libre cuando proveedor = 'OTRO'.
-- - modificado_por / modificado_at: quién y cuándo tocó la solicitud por
--   última vez (cambio de estado o edición). La edición es exclusiva de
--   admins; ver /api/insumos/solicitudes/[id].
-- =====================================================

ALTER TABLE solicitudes_insumos
  ADD COLUMN IF NOT EXISTS proveedor         text,
  ADD COLUMN IF NOT EXISTS proveedor_nombre  text,
  ADD COLUMN IF NOT EXISTS modificado_por    text,
  ADD COLUMN IF NOT EXISTS modificado_at     timestamptz;

COMMENT ON COLUMN solicitudes_insumos.proveedor IS
  'Clave del proveedor: TYT DE MARTINI | YNTER INDUSTRIAL | MERCADO LIBRE | ESTACION HOGAR | OTRO.';
COMMENT ON COLUMN solicitudes_insumos.proveedor_nombre IS
  'Nombre libre del proveedor cuando proveedor = OTRO.';
COMMENT ON COLUMN solicitudes_insumos.modificado_por IS
  'Email del último usuario que modificó la solicitud (estado o edición).';
COMMENT ON COLUMN solicitudes_insumos.modificado_at IS
  'Fecha/hora de la última modificación.';
