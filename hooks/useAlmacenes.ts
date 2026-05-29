'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface AlmacenOpcion {
  id: string;
  nombre: string;
}

/**
 * Hook compartido para el selector de almacén de los módulos de análisis
 * (Reabastecimiento, Demand Planning, Analytics, Precios, Trazabilidad, etc.).
 *
 * Carga los almacenes activos y mantiene uno seleccionado (default: el primero).
 * La MISMA lógica para cualquier almacén: cada módulo filtra su set de productos
 * por `almacenId` usando el helper `filtrarPorAlmacen`.
 */
export function useAlmacenes(opts: { soloVenta?: boolean } = {}) {
  const [almacenes, setAlmacenes] = useState<AlmacenOpcion[]>([]);
  const [almacenId, setAlmacenId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('almacenes')
        .select('id, nombre')
        .eq('activo', true)
        .order('es_principal', { ascending: false });
      if (cancelled) return;
      let lista = (data || []) as AlmacenOpcion[];
      if (opts.soloVenta) {
        lista = lista.filter((a) => !(a.nombre || '').toLowerCase().includes('insumo'));
      }
      setAlmacenes(lista);
      setAlmacenId((prev) => (lista.some((a) => a.id === prev) ? prev : (lista[0]?.id ?? '')));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [opts.soloVenta]);

  /** Filtra una lista de productos (que tengan almacenId/almacen_id) por el almacén elegido. */
  const filtrarPorAlmacen = useCallback(
    <T extends { almacenId?: string | null; almacen_id?: string | null }>(items: T[]): T[] => {
      if (!almacenId) return items;
      return items.filter((p) => (p.almacenId ?? p.almacen_id) === almacenId);
    },
    [almacenId],
  );

  return { almacenes, almacenId, setAlmacenId, loading, filtrarPorAlmacen };
}
