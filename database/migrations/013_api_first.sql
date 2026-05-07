-- =====================================================
-- 013 — API-First: API Keys + Logs + Webhooks
-- =====================================================
-- Capa de integración para terceros: API REST versionada
-- (/api/v1/*) protegida por API keys con scopes, log de
-- requests, sistema de webhooks con retries.
-- =====================================================

-- =====================================================
-- 1) API KEYS
-- =====================================================
-- Cada API key tiene un hash (no guardamos la key en
-- claro; solo el prefijo visible al usuario). Scopes
-- limitan qué endpoints puede llamar.
-- =====================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  prefix TEXT NOT NULL UNIQUE,        -- ej: 'ak_live_8f2'
  hash TEXT NOT NULL UNIQUE,          -- sha256(key completa)
  ultimo_uso_at TIMESTAMPTZ,
  ultimo_uso_ip TEXT,

  -- Scopes (whitelist de permisos)
  scopes TEXT[] NOT NULL DEFAULT '{}',
  -- ej: {'productos:read','clientes:read','ordenes:write','webhooks:manage'}

  -- Limites
  rate_limit_por_minuto INT DEFAULT 120,

  -- Estado
  activa BOOLEAN NOT NULL DEFAULT true,
  expira_en TIMESTAMPTZ,
  revocada_at TIMESTAMPTZ,
  revocada_motivo TEXT,

  creada_por TEXT NOT NULL,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys (prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash   ON api_keys (hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_activa ON api_keys (activa) WHERE activa = true;

-- =====================================================
-- 2) API REQUEST LOG
-- =====================================================
-- Cada request a /api/v1/* se loguea. Útil para auditoría,
-- debugging del cliente y métricas.
-- =====================================================

CREATE TABLE IF NOT EXISTS api_logs (
  id BIGSERIAL PRIMARY KEY,
  api_key_id UUID,
  api_key_prefix TEXT,
  metodo TEXT NOT NULL,           -- GET | POST | PUT | DELETE
  ruta TEXT NOT NULL,
  status INT,
  duracion_ms INT,
  ip TEXT,
  user_agent TEXT,
  request_body JSONB,
  response_summary TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_logs_key_time ON api_logs (api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_status   ON api_logs (status);
CREATE INDEX IF NOT EXISTS idx_api_logs_ruta     ON api_logs (ruta);

-- =====================================================
-- 3) WEBHOOKS
-- =====================================================
-- Endpoints externos que reciben eventos del sistema.
-- Cada webhook tiene un secret para HMAC y se suscribe a
-- N eventos. Las entregas se loguean con retries.
-- =====================================================

CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,              -- usado para firmar payload (X-Vanguard-Signature)

  -- Eventos suscritos
  eventos TEXT[] NOT NULL DEFAULT '{}',
  -- ej: {'orden_venta.creada','ticket.abierto','garantia.vencida'}

  activo BOOLEAN NOT NULL DEFAULT true,
  ultimo_envio_at TIMESTAMPTZ,
  ultimo_status INT,
  fallos_consecutivos INT NOT NULL DEFAULT 0,
  -- Si fallos_consecutivos > 10 se desactiva automáticamente.

  headers_extra JSONB DEFAULT '{}',  -- headers personalizados (auth Bearer, etc)
  creado_por TEXT NOT NULL,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_activo  ON webhooks (activo) WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_webhooks_eventos ON webhooks USING GIN (eventos);

-- =====================================================
-- 4) WEBHOOK DELIVERIES
-- =====================================================
-- Log de cada intento de entrega: éxitos y fallos con
-- payload + respuesta + reintentos.
-- =====================================================

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  evento TEXT NOT NULL,
  payload JSONB NOT NULL,

  -- Resultado del último intento
  status INT,
  response_body TEXT,
  response_headers JSONB,
  error TEXT,

  -- Retry policy
  intentos INT NOT NULL DEFAULT 0,
  proximo_reintento_at TIMESTAMPTZ,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  -- 'pendiente' | 'enviado' | 'fallido' | 'descartado'

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enviado_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliv_webhook ON webhook_deliveries (webhook_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliv_pending ON webhook_deliveries (estado, proximo_reintento_at)
  WHERE estado = 'pendiente';
CREATE INDEX IF NOT EXISTS idx_webhook_deliv_evento  ON webhook_deliveries (evento);

-- =====================================================
-- 5) RLS — solo admins gestionan keys y webhooks
-- =====================================================

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS api_keys_admin ON api_keys;
CREATE POLICY api_keys_admin ON api_keys
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

ALTER TABLE api_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS api_logs_select ON api_logs;
CREATE POLICY api_logs_select ON api_logs
  FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS api_logs_insert ON api_logs;
CREATE POLICY api_logs_insert ON api_logs
  FOR INSERT TO authenticated WITH CHECK (true);

ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS webhooks_admin ON webhooks;
CREATE POLICY webhooks_admin ON webhooks
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS webhook_deliveries_select ON webhook_deliveries;
CREATE POLICY webhook_deliveries_select ON webhook_deliveries
  FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS webhook_deliveries_insert ON webhook_deliveries;
CREATE POLICY webhook_deliveries_insert ON webhook_deliveries
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS webhook_deliveries_update ON webhook_deliveries;
CREATE POLICY webhook_deliveries_update ON webhook_deliveries
  FOR UPDATE TO authenticated USING (true);
