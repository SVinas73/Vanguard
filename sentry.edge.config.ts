// =====================================================
// Sentry — Edge runtime (middleware.ts)
// =====================================================
// Subset minimal: el edge runtime tiene APIs limitadas,
// no soporta todo lo del server.
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
  });
}
