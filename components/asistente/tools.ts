// ============================================
// ASISTENTE IA - HERRAMIENTAS (TOOLS)
// Funciones que el asistente puede ejecutar
// ============================================

import { supabase } from '@/lib/supabase';

const VANGUARD_IA_URL = process.env.NEXT_PUBLIC_VANGUARD_IA_URL || 'https://vanguard-ia.onrender.com';

// ============================================
// CONSULTAS DE STOCK
// ============================================

export async function consultarStock(params: {
  codigo?: string;
  categoria?: string;
  solo_criticos?: boolean;
}) {
  try {
    let query = supabase
      .from('productos')
      .select('codigo, descripcion, stock, stock_minimo, categoria, precio, costo_promedio')
      .is('deleted_at', null);

    if (params.codigo) {
      query = query.eq('codigo', params.codigo);
    }

    if (params.categoria) {
      query = query.eq('categoria', params.categoria);
    }

    if (params.solo_criticos) {
      query = query.lte('stock', supabase.rpc('stock_minimo'));
      // Alternativa simple:
      // Filtramos después
    }

    const { data, error } = await query.limit(50);

    if (error) throw error;

    let productos = data || [];

    // Filtrar críticos si se solicitó
    if (params.solo_criticos) {
      productos = productos.filter(p => p.stock <= p.stock_minimo);
    }

    return {
      success: true,
      total: productos.length,
      productos: productos.map(p => ({
        codigo: p.codigo,
        descripcion: p.descripcion,
        stock: p.stock,
        stock_minimo: p.stock_minimo,
        estado: p.stock === 0 ? 'AGOTADO' : p.stock <= p.stock_minimo ? 'CRÍTICO' : 'OK',
        categoria: p.categoria,
        valor_inventario: (p.stock || 0) * (p.costo_promedio || 0),
      })),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function consultarProducto(params: { codigo: string }) {
  try {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .eq('codigo', params.codigo)
      .single();

    if (error) throw error;

    // Obtener movimientos recientes
    const { data: movimientos } = await supabase
      .from('movimientos')
      .select('tipo, cantidad, created_at, motivo')
      .eq('producto_codigo', params.codigo)
      .order('created_at', { ascending: false })
      .limit(10);

    return {
      success: true,
      producto: {
        ...data,
        estado: data.stock === 0 ? 'AGOTADO' : data.stock <= data.stock_minimo ? 'CRÍTICO' : 'OK',
        valor_inventario: (data.stock || 0) * (data.costo_promedio || 0),
      },
      movimientos_recientes: movimientos || [],
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function buscarProductos(params: { query: string; limite?: number }) {
  try {
    const { data, error } = await supabase
      .from('productos')
      .select('codigo, descripcion, stock, categoria, precio')
      .is('deleted_at', null)
      .or(`codigo.ilike.%${params.query}%,descripcion.ilike.%${params.query}%`)
      .limit(params.limite || 20);

    if (error) throw error;

    return {
      success: true,
      total: data?.length || 0,
      productos: data || [],
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function productosCriticos(params: { limite?: number }) {
  try {
    const { data, error } = await supabase
      .from('productos')
      .select('codigo, descripcion, stock, stock_minimo, categoria')
      .is('deleted_at', null)
      .order('stock', { ascending: true })
      .limit(params.limite || 20);

    if (error) throw error;

    const criticos = (data || []).filter(p => p.stock <= p.stock_minimo);

    return {
      success: true,
      total: criticos.length,
      productos: criticos.map(p => ({
        codigo: p.codigo,
        descripcion: p.descripcion,
        stock: p.stock,
        stock_minimo: p.stock_minimo,
        faltante: Math.max(0, p.stock_minimo - p.stock),
        estado: p.stock === 0 ? 'AGOTADO' : 'CRÍTICO',
      })),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================
// CONSULTAS DE ÓRDENES
// ============================================

export async function consultarOrdenes(params: {
  tipo: 'compra' | 'venta';
  estado?: string;
  limite?: number;
}) {
  try {
    const tabla = params.tipo === 'compra' ? 'ordenes_compra' : 'ordenes_venta';
    
    let query = supabase
      .from(tabla)
      .select('*')
      .order('created_at', { ascending: false });

    if (params.estado) {
      query = query.eq('estado', params.estado);
    }

    const { data, error } = await query.limit(params.limite || 20);

    if (error) throw error;

    return {
      success: true,
      tipo: params.tipo,
      total: data?.length || 0,
      ordenes: data || [],
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function consultarClientes(params: { query?: string; limite?: number }) {
  try {
    let queryBuilder = supabase
      .from('clientes')
      .select('id, nombre, rut, email, telefono, direccion')
      .is('deleted_at', null);

    if (params.query) {
      queryBuilder = queryBuilder.or(`nombre.ilike.%${params.query}%,rut.ilike.%${params.query}%`);
    }

    const { data, error } = await queryBuilder.limit(params.limite || 20);

    if (error) throw error;

    return {
      success: true,
      total: data?.length || 0,
      clientes: data || [],
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function consultarProveedores(params: { query?: string; limite?: number }) {
  try {
    let queryBuilder = supabase
      .from('proveedores')
      .select('id, nombre, rut, email, telefono, direccion')
      .is('deleted_at', null);

    if (params.query) {
      queryBuilder = queryBuilder.or(`nombre.ilike.%${params.query}%`);
    }

    const { data, error } = await queryBuilder.limit(params.limite || 20);

    if (error) throw error;

    return {
      success: true,
      total: data?.length || 0,
      proveedores: data || [],
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================
// MÉTRICAS Y DASHBOARD
// ============================================

export async function metricasDashboard(params: { periodo?: string }) {
  try {
    const hoy = new Date();
    let fechaInicio = new Date();

    switch (params.periodo) {
      case 'hoy':
        fechaInicio.setHours(0, 0, 0, 0);
        break;
      case 'semana':
        fechaInicio.setDate(hoy.getDate() - 7);
        break;
      case 'año':
        fechaInicio.setFullYear(hoy.getFullYear() - 1);
        break;
      case 'mes':
      default:
        fechaInicio.setMonth(hoy.getMonth() - 1);
    }

    // Total productos
    const { count: totalProductos } = await supabase
      .from('productos')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);

    // Productos críticos
    const { data: productosCrit } = await supabase
      .from('productos')
      .select('stock, stock_minimo')
      .is('deleted_at', null);
    
    const criticos = (productosCrit || []).filter(p => p.stock <= p.stock_minimo).length;

    // Ventas del período
    const { data: ventas } = await supabase
      .from('ordenes_venta')
      .select('total')
      .gte('created_at', fechaInicio.toISOString());

    const totalVentas = (ventas || []).reduce((sum, v) => sum + (v.total || 0), 0);

    // Compras del período
    const { data: compras } = await supabase
      .from('ordenes_compra')
      .select('total')
      .gte('created_at', fechaInicio.toISOString());

    const totalCompras = (compras || []).reduce((sum, c) => sum + (c.total || 0), 0);

    // Valor del inventario
    const { data: inventario } = await supabase
      .from('productos')
      .select('stock, costo_promedio')
      .is('deleted_at', null);

    const valorInventario = (inventario || []).reduce(
      (sum, p) => sum + (p.stock || 0) * (p.costo_promedio || 0), 
      0
    );

    return {
      success: true,
      periodo: params.periodo || 'mes',
      metricas: {
        total_productos: totalProductos || 0,
        productos_criticos: criticos,
        total_ventas: totalVentas,
        total_compras: totalCompras,
        valor_inventario: valorInventario,
        margen_bruto: totalVentas - totalCompras,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================
// ANÁLISIS (Usando API de Render)
// ============================================

export async function prediccionDemanda(params: { codigo: string; dias?: number }) {
  try {
    // Primero verificar que el producto existe
    const { data: producto } = await supabase
      .from('productos')
      .select('codigo, descripcion, stock')
      .eq('codigo', params.codigo)
      .single();

    if (!producto) {
      return { success: false, error: 'Producto no encontrado' };
    }

    // Obtener movimientos para la predicción
    const { data: movimientos } = await supabase
      .from('movimientos')
      .select('tipo, cantidad, created_at')
      .eq('producto_codigo', params.codigo)
      .order('created_at', { ascending: false })
      .limit(365);

    // Llamar a la API de Render
    try {
      const response = await fetch(`${VANGUARD_IA_URL}/api/predictions/stock-depletion/${params.codigo}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock_actual: producto.stock,
          movimientos: movimientos || [],
        }),
      });

      if (response.ok) {
        const prediccion = await response.json();
        return {
          success: true,
          producto: producto.descripcion,
          prediccion: {
            dias_hasta_agotamiento: prediccion.dias_hasta_agotamiento,
            consumo_diario_estimado: prediccion.consumo_diario,
            confianza: prediccion.confianza,
            modelo: prediccion.modelo || 'Holt-Winters',
          },
        };
      }
    } catch (apiError) {
      // Fallback a cálculo local
    }

    // Cálculo local si la API falla
    const salidas = (movimientos || [])
      .filter(m => m.tipo === 'salida')
      .reduce((sum, m) => sum + m.cantidad, 0);
    
    const diasHistorico = 30;
    const consumoDiario = salidas / diasHistorico;
    const diasHastaAgotamiento = consumoDiario > 0 ? Math.floor(producto.stock / consumoDiario) : null;

    return {
      success: true,
      producto: producto.descripcion,
      prediccion: {
        dias_hasta_agotamiento: diasHastaAgotamiento,
        consumo_diario_estimado: Math.round(consumoDiario * 100) / 100,
        confianza: 0.7,
        modelo: 'Promedio Simple (fallback)',
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function analisisVentas(params: {
  periodo?: string;
  producto_codigo?: string;
  cliente_id?: string;
}) {
  try {
    const hoy = new Date();
    let fechaInicio = new Date();

    switch (params.periodo) {
      case 'hoy':
        fechaInicio.setHours(0, 0, 0, 0);
        break;
      case 'semana':
        fechaInicio.setDate(hoy.getDate() - 7);
        break;
      case 'año':
        fechaInicio.setFullYear(hoy.getFullYear() - 1);
        break;
      case 'mes':
      default:
        fechaInicio.setMonth(hoy.getMonth() - 1);
    }

    let query = supabase
      .from('ordenes_venta')
      .select('*, lineas_venta(*)')
      .gte('created_at', fechaInicio.toISOString());

    if (params.cliente_id) {
      query = query.eq('cliente_id', params.cliente_id);
    }

    const { data: ventas, error } = await query;

    if (error) throw error;

    const totalVentas = (ventas || []).reduce((sum, v) => sum + (v.total || 0), 0);
    const cantidadOrdenes = ventas?.length || 0;
    const ticketPromedio = cantidadOrdenes > 0 ? totalVentas / cantidadOrdenes : 0;

    // Top productos vendidos
    const productosVendidos: Record<string, { cantidad: number; total: number }> = {};
    (ventas || []).forEach(v => {
      (v.lineas_venta || []).forEach((l: any) => {
        if (!productosVendidos[l.producto_codigo]) {
          productosVendidos[l.producto_codigo] = { cantidad: 0, total: 0 };
        }
        productosVendidos[l.producto_codigo].cantidad += l.cantidad;
        productosVendidos[l.producto_codigo].total += l.subtotal || 0;
      });
    });

    const topProductos = Object.entries(productosVendidos)
      .map(([codigo, data]) => ({ codigo, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return {
      success: true,
      periodo: params.periodo || 'mes',
      analisis: {
        total_ventas: totalVentas,
        cantidad_ordenes: cantidadOrdenes,
        ticket_promedio: Math.round(ticketPromedio * 100) / 100,
        top_productos: topProductos,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function analisisCompras(params: {
  periodo?: string;
  proveedor_id?: string;
}) {
  try {
    const hoy = new Date();
    let fechaInicio = new Date();

    switch (params.periodo) {
      case 'hoy':
        fechaInicio.setHours(0, 0, 0, 0);
        break;
      case 'semana':
        fechaInicio.setDate(hoy.getDate() - 7);
        break;
      case 'año':
        fechaInicio.setFullYear(hoy.getFullYear() - 1);
        break;
      case 'mes':
      default:
        fechaInicio.setMonth(hoy.getMonth() - 1);
    }

    let query = supabase
      .from('ordenes_compra')
      .select('*')
      .gte('created_at', fechaInicio.toISOString());

    if (params.proveedor_id) {
      query = query.eq('proveedor_id', params.proveedor_id);
    }

    const { data: compras, error } = await query;

    if (error) throw error;

    const totalCompras = (compras || []).reduce((sum, c) => sum + (c.total || 0), 0);
    const cantidadOrdenes = compras?.length || 0;

    // Por estado
    const porEstado: Record<string, number> = {};
    (compras || []).forEach(c => {
      porEstado[c.estado] = (porEstado[c.estado] || 0) + 1;
    });

    return {
      success: true,
      periodo: params.periodo || 'mes',
      analisis: {
        total_compras: totalCompras,
        cantidad_ordenes: cantidadOrdenes,
        por_estado: porEstado,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function analisisTendencias(params: { categoria?: string; limite?: number }) {
  try {
    // Obtener movimientos de los últimos 90 días
    const hace90Dias = new Date();
    hace90Dias.setDate(hace90Dias.getDate() - 90);

    const { data: movimientos } = await supabase
      .from('movimientos')
      .select('producto_codigo, tipo, cantidad, created_at')
      .eq('tipo', 'salida')
      .gte('created_at', hace90Dias.toISOString());

    // Agrupar por producto y calcular tendencias
    const porProducto: Record<string, { 
      ultimos_30: number; 
      anteriores_30: number;
      hace_60_90: number;
    }> = {};

    const hoy = new Date();
    const hace30 = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);
    const hace60 = new Date(hoy.getTime() - 60 * 24 * 60 * 60 * 1000);

    (movimientos || []).forEach(m => {
      const fecha = new Date(m.created_at);
      if (!porProducto[m.producto_codigo]) {
        porProducto[m.producto_codigo] = { ultimos_30: 0, anteriores_30: 0, hace_60_90: 0 };
      }

      if (fecha >= hace30) {
        porProducto[m.producto_codigo].ultimos_30 += m.cantidad;
      } else if (fecha >= hace60) {
        porProducto[m.producto_codigo].anteriores_30 += m.cantidad;
      } else {
        porProducto[m.producto_codigo].hace_60_90 += m.cantidad;
      }
    });

    // Calcular tendencia
    const tendencias = Object.entries(porProducto).map(([codigo, data]) => {
      const variacion = data.anteriores_30 > 0 
        ? ((data.ultimos_30 - data.anteriores_30) / data.anteriores_30) * 100 
        : 0;

      let tendencia: 'creciendo' | 'estable' | 'decreciendo';
      if (variacion > 15) tendencia = 'creciendo';
      else if (variacion < -15) tendencia = 'decreciendo';
      else tendencia = 'estable';

      return {
        codigo,
        ventas_ultimos_30: data.ultimos_30,
        ventas_anteriores_30: data.anteriores_30,
        variacion_porcentual: Math.round(variacion * 10) / 10,
        tendencia,
      };
    });

    // Ordenar por variación y limitar
    const ordenadas = tendencias
      .sort((a, b) => Math.abs(b.variacion_porcentual) - Math.abs(a.variacion_porcentual))
      .slice(0, params.limite || 20);

    return {
      success: true,
      total: ordenadas.length,
      resumen: {
        creciendo: tendencias.filter(t => t.tendencia === 'creciendo').length,
        estable: tendencias.filter(t => t.tendencia === 'estable').length,
        decreciendo: tendencias.filter(t => t.tendencia === 'decreciendo').length,
      },
      productos: ordenadas,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function recomendacionesReposicion(params: { urgencia?: string; limite?: number }) {
  try {
    // Obtener productos con stock bajo
    const { data: productos } = await supabase
      .from('productos')
      .select('codigo, descripcion, stock, stock_minimo, costo_promedio')
      .is('deleted_at', null);

    // Obtener consumo promedio (últimos 30 días)
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);

    const { data: movimientos } = await supabase
      .from('movimientos')
      .select('producto_codigo, cantidad')
      .eq('tipo', 'salida')
      .gte('created_at', hace30Dias.toISOString());

    const consumoPorProducto: Record<string, number> = {};
    (movimientos || []).forEach(m => {
      consumoPorProducto[m.producto_codigo] = (consumoPorProducto[m.producto_codigo] || 0) + m.cantidad;
    });

    // Calcular recomendaciones
    const recomendaciones = (productos || [])
      .map(p => {
        const consumoMensual = consumoPorProducto[p.codigo] || 0;
        const consumoDiario = consumoMensual / 30;
        const diasCobertura = consumoDiario > 0 ? p.stock / consumoDiario : 999;
        
        let urgencia: 'critica' | 'alta' | 'media' | 'baja';
        if (p.stock === 0 || diasCobertura <= 3) urgencia = 'critica';
        else if (diasCobertura <= 7) urgencia = 'alta';
        else if (diasCobertura <= 14) urgencia = 'media';
        else urgencia = 'baja';

        // Cantidad sugerida: cubrir 30 días + safety stock
        const cantidadSugerida = Math.max(
          0,
          Math.ceil(consumoDiario * 30 * 1.5) - p.stock
        );

        return {
          codigo: p.codigo,
          descripcion: p.descripcion,
          stock_actual: p.stock,
          stock_minimo: p.stock_minimo,
          consumo_diario: Math.round(consumoDiario * 10) / 10,
          dias_cobertura: Math.round(diasCobertura),
          urgencia,
          cantidad_sugerida: cantidadSugerida,
          costo_estimado: cantidadSugerida * (p.costo_promedio || 0),
        };
      })
      .filter(r => r.urgencia !== 'baja' || r.stock_actual <= r.stock_minimo);

    // Filtrar por urgencia si se especificó
    let filtradas = recomendaciones;
    if (params.urgencia) {
      filtradas = recomendaciones.filter(r => r.urgencia === params.urgencia);
    }

    // Ordenar por urgencia y limitar
    const ordenUrgencia = { critica: 0, alta: 1, media: 2, baja: 3 };
    filtradas.sort((a, b) => ordenUrgencia[a.urgencia] - ordenUrgencia[b.urgencia]);
    filtradas = filtradas.slice(0, params.limite || 20);

    const costoTotal = filtradas.reduce((sum, r) => sum + r.costo_estimado, 0);

    return {
      success: true,
      total: filtradas.length,
      costo_total_estimado: Math.round(costoTotal * 100) / 100,
      recomendaciones: filtradas,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================
// ACCIONES
// ============================================

export async function crearMovimiento(params: {
  producto_codigo: string;
  tipo: 'entrada' | 'salida' | 'ajuste';
  cantidad: number;
  motivo?: string;
}, usuario_email: string) {
  try {
    // Verificar producto
    const { data: producto } = await supabase
      .from('productos')
      .select('codigo, stock')
      .eq('codigo', params.producto_codigo)
      .single();

    if (!producto) {
      return { success: false, error: 'Producto no encontrado' };
    }

    // Calcular nuevo stock
    let nuevoStock = producto.stock;
    if (params.tipo === 'entrada') {
      nuevoStock += params.cantidad;
    } else if (params.tipo === 'salida') {
      if (producto.stock < params.cantidad) {
        return { success: false, error: 'Stock insuficiente' };
      }
      nuevoStock -= params.cantidad;
    } else {
      nuevoStock = params.cantidad; // Ajuste directo
    }

    // Crear movimiento
    const { data: movimiento, error: movError } = await supabase
      .from('movimientos')
      .insert({
        producto_codigo: params.producto_codigo,
        tipo: params.tipo,
        cantidad: params.cantidad,
        stock_anterior: producto.stock,
        stock_nuevo: nuevoStock,
        motivo: params.motivo || `Movimiento vía Asistente IA`,
        creado_por: usuario_email,
      })
      .select()
      .single();

    if (movError) throw movError;

    // Actualizar stock del producto
    const { error: updateError } = await supabase
      .from('productos')
      .update({ 
        stock: nuevoStock,
        actualizado_por: usuario_email,
        actualizado_at: new Date().toISOString(),
      })
      .eq('codigo', params.producto_codigo);

    if (updateError) throw updateError;

    return {
      success: true,
      mensaje: `Movimiento de ${params.tipo} creado exitosamente`,
      movimiento: {
        id: movimiento.id,
        producto: params.producto_codigo,
        tipo: params.tipo,
        cantidad: params.cantidad,
        stock_anterior: producto.stock,
        stock_nuevo: nuevoStock,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function crearOrdenCompra(params: {
  proveedor_id: string;
  productos: Array<{ codigo: string; cantidad: number; precio: number }>;
  notas?: string;
}, usuario_email: string) {
  try {
    // Verificar proveedor
    const { data: proveedor } = await supabase
      .from('proveedores')
      .select('id, nombre')
      .eq('id', params.proveedor_id)
      .single();

    if (!proveedor) {
      return { success: false, error: 'Proveedor no encontrado' };
    }

    // Generar número de orden
    const { data: ultimaOrden } = await supabase
      .from('ordenes_compra')
      .select('numero')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const año = new Date().getFullYear();
    let secuencia = 1;
    if (ultimaOrden?.numero) {
      const match = ultimaOrden.numero.match(/OC-\d{4}-(\d+)/);
      if (match) secuencia = parseInt(match[1]) + 1;
    }
    const numero = `OC-${año}-${String(secuencia).padStart(5, '0')}`;

    // Calcular total
    const total = params.productos.reduce((sum, p) => sum + (p.cantidad * p.precio), 0);

    // Crear orden
    const { data: orden, error: ordenError } = await supabase
      .from('ordenes_compra')
      .insert({
        numero,
        proveedor_id: params.proveedor_id,
        estado: 'borrador',
        total,
        notas: params.notas || 'Orden creada vía Asistente IA',
        creado_por: usuario_email,
      })
      .select()
      .single();

    if (ordenError) throw ordenError;

    // Crear líneas
    const lineas = params.productos.map(p => ({
      orden_compra_id: orden.id,
      producto_codigo: p.codigo,
      cantidad: p.cantidad,
      precio_unitario: p.precio,
      subtotal: p.cantidad * p.precio,
    }));

    const { error: lineasError } = await supabase
      .from('lineas_compra')
      .insert(lineas);

    if (lineasError) throw lineasError;

    return {
      success: true,
      mensaje: `Orden de compra ${numero} creada exitosamente`,
      orden: {
        id: orden.id,
        numero,
        proveedor: proveedor.nombre,
        total,
        cantidad_productos: params.productos.length,
        estado: 'borrador',
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================
// DISPATCHER DE HERRAMIENTAS
// ============================================

export async function ejecutarHerramienta(
  herramienta: string,
  parametros: any,
  contexto: { usuario_email: string }
): Promise<any> {
  switch (herramienta) {
    case 'consultar_stock':
      return consultarStock(parametros);
    case 'consultar_producto':
      return consultarProducto(parametros);
    case 'buscar_productos':
      return buscarProductos(parametros);
    case 'productos_criticos':
      return productosCriticos(parametros);
    case 'consultar_ordenes':
      return consultarOrdenes(parametros);
    case 'consultar_clientes':
      return consultarClientes(parametros);
    case 'consultar_proveedores':
      return consultarProveedores(parametros);
    case 'metricas_dashboard':
      return metricasDashboard(parametros);
    case 'prediccion_demanda':
      return prediccionDemanda(parametros);
    case 'analisis_ventas':
      return analisisVentas(parametros);
    case 'analisis_compras':
      return analisisCompras(parametros);
    case 'analisis_tendencias':
      return analisisTendencias(parametros);
    case 'recomendaciones_reposicion':
      return recomendacionesReposicion(parametros);
    case 'crear_movimiento':
      return crearMovimiento(parametros, contexto.usuario_email);
    case 'crear_orden_compra':
      return crearOrdenCompra(parametros, contexto.usuario_email);
    default:
      return { success: false, error: `Herramienta "${herramienta}" no encontrada` };
  }
}