'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

// =====================================================
// ApprovalsBadge — contador de aprobaciones pendientes
// =====================================================
// Muestra cuántas aprobaciones tiene el usuario actual
// esperando su firma. Se actualiza en tiempo real vía
// Supabase Realtime.
//
// Se rendea como badge inline en el sidebar/navegación.
// Si count = 0, no rendea nada (null).
// =====================================================

interface ApprovalsBadgeProps {
  className?: string;
}

export function ApprovalsBadge({ className }: ApprovalsBadgeProps) {
  const { user, rol } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user?.email) return;

    const fetchCount = async () => {
      try {
        // Aprobaciones pendientes:
        //   - estado='pendiente'
        //   - asignado_a = email actual O sin asignar (admin ve todas)
        let q = supabase
          .from('aprobaciones')
          .select('id', { count: 'exact', head: true })
          .eq('estado', 'pendiente');

        if (rol !== 'admin') {
          q = q.or(`asignado_a.is.null,asignado_a.eq.${user.email}`);
        }

        const { count: total, error } = await q;
        if (!error) setCount(total ?? 0);
      } catch (err) {
        // silencioso — el badge no es crítico
      }
    };

    fetchCount();

    // Suscripción a cambios en aprobaciones
    const channel = supabase
      .channel('approvals-badge')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'aprobaciones' },
        () => fetchCount()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.email, rol]);

  if (count === 0) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full',
        'text-[10px] font-semibold bg-amber-500/90 text-slate-900',
        className,
      )}
      title={`${count} aprobación${count === 1 ? '' : 'es'} pendiente${count === 1 ? '' : 's'}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
