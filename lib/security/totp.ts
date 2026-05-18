// =====================================================
// TOTP 2FA — server-only helpers
// =====================================================
// Wrapping de `otplib` para Vanguard. Permite:
//   - generar secret + URL de QR (enrollment)
//   - verificar código de 6 dígitos
//   - generar/consumir backup codes
//
// Para usar en API routes que necesitan 2FA, ver
// `requireTotpCode()` en require-totp.ts.
// =====================================================

import 'server-only';
import { authenticator } from 'otplib';
import crypto from 'crypto';

authenticator.options = {
  step: 30,
  window: 1,
  digits: 6,
};

const APP_NAME = 'Vanguard ERP';

export interface EnrollmentData {
  secret: string;
  otpauthUrl: string;
  backupCodes: string[];
}

export function generarEnrollment(usuarioEmail: string): EnrollmentData {
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(usuarioEmail, APP_NAME, secret);
  const backupCodes = generarBackupCodes(8);
  return { secret, otpauthUrl, backupCodes };
}

function generarBackupCodes(cantidad: number): string[] {
  const codes: string[] = [];
  for (let i = 0; i < cantidad; i++) {
    codes.push(crypto.randomBytes(5).toString('hex'));
  }
  return codes;
}

export function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim().toLowerCase()).digest('hex');
}

export function verificarCodigoTotp(secret: string, code: string): boolean {
  try {
    return authenticator.check(code.trim(), secret);
  } catch {
    return false;
  }
}

export function verificarBackupCode(code: string, hashesGuardados: string[]): { ok: boolean; hashUsado?: string } {
  const hashIngresado = hashBackupCode(code);
  if (hashesGuardados.includes(hashIngresado)) {
    return { ok: true, hashUsado: hashIngresado };
  }
  return { ok: false };
}
