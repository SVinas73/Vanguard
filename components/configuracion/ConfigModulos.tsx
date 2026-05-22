'use client';

import React, { useState } from 'react';
import { Check, Sparkles, Layers, Settings2, DollarSign, Plus, Trash2 } from 'lucide-react';
import { useModulosHabilitados } from '@/hooks/useModulosHabilitados';
import { useTiposCambio } from '@/hooks/useTiposCambio';
import {
  ALL_MODULES,
  LITE_MODULES,
  MODULE_LABELS,
  PINNED_MODULES,
} from '@/lib/modules';
import { MONEDAS_DISPONIBLES, formatMoney } from '@/lib/currency';
import type { Moneda, TabType } from '@/types';
import { cn } from '@/lib/utils';

export function ConfigModulos() {
  const { config, modulos, cambiarPreset, setDisplayCurrency, setBaseCurrency, loading } = useModulosHabilitados();
  const { raw: rates, agregar, eliminar } = useTiposCambio();

  const [custom, setCustom] = useState<Set<TabType>>(new Set(config.enabled_modules));

  // Sync custom when config changes (org switch, etc.)
  React.useEffect(() => {
    setCustom(new Set(config.enabled_modules));
  }, [config.enabled_modules]);

  const togglear = (m: TabType) => {
    if (PINNED_MODULES.includes(m)) return;
    setCustom(prev => {
      const n = new Set(prev);
      if (n.has(m)) n.delete(m); else n.add(m);
      return n;
    });
  };

  const guardarCustom = async () => {
    await cambiarPreset('custom', Array.from(custom));
  };

  // Tipo de cambio form
  const [nuevoTC, setNuevoTC] = useState({
    moneda_origen: 'USD' as Moneda,
    moneda_destino: 'UYU' as Moneda,
    tasa: '',
    notas: '',
  });
  const [tcError, setTcError] = useState<string | null>(null);
  const [tcOk, setTcOk] = useState(false);

  const handleAgregarTC = async () => {
    setTcError(null); setTcOk(false);
    const tasaNum = parseFloat(nuevoTC.tasa);
    if (!Number.isFinite(tasaNum) || tasaNum <= 0) {
      setTcError('Ingresá una tasa válida.');
      return;
    }
    const res = await agregar({
      moneda_origen: nuevoTC.moneda_origen,
      moneda_destino: nuevoTC.moneda_destino,
      tasa: tasaNum,
      notas: nuevoTC.notas || undefined,
    });
    if (!res.ok) { setTcError(res.error ?? 'Error al guardar'); return; }
    setTcOk(true);
    setNuevoTC({ ...nuevoTC, tasa: '', notas: '' });
  };

  if (loading) {
    return <div className="p-6 text-slate-400">Cargando configuración…</div>;
  }

  return (
    <div className="p-6 space-y-8 max-w-4xl">
      <header>
        <h1 className="text-xl font-semibold text-slate-100">Configuración</h1>
      </header>

      {/* ============ MODO LITE / FULL / CUSTOM ============ */}
      <section className="rounded-xl bg-slate-900 border border-slate-800 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="text-indigo-400" size={18} />
          <h2 className="text-sm font-semibold text-slate-100">Modo del sistema</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <PresetCard
            active={config.preset === 'lite'}
            onClick={() => cambiarPreset('lite')}
            icon={<Sparkles size={16} />}
            title="Lite"
            desc="Para PYMEs. Solo dashboard, stock, movimientos, reportes, facturación y ayuda."
          />
          <PresetCard
            active={config.preset === 'full'}
            onClick={() => cambiarPreset('full')}
            icon={<Layers size={16} />}
            title="Completo"
            desc="Todos los módulos disponibles. Recomendado para empresas medianas/grandes."
          />
          <PresetCard
            active={config.preset === 'custom'}
            onClick={guardarCustom}
            icon={<Settings2 size={16} />}
            title="Personalizado"
            desc="Elegí exactamente qué módulos querés ver."
          />
        </div>

        {config.preset === 'custom' && (
          <div className="rounded-lg bg-slate-950/50 border border-slate-800 p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {ALL_MODULES.map(m => {
                const pinned = PINNED_MODULES.includes(m);
                const checked = pinned || custom.has(m);
                return (
                  <label
                    key={m}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-md text-xs cursor-pointer transition-colors',
                      checked ? 'bg-indigo-500/10 text-indigo-200' : 'bg-slate-900 text-slate-400 hover:bg-slate-800',
                      pinned && 'opacity-60 cursor-not-allowed'
                    )}
                  >
                    <input
                      type="checkbox"
                      className="accent-indigo-500"
                      checked={checked}
                      disabled={pinned}
                      onChange={() => togglear(m)}
                    />
                    <span>{MODULE_LABELS[m] ?? m}</span>
                  </label>
                );
              })}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={guardarCustom}
                className="px-3 py-1.5 rounded-md bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-medium"
              >
                Guardar selección ({custom.size + PINNED_MODULES.filter(p => !custom.has(p)).length} módulos)
              </button>
            </div>
          </div>
        )}

        <p className="text-xs text-slate-500 mt-3">
          Vista actual: <strong className="text-slate-300">{modulos.length}</strong> módulos visibles.
          Podés cambiar de modo cuando quieras sin perder información.
        </p>
      </section>

      {/* ============ MONEDA BASE DEL SISTEMA ============ */}
      <section className="rounded-xl bg-slate-900 border border-slate-800 p-5">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="text-cyan-400" size={18} />
          <h2 className="text-sm font-semibold text-slate-100">Moneda base del sistema</h2>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          En esta moneda se interpretan los precios y costos guardados. Cambiala solo si tu empresa
          opera en una moneda distinta a la actual — no se convierten los valores existentes.
        </p>
        <div className="flex gap-2 flex-wrap">
          {MONEDAS_DISPONIBLES.map(m => (
            <button
              key={m}
              onClick={() => setBaseCurrency(m)}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                (config.base_currency ?? 'UYU') === m
                  ? 'bg-cyan-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </section>

      {/* ============ MONEDA DE VISUALIZACIÓN ============ */}
      <section className="rounded-xl bg-slate-900 border border-slate-800 p-5">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="text-emerald-400" size={18} />
          <h2 className="text-sm font-semibold text-slate-100">Moneda de reportes y dashboard</h2>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Reportes, dashboard y stock muestran los valores convertidos a esta moneda
          (desde la base, usando los tipos de cambio de abajo).
        </p>
        <div className="flex gap-2 flex-wrap">
          {MONEDAS_DISPONIBLES.map(m => (
            <button
              key={m}
              onClick={() => setDisplayCurrency(m)}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                config.display_currency === m
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </section>

      {/* ============ TIPOS DE CAMBIO ============ */}
      <section className="rounded-xl bg-slate-900 border border-slate-800 p-5">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="text-amber-400" size={18} />
          <h2 className="text-sm font-semibold text-slate-100">Tipos de cambio</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-3">
          <select
            value={nuevoTC.moneda_origen}
            onChange={e => setNuevoTC({ ...nuevoTC, moneda_origen: e.target.value as Moneda })}
            className="bg-slate-950 border border-slate-800 rounded-md px-2 py-2 text-sm text-slate-200"
          >
            {MONEDAS_DISPONIBLES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <div className="flex items-center justify-center text-slate-500 text-xs">→</div>
          <select
            value={nuevoTC.moneda_destino}
            onChange={e => setNuevoTC({ ...nuevoTC, moneda_destino: e.target.value as Moneda })}
            className="bg-slate-950 border border-slate-800 rounded-md px-2 py-2 text-sm text-slate-200"
          >
            {MONEDAS_DISPONIBLES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <input
            type="number"
            step="0.0001"
            placeholder="Tasa (ej: 40.5)"
            value={nuevoTC.tasa}
            onChange={e => setNuevoTC({ ...nuevoTC, tasa: e.target.value })}
            className="bg-slate-950 border border-slate-800 rounded-md px-2 py-2 text-sm text-slate-200"
          />
          <button
            onClick={handleAgregarTC}
            className="flex items-center justify-center gap-1 px-3 py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium"
          >
            <Plus size={14} /> Cargar
          </button>
        </div>
        {tcError && <p className="text-xs text-red-400 mb-2">{tcError}</p>}
        {tcOk && <p className="text-xs text-emerald-400 mb-2 flex items-center gap-1"><Check size={12}/> Cotización guardada.</p>}

        <div className="rounded-md border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-950 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Par</th>
                <th className="px-3 py-2 text-right">Tasa</th>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-right">Ejemplo (1)</th>
                <th className="px-3 py-2 text-center w-12"></th>
              </tr>
            </thead>
            <tbody>
              {rates.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500 text-xs">
                  Todavía no cargaste tipos de cambio.
                </td></tr>
              )}
              {rates.slice(0, 30).map((r, i) => (
                <tr key={r.id ?? i} className="border-t border-slate-800/60">
                  <td className="px-3 py-2 text-slate-300">{r.moneda_origen} → {r.moneda_destino}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-200">{r.tasa}</td>
                  <td className="px-3 py-2 text-slate-400 text-xs">{r.fecha}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-400">
                    {formatMoney(1, r.moneda_origen)} = {formatMoney(r.tasa, r.moneda_destino)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {r.id && (
                      <button
                        onClick={async () => {
                          if (!confirm(`Eliminar tasa ${r.moneda_origen} → ${r.moneda_destino} (${r.fecha})?`)) return;
                          const res = await eliminar(r.id!);
                          if (!res.ok) alert(`No se pudo eliminar: ${res.error}`);
                        }}
                        title="Eliminar tasa"
                        className="p-1.5 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PresetCard({
  active, onClick, icon, title, desc,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'text-left rounded-lg border p-4 transition-colors',
        active
          ? 'bg-indigo-500/10 border-indigo-500/40'
          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-slate-100">
          {icon}
          <span className="text-sm font-semibold">{title}</span>
        </div>
        {active && <Check size={14} className="text-indigo-400" />}
      </div>
      <p className="text-xs text-slate-400 leading-snug">{desc}</p>
    </button>
  );
}
