"use client";

import React, { useState, useEffect, useCallback } from "react";
import ModeSwitcher from "./components/ModeSwitcher";
import ChatPanel from "./components/ChatPanel";
import FileUpload from "./components/FileUpload";
import { QuizModule } from "./components/interactive/QuizModule";
import { FlashcardModule } from "./components/interactive/FlashcardModule";
import { deleteAllDocuments } from "@/lib/documents";
import type { ChatMode, UploadedDocument } from "@/lib/types";

export default function Home() {
  const [activeMode, setActiveMode] = useState<ChatMode>("study");
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [showUpload, setShowUpload] = useState(false);

  // Study Modal State
  const [activeStudyDocId, setActiveStudyDocId] = useState<string | null>(null);
  const [activeStudyType, setActiveStudyType] = useState<'quiz' | 'flashcards' | null>(null);
  const [studyData, setStudyData] = useState<any>(null);
  const [isGeneratingStudy, setIsGeneratingStudy] = useState(false);

  // Auto-load existing documents on mount
  useEffect(() => {
    async function fetchExistingDocuments() {
      try {
        const response = await fetch("/api/documents");
        const data = await response.json();
        if (data.documents && data.documents.length > 0) {
          const existingDocs: UploadedDocument[] = data.documents.map((doc: any) => ({
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

  const handleDocumentsChange = useCallback((docs: UploadedDocument[]) => {
    setDocuments(docs);
  }, []);

  const handleClearDocuments = useCallback(async () => {
    // Clear local state first
    setDocuments([]);

    try {
      await deleteAllDocuments();
    } catch (error) {
      console.error("[Home] Error clearing documents:", error);
    }
  }, []);

  const handleRequestUpload = useCallback(() => {
    setShowUpload(true);
  }, []);

  const handleGenerateStudyMaterial = useCallback(async (docId: string, type: 'quiz' | 'flashcards') => {
    setActiveStudyDocId(docId);
    setActiveStudyType(type);
    setIsGeneratingStudy(true);
    setStudyData(null);
    try {
      const res = await fetch('/api/study/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId, type })
      });
      const data = await res.json();
      if (type === 'quiz') setStudyData(data.quiz);
      if (type === 'flashcards') setStudyData(data.flashcards);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingStudy(false);
    }
  }, []);

  const closeStudyModal = () => {
    setActiveStudyDocId(null);
    setActiveStudyType(null);
    setStudyData(null);
  };

  return (
    <main className="main-content container-premium section-spacing">
      <div className="hero-section">
        <h1 className="hero-title">AI Academic Strategist</h1>
        <p className="hero-subtitle">Study smarter. Explore deeper.</p>
      </div>

      <ModeSwitcher
        activeMode={activeMode}
        onModeChange={setActiveMode}
      />

      <div className="quick-access-grid">
        <a href="/dashboard" className="feature-card card-premium">
          <span className="feature-card-icon">📈</span>
          <div className="feature-card-info">
            <h3>Academic Dashboard</h3>
            <p>Track your learning velocity and retention score.</p>
          </div>
        </a>          
        <a href="/career" className="feature-card card-premium">
          <span className="feature-card-icon">💼</span>
          <div className="feature-card-info">
            <h3>Career Simulator</h3>
            <p>Align coursework with industry roadmap and skills.</p>
          </div>
        </a>
        <a href="/copilot" className="feature-card card-premium">
          <span className="feature-card-icon">🎓</span>
          <div className="feature-card-info">
            <h3>Academic Copilot</h3>
            <p>Build study roadmaps for any university syllabus.</p>
          </div>
        </a>
      </div>

      <div className="document-section">
        <div className="section-header">
          <span className="section-title">
            📚 Study Materials {documents.filter(d => d.status === "ready").length > 0 && (
              <span className="doc-count-inline">({documents.filter(d => d.status === "ready").length} loaded)</span>
            )}
          </span>
          <button
            className="toggle-upload-btn btn-premium"
            style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
            onClick={() => setShowUpload(!showUpload)}
          >
            {showUpload ? "Hide" : "Upload Files"}
          </button>
        </div>

        {showUpload && (
          <FileUpload onDocumentsChange={handleDocumentsChange} onGenerateStudyMaterial={handleGenerateStudyMaterial} />
        )}
      </div>

      {activeStudyType && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl relative p-6 border">
            <button onClick={closeStudyModal} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">✕</button>

            {isGeneratingStudy ? (
              <div className="py-20 flex flex-col items-center justify-center">
                <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
                <p className="text-lg font-medium">Generating your {activeStudyType}...</p>
                <p className="text-sm text-muted-foreground text-center mt-2 max-w-md">
                  Our AI is reading through the document and finding the best material to test your knowledge.
                </p>
              </div>
            ) : studyData ? (
              <>
                <div className="mb-4">
                  <h2 className="text-2xl font-bold capitalize">{activeStudyType} Session</h2>
                  <p className="text-sm text-muted-foreground">Test your knowledge on the document material.</p>
                </div>
                {activeStudyType === 'quiz' && <QuizModule quizData={studyData} onClose={closeStudyModal} />}
                {activeStudyType === 'flashcards' && <FlashcardModule flashcards={studyData} onClose={closeStudyModal} />}
              </>
            ) : (
              <div className="py-20 text-center">
                <p className="text-red-500 mb-4">Failed to generate {activeStudyType}. Please try again.</p>
                <button onClick={closeStudyModal} className="btn-premium">Close</button>
              </div>
            )}
          </div>
        </div>
      )}

      <ChatPanel
        activeMode={activeMode}
        documents={documents}
        onRequestUpload={handleRequestUpload}
        onClearDocuments={handleClearDocuments}
      />
    </main>
  );
}
