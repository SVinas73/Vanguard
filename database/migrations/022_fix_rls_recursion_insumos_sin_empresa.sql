-- =====================================================
-- MIGRATION 022 — Fix RLS recursion + Insumos sin empresa
-- =====================================================
-- Bug crítico en migration 016: la policy `usuario_org_select`
-- referencia a la misma tabla `usuario_organizacion` desde adentro:
--
--   CREATE POLICY usuario_org_select ON usuario_organizacion
--     FOR SELECT USING (
--       usuario_email = ...
--       OR organizacion_id IN (
--         SELECT organizacion_id FROM usuario_organizacion uo  ← RECURSIÓN
--         WHERE uo.usuario_email = ...
--       )
--     );
--
-- Postgres detecta esto y tira:
--   "infinite recursion detected in policy for relation
--    usuario_organizacion"
--
-- Fix: simplificamos a "ves solo tus propias memberships".
-- Admin/owner ven memberships de otros vía endpoint server-side
-- con service_role (que bypasa RLS).
--
-- Además, esta migration permite que las solicitudes_insumos
-- y org_categorias_insumos_routing puedan vivir SIN empresa
-- (organizacion_id NULL = setup global, single-tenant).
-- =====================================================

-- ---------------------------------------------------------
-- 1. FIX: policy sin recursión en usuario_organizacion
-- ---------------------------------------------------------
DROP POLICY IF EXISTS usuario_org_select ON usuario_organizacion;
CREATE POLICY usuario_org_select ON usuario_organizacion
  FOR SELECT USING (
    usuario_email = current_setting('request.jwt.claims', true)::JSONB ->> 'email'
  );

-- Mantener la policy permisiva de admin (sin recursión)
DROP POLICY IF EXISTS usuario_org_admin ON usuario_organizacion;
CREATE POLICY usuario_org_admin ON usuario_organizacion
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------
-- 2. FIX: misma policy en organizaciones (no recursiva)
-- ---------------------------------------------------------
-- La original consultaba usuario_organizacion desde la policy
-- de organizaciones — eso es ok mientras usuario_org_select
-- no tenga recursión, pero confirmamos que es directa.
DROP POLICY IF EXISTS organizaciones_select ON organizaciones;
CREATE POLICY organizaciones_select ON organizaciones
  FOR SELECT USING (
    id IN (
      SELECT organizacion_id FROM usuario_organizacion
      WHERE usuario_email = current_setting('request.jwt.claims', true)::JSONB ->> 'email'
    )
  );

-- ---------------------------------------------------------
-- 3. Permitir Solicitudes de Insumos SIN empresa
-- ---------------------------------------------------------
-- organizacion_id ya es NULLable, pero el unique index del
-- numero asumía un org_id. Lo arreglamos para que funcione
-- con NULL también (global).
DROP INDEX IF EXISTS uq_solicitudes_insumos_numero;
CREATE UNIQUE INDEX IF NOT EXISTS uq_solicitudes_insumos_numero
  ON solicitudes_insumos (COALESCE(organizacion_id, '00000000-0000-0000-0000-000000000000'::uuid), numero);

-- Mismo tratamiento para destinatarios.
-- IMPORTANTE: hay que dropear el CONSTRAINT, no el índice. El índice es
-- el storage del constraint UNIQUE creado por la cláusula
-- `UNIQUE (organizacion_id, categoria)` en migration 021. Dropear el
-- constraint elimina el índice automáticamente.
ALTER TABLE org_categorias_insumos_routing
  DROP CONSTRAINT IF EXISTS org_categorias_insumos_routing_organizacion_id_categoria_key;

ALTER TABLE org_categorias_insumos_routing
  ALTER COLUMN organizacion_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_org_cat_insumos_routing
  ON org_categorias_insumos_routing (COALESCE(organizacion_id, '00000000-0000-0000-0000-000000000000'::uuid), categoria);

COMMENT ON COLUMN solicitudes_insumos.organizacion_id IS
  'NULL = solicitud global (single-tenant). Para multi-tenant, asignar al crear.';
COMMENT ON COLUMN org_categorias_insumos_routing.organizacion_id IS
  'NULL = destinatarios globales (single-tenant). Para multi-tenant, asignar al admin.';
