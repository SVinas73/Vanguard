-- =====================================================
-- 004 — Sistema de Notificaciones (event-driven)
-- =====================================================
-- Reemplaza el sistema basado en localStorage por una
-- tabla central que persiste eventos con timestamp,
-- tipo, severidad, scope (global o por usuario) y
-- estado de lectura/descarte por usuario.
-- =====================================================

-- Notificaciones
CREATE TABLE IF NOT EXISTS notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tipo de evento
  tipo TEXT NOT NULL,
  -- Posibles: 'stock_bajo' | 'sin_stock' | 'cotizacion_por_vencer'
  --           'cotizacion_vencida' | 'cxc_vencida' | 'cxp_vencida'
  --           'orden_sin_entregar' | 'sistema'

  severidad TEXT NOT NULL DEFAULT 'info',
  -- 'info' | 'warning' | 'error'

  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,

  -- Vínculo a la entidad que generó la notificación
  entidad_tipo TEXT,
  entidad_id TEXT,
  entidad_codigo TEXT,

  -- Scope: NULL = global (visible para todos),
  --        valor = solo visible para ese usuario
  usuario_email TEXT,

  -- Estado por-usuario (para notifs globales se mantienen
  -- arrays de quién la leyó y quién la descartó)
  leida BOOLEAN NOT NULL DEFAULT false,
  leida_por TEXT[] NOT NULL DEFAULT '{}',
  descartada BOOLEAN NOT NULL DEFAULT false,
  descartada_por TEXT[] NOT NULL DEFAULT '{}',

  -- Idempotencia: clave única para evitar duplicar
  -- la misma notificación al re-escanear (ej:
  -- "stock_bajo:PROD-001" → solo una por entidad+tipo
  -- mientras la condición persista; cuando se cierra,
  -- se descarta y se permite generar una nueva más
  -- adelante con otro dedup_key si vuelve a ocurrir)
  dedup_key TEXT UNIQUE,

  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resuelta_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notif_created       ON notificaciones (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_usuario       ON notificaciones (usuario_email);
CREATE INDEX IF NOT EXISTS idx_notif_tipo_estado   ON notificaciones (tipo, descartada);
CREATE INDEX IF NOT EXISTS idx_notif_entidad       ON notificaciones (entidad_tipo, entidad_id);
CREATE INDEX IF NOT EXISTS idx_notif_dedup         ON notificaciones (dedup_key);

-- =====================================================
-- vendedor_email en ordenes_venta
-- =====================================================
-- Permite atribuir comisiones al vendedor real (no al
-- usuario que cargó la orden). Si está NULL se cae al
-- valor de creado_por para retro-compatibilidad.
-- =====================================================

ALTER TABLE ordenes_venta
  ADD COLUMN IF NOT EXISTS vendedor_email TEXT;

CREATE INDEX IF NOT EXISTS idx_ordenes_venta_vendedor
  ON ordenes_venta (vendedor_email);
