'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut as nextAuthSignOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { UserRole, ROLE_PERMISSIONS } from '@/types';

interface AuthUser {
  id: string;
  email: string;
  nombre?: string;
  rol: UserRole;
}

type PermissionKey = 
  | 'canCreateProducts'
  | 'canEditProducts'
  | 'canDeleteProducts'
  | 'canCreateMovements'
  | 'canMakeEntradas'
  | 'canMakeSalidas'
  | 'canViewCosts'
  | 'canViewAudit'
  | 'canViewReports'
  | 'canManageUsers';

export function useAuth(redirectIfNotAuth: boolean = true) {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<AuthUser | null>(null);
  const router = useRouter();

  useEffect(() => {
    const loadUser = async () => {
      if (status === 'loading') {
        return;
      }

      if (status === 'unauthenticated') {
        setUser(null);
        if (redirectIfNotAuth) {
          router.push('/login');
        }
        return;
      }

      if (status === 'authenticated' && session?.user) {
        try {
          const userId = (session.user as any).id;
          
          // Obtener el perfil con el rol desde Supabase
          const { data: profile } = await supabase
            .from('users')
            .select('rol, name')
            .eq('id', userId)
            .single();

          const authUser: AuthUser = {
            id: userId,
            email: session.user.email || '',
            rol: (profile?.rol as UserRole) || 'vendedor',
            nombre: profile?.name || session.user.name || session.user.email || '',
          };

          setUser(authUser);
        } catch (error) {
          console.error('Error fetching user profile:', error);
          // Si falla, usar datos de la sesión
          setUser({
            id: (session.user as any).id,
            email: session.user.email || '',
            rol: 'vendedor',
            nombre: session.user.name || session.user.email || '',
          });
        }
      }
    };

    loadUser();
  }, [session, status, router, redirectIfNotAuth]);

  const signOut = async () => {
    await nextAuthSignOut({ redirect: false });
    router.push('/login');
  };

  // Helper para verificar permisos
  const hasPermission = (permission: PermissionKey): boolean => {
    if (!user?.rol) return false;
    const rolePermissions = ROLE_PERMISSIONS[user.rol];
    if (!rolePermissions) return false;
    return rolePermissions[permission] ?? false;
  };

  const loading = status === 'loading';

  return { 
    user, 
    loading,
    signOut, 
    hasPermission,
    rol: user?.rol || 'vendedor',
    isAdmin: user?.rol === 'admin',
  };
}