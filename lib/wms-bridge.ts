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

  const { data: orden, error } = await supabase
    .from('wms_ordenes_recepcion')
    .insert({
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
    })
    .select('id')
    .single();

  if (error || !orden) {
    console.error('Error creando recepción WMS:', error);
    return null;
  }

  // Insertar líneas
  if (args.items.length > 0) {
    await supabase.from('wms_ordenes_recepcion_lineas').insert(
      args.items.map(i => ({
        orden_recepcion_id: orden.id,
        producto_codigo: i.productoCodigo,
        producto_nombre: i.productoNombre,
        cantidad_esperada: i.cantidadEsperada,
        cantidad_recibida: 0,
        cantidad_rechazada: 0,
        unidad_medida: i.unidadMedida || 'UND',
        estado: 'pendiente',
        putaway_completado: false,
      }))
    );
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

/**
 * Crea una wms_ordenes_picking + sus líneas a partir de
 * una orden de venta confirmada. Idempotente.
 */
export async function crearPickingWmsDesdeVenta(args: CrearPickingWmsArgs): Promise<string | null> {
  const cfg = await getConfig();
  if (!cfg.autogenerar_picking_desde_venta) return null;

  const { data: existente } = await supabase
    .from('wms_ordenes_picking')
    .select('id')
    .eq('orden_venta_id', args.ordenVentaId)
    .maybeSingle();
  if (existente) return existente.id;

  const numeroPick = `PICK-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const totalUnidades = args.items.reduce((s, i) => s + (i.cantidadSolicitada || 0), 0);

  const { data: orden, error } = await supabase
    .from('wms_ordenes_picking')
    .insert({
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
    })
    .select('id')
    .single();

  if (error || !orden) {
    console.error('Error creando picking WMS:', error);
    return null;
  }

  if (args.items.length > 0) {
    await supabase.from('wms_ordenes_picking_lineas').insert(
      args.items.map((i, idx) => ({
        orden_picking_id: orden.id,
        producto_codigo: i.productoCodigo,
        producto_nombre: i.productoNombre,
        cantidad_solicitada: i.cantidadSolicitada,
        cantidad_pickeada: 0,
        cantidad_short: 0,
        unidad_medida: i.unidadMedida || 'UND',
        estado: 'pendiente',
        secuencia: idx + 1,
      }))
    );
  }

  return orden.id;
}
