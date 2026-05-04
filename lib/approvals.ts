import { supabase } from '@/lib/supabase';
import { registrarAuditoria } from '@/lib/audit';

// =====================================================
// Sistema unificado de aprobaciones
// =====================================================
// Lo usan los flujos sensibles: NC/ND grandes, comisiones,
// ajustes de stock por encima del umbral, etc.
//
// Workflow: pendiente → aprobada | rechazada | cancelada
// =====================================================

export type EstadoAprobacion = 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada';

export type OrigenAprobacion =
  | 'nota_credito_debito'
  | 'comision'
  | 'ajuste_stock'
  | 'orden_compra'
  | 'cotizacion'
  | 'reposicion_grande';

export type Prioridad = 'baja' | 'normal' | 'alta' | 'critica';

export interface Aprobacion {
  id: string;
  numero: string;
  origen_tipo: OrigenAprobacion;
  origen_id?: string | null;
  origen_codigo?: string | null;
  titulo: string;
  descripcion?: string | null;
  monto?: number | null;
  moneda?: string | null;
  cantidad?: number | null;
  payload: Record<string, unknown>;
  estado: EstadoAprobacion;
  prioridad: Prioridad;
  solicitado_por: string;
  asignado_a?: string | null;
  resuelto_por?: string | null;
  comentario_resolucion?: string | null;
  fecha_solicitud: string;
  fecha_resolucion?: string | null;
  fecha_limite?: string | null;
  created_at: string;
}

export interface NuevaAprobacion {
  origenTipo: OrigenAprobacion;
  origenId?: string;
  origenCodigo?: string;
  titulo: string;
  descripcion?: string;
  monto?: number;
  moneda?: string;
  cantidad?: number;
  payload?: Record<string, unknown>;
  prioridad?: Prioridad;
  solicitadoPor: string;
  asignadoA?: string;
  fechaLimite?: string;
}

// =====================================================
// CONFIGURACIÓN — umbral por tipo
// =====================================================

export interface ConfigUmbral {
  tipo: OrigenAprobacion;
  umbral_monto?: number | null;
  umbral_cantidad?: number | null;
  moneda?: string | null;
  activa: boolean;
}

export async function getConfigUmbral(tipo: OrigenAprobacion): Promise<ConfigUmbral | null> {
  const { data } = await supabase
    .from('aprobaciones_config')
    .select('tipo, umbral_monto, umbral_cantidad, moneda, activa')
    .eq('tipo', tipo)
    .maybeSingle();
  return (data as ConfigUmbral) || null;
}

/**
 * Decide si un caso requiere aprobación según los umbrales
 * configurados. Devuelve true si:
 *   - el monto supera umbral_monto, o
 *   - la cantidad supera umbral_cantidad.
 * Si no hay umbral configurado o config.activa = false → false.
 */
export async function requiereAprobacion(
  tipo: OrigenAprobacion,
  monto?: number,
  cantidad?: number
): Promise<boolean> {
  const cfg = await getConfigUmbral(tipo);
  if (!cfg || !cfg.activa) return false;
  if (cfg.umbral_monto != null && monto != null && Math.abs(monto) > cfg.umbral_monto) return true;
  if (cfg.umbral_cantidad != null && cantidad != null && Math.abs(cantidad) > cfg.umbral_cantidad) return true;
  return false;
}

// =====================================================
// CRUD
// =====================================================

export async function crearAprobacion(a: NuevaAprobacion): Promise<Aprobacion | null> {
  const numero = `APR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const { data, error } = await supabase
    .from('aprobaciones')
    .insert({
      numero,
      origen_tipo: a.origenTipo,
      origen_id: a.origenId || null,
      origen_codigo: a.origenCodigo || null,
      titulo: a.titulo,
      descripcion: a.descripcion || null,
      monto: a.monto ?? null,
      moneda: a.moneda || null,
      cantidad: a.cantidad ?? null,
      payload: a.payload || {},
      estado: 'pendiente',
      prioridad: a.prioridad || 'normal',
      solicitado_por: a.solicitadoPor,
      asignado_a: a.asignadoA || null,
      fecha_limite: a.fechaLimite || null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('crearAprobacion error:', error);
    return null;
  }

  await registrarAuditoria(
    'aprobaciones',
    'CREAR',
    numero,
    null,
    { origen: a.origenTipo, monto: a.monto, cantidad: a.cantidad },
    a.solicitadoPor
  );

  return data as Aprobacion;
}

export async function aprobar(id: string, comentario: string, usuario: string): Promise<boolean> {
  const { data: prev } = await supabase
    .from('aprobaciones').select('numero, estado').eq('id', id).maybeSingle();
  if (!prev || prev.estado !== 'pendiente') return false;

  const { error } = await supabase.from('aprobaciones').update({
    estado: 'aprobada',
    resuelto_por: usuario,
    comentario_resolucion: comentario,
    fecha_resolucion: new Date().toISOString(),
  }).eq('id', id);
  if (error) return false;

  await registrarAuditoria(
    'aprobaciones', 'APROBAR', prev.numero,
    { estado: prev.estado }, { estado: 'aprobada', comentario }, usuario
  );
  return true;
}

export async function rechazar(id: string, motivo: string, usuario: string): Promise<boolean> {
  const { data: prev } = await supabase
    .from('aprobaciones').select('numero, estado').eq('id', id).maybeSingle();
  if (!prev || prev.estado !== 'pendiente') return false;

  const { error } = await supabase.from('aprobaciones').update({
    estado: 'rechazada',
    resuelto_por: usuario,
    comentario_resolucion: motivo,
    fecha_resolucion: new Date().toISOString(),
  }).eq('id', id);
  if (error) return false;

  await registrarAuditoria(
    'aprobaciones', 'RECHAZAR', prev.numero,
    { estado: prev.estado }, { estado: 'rechazada', motivo }, usuario
  );
  return true;
}

// =====================================================
// CONSULTAS
// =====================================================

export async function getAprobacionesPendientes(usuario?: string): Promise<Aprobacion[]> {
  let q = supabase
    .from('aprobaciones')
    .select('*')
    .eq('estado', 'pendiente')
    .order('prioridad', { ascending: false })
    .order('fecha_solicitud', { ascending: true })
    .limit(100);
  if (usuario) {
    q = q.or(`asignado_a.is.null,asignado_a.eq.${usuario}`);
  }
  const { data } = await q;
  return (data || []) as Aprobacion[];
}

export async function getAprobacion(id: string): Promise<Aprobacion | null> {
  const { data } = await supabase
    .from('aprobaciones')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return (data as Aprobacion) || null;
}

export async function getAprobacionPorOrigen(
  origenTipo: OrigenAprobacion,
  origenId: string
): Promise<Aprobacion | null> {
  const { data } = await supabase
    .from('aprobaciones')
    .select('*')
    .eq('origen_tipo', origenTipo)
    .eq('origen_id', origenId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Aprobacion) || null;
}
