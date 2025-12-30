import { Product, SearchResult } from '@/types';

/**
 * Búsqueda semántica simple basada en coincidencia de palabras
 * Sin embeddings externos - 100% local
 */
export function semanticSearch(query: string, products: Product[]): SearchResult[] {
  if (!query.trim()) {
    return products.map((p) => ({ ...p, searchScore: 0 }));
  }

  // Normalizar y tokenizar query
  const queryWords = normalizeText(query).split(/\s+/).filter((w) => w.length > 1);

  if (queryWords.length === 0) {
    return products.map((p) => ({ ...p, searchScore: 0 }));
  }

  const results: SearchResult[] = products.map((product) => {
    // Tokenizar campos del producto
    const descWords = normalizeText(product.descripcion).split(/\s+/);
    const catWords = normalizeText(product.categoria).split(/\s+/);
    const codeWords = normalizeText(product.codigo).split(/[-_]/);
    
    const allProductWords = [...descWords, ...catWords, ...codeWords];

    let score = 0;

    for (const qWord of queryWords) {
      for (const pWord of allProductWords) {
        // Coincidencia exacta = 3 puntos
        if (pWord === qWord) {
          score += 3;
        }
        // Producto contiene query word = 2 puntos
        else if (pWord.includes(qWord)) {
          score += 2;
        }
        // Query word contiene producto = 1 punto
        else if (qWord.includes(pWord) && pWord.length >= 3) {
          score += 1;
        }
        // Similitud por prefijo (mínimo 3 chars) = 1 punto
        else if (pWord.length >= 3 && qWord.length >= 3) {
          const minLen = Math.min(pWord.length, qWord.length, 4);
          if (pWord.slice(0, minLen) === qWord.slice(0, minLen)) {
            score += 1;
          }
        }
      }
    }

    // Bonus si el código coincide exactamente
    if (normalizeText(product.codigo).includes(normalizeText(query))) {
      score += 5;
    }

    return { ...product, searchScore: score };
  });

  // Filtrar solo los que tienen score > 0 y ordenar
  return results
    .filter((r) => r.searchScore > 0)
    .sort((a, b) => b.searchScore - a.searchScore);
}

/**
 * Normaliza texto para búsqueda
 * - Convierte a minúsculas
 * - Elimina acentos
 * - Elimina caracteres especiales
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/[^a-z0-9\s-]/g, '') // Solo alfanuméricos
    .trim();
}

/**
 * Búsqueda con filtro de categoría
 */
export function searchWithCategory(
  query: string,
  products: Product[],
  categoria?: string
): SearchResult[] {
  let filtered = products;
  
  if (categoria && categoria !== 'all') {
    filtered = products.filter((p) => p.categoria === categoria);
  }

  if (!query.trim()) {
    return filtered.map((p) => ({ ...p, searchScore: 0 }));
  }

  return semanticSearch(query, filtered);
}

/**
 * Sugerencias de autocompletado
 */
export function getSearchSuggestions(
  partialQuery: string,
  products: Product[],
  maxSuggestions: number = 5
): string[] {
  if (partialQuery.length < 2) return [];

  const normalized = normalizeText(partialQuery);
  const suggestions = new Set<string>();

  for (const product of products) {
    // Sugerir descripciones que empiecen con el query
    const descNorm = normalizeText(product.descripcion);
    if (descNorm.startsWith(normalized) || descNorm.includes(normalized)) {
      suggestions.add(product.descripcion);
    }

    // Sugerir códigos
    if (normalizeText(product.codigo).includes(normalized)) {
      suggestions.add(product.codigo);
    }

    if (suggestions.size >= maxSuggestions) break;
  }

  return Array.from(suggestions).slice(0, maxSuggestions);
}
