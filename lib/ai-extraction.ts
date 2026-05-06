// =====================================================
// AI EXTRACTION — Gemini Vision multimodal
// =====================================================
// Convierte documentos no estructurados (PDFs, imágenes,
// emails) en datos estructurados validables. Usa Gemini
// 2.0 Flash con su soporte multimodal nativo.
//
// Gemini acepta:
//   - PDF (inlineData mimeType: application/pdf)
//   - Imágenes (image/jpeg, image/png, image/webp)
//   - Texto plano
//
// La salida es JSON estructurado validado con Zod (el
// caller pasa el schema esperado).
// =====================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

// =====================================================
// SCHEMAS para los tipos de extracción
// =====================================================

export const facturaExtraidaSchema = z.object({
  proveedor: z.object({
    nombre: z.string(),
    rut: z.string().optional(),
    direccion: z.string().optional(),
    telefono: z.string().optional(),
    email: z.string().optional(),
  }),
  numero_factura: z.string().optional(),
  fecha: z.string().optional(),  // ISO date si se puede
  fecha_vencimiento: z.string().optional(),
  moneda: z.enum(['UYU', 'USD', 'EUR', 'BRL', 'ARS']).optional(),
  items: z.array(z.object({
    descripcion: z.string(),
    codigo: z.string().optional(),
    cantidad: z.number(),
    precio_unitario: z.number(),
    iva_pct: z.number().optional(),
    subtotal: z.number().optional(),
  })),
  subtotal: z.number().optional(),
  iva: z.number().optional(),
  total: z.number(),
  notas: z.string().optional(),
  confianza: z.number().min(0).max(1),
});

export type FacturaExtraida = z.infer<typeof facturaExtraidaSchema>;

export const remitoExtraidoSchema = z.object({
  proveedor: z.string(),
  numero_remito: z.string().optional(),
  fecha: z.string().optional(),
  orden_compra_referencia: z.string().optional(),
  items: z.array(z.object({
    descripcion: z.string(),
    codigo: z.string().optional(),
    cantidad: z.number(),
    lote: z.string().optional(),
    fecha_vencimiento: z.string().optional(),
  })),
  observaciones: z.string().optional(),
  confianza: z.number().min(0).max(1),
});

export type RemitoExtraido = z.infer<typeof remitoExtraidoSchema>;

export const emailExtraidoSchema = z.object({
  tipo: z.enum(['pedido', 'consulta', 'reclamo', 'cotizacion', 'pago', 'otro']),
  remitente: z.object({
    nombre: z.string().optional(),
    email: z.string().optional(),
    telefono: z.string().optional(),
    empresa: z.string().optional(),
  }).optional(),
  asunto_resumido: z.string(),
  productos_mencionados: z.array(z.object({
    descripcion: z.string(),
    cantidad: z.number().optional(),
    codigo_si_se_menciona: z.string().optional(),
  })).optional(),
  monto_si_se_menciona: z.number().optional(),
  fecha_solicitada: z.string().optional(),
  urgencia: z.enum(['baja', 'normal', 'alta', 'critica']).optional(),
  acciones_sugeridas: z.array(z.string()),
  confianza: z.number().min(0).max(1),
});

export type EmailExtraido = z.infer<typeof emailExtraidoSchema>;

// =====================================================
// PROMPTS por tipo
// =====================================================

const PROMPT_FACTURA = `Sos un parser experto de facturas/comprobantes.
Extraé los datos del documento y devolvé SOLO un JSON válido con esta estructura exacta:

{
  "proveedor": {"nombre": "...", "rut": "...", "direccion": "...", "telefono": "...", "email": "..."},
  "numero_factura": "...",
  "fecha": "YYYY-MM-DD",
  "fecha_vencimiento": "YYYY-MM-DD",
  "moneda": "UYU" | "USD" | "EUR" | "BRL" | "ARS",
  "items": [{"descripcion": "...", "codigo": "...", "cantidad": 0, "precio_unitario": 0, "iva_pct": 22, "subtotal": 0}],
  "subtotal": 0,
  "iva": 0,
  "total": 0,
  "notas": "...",
  "confianza": 0.95
}

REGLAS:
- "confianza" es tu certeza global (0-1) sobre la calidad de la extracción.
- Si un campo no aparece, omitilo o ponelo null. Nunca inventes datos.
- Para Uruguay el IVA básico es 22%, mínimo 10%, exento 0%.
- "moneda": detectala. Si dice "$" sin más contexto en UY, asumí UYU. Si dice "U$S" o "USD" → USD.
- Las cantidades como "1.234,56" son formato es-UY → 1234.56. Las que parecen "1,234.56" son en-US.
- Devolvé SOLO el JSON, sin texto adicional, sin markdown.`;

const PROMPT_REMITO = `Sos un parser de remitos/guías de despacho.
Extraé los datos y devolvé SOLO un JSON con esta estructura:

{
  "proveedor": "...",
  "numero_remito": "...",
  "fecha": "YYYY-MM-DD",
  "orden_compra_referencia": "OC-2024-...",
  "items": [{"descripcion": "...", "codigo": "...", "cantidad": 0, "lote": "...", "fecha_vencimiento": "YYYY-MM-DD"}],
  "observaciones": "...",
  "confianza": 0.9
}

Si un campo no aparece, omitilo. NUNCA inventes datos.
Devolvé SOLO el JSON, sin markdown.`;

const PROMPT_EMAIL = `Analizá este email de un cliente/proveedor.
Devolvé SOLO un JSON con esta estructura:

{
  "tipo": "pedido" | "consulta" | "reclamo" | "cotizacion" | "pago" | "otro",
  "remitente": {"nombre": "...", "email": "...", "telefono": "...", "empresa": "..."},
  "asunto_resumido": "Resumen en 1 línea",
  "productos_mencionados": [{"descripcion": "...", "cantidad": 0, "codigo_si_se_menciona": "..."}],
  "monto_si_se_menciona": 0,
  "fecha_solicitada": "YYYY-MM-DD",
  "urgencia": "baja" | "normal" | "alta" | "critica",
  "acciones_sugeridas": ["Crear cotización para X", "Llamar al cliente Y", ...],
  "confianza": 0.9
}

Devolvé SOLO el JSON, sin markdown.`;

// =====================================================
// CORE — extraer JSON con Gemini multimodal
// =====================================================

interface ExtraerArgs {
  prompt: string;
  fileBase64?: string;
  mimeType?: string;
  textInput?: string;
}

async function llamarGemini(args: ExtraerArgs): Promise<string> {
  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new Error('GOOGLE_AI_API_KEY no configurada');
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.1,           // baja temperatura para outputs deterministas
      responseMimeType: 'application/json',
    },
  });

  const parts: any[] = [{ text: args.prompt }];

  if (args.fileBase64 && args.mimeType) {
    parts.push({
      inlineData: { data: args.fileBase64, mimeType: args.mimeType },
    });
  }
  if (args.textInput) {
    parts.push({ text: '\n\n--- DOCUMENTO ---\n' + args.textInput });
  }

  const result = await model.generateContent({
    contents: [{ role: 'user', parts }],
  });

  return result.response.text();
}

function parseJSON(raw: string): unknown {
  // Limpia code fences si Gemini los agrega
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

// =====================================================
// API PÚBLICA — uno por tipo de documento
// =====================================================

export async function extraerFactura(args: { fileBase64: string; mimeType: string }): Promise<FacturaExtraida> {
  const raw = await llamarGemini({
    prompt: PROMPT_FACTURA,
    fileBase64: args.fileBase64,
    mimeType: args.mimeType,
  });
  const json = parseJSON(raw);
  return facturaExtraidaSchema.parse(json);
}

export async function extraerRemito(args: { fileBase64: string; mimeType: string }): Promise<RemitoExtraido> {
  const raw = await llamarGemini({
    prompt: PROMPT_REMITO,
    fileBase64: args.fileBase64,
    mimeType: args.mimeType,
  });
  const json = parseJSON(raw);
  return remitoExtraidoSchema.parse(json);
}

export async function extraerEmail(textoEmail: string): Promise<EmailExtraido> {
  const raw = await llamarGemini({
    prompt: PROMPT_EMAIL,
    textInput: textoEmail,
  });
  const json = parseJSON(raw);
  return emailExtraidoSchema.parse(json);
}

// =====================================================
// HELPERS de archivos
// =====================================================

export function archivoSoportado(file: { type: string; size: number }): {
  ok: boolean; error?: string;
} {
  const allowedMimes = [
    'application/pdf',
    'image/jpeg', 'image/jpg',
    'image/png',
    'image/webp',
  ];
  if (!allowedMimes.includes(file.type)) {
    return { ok: false, error: `Tipo de archivo no soportado: ${file.type}. Aceptados: PDF, JPG, PNG, WEBP.` };
  }
  if (file.size > 20 * 1024 * 1024) {
    return { ok: false, error: 'Archivo demasiado grande (máx 20MB)' };
  }
  return { ok: true };
}

export async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  // En navegador: btoa con string binario; en Node: Buffer
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buf).toString('base64');
  }
  let binary = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
