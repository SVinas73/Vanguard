'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Modal, Button, Input, Select } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  Users,
  UserPlus,
  Mail,
  Crown,
  Shield,
  User,
  Eye,
  MoreHorizontal,
  Trash2,
  ChevronDown,
  Check,
  X,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

interface ProyectoMiembro {
  id: string;
  proyectoId: string;
  userEmail: string;
  rol: 'propietario' | 'admin' | 'miembro' | 'viewer';
  invitadoPor: string | null;
  creadoAt: Date;
}

interface ProyectoMiembrosModalProps {
  isOpen: boolean;
  onClose: () => void;
  proyectoId: string;
  proyectoNombre: string;
}

const ROLES = [
  { 
    value: 'propietario', 
    label: 'Propietario', 
    icon: Crown, 
    color: 'text-amber-400',
    description: 'Control total del proyecto'
  },
  { 
    value: 'admin', 
    label: 'Administrador', 
    icon: Shield, 
    color: 'text-blue-400',
    description: 'Puede gestionar miembros y configuración'
  },
  { 
    value: 'miembro', 
    label: 'Miembro', 
    icon: User, 
    color: 'text-emerald-400',
    description: 'Puede crear y editar tareas'
  },
  { 
    value: 'viewer', 
    label: 'Viewer', 
    icon: Eye, 
    color: 'text-slate-400',
    description: 'Solo puede ver el proyecto'
  },
];

export function ProyectoMiembrosModal({
  isOpen,
  onClose,
  proyectoId,
  proyectoNombre,
}: ProyectoMiembrosModalProps) {
  const { user } = useAuth();
  const [miembros, setMiembros] = useState<ProyectoMiembro[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRol, setInviteRol] = useState<string>('miembro');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingRol, setEditingRol] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const currentUserMember = miembros.find(m => m.userEmail === user?.email);
  const isOwner = currentUserMember?.rol === 'propietario';
  const isAdmin = currentUserMember?.rol === 'admin' || isOwner;

  useEffect(() => {
    if (isOpen) {
      fetchMiembros();
    }
  }, [isOpen, proyectoId]);

  const fetchMiembros = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('proyecto_miembros')
      .select('*')
      .eq('proyecto_id', proyectoId)
      .order('creado_at', { ascending: true });

    if (data) {
      setMiembros(data.map(m => ({
        id: m.id,
        proyectoId: m.proyecto_id,
        userEmail: m.user_email,
        rol: m.rol,
        invitadoPor: m.invitado_por,
        creadoAt: new Date(m.creado_at),
      })));
    }
    setLoading(false);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      setError('Ingresá un email');
      return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      setError('Email inválido');
      return;
    }

    // Verificar si ya es miembro
    if (miembros.some(m => m.userEmail.toLowerCase() === inviteEmail.toLowerCase())) {
      setError('Este usuario ya es miembro del proyecto');
      return;
    }

    setInviting(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from('proyecto_miembros')
      .insert({
        proyecto_id: proyectoId,
        user_email: inviteEmail.toLowerCase().trim(),
        rol: inviteRol,
        invitado_por: user?.email,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error invitando miembro:', insertError);
      setError('Error al invitar miembro');
      setInviting(false);
      return;
    }

    // Registrar actividad
    await supabase.from('proyecto_actividades').insert({
      proyecto_id: proyectoId,
      usuario_email: user?.email,
      tipo: 'miembro_agregado',
      descripcion: `Invitó a ${inviteEmail} como ${inviteRol}`,
    });

    setMiembros([...miembros, {
      id: data.id,
      proyectoId: data.proyecto_id,
      userEmail: data.user_email,
      rol: data.rol,
      invitadoPor: data.invitado_por,
      creadoAt: new Date(data.creado_at),
    }]);

    setInviteEmail('');
    setInviteRol('miembro');
    setInviting(false);
  };

  const handleChangeRol = async (miembroId: string, nuevoRol: string) => {
    const miembro = miembros.find(m => m.id === miembroId);
    if (!miembro) return;

    // No permitir cambiar el rol del propietario
    if (miembro.rol === 'propietario' && nuevoRol !== 'propietario') {
      setError('No podés cambiar el rol del propietario. Primero transferí la propiedad.');
      return;
    }

    // Solo el propietario puede asignar el rol de propietario
    if (nuevoRol === 'propietario' && !isOwner) {
      setError('Solo el propietario puede transferir la propiedad');
      return;
    }

    const { error: updateError } = await supabase
      .from('proyecto_miembros')
      .update({ rol: nuevoRol })
      .eq('id', miembroId);

    if (updateError) {
      console.error('Error cambiando rol:', updateError);
      setError('Error al cambiar el rol');
      return;
    }

    // Si se transfiere la propiedad, cambiar el propietario actual a admin
    if (nuevoRol === 'propietario' && currentUserMember) {
      await supabase
        .from('proyecto_miembros')
        .update({ rol: 'admin' })
        .eq('id', currentUserMember.id);
    }

    // Registrar actividad
    await supabase.from('proyecto_actividades').insert({
      proyecto_id: proyectoId,
      usuario_email: user?.email,
      tipo: 'rol_cambiado',
      descripcion: `Cambió el rol de ${miembro.userEmail} a ${nuevoRol}`,
    });

    // Crear notificación para el invitado
    await supabase.from('proyecto_notificaciones').insert({
      usuario_email: inviteEmail.toLowerCase().trim(),
      tipo: 'invitacion',
      titulo: `Te invitaron al proyecto "${proyectoNombre}"`,
      mensaje: `${user?.email} te invitó como ${inviteRol}`,
      proyecto_id: proyectoId,
    });

    await fetchMiembros();
    setEditingRol(null);
  };

  const handleRemoveMember = async (miembroId: string) => {
    const miembro = miembros.find(m => m.id === miembroId);
    if (!miembro) return;

    // No permitir eliminar al propietario
    if (miembro.rol === 'propietario') {
      setError('No podés eliminar al propietario del proyecto');
      return;
    }

    const { error: deleteError } = await supabase
      .from('proyecto_miembros')
      .delete()
      .eq('id', miembroId);

    if (deleteError) {
      console.error('Error eliminando miembro:', deleteError);
      setError('Error al eliminar miembro');
      return;
    }

    // Registrar actividad
    await supabase.from('proyecto_actividades').insert({
      proyecto_id: proyectoId,
      usuario_email: user?.email,
      tipo: 'miembro_eliminado',
      descripcion: `Eliminó a ${miembro.userEmail} del proyecto`,
    });

    setMiembros(miembros.filter(m => m.id !== miembroId));
    setConfirmDelete(null);
  };

  const handleLeaveProject = async () => {
    if (!currentUserMember) return;

    if (currentUserMember.rol === 'propietario') {
      setError('No podés abandonar el proyecto siendo propietario. Primero transferí la propiedad.');
      return;
    }

    const { error: deleteError } = await supabase
      .from('proyecto_miembros')
      .delete()
      .eq('id', currentUserMember.id);

    if (deleteError) {
      console.error('Error abandonando proyecto:', deleteError);
      setError('Error al abandonar el proyecto');
      return;
    }

    onClose();
    // Aquí podrías redirigir al usuario o recargar los proyectos
  };

  const getRolConfig = (rol: string) => {
    return ROLES.find(r => r.value === rol) || ROLES[2];
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/20">
            <Users size={20} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Equipo del Proyecto</h3>
            <p className="text-sm text-slate-400 font-normal">{proyectoNombre}</p>
          </div>
        </div>
      }
      size="md"
    >
      <div className="space-y-6">
        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            <AlertTriangle size={16} />
            {error}
            <button onClick={() => setError(null)} className="ml-auto">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Invitar nuevo miembro */}
        {isAdmin && (
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <UserPlus size={16} className="text-emerald-400" />
              Invitar nuevo miembro
            </h4>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="email@ejemplo.com"
                  type="email"
                  onKeyPress={(e) => e.key === 'Enter' && handleInvite()}
                />
              </div>
              <Select
                value={inviteRol}
                onChange={(e) => setInviteRol(e.target.value)}
                options={ROLES.filter(r => r.value !== 'propietario').map(r => ({
                  value: r.value,
                  label: r.label,
                }))}
                className="w-36"
              />
              <Button onClick={handleInvite} disabled={inviting}>
                {inviting ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
              </Button>
            </div>
          </div>
        )}

        {/* Lista de miembros */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-400 px-1">
            Miembros ({miembros.length})
          </h4>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-emerald-400" />
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {miembros.map(miembro => {
                const rolConfig = getRolConfig(miembro.rol);
                const RolIcon = rolConfig.icon;
                const isCurrentUser = miembro.userEmail === user?.email;
                const canEdit = isAdmin && !isCurrentUser && miembro.rol !== 'propietario';
                const canDelete = (isAdmin && miembro.rol !== 'propietario' && !isCurrentUser) ||
                                  (isCurrentUser && miembro.rol !== 'propietario');

                return (
                  <div
                    key={miembro.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                      isCurrentUser
                        ? 'bg-emerald-500/5 border-emerald-500/30'
                        : 'bg-slate-800/30 border-slate-700/30 hover:bg-slate-800/50'
                    )}
                  >
                    {/* Avatar */}
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold',
                      miembro.rol === 'propietario' 
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-emerald-500/20 text-emerald-400'
                    )}>
                      {miembro.userEmail.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {miembro.userEmail}
                        </p>
                        {isCurrentUser && (
                          <span className="px-1.5 py-0.5 text-xs rounded bg-emerald-500/20 text-emerald-400">
                            Tú
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <RolIcon size={12} className={rolConfig.color} />
                        <span className={cn('text-xs', rolConfig.color)}>
                          {rolConfig.label}
                        </span>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-1">
                      {/* Cambiar rol */}
                      {canEdit && (
                        <div className="relative">
                          <button
                            onClick={() => setEditingRol(editingRol === miembro.id ? null : miembro.id)}
                            className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
                          >
                            <ChevronDown size={16} />
                          </button>

                          {editingRol === miembro.id && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1 z-50">
                              {ROLES.filter(r => {
                                // Solo el propietario puede asignar propietario
                                if (r.value === 'propietario') return isOwner;
                                return true;
                              }).map(rol => {
                                const Icon = rol.icon;
                                return (
                                  <button
                                    key={rol.value}
                                    onClick={() => handleChangeRol(miembro.id, rol.value)}
                                    className={cn(
                                      'w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-700/50 transition-colors',
                                      miembro.rol === rol.value && 'bg-slate-700/30'
                                    )}
                                  >
                                    <Icon size={14} className={rol.color} />
                                    <div className="flex-1">
                                      <p className="font-medium">{rol.label}</p>
                                      <p className="text-xs text-slate-500">{rol.description}</p>
                                    </div>
                                    {miembro.rol === rol.value && (
                                      <Check size={14} className="text-emerald-400" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Eliminar / Abandonar */}
                      {canDelete && (
                        <div className="relative">
                          {confirmDelete === miembro.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => isCurrentUser ? handleLeaveProject() : handleRemoveMember(miembro.id)}
                                className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                title="Confirmar"
                              >
                                <Check size={16} />
                              </button>
                              <button
                                onClick={() => setConfirmDelete(null)}
                                className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 transition-colors"
                                title="Cancelar"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDelete(miembro.id)}
                              className="p-2 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                              title={isCurrentUser ? 'Abandonar proyecto' : 'Eliminar miembro'}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Info de roles */}
        <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
          <h4 className="text-sm font-medium mb-3">Permisos por rol</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {ROLES.map(rol => {
              const Icon = rol.icon;
              return (
                <div key={rol.value} className="flex items-center gap-2">
                  <Icon size={12} className={rol.color} />
                  <span className={rol.color}>{rol.label}:</span>
                  <span className="text-slate-500">{rol.description}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Botón cerrar */}
        <div className="flex justify-end pt-4 border-t border-slate-700/50">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}