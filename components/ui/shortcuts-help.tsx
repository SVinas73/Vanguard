'use client';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpCircle, X } from 'lucide-react';

export function ShortcutsHelp() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const SHORTCUTS = [
    { keys: 'Ctrl + K', description: t('shortcuts.globalSearch') },
    { keys: 'Ctrl + B', description: t('shortcuts.scanBarcode') },
    { keys: 'Ctrl + N', description: t('shortcuts.newProduct') },
    { keys: 'Ctrl + M', description: t('shortcuts.newMovement') },
    { keys: 'Esc', description: t('shortcuts.closeModal') },
  ];

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 left-6 z-50 w-10 h-10 rounded-full bg-slate-800 border border-slate-700
                   flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700
                   transition-colors shadow-lg"
        title={t('shortcuts.title')}
      >
        <HelpCircle size={18} />
      </button>

      {/* Modal overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-200">{t('shortcuts.title')}</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              {SHORTCUTS.map((shortcut) => (
                <div
                  key={shortcut.keys}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/50"
                >
                  <span className="text-sm text-slate-300">{shortcut.description}</span>
                  <kbd className="px-2.5 py-1 text-xs font-mono rounded bg-slate-700 border border-slate-600 text-slate-300">
                    {shortcut.keys}
                  </kbd>
                </div>
              ))}
            </div>

            <p className="mt-4 text-xs text-slate-500 text-center">
              {t('shortcuts.pressEscToClose')}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
