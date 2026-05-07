import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { withApiAuth } from '@/lib/api-gateway/middleware';
import { parseSafe } from '@/lib/security/zod-schemas';
import { crearTicket } from '@/lib/tickets';
import { emitirEvento } from '@/lib/api-gateway/webhooks';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const ticketSchema = z.object({
  asunto: z.string().min(1).max(200),
  descripcion: z.string().max(5000).optional(),
  cliente_nombre: z.string().max(200).optional(),
  cliente_email: z.string().email().optional(),
  cliente_telefono: z.string().max(40).optional(),
  cliente_id: z.string().uuid().optional(),
  canal: z.enum(['web', 'email', 'telefono', 'whatsapp', 'presencial']).default('web'),
  categoria: z.enum([
    'consulta', 'falla_producto', 'reclamo', 'pedido_info',
    'cambio', 'devolucion', 'instalacion', 'otro',
  ]).default('consulta'),
  prioridad: z.enum(['baja', 'normal', 'alta', 'critica']).default('normal'),
  producto_codigo: z.string().optional(),
  serial_numero: z.string().optional(),
  orden_venta_numero: z.string().optional(),
});

export const GET = withApiAuth({ scope: 'tickets:read' }, async (req) => {
  const url = new URL(req.url);
  const estado = url.searchParams.get('estado');
  const clienteEmail = url.searchParams.get('cliente_email');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0'));

  let q = supabase.from('tickets_soporte')
    .select('id, numero, asunto, cliente_nombre, cliente_email, prioridad, estado, sla_vencimiento, fecha_apertura, asignado_a', { count: 'exact' })
    .order('fecha_apertura', { ascending: false });
  if (estado) q = q.eq('estado', estado);
  if (clienteEmail) q = q.eq('cliente_email', clienteEmail);

  const { data, error, count } = await q.range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data || [], paginacion: { limit, offset, total: count ?? 0 } });
});

export const POST = withApiAuth({ scope: 'tickets:write' }, async (req, ctx) => {
  const body = await req.json().catch(() => ({}));
  const parsed = parseSafe(ticketSchema, body);
  if (!parsed.ok) return NextResponse.json(parsed, { status: 400 });

  const ticket = await crearTicket({
    ...parsed.data,
    creado_por: `api:${ctx.apiKey.prefix}`,
  });
  if (!ticket) {
    return NextResponse.json({ error: 'No se pudo crear el ticket' }, { status: 500 });
  }

  void emitirEvento('ticket.abierto', {
    id: ticket.id, numero: ticket.numero,
    asunto: ticket.asunto, prioridad: ticket.prioridad,
    cliente_email: ticket.cliente_email,
  });

  return NextResponse.json({ data: ticket }, { status: 201 });
});
