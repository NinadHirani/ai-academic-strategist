/**
 * Enhanced Vector Store
 * Supports both in-memory and Supabase persistent storage
 * Optimized with caching for better performance
 */

import { cosineSimilarity, euclideanDistance } from "./embeddings";

// ============================================================================
// Types
// ============================================================================

export interface VectorChunk {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    documentId: string;
    documentName: string;
    chunkIndex: number;
    createdAt: Date;
    userId?: string;
  };
}

export interface SearchResult {
  chunk: VectorChunk;
  score: number;
}

export interface DocumentInfo {
  documentId: string;
  documentName: string;
  chunkCount: number;
  userId?: string;
  createdAt?: Date;
}

export type SimilarityMetric = "cosine" | "euclidean";

export interface VectorStoreOptions {
  similarityMetric?: SimilarityMetric;
  useSupabase?: boolean;
  supabaseUrl?: string;
  supabaseKey?: string;
}

export interface VectorStoreStats {
  totalChunks: number;
  totalDocuments: number;
  similarityMetric: SimilarityMetric;
  cacheSize: number;
  storageMode: "memory" | "supabase";
}

// ============================================================================
// Query Cache
// ============================================================================

interface CacheEntry {
  results: SearchResult[];
  timestamp: number;
}

const queryCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100;

function getCacheKey(
  embedding: number[],
  k: number,
  filter?: { documentId?: string; documentName?: string; userId?: string }
): string {
  const key = `${embedding.slice(0, 10).join(",")}:${k}:${filter?.documentId || "all"}:${filter?.userId || "anon"}`;
  return key;
}

function clearCache(): void {
  queryCache.clear();
}

// ============================================================================
// Supabase Vector Store
// ============================================================================

/**
 * Supabase-backed vector store for persistent storage
 */
class SupabaseVectorStore {
  private supabaseUrl: string;
  private supabaseKey: string;
  private similarityMetric: SimilarityMetric;
  private memoryCache: Map<string, VectorChunk> = new Map();
  private documentChunks: Map<string, VectorChunk[]> = new Map();

  constructor(options: VectorStoreOptions) {
    this.supabaseUrl = options.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    this.supabaseKey = options.supabaseKey || process.env.SUPABASE_SERVICE_KEY || "";
    this.similarityMetric = options.similarityMetric || "cosine";
  }

  /**
   * Check if Supabase is configured
   */
  isConfigured(): boolean {
    return !!(this.supabaseUrl && this.supabaseKey);
  }

  /**
   * Add chunks to the store
   */
  async add(chunks: VectorChunk[]): Promise<void> {
    if (!this.isConfigured()) {
      console.warn("[SupabaseVectorStore] Not configured, using memory only");
      // Fallback to memory
      for (const chunk of chunks) {
        this.memoryCache.set(chunk.id, chunk);
        const docChunks = this.documentChunks.get(chunk.metadata.documentId) || [];
        docChunks.push(chunk);
        this.documentChunks.set(chunk.metadata.documentId, docChunks);
      }
      return;
    }

    try {
      // Insert chunks into Supabase
      const records = chunks.map((chunk) => ({
        id: chunk.id,
        document_id: chunk.metadata.documentId,
        chunk_index: chunk.metadata.chunkIndex,
        content: chunk.content,
        embedding: chunk.embedding,
        metadata: {
          documentName: chunk.metadata.documentName,
          createdAt: chunk.metadata.createdAt?.toISOString() || new Date().toISOString(),
          userId: chunk.metadata.userId,
        },
      }));

      const { error } = await (window as any).supabase?.from("document_chunks")?.insert(records)
        || await this.insertChunksDirect(records);

      if (error) {
        console.error("[SupabaseVectorStore] Insert error:", error);
        // Fallback to memory
        for (const chunk of chunks) {
          this.memoryCache.set(chunk.id, chunk);
          const docChunks = this.documentChunks.get(chunk.metadata.documentId) || [];
          docChunks.push(chunk);
          this.documentChunks.set(chunk.metadata.documentId, docChunks);
        }
      }

      // Also add to local cache for fast retrieval
      for (const chunk of chunks) {
        this.memoryCache.set(chunk.id, chunk);
        const docChunks = this.documentChunks.get(chunk.metadata.documentId) || [];
        docChunks.push(chunk);
        this.documentChunks.set(chunk.metadata.documentId, docChunks);
      }

      clearCache();
    } catch (error) {
      console.error("[SupabaseVectorStore] Error:", error);
      // Fallback to memory
      for (const chunk of chunks) {
        this.memoryCache.set(chunk.id, chunk);
      }
    }
  }

  /**
   * Insert chunks directly via REST API (fallback)
   */
  private async insertChunksDirect(records: any[]): Promise<any> {
    const response = await fetch(`${this.supabaseUrl}/rest/v1/document_chunks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: this.supabaseKey,
        Authorization: `Bearer ${this.supabaseKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(records),
    });
    return { error: response.ok ? null : await response.text() };
  }

  /**
   * Search for similar chunks
   */
  async search(
    queryEmbedding: number[],
    options: {
      k?: number;
      filter?: {
        documentId?: string;
        documentName?: string;
        userId?: string;
      };
    } = {}
  ): Promise<SearchResult[]> {
    const { k = 5, filter } = options;

    // Check cache first
    const cacheKey = getCacheKey(queryEmbedding, k, filter);
    const cached = queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.results;
    }

    // Get candidates from local cache (fastest)
    let candidates: VectorChunk[];

    if (filter?.documentId) {
      candidates = this.documentChunks.get(filter.documentId) || [];
    } else {
      candidates = Array.from(this.memoryCache.values());
    }

    if (filter?.userId) {
      candidates = candidates.filter((c) => c.metadata.userId === filter.userId);
    }

    if (filter?.documentName) {
      candidates = candidates.filter(
        (c) => c.metadata.documentName === filter.documentName
      );
    }

    // If not enough in cache and Supabase is configured, try to fetch more
    if (candidates.length < k && this.isConfigured()) {
      try {
        const supabaseCandidates = await this.fetchFromSupabase(filter?.userId);
        // Merge with existing, avoiding duplicates
        const existingIds = new Set(candidates.map((c) => c.id));
        for (const chunk of supabaseCandidates) {
          if (!existingIds.has(chunk.id)) {
            candidates.push(chunk);
            this.memoryCache.set(chunk.id, chunk);
          }
        }
      } catch (error) {
        console.error("[SupabaseVectorStore] Fetch error:", error);
      }
    }

    // Calculate similarities
    const results: SearchResult[] = candidates.map((chunk) => {
      let score: number;

      if (this.similarityMetric === "cosine") {
        score = cosineSimilarity(queryEmbedding, chunk.embedding);
      } else {
        const distance = euclideanDistance(queryEmbedding, chunk.embedding);
        score = 1 / (1 + distance);
      }

      return { chunk, score };
    });

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    const topResults = results.slice(0, k);

    // Cache the results
    if (queryCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = queryCache.keys().next().value;
      if (oldestKey) queryCache.delete(oldestKey);
    }
    queryCache.set(cacheKey, { results: topResults, timestamp: Date.now() });

    return topResults;
  }

  /**
   * Fetch chunks from Supabase
   */
  private async fetchFromSupabase(userId?: string): Promise<VectorChunk[]> {
    try {
      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/document_chunks?select=*${userId ? `&metadata->>userId=eq.${userId}` : ""}`,
        {
          headers: {
            apikey: this.supabaseKey,
            Authorization: `Bearer ${this.supabaseKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Supabase fetch failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      return data.map((row: any) => ({
        id: row.id,
        content: row.content,
        embedding: row.embedding,
        metadata: {
          documentId: row.document_id,
          documentName: row.metadata?.documentName || "Unknown",
          chunkIndex: row.chunk_index,
          createdAt: new Date(row.metadata?.createdAt || row.created_at),
          userId: row.metadata?.userId,
        },
      }));
    } catch (error) {
      console.error("[SupabaseVectorStore] Fetch error:", error);
      return [];
    }
  }

  /**
   * Delete chunks by document ID
   */
  async deleteByDocument(documentId: string): Promise<void> {
    // Remove from local cache
    const chunks = this.documentChunks.get(documentId) || [];
    for (const chunk of chunks) {
      this.memoryCache.delete(chunk.id);
    }
    this.documentChunks.delete(documentId);

    // Try to delete from Supabase
    if (this.isConfigured()) {
      try {
        await fetch(
          `${this.supabaseUrl}/rest/v1/document_chunks?document_id=eq.${documentId}`,
          {
            method: "DELETE",
            headers: {
              apikey: this.supabaseKey,
              Authorization: `Bearer ${this.supabaseKey}`,
            },
          }
        );
      } catch (error) {
        console.error("[SupabaseVectorStore] Delete error:", error);
      }
    }

    clearCache();
  }

  /**
   * Get all documents
   */
  getDocuments(): DocumentInfo[] {
    const docs = new Map<string, DocumentInfo>();

    for (const [documentId, chunks] of this.documentChunks) {
      if (chunks.length > 0) {
        docs.set(documentId, {
          documentId,
          documentName: chunks[0].metadata.documentName,
          chunkCount: chunks.length,
          userId: chunks[0].metadata.userId,
          createdAt: chunks[0].metadata.createdAt,
        });
      }
    }

    return Array.from(docs.values());
  }

  /**
   * Get chunks by document
   */
  getByDocument(documentId: string): VectorChunk[] {
    return this.documentChunks.get(documentId) || [];
  }

  /**
   * Get statistics
   */
  getStats(): VectorStoreStats {
    return {
      totalChunks: this.memoryCache.size,
      totalDocuments: this.documentChunks.size,
      similarityMetric: this.similarityMetric,
      cacheSize: queryCache.size,
      storageMode: this.isConfigured() ? "supabase" : "memory",
    };
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    this.documentChunks.clear();
    clearCache();
  }
}

// ============================================================================
// In-Memory Vector Store (Original)
// ============================================================================

/**
 * In-memory vector store implementation with caching
 */
class InMemoryVectorStore {
  private chunks: Map<string, VectorChunk> = new Map();
  private documentChunks: Map<string, VectorChunk[]> = new Map();
  private similarityMetric: SimilarityMetric;

  constructor(options: VectorStoreOptions = {}) {
    this.similarityMetric = options.similarityMetric || "cosine";
  }

  async add(chunks: VectorChunk[]): Promise<void> {
    for (const chunk of chunks) {
      this.chunks.set(chunk.id, chunk);

      const docChunks = this.documentChunks.get(chunk.metadata.documentId) || [];
      docChunks.push(chunk);
      this.documentChunks.set(chunk.metadata.documentId, docChunks);
    }

    clearCache();
  }

  async search(
    queryEmbedding: number[],
    options: {
      k?: number;
      filter?: {
        documentId?: string;
        documentName?: string;
      };
    } = {}
  ): Promise<SearchResult[]> {
    const { k = 5, filter } = options;

    // Check cache
    const cacheKey = getCacheKey(queryEmbedding, k, filter);
    const cached = queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.results;
    }

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

    const results: SearchResult[] = candidates.map((chunk) => {
      let score: number;

      if (this.similarityMetric === "cosine") {
        score = cosineSimilarity(queryEmbedding, chunk.embedding);
      } else {
        const distance = euclideanDistance(queryEmbedding, chunk.embedding);
        score = 1 / (1 + distance);
      }

      return { chunk, score };
    });

    results.sort((a, b) => b.score - a.score);

    const topResults = results.slice(0, k);

    if (queryCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = queryCache.keys().next().value;
      if (oldestKey) queryCache.delete(oldestKey);
    }
    queryCache.set(cacheKey, { results: topResults, timestamp: Date.now() });

    return topResults;
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
    clearCache();
  }

  getDocuments(): DocumentInfo[] {
    const docs = new Map<string, DocumentInfo>();

    for (const [documentId, chunks] of this.documentChunks) {
      if (chunks.length > 0) {
        docs.set(documentId, {
          documentId,
          documentName: chunks[0].metadata.documentName,
          chunkCount: chunks.length,
          userId: chunks[0].metadata.userId,
          createdAt: chunks[0].metadata.createdAt,
        });
      }
    }

    return Array.from(docs.values());
  }

  async clear(): Promise<void> {
    this.chunks.clear();
    this.documentChunks.clear();
    clearCache();
  }

  clearCache(): void {
    clearCache();
  }

  getStats(): VectorStoreStats {
    return {
      totalChunks: this.chunks.size,
      totalDocuments: this.documentChunks.size,
      similarityMetric: this.similarityMetric,
      cacheSize: queryCache.size,
      storageMode: "memory",
    };
  }
}

// ============================================================================
// Factory and Singleton
// ============================================================================

let vectorStoreInstance: InMemoryVectorStore | SupabaseVectorStore | null = null;
let useSupabase = false;

/**
 * Initialize vector store with optional Supabase
 */
export function initVectorStore(options?: VectorStoreOptions): void {
  useSupabase = options?.useSupabase || false;

  if (useSupabase) {
    vectorStoreInstance = new SupabaseVectorStore({
      similarityMetric: options?.similarityMetric || 'cosine',
      useSupabase: true,
      supabaseUrl: options?.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKey: options?.supabaseKey || process.env.SUPABASE_SERVICE_KEY,
    });
    console.log("[VectorStore] Initialized with Supabase backend");
  } else {
    vectorStoreInstance = new InMemoryVectorStore({
      similarityMetric: options?.similarityMetric || 'cosine',
    });
    console.log("[VectorStore] Initialized with in-memory backend");
  }
}

/**
 * Get or create the vector store singleton
 */
export function getVectorStore(options?: VectorStoreOptions): InMemoryVectorStore | SupabaseVectorStore {
  if (!vectorStoreInstance) {
    const useSupabaseMode = options?.useSupabase || 
      (!!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_KEY);
    
    if (useSupabaseMode) {
      vectorStoreInstance = new SupabaseVectorStore({
        similarityMetric: options?.similarityMetric || 'cosine',
        useSupabase: true,
        supabaseUrl: options?.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabaseKey: options?.supabaseKey || process.env.SUPABASE_SERVICE_KEY,
      });
      console.log("[VectorStore] Using Supabase backend");
    } else {
      vectorStoreInstance = new InMemoryVectorStore({
        similarityMetric: options?.similarityMetric || 'cosine',
      });
      console.log("[VectorStore] Using in-memory backend");
    }
  }
  return vectorStoreInstance;
}

/**
 * Reset the vector store (useful for testing)
 */
export function resetVectorStore(): void {
  vectorStoreInstance = null;
  queryCache.clear();
}

/**
 * Check if using Supabase
 */
export function isUsingSupabase(): boolean {
  const store = getVectorStore();
  return store instanceof SupabaseVectorStore;
}

// Re-export types
export type { VectorChunk as IVectorChunk, SearchResult as ISearchResult };

