// =====================================================
// Helper: estado efectivo de una solicitud de insumo
// =====================================================
// El estado en BD puede ser pendiente/en_gestion/comprada/etc.
// Pero si fecha_limite ya pasó y la solicitud aún está activa,
// VISUALMENTE se trata como "vencida" para alertar al usuario.
// El estado real en BD no cambia (la podés seguir gestionando).
// =====================================================

export type EstadoSolicitud = 'pendiente' | 'en_gestion' | 'comprada' | 'recibida' | 'cerrada' | 'cancelada';
export type EstadoEfectivo = EstadoSolicitud | 'vencida' | 'por_vencer';

const ESTADOS_ACTIVOS: EstadoSolicitud[] = ['pendiente', 'en_gestion', 'comprada'];

/**
 * Devuelve el estado efectivo de una solicitud considerando fecha límite.
 * Si está activa y la fecha pasó → 'vencida'.
 * Si está activa y la fecha es en ≤ N días → 'por_vencer'.
 */
export function estadoEfectivo(
  estado: EstadoSolicitud,
  fechaLimite: string | null | undefined,
  diasAviso = 3,
): EstadoEfectivo {
  if (!ESTADOS_ACTIVOS.includes(estado) || !fechaLimite) return estado;
  const ahora = new Date();
  ahora.setHours(0, 0, 0, 0);
  const limite = new Date(fechaLimite);
  limite.setHours(0, 0, 0, 0);
  const diff = (limite.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return 'vencida';
  if (diff <= diasAviso) return 'por_vencer';
  return estado;
}

export const ESTADO_LABEL: Record<EstadoEfectivo, string> = {
  pendiente: 'Pendiente',
  en_gestion: 'Aprobado',
  comprada: 'Comprada',
  recibida: 'Recibida',
  cerrada: 'Cerrada',
  cancelada: 'Cancelada',
  vencida: 'Vencida',
  por_vencer: 'Por vencer',
};

export const ESTADO_COLOR: Record<EstadoEfectivo, string> = {
  pendiente: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  en_gestion: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  comprada: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  recibida: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  cerrada: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  cancelada: 'bg-red-500/10 text-red-400 border-red-500/30',
  vencida: 'bg-red-500/15 text-red-300 border-red-500/40',
  por_vencer: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
};

export function diasParaLimite(fechaLimite: string | null | undefined): number | null {
  if (!fechaLimite) return null;
  const ahora = new Date();
  ahora.setHours(0, 0, 0, 0);
  const limite = new Date(fechaLimite);
  limite.setHours(0, 0, 0, 0);
  return Math.round((limite.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));
}
