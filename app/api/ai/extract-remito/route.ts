import { NextRequest, NextResponse } from 'next/server';
import { extraerRemito, archivoSoportado } from '@/lib/ai-extraction';
import { requireAuth } from '@/lib/security/permissions';
import { chequearRateLimit, extraerIP } from '@/lib/security/rate-limit';
import { registrarAuditoriaSegura, extraerContextoAudit } from '@/lib/security/audit-enhanced';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const ip = extraerIP(request);
  const rl = await chequearRateLimit({
    bucket: `ai-extract-remito:${auth.user.email}`,
    max: 10, windowSeconds: 3600,
    ip, usuarioEmail: auth.user.email, ruta: '/api/ai/extract-remito',
  });
  if (rl.bloqueado) {
    return NextResponse.json(
      { error: 'Demasiadas extracciones', retry_after: rl.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds || 60) } }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Formato inválido' }, { status: 400 });
  }
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 });

  const valid = archivoSoportado({ type: file.type, size: file.size });
  if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 });

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const datos = await extraerRemito({ fileBase64: buf.toString('base64'), mimeType: file.type });

    await registrarAuditoriaSegura({
      tabla: 'ai_extracciones',
      accion: 'EXTRAER_REMITO',
      datosNuevos: {
        archivo: file.name,
        proveedor: datos.proveedor,
        items: datos.items?.length || 0,
        confianza: datos.confianza,
      },
      usuarioEmail: auth.user.email,
      contexto: extraerContextoAudit(request),
    });

    return NextResponse.json({ ok: true, datos });
  } catch (e: any) {
    console.error('extract-remito error:', e);
    return NextResponse.json({
      error: 'No se pudo extraer el remito',
      detalle: e.message,
    }, { status: 500 });
  }
}
