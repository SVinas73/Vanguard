// =====================================================
// Sentry — configuración del SERVIDOR (API routes)
// =====================================================
// Captura excepciones no manejadas en API routes y server
// components. Reportá errores explícitamente con
// `Sentry.captureException(err)` cuando hagas catch.
// =====================================================

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENV || process.env.NODE_ENV,
    enabled: process.env.NODE_ENV === 'production' || process.env.SENTRY_ENABLE_DEV === '1',

    tracesSampleRate: 0.1,
    sendDefaultPii: false,

    ignoreErrors: [
      // Errores esperados que no son bugs
      'AbortError',
    ],

    beforeSend(event) {
      // Scrub headers sensibles antes de enviar
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-totp-code'];
        delete event.request.headers['x-api-key'];
      }
      // Scrub query strings sensibles
      if (event.request?.query_string && typeof event.request.query_string === 'string') {
        event.request.query_string = event.request.query_string
          .replace(/token=[^&]+/g, 'token=[REDACTED]')
          .replace(/key=[^&]+/g, 'key=[REDACTED]');
      }
      return event;
    },
  });
}
