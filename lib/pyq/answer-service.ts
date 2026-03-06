import { randomUUID } from "crypto";
import { groqKeyManager } from "@/lib/groq-key-manager";
import { getPolicyForMarks } from "@/lib/pyq/answer-policy";
import { GeneratedAnswer, QuestionCluster } from "@/lib/pyq/types";

function needsFigure(question: string): boolean {
  return /diagram|draw|flow|architecture|block|circuit|graph|layout/i.test(question);
}

function needsTable(question: string): boolean {
  return /compare|difference|classification|advantages|disadvantages|types/i.test(question);
}

function fallbackAnswer(question: string, marks: number): string {
  const policy = getPolicyForMarks(marks);
  return [
    "Introduction:",
    `${question} is an important exam concept. This answer is optimized for a ${marks}-mark response and targets approximately ${policy.minWords}-${policy.maxWords} words.`,
    "",
    "Explanation:",
    "Define the concept first, then break it into clear sub-points with short headings. Explain the mechanism, components, and practical significance.",
    "",
    "Example:",
    "Use at least one realistic academic or real-world example that demonstrates the concept step-by-step.",
    "",
    "Conclusion:",
    "Summarize the key insight in 2-3 lines, focusing on what examiners expect for full marks.",
  ].join("\n");
}

async function generateSingleAnswer(cluster: QuestionCluster): Promise<GeneratedAnswer> {
  const marks = Math.round(cluster.averageMarks);
  const policy = getPolicyForMarks(marks);
  const figure = needsFigure(cluster.canonicalQuestion)
    ? [
        "flowchart TD",
        "  A[Concept Start] --> B[Core Process]",
        "  B --> C[Outcome]",
      ].join("\n")
    : null;
  const table = needsTable(cluster.canonicalQuestion)
    ? [
        "| Aspect | Point A | Point B |",
        "|---|---|---|",
        "| Definition | ... | ... |",
        "| Use-case | ... | ... |",
      ].join("\n")
    : null;

  const prompt = [
    `Question: ${cluster.canonicalQuestion}`,
    `Marks: ${marks}`,
    `Frequency: ${cluster.frequency}`,
    `Asked in: ${cluster.yearsAsked.join(", ")}`,
    `Target word range: ${policy.minWords}-${policy.maxWords}`,
    "Write an exam-ready answer with the following sections exactly:",
    "Introduction",
    "Explanation",
    "Examples",
    "Conclusion",
    "Use concise headings and exam style language.",
    "Include table-friendly comparison points if applicable.",
    "If a diagram is useful, mention where to draw it.",
    "Do not output markdown fences except plain text content.",
  ].join("\n");

  let answer = "";

  try {
    const apiKey = groqKeyManager.getCurrentKey();
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are an expert university exam answer writer. Produce structured, marks-optimized answers students can write directly.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        groqKeyManager.rotateKey();
      }
      throw new Error(`Answer generation failed with status ${response.status}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("Model returned empty answer");
    }

    answer = content.trim();
  } catch {
    answer = fallbackAnswer(cluster.canonicalQuestion, marks);
  }

  return {
    id: randomUUID(),
    clusterId: cluster.id,
    subject: cluster.subject,
    question: cluster.canonicalQuestion,
    marks,
    frequency: cluster.frequency,
    yearsAsked: cluster.yearsAsked,
    answer,
    figure,
    table,
    generatedAt: new Date().toISOString(),
  };
}

export async function generateAnswersForClusters(clusters: QuestionCluster[]): Promise<GeneratedAnswer[]> {
  const output: GeneratedAnswer[] = [];
  for (const cluster of clusters) {
    output.push(await generateSingleAnswer(cluster));
  }
  return output;
}
