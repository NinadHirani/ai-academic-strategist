"use client";

import React, { useState, useRef } from "react";

interface Document {
  id: string;
  name: string;
  type: string;
  status: "ready" | "processing" | "error";
  chunkCount?: number;
}

interface FileUploadProps {
  onDocumentsChange?: (documents: Document[]) => void;
}

export default function FileUpload({ onDocumentsChange }: FileUploadProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setError(null);
    setIsUploading(true);

    for (const file of Array.from(files)) {
      // Validate file type
      const allowedTypes = [
        "application/pdf",
        "text/plain",
        "text/markdown",
        "text/csv",
      ];
      
      if (!allowedTypes.includes(file.type)) {
        setError(`Invalid file type: ${file.name}. Allowed: PDF, TXT, MD, CSV`);
        continue;
      }

      // Add to documents as processing
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newDoc: Document = {
        id: tempId,
        name: file.name,
        type: file.type,
        status: "processing",
      };

      setDocuments((prev) => [...prev, newDoc]);

      try {
        // Upload the file
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to upload file");
        }

        // Update document with the result
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === tempId
              ? {
                  ...doc,
                  id: data.document.id,
                  status: "ready" as const,
                  chunkCount: data.document.chunkCount,
                }
              : doc
          )
        );
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Upload failed";
        setError(errorMessage);
        
        // Mark document as error
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === tempId ? { ...doc, status: "error" as const } : doc
          )
        );
      }
    }

    setIsUploading(false);
    // Notify parent of document changes - use callback to get updated state
    setDocuments((prevDocs) => {
      onDocumentsChange?.(prevDocs);
      return prevDocs;
    });
  };

  const handleDelete = async (docId: string) => {
    try {
      const response = await fetch(`/api/documents?id=${docId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete document");
      }

      setDocuments((prev) => {
        const filtered = prev.filter((doc) => doc.id !== docId);
        onDocumentsChange?.(filtered);
        return filtered;
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Delete failed";
      setError(errorMessage);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    // Reset input value to allow re-uploading same file
    e.target.value = "";
  };

  return (
    <div className="file-upload-container">
      {/* Upload Area */}
      <div
        className={`upload-area ${isDragging ? "dragging" : ""} ${isUploading ? "uploading" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.md,.csv"
          onChange={handleInputChange}
          className="file-input"
          disabled={isUploading}
        />
        
        <div className="upload-icon">
          {isUploading ? (
            <span className="loading-spinner"></span>
          ) : (
            "📄"
          )}
        </div>
        
        <div className="upload-text">
          {isUploading ? (
            "Uploading..."
          ) : (
            <>
              <span className="upload-primary">Click to upload</span>
              <span className="upload-secondary">or drag and drop</span>
            </>
          )}
        </div>
        
        <div className="upload-hint">
          PDF, TXT, MD, CSV (max 10MB)
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="upload-error">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="error-dismiss">
            ✕
          </button>
        </div>
      )}

      {/* Document List */}
      {documents.length > 0 && (
        <div className="document-list">
          <div className="document-list-header">
            <span className="document-count">
              {documents.filter(d => d.status === "ready").length} document(s) uploaded
            </span>
          </div>
          
          <div className="document-items">
            {documents.map((doc) => (
              <div key={doc.id} className={`document-item ${doc.status}`}>
                <div className="document-icon">
                  {doc.status === "processing" ? (
                    <span className="loading-spinner small"></span>
                  ) : doc.status === "error" ? (
                    "❌"
                  ) : (
                    "📄"
                  )}
                </div>
                
                <div className="document-info">
                  <span className="document-name">{doc.name}</span>
                  <span className="document-meta">
                    {doc.status === "ready" && doc.chunkCount
                      ? `${doc.chunkCount} chunks`
                      : doc.status === "processing"
                      ? "Processing..."
                      : "Error"}
                  </span>
                </div>
                
                {doc.status !== "processing" && (
                  <button
                    className="document-delete"
                    onClick={() => handleDelete(doc.id)}
                    title="Delete document"
                  >
                    🗑️
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

