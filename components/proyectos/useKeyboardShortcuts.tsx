'use client';

import { useEffect, useCallback, useState } from 'react';

interface ShortcutAction {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
  category: string;
}

interface UseKeyboardShortcutsProps {
  enabled?: boolean;
  shortcuts: ShortcutAction[];
}

export function useKeyboardShortcuts({ enabled = true, shortcuts }: UseKeyboardShortcutsProps) {
  const [showHelp, setShowHelp] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      if (e.key !== 'Escape') return;
    }

    const matchingShortcut = shortcuts.find(shortcut => {
      const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
      const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
      const altMatch = shortcut.alt ? e.altKey : !e.altKey;
      return keyMatch && ctrlMatch && shiftMatch && altMatch;
    });

    if (matchingShortcut) {
      e.preventDefault();
      matchingShortcut.action();
    }

    if (e.key === '?' && e.shiftKey) {
      e.preventDefault();
      setShowHelp(prev => !prev);
    }
  }, [enabled, shortcuts]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { showHelp, setShowHelp };
}

export function formatShortcutKey(shortcut: ShortcutAction): string {
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push('⌘');
  if (shortcut.shift) parts.push('⇧');
  if (shortcut.alt) parts.push('⌥');
  const keyMap: Record<string, string> = {
    'escape': 'Esc', 'enter': '↵', 'arrowup': '↑', 'arrowdown': '↓',
    'delete': 'Del', 'backspace': '⌫', 'space': 'Space'
  };
  parts.push(keyMap[shortcut.key.toLowerCase()] || shortcut.key.toUpperCase());
  return parts.join(' + ');
}

export function KeyboardShortcutsHelp({ shortcuts, isOpen, onClose }: {
  shortcuts: ShortcutAction[];
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  const byCategory = shortcuts.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {} as Record<string, ShortcutAction[]>);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-6">Atajos de Teclado</h2>
        {Object.entries(byCategory).map(([cat, items]) => (
          <div key={cat} className="mb-4">
            <h3 className="text-sm text-slate-400 uppercase mb-2">{cat}</h3>
            {items.map((s, i) => (
              <div key={i} className="flex justify-between py-1.5">
                <span className="text-sm">{s.description}</span>
                <kbd className="px-2 py-0.5 bg-slate-800 rounded text-xs text-emerald-400">{formatShortcutKey(s)}</kbd>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function useProyectoShortcuts(handlers: {
  onNuevaTarea?: () => void;
  onNuevoProyecto?: () => void;
  onBuscar?: () => void;
  onCerrarModal?: () => void;
  onGuardar?: () => void;
  onToggleVista?: () => void;
  onToggleFiltros?: () => void;
  onRefresh?: () => void;
  onEditarTarea?: () => void;
  onEliminarTarea?: () => void;
  onDuplicarTarea?: () => void;
  onCompletarTarea?: () => void;
}) {
  const shortcuts: ShortcutAction[] = [
    { key: 'n', action: handlers.onNuevaTarea || (() => {}), description: 'Nueva tarea', category: 'Creación' },
    { key: 'n', shift: true, action: handlers.onNuevoProyecto || (() => {}), description: 'Nuevo proyecto', category: 'Creación' },
    { key: 'f', ctrl: true, action: handlers.onBuscar || (() => {}), description: 'Buscar', category: 'Navegación' },
    { key: 'Escape', action: handlers.onCerrarModal || (() => {}), description: 'Cerrar modal', category: 'General' },
    { key: 's', ctrl: true, action: handlers.onGuardar || (() => {}), description: 'Guardar', category: 'General' },
    { key: 'v', action: handlers.onToggleVista || (() => {}), description: 'Cambiar vista', category: 'Vistas' },
    { key: 'f', action: handlers.onToggleFiltros || (() => {}), description: 'Filtros', category: 'Vistas' },
    { key: 'r', action: handlers.onRefresh || (() => {}), description: 'Actualizar', category: 'General' },
    { key: 'e', action: handlers.onEditarTarea || (() => {}), description: 'Editar tarea', category: 'Tareas' },
    { key: 'd', action: handlers.onDuplicarTarea || (() => {}), description: 'Duplicar tarea', category: 'Tareas' },
    { key: 'Delete', action: handlers.onEliminarTarea || (() => {}), description: 'Eliminar tarea', category: 'Tareas' },
    { key: 'x', action: handlers.onCompletarTarea || (() => {}), description: 'Completar tarea', category: 'Tareas' },
  ];
  return useKeyboardShortcuts({ shortcuts });
}