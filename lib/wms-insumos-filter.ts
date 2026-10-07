// =====================================================
// Almacenes de insumos
// =====================================================
// Helper que devuelve el set de ids de almacenes de insumos.

import { supabase } from './supabase';

/** Devuelve el set de ids de almacenes de insumos (por flag es_insumos o por
 *  nombre que contenga "insumo"). */
export async function getAlmacenesInsumoIds(): Promise<Set<string>> {
  const { data } = await supabase.from('almacenes').select('id, nombre, es_insumos');
  return new Set(
    (data || [])
      .filter((a: any) => a.es_insumos === true || (a.nombre || '').toLowerCase().includes('insumo'))
      .map((a: any) => a.id)
  );
}
