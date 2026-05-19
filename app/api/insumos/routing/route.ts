// =====================================================
// /api/insumos/routing
// =====================================================
// GET    → lista categorías + gestores/referentes por org
// POST   → upsert routing de una categoría (solo admins)
// DELETE → desactivar routing (?id=N, solo admins)
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/security/permissions';
import { parseSafe, upsertRoutingInsumosSchema } from '@/lib/security/zod-schemas';
import { registrarAuditoriaSegura, extraerContextoAudit } from '@/lib/security/audit-enhanced';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const orgId = request.nextUrl.searchParams.get('organizacion_id');
  if (!orgId) return NextResponse.json({ error: 'organizacion_id requerido' }, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from('org_categorias_insumos_routing')
    .select('*')
    .eq('organizacion_id', orgId)
    .order('categoria');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ routing: data || [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo admins pueden configurar routing' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = parseSafe(upsertRoutingInsumosSchema, body);
  if (!parsed.ok) return NextResponse.json(parsed, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('org_categorias_insumos_routing')
    .upsert(
      {
        organizacion_id: parsed.data.organizacion_id,
        categoria: parsed.data.categoria,
        categoria_label: parsed.data.categoria_label || parsed.data.categoria,
        gestor_emails: parsed.data.gestor_emails,
        referente_emails: parsed.data.referente_emails,
        activa: parsed.data.activa !== false,
      },
      { onConflict: 'organizacion_id,categoria' },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await registrarAuditoriaSegura({
    tabla: 'org_categorias_insumos_routing',
    accion: 'CONFIGURAR',
    codigo: parsed.data.categoria,
    datosNuevos: {
      categoria: parsed.data.categoria,
      gestores_count: parsed.data.gestor_emails.length,
      referentes_count: parsed.data.referente_emails.length,
    },
    usuarioEmail: auth.user.email,
    contexto: extraerContextoAudit(request),
  });

  return NextResponse.json({ ok: true, routing: data });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo admins' }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { error } = await supabase
    .from('org_categorias_insumos_routing')
    .update({ activa: false })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await registrarAuditoriaSegura({
    tabla: 'org_categorias_insumos_routing',
    accion: 'DESACTIVAR',
    codigo: id,
    usuarioEmail: auth.user.email,
    contexto: extraerContextoAudit(request),
  });

  return NextResponse.json({ ok: true });
}
