"use client";

import { useMemo, useState } from "react";
import styles from "./page.module.css";

type UploadedPaper = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  yearHint?: number;
  seasonHint?: string;
};

type Progress = {
  stage: string;
  status: string;
  progressPercent: number;
  message: string;
  updatedAt: string;
};

type ExtractedQuestion = {
  id: string;
  questionNumber?: string;
  questionText: string;
  marks: number;
  paperYear: number;
  paperSeason?: string;
};

type Cluster = {
  id: string;
  canonicalQuestion: string;
  frequency: number;
  yearsAsked: string[];
  marksValues: number[];
  averageMarks: number;
  sampleVariants: string[];
};

type Analysis = {
  questionAnalytics: Array<{
    clusterId: string;
    canonicalQuestion: string;
    frequency: number;
    yearsAsked: string[];
    averageMarks: number;
    probabilityScore: number;
    marksValues: number[];
  }>;
  mostImportantTopics: Array<{ topic: string; frequency: number; averageMarks: number }>;
  marksDistributionByTopic: Record<string, Array<{ bucket: string; count: number; percentage: number }>>;
};

type GeneratedAnswer = {
  id: string;
  question: string;
  marks: number;
  frequency: number;
  yearsAsked: string[];
  answer: string;
  figure: string | null;
  table: string | null;
};

const STAGES = [
  { key: "parsing_papers", label: "Parsing papers" },
  { key: "extracting_questions", label: "Extracting questions" },
  { key: "detecting_duplicates", label: "Detecting duplicates" },
  { key: "analyzing_frequency", label: "Analyzing frequency" },
  { key: "generating_answers", label: "Generating answers" },
];

export default function PyqPage() {
  const [subject, setSubject] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [jobId, setJobId] = useState<string>("");
  const [uploadedPapers, setUploadedPapers] = useState<UploadedPaper[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [extractedQuestions, setExtractedQuestions] = useState<ExtractedQuestion[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [generatedAnswers, setGeneratedAnswers] = useState<GeneratedAnswer[]>([]);
  const [generationMode, setGenerationMode] = useState<"all" | "top_repeated">("all");
  const [topLimit, setTopLimit] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canUpload = useMemo(() => subject.trim().length > 0 && files.length > 0, [subject, files]);
  const canAnalyze = useMemo(() => Boolean(jobId), [jobId]);

  async function uploadPapers() {
    if (!canUpload) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("subject", subject.trim());
      files.forEach((file) => formData.append("files", file));

      const response = await fetch("/api/pyq/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Upload failed");
      }

      setJobId(data.jobId);
      setUploadedPapers(Array.isArray(data.papers) ? data.papers : []);
      setProgress(data.progress || null);
      setExtractedQuestions([]);
      setClusters([]);
      setAnalysis(null);
      setGeneratedAnswers([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function runAnalysisPipeline() {
    if (!canAnalyze) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const extractRes = await fetch("/api/pyq/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const extractData = await extractRes.json();
      if (!extractRes.ok) {
        throw new Error(extractData?.error || "Extraction failed");
      }
      setExtractedQuestions(Array.isArray(extractData.extractedQuestions) ? extractData.extractedQuestions : []);
      setProgress(extractData.progress || null);

      const clusterRes = await fetch("/api/pyq/cluster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const clusterData = await clusterRes.json();
      if (!clusterRes.ok) {
        throw new Error(clusterData?.error || "Clustering failed");
      }
      setClusters(Array.isArray(clusterData.clusters) ? clusterData.clusters : []);
      setProgress(clusterData.progress || null);

      const analysisRes = await fetch(`/api/pyq/analysis?jobId=${encodeURIComponent(jobId)}`);
      const analysisData = await analysisRes.json();
      if (!analysisRes.ok) {
        throw new Error(analysisData?.error || "Analysis failed");
      }
      setAnalysis(analysisData.analysis || null);
      setProgress(analysisData.progress || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pipeline failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function generateAnswers() {
    if (!jobId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/pyq/generate-answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, mode: generationMode, limit: topLimit }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Generation failed");
      }

      setGeneratedAnswers(Array.isArray(data.generatedAnswers) ? data.generatedAnswers : []);
      setProgress(data.progress || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function exportBooklet() {
    if (!jobId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/pyq/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Export failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `pyq-answer-booklet-${Date.now()}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsLoading(false);
    }
  }

  function stageStatus(stageKey: string): "pending" | "active" | "done" {
    if (!progress) {
      return "pending";
    }

    if (progress.stage === stageKey && progress.status === "running") {
      return "active";
    }

    const stageOrder = STAGES.map((s) => s.key);
    const currentIndex = stageOrder.indexOf(progress.stage);
    const stageIndex = stageOrder.indexOf(stageKey);
    if (currentIndex > stageIndex || progress.stage === "completed") {
      return "done";
    }

    return "pending";
  }

  return (
    <main className="main-content container-premium section-spacing">
      <div className="hero-section">
        <h1 className="hero-title">AI Past Paper Analyzer + Answer Generator</h1>
        <p className="hero-subtitle">Upload exam papers, detect repeated PYQs, and generate exam-ready answer booklets.</p>
      </div>

      <section className={`card-premium ${styles.sectionCard}`}>
        <h2>1. Subject Input</h2>
        <label className={styles.srOnly} htmlFor="pyq-subject-input">
          Subject name
        </label>
        <input
          id="pyq-subject-input"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Enter subject name (e.g., Operating Systems, Physics, Management)"
          className={styles.fullInput}
        />
      </section>

      <section className={`card-premium ${styles.sectionCard}`}>
        <h2>2. Multi-file Upload</h2>
        <label className={styles.srOnly} htmlFor="pyq-file-upload">
          Upload PYQ files
        </label>
        <input
          id="pyq-file-upload"
          type="file"
          multiple
          accept=".pdf,image/*"
          onChange={(event) => setFiles(Array.from(event.target.files || []))}
          className={styles.fileInput}
        />
        <div className={styles.helperText}>
          {files.length ? `${files.length} file(s) selected` : "No files selected"}
        </div>
        <button className={`btn-premium ${styles.topGap}`} disabled={!canUpload || isLoading} onClick={uploadPapers}>
          {isLoading ? "Working..." : "Upload Papers"}
        </button>

        {uploadedPapers.length > 0 && (
          <div className={styles.topGap}>
            <h3>Uploaded Papers</h3>
            <ul>
              {uploadedPapers.map((paper) => (
                <li key={paper.id}>
                  {paper.fileName} ({paper.mimeType}) {paper.yearHint ? `- ${paper.yearHint}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className={`card-premium ${styles.sectionCard}`}>
        <h2>3. Processing Status</h2>
        <button className="btn-premium" disabled={!canAnalyze || isLoading} onClick={runAnalysisPipeline}>
          {isLoading ? "Processing..." : "Start Analysis"}
        </button>
        <div className={styles.topGap}>
          {STAGES.map((stage) => {
            const status = stageStatus(stage.key);
            return (
              <div key={stage.key} className={styles.stageRow}>
                <strong>
                  {status === "done" ? "Done" : status === "active" ? "Running" : "Pending"}
                </strong>
                <span>{stage.label}</span>
              </div>
            );
          })}
        </div>
        {progress && (
          <p className={styles.helperText}>
            {progress.message} ({progress.progressPercent}%)
          </p>
        )}
      </section>

      {error && (
        <section className={`card-premium ${styles.sectionCard} ${styles.errorText}`}>
          {error}
        </section>
      )}

      <section className={`card-premium ${styles.sectionCard}`}>
        <h2>4. Extracted Questions</h2>
        {extractedQuestions.length === 0 ? (
          <p>No extracted questions yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Q No</th>
                  <th>Question</th>
                  <th>Marks</th>
                  <th>Paper</th>
                </tr>
              </thead>
              <tbody>
                {extractedQuestions.map((q) => (
                  <tr key={q.id}>
                    <td>{q.questionNumber || "-"}</td>
                    <td>{q.questionText}</td>
                    <td>{q.marks}</td>
                    <td>{q.paperSeason || q.paperYear}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={`card-premium ${styles.sectionCard}`}>
        <h2>5. Consolidated PYQs</h2>
        {clusters.length === 0 ? (
          <p>No consolidated questions yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Canonical Question</th>
                  <th>Frequency</th>
                  <th>Years Asked</th>
                  <th>Marks</th>
                </tr>
              </thead>
              <tbody>
                {clusters.map((cluster) => (
                  <tr key={cluster.id}>
                    <td>{cluster.canonicalQuestion}</td>
                    <td>{cluster.frequency}</td>
                    <td>{cluster.yearsAsked.join(", ")}</td>
                    <td>{cluster.marksValues.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={`card-premium ${styles.sectionCard}`}>
        <h2>6. Generated Answers</h2>
        <div className={styles.controlsRow}>
          <label className={styles.srOnly} htmlFor="pyq-generation-mode">
            Generation mode
          </label>
          <select
            id="pyq-generation-mode"
            title="Select generation mode"
            value={generationMode}
            onChange={(event) => setGenerationMode(event.target.value as "all" | "top_repeated")}
            className={styles.selectControl}
          >
            <option value="all">Generate answers for all consolidated questions</option>
            <option value="top_repeated">Generate answers for top repeated questions</option>
          </select>
          <label className={styles.srOnly} htmlFor="pyq-top-limit">
            Top repeated limit
          </label>
          <input
            id="pyq-top-limit"
            type="number"
            min={1}
            max={100}
            title="Number of top repeated questions"
            placeholder="Top N"
            value={topLimit}
            onChange={(event) => setTopLimit(Number(event.target.value) || 10)}
            className={styles.numberControl}
          />
          <button className="btn-premium" disabled={!clusters.length || isLoading} onClick={generateAnswers}>
            {isLoading ? "Generating..." : "Generate Answers"}
          </button>
        </div>

        {analysis && (
          <div className={styles.topGap}>
            <h3>Optional Analytics</h3>
            <p>Top Topics: {analysis.mostImportantTopics.slice(0, 5).map((t) => `${t.topic} (${t.frequency})`).join(" | ") || "-"}</p>
          </div>
        )}

        <div className={styles.topGap}>
          {generatedAnswers.length === 0 ? (
            <p>No generated answers yet.</p>
          ) : (
            generatedAnswers.map((entry) => (
              <article key={entry.id} className={styles.answerCard}>
                <p><strong>Question:</strong> {entry.question}</p>
                <p><strong>Marks:</strong> {entry.marks}</p>
                <p><strong>Frequency:</strong> {entry.frequency} times</p>
                <p><strong>Asked in:</strong> {entry.yearsAsked.join(", ")}</p>
                <p><strong>Answer:</strong></p>
                <pre className={styles.preWrap}>{entry.answer}</pre>
                <p><strong>Figure:</strong></p>
                <pre className={styles.preWrap}>{entry.figure || "No figure required"}</pre>
                <p><strong>Table:</strong></p>
                <pre className={styles.preWrap}>{entry.table || "No table required"}</pre>
              </article>
            ))
          )}
        </div>
      </section>

      <section className={`card-premium ${styles.sectionCard}`}>
        <h2>7. Export Options</h2>
        <button className="btn-premium" disabled={!generatedAnswers.length || isLoading} onClick={exportBooklet}>
          {isLoading ? "Exporting..." : "Export Answer Booklet PDF"}
        </button>
      </section>
    </main>
  );
}
