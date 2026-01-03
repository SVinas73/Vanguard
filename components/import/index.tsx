'use client';

import React, { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Button, Modal } from '@/components/ui';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImportResult {
  total: number;
  success: number;
  errors: Array<{ row: number; error: string; data: any }>;
}

interface ImportCSVProps {
  onImportComplete?: () => void;
  userEmail: string;
}

export function ImportCSV({ onImportComplete, userEmail }: ImportCSVProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setPreview([]);
    setHeaders([]);
    setResult(null);
    setStep('upload');
    setImporting(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      alert('El archivo debe tener al menos una fila de encabezados y una de datos');
      return;
    }

    // Detectar separador (coma o punto y coma)
    const separator = lines[0].includes(';') ? ';' : ',';
    
    const headers = lines[0].split(separator).map(h => h.trim().toLowerCase().replace(/"/g, ''));
    setHeaders(headers);

    const data = lines.slice(1).map((line, index) => {
      const values = line.split(separator).map(v => v.trim().replace(/"/g, ''));
      const row: any = { _row: index + 2 };
      headers.forEach((header, i) => {
        row[header] = values[i] || '';
      });
      return row;
    }).filter(row => Object.values(row).some(v => v !== '' && v !== row._row));

    setPreview(data.slice(0, 10)); // Mostrar primeras 10 filas
    setStep('preview');
  };

  const mapHeaders = (headers: string[]): Record<string, string> => {
    // Mapeo flexible de nombres de columnas
    const mapping: Record<string, string[]> = {
      codigo: ['codigo', 'code', 'sku', 'id', 'producto_id', 'product_id'],
      descripcion: ['descripcion', 'description', 'nombre', 'name', 'producto', 'product'],
      precio: ['precio', 'price', 'precio_venta', 'sale_price', 'pvp'],
      categoria: ['categoria', 'category', 'tipo', 'type', 'grupo', 'group'],
      stock: ['stock', 'cantidad', 'quantity', 'qty', 'inventario', 'inventory'],
      stock_minimo: ['stock_minimo', 'min_stock', 'minimo', 'minimum', 'reorder_point'],
      costo: ['costo', 'cost', 'precio_compra', 'purchase_price', 'costo_unitario'],
    };

    const result: Record<string, string> = {};
    
    for (const [field, aliases] of Object.entries(mapping)) {
      const found = headers.find(h => aliases.includes(h.toLowerCase()));
      if (found) {
        result[field] = found;
      }
    }

    return result;
  };

  const handleImport = async () => {
    setImporting(true);
    const results: ImportResult = { total: 0, success: 0, errors: [] };
    const headerMap = mapHeaders(headers);

    // Validar que tengamos las columnas mínimas
    if (!headerMap.codigo || !headerMap.descripcion) {
      alert('El CSV debe tener al menos columnas de "codigo" y "descripcion"');
      setImporting(false);
      return;
    }

    // Procesar todas las filas (no solo preview)
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    const separator = lines[0].includes(';') ? ';' : ',';
    const allHeaders = lines[0].split(separator).map(h => h.trim().toLowerCase().replace(/"/g, ''));
    
    const allData = lines.slice(1).map((line, index) => {
      const values = line.split(separator).map(v => v.trim().replace(/"/g, ''));
      const row: any = { _row: index + 2 };
      allHeaders.forEach((header, i) => {
        row[header] = values[i] || '';
      });
      return row;
    }).filter(row => {
      const codigo = row[headerMap.codigo];
      return codigo && codigo.trim() !== '';
    });

    results.total = allData.length;

    for (const row of allData) {
      try {
        const codigo = row[headerMap.codigo]?.toString().toUpperCase().trim();
        const descripcion = row[headerMap.descripcion]?.toString().trim();
        
        if (!codigo || !descripcion) {
          results.errors.push({ row: row._row, error: 'Código o descripción vacío', data: row });
          continue;
        }

        const precio = parseFloat(row[headerMap.precio]) || 0;
        const categoria = row[headerMap.categoria] || 'General';
        const stock = parseInt(row[headerMap.stock]) || 0;
        const stockMinimo = parseInt(row[headerMap.stock_minimo]) || 10;
        const costo = parseFloat(row[headerMap.costo]) || 0;

        // Verificar si el producto ya existe
        const { data: existing } = await supabase
          .from('productos')
          .select('codigo')
          .eq('codigo', codigo)
          .single();

        if (existing) {
          // Actualizar
          const { error } = await supabase
            .from('productos')
            .update({
              descripcion,
              precio,
              categoria,
              stock,
              stock_minimo: stockMinimo,
              costo_promedio: costo,
              actualizado_por: userEmail,
              actualizado_at: new Date().toISOString(),
            })
            .eq('codigo', codigo);

          if (error) throw error;
        } else {
          // Insertar
          const { error } = await supabase
            .from('productos')
            .insert({
              codigo,
              descripcion,
              precio,
              categoria,
              stock,
              stock_minimo: stockMinimo,
              costo_promedio: costo,
              creado_por: userEmail,
              creado_at: new Date().toISOString(),
              actualizado_por: userEmail,
              actualizado_at: new Date().toISOString(),
            });

          if (error) throw error;
        }

        results.success++;
      } catch (error: any) {
        results.errors.push({ 
          row: row._row, 
          error: error.message || 'Error desconocido', 
          data: row 
        });
      }
    }

    setResult(results);
    setStep('result');
    setImporting(false);
    
    if (results.success > 0) {
      onImportComplete?.();
    }
  };

  const downloadTemplate = () => {
    const template = 'codigo;descripcion;precio;categoria;stock;stock_minimo;costo\nPROD-001;Producto de ejemplo;100.00;General;50;10;80.00\nPROD-002;Otro producto;250.50;Herramientas;25;5;200.00';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_productos.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Button variant="secondary" onClick={() => { resetState(); setIsOpen(true); }}>
        <Upload size={18} className="mr-2" />
        Importar CSV
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Importar Productos desde CSV"
      >
        {step === 'upload' && (
          <div className="space-y-4">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-500/50 hover:bg-slate-800/30 transition-all"
            >
              <FileSpreadsheet size={48} className="mx-auto mb-4 text-slate-500" />
              <div className="text-slate-300 mb-2">Click para seleccionar archivo CSV</div>
              <div className="text-xs text-slate-500">o arrastra y suelta aquí</div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileSelect}
              className="hidden"
            />

            <div className="p-4 rounded-xl bg-slate-800/50 space-y-2">
              <div className="text-sm font-medium text-slate-300">Formato esperado:</div>
              <div className="text-xs text-slate-400 space-y-1">
                <div>• Columnas: codigo, descripcion, precio, categoria, stock, stock_minimo, costo</div>
                <div>• Separador: coma (,) o punto y coma (;)</div>
                <div>• Primera fila: encabezados</div>
              </div>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 mt-2"
              >
                <Download size={16} />
                Descargar plantilla de ejemplo
              </button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-400">
                Vista previa (primeras 10 filas de {preview.length}+)
              </div>
              <div className="flex items-center gap-2">
                {mapHeaders(headers).codigo && mapHeaders(headers).descripcion ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-400">
                    <CheckCircle size={14} /> Columnas detectadas
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-red-400">
                    <XCircle size={14} /> Faltan columnas requeridas
                  </span>
                )}
              </div>
            </div>

            <div className="overflow-x-auto max-h-60 rounded-lg border border-slate-700">
              <table className="w-full text-xs">
                <thead className="bg-slate-800 sticky top-0">
                  <tr>
                    {headers.map((h, i) => (
                      <th key={i} className="px-3 py-2 text-left text-slate-400 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {preview.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-800/50">
                      {headers.map((h, j) => (
                        <td key={j} className="px-3 py-2 text-slate-300 truncate max-w-[150px]">
                          {row[h]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" onClick={resetState} className="flex-1">
                Cancelar
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={importing || !mapHeaders(headers).codigo}
                className="flex-1"
              >
                {importing ? 'Importando...' : 'Importar Productos'}
              </Button>
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-800/50 text-center">
                <div className="text-2xl font-bold text-slate-200">{result.total}</div>
                <div className="text-xs text-slate-500">Total</div>
              </div>
              <div className="p-4 rounded-xl bg-emerald-500/20 text-center">
                <div className="text-2xl font-bold text-emerald-400">{result.success}</div>
                <div className="text-xs text-emerald-400">Exitosos</div>
              </div>
              <div className="p-4 rounded-xl bg-red-500/20 text-center">
                <div className="text-2xl font-bold text-red-400">{result.errors.length}</div>
                <div className="text-xs text-red-400">Errores</div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 max-h-40 overflow-y-auto">
                <div className="text-sm font-medium text-red-400 mb-2">Errores:</div>
                <div className="space-y-1 text-xs text-red-300">
                  {result.errors.slice(0, 10).map((err, i) => (
                    <div key={i}>Fila {err.row}: {err.error}</div>
                  ))}
                  {result.errors.length > 10 && (
                    <div className="text-slate-500">... y {result.errors.length - 10} más</div>
                  )}
                </div>
              </div>
            )}

            <Button onClick={() => setIsOpen(false)} className="w-full">
              Cerrar
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}