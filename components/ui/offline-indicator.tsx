'use client';

import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, Check } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getPendingActions } from '@/lib/offline-storage';
import { cn } from '@/lib/utils';

export function OfflineIndicator() {
  const { isOnline } = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [showBanner, setShowBanner] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    const updatePendingCount = () => {
      const pending = getPendingActions();
      setPendingCount(pending.length);
    };

    updatePendingCount();
    
    // Actualizar cuando cambie el storage
    window.addEventListener('storage', updatePendingCount);
    
    return () => {
      window.removeEventListener('storage', updatePendingCount);
    };
  }, []);

  useEffect(() => {
    if (!isOnline) {
      setShowBanner(true);
    } else if (pendingCount > 0) {
      setShowBanner(true);
      // Simular sincronización
      setSyncing(true);
      setTimeout(() => {
        setSyncing(false);
        setJustSynced(true);
        setTimeout(() => {
          setJustSynced(false);
          setShowBanner(false);
        }, 2000);
      }, 1500);
    } else {
      setShowBanner(false);
    }
  }, [isOnline, pendingCount]);

  if (!showBanner && isOnline) return null;

  return (
    <div className={cn(
      'fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full shadow-lg z-50 flex items-center gap-2 transition-all',
      !isOnline 
        ? 'bg-amber-500/90 text-amber-950' 
        : syncing
          ? 'bg-cyan-500/90 text-cyan-950'
          : justSynced
            ? 'bg-emerald-500/90 text-emerald-950'
            : 'bg-slate-800 text-slate-200'
    )}>
      {!isOnline ? (
        <>
          <WifiOff size={16} />
          <span className="text-sm font-medium">Sin conexión - Modo offline activo</span>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-600 text-xs">
              {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
            </span>
          )}
        </>
      ) : syncing ? (
        <>
          <RefreshCw size={16} className="animate-spin" />
          <span className="text-sm font-medium">Sincronizando cambios...</span>
        </>
      ) : justSynced ? (
        <>
          <Check size={16} />
          <span className="text-sm font-medium">¡Sincronizado!</span>
        </>
      ) : (
        <>
          <Wifi size={16} />
          <span className="text-sm font-medium">Conectado</span>
        </>
      )}
    </div>
  );
}