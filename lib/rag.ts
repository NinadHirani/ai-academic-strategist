/**
 * RAG (Retrieval Augmented Generation) Orchestration
 * Coordinates document processing, embedding, retrieval, and generation
 */

import { splitByParagraphs, TextChunk } from './text-chunker';
import { generateEmbeddings } from './embeddings';
import { getVectorStore, VectorChunk, SearchResult, initVectorStore } from './vector-store';
import { supabaseAdmin } from './supabase';

export interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
  status: 'processing' | 'ready' | 'error';
  chunkCount: number;
  error?: string;
}

export interface RAGConfig {
  chunkSize?: number;
  chunkOverlap?: number;
  retrievalK?: number;
  similarityThreshold?: number;
  baseUrl?: string;
  model?: string;
}

const DEFAULT_CONFIG: Required<RAGConfig> = {
  chunkSize: 1000,
  chunkOverlap: 100,
  retrievalK: 5,
  similarityThreshold: 0.3, // Minimum similarity score to include in context
  baseUrl: 'https://api.openai.com/v1',
  model: 'text-embedding-3-small'
};

// Initialize vector store with Supabase if configured
function initStore() {
  if (supabaseAdmin && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    initVectorStore({
      useSupabase: true,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '',
    });
  }
}

/**
 * Process a document: extract text, chunk, and generate embeddings
 */
export async function processDocument(
  documentId: string,
  documentName: string,
  text: string,
  apiKey: string,
  config: RAGConfig = {}
): Promise<{ success: boolean; chunkCount: number; error?: string }> {
  const options = { ...DEFAULT_CONFIG, ...config };
  
  // Initialize store
  initStore();
  const vectorStore = getVectorStore();

  try {
    // Step 1: Split text into chunks
    const chunks = splitByParagraphs(
      text,
      documentId,
      documentName,
      { chunkSize: options.chunkSize, chunkOverlap: options.chunkOverlap }
    );

    if (chunks.length === 0) {
      return { success: false, chunkCount: 0, error: 'No text content found in document' };
    }

    // Step 2: Generate embeddings for all chunks
    const texts = chunks.map((c) => c.content);
    const embeddings = await generateEmbeddings(texts, {
      apiKey,
      baseUrl: options.baseUrl,
      model: options.model,
      batchSize: 100,
    });

    // Step 3: Create vector chunks
    const vectorChunks: VectorChunk[] = chunks.map((chunk, index) => ({
      id: chunk.id,
      content: chunk.content,
      embedding: embeddings[index],
      metadata: {
        documentId: chunk.metadata.documentId,
        documentName: chunk.metadata.documentName,
        chunkIndex: chunk.metadata.index,
        createdAt: new Date(),
      },
    }));

    // Step 4: Store in vector database
    await vectorStore.add(vectorChunks);

    return { success: true, chunkCount: chunks.length };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, chunkCount: 0, error: errorMessage };
  }
}

/**
 * Retrieve relevant context for a query
 */
export async function retrieveContext(
  query: string,
  queryEmbedding: number[],
  apiKey: string,
  config: RAGConfig = {}
): Promise<{
  context: string;
  sources: Array<{ documentName: string; chunkIndex: number; score: number }>;
}> {
  const options = { ...DEFAULT_CONFIG, ...config };
  
  // Initialize store
  initStore();
  const vectorStore = getVectorStore();

  // Search for similar chunks
  const results = await vectorStore.search(queryEmbedding, {
    k: options.retrievalK,
  });

  // Filter by similarity threshold
  const relevantResults = results.filter((r) => r.score >= options.similarityThreshold);

  // Build context from relevant chunks
  const context = relevantResults
    .map((r) => r.chunk.content)
    .join('\n\n---\n\n');

  // Collect source information
  const sources = relevantResults.map((r) => ({
    documentName: r.chunk.metadata.documentName,
    chunkIndex: r.chunk.metadata.chunkIndex,
    score: r.score,
  }));

  return { context, sources };
}

/**
 * Get all uploaded documents
 */
export function getDocuments(): Document[] {
  // Initialize store
  initStore();
  const vectorStore = getVectorStore();
  const docInfos = vectorStore.getDocuments();

  return docInfos.map((info) => ({
    id: info.documentId,
    name: info.documentName,
    type: 'application/pdf', // Would be determined from actual upload
    size: 0, // Would be tracked in metadata
    uploadedAt: new Date(), // Would be tracked in metadata
    status: 'ready' as const,
    chunkCount: info.chunkCount,
  }));
}

/**
 * Delete a document and its embeddings
 */
export async function deleteDocument(documentId: string): Promise<void> {
  // Initialize store
  initStore();
  const vectorStore = getVectorStore();
  await vectorStore.deleteByDocument(documentId);
}

/**
 * Get vector store statistics
 */
export function getStats() {
  // Initialize store
  initStore();
  const vectorStore = getVectorStore();
  return vectorStore.getStats();
}

