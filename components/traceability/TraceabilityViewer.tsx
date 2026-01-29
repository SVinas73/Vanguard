'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  GitBranch, Search, RefreshCw, Package, Truck, CheckCircle,
  AlertTriangle, Clock, MapPin, User, Calendar, ChevronRight,
  Box, ArrowRight, FileText, X, Download, Eye, ChevronDown,
  Factory, Warehouse, ShoppingCart, ClipboardCheck, Send,
  PackageCheck, RotateCcw, Settings, Zap, Timer, TrendingUp,
  BarChart3, AlertCircle, Link, FileDown, Layers, Network
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

// ============================================
// TIPOS
// ============================================

type TipoEvento = 
  | 'RECEPCION' | 'INSPECCION_QC' | 'ALMACENAMIENTO' | 'PICKING' 
  | 'PACKING' | 'ENVIO' | 'ENTREGA' | 'DEVOLUCION' | 'ENSAMBLAJE' 
  | 'TRANSFERENCIA' | 'AJUSTE' | 'BAJA' | 'CAMBIO_ESTADO';

type ResultadoEvento = 'EXITOSO' | 'FALLIDO' | 'PENDIENTE' | 'EN_PROCESO';

interface EventoTrazabilidad {
  id: string;
  tipoEvento: TipoEvento;
  resultado: ResultadoEvento;
  fechaHora: string;
  productoCodigo: string;
  producto?: { codigo: string; descripcion: string };
  serialId?: string;
  loteId?: string;
  loteCodigo?: string;
  cantidad?: number;
  unidadMedida?: string;
  almacenOrigenId?: string;
  almacenOrigen?: { id: string; nombre: string };
  almacenDestinoId?: string;
  almacenDestino?: { id: string; nombre: string };
  ubicacionOrigen?: string;
  ubicacionDestino?: string;
  usuarioResponsable?: string;
  documentoTipo?: string;
  documentoNumero?: string;
  descripcion?: string;
  datosAdicionales?: any;
  numeroTracking?: string;
}

interface NodoGenealogia {
  id: string;
  codigo: string;
  descripcion: string;
  tipo: 'producto_final' | 'componente' | 'materia_prima';
  lote?: string;
  serial?: string;
  proveedor?: string;
  cantidad?: number;
  children?: NodoGenealogia[];
}

interface MetricaTiempo {
  etapa: string;
  tiempoPromedio: number;
  tiempoMinimo: number;
  tiempoMaximo: number;
  cantidadEventos: number;
  slaObjetivo?: number;
  cumpleSla?: boolean;
}

interface FlujoEtapa {
  id: TipoEvento;
  nombre: string;
  icono: React.ReactNode;
  color: string;
  completado: boolean;
  fecha?: string;
  usuario?: string;
  duracion?: number;
  resultado?: ResultadoEvento;
}

type VistaActiva = 'timeline' | 'flujo' | 'genealogia' | 'metricas';

// ============================================
// HOOK TOAST
// ============================================

function useToast() {
  const [toasts, setToasts] = useState<Array<{ id: string; type: string; title: string; message?: string }>>([]);

  const addToast = (type: string, title: string, message?: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const ToastContainer = () => toasts.length > 0 ? (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map(t => (
        <div key={t.id} className={`px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3 ${
          t.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' :
          t.type === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-400' :
          'bg-amber-500/20 border-amber-500/30 text-amber-400'
        }`}>
          {t.type === 'success' ? <CheckCircle className="h-5 w-5" /> :
           t.type === 'error' ? <X className="h-5 w-5" /> :
           <AlertTriangle className="h-5 w-5" />}
          <div>
            <div className="font-medium">{t.title}</div>
            {t.message && <div className="text-sm opacity-80">{t.message}</div>}
          </div>
        </div>
      ))}
    </div>
  ) : null;

  return {
    success: (title: string, msg?: string) => addToast('success', title, msg),
    error: (title: string, msg?: string) => addToast('error', title, msg),
    warning: (title: string, msg?: string) => addToast('warning', title, msg),
    ToastContainer,
  };
}

// ============================================
// HELPERS DE ICONOS Y COLORES
// ============================================

const getEventoIcon = (tipo: TipoEvento, size: string = 'h-5 w-5') => {
  const icons: Record<TipoEvento, React.ReactNode> = {
    RECEPCION: <PackageCheck className={`${size} text-emerald-400`} />,
    INSPECCION_QC: <ClipboardCheck className={`${size} text-blue-400`} />,
    ALMACENAMIENTO: <Warehouse className={`${size} text-purple-400`} />,
    PICKING: <Package className={`${size} text-orange-400`} />,
    PACKING: <Box className={`${size} text-yellow-400`} />,
    ENVIO: <Send className={`${size} text-cyan-400`} />,
    ENTREGA: <CheckCircle className={`${size} text-emerald-400`} />,
    DEVOLUCION: <RotateCcw className={`${size} text-red-400`} />,
    ENSAMBLAJE: <Settings className={`${size} text-indigo-400`} />,
    TRANSFERENCIA: <ArrowRight className={`${size} text-blue-400`} />,
    AJUSTE: <FileText className={`${size} text-slate-400`} />,
    BAJA: <X className={`${size} text-red-400`} />,
    CAMBIO_ESTADO: <RefreshCw className={`${size} text-yellow-400`} />,
  };
  return icons[tipo] || <Clock className={`${size} text-slate-400`} />;
};

const getEventoColor = (tipo: TipoEvento) => {
  const colors: Record<TipoEvento, { border: string; bg: string; text: string }> = {
    RECEPCION: { border: 'border-emerald-500', bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
    INSPECCION_QC: { border: 'border-blue-500', bg: 'bg-blue-500/20', text: 'text-blue-400' },
    ALMACENAMIENTO: { border: 'border-purple-500', bg: 'bg-purple-500/20', text: 'text-purple-400' },
    PICKING: { border: 'border-orange-500', bg: 'bg-orange-500/20', text: 'text-orange-400' },
    PACKING: { border: 'border-yellow-500', bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
    ENVIO: { border: 'border-cyan-500', bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
    ENTREGA: { border: 'border-emerald-500', bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
    DEVOLUCION: { border: 'border-red-500', bg: 'bg-red-500/20', text: 'text-red-400' },
    ENSAMBLAJE: { border: 'border-indigo-500', bg: 'bg-indigo-500/20', text: 'text-indigo-400' },
    TRANSFERENCIA: { border: 'border-blue-500', bg: 'bg-blue-500/20', text: 'text-blue-400' },
    AJUSTE: { border: 'border-slate-500', bg: 'bg-slate-500/20', text: 'text-slate-400' },
    BAJA: { border: 'border-red-500', bg: 'bg-red-500/20', text: 'text-red-400' },
    CAMBIO_ESTADO: { border: 'border-yellow-500', bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  };
  return colors[tipo] || { border: 'border-slate-500', bg: 'bg-slate-500/20', text: 'text-slate-400' };
};

const getResultadoColor = (resultado: ResultadoEvento) => {
  const colors: Record<ResultadoEvento, string> = {
    EXITOSO: 'text-emerald-400',
    FALLIDO: 'text-red-400',
    PENDIENTE: 'text-yellow-400',
    EN_PROCESO: 'text-blue-400',
  };
  return colors[resultado] || 'text-slate-400';
};

const getResultadoBadge = (resultado: ResultadoEvento) => {
  const config: Record<ResultadoEvento, { bg: string; text: string }> = {
    EXITOSO: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
    FALLIDO: { bg: 'bg-red-500/20', text: 'text-red-400' },
    PENDIENTE: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
    EN_PROCESO: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  };
  return config[resultado] || { bg: 'bg-slate-500/20', text: 'text-slate-400' };
};

// ============================================
// HELPERS DE FORMATO
// ============================================

const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;
  return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
};

const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('es-UY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDateShort = (date: string): string => {
  return new Date(date).toLocaleDateString('es-UY', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// ============================================
// FLUJO ESTÁNDAR DE SUPPLY CHAIN
// ============================================

const FLUJO_ESTANDAR: Array<{ id: TipoEvento; nombre: string }> = [
  { id: 'RECEPCION', nombre: 'Recepción' },
  { id: 'INSPECCION_QC', nombre: 'QC' },
  { id: 'ALMACENAMIENTO', nombre: 'Almacén' },
  { id: 'PICKING', nombre: 'Picking' },
  { id: 'PACKING', nombre: 'Packing' },
  { id: 'ENVIO', nombre: 'Envío' },
  { id: 'ENTREGA', nombre: 'Entrega' },
];

// ============================================
// COMPONENTE PRINCIPAL - PARTE 1 FIN
// Continúa en Parte 2...
// ============================================
// ============================================
// COMPONENTE PRINCIPAL
// ============================================

interface TraceabilityEnterpriseProps {
  serialId?: string;
  loteId?: string;
  productoCodigo?: string;
  ensamblajeId?: string;
  onClose?: () => void;
}

export default function TraceabilityEnterprise({
  serialId,
  loteId,
  productoCodigo,
  ensamblajeId,
  onClose,
}: TraceabilityEnterpriseProps) {
  const { user } = useAuth();
  const toast = useToast();

  // Estado principal
  const [eventos, setEventos] = useState<EventoTrazabilidad[]>([]);
  const [genealogia, setGenealogia] = useState<NodoGenealogia | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState(false);

  // Búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'serial' | 'lote' | 'producto' | 'ensamblaje'>('serial');

  // Vista
  const [vistaActiva, setVistaActiva] = useState<VistaActiva>('flujo');
  const [selectedEvento, setSelectedEvento] = useState<EventoTrazabilidad | null>(null);

  // Info del item buscado
  const [itemInfo, setItemInfo] = useState<{
    tipo: string;
    codigo: string;
    descripcion?: string;
    producto?: string;
  } | null>(null);

  // ============================================
  // CARGA DE DATOS
  // ============================================

  useEffect(() => {
    if (serialId || loteId || productoCodigo || ensamblajeId) {
      loadEventos();
    } else {
      setLoading(false);
    }
  }, [serialId, loteId, productoCodigo, ensamblajeId]);

  const loadEventos = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('eventos_trazabilidad')
        .select(`
          *,
          producto:productos(codigo, descripcion),
          almacen_origen:almacenes!eventos_trazabilidad_almacen_origen_id_fkey(id, nombre),
          almacen_destino:almacenes!eventos_trazabilidad_almacen_destino_id_fkey(id, nombre)
        `)
        .order('fecha_hora', { ascending: true });

      if (serialId) {
        query = query.eq('serial_id', serialId);
        // Cargar info del serial
        const { data: serialData } = await supabase
          .from('productos_seriales')
          .select('numero_serie, producto_codigo, productos(descripcion)')
          .eq('id', serialId)
          .single();
        if (serialData) {
          setItemInfo({
            tipo: 'Serial',
            codigo: serialData.numero_serie,
            producto: serialData.producto_codigo,
            descripcion: (serialData.productos as any)?.descripcion,
          });
        }
      } else if (loteId) {
        query = query.eq('lote_id', loteId);
        const { data: loteData } = await supabase
          .from('lotes')
          .select('codigo, producto_codigo:codigo, productos(descripcion)')
          .eq('id', loteId)
          .single();
        if (loteData) {
          setItemInfo({
            tipo: 'Lote',
            codigo: loteData.codigo,
            producto: loteData.producto_codigo,
          });
        }
      } else if (productoCodigo) {
        query = query.eq('producto_codigo', productoCodigo);
        const { data: prodData } = await supabase
          .from('productos')
          .select('codigo, descripcion')
          .eq('codigo', productoCodigo)
          .single();
        if (prodData) {
          setItemInfo({
            tipo: 'Producto',
            codigo: prodData.codigo,
            descripcion: prodData.descripcion,
          });
        }
      } else if (ensamblajeId) {
        // Para ensamblajes, cargar genealogía
        await loadGenealogia(ensamblajeId);
        const { data: asmData } = await supabase
          .from('ensamblajes')
          .select('numero, producto_codigo, producto_descripcion')
          .eq('id', ensamblajeId)
          .single();
        if (asmData) {
          setItemInfo({
            tipo: 'Ensamblaje',
            codigo: asmData.numero,
            producto: asmData.producto_codigo,
            descripcion: asmData.producto_descripcion,
          });
        }
        query = query.eq('ensamblaje_id', ensamblajeId);
      }

      const { data, error } = await query.limit(200);

      if (error) throw error;

      const eventosMapped = (data || []).map((e: any) => ({
        id: e.id,
        tipoEvento: e.tipo_evento,
        resultado: e.resultado,
        fechaHora: e.fecha_hora,
        productoCodigo: e.producto_codigo,
        producto: e.producto,
        serialId: e.serial_id,
        loteId: e.lote_id,
        loteCodigo: e.lote_codigo,
        cantidad: e.cantidad,
        unidadMedida: e.unidad_medida,
        almacenOrigenId: e.almacen_origen_id,
        almacenOrigen: e.almacen_origen,
        almacenDestinoId: e.almacen_destino_id,
        almacenDestino: e.almacen_destino,
        ubicacionOrigen: e.ubicacion_origen,
        ubicacionDestino: e.ubicacion_destino,
        usuarioResponsable: e.usuario_responsable,
        documentoTipo: e.documento_tipo,
        documentoNumero: e.documento_numero,
        descripcion: e.descripcion,
        datosAdicionales: e.datos_adicionales,
        numeroTracking: e.numero_tracking,
      }));

      setEventos(eventosMapped);
    } catch (error: any) {
      console.error('Error loading eventos:', error);
      toast.error('Error al cargar trazabilidad', error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadGenealogia = async (asmId: string) => {
    try {
      // Cargar ensamblaje
      const { data: asm } = await supabase
        .from('ensamblajes')
        .select('*, bom:bom(*)')
        .eq('id', asmId)
        .single();

      if (!asm) return;

      // Cargar consumos (componentes usados)
      const { data: consumos } = await supabase
        .from('ensamblaje_consumos')
        .select('*')
        .eq('ensamblaje_id', asmId);

      // Construir árbol
      const arbol: NodoGenealogia = {
        id: asm.id,
        codigo: asm.producto_codigo,
        descripcion: asm.producto_descripcion,
        tipo: 'producto_final',
        cantidad: asm.cantidad_producida || asm.cantidad_planificada,
        children: (consumos || []).map((c: any) => ({
          id: c.id,
          codigo: c.componente_codigo,
          descripcion: c.componente_descripcion,
          tipo: 'componente',
          lote: c.lote_codigo,
          cantidad: c.cantidad_consumida,
          proveedor: c.proveedor_nombre,
        })),
      };

      setGenealogia(arbol);
    } catch (error) {
      console.error('Error loading genealogia:', error);
    }
  };

  // ============================================
  // BÚSQUEDA
  // ============================================

  const buscarTrazabilidad = async () => {
    if (!searchTerm.trim()) {
      toast.warning('Ingrese término de búsqueda');
      return;
    }

    try {
      setLoading(true);
      setItemInfo(null);
      setGenealogia(null);

      let query = supabase
        .from('eventos_trazabilidad')
        .select(`
          *,
          producto:productos(codigo, descripcion),
          almacen_origen:almacenes!eventos_trazabilidad_almacen_origen_id_fkey(id, nombre),
          almacen_destino:almacenes!eventos_trazabilidad_almacen_destino_id_fkey(id, nombre)
        `)
        .order('fecha_hora', { ascending: true });

      if (searchType === 'serial') {
        const { data: serialData } = await supabase
          .from('productos_seriales')
          .select('id, numero_serie, producto_codigo, productos(descripcion)')
          .ilike('numero_serie', `%${searchTerm}%`)
          .limit(1)
          .single();

        if (serialData) {
          query = query.eq('serial_id', serialData.id);
          setItemInfo({
            tipo: 'Serial',
            codigo: serialData.numero_serie,
            producto: serialData.producto_codigo,
            descripcion: (serialData.productos as any)?.descripcion,
          });
        } else {
          setEventos([]);
          toast.warning('Serial no encontrado');
          setLoading(false);
          return;
        }
      } else if (searchType === 'lote') {
        const { data: loteData } = await supabase
          .from('lotes')
          .select('id, codigo')
          .ilike('codigo', `%${searchTerm}%`)
          .limit(1)
          .single();

        if (loteData) {
          query = query.eq('lote_id', loteData.id);
          setItemInfo({
            tipo: 'Lote',
            codigo: loteData.codigo,
          });
        } else {
          setEventos([]);
          toast.warning('Lote no encontrado');
          setLoading(false);
          return;
        }
      } else if (searchType === 'ensamblaje') {
        const { data: asmData } = await supabase
          .from('ensamblajes')
          .select('id, numero, producto_codigo, producto_descripcion')
          .ilike('numero', `%${searchTerm}%`)
          .limit(1)
          .single();

        if (asmData) {
          query = query.eq('ensamblaje_id', asmData.id);
          await loadGenealogia(asmData.id);
          setItemInfo({
            tipo: 'Ensamblaje',
            codigo: asmData.numero,
            producto: asmData.producto_codigo,
            descripcion: asmData.producto_descripcion,
          });
        } else {
          setEventos([]);
          toast.warning('Ensamblaje no encontrado');
          setLoading(false);
          return;
        }
      } else {
        query = query.ilike('producto_codigo', `%${searchTerm}%`);
        setItemInfo({
          tipo: 'Producto',
          codigo: searchTerm.toUpperCase(),
        });
      }

      const { data, error } = await query.limit(200);
      if (error) throw error;

      const eventosMapped = (data || []).map((e: any) => ({
        id: e.id,
        tipoEvento: e.tipo_evento,
        resultado: e.resultado,
        fechaHora: e.fecha_hora,
        productoCodigo: e.producto_codigo,
        producto: e.producto,
        serialId: e.serial_id,
        loteId: e.lote_id,
        loteCodigo: e.lote_codigo,
        cantidad: e.cantidad,
        unidadMedida: e.unidad_medida,
        almacenOrigenId: e.almacen_origen_id,
        almacenOrigen: e.almacen_origen,
        almacenDestinoId: e.almacen_destino_id,
        almacenDestino: e.almacen_destino,
        ubicacionOrigen: e.ubicacion_origen,
        ubicacionDestino: e.ubicacion_destino,
        usuarioResponsable: e.usuario_responsable,
        documentoTipo: e.documento_tipo,
        documentoNumero: e.documento_numero,
        descripcion: e.descripcion,
        datosAdicionales: e.datos_adicionales,
        numeroTracking: e.numero_tracking,
      }));

      setEventos(eventosMapped);

      if (eventosMapped.length === 0) {
        toast.warning('Sin eventos', 'No se encontraron eventos de trazabilidad');
      }
    } catch (error: any) {
      console.error('Error searching:', error);
      toast.error('Error en búsqueda', error.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // CÁLCULOS Y MÉTRICAS
  // ============================================

  const stats = useMemo(() => {
    const total = eventos.length;
    const exitosos = eventos.filter(e => e.resultado === 'EXITOSO').length;
    const fallidos = eventos.filter(e => e.resultado === 'FALLIDO').length;
    const pendientes = eventos.filter(e => e.resultado === 'PENDIENTE').length;

    // Calcular lead time total (primer a último evento)
    let leadTimeMinutos = 0;
    if (eventos.length >= 2) {
      const primera = new Date(eventos[0].fechaHora);
      const ultima = new Date(eventos[eventos.length - 1].fechaHora);
      leadTimeMinutos = (ultima.getTime() - primera.getTime()) / 60000;
    }

    return { total, exitosos, fallidos, pendientes, leadTimeMinutos };
  }, [eventos]);

  const flujoEtapas = useMemo((): FlujoEtapa[] => {
    return FLUJO_ESTANDAR.map(etapa => {
      const evento = eventos.find(e => e.tipoEvento === etapa.id);
      const color = getEventoColor(etapa.id);
      
      return {
        id: etapa.id,
        nombre: etapa.nombre,
        icono: getEventoIcon(etapa.id, 'h-6 w-6'),
        color: color.text,
        completado: !!evento,
        fecha: evento?.fechaHora,
        usuario: evento?.usuarioResponsable,
        resultado: evento?.resultado,
      };
    });
  }, [eventos]);

  const metricas = useMemo((): MetricaTiempo[] => {
    const metricasPorTipo: Record<string, { tiempos: number[]; count: number }> = {};

    // Calcular tiempo entre eventos consecutivos
    for (let i = 1; i < eventos.length; i++) {
      const anterior = eventos[i - 1];
      const actual = eventos[i];
      const diff = (new Date(actual.fechaHora).getTime() - new Date(anterior.fechaHora).getTime()) / 60000;

      const key = `${anterior.tipoEvento} → ${actual.tipoEvento}`;
      if (!metricasPorTipo[key]) {
        metricasPorTipo[key] = { tiempos: [], count: 0 };
      }
      metricasPorTipo[key].tiempos.push(diff);
      metricasPorTipo[key].count++;
    }

    // SLAs objetivo (en minutos)
    const slas: Record<string, number> = {
      'RECEPCION → INSPECCION_QC': 120,
      'INSPECCION_QC → ALMACENAMIENTO': 60,
      'ALMACENAMIENTO → PICKING': 1440,
      'PICKING → PACKING': 30,
      'PACKING → ENVIO': 60,
      'ENVIO → ENTREGA': 2880,
    };

    return Object.entries(metricasPorTipo).map(([etapa, data]) => {
      const tiempos = data.tiempos;
      const promedio = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
      const slaObjetivo = slas[etapa];

      return {
        etapa,
        tiempoPromedio: promedio,
        tiempoMinimo: Math.min(...tiempos),
        tiempoMaximo: Math.max(...tiempos),
        cantidadEventos: data.count,
        slaObjetivo,
        cumpleSla: slaObjetivo ? promedio <= slaObjetivo : undefined,
      };
    });
  }, [eventos]);

  const anomalias = useMemo(() => {
    const lista: Array<{ tipo: string; mensaje: string; severidad: 'alta' | 'media' | 'baja' }> = [];

    // Verificar gaps en el flujo
    const tiposPresentes = new Set(eventos.map(e => e.tipoEvento));
    const flujoRequerido: TipoEvento[] = ['RECEPCION', 'INSPECCION_QC', 'ALMACENAMIENTO'];

    flujoRequerido.forEach((tipo, idx) => {
      if (idx > 0 && tiposPresentes.has(flujoRequerido[idx]) && !tiposPresentes.has(flujoRequerido[idx - 1])) {
        lista.push({
          tipo: 'gap',
          mensaje: `Falta evento de ${flujoRequerido[idx - 1]} antes de ${tipo}`,
          severidad: 'alta',
        });
      }
    });

    // Verificar eventos fallidos
    const fallidos = eventos.filter(e => e.resultado === 'FALLIDO');
    if (fallidos.length > 0) {
      lista.push({
        tipo: 'fallido',
        mensaje: `${fallidos.length} evento(s) fallido(s) detectado(s)`,
        severidad: 'alta',
      });
    }

    // Verificar SLA excedido
    metricas.forEach(m => {
      if (m.slaObjetivo && !m.cumpleSla) {
        lista.push({
          tipo: 'sla',
          mensaje: `SLA excedido en ${m.etapa}: ${formatDuration(m.tiempoPromedio)} vs objetivo ${formatDuration(m.slaObjetivo)}`,
          severidad: 'media',
        });
      }
    });

    return lista;
  }, [eventos, metricas]);

  // ============================================
  // CONTINÚA EN PARTE 3...
  // ============================================
  // ============================================
  // EXPORTAR PDF
  // ============================================

  const exportarPDF = async () => {
    try {
      setExportando(true);

      // Crear contenido HTML para el PDF
      const contenido = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Reporte de Trazabilidad - ${itemInfo?.codigo || 'N/A'}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
            h1 { color: #059669; border-bottom: 2px solid #059669; padding-bottom: 10px; }
            h2 { color: #0891b2; margin-top: 30px; }
            .header-info { background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            .stats { display: flex; gap: 20px; margin: 20px 0; }
            .stat-box { background: #f9fafb; padding: 15px; border-radius: 8px; text-align: center; flex: 1; }
            .stat-value { font-size: 24px; font-weight: bold; color: #059669; }
            .stat-label { font-size: 12px; color: #6b7280; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #e5e7eb; padding: 10px; text-align: left; }
            th { background: #f3f4f6; font-weight: 600; }
            .success { color: #059669; }
            .error { color: #dc2626; }
            .warning { color: #d97706; }
            .timeline-item { padding: 10px 0; border-left: 2px solid #059669; padding-left: 15px; margin-left: 10px; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <h1>🔗 Reporte de Trazabilidad</h1>
          
          <div class="header-info">
            <strong>Tipo:</strong> ${itemInfo?.tipo || 'N/A'}<br>
            <strong>Código:</strong> ${itemInfo?.codigo || 'N/A'}<br>
            ${itemInfo?.descripcion ? `<strong>Descripción:</strong> ${itemInfo.descripcion}<br>` : ''}
            ${itemInfo?.producto ? `<strong>Producto:</strong> ${itemInfo.producto}<br>` : ''}
            <strong>Fecha del reporte:</strong> ${new Date().toLocaleString('es-UY')}
          </div>

          <div class="stats">
            <div class="stat-box">
              <div class="stat-value">${stats.total}</div>
              <div class="stat-label">Total Eventos</div>
            </div>
            <div class="stat-box">
              <div class="stat-value success">${stats.exitosos}</div>
              <div class="stat-label">Exitosos</div>
            </div>
            <div class="stat-box">
              <div class="stat-value error">${stats.fallidos}</div>
              <div class="stat-label">Fallidos</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${formatDuration(stats.leadTimeMinutos)}</div>
              <div class="stat-label">Lead Time Total</div>
            </div>
          </div>

          ${anomalias.length > 0 ? `
            <h2>⚠️ Alertas y Anomalías</h2>
            <ul>
              ${anomalias.map(a => `<li class="${a.severidad === 'alta' ? 'error' : 'warning'}">${a.mensaje}</li>`).join('')}
            </ul>
          ` : ''}

          <h2>📋 Historial de Eventos</h2>
          <table>
            <thead>
              <tr>
                <th>Fecha/Hora</th>
                <th>Evento</th>
                <th>Resultado</th>
                <th>Ubicación</th>
                <th>Responsable</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              ${eventos.map(e => `
                <tr>
                  <td>${formatDate(e.fechaHora)}</td>
                  <td>${e.tipoEvento.replace('_', ' ')}</td>
                  <td class="${e.resultado === 'EXITOSO' ? 'success' : e.resultado === 'FALLIDO' ? 'error' : ''}">${e.resultado}</td>
                  <td>${e.almacenOrigen?.nombre || e.almacenDestino?.nombre || '-'}</td>
                  <td>${e.usuarioResponsable || '-'}</td>
                  <td>${e.descripcion || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          ${genealogia ? `
            <h2>🌳 Árbol de Genealogía</h2>
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px;">
              <strong>${genealogia.descripcion}</strong> (${genealogia.codigo})<br>
              Cantidad: ${genealogia.cantidad}<br>
              <ul>
                ${(genealogia.children || []).map(c => `
                  <li>
                    <strong>${c.descripcion}</strong> (${c.codigo})<br>
                    Cantidad: ${c.cantidad} ${c.lote ? `| Lote: ${c.lote}` : ''} ${c.proveedor ? `| Proveedor: ${c.proveedor}` : ''}
                  </li>
                `).join('')}
              </ul>
            </div>
          ` : ''}

          ${metricas.length > 0 ? `
            <h2>📊 Métricas de Tiempo</h2>
            <table>
              <thead>
                <tr>
                  <th>Etapa</th>
                  <th>Tiempo Promedio</th>
                  <th>Mínimo</th>
                  <th>Máximo</th>
                  <th>SLA</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                ${metricas.map(m => `
                  <tr>
                    <td>${m.etapa}</td>
                    <td>${formatDuration(m.tiempoPromedio)}</td>
                    <td>${formatDuration(m.tiempoMinimo)}</td>
                    <td>${formatDuration(m.tiempoMaximo)}</td>
                    <td>${m.slaObjetivo ? formatDuration(m.slaObjetivo) : '-'}</td>
                    <td class="${m.cumpleSla === false ? 'error' : m.cumpleSla === true ? 'success' : ''}">${m.cumpleSla === undefined ? '-' : m.cumpleSla ? '✓ Cumple' : '✗ Excede'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}

          <div class="footer">
            Generado por Vanguard Inventory System | ${new Date().toLocaleString('es-UY')}
          </div>
        </body>
        </html>
      `;

      // Crear blob y descargar
      const blob = new Blob([contenido], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trazabilidad_${itemInfo?.codigo || 'reporte'}_${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Reporte exportado', 'Archivo descargado correctamente');
    } catch (error: any) {
      toast.error('Error al exportar', error.message);
    } finally {
      setExportando(false);
    }
  };

  // ============================================
  // SUBCOMPONENTE: DIAGRAMA DE FLUJO
  // ============================================

  const DiagramaFlujo = () => (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-slate-100 mb-6 flex items-center gap-2">
        <Network className="h-5 w-5 text-emerald-400" />
        Flujo de Supply Chain
      </h3>

      {/* Diagrama horizontal */}
      <div className="relative">
        {/* Línea conectora */}
        <div className="absolute top-10 left-8 right-8 h-0.5 bg-slate-700" />
        
        <div className="flex justify-between relative">
          {flujoEtapas.map((etapa, idx) => {
            const colorConfig = getEventoColor(etapa.id);
            return (
              <div key={etapa.id} className="flex flex-col items-center relative z-10">
                {/* Nodo */}
                <div className={`w-20 h-20 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${
                  etapa.completado
                    ? `${colorConfig.border} ${colorConfig.bg}`
                    : 'border-slate-700 bg-slate-800/50'
                }`}>
                  {etapa.completado ? etapa.icono : (
                    <Clock className="h-6 w-6 text-slate-600" />
                  )}
                  {etapa.completado && etapa.resultado === 'EXITOSO' && (
                    <CheckCircle className="h-4 w-4 text-emerald-400 absolute -top-1 -right-1" />
                  )}
                  {etapa.completado && etapa.resultado === 'FALLIDO' && (
                    <AlertCircle className="h-4 w-4 text-red-400 absolute -top-1 -right-1" />
                  )}
                </div>
                
                {/* Label */}
                <span className={`mt-2 text-xs font-medium ${
                  etapa.completado ? colorConfig.text : 'text-slate-600'
                }`}>
                  {etapa.nombre}
                </span>
                
                {/* Fecha */}
                {etapa.fecha && (
                  <span className="text-[10px] text-slate-500 mt-1">
                    {formatDateShort(etapa.fecha)}
                  </span>
                )}
                
                {/* Conector de flecha */}
                {idx < flujoEtapas.length - 1 && (
                  <ChevronRight className={`absolute top-8 -right-4 h-4 w-4 ${
                    etapa.completado && flujoEtapas[idx + 1].completado
                      ? 'text-emerald-400'
                      : 'text-slate-700'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Progreso */}
      <div className="mt-6 pt-4 border-t border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">Progreso del flujo</span>
          <span className="text-sm font-medium text-emerald-400">
            {flujoEtapas.filter(e => e.completado).length} / {flujoEtapas.length}
          </span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all"
            style={{ width: `${(flujoEtapas.filter(e => e.completado).length / flujoEtapas.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );

  // ============================================
  // SUBCOMPONENTE: ÁRBOL DE GENEALOGÍA
  // ============================================

  const ArbolGenealogia = () => {
    if (!genealogia) {
      return (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-400" />
            Árbol de Genealogía
          </h3>
          <div className="text-center py-12 text-slate-500">
            <Layers className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Busque un ensamblaje para ver su árbol de componentes</p>
          </div>
        </div>
      );
    }

    const NodoArbol = ({ nodo, nivel = 0 }: { nodo: NodoGenealogia; nivel?: number }) => {
      const [expandido, setExpandido] = useState(true);
      const tieneHijos = nodo.children && nodo.children.length > 0;

      const colores = {
        producto_final: { bg: 'bg-emerald-500/20', border: 'border-emerald-500', text: 'text-emerald-400' },
        componente: { bg: 'bg-cyan-500/20', border: 'border-cyan-500', text: 'text-cyan-400' },
        materia_prima: { bg: 'bg-amber-500/20', border: 'border-amber-500', text: 'text-amber-400' },
      };

      const color = colores[nodo.tipo];

      return (
        <div className={`${nivel > 0 ? 'ml-6 mt-2' : ''}`}>
          <div className={`flex items-center gap-3 p-3 rounded-xl border ${color.border} ${color.bg}`}>
            {tieneHijos && (
              <button onClick={() => setExpandido(!expandido)} className="p-1 hover:bg-slate-700 rounded">
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${!expandido ? '-rotate-90' : ''}`} />
              </button>
            )}
            
            {nodo.tipo === 'producto_final' ? (
              <Box className={`h-5 w-5 ${color.text}`} />
            ) : nodo.tipo === 'componente' ? (
              <Package className={`h-5 w-5 ${color.text}`} />
            ) : (
              <Layers className={`h-5 w-5 ${color.text}`} />
            )}

            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-200">{nodo.descripcion}</span>
                <span className="text-xs text-slate-500 font-mono">({nodo.codigo})</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                {nodo.cantidad && <span>Cant: {nodo.cantidad}</span>}
                {nodo.lote && <span>Lote: {nodo.lote}</span>}
                {nodo.serial && <span>Serial: {nodo.serial}</span>}
                {nodo.proveedor && <span>Prov: {nodo.proveedor}</span>}
              </div>
            </div>
          </div>

          {tieneHijos && expandido && (
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-700" />
              {nodo.children!.map((hijo, idx) => (
                <NodoArbol key={hijo.id || idx} nodo={hijo} nivel={nivel + 1} />
              ))}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
          <Layers className="h-5 w-5 text-indigo-400" />
          Árbol de Genealogía
        </h3>

        {/* Leyenda */}
        <div className="flex gap-4 mb-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-emerald-500/40 border border-emerald-500" />
            <span className="text-slate-500">Producto Final</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-cyan-500/40 border border-cyan-500" />
            <span className="text-slate-500">Componente</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-amber-500/40 border border-amber-500" />
            <span className="text-slate-500">Materia Prima</span>
          </div>
        </div>

        <NodoArbol nodo={genealogia} />
      </div>
    );
  };

  // ============================================
  // SUBCOMPONENTE: PANEL DE MÉTRICAS
  // ============================================

  const PanelMetricas = () => (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-cyan-400" />
        Métricas de Tiempo
      </h3>

      {metricas.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <Timer className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>Se necesitan al menos 2 eventos para calcular métricas</p>
        </div>
      ) : (
        <div className="space-y-4">
          {metricas.map((m, idx) => (
            <div key={idx} className="p-4 bg-slate-800/30 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-300">{m.etapa}</span>
                {m.cumpleSla !== undefined && (
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    m.cumpleSla ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {m.cumpleSla ? '✓ Cumple SLA' : '✗ Excede SLA'}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-cyan-400">{formatDuration(m.tiempoPromedio)}</div>
                  <div className="text-xs text-slate-500">Promedio</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-emerald-400">{formatDuration(m.tiempoMinimo)}</div>
                  <div className="text-xs text-slate-500">Mínimo</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-amber-400">{formatDuration(m.tiempoMaximo)}</div>
                  <div className="text-xs text-slate-500">Máximo</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-300">{m.slaObjetivo ? formatDuration(m.slaObjetivo) : '-'}</div>
                  <div className="text-xs text-slate-500">SLA Objetivo</div>
                </div>
              </div>

              {/* Barra de progreso visual */}
              {m.slaObjetivo && (
                <div className="mt-3">
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${m.cumpleSla ? 'bg-emerald-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min((m.tiempoPromedio / m.slaObjetivo) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Lead Time Total */}
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-emerald-400">Lead Time Total</span>
              <span className="text-2xl font-bold text-emerald-300">{formatDuration(stats.leadTimeMinutos)}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Desde el primer hasta el último evento</p>
          </div>
        </div>
      )}
    </div>
  );

  // ============================================
  // CONTINÚA EN PARTE 4 (RENDER PRINCIPAL)...
  // ============================================
  // ============================================
  // RENDER PRINCIPAL
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
      <toast.ToastContainer />

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
        <div className="flex gap-2">
          {eventos.length > 0 && (
            <button
              onClick={exportarPDF}
              disabled={exportando}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors"
            >
              {exportando ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Exportar
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-xl transition-colors">
              <X className="h-5 w-5 text-slate-400" />
            </button>
          )}
        </div>
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
            <option value="ensamblaje">Por Ensamblaje</option>
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
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors flex items-center gap-2"
          >
            <Search className="h-4 w-4" />
            Buscar
          </button>
        </div>
      </div>

      {/* Info del item buscado */}
      {itemInfo && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              {itemInfo.tipo === 'Serial' ? <Package className="h-6 w-6 text-emerald-400" /> :
               itemInfo.tipo === 'Lote' ? <Box className="h-6 w-6 text-cyan-400" /> :
               itemInfo.tipo === 'Ensamblaje' ? <Settings className="h-6 w-6 text-indigo-400" /> :
               <Layers className="h-6 w-6 text-purple-400" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-400">{itemInfo.tipo}</span>
                <span className="font-mono text-lg text-slate-100">{itemInfo.codigo}</span>
              </div>
              {itemInfo.descripcion && (
                <p className="text-sm text-slate-400">{itemInfo.descripcion}</p>
              )}
              {itemInfo.producto && !itemInfo.descripcion && (
                <p className="text-sm text-slate-500">Producto: {itemInfo.producto}</p>
              )}
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-emerald-400">{eventos.length}</div>
              <div className="text-xs text-slate-500">eventos</div>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {eventos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <div className="text-2xl font-bold text-blue-400">{stats.total}</div>
            <div className="text-sm text-slate-500">Total Eventos</div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <div className="text-2xl font-bold text-emerald-400">{stats.exitosos}</div>
            <div className="text-sm text-slate-500">Exitosos</div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <div className="text-2xl font-bold text-red-400">{stats.fallidos}</div>
            <div className="text-sm text-slate-500">Fallidos</div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <div className="text-2xl font-bold text-yellow-400">{stats.pendientes}</div>
            <div className="text-sm text-slate-500">Pendientes</div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <div className="text-2xl font-bold text-cyan-400">{formatDuration(stats.leadTimeMinutos)}</div>
            <div className="text-sm text-slate-500">Lead Time</div>
          </div>
        </div>
      )}

      {/* Alertas/Anomalías */}
      {anomalias.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <h4 className="font-semibold text-red-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Alertas Detectadas ({anomalias.length})
          </h4>
          <div className="space-y-2">
            {anomalias.map((a, idx) => (
              <div key={idx} className={`flex items-center gap-2 text-sm ${
                a.severidad === 'alta' ? 'text-red-400' : a.severidad === 'media' ? 'text-amber-400' : 'text-yellow-400'
              }`}>
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {a.mensaje}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs de Vista */}
      {eventos.length > 0 && (
        <div className="flex gap-2 p-1 bg-slate-900/50 rounded-xl w-fit">
          {[
            { id: 'flujo', icon: Network, label: 'Flujo' },
            { id: 'timeline', icon: GitBranch, label: 'Timeline' },
            { id: 'genealogia', icon: Layers, label: 'Genealogía' },
            { id: 'metricas', icon: BarChart3, label: 'Métricas' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setVistaActiva(tab.id as VistaActiva)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                vistaActiva === tab.id
                  ? 'bg-slate-800 text-emerald-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Contenido según vista */}
      {eventos.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-12 text-center">
          <GitBranch className="mx-auto h-16 w-16 text-slate-600 mb-4" />
          <h3 className="text-lg font-semibold text-slate-400 mb-2">Sin Eventos de Trazabilidad</h3>
          <p className="text-slate-500">Busque por serial, lote, producto o ensamblaje para ver su historial completo</p>
        </div>
      ) : (
        <>
          {vistaActiva === 'flujo' && <DiagramaFlujo />}
          
          {vistaActiva === 'genealogia' && <ArbolGenealogia />}
          
          {vistaActiva === 'metricas' && <PanelMetricas />}

          {vistaActiva === 'timeline' && (
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-slate-100 mb-6 flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-emerald-400" />
                Línea de Tiempo
              </h3>

              <div className="relative">
                {/* Línea vertical */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-700" />

                <div className="space-y-4">
                  {eventos.map((evento, index) => {
                    const colorConfig = getEventoColor(evento.tipoEvento);
                    const resultadoBadge = getResultadoBadge(evento.resultado);
                    
                    return (
                      <div key={evento.id} className="relative flex gap-4">
                        {/* Icono del evento */}
                        <div className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-xl border ${colorConfig.border} ${colorConfig.bg} flex items-center justify-center`}>
                          {getEventoIcon(evento.tipoEvento)}
                        </div>

                        {/* Contenido del evento */}
                        <div
                          className="flex-1 bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 hover:bg-slate-800/50 transition-colors cursor-pointer"
                          onClick={() => setSelectedEvento(evento)}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className={`font-medium ${colorConfig.text}`}>
                                {evento.tipoEvento.replace(/_/g, ' ')}
                              </h4>
                              {evento.descripcion && (
                                <p className="text-sm text-slate-400 mt-1">{evento.descripcion}</p>
                              )}
                            </div>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${resultadoBadge.bg} ${resultadoBadge.text}`}>
                              {evento.resultado}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatDate(evento.fechaHora)}
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
                            {evento.documentoNumero && (
                              <div className="flex items-center gap-1">
                                <FileText className="h-3.5 w-3.5" />
                                {evento.documentoTipo}: {evento.documentoNumero}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal de detalle del evento */}
      {selectedEvento && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl border ${getEventoColor(selectedEvento.tipoEvento).border} ${getEventoColor(selectedEvento.tipoEvento).bg} flex items-center justify-center`}>
                    {getEventoIcon(selectedEvento.tipoEvento)}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-100">
                      {selectedEvento.tipoEvento.replace(/_/g, ' ')}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {formatDate(selectedEvento.fechaHora)}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedEvento(null)} className="p-2 hover:bg-slate-700 rounded-xl transition-colors">
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
                {selectedEvento.loteCodigo && (
                  <div className="bg-slate-800/30 rounded-xl p-4">
                    <span className="text-xs text-slate-500">Lote</span>
                    <p className="text-slate-200 font-mono">{selectedEvento.loteCodigo}</p>
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
                    <p className="text-slate-200 font-mono">{selectedEvento.numeroTracking}</p>
                  </div>
                )}
              </div>

              {selectedEvento.descripcion && (
                <div className="mt-4 bg-slate-800/30 rounded-xl p-4">
                  <span className="text-xs text-slate-500">Descripción</span>
                  <p className="text-slate-200 mt-1">{selectedEvento.descripcion}</p>
                </div>
              )}

              {selectedEvento.datosAdicionales && Object.keys(selectedEvento.datosAdicionales).length > 0 && (
                <div className="mt-4 bg-slate-800/30 rounded-xl p-4">
                  <span className="text-xs text-slate-500">Datos Adicionales</span>
                  <pre className="text-xs text-slate-300 mt-2 overflow-auto">
                    {JSON.stringify(selectedEvento.datosAdicionales, null, 2)}
                  </pre>
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