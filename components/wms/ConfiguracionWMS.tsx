'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings, Save, RefreshCw, Shield, Truck, Target,
  AlertTriangle, Calendar, Sliders, Link2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { registrarAuditoria } from '@/lib/audit';
import { useAuth } from '@/hooks/useAuth';
import { useWmsToast } from './useWmsToast';
import { cn } from '@/lib/utils';

interface ConfigWMS {
  id?: string;
  estrategia_putaway: 'fefo' | 'familia' | 'manual' | 'cercano_despacho';
  estrategia_picking: 'fefo' | 'fifo' | 'lifo' | 'ruta_optima';
  dias_alerta_vencimiento: number;
  dias_alerta_sin_movimiento: number;
  requiere_aprobacion_ajuste: boolean;
  umbral_ajuste_aprobacion: number;
  permitir_short_pick: boolean;
  permitir_pick_partial: boolean;
  autogenerar_recepcion_desde_compra: boolean;
  autogenerar_picking_desde_venta: boolean;
  notas?: string;
}

const DEFAULT_CONFIG: ConfigWMS = {
  estrategia_putaway: 'fefo',
  estrategia_picking: 'fefo',
  dias_alerta_vencimiento: 30,
  dias_alerta_sin_movimiento: 90,
  requiere_aprobacion_ajuste: true,
  umbral_ajuste_aprobacion: 100,
  permitir_short_pick: false,
  permitir_pick_partial: true,
  autogenerar_recepcion_desde_compra: true,
  autogenerar_picking_desde_venta: true,
};

export default function ConfiguracionWMS() {
  const { user } = useAuth(false);
  const toast = useWmsToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ConfigWMS>(DEFAULT_CONFIG);
  const [original, setOriginal] = useState<ConfigWMS>(DEFAULT_CONFIG);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('wms_configuracion')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data) {
        const parsed: ConfigWMS = {
          id: data.id,
          estrategia_putaway: data.estrategia_putaway || 'fefo',
          estrategia_picking: data.estrategia_picking || 'fefo',
          dias_alerta_vencimiento: data.dias_alerta_vencimiento ?? 30,
          dias_alerta_sin_movimiento: data.dias_alerta_sin_movimiento ?? 90,
          requiere_aprobacion_ajuste: data.requiere_aprobacion_ajuste ?? true,
          umbral_ajuste_aprobacion: parseFloat(data.umbral_ajuste_aprobacion ?? 100),
          permitir_short_pick: data.permitir_short_pick ?? false,
          permitir_pick_partial: data.permitir_pick_partial ?? true,
          autogenerar_recepcion_desde_compra: data.autogenerar_recepcion_desde_compra ?? true,
          autogenerar_picking_desde_venta: data.autogenerar_picking_desde_venta ?? true,
          notas: data.notas || '',
        };
        setConfig(parsed);
        setOriginal(parsed);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...config,
        updated_at: new Date().toISOString(),
        updated_by: user?.email || null,
      };

      if (config.id) {
        const { error } = await supabase
          .from('wms_configuracion')
          .update(payload)
          .eq('id', config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('wms_configuracion')
          .insert(payload);
        if (error) throw error;
      }

      await registrarAuditoria(
        'wms_configuracion',
        'ACTUALIZAR',
        config.id || 'global',
        original,
        config,
        user?.email || ''
      );

      toast.success('Configuración guardada');
      setOriginal(config);
    } catch (e: any) {
      toast.error(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const dirty = JSON.stringify(config) !== JSON.stringify(original);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <toast.Toast />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Settings className="h-6 w-6 text-slate-400" />
            Configuración WMS
          </h3>
          <p className="text-slate-400 text-sm mt-1">
            Estrategias, umbrales y políticas del almacén
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs text-amber-400">Cambios sin guardar</span>}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
              dirty
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            )}
          >
            <Save className="h-4 w-4" />
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {/* Estrategias */}
      <Card icon={Sliders} title="Estrategias de operación">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Estrategia de putaway"
            value={config.estrategia_putaway}
            onChange={v => setConfig(c => ({ ...c, estrategia_putaway: v as ConfigWMS['estrategia_putaway'] }))}
            options={[
              { value: 'fefo',             label: 'FEFO — primero el que vence antes' },
              { value: 'familia',          label: 'Familia — agrupar por categoría' },
              { value: 'cercano_despacho', label: 'Cerca de despacho' },
              { value: 'manual',           label: 'Manual (operador decide)' },
            ]}
          />
          <Select
            label="Estrategia de picking"
            value={config.estrategia_picking}
            onChange={v => setConfig(c => ({ ...c, estrategia_picking: v as ConfigWMS['estrategia_picking'] }))}
            options={[
              { value: 'fefo',         label: 'FEFO — primero el que vence antes' },
              { value: 'fifo',         label: 'FIFO — primero en entrar, primero en salir' },
              { value: 'lifo',         label: 'LIFO — último en entrar, primero en salir' },
              { value: 'ruta_optima',  label: 'Ruta óptima — minimizar distancia' },
            ]}
          />
        </div>
      </Card>

      {/* Alertas */}
      <Card icon={AlertTriangle} title="Umbrales de alerta">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <NumberInput
            label="Días antes del vencimiento para alertar"
            value={config.dias_alerta_vencimiento}
            onChange={v => setConfig(c => ({ ...c, dias_alerta_vencimiento: v }))}
            suffix="días"
          />
          <NumberInput
            label="Días sin movimiento para considerar producto inactivo"
            value={config.dias_alerta_sin_movimiento}
            onChange={v => setConfig(c => ({ ...c, dias_alerta_sin_movimiento: v }))}
            suffix="días"
          />
        </div>
      </Card>

      {/* Autorización */}
      <Card icon={Shield} title="Autorización de ajustes">
        <div className="space-y-3">
          <Toggle
            label="Requerir aprobación para ajustes de inventario"
            value={config.requiere_aprobacion_ajuste}
            onChange={v => setConfig(c => ({ ...c, requiere_aprobacion_ajuste: v }))}
          />
          <NumberInput
            label="Umbral en unidades a partir del cual se requiere aprobación"
            value={config.umbral_ajuste_aprobacion}
            onChange={v => setConfig(c => ({ ...c, umbral_ajuste_aprobacion: v }))}
            suffix="unidades"
            disabled={!config.requiere_aprobacion_ajuste}
          />
        </div>
      </Card>

      {/* Picking */}
      <Card icon={Target} title="Política de picking">
        <div className="space-y-3">
          <Toggle
            label="Permitir short-pick (cerrar línea con cantidad menor)"
            value={config.permitir_short_pick}
            onChange={v => setConfig(c => ({ ...c, permitir_short_pick: v }))}
          />
          <Toggle
            label="Permitir picking parcial (no cerrar la orden si falta stock)"
            value={config.permitir_pick_partial}
            onChange={v => setConfig(c => ({ ...c, permitir_pick_partial: v }))}
          />
        </div>
      </Card>

      {/* Integración Comercial */}
      <Card icon={Link2} title="Integración con módulo Comercial">
        <div className="space-y-3">
          <Toggle
            label="Auto-generar orden de recepción al confirmar una orden de compra"
            value={config.autogenerar_recepcion_desde_compra}
            onChange={v => setConfig(c => ({ ...c, autogenerar_recepcion_desde_compra: v }))}
          />
          <Toggle
            label="Auto-generar orden de picking al confirmar una orden de venta"
            value={config.autogenerar_picking_desde_venta}
            onChange={v => setConfig(c => ({ ...c, autogenerar_picking_desde_venta: v }))}
          />
        </div>
      </Card>

      {/* Notas */}
      <Card icon={Calendar} title="Notas internas">
        <textarea
          rows={3}
          value={config.notas || ''}
          onChange={e => setConfig(c => ({ ...c, notas: e.target.value }))}
          placeholder="Notas, lineamientos internos, fecha del último cambio relevante..."
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm resize-none"
        />
      </Card>
    </div>
  );
}

// ============================================
// SUBCOMPONENTES
// ============================================

function Card({ icon: Icon, title, children }: {
  icon: React.ElementType; title: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
      <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-slate-400" />
        {title}
      </h4>
      {children}
    </div>
  );
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function NumberInput({ label, value, onChange, suffix, disabled }: {
  label: string; value: number; onChange: (v: number) => void; suffix?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          disabled={disabled}
          className={cn(
            'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm',
            disabled && 'opacity-50'
          )}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }: {
  label: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/50 transition-colors text-left"
    >
      <span className="text-sm text-slate-300 flex-1">{label}</span>
      <div className={cn(
        'w-10 h-5 rounded-full transition-colors flex-shrink-0',
        value ? 'bg-emerald-500' : 'bg-slate-700'
      )}>
        <div className={cn(
          'w-4 h-4 rounded-full bg-white shadow-sm transition-transform mt-0.5',
          value ? 'translate-x-5' : 'translate-x-0.5'
        )} />
      </div>
    </button>
  );
}
