import { describe, it, expect } from 'vitest';
import { templateSolicitudInsumo } from '../email/templates';

const base = {
  numero: 'SI-2026-0001',
  categoria: 'papeleria',
  categoriaLabel: 'Papelería',
  solicitadoPor: 'juan@empresa.com',
  fechaSolicitud: '18/05/2026 10:30',
  fechaLimite: '25/05/2026',
  observaciones: 'Para uso de oficina',
  items: [
    { descripcion: 'Resma A4', cantidad: 5, unidad: 'paquete', observaciones: 'blanca' },
    { descripcion: 'Birome azul', cantidad: 20, unidad: 'unidad' },
  ],
};

describe('Email template - Solicitud de insumo', () => {
  it('subject incluye número + categoria + solicitante', () => {
    const tpl = templateSolicitudInsumo(base);
    expect(tpl.subject).toContain('SI-2026-0001');
    expect(tpl.subject).toContain('Papelería');
    expect(tpl.subject).toContain('juan@empresa.com');
  });

  it('html incluye todos los items con cantidades y unidades', () => {
    const tpl = templateSolicitudInsumo(base);
    expect(tpl.html).toContain('Resma A4');
    expect(tpl.html).toContain('Birome azul');
    expect(tpl.html).toContain('paquete');
    expect(tpl.html).toContain('unidad');
  });

  it('marca la fecha límite con color de urgencia', () => {
    const tpl = templateSolicitudInsumo(base);
    expect(tpl.html).toContain('Fecha límite');
    expect(tpl.html).toContain('25/05/2026');
  });

  it('omite fecha límite si no se provee', () => {
    const sin = { ...base, fechaLimite: null };
    const tpl = templateSolicitudInsumo(sin);
    expect(tpl.html).not.toContain('Fecha límite');
  });

  it('escapa HTML peligroso en descripciones', () => {
    const peligroso = {
      ...base,
      items: [{ descripcion: '<script>alert(1)</script>', cantidad: 1, unidad: 'unidad' }],
    };
    const tpl = templateSolicitudInsumo(peligroso);
    expect(tpl.html).not.toContain('<script>alert');
    expect(tpl.html).toContain('&lt;script&gt;');
  });

  it('texto plano incluye items en formato lista', () => {
    const tpl = templateSolicitudInsumo(base);
    expect(tpl.text).toContain('- Resma A4 — 5 paquete');
    expect(tpl.text).toContain('- Birome azul — 20 unidad');
  });

  it('usa el código de categoria si no hay label', () => {
    const sinLabel = { ...base, categoriaLabel: undefined };
    const tpl = templateSolicitudInsumo(sinLabel);
    expect(tpl.subject).toContain('papeleria');
  });
});
