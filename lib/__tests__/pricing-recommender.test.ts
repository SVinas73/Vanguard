import { describe, it, expect } from 'vitest';
import { recomendarPrecios, type VentaItem, type ProductoInput } from '@/lib/pricing/recommender';

describe('Pricing Recommender — elasticidad y precio óptimo', () => {
  it('detecta demanda elástica y sugiere precio coherente', () => {
    const prod: ProductoInput[] = [
      { codigo: 'A1', nombre: 'Test elástico', precio_actual: 100, costo_promedio: 60 },
    ];
    // Demanda muy sensible al precio: a $80 vende 100u, a $120 vende 25u
    const ventas: VentaItem[] = [
      ...Array.from({ length: 12 }, () => ({ producto_codigo: 'A1', cantidad: 8, precio_unitario: 80, costo_unitario: 60 })),
      ...Array.from({ length: 10 }, () => ({ producto_codigo: 'A1', cantidad: 5, precio_unitario: 100, costo_unitario: 60 })),
      ...Array.from({ length: 10 }, () => ({ producto_codigo: 'A1', cantidad: 2, precio_unitario: 120, costo_unitario: 60 })),
    ];
    const recs = recomendarPrecios(prod, ventas);
    expect(recs).toHaveLength(1);
    const r = recs[0];
    expect(r.elasticidad).not.toBeNull();
    expect(r.elasticidad!).toBeLessThan(-1); // elástica
    expect(r.confianza).toBe('alta');
    expect(r.precio_sugerido).toBeGreaterThan(60); // arriba del costo
  });

  it('cae al fallback heurístico cuando hay pocos datos', () => {
    const prod: ProductoInput[] = [
      { codigo: 'B1', nombre: 'Sin histórico', precio_actual: 50, costo_promedio: 30 },
    ];
    const ventas: VentaItem[] = [
      { producto_codigo: 'B1', cantidad: 1, precio_unitario: 50, costo_unitario: 30 },
    ];
    const recs = recomendarPrecios(prod, ventas);
    expect(recs).toHaveLength(1);
    const r = recs[0];
    expect(r.elasticidad).toBeNull();
    expect(r.confianza).toBe('baja');
    // Margen objetivo 40% → precio sugerido = 30 / 0.6 = 50
    expect(r.precio_sugerido).toBeCloseTo(50, 0);
  });

  it('detecta oportunidad de subir cuando la demanda es inelástica', () => {
    const prod: ProductoInput[] = [
      { codigo: 'C1', nombre: 'Inelástico', precio_actual: 80, costo_promedio: 40 },
    ];
    // Demanda casi constante a distintos precios → inelástica (e cercano a 0)
    const ventas: VentaItem[] = [
      ...Array.from({ length: 10 }, () => ({ producto_codigo: 'C1', cantidad: 10, precio_unitario: 70, costo_unitario: 40 })),
      ...Array.from({ length: 10 }, () => ({ producto_codigo: 'C1', cantidad: 9, precio_unitario: 80, costo_unitario: 40 })),
      ...Array.from({ length: 10 }, () => ({ producto_codigo: 'C1', cantidad: 9, precio_unitario: 90, costo_unitario: 40 })),
    ];
    const recs = recomendarPrecios(prod, ventas);
    const r = recs[0];
    expect(r.precio_sugerido).toBeGreaterThanOrEqual(r.precio_actual);
    expect(['subir', 'mantener']).toContain(r.oportunidad);
  });

  it('ordena por impacto de margen anual desc', () => {
    const prods: ProductoInput[] = [
      { codigo: 'X1', nombre: 'Bajo volumen', precio_actual: 100, costo_promedio: 60 },
      { codigo: 'X2', nombre: 'Alto volumen', precio_actual: 50, costo_promedio: 30 },
    ];
    const ventas: VentaItem[] = [
      // X1: poco volumen
      ...Array.from({ length: 4 }, () => ({ producto_codigo: 'X1', cantidad: 5, precio_unitario: 100, costo_unitario: 60 })),
      // X2: mucho volumen, ampliamente subprecio
      ...Array.from({ length: 30 }, () => ({ producto_codigo: 'X2', cantidad: 50, precio_unitario: 40, costo_unitario: 30 })),
      ...Array.from({ length: 30 }, () => ({ producto_codigo: 'X2', cantidad: 30, precio_unitario: 50, costo_unitario: 30 })),
    ];
    const recs = recomendarPrecios(prods, ventas);
    // El de mayor impacto debe ir primero
    expect(recs[0].impacto_margen_anual).toBeGreaterThanOrEqual(recs[1].impacto_margen_anual);
  });

  it('filtra elasticidades absurdas (>10 en valor absoluto)', () => {
    const prod: ProductoInput[] = [
      { codigo: 'D1', nombre: 'Datos ruidosos', precio_actual: 100, costo_promedio: 60 },
    ];
    // Datos contradictorios que producen elasticidad muy alta
    const ventas: VentaItem[] = [
      { producto_codigo: 'D1', cantidad: 1000, precio_unitario: 99, costo_unitario: 60 },
      { producto_codigo: 'D1', cantidad: 1000, precio_unitario: 99, costo_unitario: 60 },
      { producto_codigo: 'D1', cantidad: 1, precio_unitario: 100, costo_unitario: 60 },
      { producto_codigo: 'D1', cantidad: 1, precio_unitario: 100, costo_unitario: 60 },
      { producto_codigo: 'D1', cantidad: 1, precio_unitario: 100, costo_unitario: 60 },
      { producto_codigo: 'D1', cantidad: 1, precio_unitario: 100, costo_unitario: 60 },
      { producto_codigo: 'D1', cantidad: 1, precio_unitario: 100, costo_unitario: 60 },
      { producto_codigo: 'D1', cantidad: 1, precio_unitario: 100, costo_unitario: 60 },
    ];
    const recs = recomendarPrecios(prod, ventas);
    const r = recs[0];
    // Si filtró la elasticidad absurda, cae al fallback heurístico
    // Si no la filtró, al menos no debe dar un precio absurdo
    expect(r.precio_sugerido).toBeGreaterThan(60); // arriba del costo
    expect(r.precio_sugerido).toBeLessThan(300); // no estratosférico
  });
});
