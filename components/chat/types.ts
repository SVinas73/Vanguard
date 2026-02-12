// ============================================
// CHAT INTERNO - TIPOS
// ============================================

export type TipoConversacion = 
  | 'general' 
  | 'producto' 
  | 'orden_compra' 
  | 'orden_venta' 
  | 'rma' 
  | 'proyecto' 
  | 'ensamblaje' 
  | 'inspeccion';

export type TipoMensaje = 'texto' | 'sistema' | 'archivo';

// ============================================
// CONVERSACIÓN
// ============================================

export interface ChatConversacion {
  id: string;
  titulo?: string;
  
  // Tipo y contexto
  tipo: TipoConversacion;
  referencia_id?: string;
  referencia_codigo?: string;
  
  // Participantes
  participantes: string[];
  
  // Estado
  activa: boolean;
  archivada: boolean;
  
  // Último mensaje
  ultimo_mensaje_at?: Date;
  ultimo_mensaje_preview?: string;
  
  // Contadores
  total_mensajes: number;
  
  // Auditoría
  creado_por: string;
  creado_at: Date;
  actualizado_at: Date;
}

// ============================================
// MENSAJE
// ============================================

export interface ChatAdjunto {
  nombre: string;
  url: string;
  tipo: string;
  tamano: number;
}

export interface ChatMensaje {
  id: string;
  conversacion_id: string;
  
  // Autor
  autor_email: string;
  autor_nombre?: string;
  
  // Contenido
  contenido: string;
  contenido_html?: string;
  
  // Menciones y lectura
  menciones: string[];
  leido_por: string[];
  
  // Adjuntos
  adjuntos: ChatAdjunto[];
  
  // Tipo
  tipo: TipoMensaje;
  
  // Respuesta
  respuesta_a_id?: string;
  respuesta_a?: ChatMensaje;
  
  // Estado
  editado: boolean;
  editado_at?: Date;
  eliminado: boolean;
  eliminado_at?: Date;
  
  // Timestamp
  creado_at: Date;
}

// ============================================
// NO LEÍDOS
// ============================================

export interface ChatNoLeido {
  id: string;
  usuario_email: string;
  conversacion_id: string;
  cantidad: number;
  ultimo_leido_at?: Date;
}

// ============================================
// HELPERS / UI
// ============================================

export interface ConversacionConNoLeidos extends ChatConversacion {
  no_leidos: number;
}

export interface ParticipanteInfo {
  email: string;
  nombre: string;
  avatar_url?: string;
  online?: boolean;
}

// Configuración de tipos de conversación
export const TIPO_CONVERSACION_CONFIG: Record<TipoConversacion, {
  label: string;
  color: string;
  bg: string;
  icon: string;
}> = {
  general: { 
    label: 'General', 
    color: 'text-slate-400', 
    bg: 'bg-slate-500/15',
    icon: 'MessageCircle'
  },
  producto: { 
    label: 'Producto', 
    color: 'text-blue-400', 
    bg: 'bg-blue-500/15',
    icon: 'Package'
  },
  orden_compra: { 
    label: 'Orden de Compra', 
    color: 'text-amber-400', 
    bg: 'bg-amber-500/15',
    icon: 'ShoppingCart'
  },
  orden_venta: { 
    label: 'Orden de Venta', 
    color: 'text-emerald-400', 
    bg: 'bg-emerald-500/15',
    icon: 'TrendingUp'
  },
  rma: { 
    label: 'RMA', 
    color: 'text-red-400', 
    bg: 'bg-red-500/15',
    icon: 'RotateCcw'
  },
  proyecto: { 
    label: 'Proyecto', 
    color: 'text-violet-400', 
    bg: 'bg-violet-500/15',
    icon: 'Kanban'
  },
  ensamblaje: { 
    label: 'Ensamblaje', 
    color: 'text-cyan-400', 
    bg: 'bg-cyan-500/15',
    icon: 'Wrench'
  },
  inspeccion: { 
    label: 'Inspección', 
    color: 'text-orange-400', 
    bg: 'bg-orange-500/15',
    icon: 'ClipboardCheck'
  },
};

// ============================================
// FORM DATA
// ============================================

export interface NuevaConversacionData {
  titulo?: string;
  tipo: TipoConversacion;
  referencia_id?: string;
  referencia_codigo?: string;
  participantes: string[];
  mensaje_inicial?: string;
}

export interface NuevoMensajeData {
  conversacion_id: string;
  contenido: string;
  menciones?: string[];
  respuesta_a_id?: string;
}