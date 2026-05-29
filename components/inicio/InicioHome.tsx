'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useModulosHabilitados } from '@/hooks/useModulosHabilitados';
import { getRoutineSuggestions, getRoutineMaturity } from '@/lib/home/routine';
import type { Product, Movement, StockPrediction, TabType } from '@/types';
import {
  LayoutDashboard, Briefcase, Package, ArrowLeftRight, MessageCircle,
  DollarSign, Truck, Kanban, Warehouse, FileText, Users, Boxes, Wrench,
  Shield, ShieldAlert, RotateCcw, Brain, Zap, Sparkles, QrCode, GitBranch,
  Plug, Building2, AlertTriangle, CheckCircle2, ChevronRight, Plus, X, Sliders,
  Clock, Activity, Lightbulb, ArrowRight, ArrowUpRight, ArrowDownRight,
  type LucideIcon,
} from 'lucide-react';

// =====================================================
// Pantalla de Inicio — escritorio del sistema
// =====================================================

interface InicioHomeProps {
  user: { nombre?: string; email?: string; rol?: string } | null;
  onTabChange: (tab: TabType) => void;
  products: Product[];
  movements?: Movement[];
  predictions?: Record<string, StockPrediction>;
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

const TILE_BY_ID = new Map<string, ModuleTile>(ALL_TILES.map((t) => [t.id as string, t]));

// 5 principales por defecto.
const PRINCIPALES: TabType[] = ['dashboard', 'stock', 'movimientos', 'reportes', 'comercial'];

interface Recordatorio {
  texto: string; detalle?: string; tab: TabType;
  severidad: 'alta' | 'media' | 'info'; icon: LucideIcon;
}

function timeAgo(d: Date): string {
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.round(h / 24);
  return `hace ${days} d`;
}

export function InicioHome({ user, onTabChange, products, movements = [], predictions = {} }: InicioHomeProps) {
  const { modulos } = useModulosHabilitados();
  const [recordatoriosBackend, setRecordatoriosBackend] = useState<Recordatorio[]>([]);
  const [seleccion, setSeleccion] = useState<TabType[]>(PRINCIPALES);
  const [showPicker, setShowPicker] = useState(false);

  const userKey = user?.email || 'anon';
  const selKey = `vg:home-tiles:${userKey}`;

  // Cargar selección guardada (default = los 5 principales).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(selKey);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setSeleccion(arr);
      }
    } catch { /* noop */ }
  }, [selKey]);

  const guardarSeleccion = (next: TabType[]) => {
    setSeleccion(next);
    try { localStorage.setItem(selKey, JSON.stringify(next)); } catch { /* noop */ }
  };

  const toggleTile = (id: TabType) => {
    guardarSeleccion(seleccion.includes(id) ? seleccion.filter(x => x !== id) : [...seleccion, id]);
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

  const tiles = useMemo(
    () => seleccion
      .map(id => ALL_TILES.find(t => t.id === id))
      .filter((t): t is ModuleTile => !!t && moduloSet.has(t.id as string)),
    [seleccion, moduloSet],
  );
  const disponibles = useMemo(
    () => ALL_TILES.filter(t => moduloSet.has(t.id as string)),
    [moduloSet],
  );

  // ===== Pendientes (rule-based, parte por-usuario) =====
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

  // ===== Sugerencias según rutina (aprendizaje local) =====
  const rutina = useMemo(() => {
    const sugs = getRoutineSuggestions(userKey, { limit: 4 });
    const maturity = getRoutineMaturity(userKey);
    const items = sugs
      .map(s => ({ ...s, tile: TILE_BY_ID.get(s.tab) }))
      .filter((s): s is typeof s & { tile: ModuleTile } => !!s.tile && moduloSet.has(s.tab));
    return { items, maturity };
    // Se recalcula al montar la pantalla de inicio (cada visita).
  }, [userKey, moduloSet]);

  // ===== Insight del día (IA local sobre stock + predicciones) =====
  const insight = useMemo(() => {
    let masUrgente: { codigo: string; descripcion: string; days: number } | null = null;
    for (const p of products) {
      const pred = predictions[p.codigo];
      const d = pred?.days;
      if (d != null && Number.isFinite(d) && d >= 0) {
        if (!masUrgente || d < masUrgente.days) {
          masUrgente = { codigo: p.codigo, descripcion: p.descripcion, days: d as number };
        }
      }
    }
    return { masUrgente, agotados: resumen.agotados };
  }, [products, predictions, resumen.agotados]);

  // ===== Actividad reciente (últimos movimientos) =====
  const actividad = useMemo(() => {
    const descByCodigo = new Map(products.map(p => [p.codigo, p.descripcion]));
    return [...movements]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 6)
      .map(m => ({
        id: m.id,
        codigo: m.codigo,
        descripcion: descByCodigo.get(m.codigo) ?? m.codigo,
        tipo: m.tipo,
        cantidad: m.cantidad,
        cuando: timeAgo(new Date(m.timestamp)),
      }));
  }, [movements, products]);

  const sevStyle = (s: Recordatorio['severidad']) =>
    s === 'alta' ? 'border-red-500/30 bg-red-500/5'
    : s === 'media' ? 'border-amber-500/30 bg-amber-500/5'
    : 'border-slate-700/40 bg-slate-800/30';

  const SectionTitle = ({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) => (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{children}</h2>
      {action}
    </div>
  );

  const Tile = ({ t }: { t: ModuleTile }) => {
    const Icon = t.icon;
    return (
      <button
        onClick={() => onTabChange(t.id)}
        className="group relative flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-slate-800/60 bg-slate-900/40 px-3 py-6
          transition-all duration-200 hover:-translate-y-1 hover:border-blue-500/50 hover:bg-blue-500/[0.06]
          hover:shadow-[0_10px_30px_-8px_rgba(59,130,246,0.45)]"
      >
        <Icon size={30} strokeWidth={2} className="text-slate-300 group-hover:text-blue-400 transition-colors" />
        <span className="text-xs text-slate-300 text-center leading-tight font-medium">{t.label}</span>
      </button>
    );
  };

  const cardClass = 'rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4';

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] px-6 py-8">
      {/* Saludo — esquina superior izquierda */}
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-100">
          {saludo}{nombre ? `, ${nombre}` : ''}
        </h1>
        <p className="text-sm text-slate-500 mt-1 capitalize">{fecha}</p>
      </div>

      {/* Layout de dos columnas que llena el ancho */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ---- Columna principal ---- */}
        <div className="lg:col-span-8 space-y-8">
          {/* Pendientes */}
          <section>
            <SectionTitle>Tus pendientes</SectionTitle>
            {recordatorios.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-3">
                <CheckCircle2 size={16} className="text-emerald-400" /> Todo al día. No tenés pendientes.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          </section>

          {/* Accesos */}
          <section>
            <SectionTitle action={
              <button onClick={() => setShowPicker(v => !v)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400 transition-colors">
                <Sliders size={14} /> Personalizar
              </button>
            }>Accesos</SectionTitle>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {tiles.map(t => <Tile key={t.id} t={t} />)}
              {tiles.length === 0 && (
                <div className="col-span-full text-sm text-slate-500 py-6 text-center">
                  No tenés accesos. Tocá "Personalizar" para agregar.
                </div>
              )}
            </div>

            {showPicker && (
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-200">Elegí qué módulos ver en tu inicio (tocá para agregar o quitar)</span>
                  <button onClick={() => setShowPicker(false)} className="text-slate-500 hover:text-slate-200"><X size={16} /></button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {disponibles.map(t => {
                    const activo = seleccion.includes(t.id);
                    const Icon = t.icon;
                    return (
                      <button key={t.id} onClick={() => toggleTile(t.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors border ${
                          activo ? 'bg-blue-500/10 border-blue-500/40 text-blue-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                        }`}>
                        <Icon size={15} strokeWidth={2} />
                        <span className="truncate flex-1 text-left">{t.label}</span>
                        {activo ? <X size={13} className="opacity-70" /> : <Plus size={13} className="opacity-70" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* ---- Columna lateral: widgets que llenan el espacio ---- */}
        <aside className="lg:col-span-4 space-y-5">
          {/* Sugerencias según rutina */}
          <div className={cardClass}>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={16} className="text-blue-400" />
              <h3 className="text-sm font-semibold text-slate-100">Sugerencias para vos</h3>
            </div>
            {rutina.items.length > 0 ? (
              <div className="space-y-2">
                {rutina.items.map(({ tab, motivo, tile }) => {
                  const Icon = tile.icon;
                  return (
                    <button key={tab} onClick={() => onTabChange(tab as TabType)}
                      className="w-full flex items-center gap-3 text-left rounded-lg border border-slate-800/60 bg-slate-900/40 px-3 py-2 hover:border-blue-500/40 hover:bg-blue-500/[0.06] transition-colors">
                      <Icon size={16} className="text-slate-300 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-slate-200 truncate">{tile.label}</div>
                        <div className="text-[11px] text-slate-500">{motivo}</div>
                      </div>
                      <ArrowRight size={14} className="text-slate-600" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 leading-relaxed">
                Estoy aprendiendo tu rutina. A medida que uses el sistema, acá vas a
                ver atajos a lo que solés hacer a esta hora.
                {rutina.maturity.events > 0 && (
                  <span className="block mt-1 text-slate-600">{rutina.maturity.events} acciones registradas.</span>
                )}
              </p>
            )}
          </div>

          {/* Insight del día (IA) */}
          <div className={cardClass}>
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb size={16} className="text-amber-400" />
              <h3 className="text-sm font-semibold text-slate-100">Insight del día</h3>
            </div>
            {insight.masUrgente ? (
              <button onClick={() => onTabChange('demand')}
                className="w-full text-left rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-3 hover:border-amber-500/40 transition-colors">
                <div className="text-sm text-slate-100 font-medium truncate">{insight.masUrgente.descripcion}</div>
                <div className="text-xs text-slate-400 mt-1">
                  Se agota en ~<span className="text-amber-300 font-semibold">{insight.masUrgente.days} día{insight.masUrgente.days === 1 ? '' : 's'}</span> según la IA de demanda.
                </div>
                <div className="text-[11px] text-blue-400 mt-1.5 flex items-center gap-1">Ver Demand Planning <ArrowUpRight size={12} /></div>
              </button>
            ) : insight.agotados > 0 ? (
              <button onClick={() => onTabChange('replenishment')}
                className="w-full text-left rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-3 hover:border-red-500/40 transition-colors">
                <div className="text-sm text-slate-100 font-medium">{insight.agotados} productos sin stock</div>
                <div className="text-xs text-slate-400 mt-1">Revisá Reabastecimiento IA para optimizar la compra.</div>
              </button>
            ) : (
              <p className="text-xs text-slate-500">Sin alertas relevantes hoy. Todo bajo control.</p>
            )}
          </div>

          {/* Actividad reciente */}
          <div className={cardClass}>
            <div className="flex items-center gap-2 mb-3">
              <Activity size={16} className="text-emerald-400" />
              <h3 className="text-sm font-semibold text-slate-100">Actividad reciente</h3>
            </div>
            {actividad.length > 0 ? (
              <div className="space-y-2">
                {actividad.map((a) => {
                  const isEntrada = a.tipo === 'entrada';
                  const Arrow = isEntrada ? ArrowDownRight : ArrowUpRight;
                  return (
                    <div key={a.id} className="flex items-center gap-2.5 text-sm">
                      <Arrow size={15} className={isEntrada ? 'text-emerald-400 flex-shrink-0' : 'text-rose-400 flex-shrink-0'} />
                      <span className="text-slate-300 truncate flex-1">{a.descripcion}</span>
                      <span className="text-slate-500 tabular-nums">{isEntrada ? '+' : '−'}{a.cantidad}</span>
                      <span className="text-[11px] text-slate-600 w-16 text-right">{a.cuando}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Sin movimientos recientes.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default InicioHome;
