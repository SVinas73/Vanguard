'use client';

import React from 'react';
import { User, LogOut, Shield, ShoppingCart, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { AIStatusIndicator } from '@/components/analytics';
import { LanguageSelector } from '@/components/ui/language-selector';
import { cn } from '@/lib/utils';

export function Header() {
  const { t } = useTranslation();
  const { user, signOut, rol } = useAuth(false);

  const rolConfig = {
    admin: { label: 'Admin', color: 'text-emerald-400', bg: 'bg-emerald-500/20', icon: Shield },
    vendedor: { label: t('roles.seller') || 'Vendedor', color: 'text-cyan-400', bg: 'bg-cyan-500/20', icon: ShoppingCart },
    bodeguero: { label: t('roles.warehouse') || 'Bodeguero', color: 'text-amber-400', bg: 'bg-amber-500/20', icon: Package },
    operador: { label: t('roles.operator') || 'Operador', color: 'text-purple-400', bg: 'bg-purple-500/20', icon: User },
  };

  const currentRol = rolConfig[rol] || rolConfig.vendedor;
  const RolIcon = currentRol.icon;

  return (
    <header className="border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img 
              src="/vang.png" 
              alt="Vanguard" 
              className="w-10 h-10 object-contain rounded-lg"
              style={{ backgroundColor: '#020617' }}
            />
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                Vanguard<span className="text-emerald-400"></span>
              </h1>
              <p className="text-xs text-slate-500">{t('header.subtitle') || 'Sistema de Gestión de Inventarios'}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <AIStatusIndicator />
            
            <LanguageSelector />
            
            {user && (
              <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <User size={16} className="text-slate-400" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{user.nombre || user.email}</span>
                  <span className={cn(
                    'text-xs flex items-center gap-1',
                    currentRol.color
                  )}>
                    <RolIcon size={10} />
                    {currentRol.label}
                  </span>
                </div>
                <button
                  onClick={signOut}
                  className="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-red-400 transition-colors"
                  title={t('header.logout') || 'Cerrar sesión'}
                >
                  <LogOut size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}