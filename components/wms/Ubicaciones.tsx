'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
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
  disponible: { label: 'Disponible', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  ocupada: { label: 'Ocupada', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  reservada: { label: 'Reservada', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  bloqueada: { label: 'Bloqueada', color: 'text-red-400', bg: 'bg-red-500/20' },
  mantenimiento: { label: 'Mantenimiento', color: 'text-slate-400', bg: 'bg-slate-500/20' },
};

const ABC_CONFIG: Record<ClasificacionABC, { label: string; color: string; bg: string }> = {
  A: { label: 'A', color: 'text-red-400', bg: 'bg-red-500/20' },
  B: { label: 'B', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  C: { label: 'C', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function Ubicaciones() {
  const [loading, setLoading] = useState(true);
  const [vistaActiva, setVistaActiva] = useState<VistaActiva>('lista');
  const [ubicacionSeleccionada, setUbicacionSeleccionada] = useState<Ubicacion | null>(null);
  
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  
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
      
      if (zonasData) setZonas(zonasData);
      else {
        // Datos de ejemplo
        setZonas([
          { id: '1', almacen_id: '1', codigo: 'ZA', nombre: 'Zona A - Alta Rotación', tipo: 'picking', ubicaciones_totales: 200, ubicaciones_disponibles: 50, activo: true },
          { id: '2', almacen_id: '1', codigo: 'ZB', nombre: 'Zona B - Media Rotación', tipo: 'almacenamiento', ubicaciones_totales: 400, ubicaciones_disponibles: 150, activo: true },
          { id: '3', almacen_id: '1', codigo: 'ZC', nombre: 'Zona C - Baja Rotación', tipo: 'almacenamiento', ubicaciones_totales: 300, ubicaciones_disponibles: 100, activo: true },
        ]);
      }

      // Cargar ubicaciones
      const { data: ubicacionesData } = await supabase
        .from('wms_ubicaciones')
        .select('*')
        .order('codigo_completo')
        .limit(500);
      
      if (ubicacionesData) setUbicaciones(ubicacionesData);
      else {
        // Generar datos de ejemplo
        const ejemplos: Ubicacion[] = [];
        const pasillos = ['A', 'B', 'C'];
        const estados: EstadoUbicacion[] = ['disponible', 'ocupada', 'ocupada', 'ocupada', 'reservada'];
        
        pasillos.forEach((pasillo, pi) => {
          for (let rack = 1; rack <= 5; rack++) {
            for (let nivel = 1; nivel <= 4; nivel++) {
              for (let pos = 1; pos <= 3; pos++) {
                const estadoRandom = estados[Math.floor(Math.random() * estados.length)];
                const tieneProducto = estadoRandom === 'ocupada';
                
                ejemplos.push({
                  id: `${pasillo}-${rack}-${nivel}-${pos}`,
                  almacen_id: '1',
                  zona_id: pi === 0 ? '1' : pi === 1 ? '2' : '3',
                  zona_nombre: pi === 0 ? 'Zona A' : pi === 1 ? 'Zona B' : 'Zona C',
                  codigo: `${pasillo}-${rack.toString().padStart(2, '0')}-${nivel.toString().padStart(2, '0')}-${pos.toString().padStart(2, '0')}`,
                  codigo_completo: `ALM01-${pasillo}-${rack.toString().padStart(2, '0')}-${nivel.toString().padStart(2, '0')}-${pos.toString().padStart(2, '0')}`,
                  pasillo,
                  rack: rack.toString(),
                  nivel: nivel.toString(),
                  posicion: pos.toString(),
                  estado: estadoRandom,
                  ancho_cm: 120,
                  alto_cm: 150,
                  profundidad_cm: 100,
                  peso_maximo_kg: 500,
                  clasificacion_abc: pi === 0 ? 'A' : pi === 1 ? 'B' : 'C',
                  producto_codigo: tieneProducto ? `SKU-${Math.floor(Math.random() * 9000) + 1000}` : undefined,
                  producto_nombre: tieneProducto ? `Producto ${Math.floor(Math.random() * 100)}` : undefined,
                  cantidad: tieneProducto ? Math.floor(Math.random() * 100) + 10 : 0,
                  cantidad_reservada: 0,
                  cantidad_disponible: tieneProducto ? Math.floor(Math.random() * 100) + 10 : 0,
                  pickeable: true,
                  es_ubicacion_picking: pi === 0,
                  frecuencia_picks: Math.floor(Math.random() * 50),
                  created_at: new Date().toISOString(),
                });
              }
            }
          }
        });
        setUbicaciones(ejemplos);
      }
    } finally {
      setLoading(false);
    }
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
  };

  const handleCambiarEstado = async (id: string, nuevoEstado: EstadoUbicacion) => {
    setUbicaciones(prev => prev.map(u => u.id === id ? { ...u, estado: nuevoEstado } : u));
    if (ubicacionSeleccionada?.id === id) {
      setUbicacionSeleccionada({ ...ubicacionSeleccionada, estado: nuevoEstado });
    }
  };

  const handleGenerarUbicaciones = async () => {
    setSaving(true);
    try {
      const zona = zonas.find(z => z.id === generarData.zona_id);
      if (!zona) return;

      const nuevas: Ubicacion[] = [];
      generarData.pasillos.forEach(pasillo => {
        for (let r = 1; r <= generarData.racks_por_pasillo; r++) {
          for (let n = 1; n <= generarData.niveles_por_rack; n++) {
            for (let p = 1; p <= generarData.posiciones_por_nivel; p++) {
              const codigo = `${pasillo}-${r.toString().padStart(2, '0')}-${n.toString().padStart(2, '0')}-${p.toString().padStart(2, '0')}`;
              nuevas.push({
                id: `gen-${codigo}`,
                almacen_id: zona.almacen_id,
                zona_id: zona.id,
                zona_nombre: zona.nombre,
                codigo,
                codigo_completo: `${zona.codigo}-${codigo}`,
                pasillo,
                rack: r.toString(),
                nivel: n.toString(),
                posicion: p.toString(),
                estado: 'disponible',
                cantidad: 0,
                cantidad_reservada: 0,
                cantidad_disponible: 0,
                pickeable: true,
                es_ubicacion_picking: zona.tipo === 'picking',
                frecuencia_picks: 0,
                created_at: new Date().toISOString(),
              });
            }
          }
        }
      });

      setUbicaciones(prev => [...prev, ...nuevas]);
      alert(`✅ Se generaron ${nuevas.length} ubicaciones`);
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
        <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ==================== LISTA ==================== */}
      {vistaActiva === 'lista' && (
        <>
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <MapPin className="h-6 w-6 text-blue-400" />
                Gestión de Ubicaciones
              </h3>
              <p className="text-slate-400 text-sm mt-1">Pasillo-Rack-Nivel-Posición</p>
            </div>
            
            <div className="flex gap-3">
              <div className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-center">
                <div className="text-xs text-slate-400">Total</div>
                <div className="text-xl font-bold text-slate-200">{stats.total}</div>
              </div>
              <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center">
                <div className="text-xs text-emerald-400">Disponibles</div>
                <div className="text-xl font-bold text-emerald-400">{stats.disponibles}</div>
              </div>
              <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-xl text-center">
                <div className="text-xs text-blue-400">Ocupación</div>
                <div className="text-xl font-bold text-blue-400">{stats.porcentaje}%</div>
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
                      <Layers className="h-5 w-5 text-blue-400" />
                      <span className="font-semibold text-slate-200">Pasillo {pasillo}</span>
                      <span className="px-2 py-0.5 bg-slate-800 rounded-full text-xs text-slate-400">{ubis.length} ubicaciones</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-emerald-400">{disponibles} disp.</span>
                      <span className="text-sm text-blue-400">{ocupadas} ocup.</span>
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
                                ub.estado === 'ocupada' ? 'bg-blue-500/10 border-blue-500/30' :
                                ub.estado === 'reservada' ? 'bg-amber-500/10 border-amber-500/30' :
                                ub.estado === 'bloqueada' ? 'bg-red-500/10 border-red-500/30' :
                                'bg-slate-800/50 border-slate-700/50'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-mono text-xs text-slate-300">{ub.codigo}</span>
                                <div className={`w-2 h-2 rounded-full ${estadoConfig.bg.replace('/20', '')}`} />
                              </div>
                              {ub.producto_codigo ? (
                                <div className="mt-1">
                                  <div className="text-xs text-blue-400 truncate">{ub.producto_codigo}</div>
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
                      <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium">
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
              <label className="block text-sm font-medium text-slate-300 mb-2">Zona *</label>
              <select
                value={generarData.zona_id}
                onChange={(e) => setGenerarData(p => ({ ...p, zona_id: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              >
                <option value="">Seleccionar...</option>
                {zonas.map(z => <option key={z.id} value={z.id}>{z.nombre}</option>)}
              </select>
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
              <div className="text-2xl font-bold text-blue-400">
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
                  <span className="font-mono text-lg text-blue-400">{ubicacionSeleccionada.codigo_completo}</span>
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
                <Package className="h-5 w-5 text-blue-400" /> Contenido
              </h4>
              {ubicacionSeleccionada.producto_codigo ? (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-800/50 rounded-lg">
                    <div className="font-mono text-sm text-blue-400">{ubicacionSeleccionada.producto_codigo}</div>
                    <div className="text-slate-200">{ubicacionSeleccionada.producto_nombre}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-3 bg-slate-800/30 rounded-lg">
                      <div className="text-2xl font-bold text-slate-100">{ubicacionSeleccionada.cantidad}</div>
                      <div className="text-xs text-slate-400">Total</div>
                    </div>
                    <div className="p-3 bg-amber-500/10 rounded-lg">
                      <div className="text-2xl font-bold text-amber-400">{ubicacionSeleccionada.cantidad_reservada}</div>
                      <div className="text-xs text-amber-400">Reservado</div>
                    </div>
                    <div className="p-3 bg-emerald-500/10 rounded-lg">
                      <div className="text-2xl font-bold text-emerald-400">{ubicacionSeleccionada.cantidad_disponible}</div>
                      <div className="text-xs text-emerald-400">Disponible</div>
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
                      className="px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-sm flex items-center justify-center gap-2">
                      <Unlock className="h-4 w-4" /> Disponible
                    </button>
                  )}
                  {ubicacionSeleccionada.estado !== 'bloqueada' && (
                    <button onClick={() => handleCambiarEstado(ubicacionSeleccionada.id, 'bloqueada')}
                      className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm flex items-center justify-center gap-2">
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
        </div>
      )}
    </div>
  );
}