// =====================================================
// POST /api/admin/almacen-insumos
// =====================================================
// Marca/desmarca un almacén como "de insumos". Solo admin.
// Útil porque no exponemos UI para esto (el usuario lo pidió
// así) pero quiere poder hacerlo sin entrar a SQL Editor.
//
// Body: { almacen_id: UUID, es_insumos: boolean }
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/security/permissions';
import { z } from 'zod';
import { parseSafe } from '@/lib/security/zod-schemas';
import { registrarAuditoriaSegura, extraerContextoAudit } from '@/lib/security/audit-enhanced';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const schema = z.object({
  almacen_id: z.string().uuid(),
  es_insumos: z.boolean(),
});

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo admins' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = parseSafe(schema, body);
  if (!parsed.ok) return NextResponse.json(parsed, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from('almacenes')
    .update({ es_insumos: parsed.data.es_insumos })
    .eq('id', parsed.data.almacen_id)
    .select('id, nombre, es_insumos')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await registrarAuditoriaSegura({
    tabla: 'almacenes',
    accion: parsed.data.es_insumos ? 'MARCAR_INSUMOS' : 'DESMARCAR_INSUMOS',
    codigo: parsed.data.almacen_id,
    datosNuevos: { es_insumos: parsed.data.es_insumos, almacen: data?.nombre },
    usuarioEmail: auth.user.email,
    contexto: extraerContextoAudit(request),
  });

  return NextResponse.json({ ok: true, almacen: data });
}
