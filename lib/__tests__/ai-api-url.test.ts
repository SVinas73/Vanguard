import { describe, it, expect, afterEach, vi } from 'vitest';

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.resetModules();
});

async function loadFresh() {
  vi.resetModules();
  return await import('../ai/api-url');
}

describe('getAiApiUrl', () => {
  it('prioriza NEXT_PUBLIC_VANGUARD_IA_URL', async () => {
    process.env.NEXT_PUBLIC_VANGUARD_IA_URL = 'https://primary.example.com';
    process.env.NEXT_PUBLIC_AI_API_URL = 'https://secondary.example.com';
    const { getAiApiUrl } = await loadFresh();
    expect(getAiApiUrl()).toBe('https://primary.example.com');
  });

  it('usa NEXT_PUBLIC_AI_API_URL como segunda opción', async () => {
    delete process.env.NEXT_PUBLIC_VANGUARD_IA_URL;
    process.env.NEXT_PUBLIC_AI_API_URL = 'https://secondary.example.com';
    const { getAiApiUrl } = await loadFresh();
    expect(getAiApiUrl()).toBe('https://secondary.example.com');
  });

  it('cae al deploy de Render por defecto (nunca localhost)', async () => {
    delete process.env.NEXT_PUBLIC_VANGUARD_IA_URL;
    delete process.env.NEXT_PUBLIC_AI_API_URL;
    const { getAiApiUrl } = await loadFresh();
    expect(getAiApiUrl()).toBe('https://vanguard-ia.onrender.com');
    expect(getAiApiUrl()).not.toContain('localhost');
  });

  it('elimina el trailing slash', async () => {
    process.env.NEXT_PUBLIC_VANGUARD_IA_URL = 'https://x.example.com/';
    const { getAiApiUrl } = await loadFresh();
    expect(getAiApiUrl()).toBe('https://x.example.com');
  });
});
