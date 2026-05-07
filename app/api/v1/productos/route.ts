import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withApiAuth } from '@/lib/api-gateway/middleware';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// =====================================================
// GET /api/v1/productos
// =====================================================
// Lista productos. Soporta filtros por query string:
//   ?codigo=ABC
//   ?categoria=herramientas
//   ?solo_criticos=true
//   ?limit=50  (max 200)
//   ?offset=0
// =====================================================

export const GET = withApiAuth({ scope: 'productos:read' }, async (req) => {
  const url = new URL(req.url);
  const codigo = url.searchParams.get('codigo');
  const categoria = url.searchParams.get('categoria');
  const soloCriticos = url.searchParams.get('solo_criticos') === 'true';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0'));

  let q = supabase.from('productos')
    .select('id, codigo, descripcion, categoria, stock, stock_minimo, precio, costo_promedio, activo', { count: 'exact' })
    .is('deleted_at', null);
  if (codigo) q = q.eq('codigo', codigo);
  if (categoria) q = q.ilike('categoria', `%${categoria}%`);

  const { data, error, count } = await q.range(offset, offset + limit - 1);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let productos = data || [];
  if (soloCriticos) {
    productos = productos.filter((p: any) => p.stock <= p.stock_minimo);
  }

  return NextResponse.json({
    data: productos,
    paginacion: { limit, offset, total: count ?? productos.length },
  });
});
