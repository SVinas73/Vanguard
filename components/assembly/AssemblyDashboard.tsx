'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Wrench, Plus, RefreshCw, Play, CheckCircle, Clock, Package, X, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { BOM, Almacen } from '@/types';

interface Ensamblaje {
  id: string;
  numero: string;
  bomId: string;
  bom?: BOM;
  productoCodigo: string;
  producto?: { codigo: string; descripcion: string };
  tipo: string;
  cantidadPlanificada: number;
  cantidadProducida?: number;
  estado: string;
  almacenId: string;
  almacen?: Almacen;
  fechaPlanificada?: string;
  fechaInicio?: string;
  fechaFin?: string;
  creadoPor?: string;
}

export default function AssemblyDashboard() {
  const { user } = useAuth();

  const [ensamblajes, setEnsamblajes] = useState<Ensamblaje[]>([]);
  const [boms, setBoms] = useState<BOM[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [procesando, setProcesando] = useState<string | null>(null);

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

      const [ensamblajesRes, bomsRes, almacenesRes] = await Promise.all([
        supabase
          .from('ensamblajes')
          .select(`
            *,
            bom:bom(*),
            producto:productos(codigo, descripcion),
            almacen:almacenes(nombre)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('bom')
          .select('*, producto:productos(*)')
          .eq('estado', 'activo'),
        supabase
          .from('almacenes')
          .select('*')
          .eq('activo', true),
      ]);

      setEnsamblajes(ensamblajesRes.data || []);
      setBoms(bomsRes.data || []);
      setAlmacenes(almacenesRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Validar disponibilidad de componentes
  const validarComponentes = async (bomId: string, cantidad: number) => {
    try {
      // Obtener items del BOM
      const { data: bomItems } = await supabase
        .from('bom_items')
        .select('componente_codigo, cantidad')
        .eq('bom_id', bomId);

      if (!bomItems || bomItems.length === 0) {
        return { puedeEnsamblar: false, faltantes: [{ descripcion: 'BOM sin componentes' }] };
      }

      const faltantes: any[] = [];

      for (const item of bomItems) {
        const cantidadNecesaria = item.cantidad * cantidad;

        // Verificar stock del componente
        const { data: producto } = await supabase
          .from('productos')
          .select('stock, descripcion')
          .eq('codigo', item.componente_codigo)
          .single();

        if (!producto || producto.stock < cantidadNecesaria) {
          faltantes.push({
            codigo: item.componente_codigo,
            descripcion: producto?.descripcion || item.componente_codigo,
            necesario: cantidadNecesaria,
            disponible: producto?.stock || 0,
            faltante: cantidadNecesaria - (producto?.stock || 0),
          });
        }
      }

      return {
        puedeEnsamblar: faltantes.length === 0,
        faltantes,
      };
    } catch (error) {
      console.error('Error validando componentes:', error);
      return { puedeEnsamblar: false, faltantes: [{ descripcion: 'Error al validar' }] };
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
      const validacion = await validarComponentes(newAssembly.bomId, newAssembly.cantidadPlanificada);

      if (!validacion.puedeEnsamblar) {
        const mensaje = validacion.faltantes
          .map((f: any) => `${f.descripcion}: falta ${f.faltante}`)
          .join('\n');
        alert(`Componentes insuficientes:\n${mensaje}`);
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
        creado_por: user?.email,
      }]);

      if (error) throw error;

      alert('Ensamblaje creado. Ejecute para producir.');
      setShowModal(false);
      setNewAssembly({ bomId: '', cantidadPlanificada: 1, almacenId: '', generarSeriales: false });
      loadData();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const ejecutarEnsamblaje = async (ensamblaje: Ensamblaje) => {
    if (!confirm(`¿Iniciar producción de ${ensamblaje.cantidadPlanificada} unidades?`)) return;

    try {
      setProcesando(ensamblaje.id);

      // 1. Marcar como en proceso
      await supabase.from('ensamblajes').update({
        estado: 'en_proceso',
        fecha_inicio: new Date().toISOString(),
      }).eq('id', ensamblaje.id);

      // 2. Obtener items del BOM
      const { data: bomItems } = await supabase
        .from('bom_items')
        .select('componente_codigo, cantidad')
        .eq('bom_id', ensamblaje.bomId);

      if (!bomItems) throw new Error('No se encontraron componentes del BOM');

      // 3. Descontar componentes del inventario
      for (const item of bomItems) {
        const cantidadDescontar = item.cantidad * ensamblaje.cantidadPlanificada;

        // Obtener stock actual
        const { data: producto } = await supabase
          .from('productos')
          .select('stock')
          .eq('codigo', item.componente_codigo)
          .single();

        if (!producto) throw new Error(`Producto ${item.componente_codigo} no encontrado`);

        // Actualizar stock
        const nuevoStock = producto.stock - cantidadDescontar;
        if (nuevoStock < 0) throw new Error(`Stock insuficiente para ${item.componente_codigo}`);

        await supabase
          .from('productos')
          .update({ stock: nuevoStock })
          .eq('codigo', item.componente_codigo);

        // Registrar movimiento de salida
        await supabase.from('movimientos').insert([{
          codigo: item.componente_codigo,
          tipo: 'salida',
          cantidad: cantidadDescontar,
          usuario: user?.email || 'Sistema',
          notas: `Consumo para ensamblaje ${ensamblaje.numero}`,
        }]);
      }

      // 4. Incrementar stock del producto ensamblado
      const { data: productoFinal } = await supabase
        .from('productos')
        .select('stock')
        .eq('codigo', ensamblaje.productoCodigo)
        .single();

      if (productoFinal) {
        await supabase
          .from('productos')
          .update({ stock: productoFinal.stock + ensamblaje.cantidadPlanificada })
          .eq('codigo', ensamblaje.productoCodigo);

        // Registrar movimiento de entrada
        await supabase.from('movimientos').insert([{
          codigo: ensamblaje.productoCodigo,
          tipo: 'entrada',
          cantidad: ensamblaje.cantidadPlanificada,
          usuario: user?.email || 'Sistema',
          notas: `Producción ensamblaje ${ensamblaje.numero}`,
        }]);
      }

      // 5. Marcar como completado
      await supabase.from('ensamblajes').update({
        estado: 'completado',
        cantidad_producida: ensamblaje.cantidadPlanificada,
        fecha_fin: new Date().toISOString(),
      }).eq('id', ensamblaje.id);

      alert(`Ensamblaje completado: ${ensamblaje.cantidadPlanificada} unidades producidas`);
      loadData();
    } catch (error: any) {
      console.error('Error ejecutando ensamblaje:', error);
      alert(`Error: ${error.message}`);
      // Revertir estado
      await supabase.from('ensamblajes').update({ estado: 'planificado' }).eq('id', ensamblaje.id);
    } finally {
      setProcesando(null);
    }
  };

  const stats = useMemo(() => ({
    total: ensamblajes.length,
    completados: ensamblajes.filter((e) => e.estado === 'completado').length,
    enProceso: ensamblajes.filter((e) => e.estado === 'en_proceso').length,
    planificados: ensamblajes.filter((e) => e.estado === 'planificado').length,
  }), [ensamblajes]);

  const getEstadoColor = (estado: string) => {
    const colors: Record<string, string> = {
      planificado: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      en_proceso: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      completado: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      cancelado: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return colors[estado] || 'bg-slate-500/20 text-slate-400';
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
            <Wrench className="h-7 w-7 text-emerald-400" />
            Ensamblajes y Producción
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Control de procesos de ensamblaje
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nuevo Ensamblaje
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'blue' },
          { label: 'Planificados', value: stats.planificados, color: 'yellow' },
          { label: 'En Proceso', value: stats.enProceso, color: 'cyan' },
          { label: 'Completados', value: stats.completados, color: 'emerald' },
        ].map((stat, i) => (
          <div key={i} className={`bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 border-l-4 border-l-${stat.color}-500`}>
            <div className={`text-2xl font-bold text-${stat.color}-400`}>{stat.value}</div>
            <div className="text-sm text-slate-500">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Número</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Producto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Cantidad</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">BOM</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {ensamblajes.map((asm) => (
                <tr key={asm.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 font-mono text-sm text-slate-200">{asm.numero}</td>
                  <td className="px-6 py-4 text-slate-300">{asm.producto?.descripcion}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Package className="h-4 w-4 text-slate-500" />
                      {asm.cantidadProducida || 0} / {asm.cantidadPlanificada}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-xs border ${getEstadoColor(asm.estado)}`}>
                      {asm.estado.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400">
                    v{asm.bom?.version}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {asm.estado === 'planificado' && (
                        <button
                          onClick={() => ejecutarEnsamblaje(asm)}
                          disabled={procesando === asm.id}
                          className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                          title="Ejecutar"
                        >
                          {procesando === asm.id ? (
                            <RefreshCw className="h-4 w-4 text-blue-400 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4 text-emerald-400" />
                          )}
                        </button>
                      )}
                      {asm.estado === 'completado' && (
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                      )}
                      {asm.estado === 'en_proceso' && (
                        <Clock className="h-4 w-4 text-blue-400 animate-pulse" />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {ensamblajes.length === 0 && (
            <div className="text-center py-12">
              <Wrench className="mx-auto h-12 w-12 text-slate-600" />
              <p className="mt-2 text-sm text-slate-500">No hay ensamblajes registrados</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Nuevo Ensamblaje */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-100 mb-4">Nuevo Ensamblaje</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">BOM *</label>
                  <select
                    value={newAssembly.bomId}
                    onChange={(e) => setNewAssembly({ ...newAssembly, bomId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  >
                    <option value="">Seleccionar BOM</option>
                    {boms.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.producto?.descripcion} - v{b.version}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Cantidad *</label>
                  <input
                    type="number"
                    min="1"
                    value={newAssembly.cantidadPlanificada}
                    onChange={(e) => setNewAssembly({ ...newAssembly, cantidadPlanificada: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Almacén *</label>
                  <select
                    value={newAssembly.almacenId}
                    onChange={(e) => setNewAssembly({ ...newAssembly, almacenId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                  >
                    <option value="">Seleccionar almacén</option>
                    {almacenes.map((a) => (
                      <option key={a.id} value={a.id}>{a.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newAssembly.generarSeriales}
                    onChange={(e) => setNewAssembly({ ...newAssembly, generarSeriales: e.target.checked })}
                    id="seriales"
                    className="rounded"
                  />
                  <label htmlFor="seriales" className="text-sm text-slate-400">
                    Generar seriales automáticamente
                  </label>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={crearEnsamblaje}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors"
                >
                  Crear
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}