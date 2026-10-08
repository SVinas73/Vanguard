// =====================================================
// Logo Vanguard en jsPDF (vectorial)
// =====================================================
// Misma geometría que <Logo /> (lib/brand.ts). jsPDF no tiene gradientes
// simples, así que va en dos tonos planos: la V en azul de marca y la
// barra en un azul más claro. Sirve en servidor y en cliente.
// =====================================================

import type { jsPDF } from 'jspdf';
import { VANGUARD_BAR_POINTS, VANGUARD_V_POINTS } from '@/lib/brand';

function poligono(doc: jsPDF, puntos: Array<[number, number]>, x: number, y: number, s: number) {
  const [x0, y0] = puntos[0];
  const deltas: Array<[number, number]> = [];
  for (let i = 1; i < puntos.length; i++) {
    deltas.push([puntos[i][0] - puntos[i - 1][0], puntos[i][1] - puntos[i - 1][1]]);
  }
  doc.lines(deltas, x + x0 * s, y + y0 * s, [s, s], 'F', true);
}

/** Dibuja el símbolo en un cuadro de `size` (unidades del documento). */
export function dibujarLogoVanguard(doc: jsPDF, x: number, y: number, size = 14) {
  const s = size / 64;
  doc.setFillColor(111, 165, 245); // barra — #6fa5f5
  poligono(doc, VANGUARD_BAR_POINTS, x, y, s);
  doc.setFillColor(47, 111, 220);  // V — #2f6fdc
  poligono(doc, VANGUARD_V_POINTS, x, y, s);
  doc.setFillColor(0, 0, 0);
}
