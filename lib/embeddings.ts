/**
 * Embedding Generation Utilities
 * Generates embeddings using OpenAI-compatible API
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

export interface EmbeddingRequest {
  input: string;
  model?: string;
}

export interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * Generate embeddings for text using OpenAI-compatible API
 */
export async function generateEmbedding(
  text: string,
  options: {
    apiKey: string;
    baseUrl?: string;
    model?: string;
  }
): Promise<number[]> {
  const { apiKey, baseUrl = 'https://api.openai.com/v1', model = 'text-embedding-3-small' } = options;
  
  // Groq doesn't support 'dimensions' parameter
  const isGroq = baseUrl.includes('groq');
  const requestBody: any = {
    input: text,
    model,
  };
  if (!isGroq) {
    requestBody.dimensions = 1536;
  }

  const response = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Embedding API error: ${error.error?.message || response.statusText}`);
  }

  const data: EmbeddingResponse = await response.json();
  return data.data[0]?.embedding || [];
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
  const { apiKey, baseUrl, model, batchSize = 100 } = options;
  const embeddings: number[][] = [];

  // Process in batches to avoid API limits
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    
    // Groq doesn't support 'dimensions' parameter
    const isGroq = baseUrl?.includes('groq');
    const requestBody: any = {
      input: batch,
      model: model || 'text-embedding-3-small',
    };
    if (!isGroq) {
      requestBody.dimensions = 1536;
    }
    
    const response = await fetch(`${baseUrl || 'https://api.openai.com/v1'}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Embedding API error: ${error.error?.message || response.statusText}`);
    }

    const data: EmbeddingResponse = await response.json();
    
    // Sort by index to maintain order
    const sortedEmbeddings = data.data.sort((a, b) => a.index - b.index);
    embeddings.push(...sortedEmbeddings.map((d) => d.embedding));
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

