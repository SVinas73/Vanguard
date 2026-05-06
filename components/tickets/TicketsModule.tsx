'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Headphones, Plus, Search, RefreshCw, X, MessageSquare,
  AlertTriangle, Clock, CheckCircle, XCircle, Eye,
  User, Calendar, Send, ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import {
  crearTicket, cambiarEstadoTicket, asignarTicket, agregarComentario,
  type Ticket, type EstadoTicket, type PrioridadTicket, type CategoriaTicket,
} from '@/lib/tickets';
import { useWmsToast } from '@/components/wms/useWmsToast';

const ESTADO_CONFIG: Record<EstadoTicket, { label: string; bg: string; color: string }> = {
  abierto:           { label: 'Abierto',           bg: 'bg-blue-500/15',    color: 'text-blue-300' },
  en_progreso:       { label: 'En progreso',       bg: 'bg-amber-500/15',   color: 'text-amber-300' },
  esperando_cliente: { label: 'Esp. cliente',      bg: 'bg-cyan-500/15',    color: 'text-cyan-300' },
  esperando_repuesto:{ label: 'Esp. repuesto',     bg: 'bg-purple-500/15',  color: 'text-purple-300' },
  resuelto:          { label: 'Resuelto',          bg: 'bg-emerald-500/15', color: 'text-emerald-300' },
  cerrado:           { label: 'Cerrado',           bg: 'bg-slate-500/15',   color: 'text-slate-300' },
  cancelado:         { label: 'Cancelado',         bg: 'bg-slate-500/15',   color: 'text-slate-400' },
};

const PRIORIDAD_CONFIG: Record<PrioridadTicket, { label: string; bg: string; color: string }> = {
  baja:    { label: 'Baja',    bg: 'bg-slate-500/15',  color: 'text-slate-300' },
  normal:  { label: 'Normal',  bg: 'bg-blue-500/15',   color: 'text-blue-300' },
  alta:    { label: 'Alta',    bg: 'bg-amber-500/15',  color: 'text-amber-300' },
  critica: { label: 'Crítica', bg: 'bg-red-500/15',    color: 'text-red-300' },
};

const CATEGORIA_OPTIONS: Array<{ value: CategoriaTicket; label: string }> = [
  { value: 'consulta',       label: 'Consulta' },
  { value: 'falla_producto', label: 'Falla de producto' },
  { value: 'reclamo',        label: 'Reclamo' },
  { value: 'pedido_info',    label: 'Pedido de información' },
  { value: 'cambio',         label: 'Cambio' },
  { value: 'devolucion',     label: 'Devolución' },
  { value: 'instalacion',    label: 'Instalación' },
  { value: 'otro',           label: 'Otro' },
];

export default function TicketsModule() {
  const { user } = useAuth(false);
  const toast = useWmsToast();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filtroEstado, setFiltroEstado] = useState<EstadoTicket | 'activos' | 'todos'>('activos');
  const [filtroPrioridad, setFiltroPrioridad] = useState<PrioridadTicket | 'todas'>('todas');
  const [search, setSearch] = useState('');
  const [vista, setVista] = useState<'lista' | 'nuevo' | 'detalle'>('lista');
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [comentarios, setComentarios] = useState<any[]>([]);
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [usuarios, setUsuarios] = useState<Array<{ email: string; nombre: string }>>([]);

  const [form, setForm] = useState({
    asunto: '',
    descripcion: '',
    cliente_nombre: '',
    cliente_email: '',
    cliente_telefono: '',
    canal: 'web' as const,
    categoria: 'consulta' as CategoriaTicket,
    prioridad: 'normal' as PrioridadTicket,
    asignado_a: '',
  });

  useEffect(() => { loadData(); loadUsers(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      let q = supabase.from('tickets_soporte').select('*')
        .order('prioridad', { ascending: false })
        .order('fecha_apertura', { ascending: true })
        .limit(200);
      const { data } = await q;
      setTickets((data || []) as Ticket[]);
    } finally { setLoading(false); }
  };

  const loadUsers = async () => {
    const { data } = await supabase.from('usuarios')
      .select('email, nombre')
      .eq('activo', true)
      .order('nombre');
    setUsuarios(data || []);
  };

  const loadComentarios = async (ticketId: string) => {
    const { data } = await supabase.from('tickets_comentarios')
      .select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true });
    setComentarios(data || []);
  };

  const filtrados = useMemo(() => {
    return tickets.filter(t => {
      if (filtroEstado === 'activos') {
        if (['cerrado', 'cancelado'].includes(t.estado)) return false;
      } else if (filtroEstado !== 'todos' && t.estado !== filtroEstado) return false;
      if (filtroPrioridad !== 'todas' && t.prioridad !== filtroPrioridad) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!(t.numero?.toLowerCase().includes(s) ||
              t.asunto?.toLowerCase().includes(s) ||
              t.cliente_nombre?.toLowerCase().includes(s) ||
              t.descripcion?.toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [tickets, filtroEstado, filtroPrioridad, search]);

  const stats = useMemo(() => {
    const abiertos = tickets.filter(t => t.estado === 'abierto').length;
    const enProgreso = tickets.filter(t => t.estado === 'en_progreso').length;
    const criticos = tickets.filter(t => !['cerrado', 'cancelado'].includes(t.estado) && t.prioridad === 'critica').length;
    const slaBreached = tickets.filter(t => {
      if (['cerrado', 'cancelado', 'resuelto'].includes(t.estado)) return false;
      return t.sla_vencimiento && new Date(t.sla_vencimiento) < new Date();
    }).length;
    return { abiertos, enProgreso, criticos, slaBreached };
  }, [tickets]);

  const guardarTicket = async () => {
    if (!form.asunto.trim()) {
      toast.warning('El asunto es obligatorio');
      return;
    }
    const t = await crearTicket({
      asunto: form.asunto,
      descripcion: form.descripcion,
      cliente_nombre: form.cliente_nombre || undefined,
      cliente_email: form.cliente_email || undefined,
      cliente_telefono: form.cliente_telefono || undefined,
      canal: form.canal,
      categoria: form.categoria,
      prioridad: form.prioridad,
      asignado_a: form.asignado_a || undefined,
      creado_por: user?.email || '',
    });
    if (t) {
      toast.success(`Ticket ${t.numero} creado`);
      setVista('lista');
      setForm({
        asunto: '', descripcion: '', cliente_nombre: '', cliente_email: '',
        cliente_telefono: '', canal: 'web', categoria: 'consulta',
        prioridad: 'normal', asignado_a: '',
      });
      loadData();
    } else toast.error('No se pudo crear el ticket');
  };

  const cambiarEstado = async (ticket: Ticket, nuevo: EstadoTicket) => {
    const ok = await cambiarEstadoTicket(ticket.id, nuevo, user?.email || '');
    if (ok) {
      toast.success(`Ticket ${ticket.numero} → ${nuevo}`);
      loadData();
      if (selected?.id === ticket.id) {
        const { data } = await supabase.from('tickets_soporte').select('*').eq('id', ticket.id).single();
        if (data) setSelected(data as Ticket);
      }
    }
  };

  const enviarComentario = async () => {
    if (!selected || !nuevoComentario.trim()) return;
    const ok = await agregarComentario(selected.id, user?.email || '', nuevoComentario, 'agente');
    if (ok) {
      setNuevoComentario('');
      loadComentarios(selected.id);
      // Si es el primer touch, marcar primera respuesta
      if (!selected.fecha_primera_respuesta && selected.estado === 'abierto') {
        await cambiarEstadoTicket(selected.id, 'en_progreso', user?.email || '');
        loadData();
      }
    }
  };

  const verDetalle = (t: Ticket) => {
    setSelected(t);
    loadComentarios(t.id);
    setVista('detalle');
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12"><RefreshCw className="h-8 w-8 animate-spin text-blue-400" /></div>;
  }

  // ========== DETALLE ==========
  if (vista === 'detalle' && selected) {
    const slaVencido = selected.sla_vencimiento && new Date(selected.sla_vencimiento) < new Date()
      && !['cerrado', 'cancelado', 'resuelto'].includes(selected.estado);
    const cfgEstado = ESTADO_CONFIG[selected.estado];
    const cfgPrio = PRIORIDAD_CONFIG[selected.prioridad];

    return (
      <div className="space-y-6">
        <toast.Toast />
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Headphones className="h-6 w-6 text-blue-400" />
              {selected.numero}
            </h3>
            <p className="text-sm text-slate-200 mt-1">{selected.asunto}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-medium', cfgEstado.bg, cfgEstado.color)}>{cfgEstado.label}</span>
              <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-medium', cfgPrio.bg, cfgPrio.color)}>Prioridad: {cfgPrio.label}</span>
              {slaVencido && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-300">
                  <AlertTriangle className="h-3 w-3" /> SLA vencido
                </span>
              )}
            </div>
          </div>
          <button onClick={() => { setVista('lista'); setSelected(null); }} className="p-2 hover:bg-slate-800 rounded-lg">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Columna principal: descripción + comentarios */}
          <div className="lg:col-span-2 space-y-4">
            {/* Descripción */}
            {selected.descripcion && (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Descripción</div>
                <div className="text-sm text-slate-200 whitespace-pre-line">{selected.descripcion}</div>
              </div>
            )}

            {/* Hilo de comentarios */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl">
              <div className="p-3 border-b border-slate-800 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-200">
                  Conversación ({comentarios.length})
                </span>
              </div>
              <div className="p-3 space-y-3 max-h-96 overflow-y-auto">
                {comentarios.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-500">
                    Sin comentarios todavía. Empezá la conversación abajo.
                  </div>
                ) : comentarios.map(c => (
                  <div key={c.id} className={cn(
                    'rounded-lg p-3',
                    c.rol === 'cliente' ? 'bg-blue-500/10 border border-blue-500/20' :
                    c.rol === 'sistema' ? 'bg-slate-800/30' :
                    'bg-slate-800/50',
                  )}>
                    <div className="flex items-center gap-2 mb-1">
                      <User className="h-3 w-3 text-slate-500" />
                      <span className="text-xs font-medium text-slate-300">
                        {c.autor || 'Sistema'}
                      </span>
                      {c.rol === 'cliente' && <span className="text-[10px] px-1 rounded bg-blue-500/20 text-blue-300">Cliente</span>}
                      <span className="ml-auto text-[10px] text-slate-500">
                        {new Date(c.created_at).toLocaleString('es-UY')}
                      </span>
                    </div>
                    <div className="text-sm text-slate-200 whitespace-pre-line">{c.contenido}</div>
                  </div>
                ))}
              </div>
              {!['cerrado', 'cancelado'].includes(selected.estado) && (
                <div className="p-3 border-t border-slate-800 flex gap-2">
                  <input
                    value={nuevoComentario}
                    onChange={e => setNuevoComentario(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviarComentario()}
                    placeholder="Escribí una respuesta..."
                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm"
                  />
                  <button
                    onClick={enviarComentario}
                    disabled={!nuevoComentario.trim()}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm flex items-center gap-1"
                  >
                    <Send className="h-3.5 w-3.5" /> Enviar
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar: acciones + datos */}
          <div className="space-y-3">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-2 text-sm">
              <Field label="Cliente" value={selected.cliente_nombre || '—'} />
              {selected.cliente_email && <Field label="Email" value={selected.cliente_email} />}
              {selected.cliente_telefono && <Field label="Teléfono" value={selected.cliente_telefono} />}
              <Field label="Canal" value={selected.canal} />
              <Field label="Categoría" value={CATEGORIA_OPTIONS.find(c => c.value === selected.categoria)?.label || selected.categoria || '—'} />
              <Field label="Asignado a" value={selected.asignado_a || 'Sin asignar'} />
              <Field label="Apertura" value={new Date(selected.fecha_apertura).toLocaleString('es-UY')} />
              {selected.sla_vencimiento && (
                <Field
                  label="SLA"
                  value={new Date(selected.sla_vencimiento).toLocaleString('es-UY')}
                  highlight={slaVencido ? 'text-red-300' : undefined}
                />
              )}
              {selected.fecha_primera_respuesta && (
                <Field label="1ª respuesta" value={new Date(selected.fecha_primera_respuesta).toLocaleString('es-UY')} />
              )}
              {selected.orden_venta_numero && (
                <Field label="OV referencia" value={selected.orden_venta_numero} />
              )}
              {selected.serial_numero && (
                <Field label="Serial" value={selected.serial_numero} />
              )}
            </div>

            {!['cerrado', 'cancelado'].includes(selected.estado) && (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Cambiar estado</div>
                {(['en_progreso', 'esperando_cliente', 'esperando_repuesto', 'resuelto', 'cerrado', 'cancelado'] as EstadoTicket[]).map(e => (
                  e !== selected.estado && (
                    <button
                      key={e}
                      onClick={() => cambiarEstado(selected, e)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                    >
                      <span>{ESTADO_CONFIG[e].label}</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )
                ))}
              </div>
            )}

            {!selected.asignado_a && (
              <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-3">
                <div className="text-xs text-amber-300 mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Sin asignar
                </div>
                <select
                  onChange={e => e.target.value && asignarTicket(selected.id, e.target.value, user?.email || '').then(ok => {
                    if (ok) { toast.success(`Asignado a ${e.target.value}`); loadData(); verDetalle({ ...selected, asignado_a: e.target.value }); }
                  })}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-xs"
                >
                  <option value="">Asignar a...</option>
                  {usuarios.map(u => <option key={u.email} value={u.email}>{u.nombre || u.email}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ========== NUEVO ==========
  if (vista === 'nuevo') {
    return (
      <div className="space-y-6">
        <toast.Toast />
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Plus className="h-6 w-6 text-blue-400" />
            Nuevo ticket de soporte
          </h3>
          <button onClick={() => setVista('lista')} className="p-2 hover:bg-slate-800 rounded-lg">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-4 max-w-2xl">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Asunto *</label>
            <input value={form.asunto} onChange={e => setForm({ ...form, asunto: e.target.value })}
              placeholder="Ej: Producto no enciende después de 2 días"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm" />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Descripción</label>
            <textarea rows={3} value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Detalles del problema, contexto, pasos para reproducir..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm resize-none" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Categoría</label>
              <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value as CategoriaTicket })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm">
                {CATEGORIA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Prioridad</label>
              <select value={form.prioridad} onChange={e => setForm({ ...form, prioridad: e.target.value as PrioridadTicket })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm">
                <option value="baja">Baja</option>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Canal</label>
              <select value={form.canal} onChange={e => setForm({ ...form, canal: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm">
                <option value="web">Web</option>
                <option value="email">Email</option>
                <option value="telefono">Teléfono</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="presencial">Presencial</option>
              </select>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-3">
            <h4 className="text-sm font-semibold text-slate-200 mb-2">Cliente</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nombre</label>
                <input value={form.cliente_nombre} onChange={e => setForm({ ...form, cliente_nombre: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Email</label>
                <input type="email" value={form.cliente_email} onChange={e => setForm({ ...form, cliente_email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Teléfono</label>
                <input value={form.cliente_telefono} onChange={e => setForm({ ...form, cliente_telefono: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Asignar a</label>
            <select value={form.asignado_a} onChange={e => setForm({ ...form, asignado_a: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm">
              <option value="">Sin asignar (decidir después)</option>
              {usuarios.map(u => <option key={u.email} value={u.email}>{u.nombre || u.email}</option>)}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button onClick={() => setVista('lista')} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm">Cancelar</button>
            <button onClick={guardarTicket} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm">Crear ticket</button>
          </div>
        </div>
      </div>
    );
  }

  // ========== LISTA ==========
  return (
    <div className="space-y-6">
      <toast.Toast />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Headphones className="h-6 w-6 text-blue-400" />
            Tickets de Soporte
          </h3>
          <p className="text-sm text-slate-400 mt-0.5">
            Atención post-venta · SLA · Conversación con el cliente
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={() => setVista('nuevo')}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg">
            <Plus className="h-4 w-4" />
            Nuevo ticket
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={Clock} label="Abiertos" value={stats.abiertos} color="text-blue-300" />
        <Kpi icon={RefreshCw} label="En progreso" value={stats.enProgreso} color="text-amber-300" />
        <Kpi icon={AlertTriangle} label="Críticos activos" value={stats.criticos} color="text-red-300" />
        <Kpi icon={XCircle} label="SLA vencido" value={stats.slaBreached} color="text-red-300" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por número, asunto, cliente..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm" />
        </div>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as any)}
          className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm">
          <option value="activos">Activos</option>
          <option value="todos">Todos</option>
          <option value="abierto">Abierto</option>
          <option value="en_progreso">En progreso</option>
          <option value="resuelto">Resuelto</option>
          <option value="cerrado">Cerrado</option>
        </select>
        <select value={filtroPrioridad} onChange={e => setFiltroPrioridad(e.target.value as any)}
          className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm">
          <option value="todas">Todas las prioridades</option>
          <option value="critica">Crítica</option>
          <option value="alta">Alta</option>
          <option value="normal">Normal</option>
          <option value="baja">Baja</option>
        </select>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 border-b border-slate-800">
              <tr className="text-left text-xs text-slate-400 uppercase">
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Asunto</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Prioridad</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">SLA</th>
                <th className="px-4 py-3">Asignado</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtrados.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-500 text-sm">Sin tickets</td></tr>
              ) : filtrados.map(t => {
                const cfgE = ESTADO_CONFIG[t.estado];
                const cfgP = PRIORIDAD_CONFIG[t.prioridad];
                const slaVenc = t.sla_vencimiento && new Date(t.sla_vencimiento) < new Date()
                  && !['cerrado', 'cancelado', 'resuelto'].includes(t.estado);
                return (
                  <tr key={t.id} className="hover:bg-slate-800/30 cursor-pointer" onClick={() => verDetalle(t)}>
                    <td className="px-4 py-3 font-mono text-slate-200 text-xs">{t.numero}</td>
                    <td className="px-4 py-3 text-slate-300 max-w-md truncate">{t.asunto}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{t.cliente_nombre || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-medium', cfgP.bg, cfgP.color)}>{cfgP.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-medium', cfgE.bg, cfgE.color)}>{cfgE.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      {slaVenc ? (
                        <span className="inline-flex items-center gap-1 text-xs text-red-300">
                          <AlertTriangle className="h-3 w-3" /> Vencido
                        </span>
                      ) : t.sla_vencimiento ? (
                        <span className="text-xs text-slate-500">
                          <Calendar className="h-3 w-3 inline mr-1" />
                          {new Date(t.sla_vencimiento).toLocaleDateString('es-UY')}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{t.asignado_a?.split('@')[0] || 'Sin asignar'}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-blue-400">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-400">{label}</span>
        <Icon className={cn('h-3.5 w-3.5', color)} />
      </div>
      <div className={cn('text-2xl font-bold', color)}>{value}</div>
    </div>
  );
}

function Field({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div>
      <span className="text-xs uppercase tracking-wider text-slate-500">{label}: </span>
      <span className={cn(highlight || 'text-slate-200', 'text-xs')}>{value}</span>
    </div>
  );
}
