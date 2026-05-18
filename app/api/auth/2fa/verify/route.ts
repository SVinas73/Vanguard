// =====================================================
// POST /api/auth/2fa/verify
// =====================================================
// Completa el enrollment: recibe el secret pendiente + un
// código válido + los hashes de backup codes. Si el código
// verifica, persiste todo en la fila del usuario.
//
// Body:
//   secret: string (base32, devuelto por /enroll)
//   code: string (6 dígitos)
//   backup_codes_hashes: string[]
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/security/permissions';
import { verificarCodigoTotp } from '@/lib/security/totp';
import { registrarAuditoriaSegura, extraerContextoAudit } from '@/lib/security/audit-enhanced';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const { secret, code, backup_codes_hashes } = body;

  if (typeof secret !== 'string' || typeof code !== 'string' || !Array.isArray(backup_codes_hashes)) {
    return NextResponse.json({ error: 'Body inválido: secret, code y backup_codes_hashes son requeridos' }, { status: 400 });
  }

  if (!verificarCodigoTotp(secret, code)) {
    return NextResponse.json({ error: 'Código TOTP inválido. Verificá que el reloj del teléfono esté sincronizado.' }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { error } = await supabase
    .from('users')
    .update({
      totp_secret: secret,
      totp_enrolled_at: new Date().toISOString(),
      totp_backup_codes: backup_codes_hashes,
    })
    .eq('email', auth.user.email);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await registrarAuditoriaSegura({
    tabla: 'users',
    accion: '2FA_ENROLLED',
    datosNuevos: { email: auth.user.email },
    usuarioEmail: auth.user.email,
    contexto: extraerContextoAudit(request),
  });

  return NextResponse.json({ ok: true, mensaje: '2FA activado correctamente' });
}
