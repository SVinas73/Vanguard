-- =====================================================================
-- WMS Slotting — tabla de recomendaciones de reubicación
-- =====================================================================
-- El módulo de Slotting calcula recomendaciones ABC (mover productos de alta
-- rotación a zonas premium). Antes esas recomendaciones (aprobar/ejecutar)
-- vivían solo en memoria y se perdían al refrescar. Esta tabla las persiste
-- con su ciclo de vida: pendiente -> aprobada -> ejecutada / rechazada.
--
-- COMO EJECUTAR: pegá en Supabase -> SQL Editor -> Run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS wms_recomendaciones_slotting (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_codigo   text NOT NULL,
  producto_nombre   text,
  ubicacion_origen  text,
  ubicacion_destino text,
  zona_destino      text,
  clasificacion_abc text,                       -- 'A' | 'B' | 'C'
  razon             text,
  ahorro_distancia_m   numeric DEFAULT 0,
  ahorro_tiempo_min    numeric DEFAULT 0,
  estado            text NOT NULL DEFAULT 'pendiente',  -- pendiente|aprobada|ejecutada|rechazada
  aprobado_por      text,
  fecha_aprobacion  timestamptz,
  ejecutado_por     text,
  fecha_ejecucion   timestamptz,
  creado_por        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Una sola recomendación activa (pendiente/aprobada) por producto.
CREATE UNIQUE INDEX IF NOT EXISTS uq_slotting_producto_activo
  ON wms_recomendaciones_slotting (producto_codigo)
  WHERE estado IN ('pendiente', 'aprobada');

CREATE INDEX IF NOT EXISTS ix_slotting_estado
  ON wms_recomendaciones_slotting (estado);

-- RLS: habilitar y permitir a usuarios autenticados (ajustá a tu política).
ALTER TABLE wms_recomendaciones_slotting ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'wms_recomendaciones_slotting'
      AND policyname = 'slotting_auth_all'
  ) THEN
    CREATE POLICY slotting_auth_all ON wms_recomendaciones_slotting
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
