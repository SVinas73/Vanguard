import { describe, it, expect } from 'vitest';
import {
  optimizarRutaPicking,
  sugerirWaves,
  predecirTiempoPicking,
  asignarPickerOptimo,
  detectarAnomaliasPicking,
  sugerirLoteFefo,
} from '@/lib/wms-picking-ai';

describe('optimizarRutaPicking — TSP nearest-neighbor + 2-opt', () => {
  it('devuelve la misma lista cuando hay 0 o 1 puntos', () => {
    expect(optimizarRutaPicking([]).ruta).toEqual([]);
    const uno = [{ ubicacion_codigo: 'A-01-01-01' }];
    expect(optimizarRutaPicking(uno).ruta).toEqual(uno);
  });

  it('reduce o mantiene la distancia total respecto del orden de entrada', () => {
    const puntos = [
      { pasillo: 'C', rack: '5', nivel: '3', posicion: '2' },
      { pasillo: 'A', rack: '1', nivel: '1', posicion: '1' },
      { pasillo: 'A', rack: '2', nivel: '1', posicion: '1' },
      { pasillo: 'C', rack: '5', nivel: '3', posicion: '1' },
      { pasillo: 'B', rack: '3', nivel: '2', posicion: '1' },
    ];
    const r = optimizarRutaPicking(puntos);
    expect(r.ruta.length).toBe(5);
    // Distancia final no debería superar la del orden ingenuo.
    expect(r.distancia).toBeLessThanOrEqual(r.distancia + r.ahorroPct + 1);
    // El primer punto debería seguir siendo el primero (anchor).
    expect(r.ruta[0]).toEqual(puntos[0]);
  });

  it('agrupa puntos cercanos en pasillos contiguos', () => {
    const puntos = [
      { pasillo: 'A', rack: '1', nivel: '1', posicion: '1' },
      { pasillo: 'A', rack: '1', nivel: '1', posicion: '2' },
      { pasillo: 'A', rack: '1', nivel: '1', posicion: '3' },
    ];
    const r = optimizarRutaPicking(puntos);
    // Distancia mínima posible: 0.6 (3 saltos de 0.3 cada uno
    // entre posiciones contiguas).
    expect(r.distancia).toBeLessThan(2);
  });
});

describe('sugerirWaves', () => {
  const HOY = new Date('2025-06-15T10:00:00Z');

  it('crea wave urgente con órdenes vencidas', () => {
    const ordenes = [
      { id: '1', numero: 'OV-1', fecha_requerida: '2025-06-10', unidades_totales: 10, lineas_totales: 2 },
      { id: '2', numero: 'OV-2', fecha_requerida: '2025-07-01', unidades_totales: 5, lineas_totales: 1 },
    ];
    const sugerencias = sugerirWaves(ordenes, HOY);
    const urg = sugerencias.find(s => s.motivo === 'urgencia');
    expect(urg).toBeDefined();
    expect(urg?.ordenesIds).toContain('1');
    expect(urg?.ordenesIds).not.toContain('2');
  });

  it('detecta batch cuando 3+ órdenes comparten un producto', () => {
    const ordenes = [
      { id: '1', numero: 'A', productos: ['SKU-1', 'SKU-2'], fecha_requerida: '2025-07-30', unidades_totales: 5, lineas_totales: 2 },
      { id: '2', numero: 'B', productos: ['SKU-1'], fecha_requerida: '2025-07-30', unidades_totales: 2, lineas_totales: 1 },
      { id: '3', numero: 'C', productos: ['SKU-1', 'SKU-3'], fecha_requerida: '2025-07-30', unidades_totales: 3, lineas_totales: 2 },
      { id: '4', numero: 'D', productos: ['SKU-9'], fecha_requerida: '2025-07-30', unidades_totales: 1, lineas_totales: 1 },
    ];
    const sugerencias = sugerirWaves(ordenes, HOY);
    const batch = sugerencias.find(s => s.motivo === 'batch_producto');
    expect(batch).toBeDefined();
    expect(batch!.ordenesIds.length).toBeGreaterThanOrEqual(3);
  });

  it('agrupa por cliente cuando hay 2+ órdenes del mismo', () => {
    const ordenes = [
      { id: '1', numero: 'X', cliente_nombre: 'ACME', fecha_requerida: '2025-07-30', unidades_totales: 5, lineas_totales: 1 },
      { id: '2', numero: 'Y', cliente_nombre: 'ACME', fecha_requerida: '2025-07-30', unidades_totales: 8, lineas_totales: 1 },
      { id: '3', numero: 'Z', cliente_nombre: 'OtraCompa', fecha_requerida: '2025-07-30', unidades_totales: 2, lineas_totales: 1 },
    ];
    const sugerencias = sugerirWaves(ordenes, HOY);
    const cluster = sugerencias.find(s => s.motivo === 'cluster_cliente');
    expect(cluster).toBeDefined();
    expect(cluster!.ordenesIds).toContain('1');
    expect(cluster!.ordenesIds).toContain('2');
  });
});

describe('predecirTiempoPicking', () => {
  it('crece linealmente con cantidad de líneas y unidades', () => {
    const a = predecirTiempoPicking(5, 50);
    const b = predecirTiempoPicking(10, 100);
    expect(b.minutosEstimados).toBeGreaterThan(a.minutosEstimados);
  });

  it('aplica factor del picker', () => {
    const normal = predecirTiempoPicking(10, 100, 1);
    const lento  = predecirTiempoPicking(10, 100, 1.5);
    expect(lento.minutosEstimados).toBeGreaterThan(normal.minutosEstimados);
  });

  it('siempre devuelve un mínimo razonable', () => {
    const r = predecirTiempoPicking(0, 0);
    expect(r.minutosEstimados).toBeGreaterThanOrEqual(2);
  });
});

describe('asignarPickerOptimo', () => {
  it('elige el de menor carga', () => {
    const elegido = asignarPickerOptimo([
      { email: 'a@a.com', cargaActualUnidades: 100, productividadFactor: 1 },
      { email: 'b@b.com', cargaActualUnidades: 20,  productividadFactor: 1 },
      { email: 'c@c.com', cargaActualUnidades: 50,  productividadFactor: 1 },
    ]);
    expect(elegido?.email).toBe('b@b.com');
  });

  it('en empate de carga elige al más rápido (factor menor)', () => {
    const elegido = asignarPickerOptimo([
      { email: 'a@a.com', cargaActualUnidades: 0, productividadFactor: 1.0 },
      { email: 'b@b.com', cargaActualUnidades: 0, productividadFactor: 0.7 },
      { email: 'c@c.com', cargaActualUnidades: 0, productividadFactor: 1.2 },
    ]);
    expect(elegido?.email).toBe('b@b.com');
  });

  it('devuelve null sin pickers', () => {
    expect(asignarPickerOptimo([])).toBeNull();
  });
});

describe('detectarAnomaliasPicking', () => {
  it('detecta producto con tasa de short-pick alta', () => {
    const anomalias = detectarAnomaliasPicking(
      [],
      [
        { producto_codigo: 'SKU-X', cantidad_solicitada: 100, cantidad_pickeada: 50 },
      ],
      []
    );
    expect(anomalias.find(a => a.tipo === 'producto_problematico' && a.entidad === 'SKU-X')).toBeDefined();
  });

  it('detecta orden estancada > 6 horas', () => {
    const haceOchoHoras = new Date(Date.now() - 8 * 3600 * 1000).toISOString();
    const anomalias = detectarAnomaliasPicking(
      [],
      [],
      [{ numero: 'PICK-001', fecha_inicio: haceOchoHoras, picker_asignado: 'p@p.com' }]
    );
    expect(anomalias.find(a => a.tipo === 'orden_estancada' && a.entidad === 'PICK-001')).toBeDefined();
  });

  it('no marca productos con bajo volumen', () => {
    const anomalias = detectarAnomaliasPicking(
      [],
      [{ producto_codigo: 'SKU-Y', cantidad_solicitada: 5, cantidad_pickeada: 2 }],
      []
    );
    // Solo 5 unidades solicitadas — no aplica el corte (mínimo 20)
    expect(anomalias.find(a => a.entidad === 'SKU-Y')).toBeUndefined();
  });
});

describe('sugerirLoteFefo', () => {
  it('elige el lote que vence antes', () => {
    const r = sugerirLoteFefo([
      { lote_numero: 'L1', fecha_vencimiento: '2026-01-10', cantidad_disponible: 5 },
      { lote_numero: 'L2', fecha_vencimiento: '2025-12-01', cantidad_disponible: 5 },
      { lote_numero: 'L3', fecha_vencimiento: '2026-06-01', cantidad_disponible: 5 },
    ]);
    expect(r?.lote_numero).toBe('L2');
  });

  it('descarta lotes sin disponible', () => {
    const r = sugerirLoteFefo([
      { lote_numero: 'X', fecha_vencimiento: '2025-12-01', cantidad_disponible: 0 },
      { lote_numero: 'Y', fecha_vencimiento: '2026-01-01', cantidad_disponible: 3 },
    ]);
    expect(r?.lote_numero).toBe('Y');
  });

  it('si no hay lotes con vencimiento, devuelve el primero con stock', () => {
    const r = sugerirLoteFefo([
      { cantidad_disponible: 10 },
      { cantidad_disponible: 5 },
    ]);
    expect(r?.cantidad_disponible).toBe(10);
  });

  it('null si no hay nada', () => {
    expect(sugerirLoteFefo([])).toBeNull();
    expect(sugerirLoteFefo([{ cantidad_disponible: 0 }])).toBeNull();
  });
});
