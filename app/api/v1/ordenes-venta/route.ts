import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { withApiAuth } from '@/lib/api-gateway/middleware';
import { parseSafe } from '@/lib/security/zod-schemas';
import { emitirEvento } from '@/lib/api-gateway/webhooks';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const crearOVSchema = z.object({
  cliente_id: z.string().uuid(),
  fecha_entrega_esperada: z.string().optional(),
  notas: z.string().max(1000).optional(),
  items: z.array(z.object({
    producto_codigo: z.string(),
    cantidad: z.number().positive(),
    precio_unitario: z.number().nonnegative(),
    descuento: z.number().nonnegative().optional(),
  })).min(1),
});

export const GET = withApiAuth({ scope: 'ordenes_venta:read' }, async (req) => {
  const url = new URL(req.url);
  const estado = url.searchParams.get('estado');
  const clienteId = url.searchParams.get('cliente_id');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0'));

  let q = supabase.from('ordenes_venta')
    .select('id, numero, cliente_id, total, estado, estado_pago, fecha_orden, fecha_entrega_esperada, fecha_entregada', { count: 'exact' })
    .order('fecha_orden', { ascending: false });
  if (estado) q = q.eq('estado', estado);
  if (clienteId) q = q.eq('cliente_id', clienteId);

  const { data, error, count } = await q.range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    data: data || [],
    paginacion: { limit, offset, total: count ?? 0 },
  });
});

export const POST = withApiAuth({ scope: 'ordenes_venta:write' }, async (req) => {
  const body = await req.json().catch(() => ({}));
  const parsed = parseSafe(crearOVSchema, body);
  if (!parsed.ok) return NextResponse.json(parsed, { status: 400 });

  // Generar número
  const { count } = await supabase.from('ordenes_venta').select('*', { count: 'exact', head: true });
  const numero = `OV-${String((count ?? 0) + 1).padStart(6, '0')}`;

  const subtotal = parsed.data.items.reduce(
    (s, i) => s + (i.cantidad * i.precio_unitario - (i.descuento || 0)), 0
  );

  const { data: orden, error } = await supabase.from('ordenes_venta').insert({
    numero,
    cliente_id: parsed.data.cliente_id,
    fecha_entrega_esperada: parsed.data.fecha_entrega_esperada || null,
    notas: parsed.data.notas || null,
    estado: 'borrador',
    estado_pago: 'pendiente',
    subtotal,
    total: subtotal,
    saldo_pendiente: subtotal,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Items
  const itemsInsert = parsed.data.items.map(i => ({
    orden_id: orden.id,
    producto_codigo: i.producto_codigo,
    cantidad: i.cantidad,
    precio_unitario: i.precio_unitario,
    descuento_item: i.descuento || 0,
    subtotal: i.cantidad * i.precio_unitario - (i.descuento || 0),
  }));
  await supabase.from('ordenes_venta_items').insert(itemsInsert);

  void emitirEvento('orden_venta.creada', {
    id: orden.id, numero: orden.numero, total: subtotal,
    cliente_id: orden.cliente_id, items: itemsInsert.length,
  });

  return NextResponse.json({ data: { ...orden, items_creados: itemsInsert.length } }, { status: 201 });
});
