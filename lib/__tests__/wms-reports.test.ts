import { describe, it, expect } from 'vitest';
import { aCSV } from '@/lib/wms-reports';

describe('wms-reports — aCSV', () => {
  it('devuelve string vacío para lista vacía', () => {
    expect(aCSV([])).toBe('');
  });

  it('escribe headers + filas', () => {
    const csv = aCSV([
      { nombre: 'Juan', total: 100 },
      { nombre: 'Ana', total: 200 },
    ]);
    expect(csv).toContain('nombre,total');
    expect(csv).toContain('Juan,100');
    expect(csv).toContain('Ana,200');
  });

  it('escapa comas con comillas', () => {
    const csv = aCSV([{ texto: 'Hola, mundo', n: 1 }]);
    expect(csv).toContain('"Hola, mundo"');
  });

  it('escapa comillas duplicándolas', () => {
    const csv = aCSV([{ texto: 'dijo "hola"' }]);
    expect(csv).toContain('"dijo ""hola"""');
  });

  it('maneja null/undefined como vacío', () => {
    const csv = aCSV([{ a: null, b: undefined, c: 0 }]);
    const lines = csv.split('\n');
    expect(lines[1]).toBe(',,0');
  });
});
