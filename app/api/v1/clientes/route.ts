import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { withApiAuth } from '@/lib/api-gateway/middleware';
import { parseSafe } from '@/lib/security/zod-schemas';
import { emitirEvento } from '@/lib/api-gateway/webhooks';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const clienteSchema = z.object({
  nombre: z.string().min(1).max(200),
  codigo: z.string().max(50).optional(),
  email: z.string().email().optional(),
  telefono: z.string().max(40).optional(),
  rut: z.string().max(20).optional(),
  direccion: z.string().max(500).optional(),
  limite_credito: z.number().nonnegative().optional(),
  dias_pago: z.number().int().nonnegative().max(365).optional(),
});

export const GET = withApiAuth({ scope: 'clientes:read' }, async (req) => {
  const url = new URL(req.url);
  const q = url.searchParams.get('q');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0'));

  let query = supabase.from('clientes')
    .select('id, codigo, nombre, email, telefono, saldo_pendiente, limite_credito, bloqueado', { count: 'exact' })
    .eq('activo', true);
  if (q) query = query.or(`nombre.ilike.%${q}%,codigo.ilike.%${q}%,email.ilike.%${q}%`);

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    data: data || [],
    paginacion: { limit, offset, total: count ?? 0 },
  });
});

export const POST = withApiAuth({ scope: 'clientes:write' }, async (req) => {
  const body = await req.json().catch(() => ({}));
  const parsed = parseSafe(clienteSchema, body);
  if (!parsed.ok) return NextResponse.json(parsed, { status: 400 });

  const { data, error } = await supabase.from('clientes').insert({
    ...parsed.data, activo: true,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  void emitirEvento('cliente.creado', { id: data.id, nombre: data.nombre, codigo: data.codigo });

  return NextResponse.json({ data }, { status: 201 });
});
