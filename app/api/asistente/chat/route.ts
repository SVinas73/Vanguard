// ============================================
// API ROUTE: /api/asistente/chat
// Agente LangChain con Google Gemini
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { runAgent } from '@/components/asistente/agent';

export const maxDuration = 60; // Permitir hasta 60 segundos para el agente

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mensaje, historial = [], contexto } = body;

    if (!mensaje) {
      return NextResponse.json(
        { error: 'Mensaje requerido' },
        { status: 400 }
      );
    }

    if (!process.env.GOOGLE_AI_API_KEY) {
      return NextResponse.json(
        { error: 'API Key de Google AI no configurada' },
        { status: 500 }
      );
    }

    // Agregar contexto del usuario al mensaje si es relevante
    let mensajeConContexto = mensaje;
    if (contexto?.usuario_nombre) {
      // Solo agregar contexto en el primer mensaje
      if (historial.length === 0) {
        mensajeConContexto = mensaje;
      }
    }

    // Ejecutar agente
    const resultado = await runAgent(mensajeConContexto, historial);

    // Generar sugerencias basadas en la respuesta
    const sugerencias = generarSugerencias(mensaje, resultado.toolCalls);

    return NextResponse.json({
      respuesta: resultado.respuesta,
      tool_calls: resultado.toolCalls,
      sugerencias,
    });

  } catch (error: any) {
    console.error('Error en agente:', error);
    
    // Manejo específico de errores
    if (error.message?.includes('API key')) {
      return NextResponse.json(
        { error: 'Error de autenticación con la API de IA' },
        { status: 401 }
      );
    }
    
    if (error.message?.includes('quota') || error.message?.includes('rate')) {
      return NextResponse.json(
        { error: 'Se alcanzó el límite de solicitudes. Intenta en unos minutos.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Error procesando la solicitud' },
      { status: 500 }
    );
  }
}

// ============================================
// GENERAR SUGERENCIAS DE SEGUIMIENTO
// ============================================

function generarSugerencias(
  mensajeOriginal: string,
  toolCalls: Array<{ nombre: string; argumentos: any; resultado: any }>
): string[] {
  const sugerencias: string[] = [];
  const herramientasUsadas = toolCalls.map(tc => tc.nombre);

  // Basado en herramientas usadas
  if (herramientasUsadas.includes('productos_criticos')) {
    sugerencias.push('Generar orden de compra para los productos críticos');
    sugerencias.push('Ver predicción de demanda de un producto específico');
  }

  if (herramientasUsadas.includes('metricas_dashboard')) {
    sugerencias.push('Analizar las ventas en detalle');
    sugerencias.push('Ver productos con tendencia de crecimiento');
    sugerencias.push('Mostrar productos críticos');
  }

  if (herramientasUsadas.includes('analisis_ventas')) {
    sugerencias.push('Comparar con el período anterior');
    sugerencias.push('Ver tendencias de los productos más vendidos');
  }

  if (herramientasUsadas.includes('analisis_tendencias')) {
    sugerencias.push('Ver predicción de demanda para productos en crecimiento');
    sugerencias.push('Generar recomendaciones de reposición');
  }

  if (herramientasUsadas.includes('recomendaciones_reposicion')) {
    sugerencias.push('Crear orden de compra con las recomendaciones');
    sugerencias.push('Ver solo recomendaciones críticas');
  }

  if (herramientasUsadas.includes('consultar_stock')) {
    sugerencias.push('Ver análisis de tendencias');
    sugerencias.push('Generar recomendaciones de reposición');
  }

  // Si no hay sugerencias específicas, agregar genéricas
  if (sugerencias.length === 0) {
    sugerencias.push('¿Cómo está el inventario general?');
    sugerencias.push('Ver productos críticos');
    sugerencias.push('Analizar ventas del mes');
  }

  // Limitar y eliminar duplicados
  return [...new Set(sugerencias)].slice(0, 3);
}

// ============================================
// HEALTH CHECK
// ============================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    agent: 'LangChain + Google Gemini',
    tools: 12,
  });
}