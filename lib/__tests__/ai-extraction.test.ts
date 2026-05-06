import { describe, it, expect } from 'vitest';
import {
  facturaExtraidaSchema,
  remitoExtraidoSchema,
  emailExtraidoSchema,
  archivoSoportado,
} from '@/lib/ai-extraction';

describe('ai-extraction — schemas', () => {
  describe('facturaExtraidaSchema', () => {
    it('acepta factura completa válida', () => {
      const r = facturaExtraidaSchema.safeParse({
        proveedor: { nombre: 'ACME SA', rut: '210000000017' },
        numero_factura: 'A-001-00012345',
        fecha: '2025-05-01',
        moneda: 'UYU',
        items: [
          { descripcion: 'Producto X', cantidad: 10, precio_unitario: 100, iva_pct: 22 },
        ],
        subtotal: 1000,
        iva: 220,
        total: 1220,
        confianza: 0.9,
      });
      expect(r.success).toBe(true);
    });

    it('acepta factura mínima (sin opcionales)', () => {
      const r = facturaExtraidaSchema.safeParse({
        proveedor: { nombre: 'ACME' },
        items: [{ descripcion: 'X', cantidad: 1, precio_unitario: 50 }],
        total: 50,
        confianza: 0.5,
      });
      expect(r.success).toBe(true);
    });

    it('rechaza confianza fuera de rango', () => {
      const r = facturaExtraidaSchema.safeParse({
        proveedor: { nombre: 'X' },
        items: [{ descripcion: 'a', cantidad: 1, precio_unitario: 1 }],
        total: 1,
        confianza: 1.5,
      });
      expect(r.success).toBe(false);
    });

    it('rechaza sin items', () => {
      const r = facturaExtraidaSchema.safeParse({
        proveedor: { nombre: 'X' },
        items: 'not-an-array',
        total: 1,
        confianza: 0.9,
      });
      expect(r.success).toBe(false);
    });

    it('rechaza moneda inválida', () => {
      const r = facturaExtraidaSchema.safeParse({
        proveedor: { nombre: 'X' },
        items: [{ descripcion: 'a', cantidad: 1, precio_unitario: 1 }],
        total: 1,
        moneda: 'GBP',
        confianza: 0.9,
      });
      expect(r.success).toBe(false);
    });
  });

  describe('remitoExtraidoSchema', () => {
    it('acepta remito mínimo', () => {
      const r = remitoExtraidoSchema.safeParse({
        proveedor: 'Distribuidora X',
        items: [{ descripcion: 'Producto Y', cantidad: 5 }],
        confianza: 0.8,
      });
      expect(r.success).toBe(true);
    });

    it('acepta items con lote y vencimiento', () => {
      const r = remitoExtraidoSchema.safeParse({
        proveedor: 'X',
        items: [
          { descripcion: 'A', cantidad: 1, lote: 'LOT-001', fecha_vencimiento: '2026-01-01' },
        ],
        confianza: 0.9,
      });
      expect(r.success).toBe(true);
    });

    it('rechaza sin proveedor', () => {
      const r = remitoExtraidoSchema.safeParse({
        items: [{ descripcion: 'a', cantidad: 1 }],
        confianza: 0.9,
      });
      expect(r.success).toBe(false);
    });
  });

  describe('emailExtraidoSchema', () => {
    it('acepta email tipo pedido con productos', () => {
      const r = emailExtraidoSchema.safeParse({
        tipo: 'pedido',
        remitente: { nombre: 'Juan', email: 'juan@empresa.com' },
        asunto_resumido: 'Pedido de 10 widgets',
        productos_mencionados: [{ descripcion: 'widget azul', cantidad: 10 }],
        urgencia: 'alta',
        acciones_sugeridas: ['Crear cotización para Juan'],
        confianza: 0.85,
      });
      expect(r.success).toBe(true);
    });

    it('rechaza tipo desconocido', () => {
      const r = emailExtraidoSchema.safeParse({
        tipo: 'spam',
        asunto_resumido: 'X',
        acciones_sugeridas: [],
        confianza: 0.5,
      });
      expect(r.success).toBe(false);
    });

    it('rechaza urgencia inválida', () => {
      const r = emailExtraidoSchema.safeParse({
        tipo: 'consulta',
        asunto_resumido: 'X',
        urgencia: 'extrema',
        acciones_sugeridas: [],
        confianza: 0.5,
      });
      expect(r.success).toBe(false);
    });

    it('acepta sin remitente y sin productos (consulta vacía)', () => {
      const r = emailExtraidoSchema.safeParse({
        tipo: 'consulta',
        asunto_resumido: 'Pregunta general',
        acciones_sugeridas: ['Responder cordialmente'],
        confianza: 0.6,
      });
      expect(r.success).toBe(true);
    });
  });

  describe('archivoSoportado', () => {
    it('acepta PDF', () => {
      expect(archivoSoportado({ type: 'application/pdf', size: 1000 }).ok).toBe(true);
    });
    it('acepta JPG', () => {
      expect(archivoSoportado({ type: 'image/jpeg', size: 1000 }).ok).toBe(true);
    });
    it('acepta PNG', () => {
      expect(archivoSoportado({ type: 'image/png', size: 1000 }).ok).toBe(true);
    });
    it('acepta WEBP', () => {
      expect(archivoSoportado({ type: 'image/webp', size: 1000 }).ok).toBe(true);
    });
    it('rechaza Word', () => {
      expect(archivoSoportado({ type: 'application/msword', size: 1000 }).ok).toBe(false);
    });
    it('rechaza Excel', () => {
      expect(archivoSoportado({
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 1000,
      }).ok).toBe(false);
    });
    it('rechaza archivo > 20MB', () => {
      const r = archivoSoportado({ type: 'application/pdf', size: 25 * 1024 * 1024 });
      expect(r.ok).toBe(false);
      expect(r.error).toContain('20MB');
    });
    it('acepta archivo justo en el límite (20MB exacto NO entra por el >)', () => {
      const r = archivoSoportado({ type: 'application/pdf', size: 20 * 1024 * 1024 });
      expect(r.ok).toBe(true);
    });
  });
});
