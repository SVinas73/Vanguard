import { describe, it, expect } from 'vitest';
import { calcularTotales } from '@/lib/uy-cfe';

describe('uy-cfe — calcularTotales', () => {
  it('una línea con IVA 22 calcula bien', () => {
    const r = calcularTotales([{
      descripcion: 'Producto X',
      cantidad: 10,
      precioUnitario: 100,
    }]);
    expect(r.neto).toBe(1000);
    expect(r.iva).toBe(220);
    expect(r.total).toBe(1220);
  });

  it('aplica descuento por línea', () => {
    const r = calcularTotales([{
      descripcion: 'Y',
      cantidad: 5,
      precioUnitario: 200,
      descuentoPct: 10, // 10% de 1000 = 100
      ivaTasa: 22,
    }]);
    expect(r.neto).toBe(900);
    expect(r.iva).toBe(198); // 22% de 900
    expect(r.total).toBe(1098);
  });

  it('respeta tasa 0 (exento)', () => {
    const r = calcularTotales([{
      descripcion: 'Exento',
      cantidad: 1,
      precioUnitario: 500,
      ivaTasa: 0,
    }]);
    expect(r.neto).toBe(500);
    expect(r.iva).toBe(0);
    expect(r.total).toBe(500);
  });

  it('agrupa varias tasas en por_tasa', () => {
    const r = calcularTotales([
      { descripcion: 'Bas', cantidad: 1, precioUnitario: 100, ivaTasa: 22 },
      { descripcion: 'Min', cantidad: 1, precioUnitario: 100, ivaTasa: 10 },
      { descripcion: 'Exento', cantidad: 1, precioUnitario: 100, ivaTasa: 0 },
    ]);
    expect(r.por_tasa[22].neto).toBe(100);
    expect(r.por_tasa[22].iva).toBe(22);
    expect(r.por_tasa[10].neto).toBe(100);
    expect(r.por_tasa[10].iva).toBe(10);
    expect(r.por_tasa[0].neto).toBe(100);
    expect(r.por_tasa[0].iva).toBe(0);
    expect(r.total).toBe(332);
  });

  it('suma múltiples líneas con misma tasa', () => {
    const r = calcularTotales([
      { descripcion: 'A', cantidad: 2, precioUnitario: 50 },
      { descripcion: 'B', cantidad: 3, precioUnitario: 100 },
    ]);
    // 100 + 300 = 400 neto, 88 iva, 488 total
    expect(r.neto).toBe(400);
    expect(r.iva).toBe(88);
    expect(r.total).toBe(488);
  });

  it('lista vacía devuelve ceros', () => {
    const r = calcularTotales([]);
    expect(r.neto).toBe(0);
    expect(r.iva).toBe(0);
    expect(r.total).toBe(0);
  });
});
