'use client';

import { useEffect, useState, useCallback } from 'react';
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
}

export function useTiposCambio(): UseTiposCambioState {
  const { orgActivaId } = useOrganizacion();
  const [raw, setRaw] = useState<TipoCambio[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('tipos_cambio')
      .select('moneda_origen, moneda_destino, tasa, fecha')
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
    return { ok: true };
  }, [orgActivaId, cargar]);

  return {
    rates: buildRatesTable(raw),
    raw,
    loading,
    recargar: cargar,
    agregar,
  };
}
