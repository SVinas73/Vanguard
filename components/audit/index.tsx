'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Button } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import {
  History,
  User,
  Calendar,
  Package,
  Plus,
  Minus,
  Edit,
  Trash2,
  RefreshCw,
  Filter,
  ChevronDown,
  ArrowUpDown,
  Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

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

// ============================================
// AUDIT LOG PANEL
// ============================================

export function AuditLogPanel() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTabla, setFiltroTabla] = useState<string>('todas');
  const [filtroAccion, setFiltroAccion] = useState<string>('todas');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('auditoria')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (filtroTabla !== 'todas') {
        query = query.eq('tabla', filtroTabla);
      }
      if (filtroAccion !== 'todas') {
        query = query.eq('accion', filtroAccion);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filtroTabla, filtroAccion]);

  const getAccionIcon = (accion: string) => {
    switch (accion.toUpperCase()) {
      case 'CREAR':
        return <Plus size={14} className="text-emerald-400" />;
      case 'ACTUALIZAR':
        return <Edit size={14} className="text-amber-400" />;
      case 'ELIMINAR':
        return <Trash2 size={14} className="text-red-400" />;
      case 'ENTRADA':
        return <Plus size={14} className="text-cyan-400" />;
      case 'SALIDA':
        return <Minus size={14} className="text-orange-400" />;
      default:
        return <History size={14} className="text-slate-400" />;
    }
  };

  const getAccionColor = (accion: string) => {
    switch (accion.toUpperCase()) {
      case 'CREAR':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'ACTUALIZAR':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'ELIMINAR':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'ENTRADA':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case 'SALIDA':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getAccionLabel = (accion: string) => {
    switch (accion.toUpperCase()) {
      case 'CREAR':
        return t('audit.actions.create');
      case 'ACTUALIZAR':
        return t('audit.actions.update');
      case 'ELIMINAR':
        return t('audit.actions.delete');
      case 'ENTRADA':
        return t('movements.entry');
      case 'SALIDA':
        return t('movements.exit');
      default:
        return accion;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      fecha: date.toLocaleDateString('es-UY', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      }),
      hora: date.toLocaleTimeString('es-UY', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      })
    };
  };

  const renderChanges = (log: AuditLog) => {
    if (!log.datos_anteriores && !log.datos_nuevos) return null;

    return (
      <div className="mt-3 p-3 rounded-lg bg-slate-900/50 text-xs space-y-2">
        {log.datos_anteriores && (
          <div>
            <span className="text-slate-500">{t('audit.previousData')}:</span>
            <pre className="mt-1 text-red-400/70 overflow-x-auto">
              {JSON.stringify(log.datos_anteriores, null, 2)}
            </pre>
          </div>
        )}
        {log.datos_nuevos && (
          <div>
            <span className="text-slate-500">{t('audit.newData')}:</span>
            <pre className="mt-1 text-emerald-400/70 overflow-x-auto">
              {JSON.stringify(log.datos_nuevos, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <History className="text-purple-400" />
            {t('audit.title')}
          </h2>
          <p className="text-sm text-slate-500">
            {t('audit.description')}
          </p>
        </div>
        <Button onClick={fetchLogs} disabled={loading}>
          <RefreshCw size={16} className={cn(loading && 'animate-spin')} />
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-500" />
          <select
            value={filtroTabla}
            onChange={(e) => setFiltroTabla(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:border-purple-500"
          >
            <option value="todas">{t('audit.allTables')}</option>
            <option value="productos">{t('audit.tables.products')}</option>
            <option value="movimientos">{t('audit.tables.movements')}</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <ArrowUpDown size={14} className="text-slate-500" />
          <select
            value={filtroAccion}
            onChange={(e) => setFiltroAccion(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:border-purple-500"
          >
            <option value="todas">{t('audit.allActions')}</option>
            <option value="CREAR">{t('audit.actions.create')}</option>
            <option value="ACTUALIZAR">{t('audit.actions.update')}</option>
            <option value="ELIMINAR">{t('audit.actions.delete')}</option>
            <option value="ENTRADA">{t('movements.entry')}</option>
            <option value="SALIDA">{t('movements.exit')}</option>
          </select>
        </div>

        <div className="text-sm text-slate-500 flex items-center">
          {logs.length} {t('audit.records')}
        </div>
      </div>

      {/* Lista de logs */}
      <Card>
        {loading ? (
          <div className="text-center py-8">
            <RefreshCw size={24} className="animate-spin mx-auto text-purple-400" />
            <p className="text-slate-500 mt-2">{t('audit.loading')}</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <History size={32} className="mx-auto mb-2 opacity-50" />
            <p>{t('audit.noLogs')}</p>
          </div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto space-y-2 pr-2">
            {logs.map((log) => {
              const { fecha, hora } = formatDate(log.created_at);
              const isExpanded = expandedLog === log.id;

              return (
                <div
                  key={log.id}
                  className={cn(
                    'p-4 rounded-xl border transition-all',
                    'bg-slate-800/30 border-slate-700/30 hover:border-slate-600/50'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {/* Icono de acción */}
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center',
                        getAccionColor(log.accion)
                      )}>
                        {getAccionIcon(log.accion)}
                      </div>

                      {/* Info principal */}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            'px-2 py-0.5 rounded text-xs font-medium border',
                            getAccionColor(log.accion)
                          )}>
                            {getAccionLabel(log.accion)}
                          </span>
                          <span className="text-slate-400 text-sm">
                            {t('audit.in')} <span className="text-slate-300">{log.tabla}</span>
                          </span>
                          {log.codigo && (
                            <span className="flex items-center gap-1 text-sm">
                              <Package size={12} className="text-slate-500" />
                              <span className="font-mono text-cyan-400">{log.codigo}</span>
                            </span>
                          )}
                        </div>

                        {/* Usuario */}
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <User size={12} />
                            {log.usuario_email || t('audit.system')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {fecha} {hora}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Botón expandir */}
                    {(log.datos_anteriores || log.datos_nuevos) && (
                      <button
                        onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <Eye size={14} className={cn(
                          'transition-colors',
                          isExpanded ? 'text-purple-400' : 'text-slate-500'
                        )} />
                      </button>
                    )}
                  </div>

                  {/* Detalles expandidos */}
                  {isExpanded && renderChanges(log)}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}