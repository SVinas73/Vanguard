'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Bell, AlertTriangle, X, Check, CheckCheck, Package } from 'lucide-react';
import { useInventoryStore } from '@/store';

interface Notification {
  id: string;
  type: 'stock_bajo' | 'sin_stock' | 'sistema';
  title: string;
  message: string;
  read: boolean;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { products } = useInventoryStore();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const newNotifs: Notification[] = [];
    const dismissed = JSON.parse(localStorage.getItem('vanguard-dismissed-notifs') || '[]');
    const readIds = JSON.parse(localStorage.getItem('vanguard-read-notifs') || '[]');

    products.filter(p => p.stock === 0).forEach(p => {
      const id = `stock-out-${p.codigo}`;
      if (!dismissed.includes(id)) {
        newNotifs.push({ id, type: 'sin_stock', title: 'Sin stock', message: `${p.descripcion} (${p.codigo}): Agotado`, read: readIds.includes(id) });
      }
    });

    products.filter(p => p.stock > 0 && p.stock <= p.stockMinimo).forEach(p => {
      const id = `stock-low-${p.codigo}`;
      if (!dismissed.includes(id)) {
        newNotifs.push({ id, type: 'stock_bajo', title: 'Stock bajo', message: `${p.descripcion} (${p.codigo}): ${p.stock} uds (mín: ${p.stockMinimo})`, read: readIds.includes(id) });
      }
    });

    setNotifications(newNotifs);
  }, [products]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markRead = (id: string) => {
    const readIds = JSON.parse(localStorage.getItem('vanguard-read-notifs') || '[]');
    if (!readIds.includes(id)) { readIds.push(id); localStorage.setItem('vanguard-read-notifs', JSON.stringify(readIds)); }
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = () => {
    localStorage.setItem('vanguard-read-notifs', JSON.stringify(notifications.map(n => n.id)));
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const dismiss = (id: string) => {
    const dismissed = JSON.parse(localStorage.getItem('vanguard-dismissed-notifs') || '[]');
    dismissed.push(id);
    localStorage.setItem('vanguard-dismissed-notifs', JSON.stringify(dismissed));
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className="relative p-2 rounded-lg hover:bg-[#242830] transition-colors text-[#94a3b8] hover:text-white">
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-80 max-h-96 overflow-y-auto bg-[#1c1f26] border border-[#2e323d] rounded-xl shadow-2xl z-50">
          <div className="flex items-center justify-between p-3 border-b border-[#2e323d]">
            <span className="text-sm font-semibold text-slate-200">Notificaciones</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                <CheckCheck size={14} /> Marcar todo leído
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">Sin notificaciones</div>
          ) : (
            notifications.slice(0, 20).map(n => (
              <div key={n.id} className={`flex items-start gap-3 p-3 border-b border-[#2e323d]/50 hover:bg-[#242830] transition-colors ${!n.read ? 'bg-[#242830]/50' : ''}`}>
                <div className="mt-0.5">
                  {n.type === 'sin_stock' ? <Package size={16} className="text-red-400" /> : <AlertTriangle size={16} className="text-amber-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${!n.read ? 'text-slate-200' : 'text-slate-400'}`}>{n.title}</span>
                    {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {!n.read && <button onClick={() => markRead(n.id)} className="p-1 hover:bg-[#2e323d] rounded text-slate-500 hover:text-slate-300"><Check size={12} /></button>}
                  <button onClick={() => dismiss(n.id)} className="p-1 hover:bg-[#2e323d] rounded text-slate-500 hover:text-slate-300"><X size={12} /></button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
