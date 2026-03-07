/**
 * API: /api/copilot/expand
 * Expands a single topic with deep explanations and real web resources.
 */

import { NextRequest, NextResponse } from "next/server";
import { expandTopic, validateLinks } from "@/lib/copilot-engine";
import type { RoadmapTopic } from "@/lib/copilot-types";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topic, subject, university } = body as {
      topic: RoadmapTopic;
      subject: string;
      university: string;
    };

    if (!topic?.id || !topic?.name || !subject) {
      return NextResponse.json(
        { error: "Missing required fields: topic (with id, name), subject" },
        { status: 400 }
      );
    }

    console.log(`[Copilot/Expand] Expanding topic: "${topic.name}" (${subject})`);
    const startTime = Date.now();

    const expansion = await expandTopic(topic, subject, university || "Unknown");

    // Validate links in the background (non-blocking for response, 
    // but we still include the initial verified=true from search)
    // For stricter validation, uncomment the section below:
    // const allResources = [
    //   ...expansion.articles,
    //   ...expansion.youtubeResources,
    //   ...expansion.academicReferences,
    // ];
    // const validated = await validateLinks(allResources);
    // ... then remap back

    const elapsed = Date.now() - startTime;
    console.log(
      `[Copilot/Expand] Topic expanded in ${elapsed}ms — ${expansion.articles.length} articles, ${expansion.youtubeResources.length} videos`
    );

    return NextResponse.json({
      success: true,
      expansion,
      meta: {
        topicId: topic.id,
        elapsedMs: elapsed,
        articleCount: expansion.articles.length,
        videoCount: expansion.youtubeResources.length,
        referenceCount: expansion.academicReferences.length,
      },
    });
  } catch (error: any) {
    console.error("[Copilot/Expand] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Topic expansion failed",
      },
      { status: 500 }
    );
  }
}
