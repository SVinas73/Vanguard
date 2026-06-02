'use client';

import React, { useEffect, useState } from 'react';
import { X, TrendingUp, TrendingDown, Minus, Loader2, DollarSign } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatMoney } from '@/lib/currency';
import type { Moneda } from '@/types';

interface CambioCosto {
  id: string;
  costo_anterior: number;
  costo_nuevo: number;
  cantidad: number | null;
  proveedor_nombre?: string | null;
  numero_factura?: string | null;
  fecha?: string | null;
  usuario?: string | null;
  created_at?: string | null;
}

interface Props {
  codigo: string;
  descripcion: string;
  moneda?: Moneda;
  /** Costo promedio actual del producto (se muestra arriba como referencia). */
  costoActual?: number | null;
  onClose: () => void;
}

/**
 * Historial de cambios de costo de un producto. Lee `historial_costos`
 * (lo escriben la recepción de compras, la recepción de insumos y las
 * ediciones manuales en Costos) y lo muestra como una línea de tiempo.
 */
export default function HistorialCostoModal({ codigo, descripcion, moneda = 'UYU', costoActual, onClose }: Props) {
  const [cambios, setCambios] = useState<CambioCosto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('historial_costos')
        .select('*, proveedor:proveedores(nombre)')
        .eq('codigo', codigo)
        .order('created_at', { ascending: false })
        .limit(200);
      if (cancelled) return;
      setCambios((data || []).map((h: any) => ({
        id: h.id,
        costo_anterior: parseFloat(h.costo_anterior) || 0,
        costo_nuevo: parseFloat(h.costo_nuevo) || 0,
        cantidad: h.cantidad ?? null,
        proveedor_nombre: h.proveedor?.nombre ?? null,
        numero_factura: h.numero_factura ?? null,
        fecha: h.fecha ?? null,
        usuario: h.usuario ?? null,
        created_at: h.created_at ?? null,
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [codigo]);

  const fmt = (n: number) => formatMoney(n, moneda, { minimumFractionDigits: 2 });
  const fechaDe = (c: CambioCosto) => c.fecha || c.created_at;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-400 shrink-0" />
              <h3 className="font-semibold text-slate-100 truncate">Historial de costos</h3>
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
          ) : cambios.length === 0 ? (
            <div className="text-center py-10 text-sm text-slate-500">
              Sin cambios de costo registrados todavía.
              <div className="text-xs text-slate-600 mt-1">
                Cada recepción de compra o insumo con costo queda registrada acá.
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {cambios.map(c => {
                const subio = c.costo_nuevo > c.costo_anterior;
                const bajo = c.costo_nuevo < c.costo_anterior;
                const delta = c.costo_anterior > 0
                  ? ((c.costo_nuevo - c.costo_anterior) / c.costo_anterior) * 100
                  : 0;
                return (
                  <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 bg-slate-800/60 border border-slate-700 rounded-md">
                    <div className={
                      subio ? 'text-red-400' : bajo ? 'text-emerald-400' : 'text-slate-500'
                    }>
                      {subio ? <TrendingUp className="w-4 h-4" /> : bajo ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-200">
                        <span className="text-slate-400 font-mono">{fmt(c.costo_anterior)}</span>
                        <span className="mx-1.5 text-slate-600">→</span>
                        <span className="font-mono">{fmt(c.costo_nuevo)}</span>
                        {c.costo_anterior > 0 && (
                          <span className={`ml-2 text-xs ${subio ? 'text-red-400' : bajo ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3 mt-0.5">
                        {fechaDe(c) && <span>{new Date(fechaDe(c) as string).toLocaleDateString('es-UY')}</span>}
                        {c.cantidad != null && c.cantidad > 0 && <span>{c.cantidad} u.</span>}
                        {c.proveedor_nombre && <span>{c.proveedor_nombre}</span>}
                        {c.numero_factura && <span>Fact. {c.numero_factura}</span>}
                        {c.usuario && <span className="truncate">{c.usuario}</span>}
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
