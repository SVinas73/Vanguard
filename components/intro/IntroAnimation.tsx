'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VanguardLoader } from '@/components/ui/VanguardLoader';

const SESSION_KEY = 'vg:intro:shown';
const DURACION_MS = 3400;

interface IntroAnimationProps {
  /** Si true, fuerza mostrar la intro incluso si ya se mostró en la sesión */
  force?: boolean;
  /** Callback cuando la animación termina */
  onComplete?: () => void;
}

/**
 * Intro de arranque: la V de Vanguard se dibuja, la barra entra por su eje,
 * aparece el nombre y una barra de progreso fina. Al terminar se desvanece.
 *
 * Se muestra una sola vez por sesión (sessionStorage). Pasá `force` para
 * mostrarla siempre (útil para testing).
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
    }, DURACION_MS);
    return () => clearTimeout(timer);
  }, [force, onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="vg-intro"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02, filter: 'blur(4px)' }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className="fixed inset-0 z-[9999]"
        >
          <VanguardLoader
            fullscreen={false}
            className="h-full"
            duracionMs={DURACION_MS - 900}
            mensajes={['Conectando', 'Verificando seguridad', 'Preparando módulos']}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
