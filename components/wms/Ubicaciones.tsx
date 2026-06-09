'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { registrarAuditoria } from '@/lib/audit';
import { sincronizarStockProducto } from '@/lib/wms-stock-sync';
import { getAlmacenesInsumoIds } from '@/lib/wms-insumos-filter';
import { useAuth } from '@/hooks/useAuth';
import { useWmsToast } from './useWmsToast';
import {
  MapPin, Search, Plus, RefreshCw, Eye, Edit,
  ChevronRight, ChevronDown, X, Save,
  Warehouse, Layers, Grid3X3, Box, Package, Lock,
  Unlock, Archive, Settings, BarChart3, Thermometer,
  ArrowRight, QrCode, Printer, CheckCircle, Clock, AlertTriangle
} from 'lucide-react';

// ============================================
// TIPOS
// ============================================

type TipoZona = 'recepcion' | 'almacenamiento' | 'picking' | 'packing' | 'despacho' | 'cuarentena' | 'devolucion';
type EstadoUbicacion = 'disponible' | 'ocupada' | 'reservada' | 'bloqueada' | 'mantenimiento';
type TipoAlmacenamiento = 'ambiente' | 'refrigerado' | 'congelado' | 'inflamable' | 'peligroso' | 'alto_valor';
type ClasificacionABC = 'A' | 'B' | 'C';

interface Zona {
  id: string;
  almacen_id: string;
  codigo: string;
  nombre: string;
  tipo: TipoZona;
  ubicaciones_totales: number;
  ubicaciones_disponibles: number;
  activo: boolean;
}

interface Ubicacion {
  id: string;
  almacen_id: string;
  zona_id: string;
  zona_nombre?: string;
  codigo: string;
  codigo_completo: string;
  pasillo: string;
  rack: string;
  nivel: string;
  posicion: string;
  estado: EstadoUbicacion;
  ancho_cm?: number;
  alto_cm?: number;
  profundidad_cm?: number;
  peso_maximo_kg?: number;
  clasificacion_abc?: ClasificacionABC;
  producto_id?: string;
  producto_codigo?: string;
  producto_nombre?: string;
  lote_numero?: string;
  cantidad: number;
  cantidad_reservada: number;
  cantidad_disponible: number;
  fecha_vencimiento?: string;
  pickeable: boolean;
  es_ubicacion_picking: boolean;
  frecuencia_picks: number;
  created_at: string;
}

type VistaActiva = 'lista' | 'mapa' | 'detalle' | 'generar';

// ============================================
// CONFIGURACIONES
// ============================================

const ESTADO_CONFIG: Record<EstadoUbicacion, { label: string; color: string; bg: string }> = {
  disponible: { label: 'Disponible', color: 'text-slate-300', bg: 'bg-slate-800/40' },
  ocupada: { label: 'Ocupada', color: 'text-slate-300', bg: 'bg-slate-800/40' },
  reservada: { label: 'Reservada', color: 'text-slate-300', bg: 'bg-slate-800/40' },
  bloqueada: { label: 'Bloqueada', color: 'text-slate-300', bg: 'bg-slate-800/40' },
  mantenimiento: { label: 'Mantenimiento', color: 'text-slate-400', bg: 'bg-slate-500/20' },
};

const ABC_CONFIG: Record<ClasificacionABC, { label: string; color: string; bg: string }> = {
  A: { label: 'A', color: 'text-slate-300', bg: 'bg-slate-800/40' },
  B: { label: 'B', color: 'text-slate-300', bg: 'bg-slate-800/40' },
  C: { label: 'C', color: 'text-slate-300', bg: 'bg-slate-800/40' },
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function Ubicaciones() {
  const { user } = useAuth(false);
  const toast = useWmsToast();
  const [loading, setLoading] = useState(true);
  const [vistaActiva, setVistaActiva] = useState<VistaActiva>('lista');
  const [ubicacionSeleccionada, setUbicacionSeleccionada] = useState<Ubicacion | null>(null);
  
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  // Asignar artículos del Depósito de Ventas a una ubicación + prioridad.
  const [productosVenta, setProductosVenta] = useState<Array<{ codigo: string; descripcion: string }>>([]);
  const [stockEnUbic, setStockEnUbic] = useState<Array<{ id: string; producto_codigo: string; cantidad: number }>>([]);
  const [asignarForm, setAsignarForm] = useState({ codigo: '', cantidad: '' });
  const [prioridadEdit, setPrioridadEdit] = useState<number>(50);
  // Crear zona (sin zona no se pueden generar ubicaciones)
  const [almacenesVenta, setAlmacenesVenta] = useState<Array<{ id: string; nombre: string }>>([]);
  const [showCrearZona, setShowCrearZona] = useState(false);
  const [zonaForm, setZonaForm] = useState({ nombre: '', codigo: '', almacen_id: '', tipo: 'almacenamiento' as TipoZona });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroZona, setFiltroZona] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroPasillo, setFiltroPasillo] = useState<string>('todos');
  
  const [expandedPasillos, setExpandedPasillos] = useState<Set<string>>(new Set());

  // Datos para generación masiva
  const [generarData, setGenerarData] = useState({
    zona_id: '',
    pasillos: ['A'],
    racks_por_pasillo: 10,
    niveles_por_rack: 4,
    posiciones_por_nivel: 3,
  });
  const [saving, setSaving] = useState(false);

  // ============================================
  // CARGA DE DATOS
  // ============================================

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Cargar zonas
      const { data: zonasData } = await supabase
        .from('wms_zonas')
        .select('*')
        .eq('activo', true)
        .order('codigo');
      setZonas(zonasData || []);

      // Almacenes de venta (WMS no opera insumos) para crear zonas.
      const idsIns = await getAlmacenesInsumoIds();
      const { data: almData } = await supabase
        .from('almacenes').select('id, nombre').eq('activo', true).order('es_principal', { ascending: false });
      setAlmacenesVenta((almData || []).filter((a: any) => !idsIns.has(a.id)).map((a: any) => ({ id: a.id, nombre: a.nombre })));

      // Cargar ubicaciones
      const { data: ubicacionesData } = await supabase
        .from('wms_ubicaciones')
        .select('*')
        .order('codigo_completo')
        .limit(500);

      // Stock real por ubicación (vive en wms_stock_ubicacion, no en
      // wms_ubicaciones). Lo mergeamos para que cada tarjeta muestre el
      // artículo y la cantidad, y marque "ocupada" en vez de "Vacía".
      const { data: stockData } = await supabase
        .from('wms_stock_ubicacion')
        .select('ubicacion_id, producto_codigo, cantidad')
        .gt('cantidad', 0);
      const stockPorUbic = new Map<string, { producto_codigo: string; cantidad: number }>();
      (stockData || []).forEach((s: any) => {
        const prev = stockPorUbic.get(s.ubicacion_id);
        stockPorUbic.set(s.ubicacion_id, {
          producto_codigo: s.producto_codigo,
          cantidad: (prev?.cantidad || 0) + (Number(s.cantidad) || 0),
        });
      });
      setUbicaciones((ubicacionesData || []).map((u: any) => {
        const st = stockPorUbic.get(u.id);
        if (!st) return u;
        return {
          ...u,
          producto_codigo: u.producto_codigo || st.producto_codigo,
          cantidad: st.cantidad,
          // Si tiene stock pero quedó marcada como disponible, mostrarla ocupada.
          estado: u.estado === 'disponible' ? 'ocupada' : u.estado,
        };
      }));

      // Productos del DEPÓSITO DE VENTAS (excluye insumos) para asignar a ubicaciones.
      const idsInsumos = await getAlmacenesInsumoIds();
      const { data: prods } = await supabase
        .from('productos')
        .select('codigo, descripcion, almacen_id')
        .order('descripcion')
        .limit(3000);
      setProductosVenta(
        (prods || [])
          .filter((p: any) => !p.almacen_id || !idsInsumos.has(p.almacen_id))
          .map((p: any) => ({ codigo: p.codigo, descripcion: p.descripcion })),
      );
    } finally {
      setLoading(false);
    }
  };

  const cargarStockUbic = async (ubicacionId: string) => {
    const { data } = await supabase
      .from('wms_stock_ubicacion')
      .select('id, producto_codigo, cantidad')
      .eq('ubicacion_id', ubicacionId)
      .gt('cantidad', 0);
    setStockEnUbic((data as any[]) || []);
  };

  // Coloca un artículo (del depósito de ventas) en la ubicación: crea/actualiza
  // wms_stock_ubicacion y sincroniza productos.stock. Así el picker lo ve.
  const handleAsignarProducto = async () => {
    const ub = ubicacionSeleccionada;
    if (!ub) return;
    if (!asignarForm.codigo) { toast.warning('Elegí un producto'); return; }
    const cant = parseFloat(asignarForm.cantidad) || 0;
    if (cant <= 0) { toast.warning('Ingresá una cantidad válida'); return; }
    const ahora = new Date().toISOString();

    const { data: existente } = await supabase
      .from('wms_stock_ubicacion')
      .select('id, cantidad, cantidad_reservada')
      .eq('ubicacion_id', ub.id)
      .eq('producto_codigo', asignarForm.codigo)
      .maybeSingle();

    // Inserta/actualiza descartando columnas que la BD rechace: inexistentes
    // (PGRST204 / "Could not find the 'X' column") o GENERADAS
    // ("cannot insert a non-DEFAULT value into column 'X'"), reintentando.
    const escribirResiliente = async (
      payload: Record<string, any>,
      modo: 'insert' | 'update',
      id?: string,
    ): Promise<any> => {
      let data = { ...payload };
      for (let intento = 0; intento < 6; intento++) {
        const q = modo === 'insert'
          ? supabase.from('wms_stock_ubicacion').insert(data)
          : supabase.from('wms_stock_ubicacion').update(data).eq('id', id!);
        const { error } = await q;
        if (!error) return null;
        const msg = error.message || '';
        // ¿Qué columna molesta? La sacamos y reintentamos.
        const m = msg.match(/column ['"]?(\w+)['"]?/i);
        const col = m?.[1];
        const recuperable =
          (error as any).code === 'PGRST204' ||
          /Could not find the/i.test(msg) ||
          /cannot insert a non-DEFAULT value/i.test(msg);
        if (recuperable && col && col in data) {
          delete data[col];
          continue;
        }
        return error;
      }
      return null;
    };

    let errColocar: any = null;
    if (existente) {
      const nueva = (Number((existente as any).cantidad) || 0) + cant;
      const reservada = Number((existente as any).cantidad_reservada) || 0;
      errColocar = await escribirResiliente(
        { cantidad: nueva, cantidad_disponible: Math.max(0, nueva - reservada), ultimo_movimiento: ahora },
        'update',
        (existente as any).id,
      );
    } else {
      errColocar = await escribirResiliente(
        {
          ubicacion_id: ub.id,
          ubicacion_codigo: ub.codigo_completo,
          producto_codigo: asignarForm.codigo,
          cantidad: cant,
          cantidad_reservada: 0,
          cantidad_disponible: cant,
          ultimo_movimiento: ahora,
        },
        'insert',
      );
    }

    // Si el insert/update falló (ej. RLS o columna faltante), NO mentimos.
    if (errColocar) {
      toast.error(`No se pudo colocar: ${errColocar.message}`);
      return;
    }

    await supabase.from('wms_ubicaciones').update({ estado: 'ocupada' }).eq('id', ub.id);
    await sincronizarStockProducto(asignarForm.codigo);
    await registrarAuditoria('wms_stock_ubicacion', 'ASIGNAR', ub.codigo_completo,
      null, { producto: asignarForm.codigo, cantidad: cant }, user?.email || '');

    toast.success(`Colocado: ${cant} uds de ${asignarForm.codigo} en ${ub.codigo_completo}`);
    setAsignarForm({ codigo: '', cantidad: '' });
    setUbicaciones(p => p.map(u => u.id === ub.id ? { ...u, estado: 'ocupada' as EstadoUbicacion } : u));
    cargarStockUbic(ub.id);
  };

  const handleGuardarPrioridad = async () => {
    const ub = ubicacionSeleccionada;
    if (!ub) return;
    const { error } = await supabase.from('wms_ubicaciones')
      .update({ prioridad_picking: prioridadEdit }).eq('id', ub.id);
    if (error) { toast.error(`No se pudo guardar la prioridad: ${error.message}`); return; }
    toast.success(`Prioridad guardada — ${ub.codigo_completo}: ${prioridadEdit}`);
  };

  const handleCrearZona = async () => {
    if (!zonaForm.nombre.trim()) { toast.warning('Poné un nombre de zona'); return; }
    if (!zonaForm.almacen_id) { toast.warning('Elegí un almacén'); return; }
    const codigo = (zonaForm.codigo.trim() || zonaForm.nombre.trim().slice(0, 3)).toUpperCase();
    const { error } = await supabase.from('wms_zonas').insert({
      nombre: zonaForm.nombre.trim(),
      codigo,
      almacen_id: zonaForm.almacen_id,
      tipo: zonaForm.tipo,
      activo: true,
    });
    if (error) { toast.error(`No se pudo crear la zona: ${error.message}`); return; }
    toast.success(`Zona "${zonaForm.nombre}" creada`);
    setShowCrearZona(false);
    setZonaForm({ nombre: '', codigo: '', almacen_id: '', tipo: 'almacenamiento' });
    loadData();
  };

  // ============================================
  // FILTRADO Y AGRUPACIÓN
  // ============================================

  const ubicacionesFiltradas = useMemo(() => {
    return ubicaciones.filter(ub => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!ub.codigo?.toLowerCase().includes(search) && 
            !ub.producto_codigo?.toLowerCase().includes(search)) return false;
      }
      if (filtroZona !== 'todos' && ub.zona_id !== filtroZona) return false;
      if (filtroEstado !== 'todos' && ub.estado !== filtroEstado) return false;
      if (filtroPasillo !== 'todos' && ub.pasillo !== filtroPasillo) return false;
      return true;
    });
  }, [ubicaciones, searchTerm, filtroZona, filtroEstado, filtroPasillo]);

  const ubicacionesPorPasillo = useMemo(() => {
    const grupos: Record<string, Ubicacion[]> = {};
    ubicacionesFiltradas.forEach(ub => {
      if (!grupos[ub.pasillo]) grupos[ub.pasillo] = [];
      grupos[ub.pasillo].push(ub);
    });
    return grupos;
  }, [ubicacionesFiltradas]);

  const pasillosUnicos = useMemo(() => 
    [...new Set(ubicaciones.map(u => u.pasillo))].sort(),
    [ubicaciones]
  );

  const stats = useMemo(() => {
    const total = ubicaciones.length;
    const disponibles = ubicaciones.filter(u => u.estado === 'disponible').length;
    const ocupadas = ubicaciones.filter(u => u.estado === 'ocupada').length;
    const porcentaje = total > 0 ? Math.round((ocupadas / total) * 100) : 0;
    return { total, disponibles, ocupadas, porcentaje };
  }, [ubicaciones]);

  // ============================================
  // HANDLERS
  // ============================================

  const togglePasillo = (pasillo: string) => {
    const newSet = new Set(expandedPasillos);
    if (newSet.has(pasillo)) newSet.delete(pasillo);
    else newSet.add(pasillo);
    setExpandedPasillos(newSet);
  };

  const handleVerDetalle = (ub: Ubicacion) => {
    setUbicacionSeleccionada(ub);
    setVistaActiva('detalle');
    setAsignarForm({ codigo: '', cantidad: '' });
    setPrioridadEdit((ub as any).prioridad_picking ?? 50);
    cargarStockUbic(ub.id);
  };

  const handleCambiarEstado = async (id: string, nuevoEstado: EstadoUbicacion) => {
    const prev = ubicaciones.find(u => u.id === id);
    const { error } = await supabase
      .from('wms_ubicaciones')
      .update({ estado: nuevoEstado })
      .eq('id', id);
    if (error) {
      toast.error('No se pudo cambiar el estado');
      return;
    }
    setUbicaciones(p => p.map(u => u.id === id ? { ...u, estado: nuevoEstado } : u));
    if (ubicacionSeleccionada?.id === id) {
      setUbicacionSeleccionada({ ...ubicacionSeleccionada, estado: nuevoEstado });
    }
    await registrarAuditoria(
      'wms_ubicaciones',
      'CAMBIAR_ESTADO',
      prev?.codigo || id,
      { estado: prev?.estado },
      { estado: nuevoEstado },
      user?.email || ''
    );
    toast.success(`Estado actualizado a ${nuevoEstado}`);
  };

  const handleGenerarUbicaciones = async () => {
    setSaving(true);
    try {
      const zona = zonas.find(z => z.id === generarData.zona_id);
      if (!zona) return;

      const nuevas: any[] = [];
      generarData.pasillos.forEach(pasillo => {
        for (let r = 1; r <= generarData.racks_por_pasillo; r++) {
          for (let n = 1; n <= generarData.niveles_por_rack; n++) {
            for (let p = 1; p <= generarData.posiciones_por_nivel; p++) {
              const codigo = `${pasillo}-${r.toString().padStart(2, '0')}-${n.toString().padStart(2, '0')}-${p.toString().padStart(2, '0')}`;
              // Solo columnas reales de wms_ubicaciones (el stock vive en
              // wms_stock_ubicacion, no acá; tampoco hay almacen_id).
              nuevas.push({
                zona_id: zona.id,
                codigo,
                codigo_completo: `${zona.codigo}-${codigo}`,
                pasillo,
                rack: r.toString(),
                nivel: n.toString(),
                posicion: p.toString(),
                estado: 'disponible',
              });
            }
          }
        }
      });

      // Insertamos en chunks para no superar límites de payload
      const chunkSize = 100;
      for (let i = 0; i < nuevas.length; i += chunkSize) {
        const chunk = nuevas.slice(i, i + chunkSize);
        const { error } = await supabase.from('wms_ubicaciones').insert(chunk);
        if (error) {
          toast.error(`Error al guardar (chunk ${i / chunkSize + 1}): ${error.message}`);
          return;
        }
      }

      await registrarAuditoria(
        'wms_ubicaciones',
        'GENERAR_MASIVO',
        zona.codigo,
        null,
        { zona: zona.nombre, cantidad: nuevas.length, pasillos: generarData.pasillos },
        user?.email || ''
      );

      toast.success(`${nuevas.length} ubicaciones generadas`);
      await loadData();
      setVistaActiva('lista');
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-8 w-8 animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <toast.Toast />
      {/* ==================== LISTA ==================== */}
      {vistaActiva === 'lista' && (
        <>
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <MapPin className="h-6 w-6 text-slate-300" />
                Gestión de Ubicaciones
              </h3>
              <p className="text-slate-400 text-sm mt-1">Pasillo-Rack-Nivel-Posición</p>
            </div>
            
            <div className="flex gap-3">
              <div className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-center">
                <div className="text-xs text-slate-400">Total</div>
                <div className="text-xl font-bold text-slate-200">{stats.total}</div>
              </div>
              <div className="px-4 py-2 bg-slate-800/40 border border-slate-700/40 rounded-xl text-center">
                <div className="text-xs text-slate-300">Disponibles</div>
                <div className="text-xl font-bold text-slate-300">{stats.disponibles}</div>
              </div>
              <div className="px-4 py-2 bg-slate-800/40 border border-slate-700/40 rounded-xl text-center">
                <div className="text-xs text-slate-300">Ocupación</div>
                <div className="text-xl font-bold text-slate-300">{stats.porcentaje}%</div>
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-3 items-center flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar ubicación o producto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
                />
              </div>
              
              <select
                value={filtroZona}
                onChange={(e) => setFiltroZona(e.target.value)}
                className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
              >
                <option value="todos">Todas las zonas</option>
                {zonas.map(z => <option key={z.id} value={z.id}>{z.nombre}</option>)}
              </select>
              
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
              >
                <option value="todos">Todos los estados</option>
                {Object.entries(ESTADO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              
              <button onClick={loadData} className="p-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-400 hover:text-slate-200">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setVistaActiva('mapa')}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl"
              >
                <Grid3X3 className="h-4 w-4" />
                Mapa
              </button>
              <button
                onClick={() => setVistaActiva('generar')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium"
              >
                <Plus className="h-4 w-4" />
                Generar
              </button>
            </div>
          </div>

          {/* Lista por pasillo */}
          <div className="space-y-3">
            {Object.entries(ubicacionesPorPasillo).sort().map(([pasillo, ubis]) => {
              const isExpanded = expandedPasillos.has(pasillo);
              const disponibles = ubis.filter(u => u.estado === 'disponible').length;
              const ocupadas = ubis.filter(u => u.estado === 'ocupada').length;
              
              return (
                <div key={pasillo} className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                  <button
                    onClick={() => togglePasillo(pasillo)}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-800/30"
                  >
                    <div className="flex items-center gap-3">
                      <ChevronRight className={`h-5 w-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      <Layers className="h-5 w-5 text-slate-300" />
                      <span className="font-semibold text-slate-200">Pasillo {pasillo}</span>
                      <span className="px-2 py-0.5 bg-slate-800 rounded-full text-xs text-slate-400">{ubis.length} ubicaciones</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-slate-300">{disponibles} disp.</span>
                      <span className="text-sm text-slate-300">{ocupadas} ocup.</span>
                    </div>
                  </button>
                  
                  {isExpanded && (
                    <div className="border-t border-slate-800/50 p-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                        {ubis.map(ub => {
                          const estadoConfig = ESTADO_CONFIG[ub.estado];
                          return (
                            <div
                              key={ub.id}
                              onClick={() => handleVerDetalle(ub)}
                              className={`p-3 rounded-lg border cursor-pointer transition-all hover:scale-105 ${
                                ub.estado === 'disponible' ? 'bg-slate-800/30 border-slate-700/50' :
                                ub.estado === 'ocupada' ? 'bg-slate-800/40 border-slate-700/40' :
                                ub.estado === 'reservada' ? 'bg-slate-800/40 border-slate-700/40' :
                                ub.estado === 'bloqueada' ? 'bg-slate-800/40 border-slate-700/40' :
                                'bg-slate-800/50 border-slate-700/50'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-mono text-xs text-slate-300">{ub.codigo}</span>
                                <div className={`w-2 h-2 rounded-full ${estadoConfig.bg.replace('/20', '')}`} />
                              </div>
                              {ub.producto_codigo ? (
                                <div className="mt-1">
                                  <div className="text-xs text-slate-300 truncate">{ub.producto_codigo}</div>
                                  <div className="text-xs text-slate-500">{ub.cantidad} uds</div>
                                </div>
                              ) : (
                                <div className="text-xs text-slate-600 mt-1">Vacía</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            
            {Object.keys(ubicacionesPorPasillo).length === 0 && (
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-12 text-center">
                <MapPin className="h-12 w-12 mx-auto mb-3 text-slate-600" />
                <p className="text-slate-400">No hay ubicaciones configuradas</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ==================== MAPA ==================== */}
      {vistaActiva === 'mapa' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setVistaActiva('lista')} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400">
                <ChevronRight className="h-5 w-5 rotate-180" />
              </button>
              <h3 className="text-xl font-bold text-slate-100">Mapa del Almacén</h3>
            </div>
            <div className="flex gap-3 text-xs">
              {Object.entries(ESTADO_CONFIG).map(([k, v]) => (
                <div key={k} className="flex items-center gap-1">
                  <div className={`w-3 h-3 rounded ${v.bg}`} />
                  <span className="text-slate-400">{v.label}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6 overflow-x-auto">
            <div className="flex gap-8">
              {pasillosUnicos.map(pasillo => {
                const ubsPasillo = ubicacionesFiltradas.filter(u => u.pasillo === pasillo);
                const racksUnicos = [...new Set(ubsPasillo.map(u => u.rack))].sort();
                
                return (
                  <div key={pasillo} className="flex-shrink-0">
                    <div className="text-center mb-4">
                      <span className="px-3 py-1 bg-slate-800/40 text-slate-300 rounded-full text-sm font-medium">
                        Pasillo {pasillo}
                      </span>
                    </div>
                    <div className="flex gap-4">
                      {racksUnicos.map(rack => {
                        const ubsRack = ubsPasillo.filter(u => u.rack === rack);
                        const nivelesUnicos = [...new Set(ubsRack.map(u => u.nivel))].sort().reverse();
                        
                        return (
                          <div key={rack} className="text-center">
                            <div className="text-xs text-slate-500 mb-2">R{rack}</div>
                            <div className="flex flex-col gap-1">
                              {nivelesUnicos.map(nivel => {
                                const ubsNivel = ubsRack.filter(u => u.nivel === nivel);
                                return (
                                  <div key={nivel} className="flex gap-1">
                                    {ubsNivel.sort((a, b) => a.posicion.localeCompare(b.posicion)).map(ub => {
                                      const cfg = ESTADO_CONFIG[ub.estado];
                                      return (
                                        <div
                                          key={ub.id}
                                          onClick={() => handleVerDetalle(ub)}
                                          className={`w-6 h-6 rounded cursor-pointer hover:scale-125 ${cfg.bg}`}
                                          title={`${ub.codigo} - ${cfg.label}`}
                                        />
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================== GENERAR ==================== */}
      {vistaActiva === 'generar' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setVistaActiva('lista')} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400">
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-xl font-bold text-slate-100">Generar Ubicaciones Masivas</h3>
          </div>

          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-300">Zona *</label>
                <button onClick={() => setShowCrearZona(v => !v)} className="text-xs text-blue-400 hover:text-blue-300">
                  {showCrearZona ? 'Cancelar' : '+ Crear zona'}
                </button>
              </div>
              <select
                value={generarData.zona_id}
                onChange={(e) => setGenerarData(p => ({ ...p, zona_id: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              >
                <option value="">Seleccionar...</option>
                {zonas.map(z => <option key={z.id} value={z.id}>{z.nombre}</option>)}
              </select>
              {zonas.length === 0 && !showCrearZona && (
                <p className="text-[11px] text-amber-400 mt-1">No hay zonas. Creá una primero con "+ Crear zona".</p>
              )}

              {showCrearZona && (
                <div className="mt-3 p-3 bg-slate-800/50 border border-slate-700 rounded-xl space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Nombre *</label>
                      <input value={zonaForm.nombre} onChange={e => setZonaForm(f => ({ ...f, nombre: e.target.value }))}
                        placeholder="Ej: Almacén principal" className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Código (opcional)</label>
                      <input value={zonaForm.codigo} onChange={e => setZonaForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))}
                        placeholder="Ej: ALM" className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 font-mono" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Almacén *</label>
                    <select value={zonaForm.almacen_id} onChange={e => setZonaForm(f => ({ ...f, almacen_id: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200">
                      <option value="">Elegir...</option>
                      {almacenesVenta.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                    </select>
                  </div>
                  <button onClick={handleCrearZona} className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm">
                    Crear zona
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Pasillos (separados por coma)</label>
              <input
                type="text"
                value={generarData.pasillos.join(', ')}
                onChange={(e) => setGenerarData(p => ({ ...p, pasillos: e.target.value.split(',').map(x => x.trim().toUpperCase()).filter(Boolean) }))}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                placeholder="A, B, C"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Racks/Pasillo</label>
                <input type="number" min={1} max={50} value={generarData.racks_por_pasillo}
                  onChange={(e) => setGenerarData(p => ({ ...p, racks_por_pasillo: +e.target.value || 1 }))}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Niveles/Rack</label>
                <input type="number" min={1} max={10} value={generarData.niveles_por_rack}
                  onChange={(e) => setGenerarData(p => ({ ...p, niveles_por_rack: +e.target.value || 1 }))}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Pos/Nivel</label>
                <input type="number" min={1} max={10} value={generarData.posiciones_por_nivel}
                  onChange={(e) => setGenerarData(p => ({ ...p, posiciones_por_nivel: +e.target.value || 1 }))}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
              </div>
            </div>

            <div className="p-4 bg-slate-800/50 rounded-xl">
              <div className="text-sm text-slate-400 mb-1">Se generarán:</div>
              <div className="text-2xl font-bold text-slate-300">
                {generarData.pasillos.length * generarData.racks_por_pasillo * generarData.niveles_por_rack * generarData.posiciones_por_nivel} ubicaciones
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setVistaActiva('lista')} className="px-4 py-2 text-slate-400">Cancelar</button>
            <button
              onClick={handleGenerarUbicaciones}
              disabled={saving || !generarData.zona_id}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white rounded-xl font-medium"
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Generar
            </button>
          </div>
        </div>
      )}

      {/* ==================== DETALLE ==================== */}
      {vistaActiva === 'detalle' && ubicacionSeleccionada && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setVistaActiva('lista')} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400">
                <ChevronRight className="h-5 w-5 rotate-180" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-lg text-slate-300">{ubicacionSeleccionada.codigo_completo}</span>
                  <span className={`px-2 py-1 rounded-full text-xs ${ESTADO_CONFIG[ubicacionSeleccionada.estado].bg} ${ESTADO_CONFIG[ubicacionSeleccionada.estado].color}`}>
                    {ESTADO_CONFIG[ubicacionSeleccionada.estado].label}
                  </span>
                </div>
                <p className="text-sm text-slate-400 mt-1">
                  Pasillo {ubicacionSeleccionada.pasillo} • Rack {ubicacionSeleccionada.rack} • Nivel {ubicacionSeleccionada.nivel}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-sm flex items-center gap-2">
                <QrCode className="h-4 w-4" /> QR
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h4 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <Package className="h-5 w-5 text-slate-300" /> Contenido
              </h4>
              {ubicacionSeleccionada.producto_codigo ? (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-800/50 rounded-lg">
                    <div className="font-mono text-sm text-slate-300">{ubicacionSeleccionada.producto_codigo}</div>
                    <div className="text-slate-200">{ubicacionSeleccionada.producto_nombre}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-3 bg-slate-800/30 rounded-lg">
                      <div className="text-2xl font-bold text-slate-100">{ubicacionSeleccionada.cantidad}</div>
                      <div className="text-xs text-slate-400">Total</div>
                    </div>
                    <div className="p-3 bg-slate-800/40 rounded-lg">
                      <div className="text-2xl font-bold text-slate-300">{ubicacionSeleccionada.cantidad_reservada}</div>
                      <div className="text-xs text-slate-300">Reservado</div>
                    </div>
                    <div className="p-3 bg-slate-800/40 rounded-lg">
                      <div className="text-2xl font-bold text-slate-300">{ubicacionSeleccionada.cantidad_disponible}</div>
                      <div className="text-xs text-slate-300">Disponible</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Archive className="h-12 w-12 mx-auto mb-3 text-slate-600" />
                  <p className="text-slate-400">Ubicación vacía</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                <h4 className="font-semibold text-slate-200 text-sm mb-3">Dimensiones</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-slate-400">Ancho:</span> <span className="text-slate-200">{ubicacionSeleccionada.ancho_cm || '-'} cm</span></div>
                  <div><span className="text-slate-400">Alto:</span> <span className="text-slate-200">{ubicacionSeleccionada.alto_cm || '-'} cm</span></div>
                  <div><span className="text-slate-400">Prof:</span> <span className="text-slate-200">{ubicacionSeleccionada.profundidad_cm || '-'} cm</span></div>
                  <div><span className="text-slate-400">Peso máx:</span> <span className="text-slate-200">{ubicacionSeleccionada.peso_maximo_kg || '-'} kg</span></div>
                </div>
              </div>

              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 space-y-2">
                <h4 className="font-semibold text-slate-200 text-sm mb-3">Cambiar Estado</h4>
                <div className="grid grid-cols-2 gap-2">
                  {ubicacionSeleccionada.estado !== 'disponible' && !ubicacionSeleccionada.producto_codigo && (
                    <button onClick={() => handleCambiarEstado(ubicacionSeleccionada.id, 'disponible')}
                      className="px-3 py-2 bg-slate-800/40 hover:bg-slate-800/40 text-slate-300 rounded-lg text-sm flex items-center justify-center gap-2">
                      <Unlock className="h-4 w-4" /> Disponible
                    </button>
                  )}
                  {ubicacionSeleccionada.estado !== 'bloqueada' && (
                    <button onClick={() => handleCambiarEstado(ubicacionSeleccionada.id, 'bloqueada')}
                      className="px-3 py-2 bg-slate-800/40 hover:bg-slate-800/40 text-slate-300 rounded-lg text-sm flex items-center justify-center gap-2">
                      <Lock className="h-4 w-4" /> Bloquear
                    </button>
                  )}
                  {ubicacionSeleccionada.estado !== 'mantenimiento' && (
                    <button onClick={() => handleCambiarEstado(ubicacionSeleccionada.id, 'mantenimiento')}
                      className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm flex items-center justify-center gap-2">
                      <Settings className="h-4 w-4" /> Manten.
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Asignar artículos (Depósito de Ventas) + prioridad de picking */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h4 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <Package className="h-5 w-5 text-slate-300" /> Artículos en esta ubicación
              </h4>
              {stockEnUbic.length === 0 ? (
                <p className="text-sm text-slate-500 mb-3">Sin artículos. Colocá uno abajo para que el picker lo vea.</p>
              ) : (
                <div className="space-y-1.5 mb-3">
                  {stockEnUbic.map(s => (
                    <div key={s.id} className="flex items-center justify-between px-3 py-2 bg-slate-800/50 rounded text-sm">
                      <span className="font-mono text-slate-300">{s.producto_codigo}</span>
                      <span className="text-slate-200">{s.cantidad} u.</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-7">
                  <label className="block text-xs text-slate-400 mb-1">Artículo (Depósito de Ventas)</label>
                  <select value={asignarForm.codigo} onChange={e => setAsignarForm(f => ({ ...f, codigo: e.target.value }))}
                    className="w-full px-2 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200">
                    <option value="">Elegir...</option>
                    {productosVenta.map(p => <option key={p.codigo} value={p.codigo}>{p.codigo} — {p.descripcion}</option>)}
                  </select>
                </div>
                <div className="col-span-3">
                  <label className="block text-xs text-slate-400 mb-1">Cantidad</label>
                  <input type="number" min="0" value={asignarForm.cantidad} onChange={e => setAsignarForm(f => ({ ...f, cantidad: e.target.value }))}
                    className="w-full px-2 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200" />
                </div>
                <div className="col-span-2">
                  <button onClick={handleAsignarProducto} className="w-full px-2 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm">Colocar</button>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h4 className="font-semibold text-slate-200 text-sm mb-2">Prioridad de picking</h4>
              <p className="text-[11px] text-slate-500 mb-3">Menor número = se pickea primero. El picker recorre las ubicaciones del pedido en este orden.</p>
              <div className="flex items-center gap-2">
                <input type="number" min="1" max="99" value={prioridadEdit} onChange={e => setPrioridadEdit(parseInt(e.target.value) || 50)}
                  className="w-24 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200" />
                <button onClick={handleGuardarPrioridad} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-sm">Guardar prioridad</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}