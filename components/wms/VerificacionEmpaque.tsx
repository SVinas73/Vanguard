'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BarcodeScanner } from '@/components/scanner';
import {
  Barcode, Camera, Check, AlertTriangle, X, ScanLine, PackageCheck, Sparkles,
} from 'lucide-react';

// =====================================================
// Verificación de empaque (escaneo línea por línea)
// =====================================================
// El empaquetador abre el pedido pickeado, ve qué pidió el cliente vs qué
// preparó el pickeador (con las notas y faltantes), y escanea cada producto
// para verificar antes de facturar. Soporta:
//   - Lector USB / pistola (actúa como teclado → input siempre enfocado).
//   - Cámara (BarcodeDetector nativo) vía el modal BarcodeScanner.
//   - Ingreso manual.
// =====================================================

interface LineaPick {
  producto_codigo: string;
  producto_nombre?: string | null;
  cantidad_solicitada: number;
  cantidad_pickeada: number;
  cantidad_short: number;
  estado: string;
  notas?: string | null;
  lote_numero?: string | null;
}

interface VerificacionEmpaqueProps {
  ordenPickingId: string;
  ordenNumero: string;
  clienteNombre?: string;
  /** Se llama cuando el empaquetador confirma (todo verificado o forzado). */
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function VerificacionEmpaque({
  ordenPickingId, ordenNumero, clienteNombre, onConfirmar, onCancelar,
}: VerificacionEmpaqueProps) {
  const [lineas, setLineas] = useState<LineaPick[]>([]);
  const [loading, setLoading] = useState(true);
  // verificados[codigo] = unidades escaneadas
  const [verificados, setVerificados] = useState<Record<string, number>>({});
  const [usarCamara, setUsarCamara] = useState(false);
  const [ultimo, setUltimo] = useState<{ codigo: string; ok: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('wms_ordenes_picking_lineas')
        .select('producto_codigo, producto_nombre, cantidad_solicitada, cantidad_pickeada, cantidad_short, estado, notas, lote_numero')
        .eq('orden_picking_id', ordenPickingId);
      setLineas((data as any) || []);
      setLoading(false);
    })();
  }, [ordenPickingId]);

  // Mantener el input enfocado para capturar el lector USB.
  useEffect(() => {
    if (!usarCamara) inputRef.current?.focus();
  }, [usarCamara, loading]);

  const porCodigo = useMemo(() => {
    const m = new Map<string, LineaPick>();
    for (const l of lineas) m.set(l.producto_codigo.toUpperCase(), l);
    return m;
  }, [lineas]);

  const registrarEscaneo = (codigoRaw: string) => {
    const codigo = codigoRaw.trim().toUpperCase();
    if (!codigo) return;
    const linea = porCodigo.get(codigo);
    if (!linea) {
      setUltimo({ codigo, ok: false });
      return;
    }
    setVerificados(prev => {
      const actual = prev[codigo] || 0;
      // No pasar de lo pickeado (lo que físicamente viaja).
      const max = linea.cantidad_pickeada;
      const next = Math.min(actual + 1, max);
      return { ...prev, [codigo]: next };
    });
    setUltimo({ codigo, ok: true });
  };

  const [inputVal, setInputVal] = useState('');
  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      registrarEscaneo(inputVal);
      setInputVal('');
    }
  };

  // Resumen IA del pedido (local, en lenguaje natural): tamaño + alertas.
  const resumenIA = useMemo(() => {
    if (lineas.length === 0) return '';
    const totalUds = lineas.reduce((s, l) => s + (l.cantidad_pickeada || 0), 0);
    const conFaltante = lineas.filter(l => l.cantidad_pickeada < l.cantidad_solicitada);
    const conNota = lineas.filter(l => l.notas && l.notas.trim());
    const partes: string[] = [];
    const tam = totalUds >= 40 || lineas.length >= 8 ? 'Pedido grande' : 'Pedido';
    partes.push(`${tam}: ${lineas.length} ${lineas.length === 1 ? 'ítem' : 'ítems'}, ${totalUds} unidades preparadas.`);
    if (conFaltante.length > 0) {
      partes.push(`Faltan/parciales: ${conFaltante.slice(0, 3).map(l => l.producto_codigo).join(', ')}${conFaltante.length > 3 ? '…' : ''}.`);
    }
    if (conNota.length > 0) partes.push(`Revisá ${conNota.length} ${conNota.length === 1 ? 'nota del pickeador' : 'notas del pickeador'}.`);
    return partes.join(' ');
  }, [lineas]);

  // Progreso: líneas con cantidad_pickeada > 0 que estén completas.
  const lineasAVerificar = lineas.filter(l => l.cantidad_pickeada > 0);
  const completos = lineasAVerificar.filter(
    l => (verificados[l.producto_codigo.toUpperCase()] || 0) >= l.cantidad_pickeada
  ).length;
  const totalAVerificar = lineasAVerificar.length;
  const todoVerificado = totalAVerificar > 0 && completos === totalAVerificar;
  const hayFaltantes = lineas.some(l => l.cantidad_short > 0 || l.cantidad_pickeada < l.cantidad_solicitada);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-emerald-400" />
            Verificar empaque · {ordenNumero}
          </h3>
          {clienteNombre && <p className="text-sm text-slate-500">{clienteNombre}</p>}
        </div>
        <button onClick={onCancelar} className="p-2 text-slate-400 hover:text-slate-200">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Resumen IA del pedido */}
      {resumenIA && (
        <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-3 flex items-start gap-2">
          <Sparkles className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-slate-300">{resumenIA}</p>
        </div>
      )}

      {/* Faltantes del pickeador */}
      {hayFaltantes && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex items-center gap-2 text-amber-400 text-sm font-medium mb-1">
            <AlertTriangle className="h-4 w-4" /> Faltantes / observaciones del pickeador
          </div>
          <ul className="text-xs text-slate-400 space-y-0.5">
            {lineas.filter(l => l.cantidad_pickeada < l.cantidad_solicitada || l.notas).map(l => (
              <li key={l.producto_codigo}>
                <span className="text-slate-300">{l.producto_codigo}</span>: pidió {l.cantidad_solicitada}, preparó {l.cantidad_pickeada}
                {l.notas ? ` — “${l.notas}”` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Escaneo */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <ScanLine className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            ref={inputRef}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Escaneá con el lector o escribí el código y Enter…"
            className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100"
          />
        </div>
        <button
          onClick={() => setUsarCamara(true)}
          className="flex items-center gap-2 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 text-sm"
        >
          <Camera className="h-4 w-4" /> Cámara
        </button>
      </div>

      {ultimo && (
        <div className={`text-sm flex items-center gap-2 ${ultimo.ok ? 'text-emerald-400' : 'text-red-400'}`}>
          {ultimo.ok ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {ultimo.ok ? `Verificado: ${ultimo.codigo}` : `Código no pertenece al pedido: ${ultimo.codigo}`}
        </div>
      )}

      {/* Líneas */}
      {loading ? (
        <div className="py-8 text-center text-slate-500 text-sm">Cargando líneas…</div>
      ) : (
        <div className="space-y-2">
          {lineasAVerificar.map(l => {
            const cod = l.producto_codigo.toUpperCase();
            const ver = verificados[cod] || 0;
            const completo = ver >= l.cantidad_pickeada;
            return (
              <div key={l.producto_codigo}
                className={`flex items-center justify-between p-3 rounded-xl border ${completo ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-700/50 bg-slate-800/30'}`}>
                <div className="min-w-0">
                  <div className="text-sm text-slate-200 truncate">{l.producto_nombre || l.producto_codigo}</div>
                  <div className="text-xs text-slate-500 font-mono">{l.producto_codigo}{l.lote_numero ? ` · lote ${l.lote_numero}` : ''}</div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-sm tabular-nums ${completo ? 'text-emerald-400' : 'text-slate-300'}`}>
                    {ver}/{l.cantidad_pickeada}
                  </span>
                  {completo
                    ? <Check className="h-5 w-5 text-emerald-400" />
                    : <Barcode className="h-5 w-5 text-slate-600" />}
                </div>
              </div>
            );
          })}
          {totalAVerificar === 0 && (
            <div className="py-6 text-center text-slate-500 text-sm">Esta orden no tiene unidades pickeadas para verificar.</div>
          )}
        </div>
      )}

      {/* Acción */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
        <span className="text-sm text-slate-400">
          {completos}/{totalAVerificar} líneas verificadas
        </span>
        <div className="flex gap-2">
          <button onClick={onCancelar} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm">
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={totalAVerificar > 0 && !todoVerificado}
            title={!todoVerificado ? 'Escaneá todas las líneas para continuar' : ''}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-sm flex items-center gap-2"
          >
            <PackageCheck className="h-4 w-4" /> Empaquetar y facturar
          </button>
        </div>
      </div>

      {usarCamara && (
        <BarcodeScanner
          onScan={(codigo) => { registrarEscaneo(codigo); setUsarCamara(false); }}
          onClose={() => setUsarCamara(false)}
        />
      )}
    </div>
  );
}

export default VerificacionEmpaque;
