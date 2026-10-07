// ============================================
// TIPOS PRINCIPALES DEL SISTEMA
// ============================================

// Moneda — declarada acá arriba para que `Product` pueda referenciarla.
// (También se re-exporta más abajo en la sección de facturación; ese
// `export type Moneda` original quedó eliminado para evitar duplicado.)
export type Moneda = 'USD' | 'UYU' | 'EUR' | 'BRL' | 'ARS';

// Producto
export interface Product {
  codigo: string;
  descripcion: string;
  precio: number;
  /**
   * Moneda en la que se guardó el precio/costo de este producto.
   * Si viene undefined (producto creado antes de la migración 020),
   * la app debe tratarlo como UYU.
   */
  moneda?: Moneda;
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
  moneda?: Moneda;
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
  monedaCosto?: Moneda; // Moneda del costo de compra (UYU/USD). Default UYU.
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
    canCreateProducts: true, canEditProducts: true, canDeleteProducts: true,
    canCreateMovements: true, canMakeEntradas: true, canMakeSalidas: true,
    canViewAudit: true, canManageUsers: true,
    canViewTaller: true,
    canViewComercial: true, canViewSeriales: true, canViewRMA: true,
  },
  vendedor: {
    label: 'Vendedor',
    canCreateProducts: false, canEditProducts: false, canDeleteProducts: false,
    canCreateMovements: true, canMakeEntradas: false, canMakeSalidas: true,
    canViewAudit: false, canManageUsers: false,
    canViewTaller: false,
    canViewComercial: true, canViewSeriales: false, canViewRMA: true,
  },
  bodeguero: {
    label: 'Bodeguero',
    canCreateProducts: false, canEditProducts: true, canDeleteProducts: false,
    canCreateMovements: true, canMakeEntradas: true, canMakeSalidas: false,
    canViewAudit: false, canManageUsers: false,
    canViewTaller: false,
    canViewComercial: false, canViewSeriales: true, canViewRMA: false,
  },
  operador: {
    label: 'Operador',
    canCreateProducts: true, canEditProducts: true, canDeleteProducts: false,
    canCreateMovements: true, canMakeEntradas: true, canMakeSalidas: true,
    canViewAudit: false, canManageUsers: false,
    canViewTaller: true,
    canViewComercial: true, canViewSeriales: true, canViewRMA: true,
  },
} as const;

// ============================================
// TIPOS DE IA
// ============================================

export type TrendType = 'acelerando' | 'desacelerando' | 'estable' | 'sin_datos' | 'creciendo';

export interface StockPrediction {
  days: number | null;
  confidence: number;
  trend: TrendType;
  dailyRate?: string;
  dailyIncome?: string;
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

export type TabType = 'comercial' | 'movimientos' | 'stock' | 'replenishment' | 'taller' | 'garantias' | 'tickets' | 'rma' | 'trazabilidad' | 'auditoria' | 'empresas';

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

// ============================================
// LOTES (Mejorado con trazabilidad)
// ============================================

export interface Lote {
  id: string;
  codigo: string;
  cantidadInicial: number;
  cantidadDisponible: number;
  costoUnitario: number;
  fechaCompra: Date;
  usuario?: string;
  notas?: string;
  // Nuevos campos de trazabilidad
  proveedorId?: string;
  proveedor?: Proveedor;
  ordenCompraId?: string;
  paisOrigen?: string;
  certificados?: CertificadoLote[];
  fechaFabricacion?: Date;
  fechaCaducidad?: Date;
  diasHastaCaducidad?: number;
  estadoCalidad?: EstadoCalidadLote;
  inspeccionadoPor?: string;
  fechaInspeccion?: Date;
  temperaturaAlmacenamientoMin?: number;
  temperaturaAlmacenamientoMax?: number;
  condicionesAlmacenamiento?: string;
  metadata?: Record<string, any>;
}

export type EstadoCalidadLote = 'cuarentena' | 'aprobado' | 'rechazado' | 'vencido';

export interface CertificadoLote {
  tipo: string; // "COA", "COC", "Halal", "Kosher", etc
  url: string;
  fechaEmision: Date;
  fechaVencimiento?: Date;
  numeroSerie?: string;
}

// ============================================
// SERIALIZACIÓN
// ============================================

export type EstadoSerial =
  | 'disponible'
  | 'reservado'
  | 'vendido'
  | 'en_reparacion'
  | 'defectuoso'
  | 'en_transito'
  | 'dado_de_baja'
  | 'en_rma';

export interface ProductoSerial {
  id: string;
  productoCodigo: string;
  producto?: Product;
  numeroSerie: string;
  estado: EstadoSerial;

  // Ubicación actual
  almacenId?: string;
  almacen?: Almacen;
  ubicacion?: string;

  // Información de compra
  loteId?: string;
  lote?: Lote;
  proveedorId?: string;
  proveedor?: Proveedor;
  ordenCompraId?: string;
  fechaRecepcion?: Date;
  costoAdquisicion?: number;

  // Información de venta
  clienteId?: string;
  cliente?: Cliente;
  ordenVentaId?: string;
  fechaVenta?: Date;
  precioVenta?: number;

  // Garantía
  fechaGarantiaInicio?: Date;
  fechaGarantiaFin?: Date;
  periodoGarantiaMeses?: number;

  // Metadatos adicionales
  atributos?: Record<string, any>; // {color, talla, versión, etc}
  notas?: string;

  // Auditoría
  creadoPor?: string;
  actualizadoPor?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface EstadoGarantia {
  estado: 'vigente' | 'vencida' | 'sin_garantia';
  diasRestantes?: number;
}

// ============================================
// TRAZABILIDAD END-TO-END
// ============================================

export type TipoEventoTrazabilidad =
  | 'RECEPCION'
  | 'INSPECCION_QC'
  | 'ALMACENAMIENTO'
  | 'PICKING'
  | 'PACKING'
  | 'ENVIO'
  | 'ENTREGA'
  | 'DEVOLUCION'
  | 'ENSAMBLAJE'
  | 'DESENSAMBLAJE'
  | 'TRANSFERENCIA'
  | 'AJUSTE'
  | 'BAJA'
  | 'CAMBIO_ESTADO';

export type ResultadoEvento = 'EXITOSO' | 'FALLIDO' | 'PENDIENTE' | 'EN_PROCESO';

export type TipoDocumentoTrazabilidad =
  | 'ORDEN_COMPRA'
  | 'ORDEN_VENTA'
  | 'TRANSFERENCIA'
  | 'RMA'
  | 'ENSAMBLAJE'
  | 'AJUSTE_INVENTARIO';

export interface EventoTrazabilidad {
  id: string;

  // Identificación (puede ser serial O lote)
  productoCodigo: string;
  producto?: Product;
  serialId?: string;
  serial?: ProductoSerial;
  loteId?: string;
  lote?: Lote;

  // Tipo de evento
  tipoEvento: TipoEventoTrazabilidad;
  descripcion?: string;
  resultado: ResultadoEvento;

  // Ubicación y movimiento
  almacenOrigenId?: string;
  almacenOrigen?: Almacen;
  almacenDestinoId?: string;
  almacenDestino?: Almacen;
  ubicacionOrigen?: string;
  ubicacionDestino?: string;

  // Cantidades (para lotes)
  cantidad?: number;
  unidadMedida?: string;

  // Referencias a documentos
  documentoTipo?: TipoDocumentoTrazabilidad;
  documentoId?: string;
  documentoNumero?: string;

  // Entidades relacionadas
  proveedorId?: string;
  proveedor?: Proveedor;
  clienteId?: string;
  cliente?: Cliente;
  transportista?: string;
  numeroTracking?: string;

  // Calidad y condiciones
  temperatura?: number;
  humedad?: number;
  condicionesEspeciales?: Record<string, any>;

  // Responsables
  usuarioResponsable?: string;
  operadorFisico?: string;
  supervisor?: string;

  // Tiempo
  fechaHora: Date;
  fechaProgramada?: Date;
  duracionMinutos?: number;

  // Datos adicionales
  metadata?: Record<string, any>;

  createdAt: Date;
}

export interface CadenaTrazabilidad {
  productoCodigo: string;
  serialId?: string;
  loteId?: string;
  eventos: EventoTrazabilidad[];
  resumen: {
    totalEventos: number;
    primerEvento: EventoTrazabilidad;
    ultimoEvento: EventoTrazabilidad;
    ubicacionActual?: string;
    estadoActual?: string;
  };
}

// ============================================
// RMA (Return Merchandise Authorization)
// ============================================

export type EstadoRMA =
  | 'solicitada'
  | 'aprobada'
  | 'rechazada'
  | 'en_transito'
  | 'recibida'
  | 'inspeccionada'
  | 'procesada'
  | 'completada'
  | 'cancelada';

export type TipoRMA =
  | 'garantia'
  | 'defecto'
  | 'error_envio'
  | 'no_conforme'
  | 'otro';

export type ResolucionRMA =
  | 'reemplazo'
  | 'reembolso'
  | 'credito'
  | 'reparacion';

export type ResultadoInspeccionRMA =
  | 'aprobado'
  | 'rechazado'
  | 'parcial';

export interface RMA {
  id: string;
  numero: string;

  // Cliente y venta original
  clienteId: string;
  cliente?: Cliente;
  ordenVentaId?: string;
  ordenVenta?: OrdenVenta;
  ordenVentaNumero?: string;

  // Estado
  estado: EstadoRMA;
  tipo: TipoRMA;

  // Motivo y resolución
  motivo: string;
  resolucionEsperada?: ResolucionRMA;
  resolucionFinal?: ResolucionRMA;

  // Información de envío
  direccionRecogida?: string;
  transportista?: string;
  numeroTracking?: string;
  fechaEnvioCliente?: Date;
  fechaRecepcionAlmacen?: Date;

  // Inspección
  inspeccionadoPor?: string;
  fechaInspeccion?: Date;
  resultadoInspeccion?: ResultadoInspeccionRMA;
  notasInspeccion?: string;

  // Financiero
  valorProductos?: number;
  costoEnvio?: number;
  montoReembolso?: number;
  montoCredito?: number;

  // Almacén destino
  almacenId?: string;
  almacen?: Almacen;

  // Fechas importantes
  fechaSolicitud: Date;
  fechaAprobacion?: Date;
  fechaLimiteDevolucion?: Date;
  fechaCompletado?: Date;

  // Responsables
  solicitadoPor?: string;
  aprobadoPor?: string;
  procesadoPor?: string;

  // Notas
  notas?: string;
  notasInternas?: string;

  // Items
  items?: RMAItem[];

  // Auditoría
  creadoPor?: string;
  actualizadoPor?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CondicionProductoRMA =
  | 'nuevo'
  | 'usado_bueno'
  | 'usado_malo'
  | 'defectuoso'
  | 'danado';

export type AccionRMAItem =
  | 'devolver_stock'
  | 'reparar'
  | 'desechar'
  | 'reemplazo'
  | 'credito';

export interface RMAItem {
  id: string;
  rmaId: string;

  // Producto
  productoCodigo: string;
  producto?: Product;
  productoDescripcion?: string;
  serialId?: string;
  serial?: ProductoSerial;
  loteId?: string;
  lote?: Lote;

  // Cantidades
  cantidadSolicitada: number;
  cantidadAprobada?: number;
  cantidadRecibida?: number;
  cantidadAceptada?: number;
  unidadMedida?: string;

  // Motivo
  motivoDevolucion?: string;
  defectoReportado?: string;

  // Inspección
  condicionRecibida?: CondicionProductoRMA;
  defectoConfirmado?: boolean;
  notasInspeccion?: string;

  // Acción
  accion?: AccionRMAItem;
  almacenDestinoId?: string;
  almacenDestino?: Almacen;
  ubicacionDestino?: string;

  // Financiero
  precioUnitarioOriginal?: number;
  valorTotal?: number;
  montoReembolso?: number;

  // Evidencia
  imagenesEvidencia?: string[]; // URLs
  metadata?: Record<string, any>;
  notas?: string;

  createdAt?: Date;
  updatedAt?: Date;
}
