import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
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
// SELECT (Custom Dropdown)
// ============================================

interface SelectProps {
  label?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  value?: string;
  onChange?: (e: { target: { value: string } }) => void;
  className?: string;
}

export function Select({
  className,
  label,
  options,
  placeholder,
  value,
  onChange,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState(value || '');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync with external value
  useEffect(() => {
    if (value !== undefined) {
      setSelected(value);
    }
  }, [value]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optValue: string) => {
    setSelected(optValue);
    setIsOpen(false);
    if (onChange) {
      onChange({ target: { value: optValue } });
    }
  };

  const selectedLabel = options.find((o) => o.value === selected)?.label || placeholder || 'Seleccionar...';

  return (
    <div className={cn('space-y-1 relative', className)} ref={dropdownRef}>
      {label && (
        <label className="block text-sm text-slate-400">{label}</label>
      )}
      
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50',
          'focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20',
          'text-sm text-left flex items-center justify-between transition-all',
          isOpen && 'border-emerald-500/50 ring-2 ring-emerald-500/20'
        )}
      >
        <span className={selected ? 'text-slate-200' : 'text-slate-500'}>
          {selectedLabel}
        </span>
        <ChevronDown 
          size={16} 
          className={cn(
            'text-slate-400 transition-transform duration-200',
            isOpen && 'rotate-180'
          )} 
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 py-1 rounded-xl bg-slate-800 border border-slate-700/50 shadow-xl shadow-black/20 max-h-60 overflow-y-auto">
          {placeholder && (
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={cn(
                'w-full px-4 py-2 text-sm text-left transition-colors',
                selected === '' 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : 'text-slate-400 hover:bg-slate-700/50'
              )}
            >
              {placeholder}
            </button>
          )}
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt.value)}
              className={cn(
                'w-full px-4 py-2 text-sm text-left transition-colors',
                selected === opt.value
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-slate-200 hover:bg-slate-700/50'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
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

export { LanguageSelector } from './language-selector';