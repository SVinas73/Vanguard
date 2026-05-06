-- =====================================================
-- 011 — Security hardening enterprise
-- =====================================================
--   • rate_limits: contador para throttling sin Redis
--   • auditoria_v2 / extender auditoria con IP, UA, hash chain
--   • pgcrypto wrappers para PII
--   • gdpr_solicitudes: track de export/delete por GDPR
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- 1) RATE LIMITING
-- =====================================================
-- Modelo simple de "leaky bucket" basado en filas con
-- ventana deslizante. El helper TS borra entradas viejas
-- al chequear y cuenta las que quedan en la ventana.
-- =====================================================

CREATE TABLE IF NOT EXISTS rate_limit_hits (
  id BIGSERIAL PRIMARY KEY,
  bucket TEXT NOT NULL,
  -- ej: "/api/asistente/chat:user@example.com:1.2.3.4"
  ip TEXT,
  usuario_email TEXT,
  ruta TEXT,
  hit_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_bucket_time
  ON rate_limit_hits (bucket, hit_at DESC);

-- Cleanup: borrar hits >24h. Lo correrás cron-style desde
-- el helper o manualmente.
CREATE OR REPLACE FUNCTION rate_limit_cleanup(retention_hours INT DEFAULT 24)
RETURNS BIGINT AS $$
DECLARE
  borrados BIGINT;
BEGIN
  WITH del AS (
    DELETE FROM rate_limit_hits
    WHERE hit_at < NOW() - (retention_hours || ' hours')::INTERVAL
    RETURNING 1
  )
  SELECT COUNT(*) INTO borrados FROM del;
  RETURN borrados;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2) EXTENDER auditoria CON IP/UA/HASH CHAIN
-- =====================================================
-- Si la tabla auditoria ya existe, le agregamos columnas
-- nuevas (idempotente). hash_actual + hash_previo arman
-- una cadena estilo blockchain — si alguien borra/altera
-- una fila, la cadena se rompe y es detectable.
-- =====================================================

CREATE TABLE IF NOT EXISTS auditoria (
  id BIGSERIAL PRIMARY KEY,
  tabla TEXT,
  accion TEXT,
  codigo TEXT,
  datos_anteriores JSONB,
  datos_nuevos JSONB,
  usuario_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE auditoria
  ADD COLUMN IF NOT EXISTS ip TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS request_id TEXT,
  ADD COLUMN IF NOT EXISTS hash_actual TEXT,
  ADD COLUMN IF NOT EXISTS hash_previo TEXT;

CREATE INDEX IF NOT EXISTS idx_auditoria_hash_chain
  ON auditoria (hash_previo);
CREATE INDEX IF NOT EXISTS idx_auditoria_user_time
  ON auditoria (usuario_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_request
  ON auditoria (request_id);

-- =====================================================
-- 3) GDPR — solicitudes de export/delete
-- =====================================================

CREATE TABLE IF NOT EXISTS gdpr_solicitudes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  -- 'export' | 'delete'
  usuario_email TEXT NOT NULL,
  solicitado_por TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  -- 'pendiente' | 'procesada' | 'rechazada'
  motivo TEXT,
  resultado JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  procesado_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_gdpr_email ON gdpr_solicitudes (usuario_email);
CREATE INDEX IF NOT EXISTS idx_gdpr_estado ON gdpr_solicitudes (estado);

-- RLS
ALTER TABLE gdpr_solicitudes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gdpr_select ON gdpr_solicitudes;
CREATE POLICY gdpr_select ON gdpr_solicitudes
  FOR SELECT TO authenticated
  USING (
    usuario_email = current_setting('request.jwt.claims', true)::json->>'email'
    OR is_admin()
  );

DROP POLICY IF EXISTS gdpr_insert ON gdpr_solicitudes;
CREATE POLICY gdpr_insert ON gdpr_solicitudes
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS gdpr_update ON gdpr_solicitudes;
CREATE POLICY gdpr_update ON gdpr_solicitudes
  FOR UPDATE TO authenticated
  USING (is_admin());

-- =====================================================
-- 4) HELPERS pgcrypto para PII
-- =====================================================
-- Función simple para cifrar/descifrar usando una key
-- almacenada en GUC (config). El backend setea la key
-- antes de operar:
--   SELECT set_config('app.pii_key', '<KEY_BASE64>', false);
-- =====================================================

CREATE OR REPLACE FUNCTION pii_encrypt(plaintext TEXT)
RETURNS TEXT AS $$
DECLARE
  k TEXT := current_setting('app.pii_key', true);
BEGIN
  IF plaintext IS NULL OR k IS NULL OR k = '' THEN
    RETURN plaintext;
  END IF;
  RETURN encode(
    encrypt(plaintext::bytea, k::bytea, 'aes'),
    'base64'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION pii_decrypt(ciphertext TEXT)
RETURNS TEXT AS $$
DECLARE
  k TEXT := current_setting('app.pii_key', true);
BEGIN
  IF ciphertext IS NULL OR k IS NULL OR k = '' THEN
    RETURN ciphertext;
  END IF;
  RETURN convert_from(
    decrypt(decode(ciphertext, 'base64'), k::bytea, 'aes'),
    'utf8'
  );
EXCEPTION WHEN OTHERS THEN
  -- Si la columna no estaba cifrada (datos legacy) devolver
  -- el valor original.
  RETURN ciphertext;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Hash determinista para tokens (rate limit, dedup, etc)
CREATE OR REPLACE FUNCTION sha256_hex(input TEXT)
RETURNS TEXT AS $$
  SELECT encode(digest(input, 'sha256'), 'hex');
$$ LANGUAGE SQL IMMUTABLE;
