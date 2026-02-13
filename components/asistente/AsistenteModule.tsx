'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { MensajeAgente, ToolCall, SUGERENCIAS_INICIALES, EJEMPLOS_AVANZADOS } from './types';
import {
  Bot,
  Send,
  User,
  Loader2,
  Brain,
  Trash2,
  Wrench,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Package,
  TrendingUp,
  BarChart3,
  AlertTriangle,
  Lightbulb,
  Clock,
} from 'lucide-react';

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function AsistenteModule() {
  const { user } = useAuth();
  const [mensajes, setMensajes] = useState<MensajeAgente[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  // Mensaje de bienvenida
  useEffect(() => {
    if (mensajes.length === 0) {
      setMensajes([{
        id: 'welcome',
        rol: 'assistant',
        contenido: `¡Hola${user?.nombre ? ` ${user.nombre.split(' ')[0]}` : ''}! 👋 

Soy el **Asistente Inteligente de Vanguard**, potenciado por IA.

Puedo ayudarte a:
• 📦 Consultar y analizar tu inventario
• 📊 Generar reportes y métricas de ventas
• 🔮 Predecir demanda y detectar tendencias  
• ⚡ Ejecutar acciones como crear órdenes de compra

**Tip:** Puedo encadenar múltiples tareas. Por ejemplo: *"Analiza los productos críticos y genera una orden de compra"*

¿En qué te puedo ayudar?`,
        timestamp: new Date(),
      }]);
    }
  }, [user?.nombre]);

  // Enviar mensaje
  const handleSend = async (mensajeOverride?: string) => {
    const mensaje = mensajeOverride || input.trim();
    if (!mensaje || loading) return;

    const nuevoMensaje: MensajeAgente = {
      id: `user-${Date.now()}`,
      rol: 'user',
      contenido: mensaje,
      timestamp: new Date(),
    };

    setMensajes(prev => [...prev, nuevoMensaje]);
    setInput('');
    setLoading(true);

    // Mensaje de carga
    const loadingId = `loading-${Date.now()}`;
    setMensajes(prev => [...prev, {
      id: loadingId,
      rol: 'assistant',
      contenido: '',
      timestamp: new Date(),
      cargando: true,
    }]);

    try {
      const historial = mensajes
        .filter(m => m.id !== 'welcome' && !m.cargando)
        .slice(-10)
        .map(m => ({ rol: m.rol, contenido: m.contenido }));

      const response = await fetch('/api/asistente/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje,
          historial,
          contexto: {
            usuario_email: user?.email,
            usuario_nombre: user?.nombre,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al procesar la solicitud');
      }

      // Reemplazar loading con respuesta
      setMensajes(prev => prev.map(m =>
        m.id === loadingId
          ? {
              id: `assistant-${Date.now()}`,
              rol: 'assistant' as const,
              contenido: data.respuesta,
              timestamp: new Date(),
              toolCalls: data.tool_calls?.map((tc: any, i: number) => ({
                id: `tc-${i}`,
                nombre: tc.nombre,
                argumentos: tc.argumentos,
                resultado: tc.resultado,
                exito: !tc.resultado?.error,
              })),
            }
          : m
      ));

    } catch (error: any) {
      setMensajes(prev => prev.map(m =>
        m.id === loadingId
          ? {
              id: `error-${Date.now()}`,
              rol: 'assistant' as const,
              contenido: `❌ ${error.message}\n\nPor favor intenta de nuevo o reformula tu pregunta.`,
              timestamp: new Date(),
              error: true,
            }
          : m
      ));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  // Enter para enviar
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMensajes([]);
  };

  const tieneHistorial = mensajes.filter(m => m.rol === 'user').length > 0;

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col bg-[#0f1117]">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-[#1e2028]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 via-violet-500 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Brain size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white flex items-center gap-2">
                Asistente Vanguard
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-gradient-to-r from-blue-500/20 to-violet-500/20 text-violet-400 rounded-full border border-violet-500/30">
                  LangChain AI
                </span>
              </h1>
              <p className="text-xs text-[#64748b]">
                Agente inteligente con acceso a tus datos • 12 herramientas disponibles
              </p>
            </div>
          </div>

          {tieneHistorial && (
            <button
              onClick={handleClear}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[#1c1f26] text-[#64748b] hover:text-white transition-colors text-sm"
            >
              <Trash2 size={14} />
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {mensajes.map((mensaje) => (
          <MessageBubble key={mensaje.id} mensaje={mensaje} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Sugerencias */}
      {!tieneHistorial && (
        <div className="flex-shrink-0 px-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-[#64748b] flex items-center gap-1">
              <Lightbulb size={12} />
              Sugerencias para empezar
            </p>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              {showAdvanced ? 'Básicas' : 'Avanzadas'}
              <ChevronRight size={12} className={cn(showAdvanced && 'rotate-90')} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(showAdvanced ? EJEMPLOS_AVANZADOS : SUGERENCIAS_INICIALES).slice(0, 4).map((s, i) => (
              <button
                key={i}
                onClick={() => handleSend(s)}
                disabled={loading}
                className="px-3 py-2 text-xs bg-[#1c1f26] hover:bg-[#242830] text-[#94a3b8] hover:text-white rounded-lg border border-[#2e323d] hover:border-[#3e424d] transition-all text-left"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 p-4 border-t border-[#1e2028]">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pregunta lo que quieras sobre tu inventario..."
              disabled={loading}
              rows={1}
              className={cn(
                "w-full px-4 py-3 bg-[#1c1f26] border border-[#2e323d] rounded-xl",
                "text-sm text-white placeholder:text-[#475569]",
                "focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20",
                "resize-none disabled:opacity-50 transition-all",
              )}
              style={{ minHeight: '48px', maxHeight: '150px' }}
            />
          </div>
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className={cn(
              "p-3 rounded-xl transition-all",
              "bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500",
              "text-white shadow-lg shadow-violet-500/20",
              "disabled:from-[#1c1f26] disabled:to-[#1c1f26] disabled:text-[#475569] disabled:shadow-none"
            )}
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>

        <div className="flex items-center justify-between mt-2 px-1">
          <p className="text-[10px] text-[#475569]">
            Shift + Enter para nueva línea
          </p>
          <p className="text-[10px] text-[#475569]">
            Powered by LangChain + Google Gemini
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// COMPONENTE MENSAJE
// ============================================

function MessageBubble({ mensaje }: { mensaje: MensajeAgente }) {
  const isUser = mensaje.rol === 'user';
  const isLoading = mensaje.cargando;
  const isError = mensaje.error;
  const [showTools, setShowTools] = useState(false);

  const hasTools = mensaje.toolCalls && mensaje.toolCalls.length > 0;

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
        isUser
          ? 'bg-blue-500/20 text-blue-400'
          : isError
            ? 'bg-red-500/20 text-red-400'
            : 'bg-gradient-to-br from-blue-500/20 to-violet-500/20 text-violet-400'
      )}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      {/* Contenido */}
      <div className={cn('max-w-[85%] space-y-2', isUser && 'items-end')}>
        {/* Tools usados */}
        {hasTools && (
          <button
            onClick={() => setShowTools(!showTools)}
            className="flex items-center gap-2 text-xs text-[#64748b] hover:text-[#94a3b8] transition-colors"
          >
            <Wrench size={12} />
            {mensaje.toolCalls!.length} herramienta{mensaje.toolCalls!.length > 1 ? 's' : ''} utilizada{mensaje.toolCalls!.length > 1 ? 's' : ''}
            <ChevronDown size={12} className={cn('transition-transform', showTools && 'rotate-180')} />
          </button>
        )}

        {showTools && hasTools && (
          <div className="space-y-1 pl-2 border-l-2 border-[#2e323d]">
            {mensaje.toolCalls!.map((tc, i) => (
              <ToolCallItem key={tc.id || i} toolCall={tc} />
            ))}
          </div>
        )}

        {/* Mensaje principal */}
        <div className={cn(
          'px-4 py-3 rounded-2xl text-sm',
          isUser
            ? 'bg-blue-600 text-white rounded-br-md'
            : isError
              ? 'bg-red-500/10 border border-red-500/20 text-red-200 rounded-bl-md'
              : 'bg-[#1c1f26] text-[#f8fafc] rounded-bl-md'
        )}>
          {isLoading ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-violet-400" />
                <span className="text-[#94a3b8]">Pensando...</span>
              </div>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          ) : (
            <FormattedMessage content={mensaje.contenido} />
          )}
        </div>

        {/* Timestamp */}
        <div className={cn('flex items-center gap-2 text-[10px] text-[#475569]', isUser && 'flex-row-reverse')}>
          <Clock size={10} />
          {formatTime(mensaje.timestamp)}
        </div>
      </div>
    </div>
  );
}

// ============================================
// COMPONENTE TOOL CALL
// ============================================

function ToolCallItem({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const success = toolCall.exito !== false;

  const toolIcons: Record<string, React.ReactNode> = {
    consultar_stock: <Package size={12} />,
    buscar_productos: <Package size={12} />,
    productos_criticos: <AlertTriangle size={12} />,
    analisis_ventas: <TrendingUp size={12} />,
    analisis_compras: <TrendingUp size={12} />,
    metricas_dashboard: <BarChart3 size={12} />,
    analisis_tendencias: <BarChart3 size={12} />,
    recomendaciones_reposicion: <Lightbulb size={12} />,
    prediccion_demanda: <Sparkles size={12} />,
  };

  return (
    <div className="text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'flex items-center gap-2 px-2 py-1 rounded-md w-full text-left transition-colors',
          'hover:bg-[#242830]',
          success ? 'text-emerald-400' : 'text-red-400'
        )}
      >
        {success ? <CheckCircle size={12} /> : <XCircle size={12} />}
        {toolIcons[toolCall.nombre] || <Wrench size={12} />}
        <span className="text-[#94a3b8]">{toolCall.nombre.replace(/_/g, ' ')}</span>
        <ChevronRight size={10} className={cn('ml-auto transition-transform', expanded && 'rotate-90')} />
      </button>

      {expanded && (
        <div className="mt-1 ml-4 p-2 bg-[#0f1117] rounded-md border border-[#2e323d] overflow-x-auto">
          <div className="text-[10px] text-[#64748b] mb-1">Argumentos:</div>
          <pre className="text-[10px] text-[#94a3b8] whitespace-pre-wrap">
            {JSON.stringify(toolCall.argumentos, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ============================================
// FORMATEO DE MENSAJE
// ============================================

function FormattedMessage({ content }: { content: string }) {
  // Procesar markdown básico
  const processLine = (line: string, index: number) => {
    // Headers
    if (line.startsWith('## ')) {
      return <h3 key={index} className="font-semibold text-base mt-3 mb-2 text-white">{line.slice(3)}</h3>;
    }
    if (line.startsWith('### ')) {
      return <h4 key={index} className="font-medium mt-2 mb-1 text-white">{line.slice(4)}</h4>;
    }

    // Bold **text**
    let processed = line.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>');
    
    // Lists
    if (line.startsWith('• ') || line.startsWith('- ') || line.startsWith('* ')) {
      const content = line.slice(2);
      return (
        <div key={index} className="flex gap-2 my-0.5">
          <span className="text-blue-400 mt-0.5">•</span>
          <span dangerouslySetInnerHTML={{ __html: processed.slice(2) }} />
        </div>
      );
    }

    // Numbered lists
    const numberedMatch = line.match(/^(\d+)\.\s(.+)/);
    if (numberedMatch) {
      return (
        <div key={index} className="flex gap-2 my-0.5">
          <span className="text-blue-400 min-w-[20px]">{numberedMatch[1]}.</span>
          <span dangerouslySetInnerHTML={{ __html: processed.replace(/^\d+\.\s/, '') }} />
        </div>
      );
    }

    // Empty lines
    if (line.trim() === '') {
      return <div key={index} className="h-2" />;
    }

    // Normal line
    return <div key={index} dangerouslySetInnerHTML={{ __html: processed }} />;
  };

  const lines = content.split('\n');
  
  return (
    <div className="space-y-0.5 leading-relaxed">
      {lines.map((line, i) => processLine(line, i))}
    </div>
  );
}

// ============================================
// HELPERS
// ============================================

function formatTime(date: Date): string {
  return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}