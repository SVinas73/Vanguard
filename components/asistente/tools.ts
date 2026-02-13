// ============================================
// AGENTE IA - LANGCHAIN TOOLS
// Herramientas que el agente puede usar
// ============================================

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

// Cliente Supabase para el servidor
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const VANGUARD_IA_URL = process.env.NEXT_PUBLIC_VANGUARD_IA_URL || 'https://vanguard-ia.onrender.com';

// ============================================
// HELPER: Formatear moneda
// ============================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

// ============================================
// TOOL: Consultar Stock
// ============================================

export const consultarStockTool = new DynamicStructuredTool({
  name: 'consultar_stock',
  description: 'Consulta el stock actual de productos. Puede filtrar por código específico, categoría, o mostrar solo productos con stock bajo/crítico.',
  schema: z.object({
    codigo: z.string().optional().describe('Código específico del producto a consultar'),
    categoria: z.string().optional().describe('Filtrar por categoría de productos'),
    solo_criticos: z.boolean().optional().describe('Si es true, solo muestra productos con stock menor o igual al mínimo'),
    limite: z.number().optional().describe('Cantidad máxima de productos a retornar'),
  }),
  func: async ({ codigo, categoria, solo_criticos, limite = 50 }) => {
    try {
      let query = supabase
        .from('productos')
        .select('codigo, descripcion, stock, stock_minimo, categoria, precio, costo_promedio')
        .is('deleted_at', null);

      if (codigo) {
        query = query.eq('codigo', codigo);
      }
      if (categoria) {
        query = query.ilike('categoria', `%${categoria}%`);
      }

      const { data, error } = await query.limit(limite);
      if (error) throw error;

      let productos = data || [];
      
      if (solo_criticos) {
        productos = productos.filter(p => p.stock <= p.stock_minimo);
      }

      const resumen = {
        total_consultados: productos.length,
        criticos: productos.filter(p => p.stock <= p.stock_minimo).length,
        agotados: productos.filter(p => p.stock === 0).length,
        valor_total_inventario: productos.reduce((sum, p) => sum + (p.stock * (p.costo_promedio || 0)), 0),
      };

      return JSON.stringify({
        resumen,
        productos: productos.map(p => ({
          codigo: p.codigo,
          descripcion: p.descripcion,
          stock: p.stock,
          stock_minimo: p.stock_minimo,
          estado: p.stock === 0 ? 'AGOTADO' : p.stock <= p.stock_minimo ? 'CRÍTICO' : 'OK',
          categoria: p.categoria,
          precio: p.precio,
          valor_inventario: p.stock * (p.costo_promedio || 0),
        })),
      });
    } catch (error: any) {
      return JSON.stringify({ error: error.message });
    }
  },
});

// ============================================
// TOOL: Buscar Productos
// ============================================

export const buscarProductosTool = new DynamicStructuredTool({
  name: 'buscar_productos',
  description: 'Busca productos por nombre, descripción o código. Útil cuando el usuario menciona un producto pero no sabe el código exacto.',
  schema: z.object({
    query: z.string().describe('Término de búsqueda (nombre, descripción o código parcial)'),
    limite: z.number().optional().describe('Cantidad máxima de resultados'),
  }),
  func: async ({ query, limite = 20 }) => {
    try {
      const { data, error } = await supabase
        .from('productos')
        .select('codigo, descripcion, stock, stock_minimo, categoria, precio')
        .is('deleted_at', null)
        .or(`codigo.ilike.%${query}%,descripcion.ilike.%${query}%`)
        .limit(limite);

      if (error) throw error;

      return JSON.stringify({
        encontrados: data?.length || 0,
        productos: data || [],
      });
    } catch (error: any) {
      return JSON.stringify({ error: error.message });
    }
  },
});

// ============================================
// TOOL: Productos Críticos
// ============================================

export const productosCriticosTool = new DynamicStructuredTool({
  name: 'productos_criticos',
  description: 'Lista los productos con stock bajo o agotado que necesitan reposición urgente.',
  schema: z.object({
    limite: z.number().optional().describe('Cantidad máxima de productos a mostrar'),
    incluir_agotados: z.boolean().optional().describe('Si incluir productos con stock 0'),
  }),
  func: async ({ limite = 30, incluir_agotados = true }) => {
    try {
      const { data, error } = await supabase
        .from('productos')
        .select('codigo, descripcion, stock, stock_minimo, categoria, costo_promedio')
        .is('deleted_at', null)
        .order('stock', { ascending: true })
        .limit(100);

      if (error) throw error;

      let criticos = (data || []).filter(p => p.stock <= p.stock_minimo);
      
      if (!incluir_agotados) {
        criticos = criticos.filter(p => p.stock > 0);
      }

      criticos = criticos.slice(0, limite);

      const agotados = criticos.filter(p => p.stock === 0);
      const bajos = criticos.filter(p => p.stock > 0);

      return JSON.stringify({
        resumen: {
          total_criticos: criticos.length,
          agotados: agotados.length,
          stock_bajo: bajos.length,
          costo_reposicion_estimado: criticos.reduce((sum, p) => 
            sum + ((p.stock_minimo - p.stock) * (p.costo_promedio || 0)), 0
          ),
        },
        productos: criticos.map(p => ({
          codigo: p.codigo,
          descripcion: p.descripcion,
          stock_actual: p.stock,
          stock_minimo: p.stock_minimo,
          faltante: Math.max(0, p.stock_minimo - p.stock),
          urgencia: p.stock === 0 ? 'AGOTADO' : 'BAJO',
        })),
      });
    } catch (error: any) {
      return JSON.stringify({ error: error.message });
    }
  },
});

// ============================================
// TOOL: Análisis de Ventas
// ============================================

export const analisisVentasTool = new DynamicStructuredTool({
  name: 'analisis_ventas',
  description: 'Analiza las ventas por período. Muestra totales, cantidad de órdenes, ticket promedio y productos más vendidos.',
  schema: z.object({
    periodo: z.enum(['hoy', 'semana', 'mes', 'año']).optional().describe('Período a analizar'),
    top_productos: z.number().optional().describe('Cantidad de top productos a incluir'),
  }),
  func: async ({ periodo = 'mes', top_productos = 5 }) => {
    try {
      const hoy = new Date();
      let fechaInicio = new Date();

      switch (periodo) {
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

      // Obtener órdenes de venta
      const { data: ventas, error } = await supabase
        .from('ordenes_venta')
        .select('id, numero, total, estado, created_at, cliente_id')
        .gte('created_at', fechaInicio.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const totalVentas = (ventas || []).reduce((sum, v) => sum + (v.total || 0), 0);
      const cantidadOrdenes = ventas?.length || 0;
      const completadas = (ventas || []).filter(v => v.estado === 'completada').length;

      // Obtener líneas de venta para top productos
      const { data: lineas } = await supabase
        .from('lineas_venta')
        .select('producto_codigo, cantidad, subtotal')
        .in('orden_venta_id', (ventas || []).map(v => v.id));

      const productosVendidos: Record<string, { cantidad: number; total: number }> = {};
      (lineas || []).forEach((l: any) => {
        if (!productosVendidos[l.producto_codigo]) {
          productosVendidos[l.producto_codigo] = { cantidad: 0, total: 0 };
        }
        productosVendidos[l.producto_codigo].cantidad += l.cantidad;
        productosVendidos[l.producto_codigo].total += l.subtotal || 0;
      });

      const topProductos = Object.entries(productosVendidos)
        .map(([codigo, data]) => ({ codigo, ...data }))
        .sort((a, b) => b.total - a.total)
        .slice(0, top_productos);

      return JSON.stringify({
        periodo,
        fecha_inicio: fechaInicio.toISOString().split('T')[0],
        fecha_fin: hoy.toISOString().split('T')[0],
        metricas: {
          total_ventas: totalVentas,
          cantidad_ordenes: cantidadOrdenes,
          ordenes_completadas: completadas,
          ticket_promedio: cantidadOrdenes > 0 ? totalVentas / cantidadOrdenes : 0,
          tasa_completadas: cantidadOrdenes > 0 ? (completadas / cantidadOrdenes * 100).toFixed(1) + '%' : '0%',
        },
        top_productos: topProductos,
      });
    } catch (error: any) {
      return JSON.stringify({ error: error.message });
    }
  },
});

// ============================================
// TOOL: Análisis de Compras
// ============================================

export const analisisComprasTool = new DynamicStructuredTool({
  name: 'analisis_compras',
  description: 'Analiza las compras por período. Muestra totales y estado de órdenes de compra.',
  schema: z.object({
    periodo: z.enum(['hoy', 'semana', 'mes', 'año']).optional().describe('Período a analizar'),
  }),
  func: async ({ periodo = 'mes' }) => {
    try {
      const hoy = new Date();
      let fechaInicio = new Date();

      switch (periodo) {
        case 'hoy': fechaInicio.setHours(0, 0, 0, 0); break;
        case 'semana': fechaInicio.setDate(hoy.getDate() - 7); break;
        case 'año': fechaInicio.setFullYear(hoy.getFullYear() - 1); break;
        default: fechaInicio.setMonth(hoy.getMonth() - 1);
      }

      const { data: compras, error } = await supabase
        .from('ordenes_compra')
        .select('id, numero, total, estado, created_at')
        .gte('created_at', fechaInicio.toISOString());

      if (error) throw error;

      const totalCompras = (compras || []).reduce((sum, c) => sum + (c.total || 0), 0);
      
      const porEstado: Record<string, number> = {};
      (compras || []).forEach(c => {
        porEstado[c.estado] = (porEstado[c.estado] || 0) + 1;
      });

      return JSON.stringify({
        periodo,
        metricas: {
          total_compras: totalCompras,
          cantidad_ordenes: compras?.length || 0,
          por_estado: porEstado,
        },
      });
    } catch (error: any) {
      return JSON.stringify({ error: error.message });
    }
  },
});

// ============================================
// TOOL: Métricas Dashboard
// ============================================

export const metricasDashboardTool = new DynamicStructuredTool({
  name: 'metricas_dashboard',
  description: 'Obtiene un resumen general del negocio: total de productos, valor del inventario, ventas, compras y productos críticos.',
  schema: z.object({
    periodo: z.enum(['hoy', 'semana', 'mes', 'año']).optional().describe('Período para ventas/compras'),
  }),
  func: async ({ periodo = 'mes' }) => {
    try {
      // Total productos
      const { count: totalProductos } = await supabase
        .from('productos')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null);

      // Productos con stock
      const { data: productosStock } = await supabase
        .from('productos')
        .select('stock, stock_minimo, costo_promedio')
        .is('deleted_at', null);

      const criticos = (productosStock || []).filter(p => p.stock <= p.stock_minimo).length;
      const agotados = (productosStock || []).filter(p => p.stock === 0).length;
      const valorInventario = (productosStock || []).reduce(
        (sum, p) => sum + (p.stock || 0) * (p.costo_promedio || 0), 0
      );

      // Fechas para período
      const hoy = new Date();
      let fechaInicio = new Date();
      switch (periodo) {
        case 'hoy': fechaInicio.setHours(0, 0, 0, 0); break;
        case 'semana': fechaInicio.setDate(hoy.getDate() - 7); break;
        case 'año': fechaInicio.setFullYear(hoy.getFullYear() - 1); break;
        default: fechaInicio.setMonth(hoy.getMonth() - 1);
      }

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

      // Clientes y proveedores
      const { count: totalClientes } = await supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null);

      const { count: totalProveedores } = await supabase
        .from('proveedores')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null);

      return JSON.stringify({
        periodo,
        inventario: {
          total_productos: totalProductos || 0,
          productos_criticos: criticos,
          productos_agotados: agotados,
          valor_inventario: valorInventario,
        },
        ventas: {
          total: totalVentas,
          cantidad: ventas?.length || 0,
        },
        compras: {
          total: totalCompras,
          cantidad: compras?.length || 0,
        },
        entidades: {
          clientes: totalClientes || 0,
          proveedores: totalProveedores || 0,
        },
        margen_bruto: totalVentas - totalCompras,
      });
    } catch (error: any) {
      return JSON.stringify({ error: error.message });
    }
  },
});

// ============================================
// TOOL: Análisis de Tendencias
// ============================================

export const analisisTendenciasTool = new DynamicStructuredTool({
  name: 'analisis_tendencias',
  description: 'Analiza tendencias de productos basándose en movimientos históricos. Identifica productos con demanda creciente, estable o decreciente.',
  schema: z.object({
    dias: z.number().optional().describe('Días de histórico a analizar (default 90)'),
    limite: z.number().optional().describe('Cantidad de productos a incluir'),
  }),
  func: async ({ dias = 90, limite = 20 }) => {
    try {
      const fechaInicio = new Date();
      fechaInicio.setDate(fechaInicio.getDate() - dias);

      const { data: movimientos } = await supabase
        .from('movimientos')
        .select('producto_codigo, tipo, cantidad, created_at')
        .eq('tipo', 'salida')
        .gte('created_at', fechaInicio.toISOString());

      // Agrupar por producto y período
      const hoy = new Date();
      const hace30 = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);
      const hace60 = new Date(hoy.getTime() - 60 * 24 * 60 * 60 * 1000);

      const porProducto: Record<string, { ultimos_30: number; anteriores_30: number }> = {};

      (movimientos || []).forEach(m => {
        const fecha = new Date(m.created_at);
        if (!porProducto[m.producto_codigo]) {
          porProducto[m.producto_codigo] = { ultimos_30: 0, anteriores_30: 0 };
        }

        if (fecha >= hace30) {
          porProducto[m.producto_codigo].ultimos_30 += m.cantidad;
        } else if (fecha >= hace60) {
          porProducto[m.producto_codigo].anteriores_30 += m.cantidad;
        }
      });

      const tendencias = Object.entries(porProducto).map(([codigo, data]) => {
        const variacion = data.anteriores_30 > 0 
          ? ((data.ultimos_30 - data.anteriores_30) / data.anteriores_30) * 100 
          : (data.ultimos_30 > 0 ? 100 : 0);

        let tendencia: string;
        if (variacion > 20) tendencia = 'CRECIENDO';
        else if (variacion < -20) tendencia = 'DECRECIENDO';
        else tendencia = 'ESTABLE';

        return {
          codigo,
          ventas_ultimos_30_dias: data.ultimos_30,
          ventas_30_dias_anteriores: data.anteriores_30,
          variacion_porcentual: Math.round(variacion * 10) / 10,
          tendencia,
        };
      });

      const ordenadas = tendencias
        .sort((a, b) => Math.abs(b.variacion_porcentual) - Math.abs(a.variacion_porcentual))
        .slice(0, limite);

      return JSON.stringify({
        periodo_analizado: `${dias} días`,
        resumen: {
          creciendo: tendencias.filter(t => t.tendencia === 'CRECIENDO').length,
          estable: tendencias.filter(t => t.tendencia === 'ESTABLE').length,
          decreciendo: tendencias.filter(t => t.tendencia === 'DECRECIENDO').length,
        },
        productos: ordenadas,
      });
    } catch (error: any) {
      return JSON.stringify({ error: error.message });
    }
  },
});

// ============================================
// TOOL: Recomendaciones de Reposición
// ============================================

export const recomendacionesReposicionTool = new DynamicStructuredTool({
  name: 'recomendaciones_reposicion',
  description: 'Genera recomendaciones inteligentes de qué productos reponer, en qué cantidad y con qué urgencia, basándose en stock actual y consumo histórico.',
  schema: z.object({
    urgencia: z.enum(['critica', 'alta', 'media', 'todas']).optional().describe('Filtrar por nivel de urgencia'),
    limite: z.number().optional().describe('Cantidad máxima de recomendaciones'),
  }),
  func: async ({ urgencia = 'todas', limite = 20 }) => {
    try {
      // Productos con stock
      const { data: productos } = await supabase
        .from('productos')
        .select('codigo, descripcion, stock, stock_minimo, costo_promedio')
        .is('deleted_at', null);

      // Consumo últimos 30 días
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

      const recomendaciones = (productos || [])
        .map(p => {
          const consumoMensual = consumoPorProducto[p.codigo] || 0;
          const consumoDiario = consumoMensual / 30;
          const diasCobertura = consumoDiario > 0 ? p.stock / consumoDiario : 999;

          let nivelUrgencia: string;
          if (p.stock === 0 || diasCobertura <= 3) nivelUrgencia = 'critica';
          else if (diasCobertura <= 7) nivelUrgencia = 'alta';
          else if (diasCobertura <= 14) nivelUrgencia = 'media';
          else nivelUrgencia = 'baja';

          // Cantidad sugerida: cubrir 30 días + safety stock (50%)
          const cantidadSugerida = Math.max(0, Math.ceil(consumoDiario * 30 * 1.5) - p.stock);

          return {
            codigo: p.codigo,
            descripcion: p.descripcion,
            stock_actual: p.stock,
            stock_minimo: p.stock_minimo,
            consumo_diario: Math.round(consumoDiario * 10) / 10,
            dias_cobertura: Math.round(diasCobertura),
            urgencia: nivelUrgencia,
            cantidad_sugerida: cantidadSugerida,
            costo_estimado: cantidadSugerida * (p.costo_promedio || 0),
          };
        })
        .filter(r => r.urgencia !== 'baja' || r.stock_actual <= r.stock_minimo);

      // Filtrar por urgencia
      let filtradas = recomendaciones;
      if (urgencia !== 'todas') {
        filtradas = recomendaciones.filter(r => r.urgencia === urgencia);
      }

      // Ordenar por urgencia
      const ordenUrgencia: Record<string, number> = { critica: 0, alta: 1, media: 2, baja: 3 };
      filtradas.sort((a, b) => ordenUrgencia[a.urgencia] - ordenUrgencia[b.urgencia]);
      filtradas = filtradas.slice(0, limite);

      const costoTotal = filtradas.reduce((sum, r) => sum + r.costo_estimado, 0);

      return JSON.stringify({
        total_recomendaciones: filtradas.length,
        costo_total_estimado: costoTotal,
        por_urgencia: {
          critica: filtradas.filter(r => r.urgencia === 'critica').length,
          alta: filtradas.filter(r => r.urgencia === 'alta').length,
          media: filtradas.filter(r => r.urgencia === 'media').length,
        },
        recomendaciones: filtradas,
      });
    } catch (error: any) {
      return JSON.stringify({ error: error.message });
    }
  },
});

// ============================================
// TOOL: Predicción de Demanda (API Render)
// ============================================

export const prediccionDemandaTool = new DynamicStructuredTool({
  name: 'prediccion_demanda',
  description: 'Predice la demanda futura de un producto usando modelos de Machine Learning (Holt-Winters). Indica cuándo se agotará el stock.',
  schema: z.object({
    codigo: z.string().describe('Código del producto a predecir'),
  }),
  func: async ({ codigo }) => {
    try {
      // Verificar producto
      const { data: producto } = await supabase
        .from('productos')
        .select('codigo, descripcion, stock')
        .eq('codigo', codigo)
        .single();

      if (!producto) {
        return JSON.stringify({ error: 'Producto no encontrado' });
      }

      // Obtener movimientos
      const { data: movimientos } = await supabase
        .from('movimientos')
        .select('tipo, cantidad, created_at')
        .eq('producto_codigo', codigo)
        .order('created_at', { ascending: false })
        .limit(365);

      // Llamar API de Render
      try {
        const response = await fetch(`${VANGUARD_IA_URL}/api/predictions/stock-depletion/${codigo}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stock_actual: producto.stock,
            movimientos: movimientos || [],
          }),
        });

        if (response.ok) {
          const prediccion = await response.json();
          return JSON.stringify({
            producto: {
              codigo: producto.codigo,
              descripcion: producto.descripcion,
              stock_actual: producto.stock,
            },
            prediccion: {
              dias_hasta_agotamiento: prediccion.dias_hasta_agotamiento,
              fecha_estimada_agotamiento: prediccion.dias_hasta_agotamiento 
                ? new Date(Date.now() + prediccion.dias_hasta_agotamiento * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                : null,
              consumo_diario_estimado: prediccion.consumo_diario,
              confianza: prediccion.confianza,
              modelo: 'Holt-Winters (ML)',
            },
          });
        }
      } catch (apiError) {
        // Fallback si la API falla
      }

      // Cálculo local de fallback
      const salidas = (movimientos || [])
        .filter(m => m.tipo === 'salida')
        .reduce((sum, m) => sum + m.cantidad, 0);
      const consumoDiario = salidas / 30;
      const diasHastaAgotamiento = consumoDiario > 0 ? Math.floor(producto.stock / consumoDiario) : null;

      return JSON.stringify({
        producto: {
          codigo: producto.codigo,
          descripcion: producto.descripcion,
          stock_actual: producto.stock,
        },
        prediccion: {
          dias_hasta_agotamiento: diasHastaAgotamiento,
          fecha_estimada_agotamiento: diasHastaAgotamiento 
            ? new Date(Date.now() + diasHastaAgotamiento * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            : null,
          consumo_diario_estimado: Math.round(consumoDiario * 100) / 100,
          confianza: 0.65,
          modelo: 'Promedio móvil (fallback)',
        },
      });
    } catch (error: any) {
      return JSON.stringify({ error: error.message });
    }
  },
});

// ============================================
// TOOL: Crear Movimiento de Inventario
// ============================================

export const crearMovimientoTool = new DynamicStructuredTool({
  name: 'crear_movimiento',
  description: 'Crea un movimiento de inventario (entrada, salida o ajuste). IMPORTANTE: Solo usar cuando el usuario explícitamente solicite crear un movimiento.',
  schema: z.object({
    producto_codigo: z.string().describe('Código del producto'),
    tipo: z.enum(['entrada', 'salida', 'ajuste']).describe('Tipo de movimiento'),
    cantidad: z.number().describe('Cantidad a mover'),
    motivo: z.string().optional().describe('Motivo del movimiento'),
  }),
  func: async ({ producto_codigo, tipo, cantidad, motivo }) => {
    try {
      // Verificar producto
      const { data: producto } = await supabase
        .from('productos')
        .select('codigo, descripcion, stock')
        .eq('codigo', producto_codigo)
        .single();

      if (!producto) {
        return JSON.stringify({ error: 'Producto no encontrado' });
      }

      // Calcular nuevo stock
      let nuevoStock = producto.stock;
      if (tipo === 'entrada') {
        nuevoStock += cantidad;
      } else if (tipo === 'salida') {
        if (producto.stock < cantidad) {
          return JSON.stringify({ error: `Stock insuficiente. Stock actual: ${producto.stock}` });
        }
        nuevoStock -= cantidad;
      } else {
        nuevoStock = cantidad;
      }

      // Crear movimiento
      const { data: movimiento, error: movError } = await supabase
        .from('movimientos')
        .insert({
          producto_codigo,
          tipo,
          cantidad,
          stock_anterior: producto.stock,
          stock_nuevo: nuevoStock,
          motivo: motivo || 'Movimiento creado vía Asistente IA',
          creado_por: 'asistente-ia',
        })
        .select()
        .single();

      if (movError) throw movError;

      // Actualizar stock
      const { error: updateError } = await supabase
        .from('productos')
        .update({ stock: nuevoStock, actualizado_at: new Date().toISOString() })
        .eq('codigo', producto_codigo);

      if (updateError) throw updateError;

      return JSON.stringify({
        exito: true,
        mensaje: `Movimiento de ${tipo} creado exitosamente`,
        detalle: {
          producto: producto.descripcion,
          tipo,
          cantidad,
          stock_anterior: producto.stock,
          stock_nuevo: nuevoStock,
        },
      });
    } catch (error: any) {
      return JSON.stringify({ error: error.message });
    }
  },
});

// ============================================
// TOOL: Consultar Proveedores
// ============================================

export const consultarProveedoresTool = new DynamicStructuredTool({
  name: 'consultar_proveedores',
  description: 'Lista los proveedores disponibles o busca uno específico.',
  schema: z.object({
    query: z.string().optional().describe('Búsqueda por nombre'),
    limite: z.number().optional().describe('Cantidad máxima'),
  }),
  func: async ({ query, limite = 20 }) => {
    try {
      let queryBuilder = supabase
        .from('proveedores')
        .select('id, nombre, rut, email, telefono')
        .is('deleted_at', null);

      if (query) {
        queryBuilder = queryBuilder.ilike('nombre', `%${query}%`);
      }

      const { data, error } = await queryBuilder.limit(limite);
      if (error) throw error;

      return JSON.stringify({
        total: data?.length || 0,
        proveedores: data || [],
      });
    } catch (error: any) {
      return JSON.stringify({ error: error.message });
    }
  },
});

// ============================================
// TOOL: Crear Orden de Compra
// ============================================

export const crearOrdenCompraTool = new DynamicStructuredTool({
  name: 'crear_orden_compra',
  description: 'Crea una nueva orden de compra. IMPORTANTE: Solo usar cuando el usuario explícitamente solicite crear una orden.',
  schema: z.object({
    proveedor_id: z.string().describe('ID del proveedor'),
    productos: z.array(z.object({
      codigo: z.string(),
      cantidad: z.number(),
      precio: z.number(),
    })).describe('Lista de productos con código, cantidad y precio'),
    notas: z.string().optional().describe('Notas adicionales'),
  }),
  func: async ({ proveedor_id, productos, notas }) => {
    try {
      // Verificar proveedor
      const { data: proveedor } = await supabase
        .from('proveedores')
        .select('id, nombre')
        .eq('id', proveedor_id)
        .single();

      if (!proveedor) {
        return JSON.stringify({ error: 'Proveedor no encontrado' });
      }

      // Generar número
      const año = new Date().getFullYear();
      const { data: ultima } = await supabase
        .from('ordenes_compra')
        .select('numero')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      let secuencia = 1;
      if (ultima?.numero) {
        const match = ultima.numero.match(/OC-\d{4}-(\d+)/);
        if (match) secuencia = parseInt(match[1]) + 1;
      }
      const numero = `OC-${año}-${String(secuencia).padStart(5, '0')}`;

      const total = productos.reduce((sum, p) => sum + (p.cantidad * p.precio), 0);

      // Crear orden
      const { data: orden, error: ordenError } = await supabase
        .from('ordenes_compra')
        .insert({
          numero,
          proveedor_id,
          estado: 'borrador',
          total,
          notas: notas || 'Orden creada vía Asistente IA',
          creado_por: 'asistente-ia',
        })
        .select()
        .single();

      if (ordenError) throw ordenError;

      // Crear líneas
      const lineas = productos.map(p => ({
        orden_compra_id: orden.id,
        producto_codigo: p.codigo,
        cantidad: p.cantidad,
        precio_unitario: p.precio,
        subtotal: p.cantidad * p.precio,
      }));

      await supabase.from('lineas_compra').insert(lineas);

      return JSON.stringify({
        exito: true,
        mensaje: `Orden de compra ${numero} creada exitosamente`,
        orden: {
          numero,
          proveedor: proveedor.nombre,
          total,
          cantidad_productos: productos.length,
          estado: 'borrador',
        },
      });
    } catch (error: any) {
      return JSON.stringify({ error: error.message });
    }
  },
});

// ============================================
// EXPORTAR TODAS LAS HERRAMIENTAS
// ============================================

export const allTools = [
  consultarStockTool,
  buscarProductosTool,
  productosCriticosTool,
  analisisVentasTool,
  analisisComprasTool,
  metricasDashboardTool,
  analisisTendenciasTool,
  recomendacionesReposicionTool,
  prediccionDemandaTool,
  consultarProveedoresTool,
  crearMovimientoTool,
  crearOrdenCompraTool,
];