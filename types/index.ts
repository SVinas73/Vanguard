// ============================================
// TIPOS PRINCIPALES DEL SISTEMA
// ============================================

// Producto
export interface Product {
  codigo: string;
  descripcion: string;
  precio: number;
  categoria: string;
  stock: number;
  stockMinimo: number;
  createdAt?: Date;
  updatedAt?: Date;
  costoPromedio?: number;
}

export interface ProductFormData {
  codigo: string;
  descripcion: string;
  precio: string | number;
  categoria: string;
  stockMinimo: number;
}

// Movimiento
export type MovementType = 'entrada' | 'salida';

export interface Movement {
  id: number;
  codigo: string;
  tipo: MovementType;
  cantidad: number;
  usuario: string;
  timestamp: Date;
  notas?: string;
  costoCompra?: number; // Solo para entradas - precio al que se compró
}

export interface MovementFormData {
  codigo: string;
  tipo: MovementType;
  cantidad: string | number;
  notas?: string;
  costoCompra?: string | number; // Solo para entradas
}

// Categoría
export interface Category {
  id: string;
  nombre: string;
  color?: string;
}

// Roles de usuario
export type UserRole = 'admin' | 'vendedor' | 'bodeguero' | 'operador';

// Usuario
export interface User {
  id: string;
  nombre: string;
  email: string;
  rol: UserRole;
  createdAt?: Date;
}

// Permisos por rol
export const ROLE_PERMISSIONS = {
  admin: {
    label: 'Administrador',
    canCreateProducts: true,
    canEditProducts: true,
    canDeleteProducts: true,
    canCreateMovements: true,
    canMakeEntradas: true,
    canMakeSalidas: true,
    canViewCosts: true,
    canViewAudit: true,
    canViewReports: true,
    canManageUsers: true,
  },
  vendedor: {
    label: 'Vendedor',
    canCreateProducts: false,
    canEditProducts: false,
    canDeleteProducts: false,
    canCreateMovements: true,
    canMakeEntradas: false,
    canMakeSalidas: true,
    canViewCosts: false,
    canViewAudit: false,
    canViewReports: true,
    canManageUsers: false,
  },
  bodeguero: {
    label: 'Bodeguero',
    canCreateProducts: false,
    canEditProducts: true,
    canDeleteProducts: false,
    canCreateMovements: true,
    canMakeEntradas: true,
    canMakeSalidas: false,
    canViewCosts: true,
    canViewAudit: false,
    canViewReports: false,
    canManageUsers: false,
  },
  operador: {
    label: 'Operador',
    canCreateProducts: true,
    canEditProducts: true,
    canDeleteProducts: false,
    canCreateMovements: true,
    canMakeEntradas: true,
    canMakeSalidas: true,
    canViewCosts: true,
    canViewAudit: false,
    canViewReports: false,
    canManageUsers: false,
  },
} as const;

// ============================================
// TIPOS DE IA
// ============================================

export type TrendType = 'acelerando' | 'desacelerando' | 'estable' | 'sin_datos';

export interface StockPrediction {
  days: number | null;
  confidence: number;
  trend: TrendType;
  dailyRate?: string;
}

export interface AnomalyResult {
  isAnomaly: boolean;
  reason: string | null;
  severity: number;
  zScore?: string;
}

export interface CategorySuggestion {
  categoria: string | null;
  confidence: number;
}

export interface SearchResult extends Product {
  searchScore: number;
}

// ============================================
// TIPOS DE UI / ESTADO
// ============================================

export interface StatsData {
  totalValue: number;
  totalItems: number;
  lowStockCount: number;
  todayMovements: number;
}

export type TabType = 'dashboard' | 'productos' | 'movimientos' | 'analytics' | 'reportes' | 'costos' | 'auditoria';

export interface ModalState {
  showNewProduct: boolean;
  showNewMovement: boolean;
  showEditProduct: boolean;
  selectedProduct: Product | null;
}

// ============================================
// TIPOS DE API RESPONSES
// ============================================

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
