'use client';

import React, { useState } from 'react';
import { Building2, Plus, Check, Star, Loader2 } from 'lucide-react';
import { useOrganizacion } from '@/hooks/useOrganizacion';
import { CrearOrgModal } from './CrearOrgModal';

export default function MisEmpresasModule() {
  const { orgs, orgActivaId, cambiarOrg, recargar, loading } = useOrganizacion();
  const [showCrear, setShowCrear] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Mis empresas</h2>
          <p className="text-sm text-slate-400 mt-0.5 max-w-xl">
            Acá gestionás las empresas a las que pertenecés. Podés crear nuevas o cambiar entre las
            existentes. La empresa activa es la que se usa en todos los módulos.
          </p>
        </div>
        <button
          onClick={() => setShowCrear(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm transition"
        >
          <Plus className="w-4 h-4" />
          Nueva empresa
        </button>
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
          <h4 className="text-slate-200 font-medium mb-1">Todavía no tenés empresas</h4>
          <p className="text-sm text-slate-500 mb-4 max-w-md mx-auto">
            Para empezar a usar Vanguard creá tu primera empresa. Esto separa tus datos de los de
            otros usuarios y te deja invitar a tu equipo.
          </p>
          <button
            onClick={() => setShowCrear(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm font-medium transition"
          >
            <Plus className="w-4 h-4" />
            Crear primera empresa
          </button>
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

      {showCrear && (
        <CrearOrgModal
          onClose={() => setShowCrear(false)}
          onCreado={() => { setShowCrear(false); recargar(); }}
        />
      )}
    </div>
  );
}
