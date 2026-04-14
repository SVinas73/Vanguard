'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, 
  Send, 
  X, 
  Bot, 
  User, 
  Loader2,
  Sparkles,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  Wrench,
  CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

// ============================================
// TYPES
// ============================================

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
  toolsUsed?: string[];
}

// ============================================
// CHAT MESSAGE COMPONENT
// ============================================

function ChatMessage({ message, onSuggestionClick }: { message: Message; onSuggestionClick?: (s: string) => void }) {
  const isUser = message.role === 'user';
  
  return (
    <div className={cn('flex gap-3 mb-4', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
        isUser 
          ? 'bg-blue-500/20 text-blue-400'
          : 'bg-slate-800 text-violet-400'
      )}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>
      
      <div className={cn(
        'max-w-[80%] rounded-2xl px-4 py-3',
        isUser ? 'bg-blue-500/20 text-slate-100' : 'bg-slate-800/80 text-slate-200'
      )}>
        {message.toolsUsed && message.toolsUsed.length > 0 && (
          <div className="flex items-center gap-1 mb-2 pb-2 border-b border-slate-700/50">
            <Wrench size={10} className="text-violet-400" />
            <span className="text-[10px] text-violet-400">
              {message.toolsUsed.length} herramienta{message.toolsUsed.length > 1 ? 's' : ''}
            </span>
            <CheckCircle size={10} className="text-emerald-400 ml-1" />
          </div>
        )}
        
        <div className="text-sm whitespace-pre-wrap leading-relaxed">
          <FormattedMessage content={message.content} />
        </div>
        
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-700/50">
            <div className="text-xs text-slate-500 mb-2 flex items-center gap-1">
              <HelpCircle size={12} />
              Sugerencias:
            </div>
            <div className="flex flex-wrap gap-2">
              {message.suggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => onSuggestionClick?.(suggestion)}
                  className="text-xs px-3 py-1.5 rounded-full bg-slate-700/50 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <div className={cn('text-[10px] mt-2', isUser ? 'text-blue-400/50' : 'text-slate-500')}>
          {message.timestamp.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

// ============================================
// FORMATTED MESSAGE
// ============================================

function FormattedMessage({ content }: { content: string }) {
  const lines = content.split('\n');
  
  return (
    <>
      {lines.map((line, i) => {
        let processed = line.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>');
        
        if (line.startsWith('• ') || line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={i} className="flex gap-2 my-0.5">
              <span className="text-blue-400">•</span>
              <span dangerouslySetInnerHTML={{ __html: processed.slice(2) }} />
            </div>
          );
        }
        
        if (line.trim() === '') return <div key={i} className="h-2" />;
        
        return <div key={i} dangerouslySetInnerHTML={{ __html: processed }} />;
      })}
    </>
  );
}

// ============================================
// CHATBOT WIDGET
// ============================================

export function ChatbotWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      
      if (messages.length === 0) {
        const nombre = user?.nombre?.split(' ')[0] || '';
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: `¡Hola${nombre ? ` ${nombre}` : ''}! 👋 Soy el asistente de Vanguard.\n\nPuedo ayudarte a:\n• 📦 Consultar stock y productos\n• 📊 Analizar ventas y métricas\n• 🔮 Ver tendencias y recomendaciones\n• ⚡ Crear órdenes y movimientos\n\n¿En qué puedo ayudarte?`,
          timestamp: new Date(),
          suggestions: [
            '¿Qué productos tienen stock bajo?',
            '¿Cuánto vendimos este mes?',
            'Recomendaciones de reposición'
          ]
        }]);
      }
    }
  }, [isOpen, messages.length, user?.nombre]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const historial = messages
        .filter(m => m.id !== 'welcome')
        .slice(-10)
        .map(m => ({ rol: m.role, contenido: m.content }));

      const response = await fetch('/api/asistente/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mensaje: text.trim(),
          historial,
          contexto: {
            usuario_email: user?.email,
            usuario_nombre: user?.nombre,
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al comunicarse con el asistente');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.respuesta,
        timestamp: new Date(),
        suggestions: data.sugerencias,
        toolsUsed: data.tool_calls?.map((tc: any) => tc.nombre),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      setError(err.message || 'No se pudo conectar con el asistente');
      console.error('Chat error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      {/* Chat button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed bottom-24 left-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all z-40',
          'bg-slate-900 border border-slate-800 hover:scale-110 hover:shadow-xl',
          isOpen && 'scale-0 opacity-0'
        )}
      >
        <MessageSquare size={24} className="text-white" />
      </button>

      {/* Chat window */}
      <div className={cn(
        'fixed bottom-6 left-6 w-[400px] h-[600px] rounded-2xl shadow-2xl shadow-black/40 z-50 flex flex-col overflow-hidden transition-all duration-300',
        'bg-slate-900 border border-slate-800',
        isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <div className="font-semibold text-sm flex items-center gap-2">
                Vanguard AI
                <span className="px-1.5 py-0.5 text-[9px] font-medium bg-violet-500/20 text-violet-300 rounded">
                  Gemini
                </span>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Asistente inteligente
              </div>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.map(message => (
            <ChatMessage 
              key={message.id} 
              message={message} 
              onSuggestionClick={sendMessage}
            />
          ))}
          
          {isLoading && (
            <div className="flex gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
                <Bot size={16} className="text-violet-400" />
              </div>
              <div className="bg-slate-800/80 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Loader2 size={14} className="animate-spin text-violet-400" />
                  Analizando...
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/20 text-red-400 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-slate-800">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pregunta sobre tu inventario..."
              disabled={isLoading}
              className="flex-1 px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20 text-sm placeholder-slate-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className={cn(
                'px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-center',
                'bg-slate-900 border border-slate-800 text-white',
                'hover:shadow-lg',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <Send size={18} />
            </button>
          </div>
          <div className="text-[10px] text-slate-500 text-center mt-2">
            Powered by Google Gemini AI
          </div>
        </form>
      </div>

      {isOpen && messages.length > 5 && (
        <button
          onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="fixed bottom-[100px] left-10 w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center z-50 hover:bg-slate-700 transition-colors"
        >
          <ChevronDown size={16} className="text-slate-400" />
        </button>
      )}
    </>
  );
}