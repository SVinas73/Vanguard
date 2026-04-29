-- =====================================================
-- 006 — Reservas de stock unificadas + persistencia WMS
-- =====================================================
-- Tabla central para reservas de stock. La consume Taller
-- (cuando se crea una cotización con repuestos) y WMS
-- (cuando se confirma una venta y se genera picking).
--
-- Estados:
--   reservado → la unidad existe pero está apartada
--   consumido → la unidad fue despachada (stock real bajó)
--   liberado  → la reserva se canceló (stock vuelve a libre)
-- =====================================================

CREATE TABLE IF NOT EXISTS reservas_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  producto_codigo TEXT,
  producto_id UUID,
  cantidad NUMERIC(12,3) NOT NULL,

  estado TEXT NOT NULL DEFAULT 'reservado',
  -- 'reservado' | 'consumido' | 'liberado'

  -- Origen polimórfico
  origen_tipo TEXT NOT NULL,
  -- 'orden_taller' | 'cotizacion_taller'
  -- 'cotizacion_venta' | 'orden_venta_picking'
  -- 'manual'
  origen_id UUID,
  origen_codigo TEXT,

  motivo TEXT,
  notas TEXT,

  creado_por TEXT,
  cerrada_por TEXT,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cerrada_at  TIMESTAMPTZ
);

-- Si la tabla ya existía con otro schema, agregamos lo que falte
ALTER TABLE reservas_stock
  ADD COLUMN IF NOT EXISTS producto_codigo TEXT,
  ADD COLUMN IF NOT EXISTS origen_tipo TEXT,
  ADD COLUMN IF NOT EXISTS origen_id UUID,
  ADD COLUMN IF NOT EXISTS origen_codigo TEXT,
  ADD COLUMN IF NOT EXISTS motivo TEXT,
  ADD COLUMN IF NOT EXISTS notas TEXT,
  ADD COLUMN IF NOT EXISTS creado_por TEXT,
  ADD COLUMN IF NOT EXISTS cerrada_por TEXT,
  ADD COLUMN IF NOT EXISTS cerrada_at TIMESTAMPTZ;

-- Si existía con orden_taller_id (legacy) la dejamos para
-- retro-compat — los nuevos registros usan origen_tipo + origen_id.
-- Backfill suave de origen_tipo/origen_id desde la columna vieja.
UPDATE reservas_stock
SET origen_tipo = 'orden_taller',
    origen_id   = orden_taller_id::uuid
WHERE origen_tipo IS NULL
  AND COALESCE(orden_taller_id::text, '') <> '';

-- Cuando estado pasa a consumido o liberado, marcamos el cierre
-- (los flujos lo hacen explícito desde TS, este trigger es por
-- si algún update directo deja estado inconsistente)
CREATE OR REPLACE FUNCTION reservas_stock_set_cerrada_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado IN ('consumido', 'liberado') AND OLD.estado = 'reservado' THEN
    NEW.cerrada_at := COALESCE(NEW.cerrada_at, NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reservas_stock_cerrada ON reservas_stock;
CREATE TRIGGER reservas_stock_cerrada
  BEFORE UPDATE ON reservas_stock
  FOR EACH ROW
  EXECUTE FUNCTION reservas_stock_set_cerrada_at();

CREATE INDEX IF NOT EXISTS idx_reservas_producto_codigo  ON reservas_stock (producto_codigo);
CREATE INDEX IF NOT EXISTS idx_reservas_estado           ON reservas_stock (estado);
CREATE INDEX IF NOT EXISTS idx_reservas_origen           ON reservas_stock (origen_tipo, origen_id);
CREATE INDEX IF NOT EXISTS idx_reservas_creado_por       ON reservas_stock (creado_por);

-- =====================================================
-- productos.stock_reservado (cache opcional)
-- =====================================================
-- Si la columna ya existe se preserva. Es una caché del
-- total de reservas activas — el helper TS la mantiene al día.
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS stock_reservado NUMERIC(12,3) NOT NULL DEFAULT 0;
