/**
 * Utilidades para Ensamblaje y BOM
 * FASE 1: Completando funcionalidades de producción
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { registrarEventoTrazabilidad } from './traceability-utils';

/**
 * Validar disponibilidad de componentes para ensamblaje
 */
export async function validarDisponibilidadComponentes(
  supabase: SupabaseClient,
  bomId: string,
  cantidadProducir: number
) {
  try {
    // Obtener BOM con items
    const { data: bom, error: bomError } = await supabase
      .from('bom')
      .select(`
        *,
        items:bom_items(
          *,
          componente:productos(codigo, descripcion, stock)
        )
      `)
      .eq('id', bomId)
      .single();

    if (bomError) throw bomError;

    const faltantes: any[] = [];
    const disponibles: any[] = [];

    for (const item of bom.items) {
      const cantidadNecesaria = item.cantidad * cantidadProducir;
      const stockDisponible = item.componente.stock || 0;

      if (stockDisponible < cantidadNecesaria) {
        faltantes.push({
          componenteCodigo: item.componenteCodigo,
          descripcion: item.componente.descripcion,
          necesario: cantidadNecesaria,
          disponible: stockDisponible,
          faltante: cantidadNecesaria - stockDisponible,
        });
      } else {
        disponibles.push({
          componenteCodigo: item.componenteCodigo,
          descripcion: item.componente.descripcion,
          necesario: cantidadNecesaria,
          disponible: stockDisponible,
        });
      }
    }

    return {
      success: true,
      puedeEnsamblar: faltantes.length === 0,
      faltantes,
      disponibles,
      bom,
    };
  } catch (error) {
    console.error('Error validando componentes:', error);
    return {
      success: false,
      puedeEnsamblar: false,
      faltantes: [],
      disponibles: [],
      error,
    };
  }
}

/**
 * Ejecutar ensamblaje consumiendo componentes y generando producto final
 */
export async function ejecutarEnsamblaje(
  supabase: SupabaseClient,
  params: {
    ensamblaje: string;
    bomId: string;
    productoCodigo: string;
    cantidadProducida: number;
    almacenId: string;
    usuarioEmail: string;
    generarSeriales?: boolean;
  }
) {
  try {
    // 1. Validar disponibilidad
    const validacion = await validarDisponibilidadComponentes(
      supabase,
      params.bomId,
      params.cantidadProducida
    );

    if (!validacion.puedeEnsamblar) {
      throw new Error(`Componentes insuficientes: ${validacion.faltantes.map((f: any) => f.descripcion).join(', ')}`);
    }

    const componentesConsumidos = [];

    // 2. Consumir componentes (crear movimientos de salida)
    for (const item of validacion.bom.items) {
      const cantidadConsumir = item.cantidad * params.cantidadProducida;

      // Crear movimiento de salida
      const { error: movError } = await supabase.from('movimientos').insert([{
        codigo: item.componenteCodigo,
        tipo: 'salida',
        cantidad: cantidadConsumir,
        usuario_email: params.usuarioEmail,
        notas: `Consumido en ensamblaje ${params.ensamblaje}`,
      }]);

      if (movError) throw movError;

      // Actualizar stock del componente
      const { data: producto } = await supabase
        .from('productos')
        .select('stock')
        .eq('codigo', item.componenteCodigo)
        .single();

      await supabase
        .from('productos')
        .update({ stock: (producto.stock || 0) - cantidadConsumir })
        .eq('codigo', item.componenteCodigo);

      // Registrar trazabilidad
      await registrarEventoTrazabilidad(supabase, {
        productoCodigo: item.componenteCodigo,
        tipoEvento: 'ENSAMBLAJE',
        descripcion: `Componente consumido en ensamblaje de ${params.productoCodigo}`,
        resultado: 'EXITOSO',
        cantidad: cantidadConsumir,
        almacenOrigenId: params.almacenId,
        documentoTipo: 'ENSAMBLAJE',
        documentoNumero: params.ensamblaje,
        usuarioResponsable: params.usuarioEmail,
      });

      componentesConsumidos.push({
        componenteCodigo: item.componenteCodigo,
        cantidad: cantidadConsumir,
        costoUnitario: item.costoUnitario,
        costoTotal: item.costoTotal * params.cantidadProducida,
      });
    }

    // 3. Crear movimiento de entrada del producto final
    const { error: entradaError } = await supabase.from('movimientos').insert([{
      codigo: params.productoCodigo,
      tipo: 'entrada',
      cantidad: params.cantidadProducida,
      usuario_email: params.usuarioEmail,
      notas: `Producido mediante ensamblaje ${params.ensamblaje}`,
      costo_compra: validacion.bom.costo_total / validacion.bom.cantidad_base,
    }]);

    if (entradaError) throw entradaError;

    // 4. Actualizar stock del producto final
    const { data: productoFinal } = await supabase
      .from('productos')
      .select('stock')
      .eq('codigo', params.productoCodigo)
      .single();

    await supabase
      .from('productos')
      .update({ stock: (productoFinal.stock || 0) + params.cantidadProducida })
      .eq('codigo', params.productoCodigo);

    // 5. Registrar trazabilidad del producto final
    await registrarEventoTrazabilidad(supabase, {
      productoCodigo: params.productoCodigo,
      tipoEvento: 'ENSAMBLAJE',
      descripcion: `Producto ensamblado a partir de ${validacion.bom.items.length} componentes`,
      resultado: 'EXITOSO',
      cantidad: params.cantidadProducida,
      almacenDestinoId: params.almacenId,
      documentoTipo: 'ENSAMBLAJE',
      documentoNumero: params.ensamblaje,
      usuarioResponsable: params.usuarioEmail,
      metadata: {
        bomId: params.bomId,
        componentesConsumidos,
      },
    });

    // 6. Generar seriales si es necesario
    let serialesGenerados: string[] = [];
    if (params.generarSeriales) {
      const { data: producto } = await supabase
        .from('productos')
        .select('requiere_serial')
        .eq('codigo', params.productoCodigo)
        .single();

      if (producto?.requiere_serial) {
        for (let i = 0; i < params.cantidadProducida; i++) {
          const { data: serial } = await supabase.rpc('generar_numero_serial', {
            p_producto_codigo: params.productoCodigo,
          });

          const numeroSerie = serial || `ASM-${Date.now()}-${i}`;

          const { data: serialCreado } = await supabase
            .from('productos_seriales')
            .insert([{
              producto_codigo: params.productoCodigo,
              numero_serie: numeroSerie,
              estado: 'disponible',
              almacen_id: params.almacenId,
              fecha_recepcion: new Date().toISOString(),
              creado_por: params.usuarioEmail,
              notas: `Generado por ensamblaje ${params.ensamblaje}`,
            }])
            .select('id')
            .single();

          if (serialCreado) {
            serialesGenerados.push(serialCreado.id);
          }
        }
      }
    }

    // 7. Actualizar ensamblaje
    await supabase
      .from('ensamblajes')
      .update({
        cantidad_producida: params.cantidadProducida,
        cantidad_aprobada: params.cantidadProducida,
        estado: 'completado',
        fecha_fin: new Date().toISOString(),
        componentes_consumidos: componentesConsumidos,
        seriales_generados: serialesGenerados,
        actualizado_por: params.usuarioEmail,
      })
      .eq('numero', params.ensamblaje);

    return {
      success: true,
      componentesConsumidos,
      serialesGenerados,
      mensaje: `Ensamblaje completado: ${params.cantidadProducida} unidades producidas`,
    };
  } catch (error) {
    console.error('Error ejecutando ensamblaje:', error);
    return {
      success: false,
      error,
      mensaje: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`,
    };
  }
}

/**
 * Calcular costo real de ensamblaje
 */
export async function calcularCostoRealEnsamblaje(
  supabase: SupabaseClient,
  ensamblaje: string
) {
  try {
    const { data } = await supabase
      .from('ensamblajes')
      .select('componentes_consumidos, costo_mano_obra_real, costo_overhead_real')
      .eq('numero', ensamblaje)
      .single();

    if (!data) throw new Error('Ensamblaje no encontrado');

    const costoMateriales = (data.componentes_consumidos || []).reduce(
      (sum: number, comp: any) => sum + (comp.costoTotal || 0),
      0
    );

    const costoTotal = costoMateriales + (data.costo_mano_obra_real || 0) + (data.costo_overhead_real || 0);

    return {
      success: true,
      costoMateriales,
      costoManoObra: data.costo_mano_obra_real || 0,
      costoOverhead: data.costo_overhead_real || 0,
      costoTotal,
    };
  } catch (error) {
    return { success: false, error };
  }
}
