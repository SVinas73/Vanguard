-- Prioridad de picking por ubicación (menor número = se pickea primero).
-- Se setea en WMS → Ubicaciones (detalle). El picker recorre las ubicaciones
-- del pedido en este orden.
ALTER TABLE wms_ubicaciones
  ADD COLUMN IF NOT EXISTS prioridad_picking integer DEFAULT 50;

COMMENT ON COLUMN wms_ubicaciones.prioridad_picking IS
  'Prioridad de recorrido en picking (menor = primero).';
