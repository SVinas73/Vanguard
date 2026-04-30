import { supabase } from '@/lib/supabase';

// =====================================================
// Cycle counting con frecuencia por clase ABC
// =====================================================
// Cada ubicación tiene una clase A/B/C y una fecha de
// próxima revisión calculada según la frecuencia
// configurada (días). Cuando llega esa fecha, la
// ubicación es candidata a contar.
// =====================================================

export interface UbicacionParaContar {
  id: string;
  codigo: string;
  codigo_completo?: string;
  clase_abc?: string | null;
  zona_id: string;
  zona_nombre?: string;
  ultima_revision_at?: string | null;
  proxima_revision_at?: string | null;
  dias_desde_ultima: number | null;
  prioridad: number; // mayor = más urgente
}

interface ConfigCycleCount {
  dias_count_clase_a: number;
  dias_count_clase_b: number;
  dias_count_clase_c: number;
}

async function getConfig(): Promise<ConfigCycleCount> {
  const { data } = await supabase
    .from('wms_configuracion')
    .select('dias_count_clase_a, dias_count_clase_b, dias_count_clase_c')
    .limit(1)
    .maybeSingle();
  return {
    dias_count_clase_a: data?.dias_count_clase_a ?? 10,
    dias_count_clase_b: data?.dias_count_clase_b ?? 30,
    dias_count_clase_c: data?.dias_count_clase_c ?? 180,
  };
}

function diasSegunClase(clase: string | null | undefined, cfg: ConfigCycleCount): number {
  if (clase === 'A') return cfg.dias_count_clase_a;
  if (clase === 'B') return cfg.dias_count_clase_b;
  if (clase === 'C') return cfg.dias_count_clase_c;
  return cfg.dias_count_clase_b;
}

/**
 * Devuelve las ubicaciones que ya deberían contarse
 * (proxima_revision_at <= hoy) ordenadas por urgencia.
 */
export async function getUbicacionesParaContar(): Promise<UbicacionParaContar[]> {
  const cfg = await getConfig();
  const hoy = new Date();

  const { data } = await supabase
    .from('wms_ubicaciones')
    .select(`
      id, codigo, codigo_completo, clase_abc, zona_id,
      ultima_revision_at, proxima_revision_at,
      wms_zonas(nombre)
    `)
    .eq('estado', 'ocupada');

  return (data || [])
    .map((u: any) => {
      const dias = diasSegunClase(u.clase_abc, cfg);
      const ultima = u.ultima_revision_at ? new Date(u.ultima_revision_at) : null;
      const proxima = u.proxima_revision_at
        ? new Date(u.proxima_revision_at)
        : ultima
          ? new Date(ultima.getTime() + dias * 86400000)
          : null;
      const diasDesdeUltima = ultima
        ? Math.floor((hoy.getTime() - ultima.getTime()) / 86400000)
        : null;
      const venciaHace = proxima ? Math.floor((hoy.getTime() - proxima.getTime()) / 86400000) : 999;
      return {
        id: u.id,
        codigo: u.codigo,
        codigo_completo: u.codigo_completo,
        clase_abc: u.clase_abc,
        zona_id: u.zona_id,
        zona_nombre: u.wms_zonas?.nombre,
        ultima_revision_at: u.ultima_revision_at,
        proxima_revision_at: proxima?.toISOString() || null,
        dias_desde_ultima: diasDesdeUltima,
        prioridad: venciaHace,
      } as UbicacionParaContar;
    })
    .filter(u => (u.prioridad ?? 0) >= 0 || u.dias_desde_ultima === null) // vencidas o nunca contadas
    .sort((a, b) => b.prioridad - a.prioridad)
    .slice(0, 200);
}

/**
 * Marca una ubicación como contada (actualiza ultima/proxima).
 */
export async function marcarUbicacionContada(
  ubicacionId: string,
  claseAbc?: string | null
): Promise<void> {
  const cfg = await getConfig();
  const dias = diasSegunClase(claseAbc, cfg);
  const hoy = new Date();
  const proxima = new Date(hoy.getTime() + dias * 86400000);

  await supabase
    .from('wms_ubicaciones')
    .update({
      ultima_revision_at: hoy.toISOString(),
      proxima_revision_at: proxima.toISOString(),
    })
    .eq('id', ubicacionId);
}
