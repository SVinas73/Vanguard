-- =====================================================
-- RLS — flujo de ventas / pedidos
-- =====================================================
-- Corrige el síntoma "no pasa nada al crear la orden de venta" (igual que pasó
-- con clientes): las tablas del flujo tienen RLS activado sin una policy que
-- permita insertar, así que el INSERT falla. La app usa auth a nivel aplicación
-- (NextAuth) + anon key, por eso se usa una policy permisiva como en el resto
-- de tablas operativas.
--
-- Idempotente y seguro: solo toca tablas que existan.
-- =====================================================

DO $$
DECLARE
  t TEXT;
  tablas TEXT[] := ARRAY[
    'ordenes_venta', 'ordenes_venta_items',
    'cotizaciones', 'cotizaciones_items',
    'reservas_stock', 'cuentas_por_cobrar', 'pagos_venta'
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
