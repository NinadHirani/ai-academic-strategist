import { NextRequest, NextResponse } from "next/server";
import { clusterQuestions } from "@/lib/pyq/clustering-service";
import { getPyqRuntimeStore } from "@/lib/pyq/runtime-store";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const jobId = typeof body?.jobId === "string" ? body.jobId : "";
    const threshold = typeof body?.threshold === "number" ? body.threshold : 0.68;

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    const store = getPyqRuntimeStore();
    const job = store.getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (!job.extractedQuestions.length) {
      return NextResponse.json(
        { error: "No extracted questions found. Run /api/pyq/extract first." },
        { status: 400 }
      );
    }

    store.updateJobProgress(jobId, "detecting_duplicates", "running", 55, "Grouping semantically similar questions");

    const clusters = clusterQuestions(job.extractedQuestions, threshold);
    store.setClusters(jobId, clusters);

    store.updateJobProgress(
      jobId,
      "detecting_duplicates",
      "completed",
      70,
      `Created ${clusters.length} consolidated PYQ groups`
    );

    return NextResponse.json({
      success: true,
      jobId,
      clusterCount: clusters.length,
      clusters,
      progress: store.toProgress(jobId),
    });
  } catch (error) {
    console.error("[PYQ Cluster API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Clustering failed" },
      { status: 500 }
    );
  }
}
