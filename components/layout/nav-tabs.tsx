'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { TabType } from '@/types';

interface NavTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const tabs: Array<{ id: TabType; label: string; icon: string }> = [
  { id: 'dashboard', label: 'Dashboard', icon: '◈' },
  { id: 'productos', label: 'Productos', icon: '▤' },
  { id: 'movimientos', label: 'Movimientos', icon: '↹' },
  { id: 'analytics', label: 'Analytics IA', icon: '◎' },
  { id: 'reportes', label: 'Reportes', icon: '▦' },
];

export function NavTabs({ activeTab, onTabChange }: NavTabsProps) {
  return (
    <nav className="flex gap-1 mb-6 p-1 bg-slate-900/50 rounded-xl w-fit">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
            activeTab === tab.id
              ? 'bg-slate-800 text-emerald-400 shadow-lg shadow-emerald-500/10'
              : 'text-slate-400 hover:text-slate-200'
          )}
        >
          <span>{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
