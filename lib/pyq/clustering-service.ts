import { randomUUID } from "crypto";
import { ExtractedQuestion, QuestionCluster } from "@/lib/pyq/types";

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "is",
  "are",
  "what",
  "how",
  "with",
  "for",
  "to",
  "of",
  "and",
  "in",
  "explain",
  "describe",
]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(" ")
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) {
    return 0;
  }

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersection += 1;
    }
  }

  const union = a.size + b.size - intersection;
  return union ? intersection / union : 0;
}

function uniqueSorted(values: number[]): number[] {
  return Array.from(new Set(values)).sort((x, y) => x - y);
}

function uniqueSortedLabels(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

export function clusterQuestions(
  questions: ExtractedQuestion[],
  threshold = 0.68
): QuestionCluster[] {
  const clusters: Array<{
    cluster: QuestionCluster;
    centroidTokens: Set<string>;
  }> = [];

  for (const question of questions) {
    const qTokens = tokenSet(question.questionText);
    let bestIndex = -1;
    let bestScore = 0;

    for (let i = 0; i < clusters.length; i += 1) {
      const score = jaccard(qTokens, clusters[i].centroidTokens);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    if (bestIndex >= 0 && bestScore >= threshold) {
      const target = clusters[bestIndex].cluster;
      target.frequency += 1;
      target.questionIds.push(question.id);
      target.marksValues = uniqueSorted([...target.marksValues, question.marks]);
      target.averageMarks =
        target.marksValues.reduce((sum, value) => sum + value, 0) / target.marksValues.length;
      target.yearsAsked = uniqueSortedLabels([
        ...target.yearsAsked,
        question.paperSeason || String(question.paperYear),
      ]);
      if (!target.sampleVariants.includes(question.questionText) && target.sampleVariants.length < 5) {
        target.sampleVariants.push(question.questionText);
      }

      const mergedTokens = new Set<string>(clusters[bestIndex].centroidTokens);
      for (const token of qTokens) {
        mergedTokens.add(token);
      }
      clusters[bestIndex].centroidTokens = mergedTokens;
      continue;
    }

    clusters.push({
      centroidTokens: qTokens,
      cluster: {
        id: randomUUID(),
        subject: question.subject,
        canonicalQuestion: question.questionText,
        normalizedQuestion: normalize(question.questionText),
        frequency: 1,
        yearsAsked: [question.paperSeason || String(question.paperYear)],
        marksValues: [question.marks],
        averageMarks: question.marks,
        questionIds: [question.id],
        sampleVariants: [question.questionText],
      },
    });
  }

  return clusters
    .map((item) => item.cluster)
    .sort((a, b) => {
      if (b.frequency !== a.frequency) {
        return b.frequency - a.frequency;
      }
      return b.averageMarks - a.averageMarks;
    });
}
