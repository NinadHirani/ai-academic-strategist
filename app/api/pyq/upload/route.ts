import { NextRequest, NextResponse } from "next/server";
import { validateFile } from "@/lib/document-processor";
import { getPyqRuntimeStore } from "@/lib/pyq/runtime-store";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const subject = ((formData.get("subject") as string) || "General").trim();

    const files = formData.getAll("files") as File[];
    if (!files.length) {
      const single = formData.get("file") as File | null;
      if (single) files.push(single);
    }

    if (!files.length) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const runtimeStore = getPyqRuntimeStore();
    const acceptedFiles: File[] = [];
    const rejectedFiles: Array<{ fileName: string; reason: string }> = [];

    for (const file of files) {
      const validation = validateFile(file);
      if (!validation.valid) {
        rejectedFiles.push({
          fileName: file.name,
          reason: validation.error || "Validation failed",
        });
        continue;
      }
      acceptedFiles.push(file);
    }

    if (!acceptedFiles.length) {
      return NextResponse.json(
        { error: "All files were rejected", rejectedFiles },
        { status: 400 }
      );
    }

    const papers = [];

    for (const file of acceptedFiles) {
      const content = await file.arrayBuffer();
      const base64 = Buffer.from(content).toString("base64");

      papers.push(
        runtimeStore.createPaper({
          subject,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          base64,
        })
      );
    }

    runtimeStore.addPapers(papers);
    const job = runtimeStore.createJob(subject, papers.map((paper) => paper.id));
    runtimeStore.updateJobProgress(job.id, "parsing_papers", "queued", 10, "Papers uploaded and queued");

    return NextResponse.json({
      success: true,
      jobId: job.id,
      subject,
      papers: papers.map((paper) => ({
        id: paper.id,
        fileName: paper.fileName,
        mimeType: paper.mimeType,
        size: paper.size,
        yearHint: paper.yearHint,
        seasonHint: paper.seasonHint,
      })),
      rejectedFiles,
      progress: runtimeStore.toProgress(job.id),
    });
  } catch (error) {
    console.error("[PYQ Upload API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
