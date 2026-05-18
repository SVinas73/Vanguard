-- =====================================================
-- MIGRATION 019 — Email + Notificaciones de OC
-- =====================================================
-- Habilita:
--   1. Envío de emails (interno + a proveedor) con audit log
--   2. Configuración por organización de destinatarios
--   3. Outbox pattern: si Resend no configurado, los emails
--      quedan registrados como "pendientes" y nunca se pierden.
-- =====================================================

-- ---------------------------------------------------------
-- Tabla: email_outbox
-- Cola de emails con tracking completo. Si la API key de
-- Resend está disponible, intenta enviar y graba el resultado.
-- Si no, queda en estado 'pendiente' para retry futuro.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_outbox (
  id            BIGSERIAL PRIMARY KEY,
  organizacion_id UUID,
  to_emails     TEXT[] NOT NULL,
  cc_emails     TEXT[],
  reply_to      TEXT,
  subject       TEXT NOT NULL,
  body_html     TEXT,
  body_text     TEXT,
  tags          JSONB,
  -- Referencia opcional al objeto que disparó el email
  entidad_tipo  TEXT,  -- 'orden_compra', 'orden_venta', etc.
  entidad_id    TEXT,
  -- Estado y tracking
  estado        TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','enviado','fallido','reintentando')),
  proveedor     TEXT,  -- 'resend', 'smtp', etc.
  proveedor_id  TEXT,  -- ID retornado por el provider (ej: re_xxx)
  intentos      INT NOT NULL DEFAULT 0,
  ultimo_error  TEXT,
  enviado_at    TIMESTAMPTZ,
  -- Audit
  creado_por    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_estado ON email_outbox(estado) WHERE estado IN ('pendiente','reintentando');
CREATE INDEX IF NOT EXISTS idx_email_outbox_entidad ON email_outbox(entidad_tipo, entidad_id);
CREATE INDEX IF NOT EXISTS idx_email_outbox_org ON email_outbox(organizacion_id, created_at DESC);

-- ---------------------------------------------------------
-- Tabla: org_notification_recipients
-- Por organización + tipo de evento, qué emails internos
-- reciben notificación. Editable desde /integraciones.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_notification_recipients (
  id              BIGSERIAL PRIMARY KEY,
  organizacion_id UUID NOT NULL,
  evento          TEXT NOT NULL,  -- 'orden_compra_creada', 'orden_venta_creada', etc.
  emails          TEXT[] NOT NULL DEFAULT '{}',
  enviar_email    BOOLEAN NOT NULL DEFAULT TRUE,
  notif_in_app    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organizacion_id, evento)
);

CREATE INDEX IF NOT EXISTS idx_org_notif_recipients_org ON org_notification_recipients(organizacion_id, evento);

-- Trigger para mantener updated_at
CREATE OR REPLACE FUNCTION update_org_notif_recipients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_org_notif_recipients_updated_at ON org_notification_recipients;
CREATE TRIGGER trg_org_notif_recipients_updated_at
  BEFORE UPDATE ON org_notification_recipients
  FOR EACH ROW EXECUTE FUNCTION update_org_notif_recipients_updated_at();

COMMENT ON TABLE email_outbox IS 'Cola de emails enviados. Outbox pattern para no perder mensajes si el provider está down o no configurado.';
COMMENT ON TABLE org_notification_recipients IS 'Configuración por organización y tipo de evento. Editable en /integraciones.';
