-- =====================================================
-- 007 — WMS enterprise: packing, QC, reposición, cycle count, reportes
-- =====================================================

-- =====================================================
-- 0) TABLAS DE LÍNEAS — recepción y picking
-- =====================================================
-- Estas tablas las usaba el código (Recepcion.tsx, Picking.tsx,
-- wms-bridge.ts) pero nunca se habían creado en una migración.
-- Las definimos acá para que el módulo funcione completo.
-- =====================================================

CREATE TABLE IF NOT EXISTS wms_ordenes_recepcion_lineas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_recepcion_id UUID NOT NULL,

  producto_id UUID,
  producto_codigo TEXT NOT NULL,
  producto_nombre TEXT,

  cantidad_esperada  NUMERIC(12,3) NOT NULL,
  cantidad_recibida  NUMERIC(12,3) NOT NULL DEFAULT 0,
  cantidad_rechazada NUMERIC(12,3) NOT NULL DEFAULT 0,
  unidad_medida TEXT DEFAULT 'UND',

  lote_numero TEXT,
  fecha_vencimiento DATE,

  estado TEXT NOT NULL DEFAULT 'pendiente',
  -- 'pendiente' | 'parcial' | 'completa' | 'con_diferencias'
  putaway_completado BOOLEAN NOT NULL DEFAULT false,

  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recep_lineas_orden  ON wms_ordenes_recepcion_lineas (orden_recepcion_id);
CREATE INDEX IF NOT EXISTS idx_recep_lineas_codigo ON wms_ordenes_recepcion_lineas (producto_codigo);

CREATE TABLE IF NOT EXISTS wms_ordenes_picking_lineas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_picking_id UUID NOT NULL,

  producto_id UUID,
  producto_codigo TEXT NOT NULL,
  producto_nombre TEXT,

  cantidad_solicitada NUMERIC(12,3) NOT NULL,
  cantidad_pickeada   NUMERIC(12,3) NOT NULL DEFAULT 0,
  cantidad_short      NUMERIC(12,3) NOT NULL DEFAULT 0,
  unidad_medida TEXT DEFAULT 'UND',

  ubicacion_id UUID,
  ubicacion_codigo TEXT,

  lote_numero TEXT,
  fecha_vencimiento DATE,

  estado TEXT NOT NULL DEFAULT 'pendiente',
  -- 'pendiente' | 'en_proceso' | 'completada' | 'short_pick' | 'cancelada'

  secuencia INT,

  fecha_picking TIMESTAMPTZ,
  pickeado_por TEXT,
  tiempo_picking_seg INT,

  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pick_lineas_orden     ON wms_ordenes_picking_lineas (orden_picking_id);
CREATE INDEX IF NOT EXISTS idx_pick_lineas_codigo    ON wms_ordenes_picking_lineas (producto_codigo);
CREATE INDEX IF NOT EXISTS idx_pick_lineas_ubicacion ON wms_ordenes_picking_lineas (ubicacion_id);

-- Si las tablas ya existían sin la columna tiempo_picking_seg,
-- la agregamos sin duplicar.
ALTER TABLE wms_ordenes_picking_lineas
  ADD COLUMN IF NOT EXISTS tiempo_picking_seg INT;

-- =====================================================
-- 1) PACKING & OUTBOUND SHIPMENT
-- =====================================================
-- Cuando una orden de picking se completa, los productos
-- pasan a la zona de packing donde se arman bultos
-- ("paquetes"). Cada paquete tiene peso, dimensiones,
-- transportista y un tracking propio.
-- =====================================================

CREATE TABLE IF NOT EXISTS wms_paquetes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL,

  -- Origen
  orden_picking_id UUID,
  orden_venta_id UUID,
  cliente_nombre TEXT,

  -- Datos físicos
  peso_kg NUMERIC(10,2),
  largo_cm NUMERIC(8,2),
  ancho_cm NUMERIC(8,2),
  alto_cm NUMERIC(8,2),

  -- Logística
  transportista TEXT,
  tracking_numero TEXT,
  servicio TEXT, -- 'estandar' | 'express' | 'retiro'

  -- Estado
  estado TEXT NOT NULL DEFAULT 'en_armado',
  -- 'en_armado' | 'cerrado' | 'despachado' | 'entregado' | 'devuelto'

  notas TEXT,

  empaquetado_por TEXT,
  fecha_armado    TIMESTAMPTZ,
  fecha_despacho  TIMESTAMPTZ,
  fecha_entrega   TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wms_paquetes_estado    ON wms_paquetes (estado);
CREATE INDEX IF NOT EXISTS idx_wms_paquetes_orden     ON wms_paquetes (orden_picking_id);
CREATE INDEX IF NOT EXISTS idx_wms_paquetes_tracking  ON wms_paquetes (tracking_numero);

CREATE TABLE IF NOT EXISTS wms_paquetes_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paquete_id UUID NOT NULL REFERENCES wms_paquetes(id) ON DELETE CASCADE,
  producto_codigo TEXT NOT NULL,
  producto_nombre TEXT,
  cantidad NUMERIC(10,3) NOT NULL,
  unidad_medida TEXT DEFAULT 'UND',
  lote_numero TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paquete_items_paquete ON wms_paquetes_items (paquete_id);

-- =====================================================
-- 2) QC POST-RECEPCIÓN — NO CONFORMIDADES
-- =====================================================

CREATE TABLE IF NOT EXISTS wms_no_conformidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL,

  orden_recepcion_id UUID,
  linea_recepcion_id UUID,
  producto_codigo TEXT,
  producto_nombre TEXT,
  cantidad_afectada NUMERIC(10,3),
  lote_numero TEXT,

  -- Tipo y severidad
  tipo TEXT NOT NULL,
  -- 'roto' | 'incompleto' | 'vencido' | 'mal_etiquetado'
  -- 'producto_incorrecto' | 'cantidad_incorrecta' | 'otro'
  severidad TEXT NOT NULL DEFAULT 'media',
  -- 'baja' | 'media' | 'alta' | 'critica'

  -- Acción tomada
  accion TEXT,
  -- 'aceptar' | 'rechazar' | 'cuarentena' | 'devolver_proveedor' | 'aceptar_con_descuento'

  motivo TEXT NOT NULL,
  notas TEXT,
  fotos JSONB DEFAULT '[]',

  estado TEXT NOT NULL DEFAULT 'abierta',
  -- 'abierta' | 'en_revision' | 'cerrada'

  -- Trazabilidad
  reportado_por TEXT,
  resuelto_por TEXT,
  fecha_apertura TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_cierre   TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nc_estado    ON wms_no_conformidades (estado);
CREATE INDEX IF NOT EXISTS idx_nc_recepcion ON wms_no_conformidades (orden_recepcion_id);
CREATE INDEX IF NOT EXISTS idx_nc_severidad ON wms_no_conformidades (severidad);

-- =====================================================
-- 3) REPOSICIÓN AUTOMÁTICA (pick-from-bulk)
-- =====================================================
-- Cuando una ubicación de picking cae bajo su mínimo, se
-- genera una tarea de reposición que mueve stock desde
-- una ubicación de "bulk" / almacenamiento.
-- =====================================================

ALTER TABLE wms_ubicaciones
  ADD COLUMN IF NOT EXISTS cantidad_minima_picking NUMERIC(10,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cantidad_maxima_picking NUMERIC(10,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clase_abc TEXT;
  -- 'A' | 'B' | 'C' (heredada o asignada manualmente)

CREATE TABLE IF NOT EXISTS wms_tareas_reposicion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT,

  producto_codigo TEXT NOT NULL,
  producto_nombre TEXT,

  ubicacion_origen_id UUID,
  ubicacion_origen_codigo TEXT,
  ubicacion_destino_id UUID NOT NULL,
  ubicacion_destino_codigo TEXT,

  cantidad_sugerida NUMERIC(10,3) NOT NULL,
  cantidad_ejecutada NUMERIC(10,3),

  motivo TEXT,
  -- 'bajo_minimo' | 'manual' | 'optimizacion'

  estado TEXT NOT NULL DEFAULT 'pendiente',
  -- 'pendiente' | 'asignada' | 'en_proceso' | 'ejecutada' | 'cancelada'

  prioridad INT DEFAULT 2,

  asignado_a TEXT,
  ejecutado_por TEXT,
  fecha_creacion   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_ejecucion  TIMESTAMPTZ,

  notas TEXT
);

CREATE INDEX IF NOT EXISTS idx_repo_estado   ON wms_tareas_reposicion (estado);
CREATE INDEX IF NOT EXISTS idx_repo_destino  ON wms_tareas_reposicion (ubicacion_destino_id);
CREATE INDEX IF NOT EXISTS idx_repo_producto ON wms_tareas_reposicion (producto_codigo);

-- =====================================================
-- 4) CYCLE COUNTING con frecuencia por clase ABC
-- =====================================================

ALTER TABLE wms_configuracion
  ADD COLUMN IF NOT EXISTS dias_count_clase_a INT NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS dias_count_clase_b INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS dias_count_clase_c INT NOT NULL DEFAULT 180;

ALTER TABLE wms_ubicaciones
  ADD COLUMN IF NOT EXISTS ultima_revision_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proxima_revision_at TIMESTAMPTZ;

-- =====================================================
-- 5) Picking: short total
-- =====================================================

ALTER TABLE wms_ordenes_picking
  ADD COLUMN IF NOT EXISTS unidades_short_total NUMERIC(10,3) DEFAULT 0;
