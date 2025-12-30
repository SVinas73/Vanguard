import { CategorySuggestion } from '@/types';
import { CATEGORY_KEYWORDS, AI_CONFIG } from '@/lib/constants';

/**
 * Sugiere una categoría basándose en la descripción del producto
 * usando coincidencia de keywords
 */
export function suggestCategory(descripcion: string): CategorySuggestion {
  if (!descripcion || descripcion.length < 3) {
    return { categoria: null, confidence: 0 };
  }

  const desc = descripcion.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const scores: Record<string, number> = {};

  // Calcular score para cada categoría
  for (const [categoria, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    
    for (const keyword of keywords) {
      const normalizedKeyword = keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      
      // Coincidencia exacta = 2 puntos
      if (desc.includes(normalizedKeyword)) {
        score += 2;
      }
      // Coincidencia parcial (primeras 4 letras) = 1 punto
      else if (normalizedKeyword.length >= 4 && desc.includes(normalizedKeyword.slice(0, 4))) {
        score += 1;
      }
    }
    
    scores[categoria] = score;
  }

  // Encontrar la categoría con mayor score
  const maxScore = Math.max(...Object.values(scores));
  
  if (maxScore === 0) {
    return { categoria: null, confidence: 0 };
  }

  const suggestedCategory = Object.entries(scores).find(([_, score]) => score === maxScore)?.[0];
  
  if (!suggestedCategory) {
    return { categoria: null, confidence: 0 };
  }

  // Calcular confianza basada en el score
  const confidence = Math.min(
    AI_CONFIG.MAX_CONFIDENCE,
    0.6 + maxScore * 0.15
  );

  return {
    categoria: suggestedCategory,
    confidence,
  };
}

/**
 * Obtiene las top N categorías sugeridas
 */
export function suggestTopCategories(
  descripcion: string,
  topN: number = 3
): Array<CategorySuggestion> {
  if (!descripcion || descripcion.length < 3) {
    return [];
  }

  const desc = descripcion.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const scores: Array<{ categoria: string; score: number }> = [];

  for (const [categoria, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    
    for (const keyword of keywords) {
      const normalizedKeyword = keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (desc.includes(normalizedKeyword)) {
        score += 2;
      } else if (normalizedKeyword.length >= 4 && desc.includes(normalizedKeyword.slice(0, 4))) {
        score += 1;
      }
    }
    
    if (score > 0) {
      scores.push({ categoria, score });
    }
  }

  return scores
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(({ categoria, score }) => ({
      categoria,
      confidence: Math.min(AI_CONFIG.MAX_CONFIDENCE, 0.6 + score * 0.15),
    }));
}

/**
 * Verifica si una descripción ya tiene keywords de una categoría específica
 */
export function matchesCategory(descripcion: string, categoria: string): boolean {
  const keywords = CATEGORY_KEYWORDS[categoria];
  if (!keywords) return false;

  const desc = descripcion.toLowerCase();
  return keywords.some((kw) => desc.includes(kw.toLowerCase()));
}
