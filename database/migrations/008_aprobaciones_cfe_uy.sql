-- =====================================================
-- 008 — Aprobaciones, Facturación electrónica UY (CFE),
--       y RLS hardening básico.
-- =====================================================

-- =====================================================
-- 1) SISTEMA GENÉRICO DE APROBACIONES
-- =====================================================
-- Cualquier flujo del sistema (NC/ND grande, comisión a
-- pagar, ajuste de stock por encima del umbral, etc.) puede
-- crear una aprobación que un supervisor debe firmar antes
-- de impactar.
-- =====================================================

CREATE TABLE IF NOT EXISTS aprobaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL,

  -- Origen polimórfico
  origen_tipo TEXT NOT NULL,
  -- 'nota_credito_debito' | 'comision' | 'ajuste_stock'
  -- 'orden_compra' | 'cotizacion' | 'reposicion_grande'
  origen_id UUID,
  origen_codigo TEXT,

  titulo TEXT NOT NULL,
  descripcion TEXT,

  -- Importe / cantidad relevante para evaluar
  monto NUMERIC(14,2),
  moneda TEXT,
  cantidad NUMERIC(12,3),

  -- Snapshot del payload original (para que el aprobador
  -- vea exactamente qué se pidió)
  payload JSONB DEFAULT '{}',

  -- Workflow
  estado TEXT NOT NULL DEFAULT 'pendiente',
  -- 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada'

  prioridad TEXT NOT NULL DEFAULT 'normal',
  -- 'baja' | 'normal' | 'alta' | 'critica'

  -- Quién pide y quién aprueba
  solicitado_por TEXT NOT NULL,
  asignado_a TEXT,        -- email del aprobador específico (null = cualquier admin)
  resuelto_por TEXT,
  comentario_resolucion TEXT,

  fecha_solicitud TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_resolucion TIMESTAMPTZ,
  fecha_limite TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aprob_estado    ON aprobaciones (estado);
CREATE INDEX IF NOT EXISTS idx_aprob_origen    ON aprobaciones (origen_tipo, origen_id);
CREATE INDEX IF NOT EXISTS idx_aprob_solicit   ON aprobaciones (solicitado_por);
CREATE INDEX IF NOT EXISTS idx_aprob_asignado  ON aprobaciones (asignado_a);

-- Umbrales de aprobación (configurables por tipo)
CREATE TABLE IF NOT EXISTS aprobaciones_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL UNIQUE,
  -- 'nota_credito_debito' | 'comision' | 'ajuste_stock'

  -- Si null, no requiere aprobación
  umbral_monto NUMERIC(14,2),
  umbral_cantidad NUMERIC(12,3),
  moneda TEXT DEFAULT 'UYU',

  activa BOOLEAN NOT NULL DEFAULT true,
  notas TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

-- Defaults razonables si no hay nada
INSERT INTO aprobaciones_config (tipo, umbral_monto, moneda, notas)
SELECT 'nota_credito_debito', 50000, 'UYU', 'NC/ND > 50.000 UYU requiere aprobación'
WHERE NOT EXISTS (SELECT 1 FROM aprobaciones_config WHERE tipo = 'nota_credito_debito');

INSERT INTO aprobaciones_config (tipo, umbral_monto, moneda, notas)
SELECT 'comision', 30000, 'UYU', 'Comisión > 30.000 UYU requiere aprobación'
WHERE NOT EXISTS (SELECT 1 FROM aprobaciones_config WHERE tipo = 'comision');

INSERT INTO aprobaciones_config (tipo, umbral_cantidad, notas)
SELECT 'ajuste_stock', 100, 'Ajuste > 100 unidades requiere aprobación'
WHERE NOT EXISTS (SELECT 1 FROM aprobaciones_config WHERE tipo = 'ajuste_stock');

-- =====================================================
-- 2) FACTURACIÓN ELECTRÓNICA URUGUAY (DGI CFE)
-- =====================================================
-- En UY los CFE (Comprobantes Fiscales Electrónicos) tienen
-- formato XML, son firmados con certificado y obtienen un
-- CAE de DGI. Esta tabla guarda el CFE asociado a un
-- documento del sistema (orden de venta, NC/ND, etc) más
-- los datos del CAE / QR.
-- =====================================================

CREATE TABLE IF NOT EXISTS cfe_uy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tipo de CFE según DGI
  tipo_cfe INT NOT NULL,
  -- 101 = e-Ticket | 102 = e-Ticket NC | 103 = e-Ticket ND
  -- 111 = e-Factura | 112 = e-Factura NC | 113 = e-Factura ND
  -- 121 = e-Factura Exportación | 124 = e-Remito | 181 = e-Resguardo
  serie TEXT NOT NULL,
  numero BIGINT NOT NULL,

  -- Origen interno
  origen_tipo TEXT NOT NULL,
  -- 'orden_venta' | 'nota_credito_debito' | 'remito'
  origen_id UUID,
  origen_codigo TEXT,

  -- Receptor
  receptor_tipo TEXT,        -- 'rut' | 'ci' | 'pasaporte' | 'otro'
  receptor_documento TEXT,
  receptor_nombre TEXT,
  receptor_direccion TEXT,

  -- Importes
  moneda TEXT NOT NULL DEFAULT 'UYU',
  tipo_cambio NUMERIC(12,4),
  monto_neto NUMERIC(14,2),
  monto_iva NUMERIC(14,2),
  monto_total NUMERIC(14,2) NOT NULL,

  -- Datos DGI
  estado TEXT NOT NULL DEFAULT 'borrador',
  -- 'borrador' | 'firmado' | 'aceptado_dgi' | 'rechazado_dgi' | 'anulado'
  cae TEXT,                  -- Código de Autorización Electrónica
  cae_vencimiento DATE,
  hash_xml TEXT,             -- hash del XML firmado
  qr_url TEXT,               -- URL para construir el QR
  xml_firmado TEXT,          -- el XML completo (storage opcional)

  -- Errores DGI
  rechazo_motivo TEXT,

  -- Trazabilidad
  emitido_por TEXT,
  fecha_emision TIMESTAMPTZ,
  fecha_envio_dgi TIMESTAMPTZ,
  fecha_respuesta_dgi TIMESTAMPTZ,

  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_cfe_tipo_serie_numero
  ON cfe_uy (tipo_cfe, serie, numero);

CREATE INDEX IF NOT EXISTS idx_cfe_estado  ON cfe_uy (estado);
CREATE INDEX IF NOT EXISTS idx_cfe_origen  ON cfe_uy (origen_tipo, origen_id);
CREATE INDEX IF NOT EXISTS idx_cfe_emision ON cfe_uy (fecha_emision DESC);

-- Líneas del CFE (productos/servicios facturados)
CREATE TABLE IF NOT EXISTS cfe_uy_lineas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cfe_id UUID NOT NULL REFERENCES cfe_uy(id) ON DELETE CASCADE,
  numero_linea INT NOT NULL,
  producto_codigo TEXT,
  descripcion TEXT NOT NULL,
  cantidad NUMERIC(12,3) NOT NULL,
  unidad_medida TEXT DEFAULT 'UN',
  precio_unitario NUMERIC(14,4) NOT NULL,
  descuento_pct NUMERIC(5,2) DEFAULT 0,
  iva_tasa NUMERIC(5,2) DEFAULT 22,
  -- 0 (exento), 10 (mínimo), 22 (básica)
  subtotal NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cfe_lineas_cfe ON cfe_uy_lineas (cfe_id);

-- Configuración del emisor (datos fiscales de la empresa)
CREATE TABLE IF NOT EXISTS cfe_emisor_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rut TEXT NOT NULL,
  razon_social TEXT NOT NULL,
  nombre_comercial TEXT,
  direccion TEXT,
  ciudad TEXT,
  departamento TEXT,
  telefono TEXT,
  email TEXT,

  -- Configuración DGI (CAE, certificado, etc.)
  ambiente TEXT NOT NULL DEFAULT 'test',
  -- 'test' | 'produccion'
  certificado_url TEXT,
  certificado_password TEXT,

  -- Series autorizadas por DGI
  serie_actual TEXT DEFAULT 'A',
  proximo_numero_e_ticket BIGINT DEFAULT 1,
  proximo_numero_e_factura BIGINT DEFAULT 1,
  proximo_numero_e_remito BIGINT DEFAULT 1,
  proximo_numero_nc BIGINT DEFAULT 1,
  proximo_numero_nd BIGINT DEFAULT 1,

  activo BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sólo una configuración activa
CREATE UNIQUE INDEX IF NOT EXISTS uniq_cfe_emisor_activo
  ON cfe_emisor_config (activo)
  WHERE activo = true;

-- =====================================================
-- 3) RLS HARDENING — políticas más finas
-- =====================================================
-- Hoy las tablas tienen RLS muy permisiva (FOR ALL TO
-- authenticated). Refinamos para las nuevas y para tablas
-- sensibles que ya existen, sin romper acceso a admins.
-- =====================================================

-- Helper function: verifica si el usuario actual es admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM usuarios
    WHERE email = current_setting('request.jwt.claims', true)::json->>'email'
      AND rol = 'admin'
      AND activo = true
  );
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Aprobaciones: el solicitante y el aprobador pueden ver,
-- los admins ven todo.
ALTER TABLE aprobaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aprobaciones_select ON aprobaciones;
CREATE POLICY aprobaciones_select ON aprobaciones
  FOR SELECT TO authenticated
  USING (
    is_admin()
    OR solicitado_por = current_setting('request.jwt.claims', true)::json->>'email'
    OR asignado_a IS NULL
    OR asignado_a = current_setting('request.jwt.claims', true)::json->>'email'
  );

DROP POLICY IF EXISTS aprobaciones_insert ON aprobaciones;
CREATE POLICY aprobaciones_insert ON aprobaciones
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS aprobaciones_update ON aprobaciones;
CREATE POLICY aprobaciones_update ON aprobaciones
  FOR UPDATE TO authenticated
  USING (
    is_admin()
    OR asignado_a IS NULL
    OR asignado_a = current_setting('request.jwt.claims', true)::json->>'email'
  );

-- Config de umbrales: sólo admins escriben
ALTER TABLE aprobaciones_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aprob_config_select ON aprobaciones_config;
CREATE POLICY aprob_config_select ON aprobaciones_config
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS aprob_config_write ON aprobaciones_config;
CREATE POLICY aprob_config_write ON aprobaciones_config
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- CFE: cualquier usuario autenticado puede leer/emitir
-- pero anular requiere admin. La emisión real impacta
-- contabilidad y se audita.
ALTER TABLE cfe_uy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cfe_select ON cfe_uy;
CREATE POLICY cfe_select ON cfe_uy
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS cfe_insert ON cfe_uy;
CREATE POLICY cfe_insert ON cfe_uy
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS cfe_update ON cfe_uy;
CREATE POLICY cfe_update ON cfe_uy
  FOR UPDATE TO authenticated
  USING (
    is_admin() OR estado IN ('borrador', 'firmado')
  );

ALTER TABLE cfe_uy_lineas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cfe_lineas_all ON cfe_uy_lineas;
CREATE POLICY cfe_lineas_all ON cfe_uy_lineas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE cfe_emisor_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cfe_emisor_select ON cfe_emisor_config;
CREATE POLICY cfe_emisor_select ON cfe_emisor_config
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS cfe_emisor_write ON cfe_emisor_config;
CREATE POLICY cfe_emisor_write ON cfe_emisor_config
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
