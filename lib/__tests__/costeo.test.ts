import { describe, it, expect } from 'vitest';
import {
  normalizarMoneda,
  convertirCosto,
  calcularCostoPromedio,
  obtenerTasaUyuPorUsd,
} from '@/lib/costeo';

// =====================================================
// Reglas de costeo: un artículo puede comprarse hoy a un
// precio y mañana a otro, y en monedas distintas.
// =====================================================

describe('costeo — normalizarMoneda', () => {
  it('USD se mantiene, todo lo demás es UYU', () => {
    expect(normalizarMoneda('USD')).toBe('USD');
    expect(normalizarMoneda('UYU')).toBe('UYU');
    expect(normalizarMoneda(undefined)).toBe('UYU');
    expect(normalizarMoneda('')).toBe('UYU');
  });
});

describe('costeo — convertirCosto', () => {
  it('misma moneda no convierte', () => {
    expect(convertirCosto(123, 'USD', 'USD', 40)).toBe(123);
  });

  it('USD → UYU multiplica y UYU → USD divide', () => {
    expect(convertirCosto(10, 'USD', 'UYU', 40)).toBe(400);
    expect(convertirCosto(400, 'UYU', 'USD', 40)).toBe(10);
  });

  it('tasa inválida cae en la de referencia (40)', () => {
    expect(convertirCosto(10, 'USD', 'UYU', 0)).toBe(400);
  });
});

describe('costeo — calcularCostoPromedio', () => {
  it('pondera el costo nuevo con el stock previo', () => {
    // 10 u a 100 + 10 u a 200 → 150
    expect(calcularCostoPromedio(10, 100, 10, 200)).toBe(150);
  });

  it('una entrada sin costo no diluye el promedio', () => {
    expect(calcularCostoPromedio(10, 100, 5, null)).toBe(100);
    expect(calcularCostoPromedio(10, 100, 5, 0)).toBe(100);
  });

  it('sin stock previo toma el costo de la entrada', () => {
    expect(calcularCostoPromedio(0, 0, 4, 55)).toBe(55);
  });

  it('stock previo negativo se trata como cero', () => {
    expect(calcularCostoPromedio(-3, 80, 2, 100)).toBe(100);
  });

  it('compra en USD de un producto en UYU se convierte antes de promediar', () => {
    const costoEnPesos = convertirCosto(5, 'USD', 'UYU', 40); // 200
    expect(calcularCostoPromedio(10, 100, 10, costoEnPesos)).toBe(150);
  });
});

describe('costeo — obtenerTasaUyuPorUsd', () => {
  const fakeSupabase = (rows: any[] | null, fail = false) => ({
    from: () => {
      const q: any = {
        select: () => q,
        in: () => q,
        order: () => q,
        limit: () => q,
        eq: () => q,
        then: (resolve: any, reject: any) =>
          fail ? Promise.reject(new Error('x')).then(resolve, reject)
               : Promise.resolve({ data: rows }).then(resolve, reject),
      };
      return q;
    },
  });

  it('usa la cotización USD→UYU cargada', async () => {
    const tasa = await obtenerTasaUyuPorUsd(
      fakeSupabase([{ moneda_origen: 'USD', moneda_destino: 'UYU', tasa: 41.5, fecha: '2026-01-01' }]),
    );
    expect(tasa).toBe(41.5);
  });

  it('invierte una cotización UYU→USD', async () => {
    const tasa = await obtenerTasaUyuPorUsd(
      fakeSupabase([{ moneda_origen: 'UYU', moneda_destino: 'USD', tasa: 0.025, fecha: '2026-01-01' }]),
    );
    expect(tasa).toBeCloseTo(40);
  });

  it('sin cotizaciones o con error usa 40', async () => {
    expect(await obtenerTasaUyuPorUsd(fakeSupabase([]))).toBe(40);
    expect(await obtenerTasaUyuPorUsd(fakeSupabase(null, true))).toBe(40);
  });
});
