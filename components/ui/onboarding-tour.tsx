'use client';
import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Sparkles } from 'lucide-react';

const STORAGE_KEY = 'vanguard-onboarding-done';

interface TourStep {
  title: string;
  description: string;
  position: { top: string; left: string };
  arrowDirection: 'left' | 'right' | 'top' | 'bottom';
}

const STEPS: TourStep[] = [
  {
    title: 'Bienvenido a Vanguard',
    description: 'Tu sistema integral de gestión de inventarios. Te guiaremos por las funciones principales.',
    position: { top: '50%', left: '50%' },
    arrowDirection: 'bottom',
  },
  {
    title: 'Navegación lateral',
    description: 'Usa la barra lateral para acceder a todos los módulos: Stock, Ventas, Compras, Reportes y más.',
    position: { top: '40%', left: '300px' },
    arrowDirection: 'left',
  },
  {
    title: 'Búsqueda rápida',
    description: 'Presiona Ctrl+K en cualquier momento para buscar productos, módulos o acciones rápidamente.',
    position: { top: '30%', left: '50%' },
    arrowDirection: 'top',
  },
  {
    title: 'Chatbot con IA',
    description: 'Usa el asistente de IA en la esquina inferior derecha para obtener ayuda, consultar datos o ejecutar acciones.',
    position: { top: '60%', left: '70%' },
    arrowDirection: 'right',
  },
];

export function OnboardingTour() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      // Small delay so the page renders first
      const timer = setTimeout(() => setIsVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;
  const isCentered = currentStep === 0;

  return (
    <div className="fixed inset-0 z-[200]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Tour card */}
      <div
        className="absolute transform -translate-x-1/2 -translate-y-1/2"
        style={{ top: step.position.top, left: step.position.left }}
      >
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-80 shadow-2xl relative">
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-emerald-400" />
              <span className="text-xs text-slate-400 font-medium">
                {currentStep + 1} / {STEPS.length}
              </span>
            </div>
            <button
              onClick={handleComplete}
              className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
              title="Saltar tour"
            >
              <X size={14} />
            </button>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1 bg-slate-800 rounded-full mb-4">
            <div
              className="h-1 bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
            />
          </div>

          {/* Content */}
          <h3 className="text-base font-semibold text-slate-200 mb-2">{step.title}</h3>
          <p className="text-sm text-slate-400 leading-relaxed mb-4">{step.description}</p>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleComplete}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Saltar
            </button>
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500
                         text-white text-sm font-medium transition-colors"
            >
              {isLastStep ? 'Comenzar' : 'Siguiente'}
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
