'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshCw, ShoppingCart, TrendingDown, AlertTriangle, CheckCircle2,
  Sparkles, Info, Truck, Wallet, ChevronRight, Package,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import {
  optimizarReabastecimiento,
  type Sugerencia,
  type ProductoStock,
  type MovimientoSalida,
} from '@/lib/replenishment/optimizer';

// =====================================================
// Reabastecimiento IA — UI
// =====================================================
// Foco: optimizar capital de trabajo. NO comprar de más.
// Detecta sobre-stock, stock muerto y compras necesarias.
// =====================================================

type Filtro = 'todos' | 'comprar' | 'reducir' | 'criticas';

const fmtMoney = (v: number, compact = false) => {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (compact && abs >= 1000) {
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    return `${sign}$${(abs / 1000).toFixed(1)}k`;
  }
  return `${sign}$${abs.toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

export function ReplenishmentDashboard() {
  const { t } = useTranslation();
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [search, setSearch] = useState('');
  const [seleccionada, setSeleccionada] = useState<Sugerencia | null>(null);
  const [resumen, setResumen] = useState({
    capitalTotal: 0,
    capitalOptimo: 0,
    capitalLiberable: 0,
    inversionRequerida: 0,
    criticas: 0,
    sobreStock: 0,
  });

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setLoading(true);
    const hace365 = new Date();
    hace365.setFullYear(hace365.getFullYear() - 1);

    const [resProd, resMovs] = await Promise.all([
      supabase
        .from('productos')
        .select('codigo, descripcion, stock, costo_promedio, precio, categoria')
        .gt('stock', -1)
        .limit(2000),
      supabase
        .from('movimientos')
        .select('producto_codigo, cantidad, fecha, tipo')
        .gte('fecha', hace365.toISOString())
        .in('tipo', ['salida', 'venta'])
        .limit(20000),
    ]);

    const productos: ProductoStock[] = (resProd.data || []).map((p: any) => ({
      codigo: p.codigo,
      nombre: p.descripcion || p.codigo,
      stock_actual: Number(p.stock) || 0,
      stock_en_transito: 0, // TODO: leer de órdenes de compra abiertas
      costo_promedio: Number(p.costo_promedio) || 0,
      precio_venta: Number(p.precio) || 0,
      categoria: p.categoria,
    }));

    const movimientos: MovimientoSalida[] = (resMovs.data || []).map((m: any) => ({
      producto_codigo: m.producto_codigo,
      cantidad: Number(m.cantidad) || 0,
      fecha: m.fecha,
    }));

    const sugs = optimizarReabastecimiento(productos, movimientos);
    setSugerencias(sugs);

    const capitalTotal = sugs.reduce((s, r) => s + r.capital_inmovilizado_actual, 0);
    const capitalOptimo = sugs.reduce((s, r) => s + r.capital_inmovilizado_optimo, 0);
    const capitalLiberable = sugs.reduce((s, r) => s + r.capital_liberable, 0);
    const inversionRequerida = sugs
      .filter(r => r.tipo === 'comprar')
      .reduce((s, r) => s + Math.max(0, r.costo_accion), 0);
    const criticas = sugs.filter(r => r.urgencia === 'critica').length;
    const sobreStock = sugs.filter(r => r.tipo === 'reducir').length;

    setResumen({ capitalTotal, capitalOptimo, capitalLiberable, inversionRequerida, criticas, sobreStock });
    setLoading(false);
  }

  const filtradas = useMemo(() => {
    let xs = sugerencias;
    if (filtro === 'comprar') xs = xs.filter(r => r.tipo === 'comprar');
    else if (filtro === 'reducir') xs = xs.filter(r => r.tipo === 'reducir');
    else if (filtro === 'criticas') xs = xs.filter(r => r.urgencia === 'critica');
    if (search.trim()) {
      const q = search.toLowerCase();
      xs = xs.filter(r => r.nombre.toLowerCase().includes(q) || r.codigo.toLowerCase().includes(q));
    }
    // Ocultar "mantener" para no inundar
    return xs.filter(r => r.tipo !== 'mantener');
  }, [sugerencias, filtro, search]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100 tracking-tight flex items-center gap-2">
            <Sparkles size={16} className="text-amber-400" />
            {t('replenishment.title') || 'Reabastecimiento IA'}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">{t('replenishment.subtitle') || 'EOQ + punto de reorden conservador · optimiza capital, evita sobre-stock'}</p>
        </div>
        <button
          onClick={cargar}
          className="p-1.5 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-md hover:bg-slate-900"
          title={t('replenishment.reload') || 'Recalcular'}
        >
          <RefreshCw size={13} className={cn(loading && 'animate-spin')} />
        </button>
      </div>

      {/* Stats grandes — foco capital */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
          <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500 mb-2 flex items-center gap-1">
            <Wallet size={11} />
            {t('replenishment.capitalTied') || 'Capital inmovilizado'}
          </div>
          <div className="text-3xl font-semibold text-slate-50 tabular-nums tracking-tight">
            {loading ? '…' : fmtMoney(resumen.capitalTotal, true)}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">{t('replenishment.capitalTiedHint') || 'Plata atrapada en stock hoy'}</p>
        </div>
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5">
          <div className="text-[11px] uppercase tracking-[0.08em] text-emerald-400 mb-2 flex items-center gap-1">
            <TrendingDown size={11} />
            {t('replenishment.capitalRecoverable') || 'Capital recuperable'}
          </div>
          <div className="text-3xl font-semibold text-emerald-300 tabular-nums tracking-tight">
            {loading ? '…' : fmtMoney(resumen.capitalLiberable, true)}
          </div>
          <p className="text-[11px] text-emerald-400/70 mt-2">{t('replenishment.capitalRecoverableHint') || 'Liberable si bajás sobre-stock'}</p>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
          <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500 mb-2 flex items-center gap-1">
            <ShoppingCart size={11} />
            {t('replenishment.investmentNeeded') || 'Compras necesarias'}
          </div>
          <div className="text-3xl font-semibold text-slate-50 tabular-nums tracking-tight">
            {loading ? '…' : fmtMoney(resumen.inversionRequerida, true)}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">{t('replenishment.investmentNeededHint') || 'Solo lo estrictamente necesario'}</p>
        </div>
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5">
          <div className="text-[11px] uppercase tracking-[0.08em] text-red-400 mb-2 flex items-center gap-1">
            <AlertTriangle size={11} />
            {t('replenishment.critical') || 'Críticas'}
          </div>
          <div className="text-3xl font-semibold text-red-300 tabular-nums tracking-tight">
            {loading ? '…' : resumen.criticas}
          </div>
          <p className="text-[11px] text-red-400/70 mt-2">{t('replenishment.criticalHint') || 'Necesitan compra YA'}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-slate-900/60 border border-slate-800 rounded-md p-0.5">
          {([
            ['todos', t('common.all') || 'Todas'],
            ['comprar', t('replenishment.toBuy') || 'Comprar'],
            ['reducir', t('replenishment.toReduce') || 'Reducir'],
            ['criticas', t('replenishment.critical') || 'Críticas'],
          ] as [Filtro, string][]).map(([f, label]) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={cn(
                'px-2.5 py-1 text-[12px] font-medium rounded-sm transition-colors',
                filtro === f ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('replenishment.searchPlaceholder') || 'Buscar producto…'}
          className="flex-1 max-w-xs bg-slate-900 border border-slate-800 rounded-md px-3 py-1.5 text-[12px] text-slate-100 focus:outline-none focus:border-slate-600"
        />
      </div>

      {/* Tabla */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500 text-[13px]">
            <RefreshCw className="inline-block animate-spin mr-2" size={14} />
            {t('replenishment.computing') || 'Optimizando reabastecimiento…'}
          </div>
        ) : filtradas.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-[13px]">
            {t('replenishment.allHealthy') || '✓ Todos los productos están en zona óptima'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800 bg-slate-950/60">
                  <th className="text-left font-medium py-2.5 px-4">Producto</th>
                  <th className="text-right font-medium py-2.5 px-2">Stock</th>
                  <th className="text-right font-medium py-2.5 px-2">Cobertura</th>
                  <th className="text-right font-medium py-2.5 px-2">Acción</th>
                  <th className="text-right font-medium py-2.5 px-2">Capital</th>
                  <th className="text-center font-medium py-2.5 px-2">Urgencia</th>
                  <th className="text-center font-medium py-2.5 px-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.slice(0, 50).map(r => (
                  <tr
                    key={r.codigo}
                    onClick={() => setSeleccionada(r)}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <TipoIcon tipo={r.tipo} />
                        <div>
                          <p className="text-slate-100">{r.nombre}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{r.codigo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-right tabular-nums text-slate-300 px-2">{r.stock_actual}</td>
                    <td className="text-right tabular-nums text-slate-400 px-2">
                      {r.dias_de_cobertura < 0 ? '∞' : `${r.dias_de_cobertura.toFixed(0)}d`}
                    </td>
                    <td className="text-right px-2">
                      {r.cantidad_sugerida === 0 ? (
                        <span className="text-slate-500">—</span>
                      ) : r.cantidad_sugerida > 0 ? (
                        <span className="text-emerald-300 font-semibold tabular-nums">+{r.cantidad_sugerida}</span>
                      ) : (
                        <span className="text-amber-300 font-semibold tabular-nums">{r.cantidad_sugerida}</span>
                      )}
                    </td>
                    <td className="text-right tabular-nums px-2">
                      <span className={cn(
                        r.tipo === 'reducir' ? 'text-emerald-300' : 'text-slate-300'
                      )}>
                        {r.tipo === 'reducir' ? `+${fmtMoney(r.capital_liberable, true)}` : fmtMoney(r.costo_accion, true)}
                      </span>
                    </td>
                    <td className="text-center px-2">
                      <UrgenciaBadge u={r.urgencia} />
                    </td>
                    <td className="text-center px-2 text-slate-500">
                      <ChevronRight size={13} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtradas.length > 50 && (
              <div className="text-center text-[11px] text-slate-500 py-2 border-t border-slate-800">
                Mostrando 50 de {filtradas.length} · refiná los filtros para ver más
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de detalle */}
      {seleccionada && (
        <DetalleSugerencia s={seleccionada} onClose={() => setSeleccionada(null)} />
      )}

      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2">
        <span className="flex items-center gap-1.5">
          <Info size={11} />
          {t('replenishment.methodFooter') || 'Modelo: EOQ + ROP con service level 90% · pondera capital de trabajo sobre stockout'}
        </span>
        <span>{t('replenishment.note') || 'Las sugerencias requieren confirmación manual antes de generar OC.'}</span>
      </div>
    </div>
  );
}

function TipoIcon({ tipo }: { tipo: 'comprar' | 'reducir' | 'mantener' }) {
  if (tipo === 'comprar') return <ShoppingCart size={13} className="text-emerald-400 shrink-0" />;
  if (tipo === 'reducir') return <TrendingDown size={13} className="text-amber-400 shrink-0" />;
  return <Package size={13} className="text-slate-500 shrink-0" />;
}

function UrgenciaBadge({ u }: { u: 'critica' | 'alta' | 'media' | 'baja' }) {
  const colors = {
    critica: 'bg-red-500/10 text-red-300 border-red-500/20',
    alta: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    media: 'bg-slate-700/30 text-slate-300 border-slate-700',
    baja: 'bg-slate-800/30 text-slate-500 border-slate-800',
  };
  const labels = { critica: 'Crítica', alta: 'Alta', media: 'Media', baja: 'Baja' };
  return (
    <span className={cn('inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border', colors[u])}>
      {labels[u]}
    </span>
  );
}

function DetalleSugerencia({ s, onClose }: { s: Sugerencia; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-lg w-full max-w-xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
          <div>
            <h2 className="text-[14px] font-semibold text-slate-100">{s.nombre}</h2>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">{s.codigo}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Resumen acción */}
          <div className={cn(
            'border rounded-md p-4',
            s.tipo === 'comprar' && 'bg-emerald-500/5 border-emerald-500/20',
            s.tipo === 'reducir' && 'bg-amber-500/5 border-amber-500/20',
            s.tipo === 'mantener' && 'bg-slate-900/50 border-slate-800'
          )}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TipoIcon tipo={s.tipo} />
                <span className="text-[13px] font-semibold capitalize text-slate-100">{s.tipo}</span>
                <UrgenciaBadge u={s.urgencia} />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500">
                Confianza: <span className="capitalize">{s.confianza}</span>
              </span>
            </div>
            <p className="text-[13px] text-slate-200">{s.razon}</p>
            {s.cantidad_sugerida !== 0 && (
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums text-slate-50">
                  {s.cantidad_sugerida > 0 ? '+' : ''}{s.cantidad_sugerida}
                </span>
                <span className="text-[12px] text-slate-400">unidades</span>
                <span className="text-[12px] text-slate-500 ml-2">
                  ({s.cantidad_sugerida > 0 ? 'invertir' : 'liberar'} {fmtMoney(Math.abs(s.costo_accion), true)})
                </span>
              </div>
            )}
          </div>

          {/* Capital */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-900/50 border border-slate-800 rounded-md p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Capital actual</p>
              <p className="text-[14px] font-semibold tabular-nums text-slate-200">{fmtMoney(s.capital_inmovilizado_actual)}</p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-md p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Capital óptimo</p>
              <p className="text-[14px] font-semibold tabular-nums text-slate-200">{fmtMoney(s.capital_inmovilizado_optimo)}</p>
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-md p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-emerald-400 mb-1">Liberable</p>
              <p className="text-[14px] font-semibold tabular-nums text-emerald-300">{fmtMoney(s.capital_liberable)}</p>
            </div>
          </div>

          {/* Detalle modelo */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-md p-3 text-[11px] space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">Parámetros del modelo</p>
            <Row label="Demanda diaria" value={`${s.demanda_diaria_promedio.toFixed(2)} ± ${s.desvio_diario.toFixed(2)}`} />
            <Row label="Lead time" value={`${s.lead_time_dias} días`} />
            <Row label="Punto de reorden (ROP)" value={`${s.punto_reorden} unidades`} />
            <Row label="Stock de seguridad" value={`${s.stock_seguridad} unidades`} />
            <Row label="Cantidad óptima de compra (EOQ)" value={`${s.cantidad_optima_compra} unidades`} />
            <Row label="Datos usados" value={`${s.datos_usados.ventas_90d} ventas en ${s.datos_usados.dias_con_movimiento} días`} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 tabular-nums">{value}</span>
    </div>
  );
}

export default ReplenishmentDashboard;
