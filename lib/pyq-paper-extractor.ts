import { QuestionType } from "@/lib/pyq-store";

export interface ExtractedQuestionDraft {
  subject: string;
  unit: string;
  topic: string;
  questionText: string;
  questionType: QuestionType;
  marks: number;
  year: number;
  semester?: number;
  university?: string;
}

function inferMarks(text: string): number {
  const bracketMatch = text.match(/\((\d{1,2})\s*marks?\)/i);
  if (bracketMatch) return Number(bracketMatch[1]);

  const inlineMatch = text.match(/(\d{1,2})\s*marks?/i);
  if (inlineMatch) return Number(inlineMatch[1]);

  const squareMatch = text.match(/\[(\d{1,2})\]/);
  if (squareMatch) return Number(squareMatch[1]);

  return 5;
}

function inferType(marks: number): QuestionType {
  if (marks <= 2) return "very_short";
  if (marks <= 5) return "short_answer";
  if (marks <= 8) return "theory";
  return "long_answer";
}

function inferYear(fileName: string, fallbackYear?: number): number {
  const match = fileName.match(/(20\d{2})/);
  if (match) return Number(match[1]);
  return fallbackYear || new Date().getFullYear();
}

function cleanQuestionLine(text: string): string {
  return text
    .replace(/^q\.?\s*\d+[:.)-]?\s*/i, "")
    .replace(/^\d+[:.)-]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isQuestionStart(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return /^(q\.?\s*\d+|\d+[.)]|question\s*\d+)/i.test(trimmed);
}

export function extractQuestionsFromPaperText(input: {
  fileName: string;
  subject: string;
  content: string;
  defaultUnit?: string;
  defaultTopic?: string;
  fallbackYear?: number;
  semester?: number;
  university?: string;
}): ExtractedQuestionDraft[] {
  const lines = input.content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks: string[] = [];
  let current = "";

  for (const line of lines) {
    if (isQuestionStart(line)) {
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

  const year = inferYear(input.fileName, input.fallbackYear);

  return blocks
    .map((block) => {
      const questionText = cleanQuestionLine(block);
      const marks = inferMarks(block);
      if (questionText.length < 12) return null;

      return {
        subject: input.subject,
        unit: input.defaultUnit || "General",
        topic: input.defaultTopic || "General",
        questionText,
        questionType: inferType(marks),
        marks,
        year,
        semester: input.semester,
        university: input.university || "GTU",
      } as ExtractedQuestionDraft;
    })
    .filter((item): item is ExtractedQuestionDraft => item !== null);
}
