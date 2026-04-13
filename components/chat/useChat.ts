'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  ChatConversacion,
  ChatMensaje,
  ConversacionConNoLeidos,
  NuevaConversacionData,
  NuevoMensajeData,
} from './types';

// ============================================
// HOOK: useChat
// ============================================

interface UseChatOptions {
  userEmail: string;
  userName?: string;
}

export function useChat({ userEmail, userName }: UseChatOptions) {
  const [conversaciones, setConversaciones] = useState<ConversacionConNoLeidos[]>([]);
  const [conversacionesArchivadas, setConversacionesArchivadas] = useState<ConversacionConNoLeidos[]>([]);
  const [conversacionActiva, setConversacionActiva] = useState<ChatConversacion | null>(null);
  const [mensajes, setMensajes] = useState<ChatMensaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMensajes, setLoadingMensajes] = useState(false);
  const [totalNoLeidos, setTotalNoLeidos] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMensaje | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const mensajesChannelRef = useRef<RealtimeChannel | null>(null);

  // ============================================
  // CARGAR CONVERSACIONES
  // ============================================

  const fetchConversaciones = useCallback(async () => {
    if (!userEmail) return;

    try {
      // Active conversations
      const { data: convs, error: convError } = await supabase
        .from('chat_conversaciones')
        .select('*')
        .contains('participantes', [userEmail])
        .eq('activa', true)
        .order('created_at', { ascending: false });

      if (convError) throw convError;

      // Unread counts
      const { data: noLeidos } = await supabase
        .from('chat_no_leidos')
        .select('conversacion_id, cantidad')
        .eq('usuario_email', userEmail)
        .gt('cantidad', 0);

      const noLeidosMap = new Map(
        noLeidos?.map(n => [n.conversacion_id, n.cantidad]) || []
      );

      const convsConNoLeidos: ConversacionConNoLeidos[] = (convs || []).map(c => ({
        ...c,
        no_leidos: noLeidosMap.get(c.id) || 0,
      }));

      setConversaciones(convsConNoLeidos);
      setTotalNoLeidos(convsConNoLeidos.reduce((sum, c) => sum + c.no_leidos, 0));
    } catch (err: any) {
      console.error('Error fetching conversaciones:', err);
      const message = err?.message || String(err);
      if (message.includes('relation') && message.includes('does not exist')) {
        setError(
          'Las tablas del chat no existen en la base de datos. Ejecuta la migración 002_chat_system.sql para crearlas.'
        );
      } else {
        setError(`Error al cargar conversaciones: ${message}`);
      }
    } finally {
      setLoading(false);
    }
  }, [userEmail]);

  // ============================================
  // CARGAR CONVERSACIONES ARCHIVADAS
  // ============================================

  const fetchArchivadas = useCallback(async () => {
    if (!userEmail) return;

    try {
      const { data, error: archError } = await supabase
        .from('chat_conversaciones')
        .select('*')
        .contains('participantes', [userEmail])
        .eq('archivada', true)
        .order('created_at', { ascending: false });

      if (archError) throw archError;

      setConversacionesArchivadas((data || []).map(c => ({ ...c, no_leidos: 0 })));
    } catch (err) {
      console.error('Error fetching archived:', err);
    }
  }, [userEmail]);

  // ============================================
  // CARGAR MENSAJES DE UNA CONVERSACIÓN
  // ============================================

  const fetchMensajes = useCallback(async (conversacionId: string) => {
    setLoadingMensajes(true);

    try {
      const { data, error: msgError } = await supabase
        .from('chat_mensajes')
        .select('*')
        .eq('conversacion_id', conversacionId)
        .eq('eliminado', false)
        .order('created_at', { ascending: true });

      if (msgError) throw msgError;

      setMensajes((data || []).map(m => ({
        ...m,
        adjuntos: m.adjuntos || [],
        menciones: m.menciones || [],
        leido_por: m.leido_por || [],
        reacciones: m.reacciones || {},
      })));

      // Mark as read
      await marcarComoLeido(conversacionId);
    } catch (err) {
      console.error('Error fetching mensajes:', err);
    } finally {
      setLoadingMensajes(false);
    }
  }, [userEmail]);

  // ============================================
  // SELECCIONAR CONVERSACIÓN
  // ============================================

  const seleccionarConversacion = useCallback(async (conv: ChatConversacion) => {
    setConversacionActiva(conv);
    setReplyingTo(null);
    setEditingMessageId(null);
    await fetchMensajes(conv.id);

    // Subscribe to messages for this conversation
    if (mensajesChannelRef.current) {
      supabase.removeChannel(mensajesChannelRef.current);
    }

    mensajesChannelRef.current = supabase
      .channel(`mensajes:${conv.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_mensajes',
          filter: `conversacion_id=eq.${conv.id}`,
        },
        (payload) => {
          const nuevoMsg: ChatMensaje = {
            ...payload.new as any,
            adjuntos: (payload.new as any).adjuntos || [],
            menciones: (payload.new as any).menciones || [],
            leido_por: (payload.new as any).leido_por || [],
            reacciones: (payload.new as any).reacciones || {},
          };

          setMensajes(prev => {
            if (prev.some(m => m.id === nuevoMsg.id)) return prev;
            return [...prev, nuevoMsg];
          });

          if (nuevoMsg.autor_email !== userEmail) {
            marcarComoLeido(conv.id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_mensajes',
          filter: `conversacion_id=eq.${conv.id}`,
        },
        (payload) => {
          const updated = payload.new as any;
          setMensajes(prev => prev.map(m =>
            m.id === updated.id ? {
              ...m,
              ...updated,
              adjuntos: updated.adjuntos || m.adjuntos,
              menciones: updated.menciones || m.menciones,
              leido_por: updated.leido_por || m.leido_por,
              reacciones: updated.reacciones || m.reacciones || {},
            } : m
          ));
        }
      )
      .subscribe();
  }, [fetchMensajes, userEmail]);

  // ============================================
  // CREAR CONVERSACIÓN
  // ============================================

  const crearConversacion = useCallback(async (data: NuevaConversacionData): Promise<ChatConversacion | null> => {
    try {
      const participantes = Array.from(new Set([...data.participantes, userEmail]));

      const { data: conv, error: insertError } = await supabase
        .from('chat_conversaciones')
        .insert({
          titulo: data.titulo || null,
          tipo: data.tipo,
          referencia_id: data.referencia_id || null,
          referencia_codigo: data.referencia_codigo || null,
          participantes,
          creado_por: userEmail,
          activa: true,
          archivada: false,
          total_mensajes: 0,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      if (!conv) throw new Error('No se recibió respuesta al crear la conversación');

      // Send initial message if provided
      if (data.mensaje_inicial) {
        await supabase
          .from('chat_mensajes')
          .insert({
            conversacion_id: conv.id,
            autor_email: userEmail,
            autor_nombre: userName,
            contenido: data.mensaje_inicial,
            leido_por: [userEmail],
            tipo: 'texto',
          });

        // Update conversation metadata
        await supabase
          .from('chat_conversaciones')
          .update({
            ultimo_mensaje_at: new Date().toISOString(),
            ultimo_mensaje_preview: data.mensaje_inicial.substring(0, 100),
            total_mensajes: 1,
          })
          .eq('id', conv.id);
      }

      // Refresh list
      await fetchConversaciones();

      // Also add to local state immediately in case fetch didn't pick it up
      const convWithNoLeidos: ConversacionConNoLeidos = {
        ...(conv as ChatConversacion),
        no_leidos: 0,
      };
      setConversaciones(prev => {
        if (prev.some(c => c.id === conv.id)) return prev;
        return [convWithNoLeidos, ...prev];
      });

      return conv as ChatConversacion;
    } catch (err: any) {
      console.error('Error creando conversación:', err);
      const message = err?.message || String(err);
      setError(`Error al crear conversación: ${message}`);
      return null;
    }
  }, [userEmail, userName, fetchConversaciones]);

  // ============================================
  // ENVIAR MENSAJE
  // ============================================

  const enviarMensaje = useCallback(async (data: NuevoMensajeData): Promise<ChatMensaje | null> => {
    try {
      // Extract mentions
      const mencionesRegex = /@([\w.-]+@[\w.-]+\.\w+)/g;
      const menciones = data.menciones || [];
      let match;
      while ((match = mencionesRegex.exec(data.contenido)) !== null) {
        if (!menciones.includes(match[1])) {
          menciones.push(match[1]);
        }
      }

      const { data: mensaje, error: sendError } = await supabase
        .from('chat_mensajes')
        .insert({
          conversacion_id: data.conversacion_id,
          autor_email: userEmail,
          autor_nombre: userName,
          contenido: data.contenido,
          menciones,
          respuesta_a_id: data.respuesta_a_id || null,
          leido_por: [userEmail],
          tipo: 'texto',
        })
        .select()
        .single();

      if (sendError) throw sendError;

      // Update conversation metadata
      await supabase
        .from('chat_conversaciones')
        .update({
          ultimo_mensaje_at: new Date().toISOString(),
          ultimo_mensaje_preview: data.contenido.substring(0, 100),
          total_mensajes: (conversacionActiva?.total_mensajes || 0) + 1,
        })
        .eq('id', data.conversacion_id);

      // Increment unread for other participants
      if (conversacionActiva) {
        const otrosParticipantes = conversacionActiva.participantes.filter(p => p !== userEmail);
        for (const email of otrosParticipantes) {
          // Check if unread record exists
          const { data: existing } = await supabase
            .from('chat_no_leidos')
            .select('cantidad')
            .eq('usuario_email', email)
            .eq('conversacion_id', data.conversacion_id)
            .maybeSingle();

          if (existing) {
            await supabase
              .from('chat_no_leidos')
              .update({ cantidad: (existing.cantidad || 0) + 1 })
              .eq('usuario_email', email)
              .eq('conversacion_id', data.conversacion_id);
          } else {
            await supabase
              .from('chat_no_leidos')
              .insert({
                usuario_email: email,
                conversacion_id: data.conversacion_id,
                cantidad: 1,
              });
          }
        }
      }

      // Clear reply state
      setReplyingTo(null);

      return mensaje ? {
        ...mensaje,
        adjuntos: mensaje.adjuntos || [],
        menciones: mensaje.menciones || [],
        leido_por: mensaje.leido_por || [],
        reacciones: {},
      } : null;
    } catch (err: any) {
      console.error('Error enviando mensaje:', err);
      const message = err?.message || String(err);
      setError(`Error al enviar mensaje: ${message}`);
      return null;
    }
  }, [userEmail, userName, conversacionActiva]);

  // ============================================
  // EDITAR MENSAJE
  // ============================================

  const editarMensaje = useCallback(async (mensajeId: string, nuevoContenido: string): Promise<boolean> => {
    try {
      const { error: editError } = await supabase
        .from('chat_mensajes')
        .update({
          contenido: nuevoContenido,
          editado: true,
          editado_at: new Date().toISOString(),
        })
        .eq('id', mensajeId)
        .eq('autor_email', userEmail);

      if (editError) throw editError;

      setMensajes(prev => prev.map(m =>
        m.id === mensajeId
          ? { ...m, contenido: nuevoContenido, editado: true, editado_at: new Date().toISOString() }
          : m
      ));

      setEditingMessageId(null);
      return true;
    } catch (err: any) {
      console.error('Error editando mensaje:', err);
      setError('Error al editar el mensaje');
      return false;
    }
  }, [userEmail]);

  // ============================================
  // ELIMINAR MENSAJE
  // ============================================

  const eliminarMensaje = useCallback(async (mensajeId: string): Promise<boolean> => {
    try {
      const { error: delError } = await supabase
        .from('chat_mensajes')
        .update({
          eliminado: true,
          eliminado_at: new Date().toISOString(),
          contenido: '',
        })
        .eq('id', mensajeId)
        .eq('autor_email', userEmail);

      if (delError) throw delError;

      setMensajes(prev => prev.filter(m => m.id !== mensajeId));
      return true;
    } catch (err: any) {
      console.error('Error eliminando mensaje:', err);
      setError('Error al eliminar el mensaje');
      return false;
    }
  }, [userEmail]);

  // ============================================
  // REACCIONAR A MENSAJE
  // ============================================

  const reaccionarMensaje = useCallback(async (mensajeId: string, emoji: string): Promise<boolean> => {
    try {
      const mensaje = mensajes.find(m => m.id === mensajeId);
      if (!mensaje) return false;

      const reacciones = { ...(mensaje.reacciones || {}) };
      const users = reacciones[emoji] || [];

      if (users.includes(userEmail)) {
        // Remove reaction
        reacciones[emoji] = users.filter(u => u !== userEmail);
        if (reacciones[emoji].length === 0) delete reacciones[emoji];
      } else {
        // Add reaction
        reacciones[emoji] = [...users, userEmail];
      }

      const { error: reactError } = await supabase
        .from('chat_mensajes')
        .update({ reacciones })
        .eq('id', mensajeId);

      if (reactError) throw reactError;

      setMensajes(prev => prev.map(m =>
        m.id === mensajeId ? { ...m, reacciones } : m
      ));

      return true;
    } catch (err) {
      console.error('Error reacting:', err);
      return false;
    }
  }, [mensajes, userEmail]);

  // ============================================
  // MARCAR COMO LEÍDO
  // ============================================

  const marcarComoLeido = useCallback(async (conversacionId: string) => {
    if (!userEmail) return;
    try {
      await supabase.rpc('marcar_mensajes_leidos', {
        p_conversacion_id: conversacionId,
        p_usuario_email: userEmail,
      });

      setConversaciones(prev => prev.map(c =>
        c.id === conversacionId ? { ...c, no_leidos: 0 } : c
      ));

      setTotalNoLeidos(prev => {
        const conv = conversaciones.find(c => c.id === conversacionId);
        return Math.max(0, prev - (conv?.no_leidos || 0));
      });
    } catch (err) {
      console.error('Error marcando como leído:', err);
    }
  }, [userEmail, conversaciones]);

  // ============================================
  // AGREGAR PARTICIPANTE
  // ============================================

  const agregarParticipante = useCallback(async (conversacionId: string, email: string) => {
    try {
      const conv = conversaciones.find(c => c.id === conversacionId);
      if (!conv) return false;

      const nuevosParticipantes = [...conv.participantes, email];

      const { error: updateError } = await supabase
        .from('chat_conversaciones')
        .update({ participantes: nuevosParticipantes })
        .eq('id', conversacionId);

      if (updateError) throw updateError;

      // System message
      await supabase.from('chat_mensajes').insert({
        conversacion_id: conversacionId,
        autor_email: userEmail,
        autor_nombre: userName,
        contenido: `${email} se unió a la conversación`,
        tipo: 'sistema',
        leido_por: [userEmail],
      });

      await fetchConversaciones();
      if (conversacionActiva?.id === conversacionId) {
        await fetchMensajes(conversacionId);
      }
      return true;
    } catch (err) {
      console.error('Error agregando participante:', err);
      return false;
    }
  }, [conversaciones, conversacionActiva, userEmail, userName, fetchConversaciones, fetchMensajes]);

  // ============================================
  // ARCHIVAR CONVERSACIÓN
  // ============================================

  const archivarConversacion = useCallback(async (conversacionId: string) => {
    try {
      const { error: archError } = await supabase
        .from('chat_conversaciones')
        .update({ archivada: true, activa: false })
        .eq('id', conversacionId);

      if (archError) throw archError;

      setConversaciones(prev => prev.filter(c => c.id !== conversacionId));

      if (conversacionActiva?.id === conversacionId) {
        setConversacionActiva(null);
        setMensajes([]);
      }

      return true;
    } catch (err) {
      console.error('Error archivando conversación:', err);
      return false;
    }
  }, [conversacionActiva]);

  // ============================================
  // DESARCHIVAR CONVERSACIÓN
  // ============================================

  const desarchivarConversacion = useCallback(async (conversacionId: string) => {
    try {
      const { error: unarchError } = await supabase
        .from('chat_conversaciones')
        .update({ archivada: false, activa: true })
        .eq('id', conversacionId);

      if (unarchError) throw unarchError;

      await fetchConversaciones();
      await fetchArchivadas();
      return true;
    } catch (err) {
      console.error('Error desarchivando:', err);
      return false;
    }
  }, [fetchConversaciones, fetchArchivadas]);

  // ============================================
  // ELIMINAR CONVERSACIÓN
  // ============================================

  const eliminarConversacion = useCallback(async (conversacionId: string) => {
    try {
      // Delete all messages first (cascade should handle this, but be explicit)
      await supabase
        .from('chat_mensajes')
        .delete()
        .eq('conversacion_id', conversacionId);

      await supabase
        .from('chat_no_leidos')
        .delete()
        .eq('conversacion_id', conversacionId);

      const { error: delError } = await supabase
        .from('chat_conversaciones')
        .delete()
        .eq('id', conversacionId);

      if (delError) throw delError;

      setConversaciones(prev => prev.filter(c => c.id !== conversacionId));
      setConversacionesArchivadas(prev => prev.filter(c => c.id !== conversacionId));

      if (conversacionActiva?.id === conversacionId) {
        setConversacionActiva(null);
        setMensajes([]);
      }

      return true;
    } catch (err) {
      console.error('Error eliminando conversación:', err);
      setError('Error al eliminar la conversación');
      return false;
    }
  }, [conversacionActiva]);

  // ============================================
  // BUSCAR CONVERSACIONES
  // ============================================

  const buscarConversaciones = useCallback(async (query: string) => {
    if (!query.trim()) {
      await fetchConversaciones();
      return;
    }

    try {
      const { data, error: searchError } = await supabase
        .from('chat_conversaciones')
        .select('*')
        .contains('participantes', [userEmail])
        .eq('activa', true)
        .or(`titulo.ilike.%${query}%,referencia_codigo.ilike.%${query}%`)
        .order('ultimo_mensaje_at', { ascending: false });

      if (searchError) throw searchError;

      setConversaciones((data || []).map(c => ({ ...c, no_leidos: 0 })));
    } catch (err) {
      console.error('Error buscando conversaciones:', err);
    }
  }, [userEmail, fetchConversaciones]);

  // ============================================
  // EFECTOS
  // ============================================

  useEffect(() => {
    if (userEmail) {
      fetchConversaciones();
    }
  }, [userEmail, fetchConversaciones]);

  useEffect(() => {
    if (!userEmail) return;

    channelRef.current = supabase
      .channel('chat-global')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_conversaciones',
        },
        () => {
          fetchConversaciones();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_no_leidos',
          filter: `usuario_email=eq.${userEmail}`,
        },
        () => {
          fetchConversaciones();
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (mensajesChannelRef.current) {
        supabase.removeChannel(mensajesChannelRef.current);
      }
    };
  }, [userEmail, fetchConversaciones]);

  // ============================================
  // RETURN
  // ============================================

  return {
    // State
    conversaciones,
    conversacionesArchivadas,
    conversacionActiva,
    mensajes,
    loading,
    loadingMensajes,
    totalNoLeidos,
    error,
    editingMessageId,
    replyingTo,

    // Actions
    fetchConversaciones,
    fetchArchivadas,
    seleccionarConversacion,
    crearConversacion,
    enviarMensaje,
    editarMensaje,
    eliminarMensaje,
    reaccionarMensaje,
    marcarComoLeido,
    agregarParticipante,
    archivarConversacion,
    desarchivarConversacion,
    eliminarConversacion,
    buscarConversaciones,
    setEditingMessageId,
    setReplyingTo,

    // Helpers
    clearError: () => setError(null),
    cerrarConversacion: () => {
      setConversacionActiva(null);
      setMensajes([]);
      setReplyingTo(null);
      setEditingMessageId(null);
      if (mensajesChannelRef.current) {
        supabase.removeChannel(mensajesChannelRef.current);
      }
    },
  };
}

// ============================================
// HOOK: useUsuariosChat
// ============================================

export function useUsuariosChat() {
  const [usuarios, setUsuarios] = useState<Array<{ email: string; nombre: string }>>([]);
  const [loading, setLoading] = useState(false);

  const buscarUsuarios = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setUsuarios([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('email, nombre')
        .or(`email.ilike.%${query}%,nombre.ilike.%${query}%`)
        .limit(10);

      if (error) {
        console.warn('Table usuarios not found, using fallback');
        setUsuarios([]);
        return;
      }

      setUsuarios(data || []);
    } catch (err) {
      console.error('Error buscando usuarios:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { usuarios, loading, buscarUsuarios };
}
