// =====================================================
// GET /api/insumos/solicitudes/[id]/pdf
// =====================================================
// PDF sobrio de solicitud de insumos. Escudo Vanguard en
// la esquina, layout de documento corporativo, sin colores
// chillones ni sensación "generado por IA".
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/security/permissions';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  en_gestion: 'En gestión',
  comprada: 'Comprada',
  recibida: 'Recibida',
  cerrada: 'Cerrada',
  cancelada: 'Cancelada',
};

// =====================================================
// Escudo Vanguard — réplica fiel del SVG de Logo.tsx
// =====================================================
// Reproduce el mismo path SVG con curvas Bézier usando
// jsPDF.lines() — no triángulos aproximados.
//
// SVG original (de components/ui/Logo.tsx):
//   Shield: M 32 4 L 56 14 V 32 C 56 46 46 56 32 60 C 18 56 8 46 8 32 V 14 Z
//   V mark: M 19 19 L 26 19 L 32 41.5 L 38 19 L 45 19 L 34.5 51 L 29.5 51 Z
// =====================================================
function dibujarEscudoVanguard(doc: jsPDF, x: number, y: number, size = 14) {
  // El SVG está dibujado en viewBox 64x64.
  const s = size / 64;

  // ---- Shield outline (steel-blue) ----
  // jsPDF.lines() recibe offsets RELATIVOS al punto previo.
  // - [dx, dy]                             → línea recta
  // - [c1dx, c1dy, c2dx, c2dy, dx, dy]     → bezier cúbica
  doc.setFillColor(45, 84, 128); // #2d5480
  doc.setDrawColor(45, 84, 128);

  // Empezamos en (32, 4) en coord SVG → escaladas en mm
  doc.lines(
    [
      [24, 10],                              // L 56 14
      [0, 18],                               // V 32 → L 56 32
      [0, 14, -10, 24, -24, 28],             // C 56 46 46 56 32 60
      [-14, -4, -24, -14, -24, -28],         // C 18 56 8 46 8 32
      [0, -18],                              // V 14 → L 8 14
    ],
    x + 32 * s, y + 4 * s,                   // punto inicial absoluto en mm
    [s, s],                                  // escala uniforme
    'F',                                     // fill
    true,                                    // close path (Z)
  );

  // ---- V mark blanca ----
  doc.setFillColor(255, 255, 255);

  // Empieza en (19, 19) en coord SVG
  doc.lines(
    [
      [7, 0],          // L 26 19
      [6, 22.5],       // L 32 41.5
      [6, -22.5],      // L 38 19
      [7, 0],          // L 45 19
      [-10.5, 32],     // L 34.5 51
      [-5, 0],         // L 29.5 51
    ],
    x + 19 * s, y + 19 * s,
    [s, s],
    'F',
    true,
  );

  doc.setFillColor(0, 0, 0); // reset
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('solicitudes_insumos')
    .select(`*, items:solicitudes_insumos_items(*)`)
    .eq('id', params.id)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });

  // Org info
  let empresa = 'Vanguard';
  if (data.organizacion_id) {
    const { data: org } = await supabase
      .from('organizaciones')
      .select('nombre')
      .eq('id', data.organizacion_id)
      .maybeSingle();
    if (org?.nombre) empresa = org.nombre as string;
  }

  // Categoría label
  let categoriaLabel = data.categoria as string;
  if (data.organizacion_id) {
    const { data: cat } = await supabase
      .from('org_categorias_insumos_routing')
      .select('categoria_label')
      .eq('organizacion_id', data.organizacion_id)
      .eq('categoria', data.categoria)
      .maybeSingle();
    if (cat?.categoria_label) categoriaLabel = cat.categoria_label as string;
  }

  // =====================================================
  // Generar PDF
  // =====================================================
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;

  // Slate gray base, no colorful banners
  const COLOR_TEXT_DARK: [number, number, number] = [15, 23, 42];
  const COLOR_TEXT_MUTED: [number, number, number] = [100, 116, 139];
  const COLOR_RULE: [number, number, number] = [203, 213, 225];

  // =====================================================
  // ENCABEZADO — escudo + nombre + línea divisoria
  // =====================================================
  dibujarEscudoVanguard(doc, margin, margin - 2, 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...COLOR_TEXT_DARK);
  doc.text(empresa, margin + 22, margin + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_TEXT_MUTED);
  doc.text('Sistema de gestión', margin + 22, margin + 9);

  // Número de documento (derecha)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_TEXT_DARK);
  doc.text(data.numero as string, pageWidth - margin, margin + 4, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_TEXT_MUTED);
  doc.text(`Emitido: ${new Date().toLocaleDateString('es-UY')}`, pageWidth - margin, margin + 9, { align: 'right' });

  // Línea divisoria horizontal
  doc.setDrawColor(...COLOR_RULE);
  doc.setLineWidth(0.3);
  doc.line(margin, margin + 16, pageWidth - margin, margin + 16);

  // =====================================================
  // TÍTULO DEL DOCUMENTO
  // =====================================================
  let y = margin + 26;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLOR_TEXT_DARK);
  doc.text('Solicitud de insumos', margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_TEXT_MUTED);
  doc.text(`Categoría: ${categoriaLabel}`, margin, y + 5);
  y += 14;

  // =====================================================
  // BLOQUE DE DATOS — dos columnas
  // =====================================================
  const colDer = pageWidth / 2 + 5;

  const drawField = (label: string, value: string, fx: number, fy: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_TEXT_MUTED);
    doc.text(label.toUpperCase(), fx, fy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...COLOR_TEXT_DARK);
    doc.text(value, fx, fy + 4.5);
  };

  drawField('Solicitante', data.solicitado_por as string, margin, y);
  drawField('Estado', ESTADO_LABEL[data.estado as string] || (data.estado as string), colDer, y);

  y += 11;
  drawField('Fecha de solicitud', new Date(data.fecha_solicitud).toLocaleDateString('es-UY'), margin, y);
  drawField('Fecha límite', data.fecha_limite ? new Date(data.fecha_limite).toLocaleDateString('es-UY') : 'No especificada', colDer, y);

  y += 11;
  if (data.gestor_asignado) {
    drawField('Gestor asignado', data.gestor_asignado as string, margin, y);
  }
  if (data.fecha_ingreso) {
    drawField('Fecha de ingreso', new Date(data.fecha_ingreso as string).toLocaleDateString('es-UY'), colDer, y);
  }
  if (data.gestor_asignado || data.fecha_ingreso) y += 11;

  // =====================================================
  // TABLA DE ITEMS
  // =====================================================
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_TEXT_DARK);
  doc.text('Detalle de items', margin, y);
  y += 3;

  const itemsRows = (data.items as any[]).map(it => [
    it.producto_codigo || '—',
    it.descripcion,
    Number(it.cantidad).toString(),
    it.unidad || '—',
    it.cantidad_recibida != null ? Number(it.cantidad_recibida).toString() : '—',
    it.observaciones || '—',
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Código', 'Descripción', 'Solicitado', 'Unidad', 'Recibido', 'Observaciones']],
    body: itemsRows,
    margin: { left: margin, right: margin },
    theme: 'plain',
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [71, 85, 105],
      fontStyle: 'bold',
      fontSize: 8,
      lineColor: [203, 213, 225],
      lineWidth: { bottom: 0.4 },
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: { bottom: 0.2 },
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 26, font: 'courier', fontSize: 8 },
      2: { halign: 'right', cellWidth: 22 },
      3: { cellWidth: 18 },
      4: { halign: 'right', cellWidth: 22 },
    },
  });

  // @ts-ignore lastAutoTable runtime
  let yAfter = (doc as any).lastAutoTable.finalY + 10;

  // =====================================================
  // OBSERVACIONES
  // =====================================================
  if (data.observaciones) {
    if (yAfter > pageHeight - 50) { doc.addPage(); yAfter = margin; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_TEXT_DARK);
    doc.text('Observaciones', margin, yAfter);
    yAfter += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...COLOR_TEXT_DARK);
    const split = doc.splitTextToSize(data.observaciones as string, pageWidth - 2 * margin);
    doc.text(split, margin, yAfter);
    yAfter += split.length * 4.5 + 6;
  }

  if (data.estado_motivo) {
    if (yAfter > pageHeight - 30) { doc.addPage(); yAfter = margin; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR_TEXT_MUTED);
    doc.text('Notas de gestión', margin, yAfter);
    yAfter += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_TEXT_DARK);
    const split = doc.splitTextToSize(data.estado_motivo as string, pageWidth - 2 * margin);
    doc.text(split, margin, yAfter);
  }

  // =====================================================
  // PIE DE PÁGINA — todas las páginas
  // =====================================================
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...COLOR_RULE);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_TEXT_MUTED);
    doc.text(
      `${data.numero}  ·  ${empresa}  ·  Generado por ${auth.user.email}`,
      margin,
      pageHeight - 9,
    );
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth - margin,
      pageHeight - 9,
      { align: 'right' },
    );
  }

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="solicitud-${data.numero}.pdf"`,
    },
  });
}
