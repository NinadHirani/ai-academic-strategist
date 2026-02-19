import { NextRequest, NextResponse } from "next/server";
import { processDocument, getDocuments, deleteDocument } from "@/lib/rag";
import { generateEmbedding } from "@/lib/embeddings";

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed file types
const ALLOWED_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
];

interface UploadBody {
  content: string;
  fileName: string;
  fileType: string;
}

/**
 * POST /api/documents
 * Upload and process a document
 */
export async function POST(request: NextRequest) {
  try {
    // Get API key from environment
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }

    // Parse the request body
    const body: UploadBody = await request.json();
    const { content, fileName, fileType } = body;

    // Validate required fields
    if (!content || !fileName) {
      return NextResponse.json(
        { error: "Missing required fields: content, fileName" },
        { status: 400 }
      );
    }

    // Validate file type
    if (fileType && !ALLOWED_TYPES.includes(fileType)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate content size
    if (content.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Generate unique document ID
    const documentId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Process the document
    const result = await processDocument(
      documentId,
      fileName,
      content,
      apiKey
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to process document" },
        { status: 500 }
      );
    }

    // Return success response
    return NextResponse.json({
      success: true,
      document: {
        id: documentId,
        name: fileName,
        type: fileType,
        status: "ready",
        chunkCount: result.chunkCount,
      },
    });
  } catch (error) {
    console.error("Document upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/documents
 * List all uploaded documents
 */
export async function GET() {
  try {
    const documents = getDocuments();
    return NextResponse.json({ documents });
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents
 * Delete a document by ID
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("id");

    if (!documentId) {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    await deleteDocument(documentId);

    return NextResponse.json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}

