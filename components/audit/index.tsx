'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import {
  History, User, Calendar, Package, Plus, Minus, Edit, Trash2,
  RefreshCw, Filter, Search, ChevronDown, ChevronUp, Eye,
  ArrowLeftRight, Download, ChevronLeft, ChevronRight,
  Shield, Truck, ShoppingCart, ShoppingBag, RotateCcw,
  Wrench, FolderKanban, Clock, AlertTriangle, FileText,
} from 'lucide-react';

interface AuditLog {
  id: string;
  tabla: string;
  accion: string;
  codigo: string;
  datos_anteriores: any;
  datos_nuevos: any;
  usuario_email: string;
  created_at: string;
}

const PAGE_SIZE = 50;

const TABLA_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  productos: { label: 'Productos', icon: <Package size={14} />, color: 'text-blue-400' },
  movimientos: { label: 'Movimientos', icon: <ArrowLeftRight size={14} />, color: 'text-cyan-400' },
  transferencias: { label: 'Transferencias', icon: <Truck size={14} />, color: 'text-purple-400' },
  ordenes_compra: { label: 'Compras', icon: <ShoppingCart size={14} />, color: 'text-blue-400' },
  ordenes_venta: { label: 'Ventas', icon: <ShoppingBag size={14} />, color: 'text-emerald-400' },
  rma: { label: 'RMA', icon: <RotateCcw size={14} />, color: 'text-amber-400' },
  ordenes_taller: { label: 'Taller', icon: <Wrench size={14} />, color: 'text-slate-400' },
  proyecto_tareas: { label: 'Proyectos', icon: <FolderKanban size={14} />, color: 'text-purple-400' },
  almacenes: { label: 'Almacenes', icon: <Package size={14} />, color: 'text-amber-400' },
  lotes: { label: 'Lotes', icon: <FileText size={14} />, color: 'text-slate-400' },
  usuarios: { label: 'Usuarios', icon: <User size={14} />, color: 'text-pink-400' },
};

const ACCION_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  CREAR: { label: 'Crear', icon: <Plus size={12} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  ACTUALIZAR: { label: 'Actualizar', icon: <Edit size={12} />, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  ELIMINAR: { label: 'Eliminar', icon: <Trash2 size={12} />, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  ENTRADA: { label: 'Entrada', icon: <Plus size={12} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  SALIDA: { label: 'Salida', icon: <Minus size={12} />, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  ESTADO_PENDIENTE: { label: 'Pendiente', icon: <Clock size={12} />, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  ESTADO_EN_TRANSITO: { label: 'En Tránsito', icon: <Truck size={12} />, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  ESTADO_COMPLETADA: { label: 'Completada', icon: <ChevronRight size={12} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  ESTADO_CANCELADA: { label: 'Cancelada', icon: <Trash2 size={12} />, color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' },
};

function getAccionCfg(accion: string) {
  return ACCION_CONFIG[accion.toUpperCase()] || {
    label: accion,
    icon: <History size={12} />,
    color: 'text-slate-400',
    bg: 'bg-slate-500/10 border-slate-500/20',
  };
}

function getTablaCfg(tabla: string) {
  return TABLA_CONFIG[tabla] || { label: tabla, icon: <FileText size={14} />, color: 'text-slate-400' };
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return {
    fecha: d.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    hora: d.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    relative: getRelativeTime(d),
  };
}

function getRelativeTime(date: Date) {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `hace ${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'ayer';
  if (diffD < 7) return `hace ${diffD}d`;
  return '';
}

export function AuditLogPanel() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // Filters
  const [filtroTabla, setFiltroTabla] = useState('todas');
  const [filtroAccion, setFiltroAccion] = useState('todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // UI
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // Discover available tables and actions from data
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [availableActions, setAvailableActions] = useState<string[]>([]);

  const fetchMeta = useCallback(async () => {
    const [tablesRes, actionsRes] = await Promise.all([
      supabase.from('auditoria').select('tabla').limit(1000),
      supabase.from('auditoria').select('accion').limit(1000),
    ]);
    if (tablesRes.data) {
      const unique = [...new Set(tablesRes.data.map((r: any) => r.tabla))].sort();
      setAvailableTables(unique);
    }
    if (actionsRes.data) {
      const unique = [...new Set(actionsRes.data.map((r: any) => r.accion))].sort();
      setAvailableActions(unique);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('auditoria')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filtroTabla !== 'todas') query = query.eq('tabla', filtroTabla);
      if (filtroAccion !== 'todas') query = query.eq('accion', filtroAccion);
      if (searchQuery.trim()) {
        const q = `%${searchQuery.trim()}%`;
        query = query.or(`codigo.ilike.${q},usuario_email.ilike.${q}`);
      }
      if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`);
      if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`);

      const { data, error: err, count } = await query;
      if (err) {
        setError('No se pudieron cargar los registros de auditoría.');
        return;
      }
      setLogs(data || []);
      setTotalCount(count || 0);
    } catch {
      setError('Error al cargar auditoría.');
    } finally {
      setLoading(false);
    }
  }, [filtroTabla, filtroAccion, searchQuery, dateFrom, dateTo, page]);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => { setPage(0); }, [filtroTabla, filtroAccion, searchQuery, dateFrom, dateTo]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Stats
  const stats = useMemo(() => {
    return {
      total: totalCount,
    };
  }, [totalCount]);

  // Export CSV
  const handleExport = useCallback(async () => {
    let query = supabase
      .from('auditoria')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (filtroTabla !== 'todas') query = query.eq('tabla', filtroTabla);
    if (filtroAccion !== 'todas') query = query.eq('accion', filtroAccion);
    if (searchQuery.trim()) {
      const q = `%${searchQuery.trim()}%`;
      query = query.or(`codigo.ilike.${q},usuario_email.ilike.${q}`);
    }
    if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`);
    if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`);

    const { data } = await query;
    if (!data || data.length === 0) return;

    const headers = ['Fecha', 'Hora', 'Sección', 'Acción', 'Código', 'Usuario', 'Datos Anteriores', 'Datos Nuevos'];
    const rows = data.map((log: AuditLog) => {
      const { fecha, hora } = formatDateTime(log.created_at);
      return [
        fecha,
        hora,
        log.tabla,
        log.accion,
        log.codigo || '',
        log.usuario_email || '',
        JSON.stringify(log.datos_anteriores || ''),
        JSON.stringify(log.datos_nuevos || ''),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';');
    });

    const csv = [headers.join(';'), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtroTabla, filtroAccion, searchQuery, dateFrom, dateTo]);

  const renderDiff = (log: AuditLog) => {
    const antes = log.datos_anteriores;
    const despues = log.datos_nuevos;
    if (!antes && !despues) return <p className="text-xs text-slate-500 italic">Sin datos de cambio</p>;

    const allKeys = new Set([
      ...Object.keys(antes || {}),
      ...Object.keys(despues || {}),
    ]);

    const changedKeys = [...allKeys].filter(key => {
      const a = JSON.stringify(antes?.[key]);
      const b = JSON.stringify(despues?.[key]);
      return a !== b;
    });

    if (changedKeys.length === 0 && antes && despues) {
      return <p className="text-xs text-slate-500 italic">Sin diferencias detectadas</p>;
    }

    return (
      <div className="space-y-1.5">
        {changedKeys.map(key => (
          <div key={key} className="flex items-start gap-2 text-xs">
            <span className="font-mono text-slate-500 min-w-[120px] flex-shrink-0">{key}:</span>
            {antes?.[key] !== undefined && (
              <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 line-through font-mono">
                {typeof antes[key] === 'object' ? JSON.stringify(antes[key]) : String(antes[key])}
              </span>
            )}
            {antes?.[key] !== undefined && despues?.[key] !== undefined && (
              <span className="text-slate-600">→</span>
            )}
            {despues?.[key] !== undefined && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">
                {typeof despues[key] === 'object' ? JSON.stringify(despues[key]) : String(despues[key])}
              </span>
            )}
          </div>
        ))}
        {!antes && despues && (
          <pre className="text-emerald-400/70 text-xs font-mono bg-emerald-500/5 p-2 rounded-lg overflow-x-auto">
            {JSON.stringify(despues, null, 2)}
          </pre>
        )}
        {antes && !despues && (
          <pre className="text-red-400/70 text-xs font-mono bg-red-500/5 p-2 rounded-lg overflow-x-auto">
            {JSON.stringify(antes, null, 2)}
          </pre>
        )}
      </div>
    );
  };

  const clearFilters = () => {
    setFiltroTabla('todas');
    setFiltroAccion('todas');
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = filtroTabla !== 'todas' || filtroAccion !== 'todas' || searchQuery.trim() || dateFrom || dateTo;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <Shield size={22} className="text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Auditoría del Sistema</h2>
            <p className="text-sm text-slate-500">Registro completo de todas las acciones · {totalCount.toLocaleString()} registros</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/50 text-xs text-slate-300 transition-colors"
            title="Exportar CSV"
          >
            <Download size={14} /> Exportar
          </button>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/50 text-slate-400 transition-colors"
          >
            <RefreshCw size={16} className={cn(loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Section filter chips */}
      <div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-medium">Secciones</div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFiltroTabla('todas')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              filtroTabla === 'todas'
                ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'
            )}
          >
            Todas
          </button>
          {availableTables.map(tabla => {
            const cfg = getTablaCfg(tabla);
            const isActive = filtroTabla === tabla;
            return (
              <button
                key={tabla}
                onClick={() => setFiltroTabla(isActive ? 'todas' : tabla)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  isActive
                    ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                    : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'
                )}
              >
                {cfg.icon} {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search + Filters row */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por código o usuario..."
            className="w-full px-4 py-2.5 pl-10 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-600"
          />
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        </div>

        <select
          value={filtroAccion}
          onChange={(e) => setFiltroAccion(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-slate-600"
        >
          <option value="todas">Todas las acciones</option>
          {availableActions.map(a => {
            const cfg = getAccionCfg(a);
            return <option key={a} value={a}>{cfg.label}</option>;
          })}
        </select>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-slate-600"
          />
          <span className="text-slate-600 text-xs">a</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-slate-600"
          />
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={24} className="animate-spin text-purple-400" />
        </div>
      ) : error ? (
        <div className="p-8 text-center rounded-xl border border-red-500/20 bg-red-500/5">
          <AlertTriangle size={24} className="mx-auto mb-2 text-red-400" />
          <p className="text-red-400 text-sm mb-3">{error}</p>
          <button onClick={fetchLogs} className="px-4 py-2 rounded-lg bg-slate-800 text-sm text-slate-300 hover:bg-slate-700 transition-colors">
            Reintentar
          </button>
        </div>
      ) : logs.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-dashed border-slate-800">
          <History size={32} className="mx-auto text-slate-700 mb-3" />
          <p className="text-slate-500 text-sm">
            {hasActiveFilters ? 'No se encontraron registros con estos filtros' : 'No hay registros de auditoría'}
          </p>
        </div>
      ) : (
        <>
          {/* Log entries */}
          <div className="space-y-1.5">
            {logs.map((log) => {
              const { fecha, hora, relative } = formatDateTime(log.created_at);
              const isExpanded = expandedLog === log.id;
              const accionCfg = getAccionCfg(log.accion);
              const tablaCfg = getTablaCfg(log.tabla);

              return (
                <div
                  key={log.id}
                  className={cn(
                    'rounded-xl border transition-all',
                    isExpanded
                      ? 'bg-slate-900 border-slate-700'
                      : 'bg-slate-900/50 border-slate-800/50 hover:border-slate-700/50'
                  )}
                >
                  <button
                    onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                    className="w-full p-3.5 text-left"
                  >
                    <div className="flex items-center gap-3">
                      {/* Action icon */}
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center border flex-shrink-0', accionCfg.bg)}>
                        <span className={accionCfg.color}>{accionCfg.icon}</span>
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn('px-2 py-0.5 rounded border text-[10px] font-semibold uppercase', accionCfg.bg, accionCfg.color)}>
                            {accionCfg.label}
                          </span>
                          <span className={cn('flex items-center gap-1 text-xs', tablaCfg.color)}>
                            {tablaCfg.icon} {tablaCfg.label}
                          </span>
                          {log.codigo && (
                            <span className="font-mono text-xs text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">
                              {log.codigo}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <User size={10} />
                            {log.usuario_email || 'Sistema'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {fecha} {hora}
                          </span>
                          {relative && <span className="text-slate-600">{relative}</span>}
                        </div>
                      </div>

                      {/* Expand indicator */}
                      {(log.datos_anteriores || log.datos_nuevos) && (
                        <div className={cn('p-1 rounded transition-colors flex-shrink-0', isExpanded ? 'text-purple-400' : 'text-slate-600')}>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Expanded diff */}
                  {isExpanded && (
                    <div className="px-3.5 pb-3.5 pt-0">
                      <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/30">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-medium">Cambios realizados</div>
                        {renderDiff(log)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                {(page * PAGE_SIZE + 1).toLocaleString()}-{Math.min((page + 1) * PAGE_SIZE, totalCount).toLocaleString()} de {totalCount.toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-2 rounded-lg bg-slate-800 border border-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs text-slate-400 min-w-[80px] text-center">
                  Pág. {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-2 rounded-lg bg-slate-800 border border-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
