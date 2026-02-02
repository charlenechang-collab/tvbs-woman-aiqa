import { Article, RagContext } from '../types';

/**
 * Generates bigrams (2-character tokens) from text for better Chinese matching
 */
function getBigrams(text: string): Set<string> {
  if (!text) return new Set();
  const cleanText = text.replace(/[^\w\u4e00-\u9fa5]+/g, '').toLowerCase();
  const bigrams = new Set<string>();
  for (let i = 0; i < cleanText.length - 1; i++) {
    bigrams.add(cleanText.slice(i, i + 2));
  }
  return bigrams;
}

/**
 * Calculate relevance score based on bigram overlap.
 */
function calculateRelevance(inputText: string, article: Article): number {
  if (!inputText || !article.content) return 0;
  
  const inputBigrams = getBigrams(inputText);
  // Optimization: Don't generate set for article, just check string inclusion for input bigrams?
  // Actually, searching for every bigram in a long article string is O(N*M).
  // Creating a set of article bigrams is better for O(1) lookup.
  
  // However, for pure simplicity and "good enough" for short demos:
  const articleContent = (article.title + article.content).toLowerCase();
  
  let matchCount = 0;
  inputBigrams.forEach(gram => {
    if (articleContent.includes(gram)) {
      matchCount++;
    }
  });

  return matchCount;
}

export const findRelevantArticles = (
  inputText: string,
  database: Article[],
  topK: number = 5
): RagContext[] => {
  if (!database || database.length === 0) return [];

  // 1. Relaxed filtering: Allow shorter content (e.g. 20 chars) to avoid filtering out everything if data is sparse
  const validDb = database.filter(a => a.content && a.content.length > 20);

  // If filtering removed everything, try to fallback to original db if possible, or just return empty
  const dbToUse = validDb.length > 0 ? validDb : database;
  
  // If still empty (e.g. database has items but content is all undefined/empty), return empty
  if (dbToUse.length === 0) return [];

  const scored = dbToUse.map(article => ({
    article,
    score: calculateRelevance(inputText, article)
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Take top K
  return scored.slice(0, topK).map(item => ({
    id: item.article.id || 'N/A',
    title: item.article.title || '無標題',
    content: (item.article.content || '').substring(0, 500) // Truncate content to save context window
  }));
};