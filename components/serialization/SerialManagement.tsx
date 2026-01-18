'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  QrCode, Plus, Search, Eye, Trash2, Upload, RefreshCw,
  CheckCircle, XCircle, AlertCircle, Clock, MapPin, Shield,
  DollarSign, TrendingUp, Package
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { ProductoSerial, EstadoSerial, Product, Almacen } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface SerialManagementProps {
  productoCodigo?: string;
}

export default function SerialManagement({ productoCodigo }: SerialManagementProps) {
  const { user } = useAuth();

  // Estados
  const [seriales, setSeriales] = useState<ProductoSerial[]>([]);
  const [productos, setProductos] = useState<Product[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEstado, setSelectedEstado] = useState<EstadoSerial | 'todos'>('todos');
  const [selectedAlmacen, setSelectedAlmacen] = useState<string>('todos');
  const [selectedSerial, setSelectedSerial] = useState<ProductoSerial | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Estado para crear serial
  const [newSerial, setNewSerial] = useState({
    productoCodigo: productoCodigo || '',
    numeroSerie: '',
    almacenId: '',
    ubicacion: '',
    costoAdquisicion: '',
    periodoGarantiaMeses: '',
    notas: '',
  });

  // Estado para generación en masa
  const [bulkGeneration, setBulkGeneration] = useState({
    productoCodigo: productoCodigo || '',
    cantidad: 1,
    almacenId: '',
    costoAdquisicion: '',
    diasGarantia: '',
  });

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
          almacen:almacenes(id, nombre, codigo)
        `)
        .order('created_at', { ascending: false });

      if (productoCodigo) {
        query = query.eq('producto_codigo', productoCodigo);
      }

      const { data: serialesData, error: serialesError } = await query;
      if (serialesError) throw serialesError;
      setSeriales(serialesData || []);

      // Cargar productos que requieren serial
      const { data: productosData } = await supabase
        .from('productos')
        .select('*')
        .eq('requiere_serial', true)
        .order('descripcion');
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
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchSerial = serial.numeroSerie?.toLowerCase().includes(search);
        const matchProducto = serial.producto?.descripcion?.toLowerCase().includes(search);
        if (!matchSerial && !matchProducto) return false;
      }
      if (selectedEstado !== 'todos' && serial.estado !== selectedEstado) return false;
      if (selectedAlmacen !== 'todos' && serial.almacenId !== selectedAlmacen) return false;
      return true;
    });
  }, [seriales, searchTerm, selectedEstado, selectedAlmacen]);

  // Estadísticas
  const stats = useMemo(() => ({
    total: seriales.length,
    disponible: seriales.filter((s) => s.estado === 'disponible').length,
    vendido: seriales.filter((s) => s.estado === 'vendido').length,
    defectuoso: seriales.filter((s) => s.estado === 'defectuoso').length,
    enReparacion: seriales.filter((s) => s.estado === 'en_reparacion').length,
    valorDisponible: seriales
      .filter((s) => s.estado === 'disponible')
      .reduce((sum, s) => sum + (s.costoAdquisicion || 0), 0),
  }), [seriales]);

  // Generar número de serie
  const generarNumeroSerie = (productoCodigo: string): string => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `SN-${productoCodigo.substring(0, 3)}-${timestamp}-${random}`;
  };

  // Crear serial individual
  const crearSerial = async () => {
    try {
      if (!newSerial.productoCodigo) {
        alert('Debe seleccionar un producto');
        return;
      }

      const numeroSerie = newSerial.numeroSerie || generarNumeroSerie(newSerial.productoCodigo);

      const serialData: any = {
        producto_codigo: newSerial.productoCodigo,
        numero_serie: numeroSerie,
        estado: 'disponible',
        almacen_id: newSerial.almacenId || null,
        ubicacion: newSerial.ubicacion || null,
        costo_adquisicion: newSerial.costoAdquisicion ? parseFloat(newSerial.costoAdquisicion) : null,
        notas: newSerial.notas || null,
        creado_por: user?.email,
        fecha_recepcion: new Date().toISOString(),
      };

      if (newSerial.periodoGarantiaMeses) {
        const meses = parseInt(newSerial.periodoGarantiaMeses);
        const fechaInicio = new Date();
        const fechaFin = new Date();
        fechaFin.setMonth(fechaFin.getMonth() + meses);
        serialData.fecha_garantia_inicio = fechaInicio.toISOString();
        serialData.fecha_garantia_fin = fechaFin.toISOString();
        serialData.periodo_garantia_meses = meses;
      }

      const { error } = await supabase.from('productos_seriales').insert([serialData]);
      if (error) throw error;

      alert('Serial creado exitosamente');
      setShowCreateModal(false);
      setNewSerial({
        productoCodigo: productoCodigo || '',
        numeroSerie: '',
        almacenId: '',
        ubicacion: '',
        costoAdquisicion: '',
        periodoGarantiaMeses: '',
        notas: '',
      });
      loadData();
    } catch (error: any) {
      console.error('Error creating serial:', error);
      alert(`Error: ${error.message}`);
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
        const numeroSerie = generarNumeroSerie(bulkGeneration.productoCodigo);

        const serialData: any = {
          producto_codigo: bulkGeneration.productoCodigo,
          numero_serie: numeroSerie,
          estado: 'disponible',
          almacen_id: bulkGeneration.almacenId || null,
          costo_adquisicion: bulkGeneration.costoAdquisicion ? parseFloat(bulkGeneration.costoAdquisicion) : null,
          creado_por: user?.email,
          fecha_recepcion: new Date().toISOString(),
        };

        if (bulkGeneration.diasGarantia) {
          const dias = parseInt(bulkGeneration.diasGarantia);
          const fechaInicio = new Date();
          const fechaFin = new Date();
          fechaFin.setDate(fechaFin.getDate() + dias);
          serialData.fecha_garantia_inicio = fechaInicio.toISOString();
          serialData.fecha_garantia_fin = fechaFin.toISOString();
          serialData.periodo_garantia_meses = Math.floor(dias / 30);
        }

        serialesCrear.push(serialData);
      }

      const { error } = await supabase.from('productos_seriales').insert(serialesCrear);
      if (error) throw error;

      alert(`${bulkGeneration.cantidad} seriales creados exitosamente`);
      setShowBulkModal(false);
      setBulkGeneration({
        productoCodigo: productoCodigo || '',
        cantidad: 1,
        almacenId: '',
        costoAdquisicion: '',
        diasGarantia: '',
      });
      loadData();
    } catch (error: any) {
      console.error('Error creating bulk serials:', error);
      alert(`Error: ${error.message}`);
    }
  };

  // Eliminar serial
  const eliminarSerial = async (serialId: string) => {
    if (!confirm('¿Está seguro de eliminar este serial?')) return;

    try {
      const { error } = await supabase.from('productos_seriales').delete().eq('id', serialId);
      if (error) throw error;
      alert('Serial eliminado');
      loadData();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  // Iconos y colores por estado
  const getEstadoIcon = (estado: EstadoSerial) => {
    const icons: Record<string, React.ReactNode> = {
      disponible: <CheckCircle className="h-4 w-4 text-emerald-400" />,
      vendido: <DollarSign className="h-4 w-4 text-blue-400" />,
      defectuoso: <XCircle className="h-4 w-4 text-red-400" />,
      en_reparacion: <AlertCircle className="h-4 w-4 text-yellow-400" />,
      en_transito: <TrendingUp className="h-4 w-4 text-purple-400" />,
      reservado: <Clock className="h-4 w-4 text-orange-400" />,
    };
    return icons[estado] || <Package className="h-4 w-4 text-slate-400" />;
  };

  const getEstadoColor = (estado: EstadoSerial) => {
    const colors: Record<string, string> = {
      disponible: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      vendido: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      defectuoso: 'bg-red-500/20 text-red-400 border-red-500/30',
      en_reparacion: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      en_transito: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      reservado: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    };
    return colors[estado] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <QrCode className="h-7 w-7 text-emerald-400" />
            Gestión de Seriales
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Control individual de productos por número de serie
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nuevo Serial
          </button>
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors"
          >
            <Upload className="h-4 w-4" />
            Generación Masiva
          </button>
          <button
            onClick={loadData}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            <RefreshCw className="h-4 w-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'blue' },
          { label: 'Disponibles', value: stats.disponible, color: 'emerald' },
          { label: 'Vendidos', value: stats.vendido, color: 'cyan' },
          { label: 'Defectuosos', value: stats.defectuoso, color: 'red' },
          { label: 'En Reparación', value: stats.enReparacion, color: 'yellow' },
          { label: 'Valor Disp.', value: `$${stats.valorDisponible.toLocaleString()}`, color: 'purple' },
        ].map((stat, i) => (
          <div key={i} className={`bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 border-l-4 border-l-${stat.color}-500`}>
            <div className={`text-2xl font-bold text-${stat.color}-400`}>{stat.value}</div>
            <div className="text-sm text-slate-500">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por serial o producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none"
            />
          </div>
          <select
            value={selectedEstado}
            onChange={(e) => setSelectedEstado(e.target.value as EstadoSerial | 'todos')}
            className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-100 focus:border-emerald-500/50 focus:outline-none"
          >
            <option value="todos">Todos los estados</option>
            <option value="disponible">Disponible</option>
            <option value="reservado">Reservado</option>
            <option value="vendido">Vendido</option>
            <option value="en_reparacion">En Reparación</option>
            <option value="defectuoso">Defectuoso</option>
            <option value="en_transito">En Tránsito</option>
          </select>
          <select
            value={selectedAlmacen}
            onChange={(e) => setSelectedAlmacen(e.target.value)}
            className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-100 focus:border-emerald-500/50 focus:outline-none"
          >
            <option value="todos">Todos los almacenes</option>
            {almacenes.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Serial</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Producto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Ubicación</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Garantía</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Costo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {serialesFiltrados.map((serial) => {
                const garantiaVigente = serial.fechaGarantiaFin && new Date(serial.fechaGarantiaFin) > new Date();
                return (
                  <tr key={serial.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <QrCode className="h-4 w-4 text-slate-500" />
                        <span className="font-mono text-sm text-slate-200">{serial.numeroSerie}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-200">{serial.producto?.descripcion}</div>
                      <div className="text-xs text-slate-500">{serial.productoCodigo}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs border ${getEstadoColor(serial.estado)}`}>
                        {getEstadoIcon(serial.estado)}
                        {serial.estado.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-slate-300">
                        <MapPin className="h-4 w-4 text-slate-500" />
                        {serial.almacen?.nombre || 'Sin almacén'}
                      </div>
                      {serial.ubicacion && (
                        <div className="text-xs text-slate-500">{serial.ubicacion}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {serial.fechaGarantiaFin ? (
                        <div className="flex items-center gap-1">
                          <Shield className={`h-4 w-4 ${garantiaVigente ? 'text-emerald-400' : 'text-slate-500'}`} />
                          <span className={`text-sm ${garantiaVigente ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {garantiaVigente ? 'Vigente' : 'Vencida'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">Sin garantía</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      {serial.costoAdquisicion ? `$${serial.costoAdquisicion.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setSelectedSerial(serial); setShowDetailModal(true); }}
                          className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                          title="Ver detalles"
                        >
                          <Eye className="h-4 w-4 text-blue-400" />
                        </button>
                        <button
                          onClick={() => eliminarSerial(serial.id)}
                          className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4 text-red-400" />
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
              <QrCode className="mx-auto h-12 w-12 text-slate-600" />
              <p className="mt-2 text-sm text-slate-500">No se encontraron seriales</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Crear Serial */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-100 mb-4">Crear Nuevo Serial</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Producto *</label>
                  <select
                    value={newSerial.productoCodigo}
                    onChange={(e) => setNewSerial({ ...newSerial, productoCodigo: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                    disabled={!!productoCodigo}
                  >
                    <option value="">Seleccionar producto</option>
                    {productos.map((p) => (
                      <option key={p.codigo} value={p.codigo}>{p.codigo} - {p.descripcion}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Número de Serie (vacío = autogenerar)</label>
                  <input
                    type="text"
                    value={newSerial.numeroSerie}
                    onChange={(e) => setNewSerial({ ...newSerial, numeroSerie: e.target.value })}
                    placeholder="SN-XXX-000001"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Almacén</label>
                    <select
                      value={newSerial.almacenId}
                      onChange={(e) => setNewSerial({ ...newSerial, almacenId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                    >
                      <option value="">Sin almacén</option>
                      {almacenes.map((a) => (
                        <option key={a.id} value={a.id}>{a.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Ubicación</label>
                    <input
                      type="text"
                      value={newSerial.ubicacion}
                      onChange={(e) => setNewSerial({ ...newSerial, ubicacion: e.target.value })}
                      placeholder="A1-R2-N3"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Costo Adquisición</label>
                    <input
                      type="number"
                      value={newSerial.costoAdquisicion}
                      onChange={(e) => setNewSerial({ ...newSerial, costoAdquisicion: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Garantía (meses)</label>
                    <input
                      type="number"
                      value={newSerial.periodoGarantiaMeses}
                      onChange={(e) => setNewSerial({ ...newSerial, periodoGarantiaMeses: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Notas</label>
                  <textarea
                    value={newSerial.notas}
                    onChange={(e) => setNewSerial({ ...newSerial, notas: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={crearSerial}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors"
                >
                  Crear Serial
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors"
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full">
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-100 mb-4">Generación Masiva de Seriales</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Producto *</label>
                  <select
                    value={bulkGeneration.productoCodigo}
                    onChange={(e) => setBulkGeneration({ ...bulkGeneration, productoCodigo: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                    disabled={!!productoCodigo}
                  >
                    <option value="">Seleccionar producto</option>
                    {productos.map((p) => (
                      <option key={p.codigo} value={p.codigo}>{p.codigo} - {p.descripcion}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Cantidad a Generar *</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={bulkGeneration.cantidad}
                    onChange={(e) => setBulkGeneration({ ...bulkGeneration, cantidad: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  />
                  <p className="text-xs text-slate-500 mt-1">Seriales se generarán automáticamente</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Almacén</label>
                    <select
                      value={bulkGeneration.almacenId}
                      onChange={(e) => setBulkGeneration({ ...bulkGeneration, almacenId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                    >
                      <option value="">Sin almacén</option>
                      {almacenes.map((a) => (
                        <option key={a.id} value={a.id}>{a.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Costo Unitario</label>
                    <input
                      type="number"
                      value={bulkGeneration.costoAdquisicion}
                      onChange={(e) => setBulkGeneration({ ...bulkGeneration, costoAdquisicion: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Garantía (días)</label>
                  <input
                    type="number"
                    value={bulkGeneration.diasGarantia}
                    onChange={(e) => setBulkGeneration({ ...bulkGeneration, diasGarantia: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={crearSerialesMasa}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors"
                >
                  Generar {bulkGeneration.cantidad} Seriales
                </button>
                <button
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalles */}
      {showDetailModal && selectedSerial && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full">
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-100 mb-4">Detalles del Serial</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">Serial:</span>
                  <span className="font-mono text-slate-200">{selectedSerial.numeroSerie}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Producto:</span>
                  <span className="text-slate-200">{selectedSerial.producto?.descripcion}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Estado:</span>
                  <span className={`px-2 py-1 rounded-lg text-xs ${getEstadoColor(selectedSerial.estado)}`}>
                    {selectedSerial.estado.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Almacén:</span>
                  <span className="text-slate-200">{selectedSerial.almacen?.nombre || 'Sin asignar'}</span>
                </div>
                {selectedSerial.ubicacion && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Ubicación:</span>
                    <span className="text-slate-200">{selectedSerial.ubicacion}</span>
                  </div>
                )}
                {selectedSerial.costoAdquisicion && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Costo:</span>
                    <span className="text-slate-200">${selectedSerial.costoAdquisicion.toLocaleString()}</span>
                  </div>
                )}
                {selectedSerial.fechaGarantiaFin && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Garantía hasta:</span>
                    <span className="text-slate-200">
                      {format(new Date(selectedSerial.fechaGarantiaFin), 'dd/MM/yyyy', { locale: es })}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="w-full mt-6 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}