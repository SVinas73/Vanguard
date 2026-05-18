// =====================================================
// Error reporting — wrapper sobre Sentry
// =====================================================
// Centraliza el reporting de errores para:
//   1. Si Sentry no está configurado, no romper nada
//   2. Aplicar scrubbing de PII consistente
//   3. Agregar contexto de Vanguard (organización, módulo)
//
// Importable tanto en cliente como en servidor.
// =====================================================

import * as Sentry from '@sentry/nextjs';

export interface UserContext {
  email: string;
  rol?: string;
  organizacionId?: string;
}

export interface ErrorContext {
  /** Módulo de Vanguard (ej: 'comercial', 'wms') */
  modulo?: string;
  /** Acción en curso (ej: 'crear-orden', 'export-gdpr') */
  accion?: string;
  /** Datos adicionales no sensibles para debugging */
  extra?: Record<string, unknown>;
  /** Tags estructurados (no en extra para que sean searchables) */
  tags?: Record<string, string>;
}

/**
 * Sentry guarda el `id` (que mostramos en UI) y el `rol`/`organizacionId`
 * como tags. El email NO se manda como `email` porque eso activa lookup
 * en Gravatar; lo enviamos como tag scrubbed.
 */
export function setUsuario(user: UserContext | null) {
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({
    id: user.email,
    username: anonimizarEmail(user.email),
  });
  if (user.rol) Sentry.setTag('user.rol', user.rol);
  if (user.organizacionId) Sentry.setTag('organizacion_id', user.organizacionId);
}

/**
 * Reporta un error a Sentry con contexto adicional de Vanguard.
 * Devuelve el event_id para que puedas mostrarlo al usuario
 * ("Error ID: abc123") y referenciar en soporte.
 */
export function reportarError(error: unknown, ctx?: ErrorContext): string | undefined {
  const eventId = Sentry.captureException(error, scope => {
    if (ctx?.modulo) scope.setTag('modulo', ctx.modulo);
    if (ctx?.accion) scope.setTag('accion', ctx.accion);
    if (ctx?.tags) {
      for (const [k, v] of Object.entries(ctx.tags)) scope.setTag(k, v);
    }
    if (ctx?.extra) {
      for (const [k, v] of Object.entries(ctx.extra)) scope.setExtra(k, v);
    }
    return scope;
  });
  return eventId;
}

/**
 * Reporta un evento informativo (no error). Útil para tracking de
 * cosas raras que no son bugs pero querés monitorear.
 */
export function reportarEvento(mensaje: string, ctx?: ErrorContext, nivel: Sentry.SeverityLevel = 'info') {
  Sentry.captureMessage(mensaje, scope => {
    scope.setLevel(nivel);
    if (ctx?.modulo) scope.setTag('modulo', ctx.modulo);
    if (ctx?.accion) scope.setTag('accion', ctx.accion);
    if (ctx?.tags) for (const [k, v] of Object.entries(ctx.tags)) scope.setTag(k, v);
    if (ctx?.extra) for (const [k, v] of Object.entries(ctx.extra)) scope.setExtra(k, v);
    return scope;
  });
}

/**
 * Convierte "juan.perez@empresa.com" → "j***@empresa.com" para
 * no leakear emails completos en los reports.
 */
function anonimizarEmail(email: string): string {
  const [local, dominio] = email.split('@');
  if (!local || !dominio) return '[email]';
  return `${local[0]}***@${dominio}`;
}
