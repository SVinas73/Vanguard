import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, AlertTriangle, Info, CheckCircle, XCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// DESIGN TOKENS - Linear Style
// ============================================

const tokens = {
  // Colores base (Linear-inspired)
  bg: {
    primary: 'bg-[#0D0D0D]',
    secondary: 'bg-[#131313]',
    surface: 'bg-[#1A1A1A]',
    surfaceHover: 'bg-[#222222]',
    surfaceActive: 'bg-[#2A2A2A]',
  },
  border: {
    default: 'border-[#2E2E2E]',
    subtle: 'border-[#252525]',
    focus: 'border-indigo-500',
  },
  text: {
    primary: 'text-[#F1F1F1]',
    secondary: 'text-[#A0A0A0]',
    tertiary: 'text-[#6B6B6B]',
    muted: 'text-[#4A4A4A]',
  },
  accent: {
    primary: 'bg-indigo-600 hover:bg-indigo-500',
    muted: 'bg-indigo-500/10',
    text: 'text-indigo-400',
    border: 'border-indigo-500/30',
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
    primary: 'bg-indigo-600 hover:bg-indigo-500 text-white font-medium',
    secondary: 'bg-[#1A1A1A] hover:bg-[#222222] text-[#F1F1F1] border border-[#2E2E2E]',
    danger: 'bg-red-600 hover:bg-red-500 text-white font-medium',
    ghost: 'hover:bg-[#1A1A1A] text-[#A0A0A0] hover:text-[#F1F1F1]',
    outline: 'border border-[#2E2E2E] hover:border-[#4A4A4A] text-[#A0A0A0] hover:text-[#F1F1F1] bg-transparent',
  };

  const sizes = {
    sm: 'px-2.5 py-1.5 text-xs rounded-md',
    md: 'px-3 py-1.5 text-[13px] rounded-md',
    lg: 'px-4 py-2 text-[13px] rounded-md',
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
    <div className="space-y-1">
      {label && (
        <label className="block text-[13px] font-medium text-[#F1F1F1]">
          {label}
        </label>
      )}
      <input
        className={cn(
          'w-full px-3 py-2 rounded-md text-[13px]',
          'bg-[#1A1A1A] border border-[#2E2E2E]',
          'text-[#F1F1F1] placeholder:text-[#4A4A4A]',
          'transition-colors duration-100',
          'hover:border-[#4A4A4A]',
          'focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30',
          error && 'border-red-500/50 focus:border-red-500 focus:ring-red-500/30',
          props.disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        {...props}
      />
      {hint && !error && (
        <p className="text-[11px] text-[#6B6B6B]">{hint}</p>
      )}
      {error && (
        <p className="text-[11px] text-red-400">{error}</p>
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
    <div className="space-y-1">
      {label && (
        <label className="block text-[13px] font-medium text-[#F1F1F1]">
          {label}
        </label>
      )}
      <textarea
        className={cn(
          'w-full px-3 py-2 rounded-md text-[13px] min-h-[100px] resize-y',
          'bg-[#1A1A1A] border border-[#2E2E2E]',
          'text-[#F1F1F1] placeholder:text-[#4A4A4A]',
          'transition-colors duration-100',
          'hover:border-[#4A4A4A]',
          'focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30',
          error && 'border-red-500/50 focus:border-red-500 focus:ring-red-500/30',
          className
        )}
        {...props}
      />
      {error && <p className="text-[11px] text-red-400">{error}</p>}
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
    <div className={cn('space-y-1 relative', className)} ref={dropdownRef}>
      {label && (
        <label className="block text-[13px] font-medium text-[#F1F1F1]">
          {label}
        </label>
      )}
      
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'w-full px-3 py-2 rounded-md text-[13px] text-left',
          'bg-[#1A1A1A] border border-[#2E2E2E]',
          'flex items-center justify-between',
          'transition-colors duration-100',
          !disabled && 'hover:border-[#4A4A4A]',
          isOpen && 'border-indigo-500 ring-1 ring-indigo-500/30',
          error && 'border-red-500/50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span className={selected ? 'text-[#F1F1F1]' : 'text-[#4A4A4A]'}>
          {selectedLabel}
        </span>
        <ChevronDown 
          size={14} 
          className={cn(
            'text-[#6B6B6B] transition-transform duration-100',
            isOpen && 'rotate-180'
          )} 
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 py-1 rounded-md bg-[#1A1A1A] border border-[#2E2E2E] shadow-lg shadow-black/40 max-h-60 overflow-y-auto">
          {placeholder && (
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={cn(
                'w-full px-3 py-1.5 text-[13px] text-left transition-colors',
                selected === '' 
                  ? 'bg-indigo-500/10 text-indigo-400' 
                  : 'text-[#6B6B6B] hover:bg-[#222222]'
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
                'w-full px-3 py-1.5 text-[13px] text-left transition-colors',
                selected === opt.value
                  ? 'bg-indigo-500/10 text-indigo-400'
                  : 'text-[#F1F1F1] hover:bg-[#222222]'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
      
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
}

// ============================================
// SEARCHABLE SELECT (Filterable Dropdown)
// ============================================

interface SearchableSelectProps {
  label?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  value?: string;
  onChange?: (e: { target: { value: string } }) => void;
  className?: string;
  disabled?: boolean;
  error?: string;
}

export function SearchableSelect({
  className,
  label,
  options,
  placeholder,
  value,
  onChange,
  disabled,
  error,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(value || '');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value !== undefined) {
      setSelected(value);
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = options.find((o) => o.value === selected)?.label || '';

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (optValue: string) => {
    setSelected(optValue);
    setIsOpen(false);
    setSearch('');
    if (onChange) {
      onChange({ target: { value: optValue } });
    }
  };

  const handleInputFocus = () => {
    if (!disabled) {
      setIsOpen(true);
      setSearch('');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    if (!isOpen) setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearch('');
      inputRef.current?.blur();
    }
  };

  const displayValue = isOpen ? search : selectedLabel;

  return (
    <div className={cn('space-y-1 relative', className)} ref={containerRef}>
      {label && (
        <label className="block text-[13px] font-medium text-[#F1F1F1]">
          {label}
        </label>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          placeholder={selected ? selectedLabel : (placeholder || 'Seleccionar...')}
          onFocus={handleInputFocus}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={cn(
            'w-full px-3 py-2 rounded-md text-[13px] pr-8',
            'bg-[#1A1A1A] border border-[#2E2E2E]',
            'text-[#F1F1F1] placeholder:text-[#4A4A4A]',
            'transition-colors duration-100',
            !disabled && 'hover:border-[#4A4A4A]',
            isOpen && 'border-indigo-500 ring-1 ring-indigo-500/30',
            error && 'border-red-500/50',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        />
        <ChevronDown
          size={14}
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6B6B] transition-transform duration-100 pointer-events-none',
            isOpen && 'rotate-180'
          )}
        />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 py-1 rounded-md bg-[#1A1A1A] border border-[#2E2E2E] shadow-lg shadow-black/40 max-h-60 overflow-y-auto">
          {placeholder && !search && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect('')}
              className={cn(
                'w-full px-3 py-1.5 text-[13px] text-left transition-colors',
                selected === ''
                  ? 'bg-indigo-500/10 text-indigo-400'
                  : 'text-[#6B6B6B] hover:bg-[#222222]'
              )}
            >
              {placeholder}
            </button>
          )}
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-[13px] text-[#6B6B6B]">
              Sin resultados
            </div>
          ) : (
            filteredOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(opt.value)}
                className={cn(
                  'w-full px-3 py-1.5 text-[13px] text-left transition-colors',
                  selected === opt.value
                    ? 'bg-indigo-500/10 text-indigo-400'
                    : 'text-[#F1F1F1] hover:bg-[#222222]'
                )}
              >
                {opt.label}
              </button>
            ))
          )}
        </div>
      )}

      {error && <p className="text-[11px] text-red-400">{error}</p>}
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
    default: 'bg-[#1A1A1A] border border-[#2E2E2E]',
    elevated: 'bg-[#1A1A1A] border border-[#2E2E2E] shadow-lg shadow-black/30',
    outlined: 'bg-transparent border border-[#2E2E2E]',
    interactive: 'bg-[#1A1A1A] border border-[#2E2E2E] hover:border-[#4A4A4A] hover:bg-[#222222] cursor-pointer transition-colors duration-100',
  };

  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-5',
  };

  return (
    <div
      className={cn(
        'rounded-lg',
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
    default: 'bg-[#222222] text-[#A0A0A0]',
    primary: 'bg-indigo-500/10 text-indigo-400',
    success: 'bg-emerald-500/10 text-emerald-400',
    warning: 'bg-amber-500/10 text-amber-400',
    danger: 'bg-red-500/10 text-red-400',
    info: 'bg-cyan-500/10 text-cyan-400',
  };

  const sizes = {
    sm: 'px-1.5 py-0.5 text-[11px]',
    md: 'px-2 py-0.5 text-[11px]',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded',
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
          'bg-[#131313] rounded-lg border border-[#2E2E2E] w-full shadow-2xl shadow-black/50',
          'flex flex-col max-h-[85vh]',
          'animate-in fade-in-0 zoom-in-95 duration-150',
          sizes[size]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2E2E2E]">
          <h3 className="text-[14px] font-medium text-[#F1F1F1]">{title}</h3>
          {showClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-md text-[#6B6B6B] hover:text-[#F1F1F1] hover:bg-[#222222] transition-colors"
            >
              <X size={16} />
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
        <div className="flex-1 h-px bg-[#2E2E2E]" />
        <span className="text-[11px] text-[#6B6B6B] font-medium">{label}</span>
        <div className="flex-1 h-px bg-[#2E2E2E]" />
      </div>
    );
  }
  
  return <div className={cn('h-px bg-[#2E2E2E]', className)} />;
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
