-- =====================================================
-- MIGRATION 018 — TOTP 2FA for sensitive admin actions
-- =====================================================
-- Agrega campos para Time-based One-Time Password (RFC 6238)
-- a la tabla `users`. Compatible con Google Authenticator,
-- Authy, 1Password, etc.
--
-- USO:
--   1. Admin llama /api/auth/2fa/enroll → genera secret + QR
--   2. Admin escanea QR con su app TOTP
--   3. Admin envía código de 6 dígitos a /api/auth/2fa/verify
--   4. Sistema graba totp_secret + totp_enrolled_at
--   5. A partir de ahora, GDPR export/delete sobre OTROS
--      usuarios requiere header x-totp-code válido
-- =====================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS totp_secret TEXT,
  ADD COLUMN IF NOT EXISTS totp_enrolled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS totp_backup_codes TEXT[];

COMMENT ON COLUMN users.totp_secret IS 'Base32 TOTP secret. NULL = 2FA no activado.';
COMMENT ON COLUMN users.totp_enrolled_at IS 'Cuándo se completó el enrollment de 2FA.';
COMMENT ON COLUMN users.totp_backup_codes IS 'Códigos de backup (hash). Cada uso los marca como gastados.';

CREATE INDEX IF NOT EXISTS idx_users_totp_enrolled
  ON users (email) WHERE totp_enrolled_at IS NOT NULL;
