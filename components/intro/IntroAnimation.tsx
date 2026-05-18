'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

const SESSION_KEY = 'vg:intro:shown';

interface IntroAnimationProps {
  /** Si true, fuerza mostrar la intro incluso si ya se mostró en la sesión */
  force?: boolean;
  /** Callback cuando la animación termina */
  onComplete?: () => void;
}

/**
 * Animación de intro estilo "boot screen" inspirada en Kali Linux:
 * fondo negro, logo de Vanguard con glow pulsante, ondas concéntricas
 * expandiéndose, fade-out elegante.
 *
 * Se muestra una sola vez por sesión (usando sessionStorage). Pasá
 * `force` para forzar mostrarla siempre (útil para testing).
 */
export default function IntroAnimation({ force = false, onComplete }: IntroAnimationProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!force) {
      try {
        if (sessionStorage.getItem(SESSION_KEY) === '1') return;
      } catch { /* sessionStorage no disponible */ }
    }
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* */ }
      onComplete?.();
    }, 3200);
    return () => clearTimeout(timer);
  }, [force, onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black overflow-hidden"
        >
          {/* Grid background sutil tipo Kali */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'linear-gradient(rgba(59,130,246,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.15) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />

          {/* Vignette */}
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.9) 100%)',
            }}
          />

          {/* Ondas concéntricas */}
          {[0, 0.4, 0.8, 1.2].map((delay, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, opacity: 0.6 }}
              animate={{ scale: 4, opacity: 0 }}
              transition={{
                duration: 2.4,
                delay,
                repeat: Infinity,
                ease: 'easeOut',
              }}
              className="absolute w-48 h-48 rounded-full border-2 border-blue-500"
            />
          ))}

          {/* Logo central con glow pulsante */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="relative z-10"
          >
            <motion.div
              animate={{
                filter: [
                  'drop-shadow(0 0 20px rgba(59,130,246,0.6))',
                  'drop-shadow(0 0 40px rgba(59,130,246,0.9))',
                  'drop-shadow(0 0 20px rgba(59,130,246,0.6))',
                ],
              }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              className="relative"
            >
              <Image
                src="/vang.png"
                alt="Vanguard"
                width={180}
                height={180}
                priority
                className="select-none"
              />
            </motion.div>

            {/* Nombre del producto */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="mt-6 text-center"
            >
              <h1
                className="text-4xl font-bold tracking-[0.3em] text-white"
                style={{ textShadow: '0 0 20px rgba(59,130,246,0.6)' }}
              >
                VANGUARD
              </h1>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 1.2, delay: 1.0, ease: 'easeOut' }}
                className="mt-2 h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent mx-auto"
              />
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 1.4 }}
                className="mt-3 text-xs tracking-[0.4em] text-blue-400 uppercase"
              >
                Enterprise Resource Planning
              </motion.p>
            </motion.div>
          </motion.div>

          {/* Línea de carga abajo */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.8, duration: 0.4 }}
            className="absolute bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          >
            <div className="w-48 h-0.5 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 1.2, delay: 1.8, ease: 'easeInOut' }}
                className="h-full bg-gradient-to-r from-blue-600 to-cyan-400"
              />
            </div>
            <span className="text-[10px] tracking-[0.3em] text-slate-500 uppercase">
              Inicializando sistema
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
