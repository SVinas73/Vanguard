// =====================================================
// Proveedores de solicitudes de insumos + reglas de aprobación
// =====================================================
// Lista FIJA de proveedores para las solicitudes de insumos y la regla de
// quién puede APROBAR (pendiente → en_gestion) según el proveedor.
//
// Reglas (definidas por negocio):
//   - MERCADO LIBRE  → solo Gonzalo (gdecia@ingcotools.com.uy).
//   - YNTER INDUSTRIAL → solo Gonzalo.
//   - TYT DE MARTINI / ESTACION HOGAR / OTRO → cualquier usuario.
//
// La GESTIÓN del resto del flujo (comprada/recibida/cerrada/cancelar) no exige
// rol admin. EDITAR la solicitud sí es exclusivo de admins (ver API).

export interface ProveedorInsumo {
  value: string;   // se guarda tal cual en solicitudes_insumos.proveedor
  label: string;   // lo que ve el usuario
}

export const PROVEEDORES_INSUMO: ProveedorInsumo[] = [
  { value: 'TYT DE MARTINI', label: 'TyT De Martini' },
  { value: 'YNTER INDUSTRIAL', label: 'Ynter Industrial' },
  { value: 'MERCADO LIBRE', label: 'Mercado Libre' },
  { value: 'ESTACION HOGAR', label: 'Estación Hogar' },
  { value: 'OTRO', label: 'Otro proveedor' },
];

export const PROVEEDOR_OTRO = 'OTRO';

// Email del único aprobador permitido para ciertos proveedores.
// (Gonzalo todavía no tiene cuenta; queda seteado para cuando se cree.)
export const APROBADOR_GONZALO = 'gdecia@ingcotools.com.uy';

// Emails de PRUEBA que también pueden aprobar como Gonzalo (para testear el
// flujo antes de que Gonzalo use su cuenta). Quitar cuando ya no haga falta.
export const APROBADORES_PRUEBA = ['santi231194@hotmail.com'];

// Proveedores cuya aprobación es EXCLUSIVA de un conjunto puntual de emails.
export const APROBADORES_EXCLUSIVOS: Record<string, string[]> = {
  'MERCADO LIBRE': [APROBADOR_GONZALO, ...APROBADORES_PRUEBA],
  'YNTER INDUSTRIAL': [APROBADOR_GONZALO, ...APROBADORES_PRUEBA],
};

/** Lista de emails habilitados para aprobar este proveedor, o null si lo aprueba cualquiera. */
export function aprobadoresRequeridos(proveedor?: string | null): string[] | null {
  if (!proveedor) return null;
  return APROBADORES_EXCLUSIVOS[proveedor] ?? null;
}

/** Texto legible del/los aprobador(es) requerido(s), o null si lo aprueba cualquiera. */
export function aprobadorRequerido(proveedor?: string | null): string | null {
  const lista = aprobadoresRequeridos(proveedor);
  if (!lista || lista.length === 0) return null;
  // Mostramos el aprobador "oficial" (Gonzalo); los de prueba son internos.
  return lista[0];
}

/** ¿Este email puede APROBAR (pendiente→en_gestion) una solicitud de este proveedor? */
export function puedeAprobarProveedor(proveedor: string | null | undefined, email: string | null | undefined): boolean {
  const requeridos = aprobadoresRequeridos(proveedor);
  if (!requeridos) return true; // cualquiera
  const e = (email || '').trim().toLowerCase();
  return requeridos.some(r => r.toLowerCase() === e);
}

/** Etiqueta legible del proveedor (usa el nombre libre si es OTRO). */
export function labelProveedor(proveedor?: string | null, proveedorNombre?: string | null): string {
  if (!proveedor) return '—';
  if (proveedor === PROVEEDOR_OTRO) return proveedorNombre?.trim() || 'Otro proveedor';
  return PROVEEDORES_INSUMO.find(p => p.value === proveedor)?.label ?? proveedor;
}
