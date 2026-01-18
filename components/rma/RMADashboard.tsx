'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Package, Plus, RefreshCw, CheckCircle, XCircle, Clock,
  AlertTriangle, Truck, Eye, Search
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { RMA, EstadoRMA, Cliente } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function RMADashboard() {
  const { user } = useAuth();

  const [rmas, setRmas] = useState<RMA[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEstado, setFilterEstado] = useState<EstadoRMA | 'todos'>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRMA, setSelectedRMA] = useState<RMA | null>(null);

  const [newRMA, setNewRMA] = useState({
    clienteId: '',
    tipo: 'defecto' as const,
    motivo: '',
    resolucionEsperada: 'reembolso' as const,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const { data: rmasData, error: rmasError } = await supabase
        .from('rma')
        .select(`
          *,
          cliente:clientes(*)
        `)
        .order('fecha_solicitud', { ascending: false });

      if (rmasError) throw rmasError;

      const { data: clientesData } = await supabase
        .from('clientes')
        .select('*')
        .eq('activo', true)
        .order('nombre');

      setRmas(rmasData || []);
      setClientes(clientesData || []);
    } catch (error) {
      console.error('Error loading RMAs:', error);
    } finally {
      setLoading(false);
    }
  };

  const crearRMA = async () => {
    try {
      if (!newRMA.clienteId || !newRMA.motivo) {
        alert('Complete los campos requeridos');
        return;
      }

      const numero = `RMA-${Date.now().toString().slice(-8)}`;

      const { error } = await supabase.from('rma').insert([{
        numero,
        cliente_id: newRMA.clienteId,
        tipo: newRMA.tipo,
        motivo: newRMA.motivo,
        resolucion_esperada: newRMA.resolucionEsperada,
        estado: 'solicitada',
        fecha_solicitud: new Date().toISOString(),
        creado_por: user?.email,
      }]);

      if (error) throw error;

      alert('RMA creado exitosamente');
      setShowCreateModal(false);
      setNewRMA({
        clienteId: '',
        tipo: 'defecto',
        motivo: '',
        resolucionEsperada: 'reembolso',
      });
      loadData();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const actualizarEstado = async (rmaId: string, nuevoEstado: EstadoRMA) => {
    try {
      const updateData: any = {
        estado: nuevoEstado,
        actualizado_por: user?.email,
      };

      if (nuevoEstado === 'aprobada') {
        updateData.fecha_aprobacion = new Date().toISOString();
        updateData.aprobado_por = user?.email;
      }

      const { error } = await supabase
        .from('rma')
        .update(updateData)
        .eq('id', rmaId);

      if (error) throw error;
      loadData();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  // Filtrar RMAs
  const rmasFiltrados = useMemo(() => {
    return rmas.filter((rma) => {
      if (filterEstado !== 'todos' && rma.estado !== filterEstado) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchNumero = rma.numero?.toLowerCase().includes(search);
        const matchCliente = rma.cliente?.nombre?.toLowerCase().includes(search);
        if (!matchNumero && !matchCliente) return false;
      }
      return true;
    });
  }, [rmas, filterEstado, searchTerm]);

  // Estadísticas
  const stats = useMemo(() => ({
    total: rmas.length,
    solicitada: rmas.filter((r) => r.estado === 'solicitada').length,
    aprobada: rmas.filter((r) => r.estado === 'aprobada').length,
    enProceso: rmas.filter((r) => ['en_transito', 'recibida', 'inspeccionada'].includes(r.estado)).length,
    completada: rmas.filter((r) => r.estado === 'completada').length,
    valorTotal: rmas.reduce((sum, r) => sum + (r.valorProductos || 0), 0),
  }), [rmas]);

  const getEstadoColor = (estado: EstadoRMA) => {
    const colors: Record<EstadoRMA, string> = {
      solicitada: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      aprobada: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      rechazada: 'bg-red-500/20 text-red-400 border-red-500/30',
      en_transito: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      recibida: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      inspeccionada: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
      procesada: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
      completada: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      cancelada: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    };
    return colors[estado] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  };

  const getEstadoIcon = (estado: EstadoRMA) => {
    const icons: Record<string, React.ReactNode> = {
      solicitada: <Clock className="h-4 w-4" />,
      aprobada: <CheckCircle className="h-4 w-4" />,
      rechazada: <XCircle className="h-4 w-4" />,
      en_transito: <Truck className="h-4 w-4" />,
      recibida: <Package className="h-4 w-4" />,
      completada: <CheckCircle className="h-4 w-4" />,
    };
    return icons[estado] || <AlertTriangle className="h-4 w-4" />;
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
            <Package className="h-7 w-7 text-emerald-400" />
            Gestión de Devoluciones (RMA)
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Return Merchandise Authorization
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nueva Devolución
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
          { label: 'Total RMAs', value: stats.total, color: 'blue' },
          { label: 'Solicitadas', value: stats.solicitada, color: 'yellow' },
          { label: 'Aprobadas', value: stats.aprobada, color: 'cyan' },
          { label: 'En Proceso', value: stats.enProceso, color: 'purple' },
          { label: 'Completadas', value: stats.completada, color: 'emerald' },
          { label: 'Valor Total', value: `$${stats.valorTotal.toLocaleString()}`, color: 'indigo' },
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
            <input
              type="text"
              placeholder="Buscar por número o cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none"
            />
          </div>
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value as EstadoRMA | 'todos')}
            className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-100 focus:border-emerald-500/50 focus:outline-none"
          >
            <option value="todos">Todos los estados</option>
            <option value="solicitada">Solicitadas</option>
            <option value="aprobada">Aprobadas</option>
            <option value="rechazada">Rechazadas</option>
            <option value="en_transito">En Tránsito</option>
            <option value="recibida">Recibidas</option>
            <option value="completada">Completadas</option>
          </select>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Número RMA</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Valor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {rmasFiltrados.map((rma) => (
                <tr key={rma.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 font-mono text-sm text-slate-200">{rma.numero}</td>
                  <td className="px-6 py-4 text-slate-300">{rma.cliente?.nombre || '-'}</td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-400 capitalize">{rma.tipo?.replace('_', ' ')}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs border ${getEstadoColor(rma.estado)}`}>
                      {getEstadoIcon(rma.estado)}
                      {rma.estado.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400">
                    {rma.fechaSolicitud ? format(new Date(rma.fechaSolicitud), 'dd/MM/yyyy', { locale: es }) : '-'}
                  </td>
                  <td className="px-6 py-4 text-slate-300">
                    ${(rma.valorProductos || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setSelectedRMA(rma); setShowDetailModal(true); }}
                        className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                        title="Ver detalles"
                      >
                        <Eye className="h-4 w-4 text-blue-400" />
                      </button>
                      {rma.estado === 'solicitada' && (
                        <>
                          <button
                            onClick={() => actualizarEstado(rma.id, 'aprobada')}
                            className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                            title="Aprobar"
                          >
                            <CheckCircle className="h-4 w-4 text-emerald-400" />
                          </button>
                          <button
                            onClick={() => actualizarEstado(rma.id, 'rechazada')}
                            className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                            title="Rechazar"
                          >
                            <XCircle className="h-4 w-4 text-red-400" />
                          </button>
                        </>
                      )}
                      {rma.estado === 'aprobada' && (
                        <button
                          onClick={() => actualizarEstado(rma.id, 'en_transito')}
                          className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                          title="Marcar en tránsito"
                        >
                          <Truck className="h-4 w-4 text-purple-400" />
                        </button>
                      )}
                      {rma.estado === 'en_transito' && (
                        <button
                          onClick={() => actualizarEstado(rma.id, 'recibida')}
                          className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                          title="Marcar recibida"
                        >
                          <Package className="h-4 w-4 text-cyan-400" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {rmasFiltrados.length === 0 && (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-slate-600" />
              <p className="mt-2 text-sm text-slate-500">No se encontraron RMAs</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Crear RMA */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full">
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-100 mb-4">Nueva Devolución (RMA)</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Cliente *</label>
                  <select
                    value={newRMA.clienteId}
                    onChange={(e) => setNewRMA({ ...newRMA, clienteId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  >
                    <option value="">Seleccionar cliente</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Tipo *</label>
                  <select
                    value={newRMA.tipo}
                    onChange={(e) => setNewRMA({ ...newRMA, tipo: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  >
                    <option value="garantia">Garantía</option>
                    <option value="defecto">Defecto</option>
                    <option value="error_envio">Error de Envío</option>
                    <option value="no_conforme">No Conforme</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Motivo *</label>
                  <textarea
                    value={newRMA.motivo}
                    onChange={(e) => setNewRMA({ ...newRMA, motivo: e.target.value })}
                    rows={3}
                    placeholder="Describa el motivo de la devolución..."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Resolución Esperada</label>
                  <select
                    value={newRMA.resolucionEsperada}
                    onChange={(e) => setNewRMA({ ...newRMA, resolucionEsperada: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  >
                    <option value="reembolso">Reembolso</option>
                    <option value="reemplazo">Reemplazo</option>
                    <option value="credito">Crédito</option>
                    <option value="reparacion">Reparación</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={crearRMA}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors"
                >
                  Crear RMA
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

      {/* Modal Detalle RMA */}
      {showDetailModal && selectedRMA && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full">
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-100 mb-4">
                Detalles RMA: {selectedRMA.numero}
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">Cliente:</span>
                  <span className="text-slate-200">{selectedRMA.cliente?.nombre}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tipo:</span>
                  <span className="text-slate-200 capitalize">{selectedRMA.tipo?.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Estado:</span>
                  <span className={`px-2 py-1 rounded-lg text-xs ${getEstadoColor(selectedRMA.estado)}`}>
                    {selectedRMA.estado.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Fecha Solicitud:</span>
                  <span className="text-slate-200">
                    {selectedRMA.fechaSolicitud 
                      ? format(new Date(selectedRMA.fechaSolicitud), 'dd/MM/yyyy', { locale: es })
                      : '-'}
                  </span>
                </div>
                {selectedRMA.motivo && (
                  <div className="bg-slate-800/30 rounded-xl p-3 mt-4">
                    <span className="text-xs text-slate-500">Motivo</span>
                    <p className="text-slate-200 mt-1">{selectedRMA.motivo}</p>
                  </div>
                )}
                {selectedRMA.valorProductos && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Valor Productos:</span>
                    <span className="text-slate-200">${selectedRMA.valorProductos.toLocaleString()}</span>
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