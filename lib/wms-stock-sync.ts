// =====================================================
// Sincronización de stock WMS  →  productos.stock
// =====================================================
// FUENTE DE VERDAD: productos.stock es el stock global que lee toda la app.
// Para productos GESTIONADOS por WMS (los que tienen filas en
// wms_stock_ubicacion), se mantiene productos.stock = SUMA de sus ubicaciones.
//
// PROTECCIÓN CRÍTICA: si un producto NO tiene ninguna fila en
// wms_stock_ubicacion (p. ej. insumos u otros productos fuera de WMS), NO se
// toca su productos.stock — de lo contrario lo pondríamos en 0. La regla es:
//   - 0 filas de ubicación  -> producto NO gestionado por WMS -> no tocar.
//   - >=1 fila              -> productos.stock = suma de cantidades.

import { supabase } from './supabase';

/**
 * Recalcula productos.stock = suma de wms_stock_ubicacion del producto.
 * Devuelve el total sincronizado, o null si el producto no es gestionado por
 * WMS (sin filas de ubicación) o si hubo un error.
 */
export async function sincronizarStockProducto(codigo: string): Promise<number | null> {
  if (!codigo) return null;
  const { data, error } = await supabase
    .from('wms_stock_ubicacion')
    .select('cantidad')
    .eq('producto_codigo', codigo);

  if (error) {
    console.error('[wms-stock-sync] error leyendo ubicaciones de', codigo, error);
    return null;
  }
  // Sin filas → producto fuera de WMS → NO tocar productos.stock.
  if (!data || data.length === 0) return null;

  const total = data.reduce((s, r: any) => s + (Number(r.cantidad) || 0), 0);
  const { error: upErr } = await supabase
    .from('productos')
    .update({ stock: total })
    .eq('codigo', codigo);

  if (upErr) {
    console.error('[wms-stock-sync] error actualizando productos.stock de', codigo, upErr);
    return null;
  }
  return total;
}

/** Sincroniza varios productos (deduplicado). */
export async function sincronizarStockProductos(codigos: string[]): Promise<void> {
  const unicos = Array.from(new Set(codigos.filter(Boolean)));
  await Promise.all(unicos.map((c) => sincronizarStockProducto(c)));
}
