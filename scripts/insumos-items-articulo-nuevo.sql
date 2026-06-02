-- =====================================================
-- Artículo nuevo en solicitudes de insumo
-- =====================================================
-- Permite definir, dentro de una solicitud, un artículo que TODAVÍA no existe
-- en Stock (código, descripción, stock mínimo, categoría). El producto se crea
-- automáticamente recién cuando se RECIBE la compra, con la cantidad recibida.
--
-- Estas columnas guardan esos datos a nivel item para que el endpoint de
-- recepción pueda autocrear el producto con el código y los datos elegidos.
-- =====================================================

ALTER TABLE solicitudes_insumos_items
  ADD COLUMN IF NOT EXISTS es_nuevo            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nuevo_codigo        text,
  ADD COLUMN IF NOT EXISTS nuevo_stock_minimo  integer,
  ADD COLUMN IF NOT EXISTS nuevo_categoria     text,
  -- Costo unitario ESTIMADO al solicitar (opcional). Se confirma/corrige al
  -- recibir; ese costo confirmado es el que actualiza costo_promedio, el lote
  -- y el historial de costos.
  ADD COLUMN IF NOT EXISTS costo_estimado      numeric;

COMMENT ON COLUMN solicitudes_insumos_items.es_nuevo IS
  'true = artículo que no existe en Stock; se crea al recibir la compra.';
COMMENT ON COLUMN solicitudes_insumos_items.nuevo_codigo IS
  'Código elegido para el artículo nuevo (se usa al autocrear el producto al recibir).';
COMMENT ON COLUMN solicitudes_insumos_items.nuevo_stock_minimo IS
  'Stock mínimo del artículo nuevo (se aplica al autocrear).';
COMMENT ON COLUMN solicitudes_insumos_items.nuevo_categoria IS
  'Categoría del artículo nuevo (se aplica al autocrear; default Insumos).';
COMMENT ON COLUMN solicitudes_insumos_items.costo_estimado IS
  'Costo unitario estimado al solicitar (opcional); se confirma al recibir.';
