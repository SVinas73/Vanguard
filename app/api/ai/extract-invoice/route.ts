// =====================================================
// POST /api/ai/extract-invoice
// =====================================================
// Recibe un PDF o imagen de factura y devuelve los datos
// estructurados extraídos por Gemini Vision.
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { extraerFactura, archivoSoportado } from '@/lib/ai-extraction';
import { requireAuth } from '@/lib/security/permissions';
import { chequearRateLimit, extraerIP } from '@/lib/security/rate-limit';
import { registrarAuditoriaSegura, extraerContextoAudit } from '@/lib/security/audit-enhanced';

export async function POST(request: NextRequest) {
  // 1. Auth
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // 2. Rate limit (10 extracciones/hora por usuario; Gemini cuesta tokens)
  const ip = extraerIP(request);
  const rl = await chequearRateLimit({
    bucket: `ai-extract-invoice:${auth.user.email}`,
    max: 10, windowSeconds: 3600,
    ip, usuarioEmail: auth.user.email, ruta: '/api/ai/extract-invoice',
  });
  if (rl.bloqueado) {
    return NextResponse.json(
      { error: 'Demasiadas extracciones. Esperá un momento.', retry_after: rl.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds || 60) } }
    );
  }

  // 3. Recibir archivo
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Formato inválido. Usá multipart/form-data con campo "file".' }, { status: 400 });
  }
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'Falta el archivo en el campo "file"' }, { status: 400 });
  }

  // 4. Validar
  const valid = archivoSoportado({ type: file.type, size: file.size });
  if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 });

  // 5. Convertir y extraer
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const fileBase64 = buf.toString('base64');
    const datos = await extraerFactura({ fileBase64, mimeType: file.type });

    // 6. Auditar
    await registrarAuditoriaSegura({
      tabla: 'ai_extracciones',
      accion: 'EXTRAER_FACTURA',
      datosNuevos: {
        archivo: file.name,
        size: file.size,
        proveedor: datos.proveedor?.nombre,
        total: datos.total,
        confianza: datos.confianza,
      },
      usuarioEmail: auth.user.email,
      contexto: extraerContextoAudit(request),
    });

    return NextResponse.json({ ok: true, datos });
  } catch (e: any) {
    console.error('extract-invoice error:', e);
    return NextResponse.json({
      error: 'No se pudo extraer la factura',
      detalle: e.message,
    }, { status: 500 });
  }
}
