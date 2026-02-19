/**
 * Vector Store - In-Memory Implementation
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
}

/**
 * In-memory vector store implementation
 * Can be replaced with Supabase, Pinecone, or other vector databases
 */
export class InMemoryVectorStore {
  private chunks: Map<string, VectorChunk> = new Map();
  private documentChunks: Map<string, VectorChunk[]> = new Map();
  private similarityMetric: SimilarityMetric;

  constructor(options: VectorStoreOptions = {}) {
    this.similarityMetric = options.similarityMetric || 'cosine';
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
  }

  /**
   * Search for similar chunks
   */
  async search(queryEmbedding: number[], options: {
    k?: number;
    filter?: {
      documentId?: string;
      documentName?: string;
    };
  } = {}): Promise<SearchResult[]> {
    const { k = 5, filter } = options;

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
    return results.slice(0, k);
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

