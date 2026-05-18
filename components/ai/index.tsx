'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { aiApi } from '@/lib/ai-api';
import { cn } from '@/lib/utils';
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  ShoppingCart,
  RefreshCw,
  Loader2,
  Activity,
  ArrowRight,
  Clock,
  ShieldAlert,
  Zap,
  Package,
  type LucideIcon,
} from 'lucide-react';

// ============================================
// SHARED STYLES
// ============================================

// Clases Tailwind para compatibilidad con light-mode (los CSS overrides
// catchean slate-*). Antes usaba style={{ background: linear-gradient(...) }}
// inline, lo que rompía el modo claro.
const panelClasses = 'bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors';

const panelHoverGlow = (color: string) => ({
  background: `radial-gradient(ellipse at 50% 0%, ${color}, transparent 70%)`,
});

// ============================================
// AI STATUS BADGE
// ============================================

export function AIStatusBadge() {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const online = await aiApi.healthCheck();
        setIsOnline(online);
      } catch {
        setIsOnline(false);
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2 text-sm">
      <div
        className={cn(
          'w-2 h-2 rounded-full',
          isOnline === null
            ? 'bg-slate-500'
            : isOnline
            ? 'bg-emerald-500 animate-pulse'
            : 'bg-red-500'
        )}
      />
      <span className="text-slate-400">
        {isOnline === null
          ? t('common.loading')
          : isOnline
          ? t('ai.active')
          : 'IA Offline'}
      </span>
    </div>
  );
}

// ============================================
// SHARED: PANEL SHELL
// ============================================

interface PanelShellProps {
  title: string;
  icon: LucideIcon;
  accentColor: string;
  loading: boolean;
  onRefresh: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

function PanelShell({
  title,
  icon: Icon,
  accentColor,
  loading,
  onRefresh,
  footer,
  children,
}: PanelShellProps) {
  return (
    <div className={cn('relative rounded-xl overflow-hidden group', panelClasses)}>
      {/* Accent line at top */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{ background: accentColor }}
      />

      <div className="relative p-5">
        {/* Header — título más grande y ejecutivo */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className="inline-flex p-2 rounded-lg"
              style={{ background: `${accentColor}1A` }}
            >
              <Icon size={18} style={{ color: accentColor }} />
            </div>
            <h3 className="text-base font-semibold text-slate-100 tracking-tight">
              {title}
            </h3>
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" style={{ color: accentColor }} />
            ) : (
              <RefreshCw size={14} />
            )}
          </button>
        </div>

        {/* Content */}
        {children}

        {/* Footer */}
        {footer && (
          <div className="mt-4 pt-3 text-xs text-slate-500 border-t border-slate-800/60">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// SHARED: URGENCY / SEVERITY CONFIG
// ============================================

interface SeverityStyle {
  /** clase Tailwind para texto (color principal) — compat light/dark mode */
  textClass: string;
  /** clase Tailwind para fondo del badge */
  bgClass: string;
  /** clase Tailwind para borde de la card */
  borderClass: string;
  label: string;
}

function getUrgencyStyle(urgencia: string, t: (key: string) => string): SeverityStyle {
  switch (urgencia) {
    case 'critica':
    case 'alta':
      return {
        textClass: 'text-red-400',
        bgClass: 'bg-red-500/10',
        borderClass: 'border-red-500/20',
        label: t('alerts.critical'),
      };
    case 'media':
      return {
        textClass: 'text-amber-400',
        bgClass: 'bg-amber-500/10',
        borderClass: 'border-amber-500/20',
        label: t('alerts.medium'),
      };
    case 'baja':
      return {
        textClass: 'text-amber-300',
        bgClass: 'bg-amber-500/5',
        borderClass: 'border-amber-500/15',
        label: t('alerts.low'),
      };
    default:
      return {
        textClass: 'text-slate-400',
        bgClass: 'bg-slate-800/30',
        borderClass: 'border-slate-700/30',
        label: urgencia,
      };
  }
}

// ============================================
// AI PREDICTIONS PANEL
// ============================================

interface PredictionsSummary {
  productos_criticos: Array<{
    codigo: string;
    descripcion: string;
    stock_actual: number;
    stock_minimo: number;
    consumo_diario: number;
    dias_restantes: number;
    urgencia: 'critica' | 'media' | 'baja';
  }>;
  total_analizado: number;
  total_criticos: number;
}

export function AIPredictionsPanel() {
  const { t } = useTranslation();
  const [data, setData] = useState<PredictionsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await aiApi.getPredictionsSummary();
      setData(result);
    } catch (err) {
      setError(t('common.loading'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const accentColor = '#836ba0'; // violet

  return (
    <PanelShell
      title={t('ai.predictions')}
      icon={Brain}
      accentColor={accentColor}
      loading={loading}
      onRefresh={fetchData}
      footer={
        data ? (
          <span>
            {data.total_criticos}{' '}
            {t('ai.analyzedProducts').replace(
              '{total}',
              data.total_analizado.toString()
            )}
          </span>
        ) : null
      }
    >
      {error && (
        <div className="p-3 rounded-lg text-sm mb-3 bg-red-500/10 text-red-300 border border-red-500/20">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={20} className="animate-spin" style={{ color: accentColor }} />
        </div>
      ) : data && data.productos_criticos.length > 0 ? (
        <div
          className="space-y-2 max-h-[280px] overflow-y-auto pr-1"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(51,65,85,0.4) transparent' }}
        >
          {data.productos_criticos.map((producto) => {
            const sev = getUrgencyStyle(producto.urgencia, t);
            const daysBarWidth = Math.min(
              100,
              Math.max(5, (producto.dias_restantes / 30) * 100)
            );
            return (
              <div
                key={producto.codigo}
                className={cn('p-3 rounded-lg border transition-colors', sev.bgClass, sev.borderClass)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1 mr-2">
                    <div className="font-medium text-sm text-slate-100 truncate">
                      {producto.descripcion}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-mono text-slate-500">
                        {producto.codigo}
                      </span>
                      <span className={cn(
                        'text-xs px-1.5 py-0.5 rounded font-semibold',
                        sev.bgClass, sev.textClass,
                      )}>
                        {sev.label}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={cn('text-base font-bold font-mono tabular-nums', sev.textClass)}>
                      {producto.dias_restantes.toFixed(0)}d
                    </div>
                    <div className="text-xs text-slate-500 tabular-nums">
                      {producto.consumo_diario.toFixed(1)}/día
                    </div>
                  </div>
                </div>
                <div className="h-1 rounded-full overflow-hidden bg-slate-800/30">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', sev.textClass.replace('text-', 'bg-'))}
                    style={{ width: `${daysBarWidth}%`, opacity: 0.5 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-10">
          <TrendingUp size={24} className="mx-auto mb-2" />
          <p className="text-xs text-slate-500">
            {t('ai.noCriticalProducts')}
          </p>
        </div>
      )}
    </PanelShell>
  );
}

// ============================================
// AI ANOMALIES PANEL
// ============================================

interface Anomaly {
  id: string;
  codigo: string;
  descripcion: string;
  tipo: string;
  cantidad: number;
  fecha: string;
  usuario: string;
  anomaly_score: number;
  razon: string;
  severidad: 'alta' | 'media' | 'baja';
}

interface AnomaliesData {
  anomalias: Anomaly[];
  total_analizado: number;
  total_anomalias: number;
}

export function AIAnomaliesPanel() {
  const { t } = useTranslation();
  const [data, setData] = useState<AnomaliesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await aiApi.detectAnomalies(30);
      setData(result);
    } catch (err) {
      setError(t('common.loading'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const accentColor = '#dfa6a6'; // rose

  return (
    <PanelShell
      title={t('ai.anomalies')}
      icon={ShieldAlert}
      accentColor={accentColor}
      loading={loading}
      onRefresh={fetchData}
      footer={
        data ? (
          <span>
            {data.total_anomalias}{' '}
            {t('ai.analyzedMovements').replace(
              '{total}',
              data.total_analizado.toString()
            )}
          </span>
        ) : null
      }
    >
      {error && (
        <div className="p-3 rounded-lg text-sm mb-3 bg-red-500/10 text-red-300 border border-red-500/20">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={20} className="animate-spin" style={{ color: accentColor }} />
        </div>
      ) : data && data.anomalias.length > 0 ? (
        <div
          className="space-y-2 max-h-[280px] overflow-y-auto pr-1"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(51,65,85,0.4) transparent' }}
        >
          {data.anomalias.slice(0, 8).map((anomaly, index) => {
            const sev = getUrgencyStyle(anomaly.severidad, t);
            // Anomaly score as visual bar (0 to 1)
            const scoreWidth = Math.round(
              Math.min(100, Math.max(10, anomaly.anomaly_score * 100))
            );
            return (
              <div
                key={`${anomaly.id}-${index}`}
                className={cn('p-3 rounded-lg border transition-colors', sev.bgClass, sev.borderClass)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1 mr-2">
                    <div className="font-medium text-sm text-slate-100 truncate">
                      {anomaly.descripcion}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500 tabular-nums">
                        {anomaly.tipo}: {anomaly.cantidad} uds
                      </span>
                    </div>
                  </div>
                  <span className={cn(
                    'text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0',
                    sev.bgClass, sev.textClass,
                  )}>
                    {sev.label}
                  </span>
                </div>
                <p className="text-xs leading-relaxed mb-2 text-slate-400">
                  {anomaly.razon}
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full overflow-hidden bg-slate-800/30">
                    <div
                      className={cn('h-full rounded-full', sev.textClass.replace('text-', 'bg-'))}
                      style={{ width: `${scoreWidth}%`, opacity: 0.5 }}
                    />
                  </div>
                  <span className="text-xs font-mono tabular-nums text-slate-500">
                    {(anomaly.anomaly_score * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-10">
          <Activity size={24} className="mx-auto mb-2" />
          <p className="text-xs text-slate-500">
            {t('ai.noAnomalies')}
          </p>
        </div>
      )}
    </PanelShell>
  );
}

// ============================================
// AI ASSOCIATIONS PANEL
// ============================================

interface AssociationRule {
  si_compran: Array<{ codigo: string; descripcion: string }>;
  tambien_compran: Array<{ codigo: string; descripcion: string }>;
  confianza: number;
  interpretacion: string;
}

interface AssociationsData {
  reglas: AssociationRule[];
  total_transacciones: number;
}

export function AIAssociationsPanel() {
  const { t } = useTranslation();
  const [data, setData] = useState<AssociationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await aiApi.getAssociationRules(0.05, 0.3, 90);
      setData(result);
    } catch (err) {
      setError(t('common.loading'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const accentColor = '#4a7fb5'; // cyan

  return (
    <PanelShell
      title={t('ai.associations')}
      icon={Zap}
      accentColor={accentColor}
      loading={loading}
      onRefresh={fetchData}
      footer={
        data ? (
          <span>
            {data.reglas.length > 0
              ? `${data.reglas.length} reglas · ${data.total_transacciones} transacciones`
              : `${(data as any).total_movimientos || data.total_transacciones || 0} movimientos`}
          </span>
        ) : null
      }
    >
      {error && (
        <div className="p-3 rounded-lg text-sm mb-3 bg-red-500/10 text-red-300 border border-red-500/20">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={20} className="animate-spin" style={{ color: accentColor }} />
        </div>
      ) : data && data.reglas.length > 0 ? (
        <div
          className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(51,65,85,0.4) transparent' }}
        >
          {data.reglas.slice(0, 6).map((rule, index) => {
            const confidenceWidth = Math.round(rule.confianza * 100);
            return (
              <div
                key={index}
                className="p-3 rounded-lg border border-cyan-500/15 bg-cyan-500/5 transition-colors"
              >
                {/* Association flow */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-cyan-300 truncate">
                      {rule.si_compran[0]?.descripcion || rule.si_compran[0]?.codigo}
                    </div>
                    <div className="text-xs font-mono">
                      {rule.si_compran[0]?.codigo}
                    </div>
                  </div>
                  <ArrowRight size={14} className="flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-emerald-300 truncate">
                      {rule.tambien_compran[0]?.descripcion || rule.tambien_compran[0]?.codigo}
                    </div>
                    <div className="text-xs font-mono">
                      {rule.tambien_compran[0]?.codigo}
                    </div>
                  </div>
                </div>

                {/* Confidence bar */}
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-slate-500">
                    {t('common.confidence', 'Confianza')}
                  </span>
                  <div
                    className="flex-1 h-1 rounded-full overflow-hidden bg-slate-800/30"
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${confidenceWidth}%`,
                        background: 'linear-gradient(90deg, #4a7fb5, #9ec9b1)',
                      }}
                    />
                  </div>
                  <span
                    className="text-xs font-mono font-semibold"
                    style={{ color: '#6b8baa' }}
                  >
                    {confidenceWidth}%
                  </span>
                </div>

                {/* Interpretation */}
                {rule.interpretacion && (
                  <p
                    className="text-xs mt-1.5 leading-relaxed text-slate-500"
                  >
                    {rule.interpretacion}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-10">
          <ShoppingCart size={24} className="mx-auto mb-2" />
          <p className="text-xs text-slate-500">
            {t('ai.noAssociations')}
          </p>
        </div>
      )}
    </PanelShell>
  );
}