'use client';

import { useCallback, useEffect, useState } from 'react';
import { invalidarDatosInsumos, obtenerDatosInsumos, type DatosInsumos } from '@/lib/reportes/insumos-usd-data';
import { useInventoryStore } from '@/store';

/**
 * Datos de insumos (historial completo) para el Análisis y el Reporte en
 * USD. Comparten caché: cambiar de pestaña no vuelve a cargar todo. Se
 * recargan solos cuando cambia el stock en otra parte de la app.
 */
export function useDatosInsumos() {
  const [datos, setDatos] = useState<DatosInsumos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [paso, setPaso] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Cambia con cada movimiento nuevo del store (entradas/salidas desde Stock,
  // órdenes internas, etc.): así nunca se muestran datos viejos.
  const versionMovimientos = useInventoryStore(s => s.movements.length);

  const cargar = useCallback(async (forzar = false) => {
    setCargando(true);
    setError(null);
    try {
      const d = await obtenerDatosInsumos({ forzar, version: versionMovimientos, onProgreso: p => setPaso(p.paso) });
      setDatos(d);
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar los datos de insumos');
    } finally {
      setCargando(false);
      setPaso('');
    }
  }, [versionMovimientos]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const alCambiar = () => { invalidarDatosInsumos(); cargar(true); };
    window.addEventListener('vg:stock-changed', alCambiar);
    return () => window.removeEventListener('vg:stock-changed', alCambiar);
  }, [cargar]);

  return { datos, cargando, paso, error, recargar: () => cargar(true) };
}
