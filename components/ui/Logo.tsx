import React from 'react';
import { cn } from '@/lib/utils';

// =====================================================
// Vanguard Logo — escudo con chevron de vanguardia
// =====================================================
// Símbolo: escudo (protección, confianza) con un chevron
// interior que apunta hacia adelante/arriba (progreso,
// vanguardia). El gradient unifica los dos conceptos.
//
// Variantes:
//   <Logo />             icono 32px
//   <Logo size={48} />   tamaño custom
//   <Logo withText />    icono + wordmark "Vanguard"
//   <Logo mono />        sólido (sin gradient) para fondos
// =====================================================

interface LogoProps {
  size?: number;
  className?: string;
  withText?: boolean;
  mono?: boolean;
  textClassName?: string;
  /** id único del gradient — evita colisiones si se renderiza varios en la misma página */
  gradientId?: string;
}

export function Logo({
  size = 32,
  className,
  withText = false,
  mono = false,
  textClassName,
  gradientId = 'vg-logo-grad',
}: LogoProps) {
  const fillUrl = mono ? 'currentColor' : `url(#${gradientId})`;
  const accentUrl = mono ? 'currentColor' : `url(#${gradientId}-accent)`;

  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Vanguard"
        role="img"
      >
        {!mono && (
          <defs>
            {/* Gradiente principal del escudo: azul profundo a esmeralda */}
            <linearGradient id={gradientId} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="55%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
            {/* Acento (chevron interior) — gradiente claro para contraste */}
            <linearGradient id={`${gradientId}-accent`} x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.75" />
            </linearGradient>
            {/* Sombra interior sutil */}
            <filter id={`${gradientId}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" />
              <feOffset dx="0" dy="1" result="offsetBlur" />
              <feComponentTransfer><feFuncA type="linear" slope="0.4" /></feComponentTransfer>
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        )}

        {/* Escudo principal */}
        <path
          d="M32 4 L56 14 V32 C56 46 46 56 32 60 C18 56 8 46 8 32 V14 Z"
          fill={fillUrl}
          filter={mono ? undefined : `url(#${gradientId}-shadow)`}
        />

        {/* Chevron interior (vanguardia → flecha hacia arriba) */}
        <path
          d="M32 18 L44 36 H38 L32 26 L26 36 H20 Z"
          fill={accentUrl}
        />
        {/* Chevron secundario más abajo, da sensación de movimiento */}
        <path
          d="M32 36 L42 50 H37 L32 42 L27 50 H22 Z"
          fill={accentUrl}
          opacity={0.55}
        />
      </svg>

      {withText && (
        <span className={cn(
          'font-semibold tracking-tight text-slate-100 leading-none',
          textClassName,
        )}
        style={{ fontSize: size * 0.55 }}>
          Vanguard
        </span>
      )}
    </div>
  );
}

// =====================================================
// LogoMark — sólo el símbolo (cuadrado), para favicons /
// avatares pequeños / barras compactas.
// =====================================================
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return <Logo size={size} className={className} />;
}

export default Logo;
