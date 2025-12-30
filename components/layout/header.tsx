'use client';

import React from 'react';
import { User, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { AIStatusIndicator } from '@/components/analytics';

export function Header() {
  const { user, signOut } = useAuth(false);

  return (
    <header className="border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img 
              src="/vang.png" 
              alt="Vanguard" 
              className="w-10 h-10 rounded-xl object-cover"
            />
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                Vanguard<span className="text-emerald-400"></span>
              </h1>
              <p className="text-xs text-slate-500">Sistema de Gestión Inteligente</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <AIStatusIndicator />
            
            {user && (
              <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <User size={16} className="text-slate-400" />
                <span className="text-sm font-medium">{user.email}</span>
                <button
                  onClick={signOut}
                  className="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-red-400 transition-colors"
                  title="Cerrar sesión"
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