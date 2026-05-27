import React from 'react';
import { cn } from '@/lib/utils';

// =====================================================
// Vanguard Logo — doble "V" (solo el símbolo)
// =====================================================
// SVG con fondo TRANSPARENTE: solo los trazos azules de la V. El hueco
// entre los dos trazos deja ver el fondo del sistema (se camufla con el
// color de fondo que haya en ese momento). Sin texto.
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
}: LogoProps) {
  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      {/* SVG inline: transparente (se camufla con el fondo del sistema),
          siempre se renderiza y llena el cuadro (sin margen muerto como
          tenía el PNG). */}
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
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          fill="#2b62b0"
          d="M4 12 L32 60 L60 12 L48 12 L32 41 L16 12 Z M22 17 L25 17 L33.5 44 L31 44 Z"
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
// LogoMark — sólo el símbolo (icono compacto).
// =====================================================
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return <Logo size={size} className={className} />;
}

export default Logo;
