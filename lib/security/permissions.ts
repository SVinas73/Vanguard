import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-config';

// =====================================================
// Permisos backend (server-side)
// =====================================================
// Hasta ahora los permisos vivían SOLO en UI
// (hooks/useAuth.hasPermission). Eso protege la
// experiencia pero NO protege los endpoints — un
// atacante puede llamar /api/* directo.
//
// Esta capa duplica el chequeo en el server: cada
// endpoint sensible debe llamar a `requirePermission()`
// antes de ejecutar la acción.
// =====================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export type RolUsuario = 'admin' | 'vendedor' | 'bodeguero' | 'operador';

// Mismo mapping que types/index.ts.ROLE_PERMISSIONS pero
// tipado para uso server-side.
const PERMISSIONS_BY_ROLE: Record<RolUsuario, Set<string>> = {
  admin: new Set([
    'canCreateProducts', 'canEditProducts', 'canDeleteProducts',
    'canViewCosts', 'canViewAudit', 'canViewReports',
    'canViewFinanzas', 'canViewTaller', 'canViewWMS',
    'canViewProyectos', 'canViewComercial', 'canViewDemand',
    'canViewSeriales', 'canViewRMA', 'canViewBOM', 'canViewQMS',
    'canExportData', 'canManageUsers', 'canApprove',
    'canDeleteAuditLogs', 'canConfigureSystem', 'canEmitirCFE',
  ]),
  vendedor: new Set([
    'canCreateProducts', 'canEditProducts',
    'canViewReports', 'canViewComercial', 'canViewDemand',
    'canViewRMA', 'canExportData',
  ]),
  bodeguero: new Set([
    'canViewWMS', 'canCreateProducts', 'canEditProducts',
    'canViewSeriales',
  ]),
  operador: new Set([
    'canViewTaller', 'canViewProyectos', 'canViewBOM',
  ]),
};

export interface UsuarioServer {
  email: string;
  rol: RolUsuario;
  name?: string;
}

/**
 * Obtiene el usuario autenticado desde la sesión NextAuth.
 * Devuelve null si no hay sesión válida.
 */
export async function getUsuarioActual(): Promise<UsuarioServer | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  // Resolver el rol real desde DB (la sesión puede estar
  // desactualizada).
  const { data } = await supabase
    .from('users')
    .select('email, name, role, activo')
    .eq('email', session.user.email)
    .maybeSingle();

  if (!data || data.activo === false) return null;

  return {
    email: data.email,
    rol: (data.role as RolUsuario) || 'operador',
    name: data.name,
  };
}

/**
 * Verifica si un rol tiene un permiso. Pure function.
 */
export function tienePermiso(rol: RolUsuario, permiso: string): boolean {
  const set = PERMISSIONS_BY_ROLE[rol];
  return set?.has(permiso) ?? false;
}

/**
 * Devuelve { ok, user } o { ok: false, error, status } para
 * usar directo en API routes.
 *
 *   const auth = await requirePermission('canViewFinanzas');
 *   if (!auth.ok) return NextResponse.json({error:auth.error}, {status:auth.status});
 *   // ahora podés usar auth.user
 */
export async function requirePermission(permiso: string): Promise<
  | { ok: true; user: UsuarioServer }
  | { ok: false; error: string; status: number }
> {
  const user = await getUsuarioActual();
  if (!user) {
    return { ok: false, error: 'No autenticado', status: 401 };
  }
  if (!tienePermiso(user.rol, permiso)) {
    return {
      ok: false,
      error: `Tu rol "${user.rol}" no tiene el permiso "${permiso}"`,
      status: 403,
    };
  }
  return { ok: true, user };
}

/**
 * Variante: solo requiere autenticación, sin permiso
 * específico. Útil para endpoints que validan permisos
 * de forma más fina internamente.
 */
export async function requireAuth(): Promise<
  | { ok: true; user: UsuarioServer }
  | { ok: false; error: string; status: number }
> {
  const user = await getUsuarioActual();
  if (!user) return { ok: false, error: 'No autenticado', status: 401 };
  return { ok: true, user };
}

/**
 * Solo permite roles específicos.
 *
 *   const auth = await requireRole(['admin']);
 */
export async function requireRole(roles: RolUsuario[]): Promise<
  | { ok: true; user: UsuarioServer }
  | { ok: false; error: string; status: number }
> {
  const user = await getUsuarioActual();
  if (!user) return { ok: false, error: 'No autenticado', status: 401 };
  if (!roles.includes(user.rol)) {
    return {
      ok: false,
      error: `Acceso denegado. Roles permitidos: ${roles.join(', ')}`,
      status: 403,
    };
  }
  return { ok: true, user };
}
