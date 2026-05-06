'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, ArrowUp, ArrowDown, CornerDownLeft, X,
  Package, ShoppingCart, TrendingUp, Wrench, Warehouse,
  Kanban, Shield, ShieldCheck, FileText, BarChart3,
  Plug, MessageCircle, Users, DollarSign, QrCode,
  GitBranch, RotateCcw, Boxes, Brain, Zap, Sparkles,
  Settings, LayoutDashboard, Receipt,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TabType } from '@/types';

// =====================================================
// COMMAND PALETTE — Cmd+K / Ctrl+K
// =====================================================
// UX inspirada en Linear / Raycast:
// - Atajo global Cmd+K (o Ctrl+K).
// - Búsqueda fuzzy entre módulos + acciones rápidas.
// - Navegación 100% por teclado (↑↓ + Enter + Esc).
// - Soporta "scope": acción puede ser navegar a tab, abrir
//   chatbot con un prompt, o abrir un modal.
// =====================================================

export type CommandAction =
  | { type: 'navigate'; tab: TabType }
  | { type: 'navigate-sub'; tab: TabType; subTab: string }
  | { type: 'chat'; prompt: string }
  | { type: 'modal'; modal: string }
  | { type: 'external'; url: string };

export interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: React.ElementType;
  category: 'Navegación' | 'Crear' | 'IA' | 'Reportes' | 'Sistema';
  keywords?: string[];
  action: CommandAction;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onAction: (action: CommandAction) => void;
}

// =====================================================
// DEFINICIÓN DE COMANDOS DEL SISTEMA
// =====================================================

const COMMANDS: Command[] = [
  // ----- Navegación: Principal -----
  { id: 'nav-dashboard', label: 'Ir al Dashboard', icon: LayoutDashboard, category: 'Navegación',
    keywords: ['inicio', 'home', 'panel'], action: { type: 'navigate', tab: 'dashboard' } },
  { id: 'nav-stock', label: 'Ir a Stock / Productos', icon: Package, category: 'Navegación',
    keywords: ['inventario', 'productos'], action: { type: 'navigate', tab: 'stock' } },
  { id: 'nav-movimientos', label: 'Ir a Transacciones de Movimientos', icon: TrendingUp, category: 'Navegación',
    keywords: ['movimientos', 'transacciones'], action: { type: 'navigate', tab: 'movimientos' } },
  { id: 'nav-chat', label: 'Ir a Chat interno', icon: MessageCircle, category: 'Navegación',
    keywords: ['mensajes', 'conversaciones'], action: { type: 'navigate', tab: 'chat' } },

  // ----- Navegación: Operaciones -----
  { id: 'nav-comercial', label: 'Ir a Comercial', icon: DollarSign, category: 'Navegación',
    keywords: ['ventas', 'compras', 'cotizaciones', 'finanzas'], action: { type: 'navigate', tab: 'comercial' } },
  { id: 'nav-comercial-ventas', label: 'Comercial → Ventas', icon: TrendingUp, category: 'Navegación',
    action: { type: 'navigate-sub', tab: 'comercial', subTab: 'ventas' } },
  { id: 'nav-comercial-compras', label: 'Comercial → Compras', icon: ShoppingCart, category: 'Navegación',
    action: { type: 'navigate-sub', tab: 'comercial', subTab: 'compras' } },
  { id: 'nav-comercial-finanzas', label: 'Comercial → Finanzas', icon: DollarSign, category: 'Navegación',
    keywords: ['cxc', 'cxp', 'notas', 'cheques'], action: { type: 'navigate-sub', tab: 'comercial', subTab: 'finanzas' } },
  { id: 'nav-comercial-comisiones', label: 'Comercial → Comisiones', icon: DollarSign, category: 'Navegación',
    action: { type: 'navigate-sub', tab: 'comercial', subTab: 'comisiones' } },

  { id: 'nav-proyectos', label: 'Ir a Proyectos', icon: Kanban, category: 'Navegación',
    action: { type: 'navigate', tab: 'proyectos' } },
  { id: 'nav-taller', label: 'Ir a Taller', icon: Wrench, category: 'Navegación',
    keywords: ['ot', 'orden de trabajo', 'reparacion'], action: { type: 'navigate', tab: 'taller' } },
  { id: 'nav-wms', label: 'Ir a WMS', icon: Warehouse, category: 'Navegación',
    keywords: ['picking', 'recepcion', 'almacen', 'putaway', 'packing'], action: { type: 'navigate', tab: 'wms' } },
  { id: 'nav-facturacion', label: 'Ir a Facturación electrónica', icon: Receipt, category: 'Navegación',
    keywords: ['cfe', 'dgi', 'factura'], action: { type: 'navigate', tab: 'facturacion' } },

  // ----- Navegación: Análisis -----
  { id: 'nav-analytics', label: 'Ir a Analytics IA', icon: Brain, category: 'Navegación',
    action: { type: 'navigate', tab: 'analytics' } },
  { id: 'nav-demand', label: 'Ir a Demand Planning', icon: Zap, category: 'Navegación',
    keywords: ['demanda', 'forecast'], action: { type: 'navigate', tab: 'demand' } },
  { id: 'nav-reportes', label: 'Ir a Reportes', icon: FileText, category: 'Navegación',
    action: { type: 'navigate', tab: 'reportes' } },

  // ----- Navegación: Control -----
  { id: 'nav-aprobaciones', label: 'Ir a Aprobaciones', icon: Shield, category: 'Navegación',
    keywords: ['inbox', 'pendientes'], action: { type: 'navigate', tab: 'aprobaciones' } },
  { id: 'nav-seriales', label: 'Ir a Seriales', icon: QrCode, category: 'Navegación',
    action: { type: 'navigate', tab: 'seriales' } },
  { id: 'nav-trazabilidad', label: 'Ir a Trazabilidad', icon: GitBranch, category: 'Navegación',
    keywords: ['lotes', 'series'], action: { type: 'navigate', tab: 'trazabilidad' } },
  { id: 'nav-rma', label: 'Ir a RMA / Devoluciones', icon: RotateCcw, category: 'Navegación',
    action: { type: 'navigate', tab: 'rma' } },
  { id: 'nav-qms', label: 'Ir a QMS / Calidad', icon: ShieldCheck, category: 'Navegación',
    keywords: ['no conformidad', 'certificados'], action: { type: 'navigate', tab: 'qms' } },
  { id: 'nav-bom', label: 'Ir a BOM', icon: Boxes, category: 'Navegación',
    keywords: ['bill of materials'], action: { type: 'navigate', tab: 'bom' } },
  { id: 'nav-ensamblajes', label: 'Ir a Ensamblajes', icon: Wrench, category: 'Navegación',
    action: { type: 'navigate', tab: 'ensamblajes' } },
  { id: 'nav-auditoria', label: 'Ir a Auditoría', icon: Shield, category: 'Navegación',
    action: { type: 'navigate', tab: 'auditoria' } },

  // ----- Navegación: Configuración -----
  { id: 'nav-integraciones', label: 'Ir a Integraciones', icon: Plug, category: 'Sistema',
    action: { type: 'navigate', tab: 'integraciones' } },

  // ----- IA / Chatbot -----
  { id: 'ia-resumen-dia', label: 'IA → Resumen ejecutivo de hoy', icon: Sparkles, category: 'IA',
    keywords: ['mi dia', 'resumen', 'kpis'],
    action: { type: 'chat', prompt: 'Hacé un resumen ejecutivo de mi día según mi rol' } },
  { id: 'ia-stock-critico', label: 'IA → ¿Qué productos están críticos?', icon: Sparkles, category: 'IA',
    action: { type: 'chat', prompt: '¿Qué productos están con stock crítico o agotado?' } },
  { id: 'ia-ventas-mes', label: 'IA → ¿Cómo van las ventas del mes?', icon: Sparkles, category: 'IA',
    action: { type: 'chat', prompt: '¿Cómo vienen las ventas del mes? Comparalas con el mes anterior' } },
  { id: 'ia-cxc-vencidas', label: 'IA → CxC vencidas', icon: Sparkles, category: 'IA',
    action: { type: 'chat', prompt: 'Mostrame las cuentas por cobrar vencidas y el total adeudado' } },
  { id: 'ia-aprobaciones', label: 'IA → ¿Qué tengo pendiente de aprobar?', icon: Sparkles, category: 'IA',
    action: { type: 'chat', prompt: '¿Qué aprobaciones tengo pendientes ahora mismo?' } },
  { id: 'ia-picking', label: 'IA → ¿Qué picking tengo pendiente?', icon: Sparkles, category: 'IA',
    action: { type: 'chat', prompt: '¿Qué órdenes de picking tengo pendientes y cuáles están sin asignar?' } },
  { id: 'ia-recomendaciones', label: 'IA → Recomendaciones de reposición', icon: Sparkles, category: 'IA',
    action: { type: 'chat', prompt: 'Generá recomendaciones de reposición priorizadas por urgencia' } },
  { id: 'ia-guia', label: 'IA → ¿Cómo hago algo? (guía)', icon: Sparkles, category: 'IA',
    keywords: ['ayuda', 'tour', 'donde'],
    action: { type: 'chat', prompt: '¿Cómo hago una cotización paso a paso?' } },

  // ----- Sistema -----
  { id: 'sys-focus', label: 'Activar Focus Mode (sin distracciones)', icon: Settings, category: 'Sistema',
    keywords: ['concentracion', 'zen'],
    action: { type: 'modal', modal: 'focus-toggle' } },
];

// =====================================================
// FUZZY SEARCH SIMPLE
// =====================================================
// Score: substring match en label/keywords. No es Levenshtein
// completo pero alcanza para listas de ~50 comandos.

function scoreCommand(cmd: Command, query: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const label = cmd.label.toLowerCase();
  const kw = (cmd.keywords || []).join(' ').toLowerCase();
  const cat = cmd.category.toLowerCase();

  // Exact start match en label = mejor
  if (label.startsWith(q)) return 100;
  // Substring en label
  if (label.includes(q)) return 50;
  // Match en keywords
  if (kw.includes(q)) return 30;
  // Match en categoría
  if (cat.includes(q)) return 10;

  // Fuzzy: todas las letras del query aparecen en orden
  let i = 0;
  for (const ch of label) {
    if (ch === q[i]) i++;
    if (i === q.length) return 5;
  }
  return 0;
}

// =====================================================
// COMPONENTE
// =====================================================

export function CommandPalette({ open, onClose, onAction }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    return COMMANDS
      .map(c => ({ cmd: c, score: scoreCommand(c, query) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
      .map(({ cmd }) => cmd);
  }, [query]);

  const grouped = useMemo(() => {
    const g: Record<string, Command[]> = {};
    for (const c of filtered) {
      if (!g[c.category]) g[c.category] = [];
      g[c.category].push(c);
    }
    return g;
  }, [filtered]);

  const flatList = filtered;

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  // Auto-scroll del item activo
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-cmd-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  if (!open || typeof document === 'undefined') return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, flatList.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = flatList[activeIdx];
      if (cmd) {
        onAction(cmd.action);
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Search box */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
          <Search className="h-4 w-4 text-slate-500 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar módulo, acción o pedíle algo a la IA..."
            className="flex-1 bg-transparent text-slate-100 text-sm placeholder:text-slate-500 outline-none"
          />
          <kbd className="hidden sm:inline-flex px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-500 font-mono">
            Esc
          </kbd>
        </div>

        {/* Lista de comandos */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1">
          {flatList.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              No hay resultados para <span className="text-slate-300">"{query}"</span>
              <div className="text-xs mt-2">
                Tip: probá con "ventas", "stock", "facturar", "como hago..."
              </div>
            </div>
          ) : Object.entries(grouped).map(([cat, cmds]) => (
            <div key={cat} className="mb-1">
              <div className="px-4 py-1.5 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                {cat}
              </div>
              {cmds.map(cmd => {
                const idx = flatList.indexOf(cmd);
                const Icon = cmd.icon;
                const isActive = idx === activeIdx;
                return (
                  <button
                    key={cmd.id}
                    data-cmd-idx={idx}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => { onAction(cmd.action); onClose(); }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors',
                      isActive ? 'bg-blue-500/15 text-slate-100' : 'text-slate-300 hover:bg-slate-800/50'
                    )}
                  >
                    <Icon className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-blue-400' : 'text-slate-500')} />
                    <span className="flex-1 text-sm">{cmd.label}</span>
                    {cmd.hint && <span className="text-xs text-slate-500">{cmd.hint}</span>}
                    {isActive && (
                      <CornerDownLeft className="h-3 w-3 text-slate-500" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-slate-800 bg-slate-950/50 text-[10px] text-slate-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <ArrowUp className="h-3 w-3" /><ArrowDown className="h-3 w-3" /> navegar
            </span>
            <span className="flex items-center gap-1">
              <CornerDownLeft className="h-3 w-3" /> seleccionar
            </span>
            <span className="flex items-center gap-1">
              <X className="h-3 w-3" /> cerrar
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-purple-400" />
            <span className="text-purple-400">IA disponible</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// =====================================================
// HOOK PARA REGISTRAR EL ATAJO GLOBAL
// =====================================================

export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return { open, setOpen };
}
