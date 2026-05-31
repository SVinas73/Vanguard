// =====================================================
// WMS — exclusión del almacén de insumos
// =====================================================
// El módulo WMS NO opera el almacén de insumos (los insumos no se venden ni
// se gestionan por WMS). Este helper devuelve el set de ids de almacenes de
// insumos y un filtro de productos para excluirlos en todos los submódulos.

import { supabase } from './supabase';

/** Devuelve el set de ids de almacenes cuyo nombre contiene "insumo". */
export async function getAlmacenesInsumoIds(): Promise<Set<string>> {
  const { data } = await supabase.from('almacenes').select('id, nombre');
  return new Set(
    (data || [])
      .filter((a: any) => (a.nombre || '').toLowerCase().includes('insumo'))
      .map((a: any) => a.id)
  );
}

/** Filtra una lista de productos excluyendo los del almacén de insumos. */
export function excluirInsumos<T extends { almacen_id?: string | null; almacenId?: string | null }>(
  productos: T[],
  idsInsumos: Set<string>,
): T[] {
  return productos.filter((p) => {
    const aid = p.almacen_id ?? p.almacenId;
    return !aid || !idsInsumos.has(aid);
  });
}
