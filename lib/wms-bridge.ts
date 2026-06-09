import { supabase } from '@/lib/supabase';

// =====================================================
// Puentes Comercial → WMS
// =====================================================
// Estas funciones se llaman desde Compras y Ventas para
// generar automáticamente las órdenes de trabajo de WMS.
// Respetan la configuración de wms_configuracion (auto-
// generar) — si está apagada, no hacen nada.
// Idempotentes: si ya existe una orden de WMS para el
// origen, no crean una nueva.
// =====================================================

interface WmsConfig {
  autogenerar_recepcion_desde_compra: boolean;
  autogenerar_picking_desde_venta: boolean;
}

async function getConfig(): Promise<WmsConfig> {
  const { data } = await supabase
    .from('wms_configuracion')
    .select('autogenerar_recepcion_desde_compra, autogenerar_picking_desde_venta')
    .limit(1)
    .maybeSingle();
  return {
    autogenerar_recepcion_desde_compra: data?.autogenerar_recepcion_desde_compra ?? true,
    autogenerar_picking_desde_venta: data?.autogenerar_picking_desde_venta ?? true,
  };
}

// Inserta una fila descartando columnas que la BD rechace por inexistentes
// (PGRST204 / "Could not find the 'X' column") o generadas ("cannot insert a
// non-DEFAULT value into column 'X'"), reintentando. Devuelve { data, error }.
// Algunas instalaciones tienen tablas WMS con un esquema reducido respecto de
// las migraciones; esto evita romper por una columna faltante.
async function insertResiliente(
  tabla: string,
  payload: Record<string, any>,
  select?: string,
): Promise<{ data: any; error: any }> {
  let data = { ...payload };
  for (let intento = 0; intento < 8; intento++) {
    let q: any = supabase.from(tabla).insert(data);
    if (select) q = q.select(select).single();
    const { data: res, error } = await q;
    if (!error) return { data: res, error: null };
    const msg = error.message || '';
    const m = msg.match(/column ['"]?(\w+)['"]?/i);
    const col = m?.[1];
    const recuperable =
      error.code === 'PGRST204' ||
      /Could not find the/i.test(msg) ||
      /cannot insert a non-DEFAULT value/i.test(msg);
    if (recuperable && col && col in data) {
      delete data[col];
      continue;
    }
    return { data: null, error };
  }
  return { data: null, error: { message: 'No se pudo insertar tras varios reintentos' } };
}

// =====================================================
// Recepción WMS desde una orden de compra
// =====================================================

export interface CrearRecepcionWmsArgs {
  ordenCompraId: string;
  ordenCompraNumero: string;
  proveedorNombre?: string;
  almacenId?: string;
  items: Array<{
    productoCodigo: string;
    productoNombre: string;
    cantidadEsperada: number;
    unidadMedida?: string;
  }>;
  creadoPor?: string;
}

/**
 * Crea una wms_ordenes_recepcion + sus líneas a partir de
 * una orden de compra. Si ya existe una recepción WMS
 * para esa orden, devuelve la existente sin duplicar.
 */
export async function crearRecepcionWmsDesdeCompra(args: CrearRecepcionWmsArgs): Promise<string | null> {
  const cfg = await getConfig();
  if (!cfg.autogenerar_recepcion_desde_compra) return null;

  // Idempotencia: si ya existe una recepción para esta OC, salir
  const { data: existente } = await supabase
    .from('wms_ordenes_recepcion')
    .select('id')
    .eq('orden_compra_id', args.ordenCompraId)
    .maybeSingle();
  if (existente) return existente.id;

  const numeroRecepcion = `REC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const totalUnidades = args.items.reduce((s, i) => s + (i.cantidadEsperada || 0), 0);

  const { data: orden, error } = await insertResiliente('wms_ordenes_recepcion', {
    numero: numeroRecepcion,
    tipo_origen: 'compra',
    orden_compra_id: args.ordenCompraId,
    orden_compra_numero: args.ordenCompraNumero,
    proveedor_nombre: args.proveedorNombre || null,
    almacen_id: args.almacenId || null,
    estado: 'pendiente',
    lineas_totales: args.items.length,
    lineas_recibidas: 0,
    unidades_esperadas: totalUnidades,
    unidades_recibidas: 0,
    requiere_inspeccion: false,
    creado_por: args.creadoPor || null,
  }, 'id');

  if (error || !orden) {
    console.error('Error creando recepción WMS:', error);
    return null;
  }

  // Insertar líneas
  for (const i of args.items) {
    await insertResiliente('wms_ordenes_recepcion_lineas', {
      orden_recepcion_id: orden.id,
      producto_codigo: i.productoCodigo,
      producto_nombre: i.productoNombre,
      cantidad_esperada: i.cantidadEsperada,
      cantidad_recibida: 0,
      cantidad_rechazada: 0,
      unidad_medida: i.unidadMedida || 'UND',
      estado: 'pendiente',
      putaway_completado: false,
    });
  }

  return orden.id;
}

// =====================================================
// Picking WMS desde una orden de venta
// =====================================================

export interface CrearPickingWmsArgs {
  ordenVentaId: string;
  ordenVentaNumero: string;
  clienteNombre?: string;
  almacenId?: string;
  fechaRequerida?: string;
  items: Array<{
    productoCodigo: string;
    productoNombre: string;
    cantidadSolicitada: number;
    unidadMedida?: string;
  }>;
  creadoPor?: string;
}

export interface ResultadoPicking {
  id: string | null;
  error: string | null;
  skipped: boolean; // true si la auto-generación está apagada en config
}

/**
 * Crea una wms_ordenes_picking + sus líneas a partir de
 * una orden de venta confirmada. Idempotente. Devuelve el motivo si falla,
 * para que quien lo dispare manualmente pueda mostrarlo.
 */
export async function crearPickingWmsDesdeVenta(args: CrearPickingWmsArgs): Promise<ResultadoPicking> {
  const cfg = await getConfig();
  if (!cfg.autogenerar_picking_desde_venta) return { id: null, error: null, skipped: true };

  const { data: existente } = await supabase
    .from('wms_ordenes_picking')
    .select('id')
    .eq('orden_venta_id', args.ordenVentaId)
    .maybeSingle();
  if (existente) return { id: existente.id, error: null, skipped: false };

  const numeroPick = `PICK-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const totalUnidades = args.items.reduce((s, i) => s + (i.cantidadSolicitada || 0), 0);

  const { data: orden, error } = await insertResiliente('wms_ordenes_picking', {
    numero: numeroPick,
    tipo_origen: 'venta',
    orden_venta_id: args.ordenVentaId,
    orden_venta_numero: args.ordenVentaNumero,
    cliente_nombre: args.clienteNombre || null,
    almacen_id: args.almacenId || null,
    fecha_requerida: args.fechaRequerida || null,
    estado: 'pendiente',
    lineas_totales: args.items.length,
    lineas_completadas: 0,
    unidades_totales: totalUnidades,
    unidades_pickeadas: 0,
    prioridad: 2,
    creado_por: args.creadoPor || null,
  }, 'id');

  if (error || !orden) {
    console.error('Error creando picking WMS:', error);
    return { id: null, error: error?.message || 'No se pudo crear la orden de picking', skipped: false };
  }

  if (args.items.length > 0) {
    let errLineas: any = null;
    for (let idx = 0; idx < args.items.length; idx++) {
      const i = args.items[idx];
      const { error: e } = await insertResiliente('wms_ordenes_picking_lineas', {
        orden_picking_id: orden.id,
        producto_codigo: i.productoCodigo,
        producto_nombre: i.productoNombre,
        cantidad_solicitada: i.cantidadSolicitada,
        cantidad_pickeada: 0,
        cantidad_short: 0,
        unidad_medida: i.unidadMedida || 'UND',
        estado: 'pendiente',
        secuencia: idx + 1,
      });
      if (e) { errLineas = e; break; }
    }
    if (errLineas) {
      console.error('Error creando líneas de picking WMS:', errLineas);
      return { id: orden.id, error: `Orden creada pero fallaron las líneas: ${errLineas.message}`, skipped: false };
    }
    // Nota: la confirmación de venta ya descuenta productos.stock
    // y registra el movimiento de salida. Acá no creamos una
    // reserva porque el stock lógico ya bajó. El picking solo
    // mueve la posición física en wms_stock_ubicacion.
  }

  return { id: orden.id, error: null, skipped: false };
}
