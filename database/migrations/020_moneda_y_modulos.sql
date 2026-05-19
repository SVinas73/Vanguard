-- =====================================================
-- MIGRATION 020 — Moneda por producto, tipos de cambio
-- y módulos habilitados por organización (modo Lite/Full)
-- =====================================================
-- Objetivo:
--   1. Cada producto registra la moneda con la que se ingresó.
--   2. Tabla `tipos_cambio` para conversión inteligente en
--      reportes, dashboards y análisis.
--   3. La organización puede elegir qué módulos ver
--      (preset 'lite' o 'full', o lista custom).
-- =====================================================

-- =====================================================
-- 1. MONEDA POR PRODUCTO
-- =====================================================
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'UYU';

ALTER TABLE productos
  ADD CONSTRAINT productos_moneda_check
  CHECK (moneda IN ('USD','UYU','EUR','BRL','ARS'));

CREATE INDEX IF NOT EXISTS idx_productos_moneda ON productos(moneda);

COMMENT ON COLUMN productos.moneda IS
  'Moneda en la que se ingresó el precio y costo del producto. Los reportes convierten según tipos_cambio.';

-- También sobre movimientos (costo de compra puede venir en otra moneda
-- que la del producto, ej: compra en USD para producto en UYU)
ALTER TABLE movimientos
  ADD COLUMN IF NOT EXISTS moneda_costo TEXT;

ALTER TABLE movimientos
  ADD CONSTRAINT movimientos_moneda_check
  CHECK (moneda_costo IS NULL OR moneda_costo IN ('USD','UYU','EUR','BRL','ARS'));

-- Lotes idem
ALTER TABLE lotes
  ADD COLUMN IF NOT EXISTS moneda TEXT;

ALTER TABLE lotes
  ADD CONSTRAINT lotes_moneda_check
  CHECK (moneda IS NULL OR moneda IN ('USD','UYU','EUR','BRL','ARS'));

-- =====================================================
-- 2. TIPOS DE CAMBIO
-- =====================================================
CREATE TABLE IF NOT EXISTS tipos_cambio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id UUID REFERENCES organizaciones(id) ON DELETE CASCADE,
  moneda_origen TEXT NOT NULL,
  moneda_destino TEXT NOT NULL,
  tasa NUMERIC(18,6) NOT NULL CHECK (tasa > 0),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  fuente TEXT DEFAULT 'manual',         -- 'manual' | 'bcu' | 'dolarapi'
  notas TEXT,
  creado_por TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT tc_moneda_origen_valida CHECK (moneda_origen IN ('USD','UYU','EUR','BRL','ARS')),
  CONSTRAINT tc_moneda_destino_valida CHECK (moneda_destino IN ('USD','UYU','EUR','BRL','ARS')),
  CONSTRAINT tc_no_misma CHECK (moneda_origen <> moneda_destino),
  UNIQUE (organizacion_id, moneda_origen, moneda_destino, fecha)
);

CREATE INDEX IF NOT EXISTS idx_tc_org_fecha
  ON tipos_cambio(organizacion_id, fecha DESC);

COMMENT ON TABLE tipos_cambio IS
  'Cotizaciones cargadas por la organización. Se usa la más reciente <= fecha consultada.';

-- Helper: obtener tasa vigente entre dos monedas a una fecha dada.
-- Devuelve 1.0 si moneda_origen = moneda_destino.
-- Devuelve NULL si no hay cotización (la app decide qué hacer).
CREATE OR REPLACE FUNCTION fx_rate(
  p_org UUID,
  p_origen TEXT,
  p_destino TEXT,
  p_fecha DATE DEFAULT CURRENT_DATE
) RETURNS NUMERIC
LANGUAGE SQL STABLE
AS $$
  SELECT CASE
    WHEN p_origen = p_destino THEN 1.0::NUMERIC
    ELSE (
      SELECT tasa
      FROM tipos_cambio
      WHERE organizacion_id = p_org
        AND moneda_origen = p_origen
        AND moneda_destino = p_destino
        AND fecha <= p_fecha
      ORDER BY fecha DESC
      LIMIT 1
    )
  END;
$$;

-- =====================================================
-- 3. MÓDULOS HABILITADOS POR ORGANIZACIÓN
-- =====================================================
-- Usamos organizaciones.config (JSONB ya existente).
-- Estructura esperada en config:
--   {
--     "enabled_modules": ["dashboard","stock","movimientos","reportes","facturacion","ayuda"],
--     "preset": "lite" | "full" | "custom",
--     "display_currency": "UYU"   -- moneda preferida para reportes/dashboard
--   }
-- Si no está seteado → preset 'full' (compat con instalaciones existentes).

-- Helper para leer módulos habilitados
CREATE OR REPLACE FUNCTION enabled_modules(p_org UUID)
RETURNS TEXT[]
LANGUAGE SQL STABLE
AS $$
  SELECT COALESCE(
    (config -> 'enabled_modules')::JSONB::TEXT[]::TEXT[],
    NULL
  )
  FROM organizaciones WHERE id = p_org;
$$;

-- =====================================================
-- 4. SEED: organización DEMO vacía
-- =====================================================
-- Útil para presentaciones / pruebas sin datos del trabajo.
-- Se crea sólo si no existe.
INSERT INTO organizaciones (nombre, slug, pais, moneda, plan, config)
SELECT
  'Demo PYME',
  'demo-pyme',
  'UY',
  'UYU',
  'starter',
  jsonb_build_object(
    'enabled_modules', jsonb_build_array(
      'dashboard','stock','movimientos','reportes','facturacion','ayuda','configuracion'
    ),
    'preset', 'lite',
    'display_currency', 'UYU'
  )
WHERE NOT EXISTS (SELECT 1 FROM organizaciones WHERE slug = 'demo-pyme');

-- NOTA: para asociar tu usuario a la org demo (reemplazar tu email):
--   INSERT INTO usuario_organizacion (usuario_email, organizacion_id, rol, es_default)
--   SELECT 'TU_EMAIL@dominio.com', id, 'owner', FALSE
--   FROM organizaciones WHERE slug = 'demo-pyme'
--   ON CONFLICT DO NOTHING;
