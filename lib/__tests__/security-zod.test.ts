import { describe, it, expect } from 'vitest';
import {
  emailSchema, passwordSchema, registerSchema,
  chatRequestSchema, crearMovimientoSchema,
  parseSafe,
} from '@/lib/security/zod-schemas';

describe('zod-schemas', () => {
  describe('emailSchema', () => {
    it('acepta email válido', () => {
      expect(emailSchema.safeParse('test@example.com').success).toBe(true);
    });
    it('rechaza email sin @', () => {
      expect(emailSchema.safeParse('no-arroba').success).toBe(false);
    });
    it('rechaza emails > 255 chars', () => {
      const largo = 'a'.repeat(250) + '@x.com';
      expect(emailSchema.safeParse(largo).success).toBe(false);
    });
  });

  describe('passwordSchema', () => {
    it('acepta password fuerte', () => {
      expect(passwordSchema.safeParse('Abcd1234').success).toBe(true);
    });
    it('rechaza < 8 chars', () => {
      expect(passwordSchema.safeParse('Ab12').success).toBe(false);
    });
    it('rechaza sin mayúscula', () => {
      expect(passwordSchema.safeParse('abcd1234').success).toBe(false);
    });
    it('rechaza sin número', () => {
      expect(passwordSchema.safeParse('Abcdefgh').success).toBe(false);
    });
  });

  describe('registerSchema', () => {
    it('asigna rol "operador" por default', () => {
      const r = registerSchema.safeParse({
        email: 'a@b.com',
        password: 'Abcd1234',
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.role).toBe('operador');
    });
    it('rechaza rol inválido', () => {
      const r = registerSchema.safeParse({
        email: 'a@b.com',
        password: 'Abcd1234',
        role: 'superusuario',
      });
      expect(r.success).toBe(false);
    });
  });

  describe('chatRequestSchema', () => {
    it('rechaza mensaje vacío', () => {
      expect(chatRequestSchema.safeParse({ mensaje: '' }).success).toBe(false);
    });
    it('rechaza mensaje > 4000 chars', () => {
      const largo = 'a'.repeat(4001);
      expect(chatRequestSchema.safeParse({ mensaje: largo }).success).toBe(false);
    });
    it('acepta sin historial ni contexto', () => {
      expect(chatRequestSchema.safeParse({ mensaje: 'Hola' }).success).toBe(true);
    });
    it('acepta con historial limitado', () => {
      expect(chatRequestSchema.safeParse({
        mensaje: 'Hola',
        historial: [{ rol: 'user', contenido: 'X' }],
      }).success).toBe(true);
    });
  });

  describe('crearMovimientoSchema', () => {
    it('rechaza cantidad negativa', () => {
      expect(crearMovimientoSchema.safeParse({
        producto_codigo: 'P-001', tipo: 'entrada', cantidad: -5,
      }).success).toBe(false);
    });
    it('rechaza tipo inválido', () => {
      expect(crearMovimientoSchema.safeParse({
        producto_codigo: 'P-001', tipo: 'banana', cantidad: 5,
      }).success).toBe(false);
    });
    it('acepta input válido', () => {
      expect(crearMovimientoSchema.safeParse({
        producto_codigo: 'P-001', tipo: 'entrada', cantidad: 10,
      }).success).toBe(true);
    });
  });

  describe('parseSafe helper', () => {
    it('devuelve ok=true con data tipada en éxito', () => {
      const r = parseSafe(emailSchema, 'a@b.com');
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.data).toBe('a@b.com');
    });

    it('devuelve ok=false con issues estructurados en fallo', () => {
      const r = parseSafe(emailSchema, 'no-email');
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.issues).toBeInstanceOf(Array);
        expect(r.issues.length).toBeGreaterThan(0);
      }
    });
  });
});
