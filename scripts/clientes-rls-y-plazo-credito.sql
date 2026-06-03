-- =====================================================
-- Clientes: arreglo de RLS + plazo de crédito
-- =====================================================
-- 1) Corrige el error al crear clientes:
--    "new row violates row-level security policy for table clientes".
--    La app usa auth a nivel aplicación (NextAuth) + anon key, por eso las
--    tablas operativas llevan una policy permisiva (mismo patrón que el resto).
-- 2) Agrega el plazo de crédito (días): 1 (contado), 30, 60, 90.
-- =====================================================

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clientes_all ON clientes;
CREATE POLICY clientes_all ON clientes
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS dias_credito integer DEFAULT 30;

COMMENT ON COLUMN clientes.dias_credito IS
  'Plazo de crédito acordado con el cliente, en días (1=contado, 30, 60, 90).';
