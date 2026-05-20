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

const LOCAL_KEY = 'vg:module-config';

function leerLocal(): ModuleConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ModuleConfig>;
    return {
      preset: parsed.preset ?? 'full',
      enabled_modules: parsed.enabled_modules ?? ALL_MODULES,
      display_currency: parsed.display_currency ?? 'UYU',
    };
  } catch {
    return null;
  }
}

function guardarLocal(c: ModuleConfig) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(c));
  } catch { /* quota / disabled */ }
}

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
    // Single-tenant fallback: si no hay org, leer/escribir en localStorage
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
    setConfig({
      preset: c.preset ?? 'full',
      enabled_modules: c.enabled_modules ?? ALL_MODULES,
      display_currency: c.display_currency ?? 'UYU',
    });
    setLoading(false);
  }, [orgActivaId]);

  useEffect(() => { cargar(); }, [cargar]);

  // Cuando otra instancia del hook cambia la config, recargo
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => cargar();
    window.addEventListener('vg:modules-changed', handler);
    return () => window.removeEventListener('vg:modules-changed', handler);
  }, [cargar]);

  const guardar = useCallback(async (next: ModuleConfig) => {
    setConfig(next);
    if (orgActivaId) {
      await supabase
        .from('organizaciones')
        .update({ config: next })
        .eq('id', orgActivaId);
    } else {
      // Fallback single-tenant: persistir en localStorage
      guardarLocal(next);
    }
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
