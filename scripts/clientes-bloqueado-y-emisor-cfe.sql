-- =====================================================================
-- Habilitación de cliente + Emisor CFE (facturación electrónica)
-- =====================================================================
-- Dos cosas que el código nuevo necesita en Supabase:
--
--   1) clientes.bloqueado: bandera que usa Ventas/Clientes para impedir que
--      un cliente bloqueado por Administración genere pedidos.
--   2) cfe_emisor_config: fila del emisor con los correlativos de CFE, que usa
--      la auto-facturación al despachar (lib/uy-cfe.ts → facturarOrdenVenta).
--
-- COMO EJECUTAR: pegá TODO en Supabase -> SQL Editor -> Run.
-- Es idempotente (se puede correr más de una vez sin romper nada).
-- =====================================================================

-- ── 1) clientes.bloqueado ────────────────────────────────────────────
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS bloqueado boolean NOT NULL DEFAULT false;

-- (Opcional) asegurar que límite de crédito exista por si algún entorno no lo tenía.
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS limite_credito numeric NOT NULL DEFAULT 0;


-- ── 2) cfe_emisor_config (emisor de facturación electrónica) ─────────
-- Tabla con los datos del emisor y los correlativos por tipo de CFE.
CREATE TABLE IF NOT EXISTS cfe_emisor_config (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rut                       text NOT NULL,
  razon_social              text,
  serie_actual              text NOT NULL DEFAULT 'A',
  proximo_numero_e_ticket   integer NOT NULL DEFAULT 1,
  proximo_numero_e_factura  integer NOT NULL DEFAULT 1,
  proximo_numero_nc         integer NOT NULL DEFAULT 1,
  proximo_numero_nd         integer NOT NULL DEFAULT 1,
  proximo_numero_e_remito   integer NOT NULL DEFAULT 1,
  ambiente                  text NOT NULL DEFAULT 'test',  -- 'test' | 'produccion'
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- Insertar UNA fila de emisor solo si la tabla está vacía.
-- ⚠️ EDITÁ el RUT y la razón social por los reales de tu empresa.
INSERT INTO cfe_emisor_config (rut, razon_social, serie_actual, ambiente)
SELECT '000000000000', 'Mi Empresa S.A.', 'A', 'test'
WHERE NOT EXISTS (SELECT 1 FROM cfe_emisor_config);

-- RLS: habilitar y permitir a usuarios autenticados (ajustá a tu política).
ALTER TABLE cfe_emisor_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cfe_emisor_config' AND policyname = 'cfe_emisor_auth_all'
  ) THEN
    CREATE POLICY cfe_emisor_auth_all ON cfe_emisor_config
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;


-- ── Verificación ─────────────────────────────────────────────────────
SELECT 'clientes.bloqueado' AS check, count(*) AS clientes_total,
       count(*) FILTER (WHERE bloqueado) AS bloqueados
  FROM clientes;

SELECT 'emisor' AS check, rut, razon_social, serie_actual, ambiente,
       proximo_numero_e_factura, proximo_numero_e_ticket
  FROM cfe_emisor_config;
