'use client';

import React, { useState } from 'react';
import { Plug, Key, Webhook } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IntegracionesDashboard } from './index';
import ApiKeysManager from '@/components/api/ApiKeysManager';
import WebhooksManager from '@/components/api/WebhooksManager';

// =====================================================
// Wrapper con 3 tabs: E-commerce, API Keys, Webhooks
// =====================================================
// Reemplaza al export plano de IntegracionesDashboard
// para incluir API-First (Sprint F).
// =====================================================

type TabId = 'ecommerce' | 'api-keys' | 'webhooks';

const TABS: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
  { id: 'ecommerce', label: 'E-commerce',  icon: Plug },
  { id: 'api-keys',  label: 'API Keys',    icon: Key },
  { id: 'webhooks',  label: 'Webhooks',    icon: Webhook },
];

export default function IntegracionesModule() {
  const [tab, setTab] = useState<TabId>('ecommerce');

  return (
    <div className="space-y-4">
      {/* Tab nav */}
      <div className="flex gap-1 border-b border-slate-800 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm transition-colors whitespace-nowrap',
                isActive
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-slate-400 hover:text-slate-200',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Contenido */}
      {tab === 'ecommerce' && <IntegracionesDashboard />}
      {tab === 'api-keys'  && <ApiKeysManager />}
      {tab === 'webhooks'  && <WebhooksManager />}
    </div>
  );
}
