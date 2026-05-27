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
            <linearGradient id={`${gradientId}-v`} x1="10" y1="8" x2="54" y2="58" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#2f6fc4" />
              <stop offset="100%" stopColor="#1d4f9c" />
            </linearGradient>
          </defs>
        )}

        {/* V azul (chevron): banda en V con dos picos arriba y punta abajo */}
        <path
          d="M4 12 L19 12 L32 41 L45 12 L60 12 L38 58 L26 58 Z"
          fill={fill}
        />
        {/* V blanca interior — línea fina que sigue la V (look del escudo) */}
        <path
          d="M22 12 L32 35 L42 12"
          fill="none"
          stroke={dark ? '#0b0f17' : '#ffffff'}
          strokeWidth="3.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
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
