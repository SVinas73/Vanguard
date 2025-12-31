'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, Button, Input } from '@/components/ui';
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
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_AI_API_URL || 'http://localhost:8000';

// ============================================
// TYPES
// ============================================

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

// ============================================
// CHAT MESSAGE COMPONENT
// ============================================

interface ChatMessageProps {
  message: Message;
  onSuggestionClick?: (suggestion: string) => void;
}

function ChatMessage({ message, onSuggestionClick }: ChatMessageProps) {
  const isUser = message.role === 'user';
  
  return (
    <div className={cn(
      'flex gap-3 mb-4',
      isUser ? 'flex-row-reverse' : 'flex-row'
    )}>
      {/* Avatar */}
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
        isUser 
          ? 'bg-emerald-500/20 text-emerald-400' 
          : 'bg-purple-500/20 text-purple-400'
      )}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>
      
      {/* Message content */}
      <div className={cn(
        'max-w-[80%] rounded-2xl px-4 py-3',
        isUser 
          ? 'bg-emerald-500/20 text-slate-100' 
          : 'bg-slate-800/80 text-slate-200'
      )}>
        <div className="text-sm whitespace-pre-wrap leading-relaxed">
          {message.content}
        </div>
        
        {/* Suggestions */}
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
        
        {/* Timestamp */}
        <div className={cn(
          'text-[10px] mt-2',
          isUser ? 'text-emerald-400/50' : 'text-slate-500'
        )}>
          {message.timestamp.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

// ============================================
// CHATBOT WIDGET
// ============================================

export function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      
      // Add welcome message if no messages
      if (messages.length === 0) {
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: '¡Hola! Soy el asistente de inventario de Vanguard. Puedo ayudarte a consultar stock, ver productos con bajo inventario, analizar ventas y mucho más.\n\n¿En qué puedo ayudarte hoy?',
          timestamp: new Date(),
          suggestions: [
            '¿Qué productos tienen stock bajo?',
            '¿Cuáles son los más vendidos?',
            '¿Cuánto vendí esta semana?'
          ]
        }]);
      }
    }
  }, [isOpen, messages.length]);

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
      const response = await fetch(`${API_URL}/api/chatbot/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim() })
      });

      if (!response.ok) {
        throw new Error('Error al comunicarse con el servidor');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        suggestions: data.suggestions
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setError('No se pudo conectar con el asistente. Intenta de nuevo.');
      console.error('Chat error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion);
  };

  return (
    <>
      {/* Chat button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed bottom-24 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all z-40',
          'bg-gradient-to-r from-purple-500 to-pink-500 hover:scale-110 hover:shadow-purple-500/30',
          isOpen && 'scale-0 opacity-0'
        )}
      >
        <MessageSquare size={24} className="text-white" />
      </button>

      {/* Chat window */}
      <div className={cn(
        'fixed bottom-6 right-6 w-[400px] h-[600px] rounded-2xl shadow-2xl shadow-black/40 z-50 flex flex-col overflow-hidden transition-all duration-300',
        'bg-slate-900 border border-slate-800',
        isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <div className="font-semibold text-sm">Vanguard AI</div>
              <div className="text-xs text-slate-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Asistente de inventario
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
              onSuggestionClick={handleSuggestionClick}
            />
          ))}
          
          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Bot size={16} className="text-purple-400" />
              </div>
              <div className="bg-slate-800/80 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Loader2 size={14} className="animate-spin" />
                  Pensando...
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
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
              className="flex-1 px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm placeholder-slate-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className={cn(
                'px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-center',
                'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
                'hover:shadow-lg hover:shadow-purple-500/30',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none'
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

      {/* Scroll to bottom button (when chat is open and scrolled up) */}
      {isOpen && messages.length > 5 && (
        <button
          onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="fixed bottom-[100px] right-10 w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center z-50 hover:bg-slate-700 transition-colors"
        >
          <ChevronDown size={16} className="text-slate-400" />
        </button>
      )}
    </>
  );
}