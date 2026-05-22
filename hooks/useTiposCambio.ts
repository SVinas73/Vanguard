'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOrganizacion } from '@/hooks/useOrganizacion';
import { buildRatesTable, type RatesTable, type TipoCambio } from '@/lib/currency';
import type { Moneda } from '@/types';

interface UseTiposCambioState {
  rates: RatesTable;
  raw: TipoCambio[];
  loading: boolean;
  recargar: () => Promise<void>;
  agregar: (args: {
    moneda_origen: Moneda;
    moneda_destino: Moneda;
    tasa: number;
    fecha?: string;
    notas?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  eliminar: (id: string) => Promise<{ ok: boolean; error?: string }>;
}

export function useTiposCambio(): UseTiposCambioState {
  const { orgActivaId } = useOrganizacion();
  const [raw, setRaw] = useState<TipoCambio[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('tipos_cambio')
      .select('id, moneda_origen, moneda_destino, tasa, fecha')
      .order('fecha', { ascending: false })
      .limit(500);
    if (orgActivaId) query = query.eq('organizacion_id', orgActivaId);

    const { data, error } = await query;
    if (!error && data) {
      setRaw(data as TipoCambio[]);
    }
    setLoading(false);
  }, [orgActivaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Reaccionar a cambios en otras pestañas/hooks (alta/baja de TC).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const h = () => cargar();
    window.addEventListener('vg:rates-changed', h);
    return () => window.removeEventListener('vg:rates-changed', h);
  }, [cargar]);

  const agregar: UseTiposCambioState['agregar'] = useCallback(async (args) => {
    if (!orgActivaId) return { ok: false, error: 'Sin organización activa' };
    if (args.moneda_origen === args.moneda_destino) {
      return { ok: false, error: 'Origen y destino deben ser distintos' };
    }
    if (!(args.tasa > 0)) return { ok: false, error: 'Tasa debe ser > 0' };

    const { error } = await supabase.from('tipos_cambio').upsert(
      {
        organizacion_id: orgActivaId,
        moneda_origen: args.moneda_origen,
        moneda_destino: args.moneda_destino,
        tasa: args.tasa,
        fecha: args.fecha ?? new Date().toISOString().slice(0, 10),
        notas: args.notas ?? null,
        fuente: 'manual',
      },
      { onConflict: 'organizacion_id,moneda_origen,moneda_destino,fecha' }
    );
    if (error) return { ok: false, error: error.message };
    await cargar();
    notificarCambio();
    return { ok: true };
  }, [orgActivaId, cargar]);

  const eliminar: UseTiposCambioState['eliminar'] = useCallback(async (id) => {
    const { error } = await supabase.from('tipos_cambio').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    await cargar();
    notificarCambio();
    return { ok: true };
  }, [cargar]);

  // IMPORTANTE: memoizamos para que la identidad del Map no cambie en
  // cada render. Sin esto, los useEffect dependientes de `rates`
  // se disparan infinitamente (ej: en Reports se generaba un bucle
  // de "reporte generado" porque cada render creaba un nuevo Map).
  const rates = useMemo(() => buildRatesTable(raw), [raw]);

  return {
    rates,
    raw,
    loading,
    recargar: cargar,
    agregar,
    eliminar,
  };
}

// Avisamos a otros hooks (Reports, Dashboard, Stock) que las tasas
// cambiaron, así re-fetchean sin esperar reload. Sin esto, el toggle
// de moneda en otras pantallas seguiría usando tasas viejas.
function notificarCambio() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vg:rates-changed'));
  }
}
