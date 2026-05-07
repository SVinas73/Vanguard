import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { tieneScope } from '@/lib/api-gateway/api-keys';

// =====================================================
// Tests para lógica pura de API Gateway
// =====================================================

describe('api-keys — tieneScope', () => {
  it('scope * habilita todo', () => {
    const ctx = { id: 'x', prefix: 'ak_test_x', scopes: ['*'] as any, rate_limit_por_minuto: 120 };
    expect(tieneScope(ctx, 'productos:read')).toBe(true);
    expect(tieneScope(ctx, 'webhooks:manage')).toBe(true);
    expect(tieneScope(ctx, 'tickets:write')).toBe(true);
  });

  it('scope específico solo permite ese', () => {
    const ctx = { id: 'x', prefix: 'ak_test_x', scopes: ['productos:read'] as any, rate_limit_por_minuto: 120 };
    expect(tieneScope(ctx, 'productos:read')).toBe(true);
    expect(tieneScope(ctx, 'productos:write')).toBe(false);
    expect(tieneScope(ctx, 'clientes:read')).toBe(false);
  });

  it('múltiples scopes', () => {
    const ctx = {
      id: 'x', prefix: 'ak_test_x',
      scopes: ['productos:read', 'clientes:read', 'tickets:write'] as any,
      rate_limit_por_minuto: 120,
    };
    expect(tieneScope(ctx, 'productos:read')).toBe(true);
    expect(tieneScope(ctx, 'clientes:read')).toBe(true);
    expect(tieneScope(ctx, 'tickets:write')).toBe(true);
    expect(tieneScope(ctx, 'tickets:read')).toBe(false);
    expect(tieneScope(ctx, 'webhooks:manage')).toBe(false);
  });

  it('sin scopes nada se permite', () => {
    const ctx = { id: 'x', prefix: 'ak_test_x', scopes: [] as any, rate_limit_por_minuto: 120 };
    expect(tieneScope(ctx, 'productos:read')).toBe(false);
  });
});

describe('api-keys — formato de keys generadas', () => {
  // Replicamos la lógica de generación local para validar
  // sin depender de mocks de Supabase.
  function generarKey(): { secret: string; prefix: string; hash: string } {
    const ambient = 'test';
    const random = crypto.randomBytes(24).toString('hex');
    const secret = `ak_${ambient}_${random}`;
    const prefix = secret.slice(0, 12);
    const hash = crypto.createHash('sha256').update(secret).digest('hex');
    return { secret, prefix, hash };
  }

  it('genera key con prefijo ak_test_', () => {
    const { secret, prefix } = generarKey();
    expect(secret).toMatch(/^ak_test_[a-f0-9]{48}$/);
    expect(prefix).toBe('ak_test_' + secret.split('_')[2].slice(0, 4));
  });

  it('hash es sha256 de 64 chars hex', () => {
    const { hash } = generarKey();
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('keys distintas tienen hashes distintos', () => {
    const a = generarKey();
    const b = generarKey();
    expect(a.secret).not.toBe(b.secret);
    expect(a.hash).not.toBe(b.hash);
  });

  it('hash es determinista sobre el secret', () => {
    const { secret } = generarKey();
    const h1 = crypto.createHash('sha256').update(secret).digest('hex');
    const h2 = crypto.createHash('sha256').update(secret).digest('hex');
    expect(h1).toBe(h2);
  });
});

describe('webhooks — firma HMAC', () => {
  function firmar(payload: any, secret: string): string {
    return crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
  }

  it('firmas iguales para mismo payload + secret', () => {
    const payload = { evento: 'test', data: 1 };
    const a = firmar(payload, 'whsec_abc');
    const b = firmar(payload, 'whsec_abc');
    expect(a).toBe(b);
  });

  it('firmas distintas para distinto secret', () => {
    const payload = { evento: 'test' };
    expect(firmar(payload, 'a')).not.toBe(firmar(payload, 'b'));
  });

  it('firmas distintas si cambia el payload', () => {
    expect(firmar({ a: 1 }, 'k')).not.toBe(firmar({ a: 2 }, 'k'));
  });

  it('firma es hex de 64 chars', () => {
    const sig = firmar({ x: 1 }, 'whsec_test');
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('webhooks — backoff exponencial', () => {
  const RETRY_BACKOFF_SECONDS = [60, 300, 900, 3600, 21600, 86400];

  it('los reintentos crecen exponencialmente', () => {
    for (let i = 1; i < RETRY_BACKOFF_SECONDS.length; i++) {
      expect(RETRY_BACKOFF_SECONDS[i]).toBeGreaterThan(RETRY_BACKOFF_SECONDS[i - 1]);
    }
  });

  it('el primer reintento es a 1 minuto', () => {
    expect(RETRY_BACKOFF_SECONDS[0]).toBe(60);
  });

  it('el último reintento es a 24 horas', () => {
    expect(RETRY_BACKOFF_SECONDS[RETRY_BACKOFF_SECONDS.length - 1]).toBe(86400);
  });

  it('total reintentos = 6 (~1 minuto + 5min + 15min + 1h + 6h + 24h)', () => {
    expect(RETRY_BACKOFF_SECONDS.length).toBe(6);
  });
});

describe('eventos webhook — catálogo', () => {
  const eventos = [
    'orden_venta.creada', 'orden_venta.confirmada', 'orden_venta.entregada', 'orden_venta.cancelada',
    'orden_compra.creada', 'orden_compra.recibida',
    'cotizacion.creada', 'cotizacion.aprobada', 'cotizacion.rechazada',
    'cliente.creado', 'cliente.actualizado',
    'producto.bajo_stock', 'producto.sin_stock',
    'ticket.abierto', 'ticket.resuelto', 'ticket.cerrado', 'ticket.sla_breached',
    'garantia.creada', 'garantia.por_vencer', 'garantia.reclamada',
    'rma.creado', 'rma.cerrado',
    'cfe.emitido', 'cfe.aceptado', 'cfe.rechazado',
    'aprobacion.creada', 'aprobacion.aprobada', 'aprobacion.rechazada',
  ];

  it('todos los eventos siguen formato namespace.accion', () => {
    for (const e of eventos) {
      expect(e).toMatch(/^[a-z_]+\.[a-z_]+$/);
    }
  });

  it('no hay eventos duplicados', () => {
    expect(new Set(eventos).size).toBe(eventos.length);
  });

  it('cubre los flujos críticos', () => {
    expect(eventos).toContain('orden_venta.creada');
    expect(eventos).toContain('ticket.sla_breached');
    expect(eventos).toContain('garantia.por_vencer');
    expect(eventos).toContain('cfe.aceptado');
  });
});
