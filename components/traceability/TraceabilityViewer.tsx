'use client';

import React, { useState, useEffect } from 'react';
import {
  GitBranch, Package, MapPin, Calendar, User, Truck,
  CheckCircle, AlertCircle, Clock, FileText, Download,
  Thermometer, Droplets, Eye, RefreshCw, Search
} from 'lucide-react';
import { useSupabaseStore } from '@/store/supabase-store';
import { EventoTrazabilidad, CadenaTrazabilidad } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TraceabilityViewerProps {
  productoCodigo?: string;
  serialId?: string;
  loteId?: string;
  onClose?: () => void;
}

export default function TraceabilityViewer({
  productoCodigo,
  serialId,
  loteId,
  onClose
}: TraceabilityViewerProps) {
  const supabase = useSupabaseStore((state) => state.supabase);

  const [loading, setLoading] = useState(true);
  const [eventos, setEventos] = useState<EventoTrazabilidad[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEvento, setFilterEvento] = useState('todos');

  useEffect(() => {
    loadTrazabilidad();
  }, [productoCodigo, serialId, loteId]);

  const loadTrazabilidad = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('trazabilidad')
        .select(`
          *,
          producto:productos(codigo, descripcion),
          serial:productos_seriales(numero_serie),
          lote:lotes(codigo),
          almacen_origen:almacenes!trazabilidad_almacen_origen_id_fkey(id, nombre),
          almacen_destino:almacenes!trazabilidad_almacen_destino_id_fkey(id, nombre),
          proveedor:proveedores(nombre),
          cliente:clientes(nombre)
        `)
        .order('fecha_hora', { ascending: false });

      if (productoCodigo) {
        query = query.eq('producto_codigo', productoCodigo);
      }
      if (serialId) {
        query = query.eq('serial_id', serialId);
      }
      if (loteId) {
        query = query.eq('lote_id', loteId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setEventos(data || []);
    } catch (error) {
      console.error('Error loading traceability:', error);
    } finally {
      setLoading(false);
    }
  };

  const eventosFiltrados = eventos.filter((evento) => {
    if (filterEvento !== 'todos' && evento.tipoEvento !== filterEvento) {
      return false;
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        evento.descripcion?.toLowerCase().includes(search) ||
        evento.usuarioResponsable?.toLowerCase().includes(search) ||
        evento.documentoNumero?.toLowerCase().includes(search)
      );
    }

    return true;
  });

  const getEventoIcon = (tipo: string) => {
    switch (tipo) {
      case 'RECEPCION':
        return <Package className="h-5 w-5 text-blue-600" />;
      case 'INSPECCION_QC':
        return <Eye className="h-5 w-5 text-purple-600" />;
      case 'ALMACENAMIENTO':
        return <MapPin className="h-5 w-5 text-green-600" />;
      case 'PICKING':
        return <CheckCircle className="h-5 w-5 text-orange-600" />;
      case 'ENVIO':
        return <Truck className="h-5 w-5 text-blue-600" />;
      case 'ENTREGA':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'DEVOLUCION':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'TRANSFERENCIA':
        return <GitBranch className="h-5 w-5 text-purple-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  const getResultadoColor = (resultado: string) => {
    switch (resultado) {
      case 'EXITOSO':
        return 'text-green-600 bg-green-50';
      case 'FALLIDO':
        return 'text-red-600 bg-red-50';
      case 'PENDIENTE':
        return 'text-yellow-600 bg-yellow-50';
      case 'EN_PROCESO':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const exportarPDF = () => {
    alert('Funcionalidad de exportar a PDF en desarrollo');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2">Cargando historial de trazabilidad...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <GitBranch className="h-6 w-6" />
            Trazabilidad Completa
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Historial completo de eventos y movimientos
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={exportarPDF}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download className="h-4 w-4" />
            Exportar PDF
          </button>
          <button
            onClick={loadTrazabilidad}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-blue-600">{eventos.length}</div>
          <div className="text-sm text-gray-600">Total Eventos</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-green-600">
            {eventos.filter((e) => e.resultado === 'EXITOSO').length}
          </div>
          <div className="text-sm text-gray-600">Exitosos</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-red-600">
            {eventos.filter((e) => e.resultado === 'FALLIDO').length}
          </div>
          <div className="text-sm text-gray-600">Fallidos</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-yellow-600">
            {eventos.filter((e) => e.resultado === 'PENDIENTE').length}
          </div>
          <div className="text-sm text-gray-600">Pendientes</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar en historial..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <select
              value={filterEvento}
              onChange={(e) => setFilterEvento(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="todos">Todos los eventos</option>
              <option value="RECEPCION">Recepción</option>
              <option value="INSPECCION_QC">Inspección QC</option>
              <option value="ALMACENAMIENTO">Almacenamiento</option>
              <option value="PICKING">Picking</option>
              <option value="PACKING">Packing</option>
              <option value="ENVIO">Envío</option>
              <option value="ENTREGA">Entrega</option>
              <option value="DEVOLUCION">Devolución</option>
              <option value="ENSAMBLAJE">Ensamblaje</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="CAMBIO_ESTADO">Cambio de Estado</option>
            </select>
          </div>
        </div>
      </div>

      {/* Timeline de Eventos */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="relative">
          {/* Línea vertical del timeline */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200" />

          {/* Eventos */}
          <div className="space-y-6">
            {eventosFiltrados.map((evento, index) => (
              <div key={evento.id} className="relative flex gap-4">
                {/* Icono del evento */}
                <div className="flex-shrink-0 relative z-10">
                  <div className="w-16 h-16 bg-white rounded-full border-4 border-gray-200 flex items-center justify-center">
                    {getEventoIcon(evento.tipoEvento)}
                  </div>
                </div>

                {/* Contenido del evento */}
                <div className="flex-1 bg-gray-50 rounded-lg p-4 border-l-4 border-blue-500">
                  {/* Header del evento */}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-gray-900 text-lg">
                        {evento.tipoEvento.replace(/_/g, ' ')}
                      </h4>
                      <p className="text-gray-600 text-sm mt-1">
                        {evento.descripcion}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getResultadoColor(evento.resultado)}`}>
                      {evento.resultado}
                    </span>
                  </div>

                  {/* Detalles del evento */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    {/* Fecha y hora */}
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <div>
                        <div className="text-gray-900">
                          {format(new Date(evento.fechaHora), 'dd/MM/yyyy', { locale: es })}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {format(new Date(evento.fechaHora), 'HH:mm:ss')}
                        </div>
                      </div>
                    </div>

                    {/* Usuario responsable */}
                    {evento.usuarioResponsable && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="text-gray-500 text-xs">Responsable</div>
                          <div className="text-gray-900">{evento.usuarioResponsable}</div>
                        </div>
                      </div>
                    )}

                    {/* Ubicación origen */}
                    {evento.almacenOrigen && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-red-400" />
                        <div>
                          <div className="text-gray-500 text-xs">Origen</div>
                          <div className="text-gray-900">{evento.almacenOrigen.nombre}</div>
                        </div>
                      </div>
                    )}

                    {/* Ubicación destino */}
                    {evento.almacenDestino && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-green-400" />
                        <div>
                          <div className="text-gray-500 text-xs">Destino</div>
                          <div className="text-gray-900">{evento.almacenDestino.nombre}</div>
                        </div>
                      </div>
                    )}

                    {/* Documento */}
                    {evento.documentoNumero && (
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="text-gray-500 text-xs">{evento.documentoTipo}</div>
                          <div className="text-gray-900">{evento.documentoNumero}</div>
                        </div>
                      </div>
                    )}

                    {/* Transportista */}
                    {evento.transportista && (
                      <div className="flex items-center gap-2 text-sm">
                        <Truck className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="text-gray-500 text-xs">Transportista</div>
                          <div className="text-gray-900">{evento.transportista}</div>
                        </div>
                      </div>
                    )}

                    {/* Temperatura */}
                    {evento.temperatura && (
                      <div className="flex items-center gap-2 text-sm">
                        <Thermometer className="h-4 w-4 text-blue-400" />
                        <div>
                          <div className="text-gray-500 text-xs">Temperatura</div>
                          <div className="text-gray-900">{evento.temperatura}°C</div>
                        </div>
                      </div>
                    )}

                    {/* Humedad */}
                    {evento.humedad && (
                      <div className="flex items-center gap-2 text-sm">
                        <Droplets className="h-4 w-4 text-blue-400" />
                        <div>
                          <div className="text-gray-500 text-xs">Humedad</div>
                          <div className="text-gray-900">{evento.humedad}%</div>
                        </div>
                      </div>
                    )}

                    {/* Cantidad */}
                    {evento.cantidad && (
                      <div className="flex items-center gap-2 text-sm">
                        <Package className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="text-gray-500 text-xs">Cantidad</div>
                          <div className="text-gray-900">
                            {evento.cantidad} {evento.unidadMedida || 'unidades'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Metadata adicional */}
                  {evento.metadata && Object.keys(evento.metadata).length > 0 && (
                    <details className="mt-3">
                      <summary className="text-sm text-blue-600 cursor-pointer">
                        Ver detalles adicionales
                      </summary>
                      <pre className="mt-2 text-xs bg-gray-100 p-3 rounded overflow-x-auto">
                        {JSON.stringify(evento.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>

          {eventosFiltrados.length === 0 && (
            <div className="text-center py-12">
              <GitBranch className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-500">No hay eventos de trazabilidad</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
