import { describe, it, expect } from 'vitest';
import {
  optimizarReabastecimiento,
  type ProductoStock,
  type MovimientoSalida,
} from '@/lib/replenishment/optimizer';

function generarVentasDiarias(codigo: string, cantidadPorDia: number, dias: number): MovimientoSalida[] {
  const hoy = new Date();
  return Array.from({ length: dias }, (_, i) => {
    const d = new Date(hoy);
    d.setDate(d.getDate() - i);
    return {
      producto_codigo: codigo,
      cantidad: cantidadPorDia,
      fecha: d.toISOString(),
    };
  });
}

describe('Replenishment Optimizer — capital sobre stockout', () => {
  it('marca productos sin stock y con demanda como compra crítica', () => {
    const productos: ProductoStock[] = [
      { codigo: 'A1', nombre: 'Crítico', stock_actual: 2, stock_en_transito: 0, costo_promedio: 100, precio_venta: 150 },
    ];
    const movs = generarVentasDiarias('A1', 5, 60);
    const sugs = optimizarReabastecimiento(productos, movs);
    expect(sugs).toHaveLength(1);
    const s = sugs[0];
    expect(s.tipo).toBe('comprar');
    expect(['critica', 'alta']).toContain(s.urgencia);
    expect(s.cantidad_sugerida).toBeGreaterThan(0);
    expect(s.demanda_diaria_promedio).toBeGreaterThan(0);
  });

  it('detecta sobre-stock y sugiere reducir', () => {
    const productos: ProductoStock[] = [
      { codigo: 'B1', nombre: 'Sobre-stock', stock_actual: 1000, stock_en_transito: 0, costo_promedio: 50, precio_venta: 80 },
    ];
    // Demanda baja: 1 unidad/día → cobertura ~1000 días
    const movs = generarVentasDiarias('B1', 1, 90);
    const sugs = optimizarReabastecimiento(productos, movs);
    expect(sugs).toHaveLength(1);
    const s = sugs[0];
    expect(s.tipo).toBe('reducir');
    expect(s.cantidad_sugerida).toBeLessThan(0); // negativo = reducir
    expect(s.capital_liberable).toBeGreaterThan(0);
  });

  it('detecta stock muerto (sin movimiento) y sugiere reducir total', () => {
    const productos: ProductoStock[] = [
      { codigo: 'C1', nombre: 'Stock muerto', stock_actual: 50, stock_en_transito: 0, costo_promedio: 20, precio_venta: 35 },
    ];
    // Sin movimientos en los últimos 90 días
    const movs: MovimientoSalida[] = [];
    const sugs = optimizarReabastecimiento(productos, movs);
    const s = sugs[0];
    expect(s.tipo).toBe('reducir');
    expect(s.cantidad_sugerida).toBe(-50);
    expect(s.razon).toContain('Stock muerto');
  });

  it('mantiene productos con cobertura saludable', () => {
    const productos: ProductoStock[] = [
      { codigo: 'D1', nombre: 'Saludable', stock_actual: 100, stock_en_transito: 0, costo_promedio: 30, precio_venta: 50, lead_time_dias: 7 },
    ];
    // Demanda 2/día → cobertura 50 días, dentro de zona óptima
    const movs = generarVentasDiarias('D1', 2, 90);
    const sugs = optimizarReabastecimiento(productos, movs);
    const s = sugs[0];
    expect(s.tipo).toBe('mantener');
    expect(s.urgencia).toBe('baja');
  });

  it('marca productos sin datos como confianza baja', () => {
    const productos: ProductoStock[] = [
      { codigo: 'E1', nombre: 'Sin histórico', stock_actual: 10, stock_en_transito: 0, costo_promedio: 25, precio_venta: 40 },
    ];
    // Solo 3 ventas en 90 días
    const hoy = new Date();
    const movs: MovimientoSalida[] = [
      { producto_codigo: 'E1', cantidad: 1, fecha: new Date(hoy.getTime() - 10 * 86400000).toISOString() },
      { producto_codigo: 'E1', cantidad: 1, fecha: new Date(hoy.getTime() - 30 * 86400000).toISOString() },
      { producto_codigo: 'E1', cantidad: 1, fecha: new Date(hoy.getTime() - 60 * 86400000).toISOString() },
    ];
    const sugs = optimizarReabastecimiento(productos, movs);
    expect(sugs[0].confianza).toBe('baja');
  });

  it('prioriza urgencia crítica al inicio del ranking', () => {
    const productos: ProductoStock[] = [
      { codigo: 'F1', nombre: 'Baja urgencia', stock_actual: 100, stock_en_transito: 0, costo_promedio: 10, precio_venta: 20 },
      { codigo: 'F2', nombre: 'Crítica', stock_actual: 1, stock_en_transito: 0, costo_promedio: 100, precio_venta: 150 },
    ];
    const movs = [
      ...generarVentasDiarias('F1', 2, 90),
      ...generarVentasDiarias('F2', 5, 90),
    ];
    const sugs = optimizarReabastecimiento(productos, movs);
    expect(sugs[0].codigo).toBe('F2'); // crítica primero
  });

  it('respeta service level conservador (90% no 95%)', () => {
    // Con z=1.28 (90% SL) el safety stock es modesto vs z=1.645 (95%).
    // Para demanda casi-constante (~5/día), safety debería ser ≤ demanda·1día.
    const productos: ProductoStock[] = [
      { codigo: 'G1', nombre: 'Conservador', stock_actual: 0, stock_en_transito: 0, costo_promedio: 50, precio_venta: 80, lead_time_dias: 10 },
    ];
    const movs = generarVentasDiarias('G1', 5, 90);
    const sugs = optimizarReabastecimiento(productos, movs);
    const s = sugs[0];
    // Con demanda casi-constante, el safety stock debe ser modesto:
    // significativamente menor que demanda total durante lead time (5·10 = 50)
    expect(s.stock_seguridad).toBeLessThan(10);
  });

  it('EOQ es positivo cuando hay demanda anual', () => {
    const productos: ProductoStock[] = [
      { codigo: 'H1', nombre: 'EOQ test', stock_actual: 5, stock_en_transito: 0, costo_promedio: 25, precio_venta: 40 },
    ];
    const movs = generarVentasDiarias('H1', 3, 365); // demanda anualizada
    const sugs = optimizarReabastecimiento(productos, movs);
    expect(sugs[0].cantidad_optima_compra).toBeGreaterThan(0);
  });
});

describe('Replenishment Optimizer — robustez y casos borde', () => {
  it('no rompe sin productos ni movimientos', () => {
    expect(optimizarReabastecimiento([], [])).toEqual([]);
  });

  it('maneja producto con costo 0 usando 60% del precio de venta', () => {
    const productos: ProductoStock[] = [
      { codigo: 'R1', nombre: 'Sin costo', stock_actual: 10, stock_en_transito: 0, costo_promedio: 0, precio_venta: 100 },
    ];
    const sugs = optimizarReabastecimiento(productos, generarVentasDiarias('R1', 2, 90));
    expect(sugs).toHaveLength(1);
    expect(Number.isFinite(sugs[0].capital_inmovilizado_actual)).toBe(true);
  });

  it('no produce NaN/Infinity en ningún campo numérico', () => {
    const productos: ProductoStock[] = [
      { codigo: 'N1', nombre: 'Activo', stock_actual: 50, stock_en_transito: 5, costo_promedio: 20, precio_venta: 35 },
      { codigo: 'N2', nombre: 'Muerto', stock_actual: 30, stock_en_transito: 0, costo_promedio: 15, precio_venta: 25 },
      { codigo: 'N3', nombre: 'Sin stock', stock_actual: 0, stock_en_transito: 0, costo_promedio: 10, precio_venta: 18 },
    ];
    const movs = [
      ...generarVentasDiarias('N1', 4, 120),
      ...generarVentasDiarias('N3', 1, 30),
      // N2 sin movimientos → stock muerto
    ];
    const sugs = optimizarReabastecimiento(productos, movs);
    for (const s of sugs) {
      for (const [k, v] of Object.entries(s)) {
        if (typeof v === 'number') {
          expect(Number.isFinite(v), `${s.codigo}.${k} debe ser finito`).toBe(true);
        }
      }
    }
  });

  it('ignora movimientos con cantidad o fecha inválida', () => {
    const productos: ProductoStock[] = [
      { codigo: 'B1', nombre: 'Bordes', stock_actual: 20, stock_en_transito: 0, costo_promedio: 10, precio_venta: 20 },
    ];
    const movs: MovimientoSalida[] = [
      { producto_codigo: 'B1', cantidad: NaN as unknown as number, fecha: new Date().toISOString() },
      { producto_codigo: 'B1', cantidad: 5, fecha: 'fecha-invalida' },
      ...generarVentasDiarias('B1', 2, 60),
    ];
    const sugs = optimizarReabastecimiento(productos, movs);
    expect(sugs).toHaveLength(1);
    expect(Number.isFinite(sugs[0].demanda_diaria_promedio)).toBe(true);
  });
});
