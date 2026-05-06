'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Focus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// =====================================================
// FOCUS MODE — Modo anti-estrés
// =====================================================
// Oculta el sidebar + headers + footers, deja solo el
// contenido del módulo activo. Reduce drásticamente la
// cantidad de elementos en pantalla y baja el ruido visual.
//
// Activación:
//  - Botón flotante (FocusModeToggle)
//  - Atajo F (sin modificadores) si no se está tipeando
//  - Cmd+K → "Activar Focus Mode"
//
// Persiste en localStorage para que no se pierda al
// recargar.
// =====================================================

const STORAGE_KEY = 'vanguard-focus-mode';

export function useFocusMode() {
  const [enabled, setEnabled] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === '1') setEnabled(true);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
    if (enabled) {
      document.documentElement.classList.add('focus-mode');
    } else {
      document.documentElement.classList.remove('focus-mode');
    }
  }, [enabled, hydrated]);

  // Atajo "F" para toggle (solo si no se está tipeando)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target?.tagName?.toLowerCase();
      const tipeando =
        tag === 'input' || tag === 'textarea' || target?.isContentEditable;
      if (tipeando) return;
      if (e.key === 'f' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setEnabled(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggle = useCallback(() => setEnabled(v => !v), []);

  return { enabled, setEnabled, toggle };
}

// =====================================================
// BOTÓN FLOTANTE — esquina inferior izquierda
// =====================================================

export function FocusModeToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'fixed bottom-4 left-4 z-40 p-2.5 rounded-full shadow-lg border transition-all',
        'flex items-center gap-2',
        enabled
          ? 'bg-purple-600 hover:bg-purple-500 border-purple-500 text-white'
          : 'bg-slate-900/80 backdrop-blur hover:bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
      )}
      title={enabled ? 'Salir de Focus Mode (F)' : 'Entrar a Focus Mode (F)'}
    >
      {enabled ? <X className="h-4 w-4" /> : <Focus className="h-4 w-4" />}
      <span className="text-xs font-medium hidden sm:inline">
        {enabled ? 'Salir focus' : 'Focus'}
      </span>
    </button>
  );
}

// =====================================================
// BANNER — aparece arriba cuando está activo
// =====================================================

export function FocusModeBanner({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-40 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[11px] font-medium flex items-center gap-1.5 backdrop-blur-sm">
      <Focus className="h-3 w-3" />
      Focus Mode · Presioná <kbd className="px-1 py-0.5 bg-slate-900 rounded text-[10px]">F</kbd> para salir
    </div>
  );
}
