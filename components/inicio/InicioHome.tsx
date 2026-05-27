'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useModulosHabilitados } from '@/hooks/useModulosHabilitados';
import type { Product, TabType } from '@/types';
import {
  LayoutDashboard, Briefcase, Package, ArrowLeftRight, MessageCircle,
  DollarSign, Truck, Kanban, Warehouse, FileText, Users, Boxes, Wrench,
  Shield, ShieldAlert, RotateCcw, Brain, Zap, Sparkles, QrCode, GitBranch,
  Plug, Building2, AlertTriangle, CheckCircle2, ChevronRight, Plus, X,
  type LucideIcon,
} from 'lucide-react';

// =====================================================
// Pantalla de Inicio — escritorio del sistema
// =====================================================

interface InicioHomeProps {
  user: { nombre?: string; email?: string; rol?: string } | null;
  onTabChange: (tab: TabType) => void;
  products: Product[];
}

interface ModuleTile { id: TabType; label: string; icon: LucideIcon; }

const ALL_TILES: ModuleTile[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'stock', label: 'Stock', icon: Package },
  { id: 'movimientos', label: 'Movimientos', icon: ArrowLeftRight },
  { id: 'reportes', label: 'Reportes', icon: FileText },
  { id: 'comercial', label: 'Comercial', icon: DollarSign },
  { id: 'executive', label: 'Vista Ejecutiva', icon: Briefcase },
  { id: 'chat', label: 'Mensajes', icon: MessageCircle },
  { id: 'replenishment', label: 'Reabastecimiento', icon: Truck },
  { id: 'proyectos', label: 'Proyectos', icon: Kanban },
  { id: 'wms', label: 'WMS', icon: Warehouse },
  { id: 'facturacion', label: 'Facturación', icon: FileText },
  { id: 'clientes_360', label: 'Cliente 360°', icon: Users },
  { id: 'bom', label: 'BOM', icon: Boxes },
  { id: 'ensamblajes', label: 'Ensamblajes', icon: Wrench },
  { id: 'taller', label: 'Taller', icon: Wrench },
  { id: 'garantias', label: 'Garantías', icon: Shield },
  { id: 'tickets', label: 'Tickets', icon: MessageCircle },
  { id: 'customer_risk', label: 'Clientes en riesgo', icon: ShieldAlert },
  { id: 'rma', label: 'Devoluciones', icon: RotateCcw },
  { id: 'rrhh', label: 'RRHH', icon: Users },
  { id: 'analytics', label: 'Analytics IA', icon: Brain },
  { id: 'demand', label: 'Demand Planning', icon: Zap },
  { id: 'pricing', label: 'Precios IA', icon: Sparkles },
  { id: 'aprobaciones', label: 'Aprobaciones', icon: Shield },
  { id: 'seriales', label: 'Seriales', icon: QrCode },
  { id: 'trazabilidad', label: 'Trazabilidad', icon: GitBranch },
  { id: 'qms', label: 'Calidad', icon: Shield },
  { id: 'auditoria', label: 'Auditoría', icon: Shield },
  { id: 'integraciones', label: 'Integraciones', icon: Plug },
  { id: 'configuracion', label: 'Configuración', icon: Sparkles },
  { id: 'empresas', label: 'Mis empresas', icon: Building2 },
];

// 5 principales por defecto.
const PRINCIPALES: TabType[] = ['dashboard', 'stock', 'movimientos', 'reportes', 'comercial'];

interface Recordatorio {
  texto: string; detalle?: string; tab: TabType;
  severidad: 'alta' | 'media' | 'info'; icon: LucideIcon;
}

export function InicioHome({ user, onTabChange, products }: InicioHomeProps) {
  const { modulos } = useModulosHabilitados();
  const [recordatoriosBackend, setRecordatoriosBackend] = useState<Recordatorio[]>([]);
  const [favoritos, setFavoritos] = useState<TabType[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  const favKey = `vg:home-fav:${user?.email || 'anon'}`;

  // Cargar favoritos guardados.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(favKey);
      if (raw) setFavoritos(JSON.parse(raw));
    } catch { /* noop */ }
  }, [favKey]);

  const guardarFav = (next: TabType[]) => {
    setFavoritos(next);
    try { localStorage.setItem(favKey, JSON.stringify(next)); } catch { /* noop */ }
  };

  const nombre = user?.nombre || user?.email?.split('@')[0] || '';
  const saludo = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }, []);
  const fecha = useMemo(
    () => new Date().toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long' }),
    [],
  );

  const moduloSet = useMemo(() => new Set<string>(modulos), [modulos]);

  // Tiles principales: los 5 por defecto que estén habilitados.
  const principales = useMemo(
    () => ALL_TILES.filter(t => PRINCIPALES.includes(t.id) && moduloSet.has(t.id as string)),
    [moduloSet],
  );
  // Tiles favoritos elegidos por el usuario (que estén habilitados y no sean principales).
  const favTiles = useMemo(
    () => ALL_TILES.filter(t => favoritos.includes(t.id) && moduloSet.has(t.id as string) && !PRINCIPALES.includes(t.id)),
    [favoritos, moduloSet],
  );
  // Disponibles para agregar.
  const disponibles = useMemo(
    () => ALL_TILES.filter(t => moduloSet.has(t.id as string) && !PRINCIPALES.includes(t.id)),
    [moduloSet],
  );

  // Resumen rápido (decoración con datos reales).
  const resumen = useMemo(() => {
    const total = products.length;
    const agotados = products.filter(p => p.stock === 0).length;
    const bajos = products.filter(p => p.stock > 0 && p.stock <= p.stockMinimo).length;
    return { total, agotados, bajos };
  }, [products]);

  const recordatoriosLocales = useMemo<Recordatorio[]>(() => {
    const out: Recordatorio[] = [];
    if (resumen.agotados > 0) out.push({ texto: `${resumen.agotados} producto${resumen.agotados === 1 ? '' : 's'} sin stock`, detalle: 'Requieren reposición', tab: 'stock', severidad: 'alta', icon: AlertTriangle });
    if (resumen.bajos > 0) out.push({ texto: `${resumen.bajos} con stock bajo`, detalle: 'Por debajo del mínimo', tab: 'replenishment', severidad: 'media', icon: Package });
    return out;
  }, [resumen]);

  useEffect(() => {
    let cancelled = false;
    const email = user?.email;
    if (!email) return;
    (async () => {
      const out: Recordatorio[] = [];
      try {
        const { count } = await supabase.from('aprobaciones').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente');
        if (count && count > 0) out.push({ texto: `${count} aprobación${count === 1 ? '' : 'es'} pendiente${count === 1 ? '' : 's'}`, detalle: 'Esperando tu decisión', tab: 'aprobaciones', severidad: 'alta', icon: Shield });
      } catch { /* noop */ }
      try {
        const { data } = await supabase.from('solicitudes_insumos').select('id, estado').eq('gestor_asignado', email).in('estado', ['pendiente', 'en_gestion', 'comprada']);
        if (data && data.length > 0) out.push({ texto: `${data.length} solicitud${data.length === 1 ? '' : 'es'} de insumo a tu cargo`, detalle: 'Tenés que gestionarlas', tab: 'comercial', severidad: 'media', icon: Truck });
      } catch { /* noop */ }
      try {
        const hoy = new Date().toISOString().split('T')[0];
        const { count } = await supabase.from('cuentas_por_cobrar').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente').lt('fecha_vencimiento', hoy);
        if (count && count > 0) out.push({ texto: `${count} cuenta${count === 1 ? '' : 's'} por cobrar vencida${count === 1 ? '' : 's'}`, detalle: 'Gestión de cobranza', tab: 'comercial', severidad: 'alta', icon: DollarSign });
      } catch { /* noop */ }
      if (!cancelled) setRecordatoriosBackend(out);
    })();
    return () => { cancelled = true; };
  }, [user?.email]);

  const recordatorios = useMemo(() => [...recordatoriosLocales, ...recordatoriosBackend], [recordatoriosLocales, recordatoriosBackend]);

  const sevStyle = (s: Recordatorio['severidad']) =>
    s === 'alta' ? 'border-red-500/30 bg-red-500/5'
    : s === 'media' ? 'border-amber-500/30 bg-amber-500/5'
    : 'border-slate-700/40 bg-slate-800/30';

  // Tile con halo azul + leve 3D al hover.
  const Tile = ({ t, big }: { t: ModuleTile; big?: boolean }) => {
    const Icon = t.icon;
    return (
      <button
        onClick={() => onTabChange(t.id)}
        className={`group relative flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-slate-800/60 bg-slate-900/40
          transition-all duration-200 hover:-translate-y-1 hover:border-blue-500/50 hover:bg-blue-500/[0.06]
          hover:shadow-[0_10px_30px_-8px_rgba(59,130,246,0.45)] ${big ? 'px-4 py-8' : 'px-3 py-6'}`}
      >
        <Icon
          size={big ? 36 : 30}
          strokeWidth={2}
          className="text-slate-300 group-hover:text-blue-400 transition-colors"
        />
        <span className={`${big ? 'text-sm' : 'text-xs'} text-slate-300 text-center leading-tight font-medium`}>{t.label}</span>
      </button>
    );
  };

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] px-6 py-10">
      <div className="relative max-w-5xl mx-auto">
        {/* Saludo + resumen rápido */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-100">
              {saludo}{nombre ? `, ${nombre}` : ''}
            </h1>
            <p className="text-sm text-slate-500 mt-1 capitalize">{fecha}</p>
          </div>
          <div className="flex gap-3">
            {[
              { label: 'Productos', value: resumen.total },
              { label: 'Stock bajo', value: resumen.bajos },
              { label: 'Sin stock', value: resumen.agotados },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-2 text-center min-w-[84px]">
                <div className="text-xl font-semibold text-slate-100 tabular-nums">{s.value}</div>
                <div className="text-[11px] text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recordatorios */}
        <div className="mb-10">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 mb-3">Tus pendientes</h2>
          {recordatorios.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-3">
              <CheckCircle2 size={16} className="text-emerald-400" /> Todo al día. No tenés pendientes.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recordatorios.map((r, i) => {
                const Icon = r.icon;
                return (
                  <button key={i} onClick={() => onTabChange(r.tab)}
                    className={`flex items-start gap-3 text-left rounded-xl border px-4 py-3 transition-colors hover:border-slate-600 ${sevStyle(r.severidad)}`}>
                    <Icon size={18} className="text-slate-300 mt-0.5 flex-shrink-0" strokeWidth={2} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-100">{r.texto}</div>
                      {r.detalle && <div className="text-xs text-slate-500 mt-0.5">{r.detalle}</div>}
                    </div>
                    <ChevronRight size={15} className="text-slate-600 mt-0.5" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Accesos principales (5) + favoritos */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Accesos</h2>
            <button onClick={() => setShowPicker(v => !v)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400 transition-colors">
              <Plus size={14} /> Agregar módulos
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {principales.map(t => <Tile key={t.id} t={t} big />)}
            {favTiles.map(t => <Tile key={t.id} t={t} big />)}
          </div>

          {/* Picker de favoritos */}
          {showPicker && (
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-200">Elegí qué módulos sumar a tu inicio</span>
                <button onClick={() => setShowPicker(false)} className="text-slate-500 hover:text-slate-200"><X size={16} /></button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {disponibles.map(t => {
                  const activo = favoritos.includes(t.id);
                  const Icon = t.icon;
                  return (
                    <button key={t.id}
                      onClick={() => guardarFav(activo ? favoritos.filter(f => f !== t.id) : [...favoritos, t.id])}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors border ${
                        activo ? 'bg-blue-500/10 border-blue-500/40 text-blue-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}>
                      <Icon size={15} strokeWidth={2} />
                      <span className="truncate">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default InicioHome;
