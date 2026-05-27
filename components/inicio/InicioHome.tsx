'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useModulosHabilitados } from '@/hooks/useModulosHabilitados';
import type { Product, TabType } from '@/types';
import {
  LayoutDashboard, Briefcase, Package, ArrowLeftRight, MessageCircle,
  DollarSign, Truck, Kanban, Warehouse, FileText, Users, Boxes, Wrench,
  Shield, ShieldAlert, RotateCcw, Brain, Zap, Sparkles, QrCode, GitBranch,
  Plug, Building2, AlertTriangle, CheckCircle2, ChevronRight,
  type LucideIcon,
} from 'lucide-react';

// =====================================================
// Pantalla de Inicio — escritorio del sistema
// =====================================================
// - Saludo personalizado por hora + usuario.
// - Recordatorios inteligentes: tareas pendientes del usuario
//   calculadas de los datos reales (stock crítico, aprobaciones,
//   solicitudes de insumo asignadas, cuentas vencidas).
// - Grilla de íconos de módulos (solo los habilitados).
// - Escudo Vanguard muy tenue de fondo.
// =====================================================

interface InicioHomeProps {
  user: { nombre?: string; email?: string; rol?: string } | null;
  onTabChange: (tab: TabType) => void;
  products: Product[];
}

interface ModuleTile {
  id: TabType;
  label: string;
  icon: LucideIcon;
}

// Catálogo de módulos para la grilla (espejo del sidebar).
const ALL_TILES: ModuleTile[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'executive', label: 'Vista Ejecutiva', icon: Briefcase },
  { id: 'stock', label: 'Stock', icon: Package },
  { id: 'movimientos', label: 'Movimientos', icon: ArrowLeftRight },
  { id: 'chat', label: 'Mensajes', icon: MessageCircle },
  { id: 'comercial', label: 'Comercial', icon: DollarSign },
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
  { id: 'reportes', label: 'Reportes', icon: FileText },
  { id: 'aprobaciones', label: 'Aprobaciones', icon: Shield },
  { id: 'seriales', label: 'Seriales', icon: QrCode },
  { id: 'trazabilidad', label: 'Trazabilidad', icon: GitBranch },
  { id: 'qms', label: 'Calidad', icon: Shield },
  { id: 'auditoria', label: 'Auditoría', icon: Shield },
  { id: 'integraciones', label: 'Integraciones', icon: Plug },
  { id: 'configuracion', label: 'Configuración', icon: Sparkles },
  { id: 'empresas', label: 'Mis empresas', icon: Building2 },
];

interface Recordatorio {
  texto: string;
  detalle?: string;
  tab: TabType;
  severidad: 'alta' | 'media' | 'info';
  icon: LucideIcon;
}

export function InicioHome({ user, onTabChange, products }: InicioHomeProps) {
  const { modulos } = useModulosHabilitados();
  const [recordatoriosBackend, setRecordatoriosBackend] = useState<Recordatorio[]>([]);

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

  // Recordatorios locales (de los datos ya cargados): stock crítico.
  const recordatoriosLocales = useMemo<Recordatorio[]>(() => {
    const out: Recordatorio[] = [];
    const criticos = products.filter(p => p.stock <= p.stockMinimo);
    const agotados = products.filter(p => p.stock === 0);
    if (agotados.length > 0) {
      out.push({
        texto: `${agotados.length} producto${agotados.length === 1 ? '' : 's'} sin stock`,
        detalle: 'Requieren reposición urgente',
        tab: 'stock',
        severidad: 'alta',
        icon: AlertTriangle,
      });
    }
    const bajos = criticos.length - agotados.length;
    if (bajos > 0) {
      out.push({
        texto: `${bajos} producto${bajos === 1 ? '' : 's'} con stock bajo`,
        detalle: 'Por debajo del mínimo',
        tab: 'replenishment',
        severidad: 'media',
        icon: Package,
      });
    }
    return out;
  }, [products]);

  // Recordatorios del backend: aprobaciones pendientes + solicitudes de
  // insumo asignadas a este usuario + cuentas por cobrar vencidas.
  // Cada query va en try/catch: si una tabla no existe, no rompe el resto.
  useEffect(() => {
    let cancelled = false;
    const email = user?.email;
    if (!email) return;

    (async () => {
      const out: Recordatorio[] = [];

      try {
        const { count } = await supabase
          .from('aprobaciones')
          .select('id', { count: 'exact', head: true })
          .eq('estado', 'pendiente');
        if (count && count > 0) {
          out.push({
            texto: `${count} aprobación${count === 1 ? '' : 'es'} pendiente${count === 1 ? '' : 's'}`,
            detalle: 'Esperando tu decisión',
            tab: 'aprobaciones',
            severidad: 'alta',
            icon: Shield,
          });
        }
      } catch { /* tabla ausente */ }

      try {
        const { data } = await supabase
          .from('solicitudes_insumos')
          .select('id, estado')
          .eq('gestor_asignado', email)
          .in('estado', ['pendiente', 'en_gestion', 'comprada']);
        if (data && data.length > 0) {
          out.push({
            texto: `${data.length} solicitud${data.length === 1 ? '' : 'es'} de insumo a tu cargo`,
            detalle: 'Tenés que gestionarlas',
            tab: 'comercial',
            severidad: 'media',
            icon: Truck,
          });
        }
      } catch { /* tabla ausente */ }

      try {
        const hoy = new Date().toISOString().split('T')[0];
        const { count } = await supabase
          .from('cuentas_por_cobrar')
          .select('id', { count: 'exact', head: true })
          .eq('estado', 'pendiente')
          .lt('fecha_vencimiento', hoy);
        if (count && count > 0) {
          out.push({
            texto: `${count} cuenta${count === 1 ? '' : 's'} por cobrar vencida${count === 1 ? '' : 's'}`,
            detalle: 'Gestión de cobranza',
            tab: 'comercial',
            severidad: 'alta',
            icon: DollarSign,
          });
        }
      } catch { /* tabla ausente */ }

      if (!cancelled) setRecordatoriosBackend(out);
    })();

    return () => { cancelled = true; };
  }, [user?.email]);

  const recordatorios = useMemo(
    () => [...recordatoriosLocales, ...recordatoriosBackend],
    [recordatoriosLocales, recordatoriosBackend],
  );

  // Tiles visibles: solo módulos habilitados, sin la propia pantalla de inicio.
  const tiles = useMemo(() => {
    const set = new Set<string>(modulos);
    return ALL_TILES.filter(t => set.has(t.id as string));
  }, [modulos]);

  const sevStyle = (s: Recordatorio['severidad']) =>
    s === 'alta'  ? 'border-red-500/30 bg-red-500/5'
    : s === 'media' ? 'border-amber-500/30 bg-amber-500/5'
    : 'border-slate-700/40 bg-slate-800/30';

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] px-6 py-10 overflow-hidden">
      <div className="relative max-w-5xl mx-auto">
        {/* Saludo */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-100">
            {saludo}{nombre ? `, ${nombre}` : ''}
          </h1>
          <p className="text-sm text-slate-500 mt-1 capitalize">{fecha}</p>
        </div>

        {/* Recordatorios */}
        <div className="mb-10">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 mb-3">
            Tus pendientes
          </h2>
          {recordatorios.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-3">
              <CheckCircle2 size={16} className="text-emerald-400" />
              Todo al día. No tenés pendientes.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recordatorios.map((r, i) => {
                const Icon = r.icon;
                return (
                  <button
                    key={i}
                    onClick={() => onTabChange(r.tab)}
                    className={`flex items-start gap-3 text-left rounded-xl border px-4 py-3 transition-colors hover:border-slate-600 ${sevStyle(r.severidad)}`}
                  >
                    <Icon size={18} className="text-slate-300 mt-0.5 flex-shrink-0" />
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

        {/* Grilla de módulos */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 mb-3">
            Módulos
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {tiles.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => onTabChange(t.id)}
                  className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-800/60 bg-slate-900/40 px-3 py-5 transition-colors hover:border-blue-500/40 hover:bg-blue-500/5"
                >
                  <Icon size={26} className="text-slate-400 group-hover:text-blue-400 transition-colors" strokeWidth={1.75} />
                  <span className="text-xs text-slate-300 text-center leading-tight">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default InicioHome;
