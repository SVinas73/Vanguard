import { NextRequest, NextResponse } from 'next/server';
import {
  validarApiKey, extraerApiKey, tieneScope, logApiRequest,
  type Scope, type ApiKeyContext,
} from './api-keys';
import { chequearRateLimit, extraerIP } from '@/lib/security/rate-limit';

// =====================================================
// Middleware unificado para endpoints /api/v1/*
// =====================================================
// Usar como wrapper en cada handler:
//
//   export const GET = withApiAuth({ scope: 'productos:read' },
//     async (req, ctx) => {
//       // ctx.apiKey tiene la validación lista
//       return NextResponse.json({...});
//     }
//   );
// =====================================================

interface ApiHandlerCtx {
  apiKey: ApiKeyContext;
  ip: string;
  userAgent: string;
  startedAt: number;
}

type ApiHandler = (req: NextRequest, ctx: ApiHandlerCtx) => Promise<NextResponse>;

interface ApiAuthOptions {
  scope: Scope;
}

export function withApiAuth(options: ApiAuthOptions, handler: ApiHandler) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const startedAt = Date.now();
    const ip = extraerIP(req);
    const userAgent = req.headers.get('user-agent') || 'unknown';

    const finishLog = (status: number, summary?: string, error?: string, apiKey?: ApiKeyContext) => {
      void logApiRequest({
        apiKeyId: apiKey?.id,
        apiKeyPrefix: apiKey?.prefix,
        metodo: req.method,
        ruta: new URL(req.url).pathname,
        status, duracionMs: Date.now() - startedAt,
        ip, userAgent,
        responseSummary: summary, error,
      });
    };

    // 1. Extraer API key
    const secret = extraerApiKey(req);
    if (!secret) {
      finishLog(401, undefined, 'Sin API key');
      return NextResponse.json(
        { error: 'API key requerida', hint: 'Enviá header X-Vanguard-Api-Key o Authorization: Bearer ak_...' },
        { status: 401 }
      );
    }

    // 2. Validar
    const apiKey = await validarApiKey(secret);
    if (!apiKey) {
      finishLog(401, undefined, 'API key inválida');
      return NextResponse.json(
        { error: 'API key inválida o revocada' },
        { status: 401 }
      );
    }

    // 3. Verificar scope
    if (!tieneScope(apiKey, options.scope)) {
      finishLog(403, undefined, `Falta scope ${options.scope}`, apiKey);
      return NextResponse.json(
        { error: 'Permisos insuficientes', scope_requerido: options.scope, scopes_actuales: apiKey.scopes },
        { status: 403 }
      );
    }

    // 4. Rate limit por API key
    const rl = await chequearRateLimit({
      bucket: `api:${apiKey.id}`,
      max: apiKey.rate_limit_por_minuto,
      windowSeconds: 60,
      ip,
      ruta: new URL(req.url).pathname,
    });
    if (rl.bloqueado) {
      finishLog(429, undefined, 'Rate limit', apiKey);
      return NextResponse.json(
        { error: 'Rate limit excedido', limite_por_minuto: apiKey.rate_limit_por_minuto, retry_after: rl.retryAfterSeconds },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds || 60) } }
      );
    }

    // 5. Ejecutar handler
    try {
      const ctx: ApiHandlerCtx = { apiKey, ip, userAgent, startedAt };
      const res = await handler(req, ctx);
      finishLog(res.status, undefined, undefined, apiKey);
      return res;
    } catch (e: any) {
      console.error('API handler error:', e);
      finishLog(500, undefined, e.message, apiKey);
      return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
  };
}
