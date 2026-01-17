-- =====================================================
-- FASE 1: TRAZABILIDAD Y SERIALIZACIÓN
-- Migración: 001_traceability_serialization.sql
-- Descripción: Sistema completo de trazabilidad, serialización, RMA y BOM
-- =====================================================

-- =====================================================
-- 1. SERIALIZACIÓN DE PRODUCTOS
-- =====================================================

-- Tabla de números de serie individuales
CREATE TABLE IF NOT EXISTS productos_seriales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_codigo VARCHAR(50) NOT NULL REFERENCES productos(codigo) ON DELETE CASCADE,
    numero_serie VARCHAR(100) NOT NULL UNIQUE,

    -- Estado del serial
    estado VARCHAR(20) NOT NULL DEFAULT 'disponible',
    -- Estados: disponible, reservado, vendido, en_reparacion, defectuoso, en_transito, dado_de_baja

    -- Ubicación actual
    almacen_id UUID REFERENCES almacenes(id),
    ubicacion VARCHAR(100), -- Pasillo-Rack-Nivel-Posición

    -- Información de compra
    lote_id UUID REFERENCES lotes(id),
    proveedor_id UUID REFERENCES proveedores(id),
    orden_compra_id UUID REFERENCES ordenes_compra(id),
    fecha_recepcion TIMESTAMP,
    costo_adquisicion DECIMAL(15,2),

    -- Información de venta
    cliente_id UUID REFERENCES clientes(id),
    orden_venta_id UUID REFERENCES ordenes_venta(id),
    fecha_venta TIMESTAMP,
    precio_venta DECIMAL(15,2),

    -- Garantía y soporte
    fecha_garantia_inicio TIMESTAMP,
    fecha_garantia_fin TIMESTAMP,
    periodo_garantia_meses INTEGER,

    -- Metadatos adicionales
    atributos JSONB DEFAULT '{}', -- {color, talla, versión, etc}
    notas TEXT,

    -- Auditoría
    creado_por VARCHAR(255),
    actualizado_por VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT valid_estado CHECK (estado IN (
        'disponible', 'reservado', 'vendido', 'en_reparacion',
        'defectuoso', 'en_transito', 'dado_de_baja', 'en_rma'
    ))
);

CREATE INDEX idx_productos_seriales_codigo ON productos_seriales(producto_codigo);
CREATE INDEX idx_productos_seriales_numero_serie ON productos_seriales(numero_serie);
CREATE INDEX idx_productos_seriales_estado ON productos_seriales(estado);
CREATE INDEX idx_productos_seriales_almacen ON productos_seriales(almacen_id);
CREATE INDEX idx_productos_seriales_lote ON productos_seriales(lote_id);

-- =====================================================
-- 2. TRAZABILIDAD END-TO-END
-- =====================================================

-- Registro completo de eventos de trazabilidad
CREATE TABLE IF NOT EXISTS trazabilidad (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identificación (puede ser serial O lote)
    producto_codigo VARCHAR(50) NOT NULL REFERENCES productos(codigo),
    serial_id UUID REFERENCES productos_seriales(id),
    lote_id UUID REFERENCES lotes(id),

    -- Tipo de evento
    tipo_evento VARCHAR(50) NOT NULL,
    -- Eventos: RECEPCION, INSPECCION_QC, ALMACENAMIENTO, PICKING, PACKING,
    --          ENVIO, ENTREGA, DEVOLUCION, ENSAMBLAJE, DESENSAMBLAJE,
    --          TRANSFERENCIA, AJUSTE, BAJA, CAMBIO_ESTADO

    -- Detalles del evento
    descripcion TEXT,
    resultado VARCHAR(20), -- EXITOSO, FALLIDO, PENDIENTE, EN_PROCESO

    -- Ubicación y movimiento
    almacen_origen_id UUID REFERENCES almacenes(id),
    almacen_destino_id UUID REFERENCES almacenes(id),
    ubicacion_origen VARCHAR(100),
    ubicacion_destino VARCHAR(100),

    -- Cantidades (para lotes)
    cantidad DECIMAL(15,3),
    unidad_medida VARCHAR(20),

    -- Referencias a documentos
    documento_tipo VARCHAR(50), -- ORDEN_COMPRA, ORDEN_VENTA, TRANSFERENCIA, RMA, etc
    documento_id UUID,
    documento_numero VARCHAR(50),

    -- Entidades relacionadas
    proveedor_id UUID REFERENCES proveedores(id),
    cliente_id UUID REFERENCES clientes(id),
    transportista VARCHAR(100),
    numero_tracking VARCHAR(100),

    -- Calidad y condiciones
    temperatura DECIMAL(5,2), -- Para productos sensibles
    humedad DECIMAL(5,2),
    condiciones_especiales JSONB,

    -- Responsables
    usuario_responsable VARCHAR(255),
    operador_fisico VARCHAR(255), -- Persona que ejecutó físicamente
    supervisor VARCHAR(255),

    -- Tiempo
    fecha_hora TIMESTAMP NOT NULL DEFAULT NOW(),
    fecha_programada TIMESTAMP,
    duracion_minutos INTEGER,

    -- Datos adicionales
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_trazabilidad_producto ON trazabilidad(producto_codigo);
CREATE INDEX idx_trazabilidad_serial ON trazabilidad(serial_id);
CREATE INDEX idx_trazabilidad_lote ON trazabilidad(lote_id);
CREATE INDEX idx_trazabilidad_fecha ON trazabilidad(fecha_hora);
CREATE INDEX idx_trazabilidad_tipo ON trazabilidad(tipo_evento);
CREATE INDEX idx_trazabilidad_documento ON trazabilidad(documento_tipo, documento_id);

-- =====================================================
-- 3. GESTIÓN DE DEVOLUCIONES (RMA - Return Merchandise Authorization)
-- =====================================================

CREATE TABLE IF NOT EXISTS rma (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero VARCHAR(50) NOT NULL UNIQUE,

    -- Cliente y venta original
    cliente_id UUID NOT NULL REFERENCES clientes(id),
    orden_venta_id UUID REFERENCES ordenes_venta(id),
    orden_venta_numero VARCHAR(50),

    -- Estado del RMA
    estado VARCHAR(20) NOT NULL DEFAULT 'solicitada',
    -- Estados: solicitada, aprobada, rechazada, en_transito, recibida,
    --          inspeccionada, procesada, completada, cancelada

    -- Tipo de devolución
    tipo VARCHAR(20) NOT NULL,
    -- Tipos: garantia, defecto, error_envio, no_conforme, otro

    -- Motivo y resolución
    motivo TEXT NOT NULL,
    resolucion_esperada VARCHAR(30), -- reemplazo, reembolso, credito, reparacion
    resolucion_final VARCHAR(30),

    -- Información de envío
    direccion_recogida TEXT,
    transportista VARCHAR(100),
    numero_tracking VARCHAR(100),
    fecha_envio_cliente TIMESTAMP,
    fecha_recepcion_almacen TIMESTAMP,

    -- Inspección
    inspeccionado_por VARCHAR(255),
    fecha_inspeccion TIMESTAMP,
    resultado_inspeccion VARCHAR(20), -- aprobado, rechazado, parcial
    notas_inspeccion TEXT,

    -- Financiero
    valor_productos DECIMAL(15,2),
    costo_envio DECIMAL(15,2),
    monto_reembolso DECIMAL(15,2),
    monto_credito DECIMAL(15,2),

    -- Almacén destino para productos devueltos
    almacen_id UUID REFERENCES almacenes(id),

    -- Fechas importantes
    fecha_solicitud TIMESTAMP NOT NULL DEFAULT NOW(),
    fecha_aprobacion TIMESTAMP,
    fecha_limite_devolucion TIMESTAMP,
    fecha_completado TIMESTAMP,

    -- Responsables
    solicitado_por VARCHAR(255),
    aprobado_por VARCHAR(255),
    procesado_por VARCHAR(255),

    -- Notas
    notas TEXT,
    notas_internas TEXT,

    -- Auditoría
    creado_por VARCHAR(255),
    actualizado_por VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT valid_rma_estado CHECK (estado IN (
        'solicitada', 'aprobada', 'rechazada', 'en_transito', 'recibida',
        'inspeccionada', 'procesada', 'completada', 'cancelada'
    )),
    CONSTRAINT valid_rma_tipo CHECK (tipo IN (
        'garantia', 'defecto', 'error_envio', 'no_conforme', 'otro'
    ))
);

CREATE INDEX idx_rma_numero ON rma(numero);
CREATE INDEX idx_rma_cliente ON rma(cliente_id);
CREATE INDEX idx_rma_estado ON rma(estado);
CREATE INDEX idx_rma_fecha_solicitud ON rma(fecha_solicitud);

-- Items individuales del RMA
CREATE TABLE IF NOT EXISTS rma_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rma_id UUID NOT NULL REFERENCES rma(id) ON DELETE CASCADE,

    -- Producto
    producto_codigo VARCHAR(50) NOT NULL REFERENCES productos(codigo),
    producto_descripcion VARCHAR(255),
    serial_id UUID REFERENCES productos_seriales(id),
    lote_id UUID REFERENCES lotes(id),

    -- Cantidades
    cantidad_solicitada DECIMAL(15,3) NOT NULL,
    cantidad_aprobada DECIMAL(15,3),
    cantidad_recibida DECIMAL(15,3),
    cantidad_aceptada DECIMAL(15,3), -- Después de inspección
    unidad_medida VARCHAR(20),

    -- Motivo específico del item
    motivo_devolucion TEXT,
    defecto_reportado TEXT,

    -- Inspección
    condicion_recibida VARCHAR(20), -- nuevo, usado_bueno, usado_malo, defectuoso, dañado
    defecto_confirmado BOOLEAN,
    notas_inspeccion TEXT,

    -- Acción tomada
    accion VARCHAR(30), -- devolver_stock, reparar, desechar, reemplazo, credito
    almacen_destino_id UUID REFERENCES almacenes(id),
    ubicacion_destino VARCHAR(100),

    -- Financiero
    precio_unitario_original DECIMAL(15,2),
    valor_total DECIMAL(15,2),
    monto_reembolso DECIMAL(15,2),

    -- Metadatos
    imagenes_evidencia JSONB, -- URLs de fotos
    metadata JSONB DEFAULT '{}',
    notas TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rma_items_rma ON rma_items(rma_id);
CREATE INDEX idx_rma_items_producto ON rma_items(producto_codigo);
CREATE INDEX idx_rma_items_serial ON rma_items(serial_id);

-- =====================================================
-- 4. BILL OF MATERIALS (BOM) - Lista de Materiales
-- =====================================================

-- Cabecera de BOM (productos que tienen componentes)
CREATE TABLE IF NOT EXISTS bom (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Producto final (ensamblado)
    producto_codigo VARCHAR(50) NOT NULL REFERENCES productos(codigo) ON DELETE CASCADE,

    -- Versión del BOM
    version VARCHAR(20) NOT NULL DEFAULT '1.0',
    nombre VARCHAR(255),
    descripcion TEXT,

    -- Estado
    estado VARCHAR(20) NOT NULL DEFAULT 'borrador',
    -- Estados: borrador, activo, obsoleto, revision

    -- Tipo de BOM
    tipo VARCHAR(20) NOT NULL DEFAULT 'produccion',
    -- Tipos: produccion, ingenieria, venta, servicio

    -- Cantidades base
    cantidad_base DECIMAL(15,3) DEFAULT 1, -- Cantidad del producto final
    unidad_base VARCHAR(20),

    -- Costos
    costo_materiales DECIMAL(15,2),
    costo_mano_obra DECIMAL(15,2),
    costo_overhead DECIMAL(15,2),
    costo_total DECIMAL(15,2),

    -- Tiempo de ensamblaje
    tiempo_setup_minutos INTEGER,
    tiempo_ensamblaje_minutos INTEGER,

    -- Control
    requiere_aprobacion BOOLEAN DEFAULT false,
    aprobado_por VARCHAR(255),
    fecha_aprobacion TIMESTAMP,

    -- Validez
    fecha_inicio_vigencia TIMESTAMP,
    fecha_fin_vigencia TIMESTAMP,

    -- Metadatos
    notas TEXT,
    instrucciones_ensamblaje TEXT,
    diagramas JSONB, -- URLs de diagramas/planos

    -- Auditoría
    es_principal BOOLEAN DEFAULT true, -- BOM activo para el producto
    creado_por VARCHAR(255),
    actualizado_por VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT valid_bom_estado CHECK (estado IN ('borrador', 'activo', 'obsoleto', 'revision')),
    CONSTRAINT valid_bom_tipo CHECK (tipo IN ('produccion', 'ingenieria', 'venta', 'servicio')),
    CONSTRAINT unique_bom_producto_version UNIQUE(producto_codigo, version)
);

CREATE INDEX idx_bom_producto ON bom(producto_codigo);
CREATE INDEX idx_bom_estado ON bom(estado);
CREATE INDEX idx_bom_version ON bom(version);

-- Items/Componentes del BOM
CREATE TABLE IF NOT EXISTS bom_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id UUID NOT NULL REFERENCES bom(id) ON DELETE CASCADE,

    -- Componente
    componente_codigo VARCHAR(50) NOT NULL REFERENCES productos(codigo),
    componente_descripcion VARCHAR(255),

    -- Cantidad requerida
    cantidad DECIMAL(15,3) NOT NULL,
    unidad_medida VARCHAR(20),
    cantidad_desperdicio DECIMAL(15,3) DEFAULT 0, -- Scrap/waste esperado

    -- Secuencia de ensamblaje
    secuencia INTEGER,
    nivel INTEGER DEFAULT 1, -- Para BOMs multinivel
    es_critico BOOLEAN DEFAULT false, -- Componente crítico que no puede faltar

    -- Alternativas
    componente_alternativo_codigo VARCHAR(50) REFERENCES productos(codigo),
    puede_sustituir BOOLEAN DEFAULT false,

    -- Costos
    costo_unitario DECIMAL(15,2),
    costo_total DECIMAL(15,2),

    -- Referencia
    referencia VARCHAR(100), -- Referencia en plano/diagrama
    posicion VARCHAR(50),

    -- Notas
    notas TEXT,
    instrucciones TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bom_items_bom ON bom_items(bom_id);
CREATE INDEX idx_bom_items_componente ON bom_items(componente_codigo);
CREATE INDEX idx_bom_items_secuencia ON bom_items(bom_id, secuencia);

-- =====================================================
-- 5. ENSAMBLAJES - Registro de productos ensamblados
-- =====================================================

CREATE TABLE IF NOT EXISTS ensamblajes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero VARCHAR(50) NOT NULL UNIQUE,

    -- BOM utilizado
    bom_id UUID NOT NULL REFERENCES bom(id),
    producto_codigo VARCHAR(50) NOT NULL REFERENCES productos(codigo),
    producto_descripcion VARCHAR(255),

    -- Tipo de operación
    tipo VARCHAR(20) NOT NULL DEFAULT 'ensamblaje',
    -- Tipos: ensamblaje, desensamblaje

    -- Cantidades
    cantidad_planificada DECIMAL(15,3) NOT NULL,
    cantidad_producida DECIMAL(15,3),
    cantidad_aprobada DECIMAL(15,3),
    cantidad_rechazada DECIMAL(15,3),
    unidad_medida VARCHAR(20),

    -- Estado
    estado VARCHAR(20) NOT NULL DEFAULT 'planificado',
    -- Estados: planificado, en_proceso, completado, cancelado, pausado

    -- Ubicación
    almacen_id UUID NOT NULL REFERENCES almacenes(id),
    ubicacion_trabajo VARCHAR(100), -- Área de ensamblaje
    ubicacion_destino VARCHAR(100), -- Donde se almacenarán los productos terminados

    -- Tiempos
    fecha_planificada TIMESTAMP,
    fecha_inicio TIMESTAMP,
    fecha_fin TIMESTAMP,
    duracion_real_minutos INTEGER,

    -- Responsables
    supervisor VARCHAR(255),
    operadores JSONB, -- Array de operadores que participaron

    -- Control de calidad
    requiere_inspeccion BOOLEAN DEFAULT true,
    inspeccionado_por VARCHAR(255),
    fecha_inspeccion TIMESTAMP,
    resultado_qc VARCHAR(20), -- aprobado, rechazado, aprobado_con_observaciones
    notas_qc TEXT,

    -- Costos reales
    costo_materiales_real DECIMAL(15,2),
    costo_mano_obra_real DECIMAL(15,2),
    costo_overhead_real DECIMAL(15,2),
    costo_total_real DECIMAL(15,2),

    -- Lotes generados
    lote_generado_id UUID REFERENCES lotes(id),
    seriales_generados JSONB, -- Array de serial IDs generados

    -- Tracking
    componentes_consumidos JSONB, -- Registro de qué lotes/seriales se consumieron

    -- Notas
    notas TEXT,
    problemas_encontrados TEXT,

    -- Auditoría
    creado_por VARCHAR(255),
    actualizado_por VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT valid_ensamblaje_tipo CHECK (tipo IN ('ensamblaje', 'desensamblaje')),
    CONSTRAINT valid_ensamblaje_estado CHECK (estado IN (
        'planificado', 'en_proceso', 'completado', 'cancelado', 'pausado'
    ))
);

CREATE INDEX idx_ensamblajes_numero ON ensamblajes(numero);
CREATE INDEX idx_ensamblajes_bom ON ensamblajes(bom_id);
CREATE INDEX idx_ensamblajes_producto ON ensamblajes(producto_codigo);
CREATE INDEX idx_ensamblajes_estado ON ensamblajes(estado);
CREATE INDEX idx_ensamblajes_fecha ON ensamblajes(fecha_planificada);

-- =====================================================
-- 6. MEJORAS A TABLA LOTES EXISTENTE
-- =====================================================

-- Agregar columnas de trazabilidad a la tabla lotes existente
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS proveedor_id UUID REFERENCES proveedores(id);
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS orden_compra_id UUID REFERENCES ordenes_compra(id);
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS pais_origen VARCHAR(100);
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS certificados JSONB; -- {tipo: "COA", url: "...", fecha_emision: "..."}
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS fecha_fabricacion DATE;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS fecha_caducidad DATE;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS dias_hasta_caducidad INTEGER GENERATED ALWAYS AS (
    CASE
        WHEN fecha_caducidad IS NOT NULL
        THEN EXTRACT(DAY FROM (fecha_caducidad - CURRENT_DATE))
        ELSE NULL
    END
) STORED;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS estado_calidad VARCHAR(20) DEFAULT 'aprobado';
-- Estados: cuarentena, aprobado, rechazado, vencido
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS inspeccionado_por VARCHAR(255);
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS fecha_inspeccion TIMESTAMP;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS temperatura_almacenamiento_min DECIMAL(5,2);
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS temperatura_almacenamiento_max DECIMAL(5,2);
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS condiciones_almacenamiento TEXT;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_lotes_proveedor ON lotes(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_lotes_fecha_caducidad ON lotes(fecha_caducidad);
CREATE INDEX IF NOT EXISTS idx_lotes_estado_calidad ON lotes(estado_calidad);

-- =====================================================
-- 7. MEJORAS A TABLA PRODUCTOS EXISTENTE
-- =====================================================

-- Agregar control de serialización
ALTER TABLE productos ADD COLUMN IF NOT EXISTS requiere_serial BOOLEAN DEFAULT false;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS patron_serial VARCHAR(100); -- Ej: "SN-{YEAR}-{SEQUENCE}"
ALTER TABLE productos ADD COLUMN IF NOT EXISTS tipo_producto VARCHAR(20) DEFAULT 'simple';
-- Tipos: simple, serializado, lote, kit, virtual, servicio
ALTER TABLE productos ADD COLUMN IF NOT EXISTS tiene_bom BOOLEAN DEFAULT false;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS bom_activo_id UUID REFERENCES bom(id);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS requiere_trazabilidad BOOLEAN DEFAULT false;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS dias_garantia INTEGER;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS es_perecedero BOOLEAN DEFAULT false;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS dias_vida_util INTEGER;

-- =====================================================
-- 8. VISTAS ÚTILES
-- =====================================================

-- Vista de inventario serializado disponible
CREATE OR REPLACE VIEW v_inventario_serializado AS
SELECT
    ps.id,
    ps.numero_serie,
    ps.producto_codigo,
    p.descripcion as producto_descripcion,
    ps.estado,
    ps.almacen_id,
    a.nombre as almacen_nombre,
    ps.ubicacion,
    ps.fecha_recepcion,
    ps.costo_adquisicion,
    ps.fecha_garantia_fin,
    CASE
        WHEN ps.fecha_garantia_fin IS NOT NULL AND ps.fecha_garantia_fin > NOW()
        THEN 'vigente'
        WHEN ps.fecha_garantia_fin IS NOT NULL AND ps.fecha_garantia_fin <= NOW()
        THEN 'vencida'
        ELSE 'sin_garantia'
    END as estado_garantia,
    ps.atributos,
    ps.created_at
FROM productos_seriales ps
JOIN productos p ON ps.producto_codigo = p.codigo
LEFT JOIN almacenes a ON ps.almacen_id = a.id;

-- Vista de trazabilidad completa
CREATE OR REPLACE VIEW v_trazabilidad_completa AS
SELECT
    t.id,
    t.producto_codigo,
    p.descripcion as producto_descripcion,
    t.serial_id,
    ps.numero_serie,
    t.lote_id,
    l.codigo as lote_codigo,
    t.tipo_evento,
    t.descripcion as evento_descripcion,
    t.resultado,
    t.fecha_hora,
    t.almacen_origen_id,
    ao.nombre as almacen_origen,
    t.almacen_destino_id,
    ad.nombre as almacen_destino,
    t.documento_tipo,
    t.documento_numero,
    t.usuario_responsable,
    t.operador_fisico,
    t.metadata
FROM trazabilidad t
JOIN productos p ON t.producto_codigo = p.codigo
LEFT JOIN productos_seriales ps ON t.serial_id = ps.id
LEFT JOIN lotes l ON t.lote_id = l.id
LEFT JOIN almacenes ao ON t.almacen_origen_id = ao.id
LEFT JOIN almacenes ad ON t.almacen_destino_id = ad.id
ORDER BY t.fecha_hora DESC;

-- Vista de RMAs activas
CREATE OR REPLACE VIEW v_rma_activas AS
SELECT
    r.id,
    r.numero,
    r.estado,
    r.tipo,
    c.nombre as cliente_nombre,
    c.codigo as cliente_codigo,
    r.valor_productos,
    r.fecha_solicitud,
    r.fecha_limite_devolucion,
    COUNT(ri.id) as total_items,
    SUM(ri.cantidad_solicitada) as cantidad_total,
    r.motivo,
    r.resolucion_esperada
FROM rma r
JOIN clientes c ON r.cliente_id = c.id
LEFT JOIN rma_items ri ON r.id = ri.rma_id
WHERE r.estado NOT IN ('completada', 'cancelada')
GROUP BY r.id, c.nombre, c.codigo;

-- Vista de costos de ensamblaje
CREATE OR REPLACE VIEW v_costos_ensamblaje AS
SELECT
    b.id as bom_id,
    b.producto_codigo,
    p.descripcion as producto_descripcion,
    b.version,
    b.cantidad_base,
    COUNT(bi.id) as total_componentes,
    SUM(bi.costo_total) as costo_materiales,
    b.costo_mano_obra,
    b.costo_overhead,
    b.costo_total,
    CASE
        WHEN p.precio > 0
        THEN ((p.precio - b.costo_total) / p.precio * 100)
        ELSE 0
    END as margen_porcentaje
FROM bom b
JOIN productos p ON b.producto_codigo = p.codigo
LEFT JOIN bom_items bi ON b.id = bi.bom_id
WHERE b.estado = 'activo'
GROUP BY b.id, p.descripcion, p.precio;

-- =====================================================
-- 9. FUNCIONES Y TRIGGERS
-- =====================================================

-- Función para generar número de serial automático
CREATE OR REPLACE FUNCTION generar_numero_serial(
    p_producto_codigo VARCHAR,
    p_patron VARCHAR DEFAULT NULL
)
RETURNS VARCHAR AS $$
DECLARE
    v_patron VARCHAR;
    v_secuencia INTEGER;
    v_numero_serial VARCHAR;
    v_year VARCHAR;
    v_month VARCHAR;
BEGIN
    -- Obtener patrón del producto o usar el proporcionado
    IF p_patron IS NULL THEN
        SELECT patron_serial INTO v_patron FROM productos WHERE codigo = p_producto_codigo;
    ELSE
        v_patron := p_patron;
    END IF;

    -- Si no hay patrón, usar uno por defecto
    IF v_patron IS NULL THEN
        v_patron := 'SN-{YEAR}-{SEQUENCE}';
    END IF;

    -- Obtener siguiente secuencia
    SELECT COALESCE(MAX(CAST(SUBSTRING(numero_serie FROM '\d+$') AS INTEGER)), 0) + 1
    INTO v_secuencia
    FROM productos_seriales
    WHERE producto_codigo = p_producto_codigo
    AND numero_serie LIKE SUBSTRING(v_patron FROM 1 FOR POSITION('{' IN v_patron) - 1) || '%';

    -- Reemplazar variables en el patrón
    v_year := TO_CHAR(NOW(), 'YYYY');
    v_month := TO_CHAR(NOW(), 'MM');

    v_numero_serial := v_patron;
    v_numero_serial := REPLACE(v_numero_serial, '{YEAR}', v_year);
    v_numero_serial := REPLACE(v_numero_serial, '{MONTH}', v_month);
    v_numero_serial := REPLACE(v_numero_serial, '{PRODUCTO}', p_producto_codigo);
    v_numero_serial := REPLACE(v_numero_serial, '{SEQUENCE}', LPAD(v_secuencia::TEXT, 6, '0'));

    RETURN v_numero_serial;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION actualizar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a todas las tablas nuevas
CREATE TRIGGER trigger_productos_seriales_updated_at
    BEFORE UPDATE ON productos_seriales
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_updated_at();

CREATE TRIGGER trigger_rma_updated_at
    BEFORE UPDATE ON rma
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_updated_at();

CREATE TRIGGER trigger_rma_items_updated_at
    BEFORE UPDATE ON rma_items
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_updated_at();

CREATE TRIGGER trigger_bom_updated_at
    BEFORE UPDATE ON bom
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_updated_at();

CREATE TRIGGER trigger_bom_items_updated_at
    BEFORE UPDATE ON bom_items
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_updated_at();

CREATE TRIGGER trigger_ensamblajes_updated_at
    BEFORE UPDATE ON ensamblajes
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_updated_at();

-- Trigger para crear evento de trazabilidad automáticamente
CREATE OR REPLACE FUNCTION registrar_trazabilidad_serial()
RETURNS TRIGGER AS $$
BEGIN
    -- Al crear un nuevo serial (RECEPCION)
    IF TG_OP = 'INSERT' THEN
        INSERT INTO trazabilidad (
            producto_codigo,
            serial_id,
            lote_id,
            tipo_evento,
            descripcion,
            resultado,
            almacen_destino_id,
            ubicacion_destino,
            documento_tipo,
            documento_id,
            proveedor_id,
            usuario_responsable,
            fecha_hora
        ) VALUES (
            NEW.producto_codigo,
            NEW.id,
            NEW.lote_id,
            'RECEPCION',
            'Serial recibido en almacén',
            'EXITOSO',
            NEW.almacen_id,
            NEW.ubicacion,
            'ORDEN_COMPRA',
            NEW.orden_compra_id,
            NEW.proveedor_id,
            NEW.creado_por,
            NEW.fecha_recepcion
        );
    END IF;

    -- Al actualizar estado (CAMBIO_ESTADO)
    IF TG_OP = 'UPDATE' AND OLD.estado != NEW.estado THEN
        INSERT INTO trazabilidad (
            producto_codigo,
            serial_id,
            tipo_evento,
            descripcion,
            resultado,
            almacen_origen_id,
            almacen_destino_id,
            usuario_responsable,
            metadata
        ) VALUES (
            NEW.producto_codigo,
            NEW.id,
            'CAMBIO_ESTADO',
            'Estado cambiado de ' || OLD.estado || ' a ' || NEW.estado,
            'EXITOSO',
            OLD.almacen_id,
            NEW.almacen_id,
            NEW.actualizado_por,
            jsonb_build_object(
                'estado_anterior', OLD.estado,
                'estado_nuevo', NEW.estado
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_trazabilidad_serial
    AFTER INSERT OR UPDATE ON productos_seriales
    FOR EACH ROW
    EXECUTE FUNCTION registrar_trazabilidad_serial();

-- =====================================================
-- 10. POLÍTICAS RLS (Row Level Security)
-- =====================================================

-- Habilitar RLS en las nuevas tablas
ALTER TABLE productos_seriales ENABLE ROW LEVEL SECURITY;
ALTER TABLE trazabilidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE rma ENABLE ROW LEVEL SECURITY;
ALTER TABLE rma_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ensamblajes ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (ajustar según tu modelo de autenticación)
-- Estas políticas permiten acceso completo a usuarios autenticados
-- Deberás personalizarlas según tus roles

CREATE POLICY "Usuarios autenticados pueden ver seriales"
    ON productos_seriales FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden crear seriales"
    ON productos_seriales FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden actualizar seriales"
    ON productos_seriales FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Aplicar políticas similares a otras tablas
CREATE POLICY "Acceso completo trazabilidad" ON trazabilidad FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Acceso completo rma" ON rma FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Acceso completo rma_items" ON rma_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Acceso completo bom" ON bom FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Acceso completo bom_items" ON bom_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Acceso completo ensamblajes" ON ensamblajes FOR ALL USING (auth.role() = 'authenticated');

-- =====================================================
-- 11. DATOS DE EJEMPLO (OPCIONAL - COMENTADO)
-- =====================================================

-- Puedes descomentar para datos de prueba
/*
-- Ejemplo de producto serializado
UPDATE productos SET
    requiere_serial = true,
    patron_serial = 'SN-{YEAR}-{SEQUENCE}',
    tipo_producto = 'serializado',
    dias_garantia = 365
WHERE codigo = 'LAPTOP001';

-- Ejemplo de serial
INSERT INTO productos_seriales (
    producto_codigo,
    numero_serie,
    estado,
    almacen_id,
    ubicacion,
    fecha_garantia_inicio,
    periodo_garantia_meses,
    creado_por
) VALUES (
    'LAPTOP001',
    generar_numero_serial('LAPTOP001'),
    'disponible',
    (SELECT id FROM almacenes LIMIT 1),
    'A1-R2-N3-P4',
    NOW(),
    12,
    'admin@example.com'
);
*/

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

-- Verificar que todo se creó correctamente
DO $$
BEGIN
    RAISE NOTICE 'Migración 001_traceability_serialization.sql completada exitosamente';
    RAISE NOTICE 'Tablas creadas: productos_seriales, trazabilidad, rma, rma_items, bom, bom_items, ensamblajes';
    RAISE NOTICE 'Vistas creadas: v_inventario_serializado, v_trazabilidad_completa, v_rma_activas, v_costos_ensamblaje';
    RAISE NOTICE 'Funciones creadas: generar_numero_serial, actualizar_updated_at, registrar_trazabilidad_serial';
END $$;
