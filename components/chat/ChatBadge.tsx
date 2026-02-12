'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

// ============================================
// CHAT BADGE - Contador de no leídos para el sidebar
// ============================================

interface ChatBadgeProps {
  className?: string;
}

export function ChatBadge({ className }: ChatBadgeProps) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user?.email) return;

    // Cargar inicial
    const fetchCount = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_no_leidos')
          .select('cantidad')
          .eq('usuario_email', user.email)
          .gt('cantidad', 0);

        if (!error && data) {
          const total = data.reduce((sum, item) => sum + item.cantidad, 0);
          setCount(total);
        }
      } catch (error) {
        console.error('Error fetching chat count:', error);
      }
    };

    fetchCount();

    // Suscribirse a cambios
    const channel = supabase
      .channel('chat-badge')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_no_leidos',
          filter: `usuario_email=eq.${user.email}`,
        },
        () => {
          fetchCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.email]);

  if (count === 0) return null;

  return (
    <span
      className={cn(
        'px-1.5 py-0.5 text-xs font-medium bg-blue-500 text-white rounded-full',
        className
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

// ============================================
// HOOK: useChatNotifications - Para notificaciones toast
// ============================================

export function useChatNotifications() {
  const { user } = useAuth();
  const [lastNotification, setLastNotification] = useState<{
    conversacion_id: string;
    autor: string;
    contenido: string;
  } | null>(null);

  useEffect(() => {
    if (!user?.email) return;

    const channel = supabase
      .channel('chat-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_mensajes',
        },
        (payload) => {
          const mensaje = payload.new as any;
          
          // No notificar si es mensaje propio
          if (mensaje.autor_email === user.email) return;
          
          // Verificar si el usuario es participante
          // (esto debería validarse mejor con una subconsulta)
          setLastNotification({
            conversacion_id: mensaje.conversacion_id,
            autor: mensaje.autor_nombre || mensaje.autor_email.split('@')[0],
            contenido: mensaje.contenido.substring(0, 100),
          });

          // Limpiar después de 5 segundos
          setTimeout(() => setLastNotification(null), 5000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.email]);

  return { lastNotification, clearNotification: () => setLastNotification(null) };
}