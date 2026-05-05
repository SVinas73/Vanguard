// =====================================================
// GDPR — Export de datos personales
// =====================================================
// El usuario puede pedir todos los datos que el sistema
// tiene sobre él. Los admins pueden hacerlo para cualquier
// usuario. Devuelve un JSON con todos los registros
// vinculados a ese email.
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/security/permissions';
import { parseSafe, gdprSchema } from '@/lib/security/zod-schemas';
import { chequearRateLimit, extraerIP } from '@/lib/security/rate-limit';
import { registrarAuditoriaSegura, extraerContextoAudit } from '@/lib/security/audit-enhanced';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  // 1. Auth
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // 2. Validación
  const body = await request.json().catch(() => ({}));
  const parsed = parseSafe(gdprSchema, body);
  if (!parsed.ok) return NextResponse.json(parsed, { status: 400 });

  // 3. Solo el propio usuario o un admin pueden exportar
  if (auth.user.email !== parsed.data.usuario_email && auth.user.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo podés exportar tus propios datos' }, { status: 403 });
  }

  // 4. Rate limit (max 3 exports por hora por usuario)
  const ip = extraerIP(request);
  const rl = await chequearRateLimit({
    bucket: `gdpr:export:${auth.user.email}`,
    max: 3, windowSeconds: 3600,
    ip, usuarioEmail: auth.user.email, ruta: '/api/gdpr/export',
  });
  if (rl.bloqueado) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes', retry_after: rl.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds || 60) } }
    );
  }

  const target = parsed.data.usuario_email;

  // 5. Recolectar datos del usuario en todas las tablas
  // relevantes. Catch-and-continue: si alguna no existe
  // en este deploy, seguimos con las demás.
  const out: Record<string, any> = {};
  const tablas = [
    { name: 'users',                    where: { col: 'email', val: target } },
    { name: 'auditoria',                where: { col: 'usuario_email', val: target } },
    { name: 'chat_sesiones',            where: { col: 'usuario_email', val: target } },
    { name: 'aprobaciones',             where: { col: 'solicitado_por', val: target } },
    { name: 'ordenes_venta',            where: { col: 'creado_por', val: target } },
    { name: 'ordenes_compra',           where: { col: 'creado_por', val: target } },
    { name: 'cotizaciones',             where: { col: 'creado_por', val: target } },
    { name: 'movimientos',              where: { col: 'usuario_email', val: target } },
    { name: 'ordenes_taller',           where: { col: 'asignado_a', val: target } },
  ];

  for (const t of tablas) {
    try {
      const { data, error } = await supabase
        .from(t.name)
        .select('*')
        .eq(t.where.col, t.where.val)
        .limit(5000);
      if (!error) out[t.name] = data || [];
    } catch { /* tabla no existe en este deploy */ }
  }

  // 6. Persistir solicitud GDPR
  const { data: solicitud } = await supabase
    .from('gdpr_solicitudes')
    .insert({
      tipo: 'export',
      usuario_email: target,
      solicitado_por: auth.user.email,
      estado: 'procesada',
      resultado: { tablas: Object.keys(out), total_filas: Object.values(out).reduce((s: number, v: any) => s + (v?.length || 0), 0) },
      procesado_at: new Date().toISOString(),
    })
    .select()
    .single();

  // 7. Auditar
  await registrarAuditoriaSegura({
    tabla: 'gdpr_solicitudes',
    accion: 'EXPORT',
    codigo: solicitud?.id,
    datosNuevos: { usuario_target: target, solicitante: auth.user.email },
    usuarioEmail: auth.user.email,
    contexto: extraerContextoAudit(request),
  });

  return NextResponse.json({
    usuario: target,
    generado_en: new Date().toISOString(),
    solicitud_id: solicitud?.id,
    datos: out,
  });
}
