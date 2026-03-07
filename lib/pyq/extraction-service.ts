import { randomUUID } from "crypto";
import { processDocumentFile } from "@/lib/document-processor";
import { ocrImageWithGroq } from "@/lib/pyq/ocr-service";
import { ExtractedQuestion, UploadedPaper } from "@/lib/pyq/types";

function parseMarks(text: string): number {
  const patterns = [
    /\((\d{1,2})\s*marks?\)/i,
    /[-–—:]\s*(\d{1,2})\s*[mM]\b/,
    /(\d{1,2})\s*marks?\b/i,
    /\[(\d{1,2})\]/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = Number(match[1]);
      if (value >= 1 && value <= 20) {
        return value;
      }
    }
  }

  return 5;
}

function parseQuestionNumber(text: string): string | undefined {
  const match = text.match(/^(?:q(?:uestion)?\s*)?(\d+[a-z]?\(?[a-z]?\)?)/i);
  return match ? match[1] : undefined;
}

function detectQuestionStart(line: string): boolean {
  return /^(?:q(?:uestion)?\s*\d+|\d+[.)]|q\d+[a-z]?\)|q\d+[a-z]?\.)/i.test(line.trim());
}

function normalizeQuestionText(text: string): string {
  return text
    .replace(/^q(?:uestion)?\s*\d+[a-z]?[:.)\-]?/i, "")
    .replace(/^\d+[a-z]?[.)\-]?\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function inferPaperYear(paper: UploadedPaper, text: string): number {
  if (paper.yearHint) {
    return paper.yearHint;
  }

  const fromText = text.match(/(20\d{2})/);
  return fromText ? Number(fromText[1]) : new Date().getFullYear();
}

function inferSeasonLabel(paper: UploadedPaper, text: string, year: number): string {
  const season = paper.seasonHint || text.match(/(winter|summer|spring|autumn|fall)/i)?.[1];
  if (season) {
    const normalized = season[0].toUpperCase() + season.slice(1).toLowerCase();
    return `${normalized} ${year}`;
  }
  return String(year);
}

async function extractRawText(paper: UploadedPaper): Promise<string> {
  const buffer = Buffer.from(paper.base64, "base64");
  const isImage = paper.mimeType.startsWith("image/");

  if (isImage) {
    return ocrImageWithGroq(paper.base64, paper.mimeType);
  }

  const processed = await processDocumentFile(randomUUID(), paper.fileName, buffer, paper.mimeType);
  if ("error" in processed) {
    throw new Error(processed.error);
  }

  const extracted = processed.content?.trim() || "";

  // OCR fallback for extremely sparse content.
  if (extracted.length < 120 && paper.mimeType.includes("pdf")) {
    throw new Error(
      "Scanned PDF appears image-based. Upload clear images or configure OCR PDF pipeline provider."
    );
  }

  return extracted;
}

export async function extractQuestionsFromPaper(paper: UploadedPaper): Promise<ExtractedQuestion[]> {
  const rawText = await extractRawText(paper);
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks: string[] = [];
  let current = "";

  for (const line of lines) {
    if (detectQuestionStart(line)) {
      if (current.trim()) {
        blocks.push(current.trim());
      }
      current = line;
    } else if (current) {
      current += ` ${line}`;
    }
  }

  if (current.trim()) {
    blocks.push(current.trim());
  }

  // Fallback segmentation for messy formatting.
  if (!blocks.length) {
    const fallback = rawText
      .split(/\n\s*\n|\?\s+/)
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.length > 20);
    blocks.push(...fallback);
  }

  const year = inferPaperYear(paper, rawText);
  const seasonLabel = inferSeasonLabel(paper, rawText, year);

  return blocks
    .map((block) => {
      const cleanText = normalizeQuestionText(block);
      if (cleanText.length < 12) {
        return null;
      }

      return {
        id: randomUUID(),
        paperId: paper.id,
        subject: paper.subject,
        paperYear: year,
        paperSeason: seasonLabel,
        questionNumber: parseQuestionNumber(block),
        questionText: cleanText,
        marks: parseMarks(block),
        rawLine: block,
      } as ExtractedQuestion;
    })
    .filter((q): q is ExtractedQuestion => Boolean(q));
}

export async function extractQuestionsFromPapers(papers: UploadedPaper[]): Promise<ExtractedQuestion[]> {
  const output: ExtractedQuestion[] = [];
  for (const paper of papers) {
    const questions = await extractQuestionsFromPaper(paper);
    output.push(...questions);
  }
  return output;
}
