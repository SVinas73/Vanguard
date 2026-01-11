'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage, availableLanguages } from '@/lib/i18n';
import { Globe, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LanguageSelectorProps {
  collapsed?: boolean;
}

export function LanguageSelector({ collapsed = false }: LanguageSelectorProps) {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 text-sm',
        collapsed && 'justify-center px-2'
      )}>
        <Globe size={16} className="text-slate-400" />
        {!collapsed && <span>🇪🇸</span>}
      </div>
    );
  }

  const currentLang = availableLanguages.find(l => l.code === i18n.language) || availableLanguages[0];

  const handleChange = (code: string) => {
    changeLanguage(code);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        title={collapsed ? currentLang.name : undefined}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 transition-colors text-sm w-full',
          collapsed && 'justify-center px-2'
        )}
      >
        <Globe size={18} className="text-slate-400" />
        {!collapsed && (
          <>
            <span>{currentLang.flag}</span>
            <span className="flex-1 text-left text-slate-300">{currentLang.name}</span>
            <ChevronDown size={14} className={cn('text-slate-400 transition-transform', isOpen && 'rotate-180')} />
          </>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className={cn(
            'absolute bottom-full mb-2 py-2 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 min-w-[160px]',
            collapsed ? 'left-full ml-2 bottom-auto top-0' : 'left-0'
          )}>
            {availableLanguages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleChange(lang.code)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors',
                  i18n.language === lang.code
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-slate-300 hover:bg-slate-800'
                )}
              >
                <span className="text-lg">{lang.flag}</span>
                <span className="text-sm">{lang.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}