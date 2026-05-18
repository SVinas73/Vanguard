import { describe, it, expect } from 'vitest';
import { authenticator } from 'otplib';
import { generarEnrollment, verificarCodigoTotp, hashBackupCode, verificarBackupCode } from '../security/totp';

describe('TOTP 2FA', () => {
  it('generarEnrollment devuelve secret + url + 8 backup codes', () => {
    const e = generarEnrollment('admin@test.com');
    expect(e.secret).toMatch(/^[A-Z2-7]+$/);
    expect(e.otpauthUrl).toContain('otpauth://totp/');
    expect(e.otpauthUrl).toContain('admin%40test.com');
    expect(e.backupCodes).toHaveLength(8);
    expect(e.backupCodes[0]).toMatch(/^[a-f0-9]{10}$/);
  });

  it('verificarCodigoTotp valida un código actual', () => {
    const e = generarEnrollment('admin@test.com');
    const codigo = authenticator.generate(e.secret);
    expect(verificarCodigoTotp(e.secret, codigo)).toBe(true);
  });

  it('verificarCodigoTotp rechaza código inválido', () => {
    const e = generarEnrollment('admin@test.com');
    expect(verificarCodigoTotp(e.secret, '000000')).toBe(false);
  });

  it('verificarBackupCode acepta un código guardado', () => {
    const code = 'abcdef1234';
    const hashes = [hashBackupCode('otro'), hashBackupCode(code)];
    const r = verificarBackupCode(code, hashes);
    expect(r.ok).toBe(true);
    expect(r.hashUsado).toBe(hashBackupCode(code));
  });

  it('verificarBackupCode rechaza código no guardado', () => {
    const hashes = [hashBackupCode('uno'), hashBackupCode('dos')];
    expect(verificarBackupCode('tres', hashes).ok).toBe(false);
  });
});
