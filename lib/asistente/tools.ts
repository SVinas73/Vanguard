// =====================================================
// HERRAMIENTAS DEL ASISTENTE OMNISCIENTE — SERVER ONLY
// =====================================================
// Cobertura: stock, reabastecimiento, taller, RMA,
// trazabilidad, notificaciones, auditoría + guía de
// navegación de la app.
//
// IMPORTANTE: este archivo usa SUPABASE_SERVICE_ROLE_KEY
// y nunca debe ejecutarse en el cliente. El import de
// 'server-only' tira error de build si Next.js intenta
// empaquetarlo con código de cliente.
// =====================================================

import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { registrarAuditoriaSegura } from '@/lib/security/audit-enhanced';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

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
// ANÁLISIS  (existentes)
// =====================================================

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
    const [prods, otTaller] = await Promise.all([
      supabase.from('productos').select('codigo, descripcion').is('deleted_at', null)
        .or(`codigo.ilike.%${q}%,descripcion.ilike.%${q}%`).limit(5),
      supabase.from('ordenes_taller').select('numero, estado').ilike('numero', `%${q}%`).limit(5),
    ]);
    return {
      productos: prods.data || [],
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
    ubicacion: 'Logística → Stock',
    pasos: [
      '1) Andá al sidebar y abrí la sección Logística.',
      '2) Click en Stock.',
      '3) Botón "Nuevo Producto" arriba a la derecha.',
      '4) Completá código, descripción, categoría, stock mínimo y precio.',
    ],
    tips: ['Configurá stock_minimo para que el sistema te alerte cuando se agote.'],
  },
  abrir_ot_taller: {
    ubicacion: 'Post-venta → Taller',
    pasos: [
      '1) Sidebar → Post-venta → Taller.',
      '2) "Nueva OT" en el header.',
      '3) Cliente + datos del equipo + problema reportado.',
      '4) Pasa al kanban.',
    ],
  },
  presupuesto_taller: {
    ubicacion: 'Post-venta → Taller → Detalle de OT',
    pasos: [
      '1) Abrí la OT en estado "diagnóstico".',
      '2) "Crear cotización".',
      '3) Agregá repuestos y mano de obra. El stock se reserva automáticamente.',
      '4) Si el cliente aprueba: pasa a "aprobado". Si rechaza: se libera la reserva.',
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
    sugerencia: 'Pedíme algo más específico, ej: "cómo crear un producto", "cómo abro una OT de taller".',
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
      const criticos = await productosCriticos({ limite: 5 });
      result.productos_criticos = (criticos as any).total_criticos || 0;
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
    const tipo = String(params.tipo || '');
    const cantidad = Number(params.cantidad);
    if (!['entrada', 'salida', 'ajuste'].includes(tipo)) {
      return { error: 'Tipo inválido: usá entrada, salida o ajuste' };
    }
    if (!Number.isFinite(cantidad) || cantidad < 0 || (tipo !== 'ajuste' && cantidad === 0)) {
      return { error: 'Cantidad inválida' };
    }
    const { data: producto } = await supabase
      .from('productos')
      .select('id, codigo, stock, costo_promedio, moneda')
      .eq('codigo', params.producto_codigo)
      .single();
    if (!producto) return { error: 'Producto no encontrado' };

    const stockAnterior = Number(producto.stock) || 0;
    let nuevoStock = stockAnterior;
    if (tipo === 'entrada') nuevoStock += cantidad;
    else if (tipo === 'salida') {
      if (stockAnterior < cantidad) return { error: 'Stock insuficiente' };
      nuevoStock -= cantidad;
    } else nuevoStock = cantidad;

    const motivo = params.motivo || 'Movimiento vía Asistente';
    // Columnas reales de `movimientos` (antes se usaban nombres inexistentes
    // y el insert fallaba en silencio mientras el stock sí cambiaba).
    const { error: errMov } = await supabase.from('movimientos').insert({
      producto_id: producto.id,
      codigo: producto.codigo,
      tipo,
      cantidad: tipo === 'ajuste' ? Math.abs(nuevoStock - stockAnterior) : cantidad,
      notas: tipo === 'ajuste' ? `${motivo} (stock ${stockAnterior} → ${nuevoStock})` : motivo,
      usuario_email: usuario,
    });
    if (errMov) return { error: `No se pudo registrar el movimiento: ${errMov.message}` };

    await supabase.from('productos').update({ stock: nuevoStock })
      .eq('codigo', producto.codigo);

    // Si entran unidades, lote al costo promedio vigente (valuación FIFO).
    if (nuevoStock > stockAnterior) {
      await supabase.from('lotes').insert({
        codigo: producto.codigo,
        cantidad_inicial: nuevoStock - stockAnterior,
        cantidad_disponible: nuevoStock - stockAnterior,
        costo_unitario: Number(producto.costo_promedio) || 0,
        moneda: producto.moneda || 'UYU',
        usuario,
        notas: motivo,
      });
    }

    await registrarAuditoriaSegura({
      tabla: 'movimientos',
      accion: tipo.toUpperCase(),
      codigo: producto.codigo,
      datosAnteriores: { stock_anterior: stockAnterior },
      datosNuevos: { stock_nuevo: nuevoStock, cantidad, origen: 'Asistente IA', motivo },
      usuarioEmail: usuario,
    });

    return {
      exito: true,
      mensaje: `Movimiento creado: ${tipo} de ${cantidad} unidades`,
      stock_anterior: stockAnterior, stock_nuevo: nuevoStock,
    };
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
  guia_app: ['admin', 'vendedor', 'bodeguero', 'operador'],
  resumen_mi_dia: ['admin', 'vendedor', 'bodeguero', 'operador'],
  buscar_global: ['admin', 'vendedor', 'bodeguero', 'operador'],
  notificaciones_activas: ['admin', 'vendedor', 'bodeguero', 'operador'],

  // Análisis de stock
  analisis_tendencias: ['admin', 'vendedor', 'bodeguero'],
  recomendaciones_reposicion: ['admin', 'vendedor', 'bodeguero'],

  // Taller — admin + operador
  ordenes_taller_activas: ['admin', 'operador'],
  presupuestos_taller_pendientes: ['admin', 'operador'],

  // Otros
  rma_abiertos: ['admin', 'vendedor', 'operador'],
  trazar_lote: ['admin', 'bodeguero', 'operador'],
  trazar_serial: ['admin', 'bodeguero', 'operador'],
  auditoria_recientes: ['admin'],

  // Escritura — admin + bodeguero
  crear_movimiento: ['admin', 'bodeguero'],
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

    // Taller
    case 'ordenes_taller_activas': return ordenesTallerActivas(parametros);
    case 'presupuestos_taller_pendientes': return presupuestosTallerPendientes(parametros);

    // RMA
    case 'rma_abiertos': return rmaAbiertos(parametros);

    // Trazabilidad
    case 'trazar_lote': return trazarLote(parametros);
    case 'trazar_serial': return trazarSerial(parametros);

    // Notificaciones / Auditoría
    case 'notificaciones_activas': return notificacionesActivas(parametros);
    case 'auditoria_recientes': return auditoriaRecientes(parametros);

    // Análisis
    case 'analisis_tendencias': return analisisTendencias(parametros);
    case 'recomendaciones_reposicion': return recomendacionesReposicion(parametros);

    // Búsqueda global y guía
    case 'buscar_global': return buscarGlobal(parametros);
    case 'guia_app': return guiaApp(parametros);
    case 'resumen_mi_dia': return resumenMiDia(parametros, usuario);

    // Escritura
    case 'crear_movimiento': return crearMovimiento(parametros, usuario);

    default: return { error: `Herramienta "${herramienta}" no encontrada` };
  }
}
