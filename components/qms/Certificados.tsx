'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  FileCheck, Search, Plus, Filter, Download, RefreshCw, Printer,
  CheckCircle, XCircle, Clock, Eye, Edit, Trash2, Copy,
  Package, Users, Calendar, Building2, ChevronRight, ChevronDown,
  MoreHorizontal, FileText, Link2, Mail, Share2, X, Save,
  Award, Shield, Leaf, Star, Globe, FileSignature, QrCode,
  AlertTriangle, ExternalLink, History
} from 'lucide-react';

// ============================================
// TIPOS LOCALES
// ============================================

type TipoCertificado = 'coa' | 'coc' | 'coo' | 'msds' | 'halal' | 'kosher' | 'organico' | 'custom';
type EstadoCertificado = 'borrador' | 'emitido' | 'enviado' | 'vencido' | 'anulado';

interface Certificado {
  id: string;
  numero: string;
  tipo: TipoCertificado;
  
  // Producto y lote
  producto_id?: string;
  producto_codigo: string;
  producto_descripcion: string;
  lote_numero: string;
  cantidad: number;
  unidad_medida: string;
  
  // Fechas
  fecha_produccion?: string;
  fecha_vencimiento_producto?: string;
  fecha_emision: string;
  fecha_vencimiento_certificado?: string;
  
  // Cliente/Destino
  cliente_id?: string;
  cliente_nombre?: string;
  cliente_direccion?: string;
  pais_destino?: string;
  
  // Proveedor (para COO)
  proveedor_id?: string;
  proveedor_nombre?: string;
  origen_pais?: string;
  
  // Inspección relacionada
  inspeccion_id?: string;
  inspeccion_numero?: string;
  
  // Resultados de análisis
  resultados?: ResultadoAnalisis[];
  
  // Estado
  estado: EstadoCertificado;
  
  // Firmas
  emitido_por?: string;
  aprobado_por?: string;
  firma_digital?: string;
  
  // Notas y observaciones
  notas?: string;
  observaciones?: string;
  
  // Documentos adjuntos
  documentos?: { nombre: string; url: string }[];
  
  // QR/Verificación
  codigo_verificacion?: string;
  url_verificacion?: string;
  
  // Auditoría
  creado_por?: string;
  creado_at: string;
  actualizado_por?: string;
  actualizado_at?: string;
}

interface ResultadoAnalisis {
  id: string;
  parametro: string;
  especificacion: string;
  resultado: string;
  unidad?: string;
  metodo?: string;
  conforme: boolean;
}

interface CertificadoFormData {
  tipo: TipoCertificado;
  producto_codigo: string;
  producto_descripcion: string;
  lote_numero: string;
  cantidad: number;
  unidad_medida: string;
  fecha_produccion?: string;
  fecha_vencimiento_producto?: string;
  cliente_id?: string;
  cliente_nombre?: string;
  pais_destino?: string;
  proveedor_id?: string;
  proveedor_nombre?: string;
  origen_pais?: string;
  notas?: string;
}

type VistaActiva = 'lista' | 'nuevo' | 'detalle' | 'editar' | 'preview';

// ============================================
// CONFIGURACIONES
// ============================================

const TIPO_CONFIG: Record<TipoCertificado, { 
  label: string; 
  labelFull: string;
  color: string; 
  bg: string; 
  icon: React.ElementType;
  descripcion: string;
}> = {
  coa: { 
    label: 'COA', 
    labelFull: 'Certificate of Analysis',
    color: 'text-emerald-400', 
    bg: 'bg-emerald-500/20', 
    icon: FileCheck,
    descripcion: 'Certificado de Análisis - Resultados de pruebas de calidad'
  },
  coc: { 
    label: 'COC', 
    labelFull: 'Certificate of Conformance',
    color: 'text-blue-400', 
    bg: 'bg-blue-500/20', 
    icon: Shield,
    descripcion: 'Certificado de Conformidad - Cumplimiento de especificaciones'
  },
  coo: { 
    label: 'COO', 
    labelFull: 'Certificate of Origin',
    color: 'text-amber-400', 
    bg: 'bg-amber-500/20', 
    icon: Globe,
    descripcion: 'Certificado de Origen - País de manufactura'
  },
  msds: { 
    label: 'MSDS', 
    labelFull: 'Material Safety Data Sheet',
    color: 'text-red-400', 
    bg: 'bg-red-500/20', 
    icon: AlertTriangle,
    descripcion: 'Hoja de Datos de Seguridad del Material'
  },
  halal: { 
    label: 'Halal', 
    labelFull: 'Halal Certificate',
    color: 'text-green-400', 
    bg: 'bg-green-500/20', 
    icon: Award,
    descripcion: 'Certificación Halal'
  },
  kosher: { 
    label: 'Kosher', 
    labelFull: 'Kosher Certificate',
    color: 'text-purple-400', 
    bg: 'bg-purple-500/20', 
    icon: Star,
    descripcion: 'Certificación Kosher'
  },
  organico: { 
    label: 'Orgánico', 
    labelFull: 'Organic Certificate',
    color: 'text-lime-400', 
    bg: 'bg-lime-500/20', 
    icon: Leaf,
    descripcion: 'Certificación Orgánica'
  },
  custom: { 
    label: 'Custom', 
    labelFull: 'Custom Certificate',
    color: 'text-slate-400', 
    bg: 'bg-slate-500/20', 
    icon: FileSignature,
    descripcion: 'Certificado Personalizado'
  },
};

const ESTADO_CONFIG: Record<EstadoCertificado, { label: string; color: string; bg: string }> = {
  borrador: { label: 'Borrador', color: 'text-slate-400', bg: 'bg-slate-500/20' },
  emitido: { label: 'Emitido', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  enviado: { label: 'Enviado', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  vencido: { label: 'Vencido', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  anulado: { label: 'Anulado', color: 'text-red-400', bg: 'bg-red-500/20' },
};

// ============================================
// HELPERS
// ============================================

const formatDate = (date: string | null | undefined): string => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('es-UY', { 
    day: '2-digit', month: '2-digit', year: 'numeric' 
  });
};

const formatDateTime = (date: string | null | undefined): string => {
  if (!date) return '-';
  return new Date(date).toLocaleString('es-UY', { 
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const formatearNumeroCertificado = (tipo: TipoCertificado, secuencia: number): string => {
  const year = new Date().getFullYear();
  const prefijo = tipo.toUpperCase();
  return `${prefijo}-${year}-${secuencia.toString().padStart(6, '0')}`;
};

const generarCodigoVerificacion = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let codigo = '';
  for (let i = 0; i < 12; i++) {
    codigo += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return codigo;
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function Certificados() {
  // Estado principal
  const [loading, setLoading] = useState(true);
  const [vistaActiva, setVistaActiva] = useState<VistaActiva>('lista');
  const [certificadoSeleccionado, setCertificadoSeleccionado] = useState<Certificado | null>(null);
  
  // Datos
  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nombre: string }[]>([]);
  const [proveedores, setProveedores] = useState<{ id: string; nombre: string }[]>([]);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  
  // Form
  const [formData, setFormData] = useState<CertificadoFormData>({
    tipo: 'coa',
    producto_codigo: '',
    producto_descripcion: '',
    lote_numero: '',
    cantidad: 0,
    unidad_medida: 'unidades',
  });
  
  // Resultados de análisis (para COA)
  const [resultados, setResultados] = useState<ResultadoAnalisis[]>([]);
  
  // UI
  const [saving, setSaving] = useState(false);

  // ============================================
  // CARGA DE DATOS
  // ============================================

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadCertificados(),
        loadClientes(),
        loadProveedores(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCertificados = async () => {
    const { data, error } = await supabase
      .from('qms_certificados')
      .select('*')
      .order('fecha_emision', { ascending: false })
      .limit(500);

    if (!error && data) {
      setCertificados(data);
    }
  };

  const loadClientes = async () => {
    const { data } = await supabase
      .from('clientes')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre');
    if (data) setClientes(data);
  };

  const loadProveedores = async () => {
    const { data } = await supabase
      .from('proveedores')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre');
    if (data) setProveedores(data);
  };

  // ============================================
  // FILTRADO
  // ============================================

  const certificadosFiltrados = useMemo(() => {
    return certificados.filter(cert => {
      // Búsqueda
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchNumero = cert.numero?.toLowerCase().includes(search);
        const matchProducto = cert.producto_codigo?.toLowerCase().includes(search);
        const matchLote = cert.lote_numero?.toLowerCase().includes(search);
        const matchCliente = cert.cliente_nombre?.toLowerCase().includes(search);
        if (!matchNumero && !matchProducto && !matchLote && !matchCliente) return false;
      }
      
      // Filtro estado
      if (filtroEstado !== 'todos' && cert.estado !== filtroEstado) return false;
      
      // Filtro tipo
      if (filtroTipo !== 'todos' && cert.tipo !== filtroTipo) return false;
      
      return true;
    });
  }, [certificados, searchTerm, filtroEstado, filtroTipo]);

  // ============================================
  // ESTADÍSTICAS
  // ============================================

  const stats = useMemo(() => {
    const emitidosHoy = certificados.filter(c => {
      const fecha = new Date(c.fecha_emision);
      const hoy = new Date();
      return fecha.toDateString() === hoy.toDateString();
    }).length;
    
    const esteMes = certificados.filter(c => {
      const fecha = new Date(c.fecha_emision);
      const hoy = new Date();
      return fecha.getMonth() === hoy.getMonth() && fecha.getFullYear() === hoy.getFullYear();
    }).length;
    
    const porTipo = {
      coa: certificados.filter(c => c.tipo === 'coa').length,
      coc: certificados.filter(c => c.tipo === 'coc').length,
      coo: certificados.filter(c => c.tipo === 'coo').length,
      otros: certificados.filter(c => !['coa', 'coc', 'coo'].includes(c.tipo)).length,
    };
    
    const borradores = certificados.filter(c => c.estado === 'borrador').length;
    
    return { emitidosHoy, esteMes, porTipo, borradores };
  }, [certificados]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleNuevoCertificado = (tipo?: TipoCertificado) => {
    setFormData({
      tipo: tipo || 'coa',
      producto_codigo: '',
      producto_descripcion: '',
      lote_numero: '',
      cantidad: 0,
      unidad_medida: 'unidades',
    });
    setResultados([]);
    setVistaActiva('nuevo');
  };

  const handleVerDetalle = (cert: Certificado) => {
    setCertificadoSeleccionado(cert);
    setVistaActiva('detalle');
  };

  const handlePreview = (cert: Certificado) => {
    setCertificadoSeleccionado(cert);
    setVistaActiva('preview');
  };

  const handleGuardarCertificado = async (emitir: boolean = false) => {
    try {
      setSaving(true);
      
      if (vistaActiva === 'nuevo') {
        // Generar número
        const { data: lastCert } = await supabase
          .from('qms_certificados')
          .select('numero')
          .eq('tipo', formData.tipo)
          .order('creado_at', { ascending: false })
          .limit(1)
          .single();
        
        const lastSeq = lastCert?.numero ? parseInt(lastCert.numero.split('-')[2]) : 0;
        const numero = formatearNumeroCertificado(formData.tipo, lastSeq + 1);
        const codigoVerificacion = generarCodigoVerificacion();
        
        const { error } = await supabase
          .from('qms_certificados')
          .insert({
            numero,
            ...formData,
            resultados: formData.tipo === 'coa' ? resultados : null,
            estado: emitir ? 'emitido' : 'borrador',
            fecha_emision: new Date().toISOString(),
            codigo_verificacion: codigoVerificacion,
            creado_por: 'Usuario Actual',
          });
        
        if (error) throw error;
      } else {
        // Actualizar
        const updates: any = {
          ...formData,
          resultados: formData.tipo === 'coa' ? resultados : certificadoSeleccionado?.resultados,
          actualizado_at: new Date().toISOString(),
          actualizado_por: 'Usuario Actual',
        };
        
        if (emitir && certificadoSeleccionado?.estado === 'borrador') {
          updates.estado = 'emitido';
          updates.fecha_emision = new Date().toISOString();
        }
        
        const { error } = await supabase
          .from('qms_certificados')
          .update(updates)
          .eq('id', certificadoSeleccionado?.id);
        
        if (error) throw error;
      }
      
      await loadCertificados();
      setVistaActiva('lista');
      
    } catch (error) {
      console.error('Error guardando certificado:', error);
      alert('Error al guardar el certificado');
    } finally {
      setSaving(false);
    }
  };

  const handleCambiarEstado = async (certId: string, nuevoEstado: EstadoCertificado) => {
    try {
      const { error } = await supabase
        .from('qms_certificados')
        .update({
          estado: nuevoEstado,
          actualizado_at: new Date().toISOString(),
        })
        .eq('id', certId);
      
      if (error) throw error;
      
      await loadCertificados();
      if (certificadoSeleccionado?.id === certId) {
        setCertificadoSeleccionado({ ...certificadoSeleccionado, estado: nuevoEstado });
      }
    } catch (error) {
      console.error('Error cambiando estado:', error);
    }
  };

  const handleDuplicar = (cert: Certificado) => {
    setFormData({
      tipo: cert.tipo,
      producto_codigo: cert.producto_codigo,
      producto_descripcion: cert.producto_descripcion,
      lote_numero: '',
      cantidad: cert.cantidad,
      unidad_medida: cert.unidad_medida,
      cliente_id: cert.cliente_id,
      cliente_nombre: cert.cliente_nombre,
      pais_destino: cert.pais_destino,
      proveedor_id: cert.proveedor_id,
      proveedor_nombre: cert.proveedor_nombre,
      origen_pais: cert.origen_pais,
      notas: cert.notas,
    });
    setResultados(cert.resultados || []);
    setVistaActiva('nuevo');
  };

  const handleAgregarResultado = () => {
    setResultados(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        parametro: '',
        especificacion: '',
        resultado: '',
        conforme: true,
      }
    ]);
  };

  const handleActualizarResultado = (id: string, field: keyof ResultadoAnalisis, value: any) => {
    setResultados(prev => prev.map(r => 
      r.id === id ? { ...r, [field]: value } : r
    ));
  };

  const handleEliminarResultado = (id: string) => {
    setResultados(prev => prev.filter(r => r.id !== id));
  };

  const handleDescargarPDF = async (cert: Certificado) => {
    // TODO: Implementar generación de PDF
    alert(`Descargando PDF de ${cert.numero}... (Funcionalidad próximamente)`);
  };

  const handleEnviarEmail = async (cert: Certificado) => {
    // TODO: Implementar envío por email
    alert(`Enviando ${cert.numero} por email... (Funcionalidad próximamente)`);
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ==================== VISTA LISTA ==================== */}
      {vistaActiva === 'lista' && (
        <>
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <FileCheck className="h-6 w-6 text-cyan-400" />
                Certificados de Calidad
              </h3>
              <p className="text-slate-400 text-sm mt-1">
                Generación y gestión de COA, COC, COO y otros certificados
              </p>
            </div>
            
            {/* Stats */}
            <div className="flex gap-3">
              <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                <div className="text-xs text-emerald-400">COA</div>
                <div className="text-xl font-bold text-emerald-400">{stats.porTipo.coa}</div>
              </div>
              <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <div className="text-xs text-blue-400">COC</div>
                <div className="text-xl font-bold text-blue-400">{stats.porTipo.coc}</div>
              </div>
              <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <div className="text-xs text-amber-400">COO</div>
                <div className="text-xl font-bold text-amber-400">{stats.porTipo.coo}</div>
              </div>
              <div className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl">
                <div className="text-xs text-slate-400">Este mes</div>
                <div className="text-xl font-bold text-slate-300">{stats.esteMes}</div>
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
                  placeholder="Buscar por número, producto, lote, cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>
              
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
              >
                <option value="todos">Todos los tipos</option>
                <option value="coa">COA</option>
                <option value="coc">COC</option>
                <option value="coo">COO</option>
                <option value="msds">MSDS</option>
                <option value="halal">Halal</option>
                <option value="kosher">Kosher</option>
                <option value="organico">Orgánico</option>
              </select>
              
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm text-slate-100"
              >
                <option value="todos">Todos los estados</option>
                <option value="borrador">Borradores</option>
                <option value="emitido">Emitidos</option>
                <option value="enviado">Enviados</option>
                <option value="vencido">Vencidos</option>
              </select>
              
              <button
                onClick={loadCertificados}
                className="p-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-400 hover:text-slate-200 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            
            <button
              onClick={() => handleNuevoCertificado()}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-medium transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nuevo Certificado
            </button>
          </div>

          {/* Accesos rápidos */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => handleNuevoCertificado('coa')}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm hover:bg-emerald-500/20 transition-colors"
            >
              <FileCheck className="h-4 w-4" />
              + COA
            </button>
            <button
              onClick={() => handleNuevoCertificado('coc')}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 text-sm hover:bg-blue-500/20 transition-colors"
            >
              <Shield className="h-4 w-4" />
              + COC
            </button>
            <button
              onClick={() => handleNuevoCertificado('coo')}
              className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-sm hover:bg-amber-500/20 transition-colors"
            >
              <Globe className="h-4 w-4" />
              + COO
            </button>
          </div>

          {/* Lista de certificados */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Número</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Producto</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Lote</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Cliente</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Fecha</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {certificadosFiltrados.map(cert => {
                    const tipoConfig = TIPO_CONFIG[cert.tipo];
                    const estadoConfig = ESTADO_CONFIG[cert.estado];
                    const TipoIcon = tipoConfig.icon;
                    
                    return (
                      <tr key={cert.id} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm text-cyan-400">{cert.numero}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`flex items-center gap-1.5 text-sm ${tipoConfig.color}`}>
                            <TipoIcon className="h-4 w-4" />
                            {tipoConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-slate-200">{cert.producto_codigo}</div>
                          <div className="text-xs text-slate-500 truncate max-w-[200px]">{cert.producto_descripcion}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-slate-400">{cert.lote_numero}</td>
                        <td className="px-4 py-3 text-sm text-slate-400">{cert.cliente_nombre || '-'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs ${estadoConfig.bg} ${estadoConfig.color}`}>
                            {estadoConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-400">{formatDate(cert.fecha_emision)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleVerDetalle(cert)}
                              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200"
                              title="Ver detalle"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDescargarPDF(cert)}
                              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200"
                              title="Descargar PDF"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDuplicar(cert)}
                              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200"
                              title="Duplicar"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {certificadosFiltrados.length === 0 && (
              <div className="p-12 text-center text-slate-500">
                <FileCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No se encontraron certificados</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ==================== VISTA NUEVO/EDITAR ==================== */}
      {(vistaActiva === 'nuevo' || vistaActiva === 'editar') && (
        <CertificadoForm
          formData={formData}
          setFormData={setFormData}
          resultados={resultados}
          onAgregarResultado={handleAgregarResultado}
          onActualizarResultado={handleActualizarResultado}
          onEliminarResultado={handleEliminarResultado}
          clientes={clientes}
          proveedores={proveedores}
          onGuardar={handleGuardarCertificado}
          onCancelar={() => setVistaActiva('lista')}
          saving={saving}
          isEditing={vistaActiva === 'editar'}
        />
      )}

      {/* ==================== VISTA DETALLE ==================== */}
      {vistaActiva === 'detalle' && certificadoSeleccionado && (
        <CertificadoDetalle
          cert={certificadoSeleccionado}
          onVolver={() => setVistaActiva('lista')}
          onEditar={() => {
            setFormData({
              tipo: certificadoSeleccionado.tipo,
              producto_codigo: certificadoSeleccionado.producto_codigo,
              producto_descripcion: certificadoSeleccionado.producto_descripcion,
              lote_numero: certificadoSeleccionado.lote_numero,
              cantidad: certificadoSeleccionado.cantidad,
              unidad_medida: certificadoSeleccionado.unidad_medida,
              fecha_produccion: certificadoSeleccionado.fecha_produccion,
              fecha_vencimiento_producto: certificadoSeleccionado.fecha_vencimiento_producto,
              cliente_id: certificadoSeleccionado.cliente_id,
              cliente_nombre: certificadoSeleccionado.cliente_nombre,
              pais_destino: certificadoSeleccionado.pais_destino,
              proveedor_id: certificadoSeleccionado.proveedor_id,
              proveedor_nombre: certificadoSeleccionado.proveedor_nombre,
              origen_pais: certificadoSeleccionado.origen_pais,
              notas: certificadoSeleccionado.notas,
            });
            setResultados(certificadoSeleccionado.resultados || []);
            setVistaActiva('editar');
          }}
          onCambiarEstado={handleCambiarEstado}
          onDescargarPDF={handleDescargarPDF}
          onEnviarEmail={handleEnviarEmail}
          onDuplicar={handleDuplicar}
        />
      )}

      {/* ==================== VISTA PREVIEW ==================== */}
      {vistaActiva === 'preview' && certificadoSeleccionado && (
        <CertificadoPreview
          cert={certificadoSeleccionado}
          onVolver={() => setVistaActiva('detalle')}
          onDescargar={handleDescargarPDF}
        />
      )}
    </div>
  );
}

// ============================================
// SUB-COMPONENTE: FORMULARIO
// ============================================

interface CertificadoFormProps {
  formData: CertificadoFormData;
  setFormData: React.Dispatch<React.SetStateAction<CertificadoFormData>>;
  resultados: ResultadoAnalisis[];
  onAgregarResultado: () => void;
  onActualizarResultado: (id: string, field: keyof ResultadoAnalisis, value: any) => void;
  onEliminarResultado: (id: string) => void;
  clientes: { id: string; nombre: string }[];
  proveedores: { id: string; nombre: string }[];
  onGuardar: (emitir: boolean) => void;
  onCancelar: () => void;
  saving: boolean;
  isEditing: boolean;
}

function CertificadoForm({ 
  formData, setFormData, resultados, onAgregarResultado, onActualizarResultado, onEliminarResultado,
  clientes, proveedores, onGuardar, onCancelar, saving, isEditing 
}: CertificadoFormProps) {
  const tipoConfig = TIPO_CONFIG[formData.tipo];
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onCancelar}
          className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
        <div>
          <h3 className="text-xl font-bold text-slate-100">
            {isEditing ? 'Editar Certificado' : 'Nuevo Certificado'}
          </h3>
          <p className="text-sm text-slate-400">{tipoConfig.labelFull}</p>
        </div>
      </div>

      {/* Tipo de certificado */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
        <label className="block text-sm font-medium text-slate-300 mb-3">Tipo de Certificado *</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(TIPO_CONFIG).slice(0, 4).map(([key, val]) => {
            const Icon = val.icon;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, tipo: key as TipoCertificado }))}
                className={`p-3 rounded-xl border text-left transition-colors ${
                  formData.tipo === key
                    ? `${val.bg} border-current ${val.color}`
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <Icon className={`h-5 w-5 mb-1 ${formData.tipo === key ? val.color : 'text-slate-400'}`} />
                <div className={`font-medium text-sm ${formData.tipo === key ? val.color : 'text-slate-200'}`}>
                  {val.label}
                </div>
                <div className="text-xs text-slate-500 truncate">{val.labelFull}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Producto y lote */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6 space-y-4">
        <h4 className="font-medium text-slate-200">Información del Producto</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Código Producto *</label>
            <input
              type="text"
              value={formData.producto_codigo}
              onChange={(e) => setFormData(prev => ({ ...prev, producto_codigo: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="Ej: PROD-001"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Número de Lote *</label>
            <input
              type="text"
              value={formData.lote_numero}
              onChange={(e) => setFormData(prev => ({ ...prev, lote_numero: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="Ej: LOT-2024-001"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Descripción del Producto *</label>
          <input
            type="text"
            value={formData.producto_descripcion}
            onChange={(e) => setFormData(prev => ({ ...prev, producto_descripcion: e.target.value }))}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            placeholder="Descripción completa del producto"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Cantidad *</label>
            <input
              type="number"
              value={formData.cantidad || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, cantidad: parseFloat(e.target.value) || 0 }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Unidad</label>
            <select
              value={formData.unidad_medida}
              onChange={(e) => setFormData(prev => ({ ...prev, unidad_medida: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            >
              <option value="unidades">Unidades</option>
              <option value="kg">Kilogramos</option>
              <option value="g">Gramos</option>
              <option value="l">Litros</option>
              <option value="ml">Mililitros</option>
              <option value="cajas">Cajas</option>
              <option value="pallets">Pallets</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Fecha Producción</label>
            <input
              type="date"
              value={formData.fecha_produccion?.split('T')[0] || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, fecha_produccion: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Fecha Vencimiento</label>
            <input
              type="date"
              value={formData.fecha_vencimiento_producto?.split('T')[0] || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, fecha_vencimiento_producto: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            />
          </div>
        </div>
      </div>

      {/* Cliente/Destino */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6 space-y-4">
        <h4 className="font-medium text-slate-200">Destinatario</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Cliente</label>
            <select
              value={formData.cliente_id || ''}
              onChange={(e) => {
                const cliente = clientes.find(c => c.id === e.target.value);
                setFormData(prev => ({
                  ...prev,
                  cliente_id: e.target.value || undefined,
                  cliente_nombre: cliente?.nombre,
                }));
              }}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
            >
              <option value="">Seleccionar cliente...</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">País de Destino</label>
            <input
              type="text"
              value={formData.pais_destino || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, pais_destino: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              placeholder="Ej: Argentina"
            />
          </div>
        </div>
      </div>

      {/* Origen (solo para COO) */}
      {formData.tipo === 'coo' && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6 space-y-4">
          <h4 className="font-medium text-slate-200">Información de Origen</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Proveedor/Fabricante</label>
              <select
                value={formData.proveedor_id || ''}
                onChange={(e) => {
                  const prov = proveedores.find(p => p.id === e.target.value);
                  setFormData(prev => ({
                    ...prev,
                    proveedor_id: e.target.value || undefined,
                    proveedor_nombre: prov?.nombre,
                  }));
                }}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
              >
                <option value="">Seleccionar...</option>
                {proveedores.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">País de Origen *</label>
              <input
                type="text"
                value={formData.origen_pais || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, origen_pais: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100"
                placeholder="Ej: Uruguay"
              />
            </div>
          </div>
        </div>
      )}

      {/* Resultados de análisis (solo para COA) */}
      {formData.tipo === 'coa' && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-slate-200">Resultados de Análisis</h4>
            <button
              onClick={onAgregarResultado}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm"
            >
              <Plus className="h-4 w-4" />
              Agregar
            </button>
          </div>
          
          <div className="space-y-3">
            {resultados.map((resultado, idx) => (
              <div key={resultado.id} className="grid grid-cols-12 gap-3 items-start p-3 bg-slate-800/30 rounded-lg">
                <div className="col-span-3">
                  <label className="text-xs text-slate-500 mb-1 block">Parámetro</label>
                  <input
                    type="text"
                    value={resultado.parametro}
                    onChange={(e) => onActualizarResultado(resultado.id, 'parametro', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100"
                    placeholder="Ej: Pureza"
                  />
                </div>
                <div className="col-span-3">
                  <label className="text-xs text-slate-500 mb-1 block">Especificación</label>
                  <input
                    type="text"
                    value={resultado.especificacion}
                    onChange={(e) => onActualizarResultado(resultado.id, 'especificacion', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100"
                    placeholder="Ej: ≥99.5%"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-slate-500 mb-1 block">Resultado</label>
                  <input
                    type="text"
                    value={resultado.resultado}
                    onChange={(e) => onActualizarResultado(resultado.id, 'resultado', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100"
                    placeholder="Ej: 99.8%"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-slate-500 mb-1 block">Método</label>
                  <input
                    type="text"
                    value={resultado.metodo || ''}
                    onChange={(e) => onActualizarResultado(resultado.id, 'metodo', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100"
                    placeholder="Ej: HPLC"
                  />
                </div>
                <div className="col-span-1 pt-6">
                  <button
                    onClick={() => onActualizarResultado(resultado.id, 'conforme', !resultado.conforme)}
                    className={`w-full py-2 rounded-lg text-xs font-medium ${
                      resultado.conforme
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {resultado.conforme ? '✓' : '✗'}
                  </button>
                </div>
                <div className="col-span-1 pt-6">
                  <button
                    onClick={() => onEliminarResultado(resultado.id)}
                    className="w-full py-2 hover:bg-red-500/20 rounded-lg text-red-400"
                  >
                    <Trash2 className="h-4 w-4 mx-auto" />
                  </button>
                </div>
              </div>
            ))}
            
            {resultados.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No hay resultados de análisis</p>
                <p className="text-xs mt-1">Agregue los parámetros analizados</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notas */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
        <label className="block text-sm font-medium text-slate-300 mb-2">Notas / Observaciones</label>
        <textarea
          value={formData.notas || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, notas: e.target.value }))}
          rows={3}
          className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 resize-none"
          placeholder="Observaciones adicionales..."
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <button
          onClick={onCancelar}
          className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors"
        >
          Cancelar
        </button>
        
        <div className="flex gap-3">
          <button
            onClick={() => onGuardar(false)}
            disabled={saving || !formData.producto_codigo || !formData.lote_numero}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-slate-200 rounded-xl font-medium transition-colors"
          >
            <Save className="h-4 w-4" />
            Guardar Borrador
          </button>
          <button
            onClick={() => onGuardar(true)}
            disabled={saving || !formData.producto_codigo || !formData.lote_numero}
            className="flex items-center gap-2 px-6 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-medium transition-colors"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileCheck className="h-4 w-4" />}
            Emitir Certificado
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTE: DETALLE
// ============================================

interface CertificadoDetalleProps {
  cert: Certificado;
  onVolver: () => void;
  onEditar: () => void;
  onCambiarEstado: (id: string, estado: EstadoCertificado) => void;
  onDescargarPDF: (cert: Certificado) => void;
  onEnviarEmail: (cert: Certificado) => void;
  onDuplicar: (cert: Certificado) => void;
}

function CertificadoDetalle({ 
  cert, onVolver, onEditar, onCambiarEstado, onDescargarPDF, onEnviarEmail, onDuplicar 
}: CertificadoDetalleProps) {
  const tipoConfig = TIPO_CONFIG[cert.tipo];
  const estadoConfig = ESTADO_CONFIG[cert.estado];
  const TipoIcon = tipoConfig.icon;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onVolver}
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
          >
            <ChevronRight className="h-5 w-5 rotate-180" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <TipoIcon className={`h-6 w-6 ${tipoConfig.color}`} />
              <h3 className="text-xl font-bold text-slate-100">{cert.numero}</h3>
              <span className={`px-2 py-1 rounded-full text-xs ${estadoConfig.bg} ${estadoConfig.color}`}>
                {estadoConfig.label}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">{tipoConfig.labelFull}</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => onDescargarPDF(cert)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition-colors"
          >
            <Download className="h-4 w-4" />
            PDF
          </button>
          <button
            onClick={() => onEnviarEmail(cert)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition-colors"
          >
            <Mail className="h-4 w-4" />
            Enviar
          </button>
          {cert.estado === 'borrador' && (
            <button
              onClick={onEditar}
              className="flex items-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-white transition-colors"
            >
              <Edit className="h-4 w-4" />
              Editar
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contenido principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Producto */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <h4 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-slate-400" />
              Producto
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500">Código</label>
                <div className="font-mono text-slate-200">{cert.producto_codigo}</div>
              </div>
              <div>
                <label className="text-xs text-slate-500">Lote</label>
                <div className="font-mono text-slate-200">{cert.lote_numero}</div>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-500">Descripción</label>
                <div className="text-slate-200">{cert.producto_descripcion}</div>
              </div>
              <div>
                <label className="text-xs text-slate-500">Cantidad</label>
                <div className="text-slate-200">{cert.cantidad} {cert.unidad_medida}</div>
              </div>
              {cert.fecha_vencimiento_producto && (
                <div>
                  <label className="text-xs text-slate-500">Vencimiento</label>
                  <div className="text-slate-200">{formatDate(cert.fecha_vencimiento_producto)}</div>
                </div>
              )}
            </div>
          </div>

          {/* Resultados de análisis (COA) */}
          {cert.tipo === 'coa' && cert.resultados && cert.resultados.length > 0 && (
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h4 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-400" />
                Resultados de Análisis
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Parámetro</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Especificación</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Resultado</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Método</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Conforme</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {cert.resultados.map(r => (
                      <tr key={r.id}>
                        <td className="px-3 py-2 text-sm text-slate-200">{r.parametro}</td>
                        <td className="px-3 py-2 text-sm text-slate-400">{r.especificacion}</td>
                        <td className="px-3 py-2 text-sm text-slate-200 font-medium">{r.resultado}</td>
                        <td className="px-3 py-2 text-sm text-slate-400">{r.metodo || '-'}</td>
                        <td className="px-3 py-2 text-center">
                          {r.conforme ? (
                            <CheckCircle className="h-5 w-5 text-emerald-400 mx-auto" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-400 mx-auto" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Notas */}
          {cert.notas && (
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <h4 className="font-semibold text-slate-200 mb-2">Notas</h4>
              <p className="text-slate-400">{cert.notas}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Info */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 space-y-3">
            <h4 className="font-semibold text-slate-200 text-sm">Información</h4>
            
            <div>
              <label className="text-xs text-slate-500">Fecha Emisión</label>
              <div className="text-slate-200">{formatDate(cert.fecha_emision)}</div>
            </div>
            
            {cert.cliente_nombre && (
              <div>
                <label className="text-xs text-slate-500">Cliente</label>
                <div className="text-slate-200">{cert.cliente_nombre}</div>
              </div>
            )}
            
            {cert.pais_destino && (
              <div>
                <label className="text-xs text-slate-500">País Destino</label>
                <div className="text-slate-200">{cert.pais_destino}</div>
              </div>
            )}
            
            {cert.origen_pais && (
              <div>
                <label className="text-xs text-slate-500">País de Origen</label>
                <div className="text-slate-200">{cert.origen_pais}</div>
              </div>
            )}
            
            {cert.emitido_por && (
              <div>
                <label className="text-xs text-slate-500">Emitido por</label>
                <div className="text-slate-200">{cert.emitido_por}</div>
              </div>
            )}
            
            {cert.codigo_verificacion && (
              <div>
                <label className="text-xs text-slate-500">Código Verificación</label>
                <div className="font-mono text-cyan-400">{cert.codigo_verificacion}</div>
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 space-y-2">
            <h4 className="font-semibold text-slate-200 text-sm mb-3">Acciones</h4>
            
            {cert.estado === 'borrador' && (
              <button
                onClick={() => onCambiarEstado(cert.id, 'emitido')}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm"
              >
                <FileCheck className="h-4 w-4" />
                Emitir Certificado
              </button>
            )}
            
            {cert.estado === 'emitido' && (
              <button
                onClick={() => onCambiarEstado(cert.id, 'enviado')}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"
              >
                <Mail className="h-4 w-4" />
                Marcar como Enviado
              </button>
            )}
            
            <button
              onClick={() => onDuplicar(cert)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm"
            >
              <Copy className="h-4 w-4" />
              Duplicar
            </button>
            
            {cert.estado !== 'anulado' && (
              <button
                onClick={() => onCambiarEstado(cert.id, 'anulado')}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm"
              >
                <XCircle className="h-4 w-4" />
                Anular
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTE: PREVIEW
// ============================================

interface CertificadoPreviewProps {
  cert: Certificado;
  onVolver: () => void;
  onDescargar: (cert: Certificado) => void;
}

function CertificadoPreview({ cert, onVolver, onDescargar }: CertificadoPreviewProps) {
  const tipoConfig = TIPO_CONFIG[cert.tipo];
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={onVolver}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
          Volver
        </button>
        <button
          onClick={() => onDescargar(cert)}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl"
        >
          <Download className="h-4 w-4" />
          Descargar PDF
        </button>
      </div>
      
      {/* Preview del certificado (simulado) */}
      <div className="bg-white rounded-xl p-8 shadow-xl max-w-3xl mx-auto">
        <div className="border-b-2 border-slate-200 pb-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{tipoConfig.labelFull}</h1>
              <p className="text-slate-500 mt-1">Certificate Number: {cert.numero}</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-500">Issue Date</div>
              <div className="font-medium text-slate-800">{formatDate(cert.fecha_emision)}</div>
            </div>
          </div>
        </div>
        
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-500 uppercase mb-2">Product Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-400">Product Code</div>
                <div className="text-slate-800 font-medium">{cert.producto_codigo}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Batch/Lot Number</div>
                <div className="text-slate-800 font-medium">{cert.lote_numero}</div>
              </div>
              <div className="col-span-2">
                <div className="text-xs text-slate-400">Description</div>
                <div className="text-slate-800">{cert.producto_descripcion}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Quantity</div>
                <div className="text-slate-800">{cert.cantidad} {cert.unidad_medida}</div>
              </div>
            </div>
          </div>
          
          {cert.tipo === 'coa' && cert.resultados && cert.resultados.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-500 uppercase mb-2">Analysis Results</h2>
              <table className="w-full border border-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 border-b">Parameter</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 border-b">Specification</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 border-b">Result</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 border-b">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {cert.resultados.map(r => (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="px-3 py-2 text-sm text-slate-800">{r.parametro}</td>
                      <td className="px-3 py-2 text-sm text-slate-600">{r.especificacion}</td>
                      <td className="px-3 py-2 text-sm text-slate-800 font-medium">{r.resultado}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`text-xs font-medium ${r.conforme ? 'text-emerald-600' : 'text-red-600'}`}>
                          {r.conforme ? 'PASS' : 'FAIL'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          <div className="pt-8 border-t border-slate-200 mt-8">
            <div className="flex justify-between items-end">
              <div>
                <div className="text-xs text-slate-400 mb-1">Verification Code</div>
                <div className="font-mono text-sm text-slate-600">{cert.codigo_verificacion}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-600">Authorized Signature</div>
                <div className="mt-4 border-t border-slate-300 w-48"></div>
                <div className="text-xs text-slate-400 mt-1">{cert.emitido_por || 'Quality Manager'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}