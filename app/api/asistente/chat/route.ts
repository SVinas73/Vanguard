// ============================================
// API ROUTE: /api/asistente/chat
// Agente LangChain con Streaming
// ============================================

import { NextRequest } from 'next/server';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { allTools } from '@/components/asistente/tools';

// Configuración de runtime
export const runtime = 'nodejs';
export const maxDuration = 60;

// ============================================
// SYSTEM PROMPT
// ============================================

const SYSTEM_PROMPT = `Eres el Asistente Inteligente de Vanguard, un sistema avanzado de gestión de inventario empresarial.

## Tu Personalidad
- Eres profesional, eficiente y amigable
- Respondes siempre en español
- Eres proactivo: si detectas problemas, los mencionas
- Usas emojis ocasionalmente para hacer la conversación más amena (📦 📊 ⚠️ ✅ 💡)

## Tus Capacidades
Tienes acceso a herramientas para:
1. Consultar stock, productos, clientes, proveedores
2. Analizar ventas, compras, tendencias y métricas
3. Predecir demanda y detectar productos críticos
4. Crear movimientos de inventario y órdenes de compra

## Reglas
- SIEMPRE usa las herramientas para obtener datos reales, NO inventes
- Para ACCIONES destructivas (crear, modificar), confirma con el usuario primero
- Sé conciso pero completo en tus respuestas
- Si algo falla, informa al usuario y sugiere alternativas`;

// ============================================
// STREAMING HANDLER
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mensaje, historial = [], contexto } = body;

    if (!mensaje) {
      return new Response(JSON.stringify({ error: 'Mensaje requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!process.env.GOOGLE_AI_API_KEY) {
      return new Response(JSON.stringify({ error: 'API Key no configurada' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Crear encoder para streaming
    const encoder = new TextEncoder();
    
    // Crear stream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Inicializar modelo
          const model = new ChatGoogleGenerativeAI({
            modelName: 'gemini-1.5-flash',
            temperature: 0.7,
            apiKey: process.env.GOOGLE_AI_API_KEY,
            streaming: true,
          });

          // Crear prompt
          const prompt = ChatPromptTemplate.fromMessages([
            ['system', SYSTEM_PROMPT],
            new MessagesPlaceholder('chat_history'),
            ['human', '{input}'],
            new MessagesPlaceholder('agent_scratchpad'),
          ]);

          // Crear agente
          const agent = createToolCallingAgent({
            llm: model,
            tools: allTools,
            prompt,
          });

          // Crear executor
          const executor = new AgentExecutor({
            agent,
            tools: allTools,
            maxIterations: 8,
            returnIntermediateSteps: true,
          });

          // Preparar historial
          const chatHistory = historial.map((msg: any) => 
            msg.rol === 'user' 
              ? new HumanMessage(msg.contenido)
              : new AIMessage(msg.contenido)
          );

          // Variables para tracking
          const toolsUsed: string[] = [];

          // Ejecutar con streaming de eventos
          const eventStream = await executor.streamEvents(
            { input: mensaje, chat_history: chatHistory },
            { version: 'v2' }
          );

          for await (const event of eventStream) {
            const kind = event.event;

            // Cuando empieza a usar una herramienta
            if (kind === 'on_tool_start') {
              const toolName = event.name;
              toolsUsed.push(toolName);
              
              const toolEvent = {
                type: 'tool',
                name: toolName,
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(toolEvent)}\n\n`));
            }

            // Cuando el LLM genera tokens
            if (kind === 'on_chat_model_stream') {
              const chunk = event.data?.chunk;
              if (chunk?.content) {
                const content = typeof chunk.content === 'string' 
                  ? chunk.content 
                  : chunk.content[0]?.text || '';
                
                if (content) {
                  const textEvent = {
                    type: 'text',
                    content: content,
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(textEvent)}\n\n`));
                }
              }
            }
          }

          // Enviar evento final
          const finalEvent = {
            type: 'done',
            toolsUsed,
            sugerencias: generarSugerencias(toolsUsed),
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalEvent)}\n\n`));
          
        } catch (error: any) {
          console.error('Streaming error:', error);
          const errorEvent = {
            type: 'error',
            message: error.message || 'Error procesando solicitud',
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('Error en agente:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ============================================
// GENERAR SUGERENCIAS
// ============================================

function generarSugerencias(toolsUsed: string[]): string[] {
  const sugerencias: string[] = [];

  if (toolsUsed.includes('productos_criticos')) {
    sugerencias.push('Generar orden de compra para críticos');
    sugerencias.push('Ver predicción de demanda');
  }
  if (toolsUsed.includes('metricas_dashboard')) {
    sugerencias.push('Analizar ventas en detalle');
    sugerencias.push('Ver productos críticos');
  }
  if (toolsUsed.includes('analisis_ventas')) {
    sugerencias.push('Comparar con período anterior');
    sugerencias.push('Ver tendencias de productos');
  }
  if (toolsUsed.includes('recomendaciones_reposicion')) {
    sugerencias.push('Crear orden de compra');
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
  return new Response(JSON.stringify({
    status: 'ok',
    agent: 'LangChain + Google Gemini',
    streaming: true,
    tools: 12,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}