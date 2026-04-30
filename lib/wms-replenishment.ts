import { supabase } from '@/lib/supabase';
import { registrarAuditoria } from '@/lib/audit';

// =====================================================
// Reposición automática pick-from-bulk
// =====================================================
// Escanea las ubicaciones de picking y, cuando una cae
// bajo su `cantidad_minima_picking`, busca una ubicación
// "bulk" (almacenamiento) que tenga el mismo producto y
// crea una tarea de reposición.
// =====================================================

export interface TareaReposicion {
  id: string;
  numero?: string;
  producto_codigo: string;
  producto_nombre?: string;
  ubicacion_origen_id?: string | null;
  ubicacion_origen_codigo?: string | null;
  ubicacion_destino_id: string;
  ubicacion_destino_codigo?: string | null;
  cantidad_sugerida: number;
  cantidad_ejecutada?: number | null;
  motivo?: string | null;
  estado: 'pendiente' | 'asignada' | 'en_proceso' | 'ejecutada' | 'cancelada';
  prioridad: number;
  asignado_a?: string | null;
  ejecutado_por?: string | null;
  fecha_creacion: string;
  fecha_ejecucion?: string | null;
  notas?: string | null;
}

/**
 * Detecta ubicaciones picking bajo mínimo y genera tareas
 * de reposición desde el bulk con stock disponible. Es
 * idempotente: si ya hay tarea pendiente para la misma
 * ubicación destino + producto, no crea otra.
 */
export async function escanearReposicionesNecesarias(usuario: string): Promise<number> {
  // 1. Ubicaciones de picking con stock bajo mínimo
  const { data: ubicacionesPicking } = await supabase
    .from('wms_ubicaciones')
    .select('id, codigo, codigo_completo, cantidad_minima_picking, cantidad_maxima_picking, es_ubicacion_picking')
    .eq('es_ubicacion_picking', true)
    .gt('cantidad_minima_picking', 0);

  if (!ubicacionesPicking || ubicacionesPicking.length === 0) return 0;

  let creadas = 0;
  for (const ub of ubicacionesPicking as any[]) {
    // 2. Stock actual en esa ubicación
    const { data: stock } = await supabase
      .from('wms_stock_ubicacion')
      .select('producto_codigo, cantidad')
      .eq('ubicacion_id', ub.id);

    if (!stock || stock.length === 0) continue;

    for (const s of stock as any[]) {
      const cantidadActual = parseFloat(s.cantidad) || 0;
      const minimo = parseFloat(ub.cantidad_minima_picking) || 0;
      const maximo = parseFloat(ub.cantidad_maxima_picking) || (minimo * 3);

      if (cantidadActual >= minimo) continue;

      // 3. ¿Ya hay tarea pendiente?
      const { data: existente } = await supabase
        .from('wms_tareas_reposicion')
        .select('id')
        .eq('ubicacion_destino_id', ub.id)
        .eq('producto_codigo', s.producto_codigo)
        .in('estado', ['pendiente', 'asignada', 'en_proceso'])
        .maybeSingle();
      if (existente) continue;

      // 4. Buscar ubicación bulk con stock disponible
      const cantidadNecesaria = Math.max(0, maximo - cantidadActual);
      const { data: bulk } = await supabase
        .from('wms_stock_ubicacion')
        .select('ubicacion_id, ubicacion_codigo, cantidad, wms_ubicaciones!inner(es_ubicacion_picking)')
        .eq('producto_codigo', s.producto_codigo)
        .gt('cantidad', 0)
        .eq('wms_ubicaciones.es_ubicacion_picking', false)
        .order('cantidad', { ascending: false })
        .limit(1);

      const fuente = (bulk || [])[0] as any;

      // 5. Crear tarea (origen puede ser null si no hay bulk)
      const { error } = await supabase.from('wms_tareas_reposicion').insert({
        numero: `REP-${Date.now().toString().slice(-8)}`,
        producto_codigo: s.producto_codigo,
        ubicacion_origen_id: fuente?.ubicacion_id || null,
        ubicacion_origen_codigo: fuente?.ubicacion_codigo || null,
        ubicacion_destino_id: ub.id,
        ubicacion_destino_codigo: ub.codigo_completo || ub.codigo,
        cantidad_sugerida: Math.min(cantidadNecesaria, fuente?.cantidad ?? cantidadNecesaria),
        motivo: 'bajo_minimo',
        estado: 'pendiente',
        prioridad: cantidadActual === 0 ? 1 : 2,
      });

      if (!error) creadas++;
    }
  }

  if (creadas > 0) {
    await registrarAuditoria(
      'wms_tareas_reposicion',
      'GENERAR_AUTO',
      null,
      null,
      { cantidad: creadas },
      usuario
    );
  }

  return creadas;
}

/**
 * Ejecuta una tarea de reposición: mueve stock entre las
 * ubicaciones origen y destino, registra movimiento y
 * cierra la tarea.
 */
export async function ejecutarReposicion(
  tareaId: string,
  cantidadReal: number,
  usuario: string
): Promise<boolean> {
  const { data: tarea } = await supabase
    .from('wms_tareas_reposicion')
    .select('*')
    .eq('id', tareaId)
    .maybeSingle();
  if (!tarea) return false;

  const cantidad = Math.min(cantidadReal, parseFloat(tarea.cantidad_sugerida));
  if (cantidad <= 0) return false;

  // Decrementar origen
  if (tarea.ubicacion_origen_id) {
    const { data: stockOrigen } = await supabase
      .from('wms_stock_ubicacion')
      .select('id, cantidad')
      .eq('ubicacion_id', tarea.ubicacion_origen_id)
      .eq('producto_codigo', tarea.producto_codigo)
      .maybeSingle();
    if (stockOrigen) {
      await supabase
        .from('wms_stock_ubicacion')
        .update({
          cantidad: Math.max(0, parseFloat((stockOrigen as any).cantidad) - cantidad),
          ultimo_movimiento: new Date().toISOString(),
        })
        .eq('id', (stockOrigen as any).id);
    }
  }

  // Incrementar destino
  const { data: stockDestino } = await supabase
    .from('wms_stock_ubicacion')
    .select('id, cantidad')
    .eq('ubicacion_id', tarea.ubicacion_destino_id)
    .eq('producto_codigo', tarea.producto_codigo)
    .maybeSingle();
  if (stockDestino) {
    await supabase
      .from('wms_stock_ubicacion')
      .update({
        cantidad: parseFloat((stockDestino as any).cantidad) + cantidad,
        ultimo_movimiento: new Date().toISOString(),
      })
      .eq('id', (stockDestino as any).id);
  } else {
    await supabase.from('wms_stock_ubicacion').insert({
      ubicacion_id: tarea.ubicacion_destino_id,
      ubicacion_codigo: tarea.ubicacion_destino_codigo,
      producto_codigo: tarea.producto_codigo,
      cantidad,
      cantidad_reservada: 0,
      cantidad_disponible: cantidad,
      ultimo_movimiento: new Date().toISOString(),
    });
  }

  // Cerrar tarea
  await supabase
    .from('wms_tareas_reposicion')
    .update({
      estado: 'ejecutada',
      cantidad_ejecutada: cantidad,
      ejecutado_por: usuario,
      fecha_ejecucion: new Date().toISOString(),
    })
    .eq('id', tareaId);

  await registrarAuditoria(
    'wms_tareas_reposicion',
    'EJECUTAR',
    tarea.numero || tareaId,
    { cantidad_sugerida: tarea.cantidad_sugerida },
    { cantidad_ejecutada: cantidad },
    usuario
  );

  return true;
}
