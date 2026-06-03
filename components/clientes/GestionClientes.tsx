'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, Plus, Search, Pencil, Trash2, X, Save, Loader2 } from 'lucide-react';

// =====================================================
// Gestión de clientes — alta, edición, baja y listado
// =====================================================
// Reemplaza el botón "Clientes" que vivía dentro de Ventas. CRUD sobre
// la tabla `clientes`.
// =====================================================

interface Cliente {
  id: string;
  codigo: string;
  tipo: string;
  nombre: string;
  rut?: string | null;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  limite_credito?: number | null;
  dias_credito?: number | null;
  bloqueado?: boolean;
  activo?: boolean;
}

// Plazo de crédito disponible (días). Contado = 1 día.
const PLAZOS_CREDITO = [1, 30, 60, 90];

const FORM_VACIO = {
  codigo: '', tipo: 'persona', nombre: '', rut: '', email: '', telefono: '', direccion: '', diasCredito: 30, bloqueado: false,
};

export function GestionClientes({ userEmail }: { userEmail?: string }) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('clientes')
      .select('*')
      .order('nombre');
    setClientes((data as Cliente[]) || []);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const abrirNuevo = () => {
    setEditando(null);
    setForm(FORM_VACIO);
    setError(null);
    setModalOpen(true);
  };

  const abrirEditar = (c: Cliente) => {
    setEditando(c);
    setForm({
      codigo: c.codigo || '', tipo: c.tipo || 'persona', nombre: c.nombre || '',
      rut: c.rut || '', email: c.email || '', telefono: c.telefono || '',
      direccion: c.direccion || '', diasCredito: Number(c.dias_credito) || 30,
      bloqueado: c.bloqueado === true,
    });
    setError(null);
    setModalOpen(true);
  };

  const guardar = async () => {
    setError(null);
    if (!form.codigo.trim() || !form.nombre.trim()) {
      setError('Código y nombre son obligatorios.');
      return;
    }
    setSaving(true);
    const data = {
      codigo: form.codigo.toUpperCase().trim(),
      tipo: form.tipo,
      nombre: form.nombre.trim(),
      rut: form.rut || null,
      email: form.email || null,
      telefono: form.telefono || null,
      direccion: form.direccion || null,
      dias_credito: form.diasCredito || 30,
      bloqueado: form.bloqueado,
    };
    const res = editando
      ? await supabase.from('clientes').update(data).eq('id', editando.id)
      : await supabase.from('clientes').insert({ ...data, activo: true });
    setSaving(false);
    if (res.error) { setError(res.error.message); return; }
    setModalOpen(false);
    cargar();
  };

  const eliminar = async (c: Cliente) => {
    if (!confirm(`¿Eliminar el cliente "${c.nombre}"?`)) return;
    const { error } = await supabase.from('clientes').delete().eq('id', c.id);
    if (error) { alert(`No se pudo eliminar: ${error.message}`); return; }
    cargar();
  };

  const filtrados = useMemo(() => {
    const q = search.toLowerCase();
    return clientes.filter(c =>
      c.nombre.toLowerCase().includes(q) ||
      (c.codigo || '').toLowerCase().includes(q) ||
      (c.rut || '').toLowerCase().includes(q));
  }, [clientes, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-slate-300" />
          <h2 className="text-lg font-semibold text-slate-100">Gestión de clientes</h2>
          <span className="text-sm text-slate-500">({clientes.length})</span>
        </div>
        <button onClick={abrirNuevo}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-xl text-sm font-medium">
          <Plus size={16} /> Nuevo cliente
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, código o RUT..."
          className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/50 border border-slate-800/50 text-sm text-slate-200 focus:outline-none focus:border-slate-600" />
      </div>

      <div className="rounded-xl border border-slate-800/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/80 text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-3 py-3 text-left">Código</th>
              <th className="px-3 py-3 text-left">Nombre</th>
              <th className="px-3 py-3 text-left">RUT</th>
              <th className="px-3 py-3 text-left">Email</th>
              <th className="px-3 py-3 text-left">Teléfono</th>
              <th className="px-3 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">Cargando…</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No hay clientes.</td></tr>
            ) : filtrados.map(c => (
              <tr key={c.id} className="hover:bg-slate-800/30">
                <td className="px-3 py-2.5 font-mono text-slate-400">{c.codigo}</td>
                <td className="px-3 py-2.5 text-slate-200">{c.nombre}</td>
                <td className="px-3 py-2.5 text-slate-400">{c.rut || '—'}</td>
                <td className="px-3 py-2.5 text-slate-400">{c.email || '—'}</td>
                <td className="px-3 py-2.5 text-slate-400">{c.telefono || '—'}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => abrirEditar(c)} className="p-1.5 rounded-lg hover:bg-blue-500/10 text-slate-400 hover:text-blue-400"><Pencil size={14} /></button>
                    <button onClick={() => eliminar(c)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="font-semibold text-slate-100">{editando ? 'Editar cliente' : 'Nuevo cliente'}</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-500 hover:text-slate-200"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Código *</label>
                  <input value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 font-mono" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Tipo</label>
                  <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200">
                    <option value="persona">Persona</option>
                    <option value="empresa">Empresa</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nombre / Razón social *</label>
                <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">RUT / CI</label>
                  <input value={form.rut} onChange={e => setForm({ ...form, rut: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Plazo de crédito</label>
                  <select value={form.diasCredito} onChange={e => setForm({ ...form, diasCredito: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200">
                    {PLAZOS_CREDITO.map(d => (
                      <option key={d} value={d}>{d === 1 ? 'Contado (1 día)' : `${d} días`}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">Plazo de pago acordado con el cliente.</p>
                </div>
              </div>
              <label className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded cursor-pointer">
                <input type="checkbox" checked={form.bloqueado}
                  onChange={e => setForm({ ...form, bloqueado: e.target.checked })} className="rounded" />
                <span className="text-sm text-slate-300">Cliente bloqueado (no puede generar pedidos)</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Email</label>
                  <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Teléfono</label>
                  <input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Dirección</label>
                <input value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200" />
              </div>
              {error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">{error}</div>}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-slate-800">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-slate-300 hover:text-slate-100">Cancelar</button>
              <button onClick={guardar} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-sm disabled:opacity-50">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GestionClientes;
