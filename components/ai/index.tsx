'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { aiApi } from '@/lib/ai-api';
import { cn } from '@/lib/utils';
import { getStockAlerts, findAllAnomalies } from '@/lib/ai';
import type { Product, Movement, StockPrediction } from '@/types';
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
// HOOK HÍBRIDO: backend-first + fallback local
// ============================================
// Intenta traer datos del backend de IA (modelos potentes: Isolation Forest,
// Apriso/mlxtend, XGBoost). Si el backend no responde, cae al cálculo local
// para que el dashboard nunca quede vacío. Expone la fuente real ('backend' /
// 'local') para mostrarla con honestidad en la UI.

type DataSource = 'backend' | 'local' | 'loading';

function useHybridData<T>(
  fetchBackend: () => Promise<T>,
  computeLocal: () => T,
  deps: React.DependencyList,
  localOnly = false,
): { data: T; source: DataSource; loading: boolean; refresh: () => void } {
  const [data, setData] = useState<T>(() => computeLocal());
  const [source, setSource] = useState<DataSource>('loading');
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const localFn = useCallback(computeLocal, deps);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const backendFn = useCallback(fetchBackend, deps);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    // localOnly: no consultar el backend (datos pre-filtrados por almacén).
    if (localOnly) {
      // pequeño tick para que el spinner sea visible al refrescar.
      const id = setTimeout(() => {
        if (cancelled) return;
        setData(localFn());
        setSource('local');
        setLoading(false);
      }, 120);
      return () => { cancelled = true; clearTimeout(id); };
    }

    backendFn()
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setSource('backend');
      })
      .catch(() => {
        if (cancelled) return;
        setData(localFn());
        setSource('local');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [backendFn, localFn, nonce, localOnly]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  return { data, source, loading, refresh };
}

function SourceTag({ source }: { source: DataSource }) {
  const { t } = useTranslation();
  if (source === 'loading') return null;
  const isBackend = source === 'backend';
  return (
    <span
      className={cn(
        'text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide',
        isBackend
          ? 'bg-emerald-500/10 text-emerald-400'
          : 'bg-slate-700/40 text-slate-400',
      )}
      title={
        isBackend
          ? t('ai.sourceBackendHint', 'Modelos del backend de IA (Vanguard-IA)')
          : t('ai.sourceLocalHint', 'Cálculo local en el navegador (backend no disponible)')
      }
    >
      {isBackend ? 'IA' : t('ai.sourceLocal', 'local')}
    </span>
  );
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

interface AIPanelDataProps {
  products?: Product[];
  movements?: Movement[];
  predictions?: Record<string, StockPrediction>;
  /** Refresca los datos de origen (productos/movimientos) en el padre. */
  onRefresh?: () => void;
  /**
   * Si es true, el panel usa SOLO el cálculo local sobre los products/movements
   * recibidos (no consulta el backend global). Necesario cuando los datos están
   * pre-filtrados por almacén (ej: Análisis de Insumos), porque el backend de
   * IA no filtra por almacén y mezclaría productos de venta con insumos.
   */
  localOnly?: boolean;
}

export function AIPredictionsPanel({ products = [], movements = [], predictions = {}, onRefresh, localOnly = false }: AIPanelDataProps) {
  const { t } = useTranslation();

  // Fallback local: predictor client-side que ya corre en la app.
  const computeLocal = useCallback((): PredictionsSummary => {
    const alertas = getStockAlerts(products, predictions);
    const criticos = alertas
      .map((p) => {
        const pred = predictions[p.codigo];
        const dias = pred?.days;
        const diasRestantes = dias === null || dias === undefined || !Number.isFinite(dias)
          ? (p.stock <= p.stockMinimo ? 0 : 999)
          : dias;
        const consumoDiario = pred?.dailyRate ? parseFloat(pred.dailyRate) : 0;
        const urgencia: 'critica' | 'media' | 'baja' =
          p.stock === 0 || diasRestantes < 7 ? 'critica'
          : diasRestantes < 15 ? 'media'
          : 'baja';
        return {
          codigo: p.codigo,
          descripcion: p.descripcion,
          stock_actual: p.stock,
          stock_minimo: p.stockMinimo,
          consumo_diario: consumoDiario,
          dias_restantes: diasRestantes,
          urgencia,
        };
      })
      .sort((a, b) => a.dias_restantes - b.dias_restantes);
    return {
      productos_criticos: criticos,
      total_analizado: products.length,
      total_criticos: criticos.length,
    };
  }, [products, predictions]);

  // Backend-first: resumen de productos críticos (Holt-Winters/XGBoost).
  const fetchBackend = useCallback(async (): Promise<PredictionsSummary> => {
    return aiApi.getPredictionsSummary();
  }, []);

  const { data, source, loading, refresh } = useHybridData(
    fetchBackend, computeLocal, [products, predictions], localOnly,
  );
  const error = null;
  // Refresca SOLO este card (no recarga toda la página).
  const fetchData = () => { refresh(); if (localOnly) onRefresh?.(); };

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
          <span className="flex items-center justify-between gap-2">
            <span>
              {data.total_criticos}{' '}
              {t('ai.analyzedProducts').replace(
                '{total}',
                data.total_analizado.toString()
              )}
            </span>
            <SourceTag source={source} />
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

export function AIAnomaliesPanel({ products = [], movements = [], onRefresh, localOnly = false }: AIPanelDataProps) {
  const { t } = useTranslation();

  // Fallback local: detección Z-score sobre el historial.
  const computeLocal = useCallback((): AnomaliesData => {
    const encontradas = findAllAnomalies(products, movements);
    const anomalias: Anomaly[] = encontradas.slice(0, 20).map(({ movement, anomaly }, i) => {
      const prod = products.find((p) => p.codigo === movement.codigo);
      const sev = anomaly.severity >= 0.66 ? 'alta' : anomaly.severity >= 0.33 ? 'media' : 'baja';
      return {
        id: String(movement.id ?? i),
        codigo: movement.codigo,
        descripcion: prod?.descripcion ?? movement.codigo,
        tipo: movement.tipo,
        cantidad: movement.cantidad,
        fecha: (movement.timestamp instanceof Date ? movement.timestamp : new Date(movement.timestamp)).toISOString(),
        usuario: movement.usuario ?? '',
        anomaly_score: anomaly.severity,
        razon: anomaly.reason ?? '',
        severidad: sev as 'alta' | 'media' | 'baja',
      };
    });
    return {
      anomalias,
      total_analizado: movements.length,
      total_anomalias: anomalias.length,
    };
  }, [products, movements]);

  // Backend-first: Isolation Forest. Normaliza el score (decision_function,
  // negativo = más anómalo) a 0..1 para la barra visual.
  const fetchBackend = useCallback(async (): Promise<AnomaliesData> => {
    const res = await aiApi.detectAnomalies(30);
    const anomalias: Anomaly[] = (res.anomalias ?? []).map((a: any, i: number) => ({
      id: String(a.id ?? i),
      codigo: a.codigo,
      descripcion: a.descripcion ?? a.codigo,
      tipo: a.tipo,
      cantidad: a.cantidad,
      fecha: a.fecha,
      usuario: a.usuario ?? '',
      anomaly_score: Math.min(1, Math.max(0, Math.abs(a.anomaly_score ?? 0))),
      razon: a.razon ?? '',
      severidad: (a.severidad ?? 'baja') as 'alta' | 'media' | 'baja',
    }));
    return {
      anomalias,
      total_analizado: res.total_analizado ?? movements.length,
      total_anomalias: res.total_anomalias ?? anomalias.length,
    };
  }, [movements.length]);

  const { data, source, loading, refresh } = useHybridData(
    fetchBackend, computeLocal, [products, movements], localOnly,
  );
  const error = null;
  // Refresca SOLO este card (no recarga toda la página).
  const fetchData = () => { refresh(); if (localOnly) onRefresh?.(); };

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
          <span className="flex items-center justify-between gap-2">
            <span>
              {data.total_anomalias}{' '}
              {t('ai.analyzedMovements').replace(
                '{total}',
                data.total_analizado.toString()
              )}
            </span>
            <SourceTag source={source} />
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

export function AIAssociationsPanel({ products = [], movements = [], onRefresh, localOnly = false }: AIPanelDataProps) {
  const { t } = useTranslation();

  // Fallback local: Apriori simplificado client-side (salidas del mismo día).
  const computeLocal = useCallback((): AssociationsData => {
    const desc = new Map(products.map((p) => [p.codigo, p.descripcion]));

    // Agrupar salidas por día → "canastas"
    const canastas = new Map<string, Set<string>>();
    for (const m of movements) {
      if (m.tipo !== 'salida') continue;
      const d = (m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp));
      if (Number.isNaN(d.getTime())) continue;
      const dia = d.toISOString().slice(0, 10);
      if (!canastas.has(dia)) canastas.set(dia, new Set());
      canastas.get(dia)!.add(m.codigo);
    }

    const totalCanastas = canastas.size;
    const conteoItem = new Map<string, number>();
    const conteoPar = new Map<string, number>();
    for (const set of canastas.values()) {
      const items = Array.from(set);
      for (const a of items) conteoItem.set(a, (conteoItem.get(a) ?? 0) + 1);
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const [a, b] = [items[i], items[j]].sort();
          const key = `${a}|${b}`;
          conteoPar.set(key, (conteoPar.get(key) ?? 0) + 1);
        }
      }
    }

    const reglas: AssociationRule[] = Array.from(conteoPar.entries())
      .map(([key, cuenta]) => {
        const [a, b] = key.split('|');
        const confianza = conteoItem.get(a) ? cuenta / conteoItem.get(a)! : 0;
        return {
          si_compran: [{ codigo: a, descripcion: desc.get(a) ?? a }],
          tambien_compran: [{ codigo: b, descripcion: desc.get(b) ?? b }],
          confianza,
          interpretacion: `Salieron juntos ${cuenta} ${cuenta === 1 ? 'vez' : 'veces'}.`,
        };
      })
      .filter((r) => r.confianza >= 0.3)
      .sort((a, b) => b.confianza - a.confianza)
      .slice(0, 10);

    return { reglas, total_transacciones: totalCanastas };
  }, [products, movements]);

  // Backend-first: reglas de asociación con Apriori (mlxtend).
  const fetchBackend = useCallback(async (): Promise<AssociationsData> => {
    const res = await aiApi.getAssociationRules(0.1, 0.3, 90);
    const reglas: AssociationRule[] = (res.reglas ?? []).map((r: any) => ({
      si_compran: r.si_compran ?? [],
      tambien_compran: r.tambien_compran ?? [],
      confianza: r.confianza ?? 0,
      interpretacion: r.interpretacion ?? '',
    }));
    return { reglas, total_transacciones: res.total_transacciones ?? 0 };
  }, []);

  const { data, source, loading, refresh } = useHybridData(
    fetchBackend, computeLocal, [products, movements], localOnly,
  );
  const error = null;
  // Refresca SOLO este card (no recarga toda la página).
  const fetchData = () => { refresh(); if (localOnly) onRefresh?.(); };

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
          <span className="flex items-center justify-between gap-2">
            <span>
              {data.reglas.length > 0
                ? `${data.reglas.length} reglas · ${data.total_transacciones} transacciones`
                : `${(data as any).total_movimientos || data.total_transacciones || 0} movimientos`}
            </span>
            <SourceTag source={source} />
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