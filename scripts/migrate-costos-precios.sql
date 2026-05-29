-- =====================================================================
-- Migración de costos/precios de `productos`
-- =====================================================================
-- Contexto: durante un tiempo se cargó el COSTO de compra en la columna de
-- PRECIO DE VENTA (productos.precio) por error. Esta migración corrige eso:
--
--   1. Productos SIN costo y CON precio de venta  -> costo = precio de venta.
--   2. Productos CON costo                        -> costo = ÚLTIMO costo con
--      el que se cargó el producto (última entrada en `movimientos`); si no
--      hay historial de compra, se deja el costo actual.
--   3. Finalmente, TODA la columna precio de venta queda en 0.
--
-- Columnas reales: productos.precio, productos.costo_promedio,
--                  movimientos.codigo, movimientos.tipo='entrada',
--                  movimientos.costo_compra, movimientos.created_at
--
-- COMO EJECUTAR: pegá TODO este bloque en Supabase -> SQL Editor -> Run.
-- Está dentro de una transacción y crea un backup antes de tocar nada.
-- Revisá el SELECT final; si algo no cuadra, hacé ROLLBACK (ver más abajo).
-- =====================================================================

BEGIN;

-- 0) Backup de seguridad (idempotente). Permite revertir.
ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio_backup_migracion numeric;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS costo_backup_migracion numeric;
UPDATE productos
   SET precio_backup_migracion = precio,
       costo_backup_migracion  = costo_promedio
 WHERE precio_backup_migracion IS NULL
   AND costo_backup_migracion  IS NULL;

-- 1) + 2) Recalcular costo_promedio (ANTES de poner precio en 0, porque el
--          caso (1) usa el precio de venta actual).
WITH ultimo_costo AS (
  SELECT DISTINCT ON (codigo) codigo, costo_compra
    FROM movimientos
   WHERE tipo = 'entrada'
     AND costo_compra IS NOT NULL
     AND costo_compra > 0
   ORDER BY codigo, created_at DESC
)
UPDATE productos p
   SET costo_promedio = CASE
         -- (1) sin costo y con precio de venta -> costo = precio de venta
         WHEN COALESCE(p.costo_promedio, 0) = 0 AND COALESCE(p.precio, 0) > 0
              THEN p.precio
         -- (2) con costo -> último costo de carga (o el actual si no hay historial)
         WHEN COALESCE(p.costo_promedio, 0) > 0
              THEN COALESCE(uc.costo_compra, p.costo_promedio)
         ELSE p.costo_promedio
       END
  FROM productos p2
  LEFT JOIN ultimo_costo uc ON uc.codigo = p2.codigo
 WHERE p.id = p2.id;

-- 3) Toda la columna de precio de venta en 0.
UPDATE productos SET precio = 0;

-- Verificación: revisá estas filas antes de confirmar.
SELECT codigo, descripcion,
       precio_backup_migracion AS precio_venta_anterior,
       costo_backup_migracion  AS costo_anterior,
       precio                  AS precio_venta_nuevo,
       costo_promedio          AS costo_nuevo
  FROM productos
 ORDER BY codigo
 LIMIT 50;

-- Si todo está OK:
COMMIT;

-- Si algo salió mal, en vez de COMMIT ejecutá:  ROLLBACK;

-- =====================================================================
-- (OPCIONAL) Una vez verificado y estable, podés borrar las columnas de
-- backup con:
--   ALTER TABLE productos DROP COLUMN IF EXISTS precio_backup_migracion;
--   ALTER TABLE productos DROP COLUMN IF EXISTS costo_backup_migracion;
-- =====================================================================
