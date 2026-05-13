'use client';

import React from 'react';
import { User, LogOut, Shield, ShoppingCart, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { AIStatusIndicator } from '@/components/analytics';
import { LanguageSelector } from '@/components/ui/language-selector';
import { Logo } from '@/components/ui/Logo';
import { NotificacionesBell } from '@/components/proyectos/NotificacionesBell';

import { cn } from '@/lib/utils';

export function Header() {
  const { t } = useTranslation();
  const { user, signOut, rol } = useAuth(false);

  const rolConfig = {
    admin: { label: 'Admin', icon: Shield },
    vendedor: { label: t('roles.seller') || 'Vendedor', icon: ShoppingCart },
    bodeguero: { label: t('roles.warehouse') || 'Bodeguero', icon: Package },
    operador: { label: t('roles.operator') || 'Operador', icon: User },
  };

  const currentRol = rolConfig[rol] || rolConfig.vendedor;
  const RolIcon = currentRol.icon;

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={32} />
            <div>
              <h1 className="text-sm font-semibold text-slate-100 tracking-tight leading-none">
                Vanguard
              </h1>
              <p className="text-[11px] text-slate-500 mt-1">
                {t('header.subtitle') || 'Sistema de Gestión Inteligente'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <AIStatusIndicator />
            <NotificacionesBell />
            <LanguageSelector />

            {user && (
              <div className="flex items-center gap-2.5 pl-3 border-l border-slate-800">
                <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-semibold bg-slate-800 text-slate-200 ring-1 ring-inset ring-slate-700">
                  {(user.nombre || user.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-[13px] font-medium text-slate-100">{user.nombre || user.email?.split('@')[0]}</span>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <RolIcon size={10} />
                    {currentRol.label}
                  </span>
                </div>
                <button
                  onClick={signOut}
                  className="p-1.5 rounded-md hover:bg-slate-900 text-slate-500 hover:text-red-400 transition-colors"
                  title={t('header.logout') || 'Cerrar sesión'}
                >
                  <LogOut size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}