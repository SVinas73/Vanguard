-- =====================================================================
-- Borrar solicitudes de insumos de categoría "Artículos de Prueba"
-- =====================================================================
-- Elimina las solicitudes de prueba y sus items. La categoría puede haberse
-- guardado de varias formas; el LIKE cubre variantes ("Articulos de Prueba",
-- "Artículos de Prueba", etc.).
--
-- COMO EJECUTAR: pegá en Supabase -> SQL Editor.
-- 1) Corré el primer SELECT para VER qué se va a borrar.
-- 2) Si estás conforme, corré el bloque BEGIN...COMMIT.
-- =====================================================================

-- 1) PREVISUALIZAR lo que se borraría
SELECT id, numero, categoria, solicitado_por, fecha_solicitud, estado
  FROM solicitudes_insumos
 WHERE categoria ILIKE '%art%culos de prueba%'
    OR categoria ILIKE '%articulos de prueba%'
    OR categoria ILIKE '%prueba%';

-- 2) BORRAR (revisá el SELECT de arriba antes de correr esto)
BEGIN;

-- Borrar items de esas solicitudes (por si no hay ON DELETE CASCADE)
DELETE FROM solicitudes_insumos_items
 WHERE solicitud_id IN (
   SELECT id FROM solicitudes_insumos
    WHERE categoria ILIKE '%art%culos de prueba%'
       OR categoria ILIKE '%articulos de prueba%'
       OR categoria ILIKE '%prueba%'
 );

-- Borrar las solicitudes
DELETE FROM solicitudes_insumos
 WHERE categoria ILIKE '%art%culos de prueba%'
    OR categoria ILIKE '%articulos de prueba%'
    OR categoria ILIKE '%prueba%';

-- Verificación: debería devolver 0 filas
SELECT count(*) AS quedan
  FROM solicitudes_insumos
 WHERE categoria ILIKE '%prueba%';

COMMIT;
-- Si algo no cuadra, en vez de COMMIT ejecutá:  ROLLBACK;
