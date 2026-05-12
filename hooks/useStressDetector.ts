'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  calcularStressScore, loadSystemSignals, combinarSignals,
  type StressScore, type BehaviorTracker,
} from '@/lib/stress-detector';

// =====================================================
// useStressDetector — hook que monitorea el nivel de estrés
// =====================================================
// Cada N segundos:
//   1) Carga señales del sistema (notifs, aprobaciones, etc)
//   2) Combina con el tracker de comportamiento del usuario
//   3) Calcula score y lo expone
//
// El componente padre decide qué hacer con el score (mostrar
// banner, prompt, o nada).
//
// Persiste en localStorage el último score y la última vez
// que se preguntó al usuario, para no molestar repetidamente.
// =====================================================

interface UseStressOpts {
  usuarioEmail: string;
  rol: string;
  /** Cada cuánto recalcular (default 90s) */
  intervaloSegundos?: number;
  /** No volver a preguntar antes de N minutos (default 30) */
  cooldownMinutos?: number;
  /** Habilitar/deshabilitar globalmente */
  habilitado?: boolean;
}

interface UseStressResult {
  score: StressScore | null;
  /** True solo cuando hay que mostrar el prompt al usuario */
  debeMostrarPrompt: boolean;
  /** Llamar después de mostrar/cerrar el prompt para resetear cooldown */
  marcarComoMostrado: () => void;
  /** El usuario dijo "no, déjenme tranquilo por un rato" */
  marcarComoIgnorado: () => void;
  /** Reset manual del tracker (ej: al hacer logout) */
  resetTracker: () => void;
  /** Para que el componente padre registre cuando ve un error/toast */
  registrarError: () => void;
}

const STORAGE_LAST_PROMPT  = 'vg-stress-last-prompt';
const STORAGE_LAST_DISMISS = 'vg-stress-last-dismiss';
const STORAGE_DESHABILITADO = 'vg-stress-disabled';

export function useStressDetector(opts: UseStressOpts): UseStressResult {
  const intervalo = opts.intervaloSegundos ?? 90;
  const cooldown  = opts.cooldownMinutos ?? 30;
  const habilitado = opts.habilitado !== false;

  const [score, setScore] = useState<StressScore | null>(null);
  const [debeMostrarPrompt, setDebeMostrarPrompt] = useState(false);

  // Tracker en memoria — usa refs para no provocar rerenders
  const cambiosTabRef = useRef<number[]>([]);     // timestamps de cambios
  const erroresRef    = useRef<number[]>([]);     // timestamps de errores
  const sesionInicioRef = useRef<number>(Date.now());
  const ultimaInteraccionRef = useRef<number>(Date.now());

  // ---- TRACKING de comportamiento ----

  // Cambio de visibilidad / focus = pausa
  useEffect(() => {
    const onVisChange = () => {
      if (document.visibilityState === 'visible') {
        // Volvió al sistema → resetear "minutos sin pausa"
        sesionInicioRef.current = Date.now();
      }
    };
    document.addEventListener('visibilitychange', onVisChange);
    return () => document.removeEventListener('visibilitychange', onVisChange);
  }, []);

  // Tracking de cambios de tab/navegación (history pushState +
  // popstate + click en links / botones de navegación). Lo
  // simplificamos escuchando pathname via popstate y un evento
  // global "vg:tab-change" que el sidebar emite.
  useEffect(() => {
    const registrarCambio = () => {
      cambiosTabRef.current.push(Date.now());
      ultimaInteraccionRef.current = Date.now();
      // Limpiamos timestamps viejos (> 5 min)
      const corte = Date.now() - 5 * 60 * 1000;
      cambiosTabRef.current = cambiosTabRef.current.filter(t => t > corte);
    };
    window.addEventListener('popstate', registrarCambio);
    window.addEventListener('vg:tab-change', registrarCambio);
    return () => {
      window.removeEventListener('popstate', registrarCambio);
      window.removeEventListener('vg:tab-change', registrarCambio);
    };
  }, []);

  // Registro de errores
  const registrarError = useCallback(() => {
    erroresRef.current.push(Date.now());
    const corteHora = Date.now() - 60 * 60 * 1000;
    erroresRef.current = erroresRef.current.filter(t => t > corteHora);
  }, []);

  // Resetear tracker (ej: usuario tomó un descanso)
  const resetTracker = useCallback(() => {
    cambiosTabRef.current = [];
    erroresRef.current = [];
    sesionInicioRef.current = Date.now();
  }, []);

  // ---- CÁLCULO periódico ----

  const calcular = useCallback(async () => {
    if (!habilitado) return;
    if (!opts.usuarioEmail) return;
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(STORAGE_DESHABILITADO) === '1') return;

    try {
      const sistema = await loadSystemSignals({
        usuarioEmail: opts.usuarioEmail,
        rol: opts.rol,
      });

      const corte5min = Date.now() - 5 * 60 * 1000;
      const corteHora = Date.now() - 60 * 60 * 1000;
      const minutosSinPausa = Math.floor(
        (Date.now() - sesionInicioRef.current) / 60000
      );

      const behavior: BehaviorTracker = {
        cambiosTabUltimos5Min: cambiosTabRef.current.filter(t => t > corte5min).length,
        minutosEnSesionSinPausa: minutosSinPausa,
        erroresRecientes: erroresRef.current.filter(t => t > corteHora).length,
      };

      const signals = combinarSignals(sistema, behavior);
      const sc = calcularStressScore(signals);
      setScore(sc);

      // ¿Sugerir prompt?
      if (sc.sugerirFocus) {
        const ultimoPrompt = parseInt(localStorage.getItem(STORAGE_LAST_PROMPT) || '0');
        const ultimoDismiss = parseInt(localStorage.getItem(STORAGE_LAST_DISMISS) || '0');
        const desdeUltimo = Date.now() - Math.max(ultimoPrompt, ultimoDismiss);
        const cooldownMs = cooldown * 60 * 1000;

        if (desdeUltimo >= cooldownMs) {
          setDebeMostrarPrompt(true);
        }
      } else {
        // Si el score bajó, ocultar prompt si estaba visible
        setDebeMostrarPrompt(false);
      }
    } catch (err) {
      console.error('useStressDetector calcular error:', err);
    }
  }, [habilitado, opts.usuarioEmail, opts.rol, cooldown]);

  // Correr al montar y cada N segundos
  useEffect(() => {
    if (!habilitado) return;
    calcular();
    const id = setInterval(calcular, intervalo * 1000);
    return () => clearInterval(id);
  }, [calcular, habilitado, intervalo]);

  const marcarComoMostrado = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_LAST_PROMPT, String(Date.now()));
    setDebeMostrarPrompt(false);
  }, []);

  const marcarComoIgnorado = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_LAST_DISMISS, String(Date.now()));
    setDebeMostrarPrompt(false);
  }, []);

  return {
    score,
    debeMostrarPrompt,
    marcarComoMostrado,
    marcarComoIgnorado,
    resetTracker,
    registrarError,
  };
}

// =====================================================
// HELPER global: deshabilitar/habilitar detección
// =====================================================
export function setDeteccionStressDeshabilitada(deshab: boolean) {
  if (typeof window === 'undefined') return;
  if (deshab) localStorage.setItem('vg-stress-disabled', '1');
  else        localStorage.removeItem('vg-stress-disabled');
}

export function isDeteccionStressDeshabilitada(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('vg-stress-disabled') === '1';
}
