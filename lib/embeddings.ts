/**
 * Embedding Generation Utilities
 * Uses local Ollama API for embeddings (free, no API key needed)
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
 * Generate embeddings for multiple texts in batches
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
  const { model = 'nomic-embed-text', batchSize = 100 } = options;
  const baseUrl = options.baseUrl || 'http://localhost:11434';
  const embeddings: number[][] = [];

  // Process in batches
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    
    const batchEmbeddings: number[][] = [];
    
    for (const text of batch) {
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
      batchEmbeddings.push(data.embedding || []);
    }
    
    embeddings.push(...batchEmbeddings);
  }

  return embeddings;
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

