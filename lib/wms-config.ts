// =====================================================
// Configuración WMS — acceso centralizado
// =====================================================
// Lee la fila única de `wms_configuracion` y la expone con defaults seguros,
// para que los submódulos (Picking, Recepción) respeten las estrategias y
// políticas configuradas en vez de tener la lógica hardcodeada.

import { supabase } from '@/lib/supabase';

export interface WmsConfig {
  estrategia_putaway: 'fefo' | 'familia' | 'manual' | 'cercano_despacho';
  estrategia_picking: 'fefo' | 'fifo' | 'lifo' | 'ruta_optima';
  permitir_short_pick: boolean;
  permitir_pick_partial: boolean;
}

export const WMS_CONFIG_DEFAULT: WmsConfig = {
  estrategia_putaway: 'fefo',
  estrategia_picking: 'fefo',
  permitir_short_pick: false,
  permitir_pick_partial: true,
};

export async function getWmsConfig(): Promise<WmsConfig> {
  try {
    const { data } = await supabase
      .from('wms_configuracion')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!data) return WMS_CONFIG_DEFAULT;
    return {
      estrategia_putaway: (data as any).estrategia_putaway || 'fefo',
      estrategia_picking: (data as any).estrategia_picking || 'fefo',
      permitir_short_pick: (data as any).permitir_short_pick ?? false,
      permitir_pick_partial: (data as any).permitir_pick_partial ?? true,
    };
  } catch {
    return WMS_CONFIG_DEFAULT;
  }
}
