'use client';

import dynamic from 'next/dynamic';
import type { CallBackProps, Step } from 'react-joyride';

const Joyride = dynamic(() => import('react-joyride'), { ssr: false });

const STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    title: '¡Bienvenido a Vanguard!',
    content:
      'Te voy a llevar por los puntos principales del sistema en 6 pasos. Podés saltearlo cuando quieras con Esc o cerrar.',
    disableBeacon: true,
  },
  {
    target: '[data-tour="sidebar"]',
    placement: 'right',
    title: 'Navegación',
    content:
      'Acá tenés todos los módulos agrupados: Núcleo, Operaciones, Post-venta, Análisis, Control y Configuración. Cliqueá cualquier sección para expandirla.',
  },
  {
    target: '[data-tour="org-switcher"]',
    placement: 'bottom',
    title: 'Tu empresa activa',
    content:
      'Si manejás varias empresas (multi-tenant), las cambiás desde acá. Cada empresa tiene sus datos aislados.',
  },
  {
    target: '[data-tour="dashboard"]',
    placement: 'right',
    title: 'Dashboard',
    content:
      'La pantalla principal con el estado del negocio. Para visión financiera de gerencia, mirá la Vista Ejecutiva.',
  },
  {
    target: '[data-tour="asistente"]',
    placement: 'left',
    title: 'Asistente IA',
    content:
      'El botón flotante abajo a la derecha abre un chat con IA que entiende lenguaje natural y puede consultar/modificar datos por vos.',
  },
  {
    target: '[data-tour="ayuda"]',
    placement: 'right',
    title: 'Centro de Ayuda',
    content:
      'Si te perdés, acá tenés guías de cada módulo. Podés repetir este tour desde el botón "Hacer el tour guiado" en la página de ayuda.',
  },
];

interface WelcomeTourProps {
  run: boolean;
  onFinish: () => void;
}

export default function WelcomeTour({ run, onFinish }: WelcomeTourProps) {
  const handleCallback = (data: CallBackProps) => {
    const { status, type } = data;
    if (status === 'finished' || status === 'skipped' || type === 'tour:end') {
      onFinish();
    }
  };

  return (
    <Joyride
      steps={STEPS}
      run={run}
      continuous
      showProgress
      showSkipButton
      callback={handleCallback}
      locale={{
        back: 'Atrás',
        close: 'Cerrar',
        last: 'Listo',
        next: 'Siguiente',
        skip: 'Saltar',
      }}
      styles={{
        options: {
          primaryColor: '#3b82f6',
          backgroundColor: '#0f172a',
          textColor: '#e2e8f0',
          arrowColor: '#0f172a',
          overlayColor: 'rgba(0, 0, 0, 0.7)',
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: 8,
          fontSize: 14,
          border: '1px solid #1e293b',
        },
        tooltipTitle: {
          color: '#ffffff',
          fontSize: 16,
        },
        buttonNext: {
          backgroundColor: '#3b82f6',
          borderRadius: 6,
          fontSize: 13,
        },
        buttonBack: {
          color: '#94a3b8',
          fontSize: 13,
        },
        buttonSkip: {
          color: '#94a3b8',
          fontSize: 13,
        },
      }}
    />
  );
}
