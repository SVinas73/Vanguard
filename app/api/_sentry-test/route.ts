// =====================================================
// GET /api/_sentry-test
// =====================================================
// Endpoint para verificar que Sentry está correctamente
// integrado. Solo accesible para admins. Tira un error
// que se captura y reporta a Sentry.
//
// Uso:
//   curl https://tu-app.com/api/_sentry-test
//   → debería aparecer un evento en el dashboard de Sentry
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/security/permissions';
import { reportarError } from '@/lib/security/error-reporting';

export async function GET(_request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo admins' }, { status: 403 });
  }

  const error = new Error('Sentry test error desde Vanguard — esto NO es un bug real');
  const eventId = reportarError(error, {
    modulo: 'sistema',
    accion: 'sentry-test',
    tags: { test: 'true' },
    extra: { triggered_by: auth.user.email, timestamp: new Date().toISOString() },
  });

  return NextResponse.json({
    ok: true,
    mensaje: 'Error de prueba enviado a Sentry',
    event_id: eventId,
    instrucciones: eventId
      ? `Buscá este event_id en el dashboard de Sentry: ${eventId}`
      : 'Sentry no está configurado (SENTRY_DSN o NEXT_PUBLIC_SENTRY_DSN faltan en env vars)',
  });
}
