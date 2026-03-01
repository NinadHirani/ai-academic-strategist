
/**
 * Debug API - Documents
 * Exposes document and chunk information from Supabase
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Get documents
    const { data: documents, error: docError } = await supabaseAdmin
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (docError) {
      console.error("[Debug] Documents error:", docError);
      return NextResponse.json({ error: docError.message }, { status: 500 });
    }

    // Get chunks
    const { data: chunks, error: chunkError } = await supabaseAdmin
      .from('document_chunks')
      .select('*')
      .limit(50);

    if (chunkError) {
      console.error("[Debug] Chunks error:", chunkError);
      return NextResponse.json({ error: chunkError.message }, { status: 500 });
    }

    // Group chunks by document
    const chunksByDoc: Record<string, number> = {};
    for (const chunk of chunks || []) {
      chunksByDoc[chunk.document_id] = (chunksByDoc[chunk.document_id] || 0) + 1;
    }

    return NextResponse.json({
      documents: documents || [],
      documentCount: documents?.length || 0,
      chunks: chunks || [],
      chunkCount: chunks?.length || 0,
      chunksByDoc,
      supabaseConfigured: !!supabaseAdmin,
    });
  } catch (error) {
    console.error("[Debug] Documents error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

