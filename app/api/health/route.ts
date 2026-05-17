import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// =====================================================
// Health check — endpoint para load balancers
// =====================================================
// GET /api/health
//   200 → {status:'ok', checks: {...}}
//   503 → {status:'degraded', failing: [...]}
//
// Usado por Kubernetes/Docker readinessProbe y Vercel
// monitoring. NO requiere auth (es el contrato estándar).
// =====================================================

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CheckResult {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

async function checkSupabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    // Query trivial — chequea conectividad sin tocar datos sensibles
    const { error } = await supabase
      .from('productos')
      .select('codigo', { count: 'exact', head: true })
      .limit(1);
    if (error) return { ok: false, error: error.message, latencyMs: Date.now() - start };
    return { ok: true, latencyMs: Date.now() - start };
  } catch (e: any) {
    return { ok: false, error: e.message ?? 'unknown', latencyMs: Date.now() - start };
  }
}

export async function GET() {
  const startedAt = Date.now();

  const checks = {
    supabase: await checkSupabase(),
  };

  const allOk = Object.values(checks).every(c => c.ok);
  const failing = Object.entries(checks)
    .filter(([, c]) => !c.ok)
    .map(([name]) => name);

  const body = {
    status: allOk ? 'ok' : 'degraded',
    version: process.env.npm_package_version ?? 'unknown',
    environment: process.env.NODE_ENV ?? 'unknown',
    timestamp: new Date().toISOString(),
    uptimeMs: Date.now() - startedAt,
    checks,
    ...(failing.length > 0 ? { failing } : {}),
  };

  return NextResponse.json(body, { status: allOk ? 200 : 503 });
}
