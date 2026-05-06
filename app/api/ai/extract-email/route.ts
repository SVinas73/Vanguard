import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { extraerEmail } from '@/lib/ai-extraction';
import { requireAuth } from '@/lib/security/permissions';
import { chequearRateLimit, extraerIP } from '@/lib/security/rate-limit';
import { registrarAuditoriaSegura, extraerContextoAudit } from '@/lib/security/audit-enhanced';
import { parseSafe } from '@/lib/security/zod-schemas';

const bodySchema = z.object({
  texto: z.string().min(20, 'El email es demasiado corto').max(20000, 'El email es demasiado largo (>20000 chars)'),
});

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const ip = extraerIP(request);
  const rl = await chequearRateLimit({
    bucket: `ai-extract-email:${auth.user.email}`,
    max: 30, windowSeconds: 3600,
    ip, usuarioEmail: auth.user.email, ruta: '/api/ai/extract-email',
  });
  if (rl.bloqueado) {
    return NextResponse.json(
      { error: 'Demasiadas extracciones', retry_after: rl.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds || 60) } }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = parseSafe(bodySchema, body);
  if (!parsed.ok) return NextResponse.json(parsed, { status: 400 });

  try {
    const datos = await extraerEmail(parsed.data.texto);

    await registrarAuditoriaSegura({
      tabla: 'ai_extracciones',
      accion: 'EXTRAER_EMAIL',
      datosNuevos: {
        tipo: datos.tipo,
        urgencia: datos.urgencia,
        confianza: datos.confianza,
        long: parsed.data.texto.length,
      },
      usuarioEmail: auth.user.email,
      contexto: extraerContextoAudit(request),
    });

    return NextResponse.json({ ok: true, datos });
  } catch (e: any) {
    console.error('extract-email error:', e);
    return NextResponse.json({
      error: 'No se pudo procesar el email',
      detalle: e.message,
    }, { status: 500 });
  }
}
