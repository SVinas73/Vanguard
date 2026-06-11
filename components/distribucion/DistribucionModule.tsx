'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { registrarAuditoria } from '@/lib/audit';
import { useAuth } from '@/hooks/useAuth';
import {
  Truck, Building2, PackageCheck, FileDown, Plus, X, Search,
  MapPin, RefreshCw, CheckCircle, Clock,
} from 'lucide-react';

// =====================================================
// Distribución — agencias + cadeterías + despachos + reporte
// =====================================================
// Flujo: el empaquetador lleva el paquete al área de distribución. El empleado
// registra el paquete dentro de la agencia/cadetería correspondiente, y puede
// sacar un REPORTE por agencia (PDF) con todos los paquetes cargados.

interface Agencia {
  id: string;
  codigo: string;
  nombre: string;
  tipo: 'agencia' | 'cadeteria_propia';
  contacto?: string | null;
  telefono?: string | null;
  zona?: string | null;
  activo: boolean;
}

interface Despacho {
  id: string;
  numero: string;
  agencia_id?: string | null;
  agencia_nombre?: string | null;
  paquete_numero?: string | null;
  orden_venta_numero?: string | null;
  cliente_nombre?: string | null;
  tracking_numero?: string | null;
  bultos: number;
  peso_kg?: number | null;
  estado: 'registrado' | 'en_ruta' | 'entregado' | 'devuelto';
  notas?: string | null;
  registrado_por?: string | null;
  fecha_registro: string;
}

type Tab = 'despachos' | 'agencias';

const ESTADO_CFG: Record<Despacho['estado'], { label: string; cls: string }> = {
  registrado: { label: 'Registrado', cls: 'text-slate-300 bg-slate-800/40' },
  en_ruta:    { label: 'En ruta', cls: 'text-blue-400 bg-blue-500/15' },
  entregado:  { label: 'Entregado', cls: 'text-emerald-400 bg-emerald-500/15' },
  devuelto:   { label: 'Devuelto', cls: 'text-amber-400 bg-amber-500/15' },
};

export default function DistribucionModule() {
  const { user } = useAuth(false);
  const [tab, setTab] = useState<Tab>('despachos');
  const [agencias, setAgencias] = useState<Agencia[]>([]);
  const [despachos, setDespachos] = useState<Despacho[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'despacho' | 'agencia' | null>(null);
  const [filtroAgencia, setFiltroAgencia] = useState<string>('todas');
  const [search, setSearch] = useState('');

  // Paquetes despachados por el empaquetador y aún NO registrados en distribución.
  const [paquetesDespachados, setPaquetesDespachados] = useState<Array<{
    id: string; numero: string; cliente_nombre?: string | null; tracking_numero?: string | null;
    orden_venta_id?: string | null; peso_kg?: number | null;
  }>>([]);

  // Pedidos FACTURADOS (Factura de pedidos) aún no asignados a una agencia.
  // Traen la agencia del cliente para asignarla automáticamente.
  const [pedidosFacturados, setPedidosFacturados] = useState<Array<{
    id: string; numero: string; cliente_nombre: string; agencia_id: string | null;
  }>>([]);

  const [despForm, setDespForm] = useState({
    agencia_id: '', paquete_id: '', paquete_numero: '', orden_venta_numero: '', cliente_nombre: '',
    tracking_numero: '', bultos: 1, peso_kg: '', notas: '',
  });
  const [agForm, setAgForm] = useState({
    codigo: '', nombre: '', tipo: 'agencia' as Agencia['tipo'], contacto: '', telefono: '', zona: '',
  });
  const [saving, setSaving] = useState(false);

  const cargar = async () => {
    setLoading(true);
    const [agRes, depRes, pkgRes, ovRes] = await Promise.all([
      supabase.from('agencias_distribucion').select('*').order('nombre'),
      supabase.from('distribucion_despachos').select('*').order('fecha_registro', { ascending: false }).limit(300),
      // Paquetes despachados por el empaquetador (listos para distribuir).
      supabase.from('wms_paquetes')
        .select('id, numero, cliente_nombre, tracking_numero, orden_venta_id, peso_kg')
        .eq('estado', 'despachado')
        .order('fecha_despacho', { ascending: false })
        .limit(200),
      // Pedidos facturados (WMS → Factura de pedidos): listos para asignar a
      // una agencia. Traemos la agencia del cliente para auto-asignar.
      supabase.from('ordenes_venta')
        .select('id, numero, estado, clientes(nombre, agencia_id)')
        .eq('estado', 'finalizada')
        .limit(200),
    ]);
    setAgencias((agRes.data as any) || []);
    const deps = (depRes.data as any) || [];
    setDespachos(deps);
    // Excluir los paquetes que ya se registraron en distribución.
    const yaRegistrados = new Set(deps.map((d: Despacho) => d.paquete_numero).filter(Boolean));
    setPaquetesDespachados(((pkgRes.data as any) || []).filter((p: any) => !yaRegistrados.has(p.numero)));
    // Pedidos facturados aún sin despacho registrado (por número de orden).
    const ovRegistradas = new Set(deps.map((d: Despacho) => d.orden_venta_numero).filter(Boolean));
    setPedidosFacturados(((ovRes.data as any) || [])
      .filter((o: any) => !ovRegistradas.has(o.numero))
      .map((o: any) => ({
        id: o.id,
        numero: o.numero,
        cliente_nombre: o.clientes?.nombre || 'Sin cliente',
        agencia_id: o.clientes?.agencia_id || null,
      })));
    setLoading(false);
  };
  useEffect(() => { cargar(); }, []);

  const agenciasActivas = useMemo(() => agencias.filter(a => a.activo), [agencias]);

  const despachosFiltrados = useMemo(() => {
    return despachos.filter(d => {
      if (filtroAgencia !== 'todas' && d.agencia_id !== filtroAgencia) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!(d.numero?.toLowerCase().includes(s) ||
              d.paquete_numero?.toLowerCase().includes(s) ||
              d.cliente_nombre?.toLowerCase().includes(s) ||
              d.tracking_numero?.toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [despachos, filtroAgencia, search]);

  const stats = useMemo(() => {
    const hoy = new Date().toISOString().split('T')[0];
    const hoyCount = despachos.filter(d => d.fecha_registro?.startsWith(hoy)).length;
    const enRuta = despachos.filter(d => d.estado === 'en_ruta' || d.estado === 'registrado').length;
    return { total: despachos.length, hoy: hoyCount, enRuta, agencias: agenciasActivas.length };
  }, [despachos, agenciasActivas]);

  // ── Registrar despacho ──
  const guardarDespacho = async () => {
    if (!despForm.agencia_id) return;
    setSaving(true);
    try {
      const agencia = agencias.find(a => a.id === despForm.agencia_id);
      const pkg = paquetesDespachados.find(p => p.id === despForm.paquete_id);
      const numero = `DSP-${new Date().getFullYear()}${String(Date.now()).slice(-6)}`;
      const { error } = await supabase.from('distribucion_despachos').insert({
        numero,
        agencia_id: despForm.agencia_id,
        agencia_nombre: agencia?.nombre || null,
        paquete_id: despForm.paquete_id || null,
        paquete_numero: despForm.paquete_numero || null,
        orden_venta_id: pkg?.orden_venta_id || null,
        orden_venta_numero: despForm.orden_venta_numero || null,
        cliente_nombre: despForm.cliente_nombre || null,
        tracking_numero: despForm.tracking_numero || null,
        bultos: despForm.bultos || 1,
        peso_kg: despForm.peso_kg ? parseFloat(despForm.peso_kg) : null,
        estado: 'registrado',
        notas: despForm.notas || null,
        registrado_por: user?.email || null,
      });
      if (error) { alert(error.message); return; }
      await registrarAuditoria('distribucion_despachos', 'REGISTRAR', numero, null, { agencia: agencia?.nombre, paquete: despForm.paquete_numero }, user?.email || '');
      setModal(null);
      setDespForm({ agencia_id: '', paquete_id: '', paquete_numero: '', orden_venta_numero: '', cliente_nombre: '', tracking_numero: '', bultos: 1, peso_kg: '', notas: '' });
      cargar();
    } finally { setSaving(false); }
  };

  // ── Crear agencia ──
  const guardarAgencia = async () => {
    if (!agForm.codigo || !agForm.nombre) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('agencias_distribucion').insert({
        codigo: agForm.codigo.toUpperCase(), nombre: agForm.nombre, tipo: agForm.tipo,
        contacto: agForm.contacto || null, telefono: agForm.telefono || null, zona: agForm.zona || null,
      });
      if (error) { alert(error.message); return; }
      await registrarAuditoria('agencias_distribucion', 'CREAR', agForm.codigo, null, agForm, user?.email || '');
      setModal(null);
      setAgForm({ codigo: '', nombre: '', tipo: 'agencia', contacto: '', telefono: '', zona: '' });
      cargar();
    } finally { setSaving(false); }
  };

  const cambiarEstadoDespacho = async (d: Despacho, estado: Despacho['estado']) => {
    const updates: any = { estado };
    if (estado === 'entregado') updates.fecha_entrega = new Date().toISOString();
    await supabase.from('distribucion_despachos').update(updates).eq('id', d.id);
    setDespachos(prev => prev.map(x => x.id === d.id ? { ...x, estado } : x));
  };

  // ── Reporte por agencia (PDF) ──
  const generarReporteAgencia = async (agenciaId: string) => {
    const agencia = agencias.find(a => a.id === agenciaId);
    const items = despachos.filter(d => d.agencia_id === agenciaId);
    if (items.length === 0) { alert('Esta agencia no tiene despachos registrados.'); return; }

    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();

    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(43, 98, 176);
    doc.text('Reporte de distribución', 14, 18);
    doc.setFontSize(11); doc.setTextColor(20, 28, 40);
    doc.text(agencia?.nombre || 'Agencia', 14, 26);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100, 110, 125);
    doc.text(`${agencia?.tipo === 'cadeteria_propia' ? 'Cadetería propia' : 'Agencia'}${agencia?.zona ? ' · ' + agencia.zona : ''}`, 14, 31);
    doc.text(`Generado: ${new Date().toLocaleString('es-UY')}`, W - 14, 18, { align: 'right' });
    doc.text(`Total de paquetes: ${items.length}`, W - 14, 24, { align: 'right' });

    autoTable(doc, {
      startY: 38,
      head: [['#', 'Despacho', 'Paquete', 'Cliente', 'Tracking', 'Bultos', 'Estado', 'Fecha']],
      body: items.map((d, i) => [
        String(i + 1), d.numero, d.paquete_numero || '-', d.cliente_nombre || '-',
        d.tracking_numero || '-', String(d.bultos), ESTADO_CFG[d.estado].label,
        new Date(d.fecha_registro).toLocaleDateString('es-UY'),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [43, 98, 176], textColor: 255, fontSize: 8.5 },
      bodyStyles: { fontSize: 8, textColor: [30, 38, 50] },
      margin: { left: 14, right: 14 },
    });

    const totalBultos = items.reduce((s, d) => s + (d.bultos || 0), 0);
    const afterY = (doc as any).lastAutoTable?.finalY || 50;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(20, 28, 40);
    doc.text(`Total de bultos: ${totalBultos}`, 14, afterY + 8);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 125, 135);
    doc.text('Conforme de recepción: __________________________', 14, afterY + 22);
    doc.text('Firma y aclaración de la agencia.', 14, afterY + 27);

    doc.output('dataurlnewwindow');
    await registrarAuditoria('distribucion_despachos', 'REPORTE_AGENCIA', agencia?.codigo || agenciaId, null, { paquetes: items.length }, user?.email || '');
  };

  const Card = ({ icon: Icon, label, value, color }: any) => (
    <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center gap-2 text-slate-500 text-xs mb-1"><Icon className="h-4 w-4" />{label}</div>
      <div className={`text-2xl font-bold ${color || 'text-slate-100'}`}>{value}</div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Truck className="h-6 w-6 text-slate-300" /> Distribución
          </h2>
          <p className="text-sm text-slate-500">Agencias, cadeterías y reporte de paquetes</p>
        </div>
        <button onClick={cargar} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Aviso: paquetes que el empaquetador despachó y esperan registro */}
      {paquetesDespachados.length > 0 && (
        <button onClick={() => setModal('despacho')}
          className="w-full flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-left hover:border-amber-500/50 transition-colors">
          <PackageCheck className="h-5 w-5 text-amber-400 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-amber-300">{paquetesDespachados.length} paquete(s) despachado(s) esperando registro</div>
            <div className="text-xs text-slate-400">El empaquetador los despachó. Registralos en la agencia/cadetería que los reparte.</div>
          </div>
          <Plus className="h-4 w-4 text-amber-400" />
        </button>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card icon={PackageCheck} label="Por registrar" value={paquetesDespachados.length} color={paquetesDespachados.length > 0 ? 'text-amber-400' : 'text-slate-100'} />
        <Card icon={Clock} label="Pendientes / en ruta" value={stats.enRuta} color="text-blue-400" />
        <Card icon={Truck} label="Total despachos" value={stats.total} />
        <Card icon={Building2} label="Agencias activas" value={stats.agencias} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-900/50 rounded-xl w-fit">
        {([['despachos', 'Despachos'], ['agencias', 'Agencias']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === id ? 'bg-blue-500/15 text-blue-400' : 'text-slate-400 hover:text-slate-200'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'despachos' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por paquete, cliente, tracking…"
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-200" />
            </div>
            <select value={filtroAgencia} onChange={e => setFiltroAgencia(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-200">
              <option value="todas">Todas las agencias</option>
              {agencias.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
            {filtroAgencia !== 'todas' && (
              <button onClick={() => generarReporteAgencia(filtroAgencia)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm">
                <FileDown className="h-4 w-4" /> Reporte de la agencia
              </button>
            )}
            <button onClick={() => setModal('despacho')}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm">
              <Plus className="h-4 w-4" /> Registrar paquete
            </button>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
            {loading ? (
              <div className="py-10 text-center text-slate-500 text-sm">Cargando…</div>
            ) : despachosFiltrados.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-sm">Sin despachos. Tocá "Registrar paquete".</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-900/80 text-slate-400 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Despacho</th>
                    <th className="px-3 py-2 text-left">Agencia</th>
                    <th className="px-3 py-2 text-left">Paquete / Cliente</th>
                    <th className="px-3 py-2 text-center">Bultos</th>
                    <th className="px-3 py-2 text-center">Estado</th>
                    <th className="px-3 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {despachosFiltrados.map(d => (
                    <tr key={d.id} className="hover:bg-slate-800/30">
                      <td className="px-3 py-2">
                        <div className="text-slate-200 font-mono text-xs">{d.numero}</div>
                        <div className="text-[11px] text-slate-500">{new Date(d.fecha_registro).toLocaleDateString('es-UY')}</div>
                      </td>
                      <td className="px-3 py-2 text-slate-300">{d.agencia_nombre || '-'}</td>
                      <td className="px-3 py-2">
                        <div className="text-slate-300">{d.paquete_numero || d.tracking_numero || '-'}</div>
                        <div className="text-[11px] text-slate-500">{d.cliente_nombre || ''}</div>
                      </td>
                      <td className="px-3 py-2 text-center text-slate-300">{d.bultos}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${ESTADO_CFG[d.estado].cls}`}>{ESTADO_CFG[d.estado].label}</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <select value={d.estado} onChange={e => cambiarEstadoDespacho(d, e.target.value as Despacho['estado'])}
                          className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200">
                          <option value="registrado">Registrado</option>
                          <option value="en_ruta">En ruta</option>
                          <option value="entregado">Entregado</option>
                          <option value="devuelto">Devuelto</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'agencias' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setModal('agencia')}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm">
              <Plus className="h-4 w-4" /> Nueva agencia / cadetería
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {agencias.map(a => (
              <div key={a.id} className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-slate-100 font-medium">{a.nombre}</div>
                    <div className="text-xs text-slate-500">{a.codigo} · {a.tipo === 'cadeteria_propia' ? 'Cadetería propia' : 'Agencia'}</div>
                  </div>
                  <Building2 className="h-5 w-5 text-slate-600" />
                </div>
                {(a.zona || a.telefono) && (
                  <div className="text-xs text-slate-500 mt-2 flex items-center gap-2">
                    {a.zona && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{a.zona}</span>}
                    {a.telefono && <span>{a.telefono}</span>}
                  </div>
                )}
                <button onClick={() => generarReporteAgencia(a.id)}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs">
                  <FileDown className="h-3.5 w-3.5" /> Reporte de paquetes
                </button>
              </div>
            ))}
            {agencias.length === 0 && !loading && (
              <div className="col-span-full py-8 text-center text-slate-500 text-sm">Sin agencias. Creá la primera.</div>
            )}
          </div>
        </div>
      )}

      {/* Modal registrar despacho */}
      {modal === 'despacho' && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-100">Registrar paquete en agencia</h3>
              <button onClick={() => setModal(null)} className="text-slate-500 hover:text-slate-200"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              {/* Elegir un paquete despachado por el empaquetador (autocompleta). */}
              {paquetesDespachados.length > 0 && (
                <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-3">
                  <label className="block text-sm text-blue-300 mb-1">Paquete despachado por el empaquetador</label>
                  <select
                    value={despForm.paquete_id}
                    onChange={e => {
                      const pkg = paquetesDespachados.find(p => p.id === e.target.value);
                      if (pkg) {
                        setDespForm(f => ({
                          ...f,
                          paquete_id: pkg.id,
                          paquete_numero: pkg.numero,
                          cliente_nombre: pkg.cliente_nombre || '',
                          tracking_numero: pkg.tracking_numero || '',
                          peso_kg: pkg.peso_kg ? String(pkg.peso_kg) : '',
                        }));
                      } else {
                        setDespForm(f => ({ ...f, paquete_id: '', paquete_numero: '', cliente_nombre: '', tracking_numero: '', peso_kg: '' }));
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                    <option value="">Elegir paquete despachado…</option>
                    {paquetesDespachados.map(p => (
                      <option key={p.id} value={p.id}>{p.numero}{p.cliente_nombre ? ` · ${p.cliente_nombre}` : ''}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">O cargá los datos manualmente abajo si el paquete no figura.</p>
                </div>
              )}
              {/* Pedidos facturados (Factura de pedidos) listos para asignar.
                  Al elegir uno se autocompleta el cliente y se asigna la
                  AGENCIA DEL CLIENTE automáticamente (editable). */}
              {pedidosFacturados.length > 0 && (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
                  <label className="block text-sm text-emerald-300 mb-1">Pedido facturado (sin paquete)</label>
                  <select
                    value={despForm.orden_venta_numero}
                    onChange={e => {
                      const ped = pedidosFacturados.find(p => p.numero === e.target.value);
                      if (ped) {
                        setDespForm(f => ({
                          ...f,
                          orden_venta_numero: ped.numero,
                          cliente_nombre: ped.cliente_nombre,
                          // Agencia del cliente → asignación automática.
                          agencia_id: ped.agencia_id || f.agencia_id,
                        }));
                      } else {
                        setDespForm(f => ({ ...f, orden_venta_numero: '' }));
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                    <option value="">Elegir pedido facturado…</option>
                    {pedidosFacturados.map(p => (
                      <option key={p.id} value={p.numero}>{p.numero} · {p.cliente_nombre}{p.agencia_id ? ' (con agencia del cliente)' : ''}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">Si el cliente tiene agencia asignada, se selecciona sola.</p>
                </div>
              )}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Agencia / cadetería *</label>
                <select value={despForm.agencia_id} onChange={e => setDespForm({ ...despForm, agencia_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                  <option value="">Seleccionar…</option>
                  {agenciasActivas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Nº paquete</label>
                  <input value={despForm.paquete_numero} onChange={e => setDespForm({ ...despForm, paquete_numero: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" placeholder="PKG-…" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Tracking</label>
                  <input value={despForm.tracking_numero} onChange={e => setDespForm({ ...despForm, tracking_numero: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Cliente</label>
                  <input value={despForm.cliente_nombre} onChange={e => setDespForm({ ...despForm, cliente_nombre: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Nº orden de venta</label>
                  <input value={despForm.orden_venta_numero} onChange={e => setDespForm({ ...despForm, orden_venta_numero: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" placeholder="OV-…" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Bultos</label>
                  <input type="number" min="1" value={despForm.bultos} onChange={e => setDespForm({ ...despForm, bultos: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Peso (kg)</label>
                  <input type="number" step="0.1" value={despForm.peso_kg} onChange={e => setDespForm({ ...despForm, peso_kg: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notas</label>
                <input value={despForm.notas} onChange={e => setDespForm({ ...despForm, notas: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={guardarDespacho} disabled={!despForm.agencia_id || saving}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2">
                <CheckCircle className="h-4 w-4" /> Registrar
              </button>
              <button onClick={() => setModal(null)} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nueva agencia */}
      {modal === 'agencia' && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-100">Nueva agencia / cadetería</h3>
              <button onClick={() => setModal(null)} className="text-slate-500 hover:text-slate-200"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Código *</label>
                  <input value={agForm.codigo} onChange={e => setAgForm({ ...agForm, codigo: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Tipo</label>
                  <select value={agForm.tipo} onChange={e => setAgForm({ ...agForm, tipo: e.target.value as Agencia['tipo'] })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100">
                    <option value="agencia">Agencia</option>
                    <option value="cadeteria_propia">Cadetería propia</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Nombre *</label>
                <input value={agForm.nombre} onChange={e => setAgForm({ ...agForm, nombre: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Zona</label>
                  <input value={agForm.zona} onChange={e => setAgForm({ ...agForm, zona: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Teléfono</label>
                  <input value={agForm.telefono} onChange={e => setAgForm({ ...agForm, telefono: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={guardarAgencia} disabled={!agForm.codigo || !agForm.nombre || saving}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl">Crear</button>
              <button onClick={() => setModal(null)} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
