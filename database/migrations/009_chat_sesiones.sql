-- =====================================================
-- 009 — Memoria de sesión para el Asistente Omnisciente
-- =====================================================
-- Persiste conversaciones del chatbot por usuario para
-- que el asistente recuerde el contexto entre mensajes
-- y entre sesiones del navegador.
-- =====================================================

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

CREATE INDEX IF NOT EXISTS idx_chat_sesiones_usuario  ON chat_sesiones (usuario_email);
CREATE INDEX IF NOT EXISTS idx_chat_sesiones_actividad ON chat_sesiones (ultimo_mensaje_at DESC);

CREATE TABLE IF NOT EXISTS chat_sesiones_mensajes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_id UUID NOT NULL REFERENCES chat_sesiones(id) ON DELETE CASCADE,
  rol TEXT NOT NULL,
  -- 'user' | 'assistant' | 'tool' | 'system'
  contenido TEXT NOT NULL,
  tools_used TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_msgs_sesion ON chat_sesiones_mensajes (sesion_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_msgs_rol    ON chat_sesiones_mensajes (rol);

-- =====================================================
-- RLS — cada usuario solo ve sus propias sesiones,
-- los admins ven todo.
-- =====================================================

ALTER TABLE chat_sesiones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_sesiones_select ON chat_sesiones;
CREATE POLICY chat_sesiones_select ON chat_sesiones
  FOR SELECT TO authenticated
  USING (
    usuario_email = current_setting('request.jwt.claims', true)::json->>'email'
    OR EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.email = current_setting('request.jwt.claims', true)::json->>'email'
        AND u.rol = 'admin' AND u.activo = true
    )
  );

DROP POLICY IF EXISTS chat_sesiones_insert ON chat_sesiones;
CREATE POLICY chat_sesiones_insert ON chat_sesiones
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS chat_sesiones_update ON chat_sesiones;
CREATE POLICY chat_sesiones_update ON chat_sesiones
  FOR UPDATE TO authenticated
  USING (
    usuario_email = current_setting('request.jwt.claims', true)::json->>'email'
    OR EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.email = current_setting('request.jwt.claims', true)::json->>'email'
        AND u.rol = 'admin' AND u.activo = true
    )
  );

ALTER TABLE chat_sesiones_mensajes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_msgs_select ON chat_sesiones_mensajes;
CREATE POLICY chat_msgs_select ON chat_sesiones_mensajes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_sesiones s
      WHERE s.id = chat_sesiones_mensajes.sesion_id
        AND (
          s.usuario_email = current_setting('request.jwt.claims', true)::json->>'email'
          OR EXISTS (
            SELECT 1 FROM usuarios u
            WHERE u.email = current_setting('request.jwt.claims', true)::json->>'email'
              AND u.rol = 'admin' AND u.activo = true
          )
        )
    )
  );

DROP POLICY IF EXISTS chat_msgs_insert ON chat_sesiones_mensajes;
CREATE POLICY chat_msgs_insert ON chat_sesiones_mensajes
  FOR INSERT TO authenticated WITH CHECK (true);
