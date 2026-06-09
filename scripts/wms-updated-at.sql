-- =====================================================
-- Agrega 'updated_at' a las tablas WMS
-- =====================================================
-- Algunas instalaciones tienen un trigger genérico (set_updated_at / moddatetime)
-- que hace NEW.updated_at = now() en cada UPDATE. Si la tabla NO tiene esa
-- columna, el UPDATE explota con:
--   record "new" has no field "updated_at"
-- (Ej. al confirmar una línea de picking, que actualiza wms_stock_ubicacion.)
-- Este script agrega la columna donde falte. Idempotente.

DO $$
DECLARE
  t TEXT;
  tablas TEXT[] := ARRAY[
    'wms_stock_ubicacion',
    'wms_ubicaciones',
    'wms_zonas',
    'wms_ordenes_picking',
    'wms_ordenes_picking_lineas',
    'wms_ordenes_recepcion',
    'wms_ordenes_recepcion_lineas',
    'wms_waves',
    'wms_waves_picking',
    'wms_paquetes',
    'wms_paquetes_items'
  ];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()', t);
    END IF;
  END LOOP;
END $$;
