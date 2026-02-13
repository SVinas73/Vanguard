// ============================================
// AGENTE IA - TIPOS
// ============================================

export interface MensajeAgente {
  id: string;
  rol: 'user' | 'assistant' | 'system' | 'tool';
  contenido: string;
  timestamp: Date;
  
  // Metadata
  toolCalls?: ToolCall[];
  razonamiento?: string;
  error?: boolean;
  cargando?: boolean;
}

export interface ToolCall {
  id: string;
  nombre: string;
  argumentos: Record<string, any>;
  resultado?: any;
  exito?: boolean;
  duracion?: number;
}

export interface ConversacionAgente {
  id: string;
  titulo?: string;
  mensajes: MensajeAgente[];
  resumen?: string;
  creado_at: Date;
  actualizado_at: Date;
}

// ============================================
// REQUEST/RESPONSE
// ============================================

export interface AgenteRequest {
  mensaje: string;
  conversacion_id?: string;
  contexto: {
    usuario_email: string;
    usuario_nombre?: string;
    rol?: string;
  };
}

export interface AgenteResponse {
  respuesta: string;
  conversacion_id: string;
  tool_calls?: ToolCall[];
  razonamiento?: string;
  sugerencias?: string[];
  error?: string;
}

// ============================================
// STREAMING
// ============================================

export interface StreamChunk {
  tipo: 'texto' | 'tool_start' | 'tool_end' | 'razonamiento' | 'final' | 'error';
  contenido: string;
  tool_call?: ToolCall;
}

// ============================================
// SUGERENCIAS
// ============================================

export const SUGERENCIAS_INICIALES = [
  "¿Qué productos están por agotarse?",
  "Analiza las ventas del último mes",
  "¿Cuáles son los productos más rentables?",
  "Genera recomendaciones de reposición",
  "¿Qué tendencias ves en el inventario?",
  "Resumen del estado general del negocio",
];

export const EJEMPLOS_AVANZADOS = [
  "Analiza los productos críticos y genera una orden de compra para reponerlos",
  "Compara las ventas de este mes con el anterior y dame insights",
  "¿Qué productos debería promocionar basándote en el stock y las tendencias?",
  "Predice qué productos se van a agotar en los próximos 7 días",
];