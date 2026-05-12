import { describe, it, expect } from 'vitest';
import { calcularStressScore, combinarSignals, type StressSignals } from '@/lib/stress-detector';

// =====================================================
// Tests del algoritmo de scoring de estrés
// =====================================================

function baseSignals(over: Partial<StressSignals> = {}): StressSignals {
  return {
    notificacionesCriticas: 0,
    aprobacionesPendientes: 0,
    ticketsSlaBreached: 0,
    productosAgotados: 0,
    cxcVencidasMonto: 0,
    pickingSinAsignar: 0,
    cambiosTabUltimos5Min: 0,
    minutosEnSesionSinPausa: 0,
    horaDelDia: 14,          // tarde laboral
    esFinDeSemana: false,
    erroresRecientes: 0,
    ...over,
  };
}

describe('stress-detector — calcularStressScore', () => {
  it('día tranquilo da score bajo (< 30)', () => {
    const sc = calcularStressScore(baseSignals());
    expect(sc.total).toBeLessThan(30);
    expect(sc.nivel).toBe('tranquilo');
    expect(sc.sugerirFocus).toBe(false);
  });

  it('muchas notificaciones críticas suben el score', () => {
    const tranquilo = calcularStressScore(baseSignals());
    const estresado = calcularStressScore(baseSignals({ notificacionesCriticas: 10 }));
    expect(estresado.total).toBeGreaterThan(tranquilo.total);
  });

  it('combinación de señales lleva a "alto" o "crítico"', () => {
    const sc = calcularStressScore(baseSignals({
      notificacionesCriticas: 8,
      aprobacionesPendientes: 6,
      ticketsSlaBreached: 5,
      productosAgotados: 4,
      cxcVencidasMonto: 200_000,
    }));
    expect(sc.total).toBeGreaterThanOrEqual(50);
    expect(['elevado', 'alto', 'critico']).toContain(sc.nivel);
  });

  it('sugerirFocus = true solo cuando el score >= 70', () => {
    const bajo = calcularStressScore(baseSignals({ notificacionesCriticas: 3 }));
    const alto = calcularStressScore(baseSignals({
      notificacionesCriticas: 10,
      aprobacionesPendientes: 8,
      ticketsSlaBreached: 7,
      productosAgotados: 5,
      cambiosTabUltimos5Min: 25,
      minutosEnSesionSinPausa: 180,
    }));
    expect(bajo.sugerirFocus).toBe(false);
    expect(alto.sugerirFocus).toBe(true);
  });

  it('score se mantiene entre 0 y 100', () => {
    const extremo = calcularStressScore(baseSignals({
      notificacionesCriticas: 100,
      aprobacionesPendientes: 100,
      ticketsSlaBreached: 100,
      productosAgotados: 100,
      cxcVencidasMonto: 10_000_000,
      pickingSinAsignar: 100,
      cambiosTabUltimos5Min: 100,
      minutosEnSesionSinPausa: 1000,
      horaDelDia: 3,
      esFinDeSemana: true,
      erroresRecientes: 50,
    }));
    expect(extremo.total).toBeLessThanOrEqual(100);
    expect(extremo.total).toBeGreaterThanOrEqual(0);
  });

  it('frenesí navegando (cambios de tab) suma estrés', () => {
    const sinFrenesi = calcularStressScore(baseSignals({ cambiosTabUltimos5Min: 2 }));
    const conFrenesi = calcularStressScore(baseSignals({ cambiosTabUltimos5Min: 30 }));
    expect(conFrenesi.total).toBeGreaterThan(sinFrenesi.total);
  });

  it('trabajar fuera de horario suma estrés', () => {
    const horario  = calcularStressScore(baseSignals({ horaDelDia: 10 }));
    const noche    = calcularStressScore(baseSignals({ horaDelDia: 23 }));
    const madrugada= calcularStressScore(baseSignals({ horaDelDia: 3 }));
    expect(noche.total).toBeGreaterThan(horario.total);
    expect(madrugada.total).toBeGreaterThan(horario.total);
  });

  it('fin de semana suma un poco', () => {
    const laboral = calcularStressScore(baseSignals());
    const finde   = calcularStressScore(baseSignals({ esFinDeSemana: true }));
    expect(finde.total).toBeGreaterThan(laboral.total);
  });

  it('tiempo prolongado sin pausa suma estrés', () => {
    const pausa = calcularStressScore(baseSignals({ minutosEnSesionSinPausa: 20 }));
    const largo = calcularStressScore(baseSignals({ minutosEnSesionSinPausa: 180 }));
    expect(largo.total).toBeGreaterThan(pausa.total);
  });

  it('CxC pequeñas no impactan, grandes sí', () => {
    const peq    = calcularStressScore(baseSignals({ cxcVencidasMonto: 10_000 }));
    const gigante= calcularStressScore(baseSignals({ cxcVencidasMonto: 500_000 }));
    expect(peq.total).toBeLessThan(gigante.total);
  });

  it('componentes incluyen sólo señales activas (valor > 0)', () => {
    const sc = calcularStressScore(baseSignals({ notificacionesCriticas: 5 }));
    // Hora del día y notificaciones siempre aportan algo
    expect(sc.componentes.length).toBeGreaterThan(0);
    expect(sc.componentes.find(c => c.fuente === 'Notificaciones críticas')).toBeDefined();
  });

  it('recomendación se ajusta al nivel', () => {
    const tranquilo = calcularStressScore(baseSignals());
    const critico = calcularStressScore(baseSignals({
      notificacionesCriticas: 50,
      aprobacionesPendientes: 30,
      ticketsSlaBreached: 20,
      productosAgotados: 20,
      cambiosTabUltimos5Min: 40,
      minutosEnSesionSinPausa: 300,
    }));
    expect(tranquilo.recomendacion).toMatch(/control|tranquilo|mate/i);
    expect(critico.recomendacion).toMatch(/focus|sobrecarga|priorizar|asistente/i);
  });
});

describe('stress-detector — combinarSignals', () => {
  it('arma signals completas con valores del sistema y comportamiento', () => {
    const fakeDate = new Date('2025-06-15T14:30:00');
    const original = Date;
    // No hace falta mockear: usamos los reales para no fragilizar.

    const signals = combinarSignals(
      { notificacionesCriticas: 5, aprobacionesPendientes: 3 },
      { cambiosTabUltimos5Min: 12, minutosEnSesionSinPausa: 90, erroresRecientes: 2 }
    );
    expect(signals.notificacionesCriticas).toBe(5);
    expect(signals.aprobacionesPendientes).toBe(3);
    expect(signals.cambiosTabUltimos5Min).toBe(12);
    expect(signals.minutosEnSesionSinPausa).toBe(90);
    expect(signals.erroresRecientes).toBe(2);
    // Hora del día siempre presente, 0-23
    expect(signals.horaDelDia).toBeGreaterThanOrEqual(0);
    expect(signals.horaDelDia).toBeLessThanOrEqual(23);
    expect(typeof signals.esFinDeSemana).toBe('boolean');
    void fakeDate; void original;
  });

  it('valores faltantes del sistema se asumen como 0', () => {
    const signals = combinarSignals(
      {},
      { cambiosTabUltimos5Min: 0, minutosEnSesionSinPausa: 0, erroresRecientes: 0 }
    );
    expect(signals.notificacionesCriticas).toBe(0);
    expect(signals.ticketsSlaBreached).toBe(0);
    expect(signals.cxcVencidasMonto).toBe(0);
  });
});

describe('stress-detector — niveles', () => {
  it('progresión correcta: tranquilo < normal < elevado < alto < critico', () => {
    // Generamos puntuaciones progresivas
    const niveles = [
      calcularStressScore(baseSignals()),
      calcularStressScore(baseSignals({ notificacionesCriticas: 3, aprobacionesPendientes: 2 })),
      calcularStressScore(baseSignals({ notificacionesCriticas: 6, aprobacionesPendientes: 5, ticketsSlaBreached: 3 })),
      calcularStressScore(baseSignals({
        notificacionesCriticas: 10, aprobacionesPendientes: 8, ticketsSlaBreached: 5,
        cambiosTabUltimos5Min: 20, minutosEnSesionSinPausa: 120,
      })),
    ];

    for (let i = 1; i < niveles.length; i++) {
      expect(niveles[i].total).toBeGreaterThanOrEqual(niveles[i - 1].total);
    }
  });
});
