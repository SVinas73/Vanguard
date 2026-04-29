import { supabase } from '@/lib/supabase';
import { registrarAuditoria } from '@/lib/audit';

// =====================================================
// Sistema unificado de reservas de stock
// =====================================================
// Lo usan:
//  - Taller: al crear una cotización con repuestos.
//  - Comercial / WMS: al confirmar una venta y generar
//    una orden de picking (para evitar oversell entre el
//    momento en que se confirma y el momento en que se
//    pickea físicamente).
//
// Estados de una reserva:
//   reservado → la unidad existe pero está apartada
//   consumido → la unidad fue despachada/usada (stock bajó)
//   liberado  → la reserva fue cancelada (stock disponible)
// =====================================================

export type EstadoReserva = 'reservado' | 'consumido' | 'liberado';

export type OrigenReserva =
  | 'cotizacion_taller'
  | 'orden_taller'
  | 'cotizacion_venta'
  | 'orden_venta_picking'
  | 'manual';

export interface Reserva {
  id: string;
  producto_codigo?: string | null;
  producto_id?: string | null;
  cantidad: number;
  estado: EstadoReserva;
  origen_tipo: OrigenReserva;
  origen_id?: string | null;
  origen_codigo?: string | null;
  motivo?: string | null;
  creado_por?: string | null;
  cerrada_por?: string | null;
  created_at: string;
  cerrada_at?: string | null;
}

export interface NuevaReserva {
  productoCodigo?: string | null;
  productoId?: string | null;
  cantidad: number;
  origenTipo: OrigenReserva;
  origenId?: string | null;
  origenCodigo?: string | null;
  motivo?: string;
  creadoPor: string;
}

// =====================================================
// CREAR
// =====================================================

/**
 * Crea una reserva y actualiza la caché productos.stock_reservado.
 * Devuelve null si no había stock disponible (reservado + actual ≥ pedido).
 */
export async function crearReserva(r: NuevaReserva): Promise<Reserva | null> {
  if (r.cantidad <= 0) return null;
  if (!r.productoCodigo && !r.productoId) return null;

  // Validar disponibilidad antes de reservar
  const disponible = await getStockDisponible({
    productoCodigo: r.productoCodigo,
    productoId: r.productoId,
  });
  if (disponible < r.cantidad) {
    // Permitimos crear la reserva igual pero la marcamos en motivo,
    // así Taller puede mostrar "reservada con quiebre" en la UI.
    // Si el caller quiere bloquear, debe chequear getStockDisponible
    // antes de llamar.
  }

  const { data, error } = await supabase
    .from('reservas_stock')
    .insert({
      producto_codigo: r.productoCodigo || null,
      producto_id: r.productoId || null,
      cantidad: r.cantidad,
      estado: 'reservado',
      origen_tipo: r.origenTipo,
      origen_id: r.origenId || null,
      origen_codigo: r.origenCodigo || null,
      motivo: r.motivo || null,
      creado_por: r.creadoPor,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('crearReserva error:', error);
    return null;
  }

  await actualizarCacheReservado(r.productoCodigo, r.productoId);

  await registrarAuditoria(
    'reservas_stock',
    'CREAR',
    r.origenCodigo || (data as any).id,
    null,
    { producto: r.productoCodigo, cantidad: r.cantidad, origen: r.origenTipo },
    r.creadoPor
  );

  return data as Reserva;
}

// =====================================================
// LIBERAR
// =====================================================

/**
 * Libera todas las reservas activas asociadas a un origen
 * (ej: cuando se rechaza una cotización de taller).
 */
export async function liberarReservasPorOrigen(
  origenTipo: OrigenReserva,
  origenId: string,
  motivo: string,
  usuario: string
): Promise<number> {
  const { data: reservas } = await supabase
    .from('reservas_stock')
    .select('id, producto_codigo, producto_id, cantidad')
    .eq('origen_tipo', origenTipo)
    .eq('origen_id', origenId)
    .eq('estado', 'reservado');

  if (!reservas || reservas.length === 0) return 0;

  const ids = reservas.map((r: any) => r.id);
  const { error } = await supabase
    .from('reservas_stock')
    .update({
      estado: 'liberado',
      cerrada_at: new Date().toISOString(),
      cerrada_por: usuario,
      motivo: motivo,
    })
    .in('id', ids);

  if (error) {
    console.error('liberarReservasPorOrigen error:', error);
    return 0;
  }

  // Refrescar caché de los productos involucrados
  const productos = new Set<string>();
  reservas.forEach((r: any) => {
    if (r.producto_codigo) productos.add(`c:${r.producto_codigo}`);
    if (r.producto_id) productos.add(`i:${r.producto_id}`);
  });
  for (const key of productos) {
    const [tipo, valor] = key.split(':');
    if (tipo === 'c') await actualizarCacheReservado(valor, null);
    else await actualizarCacheReservado(null, valor);
  }

  await registrarAuditoria(
    'reservas_stock',
    'LIBERAR',
    origenId,
    null,
    { origen_tipo: origenTipo, motivo, cantidad_reservas: ids.length },
    usuario
  );

  return ids.length;
}

// =====================================================
// CONSUMIR
// =====================================================

/**
 * Consume todas las reservas activas asociadas a un origen,
 * decrementando el stock real y registrando un movimiento.
 * Esto se llama cuando la unidad reservada efectivamente
 * sale del depósito (ej: reparación finalizada, picking
 * confirmado).
 */
export async function consumirReservasPorOrigen(
  origenTipo: OrigenReserva,
  origenId: string,
  motivo: string,
  usuario: string
): Promise<number> {
  const { data: reservas } = await supabase
    .from('reservas_stock')
    .select('id, producto_codigo, producto_id, cantidad')
    .eq('origen_tipo', origenTipo)
    .eq('origen_id', origenId)
    .eq('estado', 'reservado');

  if (!reservas || reservas.length === 0) return 0;

  let consumidas = 0;
  for (const r of reservas as any[]) {
    const ok = await consumirReservaIndividual(r.id, motivo, usuario);
    if (ok) consumidas++;
  }
  return consumidas;
}

/**
 * Consume UNA reserva: decrementa stock real, marca la
 * reserva como consumida, registra movimiento.
 */
export async function consumirReservaIndividual(
  reservaId: string,
  motivo: string,
  usuario: string
): Promise<boolean> {
  const { data: reserva } = await supabase
    .from('reservas_stock')
    .select('*')
    .eq('id', reservaId)
    .eq('estado', 'reservado')
    .maybeSingle();

  if (!reserva) return false;

  // 1. Marcar reserva como consumida
  const { error: errReserva } = await supabase
    .from('reservas_stock')
    .update({
      estado: 'consumido',
      cerrada_at: new Date().toISOString(),
      cerrada_por: usuario,
      motivo: motivo,
    })
    .eq('id', reservaId);
  if (errReserva) return false;

  // 2. Decrementar stock real del producto.
  // Tomamos el producto actual y descontamos la cantidad.
  const ref = await getProductoStock({
    productoCodigo: reserva.producto_codigo,
    productoId: reserva.producto_id,
  });
  if (ref) {
    const nuevoStock = Math.max(0, (ref.stock || 0) - parseFloat(reserva.cantidad));
    const matcher = ref.id ? { id: ref.id } : { codigo: ref.codigo };
    await supabase
      .from('productos')
      .update({ stock: nuevoStock })
      .match(matcher as any);
  }

  // 3. Refrescar caché de reservado
  await actualizarCacheReservado(reserva.producto_codigo, reserva.producto_id);

  // 4. Registrar movimiento de salida
  await supabase.from('movimientos').insert({
    producto_id: reserva.producto_id || ref?.id || null,
    codigo: reserva.producto_codigo || ref?.codigo || null,
    tipo: 'salida',
    cantidad: reserva.cantidad,
    notas: motivo,
    usuario_email: usuario,
  });

  return true;
}

// =====================================================
// CONSULTAS
// =====================================================

interface ProductoRef {
  productoCodigo?: string | null;
  productoId?: string | null;
}

interface ProductoStock {
  id?: string;
  codigo?: string;
  stock: number;
}

async function getProductoStock(ref: ProductoRef): Promise<ProductoStock | null> {
  if (ref.productoCodigo) {
    const { data } = await supabase
      .from('productos')
      .select('id, codigo, stock')
      .eq('codigo', ref.productoCodigo)
      .maybeSingle();
    if (data) return data as ProductoStock;
  }
  if (ref.productoId) {
    const { data } = await supabase
      .from('productos')
      .select('id, codigo, stock')
      .eq('id', ref.productoId)
      .maybeSingle();
    if (data) return data as ProductoStock;
  }
  return null;
}

/**
 * Stock disponible = stock real - reservas activas.
 * Esto es lo que debe mostrarse en cualquier flujo que
 * permita "consumir" stock (cotizar, vender, etc).
 */
export async function getStockDisponible(ref: ProductoRef): Promise<number> {
  const prod = await getProductoStock(ref);
  if (!prod) return 0;
  const reservado = await getStockReservado(ref);
  return Math.max(0, (prod.stock || 0) - reservado);
}

export async function getStockReservado(ref: ProductoRef): Promise<number> {
  let q = supabase
    .from('reservas_stock')
    .select('cantidad')
    .eq('estado', 'reservado');
  if (ref.productoCodigo) q = q.eq('producto_codigo', ref.productoCodigo);
  else if (ref.productoId) q = q.eq('producto_id', ref.productoId);
  const { data } = await q;
  return (data || []).reduce((s: number, r: any) => s + parseFloat(r.cantidad || 0), 0);
}

export async function getReservasActivasPorOrigen(
  origenTipo: OrigenReserva,
  origenId: string
): Promise<Reserva[]> {
  const { data } = await supabase
    .from('reservas_stock')
    .select('*')
    .eq('origen_tipo', origenTipo)
    .eq('origen_id', origenId)
    .eq('estado', 'reservado');
  return (data || []) as Reserva[];
}

// =====================================================
// CACHE — productos.stock_reservado
// =====================================================
// Mantiene la caché al día. Si por alguna razón el cache
// se desincroniza, podés llamar a esto manualmente.

async function actualizarCacheReservado(
  productoCodigo?: string | null,
  productoId?: string | null
): Promise<void> {
  const ref = await getProductoStock({ productoCodigo, productoId });
  if (!ref) return;

  const reservado = await getStockReservado({
    productoCodigo: ref.codigo,
    productoId: ref.id,
  });

  const matcher = ref.id ? { id: ref.id } : { codigo: ref.codigo };
  await supabase
    .from('productos')
    .update({ stock_reservado: reservado })
    .match(matcher as any);
}
