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

const AZUL = '#2b62b0';

export function Logo({
  size = 32,
  className,
  withText = false,
  textClassName,
}: LogoProps) {
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
        {/* V rellena (banda) con apertura central + ranura diagonal en el
            brazo izquierdo. fill-rule evenodd → los huecos dejan ver el
            fondo del sistema, así se camufla con el color del momento. */}
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          fill={AZUL}
          d="M9 14 L32 56 L55 14 Z M22 19 L32 37 L42 19 Z M16 19 L19.5 19 L30 42 L26.5 42 Z"
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
