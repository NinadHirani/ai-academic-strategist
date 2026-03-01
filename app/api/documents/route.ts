/**
 * Documents API
 * Handles listing and deleting documents
 */

import { NextRequest, NextResponse } from "next/server";
import { getDocuments, deleteDocument, getStats } from "@/lib/rag";

interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
  status: "processing" | "ready" | "error";
  chunkCount: number;
  error?: string;
}

/**
 * GET - List all uploaded documents
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId") || undefined;

    const documents = getDocuments();
    const stats = getStats();

    const documentList: Document[] = documents.map((doc) => ({
      id: doc.id,
      name: doc.name,
      type: "application/pdf", // Would be stored in metadata
      size: 0,
      uploadedAt: doc.uploadedAt || new Date(),
      status: "ready" as const,
      chunkCount: doc.chunkCount,
    }));

    return NextResponse.json({
      documents: documentList,
      total: documentList.length,
      stats: {
        totalChunks: stats.totalChunks,
        totalDocuments: stats.totalDocuments,
        storageMode: stats.storageMode || "memory",
      },
    });
  } catch (error) {
    console.error("[Documents] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete a document
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const documentId = searchParams.get("id");

    if (!documentId) {
      return NextResponse.json(
        { error: "Document ID required" },
        { status: 400 }
      );
    }

    console.log(`[Documents] Deleting document: ${documentId}`);

    await deleteDocument(documentId);

    return NextResponse.json({
      success: true,
      message: `Document ${documentId} deleted`,
    });
  } catch (error) {
    console.error("[Documents] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}

