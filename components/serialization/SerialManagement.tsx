'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Package, Search, Plus, Filter, Download, Upload,
  QrCode, CheckCircle, XCircle, AlertCircle, Clock,
  MapPin, Calendar, DollarSign, Eye, Edit2, Trash2,
  Shield, TrendingUp, RefreshCw
} from 'lucide-react';
import { useSupabaseStore } from '@/store/supabase-store';
import { ProductoSerial, EstadoSerial, Product, Almacen } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface SerialManagementProps {
  productoCodigo?: string; // Si se pasa, filtrar por producto específico
}

export default function SerialManagement({ productoCodigo }: SerialManagementProps) {
  const supabase = useSupabaseStore((state) => state.supabase);
  const usuario = useSupabaseStore((state) => state.user);

  // Estados
  const [seriales, setSeriales] = useState<ProductoSerial[]>([]);
  const [productos, setProductos] = useState<Product[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEstado, setSelectedEstado] = useState<EstadoSerial | 'todos'>('todos');
  const [selectedAlmacen, setSelectedAlmacen] = useState<string>('todos');
  const [selectedSerial, setSelectedSerial] = useState<ProductoSerial | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Estado para crear serial
  const [newSerial, setNewSerial] = useState<Partial<ProductoSerial>>({
    productoCodigo: productoCodigo || '',
    numeroSerie: '',
    estado: 'disponible',
    almacenId: undefined,
    ubicacion: '',
    notas: '',
  });

  // Estado para generación en masa
  const [bulkGeneration, setBulkGeneration] = useState({
    productoCodigo: productoCodigo || '',
    cantidad: 1,
    almacenId: '',
    ubicacion: '',
    loteId: '',
    proveedorId: '',
    costoAdquisicion: 0,
    diasGarantia: 0,
  });

  // Cargar datos
  useEffect(() => {
    loadData();
  }, [productoCodigo]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Cargar seriales
      let query = supabase
        .from('productos_seriales')
        .select(`
          *,
          producto:productos(codigo, descripcion, precio),
          almacen:almacenes(id, nombre, codigo),
          lote:lotes(id, codigo),
          proveedor:proveedores(id, nombre),
          cliente:clientes(id, nombre)
        `)
        .order('created_at', { ascending: false });

      if (productoCodigo) {
        query = query.eq('producto_codigo', productoCodigo);
      }

      const { data: serialesData, error: serialesError } = await query;

      if (serialesError) throw serialesError;

      setSeriales(serialesData || []);

      // Cargar productos (solo los que requieren serial)
      const { data: productosData } = await supabase
        .from('productos')
        .select('*')
        .eq('requiere_serial', true);

      setProductos(productosData || []);

      // Cargar almacenes
      const { data: almacenesData } = await supabase
        .from('almacenes')
        .select('*')
        .eq('activo', true);

      setAlmacenes(almacenesData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar seriales
  const serialesFiltrados = useMemo(() => {
    return seriales.filter((serial) => {
      // Filtro de búsqueda
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchSerial = serial.numeroSerie.toLowerCase().includes(searchLower);
        const matchProducto = serial.producto?.descripcion?.toLowerCase().includes(searchLower);
        if (!matchSerial && !matchProducto) return false;
      }

      // Filtro de estado
      if (selectedEstado !== 'todos' && serial.estado !== selectedEstado) {
        return false;
      }

      // Filtro de almacén
      if (selectedAlmacen !== 'todos' && serial.almacenId !== selectedAlmacen) {
        return false;
      }

      return true;
    });
  }, [seriales, searchTerm, selectedEstado, selectedAlmacen]);

  // Estadísticas
  const stats = useMemo(() => {
    return {
      total: seriales.length,
      disponible: seriales.filter((s) => s.estado === 'disponible').length,
      vendido: seriales.filter((s) => s.estado === 'vendido').length,
      defectuoso: seriales.filter((s) => s.estado === 'defectuoso').length,
      enReparacion: seriales.filter((s) => s.estado === 'en_reparacion').length,
      valorTotal: seriales.reduce((sum, s) => sum + (s.costoAdquisicion || 0), 0),
      valorDisponible: seriales
        .filter((s) => s.estado === 'disponible')
        .reduce((sum, s) => sum + (s.costoAdquisicion || 0), 0),
    };
  }, [seriales]);

  // Generar número de serie automático
  const generarNumeroSerie = async (productoCodigo: string): Promise<string> => {
    try {
      const { data, error } = await supabase.rpc('generar_numero_serial', {
        p_producto_codigo: productoCodigo,
      });

      if (error) throw error;
      return data || `SN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    } catch (error) {
      console.error('Error generating serial:', error);
      // Fallback
      return `SN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    }
  };

  // Crear serial individual
  const crearSerial = async () => {
    try {
      if (!newSerial.productoCodigo) {
        alert('Debe seleccionar un producto');
        return;
      }

      // Si no hay número de serie, generar uno
      let numeroSerie = newSerial.numeroSerie;
      if (!numeroSerie) {
        numeroSerie = await generarNumeroSerie(newSerial.productoCodigo);
      }

      const serialData = {
        ...newSerial,
        numeroSerie,
        creadoPor: usuario?.email,
        fechaRecepcion: new Date().toISOString(),
      };

      // Calcular fecha de garantía si hay días
      if (newSerial.periodoGarantiaMeses) {
        const fechaInicio = new Date();
        const fechaFin = new Date();
        fechaFin.setMonth(fechaFin.getMonth() + newSerial.periodoGarantiaMeses);
        serialData.fechaGarantiaInicio = fechaInicio.toISOString();
        serialData.fechaGarantiaFin = fechaFin.toISOString();
      }

      const { error } = await supabase
        .from('productos_seriales')
        .insert([serialData]);

      if (error) throw error;

      alert('Serial creado exitosamente');
      setShowCreateModal(false);
      loadData();

      // Limpiar formulario
      setNewSerial({
        productoCodigo: productoCodigo || '',
        numeroSerie: '',
        estado: 'disponible',
        almacenId: undefined,
        ubicacion: '',
        notas: '',
      });
    } catch (error: any) {
      console.error('Error creating serial:', error);
      alert(`Error al crear serial: ${error.message}`);
    }
  };

  // Crear seriales en masa
  const crearSerialesMasa = async () => {
    try {
      if (!bulkGeneration.productoCodigo || bulkGeneration.cantidad < 1) {
        alert('Debe seleccionar un producto y cantidad válida');
        return;
      }

      const serialesCrear: any[] = [];
      for (let i = 0; i < bulkGeneration.cantidad; i++) {
        const numeroSerie = await generarNumeroSerie(bulkGeneration.productoCodigo);

        const serialData: any = {
          productoCodigo: bulkGeneration.productoCodigo,
          numeroSerie,
          estado: 'disponible',
          almacenId: bulkGeneration.almacenId || null,
          ubicacion: bulkGeneration.ubicacion || null,
          loteId: bulkGeneration.loteId || null,
          proveedorId: bulkGeneration.proveedorId || null,
          costoAdquisicion: bulkGeneration.costoAdquisicion || null,
          creadoPor: usuario?.email,
          fechaRecepcion: new Date().toISOString(),
        };

        // Garantía
        if (bulkGeneration.diasGarantia > 0) {
          const meses = Math.floor(bulkGeneration.diasGarantia / 30);
          const fechaInicio = new Date();
          const fechaFin = new Date();
          fechaFin.setDate(fechaFin.getDate() + bulkGeneration.diasGarantia);

          serialData.fechaGarantiaInicio = fechaInicio.toISOString();
          serialData.fechaGarantiaFin = fechaFin.toISOString();
          serialData.periodoGarantiaMeses = meses;
        }

        serialesCrear.push(serialData);
      }

      const { error } = await supabase
        .from('productos_seriales')
        .insert(serialesCrear);

      if (error) throw error;

      alert(`${bulkGeneration.cantidad} seriales creados exitosamente`);
      setShowBulkModal(false);
      loadData();

      // Limpiar formulario
      setBulkGeneration({
        productoCodigo: productoCodigo || '',
        cantidad: 1,
        almacenId: '',
        ubicacion: '',
        loteId: '',
        proveedorId: '',
        costoAdquisicion: 0,
        diasGarantia: 0,
      });
    } catch (error: any) {
      console.error('Error creating bulk serials:', error);
      alert(`Error al crear seriales: ${error.message}`);
    }
  };

  // Actualizar estado de serial
  const actualizarEstadoSerial = async (serialId: string, nuevoEstado: EstadoSerial) => {
    try {
      const { error } = await supabase
        .from('productos_seriales')
        .update({
          estado: nuevoEstado,
          actualizadoPor: usuario?.email,
        })
        .eq('id', serialId);

      if (error) throw error;

      alert('Estado actualizado');
      loadData();
    } catch (error: any) {
      console.error('Error updating serial:', error);
      alert(`Error: ${error.message}`);
    }
  };

  // Eliminar serial
  const eliminarSerial = async (serialId: string) => {
    if (!confirm('¿Está seguro de eliminar este serial?')) return;

    try {
      const { error } = await supabase
        .from('productos_seriales')
        .delete()
        .eq('id', serialId);

      if (error) throw error;

      alert('Serial eliminado');
      loadData();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  // Iconos por estado
  const getEstadoIcon = (estado: EstadoSerial) => {
    switch (estado) {
      case 'disponible':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'vendido':
        return <DollarSign className="h-4 w-4 text-blue-600" />;
      case 'defectuoso':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'en_reparacion':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'en_transito':
        return <TrendingUp className="h-4 w-4 text-purple-600" />;
      case 'reservado':
        return <Clock className="h-4 w-4 text-orange-600" />;
      default:
        return <Package className="h-4 w-4 text-gray-600" />;
    }
  };

  // Color por estado
  const getEstadoColor = (estado: EstadoSerial) => {
    switch (estado) {
      case 'disponible':
        return 'bg-green-100 text-green-800';
      case 'vendido':
        return 'bg-blue-100 text-blue-800';
      case 'defectuoso':
        return 'bg-red-100 text-red-800';
      case 'en_reparacion':
        return 'bg-yellow-100 text-yellow-800';
      case 'en_transito':
        return 'bg-purple-100 text-purple-800';
      case 'reservado':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2">Cargando seriales...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header y Stats */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <QrCode className="h-6 w-6" />
            Gestión de Seriales
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Control individual de productos por número de serie
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nuevo Serial
          </button>
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Upload className="h-4 w-4" />
            Generación Masiva
          </button>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600">Total Seriales</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
          <div className="text-2xl font-bold text-green-600">{stats.disponible}</div>
          <div className="text-sm text-gray-600">Disponibles</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
          <div className="text-2xl font-bold text-blue-600">{stats.vendido}</div>
          <div className="text-sm text-gray-600">Vendidos</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
          <div className="text-2xl font-bold text-red-600">{stats.defectuoso}</div>
          <div className="text-sm text-gray-600">Defectuosos</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-yellow-500">
          <div className="text-2xl font-bold text-yellow-600">{stats.enReparacion}</div>
          <div className="text-sm text-gray-600">En Reparación</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
          <div className="text-2xl font-bold text-purple-600">
            ${stats.valorDisponible.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">Valor Disponible</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por serial o producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filtro Estado */}
          <div>
            <select
              value={selectedEstado}
              onChange={(e) => setSelectedEstado(e.target.value as EstadoSerial | 'todos')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="todos">Todos los estados</option>
              <option value="disponible">Disponible</option>
              <option value="reservado">Reservado</option>
              <option value="vendido">Vendido</option>
              <option value="en_reparacion">En Reparación</option>
              <option value="defectuoso">Defectuoso</option>
              <option value="en_transito">En Tránsito</option>
              <option value="dado_de_baja">Dado de Baja</option>
              <option value="en_rma">En RMA</option>
            </select>
          </div>

          {/* Filtro Almacén */}
          <div>
            <select
              value={selectedAlmacen}
              onChange={(e) => setSelectedAlmacen(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="todos">Todos los almacenes</option>
              {almacenes.map((almacen) => (
                <option key={almacen.id} value={almacen.id}>
                  {almacen.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de Seriales */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Número de Serie
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Producto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ubicación
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Garantía
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Costo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {serialesFiltrados.map((serial) => {
                const garantiaVigente = serial.fechaGarantiaFin && new Date(serial.fechaGarantiaFin) > new Date();

                return (
                  <tr key={serial.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <QrCode className="h-4 w-4 text-gray-400" />
                        <span className="font-mono font-medium text-gray-900">
                          {serial.numeroSerie}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {serial.producto?.descripcion}
                        </div>
                        <div className="text-xs text-gray-500">
                          {serial.productoCodigo}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getEstadoColor(serial.estado)}`}>
                        {getEstadoIcon(serial.estado)}
                        {serial.estado.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-gray-900">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <div>
                          <div>{serial.almacen?.nombre || 'Sin almacén'}</div>
                          {serial.ubicacion && (
                            <div className="text-xs text-gray-500">{serial.ubicacion}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {serial.fechaGarantiaFin ? (
                        <div className="flex items-center gap-1">
                          <Shield className={`h-4 w-4 ${garantiaVigente ? 'text-green-600' : 'text-gray-400'}`} />
                          <span className={`text-sm ${garantiaVigente ? 'text-green-600' : 'text-gray-500'}`}>
                            {garantiaVigente ? 'Vigente' : 'Vencida'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Sin garantía</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {serial.costoAdquisicion ? `$${serial.costoAdquisicion.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedSerial(serial);
                            setShowModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-800"
                          title="Ver detalles"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => eliminarSerial(serial.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {serialesFiltrados.length === 0 && (
            <div className="text-center py-12">
              <QrCode className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-500">No se encontraron seriales</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Crear Serial */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">Crear Nuevo Serial</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Producto *
                  </label>
                  <select
                    value={newSerial.productoCodigo}
                    onChange={(e) => setNewSerial({ ...newSerial, productoCodigo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    disabled={!!productoCodigo}
                  >
                    <option value="">Seleccionar producto</option>
                    {productos.map((p) => (
                      <option key={p.codigo} value={p.codigo}>
                        {p.codigo} - {p.descripcion}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número de Serie (dejar vacío para generar automáticamente)
                  </label>
                  <input
                    type="text"
                    value={newSerial.numeroSerie}
                    onChange={(e) => setNewSerial({ ...newSerial, numeroSerie: e.target.value })}
                    placeholder="Ej: SN-2026-000001"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Almacén
                    </label>
                    <select
                      value={newSerial.almacenId || ''}
                      onChange={(e) => setNewSerial({ ...newSerial, almacenId: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Sin almacén</option>
                      {almacenes.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ubicación
                    </label>
                    <input
                      type="text"
                      value={newSerial.ubicacion}
                      onChange={(e) => setNewSerial({ ...newSerial, ubicacion: e.target.value })}
                      placeholder="Ej: A1-R2-N3-P4"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Costo de Adquisición
                    </label>
                    <input
                      type="number"
                      value={newSerial.costoAdquisicion || ''}
                      onChange={(e) => setNewSerial({ ...newSerial, costoAdquisicion: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Garantía (meses)
                    </label>
                    <input
                      type="number"
                      value={newSerial.periodoGarantiaMeses || ''}
                      onChange={(e) => setNewSerial({ ...newSerial, periodoGarantiaMeses: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas
                  </label>
                  <textarea
                    value={newSerial.notas}
                    onChange={(e) => setNewSerial({ ...newSerial, notas: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={crearSerial}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Crear Serial
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Generación Masiva */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">Generación Masiva de Seriales</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Producto *
                  </label>
                  <select
                    value={bulkGeneration.productoCodigo}
                    onChange={(e) => setBulkGeneration({ ...bulkGeneration, productoCodigo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    disabled={!!productoCodigo}
                  >
                    <option value="">Seleccionar producto</option>
                    {productos.map((p) => (
                      <option key={p.codigo} value={p.codigo}>
                        {p.codigo} - {p.descripcion}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cantidad a Generar *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={bulkGeneration.cantidad}
                    onChange={(e) => setBulkGeneration({ ...bulkGeneration, cantidad: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Los números de serie se generarán automáticamente
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Almacén
                    </label>
                    <select
                      value={bulkGeneration.almacenId}
                      onChange={(e) => setBulkGeneration({ ...bulkGeneration, almacenId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Sin almacén</option>
                      {almacenes.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Costo Unitario
                    </label>
                    <input
                      type="number"
                      value={bulkGeneration.costoAdquisicion}
                      onChange={(e) => setBulkGeneration({ ...bulkGeneration, costoAdquisicion: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Garantía (días)
                  </label>
                  <input
                    type="number"
                    value={bulkGeneration.diasGarantia}
                    onChange={(e) => setBulkGeneration({ ...bulkGeneration, diasGarantia: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={crearSerialesMasa}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Generar {bulkGeneration.cantidad} Seriales
                </button>
                <button
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalles Serial - Implementar si es necesario */}
    </div>
  );
}
