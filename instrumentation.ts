// =====================================================
// Next.js instrumentation hook
// =====================================================
// Next.js llama a `register()` una sola vez por runtime
// al inicio del proceso. Usamos esto para cargar el config
// de Sentry correcto según corremos en Node o Edge.
// =====================================================

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export { captureRequestError as onRequestError } from '@sentry/nextjs';
