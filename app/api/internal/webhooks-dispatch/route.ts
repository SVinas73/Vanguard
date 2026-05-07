import { NextRequest, NextResponse } from 'next/server';
import { procesarWebhooksPendientes } from '@/lib/api-gateway/webhooks';
import { requireRole } from '@/lib/security/permissions';

// =====================================================
// POST /api/internal/webhooks-dispatch
// =====================================================
// Worker de procesamiento de webhooks pendientes. En vez
// de un cron real (que en este stack no tenemos), el admin
// puede dispararlo manualmente desde la UI o cualquier
// scheduler externo (Vercel Cron, Cloudflare Worker, etc).
//
// También se puede configurar un Supabase Edge Function que
// haga POST acá cada N minutos.
// =====================================================

export async function POST(request: NextRequest) {
  // Modo "service token": permitimos llamar con un secret
  // en header (para crons externos) además del rol admin.
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.WEBHOOKS_CRON_SECRET;

  if (!cronSecret || cronSecret !== expectedSecret) {
    // Si no es cron, requiere admin logueado
    const auth = await requireRole(['admin']);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
  }

  const url = new URL(request.url);
  const limite = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);

  const resultado = await procesarWebhooksPendientes(limite);
  return NextResponse.json({ success: true, ...resultado });
}

// GET para chequear health sin disparar el dispatch
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    hint: 'POST acá con header x-cron-secret para procesar webhooks pendientes',
  });
}
