import { createClient } from '@supabase/supabase-js';

// =====================================================
// Cifrado de PII a nivel app
// =====================================================
// Usa las funciones pgcrypto creadas en migración 011:
//   - pii_encrypt(text) → base64 cifrado AES
//   - pii_decrypt(text) → texto plano
//
// Antes de usar hay que setear la key:
//   process.env.PII_ENCRYPTION_KEY = "alguna-key-secreta-base64"
//
// El helper inyecta la key en cada conexión vía
// set_config('app.pii_key', ...).
// =====================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const PII_KEY = process.env.PII_ENCRYPTION_KEY || '';

function getClient(): any {
  return createClient(supabaseUrl, supabaseKey);
}

async function setKey(client: any) {
  if (!PII_KEY) return;
  try {
    await client.rpc('set_config', {
      setting_name: 'app.pii_key',
      new_value: PII_KEY,
      is_local: false,
    });
  } catch { /* set_config puede no estar habilitado en este server */ }
}

/**
 * Cifra un texto plano usando pgcrypto. Si no hay key
 * configurada, devuelve el texto sin cifrar (modo dev).
 */
export async function cifrarPII(plaintext: string | null | undefined): Promise<string | null> {
  if (!plaintext) return null;
  if (!PII_KEY) return plaintext;

  const client = getClient();
  await setKey(client);
  const { data, error } = await client.rpc('pii_encrypt', { plaintext });
  if (error) {
    console.error('cifrarPII error:', error);
    return plaintext;
  }
  return data as string;
}

/**
 * Descifra un valor cifrado. Si la key no está o el dato
 * no estaba cifrado, devuelve el valor original.
 */
export async function descifrarPII(ciphertext: string | null | undefined): Promise<string | null> {
  if (!ciphertext) return null;
  if (!PII_KEY) return ciphertext;

  const client = getClient();
  await setKey(client);
  const { data, error } = await client.rpc('pii_decrypt', { ciphertext });
  if (error) return ciphertext;
  return data as string;
}

/**
 * Cifra varios campos de un objeto en un sólo round-trip.
 * Útil para clientes/proveedores antes de insertar.
 */
export async function cifrarCamposPII<T extends Record<string, any>>(
  obj: T,
  campos: (keyof T)[]
): Promise<T> {
  const result = { ...obj };
  for (const c of campos) {
    if (result[c]) {
      const cifrado = await cifrarPII(String(result[c]));
      (result as any)[c] = cifrado;
    }
  }
  return result;
}

/**
 * Genera una key segura para PII_ENCRYPTION_KEY.
 * Útil para imprimir y poner en .env la primera vez:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */
export function generarKeyEjemplo(): string {
  // Solo usar en scripts, no en runtime real.
  if (typeof require !== 'undefined') {
    try {
      const c = require('crypto');
      return c.randomBytes(32).toString('base64');
    } catch { /* fallback */ }
  }
  return 'configurar-key-real-via-env';
}
