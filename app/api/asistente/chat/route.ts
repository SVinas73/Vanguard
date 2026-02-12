// ============================================
// API ROUTE: /api/asistente/chat
// Asistente IA con Google Gemini
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ejecutarHerramienta } from '@/components/asistente/tools';
import { HERRAMIENTAS_DISPONIBLES } from '@/components/asistente/types';

// Inicializar Google AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

// ============================================
// SYSTEM PROMPT
// ============================================

const SYSTEM_PROMPT = `Eres el Asistente de Vanguard, un sistema de gestión de inventario empresarial avanzado. Tu rol es ayudar a los usuarios a:

1. **Consultar información**: Stock, productos, órdenes, clientes, proveedores
2. **Analizar datos**: Ventas, compras, tendencias, predicciones de demanda
3. **Ejecutar acciones**: Crear movimientos de inventario, generar órdenes de compra

## Personalidad
- Eres profesional pero amigable
- Respondes en español
- Eres conciso pero completo
- Usas datos concretos cuando es posible
- Sugieres acciones proactivamente cuando detectas problemas

## Reglas importantes
- SIEMPRE usa las herramientas disponibles para obtener datos reales
- NO inventes datos, siempre consulta primero
- Si necesitas ejecutar una ACCIÓN (crear movimiento, crear orden), CONFIRMA con el usuario antes
- Formatea los números con separadores de miles y 2 decimales cuando sean montos
- Usa emojis ocasionalmente para hacer la conversación más amigable (📦 📊 ⚠️ ✅)

## Herramientas disponibles
${HERRAMIENTAS_DISPONIBLES.map(h => `- ${h.id}: ${h.descripcion}`).join('\n')}

Cuando necesites usar una herramienta, responde con un JSON en el siguiente formato:
\`\`\`tool
{
  "herramienta": "nombre_herramienta",
  "parametros": { ... }
}
\`\`\`

Puedes usar múltiples herramientas en una sola respuesta si es necesario.`;

// ============================================
// FUNCIÓN PARA EXTRAER LLAMADAS A HERRAMIENTAS
// ============================================

function extractToolCalls(text: string): Array<{ herramienta: string; parametros: any }> {
  const toolCalls: Array<{ herramienta: string; parametros: any }> = [];
  const regex = /```tool\s*([\s\S]*?)```/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.herramienta) {
        toolCalls.push(parsed);
      }
    } catch (e) {
      console.error('Error parsing tool call:', e);
    }
  }

  return toolCalls;
}

// ============================================
// FUNCIÓN PARA LIMPIAR RESPUESTA
// ============================================

function cleanResponse(text: string): string {
  // Remover bloques de herramientas de la respuesta final
  return text.replace(/```tool[\s\S]*?```/g, '').trim();
}

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
      return NextResponse.json({ error: 'API Key de Google AI no configurada' }, { status: 500 });
    }

    // Preparar el modelo
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
      },
    });

    // Construir historial de chat
    const chatHistory = historial.map((msg: any) => ({
      role: msg.rol === 'user' ? 'user' : 'model',
      parts: [{ text: msg.contenido }],
    }));

    // Iniciar chat con contexto
    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: `Sistema: ${SYSTEM_PROMPT}\n\nContexto del usuario: ${JSON.stringify(contexto || {})}` }],
        },
        {
          role: 'model',
          parts: [{ text: 'Entendido. Soy el Asistente de Vanguard y estoy listo para ayudarte. ¿En qué puedo asistirte hoy?' }],
        },
        ...chatHistory,
      ],
    });

    // Enviar mensaje inicial
    let result = await chat.sendMessage(mensaje);
    let responseText = result.response.text();

    // Procesar llamadas a herramientas (máximo 5 iteraciones para evitar loops)
    const herramientasUsadas: Array<{ herramienta: string; parametros: any; resultado: any }> = [];
    let iteraciones = 0;
    const maxIteraciones = 5;

    while (iteraciones < maxIteraciones) {
      const toolCalls = extractToolCalls(responseText);
      
      if (toolCalls.length === 0) break;

      // Ejecutar todas las herramientas
      const resultados: string[] = [];
      
      for (const call of toolCalls) {
        console.log(`Ejecutando herramienta: ${call.herramienta}`, call.parametros);
        
        const resultado = await ejecutarHerramienta(
          call.herramienta,
          call.parametros,
          { usuario_email: contexto?.usuario_email || 'sistema' }
        );

        herramientasUsadas.push({
          herramienta: call.herramienta,
          parametros: call.parametros,
          resultado,
        });

        resultados.push(`Resultado de ${call.herramienta}:\n${JSON.stringify(resultado, null, 2)}`);
      }

      // Enviar resultados al modelo para que genere respuesta final
      result = await chat.sendMessage(
        `Resultados de las herramientas ejecutadas:\n\n${resultados.join('\n\n')}\n\nPor favor, genera una respuesta clara y útil para el usuario basándote en estos resultados.`
      );
      responseText = result.response.text();
      iteraciones++;
    }

    // Limpiar respuesta final
    const respuestaFinal = cleanResponse(responseText);

    // Generar sugerencias de seguimiento
    const sugerencias = generarSugerencias(mensaje, herramientasUsadas);

    return NextResponse.json({
      respuesta: respuestaFinal,
      herramientas_usadas: herramientasUsadas,
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
// GENERAR SUGERENCIAS DE SEGUIMIENTO
// ============================================

function generarSugerencias(
  mensajeOriginal: string,
  herramientasUsadas: Array<{ herramienta: string; parametros: any; resultado: any }>
): string[] {
  const sugerencias: string[] = [];

  // Basado en las herramientas usadas
  for (const h of herramientasUsadas) {
    switch (h.herramienta) {
      case 'productos_criticos':
        sugerencias.push('Generar orden de compra para productos críticos');
        sugerencias.push('Ver recomendaciones de reposición detalladas');
        break;
      case 'consultar_producto':
        sugerencias.push('Ver predicción de demanda para este producto');
        sugerencias.push('Crear movimiento de inventario');
        break;
      case 'analisis_ventas':
        sugerencias.push('Comparar con período anterior');
        sugerencias.push('Ver tendencias de productos');
        break;
      case 'recomendaciones_reposicion':
        sugerencias.push('Crear órdenes de compra sugeridas');
        break;
      case 'metricas_dashboard':
        sugerencias.push('Ver análisis de ventas detallado');
        sugerencias.push('Ver productos críticos');
        break;
    }
  }

  // Limitar a 3 sugerencias únicas
  return [...new Set(sugerencias)].slice(0, 3);
}