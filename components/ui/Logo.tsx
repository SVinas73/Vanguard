import React from 'react';
import { cn } from '@/lib/utils';

// =====================================================
// Vanguard Logo
// =====================================================
// Renderiza el escudo real desde /vang.png (el archivo que subís a
// /public). Así el logo es EXACTO en todo el sistema y se actualiza
// con solo reemplazar ese archivo — sin recreaciones en SVG.
//
//   <Logo />            icono 32px
//   <Logo size={64} />  tamaño custom
//   <Logo withText />   icono + wordmark "Vanguard"
// =====================================================

interface LogoProps {
  size?: number;
  className?: string;
  withText?: boolean;
  /** compat con llamadas previas — ya no afectan (el logo es una imagen) */
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
}: LogoProps) {
  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      <img
        src="/vang.png"
        width={size}
        height={size}
        alt="Vanguard"
        style={{ width: size, height: size, objectFit: 'contain', display: 'block' }}
      />
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
