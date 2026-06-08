-- =====================================================
-- Fix de esquema + RLS para alta de producto y "Colocar" en ubicación
-- =====================================================
-- Resuelve:
--   - "Could not find the 'unidad' column of 'productos'" (alta de producto).
--   - El "Colocar artículo en ubicación" que decía OK pero no guardaba
--     (RLS bloqueando wms_stock_ubicacion, o columnas faltantes).
-- Todo idempotente.

-- 1) productos: unidad de medida (Depósito de Ventas).
ALTER TABLE productos ADD COLUMN IF NOT EXISTS unidad text DEFAULT 'unidad';

-- 2) wms_stock_ubicacion: columnas que usa la app.
ALTER TABLE wms_stock_ubicacion
  ADD COLUMN IF NOT EXISTS cantidad_reservada  numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cantidad_disponible numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lote_numero         text,
  ADD COLUMN IF NOT EXISTS ultimo_movimiento   timestamptz;

-- 3) RLS permisiva (la app usa anon key + auth a nivel app). Sin esto el
--    INSERT en wms_stock_ubicacion falla y el "Colocar" no guarda nada.
DO $$
DECLARE
  t TEXT;
  tablas TEXT[] := ARRAY['wms_stock_ubicacion', 'wms_ubicaciones', 'wms_zonas'];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS %I_all ON %I', t, t);
      EXECUTE format('CREATE POLICY %I_all ON %I FOR ALL USING (true) WITH CHECK (true)', t, t);
    END IF;
  END LOOP;
END $$;
