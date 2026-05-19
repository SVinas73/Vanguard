'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Save, Loader2, AlertCircle, Check, Pencil, Tag } from 'lucide-react';
import { useOrganizacion } from '@/hooks/useOrganizacion';

interface Routing {
  id?: number;
  categoria: string;
  categoria_label: string;
  gestor_emails: string[];
  referente_emails: string[];
  activa: boolean;
}

const TEMPLATES_SUGERIDOS: Array<{ categoria: string; label: string }> = [
  { categoria: 'papeleria', label: 'Papelería' },
  { categoria: 'ferreteria', label: 'Ferretería' },
  { categoria: 'edintor', label: 'Edintor' },
  { categoria: 'estacion_servicio', label: 'Estación de servicio' },
  { categoria: 'limpieza', label: 'Limpieza' },
  { categoria: 'otros', label: 'Otros' },
];

export default function RoutingInsumos() {
  const { orgActivaId, orgActiva } = useOrganizacion();
  const [routings, setRoutings] = useState<Routing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Routing | null>(null);

  const fetchRouting = async () => {
    if (!orgActivaId) return;
    setLoading(true);
    try {
      const resp = await fetch(`/api/insumos/routing?organizacion_id=${orgActivaId}`);
      const data = await resp.json();
      setRoutings(data.routing || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRouting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgActivaId]);

  if (!orgActivaId) {
    return (
      <div className="text-center py-12 px-6 bg-slate-900/50 border border-amber-500/30 rounded-lg">
        <Tag className="w-12 h-12 mx-auto text-amber-400 mb-3" />
        <h4 className="text-slate-100 font-medium mb-1">Falta seleccionar una empresa</h4>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Para configurar destinatarios necesitás tener una empresa activa.
          Mirá <strong>arriba a la derecha del header</strong> el botón <strong>"Elegir empresa"</strong> o <strong>"Crear empresa"</strong> (color ámbar).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Tag className="w-5 h-5 text-purple-400 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-slate-100">Destinatarios por categoría</h3>
            <p className="text-sm text-slate-400 mt-1">
              Por cada categoría definí quiénes gestionan la compra (TO en el mail) y quiénes son referentes (CC).
              Cuando alguien crea una solicitud de esa categoría, esos emails reciben la notificación.
              {orgActiva && <> Configuración para <strong className="text-slate-200">{orgActiva.nombre}</strong>.</>}
            </p>
          </div>
        </div>
      </div>

      {/* Templates sugeridos */}
      {routings.filter(r => r.activa).length === 0 && (
        <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
          <div className="text-sm text-slate-200 mb-2 font-medium">Categorías sugeridas para empezar</div>
          <p className="text-xs text-slate-400 mb-3">
            Cliqueá para crear cualquiera de estas categorías y configurar los emails.
          </p>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES_SUGERIDOS.map(t => (
              <button
                key={t.categoria}
                onClick={() => setEditing({
                  categoria: t.categoria,
                  categoria_label: t.label,
                  gestor_emails: [],
                  referente_emails: [],
                  activa: true,
                })}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-sm text-slate-200"
              >
                + {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setEditing({
          categoria: '',
          categoria_label: '',
          gestor_emails: [],
          referente_emails: [],
          activa: true,
        })}
        className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm"
      >
        <Plus className="w-4 h-4" />
        Nueva categoría
      </button>

      {loading ? (
        <div className="text-slate-500 text-center py-8">Cargando...</div>
      ) : (
        <div className="space-y-2">
          {routings.filter(r => r.activa).map(r => (
            <div key={r.id} className="p-4 bg-slate-900 border border-slate-800 rounded-lg">
              <div className="flex items-start gap-3">
                <Tag className="w-4 h-4 text-purple-400 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-100">{r.categoria_label || r.categoria}</div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">{r.categoria}</div>
                  <div className="mt-2 space-y-1 text-xs">
                    <div>
                      <span className="text-slate-500">Gestores (TO): </span>
                      {r.gestor_emails.length === 0 ? (
                        <span className="text-amber-400">ninguno configurado</span>
                      ) : (
                        <span className="text-slate-300">{r.gestor_emails.join(', ')}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-500">Referentes (CC): </span>
                      {r.referente_emails.length === 0 ? (
                        <span className="text-slate-500 italic">ninguno</span>
                      ) : (
                        <span className="text-slate-300">{r.referente_emails.join(', ')}</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setEditing(r)}
                  className="text-slate-500 hover:text-blue-400 p-1"
                  title="Editar"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-300">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {editing && (
        <EditarRoutingModal
          inicial={editing}
          organizacionId={orgActivaId}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchRouting(); }}
        />
      )}
    </div>
  );
}

// =====================================================
// Modal de edición
// =====================================================
function EditarRoutingModal({
  inicial,
  organizacionId,
  onClose,
  onSaved,
}: {
  inicial: Routing;
  organizacionId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [categoria, setCategoria] = useState(inicial.categoria);
  const [categoriaLabel, setCategoriaLabel] = useState(inicial.categoria_label);
  const [gestores, setGestores] = useState<string[]>(inicial.gestor_emails);
  const [referentes, setReferentes] = useState<string[]>(inicial.referente_emails);
  const [newGestor, setNewGestor] = useState('');
  const [newReferente, setNewReferente] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const addGestor = () => {
    if (!isEmail(newGestor)) return setError('Email inválido');
    setError(null);
    setGestores(xs => [...xs, newGestor]);
    setNewGestor('');
  };
  const addReferente = () => {
    if (!isEmail(newReferente)) return setError('Email inválido');
    setError(null);
    setReferentes(xs => [...xs, newReferente]);
    setNewReferente('');
  };

  const guardar = async () => {
    if (!categoria.trim()) return setError('Categoría requerida');
    if (gestores.length === 0 && referentes.length === 0) {
      return setError('Necesitás al menos un gestor o un referente');
    }
    setError(null);
    setSaving(true);
    try {
      const resp = await fetch('/api/insumos/routing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizacion_id: organizacionId,
          categoria: categoria.trim().toLowerCase().replace(/\s+/g, '_'),
          categoria_label: categoriaLabel.trim() || categoria.trim(),
          gestor_emails: gestores,
          referente_emails: referentes,
        }),
      });
      if (!resp.ok) {
        const b = await resp.json().catch(() => ({}));
        throw new Error(b.error || `HTTP ${resp.status}`);
      }
      setSavedOk(true);
      setTimeout(() => { onSaved(); }, 600);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h3 className="font-semibold text-slate-100">{inicial.id ? 'Editar' : 'Nueva'} categoría</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200">
            <Plus className="w-5 h-5 rotate-45" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Código (sin espacios)</label>
              <input
                value={categoria}
                onChange={e => setCategoria(e.target.value)}
                disabled={!!inicial.id}
                placeholder="papeleria"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 disabled:opacity-50 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nombre visible</label>
              <input
                value={categoriaLabel}
                onChange={e => setCategoriaLabel(e.target.value)}
                placeholder="Papelería"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200"
              />
            </div>
          </div>

          {/* Gestores */}
          <div>
            <div className="text-sm font-medium text-slate-200 mb-1.5">Gestores (TO)</div>
            <div className="text-xs text-slate-500 mb-2">Quienes deciden y resuelven la compra. Reciben el email en el campo "Para".</div>
            <div className="space-y-1.5 mb-2">
              {gestores.map(e => (
                <div key={e} className="flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm">
                  <span className="text-slate-200 truncate">{e}</span>
                  <button onClick={() => setGestores(xs => xs.filter(x => x !== e))} className="text-slate-500 hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newGestor}
                onChange={e => setNewGestor(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addGestor(); } }}
                placeholder="gestor@email.com"
                className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200"
              />
              <button onClick={addGestor} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-sm text-slate-200">+</button>
            </div>
          </div>

          {/* Referentes */}
          <div>
            <div className="text-sm font-medium text-slate-200 mb-1.5">Referentes (CC)</div>
            <div className="text-xs text-slate-500 mb-2">Copia informativa. No son responsables pero quedan al tanto.</div>
            <div className="space-y-1.5 mb-2">
              {referentes.map(e => (
                <div key={e} className="flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm">
                  <span className="text-slate-200 truncate">{e}</span>
                  <button onClick={() => setReferentes(xs => xs.filter(x => x !== e))} className="text-slate-500 hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newReferente}
                onChange={e => setNewReferente(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addReferente(); } }}
                placeholder="referente@email.com"
                className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200"
              />
              <button onClick={addReferente} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-sm text-slate-200">+</button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-300">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-slate-800 bg-slate-900/60">
          {savedOk && <span className="flex items-center gap-1 text-sm text-emerald-400"><Check className="w-4 h-4" /> Guardado</span>}
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-300 hover:text-slate-100">Cancelar</button>
          <button onClick={guardar} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
