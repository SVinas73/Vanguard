-- =====================================================
-- RLS permisiva para las órdenes de picking de WMS
-- =====================================================
-- El puente venta→picking (crearPickingWmsDesdeVenta) inserta en
-- wms_ordenes_picking y wms_ordenes_picking_lineas. Si la RLS bloquea ese
-- INSERT, el picking nunca se crea (y la orden no aparece en WMS → Picking)
-- aunque la venta esté confirmada. Este script deja RLS permisiva (la app usa
-- anon key + auth a nivel app). Idempotente.

-- 0) Columnas que usa el puente y que pueden faltar en instalaciones con un
--    esquema reducido (ej. "Could not find the 'cliente_nombre' column").
ALTER TABLE wms_ordenes_picking
  ADD COLUMN IF NOT EXISTS numero              text,
  ADD COLUMN IF NOT EXISTS tipo_origen         text,
  ADD COLUMN IF NOT EXISTS orden_venta_id      uuid,
  ADD COLUMN IF NOT EXISTS orden_venta_numero  text,
  ADD COLUMN IF NOT EXISTS cliente_nombre      text,
  ADD COLUMN IF NOT EXISTS almacen_id          uuid,
  ADD COLUMN IF NOT EXISTS fecha_requerida     date,
  ADD COLUMN IF NOT EXISTS estado              text DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS lineas_totales      integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lineas_completadas  integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unidades_totales    numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unidades_pickeadas  numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prioridad           integer DEFAULT 2,
  ADD COLUMN IF NOT EXISTS picker_asignado     text,
  ADD COLUMN IF NOT EXISTS wave_id             uuid,
  ADD COLUMN IF NOT EXISTS creado_por          text;

ALTER TABLE wms_ordenes_picking_lineas
  ADD COLUMN IF NOT EXISTS orden_picking_id    uuid,
  ADD COLUMN IF NOT EXISTS producto_codigo     text,
  ADD COLUMN IF NOT EXISTS producto_nombre     text,
  ADD COLUMN IF NOT EXISTS cantidad_solicitada numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cantidad_pickeada   numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cantidad_short      numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unidad_medida       text DEFAULT 'UND',
  ADD COLUMN IF NOT EXISTS estado              text DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS secuencia           integer DEFAULT 1;

DO $$
DECLARE
  t TEXT;
  tablas TEXT[] := ARRAY[
    'wms_ordenes_picking',
    'wms_ordenes_picking_lineas',
    'wms_ordenes_recepcion',
    'wms_ordenes_recepcion_lineas',
    'wms_waves'
  ];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS %I_all ON %I', t, t);
      EXECUTE format('CREATE POLICY %I_all ON %I FOR ALL USING (true) WITH CHECK (true)', t, t);
    END IF;
  END LOOP;
END $$;
