'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Edit, Trash2, CheckCircle, XCircle, AlertTriangle,
  RefreshCw, Save, X, Users, Target, DollarSign, Award,
  TrendingUp, Calendar, Percent, BarChart3
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { cn, formatCurrency } from '@/lib/utils';
import { registrarAuditoria } from '@/lib/audit';
import { useAuth } from '@/hooks/useAuth';

// ============================================
// TIPOS
// ============================================

interface ReglaComision {
  id: string;
  vendedor_email: string;
  vendedor_nombre?: string;
  categoria?: string;
  pct_comision: number;
  pct_comision_extra?: number;
  meta_minima?: number;
  activa: boolean;
  created_at: string;
}

interface MetaVendedor {
  id: string;
  vendedor_email: string;
  vendedor_nombre?: string;
  mes: number;
  anio: number;
  meta_ventas: number;
  ventas_actual: number;
  comision_generada: number;
  pct_cumplimiento: number;
}

interface VendedorResumen {
  email: string;
  nombre: string;
  ventasMes: number;
  meta: number;
  pctCumplimiento: number;
  comisionBase: number;
  comisionExtra: number;
  comisionTotal: number;
  ordenes: number;
}

type EstadoLiquidacion = 'pendiente' | 'aprobada' | 'pagada' | 'anulada';

interface LiquidacionComision {
  id: string;
  vendedor_email: string;
  vendedor_nombre?: string;
  mes: number;
  anio: number;
  ventas_total: number;
  meta: number;
  pct_cumplimiento: number;
  comision_base: number;
  comision_extra: number;
  comision_total: number;
  ordenes: number;
  estado: EstadoLiquidacion;
  fecha_cierre: string;
  fecha_pago?: string;
  cerrado_por?: string;
  pagado_por?: string;
  notas?: string;
}

type SeccionActiva = 'dashboard' | 'reglas' | 'metas' | 'liquidacion';

// ============================================
// TOAST
// ============================================

function useToast() {
  const [toasts, setToasts] = useState<Array<{ id: string; type: string; title: string }>>([]);
  const add = (type: string, title: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, title }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  };
  const Toast = () => toasts.length > 0 ? (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map(t => (
        <div key={t.id} className={cn(
          'px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3',
          t.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' :
          'bg-red-500/20 border-red-500/30 text-red-400'
        )}>
          {t.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          <span className="text-sm font-medium">{t.title}</span>
        </div>
      ))}
    </div>
  ) : null;
  return { success: (t: string) => add('success', t), error: (t: string) => add('error', t), Toast };
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function ComisionesVendedores() {
  const { user } = useAuth(false);
  const toast = useToast();
  const [seccion, setSeccion] = useState<SeccionActiva>('dashboard');
  const [loading, setLoading] = useState(true);

  // Data
  const [reglas, setReglas] = useState<ReglaComision[]>([]);
  const [metas, setMetas] = useState<MetaVendedor[]>([]);
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionComision[]>([]);
  const [filterAnio, setFilterAnio] = useState<number>(new Date().getFullYear());
  const [procesandoLiq, setProcesandoLiq] = useState<string | null>(null);
  const [resumen, setResumen] = useState<VendedorResumen[]>([]);
  const [vendedores, setVendedores] = useState<Array<{ email: string; nombre: string }>>([]);

  // Forms
  const [showReglaForm, setShowReglaForm] = useState(false);
  const [editRegla, setEditRegla] = useState<ReglaComision | null>(null);
  const [reglaForm, setReglaForm] = useState({
    vendedor_email: '', categoria: '', pct_comision: '5', pct_comision_extra: '', meta_minima: ''
  });

  const [showMetaForm, setShowMetaForm] = useState(false);
  const [metaForm, setMetaForm] = useState({ vendedor_email: '', meta_ventas: '' });

  const mesActual = new Date().getMonth() + 1;
  const anioActual = new Date().getFullYear();

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    loadLiquidaciones();
  }, [filterAnio]);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadVendedores(), loadReglas(), loadMetas(), loadResumen(), loadLiquidaciones()]);
    setLoading(false);
  };

  const loadLiquidaciones = async () => {
    const { data } = await supabase
      .from('liquidaciones_comisiones')
      .select('*')
      .eq('anio', filterAnio)
      .order('mes', { ascending: false })
      .order('comision_total', { ascending: false });
    if (data) {
      setLiquidaciones(data.map((l: any) => ({
        ...l,
        ventas_total: parseFloat(l.ventas_total) || 0,
        meta: parseFloat(l.meta) || 0,
        pct_cumplimiento: parseFloat(l.pct_cumplimiento) || 0,
        comision_base: parseFloat(l.comision_base) || 0,
        comision_extra: parseFloat(l.comision_extra) || 0,
        comision_total: parseFloat(l.comision_total) || 0,
        ordenes: parseInt(l.ordenes) || 0,
      })));
    } else {
      setLiquidaciones([]);
    }
  };

  const loadVendedores = async () => {
    const { data } = await supabase.from('usuarios').select('email, nombre').eq('rol', 'vendedor').eq('activo', true);
    if (data) setVendedores(data.map((u: any) => ({ email: u.email, nombre: u.nombre || u.email.split('@')[0] })));
  };

  const loadReglas = async () => {
    const { data } = await supabase.from('reglas_comisiones').select('*').order('created_at', { ascending: false });
    if (data) {
      const enriched = data.map((r: any) => {
        const v = vendedores.find(v => v.email === r.vendedor_email);
        return { ...r, vendedor_nombre: v?.nombre || r.vendedor_email?.split('@')[0] || 'Todos' };
      });
      setReglas(enriched);
    } else {
      setReglas([]);
    }
  };

  const loadMetas = async () => {
    const { data } = await supabase
      .from('metas_vendedores')
      .select('*')
      .eq('mes', mesActual)
      .eq('anio', anioActual);
    setMetas(data || []);
  };

  const loadResumen = async () => {
    const inicioMes = new Date(anioActual, mesActual - 1, 1).toISOString().split('T')[0];
    const finMes = new Date(anioActual, mesActual, 0).toISOString().split('T')[0];

    // Ventas del mes — atribuir al vendedor real si existe,
    // si no, caer al usuario que cargó la orden (compat).
    const { data: ventas } = await supabase
      .from('ordenes_venta')
      .select('vendedor_email, creado_por, total')
      .gte('fecha_orden', inicioMes)
      .lte('fecha_orden', finMes)
      .not('estado', 'eq', 'cancelada');

    // Get commission rules
    const { data: reglasData } = await supabase.from('reglas_comisiones').select('*').eq('activa', true);

    // Get targets
    const { data: metasData } = await supabase
      .from('metas_vendedores')
      .select('*')
      .eq('mes', mesActual)
      .eq('anio', anioActual);

    // Group by seller
    const vendedorMap = new Map<string, { ventas: number; ordenes: number }>();
    ventas?.forEach((v: any) => {
      const email = v.vendedor_email || v.creado_por;
      if (!email) return;
      const total = parseFloat(v.total || 0);
      const existing = vendedorMap.get(email);
      if (existing) {
        existing.ventas += total;
        existing.ordenes += 1;
      } else {
        vendedorMap.set(email, { ventas: total, ordenes: 1 });
      }
    });

    const resumenList: VendedorResumen[] = [];

    vendedorMap.forEach((data, email) => {
      const vend = vendedores.find(v => v.email === email);
      const nombre = vend?.nombre || email.split('@')[0];

      // Find applicable rules (specific > generic)
      const reglaEspecifica = reglasData?.find((r: any) => r.vendedor_email === email && r.activa);
      const reglaGeneral = reglasData?.find((r: any) => !r.vendedor_email && r.activa);
      const regla = reglaEspecifica || reglaGeneral;

      const pctBase = regla ? parseFloat(regla.pct_comision || 0) : 0;
      const pctExtra = regla ? parseFloat(regla.pct_comision_extra || 0) : 0;
      const metaMin = regla ? parseFloat(regla.meta_minima || 0) : 0;

      const meta = metasData?.find((m: any) => m.vendedor_email === email);
      const metaVentas = meta ? parseFloat(meta.meta_ventas || 0) : 0;
      const pctCumplimiento = metaVentas > 0 ? (data.ventas / metaVentas) * 100 : 0;

      const comisionBase = data.ventas * (pctBase / 100);
      const comisionExtra = (metaMin > 0 && data.ventas >= metaMin) ? data.ventas * (pctExtra / 100) : 0;

      resumenList.push({
        email,
        nombre,
        ventasMes: data.ventas,
        meta: metaVentas,
        pctCumplimiento,
        comisionBase,
        comisionExtra,
        comisionTotal: comisionBase + comisionExtra,
        ordenes: data.ordenes,
      });
    });

    setResumen(resumenList.sort((a, b) => b.ventasMes - a.ventasMes));
  };

  // ---- REGLAS ----

  const saveRegla = async () => {
    if (!reglaForm.pct_comision) return;
    try {
      const payload = {
        vendedor_email: reglaForm.vendedor_email || null,
        categoria: reglaForm.categoria.trim() || null,
        pct_comision: parseFloat(reglaForm.pct_comision),
        pct_comision_extra: reglaForm.pct_comision_extra ? parseFloat(reglaForm.pct_comision_extra) : null,
        meta_minima: reglaForm.meta_minima ? parseFloat(reglaForm.meta_minima) : null,
        activa: true,
      };

      if (editRegla) {
        const { error } = await supabase.from('reglas_comisiones').update(payload).eq('id', editRegla.id);
        if (error) throw error;
        await registrarAuditoria('reglas_comisiones', 'ACTUALIZAR', editRegla.id, editRegla, payload, user?.email || '');
        toast.success('Regla actualizada');
      } else {
        const { data, error } = await supabase.from('reglas_comisiones').insert(payload).select().single();
        if (error) throw error;
        await registrarAuditoria('reglas_comisiones', 'CREAR', data.id, null, payload, user?.email || '');
        toast.success('Regla de comisión creada');
      }

      resetReglaForm();
      loadReglas();
    } catch {
      toast.error('Error al guardar regla');
    }
  };

  const resetReglaForm = () => {
    setShowReglaForm(false);
    setEditRegla(null);
    setReglaForm({ vendedor_email: '', categoria: '', pct_comision: '5', pct_comision_extra: '', meta_minima: '' });
  };

  const eliminarRegla = async (r: ReglaComision) => {
    if (!confirm('¿Eliminar esta regla?')) return;
    await supabase.from('reglas_comisiones').delete().eq('id', r.id);
    await registrarAuditoria('reglas_comisiones', 'ELIMINAR', r.id, r, null, user?.email || '');
    toast.success('Regla eliminada');
    loadReglas();
  };

  // ---- METAS ----

  const saveMeta = async () => {
    if (!metaForm.vendedor_email || !metaForm.meta_ventas) return;
    try {
      const existing = metas.find(m => m.vendedor_email === metaForm.vendedor_email);
      const payload = {
        vendedor_email: metaForm.vendedor_email,
        mes: mesActual,
        anio: anioActual,
        meta_ventas: parseFloat(metaForm.meta_ventas),
      };

      if (existing) {
        const { error } = await supabase.from('metas_vendedores').update({ meta_ventas: payload.meta_ventas }).eq('id', existing.id);
        if (error) throw error;
        await registrarAuditoria('metas_vendedores', 'ACTUALIZAR', existing.id, existing, payload, user?.email || '');
      } else {
        const { data, error } = await supabase.from('metas_vendedores').insert(payload).select().single();
        if (error) throw error;
        await registrarAuditoria('metas_vendedores', 'CREAR', data.id, null, payload, user?.email || '');
      }

      toast.success('Meta guardada');
      setShowMetaForm(false);
      setMetaForm({ vendedor_email: '', meta_ventas: '' });
      loadMetas();
      loadResumen();
    } catch {
      toast.error('Error al guardar meta');
    }
  };

  // ---- LIQUIDACIÓN ----

  const cerrarMes = async () => {
    if (resumen.length === 0) {
      toast.error('No hay ventas registradas este mes');
      return;
    }

    const ya = liquidaciones.some(l => l.mes === mesActual && l.anio === anioActual);
    if (ya) {
      if (!confirm(`Ya existe una liquidación para ${mesActual}/${anioActual}. ¿Recalcular y reemplazar las pendientes?`)) return;
    } else {
      if (!confirm(`Cerrar comisiones de ${mesActual}/${anioActual}? Se generará una liquidación por cada vendedor.`)) return;
    }

    try {
      setProcesandoLiq('cerrar');

      // Eliminar previas en estado pendiente del mismo período (las pagadas/aprobadas se conservan)
      await supabase
        .from('liquidaciones_comisiones')
        .delete()
        .eq('mes', mesActual)
        .eq('anio', anioActual)
        .eq('estado', 'pendiente');

      const payload = resumen.map(v => ({
        vendedor_email: v.email,
        vendedor_nombre: v.nombre,
        mes: mesActual,
        anio: anioActual,
        ventas_total: v.ventasMes,
        meta: v.meta,
        pct_cumplimiento: v.pctCumplimiento,
        comision_base: v.comisionBase,
        comision_extra: v.comisionExtra,
        comision_total: v.comisionTotal,
        ordenes: v.ordenes,
        estado: 'pendiente',
        cerrado_por: user?.email || null,
      }));

      const { error } = await supabase.from('liquidaciones_comisiones').insert(payload);
      if (error) throw error;

      const totalLiq = resumen.reduce((s, v) => s + v.comisionTotal, 0);
      await registrarAuditoria('liquidaciones_comisiones', 'CERRAR_MES', `${mesActual}/${anioActual}`,
        null,
        { mes: mesActual, anio: anioActual, vendedores: resumen.length, total_comisiones: totalLiq },
        user?.email || ''
      );

      toast.success(`Mes cerrado · ${resumen.length} liquidaciones generadas`);
      setFilterAnio(anioActual);
      loadLiquidaciones();
    } catch (e: any) {
      toast.error(e.message || 'Error al cerrar mes');
    } finally {
      setProcesandoLiq(null);
    }
  };

  const cambiarEstadoLiquidacion = async (liq: LiquidacionComision, nuevo: EstadoLiquidacion) => {
    try {
      setProcesandoLiq(liq.id);
      const update: any = { estado: nuevo };
      if (nuevo === 'pagada') {
        update.fecha_pago = new Date().toISOString();
        update.pagado_por = user?.email || null;
      }
      const { error } = await supabase.from('liquidaciones_comisiones').update(update).eq('id', liq.id);
      if (error) throw error;

      await registrarAuditoria('liquidaciones_comisiones', `ESTADO_${nuevo.toUpperCase()}`,
        `${liq.vendedor_email} ${liq.mes}/${liq.anio}`,
        { estado: liq.estado },
        { estado: nuevo, monto: liq.comision_total },
        user?.email || ''
      );

      toast.success(`Liquidación → ${nuevo}`);
      loadLiquidaciones();
    } catch (e: any) {
      toast.error(e.message || 'Error');
    } finally {
      setProcesandoLiq(null);
    }
  };

  // ---- CHART DATA ----

  const chartData = useMemo(() => {
    return resumen.map(v => ({
      nombre: v.nombre.length > 12 ? v.nombre.slice(0, 12) + '…' : v.nombre,
      ventas: v.ventasMes,
      meta: v.meta,
      comision: v.comisionTotal,
    }));
  }, [resumen]);

  // ============================================
  // RENDER
  // ============================================

  const secciones: { id: SeccionActiva; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Resumen', icon: BarChart3 },
    { id: 'reglas', label: 'Reglas de Comisión', icon: Percent },
    { id: 'metas', label: 'Metas Mensuales', icon: Target },
    { id: 'liquidacion', label: 'Liquidación', icon: DollarSign },
  ];

  const totalComisiones = resumen.reduce((s, v) => s + v.comisionTotal, 0);
  const totalVentas = resumen.reduce((s, v) => s + v.ventasMes, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Award className="h-6 w-6 text-amber-400" />
            Comisiones de Vendedores
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">Reglas, metas y liquidación de comisiones</p>
        </div>
        <button onClick={loadAll} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Secciones */}
      <div className="flex items-center gap-1 p-1 bg-slate-900/50 rounded-xl border border-slate-800/50">
        {secciones.map(s => {
          const Icon = s.icon;
          return (
            <button key={s.id} onClick={() => setSeccion(s.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                seccion === s.id ? 'bg-amber-500/15 text-amber-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              )}>
              <Icon size={15} />
              {s.label}
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="flex items-center justify-center p-12">
          <RefreshCw className="h-6 w-6 animate-spin text-amber-400" />
        </div>
      )}

      {/* ============ DASHBOARD ============ */}
      {!loading && seccion === 'dashboard' && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="p-2 rounded-xl bg-emerald-500/20 w-fit mb-3">
                <DollarSign className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400">{formatCurrency(totalVentas)}</div>
              <div className="text-sm text-slate-400">Ventas del Mes</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="p-2 rounded-xl bg-amber-500/20 w-fit mb-3">
                <Award className="h-5 w-5 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-amber-400">{formatCurrency(totalComisiones)}</div>
              <div className="text-sm text-slate-400">Comisiones Generadas</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="p-2 rounded-xl bg-blue-500/20 w-fit mb-3">
                <Users className="h-5 w-5 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-blue-400">{resumen.length}</div>
              <div className="text-sm text-slate-400">Vendedores Activos</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="p-2 rounded-xl bg-purple-500/20 w-fit mb-3">
                <Percent className="h-5 w-5 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-purple-400">
                {totalVentas > 0 ? ((totalComisiones / totalVentas) * 100).toFixed(1) : '0'}%
              </div>
              <div className="text-sm text-slate-400">% Comisión Promedio</div>
            </div>
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-emerald-400" />
                Ventas vs Meta por Vendedor
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="nombre" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                    formatter={(v: number) => formatCurrency(v)}
                  />
                  <Bar dataKey="meta" name="Meta" fill="#334155" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ventas" name="Ventas" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.ventas >= entry.meta && entry.meta > 0 ? '#10b981' : '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabla de vendedores */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h3 className="font-semibold text-slate-200 mb-4">Detalle por Vendedor — {new Date().toLocaleDateString('es-UY', { month: 'long', year: 'numeric' })}</h3>
            {resumen.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm">Sin ventas registradas este mes</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
                      <th className="pb-2 font-medium">Vendedor</th>
                      <th className="pb-2 font-medium text-right">Ventas</th>
                      <th className="pb-2 font-medium text-right">Meta</th>
                      <th className="pb-2 font-medium text-right">Cumplimiento</th>
                      <th className="pb-2 font-medium text-right">Comisión Base</th>
                      <th className="pb-2 font-medium text-right">Bono Extra</th>
                      <th className="pb-2 font-medium text-right">Total</th>
                      <th className="pb-2 font-medium text-right">Órdenes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {resumen.map(v => (
                      <tr key={v.email} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3">
                          <div className="font-medium text-slate-200">{v.nombre}</div>
                          <div className="text-xs text-slate-500">{v.email}</div>
                        </td>
                        <td className="py-3 text-right text-emerald-400 font-medium">{formatCurrency(v.ventasMes)}</td>
                        <td className="py-3 text-right text-slate-400">{v.meta > 0 ? formatCurrency(v.meta) : '—'}</td>
                        <td className="py-3 text-right">
                          {v.meta > 0 ? (
                            <span className={cn(
                              'px-2 py-0.5 rounded text-xs font-medium',
                              v.pctCumplimiento >= 100 ? 'bg-emerald-500/20 text-emerald-400' :
                              v.pctCumplimiento >= 70 ? 'bg-amber-500/20 text-amber-400' :
                              'bg-red-500/20 text-red-400'
                            )}>
                              {v.pctCumplimiento.toFixed(0)}%
                            </span>
                          ) : <span className="text-slate-600 text-xs">Sin meta</span>}
                        </td>
                        <td className="py-3 text-right text-slate-300">{formatCurrency(v.comisionBase)}</td>
                        <td className="py-3 text-right text-amber-400">{v.comisionExtra > 0 ? formatCurrency(v.comisionExtra) : '—'}</td>
                        <td className="py-3 text-right font-bold text-slate-100">{formatCurrency(v.comisionTotal)}</td>
                        <td className="py-3 text-right text-slate-400">{v.ordenes}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-slate-700">
                    <tr className="font-semibold">
                      <td className="py-3 text-slate-300">TOTAL</td>
                      <td className="py-3 text-right text-emerald-400">{formatCurrency(totalVentas)}</td>
                      <td className="py-3 text-right text-slate-400">{formatCurrency(resumen.reduce((s, v) => s + v.meta, 0))}</td>
                      <td className="py-3 text-right"></td>
                      <td className="py-3 text-right text-slate-300">{formatCurrency(resumen.reduce((s, v) => s + v.comisionBase, 0))}</td>
                      <td className="py-3 text-right text-amber-400">{formatCurrency(resumen.reduce((s, v) => s + v.comisionExtra, 0))}</td>
                      <td className="py-3 text-right text-slate-100">{formatCurrency(totalComisiones)}</td>
                      <td className="py-3 text-right text-slate-400">{resumen.reduce((s, v) => s + v.ordenes, 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ REGLAS ============ */}
      {!loading && seccion === 'reglas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">Configura porcentajes de comisión por vendedor o global. Agrega bonos por superar metas.</p>
            <button onClick={() => { setShowReglaForm(true); setEditRegla(null); resetReglaForm(); setShowReglaForm(true); }}
              className="flex items-center gap-2 px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-xl text-sm font-medium transition-colors">
              <Plus className="h-4 w-4" /> Nueva Regla
            </button>
          </div>

          {showReglaForm && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
              <h3 className="font-semibold text-slate-200 mb-4">{editRegla ? 'Editar Regla' : 'Nueva Regla de Comisión'}</h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Vendedor (vacío = todos)</label>
                  <select value={reglaForm.vendedor_email} onChange={e => setReglaForm(p => ({ ...p, vendedor_email: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500">
                    <option value="">Todos los vendedores</option>
                    {vendedores.map(v => <option key={v.email} value={v.email}>{v.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Categoría (vacío = todas)</label>
                  <input value={reglaForm.categoria} onChange={e => setReglaForm(p => ({ ...p, categoria: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                    placeholder="Opcional" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">% Comisión Base *</label>
                  <input type="number" step="0.1" min="0" max="100" value={reglaForm.pct_comision}
                    onChange={e => setReglaForm(p => ({ ...p, pct_comision: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">% Bono por Meta</label>
                  <input type="number" step="0.1" min="0" max="100" value={reglaForm.pct_comision_extra}
                    onChange={e => setReglaForm(p => ({ ...p, pct_comision_extra: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                    placeholder="Extra si supera meta" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Meta Mínima para Bono</label>
                  <input type="number" step="100" min="0" value={reglaForm.meta_minima}
                    onChange={e => setReglaForm(p => ({ ...p, meta_minima: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                    placeholder="0" />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={saveRegla} className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-lg text-sm font-medium transition-colors">
                  <Save className="h-4 w-4" /> Guardar
                </button>
                <button onClick={resetReglaForm} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors">
                  <X className="h-4 w-4" /> Cancelar
                </button>
              </div>
            </div>
          )}

          {reglas.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-12 text-center">
              <Percent className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">No hay reglas de comisión</p>
              <p className="text-slate-500 text-sm mt-1">Crea reglas para calcular comisiones automáticamente</p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-800">
                  <tr className="text-left text-xs text-slate-500">
                    <th className="px-4 py-3 font-medium">Vendedor</th>
                    <th className="px-4 py-3 font-medium">Categoría</th>
                    <th className="px-4 py-3 font-medium">% Base</th>
                    <th className="px-4 py-3 font-medium">% Extra</th>
                    <th className="px-4 py-3 font-medium">Meta Min.</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {reglas.map(r => (
                    <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-slate-200 font-medium">{r.vendedor_email ? (r.vendedor_nombre || r.vendedor_email.split('@')[0]) : <span className="text-slate-400 italic">Todos</span>}</td>
                      <td className="px-4 py-3 text-slate-400">{r.categoria || <span className="italic">Todas</span>}</td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400">{r.pct_comision}%</span></td>
                      <td className="px-4 py-3">{r.pct_comision_extra ? <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-400">+{r.pct_comision_extra}%</span> : '—'}</td>
                      <td className="px-4 py-3 text-slate-400">{r.meta_minima ? formatCurrency(r.meta_minima) : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 rounded text-xs font-medium', r.activa ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-500')}>
                          {r.activa ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => {
                            setEditRegla(r);
                            setShowReglaForm(true);
                            setReglaForm({
                              vendedor_email: r.vendedor_email || '',
                              categoria: r.categoria || '',
                              pct_comision: String(r.pct_comision),
                              pct_comision_extra: r.pct_comision_extra ? String(r.pct_comision_extra) : '',
                              meta_minima: r.meta_minima ? String(r.meta_minima) : '',
                            });
                          }} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button onClick={() => eliminarRegla(r)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============ METAS ============ */}
      {!loading && seccion === 'metas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">
              Define metas de ventas mensuales por vendedor — {new Date().toLocaleDateString('es-UY', { month: 'long', year: 'numeric' })}
            </p>
            <button onClick={() => setShowMetaForm(true)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-xl text-sm font-medium transition-colors">
              <Plus className="h-4 w-4" /> Asignar Meta
            </button>
          </div>

          {showMetaForm && (
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-5">
              <h3 className="font-semibold text-slate-200 mb-4">Asignar Meta Mensual</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Vendedor *</label>
                  <select value={metaForm.vendedor_email} onChange={e => setMetaForm(p => ({ ...p, vendedor_email: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500">
                    <option value="">Seleccionar vendedor</option>
                    {vendedores.map(v => <option key={v.email} value={v.email}>{v.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Meta de Ventas ($) *</label>
                  <input type="number" step="100" min="0" value={metaForm.meta_ventas}
                    onChange={e => setMetaForm(p => ({ ...p, meta_ventas: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                    placeholder="100000" />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={saveMeta} className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors">
                  <Save className="h-4 w-4" /> Guardar
                </button>
                <button onClick={() => { setShowMetaForm(false); setMetaForm({ vendedor_email: '', meta_ventas: '' }); }}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors">
                  <X className="h-4 w-4" /> Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Metas actuales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vendedores.map(v => {
              const meta = metas.find(m => m.vendedor_email === v.email);
              const res = resumen.find(r => r.email === v.email);
              const metaVal = meta ? parseFloat(String(meta.meta_ventas)) : 0;
              const ventasVal = res?.ventasMes || 0;
              const pct = metaVal > 0 ? (ventasVal / metaVal) * 100 : 0;

              return (
                <div key={v.email} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-medium text-slate-200 text-sm">{v.nombre}</div>
                      <div className="text-xs text-slate-500">{v.email}</div>
                    </div>
                    {pct >= 100 && metaVal > 0 && (
                      <Award className="h-5 w-5 text-amber-400" />
                    )}
                  </div>

                  {metaVal > 0 ? (
                    <>
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span>{formatCurrency(ventasVal)} de {formatCurrency(metaVal)}</span>
                        <span className={cn(
                          'font-bold',
                          pct >= 100 ? 'text-emerald-400' : pct >= 70 ? 'text-amber-400' : 'text-red-400'
                        )}>{pct.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2">
                        <div className={cn(
                          'h-2 rounded-full transition-all',
                          pct >= 100 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500'
                        )} style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-slate-500 italic py-2">Sin meta asignada este mes</div>
                  )}
                </div>
              );
            })}
            {vendedores.length === 0 && (
              <div className="col-span-full rounded-xl border border-slate-800 bg-slate-900/50 p-10 text-center">
                <Users className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No hay vendedores registrados</p>
                <p className="text-slate-500 text-sm mt-1">Los usuarios con rol &quot;vendedor&quot; aparecerán aquí automáticamente</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ LIQUIDACIÓN ============ */}
      {!loading && seccion === 'liquidacion' && (
        <div className="space-y-4">
          {/* Header de liquidación */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-400">
                Cierre y pago de comisiones por vendedor · período {String(mesActual).padStart(2, '0')}/{anioActual}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={filterAnio}
                onChange={e => setFilterAnio(parseInt(e.target.value))}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200"
              >
                {[anioActual - 2, anioActual - 1, anioActual, anioActual + 1].map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <button
                onClick={cerrarMes}
                disabled={procesandoLiq === 'cerrar'}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 rounded-xl text-sm font-bold transition-colors"
              >
                {procesandoLiq === 'cerrar' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                Cerrar mes {String(mesActual).padStart(2, '0')}/{anioActual}
              </button>
            </div>
          </div>

          {/* KPIs liquidación */}
          {liquidaciones.length > 0 && (() => {
            const pendientes = liquidaciones.filter(l => l.estado === 'pendiente');
            const aprobadas = liquidaciones.filter(l => l.estado === 'aprobada');
            const pagadas = liquidaciones.filter(l => l.estado === 'pagada');
            const sumar = (arr: LiquidacionComision[]) => arr.reduce((s, l) => s + l.comision_total, 0);
            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <div className="text-xs text-slate-400 mb-1">Pendientes</div>
                  <div className="text-xl font-bold text-amber-400">{formatCurrency(sumar(pendientes))}</div>
                  <div className="text-xs text-slate-500">{pendientes.length} liquidaciones</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <div className="text-xs text-slate-400 mb-1">Aprobadas</div>
                  <div className="text-xl font-bold text-blue-400">{formatCurrency(sumar(aprobadas))}</div>
                  <div className="text-xs text-slate-500">{aprobadas.length} liquidaciones</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <div className="text-xs text-slate-400 mb-1">Pagadas</div>
                  <div className="text-xl font-bold text-emerald-400">{formatCurrency(sumar(pagadas))}</div>
                  <div className="text-xs text-slate-500">{pagadas.length} liquidaciones</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <div className="text-xs text-slate-400 mb-1">Total {filterAnio}</div>
                  <div className="text-xl font-bold text-slate-200">{formatCurrency(sumar(liquidaciones))}</div>
                  <div className="text-xs text-slate-500">{liquidaciones.length} liquidaciones</div>
                </div>
              </div>
            );
          })()}

          {/* Tabla liquidaciones */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-800/50">
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
                    <th className="px-4 py-3 font-medium">Período</th>
                    <th className="px-4 py-3 font-medium">Vendedor</th>
                    <th className="px-4 py-3 font-medium text-right">Ventas</th>
                    <th className="px-4 py-3 font-medium text-right">Cumpl.</th>
                    <th className="px-4 py-3 font-medium text-right">Comisión</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Pago</th>
                    <th className="px-4 py-3 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {liquidaciones.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                        <DollarSign className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        Sin liquidaciones para {filterAnio}. Cerrá el mes para generarlas.
                      </td>
                    </tr>
                  ) : liquidaciones.map(l => {
                    const cfg = {
                      pendiente: { color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'Pendiente' },
                      aprobada: { color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Aprobada' },
                      pagada: { color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'Pagada' },
                      anulada: { color: 'text-slate-400', bg: 'bg-slate-500/20', label: 'Anulada' },
                    }[l.estado];
                    return (
                      <tr key={l.id} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-mono text-slate-300">
                          {String(l.mes).padStart(2, '0')}/{l.anio}
                        </td>
                        <td className="px-4 py-3 text-slate-200">{l.vendedor_nombre || l.vendedor_email}</td>
                        <td className="px-4 py-3 text-right text-slate-300 font-mono">{formatCurrency(l.ventas_total)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn(
                            'font-bold',
                            l.pct_cumplimiento >= 100 ? 'text-emerald-400' :
                            l.pct_cumplimiento >= 70 ? 'text-amber-400' : 'text-red-400'
                          )}>
                            {l.pct_cumplimiento.toFixed(0)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-bold text-amber-400 font-mono">{formatCurrency(l.comision_total)}</div>
                          {l.comision_extra > 0 && (
                            <div className="text-[10px] text-slate-500">+{formatCurrency(l.comision_extra)} bono</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('px-2 py-0.5 rounded text-xs font-medium', cfg.bg, cfg.color)}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {l.fecha_pago ? new Date(l.fecha_pago).toLocaleDateString('es-UY') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            {l.estado === 'pendiente' && (
                              <button
                                onClick={() => cambiarEstadoLiquidacion(l, 'aprobada')}
                                disabled={procesandoLiq === l.id}
                                className="px-2 py-1 rounded-lg text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 disabled:opacity-50"
                                title="Aprobar"
                              >
                                Aprobar
                              </button>
                            )}
                            {l.estado === 'aprobada' && (
                              <button
                                onClick={() => cambiarEstadoLiquidacion(l, 'pagada')}
                                disabled={procesandoLiq === l.id}
                                className="px-2 py-1 rounded-lg text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 disabled:opacity-50 flex items-center gap-1"
                                title="Marcar como pagada"
                              >
                                <CheckCircle className="h-3 w-3" />
                                Pagar
                              </button>
                            )}
                            {(l.estado === 'pendiente' || l.estado === 'aprobada') && (
                              <button
                                onClick={() => cambiarEstadoLiquidacion(l, 'anulada')}
                                disabled={procesandoLiq === l.id}
                                className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 disabled:opacity-50"
                                title="Anular"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <toast.Toast />
    </div>
  );
}
