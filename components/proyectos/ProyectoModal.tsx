'use client';

import React, { useState } from 'react';
import { Modal, Button, Input, Select } from '@/components/ui';
import type { Proyecto, EstadoProyecto } from '@/types';

interface ProyectoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (proyecto: Omit<Proyecto, 'id' | 'createdAt' | 'updatedAt'>) => void;
  proyecto?: Proyecto;
}

export function ProyectoModal({ isOpen, onClose, onSave, proyecto }: ProyectoModalProps) {
  const [formData, setFormData] = useState({
    nombre: proyecto?.nombre || '',
    descripcion: proyecto?.descripcion || '',
    color: proyecto?.color || '#10b981',
    estado: proyecto?.estado || 'activo' as EstadoProyecto,
    fechaInicio: proyecto?.fechaInicio ? proyecto.fechaInicio.toISOString().split('T')[0] : '',
    fechaFin: proyecto?.fechaFin ? proyecto.fechaFin.toISOString().split('T')[0] : '',
  });

  const coloresPreset = [
    '#10b981', // emerald
    '#3b82f6', // blue
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#14b8a6', // teal
    '#f97316', // orange
  ];

  const handleSave = () => {
    if (!formData.nombre.trim()) {
      alert('El nombre es obligatorio');
      return;
    }

    onSave({
      nombre: formData.nombre,
      descripcion: formData.descripcion || undefined,
      color: formData.color,
      estado: formData.estado,
      fechaInicio: formData.fechaInicio ? new Date(formData.fechaInicio) : undefined,
      fechaFin: formData.fechaFin ? new Date(formData.fechaFin) : undefined,
      creadoPor: 'usuario@ejemplo.com', // Reemplazar con usuario actual
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={proyecto ? 'Editar Proyecto' : 'Nuevo Proyecto'}
    >
      <div className="space-y-4">
        <Input
          label="Nombre del Proyecto *"
          value={formData.nombre}
          onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
          placeholder="Ej: Implementación Q1 2026"
        />

        <div>
          <label className="block text-sm text-slate-400 mb-2">Descripción</label>
          <textarea
            value={formData.descripcion}
            onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
            placeholder="Detalles del proyecto..."
            rows={3}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm resize-none"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-2">Color</label>
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
          label="Estado"
          value={formData.estado}
          onChange={(e) => setFormData({ ...formData, estado: e.target.value as EstadoProyecto })}
          options={[
            { value: 'activo', label: 'Activo' },
            { value: 'completado', label: 'Completado' },
            { value: 'archivado', label: 'Archivado' },
          ]}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Fecha Inicio"
            type="date"
            value={formData.fechaInicio}
            onChange={(e) => setFormData({ ...formData, fechaInicio: e.target.value })}
          />

          <Input
            label="Fecha Fin"
            type="date"
            value={formData.fechaFin}
            onChange={(e) => setFormData({ ...formData, fechaFin: e.target.value })}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSave} className="flex-1">
            {proyecto ? 'Guardar Cambios' : 'Crear Proyecto'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}