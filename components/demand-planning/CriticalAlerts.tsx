'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { vanguardIA, CriticalProduct } from '@/lib/ai/vanguard-ia-client';
import {
  AlertTriangle, Bell, Package, Clock, RefreshCw,
  CheckCircle, XCircle, TrendingDown, ShoppingCart,
  ChevronRight, Eye, Filter, Download
} from 'lucide-react';

// ============================================
// TIPOS
// ============================================

interface AlertaExtendida extends CriticalProduct {
  tipo_alerta: 'agotamiento' | 'bajo_minimo' | 'sin_movimiento' | 'demanda_alta';
  accion_sugerida: string;
  prioridad: number;
  leida: boolean;
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function CriticalAlerts() {
  const [loading, setLoading] = useState(true);
  const [alertas, setAlertas] = useState<AlertaExtendida[]>([]);
  const [filtro, setFiltro] = useState<'todas' | 'critica' | 'media' | 'baja'>('todas');
  const [mostrarLeidas, setMostrarLeidas] = useState(true);

  useEffect(() => {
    loadAlertas();
  }, []);

  const loadAlertas = async () => {
    setLoading(true);
    try {
      // Obtener productos críticos de la API
      const summary = await vanguardIA.getPredictionsSummary();
      
      const alertasExtendidas: AlertaExtendida[] = summary.productos_criticos.map(p => {
        let tipoAlerta: AlertaExtendida['tipo_alerta'] = 'agotamiento';
        let accionSugerida = '';
        
        if (p.dias_restantes <= 0 || p.stock_actual === 0) {
          tipoAlerta = 'agotamiento';
          accionSugerida = 'Generar orden de compra urgente';
        } else if (p.stock_actual <= p.stock_minimo) {
          tipoAlerta = 'bajo_minimo';
          accionSugerida = 'Programar reposición';
        } else if (p.consumo_diario > (p.stock_actual / 7)) {
          tipoAlerta = 'demanda_alta';
          accionSugerida = 'Revisar proyección de demanda';
        }
        
        return {
          ...p,
          tipo_alerta: tipoAlerta,
          accion_sugerida: accionSugerida,
          prioridad: p.urgencia === 'critica' ? 3 : p.urgencia === 'media' ? 2 : 1,
          leida: false,
        };
      });
      
      // Ordenar por prioridad
      alertasExtendidas.sort((a, b) => b.prioridad - a.prioridad);
      
      setAlertas(alertasExtendidas);
    } catch (error) {
      console.error('Error cargando alertas:', error);
      // Fallback a datos locales si la API falla
      await loadAlertasLocales();
    } finally {
      setLoading(false);
    }
  };

  const loadAlertasLocales = async () => {
    const { data: productos } = await supabase
      .from('productos')
      .select('*')
      .or(`stock.lte.stock_minimo,stock.eq.0`);
    
    if (productos) {
      const alertasLocales: AlertaExtendida[] = productos.map(p => ({
        codigo: p.codigo,
        descripcion: p.descripcion,
        stock_actual: p.stock,
        stock_minimo: p.stock_minimo,
        consumo_diario: 0,
        dias_restantes: p.stock > 0 ? 999 : 0,
        urgencia: p.stock === 0 ? 'critica' as const : p.stock <= p.stock_minimo ? 'media' as const : 'baja' as const,
        tipo_alerta: p.stock === 0 ? 'agotamiento' : 'bajo_minimo',
        accion_sugerida: 'Revisar stock',
        prioridad: p.stock === 0 ? 3 : 2,
        leida: false,
      }));
      
      setAlertas(alertasLocales);
    }
  };

  const marcarComoLeida = (codigo: string) => {
    setAlertas(prev => prev.map(a => 
      a.codigo === codigo ? { ...a, leida: true } : a
    ));
  };

  const marcarTodasLeidas = () => {
    setAlertas(prev => prev.map(a => ({ ...a, leida: true })));
  };

  // Filtrar alertas
  const alertasFiltradas = alertas.filter(a => {
    if (!mostrarLeidas && a.leida) return false;
    if (filtro !== 'todas' && a.urgencia !== filtro) return false;
    return true;
  });

  const countPorUrgencia = {
    critica: alertas.filter(a => a.urgencia === 'critica').length,
    media: alertas.filter(a => a.urgencia === 'media').length,
    baja: alertas.filter(a => a.urgencia === 'baja').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-8 w-8 animate-spin text-red-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4">
        <button
          onClick={() => setFiltro(filtro === 'critica' ? 'todas' : 'critica')}
          className={`p-4 rounded-xl border text-center transition-all ${
            filtro === 'critica' 
              ? 'bg-red-500/20 border-red-500/50' 
              : 'bg-red-500/10 border-red-500/30 hover:border-red-500/50'
          }`}
        >
          <div className="text-3xl font-bold text-red-400">{countPorUrgencia.critica}</div>
          <div className="text-xs text-red-400">Críticas</div>
        </button>
        
        <button
          onClick={() => setFiltro(filtro === 'media' ? 'todas' : 'media')}
          className={`p-4 rounded-xl border text-center transition-all ${
            filtro === 'media' 
              ? 'bg-amber-500/20 border-amber-500/50' 
              : 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50'
          }`}
        >
          <div className="text-3xl font-bold text-amber-400">{countPorUrgencia.media}</div>
          <div className="text-xs text-amber-400">Urgencia Media</div>
        </button>
        
        <button
          onClick={() => setFiltro(filtro === 'baja' ? 'todas' : 'baja')}
          className={`p-4 rounded-xl border text-center transition-all ${
            filtro === 'baja' 
              ? 'bg-slate-500/20 border-slate-500/50' 
              : 'bg-slate-500/10 border-slate-500/30 hover:border-slate-500/50'
          }`}
        >
          <div className="text-3xl font-bold text-slate-400">{countPorUrgencia.baja}</div>
          <div className="text-xs text-slate-400">Baja Prioridad</div>
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={mostrarLeidas}
              onChange={(e) => setMostrarLeidas(e.target.checked)}
              className="rounded border-slate-600"
            />
            Mostrar leídas
          </label>
          
          {filtro !== 'todas' && (
            <button
              onClick={() => setFiltro('todas')}
              className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-400"
            >
              Limpiar filtro
            </button>
          )}
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={marcarTodasLeidas}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
          >
            Marcar todas leídas
          </button>
          <button
            onClick={loadAlertas}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
        </div>
      </div>

      {/* Lista de alertas */}
      <div className="space-y-3">
        {alertasFiltradas.map(alerta => (
          <div
            key={alerta.codigo}
            className={`bg-slate-900/50 border rounded-xl p-4 transition-all ${
              alerta.leida ? 'opacity-60 border-slate-800/50' :
              alerta.urgencia === 'critica' ? 'border-red-500/50 bg-red-500/5' :
              alerta.urgencia === 'media' ? 'border-amber-500/30' :
              'border-slate-800/50'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`p-2 rounded-xl ${
                alerta.urgencia === 'critica' ? 'bg-red-500/20' :
                alerta.urgencia === 'media' ? 'bg-amber-500/20' :
                'bg-slate-500/20'
              }`}>
                {alerta.tipo_alerta === 'agotamiento' ? (
                  <XCircle className={`h-5 w-5 ${
                    alerta.urgencia === 'critica' ? 'text-red-400' : 'text-amber-400'
                  }`} />
                ) : alerta.tipo_alerta === 'bajo_minimo' ? (
                  <TrendingDown className="h-5 w-5 text-amber-400" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-400" />
                )}
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-slate-200">{alerta.descripcion}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    alerta.urgencia === 'critica' ? 'bg-red-500/20 text-red-400' :
                    alerta.urgencia === 'media' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-slate-500/20 text-slate-400'
                  }`}>
                    {alerta.urgencia === 'critica' ? 'CRÍTICA' : 
                     alerta.urgencia === 'media' ? 'URGENTE' : 'BAJA'}
                  </span>
                  {alerta.leida && (
                    <span className="text-xs text-slate-500">✓ Leída</span>
                  )}
                </div>
                
                <div className="text-sm text-slate-400 mb-2">
                  {alerta.tipo_alerta === 'agotamiento' && alerta.stock_actual === 0 ? (
                    <span className="text-red-400 font-medium">⚠️ Stock agotado</span>
                  ) : alerta.tipo_alerta === 'agotamiento' ? (
                    <span>Se agota en <strong className="text-red-400">{alerta.dias_restantes.toFixed(0)} días</strong></span>
                  ) : alerta.tipo_alerta === 'bajo_minimo' ? (
                    <span>Stock bajo mínimo: {alerta.stock_actual} / {alerta.stock_minimo}</span>
                  ) : (
                    <span>Demanda inusualmente alta</span>
                  )}
                </div>
                
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>Stock: {alerta.stock_actual}</span>
                  <span>Mínimo: {alerta.stock_minimo}</span>
                  <span>Consumo: {alerta.consumo_diario.toFixed(1)}/día</span>
                </div>
                
                <div className="mt-3 p-2 bg-slate-800/50 rounded-lg">
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <ShoppingCart className="h-3 w-3" />
                    <span>Acción sugerida: <strong>{alerta.accion_sugerida}</strong></span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                {!alerta.leida && (
                  <button
                    onClick={() => marcarComoLeida(alerta.codigo)}
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"
                    title="Marcar como leída"
                  >
                    <CheckCircle className="h-4 w-4" />
                  </button>
                )}
                <button
                  className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"
                  title="Ver detalle"
                >
                  <Eye className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        
        {alertasFiltradas.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-emerald-400" />
            <p className="text-emerald-400 font-medium">¡Sin alertas pendientes!</p>
            <p className="text-sm text-slate-500 mt-1">Todos los productos tienen stock saludable</p>
          </div>
        )}
      </div>
    </div>
  );
}