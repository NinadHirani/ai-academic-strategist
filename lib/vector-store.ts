/**
 * Vector Store - In-Memory Implementation with Caching
 * Modular design allowing for future Supabase/Pinecone integration
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
  cacheSize?: number;
}

/**
 * Simple LRU Cache for query results
 */
class QueryCache {
  private cache: Map<string, { result: SearchResult[]; timestamp: number }> = new Map();
  private maxSize: number;
  private ttl: number; // Time to live in ms

  constructor(maxSize = 100, ttl = 5 * 60 * 1000) { // 5 minute default TTL
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  private hashKey(embedding: number[], k: number): string {
    // Create a simple hash from the embedding and k
    const key = embedding.slice(0, 10).join(',') + '|' + k;
    return key;
  }

  get(embedding: number[], k: number): SearchResult[] | null {
    const key = this.hashKey(embedding, k);
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.result;
    }
    
    if (cached) {
      this.cache.delete(key);
    }
    
    return null;
  }

  set(embedding: number[], k: number, result: SearchResult[]): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const key = this.hashKey(embedding, k);
    this.cache.set(key, { result, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * In-memory vector store implementation with caching
 * Can be replaced with Supabase, Pinecone, or other vector databases
 */
export class InMemoryVectorStore {
  private chunks: Map<string, VectorChunk> = new Map();
  private documentChunks: Map<string, VectorChunk[]> = new Map();
  private similarityMetric: SimilarityMetric;
  private queryCache: QueryCache;

  constructor(options: VectorStoreOptions = {}) {
    this.similarityMetric = options.similarityMetric || 'cosine';
    this.queryCache = new QueryCache(options.cacheSize || 100);
  }

  /**
   * Add chunks with embeddings to the store
   */
  async add(chunks: VectorChunk[]): Promise<void> {
    for (const chunk of chunks) {
      this.chunks.set(chunk.id, chunk);
      
      // Index by document
      const docChunks = this.documentChunks.get(chunk.metadata.documentId) || [];
      docChunks.push(chunk);
      this.documentChunks.set(chunk.metadata.documentId, docChunks);
    }
    
    // Clear cache when new data is added
    this.queryCache.clear();
  }

  /**
   * Search for similar chunks (with caching)
   */
  async search(queryEmbedding: number[], options: {
    k?: number;
    filter?: {
      documentId?: string;
      documentName?: string;
    };
  } = {}): Promise<SearchResult[]> {
    const { k = 5, filter } = options;

    // Check cache first (only for unfiltered queries)
    if (!filter || (!filter.documentId && !filter.documentName)) {
      const cached = this.queryCache.get(queryEmbedding, k);
      if (cached) {
        return cached;
      }
    }

    // Get candidate chunks
    let candidates: VectorChunk[];
    
    if (filter?.documentId) {
      candidates = this.documentChunks.get(filter.documentId) || [];
    } else {
      candidates = Array.from(this.chunks.values());
    }

    if (filter?.documentName) {
      candidates = candidates.filter(
        (c) => c.metadata.documentName === filter.documentName
      );
    }

    // Calculate similarities
    const results: SearchResult[] = candidates.map((chunk) => {
      let score: number;
      
      if (this.similarityMetric === 'cosine') {
        score = cosineSimilarity(queryEmbedding, chunk.embedding);
      } else {
        // For Euclidean distance, convert to similarity (lower is better)
        const distance = euclideanDistance(queryEmbedding, chunk.embedding);
        score = 1 / (1 + distance);
      }

      return { chunk, score };
    });

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Return top k
    const topResults = results.slice(0, k);

    // Cache unfiltered results
    if (!filter || (!filter.documentId && !filter.documentName)) {
      this.queryCache.set(queryEmbedding, k, topResults);
    }

    return topResults;
  }

  /**
   * Get all chunks for a specific document
   */
  getByDocument(documentId: string): VectorChunk[] {
    return this.documentChunks.get(documentId) || [];
  }

  /**
   * Delete all chunks for a document
   */
  async deleteByDocument(documentId: string): Promise<void> {
    const chunks = this.documentChunks.get(documentId) || [];
    
    for (const chunk of chunks) {
      this.chunks.delete(chunk.id);
    }
    
    this.documentChunks.delete(documentId);
    
    // Clear cache when data is deleted
    this.queryCache.clear();
  }

  /**
   * Get all stored documents
   */
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

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    this.chunks.clear();
    this.documentChunks.clear();
    this.queryCache.clear();
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalChunks: number;
    totalDocuments: number;
    similarityMetric: SimilarityMetric;
  } {
    return {
      totalChunks: this.chunks.size,
      totalDocuments: this.documentChunks.size,
      similarityMetric: this.similarityMetric,
    };
  }
}

// Singleton instance for the application
let vectorStoreInstance: InMemoryVectorStore | null = null;

/**
 * Get or create the vector store singleton
 */
export function getVectorStore(options?: VectorStoreOptions): InMemoryVectorStore {
  if (!vectorStoreInstance) {
    vectorStoreInstance = new InMemoryVectorStore(options);
  }
  return vectorStoreInstance;
}

/**
 * Reset the vector store (useful for testing)
 */
export function resetVectorStore(): void {
  vectorStoreInstance = null;
}

