'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { UserRole, ROLE_PERMISSIONS } from '@/types';

interface AuthUser extends User {
  rol: UserRole;
  nombre?: string;
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

// Cache del usuario en localStorage
const USER_CACHE_KEY = 'vanguard_user_cache';

function cacheUser(user: AuthUser | null) {
  try {
    if (user) {
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify({
        id: user.id,
        email: user.email,
        rol: user.rol,
        nombre: user.nombre,
      }));
    }
  } catch (error) {
    console.error('Error caching user:', error);
  }
}

function getCachedUser(): Partial<AuthUser> | null {
  try {
    const cached = localStorage.getItem(USER_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    return null;
  }
}

export function useAuth(redirectIfNotAuth: boolean = true) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const getSession = async () => {
      // Si no hay conexión, usar cache inmediatamente
      if (!navigator.onLine) {
        const cachedUser = getCachedUser();
        if (cachedUser && cachedUser.id) {
          setUser(cachedUser as AuthUser);
          setLoading(false);
          return;
        } else {
          // No hay cache ni conexión
          setLoading(false);
          return;
        }
      }

      try {
        // Timeout de 5 segundos para no quedarse cargando
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 5000)
        );
        
        const sessionPromise = supabase.auth.getSession();
        
        const { data: { session } } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as any;
        
        if (session?.user) {
          // Obtener el perfil con el rol
          const { data: profile } = await supabase
            .from('perfiles')
            .select('rol, nombre')
            .eq('id', session.user.id)
            .single();

          const authUser: AuthUser = {
            ...session.user,
            rol: (profile?.rol as UserRole) || 'vendedor',
            nombre: profile?.nombre || session.user.email,
          };

          setUser(authUser);
          cacheUser(authUser);
        } else {
          setUser(null);
          if (redirectIfNotAuth) {
            router.push('/login');
          }
        }
      } catch (error) {
        // Si falla o timeout, intentar usar cache
        const cachedUser = getCachedUser();
        if (cachedUser && cachedUser.id) {
          setUser(cachedUser as AuthUser);
        } else if (redirectIfNotAuth && navigator.onLine) {
          router.push('/login');
        }
      }
      
      setLoading(false);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          try {
            const { data: profile } = await supabase
              .from('perfiles')
              .select('rol, nombre')
              .eq('id', session.user.id)
              .single();

            const authUser: AuthUser = {
              ...session.user,
              rol: (profile?.rol as UserRole) || 'vendedor',
              nombre: profile?.nombre || session.user.email,
            };

            setUser(authUser);
            cacheUser(authUser);
          } catch (error) {
            // Si falla, mantener el usuario de sesión con rol por defecto
            setUser({
              ...session.user,
              rol: 'vendedor',
              nombre: session.user.email,
            });
          }
        } else {
          setUser(null);
          if (event === 'SIGNED_OUT' && redirectIfNotAuth) {
            router.push('/login');
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [router, redirectIfNotAuth]);

  const signOut = async () => {
    try {
      localStorage.removeItem(USER_CACHE_KEY);
    } catch (error) {}
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Helper para verificar permisos
  const hasPermission = (permission: PermissionKey): boolean => {
    if (!user?.rol) return false;
    const rolePermissions = ROLE_PERMISSIONS[user.rol];
    if (!rolePermissions) return false;
    return rolePermissions[permission] ?? false;
  };

  return { 
    user, 
    loading, 
    signOut, 
    hasPermission,
    rol: user?.rol || 'vendedor',
    isAdmin: user?.rol === 'admin',
  };
}