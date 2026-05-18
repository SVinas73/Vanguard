// =====================================================
// POST /api/auth/2fa/enroll
// =====================================================
// Genera un secret TOTP + backup codes para el usuario
// autenticado. Devuelve el otpauth URL para que el cliente
// muestre un QR. Hasta que el usuario llame /api/auth/2fa/verify
// con un código válido, el secret NO se persiste.
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/security/permissions';
import { generarEnrollment, hashBackupCode } from '@/lib/security/totp';
import { chequearRateLimit, extraerIP } from '@/lib/security/rate-limit';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const ip = extraerIP(request);
  const rl = await chequearRateLimit({
    bucket: `2fa:enroll:${auth.user.email}`,
    max: 5, windowSeconds: 3600,
    ip, usuarioEmail: auth.user.email, ruta: '/api/auth/2fa/enroll',
  });
  if (rl.bloqueado) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes de enrollment', retry_after: rl.retryAfterSeconds },
      { status: 429 }
    );
  }

  const enrollment = generarEnrollment(auth.user.email);

  return NextResponse.json({
    secret: enrollment.secret,
    otpauth_url: enrollment.otpauthUrl,
    backup_codes: enrollment.backupCodes,
    backup_codes_hashes: enrollment.backupCodes.map(hashBackupCode),
    instrucciones: 'Escaneá el QR con Google Authenticator o similar. Guardá los backup codes en lugar seguro — son la única forma de recuperar acceso si perdés el teléfono. Después llamá /api/auth/2fa/verify con el código de 6 dígitos para activar 2FA.',
  });
}
