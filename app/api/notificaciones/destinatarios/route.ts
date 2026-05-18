// =====================================================
// /api/notificaciones/destinatarios
// =====================================================
// GET  → lista destinatarios configurados por evento para
//        la organización del usuario
// POST → upsert: { evento, emails[], enviar_email, notif_in_app }
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/security/permissions';
import { registrarAuditoriaSegura, extraerContextoAudit } from '@/lib/security/audit-enhanced';
import { z } from 'zod';
import { parseSafe } from '@/lib/security/zod-schemas';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const EVENTOS_VALIDOS = ['orden_compra_creada'] as const;

const upsertSchema = z.object({
  organizacion_id: z.string().uuid(),
  evento: z.enum(EVENTOS_VALIDOS),
  emails: z.array(z.string().email()).max(20),
  enviar_email: z.boolean().default(true),
  notif_in_app: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const orgId = request.nextUrl.searchParams.get('organizacion_id');
  if (!orgId) return NextResponse.json({ error: 'organizacion_id requerido' }, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from('org_notification_recipients')
    .select('*')
    .eq('organizacion_id', orgId)
    .order('evento');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ destinatarios: data || [], eventos_disponibles: EVENTOS_VALIDOS });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (auth.user.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo admins pueden configurar destinatarios' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = parseSafe(upsertSchema, body);
  if (!parsed.ok) return NextResponse.json(parsed, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Upsert por (organizacion_id, evento)
  const { data, error } = await supabase
    .from('org_notification_recipients')
    .upsert(
      {
        organizacion_id: parsed.data.organizacion_id,
        evento: parsed.data.evento,
        emails: parsed.data.emails,
        enviar_email: parsed.data.enviar_email,
        notif_in_app: parsed.data.notif_in_app,
      },
      { onConflict: 'organizacion_id,evento' },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await registrarAuditoriaSegura({
    tabla: 'org_notification_recipients',
    accion: 'CONFIGURAR',
    codigo: parsed.data.evento,
    datosNuevos: {
      organizacion_id: parsed.data.organizacion_id,
      evento: parsed.data.evento,
      destinatarios_count: parsed.data.emails.length,
    },
    usuarioEmail: auth.user.email,
    contexto: extraerContextoAudit(request),
  });

  return NextResponse.json({ ok: true, destinatario: data });
}
