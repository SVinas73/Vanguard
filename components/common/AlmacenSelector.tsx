'use client';

import React from 'react';
import { Warehouse } from 'lucide-react';
import type { AlmacenOpcion } from '@/hooks/useAlmacenes';

interface AlmacenSelectorProps {
  almacenes: AlmacenOpcion[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

/**
 * Selector de almacén unificado para los módulos de análisis. Misma UI y
 * comportamiento en todos: lista los almacenes existentes (sin opción "todos")
 * y notifica el cambio. No se muestra si no hay almacenes.
 */
export function AlmacenSelector({ almacenes, value, onChange, className = '' }: AlmacenSelectorProps) {
  if (almacenes.length === 0) return null;
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Warehouse size={15} className="text-slate-500 flex-shrink-0" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-sm text-slate-200 transition-colors focus:outline-none focus:border-indigo-500"
        title="Filtrar por almacén"
      >
        {almacenes.map((a) => (
          <option key={a.id} value={a.id}>{a.nombre}</option>
        ))}
      </select>
    </div>
  );
}

export default AlmacenSelector;
