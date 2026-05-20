'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { useOrganizacion } from '@/hooks/useOrganizacion';
import { cn } from '@/lib/utils';

export function OrgSwitcher() {
  const { orgs, orgActiva, orgActivaId, cambiarOrg, loading } = useOrganizacion();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Sin orgs todavía → no muestra nada. Las empresas se aprovisionan
  // por fuera del sistema (script admin / CLI / panel super-admin).
  if (!loading && orgs.length === 0) return null;

  // Hay orgs pero ninguna activa → mostrar selector pidiendo elegir
  if (!orgActiva && orgs.length > 0) {
    return (
      <>
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen(v => !v)}
            className="flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-amber-300 hover:text-amber-200 border border-amber-500/40 bg-amber-500/10 rounded-md hover:bg-amber-500/20 transition-colors"
          >
            <Building2 size={13} />
            <span className="font-medium">Elegir empresa</span>
            <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-1.5 w-64 bg-slate-950 border border-slate-800 rounded-md shadow-xl z-50">
              <div className="px-3 py-2 border-b border-slate-800">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Seleccioná una empresa</p>
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                {orgs.map(o => (
                  <button
                    key={o.organizacion_id}
                    onClick={() => {
                      cambiarOrg(o.organizacion_id);
                      setOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-900 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-slate-100 truncate">{o.organizacion.nombre}</p>
                      <p className="text-[10px] text-slate-500 capitalize">{o.rol} · {o.organizacion.plan}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  if (!orgActiva) return null;

  return (
    <>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-slate-300 hover:text-slate-100 border border-slate-800 rounded-md hover:bg-slate-900 transition-colors"
        >
          <Building2 size={13} className="text-slate-500" />
          <span className="font-medium truncate max-w-[140px]">{orgActiva.nombre}</span>
          <ChevronDown size={12} className={cn('text-slate-500 transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1.5 w-64 bg-slate-950 border border-slate-800 rounded-md shadow-xl z-50">
            <div className="px-3 py-2 border-b border-slate-800">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Empresas</p>
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {orgs.map(o => (
                <button
                  key={o.organizacion_id}
                  onClick={() => {
                    cambiarOrg(o.organizacion_id);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-900 transition-colors',
                    o.organizacion_id === orgActivaId && 'bg-slate-900/50'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-slate-100 truncate">{o.organizacion.nombre}</p>
                    <p className="text-[10px] text-slate-500 capitalize">{o.rol} · {o.organizacion.plan}</p>
                  </div>
                  {o.organizacion_id === orgActivaId && <Check size={13} className="text-emerald-400 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
