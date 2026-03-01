/**
 * Enhanced Vector Store
 * Supports both in-memory and Supabase persistent storage
 * Optimized with caching for better performance
 * Includes SQL-based similarity search fallback
 */

import { cosineSimilarity, euclideanDistance } from "./embeddings";
import { createClient } from "@supabase/supabase-js";

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
// Retrieval Debug Logger
// ============================================================================

interface RetrievalDebugLog {
  timestamp: string;
  queryPreview: string;
  embeddingDimension: number;
  candidatesCount: number;
  resultsCount: number;
  topScores: number[];
  filter?: { documentId?: string; documentName?: string; userId?: string };
}

const retrievalLogs: RetrievalDebugLog[] = [];
const MAX_LOG_ENTRIES = 50;

function logRetrieval(
  queryEmbedding: number[],
  candidatesCount: number,
  results: SearchResult[],
  filter?: { documentId?: string; documentName?: string; userId?: string }
): void {
  const log: RetrievalDebugLog = {
    timestamp: new Date().toISOString(),
    queryPreview: `Embedding[${queryEmbedding.slice(0, 3).join(", ")}...]`,
    embeddingDimension: queryEmbedding.length,
    candidatesCount,
    resultsCount: results.length,
    topScores: results.slice(0, 5).map(r => Number(r.score.toFixed(4))),
    filter,
  };
  
  retrievalLogs.push(log);
  if (retrievalLogs.length > MAX_LOG_ENTRIES) {
    retrievalLogs.shift();
  }
  
  console.log("[VectorStore] Retrieval debug:", JSON.stringify(log));
}

export function getRetrievalLogs(): RetrievalDebugLog[] {
  return [...retrievalLogs];
}

export function clearRetrievalLogs(): void {
  retrievalLogs.length = 0;
}


// ============================================================================
// Supabase Vector Store
// ============================================================================

/**
 * Supabase-backed vector store for persistent storage
 * Uses Supabase client directly for reliable connections
 */
class SupabaseVectorStore {
  private supabaseUrl: string;
  private supabaseKey: string;
  private supabase: any; // Supabase client
  private similarityMetric: SimilarityMetric;
  private memoryCache: Map<string, VectorChunk> = new Map();
  private documentChunks: Map<string, VectorChunk[]> = new Map();
  private initialized: boolean = false;

  constructor(options: VectorStoreOptions) {
    this.supabaseUrl = options.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    this.supabaseKey = options.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    this.similarityMetric = options.similarityMetric || "cosine";
    
    // Initialize Supabase client
    if (this.supabaseUrl && this.supabaseKey) {
      try {
        this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
        this.initialized = true;
        console.log("[SupabaseVectorStore] Initialized with Supabase backend");
      } catch (e) {
        console.error("[SupabaseVectorStore] Failed to create client:", e);
      }
    }
  }

  /**
   * Check if Supabase is configured
   */
  isConfigured(): boolean {
    return !!(this.supabaseUrl && this.supabaseKey && this.supabase);
  }

  /**
   * Check if store is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Fetch all chunks from Supabase and populate local cache
   */
  private async syncFromSupabase(): Promise<void> {
    if (!this.isConfigured()) return;

    try {
      const { data, error } = await this.supabase
        .from('document_chunks')
        .select('*');
      
      if (error) {
        console.error("[SupabaseVectorStore] Fetch error:", error);
        return;
      }

      if (data && data.length > 0) {
        for (const row of data) {
          const chunk: VectorChunk = {
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
          };

          // Only add if not already in cache
          if (!this.memoryCache.has(chunk.id)) {
            this.memoryCache.set(chunk.id, chunk);
            const docChunks = this.documentChunks.get(chunk.metadata.documentId) || [];
            docChunks.push(chunk);
            this.documentChunks.set(chunk.metadata.documentId, docChunks);
          }
        }
        console.log(`[SupabaseVectorStore] Synced ${data.length} chunks from Supabase`);
      }
    } catch (error) {
      console.error("[SupabaseVectorStore] Sync error:", error);
    }
  }

  /**
   * Add chunks to the store
   */
  async add(chunks: VectorChunk[]): Promise<void> {
    if (!this.isConfigured()) {
      console.warn("[SupabaseVectorStore] Not configured, using memory only");
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

      const { error } = await this.supabase
        .from('document_chunks')
        .insert(records);

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

      // Also add to local cache
      for (const chunk of chunks) {
        this.memoryCache.set(chunk.id, chunk);
        const docChunks = this.documentChunks.get(chunk.metadata.documentId) || [];
        docChunks.push(chunk);
        this.documentChunks.set(chunk.metadata.documentId, docChunks);
      }

      console.log(`[SupabaseVectorStore] Added ${chunks.length} chunks to Supabase`);
    } catch (error) {
      console.error("[SupabaseVectorStore] Error:", error);
      for (const chunk of chunks) {
        this.memoryCache.set(chunk.id, chunk);
      }
    }
  }

  /**
   * Search for similar chunks - ALWAYS fetches from Supabase when configured
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
    if (cached && Date.now() - cached.timestamp < CACHE_TTL && this.memoryCache.size > 0) {
      return cached.results;
    }

    // ALWAYS fetch from Supabase when configured to get latest data
    if (this.isConfigured()) {
      try {
        let query = this.supabase
          .from('document_chunks')
          .select('*');
        
        const { data, error } = await query;
        
        if (error) {
          console.error("[SupabaseVectorStore] Fetch error:", error);
        } else if (data && data.length > 0) {
          // Clear and rebuild local cache with Supabase data
          this.memoryCache.clear();
          this.documentChunks.clear();
          
          for (const row of data) {
            const chunk: VectorChunk = {
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
            };

            this.memoryCache.set(chunk.id, chunk);
            const docChunks = this.documentChunks.get(chunk.metadata.documentId) || [];
            docChunks.push(chunk);
            this.documentChunks.set(chunk.metadata.documentId, docChunks);
          }
          console.log(`[SupabaseVectorStore] Fetched ${data.length} chunks from Supabase for search`);
        }
      } catch (error) {
        console.error("[SupabaseVectorStore] Fetch error:", error);
      }
    }

    // Get candidates from local cache
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

    // Log retrieval for debugging
    logRetrieval(queryEmbedding, candidates.length, topResults, filter);

    // Cache the results
    if (queryCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = queryCache.keys().next().value;
      if (oldestKey) queryCache.delete(oldestKey);
    }
    queryCache.set(cacheKey, { results: topResults, timestamp: Date.now() });

    return topResults;
  }

  /**
   * Delete chunks by document ID
   */
  async deleteByDocument(documentId: string): Promise<void> {
    const chunks = this.documentChunks.get(documentId) || [];
    for (const chunk of chunks) {
      this.memoryCache.delete(chunk.id);
    }
    this.documentChunks.delete(documentId);

    if (this.isConfigured()) {
      try {
        await this.supabase
          .from('document_chunks')
          .delete()
          .eq('document_id', documentId);
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

    // If we have Supabase configured but no docs in memory, fetch from Supabase
    if (docs.size === 0 && this.isConfigured()) {
      // This is handled asynchronously in search, but for getDocuments
      // we return what we have
      return Array.from(docs.values());
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

    // Log retrieval for debugging
    logRetrieval(queryEmbedding, candidates.length, topResults, filter);

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
      supabaseKey: options?.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY,
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
      (!!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    if (useSupabaseMode) {
      vectorStoreInstance = new SupabaseVectorStore({
        similarityMetric: options?.similarityMetric || 'cosine',
        useSupabase: true,
        supabaseUrl: options?.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabaseKey: options?.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY,
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

