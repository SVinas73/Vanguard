'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { LogIn, UserPlus, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (isLogin) {
        console.log('🚀 Attempting login with:', { email });
        
        const result = await signIn('credentials', {
          email,
          password,
          redirect: false,
        });

        console.log('📥 SignIn result:', result);

        if (result?.error) {
          console.error('❌ Login error:', result.error);
          setError('Credenciales inválidas');
          setLoading(false);
          return;
        }

        if (result?.ok) {
          console.log('✅ Login successful, redirecting...');
          // Usar window.location para asegurar recarga completa
          window.location.href = '/';
        } else {
          console.error('⚠️ Login not OK');
          setError('Error al iniciar sesión');
          setLoading(false);
        }
        
      } else {
        // Registro
        console.log('📝 Attempting registration with:', { email, name });
        
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name }),
        });

        const data = await res.json();
        console.log('📥 Registration response:', data);

        if (!res.ok) {
          throw new Error(data.error || 'Error en el registro');
        }

        setMessage('¡Registro exitoso! Ahora podés iniciar sesión.');
        setIsLogin(true);
        setPassword('');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('💥 Caught error:', err);
      setError(err.message || 'Ocurrió un error');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Logo size={64} />
          <h1 className="text-2xl font-bold mt-3 text-slate-100">Vanguard</h1>
          <p className="text-slate-500 text-sm mt-1">Sistema de Gestión Inteligente</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
            {isLogin ? <LogIn size={20} /> : <UserPlus size={20} />}
            {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name (solo en registro) */}
            {!isLogin && (
              <div className="space-y-1">
                <label className="block text-sm text-slate-400">Nombre</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 focus:border-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-600/20 text-sm"
                  placeholder="Tu nombre"
                  required={!isLogin}
                  disabled={loading}
                />
              </div>
            )}

            {/* Email */}
            <div className="space-y-1">
              <label className="block text-sm text-slate-400">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 focus:border-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-600/20 text-sm"
                  placeholder="tu@email.com"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="block text-sm text-slate-400">Contraseña</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 focus:border-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-600/20 text-sm"
                  placeholder="••••••••"
                  required
                  minLength={6}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Success message */}
            {message && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm">
                {message}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Cargando...' : isLogin ? 'Ingresar' : 'Crear Cuenta'}
            </button>
          </form>

          {/* Toggle */}
          <div className="mt-6 text-center text-sm">
            <span className="text-slate-500">
              {isLogin ? '¿No tenés cuenta?' : '¿Ya tenés cuenta?'}
            </span>
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setMessage('');
              }}
              disabled={loading}
              className="ml-2 text-emerald-400 hover:underline disabled:opacity-50"
            >
              {isLogin ? 'Registrate' : 'Iniciá sesión'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}