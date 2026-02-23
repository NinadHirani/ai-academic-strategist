/**
 * Embedding Generation Utilities
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

const EMBEDDING_DIMENSION = 384;

function generateSimpleEmbedding(text: string): number[] {
  const embedding = new Array(EMBEDDING_DIMENSION).fill(0);
  
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    for (let j = 0; j < EMBEDDING_DIMENSION; j++) {
      const hash = Math.sin(charCode * (j + 1) * 31 + i) * 10000;
      embedding[j] += (hash - Math.floor(hash)) * 0.1;
    }
  }
  
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude;
    }
  }
  
  return embedding;
}

async function generateHuggingFaceEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const response = await fetch(
      "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2",
      {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: texts, options: { wait_for_model: true } }),
      }
    );

    if (!response.ok) throw new Error(`HuggingFace API error: ${response.statusText}`);

    const data = await response.json();
    return Array.isArray(data) ? data : [data];
  } catch (error) {
    console.error("[Embeddings] HuggingFace error:", error);
    return texts.map(generateSimpleEmbedding);
  }
}

export async function generateEmbedding(
  text: string,
  options: { apiKey?: string; baseUrl?: string; model?: string }
): Promise<number[]> {
  const { apiKey } = options;
  
  if (!apiKey) throw new Error("API key is required for embeddings");

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.data[0].embedding;
    }
  } catch (error) {
    console.error("[Embeddings] OpenAI error:", error);
  }

  return generateHuggingFaceEmbeddings([text]).then(e => e[0]);
}

export async function generateEmbeddings(
  texts: string[],
  options: { apiKey?: string; baseUrl?: string; model?: string; batchSize?: number }
): Promise<number[][]> {
  const { apiKey, batchSize = 32 } = options;
  
  if (apiKey && !apiKey.startsWith('gsk_')) {
    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model: "text-embedding-3-small", input: texts }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.data.map((item: { embedding: number[] }) => item.embedding);
      }
    } catch (error) {
      console.error("[Embeddings] OpenAI batch error:", error);
    }
  }

  return generateHuggingFaceEmbeddings(texts);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('Vectors must have the same dimension');

  let dotProduct = 0, normA = 0, normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('Vectors must have the same dimension');

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

