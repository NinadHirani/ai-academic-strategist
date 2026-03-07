
/**
 * Embedding Generation Utilities - OPTIMIZED FOR SPEED
 * Uses Groq API for fast embeddings (free tier available)
 * Optional fallback to custom OpenAI-compatible/Ollama endpoint only when explicitly configured
 */
import { groqKeyManager } from "./groq-key-manager";

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
  texts: string[]
): Promise<number[][]> {
  const maxRetries = 3;
  let attempt = 0;
  while (attempt < maxRetries) {
    const apiKey = groqKeyManager.getCurrentKey();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
    try {
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
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limit – rotate key and retry
          console.warn(`[Embeddings] Groq rate limit hit (429). Rotating key and retrying (attempt ${attempt + 1})`);
          groqKeyManager.rotateKey();
          attempt++;
          continue;
        }
        const error = await response.json().catch(() => ({}));
        throw new Error(`Groq embedding error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.data
        .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
        .map((item: { embedding: number[] }) => item.embedding);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Groq API request timed out');
      }
      // If it's a 429 from fetch throwing, handle similarly
      if (error && typeof (error as any).status === 'number' && (error as any).status === 429) {
        console.warn(`[Embeddings] Groq rate limit error caught. Rotating key and retrying (attempt ${attempt + 1})`);
        groqKeyManager.rotateKey();
        attempt++;
        continue;
      }
      throw error;
    }
  }
  throw new Error('Groq embedding failed after maximum retries due to rate limiting');
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout per request

      try {
        const response = await fetch(`${baseUrl}/api/embeddings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, prompt: text }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Ollama error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.embedding || [];
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          console.warn("[Embeddings] Ollama request timed out for a chunk");
          // Return empty embedding as fallback
          return new Array(768).fill(0);
        }
        throw error;
      }
    });

    const results = await Promise.all(promises);
    embeddings.push(...results);
  }

  return embeddings;
}

/**
 * Generate embeddings for multiple texts
 * Auto-detects: Groq > Ollama > Simple Hash Fallback
 * Returns { success, embeddings, error } for proper error handling
 */
export async function generateEmbeddings(
  texts: string[],
  options: {
    apiKey: string;
    baseUrl?: string;
    model?: string;
    batchSize?: number;
  }
): Promise<{ success: boolean; embeddings?: number[][]; error?: string }> {
  const { apiKey, baseUrl, model = "nomic-embed-text" } = options;
  const isProduction = process.env.NODE_ENV === "production";

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
    return { success: true, embeddings: cachedResults };
  }

  let embeddings: number[][];

  // Try Groq first (FASTER)
  if (apiKey && apiKey.length > 10) {
    try {
      console.log(`[Embeddings] Using Groq for ${uncachedTexts.length} texts`);
      embeddings = await generateWithGroq(uncachedTexts);

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

      return { success: true, embeddings: cachedResults };
    } catch (error) {
      console.warn("[Embeddings] Primary provider failed:", error);
    }
  }

  // Optional explicit fallback endpoint (no implicit localhost defaults)
  if (baseUrl && baseUrl.trim().length > 0) {
    console.log(`[Embeddings] Using explicit fallback endpoint for ${uncachedTexts.length} texts`);
    try {
      embeddings = await generateWithOllama(uncachedTexts, baseUrl, model);

      // Cache new embeddings
      let embIndex = 0;
      for (let i = 0; i < texts.length; i++) {
        if (!cachedResults[i]) {
          const cacheKey = `fallback:${texts[i].substring(0, 100)}`;
          if (embeddingCache.size >= MAX_CACHE_SIZE) {
            const firstKey = embeddingCache.keys().next().value;
            if (firstKey) embeddingCache.delete(firstKey);
          }
          embeddingCache.set(cacheKey, embeddings[embIndex]);
          cachedResults[i] = embeddings[embIndex];
          embIndex++;
        }
      }

      return { success: true, embeddings: cachedResults };
    } catch (error) {
      console.warn("[Embeddings] Explicit fallback endpoint failed:", error);
    }
  }

  if (isProduction) {
    return {
      success: false,
      error:
        "Embedding provider unavailable in production. Configure GROQ_API_KEY or OPENAI_API_KEY.",
    };
  }

  // Final fallback: Simple hash-based embeddings (for testing without external services)
  console.log("[Embeddings] Using simple hash-based embeddings (testing mode)");
  try {
    embeddings = uncachedTexts.map(text => generateSimpleEmbedding(text));

    // Cache new embeddings
    let embIndex = 0;
    for (let i = 0; i < texts.length; i++) {
      if (!cachedResults[i]) {
        const cacheKey = `simple:${texts[i].substring(0, 100)}`;
        if (embeddingCache.size >= MAX_CACHE_SIZE) {
          const firstKey = embeddingCache.keys().next().value;
          if (firstKey) embeddingCache.delete(firstKey);
        }
        embeddingCache.set(cacheKey, embeddings[embIndex]);
        cachedResults[i] = embeddings[embIndex];
        embIndex++;
      }
    }

    return { success: true, embeddings: cachedResults };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown embedding error';
    console.error("[Embeddings] All methods failed:", errorMessage);
    return {
      success: false,
      embeddings: cachedResults,
      error: `Embedding generation failed: ${errorMessage}`
    };
  }
}

/**
 * Generate a simple deterministic embedding from text hash
 * Useful for testing when no external APIs are available
 */
function generateSimpleEmbedding(text: string): number[] {
  const dimensions = 1536; // Match OpenAI/Groq embedding size
  const embedding = new Array(dimensions).fill(0);

  // Create a simple hash of the text
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Use hash to seed pseudo-random values
  const seed = Math.abs(hash);
  let randomState = seed;

  const nextRandom = () => {
    randomState = (randomState * 1103515245 + 12345) & 0x7fffffff;
    return randomState / 0x7fffffff;
  };

  // Generate normalized embedding using text content influence
  for (let i = 0; i < dimensions; i++) {
    // Mix hash with position and character values
    const charCode = text.charCodeAt(i % text.length) || 0;
    const positionFactor = Math.sin(i * 0.1) * 0.3;
    embedding[i] = (nextRandom() + charCode / 127.0 + positionFactor) * 0.5;
  }

  // Normalize to unit vector
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < dimensions; i++) {
      embedding[i] /= magnitude;
    }
  }

  return embedding;
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
  const { apiKey, baseUrl, model = "nomic-embed-text" } = options;
  const isProduction = process.env.NODE_ENV === "production";

  // Check cache
  const cacheKey = `groq:${text.substring(0, 100)}`;
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey)!;
  }

  // Try Groq first
  if (apiKey && apiKey.length > 10) {
    try {
      const results = await generateWithGroq([text]);
      const embedding = results[0];
      embeddingCache.set(cacheKey, embedding);
      return embedding;
    } catch {
      console.warn("[Embeddings] Groq failed, trying Ollama");
    }
  }

  // Optional explicit fallback endpoint
  if (baseUrl && baseUrl.trim().length > 0) {
    try {
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
    } catch {
      console.warn("[Embeddings] Explicit fallback endpoint failed");
    }
  }

  if (isProduction) {
    throw new Error(
      "Embedding provider unavailable in production. Configure GROQ_API_KEY or OPENAI_API_KEY."
    );
  }

  // Final fallback: Simple hash-based embedding
  console.log("[Embeddings] Using simple hash-based embedding (testing mode)");
  return generateSimpleEmbedding(text);
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

