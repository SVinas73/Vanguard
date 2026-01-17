'use client';

import React, { useState, useEffect } from 'react';
import { Package, Plus, RefreshCw, Eye, CheckCircle, XCircle, Clock, AlertTriangle, DollarSign, FileText } from 'lucide-react';
import { useSupabaseStore } from '@/store/supabase-store';
import { RMA, EstadoRMA, Cliente } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function RMADashboard() {
  const supabase = useSupabaseStore((state) => state.supabase);
  const usuario = useSupabaseStore((state) => state.user);

  const [rmas, setRmas] = useState<RMA[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEstado, setFilterEstado] = useState<EstadoRMA | 'todos'>('todos');
  const [showCreateModal, setShowCreateModal] = useState(false);

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

      const { data: rmasData } = await supabase
        .from('rma')
        .select(`
          *,
          cliente:clientes(*),
          items:rma_items(*)
        `)
        .order('fecha_solicitud', { ascending: false });

      const { data: clientesData } = await supabase
        .from('clientes')
        .select('*')
        .eq('activo', true);

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
        creado_por: usuario?.email,
      }]);

      if (error) throw error;

      alert('RMA creado exitosamente');
      setShowCreateModal(false);
      loadData();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const actualizarEstado = async (rmaId: string, nuevoEstado: EstadoRMA) => {
    try {
      const { error } = await supabase
        .from('rma')
        .update({ estado: nuevoEstado, actualizado_por: usuario?.email })
        .eq('id', rmaId);

      if (error) throw error;
      loadData();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const rmasFiltrados = rmas.filter((rma) =>
    filterEstado === 'todos' || rma.estado === filterEstado
  );

  const stats = {
    total: rmas.length,
    solicitada: rmas.filter((r) => r.estado === 'solicitada').length,
    aprobada: rmas.filter((r) => r.estado === 'aprobada').length,
    procesada: rmas.filter((r) => r.estado === 'procesada').length,
    valorTotal: rmas.reduce((sum, r) => sum + (r.valorProductos || 0), 0),
  };

  const getEstadoColor = (estado: EstadoRMA) => {
    const colors = {
      solicitada: 'bg-yellow-100 text-yellow-800',
      aprobada: 'bg-blue-100 text-blue-800',
      rechazada: 'bg-red-100 text-red-800',
      en_transito: 'bg-purple-100 text-purple-800',
      recibida: 'bg-green-100 text-green-800',
      completada: 'bg-gray-100 text-gray-800',
      cancelada: 'bg-gray-100 text-gray-800',
    };
    return colors[estado] || 'bg-gray-100 text-gray-800';
  };

  if (loading) return <div className="flex items-center justify-center p-8"><RefreshCw className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" />
            Gestión de Devoluciones (RMA)
          </h2>
          <p className="text-gray-600 text-sm">Return Merchandise Authorization</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="h-4 w-4" />
          Nueva Devolución
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-sm text-gray-600">Total RMAs</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-yellow-600">{stats.solicitada}</div>
          <div className="text-sm text-gray-600">Solicitadas</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-blue-600">{stats.aprobada}</div>
          <div className="text-sm text-gray-600">Aprobadas</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-purple-600">${stats.valorTotal.toLocaleString()}</div>
          <div className="text-sm text-gray-600">Valor Total</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow">
        <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value as EstadoRMA | 'todos')} className="px-4 py-2 border rounded-lg">
          <option value="todos">Todos los estados</option>
          <option value="solicitada">Solicitadas</option>
          <option value="aprobada">Aprobadas</option>
          <option value="rechazada">Rechazadas</option>
          <option value="en_transito">En Tránsito</option>
          <option value="recibida">Recibidas</option>
          <option value="procesada">Procesadas</option>
          <option value="completada">Completadas</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Número RMA</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rmasFiltrados.map((rma) => (
              <tr key={rma.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap font-medium">{rma.numero}</td>
                <td className="px-6 py-4">{rma.cliente?.nombre}</td>
                <td className="px-6 py-4">{rma.tipo}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${getEstadoColor(rma.estado)}`}>
                    {rma.estado.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {format(new Date(rma.fechaSolicitud), 'dd/MM/yyyy', { locale: es })}
                </td>
                <td className="px-6 py-4">${(rma.valorProductos || 0).toLocaleString()}</td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    {rma.estado === 'solicitada' && (
                      <>
                        <button onClick={() => actualizarEstado(rma.id, 'aprobada')} className="text-green-600 hover:text-green-800" title="Aprobar">
                          <CheckCircle className="h-4 w-4" />
                        </button>
                        <button onClick={() => actualizarEstado(rma.id, 'rechazada')} className="text-red-600 hover:text-red-800" title="Rechazar">
                          <XCircle className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {rma.estado === 'aprobada' && (
                      <button onClick={() => actualizarEstado(rma.id, 'en_transito')} className="text-blue-600 hover:text-blue-800" title="En Tránsito">
                        <Clock className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Crear RMA */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full">
            <h3 className="text-xl font-bold mb-4">Nueva Devolución (RMA)</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Cliente *</label>
                <select value={newRMA.clienteId} onChange={(e) => setNewRMA({ ...newRMA, clienteId: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="">Seleccionar cliente</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tipo *</label>
                <select value={newRMA.tipo} onChange={(e) => setNewRMA({ ...newRMA, tipo: e.target.value as any })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="garantia">Garantía</option>
                  <option value="defecto">Defecto</option>
                  <option value="error_envio">Error de Envío</option>
                  <option value="no_conforme">No Conforme</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Motivo *</label>
                <textarea value={newRMA.motivo} onChange={(e) => setNewRMA({ ...newRMA, motivo: e.target.value })} rows={3} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Resolución Esperada</label>
                <select value={newRMA.resolucionEsperada} onChange={(e) => setNewRMA({ ...newRMA, resolucionEsperada: e.target.value as any })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="reembolso">Reembolso</option>
                  <option value="reemplazo">Reemplazo</option>
                  <option value="credito">Crédito</option>
                  <option value="reparacion">Reparación</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={crearRMA} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Crear RMA</button>
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
