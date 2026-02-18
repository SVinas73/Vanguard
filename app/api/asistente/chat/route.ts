// ============================================
// API ROUTE: /api/asistente/chat
// Agente Lite - Sin LangChain (rápido)
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ejecutarHerramienta } from '@/components/asistente/tools';

// ============================================
// CONFIGURACIÓN
// ============================================

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

const SYSTEM_PROMPT = `Eres el Asistente de Vanguard, un sistema de gestión de inventario. Respondes en español, eres conciso y profesional.

HERRAMIENTAS DISPONIBLES (usa el formato exacto):
- consultar_stock: Ver stock de productos. Params: {codigo?, categoria?, solo_criticos?}
- buscar_productos: Buscar por nombre/código. Params: {query, limite?}
- productos_criticos: Listar productos con stock bajo. Params: {limite?}
- analisis_ventas: Analizar ventas. Params: {periodo: "hoy"|"semana"|"mes"|"año"}
- analisis_compras: Analizar compras. Params: {periodo?}
- metricas_dashboard: Resumen general del negocio. Params: {periodo?}
- analisis_tendencias: Ver tendencias de productos. Params: {dias?, limite?}
- recomendaciones_reposicion: Qué productos reponer. Params: {urgencia?, limite?}
- consultar_proveedores: Listar proveedores. Params: {query?, limite?}
- crear_movimiento: Crear entrada/salida de stock. Params: {producto_codigo, tipo, cantidad, motivo?}
- crear_orden_compra: Crear OC. Params: {proveedor_id, productos: [{codigo, cantidad, precio}], notas?}

PARA USAR UNA HERRAMIENTA responde SOLO con este JSON:
{"herramienta": "nombre", "parametros": {...}}

Si NO necesitas herramienta, responde normalmente en texto.
Si el usuario pregunta algo que requiere datos, USA la herramienta primero.`;

// ============================================
// HANDLER PRINCIPAL
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mensaje, historial = [], contexto } = body;

    if (!mensaje) {
      return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 });
    }

    if (!process.env.GOOGLE_AI_API_KEY) {
      return NextResponse.json({ error: 'API Key no configurada' }, { status: 500 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Construir historial para Gemini
    const history = historial.slice(-6).map((msg: any) => ({
      role: msg.rol === 'user' ? 'user' : 'model',
      parts: [{ text: msg.contenido }],
    }));

    // Primera llamada: decidir si usar herramienta
    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
        { role: 'model', parts: [{ text: 'Entendido. Soy el asistente de Vanguard. ¿En qué puedo ayudarte?' }] },
        ...history,
      ],
    });

    const result = await chat.sendMessage(mensaje);
    let respuesta = result.response.text();

    // Verificar si quiere usar herramienta
    const toolsUsed: string[] = [];
    let intentos = 0;
    const maxIntentos = 3;

    while (intentos < maxIntentos) {
      const toolMatch = respuesta.match(/\{[\s\S]*"herramienta"[\s\S]*\}/);
      
      if (!toolMatch) break;

      try {
        const toolCall = JSON.parse(toolMatch[0]);
        
        if (toolCall.herramienta) {
          toolsUsed.push(toolCall.herramienta);
          
          // Ejecutar herramienta
          const toolResult = await ejecutarHerramienta(
            toolCall.herramienta,
            toolCall.parametros || {},
            contexto?.usuario_email || 'sistema'
          );

          // Enviar resultado al modelo para que genere respuesta
          const followUp = await chat.sendMessage(
            `Resultado de ${toolCall.herramienta}:\n${JSON.stringify(toolResult, null, 2)}\n\nGenera una respuesta clara y útil para el usuario basándote en estos datos. NO uses formato JSON, responde en texto natural.`
          );
          
          respuesta = followUp.response.text();
        } else {
          break;
        }
      } catch (e) {
        break;
      }
      
      intentos++;
    }

    // Limpiar respuesta de posibles JSONs residuales
    respuesta = respuesta.replace(/```json[\s\S]*?```/g, '').trim();
    respuesta = respuesta.replace(/\{[\s\S]*"herramienta"[\s\S]*\}/g, '').trim();

    // Generar sugerencias
    const sugerencias = generarSugerencias(toolsUsed);

    return NextResponse.json({
      respuesta,
      tool_calls: toolsUsed.map(t => ({ nombre: t })),
      sugerencias,
    });

  } catch (error: any) {
    console.error('Error en asistente:', error);
    return NextResponse.json(
      { error: error.message || 'Error procesando solicitud' },
      { status: 500 }
    );
  }
}

// ============================================
// GENERAR SUGERENCIAS
// ============================================

function generarSugerencias(toolsUsed: string[]): string[] {
  const sugerencias: string[] = [];

  if (toolsUsed.includes('productos_criticos')) {
    sugerencias.push('Ver recomendaciones de reposición');
  }
  if (toolsUsed.includes('metricas_dashboard')) {
    sugerencias.push('Analizar ventas en detalle');
    sugerencias.push('Ver productos críticos');
  }
  if (toolsUsed.includes('analisis_ventas')) {
    sugerencias.push('Ver tendencias de productos');
  }
  if (toolsUsed.includes('recomendaciones_reposicion')) {
    sugerencias.push('Ver proveedores disponibles');
  }

  if (sugerencias.length === 0) {
    sugerencias.push('¿Cómo está el inventario?');
    sugerencias.push('Ver productos críticos');
    sugerencias.push('Analizar ventas del mes');
  }

  return [...new Set(sugerencias)].slice(0, 3);
}

// ============================================
// HEALTH CHECK
// ============================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    agent: 'Gemini Lite (sin LangChain)',
    tools: 11,
  });
}