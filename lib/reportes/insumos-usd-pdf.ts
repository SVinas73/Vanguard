// =====================================================
// PDF del reporte de insumos en USD
// =====================================================
// Documento corporativo A4: banda de portada con el símbolo de Vanguard,
// indicadores, lectura rápida, gráfico mensual vectorial, tablas y notas
// metodológicas. Todo en dólares. Se genera en el navegador (jsPDF).
// =====================================================

import type { jsPDF as JsPDF } from 'jspdf';
import { dibujarLogoVanguard } from '@/lib/pdf-brand';
import {
  agruparSerie, ETIQUETA_GRANULARIDAD, fmtFecha, fmtNum, fmtUsd, type ReporteInsumosUSD,
} from '@/lib/reportes/insumos-usd';

type RGB = [number, number, number];

const NAVY: RGB = [11, 22, 44];
const BLUE: RGB = [47, 111, 220];
const BLUE_LIGHT: RGB = [139, 188, 255];
const INK: RGB = [15, 23, 42];
const MUTED: RGB = [100, 116, 139];
const SOFT: RGB = [148, 163, 184];
const RULE: RGB = [226, 232, 240];
const ZEBRA: RGB = [248, 250, 252];
const HEAD: RGB = [241, 245, 249];
const RED: RGB = [200, 38, 38];
const GREEN: RGB = [21, 128, 61];

const PAGE_W = 210;
const PAGE_H = 297;
const M = 16; // margen lateral
const CONTENT_W = PAGE_W - M * 2;
const TOP_INTERIOR = 28; // inicio de contenido en páginas 2+
const BOTTOM = PAGE_H - 18; // límite inferior de contenido

/** jsPDF con fuentes estándar: normalizamos espacios especiales de Intl. */
const tx = (s: string) => s.replace(/[   ]/g, ' ');

async function cargarLogoPng(): Promise<string | null> {
  try {
    const res = await fetch('/vang.png', { cache: 'force-cache' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(typeof r.result === 'string' ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function logo(doc: JsPDF, png: string | null, x: number, y: number, size: number) {
  if (png) {
    try {
      doc.addImage(png, 'PNG', x, y, size, size);
      return;
    } catch { /* cae al vectorial */ }
  }
  dibujarLogoVanguard(doc, x, y, size);
}

function conOpacidad(doc: JsPDF, opacidad: number, dibujar: () => void) {
  const anyDoc = doc as any;
  try {
    anyDoc.saveGraphicsState();
    anyDoc.setGState(new anyDoc.GState({ opacity: opacidad }));
    dibujar();
    anyDoc.restoreGraphicsState();
  } catch {
    /* sin soporte de transparencia: se omite el adorno */
  }
}

/** Ajusta el tamaño de fuente para que el texto entre en `ancho`. */
function textoAjustado(doc: JsPDF, texto: string, x: number, y: number, ancho: number, tamMax: number, tamMin = 8) {
  let tam = tamMax;
  doc.setFontSize(tam);
  while (tam > tamMin && doc.getTextWidth(texto) > ancho) {
    tam -= 0.5;
    doc.setFontSize(tam);
  }
  doc.text(texto, x, y);
}

function usdCorto(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `US$ ${fmtNum(n / 1_000_000, 1)} M`;
  if (a >= 10_000) return `US$ ${fmtNum(n / 1000, 0)} k`;
  if (a >= 1000) return `US$ ${fmtNum(n / 1000, 1)} k`;
  return `US$ ${fmtNum(n, 0)}`;
}

export interface OpcionesPdf {
  usuario?: string | null;
  empresa?: string | null;
}

export async function construirPdfReporteInsumos(rep: ReporteInsumosUSD, opts: OpcionesPdf = {}): Promise<JsPDF> {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = (autoTableMod as any).default ?? (autoTableMod as any).autoTable;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const png = await cargarLogoPng();

  const periodo = `${fmtFecha(rep.desde)} al ${fmtFecha(rep.hasta)}`;
  const generado = new Date();
  const k = rep.kpis;

  doc.setProperties({
    title: `Reporte de insumos (USD) ${periodo}`,
    subject: 'Reporte de insumos en dólares',
    author: 'Vanguard',
    creator: 'Vanguard',
  });

  // ---------------------------------------------------
  // Portada (banda superior)
  // ---------------------------------------------------
  const BANDA_H = 54;
  // Degradé vertical suave (franjas de 0,5 mm con color interpolado)
  const DESDE: RGB = [9, 18, 38];
  const HASTA: RGB = [22, 50, 104];
  const pasos = Math.ceil(BANDA_H / 0.5);
  for (let i = 0; i < pasos; i++) {
    const t = i / (pasos - 1);
    doc.setFillColor(
      Math.round(DESDE[0] + (HASTA[0] - DESDE[0]) * t),
      Math.round(DESDE[1] + (HASTA[1] - DESDE[1]) * t),
      Math.round(DESDE[2] + (HASTA[2] - DESDE[2]) * t),
    );
    // cada franja llega hasta el final de la banda: sin costuras entre franjas
    doc.rect(0, i * 0.5, PAGE_W, BANDA_H - i * 0.5, 'F');
  }
  // Marca de agua del símbolo (queda dentro de la banda)
  conOpacidad(doc, 0.08, () => logo(doc, png, 134, -7.5, 64));
  // Línea de acento
  doc.setFillColor(...BLUE);
  doc.rect(0, BANDA_H, PAGE_W, 1.2, 'F');

  logo(doc, png, M, 12, 17);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('VANGUARD', M + 21, 20.5, { charSpace: 1.6 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...SOFT);
  doc.text('SISTEMA DE GESTIÓN', M + 21, 25.5, { charSpace: 0.9 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(21);
  doc.setTextColor(255, 255, 255);
  doc.text('Reporte de insumos', M, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BLUE_LIGHT);
  doc.text('Compras, consumos y costos expresados en dólares', M, 48.5);

  // Bloque derecho: período, categorías y moneda
  const xr = PAGE_W - M;
  const etiquetaDerecha = (label: string, valor: string, yLabel: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...SOFT);
    doc.text(label, xr, yLabel, { align: 'right', charSpace: 0.8 });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    let tam = 10;
    doc.setFontSize(tam);
    while (tam > 7 && doc.getTextWidth(valor) > 88) { tam -= 0.5; doc.setFontSize(tam); }
    doc.text(valor, xr, yLabel + 5.5, { align: 'right' });
  };
  const categoriasTxt = rep.categoriasFiltradas.length > 0 ? rep.categoriasFiltradas.join(', ') : 'Todas las categorías';
  etiquetaDerecha('PERÍODO', tx(periodo), 13.5);
  etiquetaDerecha('CATEGORÍAS', tx(categoriasTxt), 26);
  etiquetaDerecha('MONEDA', 'Dólares (USD)', 38.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...BLUE_LIGHT);
  doc.text(`TC de referencia: ${fmtNum(rep.tasa)} UYU = 1 USD`, xr, 48.5, { align: 'right' });

  // Línea de metadatos
  let y = BANDA_H + 8;
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  const genTxt = `Generado el ${fmtFecha(generado)} a las ${generado.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit', hour12: false })}`
    + (opts.usuario ? ` por ${opts.usuario}` : '');
  doc.text(tx(genTxt), M, y);
  doc.text(tx(opts.empresa ? `${opts.empresa} · Comercial · Análisis de insumos` : 'Comercial · Análisis de insumos'), xr, y, { align: 'right' });

  // ---------------------------------------------------
  // Helpers de maquetación
  // ---------------------------------------------------
  const nuevaPagina = () => {
    doc.addPage();
    y = TOP_INTERIOR;
  };
  const asegurar = (alto: number) => {
    if (y + alto > BOTTOM) nuevaPagina();
  };
  const titulo = (texto: string, sub?: string) => {
    asegurar(sub ? 26 : 20);
    y += 4;
    doc.setFillColor(...BLUE);
    doc.rect(M, y - 4.2, 1.3, 5.6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text(tx(texto), M + 4, y);
    if (sub) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(...MUTED);
      doc.text(tx(sub), M + 4, y + 5);
      y += 10;
    } else {
      y += 6;
    }
  };
  const tabla = (cfg: any) => {
    autoTable(doc, {
      startY: y,
      theme: 'plain',
      margin: { left: M, right: M, top: TOP_INTERIOR, bottom: PAGE_H - BOTTOM },
      styles: {
        font: 'helvetica',
        fontSize: 7.8,
        textColor: INK,
        cellPadding: { top: 2, bottom: 2, left: 2.4, right: 2.4 },
        overflow: 'linebreak',
        valign: 'middle',
      },
      headStyles: {
        fillColor: HEAD,
        textColor: NAVY,
        fontStyle: 'bold',
        fontSize: 7.2,
        lineWidth: { bottom: 0.45 },
        lineColor: BLUE,
      },
      bodyStyles: { lineWidth: { bottom: 0.1 }, lineColor: RULE },
      alternateRowStyles: { fillColor: ZEBRA },
      footStyles: { fillColor: [232, 239, 250], textColor: NAVY, fontStyle: 'bold', lineWidth: { top: 0.3 }, lineColor: BLUE },
      showFoot: 'lastPage',
      ...cfg,
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  };
  const vacio = (texto: string) => {
    asegurar(10);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(tx(texto), M + 4, y + 1);
    y += 8;
  };

  // ---------------------------------------------------
  // Indicadores
  // ---------------------------------------------------
  y += 6;
  const tarjetas = (items: Array<{ label: string; valor: string; hint: string; color?: RGB }>, alto: number) => {
    const gap = 4;
    const w = (CONTENT_W - gap * (items.length - 1)) / items.length;
    items.forEach((it, i) => {
      const x = M + i * (w + gap);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...RULE);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, w, alto, 2.2, 2.2, 'FD');
      doc.setFillColor(...(it.color || BLUE));
      doc.rect(x, y + 3.2, 1.1, alto - 6.4, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...MUTED);
      const etiqueta = tx(it.label.toUpperCase());
      let tamEt = 6.4;
      doc.setFontSize(tamEt);
      while (tamEt > 5 && doc.getTextWidth(etiqueta) + etiqueta.length * 0.35 > w - 8) {
        tamEt -= 0.2;
        doc.setFontSize(tamEt);
      }
      doc.text(etiqueta, x + 4.5, y + 6.5, { charSpace: 0.35 });
      doc.setTextColor(...INK);
      textoAjustado(doc, tx(it.valor), x + 4.5, y + (alto > 22 ? 15 : 13), w - 8, alto > 22 ? 13.5 : 11.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...MUTED);
      textoAjustado(doc, tx(it.hint), x + 4.5, y + alto - 4, w - 8, 6.6, 5.2);
    });
    y += alto + 4;
  };

  tarjetas([
    { label: 'Compras', valor: fmtUsd(k.comprasUsd), hint: `${fmtNum(k.cantidadCompras)} compras · ${fmtNum(k.unidadesCompradas)} uds.` },
    { label: 'Consumo', valor: fmtUsd(k.consumoUsd), hint: `${fmtNum(k.cantidadConsumos)} salidas · ${fmtNum(k.ordenesInternas)} órdenes internas`, color: BLUE_LIGHT },
    { label: 'Compras - consumo', valor: fmtUsd(k.netoUsd), hint: k.netoUsd >= 0 ? 'Aumento neto de stock' : 'Reducción neta de stock', color: k.netoUsd >= 0 ? GREEN : RED },
    { label: 'Inventario hoy', valor: k.inventarioActualUsd != null ? fmtUsd(k.inventarioActualUsd) : '—', hint: `${fmtNum(k.insumosActivos)} insumos valorizados al costo`, color: NAVY },
  ], 25);
  tarjetas([
    { label: 'Solicitudes', valor: fmtNum(k.solicitudes), hint: `${fmtNum(k.solicitudesRecibidas)} recibidas · ${fmtNum(k.solicitudesAbiertas)} abiertas` },
    { label: 'Estimado solicitado', valor: fmtUsd(k.estimadoSolicitudesUsd), hint: 'Sin contar las canceladas' },
    { label: 'Subas de precio', valor: fmtNum(k.insumosConAumento), hint: `${fmtNum(k.insumosConBaja)} insumos bajaron de precio`, color: k.insumosConAumento > 0 ? RED : GREEN },
    { label: 'Consumo por día', valor: fmtUsd(k.consumoDiarioUsd), hint: `Promedio de ${fmtNum(rep.dias)} días`, color: GREEN },
  ], 21);

  // ---------------------------------------------------
  // Lectura rápida
  // ---------------------------------------------------
  const lineas: string[] = [];
  if (k.cantidadCompras === 0 && k.cantidadConsumos === 0) {
    lineas.push('No se registraron compras ni consumos de insumos en el período seleccionado.');
  } else {
    lineas.push(`Se registraron ${fmtNum(k.cantidadCompras)} compras por ${fmtUsd(k.comprasUsd)} y ${fmtNum(k.cantidadConsumos)} consumos valorizados en ${fmtUsd(k.consumoUsd)}.`);
    const top = rep.porProducto[0];
    if (top && top.comprasUsd > 0 && k.comprasUsd > 0) {
      lineas.push(`El insumo con mayor gasto fue ${top.descripcion} (${top.codigo}): ${fmtUsd(top.comprasUsd)}, el ${fmtNum((top.comprasUsd / k.comprasUsd) * 100, 1)} % de las compras.`);
    }
    const subas = rep.variacionPrecios.filter(v => v.variacionPct > 0.5).sort((a, b) => b.variacionPct - a.variacionPct);
    if (subas.length > 0) {
      lineas.push(`${fmtNum(subas.length)} insumo(s) subieron de precio. La mayor suba fue ${subas[0].descripcion}: de ${fmtUsd(subas[0].precioInicialUsd)} a ${fmtUsd(subas[0].precioFinalUsd)} (+${fmtNum(subas[0].variacionPct, 1)} %).`);
    }
    const cat = rep.porCategoria[0];
    if (cat) lineas.push(`La categoría con mayor peso fue ${cat.categoria} (${fmtNum(cat.participacion, 1)} % del movimiento valorizado).`);
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  const envueltas = lineas.map(l => doc.splitTextToSize(tx(l), CONTENT_W - 14) as string[]);
  const altoBox = 9 + envueltas.reduce((s, w) => s + w.length * 4, 0) + (envueltas.length - 1) * 1.2;
  asegurar(altoBox + 4);
  doc.setFillColor(239, 245, 255);
  doc.setDrawColor(199, 219, 250);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, CONTENT_W, altoBox, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...BLUE);
  doc.text('LECTURA RÁPIDA', M + 5, y + 5.5, { charSpace: 0.6 });
  let yy = y + 10.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  for (const w of envueltas) {
    doc.setFillColor(...BLUE);
    doc.circle(M + 6, yy - 1.1, 0.7, 'F');
    doc.setTextColor(...INK);
    doc.text(w, M + 9, yy);
    yy += w.length * 4 + 1.2;
  }
  y += altoBox + 4;

  // ---------------------------------------------------
  // Evolución mensual (gráfico vectorial + tabla)
  // ---------------------------------------------------
  const serie = rep.serie;
  const unidad = ETIQUETA_GRANULARIDAD[rep.granularidad];
  // Tabla: por día solo los días con movimiento; si no, la misma serie.
  const filasTabla = rep.granularidad === 'dia'
    ? serie.filter(s => s.comprasUsd > 0 || s.consumoUsd > 0)
    : rep.granularidad === 'mes' ? agruparSerie(rep.mensual) : serie;
  titulo('Evolución de compras y consumo', `Importes en USD por ${unidad}`);
  if (serie.length === 0 || serie.every(s => s.comprasUsd === 0 && s.consumoUsd === 0)) {
    vacio('Sin compras ni consumos en el período.');
  } else {
    const altoG = 58;
    asegurar(altoG + 8);
    const gx = M + 16;
    const gw = CONTENT_W - 16;
    const gy = y + 4;
    const gh = altoG - 14;
    const max = Math.max(...serie.map(s => Math.max(s.comprasUsd, s.consumoUsd)), 1);
    // escala "linda"
    const pot = Math.pow(10, Math.floor(Math.log10(max)));
    const tope = Math.ceil(max / pot / 2) * 2 * pot || max;
    doc.setFontSize(6.3);
    doc.setFont('helvetica', 'normal');
    for (let i = 0; i <= 4; i++) {
      const v = (tope / 4) * i;
      const ly = gy + gh - (gh * i) / 4;
      doc.setDrawColor(...RULE);
      doc.setLineWidth(i === 0 ? 0.35 : 0.15);
      doc.line(gx, ly, gx + gw, ly);
      doc.setTextColor(...MUTED);
      doc.text(tx(usdCorto(v)), gx - 2, ly + 1, { align: 'right' });
    }
    const slot = gw / serie.length;
    const bw = Math.min(7, slot * 0.32);
    const cadaN = Math.ceil(serie.length / 14);
    serie.forEach((s, i) => {
      const cx = gx + slot * i + slot / 2;
      const hC = (s.comprasUsd / tope) * gh;
      const hU = (s.consumoUsd / tope) * gh;
      if (hC > 0) { doc.setFillColor(...BLUE); doc.rect(cx - bw - 0.3, gy + gh - hC, bw, hC, 'F'); }
      if (hU > 0) { doc.setFillColor(...BLUE_LIGHT); doc.rect(cx + 0.3, gy + gh - hU, bw, hU, 'F'); }
      if (i % cadaN === 0) {
        doc.setTextColor(...MUTED);
        doc.text(tx(s.etiqueta), cx, gy + gh + 4.2, { align: 'center' });
      }
    });
    // Leyenda
    const lx = gx + gw - 46;
    doc.setFillColor(...BLUE); doc.rect(lx, y - 1.6, 3, 3, 'F');
    doc.setTextColor(...INK); doc.setFontSize(7); doc.text('Compras', lx + 4.5, y + 0.8);
    doc.setFillColor(...BLUE_LIGHT); doc.rect(lx + 22, y - 1.6, 3, 3, 'F');
    doc.text('Consumo', lx + 26.5, y + 0.8);
    y += altoG;

    tabla({
      head: [[unidad.charAt(0).toUpperCase() + unidad.slice(1), 'Compras', 'Consumo', 'Compras - consumo']],
      body: filasTabla.map(s => [s.etiqueta, tx(fmtUsd(s.comprasUsd)), tx(fmtUsd(s.consumoUsd)), tx(fmtUsd(s.comprasUsd - s.consumoUsd))]),
      foot: [['Total', tx(fmtUsd(k.comprasUsd)), tx(fmtUsd(k.consumoUsd)), tx(fmtUsd(k.netoUsd))]],
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      didParseCell: (d: any) => {
        if ((d.section === 'head' || d.section === 'foot') && d.column.index > 0) d.cell.styles.halign = 'right';
      },
    });
  }

  // ---------------------------------------------------
  // Por categoría
  // ---------------------------------------------------
  titulo('Gasto por categoría', 'Compras y consumo valorizado, con su peso sobre el total');
  if (rep.porCategoria.length === 0) {
    vacio('Sin movimientos valorizados en el período.');
  } else {
    tabla({
      head: [['Categoría', 'Compras', 'Consumo', 'Participación']],
      body: rep.porCategoria.map(c => [tx(c.categoria), tx(fmtUsd(c.comprasUsd)), tx(fmtUsd(c.consumoUsd)), `${fmtNum(c.participacion, 1)} %`]),
      columnStyles: { 0: { cellWidth: 52 }, 1: { halign: 'right', cellWidth: 34 }, 2: { halign: 'right', cellWidth: 34 }, 3: { halign: 'right' } },
      didParseCell: (d: any) => {
        if (d.section === 'head' && d.column.index > 0) d.cell.styles.halign = 'right';
      },
      didDrawCell: (d: any) => {
        if (d.section !== 'body' || d.column.index !== 3) return;
        const p = rep.porCategoria[d.row.index]?.participacion ?? 0;
        const bx = d.cell.x + 2.4;
        const bwMax = d.cell.width - 20;
        const by = d.cell.y + d.cell.height / 2 - 1.1;
        doc.setFillColor(...RULE);
        doc.roundedRect(bx, by, bwMax, 2.2, 1.1, 1.1, 'F');
        if (p > 0) {
          doc.setFillColor(...BLUE);
          doc.roundedRect(bx, by, Math.max(2.2, (bwMax * p) / 100), 2.2, 1.1, 1.1, 'F');
        }
      },
    });
  }

  // ---------------------------------------------------
  // Insumos con mayor gasto
  // ---------------------------------------------------
  const top = [...rep.porProducto].sort((a, b) => b.totalUsd - a.totalUsd).slice(0, 15);
  titulo('Insumos con mayor gasto', 'Top 15 por compras + consumo valorizado');
  if (top.length === 0) {
    vacio('Sin insumos con movimiento en el período.');
  } else {
    tabla({
      head: [['Código', 'Descripción', 'Uds.\ncompradas', 'Costo prom.\ncompra', 'Compras', 'Uds.\nconsumidas', 'Consumo']],
      body: top.map(p => [
        p.codigo, tx(p.descripcion), fmtNum(p.unidadesCompradas, 0),
        p.unidadesCompradas > 0 ? tx(fmtUsd(p.costoPromCompraUsd)) : '—',
        tx(fmtUsd(p.comprasUsd)), fmtNum(p.unidadesConsumidas, 0), tx(fmtUsd(p.consumoUsd)),
      ]),
      columnStyles: {
        0: { cellWidth: 22, fontStyle: 'bold' }, 2: { halign: 'right', cellWidth: 19 }, 3: { halign: 'right', cellWidth: 21 },
        4: { halign: 'right', cellWidth: 24 }, 5: { halign: 'right', cellWidth: 21 }, 6: { halign: 'right', cellWidth: 23 },
      },
      didParseCell: (d: any) => {
        if (d.section === 'head' && d.column.index > 1) d.cell.styles.halign = 'right';
      },
    });
  }

  // ---------------------------------------------------
  // Variación de precios
  // ---------------------------------------------------
  titulo('Variación de precios de compra', 'Precio de referencia: última compra anterior al período (o la primera dentro de él)');
  const vars = rep.variacionPrecios.slice(0, 30);
  if (vars.length === 0) {
    vacio('No hay cambios de precio para comparar: se necesitan al menos dos compras de un mismo insumo.');
  } else {
    tabla({
      head: [['Código', 'Descripción', 'Precio inicial', 'Precio final', 'Mín.', 'Máx.', 'Variación']],
      body: vars.map(v => [
        v.codigo, tx(v.descripcion),
        `${tx(fmtUsd(v.precioInicialUsd))}\n${fmtFecha(v.fechaInicial)}`,
        `${tx(fmtUsd(v.precioFinalUsd))}\n${fmtFecha(v.fechaFinal)}`,
        tx(fmtUsd(v.minUsd)), tx(fmtUsd(v.maxUsd)),
        `${v.variacionPct > 0 ? '+' : ''}${fmtNum(v.variacionPct, 1)} %`,
      ]),
      columnStyles: {
        0: { cellWidth: 22, fontStyle: 'bold' }, 2: { halign: 'right', cellWidth: 23 }, 3: { halign: 'right', cellWidth: 23 },
        4: { halign: 'right', cellWidth: 19 }, 5: { halign: 'right', cellWidth: 19 }, 6: { halign: 'right', cellWidth: 19, fontStyle: 'bold' },
      },
      didParseCell: (d: any) => {
        if (d.section === 'head' && d.column.index > 1) d.cell.styles.halign = 'right';
        if (d.section === 'body' && d.column.index === 6) {
          const pct = vars[d.row.index]?.variacionPct ?? 0;
          d.cell.styles.textColor = pct > 0.5 ? RED : pct < -0.5 ? GREEN : MUTED;
        }
      },
    });
  }

  // ---------------------------------------------------
  // Solicitudes de insumos (dos tablas lado a lado)
  // ---------------------------------------------------
  titulo('Solicitudes de insumos', 'Creadas en el período · costo estimado en USD (no incluye canceladas)');
  if (k.solicitudes === 0) {
    vacio('No se crearon solicitudes de insumos en el período.');
  } else {
    asegurar(30);
    const yInicio = y;
    const ancho = (CONTENT_W - 6) / 2;
    const base = {
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 7.8, textColor: INK, cellPadding: { top: 2, bottom: 2, left: 2.4, right: 2.4 } },
      headStyles: { fillColor: HEAD, textColor: NAVY, fontStyle: 'bold', fontSize: 7.2, lineWidth: { bottom: 0.45 }, lineColor: BLUE },
      bodyStyles: { lineWidth: { bottom: 0.1 }, lineColor: RULE },
      alternateRowStyles: { fillColor: ZEBRA },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
      didParseCell: (d: any) => { if (d.section === 'head' && d.column.index > 0) d.cell.styles.halign = 'right'; },
    };
    autoTable(doc, {
      ...base,
      startY: yInicio,
      margin: { left: M, right: PAGE_W - M - ancho, top: TOP_INTERIOR, bottom: PAGE_H - BOTTOM },
      head: [['Estado', 'Cantidad', 'Estimado']],
      body: rep.solicitudesPorEstado.map(s => [s.etiqueta, fmtNum(s.cantidad), tx(fmtUsd(s.estimadoUsd))]),
    });
    const y1 = (doc as any).lastAutoTable.finalY;
    const pag1 = doc.getNumberOfPages();
    doc.setPage(pag1);
    autoTable(doc, {
      ...base,
      startY: yInicio,
      margin: { left: M + ancho + 6, right: M, top: TOP_INTERIOR, bottom: PAGE_H - BOTTOM },
      head: [['Categoría', 'Cantidad', 'Estimado']],
      body: rep.solicitudesPorCategoria.map(s => [tx(s.etiqueta), fmtNum(s.cantidad), tx(fmtUsd(s.estimadoUsd))]),
    });
    const y2 = (doc as any).lastAutoTable.finalY;
    y = Math.max(y1, y2) + 6;
  }

  // ---------------------------------------------------
  // Estado de stock (hoy): insumos para reponer
  // ---------------------------------------------------
  const criticos = rep.stock
    .filter(st => st.stock <= 0 || (st.stockMinimo > 0 && st.stock <= st.stockMinimo))
    .sort((a, b) => a.stock - a.stockMinimo - (b.stock - b.stockMinimo))
    .slice(0, 25);
  titulo('Insumos para reponer (stock de hoy)', `${fmtNum(k.insumosAgotados)} agotados y ${fmtNum(k.insumosBajoMinimo)} bajo el mínimo · cobertura al ritmo de consumo del período`);
  if (criticos.length === 0) {
    vacio('Ningún insumo agotado ni bajo el mínimo.');
  } else {
    tabla({
      head: [['Código', 'Descripción', 'Stock', 'Mínimo', 'Uso/día', 'Cobertura', 'Últ. precio', 'Valor']],
      body: criticos.map(st => [
        st.codigo, tx(st.descripcion), fmtNum(st.stock), fmtNum(st.stockMinimo),
        st.consumoDiario > 0 ? fmtNum(st.consumoDiario, 2) : '—',
        st.stock <= 0 ? 'Agotado' : st.diasCobertura != null ? `${fmtNum(st.diasCobertura)} días` : 'Sin consumo',
        tx(fmtUsd(st.ultimoPrecioUsd ?? st.costoPromedioUsd)), tx(fmtUsd(st.valorUsd)),
      ]),
      columnStyles: {
        0: { cellWidth: 20, fontStyle: 'bold' }, 2: { halign: 'right', cellWidth: 13 }, 3: { halign: 'right', cellWidth: 14 },
        4: { halign: 'right', cellWidth: 19 }, 5: { halign: 'right', cellWidth: 20 }, 6: { halign: 'right', cellWidth: 21 }, 7: { halign: 'right', cellWidth: 21 },
      },
      didParseCell: (d: any) => {
        if (d.section === 'head' && d.column.index > 1) d.cell.styles.halign = 'right';
        if (d.section === 'body' && d.column.index === 5) {
          const st = criticos[d.row.index];
          d.cell.styles.textColor = st.stock <= 0 || (st.diasCobertura != null && st.diasCobertura < 7) ? RED : MUTED;
        }
      },
    });
  }

  // ---------------------------------------------------
  // Detalle de compras
  // ---------------------------------------------------
  titulo('Detalle de compras', 'Precio real de cada compra, en su moneda original y convertido a USD');
  if (rep.compras.length === 0) {
    vacio('Sin compras con costo en el período.');
  } else {
    tabla({
      head: [['Fecha', 'Código', 'Descripción', 'Cant.', 'Costo unit.\noriginal', 'Costo unit.\nUSD', 'Total USD']],
      body: rep.compras.map(c => [
        fmtFecha(c.fecha), c.codigo, tx(c.descripcion), fmtNum(c.cantidad, c.cantidad % 1 ? 2 : 0),
        c.costoEstimado
          ? 'Sin costo cargado'
          : c.monedaOriginal === 'USD' ? tx(fmtUsd(c.costoUnitOriginal)) : tx(`$ ${fmtNum(c.costoUnitOriginal, 2)} UYU`),
        tx(fmtUsd(c.costoUnitUsd)) + (c.costoEstimado ? ' *' : ''), tx(fmtUsd(c.totalUsd)),
      ]),
      foot: [[{ content: `${fmtNum(rep.compras.length)} compras`, colSpan: 3 }, fmtNum(k.unidadesCompradas), '', '', tx(fmtUsd(k.comprasUsd))]],
      columnStyles: {
        0: { cellWidth: 19.5 }, 1: { cellWidth: 20, fontStyle: 'bold' }, 3: { halign: 'right', cellWidth: 12 },
        4: { halign: 'right', cellWidth: 29 }, 5: { halign: 'right', cellWidth: 21 }, 6: { halign: 'right', cellWidth: 24 },
      },
      didParseCell: (d: any) => {
        if ((d.section === 'head' || d.section === 'foot') && d.column.index > 2) d.cell.styles.halign = 'right';
        const c = d.section === 'body' ? rep.compras[d.row.index] : null;
        if (c && d.column.index === 4 && (c.monedaOriginal === 'UYU' || c.costoEstimado)) {
          d.cell.styles.textColor = MUTED;
        }
      },
    });
  }

  // ---------------------------------------------------
  // Detalle de consumos
  // ---------------------------------------------------
  titulo('Detalle de consumos', 'Salidas y órdenes internas al costo promedio vigente en cada fecha');
  if (rep.consumos.length === 0) {
    vacio('Sin consumos en el período.');
  } else {
    tabla({
      head: [['Fecha', 'Código', 'Descripción', 'Cant.', 'Tipo', 'Costo unit.\nUSD', 'Total USD']],
      body: rep.consumos.map(c => [
        fmtFecha(c.fecha), c.codigo, tx(c.descripcion), fmtNum(c.cantidad, c.cantidad % 1 ? 2 : 0),
        c.ordenInterna ? 'Orden interna' : 'Salida',
        tx(fmtUsd(c.costoUnitUsd)) + (c.costoEstimado ? ' *' : ''), tx(fmtUsd(c.totalUsd)),
      ]),
      foot: [[{ content: `${fmtNum(rep.consumos.length)} consumos`, colSpan: 3 }, fmtNum(k.unidadesConsumidas), '', '', tx(fmtUsd(k.consumoUsd))]],
      columnStyles: {
        0: { cellWidth: 19.5 }, 1: { cellWidth: 20, fontStyle: 'bold' }, 3: { halign: 'right', cellWidth: 12 },
        4: { cellWidth: 22 }, 5: { halign: 'right', cellWidth: 22 }, 6: { halign: 'right', cellWidth: 24 },
      },
      didParseCell: (d: any) => {
        if ((d.section === 'head' || d.section === 'foot') && d.column.index > 4) d.cell.styles.halign = 'right';
        if ((d.section === 'head' || d.section === 'foot') && d.column.index === 3) d.cell.styles.halign = 'right';
      },
    });
  }

  // ---------------------------------------------------
  // Notas metodológicas
  // ---------------------------------------------------
  titulo('Notas metodológicas');
  const notas = [
    'Todos los importes están expresados en dólares estadounidenses (USD).',
    `Los costos cargados en pesos uruguayos se convierten a USD con un tipo de cambio de referencia de ${fmtNum(rep.tasa)} UYU por dólar. Los cargados en dólares se toman tal cual.`,
    'Los insumos solo se compran y se usan: el reporte no incluye ventas ni márgenes.',
    'Compras: cada entrada de un insumo es una compra y se cuenta al precio real pagado, en su moneda original. Un mismo insumo puede comprarse a precios distintos en distintas fechas; cada compra se cuenta a su propio precio. Si una compra no tiene costo cargado, se valoriza al costo promedio vigente (marcada con *).',
    'Consumos: valorizados al costo promedio ponderado móvil vigente en la fecha de cada salida, calculado con todo el historial de compras del insumo (también el anterior al período).',
    'No son compras: la carga de stock inicial (alta del producto o importación) ni las devoluciones. Ajustes y transferencias no son compras ni consumos.',
    'Inventario hoy: valuación FIFO por lote (cada lote en su moneda de compra) y costo promedio para unidades sin lote, convertida con la misma referencia.',
    ...rep.advertencias.map(a => `Aviso: ${a}`),
    ...(rep.compras.some(c => c.costoEstimado) ? ['* Compra sin costo cargado: se valorizó al costo promedio vigente del insumo.'] : []),
    ...(rep.consumos.some(c => c.costoEstimado) ? ['* Consumo sin compras previas con costo: se usó el costo promedio actual del insumo.'] : []),
  ];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  for (const n of notas) {
    const w = doc.splitTextToSize(tx(n), CONTENT_W - 8) as string[];
    asegurar(w.length * 3.8 + 2);
    doc.setFillColor(...SOFT);
    doc.circle(M + 1.6, y - 1, 0.55, 'F');
    doc.setTextColor(...INK);
    doc.text(w, M + 4.5, y);
    y += w.length * 3.8 + 1.6;
  }

  // ---------------------------------------------------
  // Encabezado (páginas 2+) y pie (todas)
  // ---------------------------------------------------
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    if (p > 1) {
      logo(doc, png, M, 9.5, 8.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...NAVY);
      doc.text('VANGUARD', M + 11, 15.4, { charSpace: 1 });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(tx(`Reporte de insumos (USD) · ${periodo}`), PAGE_W - M, 15.4, { align: 'right' });
      doc.setDrawColor(...RULE);
      doc.setLineWidth(0.3);
      doc.line(M, 20, PAGE_W - M, 20);
    }
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.3);
    doc.line(M, PAGE_H - 12, PAGE_W - M, PAGE_H - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text('Vanguard · Reporte de insumos en dólares', M, PAGE_H - 7.5);
    doc.text(tx(`TC ref. ${fmtNum(rep.tasa)} UYU/USD`), PAGE_W / 2, PAGE_H - 7.5, { align: 'center' });
    doc.text(`Página ${p} de ${total}`, PAGE_W - M, PAGE_H - 7.5, { align: 'right' });
  }

  return doc;
}

export function nombreArchivoReporte(rep: ReporteInsumosUSD): string {
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const cat = rep.categoriasFiltradas.length === 1
    ? `_${rep.categoriasFiltradas[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_')}`
    : rep.categoriasFiltradas.length > 1 ? '_Varias_categorias' : '';
  return `Vanguard_Reporte_Insumos_USD${cat}_${iso(rep.desde)}_al_${iso(rep.hasta)}.pdf`;
}
