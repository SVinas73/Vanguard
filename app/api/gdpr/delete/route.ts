// =====================================================
// GDPR — Solicitud de borrado (derecho al olvido)
// =====================================================
// Crea una solicitud que un admin debe revisar y procesar
// manualmente. NO borra automáticamente porque hay datos
// de cumplimiento legal (facturas, asientos contables) que
// no se pueden eliminar — solo se anonimizan.
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/security/permissions';
import { parseSafe, gdprSchema } from '@/lib/security/zod-schemas';
import { chequearRateLimit, extraerIP } from '@/lib/security/rate-limit';
import { registrarAuditoriaSegura, extraerContextoAudit } from '@/lib/security/audit-enhanced';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const parsed = parseSafe(gdprSchema, body);
  if (!parsed.ok) return NextResponse.json(parsed, { status: 400 });

  const target = parsed.data.usuario_email;

  // El propio usuario o un admin
  if (auth.user.email !== target && auth.user.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo podés solicitar borrado de tu propio usuario' }, { status: 403 });
  }

  // Rate limit estricto: max 1 solicitud por día
  const ip = extraerIP(request);
  const rl = await chequearRateLimit({
    bucket: `gdpr:delete:${target}`,
    max: 1, windowSeconds: 86400,
    ip, usuarioEmail: auth.user.email, ruta: '/api/gdpr/delete',
  });
  if (rl.bloqueado) {
    return NextResponse.json(
      { error: 'Ya hay una solicitud pendiente para este usuario' },
      { status: 429 }
    );
  }

  // Crear solicitud (queda pendiente para que admin la procese)
  const { data: solicitud, error } = await supabase
    .from('gdpr_solicitudes')
    .insert({
      tipo: 'delete',
      usuario_email: target,
      solicitado_por: auth.user.email,
      estado: 'pendiente',
      motivo: parsed.data.motivo || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await registrarAuditoriaSegura({
    tabla: 'gdpr_solicitudes',
    accion: 'SOLICITAR_DELETE',
    codigo: solicitud.id,
    datosNuevos: { usuario_target: target, motivo: parsed.data.motivo },
    usuarioEmail: auth.user.email,
    contexto: extraerContextoAudit(request),
  });

  return NextResponse.json({
    ok: true,
    solicitud_id: solicitud.id,
    estado: 'pendiente',
    mensaje: 'La solicitud de borrado fue registrada. Un administrador la revisará y procesará. Algunos datos legales (facturas, contabilidad) pueden no eliminarse y solo se anonimizarán.',
  });
}
