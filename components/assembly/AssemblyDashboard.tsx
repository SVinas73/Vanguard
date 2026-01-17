'use client';

import React, { useState, useEffect } from 'react';
import { Wrench, Plus, RefreshCw, Play, CheckCircle, Clock, Package } from 'lucide-react';
import { useSupabaseStore } from '@/store/supabase-store';
import { validarDisponibilidadComponentes, ejecutarEnsamblaje } from '@/lib/assembly-utils';

export default function AssemblyDashboard() {
  const supabase = useSupabaseStore((state) => state.supabase);
  const usuario = useSupabaseStore((state) => state.user);

  const [ensamblajes, setEnsamblajes] = useState<any[]>([]);
  const [boms, setBoms] = useState<any[]>([]);
  const [almacenes, setAlmacenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [newAssembly, setNewAssembly] = useState({
    bomId: '',
    cantidadPlanificada: 1,
    almacenId: '',
    generarSeriales: false,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [{ data: ensamblajes }, { data: boms }, { data: almacenes }] = await Promise.all([
        supabase.from('ensamblajes').select(`
          *,
          bom:bom(*),
          producto:productos(codigo, descripcion),
          almacen:almacenes(nombre)
        `).order('created_at', { ascending: false }),
        supabase.from('bom').select('*, producto:productos(*)').eq('estado', 'activo'),
        supabase.from('almacenes').select('*').eq('activo', true),
      ]);

      setEnsamblajes(ensamblajes || []);
      setBoms(boms || []);
      setAlmacenes(almacenes || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const crearEnsamblaje = async () => {
    try {
      if (!newAssembly.bomId || !newAssembly.almacenId) {
        alert('Complete todos los campos');
        return;
      }

      const bom = boms.find((b) => b.id === newAssembly.bomId);
      if (!bom) return;

      // Validar componentes
      const validacion = await validarDisponibilidadComponentes(
        supabase,
        newAssembly.bomId,
        newAssembly.cantidadPlanificada
      );

      if (!validacion.puedeEnsamblar) {
        alert(`Componentes insuficientes:\n${validacion.faltantes.map((f: any) => `${f.descripcion}: falta ${f.faltante}`).join('\n')}`);
        return;
      }

      const numero = `ASM-${Date.now().toString().slice(-8)}`;

      const { error } = await supabase.from('ensamblajes').insert([{
        numero,
        bom_id: newAssembly.bomId,
        producto_codigo: bom.productoCodigo,
        tipo: 'ensamblaje',
        cantidad_planificada: newAssembly.cantidadPlanificada,
        estado: 'planificado',
        almacen_id: newAssembly.almacenId,
        requiere_inspeccion: true,
        fecha_planificada: new Date().toISOString(),
        creado_por: usuario?.email,
      }]);

      if (error) throw error;

      alert('Ensamblaje creado. Ejecute para producir.');
      setShowModal(false);
      loadData();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const ejecutar = async (ensamblaje: any) => {
    if (!confirm(`¿Iniciar producción de ${ensamblaje.cantidadPlanificada} unidades?`)) return;

    try {
      await supabase.from('ensamblajes').update({
        estado: 'en_proceso',
        fecha_inicio: new Date().toISOString(),
      }).eq('id', ensamblaje.id);

      const resultado = await ejecutarEnsamblaje(supabase, {
        ensamblaje: ensamblaje.numero,
        bomId: ensamblaje.bomId,
        productoCodigo: ensamblaje.productoCodigo,
        cantidadProducida: ensamblaje.cantidadPlanificada,
        almacenId: ensamblaje.almacenId,
        usuarioEmail: usuario?.email || '',
        generarSeriales: newAssembly.generarSeriales,
      });

      if (resultado.success) {
        alert(resultado.mensaje);
        loadData();
      } else {
        throw new Error(resultado.mensaje);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
      await supabase.from('ensamblajes').update({ estado: 'planificado' }).eq('id', ensamblaje.id);
    }
  };

  const stats = {
    total: ensamblajes.length,
    completados: ensamblajes.filter((e) => e.estado === 'completado').length,
    enProceso: ensamblajes.filter((e) => e.estado === 'en_proceso').length,
  };

  if (loading) return <div className="flex items-center justify-center p-8"><RefreshCw className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Wrench className="h-6 w-6" />
            Ensamblajes y Producción
          </h2>
          <p className="text-gray-600 text-sm">Control de procesos de ensamblaje</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="h-4 w-4" />
          Nuevo Ensamblaje
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-sm text-gray-600">Total</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-blue-600">{stats.enProceso}</div>
          <div className="text-sm text-gray-600">En Proceso</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-green-600">{stats.completados}</div>
          <div className="text-sm text-gray-600">Completados</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Número</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cantidad</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">BOM</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {ensamblajes.map((asm) => (
              <tr key={asm.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">{asm.numero}</td>
                <td className="px-6 py-4">{asm.producto?.descripcion}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Package className="h-4 w-4 inline mr-1" />
                  {asm.cantidadProducida || 0} / {asm.cantidadPlanificada}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    asm.estado === 'completado' ? 'bg-green-100 text-green-800' :
                    asm.estado === 'en_proceso' ? 'bg-blue-100 text-blue-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {asm.estado.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">v{asm.bom?.version}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {asm.estado === 'planificado' && (
                    <button onClick={() => ejecutar(asm)} className="text-green-600 hover:text-green-800" title="Ejecutar">
                      <Play className="h-4 w-4" />
                    </button>
                  )}
                  {asm.estado === 'completado' && <CheckCircle className="h-4 w-4 text-green-600" />}
                  {asm.estado === 'en_proceso' && <Clock className="h-4 w-4 text-blue-600 animate-pulse" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Nuevo Ensamblaje</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">BOM *</label>
                <select value={newAssembly.bomId} onChange={(e) => setNewAssembly({ ...newAssembly, bomId: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="">Seleccionar BOM</option>
                  {boms.map((b) => (
                    <option key={b.id} value={b.id}>{b.producto.descripcion} - v{b.version}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Cantidad *</label>
                <input type="number" min="1" value={newAssembly.cantidadPlanificada} onChange={(e) => setNewAssembly({ ...newAssembly, cantidadPlanificada: parseInt(e.target.value) || 1 })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Almacén *</label>
                <select value={newAssembly.almacenId} onChange={(e) => setNewAssembly({ ...newAssembly, almacenId: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="">Seleccionar almacén</option>
                  {almacenes.map((a) => (
                    <option key={a.id} value={a.id}>{a.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={newAssembly.generarSeriales} onChange={(e) => setNewAssembly({ ...newAssembly, generarSeriales: e.target.checked })} id="seriales" />
                <label htmlFor="seriales" className="text-sm">Generar seriales automáticamente</label>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={crearEnsamblaje} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Crear</button>
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
