// ============================================
// WMS - Warehouse Management System
// Tipos del módulo de gestión de almacenes
// ============================================

// ============================================
// UBICACIONES
// ============================================

export type TipoUbicacion = 'almacen' | 'zona' | 'pasillo' | 'rack' | 'nivel' | 'posicion';
export type TipoZona = 'recepcion' | 'almacenamiento' | 'picking' | 'packing' | 'despacho' | 'cuarentena' | 'devolucion' | 'crossdock';
export type EstadoUbicacion = 'disponible' | 'ocupada' | 'reservada' | 'bloqueada' | 'mantenimiento';
export type TipoAlmacenamiento = 'ambiente' | 'refrigerado' | 'congelado' | 'inflamable' | 'peligroso' | 'alto_valor';

export interface Almacen {
  id: string;
  codigo: string;
  nombre: string;
  direccion?: string;
  ciudad?: string;
  pais?: string;
  
  // Dimensiones
  area_total_m2?: number;
  altura_maxima_m?: number;
  
  // Capacidad
  ubicaciones_totales: number;
  ubicaciones_disponibles: number;
  
  // Configuración
  tipo_almacenamiento: TipoAlmacenamiento[];
  horario_operacion?: string;
  
  // Contacto
  responsable?: string;
  telefono?: string;
  email?: string;
  
  activo: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Zona {
  id: string;
  almacen_id: string;
  codigo: string;
  nombre: string;
  tipo: TipoZona;
  
  // Características
  tipo_almacenamiento?: TipoAlmacenamiento;
  temperatura_min?: number;
  temperatura_max?: number;
  
  // Prioridad para picking
  prioridad_picking: number; // 1 = más cerca de despacho
  
  // Capacidad
  ubicaciones_totales: number;
  ubicaciones_disponibles: number;
  
  activo: boolean;
  created_at: string;
}

export interface Ubicacion {
  id: string;
  almacen_id: string;
  zona_id: string;
  
  // Código jerárquico: ALM01-A-01-03-02 (Almacén-Pasillo-Rack-Nivel-Posición)
  codigo: string;
  codigo_completo: string;
  
  // Jerarquía
  pasillo: string;
  rack: string;
  nivel: string;
  posicion: string;
  
  // Tipo y estado
  tipo: TipoUbicacion;
  estado: EstadoUbicacion;
  
  // Dimensiones
  ancho_cm?: number;
  alto_cm?: number;
  profundidad_cm?: number;
  peso_maximo_kg?: number;
  
  // Restricciones
  tipo_almacenamiento?: TipoAlmacenamiento;
  solo_producto_id?: string; // Ubicación dedicada
  categoria_permitida?: string;
  
  // ABC Slotting
  clasificacion_abc?: 'A' | 'B' | 'C';
  frecuencia_picks: number; // Histórico de picks
  
  // Contenido actual
  producto_id?: string;
  producto_codigo?: string;
  producto_nombre?: string;
  lote_id?: string;
  lote_numero?: string;
  cantidad: number;
  unidad_medida?: string;
  fecha_vencimiento?: string;
  
  // Reservas
  cantidad_reservada: number;
  cantidad_disponible: number;
  
  // Verificación
  verificado: boolean;
  fecha_ultimo_conteo?: string;
  
  // Picking
  pickeable: boolean;
  es_ubicacion_picking: boolean;
  ubicacion_reposicion_id?: string; // Ubicación de bulk para reponer
  
  created_at: string;
  updated_at?: string;
}

// ============================================
// RECEPCIÓN Y PUT-AWAY
// ============================================

export type EstadoRecepcion = 'pendiente' | 'en_proceso' | 'parcial' | 'completada' | 'con_diferencias';
export type EstadoPutaway = 'pendiente' | 'asignado' | 'en_proceso' | 'completado' | 'cancelado';

export interface OrdenRecepcion {
  id: string;
  numero: string;
  
  // Origen
  tipo_origen: 'compra' | 'transferencia' | 'devolucion' | 'produccion';
  orden_compra_id?: string;
  orden_compra_numero?: string;
  proveedor_id?: string;
  proveedor_nombre?: string;
  
  // Destino
  almacen_id: string;
  almacen_nombre?: string;
  zona_recepcion_id?: string;
  
  // Fechas
  fecha_esperada?: string;
  fecha_recepcion?: string;
  
  // Estado
  estado: EstadoRecepcion;
  
  // Totales
  lineas_totales: number;
  lineas_recibidas: number;
  unidades_esperadas: number;
  unidades_recibidas: number;
  
  // Documentos
  guia_remision?: string;
  factura?: string;
  
  // QC
  requiere_inspeccion: boolean;
  inspeccion_id?: string;
  
  notas?: string;
  recibido_por?: string;
  created_at: string;
  updated_at?: string;
  
  // Líneas
  lineas?: LineaRecepcion[];
}

export interface LineaRecepcion {
  id: string;
  orden_recepcion_id: string;
  
  // Producto
  producto_id: string;
  producto_codigo: string;
  producto_nombre: string;
  
  // Cantidades
  cantidad_esperada: number;
  cantidad_recibida: number;
  cantidad_rechazada: number;
  unidad_medida: string;
  
  // Lote
  lote_numero?: string;
  fecha_produccion?: string;
  fecha_vencimiento?: string;
  
  // Estado
  estado: 'pendiente' | 'parcial' | 'completa' | 'con_diferencias';
  
  // Put-away
  putaway_completado: boolean;
  tareas_putaway?: TareaPutaway[];
  
  notas?: string;
}

export interface TareaPutaway {
  id: string;
  orden_recepcion_id: string;
  linea_recepcion_id: string;
  
  // Producto
  producto_id: string;
  producto_codigo: string;
  producto_nombre: string;
  lote_numero?: string;
  
  // Cantidad
  cantidad: number;
  unidad_medida: string;
  
  // Origen
  ubicacion_origen_id?: string;
  ubicacion_origen_codigo?: string;
  
  // Destino sugerido por el sistema
  ubicacion_destino_id: string;
  ubicacion_destino_codigo: string;
  razon_sugerencia?: string; // "Misma familia", "Zona ABC-A", "FEFO"
  
  // Estado
  estado: EstadoPutaway;
  
  // Ejecución
  asignado_a?: string;
  fecha_asignacion?: string;
  fecha_inicio?: string;
  fecha_completado?: string;
  
  // Ubicación real (si difiere de sugerida)
  ubicacion_real_id?: string;
  ubicacion_real_codigo?: string;
  
  prioridad: number;
  notas?: string;
  created_at: string;
}

// ============================================
// PICKING
// ============================================

export type TipoPicking = 'orden_unica' | 'batch' | 'wave' | 'cluster' | 'zone';
export type EstadoOrdenPicking = 'pendiente' | 'liberada' | 'asignada' | 'en_proceso' | 'completada' | 'parcial' | 'cancelada';
export type EstadoTareaPicking = 'pendiente' | 'asignada' | 'en_proceso' | 'completada' | 'short_pick' | 'cancelada';

export interface WavePicking {
  id: string;
  numero: string;
  
  // Configuración
  tipo: TipoPicking;
  nombre?: string;
  
  // Órdenes incluidas
  ordenes_ids: string[];
  ordenes_count: number;
  
  // Fechas
  fecha_creacion: string;
  fecha_liberacion?: string;
  fecha_inicio?: string;
  fecha_completado?: string;
  fecha_limite?: string;
  
  // Estado
  estado: EstadoOrdenPicking;
  
  // Métricas
  lineas_totales: number;
  lineas_completadas: number;
  unidades_totales: number;
  unidades_pickeadas: number;
  
  // Asignación
  pickers_asignados?: string[];
  
  // Optimización
  ruta_optimizada: boolean;
  tiempo_estimado_min?: number;
  distancia_estimada_m?: number;
  
  prioridad: number;
  created_by?: string;
  created_at: string;
}

export interface OrdenPicking {
  id: string;
  numero: string;
  
  // Origen
  tipo_origen: 'venta' | 'transferencia' | 'produccion' | 'reposicion';
  orden_venta_id?: string;
  orden_venta_numero?: string;
  cliente_id?: string;
  cliente_nombre?: string;
  
  // Wave (si aplica)
  wave_id?: string;
  wave_numero?: string;
  
  // Almacén
  almacen_id: string;
  
  // Fechas
  fecha_requerida?: string;
  fecha_liberacion?: string;
  fecha_inicio?: string;
  fecha_completado?: string;
  
  // Estado
  estado: EstadoOrdenPicking;
  
  // Totales
  lineas_totales: number;
  lineas_completadas: number;
  unidades_totales: number;
  unidades_pickeadas: number;
  
  // Asignación
  picker_asignado?: string;
  
  // Ruta
  secuencia_ruta?: number;
  
  prioridad: number;
  notas?: string;
  created_at: string;
  updated_at?: string;
  
  // Líneas
  lineas?: LineaPicking[];
}

export interface LineaPicking {
  id: string;
  orden_picking_id: string;
  
  // Producto
  producto_id: string;
  producto_codigo: string;
  producto_nombre: string;
  
  // Cantidad
  cantidad_solicitada: number;
  cantidad_pickeada: number;
  cantidad_short: number;
  unidad_medida: string;
  
  // Ubicación asignada
  ubicacion_id: string;
  ubicacion_codigo: string;
  
  // Lote (FEFO/FIFO)
  lote_numero?: string;
  fecha_vencimiento?: string;
  
  // Estado
  estado: EstadoTareaPicking;
  
  // Secuencia en ruta
  secuencia: number;
  
  // Ejecución
  fecha_picking?: string;
  pickeado_por?: string;
  
  notas?: string;
}

// ============================================
// INVENTARIO Y MOVIMIENTOS
// ============================================

export type TipoMovimiento = 
  | 'entrada_compra' 
  | 'entrada_produccion' 
  | 'entrada_devolucion'
  | 'entrada_transferencia'
  | 'entrada_ajuste'
  | 'salida_venta'
  | 'salida_produccion'
  | 'salida_transferencia'
  | 'salida_merma'
  | 'salida_ajuste'
  | 'transferencia_interna'
  | 'reposicion'
  | 'conteo_inventario';

export type EstadoMovimiento = 'pendiente' | 'en_proceso' | 'completado' | 'cancelado';

export interface MovimientoInventario {
  id: string;
  numero: string;
  
  tipo: TipoMovimiento;
  estado: EstadoMovimiento;
  
  // Producto
  producto_id: string;
  producto_codigo: string;
  producto_nombre: string;
  lote_numero?: string;
  
  // Cantidad
  cantidad: number;
  unidad_medida: string;
  
  // Ubicaciones
  ubicacion_origen_id?: string;
  ubicacion_origen_codigo?: string;
  ubicacion_destino_id?: string;
  ubicacion_destino_codigo?: string;
  
  // Referencia
  documento_referencia?: string;
  documento_tipo?: string;
  
  // Costos
  costo_unitario?: number;
  costo_total?: number;
  
  // Ejecución
  solicitado_por?: string;
  ejecutado_por?: string;
  fecha_solicitud: string;
  fecha_ejecucion?: string;
  
  motivo?: string;
  notas?: string;
  
  created_at: string;
}

export interface StockUbicacion {
  ubicacion_id: string;
  ubicacion_codigo: string;
  producto_id: string;
  producto_codigo: string;
  producto_nombre: string;
  lote_numero?: string;
  fecha_vencimiento?: string;
  cantidad: number;
  cantidad_reservada: number;
  cantidad_disponible: number;
  unidad_medida: string;
  fecha_entrada: string;
  dias_en_ubicacion: number;
}

// ============================================
// SLOTTING
// ============================================

export type ClasificacionABC = 'A' | 'B' | 'C';
export type ClasificacionXYZ = 'X' | 'Y' | 'Z'; // Variabilidad de demanda

export interface AnalisisSlotting {
  id: string;
  fecha_analisis: string;
  
  // Producto
  producto_id: string;
  producto_codigo: string;
  producto_nombre: string;
  categoria?: string;
  
  // Métricas de demanda
  picks_ultimos_30_dias: number;
  picks_ultimos_90_dias: number;
  unidades_ultimos_30_dias: number;
  frecuencia_picks_diaria: number;
  
  // Clasificación
  clasificacion_abc: ClasificacionABC;
  clasificacion_xyz?: ClasificacionXYZ;
  
  // Ubicación actual
  ubicacion_actual_id?: string;
  ubicacion_actual_codigo?: string;
  zona_actual?: string;
  
  // Recomendación
  ubicacion_recomendada_id?: string;
  ubicacion_recomendada_codigo?: string;
  zona_recomendada?: string;
  razon_recomendacion?: string;
  
  // Estado
  requiere_reubicacion: boolean;
  reubicacion_ejecutada: boolean;
  fecha_reubicacion?: string;
  
  // Métricas de eficiencia
  distancia_actual_promedio_m?: number;
  distancia_nueva_promedio_m?: number;
  ahorro_distancia_m?: number;
  ahorro_tiempo_segundos?: number;
}

export interface ConfiguracionSlotting {
  id: string;
  almacen_id: string;
  
  // Umbrales ABC
  umbral_a_porcentaje: number; // Top 20% = A
  umbral_b_porcentaje: number; // Siguiente 30% = B
  // Resto = C
  
  // Zonas por clasificación
  zonas_clase_a: string[]; // Zonas cerca de despacho
  zonas_clase_b: string[];
  zonas_clase_c: string[]; // Zonas más alejadas
  
  // Reglas
  considerar_peso: boolean;
  considerar_volumen: boolean;
  considerar_familia: boolean;
  
  // Frecuencia
  frecuencia_analisis_dias: number;
  ultimo_analisis?: string;
  
  activo: boolean;
  created_at: string;
}

// ============================================
// CONTEO DE INVENTARIO
// ============================================

export type TipoConteo = 'ciclico' | 'completo' | 'aleatorio' | 'por_discrepancia';
export type EstadoConteo = 'planificado' | 'en_proceso' | 'pendiente_revision' | 'completado' | 'cancelado';

export interface OrdenConteo {
  id: string;
  numero: string;
  
  tipo: TipoConteo;
  estado: EstadoConteo;
  
  // Alcance
  almacen_id: string;
  zona_ids?: string[];
  clasificacion_abc?: ClasificacionABC;
  
  // Fechas
  fecha_planificada: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  
  // Asignación
  asignado_a?: string[];
  
  // Totales
  ubicaciones_totales: number;
  ubicaciones_contadas: number;
  ubicaciones_con_diferencia: number;
  
  // Valorización
  diferencia_unidades: number;
  diferencia_valor?: number;
  
  requiere_reconteo: boolean;
  aprobado_por?: string;
  
  notas?: string;
  created_at: string;
}

export interface LineaConteo {
  id: string;
  orden_conteo_id: string;
  
  // Ubicación
  ubicacion_id: string;
  ubicacion_codigo: string;
  
  // Producto
  producto_id: string;
  producto_codigo: string;
  producto_nombre: string;
  lote_numero?: string;
  
  // Cantidades
  cantidad_sistema: number;
  cantidad_contada?: number;
  diferencia?: number;
  
  // Estado
  contado: boolean;
  tiene_diferencia: boolean;
  requiere_reconteo: boolean;
  
  // Reconteo
  cantidad_reconteo?: number;
  recontado_por?: string;
  
  // Ejecución
  contado_por?: string;
  fecha_conteo?: string;
  
  notas?: string;
}

// ============================================
// DASHBOARD Y MÉTRICAS
// ============================================

export interface MetricasWMS {
  // Capacidad
  ubicaciones_totales: number;
  ubicaciones_ocupadas: number;
  ubicaciones_disponibles: number;
  porcentaje_ocupacion: number;
  
  // Recepciones
  recepciones_pendientes: number;
  recepciones_hoy: number;
  unidades_recibidas_hoy: number;
  
  // Picking
  ordenes_picking_pendientes: number;
  ordenes_picking_en_proceso: number;
  ordenes_picking_completadas_hoy: number;
  unidades_pickeadas_hoy: number;
  
  // Productividad
  picks_por_hora: number;
  putaways_por_hora: number;
  tiempo_promedio_picking_min: number;
  
  // Precisión
  precision_inventario: number;
  precision_picking: number;
  
  // Alertas
  productos_sin_stock: number;
  productos_bajo_minimo: number;
  lotes_proximos_vencer: number;
  ubicaciones_bloqueadas: number;
}

// ============================================
// CONFIGURACIÓN
// ============================================

export interface ConfiguracionWMS {
  // Estrategias
  estrategia_putaway: 'fifo' | 'fefo' | 'lifo' | 'zona_fija' | 'aleatorio';
  estrategia_picking: 'fifo' | 'fefo' | 'lifo';
  
  // Reglas
  permitir_mezcla_lotes: boolean;
  permitir_mezcla_productos: boolean;
  validar_capacidad_ubicacion: boolean;
  
  // Umbrales
  dias_alerta_vencimiento: number;
  porcentaje_minimo_picking: number;
  
  // Automatización
  auto_asignar_putaway: boolean;
  auto_liberar_picking: boolean;
  auto_generar_reposicion: boolean;
  
  // Wave picking
  wave_picking_habilitado: boolean;
  max_ordenes_por_wave: number;
  hora_corte_wave?: string;
}