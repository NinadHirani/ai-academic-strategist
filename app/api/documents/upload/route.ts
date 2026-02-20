import { NextRequest, NextResponse } from "next/server";
import { processDocument } from "@/lib/rag";

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Extract text from different file types
 */
function extractText(content: string, fileType: string): string {
  // If already plain text, return as-is
  if (fileType === "text/plain" || fileType === "text/markdown" || fileType === "text/csv") {
    return content;
  }
  
  // For PDF, we would use a library like pdf-parse in production
  return content;
}

/**
 * POST /api/documents/upload
 * Handle file upload and processing
 */
export async function POST(request: NextRequest) {
  try {
    // Get API key from environment
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured. Please set OPENAI_API_KEY in .env.local" },
        { status: 500 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    
    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Extract file content
    const content = await file.text();
    
    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not extract text from file" },
        { status: 400 }
      );
    }

    // Extract text based on file type
    const fileType = file.type || "text/plain";
    const text = extractText(content, fileType);

    // Generate unique document ID
    const documentId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fileName = file.name;

    // Process the document
    const result = await processDocument(
      documentId,
      fileName,
      text,
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
    console.error("File upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

