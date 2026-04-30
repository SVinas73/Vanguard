'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart3, Download, RefreshCw, TrendingUp, Users,
  Clock, ShieldCheck, Target,
} from 'lucide-react';
import {
  getProductividadPickers,
  getExactitudConteos,
  getTiemposCiclo,
  aCSV,
  descargarCSV,
  type ReporteProductividadPicker,
  type ReporteExactitudConteo,
  type ReporteTiemposCiclo,
} from '@/lib/wms-reports';
import { useWmsToast } from './useWmsToast';
import { cn } from '@/lib/utils';

export default function Reportes() {
  const toast = useWmsToast();
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<7 | 30 | 90>(30);
  const [productividad, setProductividad] = useState<ReporteProductividadPicker[]>([]);
  const [exactitud, setExactitud] = useState<ReporteExactitudConteo[]>([]);
  const [tiempos, setTiempos] = useState<ReporteTiemposCiclo | null>(null);

  useEffect(() => { loadAll(); }, [periodo]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [prod, exa, tie] = await Promise.all([
        getProductividadPickers(periodo),
        getExactitudConteos(periodo * 3),
        getTiemposCiclo(periodo),
      ]);
      setProductividad(prod);
      setExactitud(exa);
      setTiempos(tie);
    } finally {
      setLoading(false);
    }
  };

  const exportarProductividad = () => {
    if (productividad.length === 0) { toast.warning('Sin datos para exportar'); return; }
    descargarCSV('productividad-pickers', aCSV(productividad as any));
    toast.success('Exportado');
  };

  const exportarExactitud = () => {
    if (exactitud.length === 0) { toast.warning('Sin datos para exportar'); return; }
    descargarCSV('exactitud-conteos', aCSV(exactitud as any));
    toast.success('Exportado');
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12"><RefreshCw className="h-8 w-8 animate-spin text-pink-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <toast.Toast />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-pink-400" />
            Reportes WMS
          </h3>
          <p className="text-sm text-slate-400 mt-0.5">
            Productividad, exactitud y tiempos de ciclo · todo exportable a CSV.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={periodo} onChange={e => setPeriodo(parseInt(e.target.value) as any)}
            className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm">
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
          </select>
          <button onClick={loadAll} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* KPIs de tiempos de ciclo */}
      {tiempos && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            icon={Target}
            label="Tiempo de picking promedio"
            value={`${tiempos.picking_a_pack_promedio_min} min`}
            sub={`${tiempos.muestras} órdenes`}
            color="text-purple-300"
          />
          <KpiCard
            icon={Clock}
            label="Pack → Despacho"
            value={`${tiempos.pack_a_despacho_promedio_min} min`}
            sub="promedio"
            color="text-blue-300"
          />
          <KpiCard
            icon={TrendingUp}
            label="Ciclo completo"
            value={`${tiempos.ciclo_completo_promedio_horas} h`}
            sub="picking + despacho"
            color="text-cyan-300"
          />
          <KpiCard
            icon={ShieldCheck}
            label="Exactitud global"
            value={exactitud.length > 0 ? `${exactitud[0].exactitud_pct}%` : '—'}
            sub={exactitud.length > 0 ? `${exactitud[0].conteos_totales} conteos` : 'Sin conteos'}
            color="text-emerald-300"
          />
        </div>
      )}

      {/* Productividad por picker */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-400" />
            Productividad por picker
          </h4>
          <button onClick={exportarProductividad}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg">
            <Download className="h-3 w-3" />
            CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/50">
              <tr className="text-left text-xs text-slate-400 uppercase">
                <th className="px-4 py-2">Picker</th>
                <th className="px-4 py-2 text-right">Órdenes</th>
                <th className="px-4 py-2 text-right">Unidades</th>
                <th className="px-4 py-2 text-right">Líneas</th>
                <th className="px-4 py-2 text-right">Picks/h</th>
                <th className="px-4 py-2 text-right">Min/uds</th>
                <th className="px-4 py-2 text-right">Exactitud</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {productividad.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-500 text-sm">
                  Sin órdenes completadas en el período
                </td></tr>
              ) : productividad.map(p => (
                <tr key={p.picker_email} className="hover:bg-slate-800/30">
                  <td className="px-4 py-2">
                    <div className="text-slate-200">{p.picker_nombre || p.picker_email.split('@')[0]}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{p.picker_email}</div>
                  </td>
                  <td className="px-4 py-2 text-right text-slate-300">{p.ordenes_completadas}</td>
                  <td className="px-4 py-2 text-right text-slate-300">{p.unidades_pickeadas}</td>
                  <td className="px-4 py-2 text-right text-slate-300">{p.lineas_completadas}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={cn('font-semibold',
                      p.picks_por_hora > 30 ? 'text-emerald-300' :
                      p.picks_por_hora > 15 ? 'text-blue-300' :
                      'text-amber-300'
                    )}>
                      {p.picks_por_hora}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-slate-400">{p.min_por_unidad}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={cn(
                      p.exactitud_pct >= 99 ? 'text-emerald-300' :
                      p.exactitud_pct >= 95 ? 'text-blue-300' :
                      'text-orange-300'
                    )}>
                      {p.exactitud_pct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Exactitud de conteos */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Exactitud de inventario (últimos 90 días)
          </h4>
          <button onClick={exportarExactitud}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg">
            <Download className="h-3 w-3" />
            CSV
          </button>
        </div>
        <div className="p-4">
          {exactitud.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-sm">
              Sin conteos completados en el período
            </div>
          ) : exactitud.map((e, idx) => (
            <div key={idx} className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-xs text-slate-500 uppercase">Conteos totales</div>
                <div className="text-xl font-bold text-slate-100 mt-0.5">{e.conteos_totales}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase">Con diferencias</div>
                <div className="text-xl font-bold text-amber-300 mt-0.5">{e.con_diferencias}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase">Exactitud</div>
                <div className={cn('text-xl font-bold mt-0.5',
                  e.exactitud_pct >= 98 ? 'text-emerald-300' :
                  e.exactitud_pct >= 95 ? 'text-blue-300' :
                  'text-orange-300'
                )}>
                  {e.exactitud_pct}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-400">{label}</span>
        <Icon className={cn('h-3.5 w-3.5', color)} />
      </div>
      <div className={cn('text-xl font-bold', color)}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}
