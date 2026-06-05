-- =====================================================
-- Todos los usuarios en la MISMA organización
-- =====================================================
-- Mantiene la separación entre empresas (cada org ve solo lo suyo), pero
-- garantiza que TODOS los usuarios creados hasta ahora pertenezcan a una única
-- organización, que esa sea su organización por defecto, y que las solicitudes
-- existentes queden en esa org (para que no se oculten).
--
-- 1) RLS permisiva en las tablas de organización (la app usa anon key + auth a
--    nivel app, igual que el resto de tablas operativas). Sin esto la app no
--    puede leer la relación usuario↔organización y la "org activa" queda nula.
ALTER TABLE organizaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organizaciones_all ON organizaciones;
CREATE POLICY organizaciones_all ON organizaciones FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE usuario_organizacion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS usuario_org_all ON usuario_organizacion;
CREATE POLICY usuario_org_all ON usuario_organizacion FOR ALL USING (true) WITH CHECK (true);

-- 2) Una sola organización + todos los usuarios dentro + migrar solicitudes.
DO $$
DECLARE org_id UUID;
BEGIN
  -- Org principal: la más antigua existente, o se crea una si no hay ninguna.
  SELECT id INTO org_id FROM organizaciones ORDER BY created_at ASC LIMIT 1;
  IF org_id IS NULL THEN
    INSERT INTO organizaciones (nombre, slug) VALUES ('Ingco', 'ingco') RETURNING id INTO org_id;
  END IF;

  -- Vincular TODOS los usuarios a esa organización (rol admin para que tengan
  -- acceso completo dentro de la empresa).
  INSERT INTO usuario_organizacion (usuario_email, organizacion_id, rol)
  SELECT u.email, org_id, 'admin' FROM users u
  ON CONFLICT (usuario_email, organizacion_id) DO NOTHING;

  -- Que esa org sea la "por defecto" de cada usuario (y ninguna otra).
  UPDATE usuario_organizacion SET es_default = false
  WHERE usuario_email IN (SELECT email FROM users) AND organizacion_id <> org_id;
  UPDATE usuario_organizacion SET es_default = true
  WHERE usuario_email IN (SELECT email FROM users) AND organizacion_id = org_id;

  -- Mover las solicitudes existentes a esa org (para que no queden "sueltas").
  UPDATE solicitudes_insumos SET organizacion_id = org_id
  WHERE organizacion_id IS DISTINCT FROM org_id;
END $$;
