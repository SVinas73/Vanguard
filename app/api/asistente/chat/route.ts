// =====================================================
// API ROUTE: /api/asistente/chat
// Asistente IA OMNISCIENTE de Vanguard.
// Lite (sin LangChain) — directo a Gemini 2.0 Flash con
// herramientas + guía de navegación + memoria de sesión.
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ejecutarHerramienta } from '@/lib/asistente/tools';
import { createClient } from '@supabase/supabase-js';
import { parseSafe, chatRequestSchema } from '@/lib/security/zod-schemas';
import { chequearRateLimit, extraerIP } from '@/lib/security/rate-limit';
import { requireAuth } from '@/lib/security/permissions';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

// =====================================================
// SYSTEM PROMPT — OMNISCIENTE + GUÍA + ROL-AWARE
// =====================================================

const SYSTEM_PROMPT = `Eres el ASISTENTE OMNISCIENTE de Vanguard, un sistema de gestión empresarial.
Conoces TODOS los módulos: Comercial (Solicitudes de insumos), Logística (Transacciones entre almacenes,
Stock, Reabastecimiento IA), Post-venta (Taller, Garantías, Tickets de soporte, RMA),
Control & Seguimiento (Trazabilidad de lotes/seriales, Auditoría), Mis empresas y Notificaciones.

ESTILO:
- Respondés en español rioplatense (vos, no tú).
- Conciso, profesional, sin relleno. Vas al grano.
- Si la respuesta tiene datos numéricos, usá viñetas o tablas markdown para que se lea claro.
- Cuando muestres montos, formato 1.234,56 (es-UY).
- Si el usuario está estresado o se nota apurado, mantenete CALMADO y ordenado: una cosa por vez.

HERRAMIENTAS DISPONIBLES (devolvé el JSON exacto cuando necesites usar una):

📦 STOCK / PRODUCTOS:
- consultar_stock {codigo?, categoria?, solo_criticos?}
- buscar_productos {query, limite?}
- productos_criticos {limite?}
- analisis_tendencias {dias?, limite?}
- recomendaciones_reposicion {urgencia?, limite?}

🔧 TALLER:
- ordenes_taller_activas {limite?}
- presupuestos_taller_pendientes {limite?}

📋 RMA:
- rma_abiertos {limite?}

🔍 TRAZABILIDAD:
- trazar_lote {lote_numero}
- trazar_serial {serial}

🔔 NOTIFICACIONES / AUDITORÍA:
- notificaciones_activas {limite?}
- auditoria_recientes {usuario?, tabla?, limite?}

📊 BÚSQUEDA / RESUMEN:
- buscar_global {query}               ← busca productos y órdenes de taller
- resumen_mi_dia {rol?}               ← resumen del día según rol

📍 GUÍA DE LA APP:
- guia_app {tema}                     ← devuelve "dónde está X" y los pasos para hacer Y
  Temas: crear_producto, abrir_ot_taller, presupuesto_taller.

✏️ ESCRITURA (acciones reales — usá con cuidado):
- crear_movimiento {producto_codigo, tipo, cantidad, motivo?}

REGLAS DE USO:
1. PARA USAR UNA HERRAMIENTA respondé SOLO con este JSON (NADA más):
   {"herramienta": "nombre", "parametros": {...}}

2. Si el usuario pregunta "¿dónde está X?" o "¿cómo hago Y?", USÁ guia_app primero.

3. Si pregunta algo amplio como "cómo va el día", usá resumen_mi_dia.

4. Si busca algo sin nombre exacto, usá buscar_global.

5. Si pide hacer una acción que escribe (crear movimiento), CONFIRMÁ primero los datos.

6. Si tu rol no permite una herramienta, te lo dirá el sistema. Sugerí pedirle a un admin.

7. Si NO necesitás herramienta (saludos, agradecimientos, preguntas conceptuales), respondé directo.

8. Si una respuesta requiere combinar datos de múltiples tools, encadenalas (uno por turno).

9. Después de mostrar datos, sugerí 1-2 acciones concretas que el usuario podría tomar.`;

// =====================================================
// MEMORIA DE SESIÓN
// =====================================================

async function obtenerHistorial(sesionId: string): Promise<any[]> {
  if (!sesionId) return [];
  try {
    const { data } = await supabaseAdmin
      .from('chat_sesiones_mensajes')
      .select('rol, contenido, created_at')
      .eq('sesion_id', sesionId)
      .order('created_at', { ascending: true })
      .limit(20);
    return data || [];
  } catch { return []; }
}

async function guardarMensaje(
  sesionId: string,
  rol: 'user' | 'assistant',
  contenido: string,
  toolsUsed: string[] = []
) {
  if (!sesionId) return;
  try {
    await supabaseAdmin.from('chat_sesiones_mensajes').insert({
      sesion_id: sesionId,
      rol,
      contenido,
      tools_used: toolsUsed,
    });
    await supabaseAdmin
      .from('chat_sesiones')
      .update({ ultimo_mensaje_at: new Date().toISOString() })
      .eq('id', sesionId);
  } catch { /* tabla puede no existir aún (pre-migración) */ }
}

async function asegurarSesion(
  sesionId: string | undefined,
  usuarioEmail: string
): Promise<string | null> {
  if (sesionId) return sesionId;
  if (!usuarioEmail) return null;
  try {
    const { data } = await supabaseAdmin
      .from('chat_sesiones')
      .insert({
        usuario_email: usuarioEmail,
        titulo: 'Conversación con Asistente',
      })
      .select('id')
      .single();
    return data?.id || null;
  } catch { return null; }
}

// =====================================================
// HANDLER PRINCIPAL
// =====================================================

export async function POST(request: NextRequest) {
  try {
    // 1. Auth: el chat solo acepta usuarios logueados
    const auth = await requireAuth();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // 2. Validación con Zod
    const body = await request.json().catch(() => ({}));
    const parsed = parseSafe(chatRequestSchema, body);
    if (!parsed.ok) {
      return NextResponse.json(parsed, { status: 400 });
    }
    const { mensaje, historial = [], contexto, sesion_id } = parsed.data;

    if (!process.env.GOOGLE_AI_API_KEY) {
      return NextResponse.json({ error: 'API Key no configurada' }, { status: 500 });
    }

    // 3. Rate limit por usuario (max 60 mensajes / minuto)
    const ip = extraerIP(request);
    const rl = await chequearRateLimit({
      bucket: `chat:${auth.user.email}`,
      max: 60, windowSeconds: 60,
      ip, usuarioEmail: auth.user.email, ruta: '/api/asistente/chat',
    });
    if (rl.bloqueado) {
      return NextResponse.json(
        { error: 'Estás enviando muchos mensajes. Esperá un momento.', retry_after: rl.retryAfterSeconds },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds || 60) } }
      );
    }

    // 4. Forzar contexto al usuario realmente logueado
    // (ignoramos lo que mande el cliente para evitar spoofing)
    const usuarioEmail = auth.user.email;
    const rol = (auth.user.rol || '').toLowerCase();
    const usuarioNombre = auth.user.name || contexto?.usuario_nombre || usuarioEmail.split('@')[0] || 'usuario';

    // Sesión persistente
    const sesionIdActiva = await asegurarSesion(sesion_id || undefined, usuarioEmail);
    const historialPersistente = sesionIdActiva ? await obtenerHistorial(sesionIdActiva) : [];

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Contexto del usuario inyectado en el system prompt
    const contextoUsuario = `
CONTEXTO DEL USUARIO ACTUAL:
- Nombre: ${usuarioNombre}
- Email: ${usuarioEmail}
- Rol: ${rol || 'desconocido'}

ADAPTÁ tus respuestas al rol:
- admin: ve TODO, incluye métricas globales.
- vendedor: foco en stock y post-venta (RMA).
- bodeguero: foco en stock, reabastecimiento y trazabilidad.
- operador: foco en taller / OT.

Si una herramienta falla por permisos, explicá que el rol no la permite y sugerí alternativas.`;

    // Prompt completo
    const promptCompleto = SYSTEM_PROMPT + '\n\n' + contextoUsuario;

    // Mezclar historial persistido + el del cliente (cliente tiene prioridad reciente)
    const historialMezclado = [
      ...historialPersistente.map((m: any) => ({ rol: m.rol, contenido: m.contenido })),
      ...historial,
    ].slice(-10);

    const history = historialMezclado.map((msg: any) => ({
      role: msg.rol === 'user' ? 'user' : 'model',
      parts: [{ text: msg.contenido }],
    }));

    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: promptCompleto }] },
        { role: 'model', parts: [{ text: `Entendido. Soy el Asistente Omnisciente de Vanguard. Hola ${usuarioNombre}, ¿en qué te ayudo?` }] },
        ...history,
      ],
    });

    const result = await chat.sendMessage(mensaje);
    let respuesta = result.response.text();

    // Loop: ejecutar herramientas hasta que el modelo deje de pedirlas
    const toolsUsed: string[] = [];
    let intentos = 0;
    const maxIntentos = 4;

    while (intentos < maxIntentos) {
      const toolMatch = respuesta.match(/\{[\s\S]*?"herramienta"[\s\S]*?\}/);
      if (!toolMatch) break;

      try {
        const toolCall = JSON.parse(toolMatch[0]);
        if (!toolCall.herramienta) break;

        toolsUsed.push(toolCall.herramienta);

        const toolResult = await ejecutarHerramienta(
          toolCall.herramienta,
          toolCall.parametros || {},
          usuarioEmail || 'sistema',
          rol
        );

        const followUp = await chat.sendMessage(
          `Resultado de ${toolCall.herramienta}:\n${JSON.stringify(toolResult, null, 2)}\n\n` +
          `Generá una respuesta clara y útil basada en estos datos. ` +
          `NO uses formato JSON, respondé en texto natural en español rioplatense. ` +
          `Si el resultado tiene "error", explicá amablemente qué pasó y sugerí qué hacer.`
        );
        respuesta = followUp.response.text();
      } catch {
        break;
      }
      intentos++;
    }

    // Limpiar JSONs residuales
    respuesta = respuesta.replace(/```json[\s\S]*?```/g, '').trim();
    respuesta = respuesta.replace(/\{[\s\S]*?"herramienta"[\s\S]*?\}/g, '').trim();

    const sugerencias = generarSugerencias(toolsUsed, rol);

    // Persistir mensajes
    if (sesionIdActiva) {
      await guardarMensaje(sesionIdActiva, 'user', mensaje);
      await guardarMensaje(sesionIdActiva, 'assistant', respuesta, toolsUsed);
    }

    return NextResponse.json({
      respuesta,
      sesion_id: sesionIdActiva,
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

// =====================================================
// SUGERENCIAS DE SEGUIMIENTO  (ahora rol-aware)
// =====================================================

function generarSugerencias(toolsUsed: string[], rol: string): string[] {
  const s: string[] = [];

  // Sugerencias contextuales según herramienta usada
  if (toolsUsed.includes('productos_criticos')) s.push('Generá recomendaciones de reposición');
  if (toolsUsed.includes('ordenes_taller_activas')) s.push('¿Qué presupuestos están esperando aprobación del cliente?');

  // Sugerencias por rol si no hay específicas
  if (s.length === 0) {
    if (rol === 'admin') {
      s.push('Resumen de hoy', 'Productos críticos', 'Auditoría reciente');
    } else if (rol === 'vendedor') {
      s.push('Productos críticos', 'RMA abiertos', '¿Cómo está el inventario?');
    } else if (rol === 'bodeguero') {
      s.push('Productos críticos', 'Recomendaciones de reposición', 'Tendencias de consumo');
    } else if (rol === 'operador') {
      s.push('OT activas', 'Presupuestos esperando respuesta', 'Productos críticos');
    } else {
      s.push('¿Cómo está el inventario?', 'Resumen de hoy', '¿Cómo creo un producto?');
    }
  }

  return [...new Set(s)].slice(0, 3);
}

// =====================================================
// HEALTH CHECK
// =====================================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    agent: 'Vanguard Omnisciente (Gemini 2.0 Flash)',
    tools: 16,
    features: ['memoria_sesion', 'role_awareness', 'guia_navegacion', 'busqueda_global'],
  });
}
