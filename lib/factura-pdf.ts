// =====================================================
// Generador de PDF de factura (CFE) — profesional y completo
// =====================================================
// Arma un PDF lindo de la factura electrónica a partir del CFE y sus líneas.
// Usa jsPDF + autotable (ya en el proyecto). Cliente-side: el empaquetador
// aprieta "Ver/Descargar factura" y le sale el PDF.

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const AZUL: [number, number, number] = [43, 98, 176];
const GRIS: [number, number, number] = [100, 110, 125];

export interface FacturaLineaPDF {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  iva_tasa?: number;
  subtotal: number;
}

export interface FacturaPDFData {
  // Emisor
  emisorNombre: string;
  emisorRut?: string;
  // Comprobante
  tipoLabel: string;        // ej: "e-Factura"
  serie: string;
  numero: number | string;
  fecha?: string;
  estado?: string;
  cae?: string | null;
  // Receptor
  receptorNombre?: string | null;
  receptorDoc?: string | null;
  receptorDireccion?: string | null;
  // Referencia
  origenCodigo?: string | null; // ej: número de orden de venta
  moneda?: string;
  // Líneas y totales
  lineas: FacturaLineaPDF[];
  montoNeto: number;
  montoIva: number;
  montoTotal: number;
  notas?: string | null;
}

function escudo(doc: jsPDF, x: number, y: number, size = 14) {
  const s = size / 64;
  doc.setFillColor(...AZUL);
  doc.lines([[13, 5], [10, 18], [0, 19], [-23, -42]], x + 9 * s, y + 14 * s, [s, s], 'F', true);
  doc.lines([[-13, 5], [-10, 18], [0, 19], [23, -42]], x + 55 * s, y + 14 * s, [s, s], 'F', true);
  doc.setFillColor(0, 0, 0);
}

const money = (v: number, moneda = 'UYU') =>
  `${moneda === 'UYU' ? '$' : moneda + ' '}${(Number(v) || 0).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Genera el PDF y devuelve el documento jsPDF (para guardar/abrir). */
export function construirFacturaPDF(data: FacturaPDFData): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const moneda = data.moneda || 'UYU';

  // ── Encabezado ──
  escudo(doc, 14, 12, 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20, 28, 40);
  doc.text(data.emisorNombre || 'Vanguard', 34, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRIS);
  if (data.emisorRut) doc.text(`RUT: ${data.emisorRut}`, 34, 26);

  // Caja del comprobante (derecha)
  doc.setDrawColor(...AZUL);
  doc.setLineWidth(0.4);
  doc.roundedRect(W - 78, 12, 64, 26, 2, 2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...AZUL);
  doc.text(data.tipoLabel.toUpperCase(), W - 46, 20, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(20, 28, 40);
  doc.text(`Serie ${data.serie}  Nº ${data.numero}`, W - 46, 27, { align: 'center' });
  if (data.fecha) doc.text(`Fecha: ${new Date(data.fecha).toLocaleDateString('es-UY')}`, W - 46, 33, { align: 'center' });

  // ── Receptor ──
  let y = 48;
  doc.setDrawColor(225, 228, 233);
  doc.setLineWidth(0.2);
  doc.line(14, y, W - 14, y);
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GRIS);
  doc.text('CLIENTE', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(20, 28, 40);
  doc.text(data.receptorNombre || 'Consumo final', 14, y + 6);
  let yr = y + 11;
  if (data.receptorDoc) { doc.setFontSize(9); doc.setTextColor(...GRIS); doc.text(`Doc: ${data.receptorDoc}`, 14, yr); yr += 5; }
  if (data.receptorDireccion) { doc.setFontSize(9); doc.setTextColor(...GRIS); doc.text(data.receptorDireccion, 14, yr); yr += 5; }
  if (data.origenCodigo) {
    doc.setFontSize(9); doc.setTextColor(...GRIS);
    doc.text(`Referencia: ${data.origenCodigo}`, W - 14, y + 6, { align: 'right' });
  }

  // ── Tabla de líneas ──
  const startY = Math.max(yr, y + 14) + 2;
  autoTable(doc, {
    startY,
    head: [['Descripción', 'Cant.', 'P. Unit.', 'IVA', 'Subtotal']],
    body: data.lineas.map(l => [
      l.descripcion,
      String(l.cantidad),
      money(l.precio_unitario, moneda),
      `${l.iva_tasa ?? 22}%`,
      money(l.subtotal, moneda),
    ]),
    theme: 'striped',
    headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [30, 38, 50] },
    columnStyles: {
      1: { halign: 'center', cellWidth: 18 },
      2: { halign: 'right', cellWidth: 28 },
      3: { halign: 'center', cellWidth: 16 },
      4: { halign: 'right', cellWidth: 30 },
    },
    margin: { left: 14, right: 14 },
  });

  // ── Totales ──
  const afterTable = (doc as any).lastAutoTable?.finalY || startY + 20;
  let ty = afterTable + 8;
  const boxX = W - 84;
  doc.setFontSize(9);
  doc.setTextColor(...GRIS);
  doc.text('Neto', boxX, ty);
  doc.text('IVA', boxX, ty + 6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 28, 40);
  doc.text(money(data.montoNeto, moneda), W - 14, ty, { align: 'right' });
  doc.text(money(data.montoIva, moneda), W - 14, ty + 6, { align: 'right' });
  doc.setDrawColor(...AZUL);
  doc.setLineWidth(0.4);
  doc.line(boxX, ty + 9, W - 14, ty + 9);
  doc.setFontSize(12);
  doc.setTextColor(...AZUL);
  doc.text('TOTAL', boxX, ty + 16);
  doc.text(money(data.montoTotal, moneda), W - 14, ty + 16, { align: 'right' });

  // ── Pie: estado / CAE / notas ──
  let fy = ty + 28;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRIS);
  if (data.estado) doc.text(`Estado: ${data.estado}`, 14, fy);
  if (data.cae) doc.text(`CAE/Autorización: ${data.cae}`, 14, fy + 5);
  if (data.notas) {
    doc.text(doc.splitTextToSize(`Notas: ${data.notas}`, W - 28), 14, fy + 12);
  }
  doc.setFontSize(7.5);
  doc.setTextColor(150, 155, 165);
  doc.text('Comprobante Fiscal Electrónico · Generado por Vanguard', W / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

  return doc;
}

/** Abre el PDF en una pestaña nueva (para imprimir/guardar). */
export function abrirFacturaPDF(data: FacturaPDFData) {
  const doc = construirFacturaPDF(data);
  // Usamos Blob URL en vez de 'dataurlnewwindow': los navegadores y algunos
  // sitios bloquean la navegación a URLs data: ("Este contenido está bloqueado").
  // El Blob URL no tiene ese problema; si el popup queda bloqueado, descargamos.
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (!w) {
    const a = document.createElement('a');
    a.href = url;
    a.download = `factura-${data.serie}-${data.numero}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Descarga el PDF con un nombre de archivo. */
export function descargarFacturaPDF(data: FacturaPDFData) {
  const doc = construirFacturaPDF(data);
  doc.save(`factura-${data.serie}-${data.numero}.pdf`);
}
