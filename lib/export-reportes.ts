import * as XLSX from 'xlsx';

// =====================================================
// Export para el módulo de Reportes
// =====================================================
// Acepta un DatosReporte genérico (titulo, columnas, filas,
// kpis, totales) y genera Excel o PDF formateados.
// =====================================================

export interface ReporteExportable {
  titulo: string;
  subtitulo?: string;
  columnas: Array<{
    key: string;
    label: string;
    tipo?: 'texto' | 'numero' | 'moneda' | 'fecha' | 'porcentaje';
  }>;
  filas: any[];
  kpis?: Array<{ label: string; valor: string | number }>;
  totales?: Record<string, number>;
}

function formatCurrencyShort(n: number): string {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 0,
  }).format(n);
}

function formatNumberShort(n: number): string {
  return new Intl.NumberFormat('es-UY').format(n);
}

function formatPercentShort(n: number): string {
  return `${n.toFixed(1)}%`;
}

function formatDateShort(d: string): string {
  return new Date(d).toLocaleDateString('es-UY', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function fmtForExport(valor: any, tipo?: string): any {
  if (valor === null || valor === undefined) return '';
  if (tipo === 'fecha' && valor)        return formatDateShort(valor);
  if (tipo === 'moneda')                return Number(valor) || 0;       // Excel maneja el formato
  if (tipo === 'numero')                return Number(valor) || 0;
  if (tipo === 'porcentaje')            return (Number(valor) || 0) / 100;
  return valor;
}

function fmtForPdf(valor: any, tipo?: string): string {
  if (valor === null || valor === undefined) return '';
  if (tipo === 'fecha' && valor)        return formatDateShort(valor);
  if (tipo === 'moneda')                return formatCurrencyShort(Number(valor) || 0);
  if (tipo === 'numero')                return formatNumberShort(Number(valor) || 0);
  if (tipo === 'porcentaje')            return formatPercentShort(Number(valor) || 0);
  return String(valor);
}

// =====================================================
// EXCEL — con formato de moneda real
// =====================================================

export function exportarReporteExcel(reporte: ReporteExportable, filename?: string) {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Resumen (titulo + KPIs)
  const resumenRows: any[][] = [
    [reporte.titulo],
    reporte.subtitulo ? [reporte.subtitulo] : null,
    ['Generado:', new Date().toLocaleString('es-UY')],
    [''],
  ].filter(Boolean) as any[][];

  if (reporte.kpis && reporte.kpis.length > 0) {
    resumenRows.push(['INDICADORES']);
    reporte.kpis.forEach(k => resumenRows.push([k.label, k.valor]));
    resumenRows.push(['']);
  }

  const wsResumen = XLSX.utils.aoa_to_sheet(resumenRows);
  wsResumen['!cols'] = [{ wch: 30 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

  // Hoja 2: Datos con headers traducidos
  const headers = reporte.columnas.map(c => c.label);
  const dataRows = reporte.filas.map(f =>
    reporte.columnas.map(c => fmtForExport(f[c.key], c.tipo))
  );

  // Header row + data
  const wsData = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

  // Anchos de columna razonables: descripción larga, números cortos
  wsData['!cols'] = reporte.columnas.map(c => {
    if (c.key === 'descripcion' || c.key === 'nombre') return { wch: 40 };
    if (c.tipo === 'moneda')                            return { wch: 16 };
    if (c.tipo === 'fecha')                             return { wch: 12 };
    if (c.tipo === 'porcentaje')                        return { wch: 10 };
    if (c.tipo === 'numero')                            return { wch: 12 };
    return { wch: 18 };
  });

  // Aplicar formato numérico a las celdas (Excel native)
  const range = XLSX.utils.decode_range(wsData['!ref'] || 'A1');
  for (let R = 1; R <= range.e.r; ++R) {       // skip header
    for (let C = 0; C <= range.e.c; ++C) {
      const col = reporte.columnas[C];
      if (!col) continue;
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = wsData[addr];
      if (!cell) continue;
      if (col.tipo === 'moneda')     cell.z = '$ #,##0';
      if (col.tipo === 'numero')     cell.z = '#,##0';
      if (col.tipo === 'porcentaje') cell.z = '0.0%';
    }
  }

  // Fila de totales si los hay
  if (reporte.totales && Object.keys(reporte.totales).length > 0) {
    const totalRow: any[] = new Array(reporte.columnas.length).fill('');
    totalRow[0] = 'TOTALES';
    let idx = reporte.columnas.length - Object.keys(reporte.totales).length;
    Object.values(reporte.totales).forEach(v => {
      if (idx < reporte.columnas.length) {
        totalRow[idx] = Number(v) || 0;
        idx++;
      }
    });
    XLSX.utils.sheet_add_aoa(wsData, [totalRow], { origin: -1 });
  }

  XLSX.utils.book_append_sheet(wb, wsData, 'Datos');

  const base = (filename || reporte.titulo).replace(/[^a-z0-9_\-]/gi, '_');
  XLSX.writeFile(wb, `${base}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// =====================================================
// PDF — formato apaisado con tabla
// =====================================================

export async function exportarReportePDF(reporte: ReporteExportable, filename?: string) {
  // Lazy import — pesado, no lo cargamos hasta que se use
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Encabezado
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(reporte.titulo, 14, 15);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  if (reporte.subtitulo) {
    doc.text(reporte.subtitulo, 14, 21);
  }
  doc.text(
    `Generado: ${new Date().toLocaleString('es-UY')}  ·  ${reporte.filas.length} registros`,
    14, reporte.subtitulo ? 26 : 21
  );
  doc.setTextColor(0);

  let nextY = reporte.subtitulo ? 32 : 27;

  // KPIs como banner horizontal
  if (reporte.kpis && reporte.kpis.length > 0) {
    const kpiW = 280 / reporte.kpis.length;
    reporte.kpis.forEach((k, i) => {
      const x = 14 + i * kpiW;
      doc.setDrawColor(220);
      doc.setFillColor(245, 247, 250);
      doc.roundedRect(x, nextY, kpiW - 4, 14, 2, 2, 'FD');
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.text(k.label.toUpperCase(), x + 3, nextY + 5);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20);
      doc.text(String(k.valor), x + 3, nextY + 11);
      doc.setFont('helvetica', 'normal');
    });
    nextY += 20;
  }

  // Cuerpo: tabla
  const head = [reporte.columnas.map(c => c.label)];
  const body = reporte.filas.map(f =>
    reporte.columnas.map(c => fmtForPdf(f[c.key], c.tipo))
  );

  // Pie con totales si los hay
  let foot: any[][] | undefined;
  if (reporte.totales && Object.keys(reporte.totales).length > 0) {
    const totalRow: string[] = new Array(reporte.columnas.length).fill('');
    totalRow[0] = 'TOTALES';
    let idx = reporte.columnas.length - Object.keys(reporte.totales).length;
    Object.entries(reporte.totales).forEach(([key, v]) => {
      if (idx < reporte.columnas.length) {
        const tipo = key.toLowerCase().includes('valor') ? 'moneda' : 'numero';
        totalRow[idx] = fmtForPdf(v, tipo);
        idx++;
      }
    });
    foot = [totalRow];
  }

  autoTable(doc, {
    head, body, foot,
    startY: nextY,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [241, 245, 249], textColor: 30, fontStyle: 'bold' },
    columnStyles: reporte.columnas.reduce((acc, c, i) => {
      if (c.tipo === 'moneda' || c.tipo === 'numero' || c.tipo === 'porcentaje') {
        acc[i] = { halign: 'right' };
      }
      return acc;
    }, {} as Record<number, any>),
    alternateRowStyles: { fillColor: [250, 250, 252] },
  });

  // Footer con número de página
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      `Página ${i} de ${pageCount}  ·  Vanguard ERP`,
      14,
      doc.internal.pageSize.getHeight() - 8
    );
  }

  const base = (filename || reporte.titulo).replace(/[^a-z0-9_\-]/gi, '_');
  doc.save(`${base}_${new Date().toISOString().split('T')[0]}.pdf`);
}
