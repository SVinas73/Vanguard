import { supabase } from '@/lib/supabase';
import { getOrganizacionActiva } from './org-context';

// =====================================================
// Tenant-aware query helpers
// =====================================================
// Estos helpers aplican el filtro de organización activa
// del lado del cliente. Funcionan complementariamente al
// RLS de la base (defensa en profundidad).
//
// Uso típico desde un hook/módulo:
//
//   const { data } = await tenantSelect('productos').select('*');
//   await tenantInsert('productos', { codigo: 'A1', nombre: 'X' });
//
// Si la org activa es NULL (legacy mode), no filtra → ve todo.
// =====================================================

/** SELECT con filtro automático por organización activa. */
export function tenantSelect(table: string) {
  const orgId = getOrganizacionActiva();
  const q = supabase.from(table).select('*');
  return orgId ? q.or(`organizacion_id.eq.${orgId},organizacion_id.is.null`) : q;
}

/** INSERT que setea automáticamente la organización activa. */
export async function tenantInsert<T extends Record<string, any>>(
  table: string,
  data: T | T[]
) {
  const orgId = getOrganizacionActiva();
  const payload = Array.isArray(data)
    ? data.map(row => (orgId ? { ...row, organizacion_id: orgId } : row))
    : orgId ? { ...data, organizacion_id: orgId } : data;
  return supabase.from(table).insert(payload as any).select();
}

/** UPDATE limitado a registros de la organización activa. */
export function tenantUpdate(table: string, patch: Record<string, any>) {
  const orgId = getOrganizacionActiva();
  const q = supabase.from(table).update(patch);
  return orgId ? q.eq('organizacion_id', orgId) : q;
}

/** DELETE limitado a registros de la organización activa. */
export function tenantDelete(table: string) {
  const orgId = getOrganizacionActiva();
  const q = supabase.from(table).delete();
  return orgId ? q.eq('organizacion_id', orgId) : q;
}

/**
 * Devuelve el organizacion_id activo o lanza si no hay.
 * Útil cuando una operación REQUIERE estar dentro de una org
 * (ej: crear factura electrónica, generar reporte fiscal).
 */
export function requireOrg(): string {
  const orgId = getOrganizacionActiva();
  if (!orgId) {
    throw new Error('No hay organización activa. Seleccioná una en el header.');
  }
  return orgId;
}
