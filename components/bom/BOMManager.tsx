'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Boxes, Plus, RefreshCw, Search, Edit2, Trash2, Eye,
  Save, X, CheckCircle, AlertCircle, DollarSign,
  Package, Clock, TrendingUp, Copy, FileText
} from 'lucide-react';
import { useSupabaseStore } from '@/store/supabase-store';
import { BOM, BOMItem, Product, EstadoBOM, TipoBOM } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function BOMManager() {
  const supabase = useSupabaseStore((state) => state.supabase);
  const usuario = useSupabaseStore((state) => state.user);

  // Estados
  const [boms, setBoms] = useState<BOM[]>([]);
  const [productos, setProductos] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState<EstadoBOM | 'todos'>('todos');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedBOM, setSelectedBOM] = useState<BOM | null>(null);

  // Estado para crear/editar BOM
  const [bomForm, setBomForm] = useState<Partial<BOM>>({
    productoCodigo: '',
    version: '1.0',
    nombre: '',
    descripcion: '',
    estado: 'borrador',
    tipo: 'produccion',
    cantidadBase: 1,
    unidadBase: 'unidad',
    costoManoObra: 0,
    costoOverhead: 0,
    tiempoSetupMinutos: 0,
    tiempoEnsamblajeMinutos: 0,
    requiereAprobacion: false,
    esPrincipal: true,
    instruccionesEnsamblaje: '',
  });

  // Items del BOM actual
  const [bomItems, setBomItems] = useState<Partial<BOMItem>[]>([]);

  // Nuevo item
  const [newItem, setNewItem] = useState<Partial<BOMItem>>({
    componenteCodigo: '',
    cantidad: 1,
    unidadMedida: 'unidad',
    cantidadDesperdicio: 0,
    nivel: 1,
    esCritico: false,
    puedeSustituir: false,
    secuencia: 1,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Cargar BOMs con items
      const { data: bomsData, error: bomsError } = await supabase
        .from('bom')
        .select(`
          *,
          producto:productos(codigo, descripcion, precio),
          items:bom_items(
            *,
            componente:productos(codigo, descripcion, precio, costo_promedio)
          )
        `)
        .order('created_at', { ascending: false });

      if (bomsError) throw bomsError;

      setBoms(bomsData || []);

      // Cargar productos
      const { data: productosData } = await supabase
        .from('productos')
        .select('*')
        .order('descripcion');

      setProductos(productosData || []);
    } catch (error) {
      console.error('Error loading BOMs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar BOMs
  const bomsFiltrados = useMemo(() => {
    return boms.filter((bom) => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchProducto = bom.producto?.descripcion?.toLowerCase().includes(search);
        const matchVersion = bom.version.toLowerCase().includes(search);
        const matchNombre = bom.nombre?.toLowerCase().includes(search);
        if (!matchProducto && !matchVersion && !matchNombre) return false;
      }

      if (filterEstado !== 'todos' && bom.estado !== filterEstado) {
        return false;
      }

      return true;
    });
  }, [boms, searchTerm, filterEstado]);

  // Estadísticas
  const stats = useMemo(() => {
    return {
      total: boms.length,
      activos: boms.filter((b) => b.estado === 'activo').length,
      borradores: boms.filter((b) => b.estado === 'borrador').length,
      obsoletos: boms.filter((b) => b.estado === 'obsoleto').length,
      costoPromedioMateriales: boms.reduce((sum, b) => sum + (b.costoMateriales || 0), 0) / (boms.length || 1),
    };
  }, [boms]);

  // Agregar item al BOM
  const agregarItem = () => {
    if (!newItem.componenteCodigo || !newItem.cantidad) {
      alert('Seleccione un componente y cantidad');
      return;
    }

    const componente = productos.find((p) => p.codigo === newItem.componenteCodigo);
    if (!componente) return;

    const costoUnitario = componente.costoPromedio || componente.precio || 0;
    const costoTotal = costoUnitario * (newItem.cantidad || 0);

    const item: Partial<BOMItem> = {
      ...newItem,
      componenteDescripcion: componente.descripcion,
      costoUnitario,
      costoTotal,
      secuencia: bomItems.length + 1,
    };

    setBomItems([...bomItems, item]);

    // Limpiar form
    setNewItem({
      componenteCodigo: '',
      cantidad: 1,
      unidadMedida: 'unidad',
      cantidadDesperdicio: 0,
      nivel: 1,
      esCritico: false,
      puedeSustituir: false,
    });
  };

  // Remover item
  const removerItem = (index: number) => {
    setBomItems(bomItems.filter((_, i) => i !== index));
  };

  // Calcular costos totales
  const calcularCostos = () => {
    const costoMateriales = bomItems.reduce((sum, item) => sum + (item.costoTotal || 0), 0);
    const costoManoObra = bomForm.costoManoObra || 0;
    const costoOverhead = bomForm.costoOverhead || 0;
    const costoTotal = costoMateriales + costoManoObra + costoOverhead;

    return { costoMateriales, costoManoObra, costoOverhead, costoTotal };
  };

  // Crear BOM
  const crearBOM = async () => {
    try {
      if (!bomForm.productoCodigo || bomItems.length === 0) {
        alert('Seleccione un producto y agregue al menos un componente');
        return;
      }

      const costos = calcularCostos();

      const bomData = {
        producto_codigo: bomForm.productoCodigo,
        version: bomForm.version,
        nombre: bomForm.nombre,
        descripcion: bomForm.descripcion,
        estado: bomForm.estado,
        tipo: bomForm.tipo,
        cantidad_base: bomForm.cantidadBase,
        unidad_base: bomForm.unidadBase,
        costo_materiales: costos.costoMateriales,
        costo_mano_obra: costos.costoManoObra,
        costo_overhead: costos.costoOverhead,
        costo_total: costos.costoTotal,
        tiempo_setup_minutos: bomForm.tiempoSetupMinutos,
        tiempo_ensamblaje_minutos: bomForm.tiempoEnsamblajeMinutos,
        requiere_aprobacion: bomForm.requiereAprobacion,
        es_principal: bomForm.esPrincipal,
        instrucciones_ensamblaje: bomForm.instruccionesEnsamblaje,
        notas: bomForm.notas,
        creado_por: usuario?.email,
      };

      const { data: bomCreado, error: bomError } = await supabase
        .from('bom')
        .insert([bomData])
        .select()
        .single();

      if (bomError) throw bomError;

      // Insertar items
      const itemsData = bomItems.map((item) => ({
        bom_id: bomCreado.id,
        componente_codigo: item.componenteCodigo,
        componente_descripcion: item.componenteDescripcion,
        cantidad: item.cantidad,
        unidad_medida: item.unidadMedida,
        cantidad_desperdicio: item.cantidadDesperdicio,
        secuencia: item.secuencia,
        nivel: item.nivel,
        es_critico: item.esCritico,
        componente_alternativo_codigo: item.componenteAlternativoCodigo,
        puede_sustituir: item.puedeSustituir,
        costo_unitario: item.costoUnitario,
        costo_total: item.costoTotal,
        referencia: item.referencia,
        posicion: item.posicion,
        notas: item.notas,
        instrucciones: item.instrucciones,
      }));

      const { error: itemsError } = await supabase
        .from('bom_items')
        .insert(itemsData);

      if (itemsError) throw itemsError;

      alert('BOM creado exitosamente');
      setShowCreateModal(false);
      loadData();
      limpiarFormulario();
    } catch (error: any) {
      console.error('Error creating BOM:', error);
      alert(`Error: ${error.message}`);
    }
  };

  // Actualizar estado BOM
  const actualizarEstadoBOM = async (bomId: string, nuevoEstado: EstadoBOM) => {
    try {
      const { error } = await supabase
        .from('bom')
        .update({
          estado: nuevoEstado,
          actualizado_por: usuario?.email,
          ...(nuevoEstado === 'activo' ? {
            fecha_aprobacion: new Date().toISOString(),
            aprobado_por: usuario?.email,
          } : {})
        })
        .eq('id', bomId);

      if (error) throw error;

      alert(`BOM ${nuevoEstado === 'activo' ? 'activado' : 'actualizado'}`);
      loadData();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  // Duplicar BOM
  const duplicarBOM = async (bom: BOM) => {
    try {
      const nuevaVersion = `${parseFloat(bom.version) + 0.1}`.substring(0, 10);

      const bomData = {
        producto_codigo: bom.productoCodigo,
        version: nuevaVersion,
        nombre: `${bom.nombre} (Copia)`,
        descripcion: bom.descripcion,
        estado: 'borrador',
        tipo: bom.tipo,
        cantidad_base: bom.cantidadBase,
        unidad_base: bom.unidadBase,
        costo_materiales: bom.costoMateriales,
        costo_mano_obra: bom.costoManoObra,
        costo_overhead: bom.costoOverhead,
        costo_total: bom.costoTotal,
        tiempo_setup_minutos: bom.tiempoSetupMinutos,
        tiempo_ensamblaje_minutos: bom.tiempoEnsamblajeMinutos,
        requiere_aprobacion: bom.requiereAprobacion,
        es_principal: false,
        instrucciones_ensamblaje: bom.instruccionesEnsamblaje,
        notas: `Duplicado de versión ${bom.version}`,
        creado_por: usuario?.email,
      };

      const { data: bomCreado, error: bomError } = await supabase
        .from('bom')
        .insert([bomData])
        .select()
        .single();

      if (bomError) throw bomError;

      // Duplicar items
      if (bom.items && bom.items.length > 0) {
        const itemsData = bom.items.map((item: any) => ({
          bom_id: bomCreado.id,
          componente_codigo: item.componenteCodigo,
          componente_descripcion: item.componenteDescripcion,
          cantidad: item.cantidad,
          unidad_medida: item.unidadMedida,
          cantidad_desperdicio: item.cantidadDesperdicio,
          secuencia: item.secuencia,
          nivel: item.nivel,
          es_critico: item.esCritico,
          componente_alternativo_codigo: item.componenteAlternativoCodigo,
          puede_sustituir: item.puedeSustituir,
          costo_unitario: item.costoUnitario,
          costo_total: item.costoTotal,
          referencia: item.referencia,
          posicion: item.posicion,
          notas: item.notas,
          instrucciones: item.instrucciones,
        }));

        await supabase.from('bom_items').insert(itemsData);
      }

      alert('BOM duplicado exitosamente');
      loadData();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  // Eliminar BOM
  const eliminarBOM = async (bomId: string) => {
    if (!confirm('¿Está seguro de eliminar este BOM? Esta acción no se puede deshacer.')) return;

    try {
      const { error } = await supabase
        .from('bom')
        .delete()
        .eq('id', bomId);

      if (error) throw error;

      alert('BOM eliminado');
      loadData();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const limpiarFormulario = () => {
    setBomForm({
      productoCodigo: '',
      version: '1.0',
      nombre: '',
      descripcion: '',
      estado: 'borrador',
      tipo: 'produccion',
      cantidadBase: 1,
      unidadBase: 'unidad',
      costoManoObra: 0,
      costoOverhead: 0,
      tiempoSetupMinutos: 0,
      tiempoEnsamblajeMinutos: 0,
      requiereAprobacion: false,
      esPrincipal: true,
      instruccionesEnsamblaje: '',
    });
    setBomItems([]);
  };

  const getEstadoColor = (estado: EstadoBOM) => {
    const colors = {
      borrador: 'bg-yellow-100 text-yellow-800',
      activo: 'bg-green-100 text-green-800',
      obsoleto: 'bg-gray-100 text-gray-800',
      revision: 'bg-blue-100 text-blue-800',
    };
    return colors[estado] || 'bg-gray-100 text-gray-800';
  };

  const costos = calcularCostos();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2">Cargando BOMs...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Boxes className="h-6 w-6" />
            Bill of Materials (BOM)
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Gestión de listas de materiales y componentes
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Nuevo BOM
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600">Total BOMs</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
          <div className="text-2xl font-bold text-green-600">{stats.activos}</div>
          <div className="text-sm text-gray-600">Activos</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-yellow-500">
          <div className="text-2xl font-bold text-yellow-600">{stats.borradores}</div>
          <div className="text-sm text-gray-600">Borradores</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
          <div className="text-2xl font-bold text-purple-600">
            ${stats.costoPromedioMateriales.toFixed(2)}
          </div>
          <div className="text-sm text-gray-600">Costo Prom. Materiales</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por producto o versión..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value as EstadoBOM | 'todos')}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="todos">Todos los estados</option>
            <option value="borrador">Borrador</option>
            <option value="activo">Activo</option>
            <option value="revision">En Revisión</option>
            <option value="obsoleto">Obsoleto</option>
          </select>
        </div>
      </div>

      {/* Tabla de BOMs */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Versión</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Componentes</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Costo Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tiempo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {bomsFiltrados.map((bom) => (
              <tr key={bom.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div>
                    <div className="font-medium text-gray-900">{bom.producto?.descripcion}</div>
                    <div className="text-sm text-gray-500">{bom.nombre || bom.productoCodigo}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="font-mono text-sm">{bom.version}</span>
                  {bom.esPrincipal && (
                    <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">Principal</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEstadoColor(bom.estado)}`}>
                    {bom.estado.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-1 text-sm">
                    <Package className="h-4 w-4 text-gray-400" />
                    {bom.items?.length || 0} componentes
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm">
                    <div className="font-medium">${(bom.costoTotal || 0).toLocaleString()}</div>
                    <div className="text-gray-500 text-xs">
                      Mat: ${(bom.costoMateriales || 0).toFixed(2)}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4 text-gray-400" />
                    {(bom.tiempoEnsamblajeMinutos || 0)} min
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedBOM(bom);
                        setShowViewModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-800"
                      title="Ver detalles"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {bom.estado === 'borrador' && (
                      <button
                        onClick={() => actualizarEstadoBOM(bom.id, 'activo')}
                        className="text-green-600 hover:text-green-800"
                        title="Activar"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => duplicarBOM(bom)}
                      className="text-purple-600 hover:text-purple-800"
                      title="Duplicar"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => eliminarBOM(bom.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {bomsFiltrados.length === 0 && (
          <div className="text-center py-12">
            <Boxes className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-500">No se encontraron BOMs</p>
          </div>
        )}
      </div>

      {/* Modal Crear BOM */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-5xl w-full my-8">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Boxes className="h-5 w-5" />
                Crear Nuevo BOM
              </h3>

              <div className="grid grid-cols-2 gap-6">
                {/* Columna izquierda - Info BOM */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-700">Información del BOM</h4>

                  <div>
                    <label className="block text-sm font-medium mb-1">Producto Final *</label>
                    <select
                      value={bomForm.productoCodigo}
                      onChange={(e) => setBomForm({ ...bomForm, productoCodigo: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">Seleccionar producto</option>
                      {productos.map((p) => (
                        <option key={p.codigo} value={p.codigo}>
                          {p.codigo} - {p.descripcion}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Versión *</label>
                      <input
                        type="text"
                        value={bomForm.version}
                        onChange={(e) => setBomForm({ ...bomForm, version: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Tipo</label>
                      <select
                        value={bomForm.tipo}
                        onChange={(e) => setBomForm({ ...bomForm, tipo: e.target.value as TipoBOM })}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="produccion">Producción</option>
                        <option value="ingenieria">Ingeniería</option>
                        <option value="venta">Venta</option>
                        <option value="servicio">Servicio</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Nombre</label>
                    <input
                      type="text"
                      value={bomForm.nombre}
                      onChange={(e) => setBomForm({ ...bomForm, nombre: e.target.value })}
                      placeholder="Ej: Ensamblaje Estándar"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Cantidad Base</label>
                      <input
                        type="number"
                        value={bomForm.cantidadBase}
                        onChange={(e) => setBomForm({ ...bomForm, cantidadBase: parseFloat(e.target.value) || 1 })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Mano Obra ($)</label>
                      <input
                        type="number"
                        value={bomForm.costoManoObra}
                        onChange={(e) => setBomForm({ ...bomForm, costoManoObra: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Overhead ($)</label>
                      <input
                        type="number"
                        value={bomForm.costoOverhead}
                        onChange={(e) => setBomForm({ ...bomForm, costoOverhead: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Tiempo Setup (min)</label>
                      <input
                        type="number"
                        value={bomForm.tiempoSetupMinutos}
                        onChange={(e) => setBomForm({ ...bomForm, tiempoSetupMinutos: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Tiempo Ensamblaje (min)</label>
                      <input
                        type="number"
                        value={bomForm.tiempoEnsamblajeMinutos}
                        onChange={(e) => setBomForm({ ...bomForm, tiempoEnsamblajeMinutos: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Instrucciones de Ensamblaje</label>
                    <textarea
                      value={bomForm.instruccionesEnsamblaje}
                      onChange={(e) => setBomForm({ ...bomForm, instruccionesEnsamblaje: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  {/* Resumen de costos */}
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h5 className="font-semibold text-sm mb-2">Resumen de Costos</h5>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Materiales:</span>
                        <span className="font-medium">${costos.costoMateriales.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Mano de Obra:</span>
                        <span className="font-medium">${costos.costoManoObra.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Overhead:</span>
                        <span className="font-medium">${costos.costoOverhead.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t font-bold">
                        <span>TOTAL:</span>
                        <span className="text-blue-600">${costos.costoTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Columna derecha - Componentes */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-700">Componentes del BOM</h4>

                  {/* Agregar componente */}
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <h5 className="text-sm font-medium mb-3">Agregar Componente</h5>
                    <div className="space-y-3">
                      <select
                        value={newItem.componenteCodigo}
                        onChange={(e) => setNewItem({ ...newItem, componenteCodigo: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      >
                        <option value="">Seleccionar componente</option>
                        {productos.map((p) => (
                          <option key={p.codigo} value={p.codigo}>
                            {p.codigo} - {p.descripcion} (${p.costoPromedio || p.precio})
                          </option>
                        ))}
                      </select>

                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="number"
                          value={newItem.cantidad}
                          onChange={(e) => setNewItem({ ...newItem, cantidad: parseFloat(e.target.value) || 1 })}
                          placeholder="Cantidad"
                          className="px-3 py-2 border rounded-lg text-sm"
                        />
                        <input
                          type="number"
                          value={newItem.cantidadDesperdicio}
                          onChange={(e) => setNewItem({ ...newItem, cantidadDesperdicio: parseFloat(e.target.value) || 0 })}
                          placeholder="Desperdicio"
                          className="px-3 py-2 border rounded-lg text-sm"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={newItem.esCritico}
                            onChange={(e) => setNewItem({ ...newItem, esCritico: e.target.checked })}
                            id="critico"
                          />
                          <label htmlFor="critico" className="text-xs">Crítico</label>
                        </div>
                      </div>

                      <button
                        onClick={agregarItem}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                      >
                        <Plus className="h-4 w-4 inline mr-1" />
                        Agregar
                      </button>
                    </div>
                  </div>

                  {/* Lista de componentes */}
                  <div className="border rounded-lg max-h-96 overflow-y-auto">
                    {bomItems.length === 0 ? (
                      <div className="p-8 text-center text-gray-500 text-sm">
                        <Package className="mx-auto h-8 w-8 mb-2 text-gray-400" />
                        No hay componentes agregados
                      </div>
                    ) : (
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-100 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs">Componente</th>
                            <th className="px-3 py-2 text-left text-xs">Cant.</th>
                            <th className="px-3 py-2 text-left text-xs">Costo</th>
                            <th className="px-3 py-2 text-left text-xs"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {bomItems.map((item, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-3 py-2">
                                <div className="text-xs">
                                  <div className="font-medium">{item.componenteDescripcion}</div>
                                  <div className="text-gray-500">{item.componenteCodigo}</div>
                                  {item.esCritico && (
                                    <span className="text-red-600 text-xs">⚠ Crítico</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-xs">{item.cantidad}</td>
                              <td className="px-3 py-2 text-xs font-medium">
                                ${(item.costoTotal || 0).toFixed(2)}
                              </td>
                              <td className="px-3 py-2">
                                <button
                                  onClick={() => removerItem(index)}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-6 pt-4 border-t">
                <button
                  onClick={crearBOM}
                  disabled={!bomForm.productoCodigo || bomItems.length === 0}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="h-4 w-4 inline mr-2" />
                  Crear BOM
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    limpiarFormulario();
                  }}
                  className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ver BOM - Simplificado */}
      {showViewModal && selectedBOM && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold">{selectedBOM.producto?.descripcion}</h3>
                  <p className="text-sm text-gray-600">Versión {selectedBOM.version}</p>
                </div>
                <button onClick={() => setShowViewModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-xs text-gray-600">Costo Total</div>
                  <div className="text-lg font-bold">${(selectedBOM.costoTotal || 0).toLocaleString()}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-xs text-gray-600">Componentes</div>
                  <div className="text-lg font-bold">{selectedBOM.items?.length || 0}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-xs text-gray-600">Tiempo Ensamblaje</div>
                  <div className="text-lg font-bold">{selectedBOM.tiempoEnsamblajeMinutos} min</div>
                </div>
              </div>

              <h4 className="font-semibold mb-3">Componentes:</h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left">Componente</th>
                      <th className="px-4 py-2 text-left">Cantidad</th>
                      <th className="px-4 py-2 text-left">Costo Unit.</th>
                      <th className="px-4 py-2 text-left">Costo Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedBOM.items?.map((item: any) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <div>
                            <div className="font-medium">{item.componenteDescripcion}</div>
                            <div className="text-gray-500 text-xs">{item.componenteCodigo}</div>
                          </div>
                        </td>
                        <td className="px-4 py-2">{item.cantidad}</td>
                        <td className="px-4 py-2">${(item.costoUnitario || 0).toFixed(2)}</td>
                        <td className="px-4 py-2 font-medium">${(item.costoTotal || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
