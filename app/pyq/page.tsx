"use client";

import { useEffect, useMemo, useState } from "react";

type TopicRow = { topic: string; frequency: number; trend?: string; years?: number[] };
type MarksRow = { marks: number; count: number; percentage?: number };
type Insights = Record<string, unknown>;

export default function PyqPage() {
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");

  const [insights, setInsights] = useState<Insights | null>(null);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [distribution, setDistribution] = useState<MarksRow[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploadJson, setUploadJson] = useState(
    JSON.stringify(
      [
        {
          subject: "Engineering Mathematics",
          unit: "Calculus",
          topic: "Partial Derivatives",
          year: 2024,
          marks: 10,
          question: "Explain partial derivatives with an example.",
        },
      ],
      null,
      2
    )
  );

  useEffect(() => {
    async function loadSubjects() {
      try {
        const response = await fetch("/api/pyq?action=subjects");
        const data = await response.json();
        const items: string[] = Array.isArray(data?.subjects) ? data.subjects : [];
        setSubjects(items);
        if (items.length > 0) {
          setSelectedSubject(items[0]);
        }
      } catch (e) {
        setError("Failed to load subjects");
      }
    }

    loadSubjects();
  }, []);

  const canAnalyze = useMemo(() => selectedSubject.trim().length > 0, [selectedSubject]);

  async function runAnalysis() {
    if (!canAnalyze) return;

    setIsLoading(true);
    setError(null);

    try {
      const [insightsRes, topicsRes, marksRes] = await Promise.all([
        fetch(`/api/pyq?action=insights&subject=${encodeURIComponent(selectedSubject)}`),
        fetch(`/api/pyq?action=analyze-topics&subject=${encodeURIComponent(selectedSubject)}`),
        fetch(`/api/pyq?action=marks-distribution&subject=${encodeURIComponent(selectedSubject)}`),
      ]);

      const [insightsData, topicsData, marksData] = await Promise.all([
        insightsRes.json(),
        topicsRes.json(),
        marksRes.json(),
      ]);

      setInsights((insightsData?.insights as Insights) || null);
      setTopics(Array.isArray(topicsData?.topics) ? topicsData.topics : []);
      setDistribution(Array.isArray(marksData?.distribution) ? marksData.distribution : []);
    } catch (e) {
      setError("Failed to analyze PYQs");
    } finally {
      setIsLoading(false);
    }
  }

  async function uploadPyqs() {
    setError(null);
    try {
      const questions = JSON.parse(uploadJson);
      const response = await fetch("/api/pyq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions }),
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      await runAnalysis();
    } catch {
      setError("Invalid upload payload. Provide a valid JSON array of questions.");
    }
  }

  return (
    <main className="main-content container-premium section-spacing">
      <div className="hero-section">
        <h1 className="hero-title">Past Papers Intelligence</h1>
        <p className="hero-subtitle">Analyze PYQ trends by subject, topic, and marks weightage.</p>
      </div>

      <section className="card-premium" style={{ padding: "1rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "end" }}>
          <div style={{ minWidth: 280, flex: 1 }}>
            <label style={{ display: "block", marginBottom: 6 }}>Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              style={{ width: "100%", padding: "0.6rem" }}
            >
              {subjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>

          <button className="btn-premium" onClick={runAnalysis} disabled={!canAnalyze || isLoading}>
            {isLoading ? "Analyzing..." : "Analyze"}
          </button>
        </div>
      </section>

      {error && (
        <section className="card-premium" style={{ padding: "1rem", marginBottom: "1rem", color: "#b91c1c" }}>
          {error}
        </section>
      )}

      <section className="card-premium" style={{ padding: "1rem", marginBottom: "1rem" }}>
        <h2 style={{ marginBottom: "0.75rem" }}>Subject Insights</h2>
        <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
          {insights ? JSON.stringify(insights, null, 2) : "Run analysis to view insights."}
        </pre>
      </section>

      <section className="card-premium" style={{ padding: "1rem", marginBottom: "1rem" }}>
        <h2 style={{ marginBottom: "0.75rem" }}>Topic Frequency</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Topic</th>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Frequency</th>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Years</th>
              </tr>
            </thead>
            <tbody>
              {topics.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: "0.5rem" }}>
                    No data yet.
                  </td>
                </tr>
              )}
              {topics.map((row, idx) => (
                <tr key={`${row.topic}-${idx}`}>
                  <td style={{ padding: "0.5rem" }}>{row.topic}</td>
                  <td style={{ padding: "0.5rem" }}>{row.frequency}</td>
                  <td style={{ padding: "0.5rem" }}>{Array.isArray(row.years) ? row.years.join(", ") : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card-premium" style={{ padding: "1rem", marginBottom: "1rem" }}>
        <h2 style={{ marginBottom: "0.75rem" }}>Marks Distribution</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Marks</th>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Count</th>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Percentage</th>
              </tr>
            </thead>
            <tbody>
              {distribution.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: "0.5rem" }}>
                    No data yet.
                  </td>
                </tr>
              )}
              {distribution.map((row, idx) => (
                <tr key={`${row.marks}-${idx}`}>
                  <td style={{ padding: "0.5rem" }}>{row.marks}</td>
                  <td style={{ padding: "0.5rem" }}>{row.count}</td>
                  <td style={{ padding: "0.5rem" }}>
                    {typeof row.percentage === "number" ? `${row.percentage.toFixed(1)}%` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card-premium" style={{ padding: "1rem" }}>
        <h2 style={{ marginBottom: "0.75rem" }}>Optional: Upload PYQs</h2>
        <textarea
          value={uploadJson}
          onChange={(e) => setUploadJson(e.target.value)}
          rows={12}
          style={{ width: "100%", padding: "0.75rem", marginBottom: "0.75rem", fontFamily: "monospace" }}
        />
        <button className="btn-premium" onClick={uploadPyqs}>Upload PYQ JSON</button>
      </section>
    </main>
  );
}
