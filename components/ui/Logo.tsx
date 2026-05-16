import React from 'react';
import { cn } from '@/lib/utils';

// =====================================================
// Vanguard Logo — Crest with shield, upright V, banner
// =====================================================
// Símbolo:
//   - Escudo (protección, confianza)
//   - Letra "V" centrada (Vanguard, vanguardia)
//   - Banner inferior estilo crest con la palabra VANGUARD
//
// Variantes:
//   <Logo />              icono 32px (sin texto wordmark)
//   <Logo size={64} />    tamaño custom
//   <Logo withText />     icono + wordmark "Vanguard" al costado
//   <Logo mono />         sólido steel-blue (sin gradient)
//   <Logo dark />         versión sobre fondo claro (slate-950)
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
  const shieldFill = dark
    ? '#1a2030'
    : mono
      ? '#4a7fb5'
      : `url(#${gradientId}-shield)`;

  const bannerFill = dark ? '#1a2030' : '#2d5480';
  const bannerSide = dark ? '#0b0f17' : '#1c3354';
  // Mantener un viewBox 64x76 (banner ocupa los 16 px inferiores)
  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      <svg
        width={size}
        height={size * (76 / 64)}
        viewBox="0 0 64 76"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Vanguard"
        role="img"
      >
        {!mono && !dark && (
          <defs>
            <linearGradient id={`${gradientId}-shield`} x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#5b8ec3" />
              <stop offset="55%" stopColor="#4a7fb5" />
              <stop offset="100%" stopColor="#2d5480" />
            </linearGradient>
            <linearGradient id={`${gradientId}-banner`} x1="0" y1="56" x2="0" y2="72" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#2d5480" />
              <stop offset="100%" stopColor="#1f3c5e" />
            </linearGradient>
          </defs>
        )}

        {/* Banner (drawn first; shield overlays its top edge) */}
        <path d="M1 60.5 L9 58.5 L9 67.5 L1 70 L4 64 Z" fill={bannerSide} />
        <path d="M63 60.5 L55 58.5 L55 67.5 L63 70 L60 64 Z" fill={bannerSide} />
        <path d="M7.6 58.5 L10 58.5 L10 71 L7.6 71 Z" fill="rgba(0,0,0,0.35)" />
        <path d="M54 58.5 L56.4 58.5 L56.4 71 L54 71 Z" fill="rgba(0,0,0,0.35)" />
        <path
          d="M9 57.5 L55 57.5 L53 72 L11 72 Z"
          fill={mono || dark ? bannerFill : `url(#${gradientId}-banner)`}
        />
        <path d="M9 57.5 L55 57.5 L54.6 59 L9.4 59 Z" fill="rgba(255,255,255,0.08)" />
        <path d="M11 70 L53 70 L53 72 L11 72 Z" fill="rgba(0,0,0,0.18)" />
        <text
          x="32"
          y="67"
          textAnchor="middle"
          fontFamily="Public Sans, sans-serif"
          fontSize="6"
          fontWeight="800"
          fill="#ffffff"
          textLength="32"
          lengthAdjust="spacingAndGlyphs"
        >
          VANGUARD
        </text>

        {/* Shield */}
        <path
          d="M32 4 L56 14 V32 C56 46 46 56 32 60 C18 56 8 46 8 32 V14 Z"
          fill={shieldFill}
        />
        {!mono && !dark && (
          <path
            d="M32 5 L55 14.6 V32 C55 45.4 45.4 55.1 32 59 C18.6 55.1 9 45.4 9 32 V14.6 Z"
            fill="none"
            stroke="rgba(255,255,255,0.10)"
            strokeWidth="0.6"
          />
        )}

        {/* Upright V mark */}
        <path
          d="M19 19 L26 19 L32 41.5 L38 19 L45 19 L34.5 51 L29.5 51 Z"
          fill="#ffffff"
          fillOpacity="0.97"
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
