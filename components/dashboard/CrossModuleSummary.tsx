'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ShoppingCart,
  ShoppingBag,
  RotateCcw,
  FolderKanban,
  Wrench,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
} from 'lucide-react';

interface ModuleData {
  comprasPendientes: number;
  comprasTotal: number;
  ventasAbiertas: number;
  ventasTotal: number;
  rmasActivos: number;
  tareasActivas: number;
  tallerPendiente: number;
  porCobrar: number;
  porPagar: number;
}

export function CrossModuleSummary({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [data, setData] = useState<ModuleData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const results = await Promise.allSettled([
          supabase.from('ordenes_compra').select('id, total, estado').not('estado', 'in', '(recibida,cancelada)'),
          supabase.from('ordenes_venta').select('id, total, estado').not('estado', 'in', '(entregada,cancelada)'),
          supabase.from('rma').select('id, estado').not('estado', 'in', '(completada,cancelada,rechazada)'),
          supabase.from('proyecto_tareas').select('id, estado'),
          supabase.from('ordenes_taller').select('id, estado').not('estado', 'in', '(entregado,cancelado)'),
          supabase.from('cuentas_por_cobrar').select('monto, estado').neq('estado', 'pagada'),
          supabase.from('cuentas_por_pagar').select('monto, estado').neq('estado', 'pagada'),
        ]);

        const getData = (r: PromiseSettledResult<any>) =>
          r.status === 'fulfilled' && r.value.data ? r.value.data : [];

        const compras = getData(results[0]);
        const ventas = getData(results[1]);
        const rmas = getData(results[2]);
        const tareas = getData(results[3]);
        const taller = getData(results[4]);
        const cxc = getData(results[5]);
        const cxp = getData(results[6]);

        setData({
          comprasPendientes: compras.length,
          comprasTotal: compras.reduce((s: number, c: any) => s + (c.total || 0), 0),
          ventasAbiertas: ventas.length,
          ventasTotal: ventas.reduce((s: number, v: any) => s + (v.total || 0), 0),
          rmasActivos: rmas.length,
          tareasActivas: tareas.filter((t: any) => t.estado && t.estado !== 'done' && t.estado !== 'completada').length,
          tallerPendiente: taller.length,
          porCobrar: cxc.reduce((s: number, c: any) => s + (c.monto || 0), 0),
          porPagar: cxp.reduce((s: number, c: any) => s + (c.monto || 0), 0),
        });
      } catch (err) {
        console.error('CrossModule fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 size={18} className="animate-spin text-slate-600" />
      </div>
    );
  }

  if (!data) return null;

  const metrics = [
    {
      label: 'Compras Pendientes',
      count: data.comprasPendientes,
      sub: data.comprasTotal > 0 ? `$${data.comprasTotal.toLocaleString('es-UY', { maximumFractionDigits: 0 })}` : undefined,
      icon: <ShoppingCart size={16} />,
      color: '#4a7fb5',
      tab: 'compras',
    },
    {
      label: 'Ventas Abiertas',
      count: data.ventasAbiertas,
      sub: data.ventasTotal > 0 ? `$${data.ventasTotal.toLocaleString('es-UY', { maximumFractionDigits: 0 })}` : undefined,
      icon: <ShoppingBag size={16} />,
      color: '#9ec9b1',
      tab: 'ventas',
    },
    {
      label: 'RMAs Activos',
      count: data.rmasActivos,
      icon: <RotateCcw size={16} />,
      color: '#d6b97a',
      tab: 'rma',
    },
    {
      label: 'Tareas Activas',
      count: data.tareasActivas,
      icon: <FolderKanban size={16} />,
      color: '#836ba0',
      tab: 'proyectos',
    },
    {
      label: 'Taller Pendiente',
      count: data.tallerPendiente,
      icon: <Wrench size={16} />,
      color: '#6b8baa',
      tab: 'taller',
    },
    {
      label: 'Por Cobrar',
      count: undefined,
      sub: `$${data.porCobrar.toLocaleString('es-UY', { maximumFractionDigits: 0 })}`,
      icon: <ArrowDownLeft size={16} />,
      color: '#9ec9b1',
      tab: 'finanzas',
    },
    {
      label: 'Por Pagar',
      count: undefined,
      sub: `$${data.porPagar.toLocaleString('es-UY', { maximumFractionDigits: 0 })}`,
      icon: <ArrowUpRight size={16} />,
      color: '#dfa6a6',
      tab: 'finanzas',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      {metrics.map((m) => (
        <button
          key={m.label}
          onClick={() => onNavigate?.(m.tab)}
          className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all text-left group"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-md" style={{ background: `${m.color}15` }}>
              <span style={{ color: m.color }}>{m.icon}</span>
            </div>
          </div>
          {m.count !== undefined && (
            <div className="text-xl font-bold text-white">{m.count}</div>
          )}
          {m.sub && (
            <div className="text-sm font-semibold" style={{ color: m.color }}>
              {m.sub}
            </div>
          )}
          <div className="text-[10px] text-slate-500 mt-1 leading-tight">{m.label}</div>
        </button>
      ))}
    </div>
  );
}
