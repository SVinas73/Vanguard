'use client';

import React from 'react';
import { Building2, Check, Star, Loader2, Info } from 'lucide-react';
import { useOrganizacion } from '@/hooks/useOrganizacion';

export default function MisEmpresasModule() {
  const { orgs, orgActivaId, cambiarOrg, loading } = useOrganizacion();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Mis empresas</h2>
        <p className="text-sm text-slate-400 mt-0.5 max-w-xl">
          Empresas a las que pertenecés. La empresa activa es la que se usa en todos los módulos.
        </p>
      </div>

      <div className="flex items-start gap-3 p-3 bg-slate-900/50 border border-slate-800 rounded-md text-sm text-slate-400">
        <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <p>
          La creación de empresas se hace por fuera del sistema (panel de administración).
          Si necesitás una empresa nueva, contactá al administrador.
        </p>
      </div>

      {loading && (
        <div className="text-center py-12 text-slate-500">
          <Loader2 className="w-6 h-6 mx-auto animate-spin mb-2" />
          Cargando empresas...
        </div>
      )}

      {!loading && orgs.length === 0 && (
        <div className="text-center py-16 px-6 bg-slate-900/50 border border-slate-800 rounded-lg">
          <Building2 className="w-12 h-12 mx-auto text-slate-600 mb-3" />
          <h4 className="text-slate-200 font-medium mb-1">No tenés empresas asignadas</h4>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Tu usuario no fue invitado a ninguna empresa todavía. Pedile al administrador que
            te incluya en la empresa que corresponda.
          </p>
        </div>
      )}

      {!loading && orgs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {orgs.map(o => {
            const isActive = o.organizacion_id === orgActivaId;
            return (
              <div
                key={o.organizacion_id}
                className={`p-4 rounded-lg border transition ${
                  isActive
                    ? 'bg-blue-500/10 border-blue-500/40'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className={`p-2 rounded-md ${isActive ? 'bg-blue-500/20' : 'bg-slate-800'}`}>
                    <Building2 className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-medium text-slate-100 truncate">{o.organizacion.nombre}</h4>
                      {o.es_default && <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 capitalize">
                      {o.rol} · {o.organizacion.plan} · {o.organizacion.pais}
                    </div>
                  </div>
                </div>

                {o.organizacion.rut && (
                  <div className="text-xs text-slate-500 mb-3">
                    RUT: <span className="text-slate-400 font-mono">{o.organizacion.rut}</span>
                  </div>
                )}

                {isActive ? (
                  <div className="flex items-center gap-1.5 text-xs text-blue-400 font-medium">
                    <Check className="w-3.5 h-3.5" />
                    Empresa activa
                  </div>
                ) : (
                  <button
                    onClick={() => cambiarOrg(o.organizacion_id)}
                    className="w-full px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-sm text-slate-200 transition"
                  >
                    Activar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
