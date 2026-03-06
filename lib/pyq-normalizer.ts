import { PYQ } from "@/lib/pyq-store";

export interface PYQOccurrence {
  id: string;
  year: number;
  marks: number;
  unit: string;
  topic: string;
  questionText: string;
}

export interface ConsolidatedPYQGroup {
  canonicalQuestion: string;
  normalizedQuestion: string;
  askedCount: number;
  firstAskedYear: number;
  lastAskedYear: number;
  askedYears: number[];
  marks: number;
  subject: string;
  unit: string;
  topic: string;
  matchType: "exact" | "semantic";
  frequencyLabel: string;
  occurrences: PYQOccurrence[];
}

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "of", "to", "for", "with", "in", "on", "by", "from", "is", "are", "be", "explain", "write", "what", "how"
]);

export function normalizeQuestionText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^q\.?\s*\d+[:.)-]?\s*/i, "")
    .replace(/^\d+[:.)-]\s*/i, "")
    .replace(/\(\s*\d+\s*marks?\s*\)/gi, "")
    .replace(/\[\s*\d+\s*\]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getQuestionFingerprint(normalizedText: string): string {
  const words = normalizedText.split(" ").filter(Boolean);
  const filtered = words.filter((word) => !STOP_WORDS.has(word));
  return filtered.join(" ");
}

function toTokenSet(text: string): Set<string> {
  return new Set(
    getQuestionFingerprint(normalizeQuestionText(text))
      .split(" ")
      .filter((word) => word.length > 2)
  );
}

export function semanticSimilarity(a: string, b: string): number {
  const setA = toTokenSet(a);
  const setB = toTokenSet(b);

  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function getFrequencyLabel(askedCount: number): string {
  if (askedCount >= 5) return "Very Frequent";
  if (askedCount >= 3) return "Frequent";
  if (askedCount === 2) return "Repeated";
  return "Single";
}

export function consolidatePYQs(
  questions: PYQ[],
  semanticThreshold = 0.72
): ConsolidatedPYQGroup[] {
  const exactBuckets = new Map<string, PYQ[]>();

  for (const question of questions) {
    const normalized = normalizeQuestionText(question.questionText);
    const fingerprint = getQuestionFingerprint(normalized);
    if (!exactBuckets.has(fingerprint)) {
      exactBuckets.set(fingerprint, []);
    }
    exactBuckets.get(fingerprint)!.push(question);
  }

  const initialGroups: ConsolidatedPYQGroup[] = Array.from(exactBuckets.values()).map((items) => {
    const sortedByYear = [...items].sort((a, b) => a.year - b.year);
    const askedYears = Array.from(new Set(sortedByYear.map((q) => q.year))).sort((a, b) => a - b);
    const representative = sortedByYear[0];

    return {
      canonicalQuestion: representative.questionText,
      normalizedQuestion: normalizeQuestionText(representative.questionText),
      askedCount: items.length,
      firstAskedYear: askedYears[0],
      lastAskedYear: askedYears[askedYears.length - 1],
      askedYears,
      marks: Math.max(...items.map((q) => q.marks)),
      subject: representative.subject,
      unit: representative.unit,
      topic: representative.topic,
      matchType: "exact",
      frequencyLabel: getFrequencyLabel(items.length),
      occurrences: items.map((q) => ({
        id: q.id,
        year: q.year,
        marks: q.marks,
        unit: q.unit,
        topic: q.topic,
        questionText: q.questionText,
      })),
    };
  });

  const merged: ConsolidatedPYQGroup[] = [];

  for (const group of initialGroups) {
    const matchIndex = merged.findIndex((existing) => {
      if (existing.subject.toLowerCase() !== group.subject.toLowerCase()) return false;
      const score = semanticSimilarity(existing.canonicalQuestion, group.canonicalQuestion);
      return score >= semanticThreshold;
    });

    if (matchIndex === -1) {
      merged.push(group);
      continue;
    }

    const current = merged[matchIndex];
    const mergedOccurrences = [...current.occurrences, ...group.occurrences];
    const askedYears = Array.from(new Set(mergedOccurrences.map((o) => o.year))).sort((a, b) => a - b);

    merged[matchIndex] = {
      ...current,
      askedCount: mergedOccurrences.length,
      firstAskedYear: askedYears[0],
      lastAskedYear: askedYears[askedYears.length - 1],
      askedYears,
      marks: Math.max(current.marks, group.marks),
      matchType: current.matchType === "exact" && group.matchType === "exact" ? "exact" : "semantic",
      frequencyLabel: getFrequencyLabel(mergedOccurrences.length),
      occurrences: mergedOccurrences,
    };
  }

  return merged.sort((a, b) => {
    if (b.askedCount !== a.askedCount) return b.askedCount - a.askedCount;
    return b.lastAskedYear - a.lastAskedYear;
  });
}
