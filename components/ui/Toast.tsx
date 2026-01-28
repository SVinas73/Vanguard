'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ============================================
// TIPOS
// ============================================

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

// ============================================
// CONTEXT
// ============================================

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// ============================================
// PROVIDER
// ============================================

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const duration = toast.duration ?? 4000;

      setToasts((prev) => [...prev, { ...toast, id }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback(
    (title: string, message?: string) => {
      addToast({ type: 'success', title, message });
    },
    [addToast]
  );

  const error = useCallback(
    (title: string, message?: string) => {
      addToast({ type: 'error', title, message, duration: 6000 });
    },
    [addToast]
  );

  const warning = useCallback(
    (title: string, message?: string) => {
      addToast({ type: 'warning', title, message, duration: 5000 });
    },
    [addToast]
  );

  const info = useCallback(
    (title: string, message?: string) => {
      addToast({ type: 'info', title, message });
    },
    [addToast]
  );

  return (
    <ToastContext.Provider
      value={{ toasts, addToast, removeToast, success, error, warning, info }}
    >
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

// ============================================
// TOAST CONTAINER
// ============================================

interface ToastContainerProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

// ============================================
// TOAST ITEM
// ============================================

interface ToastItemProps {
  toast: Toast;
  onClose: () => void;
}

function ToastItem({ toast, onClose }: ToastItemProps) {
  const config = {
    success: {
      icon: CheckCircle,
      bg: 'bg-emerald-500/10 border-emerald-500/30',
      iconColor: 'text-emerald-400',
      titleColor: 'text-emerald-300',
    },
    error: {
      icon: XCircle,
      bg: 'bg-red-500/10 border-red-500/30',
      iconColor: 'text-red-400',
      titleColor: 'text-red-300',
    },
    warning: {
      icon: AlertTriangle,
      bg: 'bg-amber-500/10 border-amber-500/30',
      iconColor: 'text-amber-400',
      titleColor: 'text-amber-300',
    },
    info: {
      icon: Info,
      bg: 'bg-blue-500/10 border-blue-500/30',
      iconColor: 'text-blue-400',
      titleColor: 'text-blue-300',
    },
  };

  const { icon: Icon, bg, iconColor, titleColor } = config[toast.type];

  return (
    <div
      className={`
        pointer-events-auto
        flex items-start gap-3 p-4 
        bg-slate-900 border ${bg} 
        rounded-xl shadow-lg shadow-black/20
        animate-slide-in-right
      `}
    >
      <Icon className={`h-5 w-5 ${iconColor} flex-shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <p className={`font-medium ${titleColor}`}>{toast.title}</p>
        {toast.message && (
          <p className="text-sm text-slate-400 mt-0.5">{toast.message}</p>
        )}
      </div>
      <button
        onClick={onClose}
        className="flex-shrink-0 p-1 hover:bg-slate-800 rounded-lg transition-colors"
      >
        <X className="h-4 w-4 text-slate-500" />
      </button>
    </div>
  );
}