import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { aiApi } from '@/lib/ai-api';
import { Card, Button } from '@/components/ui';
import { 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  ShoppingCart,
  RefreshCw,
  Loader2,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
    const interval = setInterval(checkStatus, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={cn(
        'w-2 h-2 rounded-full',
        isOnline === null ? 'bg-slate-500' : isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
      )} />
      <span className="text-slate-400">
        {isOnline === null ? t('common.loading') : isOnline ? t('ai.active') : 'IA Offline'}
      </span>
    </div>
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

  const getUrgencyColor = (urgencia: string) => {
    switch (urgencia) {
      case 'critica': return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'media': return 'text-amber-400 bg-amber-500/20 border-amber-500/30';
      case 'baja': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      default: return 'text-slate-400 bg-slate-500/20 border-slate-500/30';
    }
  };

  const getUrgencyLabel = (urgencia: string) => {
    switch (urgencia) {
      case 'critica': return t('alerts.critical');
      case 'media': return t('alerts.medium');
      case 'baja': return t('alerts.low');
      default: return urgencia;
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-purple-400 flex items-center gap-2">
          <Brain size={18} /> {t('ai.predictions')}
        </h3>
        <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/20 text-red-400 text-sm mb-4">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-purple-400" />
        </div>
      ) : data && data.productos_criticos.length > 0 ? (
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
          {data.productos_criticos.map((producto) => (
            <div
              key={producto.codigo}
              className={cn(
                'p-3 rounded-xl border',
                getUrgencyColor(producto.urgencia)
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{producto.descripcion}</div>
                  <div className="text-xs text-slate-500">{producto.codigo}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono">
                    {producto.dias_restantes.toFixed(1)} {t('reports.days')}
                  </div>
                  <div className="text-xs text-slate-500">
                    {producto.consumo_diario.toFixed(2)}/{t('analytics.dayAvg')}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-slate-500">
          <TrendingUp size={24} className="mx-auto mb-2 opacity-50" />
          {t('ai.noCriticalProducts')}
        </div>
      )}

      {data && (
        <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-500">
          {data.total_criticos} {t('ai.analyzedProducts').replace('{total}', data.total_analizado.toString())}
        </div>
      )}
    </Card>
  );
}

// ============================================
// ANOMALIES PANEL
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

  const getSeverityColor = (severidad: string) => {
    switch (severidad) {
      case 'alta': return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'media': return 'text-amber-400 bg-amber-500/20 border-amber-500/30';
      default: return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
    }
  };

  const getSeverityLabel = (severidad: string) => {
    switch (severidad) {
      case 'alta': return t('alerts.critical');
      case 'media': return t('alerts.medium');
      case 'baja': return t('alerts.low');
      default: return severidad;
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2">
          <AlertTriangle size={18} /> {t('ai.anomalies')}
        </h3>
        <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/20 text-red-400 text-sm mb-4">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-red-400" />
        </div>
      ) : data && data.anomalias.length > 0 ? (
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
          {data.anomalias.slice(0, 10).map((anomaly, index) => (
            <div
              key={`${anomaly.id}-${index}`}
              className={cn(
                'p-3 rounded-xl border',
                getSeverityColor(anomaly.severidad)
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="font-medium text-sm">{anomaly.descripcion}</div>
                <span className={cn(
                  'px-2 py-0.5 rounded text-xs font-medium',
                  getSeverityColor(anomaly.severidad)
                )}>
                  {getSeverityLabel(anomaly.severidad)}
                </span>
              </div>
              <div className="text-xs text-slate-400">
                {anomaly.tipo}: {anomaly.cantidad} {t('sales.units')}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {anomaly.razon}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-slate-500">
          <Activity size={24} className="mx-auto mb-2 opacity-50" />
          {t('ai.noAnomalies')}
        </div>
      )}

      {data && (
        <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-500">
          {data.total_anomalias} {t('ai.analyzedMovements').replace('{total}', data.total_analizado.toString())}
        </div>
      )}
    </Card>
  );
}

// ============================================
// ASSOCIATIONS PANEL
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

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-cyan-400 flex items-center gap-2">
          <ShoppingCart size={18} /> {t('ai.associations')}
        </h3>
        <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/20 text-red-400 text-sm mb-4">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-cyan-400" />
        </div>
      ) : data && data.reglas.length > 0 ? (
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
          {data.reglas.slice(0, 5).map((rule, index) => (
            <div
              key={index}
              className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/30"
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="text-cyan-400">{rule.si_compran[0]?.codigo}</span>
                <span className="text-slate-500">→</span>
                <span className="text-emerald-400">{rule.tambien_compran[0]?.codigo}</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {t('common.confidence')}: {(rule.confianza * 100).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-slate-500">
          <ShoppingCart size={24} className="mx-auto mb-2 opacity-50" />
          {t('ai.noAssociations')}
        </div>
      )}

      {data && (
        <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-500">
          {data.reglas.length > 0 
            ? `${data.reglas.length} reglas - ${data.total_transacciones} transacciones`
            : `0 reglas en ${data.total_transacciones} transacciones analizadas`
          }
        </div>
      )}
    </Card>
  );
}