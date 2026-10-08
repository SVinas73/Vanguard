'use client';

import React, { useEffect, useId, useState } from 'react';
import {
  AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform,
} from 'framer-motion';
import { cn } from '@/lib/utils';
import { VANGUARD_BAR_PATH, VANGUARD_COLORS, VANGUARD_V_PATH } from '@/lib/brand';

// =====================================================
// Pantalla de carga de Vanguard
// =====================================================
// 1. La V se dibuja (trazo) y se rellena.
// 2. La barra entra deslizándose a lo largo de su propio eje.
// 3. En bucle: el símbolo flota, la barra "respira" sobre su eje y un
//    brillo recorre la V. Barra de progreso fina con destello en la punta.
// Respeta prefers-reduced-motion (sin bucles).
// Los colores de fondo/texto viven en globals.css (.vg-loader*) para que
// el modo claro los pueda ajustar.
// =====================================================

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
const EASE_IN_OUT: [number, number, number, number] = [0.65, 0, 0.35, 1];

// Dirección de la pata izquierda (vector unitario aprox. 0.425, 0.905)
const BAR_AXIS = { x: 0.425, y: 0.905 };

export function VanguardMarkAnimated({ size = 128, loop = true }: { size?: number; loop?: boolean }) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const gV = `vgl-v-${uid}`;
  const gBar = `vgl-b-${uid}`;
  const gStroke = `vgl-s-${uid}`;
  const gSheen = `vgl-sh-${uid}`;
  const clip = `vgl-c-${uid}`;
  const animar = !reduce;
  const bucle = loop && animar;

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="Vanguard"
      style={{ overflow: 'visible', display: 'block' }}
      animate={bucle ? { y: [0, -2.2, 0] } : undefined}
      transition={bucle ? { duration: 3.4, repeat: Infinity, ease: 'easeInOut', delay: 1.8 } : undefined}
    >
      <defs>
        <linearGradient id={gV} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={VANGUARD_COLORS.vTop} />
          <stop offset="1" stopColor={VANGUARD_COLORS.vBottom} />
        </linearGradient>
        <linearGradient id={gBar} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={VANGUARD_COLORS.barTop} />
          <stop offset="1" stopColor={VANGUARD_COLORS.barBottom} />
        </linearGradient>
        <linearGradient id={gStroke} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={VANGUARD_COLORS.barTop} />
          <stop offset="1" stopColor={VANGUARD_COLORS.vTop} />
        </linearGradient>
        <linearGradient id={gSheen} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={clip}>
          <path d={VANGUARD_V_PATH} />
          <path d={VANGUARD_BAR_PATH} />
        </clipPath>
      </defs>

      {/* Barra: entra por su eje y luego "respira" */}
      <motion.g
        initial={animar ? { x: -BAR_AXIS.x * 16, y: -BAR_AXIS.y * 16, opacity: 0 } : false}
        animate={{ x: 0, y: 0, opacity: 1 }}
        transition={{ delay: 0.85, duration: 0.9, ease: EASE_OUT }}
      >
        <motion.path
          d={VANGUARD_BAR_PATH}
          fill={`url(#${gBar})`}
          animate={bucle ? { x: [0, -BAR_AXIS.x * 2.4, 0], y: [0, -BAR_AXIS.y * 2.4, 0] } : undefined}
          transition={bucle ? { duration: 2.6, repeat: Infinity, ease: 'easeInOut', delay: 2 } : undefined}
        />
      </motion.g>

      {/* V: trazo que se dibuja y relleno que aparece */}
      {animar && (
        <motion.path
          d={VANGUARD_V_PATH}
          stroke={`url(#${gStroke})`}
          strokeWidth={1}
          strokeLinejoin="round"
          fill="none"
          initial={{ pathLength: 0, opacity: 1 }}
          animate={{ pathLength: 1, opacity: [1, 1, 0] }}
          transition={{
            pathLength: { duration: 1.05, ease: EASE_IN_OUT },
            opacity: { duration: 1.7, times: [0, 0.7, 1] },
          }}
        />
      )}
      <motion.path
        d={VANGUARD_V_PATH}
        fill={`url(#${gV})`}
        initial={animar ? { opacity: 0, scale: 0.94 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.6, duration: 0.8, ease: EASE_OUT }}
      />

      {/* Brillo que recorre el símbolo */}
      {bucle && (
        <g clipPath={`url(#${clip})`}>
          <motion.g
            initial={{ x: -36 }}
            animate={{ x: [-36, 96] }}
            transition={{ duration: 1.4, delay: 1.9, repeat: Infinity, repeatDelay: 1.8, ease: EASE_IN_OUT }}
          >
            <rect x="0" y="-8" width="14" height="80" fill={`url(#${gSheen})`} transform="skewX(-24)" />
          </motion.g>
        </g>
      )}
    </motion.svg>
  );
}

interface VanguardLoaderProps {
  /** Duración de la barra en ms. Sin valor, la barra es indeterminada (bucle). */
  duracionMs?: number;
  /** Mensajes de estado que rotan debajo de la barra. */
  mensajes?: string[];
  /** true: overlay fijo a pantalla completa; false: ocupa el contenedor (min-h-screen). */
  fullscreen?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const LETRAS = 'VANGUARD'.split('');

export function VanguardLoader({
  duracionMs,
  mensajes = ['Iniciando'],
  fullscreen = true,
  className,
  children,
}: VanguardLoaderProps) {
  const reduce = useReducedMotion();
  const [idx, setIdx] = useState(0);
  const progreso = useMotionValue(0);
  const ancho = useTransform(progreso, v => `${v}%`);
  const porcentaje = useTransform(progreso, v => `${Math.round(v)}%`);
  const determinada = typeof duracionMs === 'number' && duracionMs > 0;

  useEffect(() => {
    if (!determinada) return;
    const ctrl = animate(progreso, 100, {
      duration: duracionMs! / 1000,
      delay: 0.5,
      ease: EASE_IN_OUT,
    });
    return () => ctrl.stop();
  }, [determinada, duracionMs, progreso]);

  // Mensaje de estado: con barra determinada avanza junto con el progreso
  // (y queda en el último al llegar al 100 %); sin barra, rota en bucle.
  useEffect(() => {
    if (mensajes.length <= 1) return;
    if (determinada) {
      return progreso.on('change', v => {
        setIdx(Math.min(mensajes.length - 1, Math.floor((v / 100) * mensajes.length)));
      });
    }
    const id = setInterval(() => setIdx(i => (i + 1) % mensajes.length), 1400);
    return () => clearInterval(id);
  }, [mensajes.length, determinada, progreso]);

  const mensaje = mensajes[idx % mensajes.length] ?? '';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Cargando Vanguard"
      className={cn(
        'vg-loader flex flex-col items-center justify-center overflow-hidden select-none',
        fullscreen ? 'fixed inset-0 z-[9999]' : 'min-h-screen w-full',
        className,
      )}
    >
      <div className="relative flex items-center justify-center">
        <motion.div
          aria-hidden
          className="vg-loader__glow absolute w-[320px] h-[320px] rounded-full"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={reduce ? { opacity: 0.8, scale: 1 } : { opacity: [0.55, 0.95, 0.55], scale: [0.92, 1.06, 0.92] }}
          transition={reduce ? { duration: 0.6 } : { duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <VanguardMarkAnimated size={128} />
      </div>

      {/* Wordmark */}
      <div className="mt-8 flex items-center justify-center" aria-hidden>
        {LETRAS.map((l, i) => (
          <motion.span
            key={i}
            className="vg-loader__word text-[26px] font-semibold leading-none"
            style={{ letterSpacing: '0.42em', marginRight: i === LETRAS.length - 1 ? '-0.42em' : undefined }}
            initial={reduce ? false : { opacity: 0, y: 10, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ delay: 1.1 + i * 0.05, duration: 0.6, ease: EASE_OUT }}
          >
            {l}
          </motion.span>
        ))}
      </div>
      <motion.p
        className="vg-loader__tag mt-3 text-[10px] uppercase tracking-[0.38em]"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 0.6 }}
      >
        Sistema de gestión
      </motion.p>

      {/* Progreso */}
      <motion.div
        className="mt-10 w-60 flex flex-col items-center gap-3"
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <div className="vg-loader__track relative h-[3px] w-full rounded-full overflow-hidden">
          {determinada ? (
            <motion.div className="vg-loader__fill absolute inset-y-0 left-0 rounded-full" style={{ width: ancho }} />
          ) : (
            <div className="vg-loader__fill vg-loader__indet absolute inset-y-0 left-0 w-[38%] rounded-full" />
          )}
        </div>
        <div className="flex w-full items-center justify-between text-[11px] tabular-nums">
          <span className="vg-loader__status relative h-4 flex-1 overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={mensaje}
                className="absolute left-0"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.16 }}
              >
                {mensaje}…
              </motion.span>
            </AnimatePresence>
          </span>
          {determinada && <motion.span className="vg-loader__status">{porcentaje}</motion.span>}
        </div>
      </motion.div>

      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}

export default VanguardLoader;
