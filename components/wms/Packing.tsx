'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Package, Search, RefreshCw, CheckCircle, X, ScanLine, Receipt, Loader2, ArrowLeft, Plus,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { registrarAuditoria } from '@/lib/audit';
import { facturarOrdenVenta, generarPDFFactura } from '@/lib/uy-cfe';
import { useAuth } from '@/hooks/useAuth';
import { useWmsToast } from './useWmsToast';
import { formatMoney } from '@/lib/currency';
import type { Moneda } from '@/types';

// Estados de venta que SÍ se pueden facturar (excluye borrador/cancelada/retenida).
const ESTADOS_FACTURABLES = ['confirmada', 'en_proceso', 'enviada', 'entregada', 'despachada'];

interface OrdenPendiente {
  id: string;
  numero: string;
  estado: string;
  total: number;
  moneda: Moneda;
  cliente_nombre: string;
  cliente_rut: string | null;
  created_at: string;
}

interface ItemOrden {
  producto_codigo: string;
  descripcion: string;
  cantidad: number;
  verificado: number;
}

export default function Packing() {
  const { user } = useAuth(false);
  const toast = useWmsToast();
  const [loading, setLoading] = useState(true);
  const [ordenes, setOrdenes] = useState<OrdenPendiente[]>([]);
  const [search, setSearch] = useState('');
  const [vista, setVista] = useState<'lista' | 'detalle'>('lista');

  // Detalle / verificación
  const [orden, setOrden] = useState<OrdenPendiente | null>(null);
  const [items, setItems] = useState<ItemOrden[]>([]);
  const [scan, setScan] = useState('');
  const [facturando, setFacturando] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1) Órdenes de venta facturables
      const { data: ordenesData, error } = await supabase
        .from('ordenes_venta')
        .select('id, numero, estado, total, moneda, created_at, cliente_id, clientes(nombre, rut)')
        .limit(300);
      if (error) console.error('Error cargando órdenes:', error);

      const facturables = (ordenesData || []).filter((o: any) => ESTADOS_FACTURABLES.includes(o.estado));

      // 2) ¿Cuáles ya tienen factura (CFE no anulado)?
      const ids = facturables.map((o: any) => o.id);
      const facturadas = new Set<string>();
      if (ids.length) {
        const { data: cfes } = await supabase
          .from('cfe_uy')
          .select('origen_id')
          .eq('origen_tipo', 'orden_venta')
          .neq('estado', 'anulado')
          .in('origen_id', ids);
        (cfes || []).forEach((c: any) => facturadas.add(c.origen_id));
      }

      const pendientes: OrdenPendiente[] = facturables
        .filter((o: any) => !facturadas.has(o.id))
        .map((o: any) => ({
          id: o.id,
          numero: o.numero,
          estado: o.estado,
          total: Number(o.total) || 0,
          moneda: (o.moneda as Moneda) || 'UYU',
          cliente_nombre: o.clientes?.nombre || 'Sin cliente',
          cliente_rut: o.clientes?.rut || null,
          created_at: o.created_at,
        }))
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

      setOrdenes(pendientes);
    } finally {
      setLoading(false);
    }
  };

  const filtradas = useMemo(() => {
    if (!search.trim()) return ordenes;
    const s = search.toLowerCase();
    return ordenes.filter(o =>
      o.numero.toLowerCase().includes(s) || o.cliente_nombre.toLowerCase().includes(s)
    );
  }, [ordenes, search]);

  const abrirDetalle = async (o: OrdenPendiente) => {
    setOrden(o);
    setVista('detalle');
    setScan('');
    // Cargar ítems de la orden + descripción del producto
    const { data: itemsData } = await supabase
      .from('ordenes_venta_items')
      .select('producto_codigo, cantidad')
      .eq('orden_venta_id', o.id);
    const codigos = Array.from(new Set((itemsData || []).map((i: any) => i.producto_codigo).filter(Boolean)));
    const descPorCodigo = new Map<string, string>();
    if (codigos.length) {
      const { data: prods } = await supabase
        .from('productos').select('codigo, descripcion').in('codigo', codigos);
      (prods || []).forEach((p: any) => descPorCodigo.set(p.codigo, p.descripcion));
    }
    setItems((itemsData || []).map((i: any) => ({
      producto_codigo: i.producto_codigo,
      descripcion: descPorCodigo.get(i.producto_codigo) || i.producto_codigo,
      cantidad: Number(i.cantidad) || 0,
      verificado: 0,
    })));
    setTimeout(() => scanRef.current?.focus(), 100);
  };

  const volver = () => {
    setVista('lista');
    setOrden(null);
    setItems([]);
    setScan('');
  };

  // Suma 1 a la verificación del producto cuyo código coincide con lo escaneado.
  const procesarScan = (codigoRaw: string) => {
    const codigo = codigoRaw.trim().toUpperCase();
    if (!codigo) return;
    const idx = items.findIndex(i => i.producto_codigo.toUpperCase() === codigo);
    if (idx < 0) {
      toast.error(`El código ${codigo} no pertenece a este pedido`);
      setScan('');
      return;
    }
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      if (it.verificado >= it.cantidad) {
        toast.warning(`${it.producto_codigo}: ya verificaste las ${it.cantidad} unidades`);
        return it;
      }
      return { ...it, verificado: it.verificado + 1 };
    }));
    setScan('');
  };

  const sumarManual = (idx: number, delta: number) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const v = Math.max(0, Math.min(it.cantidad, it.verificado + delta));
      return { ...it, verificado: v };
    }));
  };

  const verificarTodo = () => setItems(prev => prev.map(it => ({ ...it, verificado: it.cantidad })));

  const totalUnidades = items.reduce((s, i) => s + i.cantidad, 0);
  const totalVerificado = items.reduce((s, i) => s + i.verificado, 0);
  const todoOk = items.length > 0 && items.every(i => i.verificado >= i.cantidad);

  const facturar = async () => {
    if (!orden || !todoOk || facturando) return;
    setFacturando(true);
    try {
      const res = await facturarOrdenVenta(orden.id, user?.email || '');
      if (res.yaFacturada) {
        toast.warning('La orden ya tenía una factura emitida.');
      } else if (res.cfe) {
        toast.success(`Factura ${res.cfe.serie}-${res.cfe.numero} generada. Abriendo PDF…`);
        await registrarAuditoria('ordenes_venta', 'FACTURADA', orden.numero, null,
          { cfe: `${res.cfe.serie}-${res.cfe.numero}`, verificado_por: user?.email }, user?.email || '');
        generarPDFFactura(res.cfe.id, 'abrir').catch(() => {});
        volver();
        loadData();
        return;
      } else {
        toast.error(res.error || 'No se pudo facturar');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error al facturar');
    } finally {
      setFacturando(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12"><RefreshCw className="h-8 w-8 animate-spin text-slate-300" /></div>;
  }

  // ==================== DETALLE / VERIFICACIÓN ====================
  if (vista === 'detalle' && orden) {
    return (
      <div className="space-y-6">
        <toast.Toast />
        <div className="flex items-center gap-3">
          <button onClick={volver} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Receipt className="h-6 w-6 text-slate-300" />
              Facturar {orden.numero}
            </h3>
            <div className="text-xs text-slate-500 mt-0.5">
              {orden.cliente_nombre}{orden.cliente_rut ? ` · RUT ${orden.cliente_rut}` : ' · sin RUT (e-Ticket)'} · {formatMoney(orden.total, orden.moneda)}
            </div>
          </div>
        </div>

        {/* Escáner */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <label className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
            <ScanLine className="h-4 w-4" /> Escaneá el código de barras de cada artículo
          </label>
          <div className="flex gap-2">
            <input
              ref={scanRef}
              value={scan}
              onChange={e => setScan(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') procesarScan(scan); }}
              placeholder="Escaneá o escribí el código y Enter…"
              className="flex-1 px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm font-mono focus:outline-none focus:border-cyan-600"
            />
            <button
              onClick={() => procesarScan(scan)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm"
            >
              Verificar
            </button>
            <button
              onClick={verificarTodo}
              className="px-4 py-2.5 bg-slate-800/60 hover:bg-slate-700 text-slate-400 rounded-lg text-sm"
              title="Marca todo como verificado (modo prueba / sin lector)"
            >
              Verificar todo
            </button>
          </div>
        </div>

        {/* Ítems */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 border-b border-slate-800">
              <tr className="text-left text-xs text-slate-400 uppercase">
                <th className="px-4 py-3">Artículo</th>
                <th className="px-4 py-3 text-center">Verificado / Pedido</th>
                <th className="px-4 py-3 text-center">Ajuste</th>
                <th className="px-4 py-3 text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {items.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-10 text-slate-500">La orden no tiene ítems.</td></tr>
              ) : items.map((it, idx) => {
                const ok = it.verificado >= it.cantidad;
                return (
                  <tr key={it.producto_codigo} className={ok ? 'bg-emerald-500/5' : ''}>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-slate-400">{it.producto_codigo}</div>
                      <div className="text-slate-200">{it.descripcion}</div>
                    </td>
                    <td className="px-4 py-3 text-center font-mono">
                      <span className={ok ? 'text-emerald-400' : 'text-slate-200'}>{it.verificado}</span>
                      <span className="text-slate-600"> / {it.cantidad}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => sumarManual(idx, -1)} className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-300">−</button>
                        <button onClick={() => sumarManual(idx, 1)} className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"><Plus className="h-3.5 w-3.5 mx-auto" /></button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {ok
                        ? <CheckCircle className="h-5 w-5 text-emerald-400 inline" />
                        : <span className="text-xs text-amber-400">Falta {it.cantidad - it.verificado}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer / facturar */}
        <div className="flex items-center justify-between bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="text-sm text-slate-400">
            Verificado <span className="font-mono text-slate-200">{totalVerificado}</span> de <span className="font-mono text-slate-200">{totalUnidades}</span> unidades
          </div>
          <button
            onClick={facturar}
            disabled={!todoOk || facturando}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {facturando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
            {todoOk ? 'Confirmar y facturar' : 'Verificá todo para facturar'}
          </button>
        </div>
      </div>
    );
  }

  // ==================== LISTA ====================
  return (
    <div className="space-y-6">
      <toast.Toast />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Receipt className="h-6 w-6 text-slate-300" />
          Factura de pedidos
        </h3>
        <button onClick={loadData} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar pedido por número o cliente…"
          className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-cyan-600"
        />
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 border-b border-slate-800">
            <tr className="text-left text-xs text-slate-400 uppercase">
              <th className="px-4 py-3">Pedido</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filtradas.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-slate-500 text-sm">
                No hay pedidos pendientes de facturar.
              </td></tr>
            ) : filtradas.map(o => (
              <tr key={o.id} className="hover:bg-slate-800/30">
                <td className="px-4 py-3 font-mono text-slate-200">{o.numero}</td>
                <td className="px-4 py-3 text-slate-300">
                  {o.cliente_nombre}
                  {!o.cliente_rut && <span className="ml-2 text-[10px] text-amber-400/80">sin RUT</span>}
                </td>
                <td className="px-4 py-3 text-slate-300 font-mono">{formatMoney(o.total, o.moneda)}</td>
                <td className="px-4 py-3"><span className="text-xs text-slate-400 capitalize">{o.estado}</span></td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => abrirDetalle(o)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-medium rounded-lg"
                  >
                    <ScanLine className="h-3.5 w-3.5" />
                    Verificar y facturar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
