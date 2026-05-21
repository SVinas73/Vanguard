// =====================================================
// Email sender — Resend con outbox pattern
// =====================================================
// SIEMPRE graba el email en `email_outbox` antes de intentar
// enviarlo. Eso garantiza que:
//   1. Si Resend está caído, no perdemos el email
//   2. Si la API key no está configurada, queda registrado
//      para auditoría / retry manual
//   3. Tenés trazabilidad completa: cada email enviado
//      queda con quién, cuándo, a quién, qué decía
// =====================================================

import 'server-only';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const RESEND_API_KEY = process.env.RESEND_API_KEY;
// Si no se configura EMAIL_FROM, usamos el remitente de testing de Resend
// (onboarding@resend.dev) que funciona sin dominio verificado. Limitación:
// solo envía al email del owner de la cuenta Resend. Para producción real
// hay que verificar un dominio y setear EMAIL_FROM.
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO;

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export interface EnviarEmailInput {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string[];
  replyTo?: string;
  tags?: Record<string, string>;
  /** Vinculo opcional al objeto que disparó el email (para trazabilidad) */
  entidadTipo?: string;
  entidadId?: string;
  organizacionId?: string;
  creadoPor?: string;
}

export interface EnviarEmailResult {
  ok: boolean;
  outboxId: number;
  proveedorId?: string;
  estado: 'enviado' | 'pendiente' | 'fallido';
  error?: string;
}

/**
 * Encolá y enviá un email. Siempre graba en email_outbox primero.
 * Si Resend no está configurado, queda en estado 'pendiente'.
 * Si Resend falla, queda 'fallido' con el error.
 */
export async function enviarEmail(input: EnviarEmailInput): Promise<EnviarEmailResult> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const toEmails = Array.isArray(input.to) ? input.to : [input.to];

  // 1. Grabar en outbox (siempre, antes de intentar enviar)
  const { data: outbox, error: outboxError } = await supabase
    .from('email_outbox')
    .insert({
      organizacion_id: input.organizacionId || null,
      to_emails: toEmails,
      cc_emails: input.cc || null,
      reply_to: input.replyTo || EMAIL_REPLY_TO || null,
      subject: input.subject,
      body_html: input.html || null,
      body_text: input.text || null,
      tags: input.tags || null,
      entidad_tipo: input.entidadTipo || null,
      entidad_id: input.entidadId || null,
      estado: 'pendiente',
      creado_por: input.creadoPor || null,
    })
    .select('id')
    .single();

  if (outboxError || !outbox) {
    return {
      ok: false,
      outboxId: -1,
      estado: 'fallido',
      error: `Error grabando outbox: ${outboxError?.message}`,
    };
  }

  // 2. Si no hay Resend, queda pendiente y devolvemos
  if (!resend) {
    return {
      ok: false,
      outboxId: outbox.id,
      estado: 'pendiente',
      error: 'RESEND_API_KEY no configurada. Email queda en outbox para retry.',
    };
  }

  // 3. Intentar enviar
  try {
    const resp = await resend.emails.send({
      from: EMAIL_FROM,
      to: toEmails,
      cc: input.cc,
      replyTo: input.replyTo || EMAIL_REPLY_TO,
      subject: input.subject,
      html: input.html || '',
      text: input.text,
      tags: input.tags ? Object.entries(input.tags).map(([name, value]) => ({ name, value })) : undefined,
    });

    if (resp.error) {
      await supabase
        .from('email_outbox')
        .update({
          estado: 'fallido',
          intentos: 1,
          ultimo_error: resp.error.message,
          proveedor: 'resend',
        })
        .eq('id', outbox.id);
      return { ok: false, outboxId: outbox.id, estado: 'fallido', error: resp.error.message };
    }

    await supabase
      .from('email_outbox')
      .update({
        estado: 'enviado',
        intentos: 1,
        proveedor: 'resend',
        proveedor_id: resp.data?.id || null,
        enviado_at: new Date().toISOString(),
      })
      .eq('id', outbox.id);

    return { ok: true, outboxId: outbox.id, proveedorId: resp.data?.id, estado: 'enviado' };
  } catch (err: any) {
    await supabase
      .from('email_outbox')
      .update({
        estado: 'fallido',
        intentos: 1,
        ultimo_error: err?.message || String(err),
        proveedor: 'resend',
      })
      .eq('id', outbox.id);
    return { ok: false, outboxId: outbox.id, estado: 'fallido', error: err?.message };
  }
}

export function estaConfigurado(): boolean {
  return !!RESEND_API_KEY;
}
