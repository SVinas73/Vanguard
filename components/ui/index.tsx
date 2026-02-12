import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, AlertTriangle, Info, CheckCircle, XCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// DESIGN TOKENS (constantes de diseño)
// ============================================

const tokens = {
  // Colores base
  bg: {
    primary: 'bg-[#0f1117]',
    secondary: 'bg-[#161921]',
    surface: 'bg-[#1c1f26]',
    surfaceHover: 'bg-[#242830]',
    surfaceActive: 'bg-[#2a2e38]',
  },
  border: {
    default: 'border-[#2e323d]',
    subtle: 'border-[#1e2028]',
    focus: 'border-blue-500',
  },
  text: {
    primary: 'text-[#f8fafc]',
    secondary: 'text-[#94a3b8]',
    tertiary: 'text-[#64748b]',
    muted: 'text-[#475569]',
  },
  accent: {
    primary: 'bg-blue-600 hover:bg-blue-500',
    muted: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
  },
};

// ============================================
// BUTTON
// ============================================

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-sm',
    secondary: 'bg-[#1c1f26] hover:bg-[#242830] text-[#f8fafc] border border-[#2e323d]',
    danger: 'bg-red-600 hover:bg-red-500 text-white font-medium',
    ghost: 'hover:bg-[#1c1f26] text-[#94a3b8] hover:text-[#f8fafc]',
    outline: 'border border-[#2e323d] hover:border-[#475569] text-[#94a3b8] hover:text-[#f8fafc] bg-transparent',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs rounded-md',
    md: 'px-4 py-2 text-sm rounded-lg',
    lg: 'px-5 py-2.5 text-sm rounded-lg',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
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
  hint?: string;
}

export function Input({ className, label, error, hint, ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-[#f8fafc]">
          {label}
        </label>
      )}
      <input
        className={cn(
          'w-full px-3 py-2 rounded-lg text-sm',
          'bg-[#1c1f26] border border-[#2e323d]',
          'text-[#f8fafc] placeholder:text-[#475569]',
          'transition-colors duration-150',
          'hover:border-[#475569]',
          'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30',
          error && 'border-red-500/50 focus:border-red-500 focus:ring-red-500/30',
          props.disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        {...props}
      />
      {hint && !error && (
        <p className="text-xs text-[#64748b]">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}

// ============================================
// TEXTAREA
// ============================================

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ className, label, error, ...props }: TextareaProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-[#f8fafc]">
          {label}
        </label>
      )}
      <textarea
        className={cn(
          'w-full px-3 py-2 rounded-lg text-sm min-h-[100px] resize-y',
          'bg-[#1c1f26] border border-[#2e323d]',
          'text-[#f8fafc] placeholder:text-[#475569]',
          'transition-colors duration-150',
          'hover:border-[#475569]',
          'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30',
          error && 'border-red-500/50 focus:border-red-500 focus:ring-red-500/30',
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
  disabled?: boolean;
  error?: string;
}

export function Select({
  className,
  label,
  options,
  placeholder,
  value,
  onChange,
  disabled,
  error,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState(value || '');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value !== undefined) {
      setSelected(value);
    }
  }, [value]);

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
    <div className={cn('space-y-1.5 relative', className)} ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-[#f8fafc]">
          {label}
        </label>
      )}
      
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'w-full px-3 py-2 rounded-lg text-sm text-left',
          'bg-[#1c1f26] border border-[#2e323d]',
          'flex items-center justify-between',
          'transition-colors duration-150',
          !disabled && 'hover:border-[#475569]',
          isOpen && 'border-blue-500 ring-1 ring-blue-500/30',
          error && 'border-red-500/50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span className={selected ? 'text-[#f8fafc]' : 'text-[#475569]'}>
          {selectedLabel}
        </span>
        <ChevronDown 
          size={16} 
          className={cn(
            'text-[#64748b] transition-transform duration-150',
            isOpen && 'rotate-180'
          )} 
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 py-1 rounded-lg bg-[#1c1f26] border border-[#2e323d] shadow-lg shadow-black/30 max-h-60 overflow-y-auto">
          {placeholder && (
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={cn(
                'w-full px-3 py-2 text-sm text-left transition-colors',
                selected === '' 
                  ? 'bg-blue-500/10 text-blue-400' 
                  : 'text-[#64748b] hover:bg-[#242830]'
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
                'w-full px-3 py-2 text-sm text-left transition-colors',
                selected === opt.value
                  ? 'bg-blue-500/10 text-blue-400'
                  : 'text-[#f8fafc] hover:bg-[#242830]'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
      
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ============================================
// CARD
// ============================================

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ 
  className, 
  variant = 'default', 
  padding = 'md',
  children, 
  ...props 
}: CardProps) {
  const variants = {
    default: 'bg-[#1c1f26] border border-[#2e323d]',
    elevated: 'bg-[#1c1f26] border border-[#2e323d] shadow-lg shadow-black/20',
    outlined: 'bg-transparent border border-[#2e323d]',
    interactive: 'bg-[#1c1f26] border border-[#2e323d] hover:border-[#475569] hover:bg-[#242830] cursor-pointer transition-colors duration-150',
  };

  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  return (
    <div
      className={cn(
        'rounded-xl',
        variants[variant],
        paddings[padding],
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
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({ 
  children, 
  variant = 'default', 
  size = 'sm',
  className 
}: BadgeProps) {
  const variants = {
    default: 'bg-[#242830] text-[#94a3b8]',
    primary: 'bg-blue-500/15 text-blue-400',
    success: 'bg-emerald-500/15 text-emerald-400',
    warning: 'bg-amber-500/15 text-amber-400',
    danger: 'bg-red-500/15 text-red-400',
    info: 'bg-cyan-500/15 text-cyan-400',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-md',
        variants[variant],
        sizes[size],
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
  title: React.ReactNode;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showClose?: boolean;
}

export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  showClose = true 
}: ModalProps) {
  // Prevent scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[90vw]',
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          'bg-[#161921] rounded-xl border border-[#2e323d] w-full shadow-2xl shadow-black/40',
          'flex flex-col max-h-[85vh]',
          'animate-in fade-in-0 zoom-in-95 duration-200',
          sizes[size]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e323d]">
          <h3 className="text-base font-semibold text-[#f8fafc]">{title}</h3>
          {showClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-md text-[#64748b] hover:text-[#f8fafc] hover:bg-[#242830] transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          {children}
        </div>
      </div>
    </div>
  );
}

// ============================================
// ALERT (AI ALERT)
// ============================================

interface AIAlertProps {
  type: 'warning' | 'danger' | 'info' | 'success';
  children: React.ReactNode;
  className?: string;
}

export function AIAlert({ type, children, className }: AIAlertProps) {
  const styles = {
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-200',
    danger: 'bg-red-500/10 border-red-500/20 text-red-200',
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-200',
    success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200',
  };

  const icons = {
    warning: <AlertTriangle size={16} className="flex-shrink-0" />,
    danger: <XCircle size={16} className="flex-shrink-0" />,
    info: <Info size={16} className="flex-shrink-0" />,
    success: <CheckCircle size={16} className="flex-shrink-0" />,
  };

  return (
    <div
      className={cn(
        'px-3 py-2.5 rounded-lg border text-sm flex items-start gap-2.5',
        styles[type],
        className
      )}
    >
      {icons[type]}
      <div className="flex-1">{children}</div>
    </div>
  );
}

// ============================================
// DIVIDER
// ============================================

interface DividerProps {
  className?: string;
  label?: string;
}

export function Divider({ className, label }: DividerProps) {
  if (label) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div className="flex-1 h-px bg-[#2e323d]" />
        <span className="text-xs text-[#64748b] font-medium">{label}</span>
        <div className="flex-1 h-px bg-[#2e323d]" />
      </div>
    );
  }
  
  return <div className={cn('h-px bg-[#2e323d]', className)} />;
}

// ============================================
// SKELETON
// ============================================

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
}

export function Skeleton({ className, variant = 'text' }: SkeletonProps) {
  const variants = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  return (
    <div
      className={cn(
        'bg-[#242830] animate-pulse',
        variants[variant],
        className
      )}
    />
  );
}

// ============================================
// EMPTY STATE
// ============================================

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
      {icon && (
        <div className="mb-4 text-[#475569]">
          {icon}
        </div>
      )}
      <h3 className="text-base font-medium text-[#f8fafc] mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-[#64748b] max-w-sm mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}

// ============================================
// TABS
// ============================================

interface TabsProps {
  tabs: Array<{ id: string; label: string; count?: number }>;
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex gap-1 p-1 bg-[#1c1f26] rounded-lg', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-150',
            activeTab === tab.id
              ? 'bg-[#242830] text-[#f8fafc]'
              : 'text-[#64748b] hover:text-[#94a3b8]'
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn(
              'ml-1.5 px-1.5 py-0.5 text-xs rounded',
              activeTab === tab.id
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-[#2e323d] text-[#64748b]'
            )}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ============================================
// STAT CARD
// ============================================

interface StatCardProps {
  label: string;
  value: string | number;
  change?: { value: number; type: 'increase' | 'decrease' };
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({ label, value, change, icon, className }: StatCardProps) {
  return (
    <Card className={cn('', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-[#64748b] mb-1">{label}</p>
          <p className="text-2xl font-semibold text-[#f8fafc]">{value}</p>
          {change && (
            <p className={cn(
              'text-xs mt-1 font-medium',
              change.type === 'increase' ? 'text-emerald-400' : 'text-red-400'
            )}>
              {change.type === 'increase' ? '+' : '-'}{Math.abs(change.value)}%
            </p>
          )}
        </div>
        {icon && (
          <div className="p-2 bg-[#242830] rounded-lg text-[#64748b]">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

// ============================================
// EXPORTS
// ============================================

export { LanguageSelector } from './language-selector';