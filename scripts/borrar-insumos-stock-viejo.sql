-- =====================================================
-- Limpieza: artículos de insumo creados en Stock con el flujo VIEJO
-- =====================================================
-- Contexto: estos 4 artículos se subieron a Stock al CREAR la solicitud
-- (flujo viejo), antes del fix en el que el artículo se crea recién al
-- RECIBIR la compra.
--
-- Qué hace este script:
--   1) Borra los 4 productos de la tabla `productos` y todo lo asociado
--      (movimientos, lotes, ubicaciones WMS si las hubiera).
--   2) NO toca la solicitud ni sus items: cada item conserva su
--      `producto_codigo` (TORXT25, etc.). Cuando recibas la solicitud, el
--      endpoint de recepción vuelve a crear el producto con ESE mismo código
--      y le suma la cantidad cotejada/recibida a Stock.
--
-- Resultado: hoy desaparecen de Stock; al recibir la compra reaparecen con
-- las unidades realmente recibidas.
-- =====================================================

BEGIN;

-- Códigos a limpiar
WITH codigos AS (
  SELECT unnest(ARRAY['TORXT25','PUNTORXT10','CHAVETAS','BOMBCOMB']) AS codigo
)

-- (vista previa: lo que se va a borrar)
SELECT p.codigo, p.descripcion, p.stock, p.categoria, p.almacen_id
FROM productos p
JOIN codigos c ON c.codigo = p.codigo;

-- 1) Movimientos asociados
DELETE FROM movimientos
WHERE codigo IN ('TORXT25','PUNTORXT10','CHAVETAS','BOMBCOMB');

-- 2) Lotes (valuación FIFO)
DELETE FROM lotes
WHERE codigo IN ('TORXT25','PUNTORXT10','CHAVETAS','BOMBCOMB');

-- 3) Ubicaciones WMS (por si quedó alguna fila)
DELETE FROM wms_stock_ubicacion
WHERE producto_codigo IN ('TORXT25','PUNTORXT10','CHAVETAS','BOMBCOMB');

-- 4) Productos
DELETE FROM productos
WHERE codigo IN ('TORXT25','PUNTORXT10','CHAVETAS','BOMBCOMB');

-- Verificación final: no debería devolver filas
SELECT codigo FROM productos
WHERE codigo IN ('TORXT25','PUNTORXT10','CHAVETAS','BOMBCOMB');

COMMIT;
