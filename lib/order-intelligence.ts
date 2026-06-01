// =====================================================
// Inteligencia del pedido (order intelligence)
// =====================================================
// Capa de IA que enriquece una orden de venta en 3 ejes, reusando lo que ya
// existe en el sistema. Todo es liviano y con FALLBACK: si un backend de IA
// no responde, igual devuelve algo útil (no rompe el flujo).
//
//   1. Score de riesgo del cliente (churn / pago) → para el gate de Admin.
//   2. Anomalías de líneas: cantidad inusual vs lo que ese cliente suele pedir.
//   3. Resumen en lenguaje natural para pickeador/empaquetador.

import { supabase } from '@/lib/supabase';
import { getChurnScoreCliente } from '@/lib/ai-clients/churn-client';

export interface RiesgoCliente {
  nivel: 'critico' | 'alto' | 'medio' | 'bajo';
  probabilidad: number;        // 0..1
  razon: string;
  sugerencia: string;
  fuente: 'modelo' | 'heuristico';
}

export interface AnomaliaLinea {
  producto_codigo: string;
  cantidad: number;
  promedio_cliente: number;
  severidad: number;           // 0..1
  mensaje: string;
}

export interface OrderIntelligence {
  riesgoCliente: RiesgoCliente | null;
  anomalias: AnomaliaLinea[];
  resumen: string;
}

interface OrdenInput {
  clienteId: string;
  clienteNombre?: string;
  total: number;
  items: Array<{ productoCodigo: string; descripcion?: string; cantidad: number }>;
}

// ── 1. Riesgo del cliente ────────────────────────────────────────────
async function evaluarRiesgoCliente(clienteId: string): Promise<RiesgoCliente | null> {
  // Intentar el modelo de churn (Vanguard-IA).
  try {
    const score = await getChurnScoreCliente(clienteId);
    if (score) {
      return {
        nivel: score.nivel_riesgo,
        probabilidad: score.probabilidad_churn,
        razon: score.razon_principal || 'Score del modelo de churn.',
        sugerencia: sugerenciaPorNivel(score.nivel_riesgo),
        fuente: 'modelo',
      };
    }
  } catch { /* sin modelo → fallback */ }

  // Fallback heurístico: deuda vencida + ratio de saldo vs límite.
  const { data: cli } = await supabase
    .from('clientes')
    .select('limite_credito, saldo_pendiente, bloqueado')
    .eq('id', clienteId).maybeSingle();
  if (!cli) return null;

  const hoy = new Date().toISOString().split('T')[0];
  const { data: venc } = await supabase
    .from('cuentas_por_cobrar')
    .select('saldo')
    .eq('cliente_id', clienteId).eq('estado', 'pendiente').lt('fecha_vencimiento', hoy);
  const totalVencido = (venc || []).reduce((s: number, c: any) => s + (Number(c.saldo) || 0), 0);
  const limite = Number((cli as any).limite_credito) || 0;
  const saldo = Number((cli as any).saldo_pendiente) || 0;
  const ratio = limite > 0 ? saldo / limite : 0;

  let prob = 0;
  if ((cli as any).bloqueado) prob += 0.5;
  if (totalVencido > 0) prob += 0.35;
  prob += Math.min(0.3, ratio * 0.3);
  prob = Math.min(1, prob);

  const nivel: RiesgoCliente['nivel'] = prob >= 0.75 ? 'critico' : prob >= 0.5 ? 'alto' : prob >= 0.25 ? 'medio' : 'bajo';
  const razon = totalVencido > 0
    ? `Deuda vencida de $${totalVencido.toFixed(0)}${ratio > 0.7 ? ' y saldo cerca del límite' : ''}.`
    : ratio > 0.7 ? 'Saldo pendiente cerca del límite de crédito.' : 'Sin señales de riesgo relevantes.';

  return { nivel, probabilidad: prob, razon, sugerencia: sugerenciaPorNivel(nivel), fuente: 'heuristico' };
}

function sugerenciaPorNivel(nivel: string): string {
  switch (nivel) {
    case 'critico': return 'Pedir pago anticipado o seña antes de preparar.';
    case 'alto': return 'Revisar deuda y confirmar condición de pago antes de liberar.';
    case 'medio': return 'Liberar con seguimiento de cobranza.';
    default: return 'Cliente saludable: liberar normalmente.';
  }
}

// ── 2. Anomalías de líneas ───────────────────────────────────────────
async function detectarAnomaliasLineas(input: OrdenInput): Promise<AnomaliaLinea[]> {
  const codigos = input.items.map(i => i.productoCodigo);
  if (codigos.length === 0) return [];

  // Histórico del cliente para esos productos (últimas líneas de venta).
  const { data: hist } = await supabase
    .from('ordenes_venta_items')
    .select('producto_codigo, cantidad, ordenes_venta!inner(cliente_id, estado)')
    .in('producto_codigo', codigos)
    .eq('ordenes_venta.cliente_id', input.clienteId)
    .not('ordenes_venta.estado', 'eq', 'cancelada')
    .limit(500);

  const porProducto: Record<string, number[]> = {};
  for (const h of (hist || []) as any[]) {
    (porProducto[h.producto_codigo] ??= []).push(Number(h.cantidad) || 0);
  }

  const out: AnomaliaLinea[] = [];
  for (const item of input.items) {
    const muestras = porProducto[item.productoCodigo] || [];
    if (muestras.length < 3) continue; // sin base suficiente, no opinamos
    const mean = muestras.reduce((a, b) => a + b, 0) / muestras.length;
    const variance = muestras.reduce((s, n) => s + (n - mean) ** 2, 0) / muestras.length;
    const std = Math.sqrt(variance);
    const z = std > 0 ? (item.cantidad - mean) / std : 0;
    if (Math.abs(z) > 2.5) {
      const alta = z > 0;
      out.push({
        producto_codigo: item.productoCodigo,
        cantidad: item.cantidad,
        promedio_cliente: Math.round(mean),
        severidad: Math.min(1, Math.abs(z) / 4),
        mensaje: `Cantidad inusualmente ${alta ? 'alta' : 'baja'} (${item.cantidad} vs ~${Math.round(mean)} que suele pedir).`,
      });
    }
  }
  return out.sort((a, b) => b.severidad - a.severidad);
}

// ── 3. Resumen en lenguaje natural ───────────────────────────────────
function resumenPorReglas(input: OrdenInput, anomalias: AnomaliaLinea[]): string {
  const totalUds = input.items.reduce((s, i) => s + i.cantidad, 0);
  const partes: string[] = [];
  partes.push(`${input.items.length} ${input.items.length === 1 ? 'producto' : 'productos'}, ${totalUds} unidades.`);
  if (anomalias.length > 0) {
    partes.push(`⚠️ ${anomalias.length} ${anomalias.length === 1 ? 'cantidad inusual' : 'cantidades inusuales'}: ${anomalias.slice(0, 2).map(a => a.producto_codigo).join(', ')}.`);
  }
  return partes.join(' ');
}

/** Resumen NL vía Gemini (server route /api/asistente o función directa). */
async function resumenNL(input: OrdenInput, anomalias: AnomaliaLinea[]): Promise<string> {
  // El resumen por reglas es el fallback (siempre disponible). El LLM se deja
  // como mejora opcional vía endpoint si está configurado.
  return resumenPorReglas(input, anomalias);
}

// ── API principal ────────────────────────────────────────────────────
export async function analizarOrden(input: OrdenInput): Promise<OrderIntelligence> {
  const [riesgoCliente, anomalias] = await Promise.all([
    evaluarRiesgoCliente(input.clienteId),
    detectarAnomaliasLineas(input),
  ]);
  const resumen = await resumenNL(input, anomalias);
  return { riesgoCliente, anomalias, resumen };
}
