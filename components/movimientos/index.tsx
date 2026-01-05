import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import { Movement, Product, AnomalyResult } from '@/types';
import { AIAlert } from '@/components/ui';
import { detectAnomaly } from '@/lib/ai';

// ============================================
// MOVEMENT CARD
// ============================================

interface MovementCardProps {
  movement: Movement;
  product?: Product;
  anomaly?: AnomalyResult;
}

export function MovementCard({ movement, product, anomaly }: MovementCardProps) {
  const isEntrada = movement.tipo === 'entrada';

  return (
    <div
      className={cn(
        'p-4 rounded-xl border transition-all',
        anomaly?.isAnomaly
          ? 'bg-amber-500/5 border-amber-500/30'
          : 'bg-slate-900/50 border-slate-800/50 hover:border-slate-700/50'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center text-xl',
              isEntrada
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-red-500/20 text-red-400'
            )}
          >
            {isEntrada ? '↓' : '↑'}
          </div>
          <div>
            <div className="font-medium text-sm">
              {product?.descripcion || movement.codigo}
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span>{movement.codigo}</span>
              <span>•</span>
              <span>{movement.usuario}</span>
              <span>•</span>
              <span>{formatDate(movement.timestamp)}</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div
            className={cn(
              'font-mono font-bold text-lg',
              isEntrada ? 'text-emerald-400' : 'text-red-400'
            )}
          >
            {isEntrada ? '+' : '-'}
            {movement.cantidad}
          </div>
          {movement.notas && (
            <div className="text-xs text-slate-500">{movement.notas}</div>
          )}
        </div>
      </div>

      {anomaly?.isAnomaly && (
        <div className="mt-3">
          <AIAlert type="warning">{anomaly.reason}</AIAlert>
        </div>
      )}
    </div>
  );
}

// ============================================
// MOVEMENT LIST
// ============================================

interface MovementListProps {
  movements: Movement[];
  products: Product[];
  showAnomalies?: boolean;
}

export function MovementList({
  movements,
  products,
  showAnomalies = true,
}: MovementListProps) {
  const { t } = useTranslation();
  // Ordenar por fecha descendente
  const sortedMovements = [...movements].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="space-y-3">
      {sortedMovements.map((mov) => {
        const product = products.find((p) => p.codigo === mov.codigo);
        let anomaly: AnomalyResult | undefined;

        if (showAnomalies && product) {
          anomaly = detectAnomaly(
            mov,
            product,
            movements.filter((m) => m.id !== mov.id)
          );
        }

        return (
          <MovementCard
            key={mov.id}
            movement={mov}
            product={product}
            anomaly={anomaly}
          />
        );
      })}

      {movements.length === 0 && (
        <div className="p-8 text-center text-slate-500 rounded-xl border border-slate-800/50">
          {t('movements.noMovements')}
        </div>
      )}
    </div>
  );
}

// ============================================
// MOVEMENT TYPE SELECTOR
// ============================================

interface MovementTypeSelectorProps {
  value: 'entrada' | 'salida';
  onChange: (value: 'entrada' | 'salida') => void;
}

export function MovementTypeSelector({ value, onChange }: MovementTypeSelectorProps) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => onChange('entrada')}
        className={cn(
          'px-4 py-3 rounded-xl border text-sm font-medium transition-all',
          value === 'entrada'
            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
            : 'border-slate-700 hover:border-slate-600 text-slate-400'
        )}
      >
        ↓ {t('movements.entry')}
      </button>
      <button
        type="button"
        onClick={() => onChange('salida')}
        className={cn(
          'px-4 py-3 rounded-xl border text-sm font-medium transition-all',
          value === 'salida'
            ? 'bg-red-500/20 border-red-500/50 text-red-400'
            : 'border-slate-700 hover:border-slate-600 text-slate-400'
        )}
      >
        ↑ {t('movements.exit')}
      </button>
    </div>
  );
}

// ============================================
// MOVEMENT STATS (Today summary)
// ============================================

interface MovementStatsProps {
  movements: Movement[];
}

export function MovementStats({ movements }: MovementStatsProps) {
  const { t } = useTranslation(); 
  const today = new Date();
  const todayMovements = movements.filter((m) => {
    const mDate = new Date(m.timestamp);
    return mDate.toDateString() === today.toDateString();
  });

  const entradas = todayMovements.filter((m) => m.tipo === 'entrada');
  const salidas = todayMovements.filter((m) => m.tipo === 'salida');

  const totalEntradas = entradas.reduce((sum, m) => sum + m.cantidad, 0);
  const totalSalidas = salidas.reduce((sum, m) => sum + m.cantidad, 0);

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30 text-center">
        <div className="text-2xl font-bold text-slate-200">{todayMovements.length}</div>
        <div className="text-xs text-slate-500">{t('dashboard.movementsToday')}</div>  {/* ANTES: Movimientos hoy */}
      </div>
      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
        <div className="text-2xl font-bold text-emerald-400">+{totalEntradas}</div>
        <div className="text-xs text-slate-500">{entradas.length} {t('movements.entry').toLowerCase()}s</div>  {/* ANTES: entradas */}
      </div>
      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
        <div className="text-2xl font-bold text-red-400">-{totalSalidas}</div>
        <div className="text-xs text-slate-500">{salidas.length} {t('movements.exit').toLowerCase()}s</div>  {/* ANTES: salidas */}
      </div>
    </div>
  );
}
