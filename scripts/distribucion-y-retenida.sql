-- =====================================================================
-- Distribución (agencias + despachos) + estado 'retenida' en ventas
-- =====================================================================
-- Lo que necesita el flujo nuevo en Supabase:
--   1) ordenes_venta.estado: aceptar el valor 'retenida' (gate de Admin).
--   2) agencias_distribucion: agencias de distribución y cadeterías propias.
--   3) distribucion_despachos: registro de cada paquete entregado a una
--      agencia/cadetería (para el reporte por agencia).
--
-- COMO EJECUTAR: pegá TODO en Supabase -> SQL Editor -> Run. Es idempotente.
-- =====================================================================

-- ── 1) ordenes_venta.estado debe aceptar 'retenida' ─────────────────
-- Si `estado` es TEXT libre, no hace falta nada. Si tiene un CHECK
-- constraint, esto lo recrea incluyendo 'retenida'. (Ajustá el nombre del
-- constraint si en tu base es distinto; este bloque es defensivo.)
DO $$
DECLARE
  cons_name text;
BEGIN
  SELECT conname INTO cons_name
    FROM pg_constraint
   WHERE conrelid = 'ordenes_venta'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%estado%';
  IF cons_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE ordenes_venta DROP CONSTRAINT %I', cons_name);
    ALTER TABLE ordenes_venta
      ADD CONSTRAINT ordenes_venta_estado_check
      CHECK (estado IN ('borrador','retenida','confirmada','en_proceso','enviada','despachada','entregada','cancelada'));
  END IF;
END $$;
-- Nota: si `estado` es de tipo ENUM en tu base, en su lugar correr:
--   ALTER TYPE nombre_del_enum ADD VALUE IF NOT EXISTS 'retenida';


-- ── 2) agencias_distribucion ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agencias_distribucion (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo       text UNIQUE NOT NULL,
  nombre       text NOT NULL,
  tipo         text NOT NULL DEFAULT 'agencia',   -- 'agencia' | 'cadeteria_propia'
  contacto     text,
  telefono     text,
  email        text,
  direccion    text,
  zona         text,
  activo       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_agencias_activo ON agencias_distribucion (activo);


-- ── 3) distribucion_despachos ───────────────────────────────────────
-- Cada fila = un paquete entregado a una agencia/cadetería para repartir.
CREATE TABLE IF NOT EXISTS distribucion_despachos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero             text UNIQUE NOT NULL,
  agencia_id         uuid REFERENCES agencias_distribucion(id),
  agencia_nombre     text,
  -- Vínculo con el paquete / venta de origen (todos opcionales para flexibilidad)
  paquete_id         uuid,
  paquete_numero     text,
  orden_venta_id     uuid,
  orden_venta_numero text,
  cliente_nombre     text,
  tracking_numero    text,
  bultos             integer NOT NULL DEFAULT 1,
  peso_kg            numeric,
  estado             text NOT NULL DEFAULT 'registrado', -- registrado|en_ruta|entregado|devuelto
  notas              text,
  registrado_por     text,
  fecha_registro     timestamptz NOT NULL DEFAULT now(),
  fecha_entrega      timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_despachos_agencia ON distribucion_despachos (agencia_id);
CREATE INDEX IF NOT EXISTS ix_despachos_fecha   ON distribucion_despachos (fecha_registro);
CREATE INDEX IF NOT EXISTS ix_despachos_estado  ON distribucion_despachos (estado);


-- ── RLS (ajustá a tu política; acá: authenticated puede todo) ───────
ALTER TABLE agencias_distribucion  ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribucion_despachos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='agencias_distribucion' AND policyname='agencias_auth_all') THEN
    CREATE POLICY agencias_auth_all ON agencias_distribucion FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='distribucion_despachos' AND policyname='despachos_auth_all') THEN
    CREATE POLICY despachos_auth_all ON distribucion_despachos FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;


-- ── Datos de ejemplo (opcional; editá o borrá) ──────────────────────
INSERT INTO agencias_distribucion (codigo, nombre, tipo, zona)
SELECT 'CADETE', 'Cadetería propia', 'cadeteria_propia', 'Local'
WHERE NOT EXISTS (SELECT 1 FROM agencias_distribucion WHERE codigo = 'CADETE');


-- ── Verificación ─────────────────────────────────────────────────────
SELECT 'agencias' AS check, count(*) FROM agencias_distribucion;
SELECT 'despachos' AS check, count(*) FROM distribucion_despachos;
