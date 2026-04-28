-- =====================================================
-- 005 — WMS extensiones (integración con Comercial)
-- =====================================================
-- Vincula órdenes de WMS con su origen comercial:
--  - wms_ordenes_recepcion ← orden_compra (cuando se
--    confirma una recepción en Compras)
--  - wms_ordenes_picking   ← orden_venta  (cuando se
--    confirma una orden de venta)
-- Crea tabla de configuración del almacén.
-- =====================================================

-- Vínculo a la orden de origen
ALTER TABLE wms_ordenes_recepcion
  ADD COLUMN IF NOT EXISTS orden_compra_id UUID;

ALTER TABLE wms_ordenes_picking
  ADD COLUMN IF NOT EXISTS orden_venta_id UUID;

CREATE INDEX IF NOT EXISTS idx_wms_recep_compra ON wms_ordenes_recepcion (orden_compra_id);
CREATE INDEX IF NOT EXISTS idx_wms_pick_venta   ON wms_ordenes_picking (orden_venta_id);

-- =====================================================
-- Configuración de WMS
-- =====================================================
-- Una sola fila (singleton) o por almacén si más adelante
-- se manejan múltiples. Define umbrales, estrategias y
-- políticas de autorización.
-- =====================================================

CREATE TABLE IF NOT EXISTS wms_configuracion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  almacen_id UUID,

  -- Estrategia de putaway
  -- 'fefo' (first expired, first out) | 'familia' | 'manual' | 'cercano_despacho'
  estrategia_putaway TEXT NOT NULL DEFAULT 'fefo',

  -- Estrategia de picking
  -- 'fefo' | 'fifo' | 'lifo' | 'ruta_optima'
  estrategia_picking TEXT NOT NULL DEFAULT 'fefo',

  -- Alertas
  dias_alerta_vencimiento INT NOT NULL DEFAULT 30,
  dias_alerta_sin_movimiento INT NOT NULL DEFAULT 90,

  -- Autorización para ajustes
  requiere_aprobacion_ajuste BOOLEAN NOT NULL DEFAULT true,
  umbral_ajuste_aprobacion NUMERIC(12,2) NOT NULL DEFAULT 100,

  -- Picking
  permitir_short_pick BOOLEAN NOT NULL DEFAULT false,
  permitir_pick_partial BOOLEAN NOT NULL DEFAULT true,

  -- Auto-creación de órdenes WMS desde Comercial
  autogenerar_recepcion_desde_compra BOOLEAN NOT NULL DEFAULT true,
  autogenerar_picking_desde_venta BOOLEAN NOT NULL DEFAULT true,

  notas TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

-- Asegura una sola fila global de configuración si no se
-- usa multi-almacén
CREATE UNIQUE INDEX IF NOT EXISTS uniq_wms_config_almacen
  ON wms_configuracion (COALESCE(almacen_id::text, 'global'));

-- Insert default config si no existe
INSERT INTO wms_configuracion (estrategia_putaway, estrategia_picking)
SELECT 'fefo', 'fefo'
WHERE NOT EXISTS (SELECT 1 FROM wms_configuracion);
