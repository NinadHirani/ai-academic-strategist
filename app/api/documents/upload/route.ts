import { NextRequest, NextResponse } from "next/server";
import { processDocument } from "@/lib/rag";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

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

/**
 * Fast PDF text extraction using pdf2json
 */
async function extractPdfText(content: Buffer): Promise<string> {
  try {
    const PdfParser = (await import("pdf2json")).default;
    const pdfParser = new PdfParser(null);
    
    return new Promise((resolve, reject) => {
      pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
        let fullText = "";
        
        if (pdfData?.Pages) {
          for (const page of pdfData.Pages) {
            if (page.Texts) {
              for (const textItem of page.Texts) {
                if (textItem.R) {
                  // Safely decode each text item
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
        resolve(fullText);
      });
      
      pdfParser.on("pdfParser_error" as any, (error: Error) => {
        console.error("[Upload] PDF error:", error);
        reject(error);
      });
      
      pdfParser.parseBuffer(content);
    });
  } catch (error) {
    console.error("[Upload] PDF extraction error:", error);
    return "";
  }
}

/**
 * Extract text from file
 */
async function extractText(content: ArrayBuffer, fileType: string, fileName: string): Promise<string> {
  // Plain text files - fastest
  if (fileType === "text/plain" || fileType === "text/markdown" || fileType === "text/csv") {
    return new TextDecoder("utf-8").decode(content);
  }
  
  // PDF files
  if (fileType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) {
    return await extractPdfText(Buffer.from(content));
  }
  
  // Fallback
  return new TextDecoder("utf-8").decode(content);
}

/**
 * Get API key and base URL - use local Ollama embeddings (free, no API key needed)
 */
function getApiKey(): { apiKey: string | undefined; baseUrl: string; model: string } {
  // Use local Ollama - no API key needed
  return {
    apiKey: undefined,
    baseUrl: 'http://localhost:11434',
    model: 'nomic-embed-text'
  };
}


    
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }

    const fileType = file.type || "application/octet-stream";
    const fileName = file.name;

    console.log("[Upload] Processing:", fileName, "size:", file.size);

    // Read and extract text
    const arrayBuffer = await file.arrayBuffer();
    const text = await extractText(arrayBuffer, fileType, fileName);

    console.log("[Upload] Extracted:", text.length, "chars");

    if (!text || text.trim().length === 0) {
      const documentId = `doc-${Date.now()}`;
      return NextResponse.json({
        success: true,
        document: { id: documentId, name: fileName, type: fileType, status: "ready", chunkCount: 0 },
        warning: "No text extracted from PDF"
      });
    }

    // Get API config
    const { apiKey, baseUrl, model } = getApiKey();

    // Process document
    const documentId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const result = await processDocument(documentId, fileName, text, apiKey || "", { baseUrl, model });

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to process" }, { status: 500 });
    }

    console.log("[Upload] Done! Chunks:", result.chunkCount);

    return NextResponse.json({
      success: true,
      document: { id: documentId, name: fileName, type: fileType, status: "ready", chunkCount: result.chunkCount },
    });
  } catch (error) {
    console.error("[Upload] Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
