import { describe, it, expect } from 'vitest';
import { templateOCInterno, templateOCProveedor } from '../email/templates';

const baseOC = {
  numero: 'OC-2026-0001',
  proveedorNombre: 'Distribuidora Acme S.A.',
  fechaCreacion: '18/05/2026 10:30',
  fechaEsperada: '25/05/2026',
  creadoPor: 'juan@empresa.com',
  total: 12500,
  moneda: 'UYU',
  items: [
    { codigo: 'SKU-001', descripcion: 'Producto A', cantidad: 10, costoUnitario: 500 },
    { codigo: 'SKU-002', descripcion: 'Producto B', cantidad: 5, costoUnitario: 1500 },
  ],
  notas: 'Entregar en horario de mañana',
};

describe('Email templates - OC interno', () => {
  it('genera subject con número de OC y proveedor', () => {
    const tpl = templateOCInterno(baseOC);
    expect(tpl.subject).toContain('OC-2026-0001');
    expect(tpl.subject).toContain('Acme');
  });

  it('incluye todos los items en el HTML', () => {
    const tpl = templateOCInterno(baseOC);
    expect(tpl.html).toContain('SKU-001');
    expect(tpl.html).toContain('SKU-002');
    expect(tpl.html).toContain('Producto A');
  });

  it('incluye notas si están presentes', () => {
    const tpl = templateOCInterno(baseOC);
    expect(tpl.html).toContain('Entregar en horario');
    expect(tpl.text).toContain('Notas:');
  });

  it('escapa HTML en campos peligrosos', () => {
    const peligroso = { ...baseOC, proveedorNombre: '<script>alert(1)</script>' };
    const tpl = templateOCInterno(peligroso);
    expect(tpl.html).not.toContain('<script>');
    expect(tpl.html).toContain('&lt;script&gt;');
  });

  it('omite sección de notas si están vacías', () => {
    const sinNotas = { ...baseOC, notas: null };
    const tpl = templateOCInterno(sinNotas);
    expect(tpl.html).not.toContain('Notas');
  });
});

describe('Email templates - OC proveedor', () => {
  it('genera subject distinto al interno', () => {
    const interno = templateOCInterno(baseOC);
    const proveedor = templateOCProveedor({ ...baseOC, nombreEmpresa: 'Mi Empresa SRL' });
    expect(proveedor.subject).not.toBe(interno.subject);
    expect(proveedor.subject).toContain('Mi Empresa SRL');
  });

  it('incluye nombre de empresa en el body', () => {
    const tpl = templateOCProveedor({ ...baseOC, nombreEmpresa: 'Mi Empresa SRL' });
    expect(tpl.html).toContain('Mi Empresa SRL');
    expect(tpl.text).toContain('Mi Empresa SRL');
  });

  it('pide confirmación de recepción', () => {
    const tpl = templateOCProveedor({ ...baseOC, nombreEmpresa: 'X' });
    expect(tpl.html).toMatch(/confirm/i);
    expect(tpl.text).toMatch(/confirm/i);
  });
});
