'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, AlertCircle, WifiOff, RefreshCw, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// TIPOS
// ============================================

interface LoadingStateProps {
  status: 'loading' | 'error' | 'timeout' | 'offline' | 'success';
  message?: string;
  onRetry?: () => void;
  children?: React.ReactNode;
  className?: string;
  minHeight?: string;
}

interface QueryStateProps<T> {
  data: T | null;
  error: any;
  isLoading: boolean;
  timedOut?: boolean;
  onRetry?: () => void;
  children: (data: T) => React.ReactNode;
  loadingMessage?: string;
  emptyMessage?: string;
  className?: string;
}

// ============================================
// LOADING STATE COMPONENT
// ============================================

export function LoadingState({ 
  status, 
  message, 
  onRetry, 
  children,
  className,
  minHeight = 'min-h-[200px]'
}: LoadingStateProps) {
  const { t } = useTranslation();

  if (status === 'success' && children) {
    return <>{children}</>;
  }

  const configs = {
    loading: {
      icon: <Loader2 size={32} className="animate-spin text-emerald-400" />,
      title: message || t('common.loading'),
      subtitle: null,
      showRetry: false,
      bg: 'bg-slate-900/30',
    },
    error: {
      icon: <AlertCircle size={32} className="text-red-400" />,
      title: t('errors.loadingError'),
      subtitle: message || t('errors.tryAgain'),
      showRetry: true,
      bg: 'bg-red-500/5',
    },
    timeout: {
      icon: <Clock size={32} className="text-amber-400" />,
      title: t('errors.timeout'),
      subtitle: t('errors.slowConnection'),
      showRetry: true,
      bg: 'bg-amber-500/5',
    },
    offline: {
      icon: <WifiOff size={32} className="text-slate-400" />,
      title: t('errors.offline'),
      subtitle: t('errors.checkConnection'),
      showRetry: true,
      bg: 'bg-slate-800/50',
    },
    success: {
      icon: null,
      title: '',
      subtitle: null,
      showRetry: false,
      bg: '',
    },
  };

  const config = configs[status];

  return (
    <div className={cn(
      'flex flex-col items-center justify-center rounded-xl border border-slate-800/50',
      config.bg,
      minHeight,
      className
    )}>
      {config.icon}
      <p className="mt-3 text-slate-300 font-medium">{config.title}</p>
      {config.subtitle && (
        <p className="mt-1 text-sm text-slate-500">{config.subtitle}</p>
      )}
      {config.showRetry && onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors"
        >
          <RefreshCw size={16} />
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}

// ============================================
// QUERY STATE WRAPPER
// ============================================

export function QueryState<T>({ 
  data, 
  error, 
  isLoading,
  timedOut,
  onRetry,
  children,
  loadingMessage,
  emptyMessage,
  className
}: QueryStateProps<T>) {
  const { t } = useTranslation();

  // Determinar estado
  let status: 'loading' | 'error' | 'timeout' | 'offline' | 'success' = 'success';
  
  if (isLoading) {
    status = 'loading';
  } else if (timedOut) {
    status = 'timeout';
  } else if (error) {
    if (error.isNetworkError || !navigator.onLine) {
      status = 'offline';
    } else {
      status = 'error';
    }
  } else if (!data) {
    status = 'error';
  }

  if (status !== 'success') {
    return (
      <LoadingState
        status={status}
        message={status === 'loading' ? loadingMessage : error?.message}
        onRetry={onRetry}
        className={className}
      />
    );
  }

  // Verificar si está vacío (array sin elementos)
  if (Array.isArray(data) && data.length === 0) {
    return (
      <div className={cn(
        'flex flex-col items-center justify-center min-h-[200px] rounded-xl border border-slate-800/50 bg-slate-900/30',
        className
      )}>
        <p className="text-slate-500">{emptyMessage || t('common.noData')}</p>
      </div>
    );
  }

  return <>{children(data!)}</>;
}

// ============================================
// INLINE LOADING (para dentro de cards)
// ============================================

interface InlineLoadingProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

export function InlineLoading({ size = 'md', message }: InlineLoadingProps) {
  const { t } = useTranslation();
  const sizes = {
    sm: 16,
    md: 20,
    lg: 24,
  };

  return (
    <div className="flex items-center gap-2 text-slate-400">
      <Loader2 size={sizes[size]} className="animate-spin" />
      {message && <span className="text-sm">{message}</span>}
    </div>
  );
}

// ============================================
// ERROR INLINE (para dentro de cards)
// ============================================

interface InlineErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function InlineError({ message, onRetry }: InlineErrorProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2 text-red-400">
      <AlertCircle size={18} />
      <span className="text-sm">{message || t('errors.loadingError')}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="ml-2 p-1 rounded hover:bg-slate-800 transition-colors"
        >
          <RefreshCw size={14} />
        </button>
      )}
    </div>
  );
}