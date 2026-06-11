'use client';

// =====================================================
// Orden Interna de insumos
// =====================================================
// Los empleados retiran insumos del almacén con una orden interna:
// eligen el insumo, la cantidad y un comentario opcional. Al confirmar
// se descuenta el stock vía el store (addMovement tipo 'salida'), por lo
// que queda conectado con TODO lo existente:
//   - módulo Stock (stock del insumo baja),
//   - Análisis de insumos (la salida aparece en el flujo),
//   - Reporte "Gastos de insumos" (cuenta como consumo, igual que el "-"),
//   - Auditoría (acción SALIDA, mismo formato que el "-" de Stock).

import React, { useState, useEffect, useMemo } from 'react';
import { ClipboardList, User, Clock, Search, Loader2, ArrowRight, MessageSquare, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useInventoryStore } from '@/store';
import { useAuth } from '@/hooks/useAuth';
import { getAlmacenesInsumoIds } from '@/lib/wms-insumos-filter';

interface InsumoOption {
  codigo: string;
  descripcion: string;
  stock: number;
}

interface OrdenReciente {
  id: string;
  codigo: string;
  cantidad: number;
  notas: string | null;
  usuario: string | null;
  fecha: string;
}

const PREFIJO_NOTA = 'Orden interna';

export default function OrdenInternaInsumos() {
  const { user } = useAuth(false);
  const addMovement = useInventoryStore((s) => s.addMovement);

  const [insumos, setInsumos] = useState<InsumoOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [codigoSel, setCodigoSel] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [comentario, setComentario] = useState('');
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [recientes, setRecientes] = useState<OrdenReciente[]>([]);

  useEffect(() => {
    cargar();
  }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      // Solo productos de almacenes de INSUMOS.
      const idsInsumos = await getAlmacenesInsumoIds();
      const { data } = await supabase
        .from('productos')
        .select('codigo, descripcion, stock, almacen_id')
        .order('descripcion')
        .limit(3000);
      setInsumos(
        (data || [])
          .filter((p: any) => p.almacen_id && idsInsumos.has(p.almacen_id))
          .map((p: any) => ({ codigo: p.codigo, descripcion: p.descripcion, stock: Number(p.stock) || 0 })),
      );

      // Últimas órdenes internas (salidas con la nota del prefijo).
      const { data: movs } = await supabase
        .from('movimientos')
        .select('id, codigo, cantidad, notas, usuario_email, created_at')
        .eq('tipo', 'salida')
        .ilike('notas', `${PREFIJO_NOTA}%`)
        .order('created_at', { ascending: false })
        .limit(20);
      setRecientes((movs || []).map((m: any) => ({
        id: m.id,
        codigo: m.codigo,
        cantidad: Number(m.cantidad) || 0,
        notas: m.notas,
        usuario: m.usuario_email,
        fecha: m.created_at,
      })));
    } finally {
      setLoading(false);
    }
  };

  const filtrados = useMemo(() => {
    if (!search.trim()) return insumos;
    const s = search.toLowerCase();
    return insumos.filter(i =>
      i.codigo.toLowerCase().includes(s) || i.descripcion.toLowerCase().includes(s)
    );
  }, [insumos, search]);

  const seleccionado = insumos.find(i => i.codigo === codigoSel) || null;
  const cant = parseInt(cantidad) || 0;
  const stockPrevio = seleccionado?.stock ?? 0;
  const stockResultante = stockPrevio - cant;
  const valido = !!seleccionado && cant > 0 && cant <= stockPrevio;

  const ahoraFmt = new Date().toLocaleString('es-UY', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const confirmar = async () => {
    if (!valido || !seleccionado || saving) return;
    setSaving(true);
    setOk(null);
    try {
      // Misma vía que el "-" de Stock: descuenta stock, registra el
      // movimiento (con la nota) y deja la SALIDA en Auditoría.
      await addMovement(
        {
          codigo: seleccionado.codigo,
          tipo: 'salida',
          cantidad: cant,
          notas: comentario.trim()
            ? `${PREFIJO_NOTA} · ${comentario.trim()}`
            : PREFIJO_NOTA,
        },
        user?.email || 'Sistema',
      );
      const err = useInventoryStore.getState().error;
      if (err) {
        alert(`No se pudo registrar la orden interna: ${err}`);
        return;
      }
      setOk(`Orden interna registrada: ${cant} × ${seleccionado.descripcion} (${seleccionado.codigo})`);
      setCodigoSel('');
      setCantidad('1');
      setComentario('');
      setSearch('');
      cargar();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vg:stock-changed', {
          detail: { source: 'orden-interna', codigo: seleccionado.codigo },
        }));
      }
    } finally {
      setSaving(false);
    }
  };

  const fechaFmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-7 w-7 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-amber-400" />
          Orden interna
        </h3>
        <p className="text-sm text-slate-500 mt-0.5">
          Retiro de insumos por empleados: elegí el insumo, la cantidad y dejá un comentario si hace falta. El stock se descuenta al confirmar.
        </p>
      </div>

      {ok && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-sm text-emerald-300">
          <CheckCircle className="h-4 w-4 shrink-0" />
          {ok}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Formulario */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-4">
          {/* Quién y cuándo */}
          <div className="flex items-center gap-4 text-xs text-slate-400 bg-slate-800/40 border border-slate-700/40 rounded-lg px-3 py-2">
            <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{user?.email || '—'}</span>
            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{ahoraFmt}</span>
          </div>

          {/* Buscar insumo */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Insumo *</label>
            {seleccionado ? (
              <div className="flex items-center justify-between bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm text-slate-200 truncate">{seleccionado.descripcion}</div>
                  <div className="text-xs text-slate-500 font-mono">{seleccionado.codigo} · stock {seleccionado.stock}</div>
                </div>
                <button onClick={() => { setCodigoSel(''); setSearch(''); }} className="text-xs text-slate-400 hover:text-slate-200 shrink-0 ml-3">
                  cambiar
                </button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por código o descripción…"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-600"
                  />
                </div>
                {search.trim() && (
                  <div className="mt-1 max-h-48 overflow-y-auto bg-slate-900 border border-slate-700 rounded-lg divide-y divide-slate-800">
                    {filtrados.length === 0 ? (
                      <div className="px-3 py-2.5 text-sm text-slate-500">Sin resultados en el almacén de insumos.</div>
                    ) : filtrados.slice(0, 30).map(i => (
                      <button
                        key={i.codigo}
                        onClick={() => setCodigoSel(i.codigo)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-800/60"
                      >
                        <div className="text-sm text-slate-200">{i.descripcion}</div>
                        <div className="text-xs text-slate-500 font-mono">{i.codigo} · stock {i.stock}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cantidad */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Cantidad *</label>
            <input
              type="number"
              min={1}
              max={stockPrevio || undefined}
              value={cantidad}
              onChange={e => setCantidad(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-600"
            />
            {seleccionado && cant > stockPrevio && (
              <div className="text-xs text-red-400 mt-1">No hay stock suficiente ({stockPrevio} disponibles).</div>
            )}
          </div>

          {/* Comentario */}
          <div>
            <label className="text-xs text-slate-400 mb-1 flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Comentario (opcional)</label>
            <textarea
              value={comentario}
              onChange={e => setComentario(e.target.value)}
              rows={2}
              placeholder="Para qué se usa, sector, máquina…"
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 resize-none focus:outline-none focus:border-amber-600"
            />
          </div>

          {/* Stock previo → resultante */}
          {seleccionado && (
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-sm">
              <span className="text-slate-400">Stock</span>
              <div className="flex items-center gap-2 font-mono">
                <span className="text-slate-300">{stockPrevio}</span>
                <ArrowRight className="h-4 w-4 text-slate-600" />
                <span className={stockResultante < 0 ? 'text-red-400 font-bold' : 'text-amber-300 font-bold'}>
                  {stockResultante}
                </span>
              </div>
            </div>
          )}

          <button
            onClick={confirmar}
            disabled={!valido || saving}
            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
            Confirmar orden interna
          </button>
        </div>

        {/* Últimas órdenes internas */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-slate-300 mb-3">Últimas órdenes internas</h4>
          {recientes.length === 0 ? (
            <div className="text-sm text-slate-500 py-6 text-center">Todavía no hay órdenes internas.</div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {recientes.map(r => (
                <div key={r.id} className="px-3 py-2.5 bg-slate-800/40 border border-slate-700/40 rounded-lg">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-slate-300">{r.codigo}</span>
                    <span className="text-xs text-red-400 font-mono">−{r.cantidad} uds</span>
                  </div>
                  {r.notas && r.notas !== PREFIJO_NOTA && (
                    <div className="text-xs text-slate-400 mt-1 flex items-start gap-1">
                      <MessageSquare className="h-3 w-3 mt-0.5 shrink-0 text-slate-600" />
                      {r.notas.replace(`${PREFIJO_NOTA} · `, '')}
                    </div>
                  )}
                  <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-x-3">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fechaFmt(r.fecha)}</span>
                    {r.usuario && <span className="flex items-center gap-1"><User className="h-3 w-3" />{r.usuario}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
