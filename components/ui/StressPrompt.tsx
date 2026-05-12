'use client';

import React, { useState } from 'react';
import {
  Sparkles, Focus, X, ChevronDown, ChevronUp, AlertTriangle,
  Sun, Coffee,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StressScore } from '@/lib/stress-detector';

// =====================================================
// StressPrompt — toast no intrusivo abajo a la derecha
// =====================================================
// Aparece cuando el detector decide que el usuario está
// sobrecargado. Le pregunta si quiere activar Focus Mode.
// NO se activa solo — siempre pide confirmación.
//
// Opciones del usuario:
//   • "Activar Focus Mode" → activa
//   • "Más tarde"          → cooldown 30 min
//   • "No, gracias"        → cooldown 30 min
//   • "No volver a sugerir" → desactiva la detección
//
// Muestra qué señales detonaron el aviso (transparencia).
// =====================================================

interface StressPromptProps {
  score: StressScore;
  visible: boolean;
  onActivar: () => void;
  onDespues: () => void;
  onDeshabilitar: () => void;
}

const NIVEL_CONFIG: Record<StressScore['nivel'], {
  label: string; bg: string; border: string; icon: React.ElementType; iconColor: string;
}> = {
  tranquilo: { label: 'Día tranquilo',     bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: Coffee, iconColor: 'text-emerald-300' },
  normal:    { label: 'Carga normal',      bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    icon: Sun, iconColor: 'text-blue-300' },
  elevado:   { label: 'Carga elevada',     bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   icon: AlertTriangle, iconColor: 'text-amber-300' },
  alto:      { label: 'Mucha carga',       bg: 'bg-orange-500/10',  border: 'border-orange-500/30',  icon: AlertTriangle, iconColor: 'text-orange-300' },
  critico:   { label: 'Sobrecarga',        bg: 'bg-red-500/10',     border: 'border-red-500/30',     icon: AlertTriangle, iconColor: 'text-red-300' },
};

export default function StressPrompt({
  score, visible, onActivar, onDespues, onDeshabilitar,
}: StressPromptProps) {
  const [expandido, setExpandido] = useState(false);

  if (!visible) return null;

  const cfg = NIVEL_CONFIG[score.nivel];
  const Icon = cfg.icon;

  // Top 3 componentes con más impacto, ordenados
  const topCausas = [...score.componentes]
    .sort((a, b) => (b.valor * b.peso) - (a.valor * a.peso))
    .slice(0, 3);

  return (
    <div
      role="dialog"
      aria-live="polite"
      className={cn(
        'fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl border shadow-2xl backdrop-blur-md',
        'animate-in fade-in zoom-in-95 duration-200',
        cfg.bg, cfg.border,
      )}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded-lg bg-slate-900/40')}>
            <Icon className={cn('h-5 w-5', cfg.iconColor)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-purple-300" />
              <span className="text-xs uppercase tracking-wider text-slate-300 font-semibold">
                Asistente
              </span>
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-bold ml-auto',
                score.nivel === 'critico' ? 'bg-red-500/30 text-red-200' :
                score.nivel === 'alto'    ? 'bg-orange-500/30 text-orange-200' :
                                            'bg-amber-500/30 text-amber-200')}>
                {score.total}/100
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-100 mt-1">
              {score.nivel === 'critico'
                ? '¿Querés que activemos Focus Mode?'
                : 'Notamos mucha actividad...'}
            </h4>
            <p className="text-xs text-slate-300 mt-1 leading-snug">
              {score.recomendacion}
            </p>
          </div>
        </div>

        {/* Detalle expandible — qué causa el estrés */}
        {topCausas.length > 0 && (
          <button
            type="button"
            onClick={() => setExpandido(v => !v)}
            className="mt-3 text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
          >
            {expandido ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            ¿Por qué? · {topCausas.length} señal(es) detectadas
          </button>
        )}

        {expandido && (
          <ul className="mt-2 space-y-1 text-[11px] text-slate-300 bg-slate-950/40 rounded-lg p-2">
            {topCausas.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-slate-500 mt-0.5">•</span>
                <span className="flex-1">
                  <span className="font-medium text-slate-200">{c.fuente}:</span>{' '}
                  <span className="text-slate-400">{c.descripcion}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Acciones */}
        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={onActivar}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Focus className="h-4 w-4" />
            Activar Focus Mode
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onDespues}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
            >
              Más tarde
            </button>
            <button
              onClick={onDeshabilitar}
              className="px-3 py-1.5 bg-transparent hover:bg-slate-800 text-slate-500 hover:text-slate-300 rounded-lg text-xs transition-colors flex items-center justify-center gap-1"
              title="No volver a sugerir Focus Mode"
            >
              <X className="h-3 w-3" />
              No sugerir
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-slate-700/30 text-[10px] text-slate-500">
          Detección basada en notificaciones, aprobaciones, tickets y comportamiento.
          Podés desactivarla cuando quieras.
        </div>
      </div>
    </div>
  );
}

// =====================================================
// BADGE compacto para mostrar el nivel en el sidebar/header
// =====================================================

export function StressBadge({ score, onClick }: { score: StressScore | null; onClick?: () => void }) {
  if (!score) return null;
  const cfg = NIVEL_CONFIG[score.nivel];
  const Icon = cfg.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-medium transition-colors',
        cfg.bg, cfg.border, cfg.iconColor,
      )}
      title={`Nivel de carga: ${cfg.label} (${score.total}/100)`}
    >
      <Icon className="h-3 w-3" />
      <span>{cfg.label}</span>
    </button>
  );
}
