'use client';

import { useEffect, useMemo, useState } from 'react';
import { convertir } from '@/lib/currency';
import { valuarInventario, type ResultadoValuacion } from '@/lib/inventory-valuation';
import { useModulosHabilitados } from '@/hooks/useModulosHabilitados';
import { useTiposCambio } from '@/hooks/useTiposCambio';
import type { Moneda, Product } from '@/types';

// =====================================================
// Resumen de inventario (cantidad, valor y críticos)
// =====================================================
// Misma fuente de verdad que la valuación del resto de la app (FIFO sobre
// lotes + costo promedio para unidades sin lote, cada costo convertido desde
// su moneda). Lo usan las tarjetas de Stock y la barra de la tabla.
// =====================================================

export interface ResumenInventario {
  count: number;
  /** Valor en la moneda de visualización (null si falta tasa). */
  valor: number | null;
  /** Valor en la moneda base, antes de convertir. */
  valorOrigen: number;
  monedaOrigen: Moneda;
  monedaDestino: Moneda;
  sinTasa: boolean;
  criticos: number;
  cargando: boolean;
}

const MONEDA_BASE: Moneda = 'UYU';

export function useResumenInventario(products: Product[], enabled = true): ResumenInventario {
  const { config: orgConfig } = useModulosHabilitados();
  const { rates } = useTiposCambio();
  const monedaDestino: Moneda = (orgConfig.display_currency as Moneda) ?? MONEDA_BASE;
  const [valuacion, setValuacion] = useState<ResultadoValuacion | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setCargando(true);
    valuarInventario({
      productos: products.map(p => ({
        codigo: p.codigo,
        descripcion: p.descripcion,
        stock: p.stock,
        stockMinimo: p.stockMinimo,
        costoPromedio: p.costoPromedio || 0,
        categoria: p.categoria,
        moneda: p.moneda,
        almacenId: p.almacenId,
        almacen: p.almacen,
      })),
      rates,
      monedaBase: MONEDA_BASE,
    })
      .then(r => { if (!cancelled) setValuacion(r); })
      .finally(() => { if (!cancelled) setCargando(false); });
    return () => { cancelled = true; };
  }, [products, rates, enabled]);

  return useMemo(() => {
    const valorOrigen = valuacion?.total ?? 0;
    const valor = monedaDestino === MONEDA_BASE
      ? valorOrigen
      : convertir(valorOrigen, MONEDA_BASE, monedaDestino, rates);
    return {
      count: products.length,
      valor,
      valorOrigen,
      monedaOrigen: MONEDA_BASE,
      monedaDestino,
      sinTasa: valor === null,
      criticos: products.filter(p => p.stock <= p.stockMinimo).length,
      cargando: cargando && !valuacion,
    };
  }, [products, valuacion, monedaDestino, rates, cargando]);
}
