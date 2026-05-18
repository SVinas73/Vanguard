-- =====================================================
-- MIGRATION 017 — Security hardening: rate limit cleanup
-- =====================================================
-- La tabla rate_limit_hits crece sin límites si no se purga.
-- Esto:
--   1. Borra registros mayores a 7 días (función + cron)
--   2. Agrega índice por hit_at para que la purga sea barata
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_hit_at
  ON rate_limit_hits (hit_at);

CREATE OR REPLACE FUNCTION cleanup_rate_limit_hits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM rate_limit_hits
  WHERE hit_at < NOW() - INTERVAL '7 days';
END;
$$;

-- Para activarlo automáticamente, instalar pg_cron en Supabase y correr:
--   SELECT cron.schedule('rate-limit-cleanup', '0 3 * * *', 'SELECT cleanup_rate_limit_hits()');
-- Si pg_cron no está disponible, llamar manualmente:
--   SELECT cleanup_rate_limit_hits();
