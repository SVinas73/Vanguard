-- =====================================================
-- Distribución: RLS permisiva + agencia asignada al cliente
-- =====================================================
-- Resuelve:
--   - "new row violates row-level security policy for table agencias_distribucion"
--     al crear una agencia (la app usa anon key + auth a nivel app).
--   - Campo "Agencia de distribución" del cliente (clientes.agencia_id), que se
--     usa para auto-asignar la agencia al registrar el despacho de un pedido.
-- Idempotente.

-- 1) RLS permisiva en las tablas de distribución.
DO $$
DECLARE
  t TEXT;
  tablas TEXT[] := ARRAY['agencias_distribucion', 'distribucion_despachos'];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS %I_all ON %I', t, t);
      EXECUTE format('CREATE POLICY %I_all ON %I FOR ALL USING (true) WITH CHECK (true)', t, t);
    END IF;
  END LOOP;
END $$;

-- 2) Agencia del cliente.
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS agencia_id uuid;
COMMENT ON COLUMN clientes.agencia_id IS 'Agencia de distribución asignada al cliente (auto-asignación en despachos).';
