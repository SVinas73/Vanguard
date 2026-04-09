'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import {
  Activity, AlertTriangle, CheckCircle, Clock, Cpu, RefreshCw,
  Shield, TrendingUp, Wrench, ChevronRight, Eye, Plus,
  BarChart3, Calendar, Bell, Settings, Package, Gauge,
  ArrowUpRight, ArrowDownRight, Loader2, X, Search,
  Truck, Cog, Zap, AlertCircle, Info, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { pdmApi, type DashboardEquipo, type PdmAlerta, type PdmEvento, type PdmLectura, type PdmPrediccion } from '@/lib/pdm-api';

// ============================================
// TYPES
// ============================================

type PdmVista = 'dashboard' | 'equipos' | 'alertas' | 'planes';

interface PdmMetricas {
  totalEquipos: number;
  equiposRiesgoAlto: number;
  equiposRiesgoMedio: number;
  equiposRiesgoBajo: number;
  alertasPendientes: number;
  mtbfPromedio: number | null;
  proximosServices: number;
}

// ============================================
// CONSTANTS
// ============================================

const RIESGO_CONFIG = {
  rojo: { label: 'pdm.riskHigh', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', icon: AlertTriangle },
  amarillo: { label: 'pdm.riskMedium', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: AlertCircle },
  verde: { label: 'pdm.riskLow', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: CheckCircle },
} as const;

const TIPO_EQUIPO_ICON: Record<string, typeof Wrench> = {
  herramienta: Wrench,
  vehiculo: Truck,
  maquinaria: Cog,
  electronico: Zap,
  otro: Settings,
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function MantenimientoPredictivo() {
  const { t } = useTranslation();
  const { user } = useAuth();

  // State
  const [vista, setVista] = useState<PdmVista>('dashboard');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [aiOnline, setAiOnline] = useState<boolean | null>(null);

  // Data
  const [dashboard, setDashboard] = useState<DashboardEquipo[]>([]);
  const [alertas, setAlertas] = useState<PdmAlerta[]>([]);
  const [metricas, setMetricas] = useState<PdmMetricas | null>(null);

  // Detail
  const [equipoSeleccionado, setEquipoSeleccionado] = useState<string | null>(null);
  const [equipoEventos, setEquipoEventos] = useState<PdmEvento[]>([]);
  const [equipoLecturas, setEquipoLecturas] = useState<PdmLectura[]>([]);
  const [equipoPrediccion, setEquipoPrediccion] = useState<PdmPrediccion | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroRiesgo, setFiltroRiesgo] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');

  // New reading modal
  const [showLecturaModal, setShowLecturaModal] = useState(false);
  const [lecturaForm, setLecturaForm] = useState<{ tipo: string; valor: string; unidad: string }>({
    tipo: 'horometro', valor: '', unidad: 'horas',
  });

  // ============================================
  // LOAD DATA
  // ============================================

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashData, alertData, metricData] = await Promise.all([
        pdmApi.getDashboard(),
        pdmApi.getAlertas(),
        pdmApi.getMetricasGlobales(),
      ]);
      setDashboard(dashData);
      setAlertas(alertData);
      setMetricas(metricData);
    } catch (err) {
      console.error('Error loading PdM data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkAiStatus = useCallback(async () => {
    const online = await pdmApi.healthCheck();
    setAiOnline(online);
  }, []);

  useEffect(() => {
    loadData();
    checkAiStatus();
  }, [loadData, checkAiStatus]);

  // ============================================
  // ACTIONS
  // ============================================

  const handleSync = async () => {
    setSyncing(true);
    try {
      const synced = await pdmApi.syncFromTaller();
      await loadData();
      alert(t('pdm.syncComplete', { count: String(synced) } as any));
    } catch (err) {
      console.error('Sync error:', err);
      alert(t('pdm.syncError'));
    } finally {
      setSyncing(false);
    }
  };

  const handleSelectEquipo = async (equipoId: string) => {
    setEquipoSeleccionado(equipoId);
    try {
      const [eventos, lecturas, prediccion] = await Promise.all([
        pdmApi.getEventos(equipoId),
        pdmApi.getLecturas(equipoId),
        pdmApi.getPrediccion(equipoId),
      ]);
      setEquipoEventos(eventos);
      setEquipoLecturas(lecturas);
      setEquipoPrediccion(prediccion);
    } catch (err) {
      console.error('Error loading equipment detail:', err);
    }
  };

  const handleRequestPrediction = async (equipoId: string) => {
    try {
      await pdmApi.requestPrediction(equipoId);
      await handleSelectEquipo(equipoId);
      await loadData();
    } catch (err) {
      alert(t('pdm.predictionError'));
    }
  };

  const handleSaveLectura = async () => {
    if (!equipoSeleccionado || !lecturaForm.valor) return;
    try {
      await pdmApi.createLectura({
        equipo_id: equipoSeleccionado,
        tipo_medidor: lecturaForm.tipo as any,
        valor: parseFloat(lecturaForm.valor),
        unidad: lecturaForm.unidad,
        registrado_por: user?.email || 'Sistema',
      });
      setShowLecturaModal(false);
      setLecturaForm({ tipo: 'horometro', valor: '', unidad: 'horas' });
      await handleSelectEquipo(equipoSeleccionado);
    } catch (err) {
      alert(t('pdm.readingError'));
    }
  };

  const handleResolveAlert = async (alertaId: string) => {
    try {
      await pdmApi.resolverAlerta(alertaId, t('pdm.resolvedManually'), user?.email || 'Sistema');
      await loadData();
    } catch (err) {
      console.error('Error resolving alert:', err);
    }
  };

  // ============================================
  // FILTERED DATA
  // ============================================

  const equiposFiltrados = useMemo(() => {
    return dashboard.filter(e => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const match = [e.marca, e.modelo, e.serie, e.matricula, e.cliente_nombre]
          .filter(Boolean)
          .some(v => v!.toLowerCase().includes(term));
        if (!match) return false;
      }
      if (filtroRiesgo && e.nivel_riesgo !== filtroRiesgo) return false;
      if (filtroTipo && e.tipo_equipo !== filtroTipo) return false;
      return true;
    });
  }, [dashboard, searchTerm, filtroRiesgo, filtroTipo]);

  const equipoDetalle = useMemo(() => {
    return dashboard.find(e => e.equipo_id === equipoSeleccionado) || null;
  }, [dashboard, equipoSeleccionado]);

  // ============================================
  // RENDER HELPERS
  // ============================================

  const RiskBadge = ({ nivel }: { nivel: 'verde' | 'amarillo' | 'rojo' | null }) => {
    const config = RIESGO_CONFIG[nivel || 'verde'];
    const Icon = config.icon;
    return (
      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', config.bg, config.color, 'border', config.border)}>
        <Icon size={12} />
        {t(config.label)}
      </span>
    );
  };

  const TTFDisplay = ({ dias, horas }: { dias: number | null; horas: number | null }) => {
    if (dias === null && horas === null) return <span className="text-slate-500">--</span>;
    return (
      <span className="text-sm font-mono">
        {dias !== null && <span>{Math.round(dias)} {t('pdm.days')}</span>}
        {dias !== null && horas !== null && <span className="text-slate-600 mx-1">/</span>}
        {horas !== null && <span>{Math.round(horas)}h</span>}
      </span>
    );
  };

  const ProbabilityBar = ({ value }: { value: number }) => {
    const pct = Math.round(value * 100);
    const color = pct >= 70 ? 'bg-red-500' : pct >= 40 ? 'bg-amber-500' : 'bg-emerald-500';
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs font-mono w-10 text-right">{pct}%</span>
      </div>
    );
  };

  // ============================================
  // RENDER: KPI CARDS
  // ============================================

  const renderKPIs = () => {
    if (!metricas) return null;
    const kpis = [
      { label: t('pdm.totalEquipment'), value: metricas.totalEquipos, icon: Settings, color: 'text-blue-400' },
      { label: t('pdm.highRisk'), value: metricas.equiposRiesgoAlto, icon: AlertTriangle, color: 'text-red-400' },
      { label: t('pdm.mediumRisk'), value: metricas.equiposRiesgoMedio, icon: AlertCircle, color: 'text-amber-400' },
      { label: t('pdm.pendingAlerts'), value: metricas.alertasPendientes, icon: Bell, color: 'text-purple-400' },
      { label: t('pdm.upcomingServices'), value: metricas.proximosServices, icon: Calendar, color: 'text-cyan-400' },
      { label: t('pdm.avgMTBF'), value: metricas.mtbfPromedio ? `${Math.round(metricas.mtbfPromedio)}d` : '--', icon: TrendingUp, color: 'text-emerald-400' },
    ];

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <kpi.icon size={18} className={kpi.color} />
            </div>
            <div className="text-xl font-bold text-slate-100">{kpi.value}</div>
            <div className="text-xs text-slate-400 mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>
    );
  };

  // ============================================
  // RENDER: EQUIPMENT TABLE
  // ============================================

  const renderEquiposTable = () => (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Filters */}
      <div className="p-4 border-b border-slate-800 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder={t('pdm.searchEquipment')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder:text-slate-500"
          />
        </div>
        <select value={filtroRiesgo} onChange={e => setFiltroRiesgo(e.target.value)} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300">
          <option value="">{t('pdm.allRiskLevels')}</option>
          <option value="rojo">{t('pdm.riskHigh')}</option>
          <option value="amarillo">{t('pdm.riskMedium')}</option>
          <option value="verde">{t('pdm.riskLow')}</option>
        </select>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300">
          <option value="">{t('pdm.allTypes')}</option>
          <option value="herramienta">{t('pdm.typeTool')}</option>
          <option value="vehiculo">{t('pdm.typeVehicle')}</option>
          <option value="maquinaria">{t('pdm.typeMachinery')}</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left p-3 text-xs font-medium text-slate-400 uppercase">{t('pdm.equipment')}</th>
              <th className="text-left p-3 text-xs font-medium text-slate-400 uppercase">{t('pdm.client')}</th>
              <th className="text-left p-3 text-xs font-medium text-slate-400 uppercase">{t('pdm.riskLevel')}</th>
              <th className="text-left p-3 text-xs font-medium text-slate-400 uppercase">{t('pdm.failureProbability')}</th>
              <th className="text-left p-3 text-xs font-medium text-slate-400 uppercase">{t('pdm.ttf')}</th>
              <th className="text-left p-3 text-xs font-medium text-slate-400 uppercase">{t('pdm.lastService')}</th>
              <th className="text-left p-3 text-xs font-medium text-slate-400 uppercase">{t('pdm.failures')}</th>
              <th className="text-right p-3 text-xs font-medium text-slate-400 uppercase">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {equiposFiltrados.map(equipo => {
              const TipoIcon = TIPO_EQUIPO_ICON[equipo.tipo_equipo] || Settings;
              return (
                <tr
                  key={equipo.equipo_id}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer"
                  onClick={() => handleSelectEquipo(equipo.equipo_id)}
                >
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-slate-800">
                        <TipoIcon size={16} className="text-slate-400" />
                      </div>
                      <div>
                        <div className="font-medium text-slate-200 text-sm">
                          {[equipo.marca, equipo.modelo].filter(Boolean).join(' ') || equipo.tipo_equipo}
                        </div>
                        <div className="text-xs text-slate-500">
                          {equipo.serie && `S/N: ${equipo.serie}`}
                          {equipo.matricula && ` • ${equipo.matricula}`}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-sm text-slate-400">{equipo.cliente_nombre || '--'}</td>
                  <td className="p-3"><RiskBadge nivel={equipo.nivel_riesgo} /></td>
                  <td className="p-3 w-40">
                    {equipo.probabilidad_fallo !== null
                      ? <ProbabilityBar value={equipo.probabilidad_fallo} />
                      : <span className="text-xs text-slate-500">{t('pdm.noPrediction')}</span>
                    }
                  </td>
                  <td className="p-3"><TTFDisplay dias={equipo.ttf_dias} horas={equipo.ttf_horas} /></td>
                  <td className="p-3 text-sm text-slate-400">
                    {equipo.fecha_ultimo_service
                      ? new Date(equipo.fecha_ultimo_service).toLocaleDateString()
                      : '--'}
                  </td>
                  <td className="p-3 text-sm text-slate-300 font-mono">{equipo.total_fallas_historicas}</td>
                  <td className="p-3 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSelectEquipo(equipo.equipo_id); }}
                      className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {equiposFiltrados.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  {loading ? t('common.loading') : t('pdm.noEquipment')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ============================================
  // RENDER: EQUIPMENT DETAIL PANEL
  // ============================================

  const renderEquipoDetalle = () => {
    if (!equipoDetalle) return null;
    const eq = equipoDetalle;

    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/50" onClick={() => setEquipoSeleccionado(null)} />
        <div className="relative w-full max-w-2xl bg-slate-900 border-l border-slate-800 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between z-10">
            <div>
              <h3 className="font-semibold text-slate-100">
                {[eq.marca, eq.modelo].filter(Boolean).join(' ') || eq.tipo_equipo}
              </h3>
              <p className="text-sm text-slate-400">
                {eq.serie && `S/N: ${eq.serie}`}{eq.matricula && ` • ${eq.matricula}`}
                {eq.cliente_nombre && ` • ${eq.cliente_nombre}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {aiOnline && (
                <button
                  onClick={() => handleRequestPrediction(eq.equipo_id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg"
                >
                  <Cpu size={14} />
                  {t('pdm.runPrediction')}
                </button>
              )}
              <button onClick={() => setEquipoSeleccionado(null)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Risk Semaphore */}
            <div className={cn(
              'p-4 rounded-xl border',
              eq.nivel_riesgo === 'rojo' ? 'bg-red-500/5 border-red-500/30' :
              eq.nivel_riesgo === 'amarillo' ? 'bg-amber-500/5 border-amber-500/30' :
              'bg-emerald-500/5 border-emerald-500/30'
            )}>
              <div className="flex items-center justify-between mb-3">
                <RiskBadge nivel={eq.nivel_riesgo} />
                {eq.confianza_modelo && (
                  <span className="text-xs text-slate-500">{t('pdm.confidence')}: {Math.round(eq.confianza_modelo * 100)}%</span>
                )}
              </div>
              {eq.probabilidad_fallo !== null && (
                <div className="mb-3">
                  <div className="text-xs text-slate-400 mb-1">{t('pdm.failureProbability')}</div>
                  <ProbabilityBar value={eq.probabilidad_fallo} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-xs text-slate-400">{t('pdm.ttf')}</div>
                  <div className="text-lg font-bold text-slate-100">
                    <TTFDisplay dias={eq.ttf_dias} horas={eq.ttf_horas} />
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">{t('pdm.nextService')}</div>
                  <div className="text-lg font-bold text-slate-100">
                    {eq.proxima_fecha_service ? new Date(eq.proxima_fecha_service).toLocaleDateString() : '--'}
                  </div>
                </div>
              </div>
              {eq.accion_recomendada && (
                <div className="mt-3 p-3 bg-slate-800/50 rounded-lg">
                  <div className="text-xs text-slate-400 mb-1">{t('pdm.recommendedAction')}</div>
                  <div className="text-sm text-slate-200">{eq.accion_recomendada}</div>
                </div>
              )}
            </div>

            {/* Suggested Spare Parts */}
            {eq.repuestos_sugeridos && eq.repuestos_sugeridos.length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <h4 className="font-medium text-slate-200 mb-3 flex items-center gap-2">
                  <Package size={16} className="text-amber-400" />
                  {t('pdm.suggestedParts')}
                </h4>
                <div className="space-y-2">
                  {eq.repuestos_sugeridos.map((rep, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg">
                      <div>
                        <div className="text-sm text-slate-200">{rep.nombre}</div>
                        <div className="text-xs text-slate-500">{rep.motivo}</div>
                      </div>
                      <div className="text-sm font-medium text-amber-400">x{rep.cantidad_sugerida}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Equipment Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-center">
                <div className="text-xs text-slate-400">{t('pdm.operatingHours')}</div>
                <div className="text-lg font-bold text-slate-100">{eq.horas_uso_acumuladas || 0}h</div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-center">
                <div className="text-xs text-slate-400">{t('pdm.avgMTBF')}</div>
                <div className="text-lg font-bold text-slate-100">{eq.mtbf_dias ? `${Math.round(eq.mtbf_dias)}d` : '--'}</div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-center">
                <div className="text-xs text-slate-400">{t('pdm.totalFailures')}</div>
                <div className="text-lg font-bold text-slate-100">{eq.total_fallas_historicas}</div>
              </div>
            </div>

            {/* Register Reading */}
            <button
              onClick={() => setShowLecturaModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl text-sm text-slate-300 transition-colors"
            >
              <Plus size={16} />
              {t('pdm.registerReading')}
            </button>

            {/* Recent Readings */}
            {equipoLecturas.length > 0 && (
              <div>
                <h4 className="font-medium text-slate-300 mb-2 text-sm">{t('pdm.recentReadings')}</h4>
                <div className="space-y-1">
                  {equipoLecturas.slice(0, 5).map(l => (
                    <div key={l.id} className="flex items-center justify-between p-2 bg-slate-800/30 rounded-lg text-sm">
                      <span className="text-slate-400 capitalize">{l.tipo_medidor}</span>
                      <span className="font-mono text-slate-200">{l.valor} {l.unidad}</span>
                      <span className="text-xs text-slate-500">{l.fecha_lectura ? new Date(l.fecha_lectura).toLocaleDateString() : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Maintenance History */}
            {equipoEventos.length > 0 && (
              <div>
                <h4 className="font-medium text-slate-300 mb-2 text-sm">{t('pdm.maintenanceHistory')}</h4>
                <div className="space-y-2">
                  {equipoEventos.slice(0, 10).map(ev => (
                    <div key={ev.id} className="p-3 bg-slate-800/30 border border-slate-700/50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn(
                          'text-xs font-medium px-2 py-0.5 rounded',
                          ev.tipo_evento === 'correctivo' ? 'bg-red-500/10 text-red-400' :
                          ev.tipo_evento === 'preventivo' ? 'bg-emerald-500/10 text-emerald-400' :
                          'bg-blue-500/10 text-blue-400'
                        )}>
                          {ev.tipo_evento}
                        </span>
                        <span className="text-xs text-slate-500">{new Date(ev.fecha_evento).toLocaleDateString()}</span>
                      </div>
                      {ev.descripcion_falla && <p className="text-sm text-slate-300 mt-1">{ev.descripcion_falla}</p>}
                      {ev.trabajo_realizado && <p className="text-xs text-slate-500 mt-1">{ev.trabajo_realizado}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ============================================
  // RENDER: ALERTS VIEW
  // ============================================

  const renderAlertas = () => (
    <div className="space-y-3">
      {alertas.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
          <CheckCircle size={40} className="mx-auto text-emerald-400 mb-3" />
          <p className="text-slate-300">{t('pdm.noAlerts')}</p>
        </div>
      ) : (
        alertas.map(a => (
          <div key={a.id} className={cn(
            'bg-slate-900 border rounded-xl p-4',
            a.nivel === 'critical' ? 'border-red-500/40' :
            a.nivel === 'warning' ? 'border-amber-500/40' :
            'border-slate-700'
          )}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {a.nivel === 'critical' ? <AlertTriangle size={20} className="text-red-400 mt-0.5" /> :
                 a.nivel === 'warning' ? <AlertCircle size={20} className="text-amber-400 mt-0.5" /> :
                 <Info size={20} className="text-blue-400 mt-0.5" />}
                <div>
                  <h4 className="font-medium text-slate-200">{a.titulo}</h4>
                  <p className="text-sm text-slate-400 mt-1">{a.mensaje}</p>
                  <span className="text-xs text-slate-500 mt-2 block">{new Date(a.created_at).toLocaleString()}</span>
                </div>
              </div>
              <button
                onClick={() => handleResolveAlert(a.id)}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-300"
              >
                <CheckCircle size={14} />
                {t('pdm.resolve')}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );

  // ============================================
  // RENDER: READING MODAL
  // ============================================

  const renderLecturaModal = () => {
    if (!showLecturaModal) return null;
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={() => setShowLecturaModal(false)} />
        <div className="relative bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md">
          <h3 className="font-semibold text-slate-100 mb-4">{t('pdm.registerReading')}</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">{t('pdm.meterType')}</label>
              <select
                value={lecturaForm.tipo}
                onChange={e => {
                  const tipo = e.target.value;
                  const unidades: Record<string, string> = { horometro: 'horas', odometro: 'km', temperatura: '°C', vibracion: 'mm/s', presion: 'bar' };
                  setLecturaForm({ ...lecturaForm, tipo, unidad: unidades[tipo] || '' });
                }}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200"
              >
                <option value="horometro">{t('pdm.hourmeter')}</option>
                <option value="odometro">{t('pdm.odometer')}</option>
                <option value="temperatura">{t('pdm.temperature')}</option>
                <option value="vibracion">{t('pdm.vibration')}</option>
                <option value="presion">{t('pdm.pressure')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">{t('pdm.value')} ({lecturaForm.unidad})</label>
              <input
                type="number"
                value={lecturaForm.valor}
                onChange={e => setLecturaForm({ ...lecturaForm, valor: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200"
                placeholder="0"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowLecturaModal(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800">
              {t('common.cancel')}
            </button>
            <button onClick={handleSaveLectura} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm">
              {t('common.save')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============================================
  // MAIN RENDER
  // ============================================

  if (loading && dashboard.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-600/10 border border-blue-500/20">
            <Cpu size={20} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">{t('pdm.title')}</h2>
            <p className="text-xs text-slate-400">{t('pdm.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* AI Status */}
          <span className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border',
            aiOnline === true ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
            aiOnline === false ? 'bg-red-500/10 text-red-400 border-red-500/30' :
            'bg-slate-700 text-slate-400 border-slate-600'
          )}>
            <span className={cn('w-1.5 h-1.5 rounded-full', aiOnline ? 'bg-emerald-400' : 'bg-red-400')} />
            {aiOnline ? t('pdm.aiOnline') : t('pdm.aiOffline')}
          </span>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-300"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {t('pdm.syncTaller')}
          </button>
          <button
            onClick={loadData}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400"
            title={t('commonExt.refresh')}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* KPIs */}
      {renderKPIs()}

      {/* Tab navigation */}
      <div className="flex items-center gap-1 bg-slate-900/50 p-1 rounded-xl border border-slate-800 w-fit">
        {([
          { id: 'dashboard' as PdmVista, label: t('pdm.tabDashboard'), icon: BarChart3 },
          { id: 'equipos' as PdmVista, label: t('pdm.tabEquipment'), icon: Settings },
          { id: 'alertas' as PdmVista, label: `${t('pdm.tabAlerts')}${alertas.length > 0 ? ` (${alertas.length})` : ''}`, icon: Bell },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setVista(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors',
              vista === tab.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            )}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {(vista === 'dashboard' || vista === 'equipos') && renderEquiposTable()}
      {vista === 'alertas' && renderAlertas()}

      {/* Detail panel */}
      {equipoSeleccionado && renderEquipoDetalle()}

      {/* Reading modal */}
      {renderLecturaModal()}
    </div>
  );
}
