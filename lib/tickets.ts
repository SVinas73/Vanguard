import { supabase } from '@/lib/supabase';
import { registrarAuditoria } from '@/lib/audit';

// =====================================================
// Tickets de soporte
// =====================================================

export type EstadoTicket =
  | 'abierto' | 'en_progreso' | 'esperando_cliente'
  | 'esperando_repuesto' | 'resuelto' | 'cerrado' | 'cancelado';

export type PrioridadTicket = 'baja' | 'normal' | 'alta' | 'critica';

export type CategoriaTicket =
  | 'consulta' | 'falla_producto' | 'reclamo' | 'pedido_info'
  | 'cambio' | 'devolucion' | 'instalacion' | 'otro';

export type CanalTicket =
  | 'web' | 'email' | 'telefono' | 'whatsapp' | 'presencial';

export interface Ticket {
  id: string;
  numero: string;
  cliente_id?: string | null;
  cliente_nombre?: string | null;
  cliente_email?: string | null;
  cliente_telefono?: string | null;
  canal: CanalTicket;
  categoria?: CategoriaTicket;
  asunto: string;
  descripcion?: string | null;
  orden_venta_id?: string | null;
  orden_venta_numero?: string | null;
  producto_codigo?: string | null;
  serial_numero?: string | null;
  rma_id?: string | null;
  estado: EstadoTicket;
  prioridad: PrioridadTicket;
  sla_horas?: number | null;
  sla_vencimiento?: string | null;
  sla_breached: boolean;
  asignado_a?: string | null;
  asignado_por?: string | null;
  solucion?: string | null;
  satisfaccion?: number | null;
  comentario_cliente?: string | null;
  creado_por: string;
  cerrado_por?: string | null;
  fecha_apertura: string;
  fecha_primera_respuesta?: string | null;
  fecha_resolucion?: string | null;
  fecha_cierre?: string | null;
  updated_at: string;
}

export interface NuevoTicket {
  asunto: string;
  descripcion?: string;
  cliente_id?: string;
  cliente_nombre?: string;
  cliente_email?: string;
  cliente_telefono?: string;
  canal?: CanalTicket;
  categoria?: CategoriaTicket;
  prioridad?: PrioridadTicket;
  orden_venta_id?: string;
  orden_venta_numero?: string;
  producto_codigo?: string;
  serial_numero?: string;
  asignado_a?: string;
  creado_por: string;
}

// =====================================================
// SLA — calcular vencimiento al crear el ticket
// =====================================================

async function getSLAHoras(categoria: string, prioridad: string): Promise<number> {
  const { data } = await supabase
    .from('tickets_sla_config')
    .select('horas_sla')
    .eq('categoria', categoria)
    .eq('prioridad', prioridad)
    .eq('activa', true)
    .maybeSingle();
  if (data?.horas_sla) return data.horas_sla;

  // Defaults razonables si no hay config
  const fallback: Record<string, number> = {
    critica: 4, alta: 24, normal: 72, baja: 168,
  };
  return fallback[prioridad] ?? 72;
}

function siguienteNumero(): string {
  const stamp = Date.now().toString().slice(-7);
  return `TK-${new Date().getFullYear()}-${stamp}`;
}

// =====================================================
// CRUD
// =====================================================

export async function crearTicket(t: NuevoTicket): Promise<Ticket | null> {
  const numero = siguienteNumero();
  const categoria = t.categoria || 'consulta';
  const prioridad = t.prioridad || 'normal';
  const horas = await getSLAHoras(categoria, prioridad);
  const slaVencimiento = new Date(Date.now() + horas * 3600 * 1000).toISOString();

  const { data, error } = await supabase
    .from('tickets_soporte')
    .insert({
      numero,
      asunto: t.asunto,
      descripcion: t.descripcion || null,
      cliente_id: t.cliente_id || null,
      cliente_nombre: t.cliente_nombre || null,
      cliente_email: t.cliente_email || null,
      cliente_telefono: t.cliente_telefono || null,
      canal: t.canal || 'web',
      categoria,
      prioridad,
      orden_venta_id: t.orden_venta_id || null,
      orden_venta_numero: t.orden_venta_numero || null,
      producto_codigo: t.producto_codigo || null,
      serial_numero: t.serial_numero || null,
      asignado_a: t.asignado_a || null,
      asignado_por: t.asignado_a ? t.creado_por : null,
      sla_horas: horas,
      sla_vencimiento: slaVencimiento,
      estado: 'abierto',
      creado_por: t.creado_por,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('crearTicket error:', error);
    return null;
  }

  await registrarAuditoria(
    'tickets_soporte', 'CREAR', numero, null,
    { asunto: t.asunto, categoria, prioridad, sla_horas: horas },
    t.creado_por
  );
  return data as Ticket;
}

export async function cambiarEstadoTicket(
  id: string,
  nuevo: EstadoTicket,
  usuario: string,
  notas?: string
): Promise<boolean> {
  const { data: prev } = await supabase
    .from('tickets_soporte')
    .select('numero, estado, fecha_primera_respuesta')
    .eq('id', id).maybeSingle();
  if (!prev) return false;

  const update: any = { estado: nuevo, updated_at: new Date().toISOString() };

  // Marcar primera respuesta cuando agente toca un ticket abierto
  if (prev.estado === 'abierto' && !prev.fecha_primera_respuesta &&
      ['en_progreso', 'resuelto', 'esperando_cliente'].includes(nuevo)) {
    update.fecha_primera_respuesta = new Date().toISOString();
  }

  if (nuevo === 'resuelto') update.fecha_resolucion = new Date().toISOString();
  if (nuevo === 'cerrado') {
    update.fecha_cierre = new Date().toISOString();
    update.cerrado_por = usuario;
  }
  if (notas) update.solucion = notas;

  const { error } = await supabase.from('tickets_soporte').update(update).eq('id', id);
  if (error) return false;

  await registrarAuditoria(
    'tickets_soporte', `ESTADO_${nuevo.toUpperCase()}`, prev.numero,
    { estado: prev.estado }, { estado: nuevo, notas }, usuario
  );
  return true;
}

export async function asignarTicket(id: string, agente: string, asignadoPor: string): Promise<boolean> {
  const { data: prev } = await supabase
    .from('tickets_soporte').select('numero, asignado_a').eq('id', id).maybeSingle();
  if (!prev) return false;
  const { error } = await supabase.from('tickets_soporte').update({
    asignado_a: agente, asignado_por: asignadoPor, updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) return false;
  await registrarAuditoria(
    'tickets_soporte', 'ASIGNAR', prev.numero,
    { asignado_a: prev.asignado_a }, { asignado_a: agente }, asignadoPor
  );
  return true;
}

export async function agregarComentario(
  ticketId: string, autor: string, contenido: string,
  rol: 'agente' | 'cliente' | 'sistema' = 'agente',
  visibleCliente: boolean = true
): Promise<boolean> {
  const { error } = await supabase.from('tickets_comentarios').insert({
    ticket_id: ticketId, autor, rol, contenido, visible_cliente: visibleCliente,
  });
  if (error) return false;
  await supabase.from('tickets_soporte').update({
    updated_at: new Date().toISOString()
  }).eq('id', ticketId);
  return true;
}

export async function getTicketsAbiertos(asignadoA?: string): Promise<Ticket[]> {
  let q = supabase
    .from('tickets_soporte').select('*')
    .not('estado', 'in', '("cerrado","cancelado")')
    .order('prioridad', { ascending: false })
    .order('fecha_apertura', { ascending: true })
    .limit(200);
  if (asignadoA) q = q.eq('asignado_a', asignadoA);
  const { data } = await q;
  return (data || []) as Ticket[];
}

export async function getTicketsBreached(): Promise<Ticket[]> {
  const ahora = new Date().toISOString();
  const { data } = await supabase
    .from('tickets_soporte').select('*')
    .in('estado', ['abierto', 'en_progreso', 'esperando_cliente', 'esperando_repuesto'])
    .lt('sla_vencimiento', ahora)
    .order('sla_vencimiento', { ascending: true });
  return (data || []) as Ticket[];
}
