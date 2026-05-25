import React from 'react';
import { cn } from '@/lib/utils';

// =====================================================
// Vanguard Logo — "V" de doble haz (ribbon)
// =====================================================
// Nuevo símbolo: una V formada por dos haces paralelos en azul,
// con un punto de glow en el vértice. Sin escudo ni banner.
//
// Variantes:
//   <Logo />              icono 32px (cuadrado)
//   <Logo size={64} />    tamaño custom
//   <Logo withText />     icono + wordmark "Vanguard" al costado
//   <Logo mono />         sólido steel-blue (sin gradient)
//   <Logo dark />         versión sobre fondo claro
// =====================================================

interface LogoProps {
  size?: number;
  className?: string;
  withText?: boolean;
  mono?: boolean;
  dark?: boolean;
  textClassName?: string;
  /** id único — evita colisiones al renderizar varios logos */
  gradientId?: string;
}

export function Logo({
  size = 32,
  className,
  withText = false,
  mono = false,
  dark = false,
  textClassName,
  gradientId = 'vg-logo',
}: LogoProps) {
  const fill = dark
    ? '#1a2030'
    : mono
      ? '#4a7fb5'
      : `url(#${gradientId}-v)`;

  // viewBox cuadrado 64x64 (el logo nuevo no tiene banner inferior).
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
        {!mono && !dark && (
          <defs>
            <linearGradient id={`${gradientId}-v`} x1="8" y1="10" x2="56" y2="54" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#6ea0d6" />
              <stop offset="50%" stopColor="#4a7fb5" />
              <stop offset="100%" stopColor="#244c79" />
            </linearGradient>
            <radialGradient id={`${gradientId}-glow`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#bfe0ff" stopOpacity="0.95" />
              <stop offset="40%" stopColor="#5aa0ff" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#5aa0ff" stopOpacity="0" />
            </radialGradient>
          </defs>
        )}

        {/* Haz exterior de la V */}
        <path
          d="M6 11 L17 11 L32 44 L47 11 L58 11 L38 55 L26 55 Z"
          fill={fill}
        />
        {/* Haz interior (línea de hueco que crea el efecto de doble viga) */}
        <path
          d="M26 11 L32 24 L38 11 L33 11 L32 13.5 L31 11 Z"
          fill={dark ? '#0b0f17' : '#0e1626'}
          fillOpacity="0.0"
        />
        {/* Brillo superior sutil en los bordes internos */}
        {!mono && !dark && (
          <path
            d="M6 11 L17 11 L32 44 L31.2 45.8 L15.2 12.4 L6 12.4 Z"
            fill="rgba(255,255,255,0.14)"
          />
        )}

        {/* Punto de glow en el vértice */}
        {!mono && !dark && (
          <circle cx="32" cy="42" r="9" fill={`url(#${gradientId}-glow)`} />
        )}
        <circle cx="32" cy="42" r="2.4" fill={dark ? '#4a7fb5' : '#dcefff'} />
      </svg>

      {withText && (
        <span
          className={cn(
            'font-semibold tracking-tight text-slate-100 leading-none',
            textClassName,
          )}
          style={{ fontSize: size * 0.55 }}
        >
          Vanguard
        </span>
      )}
    </div>
  );
}

// =====================================================
// LogoMark — sólo el símbolo (icono compacto). Para
// favicons, avatares pequeños o barras colapsadas.
// =====================================================
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return <Logo size={size} className={className} />;
}

export default Logo;
