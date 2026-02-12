// ============================================
// ASISTENTE IA - TIPOS
// ============================================

export interface MensajeAsistente {
  id: string;
  rol: 'user' | 'assistant' | 'system';
  contenido: string;
  timestamp: Date;
  
  // Metadata opcional
  herramientasUsadas?: string[];
  datosAdjuntos?: any;
  error?: boolean;
  cargando?: boolean;
}

export interface ConversacionAsistente {
  id: string;
  titulo?: string;
  mensajes: MensajeAsistente[];
  creado_at: Date;
  actualizado_at: Date;
}

// ============================================
// HERRAMIENTAS DISPONIBLES
// ============================================

export type HerramientaID = 
  | 'consultar_stock'
  | 'consultar_producto'
  | 'buscar_productos'
  | 'productos_criticos'
  | 'prediccion_demanda'
  | 'analisis_ventas'
  | 'analisis_compras'
  | 'crear_movimiento'
  | 'crear_orden_compra'
  | 'consultar_ordenes'
  | 'consultar_clientes'
  | 'consultar_proveedores'
  | 'analisis_tendencias'
  | 'recomendaciones_reposicion'
  | 'consultar_proyectos'
  | 'consultar_rma'
  | 'metricas_dashboard';

export interface Herramienta {
  id: HerramientaID;
  nombre: string;
  descripcion: string;
  parametros: {
    nombre: string;
    tipo: 'string' | 'number' | 'boolean' | 'array';
    descripcion: string;
    requerido: boolean;
  }[];
  categoria: 'consulta' | 'accion' | 'analisis';
}

// ============================================
// REQUEST/RESPONSE API
// ============================================

export interface AsistenteRequest {
  mensaje: string;
  conversacion_id?: string;
  historial?: MensajeAsistente[];
  contexto?: {
    usuario_email: string;
    usuario_nombre?: string;
    rol?: string;
  };
}

export interface AsistenteResponse {
  respuesta: string;
  conversacion_id: string;
  herramientas_usadas?: {
    herramienta: string;
    parametros: any;
    resultado: any;
  }[];
  sugerencias?: string[];
  error?: string;
}

// ============================================
// CONFIGURACIÓN
// ============================================

export const HERRAMIENTAS_DISPONIBLES: Herramienta[] = [
  // === CONSULTAS ===
  {
    id: 'consultar_stock',
    nombre: 'Consultar Stock',
    descripcion: 'Obtiene el stock actual de un producto o todos los productos',
    parametros: [
      { nombre: 'codigo', tipo: 'string', descripcion: 'Código del producto (opcional)', requerido: false },
      { nombre: 'categoria', tipo: 'string', descripcion: 'Filtrar por categoría', requerido: false },
      { nombre: 'solo_criticos', tipo: 'boolean', descripcion: 'Solo productos con stock bajo', requerido: false },
    ],
    categoria: 'consulta',
  },
  {
    id: 'consultar_producto',
    nombre: 'Consultar Producto',
    descripcion: 'Obtiene información detallada de un producto específico',
    parametros: [
      { nombre: 'codigo', tipo: 'string', descripcion: 'Código del producto', requerido: true },
    ],
    categoria: 'consulta',
  },
  {
    id: 'buscar_productos',
    nombre: 'Buscar Productos',
    descripcion: 'Busca productos por nombre, descripción o código',
    parametros: [
      { nombre: 'query', tipo: 'string', descripcion: 'Término de búsqueda', requerido: true },
      { nombre: 'limite', tipo: 'number', descripcion: 'Cantidad máxima de resultados', requerido: false },
    ],
    categoria: 'consulta',
  },
  {
    id: 'productos_criticos',
    nombre: 'Productos Críticos',
    descripcion: 'Lista productos con stock bajo o por agotarse',
    parametros: [
      { nombre: 'limite', tipo: 'number', descripcion: 'Cantidad máxima', requerido: false },
    ],
    categoria: 'consulta',
  },
  {
    id: 'consultar_ordenes',
    nombre: 'Consultar Órdenes',
    descripcion: 'Obtiene órdenes de compra o venta',
    parametros: [
      { nombre: 'tipo', tipo: 'string', descripcion: 'compra o venta', requerido: true },
      { nombre: 'estado', tipo: 'string', descripcion: 'Estado de la orden', requerido: false },
      { nombre: 'limite', tipo: 'number', descripcion: 'Cantidad máxima', requerido: false },
    ],
    categoria: 'consulta',
  },
  {
    id: 'consultar_clientes',
    nombre: 'Consultar Clientes',
    descripcion: 'Lista clientes o busca uno específico',
    parametros: [
      { nombre: 'query', tipo: 'string', descripcion: 'Búsqueda por nombre o RUT', requerido: false },
      { nombre: 'limite', tipo: 'number', descripcion: 'Cantidad máxima', requerido: false },
    ],
    categoria: 'consulta',
  },
  {
    id: 'consultar_proveedores',
    nombre: 'Consultar Proveedores',
    descripcion: 'Lista proveedores o busca uno específico',
    parametros: [
      { nombre: 'query', tipo: 'string', descripcion: 'Búsqueda por nombre', requerido: false },
      { nombre: 'limite', tipo: 'number', descripcion: 'Cantidad máxima', requerido: false },
    ],
    categoria: 'consulta',
  },
  {
    id: 'metricas_dashboard',
    nombre: 'Métricas Dashboard',
    descripcion: 'Obtiene métricas generales del sistema (ventas, compras, stock, etc)',
    parametros: [
      { nombre: 'periodo', tipo: 'string', descripcion: 'hoy, semana, mes, año', requerido: false },
    ],
    categoria: 'consulta',
  },
  
  // === ANÁLISIS ===
  {
    id: 'prediccion_demanda',
    nombre: 'Predicción de Demanda',
    descripcion: 'Predice la demanda futura de un producto usando ML',
    parametros: [
      { nombre: 'codigo', tipo: 'string', descripcion: 'Código del producto', requerido: true },
      { nombre: 'dias', tipo: 'number', descripcion: 'Días a predecir', requerido: false },
    ],
    categoria: 'analisis',
  },
  {
    id: 'analisis_ventas',
    nombre: 'Análisis de Ventas',
    descripcion: 'Analiza ventas por período, producto o cliente',
    parametros: [
      { nombre: 'periodo', tipo: 'string', descripcion: 'hoy, semana, mes, año', requerido: false },
      { nombre: 'producto_codigo', tipo: 'string', descripcion: 'Filtrar por producto', requerido: false },
      { nombre: 'cliente_id', tipo: 'string', descripcion: 'Filtrar por cliente', requerido: false },
    ],
    categoria: 'analisis',
  },
  {
    id: 'analisis_compras',
    nombre: 'Análisis de Compras',
    descripcion: 'Analiza compras por período o proveedor',
    parametros: [
      { nombre: 'periodo', tipo: 'string', descripcion: 'hoy, semana, mes, año', requerido: false },
      { nombre: 'proveedor_id', tipo: 'string', descripcion: 'Filtrar por proveedor', requerido: false },
    ],
    categoria: 'analisis',
  },
  {
    id: 'analisis_tendencias',
    nombre: 'Análisis de Tendencias',
    descripcion: 'Analiza tendencias de productos (creciendo, estable, decreciendo)',
    parametros: [
      { nombre: 'categoria', tipo: 'string', descripcion: 'Filtrar por categoría', requerido: false },
      { nombre: 'limite', tipo: 'number', descripcion: 'Cantidad de productos', requerido: false },
    ],
    categoria: 'analisis',
  },
  {
    id: 'recomendaciones_reposicion',
    nombre: 'Recomendaciones de Reposición',
    descripcion: 'Genera recomendaciones de qué productos reponer y en qué cantidad',
    parametros: [
      { nombre: 'urgencia', tipo: 'string', descripcion: 'critica, alta, media, baja', requerido: false },
      { nombre: 'limite', tipo: 'number', descripcion: 'Cantidad máxima', requerido: false },
    ],
    categoria: 'analisis',
  },
  
  // === ACCIONES ===
  {
    id: 'crear_movimiento',
    nombre: 'Crear Movimiento',
    descripcion: 'Crea un movimiento de inventario (entrada, salida, ajuste)',
    parametros: [
      { nombre: 'producto_codigo', tipo: 'string', descripcion: 'Código del producto', requerido: true },
      { nombre: 'tipo', tipo: 'string', descripcion: 'entrada, salida, ajuste', requerido: true },
      { nombre: 'cantidad', tipo: 'number', descripcion: 'Cantidad a mover', requerido: true },
      { nombre: 'motivo', tipo: 'string', descripcion: 'Motivo del movimiento', requerido: false },
    ],
    categoria: 'accion',
  },
  {
    id: 'crear_orden_compra',
    nombre: 'Crear Orden de Compra',
    descripcion: 'Crea una nueva orden de compra',
    parametros: [
      { nombre: 'proveedor_id', tipo: 'string', descripcion: 'ID del proveedor', requerido: true },
      { nombre: 'productos', tipo: 'array', descripcion: 'Lista de {codigo, cantidad, precio}', requerido: true },
      { nombre: 'notas', tipo: 'string', descripcion: 'Notas adicionales', requerido: false },
    ],
    categoria: 'accion',
  },
];

// ============================================
// SUGERENCIAS RÁPIDAS
// ============================================

export const SUGERENCIAS_RAPIDAS = [
  "¿Qué productos están por agotarse?",
  "¿Cuánto vendimos este mes?",
  "¿Cuál es el producto más vendido?",
  "Genera recomendaciones de reposición",
  "¿Cuáles son las tendencias de ventas?",
  "Muéstrame el dashboard de métricas",
  "¿Qué órdenes de compra están pendientes?",
  "Predice la demanda de [producto]",
];