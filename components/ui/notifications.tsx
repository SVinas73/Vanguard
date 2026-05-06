'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import {
  Bell, AlertTriangle, X, Check, CheckCheck, Package,
  FileText, FileWarning, CreditCard, Truck, Info, RefreshCw,
  Archive, Target
} from 'lucide-react';
import { useInventoryStore } from '@/store';
import { useAuth } from '@/hooks/useAuth';
import {
  cargarNotificaciones,
  marcarLeida,
  marcarTodasLeidas,
  descartarNotificacion,
  escanearAlertasComerciales,
  escanearStock,
  type Notificacion,
  type TipoNotificacion,
  type SeveridadNotificacion,
} from '@/lib/notifications';

const TIPO_ICON: Record<TipoNotificacion, React.ElementType> = {
  stock_bajo: AlertTriangle,
  sin_stock: Package,
  cotizacion_por_vencer: FileText,
  cotizacion_vencida: FileWarning,
  cxc_vencida: CreditCard,
  cxp_vencida: CreditCard,
  orden_sin_entregar: Truck,
  putaway_pendiente: Archive,
  picking_sin_asignar: Target,
  ticket_sla_breached: AlertTriangle,
  ticket_critico: AlertTriangle,
  garantia_por_vencer: FileWarning,
  sistema: Info,
};

const SEVERIDAD_COLOR: Record<SeveridadNotificacion, string> = {
  info: 'text-blue-400',
  warning: 'text-amber-400',
  error: 'text-red-400',
};

function formatRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const dias = Math.floor(hrs / 24);
  if (dias < 7) return `hace ${dias}d`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationBell() {
  const { t } = useTranslation();
  const { user } = useAuth(false);
  const [notifications, setNotifications] = useState<Notificacion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [escaneando, setEscaneando] = useState(false);
  const { products } = useInventoryStore();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const lastScanRef = useRef<number>(0);

  const userEmail = user?.email || '';

  const recargar = useCallback(async () => {
    if (!userEmail) return;
    const data = await cargarNotificaciones(userEmail, 7);
    setNotifications(data);
  }, [userEmail]);

  // Escanear y recargar al abrir el bell, con cooldown de 60s
  // para no martillar la DB si el usuario abre/cierra rápido.
  const scanYRecargar = useCallback(async () => {
    if (!userEmail) return;
    const now = Date.now();
    if (now - lastScanRef.current < 60_000) {
      await recargar();
      return;
    }
    lastScanRef.current = now;
    setEscaneando(true);
    try {
      await Promise.all([
        escanearAlertasComerciales(),
        escanearStock(products.map(p => ({
          codigo: p.codigo,
          descripcion: p.descripcion,
          stock: p.stock,
          stockMinimo: p.stockMinimo,
        }))),
      ]);
      await recargar();
    } finally {
      setEscaneando(false);
    }
  }, [userEmail, products, recargar]);

  // Carga inicial silenciosa (sin escaneo) para mostrar el badge rápido
  useEffect(() => {
    recargar();
  }, [recargar]);

  // Al abrir el dropdown, dispara escaneo
  useEffect(() => {
    if (isOpen) scanYRecargar();
  }, [isOpen, scanYRecargar]);

  // Posicionado del dropdown
  const updatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = 360;
      const dropdownMaxHeight = 460;
      let top = rect.bottom + 8;
      let left = rect.left;
      if (left + dropdownWidth > window.innerWidth - 16) left = rect.right - dropdownWidth;
      if (top + dropdownMaxHeight > window.innerHeight - 16) top = rect.top - dropdownMaxHeight - 8;
      setDropdownPos({ top: Math.max(8, top), left: Math.max(8, left) });
    }
  }, []);

  useEffect(() => {
    if (isOpen) updatePosition();
  }, [isOpen, updatePosition]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const unreadCount = notifications.filter(n => !n.leida).length;

  const handleMarcarLeida = async (id: string) => {
    await marcarLeida(id, userEmail);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
  };

  const handleMarcarTodas = async () => {
    // UI optimista: marcamos como leídas en local antes de
    // persistir, así el badge desaparece inmediatamente. Si
    // alguna actualización falla, queda logueada en consola.
    const noLeidas = notifications.filter(n => !n.leida);
    setNotifications(prev => prev.map(n => ({ ...n, leida: true })));
    await marcarTodasLeidas(userEmail, noLeidas);
  };

  const handleDescartar = async (id: string) => {
    await descartarNotificacion(id, userEmail);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-100"
        title={t('notifications.title', 'Notificaciones')}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999 }}
          className="w-[360px] max-h-[460px] overflow-hidden bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col"
        >
          <div className="flex items-center justify-between p-3 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-200">
                {t('notifications.title', 'Notificaciones')}
              </span>
              {escaneando && <RefreshCw size={12} className="text-slate-500 animate-spin" />}
            </div>
            {unreadCount > 0 && (
              <button onClick={handleMarcarTodas} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                <CheckCheck size={14} /> {t('notifications.markAllRead', 'Marcar todas como leídas')}
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                {escaneando ? 'Buscando alertas...' : (t('notifications.noNotifications', 'Sin notificaciones'))}
              </div>
            ) : (
              notifications.map(n => {
                const Icon = TIPO_ICON[n.tipo] || Info;
                const colorClass = SEVERIDAD_COLOR[n.severidad];
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 p-3 border-b border-slate-800 hover:bg-slate-800 transition-colors ${!n.leida ? 'bg-slate-800/40' : ''}`}
                  >
                    <div className="mt-0.5">
                      <Icon size={16} className={colorClass} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${!n.leida ? 'text-slate-200' : 'text-slate-400'}`}>
                          {n.titulo}
                        </span>
                        {!n.leida && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.mensaje}</p>
                      <p className="text-[10px] text-slate-600 mt-1">{formatRelativo(n.createdAt)}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {!n.leida && (
                        <button
                          onClick={() => handleMarcarLeida(n.id)}
                          className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-slate-300"
                          title="Marcar como leída"
                        >
                          <Check size={12} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDescartar(n.id)}
                        className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-slate-300"
                        title="Descartar"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-2 border-t border-slate-800 text-[10px] text-slate-600 text-center">
            Solo eventos recientes · últimos 7 días
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
