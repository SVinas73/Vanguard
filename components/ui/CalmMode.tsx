'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Wind, X, Check, ChevronRight, ShieldCheck, Sparkles, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

// =====================================================
// MODO CALMA — anti-estrés, activado por el usuario
// =====================================================
// Combina tres ideas:
//  1) Respiro guiado: un círculo que late (inhalá / sostené / exhalá).
//  2) Tablero calmo: tus focos de a UNO, nunca todo junto.
//  3) Ambiente adaptativo OPCIONAL: el usuario decide si la app entera
//     baja el ruido visual (menos saturación, más aire).
//
// Mensaje central: "Respirá, yo me encargo del resto." El sistema muestra
// qué está cuidando solo para que el usuario se sienta respaldado.
// Nunca se activa solo: lo abre el usuario (botón / atajo / sugerencia).
// =====================================================

const AMBIENT_KEY = 'vanguard-calm-ambient';

export interface CalmFoco {
  titulo: string;
  detalle?: string;
  /** Acción para ir a resolver el foco (navega y cierra el Modo Calma). */
  accion?: () => void;
  accionLabel?: string;
}
export interface CalmRespaldo {
  label: string;
  value: string;
}

export function useCalmMode() {
  const [open, setOpen] = useState(false);
  const [ambient, setAmbient] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setAmbient(localStorage.getItem(AMBIENT_KEY) === '1');
    setHydrated(true);
  }, []);

  // El ambiente adaptativo es independiente del overlay: el usuario lo deja
  // prendido si quiere que toda la app esté más calma.
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(AMBIENT_KEY, ambient ? '1' : '0');
    document.documentElement.classList.toggle('calm-ambient', ambient);
  }, [ambient, hydrated]);

  const toggleAmbient = useCallback(() => setAmbient(v => !v), []);
  return { open, setOpen, ambient, toggleAmbient };
}

// Fase de respiración sincronizada con la animación CSS (ciclo de 11s).
function useBreathPhase(active: boolean) {
  const [fase, setFase] = useState<'inhalar' | 'sostener' | 'exhalar'>('inhalar');
  useEffect(() => {
    if (!active) return;
    let t: ReturnType<typeof setTimeout>;
    const ciclo = () => {
      setFase('inhalar');
      t = setTimeout(() => {
        setFase('sostener');
        t = setTimeout(() => {
          setFase('exhalar');
        }, 2000); // sostener 2s
      }, 4000);   // inhalar 4s
    };
    ciclo();
    const intervalo = setInterval(ciclo, 11000);
    return () => { clearInterval(intervalo); clearTimeout(t); };
  }, [active]);
  return fase;
}

interface CalmModeProps {
  open: boolean;
  onClose: () => void;
  userName?: string;
  focos?: CalmFoco[];
  respaldo?: CalmRespaldo[];
  ambient: boolean;
  onToggleAmbient: () => void;
}

const FASE_LABEL: Record<'inhalar' | 'sostener' | 'exhalar', string> = {
  inhalar: 'Inhalá',
  sostener: 'Sostené',
  exhalar: 'Exhalá',
};

export function CalmMode({ open, onClose, userName, focos = [], respaldo = [], ambient, onToggleAmbient }: CalmModeProps) {
  const [idx, setIdx] = useState(0);
  const [hechos, setHechos] = useState<Set<number>>(new Set());
  const fase = useBreathPhase(open);

  // Reset al abrir.
  useEffect(() => { if (open) { setIdx(0); setHechos(new Set()); } }, [open]);

  // Salir con Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const pendientes = useMemo(() => focos.filter((_, i) => !hechos.has(i)), [focos, hechos]);
  const focoActual = pendientes.length > 0 ? pendientes[Math.min(idx, pendientes.length - 1)] : null;

  const respaldoDefault: CalmRespaldo[] = respaldo.length > 0 ? respaldo : [
    { label: 'Stock', value: 'monitoreado' },
    { label: 'Alertas', value: 'activas' },
    { label: 'Datos', value: 'a salvo' },
  ];

  if (!open) return null;

  const marcarHecho = () => {
    const realIndex = focos.indexOf(focoActual as CalmFoco);
    if (realIndex >= 0) setHechos(prev => new Set(prev).add(realIndex));
    setIdx(0);
  };
  const siguiente = () => setIdx(i => (pendientes.length ? (i + 1) % pendientes.length : 0));

  return (
    <div className="fixed inset-0 z-[200] calm-enter">
      {/* Fondo sereno */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-[#0b1220] to-slate-950" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(74,127,181,0.10),_transparent_60%)]" />

      <div className="relative h-full w-full flex flex-col items-center justify-center px-6 py-10 overflow-y-auto">
        {/* Salir */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/60 hover:bg-slate-800 border border-slate-700/60 text-slate-300 text-sm backdrop-blur"
        >
          <X className="h-4 w-4" /> Volver
        </button>

        {/* Saludo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-400 mb-2">
            <Wind className="h-3.5 w-3.5 text-cyan-300" /> Modo Calma
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-100">
            Respirá{userName ? `, ${userName}` : ''}.
          </h1>
          <p className="text-slate-400 mt-1">Yo me encargo del resto.</p>
        </div>

        {/* Respiro guiado */}
        <div className="relative flex items-center justify-center" style={{ width: 240, height: 240 }}>
          <div className="calm-halo absolute rounded-full bg-cyan-400/20" style={{ width: 240, height: 240 }} />
          <div
            className="calm-breath absolute rounded-full bg-gradient-to-br from-cyan-400/30 to-blue-500/20 ring-1 ring-cyan-300/30"
            style={{ width: 200, height: 200 }}
          />
          <div className="relative text-center">
            <div className="text-xl font-medium text-slate-100">{FASE_LABEL[fase]}</div>
            <div className="text-xs text-slate-400 mt-1">seguí el círculo</div>
          </div>
        </div>

        {/* Tu foco ahora — de a uno */}
        <div className="w-full max-w-md mt-10">
          <div className="text-center text-xs uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-purple-300" /> Tu foco ahora
          </div>
          {focoActual ? (
            <div className="rounded-2xl bg-slate-900/60 border border-slate-700/50 p-5 backdrop-blur">
              <div className="text-base font-medium text-slate-100">{focoActual.titulo}</div>
              {focoActual.detalle && (
                <div className="text-sm text-slate-400 mt-1">{focoActual.detalle}</div>
              )}
              <div className="flex items-center gap-2 mt-4">
                {focoActual.accion ? (
                  <button
                    onClick={() => { focoActual.accion?.(); }}
                    className="flex items-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium"
                  >
                    {focoActual.accionLabel || 'Ir a resolver'} <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={marcarHecho}
                    className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium"
                  >
                    <Check className="h-4 w-4" /> Entendido
                  </button>
                )}
                {pendientes.length > 1 && (
                  <button
                    onClick={siguiente}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm"
                  >
                    Siguiente <ChevronRight className="h-4 w-4" />
                  </button>
                )}
                <span className="ml-auto text-xs text-slate-500">{pendientes.length} en foco</span>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-5 text-center">
              <div className="text-base font-medium text-emerald-200">Estás al día ✦</div>
              <div className="text-sm text-slate-400 mt-1">Nada urgente. Quedate respirando lo que quieras.</div>
            </div>
          )}
        </div>

        {/* El sistema te respalda */}
        <div className="w-full max-w-md mt-6">
          <div className="text-center text-xs uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-cyan-300" /> El sistema te respalda
          </div>
          <div className="grid grid-cols-3 gap-2">
            {respaldoDefault.map((r) => (
              <div key={r.label} className="rounded-xl bg-slate-900/50 border border-slate-800/60 p-3 text-center">
                <div className="text-sm font-medium text-slate-100 capitalize">{r.value}</div>
                <div className="text-[11px] text-slate-500">{r.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Ambiente sereno (opcional, lo elige el usuario) */}
        <div className="mt-8 w-full max-w-md rounded-2xl bg-slate-900/50 border border-slate-800/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-100 flex items-center gap-2">
                <Moon className="h-4 w-4 text-cyan-300" /> Ambiente sereno
              </div>
              <p className="text-[12px] text-slate-400 mt-1 leading-snug">
                Suaviza <strong>toda la app</strong> al salir: baja la intensidad de los colores
                y hace las transiciones más lentas, para reducir el ruido visual. Opcional —
                lo prendés y apagás cuando quieras.
              </p>
            </div>
            {/* Switch */}
            <button
              onClick={onToggleAmbient}
              role="switch"
              aria-checked={ambient}
              className={cn(
                'relative shrink-0 w-11 h-6 rounded-full transition-colors',
                ambient ? 'bg-cyan-500' : 'bg-slate-700',
              )}
              title={ambient ? 'Desactivar ambiente sereno' : 'Activar ambiente sereno'}
            >
              <span className={cn(
                'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform',
                ambient && 'translate-x-5',
              )} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Botón flotante para abrir el Modo Calma (al lado del Focus Mode).
export function CalmModeToggle({ onOpen, ambient }: { onOpen: () => void; ambient?: boolean }) {
  return (
    <button
      onClick={onOpen}
      className={cn(
        'fixed bottom-4 left-[148px] z-40 p-2.5 rounded-full shadow-lg border transition-all flex items-center gap-2',
        ambient
          ? 'bg-cyan-600/90 hover:bg-cyan-500 border-cyan-500 text-white'
          : 'bg-slate-900/80 backdrop-blur hover:bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200',
      )}
      title="Modo Calma — respirá y enfocate"
    >
      <Wind className="h-4 w-4" />
      <span className="text-xs font-medium hidden sm:inline">Calma</span>
    </button>
  );
}
