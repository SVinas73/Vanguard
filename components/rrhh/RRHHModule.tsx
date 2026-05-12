'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, Plus, Search, X, Clock, Calendar, CheckCircle2,
  Cake, UserCheck, UserX, Coffee, AlertCircle, MapPin,
  Briefcase, Mail, Phone, RefreshCw, Filter,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { useWmsToast } from '@/components/wms/useWmsToast';
import {
  listarEmpleados, crearEmpleado, actualizarEmpleado, darDeBaja,
  fichadaEntrada, fichadaSalida, asistenciaDelDia,
  listarSolicitudes, crearSolicitud, aprobarSolicitud, rechazarSolicitud,
  obtenerMetricas,
  type Empleado, type Solicitud, type EstadoEmpleado, type TipoSolicitud,
  type RRHHMetricas, type Asistencia,
} from '@/lib/rrhh';

const ESTADO_STYLE: Record<EstadoEmpleado, { bg: string; color: string }> = {
  activo:     { bg: 'bg-emerald-500/15', color: 'text-emerald-300' },
  licencia:   { bg: 'bg-amber-500/15',   color: 'text-amber-300' },
  suspendido: { bg: 'bg-orange-500/15',  color: 'text-orange-300' },
  baja:       { bg: 'bg-slate-500/15',   color: 'text-slate-400' },
};

// Mapeo de tipo solicitud → key i18n
const TIPO_SOLICITUD_KEY: Record<TipoSolicitud, string> = {
  vacaciones:      'rrhh.vacation',
  licencia_medica: 'rrhh.medicalLeave',
  personal:        'rrhh.personalDay',
  estudio:         'rrhh.study',
  otro:            'rrhh.other',
};

// Mapeo estado empleado → key i18n
const ESTADO_KEY: Record<EstadoEmpleado, string> = {
  activo:     'rrhh.statusActive',
  licencia:   'rrhh.statusOnLeave',
  suspendido: 'rrhh.statusSuspended',
  baja:       'rrhh.statusTerminated',
};

type Vista = 'dashboard' | 'empleados' | 'asistencia' | 'solicitudes';

export default function RRHHModule() {
  const { t } = useTranslation();
  const { user } = useAuth(false);
  const toast = useWmsToast();
  const [vista, setVista] = useState<Vista>('dashboard');
  const [loading, setLoading] = useState(true);

  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [asistenciaHoy, setAsistenciaHoy] = useState<Asistencia[]>([]);
  const [metricas, setMetricas] = useState<RRHHMetricas | null>(null);

  // Modales / formularios
  const [showFormEmpleado, setShowFormEmpleado] = useState(false);
  const [editingEmpleado, setEditingEmpleado] = useState<Empleado | null>(null);
  const [showFormSolicitud, setShowFormSolicitud] = useState(false);
  const [search, setSearch] = useState('');
  const [filtroArea, setFiltroArea] = useState<string>('todas');

  const [formEmp, setFormEmp] = useState({
    nombre: '', apellido: '', cargo: '', area: 'admin',
    fecha_ingreso: new Date().toISOString().split('T')[0],
    user_email: '', dni: '', telefono: '', email_personal: '',
    fecha_nacimiento: '', sueldo_base: '', tipo_contrato: 'efectivo' as const,
    jornada: 'full' as const,
  });

  const [formSol, setFormSol] = useState({
    empleadoId: '', tipo: 'vacaciones' as TipoSolicitud,
    fechaInicio: new Date().toISOString().split('T')[0],
    fechaFin:    new Date().toISOString().split('T')[0],
    motivo: '',
  });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [emps, sols, asist, mets] = await Promise.all([
      listarEmpleados(),
      listarSolicitudes(),
      asistenciaDelDia(),
      obtenerMetricas(),
    ]);
    setEmpleados(emps);
    setSolicitudes(sols);
    setAsistenciaHoy(asist);
    setMetricas(mets);
    setLoading(false);
  };

  // ===== Empleados =====
  const empleadosFiltrados = useMemo(() => {
    let r = empleados;
    if (filtroArea !== 'todas') r = r.filter(e => e.area === filtroArea);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(e => `${e.nombre} ${e.apellido} ${e.cargo} ${e.legajo ?? ''}`.toLowerCase().includes(q));
    }
    return r;
  }, [empleados, search, filtroArea]);

  const areasUnicas = useMemo(() => {
    return Array.from(new Set(empleados.map(e => e.area))).sort();
  }, [empleados]);

  const onCrearEmpleado = async () => {
    if (!formEmp.nombre || !formEmp.apellido || !formEmp.cargo || !formEmp.area) {
      toast.warning(t('rrhh.completeFields'));
      return;
    }
    const ok = await crearEmpleado({
      nombre: formEmp.nombre, apellido: formEmp.apellido,
      cargo: formEmp.cargo, area: formEmp.area,
      fecha_ingreso: formEmp.fecha_ingreso,
      user_email: formEmp.user_email || undefined,
      dni: formEmp.dni || undefined,
      telefono: formEmp.telefono || undefined,
      email_personal: formEmp.email_personal || undefined,
      fecha_nacimiento: formEmp.fecha_nacimiento || undefined,
      sueldo_base: formEmp.sueldo_base ? parseFloat(formEmp.sueldo_base) : undefined,
      tipo_contrato: formEmp.tipo_contrato,
      jornada: formEmp.jornada,
    }, user?.email || 'sistema');
    if (ok) {
      toast.success(`${formEmp.nombre} ${formEmp.apellido} ${t('rrhh.addedToTeam')}`);
      setShowFormEmpleado(false);
      setFormEmp({ ...formEmp, nombre: '', apellido: '', cargo: '', dni: '', user_email: '', telefono: '', email_personal: '', sueldo_base: '', fecha_nacimiento: '' });
      loadAll();
    } else {
      toast.error(t('rrhh.cantCreate'));
    }
  };

  const onDarBaja = async (e: Empleado) => {
    if (!confirm(`${t('rrhh.confirmTerminate')} ${e.nombre} ${e.apellido}?`)) return;
    const ok = await darDeBaja(e.id, user?.email || 'sistema');
    if (ok) { toast.success(t('rrhh.employeeTerminated')); loadAll(); }
    else    toast.error(t('rrhh.cantTerminate'));
  };

  // ===== Asistencia =====
  const onFichar = async (empleadoId: string, tipo: 'entrada' | 'salida') => {
    const ok = tipo === 'entrada' ? await fichadaEntrada(empleadoId) : await fichadaSalida(empleadoId);
    if (ok) { toast.success(t('rrhh.clockSuccess', { tipo })); loadAll(); }
    else    toast.error(t('rrhh.cantClock'));
  };

  // ===== Solicitudes =====
  const onCrearSolicitud = async () => {
    if (!formSol.empleadoId || !formSol.fechaInicio || !formSol.fechaFin) {
      toast.warning(t('rrhh.completeEmpDates'));
      return;
    }
    const s = await crearSolicitud({
      empleadoId: formSol.empleadoId,
      tipo: formSol.tipo,
      fechaInicio: formSol.fechaInicio,
      fechaFin: formSol.fechaFin,
      motivo: formSol.motivo || undefined,
    }, user?.email || 'sistema');
    if (s) {
      toast.success(t('rrhh.requestSent'));
      setShowFormSolicitud(false);
      loadAll();
    } else {
      toast.error(t('rrhh.cantSendRequest'));
    }
  };

  const onAprobar = async (s: Solicitud) => {
    const ok = await aprobarSolicitud(s.id, user?.email || 'sistema');
    if (ok) { toast.success(t('rrhh.requestApproved')); loadAll(); }
    else    toast.error(t('rrhh.cantApprove'));
  };

  const onRechazar = async (s: Solicitud) => {
    const motivo = prompt(t('rrhh.rejectReason'));
    if (!motivo) return;
    const ok = await rechazarSolicitud(s.id, user?.email || 'sistema', motivo);
    if (ok) { toast.success(t('rrhh.requestRejected')); loadAll(); }
    else    toast.error(t('rrhh.cantReject'));
  };

  // =========================================
  // RENDER
  // =========================================
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/40 backdrop-blur sticky top-0 z-10">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/15">
              <Users className="h-5 w-5 text-violet-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">{t('rrhh.title')}</h1>
              <p className="text-xs text-slate-500">{t('rrhh.subtitle')}</p>
            </div>
          </div>
          <button onClick={loadAll} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200" title={t('wmsModule.refresh')}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 flex gap-1 -mb-px overflow-x-auto">
          {([
            { id: 'dashboard',   label: t('rrhh.dashboard'),  icon: Users },
            { id: 'empleados',   label: t('rrhh.team'),       icon: Briefcase },
            { id: 'asistencia',  label: t('rrhh.attendance'), icon: Clock },
            { id: 'solicitudes', label: t('rrhh.requests'),   icon: Calendar },
          ] as const).map(tab => {
            const Ic = tab.icon;
            const active = vista === tab.id;
            return (
              <button key={tab.id} onClick={() => setVista(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  active ? 'border-violet-500 text-violet-300' : 'border-transparent text-slate-400 hover:text-slate-200',
                )}>
                <Ic className="h-4 w-4" />{tab.label}
                {tab.id === 'solicitudes' && (metricas?.solicitudesPendientes ?? 0) > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                    {metricas?.solicitudesPendientes}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-6">
        {/* ===== DASHBOARD ===== */}
        {vista === 'dashboard' && metricas && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <KPI icon={Users}        label={t('rrhh.total')}    value={metricas.totalEmpleados} accent="violet" />
              <KPI icon={UserCheck}    label={t('rrhh.active')}   value={metricas.activos}        accent="emerald" />
              <KPI icon={Coffee}       label={t('rrhh.onLeave')}  value={metricas.enLicencia}     accent="amber" />
              <KPI icon={UserX}        label={t('rrhh.terminated')} value={metricas.bajas}        accent="slate" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Cumpleaños del mes */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Cake className="h-4 w-4 text-pink-300" />
                  <h3 className="text-sm font-semibold text-slate-100">{t('rrhh.birthdaysThisMonth')}</h3>
                  <span className="ml-auto text-xs text-slate-500">{metricas.cumpleanieros.length}</span>
                </div>
                {metricas.cumpleanieros.length === 0 ? (
                  <p className="text-xs text-slate-500">{t('rrhh.nobodyBirthday')}</p>
                ) : (
                  <ul className="space-y-2">
                    {metricas.cumpleanieros.map(e => (
                      <li key={e.id} className="flex items-center gap-3 text-sm">
                        <div className="w-8 h-8 rounded-full bg-pink-500/15 flex items-center justify-center text-pink-300 font-semibold">
                          {e.nombre[0]}{e.apellido[0]}
                        </div>
                        <div className="flex-1">
                          <div className="text-slate-200">{e.nombre} {e.apellido}</div>
                          <div className="text-xs text-slate-500">{e.cargo} · {new Date(e.fecha_nacimiento! + 'T00:00:00').toLocaleDateString('es-UY', { day: '2-digit', month: 'long' })}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Por área */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Briefcase className="h-4 w-4 text-blue-300" />
                  <h3 className="text-sm font-semibold text-slate-100">{t('rrhh.teamByArea')}</h3>
                </div>
                {Object.keys(metricas.porArea).length === 0 ? (
                  <p className="text-xs text-slate-500">{t('rrhh.noActiveEmployees')}</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(metricas.porArea).sort((a, b) => b[1] - a[1]).map(([area, n]) => {
                      const pct = metricas.activos > 0 ? Math.round((n / metricas.activos) * 100) : 0;
                      return (
                        <div key={area}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-300 capitalize">{area}</span>
                            <span className="text-slate-500 font-mono">{n} · {pct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div className="h-full bg-blue-500/60 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KPI icon={Clock}      label={t('rrhh.checkedInToday')}  value={metricas.fichadosHoy}          accent="cyan" />
              <KPI icon={Calendar}   label={t('rrhh.pendingRequests')} value={metricas.solicitudesPendientes} accent="amber" />
              <KPI icon={AlertCircle} label={t('rrhh.attendancePct')}  value={`${metricas.activos > 0 ? Math.round((metricas.fichadosHoy / metricas.activos) * 100) : 0}%`} accent="emerald" />
            </div>
          </div>
        )}

        {/* ===== EMPLEADOS ===== */}
        {vista === 'empleados' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder={t('rrhh.searchPlaceholder')}
                  className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-violet-500" />
              </div>
              <select value={filtroArea} onChange={e => setFiltroArea(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200">
                <option value="todas">{t('rrhh.allAreas')}</option>
                {areasUnicas.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <button onClick={() => setShowFormEmpleado(true)}
                className="px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm flex items-center gap-2">
                <Plus className="h-4 w-4" /> {t('rrhh.newEmployee')}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {empleadosFiltrados.map(e => {
                const cfg = ESTADO_STYLE[e.estado];
                return (
                  <div key={e.id} className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-500/40 to-blue-500/40 flex items-center justify-center text-slate-100 font-bold">
                        {e.nombre[0]}{e.apellido[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-slate-100 truncate">{e.nombre} {e.apellido}</h4>
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', cfg.bg, cfg.color)}>{t(ESTADO_KEY[e.estado])}</span>
                        </div>
                        <p className="text-xs text-slate-400 truncate">{e.cargo}</p>
                        <p className="text-[11px] text-slate-500 capitalize">{e.area} · {t('rrhh.admission')} {new Date(e.fecha_ingreso).toLocaleDateString('es-UY')}</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2 text-[11px] text-slate-500">
                      {e.telefono && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{e.telefono}</span>}
                      {e.email_personal && <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{e.email_personal}</span>}
                      {(e.solicitudes_pendientes ?? 0) > 0 && (
                        <span className="ml-auto px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium">{e.solicitudes_pendientes} {t('rrhh.statusPending').toLowerCase()}.</span>
                      )}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => onFichar(e.id, 'entrada')} className="flex-1 px-2 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded text-xs font-medium">{t('rrhh.clockIn')}</button>
                      <button onClick={() => onFichar(e.id, 'salida')}  className="flex-1 px-2 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded text-xs font-medium">{t('rrhh.clockOut')}</button>
                      {e.estado !== 'baja' && (
                        <button onClick={() => onDarBaja(e)} className="px-2 py-1.5 bg-slate-800 hover:bg-red-600/20 text-slate-400 hover:text-red-300 rounded text-xs">{t('rrhh.terminate')}</button>
                      )}
                    </div>
                  </div>
                );
              })}
              {empleadosFiltrados.length === 0 && (
                <div className="col-span-full text-center py-12 text-sm text-slate-500">
                  {t('rrhh.noEmployeesFilter')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== ASISTENCIA ===== */}
        {vista === 'asistencia' && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-200">{t('rrhh.attendanceOfToday')} ({new Date().toLocaleDateString('es-UY')})</h2>
            <div className="rounded-xl border border-slate-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/60 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="text-left px-4 py-2">{t('rrhh.employee')}</th>
                    <th className="text-left px-4 py-2">{t('rrhh.area')}</th>
                    <th className="text-left px-4 py-2">{t('rrhh.entryTime')}</th>
                    <th className="text-left px-4 py-2">{t('rrhh.exitTime')}</th>
                    <th className="text-left px-4 py-2">{t('rrhh.worked')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {empleados.filter(e => e.estado === 'activo').map(e => {
                    const fichada = asistenciaHoy.find(a => a.empleado_id === e.id);
                    return (
                      <tr key={e.id} className="hover:bg-slate-900/30">
                        <td className="px-4 py-2 text-slate-200">{e.nombre} {e.apellido}</td>
                        <td className="px-4 py-2 text-slate-400 capitalize">{e.area}</td>
                        <td className="px-4 py-2 text-slate-300 font-mono text-xs">
                          {fichada?.hora_entrada ? new Date(fichada.hora_entrada).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="px-4 py-2 text-slate-300 font-mono text-xs">
                          {fichada?.hora_salida ? new Date(fichada.hora_salida).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="px-4 py-2 text-slate-300 font-mono text-xs">
                          {fichada?.minutos_trabajados ? `${Math.floor(fichada.minutos_trabajados/60)}h ${fichada.minutos_trabajados%60}m` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== SOLICITUDES ===== */}
        {vista === 'solicitudes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200">{t('rrhh.requests')} ({solicitudes.length})</h2>
              <button onClick={() => setShowFormSolicitud(true)} className="px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm flex items-center gap-2">
                <Plus className="h-4 w-4" /> {t('rrhh.newRequest')}
              </button>
            </div>
            <div className="space-y-2">
              {solicitudes.map(s => {
                const emp = s.empleado;
                const statusColor =
                  s.estado === 'aprobada'  ? 'bg-emerald-500/15 text-emerald-300' :
                  s.estado === 'rechazada' ? 'bg-red-500/15 text-red-300' :
                  s.estado === 'cancelada' ? 'bg-slate-500/15 text-slate-400' :
                                             'bg-amber-500/15 text-amber-300';
                const estadoKey =
                  s.estado === 'aprobada'  ? 'rrhh.statusApproved' :
                  s.estado === 'rechazada' ? 'rrhh.statusRejected' :
                  s.estado === 'cancelada' ? 'rrhh.statusCancelled' :
                                             'rrhh.statusPending';
                return (
                  <div key={s.id} className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-100">{emp ? `${emp.nombre} ${emp.apellido}` : t('rrhh.employee')}</span>
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', statusColor)}>{t(estadoKey)}</span>
                          <span className="text-xs text-slate-500">·</span>
                          <span className="text-xs text-violet-300">{t(TIPO_SOLICITUD_KEY[s.tipo])}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(s.fecha_inicio).toLocaleDateString('es-UY')} → {new Date(s.fecha_fin).toLocaleDateString('es-UY')}
                          {' · '}{s.dias_solicitados} {s.dias_solicitados !== 1 ? t('rrhh.days') : t('rrhh.day')}
                        </p>
                        {s.motivo && <p className="text-xs text-slate-500 mt-1 italic">"{s.motivo}"</p>}
                        {s.estado !== 'pendiente' && s.observaciones_aprobacion && (
                          <p className="text-[11px] text-slate-500 mt-1">{t('rrhh.resolution')}: {s.observaciones_aprobacion}</p>
                        )}
                      </div>
                      {s.estado === 'pendiente' && (
                        <div className="flex gap-1.5">
                          <button onClick={() => onAprobar(s)} className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded text-xs font-medium">{t('rrhh.approve')}</button>
                          <button onClick={() => onRechazar(s)} className="px-2 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded text-xs font-medium">{t('rrhh.reject')}</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {solicitudes.length === 0 && (
                <div className="text-center py-12 text-sm text-slate-500">{t('rrhh.noRequests')}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ===== MODAL NUEVO EMPLEADO ===== */}
      {showFormEmpleado && (
        <Modal onClose={() => setShowFormEmpleado(false)} title={t('rrhh.newEmployee')}>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`${t('rrhh.name')} *`}     value={formEmp.nombre}    onChange={v => setFormEmp({ ...formEmp, nombre: v })} />
            <Field label={`${t('rrhh.surname')} *`}  value={formEmp.apellido}  onChange={v => setFormEmp({ ...formEmp, apellido: v })} />
            <Field label={`${t('rrhh.position')} *`} value={formEmp.cargo}     onChange={v => setFormEmp({ ...formEmp, cargo: v })} />
            <Field label={`${t('rrhh.areaLabel')} *`}value={formEmp.area}      onChange={v => setFormEmp({ ...formEmp, area: v })} />
            <Field label={t('rrhh.dni')}             value={formEmp.dni}       onChange={v => setFormEmp({ ...formEmp, dni: v })} />
            <Field label={t('rrhh.loginEmail')}      value={formEmp.user_email} onChange={v => setFormEmp({ ...formEmp, user_email: v })} />
            <Field label={t('rrhh.phone')}           value={formEmp.telefono}  onChange={v => setFormEmp({ ...formEmp, telefono: v })} />
            <Field label={t('rrhh.personalEmail')}   value={formEmp.email_personal} onChange={v => setFormEmp({ ...formEmp, email_personal: v })} />
            <Field label={`${t('rrhh.dateOfAdmission')} *`} type="date" value={formEmp.fecha_ingreso} onChange={v => setFormEmp({ ...formEmp, fecha_ingreso: v })} />
            <Field label={t('rrhh.dateOfBirth')}     type="date" value={formEmp.fecha_nacimiento} onChange={v => setFormEmp({ ...formEmp, fecha_nacimiento: v })} />
            <Field label={t('rrhh.baseSalary')}      type="number" value={formEmp.sueldo_base} onChange={v => setFormEmp({ ...formEmp, sueldo_base: v })} />
            <div className="col-span-2 flex gap-3 mt-2">
              <button onClick={onCrearEmpleado} className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium">{t('rrhh.createEmployee')}</button>
              <button onClick={() => setShowFormEmpleado(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm">{t('wmsModule.cancel')}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ===== MODAL NUEVA SOLICITUD ===== */}
      {showFormSolicitud && (
        <Modal onClose={() => setShowFormSolicitud(false)} title={t('rrhh.newRequest')}>
          <div className="space-y-3">
            <label className="text-xs text-slate-400">{t('rrhh.employee')}
              <select value={formSol.empleadoId} onChange={e => setFormSol({ ...formSol, empleadoId: e.target.value })}
                className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200">
                <option value="">{t('common.select')}</option>
                {empleados.filter(e => e.estado === 'activo').map(e => (
                  <option key={e.id} value={e.id}>{e.nombre} {e.apellido} ({e.area})</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-400">{t('rrhh.type')}
              <select value={formSol.tipo} onChange={e => setFormSol({ ...formSol, tipo: e.target.value as TipoSolicitud })}
                className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200">
                {Object.entries(TIPO_SOLICITUD_KEY).map(([k, key]) => <option key={k} value={k}>{t(key)}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`${t('rrhh.from')} *`} type="date" value={formSol.fechaInicio} onChange={v => setFormSol({ ...formSol, fechaInicio: v })} />
              <Field label={`${t('rrhh.to')} *`}   type="date" value={formSol.fechaFin}    onChange={v => setFormSol({ ...formSol, fechaFin: v })} />
            </div>
            <label className="text-xs text-slate-400">{t('rrhh.reason')}
              <textarea value={formSol.motivo} onChange={e => setFormSol({ ...formSol, motivo: e.target.value })} rows={3}
                className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200" />
            </label>
            <div className="flex gap-3 mt-2">
              <button onClick={onCrearSolicitud} className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium">{t('rrhh.send')}</button>
              <button onClick={() => setShowFormSolicitud(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm">{t('wmsModule.cancel')}</button>
            </div>
          </div>
        </Modal>
      )}

      <toast.Toast />
    </div>
  );
}

// =====================================================
// Subcomponentes
// =====================================================

function KPI({ icon: Icon, label, value, accent }: {
  icon: any; label: string; value: number | string;
  accent: 'violet' | 'emerald' | 'amber' | 'slate' | 'cyan';
}) {
  const colors: Record<string, string> = {
    violet: 'text-violet-300 bg-violet-500/10',
    emerald: 'text-emerald-300 bg-emerald-500/10',
    amber: 'text-amber-300 bg-amber-500/10',
    slate: 'text-slate-300 bg-slate-500/10',
    cyan: 'text-cyan-300 bg-cyan-500/10',
  };
  return (
    <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 flex items-center gap-3">
      <div className={cn('p-2 rounded-lg', colors[accent])}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-xl font-bold text-slate-100">{value}</div>
      </div>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-100">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <label className="text-xs text-slate-400 block">
      {label}
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-violet-500" />
    </label>
  );
}
