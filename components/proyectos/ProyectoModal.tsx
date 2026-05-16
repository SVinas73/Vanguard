'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button, Input, Select } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import type { Proyecto, EstadoProyecto } from '@/types';

interface ProyectoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (proyecto: Omit<Proyecto, 'id' | 'createdAt' | 'updatedAt'>) => void;
  proyecto?: Proyecto;
}

export function ProyectoModal({ isOpen, onClose, onSave, proyecto }: ProyectoModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    nombre: proyecto?.nombre || '',
    descripcion: proyecto?.descripcion || '',
    color: proyecto?.color || '#9ec9b1',
    estado: proyecto?.estado || 'activo' as EstadoProyecto,
    fechaInicio: proyecto?.fechaInicio ? proyecto.fechaInicio.toISOString().split('T')[0] : '',
    fechaFin: proyecto?.fechaFin ? proyecto.fechaFin.toISOString().split('T')[0] : '',
  });

  const coloresPreset = [
    '#9ec9b1', // emerald
    '#3b82f6', // blue
    '#d6b97a', // amber
    '#ef4444', // red
    '#6b5488', // purple
    '#b5547a', // pink
    '#3d8f82', // teal
    '#cc7a33', // orange
  ];

  const handleSave = () => {
    if (!formData.nombre.trim()) {
      alert(t('proyectosExt.nameRequired'));
      return;
    }

    onSave({
      nombre: formData.nombre,
      descripcion: formData.descripcion || undefined,
      color: formData.color,
      estado: formData.estado,
      fechaInicio: formData.fechaInicio ? new Date(formData.fechaInicio) : undefined,
      fechaFin: formData.fechaFin ? new Date(formData.fechaFin) : undefined,
      creadoPor: user?.email || 'Sistema',
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={proyecto ? t('proyectosExt.editProject') : t('proyectos.newProject')}
    >
      <div className="space-y-4">
        <Input
          label={t('proyectosExt.fields.name') + ' *'}
          value={formData.nombre}
          onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
          placeholder="Ej: Implementación Q1 2026"
        />

        <div>
          <label className="block text-sm text-slate-400 mb-2">{t('proyectos.description')}</label>
          <textarea
            value={formData.descripcion}
            onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
            placeholder="Detalles del proyecto..."
            rows={3}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm resize-none"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-2">{t('proyectosExt.fields.color')}</label>
          <div className="flex gap-2">
            {coloresPreset.map(color => (
              <button
                key={color}
                type="button"
                onClick={() => setFormData({ ...formData, color })}
                className={`w-10 h-10 rounded-lg border-2 transition-all ${
                  formData.color === color ? 'border-white scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        <Select
          label={t('proyectos.status')}
          value={formData.estado}
          onChange={(e) => setFormData({ ...formData, estado: e.target.value as EstadoProyecto })}
          options={[
            { value: 'activo', label: t('proyectosExt.status.active') },
            { value: 'completado', label: t('proyectos.completed') },
            { value: 'archivado', label: t('proyectosExt.status.archived') },
          ]}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t('proyectosExt.fields.startDate')}
            type="date"
            value={formData.fechaInicio}
            onChange={(e) => setFormData({ ...formData, fechaInicio: e.target.value })}
          />

          <Input
            label={t('proyectosExt.fields.endDate')}
            type="date"
            value={formData.fechaFin}
            onChange={(e) => setFormData({ ...formData, fechaFin: e.target.value })}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} className="flex-1">
            {proyecto ? t('commonExt.saveChanges') : t('proyectosExt.createProject')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}