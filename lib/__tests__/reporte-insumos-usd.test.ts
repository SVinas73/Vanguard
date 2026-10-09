import { describe, it, expect } from 'vitest';
import { generarReporteInsumosUSD, aUsd, fmtUsd, type ReporteInput } from '@/lib/reportes/insumos-usd';

// =====================================================
// Reporte de insumos en USD (TC de referencia 40)
// =====================================================

const d = (s: string) => new Date(`${s}T12:00:00`);

function base(over: Partial<ReporteInput> = {}): ReporteInput {
  return {
    desde: d('2026-01-01'),
    hasta: d('2026-03-31'),
    productos: [
      { codigo: 'P1', descripcion: 'Papel A4', categoria: 'papeleria', moneda: 'UYU', costoPromedio: 400, stock: 0 },
      { codigo: 'T1', descripcion: 'Tóner', categoria: 'oficina', moneda: 'USD', costoPromedio: 50, stock: 0 },
    ],
    movimientos: [],
    solicitudes: [],
    ...over,
  };
}

describe('reporte insumos USD — conversión', () => {
  it('USD queda igual y UYU se divide por 40', () => {
    expect(aUsd(10, 'USD')).toBe(10);
    expect(aUsd(400, 'UYU')).toBe(10);
    expect(aUsd(400, null)).toBe(10);
  });

  it('formatea en dólares', () => {
    expect(fmtUsd(1234.5)).toBe('US$ 1.234,50');
    expect(fmtUsd(-3)).toBe('-US$ 3,00');
  });
});

describe('reporte insumos USD — compras y consumos', () => {
  it('cada compra se toma a su precio real y moneda, convertida a USD', () => {
    const r = generarReporteInsumosUSD(base({
      movimientos: [
        { codigo: 'P1', tipo: 'entrada', cantidad: 10, costoCompra: 400, monedaCosto: 'UYU', fecha: d('2026-01-10') }, // 10 × 10 USD
        { codigo: 'P1', tipo: 'entrada', cantidad: 10, costoCompra: 12, monedaCosto: 'USD', fecha: d('2026-02-10') },  // 10 × 12 USD
      ],
    }));
    expect(r.kpis.comprasUsd).toBe(220);
    expect(r.compras.map(c => c.costoUnitUsd)).toEqual([10, 12]);
    expect(r.compras[0].monedaOriginal).toBe('UYU');
    expect(r.compras[1].monedaOriginal).toBe('USD');
  });

  it('el consumo usa el costo promedio móvil a la fecha de la salida (incluye historial anterior)', () => {
    const r = generarReporteInsumosUSD(base({
      movimientos: [
        // antes del período: 10 u a 10 USD
        { codigo: 'P1', tipo: 'entrada', cantidad: 10, costoCompra: 400, monedaCosto: 'UYU', fecha: d('2025-11-01') },
        // dentro: salida 5 → a 10 USD
        { codigo: 'P1', tipo: 'salida', cantidad: 5, notas: 'Orden interna · oficina', fecha: d('2026-01-05') },
        // compra más cara: 5 u a 20 USD → promedio (5×10 + 5×20)/10 = 15
        { codigo: 'P1', tipo: 'entrada', cantidad: 5, costoCompra: 20, monedaCosto: 'USD', fecha: d('2026-01-20') },
        { codigo: 'P1', tipo: 'salida', cantidad: 2, fecha: d('2026-02-01') },
      ],
    }));
    expect(r.consumos.map(c => c.costoUnitUsd)).toEqual([10, 15]);
    expect(r.kpis.consumoUsd).toBe(5 * 10 + 2 * 15);
    expect(r.kpis.ordenesInternas).toBe(1);
    // la compra anterior al período no cuenta como compra del período
    expect(r.kpis.comprasUsd).toBe(100);
  });

  it('salida sin compras previas con costo usa el promedio actual y avisa', () => {
    const r = generarReporteInsumosUSD(base({
      movimientos: [{ codigo: 'T1', tipo: 'salida', cantidad: 2, fecha: d('2026-01-15') }],
    }));
    expect(r.consumos[0].costoUnitUsd).toBe(50);
    expect(r.consumos[0].costoEstimado).toBe(true);
    expect(r.advertencias.length).toBeGreaterThan(0);
  });

  it('una compra sin costo cargado cuenta como compra al promedio vigente (estimada) y no lo diluye', () => {
    const r = generarReporteInsumosUSD(base({
      movimientos: [
        { codigo: 'P1', tipo: 'entrada', cantidad: 10, costoCompra: 12, monedaCosto: 'USD', fecha: d('2026-01-02') },
        { codigo: 'P1', tipo: 'entrada', cantidad: 10, fecha: d('2026-01-03') },
        { codigo: 'P1', tipo: 'salida', cantidad: 4, fecha: d('2026-01-04') },
      ],
    }));
    expect(r.kpis.cantidadCompras).toBe(2);
    expect(r.kpis.comprasSinCosto).toBe(1);
    expect(r.compras[1].costoEstimado).toBe(true);
    expect(r.compras[1].costoUnitUsd).toBe(12);
    expect(r.kpis.comprasUsd).toBe(240);
    expect(r.consumos[0].costoUnitUsd).toBe(12);
    // solo las compras con costo real entran en la variación de precios
    expect(r.variacionPrecios).toHaveLength(0);
  });

  it('el stock inicial y las devoluciones no son compras', () => {
    const r = generarReporteInsumosUSD(base({
      movimientos: [
        { codigo: 'P1', tipo: 'entrada', cantidad: 50, costoCompra: 10, monedaCosto: 'USD', notas: 'Stock inicial al crear producto', fecha: d('2026-01-02') },
        { codigo: 'P1', tipo: 'entrada', cantidad: 5, notas: 'Importación CSV', fecha: d('2026-01-02') },
        { codigo: 'P1', tipo: 'entrada', cantidad: 2, notas: 'Reingreso RMA R-1', fecha: d('2026-01-05') },
        { codigo: 'P1', tipo: 'salida', cantidad: 3, fecha: d('2026-01-06') },
      ],
    }));
    expect(r.kpis.cantidadCompras).toBe(0);
    expect(r.kpis.stockInicialUnidades).toBe(55);
    expect(r.kpis.devolucionesUnidades).toBe(2);
    // el stock inicial con costo sí fija el costo para valorizar consumos
    expect(r.consumos[0].costoUnitUsd).toBe(10);
  });

  it('un ajuste con "stock A → B" actualiza el stock del recorrido', () => {
    const r = generarReporteInsumosUSD(base({
      movimientos: [
        { codigo: 'P1', tipo: 'entrada', cantidad: 10, costoCompra: 10, monedaCosto: 'USD', fecha: d('2026-01-02') },
        // el stock real pasa a 0: la próxima compra define el promedio sola
        { codigo: 'P1', tipo: 'ajuste', cantidad: 10, notas: 'Importación CSV: stock 10 → 0', fecha: d('2026-01-03') },
        { codigo: 'P1', tipo: 'entrada', cantidad: 10, costoCompra: 20, monedaCosto: 'USD', fecha: d('2026-01-04') },
        { codigo: 'P1', tipo: 'salida', cantidad: 1, fecha: d('2026-01-05') },
      ],
    }));
    expect(r.consumos[0].costoUnitUsd).toBe(20);
  });

  it('ajustes y transferencias no son compras ni consumos', () => {
    const r = generarReporteInsumosUSD(base({
      movimientos: [
        { codigo: 'P1', tipo: 'ajuste', cantidad: 3, fecha: d('2026-01-04') },
        { codigo: 'P1', tipo: 'transferencia', cantidad: 3, fecha: d('2026-01-05') },
      ],
    }));
    expect(r.kpis.comprasUsd).toBe(0);
    expect(r.kpis.consumoUsd).toBe(0);
    expect(r.kpis.ajustes).toBe(1);
  });

  it('ignora movimientos de productos que no son insumos y los posteriores al período', () => {
    const r = generarReporteInsumosUSD(base({
      movimientos: [
        { codigo: 'X9', tipo: 'entrada', cantidad: 1, costoCompra: 999, monedaCosto: 'USD', fecha: d('2026-01-04') },
        { codigo: 'P1', tipo: 'entrada', cantidad: 1, costoCompra: 10, monedaCosto: 'USD', fecha: d('2026-05-01') },
      ],
    }));
    expect(r.kpis.comprasUsd).toBe(0);
  });
});

describe('reporte insumos USD — variación de precios y agregados', () => {
  it('compara contra la última compra anterior al período', () => {
    const r = generarReporteInsumosUSD(base({
      movimientos: [
        { codigo: 'P1', tipo: 'entrada', cantidad: 1, costoCompra: 400, monedaCosto: 'UYU', fecha: d('2025-12-01') }, // 10
        { codigo: 'P1', tipo: 'entrada', cantidad: 1, costoCompra: 11, monedaCosto: 'USD', fecha: d('2026-01-10') },
        { codigo: 'P1', tipo: 'entrada', cantidad: 1, costoCompra: 12.5, monedaCosto: 'USD', fecha: d('2026-03-10') },
      ],
    }));
    const v = r.variacionPrecios[0];
    expect(v.precioInicialUsd).toBe(10);
    expect(v.precioFinalUsd).toBe(12.5);
    expect(v.variacionPct).toBe(25);
    expect(v.minUsd).toBe(10);
    expect(v.maxUsd).toBe(12.5);
    expect(r.kpis.insumosConAumento).toBe(1);
  });

  it('agrupa por mes, categoría y solicitud', () => {
    const r = generarReporteInsumosUSD(base({
      categoriaLabels: { papeleria: 'Papelería' },
      movimientos: [
        { codigo: 'P1', tipo: 'entrada', cantidad: 2, costoCompra: 10, monedaCosto: 'USD', fecha: d('2026-01-10') },
        { codigo: 'T1', tipo: 'entrada', cantidad: 1, costoCompra: 30, monedaCosto: 'USD', fecha: d('2026-03-10') },
      ],
      solicitudes: [
        { numero: 'S-1', categoria: 'papeleria', estado: 'recibida', solicitadoPor: 'a@x', fecha: d('2026-01-02'),
          items: [{ descripcion: 'Papel', cantidad: 4, costoEstimado: 400, moneda: 'UYU' }] },
        { numero: 'S-2', categoria: 'papeleria', estado: 'cancelada', solicitadoPor: 'a@x', fecha: d('2026-01-03'),
          items: [{ descripcion: 'Papel', cantidad: 4, costoEstimado: 10, moneda: 'USD' }] },
        { numero: 'S-0', categoria: 'papeleria', estado: 'pendiente', solicitadoPor: 'a@x', fecha: d('2025-06-01'), items: [] },
      ],
    }));
    expect(r.mensual.map(m => m.clave)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(r.mensual[0].comprasUsd).toBe(20);
    expect(r.porCategoria.find(c => c.categoria === 'Papelería')?.comprasUsd).toBe(20);
    expect(r.kpis.solicitudes).toBe(2);
    expect(r.kpis.solicitudesRecibidas).toBe(1);
    // la cancelada no suma al estimado
    expect(r.kpis.estimadoSolicitudesUsd).toBe(40);
  });
});

describe('reporte insumos USD — todo el historial', () => {
  it('con recortarInicio el período arranca en el primer registro', () => {
    const r = generarReporteInsumosUSD(base({
      desde: new Date(2000, 0, 1),
      recortarInicio: true,
      movimientos: [
        { codigo: 'P1', tipo: 'entrada', cantidad: 1, costoCompra: 10, monedaCosto: 'USD', fecha: d('2024-06-15') },
        { codigo: 'X9', tipo: 'entrada', cantidad: 1, costoCompra: 10, monedaCosto: 'USD', fecha: d('2019-01-01') },
      ],
    }));
    expect(r.desde.getFullYear()).toBe(2024);
    expect(r.desde.getMonth()).toBe(5);
    expect(r.kpis.comprasUsd).toBe(10);
  });
});

describe('reporte insumos USD — categorías, serie y stock', () => {
  const conCategorias = (over: Partial<ReporteInput> = {}) => base({
    productos: [
      { codigo: 'P1', descripcion: 'Papel', categoria: 'Papelería', moneda: 'UYU', costoPromedio: 400, stock: 3, stockMinimo: 5 },
      { codigo: 'E1', descripcion: 'Aceite', categoria: 'Estación de Servicio', moneda: 'USD', costoPromedio: 60, stock: 0, stockMinimo: 2 },
      { codigo: 'B1', descripcion: 'Baja', categoria: 'Papelería', moneda: 'UYU', costoPromedio: 40, stock: 9, activo: false },
    ],
    movimientos: [
      { codigo: 'P1', tipo: 'entrada', cantidad: 10, costoCompra: 10, monedaCosto: 'USD', fecha: d('2026-01-05') },
      { codigo: 'P1', tipo: 'salida', cantidad: 9, fecha: d('2026-01-20') },
      { codigo: 'E1', tipo: 'entrada', cantidad: 2, costoCompra: 2400, monedaCosto: 'UYU', fecha: d('2026-02-05') },
      { codigo: 'B1', tipo: 'entrada', cantidad: 1, costoCompra: 1, monedaCosto: 'USD', fecha: d('2026-02-06') },
    ],
    solicitudes: [
      { numero: 'S1', categoria: 'estacion_servicio', estado: 'pendiente', solicitadoPor: 'x', fecha: d('2026-01-10'), items: [] },
      { numero: 'S2', categoria: 'Papelería', estado: 'pendiente', solicitadoPor: 'x', fecha: d('2026-01-11'), items: [] },
    ],
    categoriaLabels: { estacion_servicio: 'Estación de servicio' },
    ...over,
  });

  it('la misma categoría escrita distinto se reconoce como una sola', () => {
    const r = generarReporteInsumosUSD(conCategorias());
    const claves = r.categoriasDisponibles.map(c => c.clave);
    expect(new Set(claves).size).toBe(claves.length);
    expect(r.categoriasDisponibles.find(c => c.etiqueta === 'Estación de servicio')?.insumos).toBe(1);
  });

  it('filtra compras, consumos y solicitudes por categoría', () => {
    const todas = generarReporteInsumosUSD(conCategorias());
    const clave = todas.categoriasDisponibles.find(c => c.etiqueta === 'Estación de servicio')!.clave;
    const r = generarReporteInsumosUSD(conCategorias({ categorias: [clave] }));
    expect(r.kpis.comprasUsd).toBe(120); // 2 u × 2400 UYU ÷ 40
    expect(r.kpis.consumoUsd).toBe(0);
    expect(r.kpis.solicitudes).toBe(1);
    expect(r.categoriasFiltradas).toEqual(['Estación de servicio']);
  });

  it('los insumos dados de baja cuentan en el historial pero no en el stock', () => {
    const r = generarReporteInsumosUSD(conCategorias());
    expect(r.kpis.comprasUsd).toBe(100 + 120 + 1);
    expect(r.kpis.insumosActivos).toBe(2);
    expect(r.stock.map(s => s.codigo).sort()).toEqual(['E1', 'P1']);
    expect(r.kpis.insumosBajoMinimo).toBe(1);
    expect(r.kpis.insumosAgotados).toBe(1);
  });

  it('el estado de stock trae último precio en USD y cobertura', () => {
    const r = generarReporteInsumosUSD(conCategorias({ inventarioPorCodigoUsd: { P1: 30, E1: 0 } }));
    const p1 = r.stock.find(s => s.codigo === 'P1')!;
    expect(p1.ultimoPrecioUsd).toBe(10);
    expect(p1.valorUsd).toBe(30);
    expect(p1.diasCobertura).not.toBeNull();
    expect(r.kpis.inventarioActualUsd).toBe(30);
  });

  it('elige la granularidad de la serie según el período', () => {
    const corto = generarReporteInsumosUSD(conCategorias({ desde: d('2026-01-01'), hasta: d('2026-01-31') }));
    expect(corto.granularidad).toBe('dia');
    expect(corto.serie.length).toBe(31);
    const medio = generarReporteInsumosUSD(conCategorias());
    expect(medio.granularidad).toBe('semana');
    const largo = generarReporteInsumosUSD(conCategorias({ desde: d('2025-01-01'), hasta: d('2026-03-31') }));
    expect(largo.granularidad).toBe('mes');
    expect(largo.serie.reduce((s, f) => s + f.comprasUsd, 0)).toBeCloseTo(221, 2);
  });
});
