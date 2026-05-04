import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock de variables de entorno comunes para que los módulos
// que las leen no exploten en tests.
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';

// Mock global de console.error para que tests fallen ruidosos
// si algo loguea "Error reservando..." (útil más adelante).
// Por ahora no lo activamos automáticamente.

// Polyfill: crypto.subtle para sha256 en Node antes de v20
// (vitest jsdom puede no traerlo).
if (typeof globalThis.crypto === 'undefined') {
  (globalThis as any).crypto = require('crypto').webcrypto;
}

// Marcador para que los helpers sepan que están en test.
;(globalThis as any).__VITEST__ = true;

void vi;
