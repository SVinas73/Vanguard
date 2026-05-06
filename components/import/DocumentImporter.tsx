'use client';

import React, { useState, useRef } from 'react';
import {
  Upload, FileText, Sparkles, X, Check, AlertCircle,
  RefreshCw, FileImage, Edit3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// =====================================================
// DocumentImporter
// =====================================================
// Componente reutilizable que:
//  - Acepta drag & drop o click de archivo (PDF/imagen)
//  - Lo manda al endpoint /api/ai/extract-* correspondiente
//  - Muestra los datos extraídos con su nivel de confianza
//  - El caller puede usar el callback onExtracted para
//    poblar su formulario.
//
// Es agnóstico al tipo de documento — el caller indica
// cuál endpoint usar y qué hacer con los datos.
// =====================================================

export type TipoExtraccion = 'invoice' | 'remito';

interface Props {
  tipo: TipoExtraccion;
  onExtracted: (datos: any) => void;
  /** Texto del botón cuando no hay archivo */
  uploadLabel?: string;
  /** Si true, el componente queda inline (sin modal). */
  inline?: boolean;
  className?: string;
}

const ENDPOINT_BY_TIPO: Record<TipoExtraccion, string> = {
  invoice: '/api/ai/extract-invoice',
  remito:  '/api/ai/extract-remito',
};

const LABEL_BY_TIPO: Record<TipoExtraccion, string> = {
  invoice: 'factura',
  remito:  'remito',
};

export function DocumentImporter({ tipo, onExtracted, uploadLabel, inline, className }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datos, setDatos] = useState<any>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const labelDoc = LABEL_BY_TIPO[tipo];

  const handleFile = async (f: File) => {
    setError(null);
    setDatos(null);
    setFile(f);

    // Validación cliente
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(f.type)) {
      setError(`Tipo no soportado: ${f.type}. Aceptamos PDF, JPG, PNG, WEBP.`);
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setError('Archivo demasiado grande (máx 20MB)');
      return;
    }

    // Subir
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', f);

      const res = await fetch(ENDPOINT_BY_TIPO[tipo], { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Error ${res.status}`);
        return;
      }
      setDatos(data.datos);
    } catch (e: any) {
      setError(e.message || 'Error al procesar el archivo');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleAplicar = () => {
    if (datos) {
      onExtracted(datos);
      // Reset para que no se vuelva a aplicar accidentalmente
      setDatos(null);
      setFile(null);
    }
  };

  const handleReset = () => {
    setFile(null);
    setDatos(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header con explicación */}
      {!datos && (
        <div className="bg-gradient-to-r from-purple-500/5 to-blue-500/5 border border-purple-500/20 rounded-xl p-3 flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-purple-500/20">
            <Sparkles className="h-4 w-4 text-purple-300" />
          </div>
          <div className="flex-1 text-xs">
            <div className="font-semibold text-purple-300">Importar con IA</div>
            <div className="text-slate-400 mt-0.5">
              Subí un PDF o imagen del {labelDoc} y la IA extrae los datos
              automáticamente. Después podés revisar y editar antes de guardar.
            </div>
          </div>
        </div>
      )}

      {/* Drop zone */}
      {!datos && !loading && (
        <div
          onDragOver={e => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
            dragActive
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-slate-700 hover:border-slate-600 bg-slate-900/30',
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,image/*"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="hidden"
          />
          <Upload className="h-7 w-7 text-slate-500 mx-auto mb-2" />
          <div className="text-sm font-medium text-slate-300">
            {uploadLabel || `Arrastrá tu ${labelDoc} acá o hacé click`}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            PDF, JPG, PNG · máx 20MB
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && file && (
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6 text-center">
          <RefreshCw className="h-6 w-6 text-purple-400 mx-auto mb-2 animate-spin" />
          <div className="text-sm text-slate-200">Procesando con IA...</div>
          <div className="text-xs text-slate-500 mt-1 truncate">{file.name}</div>
          <div className="text-[10px] text-slate-600 mt-2">
            Esto suele tomar 5-15 segundos.
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-300 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <div className="font-medium text-red-300">No se pudo procesar</div>
            <div className="text-red-200/80 mt-0.5">{error}</div>
            <button
              onClick={handleReset}
              className="mt-2 text-red-200 hover:text-red-100 underline"
            >
              Probar con otro archivo
            </button>
          </div>
        </div>
      )}

      {/* Datos extraídos */}
      {datos && !loading && (
        <div className="bg-slate-900/50 border border-emerald-500/30 rounded-xl overflow-hidden">
          <div className="bg-emerald-500/10 px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-300" />
              <span className="text-sm font-medium text-emerald-300">
                Datos extraídos
              </span>
              {typeof datos.confianza === 'number' && (
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded font-bold',
                  datos.confianza >= 0.85 ? 'bg-emerald-500/20 text-emerald-300' :
                  datos.confianza >= 0.7  ? 'bg-amber-500/20 text-amber-300' :
                                            'bg-red-500/20 text-red-300',
                )}>
                  {Math.round(datos.confianza * 100)}% confianza
                </span>
              )}
            </div>
            <button
              onClick={handleReset}
              className="p-1 hover:bg-slate-800 rounded text-slate-400"
              title="Cancelar y subir otro"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="p-3 max-h-64 overflow-y-auto">
            <PreviewExtraccion tipo={tipo} datos={datos} />
          </div>

          <div className="border-t border-slate-700/50 p-3 flex items-center gap-2 bg-slate-950/50">
            <Edit3 className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-[11px] text-slate-500 flex-1">
              Revisá y editá los datos en el formulario antes de guardar.
            </span>
            <button
              onClick={handleAplicar}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg flex items-center gap-1.5"
            >
              <Check className="h-3.5 w-3.5" />
              Usar datos
            </button>
          </div>
        </div>
      )}

      {/* File-info compact (cuando hay archivo pero todavía está procesando o falló) */}
      {file && !loading && !datos && !error && (
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <FileText className="h-3 w-3" />
          {file.name} · {(file.size / 1024).toFixed(1)} KB
        </div>
      )}
    </div>
  );
}

// =====================================================
// Preview compacto de los datos extraídos
// =====================================================

function PreviewExtraccion({ tipo, datos }: { tipo: TipoExtraccion; datos: any }) {
  if (tipo === 'invoice') {
    return (
      <div className="space-y-2 text-sm">
        <Row label="Proveedor" value={datos.proveedor?.nombre} />
        {datos.proveedor?.rut && <Row label="RUT" value={datos.proveedor.rut} />}
        <Row label="Número factura" value={datos.numero_factura} />
        <Row label="Fecha" value={datos.fecha} />
        <Row label="Moneda" value={datos.moneda || 'UYU'} />
        <Row label="Total" value={datos.total?.toLocaleString('es-UY')} bold />
        {Array.isArray(datos.items) && datos.items.length > 0 && (
          <div className="pt-2 mt-2 border-t border-slate-800">
            <div className="text-xs text-slate-500 mb-1">
              {datos.items.length} ítem{datos.items.length !== 1 ? 's' : ''}:
            </div>
            <ul className="text-xs text-slate-400 space-y-0.5">
              {datos.items.slice(0, 5).map((it: any, i: number) => (
                <li key={i} className="truncate">
                  • {it.cantidad}× {it.descripcion} {it.precio_unitario && `@ ${it.precio_unitario}`}
                </li>
              ))}
              {datos.items.length > 5 && <li className="text-slate-600">…y {datos.items.length - 5} más</li>}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (tipo === 'remito') {
    return (
      <div className="space-y-2 text-sm">
        <Row label="Proveedor" value={datos.proveedor} />
        <Row label="Número remito" value={datos.numero_remito} />
        <Row label="Fecha" value={datos.fecha} />
        {datos.orden_compra_referencia && <Row label="OC referencia" value={datos.orden_compra_referencia} />}
        {Array.isArray(datos.items) && datos.items.length > 0 && (
          <div className="pt-2 mt-2 border-t border-slate-800">
            <div className="text-xs text-slate-500 mb-1">{datos.items.length} ítem(s):</div>
            <ul className="text-xs text-slate-400 space-y-0.5">
              {datos.items.slice(0, 5).map((it: any, i: number) => (
                <li key={i} className="truncate">
                  • {it.cantidad}× {it.descripcion} {it.lote && `· lote ${it.lote}`}
                </li>
              ))}
              {datos.items.length > 5 && <li className="text-slate-600">…y {datos.items.length - 5} más</li>}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return <pre className="text-xs text-slate-400">{JSON.stringify(datos, null, 2)}</pre>;
}

function Row({ label, value, bold }: { label: string; value: any; bold?: boolean }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={cn('text-slate-200 truncate', bold && 'font-bold text-base')}>
        {String(value)}
      </span>
    </div>
  );
}

// =====================================================
// EmailExtractor — variante que recibe texto pegado
// =====================================================

export function EmailExtractor({ onExtracted, className }: { onExtracted: (datos: any) => void; className?: string }) {
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datos, setDatos] = useState<any>(null);

  const handleProcesar = async () => {
    setError(null);
    setDatos(null);
    if (texto.trim().length < 20) {
      setError('Pegá un email completo (mínimo 20 caracteres).');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/ai/extract-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Error ${res.status}`);
        return;
      }
      setDatos(data.datos);
    } catch (e: any) {
      setError(e.message || 'Error al procesar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="bg-gradient-to-r from-purple-500/5 to-blue-500/5 border border-purple-500/20 rounded-xl p-3 flex items-start gap-3">
        <Sparkles className="h-4 w-4 text-purple-300 mt-0.5" />
        <div className="text-xs">
          <div className="font-semibold text-purple-300">Pegá el email</div>
          <div className="text-slate-400 mt-0.5">
            La IA detecta tipo (pedido/consulta/reclamo), productos mencionados y sugiere acciones.
          </div>
        </div>
      </div>

      <textarea
        value={texto}
        onChange={e => setTexto(e.target.value)}
        rows={8}
        placeholder="Pegá acá el contenido del email..."
        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-sm resize-y"
      />

      <div className="flex justify-between items-center">
        <span className="text-[11px] text-slate-500">
          {texto.length}/20.000 caracteres
        </span>
        <button
          onClick={handleProcesar}
          disabled={loading || texto.trim().length < 20}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg flex items-center gap-2"
        >
          {loading
            ? <RefreshCw className="h-4 w-4 animate-spin" />
            : <Sparkles className="h-4 w-4" />
          }
          Analizar
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {datos && (
        <div className="bg-slate-900/50 border border-emerald-500/30 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-300" />
            <span className="text-sm font-medium text-emerald-300">Análisis completo</span>
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
              {Math.round((datos.confianza || 0) * 100)}%
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Row label="Tipo" value={datos.tipo} />
            <Row label="Urgencia" value={datos.urgencia} />
            <Row label="Remitente" value={datos.remitente?.nombre || datos.remitente?.email} />
            <Row label="Empresa" value={datos.remitente?.empresa} />
          </div>
          <Row label="Resumen" value={datos.asunto_resumido} />
          {Array.isArray(datos.acciones_sugeridas) && (
            <div className="pt-2 border-t border-slate-800">
              <div className="text-xs text-slate-500 mb-1">Acciones sugeridas:</div>
              <ul className="text-xs text-slate-300 space-y-0.5">
                {datos.acciones_sugeridas.map((a: string, i: number) => (
                  <li key={i}>• {a}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex justify-end pt-2">
            <button
              onClick={() => onExtracted(datos)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg"
            >
              Usar datos
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
