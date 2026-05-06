import { supabase } from '@/lib/supabase';
import { registrarAuditoria } from '@/lib/audit';

// =====================================================
// Garantías formales
// =====================================================

export type EstadoGarantia = 'activa' | 'vencida' | 'reclamada' | 'anulada';

export interface Garantia {
  id: string;
  numero: string;
  orden_venta_id?: string | null;
  orden_venta_numero?: string | null;
  cliente_id?: string | null;
  cliente_nombre?: string | null;
  producto_codigo: string;
  producto_nombre?: string | null;
  serial_numero?: string | null;
  lote_numero?: string | null;
  cantidad: number;
  duracion_meses: number;
  fecha_inicio: string;
  fecha_vencimiento: string;
  cobertura?: string | null;
  exclusiones?: string | null;
  condiciones?: string | null;
  estado: EstadoGarantia;
  ticket_reclamo_id?: string | null;
  rma_reclamo_id?: string | null;
  fecha_reclamo?: string | null;
  motivo_reclamo?: string | null;
  emitida_por?: string | null;
  notas?: string | null;
  created_at: string;
  updated_at: string;
}

export interface NuevaGarantia {
  cliente_id?: string;
  cliente_nombre?: string;
  orden_venta_id?: string;
  orden_venta_numero?: string;
  producto_codigo: string;
  producto_nombre?: string;
  serial_numero?: string;
  lote_numero?: string;
  cantidad?: number;
  duracion_meses: number;
  fecha_inicio?: string;
  cobertura?: string;
  exclusiones?: string;
  condiciones?: string;
  emitida_por: string;
  notas?: string;
}

function siguienteNumero(): string {
  const stamp = Date.now().toString().slice(-7);
  return `GAR-${new Date().getFullYear()}-${stamp}`;
}

export async function crearGarantia(g: NuevaGarantia): Promise<Garantia | null> {
  const numero = siguienteNumero();
  const inicio = g.fecha_inicio || new Date().toISOString().split('T')[0];
  const venc = new Date(inicio);
  venc.setMonth(venc.getMonth() + g.duracion_meses);
  const fechaVencimiento = venc.toISOString().split('T')[0];

  const { data, error } = await supabase.from('garantias').insert({
    numero,
    orden_venta_id: g.orden_venta_id || null,
    orden_venta_numero: g.orden_venta_numero || null,
    cliente_id: g.cliente_id || null,
    cliente_nombre: g.cliente_nombre || null,
    producto_codigo: g.producto_codigo,
    producto_nombre: g.producto_nombre || null,
    serial_numero: g.serial_numero || null,
    lote_numero: g.lote_numero || null,
    cantidad: g.cantidad ?? 1,
    duracion_meses: g.duracion_meses,
    fecha_inicio: inicio,
    fecha_vencimiento: fechaVencimiento,
    cobertura: g.cobertura || null,
    exclusiones: g.exclusiones || null,
    condiciones: g.condiciones || null,
    estado: 'activa',
    emitida_por: g.emitida_por,
    notas: g.notas || null,
  }).select().single();

  if (error || !data) {
    console.error('crearGarantia error:', error);
    return null;
  }

  await registrarAuditoria(
    'garantias', 'CREAR', numero, null,
    { producto: g.producto_codigo, duracion: g.duracion_meses, vence: fechaVencimiento },
    g.emitida_por
  );
  return data as Garantia;
}

export async function reclamarGarantia(
  id: string, motivo: string, ticketId: string | null,
  usuario: string
): Promise<boolean> {
  const { data: prev } = await supabase
    .from('garantias').select('numero, estado, fecha_vencimiento').eq('id', id).maybeSingle();
  if (!prev) return false;

  // Validar vigencia
  const venc = new Date(prev.fecha_vencimiento);
  if (venc < new Date()) {
    return false; // garantía vencida
  }
  if (prev.estado !== 'activa') return false;

  const { error } = await supabase.from('garantias').update({
    estado: 'reclamada',
    ticket_reclamo_id: ticketId,
    fecha_reclamo: new Date().toISOString(),
    motivo_reclamo: motivo,
    updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) return false;

  await registrarAuditoria(
    'garantias', 'RECLAMAR', prev.numero,
    { estado: prev.estado }, { estado: 'reclamada', motivo }, usuario
  );
  return true;
}

/**
 * Verifica si un serial/producto tiene garantía vigente.
 * Devuelve la garantía si está activa, null si no.
 */
export async function verificarGarantia(args: {
  serial?: string; productoCodigo?: string; clienteId?: string;
}): Promise<Garantia | null> {
  let q = supabase.from('garantias').select('*').eq('estado', 'activa');
  if (args.serial) q = q.eq('serial_numero', args.serial);
  else if (args.productoCodigo) q = q.eq('producto_codigo', args.productoCodigo);
  if (args.clienteId) q = q.eq('cliente_id', args.clienteId);
  q = q.gte('fecha_vencimiento', new Date().toISOString().split('T')[0])
       .order('fecha_vencimiento', { ascending: false })
       .limit(1);
  const { data } = await q.maybeSingle();
  return (data as Garantia) || null;
}

/**
 * Devuelve garantías que vencen en los próximos N días.
 * Útil para el scanner de notificaciones.
 */
export async function getGarantiasPorVencer(diasAdelante: number = 30): Promise<Garantia[]> {
  const hoy = new Date().toISOString().split('T')[0];
  const limite = new Date(Date.now() + diasAdelante * 86400000).toISOString().split('T')[0];
  const { data } = await supabase
    .from('garantias').select('*')
    .eq('estado', 'activa')
    .gte('fecha_vencimiento', hoy)
    .lte('fecha_vencimiento', limite)
    .order('fecha_vencimiento', { ascending: true });
  return (data || []) as Garantia[];
}

/**
 * Actualiza garantías activas que ya vencieron → estado 'vencida'.
 * Idempotente. Retorna cuántas se actualizaron.
 */
export async function cerrarGarantiasVencidas(): Promise<number> {
  const hoy = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('garantias')
    .update({ estado: 'vencida', updated_at: new Date().toISOString() })
    .eq('estado', 'activa')
    .lt('fecha_vencimiento', hoy)
    .select('id');
  if (error) return 0;
  return data?.length || 0;
}
