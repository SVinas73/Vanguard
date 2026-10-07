import { supabase } from '@/lib/supabase';

// ============================================
// TIPOS
// ============================================

export type TipoNotificacion =
  | 'stock_bajo'
  | 'sin_stock'
  | 'solicitud_insumo_creada'
  | 'solicitud_insumo_estado'
  | 'ticket_sla_breached'
  | 'ticket_critico'
  | 'garantia_por_vencer'
  | 'sistema';

export type SeveridadNotificacion = 'info' | 'warning' | 'error';

export interface Notificacion {
  id: string;
  tipo: TipoNotificacion;
  severidad: SeveridadNotificacion;
  titulo: string;
  mensaje: string;
  entidadTipo?: string;
  entidadId?: string;
  entidadCodigo?: string;
  usuarioEmail?: string | null;
  leida: boolean;
  leidaPor: string[];
  descartada: boolean;
  descartadaPor: string[];
  dedupKey?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  resueltaAt?: string | null;
}

export interface NuevaNotificacion {
  tipo: TipoNotificacion;
  severidad?: SeveridadNotificacion;
  titulo: string;
  mensaje: string;
  entidadTipo?: string;
  entidadId?: string;
  entidadCodigo?: string;
  usuarioEmail?: string | null;
  dedupKey?: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// CRUD HELPERS
// ============================================

/**
 * Crea una notificación. Si se provee `dedupKey` y ya
 * existe una notificación activa (no descartada) con la
 * misma clave, no se crea otra (idempotente).
 */
export async function crearNotificacion(n: NuevaNotificacion): Promise<void> {
  try {
    if (n.dedupKey) {
      const { data: existente } = await supabase
        .from('notificaciones')
        .select('id')
        .eq('dedup_key', n.dedupKey)
        .eq('descartada', false)
        .maybeSingle();
      if (existente) return;
    }

    await supabase.from('notificaciones').insert({
      tipo: n.tipo,
      severidad: n.severidad || 'info',
      titulo: n.titulo,
      mensaje: n.mensaje,
      entidad_tipo: n.entidadTipo || null,
      entidad_id: n.entidadId || null,
      entidad_codigo: n.entidadCodigo || null,
      usuario_email: n.usuarioEmail || null,
      dedup_key: n.dedupKey || null,
      metadata: n.metadata || {},
    });
  } catch (err) {
    console.error('Error creando notificación:', err);
  }
}

/**
 * Carga notificaciones visibles para un usuario.
 * Muestra:
 *  - notifs globales (usuario_email IS NULL)
 *  - notifs específicas del usuario actual
 * Filtra por:
 *  - no descartadas (ni globalmente ni por el usuario)
 *  - últimos N días (default 30)
 */
// Ventana en días para considerar un evento como "reciente".
// Solo se generan notifs cuando el evento (vencimiento, atraso)
// ocurrió dentro de esta ventana. Eventos viejos NO se muestran
// para evitar saturar al usuario con notifs históricas.
const VENTANA_EVENTO_DIAS = 7;

export async function cargarNotificaciones(
  usuarioEmail: string,
  diasAtras: number = 7
): Promise<Notificacion[]> {
  const desde = new Date();
  desde.setDate(desde.getDate() - diasAtras);

  const { data } = await supabase
    .from('notificaciones')
    .select('*')
    .or(`usuario_email.is.null,usuario_email.eq.${usuarioEmail}`)
    .eq('descartada', false)
    .gte('created_at', desde.toISOString())
    .order('created_at', { ascending: false })
    .limit(100);

  return (data || [])
    .filter((n: any) => !((n.descartada_por || []).includes(usuarioEmail)))
    .map((n: any): Notificacion => ({
      id: n.id,
      tipo: n.tipo,
      severidad: n.severidad,
      titulo: n.titulo,
      mensaje: n.mensaje,
      entidadTipo: n.entidad_tipo,
      entidadId: n.entidad_id,
      entidadCodigo: n.entidad_codigo,
      usuarioEmail: n.usuario_email,
      leida: n.leida || (n.leida_por || []).includes(usuarioEmail),
      leidaPor: n.leida_por || [],
      descartada: n.descartada,
      descartadaPor: n.descartada_por || [],
      dedupKey: n.dedup_key,
      metadata: n.metadata || {},
      createdAt: n.created_at,
      resueltaAt: n.resuelta_at,
    }));
}

export async function marcarLeida(id: string, usuarioEmail: string): Promise<void> {
  // Cargamos la notif para saber si es global o personal
  const { data: notif } = await supabase
    .from('notificaciones')
    .select('usuario_email, leida_por')
    .eq('id', id)
    .single();
  if (!notif) return;

  if (notif.usuario_email) {
    // Notif personal: leida = true
    await supabase.from('notificaciones').update({ leida: true }).eq('id', id);
  } else {
    // Notif global: agregar email al array si no está
    const arr: string[] = notif.leida_por || [];
    if (!arr.includes(usuarioEmail)) {
      await supabase.from('notificaciones').update({ leida_por: [...arr, usuarioEmail] }).eq('id', id);
    }
  }
}

export async function marcarTodasLeidas(
  usuarioEmail: string,
  notifs: Array<{ id: string }>
): Promise<void> {
  // Iteramos las notifs visibles del usuario y delegamos a
  // marcarLeida (que ya distingue personal vs global). Es
  // más simple y robusto que un update masivo y deja que
  // cada operación falle de forma aislada sin romper el resto.
  await Promise.all(notifs.map(n =>
    marcarLeida(n.id, usuarioEmail).catch(err =>
      console.error('Error marcando notif', n.id, err)
    )
  ));
}

export async function descartarNotificacion(id: string, usuarioEmail: string): Promise<void> {
  const { data: notif } = await supabase
    .from('notificaciones')
    .select('usuario_email, descartada_por')
    .eq('id', id)
    .single();
  if (!notif) return;

  if (notif.usuario_email) {
    await supabase.from('notificaciones')
      .update({ descartada: true, resuelta_at: new Date().toISOString() })
      .eq('id', id);
  } else {
    const arr: string[] = notif.descartada_por || [];
    if (!arr.includes(usuarioEmail)) {
      await supabase.from('notificaciones')
        .update({ descartada_por: [...arr, usuarioEmail] })
        .eq('id', id);
    }
  }
}

/**
 * Marca como descartadas (resueltas) todas las notifs
 * cuyo `dedup_key` empieza con `prefix` y que NO están
 * en `keysVigentes`. Útil cuando re-escaneamos eventos:
 * las que ya no aplican se cierran automáticamente.
 */
export async function cerrarNotificacionesObsoletas(
  prefix: string,
  keysVigentes: Set<string>
): Promise<void> {
  const { data } = await supabase
    .from('notificaciones')
    .select('id, dedup_key')
    .like('dedup_key', `${prefix}%`)
    .eq('descartada', false);

  const obsoletas = (data || []).filter((n: any) => !keysVigentes.has(n.dedup_key));
  if (obsoletas.length === 0) return;

  const ids = obsoletas.map((n: any) => n.id);
  await supabase
    .from('notificaciones')
    .update({ descartada: true, resuelta_at: new Date().toISOString() })
    .in('id', ids);
}

// ============================================
// SCANNERS — generan notifs según estado actual
// ============================================

/**
 * Escanea el estado actual (post-venta) y genera notifs
 * para condiciones que aún no tienen una notif activa
 * con su dedup_key. Cierra las que ya no aplican.
 *
 * Se llama bajo demanda (ej: al abrir el bell o al
 * iniciar sesión). Es idempotente y barato.
 */
export async function escanearAlertasComerciales(): Promise<void> {
  await Promise.all([
    scanTicketsSLABreached(),
    scanTicketsCriticos(),
    scanGarantiasPorVencer(),
  ]);
}

// =====================================================
// SCANNERS — Post-venta
// =====================================================

async function scanTicketsSLABreached(): Promise<void> {
  const ahora = new Date().toISOString();
  const desdeWindow = new Date(Date.now() - VENTANA_EVENTO_DIAS * 86400000).toISOString();

  const { data } = await supabase
    .from('tickets_soporte')
    .select('id, numero, asunto, prioridad, sla_vencimiento, asignado_a')
    .in('estado', ['abierto', 'en_progreso', 'esperando_cliente', 'esperando_repuesto'])
    .lt('sla_vencimiento', ahora)
    .gte('sla_vencimiento', desdeWindow);

  const keysVigentes = new Set<string>();
  for (const t of (data || []) as any[]) {
    const key = `ticket_sla:${t.id}`;
    keysVigentes.add(key);
    const horasAtraso = Math.round((Date.now() - new Date(t.sla_vencimiento).getTime()) / 3600000);
    await crearNotificacion({
      tipo: 'ticket_sla_breached',
      severidad: t.prioridad === 'critica' ? 'error' : 'warning',
      titulo: 'SLA vencido',
      mensaje: `${t.numero}: ${t.asunto.slice(0, 60)} · ${horasAtraso}h atraso · ${t.asignado_a || 'sin asignar'}`,
      entidadTipo: 'ticket_soporte',
      entidadId: t.id,
      entidadCodigo: t.numero,
      usuarioEmail: t.asignado_a || null,
      dedupKey: key,
      metadata: { horas_atraso: horasAtraso },
    });
  }
  await cerrarNotificacionesObsoletas('ticket_sla:', keysVigentes);
}

async function scanTicketsCriticos(): Promise<void> {
  const desde = new Date(Date.now() - VENTANA_EVENTO_DIAS * 86400000).toISOString();
  const { data } = await supabase
    .from('tickets_soporte')
    .select('id, numero, asunto, asignado_a')
    .eq('prioridad', 'critica')
    .in('estado', ['abierto', 'en_progreso'])
    .gte('fecha_apertura', desde);

  const keysVigentes = new Set<string>();
  for (const t of (data || []) as any[]) {
    const key = `ticket_critico:${t.id}`;
    keysVigentes.add(key);
    await crearNotificacion({
      tipo: 'ticket_critico',
      severidad: 'error',
      titulo: 'Ticket crítico abierto',
      mensaje: `${t.numero}: ${t.asunto.slice(0, 70)}`,
      entidadTipo: 'ticket_soporte',
      entidadId: t.id,
      entidadCodigo: t.numero,
      usuarioEmail: t.asignado_a || null,
      dedupKey: key,
    });
  }
  await cerrarNotificacionesObsoletas('ticket_critico:', keysVigentes);
}

async function scanGarantiasPorVencer(): Promise<void> {
  const hoy = new Date().toISOString().split('T')[0];
  const en30Dias = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const { data } = await supabase
    .from('garantias')
    .select('id, numero, producto_codigo, producto_nombre, cliente_nombre, fecha_vencimiento')
    .eq('estado', 'activa')
    .gte('fecha_vencimiento', hoy)
    .lte('fecha_vencimiento', en30Dias);

  const keysVigentes = new Set<string>();
  for (const g of (data || []) as any[]) {
    const key = `garantia_vencer:${g.id}`;
    keysVigentes.add(key);
    const dias = Math.ceil((new Date(g.fecha_vencimiento).getTime() - Date.now()) / 86400000);
    await crearNotificacion({
      tipo: 'garantia_por_vencer',
      severidad: dias <= 7 ? 'warning' : 'info',
      titulo: 'Garantía por vencer',
      mensaje: `${g.numero} de ${g.cliente_nombre || 'cliente'} (${g.producto_nombre || g.producto_codigo}) vence en ${dias} día(s)`,
      entidadTipo: 'garantia',
      entidadId: g.id,
      entidadCodigo: g.numero,
      dedupKey: key,
      metadata: { dias_restantes: dias, fecha_vencimiento: g.fecha_vencimiento },
    });
  }
  await cerrarNotificacionesObsoletas('garantia_vencer:', keysVigentes);
}

/**
 * Escanea stock crítico. Recibe los productos del store
 * y genera/cierra notifs según la condición actual.
 */
export async function escanearStock(productos: Array<{ codigo: string; descripcion: string; stock: number; stockMinimo: number }>): Promise<void> {
  const keysVigentes = new Set<string>();

  // Agregamos en UN resumen por categoría (en vez de una notif por producto)
  // para no inundar la campanita. La key incluye el conteo: si cambia, se
  // cierra el resumen viejo y se crea el nuevo (cerrarNotificacionesObsoletas
  // también limpia las notifs por-producto del esquema anterior).
  const sinStock = productos.filter(p => p.stock === 0);
  const bajos = productos.filter(p => p.stock > 0 && p.stockMinimo > 0 && p.stock <= p.stockMinimo);

  if (sinStock.length > 0) {
    const key = `sin_stock:resumen:${sinStock.length}`;
    keysVigentes.add(key);
    const muestra = sinStock.slice(0, 6).map(p => p.descripcion).join(', ');
    await crearNotificacion({
      tipo: 'sin_stock',
      severidad: 'error',
      titulo: `${sinStock.length} producto${sinStock.length === 1 ? '' : 's'} sin stock`,
      mensaje: muestra + (sinStock.length > 6 ? `, y ${sinStock.length - 6} más` : ''),
      entidadTipo: 'producto',
      entidadId: 'resumen',
      dedupKey: key,
      metadata: { codigos: sinStock.map(p => p.codigo) },
    });
  }

  if (bajos.length > 0) {
    const key = `stock_bajo:resumen:${bajos.length}`;
    keysVigentes.add(key);
    const muestra = bajos.slice(0, 6).map(p => `${p.descripcion} (${p.stock})`).join(', ');
    await crearNotificacion({
      tipo: 'stock_bajo',
      severidad: 'warning',
      titulo: `${bajos.length} producto${bajos.length === 1 ? '' : 's'} con stock bajo`,
      mensaje: muestra + (bajos.length > 6 ? `, y ${bajos.length - 6} más` : ''),
      entidadTipo: 'producto',
      entidadId: 'resumen',
      dedupKey: key,
      metadata: { codigos: bajos.map(p => p.codigo) },
    });
  }

  await cerrarNotificacionesObsoletas('sin_stock:', keysVigentes);
  await cerrarNotificacionesObsoletas('stock_bajo:', keysVigentes);
}
