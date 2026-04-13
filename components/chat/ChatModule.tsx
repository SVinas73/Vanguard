'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { useChat } from './useChat';
import {
  ChatConversacion,
  ChatMensaje,
  ConversacionConNoLeidos,
  TIPO_CONVERSACION_CONFIG,
  TipoConversacion,
  EMOJI_CATEGORIES,
  QUICK_REACTIONS,
} from './types';
import {
  MessageCircle,
  Search,
  Plus,
  Send,
  MoreVertical,
  Users,
  Archive,
  Trash2,
  ChevronLeft,
  Package,
  ShoppingCart,
  TrendingUp,
  RotateCcw,
  Kanban,
  Wrench,
  ClipboardCheck,
  Hash,
  AtSign,
  Paperclip,
  Smile,
  Check,
  CheckCheck,
  X,
} from 'lucide-react';

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function ChatModule() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const {
    conversaciones,
    conversacionesArchivadas,
    conversacionActiva,
    mensajes,
    loading,
    loadingMensajes,
    totalNoLeidos,
    editingMessageId,
    replyingTo,
    seleccionarConversacion,
    crearConversacion,
    enviarMensaje,
    editarMensaje,
    eliminarMensaje,
    reaccionarMensaje,
    cerrarConversacion,
    buscarConversaciones,
    archivarConversacion,
    desarchivarConversacion,
    eliminarConversacion,
    fetchArchivadas,
    setEditingMessageId,
    setReplyingTo,
    error,
    clearError,
  } = useChat({
    userEmail: user?.email || '',
    userName: user?.nombre || user?.email?.split('@')[0],
  });

  const [showNuevaConversacion, setShowNuevaConversacion] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [showMobileList, setShowMobileList] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showArchivadas, setShowArchivadas] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ msgId: string; x: number; y: number } | null>(null);
  const [editText, setEditText] = useState('');
  const [creando, setCreando] = useState(false);

  const mensajesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll a nuevos mensajes
  useEffect(() => {
    mensajesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  // Buscar conversaciones
  useEffect(() => {
    const timeout = setTimeout(() => {
      buscarConversaciones(searchQuery);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, buscarConversaciones]);

  // Cerrar context menu al hacer click fuera
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  // Enviar mensaje
  const handleEnviarMensaje = async () => {
    if (!nuevoMensaje.trim() || !conversacionActiva) return;

    await enviarMensaje({
      conversacion_id: conversacionActiva.id,
      contenido: nuevoMensaje.trim(),
    });

    setNuevoMensaje('');
    inputRef.current?.focus();
  };

  // Enter para enviar (Shift+Enter para nueva línea)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEnviarMensaje();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-100px)]">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col bg-[#0f1117]">
      {/* ==================== ERROR BANNER ==================== */}
      {error && (
        <div className="flex items-center justify-between px-4 py-3 bg-red-500/10 border-b border-red-500/30 text-red-400 text-sm">
          <span>{error}</span>
          <button
            onClick={clearError}
            className="ml-4 p-1 rounded hover:bg-red-500/20 flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {/* ==================== LISTA DE CONVERSACIONES ==================== */}
        <div
          className={cn(
            'w-80 border-r border-[#1e2028] flex flex-col',
            'md:flex',
            showMobileList ? 'flex' : 'hidden md:flex'
          )}
        >
          {/* Header */}
          <div className="p-4 border-b border-[#1e2028]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <MessageCircle size={20} />
                {t('chat.title')}
                {totalNoLeidos > 0 && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-blue-500 text-white rounded-full">
                    {totalNoLeidos}
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowArchivadas(!showArchivadas);
                    if (!showArchivadas) fetchArchivadas();
                  }}
                  className="p-2 rounded-lg hover:bg-[#1c1f26] text-[#64748b] transition-colors"
                >
                  <Archive size={18} />
                </button>
                <button
                  onClick={() => setShowNuevaConversacion(true)}
                  className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>

            {/* Búsqueda */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
              <input
                type="text"
                placeholder={t('chat.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#1c1f26] border border-[#2e323d] rounded-lg text-sm text-white placeholder:text-[#475569] focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto">
            {/* Archivadas */}
            {showArchivadas && conversacionesArchivadas && conversacionesArchivadas.length > 0 && (
              <div className="border-b border-[#2e323d]">
                <div className="px-3 py-2 text-xs font-medium text-[#64748b] uppercase tracking-wider">
                  {t('chat.archived') || 'Archivadas'}
                </div>
                {conversacionesArchivadas.map((conv) => (
                  <ConversacionItem
                    key={conv.id}
                    conversacion={conv}
                    isActive={conversacionActiva?.id === conv.id}
                    onClick={() => {
                      seleccionarConversacion(conv);
                      setShowMobileList(false);
                    }}
                    userEmail={user?.email || ''}
                    archived
                    onDesarchivar={() => desarchivarConversacion(conv.id)}
                  />
                ))}
              </div>
            )}

            {conversaciones.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                <MessageCircle size={48} className="text-[#2e323d] mb-3" />
                <p className="text-[#64748b] text-sm">{t('chat.noConversations')}</p>
                <button
                  onClick={() => setShowNuevaConversacion(true)}
                  className="mt-3 text-blue-400 text-sm hover:underline"
                >
                  {t('chat.startConversation')}
                </button>
              </div>
            ) : (
              conversaciones.map((conv) => (
                <ConversacionItem
                  key={conv.id}
                  conversacion={conv}
                  isActive={conversacionActiva?.id === conv.id}
                  onClick={() => {
                    seleccionarConversacion(conv);
                    setShowMobileList(false);
                  }}
                  userEmail={user?.email || ''}
                />
              ))
            )}
          </div>
        </div>

        {/* ==================== ÁREA DE CHAT ==================== */}
        <div className={cn('flex-1 flex flex-col', !showMobileList ? 'flex' : 'hidden md:flex')}>
          {conversacionActiva ? (
            <>
              {/* Header del chat */}
              <div className="h-16 px-4 border-b border-[#1e2028] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      cerrarConversacion();
                      setShowMobileList(true);
                    }}
                    className="md:hidden p-2 rounded-lg hover:bg-[#1c1f26] text-[#94a3b8]"
                  >
                    <ChevronLeft size={20} />
                  </button>

                  <ConversacionIcon tipo={conversacionActiva.tipo} />

                  <div>
                    <h3 className="font-medium text-white">
                      {conversacionActiva.titulo ||
                        getConversacionTitulo(conversacionActiva, user?.email || '')}
                    </h3>
                    <p className="text-xs text-[#64748b]">
                      {conversacionActiva.participantes
                        .filter((p) => p !== user?.email)
                        .map((p) => p.split('@')[0])
                        .join(', ') || 'Solo tú'}
                      {conversacionActiva.referencia_codigo && (
                        <span className="ml-2">• {conversacionActiva.referencia_codigo}</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button className="p-2 rounded-lg hover:bg-[#1c1f26] text-[#64748b]">
                    <Users size={18} />
                  </button>
                  <button
                    onClick={() => archivarConversacion(conversacionActiva.id)}
                    className="p-2 rounded-lg hover:bg-[#1c1f26] text-[#64748b]"
                    title={t('chat.archive') || 'Archivar'}
                  >
                    <Archive size={18} />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('¿Estás seguro de que deseas eliminar esta conversación?')) {
                        eliminarConversacion(conversacionActiva.id);
                      }
                    }}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-[#64748b] hover:text-red-400 transition-colors"
                    title={t('chat.deleteConversation') || 'Eliminar conversación'}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Mensajes */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingMensajes ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full" />
                  </div>
                ) : mensajes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <MessageCircle size={48} className="text-[#2e323d] mb-3" />
                    <p className="text-[#64748b]">{t('chat.noMessages')}</p>
                    <p className="text-[#475569] text-sm">{t('chat.beFirst')}</p>
                  </div>
                ) : (
                  mensajes.map((mensaje, index) => {
                    const isOwn = mensaje.autor_email === user?.email;
                    const showAvatar =
                      index === 0 || mensajes[index - 1].autor_email !== mensaje.autor_email;

                    return (
                      <MensajeItem
                        key={mensaje.id}
                        mensaje={mensaje}
                        isOwn={isOwn}
                        showAvatar={showAvatar}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (isOwn) setContextMenu({ msgId: mensaje.id, x: e.clientX, y: e.clientY });
                        }}
                        onReaccionar={(emoji) => reaccionarMensaje(mensaje.id, emoji)}
                        userEmail={user?.email || ''}
                      />
                    );
                  })
                )}
                <div ref={mensajesEndRef} />
              </div>

              {/* Context menu */}
              {contextMenu && (
                <div
                  className="fixed bg-[#1c1f26] border border-[#2e323d] rounded-lg shadow-xl z-50 py-1 min-w-[160px]"
                  style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                  <button
                    onClick={() => {
                      const msg = mensajes.find((m) => m.id === contextMenu.msgId);
                      if (msg) {
                        setEditingMessageId(msg.id);
                        setEditText(msg.contenido);
                      }
                      setContextMenu(null);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#242830]"
                  >
                    ✏️ {t('chat.edit') || 'Editar'}
                  </button>
                  <button
                    onClick={() => {
                      const msg = mensajes.find((m) => m.id === contextMenu.msgId);
                      if (msg) setReplyingTo(msg);
                      setContextMenu(null);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#242830]"
                  >
                    ↩️ {t('chat.reply') || 'Responder'}
                  </button>
                  <div className="border-t border-[#2e323d] my-1" />
                  <button
                    onClick={() => {
                      eliminarMensaje(contextMenu.msgId);
                      setContextMenu(null);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-[#242830]"
                  >
                    🗑️ {t('chat.delete') || 'Eliminar'}
                  </button>
                </div>
              )}

              {/* Reply indicator */}
              {replyingTo && (
                <div className="px-4 py-2 bg-[#1c1f26] border-t border-[#2e323d] flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-blue-400">↩️</span>
                    <span className="text-[#64748b]">
                      {t('chat.replyingTo') || 'Respondiendo a'}{' '}
                      <span className="text-white">
                        {replyingTo.autor_nombre || replyingTo.autor_email.split('@')[0]}
                      </span>
                    </span>
                    <span className="text-[#475569] truncate max-w-[200px]">
                      {replyingTo.contenido}
                    </span>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="text-[#64748b] hover:text-white">
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Edit indicator */}
              {editingMessageId && (
                <div className="px-4 py-2 bg-[#1c1f26] border-t border-[#2e323d]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-blue-400">✏️ {t('chat.editing') || 'Editando mensaje'}</span>
                    <button
                      onClick={() => {
                        setEditingMessageId(null);
                        setEditText('');
                      }}
                      className="text-[#64748b] hover:text-white"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          editarMensaje(editingMessageId, editText);
                          setEditingMessageId(null);
                          setEditText('');
                        }
                        if (e.key === 'Escape') {
                          setEditingMessageId(null);
                          setEditText('');
                        }
                      }}
                      className="flex-1 px-3 py-2 bg-[#0f1117] border border-[#2e323d] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        editarMensaje(editingMessageId, editText);
                        setEditingMessageId(null);
                        setEditText('');
                      }}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"
                    >
                      {t('chat.save') || 'Guardar'}
                    </button>
                  </div>
                </div>
              )}

              {/* Input de mensaje */}
              <div className="p-4 border-t border-[#1e2028] relative z-50">
                <div className="flex items-end gap-3">
                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      value={nuevoMensaje}
                      onChange={(e) => setNuevoMensaje(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={t('chat.typeMessage')}
                      rows={1}
                      className="w-full px-4 py-3 bg-[#1c1f26] border border-[#2e323d] rounded-xl text-sm text-white placeholder:text-[#475569] focus:outline-none focus:border-blue-500 resize-none"
                      style={{ minHeight: '48px', maxHeight: '120px' }}
                    />
                    <div className="absolute right-2 bottom-2 flex items-center gap-1">
                      <button className="p-1.5 rounded-md hover:bg-[#242830] text-[#64748b]">
                        <AtSign size={16} />
                      </button>
                      <button className="p-1.5 rounded-md hover:bg-[#242830] text-[#64748b]">
                        <Paperclip size={16} />
                      </button>
                      <button
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="p-1.5 rounded-md hover:bg-[#242830] text-[#64748b]"
                      >
                        <Smile size={16} />
                      </button>
                    </div>

                    {/* Emoji Picker */}
                    {showEmojiPicker && (
                      <div className="absolute bottom-12 right-0 bg-[#1c1f26] border border-[#2e323d] rounded-xl p-3 w-72 max-h-60 overflow-y-auto z-50 shadow-xl">
                        {EMOJI_CATEGORIES.map((cat) => (
                          <div key={cat.name} className="mb-2">
                            <div className="text-xs text-[#64748b] mb-1">{cat.name}</div>
                            <div className="flex flex-wrap gap-1">
                              {cat.emojis.map((e) => (
                                <button
                                  key={e}
                                  onClick={() => {
                                    setNuevoMensaje((prev) => prev + e);
                                    setShowEmojiPicker(false);
                                  }}
                                  className="p-1 hover:bg-[#242830] rounded text-lg"
                                >
                                  {e}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleEnviarMensaje}
                    disabled={!nuevoMensaje.trim()}
                    className="p-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-[#1c1f26] disabled:text-[#475569] text-white transition-colors"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            // Estado vacío
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-20 h-20 rounded-2xl bg-[#1c1f26] flex items-center justify-center mb-4">
                <MessageCircle size={40} className="text-[#2e323d]" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                {t('chat.selectConversation')}
              </h3>
              <p className="text-[#64748b] text-sm max-w-sm">
                {t('chat.selectConversationHint')}
              </p>
            </div>
          )}
        </div>

        {/* ==================== MODAL NUEVA CONVERSACIÓN ==================== */}
        {showNuevaConversacion && (
          <NuevaConversacionModal
            onClose={() => setShowNuevaConversacion(false)}
            onCrear={async (data) => {
              setCreando(true);
              try {
                const conv = await crearConversacion(data);
                if (conv) {
                  seleccionarConversacion(conv);
                  setShowNuevaConversacion(false);
                }
              } finally {
                setCreando(false);
              }
            }}
            userEmail={user?.email || ''}
            creando={creando}
          />
        )}
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTES
// ============================================

function ConversacionItem({
  conversacion,
  isActive,
  onClick,
  userEmail,
  archived,
  onDesarchivar,
}: {
  conversacion: ConversacionConNoLeidos;
  isActive: boolean;
  onClick: () => void;
  userEmail: string;
  archived?: boolean;
  onDesarchivar?: () => void;
}) {
  const { t } = useTranslation();
  const config = TIPO_CONVERSACION_CONFIG[conversacion.tipo];

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full p-3 text-left transition-colors',
        isActive
          ? 'bg-blue-500/10 border-l-2 border-blue-500'
          : 'hover:bg-[#1c1f26] border-l-2 border-transparent'
      )}
    >
      <div className="flex items-start gap-3">
        <ConversacionIcon tipo={conversacion.tipo} size="sm" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-white text-sm truncate">
              {conversacion.titulo || getConversacionTitulo(conversacion, userEmail)}
            </span>
            <div className="flex items-center gap-1">
              {archived && onDesarchivar && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDesarchivar();
                  }}
                  className="p-1 rounded hover:bg-[#242830] text-[#64748b]"
                  title={t('chat.unarchive') || 'Desarchivar'}
                >
                  <RotateCcw size={12} />
                </button>
              )}
              {conversacion.ultimo_mensaje_at && (
                <span className="text-xs text-[#64748b]">
                  {formatTime(conversacion.ultimo_mensaje_at)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-[#64748b] truncate pr-2">
              {conversacion.ultimo_mensaje_preview || t('chat.noMessages')}
            </p>
            {conversacion.no_leidos > 0 && (
              <span className="flex-shrink-0 px-1.5 py-0.5 text-xs font-medium bg-blue-500 text-white rounded-full">
                {conversacion.no_leidos}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function MensajeItem({
  mensaje,
  isOwn,
  showAvatar,
  onContextMenu,
  onReaccionar,
  userEmail,
}: {
  mensaje: any;
  isOwn: boolean;
  showAvatar: boolean;
  onContextMenu: (e: React.MouseEvent) => void;
  onReaccionar: (emoji: string) => void;
  userEmail: string;
}) {
  return (
    <div className={cn('flex gap-3', isOwn && 'flex-row-reverse')}>
      {showAvatar ? (
        <div
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0',
            isOwn ? 'bg-blue-500/20 text-blue-400' : 'bg-[#242830] text-[#94a3b8]'
          )}
        >
          {mensaje.autor_nombre?.charAt(0).toUpperCase() ||
            mensaje.autor_email.charAt(0).toUpperCase()}
        </div>
      ) : (
        <div className="w-8" />
      )}

      <div className={cn('max-w-[70%]', isOwn && 'items-end')}>
        {showAvatar && (
          <div className={cn('flex items-center gap-2 mb-1', isOwn && 'flex-row-reverse')}>
            <span className="text-xs font-medium text-[#94a3b8]">
              {mensaje.autor_nombre || mensaje.autor_email.split('@')[0]}
            </span>
            <span className="text-xs text-[#475569]">{formatTime(mensaje.created_at)}</span>
          </div>
        )}

        <div
          onContextMenu={onContextMenu}
          className={cn(
            'px-4 py-2.5 rounded-2xl text-sm relative group',
            isOwn
              ? 'bg-blue-600 text-white rounded-br-md'
              : 'bg-[#1c1f26] text-[#f8fafc] rounded-bl-md'
          )}
        >
          {/* Reply reference */}
          {mensaje.respuesta_a && (
            <div className="text-xs text-[#94a3b8]/60 mb-1 pb-1 border-b border-white/10 truncate">
              ↩️ {mensaje.respuesta_a_preview || '...'}
            </div>
          )}
          {mensaje.contenido}
          {mensaje.editado && (
            <span className="text-[10px] text-[#475569] ml-1">(editado)</span>
          )}

          {/* Quick reactions on hover */}
          <div className="absolute -top-3 right-0 hidden group-hover:flex bg-[#1c1f26] border border-[#2e323d] rounded-full px-1 py-0.5 shadow-lg gap-0.5">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => onReaccionar(emoji)}
                className="p-0.5 hover:bg-[#242830] rounded text-sm"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Reacciones */}
        {mensaje.reacciones && Object.keys(mensaje.reacciones).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(mensaje.reacciones).map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() => onReaccionar(emoji)}
                className={cn(
                  'px-1.5 py-0.5 rounded-full text-xs border',
                  (users as string[]).includes(userEmail)
                    ? 'bg-blue-500/20 border-blue-500/40'
                    : 'bg-[#1c1f26] border-[#2e323d]'
                )}
              >
                {emoji} {(users as string[]).length}
              </button>
            ))}
          </div>
        )}

        {isOwn && (
          <div className="flex justify-end mt-1">
            <CheckCheck size={14} className="text-blue-400" />
          </div>
        )}
      </div>
    </div>
  );
}

function ConversacionIcon({ tipo, size = 'md' }: { tipo: TipoConversacion; size?: 'sm' | 'md' }) {
  const config = TIPO_CONVERSACION_CONFIG[tipo];
  const iconSize = size === 'sm' ? 16 : 20;
  const containerSize = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';

  const icons: Record<string, React.ReactNode> = {
    MessageCircle: <MessageCircle size={iconSize} />,
    Package: <Package size={iconSize} />,
    ShoppingCart: <ShoppingCart size={iconSize} />,
    TrendingUp: <TrendingUp size={iconSize} />,
    RotateCcw: <RotateCcw size={iconSize} />,
    Kanban: <Kanban size={iconSize} />,
    Wrench: <Wrench size={iconSize} />,
    ClipboardCheck: <ClipboardCheck size={iconSize} />,
  };

  return (
    <div
      className={cn(
        'rounded-lg flex items-center justify-center flex-shrink-0',
        containerSize,
        config.bg,
        config.color
      )}
    >
      {icons[config.icon] || <Hash size={iconSize} />}
    </div>
  );
}

// ============================================
// MODAL NUEVA CONVERSACIÓN
// ============================================

function NuevaConversacionModal({
  onClose,
  onCrear,
  userEmail,
  creando,
}: {
  onClose: () => void;
  onCrear: (data: any) => void;
  userEmail: string;
  creando: boolean;
}) {
  const { t } = useTranslation();
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<TipoConversacion>('general');
  const [participantesInput, setParticipantesInput] = useState('');
  const [participantes, setParticipantes] = useState<string[]>([]);
  const [mensajeInicial, setMensajeInicial] = useState('');

  const handleAgregarParticipante = () => {
    const email = participantesInput.trim().toLowerCase();
    if (email && email.includes('@') && !participantes.includes(email)) {
      setParticipantes([...participantes, email]);
      setParticipantesInput('');
    }
  };

  const handleCrear = () => {
    if (participantes.length === 0) {
      alert('Agrega al menos un participante');
      return;
    }

    onCrear({
      titulo: titulo || undefined,
      tipo,
      participantes,
      mensaje_inicial: mensajeInicial || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#161921] rounded-xl border border-[#2e323d] w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e323d]">
          <h3 className="text-base font-semibold text-white">Nueva conversación</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-[#242830] text-[#64748b]">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-white mb-1.5">
              Título (opcional)
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Discusión sobre stock"
              className="w-full px-3 py-2 bg-[#1c1f26] border border-[#2e323d] rounded-lg text-sm text-white placeholder:text-[#475569] focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-white mb-1.5">
              Tipo de conversación
            </label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoConversacion)}
              className="w-full px-3 py-2 bg-[#1c1f26] border border-[#2e323d] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {Object.entries(TIPO_CONVERSACION_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          {/* Participantes */}
          <div>
            <label className="block text-sm font-medium text-white mb-1.5">Participantes</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={participantesInput}
                onChange={(e) => setParticipantesInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === 'Enter' && (e.preventDefault(), handleAgregarParticipante())
                }
                placeholder="email@ejemplo.com"
                className="flex-1 px-3 py-2 bg-[#1c1f26] border border-[#2e323d] rounded-lg text-sm text-white placeholder:text-[#475569] focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleAgregarParticipante}
                className="px-3 py-2 bg-[#242830] hover:bg-[#2e323d] text-white rounded-lg text-sm"
              >
                Agregar
              </button>
            </div>

            {participantes.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {participantes.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/15 text-blue-400 rounded-md text-xs"
                  >
                    {email}
                    <button
                      onClick={() => setParticipantes(participantes.filter((p) => p !== email))}
                      className="hover:text-blue-300"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Mensaje inicial */}
          <div>
            <label className="block text-sm font-medium text-white mb-1.5">
              Mensaje inicial (opcional)
            </label>
            <textarea
              value={mensajeInicial}
              onChange={(e) => setMensajeInicial(e.target.value)}
              placeholder="Escribe el primer mensaje..."
              rows={3}
              className="w-full px-3 py-2 bg-[#1c1f26] border border-[#2e323d] rounded-lg text-sm text-white placeholder:text-[#475569] focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-[#2e323d]">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-[#1c1f26] hover:bg-[#242830] text-white rounded-lg text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleCrear}
            disabled={creando}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
          >
            {creando ? t('chat.creating') || 'Creando...' : t('chat.createConversation') || 'Crear conversación'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// HELPERS
// ============================================

function getConversacionTitulo(conv: ChatConversacion, userEmail: string): string {
  const otrosParticipantes = conv.participantes.filter((p) => p !== userEmail);
  if (otrosParticipantes.length === 0) return 'Solo tú';
  if (otrosParticipantes.length === 1) return otrosParticipantes[0].split('@')[0];
  return `${otrosParticipantes[0].split('@')[0]} y ${otrosParticipantes.length - 1} más`;
}

function formatTime(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return 'Ayer';
  } else if (days < 7) {
    return date.toLocaleDateString('es', { weekday: 'short' });
  } else {
    return date.toLocaleDateString('es', { day: '2-digit', month: '2-digit' });
  }
}
