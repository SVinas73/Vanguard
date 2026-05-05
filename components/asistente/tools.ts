// =====================================================
// HERRAMIENTAS DEL ASISTENTE OMNISCIENTE
// =====================================================
// Cobertura completa: stock, compras, ventas, finanzas,
// WMS, taller, proyectos, QMS, RMA, trazabilidad, BOM,
// aprobaciones, facturación electrónica, notificaciones,
// auditoría + guía de navegación de la app.
//
// Cada tool devuelve { ...data } o { error: string }.
// Las que escriben respetan permisos (rol del usuario).
// =====================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// =====================================================
// HELPERS
// =====================================================

function rangoPeriodo(periodo?: string) {
  const hoy = new Date();
  const inicio = new Date();
  switch (periodo) {
    case 'hoy': inicio.setHours(0, 0, 0, 0); break;
    case 'semana': inicio.setDate(hoy.getDate() - 7); break;
    case 'año': inicio.setFullYear(hoy.getFullYear() - 1); break;
    default: inicio.setMonth(hoy.getMonth() - 1);
  }
  return { inicio, hoy };
}

function safeNum(v: any) { return parseFloat(v) || 0; }

// =====================================================
// STOCK & PRODUCTOS  (existentes)
// =====================================================

async function consultarStock(params: any) {
  try {
    let query = supabase
      .from('productos')
      .select('codigo, descripcion, stock, stock_minimo, categoria, precio, costo_promedio')
      .is('deleted_at', null);
    if (params.codigo) query = query.eq('codigo', params.codigo);
    if (params.categoria) query = query.ilike('categoria', `%${params.categoria}%`);
    const { data } = await query.limit(30);
    let productos = data || [];
    if (params.solo_criticos) productos = productos.filter(p => p.stock <= p.stock_minimo);
    return {
      total: productos.length,
      criticos: productos.filter(p => p.stock <= p.stock_minimo).length,
      productos: productos.slice(0, 15).map(p => ({
        codigo: p.codigo, descripcion: p.descripcion, stock: p.stock,
        stock_minimo: p.stock_minimo,
        estado: p.stock === 0 ? 'AGOTADO' : p.stock <= p.stock_minimo ? 'CRÍTICO' : 'OK',
      })),
    };
  } catch (e: any) { return { error: e.message }; }
}

async function buscarProductos(params: any) {
  try {
    const { data } = await supabase
      .from('productos')
      .select('codigo, descripcion, stock, categoria, precio')
      .is('deleted_at', null)
      .or(`codigo.ilike.%${params.query}%,descripcion.ilike.%${params.query}%`)
      .limit(params.limite || 15);
    return { encontrados: data?.length || 0, productos: data || [] };
  } catch (e: any) { return { error: e.message }; }
}

async function productosCriticos(params: any) {
  try {
    const { data } = await supabase
      .from('productos').select('codigo, descripcion, stock, stock_minimo, categoria')
      .is('deleted_at', null).order('stock', { ascending: true }).limit(50);
    const criticos = (data || []).filter(p => p.stock <= p.stock_minimo);
    return {
      total_criticos: criticos.length,
      agotados: criticos.filter(p => p.stock === 0).length,
      productos: criticos.slice(0, params.limite || 15).map(p => ({
        codigo: p.codigo, descripcion: p.descripcion, stock: p.stock,
        stock_minimo: p.stock_minimo, faltante: Math.max(0, p.stock_minimo - p.stock),
      })),
    };
  } catch (e: any) { return { error: e.message }; }
}

// =====================================================
// VENTAS  (nuevas)
// =====================================================

async function cotizacionesPendientes(params: any) {
  try {
    const { data } = await supabase
      .from('cotizaciones')
      .select('id, numero, cliente_id, total, fecha_validez, estado, clientes(nombre)')
      .in('estado', ['borrador', 'enviada'])
      .order('created_at', { ascending: false })
      .limit(params.limite || 20);
    return {
      total: data?.length || 0,
      cotizaciones: (data || []).map((c: any) => ({
        numero: c.numero, cliente: c.clientes?.nombre || 'Sin cliente',
        total: c.total, fecha_validez: c.fecha_validez, estado: c.estado,
      })),
    };
  } catch (e: any) { return { error: e.message }; }
}

async function ordenesVentaRecientes(params: any) {
  try {
    const { data } = await supabase
      .from('ordenes_venta')
      .select('numero, total, estado, estado_pago, fecha_orden, clientes(nombre)')
      .order('fecha_orden', { ascending: false })
      .limit(params.limite || 20);
    return {
      ordenes: (data || []).map((o: any) => ({
        numero: o.numero, cliente: o.clientes?.nombre || '—',
        total: o.total, estado: o.estado, pago: o.estado_pago,
        fecha: o.fecha_orden,
      })),
    };
  } catch (e: any) { return { error: e.message }; }
}

async function topClientes(params: any) {
  try {
    const { inicio } = rangoPeriodo(params.periodo);
    const { data } = await supabase
      .from('ordenes_venta')
      .select('cliente_id, total, clientes(nombre)')
      .gte('fecha_orden', inicio.toISOString())
      .not('estado', 'eq', 'cancelada');
    const acc: Record<string, { nombre: string; total: number; ordenes: number }> = {};
    (data || []).forEach((o: any) => {
      const id = o.cliente_id; if (!id) return;
      if (!acc[id]) acc[id] = { nombre: o.clientes?.nombre || 'Sin nombre', total: 0, ordenes: 0 };
      acc[id].total += safeNum(o.total);
      acc[id].ordenes += 1;
    });
    const ordenado = Object.values(acc).sort((a, b) => b.total - a.total).slice(0, params.limite || 10);
    return { periodo: params.periodo || 'mes', clientes: ordenado };
  } catch (e: any) { return { error: e.message }; }
}

async function buscarCliente(params: any) {
  try {
    const { data } = await supabase
      .from('clientes')
      .select('id, codigo, nombre, email, telefono, saldo_pendiente, limite_credito, bloqueado')
      .or(`nombre.ilike.%${params.query}%,codigo.ilike.%${params.query}%,email.ilike.%${params.query}%`)
      .limit(params.limite || 10);
    return { encontrados: data?.length || 0, clientes: data || [] };
  } catch (e: any) { return { error: e.message }; }
}

// =====================================================
// FINANZAS  (nuevas)
// =====================================================

async function cxcVencidas(params: any) {
  try {
    const hoy = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('cuentas_por_cobrar')
      .select('numero, fecha_vencimiento, monto, saldo, clientes(nombre)')
      .neq('estado', 'pagada')
      .lt('fecha_vencimiento', hoy)
      .order('fecha_vencimiento', { ascending: true })
      .limit(params.limite || 20);
    const total = (data || []).reduce((s, c: any) => s + safeNum(c.saldo), 0);
    return {
      total_vencido: total,
      cantidad: data?.length || 0,
      cxc: (data || []).map((c: any) => ({
        numero: c.numero, cliente: c.clientes?.nombre, vencimiento: c.fecha_vencimiento,
        saldo: c.saldo, monto: c.monto,
      })),
    };
  } catch (e: any) { return { error: e.message }; }
}

async function cxpVencidas(params: any) {
  try {
    const hoy = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('cuentas_por_pagar')
      .select('numero, fecha_vencimiento, monto, saldo, proveedores(nombre)')
      .neq('estado', 'pagada')
      .lt('fecha_vencimiento', hoy)
      .order('fecha_vencimiento', { ascending: true })
      .limit(params.limite || 20);
    return {
      total_vencido: (data || []).reduce((s, c: any) => s + safeNum(c.saldo), 0),
      cantidad: data?.length || 0,
      cxp: (data || []).map((c: any) => ({
        numero: c.numero, proveedor: c.proveedores?.nombre,
        vencimiento: c.fecha_vencimiento, saldo: c.saldo,
      })),
    };
  } catch (e: any) { return { error: e.message }; }
}

async function notasCreditoDebito(params: any) {
  try {
    let q = supabase
      .from('notas_credito_debito')
      .select('numero, tipo, origen, entidad_nombre, monto, saldo, motivo, estado, fecha')
      .order('fecha', { ascending: false }).limit(params.limite || 20);
    if (params.estado) q = q.eq('estado', params.estado);
    const { data } = await q;
    return { notas: data || [] };
  } catch (e: any) { return { error: e.message }; }
}

async function saldoCliente(params: any) {
  try {
    const { data: cli } = await supabase
      .from('clientes')
      .select('id, nombre, saldo_pendiente, limite_credito, dias_pago, bloqueado')
      .or(`nombre.ilike.%${params.query}%,codigo.ilike.%${params.query}%`)
      .limit(1).maybeSingle();
    if (!cli) return { error: 'Cliente no encontrado' };
    const { data: cxc } = await supabase
      .from('cuentas_por_cobrar')
      .select('numero, saldo, fecha_vencimiento, estado')
      .eq('cliente_id', cli.id).neq('estado', 'pagada');
    return {
      cliente: cli.nombre,
      saldo_pendiente: cli.saldo_pendiente,
      limite_credito: cli.limite_credito,
      utilizacion_pct: cli.limite_credito > 0
        ? Math.round((cli.saldo_pendiente / cli.limite_credito) * 100) : null,
      bloqueado: cli.bloqueado,
      cxc_pendientes: cxc || [],
    };
  } catch (e: any) { return { error: e.message }; }
}

// =====================================================
// COMPRAS  (existente + nuevas)
// =====================================================

async function consultarProveedores(params: any) {
  try {
    let q = supabase.from('proveedores').select('id, nombre, email, telefono').is('deleted_at', null);
    if (params.query) q = q.ilike('nombre', `%${params.query}%`);
    const { data } = await q.limit(params.limite || 10);
    return { total: data?.length || 0, proveedores: data || [] };
  } catch (e: any) { return { error: e.message }; }
}

async function ordenesCompraRecientes(params: any) {
  try {
    const { data } = await supabase
      .from('ordenes_compra')
      .select('numero, total, estado, fecha_orden, proveedores(nombre)')
      .order('fecha_orden', { ascending: false })
      .limit(params.limite || 20);
    return {
      ordenes: (data || []).map((o: any) => ({
        numero: o.numero, proveedor: o.proveedores?.nombre,
        total: o.total, estado: o.estado, fecha: o.fecha_orden,
      })),
    };
  } catch (e: any) { return { error: e.message }; }
}

// =====================================================
// WMS  (nuevas)
// =====================================================

async function pickingPendiente(params: any) {
  try {
    const { data } = await supabase
      .from('wms_ordenes_picking')
      .select('numero, cliente_nombre, picker_asignado, unidades_totales, fecha_requerida, estado')
      .in('estado', ['pendiente', 'asignada', 'en_proceso'])
      .order('prioridad', { ascending: true })
      .limit(params.limite || 20);
    return {
      total: data?.length || 0,
      sin_asignar: (data || []).filter((p: any) => !p.picker_asignado).length,
      ordenes: data || [],
    };
  } catch (e: any) { return { error: e.message }; }
}

async function recepcionesPendientes(params: any) {
  try {
    const { data } = await supabase
      .from('wms_ordenes_recepcion')
      .select('numero, proveedor_nombre, fecha_esperada, unidades_esperadas, estado')
      .in('estado', ['pendiente', 'en_proceso', 'parcial'])
      .order('fecha_esperada', { ascending: true })
      .limit(params.limite || 20);
    return { recepciones: data || [] };
  } catch (e: any) { return { error: e.message }; }
}

async function putawayPendiente(params: any) {
  try {
    const { data } = await supabase
      .from('wms_tareas_putaway')
      .select('producto_codigo, producto_nombre, cantidad, ubicacion_destino_codigo, prioridad, estado')
      .eq('estado', 'pendiente')
      .order('prioridad', { ascending: true })
      .limit(params.limite || 30);
    return { total: data?.length || 0, tareas: data || [] };
  } catch (e: any) { return { error: e.message }; }
}

async function stockPorUbicacion(params: any) {
  try {
    let q = supabase
      .from('wms_stock_ubicacion')
      .select('producto_codigo, ubicacion_codigo, cantidad, cantidad_disponible, lote_numero')
      .gt('cantidad', 0);
    if (params.producto_codigo) q = q.eq('producto_codigo', params.producto_codigo);
    if (params.ubicacion_codigo) q = q.eq('ubicacion_codigo', params.ubicacion_codigo);
    const { data } = await q.limit(params.limite || 30);
    return { stock: data || [] };
  } catch (e: any) { return { error: e.message }; }
}

async function paquetesRecientes(params: any) {
  try {
    const { data } = await supabase
      .from('wms_paquetes')
      .select('numero, cliente_nombre, transportista, tracking_numero, estado, fecha_armado, peso_kg')
      .order('created_at', { ascending: false })
      .limit(params.limite || 15);
    return { paquetes: data || [] };
  } catch (e: any) { return { error: e.message }; }
}

// =====================================================
// TALLER  (nuevas)
// =====================================================

async function ordenesTallerActivas(params: any) {
  try {
    const { data } = await supabase
      .from('ordenes_taller')
      .select('numero, estado, prioridad, descripcion_equipo, problema_reportado, asignado_a, created_at, clientes(nombre)')
      .not('estado', 'in', '("entregado","cancelado","rechazado")')
      .order('created_at', { ascending: false })
      .limit(params.limite || 20);
    return {
      total: data?.length || 0,
      por_estado: contarPor(data || [], 'estado'),
      ordenes: (data || []).map((o: any) => ({
        numero: o.numero, cliente: o.clientes?.nombre,
        equipo: o.descripcion_equipo, estado: o.estado,
        prioridad: o.prioridad, problema: o.problema_reportado,
        asignado: o.asignado_a,
      })),
    };
  } catch (e: any) { return { error: e.message }; }
}

async function presupuestosTallerPendientes(params: any) {
  try {
    const { data } = await supabase
      .from('cotizaciones_taller')
      .select('numero, total, fecha, validez_dias, estado, ordenes_taller(numero)')
      .eq('estado', 'pendiente')
      .order('fecha', { ascending: false })
      .limit(params.limite || 20);
    return { presupuestos: data || [] };
  } catch (e: any) { return { error: e.message }; }
}

// =====================================================
// PROYECTOS  (nuevas)
// =====================================================

async function proyectosActivos(params: any) {
  try {
    const { data } = await supabase
      .from('proyectos')
      .select('id, nombre, estado, fecha_inicio, fecha_fin, responsable, progreso')
      .not('estado', 'in', '("completado","cancelado","archivado")')
      .order('fecha_inicio', { ascending: false })
      .limit(params.limite || 20);
    return { proyectos: data || [] };
  } catch (e: any) { return { error: e.message }; }
}

// =====================================================
// QMS / CALIDAD  (nuevas)
// =====================================================

async function noConformidadesAbiertas(params: any) {
  try {
    const { data } = await supabase
      .from('wms_no_conformidades')
      .select('numero, tipo, severidad, motivo, producto_codigo, fecha_apertura, estado')
      .neq('estado', 'cerrada')
      .order('fecha_apertura', { ascending: false })
      .limit(params.limite || 20);
    return {
      total: data?.length || 0,
      criticas: (data || []).filter((n: any) => n.severidad === 'critica').length,
      ncs: data || [],
    };
  } catch (e: any) { return { error: e.message }; }
}

async function certificadosProximosVencer(params: any) {
  try {
    const dias = params.dias || 60;
    const limite = new Date(Date.now() + dias * 86400000).toISOString().split('T')[0];
    const { data } = await supabase
      .from('certificados_qms')
      .select('numero, tipo, fecha_emision, fecha_vencimiento, entidad')
      .lte('fecha_vencimiento', limite)
      .gte('fecha_vencimiento', new Date().toISOString().split('T')[0])
      .order('fecha_vencimiento', { ascending: true })
      .limit(params.limite || 20);
    return { certificados: data || [] };
  } catch (e: any) { return { error: e.message }; }
}

// =====================================================
// RMA  (nuevas)
// =====================================================

async function rmaAbiertos(params: any) {
  try {
    const { data } = await supabase
      .from('rma')
      .select('numero, cliente_id, motivo, estado, fecha_solicitud, clientes(nombre)')
      .not('estado', 'in', '("cerrado","cancelado")')
      .order('fecha_solicitud', { ascending: false })
      .limit(params.limite || 20);
    return {
      total: data?.length || 0,
      rmas: (data || []).map((r: any) => ({
        numero: r.numero, cliente: r.clientes?.nombre,
        motivo: r.motivo, estado: r.estado, fecha: r.fecha_solicitud,
      })),
    };
  } catch (e: any) { return { error: e.message }; }
}

// =====================================================
// TRAZABILIDAD  (nuevas)
// =====================================================

async function trazarLote(params: any) {
  try {
    if (!params.lote_numero) return { error: 'Falta lote_numero' };
    const { data: lote } = await supabase
      .from('lotes').select('*').eq('numero', params.lote_numero).maybeSingle();
    if (!lote) return { error: 'Lote no encontrado' };
    const { data: stock } = await supabase
      .from('wms_stock_ubicacion')
      .select('ubicacion_codigo, cantidad')
      .eq('lote_numero', params.lote_numero);
    return { lote, ubicaciones: stock || [] };
  } catch (e: any) { return { error: e.message }; }
}

async function trazarSerial(params: any) {
  try {
    if (!params.serial) return { error: 'Falta serial' };
    const { data: serie } = await supabase
      .from('seriales').select('*').eq('numero_serie', params.serial).maybeSingle();
    if (!serie) return { error: 'Serial no encontrado' };
    return { serial: serie };
  } catch (e: any) { return { error: e.message }; }
}

// =====================================================
// APROBACIONES  (nuevas)
// =====================================================

async function aprobacionesPendientes(params: any) {
  try {
    const { data } = await supabase
      .from('aprobaciones')
      .select('numero, origen_tipo, origen_codigo, titulo, monto, moneda, prioridad, solicitado_por, fecha_solicitud')
      .eq('estado', 'pendiente')
      .order('prioridad', { ascending: false })
      .order('fecha_solicitud', { ascending: true })
      .limit(params.limite || 20);
    return {
      total: data?.length || 0,
      criticas: (data || []).filter((a: any) => a.prioridad === 'critica').length,
      aprobaciones: data || [],
    };
  } catch (e: any) { return { error: e.message }; }
}

// =====================================================
// FACTURACIÓN ELECTRÓNICA UY (CFE)
// =====================================================

async function cfeRecientes(params: any) {
  try {
    let q = supabase
      .from('cfe_uy')
      .select('tipo_cfe, serie, numero, receptor_nombre, monto_total, moneda, estado, fecha_emision')
      .order('created_at', { ascending: false }).limit(params.limite || 15);
    if (params.estado) q = q.eq('estado', params.estado);
    const { data } = await q;
    return { cfes: data || [] };
  } catch (e: any) { return { error: e.message }; }
}

// =====================================================
// NOTIFICACIONES
// =====================================================

async function notificacionesActivas(params: any) {
  try {
    const desde = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data } = await supabase
      .from('notificaciones')
      .select('tipo, severidad, titulo, mensaje, entidad_codigo, created_at')
      .eq('descartada', false)
      .gte('created_at', desde)
      .order('created_at', { ascending: false })
      .limit(params.limite || 20);
    return {
      total: data?.length || 0,
      por_severidad: contarPor(data || [], 'severidad'),
      notificaciones: data || [],
    };
  } catch (e: any) { return { error: e.message }; }
}

// =====================================================
// AUDITORÍA  (nueva)
// =====================================================

async function auditoriaRecientes(params: any) {
  try {
    let q = supabase
      .from('auditoria')
      .select('tabla, accion, codigo, usuario_email, created_at')
      .order('created_at', { ascending: false }).limit(params.limite || 30);
    if (params.usuario) q = q.eq('usuario_email', params.usuario);
    if (params.tabla) q = q.eq('tabla', params.tabla);
    const { data } = await q;
    return { eventos: data || [] };
  } catch (e: any) { return { error: e.message }; }
}

// =====================================================
// ANÁLISIS / DASHBOARDS  (existentes)
// =====================================================

async function analisisVentas(params: any) {
  try {
    const { inicio } = rangoPeriodo(params.periodo);
    const { data } = await supabase.from('ordenes_venta')
      .select('total, estado').gte('fecha_orden', inicio.toISOString());
    const total = (data || []).reduce((s, v: any) => s + safeNum(v.total), 0);
    return {
      periodo: params.periodo || 'mes',
      total_ventas: total,
      cantidad_ordenes: data?.length || 0,
      ticket_promedio: data?.length ? Math.round(total / data.length) : 0,
    };
  } catch (e: any) { return { error: e.message }; }
}

async function analisisCompras(params: any) {
  try {
    const { inicio } = rangoPeriodo(params.periodo);
    const { data } = await supabase.from('ordenes_compra')
      .select('total, estado').gte('fecha_orden', inicio.toISOString());
    return {
      periodo: params.periodo || 'mes',
      total_compras: (data || []).reduce((s, c: any) => s + safeNum(c.total), 0),
      cantidad_ordenes: data?.length || 0,
    };
  } catch (e: any) { return { error: e.message }; }
}

async function metricasDashboard(_params: any) {
  try {
    const { count: totalProductos } = await supabase
      .from('productos').select('*', { count: 'exact', head: true }).is('deleted_at', null);
    const { data: prodStock } = await supabase
      .from('productos').select('stock, stock_minimo, costo_promedio').is('deleted_at', null);
    const criticos = (prodStock || []).filter((p: any) => p.stock <= p.stock_minimo).length;
    const valorInv = (prodStock || []).reduce(
      (s, p: any) => s + safeNum(p.stock) * safeNum(p.costo_promedio), 0);
    const hace30 = new Date(); hace30.setDate(hace30.getDate() - 30);
    const { data: ventas } = await supabase
      .from('ordenes_venta').select('total').gte('fecha_orden', hace30.toISOString());
    const totalVentas = (ventas || []).reduce((s, v: any) => s + safeNum(v.total), 0);
    return {
      total_productos: totalProductos || 0,
      productos_criticos: criticos,
      valor_inventario: Math.round(valorInv),
      ventas_mes: totalVentas,
      cantidad_ventas: ventas?.length || 0,
    };
  } catch (e: any) { return { error: e.message }; }
}

async function analisisTendencias(params: any) {
  try {
    const dias = params.dias || 60;
    const fechaInicio = new Date(); fechaInicio.setDate(fechaInicio.getDate() - dias);
    const { data: movs } = await supabase
      .from('movimientos').select('producto_codigo, cantidad, created_at, codigo')
      .eq('tipo', 'salida').gte('created_at', fechaInicio.toISOString());
    const hace30 = new Date(); hace30.setDate(hace30.getDate() - 30);
    const por: Record<string, { reciente: number; anterior: number }> = {};
    (movs || []).forEach((m: any) => {
      const cod = m.producto_codigo || m.codigo; if (!cod) return;
      if (!por[cod]) por[cod] = { reciente: 0, anterior: 0 };
      const f = new Date(m.created_at);
      if (f >= hace30) por[cod].reciente += m.cantidad;
      else por[cod].anterior += m.cantidad;
    });
    const tend = Object.entries(por).map(([codigo, d]) => {
      const v = d.anterior > 0 ? ((d.reciente - d.anterior) / d.anterior) * 100 : 0;
      return {
        codigo, ventas_recientes: d.reciente,
        variacion: Math.round(v),
        tendencia: v > 20 ? 'CRECIENDO' : v < -20 ? 'DECRECIENDO' : 'ESTABLE',
      };
    }).sort((a, b) => Math.abs(b.variacion) - Math.abs(a.variacion))
      .slice(0, params.limite || 10);
    return { periodo: `${dias} días`, productos: tend };
  } catch (e: any) { return { error: e.message }; }
}

async function recomendacionesReposicion(params: any) {
  try {
    const { data: prods } = await supabase
      .from('productos').select('codigo, descripcion, stock, stock_minimo, costo_promedio')
      .is('deleted_at', null);
    const hace30 = new Date(); hace30.setDate(hace30.getDate() - 30);
    const { data: movs } = await supabase
      .from('movimientos').select('producto_codigo, codigo, cantidad')
      .eq('tipo', 'salida').gte('created_at', hace30.toISOString());
    const consumo: Record<string, number> = {};
    (movs || []).forEach((m: any) => {
      const c = m.producto_codigo || m.codigo;
      consumo[c] = (consumo[c] || 0) + m.cantidad;
    });
    const recs = (prods || []).map((p: any) => {
      const cm = consumo[p.codigo] || 0;
      const cd = cm / 30;
      const dc = cd > 0 ? p.stock / cd : 999;
      let urg: string;
      if (p.stock === 0 || dc <= 3) urg = 'CRITICA';
      else if (dc <= 7) urg = 'ALTA';
      else if (dc <= 14) urg = 'MEDIA';
      else urg = 'BAJA';
      const cant = Math.max(0, Math.ceil(cd * 30 * 1.5) - p.stock);
      return {
        codigo: p.codigo, descripcion: p.descripcion, stock: p.stock,
        dias_cobertura: Math.round(dc), urgencia: urg,
        cantidad_sugerida: cant,
        costo_estimado: cant * (p.costo_promedio || 0),
      };
    }).filter(r => r.urgencia !== 'BAJA')
      .sort((a, b) => {
        const o = { CRITICA: 0, ALTA: 1, MEDIA: 2, BAJA: 3 };
        return o[a.urgencia as keyof typeof o] - o[b.urgencia as keyof typeof o];
      })
      .slice(0, params.limite || 15);
    if (params.urgencia) {
      return { recomendaciones: recs.filter(r => r.urgencia === params.urgencia.toUpperCase()) };
    }
    return { recomendaciones: recs };
  } catch (e: any) { return { error: e.message }; }
}

// =====================================================
// BÚSQUEDA GLOBAL
// =====================================================

async function buscarGlobal(params: any) {
  try {
    const q = (params.query || '').trim();
    if (!q) return { error: 'Falta query' };
    const [prods, clis, provs, cot, ov, oc, otTaller] = await Promise.all([
      supabase.from('productos').select('codigo, descripcion').is('deleted_at', null)
        .or(`codigo.ilike.%${q}%,descripcion.ilike.%${q}%`).limit(5),
      supabase.from('clientes').select('id, codigo, nombre')
        .or(`nombre.ilike.%${q}%,codigo.ilike.%${q}%`).limit(5),
      supabase.from('proveedores').select('id, nombre').ilike('nombre', `%${q}%`).limit(5),
      supabase.from('cotizaciones').select('numero, estado').ilike('numero', `%${q}%`).limit(5),
      supabase.from('ordenes_venta').select('numero, estado').ilike('numero', `%${q}%`).limit(5),
      supabase.from('ordenes_compra').select('numero, estado').ilike('numero', `%${q}%`).limit(5),
      supabase.from('ordenes_taller').select('numero, estado').ilike('numero', `%${q}%`).limit(5),
    ]);
    return {
      productos: prods.data || [],
      clientes: clis.data || [],
      proveedores: provs.data || [],
      cotizaciones: cot.data || [],
      ordenes_venta: ov.data || [],
      ordenes_compra: oc.data || [],
      ordenes_taller: otTaller.data || [],
    };
  } catch (e: any) { return { error: e.message }; }
}

// =====================================================
// GUÍA DE LA APP
// =====================================================
// Esta tool es estática: devuelve instrucciones de
// navegación según el tema. NO consulta DB. El asistente
// la usa cuando el usuario pregunta "¿cómo hago X?" o
// "¿dónde está Y?".
// =====================================================

const RUTAS: Record<string, { ubicacion: string; pasos: string[]; tips?: string[] }> = {
  crear_producto: {
    ubicacion: 'Principal → Stock',
    pasos: [
      '1) Andá al sidebar y abrí la sección Principal.',
      '2) Click en Stock.',
      '3) Botón "Nuevo Producto" arriba a la derecha.',
      '4) Completá código, descripción, categoría, stock mínimo y precio.',
    ],
    tips: ['Configurá stock_minimo para que el sistema te alerte cuando se agote.'],
  },
  crear_cotizacion: {
    ubicacion: 'Operaciones → Comercial → Ventas → Cotizaciones',
    pasos: [
      '1) Sidebar → Operaciones → Comercial.',
      '2) Tab "Ventas".',
      '3) Sub-tab "Cotizaciones".',
      '4) Botón "Nueva cotización".',
      '5) Seleccioná cliente, agregá productos, fecha de validez.',
      '6) Guardar.',
    ],
    tips: ['Si el cliente acepta, la convertís a orden con un click ("convertir a orden").'],
  },
  convertir_cotizacion: {
    ubicacion: 'Operaciones → Comercial → Ventas → Cotizaciones',
    pasos: [
      '1) Abrí la cotización aprobada.',
      '2) Botón verde "Convertir a Orden".',
      '3) La cotización pasa a estado "convertida" y se crea la OV automáticamente.',
    ],
  },
  crear_orden_venta: {
    ubicacion: 'Operaciones → Comercial → Ventas → Órdenes',
    pasos: [
      '1) Sidebar → Operaciones → Comercial → Ventas → Órdenes.',
      '2) "Nueva orden".',
      '3) Cliente + vendedor (importante para comisiones).',
      '4) Líneas de productos, fecha de entrega.',
      '5) Confirmar — descuenta stock y genera picking en WMS automáticamente.',
    ],
  },
  crear_orden_compra: {
    ubicacion: 'Operaciones → Comercial → Compras',
    pasos: [
      '1) Sidebar → Operaciones → Comercial → Compras.',
      '2) "Nueva OC".',
      '3) Proveedor + productos + costos.',
      '4) Al pasar a "enviada", se crea automáticamente la recepción WMS.',
    ],
  },
  recibir_mercaderia: {
    ubicacion: 'Operaciones → WMS → Recepción',
    pasos: [
      '1) Sidebar → Operaciones → WMS.',
      '2) Tab "Recepción".',
      '3) Buscá la orden por número o proveedor.',
      '4) "Recibir" → marcá cantidades reales por línea.',
      '5) Confirmar — genera tareas de putaway con sugerencia de ubicación.',
    ],
    tips: ['Si la OC tiene "requiere inspección", se generan automáticamente NCs en Control de Calidad.'],
  },
  picking: {
    ubicacion: 'Operaciones → WMS → Picking',
    pasos: [
      '1) Sidebar → Operaciones → WMS → Picking.',
      '2) Asistente IA sugiere agrupar órdenes en waves.',
      '3) Asignar picker (auto-balance disponible).',
      '4) Iniciar picking — modo Scanner para escanear ubicación + producto.',
    ],
    tips: ['Activá "Scanner ON" si tenés barcode reader físico.'],
  },
  empaquetar: {
    ubicacion: 'Operaciones → WMS → Packing & Despacho',
    pasos: [
      '1) Sidebar → Operaciones → WMS → Packing.',
      '2) Lista de órdenes pickeadas listas para empaquetar.',
      '3) "Empaquetar" → peso, dimensiones, transportista, tracking.',
      '4) Imprimir etiqueta con QR.',
    ],
  },
  crear_nota_credito: {
    ubicacion: 'Operaciones → Comercial → Finanzas → Notas C/D',
    pasos: [
      '1) Sidebar → Operaciones → Comercial → Finanzas.',
      '2) Tab "Notas C/D".',
      '3) "Nueva nota" → tipo (crédito/débito), origen (cliente/proveedor), monto, motivo.',
      '4) Si supera el umbral, queda en aprobación pendiente.',
    ],
  },
  abrir_ot_taller: {
    ubicacion: 'Operaciones → Taller',
    pasos: [
      '1) Sidebar → Operaciones → Taller.',
      '2) "Nueva OT" en el header.',
      '3) Cliente + datos del equipo + problema reportado.',
      '4) Pasa al kanban.',
    ],
  },
  presupuesto_taller: {
    ubicacion: 'Operaciones → Taller → Detalle de OT',
    pasos: [
      '1) Abrí la OT en estado "diagnóstico".',
      '2) "Crear cotización".',
      '3) Agregá repuestos y mano de obra. El stock se reserva automáticamente.',
      '4) Si el cliente aprueba: pasa a "aprobado". Si rechaza: se libera la reserva.',
    ],
  },
  revisar_aprobaciones: {
    ubicacion: 'Control & Seguimiento → Aprobaciones',
    pasos: [
      '1) Sidebar → Control & Seguimiento → Aprobaciones.',
      '2) Inbox con NC/ND grandes, comisiones, ajustes de stock.',
      '3) Click en una para ver detalle + aprobar/rechazar con comentario.',
    ],
    tips: ['Configurá los umbrales en el botón "Umbrales" arriba.'],
  },
  emitir_factura_electronica: {
    ubicacion: 'Operaciones → Facturación electrónica',
    pasos: [
      '1) Si nunca configuraste el emisor, click en "Datos del emisor" primero.',
      '2) "Nuevo CFE" → seleccionar tipo (e-Ticket, e-Factura, etc).',
      '3) Receptor (RUT/CI) + líneas con IVA.',
      '4) Guardar borrador → Firmar → enviar a DGI.',
    ],
  },
  ver_kpis_negocio: {
    ubicacion: 'Principal → Dashboard',
    pasos: [
      '1) Sidebar → Principal → Dashboard.',
      '2) KPIs en vivo: ventas, compras, stock crítico, alertas, actividad reciente.',
    ],
  },
  configurar_facturacion: {
    ubicacion: 'Operaciones → Facturación electrónica → "Datos del emisor"',
    pasos: [
      '1) Click en "Datos del emisor" arriba a la derecha.',
      '2) Ingresá RUT, razón social, dirección.',
      '3) Ambiente (test/producción), serie autorizada y numeración inicial.',
      '4) Guardar.',
    ],
  },
};

async function guiaApp(params: any) {
  const tema = (params.tema || '').toLowerCase().replace(/\s+/g, '_');
  const directa = RUTAS[tema];
  if (directa) return directa;

  // Fuzzy: buscar por substring en las claves
  const claves = Object.keys(RUTAS);
  const cercana = claves.find(k => k.includes(tema) || tema.includes(k));
  if (cercana) return RUTAS[cercana];

  return {
    error: 'No tengo guía exacta para eso. Temas que conozco:',
    temas_disponibles: claves,
    sugerencia: 'Pedíme algo más específico, ej: "cómo crear una cotización", "dónde recibo mercadería", "cómo emito una factura".',
  };
}

// =====================================================
// RESUMEN "MI DÍA" — adaptado al rol
// =====================================================

async function resumenMiDia(params: any, _usuario: string) {
  try {
    const rol = (params.rol || '').toLowerCase();
    const result: any = {};

    if (['admin', 'vendedor', ''].includes(rol)) {
      const [criticos, cxc, aprob] = await Promise.all([
        productosCriticos({ limite: 5 }),
        cxcVencidas({ limite: 5 }),
        aprobacionesPendientes({ limite: 5 }),
      ]);
      result.productos_criticos = (criticos as any).total_criticos || 0;
      result.cxc_vencidas = (cxc as any).cantidad || 0;
      result.cxc_total_vencido = (cxc as any).total_vencido || 0;
      result.aprobaciones_pendientes = (aprob as any).total || 0;
    }

    if (['admin', 'bodeguero'].includes(rol) || !rol) {
      const [picking, recep, putaway] = await Promise.all([
        pickingPendiente({ limite: 5 }),
        recepcionesPendientes({ limite: 5 }),
        putawayPendiente({ limite: 5 }),
      ]);
      result.picking_pendiente = (picking as any).total || 0;
      result.picking_sin_asignar = (picking as any).sin_asignar || 0;
      result.recepciones_pendientes = (recep as any).recepciones?.length || 0;
      result.putaway_pendiente = (putaway as any).total || 0;
    }

    const notifs = await notificacionesActivas({ limite: 10 });
    result.notificaciones_activas = (notifs as any).total || 0;

    return result;
  } catch (e: any) { return { error: e.message }; }
}

// =====================================================
// ESCRITURA (existentes — preservadas)
// =====================================================

async function crearMovimiento(params: any, usuario: string) {
  try {
    const { data: producto } = await supabase
      .from('productos').select('codigo, stock').eq('codigo', params.producto_codigo).single();
    if (!producto) return { error: 'Producto no encontrado' };
    let nuevoStock = producto.stock;
    if (params.tipo === 'entrada') nuevoStock += params.cantidad;
    else if (params.tipo === 'salida') {
      if (producto.stock < params.cantidad) return { error: 'Stock insuficiente' };
      nuevoStock -= params.cantidad;
    } else nuevoStock = params.cantidad;
    await supabase.from('movimientos').insert({
      producto_codigo: params.producto_codigo, tipo: params.tipo,
      cantidad: params.cantidad, stock_anterior: producto.stock,
      stock_nuevo: nuevoStock, motivo: params.motivo || 'Movimiento vía Asistente',
      creado_por: usuario, usuario_email: usuario,
    });
    await supabase.from('productos').update({ stock: nuevoStock })
      .eq('codigo', params.producto_codigo);
    return {
      exito: true,
      mensaje: `Movimiento creado: ${params.tipo} de ${params.cantidad} unidades`,
      stock_anterior: producto.stock, stock_nuevo: nuevoStock,
    };
  } catch (e: any) { return { error: e.message }; }
}

async function crearOrdenCompra(params: any, usuario: string) {
  try {
    const { data: proveedor } = await supabase
      .from('proveedores').select('id, nombre').eq('id', params.proveedor_id).single();
    if (!proveedor) return { error: 'Proveedor no encontrado' };
    const año = new Date().getFullYear();
    const { data: ultima } = await supabase
      .from('ordenes_compra').select('numero')
      .order('created_at', { ascending: false }).limit(1).single();
    let seq = 1;
    if (ultima?.numero) {
      const m = ultima.numero.match(/OC-\d{4}-(\d+)/);
      if (m) seq = parseInt(m[1]) + 1;
    }
    const numero = `OC-${año}-${String(seq).padStart(5, '0')}`;
    const total = params.productos.reduce((s: number, p: any) => s + p.cantidad * p.precio, 0);
    const { data: orden } = await supabase
      .from('ordenes_compra').insert({
        numero, proveedor_id: params.proveedor_id, estado: 'borrador',
        total, notas: params.notas || 'Creada vía Asistente', creado_por: usuario,
      }).select().single();
    if (orden) {
      const lineas = params.productos.map((p: any) => ({
        orden_compra_id: orden.id, producto_codigo: p.codigo,
        cantidad: p.cantidad, precio_unitario: p.precio,
        subtotal: p.cantidad * p.precio,
      }));
      await supabase.from('lineas_compra').insert(lineas);
    }
    return { exito: true, numero, proveedor: proveedor.nombre, total, productos: params.productos.length };
  } catch (e: any) { return { error: e.message }; }
}

// =====================================================
// HELPERS COMUNES
// =====================================================

function contarPor(arr: any[], campo: string): Record<string, number> {
  const r: Record<string, number> = {};
  arr.forEach(x => { const k = x[campo] || 'desconocido'; r[k] = (r[k] || 0) + 1; });
  return r;
}

// =====================================================
// CONTROL DE PERMISOS POR HERRAMIENTA
// =====================================================
// Cada tool tiene un nivel mínimo de rol requerido.
// admin > vendedor > bodeguero > operador
// =====================================================

const ROLES_PERMITIDOS: Record<string, string[]> = {
  // Lectura general — todos
  consultar_stock: ['admin', 'vendedor', 'bodeguero', 'operador'],
  buscar_productos: ['admin', 'vendedor', 'bodeguero', 'operador'],
  productos_criticos: ['admin', 'vendedor', 'bodeguero', 'operador'],
  metricas_dashboard: ['admin', 'vendedor', 'bodeguero', 'operador'],
  guia_app: ['admin', 'vendedor', 'bodeguero', 'operador'],
  resumen_mi_dia: ['admin', 'vendedor', 'bodeguero', 'operador'],
  buscar_global: ['admin', 'vendedor', 'bodeguero', 'operador'],
  buscar_cliente: ['admin', 'vendedor', 'bodeguero', 'operador'],
  notificaciones_activas: ['admin', 'vendedor', 'bodeguero', 'operador'],

  // Comercial — admin + vendedor
  cotizaciones_pendientes: ['admin', 'vendedor'],
  ordenes_venta_recientes: ['admin', 'vendedor'],
  top_clientes: ['admin', 'vendedor'],
  analisis_ventas: ['admin', 'vendedor'],
  analisis_compras: ['admin', 'vendedor'],
  analisis_tendencias: ['admin', 'vendedor', 'bodeguero'],
  recomendaciones_reposicion: ['admin', 'vendedor', 'bodeguero'],

  // Compras — admin
  consultar_proveedores: ['admin', 'vendedor'],
  ordenes_compra_recientes: ['admin', 'vendedor'],

  // Finanzas — solo admin
  cxc_vencidas: ['admin', 'vendedor'],
  cxp_vencidas: ['admin'],
  notas_credito_debito: ['admin'],
  saldo_cliente: ['admin', 'vendedor'],
  cfe_recientes: ['admin'],

  // WMS — admin + bodeguero
  picking_pendiente: ['admin', 'bodeguero'],
  recepciones_pendientes: ['admin', 'bodeguero'],
  putaway_pendiente: ['admin', 'bodeguero'],
  stock_por_ubicacion: ['admin', 'bodeguero', 'vendedor'],
  paquetes_recientes: ['admin', 'bodeguero'],

  // Taller — admin + operador
  ordenes_taller_activas: ['admin', 'operador'],
  presupuestos_taller_pendientes: ['admin', 'operador'],

  // Otros
  proyectos_activos: ['admin', 'operador'],
  no_conformidades_abiertas: ['admin', 'bodeguero', 'operador'],
  certificados_proximos_vencer: ['admin'],
  rma_abiertos: ['admin', 'vendedor', 'operador'],
  trazar_lote: ['admin', 'bodeguero', 'operador'],
  trazar_serial: ['admin', 'bodeguero', 'operador'],
  aprobaciones_pendientes: ['admin'],
  auditoria_recientes: ['admin'],

  // Escritura — admin + bodeguero/vendedor según corresponda
  crear_movimiento: ['admin', 'bodeguero'],
  crear_orden_compra: ['admin'],
};

function rolPermite(herramienta: string, rol: string | undefined): boolean {
  const lista = ROLES_PERMITIDOS[herramienta];
  if (!lista) return true; // Si no está mapeada, dejar pasar (no romper)
  if (!rol) return false;
  return lista.includes(rol);
}

// =====================================================
// DISPATCHER PRINCIPAL
// =====================================================

export async function ejecutarHerramienta(
  herramienta: string,
  parametros: any,
  usuario: string,
  rol?: string
): Promise<any> {
  // Control de acceso
  if (!rolPermite(herramienta, rol)) {
    return {
      error: `Tu rol "${rol || 'desconocido'}" no tiene permisos para usar "${herramienta}".`,
      sugerencia: 'Pedile a un administrador acceso si lo necesitás.',
    };
  }

  switch (herramienta) {
    // Stock & productos
    case 'consultar_stock': return consultarStock(parametros);
    case 'buscar_productos': return buscarProductos(parametros);
    case 'productos_criticos': return productosCriticos(parametros);

    // Ventas
    case 'cotizaciones_pendientes': return cotizacionesPendientes(parametros);
    case 'ordenes_venta_recientes': return ordenesVentaRecientes(parametros);
    case 'top_clientes': return topClientes(parametros);
    case 'buscar_cliente': return buscarCliente(parametros);
    case 'analisis_ventas': return analisisVentas(parametros);

    // Finanzas
    case 'cxc_vencidas': return cxcVencidas(parametros);
    case 'cxp_vencidas': return cxpVencidas(parametros);
    case 'notas_credito_debito': return notasCreditoDebito(parametros);
    case 'saldo_cliente': return saldoCliente(parametros);
    case 'cfe_recientes': return cfeRecientes(parametros);

    // Compras
    case 'consultar_proveedores': return consultarProveedores(parametros);
    case 'ordenes_compra_recientes': return ordenesCompraRecientes(parametros);
    case 'analisis_compras': return analisisCompras(parametros);

    // WMS
    case 'picking_pendiente': return pickingPendiente(parametros);
    case 'recepciones_pendientes': return recepcionesPendientes(parametros);
    case 'putaway_pendiente': return putawayPendiente(parametros);
    case 'stock_por_ubicacion': return stockPorUbicacion(parametros);
    case 'paquetes_recientes': return paquetesRecientes(parametros);

    // Taller
    case 'ordenes_taller_activas': return ordenesTallerActivas(parametros);
    case 'presupuestos_taller_pendientes': return presupuestosTallerPendientes(parametros);

    // Proyectos / QMS / RMA
    case 'proyectos_activos': return proyectosActivos(parametros);
    case 'no_conformidades_abiertas': return noConformidadesAbiertas(parametros);
    case 'certificados_proximos_vencer': return certificadosProximosVencer(parametros);
    case 'rma_abiertos': return rmaAbiertos(parametros);

    // Trazabilidad
    case 'trazar_lote': return trazarLote(parametros);
    case 'trazar_serial': return trazarSerial(parametros);

    // Aprobaciones
    case 'aprobaciones_pendientes': return aprobacionesPendientes(parametros);

    // Notificaciones / Auditoría
    case 'notificaciones_activas': return notificacionesActivas(parametros);
    case 'auditoria_recientes': return auditoriaRecientes(parametros);

    // Análisis / Dashboard
    case 'metricas_dashboard': return metricasDashboard(parametros);
    case 'analisis_tendencias': return analisisTendencias(parametros);
    case 'recomendaciones_reposicion': return recomendacionesReposicion(parametros);

    // Búsqueda global y guía
    case 'buscar_global': return buscarGlobal(parametros);
    case 'guia_app': return guiaApp(parametros);
    case 'resumen_mi_dia': return resumenMiDia(parametros, usuario);

    // Escritura
    case 'crear_movimiento': return crearMovimiento(parametros, usuario);
    case 'crear_orden_compra': return crearOrdenCompra(parametros, usuario);

    default: return { error: `Herramienta "${herramienta}" no encontrada` };
  }
}
