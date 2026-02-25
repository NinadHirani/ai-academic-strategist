/**
 * Embedding Generation Utilities
 * Uses local Ollama API for embeddings (free, no API key needed)
 * Optimized for parallel processing
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

/**
 * Generate embeddings for text using local Ollama API
 */
export async function generateEmbedding(
  text: string,
  options: {
    apiKey: string;
    baseUrl?: string;
    model?: string;
  }
): Promise<number[]> {
  const { model = 'nomic-embed-text' } = options;
  const baseUrl = options.baseUrl || 'http://localhost:11434';
  
  const response = await fetch(`${baseUrl}/api/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt: text,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Embedding API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.embedding || [];
}

/**
 * Generate embeddings for multiple texts in batches with PARALLEL processing
 * This significantly speeds up document processing
 */
export async function generateEmbeddings(
  texts: string[],
  options: {
    apiKey: string;
    baseUrl?: string;
    model?: string;
    batchSize?: number;
    maxConcurrency?: number;
  }
): Promise<number[][]> {
  const { 
    model = 'nomic-embed-text', 
    batchSize = 100,
    maxConcurrency = 10 // Maximum concurrent requests - prevents overwhelming Ollama
  } = options;
  const baseUrl = options.baseUrl || 'http://localhost:11434';
  const embeddings: number[][] = [];

  // Process in batches
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    
    // Process batch in parallel with concurrency limit
    const batchEmbeddings = await processBatchParallel(
      batch,
      baseUrl,
      model,
      maxConcurrency
    );
    
    embeddings.push(...batchEmbeddings);
  }

  return embeddings;
}

/**
 * Process a batch of texts in parallel with concurrency limiting
 */
async function processBatchParallel(
  texts: string[],
  baseUrl: string,
  model: string,
  maxConcurrency: number
): Promise<number[][]> {
  // Create promises for all texts in batch
  const promises = texts.map(text => 
    fetchEmbedding(baseUrl, model, text)
  );

  // Process with concurrency limit using chunking
  const results: number[][] = [];
  
  for (let i = 0; i < promises.length; i += maxConcurrency) {
    const chunk = promises.slice(i, i + maxConcurrency);
    const chunkResults = await Promise.all(chunk);
    results.push(...chunkResults);
  }

  return results;
}

/**
 * Single embedding fetch with retry logic
 */
async function fetchEmbedding(
  baseUrl: string,
  model: string,
  text: string,
  retries = 2
): Promise<number[]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt: text,
        }),
      });

      if (!response.ok) {
        if (attempt < retries) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
          continue;
        }
        const error = await response.json().catch(() => ({}));
        throw new Error(`Embedding API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.embedding || [];
    } catch (error) {
      if (attempt >= retries) {
        throw error;
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
    }
  }
  
  return [];
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
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
  
  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

/**
 * Calculate Euclidean distance between two vectors
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

