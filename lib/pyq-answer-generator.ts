import { groqKeyManager } from "@/lib/groq-key-manager";
import { ConsolidatedPYQGroup } from "@/lib/pyq-normalizer";
import { getAnswerLengthGuidance } from "@/lib/pyq-answer-policy";

export interface GeneratedPYQAnswer {
  question: string;
  marks: number;
  targetPages: number;
  askedCount: number;
  askedYears: number[];
  answer: string;
  figureHint: string | null;
  tableHint: string | null;
  sourceGrounded: boolean;
}

function detectFigureHint(question: string): string | null {
  const q = question.toLowerCase();
  if (/diagram|draw|sketch|graph|flowchart|circuit/.test(q)) {
    return "Include a labeled figure/diagram to support the explanation.";
  }
  return null;
}

function detectTableHint(question: string): string | null {
  const q = question.toLowerCase();
  if (/tabular|table|compare|difference between|classification/.test(q)) {
    return "Use a concise comparison table where suitable.";
  }
  return null;
}

export async function generateAnswerForGroup(group: ConsolidatedPYQGroup): Promise<GeneratedPYQAnswer> {
  const guidance = getAnswerLengthGuidance(group.marks);
  const figureHint = detectFigureHint(group.canonicalQuestion);
  const tableHint = detectTableHint(group.canonicalQuestion);

  const sources = group.occurrences
    .slice(0, 8)
    .map((occ, index) => `${index + 1}. [${occ.year}] ${occ.questionText}`)
    .join("\n");

  const systemPrompt = [
    "You are an academic exam answer writer.",
    "Generate an answer STRICTLY from the provided past-paper question evidence.",
    "Do not introduce external facts or references that are not inferable from the evidence.",
    "Output plain text only.",
  ].join(" ");

  const userPrompt = [
    `Canonical question: ${group.canonicalQuestion}`,
    `Marks: ${group.marks}`,
    `Target pages: ${guidance.targetPages} (max ${guidance.maxPages})`,
    `Target words: ${guidance.targetWordRange.min}-${guidance.targetWordRange.max}`,
    `Asked in years: ${group.askedYears.join(", ")} (${group.askedCount} times)`,
    figureHint ? `Figure requirement: ${figureHint}` : "Figure requirement: none",
    tableHint ? `Table requirement: ${tableHint}` : "Table requirement: none",
    "Evidence from uploaded papers:",
    sources,
    "Return a complete final answer suitable for exam writing.",
  ].join("\n\n");

  const apiKey = groqKeyManager.getCurrentKey();
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      groqKeyManager.rotateKey();
    }
    const text = await response.text();
    throw new Error(`Answer generation failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  const answer = data?.choices?.[0]?.message?.content?.trim();

  if (!answer) {
    throw new Error("Empty answer generated");
  }

  return {
    question: group.canonicalQuestion,
    marks: group.marks,
    targetPages: guidance.targetPages,
    askedCount: group.askedCount,
    askedYears: group.askedYears,
    answer,
    figureHint,
    tableHint,
    sourceGrounded: true,
  };
}
