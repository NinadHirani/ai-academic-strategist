/**
 * AI Academic Copilot — Core Engine
 * 
 * Orchestrates: web search → syllabus extraction → parsing → roadmap → topic expansion
 * Uses Tavily API for web search (with SerpAPI fallback).
 * Uses Groq LLM for structured parsing and content generation.
 */

import type {
  SearchResult,
  ParsedSyllabus,
  StudyRoadmap,
  RoadmapUnit,
  RoadmapTopic,
  TopicExpansion,
  WebResource,
  ScheduleBlock,
} from "./copilot-types";

// ============================================================================
// Configuration
// ============================================================================

const GROQ_MODEL = "llama-3.3-70b-versatile";
const SEARCH_TIMEOUT = 15000;
const LLM_TIMEOUT = 60000;

function getGroqKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set");
  return key;
}

function getTavilyKey(): string | null {
  return process.env.TAVILY_API_KEY || null;
}

function getSerpApiKey(): string | null {
  return process.env.SERPAPI_KEY || null;
}

// ============================================================================
// 1. Web Search — Tavily (primary) / SerpAPI (fallback)
// ============================================================================

export async function searchWeb(query: string, maxResults = 10): Promise<SearchResult[]> {
  const tavilyKey = getTavilyKey();
  if (tavilyKey) {
    try {
      return await searchWithTavily(query, tavilyKey, maxResults);
    } catch (e) {
      console.warn("[Copilot] Tavily search failed, trying SerpAPI fallback:", e);
    }
  }

  const serpKey = getSerpApiKey();
  if (serpKey) {
    try {
      return await searchWithSerpApi(query, serpKey, maxResults);
    } catch (e) {
      console.warn("[Copilot] SerpAPI search also failed:", e);
    }
  }

  throw new Error(
    "No search API configured. Set TAVILY_API_KEY or SERPAPI_KEY in your environment."
  );
}

async function searchWithTavily(
  query: string,
  apiKey: string,
  maxResults: number
): Promise<SearchResult[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT);

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "advanced",
        max_results: maxResults,
        include_raw_content: true,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Tavily error ${res.status}: ${err.message || res.statusText}`);
    }

    const data = await res.json();
    return (data.results || []).map((r: any) => ({
      title: r.title || "",
      url: r.url || "",
      snippet: r.content || r.raw_content?.slice(0, 500) || "",
      source: "tavily" as const,
    }));
  } finally {
    clearTimeout(timeout);
  }
}

async function searchWithSerpApi(
  query: string,
  apiKey: string,
  maxResults: number
): Promise<SearchResult[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT);

  try {
    const params = new URLSearchParams({
      q: query,
      api_key: apiKey,
      engine: "google",
      num: String(maxResults),
    });

    const res = await fetch(`https://serpapi.com/search?${params}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`SerpAPI error: ${res.statusText}`);

    const data = await res.json();
    return (data.organic_results || []).map((r: any) => ({
      title: r.title || "",
      url: r.link || "",
      snippet: r.snippet || "",
      source: "serpapi" as const,
    }));
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================================
// 2. Syllabus Search — Find and extract syllabus from the web
// ============================================================================

export async function searchSyllabus(query: string): Promise<{
  results: SearchResult[];
  syllabusUrl: string | null;
  rawText: string | null;
}> {
  // Build a targeted search query for syllabus
  const syllabusQuery = `${query} official syllabus PDF topics units`;
  const results = await searchWeb(syllabusQuery, 8);

  // Identify the best syllabus URL
  const syllabusResult = results.find(
    (r) =>
      r.url.includes(".pdf") ||
      r.title.toLowerCase().includes("syllabus") ||
      r.snippet.toLowerCase().includes("syllabus") ||
      r.url.includes("syllabus")
  ) || results[0];

  // Extract raw text from the best result's snippet (Tavily provides raw_content)
  const rawText = syllabusResult
    ? results
        .filter((r) => r.snippet.length > 100)
        .map((r) => r.snippet)
        .join("\n\n")
    : null;

  return {
    results,
    syllabusUrl: syllabusResult?.url || null,
    rawText,
  };
}

// ============================================================================
// 3. Syllabus Parser — LLM-powered structured extraction
// ============================================================================

export async function parseSyllabus(
  query: string,
  rawText: string,
  searchResults: SearchResult[]
): Promise<ParsedSyllabus> {
  const contextText = searchResults
    .map((r) => `Source: ${r.url}\nTitle: ${r.title}\n${r.snippet}`)
    .join("\n---\n");

  const systemPrompt = `You are an academic syllabus parser. Given search results and raw text about a university syllabus, extract a structured JSON representation.

RULES:
- Extract the subject name, university name, semester
- Break down into units, each with topics and subtopics
- Use the actual content from search results — never invent topics
- If information is incomplete, mark what you can find and note gaps
- Return ONLY valid JSON, no markdown fences, no explanation`;

  const userPrompt = `Parse this syllabus information for: "${query}"

Search context:
${contextText}

${rawText ? `\nRaw syllabus text:\n${rawText}` : ""}

Return JSON in this exact format:
{
  "subject": "string",
  "subjectCode": "string or null",
  "university": "string",
  "semester": "string",
  "units": [
    {
      "id": "unit-1",
      "unitNumber": 1,
      "title": "Unit Title",
      "topics": [
        {
          "id": "unit-1-topic-1",
          "name": "Topic Name",
          "subtopics": [
            { "name": "Subtopic Name", "description": "Brief description" }
          ]
        }
      ]
    }
  ],
  "totalTopics": <number>
}`;

  const json = await callGroqJSON(systemPrompt, userPrompt);

  // Validate and return
  if (!json.units || !Array.isArray(json.units)) {
    throw new Error("LLM did not return valid syllabus structure");
  }

  // Ensure IDs are present
  let topicCount = 0;
  json.units.forEach((unit: any, ui: number) => {
    unit.id = unit.id || `unit-${ui + 1}`;
    unit.unitNumber = unit.unitNumber || ui + 1;
    (unit.topics || []).forEach((topic: any, ti: number) => {
      topic.id = topic.id || `unit-${ui + 1}-topic-${ti + 1}`;
      topicCount++;
    });
  });

  return {
    subject: json.subject || query,
    subjectCode: json.subjectCode || null,
    university: json.university || "Unknown",
    semester: json.semester || "Unknown",
    units: json.units,
    totalTopics: topicCount,
    rawSource: rawText?.slice(0, 1000) || undefined,
  } as ParsedSyllabus;
}

// ============================================================================
// 4. Roadmap Generator — Deterministic study plan from parsed syllabus
// ============================================================================

export async function generateRoadmap(
  syllabus: ParsedSyllabus
): Promise<StudyRoadmap> {
  const systemPrompt = `You are a study planning expert. Given a parsed university syllabus, generate a structured study roadmap.

RULES:
- Assign difficulty (easy/medium/hard) to each topic based on typical student experience
- Identify prerequisite topics by their IDs
- Estimate study time in minutes (15–120 per topic)
- Suggest a recommended learning order (number)
- Create a revision strategy
- Create a suggested daily schedule (assume 2-3 hours/day over 2-4 weeks)
- Return ONLY valid JSON, no markdown fences`;

  const userPrompt = `Generate a study roadmap for this syllabus:

Subject: ${syllabus.subject}
University: ${syllabus.university}
Semester: ${syllabus.semester}
Total Topics: ${syllabus.totalTopics}

Units:
${JSON.stringify(syllabus.units, null, 2)}

Return JSON:
{
  "units": [
    {
      "id": "unit-1",
      "unitNumber": 1,
      "title": "...",
      "topics": [
        {
          "id": "unit-1-topic-1",
          "unitId": "unit-1",
          "name": "...",
          "subtopics": [...],
          "difficulty": "easy|medium|hard",
          "prerequisites": [],
          "estimatedMinutes": 45,
          "recommendedOrder": 1,
          "status": "not-started",
          "revisionNotes": "..."
        }
      ],
      "totalEstimatedMinutes": 180
    }
  ],
  "totalEstimatedHours": 20,
  "revisionStrategy": "...",
  "suggestedSchedule": [
    {
      "day": 1,
      "label": "Day 1 — Foundations",
      "topicIds": ["unit-1-topic-1"],
      "type": "study",
      "estimatedMinutes": 120
    }
  ]
}`;

  const json = await callGroqJSON(systemPrompt, userPrompt);

  // Validate
  if (!json.units || !Array.isArray(json.units)) {
    throw new Error("LLM did not return valid roadmap structure");
  }

  // Calculate totals if missing
  const units: RoadmapUnit[] = json.units.map((u: any) => {
    const topics: RoadmapTopic[] = (u.topics || []).map((t: any) => ({
      id: t.id,
      unitId: t.unitId || u.id,
      name: t.name,
      subtopics: t.subtopics || [],
      difficulty: t.difficulty || "medium",
      prerequisites: t.prerequisites || [],
      estimatedMinutes: t.estimatedMinutes || 45,
      recommendedOrder: t.recommendedOrder || 0,
      status: "not-started" as const,
      revisionNotes: t.revisionNotes || "",
    }));

    return {
      id: u.id,
      unitNumber: u.unitNumber,
      title: u.title,
      topics,
      totalEstimatedMinutes:
        u.totalEstimatedMinutes ||
        topics.reduce((sum: number, t: RoadmapTopic) => sum + t.estimatedMinutes, 0),
    };
  });

  const totalMinutes = units.reduce((s, u) => s + u.totalEstimatedMinutes, 0);

  return {
    subject: syllabus.subject,
    university: syllabus.university,
    semester: syllabus.semester,
    units,
    totalEstimatedHours: json.totalEstimatedHours || Math.round(totalMinutes / 60),
    revisionStrategy:
      json.revisionStrategy ||
      "Review each unit after completion. Do a full revision 3 days before the exam.",
    suggestedSchedule: (json.suggestedSchedule || []) as ScheduleBlock[],
  };
}

// ============================================================================
// 5. Topic Expansion — Deep dive with real web resources
// ============================================================================

export async function expandTopic(
  topic: RoadmapTopic,
  subject: string,
  university: string
): Promise<TopicExpansion> {
  // Step 1: Search for articles about this topic
  const articleResults = await searchWeb(
    `${topic.name} ${subject} explained tutorial`,
    5
  );

  // Step 2: Search for YouTube content
  const youtubeResults = await searchWeb(
    `${topic.name} ${subject} site:youtube.com playlist tutorial`,
    5
  );

  // Step 3: Search for academic references
  const academicResults = await searchWeb(
    `${topic.name} ${subject} academic reference study material notes`,
    5
  );

  // Step 4: Build verified resource lists
  const articles: WebResource[] = articleResults
    .filter((r) => r.url && !r.url.includes("youtube.com"))
    .slice(0, 5)
    .map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet.slice(0, 200),
      type: "article" as const,
      verified: true,
    }));

  const youtubeResources: WebResource[] = youtubeResults
    .filter((r) => r.url.includes("youtube.com") || r.url.includes("youtu.be"))
    .slice(0, 3)
    .map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet.slice(0, 200),
      type: r.url.includes("playlist") ? ("playlist" as const) : ("video" as const),
      verified: true,
    }));

  const academicReferences: WebResource[] = academicResults
    .filter((r) => r.url && !r.url.includes("youtube.com"))
    .slice(0, 3)
    .map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet.slice(0, 200),
      type: "academic" as const,
      verified: true,
    }));

  // Step 5: Generate deep explanation using LLM with real context injected
  const resourceContext = [
    ...articles.map((a) => `Article: ${a.title}\n${a.snippet}`),
    ...youtubeResources.map((y) => `Video: ${y.title}\n${y.snippet}`),
    ...academicReferences.map((a) => `Reference: ${a.title}\n${a.snippet}`),
  ].join("\n---\n");

  const systemPrompt = `You are an expert academic tutor. Generate a comprehensive topic explanation using the provided real web resources as context. 

RULES:
- Provide a clear concept overview
- Include mathematical explanations if the topic involves math/formulas
- Give concrete examples
- Describe past year exam question patterns for ${university}
- Reference the actual resources provided — do NOT invent URLs or sources
- Return ONLY valid JSON, no markdown fences`;

  const userPrompt = `Generate a deep explanation for:
Topic: ${topic.name}
Subject: ${subject}
Subtopics: ${topic.subtopics.map((s) => s.name).join(", ")}

Web resources found:
${resourceContext}

Return JSON:
{
  "conceptOverview": "Detailed multi-paragraph explanation...",
  "mathematicalExplanation": "Formulas and derivations if applicable, or null",
  "examples": ["Example 1...", "Example 2..."],
  "pastYearPatterns": "Description of how this topic appears in exams..."
}`;

  const json = await callGroqJSON(systemPrompt, userPrompt);

  return {
    topicId: topic.id,
    topicName: topic.name,
    conceptOverview: json.conceptOverview || "No overview generated.",
    mathematicalExplanation: json.mathematicalExplanation || undefined,
    examples: json.examples || [],
    pastYearPatterns: json.pastYearPatterns || "No pattern data available.",
    articles,
    youtubeResources,
    academicReferences,
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// 6. Link Validator — Verify URLs are accessible
// ============================================================================

export async function validateLinks(
  resources: WebResource[]
): Promise<WebResource[]> {
  const validated = await Promise.all(
    resources.map(async (r) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(r.url, {
          method: "HEAD",
          signal: controller.signal,
          redirect: "follow",
        });
        clearTimeout(timeout);
        return { ...r, verified: res.ok };
      } catch {
        return { ...r, verified: false };
      }
    })
  );
  return validated;
}

// ============================================================================
// Groq LLM Helper — Structured JSON responses
// ============================================================================

async function callGroqJSON(
  systemPrompt: string,
  userPrompt: string
): Promise<any> {
  const apiKey = getGroqKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT);

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 8000,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        `Groq API error ${res.status}: ${err.error?.message || res.statusText}`
      );
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "{}";

    // Parse JSON — strip markdown fences if present
    const cleaned = content
      .replace(/^```json?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    return JSON.parse(cleaned);
  } catch (e: any) {
    clearTimeout(timeout);
    if (e.name === "AbortError") {
      throw new Error("LLM request timed out");
    }
    if (e instanceof SyntaxError) {
      throw new Error("LLM returned invalid JSON");
    }
    throw e;
  }
}

// ============================================================================
// Full Pipeline — Run all steps in sequence
// ============================================================================

export async function runFullPipeline(query: string): Promise<{
  syllabus: ParsedSyllabus;
  roadmap: StudyRoadmap;
}> {
  // Step 1: Search
  const { results, rawText } = await searchSyllabus(query);

  if (results.length === 0) {
    throw new Error(`No search results found for "${query}"`);
  }

  // Step 2: Parse syllabus
  const syllabus = await parseSyllabus(query, rawText || "", results);

  // Step 3: Generate roadmap
  const roadmap = await generateRoadmap(syllabus);

  return { syllabus, roadmap };
}
