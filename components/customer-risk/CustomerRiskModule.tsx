'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshCw, AlertTriangle, TrendingDown, Mail, ShieldAlert,
  Sparkles, Info, ChevronRight, CheckCircle2, Clock, User as UserIcon,
  Brain, MessageSquare, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getChurnScores,
  getChurnSummary,
  trainChurnModel,
  checkAiBackends,
  getPostsaleClientes,
  getPostsaleClienteDetalle,
  type ChurnScore,
  type ChurnSummary,
  type PostsaleClienteResumen,
  type PostsaleAnalisis,
} from '@/lib/ai-clients/churn-client';

// =====================================================
// Clientes en Riesgo — UI integrada
// =====================================================
// Combina:
//   - Vanguard-IA (XGBoost): score numérico de churn
//   - postsale-mvp (LLM):    análisis cualitativo de emails
// =====================================================

type Filtro = 'todos' | 'critico' | 'alto' | 'medio';

const fmtMoney = (v: number) => `$${v.toLocaleString('es-UY', { maximumFractionDigits: 0 })}`;

const NIVEL_COLORS: Record<string, string> = {
  critico: 'bg-red-500/10 text-red-300 border-red-500/20',
  alto: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  medio: 'bg-slate-700/30 text-slate-300 border-slate-700',
  bajo: 'bg-slate-800/30 text-slate-500 border-slate-800',
};

const NIVEL_LABEL: Record<string, string> = {
  critico: 'Crítico',
  alto: 'Alto',
  medio: 'Medio',
  bajo: 'Bajo',
};

export function CustomerRiskModule() {
  const { t } = useTranslation();
  const [scores, setScores] = useState<ChurnScore[]>([]);
  const [summary, setSummary] = useState<ChurnSummary | null>(null);
  const [postsaleClientes, setPostsaleClientes] = useState<PostsaleClienteResumen[]>([]);
  const [backends, setBackends] = useState<{ vanguardIA: boolean; postsale: boolean }>({ vanguardIA: false, postsale: false });
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);
  const [seleccionado, setSeleccionado] = useState<ChurnScore | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setLoading(true);
    setErrorMsg(null);
    const back = await checkAiBackends();
    setBackends(back);
    if (!back.vanguardIA && !back.postsale) {
      setErrorMsg('Ningún backend de IA está disponible. Configurá NEXT_PUBLIC_VANGUARD_IA_URL y/o NEXT_PUBLIC_POSTSALE_URL.');
      setLoading(false);
      return;
    }
    const [s, sm, ps] = await Promise.all([
      back.vanguardIA ? getChurnScores({ limit: 200, min_risk: 0 }) : Promise.resolve([]),
      back.vanguardIA ? getChurnSummary() : Promise.resolve(null),
      back.postsale ? getPostsaleClientes() : Promise.resolve([]),
    ]);
    setScores(s);
    setSummary(sm);
    setPostsaleClientes(ps);
    setLoading(false);
  }

  async function reentrenar() {
    setTraining(true);
    setErrorMsg(null);
    const r = await trainChurnModel();
    if (!r || !r.entrenado) {
      setErrorMsg('No se pudo reentrenar el modelo. Verificá que Vanguard-IA esté corriendo y que /churn/train esté habilitado.');
    } else {
      await cargar();
    }
    setTraining(false);
  }

  const filtradas = useMemo(() => {
    let xs = scores;
    if (filtro !== 'todos') xs = xs.filter(s => s.nivel_riesgo === filtro);
    if (search.trim()) {
      const q = search.toLowerCase();
      xs = xs.filter(s => s.cliente_nombre.toLowerCase().includes(q) || s.cliente_id.includes(q));
    }
    return xs;
  }, [scores, filtro, search]);

  // Buscar análisis cualitativo de postsale para un cliente (matching por nombre, fallback)
  const enriquecerConPostsale = (score: ChurnScore): PostsaleClienteResumen | undefined => {
    return postsaleClientes.find(p => p.nombre.toLowerCase() === score.cliente_nombre.toLowerCase());
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100 tracking-tight flex items-center gap-2">
            <ShieldAlert size={16} className="text-red-400" />
            {t('customerRisk.title') || 'Clientes en Riesgo'}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {t('customerRisk.subtitle') || 'Score ML (XGBoost) + análisis cualitativo (LLM) de cada cliente'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BackendBadge label="Vanguard-IA" ok={backends.vanguardIA} />
          <BackendBadge label="postsale-mvp" ok={backends.postsale} />
          <button
            onClick={reentrenar}
            disabled={training || !backends.vanguardIA}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-slate-300 border border-slate-800 rounded-md hover:bg-slate-900 disabled:opacity-50"
            title="Reentrenar modelo XGBoost"
          >
            <Brain size={12} className={cn(training && 'animate-pulse')} />
            {training ? 'Entrenando…' : 'Reentrenar'}
          </button>
          <button
            onClick={cargar}
            className="p-1.5 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-md hover:bg-slate-900"
          >
            <RefreshCw size={13} className={cn(loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2 text-[12px] text-amber-200 flex items-start gap-2">
          <Info size={13} className="mt-0.5 shrink-0" />
          <p>{errorMsg}</p>
        </div>
      )}

      {/* Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total clientes" value={String(summary.total_clientes)} icon={<UserIcon size={11} />} />
          <StatCard label="Críticos" value={String(summary.criticos)} icon={<AlertTriangle size={11} />} accent="red" />
          <StatCard label="Alto riesgo" value={String(summary.alto_riesgo)} icon={<TrendingDown size={11} />} accent="amber" />
          <StatCard label="Medio + Bajo" value={String(summary.medio_riesgo + summary.bajo_riesgo)} icon={<CheckCircle2 size={11} />} accent="green" />
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-slate-900/60 border border-slate-800 rounded-md p-0.5">
          {([
            ['todos', 'Todos'],
            ['critico', 'Críticos'],
            ['alto', 'Alto riesgo'],
            ['medio', 'Medio'],
          ] as [Filtro, string][]).map(([f, label]) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={cn(
                'px-2.5 py-1 text-[12px] font-medium rounded-sm transition-colors',
                filtro === f ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar cliente…"
          className="flex-1 max-w-xs bg-slate-900 border border-slate-800 rounded-md px-3 py-1.5 text-[12px] text-slate-100 focus:outline-none focus:border-slate-600"
        />
      </div>

      {/* Tabla */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500 text-[13px]">
            <RefreshCw className="inline-block animate-spin mr-2" size={14} />
            Cargando scores de IA…
          </div>
        ) : filtradas.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-[13px]">
            {backends.vanguardIA
              ? '✓ Sin clientes en este nivel de riesgo'
              : 'Vanguard-IA no responde. Verificá que esté corriendo.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800 bg-slate-950/60">
                  <th className="text-left font-medium py-2.5 px-4">Cliente</th>
                  <th className="text-right font-medium py-2.5 px-2">Prob.</th>
                  <th className="text-center font-medium py-2.5 px-2">Nivel</th>
                  <th className="text-left font-medium py-2.5 px-2">Razón principal</th>
                  <th className="text-center font-medium py-2.5 px-2">LLM</th>
                  <th className="text-center font-medium py-2.5 px-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.slice(0, 100).map(s => {
                  const ps = enriquecerConPostsale(s);
                  return (
                    <tr
                      key={s.cliente_id}
                      onClick={() => setSeleccionado(s)}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-4">
                        <p className="text-slate-100 font-medium">{s.cliente_nombre}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{s.cliente_id.slice(0, 8)}</p>
                      </td>
                      <td className="text-right tabular-nums px-2">
                        <span className="text-slate-100 font-semibold">{(s.probabilidad_churn * 100).toFixed(0)}%</span>
                      </td>
                      <td className="text-center px-2">
                        <span className={cn('inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border', NIVEL_COLORS[s.nivel_riesgo])}>
                          {NIVEL_LABEL[s.nivel_riesgo]}
                        </span>
                      </td>
                      <td className="px-2 text-slate-300">{s.razon_principal}</td>
                      <td className="text-center px-2">
                        {ps ? (
                          <span className="text-emerald-400" title={`${ps.total_analisis} análisis previos`}>
                            <MessageSquare size={11} />
                          </span>
                        ) : (
                          <span className="text-slate-700">—</span>
                        )}
                      </td>
                      <td className="text-center px-2 text-slate-500">
                        <ChevronRight size={13} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtradas.length > 100 && (
              <div className="text-center text-[11px] text-slate-500 py-2 border-t border-slate-800">
                Mostrando 100 de {filtradas.length}
              </div>
            )}
          </div>
        )}
      </div>

      {seleccionado && (
        <DetalleCliente score={seleccionado} postsale={enriquecerConPostsale(seleccionado)} onClose={() => setSeleccionado(null)} />
      )}

      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2">
        <span className="flex items-center gap-1.5">
          <Sparkles size={11} />
          Modelo: XGBoost (sklearn) entrenado con 13 features de Supabase + LLM postsale-mvp
        </span>
        <span>Diferencial vs SAP/Odoo — no lo tienen out-of-the-box.</span>
      </div>
    </div>
  );
}

function BackendBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border',
      ok
        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
        : 'bg-slate-800/30 text-slate-500 border-slate-800'
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full', ok ? 'bg-emerald-400' : 'bg-slate-600')} />
      {label}
    </span>
  );
}

function StatCard({ label, value, icon, accent }: {
  label: string; value: string; icon: React.ReactNode; accent?: 'red' | 'amber' | 'green';
}) {
  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
      <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500 mb-2 flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className={cn(
        'text-3xl font-semibold tabular-nums tracking-tight',
        accent === 'red' && 'text-red-300',
        accent === 'amber' && 'text-amber-300',
        accent === 'green' && 'text-emerald-300',
        !accent && 'text-slate-50'
      )}>
        {value}
      </div>
    </div>
  );
}

function DetalleCliente({
  score, postsale, onClose,
}: {
  score: ChurnScore;
  postsale?: PostsaleClienteResumen;
  onClose: () => void;
}) {
  const [analisis, setAnalisis] = useState<PostsaleAnalisis[] | null>(null);

  useEffect(() => {
    if (!postsale) return;
    getPostsaleClienteDetalle(postsale.id).then(d => {
      if (d) setAnalisis(d.historial);
    });
  }, [postsale]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 sticky top-0 bg-slate-950">
          <div>
            <h2 className="text-[14px] font-semibold text-slate-100">{score.cliente_nombre}</h2>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">{score.cliente_id}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Score grande */}
          <div className={cn(
            'border rounded-md p-4',
            score.nivel_riesgo === 'critico' && 'bg-red-500/5 border-red-500/20',
            score.nivel_riesgo === 'alto' && 'bg-amber-500/5 border-amber-500/20',
            score.nivel_riesgo === 'medio' && 'bg-slate-900/50 border-slate-800',
            score.nivel_riesgo === 'bajo' && 'bg-slate-900/50 border-slate-800',
          )}>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Probabilidad de churn</span>
              <span className={cn('text-[10px] uppercase font-medium', NIVEL_COLORS[score.nivel_riesgo].split(' ').slice(1, 2).join(' '))}>
                {NIVEL_LABEL[score.nivel_riesgo]}
              </span>
            </div>
            <p className="text-4xl font-semibold tabular-nums text-slate-50">
              {(score.probabilidad_churn * 100).toFixed(0)}%
            </p>
            <p className="text-[13px] text-slate-300 mt-2">{score.razon_principal}</p>
          </div>

          {/* Features */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-md p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">
              <Brain size={11} /> Features del modelo ML
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
              {Object.entries(score.features).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <span className="text-slate-500">{k.replace(/_/g, ' ')}</span>
                  <span className="text-slate-200 tabular-nums">
                    {typeof v === 'number' && Math.abs(v) >= 1000 ? fmtMoney(v) : v.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Análisis cualitativo del LLM (postsale) */}
          {postsale && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-md p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">
                <MessageSquare size={11} /> Análisis cualitativo (postsale-mvp)
              </p>
              {analisis && analisis.length > 0 ? (
                <ul className="space-y-2">
                  {analisis.slice(0, 3).map(a => (
                    <li key={a.fecha_analisis} className="border-l-2 border-slate-700 pl-3 text-[12px]">
                      <p className="text-slate-200">{a.razon_principal}</p>
                      <p className="text-emerald-300 text-[11px] mt-1">→ {a.accion_recomendada_para_el_gestor}</p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Confianza LLM: {a.score_confianza}% · {new Date(a.fecha_analisis).toLocaleDateString()}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-slate-500">Sin análisis previos. Disparalo desde postsale-mvp.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CustomerRiskModule;
