'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { cn, formatDate } from '@/lib/utils';
import {
  Bell,
  Check,
  CheckCheck,
  X,
  AtSign,
  UserPlus,
  MessageSquare,
  Clock,
  CheckCircle,
  Trash2,
} from 'lucide-react';

interface Notificacion {
  id: string;
  usuarioEmail: string;
  tipo: 'mencion' | 'asignacion' | 'comentario' | 'vencimiento' | 'invitacion' | 'tarea_completada';
  titulo: string;
  mensaje: string | null;
  proyectoId: string | null;
  tareaId: string | null;
  leido: boolean;
  leidoAt: Date | null;
  creadoAt: Date;
}

interface NotificacionesBellProps {
  collapsed?: boolean;
  onNotificacionClick?: (notificacion: Notificacion) => void;
}

const TIPO_CONFIG = {
  mencion: { icon: AtSign, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  asignacion: { icon: UserPlus, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  comentario: { icon: MessageSquare, color: 'text-purple-400', bg: 'bg-purple-500/20' },
  vencimiento: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/20' },
  invitacion: { icon: UserPlus, color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
  tarea_completada: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/20' },
};

export function NotificacionesBell({ collapsed = false, onNotificacionClick }: NotificacionesBellProps) {
  const { user } = useAuth();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const noLeidas = notificaciones.filter(n => !n.leido).length;

  // Cargar notificaciones
  useEffect(() => {
    if (user?.email) {
      fetchNotificaciones();
      
      // Suscribirse a nuevas notificaciones en tiempo real
      const channel = supabase
        .channel('notificaciones')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'proyecto_notificaciones',
            filter: `usuario_email=eq.${user.email}`,
          },
          (payload) => {
            const nueva = mapNotificacion(payload.new);
            setNotificaciones(prev => [nueva, ...prev]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user?.email]);

  // Cerrar dropdown al hacer clic afuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotificaciones = async () => {
    if (!user?.email) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('proyecto_notificaciones')
      .select('*')
      .eq('usuario_email', user.email)
      .order('creado_at', { ascending: false })
      .limit(20);

    if (data) {
      setNotificaciones(data.map(mapNotificacion));
    }
    setLoading(false);
  };

  const mapNotificacion = (n: any): Notificacion => ({
    id: n.id,
    usuarioEmail: n.usuario_email,
    tipo: n.tipo,
    titulo: n.titulo,
    mensaje: n.mensaje,
    proyectoId: n.proyecto_id,
    tareaId: n.tarea_id,
    leido: n.leido,
    leidoAt: n.leido_at ? new Date(n.leido_at) : null,
    creadoAt: new Date(n.creado_at),
  });

  const marcarComoLeida = async (id: string) => {
    await supabase
      .from('proyecto_notificaciones')
      .update({ leido: true, leido_at: new Date().toISOString() })
      .eq('id', id);

    setNotificaciones(prev =>
      prev.map(n => n.id === id ? { ...n, leido: true, leidoAt: new Date() } : n)
    );
  };

  const marcarTodasComoLeidas = async () => {
    if (!user?.email) return;

    await supabase
      .from('proyecto_notificaciones')
      .update({ leido: true, leido_at: new Date().toISOString() })
      .eq('usuario_email', user.email)
      .eq('leido', false);

    setNotificaciones(prev =>
      prev.map(n => ({ ...n, leido: true, leidoAt: new Date() }))
    );
  };

  const eliminarNotificacion = async (id: string) => {
    await supabase
      .from('proyecto_notificaciones')
      .delete()
      .eq('id', id);

    setNotificaciones(prev => prev.filter(n => n.id !== id));
  };

  const handleNotificacionClick = (notificacion: Notificacion) => {
    if (!notificacion.leido) {
      marcarComoLeida(notificacion.id);
    }
    if (onNotificacionClick) {
      onNotificacionClick(notificacion);
    }
    setShowDropdown(false);
  };

  const formatTiempoRelativo = (fecha: Date) => {
    const ahora = new Date();
    const diff = ahora.getTime() - fecha.getTime();
    const minutos = Math.floor(diff / 60000);
    const horas = Math.floor(diff / 3600000);
    const dias = Math.floor(diff / 86400000);

    if (minutos < 1) return 'Ahora';
    if (minutos < 60) return `${minutos}m`;
    if (horas < 24) return `${horas}h`;
    if (dias < 7) return `${dias}d`;
    return formatDate(fecha);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón de campanita */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={cn(
          'relative p-2 rounded-xl transition-colors',
          showDropdown
            ? 'bg-emerald-500/20 text-emerald-400'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
        )}
        title="Notificaciones"
      >
        <Bell size={20} />
        
        {/* Badge de no leídas */}
        {noLeidas > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full px-1">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {/* Tooltip cuando está colapsado */}
      {collapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
          Notificaciones
          {noLeidas > 0 && (
            <span className="ml-2 text-red-400 text-xs">({noLeidas})</span>
          )}
        </div>
      )}

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute bottom-full left-0 mb-2 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
            <h3 className="font-semibold text-sm">Notificaciones</h3>
            {noLeidas > 0 && (
              <button
                onClick={marcarTodasComoLeidas}
                className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                <CheckCheck size={14} />
                Marcar todas
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                Cargando...
              </div>
            ) : notificaciones.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Bell size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No hay notificaciones</p>
              </div>
            ) : (
              notificaciones.map(notificacion => {
                const config = TIPO_CONFIG[notificacion.tipo] || TIPO_CONFIG.comentario;
                const Icon = config.icon;

                return (
                  <div
                    key={notificacion.id}
                    onClick={() => handleNotificacionClick(notificacion)}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-slate-800/50 last:border-0',
                      notificacion.leido
                        ? 'bg-transparent hover:bg-slate-800/30'
                        : 'bg-slate-800/50 hover:bg-slate-800/70'
                    )}
                  >
                    {/* Icono */}
                    <div className={cn('p-2 rounded-lg flex-shrink-0', config.bg)}>
                      <Icon size={16} className={config.color} />
                    </div>

                    {/* Contenido */}
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm',
                        notificacion.leido ? 'text-slate-400' : 'text-slate-200 font-medium'
                      )}>
                        {notificacion.titulo}
                      </p>
                      {notificacion.mensaje && (
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {notificacion.mensaje}
                        </p>
                      )}
                      <p className="text-xs text-slate-600 mt-1">
                        {formatTiempoRelativo(notificacion.creadoAt)}
                      </p>
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!notificacion.leido && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            marcarComoLeida(notificacion.id);
                          }}
                          className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-emerald-400"
                          title="Marcar como leída"
                        >
                          <Check size={14} />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          eliminarNotificacion(notificacion.id);
                        }}
                        className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-red-400"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notificaciones.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-700/50 text-center">
              <button className="text-xs text-slate-400 hover:text-slate-300">
                Ver todas las notificaciones
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}