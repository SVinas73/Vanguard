-- ============================================
-- PREDICTIVE MAINTENANCE (PdM) - Non-Invasive Schema
--
-- This schema adds predictive maintenance capabilities
-- WITHOUT modifying existing tables (ordenes_taller, productos, etc.)
-- All tables are prefixed with pdm_ to avoid collisions.
-- ============================================

-- 1. Equipment Registry
-- Links equipment identity from ordenes_taller by (tipo_equipo, marca, modelo, serie)
-- Aggregates maintenance history across multiple work orders
CREATE TABLE IF NOT EXISTS pdm_equipos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Equipment identity (matched from ordenes_taller)
  tipo_equipo TEXT NOT NULL,                  -- herramienta, vehiculo, maquinaria, etc.
  marca TEXT,
  modelo TEXT,
  serie TEXT,                                  -- Serial number (unique identifier when available)
  matricula TEXT,                              -- License plate for vehicles
  -- Owner
  cliente_id UUID REFERENCES clientes(id),
  cliente_nombre TEXT,
  -- Operational data
  horas_uso_acumuladas NUMERIC DEFAULT 0,      -- Total accumulated operating hours
  km_acumulados NUMERIC DEFAULT 0,             -- Total accumulated km (vehicles)
  fecha_puesta_servicio DATE,                  -- Date first put into service
  fecha_ultimo_service DATE,                   -- Date of last completed service
  -- PdM computed fields (updated by AI service)
  mtbf_horas NUMERIC,                          -- Mean Time Between Failures (hours)
  mtbf_dias NUMERIC,                           -- Mean Time Between Failures (days)
  total_fallas_historicas INTEGER DEFAULT 0,   -- Count of historical failures
  indice_criticidad TEXT DEFAULT 'medio',      -- bajo, medio, alto, critico
  -- Metadata
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by equipment identity
CREATE INDEX IF NOT EXISTS idx_pdm_equipos_identity
  ON pdm_equipos(tipo_equipo, marca, modelo, serie);
CREATE INDEX IF NOT EXISTS idx_pdm_equipos_cliente
  ON pdm_equipos(cliente_id);

-- 2. Maintenance Events
-- Each completed repair/service from ordenes_taller generates an event here
CREATE TABLE IF NOT EXISTS pdm_eventos_mantenimiento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id UUID NOT NULL REFERENCES pdm_equipos(id) ON DELETE CASCADE,
  orden_taller_id UUID,                        -- Reference to ordenes_taller.id (not FK to avoid coupling)
  -- Event classification
  tipo_evento TEXT NOT NULL,                   -- preventivo, correctivo, predictivo, inspeccion
  categoria_falla TEXT,                        -- mecanica, electrica, hidraulica, desgaste, otros
  severidad TEXT DEFAULT 'media',              -- baja, media, alta, critica
  -- Metrics at time of event
  horas_uso_al_evento NUMERIC,                -- Equipment hours at time of failure/service
  km_al_evento NUMERIC,                       -- Km at time of event (vehicles)
  dias_desde_ultimo_service INTEGER,           -- Days since previous service
  -- Repair details
  descripcion_falla TEXT,
  diagnostico TEXT,
  trabajo_realizado TEXT,
  -- Parts consumed (denormalized for ML feature extraction)
  repuestos_json JSONB DEFAULT '[]'::jsonb,   -- [{producto_id, nombre, cantidad, costo}]
  costo_total_repuestos NUMERIC DEFAULT 0,
  costo_mano_obra NUMERIC DEFAULT 0,
  -- Timing
  fecha_evento DATE NOT NULL,
  fecha_inicio_reparacion TIMESTAMPTZ,
  fecha_fin_reparacion TIMESTAMPTZ,
  duracion_reparacion_horas NUMERIC,          -- Downtime in hours
  -- Metadata
  tecnico TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pdm_eventos_equipo
  ON pdm_eventos_mantenimiento(equipo_id, fecha_evento DESC);
CREATE INDEX IF NOT EXISTS idx_pdm_eventos_tipo
  ON pdm_eventos_mantenimiento(tipo_evento);

-- 3. Sensor/Meter Readings (for equipment with hour meters, odometers, etc.)
CREATE TABLE IF NOT EXISTS pdm_lecturas_medidores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id UUID NOT NULL REFERENCES pdm_equipos(id) ON DELETE CASCADE,
  tipo_medidor TEXT NOT NULL,                  -- horometro, odometro, temperatura, vibracion, presion
  valor NUMERIC NOT NULL,
  unidad TEXT,                                 -- horas, km, °C, mm/s, bar
  fecha_lectura TIMESTAMPTZ DEFAULT NOW(),
  registrado_por TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pdm_lecturas_equipo
  ON pdm_lecturas_medidores(equipo_id, fecha_lectura DESC);

-- 4. AI Predictions (written by the Python AI service)
CREATE TABLE IF NOT EXISTS pdm_predicciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id UUID NOT NULL REFERENCES pdm_equipos(id) ON DELETE CASCADE,
  -- Prediction results
  probabilidad_fallo NUMERIC NOT NULL,        -- 0.0 to 1.0 (probability of failure)
  ttf_dias NUMERIC,                            -- Time To Failure in days
  ttf_horas NUMERIC,                           -- Time To Failure in operating hours
  nivel_riesgo TEXT NOT NULL,                  -- verde, amarillo, rojo
  -- Confidence & model info
  confianza_modelo NUMERIC,                    -- 0.0 to 1.0
  modelo_usado TEXT,                           -- survival_analysis, xgboost, ensemble
  version_modelo TEXT,
  -- Suggested actions
  accion_recomendada TEXT,                     -- Recommended maintenance action
  repuestos_sugeridos JSONB DEFAULT '[]'::jsonb, -- [{producto_id, nombre, cantidad_sugerida, motivo}]
  proxima_fecha_service DATE,                  -- Suggested next service date
  -- Validity
  fecha_prediccion TIMESTAMPTZ DEFAULT NOW(),
  valida_hasta TIMESTAMPTZ,                    -- Prediction expiry
  activa BOOLEAN DEFAULT true,                 -- Only latest prediction per equipo is active
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pdm_predicciones_equipo
  ON pdm_predicciones(equipo_id, activa, fecha_prediccion DESC);
CREATE INDEX IF NOT EXISTS idx_pdm_predicciones_riesgo
  ON pdm_predicciones(nivel_riesgo, activa);

-- 5. PdM Alerts (notifications for workshop managers)
CREATE TABLE IF NOT EXISTS pdm_alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id UUID NOT NULL REFERENCES pdm_equipos(id) ON DELETE CASCADE,
  prediccion_id UUID REFERENCES pdm_predicciones(id),
  -- Alert content
  tipo_alerta TEXT NOT NULL,                   -- fallo_inminente, service_programado, desgaste_acelerado, anomalia
  nivel TEXT NOT NULL,                         -- info, warning, critical
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  -- Action tracking
  leida BOOLEAN DEFAULT false,
  accion_tomada TEXT,
  resuelta BOOLEAN DEFAULT false,
  resuelta_por TEXT,
  fecha_resolucion TIMESTAMPTZ,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pdm_alertas_pendientes
  ON pdm_alertas(leida, resuelta, created_at DESC);

-- 6. Scheduled Maintenance Plans (generated from predictions)
CREATE TABLE IF NOT EXISTS pdm_planes_mantenimiento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id UUID NOT NULL REFERENCES pdm_equipos(id) ON DELETE CASCADE,
  -- Plan details
  tipo TEXT NOT NULL,                          -- preventivo, predictivo
  descripcion TEXT NOT NULL,
  frecuencia_dias INTEGER,                     -- Repeat every N days
  frecuencia_horas NUMERIC,                    -- Or every N operating hours
  -- Next execution
  proxima_ejecucion DATE,
  -- Parts needed
  repuestos_planificados JSONB DEFAULT '[]'::jsonb,
  costo_estimado NUMERIC,
  -- Status
  activo BOOLEAN DEFAULT true,
  ultima_ejecucion DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pdm_planes_proxima
  ON pdm_planes_mantenimiento(proxima_ejecucion, activo);

-- ============================================
-- HELPER VIEW: Equipment Dashboard Summary
-- Joins latest prediction with equipment info
-- ============================================
CREATE OR REPLACE VIEW pdm_dashboard_equipos AS
SELECT
  e.id AS equipo_id,
  e.tipo_equipo,
  e.marca,
  e.modelo,
  e.serie,
  e.matricula,
  e.cliente_nombre,
  e.horas_uso_acumuladas,
  e.km_acumulados,
  e.fecha_ultimo_service,
  e.mtbf_dias,
  e.total_fallas_historicas,
  e.indice_criticidad,
  -- Latest prediction
  p.probabilidad_fallo,
  p.ttf_dias,
  p.ttf_horas,
  p.nivel_riesgo,
  p.confianza_modelo,
  p.accion_recomendada,
  p.repuestos_sugeridos,
  p.proxima_fecha_service,
  p.fecha_prediccion,
  -- Computed
  CASE
    WHEN p.nivel_riesgo = 'rojo' THEN 1
    WHEN p.nivel_riesgo = 'amarillo' THEN 2
    ELSE 3
  END AS orden_urgencia,
  -- Unresolved alerts count
  (SELECT COUNT(*) FROM pdm_alertas a
   WHERE a.equipo_id = e.id AND a.resuelta = false) AS alertas_pendientes
FROM pdm_equipos e
LEFT JOIN pdm_predicciones p ON p.equipo_id = e.id AND p.activa = true
WHERE e.activo = true
ORDER BY orden_urgencia ASC, p.probabilidad_fallo DESC NULLS LAST;

-- ============================================
-- FUNCTION: Sync equipment from ordenes_taller
-- Call this periodically to discover new equipment
-- ============================================
CREATE OR REPLACE FUNCTION pdm_sync_equipos_from_taller()
RETURNS INTEGER AS $$
DECLARE
  synced INTEGER := 0;
BEGIN
  -- Insert new equipment that doesn't exist yet
  INSERT INTO pdm_equipos (tipo_equipo, marca, modelo, serie, matricula, cliente_id, cliente_nombre)
  SELECT DISTINCT ON (ot.tipo_equipo, ot.marca, ot.modelo, ot.serie)
    ot.tipo_equipo,
    ot.marca,
    ot.modelo,
    ot.serie,
    ot.matricula,
    ot.cliente_id,
    ot.cliente_nombre
  FROM ordenes_taller ot
  WHERE NOT EXISTS (
    SELECT 1 FROM pdm_equipos pe
    WHERE pe.tipo_equipo = ot.tipo_equipo
      AND COALESCE(pe.marca, '') = COALESCE(ot.marca, '')
      AND COALESCE(pe.modelo, '') = COALESCE(ot.modelo, '')
      AND COALESCE(pe.serie, '') = COALESCE(ot.serie, '')
  )
  AND ot.tipo_equipo IS NOT NULL;

  GET DIAGNOSTICS synced = ROW_COUNT;

  -- Update last service date from latest completed orders
  UPDATE pdm_equipos pe
  SET fecha_ultimo_service = sub.max_fecha,
      updated_at = NOW()
  FROM (
    SELECT DISTINCT ON (ot.tipo_equipo, ot.marca, ot.modelo, ot.serie)
      ot.tipo_equipo, ot.marca, ot.modelo, ot.serie,
      MAX(ot.fecha_fin_reparacion) AS max_fecha
    FROM ordenes_taller ot
    WHERE ot.estado IN ('reparado', 'facturado', 'listo_entrega', 'entregado')
      AND ot.fecha_fin_reparacion IS NOT NULL
    GROUP BY ot.tipo_equipo, ot.marca, ot.modelo, ot.serie
  ) sub
  WHERE pe.tipo_equipo = sub.tipo_equipo
    AND COALESCE(pe.marca, '') = COALESCE(sub.marca, '')
    AND COALESCE(pe.modelo, '') = COALESCE(sub.modelo, '')
    AND COALESCE(pe.serie, '') = COALESCE(sub.serie, '');

  -- Update total failures count
  UPDATE pdm_equipos pe
  SET total_fallas_historicas = sub.cnt,
      updated_at = NOW()
  FROM (
    SELECT equipo_id, COUNT(*) AS cnt
    FROM pdm_eventos_mantenimiento
    WHERE tipo_evento = 'correctivo'
    GROUP BY equipo_id
  ) sub
  WHERE pe.id = sub.equipo_id;

  RETURN synced;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RLS Policies (Row Level Security)
-- ============================================
ALTER TABLE pdm_equipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdm_eventos_mantenimiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdm_lecturas_medidores ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdm_predicciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdm_alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdm_planes_mantenimiento ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (same as existing tables)
CREATE POLICY "pdm_equipos_all" ON pdm_equipos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "pdm_eventos_all" ON pdm_eventos_mantenimiento FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "pdm_lecturas_all" ON pdm_lecturas_medidores FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "pdm_predicciones_all" ON pdm_predicciones FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "pdm_alertas_all" ON pdm_alertas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "pdm_planes_all" ON pdm_planes_mantenimiento FOR ALL TO authenticated USING (true) WITH CHECK (true);
