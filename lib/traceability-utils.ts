/**
 * Utilidades para Trazabilidad y Serialización
 * FASE 1: Sistema enterprise de trazabilidad completa
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { TipoEventoTrazabilidad, ResultadoEvento, TipoDocumentoTrazabilidad } from '@/types';

/**
 * Registrar un evento de trazabilidad
 */
export async function registrarEventoTrazabilidad(
  supabase: SupabaseClient,
  params: {
    productoCodigo: string;
    serialId?: string;
    loteId?: string;
    tipoEvento: TipoEventoTrazabilidad;
    descripcion?: string;
    resultado?: ResultadoEvento;
    almacenOrigenId?: string;
    almacenDestinoId?: string;
    ubicacionOrigen?: string;
    ubicacionDestino?: string;
    cantidad?: number;
    unidadMedida?: string;
    documentoTipo?: TipoDocumentoTrazabilidad;
    documentoId?: string;
    documentoNumero?: string;
    proveedorId?: string;
    clienteId?: string;
    transportista?: string;
    numeroTracking?: string;
    temperatura?: number;
    humedad?: number;
    condicionesEspeciales?: Record<string, any>;
    usuarioResponsable?: string;
    operadorFisico?: string;
    supervisor?: string;
    fechaProgramada?: Date;
    duracionMinutos?: number;
    metadata?: Record<string, any>;
  }
) {
  try {
    const evento = {
      producto_codigo: params.productoCodigo,
      serial_id: params.serialId,
      lote_id: params.loteId,
      tipo_evento: params.tipoEvento,
      descripcion: params.descripcion,
      resultado: params.resultado || 'EXITOSO',
      almacen_origen_id: params.almacenOrigenId,
      almacen_destino_id: params.almacenDestinoId,
      ubicacion_origen: params.ubicacionOrigen,
      ubicacion_destino: params.ubicacionDestino,
      cantidad: params.cantidad,
      unidad_medida: params.unidadMedida,
      documento_tipo: params.documentoTipo,
      documento_id: params.documentoId,
      documento_numero: params.documentoNumero,
      proveedor_id: params.proveedorId,
      cliente_id: params.clienteId,
      transportista: params.transportista,
      numero_tracking: params.numeroTracking,
      temperatura: params.temperatura,
      humedad: params.humedad,
      condiciones_especiales: params.condicionesEspeciales,
      usuario_responsable: params.usuarioResponsable,
      operador_fisico: params.operadorFisico,
      supervisor: params.supervisor,
      fecha_hora: new Date().toISOString(),
      fecha_programada: params.fechaProgramada?.toISOString(),
      duracion_minutos: params.duracionMinutos,
      metadata: params.metadata,
    };

    const { data, error } = await supabase
      .from('trazabilidad')
      .insert([evento])
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error registrando evento de trazabilidad:', error);
    return { success: false, error };
  }
}

/**
 * Obtener cadena completa de trazabilidad
 */
export async function obtenerCadenaTrazabilidad(
  supabase: SupabaseClient,
  params: {
    productoCodigo?: string;
    serialId?: string;
    loteId?: string;
  }
) {
  try {
    let query = supabase
      .from('trazabilidad')
      .select(`
        *,
        producto:productos(codigo, descripcion),
        serial:productos_seriales(numero_serie),
        lote:lotes(codigo),
        almacen_origen:almacenes!trazabilidad_almacen_origen_id_fkey(id, nombre),
        almacen_destino:almacenes!trazabilidad_almacen_destino_id_fkey(id, nombre),
        proveedor:proveedores(nombre),
        cliente:clientes(nombre)
      `)
      .order('fecha_hora', { ascending: true });

    if (params.productoCodigo) {
      query = query.eq('producto_codigo', params.productoCodigo);
    }
    if (params.serialId) {
      query = query.eq('serial_id', params.serialId);
    }
    if (params.loteId) {
      query = query.eq('lote_id', params.loteId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error obteniendo cadena de trazabilidad:', error);
    return { success: false, error, data: [] };
  }
}

/**
 * Validar disponibilidad de seriales
 */
export async function validarDisponibilidadSerial(
  supabase: SupabaseClient,
  serialId: string
) {
  try {
    const { data, error } = await supabase
      .from('productos_seriales')
      .select('id, numero_serie, estado')
      .eq('id', serialId)
      .single();

    if (error) throw error;

    const disponible = data?.estado === 'disponible';

    return {
      success: true,
      disponible,
      estado: data?.estado,
      numeroSerie: data?.numero_serie,
    };
  } catch (error) {
    console.error('Error validando serial:', error);
    return { success: false, disponible: false };
  }
}

/**
 * Cambiar estado de serial y registrar en trazabilidad
 */
export async function cambiarEstadoSerial(
  supabase: SupabaseClient,
  serialId: string,
  nuevoEstado: string,
  params: {
    usuarioEmail?: string;
    motivo?: string;
    almacenDestinoId?: string;
    ubicacionDestino?: string;
    clienteId?: string;
    ordenVentaId?: string;
  }
) {
  try {
    // Obtener estado actual
    const { data: serialActual } = await supabase
      .from('productos_seriales')
      .select('*, producto:productos(codigo)')
      .eq('id', serialId)
      .single();

    if (!serialActual) throw new Error('Serial no encontrado');

    // Actualizar estado
    const updateData: any = {
      estado: nuevoEstado,
      actualizado_por: params.usuarioEmail,
    };

    if (params.almacenDestinoId) {
      updateData.almacen_id = params.almacenDestinoId;
    }
    if (params.ubicacionDestino) {
      updateData.ubicacion = params.ubicacionDestino;
    }
    if (params.clienteId) {
      updateData.cliente_id = params.clienteId;
    }
    if (params.ordenVentaId) {
      updateData.orden_venta_id = params.ordenVentaId;
      updateData.fecha_venta = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('productos_seriales')
      .update(updateData)
      .eq('id', serialId);

    if (updateError) throw updateError;

    // Registrar en trazabilidad
    await registrarEventoTrazabilidad(supabase, {
      productoCodigo: serialActual.producto.codigo,
      serialId: serialId,
      tipoEvento: 'CAMBIO_ESTADO',
      descripcion: `Estado cambiado de ${serialActual.estado} a ${nuevoEstado}${params.motivo ? ': ' + params.motivo : ''}`,
      resultado: 'EXITOSO',
      almacenOrigenId: serialActual.almacen_id,
      almacenDestinoId: params.almacenDestinoId,
      ubicacionDestino: params.ubicacionDestino,
      clienteId: params.clienteId,
      usuarioResponsable: params.usuarioEmail,
      metadata: {
        estado_anterior: serialActual.estado,
        estado_nuevo: nuevoEstado,
        motivo: params.motivo,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error cambiando estado de serial:', error);
    return { success: false, error };
  }
}

/**
 * Generar reporte de trazabilidad (para PDF/Excel)
 */
export async function generarReporteTrazabilidad(
  supabase: SupabaseClient,
  params: {
    productoCodigo?: string;
    serialId?: string;
    loteId?: string;
    fechaInicio?: Date;
    fechaFin?: Date;
  }
) {
  try {
    const { data: eventos } = await obtenerCadenaTrazabilidad(supabase, {
      productoCodigo: params.productoCodigo,
      serialId: params.serialId,
      loteId: params.loteId,
    });

    // Aplicar filtros de fecha si existen
    let eventosFiltrados = eventos;
    if (params.fechaInicio) {
      eventosFiltrados = eventosFiltrados.filter(
        (e: any) => new Date(e.fecha_hora) >= params.fechaInicio!
      );
    }
    if (params.fechaFin) {
      eventosFiltrados = eventosFiltrados.filter(
        (e: any) => new Date(e.fecha_hora) <= params.fechaFin!
      );
    }

    // Estadísticas del reporte
    const stats = {
      totalEventos: eventosFiltrados.length,
      exitosos: eventosFiltrados.filter((e: any) => e.resultado === 'EXITOSO').length,
      fallidos: eventosFiltrados.filter((e: any) => e.resultado === 'FALLIDO').length,
      pendientes: eventosFiltrados.filter((e: any) => e.resultado === 'PENDIENTE').length,
      tiposEvento: Array.from(new Set(eventosFiltrados.map((e: any) => e.tipo_evento))),
      ubicaciones: Array.from(
        new Set([
          ...eventosFiltrados.map((e: any) => e.almacen_origen?.nombre).filter(Boolean),
          ...eventosFiltrados.map((e: any) => e.almacen_destino?.nombre).filter(Boolean),
        ])
      ),
    };

    return {
      success: true,
      eventos: eventosFiltrados,
      stats,
    };
  } catch (error) {
    console.error('Error generando reporte:', error);
    return { success: false, error, eventos: [], stats: {} };
  }
}

/**
 * Verificar integridad de cadena de custodia
 */
export async function verificarIntegridadCadena(
  supabase: SupabaseClient,
  serialId: string
) {
  try {
    const { data: eventos } = await obtenerCadenaTrazabilidad(supabase, { serialId });

    const problemas: string[] = [];

    // Verificar que hay al menos un evento de RECEPCION
    const tieneRecepcion = eventos.some((e: any) => e.tipo_evento === 'RECEPCION');
    if (!tieneRecepcion) {
      problemas.push('Falta evento de RECEPCION inicial');
    }

    // Verificar que no hay gaps en las ubicaciones
    for (let i = 1; i < eventos.length; i++) {
      const eventoAnterior: any = eventos[i - 1];
      const eventoActual: any = eventos[i];

      if (
        eventoAnterior.almacen_destino_id &&
        eventoActual.almacen_origen_id &&
        eventoAnterior.almacen_destino_id !== eventoActual.almacen_origen_id
      ) {
        problemas.push(`Gap en ubicación entre eventos ${i} y ${i + 1}`);
      }
    }

    // Verificar eventos fallidos
    const eventosFallidos = eventos.filter((e: any) => e.resultado === 'FALLIDO');
    if (eventosFallidos.length > 0) {
      problemas.push(`${eventosFallidos.length} eventos fallidos encontrados`);
    }

    const integra = problemas.length === 0;

    return {
      success: true,
      integra,
      problemas,
      totalEventos: eventos.length,
    };
  } catch (error) {
    console.error('Error verificando integridad:', error);
    return { success: false, integra: false, problemas: ['Error al verificar'], error };
  }
}
