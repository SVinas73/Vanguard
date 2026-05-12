import { supabase } from '@/lib/supabase';

// =====================================================
// RRHH — Recursos Humanos
// =====================================================
// CRUD básico de empleados + asistencia + solicitudes.
// =====================================================

export type EstadoEmpleado = 'activo' | 'licencia' | 'suspendido' | 'baja';
export type TipoContrato   = 'efectivo' | 'temporal' | 'pasantia' | 'freelance';
export type Jornada        = 'full' | 'part' | 'turno_rotativo';
export type TipoSolicitud  = 'vacaciones' | 'licencia_medica' | 'personal' | 'estudio' | 'otro';
export type EstadoSolicitud = 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada';

export interface Empleado {
  id: string;
  legajo?: string | null;
  user_email?: string | null;
  nombre: string;
  apellido: string;
  dni?: string | null;
  fecha_nacimiento?: string | null;
  email_personal?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  ciudad?: string | null;

  cargo: string;
  area: string;
  fecha_ingreso: string;
  fecha_egreso?: string | null;
  tipo_contrato: TipoContrato;
  jornada: Jornada;
  sueldo_base?: number | null;
  moneda: string;

  estado: EstadoEmpleado;
  foto_url?: string | null;
  notas?: string | null;

  solicitudes_pendientes?: number;
  ultima_entrada?: string | null;
}

export interface NuevoEmpleado {
  nombre: string;
  apellido: string;
  cargo: string;
  area: string;
  fecha_ingreso: string;
  legajo?: string;
  user_email?: string;
  dni?: string;
  fecha_nacimiento?: string;
  email_personal?: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  tipo_contrato?: TipoContrato;
  jornada?: Jornada;
  sueldo_base?: number;
  moneda?: string;
  foto_url?: string;
  notas?: string;
}

export interface Asistencia {
  id: string;
  empleado_id: string;
  fecha: string;
  hora_entrada?: string | null;
  hora_salida?: string | null;
  minutos_trabajados?: number | null;
  observaciones?: string | null;
  origen: string;
}

export interface Solicitud {
  id: string;
  empleado_id: string;
  tipo: TipoSolicitud;
  fecha_inicio: string;
  fecha_fin: string;
  dias_solicitados: number;
  motivo?: string | null;
  adjunto_url?: string | null;
  estado: EstadoSolicitud;
  aprobado_por?: string | null;
  fecha_aprobacion?: string | null;
  observaciones_aprobacion?: string | null;
  creado_por?: string | null;
  creado_at: string;

  empleado?: Pick<Empleado, 'id' | 'nombre' | 'apellido' | 'area' | 'cargo'>;
}

// =====================================================
// EMPLEADOS
// =====================================================

export async function listarEmpleados(filtros?: {
  estado?: EstadoEmpleado;
  area?: string;
}): Promise<Empleado[]> {
  let q = supabase
    .from('rrhh_empleados_resumen')
    .select('*')
    .order('apellido', { ascending: true });

  if (filtros?.estado) q = q.eq('estado', filtros.estado);
  if (filtros?.area)   q = q.eq('area', filtros.area);

  const { data, error } = await q;
  if (error) {
    console.error('listarEmpleados error:', error);
    return [];
  }
  return (data as Empleado[]) || [];
}

export async function obtenerEmpleado(id: string): Promise<Empleado | null> {
  const { data, error } = await supabase
    .from('rrhh_empleados_resumen').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.error('obtenerEmpleado error:', error);
    return null;
  }
  return data as Empleado | null;
}

export async function crearEmpleado(nuevo: NuevoEmpleado, usuario: string): Promise<Empleado | null> {
  const payload = {
    ...nuevo,
    tipo_contrato: nuevo.tipo_contrato || 'efectivo',
    jornada: nuevo.jornada || 'full',
    moneda: nuevo.moneda || 'UYU',
    creado_por: usuario,
    actualizado_por: usuario,
  };
  const { data, error } = await supabase
    .from('rrhh_empleados').insert(payload).select().single();
  if (error) {
    console.error('crearEmpleado error:', error);
    return null;
  }
  return data as Empleado;
}

export async function actualizarEmpleado(id: string, cambios: Partial<NuevoEmpleado> & { estado?: EstadoEmpleado }, usuario: string): Promise<boolean> {
  const { error } = await supabase
    .from('rrhh_empleados')
    .update({ ...cambios, actualizado_por: usuario, actualizado_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.error('actualizarEmpleado error:', error);
    return false;
  }
  return true;
}

export async function darDeBaja(id: string, usuario: string): Promise<boolean> {
  const { error } = await supabase
    .from('rrhh_empleados')
    .update({
      estado: 'baja',
      fecha_egreso: new Date().toISOString().split('T')[0],
      actualizado_por: usuario,
      actualizado_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) {
    console.error('darDeBaja error:', error);
    return false;
  }
  return true;
}

// =====================================================
// ASISTENCIA
// =====================================================

export async function fichadaEntrada(empleadoId: string): Promise<boolean> {
  const hoy = new Date().toISOString().split('T')[0];
  const ahora = new Date().toISOString();
  // Upsert por (empleado_id, fecha)
  const { error } = await supabase
    .from('rrhh_asistencia')
    .upsert(
      { empleado_id: empleadoId, fecha: hoy, hora_entrada: ahora, origen: 'web' },
      { onConflict: 'empleado_id,fecha' }
    );
  if (error) {
    console.error('fichadaEntrada error:', error);
    return false;
  }
  return true;
}

export async function fichadaSalida(empleadoId: string): Promise<boolean> {
  const hoy = new Date().toISOString().split('T')[0];
  const ahora = new Date();
  // Obtener entrada para calcular minutos
  const { data: existing } = await supabase
    .from('rrhh_asistencia')
    .select('hora_entrada')
    .eq('empleado_id', empleadoId).eq('fecha', hoy).maybeSingle();

  let minutos: number | null = null;
  if (existing?.hora_entrada) {
    minutos = Math.round((ahora.getTime() - new Date(existing.hora_entrada).getTime()) / 60000);
  }

  const { error } = await supabase
    .from('rrhh_asistencia')
    .upsert(
      { empleado_id: empleadoId, fecha: hoy, hora_salida: ahora.toISOString(), minutos_trabajados: minutos, origen: 'web' },
      { onConflict: 'empleado_id,fecha' }
    );
  if (error) {
    console.error('fichadaSalida error:', error);
    return false;
  }
  return true;
}

export async function asistenciaDelDia(fecha?: string): Promise<Asistencia[]> {
  const f = fecha || new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('rrhh_asistencia').select('*').eq('fecha', f);
  if (error) return [];
  return data as Asistencia[];
}

export async function asistenciaEmpleado(empleadoId: string, desde?: string, hasta?: string): Promise<Asistencia[]> {
  let q = supabase.from('rrhh_asistencia').select('*').eq('empleado_id', empleadoId).order('fecha', { ascending: false });
  if (desde) q = q.gte('fecha', desde);
  if (hasta) q = q.lte('fecha', hasta);
  const { data } = await q;
  return (data as Asistencia[]) || [];
}

// =====================================================
// SOLICITUDES
// =====================================================

export async function listarSolicitudes(filtros?: {
  estado?: EstadoSolicitud;
  empleadoId?: string;
}): Promise<Solicitud[]> {
  let q = supabase
    .from('rrhh_solicitudes')
    .select('*, empleado:rrhh_empleados(id, nombre, apellido, area, cargo)')
    .order('creado_at', { ascending: false });

  if (filtros?.estado)     q = q.eq('estado', filtros.estado);
  if (filtros?.empleadoId) q = q.eq('empleado_id', filtros.empleadoId);

  const { data, error } = await q;
  if (error) {
    console.error('listarSolicitudes error:', error);
    return [];
  }
  return (data as Solicitud[]) || [];
}

export async function crearSolicitud(s: {
  empleadoId: string;
  tipo: TipoSolicitud;
  fechaInicio: string;
  fechaFin: string;
  motivo?: string;
  adjuntoUrl?: string;
}, usuario: string): Promise<Solicitud | null> {
  const dias = Math.round(
    (new Date(s.fechaFin).getTime() - new Date(s.fechaInicio).getTime()) / 86400000
  ) + 1;
  const payload = {
    empleado_id: s.empleadoId,
    tipo: s.tipo,
    fecha_inicio: s.fechaInicio,
    fecha_fin: s.fechaFin,
    dias_solicitados: dias,
    motivo: s.motivo || null,
    adjunto_url: s.adjuntoUrl || null,
    creado_por: usuario,
  };
  const { data, error } = await supabase
    .from('rrhh_solicitudes').insert(payload).select().single();
  if (error) {
    console.error('crearSolicitud error:', error);
    return null;
  }
  return data as Solicitud;
}

export async function aprobarSolicitud(id: string, usuario: string, observaciones?: string): Promise<boolean> {
  const { error } = await supabase
    .from('rrhh_solicitudes')
    .update({
      estado: 'aprobada',
      aprobado_por: usuario,
      fecha_aprobacion: new Date().toISOString(),
      observaciones_aprobacion: observaciones || null,
      actualizado_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) {
    console.error('aprobarSolicitud error:', error);
    return false;
  }
  return true;
}

export async function rechazarSolicitud(id: string, usuario: string, motivo: string): Promise<boolean> {
  const { error } = await supabase
    .from('rrhh_solicitudes')
    .update({
      estado: 'rechazada',
      aprobado_por: usuario,
      fecha_aprobacion: new Date().toISOString(),
      observaciones_aprobacion: motivo,
      actualizado_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) {
    console.error('rechazarSolicitud error:', error);
    return false;
  }
  return true;
}

// =====================================================
// MÉTRICAS / DASHBOARD
// =====================================================

export interface RRHHMetricas {
  totalEmpleados: number;
  activos: number;
  enLicencia: number;
  bajas: number;
  cumpleanieros: Empleado[];   // del mes en curso
  fichadosHoy: number;
  solicitudesPendientes: number;
  porArea: Record<string, number>;
}

export async function obtenerMetricas(): Promise<RRHHMetricas> {
  const empleados = await listarEmpleados();
  const activos    = empleados.filter(e => e.estado === 'activo').length;
  const enLicencia = empleados.filter(e => e.estado === 'licencia').length;
  const bajas      = empleados.filter(e => e.estado === 'baja').length;

  const mesActual = new Date().getMonth();
  const cumpleanieros = empleados.filter(e => {
    if (!e.fecha_nacimiento) return false;
    return new Date(e.fecha_nacimiento + 'T00:00:00').getMonth() === mesActual;
  });

  const hoy = new Date().toISOString().split('T')[0];
  const { count: fichadosHoy } = await supabase
    .from('rrhh_asistencia').select('id', { count: 'exact', head: true })
    .eq('fecha', hoy).not('hora_entrada', 'is', null);

  const { count: solicitudesPendientes } = await supabase
    .from('rrhh_solicitudes').select('id', { count: 'exact', head: true })
    .eq('estado', 'pendiente');

  const porArea: Record<string, number> = {};
  empleados.forEach(e => {
    if (e.estado === 'activo') porArea[e.area] = (porArea[e.area] || 0) + 1;
  });

  return {
    totalEmpleados: empleados.length,
    activos, enLicencia, bajas,
    cumpleanieros,
    fichadosHoy: fichadosHoy ?? 0,
    solicitudesPendientes: solicitudesPendientes ?? 0,
    porArea,
  };
}
