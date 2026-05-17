// =====================================================
// Error tracking — capa minimal sin dependencias
// =====================================================
// Si SENTRY_DSN está set, envía errores al endpoint /api/store
// de Sentry. Si no, no hace nada (silencioso, no rompe nada).
//
// Diseñado para ser reemplazado por @sentry/nextjs cuando el
// proyecto madure, manteniendo la misma API pública.
// =====================================================

interface ErrorContext {
  user?: { id?: string; email?: string };
  tags?: Record<string, string>;
  extra?: Record<string, any>;
  level?: 'fatal' | 'error' | 'warning' | 'info';
}

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV || 'development';

// Parse DSN → { url, key, project_id }. Sentry DSN format:
//   https://<key>@<host>/<project_id>
function parseDsn(dsn: string) {
  try {
    const m = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(\d+)$/);
    if (!m) return null;
    return {
      key: m[1],
      host: m[2],
      projectId: m[3],
      storeUrl: `https://${m[2]}/api/${m[3]}/store/`,
    };
  } catch {
    return null;
  }
}

const dsnParts = SENTRY_DSN ? parseDsn(SENTRY_DSN) : null;

/**
 * Captura un error. Si SENTRY_DSN está configurado, lo envía a Sentry.
 * En desarrollo (sin DSN) sólo hace console.error.
 */
export function captureError(error: Error | unknown, context: ErrorContext = {}) {
  // Siempre log en consola para que el dev lo vea
  console.error('[error-tracking]', error, context);

  if (!dsnParts) return; // sin DSN configurado, no envía

  const err = error instanceof Error ? error : new Error(String(error));
  const payload = {
    event_id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
    timestamp: new Date().toISOString(),
    level: context.level ?? 'error',
    platform: typeof window === 'undefined' ? 'node' : 'javascript',
    environment: ENVIRONMENT,
    server_name: typeof window === 'undefined' ? 'vanguard-server' : 'vanguard-client',
    exception: {
      values: [{
        type: err.name,
        value: err.message,
        stacktrace: err.stack ? { frames: parseStack(err.stack) } : undefined,
      }],
    },
    user: context.user,
    tags: context.tags,
    extra: context.extra,
  };

  // Fire-and-forget: no bloquea la app si Sentry está caído
  try {
    fetch(dsnParts.storeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth':
          `Sentry sentry_version=7, sentry_client=vanguard/1.0, sentry_key=${dsnParts.key}`,
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {}); // no propagar errores del propio tracker
  } catch {
    // ignored
  }
}

function parseStack(stack: string) {
  return stack
    .split('\n')
    .slice(1, 20)
    .map(line => {
      const m = line.match(/at (.+?) \((.+?):(\d+):(\d+)\)/) ||
                line.match(/at (.+?):(\d+):(\d+)/);
      if (!m) return { function: line.trim() };
      if (m.length === 5) {
        return { function: m[1], filename: m[2], lineno: parseInt(m[3]), colno: parseInt(m[4]) };
      }
      return { filename: m[1], lineno: parseInt(m[2]), colno: parseInt(m[3]) };
    });
}

/**
 * Captura un mensaje (no necesariamente un error) — útil para warnings.
 */
export function captureMessage(message: string, context: ErrorContext = {}) {
  captureError(new Error(message), { ...context, level: context.level ?? 'info' });
}

/**
 * Inicializa el listener global de errores (solo browser).
 * Llamar en _app.tsx o layout client component.
 */
export function initErrorTracking() {
  if (typeof window === 'undefined') return;
  if (!dsnParts) {
    console.info('[error-tracking] SENTRY_DSN no set — capturando solo en consola');
    return;
  }
  window.addEventListener('error', (e) => {
    captureError(e.error ?? new Error(e.message), {
      tags: { source: 'window.onerror' },
      extra: { filename: e.filename, lineno: e.lineno, colno: e.colno },
    });
  });
  window.addEventListener('unhandledrejection', (e) => {
    captureError(e.reason ?? new Error('Unhandled promise rejection'), {
      tags: { source: 'unhandledrejection' },
    });
  });
}
