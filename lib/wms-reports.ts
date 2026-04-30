import { supabase } from '@/lib/supabase';

// =====================================================
// Reportes de WMS — KPIs y export CSV
// =====================================================

export interface ReporteProductividadPicker {
  picker_email: string;
  picker_nombre?: string;
  ordenes_completadas: number;
  unidades_pickeadas: number;
  lineas_completadas: number;
  unidades_short: number;
  tiempo_total_min: number;
  picks_por_hora: number;
  min_por_unidad: number;
  exactitud_pct: number; // 1 - short/solicitado
}

export interface ReporteExactitudConteo {
  ubicacion_codigo: string;
  zona_nombre?: string;
  conteos_totales: number;
  con_diferencias: number;
  exactitud_pct: number;
}

export interface ReporteTiemposCiclo {
  recepcion_a_putaway_promedio_min: number;
  picking_a_pack_promedio_min: number;
  pack_a_despacho_promedio_min: number;
  ciclo_completo_promedio_horas: number;
  muestras: number;
}

// =====================================================
// 1. Productividad por picker
// =====================================================

export async function getProductividadPickers(
  diasAtras: number = 30
): Promise<ReporteProductividadPicker[]> {
  const desde = new Date(Date.now() - diasAtras * 86400000).toISOString();

  const { data: ordenes } = await supabase
    .from('wms_ordenes_picking')
    .select('picker_asignado, fecha_inicio, fecha_completada, unidades_pickeadas, lineas_completadas, unidades_short_total, estado')
    .gte('fecha_completada', desde)
    .eq('estado', 'completada')
    .not('picker_asignado', 'is', null);

  const { data: usuarios } = await supabase
    .from('usuarios')
    .select('email, nombre');
  const nombrePorEmail = new Map<string, string>();
  (usuarios || []).forEach((u: any) => nombrePorEmail.set(u.email, u.nombre));

  const acc: Record<string, ReporteProductividadPicker> = {};
  for (const o of (ordenes || []) as any[]) {
    const email = o.picker_asignado;
    if (!email) continue;
    if (!acc[email]) {
      acc[email] = {
        picker_email: email,
        picker_nombre: nombrePorEmail.get(email),
        ordenes_completadas: 0,
        unidades_pickeadas: 0,
        lineas_completadas: 0,
        unidades_short: 0,
        tiempo_total_min: 0,
        picks_por_hora: 0,
        min_por_unidad: 0,
        exactitud_pct: 0,
      };
    }
    acc[email].ordenes_completadas++;
    acc[email].unidades_pickeadas += parseInt(o.unidades_pickeadas) || 0;
    acc[email].lineas_completadas += parseInt(o.lineas_completadas) || 0;
    acc[email].unidades_short += parseFloat(o.unidades_short_total) || 0;
    if (o.fecha_inicio && o.fecha_completada) {
      const min = (new Date(o.fecha_completada).getTime() - new Date(o.fecha_inicio).getTime()) / 60000;
      if (min > 0 && min < 24 * 60) acc[email].tiempo_total_min += min;
    }
  }

  return Object.values(acc).map(r => {
    const horas = r.tiempo_total_min / 60;
    const solicitado = r.unidades_pickeadas + r.unidades_short;
    return {
      ...r,
      tiempo_total_min: Math.round(r.tiempo_total_min),
      picks_por_hora: horas > 0 ? Math.round((r.lineas_completadas / horas) * 10) / 10 : 0,
      min_por_unidad: r.unidades_pickeadas > 0 ? Math.round((r.tiempo_total_min / r.unidades_pickeadas) * 100) / 100 : 0,
      exactitud_pct: solicitado > 0 ? Math.round(((r.unidades_pickeadas / solicitado) * 1000)) / 10 : 100,
    };
  }).sort((a, b) => b.unidades_pickeadas - a.unidades_pickeadas);
}

// =====================================================
// 2. Exactitud por conteo (ubicaciones más problemáticas)
// =====================================================

export async function getExactitudConteos(
  diasAtras: number = 90
): Promise<ReporteExactitudConteo[]> {
  const desde = new Date(Date.now() - diasAtras * 86400000).toISOString();

  const { data } = await supabase
    .from('wms_conteos')
    .select('id, ubicaciones_total, diferencias_encontradas, fecha_fin')
    .gte('fecha_fin', desde)
    .eq('estado', 'completado');

  // Para reportes detallados por ubicación necesitaríamos
  // las líneas; agregamos resumen general por ahora.
  const totalConteos = (data || []).length;
  const totalDif = (data || []).reduce((s: number, c: any) => s + (parseInt(c.diferencias_encontradas) || 0), 0);
  const totalUbic = (data || []).reduce((s: number, c: any) => s + (parseInt(c.ubicaciones_total) || 0), 0);

  if (totalConteos === 0) return [];
  return [{
    ubicacion_codigo: 'GLOBAL',
    conteos_totales: totalConteos,
    con_diferencias: totalDif,
    exactitud_pct: totalUbic > 0 ? Math.round(((totalUbic - totalDif) / totalUbic) * 1000) / 10 : 100,
  }];
}

// =====================================================
// 3. Tiempos de ciclo (recepción → despacho)
// =====================================================

export async function getTiemposCiclo(diasAtras: number = 30): Promise<ReporteTiemposCiclo> {
  const desde = new Date(Date.now() - diasAtras * 86400000).toISOString();

  const { data: pickings } = await supabase
    .from('wms_ordenes_picking')
    .select('fecha_inicio, fecha_completada')
    .gte('fecha_completada', desde)
    .eq('estado', 'completada');

  const { data: paquetes } = await supabase
    .from('wms_paquetes')
    .select('fecha_armado, fecha_despacho')
    .gte('fecha_despacho', desde);

  let pickAPack = 0;
  let pickAPackN = 0;
  // pick → pack: fecha_completada picking → fecha_armado paquete
  // simplificado: promediamos picking y armado por separado.

  let pickTime = 0;
  let pickTimeN = 0;
  (pickings || []).forEach((p: any) => {
    if (p.fecha_inicio && p.fecha_completada) {
      const min = (new Date(p.fecha_completada).getTime() - new Date(p.fecha_inicio).getTime()) / 60000;
      if (min > 0 && min < 24 * 60) {
        pickTime += min;
        pickTimeN++;
      }
    }
  });

  let packDespacho = 0;
  let packDespachoN = 0;
  (paquetes || []).forEach((p: any) => {
    if (p.fecha_armado && p.fecha_despacho) {
      const min = (new Date(p.fecha_despacho).getTime() - new Date(p.fecha_armado).getTime()) / 60000;
      if (min > 0 && min < 7 * 24 * 60) {
        packDespacho += min;
        packDespachoN++;
      }
    }
  });

  return {
    recepcion_a_putaway_promedio_min: 0,
    picking_a_pack_promedio_min: pickTimeN > 0 ? Math.round(pickTime / pickTimeN) : 0,
    pack_a_despacho_promedio_min: packDespachoN > 0 ? Math.round(packDespacho / packDespachoN) : 0,
    ciclo_completo_promedio_horas: pickTimeN > 0 ? Math.round(((pickTime / pickTimeN) + (packDespacho / Math.max(1, packDespachoN))) / 60 * 10) / 10 : 0,
    muestras: pickTimeN,
  };
}

// =====================================================
// 4. CSV export
// =====================================================

export function aCSV(filas: Array<Record<string, any>>): string {
  if (filas.length === 0) return '';
  const headers = Object.keys(filas[0]);
  const escape = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [headers.join(',')];
  for (const f of filas) {
    lines.push(headers.map(h => escape(f[h])).join(','));
  }
  return lines.join('\n');
}

export function descargarCSV(nombre: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${nombre}-${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
