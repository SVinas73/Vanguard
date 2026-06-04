-- =====================================================
-- Clientes: campos extra + RLS del flujo WMS/aprobaciones
-- =====================================================
-- 1) Campos de cliente que la orden de venta autocarga.
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS razon_social    text,
  ADD COLUMN IF NOT EXISTS nombre_fantasia text,
  ADD COLUMN IF NOT EXISTS vendedor        text;

COMMENT ON COLUMN clientes.vendedor IS 'Email del vendedor asignado; se autocarga en la orden de venta.';

-- 2) RLS permisiva para las tablas que toca el flujo al CONFIRMAR la orden
--    (habilitación/aprobación + generación de picking). Sin esto, el confirmar
--    falla en silencio y "no salta nada en WMS".
DO $$
DECLARE
  t TEXT;
  tablas TEXT[] := ARRAY[
    'aprobaciones',
    'wms_ordenes_picking', 'wms_ordenes_picking_lineas',
    'wms_waves_picking',
    'wms_paquetes', 'wms_paquetes_items',
    'wms_stock_ubicacion', 'wms_ubicaciones', 'wms_zonas',
    'wms_movimientos', 'wms_tareas_putaway', 'wms_no_conformidades',
    'wms_ordenes_recepcion', 'wms_ordenes_recepcion_lineas',
    'wms_tareas_reposicion', 'wms_recomendaciones_slotting', 'wms_conteos'
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
