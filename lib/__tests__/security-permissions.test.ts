import { describe, it, expect } from 'vitest';
import { tienePermiso, type RolUsuario } from '@/lib/security/permissions';

describe('permissions — tienePermiso', () => {
  it('admin tiene canManageUsers', () => {
    expect(tienePermiso('admin', 'canManageUsers')).toBe(true);
  });

  it('admin tiene canViewFinanzas', () => {
    expect(tienePermiso('admin', 'canViewFinanzas')).toBe(true);
  });

  it('vendedor NO tiene canViewFinanzas (acceso financiero restringido)', () => {
    expect(tienePermiso('vendedor', 'canViewFinanzas')).toBe(false);
  });

  it('bodeguero tiene canViewWMS', () => {
    expect(tienePermiso('bodeguero', 'canViewWMS')).toBe(true);
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
        canViewFinanzas: true, canViewAudit: true, canApprove: true,
        canManageUsers: true, canEmitirCFE: true,
      },
    },
    {
      rol: 'vendedor',
      permisos: {
        canViewFinanzas: false, canViewComercial: true, canViewDemand: true,
        canViewRMA: true, canManageUsers: false,
      },
    },
    {
      rol: 'bodeguero',
      permisos: {
        canViewWMS: true, canViewSeriales: true,
        canViewFinanzas: false, canViewComercial: false,
      },
    },
    {
      rol: 'operador',
      permisos: {
        canViewTaller: true, canViewProyectos: true, canViewBOM: true,
        canViewFinanzas: false, canApprove: false,
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
