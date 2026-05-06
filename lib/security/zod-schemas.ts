import { z } from 'zod';

// =====================================================
// Esquemas Zod centralizados
// =====================================================
// Schemas reusables para validar payloads en API routes.
// Cada endpoint debe parsear su body con .safeParse() y
// devolver 400 si falla.
// =====================================================

// =====================================================
// PRIMITIVOS
// =====================================================

export const emailSchema = z.string().email('Email inválido').max(255);

export const passwordSchema = z.string()
  .min(8, 'Mínimo 8 caracteres')
  .max(72, 'Máximo 72 caracteres')
  .regex(/[A-Z]/, 'Debe tener al menos una mayúscula')
  .regex(/[0-9]/, 'Debe tener al menos un número');

export const rolSchema = z.enum(['admin', 'vendedor', 'bodeguero', 'operador']);

export const monedaSchema = z.enum(['UYU', 'USD', 'EUR', 'BRL', 'ARS']);

export const uuidSchema = z.string().uuid('UUID inválido');

export const codigoProductoSchema = z.string()
  .min(1, 'Código requerido')
  .max(50, 'Código demasiado largo')
  .regex(/^[A-Za-z0-9\-_.]+$/, 'Caracteres no permitidos');

// =====================================================
// AUTH
// =====================================================

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(2).max(100).optional(),
  role: rolSchema.default('operador'),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password requerido'),
});

// =====================================================
// CHATBOT
// =====================================================

export const chatRequestSchema = z.object({
  mensaje: z.string()
    .min(1, 'Mensaje vacío')
    .max(4000, 'Mensaje demasiado largo (máx 4000 caracteres)'),
  historial: z.array(z.object({
    rol: z.string(),
    contenido: z.string(),
  })).max(50).optional(),
  sesion_id: z.string().nullable().optional(),
  contexto: z.object({
    usuario_email: z.string().optional(),
    usuario_nombre: z.string().optional(),
    rol: z.string().optional(),
  }).optional(),
});

// =====================================================
// MOVIMIENTO DE STOCK
// =====================================================

export const crearMovimientoSchema = z.object({
  producto_codigo: codigoProductoSchema,
  tipo: z.enum(['entrada', 'salida', 'ajuste']),
  cantidad: z.number().positive('Cantidad debe ser positiva'),
  motivo: z.string().max(500).optional(),
});

// =====================================================
// ORDEN DE COMPRA
// =====================================================

export const crearOrdenCompraSchema = z.object({
  proveedor_id: uuidSchema,
  productos: z.array(z.object({
    codigo: codigoProductoSchema,
    cantidad: z.number().positive(),
    precio: z.number().nonnegative(),
  })).min(1, 'Al menos un producto'),
  notas: z.string().max(1000).optional(),
});

// =====================================================
// GDPR
// =====================================================

export const gdprSchema = z.object({
  usuario_email: emailSchema,
  motivo: z.string().max(500).optional(),
});

// =====================================================
// HELPER: parsear y devolver error formateado
// =====================================================

export function parseSafe<T>(schema: z.ZodSchema<T>, body: unknown): {
  ok: true; data: T;
} | {
  ok: false; error: string; issues: Array<{ path: string; message: string }>;
} {
  const result = schema.safeParse(body);
  if (result.success) return { ok: true, data: result.data };

  return {
    ok: false,
    error: 'Validación fallida',
    issues: result.error.issues.map(i => ({
      path: i.path.join('.'),
      message: i.message,
    })),
  };
}
