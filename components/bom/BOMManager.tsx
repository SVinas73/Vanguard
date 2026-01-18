'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Boxes, Plus, RefreshCw, Search, Eye, Trash2, Copy,
  CheckCircle, Save, X, Package, Clock, DollarSign
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { BOM, BOMItem, Product, EstadoBOM, TipoBOM } from '@/types';

export default function BOMManager() {
  const { user } = useAuth();

  const [boms, setBoms] = useState<BOM[]>([]);
  const [productos, setProductos] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState<EstadoBOM | 'todos'>('todos');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedBOM, setSelectedBOM] = useState<BOM | null>(null);

  const [bomForm, setBomForm] = useState({
    productoCodigo: '',
    version: '1.0',
    nombre: '',
    tipo: 'produccion' as TipoBOM,
    cantidadBase: 1,
    costoManoObra: 0,
    costoOverhead: 0,
    tiempoEnsamblajeMinutos: 0,
  });

  const [bomItems, setBomItems] = useState<Partial<BOMItem>[]>([]);
  const [newItem, setNewItem] = useState({ componenteCodigo: '', cantidad: 1, esCritico: false });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: bomsData } = await supabase
        .from('bom')
        .select(`*, producto:productos(codigo, descripcion, precio), items:bom_items(*, componente:productos(codigo, descripcion, precio, costo_promedio))`)
        .order('created_at', { ascending: false });
      setBoms(bomsData || []);

      const { data: productosData } = await supabase.from('productos').select('*').order('descripcion');
      setProductos(productosData || []);
    } catch (error) {
      console.error('Error loading BOMs:', error);
    } finally {
      setLoading(false);
    }
  };

  const bomsFiltrados = useMemo(() => {
    return boms.filter((bom) => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!bom.producto?.descripcion?.toLowerCase().includes(search) && !bom.version?.toLowerCase().includes(search)) return false;
      }
      if (filterEstado !== 'todos' && bom.estado !== filterEstado) return false;
      return true;
    });
  }, [boms, searchTerm, filterEstado]);

  const stats = useMemo(() => ({
    total: boms.length,
    activos: boms.filter((b) => b.estado === 'activo').length,
    borradores: boms.filter((b) => b.estado === 'borrador').length,
    costoPromedio: boms.length > 0 ? boms.reduce((sum, b) => sum + (b.costoTotal || 0), 0) / boms.length : 0,
  }), [boms]);

  const agregarItem = () => {
    if (!newItem.componenteCodigo || newItem.cantidad < 1) return;
    const componente = productos.find((p) => p.codigo === newItem.componenteCodigo);
    if (!componente) return;
    const costoUnitario = componente.costoPromedio || componente.precio || 0;
    setBomItems([...bomItems, {
      componenteCodigo: newItem.componenteCodigo,
      componenteDescripcion: componente.descripcion,
      cantidad: newItem.cantidad,
      esCritico: newItem.esCritico,
      costoUnitario,
      costoTotal: costoUnitario * newItem.cantidad,
      secuencia: bomItems.length + 1,
      nivel: 1,
    }]);
    setNewItem({ componenteCodigo: '', cantidad: 1, esCritico: false });
  };

  const removerItem = (index: number) => setBomItems(bomItems.filter((_, i) => i !== index));

  const calcularCostos = () => {
    const costoMateriales = bomItems.reduce((sum, item) => sum + (item.costoTotal || 0), 0);
    return { costoMateriales, costoTotal: costoMateriales + bomForm.costoManoObra + bomForm.costoOverhead };
  };

  const crearBOM = async () => {
    try {
      if (!bomForm.productoCodigo || bomItems.length === 0) { alert('Seleccione producto y agregue componentes'); return; }
      const costos = calcularCostos();
      const { data: bomCreado, error: bomError } = await supabase
        .from('bom')
        .insert([{
          producto_codigo: bomForm.productoCodigo,
          version: bomForm.version,
          nombre: bomForm.nombre,
          estado: 'borrador',
          tipo: bomForm.tipo,
          cantidad_base: bomForm.cantidadBase,
          costo_materiales: costos.costoMateriales,
          costo_mano_obra: bomForm.costoManoObra,
          costo_overhead: bomForm.costoOverhead,
          costo_total: costos.costoTotal,
          tiempo_ensamblaje_minutos: bomForm.tiempoEnsamblajeMinutos,
          es_principal: true,
          creado_por: user?.email,
        }])
        .select().single();
      if (bomError) throw bomError;

      const itemsData = bomItems.map((item, index) => ({
        bom_id: bomCreado.id,
        componente_codigo: item.componenteCodigo,
        componente_descripcion: item.componenteDescripcion,
        cantidad: item.cantidad,
        secuencia: index + 1,
        nivel: 1,
        es_critico: item.esCritico || false,
        costo_unitario: item.costoUnitario,
        costo_total: item.costoTotal,
      }));
      await supabase.from('bom_items').insert(itemsData);

      alert('BOM creado exitosamente');
      setShowCreateModal(false);
      setBomForm({ productoCodigo: '', version: '1.0', nombre: '', tipo: 'produccion', cantidadBase: 1, costoManoObra: 0, costoOverhead: 0, tiempoEnsamblajeMinutos: 0 });
      setBomItems([]);
      loadData();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const activarBOM = async (bomId: string) => {
    try {
      await supabase.from('bom').update({ estado: 'activo', fecha_aprobacion: new Date().toISOString(), aprobado_por: user?.email }).eq('id', bomId);
      alert('BOM activado');
      loadData();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const duplicarBOM = async (bom: BOM) => {
    try {
      const { data: bomCreado } = await supabase
        .from('bom')
        .insert([{
          producto_codigo: bom.productoCodigo,
          version: (parseFloat(bom.version) + 0.1).toFixed(1),
          nombre: `${bom.nombre || ''} (Copia)`,
          estado: 'borrador',
          tipo: bom.tipo,
          costo_materiales: bom.costoMateriales,
          costo_mano_obra: bom.costoManoObra,
          costo_overhead: bom.costoOverhead,
          costo_total: bom.costoTotal,
          tiempo_ensamblaje_minutos: bom.tiempoEnsamblajeMinutos,
          es_principal: false,
          creado_por: user?.email,
        }])
        .select().single();

      if (bom.items?.length) {
        const itemsData = bom.items.map((item: any) => ({
          bom_id: bomCreado.id,
          componente_codigo: item.componenteCodigo,
          componente_descripcion: item.componenteDescripcion,
          cantidad: item.cantidad,
          secuencia: item.secuencia,
          nivel: item.nivel,
          es_critico: item.esCritico,
          costo_unitario: item.costoUnitario,
          costo_total: item.costoTotal,
        }));
        await supabase.from('bom_items').insert(itemsData);
      }
      alert('BOM duplicado');
      loadData();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const eliminarBOM = async (bomId: string) => {
    if (!confirm('¿Eliminar este BOM?')) return;
    try {
      await supabase.from('bom').delete().eq('id', bomId);
      alert('BOM eliminado');
      loadData();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const getEstadoColor = (estado: EstadoBOM) => {
    const colors: Record<EstadoBOM, string> = {
      borrador: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      activo: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      obsoleto: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
      revision: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    };
    return colors[estado] || 'bg-slate-500/20 text-slate-400';
  };

  const costos = calcularCostos();

  if (loading) return <div className="flex items-center justify-center p-12"><RefreshCw className="h-8 w-8 animate-spin text-emerald-400" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <Boxes className="h-7 w-7 text-emerald-400" />
            Bill of Materials (BOM)
          </h2>
          <p className="text-slate-400 text-sm mt-1">Gestión de listas de materiales</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors">
            <Plus className="h-4 w-4" /> Nuevo BOM
          </button>
          <button onClick={loadData} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors">
            <RefreshCw className="h-4 w-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total BOMs', value: stats.total, color: 'blue' },
          { label: 'Activos', value: stats.activos, color: 'emerald' },
          { label: 'Borradores', value: stats.borradores, color: 'yellow' },
          { label: 'Costo Prom.', value: `$${stats.costoPromedio.toFixed(2)}`, color: 'purple' },
        ].map((stat, i) => (
          <div key={i} className={`bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 border-l-4 border-l-${stat.color}-500`}>
            <div className={`text-2xl font-bold text-${stat.color}-400`}>{stat.value}</div>
            <div className="text-sm text-slate-500">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
            <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none" />
          </div>
          <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value as EstadoBOM | 'todos')}
            className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-100 focus:border-emerald-500/50 focus:outline-none">
            <option value="todos">Todos</option>
            <option value="borrador">Borrador</option>
            <option value="activo">Activo</option>
            <option value="obsoleto">Obsoleto</option>
          </select>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Producto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Versión</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Componentes</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Costo Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {bomsFiltrados.map((bom) => (
                <tr key={bom.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-slate-200">{bom.producto?.descripcion}</div>
                    <div className="text-xs text-slate-500">{bom.productoCodigo}</div>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-slate-300">{bom.version}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-xs border ${getEstadoColor(bom.estado)}`}>{bom.estado.toUpperCase()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-sm text-slate-300">
                      <Package className="h-4 w-4 text-slate-500" /> {bom.items?.length || 0}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-200">${(bom.costoTotal || 0).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => { setSelectedBOM(bom); setShowViewModal(true); }} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Ver">
                        <Eye className="h-4 w-4 text-blue-400" />
                      </button>
                      {bom.estado === 'borrador' && (
                        <button onClick={() => activarBOM(bom.id)} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Activar">
                          <CheckCircle className="h-4 w-4 text-emerald-400" />
                        </button>
                      )}
                      <button onClick={() => duplicarBOM(bom)} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Duplicar">
                        <Copy className="h-4 w-4 text-purple-400" />
                      </button>
                      <button onClick={() => eliminarBOM(bom.id)} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Eliminar">
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {bomsFiltrados.length === 0 && (
            <div className="text-center py-12">
              <Boxes className="mx-auto h-12 w-12 text-slate-600" />
              <p className="mt-2 text-sm text-slate-500">No se encontraron BOMs</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Crear */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-2">
                <Boxes className="h-5 w-5 text-emerald-400" /> Crear Nuevo BOM
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Producto Final *</label>
                    <select value={bomForm.productoCodigo} onChange={(e) => setBomForm({ ...bomForm, productoCodigo: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                      <option value="">Seleccionar</option>
                      {productos.map((p) => <option key={p.codigo} value={p.codigo}>{p.codigo} - {p.descripcion}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Versión</label>
                      <input type="text" value={bomForm.version} onChange={(e) => setBomForm({ ...bomForm, version: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Tipo</label>
                      <select value={bomForm.tipo} onChange={(e) => setBomForm({ ...bomForm, tipo: e.target.value as TipoBOM })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                        <option value="produccion">Producción</option>
                        <option value="ingenieria">Ingeniería</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Mano Obra ($)</label>
                      <input type="number" value={bomForm.costoManoObra} onChange={(e) => setBomForm({ ...bomForm, costoManoObra: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Overhead ($)</label>
                      <input type="number" value={bomForm.costoOverhead} onChange={(e) => setBomForm({ ...bomForm, costoOverhead: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Tiempo (min)</label>
                      <input type="number" value={bomForm.tiempoEnsamblajeMinutos} onChange={(e) => setBomForm({ ...bomForm, tiempoEnsamblajeMinutos: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                    </div>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                    <h5 className="font-semibold text-emerald-400 text-sm mb-2">Resumen de Costos</h5>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between text-slate-300"><span>Materiales:</span><span>${costos.costoMateriales.toFixed(2)}</span></div>
                      <div className="flex justify-between text-slate-300"><span>Mano de Obra:</span><span>${bomForm.costoManoObra.toFixed(2)}</span></div>
                      <div className="flex justify-between text-slate-300"><span>Overhead:</span><span>${bomForm.costoOverhead.toFixed(2)}</span></div>
                      <div className="flex justify-between pt-2 border-t border-emerald-500/30 font-bold text-emerald-400"><span>TOTAL:</span><span>${costos.costoTotal.toFixed(2)}</span></div>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-semibold text-slate-300">Componentes</h4>
                  <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
                    <select value={newItem.componenteCodigo} onChange={(e) => setNewItem({ ...newItem, componenteCodigo: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm">
                      <option value="">Seleccionar componente</option>
                      {productos.map((p) => <option key={p.codigo} value={p.codigo}>{p.codigo} - {p.descripcion} (${p.costoPromedio || p.precio})</option>)}
                    </select>
                    <div className="flex gap-2">
                      <input type="number" value={newItem.cantidad} onChange={(e) => setNewItem({ ...newItem, cantidad: parseInt(e.target.value) || 1 })} placeholder="Cant."
                        className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm" />
                      <label className="flex items-center gap-2 text-sm text-slate-400">
                        <input type="checkbox" checked={newItem.esCritico} onChange={(e) => setNewItem({ ...newItem, esCritico: e.target.checked })} /> Crítico
                      </label>
                    </div>
                    <button onClick={agregarItem} className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm">
                      <Plus className="h-4 w-4 inline mr-1" /> Agregar
                    </button>
                  </div>
                  <div className="border border-slate-700 rounded-xl max-h-64 overflow-y-auto">
                    {bomItems.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-sm"><Package className="mx-auto h-8 w-8 mb-2 text-slate-600" />Sin componentes</div>
                    ) : (
                      <div className="divide-y divide-slate-700">
                        {bomItems.map((item, i) => (
                          <div key={i} className="p-3 flex items-center justify-between hover:bg-slate-800/30">
                            <div>
                              <div className="text-sm text-slate-200">{item.componenteDescripcion}</div>
                              <div className="text-xs text-slate-500">{item.componenteCodigo} • Cant: {item.cantidad} • ${(item.costoTotal || 0).toFixed(2)}</div>
                            </div>
                            <button onClick={() => removerItem(i)} className="p-1 hover:bg-slate-700 rounded"><X className="h-4 w-4 text-red-400" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
                <button onClick={crearBOM} disabled={!bomForm.productoCodigo || bomItems.length === 0}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl">
                  <Save className="h-4 w-4 inline mr-2" /> Crear BOM
                </button>
                <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ver */}
      {showViewModal && selectedBOM && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-100">{selectedBOM.producto?.descripcion}</h3>
                  <p className="text-sm text-slate-400">Versión {selectedBOM.version}</p>
                </div>
                <button onClick={() => setShowViewModal(false)} className="p-2 hover:bg-slate-700 rounded-xl"><X className="h-5 w-5 text-slate-400" /></button>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-800/30 rounded-xl p-4"><div className="text-xs text-slate-500">Costo Total</div><div className="text-lg font-bold text-emerald-400">${(selectedBOM.costoTotal || 0).toLocaleString()}</div></div>
                <div className="bg-slate-800/30 rounded-xl p-4"><div className="text-xs text-slate-500">Componentes</div><div className="text-lg font-bold text-blue-400">{selectedBOM.items?.length || 0}</div></div>
                <div className="bg-slate-800/30 rounded-xl p-4"><div className="text-xs text-slate-500">Tiempo</div><div className="text-lg font-bold text-purple-400">{selectedBOM.tiempoEnsamblajeMinutos} min</div></div>
              </div>
              <h4 className="font-semibold text-slate-300 mb-3">Componentes:</h4>
              <div className="border border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800/50">
                    <tr>
                      <th className="px-4 py-2 text-left text-slate-400">Componente</th>
                      <th className="px-4 py-2 text-left text-slate-400">Cantidad</th>
                      <th className="px-4 py-2 text-left text-slate-400">Costo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {selectedBOM.items?.map((item: any) => (
                      <tr key={item.id} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3"><div className="text-slate-200">{item.componenteDescripcion}</div><div className="text-xs text-slate-500">{item.componenteCodigo}</div></td>
                        <td className="px-4 py-3 text-slate-300">{item.cantidad}</td>
                        <td className="px-4 py-3 text-slate-200">${(item.costoTotal || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={() => setShowViewModal(false)} className="w-full mt-6 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}