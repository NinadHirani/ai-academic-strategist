/**
 * RAG (Retrieval Augmented Generation) Orchestration
 * Coordinates document processing, embedding, retrieval, and generation
 */

import { splitByParagraphs, TextChunk } from './text-chunker';
import { generateEmbeddings } from './embeddings';
import { getVectorStore, VectorChunk, SearchResult } from './vector-store';

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
}

const DEFAULT_CONFIG: Required<RAGConfig> = {
  chunkSize: 500,
  chunkOverlap: 50,
  retrievalK: 3,
  similarityThreshold: -1,
};

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
  const vectorStore = getVectorStore();

  try {
    const chunks = splitByParagraphs(
      text,
      documentId,
      documentName,
      { chunkSize: options.chunkSize, chunkOverlap: options.chunkOverlap }
    );

    if (chunks.length === 0) {
      return { success: false, chunkCount: 0, error: 'No text content found in document' };
    }

    const texts = chunks.map((c) => c.content);
    const embeddings = await generateEmbeddings(texts, { apiKey, batchSize: 100 });

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

    await vectorStore.add(vectorChunks);

    return { success: true, chunkCount: chunks.length };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[RAG] Error processing document: ${errorMessage}`);
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
  const vectorStore = getVectorStore();

  const results = await vectorStore.search(queryEmbedding, { k: options.retrievalK });

  const relevantResults = options.similarityThreshold >= 0 
    ? results.filter((r) => r.score >= options.similarityThreshold)
    : results;

  const context = relevantResults
    .map((r) => r.chunk.content)
    .join('\n\n---\n\n');

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
  const vectorStore = getVectorStore();
  const docInfos = vectorStore.getDocuments();

  return docInfos.map((info) => ({
    id: info.documentId,
    name: info.documentName,
    type: 'application/pdf',
    size: 0,
    uploadedAt: new Date(),
    status: 'ready' as const,
    chunkCount: info.chunkCount,
  }));
}

/**
 * Delete a document and its embeddings
 */
export async function deleteDocument(documentId: string): Promise<void> {
  const vectorStore = getVectorStore();
  await vectorStore.deleteByDocument(documentId);
}

/**
 * Get vector store statistics
 */
export function getStats() {
  const vectorStore = getVectorStore();
  return vectorStore.getStats();
}

