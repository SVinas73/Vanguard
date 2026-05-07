'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Key, Plus, RefreshCw, Trash2, Copy, Check, X,
  AlertTriangle, Eye, Shield,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useWmsToast } from '@/components/wms/useWmsToast';

// =====================================================
// Gestor de API keys
// =====================================================
// Solo admins. Generar, listar, revocar, ver scopes.
// La key plana SOLO se muestra UNA vez al crearla.
// =====================================================

const SCOPES_DISPONIBLES = [
  'productos:read', 'productos:write',
  'clientes:read', 'clientes:write',
  'proveedores:read', 'proveedores:write',
  'ordenes_venta:read', 'ordenes_venta:write',
  'ordenes_compra:read', 'ordenes_compra:write',
  'tickets:read', 'tickets:write',
  'garantias:read', 'garantias:write',
  'webhooks:manage',
] as const;

interface ApiKeyRow {
  id: string;
  nombre: string;
  prefix: string;
  scopes: string[];
  activa: boolean;
  expira_en?: string | null;
  ultimo_uso_at?: string | null;
  creada_por: string;
  notas?: string;
  created_at: string;
}

export default function ApiKeysManager() {
  const { user } = useAuth(false);
  const toast = useWmsToast();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<'lista' | 'nueva'>('lista');
  const [secretCreado, setSecretCreado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const [form, setForm] = useState({
    nombre: '', notas: '',
    scopes: ['productos:read', 'clientes:read'] as string[],
    rate_limit: '120', expira_en: '',
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('api_keys')
        .select('*').order('created_at', { ascending: false });
      setKeys((data || []) as ApiKeyRow[]);
    } finally { setLoading(false); }
  };

  const crear = async () => {
    if (!form.nombre.trim()) {
      toast.warning('Falta el nombre');
      return;
    }
    if (form.scopes.length === 0) {
      toast.warning('Seleccioná al menos un scope');
      return;
    }
    try {
      const { crearApiKey } = await import('@/lib/api-gateway/api-keys');
      const result = await crearApiKey({
        nombre: form.nombre,
        scopes: form.scopes as any,
        rate_limit_por_minuto: parseInt(form.rate_limit) || 120,
        expira_en: form.expira_en || null,
        notas: form.notas || undefined,
        creada_por: user?.email || '',
      });
      if (result) {
        setSecretCreado(result.secret);
        toast.success('API key creada');
        loadData();
      } else {
        toast.error('No se pudo crear');
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const revocar = async (k: ApiKeyRow) => {
    const motivo = prompt('Motivo de la revocación:');
    if (!motivo) return;
    const { revocarApiKey } = await import('@/lib/api-gateway/api-keys');
    const ok = await revocarApiKey(k.id, motivo, user?.email || '');
    if (ok) {
      toast.success(`Key ${k.prefix} revocada`);
      loadData();
    }
  };

  const copiarSecret = async () => {
    if (!secretCreado) return;
    await navigator.clipboard.writeText(secretCreado);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const cerrarSecret = () => {
    setSecretCreado(null);
    setVista('lista');
    setForm({ nombre: '', notas: '', scopes: ['productos:read', 'clientes:read'], rate_limit: '120', expira_en: '' });
  };

  const stats = useMemo(() => ({
    activas: keys.filter(k => k.activa).length,
    revocadas: keys.filter(k => !k.activa).length,
    total: keys.length,
  }), [keys]);

  if (loading) {
    return <div className="flex items-center justify-center p-12"><RefreshCw className="h-8 w-8 animate-spin text-blue-400" /></div>;
  }

  // ========== Modal mostrando key recién creada ==========
  if (secretCreado) {
    return (
      <div className="space-y-6">
        <toast.Toast />
        <div className="bg-emerald-500/10 border-2 border-emerald-500/30 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <Check className="h-6 w-6 text-emerald-300 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-emerald-300">API Key creada</h3>
              <p className="text-sm text-slate-300 mt-1">
                Copiá la key ahora. <strong>No vas a poder verla otra vez</strong> — solo el prefijo.
                Si la perdés, generá una nueva.
              </p>
            </div>
          </div>

          <div className="mt-4 bg-slate-950 rounded-lg p-4 font-mono text-sm break-all border border-slate-700 flex items-center gap-2">
            <span className="flex-1 text-emerald-300">{secretCreado}</span>
            <button
              onClick={copiarSecret}
              className={cn('px-3 py-1.5 rounded text-xs flex items-center gap-1',
                copiado ? 'bg-emerald-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200')}
            >
              {copiado ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copiado ? 'Copiado' : 'Copiar'}
            </button>
          </div>

          <div className="mt-4 bg-amber-500/10 border border-amber-500/30 rounded p-3 text-xs text-amber-200 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Cómo usar la key:</strong>
              <pre className="mt-1 bg-slate-950 p-2 rounded text-[11px] overflow-x-auto">
{`curl -H "X-Vanguard-Api-Key: ${secretCreado}" \\
     https://tu-dominio/api/v1/productos`}
              </pre>
            </div>
          </div>

          <button onClick={cerrarSecret}
            className="mt-4 w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm">
            Ya copié la key, continuar
          </button>
        </div>
      </div>
    );
  }

  // ========== Form nueva ==========
  if (vista === 'nueva') {
    return (
      <div className="space-y-6">
        <toast.Toast />
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Plus className="h-6 w-6 text-blue-400" /> Nueva API Key
          </h3>
          <button onClick={() => setVista('lista')} className="p-2 hover:bg-slate-800 rounded-lg">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-4 max-w-2xl">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nombre *</label>
            <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
              placeholder="ej: Integración con Tienda Online"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm" />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-2">Scopes (permisos)</label>
            <div className="grid grid-cols-2 gap-2">
              {SCOPES_DISPONIBLES.map(s => (
                <label key={s} className="flex items-center gap-2 p-2 bg-slate-800/30 rounded cursor-pointer hover:bg-slate-800/60">
                  <input type="checkbox" checked={form.scopes.includes(s)}
                    onChange={e => setForm(p => ({
                      ...p,
                      scopes: e.target.checked ? [...p.scopes, s] : p.scopes.filter(x => x !== s),
                    }))} />
                  <span className="text-xs text-slate-300 font-mono">{s}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Rate limit (req/min)</label>
              <input type="number" value={form.rate_limit} onChange={e => setForm({ ...form, rate_limit: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Expira en (opcional)</label>
              <input type="date" value={form.expira_en} onChange={e => setForm({ ...form, expira_en: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Notas</label>
            <textarea rows={2} value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })}
              placeholder="Describí brevemente para qué se usa esta key"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm resize-none" />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button onClick={() => setVista('lista')} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm">Cancelar</button>
            <button onClick={crear} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm">Crear key</button>
          </div>
        </div>
      </div>
    );
  }

  // ========== Lista ==========
  return (
    <div className="space-y-6">
      <toast.Toast />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Key className="h-6 w-6 text-blue-400" />
            API Keys
          </h3>
          <p className="text-sm text-slate-400 mt-0.5">
            Acceso programático a la API REST de Vanguard. Revisá <code className="text-slate-300">/api/v1/openapi.json</code> para el schema.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={() => setVista('nueva')}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg">
            <Plus className="h-4 w-4" /> Nueva key
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Activas" value={stats.activas} color="text-emerald-300" />
        <Kpi label="Revocadas" value={stats.revocadas} color="text-slate-400" />
        <Kpi label="Total" value={stats.total} color="text-blue-300" />
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 border-b border-slate-800">
              <tr className="text-left text-xs text-slate-400 uppercase">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Prefijo</th>
                <th className="px-4 py-3">Scopes</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Último uso</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {keys.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-500 text-sm">
                  Sin API keys. Creá la primera arriba.
                </td></tr>
              ) : keys.map(k => (
                <tr key={k.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3 text-slate-200">{k.nombre}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">{k.prefix}…</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-md">
                      {k.scopes.slice(0, 3).map(s => (
                        <span key={s} className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300">{s}</span>
                      ))}
                      {k.scopes.length > 3 && <span className="text-[10px] text-slate-500">+{k.scopes.length - 3}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {k.activa ? (
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/15 text-emerald-300">Activa</span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-red-500/15 text-red-300">Revocada</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {k.ultimo_uso_at ? new Date(k.ultimo_uso_at).toLocaleString('es-UY') : 'Nunca'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {k.activa && (
                      <button onClick={() => revocar(k)}
                        className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400" title="Revocar">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-900/30 border border-slate-800/50 rounded-xl p-4 text-xs text-slate-400">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-3.5 w-3.5" />
          <span className="font-semibold text-slate-300">Cómo usar las API keys</span>
        </div>
        <pre className="bg-slate-950 rounded p-3 text-[11px] text-slate-300 overflow-x-auto">
{`# Listar productos
curl -H "X-Vanguard-Api-Key: ak_live_xxx" \\
     https://tu-dominio/api/v1/productos

# Crear ticket
curl -X POST \\
  -H "Authorization: Bearer ak_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"asunto":"Falla X","prioridad":"alta"}' \\
  https://tu-dominio/api/v1/tickets

# Schema completo
curl https://tu-dominio/api/v1/openapi.json`}
        </pre>
      </div>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={cn('text-2xl font-bold', color)}>{value}</div>
    </div>
  );
}
