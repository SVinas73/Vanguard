'use client';

import { useState, useEffect, useCallback } from 'react';

const KEY = 'vg:onboarding:welcome-tour-completed';

export function useFirstTimeUser() {
  const [completado, setCompletado] = useState(true);

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      setCompletado(v === '1');
    } catch {
      setCompletado(true);
    }
  }, []);

  const marcarCompletado = useCallback(() => {
    try {
      localStorage.setItem(KEY, '1');
    } catch { /* localStorage no disponible */ }
    setCompletado(true);
  }, []);

  const resetear = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch { /* localStorage no disponible */ }
    setCompletado(false);
  }, []);

  return { mostrarTour: !completado, marcarCompletado, resetear };
}
