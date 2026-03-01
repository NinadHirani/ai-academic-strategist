"use client";

import React, { useState, useRef, useCallback } from "react";

interface Document {
  id: string;
  name: string;
  type: string;
  status: "ready" | "processing" | "error";
  chunkCount?: number;
  size?: number;
  error?: string;
  progress?: number;
}

interface FileUploadProps {
  onDocumentsChange?: (documents: Document[]) => void;
}

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/csv",
];

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".csv"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function FileUpload({ onDocumentsChange }: FileUploadProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File too large: ${file.name}. Maximum size is 10MB.`;
    }

    const extension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    const isAllowedType = ALLOWED_TYPES.includes(file.type);
    const isAllowedExtension = ALLOWED_EXTENSIONS.includes(extension);

    if (!isAllowedType && !isAllowedExtension) {
      return `Unsupported file type: ${file.name}. Allowed: PDF, DOCX, TXT, MD, CSV`;
    }

    return null;
  }, []);

  // Upload a single file with progress tracking
  const uploadSingleFile = async (file: File, tempId: string): Promise<Document> => {
    // Create initial document entry
    const newDoc: Document = {
      id: tempId,
      name: file.name,
      type: file.type || "application/octet-stream",
      status: "processing",
      size: file.size,
      progress: 0,
    };

    // Update progress to indicate upload started
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === tempId ? { ...doc, progress: 10 } : doc
      )
    );

    try {
      // Create FormData
      const formData = new FormData();
      formData.append("file", file);

      // Upload the file
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Upload failed: ${response.statusText}`);
      }

      // Update document with the result
      const updatedDoc: Document = {
        id: data.document?.id || tempId,
        name: file.name,
        type: file.type || "application/octet-stream",
        status: "ready",
        chunkCount: data.document?.chunkCount || 0,
        size: file.size,
        progress: 100,
      };

      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === tempId ? updatedDoc : doc
        )
      );

      return updatedDoc;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Upload failed";
      console.error("[FileUpload] Error:", errorMessage);

      const errorDoc: Document = {
        id: tempId,
        name: file.name,
        type: file.type || "application/octet-stream",
        status: "error",
        error: errorMessage,
        size: file.size,
      };

      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === tempId ? errorDoc : doc
        )
      );

      throw err;
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setError(null);
    setIsUploading(true);

    const fileArray = Array.from(files);

    // Validate all files first
    const validFiles: { file: File; tempId: string }[] = [];
    for (const file of fileArray) {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        continue;
      }

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      validFiles.push({ file, tempId });

      // Add initial document entry
      const newDoc: Document = {
        id: tempId,
        name: file.name,
        type: file.type || "application/octet-stream",
        status: "processing",
        size: file.size,
        progress: 0,
      };
      setDocuments((prev) => [...prev, newDoc]);
    }

    if (validFiles.length === 0) {
      setIsUploading(false);
      return;
    }

    // Upload files in parallel using Promise.all
    try {
      await Promise.all(
        validFiles.map(({ file, tempId }) =>
          uploadSingleFile(file, tempId).catch((err) => {
            console.error(`Failed to upload ${file.name}:`, err);
          })
        )
      );
    } catch (err) {
      console.error("[FileUpload] Parallel upload error:", err);
    }

    setIsUploading(false);

    // Notify parent of document changes
    setDocuments((prevDocs) => {
      onDocumentsChange?.(prevDocs);
      return prevDocs;
    });
  };

  const handleDelete = async (docId: string) => {
    // Skip delete for temp documents
    if (docId.startsWith("temp-")) {
      setDocuments((prev) => {
        const filtered = prev.filter((doc) => doc.id !== docId);
        onDocumentsChange?.(filtered);
        return filtered;
      });
      return;
    }

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
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
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

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const readyDocuments = documents.filter((d) => d.status === "ready");

  return (
    <div className="file-upload-container">
      {/* Upload Area */}
      <div
        className={`upload-area ${isDragging ? "dragging" : ""} ${
          isUploading ? "uploading" : ""
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.md,.csv"
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
            "Processing..."
          ) : (
            <>
              <span className="upload-primary">Click to upload</span>
              <span className="upload-secondary">or drag and drop</span>
            </>
          )}
        </div>

        <div className="upload-hint">
          PDF, DOCX, TXT, MD, CSV (max 10MB)
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
              {readyDocuments.length} document(s) ready for Q&A
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
                  ) : doc.type.includes("pdf") ? (
                    "📕"
                  ) : doc.type.includes("docx") || doc.name.endsWith(".docx") ? (
                    "📘"
                  ) : (
                    "📄"
                  )}
                </div>

                <div className="document-info">
                  <span className="document-name">{doc.name}</span>
                  <span className="document-meta">
                    {doc.status === "ready" && doc.chunkCount !== undefined
                      ? `${doc.chunkCount} chunks`
                      : doc.status === "processing"
                      ? "Processing document..."
                      : doc.error || "Error"}
                    {doc.size && ` • ${formatFileSize(doc.size)}`}
                  </span>
                  {/* Progress bar for processing documents */}
                  {doc.status === "processing" && doc.progress !== undefined && (
                    <div className="document-progress">
                      <div 
                        className="document-progress-bar" 
                        style={{ width: `${doc.progress}%` }}
                      />
                    </div>
                  )}
                </div>

                {doc.status !== "processing" && (
                  <button
                    className="document-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(doc.id);
                    }}
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

