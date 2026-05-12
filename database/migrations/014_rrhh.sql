-- =====================================================
-- MIGRATION 014 — Recursos Humanos (RRHH)
-- =====================================================
-- Empleados, asistencia, solicitudes de licencias/vacaciones.
-- Pensado para integrarse opcionalmente con la tabla `users`
-- (un empleado puede tener acceso al sistema o no).
-- =====================================================

-- =====================================================
-- 1. EMPLEADOS
-- =====================================================
CREATE TABLE IF NOT EXISTS rrhh_empleados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legajo TEXT UNIQUE,                       -- código interno
  user_email TEXT,                           -- opcional, link al login
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  dni TEXT,                                  -- documento
  fecha_nacimiento DATE,
  email_personal TEXT,
  telefono TEXT,
  direccion TEXT,
  ciudad TEXT,

  -- Datos laborales
  cargo TEXT NOT NULL,
  area TEXT NOT NULL,                        -- ventas, bodega, taller, admin, etc
  fecha_ingreso DATE NOT NULL,
  fecha_egreso DATE,
  tipo_contrato TEXT DEFAULT 'efectivo',     -- efectivo, temporal, pasantia, freelance
  jornada TEXT DEFAULT 'full',               -- full, part, turno_rotativo
  sueldo_base NUMERIC(14,2),
  moneda TEXT DEFAULT 'UYU',

  -- Estado y meta
  estado TEXT NOT NULL DEFAULT 'activo',     -- activo, licencia, suspendido, baja
  foto_url TEXT,
  notas TEXT,

  -- Auditoría
  creado_por TEXT,
  creado_at TIMESTAMPTZ DEFAULT NOW(),
  actualizado_por TEXT,
  actualizado_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT estado_valido CHECK (estado IN ('activo','licencia','suspendido','baja')),
  CONSTRAINT tipo_contrato_valido CHECK (tipo_contrato IN ('efectivo','temporal','pasantia','freelance')),
  CONSTRAINT jornada_valida CHECK (jornada IN ('full','part','turno_rotativo'))
);

CREATE INDEX IF NOT EXISTS idx_rrhh_empleados_estado ON rrhh_empleados(estado);
CREATE INDEX IF NOT EXISTS idx_rrhh_empleados_area   ON rrhh_empleados(area);
CREATE INDEX IF NOT EXISTS idx_rrhh_empleados_email  ON rrhh_empleados(user_email);
CREATE INDEX IF NOT EXISTS idx_rrhh_empleados_active ON rrhh_empleados(deleted_at) WHERE deleted_at IS NULL;

-- =====================================================
-- 2. ASISTENCIA — fichadas de entrada/salida
-- =====================================================
CREATE TABLE IF NOT EXISTS rrhh_asistencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id UUID NOT NULL REFERENCES rrhh_empleados(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  hora_entrada TIMESTAMPTZ,
  hora_salida TIMESTAMPTZ,
  minutos_trabajados INT,                    -- calculado al cerrar la jornada
  observaciones TEXT,
  origen TEXT DEFAULT 'manual',              -- manual, biometrico, app, web
  creado_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (empleado_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_rrhh_asistencia_empleado_fecha ON rrhh_asistencia(empleado_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_rrhh_asistencia_fecha ON rrhh_asistencia(fecha DESC);

-- =====================================================
-- 3. SOLICITUDES — vacaciones, licencias, días personales
-- =====================================================
CREATE TABLE IF NOT EXISTS rrhh_solicitudes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id UUID NOT NULL REFERENCES rrhh_empleados(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,                        -- vacaciones, licencia_medica, personal, estudio, otro
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  dias_solicitados INT NOT NULL,
  motivo TEXT,
  adjunto_url TEXT,                          -- certificado médico, etc

  estado TEXT NOT NULL DEFAULT 'pendiente',  -- pendiente, aprobada, rechazada, cancelada
  aprobado_por TEXT,
  fecha_aprobacion TIMESTAMPTZ,
  observaciones_aprobacion TEXT,

  creado_por TEXT,
  creado_at TIMESTAMPTZ DEFAULT NOW(),
  actualizado_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT tipo_valido CHECK (tipo IN ('vacaciones','licencia_medica','personal','estudio','otro')),
  CONSTRAINT estado_solicitud_valido CHECK (estado IN ('pendiente','aprobada','rechazada','cancelada')),
  CONSTRAINT rango_valido CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_rrhh_solicitudes_empleado ON rrhh_solicitudes(empleado_id);
CREATE INDEX IF NOT EXISTS idx_rrhh_solicitudes_estado ON rrhh_solicitudes(estado);
CREATE INDEX IF NOT EXISTS idx_rrhh_solicitudes_rango ON rrhh_solicitudes(fecha_inicio, fecha_fin);

-- =====================================================
-- 4. VISTAS ÚTILES
-- =====================================================

-- Empleados activos con conteo de solicitudes pendientes
CREATE OR REPLACE VIEW rrhh_empleados_resumen AS
SELECT
  e.*,
  COALESCE((SELECT COUNT(*) FROM rrhh_solicitudes s
            WHERE s.empleado_id = e.id AND s.estado = 'pendiente'), 0) AS solicitudes_pendientes,
  COALESCE((SELECT MAX(a.hora_entrada) FROM rrhh_asistencia a
            WHERE a.empleado_id = e.id), NULL) AS ultima_entrada
FROM rrhh_empleados e
WHERE e.deleted_at IS NULL;

-- =====================================================
-- 5. RLS (todos los empleados visibles para admin / rrhh)
-- =====================================================
ALTER TABLE rrhh_empleados   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rrhh_asistencia  ENABLE ROW LEVEL SECURITY;
ALTER TABLE rrhh_solicitudes ENABLE ROW LEVEL SECURITY;

-- Política permisiva para authenticated; el filtrado fino lo hace la app
DROP POLICY IF EXISTS rrhh_empleados_authenticated ON rrhh_empleados;
CREATE POLICY rrhh_empleados_authenticated ON rrhh_empleados
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS rrhh_asistencia_authenticated ON rrhh_asistencia;
CREATE POLICY rrhh_asistencia_authenticated ON rrhh_asistencia
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS rrhh_solicitudes_authenticated ON rrhh_solicitudes;
CREATE POLICY rrhh_solicitudes_authenticated ON rrhh_solicitudes
  FOR ALL USING (true) WITH CHECK (true);
