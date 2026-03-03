/**
 * API: /api/copilot/search
 * Runs the full pipeline: web search + LLM knowledge → syllabus → roadmap
 * Now uses LLM knowledge as primary source with web search as supplement.
 */

import { NextRequest, NextResponse } from "next/server";
import { runFullPipeline } from "@/lib/copilot-engine";

export const maxDuration = 90; // Allow up to 90s for the full pipeline

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
      `[Copilot/Search] Pipeline completed in ${elapsed}ms — ${syllabus.totalTopics} topics across ${syllabus.units.length} units, ${roadmap.totalEstimatedHours}h estimated`
    );

    return NextResponse.json({
      success: true,
      syllabus,
      roadmap,
      meta: {
        query,
        elapsedMs: elapsed,
        totalTopics: syllabus.totalTopics,
        totalUnits: syllabus.units.length,
        totalHours: roadmap.totalEstimatedHours,
      },
    });
  } catch (error: any) {
    console.error("[Copilot/Search] Error:", error);
    let hint: string | undefined;
    if (error.message?.toLowerCase().includes("rate limit")) {
      hint =
        "Groq API quota exceeded — please wait a few minutes or upgrade your plan.";
    } else if (error.message?.includes("API")) {
      hint = "Check that GROQ_API_KEY is set in .env.local";
    } else {
      hint = "Try a more specific query like 'Theory of Computation, Semester 6, GTU'";
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Pipeline failed",
        hint,
      },
      { status: 500 }
    );
  }
}
