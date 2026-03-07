import { NextRequest, NextResponse } from "next/server";
import { buildClusterAnalysis } from "@/lib/pyq/analysis-service";
import { getPyqRuntimeStore } from "@/lib/pyq/runtime-store";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId") || "";

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

    store.updateJobProgress(jobId, "analyzing_frequency", "running", 78, "Computing frequency analytics");

    const analysis = buildClusterAnalysis(job.clusters);
    store.setAnalysis(jobId, analysis);

    store.updateJobProgress(
      jobId,
      "analyzing_frequency",
      "completed",
      85,
      "Frequency and marks analytics ready"
    );

    return NextResponse.json({
      success: true,
      jobId,
      analysis,
      progress: store.toProgress(jobId),
    });
  } catch (error) {
    console.error("[PYQ Analysis API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
