'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Boxes, Plus, RefreshCw, Search, Eye, Trash2, Copy, Edit3, CheckCircle, Save, X, Package, Clock, DollarSign, ChevronRight, ChevronDown, Layers, GitBranch, FileText, AlertTriangle, Info, ArrowLeftRight, Target, Archive } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface BOMItem { id?: string; componenteCodigo: string; componenteDescripcion?: string; cantidad: number; secuencia?: number; nivel: number; esCritico?: boolean; costoUnitario?: number; costoTotal?: number; notas?: string; componente?: { codigo: string; descripcion: string; precio: number; costoPromedio: number; stock: number; stockMinimo: number } }
interface BOM { id: string; productoCodigo: string; version: string; nombre?: string; estado: 'borrador' | 'activo' | 'obsoleto' | 'revision'; tipo: 'produccion' | 'ingenieria' | 'venta' | 'servicio'; cantidadBase?: number; costoMateriales?: number; costoManoObra?: number; costoOverhead?: number; costoTotal?: number; tiempoEnsamblajeMinutos?: number; notas?: string; esPrincipal?: boolean; producto?: { codigo: string; descripcion: string; precio: number }; items?: BOMItem[] }
interface Product { codigo: string; descripcion: string; precio: number; costoPromedio?: number; stock: number; stockMinimo: number }
type ModalType = 'create' | 'edit' | 'view' | 'compare' | 'whereUsed' | null;

export default function BOMManager() {
  const { user } = useAuth();
  const [boms, setBoms] = useState<BOM[]>([]);
  const [productos, setProductos] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'table'|'cards'>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('todos');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [modalType, setModalType] = useState<ModalType>(null);
  const [selectedBOM, setSelectedBOM] = useState<BOM | null>(null);
  const [compareBOMs, setCompareBOMs] = useState<[BOM | null, BOM | null]>([null, null]);
  const [whereUsedCodigo, setWhereUsedCodigo] = useState<string | null>(null);
  const [bomForm, setBomForm] = useState({ productoCodigo: '', version: '1.0', nombre: '', tipo: 'produccion' as BOM['tipo'], cantidadBase: 1, costoManoObra: 0, costoOverhead: 0, tiempoEnsamblajeMinutos: 0, notas: '' });
  const [bomItems, setBomItems] = useState<BOMItem[]>([]);
  const [newItem, setNewItem] = useState({ componenteCodigo: '', cantidad: 1, esCritico: false });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [bomsRes, productosRes] = await Promise.all([
      supabase.from('bom').select('*, producto:productos(codigo, descripcion, precio), items:bom_items(*, componente:productos(codigo, descripcion, precio, costo_promedio, stock, stock_minimo))').order('created_at', { ascending: false }),
      supabase.from('productos').select('*').order('descripcion')
    ]);
    if (bomsRes.data) setBoms(bomsRes.data.map((b: any) => ({ id: b.id, productoCodigo: b.producto_codigo, version: b.version, nombre: b.nombre, estado: b.estado, tipo: b.tipo, cantidadBase: b.cantidad_base, costoMateriales: parseFloat(b.costo_materiales) || 0, costoManoObra: parseFloat(b.costo_mano_obra) || 0, costoOverhead: parseFloat(b.costo_overhead) || 0, costoTotal: parseFloat(b.costo_total) || 0, tiempoEnsamblajeMinutos: b.tiempo_ensamblaje_minutos, notas: b.notas, esPrincipal: b.es_principal, producto: b.producto, items: (b.items || []).map((i: any) => ({ id: i.id, componenteCodigo: i.componente_codigo, componenteDescripcion: i.componente_descripcion, cantidad: parseFloat(i.cantidad) || 0, secuencia: i.secuencia, nivel: i.nivel || 1, esCritico: i.es_critico, costoUnitario: parseFloat(i.costo_unitario) || 0, costoTotal: parseFloat(i.costo_total) || 0, componente: i.componente ? { codigo: i.componente.codigo, descripcion: i.componente.descripcion, precio: parseFloat(i.componente.precio) || 0, costoPromedio: parseFloat(i.componente.costo_promedio) || 0, stock: i.componente.stock || 0, stockMinimo: i.componente.stock_minimo || 0 } : undefined })) })));
    if (productosRes.data) setProductos(productosRes.data.map((p: any) => ({ codigo: p.codigo, descripcion: p.descripcion, precio: parseFloat(p.precio) || 0, costoPromedio: parseFloat(p.costo_promedio) || 0, stock: p.stock || 0, stockMinimo: p.stock_minimo || 0 })));
    setLoading(false);
  };

  const bomsFiltrados = useMemo(() => boms.filter(b => { if (searchTerm && !b.producto?.descripcion?.toLowerCase().includes(searchTerm.toLowerCase()) && !b.productoCodigo?.toLowerCase().includes(searchTerm.toLowerCase())) return false; if (filterEstado !== 'todos' && b.estado !== filterEstado) return false; if (filterTipo !== 'todos' && b.tipo !== filterTipo) return false; return true; }), [boms, searchTerm, filterEstado, filterTipo]);
  const stats = useMemo(() => ({ total: boms.length, activos: boms.filter(b => b.estado === 'activo').length, borradores: boms.filter(b => b.estado === 'borrador').length, costoPromedio: boms.length > 0 ? boms.reduce((s, b) => s + (b.costoTotal || 0), 0) / boms.length : 0, totalComponentes: boms.reduce((s, b) => s + (b.items?.length || 0), 0) }), [boms]);
  const calcularCostos = useCallback(() => { const m = bomItems.reduce((s, i) => s + (i.costoTotal || 0), 0); return { costoMateriales: m, costoTotal: m + bomForm.costoManoObra + bomForm.costoOverhead }; }, [bomItems, bomForm.costoManoObra, bomForm.costoOverhead]);
  const bomsQueUsanComponente = useMemo(() => !whereUsedCodigo ? [] : boms.filter(b => b.items?.some(i => i.componenteCodigo === whereUsedCodigo)), [boms, whereUsedCodigo]);

  const agregarItem = () => { if (!newItem.componenteCodigo) return; const c = productos.find(p => p.codigo === newItem.componenteCodigo); if (!c || bomItems.some(i => i.componenteCodigo === newItem.componenteCodigo)) return; const cu = c.costoPromedio || c.precio; setBomItems([...bomItems, { componenteCodigo: c.codigo, componenteDescripcion: c.descripcion, cantidad: newItem.cantidad, esCritico: newItem.esCritico, costoUnitario: cu, costoTotal: cu * newItem.cantidad, secuencia: bomItems.length + 1, nivel: 1, componente: { codigo: c.codigo, descripcion: c.descripcion, precio: c.precio, costoPromedio: c.costoPromedio || 0, stock: c.stock, stockMinimo: c.stockMinimo } }]); setNewItem({ componenteCodigo: '', cantidad: 1, esCritico: false }); };
  const actualizarItem = (idx: number, u: Partial<BOMItem>) => setBomItems(bomItems.map((it, i) => i !== idx ? it : { ...it, ...u, costoTotal: u.cantidad !== undefined ? (it.costoUnitario || 0) * u.cantidad : it.costoTotal }));
  const removerItem = (idx: number) => setBomItems(bomItems.filter((_, i) => i !== idx));

  const abrirCrear = () => { setBomForm({ productoCodigo: '', version: '1.0', nombre: '', tipo: 'produccion', cantidadBase: 1, costoManoObra: 0, costoOverhead: 0, tiempoEnsamblajeMinutos: 0, notas: '' }); setBomItems([]); setSelectedBOM(null); setModalType('create'); };
  const abrirEditar = (b: BOM) => { setBomForm({ productoCodigo: b.productoCodigo, version: b.version, nombre: b.nombre || '', tipo: b.tipo, cantidadBase: b.cantidadBase || 1, costoManoObra: b.costoManoObra || 0, costoOverhead: b.costoOverhead || 0, tiempoEnsamblajeMinutos: b.tiempoEnsamblajeMinutos || 0, notas: b.notas || '' }); setBomItems(b.items || []); setSelectedBOM(b); setModalType('edit'); };

  const guardarBOM = async () => {
    if (!bomForm.productoCodigo || !bomItems.length) { alert('Complete los campos'); return; }
    setSaving(true); const cs = calcularCostos();
    const data = { producto_codigo: bomForm.productoCodigo, version: bomForm.version, nombre: bomForm.nombre || null, estado: selectedBOM?.estado || 'borrador', tipo: bomForm.tipo, cantidad_base: bomForm.cantidadBase, costo_materiales: cs.costoMateriales, costo_mano_obra: bomForm.costoManoObra, costo_overhead: bomForm.costoOverhead, costo_total: cs.costoTotal, tiempo_ensamblaje_minutos: bomForm.tiempoEnsamblajeMinutos || null, notas: bomForm.notas || null, es_principal: true, actualizado_por: user?.email };
    try {
      let id: string;
      if (selectedBOM) { await supabase.from('bom').update(data).eq('id', selectedBOM.id); id = selectedBOM.id; await supabase.from('bom_items').delete().eq('bom_id', id); }
      else { const { data: d } = await supabase.from('bom').insert([{ ...data, creado_por: user?.email }]).select().single(); id = d.id; }
      await supabase.from('bom_items').insert(bomItems.map((it, idx) => ({ bom_id: id, componente_codigo: it.componenteCodigo, componente_descripcion: it.componenteDescripcion, cantidad: it.cantidad, secuencia: idx + 1, nivel: 1, es_critico: it.esCritico, costo_unitario: it.costoUnitario, costo_total: it.costoTotal })));
      alert(selectedBOM ? 'Actualizado' : 'Creado'); setModalType(null); loadData();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  const cambiarEstado = async (id: string, e: BOM['estado']) => { await supabase.from('bom').update({ estado: e, ...(e === 'activo' ? { fecha_aprobacion: new Date().toISOString(), aprobado_por: user?.email } : {}) }).eq('id', id); loadData(); };
  const duplicar = async (b: BOM) => { const vs = boms.filter(x => x.productoCodigo === b.productoCodigo).map(x => parseFloat(x.version)).filter(v => !isNaN(v)); const nv = (vs.length ? Math.max(...vs) + 0.1 : 1).toFixed(1); const { data } = await supabase.from('bom').insert([{ producto_codigo: b.productoCodigo, version: nv, nombre: `${b.nombre || ''} (Copia)`.trim(), estado: 'borrador', tipo: b.tipo, cantidad_base: b.cantidadBase, costo_materiales: b.costoMateriales, costo_mano_obra: b.costoManoObra, costo_overhead: b.costoOverhead, costo_total: b.costoTotal, tiempo_ensamblaje_minutos: b.tiempoEnsamblajeMinutos, notas: b.notas, creado_por: user?.email }]).select().single(); if (b.items?.length) await supabase.from('bom_items').insert(b.items.map(i => ({ bom_id: data.id, componente_codigo: i.componenteCodigo, componente_descripcion: i.componenteDescripcion, cantidad: i.cantidad, secuencia: i.secuencia, nivel: i.nivel, es_critico: i.esCritico, costo_unitario: i.costoUnitario, costo_total: i.costoTotal }))); alert(`Duplicado v${nv}`); loadData(); };
  const eliminar = async (id: string) => { if (!confirm('¿Eliminar?')) return; await supabase.from('bom').delete().eq('id', id); loadData(); };

  const getEC = (e: BOM['estado']) => ({ borrador: { c: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', l: 'Borrador' }, activo: { c: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', l: 'Activo' }, obsoleto: { c: 'bg-slate-500/20 text-slate-400 border-slate-500/30', l: 'Obsoleto' }, revision: { c: 'bg-blue-500/20 text-blue-400 border-blue-500/30', l: 'En Revisión' } }[e] || { c: '', l: e });
  const getTC = (t: BOM['tipo']) => ({ produccion: { c: 'text-emerald-400', l: 'Producción' }, ingenieria: { c: 'text-blue-400', l: 'Ingeniería' }, venta: { c: 'text-purple-400', l: 'Venta' }, servicio: { c: 'text-orange-400', l: 'Servicio' } }[t] || { c: '', l: t });
  const cs = calcularCostos();

  if (loading) return <div className="flex items-center justify-center p-12"><RefreshCw className="h-8 w-8 animate-spin text-emerald-400" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div><h2 className="text-2xl font-bold text-slate-100 flex items-center gap-3"><Boxes className="h-7 w-7 text-emerald-400" />Bill of Materials</h2><p className="text-slate-400 text-sm mt-1">Gestión de listas de materiales</p></div>
        <div className="flex gap-2"><button onClick={abrirCrear} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl"><Plus className="h-4 w-4" />Nuevo BOM</button><button onClick={loadData} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl"><RefreshCw className="h-4 w-4 text-slate-400" /></button></div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[{ l: 'Total', v: stats.total, i: Boxes, c: 'blue' }, { l: 'Activos', v: stats.activos, i: CheckCircle, c: 'emerald' }, { l: 'Borradores', v: stats.borradores, i: Edit3, c: 'yellow' }, { l: 'Componentes', v: stats.totalComponentes, i: Package, c: 'purple' }, { l: 'Costo Prom.', v: `$${stats.costoPromedio.toFixed(0)}`, i: DollarSign, c: 'orange' }].map((s, i) => (
          <div key={i} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4"><div className="flex items-center gap-2 mb-2"><s.i className={`h-4 w-4 text-${s.c}-400`} /><span className="text-xs text-slate-500">{s.l}</span></div><div className={`text-2xl font-bold text-${s.c}-400`}>{s.v}</div></div>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" /><input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none" /></div>
        <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-100"><option value="todos">Todos estados</option><option value="borrador">Borrador</option><option value="activo">Activo</option><option value="obsoleto">Obsoleto</option></select>
        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-100"><option value="todos">Todos tipos</option><option value="produccion">Producción</option><option value="ingenieria">Ingeniería</option></select>
        <div className="flex bg-slate-800/50 rounded-xl p-1">{[{ m: 'table' as const, i: Layers }, { m: 'cards' as const, i: Package }].map(({ m, i: I }) => <button key={m} onClick={() => setViewMode(m)} className={cn('p-2 rounded-lg', viewMode === m ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400')}><I className="h-4 w-4" /></button>)}</div>
      </div>

      {/* Tabla */}
      {viewMode === 'table' && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-800/50"><tr>{['Producto', 'Versión', 'Tipo', 'Estado', 'Items', 'Costo', 'Acciones'].map(h => <th key={h} className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-800/50">
              {bomsFiltrados.map(b => { const ec = getEC(b.estado), tc = getTC(b.tipo), exp = expandedRows.has(b.id); return (
                <React.Fragment key={b.id}>
                  <tr className="hover:bg-slate-800/30">
                    <td className="px-6 py-4"><div className="flex items-center gap-3"><button onClick={() => { const n = new Set(expandedRows); exp ? n.delete(b.id) : n.add(b.id); setExpandedRows(n); }} className="p-1 hover:bg-slate-700 rounded">{exp ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}</button><div><div className="text-slate-200 font-medium">{b.producto?.descripcion}</div><div className="text-xs text-slate-500">{b.productoCodigo}</div></div></div></td>
                    <td className="px-6 py-4"><span className="font-mono text-sm text-slate-300 bg-slate-800 px-2 py-1 rounded">v{b.version}</span></td>
                    <td className="px-6 py-4"><span className={cn('text-sm', tc.c)}>{tc.l}</span></td>
                    <td className="px-6 py-4"><span className={cn('px-2 py-1 rounded-lg text-xs border', ec.c)}>{ec.l}</span></td>
                    <td className="px-6 py-4 text-center text-slate-300">{b.items?.length || 0}</td>
                    <td className="px-6 py-4 text-right font-mono text-emerald-400">${(b.costoTotal || 0).toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setSelectedBOM(b); setModalType('view'); }} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Ver"><Eye className="h-4 w-4 text-blue-400" /></button>
                        <button onClick={() => abrirEditar(b)} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Editar"><Edit3 className="h-4 w-4 text-amber-400" /></button>
                        {b.estado === 'borrador' && <button onClick={() => cambiarEstado(b.id, 'activo')} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Activar"><CheckCircle className="h-4 w-4 text-emerald-400" /></button>}
                        {b.estado === 'activo' && <button onClick={() => cambiarEstado(b.id, 'obsoleto')} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Obsoleto"><Archive className="h-4 w-4 text-slate-400" /></button>}
                        <button onClick={() => { setCompareBOMs([b, null]); setModalType('compare'); }} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Comparar"><ArrowLeftRight className="h-4 w-4 text-cyan-400" /></button>
                        <button onClick={() => duplicar(b)} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Duplicar"><Copy className="h-4 w-4 text-purple-400" /></button>
                        <button onClick={() => eliminar(b.id)} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Eliminar"><Trash2 className="h-4 w-4 text-red-400" /></button>
                      </div>
                    </td>
                  </tr>
                  {exp && <tr><td colSpan={7} className="px-6 py-4 bg-slate-800/20">
                    <div className="ml-8"><h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2"><GitBranch className="h-4 w-4 text-emerald-400" />Componentes</h4>
                      <div className="space-y-2">{b.items?.map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                          <div className="flex items-center gap-4"><span className="text-xs text-slate-500 w-6">{idx + 1}</span><div><div className="text-sm text-slate-200">{it.componenteDescripcion}</div><div className="text-xs text-slate-500">{it.componenteCodigo}{it.esCritico && <span className="ml-2 text-red-400">● Crítico</span>}</div></div></div>
                          <div className="flex items-center gap-6"><div className="text-right"><div className="text-sm text-slate-300">{it.cantidad} uds</div><div className="text-xs text-slate-500">${(it.costoUnitario || 0).toFixed(2)} c/u</div></div><div className="font-mono text-emerald-400">${(it.costoTotal || 0).toFixed(2)}</div><button onClick={() => { setWhereUsedCodigo(it.componenteCodigo); setModalType('whereUsed'); }} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Donde se usa"><Target className="h-4 w-4 text-cyan-400" /></button></div>
                        </div>
                      ))}</div>
                    </div>
                  </td></tr>}
                </React.Fragment>
              ); })}
            </tbody>
          </table>
          {!bomsFiltrados.length && <div className="text-center py-12 text-slate-500"><Boxes className="mx-auto h-12 w-12 mb-2" /><p>No hay BOMs</p></div>}
        </div>
      )}

      {/* Cards */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bomsFiltrados.map(b => { const ec = getEC(b.estado), tc = getTC(b.tipo); return (
            <div key={b.id} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
              <div className="flex justify-between mb-4"><div><h3 className="font-semibold text-slate-200 truncate">{b.producto?.descripcion}</h3><p className="text-xs text-slate-500">{b.productoCodigo}</p></div><span className="font-mono text-sm text-slate-400 bg-slate-800 px-2 py-0.5 rounded h-fit">v{b.version}</span></div>
              <div className="flex gap-2 mb-4"><span className={cn('px-2 py-1 rounded-lg text-xs border', ec.c)}>{ec.l}</span><span className={cn('text-xs', tc.c)}>{tc.l}</span></div>
              <div className="grid grid-cols-3 gap-2 mb-4">{[{ l: 'Items', v: b.items?.length || 0, c: 'slate' }, { l: 'Costo', v: `$${(b.costoTotal || 0).toFixed(0)}`, c: 'emerald' }, { l: 'Min', v: b.tiempoEnsamblajeMinutos || 0, c: 'blue' }].map((s, i) => <div key={i} className="bg-slate-800/30 rounded-lg p-2 text-center"><div className={`text-lg font-bold text-${s.c}-400`}>{s.v}</div><div className="text-xs text-slate-500">{s.l}</div></div>)}</div>
              <div className="flex gap-2 pt-3 border-t border-slate-800/50"><button onClick={() => { setSelectedBOM(b); setModalType('view'); }} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 flex items-center justify-center gap-1"><Eye className="h-4 w-4" />Ver</button><button onClick={() => abrirEditar(b)} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 flex items-center justify-center gap-1"><Edit3 className="h-4 w-4" />Editar</button><button onClick={() => duplicar(b)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400"><Copy className="h-4 w-4" /></button></div>
            </div>
          ); })}
        </div>
      )}

      {/* Modal Crear/Editar */}
      {(modalType === 'create' || modalType === 'edit') && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between mb-6"><h3 className="text-xl font-bold text-slate-100 flex items-center gap-2"><Boxes className="h-5 w-5 text-emerald-400" />{modalType === 'create' ? 'Nuevo BOM' : 'Editar BOM'}</h3><button onClick={() => setModalType(null)} className="p-2 hover:bg-slate-800 rounded-lg"><X className="h-5 w-5 text-slate-400" /></button></div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-semibold text-slate-300 flex items-center gap-2"><FileText className="h-4 w-4" />Info General</h4>
                <div><label className="block text-sm text-slate-400 mb-1">Producto *</label><select value={bomForm.productoCodigo} onChange={e => setBomForm({ ...bomForm, productoCodigo: e.target.value })} disabled={modalType === 'edit'} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 disabled:opacity-50"><option value="">Seleccionar</option>{productos.map(p => <option key={p.codigo} value={p.codigo}>{p.codigo} - {p.descripcion}</option>)}</select></div>
                <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm text-slate-400 mb-1">Versión</label><input value={bomForm.version} onChange={e => setBomForm({ ...bomForm, version: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" /></div><div><label className="block text-sm text-slate-400 mb-1">Tipo</label><select value={bomForm.tipo} onChange={e => setBomForm({ ...bomForm, tipo: e.target.value as BOM['tipo'] })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"><option value="produccion">Producción</option><option value="ingenieria">Ingeniería</option></select></div></div>
                <div className="grid grid-cols-3 gap-4"><div><label className="block text-sm text-slate-400 mb-1">Mano Obra $</label><input type="number" value={bomForm.costoManoObra} onChange={e => setBomForm({ ...bomForm, costoManoObra: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" /></div><div><label className="block text-sm text-slate-400 mb-1">Overhead $</label><input type="number" value={bomForm.costoOverhead} onChange={e => setBomForm({ ...bomForm, costoOverhead: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" /></div><div><label className="block text-sm text-slate-400 mb-1">Tiempo min</label><input type="number" value={bomForm.tiempoEnsamblajeMinutos} onChange={e => setBomForm({ ...bomForm, tiempoEnsamblajeMinutos: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" /></div></div>
                <div><label className="block text-sm text-slate-400 mb-1">Notas</label><textarea value={bomForm.notas} onChange={e => setBomForm({ ...bomForm, notas: e.target.value })} rows={2} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 resize-none" /></div>
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4"><h5 className="font-semibold text-emerald-400 text-sm mb-3 flex items-center gap-2"><DollarSign className="h-4 w-4" />Costos</h5><div className="space-y-1 text-sm"><div className="flex justify-between text-slate-300"><span>Materiales ({bomItems.length}):</span><span className="font-mono">${cs.costoMateriales.toFixed(2)}</span></div><div className="flex justify-between text-slate-300"><span>Mano Obra:</span><span className="font-mono">${bomForm.costoManoObra.toFixed(2)}</span></div><div className="flex justify-between text-slate-300"><span>Overhead:</span><span className="font-mono">${bomForm.costoOverhead.toFixed(2)}</span></div><div className="flex justify-between pt-2 border-t border-emerald-500/30 font-bold text-emerald-400"><span>TOTAL:</span><span className="font-mono">${cs.costoTotal.toFixed(2)}</span></div></div></div>
              </div>
              <div className="space-y-4">
                <h4 className="font-semibold text-slate-300 flex items-center gap-2"><Package className="h-4 w-4" />Componentes</h4>
                <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
                  <select value={newItem.componenteCodigo} onChange={e => setNewItem({ ...newItem, componenteCodigo: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm"><option value="">Seleccionar componente</option>{productos.filter(p => p.codigo !== bomForm.productoCodigo && !bomItems.some(i => i.componenteCodigo === p.codigo)).map(p => <option key={p.codigo} value={p.codigo}>{p.codigo} - {p.descripcion} (${(p.costoPromedio || p.precio).toFixed(2)})</option>)}</select>
                  <div className="flex gap-2"><input type="number" min="1" value={newItem.cantidad} onChange={e => setNewItem({ ...newItem, cantidad: parseInt(e.target.value) || 1 })} className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm" /><label className="flex items-center gap-2 text-sm text-slate-400 px-3"><input type="checkbox" checked={newItem.esCritico} onChange={e => setNewItem({ ...newItem, esCritico: e.target.checked })} />Crítico</label></div>
                  <button onClick={agregarItem} disabled={!newItem.componenteCodigo} className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm flex items-center justify-center gap-2"><Plus className="h-4 w-4" />Agregar</button>
                </div>
                <div className="border border-slate-700 rounded-xl max-h-[350px] overflow-y-auto">
                  {!bomItems.length ? <div className="p-8 text-center text-slate-500"><Package className="mx-auto h-10 w-10 mb-2" /><p className="text-sm">Agregue componentes</p></div> : bomItems.map((it, idx) => (
                    <div key={idx} className="p-3 border-b border-slate-700 last:border-0 flex items-center justify-between">
                      <div><div className="text-sm text-slate-200 flex items-center gap-2">{it.componenteDescripcion}{it.esCritico && <AlertTriangle className="h-3 w-3 text-red-400" />}</div><div className="text-xs text-slate-500">{it.componenteCodigo}</div></div>
                      <div className="flex items-center gap-3"><input type="number" min="1" value={it.cantidad} onChange={e => actualizarItem(idx, { cantidad: parseInt(e.target.value) || 1 })} className="w-16 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm text-center" /><div className="text-right min-w-[60px]"><div className="text-sm font-mono text-emerald-400">${(it.costoTotal || 0).toFixed(2)}</div></div><button onClick={() => removerItem(idx)} className="p-1 hover:bg-red-500/20 rounded"><X className="h-4 w-4 text-red-400" /></button></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700"><button onClick={guardarBOM} disabled={saving || !bomForm.productoCodigo || !bomItems.length} className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2">{saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{modalType === 'create' ? 'Crear' : 'Guardar'}</button><button onClick={() => setModalType(null)} className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Cancelar</button></div>
          </div>
        </div>
      )}

      {/* Modal Ver */}
      {modalType === 'view' && selectedBOM && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between mb-6"><div><h3 className="text-xl font-bold text-slate-100">{selectedBOM.producto?.descripcion}</h3><div className="flex items-center gap-3 mt-2"><span className="font-mono text-sm text-slate-400 bg-slate-800 px-2 py-1 rounded">v{selectedBOM.version}</span><span className={cn('px-2 py-1 rounded-lg text-xs border', getEC(selectedBOM.estado).c)}>{getEC(selectedBOM.estado).l}</span></div></div><button onClick={() => setModalType(null)} className="p-2 hover:bg-slate-800 rounded-lg"><X className="h-5 w-5 text-slate-400" /></button></div>
            <div className="grid grid-cols-4 gap-4 mb-6">{[{ l: 'Costo Total', v: `$${(selectedBOM.costoTotal || 0).toLocaleString()}`, c: 'emerald', i: DollarSign }, { l: 'Componentes', v: selectedBOM.items?.length || 0, c: 'blue', i: Package }, { l: 'Tiempo', v: `${selectedBOM.tiempoEnsamblajeMinutos || 0} min`, c: 'purple', i: Clock }, { l: 'Cantidad Base', v: selectedBOM.cantidadBase || 1, c: 'orange', i: Target }].map((s, i) => <div key={i} className="bg-slate-800/30 rounded-xl p-4"><div className="flex items-center gap-2 text-slate-500 text-xs mb-1"><s.i className="h-4 w-4" />{s.l}</div><div className={`text-2xl font-bold text-${s.c}-400`}>{s.v}</div></div>)}</div>
            <div className="mb-6"><h4 className="font-semibold text-slate-300 mb-3 flex items-center gap-2"><GitBranch className="h-4 w-4 text-emerald-400" />Lista de Materiales</h4>
              <table className="w-full text-sm border border-slate-700 rounded-xl overflow-hidden"><thead className="bg-slate-800/50"><tr>{['#', 'Componente', 'Cantidad', 'Costo Unit.', 'Costo Total', 'Stock'].map(h => <th key={h} className="px-4 py-3 text-left text-slate-400">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-700">{selectedBOM.items?.map((it, idx) => <tr key={idx} className="hover:bg-slate-800/30"><td className="px-4 py-3 text-slate-500">{idx + 1}</td><td className="px-4 py-3"><div className="text-slate-200">{it.componenteDescripcion}</div><div className="text-xs text-slate-500">{it.componenteCodigo}{it.esCritico && <span className="ml-2 text-red-400">● Crítico</span>}</div></td><td className="px-4 py-3 text-slate-300">{it.cantidad}</td><td className="px-4 py-3 font-mono text-slate-400">${(it.costoUnitario || 0).toFixed(2)}</td><td className="px-4 py-3 font-mono text-emerald-400">${(it.costoTotal || 0).toFixed(2)}</td><td className="px-4 py-3"><span className={cn('font-mono', it.componente && it.componente.stock <= it.componente.stockMinimo ? 'text-red-400' : 'text-slate-300')}>{it.componente?.stock || 0}</span></td></tr>)}</tbody></table>
            </div>
            {selectedBOM.notas && <div className="bg-slate-800/20 rounded-xl p-4 mb-6"><h5 className="text-sm font-semibold text-slate-400 mb-2">Notas</h5><p className="text-sm text-slate-300">{selectedBOM.notas}</p></div>}
            <div className="flex gap-3 pt-4 border-t border-slate-700"><button onClick={() => { setModalType(null); abrirEditar(selectedBOM); }} className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl flex items-center justify-center gap-2"><Edit3 className="h-4 w-4" />Editar</button><button onClick={() => duplicar(selectedBOM)} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl flex items-center justify-center gap-2"><Copy className="h-4 w-4" />Duplicar</button><button onClick={() => setModalType(null)} className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Cerrar</button></div>
          </div>
        </div>
      )}

      {/* Modal Donde se usa */}
      {modalType === 'whereUsed' && whereUsedCodigo && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex justify-between mb-6"><div><h3 className="text-xl font-bold text-slate-100 flex items-center gap-2"><Target className="h-5 w-5 text-cyan-400" />Donde se usa</h3><p className="text-sm text-slate-400 mt-1">Componente: <span className="text-slate-200">{whereUsedCodigo}</span></p></div><button onClick={() => setModalType(null)} className="p-2 hover:bg-slate-800 rounded-lg"><X className="h-5 w-5 text-slate-400" /></button></div>
            {!bomsQueUsanComponente.length ? <div className="text-center py-8 text-slate-500"><Info className="h-12 w-12 mx-auto mb-2" /><p>No se usa en ningún BOM</p></div> : <div className="space-y-3">{bomsQueUsanComponente.map(b => { const it = b.items?.find(i => i.componenteCodigo === whereUsedCodigo); return <div key={b.id} className="p-4 bg-slate-800/30 rounded-xl hover:bg-slate-800/50 cursor-pointer" onClick={() => { setSelectedBOM(b); setModalType('view'); }}><div className="flex justify-between"><div><div className="font-medium text-slate-200">{b.producto?.descripcion}</div><div className="text-sm text-slate-500">{b.productoCodigo} • v{b.version}</div></div><div className="text-right"><div className="text-sm text-slate-300">Cant: <span className="font-mono">{it?.cantidad}</span></div><span className={cn('text-xs', getEC(b.estado).c)}>{getEC(b.estado).l}</span></div></div></div>; })}</div>}
            <button onClick={() => setModalType(null)} className="w-full mt-6 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Cerrar</button>
          </div>
        </div>
      )}

      {/* Modal Comparar */}
      {modalType === 'compare' && compareBOMs[0] && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between mb-6"><h3 className="text-xl font-bold text-slate-100 flex items-center gap-2"><ArrowLeftRight className="h-5 w-5 text-cyan-400" />Comparar Versiones</h3><button onClick={() => setModalType(null)} className="p-2 hover:bg-slate-800 rounded-lg"><X className="h-5 w-5 text-slate-400" /></button></div>
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div><label className="block text-sm text-slate-400 mb-2">Versión Base</label><div className="p-3 bg-slate-800/50 rounded-xl"><div className="font-medium text-slate-200">{compareBOMs[0].producto?.descripcion}</div><div className="text-sm text-slate-400">v{compareBOMs[0].version} • {compareBOMs[0].items?.length || 0} items</div></div></div>
              <div><label className="block text-sm text-slate-400 mb-2">Comparar con</label><select value={compareBOMs[1]?.id || ''} onChange={e => setCompareBOMs([compareBOMs[0], boms.find(x => x.id === e.target.value) || null])} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"><option value="">Seleccionar</option>{boms.filter(b => b.productoCodigo === compareBOMs[0]?.productoCodigo && b.id !== compareBOMs[0]?.id).map(b => <option key={b.id} value={b.id}>v{b.version} - {b.items?.length || 0} items - ${(b.costoTotal || 0).toFixed(2)}</option>)}</select></div>
            </div>
            {compareBOMs[1] && <>
              <div className="grid grid-cols-3 gap-4 mb-6">{[{ l: 'Dif. Costo', v: ((compareBOMs[1].costoTotal || 0) - (compareBOMs[0]?.costoTotal || 0)), c: (compareBOMs[1].costoTotal || 0) > (compareBOMs[0]?.costoTotal || 0) ? 'red' : 'emerald', f: (v: number) => `${v > 0 ? '+' : ''}$${v.toFixed(2)}` }, { l: 'Dif. Items', v: (compareBOMs[1].items?.length || 0) - (compareBOMs[0]?.items?.length || 0), c: 'blue', f: (v: number) => v.toString() }, { l: 'Dif. Tiempo', v: (compareBOMs[1].tiempoEnsamblajeMinutos || 0) - (compareBOMs[0]?.tiempoEnsamblajeMinutos || 0), c: 'purple', f: (v: number) => `${v} min` }].map((s, i) => <div key={i} className="bg-slate-800/30 rounded-xl p-4 text-center"><div className="text-sm text-slate-500 mb-1">{s.l}</div><div className={`text-xl font-bold text-${s.c}-400`}>{s.f(s.v)}</div></div>)}</div>
              <table className="w-full text-sm border border-slate-700 rounded-xl overflow-hidden"><thead className="bg-slate-800/50"><tr>{['Componente', `v${compareBOMs[0]?.version}`, `v${compareBOMs[1].version}`, 'Cambio'].map(h => <th key={h} className="px-4 py-3 text-left text-slate-400">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-700">
                {(() => { const all = new Set([...(compareBOMs[0]?.items?.map(i => i.componenteCodigo) || []), ...(compareBOMs[1].items?.map(i => i.componenteCodigo) || [])]); return Array.from(all).map(cod => { const i1 = compareBOMs[0]?.items?.find(i => i.componenteCodigo === cod), i2 = compareBOMs[1]!.items?.find(i => i.componenteCodigo === cod); let cambio = '', cc = ''; if (!i1) { cambio = 'AGREGADO'; cc = 'text-emerald-400 bg-emerald-500/20'; } else if (!i2) { cambio = 'ELIMINADO'; cc = 'text-red-400 bg-red-500/20'; } else if (i1.cantidad !== i2.cantidad) { cambio = `${i2.cantidad > i1.cantidad ? '+' : ''}${i2.cantidad - i1.cantidad}`; cc = 'text-amber-400 bg-amber-500/20'; } else { cambio = '—'; cc = 'text-slate-500'; } return <tr key={cod}><td className="px-4 py-3"><div className="text-slate-200">{i1?.componenteDescripcion || i2?.componenteDescripcion}</div><div className="text-xs text-slate-500">{cod}</div></td><td className="px-4 py-3 text-slate-300">{i1?.cantidad || '—'}</td><td className="px-4 py-3 text-slate-300">{i2?.cantidad || '—'}</td><td className="px-4 py-3"><span className={cn('px-2 py-1 rounded text-xs', cc)}>{cambio}</span></td></tr>; }); })()}
              </tbody></table>
            </>}
            <button onClick={() => setModalType(null)} className="w-full mt-6 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
