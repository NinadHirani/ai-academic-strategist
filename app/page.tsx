"use client";

import React, { useState, useEffect, useCallback } from "react";
import Header from "./components/Header";
import ModeSwitcher from "./components/ModeSwitcher";
import ChatPanel from "./components/ChatPanel";
import FileUpload from "./components/FileUpload";

interface Document {
  id: string;
  name: string;
  type: string;
  status: "ready" | "processing" | "error";
  chunkCount?: number;
}

export default function Home() {
  const [activeMode, setActiveMode] = useState<"study" | "deepExplore">("study");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [showUpload, setShowUpload] = useState(false);

  // Auto-load existing documents on mount
  useEffect(() => {
    async function fetchExistingDocuments() {
      try {
        const response = await fetch("/api/documents");
        const data = await response.json();
        if (data.documents && data.documents.length > 0) {
          const existingDocs: Document[] = data.documents.map((doc: any) => ({
            id: doc.id,
            name: doc.name,
            type: doc.type || "application/pdf",
            status: doc.status || "ready",
            chunkCount: doc.chunkCount || 0,
          }));
          setDocuments(existingDocs);
        }
      } catch (error) {
        console.error("[Home] Error fetching existing documents:", error);
      }
    }
    fetchExistingDocuments();
  }, []);

  const handleDocumentsChange = useCallback((docs: Document[]) => {
    setDocuments(docs);
  }, []);

  const handleClearDocuments = useCallback(async () => {
    // Clear local state first
    setDocuments([]);

    // Attempt to delete all documents server-side to avoid long-term storage
    try {
      const resp = await fetch("/api/documents");
      const data = await resp.json();

      if (data?.documents?.length) {
        await Promise.all(
          data.documents.map((doc: any) =>
            fetch(`/api/documents?id=${encodeURIComponent(doc.id)}`, { method: "DELETE" })
          )
        );
      }
    } catch (error) {
      console.error("[Home] Error clearing documents:", error);
    }
  }, []);

  const handleRequestUpload = useCallback(() => {
    setShowUpload(true);
  }, []);

  return (
    <div className="app-container">
      <Header />
      
      <main className="main-content">
        <div className="hero-section">
          <h1 className="hero-title">AI Academic Strategist</h1>
          <p className="hero-subtitle">Study smarter. Explore deeper.</p>
        </div>

        <ModeSwitcher 
          activeMode={activeMode} 
          onModeChange={setActiveMode} 
        />

        <div className="document-section">
          <div className="section-header">
            <span className="section-title">
              📚 Study Materials {documents.filter(d => d.status === "ready").length > 0 && (
                <span className="doc-count-inline">({documents.filter(d => d.status === "ready").length} loaded)</span>
              )}
            </span>
            <button 
              className="toggle-upload-btn"
              onClick={() => setShowUpload(!showUpload)}
            >
              {showUpload ? "Hide" : "Upload Files"}
            </button>
          </div>
          
          {showUpload && (
            <FileUpload onDocumentsChange={handleDocumentsChange} />
          )}
        </div>

        <ChatPanel 
          activeMode={activeMode} 
          documents={documents}
          onRequestUpload={handleRequestUpload}
          onClearDocuments={handleClearDocuments}
        />
      </main>
    </div>
  );
}
