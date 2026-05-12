import { describe, it, expect } from 'vitest';
import { valuarInventarioSync } from '@/lib/inventory-valuation';

// =====================================================
// Tests de la lib unificada de valuación
// =====================================================
// La regla: FIFO (lotes) es la fuente de verdad. Costo
// promedio es fallback para productos sin lotes activos.
// Dashboard y Centro de Costos DEBEN dar exactamente
// el mismo número porque usan la misma función.
// =====================================================

describe('inventory-valuation — valuarInventarioSync', () => {
  it('producto con lotes activos valúa por FIFO', () => {
    const r = valuarInventarioSync(
      [{ codigo: 'A1', descripcion: 'A', stock: 10, costoPromedio: 5 }],
      [
        { codigo: 'A1', cantidad_disponible: 6, costo_unitario: 100 }, // 600
        { codigo: 'A1', cantidad_disponible: 4, costo_unitario: 120 }, // 480
      ],
    );
    expect(r.total).toBe(1080);                           // 600 + 480
    expect(r.porProducto[0].fuente).toBe('fifo');
    expect(r.porProducto[0].valorFifo).toBe(1080);
    // costo_promedio de productos (5) NO se usa cuando hay FIFO
    expect(r.porProducto[0].valor).toBe(1080);
  });

  it('producto sin lotes valúa por costo promedio', () => {
    const r = valuarInventarioSync(
      [{ codigo: 'B1', descripcion: 'B', stock: 8, costoPromedio: 50 }],
      [],
    );
    expect(r.total).toBe(400);
    expect(r.porProducto[0].fuente).toBe('promedio');
  });

  it('producto sin lotes y sin costo promedio queda en cero', () => {
    const r = valuarInventarioSync(
      [{ codigo: 'C1', descripcion: 'C', stock: 5, costoPromedio: 0 }],
      [],
    );
    expect(r.total).toBe(0);
    expect(r.porProducto[0].fuente).toBe('sin_valuar');
    expect(r.calidad.sinValuar).toBe(1);
  });

  it('mezcla FIFO + promedio + sin valuar', () => {
    const r = valuarInventarioSync(
      [
        { codigo: 'A1', descripcion: 'A', stock: 10, costoPromedio: 5 },   // FIFO
        { codigo: 'B1', descripcion: 'B', stock: 8,  costoPromedio: 50 },  // Promedio
        { codigo: 'C1', descripcion: 'C', stock: 5,  costoPromedio: 0 },   // Sin valuar
      ],
      [{ codigo: 'A1', cantidad_disponible: 10, costo_unitario: 100 }],
    );
    expect(r.total).toBe(1000 + 400);  // 1400
    expect(r.calidad.conFifo).toBe(1);
    expect(r.calidad.conPromedio).toBe(1);
    expect(r.calidad.sinValuar).toBe(1);
  });

  it('desincronización: stock de productos != suma de lotes', () => {
    const r = valuarInventarioSync(
      [{ codigo: 'X1', descripcion: 'X', stock: 100, costoPromedio: 10 }],
      [{ codigo: 'X1', cantidad_disponible: 30, costo_unitario: 100 }],
    );
    // FIFO gana, pero queda flag de desincronizado
    expect(r.total).toBe(3000);
    expect(r.porProducto[0].desincronizado).toBe(true);
    expect(r.calidad.desincronizados).toBe(1);
  });

  it('desglose por almacén suma correctamente', () => {
    const r = valuarInventarioSync(
      [
        { codigo: 'A', descripcion: 'A', stock: 5, costoPromedio: 0, almacenId: 'w1',
          almacen: { id: 'w1', codigo: 'P1', nombre: 'Principal' } },
        { codigo: 'B', descripcion: 'B', stock: 3, costoPromedio: 0, almacenId: 'w2',
          almacen: { id: 'w2', codigo: 'S1', nombre: 'Sucursal' } },
      ],
      [
        { codigo: 'A', cantidad_disponible: 5, costo_unitario: 200 },  // w1 → 1000
        { codigo: 'B', cantidad_disponible: 3, costo_unitario: 100 },  // w2 → 300
      ],
    );
    expect(r.total).toBe(1300);
    expect(r.porAlmacen).toHaveLength(2);
    const w1 = r.porAlmacen.find(a => a.id === 'w1')!;
    const w2 = r.porAlmacen.find(a => a.id === 'w2')!;
    expect(w1.valor).toBe(1000);
    expect(w2.valor).toBe(300);
  });

  it('productos sin almacén se agrupan aparte', () => {
    const r = valuarInventarioSync(
      [{ codigo: 'X', descripcion: 'X', stock: 10, costoPromedio: 50 }],
      [],
    );
    expect(r.porAlmacen).toHaveLength(1);
    expect(r.porAlmacen[0].id).toBe('__sin_almacen__');
    expect(r.porAlmacen[0].nombre).toBe('Sin almacén asignado');
  });

  it('inventario vacío devuelve total 0 limpio', () => {
    const r = valuarInventarioSync([], []);
    expect(r.total).toBe(0);
    expect(r.totalUnidades).toBe(0);
    expect(r.porProducto).toEqual([]);
    expect(r.porAlmacen).toEqual([]);
  });

  it('Dashboard y Costos comparten función → mismo número', () => {
    const productos = [
      { codigo: 'P1', descripcion: 'P1', stock: 10, costoPromedio: 50 },
      { codigo: 'P2', descripcion: 'P2', stock: 5,  costoPromedio: 100 },
    ];
    const lotes = [
      { codigo: 'P1', cantidad_disponible: 10, costo_unitario: 80 },
    ];
    const r1 = valuarInventarioSync(productos, lotes);
    const r2 = valuarInventarioSync(productos, lotes);
    expect(r1.total).toBe(r2.total);
    expect(r1.total).toBe(800 + 500);  // P1 FIFO + P2 promedio
  });
});
