/**
 * Diagnostic API Endpoint
 * Tests the entire document upload → embedding → retrieval → chat pipeline
 * GET /api/debug/pipeline → run full diagnostic
 */

import { NextRequest, NextResponse } from "next/server";
import { processDocument, retrieveContext, getStats, getDocuments } from "@/lib/rag";
import { generateEmbedding, generateEmbeddings } from "@/lib/embeddings";
import { getVectorStore, initVectorStore } from "@/lib/vector-store";
import { hasPersistedData, loadChunksFromDisk } from "@/lib/vector-persistence";

interface DiagnosticResult {
  step: string;
  status: "pass" | "fail" | "warn";
  message: string;
  detail?: unknown;
  timeMs?: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const results: DiagnosticResult[] = [];
  const searchParams = request.nextUrl.searchParams;
  const runFull = searchParams.get("full") === "true";

  // Step 1: Check environment variables
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY;

  results.push({
    step: "ENV: GROQ_API_KEY",
    status: groqKey ? "pass" : "fail",
    message: groqKey ? `Set (${groqKey.substring(0, 8)}...)` : "MISSING — no API key for chat or embeddings",
  });

  results.push({
    step: "ENV: SUPABASE_URL",
    status: supabaseUrl ? "pass" : "warn",
    message: supabaseUrl ? `Set (${supabaseUrl.substring(0, 30)}...)` : "MISSING — in-memory mode only",
  });

  results.push({
    step: "ENV: SUPABASE_SERVICE_ROLE_KEY",
    status: supabaseService ? "pass" : "warn",
    message: supabaseService 
      ? "Set — Supabase persistence enabled" 
      : "MISSING — documents stored in-memory only, using file-based persistence as fallback. Get this key from Supabase Dashboard > Settings > API > service_role",
  });

  // Step 2: Check vector store state
  const stats = getStats();
  results.push({
    step: "Vector Store",
    status: stats.totalChunks > 0 ? "pass" : "warn",
    message: `${stats.totalChunks} chunks, ${stats.totalDocuments} documents (mode: ${stats.storageMode})`,
    detail: stats,
  });

  // Step 3: Check file-based persistence
  const hasFileCache = hasPersistedData();
  const persistedChunks = hasFileCache ? loadChunksFromDisk() : [];
  results.push({
    step: "File Persistence",
    status: hasFileCache ? "pass" : "warn",
    message: hasFileCache 
      ? `${persistedChunks.length} chunks persisted to disk` 
      : "No persisted data on disk",
  });

  // Step 4: List documents in store
  const docs = getDocuments();
  results.push({
    step: "Documents Loaded",
    status: docs.length > 0 ? "pass" : "warn",
    message: docs.length > 0
      ? docs.map(d => `${d.name} (${d.chunkCount} chunks)`).join(", ")
      : "No documents uploaded yet",
    detail: docs,
  });

  // Step 5: Test embedding generation (only if running full test)
  if (runFull) {
    const apiKey = groqKey || openaiKey || "";
    const baseUrl = groqKey ? "https://api.groq.com/openai/v1" : "https://api.openai.com/v1";
    
    const t0 = Date.now();
    try {
      const testEmbedding = await generateEmbedding("What is quantum computing?", {
        apiKey,
        baseUrl,
        model: "text-embedding-3-small",
      });
      const t1 = Date.now();
      results.push({
        step: "Embedding Generation",
        status: testEmbedding.length > 0 ? "pass" : "fail",
        message: `Generated ${testEmbedding.length}-dim embedding in ${t1 - t0}ms`,
        timeMs: t1 - t0,
      });
    } catch (error) {
      results.push({
        step: "Embedding Generation",
        status: "fail",
        message: `Error: ${error instanceof Error ? error.message : String(error)}`,
        timeMs: Date.now() - t0,
      });
    }

    // Step 6: Test retrieval (if documents exist)
    if (stats.totalChunks > 0) {
      const t2 = Date.now();
      try {
        const queryEmb = await generateEmbedding("test query about the uploaded document", {
          apiKey,
          baseUrl,
          model: "text-embedding-3-small",
        });
        const retrieval = await retrieveContext("test query", queryEmb, apiKey);
        const t3 = Date.now();
        results.push({
          step: "Retrieval Test",
          status: retrieval.sources.length > 0 ? "pass" : "warn",
          message: `Found ${retrieval.sources.length} relevant chunks in ${t3 - t2}ms`,
          detail: {
            contextLength: retrieval.context.length,
            sources: retrieval.sources.slice(0, 3),
          },
          timeMs: t3 - t2,
        });
      } catch (error) {
        results.push({
          step: "Retrieval Test",
          status: "fail",
          message: `Error: ${error instanceof Error ? error.message : String(error)}`,
          timeMs: Date.now() - t2,
        });
      }
    }

    // Step 7: Test document ingestion with sample data
    if (searchParams.get("ingest") === "true") {
      const t4 = Date.now();
      try {
        const testResult = await processDocument(
          "test-diagnostic-doc",
          "diagnostic-test.txt",
          "Quantum computing uses qubits instead of classical bits. A qubit can exist in superposition, being both 0 and 1 simultaneously. This is fundamentally different from classical computing where a bit must be either 0 or 1. Quantum entanglement allows qubits to be correlated with each other, enabling quantum computers to process certain calculations much faster than classical computers.",
          apiKey,
          { baseUrl, model: "text-embedding-3-small" }
        );
        const t5 = Date.now();
        results.push({
          step: "Test Document Ingestion",
          status: testResult.success ? "pass" : "fail",
          message: testResult.success
            ? `Ingested test doc: ${testResult.chunkCount} chunks in ${t5 - t4}ms`
            : `Failed: ${testResult.error}`,
          timeMs: t5 - t4,
        });
      } catch (error) {
        results.push({
          step: "Test Document Ingestion",
          status: "fail",
          message: `Error: ${error instanceof Error ? error.message : String(error)}`,
          timeMs: Date.now() - t4,
        });
      }
    }
  }

  // Overall status
  const failCount = results.filter(r => r.status === "fail").length;
  const warnCount = results.filter(r => r.status === "warn").length;

  return NextResponse.json({
    overall: failCount > 0 ? "FAILING" : warnCount > 0 ? "PARTIAL" : "HEALTHY",
    failCount,
    warnCount,
    passCount: results.filter(r => r.status === "pass").length,
    results,
    help: {
      fullTest: "Add ?full=true to run embedding and retrieval tests",
      ingestTest: "Add ?full=true&ingest=true to also ingest a test document",
      serviceKey: "To enable Supabase persistence, add SUPABASE_SERVICE_ROLE_KEY to .env.local (get from Supabase Dashboard > Settings > API)",
    },
  });
}
