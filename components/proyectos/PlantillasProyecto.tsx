'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import {
  Layout,
  Code,
  Megaphone,
  Package,
  Kanban,
  Plus,
  Check,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface PlantillaProyecto {
  id: string;
  nombre: string;
  descripcion: string;
  color: string;
  columnasConfig: { nombre: string; orden: number; color?: string; limite_wip?: number }[];
  tareasConfig: { titulo: string; prioridad: string; columna_index: number }[];
  etiquetasConfig: { nombre: string; color: string }[];
  esPublica: boolean;
}

interface PlantillasProyectoProps {
  onSelectPlantilla: (plantilla: PlantillaProyecto) => void;
  onCrearVacio: () => void;
}

const iconosPlantilla: Record<string, React.ReactNode> = {
  'Desarrollo de Software': <Code size={24} />,
  'Marketing Campaign': <Megaphone size={24} />,
  'Gestión de Inventario': <Package size={24} />,
  'Simple Kanban': <Kanban size={24} />,
};

export function PlantillasProyecto({ onSelectPlantilla, onCrearVacio }: PlantillasProyectoProps) {
  const [plantillas, setPlantillas] = useState<PlantillaProyecto[]>([]);
  const [loading, setLoading] = useState(true);
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<string | null>(null);

  useEffect(() => {
    fetchPlantillas();
  }, []);

  const fetchPlantillas = async () => {
    const { data, error } = await supabase
      .from('proyecto_plantillas')
      .select('*')
      .eq('es_publica', true)
      .order('nombre');

    if (!error && data) {
      setPlantillas(data.map(p => ({
        id: p.id,
        nombre: p.nombre,
        descripcion: p.descripcion,
        color: p.color,
        columnasConfig: p.columnas_config || [],
        tareasConfig: p.tareas_config || [],
        etiquetasConfig: p.etiquetas_config || [],
        esPublica: p.es_publica,
      })));
    }
    setLoading(false);
  };

  const handleSelect = (plantilla: PlantillaProyecto) => {
    setPlantillaSeleccionada(plantilla.id);
    onSelectPlantilla(plantilla);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h3 className="text-lg font-semibold mb-2">Elegí cómo empezar</h3>
        <p className="text-sm text-slate-400">
          Seleccioná una plantilla o creá un proyecto desde cero
        </p>
      </div>

      {/* Opción: Crear vacío */}
      <button
        onClick={onCrearVacio}
        className="w-full p-4 rounded-xl border-2 border-dashed border-slate-700 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all group text-left"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
            <Plus size={24} className="text-slate-400 group-hover:text-emerald-400" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium group-hover:text-emerald-400 transition-colors">
              Proyecto en blanco
            </h4>
            <p className="text-sm text-slate-500">
              Empezá desde cero con columnas básicas
            </p>
          </div>
          <ArrowRight size={20} className="text-slate-600 group-hover:text-emerald-400 transition-colors" />
        </div>
      </button>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-700/50" />
        </div>
        <div className="relative flex justify-center">
          <span className="px-3 bg-slate-900 text-xs text-slate-500 uppercase tracking-wider">
            O elegí una plantilla
          </span>
        </div>
      </div>

      {/* Plantillas */}
      <div className="grid gap-4">
        {plantillas.map(plantilla => (
          <button
            key={plantilla.id}
            onClick={() => handleSelect(plantilla)}
            className={cn(
              'w-full p-4 rounded-xl border transition-all text-left group',
              plantillaSeleccionada === plantilla.id
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/30'
            )}
          >
            <div className="flex items-start gap-4">
              {/* Icono */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${plantilla.color}20` }}
              >
                <div style={{ color: plantilla.color }}>
                  {iconosPlantilla[plantilla.nombre] || <Layout size={24} />}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium">{plantilla.nombre}</h4>
                  {plantillaSeleccionada === plantilla.id && (
                    <Check size={16} className="text-emerald-400" />
                  )}
                </div>
                <p className="text-sm text-slate-400 mb-3">
                  {plantilla.descripcion}
                </p>

                {/* Preview de columnas */}
                <div className="flex gap-1.5 flex-wrap">
                  {plantilla.columnasConfig.slice(0, 5).map((col, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 text-xs rounded-full"
                      style={{
                        backgroundColor: col.color ? `${col.color}20` : 'rgba(100,116,139,0.2)',
                        color: col.color || '#94a3b8',
                      }}
                    >
                      {col.nombre}
                    </span>
                  ))}
                  {plantilla.columnasConfig.length > 5 && (
                    <span className="text-xs text-slate-500">
                      +{plantilla.columnasConfig.length - 5}
                    </span>
                  )}
                </div>

                {/* Preview de etiquetas */}
                {plantilla.etiquetasConfig.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap mt-2">
                    {plantilla.etiquetasConfig.slice(0, 4).map((et, i) => (
                      <span
                        key={i}
                        className="px-1.5 py-0.5 text-[10px] rounded"
                        style={{
                          backgroundColor: `${et.color}20`,
                          color: et.color,
                        }}
                      >
                        {et.nombre}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="text-right text-xs text-slate-500 flex-shrink-0">
                <div>{plantilla.columnasConfig.length} columnas</div>
                <div>{plantilla.etiquetasConfig.length} etiquetas</div>
                {plantilla.tareasConfig.length > 0 && (
                  <div>{plantilla.tareasConfig.length} tareas</div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Tip */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-800/30 border border-slate-700/50">
        <Sparkles size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-slate-300 font-medium mb-1">Tip</p>
          <p className="text-slate-500">
            Las plantillas incluyen columnas y etiquetas predefinidas. Podés personalizarlas después de crear el proyecto.
          </p>
        </div>
      </div>
    </div>
  );
}

// Modal para crear proyecto desde plantilla
interface CrearDesdeTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  plantilla: PlantillaProyecto | null;
  onCrear: (nombre: string, plantilla: PlantillaProyecto) => Promise<void>;
}

export function CrearDesdeTemplateModal({ 
  isOpen, 
  onClose, 
  plantilla, 
  onCrear 
}: CrearDesdeTemplateModalProps) {
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (plantilla) {
      setNombre(`Mi ${plantilla.nombre}`);
    }
  }, [plantilla]);

  if (!isOpen || !plantilla) return null;

  const handleCrear = async () => {
    if (!nombre.trim()) return;
    setLoading(true);
    await onCrear(nombre.trim(), plantilla);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${plantilla.color}20` }}
          >
            <div style={{ color: plantilla.color }}>
              {iconosPlantilla[plantilla.nombre] || <Layout size={20} />}
            </div>
          </div>
          <div>
            <h3 className="font-semibold">Crear desde plantilla</h3>
            <p className="text-sm text-slate-400">{plantilla.nombre}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Nombre del proyecto</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Mi nuevo proyecto"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 focus:border-emerald-500/50 focus:outline-none"
              autoFocus
            />
          </div>

          <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/30">
            <p className="text-xs text-slate-500 mb-2">Se creará con:</p>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>• {plantilla.columnasConfig.length} columnas predefinidas</li>
              <li>• {plantilla.etiquetasConfig.length} etiquetas</li>
              {plantilla.tareasConfig.length > 0 && (
                <li>• {plantilla.tareasConfig.length} tareas de ejemplo</li>
              )}
            </ul>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleCrear}
              disabled={loading || !nombre.trim()}
              className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Creando...' : 'Crear proyecto'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}