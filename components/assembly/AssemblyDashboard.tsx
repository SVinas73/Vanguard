'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Wrench, Plus, RefreshCw, Play, Pause, CheckCircle, Clock, Package,
  X, AlertTriangle, Eye, ChevronDown, ChevronRight, Search,
  BarChart3, ClipboardCheck, History, Hash, PlayCircle, PauseCircle,
  StopCircle, Timer, DollarSign, TrendingUp, TrendingDown, Minus,
  FileText, Calendar
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  Ensamblaje, BOM, Almacen, EstadoEnsamblaje, TipoEnsamblaje,
  EnsamblajeOperacion, MotivoPausa, ResultadoInspeccionQC, TipoInspeccionQC
} from '@/types';

// ============================================
// TIPOS LOCALES
// ============================================

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface EnsamblajeDashboard extends Omit<Ensamblaje, 'producto' | 'bom'> {
  bom?: BOM & { producto?: { codigo: string; descripcion: string; precio: number } };
  producto?: { codigo: string; descripcion: string };
  almacen?: Almacen;
  operaciones?: EnsamblajeOperacion[];
  costoTotalPlanificado?: number;
}

type ModalType = 'create' | 'view' | 'qc' | 'pause' | null;
type FilterEstado = EstadoEnsamblaje | 'todos';

// ============================================
// HOOK DE TOAST LOCAL
// ============================================

function useLocalToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => removeToast(id), type === 'error' ? 6000 : 4000);
  }, [removeToast]);

  return {
    toasts,
    removeToast,
    success: (title: string, msg?: string) => addToast('success', title, msg),
    error: (title: string, msg?: string) => addToast('error', title, msg),
    warning: (title: string, msg?: string) => addToast('warning', title, msg),
    info: (title: string, msg?: string) => addToast('info', title, msg),
  };
}

// ============================================
// TOAST CONTAINER
// ============================================

function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  if (!toasts.length) return null;
  
  const icons = {
    success: <CheckCircle className="h-5 w-5 text-emerald-400" />,
    error: <X className="h-5 w-5 text-red-400" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-400" />,
    info: <Clock className="h-5 w-5 text-blue-400" />,
  };
  
  const colors = {
    success: 'border-emerald-500/30 bg-emerald-500/10',
    error: 'border-red-500/30 bg-red-500/10',
    warning: 'border-amber-500/30 bg-amber-500/10',
    info: 'border-blue-500/30 bg-blue-500/10',
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div 
          key={t.id} 
          className={`flex items-start gap-3 p-4 bg-slate-900 border ${colors[t.type]} rounded-xl shadow-lg`}
          style={{ animation: 'slideIn 0.3s ease-out' }}
        >
          {icons[t.type]}
          <div className="flex-1">
            <p className="font-medium text-slate-200">{t.title}</p>
            {t.message && <p className="text-sm text-slate-400 mt-0.5">{t.message}</p>}
          </div>
          <button onClick={() => removeToast(t.id)} className="text-slate-500 hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function AssemblyDashboard() {
  const { user } = useAuth();
  const toast = useLocalToast();

  // Estado principal
  const [ensamblajes, setEnsamblajes] = useState<EnsamblajeDashboard[]>([]);
  const [boms, setBoms] = useState<BOM[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState<FilterEstado>('todos');
  const [filterTipo, setFilterTipo] = useState<TipoEnsamblaje | 'todos'>('todos');

  // UI
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [modalType, setModalType] = useState<ModalType>(null);
  const [selectedEnsamblaje, setSelectedEnsamblaje] = useState<EnsamblajeDashboard | null>(null);

  // Forms
  const [newAssembly, setNewAssembly] = useState({
    bomId: '',
    cantidadPlanificada: 1,
    almacenId: '',
    supervisor: '',
    generarSeriales: false,
    notas: '',
  });

  const [qcForm, setQcForm] = useState({
    tipoInspeccion: 'final' as TipoInspeccionQC,
    cantidadInspeccionada: 0,
    cantidadAprobada: 0,
    cantidadRechazada: 0,
    resultado: 'aprobado' as ResultadoInspeccionQC,
    notas: '',
  });

  const [pauseForm, setPauseForm] = useState({
    motivo: 'otro' as MotivoPausa,
    descripcion: '',
  });

  // ============================================
  // CARGA DE DATOS
  // ============================================

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
            bom:bom(*, producto:productos!bom_producto_codigo_fkey(codigo, descripcion, precio)),
            producto:productos(codigo, descripcion),
            almacen:almacenes(id, codigo, nombre)
          `)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('bom')
          .select('*, producto:productos!bom_producto_codigo_fkey(codigo, descripcion, precio)')
          .eq('estado', 'activo'),
        supabase
          .from('almacenes')
          .select('*')
          .eq('activo', true),
      ]);

      if (ensamblajesRes.error) throw ensamblajesRes.error;

      // Mapear datos
      const ensamblajesMapped = (ensamblajesRes.data || []).map((e: any) => ({
        id: e.id,
        numero: e.numero,
        bomId: e.bom_id,
        bom: e.bom,
        productoCodigo: e.producto_codigo,
        producto: e.producto,
        productoDescripcion: e.producto_descripcion,
        tipo: e.tipo,
        cantidadPlanificada: parseFloat(e.cantidad_planificada) || 0,
        cantidadProducida: parseFloat(e.cantidad_producida) || 0,
        cantidadAprobada: parseFloat(e.cantidad_aprobada) || 0,
        cantidadRechazada: parseFloat(e.cantidad_rechazada) || 0,
        estado: e.estado,
        almacenId: e.almacen_id,
        almacen: e.almacen,
        fechaPlanificada: e.fecha_planificada,
        fechaInicio: e.fecha_inicio,
        fechaFin: e.fecha_fin,
        duracionRealMinutos: e.duracion_real_minutos,
        supervisor: e.supervisor,
        requiereInspeccion: e.requiere_inspeccion,
        resultadoQc: e.resultado_qc,
        costoMaterialesReal: parseFloat(e.costo_materiales_real) || 0,
        costoManoObraReal: parseFloat(e.costo_mano_obra_real) || 0,
        costoTotalReal: parseFloat(e.costo_total_real) || 0,
        costoTotalPlanificado: e.bom ? (parseFloat(e.bom.costo_total) || 0) * (parseFloat(e.cantidad_planificada) || 1) : 0,
        notas: e.notas,
        creadoPor: e.creado_por,
        createdAt: e.created_at,
      }));

      setEnsamblajes(ensamblajesMapped);
      setBoms(bomsRes.data || []);
      setAlmacenes(almacenesRes.data || []);
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos', error.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // FILTROS Y STATS
  // ============================================

  const ensamblajesFiltrados = useMemo(() => {
    return ensamblajes.filter((e) => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (
          !e.numero?.toLowerCase().includes(search) &&
          !e.producto?.descripcion?.toLowerCase().includes(search) &&
          !e.productoCodigo?.toLowerCase().includes(search)
        ) {
          return false;
        }
      }
      if (filterEstado !== 'todos' && e.estado !== filterEstado) return false;
      if (filterTipo !== 'todos' && e.tipo !== filterTipo) return false;
      return true;
    });
  }, [ensamblajes, searchTerm, filterEstado, filterTipo]);

  const stats = useMemo(() => {
    const total = ensamblajes.length;
    const completados = ensamblajes.filter((e) => e.estado === 'completado').length;
    const enProceso = ensamblajes.filter((e) => e.estado === 'en_proceso').length;
    const pausados = ensamblajes.filter((e) => e.estado === 'pausado').length;
    const planificados = ensamblajes.filter((e) => e.estado === 'planificado').length;

    const costoTotalReal = ensamblajes.reduce((sum, e) => sum + (e.costoTotalReal || 0), 0);
    const costoTotalPlan = ensamblajes.reduce((sum, e) => sum + (e.costoTotalPlanificado || 0), 0);
    const variacionCosto = costoTotalPlan > 0 ? ((costoTotalReal - costoTotalPlan) / costoTotalPlan) * 100 : 0;

    const totalProducido = ensamblajes.reduce((sum, e) => sum + (e.cantidadProducida || 0), 0);
    const totalPlanificado = ensamblajes.reduce((sum, e) => sum + (e.cantidadPlanificada || 0), 0);
    const rendimiento = totalPlanificado > 0 ? (totalProducido / totalPlanificado) * 100 : 0;

    return { total, completados, enProceso, pausados, planificados, costoTotalReal, costoTotalPlan, variacionCosto, rendimiento };
  }, [ensamblajes]);

  // ============================================
  // VALIDAR COMPONENTES
  // ============================================

  const validarComponentes = async (bomId: string, cantidad: number) => {
    try {
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

      return { puedeEnsamblar: faltantes.length === 0, faltantes };
    } catch (error) {
      console.error('Error validando componentes:', error);
      return { puedeEnsamblar: false, faltantes: [{ descripcion: 'Error al validar' }] };
    }
  };

  // ============================================
  // ACCIONES PRINCIPALES
  // ============================================

  const registrarOperacion = async (ensamblajeId: string, tipo: string, descripcion: string, datos?: any) => {
    await supabase.from('ensamblaje_operaciones').insert([{
      ensamblaje_id: ensamblajeId,
      tipo,
      descripcion,
      datos: datos || null,
      ejecutado_por: user?.email || 'Sistema',
    }]);
  };

  const crearEnsamblaje = async () => {
    try {
      if (!newAssembly.bomId || !newAssembly.almacenId) {
        toast.warning('Campos requeridos', 'Seleccione BOM y almacén');
        return;
      }

      setProcesando('creating');

      const bom = boms.find((b) => b.id === newAssembly.bomId);
      if (!bom) {
        toast.error('Error', 'BOM no encontrado');
        return;
      }

      const validacion = await validarComponentes(newAssembly.bomId, newAssembly.cantidadPlanificada);

      if (!validacion.puedeEnsamblar) {
        const faltantesMsg = validacion.faltantes
          .slice(0, 3)
          .map((f: any) => `${f.descripcion}: faltan ${f.faltante}`)
          .join(', ');
        toast.error('Componentes insuficientes', faltantesMsg);
        return;
      }

      const numero = `ASM-${Date.now().toString().slice(-8)}`;

      const { error } = await supabase.from('ensamblajes').insert([{
        numero,
        bom_id: newAssembly.bomId,
        producto_codigo: bom.productoCodigo,
        producto_descripcion: bom.producto?.descripcion,
        tipo: 'ensamblaje',
        cantidad_planificada: newAssembly.cantidadPlanificada,
        estado: 'planificado',
        almacen_id: newAssembly.almacenId,
        supervisor: newAssembly.supervisor || null,
        requiere_inspeccion: true,
        fecha_planificada: new Date().toISOString(),
        notas: newAssembly.notas || null,
        creado_por: user?.email,
      }]);

      if (error) throw error;

      toast.success('Ensamblaje creado', `Orden ${numero} lista para ejecutar`);
      setModalType(null);
      setNewAssembly({ bomId: '', cantidadPlanificada: 1, almacenId: '', supervisor: '', generarSeriales: false, notas: '' });
      loadData();
    } catch (error: any) {
      toast.error('Error al crear', error.message);
    } finally {
      setProcesando(null);
    }
  };

  const iniciarEnsamblaje = async (ensamblaje: EnsamblajeDashboard) => {
    try {
      setProcesando(ensamblaje.id);

      const validacion = await validarComponentes(ensamblaje.bomId, ensamblaje.cantidadPlanificada);
      if (!validacion.puedeEnsamblar) {
        toast.error('No se puede iniciar', 'Componentes insuficientes');
        return;
      }

      await supabase.from('ensamblajes').update({
        estado: 'en_proceso',
        fecha_inicio: new Date().toISOString(),
        actualizado_por: user?.email,
      }).eq('id', ensamblaje.id);

      await registrarOperacion(ensamblaje.id, 'inicio', 'Ensamblaje iniciado');

      toast.success('Ensamblaje iniciado', `Orden ${ensamblaje.numero} en proceso`);
      loadData();
    } catch (error: any) {
      toast.error('Error al iniciar', error.message);
    } finally {
      setProcesando(null);
    }
  };

  const pausarEnsamblaje = async () => {
    if (!selectedEnsamblaje) return;

    try {
      setProcesando(selectedEnsamblaje.id);

      await supabase.from('ensamblajes').update({
        estado: 'pausado',
        actualizado_por: user?.email,
      }).eq('id', selectedEnsamblaje.id);

      await supabase.from('ensamblaje_pausas').insert([{
        ensamblaje_id: selectedEnsamblaje.id,
        motivo: pauseForm.motivo,
        descripcion: pauseForm.descripcion || null,
        pausado_por: user?.email,
      }]);

      await registrarOperacion(selectedEnsamblaje.id, 'pausa', `Pausa: ${pauseForm.motivo}`);

      toast.warning('Ensamblaje pausado', `Motivo: ${pauseForm.motivo}`);
      setModalType(null);
      setPauseForm({ motivo: 'otro', descripcion: '' });
      loadData();
    } catch (error: any) {
      toast.error('Error al pausar', error.message);
    } finally {
      setProcesando(null);
    }
  };

  const reanudarEnsamblaje = async (ensamblaje: EnsamblajeDashboard) => {
    try {
      setProcesando(ensamblaje.id);

      await supabase.from('ensamblajes').update({
        estado: 'en_proceso',
        actualizado_por: user?.email,
      }).eq('id', ensamblaje.id);

      const { data: pausaActiva } = await supabase
        .from('ensamblaje_pausas')
        .select('id, fecha_pausa')
        .eq('ensamblaje_id', ensamblaje.id)
        .is('fecha_reanudacion', null)
        .single();

      if (pausaActiva) {
        const duracion = Math.round((new Date().getTime() - new Date(pausaActiva.fecha_pausa).getTime()) / 60000);
        await supabase.from('ensamblaje_pausas').update({
          fecha_reanudacion: new Date().toISOString(),
          duracion_minutos: duracion,
          reanudado_por: user?.email,
        }).eq('id', pausaActiva.id);
      }

      await registrarOperacion(ensamblaje.id, 'reanudacion', 'Ensamblaje reanudado');

      toast.success('Ensamblaje reanudado', `Orden ${ensamblaje.numero} continúa`);
      loadData();
    } catch (error: any) {
      toast.error('Error al reanudar', error.message);
    } finally {
      setProcesando(null);
    }
  };

  const completarEnsamblaje = async (ensamblaje: EnsamblajeDashboard) => {
    try {
      setProcesando(ensamblaje.id);

      const { data: bomItems } = await supabase
        .from('bom_items')
        .select('componente_codigo, componente_descripcion, cantidad, costo_unitario')
        .eq('bom_id', ensamblaje.bomId);

      if (!bomItems || bomItems.length === 0) throw new Error('BOM sin componentes');

      let costoMaterialesReal = 0;

      for (const item of bomItems) {
        const cantidadDescontar = item.cantidad * ensamblaje.cantidadPlanificada;

        const { data: producto } = await supabase
          .from('productos')
          .select('stock, costo_promedio, precio')
          .eq('codigo', item.componente_codigo)
          .single();

        if (!producto) throw new Error(`Producto ${item.componente_codigo} no encontrado`);
        if (producto.stock < cantidadDescontar) throw new Error(`Stock insuficiente: ${item.componente_codigo}`);

        const costoUnitario = producto.costo_promedio || producto.precio || item.costo_unitario || 0;
        costoMaterialesReal += costoUnitario * cantidadDescontar;

        await supabase.from('productos').update({ stock: producto.stock - cantidadDescontar }).eq('codigo', item.componente_codigo);

        await supabase.from('movimientos').insert([{
          codigo: item.componente_codigo,
          tipo: 'salida',
          cantidad: cantidadDescontar,
          usuario: user?.email || 'Sistema',
          notas: `Consumo ensamblaje ${ensamblaje.numero}`,
        }]);

        await supabase.from('ensamblaje_consumos').insert([{
          ensamblaje_id: ensamblaje.id,
          componente_codigo: item.componente_codigo,
          componente_descripcion: item.componente_descripcion,
          cantidad_planificada: item.cantidad * ensamblaje.cantidadPlanificada,
          cantidad_consumida: cantidadDescontar,
          cantidad_desperdicio: 0,
          costo_unitario: costoUnitario,
          costo_total: costoUnitario * cantidadDescontar,
          consumido_por: user?.email,
        }]);
      }

      const { data: productoFinal } = await supabase
        .from('productos')
        .select('stock')
        .eq('codigo', ensamblaje.productoCodigo)
        .single();

      if (productoFinal) {
        await supabase.from('productos').update({ stock: productoFinal.stock + ensamblaje.cantidadPlanificada }).eq('codigo', ensamblaje.productoCodigo);

        await supabase.from('movimientos').insert([{
          codigo: ensamblaje.productoCodigo,
          tipo: 'entrada',
          cantidad: ensamblaje.cantidadPlanificada,
          usuario: user?.email || 'Sistema',
          notas: `Producción ensamblaje ${ensamblaje.numero}`,
        }]);
      }

      // Generar seriales
      for (let i = 1; i <= ensamblaje.cantidadPlanificada; i++) {
        const serial = `${ensamblaje.numero}-${i.toString().padStart(4, '0')}`;
        await supabase.from('ensamblaje_seriales').insert([{
          ensamblaje_id: ensamblaje.id,
          serial_number: serial,
          secuencia: i,
          estado: 'producido',
        }]);
      }

      const fechaInicio = ensamblaje.fechaInicio ? new Date(ensamblaje.fechaInicio) : new Date();
      const duracionMinutos = Math.round((new Date().getTime() - fechaInicio.getTime()) / 60000);

      await supabase.from('ensamblajes').update({
        estado: 'completado',
        cantidad_producida: ensamblaje.cantidadPlanificada,
        cantidad_aprobada: ensamblaje.cantidadPlanificada,
        fecha_fin: new Date().toISOString(),
        duracion_real_minutos: duracionMinutos,
        costo_materiales_real: costoMaterialesReal,
        costo_total_real: costoMaterialesReal,
        actualizado_por: user?.email,
      }).eq('id', ensamblaje.id);

      await registrarOperacion(ensamblaje.id, 'completado', `Producidas ${ensamblaje.cantidadPlanificada} unidades`);

      toast.success('Ensamblaje completado', `${ensamblaje.cantidadPlanificada} unidades producidas`);
      loadData();
    } catch (error: any) {
      console.error('Error completando ensamblaje:', error);
      toast.error('Error al completar', error.message);
    } finally {
      setProcesando(null);
    }
  };

  const registrarQC = async () => {
    if (!selectedEnsamblaje) return;

    try {
      setProcesando(selectedEnsamblaje.id);

      await supabase.from('ensamblaje_qc').insert([{
        ensamblaje_id: selectedEnsamblaje.id,
        tipo_inspeccion: qcForm.tipoInspeccion,
        numero_inspeccion: 1,
        cantidad_inspeccionada: qcForm.cantidadInspeccionada,
        cantidad_aprobada: qcForm.cantidadAprobada,
        cantidad_rechazada: qcForm.cantidadRechazada,
        cantidad_retrabajo: 0,
        resultado: qcForm.resultado,
        notas: qcForm.notas || null,
        inspector: user?.email || 'Sistema',
        fecha_inspeccion: new Date().toISOString(),
      }]);

      await supabase.from('ensamblajes').update({
        cantidad_aprobada: qcForm.cantidadAprobada,
        cantidad_rechazada: qcForm.cantidadRechazada,
        resultado_qc: qcForm.resultado,
        inspeccionado_por: user?.email,
        fecha_inspeccion: new Date().toISOString(),
        notas_qc: qcForm.notas,
        actualizado_por: user?.email,
      }).eq('id', selectedEnsamblaje.id);

      const tipoOp = qcForm.resultado === 'rechazado' ? 'qc_rechazado' : 'qc_aprobado';
      await registrarOperacion(selectedEnsamblaje.id, tipoOp, `QC: ${qcForm.cantidadAprobada} aprobadas, ${qcForm.cantidadRechazada} rechazadas`);

      toast.success('Inspección registrada', `Resultado: ${qcForm.resultado}`);
      setModalType(null);
      setQcForm({ tipoInspeccion: 'final', cantidadInspeccionada: 0, cantidadAprobada: 0, cantidadRechazada: 0, resultado: 'aprobado', notas: '' });
      loadData();
    } catch (error: any) {
      toast.error('Error al registrar QC', error.message);
    } finally {
      setProcesando(null);
    }
  };

  // ============================================
  // HELPERS UI
  // ============================================

  const getEstadoConfig = (estado: EstadoEnsamblaje) => {
    const config: Record<EstadoEnsamblaje, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
      planificado: { color: 'text-yellow-400', bg: 'bg-yellow-500/20 border-yellow-500/30', icon: <Calendar className="h-4 w-4" />, label: 'Planificado' },
      en_proceso: { color: 'text-blue-400', bg: 'bg-blue-500/20 border-blue-500/30', icon: <PlayCircle className="h-4 w-4 animate-pulse" />, label: 'En Proceso' },
      pausado: { color: 'text-amber-400', bg: 'bg-amber-500/20 border-amber-500/30', icon: <PauseCircle className="h-4 w-4" />, label: 'Pausado' },
      completado: { color: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/30', icon: <CheckCircle className="h-4 w-4" />, label: 'Completado' },
      cancelado: { color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30', icon: <StopCircle className="h-4 w-4" />, label: 'Cancelado' },
    };
    return config[estado];
  };

  const getVariacionIcon = (variacion: number) => {
    if (variacion > 5) return <TrendingUp className="h-4 w-4 text-red-400" />;
    if (variacion < -5) return <TrendingDown className="h-4 w-4 text-emerald-400" />;
    return <Minus className="h-4 w-4 text-slate-400" />;
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return '-';
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    newExpanded.has(id) ? newExpanded.delete(id) : newExpanded.add(id);
    setExpandedRows(newExpanded);
  };

  const abrirDetalles = async (ensamblaje: EnsamblajeDashboard) => {
    const { data: operaciones } = await supabase
      .from('ensamblaje_operaciones')
      .select('*')
      .eq('ensamblaje_id', ensamblaje.id)
      .order('created_at', { ascending: false });
    
    setSelectedEnsamblaje({ ...ensamblaje, operaciones: operaciones || [] });
    setModalType('view');
  };

  const abrirQC = (ensamblaje: EnsamblajeDashboard) => {
    setSelectedEnsamblaje(ensamblaje);
    setQcForm({
      ...qcForm,
      cantidadInspeccionada: ensamblaje.cantidadProducida || ensamblaje.cantidadPlanificada,
      cantidadAprobada: ensamblaje.cantidadProducida || ensamblaje.cantidadPlanificada,
    });
    setModalType('qc');
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <Wrench className="h-7 w-7 text-emerald-400" />
            Ensamblajes y Producción
          </h2>
          <p className="text-slate-400 text-sm mt-1">Control de procesos con trazabilidad completa</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModalType('create')} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors">
            <Plus className="h-4 w-4" />Nuevo Ensamblaje
          </button>
          <button onClick={loadData} disabled={loading} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors">
            <RefreshCw className={`h-4 w-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total', value: stats.total, icon: Package, color: 'blue' },
          { label: 'Planificados', value: stats.planificados, icon: Calendar, color: 'yellow' },
          { label: 'En Proceso', value: stats.enProceso, icon: PlayCircle, color: 'cyan' },
          { label: 'Pausados', value: stats.pausados, icon: PauseCircle, color: 'amber' },
          { label: 'Completados', value: stats.completados, icon: CheckCircle, color: 'emerald' },
          { label: 'Rendimiento', value: `${stats.rendimiento.toFixed(1)}%`, icon: BarChart3, color: stats.rendimiento >= 90 ? 'emerald' : 'yellow' },
        ].map((stat, i) => (
          <div key={i} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`h-4 w-4 text-${stat.color}-400`} />
              <span className="text-xs text-slate-500">{stat.label}</span>
            </div>
            <div className={`text-2xl font-bold text-${stat.color}-400`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Costos Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Costo Planificado</span>
            <DollarSign className="h-4 w-4 text-slate-500" />
          </div>
          <div className="text-xl font-bold text-slate-200">${stats.costoTotalPlan.toLocaleString()}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Costo Real</span>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-emerald-400">${stats.costoTotalReal.toLocaleString()}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Variación</span>
            {getVariacionIcon(stats.variacionCosto)}
          </div>
          <div className={`text-xl font-bold ${stats.variacionCosto > 5 ? 'text-red-400' : stats.variacionCosto < -5 ? 'text-emerald-400' : 'text-slate-300'}`}>
            {stats.variacionCosto > 0 ? '+' : ''}{stats.variacionCosto.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
            <input type="text" placeholder="Buscar por número, producto..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none" />
          </div>
          <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value as FilterEstado)} className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-100">
            <option value="todos">Todos los estados</option>
            <option value="planificado">Planificados</option>
            <option value="en_proceso">En Proceso</option>
            <option value="pausado">Pausados</option>
            <option value="completado">Completados</option>
          </select>
          <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value as TipoEnsamblaje | 'todos')} className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-100">
            <option value="todos">Todos los tipos</option>
            <option value="ensamblaje">Ensamblaje</option>
            <option value="desensamblaje">Desensamblaje</option>
          </select>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase w-8"></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Orden</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Producto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Cantidad</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Costo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Duración</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {ensamblajesFiltrados.map((asm) => {
                const estadoConfig = getEstadoConfig(asm.estado);
                const isExpanded = expandedRows.has(asm.id);
                const variacion = asm.costoTotalPlanificado && asm.costoTotalPlanificado > 0
                  ? ((asm.costoTotalReal || 0) - asm.costoTotalPlanificado) / asm.costoTotalPlanificado * 100 : 0;

                return (
                  <React.Fragment key={asm.id}>
                    <tr className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-4">
                        <button onClick={() => toggleRow(asm.id)} className="p-1 hover:bg-slate-700 rounded">
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-mono text-sm text-slate-200">{asm.numero}</div>
                        <div className="text-xs text-slate-500">{asm.bom ? `BOM v${asm.bom.version}` : '-'}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-slate-200">{asm.producto?.descripcion || asm.productoDescripcion}</div>
                        <div className="text-xs text-slate-500">{asm.productoCodigo}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-slate-500" />
                          <span className="text-slate-300">{asm.cantidadProducida || 0} / {asm.cantidadPlanificada}</span>
                        </div>
                        {asm.cantidadAprobada !== undefined && asm.estado === 'completado' && (
                          <div className="text-xs text-emerald-400 mt-1">✓ {asm.cantidadAprobada} aprobadas</div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border ${estadoConfig.bg} ${estadoConfig.color}`}>
                          {estadoConfig.icon}{estadoConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-slate-300">${(asm.costoTotalReal || 0).toLocaleString()}</div>
                        {variacion !== 0 && (
                          <div className={`text-xs flex items-center gap-1 ${variacion > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {getVariacionIcon(variacion)}{variacion > 0 ? '+' : ''}{variacion.toFixed(1)}%
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Timer className="h-4 w-4" />{formatDuration(asm.duracionRealMinutos)}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1">
                          <button onClick={() => abrirDetalles(asm)} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Ver detalles">
                            <Eye className="h-4 w-4 text-blue-400" />
                          </button>
                          {asm.estado === 'planificado' && (
                            <button onClick={() => iniciarEnsamblaje(asm)} disabled={procesando === asm.id} className="p-1.5 hover:bg-slate-700 rounded-lg disabled:opacity-50" title="Iniciar">
                              {procesando === asm.id ? <RefreshCw className="h-4 w-4 text-emerald-400 animate-spin" /> : <Play className="h-4 w-4 text-emerald-400" />}
                            </button>
                          )}
                          {asm.estado === 'en_proceso' && (
                            <button onClick={() => { setSelectedEnsamblaje(asm); setModalType('pause'); }} disabled={procesando === asm.id} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Pausar">
                              <Pause className="h-4 w-4 text-amber-400" />
                            </button>
                          )}
                          {asm.estado === 'pausado' && (
                            <button onClick={() => reanudarEnsamblaje(asm)} disabled={procesando === asm.id} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Reanudar">
                              <Play className="h-4 w-4 text-emerald-400" />
                            </button>
                          )}
                          {(asm.estado === 'en_proceso' || asm.estado === 'pausado') && (
                            <button onClick={() => completarEnsamblaje(asm)} disabled={procesando === asm.id} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Completar">
                              <CheckCircle className="h-4 w-4 text-emerald-400" />
                            </button>
                          )}
                          {asm.estado === 'completado' && (
                            <button onClick={() => abrirQC(asm)} className="p-1.5 hover:bg-slate-700 rounded-lg" title="Control de calidad">
                              <ClipboardCheck className="h-4 w-4 text-purple-400" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} className="px-4 py-4 bg-slate-800/20">
                          <TimelineInline ensamblajeId={asm.id} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {ensamblajesFiltrados.length === 0 && (
            <div className="text-center py-12">
              <Wrench className="mx-auto h-12 w-12 text-slate-600" />
              <p className="mt-2 text-sm text-slate-500">No hay ensamblajes que mostrar</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Crear */}
      {modalType === 'create' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2"><Plus className="h-5 w-5 text-emerald-400" />Nuevo Ensamblaje</h3>
              <button onClick={() => setModalType(null)} className="p-2 hover:bg-slate-800 rounded-lg"><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">BOM *</label>
                <select value={newAssembly.bomId} onChange={(e) => setNewAssembly({ ...newAssembly, bomId: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                  <option value="">Seleccionar BOM</option>
                  {boms.map((b) => <option key={b.id} value={b.id}>{b.producto?.descripcion || b.productoCodigo} - v{b.version}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Cantidad *</label>
                <input type="number" min="1" value={newAssembly.cantidadPlanificada} onChange={(e) => setNewAssembly({ ...newAssembly, cantidadPlanificada: parseInt(e.target.value) || 1 })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Almacén *</label>
                <select value={newAssembly.almacenId} onChange={(e) => setNewAssembly({ ...newAssembly, almacenId: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                  <option value="">Seleccionar almacén</option>
                  {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Supervisor</label>
                <input type="text" value={newAssembly.supervisor} onChange={(e) => setNewAssembly({ ...newAssembly, supervisor: e.target.value })} placeholder="Nombre del supervisor" className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500" />
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl">
                <input type="checkbox" id="genSeriales" checked={newAssembly.generarSeriales} onChange={(e) => setNewAssembly({ ...newAssembly, generarSeriales: e.target.checked })} className="w-4 h-4 rounded" />
                <label htmlFor="genSeriales" className="text-sm text-slate-300">Generar seriales automáticamente</label>
              </div>
              {newAssembly.bomId && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                  <h4 className="text-sm font-semibold text-emerald-400 mb-2">Costo Estimado</h4>
                  <div className="text-2xl font-bold text-emerald-300">
                    ${((boms.find(b => b.id === newAssembly.bomId)?.costoTotal || 0) * newAssembly.cantidadPlanificada).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
              <button onClick={crearEnsamblaje} disabled={!newAssembly.bomId || !newAssembly.almacenId || procesando === 'creating'} className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2">
                {procesando === 'creating' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Crear Orden
              </button>
              <button onClick={() => setModalType(null)} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pausar */}
      {modalType === 'pause' && selectedEnsamblaje && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2"><PauseCircle className="h-5 w-5 text-amber-400" />Pausar Ensamblaje</h3>
              <button onClick={() => setModalType(null)} className="p-2 hover:bg-slate-800 rounded-lg"><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div className="p-3 bg-slate-800/50 rounded-xl">
                <div className="text-sm text-slate-400">Orden</div>
                <div className="font-mono text-slate-200">{selectedEnsamblaje.numero}</div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Motivo *</label>
                <select value={pauseForm.motivo} onChange={(e) => setPauseForm({ ...pauseForm, motivo: e.target.value as MotivoPausa })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                  <option value="falta_material">Falta de material</option>
                  <option value="falla_equipo">Falla de equipo</option>
                  <option value="cambio_turno">Cambio de turno</option>
                  <option value="descanso">Descanso</option>
                  <option value="qc_pendiente">QC pendiente</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Descripción</label>
                <textarea value={pauseForm.descripcion} onChange={(e) => setPauseForm({ ...pauseForm, descripcion: e.target.value })} placeholder="Detalles..." rows={2} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
              <button onClick={pausarEnsamblaje} disabled={procesando === selectedEnsamblaje.id} className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2">
                {procesando === selectedEnsamblaje.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <PauseCircle className="h-4 w-4" />}Pausar
              </button>
              <button onClick={() => setModalType(null)} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal QC */}
      {modalType === 'qc' && selectedEnsamblaje && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-purple-400" />Control de Calidad</h3>
              <button onClick={() => setModalType(null)} className="p-2 hover:bg-slate-800 rounded-lg"><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div className="p-3 bg-slate-800/50 rounded-xl">
                <div className="text-sm text-slate-400">Orden</div>
                <div className="font-mono text-slate-200">{selectedEnsamblaje.numero}</div>
                <div className="text-sm text-slate-400 mt-1">Producidas: {selectedEnsamblaje.cantidadProducida || selectedEnsamblaje.cantidadPlanificada}</div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Tipo</label>
                <select value={qcForm.tipoInspeccion} onChange={(e) => setQcForm({ ...qcForm, tipoInspeccion: e.target.value as TipoInspeccionQC })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                  <option value="en_proceso">En Proceso</option>
                  <option value="final">Final</option>
                  <option value="muestreo">Muestreo</option>
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Inspeccionadas</label>
                  <input type="number" min="0" value={qcForm.cantidadInspeccionada} onChange={(e) => setQcForm({ ...qcForm, cantidadInspeccionada: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Aprobadas</label>
                  <input type="number" min="0" value={qcForm.cantidadAprobada} onChange={(e) => { const a = parseInt(e.target.value) || 0; setQcForm({ ...qcForm, cantidadAprobada: a, cantidadRechazada: qcForm.cantidadInspeccionada - a }); }} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-emerald-400" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Rechazadas</label>
                  <input type="number" min="0" value={qcForm.cantidadRechazada} onChange={(e) => setQcForm({ ...qcForm, cantidadRechazada: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-red-400" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Resultado</label>
                <select value={qcForm.resultado} onChange={(e) => setQcForm({ ...qcForm, resultado: e.target.value as ResultadoInspeccionQC })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                  <option value="aprobado">Aprobado</option>
                  <option value="aprobado_condicional">Aprobado Condicional</option>
                  <option value="rechazado">Rechazado</option>
                  <option value="pendiente_retrabajo">Pendiente Retrabajo</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Observaciones</label>
                <textarea value={qcForm.notas} onChange={(e) => setQcForm({ ...qcForm, notas: e.target.value })} placeholder="Defectos, observaciones..." rows={3} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
              <button onClick={registrarQC} disabled={procesando === selectedEnsamblaje.id} className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2">
                {procesando === selectedEnsamblaje.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}Registrar
              </button>
              <button onClick={() => setModalType(null)} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ver Detalles */}
      {modalType === 'view' && selectedEnsamblaje && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2"><Eye className="h-5 w-5 text-blue-400" />Detalle del Ensamblaje</h3>
                <p className="text-sm text-slate-400 font-mono mt-1">{selectedEnsamblaje.numero}</p>
              </div>
              <button onClick={() => setModalType(null)} className="p-2 hover:bg-slate-800 rounded-lg"><X className="h-5 w-5 text-slate-400" /></button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-800/50 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-1">Producto</div>
                <div className="text-slate-200">{selectedEnsamblaje.producto?.descripcion}</div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-1">Estado</div>
                <span className={`inline-flex items-center gap-1 ${getEstadoConfig(selectedEnsamblaje.estado).color}`}>
                  {getEstadoConfig(selectedEnsamblaje.estado).icon}{getEstadoConfig(selectedEnsamblaje.estado).label}
                </span>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-1">Cantidad</div>
                <div className="text-slate-200">{selectedEnsamblaje.cantidadProducida || 0} / {selectedEnsamblaje.cantidadPlanificada}</div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-1">Duración</div>
                <div className="text-slate-200">{formatDuration(selectedEnsamblaje.duracionRealMinutos)}</div>
              </div>
            </div>

            <div className="bg-slate-800/30 rounded-xl p-4 mb-6">
              <h4 className="font-semibold text-slate-300 mb-3 flex items-center gap-2"><DollarSign className="h-4 w-4 text-emerald-400" />Comparación de Costos</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-slate-500">Planificado</div>
                  <div className="text-lg font-semibold text-slate-300">${(selectedEnsamblaje.costoTotalPlanificado || 0).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Real</div>
                  <div className="text-lg font-semibold text-emerald-400">${(selectedEnsamblaje.costoTotalReal || 0).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Variación</div>
                  {(() => {
                    const v = selectedEnsamblaje.costoTotalPlanificado && selectedEnsamblaje.costoTotalPlanificado > 0
                      ? ((selectedEnsamblaje.costoTotalReal || 0) - selectedEnsamblaje.costoTotalPlanificado) / selectedEnsamblaje.costoTotalPlanificado * 100 : 0;
                    return <div className={`text-lg font-semibold flex items-center gap-1 ${v > 0 ? 'text-red-400' : v < 0 ? 'text-emerald-400' : 'text-slate-400'}`}>{getVariacionIcon(v)}{v > 0 ? '+' : ''}{v.toFixed(1)}%</div>;
                  })()}
                </div>
              </div>
            </div>

            {selectedEnsamblaje.operaciones && selectedEnsamblaje.operaciones.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-slate-300 mb-3 flex items-center gap-2"><History className="h-4 w-4 text-blue-400" />Historial de Operaciones</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {selectedEnsamblaje.operaciones.map((op: any, idx: number) => (
                    <div key={op.id || idx} className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-lg">
                      <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                      <div className="flex-1">
                        <div className="text-sm text-slate-200">{op.descripcion || op.tipo}</div>
                        <div className="text-xs text-slate-500">{new Date(op.created_at).toLocaleString()} • {op.ejecutado_por}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-slate-700">
              <button onClick={() => setModalType(null)} className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// COMPONENTE TIMELINE INLINE
// ============================================

function TimelineInline({ ensamblajeId }: { ensamblajeId: string }) {
  const [operaciones, setOperaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOperaciones();
  }, [ensamblajeId]);

  const loadOperaciones = async () => {
    const { data } = await supabase
      .from('ensamblaje_operaciones')
      .select('*')
      .eq('ensamblaje_id', ensamblajeId)
      .order('created_at', { ascending: true })
      .limit(15);
    setOperaciones(data || []);
    setLoading(false);
  };

  const getIcon = (tipo: string) => {
    const icons: Record<string, React.ReactNode> = {
      inicio: <PlayCircle className="h-3 w-3 text-emerald-400" />,
      pausa: <PauseCircle className="h-3 w-3 text-amber-400" />,
      reanudacion: <PlayCircle className="h-3 w-3 text-blue-400" />,
      completado: <CheckCircle className="h-3 w-3 text-emerald-400" />,
      qc_aprobado: <CheckCircle className="h-3 w-3 text-emerald-400" />,
      qc_rechazado: <X className="h-3 w-3 text-red-400" />,
    };
    return icons[tipo] || <Clock className="h-3 w-3 text-slate-400" />;
  };

  if (loading) return <div className="flex items-center justify-center py-4"><RefreshCw className="h-5 w-5 animate-spin text-slate-500" /></div>;

  if (!operaciones.length) return <div className="text-center py-4 text-slate-500 text-sm"><History className="h-6 w-6 mx-auto mb-2" />Sin operaciones</div>;

  return (
    <div className="pl-8">
      <h4 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2"><History className="h-4 w-4" />Timeline</h4>
      <div className="relative">
        <div className="absolute left-1.5 top-0 bottom-0 w-0.5 bg-slate-700"></div>
        <div className="space-y-2">
          {operaciones.map((op, idx) => (
            <div key={op.id || idx} className="relative flex items-start gap-3 pl-5">
              <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center">
                {getIcon(op.tipo)}
              </div>
              <div className="flex-1 bg-slate-800/30 rounded-lg p-2">
                <div className="text-xs text-slate-300 capitalize">{op.tipo.replace('_', ' ')}</div>
                {op.descripcion && <div className="text-xs text-slate-500">{op.descripcion}</div>}
                <div className="text-xs text-slate-600 mt-1">{new Date(op.created_at).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}