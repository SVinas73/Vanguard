'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { reportarError } from '@/lib/security/error-reporting';

interface Props {
  children: React.ReactNode;
  /** Si se pasa, se muestra en el fallback en lugar del default */
  fallback?: (props: { error: Error; eventId?: string; reset: () => void }) => React.ReactNode;
  /** Módulo para taggear el error en Sentry */
  modulo?: string;
}

interface State {
  error: Error | null;
  eventId: string | undefined;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, eventId: undefined };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const eventId = reportarError(error, {
      modulo: this.props.modulo,
      extra: { componentStack: info.componentStack },
    });
    this.setState({ eventId });
  }

  reset = () => {
    this.setState({ error: null, eventId: undefined });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          eventId: this.state.eventId,
          reset: this.reset,
        });
      }
      return <DefaultFallback error={this.state.error} eventId={this.state.eventId} reset={this.reset} />;
    }
    return this.props.children;
  }
}

function DefaultFallback({ error, eventId, reset }: { error: Error; eventId?: string; reset: () => void }) {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-slate-900 border border-red-900/40 rounded-lg p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Algo salió mal</h3>
            <p className="text-sm text-slate-400 mt-1">
              Se produjo un error en este módulo. Ya fue reportado al equipo de soporte.
            </p>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-md p-3 mb-4">
          <div className="text-xs text-slate-500 mb-1">Detalle del error</div>
          <div className="text-sm text-red-300 font-mono break-all">{error.message}</div>
          {eventId && (
            <div className="text-xs text-slate-500 mt-2">
              Referencia: <code className="text-slate-300">{eventId}</code>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={reset}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm transition"
          >
            <RefreshCw className="w-4 h-4" />
            Reintentar
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-sm transition"
          >
            Recargar página
          </button>
        </div>
      </div>
    </div>
  );
}
