/**
 * AI Academic Copilot — Core Engine (v2)
 * 
 * Orchestrates: LLM knowledge + web search → syllabus extraction → parsing → roadmap → topic expansion
 * Uses Groq LLM (llama-3.3-70b) as PRIMARY source for syllabus data.
 * Uses Google Custom Search / Tavily / SerpAPI for supplementary web resources.
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

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const SEARCH_TIMEOUT = 15000;
const LLM_TIMEOUT = 90000; // Increased for complex syllabus generation

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

function getGoogleSearchKey(): string | null {
  return process.env.Google_Custom_Search_key || null;
}

function getGoogleSearchCX(): string | null {
  return process.env.GOOGLE_SEARCH_CX || null;
}

// ============================================================================
// 1. Web Search — Tavily (primary) / SerpAPI (fallback)
// ============================================================================

export async function searchWeb(query: string, maxResults = 10): Promise<SearchResult[]> {
  const googleKey = getGoogleSearchKey();
  const googleCX = getGoogleSearchCX();
  if (googleKey) {
    try {
      return await searchWithGoogle(query, googleKey, googleCX, maxResults);
    } catch (e) {
      console.warn("[Copilot] Google search failed, trying Tavily fallback:", e);
    }
  }

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

  console.warn("[Copilot] No search API available or all failed. Using LLM knowledge only.");
  return [];
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

async function searchWithGoogle(
  query: string,
  apiKey: string,
  cx: string | null,
  maxResults: number
): Promise<SearchResult[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT);

  try {
    const params = new URLSearchParams({
      q: query,
      key: apiKey,
      num: String(Math.min(maxResults, 10)),
    });
    if (cx) params.set("cx", cx);

    const res = await fetch(
      `https://www.googleapis.com/customsearch/v1?${params}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Google Search error ${res.status}: ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    return (data.items || []).map((r: any) => ({
      title: r.title || "",
      url: r.link || "",
      snippet: r.snippet || "",
      source: "google" as const,
    }));
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================================
// 2. Syllabus Search — Multi-strategy search with better queries
// ============================================================================

/** Parse user query like "TOC, Semester 6, GTU" into structured parts */
function parseQueryParts(query: string): {
  subject: string;
  semester: string;
  university: string;
  raw: string;
} {
  const parts = query.split(/[,;]+/).map((p) => p.trim()).filter(Boolean);
  
  // Try to identify each part
  let subject = "";
  let semester = "";
  let university = "";

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (/sem(ester)?\s*\d+/i.test(lower) || /\d+\s*(st|nd|rd|th)\s*sem/i.test(lower)) {
      semester = part;
    } else if (
      /university|univ\.|institute|iit|nit|gtu|mu|sppu|vtu|aktu|jntu|rgpv|btu|anna|calicut|kerala|makaut|cusat|wbut/i.test(lower)
    ) {
      university = part;
    } else {
      // Likely the subject name — expand common abbreviations
      subject = expandSubjectAbbreviation(part);
    }
  }

  // If only one part, treat the whole thing as the subject
  if (!subject && parts.length === 1) {
    subject = expandSubjectAbbreviation(parts[0]);
  }

  return { subject: subject || query, semester, university, raw: query };
}

/** Expand common academic abbreviations to full names */
function expandSubjectAbbreviation(abbr: string): string {
  const map: Record<string, string> = {
    "toc": "Theory of Computation",
    "os": "Operating Systems",
    "dbms": "Database Management Systems",
    "cn": "Computer Networks",
    "daa": "Design and Analysis of Algorithms",
    "ds": "Data Structures",
    "oops": "Object Oriented Programming",
    "oop": "Object Oriented Programming",
    "se": "Software Engineering",
    "cd": "Compiler Design",
    "coa": "Computer Organization and Architecture",
    "co": "Computer Organization",
    "ai": "Artificial Intelligence",
    "ml": "Machine Learning",
    "dl": "Deep Learning",
    "dsa": "Data Structures and Algorithms",
    "de": "Digital Electronics",
    "dm": "Discrete Mathematics",
    "flat": "Formal Languages and Automata Theory",
    "mp": "Microprocessor",
    "sp": "System Programming",
    "wt": "Web Technology",
    "cc": "Cloud Computing",
    "is": "Information Security",
    "iot": "Internet of Things",
    "big data": "Big Data Analytics",
    "ip": "Image Processing",
    "nlp": "Natural Language Processing",
    "cg": "Computer Graphics",
    "ada": "Analysis and Design of Algorithms",
    "gt": "Graph Theory",
    "ns": "Network Security",
    "es": "Embedded Systems",
    "spm": "Software Project Management",
    "stqa": "Software Testing and Quality Assurance",
    "mad": "Mobile Application Development",
    "hci": "Human Computer Interaction",
  };
  const lower = abbr.toLowerCase().trim();
  return map[lower] || abbr;
}

export async function searchSyllabus(query: string): Promise<{
  results: SearchResult[];
  syllabusUrl: string | null;
  rawText: string | null;
  parsedQuery: ReturnType<typeof parseQueryParts>;
}> {
  const parsedQuery = parseQueryParts(query);
  
  // Build multiple targeted search queries for better coverage
  const queries = [
    `${parsedQuery.university} ${parsedQuery.subject} ${parsedQuery.semester} syllabus units topics`,
    `${parsedQuery.university} ${parsedQuery.subject} syllabus detailed topics subtopics`,
    `${parsedQuery.subject} ${parsedQuery.semester} ${parsedQuery.university} course outline curriculum`,
  ].filter((q) => q.trim().length > 10);

  let allResults: SearchResult[] = [];
  
  for (const q of queries) {
    try {
      const results = await searchWeb(q, 5);
      allResults.push(...results);
    } catch (e) {
      console.warn(`[Copilot] Search query failed: "${q}"`, e);
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  allResults = allResults.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  // Identify the best syllabus URL
  const syllabusResult = allResults.find(
    (r) =>
      r.url.includes(".pdf") ||
      r.title.toLowerCase().includes("syllabus") ||
      r.snippet.toLowerCase().includes("syllabus") ||
      r.url.includes("syllabus")
  ) || allResults[0];

  const rawText = allResults
    .filter((r) => r.snippet.length > 50)
    .map((r) => `[${r.title}]\n${r.snippet}`)
    .join("\n\n---\n\n");

  return {
    results: allResults,
    syllabusUrl: syllabusResult?.url || null,
    rawText: rawText || null,
    parsedQuery,
  };
}

// ============================================================================
// 3. Syllabus Parser — LLM Knowledge-First + Web-Enhanced Extraction
// ============================================================================

/**
 * PRIMARY approach: Use the LLM's extensive training data to generate
 * an accurate syllabus. Most Indian university syllabi (GTU, SPPU, VTU, 
 * AKTU, MU, etc.) are well-documented in LLM training data.
 * Web search results are used as supplementary context for accuracy.
 */
export async function parseSyllabus(
  query: string,
  rawText: string,
  searchResults: SearchResult[],
  parsedQuery?: { subject: string; semester: string; university: string }
): Promise<ParsedSyllabus> {
  const pq = parsedQuery || parseQueryParts(query);
  
  // Build web context if available (supplementary, not primary)
  const webContext = searchResults.length > 0
    ? searchResults
        .slice(0, 10)
        .map((r) => `Source: ${r.url}\nTitle: ${r.title}\nContent: ${r.snippet}`)
        .join("\n---\n")
    : "";

  const systemPrompt = `You are an expert academic syllabus specialist with comprehensive knowledge of university curricula across India and worldwide.

YOUR PRIMARY TASK: Generate the EXACT, ACCURATE, and COMPLETE syllabus for the requested subject, university, and semester.

CRITICAL RULES:
1. Use your training knowledge as the PRIMARY source — you know the standard syllabi of major universities (GTU, SPPU, VTU, AKTU, Mumbai University, Anna University, JNTU, etc.)
2. If web search results are provided, use them to VERIFY and SUPPLEMENT your knowledge — but do NOT limit yourself to just what's in the search snippets
3. Generate ALL units (typically 5-8 units for Indian university subjects) with COMPLETE topics and subtopics
4. Each unit MUST have 3-8 specific topics with 2-5 subtopics each
5. Use the OFFICIAL unit titles and topic names as used in the actual university syllabus
6. Include subject codes if you know them (e.g., 3160714 for GTU TOC)
7. If you're not 100% sure about the exact syllabus for that specific university, use the STANDARD curriculum for that subject that's common across Indian technical universities
8. NEVER return empty units or placeholder topics — always provide substantive content
9. Return ONLY valid JSON, no markdown fences, no explanation text`;

  const userPrompt = `Generate the COMPLETE and ACCURATE syllabus for:

Subject: ${pq.subject}
University: ${pq.university || "Not specified — use standard Indian engineering curriculum"}
Semester: ${pq.semester || "Not specified"}

${webContext ? `\nWeb search context (use to verify/supplement your knowledge):\n${webContext}` : ""}
${rawText ? `\nAdditional raw text:\n${rawText.slice(0, 3000)}` : ""}

Return JSON in this EXACT format — every unit MUST have real topics:
{
  "subject": "Full Subject Name",
  "subjectCode": "code or null",
  "university": "Full University Name",
  "semester": "Semester X",
  "units": [
    {
      "id": "unit-1",
      "unitNumber": 1,
      "title": "Official Unit Title",
      "topics": [
        {
          "id": "unit-1-topic-1",
          "name": "Specific Topic Name",
          "subtopics": [
            { "name": "Subtopic Name", "description": "1-2 sentence description of what this covers" }
          ]
        }
      ]
    }
  ],
  "totalTopics": <count all topics across all units>
}

IMPORTANT: Generate 5-8 units minimum. Each unit must have 3-8 real topics. This is for academic study — completeness matters.`;

  const json = await callGroqJSON(systemPrompt, userPrompt);

  // Validate and return
  if (!json.units || !Array.isArray(json.units) || json.units.length === 0) {
    throw new Error("LLM did not return valid syllabus structure");
  }

  // Ensure IDs and counts are correct
  let topicCount = 0;
  json.units.forEach((unit: any, ui: number) => {
    unit.id = unit.id || `unit-${ui + 1}`;
    unit.unitNumber = unit.unitNumber || ui + 1;
    if (!unit.topics || !Array.isArray(unit.topics)) unit.topics = [];
    unit.topics.forEach((topic: any, ti: number) => {
      topic.id = topic.id || `unit-${ui + 1}-topic-${ti + 1}`;
      if (!topic.subtopics) topic.subtopics = [];
      topicCount++;
    });
  });

  // Sanity check: if too few topics, the generation was poor
  if (topicCount < 5) {
    console.warn(`[Copilot] Only ${topicCount} topics found — attempting enhanced generation`);
    // Try once more with a more forceful prompt
    return await generateSyllabusFromKnowledge(pq.subject, pq.university, pq.semester);
  }

  return {
    subject: json.subject || pq.subject,
    subjectCode: json.subjectCode || null,
    university: json.university || pq.university || "Unknown",
    semester: json.semester || pq.semester || "Unknown",
    units: json.units,
    totalTopics: topicCount,
    rawSource: rawText?.slice(0, 1000) || undefined,
  } as ParsedSyllabus;
}

/**
 * Fallback: Generate syllabus purely from LLM knowledge.
 * This is used when web search returns nothing useful.
 */
async function generateSyllabusFromKnowledge(
  subject: string,
  university: string,
  semester: string
): Promise<ParsedSyllabus> {
  const systemPrompt = `You are a university curriculum expert. You have extensive knowledge of engineering and science syllabi from Indian universities and worldwide.

Generate a DETAILED and ACCURATE syllabus. This will be used by students to study, so accuracy is critical.

RULES:
- Generate 5-8 units with 4-7 topics each
- Each topic must have 2-5 subtopics with descriptions
- Use standard academic terminology
- If you know the exact syllabus for the given university, use it
- If not, use the most common/standard version of this subject's curriculum
- Return ONLY valid JSON`;

  const userPrompt = `Generate the complete syllabus:
Subject: ${subject}
University: ${university || "Standard Indian Engineering Curriculum (common across GTU, VTU, SPPU, etc.)"}
Semester: ${semester || "Standard"}

JSON format:
{
  "subject": "Full Name",
  "subjectCode": "code or null",
  "university": "name",
  "semester": "Semester X",
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
            { "name": "Subtopic", "description": "Brief description" }
          ]
        }
      ]
    }
  ],
  "totalTopics": <number>
}`;

  const json = await callGroqJSON(systemPrompt, userPrompt);
  
  let topicCount = 0;
  (json.units || []).forEach((unit: any, ui: number) => {
    unit.id = unit.id || `unit-${ui + 1}`;
    unit.unitNumber = unit.unitNumber || ui + 1;
    if (!unit.topics) unit.topics = [];
    unit.topics.forEach((topic: any, ti: number) => {
      topic.id = topic.id || `unit-${ui + 1}-topic-${ti + 1}`;
      if (!topic.subtopics) topic.subtopics = [];
      topicCount++;
    });
  });

  return {
    subject: json.subject || subject,
    subjectCode: json.subjectCode || null,
    university: json.university || university || "Unknown",
    semester: json.semester || semester || "Unknown",
    units: json.units || [],
    totalTopics: topicCount,
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
// 5. Topic Expansion — LLM Knowledge + Optional Web Resources
// ============================================================================

export async function expandTopic(
  topic: RoadmapTopic,
  subject: string,
  university: string
): Promise<TopicExpansion> {
  // Step 1: Try to search for web resources (non-blocking — failure is OK)
  let articles: WebResource[] = [];
  let youtubeResources: WebResource[] = [];
  let academicReferences: WebResource[] = [];

  try {
    const [articleResults, youtubeResults, academicResults] = await Promise.allSettled([
      searchWeb(`${topic.name} ${subject} explained tutorial`, 5),
      searchWeb(`${topic.name} ${subject} site:youtube.com tutorial`, 5),
      searchWeb(`${topic.name} ${subject} study material notes pdf`, 5),
    ]);

    if (articleResults.status === "fulfilled") {
      articles = articleResults.value
        .filter((r) => r.url && !r.url.includes("youtube.com"))
        .slice(0, 5)
        .map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet.slice(0, 200),
          type: "article" as const,
          verified: true,
        }));
    }

    if (youtubeResults.status === "fulfilled") {
      youtubeResources = youtubeResults.value
        .filter((r) => r.url.includes("youtube.com") || r.url.includes("youtu.be"))
        .slice(0, 3)
        .map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet.slice(0, 200),
          type: r.url.includes("playlist") ? ("playlist" as const) : ("video" as const),
          verified: true,
        }));
    }

    if (academicResults.status === "fulfilled") {
      academicReferences = academicResults.value
        .filter((r) => r.url && !r.url.includes("youtube.com"))
        .slice(0, 3)
        .map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet.slice(0, 200),
          type: "academic" as const,
          verified: true,
        }));
    }
  } catch (e) {
    console.warn("[Copilot] Web search for topic expansion failed — using LLM knowledge only:", e);
  }

  // Step 2: Build resource context for LLM (if any found)
  const resourceContext = [
    ...articles.map((a) => `Article: ${a.title}\n${a.snippet}`),
    ...youtubeResources.map((y) => `Video: ${y.title}\n${y.snippet}`),
    ...academicReferences.map((a) => `Reference: ${a.title}\n${a.snippet}`),
  ].join("\n---\n");

  // Step 3: Generate deep explanation using LLM
  const systemPrompt = `You are an expert academic tutor with deep knowledge of ${subject}. Generate a comprehensive, accurate, and detailed topic explanation.

RULES:
- Provide a thorough concept overview (3-5 paragraphs minimum)
- Include mathematical explanations with formulas if the topic involves math
- Give 2-4 concrete, detailed examples
- Describe how this topic appears in university exams for ${university || "Indian engineering universities"}
- If web resources were found, reference them. If not, still provide a complete explanation from your knowledge
- Use LaTeX notation for math formulas (e.g., \\(formula\\))
- Be accurate — students will use this to study for exams
- Return ONLY valid JSON, no markdown fences`;

  const userPrompt = `Generate a comprehensive explanation for:

Topic: ${topic.name}
Subject: ${subject}
University: ${university || "Indian Engineering University"}
Subtopics to cover: ${topic.subtopics.map((s) => s.name).join(", ") || "Cover all key aspects"}

${resourceContext ? `\nWeb resources found (reference these):\n${resourceContext}` : "\nNo web resources available — generate entirely from your knowledge."}

Return JSON:
{
  "conceptOverview": "Detailed multi-paragraph explanation covering all subtopics...",
  "mathematicalExplanation": "Formulas, derivations, proofs if applicable, or null",
  "examples": ["Detailed Example 1...", "Detailed Example 2...", "Example 3..."],
  "pastYearPatterns": "How this topic appears in exams — common question types, marks allocation, important theorems/proofs to know..."
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
  const groqKey = getGroqKey();
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  const parseJsonContent = (content: string) => {
    const cleaned = content
      .replace(/^```json?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    return JSON.parse(cleaned);
  };

  // 1) Try Groq — multiple models in priority order
  const groqModels = [
    GROQ_MODEL,
    ...(process.env.GROQ_FALLBACK_MODELS || "")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean)
      .filter((m) => m !== GROQ_MODEL),
  ];

  let lastGroqError: string | null = null;
  for (const model of groqModels) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT);

    try {
      console.log(`[Copilot] Trying Groq model: ${model}`);
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.1,
          max_tokens: 16000,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || "{}";
        console.log(`[Copilot] Success with Groq model: ${model}`);
        return parseJsonContent(content);
      }

      const err = await res.json().catch(() => ({}));
      lastGroqError = `Groq ${model} failed (${res.status}): ${err.error?.message || res.statusText}`;

      // Rate-limited or quota exceeded → try next Groq model
      if (res.status === 429 || res.status === 402 || res.status === 403) {
        console.warn(`[Copilot] ${lastGroqError}. Trying next model...`);
        continue;
      }
      // Model not found → skip
      if (res.status === 404) {
        console.warn(`[Copilot] Groq model ${model} not found, skipping`);
        continue;
      }
      // Other error → still try next model
      console.warn(`[Copilot] ${lastGroqError}`);
    } catch (e: any) {
      clearTimeout(timeout);
      if (e.name === "AbortError") {
        lastGroqError = `Groq ${model} timed out`;
        console.warn(`[Copilot] ${lastGroqError}, trying next model...`);
        continue;
      }
      if (e instanceof SyntaxError) {
        lastGroqError = `Groq ${model} returned invalid JSON`;
        console.warn(`[Copilot] ${lastGroqError}, trying next model...`);
        continue;
      }
      lastGroqError = e?.message || String(e);
      console.warn(`[Copilot] Groq ${model} error: ${lastGroqError}`);
    }
  }

  console.warn(`[Copilot] All Groq models exhausted. Last error: ${lastGroqError}. Trying OpenRouter...`);

  // 2) Try OpenRouter fallback
  if (openrouterKey) {
    const fallbackModels = (
      process.env.OPENROUTER_MODELS ||
      "meta-llama/llama-3.3-70b-instruct:free,google/gemma-3-27b-it:free,mistralai/mistral-small-3.1-24b-instruct:free,qwen/qwen3-coder:free"
    )
      .split(",")
      .map((model) => model.trim())
      .filter(Boolean)
      // only keep free-tier models
      .filter((m) => m.toLowerCase().includes(":free"));

    let lastOpenRouterError: string | null = null;

    for (const model of fallbackModels) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT);

      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openrouterKey}`,
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "AI Academic Copilot",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.1,
            max_tokens: 16000,
            response_format: { type: "json_object" },
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const message = err.error?.message || res.statusText;
          lastOpenRouterError = `OpenRouter model ${model} failed (${res.status}): ${message}`;

          // Endpoint/model unavailable, decommissioned, or no access -> try next model
          if (res.status === 404 || res.status === 401 || res.status === 402 || res.status === 403 || res.status === 429) {
            console.warn(`[Copilot] ${lastOpenRouterError}. Trying next model...`);
            continue;
          }

          throw new Error(`OpenRouter API error ${res.status}: ${message}`);
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || "{}";
        return parseJsonContent(content);
      } catch (e: any) {
        clearTimeout(timeout);
        if (e.name === "AbortError") {
          throw new Error("OpenRouter request timed out — try a shorter query or try again");
        }
        if (e instanceof SyntaxError) {
          throw new Error("OpenRouter returned invalid JSON — please try again");
        }
        if (String(e?.message || "").includes("OpenRouter API error")) {
          throw e;
        }
        lastOpenRouterError = e?.message || String(e);
      }
    }

    throw new Error(lastOpenRouterError || "OpenRouter fallback failed for all configured models");
  }

  throw new Error("All LLM providers failed or rate limited");
}

// ============================================================================
// Full Pipeline — Run all steps in sequence
// ============================================================================

export async function runFullPipeline(query: string): Promise<{
  syllabus: ParsedSyllabus;
  roadmap: StudyRoadmap;
}> {
  const parsedQuery = parseQueryParts(query);
  console.log("[Copilot] Parsed query:", parsedQuery);

  // Step 1: Search web (non-fatal if it fails)
  let searchResults: SearchResult[] = [];
  let rawText: string | null = null;

  try {
    const searchData = await searchSyllabus(query);
    searchResults = searchData.results;
    rawText = searchData.rawText;
    console.log(`[Copilot] Web search returned ${searchResults.length} results`);
  } catch (e) {
    console.warn("[Copilot] Web search failed entirely — using LLM knowledge:", e);
  }

  // Step 2: Parse/generate syllabus (LLM knowledge + web context)
  let syllabus: ParsedSyllabus;
  try {
    syllabus = await parseSyllabus(query, rawText || "", searchResults, parsedQuery);
  } catch (e) {
    console.warn("[Copilot] Primary parse failed, trying pure knowledge generation:", e);
    syllabus = await generateSyllabusFromKnowledge(
      parsedQuery.subject,
      parsedQuery.university,
      parsedQuery.semester
    );
  }

  if (syllabus.totalTopics === 0) {
    throw new Error(`Could not generate syllabus for "${query}". Try being more specific (e.g., "Theory of Computation, Semester 6, GTU")`);
  }

  console.log(`[Copilot] Syllabus: ${syllabus.subject} — ${syllabus.units.length} units, ${syllabus.totalTopics} topics`);

  // Step 3: Generate roadmap
  const roadmap = await generateRoadmap(syllabus);

  return { syllabus, roadmap };
}
