// =====================================================
// Marca Vanguard — geometría única del símbolo
// =====================================================
// Una "V" y, a su izquierda, una barra recta SEPARADA de la pata, paralela
// a ella y del mismo largo y ancho. Todo en un viewBox de 64×64, centrado.
// La usan el componente <Logo />, la pantalla de carga, los PDF y los
// íconos, para que el símbolo sea idéntico en todos lados.
// =====================================================

export const VANGUARD_VIEWBOX = 64;

/** La V: dos patas del mismo ancho que convergen en un vértice. */
export const VANGUARD_V_PATH =
  'M16.91 8.5 L27.41 8.5 L39 33.16 L50.59 8.5 L61.09 8.5 L39 55.5 Z';

/** Barra recta paralela a la pata izquierda, separada 3,5 u y del mismo tamaño. */
export const VANGUARD_BAR_PATH =
  'M2.91 8.5 L13.41 8.5 L35.5 55.5 L25 55.5 Z';

/** Puntos de los polígonos (para dibujar en jsPDF u otros lienzos). */
export const VANGUARD_V_POINTS: Array<[number, number]> = [
  [16.91, 8.5], [27.41, 8.5], [39, 33.16], [50.59, 8.5], [61.09, 8.5], [39, 55.5],
];
export const VANGUARD_BAR_POINTS: Array<[number, number]> = [
  [2.91, 8.5], [13.41, 8.5], [35.5, 55.5], [25, 55.5],
];

/** Colores de marca (gradiente vertical de la V y de la barra). */
export const VANGUARD_COLORS = {
  vTop: '#4f8ff7',
  vBottom: '#1e4fa8',
  barTop: '#8bbcff',
  barBottom: '#3a74db',
  /** Color plano de respaldo (impresión, un solo color). */
  solid: '#2b62b0',
} as const;
