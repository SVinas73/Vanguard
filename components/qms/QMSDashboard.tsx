'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import {
  Shield, ClipboardCheck, AlertTriangle, FileCheck, AlertOctagon,
  TrendingUp, TrendingDown, Package, Users, Calendar,
  CheckCircle, XCircle, Clock, Eye, Plus, Search,
  RefreshCw, BarChart3, Activity, Thermometer, Bell, ChevronRight,
  Target, Award, Gauge, AlertCircle, MoreHorizontal
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart as RechartsPie, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';
import {
  Inspeccion, NoConformidad, AccionCorrectiva, Recall, Instrumento,
  MetricasQMS, ESTADO_INSPECCION_CONFIG, SEVERIDAD_NCR_CONFIG, CLASE_RECALL_CONFIG
} from './types';

// ============================================
// HELPERS
// ============================================

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatDateTime = (date: string) => {
  return new Date(date).toLocaleString('es-UY', { 
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const getDiasRestantes = (fecha: string) => {
  const hoy = new Date();
  const objetivo = new Date(fecha);
  return Math.ceil((objetivo.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
};

type TabActiva = 'dashboard' | 'inspecciones' | 'ncr' | 'capa' | 'certificados' | 'recalls' | 'instrumentos';

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function QMSDashboard() {
  const { user } = useAuth();
  
  // Estado principal
  const [loading, setLoading] = useState(true);
  const [tabActiva, setTabActiva] = useState<TabActiva>('dashboard');
  
  // Datos
  const [inspecciones, setInspecciones] = useState<Inspeccion[]>([]);
  const [ncrs, setNcrs] = useState<NoConformidad[]>([]);
  const [capas, setCapas] = useState<AccionCorrectiva[]>([]);
  const [recalls, setRecalls] = useState<Recall[]>([]);
  const [instrumentos, setInstrumentos] = useState<Instrumento[]>([]);
  
  // UI
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');

  // ============================================
  // CARGA DE DATOS
  // ============================================

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadInspecciones(),
        loadNCRs(),
        loadCAPAs(),
        loadRecalls(),
        loadInstrumentos(),
      ]);
    } catch (error) {
      console.error('Error loading QMS data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInspecciones = async () => {
    const { data, error } = await supabase
      .from('qms_inspecciones')
      .select('*')
      .order('fecha_inspeccion', { ascending: false })
      .limit(100);

    if (!error && data) {
      setInspecciones(data);
    }
  };

  const loadNCRs = async () => {
    const { data, error } = await supabase
      .from('qms_no_conformidades')
      .select('*')
      .order('fecha_deteccion', { ascending: false })
      .limit(100);

    if (!error && data) {
      setNcrs(data);
    }
  };

  const loadCAPAs = async () => {
    const { data, error } = await supabase
      .from('qms_acciones_correctivas')
      .select('*')
      .order('fecha_inicio', { ascending: false })
      .limit(100);

    if (!error && data) {
      setCapas(data);
    }
  };

  const loadRecalls = async () => {
    const { data, error } = await supabase
      .from('qms_recalls')
      .select('*')
      .order('fecha_inicio', { ascending: false })
      .limit(50);

    if (!error && data) {
      setRecalls(data);
    }
  };

  const loadInstrumentos = async () => {
    const { data, error } = await supabase
      .from('qms_instrumentos')
      .select('*')
      .eq('estado', 'activo')
      .order('proxima_calibracion', { ascending: true });

    if (!error && data) {
      setInstrumentos(data.map(i => ({
        ...i,
        dias_para_calibracion: i.proxima_calibracion ? getDiasRestantes(i.proxima_calibracion) : null
      })));
    }
  };

  // ============================================
  // MÉTRICAS CALCULADAS
  // ============================================

  const metricas: MetricasQMS = useMemo(() => {
    const hoy = new Date().toDateString();
    
    const inspeccionesHoy = inspecciones.filter(i => 
      new Date(i.fecha_inspeccion).toDateString() === hoy
    ).length;
    
    const inspeccionesPendientes = inspecciones.filter(i => 
      i.estado === 'pendiente'
    ).length;
    
    const inspeccionesCompletadas = inspecciones.filter(i => 
      ['aprobado', 'rechazado', 'aprobado_condicional'].includes(i.estado)
    );
    
    const inspeccionesAprobadas = inspeccionesCompletadas.filter(i => 
      i.estado === 'aprobado' || i.estado === 'aprobado_condicional'
    ).length;
    
    const tasaAprobacion = inspeccionesCompletadas.length > 0 
      ? (inspeccionesAprobadas / inspeccionesCompletadas.length) * 100 
      : 100;
    
    const ncrsAbiertas = ncrs.filter(n => 
      !['cerrada', 'cancelada'].includes(n.estado)
    ).length;
    
    const ncrsCriticas = ncrs.filter(n => 
      n.severidad === 'critica' && !['cerrada', 'cancelada'].includes(n.estado)
    ).length;
    
    const capasAbiertas = capas.filter(c => 
      !['cerrada', 'cancelada'].includes(c.estado)
    ).length;
    
    const capasVencidas = capas.filter(c => {
      if (!c.fecha_objetivo || ['cerrada', 'cancelada'].includes(c.estado)) return false;
      return new Date(c.fecha_objetivo) < new Date();
    }).length;
    
    const recallsActivos = recalls.filter(r => 
      ['iniciado', 'en_proceso'].includes(r.estado)
    ).length;
    
    const instrumentosPorCalibrar = instrumentos.filter(i => 
      i.dias_para_calibracion !== null && i.dias_para_calibracion <= 30
    ).length;
    
    const totalInspeccionados = inspecciones.reduce((sum, i) => sum + i.cantidad_recibida, 0);
    const totalRechazados = inspecciones
      .filter(i => i.estado === 'rechazado')
      .reduce((sum, i) => sum + i.cantidad_recibida, 0);
    const ppmDefectos = totalInspeccionados > 0 
      ? Math.round((totalRechazados / totalInspeccionados) * 1000000) 
      : 0;
    
    const costoNoCalidad = ncrs
      .filter(n => !['cerrada', 'cancelada'].includes(n.estado))
      .reduce((sum, n) => sum + (parseFloat(String(n.costo_estimado)) || 0), 0);
    
    return {
      inspeccionesHoy,
      inspeccionesPendientes,
      tasaAprobacion,
      tasaAprobacionTendencia: 2.5,
      ncrsAbiertas,
      ncrsCriticas,
      capasAbiertas,
      capasVencidas,
      recallsActivos,
      instrumentosPorCalibrar,
      ppmDefectos,
      costoNoCalidad,
    };
  }, [inspecciones, ncrs, capas, recalls, instrumentos]);

  // Datos para gráficos
  const datosNCRPorSeveridad = useMemo(() => {
    const conteo: Record<string, number> = { critica: 0, mayor: 0, menor: 0, observacion: 0 };
    ncrs.filter(n => !['cerrada', 'cancelada'].includes(n.estado))
      .forEach(n => {
        conteo[n.severidad] = (conteo[n.severidad] || 0) + 1;
      });
    return [
      { name: 'Críticas', value: conteo.critica, color: '#ef4444' },
      { name: 'Mayores', value: conteo.mayor, color: '#f97316' },
      { name: 'Menores', value: conteo.menor, color: '#f59e0b' },
      { name: 'Observaciones', value: conteo.observacion, color: '#64748b' },
    ];
  }, [ncrs]);

  const tendenciaInspecciones = useMemo(() => {
    const ultimosMeses: Record<string, { aprobadas: number; rechazadas: number; total: number }> = {};
    
    inspecciones.forEach(i => {
      const mes = new Date(i.fecha_inspeccion).toLocaleDateString('es-UY', { month: 'short', year: '2-digit' });
      if (!ultimosMeses[mes]) {
        ultimosMeses[mes] = { aprobadas: 0, rechazadas: 0, total: 0 };
      }
      ultimosMeses[mes].total++;
      if (i.estado === 'aprobado' || i.estado === 'aprobado_condicional') {
        ultimosMeses[mes].aprobadas++;
      } else if (i.estado === 'rechazado') {
        ultimosMeses[mes].rechazadas++;
      }
    });
    
    return Object.entries(ultimosMeses)
      .slice(-6)
      .map(([mes, data]) => ({
        mes,
        ...data,
        tasa: data.total > 0 ? Math.round((data.aprobadas / data.total) * 100) : 0,
      }));
  }, [inspecciones]);

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <Shield className="h-7 w-7 text-emerald-400" />
            Quality Management System
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Control de calidad ISO 9001 / FDA - Inspecciones, NCRs, CAPAs y Recalls
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={loadAllData} 
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors">
            <Plus className="h-4 w-4" />
            Nueva Inspección
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-900/50 rounded-xl overflow-x-auto">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="h-4 w-4" /> },
          { id: 'inspecciones', label: 'Inspecciones', icon: <ClipboardCheck className="h-4 w-4" />, badge: metricas.inspeccionesPendientes },
          { id: 'ncr', label: 'No Conformidades', icon: <AlertTriangle className="h-4 w-4" />, badge: metricas.ncrsAbiertas },
          { id: 'capa', label: 'CAPAs', icon: <Target className="h-4 w-4" />, badge: metricas.capasAbiertas },
          { id: 'certificados', label: 'Certificados', icon: <FileCheck className="h-4 w-4" /> },
          { id: 'recalls', label: 'Recalls', icon: <AlertOctagon className="h-4 w-4" />, badge: metricas.recallsActivos, badgeColor: 'red' },
          { id: 'instrumentos', label: 'Instrumentos', icon: <Thermometer className="h-4 w-4" /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setTabActiva(tab.id as TabActiva)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tabActiva === tab.id
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                tab.badgeColor === 'red' ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-300'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ==================== DASHBOARD ==================== */}
      {tabActiva === 'dashboard' && (
        <DashboardView 
          metricas={metricas}
          inspecciones={inspecciones}
          ncrs={ncrs}
          instrumentos={instrumentos}
          datosNCRPorSeveridad={datosNCRPorSeveridad}
          tendenciaInspecciones={tendenciaInspecciones}
          onTabChange={setTabActiva}
        />
      )}

      {/* ==================== INSPECCIONES ==================== */}
      {tabActiva === 'inspecciones' && (
        <InspeccionesView 
          inspecciones={inspecciones}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filtroEstado={filtroEstado}
          setFiltroEstado={setFiltroEstado}
        />
      )}

      {/* ==================== NCRs ==================== */}
      {tabActiva === 'ncr' && (
        <NCRsView 
          ncrs={ncrs}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filtroEstado={filtroEstado}
          setFiltroEstado={setFiltroEstado}
        />
      )}

      {/* ==================== CAPAs ==================== */}
      {tabActiva === 'capa' && (
        <CAPAsView 
          capas={capas}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
        />
      )}

      {/* ==================== CERTIFICADOS ==================== */}
      {tabActiva === 'certificados' && <CertificadosView />}

      {/* ==================== RECALLS ==================== */}
      {tabActiva === 'recalls' && (
        <RecallsView recalls={recalls} />
      )}

      {/* ==================== INSTRUMENTOS ==================== */}
      {tabActiva === 'instrumentos' && (
        <InstrumentosView instrumentos={instrumentos} />
      )}
    </div>
  );
}

// ============================================
// SUB-COMPONENTES
// ============================================

function DashboardView({ 
  metricas, inspecciones, ncrs, instrumentos, 
  datosNCRPorSeveridad, tendenciaInspecciones, onTabChange 
}: {
  metricas: MetricasQMS;
  inspecciones: Inspeccion[];
  ncrs: NoConformidad[];
  instrumentos: Instrumento[];
  datosNCRPorSeveridad: any[];
  tendenciaInspecciones: any[];
  onTabChange: (tab: TabActiva) => void;
}) {
  return (
    <div className="space-y-6">
      {/* KPIs principales */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Tasa Aprobación</span>
            <Award className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">{metricas.tasaAprobacion.toFixed(1)}%</div>
          <div className={`text-xs flex items-center gap-1 ${metricas.tasaAprobacionTendencia >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {metricas.tasaAprobacionTendencia >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {metricas.tasaAprobacionTendencia >= 0 ? '+' : ''}{metricas.tasaAprobacionTendencia}%
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Pendientes</span>
            <Clock className="h-5 w-5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">{metricas.inspeccionesPendientes}</div>
          <div className="text-xs text-slate-500">{metricas.inspeccionesHoy} hoy</div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">NCRs Abiertas</span>
            <AlertTriangle className="h-5 w-5 text-orange-400" />
          </div>
          <div className="text-2xl font-bold text-orange-400">{metricas.ncrsAbiertas}</div>
          {metricas.ncrsCriticas > 0 && (
            <div className="text-xs text-red-400 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {metricas.ncrsCriticas} críticas
            </div>
          )}
        </div>

        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">CAPAs Activas</span>
            <Target className="h-5 w-5 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-400">{metricas.capasAbiertas}</div>
          {metricas.capasVencidas > 0 && (
            <div className="text-xs text-red-400">{metricas.capasVencidas} vencidas</div>
          )}
        </div>

        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">PPM Defectos</span>
            <Gauge className="h-5 w-5 text-cyan-400" />
          </div>
          <div className={`text-2xl font-bold ${metricas.ppmDefectos < 1000 ? 'text-emerald-400' : metricas.ppmDefectos < 5000 ? 'text-amber-400' : 'text-red-400'}`}>
            {metricas.ppmDefectos.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500">partes/millón</div>
        </div>

        <div className={`bg-slate-900/50 border rounded-xl p-4 ${metricas.recallsActivos > 0 ? 'border-red-500/50' : 'border-slate-800/50'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Recalls</span>
            <AlertOctagon className={`h-5 w-5 ${metricas.recallsActivos > 0 ? 'text-red-400' : 'text-slate-500'}`} />
          </div>
          <div className={`text-2xl font-bold ${metricas.recallsActivos > 0 ? 'text-red-400' : 'text-slate-400'}`}>
            {metricas.recallsActivos}
          </div>
        </div>
      </div>

      {/* Alertas críticas */}
      {(metricas.ncrsCriticas > 0 || metricas.recallsActivos > 0 || metricas.capasVencidas > 0) && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-400 font-semibold mb-3">
            <Bell className="h-5 w-5" />
            Alertas Críticas
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {metricas.recallsActivos > 0 && (
              <div className="flex items-center gap-3 p-3 bg-red-500/10 rounded-lg">
                <AlertOctagon className="h-8 w-8 text-red-400" />
                <div>
                  <div className="font-medium text-red-400">{metricas.recallsActivos} Recall(s) Activo(s)</div>
                  <div className="text-xs text-slate-400">Acción inmediata</div>
                </div>
              </div>
            )}
            {metricas.ncrsCriticas > 0 && (
              <div className="flex items-center gap-3 p-3 bg-orange-500/10 rounded-lg">
                <AlertTriangle className="h-8 w-8 text-orange-400" />
                <div>
                  <div className="font-medium text-orange-400">{metricas.ncrsCriticas} NCR(s) Crítica(s)</div>
                  <div className="text-xs text-slate-400">Pendientes</div>
                </div>
              </div>
            )}
            {metricas.capasVencidas > 0 && (
              <div className="flex items-center gap-3 p-3 bg-amber-500/10 rounded-lg">
                <Clock className="h-8 w-8 text-amber-400" />
                <div>
                  <div className="font-medium text-amber-400">{metricas.capasVencidas} CAPA(s) Vencida(s)</div>
                  <div className="text-xs text-slate-400">Fecha excedida</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-400 mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-400" />
            Tendencia de Inspecciones
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={tendenciaInspecciones}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="mes" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="aprobadas" stackId="1" stroke="#10b981" fill="#10b98130" name="Aprobadas" />
                <Area type="monotone" dataKey="rechazadas" stackId="1" stroke="#ef4444" fill="#ef444430" name="Rechazadas" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-400 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-400" />
            NCRs por Severidad
          </h3>
          <div className="h-64 flex items-center justify-center">
            {datosNCRPorSeveridad.some(d => d.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={datosNCRPorSeveridad}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                  >
                    {datosNCRPorSeveridad.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                </RechartsPie>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-slate-500">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 text-emerald-400" />
                <p>No hay NCRs abiertas</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Listas recientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Últimas inspecciones */}
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h3 className="font-semibold text-slate-200 flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-emerald-400" />
              Últimas Inspecciones
            </h3>
            <button 
              onClick={() => onTabChange('inspecciones')}
              className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              Ver todas <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="divide-y divide-slate-800/50">
            {inspecciones.slice(0, 5).map(insp => {
              const config = ESTADO_INSPECCION_CONFIG[insp.estado];
              return (
                <div key={insp.id} className="p-3 hover:bg-slate-800/30 cursor-pointer">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm text-slate-200">{insp.numero}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${config?.bg} ${config?.color}`}>
                      {config?.label}
                    </span>
                  </div>
                  <div className="text-sm text-slate-400 truncate">{insp.producto_codigo} - {insp.producto_descripcion}</div>
                  <div className="text-xs text-slate-500 mt-1">{formatDateTime(insp.fecha_inspeccion)}</div>
                </div>
              );
            })}
            {inspecciones.length === 0 && (
              <div className="p-8 text-center text-slate-500">No hay inspecciones</div>
            )}
          </div>
        </div>

        {/* NCRs recientes */}
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h3 className="font-semibold text-slate-200 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-400" />
              NCRs Recientes
            </h3>
            <button 
              onClick={() => onTabChange('ncr')}
              className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              Ver todas <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="divide-y divide-slate-800/50">
            {ncrs.filter(n => !['cerrada', 'cancelada'].includes(n.estado)).slice(0, 5).map(ncr => {
              const config = SEVERIDAD_NCR_CONFIG[ncr.severidad];
              return (
                <div key={ncr.id} className="p-3 hover:bg-slate-800/30 cursor-pointer">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm text-slate-200">{ncr.numero}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${config?.bg} ${config?.color}`}>
                      {config?.label}
                    </span>
                  </div>
                  <div className="text-sm text-slate-300 truncate">{ncr.titulo}</div>
                  <div className="text-xs text-slate-500 mt-1">{formatDate(ncr.fecha_deteccion)}</div>
                </div>
              );
            })}
            {ncrs.filter(n => !['cerrada', 'cancelada'].includes(n.estado)).length === 0 && (
              <div className="p-8 text-center text-slate-500">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-emerald-400" />
                No hay NCRs abiertas
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Instrumentos próximos a calibrar */}
            {metricas.instrumentosPorCalibrar > 0 && (
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <Thermometer className="h-5 w-5 text-cyan-400" />
                  Instrumentos Próximos a Calibrar
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {instrumentos
                    .filter(i => i.dias_para_calibracion !== null && i.dias_para_calibracion <= 30)
                    .slice(0, 8)
                    .map(inst => {
                      const dias = inst.dias_para_calibracion as number;
                      return (
                        <div key={inst.id} className={`p-3 rounded-lg ${
                          dias < 0 ? 'bg-red-500/10 border border-red-500/30' :
                          dias <= 7 ? 'bg-amber-500/10 border border-amber-500/30' :
                          'bg-slate-800/30 border border-slate-700/30'
                        }`}>
                          <div className="font-mono text-sm text-slate-200">{inst.codigo}</div>
                          <div className="text-xs text-slate-400 truncate">{inst.nombre}</div>
                          <div className={`text-xs mt-1 font-medium ${
                            dias < 0 ? 'text-red-400' :
                            dias <= 7 ? 'text-amber-400' : 'text-slate-400'
                          }`}>
                            {dias < 0 
                              ? `Vencido hace ${Math.abs(dias)} días`
                              : `${dias} días restantes`
                            }
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        );
      }

      // Vista de Inspecciones
      function InspeccionesView({ inspecciones, searchTerm, setSearchTerm, filtroEstado, setFiltroEstado }: {
        inspecciones: Inspeccion[];
        searchTerm: string;
        setSearchTerm: (v: string) => void;
        filtroEstado: string;
        setFiltroEstado: (v: string) => void;
      }) {
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-3 items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100 w-64"
                  />
                </div>
                <select 
                  value={filtroEstado} 
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
                >
                  <option value="todos">Todos</option>
                  <option value="pendiente">Pendientes</option>
                  <option value="aprobado">Aprobados</option>
                  <option value="rechazado">Rechazados</option>
                </select>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium">
                <Plus className="h-4 w-4" />
                Nueva Inspección
              </button>
            </div>

            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Número</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Producto</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Lote</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Cantidad</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">Estado</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Fecha</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {inspecciones
                      .filter(i => filtroEstado === 'todos' || i.estado === filtroEstado)
                      .filter(i => !searchTerm || 
                        i.numero?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        i.producto_codigo?.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map(insp => {
                        const config = ESTADO_INSPECCION_CONFIG[insp.estado];
                        return (
                          <tr key={insp.id} className="hover:bg-slate-800/30">
                            <td className="px-4 py-3 font-mono text-sm text-emerald-400">{insp.numero}</td>
                            <td className="px-4 py-3 text-sm text-slate-300 capitalize">{insp.tipo}</td>
                            <td className="px-4 py-3">
                              <div className="text-sm text-slate-200">{insp.producto_codigo}</div>
                              <div className="text-xs text-slate-500 truncate max-w-[200px]">{insp.producto_descripcion}</div>
                            </td>
                            <td className="px-4 py-3 font-mono text-sm text-slate-400">{insp.lote_numero || '-'}</td>
                            <td className="px-4 py-3 text-right font-mono text-sm text-slate-300">{insp.cantidad_recibida}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-1 rounded-full text-xs ${config?.bg} ${config?.color}`}>
                                {config?.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-400">{formatDate(insp.fecha_inspeccion)}</td>
                            <td className="px-4 py-3">
                              <button className="p-1.5 hover:bg-slate-700 rounded-lg">
                                <Eye className="h-4 w-4 text-slate-400" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
              {inspecciones.length === 0 && (
                <div className="p-12 text-center text-slate-500">
                  <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No hay inspecciones</p>
                </div>
              )}
            </div>
          </div>
        );
      }

      // Vista de NCRs
      function NCRsView({ ncrs, searchTerm, setSearchTerm, filtroEstado, setFiltroEstado }: {
        ncrs: NoConformidad[];
        searchTerm: string;
        setSearchTerm: (v: string) => void;
        filtroEstado: string;
        setFiltroEstado: (v: string) => void;
      }) {
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-3 items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100 w-64"
                  />
                </div>
                <select 
                  value={filtroEstado} 
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
                >
                  <option value="todos">Todos</option>
                  <option value="abierta">Abiertas</option>
                  <option value="en_analisis">En Análisis</option>
                  <option value="cerrada">Cerradas</option>
                </select>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-medium">
                <Plus className="h-4 w-4" />
                Nueva NCR
              </button>
            </div>

            <div className="grid gap-4">
              {ncrs
                .filter(n => filtroEstado === 'todos' || n.estado === filtroEstado)
                .filter(n => !searchTerm || n.numero?.toLowerCase().includes(searchTerm.toLowerCase()) || n.titulo?.toLowerCase().includes(searchTerm.toLowerCase()))
                .map(ncr => {
                  const config = SEVERIDAD_NCR_CONFIG[ncr.severidad];
                  const diasRestantes = ncr.fecha_objetivo ? getDiasRestantes(ncr.fecha_objetivo) : null;
                  
                  return (
                    <div key={ncr.id} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 hover:border-slate-700 cursor-pointer">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-mono text-sm text-orange-400">{ncr.numero}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs ${config?.bg} ${config?.color}`}>
                              {config?.label}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-700 text-slate-300 capitalize">
                              {ncr.estado.replace('_', ' ')}
                            </span>
                          </div>
                          <h4 className="text-slate-200 font-medium mb-1">{ncr.titulo}</h4>
                          <p className="text-sm text-slate-400 line-clamp-2">{ncr.descripcion}</p>
                          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                            {ncr.producto_codigo && (
                              <span className="flex items-center gap-1">
                                <Package className="h-3 w-3" />
                                {ncr.producto_codigo}
                              </span>
                            )}
                            {ncr.responsable && (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {ncr.responsable}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(ncr.fecha_deteccion)}
                            </span>
                            {diasRestantes !== null && (
                              <span className={`flex items-center gap-1 ${diasRestantes < 0 ? 'text-red-400' : diasRestantes <= 3 ? 'text-amber-400' : ''}`}>
                                <Clock className="h-3 w-3" />
                                {diasRestantes < 0 ? `Vencida hace ${Math.abs(diasRestantes)}d` : `${diasRestantes}d`}
                              </span>
                            )}
                          </div>
                        </div>
                        <button className="p-2 hover:bg-slate-800 rounded-lg">
                          <MoreHorizontal className="h-5 w-5 text-slate-400" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              
              {ncrs.length === 0 && (
                <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-12 text-center text-slate-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 text-emerald-400" />
                  <p>No hay NCRs</p>
                </div>
              )}
            </div>
          </div>
        );
      }

      // Vista de CAPAs
      function CAPAsView({ capas, searchTerm, setSearchTerm }: {
        capas: AccionCorrectiva[];
        searchTerm: string;
        setSearchTerm: (v: string) => void;
      }) {
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100 w-64"
                />
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium">
                <Plus className="h-4 w-4" />
                Nueva CAPA
              </button>
            </div>

            <div className="grid gap-4">
              {capas.map(capa => {
                const diasRestantes = capa.fecha_objetivo ? getDiasRestantes(capa.fecha_objetivo) : null;
                
                return (
                  <div key={capa.id} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 hover:border-slate-700 cursor-pointer">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono text-sm text-purple-400">{capa.numero}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            capa.tipo === 'correctiva' ? 'bg-red-500/20 text-red-400' :
                            capa.tipo === 'preventiva' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-emerald-500/20 text-emerald-400'
                          }`}>
                            {capa.tipo.charAt(0).toUpperCase() + capa.tipo.slice(1)}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-700 text-slate-300 capitalize">
                            {capa.estado.replace('_', ' ')}
                          </span>
                        </div>
                        <h4 className="text-slate-200 font-medium mb-2">{capa.titulo}</h4>
                        
                        <div className="mb-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-400">Progreso</span>
                            <span className="text-slate-300">{capa.porcentaje_avance}%</span>
                          </div>
                          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all ${
                                capa.porcentaje_avance >= 100 ? 'bg-emerald-500' :
                                capa.porcentaje_avance >= 50 ? 'bg-purple-500' : 'bg-amber-500'
                              }`}
                              style={{ width: `${capa.porcentaje_avance}%` }}
                            />
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          {capa.responsable && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {capa.responsable}
                            </span>
                          )}
                          {diasRestantes !== null && (
                            <span className={`flex items-center gap-1 ${diasRestantes < 0 ? 'text-red-400' : diasRestantes <= 7 ? 'text-amber-400' : ''}`}>
                              <Clock className="h-3 w-3" />
                              {diasRestantes < 0 ? `Vencida hace ${Math.abs(diasRestantes)}d` : `${diasRestantes}d restantes`}
                            </span>
                          )}
                        </div>
                      </div>
                      <button className="p-2 hover:bg-slate-800 rounded-lg">
                        <MoreHorizontal className="h-5 w-5 text-slate-400" />
                      </button>
                    </div>
                  </div>
                );
              })}
              
              {capas.length === 0 && (
                <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-12 text-center text-slate-500">
                  <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No hay CAPAs</p>
                </div>
              )}
            </div>
          </div>
        );
      }

      // Vista de Certificados
      function CertificadosView() {
        return (
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-12 text-center text-slate-500">
            <FileCheck className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-slate-300 mb-2">Certificados de Calidad</h3>
            <p className="max-w-md mx-auto mb-4">
              Los certificados COA y COC se generan automáticamente basados en inspecciones aprobadas.
            </p>
            <button className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl">
              Generar Certificado
            </button>
          </div>
        );
      }

      // Vista de Recalls
      function RecallsView({ recalls }: { recalls: Recall[] }) {
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-slate-400">Gestión de recalls con trazabilidad completa.</p>
              <button className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium">
                <AlertOctagon className="h-4 w-4" />
                Iniciar Recall
              </button>
            </div>

            {recalls.length > 0 ? (
              <div className="grid gap-4">
                {recalls.map(recall => {
                  const claseConfig = CLASE_RECALL_CONFIG[recall.clase];
                  return (
                    <div key={recall.id} className={`bg-slate-900/50 border rounded-xl p-4 ${
                      recall.estado !== 'cerrado' ? 'border-red-500/30' : 'border-slate-800/50'
                    }`}>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm text-red-400">{recall.numero}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs bg-red-500/20 ${claseConfig?.color}`}>
                          {claseConfig?.label}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-slate-700 text-slate-300 capitalize">
                          {recall.estado.replace('_', ' ')}
                        </span>
                      </div>
                      <h4 className="text-slate-200 font-medium">{recall.producto_codigo} - {recall.producto_descripcion}</h4>
                      <p className="text-sm text-slate-400 mt-1">{recall.motivo}</p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                        <span>{recall.cantidad_total_afectada} unidades afectadas</span>
                        <span>{recall.porcentaje_recuperacion?.toFixed(1) || 0}% recuperado</span>
                        <span>{formatDate(recall.fecha_inicio)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-12 text-center text-slate-500">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-emerald-400" />
                <p>No hay recalls activos</p>
              </div>
            )}
          </div>
        );
      }

      // Vista de Instrumentos
      function InstrumentosView({ instrumentos }: { instrumentos: Instrumento[] }) {
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-slate-400">Control de calibración de instrumentos de medición.</p>
              <button className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-medium">
                <Plus className="h-4 w-4" />
                Nuevo Instrumento
              </button>
            </div>

            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Código</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Nombre</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Ubicación</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Próxima Calibración</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {instrumentos.map(inst => {
                      const dias = inst.dias_para_calibracion;
                      return (
                        <tr key={inst.id} className="hover:bg-slate-800/30">
                          <td className="px-4 py-3 font-mono text-sm text-cyan-400">{inst.codigo}</td>
                          <td className="px-4 py-3 text-sm text-slate-200">{inst.nombre}</td>
                          <td className="px-4 py-3 text-sm text-slate-400">{inst.ubicacion || '-'}</td>
                          <td className="px-4 py-3">
                            {inst.proxima_calibracion ? (
                              <span className={`text-sm ${
                                dias !== null && dias < 0 ? 'text-red-400' :
                                dias !== null && dias <= 7 ? 'text-amber-400' : 'text-slate-300'
                              }`}>
                                {formatDate(inst.proxima_calibracion)}
                                {dias !== null && (
                                  <span className="text-xs ml-2">
                                    ({dias < 0 ? 'Vencido' : `${dias}d`})
                                  </span>
                                )}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              inst.estado === 'activo' ? 'bg-emerald-500/20 text-emerald-400' :
                              inst.estado === 'en_calibracion' ? 'bg-amber-500/20 text-amber-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {inst.estado}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {instrumentos.length === 0 && (
                <div className="p-12 text-center text-slate-500">
                  <Thermometer className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No hay instrumentos registrados</p>
                </div>
              )}
            </div>
          </div>
        );
      }