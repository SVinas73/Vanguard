-- =====================================================
-- 012 — Post-venta enterprise: tickets soporte + garantías
-- =====================================================

-- =====================================================
-- 1) TICKETS DE SOPORTE
-- =====================================================
-- Cubre el ciclo post-venta: cliente reporta problema →
-- agente lo trabaja → SLA mide tiempos → resolución.
-- =====================================================

CREATE TABLE IF NOT EXISTS tickets_soporte (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,

  -- Cliente
  cliente_id UUID,
  cliente_nombre TEXT,
  cliente_email TEXT,
  cliente_telefono TEXT,

  -- Tipo / canal
  canal TEXT NOT NULL DEFAULT 'web',
  -- 'web' | 'email' | 'telefono' | 'whatsapp' | 'presencial'
  categoria TEXT,
  -- 'consulta' | 'falla_producto' | 'reclamo' | 'pedido_info'
  -- | 'cambio' | 'devolucion' | 'instalacion' | 'otro'

  asunto TEXT NOT NULL,
  descripcion TEXT,

  -- Vínculo a otros documentos
  orden_venta_id UUID,
  orden_venta_numero TEXT,
  producto_codigo TEXT,
  serial_numero TEXT,
  rma_id UUID,

  -- Estado y prioridad
  estado TEXT NOT NULL DEFAULT 'abierto',
  -- 'abierto' | 'en_progreso' | 'esperando_cliente' | 'esperando_repuesto'
  -- | 'resuelto' | 'cerrado' | 'cancelado'
  prioridad TEXT NOT NULL DEFAULT 'normal',
  -- 'baja' | 'normal' | 'alta' | 'critica'

  -- SLA
  sla_horas INT,
  sla_vencimiento TIMESTAMPTZ,
  sla_breached BOOLEAN NOT NULL DEFAULT false,

  -- Asignación
  asignado_a TEXT,
  asignado_por TEXT,

  -- Resolución
  solucion TEXT,
  satisfaccion INT,  -- CSAT 1-5
  comentario_cliente TEXT,

  -- Trazabilidad
  creado_por TEXT NOT NULL,
  cerrado_por TEXT,
  fecha_apertura  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_primera_respuesta TIMESTAMPTZ,
  fecha_resolucion TIMESTAMPTZ,
  fecha_cierre TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_estado    ON tickets_soporte (estado);
CREATE INDEX IF NOT EXISTS idx_tickets_prioridad ON tickets_soporte (prioridad);
CREATE INDEX IF NOT EXISTS idx_tickets_cliente   ON tickets_soporte (cliente_id);
CREATE INDEX IF NOT EXISTS idx_tickets_asignado  ON tickets_soporte (asignado_a);
CREATE INDEX IF NOT EXISTS idx_tickets_sla       ON tickets_soporte (sla_vencimiento) WHERE estado IN ('abierto','en_progreso');

-- Comentarios / hilo del ticket
CREATE TABLE IF NOT EXISTS tickets_comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets_soporte(id) ON DELETE CASCADE,
  autor TEXT NOT NULL,
  rol TEXT,                  -- 'agente' | 'cliente' | 'sistema'
  contenido TEXT NOT NULL,
  visible_cliente BOOLEAN NOT NULL DEFAULT true,
  adjuntos JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON tickets_comentarios (ticket_id, created_at);

-- Tabla de SLA por categoría/prioridad (configurable)
CREATE TABLE IF NOT EXISTS tickets_sla_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria TEXT NOT NULL,
  prioridad TEXT NOT NULL,
  horas_sla INT NOT NULL,
  activa BOOLEAN NOT NULL DEFAULT true,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (categoria, prioridad)
);

-- Defaults razonables
INSERT INTO tickets_sla_config (categoria, prioridad, horas_sla)
SELECT * FROM (VALUES
  ('falla_producto', 'critica', 4),
  ('falla_producto', 'alta', 12),
  ('falla_producto', 'normal', 48),
  ('falla_producto', 'baja', 120),
  ('reclamo', 'critica', 4),
  ('reclamo', 'alta', 24),
  ('reclamo', 'normal', 72),
  ('reclamo', 'baja', 168),
  ('consulta', 'critica', 8),
  ('consulta', 'alta', 24),
  ('consulta', 'normal', 72),
  ('consulta', 'baja', 168),
  ('cambio', 'normal', 72),
  ('devolucion', 'normal', 72),
  ('instalacion', 'normal', 168),
  ('otro', 'normal', 72)
) AS t(categoria, prioridad, horas_sla)
WHERE NOT EXISTS (
  SELECT 1 FROM tickets_sla_config c
  WHERE c.categoria = t.categoria AND c.prioridad = t.prioridad
);

-- =====================================================
-- 2) GARANTÍAS FORMALES
-- =====================================================
-- Cada producto vendido (o serializado) tiene una garantía
-- con duración, cobertura y vencimiento. Sistema avisa
-- antes del vencimiento (30 días default).
-- =====================================================

CREATE TABLE IF NOT EXISTS garantias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,

  -- Origen
  orden_venta_id UUID,
  orden_venta_numero TEXT,
  cliente_id UUID,
  cliente_nombre TEXT,

  -- Producto cubierto
  producto_codigo TEXT NOT NULL,
  producto_nombre TEXT,
  serial_numero TEXT,
  lote_numero TEXT,
  cantidad NUMERIC(12,3) DEFAULT 1,

  -- Cobertura
  duracion_meses INT NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_vencimiento DATE NOT NULL,

  cobertura TEXT,       -- texto libre describiendo qué cubre
  exclusiones TEXT,     -- qué NO cubre
  condiciones TEXT,

  -- Estado
  estado TEXT NOT NULL DEFAULT 'activa',
  -- 'activa' | 'vencida' | 'reclamada' | 'anulada'

  -- Si se reclama, link al ticket / RMA
  ticket_reclamo_id UUID,
  rma_reclamo_id UUID,
  fecha_reclamo TIMESTAMPTZ,
  motivo_reclamo TEXT,

  -- Trazabilidad
  emitida_por TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_garantias_cliente     ON garantias (cliente_id);
CREATE INDEX IF NOT EXISTS idx_garantias_serial      ON garantias (serial_numero);
CREATE INDEX IF NOT EXISTS idx_garantias_producto    ON garantias (producto_codigo);
CREATE INDEX IF NOT EXISTS idx_garantias_vencimiento ON garantias (fecha_vencimiento) WHERE estado = 'activa';
CREATE INDEX IF NOT EXISTS idx_garantias_estado      ON garantias (estado);

-- =====================================================
-- 3) RLS — los agentes ven todos los tickets, los
-- clientes (en el futuro) verán solo los suyos.
-- =====================================================

ALTER TABLE tickets_soporte ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tickets_select ON tickets_soporte;
CREATE POLICY tickets_select ON tickets_soporte
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS tickets_insert ON tickets_soporte;
CREATE POLICY tickets_insert ON tickets_soporte
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS tickets_update ON tickets_soporte;
CREATE POLICY tickets_update ON tickets_soporte
  FOR UPDATE TO authenticated
  USING (
    is_admin()
    OR asignado_a = current_setting('request.jwt.claims', true)::json->>'email'
    OR creado_por = current_setting('request.jwt.claims', true)::json->>'email'
  );

ALTER TABLE tickets_comentarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ticket_comments_all ON tickets_comentarios;
CREATE POLICY ticket_comments_all ON tickets_comentarios
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE tickets_sla_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sla_select ON tickets_sla_config;
CREATE POLICY sla_select ON tickets_sla_config
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS sla_write ON tickets_sla_config;
CREATE POLICY sla_write ON tickets_sla_config
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

ALTER TABLE garantias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS garantias_select ON garantias;
CREATE POLICY garantias_select ON garantias
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS garantias_insert ON garantias;
CREATE POLICY garantias_insert ON garantias
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS garantias_update ON garantias;
CREATE POLICY garantias_update ON garantias
  FOR UPDATE TO authenticated USING (true);
