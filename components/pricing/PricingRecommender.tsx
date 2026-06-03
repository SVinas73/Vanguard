'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp, TrendingDown, Minus, RefreshCw, Sparkles, Info,
  CheckCircle2, AlertCircle, ChevronRight, BarChart3,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useAlmacenes } from '@/hooks/useAlmacenes';
import { AlmacenSelector } from '@/components/common/AlmacenSelector';
import {
  recomendarPrecios,
  type Recomendacion,
  type VentaItem,
  type ProductoInput,
} from '@/lib/pricing/recommender';

// =====================================================
// Recomendador de Precios — UI
// =====================================================
// Carga productos + ventas históricas, calcula recomendaciones
// vía elasticidad (ML aplicado), muestra las oportunidades
// más grandes con confianza + razón explicable.
// =====================================================

type Filtro = 'todos' | 'subir' | 'bajar' | 'alta_conf';

const fmtMoney = (v: number, compact = false) => {
  if (compact && Math.abs(v) >= 1000) {
    if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    return `$${(v / 1000).toFixed(1)}k`;
  }
  return `$${v.toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

export function PricingRecommender() {
  const { t } = useTranslation();
  const { almacenes, almacenId, setAlmacenId, filtrarPorAlmacen } = useAlmacenes({ soloVenta: true });
  const [recomendaciones, setRecomendaciones] = useState<Recomendacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [search, setSearch] = useState('');
  const [seleccionada, setSeleccionada] = useState<Recomendacion | null>(null);
  const [stats, setStats] = useState<{ totalImpacto: number; oportunidades: number; analizados: number }>({
    totalImpacto: 0, oportunidades: 0, analizados: 0,
  });

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [almacenId]);

  async function cargar() {
    setLoading(true);
    // Cargar productos + ítems de venta del último año
    const haceUnAno = new Date();
    haceUnAno.setFullYear(haceUnAno.getFullYear() - 1);

    const [resProd, resItems] = await Promise.all([
      supabase.from('productos').select('codigo, descripcion, precio, costo_promedio, categoria, stock, almacen_id').not('codigo', 'is', null),
      supabase
        .from('ordenes_venta_items')
        .select('producto_codigo, cantidad, precio_unitario, costo_unitario, ordenes_venta(fecha_orden, estado)')
        .limit(5000),
    ]);

    const productosRaw = filtrarPorAlmacen(resProd.data || []);
    const itemsRaw = resItems.data || [];

    const productos: ProductoInput[] = productosRaw.map((p: any) => ({
      codigo: p.codigo,
      nombre: p.descripcion || p.codigo,
      precio_actual: Number(p.precio) || 0,
      costo_promedio: Number(p.costo_promedio) || 0,
      categoria: p.categoria,
      stock_actual: Number(p.stock) || 0,
    })).filter(p => p.precio_actual > 0);

    const ventas: VentaItem[] = itemsRaw
      .filter((it: any) => it.ordenes_venta?.estado !== 'cancelada')
      .map((it: any) => ({
        producto_codigo: it.producto_codigo,
        cantidad: Number(it.cantidad) || 0,
        precio_unitario: Number(it.precio_unitario) || 0,
        costo_unitario: Number(it.costo_unitario) || null,
        fecha: it.ordenes_venta?.fecha_orden || null,
      }));

    const recs = recomendarPrecios(productos, ventas);
    setRecomendaciones(recs);

    const oportunidades = recs.filter(r => r.oportunidad !== 'mantener').length;
    const totalImpacto = recs.reduce((s, r) => s + Math.max(0, r.impacto_margen_anual), 0);
    setStats({ totalImpacto, oportunidades, analizados: recs.length });
    setLoading(false);
  }

  const filtradas = useMemo(() => {
    let xs = recomendaciones;
    if (filtro === 'subir') xs = xs.filter(r => r.oportunidad === 'subir');
    else if (filtro === 'bajar') xs = xs.filter(r => r.oportunidad === 'bajar');
    else if (filtro === 'alta_conf') xs = xs.filter(r => r.confianza === 'alta');
    if (search.trim()) {
      const q = search.toLowerCase();
      xs = xs.filter(r => r.nombre.toLowerCase().includes(q) || r.codigo.toLowerCase().includes(q));
    }
    return xs;
  }, [recomendaciones, filtro, search]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100 tracking-tight flex items-center gap-2">
            <Sparkles size={16} className="text-slate-300" />
            {t('pricing.title') || 'Recomendador de Precios'}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">{t('pricing.subtitle') || 'ML aplicado: elasticidad de demanda + precio óptimo por producto'}</p>
        </div>
        <div className="flex items-center gap-2">
          <AlmacenSelector almacenes={almacenes} value={almacenId} onChange={setAlmacenId} />
          <button
            onClick={cargar}
            className="p-1.5 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-md hover:bg-slate-900"
            title={t('pricing.reload') || 'Recalcular'}
          >
            <RefreshCw size={13} className={cn(loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Stats grandes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
          <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500 mb-2">{t('pricing.totalImpact') || 'Impacto anual estimado'}</div>
          <div className="text-3xl font-semibold text-slate-300 tabular-nums tracking-tight">
            {loading ? '…' : fmtMoney(stats.totalImpacto, true)}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">{t('pricing.totalImpactHint') || 'Si aplicás todas las recomendaciones positivas'}</p>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
          <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500 mb-2">{t('pricing.opportunities') || 'Oportunidades detectadas'}</div>
          <div className="text-3xl font-semibold text-slate-50 tabular-nums tracking-tight">
            {loading ? '…' : stats.oportunidades}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">{t('pricing.opportunitiesHint') || 'Productos donde el precio no es óptimo'}</p>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
          <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500 mb-2">{t('pricing.analyzed') || 'Productos analizados'}</div>
          <div className="text-3xl font-semibold text-slate-50 tabular-nums tracking-tight">
            {loading ? '…' : stats.analizados}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">{t('pricing.analyzedHint') || 'Con datos suficientes en el último año'}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-slate-900/60 border border-slate-800 rounded-md p-0.5">
          {([
            ['todos', t('common.all') || 'Todas'],
            ['subir', t('pricing.shouldRaise') || 'Subir'],
            ['bajar', t('pricing.shouldLower') || 'Bajar'],
            ['alta_conf', t('pricing.highConfidence') || 'Alta confianza'],
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
          placeholder={t('pricing.searchPlaceholder') || 'Buscar producto…'}
          className="flex-1 max-w-xs bg-slate-900 border border-slate-800 rounded-md px-3 py-1.5 text-[12px] text-slate-100 focus:outline-none focus:border-slate-600"
        />
      </div>

      {/* Tabla de recomendaciones */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500 text-[13px]">
            <RefreshCw className="inline-block animate-spin mr-2" size={14} />
            {t('pricing.computing') || 'Calculando elasticidades…'}
          </div>
        ) : filtradas.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-[13px]">
            {t('pricing.noResults') || 'Sin resultados para los filtros seleccionados.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800 bg-slate-950/60">
                  <th className="text-left font-medium py-2.5 px-4">Producto</th>
                  <th className="text-right font-medium py-2.5 px-2">Precio actual</th>
                  <th className="text-right font-medium py-2.5 px-2">Sugerido</th>
                  <th className="text-right font-medium py-2.5 px-2">Δ %</th>
                  <th className="text-right font-medium py-2.5 px-2">Margen</th>
                  <th className="text-right font-medium py-2.5 px-2">Impacto anual</th>
                  <th className="text-center font-medium py-2.5 px-2">Confianza</th>
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
                        <OpIcon op={r.oportunidad} />
                        <div>
                          <p className="text-slate-100">{r.nombre}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{r.codigo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-right tabular-nums text-slate-300 px-2">{fmtMoney(r.precio_actual)}</td>
                    <td className="text-right tabular-nums text-slate-100 font-semibold px-2">{fmtMoney(r.precio_sugerido)}</td>
                    <td className="text-right tabular-nums px-2">
                      <span className={cn(
                        'inline-block px-1.5 py-0.5 rounded text-[11px] font-medium',
                        r.delta_pct > 0 ? 'bg-slate-800/40 text-slate-300'
                          : r.delta_pct < 0 ? 'bg-slate-800/40 text-slate-300'
                          : 'bg-slate-700/40 text-slate-400'
                      )}>
                        {r.delta_pct >= 0 ? '+' : ''}{r.delta_pct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="text-right tabular-nums text-slate-400 px-2">
                      {r.margen_actual_pct.toFixed(0)}% → <span className="text-slate-200 font-medium">{r.margen_sugerido_pct.toFixed(0)}%</span>
                    </td>
                    <td className="text-right tabular-nums px-2">
                      <span className={cn(
                        r.impacto_margen_anual > 0 ? 'text-slate-300' : r.impacto_margen_anual < 0 ? 'text-slate-300' : 'text-slate-500'
                      )}>
                        {r.impacto_margen_anual >= 0 ? '+' : ''}{fmtMoney(r.impacto_margen_anual, true)}
                      </span>
                    </td>
                    <td className="text-center px-2">
                      <ConfianzaBadge conf={r.confianza} />
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
        <DetalleRecomendacion rec={seleccionada} onClose={() => setSeleccionada(null)} />
      )}
    </div>
  );
}

function OpIcon({ op }: { op: 'subir' | 'bajar' | 'mantener' }) {
  if (op === 'subir') return <TrendingUp size={13} className="text-slate-300 shrink-0" />;
  if (op === 'bajar') return <TrendingDown size={13} className="text-slate-300 shrink-0" />;
  return <Minus size={13} className="text-slate-500 shrink-0" />;
}

function ConfianzaBadge({ conf }: { conf: 'alta' | 'media' | 'baja' }) {
  const colors = {
    alta: 'bg-slate-800/40 text-slate-300',
    media: 'bg-slate-700/40 text-slate-300',
    baja: 'bg-slate-800/40 text-slate-300',
  };
  const labels = { alta: 'Alta', media: 'Media', baja: 'Baja' };
  return (
    <span className={cn('inline-block px-1.5 py-0.5 rounded text-[10px] font-medium', colors[conf])}>
      {labels[conf]}
    </span>
  );
}

function DetalleRecomendacion({ rec, onClose }: { rec: Recomendacion; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-lg w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
          <div>
            <h2 className="text-[14px] font-semibold text-slate-100">{rec.nombre}</h2>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">{rec.codigo}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900/50 border border-slate-800 rounded-md p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Precio actual</p>
              <p className="text-xl font-semibold text-slate-200 tabular-nums">{fmtMoney(rec.precio_actual)}</p>
              <p className="text-[10px] text-slate-500 mt-1">Margen {rec.margen_actual_pct.toFixed(1)}%</p>
            </div>
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-md p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-300 mb-1">Precio sugerido</p>
              <p className="text-xl font-semibold text-slate-300 tabular-nums">{fmtMoney(rec.precio_sugerido)}</p>
              <p className="text-[10px] text-slate-300/70 mt-1">Margen {rec.margen_sugerido_pct.toFixed(1)}%</p>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-md p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">
              <Info size={11} /> Por qué
            </p>
            <p className="text-[13px] text-slate-200">{rec.razon}</p>
            {rec.elasticidad !== null && (
              <p className="text-[11px] text-slate-500 mt-2">
                Elasticidad = {rec.elasticidad}.{' '}
                {rec.elasticidad < -1
                  ? 'Demanda elástica — un cambio de precio impacta fuerte el volumen.'
                  : 'Demanda inelástica — los clientes son poco sensibles al precio.'}
              </p>
            )}
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-md p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Impacto estimado anual</p>
            <p className={cn(
              'text-xl font-semibold tabular-nums',
              rec.impacto_margen_anual >= 0 ? 'text-slate-300' : 'text-slate-300'
            )}>
              {rec.impacto_margen_anual >= 0 ? '+' : ''}{fmtMoney(rec.impacto_margen_anual)}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">
              Ingreso anual actual: {fmtMoney(rec.ingreso_esperado_anual_actual)} → sugerido: {fmtMoney(rec.ingreso_esperado_anual_sugerido)}
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              {rec.confianza === 'alta' ? <CheckCircle2 size={11} className="text-slate-300" /> : <AlertCircle size={11} className="text-slate-300" />}
              Confianza: <span className="capitalize">{rec.confianza}</span>
            </span>
            <span>{rec.datos_usados.transacciones} ventas · {rec.datos_usados.niveles_precio} niveles de precio</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PricingRecommender;
