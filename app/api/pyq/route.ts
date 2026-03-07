import { NextRequest, NextResponse } from "next/server";
import { getPyqRuntimeStore } from "@/lib/pyq/runtime-store";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId") || "";

    if (!jobId) {
      return NextResponse.json({ error: "jobId query parameter is required" }, { status: 400 });
    }

    const store = getPyqRuntimeStore();
    const job = store.getJob(jobId);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        subject: job.subject,
        status: job.status,
        stage: job.stage,
        progressPercent: job.progressPercent,
        stageMessage: job.stageMessage,
        paperCount: job.paperIds.length,
        extractedCount: job.extractedQuestions.length,
        clusterCount: job.clusters.length,
        generatedCount: job.generatedAnswers.length,
        errors: job.errors,
        updatedAt: job.updatedAt,
      },
    });
  } catch (error) {
    console.error("[PYQ Status API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get job status" },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        "This endpoint no longer accepts POST actions. Use /api/pyq/upload, /api/pyq/extract, /api/pyq/cluster, /api/pyq/analysis, /api/pyq/generate-answers, /api/pyq/export.",
    },
    { status: 405 }
  );
}
