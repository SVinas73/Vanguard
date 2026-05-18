'use client';

import React, { useState } from 'react';
import { X, Building2, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { crearOrganizacion } from '@/lib/security/org-context';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  onClose: () => void;
  onCreado: () => void;
}

export function CrearOrgModal({ onClose, onCreado }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth(false);
  const [nombre, setNombre] = useState('');
  const [rut, setRut] = useState('');
  const [pais, setPais] = useState('UY');
  const [moneda, setMoneda] = useState('UYU');
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || !nombre.trim()) return;
    setCreando(true);
    setError(null);
    const org = await crearOrganizacion({
      nombre: nombre.trim(),
      rut: rut.trim() || undefined,
      pais,
      moneda,
      ownerEmail: user.email,
    });
    setCreando(false);
    if (!org) {
      setError(t('org.createError'));
      return;
    }
    onCreado();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-lg w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-slate-400" />
            <h2 className="text-[14px] font-semibold text-slate-100">{t('org.newOrganization')}</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">
              {t('org.name')} <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              required
              placeholder="Mi Empresa S.A."
              className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-[13px] text-slate-100 focus:outline-none focus:border-slate-600"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">
              {t('org.taxId')}
            </label>
            <input
              type="text"
              value={rut}
              onChange={e => setRut(e.target.value)}
              placeholder={t('org.optional')}
              className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-[13px] text-slate-100 focus:outline-none focus:border-slate-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">{t('org.country')}</label>
              <select
                value={pais}
                onChange={e => setPais(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-[13px] text-slate-100 focus:outline-none focus:border-slate-600"
              >
                <option value="UY">Uruguay</option>
                <option value="AR">Argentina</option>
                <option value="CL">Chile</option>
                <option value="BR">Brasil</option>
                <option value="PE">Perú</option>
                <option value="CO">Colombia</option>
                <option value="MX">México</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">{t('org.currency')}</label>
              <select
                value={moneda}
                onChange={e => setMoneda(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-[13px] text-slate-100 focus:outline-none focus:border-slate-600"
              >
                <option value="UYU">UYU</option>
                <option value="ARS">ARS</option>
                <option value="CLP">CLP</option>
                <option value="BRL">BRL</option>
                <option value="PEN">PEN</option>
                <option value="COP">COP</option>
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="text-[12px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-[12px] text-slate-400 hover:text-slate-200"
            >
              {t('org.cancel')}
            </button>
            <button
              type="submit"
              disabled={creando || !nombre.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-indigo-500 hover:bg-indigo-400 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {creando && <Loader2 size={12} className="animate-spin" />}
              {creando ? t('org.creating') : t('org.createButton')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
