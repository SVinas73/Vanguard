'use client';

// =====================================================
// Global error boundary de Next.js
// =====================================================
// Captura errores que ocurren en el layout root o en los
// providers (que el ErrorBoundary regular no puede atrapar).
// =====================================================

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body style={{ margin: 0, background: '#020617', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: 480, padding: '2rem', background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}>
          <h1 style={{ color: '#ef4444', fontSize: '1.25rem', marginBottom: '0.5rem' }}>Error crítico</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1rem' }}>
            La aplicación encontró un error inesperado. El equipo de soporte fue notificado automáticamente.
          </p>
          <code style={{ display: 'block', padding: '0.75rem', background: '#020617', borderRadius: 4, fontSize: '0.75rem', color: '#fca5a5', marginBottom: '1rem', wordBreak: 'break-all' }}>
            {error.message}
          </code>
          {error.digest && (
            <p style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '1rem' }}>
              Referencia: <code>{error.digest}</code>
            </p>
          )}
          <button
            onClick={reset}
            style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.875rem' }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
