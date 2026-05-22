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
  setBaseCurrency: (m: string) => Promise<void>;
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
      base_currency: c.base_currency ?? 'UYU',
      display_currency: c.display_currency ?? c.base_currency ?? 'UYU',
    });
    setLoading(false);
  }, [orgActivaId]);

  useEffect(() => { cargar(); }, [cargar]);

  // Cuando otra instancia del hook cambia la config, aplicamos el
  // nuevo valor que viene en el evento directo. Sin re-fetch, sin lag.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as ModuleConfig | undefined;
      if (detail) setConfig(detail);
      else cargar();
    };
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
    // Avisar a la app para refrescar el sidebar — incluye el nuevo
    // config en el evento para aplicarlo sin re-fetch
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vg:modules-changed', { detail: next }));
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

  const setBaseCurrency = useCallback(async (m: string) => {
    // Cambiar la moneda base afecta cómo se interpretan TODOS los valores
    // existentes (no los convierte: cambia el supuesto). Si no se setea
    // display_currency, también la alineamos para no dejar config inconsistente.
    const next = { ...config, base_currency: m };
    if (!config.display_currency) next.display_currency = m;
    await guardar(next);
  }, [config, guardar]);

  return {
    modulos: resolverModulosHabilitados(config),
    config,
    loading,
    cambiarPreset,
    setDisplayCurrency,
    setBaseCurrency,
    recargar: cargar,
  };
}
