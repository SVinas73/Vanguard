'use client';

import { Calendar } from 'lucide-react';

interface PeriodSelectorProps {
  value: string;
  onChange: (period: string) => void;
}

const PERIODS = [
  { key: '7d', label: '7 días' },
  { key: '30d', label: '30 días' },
  { key: '90d', label: '90 días' },
];

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <Calendar size={14} className="text-slate-500" />
      <div className="flex gap-0.5 p-0.5 rounded-lg bg-slate-800/50">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => onChange(p.key)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{
              background: value === p.key ? 'rgba(61,154,95,0.15)' : 'transparent',
              color: value === p.key ? '#4aaa73' : 'rgba(148,163,184,0.5)',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
