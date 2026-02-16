// ============================================
// AGENTE LANGCHAIN CON GOOGLE GEMINI
// ============================================

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { BufferMemory, ChatMessageHistory } from 'langchain/memory';
import { allTools } from './tools';

// ============================================
// SYSTEM PROMPT DEL AGENTE
// ============================================

const SYSTEM_PROMPT = `Eres el Asistente Inteligente de Vanguard, un sistema avanzado de gestión de inventario empresarial.

## Tu Personalidad
- Eres profesional, eficiente y amigable
- Respondes siempre en español
- Eres proactivo: si detectas problemas, los mencionas
- Usas emojis ocasionalmente para hacer la conversación más amena (📦 📊 ⚠️ ✅ 💡)
- Formateas números grandes con separadores y montos con 2 decimales

## Tus Capacidades
1. **Consultas**: Stock, productos, ventas, compras, clientes, proveedores
2. **Análisis**: Tendencias, métricas, KPIs, comparaciones
3. **Predicciones**: Demanda futura, agotamiento de stock
4. **Acciones**: Crear movimientos de inventario, generar órdenes de compra

## Reglas Importantes
- SIEMPRE usa las herramientas disponibles para obtener datos reales
- NUNCA inventes datos o estadísticas
- Para ACCIONES (crear movimiento, crear orden), CONFIRMA con el usuario antes de ejecutar
- Si una herramienta falla, informa al usuario y sugiere alternativas
- Cuando muestres listas largas, resume los puntos clave primero

## Formato de Respuestas
- Usa viñetas para listas
- Resalta números importantes
- Incluye contexto y recomendaciones cuando sea relevante
- Si hay problemas críticos (stock agotado, etc), menciónalos prominentemente

## Ejemplo de Interacción
Usuario: "¿Cómo está el inventario?"
Tú: Primero uso metricas_dashboard, luego productos_criticos, y doy un resumen ejecutivo con las métricas clave y alertas.`;

// ============================================
// CREAR AGENTE
// ============================================

export async function createAgent(conversationHistory: Array<{ rol: string; contenido: string }> = []) {
  // Inicializar modelo
  const model = new ChatGoogleGenerativeAI({
    modelName: 'gemini-1.5-flash',
    temperature: 0.7,
    apiKey: process.env.GOOGLE_AI_API_KEY,
  });

  // Crear prompt template
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', SYSTEM_PROMPT],
    new MessagesPlaceholder('chat_history'),
    ['human', '{input}'],
    new MessagesPlaceholder('agent_scratchpad'),
  ]);

  // Crear agente con tool calling
  const agent = createToolCallingAgent({
    llm: model,
    tools: allTools,
    prompt,
  });

  // Crear historial de mensajes
  const messageHistory = new ChatMessageHistory();
  
  // Agregar historial previo
  for (const msg of conversationHistory) {
    if (msg.rol === 'user') {
      await messageHistory.addMessage(new HumanMessage(msg.contenido));
    } else if (msg.rol === 'assistant') {
      await messageHistory.addMessage(new AIMessage(msg.contenido));
    }
  }

  // Crear memoria
  const memory = new BufferMemory({
    memoryKey: 'chat_history',
    chatHistory: messageHistory,
    returnMessages: true,
    inputKey: 'input',
    outputKey: 'output',
  });

  // Crear executor
  const executor = new AgentExecutor({
    agent,
    tools: allTools,
    memory,
    verbose: process.env.NODE_ENV === 'development',
    maxIterations: 10,
    returnIntermediateSteps: true,
    handleParsingErrors: (error) => {
      console.error('Agent parsing error:', error);
      return 'Hubo un error procesando la solicitud. Por favor, intenta reformular tu pregunta.';
    },
  });

  return executor;
}

// ============================================
// EJECUTAR AGENTE
// ============================================

export interface AgentResult {
  respuesta: string;
  toolCalls: Array<{
    nombre: string;
    argumentos: Record<string, any>;
    resultado: any;
  }>;
  razonamiento?: string;
}

export async function runAgent(
  input: string,
  conversationHistory: Array<{ rol: string; contenido: string }> = []
): Promise<AgentResult> {
  const executor = await createAgent(conversationHistory);

  const result = await executor.invoke({
    input,
  });

  // Extraer tool calls de los pasos intermedios
  const toolCalls = (result.intermediateSteps || []).map((step: any) => ({
    nombre: step.action.tool,
    argumentos: step.action.toolInput,
    resultado: step.observation,
  }));

  return {
    respuesta: result.output,
    toolCalls,
  };
}