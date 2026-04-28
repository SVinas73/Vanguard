'use client';

import React, { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Toast hook compartido para todos los sub-módulos WMS.
// Mismo patrón que el módulo Comercial.
export function useWmsToast() {
  const [toasts, setToasts] = useState<Array<{ id: string; type: string; title: string }>>([]);

  const add = (type: string, title: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts(prev => [...prev, { id, type, title }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  };

  const Toast = () => toasts.length > 0 ? (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map(t => (
        <div key={t.id} className={cn(
          'px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3',
          t.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' :
          t.type === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-400' :
          'bg-amber-500/20 border-amber-500/30 text-amber-400'
        )}>
          {t.type === 'success' ? <CheckCircle className="h-4 w-4" /> :
           t.type === 'error' ? <XCircle className="h-4 w-4" /> :
           <AlertTriangle className="h-4 w-4" />}
          <span className="text-sm font-medium">{t.title}</span>
        </div>
      ))}
    </div>
  ) : null;

  return {
    success: (t: string) => add('success', t),
    error: (t: string) => add('error', t),
    warning: (t: string) => add('warning', t),
    Toast,
  };
}
