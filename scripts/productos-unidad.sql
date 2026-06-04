-- Unidad de medida del producto: unidad | litro | paquete | kg | metro.
-- La elige el usuario al crear el producto (depósito de ventas).
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS unidad text DEFAULT 'unidad';

COMMENT ON COLUMN productos.unidad IS
  'Unidad de medida: unidad | litro | paquete | kg | metro.';
