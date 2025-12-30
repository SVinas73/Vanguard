import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ============================================
// UTILIDADES DE ESTILOS
// ============================================

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================
// FORMATEADORES
// ============================================

export function formatCurrency(value: number): string {
  return '$ ' + new Intl.NumberFormat('es-UY', {
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-UY').format(value);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-UY', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-UY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

// ============================================
// HELPERS
// ============================================

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function isToday(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

export function daysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// ============================================
// VALIDACIONES SIMPLES
// ============================================

export function isValidCodigo(codigo: string): boolean {
  return /^[A-Z]{2,4}-\d{3,4}$/.test(codigo);
}

export function sanitizeString(str: string): string {
  return str.trim().replace(/\s+/g, ' ');
}
