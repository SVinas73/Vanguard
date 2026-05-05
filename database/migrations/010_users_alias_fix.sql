-- =====================================================
-- 010 — HOTFIX: alias usuarios → users + re-aplicar policies
-- =====================================================
-- Tu tabla canónica es `users` (columnas: email, name, role,
-- password) creada por NextAuth. Varios módulos del código
-- usan `usuarios` con columnas en español (rol, nombre,
-- activo). Para que todo conviva sin reescribir 10+ archivos
-- creamos una VISTA `usuarios` que mapea las columnas.
-- También re-aplicamos las policies que dependían de
-- `usuarios` y fallaron en 008/009.
-- =====================================================

-- 1) Vista usuarios con columnas en español
DROP VIEW IF EXISTS usuarios CASCADE;
CREATE VIEW usuarios AS
SELECT
  id,
  email,
  COALESCE(name, email) AS nombre,
  COALESCE(role, 'operador') AS rol,
  COALESCE(activo, true) AS activo,
  created_at,
  updated_at
FROM users;

-- Si la columna `activo` no existe en users, la agregamos
ALTER TABLE users ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

-- Recrear la vista ahora que `activo` seguro existe
DROP VIEW IF EXISTS usuarios CASCADE;
CREATE VIEW usuarios AS
SELECT
  id,
  email,
  COALESCE(name, email) AS nombre,
  COALESCE(role, 'operador') AS rol,
  activo,
  created_at,
  updated_at
FROM users;

-- 2) Re-definir is_admin() apuntando a users (más robusto
--    que depender de la vista)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE email = current_setting('request.jwt.claims', true)::json->>'email'
      AND role = 'admin'
      AND COALESCE(activo, true) = true
  );
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3) Re-aplicar las policies de 009 (fallaron por usuarios)
-- =====================================================

-- Asegurar que las tablas existen (si la 009 falló al medio)
CREATE TABLE IF NOT EXISTS chat_sesiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_email TEXT NOT NULL,
  titulo TEXT,
  resumen TEXT,
  metadata JSONB DEFAULT '{}',
  ultimo_mensaje_at TIMESTAMPTZ,
  archivada BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sesiones_usuario   ON chat_sesiones (usuario_email);
CREATE INDEX IF NOT EXISTS idx_chat_sesiones_actividad ON chat_sesiones (ultimo_mensaje_at DESC);

CREATE TABLE IF NOT EXISTS chat_sesiones_mensajes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_id UUID NOT NULL REFERENCES chat_sesiones(id) ON DELETE CASCADE,
  rol TEXT NOT NULL,
  contenido TEXT NOT NULL,
  tools_used TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_msgs_sesion ON chat_sesiones_mensajes (sesion_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_msgs_rol    ON chat_sesiones_mensajes (rol);

-- Habilitar RLS
ALTER TABLE chat_sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sesiones_mensajes ENABLE ROW LEVEL SECURITY;

-- Policies de chat_sesiones (usando users directamente)
DROP POLICY IF EXISTS chat_sesiones_select ON chat_sesiones;
CREATE POLICY chat_sesiones_select ON chat_sesiones
  FOR SELECT TO authenticated
  USING (
    usuario_email = current_setting('request.jwt.claims', true)::json->>'email'
    OR is_admin()
  );

DROP POLICY IF EXISTS chat_sesiones_insert ON chat_sesiones;
CREATE POLICY chat_sesiones_insert ON chat_sesiones
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS chat_sesiones_update ON chat_sesiones;
CREATE POLICY chat_sesiones_update ON chat_sesiones
  FOR UPDATE TO authenticated
  USING (
    usuario_email = current_setting('request.jwt.claims', true)::json->>'email'
    OR is_admin()
  );

-- Policies de chat_sesiones_mensajes
DROP POLICY IF EXISTS chat_msgs_select ON chat_sesiones_mensajes;
CREATE POLICY chat_msgs_select ON chat_sesiones_mensajes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_sesiones s
      WHERE s.id = chat_sesiones_mensajes.sesion_id
        AND (
          s.usuario_email = current_setting('request.jwt.claims', true)::json->>'email'
          OR is_admin()
        )
    )
  );

DROP POLICY IF EXISTS chat_msgs_insert ON chat_sesiones_mensajes;
CREATE POLICY chat_msgs_insert ON chat_sesiones_mensajes
  FOR INSERT TO authenticated WITH CHECK (true);
