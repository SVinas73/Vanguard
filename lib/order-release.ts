// =====================================================
// Liberación de orden de venta retenida
// =====================================================
// Cuando Administración aprueba la tarea de habilitación, la orden retenida
// debe seguir sola: descontar stock, crear cuenta por cobrar y generar la
// orden de picking. Es el mismo efecto que la confirmación normal, pero ya
// pasó el gate de habilitación.
//
// Se mantiene acá (no en el componente) para poder dispararlo desde el flujo
// de aprobaciones sin acoplar módulos.

import { supabase } from '@/lib/supabase';
import { registrarAuditoria } from '@/lib/audit';
import { crearPickingWmsDesdeVenta } from '@/lib/wms-bridge';

/**
 * Libera una orden retenida: la pasa a 'confirmada', descuenta stock, crea la
 * CxC y genera el picking. Idempotente en stock/CxC/picking por número.
 */
export async function liberarOrdenRetenida(ordenVentaId: string, usuario: string): Promise<boolean> {
  const { data: orden } = await supabase
    .from('ordenes_venta')
    .select('id, numero, estado, cliente_id, subtotal, impuestos, total, fecha_entrega_esperada, clientes(nombre), ordenes_venta_items(producto_codigo, cantidad)')
    .eq('id', ordenVentaId)
    .maybeSingle();

  if (!orden) return false;
  // Solo liberamos órdenes retenidas (idempotencia).
  if ((orden as any).estado !== 'retenida') return true;

  const items = (orden as any).ordenes_venta_items || [];

  // 1. Descontar stock + movimientos de salida.
  for (const item of items) {
    const { data: prod } = await supabase
      .from('productos').select('id, stock').eq('codigo', item.producto_codigo).single();
    if (prod) {
      await supabase.from('productos')
        .update({ stock: Math.max(0, (Number(prod.stock) || 0) - (Number(item.cantidad) || 0)) })
        .eq('codigo', item.producto_codigo);
      await supabase.from('movimientos').insert({
        producto_id: prod.id,
        codigo: item.producto_codigo,
        tipo: 'salida',
        cantidad: item.cantidad,
        notas: `Venta ${(orden as any).numero} (liberada por Administración)`,
        usuario_email: usuario,
      });
    }
  }

  // 2. Cuenta por cobrar (idempotente por número).
  const numeroCxc = `CXC-${(orden as any).numero}`;
  const { data: cxc } = await supabase
    .from('cuentas_por_cobrar').select('id').eq('numero', numeroCxc).maybeSingle();
  if (!cxc) {
    await supabase.from('cuentas_por_cobrar').insert({
      numero: numeroCxc,
      cliente_id: (orden as any).cliente_id,
      tipo: 'factura',
      fecha_emision: new Date().toISOString().split('T')[0],
      fecha_vencimiento: (orden as any).fecha_entrega_esperada || new Date().toISOString().split('T')[0],
      moneda: 'UYU',
      subtotal: (orden as any).subtotal,
      impuestos: (orden as any).impuestos,
      total: (orden as any).total,
      monto_pagado: 0,
      saldo: (orden as any).total,
      estado: 'pendiente',
      notas: `Auto-generada desde venta ${(orden as any).numero}`,
    });
  }

  // 3. Estado confirmada.
  await supabase.from('ordenes_venta')
    .update({ estado: 'confirmada', updated_at: new Date().toISOString() })
    .eq('id', ordenVentaId);

  // 4. Orden de picking (idempotente en wms-bridge).
  if (items.length) {
    await crearPickingWmsDesdeVenta({
      ordenVentaId: (orden as any).id,
      ordenVentaNumero: (orden as any).numero,
      clienteNombre: (orden as any).clientes?.nombre,
      fechaRequerida: (orden as any).fecha_entrega_esperada,
      items: items.map((it: any) => ({
        productoCodigo: it.producto_codigo,
        productoNombre: it.producto_codigo,
        cantidadSolicitada: it.cantidad,
      })),
      creadoPor: usuario,
    });
  }

  await registrarAuditoria('ordenes_venta', 'LIBERADA_HABILITACION', (orden as any).numero,
    { estado: 'retenida' }, { estado: 'confirmada' }, usuario);
  return true;
}
