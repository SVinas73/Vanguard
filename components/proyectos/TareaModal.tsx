'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Modal, Button, Input, Select, Card } from '@/components/ui';
import type { ProyectoTarea, ProyectoColumna, ProyectoEtiqueta, ProyectoSubtarea, ProyectoComentario } from '@/types';
import {
  Calendar,
  User,
  Tag,
  CheckSquare,
  MessageSquare,
  Paperclip,
  Clock,
  AlertTriangle,
  Plus,
  X,
  Send,
  Package,
  ShoppingCart,
  TrendingUp,
  RotateCcw,
  Wrench,
  Lock,
  Unlock,
  Upload,
  File,
  Image,
  FileText,
  Film,
  Music,
  Archive,
  Trash2,
  Download,
  Eye,
  Loader2,
  AtSign,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

// Tipo para adjuntos
interface ProyectoAdjunto {
  id: string;
  tareaId: string;
  nombreArchivo: string;
  url: string;
  tipoMime: string | null;
  tamanoBytes: number | null;
  subidoPor: string | null;
  creadoAt: Date;
}

// Tipo para miembros del proyecto
interface ProyectoMiembro {
  id: string;
  userEmail: string;
  rol: string;
}

interface TareaModalProps {
  isOpen: boolean;
  onClose: () => void;
  proyectoId: string;
  tarea?: ProyectoTarea;
  columnas: ProyectoColumna[];
  etiquetas: ProyectoEtiqueta[];
  columnaPreseleccionada?: string | null;
  onSave: () => void;
}

// Helper para obtener icono según tipo de archivo
const getFileIcon = (tipoMime: string | null) => {
  if (!tipoMime) return <File size={20} />;
  
  if (tipoMime.startsWith('image/')) return <Image size={20} className="text-blue-400" />;
  if (tipoMime.startsWith('video/')) return <Film size={20} className="text-purple-400" />;
  if (tipoMime.startsWith('audio/')) return <Music size={20} className="text-pink-400" />;
  if (tipoMime.includes('pdf')) return <FileText size={20} className="text-red-400" />;
  if (tipoMime.includes('zip') || tipoMime.includes('rar') || tipoMime.includes('7z')) 
    return <Archive size={20} className="text-amber-400" />;
  if (tipoMime.includes('word') || tipoMime.includes('document')) 
    return <FileText size={20} className="text-blue-500" />;
  if (tipoMime.includes('sheet') || tipoMime.includes('excel')) 
    return <FileText size={20} className="text-emerald-500" />;
  
  return <File size={20} className="text-slate-400" />;
};

// Helper para formatear tamaño de archivo
const formatFileSize = (bytes: number | null) => {
  if (!bytes) return 'Desconocido';
  
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

export function TareaModal({
  isOpen,
  onClose,
  proyectoId,
  tarea,
  columnas,
  etiquetas,
  columnaPreseleccionada,
  onSave,
}: TareaModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const comentarioInputRef = useRef<HTMLTextAreaElement>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<'detalles' | 'subtareas' | 'comentarios' | 'adjuntos'>('detalles');

  // Form data
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    prioridad: 'media' as 'baja' | 'media' | 'alta' | 'urgente',
    columnaId: '',
    asignadoA: '',
    fechaLimite: '',
    fechaInicio: '',
    tiempoEstimadoHoras: '',
    progreso: 0,
    completado: false,
    bloqueado: false,
    razonBloqueo: '',
    productoCodigo: '',
    ordenCompraId: '',
    ordenVentaId: '',
    rmaId: '',
    ensamblajeId: '',
  });

  const [etiquetasSeleccionadas, setEtiquetasSeleccionadas] = useState<string[]>([]);
  const [subtareas, setSubtareas] = useState<ProyectoSubtarea[]>([]);
  const [nuevaSubtarea, setNuevaSubtarea] = useState('');
  const [comentarios, setComentarios] = useState<ProyectoComentario[]>([]);
  const [nuevoComentario, setNuevoComentario] = useState('');
  
  // Adjuntos
  const [adjuntos, setAdjuntos] = useState<ProyectoAdjunto[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [dragOver, setDragOver] = useState(false);

  // Menciones
  const [miembrosProyecto, setMiembrosProyecto] = useState<ProyectoMiembro[]>([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionCaretPos, setMentionCaretPos] = useState(0);

  // Load data
  useEffect(() => {
    if (isOpen) {
      fetchMiembrosProyecto();
    }

    if (tarea) {
      setFormData({
        titulo: tarea.titulo,
        descripcion: tarea.descripcion || '',
        prioridad: tarea.prioridad,
        columnaId: tarea.columnaId || '',
        asignadoA: tarea.asignadoA || '',
        fechaLimite: tarea.fechaLimite ? tarea.fechaLimite.toISOString().split('T')[0] : '',
        fechaInicio: tarea.fechaInicio ? tarea.fechaInicio.toISOString().split('T')[0] : '',
        tiempoEstimadoHoras: tarea.tiempoEstimadoHoras?.toString() || '',
        progreso: tarea.progreso,
        completado: tarea.completado,
        bloqueado: tarea.bloqueado,
        razonBloqueo: tarea.razonBloqueo || '',
        productoCodigo: tarea.productoCodigo || '',
        ordenCompraId: tarea.ordenCompraId || '',
        ordenVentaId: tarea.ordenVentaId || '',
        rmaId: tarea.rmaId || '',
        ensamblajeId: tarea.ensamblajeId || '',
      });

      setEtiquetasSeleccionadas(tarea.etiquetas?.map(e => e.id) || []);
      setSubtareas(tarea.subtareas || []);
      
      fetchComentarios(tarea.id);
      fetchAdjuntos(tarea.id);
    } else {
      const columnaInicial = columnaPreseleccionada || (columnas.length > 0 ? columnas[0].id : '');
      setFormData(prev => ({ 
        ...prev, 
        columnaId: columnaInicial,
        titulo: '',
        descripcion: '',
        prioridad: 'media',
        asignadoA: '',
        fechaLimite: '',
        fechaInicio: '',
        tiempoEstimadoHoras: '',
        progreso: 0,
        completado: false,
        bloqueado: false,
        razonBloqueo: '',
        productoCodigo: '',
        ordenCompraId: '',
        ordenVentaId: '',
        rmaId: '',
        ensamblajeId: '',
      }));
      setEtiquetasSeleccionadas([]);
      setSubtareas([]);
      setComentarios([]);
      setAdjuntos([]);
    }
  }, [tarea, columnas, columnaPreseleccionada, isOpen]);

  const fetchMiembrosProyecto = async () => {
    const { data } = await supabase
      .from('proyecto_miembros')
      .select('id, user_email, rol')
      .eq('proyecto_id', proyectoId);

    if (data) {
      setMiembrosProyecto(data.map(m => ({
        id: m.id,
        userEmail: m.user_email,
        rol: m.rol,
      })));
    }
  };

  const fetchComentarios = async (tareaId: string) => {
    const { data } = await supabase
      .from('proyecto_comentarios')
      .select('*')
      .eq('tarea_id', tareaId)
      .order('creado_at', { ascending: true });

    if (data) {
      setComentarios(data.map(c => ({
        id: c.id,
        tareaId: c.tarea_id,
        usuarioEmail: c.usuario_email,
        contenido: c.contenido,
        createdAt: new Date(c.creado_at),
        updatedAt: new Date(c.actualizado_at),
      })));
    }
  };

  const fetchAdjuntos = async (tareaId: string) => {
    const { data, error } = await supabase
      .from('proyecto_adjuntos')
      .select('*')
      .eq('tarea_id', tareaId)
      .order('creado_at', { ascending: false });

    if (data) {
      setAdjuntos(data.map(a => ({
        id: a.id,
        tareaId: a.tarea_id,
        nombreArchivo: a.nombre_archivo,
        url: a.url,
        tipoMime: a.tipo_mime,
        tamanoBytes: a.tamano_bytes,
        subidoPor: a.subido_por,
        creadoAt: new Date(a.creado_at),
      })));
    }
  };

  // ============================================
  // ADJUNTOS - Handlers
  // ============================================

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleUploadFiles(Array.from(files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleUploadFiles(Array.from(files));
    }
  };

  const handleUploadFiles = async (files: File[]) => {
    if (!tarea) {
      alert('Primero guardá la tarea antes de subir adjuntos');
      return;
    }

    setUploadingFiles(true);
    const newProgress: { [key: string]: number } = {};

    for (const file of files) {
      try {
        newProgress[file.name] = 0;
        setUploadProgress({ ...newProgress });

        const fileExt = file.name.split('.').pop();
        const fileName = `${tarea.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('proyecto-adjuntos')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error('Error subiendo archivo:', uploadError);
          alert(`Error subiendo ${file.name}: ${uploadError.message}`);
          continue;
        }

        newProgress[file.name] = 50;
        setUploadProgress({ ...newProgress });

        const { data: urlData } = supabase.storage
          .from('proyecto-adjuntos')
          .getPublicUrl(fileName);

        const { data: adjuntoData, error: dbError } = await supabase
          .from('proyecto_adjuntos')
          .insert({
            tarea_id: tarea.id,
            nombre_archivo: file.name,
            url: urlData.publicUrl,
            tipo_mime: file.type,
            tamano_bytes: file.size,
            subido_por: user?.email || 'usuario@ejemplo.com',
          })
          .select()
          .single();

        if (dbError) {
          console.error('Error guardando adjunto en DB:', dbError);
          alert(`Error guardando ${file.name} en la base de datos`);
          continue;
        }

        newProgress[file.name] = 100;
        setUploadProgress({ ...newProgress });

        setAdjuntos(prev => [{
          id: adjuntoData.id,
          tareaId: adjuntoData.tarea_id,
          nombreArchivo: adjuntoData.nombre_archivo,
          url: adjuntoData.url,
          tipoMime: adjuntoData.tipo_mime,
          tamanoBytes: adjuntoData.tamano_bytes,
          subidoPor: adjuntoData.subido_por,
          creadoAt: new Date(adjuntoData.creado_at),
        }, ...prev]);

        await supabase.from('proyecto_actividades').insert({
          proyecto_id: proyectoId,
          tarea_id: tarea.id,
          usuario_email: user?.email || 'usuario@ejemplo.com',
          tipo: 'adjunto_agregado',
          descripcion: `Adjuntó archivo: ${file.name}`,
        });

      } catch (error) {
        console.error('Error en upload:', error);
        alert(`Error subiendo ${file.name}`);
      }
    }

    setUploadingFiles(false);
    setUploadProgress({});
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteAdjunto = async (adjunto: ProyectoAdjunto) => {
    const confirmar = window.confirm(`¿Eliminar "${adjunto.nombreArchivo}"?`);
    if (!confirmar) return;

    try {
      const urlParts = adjunto.url.split('/proyecto-adjuntos/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from('proyecto-adjuntos').remove([filePath]);
      }

      await supabase.from('proyecto_adjuntos').delete().eq('id', adjunto.id);
      setAdjuntos(prev => prev.filter(a => a.id !== adjunto.id));

      if (tarea) {
        await supabase.from('proyecto_actividades').insert({
          proyecto_id: proyectoId,
          tarea_id: tarea.id,
          usuario_email: user?.email || 'usuario@ejemplo.com',
          tipo: 'adjunto_eliminado',
          descripcion: `Eliminó archivo: ${adjunto.nombreArchivo}`,
        });
      }
    } catch (error) {
      console.error('Error eliminando adjunto:', error);
      alert('Error eliminando el archivo');
    }
  };

  const handleDownloadAdjunto = (adjunto: ProyectoAdjunto) => {
    window.open(adjunto.url, '_blank');
  };

  const handlePreviewAdjunto = (adjunto: ProyectoAdjunto) => {
    if (adjunto.tipoMime?.startsWith('image/') || adjunto.tipoMime?.includes('pdf')) {
      window.open(adjunto.url, '_blank');
    } else {
      handleDownloadAdjunto(adjunto);
    }
  };

  // ============================================
  // SAVE Handler
  // ============================================

  const handleSave = async () => {
    if (!formData.titulo.trim()) {
      alert('El título es obligatorio');
      return;
    }

    setLoading(true);

    try {
      const tareaData = {
        proyecto_id: proyectoId,
        columna_id: formData.columnaId || null,
        titulo: formData.titulo,
        descripcion: formData.descripcion || null,
        prioridad: formData.prioridad,
        fecha_limite: formData.fechaLimite || null,
        fecha_inicio: formData.fechaInicio || null,
        asignado_a: formData.asignadoA || null,
        tiempo_estimado_horas: formData.tiempoEstimadoHoras ? parseFloat(formData.tiempoEstimadoHoras) : null,
        progreso: formData.progreso,
        completado: formData.completado,
        bloqueado: formData.bloqueado,
        razon_bloqueo: formData.razonBloqueo || null,
        producto_codigo: formData.productoCodigo || null,
        orden_compra_id: formData.ordenCompraId || null,
        orden_venta_id: formData.ordenVentaId || null,
        rma_id: formData.rmaId || null,
        ensamblaje_id: formData.ensamblajeId || null,
        orden: tarea?.orden || 0,
        creado_por: user?.email || 'usuario@ejemplo.com',
      };

      let tareaId = tarea?.id;

      if (tarea) {
        await supabase.from('proyecto_tareas').update(tareaData).eq('id', tarea.id);
      } else {
        const { data, error } = await supabase.from('proyecto_tareas').insert(tareaData).select().single();
        if (error) throw error;
        tareaId = data.id;
      }

      if (tareaId) {
        await supabase.from('proyecto_tareas_etiquetas').delete().eq('tarea_id', tareaId);

        if (etiquetasSeleccionadas.length > 0) {
          await supabase.from('proyecto_tareas_etiquetas').insert(
            etiquetasSeleccionadas.map(etId => ({ tarea_id: tareaId, etiqueta_id: etId }))
          );
        }

        for (const sub of subtareas) {
          if (sub.id.startsWith('temp-')) {
            await supabase.from('proyecto_subtareas').insert({
              tarea_id: tareaId,
              titulo: sub.titulo,
              completado: sub.completado,
              orden: sub.orden,
            });
          }
        }
      }

      onSave();
    } catch (error) {
      console.error('Error guardando tarea:', error);
      alert('Error guardando tarea');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // SUBTAREAS Handlers
  // ============================================

  const handleAgregarSubtarea = () => {
    if (!nuevaSubtarea.trim()) return;

    setSubtareas([
      ...subtareas,
      {
        id: `temp-${Date.now()}`,
        tareaId: tarea?.id || '',
        titulo: nuevaSubtarea,
        completado: false,
        orden: subtareas.length,
        createdAt: new Date(),
      },
    ]);
    setNuevaSubtarea('');
  };

  const handleToggleSubtarea = async (subtareaId: string) => {
    const subtarea = subtareas.find(s => s.id === subtareaId);
    if (!subtarea) return;

    if (tarea && !subtareaId.startsWith('temp-')) {
      await supabase.from('proyecto_subtareas').update({ completado: !subtarea.completado }).eq('id', subtareaId);
    }

    setSubtareas(subtareas.map(s => s.id === subtareaId ? { ...s, completado: !s.completado } : s));
  };

  const handleEliminarSubtarea = async (subtareaId: string) => {
    if (tarea && !subtareaId.startsWith('temp-')) {
      await supabase.from('proyecto_subtareas').delete().eq('id', subtareaId);
    }
    setSubtareas(subtareas.filter(s => s.id !== subtareaId));
  };

  // ============================================
  // COMENTARIOS Handlers
  // ============================================

  const handleComentarioChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    setNuevoComentario(value);

    const textBeforeCursor = value.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionSearch(mentionMatch[1]);
      setMentionCaretPos(cursorPos);
      setShowMentionSuggestions(true);
    } else {
      setShowMentionSuggestions(false);
    }
  };

  const insertMention = (userEmail: string) => {
    const textBeforeMention = nuevoComentario.substring(0, mentionCaretPos - mentionSearch.length - 1);
    const textAfterCursor = nuevoComentario.substring(mentionCaretPos);
    
    const newText = `${textBeforeMention}@${userEmail} ${textAfterCursor}`;
    setNuevoComentario(newText);
    setShowMentionSuggestions(false);
    
    setTimeout(() => {
      if (comentarioInputRef.current) {
        const newPos = textBeforeMention.length + userEmail.length + 2;
        comentarioInputRef.current.focus();
        comentarioInputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@(\S+)/g;
    const mentions: string[] = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      const email = match[1];
      if (miembrosProyecto.some(m => m.userEmail === email)) {
        mentions.push(email);
      }
    }
    
    return [...new Set(mentions)];
  };

  const handleEnviarComentario = async () => {
    if (!nuevoComentario.trim() || !tarea) return;

    const menciones = extractMentions(nuevoComentario);

    const { data, error } = await supabase
      .from('proyecto_comentarios')
      .insert({
        tarea_id: tarea.id,
        usuario_email: user?.email || 'usuario@ejemplo.com',
        contenido: nuevoComentario,
      })
      .select()
      .single();

    if (!error && data) {
      if (menciones.length > 0) {
        await supabase.from('proyecto_menciones').insert(
          menciones.map(email => ({
            comentario_id: data.id,
            usuario_mencionado: email,
          }))
        );
      }

      setComentarios([
        ...comentarios,
        {
          id: data.id,
          tareaId: data.tarea_id,
          usuarioEmail: data.usuario_email,
          contenido: data.contenido,
          createdAt: new Date(data.creado_at),
          updatedAt: new Date(data.actualizado_at),
        },
      ]);
      setNuevoComentario('');

      await supabase.from('proyecto_actividades').insert({
        proyecto_id: proyectoId,
        tarea_id: tarea.id,
        usuario_email: user?.email || 'usuario@ejemplo.com',
        tipo: 'comentario',
        descripcion: `Comentó: "${nuevoComentario.substring(0, 50)}${nuevoComentario.length > 50 ? '...' : ''}"`,
      });
    }
  };

  const prioridadOptions = [
    { value: 'baja', label: 'Baja' },
    { value: 'media', label: 'Media' },
    { value: 'alta', label: 'Alta' },
    { value: 'urgente', label: 'Urgente' },
  ];

  const filteredMentions = miembrosProyecto.filter(m =>
    m.userEmail.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  const renderComentarioConMenciones = (contenido: string) => {
    const parts = contenido.split(/(@\S+)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        const email = part.substring(1);
        const isMember = miembrosProyecto.some(m => m.userEmail === email);
        
        return (
          <span
            key={index}
            className={cn(
              'font-medium',
              isMember ? 'text-emerald-400 hover:underline cursor-pointer' : 'text-slate-400'
            )}
          >
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={tarea ? 'Editar Tarea' : 'Nueva Tarea'} size="lg">
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-700/50 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('detalles')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
              activeTab === 'detalles' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
            )}
          >
            Detalles
          </button>
          <button
            onClick={() => setActiveTab('subtareas')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
              activeTab === 'subtareas' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <div className="flex items-center gap-2">
              <CheckSquare size={14} />
              Subtareas
              {subtareas.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-slate-700 rounded-full">
                  {subtareas.filter(s => s.completado).length}/{subtareas.length}
                </span>
              )}
            </div>
          </button>
          {tarea && (
            <>
              <button
                onClick={() => setActiveTab('comentarios')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                  activeTab === 'comentarios' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare size={14} />
                  Comentarios
                  {comentarios.length > 0 && (
                    <span className="px-1.5 py-0.5 text-xs bg-slate-700 rounded-full">
                      {comentarios.length}
                    </span>
                  )}
                </div>
              </button>
              <button
                onClick={() => setActiveTab('adjuntos')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                  activeTab === 'adjuntos' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <div className="flex items-center gap-2">
                  <Paperclip size={14} />
                  Adjuntos
                  {adjuntos.length > 0 && (
                    <span className="px-1.5 py-0.5 text-xs bg-slate-700 rounded-full">
                      {adjuntos.length}
                    </span>
                  )}
                </div>
              </button>
            </>
          )}
        </div>

        {/* Tab: Detalles */}
        {activeTab === 'detalles' && (
          <div className="space-y-4">
            <Input
              label="Título *"
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              placeholder="¿Qué hay que hacer?"
            />

            <div>
              <label className="block text-sm text-slate-400 mb-2">Descripción</label>
              <textarea
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Detalles adicionales..."
                rows={4}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Columna"
                value={formData.columnaId}
                onChange={(e) => setFormData({ ...formData, columnaId: e.target.value })}
                options={columnas.map(c => ({ value: c.id, label: c.nombre }))}
              />

              <Select
                label="Prioridad"
                value={formData.prioridad}
                onChange={(e) => setFormData({ ...formData, prioridad: e.target.value as any })}
                options={prioridadOptions}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Fecha inicio"
                type="date"
                value={formData.fechaInicio}
                onChange={(e) => setFormData({ ...formData, fechaInicio: e.target.value })}
              />

              <Input
                label="Fecha límite"
                type="date"
                value={formData.fechaLimite}
                onChange={(e) => setFormData({ ...formData, fechaLimite: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Asignado a"
                value={formData.asignadoA}
                onChange={(e) => setFormData({ ...formData, asignadoA: e.target.value })}
                placeholder="Email del usuario"
              />

              <Input
                label="Tiempo estimado (horas)"
                type="number"
                step="0.5"
                value={formData.tiempoEstimadoHoras}
                onChange={(e) => setFormData({ ...formData, tiempoEstimadoHoras: e.target.value })}
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Progreso: {formData.progreso}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={formData.progreso}
                onChange={(e) => setFormData({ ...formData, progreso: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Etiquetas</label>
              <div className="flex flex-wrap gap-2">
                {etiquetas.map(etiqueta => {
                  const isSelected = etiquetasSeleccionadas.includes(etiqueta.id);
                  return (
                    <button
                      key={etiqueta.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setEtiquetasSeleccionadas(etiquetasSeleccionadas.filter(id => id !== etiqueta.id));
                        } else {
                          setEtiquetasSeleccionadas([...etiquetasSeleccionadas, etiqueta.id]);
                        }
                      }}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm border transition-all',
                        isSelected ? 'border-opacity-100' : 'border-opacity-30 opacity-60 hover:opacity-100'
                      )}
                      style={{
                        backgroundColor: isSelected ? `${etiqueta.color}20` : 'transparent',
                        borderColor: etiqueta.color,
                        color: etiqueta.color,
                      }}
                    >
                      {etiqueta.nombre}
                    </button>
                  );
                })}
                {etiquetas.length === 0 && (
                  <span className="text-sm text-slate-500">No hay etiquetas en este proyecto</span>
                )}
              </div>
            </div>

            <Card className="p-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Package size={16} />
                Vínculos a otras entidades
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Código de Producto"
                  value={formData.productoCodigo}
                  onChange={(e) => setFormData({ ...formData, productoCodigo: e.target.value })}
                  placeholder="Ej: PROD-001"
                />
                <Input
                  label="ID Orden de Compra"
                  value={formData.ordenCompraId}
                  onChange={(e) => setFormData({ ...formData, ordenCompraId: e.target.value })}
                  placeholder="UUID"
                />
                <Input
                  label="ID Orden de Venta"
                  value={formData.ordenVentaId}
                  onChange={(e) => setFormData({ ...formData, ordenVentaId: e.target.value })}
                  placeholder="UUID"
                />
                <Input
                  label="ID RMA"
                  value={formData.rmaId}
                  onChange={(e) => setFormData({ ...formData, rmaId: e.target.value })}
                  placeholder="UUID"
                />
              </div>
            </Card>

            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/30 border border-slate-700/30 cursor-pointer hover:bg-slate-800/50 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.completado}
                  onChange={(e) => setFormData({ ...formData, completado: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500/20"
                />
                <span className="text-sm">Marcar como completada</span>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/30 border border-slate-700/30 cursor-pointer hover:bg-slate-800/50 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.bloqueado}
                  onChange={(e) => setFormData({ ...formData, bloqueado: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 text-red-500 focus:ring-red-500/20"
                />
                <span className="text-sm">Tarea bloqueada</span>
              </label>

              {formData.bloqueado && (
                <Input
                  label="Razón del bloqueo"
                  value={formData.razonBloqueo}
                  onChange={(e) => setFormData({ ...formData, razonBloqueo: e.target.value })}
                  placeholder="¿Por qué está bloqueada?"
                />
              )}
            </div>
          </div>
        )}

        {/* Tab: Subtareas */}
        {activeTab === 'subtareas' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={nuevaSubtarea}
                onChange={(e) => setNuevaSubtarea(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAgregarSubtarea()}
                placeholder="Nueva subtarea..."
                className="flex-1 px-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm"
              />
              <Button onClick={handleAgregarSubtarea} size="sm">
                <Plus size={18} />
              </Button>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {subtareas.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  <CheckSquare size={32} className="mx-auto mb-2 opacity-50" />
                  No hay subtareas. Agregá una arriba.
                </div>
              ) : (
                subtareas.map(subtarea => (
                  <div
                    key={subtarea.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/30 border border-slate-700/30 group"
                  >
                    <input
                      type="checkbox"
                      checked={subtarea.completado}
                      onChange={() => handleToggleSubtarea(subtarea.id)}
                      className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500/20"
                    />
                    <span className={cn('flex-1 text-sm', subtarea.completado && 'line-through text-slate-500')}>
                      {subtarea.titulo}
                    </span>
                    <button
                      onClick={() => handleEliminarSubtarea(subtarea.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded-lg text-red-400 transition-all"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab: Comentarios */}
        {activeTab === 'comentarios' && tarea && (
          <div className="space-y-4">
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {comentarios.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
                  No hay comentarios aún
                </div>
              ) : (
                comentarios.map(comentario => (
                  <div key={comentario.id} className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
                        {comentario.usuarioEmail.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs text-slate-400">{comentario.usuarioEmail}</span>
                      <span className="text-xs text-slate-600">•</span>
                      <span className="text-xs text-slate-600">{formatDate(comentario.createdAt)}</span>
                    </div>
                    <p className="text-sm text-slate-300">{renderComentarioConMenciones(comentario.contenido)}</p>
                  </div>
                ))
              )}
            </div>

            <div className="relative">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <textarea
                    ref={comentarioInputRef}
                    value={nuevoComentario}
                    onChange={handleComentarioChange}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && !showMentionSuggestions) {
                        e.preventDefault();
                        handleEnviarComentario();
                      }
                    }}
                    placeholder="Escribí un comentario... (usá @ para mencionar)"
                    rows={3}
                    className="w-full px-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm resize-none"
                  />
                  
                  {/* Sugerencias de menciones */}
                  {showMentionSuggestions && filteredMentions.length > 0 && (
                    <div className="absolute bottom-full left-0 mb-2 w-full max-w-sm bg-slate-800 border border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto z-50">
                      <div className="p-2 space-y-1">
                        <div className="px-3 py-1 text-xs text-slate-500 flex items-center gap-1">
                          <AtSign size={12} />
                          Mencionar usuario
                        </div>
                        {filteredMentions.map(miembro => (
                          <button
                            key={miembro.id}
                            onClick={() => insertMention(miembro.userEmail)}
                            className="w-full px-3 py-2 text-left rounded-lg hover:bg-slate-700/50 transition-colors group"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
                                {miembro.userEmail.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{miembro.userEmail}</p>
                                <p className="text-xs text-slate-500 capitalize">{miembro.rol}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <Button onClick={handleEnviarComentario} size="sm" className="self-end">
                  <Send size={18} />
                </Button>
              </div>
              <p className="text-xs text-slate-600 mt-2">
                Presioná @ para mencionar a un miembro del proyecto
              </p>
            </div>
          </div>
        )}

        {/* Tab: Adjuntos */}
        {activeTab === 'adjuntos' && tarea && (
          <div className="space-y-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
                dragOver ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/30'
              )}
            >
              <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />
              
              {uploadingFiles ? (
                <div className="flex flex-col items-center">
                  <Loader2 size={32} className="text-emerald-400 animate-spin mb-2" />
                  <p className="text-sm text-slate-400">Subiendo archivos...</p>
                </div>
              ) : (
                <>
                  <Upload size={32} className={cn('mx-auto mb-2', dragOver ? 'text-emerald-400' : 'text-slate-500')} />
                  <p className="text-sm text-slate-400 mb-1">
                    Arrastrá archivos aquí o hacé click para seleccionar
                  </p>
                  <p className="text-xs text-slate-600">Máximo 50MB por archivo</p>
                </>
              )}
            </div>

            {Object.keys(uploadProgress).length > 0 && (
              <div className="space-y-2">
                {Object.entries(uploadProgress).map(([fileName, progress]) => (
                  <div key={fileName} className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span className="truncate">{fileName}</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {adjuntos.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  <Paperclip size={32} className="mx-auto mb-2 opacity-50" />
                  No hay archivos adjuntos
                </div>
              ) : (
                adjuntos.map(adjunto => (
                  <div
                    key={adjunto.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/30 border border-slate-700/30 group hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex-shrink-0">{getFileIcon(adjunto.tipoMime)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{adjunto.nombreArchivo}</p>
                      <p className="text-xs text-slate-500">
                        {formatFileSize(adjunto.tamanoBytes)} • {formatDate(adjunto.creadoAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {adjunto.tipoMime?.startsWith('image/') && (
                        <button
                          onClick={() => handlePreviewAdjunto(adjunto)}
                          className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                          title="Vista previa"
                        >
                          <Eye size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDownloadAdjunto(adjunto)}
                        className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                        title="Descargar"
                      >
                        <Download size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteAdjunto(adjunto)}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'adjuntos' && !tarea && (
          <div className="text-center py-12 text-slate-500">
            <Paperclip size={48} className="mx-auto mb-4 opacity-50" />
            <p>Guardá la tarea primero para poder agregar adjuntos</p>
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-3 pt-4 mt-4 border-t border-slate-700/50">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading} className="flex-1">
            {loading ? 'Guardando...' : tarea ? 'Guardar Cambios' : 'Crear Tarea'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}