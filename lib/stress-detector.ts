// =====================================================
// Stress Detector — Modo anti-estrés inteligente
// =====================================================
// Calcula un score de estrés (0-100) combinando señales:
//
// SEÑALES DEL SISTEMA (lo que la app sabe):
//   • Notificaciones críticas activas
//   • Aprobaciones pendientes asignadas al usuario
//   • Tickets con SLA vencido (si es agente)
//   • Stock agotado (alertas críticas)
//   • CxC vencidas con monto alto
//   • Picking sin asignar (para bodegueros)
//
// SEÑALES DEL COMPORTAMIENTO (cliente-side):
//   • Frecuencia de cambio de tab (frenesí)
//   • Tiempo en sesión sin pausa
//   • Hora del día (madrugada / fin de semana / cierre)
//   • Cantidad de errores recientes
//
// Cuando el score supera el umbral (70), el sistema
// pregunta al usuario si quiere activar Focus Mode.
// =====================================================

import { supabase } from '@/lib/supabase';

export interface StressSignals {
  // Sistema
  notificacionesCriticas: number;
  aprobacionesPendientes: number;
  ticketsSlaBreached: number;
  productosAgotados: number;
  cxcVencidasMonto: number;
  pickingSinAsignar: number;

  // Comportamiento
  cambiosTabUltimos5Min: number;
  minutosEnSesionSinPausa: number;
  horaDelDia: number;       // 0-23
  esFinDeSemana: boolean;
  erroresRecientes: number; // toasts/errores en última hora
}

export interface StressScore {
  total: number;            // 0-100
  nivel: 'tranquilo' | 'normal' | 'elevado' | 'alto' | 'critico';
  componentes: Array<{
    fuente: string;
    valor: number;        // 0-100
    peso: number;         // 0-1
    descripcion: string;
  }>;
  recomendacion: string;
  sugerirFocus: boolean;
}

// =====================================================
// Pesos relativos de cada señal
// =====================================================
const PESOS = {
  notificacionesCriticas: 0.20,
  aprobacionesPendientes: 0.12,
  ticketsSlaBreached:     0.15,
  productosAgotados:      0.07,
  cxcVencidasMonto:       0.06,
  pickingSinAsignar:      0.08,

  cambiosTabUltimos5Min:  0.10,
  minutosEnSesionSinPausa:0.08,
  horaDelDia:             0.05,
  finDeSemana:            0.03,
  erroresRecientes:       0.04,
};

// =====================================================
// Funciones de normalización por señal (0-100)
// =====================================================

function normNotifsCriticas(n: number): number {
  // 0 → 0, 5 → 70, 10+ → 100
  return Math.min(100, n * 14);
}
function normAprobaciones(n: number): number {
  return Math.min(100, n * 12);
}
function normTicketsSla(n: number): number {
  return Math.min(100, n * 22);
}
function normProductosAgotados(n: number): number {
  return Math.min(100, n * 15);
}
function normCxcVencidas(monto: number): number {
  // Threshold UY genérico: 50k pesos = empieza a estresar, 500k = max
  if (monto < 50_000) return 0;
  return Math.min(100, ((monto - 50_000) / 4_500) * 1);
}
function normPickingSinAsignar(n: number): number {
  return Math.min(100, n * 8);
}
function normCambiosTab(n: number): number {
  // Más de 15 cambios en 5min = frenesí
  if (n < 6) return 0;
  if (n >= 25) return 100;
  return ((n - 6) / 19) * 100;
}
function normMinutosSinPausa(min: number): number {
  // 90+ min sin pausa = alto, 180+ = max
  if (min < 60) return 0;
  if (min >= 180) return 100;
  return ((min - 60) / 120) * 100;
}
function normHora(h: number): number {
  // Madrugada (0-6) y muy noche (22-23) suben
  if (h >= 22 || h < 6) return 80;
  // Cerca del cierre típico
  if (h >= 18 && h < 20) return 50;
  return 10;
}
function normErroresRecientes(n: number): number {
  return Math.min(100, n * 20);
}

// =====================================================
// Calcular score total
// =====================================================

export function calcularStressScore(signals: StressSignals): StressScore {
  const componentes = [
    { fuente: 'Notificaciones críticas',
      valor: normNotifsCriticas(signals.notificacionesCriticas),
      peso: PESOS.notificacionesCriticas,
      descripcion: `${signals.notificacionesCriticas} alertas críticas activas` },
    { fuente: 'Aprobaciones pendientes',
      valor: normAprobaciones(signals.aprobacionesPendientes),
      peso: PESOS.aprobacionesPendientes,
      descripcion: `${signals.aprobacionesPendientes} esperando tu firma` },
    { fuente: 'Tickets con SLA vencido',
      valor: normTicketsSla(signals.ticketsSlaBreached),
      peso: PESOS.ticketsSlaBreached,
      descripcion: `${signals.ticketsSlaBreached} tickets fuera de SLA` },
    { fuente: 'Productos agotados',
      valor: normProductosAgotados(signals.productosAgotados),
      peso: PESOS.productosAgotados,
      descripcion: `${signals.productosAgotados} productos sin stock` },
    { fuente: 'CxC vencidas',
      valor: normCxcVencidas(signals.cxcVencidasMonto),
      peso: PESOS.cxcVencidasMonto,
      descripcion: `${signals.cxcVencidasMonto.toLocaleString('es-UY')} en cuentas atrasadas` },
    { fuente: 'Picking sin asignar',
      valor: normPickingSinAsignar(signals.pickingSinAsignar),
      peso: PESOS.pickingSinAsignar,
      descripcion: `${signals.pickingSinAsignar} órdenes sin picker` },
    { fuente: 'Frenesí navegando',
      valor: normCambiosTab(signals.cambiosTabUltimos5Min),
      peso: PESOS.cambiosTabUltimos5Min,
      descripcion: `${signals.cambiosTabUltimos5Min} cambios de pantalla en 5 min` },
    { fuente: 'Tiempo sin pausa',
      valor: normMinutosSinPausa(signals.minutosEnSesionSinPausa),
      peso: PESOS.minutosEnSesionSinPausa,
      descripcion: `${signals.minutosEnSesionSinPausa} minutos seguidos trabajando` },
    { fuente: 'Hora del día',
      valor: normHora(signals.horaDelDia),
      peso: PESOS.horaDelDia,
      descripcion: signals.horaDelDia >= 22 || signals.horaDelDia < 6
        ? 'Trabajando fuera de horario habitual'
        : signals.horaDelDia >= 18
          ? 'Cerca del cierre del día'
          : 'Horario normal' },
    { fuente: 'Fin de semana',
      valor: signals.esFinDeSemana ? 80 : 0,
      peso: PESOS.finDeSemana,
      descripcion: signals.esFinDeSemana ? 'Trabajando fin de semana' : 'Día laboral' },
    { fuente: 'Errores recientes',
      valor: normErroresRecientes(signals.erroresRecientes),
      peso: PESOS.erroresRecientes,
      descripcion: `${signals.erroresRecientes} errores vistos en la última hora` },
  ];

  const total = Math.round(
    componentes.reduce((s, c) => s + c.valor * c.peso, 0)
  );

  let nivel: StressScore['nivel'];
  let recomendacion: string;
  if (total < 30) {
    nivel = 'tranquilo';
    recomendacion = 'Todo bajo control. Aprovechá para tareas largas o tomarte un mate.';
  } else if (total < 50) {
    nivel = 'normal';
    recomendacion = 'Carga manejable. Seguí a tu ritmo.';
  } else if (total < 70) {
    nivel = 'elevado';
    recomendacion = 'Hay varias cosas exigiendo tu atención. Priorizá lo crítico.';
  } else if (total < 85) {
    nivel = 'alto';
    recomendacion = 'Mucho ruido en pantalla. Sugiero activar Focus Mode para concentrarte en una cosa a la vez.';
  } else {
    nivel = 'critico';
    recomendacion = 'Sobrecarga importante. Activá Focus Mode YA y resolvé de a una. Si necesitás, pedíle al asistente IA que te ayude a priorizar.';
  }

  return {
    total,
    nivel,
    componentes: componentes.filter(c => c.valor > 0),
    recomendacion,
    sugerirFocus: total >= 65,
  };
}

// =====================================================
// Cargar señales del sistema (Supabase)
// =====================================================

interface LoadOptions {
  usuarioEmail: string;
  rol: string;
}

export async function loadSystemSignals(opts: LoadOptions): Promise<Partial<StressSignals>> {
  const result: Partial<StressSignals> = {};

  try {
    // Notificaciones críticas activas (no descartadas)
    const { count: notifs } = await supabase
      .from('notificaciones')
      .select('id', { count: 'exact', head: true })
      .eq('descartada', false)
      .in('severidad', ['error', 'warning']);
    result.notificacionesCriticas = notifs ?? 0;
  } catch { result.notificacionesCriticas = 0; }

  try {
    // Aprobaciones pendientes (asignadas al usuario o sin asignar)
    let q = supabase.from('aprobaciones')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente');
    if (opts.rol === 'admin') {
      // Admin ve todas
    } else {
      q = q.or(`asignado_a.is.null,asignado_a.eq.${opts.usuarioEmail}`);
    }
    const { count } = await q;
    result.aprobacionesPendientes = count ?? 0;
  } catch { result.aprobacionesPendientes = 0; }

  try {
    // Tickets con SLA vencido
    const ahora = new Date().toISOString();
    const { count } = await supabase
      .from('tickets_soporte')
      .select('id', { count: 'exact', head: true })
      .in('estado', ['abierto', 'en_progreso', 'esperando_cliente', 'esperando_repuesto'])
      .lt('sla_vencimiento', ahora);
    result.ticketsSlaBreached = count ?? 0;
  } catch { result.ticketsSlaBreached = 0; }

  try {
    // Productos agotados
    const { data } = await supabase
      .from('productos').select('stock').is('deleted_at', null).eq('stock', 0);
    result.productosAgotados = data?.length ?? 0;
  } catch { result.productosAgotados = 0; }

  try {
    // CxC vencidas (suma de saldo)
    const hoy = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('cuentas_por_cobrar')
      .select('saldo, monto')
      .neq('estado', 'pagada')
      .lt('fecha_vencimiento', hoy);
    const total = (data || []).reduce((s, c: any) =>
      s + (parseFloat(c.saldo) || parseFloat(c.monto) || 0), 0);
    result.cxcVencidasMonto = total;
  } catch { result.cxcVencidasMonto = 0; }

  try {
    // Picking sin asignar (solo importa si rol bodeguero/admin)
    if (['admin', 'bodeguero'].includes(opts.rol)) {
      const { count } = await supabase
        .from('wms_ordenes_picking')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'pendiente')
        .is('picker_asignado', null);
      result.pickingSinAsignar = count ?? 0;
    } else {
      result.pickingSinAsignar = 0;
    }
  } catch { result.pickingSinAsignar = 0; }

  return result;
}

// =====================================================
// Construir signals completas (sistema + comportamiento)
// =====================================================

export interface BehaviorTracker {
  cambiosTabUltimos5Min: number;
  minutosEnSesionSinPausa: number;
  erroresRecientes: number;
}

export function combinarSignals(
  sistema: Partial<StressSignals>,
  comportamiento: BehaviorTracker
): StressSignals {
  const ahora = new Date();
  const dia = ahora.getDay();
  return {
    notificacionesCriticas:    sistema.notificacionesCriticas ?? 0,
    aprobacionesPendientes:    sistema.aprobacionesPendientes ?? 0,
    ticketsSlaBreached:        sistema.ticketsSlaBreached ?? 0,
    productosAgotados:         sistema.productosAgotados ?? 0,
    cxcVencidasMonto:          sistema.cxcVencidasMonto ?? 0,
    pickingSinAsignar:         sistema.pickingSinAsignar ?? 0,
    cambiosTabUltimos5Min:     comportamiento.cambiosTabUltimos5Min,
    minutosEnSesionSinPausa:   comportamiento.minutosEnSesionSinPausa,
    horaDelDia:                ahora.getHours(),
    esFinDeSemana:             dia === 0 || dia === 6,
    erroresRecientes:          comportamiento.erroresRecientes,
  };
}
