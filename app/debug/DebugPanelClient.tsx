"use client";

import { useEffect, useState } from "react";

type JsonObj = Record<string, unknown>;

export default function DebugPanelClient() {
  const [pipeline, setPipeline] = useState<JsonObj | null>(null);
  const [documents, setDocuments] = useState<JsonObj | null>(null);
  const [vector, setVector] = useState<JsonObj | null>(null);
  const [loading, setLoading] = useState(false);

  async function refreshAll() {
    setLoading(true);
    try {
      const [pipelineRes, docsRes, vectorRes] = await Promise.all([
        fetch("/api/debug/pipeline?full=true"),
        fetch("/api/debug/documents"),
        fetch("/api/debug/vector-store"),
      ]);

      const [pipelineData, docsData, vectorData] = await Promise.all([
        pipelineRes.json(),
        docsRes.json(),
        vectorRes.json(),
      ]);

      setPipeline(pipelineData);
      setDocuments(docsData);
      setVector(vectorData);
    } finally {
      setLoading(false);
    }
  }

  async function clearLogs() {
    await fetch("/api/debug/vector-store", { method: "DELETE" });
    await refreshAll();
  }

  useEffect(() => {
    refreshAll();
  }, []);

  return (
    <main className="main-content container-premium section-spacing">
      <div className="hero-section">
        <h1 className="hero-title">Debug Panel</h1>
        <p className="hero-subtitle">Development diagnostics for pipeline, documents, and vector store.</p>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <button className="btn-premium" onClick={refreshAll} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <details open className="card-premium" style={{ padding: "1rem", marginBottom: "1rem" }}>
        <summary style={{ cursor: "pointer", fontWeight: 700, marginBottom: "0.75rem" }}>Pipeline Health</summary>
        <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(pipeline, null, 2)}</pre>
      </details>

      <details className="card-premium" style={{ padding: "1rem", marginBottom: "1rem" }}>
        <summary style={{ cursor: "pointer", fontWeight: 700, marginBottom: "0.75rem" }}>Documents & Chunks</summary>
        <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(documents, null, 2)}</pre>
      </details>

      <details className="card-premium" style={{ padding: "1rem" }}>
        <summary style={{ cursor: "pointer", fontWeight: 700, marginBottom: "0.75rem" }}>Vector Store</summary>
        <div style={{ marginBottom: "0.75rem" }}>
          <button className="btn-premium" onClick={clearLogs}>Clear Logs</button>
        </div>
        <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(vector, null, 2)}</pre>
      </details>
    </main>
  );
}
