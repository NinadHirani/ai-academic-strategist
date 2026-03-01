/**
 * Document Upload API
 * Handles file uploads, text extraction, and embedding generation
 * Supports Supabase Storage for file uploads and async processing
 */

import { NextRequest, NextResponse } from "next/server";
import { processDocument } from "@/lib/rag";
import { processDocumentFile, validateFile } from "@/lib/document-processor";
import { supabaseAdmin } from "@/lib/supabase";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const BUCKET_NAME = "documents";

/**
 * Get API configuration for embeddings
 * Uses Groq (fast) with fallback to Ollama
 */
function getEmbeddingConfig(): {
  apiKey: string;
  baseUrl: string;
  model: string;
} {
  // Use Groq API key if available (FASTER), otherwise Ollama
  const groqApiKey = process.env.GROQ_API_KEY;
  
  return {
    apiKey: groqApiKey || "",
    baseUrl: "http://localhost:11434",
    model: "nomic-embed-text",
  };
}

/**
 * Upload file to Supabase Storage
 */
async function uploadToSupabaseStorage(
  file: File,
  userId: string
): Promise<{ path: string; error?: string }> {
  if (!supabaseAdmin) {
    return { path: "", error: "Supabase not configured" };
  }

  try {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const storagePath = `${userId}/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error("[Upload] Storage upload error:", error);
      return { path: "", error: error.message };
    }

    return { path: storagePath };
  } catch (error) {
    console.error("[Upload] Storage error:", error);
    return { path: "", error: "Failed to upload to storage" };
  }
}

/**
 * Store document metadata in Supabase database
 */
async function storeDocumentMetadata(
  documentId: string,
  fileName: string,
  fileSize: number,
  mimeType: string,
  storagePath: string,
  userId: string
): Promise<{ id: string; error?: string }> {
  if (!supabaseAdmin) {
    // Return mock ID if Supabase not configured
    return { id: documentId };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("documents")
      .insert({
        id: documentId,
        user_id: userId,
        file_name: fileName,
        file_size: fileSize,
        mime_type: mimeType,
        storage_path: storagePath,
        chunk_count: 0,
        status: "processing",
      })
      .select()
      .single();

    if (error) {
      console.error("[Upload] DB insert error:", error);
      return { id: documentId, error: error.message };
    }

    return { id: data?.id || documentId };
  } catch (error) {
    console.error("[Upload] DB error:", error);
    return { id: documentId, error: "Failed to store metadata" };
  }
}

/**
 * Update document status after processing
 */
async function updateDocumentStatus(
  documentId: string,
  chunkCount: number,
  status: string = "ready"
): Promise<void> {
  if (!supabaseAdmin) return;

  try {
    await supabaseAdmin
      .from("documents")
      .update({
        chunk_count: chunkCount,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);
  } catch (error) {
    console.error("[Upload] Update status error:", error);
  }
}

/**
 * POST - Upload and process a document
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const userId = "anonymous"; // TODO: Get from session/auth

  try {
    // Parse form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Invalid form data" },
        { status: 400 }
      );
    }

    const file = formData.get("file") as File | null;

    // Validate file
    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type and size
    const validation = validateFile(file);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const fileType = file.type || "application/octet-stream";
    const fileName = file.name;

    console.log(`[Upload] Processing: ${fileName} (${file.size} bytes)`);

    // Generate document ID
    const documentId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // Try to upload to Supabase Storage
    const storageResult = await uploadToSupabaseStorage(file, userId);
    
    // Store document metadata in database
    await storeDocumentMetadata(
      documentId,
      fileName,
      file.size,
      fileType,
      storageResult.path || "",
      userId
    );

    // Read file content
    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await file.arrayBuffer();
    } catch {
      return NextResponse.json(
        { error: "Failed to read file" },
        { status: 500 }
      );
    }

    // Process document (extract text)
    const processedDoc = await processDocumentFile(
      documentId,
      fileName,
      arrayBuffer,
      fileType
    );

    if ("error" in processedDoc) {
      await updateDocumentStatus(documentId, 0, "error");
      return NextResponse.json(
        { error: processedDoc.error },
        { status: 400 }
      );
    }

    // Check if content is meaningful
    if (!processedDoc.content || processedDoc.content.trim().length < 10) {
      await updateDocumentStatus(documentId, 0, "ready");
      return NextResponse.json({
        success: true,
        document: {
          id: documentId,
          name: fileName,
          type: fileType,
          status: "ready",
          chunkCount: 0,
        },
        warning: "Document appears to be empty or contains no extractable text",
      });
    }

    console.log(`[Upload] Extracted ${processedDoc.content.length} characters`);

    // Get embedding configuration
    const { apiKey, baseUrl, model } = getEmbeddingConfig();

    // Process document for RAG (chunk + embed)
    let chunkCount = 0;
    try {
      const result = await processDocument(documentId, fileName, processedDoc.content, apiKey || "", {
        baseUrl,
        model,
        chunkSize: parseInt(process.env.CHUNK_SIZE || "1000"),
        chunkOverlap: parseInt(process.env.CHUNK_OVERLAP || "100"),
      });

      if (!result.success) {
        console.error("[Upload] RAG processing failed:", result.error);
        await updateDocumentStatus(documentId, 0, "error");
        return NextResponse.json(
          { error: result.error || "Failed to process document" },
          { status: 500 }
        );
      }

      chunkCount = result.chunkCount;
    } catch (ragError) {
      console.error("[Upload] RAG error:", ragError);
      await updateDocumentStatus(documentId, 0, "error");
      return NextResponse.json(
        { error: "Failed to generate embeddings" },
        { status: 500 }
      );
    }

    // Update document status to ready
    await updateDocumentStatus(documentId, chunkCount);

    const processingTime = Date.now() - startTime;
    console.log(`[Upload] Done! ${chunkCount} chunks in ${processingTime}ms`);

    return NextResponse.json({
      success: true,
      document: {
        id: documentId,
        name: fileName,
        type: fileType,
        status: "ready",
        chunkCount,
        size: file.size,
      },
      processingTime,
    });

  } catch (error) {
    console.error("[Upload] Unexpected error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Get upload constraints/info
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    maxFileSize: MAX_FILE_SIZE,
    supportedFormats: [
      { type: "application/pdf", extension: ".pdf", name: "PDF" },
      {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        extension: ".docx",
        name: "Word Document",
      },
      { type: "text/plain", extension: ".txt", name: "Plain Text" },
      { type: "text/markdown", extension: ".md", name: "Markdown" },
      { type: "text/csv", extension: ".csv", name: "CSV" },
    ],
    chunkSize: parseInt(process.env.CHUNK_SIZE || "1000"),
    chunkOverlap: parseInt(process.env.CHUNK_OVERLAP || "100"),
  });
}

