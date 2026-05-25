'use client';

import React from 'react';
import { User, LogOut, Shield, ShoppingCart, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { AIStatusIndicator } from '@/components/analytics';
import { LanguageSelector } from '@/components/ui/language-selector';
import { Logo } from '@/components/ui/Logo';
import { NotificacionesBell } from '@/components/proyectos/NotificacionesBell';
import { OrgSwitcher } from '@/components/organization';

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
    <header className="border-b border-[#1A1A1A] bg-[#0D0D0D]/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo size={26} />
            <div>
              <h1 className="text-[13px] font-medium text-[#F1F1F1] tracking-tight leading-none">
                Vanguard
              </h1>
              <p className="text-[10px] text-[#6B6B6B] mt-0.5">
                {t('header.subtitle') || 'Sistema de Gestión Inteligente'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user && <OrgSwitcher />}
            <AIStatusIndicator />
            <NotificacionesBell />
            <LanguageSelector />

            {user && (
              <div className="flex items-center gap-2 pl-2.5 border-l border-[#1A1A1A]">
                <div className="w-6 h-6 rounded flex items-center justify-center text-[11px] font-medium bg-[#1A1A1A] text-[#F1F1F1] ring-1 ring-inset ring-[#2E2E2E]">
                  {(user.nombre || user.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-[12px] font-medium text-[#F1F1F1]">{user.nombre || user.email?.split('@')[0]}</span>
                  <span className="text-[10px] text-[#6B6B6B] flex items-center gap-1">
                    <RolIcon size={9} />
                    {currentRol.label}
                  </span>
                </div>
                <button
                  onClick={signOut}
                  className="p-1 rounded hover:bg-[#1A1A1A] text-[#6B6B6B] hover:text-red-400 transition-colors"
                  title={t('header.logout') || 'Cerrar sesión'}
                >
                  <LogOut size={13} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
