import React from 'react';
import { cn } from '@/lib/utils';
import { Bot, AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';

// ============================================
// BUTTON
// ============================================

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  children,
  ...props
}: ButtonProps) {
  const variants = {
    primary: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold',
    secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700',
    danger: 'bg-red-500 hover:bg-red-400 text-white font-semibold',
    ghost: 'hover:bg-slate-800 text-slate-400 hover:text-slate-200',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={cn(
        'rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ============================================
// INPUT
// ============================================

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ className, label, error, ...props }: InputProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm text-slate-400">{label}</label>
      )}
      <input
        className={cn(
          'w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50',
          'focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20',
          'text-sm placeholder:text-slate-500 transition-all',
          error && 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ============================================
// SELECT
// ============================================

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

export function Select({
  className,
  label,
  options,
  placeholder,
  ...props
}: SelectProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm text-slate-400">{label}</label>
      )}
      <select
        className={cn(
          'w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50',
          'focus:border-emerald-500/50 focus:outline-none text-sm',
          'appearance-none cursor-pointer',
          className
        )}
        {...props}
      >
        {placeholder && (
          <option value="">{placeholder}</option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ============================================
// CARD
// ============================================

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'gradient';
}

export function Card({ className, variant = 'default', children, ...props }: CardProps) {
  const variants = {
    default: 'bg-slate-900/50 border-slate-800/50 hover:border-slate-700/50',
    gradient: 'bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 border-emerald-500/20',
  };

  return (
    <div
      className={cn(
        'p-5 rounded-2xl border transition-all',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ============================================
// BADGE
// ============================================

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
}

export function Badge({ children, color, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'px-2 py-0.5 rounded-full text-xs border',
        color || 'bg-slate-500/20 text-slate-300 border-slate-500/30',
        className
      )}
    >
      {children}
    </span>
  );
}

// ============================================
// MODAL
// ============================================

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 rounded-2xl border border-slate-800 p-6 w-full max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

// ============================================
// AI ALERT
// ============================================

interface AIAlertProps {
  type: 'warning' | 'danger' | 'info' | 'success';
  children: React.ReactNode;
}

export function AIAlert({ type, children }: AIAlertProps) {
  const styles = {
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-200',
    danger: 'bg-red-500/10 border-red-500/30 text-red-200',
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-200',
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200',
  };

  const icons = {
    warning: <AlertTriangle size={18} />,
    danger: <XCircle size={18} />,
    info: <Bot size={18} />,
    success: <CheckCircle size={18} />,
  };

  return (
    <div
      className={cn(
        'px-3 py-2 rounded-lg border text-sm flex items-center gap-2',
        styles[type]
      )}
    >
      {icons[type]}
      {children}
    </div>
  );
}