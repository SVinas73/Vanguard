-- Chat System Tables

-- Conversaciones
CREATE TABLE IF NOT EXISTS chat_conversaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT,
  tipo TEXT NOT NULL DEFAULT 'directa',
  referencia_id TEXT,
  referencia_codigo TEXT,
  participantes TEXT[] NOT NULL DEFAULT '{}',
  creado_por TEXT NOT NULL,
  activa BOOLEAN NOT NULL DEFAULT true,
  archivada BOOLEAN NOT NULL DEFAULT false,
  ultimo_mensaje_at TIMESTAMPTZ,
  ultimo_mensaje_preview TEXT,
  total_mensajes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_conv_participantes ON chat_conversaciones USING GIN (participantes);
CREATE INDEX IF NOT EXISTS idx_chat_conv_created ON chat_conversaciones (created_at DESC);

-- Mensajes
CREATE TABLE IF NOT EXISTS chat_mensajes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id UUID NOT NULL REFERENCES chat_conversaciones(id) ON DELETE CASCADE,
  autor_email TEXT NOT NULL,
  autor_nombre TEXT,
  contenido TEXT NOT NULL,
  menciones TEXT[] DEFAULT '{}',
  leido_por TEXT[] DEFAULT '{}',
  adjuntos JSONB DEFAULT '[]',
  tipo TEXT NOT NULL DEFAULT 'texto',
  respuesta_a_id UUID REFERENCES chat_mensajes(id),
  editado BOOLEAN NOT NULL DEFAULT false,
  eliminado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  editado_at TIMESTAMPTZ,
  eliminado_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_chat_msg_conv ON chat_mensajes (conversacion_id, created_at DESC);

-- No leídos
CREATE TABLE IF NOT EXISTS chat_no_leidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_email TEXT NOT NULL,
  conversacion_id UUID NOT NULL REFERENCES chat_conversaciones(id) ON DELETE CASCADE,
  cantidad INTEGER NOT NULL DEFAULT 0,
  ultimo_leido_at TIMESTAMPTZ,
  UNIQUE(usuario_email, conversacion_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_no_leidos_user ON chat_no_leidos (usuario_email);

-- Function to mark messages as read
CREATE OR REPLACE FUNCTION marcar_mensajes_leidos(p_conversacion_id UUID, p_usuario_email TEXT)
RETURNS void AS $$
BEGIN
  -- Update unread count
  INSERT INTO chat_no_leidos (usuario_email, conversacion_id, cantidad, ultimo_leido_at)
  VALUES (p_usuario_email, p_conversacion_id, 0, NOW())
  ON CONFLICT (usuario_email, conversacion_id)
  DO UPDATE SET cantidad = 0, ultimo_leido_at = NOW();

  -- Mark messages as read
  UPDATE chat_mensajes
  SET leido_por = array_append(leido_por, p_usuario_email)
  WHERE conversacion_id = p_conversacion_id
    AND NOT (p_usuario_email = ANY(leido_por));
END;
$$ LANGUAGE plpgsql;
