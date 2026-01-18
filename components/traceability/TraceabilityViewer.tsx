'use client';

import React, { useState, useEffect } from 'react';
import {
  GitBranch, Search, RefreshCw, Package, Truck, CheckCircle,
  AlertTriangle, Clock, MapPin, User, Calendar, ChevronRight,
  Box, ArrowRight, FileText, X
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { EventoTrazabilidad, TipoEventoTrazabilidad } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TraceabilityViewerProps {
  serialId?: string;
  loteId?: string;
  productoCodigo?: string;
  onClose?: () => void;
}

export default function TraceabilityViewer({
  serialId,
  loteId,
  productoCodigo,
  onClose,
}: TraceabilityViewerProps) {
  const { user } = useAuth();

  const [eventos, setEventos] = useState<EventoTrazabilidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'serial' | 'lote' | 'producto'>('serial');
  const [selectedEvento, setSelectedEvento] = useState<EventoTrazabilidad | null>(null);

  useEffect(() => {
    if (serialId || loteId || productoCodigo) {
      loadEventos();
    } else {
      setLoading(false);
    }
  }, [serialId, loteId, productoCodigo]);

  const loadEventos = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('eventos_trazabilidad')
        .select(`
          *,
          producto:productos(codigo, descripcion),
          almacen_origen:almacenes!almacen_origen_id(nombre),
          almacen_destino:almacenes!almacen_destino_id(nombre)
        `)
        .order('fecha_hora', { ascending: false });

      if (serialId) {
        query = query.eq('serial_id', serialId);
      } else if (loteId) {
        query = query.eq('lote_id', loteId);
      } else if (productoCodigo) {
        query = query.eq('producto_codigo', productoCodigo);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;
      setEventos(data || []);
    } catch (error) {
      console.error('Error loading eventos:', error);
    } finally {
      setLoading(false);
    }
  };

  const buscarTrazabilidad = async () => {
    if (!searchTerm.trim()) return;

    try {
      setLoading(true);

      let query = supabase
        .from('eventos_trazabilidad')
        .select(`
          *,
          producto:productos(codigo, descripcion),
          almacen_origen:almacenes!almacen_origen_id(nombre),
          almacen_destino:almacenes!almacen_destino_id(nombre)
        `)
        .order('fecha_hora', { ascending: false });

      if (searchType === 'serial') {
        // Buscar primero el serial
        const { data: serialData } = await supabase
          .from('productos_seriales')
          .select('id')
          .ilike('numero_serie', `%${searchTerm}%`)
          .limit(1)
          .single();

        if (serialData) {
          query = query.eq('serial_id', serialData.id);
        } else {
          setEventos([]);
          setLoading(false);
          return;
        }
      } else if (searchType === 'lote') {
        const { data: loteData } = await supabase
          .from('lotes')
          .select('id')
          .ilike('codigo', `%${searchTerm}%`)
          .limit(1)
          .single();

        if (loteData) {
          query = query.eq('lote_id', loteData.id);
        } else {
          setEventos([]);
          setLoading(false);
          return;
        }
      } else {
        query = query.ilike('producto_codigo', `%${searchTerm}%`);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      setEventos(data || []);
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventoIcon = (tipo: TipoEventoTrazabilidad) => {
    const icons: Record<string, React.ReactNode> = {
      RECEPCION: <Package className="h-5 w-5 text-emerald-400" />,
      INSPECCION_QC: <CheckCircle className="h-5 w-5 text-blue-400" />,
      ALMACENAMIENTO: <Box className="h-5 w-5 text-purple-400" />,
      PICKING: <Package className="h-5 w-5 text-orange-400" />,
      PACKING: <Package className="h-5 w-5 text-yellow-400" />,
      ENVIO: <Truck className="h-5 w-5 text-cyan-400" />,
      ENTREGA: <CheckCircle className="h-5 w-5 text-emerald-400" />,
      DEVOLUCION: <AlertTriangle className="h-5 w-5 text-red-400" />,
      ENSAMBLAJE: <GitBranch className="h-5 w-5 text-indigo-400" />,
      TRANSFERENCIA: <ArrowRight className="h-5 w-5 text-blue-400" />,
      AJUSTE: <FileText className="h-5 w-5 text-slate-400" />,
      BAJA: <X className="h-5 w-5 text-red-400" />,
      CAMBIO_ESTADO: <RefreshCw className="h-5 w-5 text-yellow-400" />,
    };
    return icons[tipo] || <Clock className="h-5 w-5 text-slate-400" />;
  };

  const getEventoColor = (tipo: TipoEventoTrazabilidad) => {
    const colors: Record<string, string> = {
      RECEPCION: 'border-emerald-500/30 bg-emerald-500/10',
      INSPECCION_QC: 'border-blue-500/30 bg-blue-500/10',
      ALMACENAMIENTO: 'border-purple-500/30 bg-purple-500/10',
      PICKING: 'border-orange-500/30 bg-orange-500/10',
      PACKING: 'border-yellow-500/30 bg-yellow-500/10',
      ENVIO: 'border-cyan-500/30 bg-cyan-500/10',
      ENTREGA: 'border-emerald-500/30 bg-emerald-500/10',
      DEVOLUCION: 'border-red-500/30 bg-red-500/10',
      ENSAMBLAJE: 'border-indigo-500/30 bg-indigo-500/10',
      TRANSFERENCIA: 'border-blue-500/30 bg-blue-500/10',
      AJUSTE: 'border-slate-500/30 bg-slate-500/10',
      BAJA: 'border-red-500/30 bg-red-500/10',
      CAMBIO_ESTADO: 'border-yellow-500/30 bg-yellow-500/10',
    };
    return colors[tipo] || 'border-slate-500/30 bg-slate-500/10';
  };

  const getResultadoColor = (resultado: string) => {
    const colors: Record<string, string> = {
      EXITOSO: 'text-emerald-400',
      FALLIDO: 'text-red-400',
      PENDIENTE: 'text-yellow-400',
      EN_PROCESO: 'text-blue-400',
    };
    return colors[resultado] || 'text-slate-400';
  };

  // Estadísticas
  const stats = {
    total: eventos.length,
    exitosos: eventos.filter((e) => e.resultado === 'EXITOSO').length,
    fallidos: eventos.filter((e) => e.resultado === 'FALLIDO').length,
    pendientes: eventos.filter((e) => e.resultado === 'PENDIENTE').length,
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
            <GitBranch className="h-7 w-7 text-emerald-400" />
            Trazabilidad End-to-End
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Seguimiento completo del ciclo de vida del producto
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-xl transition-colors"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
        )}
      </div>

      {/* Buscador */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as any)}
            className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-100 focus:border-emerald-500/50 focus:outline-none"
          >
            <option value="serial">Por Serial</option>
            <option value="lote">Por Lote</option>
            <option value="producto">Por Producto</option>
          </select>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
            <input
              type="text"
              placeholder={`Buscar por ${searchType}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && buscarTrazabilidad()}
              className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none"
            />
          </div>
          <button
            onClick={buscarTrazabilidad}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors"
          >
            Buscar
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Eventos', value: stats.total, color: 'blue' },
          { label: 'Exitosos', value: stats.exitosos, color: 'emerald' },
          { label: 'Fallidos', value: stats.fallidos, color: 'red' },
          { label: 'Pendientes', value: stats.pendientes, color: 'yellow' },
        ].map((stat, i) => (
          <div key={i} className={`bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 border-l-4 border-l-${stat.color}-500`}>
            <div className={`text-2xl font-bold text-${stat.color}-400`}>{stat.value}</div>
            <div className="text-sm text-slate-500">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Timeline de eventos */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-6">Línea de Tiempo</h3>

        {eventos.length === 0 ? (
          <div className="text-center py-12">
            <GitBranch className="mx-auto h-12 w-12 text-slate-600" />
            <p className="mt-2 text-slate-500">No se encontraron eventos de trazabilidad</p>
            <p className="text-sm text-slate-600">Busque por serial, lote o producto</p>
          </div>
        ) : (
          <div className="relative">
            {/* Línea vertical */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-700" />

            <div className="space-y-6">
              {eventos.map((evento, index) => (
                <div key={evento.id} className="relative flex gap-4">
                  {/* Icono del evento */}
                  <div className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-xl border ${getEventoColor(evento.tipoEvento)} flex items-center justify-center`}>
                    {getEventoIcon(evento.tipoEvento)}
                  </div>

                  {/* Contenido del evento */}
                  <div
                    className="flex-1 bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 hover:bg-slate-800/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedEvento(evento)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-slate-100">
                          {evento.tipoEvento.replace('_', ' ')}
                        </h4>
                        {evento.descripcion && (
                          <p className="text-sm text-slate-400 mt-1">{evento.descripcion}</p>
                        )}
                      </div>
                      <span className={`text-xs font-medium ${getResultadoColor(evento.resultado)}`}>
                        {evento.resultado}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(new Date(evento.fechaHora), "dd/MM/yyyy HH:mm", { locale: es })}
                      </div>
                      {evento.usuarioResponsable && (
                        <div className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {evento.usuarioResponsable}
                        </div>
                      )}
                      {(evento.almacenOrigen || evento.almacenDestino) && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {evento.almacenOrigen?.nombre || '?'}
                          {evento.almacenDestino && (
                            <>
                              <ChevronRight className="h-3 w-3" />
                              {evento.almacenDestino.nombre}
                            </>
                          )}
                        </div>
                      )}
                      {evento.cantidad && (
                        <div className="flex items-center gap-1">
                          <Package className="h-3.5 w-3.5" />
                          {evento.cantidad} {evento.unidadMedida || 'unidades'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal de detalle */}
      {selectedEvento && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl border ${getEventoColor(selectedEvento.tipoEvento)} flex items-center justify-center`}>
                    {getEventoIcon(selectedEvento.tipoEvento)}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-100">
                      {selectedEvento.tipoEvento.replace('_', ' ')}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {format(new Date(selectedEvento.fechaHora), "dd 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEvento(null)}
                  className="p-2 hover:bg-slate-700 rounded-xl transition-colors"
                >
                  <X className="h-5 w-5 text-slate-400" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/30 rounded-xl p-4">
                  <span className="text-xs text-slate-500">Producto</span>
                  <p className="text-slate-200">{selectedEvento.producto?.descripcion || selectedEvento.productoCodigo}</p>
                </div>
                <div className="bg-slate-800/30 rounded-xl p-4">
                  <span className="text-xs text-slate-500">Resultado</span>
                  <p className={`font-medium ${getResultadoColor(selectedEvento.resultado)}`}>
                    {selectedEvento.resultado}
                  </p>
                </div>
                {selectedEvento.usuarioResponsable && (
                  <div className="bg-slate-800/30 rounded-xl p-4">
                    <span className="text-xs text-slate-500">Responsable</span>
                    <p className="text-slate-200">{selectedEvento.usuarioResponsable}</p>
                  </div>
                )}
                {selectedEvento.cantidad && (
                  <div className="bg-slate-800/30 rounded-xl p-4">
                    <span className="text-xs text-slate-500">Cantidad</span>
                    <p className="text-slate-200">{selectedEvento.cantidad} {selectedEvento.unidadMedida}</p>
                  </div>
                )}
                {selectedEvento.almacenOrigen && (
                  <div className="bg-slate-800/30 rounded-xl p-4">
                    <span className="text-xs text-slate-500">Almacén Origen</span>
                    <p className="text-slate-200">{selectedEvento.almacenOrigen.nombre}</p>
                  </div>
                )}
                {selectedEvento.almacenDestino && (
                  <div className="bg-slate-800/30 rounded-xl p-4">
                    <span className="text-xs text-slate-500">Almacén Destino</span>
                    <p className="text-slate-200">{selectedEvento.almacenDestino.nombre}</p>
                  </div>
                )}
                {selectedEvento.documentoNumero && (
                  <div className="bg-slate-800/30 rounded-xl p-4">
                    <span className="text-xs text-slate-500">Documento</span>
                    <p className="text-slate-200">{selectedEvento.documentoTipo}: {selectedEvento.documentoNumero}</p>
                  </div>
                )}
                {selectedEvento.numeroTracking && (
                  <div className="bg-slate-800/30 rounded-xl p-4">
                    <span className="text-xs text-slate-500">Tracking</span>
                    <p className="text-slate-200">{selectedEvento.numeroTracking}</p>
                  </div>
                )}
              </div>

              {selectedEvento.descripcion && (
                <div className="mt-4 bg-slate-800/30 rounded-xl p-4">
                  <span className="text-xs text-slate-500">Descripción</span>
                  <p className="text-slate-200 mt-1">{selectedEvento.descripcion}</p>
                </div>
              )}

              <button
                onClick={() => setSelectedEvento(null)}
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