/**
 * Vector Store - In-Memory Implementation
 */

import { cosineSimilarity, euclideanDistance } from './embeddings';

export interface VectorChunk {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    documentId: string;
    documentName: string;
    chunkIndex: number;
    createdAt: Date;
  };
}

export interface SearchResult {
  chunk: VectorChunk;
  score: number;
}

export type SimilarityMetric = 'cosine' | 'euclidean';

export interface VectorStoreOptions {
  similarityMetric?: SimilarityMetric;
}

export class InMemoryVectorStore {
  private chunks: Map<string, VectorChunk> = new Map();
  private documentChunks: Map<string, VectorChunk[]> = new Map();
  private similarityMetric: SimilarityMetric;

  constructor(options: VectorStoreOptions = {}) {
    this.similarityMetric = options.similarityMetric || 'cosine';
  }

  async add(chunks: VectorChunk[]): Promise<void> {
    for (const chunk of chunks) {
      this.chunks.set(chunk.id, chunk);
      const docChunks = this.documentChunks.get(chunk.metadata.documentId) || [];
      docChunks.push(chunk);
      this.documentChunks.set(chunk.metadata.documentId, docChunks);
    }
  }

  async search(queryEmbedding: number[], options: { k?: number; filter?: { documentId?: string; documentName?: string } } = {}): Promise<SearchResult[]> {
    const { k = 5, filter } = options;

    let candidates: VectorChunk[];
    
    if (filter?.documentId) {
      candidates = this.documentChunks.get(filter.documentId) || [];
    } else {
      candidates = Array.from(this.chunks.values());
    }

    if (filter?.documentName) {
      candidates = candidates.filter(c => c.metadata.documentName === filter.documentName);
    }

    const results: SearchResult[] = candidates.map((chunk) => {
      let score: number;
      
      if (this.similarityMetric === 'cosine') {
        score = cosineSimilarity(queryEmbedding, chunk.embedding);
      } else {
        const distance = euclideanDistance(queryEmbedding, chunk.embedding);
        score = 1 / (1 + distance);
      }

      return { chunk, score };
    });

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
  }

  getByDocument(documentId: string): VectorChunk[] {
    return this.documentChunks.get(documentId) || [];
  }

  async deleteByDocument(documentId: string): Promise<void> {
    const chunks = this.documentChunks.get(documentId) || [];
    for (const chunk of chunks) {
      this.chunks.delete(chunk.id);
    }
    this.documentChunks.delete(documentId);
  }

  getDocuments(): Array<{ documentId: string; documentName: string; chunkCount: number }> {
    const docs = new Map<string, { documentId: string; documentName: string; chunkCount: number }>();
    
    for (const [documentId, chunks] of this.documentChunks) {
      if (chunks.length > 0) {
        docs.set(documentId, {
          documentId,
          documentName: chunks[0].metadata.documentName,
          chunkCount: chunks.length,
        });
      }
    }
    
    return Array.from(docs.values());
  }

  async clear(): Promise<void> {
    this.chunks.clear();
    this.documentChunks.clear();
  }

  getStats(): { totalChunks: number; totalDocuments: number; similarityMetric: SimilarityMetric } {
    return {
      totalChunks: this.chunks.size,
      totalDocuments: this.documentChunks.size,
      similarityMetric: this.similarityMetric,
    };
  }
}

const GLOBAL_KEY = '__five_brains_vector_store__';

function getGlobalStore(): InMemoryVectorStore {
  const globalObj = globalThis as Record<string, unknown>;
  
  if (!globalObj[GLOBAL_KEY]) {
    globalObj[GLOBAL_KEY] = new InMemoryVectorStore();
  }
  
  return globalObj[GLOBAL_KEY] as InMemoryVectorStore;
}

export function getVectorStore(options?: VectorStoreOptions): InMemoryVectorStore {
  return getGlobalStore();
}

export function resetVectorStore(): void {
  const globalObj = globalThis as Record<string, unknown>;
  globalObj[GLOBAL_KEY] = null;
}

