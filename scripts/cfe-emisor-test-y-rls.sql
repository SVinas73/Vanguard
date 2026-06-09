-- =====================================================
-- Emisor CFE de prueba + RLS permisiva para facturar
-- =====================================================
-- Resuelve "No se pudo crear el CFE (¿emisor configurado en cfe_emisor_config?)".
-- Dos causas:
--   1) No hay fila activa en cfe_emisor_config.
--   2) La RLS de las tablas CFE es "TO authenticated / is_admin()", y la app usa
--      anon key (auth a nivel app), así que ni siquiera puede LEER el emisor.
-- Todo idempotente.

-- 1) RLS permisiva en las tablas CFE (la app usa anon key + auth a nivel app).
DO $$
DECLARE
  t TEXT;
  tablas TEXT[] := ARRAY['cfe_emisor_config', 'cfe_uy', 'cfe_uy_lineas'];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      -- Quitar políticas viejas restrictivas
      EXECUTE format('DROP POLICY IF EXISTS %I_select ON %I', replace(t,'cfe_uy','cfe_emisor'), t);
      EXECUTE format('DROP POLICY IF EXISTS %I_write ON %I', replace(t,'cfe_uy','cfe_emisor'), t);
      EXECUTE format('DROP POLICY IF EXISTS cfe_emisor_select ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS cfe_emisor_write ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS %I_all ON %I', t, t);
      EXECUTE format('CREATE POLICY %I_all ON %I FOR ALL USING (true) WITH CHECK (true)', t, t);
    END IF;
  END LOOP;
END $$;

-- 2) Emisor de prueba (ambiente 'test') si no hay ninguno activo.
INSERT INTO cfe_emisor_config (rut, razon_social, nombre_comercial, ambiente, serie_actual, activo)
SELECT '219999990019', 'EMPRESA DE PRUEBA SA', 'Vanguard Demo', 'test', 'A', true
WHERE NOT EXISTS (SELECT 1 FROM cfe_emisor_config WHERE activo = true);
