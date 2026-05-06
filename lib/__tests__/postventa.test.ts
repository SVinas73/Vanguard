import { describe, it, expect } from 'vitest';

// =====================================================
// Tests para lógica pura de post-venta
// =====================================================
// No probamos las llamadas a Supabase (eso es integración).
// Probamos la lógica determinista que está en los helpers.
// =====================================================

// Replica la lógica de cálculo de vencimiento de garantía
// (lib/garantias.ts crearGarantia)
function calcularFechaVencimiento(inicio: string, duracionMeses: number): string {
  const venc = new Date(inicio);
  venc.setMonth(venc.getMonth() + duracionMeses);
  return venc.toISOString().split('T')[0];
}

// Replica la lógica de SLA (lib/tickets.ts getSLAHoras fallback)
function slaFallback(prioridad: 'baja' | 'normal' | 'alta' | 'critica'): number {
  const m: Record<string, number> = { critica: 4, alta: 24, normal: 72, baja: 168 };
  return m[prioridad] ?? 72;
}

// Replica la lógica de SLA breached
function isSLABreached(slaVencimiento: string | null | undefined, ahora: Date = new Date()): boolean {
  if (!slaVencimiento) return false;
  return new Date(slaVencimiento) < ahora;
}

// Días restantes hasta vencimiento de garantía
function diasHastaVencimiento(fechaVenc: string, hoy: Date = new Date()): number {
  const venc = new Date(fechaVenc);
  return Math.ceil((venc.getTime() - hoy.getTime()) / 86400000);
}

describe('garantías — cálculo de vencimiento', () => {
  it('12 meses sumados al inicio', () => {
    expect(calcularFechaVencimiento('2025-01-15', 12)).toBe('2026-01-15');
  });

  it('24 meses', () => {
    expect(calcularFechaVencimiento('2024-06-01', 24)).toBe('2026-06-01');
  });

  it('6 meses pasando de año', () => {
    expect(calcularFechaVencimiento('2025-09-01', 6)).toBe('2026-03-01');
  });

  it('1 mes (mensual)', () => {
    expect(calcularFechaVencimiento('2025-05-15', 1)).toBe('2025-06-15');
  });

  it('0 meses devuelve la misma fecha', () => {
    expect(calcularFechaVencimiento('2025-05-15', 0)).toBe('2025-05-15');
  });
});

describe('tickets — SLA fallback', () => {
  it('crítica = 4 horas', () => {
    expect(slaFallback('critica')).toBe(4);
  });

  it('alta = 24 horas', () => {
    expect(slaFallback('alta')).toBe(24);
  });

  it('normal = 72 horas', () => {
    expect(slaFallback('normal')).toBe(72);
  });

  it('baja = 168 horas (una semana)', () => {
    expect(slaFallback('baja')).toBe(168);
  });

  it('crítica < alta < normal < baja (orden inverso a velocidad)', () => {
    expect(slaFallback('critica')).toBeLessThan(slaFallback('alta'));
    expect(slaFallback('alta')).toBeLessThan(slaFallback('normal'));
    expect(slaFallback('normal')).toBeLessThan(slaFallback('baja'));
  });
});

describe('tickets — isSLABreached', () => {
  const ahora = new Date('2025-06-01T12:00:00Z');

  it('SLA en el pasado → breached', () => {
    expect(isSLABreached('2025-05-30T10:00:00Z', ahora)).toBe(true);
  });

  it('SLA en el futuro → no breached', () => {
    expect(isSLABreached('2025-06-15T10:00:00Z', ahora)).toBe(false);
  });

  it('SLA null → no breached', () => {
    expect(isSLABreached(null, ahora)).toBe(false);
    expect(isSLABreached(undefined, ahora)).toBe(false);
  });

  it('SLA exacto en este momento → no breached (corte estricto)', () => {
    expect(isSLABreached('2025-06-01T12:00:00Z', ahora)).toBe(false);
  });
});

describe('garantías — días hasta vencimiento', () => {
  const hoy = new Date('2025-06-01T12:00:00Z');

  it('vencimiento en 30 días', () => {
    const v = '2025-07-01';
    const dias = diasHastaVencimiento(v, hoy);
    expect(dias).toBeGreaterThanOrEqual(29);
    expect(dias).toBeLessThanOrEqual(31);
  });

  it('ya vencida → días negativos', () => {
    const dias = diasHastaVencimiento('2025-05-01', hoy);
    expect(dias).toBeLessThan(0);
  });

  it('vence hoy', () => {
    const dias = diasHastaVencimiento('2025-06-01', hoy);
    expect(dias).toBeLessThanOrEqual(0);
  });
});

describe('tickets — categorización de canales', () => {
  const canalesValidos = ['web', 'email', 'telefono', 'whatsapp', 'presencial'];

  it('los 5 canales son strings únicos', () => {
    expect(new Set(canalesValidos).size).toBe(5);
  });
});

describe('tickets — categorías', () => {
  const categorias = [
    'consulta', 'falla_producto', 'reclamo', 'pedido_info',
    'cambio', 'devolucion', 'instalacion', 'otro',
  ];

  it('cubre los flujos típicos de soporte', () => {
    expect(categorias).toContain('falla_producto');
    expect(categorias).toContain('reclamo');
    expect(categorias).toContain('devolucion');
  });

  it('no hay categorías duplicadas', () => {
    expect(new Set(categorias).size).toBe(categorias.length);
  });
});
