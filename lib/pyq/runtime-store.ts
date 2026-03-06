import { randomUUID } from "crypto";
import {
  ClusterAnalysis,
  GeneratedAnswer,
  PipelineProgress,
  PyqJob,
  PyqPipelineStage,
  PyqJobStatus,
  QuestionCluster,
  ExtractedQuestion,
  UploadedPaper,
} from "@/lib/pyq/types";

class PyqRuntimeStore {
  private papers = new Map<string, UploadedPaper>();
  private jobs = new Map<string, PyqJob>();

  addPapers(papers: UploadedPaper[]): void {
    for (const paper of papers) {
      this.papers.set(paper.id, paper);
    }
  }

  getPapersByIds(ids: string[]): UploadedPaper[] {
    return ids
      .map((id) => this.papers.get(id))
      .filter((paper): paper is UploadedPaper => Boolean(paper));
  }

  getPaper(id: string): UploadedPaper | null {
    return this.papers.get(id) || null;
  }

  createJob(subject: string, paperIds: string[]): PyqJob {
    const now = new Date().toISOString();
    const job: PyqJob = {
      id: randomUUID(),
      subject,
      paperIds,
      status: "queued",
      stage: "idle",
      progressPercent: 0,
      stageMessage: "Waiting to start",
      extractedQuestions: [],
      clusters: [],
      analysis: null,
      generatedAnswers: [],
      errors: [],
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(job.id, job);
    return job;
  }

  getJob(jobId: string): PyqJob | null {
    return this.jobs.get(jobId) || null;
  }

  updateJobProgress(jobId: string, stage: PyqPipelineStage, status: PyqJobStatus, progressPercent: number, message: string): PyqJob {
    const existing = this.jobs.get(jobId);
    if (!existing) {
      throw new Error("Job not found");
    }

    const updated: PyqJob = {
      ...existing,
      stage,
      status,
      progressPercent,
      stageMessage: message,
      updatedAt: new Date().toISOString(),
    };

    this.jobs.set(jobId, updated);
    return updated;
  }

  setExtractedQuestions(jobId: string, extractedQuestions: ExtractedQuestion[]): PyqJob {
    const existing = this.jobs.get(jobId);
    if (!existing) {
      throw new Error("Job not found");
    }

    const updated: PyqJob = {
      ...existing,
      extractedQuestions,
      updatedAt: new Date().toISOString(),
    };

    this.jobs.set(jobId, updated);
    return updated;
  }

  setClusters(jobId: string, clusters: QuestionCluster[]): PyqJob {
    const existing = this.jobs.get(jobId);
    if (!existing) {
      throw new Error("Job not found");
    }

    const updated: PyqJob = {
      ...existing,
      clusters,
      updatedAt: new Date().toISOString(),
    };

    this.jobs.set(jobId, updated);
    return updated;
  }

  setAnalysis(jobId: string, analysis: ClusterAnalysis): PyqJob {
    const existing = this.jobs.get(jobId);
    if (!existing) {
      throw new Error("Job not found");
    }

    const updated: PyqJob = {
      ...existing,
      analysis,
      updatedAt: new Date().toISOString(),
    };

    this.jobs.set(jobId, updated);
    return updated;
  }

  setGeneratedAnswers(jobId: string, generatedAnswers: GeneratedAnswer[]): PyqJob {
    const existing = this.jobs.get(jobId);
    if (!existing) {
      throw new Error("Job not found");
    }

    const updated: PyqJob = {
      ...existing,
      generatedAnswers,
      updatedAt: new Date().toISOString(),
    };

    this.jobs.set(jobId, updated);
    return updated;
  }

  addError(jobId: string, error: string): PyqJob {
    const existing = this.jobs.get(jobId);
    if (!existing) {
      throw new Error("Job not found");
    }

    const updated: PyqJob = {
      ...existing,
      errors: [...existing.errors, error],
      updatedAt: new Date().toISOString(),
    };

    this.jobs.set(jobId, updated);
    return updated;
  }

  toProgress(jobId: string): PipelineProgress {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    return {
      stage: job.stage,
      status: job.status,
      progressPercent: job.progressPercent,
      message: job.stageMessage,
      updatedAt: job.updatedAt,
    };
  }

  createPaper(input: {
    subject: string;
    fileName: string;
    mimeType: string;
    size: number;
    base64: string;
  }): UploadedPaper {
    const yearMatch = input.fileName.match(/(20\d{2})/);
    const seasonMatch = input.fileName.match(/(winter|summer|spring|autumn|fall)/i);

    return {
      id: randomUUID(),
      subject: input.subject,
      fileName: input.fileName,
      mimeType: input.mimeType,
      size: input.size,
      uploadedAt: new Date().toISOString(),
      base64: input.base64,
      yearHint: yearMatch ? Number(yearMatch[1]) : undefined,
      seasonHint: seasonMatch ? seasonMatch[1] : undefined,
    };
  }
}

let runtimeStore: PyqRuntimeStore | null = null;

export function getPyqRuntimeStore(): PyqRuntimeStore {
  if (!runtimeStore) {
    runtimeStore = new PyqRuntimeStore();
  }
  return runtimeStore;
}
