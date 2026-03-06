/**
 * Debug API - Vector Store
 * Exposes retrieval logs and vector store stats for debugging
 */

import { NextRequest, NextResponse } from "next/server";
import { getVectorStore, getRetrievalLogs, clearRetrievalLogs, resetVectorStore } from "@/lib/vector-store";

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const vectorStore = getVectorStore();
    const stats = vectorStore.getStats();
    const logs = getRetrievalLogs();

    return NextResponse.json({
      stats,
      retrievalLogs: logs,
      logCount: logs.length,
    });
  } catch (error) {
    console.error("[Debug] Vector store error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    // Clear retrieval logs
    clearRetrievalLogs();
    
    // Optionally reset the entire vector store
    // resetVectorStore();

    return NextResponse.json({
      message: "Retrieval logs cleared",
    });
  } catch (error) {
    console.error("[Debug] Clear error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

