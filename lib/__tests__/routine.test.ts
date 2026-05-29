import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordModuleVisit,
  getRoutineSuggestions,
  getRoutineMaturity,
} from '@/lib/home/routine';

const USER = 'test@vanguard.com';

function at(hour: number, dayOffset = 0): Date {
  const d = new Date(2026, 4, 29, hour, 0, 0); // viernes 29/05/2026
  d.setDate(d.getDate() - dayOffset);
  return d;
}

beforeEach(() => {
  localStorage.clear();
});

describe('routine — aprendizaje local de rutina', () => {
  it('no sugiere nada hasta tener datos suficientes', () => {
    recordModuleVisit(USER, 'stock', at(9));
    expect(getRoutineSuggestions(USER, { now: at(9) })).toEqual([]);
    expect(getRoutineMaturity(USER).learning).toBe(false);
  });

  it('no registra el módulo inicio', () => {
    for (let i = 0; i < 5; i++) recordModuleVisit(USER, 'inicio', at(9, i));
    expect(getRoutineMaturity(USER).events).toBe(0);
  });

  it('aprende y prioriza lo que se usa a esta hora', () => {
    // Mañana (9h): stock muchas veces. Tarde (17h): reportes.
    for (let i = 0; i < 8; i++) recordModuleVisit(USER, 'stock', at(9, i));
    for (let i = 0; i < 8; i++) recordModuleVisit(USER, 'reportes', at(17, i));

    const enLaManana = getRoutineSuggestions(USER, { now: at(9) });
    expect(enLaManana.length).toBeGreaterThan(0);
    expect(enLaManana[0].tab).toBe('stock');

    const enLaTarde = getRoutineSuggestions(USER, { now: at(17) });
    expect(enLaTarde[0].tab).toBe('reportes');
  });

  it('respeta el límite y la lista de exclusión', () => {
    for (let i = 0; i < 6; i++) {
      recordModuleVisit(USER, 'stock', at(9, i));
      recordModuleVisit(USER, 'movimientos', at(10, i));
      recordModuleVisit(USER, 'reportes', at(11, i));
    }
    const sugs = getRoutineSuggestions(USER, { now: at(10), limit: 2, exclude: ['stock'] });
    expect(sugs.length).toBeLessThanOrEqual(2);
    expect(sugs.find(s => s.tab === 'stock')).toBeUndefined();
  });

  it('dedup: no cuenta la misma pestaña dos veces en <3s', () => {
    const t = at(9);
    recordModuleVisit(USER, 'stock', t);
    recordModuleVisit(USER, 'stock', new Date(t.getTime() + 1000)); // 1s después
    expect(getRoutineMaturity(USER).events).toBe(1);
  });

  it('los scores están normalizados a [0,1]', () => {
    for (let i = 0; i < 12; i++) recordModuleVisit(USER, 'stock', at(9, i));
    for (let i = 0; i < 4; i++) recordModuleVisit(USER, 'pricing', at(9, i));
    const sugs = getRoutineSuggestions(USER, { now: at(9) });
    for (const s of sugs) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
    expect(sugs[0].score).toBe(1); // el más fuerte queda en 1
  });
});
