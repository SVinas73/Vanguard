'use client';

import React, { useEffect, useState } from 'react';
import { Mail, Save, Trash2, Plus, AlertCircle, Check } from 'lucide-react';
import { useOrganizacion } from '@/hooks/useOrganizacion';

interface Destinatario {
  id?: number;
  evento: string;
  emails: string[];
  enviar_email: boolean;
  notif_in_app: boolean;
}

const EVENTOS: Array<{ id: string; titulo: string; descripcion: string }> = [
  {
    id: 'orden_compra_creada',
    titulo: 'Orden de compra creada',
    descripcion: 'Cuando alguien crea una OC nueva. Útil para gerente de compras, financiero.',
  },
];

export default function NotificacionesDestinatarios() {
  const { orgActivaId, orgActiva } = useOrganizacion();
  const [config, setConfig] = useState<Record<string, Destinatario>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newEmails, setNewEmails] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!orgActivaId) return;
    fetch(`/api/notificaciones/destinatarios?organizacion_id=${orgActivaId}`)
      .then(r => r.json())
      .then(data => {
        const map: Record<string, Destinatario> = {};
        for (const ev of EVENTOS) {
          const existente = (data.destinatarios || []).find((d: any) => d.evento === ev.id);
          map[ev.id] = existente
            ? { id: existente.id, evento: ev.id, emails: existente.emails || [], enviar_email: existente.enviar_email, notif_in_app: existente.notif_in_app }
            : { evento: ev.id, emails: [], enviar_email: true, notif_in_app: true };
        }
        setConfig(map);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Error cargando configuración');
        setLoading(false);
      });
  }, [orgActivaId]);

  const agregarEmail = (evento: string) => {
    const email = (newEmails[evento] || '').trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Email inválido');
      return;
    }
    setError(null);
    setConfig(c => ({
      ...c,
      [evento]: { ...c[evento], emails: [...c[evento].emails, email] },
    }));
    setNewEmails(n => ({ ...n, [evento]: '' }));
  };

  const quitarEmail = (evento: string, email: string) => {
    setConfig(c => ({
      ...c,
      [evento]: { ...c[evento], emails: c[evento].emails.filter(e => e !== email) },
    }));
  };

  const toggle = (evento: string, field: 'enviar_email' | 'notif_in_app') => {
    setConfig(c => ({ ...c, [evento]: { ...c[evento], [field]: !c[evento][field] } }));
  };

  const guardar = async (evento: string) => {
    if (!orgActivaId) return;
    setSaving(evento);
    setError(null);
    setSaved(null);
    const cfg = config[evento];
    try {
      const resp = await fetch('/api/notificaciones/destinatarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizacion_id: orgActivaId,
          evento,
          emails: cfg.emails,
          enviar_email: cfg.enviar_email,
          notif_in_app: cfg.notif_in_app,
        }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${resp.status}`);
      }
      setSaved(evento);
      setTimeout(() => setSaved(null), 2500);
    } catch (e: any) {
      setError(e.message || 'Error guardando');
    } finally {
      setSaving(null);
    }
  };

  if (!orgActivaId) {
    return (
      <div className="p-6 text-center text-slate-500">
        Seleccioná una organización en el header primero.
      </div>
    );
  }

  if (loading) return <div className="p-6 text-slate-500">Cargando...</div>;

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Mail className="w-5 h-5 text-blue-400 mt-0.5" />
          <div>
            <h3 className="font-medium text-slate-100">Destinatarios de notificaciones</h3>
            <p className="text-sm text-slate-400 mt-1">
              Por cada evento del sistema, configurá quiénes reciben aviso por email + notificación in-app.
              {orgActiva && <> Configuración para <strong className="text-slate-200">{orgActiva.nombre}</strong>.</>}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-md text-sm text-red-300">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {EVENTOS.map(ev => {
        const cfg = config[ev.id];
        if (!cfg) return null;
        return (
          <div key={ev.id} className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <div className="mb-4">
              <h4 className="font-medium text-slate-100">{ev.titulo}</h4>
              <p className="text-xs text-slate-500 mt-1">{ev.descripcion}</p>
            </div>

            <div className="flex flex-wrap gap-4 mb-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cfg.enviar_email}
                  onChange={() => toggle(ev.id, 'enviar_email')}
                  className="rounded border-slate-700 bg-slate-800"
                />
                <span className="text-slate-300">Enviar email</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cfg.notif_in_app}
                  onChange={() => toggle(ev.id, 'notif_in_app')}
                  className="rounded border-slate-700 bg-slate-800"
                />
                <span className="text-slate-300">Notificación in-app</span>
              </label>
            </div>

            <div className="space-y-2 mb-3">
              {cfg.emails.length === 0 && (
                <div className="text-xs text-slate-500 italic">Sin destinatarios configurados</div>
              )}
              {cfg.emails.map(email => (
                <div key={email} className="flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-md text-sm">
                  <span className="text-slate-200 truncate">{email}</span>
                  <button
                    onClick={() => quitarEmail(ev.id, email)}
                    className="text-slate-500 hover:text-red-400 transition"
                    title="Quitar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mb-3">
              <input
                type="email"
                placeholder="agregar@email.com"
                value={newEmails[ev.id] || ''}
                onChange={e => setNewEmails(n => ({ ...n, [ev.id]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') agregarEmail(ev.id); }}
                className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => agregarEmail(ev.id)}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-sm border border-slate-700"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar
              </button>
            </div>

            <div className="flex justify-end gap-2">
              {saved === ev.id && (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <Check className="w-3.5 h-3.5" />
                  Guardado
                </span>
              )}
              <button
                onClick={() => guardar(ev.id)}
                disabled={saving === ev.id}
                className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm transition disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving === ev.id ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
