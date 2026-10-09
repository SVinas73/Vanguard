'use client';

import { useEffect, useState } from 'react';

// =====================================================
// Colores de gráficos según el tema (oscuro / claro)
// =====================================================
// Paleta categórica validada (CVD y contraste) contra las superficies de
// las tarjetas de la app: oscuro #181c25, claro #ffffff. El orden de los
// colores es parte de la validación: se asignan siempre en este orden.
// En claro, aqua/amarillo/rosa quedan bajo 3:1 → los gráficos llevan
// leyenda con valores y vista de tabla.
// =====================================================

export interface TemaGraficos {
  oscuro: boolean;
  superficie: string;
  serie: string[];        // categórica, en orden fijo
  otros: string;          // "Otras" / de-énfasis
  sube: string;           // diverging: precio que sube
  baja: string;           // diverging: precio que baja
  estado: { bien: string; atencion: string; critico: string; neutro: string };
  texto: string;
  textoSecundario: string;
  textoTenue: string;
  grilla: string;
  eje: string;
}

const OSCURO: TemaGraficos = {
  oscuro: true,
  superficie: '#181c25',
  serie: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300'],
  otros: '#5b6474',
  sube: '#e66767',
  baja: '#3987e5',
  estado: { bien: '#0ca30c', atencion: '#fab219', critico: '#d03b3b', neutro: '#5b6474' },
  texto: '#e8ecf1',
  textoSecundario: '#a3adbd',
  textoTenue: '#7d8798',
  grilla: '#262c38',
  eje: '#353d4d',
};

const CLARO: TemaGraficos = {
  oscuro: false,
  superficie: '#ffffff',
  serie: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'],
  otros: '#a3aab5',
  sube: '#e34948',
  baja: '#2a78d6',
  estado: { bien: '#0ca30c', atencion: '#fab219', critico: '#d03b3b', neutro: '#a3aab5' },
  texto: '#111827',
  textoSecundario: '#4b5563',
  textoTenue: '#6b7280',
  grilla: '#eceef2',
  eje: '#d6dae1',
};

function esClaro() {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('light-mode');
}

export function useTemaGraficos(): TemaGraficos {
  const [claro, setClaro] = useState(false);
  useEffect(() => {
    setClaro(esClaro());
    const obs = new MutationObserver(() => setClaro(esClaro()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return claro ? CLARO : OSCURO;
}
