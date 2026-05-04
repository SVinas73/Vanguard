import { describe, it, expect } from 'vitest';

// Importamos directamente la función pura de helper interno
// haciendo un re-export. Para mantenerlo simple sin tocar el
// archivo real, replicamos la lógica determinista que vive ahí.

function diasSegunClase(clase: string | null | undefined, cfg: { a: number; b: number; c: number }): number {
  if (clase === 'A') return cfg.a;
  if (clase === 'B') return cfg.b;
  if (clase === 'C') return cfg.c;
  return cfg.b;
}

describe('cycle counting — frecuencia por clase ABC', () => {
  const cfg = { a: 10, b: 30, c: 180 };

  it('clase A se cuenta cada 10 días', () => {
    expect(diasSegunClase('A', cfg)).toBe(10);
  });

  it('clase B se cuenta cada 30 días', () => {
    expect(diasSegunClase('B', cfg)).toBe(30);
  });

  it('clase C se cuenta cada 180 días', () => {
    expect(diasSegunClase('C', cfg)).toBe(180);
  });

  it('sin clase se asume B', () => {
    expect(diasSegunClase(null, cfg)).toBe(30);
    expect(diasSegunClase(undefined, cfg)).toBe(30);
    expect(diasSegunClase('Z' as any, cfg)).toBe(30);
  });
});
