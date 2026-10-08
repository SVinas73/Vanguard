import React, { useId } from 'react';
import { cn } from '@/lib/utils';
import { VANGUARD_V_PATH, VANGUARD_BAR_PATH, VANGUARD_COLORS } from '@/lib/brand';

// =====================================================
// Vanguard Logo — "V" + barra recta separada (solo el símbolo)
// =====================================================
// SVG con fondo TRANSPARENTE. La barra es paralela a la pata izquierda,
// separada de ella y del mismo tamaño; va en un tono más claro para dar
// profundidad. Sin texto.
//
//   <Logo />            icono 32px
//   <Logo size={64} />  tamaño custom
//   <Logo withText />   icono + wordmark "Vanguard"
// =====================================================

interface LogoProps {
  size?: number;
  className?: string;
  withText?: boolean;
  /** compat con llamadas previas */
  mono?: boolean;
  dark?: boolean;
  textClassName?: string;
  gradientId?: string;
}

export function Logo({
  size = 32,
  className,
  withText = false,
  textClassName,
  gradientId,
}: LogoProps) {
  // Ids únicos por instancia: varios logos en la misma página no deben
  // compartir el mismo <linearGradient>.
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const base = gradientId ?? `vg-logo-${reactId}`;
  const gV = `${base}-v`;
  const gBar = `${base}-bar`;

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
        style={{ display: 'block' }}
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
        </defs>
        <path fill={`url(#${gBar})`} d={VANGUARD_BAR_PATH} />
        <path fill={`url(#${gV})`} d={VANGUARD_V_PATH} />
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
// LogoMark — sólo el símbolo (icono compacto).
// =====================================================
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return <Logo size={size} className={className} />;
}

export default Logo;
