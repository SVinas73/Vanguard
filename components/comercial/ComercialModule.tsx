'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useInventoryStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { DashboardView } from '@/components/dashboard';

import SolicitudesInsumosPanel from '@/components/insumos/SolicitudesInsumosPanel';
import InsumosPendientes from '@/components/insumos/InsumosPendientes';
import OrdenInternaInsumos from '@/components/insumos/OrdenInternaInsumos';

interface ComercialModuleProps {
  userEmail: string;
}

export default function ComercialModule({
  userEmail,
}: ComercialModuleProps) {
  // Sub-subtabs internos del panel "Solicitudes de insumos":
  // - 'solicitud' → SolicitudesInsumosPanel (lo actual)
  // - 'analisis'  → DashboardView (réplica del Dashboard) filtrado a insumos
  const [insumosSubTab, setInsumosSubTab] = useState<'solicitud' | 'orden_interna' | 'pendientes' | 'analisis'>('solicitud');
  const [insumosPeriod, setInsumosPeriod] = useState('30d');

  // Datos del store para el "Análisis de insumos"
  const { products: allProducts, movements: allMovements, predictions, fetchProducts, fetchMovements } = useInventoryStore();

  // Lista de almacenes para identificar cuáles son de insumos (nombre contiene "insumo")
  const [almacenes, setAlmacenes] = useState<Array<{ id: string; nombre: string }>>([]);
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('almacenes')
      .select('id, nombre')
      .then(({ data }) => {
        if (!cancelled && data) setAlmacenes(data);
      });
    return () => { cancelled = true; };
  }, []);

  const insumosAlmacenIds = useMemo(
    () => new Set(
      almacenes
        .filter(a => (a.nombre || '').toLowerCase().includes('insumo'))
        .map(a => a.id)
    ),
    [almacenes]
  );

  // Productos / movimientos filtrados al/los almacén(es) de insumos
  const insumosProducts = useMemo(
    () => allProducts.filter(p => p.almacenId != null && insumosAlmacenIds.has(p.almacenId)),
    [allProducts, insumosAlmacenIds]
  );
  const insumosMovements = useMemo(() => {
    const codes = new Set(insumosProducts.map(p => p.codigo));
    return allMovements.filter(m => codes.has(m.codigo));
  }, [allMovements, insumosProducts]);

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
          <DashboardView
            products={insumosProducts}
            movements={insumosMovements}
            predictions={predictions}
            userName={userEmail?.split('@')[0]}
            period={insumosPeriod}
            onPeriodChange={setInsumosPeriod}
            onNavigate={() => setInsumosSubTab('solicitud')}
            onRefresh={() => { fetchProducts(); fetchMovements(); }}
            flowSource="movements"
          />
        )}
      </div>
    </div>
  );
}
