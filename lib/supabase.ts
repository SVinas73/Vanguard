import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================
// CONFIGURACIÓN BASE
// ============================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Manejar expiración de sesión automáticamente
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED') {
      console.log('[Auth] Token renovado automáticamente');
    }
    if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
      console.log('[Auth] Sesión expirada, redirigiendo a login...');
      window.location.href = '/login';
    }
  });
}

// ============================================
// TIPOS
// ============================================

interface QueryOptions {
  timeout?: number;      // Timeout en ms (default: 10000)
  retries?: number;      // Número de reintentos (default: 1)
  retryDelay?: number;   // Delay entre reintentos en ms (default: 1000)
}

interface SafeQueryResult<T> {
  data: T | null;
  error: SafeQueryError | null;
  timedOut: boolean;
  retried: boolean;
}

interface SafeQueryError {
  message: string;
  code?: string;
  isTimeout?: boolean;
  isNetworkError?: boolean;
}

// ============================================
// UTILIDADES
// ============================================

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isNetworkError = (error: any): boolean => {
  if (!error) return false;
  const message = error.message?.toLowerCase() || '';
  return (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('connection') ||
    message.includes('offline') ||
    error.name === 'TypeError'
  );
};

// ============================================
// WRAPPER PRINCIPAL
// ============================================

/**
 * Ejecuta una query de Supabase con timeout y reintentos
 * 
 * @example
 * const { data, error, timedOut } = await safeQuery(
 *   () => supabase.from('productos').select('*'),
 *   { timeout: 10000, retries: 1 }
 * );
 */
export async function safeQuery<T>(
  queryFn: () => PromiseLike<{ data: T | null; error: any }>,
  options: QueryOptions = {}
): Promise<SafeQueryResult<T>> {
  const {
    timeout = 30000,
    retries = 2,
    retryDelay = 2000,
  } = options;

  let lastError: SafeQueryError | null = null;
  let retried = false;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      retried = true;
      console.log(`[Supabase] Reintento ${attempt}/${retries}...`);
      await delay(retryDelay);
    }

    try {
      // Crear promesa con timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('TIMEOUT'));
        }, timeout);
      });

      // Ejecutar query con race contra timeout
      const result = await Promise.race([
        queryFn(),
        timeoutPromise,
      ]);

      // Si hay error de Supabase, guardarlo pero permitir reintento
      if (result.error) {
        lastError = {
          message: result.error.message || 'Error desconocido',
          code: result.error.code,
          isNetworkError: isNetworkError(result.error),
        };
        
        // Si es error de red, reintentar
        if (isNetworkError(result.error) && attempt < retries) {
          continue;
        }
        
        // Si no es error de red, devolver el error inmediatamente
        return {
          data: null,
          error: lastError,
          timedOut: false,
          retried,
        };
      }

      // Éxito
      return {
        data: result.data,
        error: null,
        timedOut: false,
        retried,
      };

    } catch (err: any) {
      // Timeout
      if (err.message === 'TIMEOUT') {
        lastError = {
          message: 'La consulta tardó demasiado. Verificá tu conexión.',
          isTimeout: true,
        };
        console.warn(`[Supabase] Timeout después de ${timeout}ms`);
        continue; // Reintentar si quedan intentos
      }

      // Error de red u otro
      lastError = {
        message: err.message || 'Error de conexión',
        isNetworkError: isNetworkError(err),
      };
      
      console.error('[Supabase] Error:', err);
      
      // Si es error de red y quedan reintentos, continuar
      if (isNetworkError(err) && attempt < retries) {
        continue;
      }
    }
  }

  // Si llegamos aquí, todos los intentos fallaron
  return {
    data: null,
    error: lastError || { message: 'Error desconocido después de reintentos' },
    timedOut: lastError?.isTimeout || false,
    retried,
  };
}

// ============================================
// HELPERS ESPECÍFICOS
// ============================================

/**
 * Fetch seguro para listas (SELECT múltiple)
 */
export async function safeFetch<T>(
  table: string,
  query?: (q: any) => any,
  options?: QueryOptions
): Promise<SafeQueryResult<T[]>> {
  return safeQuery<T[]>(() => {
    let q = supabase.from(table).select('*');
    if (query) q = query(q);
    return q;
  }, options);
}

/**
 * Fetch seguro para un solo registro
 */
export async function safeFetchOne<T>(
  table: string,
  column: string,
  value: any,
  options?: QueryOptions
): Promise<SafeQueryResult<T>> {
  return safeQuery<T>(() => 
    supabase.from(table).select('*').eq(column, value).single(),
    options
  );
}

/**
 * Insert seguro
 */
export async function safeInsert<T>(
  table: string,
  data: any,
  options?: QueryOptions
): Promise<SafeQueryResult<T>> {
  return safeQuery<T>(() => 
    supabase.from(table).insert(data).select().single(),
    options
  );
}

/**
 * Update seguro
 */
export async function safeUpdate<T>(
  table: string,
  data: any,
  column: string,
  value: any,
  options?: QueryOptions
): Promise<SafeQueryResult<T>> {
  return safeQuery<T>(() => 
    supabase.from(table).update(data).eq(column, value).select().single(),
    options
  );
}

/**
 * Delete seguro
 */
export async function safeDelete(
  table: string,
  column: string,
  value: any,
  options?: QueryOptions
): Promise<SafeQueryResult<null>> {
  return safeQuery<null>(() => 
    supabase.from(table).delete().eq(column, value),
    options
  );
}

// ============================================
// HOOK PARA ESTADO DE CONEXIÓN
// ============================================

let connectionStatus: 'online' | 'offline' | 'slow' = 'online';
let lastSuccessfulQuery = Date.now();

export function getConnectionStatus() {
  return connectionStatus;
}

export function updateConnectionStatus(success: boolean, duration?: number) {
  if (success) {
    lastSuccessfulQuery = Date.now();
    connectionStatus = duration && duration > 5000 ? 'slow' : 'online';
  } else {
    // Si la última query exitosa fue hace más de 30 segundos, marcar offline
    if (Date.now() - lastSuccessfulQuery > 30000) {
      connectionStatus = 'offline';
    }
  }
}

// ============================================
// VERIFICAR CONEXIÓN
// ============================================

export async function checkConnection(): Promise<boolean> {
  const start = Date.now();
  const { error } = await safeQuery(
    () => supabase.from('productos').select('codigo').limit(1),
    { timeout: 5000, retries: 0 }
  );
  
  const duration = Date.now() - start;
  const success = !error;
  
  updateConnectionStatus(success, duration);
  
  return success;
}