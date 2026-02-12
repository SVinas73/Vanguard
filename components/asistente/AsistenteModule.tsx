'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { 
  MensajeAsistente, 
  SUGERENCIAS_RAPIDAS 
} from './types';
import {
  Bot,
  Send,
  Sparkles,
  User,
  Loader2,
  AlertCircle,
  Package,
  TrendingUp,
  ShoppingCart,
  BarChart3,
  RefreshCw,
  Trash2,
  ChevronRight,
  Zap,
  Database,
  Brain,
} from 'lucide-react';

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function AsistenteModule() {
  const { user } = useAuth();
  const [mensajes, setMensajes] = useState<MensajeAsistente[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll a nuevos mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  // Mensaje de bienvenida
  useEffect(() => {
    if (mensajes.length === 0) {
      setMensajes([{
        id: 'welcome',
        rol: 'assistant',
        contenido: `¡Hola${user?.nombre ? ` ${user.nombre.split(' ')[0]}` : ''}! 👋 Soy el Asistente de Vanguard.\n\nPuedo ayudarte a:\n• 📦 Consultar stock y productos\n• 📊 Analizar ventas y tendencias\n• 🔮 Predecir demanda\n• 📋 Crear órdenes y movimientos\n\n¿En qué puedo ayudarte hoy?`,
        timestamp: new Date(),
      }]);
    }
  }, [user?.nombre]);

  // Enviar mensaje
  const handleSend = async (mensajeOverride?: string) => {
    const mensaje = mensajeOverride || input.trim();
    if (!mensaje || loading) return;

    const nuevoMensajeUsuario: MensajeAsistente = {
      id: Date.now().toString(),
      rol: 'user',
      contenido: mensaje,
      timestamp: new Date(),
    };

    setMensajes(prev => [...prev, nuevoMensajeUsuario]);
    setInput('');
    setLoading(true);
    setError(null);

    // Mensaje temporal de carga
    const loadingId = `loading-${Date.now()}`;
    setMensajes(prev => [...prev, {
      id: loadingId,
      rol: 'assistant',
      contenido: '',
      timestamp: new Date(),
      cargando: true,
    }]);

    try {
      const response = await fetch('/api/asistente/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje,
          historial: mensajes.filter(m => m.id !== 'welcome').slice(-10),
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

      // Reemplazar mensaje de carga con respuesta
      setMensajes(prev => prev.map(m => 
        m.id === loadingId 
          ? {
              id: Date.now().toString(),
              rol: 'assistant' as const,
              contenido: data.respuesta,
              timestamp: new Date(),
              herramientasUsadas: data.herramientas_usadas?.map((h: any) => h.herramienta),
            }
          : m
      ));

    } catch (err: any) {
      // Remover mensaje de carga y mostrar error
      setMensajes(prev => prev.filter(m => m.id !== loadingId));
      setError(err.message);
      
      setMensajes(prev => [...prev, {
        id: Date.now().toString(),
        rol: 'assistant',
        contenido: `❌ Lo siento, ocurrió un error: ${err.message}\n\nPor favor intenta de nuevo o reformula tu pregunta.`,
        timestamp: new Date(),
        error: true,
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  // Manejar Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Limpiar conversación
  const handleClear = () => {
    setMensajes([]);
    setError(null);
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col bg-[#0f1117]">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-[#1e2028]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
              <Brain size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white flex items-center gap-2">
                Asistente Vanguard
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/15 text-blue-400 rounded">
                  AI
                </span>
              </h1>
              <p className="text-xs text-[#64748b]">
                Powered by Google Gemini + Vanguard IA
              </p>
            </div>
          </div>
          
          <button
            onClick={handleClear}
            className="p-2 rounded-lg hover:bg-[#1c1f26] text-[#64748b] hover:text-white transition-colors"
            title="Limpiar conversación"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {mensajes.map((mensaje) => (
          <MessageBubble key={mensaje.id} mensaje={mensaje} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Sugerencias rápidas (solo si no hay mensajes del usuario) */}
      {mensajes.filter(m => m.rol === 'user').length === 0 && (
        <div className="flex-shrink-0 px-4 pb-2">
          <p className="text-xs text-[#64748b] mb-2">Sugerencias:</p>
          <div className="flex flex-wrap gap-2">
            {SUGERENCIAS_RAPIDAS.slice(0, 4).map((sugerencia, i) => (
              <button
                key={i}
                onClick={() => handleSend(sugerencia)}
                disabled={loading}
                className="px-3 py-1.5 text-xs bg-[#1c1f26] hover:bg-[#242830] text-[#94a3b8] hover:text-white rounded-lg border border-[#2e323d] transition-colors"
              >
                {sugerencia}
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
              placeholder="Escribe tu pregunta o solicitud..."
              disabled={loading}
              rows={1}
              className={cn(
                "w-full px-4 py-3 bg-[#1c1f26] border border-[#2e323d] rounded-xl",
                "text-sm text-white placeholder:text-[#475569]",
                "focus:outline-none focus:border-blue-500",
                "resize-none disabled:opacity-50",
              )}
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className={cn(
              "p-3 rounded-xl transition-colors",
              "bg-blue-600 hover:bg-blue-500 text-white",
              "disabled:bg-[#1c1f26] disabled:text-[#475569]"
            )}
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
        
        <p className="mt-2 text-[10px] text-[#475569] text-center">
          El asistente puede cometer errores. Verifica la información importante.
        </p>
      </div>
    </div>
  );
}

// ============================================
// COMPONENTE MENSAJE
// ============================================

function MessageBubble({ mensaje }: { mensaje: MensajeAsistente }) {
  const isUser = mensaje.rol === 'user';
  const isError = mensaje.error;
  const isLoading = mensaje.cargando;

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
      <div className={cn('max-w-[80%] space-y-2', isUser && 'items-end')}>
        {/* Herramientas usadas */}
        {mensaje.herramientasUsadas && mensaje.herramientasUsadas.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {mensaje.herramientasUsadas.map((h, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-[#1c1f26] text-[#64748b] rounded-md"
              >
                <Database size={10} />
                {h.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}

        {/* Mensaje */}
        <div className={cn(
          'px-4 py-3 rounded-2xl text-sm',
          isUser 
            ? 'bg-blue-600 text-white rounded-br-md'
            : isError
              ? 'bg-red-500/10 border border-red-500/20 text-red-200 rounded-bl-md'
              : 'bg-[#1c1f26] text-[#f8fafc] rounded-bl-md'
        )}>
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-[#64748b]">Pensando...</span>
            </div>
          ) : (
            <div className="whitespace-pre-wrap">
              <FormattedMessage content={mensaje.contenido} />
            </div>
          )}
        </div>

        {/* Timestamp */}
        <span className={cn(
          'text-[10px] text-[#475569]',
          isUser && 'text-right'
        )}>
          {formatTime(mensaje.timestamp)}
        </span>
      </div>
    </div>
  );
}

// ============================================
// FORMATEO DE MENSAJE
// ============================================

function FormattedMessage({ content }: { content: string }) {
  // Detectar y formatear listas, números, etc.
  const lines = content.split('\n');
  
  return (
    <>
      {lines.map((line, i) => {
        // Detectar headers con **
        if (line.startsWith('**') && line.endsWith('**')) {
          return (
            <div key={i} className="font-semibold mt-2 mb-1">
              {line.replace(/\*\*/g, '')}
            </div>
          );
        }
        
        // Detectar listas con •
        if (line.startsWith('•') || line.startsWith('-')) {
          return (
            <div key={i} className="flex gap-2 ml-2">
              <span className="text-blue-400">•</span>
              <span>{line.replace(/^[•-]\s*/, '')}</span>
            </div>
          );
        }

        // Detectar números con formateo
        const formattedLine = line.replace(
          /\$?([\d,]+\.?\d*)/g,
          (match) => {
            // Si parece un monto (tiene . o muchos dígitos)
            if (match.includes('.') || match.length > 4) {
              return `<span class="font-mono text-emerald-400">${match}</span>`;
            }
            return match;
          }
        );

        // Línea normal
        if (line.trim() === '') {
          return <div key={i} className="h-2" />;
        }
        
        return (
          <div key={i} dangerouslySetInnerHTML={{ __html: formattedLine }} />
        );
      })}
    </>
  );
}

// ============================================
// HELPERS
// ============================================

function formatTime(date: Date): string {
  return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}