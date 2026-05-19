-- =====================================================
-- MIGRATION 021 — Solicitudes de Insumos (compras internas)
-- =====================================================
-- Para empresas que NO venden los productos que compran:
-- compras de uso interno (papelería, herramientas, ferretería,
-- estaciones de servicio, etc.).
--
-- Diferencia con Órdenes de Compra:
--   - OC = compra de mercadería para reventa, va a proveedor
--   - Solicitud de insumo = pedido interno de un colaborador,
--     un gestor decide cómo resolverlo (stock existente o
--     compra nueva).
--
-- Flujo:
--   pendiente → en_gestion → comprada → recibida → cerrada
--   En cualquier momento puede ser 'cancelada' (con motivo).
--
-- Routing por categoría:
--   Por organización + categoría se configura quiénes
--   gestionan (gestor_emails) y quiénes son referentes
--   (referente_emails, copia informativa).
-- =====================================================

-- ---------------------------------------------------------
-- solicitudes_insumos
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS solicitudes_insumos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          TEXT NOT NULL,
  organizacion_id UUID,

  -- Categoría libre (papeleria, ferreteria, edintor, estacion_servicio, otros, ...)
  -- Se valida contra org_categorias_insumos_routing al crear, pero NO con FK
  -- (para que el admin pueda agregar categorías dinámicamente).
  categoria       TEXT NOT NULL,

  -- Quién la solicitó
  solicitado_por  TEXT NOT NULL,  -- email del usuario

  -- Fechas
  fecha_solicitud TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_limite    DATE,  -- Manual: cuándo lo necesita el solicitante
  fecha_ingreso   DATE,  -- Cuándo efectivamente entró al stock (setea el gestor)

  -- Estado
  estado          TEXT NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente','en_gestion','comprada','recibida','cerrada','cancelada')),
  estado_motivo   TEXT,  -- Por qué se canceló / cualquier nota de estado

  -- Quién está gestionando (se asigna al pasar a en_gestion)
  gestor_asignado TEXT,

  -- Observaciones libres
  observaciones   TEXT,

  -- Si terminó en una OC, link opcional
  orden_compra_id UUID,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_insumos_org ON solicitudes_insumos(organizacion_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_solicitudes_insumos_estado ON solicitudes_insumos(estado) WHERE estado NOT IN ('cerrada','cancelada');
CREATE INDEX IF NOT EXISTS idx_solicitudes_insumos_solicitante ON solicitudes_insumos(solicitado_por);
CREATE INDEX IF NOT EXISTS idx_solicitudes_insumos_categoria ON solicitudes_insumos(organizacion_id, categoria);
CREATE UNIQUE INDEX IF NOT EXISTS uq_solicitudes_insumos_numero ON solicitudes_insumos(organizacion_id, numero);

-- ---------------------------------------------------------
-- solicitudes_insumos_items
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS solicitudes_insumos_items (
  id              BIGSERIAL PRIMARY KEY,
  solicitud_id    UUID NOT NULL REFERENCES solicitudes_insumos(id) ON DELETE CASCADE,
  -- Puede referenciar un producto existente o ser texto libre
  -- (insumos no estandarizados que el gestor convertirá en producto al comprar)
  producto_codigo TEXT,
  descripcion     TEXT NOT NULL,
  cantidad        NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
  unidad          TEXT DEFAULT 'unidad',
  observaciones   TEXT,
  -- Cuando llega: cuánto efectivamente se recibió
  cantidad_recibida NUMERIC(12,3),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_insumos_items_sol ON solicitudes_insumos_items(solicitud_id);

-- ---------------------------------------------------------
-- org_categorias_insumos_routing
-- Define quién gestiona cada categoría. Editable en UI.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_categorias_insumos_routing (
  id              BIGSERIAL PRIMARY KEY,
  organizacion_id UUID NOT NULL,
  categoria       TEXT NOT NULL,
  categoria_label TEXT,  -- Display: "Papelería", "Ferretería", etc.
  gestor_emails   TEXT[] NOT NULL DEFAULT '{}',     -- Decide la compra
  referente_emails TEXT[] NOT NULL DEFAULT '{}',    -- Copia informativa (CC)
  activa          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organizacion_id, categoria)
);

CREATE INDEX IF NOT EXISTS idx_org_cat_insumos_routing_org ON org_categorias_insumos_routing(organizacion_id) WHERE activa = TRUE;

-- ---------------------------------------------------------
-- Trigger: updated_at
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION update_solicitudes_insumos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_solicitudes_insumos_updated_at ON solicitudes_insumos;
CREATE TRIGGER trg_solicitudes_insumos_updated_at
  BEFORE UPDATE ON solicitudes_insumos
  FOR EACH ROW EXECUTE FUNCTION update_solicitudes_insumos_updated_at();

DROP TRIGGER IF EXISTS trg_org_cat_insumos_routing_updated_at ON org_categorias_insumos_routing;
CREATE TRIGGER trg_org_cat_insumos_routing_updated_at
  BEFORE UPDATE ON org_categorias_insumos_routing
  FOR EACH ROW EXECUTE FUNCTION update_solicitudes_insumos_updated_at();

-- ---------------------------------------------------------
-- Seed: categorías default sugeridas (sin emails, las
-- completa el admin en la UI de routing)
-- ---------------------------------------------------------
COMMENT ON TABLE solicitudes_insumos IS 'Solicitudes internas de insumos (no son ventas ni OC a proveedor). Para empresas con consumo interno.';
COMMENT ON TABLE org_categorias_insumos_routing IS 'Por organización y categoría, qué emails gestionan y qué emails reciben copia. Editable en /integraciones.';
