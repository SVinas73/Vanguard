-- =====================================================
-- MIGRATION 016 — Multi-tenant foundation
-- =====================================================
-- Permite que una sola instancia sirva a múltiples empresas
-- (organizaciones) con aislamiento estricto vía RLS.
--
-- ESTRATEGIA NO-BREAKING:
--   * Agrega tabla `organizaciones` + relación usuario↔org
--   * Agrega columna `organizacion_id UUID NULL` a tablas core
--   * Helper `current_organizacion_id()` lee del JWT claim
--   * RLS filtra: si org_id IS NULL → visible para todos (legacy)
--                 si org_id está set → solo visible para esa org
--
-- ROLLOUT GRADUAL:
--   1. Esta migration NO obliga a setear organizacion_id en datos
--      existentes (todos los registros legacy siguen visibles)
--   2. Cuando se cree la primera org y se asigne datos, el RLS
--      automáticamente empieza a filtrar
--   3. Para asignar todos los datos legacy a la primera org:
--      UPDATE productos SET organizacion_id = '<org-id>'
--      WHERE organizacion_id IS NULL;
--      (y replicar en otras tablas)
-- =====================================================

-- =====================================================
-- 1. TABLA DE ORGANIZACIONES
-- =====================================================
CREATE TABLE IF NOT EXISTS organizaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  slug TEXT UNIQUE,                          -- ej: 'acme-corp' para URLs
  rut TEXT,                                  -- identificación fiscal
  pais TEXT DEFAULT 'UY',
  moneda TEXT DEFAULT 'UYU',
  plan TEXT DEFAULT 'starter',               -- starter, business, enterprise
  estado TEXT DEFAULT 'activa',              -- activa, suspendida, baja
  logo_url TEXT,
  config JSONB DEFAULT '{}',                 -- preferencias específicas
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT estado_valido CHECK (estado IN ('activa','suspendida','baja')),
  CONSTRAINT plan_valido CHECK (plan IN ('starter','business','enterprise'))
);

CREATE INDEX IF NOT EXISTS idx_organizaciones_slug ON organizaciones(slug);
CREATE INDEX IF NOT EXISTS idx_organizaciones_estado ON organizaciones(estado);

-- =====================================================
-- 2. RELACIÓN USUARIO ↔ ORGANIZACIÓN (m2n)
-- =====================================================
CREATE TABLE IF NOT EXISTS usuario_organizacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_email TEXT NOT NULL,
  organizacion_id UUID NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  rol TEXT NOT NULL DEFAULT 'miembro',       -- owner, admin, miembro, viewer
  es_default BOOLEAN DEFAULT FALSE,          -- la org por defecto al loguearse
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT rol_valido CHECK (rol IN ('owner','admin','miembro','viewer')),
  UNIQUE (usuario_email, organizacion_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_org_email ON usuario_organizacion(usuario_email);
CREATE INDEX IF NOT EXISTS idx_usuario_org_orgid ON usuario_organizacion(organizacion_id);

-- Solo una organización default por usuario
CREATE UNIQUE INDEX IF NOT EXISTS uniq_usuario_org_default
  ON usuario_organizacion(usuario_email) WHERE es_default = TRUE;

-- =====================================================
-- 3. HELPER: organización actual desde JWT claim
-- =====================================================
-- La app debe setear el claim 'organizacion_id' al loguear.
-- Si no está set, devuelve NULL (registros legacy visibles).
CREATE OR REPLACE FUNCTION current_organizacion_id()
RETURNS UUID
LANGUAGE SQL STABLE
AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::JSONB ->> 'organizacion_id',
    ''
  )::UUID;
$$;

-- =====================================================
-- 4. AGREGAR organizacion_id A TABLAS CORE
-- =====================================================
-- Nullable para no romper datos existentes.
-- IF EXISTS para que no falle si alguna tabla no está creada.

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'productos', 'almacenes', 'clientes', 'proveedores',
    'ordenes_venta', 'ordenes_compra', 'cotizaciones',
    'movimientos', 'lotes', 'productos_seriales',
    'ordenes_taller', 'garantias', 'tickets_soporte', 'rma',
    'rrhh_empleados', 'aprobaciones',
    'notificaciones', 'cuentas_por_cobrar', 'cuentas_por_pagar',
    'facturas_electronicas', 'integraciones',
    'api_keys', 'webhooks_endpoints'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES organizaciones(id) ON DELETE SET NULL',
        t
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_%I_organizacion ON %I(organizacion_id)',
        t, t
      );
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- 5. POLICY HELPER — filtra por organización
-- =====================================================
-- A medida que cada tabla active la policy, automáticamente filtrará.
-- Por ahora dejamos las tablas con sus policies anteriores
-- (visible para todos). Cuando una empresa quiera activar el
-- aislamiento, ejecuta:
--
--   DROP POLICY IF EXISTS <tabla>_select ON <tabla>;
--   CREATE POLICY <tabla>_select ON <tabla>
--     FOR SELECT USING (
--       organizacion_id IS NULL  -- legacy data visible
--       OR organizacion_id = current_organizacion_id()
--       OR current_organizacion_id() IS NULL  -- usuario sin org → ve todo (admin)
--     );
--
-- Esta función envuelve esa lógica para reutilizar:

CREATE OR REPLACE FUNCTION row_belongs_to_current_org(row_org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT
    row_org_id IS NULL
    OR row_org_id = current_organizacion_id()
    OR current_organizacion_id() IS NULL;
$$;

-- =====================================================
-- 6. RLS para tablas de orgs
-- =====================================================
ALTER TABLE organizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_organizacion ENABLE ROW LEVEL SECURITY;

-- Org: usuarios solo ven las orgs a las que pertenecen
DROP POLICY IF EXISTS organizaciones_select ON organizaciones;
CREATE POLICY organizaciones_select ON organizaciones
  FOR SELECT USING (
    id IN (
      SELECT organizacion_id FROM usuario_organizacion
      WHERE usuario_email = current_setting('request.jwt.claims', true)::JSONB ->> 'email'
    )
  );

DROP POLICY IF EXISTS organizaciones_admin ON organizaciones;
CREATE POLICY organizaciones_admin ON organizaciones
  FOR ALL USING (true) WITH CHECK (true);  -- placeholder permisivo durante migración

-- usuario_organizacion: solo veo mis propios links
DROP POLICY IF EXISTS usuario_org_select ON usuario_organizacion;
CREATE POLICY usuario_org_select ON usuario_organizacion
  FOR SELECT USING (
    usuario_email = current_setting('request.jwt.claims', true)::JSONB ->> 'email'
    OR organizacion_id IN (
      SELECT organizacion_id FROM usuario_organizacion uo
      WHERE uo.usuario_email = current_setting('request.jwt.claims', true)::JSONB ->> 'email'
        AND uo.rol IN ('owner','admin')
    )
  );

DROP POLICY IF EXISTS usuario_org_admin ON usuario_organizacion;
CREATE POLICY usuario_org_admin ON usuario_organizacion
  FOR ALL USING (true) WITH CHECK (true);  -- placeholder permisivo

-- =====================================================
-- COMENTARIO FINAL
-- =====================================================
COMMENT ON TABLE organizaciones IS
  'Multi-tenant: cada cliente del SaaS es una organización aislada.';
COMMENT ON TABLE usuario_organizacion IS
  'Link m2n usuario↔org. Un usuario puede pertenecer a varias orgs.';
COMMENT ON FUNCTION current_organizacion_id IS
  'Devuelve la org activa del JWT claim. NULL = sin org (legacy/admin).';
COMMENT ON FUNCTION row_belongs_to_current_org IS
  'Helper de RLS: usar en policies para filtrar por organización.';
