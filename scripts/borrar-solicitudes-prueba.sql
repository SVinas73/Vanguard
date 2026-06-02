-- =====================================================================
-- Borrar solicitudes de insumos de PRUEBA
-- =====================================================================
-- Los artículos de prueba se identifican por la DESCRIPCIÓN del item
-- (ej. "ARTICULO PRUEBA", "ARTICULO PRUEBA 2"), no por la categoría.
-- Este script borra las solicitudes que tienen algún item cuya descripción
-- contiene "prueba", junto con sus items.
--
-- COMO EJECUTAR: pegá en Supabase -> SQL Editor.
-- 1) Corré el primer SELECT para VER qué solicitudes se van a borrar.
-- 2) Si estás conforme, corré el bloque BEGIN...COMMIT.
-- =====================================================================

-- 1) PREVISUALIZAR: solicitudes que tienen items "de prueba"
SELECT DISTINCT s.id, s.numero, s.categoria, s.solicitado_por, s.estado, s.fecha_solicitud
  FROM solicitudes_insumos s
  JOIN solicitudes_insumos_items i ON i.solicitud_id = s.id
 WHERE i.descripcion ILIKE '%prueba%'
 ORDER BY s.fecha_solicitud DESC;

-- 2) BORRAR (revisá el SELECT de arriba antes de correr esto)
BEGIN;

-- Guardar los ids de solicitudes con items de prueba
CREATE TEMP TABLE _solicitudes_prueba ON COMMIT DROP AS
  SELECT DISTINCT s.id
    FROM solicitudes_insumos s
    JOIN solicitudes_insumos_items i ON i.solicitud_id = s.id
   WHERE i.descripcion ILIKE '%prueba%';

-- Borrar items de esas solicitudes
DELETE FROM solicitudes_insumos_items
 WHERE solicitud_id IN (SELECT id FROM _solicitudes_prueba);

-- Borrar las solicitudes
DELETE FROM solicitudes_insumos
 WHERE id IN (SELECT id FROM _solicitudes_prueba);

-- Verificación: debería devolver 0
SELECT count(*) AS items_prueba_restantes
  FROM solicitudes_insumos_items
 WHERE descripcion ILIKE '%prueba%';

COMMIT;
-- Si algo no cuadra, en vez de COMMIT ejecutá:  ROLLBACK;
