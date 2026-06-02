// =====================================================
// /api/insumos/solicitudes/[id]
// =====================================================
// GET   → detalle de una solicitud con items
// PATCH → cambiar estado, asignar gestor, marcar recibido
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/security/permissions';
import { parseSafe, cambiarEstadoSolicitudSchema, editarSolicitudInsumoSchema } from '@/lib/security/zod-schemas';
import { puedeAprobarProveedor, aprobadorRequerido } from '@/lib/insumos/proveedores';
import { registrarAuditoriaSegura, extraerContextoAudit } from '@/lib/security/audit-enhanced';
import { crearNotificacion } from '@/lib/notifications';
import { reportarError } from '@/lib/security/error-reporting';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from('solicitudes_insumos')
    .select(`*, items:solicitudes_insumos_items(*)`)
    .eq('id', params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
  return NextResponse.json({ solicitud: data });
}

const TRANSICIONES_VALIDAS: Record<string, string[]> = {
  pendiente:  ['en_gestion', 'cancelada'],
  en_gestion: ['comprada', 'cancelada'],
  comprada: ['recibida', 'cancelada'],
  recibida: ['cerrada'],
  cerrada: [],
  cancelada: [],
};

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const parsed = parseSafe(cambiarEstadoSolicitudSchema, body);
  if (!parsed.ok) return NextResponse.json(parsed, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Cargar solicitud actual
    const { data: actual, error: errGet } = await supabase
      .from('solicitudes_insumos')
      .select('*, items:solicitudes_insumos_items(*)')
      .eq('id', params.id)
      .maybeSingle();

    if (errGet || !actual) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    // 2. Validar transición
    const transicionesPermitidas = TRANSICIONES_VALIDAS[actual.estado] || [];
    if (actual.estado !== parsed.data.estado && !transicionesPermitidas.includes(parsed.data.estado)) {
      return NextResponse.json(
        { error: `Transición inválida: ${actual.estado} → ${parsed.data.estado}` },
        { status: 400 },
      );
    }

    // 2.b Gate de aprobación por proveedor: la aprobación (pendiente → en_gestion)
    //     de ciertos proveedores (Mercado Libre / Ynter Industrial) es exclusiva
    //     de un email puntual (Gonzalo). El resto lo aprueba cualquiera.
    if (actual.estado === 'pendiente' && parsed.data.estado === 'en_gestion') {
      if (!puedeAprobarProveedor(actual.proveedor, auth.user.email)) {
        const requerido = aprobadorRequerido(actual.proveedor);
        return NextResponse.json(
          { error: `Solo ${requerido} puede aprobar solicitudes de este proveedor.` },
          { status: 403 },
        );
      }
    }

    // 3. Update
    const update: any = {
      estado: parsed.data.estado,
      estado_motivo: parsed.data.motivo || null,
      // Trazabilidad: quién y cuándo tocó la solicitud por última vez.
      modificado_por: auth.user.email,
      modificado_at: new Date().toISOString(),
    };
    if (parsed.data.estado === 'en_gestion' && !actual.gestor_asignado) {
      update.gestor_asignado = auth.user.email;
    }
    if (parsed.data.estado === 'recibida' && parsed.data.fecha_ingreso) {
      update.fecha_ingreso = parsed.data.fecha_ingreso;
    }
    if (parsed.data.estado === 'recibida' && !parsed.data.fecha_ingreso) {
      update.fecha_ingreso = new Date().toISOString().split('T')[0];
    }
    if (parsed.data.orden_compra_id) {
      update.orden_compra_id = parsed.data.orden_compra_id;
    }

    const { error: errUpdate } = await supabase
      .from('solicitudes_insumos')
      .update(update)
      .eq('id', params.id);

    if (errUpdate) return NextResponse.json({ error: errUpdate.message }, { status: 500 });

    // 4. Si recibió items, actualizar cantidad_recibida y sincronizar STOCK.
    //
    // FLUJO COMPLETO (después del fix):
    //   a) Para cada item recibido, persistir cantidad_recibida.
    //   b) Si el item está vinculado a un producto existente → upsert sobre
    //      ese código. Si NO está vinculado (insumo nuevo) → AUTOCREAR el
    //      producto con un código generado a partir de la solicitud, y
    //      guardar el código de vuelta en el item para futuras referencias.
    //   c) Insertar movimiento de entrada con los nombres REALES de
    //      columna (codigo / notas / costo_compra / producto_id),
    //      no los falsos (producto_codigo / motivo / referencia_*) que
    //      antes hacían fallar silenciosamente el INSERT.
    //   d) Incrementar productos.stock con la cantidad recibida.
    //   e) Crear lote (FIFO) para mantener la valuación coherente con
    //      Dashboard / Reportes / Centro de Costos.
    if (parsed.data.estado === 'recibida' && parsed.data.items_recibidos?.length) {
      for (const ir of parsed.data.items_recibidos) {
        // a) cantidad recibida
        await supabase
          .from('solicitudes_insumos_items')
          .update({ cantidad_recibida: ir.cantidad_recibida })
          .eq('id', ir.item_id);

        if (!(ir.cantidad_recibida > 0)) continue;

        const item = actual.items.find((i: any) => i.id === ir.item_id);
        if (!item) continue;

        // b) resolver producto (existente o autocreado)
        //   - producto_codigo  → producto existente vinculado.
        //   - nuevo_codigo     → artículo nuevo con el código que eligió el usuario.
        //   - fallback         → código autogenerado por item.
        let codigoProducto = item.producto_codigo as string | null;

        if (!codigoProducto) {
          codigoProducto = (item.nuevo_codigo && String(item.nuevo_codigo).trim())
            ? String(item.nuevo_codigo).trim().toUpperCase()
            : `INS-${actual.numero}-${item.id}`.toUpperCase();
        }

        // Costo unitario confirmado al recibir (opcional).
        const costoUnit = (ir.costo_unitario != null && ir.costo_unitario > 0)
          ? Number(ir.costo_unitario)
          : null;

        let { data: prod } = await supabase
          .from('productos')
          .select('id, stock, costo_promedio')
          .eq('codigo', codigoProducto)
          .maybeSingle();

        if (!prod) {
          // Asignamos el almacén principal (o el primero) en vez de null,
          // para que el producto no quede "huérfano": si quedara sin almacén,
          // aparecería en el dashboard bajo "Todos" pero no al filtrar por el
          // único almacén, dando métricas inconsistentes.
          const { data: almacenPrincipal } = await supabase
            .from('almacenes')
            .select('id')
            .eq('activo', true)
            .order('es_principal', { ascending: false })
            .limit(1)
            .maybeSingle();

          const { data: creado, error: errCrear } = await supabase
            .from('productos')
            .insert({
              codigo: codigoProducto,
              descripcion: item.descripcion ?? codigoProducto,
              precio: 0,              // placeholder, editable después en Stock
              moneda: 'UYU',
              categoria: item.nuevo_categoria || 'Insumos',
              stock: 0,               // se suma abajo
              stock_minimo: item.nuevo_stock_minimo ?? 5,
              costo_promedio: 0,
              almacen_id: almacenPrincipal?.id ?? null,
              creado_por: auth.user.email,
              creado_at: new Date().toISOString(),
              actualizado_por: auth.user.email,
              actualizado_at: new Date().toISOString(),
            })
            .select('id, stock, costo_promedio')
            .single();

          if (errCrear || !creado) {
            console.error('No se pudo autocrear el producto desde insumo:', errCrear);
            continue; // no abortamos toda la recepción
          }
          prod = creado;

          // Guardar el código auto-generado de vuelta en el item para que
          // futuras recepciones del mismo item reconozcan el producto.
          await supabase
            .from('solicitudes_insumos_items')
            .update({ producto_codigo: codigoProducto })
            .eq('id', item.id);
        }

        // c) movimiento de entrada (nombres reales de columna)
        await supabase.from('movimientos').insert({
          producto_id: prod.id,
          codigo: codigoProducto,
          tipo: 'entrada',
          cantidad: ir.cantidad_recibida,
          costo_compra: costoUnit,
          moneda_costo: 'UYU',
          notas: `Ingreso por solicitud de insumo ${actual.numero}`,
          usuario_email: auth.user.email,
        });

        // d) sumar al stock del producto
        await supabase
          .from('productos')
          .update({ stock: (prod.stock ?? 0) + Number(ir.cantidad_recibida) })
          .eq('codigo', codigoProducto);

        // d.2) costo: si se confirmó un costo unitario al recibir, actualizar
        //      costo_promedio ponderado + último costo y registrar el historial
        //      de costos (igual criterio que la recepción de compras).
        if (costoUnit != null) {
          const stockPrevio = Number(prod.stock) || 0;
          const costoPrevio = Number(prod.costo_promedio) || 0;
          const stockNuevo = stockPrevio + Number(ir.cantidad_recibida);
          const nuevoCosto = stockNuevo > 0
            ? ((stockPrevio * costoPrevio) + (Number(ir.cantidad_recibida) * costoUnit)) / stockNuevo
            : costoUnit;
          const nuevoCostoRedondeado = Math.round(nuevoCosto * 100) / 100;

          await supabase
            .from('productos')
            .update({ costo_promedio: nuevoCostoRedondeado, costo_ultima_compra: costoUnit })
            .eq('codigo', codigoProducto);

          await supabase.from('historial_costos').insert({
            producto_id: prod.id,
            codigo: codigoProducto,
            costo_anterior: costoPrevio,
            costo_nuevo: nuevoCostoRedondeado,
            cantidad: ir.cantidad_recibida,
            fecha: update.fecha_ingreso || new Date().toISOString().split('T')[0],
            usuario: auth.user.email,
          });
        }

        // e) lote para valuación FIFO
        await supabase.from('lotes').insert({
          codigo: codigoProducto,
          cantidad_inicial: ir.cantidad_recibida,
          cantidad_disponible: ir.cantidad_recibida,
          costo_unitario: costoUnit ?? 0,
          moneda: 'UYU',
          usuario: auth.user.email,
          notas: `Solicitud ${actual.numero}`,
        });
      }
    }

    // 5. Audit
    await registrarAuditoriaSegura({
      tabla: 'solicitudes_insumos',
      accion: 'CAMBIO_ESTADO',
      codigo: actual.numero,
      datosAnteriores: { estado: actual.estado },
      datosNuevos: {
        estado: parsed.data.estado,
        motivo: parsed.data.motivo,
        gestor: update.gestor_asignado || actual.gestor_asignado,
        fecha_ingreso: update.fecha_ingreso || null,
      },
      usuarioEmail: auth.user.email,
      contexto: extraerContextoAudit(request),
    });

    // 6. Notificar al solicitante el cambio
    await crearNotificacion({
      tipo: 'solicitud_insumo_estado',
      severidad: parsed.data.estado === 'cancelada' ? 'warning' : 'info',
      titulo: `Solicitud ${actual.numero}: ${parsed.data.estado}`,
      mensaje: `${auth.user.email} cambió el estado de tu solicitud a "${parsed.data.estado}"${parsed.data.motivo ? `. Motivo: ${parsed.data.motivo}` : ''}.`,
      entidadTipo: 'solicitudes_insumos',
      entidadId: actual.id,
      entidadCodigo: actual.numero,
      usuarioEmail: actual.solicitado_por,
      dedupKey: `solicitud_estado:${actual.id}:${parsed.data.estado}`,
      metadata: { estado_anterior: actual.estado, estado_nuevo: parsed.data.estado },
    });

    return NextResponse.json({ ok: true, estado: parsed.data.estado });
  } catch (err: any) {
    reportarError(err, { modulo: 'insumos', accion: 'cambiar-estado', extra: { solicitudId: params.id } });
    return NextResponse.json({ error: err?.message || 'Error inesperado' }, { status: 500 });
  }
}

// =====================================================
// PUT → EDITAR una solicitud ya creada (EXCLUSIVO de admins)
// =====================================================
// Permite corregir encabezado (proveedor, categoría, fecha límite,
// observaciones) y los items (descripción/cantidad/unidad/obs) mientras la
// solicitud esté en 'pendiente' o 'en_gestion'. Deja trazabilidad.
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Solo admins pueden EDITAR el contenido de una solicitud.
  if (auth.user.rol !== 'admin') {
    return NextResponse.json(
      { error: 'Solo los usuarios administradores pueden editar solicitudes.' },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = parseSafe(editarSolicitudInsumoSchema, body);
  if (!parsed.ok) return NextResponse.json(parsed, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data: actual, error: errGet } = await supabase
      .from('solicitudes_insumos')
      .select('*, items:solicitudes_insumos_items(*)')
      .eq('id', params.id)
      .maybeSingle();

    if (errGet || !actual) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    // Solo editable antes de comprar (evita inconsistencias con stock/lotes).
    if (!['pendiente', 'en_gestion'].includes(actual.estado)) {
      return NextResponse.json(
        { error: `No se puede editar una solicitud en estado "${actual.estado}". Solo pendiente o aprobada.` },
        { status: 400 },
      );
    }

    // 1. Encabezado
    const headerUpdate: any = {
      modificado_por: auth.user.email,
      modificado_at: new Date().toISOString(),
    };
    if (parsed.data.proveedor !== undefined) {
      headerUpdate.proveedor = parsed.data.proveedor || null;
      headerUpdate.proveedor_nombre = parsed.data.proveedor === 'OTRO'
        ? (parsed.data.proveedor_nombre || null)
        : null;
    }
    if (parsed.data.categoria !== undefined) headerUpdate.categoria = parsed.data.categoria;
    if (parsed.data.fecha_limite !== undefined) headerUpdate.fecha_limite = parsed.data.fecha_limite || null;
    if (parsed.data.observaciones !== undefined) headerUpdate.observaciones = parsed.data.observaciones || null;

    const { error: errUpd } = await supabase
      .from('solicitudes_insumos')
      .update(headerUpdate)
      .eq('id', params.id);
    if (errUpd) return NextResponse.json({ error: errUpd.message }, { status: 500 });

    // 2. Items (solo los que pertenecen a esta solicitud)
    if (parsed.data.items?.length) {
      const idsValidos = new Set(actual.items.map((i: any) => i.id));
      for (const it of parsed.data.items) {
        if (!idsValidos.has(it.id)) continue;
        await supabase
          .from('solicitudes_insumos_items')
          .update({
            descripcion: it.descripcion,
            cantidad: it.cantidad,
            unidad: it.unidad || 'unidad',
            observaciones: it.observaciones || null,
          })
          .eq('id', it.id)
          .eq('solicitud_id', params.id);
      }
    }

    // 3. Audit
    await registrarAuditoriaSegura({
      tabla: 'solicitudes_insumos',
      accion: 'EDITAR',
      codigo: actual.numero,
      datosAnteriores: {
        proveedor: actual.proveedor,
        categoria: actual.categoria,
        fecha_limite: actual.fecha_limite,
        items: actual.items.map((i: any) => ({ id: i.id, descripcion: i.descripcion, cantidad: i.cantidad })),
      },
      datosNuevos: {
        proveedor: headerUpdate.proveedor ?? actual.proveedor,
        categoria: headerUpdate.categoria ?? actual.categoria,
        fecha_limite: headerUpdate.fecha_limite ?? actual.fecha_limite,
        items: parsed.data.items || undefined,
      },
      usuarioEmail: auth.user.email,
      contexto: extraerContextoAudit(request),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    reportarError(err, { modulo: 'insumos', accion: 'editar-solicitud', extra: { solicitudId: params.id } });
    return NextResponse.json({ error: err?.message || 'Error inesperado' }, { status: 500 });
  }
}
