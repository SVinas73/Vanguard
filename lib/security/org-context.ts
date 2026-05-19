import { supabase } from '@/lib/supabase';

// =====================================================
// Multi-tenant: contexto de organización activa
// =====================================================
// Patrón:
//   1. Usuario se loguea (NextAuth/Supabase auth)
//   2. App lee su organización default de `usuario_organizacion`
//   3. App setea el claim 'organizacion_id' en localStorage
//   4. Cada query a Supabase incluye el claim vía JWT
//   5. RLS en DB filtra automáticamente por current_organizacion_id()
//
// Si el usuario no tiene organización (legacy users) → opera sin
// filtro de tenant (compat con instalaciones single-tenant).
// =====================================================

const STORAGE_KEY = 'vanguard-current-org';

export interface Organizacion {
  id: string;
  nombre: string;
  slug: string | null;
  rut: string | null;
  pais: string;
  moneda: string;
  plan: 'starter' | 'business' | 'enterprise';
  estado: 'activa' | 'suspendida' | 'baja';
  logo_url: string | null;
}

export interface UsuarioOrganizacion {
  organizacion_id: string;
  organizacion: Organizacion;
  rol: 'owner' | 'admin' | 'miembro' | 'viewer';
  es_default: boolean;
}

/** Lista las organizaciones a las que pertenece el usuario actual. */
export async function listarMisOrganizaciones(email: string): Promise<UsuarioOrganizacion[]> {
  const { data, error } = await supabase
    .from('usuario_organizacion')
    .select('organizacion_id, rol, es_default, organizacion:organizaciones(*)')
    .eq('usuario_email', email)
    .order('es_default', { ascending: false });
  if (error || !data) return [];
  return data as unknown as UsuarioOrganizacion[];
}

/** Devuelve la org activa del usuario (default o seleccionada manualmente). */
export function getOrganizacionActiva(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
}

/** Setea la organización activa. La próxima request al backend la usa. */
export function setOrganizacionActiva(orgId: string | null) {
  if (typeof window === 'undefined') return;
  if (orgId) {
    localStorage.setItem(STORAGE_KEY, orgId);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  // Disparamos un evento para que los componentes recarguen sus datos
  window.dispatchEvent(new CustomEvent('vg:org-changed', { detail: { orgId } }));
}

/**
 * Inicializa la organización al login.
 * Si el usuario tiene una sola org, la setea como activa.
 * Si tiene varias, deja la que esté marcada como default.
 * Si no tiene, queda null (legacy mode).
 */
export async function inicializarOrganizacion(email: string): Promise<Organizacion | null> {
  const orgs = await listarMisOrganizaciones(email);
  if (orgs.length === 0) {
    setOrganizacionActiva(null);
    return null;
  }
  const current = getOrganizacionActiva();
  // Si ya hay una activa y todavía pertenece, mantenerla
  if (current && orgs.some(o => o.organizacion_id === current)) {
    return orgs.find(o => o.organizacion_id === current)!.organizacion;
  }
  // Sino, la default (o la primera)
  const elegida = orgs.find(o => o.es_default) ?? orgs[0];
  setOrganizacionActiva(elegida.organizacion_id);
  return elegida.organizacion;
}

/**
 * Crea una nueva organización + agrega al usuario como owner.
 * Llama al endpoint server-side que bypasa RLS (el cliente no puede
 * leer la org recién creada por la policy organizaciones_select).
 */
export async function crearOrganizacion(args: {
  nombre: string;
  slug?: string;
  rut?: string;
  pais?: string;
  moneda?: string;
  ownerEmail: string;
}): Promise<{ org: Organizacion | null; error: string | null }> {
  try {
    const resp = await fetch('/api/organizaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: args.nombre,
        slug: args.slug || null,
        rut: args.rut || null,
        pais: args.pais || 'UY',
        moneda: args.moneda || 'UYU',
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      console.error('crearOrganizacion error:', data);
      return {
        org: null,
        error: data?.error || data?.hint || `Error HTTP ${resp.status}`,
      };
    }
    setOrganizacionActiva(data.organizacion.id);
    return { org: data.organizacion as Organizacion, error: null };
  } catch (e: any) {
    console.error('crearOrganizacion network error:', e);
    return { org: null, error: e?.message || 'Error de red' };
  }
}
