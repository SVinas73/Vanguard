// =====================================================
// POST /api/organizaciones
// =====================================================
// Crea una organización + agrega al usuario como owner.
// Se ejecuta server-side con SUPABASE_SERVICE_ROLE_KEY para
// bypass de RLS — el problema del cliente es que cuando hace
// .insert().select() para leer la org recién creada, la policy
// `organizaciones_select` filtra por membership, pero todavía
// no se creó. Atomicidad solo posible server-side.
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireAuth } from '@/lib/security/permissions';
import { parseSafe } from '@/lib/security/zod-schemas';
import { registrarAuditoriaSegura, extraerContextoAudit } from '@/lib/security/audit-enhanced';
import { reportarError } from '@/lib/security/error-reporting';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const crearOrgSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido').max(255),
  slug: z.string().max(64).optional().nullable(),
  rut: z.string().max(32).optional().nullable(),
  pais: z.string().max(8).optional(),
  moneda: z.string().max(8).optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const parsed = parseSafe(crearOrgSchema, body);
  if (!parsed.ok) return NextResponse.json(parsed, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Crear organización
    const { data: org, error: orgError } = await supabase
      .from('organizaciones')
      .insert({
        nombre: parsed.data.nombre,
        slug: parsed.data.slug || null,
        rut: parsed.data.rut || null,
        pais: parsed.data.pais || 'UY',
        moneda: parsed.data.moneda || 'UYU',
      })
      .select()
      .single();

    if (orgError || !org) {
      reportarError(new Error(`Crear org falló: ${orgError?.message}`), {
        modulo: 'organizaciones',
        accion: 'crear',
        extra: { userEmail: auth.user.email, dbError: orgError?.message },
      });
      return NextResponse.json(
        {
          error: `No se pudo crear la organización: ${orgError?.message || 'error desconocido'}`,
          db_error: orgError?.message,
          hint: orgError?.message?.includes('does not exist')
            ? 'Verificá que la migración 016 esté aplicada en Supabase.'
            : 'Revisá los logs de Supabase para más detalle.',
        },
        { status: 500 },
      );
    }

    // 2. Crear membership como owner
    const { error: memberError } = await supabase
      .from('usuario_organizacion')
      .insert({
        usuario_email: auth.user.email,
        organizacion_id: org.id,
        rol: 'owner',
        es_default: true,
      });

    if (memberError) {
      // Rollback: borrar la org si falló la membership
      await supabase.from('organizaciones').delete().eq('id', org.id);
      return NextResponse.json(
        { error: `No se pudo asignar como owner: ${memberError.message}` },
        { status: 500 },
      );
    }

    // 3. Audit
    await registrarAuditoriaSegura({
      tabla: 'organizaciones',
      accion: 'CREAR',
      codigo: String(org.id),
      datosNuevos: {
        id: org.id,
        nombre: org.nombre,
        owner: auth.user.email,
        pais: org.pais,
        moneda: org.moneda,
      },
      usuarioEmail: auth.user.email,
      contexto: extraerContextoAudit(request),
    });

    return NextResponse.json({ ok: true, organizacion: org });
  } catch (err: any) {
    reportarError(err, { modulo: 'organizaciones', accion: 'crear', extra: { userEmail: auth.user.email } });
    return NextResponse.json({ error: err?.message || 'Error inesperado' }, { status: 500 });
  }
}
