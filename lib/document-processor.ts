/**
 * Document Processing Module
 * Handles extraction of text from various document formats
 * Supports: PDF, DOCX, TXT, MD, CSV
 */

// ============================================================================
// Types
// ============================================================================

export interface ProcessedDocument {
  id: string;
  name: string;
  type: string;
  content: string;
  size: number;
  extractedAt: Date;
  metadata: {
    pageCount?: number;
    author?: string;
    title?: string;
  };
}

export interface ExtractionResult {
  success: boolean;
  content?: string;
  error?: string;
  metadata?: ProcessedDocument["metadata"];
}

export type SupportedFileType = 
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "text/plain"
  | "text/markdown"
  | "text/csv"
  | "application/octet-stream";

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Safely decode URI component, returns raw string if fails
 */
function safeDecodeURI(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

// ============================================================================
// PDF Text Extraction
// ============================================================================

/**
 * Extract text from PDF using pdf2json
 */
async function extractPdfText(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const PdfParser = (await import("pdf2json")).default;
    const pdfParser = new PdfParser(null);

    return new Promise((resolve) => {
      pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
        let fullText = "";
        let pageCount = 0;

        if (pdfData?.Pages) {
          pageCount = pdfData.Pages.length;
          
          for (const page of pdfData.Pages) {
            if (page.Texts) {
              for (const textItem of page.Texts) {
                if (textItem.R && Array.isArray(textItem.R)) {
                  const decodedText = textItem.R
                    .map((r: any) => safeDecodeURI(r.T || ""))
                    .join(" ");
                  fullText += decodedText + " ";
                }
              }
              fullText += "\n";
            }
          }
        }

        resolve({
          success: true,
          content: fullText.trim(),
          metadata: { pageCount },
        });
      });

      pdfParser.on("pdfParser_error" as any, (error: Error) => {
        console.error("[DocumentProcessor] PDF extraction error:", error);
        resolve({
          success: false,
          error: `PDF extraction failed: ${error.message}`,
        });
      });

      pdfParser.parseBuffer(buffer);
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown PDF error";
    console.error("[DocumentProcessor] PDF error:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// ============================================================================
// DOCX Text Extraction
// ============================================================================

/**
 * Extract text from DOCX using mammoth
 */
async function extractDocxText(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const mammoth = await import("mammoth");
    
    const result = await mammoth.extractRawText({ buffer });
    
    if (result.value) {
      return {
        success: true,
        content: result.value.trim(),
        metadata: {},
      };
    }
    
    return {
      success: false,
      error: "No content found in DOCX",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown DOCX error";
    console.error("[DocumentProcessor] DOCX error:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// ============================================================================
// Plain Text Extraction
// ============================================================================

/**
 * Extract text from plain text files
 */
function extractPlainText(content: ArrayBuffer): ExtractionResult {
  try {
    const decoder = new TextDecoder("utf-8");
    const text = decoder.decode(content).trim();
    
    return {
      success: true,
      content: text,
      metadata: {},
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown text error";
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// ============================================================================
// Main Processing Function
// ============================================================================

/**
 * Check if file type is supported
 */
export function isSupportedFileType(fileType: string, fileName: string): boolean {
  const supportedTypes: string[] = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
    "text/csv",
  ];

  const supportedExtensions = [".pdf", ".docx", ".txt", ".md", ".csv"];
  
  const hasSupportedType = supportedTypes.includes(fileType.toLowerCase());
  const hasSupportedExtension = supportedExtensions.some(ext => 
    fileName.toLowerCase().endsWith(ext)
  );

  return hasSupportedType || hasSupportedExtension;
}

/**
 * Get file extension from filename
 */
export function getFileExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop()?.toLowerCase() || "" : "";
}

/**
 * Extract text from a document
 * @param content - ArrayBuffer of file content
 * @param fileType - MIME type of the file
 * @param fileName - Name of the file
 * @returns ExtractionResult with extracted text or error
 */
export async function extractDocumentText(
  content: ArrayBuffer,
  fileType: string,
  fileName: string
): Promise<ExtractionResult> {
  const extension = getFileExtension(fileName);
  const buffer = Buffer.from(content);

  console.log(`[DocumentProcessor] Processing: ${fileName} (${fileType || extension})`);

  // PDF files
  if (fileType === "application/pdf" || extension === "pdf") {
    return await extractPdfText(buffer);
  }

  // DOCX files
  if (
    fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    extension === "docx"
  ) {
    return await extractDocxText(buffer);
  }

  // Plain text and other text-based files
  if (
    fileType.startsWith("text/") ||
    ["txt", "md", "csv"].includes(extension)
  ) {
    return extractPlainText(content);
  }

  // Fallback: try as plain text
  console.warn(`[DocumentProcessor] Unknown file type: ${fileType}, trying as plain text`);
  return extractPlainText(content);
}

/**
 * Process a document for RAG
 * @param documentId - Unique identifier for the document
 * @param fileName - Name of the file
 * @param content - Raw file content as ArrayBuffer
 * @param fileType - MIME type
 * @returns ProcessedDocument or error
 */
export async function processDocumentFile(
  documentId: string,
  fileName: string,
  content: ArrayBuffer,
  fileType: string
): Promise<ProcessedDocument | { error: string }> {
  const extractionResult = await extractDocumentText(content, fileType, fileName);

  if (!extractionResult.success || !extractionResult.content) {
    return {
      error: extractionResult.error || "Failed to extract text from document",
    };
  }

  // Check if extracted content is meaningful
  if (extractionResult.content.length < 10) {
    return {
      error: "Document appears to be empty or contains no extractable text",
    };
  }

  return {
    id: documentId,
    name: fileName,
    type: fileType,
    content: extractionResult.content,
    size: content.byteLength,
    extractedAt: new Date(),
    metadata: extractionResult.metadata || {},
  };
}

/**
 * Validate file before processing
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  
  if (!file) {
    return { valid: false, error: "No file provided" };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File too large. Maximum size is 10MB. File is ${(file.size / 1024 / 1024).toFixed(2)}MB` };
  }

  if (!isSupportedFileType(file.type, file.name)) {
    return { 
      valid: false, 
      error: `Unsupported file type: ${file.type || getFileExtension(file.name)}. Supported: PDF, DOCX, TXT, MD, CSV` 
    };
  }

  return { valid: true };
}

