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
export async function cargarNotificaciones(
  usuarioEmail: string,
  diasAtras: number = 30
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

export async function marcarTodasLeidas(usuarioEmail: string): Promise<void> {
  // Personales: leida = true
  await supabase.from('notificaciones').update({ leida: true })
    .eq('usuario_email', usuarioEmail).eq('leida', false);

  // Globales: traemos las no leídas por este usuario y las actualizamos una a una
  const { data } = await supabase
    .from('notificaciones').select('id, leida_por')
    .is('usuario_email', null).eq('descartada', false);
  for (const n of data || []) {
    const arr: string[] = (n as any).leida_por || [];
    if (!arr.includes(usuarioEmail)) {
      await supabase.from('notificaciones')
        .update({ leida_por: [...arr, usuarioEmail] })
        .eq('id', (n as any).id);
    }
  }
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
  ]);
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
    const key = `cxc_vencida:${cxc.id}`;
    keysVigentes.add(key);
    const diasVencido = Math.floor((Date.now() - new Date(cxc.fecha_vencimiento).getTime()) / 86400000);
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
    const key = `orden_sin_entregar:${ov.id}`;
    keysVigentes.add(key);
    const diasAtraso = Math.floor((Date.now() - new Date(ov.fecha_entrega_esperada).getTime()) / 86400000);
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
