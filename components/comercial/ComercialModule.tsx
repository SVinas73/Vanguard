'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { ClipboardList, LayoutDashboard, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

import SolicitudesInsumosPanel from '@/components/insumos/SolicitudesInsumosPanel';
import InsumosPendientes from '@/components/insumos/InsumosPendientes';
import OrdenInternaInsumos from '@/components/insumos/OrdenInternaInsumos';

// Análisis y Reportes en USD: se cargan solo al abrirlos (gráficos y PDF).
const AnalisisInsumosPanel = dynamic(() => import('@/components/insumos/AnalisisInsumosPanel'), { ssr: false });
const ReportesInsumosUSD = dynamic(() => import('@/components/insumos/ReportesInsumosUSD'), { ssr: false });

interface ComercialModuleProps {
  userEmail: string;
}

export default function ComercialModule({
  userEmail,
}: ComercialModuleProps) {
  // Sub-subtabs internos del panel "Solicitudes de insumos". En "Análisis de
  // insumos" hay dos vistas con el mismo motor en USD: panel y reportes.
  const [insumosSubTab, setInsumosSubTab] = useState<'solicitud' | 'orden_interna' | 'pendientes' | 'analisis'>('solicitud');
  const [analisisVista, setAnalisisVista] = useState<'panel' | 'reportes'>('panel');

  return (
    <div className="space-y-6">
      {/* Sub-tab navigation */}
      <div className="flex items-center gap-1 p-1 bg-slate-900/50 rounded-xl border border-slate-800/50 overflow-x-auto">
        <button
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
            'bg-blue-500/15 text-blue-400 shadow-sm'
          )}
        >
          <ClipboardList size={16} />
          <span>Solicitudes de insumos</span>
        </button>
      </div>

      {/* Content */}
      <div className="space-y-5">
        {/* Sub-subtabs internos (pestañas secundarias tipo pill) */}
        <div className="flex items-center gap-1">
          {([
            { id: 'solicitud' as const, label: 'Solicitud de insumos' },
            { id: 'orden_interna' as const, label: 'Orden Interna' },
            { id: 'pendientes' as const, label: 'Pendientes de aprobación' },
            { id: 'analisis' as const, label: 'Análisis de insumos' },
          ]).map((s) => {
            const isActive = insumosSubTab === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setInsumosSubTab(s.id)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap',
                  isActive
                    ? 'bg-blue-500/15 text-blue-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {insumosSubTab === 'solicitud' && <SolicitudesInsumosPanel />}

        {insumosSubTab === 'orden_interna' && <OrdenInternaInsumos />}

        {insumosSubTab === 'pendientes' && <InsumosPendientes />}

        {insumosSubTab === 'analisis' && (
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800">
            {([
              { id: 'panel' as const, label: 'Panel', icon: LayoutDashboard },
              { id: 'reportes' as const, label: 'Reportes en USD', icon: FileText },
            ]).map(v => {
              const Icon = v.icon;
              const activo = analisisVista === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setAnalisisVista(v.id)}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    activo ? 'bg-blue-500/15 text-blue-400 shadow-sm' : 'text-slate-400 hover:text-slate-200',
                  )}
                >
                  <Icon size={15} /> {v.label}
                </button>
              );
            })}
          </div>
        )}

        {insumosSubTab === 'analisis' && analisisVista === 'reportes' && (
          <ReportesInsumosUSD userEmail={userEmail} />
        )}

        {insumosSubTab === 'analisis' && analisisVista === 'panel' && <AnalisisInsumosPanel />}
      </div>
    </div>
  );
}
