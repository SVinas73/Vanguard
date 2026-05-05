import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { parseSafe, registerSchema } from '@/lib/security/zod-schemas';
import { chequearRateLimit, extraerIP } from '@/lib/security/rate-limit';
import { registrarAuditoriaSegura, extraerContextoAudit } from '@/lib/security/audit-enhanced';

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limit por IP (max 5 registros / hora)
    const ip = extraerIP(request);
    const rl = await chequearRateLimit({
      bucket: `auth:register:${ip}`,
      max: 5, windowSeconds: 3600,
      ip, ruta: '/api/auth/register',
    });
    if (rl.bloqueado) {
      return NextResponse.json(
        { error: 'Demasiados intentos de registro desde esta IP', retry_after: rl.retryAfterSeconds },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds || 60) } }
      );
    }

    // 2. Validación con Zod
    const body = await request.json().catch(() => ({}));
    const parsed = parseSafe(registerSchema, body);
    if (!parsed.ok) {
      return NextResponse.json(parsed, { status: 400 });
    }
    const { email, password, name, role } = parsed.data;

    // 3. Verificar duplicado
    const { data: existingUser } = await supabase
      .from('users').select('email').eq('email', email).maybeSingle();
    if (existingUser) {
      return NextResponse.json({ error: 'Este email ya está registrado' }, { status: 409 });
    }

    // 4. Hash + insert
    const hashedPassword = await bcrypt.hash(password, 12);

    const { data: user, error } = await supabase
      .from('users')
      .insert([{
        email,
        password: hashedPassword,
        name: name || null,
        role,
      }])
      .select()
      .single();

    if (error) throw error;

    // 5. Auditoría enhanced
    await registrarAuditoriaSegura({
      tabla: 'users',
      accion: 'REGISTRAR_USUARIO',
      codigo: user.email,
      datosNuevos: { email: user.email, role },
      usuarioEmail: user.email,
      contexto: extraerContextoAudit(request),
    });

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
    });

  } catch (error: any) {
    console.error('Error en registro:', error);
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 });
  }
}
