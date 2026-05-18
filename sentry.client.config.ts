// =====================================================
// Sentry — configuración del CLIENTE (browser)
// =====================================================
// Se ejecuta solo en el navegador. Captura errores no
// manejados de React, promesas rechazadas, errores de
// fetch, etc.
//
// SI no hay NEXT_PUBLIC_SENTRY_DSN, no inicializa nada
// (no-op total). Eso permite que el sistema funcione sin
// Sentry configurado.
// =====================================================

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENV || process.env.NODE_ENV,
    enabled: process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_SENTRY_ENABLE_DEV === '1',

    // Tracing — sampling bajo para no inflar el plan
    tracesSampleRate: 0.1,

    // Replay — útil para debugging, pero pesado; deshabilitado por defecto
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.5,

    // Scrubbing de PII — Sentry tiene defaults razonables, los reforzamos
    sendDefaultPii: false,

    // Ignoramos ruido conocido del browser
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
      'Network request failed',
      // Abort de fetch al navegar entre páginas — no es un error real
      /AbortError/,
      // Errores de extensiones del browser
      /chrome-extension/,
      /moz-extension/,
      /safari-extension/,
    ],

    beforeSend(event, hint) {
      // Filtro extra de seguridad: scrub manual de PII si quedó algo
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-totp-code'];
      }
      return event;
    },
  });
}
