import { NextRequest, NextResponse } from "next/server";
import { retrieveContext, getDocumentsFromSupabase, RAGConfig, getStats } from "@/lib/rag";
import { generateEmbedding } from "@/lib/embeddings";
import { parseAcademicContext, getContextForPrompt, AcademicContext } from "@/lib/context-engine";
import { getOrCreateSession, addMessage, getConversationContext, generateSessionTitle, updateSession, getSessionMessageCount, ChatMode } from "@/lib/chat-history";
import { getStudentProfile, getWeakAreas, getStrongAreas, getLearningStats } from "@/lib/student-memory";
import { getUserProfile, updateUserProfile, getProfileForPrompt, processAIResponseForFacts, extractFactsFromMessage } from "@/lib/user-profile-json";
import { detectAndExecuteTool, ToolResult } from "@/lib/agent-router";
import { Readable } from "stream";

interface ChatRequestBody {
  message: string;
  mode: "study" | "deepExplore" | "tutor" | "review";
  useRag?: boolean;
  userId?: string;
  sessionId?: string;
}

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface Source {
  documentName: string;
  chunkIndex: number;
  score: number;
}

interface RetrievalMetadata {
  retrieved: boolean;
  sourceCount: number;
  sources: Source[];
  retrievalTime?: number;
}

type UserProfile = {
  name?: string;
  university?: string;
  interests?: string[];
  weakAreas?: string[];
};

interface AcademicContextMetadata {
  university: string | null;
  semester: number | null;
  subject: string | null;
  subjectCode: string | null;
  intent: string;
  confidence: number;
}

interface ToolResultPayload {
  tool: string;
  label: string;
  emoji: string;
  data?: any;
  error?: string;
}

interface ChatResponse {
  message: string;
  mode: string;
  hasDocuments: boolean;
  retrieval?: RetrievalMetadata;
  academicContext?: AcademicContextMetadata;
  sessionId?: string;
  toolResult?: ToolResultPayload;
  error?: string;
}

const DEFAULT_RAG_CONFIG: RAGConfig = {
  chunkSize: 800,
  chunkOverlap: 150,
  retrievalK: 5,
  similarityThreshold: 0.05, // Lowered for better retrieval
};

const GROQ_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_USER_ID = "anonymous";
const MAX_CHAT_HISTORY_MESSAGES = 30;

// ============================================================================
// Humanized AI Output System
// ============================================================================

/**
 * Human-like Writing Style Guidelines
 * These instructions help generate natural, conversational responses
 */
// === STRICT ACADEMIC EXPLANATION SYSTEM ===

const SYSTEM_RESPONSE_GOVERNANCE = `
You are an academic explanation engine.Your output must strictly follow these rules:

GLOBAL RULES
  - Never generate or fabricate URLs.
- Never mention external links unless explicitly provided.
- Do not invent references.
- Assume references and videos will be attached separately by the system.
- Focus only on explanation and structured academic clarity.
- Maintain professional academic tone when the user asks a technical or subject - focused question.
- Do not introduce yourself as a tutor.
- Do not ask follow - up questions at the end unless clarification is required.

GENERAL CONVERSATION GUIDELINES
  - When the user asks about how to use the system, about uploaded documents, or anything that is not a formal academic / technical query, switch to a simple, friendly conversational tone.
- Respond as you would to a normal person or curious friend: clear, direct, and warm.
- Avoid rigid academic formatting in casual interactions; keep sentences natural and easy to read.
- You may paraphrase system usage instructions or document policies in plain language.

GROUNDING RULE
You are given:
- Topic
  - Mode(Study or DeepExplore)
  - Student Level(optional)
    - Syllabus context(optional)
      - Search summaries(trusted external snippets)

You must base your explanation on:
1. Your internal knowledge
2. The provided syllabus context
3. The provided search summaries

If information is limited:
Make logical academic assumptions and continue clearly.

Never say:
“I cannot access external documents.”
“I cannot browse the internet.”

MODE - SPECIFIC OUTPUT STRUCTURE

If Mode = Study

Goal: Make the explanation engaging, visually clear, and easy to scan.

Do NOT use rigid academic section headers.

Write in a natural explanatory style, but format clearly using:

- Short paragraphs(2–4 lines max)
  - Bold for important terms
    - Small informal headings when helpful
      - Bullet points for lists
        - Numbered steps for processes
          - Colon - style mini sections(e.g., "Why this matters:")
    - Tables when comparison improves clarity
      - Clean math equations when relevant
        - Light, meaningful emoji use(sparingly)

Structure the explanation naturally in this flow:

• Start by building intuition about the concept.
• Introduce core ideas gradually.
• Break down how it works(use steps if needed).
• Provide at least one concrete example.
• Highlight common mistakes(⚠️).
• End with a short exam - focused takeaway.

Formatting Guidelines:

- Use bullets only when clarity improves.
- Use numbered lists for logical sequences.
- Use tables for structured comparison.
- Keep spacing between sections.
- Avoid long unbroken paragraphs.
- Avoid turning explanation into a narrative story.
- Avoid excessive emoji use.
- Avoid sounding like a textbook.

The explanation should feel like a smart senior explaining on a board — visually clean, logically structured, and easy to absorb.

If Mode = DeepExplore
Goal: Theoretical depth and academic rigor.
Structure output EXACTLY as:

Concept Overview
High - level introduction.

Formal Definition
Precise and technical definition.

Core Theoretical Framework
Mathematical or logical structure.

Related Concepts
Connections to adjacent topics.

Advanced Insight
Deeper reasoning, edge cases, or system - level implications.

  Practical / System Applications
Real - world or research applications.

Avoid simplification unless Student_Level requires it.

PERSONALIZATION LAYER
If Student_Level is provided:
Beginner:
- Simple vocabulary
  - Clear step transitions
    - Avoid heavy notation
Intermediate:
- Balanced clarity and technical depth
Advanced:
- Formal terminology
  - Mathematical notation where relevant
    - Academic rigor
Never intentionally degrade explanation quality.
Adapt clarity, not correctness.

OUTPUT RULES
  - Use clean section headers.
- Use short, readable paragraphs.
- Use bullet points only when helpful.
- Avoid unnecessary emojis.
- Avoid filler language.
- No conversational fluff.
- No tutor - style endings like:
“What would you like to learn next ?”
The output must feel like a structured academic article, not a chat reply.

BACKEND SELF - CHECK(internal, not shown to user):
Before finalizing response:
- Verify no URLs are present.
- Verify required section headers exist.
- Verify structure matches selected Mode.
Then output final answer.

ARCHITECTURE LOGIC SUMMARY
LLM handles:
- Explanation
  - Structure
  - Academic reasoning
Search API handles:
- Real URLs
  - Video links
    - Reference credibility
Frontend handles:
- Collapsible “Sources” button
  - Clean UI display
Never merge responsibilities.
`;
const HUMAN_WRITING_GUIDELINES = `WRITING STYLE:
- Write the way a knowledgeable, friendly human would explain things
  - Use varied sentence lengths - mix short punchy sentences with longer flowing ones
    - Start with the key insight first, then explain
      - Never use phrases like "As an AI language model", "I am an AI", or "As of my knowledge"
        - Avoid robotic transitions like "Furthermore", "Moreover", "Additionally", "In conclusion"
          - Use natural connectors like "Actually", "So", "The thing is", "Here's the deal"
            - Don't over-explain or state the obvious
              - Sound like a knowledgeable tutor, not a textbook

                * When the question is about using the system, uploaded files, or is otherwise informal, lean into normal conversational tone (think chat with a friend) and drop academic formality.* `;

const OUTPUT_FORMATTING = `FORMATTING:
- Use light formatting - <strong> for key terms, concepts students should remember
  - Break up long walls of text with short paragraphs(2 - 4 sentences each)
    - Use bullet points sparingly for steps or lists, but keep them concise
      - When listing things, prefer running prose over heavy bullet lists
        - Make code / examples clear with proper formatting
          - If something is important, say it directly - don't soft-pedal with "perhaps" or "might"`;

const AI_PATTERNS_TO_AVOID = `AVOID THESE AI PATTERNS:
- Never start responses with "Sure!", "Certainly!", "Of course!" or similar fillers
- Don't use "I hope this helps!" or "Let me know if you need anything else!"
- Avoid "That's a great question!" as an opener
- Don't use phrases like "In this article/post/tutorial, we will..."
- Skip "It's worth noting that..." and "It's important to understand that..."
- Avoid starting every paragraph with a transition word
- Don't end with "Happy learning!" or "Keep studying!" - be genuine

EMOJI USAGE:
- Use relevant emojis naturally to enhance understanding
- Don't overuse emojis - one or two per response is enough
- Use them as visual aids, not decorations

EMOJI REFERENCE GUIDE:

Programming & Tech:
💻 computer/code, ⌨️ keyboard, 🖥️ screen, 🔧 tools, ⚙️ settings, 🔒 security, 🌐 internet, 📡 network, 💾 storage, 🗄️ database, 📱 mobile, 📧 email, 🔗 link, 🧩 plugin

Math & Science:
🧮 calculation, 📐 geometry, 📏 measurement, 🔢 numbers, ➕➖✖️➗ operators, 📊 charts, 📈 graphs, 📉 statistics, ⚛️ atom/physics, 🧬 biology, 🧪 chemistry, 🌡️ temperature

Learning & Education:
📚 books/learning, 📖 reading, ✏️ writing, 📝 notes, 🎓 graduation, 🏫 school/college, 👨‍🏫 teacher, 👨‍💻 student, 💯 score/perfect, 📋 assignment, 📅 schedule, ⏰ deadline


✅ correct/done, ❌ incorrect, ⚠️ warning, ❗ important, ✔️ completed, ⭕ status, 🔴 error, 🟢 success, 🟡 warning/pending

Comparisons & Differences:
⚖️ balance/compare, 🔄 exchange, ↔️ bidirectional, ➡️➡️ sequence, 📋 list, 🥇🥈🥇 ranking

Structure & Organization:
📦 module/package, 🏗️ architecture, 🏛️ structure, 📂 folder/files, 📁 directory, 🗂️ categories, 🏷️ tags, 📑 index

Time & Dates:
⏰ time, 📅 calendar, 🕐 hour, 📆 date, ⌛ waiting, ⏳ loading, ⏱️ timer, 🗓️ event

Data & Information:
📊 data, 📈 growth, 📉 decline, 📉 trend, 📋 report, 📜 document, 📄 file, 🧾 receipt/invoice

People & Communication:
👤 user, 👥 group, 🗣️ discussion, 💬 chat, 📢 announcement, 👋 greeting, 🙋 help

Tools & Resources:
🛠️ tools, ⚒️ build, 🔨 hammer/fix, 🔩 components, 📎 attachment, 📌 pin, 🖊️ edit, 🗑️ delete

Nature & World:
🌱 start/growth, 🌿 code/nature, 🌵 complex, 🍃 simple, 🌊 flow, ❄️ cold/freeze, 🔥 hot/issue

General:
🎮 gamification, 🏆 achievement, ⭐ rating, 💎 valuable, 🔮 future, 🎁 result, 🧩 puzzle, 📌 key point
`;

const RESPONSE_TONE = `TONE:
- Conversational but knowledgeable - like a smart senior student explaining to a friend
- Confident when you know the answer - don't hedge unnecessarily
- When uncertain, be honest: "That's a bit outside my wheelhouse" or "I'm not 100% sure on that one"
- Show genuine interest in helping - but naturally, not performatively
- Match the student's energy - casual questions get casual answers, serious ones get serious treatment
- If the student asks something simple, don't be condescending
- Sometimes a direct short answer is better than a long explanation

*For purely operational or document‑related queries, keep the tone even more relaxed and human‑like; imagine you're just chatting with someone over coffee.*`

// ============================================================================
// Study Tutor Constraints - Output Formatting Rules
// ============================================================================

const COMPARATIVE_LEARNING = `
TABLE USAGE RULES:

USE TABLES ONLY FOR:
✓ Comparing (X vs Y) - When contrasting two or more concepts side-by-side
✓ Showing pros/cons - Advantages and disadvantages lists
✓ Displaying data - Statistics, metrics, structured information
✓ Multi-feature breakdown - Listing multiple features/characteristics in organized format

AVOID TABLES FOR:
✗ Definitions - Simply defining a term or concept
✗ Short explanations - Brief answers under 2-3 sentences
✘ Concept clarification - Explaining how something works
✘ Opinion/reasoning answers - Explaining why or how

When tables are NOT needed, use:
- Bold text for key terms
- Bullet points for lists (keep concise)
- Numbered steps for processes
- Running prose for explanations
`;

const PROCESS_VISUALIZATION = `
PROCESS VISUALIZATION:

- When describing a process, workflow, hierarchy, lifecycle, or system behaviour, include a Mermaid.js diagram.
- The diagram must clarify structure or dynamics, not merely decorate the explanation.
- Always wrap diagrams using a fenced code block with "mermaid".

Diagram Selection Rules:
- Use "flowchart" for sequences, pipelines, workflows, or cause→effect chains.
- Use "graph TD/LR" for hierarchies, dependencies, or architecture.
- Use "stateDiagram-v2" for state transitions or condition-driven changes.
- Use "sequenceDiagram" for interactions between actors/components.

Diagram Quality Rules:
- Labels must be concise and readable.
- Avoid unnecessary nodes or visual clutter.
- Maintain logical direction (top-down or left-right).
- Ensure terminology matches the explanation exactly.
- The diagram should be understandable even without surrounding text.

Example Syntax:

\`\`\`mermaid
flowchart TD
    A[Input] --> B[Process]
    B --> C[Output]
\`\`\`
`;

const MATHEMATICAL_PRECISION = `MATHEMATICAL PRECISION:
- Use LaTeX for ALL scientific and mathematical formulas so they render clearly
- Wrap formulas in $ for inline (e.g., $E=mc^2$) or $$ for block display
- Examples: $F=ma$, $E=mc^2$, $\\frac{dy}{dx}$, $PV=nRT$, $\\sqrt{x^2+y^2}$
- Always use proper scientific notation when applicable
- Include units in your formulas where relevant`;

const SCANNABILITY = `SCANNABILITY:
- Use **bolded key terms** for concepts students should remember
- Use bulleted lists for definitions, but keep them concise
- Break complex information into digestible chunks
- Use headers (##) to organize longer explanations
- Make important formulas stand out visually

BULLET POINT USAGE:
- Use bullet points for listing multiple related items or concepts
- Use for enumerating features, characteristics, or components
- Present steps in a process when not needing sequential order
- Highlight advantages/disadvantages and summarize key takeaways
- Keep bullet points concise (one line when possible)
- Use consistent bullet style (• or -)
- Limit to 5-7 bullets per section for readability
- Avoid bullets for single items (write as prose)
- Avoid bullets for long explanations (use paragraphs)
- Avoid bullets for sequential steps (use numbered lists)
- Avoid bullets for comparisons (use tables)`;

const CHECK_FOR_UNDERSTANDING = `CHECK FOR UNDERSTANDING:
- After longer explanations (2+ paragraphs), you MAY include a quick recap table if it genuinely helps retention
- The table should be simple: "Quick Recap" | "Practice Question"
- Skip the table for short answers, definitions, or simple questions
- If in doubt, skip the table - don't force it`;

// ============================================================================
// Long-Term Memory Protocol
// ============================================================================

const LONG_TERM_MEMORY_PROTOCOL = `Role: You are a Context-Aware Assistant with "Long-Term Memory" capabilities. Your goal is to provide a highly personalized experience by utilizing the provided [USER_PROFILE] and [CHAT_HISTORY].

Memory Protocol:

Profile Prioritization: Always check the [USER_PROFILE] before responding. If the user's name (e.g., Ninad), education (e.g., BE at GTU), or interests (e.g., Quantum Machine Learning) are listed, use them to personalize your response naturally.

Contextual Awareness: Use the [CHAT_HISTORY] to understand what was just discussed. Never ask for information that is already present in the Profile or History.

Information Extraction: If the user shares a new permanent fact about themselves (a new job, a change in location, or a new skill like Python or C++), acknowledge it and summarize it so it can be added to the [USER_PROFILE].

No Hallucination: If the profile and history are empty, do not guess user details. Instead, ask friendly questions to begin building their profile.

Response Style: 
- Professional yet adaptive.
- Use the user's name periodically to maintain rapport.
- If the user is a student or professional, tailor technical explanations to their known skill level.`;

// Remove conversational/tutor tone for strict academic output
const MODE_TONE_INSTRUCTIONS: Record<string, string> = {
  study: "Strictly follow the Study mode output structure: Concept Overview, Key Principles, Step-by-Step Explanation, Example, Common Mistakes, Exam Relevance. Maintain academic tone when answering technical/subject questions, but feel free to be casual if the user is asking about system usage or general queries.",
  deepExplore: "Strictly follow the DeepExplore mode output structure: Concept Overview, Formal Definition, Core Theoretical Framework, Related Concepts, Advanced Insight, Practical / System Applications. Maintain academic rigor, unless the request is clearly a general or operational question — in that case, relax into a friendly conversational tone.",
  tutor: "(Not used)",
  review: "(Not used)"
};

// ============================================================================
// ...existing code...
// System-level assistant prompt for operational/conversational responses
const SYSTEM_META_MODE = "";

const BASE_SYSTEM_PROMPT = SYSTEM_RESPONSE_GOVERNANCE;

const MODE_INSTRUCTIONS: Record<string, string> = {
  study: "Mode: Study. Output structure: Concept Overview, Key Principles, Step-by-Step Explanation, Example, Common Mistakes, Exam Relevance. Strictly follow this structure.",
  deepExplore: "Mode: DeepExplore. Output structure: Concept Overview, Formal Definition, Core Theoretical Framework, Related Concepts, Advanced Insight, Practical / System Applications. Strictly follow this structure."
};

function buildSystemPrompt(
  mode: string,
  retrievedContext: string | null,
  sources: Source[],
  userProfile: UserProfile | null,
  academicContext: AcademicContext | null,
  syllabusContext: string | null,
  contextString: string | null,
  toolContext?: string | null
) {
  if (contextString) syllabusContext = contextString;
  let searchSummaries = "";
  if (retrievedContext && retrievedContext.trim().length > 0) {
    // Include actual document content retrieved via RAG
    searchSummaries = `The following content was retrieved from uploaded documents:\n\n${retrievedContext}`;
    if (sources.length > 0) {
      searchSummaries += `\n\nSources: ${sources.map((s, i) => `${i + 1}. ${s.documentName} (Section ${s.chunkIndex + 1}, ${(s.score * 100).toFixed(0)}% match)`).join(", ")}`;
    }
  }

  // Compose the explicit backend user prompt
  let userProfileSection = "";
  if (userProfile && userProfile.name) {
    userProfileSection = `\nUser Profile:\n- Name: ${userProfile.name}\n- University: ${userProfile.university || "Not specified"}\n- Interests: ${(userProfile.interests && userProfile.interests.length > 0) ? userProfile.interests.join(", ") : "Not specified"}\n- Weak Areas: ${(userProfile.weakAreas && userProfile.weakAreas.length > 0) ? userProfile.weakAreas.join(", ") : "None identified"}`;
  }

  const backendPrompt = [
    BASE_SYSTEM_PROMPT,
    "",
    HUMAN_WRITING_GUIDELINES,
    "",
    OUTPUT_FORMATTING,
    "",
    MATHEMATICAL_PRECISION,
    "",
    MODE_TONE_INSTRUCTIONS[mode] || MODE_TONE_INSTRUCTIONS["study"],
    "",
    "---",
    "",
    `Mode: ${mode === "deepExplore" ? "DeepExplore" : "Study"}`,
    `Student_Level: Intermediate`,
    `Topic: ${(academicContext && academicContext.intent) ? academicContext.intent : "(Not specified)"}`,
    `Subject: ${(academicContext && academicContext.subject) ? academicContext.subject : "(Not specified)"}`,
    `University: ${(academicContext && academicContext.university) ? academicContext.university : (userProfile && userProfile.university ? userProfile.university : "(Not specified)")}`,
    userProfileSection,
    "Syllabus Context:",
    syllabusContext ? syllabusContext : "(None provided)",
    "",
    "Search Summaries / Reference Material:",
    searchSummaries ? searchSummaries : "(None provided)",
    "",
    "IMPORTANT: If reference material is provided above, use it as your primary source. Base your answer on those materials.",
    "If no reference material is provided, use your general knowledge to give a thorough answer.",
    "",
    ...(toolContext ? [
      "\n--- TOOL-GENERATED CONTEXT ---",
      toolContext,
      "--- END TOOL CONTEXT ---\n",
      "IMPORTANT: A tool was automatically invoked based on the user's request. Use the TOOL-GENERATED CONTEXT above as your PRIMARY source for this response. Present the tool's data clearly and helpfully.",
      ""
    ] : []),
    "Generate explanation following system rules."
  ].join("\n");
  return backendPrompt;
}

function validateRequest(body: unknown): ChatRequestBody | null {
  if (!body || typeof body !== "object") return null;

  const { message, mode, useRag, userId, sessionId } = body as Record<string, unknown>;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return null;
  }

  const validModes = ["study", "deepExplore", "tutor", "review"];
  const resolvedMode = validModes.includes(mode as string)
    ? mode as "study" | "deepExplore" | "tutor" | "review"
    : "study";

  return {
    message: message.trim(),
    mode: resolvedMode,
    useRag: useRag === undefined ? true : Boolean(useRag),
    userId: typeof userId === "string" ? userId : DEFAULT_USER_ID,
    sessionId: typeof sessionId === "string" ? sessionId : undefined,
  };
}

function getConfig() {
  const groqApiKey = process.env.GROQ_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (groqApiKey) {
    return {
      apiKey: groqApiKey,
      baseUrl: "https://api.groq.com/openai/v1",
      model: process.env.GROQ_MODEL || GROQ_MODEL,
      embeddingModel: "text-embedding-3-small",
      embeddingApiKey: groqApiKey,
      embeddingBaseUrl: "https://api.groq.com/openai/v1",
    };
  }

  return {
    apiKey: openaiApiKey,
    baseUrl: process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1",
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    embeddingModel: "text-embedding-3-small",
    embeddingApiKey: openaiApiKey,
    embeddingBaseUrl: process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1",
  };
}

function contextToMetadata(context: AcademicContext): AcademicContextMetadata {
  return {
    university: context.university,
    semester: context.semester,
    subject: context.subject,
    subjectCode: context.subjectCode,
    intent: context.intent,
    confidence: context.confidence,
  };
}

export async function POST(request: NextRequest): Promise<NextResponse<ChatResponse | { error: string }>> {
  const startTime = Date.now();

  // === DEBUG: API Key Configuration ===
  console.log("=== DEBUGGING CHAT ROUTE ===");
  console.log("[DEBUG] Environment API Keys:");
  console.log("- GROQ_API_KEY:", process.env.GROQ_API_KEY ? "✓ Set" : "❌ Missing");
  console.log("- OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "✓ Set" : "❌ Missing");
  console.log("- SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "✓ Set" : "❌ Missing");
  console.log("- SUPABASE_ANON_KEY:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✓ Set" : "❌ Missing");

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const validatedBody = validateRequest(body);
    if (!validatedBody) {
      return NextResponse.json({ error: "Message required and must be a string" }, { status: 400 });
    }

    const { message, mode, useRag, userId: rawUserId, sessionId } = validatedBody;
    const userId = rawUserId || DEFAULT_USER_ID;

    console.log(`[DEBUG] Request: useRag=${useRag}, message="${message.substring(0, 50)}..."`);

    let currentSessionId = sessionId || undefined;
    let conversationLength = 0;

    // Step 1: Get or create session (do NOT save user message yet — we fetch history first)
    try {
      const session = await getOrCreateSession(userId, currentSessionId, mode as ChatMode);
      currentSessionId = session.id;

      const messageCount = await getSessionMessageCount(session.id);
      conversationLength = messageCount;

      if (messageCount <= 0) {
        const title = await generateSessionTitle(message);
        await updateSession(session.id, { title, mode: mode as ChatMode });
      }
    } catch (e) {
      console.error("[Chat] Session error:", e);
    }

    const academicContext = parseAcademicContext(message);

    // === Agent Router: detect tool intent and execute if matched ===
    let toolResult: ToolResult | null = null;
    try {
      toolResult = await detectAndExecuteTool(message, userId, academicContext);
      if (toolResult) {
        console.log(`[Chat] Agent Router triggered tool: ${toolResult.tool} (${toolResult.label})`);
      }
    } catch (routerError) {
      console.error("[Chat] Agent Router error (non-fatal):", routerError);
    }

    const config = getConfig();
    if (!config.apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    // === DEBUG: API Configuration ===
    console.log("[DEBUG] Selected API Configuration:");
    console.log("- Provider:", config.apiKey === process.env.GROQ_API_KEY ? "GROQ" : "OpenAI");
    console.log("- Base URL:", config.baseUrl);
    console.log("- Chat Model:", config.model);
    console.log("- Embedding Model:", config.embeddingModel);

    // === DEBUG: Supabase Document Check ===
    console.log("[DEBUG] Checking Supabase Documents...");
    const documents = await getDocumentsFromSupabase();
    const hasDocuments = documents.length > 0;
    const vectorStoreStats = getStats();

    console.log(`[DEBUG] Document Results:`);
    console.log(`- Documents in Supabase: ${documents.length}`);
    console.log(`- Has Documents: ${hasDocuments}`);
    console.log(`- Vector Store Stats:`, vectorStoreStats);

    if (documents.length > 0) {
      console.log("[DEBUG] Document Names:", documents.slice(0, 5).map(d => d.name || 'Unnamed'));
      if (documents.length > 5) console.log(`... and ${documents.length - 5} more documents`);
    } else {
      console.log("⚠️ [DEBUG] NO DOCUMENTS FOUND in Supabase!");
    }

    console.log(`[Chat] RAG mode: ${useRag}, hasDocuments: ${hasDocuments}, docs:`, documents.length, 'stats:', vectorStoreStats);

    let retrievedContext: string | null = null;
    let sources: Source[] = [];
    let retrievalMetadata: RetrievalMetadata | undefined;

    // Always attempt RAG retrieval when useRag is true
    // The vector store will fetch from Supabase if configured
    if (useRag) {
      console.log("[DEBUG] === RAG RETRIEVAL PROCESS ===");
      try {
        // === DEBUG: Embedding Generation ===
        console.log("[DEBUG] Generating embedding for query...");
        const embeddingConfig = {
          apiKey: config.embeddingApiKey || config.apiKey,
          baseUrl: config.embeddingBaseUrl,
          model: config.embeddingModel,
        };
        console.log("[DEBUG] Embedding Config:", embeddingConfig);

        const queryEmbedding = await generateEmbedding(message, embeddingConfig);
        console.log("[DEBUG] ✓ Embedding generated successfully, length:", queryEmbedding?.length || 'unknown');

        // === DEBUG: Context Retrieval ===
        console.log("[DEBUG] Retrieving context with config:", DEFAULT_RAG_CONFIG);
        const retrievalResult = await retrieveContext(message, queryEmbedding, config.embeddingApiKey || config.apiKey, DEFAULT_RAG_CONFIG);

        retrievedContext = retrievalResult.context || null;
        sources = retrievalResult.sources;

        // === DEBUG: Retrieval Results ===
        console.log("[DEBUG] Retrieval Results:");
        console.log("- Retrieved Context Length:", retrievedContext?.length || 0);
        console.log("- Sources Found:", sources.length);
        console.log("- Sources:", sources.map(s => `${s.documentName} (${(s.score * 100).toFixed(1)}%)`));

        if (retrievedContext) {
          console.log("- Context Preview:", retrievedContext.substring(0, 200) + "...");
        } else {
          console.log("❌ [DEBUG] NO CONTEXT RETRIEVED!");
        }

        retrievalMetadata = {
          retrieved: sources.length > 0,
          sourceCount: sources.length,
          sources: sources,
          retrievalTime: Date.now() - startTime,
        };

        console.log(`[Chat] RAG retrieval: ${sources.length} sources found`);
        if (sources.length > 0) {
          console.log(`[Chat] Sources:`, sources.map(s => s.documentName).join(', '));
        } else {
          console.log("⚠️ [Chat] NO SOURCES FOUND during retrieval!");
        }
      } catch (ragError) {
        console.error("❌ [DEBUG] RAG ERROR:", ragError);
        console.error("- Error message:", ragError instanceof Error ? ragError.message : 'Unknown error');
        console.error("- Error stack:", ragError instanceof Error ? ragError.stack : 'No stack trace');

        retrievalMetadata = {
          retrieved: false,
          sourceCount: 0,
          sources: [],
          retrievalTime: Date.now() - startTime,
        };
      }
    } else {
      console.log("[DEBUG] RAG disabled (useRag=false)");
    }

    // Fetch user profile for Long-Term Memory (from JSON file + Supabase)
    let userProfile: UserProfile | null = null;
    let jsonProfile = null;
    try {
      console.log("[DEBUG] === USER PROFILE LOADING ===");
      // Load from JSON file (persistent memory)
      jsonProfile = getUserProfile(userId);
      console.log("[DEBUG] JSON Profile:", jsonProfile ? "✓ Found" : "❌ Not found");

      // Also get from Supabase for additional data
      const profile = await getStudentProfile(userId);
      const weakAreas = await getWeakAreas(userId);
      const strongAreas = await getStrongAreas(userId);

      console.log("[DEBUG] Supabase Profile:", profile ? "✓ Found" : "❌ Not found");
      console.log("[DEBUG] Weak Areas:", weakAreas ? `✓ Found (${weakAreas.length})` : "❌ Not found");
      console.log("[DEBUG] Strong Areas:", strongAreas ? `✓ Found (${strongAreas.length})` : "❌ Not found");

      // Merge JSON profile with Supabase profile (JSON takes priority for name/university)
      userProfile = {
        name: jsonProfile?.name || (profile as any)?.name,
        university: jsonProfile?.university || (profile as any)?.university || academicContext?.university || undefined,
        interests: jsonProfile?.interests || (profile as any)?.learningPatterns?.difficultConcepts || undefined,
        weakAreas: weakAreas || undefined,
      };

      console.log("[DEBUG] Final User Profile:", JSON.stringify(userProfile));
    } catch (e) {
      console.error("❌ [DEBUG] Profile error:", e);
    }

    const systemPrompt = buildSystemPrompt(
      mode,
      retrievedContext,
      sources,
      userProfile,
      academicContext,
      null,
      null,
      toolResult?.context ?? null
    );

    console.log('[Chat] Building prompt with userProfile:', JSON.stringify(userProfile));

    // Step 2: Fetch conversation history BEFORE saving the new user message
    // This prevents the current message from appearing twice
    let conversationHistory: Message[] = [];
    if (currentSessionId) {
      try {
        const historyMessages = await getConversationContext(currentSessionId, MAX_CHAT_HISTORY_MESSAGES);
        conversationHistory = historyMessages
          .filter(msg => msg.role !== 'system') // exclude system messages from history
          .map(msg => ({
            role: msg.role as "user" | "assistant" | "system",
            content: msg.content,
          }));
      } catch (e) {
        console.error("[Chat] History error:", e);
      }
    }

    // Step 3: NOW save the user message to DB (after fetching history)
    if (currentSessionId) {
      try {
        await addMessage(currentSessionId, "user", message);
      } catch (e) {
        console.error("[Chat] Save user message error:", e);
      }
    }

    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: message },
    ];

    // === DEBUG: Final Request ===
    console.log("[DEBUG] === CHAT COMPLETION REQUEST ===");
    console.log("- System prompt length:", systemPrompt.length);
    console.log("- Conversation history length:", conversationHistory.length);
    console.log("- Total messages:", messages.length);
    console.log("- Has retrieved context:", !!retrievedContext);
    console.log("- Retrieved context in prompt:", systemPrompt.includes("The following content was retrieved"));

    // ---- LLM call with Groq → OpenRouter fallback ----
    let chatResponse: Response | null = null;
    let usedProvider = "groq";

    try {
      // 1) Try Groq first
      chatResponse = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: 0.55,
          max_tokens: 2000,
          top_p: 0.85,
          frequency_penalty: 0.3,
          presence_penalty: 0.2,
        }),
      });

      // 2) If Groq rate-limited (429/402/403), try OpenRouter free models (supports multiple keys)
      if (!chatResponse.ok && [429, 402, 403].includes(chatResponse.status)) {
        const groqErr = await chatResponse.json().catch(() => ({}));
        console.warn(`[Chat] Groq rate-limited (${chatResponse.status}): ${groqErr.error?.message || "unknown"}. Trying OpenRouter...`);

        const openrouterKeys = [
          process.env.OPENROUTER_API_KEY,
          process.env.OPENROUTER_API_KEY_SECOND,
        ].filter(Boolean);

        if (openrouterKeys.length) {
          const fallbackModels = (
            process.env.OPENROUTER_MODELS ||
            "meta-llama/llama-3.3-70b-instruct:free,google/gemma-3-27b-it:free,mistralai/mistral-small-3.1-24b-instruct:free,qwen/qwen3-coder:free,nvidia/nemotron-nano-9b-v2:free"
          )
            .split(",")
            .map((m) => m.trim())
            .filter(Boolean)
            .filter((m) => m.toLowerCase().includes(":free"));

          let openRouterSucceeded = false;

          for (const openrouterKey of openrouterKeys) {
            for (const fallbackModel of fallbackModels) {
              try {
                console.log(`[Chat] Trying OpenRouter model: ${fallbackModel} with provided key`);
                const orResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${openrouterKey}`,
                    "HTTP-Referer": "http://localhost:3000",
                    "X-Title": "AI Academic Chat",
                  },
                  body: JSON.stringify({
                    model: fallbackModel,
                    messages,
                    temperature: 0.55,
                    max_tokens: 2000,
                    top_p: 0.85,
                  }),
                });

                if (orResponse.ok) {
                  chatResponse = orResponse;
                  usedProvider = `openrouter/${fallbackModel}`;
                  openRouterSucceeded = true;
                  console.log(`[Chat] ✓ OpenRouter success with ${fallbackModel}`);
                  break;
                }

                const status = orResponse.status;
                if ([404, 429, 402, 403].includes(status)) {
                  console.warn(`[Chat] OpenRouter ${fallbackModel} returned ${status}, trying next model or key...`);
                  // If rate-limited/billing, jump to next key instead of hammering the same one
                  if ([429, 402, 403].includes(status)) break;
                  continue;
                }
              } catch (orErr) {
                console.warn(`[Chat] OpenRouter ${fallbackModel} error:`, orErr);
                continue;
              }
            }

            if (openRouterSucceeded) break; // stop trying more keys
          }
        }
      }
    } catch (fetchErr) {
      console.error("[Chat] LLM request error:", fetchErr);
      const msgText = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      const errorMsg = `[${usedProvider}] LLM request failed: ${msgText}`;
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }

    if (!chatResponse.ok) {
      const errorData = await chatResponse.json().catch(() => ({}));
      const baseMsg = errorData.error?.message || chatResponse.statusText || "AI request failed";
      const errorMsg = `[${usedProvider}] ${baseMsg} (status ${chatResponse.status})`;
      console.error("❌ [DEBUG] Chat API Error:", errorMsg);
      console.error("- Status:", chatResponse.status, chatResponse.statusText);
      console.error("- Provider:", usedProvider);
      console.error("- Response:", errorData);
      return NextResponse.json({ error: errorMsg }, { status: chatResponse.status });
    }

    console.log(`[Chat] Response from provider: ${usedProvider}`);

    const responseData = await chatResponse.json();
    let assistantMessage = responseData.choices?.[0]?.message?.content ||
      "I couldn't generate a response. Please try again.";

    assistantMessage = assistantMessage.trim();

    // === DEBUG: Response Results ===
    console.log("[DEBUG] === FINAL RESULTS ===");
    console.log("- Assistant message length:", assistantMessage.length);
    console.log("- Has documents:", hasDocuments);
    console.log("- Sources retrieved:", sources.length);
    console.log("- Total processing time:", Date.now() - startTime, "ms");

    if (currentSessionId) {
      try {
        await addMessage(currentSessionId, "assistant", assistantMessage);
      } catch (e) {
        console.error("[Chat] Save error:", e);
      }
    }

    // Auto-update user profile from conversation (JSON file persistence)
    try {
      console.log('[Chat] Processing message for facts:', message);
      const extractedFacts = extractFactsFromMessage(message);
      console.log('[Chat] Extracted facts:', extractedFacts);

      if (Object.keys(extractedFacts).length > 0) {
        const currentProfile = getUserProfile(userId);
        console.log('[Chat] Current profile:', currentProfile);

        const updatedProfile = updateUserProfile(userId, {
          ...currentProfile,
          ...extractedFacts,
        });
        console.log('[Chat] Updated profile:', updatedProfile);
      }
    } catch (e) {
      console.error("[Chat] Profile update error:", e);
    }

    const totalTime = Date.now() - startTime;

    console.log("[DEBUG] === RESPONSE SUMMARY ===");
    console.log("✓ Chat completed successfully");
    console.log("- Mode:", mode);
    console.log("- RAG enabled:", useRag);
    console.log("- Documents available:", hasDocuments);
    console.log("- Context retrieved:", !!retrievedContext);
    console.log("- Sources found:", sources.length);
    console.log("- Processing time:", totalTime, "ms");
    console.log("=====================================");

    return NextResponse.json({
      message: assistantMessage,
      mode,
      hasDocuments,
      retrieval: retrievalMetadata,
      academicContext: contextToMetadata(academicContext),
      sessionId: currentSessionId,
      ...(toolResult ? {
        toolResult: {
          tool: toolResult.tool,
          label: toolResult.label,
          emoji: toolResult.emoji,
          error: toolResult.error,
        }
      } : {}),
    });

  } catch (error) {
    console.error("❌ [DEBUG] CRITICAL ERROR:", error);
    console.error("- Error type:", error instanceof Error ? error.constructor.name : typeof error);
    console.error("- Error message:", error instanceof Error ? error.message : 'Unknown error');
    console.error("- Error stack:", error instanceof Error ? error.stack : 'No stack trace');

    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}

