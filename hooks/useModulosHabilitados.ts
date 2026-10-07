'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOrganizacion } from '@/hooks/useOrganizacion';
import { type ModuleConfig, DEFAULT_CONFIG } from '@/lib/modules';

const LOCAL_KEY = 'vg:module-config';

function leerLocal(): ModuleConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ModuleConfig>;
    return {
      display_currency: parsed.display_currency ?? 'UYU',
    };
  } catch {
    return null;
  }
}

interface State {
  config: ModuleConfig;
  loading: boolean;
}

export function useModulosHabilitados(): State {
  const { orgActivaId } = useOrganizacion();
  const [config, setConfig] = useState<ModuleConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    // Single-tenant fallback: si no hay org, leer de localStorage
    if (!orgActivaId) {
      setConfig(leerLocal() ?? DEFAULT_CONFIG);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('organizaciones')
      .select('config')
      .eq('id', orgActivaId)
      .single();
    const c = (data?.config ?? {}) as Partial<ModuleConfig>;
    // Moneda BASE forzada a UYU: así guardan los productos/movimientos/lotes
    // a nivel schema. Si algún usuario seteó base_currency a algo distinto
    // antes de este fix, lo ignoramos: solo display_currency controla cómo
    // se MUESTRA, y la conversión asume siempre origen UYU.
    setConfig({
      base_currency: 'UYU',
      display_currency: c.display_currency ?? 'UYU',
    });
    setLoading(false);
  }, [orgActivaId]);

  useEffect(() => { cargar(); }, [cargar]);

  return {
    config,
    loading,
  };
}
