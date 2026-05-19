// =====================================================
// GET /api/insumos/solicitudes/[id]/pdf
// =====================================================
// Genera un PDF profesional de la solicitud para descarga.
// Usa jsPDF + autoTable (mismo stack que el resto del sistema).
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

  // Org info (para header del PDF)
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
  let categoriaLabel = data.categoria;
  if (data.organizacion_id) {
    const { data: cat } = await supabase
      .from('org_categorias_insumos_routing')
      .select('categoria_label, gestor_emails, referente_emails')
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
  const margin = 15;

  // Header banner
  doc.setFillColor(124, 58, 237); // purple-600
  doc.rect(0, 0, pageWidth, 35, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('SOLICITUD DE INSUMOS', margin, 14);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(data.numero, margin, 23);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(empresa, margin, 30);

  // Estado en la esquina
  doc.setFillColor(255, 255, 255);
  doc.setTextColor(124, 58, 237);
  const estadoTxt = (ESTADO_LABEL[data.estado as string] || data.estado).toUpperCase();
  doc.roundedRect(pageWidth - margin - 40, 11, 40, 8, 2, 2, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(estadoTxt, pageWidth - margin - 20, 16.5, { align: 'center' });

  // Metadata box
  let y = 45;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('DETALLE DE LA SOLICITUD', margin, y);
  y += 5;

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  doc.setFontSize(9);
  const drawRow = (label: string, value: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(value, margin + 45, y);
    y += 6;
  };

  drawRow('Categoría:', categoriaLabel as string);
  drawRow('Solicitante:', data.solicitado_por as string);
  drawRow('Fecha solicitud:', new Date(data.fecha_solicitud).toLocaleString('es-UY'));
  if (data.fecha_limite) drawRow('Fecha límite:', new Date(data.fecha_limite).toLocaleDateString('es-UY'));
  if (data.fecha_ingreso) drawRow('Fecha ingreso:', new Date(data.fecha_ingreso).toLocaleDateString('es-UY'));
  if (data.gestor_asignado) drawRow('Gestor asignado:', data.gestor_asignado as string);

  // Items
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`INSUMOS SOLICITADOS (${data.items.length})`, margin, y);
  y += 3;

  const itemsRows = data.items.map((it: any) => [
    it.producto_codigo || '—',
    it.descripcion,
    String(it.cantidad),
    it.unidad || 'unidad',
    it.cantidad_recibida != null ? String(it.cantidad_recibida) : '—',
    it.observaciones || '—',
  ]);

  autoTable(doc, {
    startY: y,
    head: [['SKU', 'Descripción', 'Solicitado', 'Unidad', 'Recibido', 'Observaciones']],
    body: itemsRows,
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [71, 85, 105],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [15, 23, 42],
    },
    alternateRowStyles: {
      fillColor: [250, 252, 255],
    },
    columnStyles: {
      0: { cellWidth: 22, font: 'courier' },
      2: { halign: 'right', cellWidth: 22 },
      3: { cellWidth: 20 },
      4: { halign: 'right', cellWidth: 22 },
    },
  });

  // Observaciones generales
  // @ts-ignore - lastAutoTable está en runtime
  let yAfter = (doc as any).lastAutoTable.finalY + 8;

  if (data.observaciones) {
    if (yAfter > 250) { doc.addPage(); yAfter = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('OBSERVACIONES', margin, yAfter);
    yAfter += 4;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, yAfter, pageWidth - margin, yAfter);
    yAfter += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    const split = doc.splitTextToSize(data.observaciones as string, pageWidth - 2 * margin);
    doc.text(split, margin, yAfter);
    yAfter += split.length * 4 + 4;
  }

  if (data.estado_motivo) {
    if (yAfter > 260) { doc.addPage(); yAfter = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Notas de estado:', margin, yAfter);
    yAfter += 4;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const split = doc.splitTextToSize(data.estado_motivo as string, pageWidth - 2 * margin);
    doc.text(split, margin, yAfter);
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generado por Vanguard ERP · ${new Date().toLocaleString('es-UY')} · ${auth.user.email}`, margin, doc.internal.pageSize.getHeight() - 8);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
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
