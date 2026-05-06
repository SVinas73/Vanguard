import { supabase } from '@/lib/supabase';

// ============================================
// TIPOS
// ============================================

export type TipoNotificacion =
  | 'stock_bajo'
  | 'sin_stock'
  | 'cotizacion_por_vencer'
  | 'cotizacion_vencida'
  | 'cxc_vencida'
  | 'cxp_vencida'
  | 'orden_sin_entregar'
  | 'putaway_pendiente'
  | 'picking_sin_asignar'
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
 * Escanea el estado comercial actual y genera notifs
 * para condiciones que aún no tienen una notif activa
 * con su dedup_key. Cierra las que ya no aplican.
 *
 * Se llama bajo demanda (ej: al abrir el bell o al
 * iniciar sesión). Es idempotente y barato.
 */
export async function escanearAlertasComerciales(): Promise<void> {
  await Promise.all([
    scanCotizacionesPorVencer(),
    scanCxcVencidas(),
    scanOrdenesSinEntregar(),
    scanWmsPutawayPendiente(),
    scanWmsPickingSinAsignar(),
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

// WMS: tareas de putaway que llevan más de 1 día pendientes
async function scanWmsPutawayPendiente(): Promise<void> {
  const ayer = new Date(Date.now() - 86400000).toISOString();
  const hoy = new Date().toISOString();
  const { data } = await supabase
    .from('wms_tareas_putaway')
    .select('id, producto_codigo, producto_nombre, cantidad, ubicacion_destino_codigo, created_at')
    .eq('estado', 'pendiente')
    .lte('created_at', ayer)
    .gte('created_at', new Date(Date.now() - VENTANA_EVENTO_DIAS * 86400000).toISOString());

  const keysVigentes = new Set<string>();
  for (const t of (data || []) as any[]) {
    void hoy;
    const key = `putaway_pendiente:${t.id}`;
    keysVigentes.add(key);
    await crearNotificacion({
      tipo: 'putaway_pendiente',
      severidad: 'warning',
      titulo: 'Putaway pendiente',
      mensaje: `${t.producto_nombre || t.producto_codigo} (${t.cantidad} uds) sin acomodar en ${t.ubicacion_destino_codigo || 'destino'}`,
      entidadTipo: 'wms_tareas_putaway',
      entidadId: t.id,
      dedupKey: key,
    });
  }
  await cerrarNotificacionesObsoletas('putaway_pendiente:', keysVigentes);
}

// WMS: órdenes de picking sin picker asignado y con más de 4hs
async function scanWmsPickingSinAsignar(): Promise<void> {
  const haceCuatroHs = new Date(Date.now() - 4 * 3600 * 1000).toISOString();
  const { data } = await supabase
    .from('wms_ordenes_picking')
    .select('id, numero, cliente_nombre, picker_asignado, estado, created_at, fecha_requerida')
    .in('estado', ['pendiente'])
    .is('picker_asignado', null)
    .lte('created_at', haceCuatroHs)
    .gte('created_at', new Date(Date.now() - VENTANA_EVENTO_DIAS * 86400000).toISOString());

  const keysVigentes = new Set<string>();
  for (const o of (data || []) as any[]) {
    const key = `picking_sin_asignar:${o.id}`;
    keysVigentes.add(key);
    await crearNotificacion({
      tipo: 'picking_sin_asignar',
      severidad: 'warning',
      titulo: 'Picking sin asignar',
      mensaje: `${o.numero} (${o.cliente_nombre || 'Sin cliente'}) sin picker asignado`,
      entidadTipo: 'wms_ordenes_picking',
      entidadId: o.id,
      entidadCodigo: o.numero,
      dedupKey: key,
    });
  }
  await cerrarNotificacionesObsoletas('picking_sin_asignar:', keysVigentes);
}

async function scanCotizacionesPorVencer(): Promise<void> {
  const hoy = new Date();
  const en3dias = new Date();
  en3dias.setDate(hoy.getDate() + 3);

  // Cotizaciones aún no convertidas/canceladas con
  // fecha_validez entre hoy y +3 días
  const { data: porVencer } = await supabase
    .from('cotizaciones')
    .select('id, numero, fecha_validez, total, clientes(nombre)')
    .in('estado', ['borrador', 'enviada'])
    .gte('fecha_validez', hoy.toISOString().split('T')[0])
    .lte('fecha_validez', en3dias.toISOString().split('T')[0]);

  // Ya vencidas y aún en estado abierto
  const { data: vencidas } = await supabase
    .from('cotizaciones')
    .select('id, numero, fecha_validez, total, clientes(nombre)')
    .in('estado', ['borrador', 'enviada'])
    .lt('fecha_validez', hoy.toISOString().split('T')[0]);

  const keysVigentes = new Set<string>();

  for (const c of (porVencer || []) as any[]) {
    const key = `cotizacion_por_vencer:${c.id}`;
    keysVigentes.add(key);
    const dias = Math.ceil((new Date(c.fecha_validez).getTime() - hoy.getTime()) / 86400000);
    await crearNotificacion({
      tipo: 'cotizacion_por_vencer',
      severidad: 'warning',
      titulo: 'Cotización por vencer',
      mensaje: `${c.numero} (${c.clientes?.nombre || 'Sin cliente'}) vence en ${dias} día(s)`,
      entidadTipo: 'cotizacion',
      entidadId: c.id,
      entidadCodigo: c.numero,
      dedupKey: key,
      metadata: { total: c.total, fecha_validez: c.fecha_validez },
    });
  }

  for (const c of (vencidas || []) as any[]) {
    // Solo eventos recientes: cotizaciones que vencieron en
    // los últimos VENTANA_EVENTO_DIAS días. Las muy viejas se
    // ignoran (el usuario no quiere saturarse con históricas).
    const diasDesdeVencimiento = Math.floor(
      (hoy.getTime() - new Date(c.fecha_validez).getTime()) / 86400000
    );
    if (diasDesdeVencimiento > VENTANA_EVENTO_DIAS) continue;

    const key = `cotizacion_vencida:${c.id}`;
    keysVigentes.add(key);
    await crearNotificacion({
      tipo: 'cotizacion_vencida',
      severidad: 'error',
      titulo: 'Cotización vencida',
      mensaje: `${c.numero} (${c.clientes?.nombre || 'Sin cliente'}) venció el ${c.fecha_validez}`,
      entidadTipo: 'cotizacion',
      entidadId: c.id,
      entidadCodigo: c.numero,
      dedupKey: key,
      metadata: { total: c.total, fecha_validez: c.fecha_validez },
    });
  }

  await cerrarNotificacionesObsoletas('cotizacion_por_vencer:', keysVigentes);
  await cerrarNotificacionesObsoletas('cotizacion_vencida:', keysVigentes);
}

async function scanCxcVencidas(): Promise<void> {
  const hoy = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('cuentas_por_cobrar')
    .select('id, numero, fecha_vencimiento, monto, saldo, clientes(nombre)')
    .neq('estado', 'pagada')
    .lt('fecha_vencimiento', hoy);

  const keysVigentes = new Set<string>();
  for (const cxc of (data || []) as any[]) {
    if ((cxc.saldo ?? cxc.monto) <= 0) continue;
    const diasVencido = Math.floor((Date.now() - new Date(cxc.fecha_vencimiento).getTime()) / 86400000);
    // Solo CxC que vencieron recientemente
    if (diasVencido > VENTANA_EVENTO_DIAS) continue;
    const key = `cxc_vencida:${cxc.id}`;
    keysVigentes.add(key);
    await crearNotificacion({
      tipo: 'cxc_vencida',
      severidad: diasVencido > 30 ? 'error' : 'warning',
      titulo: 'Cuenta por cobrar vencida',
      mensaje: `${cxc.numero || 'CxC'} de ${cxc.clientes?.nombre || 'cliente'} vencida hace ${diasVencido} día(s)`,
      entidadTipo: 'cuenta_por_cobrar',
      entidadId: cxc.id,
      entidadCodigo: cxc.numero,
      dedupKey: key,
      metadata: { saldo: cxc.saldo, dias_vencido: diasVencido },
    });
  }
  await cerrarNotificacionesObsoletas('cxc_vencida:', keysVigentes);
}

async function scanOrdenesSinEntregar(): Promise<void> {
  const hoy = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('ordenes_venta')
    .select('id, numero, fecha_entrega_esperada, total, clientes(nombre)')
    .in('estado', ['confirmada', 'preparando'])
    .lt('fecha_entrega_esperada', hoy);

  const keysVigentes = new Set<string>();
  for (const ov of (data || []) as any[]) {
    if (!ov.fecha_entrega_esperada) continue;
    const diasAtraso = Math.floor((Date.now() - new Date(ov.fecha_entrega_esperada).getTime()) / 86400000);
    // Solo órdenes con atraso reciente
    if (diasAtraso > VENTANA_EVENTO_DIAS) continue;
    const key = `orden_sin_entregar:${ov.id}`;
    keysVigentes.add(key);
    await crearNotificacion({
      tipo: 'orden_sin_entregar',
      severidad: diasAtraso > 7 ? 'error' : 'warning',
      titulo: 'Orden con entrega atrasada',
      mensaje: `${ov.numero} (${ov.clientes?.nombre || 'Sin cliente'}) lleva ${diasAtraso} día(s) de atraso`,
      entidadTipo: 'orden_venta',
      entidadId: ov.id,
      entidadCodigo: ov.numero,
      dedupKey: key,
      metadata: { total: ov.total, dias_atraso: diasAtraso },
    });
  }
  await cerrarNotificacionesObsoletas('orden_sin_entregar:', keysVigentes);
}

/**
 * Escanea stock crítico. Recibe los productos del store
 * y genera/cierra notifs según la condición actual.
 */
export async function escanearStock(productos: Array<{ codigo: string; descripcion: string; stock: number; stockMinimo: number }>): Promise<void> {
  const keysVigentes = new Set<string>();

  for (const p of productos) {
    if (p.stock === 0) {
      const key = `sin_stock:${p.codigo}`;
      keysVigentes.add(key);
      await crearNotificacion({
        tipo: 'sin_stock',
        severidad: 'error',
        titulo: 'Sin stock',
        mensaje: `${p.descripcion} (${p.codigo}): agotado`,
        entidadTipo: 'producto',
        entidadId: p.codigo,
        entidadCodigo: p.codigo,
        dedupKey: key,
      });
    } else if (p.stock <= p.stockMinimo) {
      const key = `stock_bajo:${p.codigo}`;
      keysVigentes.add(key);
      await crearNotificacion({
        tipo: 'stock_bajo',
        severidad: 'warning',
        titulo: 'Stock bajo',
        mensaje: `${p.descripcion} (${p.codigo}): ${p.stock} uds (mín: ${p.stockMinimo})`,
        entidadTipo: 'producto',
        entidadId: p.codigo,
        entidadCodigo: p.codigo,
        dedupKey: key,
      });
    }
  }

  await cerrarNotificacionesObsoletas('sin_stock:', keysVigentes);
  await cerrarNotificacionesObsoletas('stock_bajo:', keysVigentes);
}
