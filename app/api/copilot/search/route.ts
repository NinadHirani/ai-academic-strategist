/**
 * API: /api/copilot/search
 * Searches for a syllabus and parses it into structured JSON.
 * Also generates a full study roadmap in one call.
 */

import { NextRequest, NextResponse } from "next/server";
import { runFullPipeline } from "@/lib/copilot-engine";

export const maxDuration = 60; // Allow up to 60s for search + parse + roadmap

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = body.query?.trim();

    if (!query) {
      return NextResponse.json(
        { error: "Missing 'query' field. Example: 'TOC, Semester 6, GTU'" },
        { status: 400 }
      );
    }

    console.log(`[Copilot/Search] Pipeline started for: "${query}"`);
    const startTime = Date.now();

    const { syllabus, roadmap } = await runFullPipeline(query);

    const elapsed = Date.now() - startTime;
    console.log(
      `[Copilot/Search] Pipeline completed in ${elapsed}ms — ${syllabus.totalTopics} topics, ${roadmap.totalEstimatedHours}h estimated`
    );

    return NextResponse.json({
      success: true,
      syllabus,
      roadmap,
      meta: {
        query,
        elapsedMs: elapsed,
        totalTopics: syllabus.totalTopics,
        totalHours: roadmap.totalEstimatedHours,
      },
    });
  } catch (error: any) {
    console.error("[Copilot/Search] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Pipeline failed",
        hint: error.message?.includes("API")
          ? "Check that TAVILY_API_KEY or SERPAPI_KEY and GROQ_API_KEY are set in .env.local"
          : undefined,
      },
      { status: 500 }
    );
  }
}
