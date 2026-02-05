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
    canViewQMS: true,
    canManageQMS: true,
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
    canViewQMS: false,
    canManageQMS: false,
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
    canViewQMS: true,
    canManageQMS: false,
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
    canViewQMS: true,
    canManageQMS: true,
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

export type TabType = 'dashboard' | 'stock' | 'movimientos' | 'analytics' | 'reportes' | 'costos' | 'auditoria' | 'compras' | 'ventas' | 'integraciones' | 'almacenes' | 'seriales' | 'trazabilidad' | 'rma' | 'bom' | 'ensamblajes' | 'proyectos' | 'comercial' | 'finanzas' | 'taller' | 'qms';

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

// ============================================
// GESTIÓN DE PROYECTOS
// ============================================

export type EstadoProyecto = 'activo' | 'completado' | 'archivado';
export type PrioridadTarea = 'baja' | 'media' | 'alta' | 'urgente';

export interface Proyecto {
  id: string;
  nombre: string;
  descripcion?: string;
  color: string;
  estado: EstadoProyecto;
  fechaInicio?: Date;
  fechaFin?: Date;
  creadoPor?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProyectoColumna {
  id: string;
  proyectoId: string;
  nombre: string;
  orden: number;
  color?: string;
  limiteWip?: number;
  createdAt: Date;
}

export interface ProyectoTarea {
  id: string;
  proyectoId: string;
  columnaId?: string;
  titulo: string;
  descripcion?: string;
  prioridad: PrioridadTarea;
  orden: number;
  
  // Fechas
  fechaLimite?: Date;
  fechaInicio?: Date;
  fechaCompletado?: Date;
  
  // Asignación
  asignadoA?: string;
  
  // Vínculos
  productoCodigo?: string;
  ordenCompraId?: string;
  ordenVentaId?: string;
  rmaId?: string;
  ensamblajeId?: string;
  
  // Estado
  completado: boolean;
  bloqueado: boolean;
  razonBloqueo?: string;
  
  // Seguimiento
  tiempoEstimadoHoras?: number;
  tiempoRealHoras?: number;
  progreso: number;
  
  // Relaciones
  subtareas?: ProyectoSubtarea[];
  etiquetas?: ProyectoEtiqueta[];
  comentarios?: ProyectoComentario[];
  adjuntos?: ProyectoAdjunto[];
  
  // Auditoría
  creadoPor?: string;
  createdAt: Date;
  actualizadoPor?: string;
  updatedAt: Date;
}

export interface ProyectoSubtarea {
  id: string;
  tareaId: string;
  titulo: string;
  completado: boolean;
  orden: number;
  createdAt: Date;
}

export interface ProyectoEtiqueta {
  id: string;
  proyectoId: string;
  nombre: string;
  color: string;
  createdAt: Date;
}

export interface ProyectoComentario {
  id: string;
  tareaId: string;
  usuarioEmail: string;
  contenido: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProyectoAdjunto {
  id: string;
  tareaId: string;
  nombreArchivo: string;
  url: string;
  tipoMime?: string;
  tamanoBytes?: number;
  subidoPor?: string;
  createdAt: Date;
}

export interface ProyectoStats {
  totalTareas: number;
  tareasCompletadas: number;
  tareasPendientes: number;
  tareasBloqueadas: number;
  porcentajeCompletado: number;
  tareasPorPrioridad: Record<PrioridadTarea, number>;
  tareasPorColumna: Record<string, number>;
}


// ============================================
// ENSAMBLAJES - TIPOS EXTENDIDOS (Nuevas tablas)
// ============================================

// Tipos de operación para el timeline
export type TipoOperacionEnsamblaje =
  | 'inicio'
  | 'pausa'
  | 'reanudacion'
  | 'consumo_material'
  | 'produccion'
  | 'qc_aprobado'
  | 'qc_rechazado'
  | 'completado'
  | 'cancelado'
  | 'nota';

// Operaciones/Timeline
export interface EnsamblajeOperacion {
  id: string;
  ensamblajeId: string;
  
  tipo: TipoOperacionEnsamblaje;
  descripcion?: string;
  datos?: Record<string, any>;
  
  cantidad?: number;
  unidad?: string;
  
  resultadoQc?: 'aprobado' | 'rechazado' | 'condicional';
  defectosEncontrados?: DefectoQC[];
  
  costoAsociado?: number;
  
  ejecutadoPor: string;
  estacionTrabajo?: string;
  ipAddress?: string;
  
  createdAt: Date;
}

export interface DefectoQC {
  codigo: string;
  descripcion: string;
  cantidad: number;
  severidad: 'menor' | 'mayor' | 'critico';
}

// Consumos de materiales
export interface EnsamblajeConsumo {
  id: string;
  ensamblajeId: string;
  operacionId?: string;
  
  componenteCodigo: string;
  componenteDescripcion?: string;
  
  cantidadPlanificada: number;
  cantidadConsumida: number;
  cantidadDesperdicio: number;
  unidad?: string;
  
  loteId?: string;
  loteNumero?: string;
  serialNumber?: string;
  
  almacenId?: string;
  ubicacion?: string;
  
  costoUnitario?: number;
  costoTotal?: number;
  
  esSustituto: boolean;
  componenteOriginalCodigo?: string;
  motivoSustitucion?: string;
  
  consumidoPor?: string;
  createdAt: Date;
}

// Control de Calidad detallado
export type TipoInspeccionQC = 'en_proceso' | 'final' | 'muestreo' | 'retrabajos';
export type ResultadoInspeccionQC = 'aprobado' | 'rechazado' | 'aprobado_condicional' | 'pendiente_retrabajo';
export type DisposicionRechazo = 'scrap' | 'retrabajo' | 'devolucion' | 'uso_condicional';

export interface EnsamblajeQC {
  id: string;
  ensamblajeId: string;
  operacionId?: string;
  
  tipoInspeccion: TipoInspeccionQC;
  numeroInspeccion: number;
  
  cantidadInspeccionada: number;
  cantidadAprobada: number;
  cantidadRechazada: number;
  cantidadRetrabajo: number;
  
  resultado: ResultadoInspeccionQC;
  
  defectos?: DefectoQC[];
  checklistId?: string;
  checklistResultados?: Record<string, any>;
  mediciones?: MedicionQC[];
  
  disposicionRechazo?: DisposicionRechazo;
  evidencias?: EvidenciaQC[];
  
  notas?: string;
  
  inspector: string;
  supervisorAprobacion?: string;
  fechaInspeccion: Date;
  
  createdAt: Date;
}

export interface MedicionQC {
  parametro: string;
  valor: number;
  unidad: string;
  min?: number;
  max?: number;
  cumple: boolean;
}

export interface EvidenciaQC {
  tipo: 'foto' | 'documento' | 'video';
  url: string;
  descripcion?: string;
}

// Pausas
export type MotivoPausa = 
  | 'falta_material' 
  | 'falla_equipo' 
  | 'cambio_turno' 
  | 'descanso' 
  | 'qc_pendiente' 
  | 'otro';

export interface EnsamblajePausa {
  id: string;
  ensamblajeId: string;
  
  fechaPausa: Date;
  fechaReanudacion?: Date;
  duracionMinutos?: number;
  
  motivo: MotivoPausa;
  descripcion?: string;
  
  impactoProduccion: boolean;
  costoTiempoMuerto?: number;
  
  pausadoPor: string;
  reanudadoPor?: string;
  
  createdAt: Date;
}

// Seriales generados
export type EstadoSerialEnsamblaje = 
  | 'producido' 
  | 'qc_aprobado' 
  | 'qc_rechazado' 
  | 'despachado' 
  | 'devuelto';

export interface EnsamblajeSerial {
  id: string;
  ensamblajeId: string;
  
  serialNumber: string;
  secuencia: number;
  
  estado: EstadoSerialEnsamblaje;
  
  qcId?: string;
  resultadoQc?: string;
  
  loteId?: string;
  
  componentesTrazados?: ComponenteTrazado[];
  
  almacenId?: string;
  ubicacion?: string;
  
  createdAt: Date;
}

export interface ComponenteTrazado {
  componenteCodigo: string;
  loteNumero?: string;
  serial?: string;
}

// Vista del Dashboard
export interface EnsamblajeDashboardView {
  id: string;
  numero: string;
  productoCodigo: string;
  productoDescripcion: string;
  tipo: TipoEnsamblaje;
  cantidadPlanificada: number;
  cantidadProducida?: number;
  cantidadAprobada?: number;
  cantidadRechazada?: number;
  estado: EstadoEnsamblaje;
  fechaPlanificada?: Date;
  fechaInicio?: Date;
  fechaFin?: Date;
  duracionRealMinutos?: number;
  
  // BOM
  bomVersion: string;
  costoBomPlanificado: number;
  
  // Costos
  costoMaterialesReal?: number;
  costoManoObraReal?: number;
  costoOverheadReal?: number;
  costoTotalReal?: number;
  costoTotalPlanificado: number;
  variacionCostoPct?: number;
  
  // Eficiencia
  rendimientoPct: number;
  
  // QC
  totalInspecciones: number;
  ultimoQc?: string;
  
  // Pausas
  totalPausas: number;
  minutosPausados?: number;
  
  // Timeline
  ultimaOperacion?: string;
  fechaUltimaOperacion?: Date;
  
  // Seriales
  serialesGenerados: number;
  
  // Almacén
  almacenNombre: string;
  
  supervisor?: string;
  creadoPor?: string;
  createdAt: Date;
}


// ============================================
// QMS - QUALITY MANAGEMENT SYSTEM
// Sistema de Gestión de Calidad ISO 9001 / FDA
// ============================================

// --------------------------------------------
// PLANES DE INSPECCIÓN
// --------------------------------------------

export type TipoPlanInspeccion = 'recepcion' | 'proceso' | 'final' | 'periodica';
export type MetodoMuestreo = 'aql' | 'porcentaje' | 'fijo' | '100%';
export type AplicaA = 'producto' | 'categoria' | 'proveedor' | 'todos';

export interface QMSPlanInspeccion {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  tipo: TipoPlanInspeccion;
  
  // Aplica a
  aplica_a: AplicaA;
  producto_id?: string;
  producto?: Product;
  categoria?: string;
  proveedor_id?: string;
  proveedor?: Proveedor;
  
  // Configuración de muestreo
  metodo_muestreo: MetodoMuestreo;
  nivel_aql?: number; // Acceptable Quality Level (ej: 1.0, 2.5, 4.0)
  porcentaje_muestra?: number;
  cantidad_fija?: number;
  
  // Frecuencia (para inspecciones periódicas)
  frecuencia_dias?: number;
  ultima_inspeccion?: Date;
  proxima_inspeccion?: Date;
  
  // Estado
  activo: boolean;
  version: number;
  
  // Características asociadas
  caracteristicas?: QMSCaracteristica[];
  
  // Auditoría
  creado_por?: string;
  creado_at: Date;
  actualizado_por?: string;
  actualizado_at: Date;
}

// --------------------------------------------
// CARACTERÍSTICAS A INSPECCIONAR
// --------------------------------------------

export type TipoCaracteristica = 'dimensional' | 'visual' | 'funcional' | 'documental' | 'quimico' | 'fisico';

export interface QMSCaracteristica {
  id: string;
  plan_id: string;
  
  codigo: string;
  nombre: string;
  descripcion?: string;
  
  // Tipo de característica
  tipo: TipoCaracteristica;
  
  // Especificaciones
  unidad_medida?: string;
  valor_nominal?: number;
  tolerancia_min?: number;
  tolerancia_max?: number;
  valores_aceptables?: string[]; // Para características cualitativas
  
  // Método de medición
  instrumento?: string;
  metodo_ensayo?: string; // Referencia a norma o procedimiento
  
  // Criticidad
  critico: boolean; // Característica crítica (CTQ)
  mayor: boolean;   // Defecto mayor
  menor: boolean;   // Defecto menor
  
  // Orden de inspección
  orden: number;
  
  activo: boolean;
  created_at: Date;
}

// --------------------------------------------
// INSPECCIONES
// --------------------------------------------

export type EstadoInspeccion = 'pendiente' | 'en_proceso' | 'aprobado' | 'rechazado' | 'aprobado_condicional' | 'retenido';
export type DecisionInspeccion = 'aceptar' | 'rechazar' | 'devolver' | 'usar_como_esta' | 'retrabajo' | 'concesion';
export type TipoInspeccion = 'recepcion' | 'proceso' | 'final' | 'retencion';

export interface QMSInspeccion {
  id: string;
  numero: string; // INS-2024-00001
  
  // Referencias
  plan_id?: string;
  plan?: QMSPlanInspeccion;
  tipo: TipoInspeccion;
  
  // Origen (qué se está inspeccionando)
  producto_id?: string;
  producto?: Product;
  producto_codigo: string;
  producto_descripcion: string;
  lote_id?: string;
  lote?: Lote;
  lote_numero?: string;
  orden_compra_id?: string;
  orden_compra?: OrdenCompra;
  orden_compra_numero?: string;
  proveedor_id?: string;
  proveedor?: Proveedor;
  proveedor_nombre?: string;
  
  // Cantidades
  cantidad_recibida: number;
  cantidad_muestra: number;
  cantidad_aceptada: number;
  cantidad_rechazada: number;
  
  // Resultado
  estado: EstadoInspeccion;
  decision?: DecisionInspeccion;
  
  // Fechas
  fecha_inspeccion: Date;
  fecha_decision?: Date;
  
  // Responsables
  inspector?: string;
  supervisor_calidad?: string;
  
  // Observaciones
  observaciones?: string;
  acciones_tomadas?: string;
  
  // Documentos adjuntos
  documentos?: QMSDocumento[];
  
  // Resultados detallados
  resultados?: QMSResultadoInspeccion[];
  
  // NCR relacionada
  ncr_id?: string;
  ncr?: QMSNoConformidad;
  
  // Auditoría
  creado_por?: string;
  creado_at: Date;
  actualizado_por?: string;
  actualizado_at: Date;
}

export interface QMSDocumento {
  nombre: string;
  url: string;
  tipo: string;
  fecha_subida?: Date;
}

// --------------------------------------------
// RESULTADOS DE INSPECCIÓN
// --------------------------------------------

export type TipoDefecto = 'critico' | 'mayor' | 'menor';

export interface QMSResultadoInspeccion {
  id: string;
  inspeccion_id: string;
  caracteristica_id: string;
  caracteristica?: QMSCaracteristica;
  
  // Valores medidos
  valor_medido?: number;
  valor_texto?: string; // Para características cualitativas
  valores_multiples?: number[]; // Para múltiples mediciones
  
  // Resultado
  conforme?: boolean;
  desviacion?: number; // Diferencia con nominal
  
  // Defectos encontrados
  cantidad_defectos: number;
  tipo_defecto?: TipoDefecto;
  descripcion_defecto?: string;
  
  // Evidencia
  fotos?: QMSFotoEvidencia[];
  
  // Instrumento usado
  instrumento_usado?: string;
  instrumento_calibrado?: boolean;
  
  created_at: Date;
}

export interface QMSFotoEvidencia {
  url: string;
  descripcion?: string;
  fecha?: Date;
}

// --------------------------------------------
// NO CONFORMIDADES (NCR)
// --------------------------------------------

export type TipoNCR = 'producto' | 'proceso' | 'sistema' | 'proveedor' | 'cliente';
export type OrigenNCR = 'inspeccion_recepcion' | 'inspeccion_proceso' | 'auditoria' | 'cliente' | 'interno';
export type SeveridadNCR = 'critica' | 'mayor' | 'menor' | 'observacion';
export type DisposicionNCR = 'usar' | 'retrabajo' | 'reparar' | 'rechazar' | 'devolver' | 'concesion' | 'scrap';
export type EstadoNCR = 'abierta' | 'en_analisis' | 'en_implementacion' | 'verificacion' | 'cerrada' | 'cancelada';

export interface QMSNoConformidad {
  id: string;
  numero: string; // NCR-2024-00001
  
  // Clasificación
  tipo: TipoNCR;
  origen: OrigenNCR;
  severidad: SeveridadNCR;
  
  // Referencias
  inspeccion_id?: string;
  inspeccion?: QMSInspeccion;
  producto_id?: string;
  producto?: Product;
  producto_codigo?: string;
  lote_numero?: string;
  orden_compra_id?: string;
  proveedor_id?: string;
  proveedor?: Proveedor;
  proveedor_nombre?: string;
  cliente_id?: string;
  cliente?: Cliente;
  cliente_nombre?: string;
  
  // Descripción
  titulo: string;
  descripcion: string;
  evidencia?: string;
  cantidad_afectada?: number;
  costo_estimado?: number;
  
  // Disposición inmediata
  disposicion?: DisposicionNCR;
  disposicion_detalle?: string;
  
  // Estado del flujo
  estado: EstadoNCR;
  
  // Fechas
  fecha_deteccion: Date;
  fecha_objetivo?: Date;
  fecha_cierre?: Date;
  
  // Responsables
  detectado_por?: string;
  responsable?: string;
  aprobado_por?: string;
  
  // Documentos
  documentos?: QMSDocumento[];
  
  // CAPAs relacionadas
  capas?: QMSAccionCorrectiva[];
  
  // Auditoría
  creado_por?: string;
  creado_at: Date;
  actualizado_por?: string;
  actualizado_at: Date;
}

// --------------------------------------------
// ACCIONES CORRECTIVAS/PREVENTIVAS (CAPA)
// --------------------------------------------

export type TipoCAPA = 'correctiva' | 'preventiva' | 'mejora';
export type MetodoAnalisisCausa = '5_whys' | 'ishikawa' | 'fmea' | 'pareto' | 'otro';
export type EstadoCAPA = 'abierta' | 'en_analisis' | 'en_implementacion' | 'verificacion' | 'cerrada' | 'cancelada';

export interface QMSAccionCorrectiva {
  id: string;
  numero: string; // CAPA-2024-00001
  
  // Tipo
  tipo: TipoCAPA;
  
  // Origen
  ncr_id?: string;
  ncr?: QMSNoConformidad;
  auditoria_id?: string;
  origen_descripcion?: string;
  
  // Descripción del problema
  titulo: string;
  descripcion_problema: string;
  
  // Análisis de causa raíz (8D Methodology)
  d1_equipo?: string; // Equipo de trabajo
  d2_descripcion?: string; // Descripción del problema
  d3_contencion?: string; // Acciones de contención
  d4_causa_raiz?: string; // Análisis de causa raíz
  d4_metodo?: MetodoAnalisisCausa;
  d5_acciones_correctivas?: string; // Acciones correctivas permanentes
  d6_implementacion?: string; // Implementación y validación
  d7_prevencion?: string; // Prevención de recurrencia
  d8_reconocimiento?: string; // Reconocimiento al equipo
  
  // Plan de acción
  acciones?: QMSAccionPlan[];
  
  // Verificación de efectividad
  verificacion_requerida: boolean;
  verificacion_fecha?: Date;
  verificacion_resultado?: string;
  verificacion_efectiva?: boolean;
  verificado_por?: string;
  
  // Estado
  estado: EstadoCAPA;
  porcentaje_avance: number;
  
  // Fechas
  fecha_inicio: Date;
  fecha_objetivo?: Date;
  fecha_cierre?: Date;
  
  // Responsables
  responsable?: string;
  aprobado_por?: string;
  
  // Documentos
  documentos?: QMSDocumento[];
  
  // Auditoría
  creado_por?: string;
  creado_at: Date;
  actualizado_por?: string;
  actualizado_at: Date;
}

export type EstadoAccionPlan = 'pendiente' | 'en_proceso' | 'completada' | 'cancelada' | 'vencida';

export interface QMSAccionPlan {
  id: string;
  capa_id: string;
  descripcion: string;
  responsable: string;
  fecha_objetivo: Date;
  fecha_completada?: Date;
  estado: EstadoAccionPlan;
  notas?: string;
  evidencia_url?: string;
  orden: number;
}

// --------------------------------------------
// CERTIFICADOS DE CALIDAD
// --------------------------------------------

export type TipoCertificado = 'coa' | 'coc' | 'coo' | 'msds' | 'halal' | 'kosher' | 'organico';
export type EstadoCertificado = 'borrador' | 'emitido' | 'anulado';

export interface QMSCertificado {
  id: string;
  numero: string; // COA-2024-00001
  
  // Tipo
  tipo: TipoCertificado;
  
  // Referencias
  inspeccion_id?: string;
  inspeccion?: QMSInspeccion;
  producto_id?: string;
  producto?: Product;
  producto_codigo: string;
  producto_descripcion: string;
  lote_numero?: string;
  
  // Destinatario
  cliente_id?: string;
  cliente?: Cliente;
  cliente_nombre?: string;
  orden_venta_id?: string;
  orden_venta?: OrdenVenta;
  orden_venta_numero?: string;
  
  // Contenido
  resultados: QMSResultadoCertificado[];
  observaciones?: string;
  conclusion: string; // "El producto cumple con las especificaciones"
  
  // Validez
  fecha_emision: Date;
  fecha_vencimiento?: Date;
  
  // Firmas
  elaborado_por?: string;
  revisado_por?: string;
  aprobado_por?: string;
  
  // PDF generado
  pdf_url?: string;
  pdf_generado_at?: Date;
  
  // Estado
  estado: EstadoCertificado;
  
  // Auditoría
  creado_por?: string;
  creado_at: Date;
}

export interface QMSResultadoCertificado {
  caracteristica: string;
  especificacion: string;
  resultado: string;
  unidad?: string;
  conforme: boolean;
}

// --------------------------------------------
// RECALLS / RETIROS DE PRODUCTO
// --------------------------------------------

export type ClaseRecall = 'I' | 'II' | 'III'; // I = más severo (FDA classification)
export type TipoRecall = 'recall' | 'retiro_mercado' | 'alerta_seguridad';
export type AlcanceRecall = 'consumidor' | 'mayorista' | 'distribuidor' | 'interno';
export type EstadoRecall = 'iniciado' | 'en_proceso' | 'completado' | 'cerrado';

export interface QMSRecall {
  id: string;
  numero: string; // RCL-2024-00001
  
  // Clasificación FDA
  clase: ClaseRecall;
  tipo: TipoRecall;
  
  // Producto afectado
  producto_id?: string;
  producto?: Product;
  producto_codigo: string;
  producto_descripcion: string;
  
  // Lotes afectados
  lotes_afectados: string[]; // Array de números de lote
  cantidad_total_afectada: number;
  
  // Motivo
  motivo: string;
  descripcion: string;
  riesgo_salud?: string;
  ncr_id?: string;
  ncr?: QMSNoConformidad;
  
  // Alcance
  alcance?: AlcanceRecall;
  regiones_afectadas?: string[];
  
  // Estado y seguimiento
  estado: EstadoRecall;
  unidades_recuperadas: number;
  unidades_destruidas: number;
  porcentaje_recuperacion: number;
  
  // Comunicaciones
  comunicado_publico?: string;
  comunicado_autoridades?: string;
  fecha_notificacion_autoridad?: Date;
  
  // Fechas
  fecha_inicio: Date;
  fecha_cierre?: Date;
  
  // Responsables
  coordinador?: string;
  
  // Documentos
  documentos?: QMSDocumento[];
  
  // Seguimiento por cliente
  seguimientos?: QMSRecallSeguimiento[];
  
  // Auditoría
  creado_por?: string;
  creado_at: Date;
  actualizado_por?: string;
  actualizado_at: Date;
}

// --------------------------------------------
// SEGUIMIENTO DE RECALL
// --------------------------------------------

export type EstadoRecallSeguimiento = 'pendiente' | 'notificado' | 'en_proceso' | 'recuperado' | 'no_recuperable';
export type MetodoNotificacion = 'email' | 'telefono' | 'carta' | 'visita';
export type DisposicionRecallSeguimiento = 'devuelto' | 'destruido_cliente' | 'destruido_sitio' | 'reparado';

export interface QMSRecallSeguimiento {
  id: string;
  recall_id: string;
  
  // Destino original
  cliente_id?: string;
  cliente?: Cliente;
  cliente_nombre: string;
  orden_venta_id?: string;
  
  // Lote específico
  lote_numero: string;
  cantidad_enviada: number;
  cantidad_recuperada: number;
  
  // Estado
  estado: EstadoRecallSeguimiento;
  
  // Comunicación
  fecha_notificacion?: Date;
  metodo_notificacion?: MetodoNotificacion;
  respuesta_cliente?: string;
  
  // Disposición
  disposicion?: DisposicionRecallSeguimiento;
  fecha_disposicion?: Date;
  
  notas?: string;
  created_at: Date;
}

// --------------------------------------------
// INSTRUMENTOS DE MEDICIÓN
// --------------------------------------------

export type EstadoInstrumento = 'activo' | 'en_calibracion' | 'fuera_servicio' | 'dado_baja';

export interface QMSInstrumento {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  
  // Clasificación
  tipo?: string; // 'calibrador', 'micrometro', 'balanza', 'termometro', etc.
  marca?: string;
  modelo?: string;
  numero_serie?: string;
  
  // Ubicación
  ubicacion?: string;
  responsable?: string;
  
  // Rango de medición
  rango_min?: number;
  rango_max?: number;
  unidad_medida?: string;
  resolucion?: number;
  exactitud?: number;
  
  // Calibración
  requiere_calibracion: boolean;
  frecuencia_calibracion_dias: number;
  proveedor_calibracion?: string;
  
  ultima_calibracion?: Date;
  proxima_calibracion?: Date;
  certificado_calibracion_url?: string;
  
  // Estado
  estado: EstadoInstrumento;
  
  // Calculado
  dias_para_calibracion?: number;
  
  // Historial de calibraciones
  historial_calibraciones?: QMSCalibracionHistorial[];
  
  // Auditoría
  creado_por?: string;
  creado_at: Date;
  actualizado_at: Date;
}

export interface QMSCalibracionHistorial {
  id: string;
  instrumento_id: string;
  fecha_calibracion: Date;
  proveedor: string;
  resultado: 'aprobado' | 'ajustado' | 'rechazado';
  certificado_url?: string;
  costo?: number;
  notas?: string;
  calibrado_por?: string;
  created_at: Date;
}

// --------------------------------------------
// CONFIGURACIONES Y CONSTANTES QMS
// --------------------------------------------

export const QMS_ESTADO_INSPECCION_CONFIG: Record<EstadoInspeccion, { label: string; color: string; bg: string; icon?: string }> = {
  pendiente: { label: 'Pendiente', color: 'text-amber-400', bg: 'bg-amber-500/20', icon: 'clock' },
  en_proceso: { label: 'En Proceso', color: 'text-blue-400', bg: 'bg-blue-500/20', icon: 'loader' },
  aprobado: { label: 'Aprobado', color: 'text-emerald-400', bg: 'bg-emerald-500/20', icon: 'check-circle' },
  rechazado: { label: 'Rechazado', color: 'text-red-400', bg: 'bg-red-500/20', icon: 'x-circle' },
  aprobado_condicional: { label: 'Aprobado Cond.', color: 'text-orange-400', bg: 'bg-orange-500/20', icon: 'alert-triangle' },
  retenido: { label: 'Retenido', color: 'text-purple-400', bg: 'bg-purple-500/20', icon: 'pause-circle' },
};

export const QMS_SEVERIDAD_NCR_CONFIG: Record<SeveridadNCR, { label: string; color: string; bg: string; prioridad: number }> = {
  critica: { label: 'Crítica', color: 'text-red-500', bg: 'bg-red-500/20', prioridad: 1 },
  mayor: { label: 'Mayor', color: 'text-orange-400', bg: 'bg-orange-500/20', prioridad: 2 },
  menor: { label: 'Menor', color: 'text-amber-400', bg: 'bg-amber-500/20', prioridad: 3 },
  observacion: { label: 'Observación', color: 'text-slate-400', bg: 'bg-slate-500/20', prioridad: 4 },
};

export const QMS_CLASE_RECALL_CONFIG: Record<ClaseRecall, { label: string; color: string; descripcion: string; prioridad: number }> = {
  I: { label: 'Clase I', color: 'text-red-500', descripcion: 'Riesgo serio de salud o muerte', prioridad: 1 },
  II: { label: 'Clase II', color: 'text-orange-400', descripcion: 'Riesgo temporal o reversible', prioridad: 2 },
  III: { label: 'Clase III', color: 'text-amber-400', descripcion: 'Improbable causa de problemas de salud', prioridad: 3 },
};

export const QMS_TIPO_CAPA_CONFIG: Record<TipoCAPA, { label: string; color: string; bg: string; descripcion: string }> = {
  correctiva: { label: 'Correctiva', color: 'text-red-400', bg: 'bg-red-500/20', descripcion: 'Eliminar causa de no conformidad existente' },
  preventiva: { label: 'Preventiva', color: 'text-blue-400', bg: 'bg-blue-500/20', descripcion: 'Prevenir no conformidad potencial' },
  mejora: { label: 'Mejora', color: 'text-emerald-400', bg: 'bg-emerald-500/20', descripcion: 'Mejora continua del sistema' },
};

export const QMS_ESTADO_NCR_CONFIG: Record<EstadoNCR, { label: string; color: string; bg: string }> = {
  abierta: { label: 'Abierta', color: 'text-red-400', bg: 'bg-red-500/20' },
  en_analisis: { label: 'En Análisis', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  en_implementacion: { label: 'En Implementación', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  verificacion: { label: 'Verificación', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  cerrada: { label: 'Cerrada', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  cancelada: { label: 'Cancelada', color: 'text-slate-400', bg: 'bg-slate-500/20' },
};

export const QMS_ESTADO_CAPA_CONFIG: Record<EstadoCAPA, { label: string; color: string; bg: string }> = {
  abierta: { label: 'Abierta', color: 'text-red-400', bg: 'bg-red-500/20' },
  en_analisis: { label: 'En Análisis', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  en_implementacion: { label: 'En Implementación', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  verificacion: { label: 'Verificación', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  cerrada: { label: 'Cerrada', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  cancelada: { label: 'Cancelada', color: 'text-slate-400', bg: 'bg-slate-500/20' },
};

export const QMS_TIPO_CERTIFICADO_CONFIG: Record<TipoCertificado, { label: string; descripcion: string }> = {
  coa: { label: 'COA', descripcion: 'Certificate of Analysis - Certificado de Análisis' },
  coc: { label: 'COC', descripcion: 'Certificate of Conformance - Certificado de Conformidad' },
  coo: { label: 'COO', descripcion: 'Certificate of Origin - Certificado de Origen' },
  msds: { label: 'MSDS', descripcion: 'Material Safety Data Sheet - Hoja de Seguridad' },
  halal: { label: 'Halal', descripcion: 'Certificación Halal' },
  kosher: { label: 'Kosher', descripcion: 'Certificación Kosher' },
  organico: { label: 'Orgánico', descripcion: 'Certificación Orgánica' },
};

export const QMS_METODO_MUESTREO_CONFIG: Record<MetodoMuestreo, { label: string; descripcion: string }> = {
  aql: { label: 'AQL', descripcion: 'Acceptable Quality Level - Nivel de calidad aceptable' },
  porcentaje: { label: 'Porcentaje', descripcion: 'Porcentaje fijo de la cantidad recibida' },
  fijo: { label: 'Cantidad Fija', descripcion: 'Cantidad fija independiente del lote' },
  '100%': { label: '100%', descripcion: 'Inspección completa de todas las unidades' },
};

// Tablas AQL estándar (ISO 2859-1)
export const QMS_TABLA_AQL: Record<string, { tamanioLote: string; nivelI: number; nivelII: number; nivelIII: number }> = {
  A: { tamanioLote: '2-8', nivelI: 2, nivelII: 2, nivelIII: 3 },
  B: { tamanioLote: '9-15', nivelI: 2, nivelII: 3, nivelIII: 5 },
  C: { tamanioLote: '16-25', nivelI: 3, nivelII: 5, nivelIII: 8 },
  D: { tamanioLote: '26-50', nivelI: 5, nivelII: 8, nivelIII: 13 },
  E: { tamanioLote: '51-90', nivelI: 5, nivelII: 13, nivelIII: 20 },
  F: { tamanioLote: '91-150', nivelI: 8, nivelII: 20, nivelIII: 32 },
  G: { tamanioLote: '151-280', nivelI: 13, nivelII: 32, nivelIII: 50 },
  H: { tamanioLote: '281-500', nivelI: 20, nivelII: 50, nivelIII: 80 },
  J: { tamanioLote: '501-1200', nivelI: 32, nivelII: 80, nivelIII: 125 },
  K: { tamanioLote: '1201-3200', nivelI: 50, nivelII: 125, nivelIII: 200 },
  L: { tamanioLote: '3201-10000', nivelI: 80, nivelII: 200, nivelIII: 315 },
  M: { tamanioLote: '10001-35000', nivelI: 125, nivelII: 315, nivelIII: 500 },
  N: { tamanioLote: '35001-150000', nivelI: 200, nivelII: 500, nivelIII: 800 },
  P: { tamanioLote: '150001-500000', nivelI: 315, nivelII: 800, nivelIII: 1250 },
  Q: { tamanioLote: '500001+', nivelI: 500, nivelII: 1250, nivelIII: 2000 },
};

// --------------------------------------------
// MÉTRICAS QMS
// --------------------------------------------

export interface QMSMetricas {
  // Inspecciones
  inspeccionesHoy: number;
  inspeccionesPendientes: number;
  inspeccionesEstaSemana: number;
  tasaAprobacion: number;
  tasaAprobacionTendencia: number;
  
  // NCRs
  ncrsAbiertas: number;
  ncrsCriticas: number;
  ncrsMayores: number;
  ncrsEsteMes: number;
  tiempoPromedioResolucionNCR: number; // en días
  
  // CAPAs
  capasAbiertas: number;
  capasVencidas: number;
  capasProximasVencer: number; // próximos 7 días
  efectividadCAPAs: number; // porcentaje
  
  // Recalls
  recallsActivos: number;
  recallsClaseI: number;
  porcentajeRecuperacionPromedio: number;
  
  // Instrumentos
  instrumentosPorCalibrar: number; // próximos 30 días
  instrumentosVencidos: number;
  instrumentosEnCalibracion: number;
  
  // Calidad general
  ppmDefectos: number; // partes por millón
  costoNoCalidad: number;
  costoNoCalidadMes: number;
  
  // Proveedores
  proveedoresConNCR: number;
  mejorProveedor?: { nombre: string; tasaAprobacion: number };
  peorProveedor?: { nombre: string; tasaAprobacion: number };
  
  // Tendencias (últimos 6 meses)
  tendenciaInspecciones: QMSTendenciaMes[];
  tendenciaNCRs: QMSTendenciaMes[];
  tendenciaPPM: QMSTendenciaMes[];
}

export interface QMSTendenciaMes {
  mes: string;
  valor: number;
  valorAnterior?: number;
  variacion?: number;
}

// --------------------------------------------
// DASHBOARD WIDGETS QMS
// --------------------------------------------

export interface QMSWidgetConfig {
  id: string;
  tipo: 'kpi' | 'chart' | 'list' | 'table' | 'alert';
  titulo: string;
  tamano: 'sm' | 'md' | 'lg' | 'xl';
  posicion: { x: number; y: number };
  visible: boolean;
  config?: Record<string, any>;
}

export interface QMSAlerta {
  id: string;
  tipo: 'critica' | 'alta' | 'media' | 'baja';
  categoria: 'ncr' | 'capa' | 'recall' | 'calibracion' | 'inspeccion';
  titulo: string;
  descripcion: string;
  entidad_id: string;
  entidad_tipo: string;
  fecha: Date;
  leida: boolean;
  accion_url?: string;
}

// --------------------------------------------
// REPORTES QMS
// --------------------------------------------

export type TipoReporteQMS = 
  | 'resumen_mensual'
  | 'ncr_por_proveedor'
  | 'ncr_por_producto'
  | 'tendencia_calidad'
  | 'efectividad_capa'
  | 'calibracion_instrumentos'
  | 'costo_no_calidad'
  | 'auditoria_interna';

export interface QMSReporte {
  id: string;
  tipo: TipoReporteQMS;
  titulo: string;
  descripcion?: string;
  parametros: Record<string, any>;
  fecha_generacion: Date;
  generado_por: string;
  archivo_url?: string;
  datos?: Record<string, any>;
}

// --------------------------------------------
// AUDITORÍAS INTERNAS QMS
// --------------------------------------------

export type TipoAuditoria = 'interna' | 'externa' | 'cliente' | 'certificacion';
export type EstadoAuditoria = 'planificada' | 'en_proceso' | 'completada' | 'cancelada';

export interface QMSAuditoria {
  id: string;
  numero: string;
  tipo: TipoAuditoria;
  titulo: string;
  alcance: string;
  criterios: string;
  
  // Fechas
  fecha_planificada: Date;
  fecha_inicio?: Date;
  fecha_fin?: Date;
  
  // Equipo
  auditor_lider: string;
  auditores?: string[];
  
  // Resultados
  estado: EstadoAuditoria;
  hallazgos?: QMSHallazgoAuditoria[];
  conclusion?: string;
  
  // Documentos
  plan_url?: string;
  informe_url?: string;
  
  creado_por?: string;
  creado_at: Date;
}

export type TipoHallazgo = 'no_conformidad_mayor' | 'no_conformidad_menor' | 'observacion' | 'oportunidad_mejora';

export interface QMSHallazgoAuditoria {
  id: string;
  auditoria_id: string;
  tipo: TipoHallazgo;
  requisito: string; // Cláusula de norma
  descripcion: string;
  evidencia?: string;
  ncr_id?: string; // Si genera NCR
  capa_id?: string; // Si genera CAPA
  estado: 'abierto' | 'en_seguimiento' | 'cerrado';
  fecha_cierre?: Date;
}

// --------------------------------------------
// HELPERS Y UTILIDADES QMS
// --------------------------------------------

export const calcularTamanioMuestraAQL = (
  cantidadLote: number, 
  nivelInspeccion: 'I' | 'II' | 'III' = 'II'
): number => {
  // Determinar código de letra según tamaño de lote
  let codigoLetra: string;
  if (cantidadLote <= 8) codigoLetra = 'A';
  else if (cantidadLote <= 15) codigoLetra = 'B';
  else if (cantidadLote <= 25) codigoLetra = 'C';
  else if (cantidadLote <= 50) codigoLetra = 'D';
  else if (cantidadLote <= 90) codigoLetra = 'E';
  else if (cantidadLote <= 150) codigoLetra = 'F';
  else if (cantidadLote <= 280) codigoLetra = 'G';
  else if (cantidadLote <= 500) codigoLetra = 'H';
  else if (cantidadLote <= 1200) codigoLetra = 'J';
  else if (cantidadLote <= 3200) codigoLetra = 'K';
  else if (cantidadLote <= 10000) codigoLetra = 'L';
  else if (cantidadLote <= 35000) codigoLetra = 'M';
  else if (cantidadLote <= 150000) codigoLetra = 'N';
  else if (cantidadLote <= 500000) codigoLetra = 'P';
  else codigoLetra = 'Q';
  
  const tabla = QMS_TABLA_AQL[codigoLetra];
  switch (nivelInspeccion) {
    case 'I': return tabla.nivelI;
    case 'II': return tabla.nivelII;
    case 'III': return tabla.nivelIII;
    default: return tabla.nivelII;
  }
};

export const formatearNumeroQMS = (
  tipo: 'INS' | 'NCR' | 'CAPA' | 'COA' | 'COC' | 'RCL',
  secuencia: number,
  año?: number
): string => {
  const yearStr = (año || new Date().getFullYear()).toString();
  const seqStr = secuencia.toString().padStart(5, '0');
  return `${tipo}-${yearStr}-${seqStr}`;
};

export const getDiasParaFecha = (fecha: Date | string): number => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const objetivo = new Date(fecha);
  objetivo.setHours(0, 0, 0, 0);
  return Math.ceil((objetivo.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
};

export const getColorPorDiasRestantes = (dias: number): string => {
  if (dias < 0) return 'text-red-500';
  if (dias <= 3) return 'text-red-400';
  if (dias <= 7) return 'text-orange-400';
  if (dias <= 14) return 'text-amber-400';
  return 'text-slate-400';
};

export const getBgColorPorDiasRestantes = (dias: number): string => {
  if (dias < 0) return 'bg-red-500/20';
  if (dias <= 3) return 'bg-red-500/10';
  if (dias <= 7) return 'bg-orange-500/10';
  if (dias <= 14) return 'bg-amber-500/10';
  return 'bg-slate-500/10';
};