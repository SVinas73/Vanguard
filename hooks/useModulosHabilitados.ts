'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOrganizacion } from '@/hooks/useOrganizacion';
import {
  resolverModulosHabilitados,
  type ModuleConfig,
  type ModulePreset,
  DEFAULT_CONFIG,
  ALL_MODULES,
  LITE_MODULES,
} from '@/lib/modules';
import type { TabType } from '@/types';

interface State {
  modulos: TabType[];
  config: ModuleConfig;
  loading: boolean;
  cambiarPreset: (preset: ModulePreset, custom?: TabType[]) => Promise<void>;
  setDisplayCurrency: (m: string) => Promise<void>;
  recargar: () => Promise<void>;
}

export function useModulosHabilitados(): State {
  const { orgActivaId } = useOrganizacion();
  const [config, setConfig] = useState<ModuleConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    if (!orgActivaId) {
      setConfig(DEFAULT_CONFIG);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('organizaciones')
      .select('config')
      .eq('id', orgActivaId)
      .single();
    const c = (data?.config ?? {}) as Partial<ModuleConfig>;
    setConfig({
      preset: c.preset ?? 'full',
      enabled_modules: c.enabled_modules ?? ALL_MODULES,
      display_currency: c.display_currency ?? 'UYU',
    });
    setLoading(false);
  }, [orgActivaId]);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = useCallback(async (next: ModuleConfig) => {
    if (!orgActivaId) return;
    setConfig(next);
    await supabase
      .from('organizaciones')
      .update({ config: next })
      .eq('id', orgActivaId);
    // Avisar a la app para refrescar el sidebar
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vg:modules-changed'));
    }
  }, [orgActivaId]);

  const cambiarPreset = useCallback(async (preset: ModulePreset, custom?: TabType[]) => {
    const enabled =
      preset === 'full' ? ALL_MODULES
      : preset === 'lite' ? LITE_MODULES
      : (custom ?? config.enabled_modules);
    await guardar({ ...config, preset, enabled_modules: enabled });
  }, [config, guardar]);

  const setDisplayCurrency = useCallback(async (m: string) => {
    await guardar({ ...config, display_currency: m });
  }, [config, guardar]);

  return {
    modulos: resolverModulosHabilitados(config),
    config,
    loading,
    cambiarPreset,
    setDisplayCurrency,
    recargar: cargar,
  };
}
