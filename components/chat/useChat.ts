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
  const [conversacionActiva, setConversacionActiva] = useState<ChatConversacion | null>(null);
  const [mensajes, setMensajes] = useState<ChatMensaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMensajes, setLoadingMensajes] = useState(false);
  const [totalNoLeidos, setTotalNoLeidos] = useState(0);
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const mensajesChannelRef = useRef<RealtimeChannel | null>(null);

  // ============================================
  // CARGAR CONVERSACIONES
  // ============================================
  
  const fetchConversaciones = useCallback(async () => {
    if (!userEmail) return;
    
    try {
      // Obtener conversaciones donde el usuario es participante
      const { data: convs, error } = await supabase
        .from('chat_conversaciones')
        .select('*')
        .contains('participantes', [userEmail])
        .eq('activa', true)
        .order('ultimo_mensaje_at', { ascending: false, nullsFirst: false });

      if (error) throw error;

      // Obtener no leídos
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
        creado_at: new Date(c.creado_at),
        actualizado_at: new Date(c.actualizado_at),
        ultimo_mensaje_at: c.ultimo_mensaje_at ? new Date(c.ultimo_mensaje_at) : undefined,
        no_leidos: noLeidosMap.get(c.id) || 0,
      }));

      setConversaciones(convsConNoLeidos);
      setTotalNoLeidos(convsConNoLeidos.reduce((sum, c) => sum + c.no_leidos, 0));
    } catch (error) {
      console.error('Error fetching conversaciones:', error);
    } finally {
      setLoading(false);
    }
  }, [userEmail]);

  // ============================================
  // CARGAR MENSAJES DE UNA CONVERSACIÓN
  // ============================================
  
  const fetchMensajes = useCallback(async (conversacionId: string) => {
    setLoadingMensajes(true);
    
    try {
      const { data, error } = await supabase
        .from('chat_mensajes')
        .select('*')
        .eq('conversacion_id', conversacionId)
        .eq('eliminado', false)
        .order('creado_at', { ascending: true });

      if (error) throw error;

      const mensajesData: ChatMensaje[] = (data || []).map(m => ({
        ...m,
        creado_at: new Date(m.creado_at),
        editado_at: m.editado_at ? new Date(m.editado_at) : undefined,
        eliminado_at: m.eliminado_at ? new Date(m.eliminado_at) : undefined,
        adjuntos: m.adjuntos || [],
        menciones: m.menciones || [],
        leido_por: m.leido_por || [],
      }));

      setMensajes(mensajesData);
      
      // Marcar como leídos
      await marcarComoLeido(conversacionId);
    } catch (error) {
      console.error('Error fetching mensajes:', error);
    } finally {
      setLoadingMensajes(false);
    }
  }, [userEmail]);

  // ============================================
  // SELECCIONAR CONVERSACIÓN
  // ============================================
  
  const seleccionarConversacion = useCallback(async (conv: ChatConversacion) => {
    setConversacionActiva(conv);
    await fetchMensajes(conv.id);
    
    // Suscribirse a mensajes de esta conversación
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
          const nuevoMensaje: ChatMensaje = {
            ...payload.new as any,
            creado_at: new Date(payload.new.creado_at),
            adjuntos: payload.new.adjuntos || [],
            menciones: payload.new.menciones || [],
            leido_por: payload.new.leido_por || [],
          };
          
          setMensajes(prev => {
            // Evitar duplicados
            if (prev.some(m => m.id === nuevoMensaje.id)) return prev;
            return [...prev, nuevoMensaje];
          });
          
          // Marcar como leído si estamos en la conversación
          if (nuevoMensaje.autor_email !== userEmail) {
            marcarComoLeido(conv.id);
          }
        }
      )
      .subscribe();
  }, [fetchMensajes, userEmail]);

  // ============================================
  // CREAR CONVERSACIÓN
  // ============================================
  
  const crearConversacion = useCallback(async (data: NuevaConversacionData): Promise<ChatConversacion | null> => {
    try {
      // Asegurar que el creador está en participantes
      const participantes = Array.from(new Set([...data.participantes, userEmail]));
      
      const { data: conv, error } = await supabase
        .from('chat_conversaciones')
        .insert({
          titulo: data.titulo,
          tipo: data.tipo,
          referencia_id: data.referencia_id,
          referencia_codigo: data.referencia_codigo,
          participantes,
          creado_por: userEmail,
        })
        .select()
        .single();

      if (error) throw error;

      // Si hay mensaje inicial, enviarlo
      if (data.mensaje_inicial && conv) {
        await enviarMensaje({
          conversacion_id: conv.id,
          contenido: data.mensaje_inicial,
        });
      }

      // Refrescar lista
      await fetchConversaciones();
      
      return conv ? {
        ...conv,
        creado_at: new Date(conv.creado_at),
        actualizado_at: new Date(conv.actualizado_at),
      } : null;
    } catch (error) {
      console.error('Error creando conversación:', error);
      return null;
    }
  }, [userEmail, fetchConversaciones]);

  // ============================================
  // ENVIAR MENSAJE
  // ============================================
  
  const enviarMensaje = useCallback(async (data: NuevoMensajeData): Promise<ChatMensaje | null> => {
    try {
      // Extraer menciones del contenido (@usuario)
      const mencionesRegex = /@([\w.-]+@[\w.-]+\.\w+)/g;
      const menciones = data.menciones || [];
      let match;
      while ((match = mencionesRegex.exec(data.contenido)) !== null) {
        if (!menciones.includes(match[1])) {
          menciones.push(match[1]);
        }
      }

      const { data: mensaje, error } = await supabase
        .from('chat_mensajes')
        .insert({
          conversacion_id: data.conversacion_id,
          autor_email: userEmail,
          autor_nombre: userName,
          contenido: data.contenido,
          menciones,
          respuesta_a_id: data.respuesta_a_id,
          leido_por: [userEmail], // El autor ya lo "leyó"
        })
        .select()
        .single();

      if (error) throw error;

      return mensaje ? {
        ...mensaje,
        creado_at: new Date(mensaje.creado_at),
        adjuntos: mensaje.adjuntos || [],
        menciones: mensaje.menciones || [],
        leido_por: mensaje.leido_por || [],
      } : null;
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      return null;
    }
  }, [userEmail, userName]);

  // ============================================
  // MARCAR COMO LEÍDO
  // ============================================
  
  const marcarComoLeido = useCallback(async (conversacionId: string) => {
    try {
      // Llamar función de Supabase
      await supabase.rpc('marcar_mensajes_leidos', {
        p_conversacion_id: conversacionId,
        p_usuario_email: userEmail,
      });

      // Actualizar estado local
      setConversaciones(prev => prev.map(c => 
        c.id === conversacionId ? { ...c, no_leidos: 0 } : c
      ));
      
      setTotalNoLeidos(prev => {
        const conv = conversaciones.find(c => c.id === conversacionId);
        return Math.max(0, prev - (conv?.no_leidos || 0));
      });
    } catch (error) {
      console.error('Error marcando como leído:', error);
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
      
      const { error } = await supabase
        .from('chat_conversaciones')
        .update({ participantes: nuevosParticipantes })
        .eq('id', conversacionId);

      if (error) throw error;

      // Mensaje de sistema
      await supabase.from('chat_mensajes').insert({
        conversacion_id: conversacionId,
        autor_email: userEmail,
        autor_nombre: userName,
        contenido: `${email} se unió a la conversación`,
        tipo: 'sistema',
        leido_por: [userEmail],
      });

      await fetchConversaciones();
      return true;
    } catch (error) {
      console.error('Error agregando participante:', error);
      return false;
    }
  }, [conversaciones, userEmail, userName, fetchConversaciones]);

  // ============================================
  // ARCHIVAR CONVERSACIÓN
  // ============================================
  
  const archivarConversacion = useCallback(async (conversacionId: string) => {
    try {
      const { error } = await supabase
        .from('chat_conversaciones')
        .update({ archivada: true, activa: false })
        .eq('id', conversacionId);

      if (error) throw error;

      setConversaciones(prev => prev.filter(c => c.id !== conversacionId));
      
      if (conversacionActiva?.id === conversacionId) {
        setConversacionActiva(null);
        setMensajes([]);
      }
      
      return true;
    } catch (error) {
      console.error('Error archivando conversación:', error);
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
      const { data, error } = await supabase
        .from('chat_conversaciones')
        .select('*')
        .contains('participantes', [userEmail])
        .or(`titulo.ilike.%${query}%,referencia_codigo.ilike.%${query}%`)
        .order('ultimo_mensaje_at', { ascending: false });

      if (error) throw error;

      const convsConNoLeidos: ConversacionConNoLeidos[] = (data || []).map(c => ({
        ...c,
        creado_at: new Date(c.creado_at),
        actualizado_at: new Date(c.actualizado_at),
        ultimo_mensaje_at: c.ultimo_mensaje_at ? new Date(c.ultimo_mensaje_at) : undefined,
        no_leidos: 0,
      }));

      setConversaciones(convsConNoLeidos);
    } catch (error) {
      console.error('Error buscando conversaciones:', error);
    }
  }, [userEmail, fetchConversaciones]);

  // ============================================
  // EFECTOS
  // ============================================
  
  // Cargar conversaciones al montar
  useEffect(() => {
    if (userEmail) {
      fetchConversaciones();
    }
  }, [userEmail, fetchConversaciones]);

  // Suscribirse a cambios en conversaciones y no_leidos
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
    // Estado
    conversaciones,
    conversacionActiva,
    mensajes,
    loading,
    loadingMensajes,
    totalNoLeidos,
    
    // Acciones
    fetchConversaciones,
    seleccionarConversacion,
    crearConversacion,
    enviarMensaje,
    marcarComoLeido,
    agregarParticipante,
    archivarConversacion,
    buscarConversaciones,
    
    // Helpers
    cerrarConversacion: () => {
      setConversacionActiva(null);
      setMensajes([]);
      if (mensajesChannelRef.current) {
        supabase.removeChannel(mensajesChannelRef.current);
      }
    },
  };
}

// ============================================
// HOOK: useUsuariosChat (para menciones y participantes)
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
      // Buscar en auth.users o en tu tabla de usuarios
      const { data, error } = await supabase
        .from('usuarios')
        .select('email, nombre')
        .or(`email.ilike.%${query}%,nombre.ilike.%${query}%`)
        .limit(10);

      if (error) {
        // Si no existe tabla usuarios, intentar con otra estrategia
        console.warn('Tabla usuarios no encontrada, usando fallback');
        setUsuarios([]);
        return;
      }

      setUsuarios(data || []);
    } catch (error) {
      console.error('Error buscando usuarios:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  return { usuarios, loading, buscarUsuarios };
}