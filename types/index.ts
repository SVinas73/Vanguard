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

export type TabType = 'dashboard' | 'stock' | 'movimientos' | 'analytics' | 'reportes' | 'costos' | 'auditoria' | 'compras' | 'ventas' | 'integraciones' | 'almacenes' | 'seriales' | 'trazabilidad' | 'rma' | 'bom' | 'ensamblajes';

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
  certificados?: Certificado[];
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

export interface Certificado {
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

// ============================================
// BILL OF MATERIALS (BOM)
// ============================================

export type EstadoBOM = 'borrador' | 'activo' | 'obsoleto' | 'revision';

export type TipoBOM = 'produccion' | 'ingenieria' | 'venta' | 'servicio';

export interface BOM {
  id: string;

  // Producto final
  productoCodigo: string;
  producto?: Product;

  // Versión
  version: string;
  nombre?: string;
  descripcion?: string;

  // Estado
  estado: EstadoBOM;
  tipo: TipoBOM;

  // Cantidades base
  cantidadBase: number;
  unidadBase?: string;

  // Costos calculados
  costoMateriales?: number;
  costoManoObra?: number;
  costoOverhead?: number;
  costoTotal?: number;

  // Tiempo
  tiempoSetupMinutos?: number;
  tiempoEnsamblajeMinutos?: number;

  // Control
  requiereAprobacion: boolean;
  aprobadoPor?: string;
  fechaAprobacion?: Date;

  // Validez
  fechaInicioVigencia?: Date;
  fechaFinVigencia?: Date;

  // Documentación
  notas?: string;
  instruccionesEnsamblaje?: string;
  diagramas?: string[]; // URLs

  // Items
  items?: BOMItem[];

  // Control
  esPrincipal: boolean;

  // Auditoría
  creadoPor?: string;
  actualizadoPor?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BOMItem {
  id: string;
  bomId: string;

  // Componente
  componenteCodigo: string;
  componente?: Product;
  componenteDescripcion?: string;

  // Cantidad requerida
  cantidad: number;
  unidadMedida?: string;
  cantidadDesperdicio?: number;

  // Secuencia
  secuencia?: number;
  nivel: number;
  esCritico: boolean;

  // Alternativas
  componenteAlternativoCodigo?: string;
  componenteAlternativo?: Product;
  puedeSustituir: boolean;

  // Costos
  costoUnitario?: number;
  costoTotal?: number;

  // Referencia
  referencia?: string;
  posicion?: string;

  // Notas
  notas?: string;
  instrucciones?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface CostoBOM {
  bomId: string;
  totalComponentes: number;
  costoMateriales: number;
  costoManoObra: number;
  costoOverhead: number;
  costoTotal: number;
  margenPorcentaje?: number;
  precioVentaSugerido?: number;
}

// ============================================
// ENSAMBLAJES
// ============================================

export type TipoEnsamblaje = 'ensamblaje' | 'desensamblaje';

export type EstadoEnsamblaje =
  | 'planificado'
  | 'en_proceso'
  | 'completado'
  | 'cancelado'
  | 'pausado';

export type ResultadoQC =
  | 'aprobado'
  | 'rechazado'
  | 'aprobado_con_observaciones';

export interface Ensamblaje {
  id: string;
  numero: string;

  // BOM utilizado
  bomId: string;
  bom?: BOM;
  productoCodigo: string;
  producto?: Product;
  productoDescripcion?: string;

  // Tipo
  tipo: TipoEnsamblaje;

  // Cantidades
  cantidadPlanificada: number;
  cantidadProducida?: number;
  cantidadAprobada?: number;
  cantidadRechazada?: number;
  unidadMedida?: string;

  // Estado
  estado: EstadoEnsamblaje;

  // Ubicación
  almacenId: string;
  almacen?: Almacen;
  ubicacionTrabajo?: string;
  ubicacionDestino?: string;

  // Tiempos
  fechaPlanificada?: Date;
  fechaInicio?: Date;
  fechaFin?: Date;
  duracionRealMinutos?: number;

  // Responsables
  supervisor?: string;
  operadores?: string[];

  // Control de calidad
  requiereInspeccion: boolean;
  inspeccionadoPor?: string;
  fechaInspeccion?: Date;
  resultadoQc?: ResultadoQC;
  notasQc?: string;

  // Costos reales
  costoMaterialesReal?: number;
  costoManoObraReal?: number;
  costoOverheadReal?: number;
  costoTotalReal?: number;

  // Tracking
  loteGeneradoId?: string;
  loteGenerado?: Lote;
  serialesGenerados?: string[]; // Array de serial IDs
  componentesConsumidos?: ComponenteConsumido[];

  // Notas
  notas?: string;
  problemasEncontrados?: string;

  // Auditoría
  creadoPor?: string;
  actualizadoPor?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ComponenteConsumido {
  componenteCodigo: string;
  cantidad: number;
  loteId?: string;
  serialId?: string;
  costoUnitario?: number;
  costoTotal?: number;
}

// ============================================
// MEJORAS A PRODUCTO
// ============================================

export type TipoProducto =
  | 'simple'
  | 'serializado'
  | 'lote'
  | 'kit'
  | 'virtual'
  | 'servicio';

// Extender Product interface existente con nuevos campos
export interface ProductExtended extends Product {
  requiereSerial?: boolean;
  patronSerial?: string;
  tipoProducto?: TipoProducto;
  tieneBom?: boolean;
  bomActivoId?: string;
  bomActivo?: BOM;
  requiereTrazabilidad?: boolean;
  diasGarantia?: number;
  esPerecedero?: boolean;
  diasVidaUtil?: number;
}