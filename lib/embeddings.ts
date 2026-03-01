
/**
 * Embedding Generation Utilities - OPTIMIZED FOR SPEED
 * Uses Groq API for fast embeddings (free tier available)
 * Fallback to Ollama if needed
 */

export interface Embedding {
  id: string;
  values: number[];
  metadata: {
    documentId: string;
    documentName: string;
    chunkIndex: number;
    text: string;
  };
}

// Simple in-memory cache for embeddings
const embeddingCache = new Map<string, number[]>();
const MAX_CACHE_SIZE = 2000;

/**
 * Generate embeddings using Groq API (FAST)
 */
async function generateWithGroq(
  texts: string[],
  apiKey: string
): Promise<number[][]> {
  const response = await fetch("https://api.groq.com/openai/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: texts,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Groq embedding error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.data
    .sort((a: any, b: any) => a.index - b.index)
    .map((item: any) => item.embedding);
}

/**
 * Generate embeddings using Ollama (SLOW - fallback)
 */
async function generateWithOllama(
  texts: string[],
  baseUrl: string,
  model: string
): Promise<number[][]> {
  const embeddings: number[][] = [];

  // Process in parallel batches
  const batchSize = 20;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const promises = batch.map(async (text) => {
      const response = await fetch(`${baseUrl}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt: text }),
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.embedding || [];
    });

    const results = await Promise.all(promises);
    embeddings.push(...results);
  }

  return embeddings;
}

/**
 * Generate embeddings for multiple texts
 * Auto-detects: Groq > Ollama
 */
export async function generateEmbeddings(
  texts: string[],
  options: {
    apiKey: string;
    baseUrl?: string;
    model?: string;
    batchSize?: number;
  }
): Promise<number[][]> {
  const { apiKey, baseUrl = "http://localhost:11434", model = "nomic-embed-text" } = options;

  // Check cache first - separate cached from uncached
  const cachedResults: number[][] = [];
  const uncachedTexts: string[] = [];

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    const cacheKey = `groq:${text.substring(0, 100)}`;
    if (embeddingCache.has(cacheKey)) {
      cachedResults[i] = embeddingCache.get(cacheKey)!;
    } else {
      uncachedTexts.push(text);
    }
  }

  // If all cached, return immediately
  if (uncachedTexts.length === 0) {
    return cachedResults;
  }

  let embeddings: number[][];

  // Try Groq first (FASTER)
  if (apiKey && apiKey.length > 10) {
    try {
      console.log(`[Embeddings] Using Groq for ${uncachedTexts.length} texts`);
      embeddings = await generateWithGroq(uncachedTexts, apiKey);

      // Cache new embeddings
      let embIndex = 0;
      for (let i = 0; i < texts.length; i++) {
        if (!cachedResults[i]) {
          const cacheKey = `groq:${texts[i].substring(0, 100)}`;
          if (embeddingCache.size >= MAX_CACHE_SIZE) {
            const firstKey = embeddingCache.keys().next().value;
            if (firstKey) embeddingCache.delete(firstKey);
          }
          embeddingCache.set(cacheKey, embeddings[embIndex]);
          cachedResults[i] = embeddings[embIndex];
          embIndex++;
        }
      }

      return cachedResults;
    } catch (error) {
      console.warn("[Embeddings] Groq failed, trying Ollama:", error);
    }
  }

  // Fallback to Ollama
  console.log(`[Embeddings] Using Ollama for ${uncachedTexts.length} texts`);
  embeddings = await generateWithOllama(uncachedTexts, baseUrl, model);

  // Cache new embeddings
  let embIndex = 0;
  for (let i = 0; i < texts.length; i++) {
    if (!cachedResults[i]) {
      const cacheKey = `ollama:${texts[i].substring(0, 100)}`;
      if (embeddingCache.size >= MAX_CACHE_SIZE) {
        const firstKey = embeddingCache.keys().next().value;
        if (firstKey) embeddingCache.delete(firstKey);
      }
      embeddingCache.set(cacheKey, embeddings[embIndex]);
      cachedResults[i] = embeddings[embIndex];
      embIndex++;
    }
  }

  return cachedResults;
}

/**
 * Generate single embedding (for queries)
 */
export async function generateEmbedding(
  text: string,
  options: {
    apiKey: string;
    baseUrl?: string;
    model?: string;
  }
): Promise<number[]> {
  const { apiKey, baseUrl = "http://localhost:11434", model = "nomic-embed-text" } = options;

  // Check cache
  const cacheKey = `groq:${text.substring(0, 100)}`;
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey)!;
  }

  // Try Groq first
  if (apiKey && apiKey.length > 10) {
    try {
      const results = await generateWithGroq([text], apiKey);
      const embedding = results[0];
      embeddingCache.set(cacheKey, embedding);
      return embedding;
    } catch {
      console.warn("[Embeddings] Groq failed, trying Ollama");
    }
  }

  // Fallback to Ollama
  const response = await fetch(`${baseUrl}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: text }),
  });

  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.embedding || [];
}

/**
 * Calculate cosine similarity
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have same dimension");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Calculate Euclidean distance
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have same dimension");
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Clear the embedding cache
 */
export function clearEmbeddingCache(): void {
  embeddingCache.clear();
}

