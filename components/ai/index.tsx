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

const panelBase = {
  background: 'linear-gradient(135deg, rgba(30,33,40,0.95), rgba(24,27,35,0.9))',
  border: '1px solid rgba(46,50,61,0.6)',
} as const;

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
    <div
      className="relative rounded-2xl overflow-hidden group transition-all duration-300 hover:scale-[1.01]"
      style={panelBase}
    >
      {/* Top glow on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={panelHoverGlow(`${accentColor}08`)}
      />

      {/* Accent line at top */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${accentColor}40, transparent)`,
        }}
      />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className="p-2 rounded-xl"
              style={{ background: `${accentColor}12` }}
            >
              <Icon size={16} style={{ color: accentColor }} />
            </div>
            <div>
              <h3
                className="text-sm font-semibold"
                style={{ color: accentColor }}
              >
                {title}
              </h3>
            </div>
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1.5 rounded-lg transition-all"
            style={{ background: 'rgba(255,255,255,0.03)' }}
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" style={{ color: accentColor }} />
            ) : (
              <RefreshCw
                size={14}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              />
            )}
          </button>
        </div>

        {/* Content */}
        {children}

        {/* Footer */}
        {footer && (
          <div
            className="mt-4 pt-3 text-[11px]"
            style={{
              borderTop: '1px solid rgba(46,50,61,0.4)',
              color: 'rgba(148,163,184,0.4)',
            }}
          >
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
  color: string;
  bg: string;
  border: string;
  label: string;
}

function getUrgencyStyle(urgencia: string, t: (key: string) => string): SeverityStyle {
  switch (urgencia) {
    case 'critica':
    case 'alta':
      return {
        color: '#c94444',
        bg: 'rgba(201,68,68,0.08)',
        border: 'rgba(201,68,68,0.15)',
        label: t('alerts.critical'),
      };
    case 'media':
      return {
        color: '#c8872e',
        bg: 'rgba(200,135,46,0.08)',
        border: 'rgba(200,135,46,0.15)',
        label: t('alerts.medium'),
      };
    case 'baja':
      return {
        color: '#cc9a40',
        bg: 'rgba(204,154,64,0.08)',
        border: 'rgba(204,154,64,0.15)',
        label: t('alerts.low'),
      };
    default:
      return {
        color: '#94a3b8',
        bg: 'rgba(148,163,184,0.08)',
        border: 'rgba(148,163,184,0.15)',
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
        <div
          className="p-3 rounded-lg text-sm mb-3"
          style={{
            background: 'rgba(201,68,68,0.08)',
            color: '#cc5555',
          }}
        >
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
                className="p-3 rounded-xl transition-all hover:scale-[1.01]"
                style={{ background: sev.bg, border: `1px solid ${sev.border}` }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1 mr-2">
                    <div className="font-medium text-sm text-slate-200 truncate">
                      {producto.descripcion}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-mono" style={{ color: 'rgba(148,163,184,0.5)' }}>
                        {producto.codigo}
                      </span>
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                        style={{ background: sev.bg, color: sev.color }}
                      >
                        {sev.label}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold font-mono" style={{ color: sev.color }}>
                      {producto.dias_restantes.toFixed(0)}d
                    </div>
                    <div className="text-[10px]" style={{ color: 'rgba(148,163,184,0.4)' }}>
                      {producto.consumo_diario.toFixed(1)}/día
                    </div>
                  </div>
                </div>
                {/* Mini progress bar — days remaining visual */}
                <div
                  className="h-1 rounded-full overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.03)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${daysBarWidth}%`,
                      background: `linear-gradient(90deg, ${sev.color}, ${sev.color}44)`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-10">
          <TrendingUp size={24} className="mx-auto mb-2" style={{ color: 'rgba(148,163,184,0.2)' }} />
          <p className="text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>
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

  const accentColor = '#c94444'; // rose

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
        <div
          className="p-3 rounded-lg text-sm mb-3"
          style={{
            background: 'rgba(201,68,68,0.08)',
            color: '#cc5555',
          }}
        >
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
                className="p-3 rounded-xl transition-all hover:scale-[1.01]"
                style={{ background: sev.bg, border: `1px solid ${sev.border}` }}
              >
                <div className="flex items-start justify-between mb-1.5">
                  <div className="min-w-0 flex-1 mr-2">
                    <div className="font-medium text-sm text-slate-200 truncate">
                      {anomaly.descripcion}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px]" style={{ color: 'rgba(148,163,184,0.4)' }}>
                        {anomaly.tipo}: {anomaly.cantidad} uds
                      </span>
                    </div>
                  </div>
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
                    style={{ background: sev.bg, color: sev.color }}
                  >
                    {sev.label}
                  </span>
                </div>
                <p
                  className="text-[11px] leading-relaxed mb-2"
                  style={{ color: 'rgba(148,163,184,0.5)' }}
                >
                  {anomaly.razon}
                </p>
                {/* Anomaly score bar */}
                <div className="flex items-center gap-2">
                  <div
                    className="flex-1 h-1 rounded-full overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${scoreWidth}%`,
                        background: `linear-gradient(90deg, ${sev.color}, ${sev.color}44)`,
                      }}
                    />
                  </div>
                  <span
                    className="text-[9px] font-mono"
                    style={{ color: 'rgba(148,163,184,0.3)' }}
                  >
                    {(anomaly.anomaly_score * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-10">
          <Activity size={24} className="mx-auto mb-2" style={{ color: 'rgba(148,163,184,0.2)' }} />
          <p className="text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>
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
        <div
          className="p-3 rounded-lg text-sm mb-3"
          style={{
            background: 'rgba(201,68,68,0.08)',
            color: '#cc5555',
          }}
        >
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
                className="p-3 rounded-xl transition-all hover:scale-[1.01]"
                style={{
                  background: 'rgba(6,182,212,0.04)',
                  border: '1px solid rgba(6,182,212,0.1)',
                }}
              >
                {/* Association flow */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-cyan-300 truncate">
                      {rule.si_compran[0]?.descripcion || rule.si_compran[0]?.codigo}
                    </div>
                    <div className="text-[10px] font-mono" style={{ color: 'rgba(148,163,184,0.3)' }}>
                      {rule.si_compran[0]?.codigo}
                    </div>
                  </div>
                  <ArrowRight size={14} style={{ color: 'rgba(6,182,212,0.4)' }} className="flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-emerald-300 truncate">
                      {rule.tambien_compran[0]?.descripcion || rule.tambien_compran[0]?.codigo}
                    </div>
                    <div className="text-[10px] font-mono" style={{ color: 'rgba(148,163,184,0.3)' }}>
                      {rule.tambien_compran[0]?.codigo}
                    </div>
                  </div>
                </div>

                {/* Confidence bar */}
                <div className="flex items-center gap-2">
                  <span className="text-[9px]" style={{ color: 'rgba(148,163,184,0.4)' }}>
                    {t('common.confidence', 'Confianza')}
                  </span>
                  <div
                    className="flex-1 h-1 rounded-full overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${confidenceWidth}%`,
                        background: 'linear-gradient(90deg, #4a7fb5, #3d9a5f)',
                      }}
                    />
                  </div>
                  <span
                    className="text-[10px] font-mono font-semibold"
                    style={{ color: '#6b8baa' }}
                  >
                    {confidenceWidth}%
                  </span>
                </div>

                {/* Interpretation */}
                {rule.interpretacion && (
                  <p
                    className="text-[10px] mt-1.5 leading-relaxed"
                    style={{ color: 'rgba(148,163,184,0.4)' }}
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
          <ShoppingCart size={24} className="mx-auto mb-2" style={{ color: 'rgba(148,163,184,0.2)' }} />
          <p className="text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>
            {t('ai.noAssociations')}
          </p>
        </div>
      )}
    </PanelShell>
  );
}