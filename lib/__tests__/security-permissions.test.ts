import { describe, it, expect } from 'vitest';
import { tienePermiso, type RolUsuario } from '@/lib/security/permissions';

describe('permissions — tienePermiso', () => {
  it('admin tiene canManageUsers', () => {
    expect(tienePermiso('admin', 'canManageUsers')).toBe(true);
  });

  it('admin tiene canViewAudit', () => {
    expect(tienePermiso('admin', 'canViewAudit')).toBe(true);
  });

  it('vendedor NO tiene canViewAudit (auditoría restringida)', () => {
    expect(tienePermiso('vendedor', 'canViewAudit')).toBe(false);
  });

  it('bodeguero tiene canViewSeriales', () => {
    expect(tienePermiso('bodeguero', 'canViewSeriales')).toBe(true);
  });

  it('bodeguero NO tiene canViewComercial', () => {
    expect(tienePermiso('bodeguero', 'canViewComercial')).toBe(false);
  });

  it('operador tiene canViewTaller', () => {
    expect(tienePermiso('operador', 'canViewTaller')).toBe(true);
  });

  it('operador NO tiene canManageUsers', () => {
    expect(tienePermiso('operador', 'canManageUsers')).toBe(false);
  });

  it('rol inexistente no tiene ningún permiso', () => {
    expect(tienePermiso('superuser' as RolUsuario, 'canManageUsers')).toBe(false);
  });

  it('permiso inexistente devuelve false aunque seas admin', () => {
    expect(tienePermiso('admin', 'permiso_inexistente_xyz')).toBe(false);
  });

  // Tabla de capacidades — checks rápidos por rol
  const capacidades: Array<{ rol: RolUsuario; permisos: Record<string, boolean> }> = [
    {
      rol: 'admin',
      permisos: {
        canViewAudit: true, canDeleteAuditLogs: true,
        canManageUsers: true, canViewComercial: true,
      },
    },
    {
      rol: 'vendedor',
      permisos: {
        canViewAudit: false, canViewComercial: true,
        canViewRMA: true, canManageUsers: false,
      },
    },
    {
      rol: 'bodeguero',
      permisos: {
        canViewSeriales: true,
        canViewAudit: false, canViewComercial: false,
      },
    },
    {
      rol: 'operador',
      permisos: {
        canViewTaller: true,
        canViewAudit: false, canDeleteAuditLogs: false,
      },
    },
  ];

  capacidades.forEach(({ rol, permisos }) => {
    Object.entries(permisos).forEach(([permiso, expected]) => {
      it(`${rol}.${permiso} = ${expected}`, () => {
        expect(tienePermiso(rol, permiso)).toBe(expected);
      });
    });
  });
});
