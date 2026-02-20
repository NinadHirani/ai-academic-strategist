"use client";

import React, { useState } from "react";
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

  const handleDocumentsChange = (docs: Document[]) => {
    setDocuments(docs);
  };

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

        {/* Document Upload Section */}
        <div className="document-section">
          <div className="section-header">
            <h3 className="section-title">📚 Upload Study Materials</h3>
            <button 
              className="toggle-upload-btn"
              onClick={() => setShowUpload(!showUpload)}
            >
              {showUpload ? "Hide" : "Show"}
            </button>
          </div>
          
          {showUpload && (
            <FileUpload onDocumentsChange={handleDocumentsChange} />
          )}
        </div>

        <ChatPanel 
          activeMode={activeMode} 
          documents={documents}
        />
      </main>
    </div>
  );
}

