// =====================================================
// Períodos rápidos para el Análisis y el Reporte de insumos
// =====================================================

export type PresetPeriodo =
  | '7d' | '30d' | '90d' | 'mes' | 'mes_anterior' | 'tres_meses'
  | 'doce_meses' | 'anio' | 'anio_anterior' | 'todo';

export const ETIQUETAS_PERIODO: Record<PresetPeriodo, string> = {
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
  '90d': 'Últimos 90 días',
  mes: 'Este mes',
  mes_anterior: 'Mes anterior',
  tres_meses: 'Últimos 3 meses',
  doce_meses: 'Últimos 12 meses',
  anio: 'Este año',
  anio_anterior: 'Año anterior',
  todo: 'Todo el historial',
};

export const INICIO_HISTORIAL = new Date(2000, 0, 1);

export function rangoPreset(p: PresetPeriodo, hoy = new Date()): { desde: Date; hasta: Date } {
  const y = hoy.getFullYear();
  const m = hoy.getMonth();
  const d = hoy.getDate();
  const finHoy = new Date(y, m, d, 23, 59, 59, 999);
  const haceDias = (n: number) => new Date(y, m, d - (n - 1));
  switch (p) {
    case '7d': return { desde: haceDias(7), hasta: finHoy };
    case '30d': return { desde: haceDias(30), hasta: finHoy };
    case '90d': return { desde: haceDias(90), hasta: finHoy };
    case 'mes': return { desde: new Date(y, m, 1), hasta: finHoy };
    case 'mes_anterior': return { desde: new Date(y, m - 1, 1), hasta: new Date(y, m, 0, 23, 59, 59, 999) };
    case 'tres_meses': return { desde: new Date(y, m - 2, 1), hasta: finHoy };
    case 'doce_meses': return { desde: new Date(y, m - 11, 1), hasta: finHoy };
    case 'anio': return { desde: new Date(y, 0, 1), hasta: finHoy };
    case 'anio_anterior': return { desde: new Date(y - 1, 0, 1), hasta: new Date(y - 1, 11, 31, 23, 59, 59, 999) };
    case 'todo': return { desde: INICIO_HISTORIAL, hasta: finHoy };
  }
}

export const aInputFecha = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function desdeInputFecha(s: string, finDelDia: boolean): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = finDelDia
    ? new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 59, 999)
    : new Date(+m[1], +m[2] - 1, +m[3]);
  return Number.isNaN(d.getTime()) ? null : d;
}
