import { NextRequest, NextResponse } from "next/server";
import { extractQuestionsFromPapers } from "@/lib/pyq/extraction-service";
import { getPyqRuntimeStore } from "@/lib/pyq/runtime-store";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const jobId = typeof body?.jobId === "string" ? body.jobId : "";

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    const store = getPyqRuntimeStore();
    const job = store.getJob(jobId);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    store.updateJobProgress(jobId, "extracting_questions", "running", 25, "Extracting text and questions");

    const papers = store.getPapersByIds(job.paperIds);
    const extractedQuestions = await extractQuestionsFromPapers(papers);

    store.setExtractedQuestions(jobId, extractedQuestions);
    store.updateJobProgress(
      jobId,
      "extracting_questions",
      "completed",
      45,
      `Extracted ${extractedQuestions.length} questions`
    );

    return NextResponse.json({
      success: true,
      jobId,
      extractedCount: extractedQuestions.length,
      extractedQuestions,
      progress: store.toProgress(jobId),
    });
  } catch (error) {
    console.error("[PYQ Extract API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Extraction failed" },
      { status: 500 }
    );
  }
}
