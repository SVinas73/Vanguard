'use client';

import React, { useEffect, useState } from 'react';
import { X, TrendingUp, TrendingDown, Minus, Loader2, History, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatMoney } from '@/lib/currency';
import type { Moneda } from '@/types';

// Evento unificado del historial del producto: cambio de costo o movimiento.
interface Evento {
  id: string;
  tipo: 'costo' | 'movimiento';
  fecha: string;                  // ISO para ordenar
  // costo
  costo_anterior?: number;
  costo_nuevo?: number;
  proveedor_nombre?: string | null;
  numero_factura?: string | null;
  // movimiento
  mov_tipo?: string;              // entrada | salida | ajuste | transferencia
  cantidad?: number | null;
  costo_unitario?: number | null;
  notas?: string | null;
  usuario?: string | null;
}

interface Props {
  codigo: string;
  descripcion: string;
  moneda?: Moneda;
  costoActual?: number | null;
  onClose: () => void;
}

/**
 * Historial COMPLETO del producto: cambios de costo (historial_costos) +
 * movimientos con sus comentarios/observaciones (movimientos), en una sola
 * línea de tiempo ordenada por fecha.
 */
export default function HistorialCostoModal({ codigo, descripcion, moneda = 'UYU', costoActual, onClose }: Props) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [costosRes, movsRes] = await Promise.all([
        supabase.from('historial_costos').select('*, proveedor:proveedores(nombre)').eq('codigo', codigo).limit(200),
        supabase.from('movimientos').select('*').eq('codigo', codigo).order('created_at', { ascending: false }).limit(200),
      ]);
      if (cancelled) return;

      const evCostos: Evento[] = (costosRes.data || []).map((h: any) => ({
        id: `c-${h.id}`,
        tipo: 'costo',
        fecha: h.fecha || h.created_at || new Date().toISOString(),
        costo_anterior: parseFloat(h.costo_anterior) || 0,
        costo_nuevo: parseFloat(h.costo_nuevo) || 0,
        proveedor_nombre: h.proveedor?.nombre ?? null,
        numero_factura: h.numero_factura ?? null,
        usuario: h.usuario ?? null,
      }));

      const evMovs: Evento[] = (movsRes.data || []).map((m: any) => ({
        id: `m-${m.id}`,
        tipo: 'movimiento',
        fecha: m.created_at || m.fecha_ejecucion || new Date().toISOString(),
        mov_tipo: m.tipo,
        cantidad: m.cantidad ?? null,
        costo_unitario: m.costo_compra != null ? parseFloat(m.costo_compra) : (m.costo_unitario != null ? parseFloat(m.costo_unitario) : null),
        notas: m.notas ?? m.motivo ?? null,
        usuario: m.usuario_email ?? m.usuario ?? null,
      }));

      const todos = [...evCostos, ...evMovs].sort(
        (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
      );
      setEventos(todos);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [codigo]);

  const fmt = (n: number) => formatMoney(n, moneda, { minimumFractionDigits: 2 });
  const fechaFmt = (iso: string) => {
    try { return new Date(iso).toLocaleString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return iso; }
  };

  const MOV_CFG: Record<string, { label: string; color: string; Icon: typeof ArrowDownLeft }> = {
    entrada: { label: 'Entrada', color: 'text-emerald-400', Icon: ArrowDownLeft },
    salida: { label: 'Salida', color: 'text-red-400', Icon: ArrowUpRight },
    transferencia: { label: 'Transferencia', color: 'text-blue-400', Icon: ArrowLeftRight },
    ajuste: { label: 'Ajuste', color: 'text-amber-400', Icon: Minus },
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-400 shrink-0" />
              <h3 className="font-semibold text-slate-100 truncate">Historial del producto</h3>
            </div>
            <div className="text-xs text-slate-500 font-mono mt-0.5">{codigo} · {descripcion}</div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/60">
          <span className="text-xs text-slate-500">Costo promedio actual</span>
          <div className="text-lg font-mono text-slate-100">
            {costoActual != null && costoActual > 0 ? fmt(costoActual) : '—'}
          </div>
        </div>

        <div className="p-5 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-500 gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando historial...
            </div>
          ) : eventos.length === 0 ? (
            <div className="text-center py-10 text-sm text-slate-500">
              Sin historial todavía.
              <div className="text-xs text-slate-600 mt-1">
                Acá vas a ver los cambios de costo, las entradas/salidas y sus observaciones.
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {eventos.map(e => {
                if (e.tipo === 'costo') {
                  const ca = e.costo_anterior || 0;
                  const cn = e.costo_nuevo || 0;
                  const subio = cn > ca, bajo = cn < ca;
                  const delta = ca > 0 ? ((cn - ca) / ca) * 100 : 0;
                  return (
                    <div key={e.id} className="flex items-start gap-3 px-3 py-2.5 bg-slate-800/60 border border-slate-700 rounded-md">
                      <div className={subio ? 'text-red-400 mt-0.5' : bajo ? 'text-emerald-400 mt-0.5' : 'text-slate-500 mt-0.5'}>
                        {subio ? <TrendingUp className="w-4 h-4" /> : bajo ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-200">
                          <span className="text-[10px] uppercase tracking-wide text-amber-300 mr-2">Costo</span>
                          <span className="text-slate-400 font-mono">{fmt(ca)}</span>
                          <span className="mx-1.5 text-slate-600">→</span>
                          <span className="font-mono">{fmt(cn)}</span>
                          {ca > 0 && (
                            <span className={`ml-2 text-xs ${subio ? 'text-red-400' : bajo ? 'text-emerald-400' : 'text-slate-500'}`}>
                              {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3 mt-0.5">
                          <span>{fechaFmt(e.fecha)}</span>
                          {e.proveedor_nombre && <span>{e.proveedor_nombre}</span>}
                          {e.numero_factura && <span>Fact. {e.numero_factura}</span>}
                          {e.usuario && <span className="truncate">{e.usuario}</span>}
                        </div>
                      </div>
                    </div>
                  );
                }
                const cfg = MOV_CFG[e.mov_tipo || ''] || { label: e.mov_tipo || 'Movimiento', color: 'text-slate-400', Icon: MessageSquare };
                const Icon = cfg.Icon;
                return (
                  <div key={e.id} className="flex items-start gap-3 px-3 py-2.5 bg-slate-800/60 border border-slate-700 rounded-md">
                    <div className={`${cfg.color} mt-0.5`}><Icon className="w-4 h-4" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-200">
                        <span className={`text-[10px] uppercase tracking-wide mr-2 ${cfg.color}`}>{cfg.label}</span>
                        {e.cantidad != null && e.cantidad !== 0 && <span className="font-mono">{e.cantidad} u.</span>}
                        {e.costo_unitario != null && e.costo_unitario > 0 && (
                          <span className="text-slate-400 ml-2">· {fmt(e.costo_unitario)} c/u</span>
                        )}
                      </div>
                      {e.notas && <div className="text-xs text-slate-300 mt-0.5 flex items-start gap-1"><MessageSquare className="w-3 h-3 mt-0.5 shrink-0 text-slate-500" />{e.notas}</div>}
                      <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3 mt-0.5">
                        <span>{fechaFmt(e.fecha)}</span>
                        {e.usuario && <span className="truncate">{e.usuario}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
