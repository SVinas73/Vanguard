-- =====================================================
-- RLS permisiva para las órdenes de picking de WMS
-- =====================================================
-- El puente venta→picking (crearPickingWmsDesdeVenta) inserta en
-- wms_ordenes_picking y wms_ordenes_picking_lineas. Si la RLS bloquea ese
-- INSERT, el picking nunca se crea (y la orden no aparece en WMS → Picking)
-- aunque la venta esté confirmada. Este script deja RLS permisiva (la app usa
-- anon key + auth a nivel app). Idempotente.

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
