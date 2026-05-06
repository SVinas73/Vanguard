'use client';

import React, { useState, useEffect } from 'react';
import {
  Sun, Coffee, Target, AlertTriangle, CheckCircle, Clock,
  TrendingUp, ShoppingCart, Truck, Wrench, Package,
  Sparkles, ArrowRight, RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { cn, formatCurrency } from '@/lib/utils';
import type { TabType } from '@/types';

// =====================================================
// "MI DÍA" — Dashboard ejecutivo personal y por rol
// =====================================================
// Vista de bienvenida con SOLO lo importante de hoy para
// ese rol. Reduce fricción y sobrecarga de información.
//
// Filosofía:
//  - Saludo según hora del día.
//  - 4 a 6 tarjetas máximo, las críticas según rol.
//  - Cada tarjeta tiene un CTA claro.
//  - Si no hay nada urgente: "Día tranquilo" (mensaje
//    anti-estrés explícito).
// =====================================================

interface MiDiaProps {
  onNavigate?: (tab: TabType, subTab?: string) => void;
  onAskAI?: (prompt: string) => void;
}

interface DiaStats {
  // Para todos
  notificaciones_hoy: number;
  // Comerciales / Admin
  cotizaciones_pendientes: number;
  ventas_hoy: number;
  cxc_vencidas: number;
  cxc_total_vencido: number;
  aprobaciones_pendientes: number;
  // Bodeguero
  picking_pendiente: number;
  picking_sin_asignar: number;
  recepciones_pendientes: number;
  putaway_pendiente: number;
  // Operador taller
  ot_activas: number;
  presupuestos_esperando: number;
  // Stock global
  productos_criticos: number;
  productos_agotados: number;
}

const STATS_VACIAS: DiaStats = {
  notificaciones_hoy: 0,
  cotizaciones_pendientes: 0, ventas_hoy: 0, cxc_vencidas: 0, cxc_total_vencido: 0,
  aprobaciones_pendientes: 0,
  picking_pendiente: 0, picking_sin_asignar: 0, recepciones_pendientes: 0, putaway_pendiente: 0,
  ot_activas: 0, presupuestos_esperando: 0,
  productos_criticos: 0, productos_agotados: 0,
};

export default function MiDia({ onNavigate, onAskAI }: MiDiaProps) {
  const { user } = useAuth(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DiaStats>(STATS_VACIAS);
  const rol = (user?.rol || '').toLowerCase();
  const nombre = user?.nombre?.split(' ')[0] || 'que tal';

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      const hoyISO = hoy.toISOString();
      const ayer = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

      const queries: any[] = [];

      // Notificaciones (todos)
      queries.push(supabase.from('notificaciones')
        .select('id', { count: 'exact', head: true })
        .eq('descartada', false).gte('created_at', ayer));

      if (['admin', 'vendedor', ''].includes(rol)) {
        queries.push(
          supabase.from('cotizaciones').select('id', { count: 'exact', head: true })
            .in('estado', ['borrador', 'enviada']),
          supabase.from('ordenes_venta').select('total').gte('fecha_orden', hoyISO)
            .not('estado', 'eq', 'cancelada'),
          supabase.from('cuentas_por_cobrar')
            .select('saldo, monto').neq('estado', 'pagada')
            .lt('fecha_vencimiento', hoy.toISOString().split('T')[0]),
          supabase.from('aprobaciones').select('id', { count: 'exact', head: true })
            .eq('estado', 'pendiente'),
        );
      } else {
        queries.push(
          Promise.resolve({ count: 0 }),
          Promise.resolve({ data: [] }),
          Promise.resolve({ data: [] }),
          Promise.resolve({ count: 0 }),
        );
      }

      if (['admin', 'bodeguero'].includes(rol) || !rol) {
        queries.push(
          supabase.from('wms_ordenes_picking').select('picker_asignado, estado')
            .in('estado', ['pendiente', 'asignada', 'en_proceso']),
          supabase.from('wms_ordenes_recepcion').select('id', { count: 'exact', head: true })
            .in('estado', ['pendiente', 'en_proceso', 'parcial']),
          supabase.from('wms_tareas_putaway').select('id', { count: 'exact', head: true })
            .eq('estado', 'pendiente'),
        );
      } else {
        queries.push(
          Promise.resolve({ data: [] }),
          Promise.resolve({ count: 0 }),
          Promise.resolve({ count: 0 }),
        );
      }

      if (['admin', 'operador'].includes(rol) || !rol) {
        queries.push(
          supabase.from('ordenes_taller').select('id', { count: 'exact', head: true })
            .not('estado', 'in', '("entregado","cancelado","rechazado")'),
          supabase.from('cotizaciones_taller').select('id', { count: 'exact', head: true })
            .eq('estado', 'pendiente'),
        );
      } else {
        queries.push(Promise.resolve({ count: 0 }), Promise.resolve({ count: 0 }));
      }

      // Stock crítico (todos)
      queries.push(supabase.from('productos').select('stock, stock_minimo').is('deleted_at', null));

      const [
        notif, cotPend, ventasHoy, cxc, aprob, pickRows, recepCount, putawayCount,
        otCount, presupCount, productos,
      ] = await Promise.all(queries);

      const cxcArr = (cxc.data || []) as Array<{ saldo: number; monto: number }>;
      const totalVencido = cxcArr.reduce((s, c) => s + (parseFloat(c.saldo as any) || parseFloat(c.monto as any) || 0), 0);

      const ventasArr = (ventasHoy.data || []) as Array<{ total: number }>;
      const totalVentasHoy = ventasArr.reduce((s, v) => s + (parseFloat(v.total as any) || 0), 0);

      const pickArr = (pickRows.data || []) as Array<{ picker_asignado: string | null }>;
      const sinAsignar = pickArr.filter(p => !p.picker_asignado).length;

      const prods = (productos.data || []) as Array<{ stock: number; stock_minimo: number }>;
      const criticos = prods.filter(p => p.stock > 0 && p.stock <= p.stock_minimo).length;
      const agotados = prods.filter(p => p.stock === 0).length;

      setStats({
        notificaciones_hoy: notif.count || 0,
        cotizaciones_pendientes: cotPend.count || 0,
        ventas_hoy: totalVentasHoy,
        cxc_vencidas: cxcArr.length,
        cxc_total_vencido: totalVencido,
        aprobaciones_pendientes: aprob.count || 0,
        picking_pendiente: pickArr.length,
        picking_sin_asignar: sinAsignar,
        recepciones_pendientes: recepCount.count || 0,
        putaway_pendiente: putawayCount.count || 0,
        ot_activas: otCount.count || 0,
        presupuestos_esperando: presupCount.count || 0,
        productos_criticos: criticos,
        productos_agotados: agotados,
      });
    } finally {
      setLoading(false);
    }
  };

  const hora = new Date().getHours();
  const saludo =
    hora < 6  ? `Madrugaste, ${nombre}` :
    hora < 12 ? `Buen día, ${nombre}` :
    hora < 19 ? `Buenas tardes, ${nombre}` :
                `Buenas noches, ${nombre}`;
  const SaludoIcon = hora < 6 || hora >= 19 ? Coffee : Sun;

  // Calcular cuántas cards "urgentes" hay
  const cards = construirCards(stats, rol, onNavigate, onAskAI);
  const cardsUrgentes = cards.filter(c => c.urgente);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con saludo y botón refresh */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <SaludoIcon className="h-7 w-7 text-amber-300" />
            <h1 className="text-3xl font-bold text-slate-100">{saludo}</h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Acá está tu día — solo lo que importa.
          </p>
        </div>
        <button
          onClick={cargar}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors"
          title="Recargar"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Si no hay nada urgente: mensaje anti-estrés */}
      {cardsUrgentes.length === 0 && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 text-center">
          <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-100">
            Día tranquilo · todo bajo control
          </h3>
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
            No hay alertas críticas, vencimientos ni tareas urgentes. Buen momento para
            trabajar en proyectos largos o tomarte un café.
          </p>
        </div>
      )}

      {/* Grid de cards */}
      {cards.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c, i) => (
            <DiaCard key={i} card={c} />
          ))}
        </div>
      )}

      {/* Sugerencias de IA */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-slate-200">Pregúntale a la IA</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {sugerenciasIA(rol).map((s, i) => (
            <button
              key={i}
              onClick={() => onAskAI?.(s)}
              className="px-3 py-1.5 rounded-full bg-slate-800/50 hover:bg-purple-500/15 hover:border-purple-500/30 border border-slate-700 text-slate-300 hover:text-purple-300 text-xs transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// CARDS según rol
// =====================================================

interface CardData {
  titulo: string;
  valor: string;
  detalle: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  urgente: boolean;
  cta?: { label: string; onClick: () => void };
}

function construirCards(
  stats: DiaStats, rol: string,
  onNavigate?: (tab: TabType, subTab?: string) => void,
  onAskAI?: (prompt: string) => void
): CardData[] {
  const cards: CardData[] = [];
  const nav = (tab: TabType, sub?: string) => () => onNavigate?.(tab, sub);

  // Aprobaciones (admin)
  if (rol === 'admin' && stats.aprobaciones_pendientes > 0) {
    cards.push({
      titulo: 'Aprobaciones pendientes',
      valor: String(stats.aprobaciones_pendientes),
      detalle: 'NC/ND, comisiones, ajustes esperando tu firma',
      icon: AlertTriangle, color: 'text-violet-300', bg: 'bg-violet-500/10 border-violet-500/30',
      urgente: true,
      cta: { label: 'Ir al inbox', onClick: nav('aprobaciones') },
    });
  }

  // CxC vencidas (admin/vendedor)
  if (['admin', 'vendedor'].includes(rol) && stats.cxc_vencidas > 0) {
    cards.push({
      titulo: 'Cuentas por cobrar vencidas',
      valor: String(stats.cxc_vencidas),
      detalle: `${formatCurrency(stats.cxc_total_vencido)} adeudado`,
      icon: AlertTriangle, color: 'text-red-300', bg: 'bg-red-500/10 border-red-500/30',
      urgente: stats.cxc_vencidas > 5,
      cta: { label: 'Ver detalle', onClick: nav('comercial', 'finanzas') },
    });
  }

  // Cotizaciones pendientes (vendedor/admin)
  if (['admin', 'vendedor'].includes(rol) && stats.cotizaciones_pendientes > 0) {
    cards.push({
      titulo: 'Cotizaciones pendientes',
      valor: String(stats.cotizaciones_pendientes),
      detalle: 'Esperando respuesta del cliente',
      icon: Target, color: 'text-blue-300', bg: 'bg-blue-500/10 border-blue-500/30',
      urgente: false,
      cta: { label: 'Ir a Ventas', onClick: nav('comercial', 'ventas') },
    });
  }

  // Ventas hoy (admin/vendedor)
  if (['admin', 'vendedor'].includes(rol)) {
    cards.push({
      titulo: 'Ventas de hoy',
      valor: formatCurrency(stats.ventas_hoy),
      detalle: 'Total facturado',
      icon: TrendingUp, color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/30',
      urgente: false,
      cta: stats.ventas_hoy > 0 ? { label: 'Detalle', onClick: nav('comercial', 'ventas') } : undefined,
    });
  }

  // Picking sin asignar (bodeguero/admin)
  if (['admin', 'bodeguero'].includes(rol) && stats.picking_sin_asignar > 0) {
    cards.push({
      titulo: 'Picking sin asignar',
      valor: String(stats.picking_sin_asignar),
      detalle: `de ${stats.picking_pendiente} pendientes`,
      icon: Target, color: 'text-purple-300', bg: 'bg-purple-500/10 border-purple-500/30',
      urgente: stats.picking_sin_asignar > 0,
      cta: { label: 'Asignar pickers', onClick: nav('wms') },
    });
  }

  // Recepciones (bodeguero/admin)
  if (['admin', 'bodeguero'].includes(rol) && stats.recepciones_pendientes > 0) {
    cards.push({
      titulo: 'Recepciones pendientes',
      valor: String(stats.recepciones_pendientes),
      detalle: 'Mercadería esperando confirmación',
      icon: Truck, color: 'text-amber-300', bg: 'bg-amber-500/10 border-amber-500/30',
      urgente: false,
      cta: { label: 'Ir a Recepción', onClick: nav('wms') },
    });
  }

  // Putaway (bodeguero/admin)
  if (['admin', 'bodeguero'].includes(rol) && stats.putaway_pendiente > 0) {
    cards.push({
      titulo: 'Putaway pendiente',
      valor: String(stats.putaway_pendiente),
      detalle: 'Tareas para acomodar mercadería',
      icon: Package, color: 'text-cyan-300', bg: 'bg-cyan-500/10 border-cyan-500/30',
      urgente: stats.putaway_pendiente > 10,
      cta: { label: 'Ver tareas', onClick: nav('wms') },
    });
  }

  // OT taller (operador/admin)
  if (['admin', 'operador'].includes(rol) && stats.ot_activas > 0) {
    cards.push({
      titulo: 'Órdenes de Trabajo activas',
      valor: String(stats.ot_activas),
      detalle: 'En diagnóstico, reparación o entrega',
      icon: Wrench, color: 'text-orange-300', bg: 'bg-orange-500/10 border-orange-500/30',
      urgente: false,
      cta: { label: 'Ir al taller', onClick: nav('taller') },
    });
  }

  // Presupuestos esperando (operador/admin)
  if (['admin', 'operador'].includes(rol) && stats.presupuestos_esperando > 0) {
    cards.push({
      titulo: 'Presupuestos esperando aprobación',
      valor: String(stats.presupuestos_esperando),
      detalle: 'El cliente todavía no respondió',
      icon: Clock, color: 'text-amber-300', bg: 'bg-amber-500/10 border-amber-500/30',
      urgente: false,
      cta: { label: 'Ir al taller', onClick: nav('taller') },
    });
  }

  // Stock crítico (todos)
  if (stats.productos_agotados > 0 || stats.productos_criticos > 0) {
    const valor = stats.productos_agotados > 0
      ? `${stats.productos_agotados} agotados`
      : `${stats.productos_criticos} críticos`;
    cards.push({
      titulo: 'Stock crítico',
      valor,
      detalle: stats.productos_criticos > 0 && stats.productos_agotados > 0
        ? `+ ${stats.productos_criticos} críticos`
        : 'Productos bajo el mínimo',
      icon: AlertTriangle, color: 'text-red-300', bg: 'bg-red-500/10 border-red-500/30',
      urgente: stats.productos_agotados > 0,
      cta: { label: 'Ver productos', onClick: nav('stock') },
    });
  }

  // Notificaciones (todos)
  if (stats.notificaciones_hoy > 0) {
    cards.push({
      titulo: 'Notificaciones del día',
      valor: String(stats.notificaciones_hoy),
      detalle: 'Eventos recientes en el sistema',
      icon: AlertTriangle, color: 'text-blue-300', bg: 'bg-blue-500/10 border-blue-500/30',
      urgente: false,
      cta: { label: 'Pregúntale a la IA', onClick: () => onAskAI?.('¿Qué notificaciones tengo activas hoy?') },
    });
  }

  return cards;
}

function sugerenciasIA(rol: string): string[] {
  if (rol === 'admin') {
    return [
      'Resumen ejecutivo de hoy',
      '¿Qué CxC venció esta semana?',
      'Top 5 clientes del mes',
      '¿Qué aprobaciones tengo pendientes?',
      'Productos que están creciendo en ventas',
    ];
  }
  if (rol === 'vendedor') {
    return [
      'Mis cotizaciones pendientes',
      'Top clientes del mes',
      '¿Cómo creo una cotización paso a paso?',
      'Productos para ofrecer (alta rotación)',
    ];
  }
  if (rol === 'bodeguero') {
    return [
      '¿Qué picking tengo sin asignar?',
      'Recepciones pendientes',
      'Putaway por hacer',
      '¿Cómo recibo una OC paso a paso?',
    ];
  }
  if (rol === 'operador') {
    return [
      'Mis OT activas',
      'Presupuestos esperando aprobación',
      '¿Cómo abro una OT paso a paso?',
    ];
  }
  return [
    '¿Cómo está el inventario?',
    'Resumen ejecutivo de hoy',
    '¿Qué productos están críticos?',
  ];
}

// =====================================================
// CARD componente
// =====================================================

function DiaCard({ card }: { card: CardData }) {
  const Icon = card.icon;
  return (
    <div className={cn('rounded-2xl border p-4 transition-all hover:scale-[1.01]', card.bg)}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={cn('p-1.5 rounded-lg bg-slate-900/50')}>
            <Icon className={cn('h-4 w-4', card.color)} />
          </div>
          <span className="text-xs uppercase tracking-wider text-slate-400">
            {card.titulo}
          </span>
        </div>
        {card.urgente && (
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-bold">
            Urgente
          </span>
        )}
      </div>

      <div className={cn('text-2xl font-bold', card.color)}>
        {card.valor}
      </div>
      <div className="text-xs text-slate-500 mt-0.5">
        {card.detalle}
      </div>

      {card.cta && (
        <button
          onClick={card.cta.onClick}
          className="mt-3 w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-slate-900/50 hover:bg-slate-800 text-slate-300 hover:text-slate-100 text-xs transition-colors"
        >
          <span>{card.cta.label}</span>
          <ArrowRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
