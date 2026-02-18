// ============================================
// HERRAMIENTAS LITE - Sin LangChain
// ============================================

import { createClient } from '@supabase/supabase-js';

// Cliente Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// CONSULTAR STOCK
// ============================================

async function consultarStock(params: any) {
  try {
    let query = supabase
      .from('productos')
      .select('codigo, descripcion, stock, stock_minimo, categoria, precio, costo_promedio')
      .is('deleted_at', null);

    if (params.codigo) {
      query = query.eq('codigo', params.codigo);
    }
    if (params.categoria) {
      query = query.ilike('categoria', `%${params.categoria}%`);
    }

    const { data, error } = await query.limit(30);
    if (error) throw error;

    let productos = data || [];
    
    if (params.solo_criticos) {
      productos = productos.filter(p => p.stock <= p.stock_minimo);
    }

    return {
      total: productos.length,
      criticos: productos.filter(p => p.stock <= p.stock_minimo).length,
      productos: productos.slice(0, 15).map(p => ({
        codigo: p.codigo,
        descripcion: p.descripcion,
        stock: p.stock,
        stock_minimo: p.stock_minimo,
        estado: p.stock === 0 ? 'AGOTADO' : p.stock <= p.stock_minimo ? 'CRÍTICO' : 'OK',
      })),
    };
  } catch (error: any) {
    return { error: error.message };
  }
}

// ============================================
// BUSCAR PRODUCTOS
// ============================================

async function buscarProductos(params: any) {
  try {
    const { data, error } = await supabase
      .from('productos')
      .select('codigo, descripcion, stock, categoria, precio')
      .is('deleted_at', null)
      .or(`codigo.ilike.%${params.query}%,descripcion.ilike.%${params.query}%`)
      .limit(params.limite || 15);

    if (error) throw error;

    return {
      encontrados: data?.length || 0,
      productos: data || [],
    };
  } catch (error: any) {
    return { error: error.message };
  }
}

// ============================================
// PRODUCTOS CRÍTICOS
// ============================================

async function productosCriticos(params: any) {
  try {
    const { data, error } = await supabase
      .from('productos')
      .select('codigo, descripcion, stock, stock_minimo, categoria')
      .is('deleted_at', null)
      .order('stock', { ascending: true })
      .limit(50);

    if (error) throw error;

    const criticos = (data || []).filter(p => p.stock <= p.stock_minimo);

    return {
      total_criticos: criticos.length,
      agotados: criticos.filter(p => p.stock === 0).length,
      productos: criticos.slice(0, params.limite || 15).map(p => ({
        codigo: p.codigo,
        descripcion: p.descripcion,
        stock: p.stock,
        stock_minimo: p.stock_minimo,
        faltante: Math.max(0, p.stock_minimo - p.stock),
      })),
    };
  } catch (error: any) {
    return { error: error.message };
  }
}

// ============================================
// ANÁLISIS DE VENTAS
// ============================================

async function analisisVentas(params: any) {
  try {
    const hoy = new Date();
    let fechaInicio = new Date();

    switch (params.periodo) {
      case 'hoy': fechaInicio.setHours(0, 0, 0, 0); break;
      case 'semana': fechaInicio.setDate(hoy.getDate() - 7); break;
      case 'año': fechaInicio.setFullYear(hoy.getFullYear() - 1); break;
      default: fechaInicio.setMonth(hoy.getMonth() - 1);
    }

    const { data: ventas, error } = await supabase
      .from('ordenes_venta')
      .select('total, estado')
      .gte('created_at', fechaInicio.toISOString());

    if (error) throw error;

    const totalVentas = (ventas || []).reduce((sum, v) => sum + (v.total || 0), 0);

    return {
      periodo: params.periodo || 'mes',
      total_ventas: totalVentas,
      cantidad_ordenes: ventas?.length || 0,
      ticket_promedio: ventas?.length ? Math.round(totalVentas / ventas.length) : 0,
    };
  } catch (error: any) {
    return { error: error.message };
  }
}

// ============================================
// ANÁLISIS DE COMPRAS
// ============================================

async function analisisCompras(params: any) {
  try {
    const hoy = new Date();
    let fechaInicio = new Date();

    switch (params.periodo) {
      case 'hoy': fechaInicio.setHours(0, 0, 0, 0); break;
      case 'semana': fechaInicio.setDate(hoy.getDate() - 7); break;
      case 'año': fechaInicio.setFullYear(hoy.getFullYear() - 1); break;
      default: fechaInicio.setMonth(hoy.getMonth() - 1);
    }

    const { data: compras, error } = await supabase
      .from('ordenes_compra')
      .select('total, estado')
      .gte('created_at', fechaInicio.toISOString());

    if (error) throw error;

    const totalCompras = (compras || []).reduce((sum, c) => sum + (c.total || 0), 0);

    return {
      periodo: params.periodo || 'mes',
      total_compras: totalCompras,
      cantidad_ordenes: compras?.length || 0,
    };
  } catch (error: any) {
    return { error: error.message };
  }
}

// ============================================
// MÉTRICAS DASHBOARD
// ============================================

async function metricasDashboard(params: any) {
  try {
    // Total productos
    const { count: totalProductos } = await supabase
      .from('productos')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);

    // Productos críticos
    const { data: productosStock } = await supabase
      .from('productos')
      .select('stock, stock_minimo, costo_promedio')
      .is('deleted_at', null);

    const criticos = (productosStock || []).filter(p => p.stock <= p.stock_minimo).length;
    const valorInventario = (productosStock || []).reduce(
      (sum, p) => sum + (p.stock || 0) * (p.costo_promedio || 0), 0
    );

    // Ventas del mes
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);

    const { data: ventas } = await supabase
      .from('ordenes_venta')
      .select('total')
      .gte('created_at', hace30Dias.toISOString());

    const totalVentas = (ventas || []).reduce((sum, v) => sum + (v.total || 0), 0);

    return {
      total_productos: totalProductos || 0,
      productos_criticos: criticos,
      valor_inventario: Math.round(valorInventario),
      ventas_mes: totalVentas,
      cantidad_ventas: ventas?.length || 0,
    };
  } catch (error: any) {
    return { error: error.message };
  }
}

// ============================================
// ANÁLISIS TENDENCIAS
// ============================================

async function analisisTendencias(params: any) {
  try {
    const dias = params.dias || 60;
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - dias);

    const { data: movimientos } = await supabase
      .from('movimientos')
      .select('producto_codigo, cantidad, created_at')
      .eq('tipo', 'salida')
      .gte('created_at', fechaInicio.toISOString());

    const hace30 = new Date();
    hace30.setDate(hace30.getDate() - 30);

    const porProducto: Record<string, { reciente: number; anterior: number }> = {};

    (movimientos || []).forEach(m => {
      const fecha = new Date(m.created_at);
      if (!porProducto[m.producto_codigo]) {
        porProducto[m.producto_codigo] = { reciente: 0, anterior: 0 };
      }
      if (fecha >= hace30) {
        porProducto[m.producto_codigo].reciente += m.cantidad;
      } else {
        porProducto[m.producto_codigo].anterior += m.cantidad;
      }
    });

    const tendencias = Object.entries(porProducto)
      .map(([codigo, data]) => {
        const variacion = data.anterior > 0 
          ? ((data.reciente - data.anterior) / data.anterior) * 100 
          : 0;
        return {
          codigo,
          ventas_recientes: data.reciente,
          variacion: Math.round(variacion),
          tendencia: variacion > 20 ? 'CRECIENDO' : variacion < -20 ? 'DECRECIENDO' : 'ESTABLE',
        };
      })
      .sort((a, b) => Math.abs(b.variacion) - Math.abs(a.variacion))
      .slice(0, params.limite || 10);

    return {
      periodo: `${dias} días`,
      productos: tendencias,
    };
  } catch (error: any) {
    return { error: error.message };
  }
}

// ============================================
// RECOMENDACIONES REPOSICIÓN
// ============================================

async function recomendacionesReposicion(params: any) {
  try {
    const { data: productos } = await supabase
      .from('productos')
      .select('codigo, descripcion, stock, stock_minimo, costo_promedio')
      .is('deleted_at', null);

    // Consumo últimos 30 días
    const hace30 = new Date();
    hace30.setDate(hace30.getDate() - 30);

    const { data: movimientos } = await supabase
      .from('movimientos')
      .select('producto_codigo, cantidad')
      .eq('tipo', 'salida')
      .gte('created_at', hace30.toISOString());

    const consumo: Record<string, number> = {};
    (movimientos || []).forEach(m => {
      consumo[m.producto_codigo] = (consumo[m.producto_codigo] || 0) + m.cantidad;
    });

    const recomendaciones = (productos || [])
      .map(p => {
        const consumoMes = consumo[p.codigo] || 0;
        const consumoDiario = consumoMes / 30;
        const diasCobertura = consumoDiario > 0 ? p.stock / consumoDiario : 999;
        
        let urgencia: string;
        if (p.stock === 0 || diasCobertura <= 3) urgencia = 'CRITICA';
        else if (diasCobertura <= 7) urgencia = 'ALTA';
        else if (diasCobertura <= 14) urgencia = 'MEDIA';
        else urgencia = 'BAJA';

        const cantidadSugerida = Math.max(0, Math.ceil(consumoDiario * 30 * 1.5) - p.stock);

        return {
          codigo: p.codigo,
          descripcion: p.descripcion,
          stock: p.stock,
          dias_cobertura: Math.round(diasCobertura),
          urgencia,
          cantidad_sugerida: cantidadSugerida,
          costo_estimado: cantidadSugerida * (p.costo_promedio || 0),
        };
      })
      .filter(r => r.urgencia !== 'BAJA')
      .sort((a, b) => {
        const orden = { CRITICA: 0, ALTA: 1, MEDIA: 2, BAJA: 3 };
        return (orden[a.urgencia as keyof typeof orden] || 3) - (orden[b.urgencia as keyof typeof orden] || 3);
      })
      .slice(0, params.limite || 15);

    if (params.urgencia) {
      return {
        recomendaciones: recomendaciones.filter(r => r.urgencia === params.urgencia.toUpperCase()),
      };
    }

    return { recomendaciones };
  } catch (error: any) {
    return { error: error.message };
  }
}

// ============================================
// CONSULTAR PROVEEDORES
// ============================================

async function consultarProveedores(params: any) {
  try {
    let query = supabase
      .from('proveedores')
      .select('id, nombre, email, telefono')
      .is('deleted_at', null);

    if (params.query) {
      query = query.ilike('nombre', `%${params.query}%`);
    }

    const { data, error } = await query.limit(params.limite || 10);
    if (error) throw error;

    return {
      total: data?.length || 0,
      proveedores: data || [],
    };
  } catch (error: any) {
    return { error: error.message };
  }
}

// ============================================
// CREAR MOVIMIENTO
// ============================================

async function crearMovimiento(params: any, usuario: string) {
  try {
    const { data: producto } = await supabase
      .from('productos')
      .select('codigo, stock')
      .eq('codigo', params.producto_codigo)
      .single();

    if (!producto) return { error: 'Producto no encontrado' };

    let nuevoStock = producto.stock;
    if (params.tipo === 'entrada') nuevoStock += params.cantidad;
    else if (params.tipo === 'salida') {
      if (producto.stock < params.cantidad) return { error: 'Stock insuficiente' };
      nuevoStock -= params.cantidad;
    } else {
      nuevoStock = params.cantidad;
    }

    await supabase.from('movimientos').insert({
      producto_codigo: params.producto_codigo,
      tipo: params.tipo,
      cantidad: params.cantidad,
      stock_anterior: producto.stock,
      stock_nuevo: nuevoStock,
      motivo: params.motivo || 'Movimiento vía Asistente',
      creado_por: usuario,
    });

    await supabase
      .from('productos')
      .update({ stock: nuevoStock })
      .eq('codigo', params.producto_codigo);

    return {
      exito: true,
      mensaje: `Movimiento creado: ${params.tipo} de ${params.cantidad} unidades`,
      stock_anterior: producto.stock,
      stock_nuevo: nuevoStock,
    };
  } catch (error: any) {
    return { error: error.message };
  }
}

// ============================================
// CREAR ORDEN COMPRA
// ============================================

async function crearOrdenCompra(params: any, usuario: string) {
  try {
    const { data: proveedor } = await supabase
      .from('proveedores')
      .select('id, nombre')
      .eq('id', params.proveedor_id)
      .single();

    if (!proveedor) return { error: 'Proveedor no encontrado' };

    const año = new Date().getFullYear();
    const { data: ultima } = await supabase
      .from('ordenes_compra')
      .select('numero')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let seq = 1;
    if (ultima?.numero) {
      const match = ultima.numero.match(/OC-\d{4}-(\d+)/);
      if (match) seq = parseInt(match[1]) + 1;
    }
    const numero = `OC-${año}-${String(seq).padStart(5, '0')}`;

    const total = params.productos.reduce((s: number, p: any) => s + p.cantidad * p.precio, 0);

    const { data: orden } = await supabase
      .from('ordenes_compra')
      .insert({
        numero,
        proveedor_id: params.proveedor_id,
        estado: 'borrador',
        total,
        notas: params.notas || 'Creada vía Asistente',
        creado_por: usuario,
      })
      .select()
      .single();

    if (orden) {
      const lineas = params.productos.map((p: any) => ({
        orden_compra_id: orden.id,
        producto_codigo: p.codigo,
        cantidad: p.cantidad,
        precio_unitario: p.precio,
        subtotal: p.cantidad * p.precio,
      }));
      await supabase.from('lineas_compra').insert(lineas);
    }

    return {
      exito: true,
      numero,
      proveedor: proveedor.nombre,
      total,
      productos: params.productos.length,
    };
  } catch (error: any) {
    return { error: error.message };
  }
}

// ============================================
// DISPATCHER
// ============================================

export async function ejecutarHerramienta(
  herramienta: string,
  parametros: any,
  usuario: string
): Promise<any> {
  switch (herramienta) {
    case 'consultar_stock': return consultarStock(parametros);
    case 'buscar_productos': return buscarProductos(parametros);
    case 'productos_criticos': return productosCriticos(parametros);
    case 'analisis_ventas': return analisisVentas(parametros);
    case 'analisis_compras': return analisisCompras(parametros);
    case 'metricas_dashboard': return metricasDashboard(parametros);
    case 'analisis_tendencias': return analisisTendencias(parametros);
    case 'recomendaciones_reposicion': return recomendacionesReposicion(parametros);
    case 'consultar_proveedores': return consultarProveedores(parametros);
    case 'crear_movimiento': return crearMovimiento(parametros, usuario);
    case 'crear_orden_compra': return crearOrdenCompra(parametros, usuario);
    default: return { error: `Herramienta "${herramienta}" no encontrada` };
  }
}