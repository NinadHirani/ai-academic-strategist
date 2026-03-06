import { NextRequest, NextResponse } from "next/server";
import { generateAnswersForClusters } from "@/lib/pyq/answer-service";
import { getPyqRuntimeStore } from "@/lib/pyq/runtime-store";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const jobId = typeof body?.jobId === "string" ? body.jobId : "";
    const mode = body?.mode === "top_repeated" ? "top_repeated" : "all";
    const limit = Math.min(Math.max(Number(body?.limit) || 10, 1), 100);

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    const store = getPyqRuntimeStore();
    const job = store.getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (!job.clusters.length) {
      return NextResponse.json(
        { error: "No clusters found. Run /api/pyq/cluster first." },
        { status: 400 }
      );
    }

    const selectedClusters =
      mode === "top_repeated"
        ? [...job.clusters].sort((a, b) => b.frequency - a.frequency).slice(0, limit)
        : job.clusters;

    store.updateJobProgress(jobId, "generating_answers", "running", 90, "Generating exam-optimized answers");

    const generatedAnswers = await generateAnswersForClusters(selectedClusters);
    store.setGeneratedAnswers(jobId, generatedAnswers);

    store.updateJobProgress(jobId, "completed", "completed", 100, "PYQ answer booklet is ready for export");

    return NextResponse.json({
      success: true,
      jobId,
      generatedCount: generatedAnswers.length,
      mode,
      generatedAnswers,
      progress: store.toProgress(jobId),
    });
  } catch (error) {
    console.error("[PYQ Generate API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Answer generation failed" },
      { status: 500 }
    );
  }
}
