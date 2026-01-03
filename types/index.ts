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
  imagenUrl?: string | null;
  almacenId?: string | null;
  almacen?: Almacen | null;
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

export type TabType = 'dashboard' | 'stock' | 'movimientos' | 'analytics' | 'reportes' | 'costos' | 'auditoria' | 'compras' | 'ventas' | 'integraciones' | 'almacenes';

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

// ============================================
// PROVEEDORES
// ============================================

export interface Proveedor {
  id: string;
  codigo: string;
  nombre: string;
  nombreContacto?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  pais: string;
  notas?: string;
  activo: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProductoProveedor {
  id: string;
  productoCodigo: string;
  proveedorId: string;
  codigoProveedor?: string;
  costoUnitario?: number;
  tiempoEntregaDias: number;
  cantidadMinima: number;
  esPreferido: boolean;
}

// ============================================
// ÓRDENES DE COMPRA
// ============================================

export type OrdenCompraEstado = 'borrador' | 'enviada' | 'parcial' | 'recibida' | 'cancelada';

export interface OrdenCompra {
  id: string;
  numero: string;
  proveedorId: string;
  proveedor?: Proveedor;
  estado: OrdenCompraEstado;
  fechaOrden: Date;
  fechaEsperada?: Date;
  fechaRecibida?: Date;
  subtotal: number;
  impuestos: number;
  total: number;
  moneda: string;
  notas?: string;
  creadoPor: string;
  items?: OrdenCompraItem[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OrdenCompraItem {
  id: string;
  ordenId: string;
  productoCodigo: string;
  producto?: Product;
  cantidadOrdenada: number;
  cantidadRecibida: number;
  costoUnitario: number;
  subtotal: number;
  notas?: string;
}

// ============================================
// CLIENTES
// ============================================

export interface Cliente {
  id: string;
  codigo: string;
  tipo: 'persona' | 'empresa';
  nombre: string;
  rut?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  pais: string;
  notas?: string;
  limiteCredito: number;
  saldoPendiente: number;
  activo: boolean;
  createdAt?: Date;
}

// ============================================
// ÓRDENES DE VENTA
// ============================================

export type OrdenVentaEstado = 'borrador' | 'confirmada' | 'en_proceso' | 'enviada' | 'entregada' | 'cancelada';

export interface OrdenVenta {
  id: string;
  numero: string;
  clienteId: string;
  cliente?: Cliente;
  estado: OrdenVentaEstado;
  fechaOrden: Date;
  fechaEntregaEsperada?: Date;
  fechaEntregada?: Date;
  subtotal: number;
  descuento: number;
  impuestos: number;
  total: number;
  moneda: string;
  metodoPago?: string;
  pagado: boolean;
  notas?: string;
  direccionEnvio?: string;
  creadoPor: string;
  items?: OrdenVentaItem[];
  createdAt?: Date;
}

export interface OrdenVentaItem {
  id: string;
  ordenId: string;
  productoCodigo: string;
  producto?: Product;
  cantidad: number;
  precioUnitario: number;
  descuentoItem: number;
  subtotal: number;
  notas?: string;
}

// ============================================
// IMÁGENES DE PRODUCTOS
// ============================================

export interface ImagenProducto {
  id: string;
  productoCodigo: string;
  url: string;
  esPrincipal: boolean;
  orden: number;
}

// ============================================
// INTEGRACIONES ECOMMERCE
// ============================================

export type PlataformaEcommerce = 'shopify' | 'woocommerce' | 'mercadolibre' | 'tiendanube';

export interface IntegracionEcommerce {
  id: string;
  plataforma: PlataformaEcommerce;
  nombreTienda: string;
  apiKey?: string;
  apiSecret?: string;
  urlTienda?: string;
  activo: boolean;
  ultimaSincronizacion?: Date;
  config: Record<string, any>;
}

// ============================================
// MULTI-ALMACÉN
// ============================================

export interface Almacen {
  id: string;
  codigo: string;
  nombre: string;
  direccion?: string;
  ciudad?: string;
  telefono?: string;
  responsable?: string;
  esPrincipal: boolean;
  activo: boolean;
}

export interface StockAlmacen {
  id: string;
  productoCodigo: string;
  almacenId: string;
  almacen?: Almacen;
  cantidad: number;
  ubicacion?: string;
}

export type TransferenciaEstado = 'pendiente' | 'en_transito' | 'completada' | 'cancelada';

export interface Transferencia {
  id: string;
  numero: string;
  almacenOrigenId: string;
  almacenOrigen?: Almacen;
  almacenDestinoId: string;
  almacenDestino?: Almacen;
  estado: TransferenciaEstado;
  fechaSolicitud: Date;
  fechaEnvio?: Date;
  fechaRecepcion?: Date;
  notas?: string;
  creadoPor: string;
  items?: TransferenciaItem[];
}

export interface TransferenciaItem {
  id: string;
  transferenciaId: string;
  productoCodigo: string;
  cantidadSolicitada: number;
  cantidadEnviada: number;
  cantidadRecibida: number;
}