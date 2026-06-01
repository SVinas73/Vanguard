// =====================================================
// Habilitación de cliente para vender (gate de Administración)
// =====================================================
// Antes de preparar un pedido, se evalúa si el cliente está habilitado.
// Si está OK, la orden pasa de largo (directo a picking). Si NO, la orden
// queda RETENIDA y le llega una tarea de revisión a Administración.
//
// Causas evaluadas (todas las relevantes):
//   - bloqueado: marcado a mano por Administración.
//   - deuda_vencida: tiene cuentas por cobrar vencidas e impagas.
//   - supera_limite: saldo pendiente + esta orden superan el límite de crédito.
//   - cliente_nuevo: sin historial de órdenes (primera compra) → revisión.
//
// Diseño simple y completo: una sola función async que el flujo de ventas
// llama, y un resultado claro que la UI puede mostrar.

import { supabase } from '@/lib/supabase';

export type MotivoRetencion =
  | 'bloqueado'
  | 'deuda_vencida'
  | 'supera_limite'
  | 'cliente_nuevo';

export interface MotivoDetalle {
  motivo: MotivoRetencion;
  detalle: string;
}

export interface EligibilityResult {
  habilitado: boolean;
  motivos: MotivoDetalle[];
  /** Resumen legible para la tarea de Administración. */
  resumen: string;
}

interface EvalInput {
  clienteId: string;
  /** Monto de la orden que se está por crear (para el chequeo de límite). */
  montoOrden?: number;
}

const hoyISO = () => new Date().toISOString().split('T')[0];

/**
 * Evalúa la habilitación de un cliente. No escribe nada; solo lee.
 */
export async function evaluarHabilitacionCliente(
  input: EvalInput,
): Promise<EligibilityResult> {
  const motivos: MotivoDetalle[] = [];

  // 1. Datos del cliente
  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, nombre, bloqueado, limite_credito, saldo_pendiente')
    .eq('id', input.clienteId)
    .maybeSingle();

  if (!cliente) {
    return {
      habilitado: false,
      motivos: [{ motivo: 'bloqueado', detalle: 'Cliente no encontrado.' }],
      resumen: 'Cliente no encontrado.',
    };
  }

  const limite = Number((cliente as any).limite_credito) || 0;
  const saldo = Number((cliente as any).saldo_pendiente) || 0;

  // 2. Bloqueado manualmente
  if ((cliente as any).bloqueado === true) {
    motivos.push({ motivo: 'bloqueado', detalle: 'Cliente bloqueado manualmente por Administración.' });
  }

  // 3. Deuda vencida (CxC pendientes con vencimiento pasado)
  const { data: vencidas } = await supabase
    .from('cuentas_por_cobrar')
    .select('saldo, fecha_vencimiento')
    .eq('cliente_id', input.clienteId)
    .eq('estado', 'pendiente')
    .lt('fecha_vencimiento', hoyISO());
  if (vencidas && vencidas.length > 0) {
    const totalVencido = vencidas.reduce((s: number, c: any) => s + (Number(c.saldo) || 0), 0);
    motivos.push({
      motivo: 'deuda_vencida',
      detalle: `${vencidas.length} cuenta(s) vencida(s) impaga(s) por $${totalVencido.toFixed(0)}.`,
    });
  }

  // 4. Supera límite de crédito (si tiene límite configurado > 0)
  if (limite > 0) {
    const expuesto = saldo + (input.montoOrden || 0);
    if (expuesto > limite) {
      motivos.push({
        motivo: 'supera_limite',
        detalle: `Saldo $${saldo.toFixed(0)} + orden $${(input.montoOrden || 0).toFixed(0)} = $${expuesto.toFixed(0)} supera el límite de $${limite.toFixed(0)}.`,
      });
    }
  }

  // 5. Cliente nuevo (sin órdenes previas confirmadas/posteriores)
  const { count } = await supabase
    .from('ordenes_venta')
    .select('id', { count: 'exact', head: true })
    .eq('cliente_id', input.clienteId)
    .not('estado', 'in', '(borrador,cancelada)');
  if ((count || 0) === 0) {
    motivos.push({
      motivo: 'cliente_nuevo',
      detalle: 'Primera compra: sin historial de órdenes. Requiere revisión inicial.',
    });
  }

  const habilitado = motivos.length === 0;
  const resumen = habilitado
    ? 'Cliente habilitado.'
    : motivos.map((m) => m.detalle).join(' ');

  return { habilitado, motivos, resumen };
}
