// =====================================================
// Helper: requireTotpCode(request, userEmail)
// =====================================================
// Devuelve { ok: true } si el header `x-totp-code` es válido
// para el usuario. Si el usuario no tiene 2FA enrolled,
// devuelve error 403 con código `2FA_NOT_ENROLLED` para
// que el cliente lleve al flow de enrollment.
// =====================================================

import 'server-only';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verificarCodigoTotp, verificarBackupCode } from './totp';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface TotpCheckResult {
  ok: boolean;
  status?: number;
  error?: string;
  code?: 'MISSING_HEADER' | 'INVALID_CODE' | '2FA_NOT_ENROLLED';
}

export async function requireTotpCode(request: NextRequest, usuarioEmail: string): Promise<TotpCheckResult> {
  const codigo = request.headers.get('x-totp-code');
  if (!codigo) {
    return {
      ok: false,
      status: 401,
      error: 'Falta header x-totp-code. Esta acción requiere 2FA.',
      code: 'MISSING_HEADER',
    };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: user, error } = await supabase
    .from('users')
    .select('totp_secret, totp_enrolled_at, totp_backup_codes')
    .eq('email', usuarioEmail)
    .maybeSingle();

  if (error || !user || !user.totp_secret || !user.totp_enrolled_at) {
    return {
      ok: false,
      status: 403,
      error: 'No tenés 2FA activado. Hacé enrollment primero en /api/auth/2fa/enroll.',
      code: '2FA_NOT_ENROLLED',
    };
  }

  if (verificarCodigoTotp(user.totp_secret, codigo)) {
    return { ok: true };
  }

  const hashes: string[] = user.totp_backup_codes || [];
  const backup = verificarBackupCode(codigo, hashes);
  if (backup.ok && backup.hashUsado) {
    const restantes = hashes.filter(h => h !== backup.hashUsado);
    await supabase
      .from('users')
      .update({ totp_backup_codes: restantes })
      .eq('email', usuarioEmail);
    return { ok: true };
  }

  return {
    ok: false,
    status: 401,
    error: 'Código TOTP inválido',
    code: 'INVALID_CODE',
  };
}
