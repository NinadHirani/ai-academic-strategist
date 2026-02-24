import { NextRequest, NextResponse } from "next/server";
import { retrieveContext, getDocuments, RAGConfig, getStats } from "@/lib/rag";
import { generateEmbedding } from "@/lib/embeddings";
import { parseAcademicContext, getContextForPrompt, AcademicContext } from "@/lib/context-engine";
import { getOrCreateSession, addMessage, getConversationContext, generateSessionTitle, updateSession, getSessionMessageCount, ChatMode } from "@/lib/chat-history";

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

interface AcademicContextMetadata {
  university: string | null;
  semester: number | null;
  subject: string | null;
  subjectCode: string | null;
  intent: string;
  confidence: number;
}

interface ChatResponse {
  message: string;
  mode: string;
  hasDocuments: boolean;
  retrieval?: RetrievalMetadata;
  academicContext?: AcademicContextMetadata;
  sessionId?: string;
  error?: string;
}

const DEFAULT_RAG_CONFIG: RAGConfig = {
  chunkSize: 800,
  chunkOverlap: 150,
  retrievalK: 5,
  similarityThreshold: 0.15,
};

const GROQ_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_USER_ID = "anonymous";
const MAX_CHAT_HISTORY_MESSAGES = 15;

// ============================================================================
// Humanized AI Output System
// ============================================================================

/**
 * Human-like Writing Style Guidelines
 * These instructions help generate natural, conversational responses
 */
const SYSTEM_RESPONSE_GOVERNANCE = `
SYSTEM RESPONSE GOVERNANCE

You are an analytical knowledge assistant. Your responses must follow strict structural, logical, and clarity rules.

GLOBAL BEHAVIOUR RULES
- Prioritize clarity, precision, and organization.
- Avoid filler, storytelling, or generic tutoring language.
- Do not produce unstructured paragraphs.
- Every response must have visible structure.
- Depth over verbosity. Be information-dense.

STRUCTURE RULES
- Segment explanations into labeled sections.
- Use headers for major conceptual divisions.
- Use bullet points for mechanisms, properties, and factors.
- Use numbered steps for sequences or procedures.
- Use Markdown tables ONLY when comparing concepts.
- Use Mermaid diagrams ONLY when visualizing processes/systems.
- Maintain formatting consistency.

DEFAULT EXPLANATION TEMPLATE (unless specified otherwise)

[Concept / Topic Name]

1. Core Definition  
2. Key Idea / Intuition  
3. Mechanism / How It Works  
4. Key Characteristics / Properties  
5. Variations / Types (if applicable)  
6. Practical Applications  
7. Limitations / Trade-offs (if relevant)  
8. Common Misconceptions  

COMPARATIVE MODE (Trigger Condition)
If multiple concepts are compared:
→ MUST use a Markdown table.

PROCESS VISUALIZATION MODE (Trigger Condition)
If explaining flows, cycles, hierarchies, interactions:
→ MUST include a Mermaid diagram.

QUALITY CONTROL RULES
- No vague statements.
- No redundant summaries.
- No recap sections unless explicitly requested.
- Maintain conceptual consistency.
- Avoid misleading oversimplification.

TONE
- Calm, intelligent, direct.
- Professional and readable.

FAILSAFE
If instructions conflict:
→ Prioritize structural clarity and logical accuracy.
`;
const HUMAN_WRITING_GUIDELINES = `WRITING STYLE:
- Write the way a knowledgeable, friendly human would explain things
- Use varied sentence lengths - mix short punchy sentences with longer flowing ones
- Start with the key insight first, then explain
- Never use phrases like "As an AI language model", "I am an AI", or "As of my knowledge"
- Avoid robotic transitions like "Furthermore", "Moreover", "Additionally", "In conclusion"
- Use natural connectors like "Actually", "So", "The thing is", "Here's the deal"
- Don't over-explain or state the obvious
- Sound like a knowledgeable tutor, not a textbook`;

const OUTPUT_FORMATTING = `FORMATTING:
- Use light formatting - <strong> for key terms, concepts students should remember
- Break up long walls of text with short paragraphs (2-4 sentences each)
- Use bullet points sparingly for steps or lists, but keep them concise
- When listing things, prefer running prose over heavy bullet lists
- Make code/examples clear with proper formatting
- If something is important, say it directly - don't soft-pedal with "perhaps" or "might"`;

const AI_PATTERNS_TO_AVOID = `AVOID THESE AI PATTERNS:
- Never start responses with "Sure!", "Certainly!", "Of course!" or similar fillers
- Don't use "I hope this helps!" or "Let me know if you need anything else!"
- Avoid "That's a great question!" as an opener
- Don't use phrases like "In this article/post/tutorial, we will..."
- Skip "It's worth noting that..." and "It's important to understand that..."
- Avoid starting every paragraph with a transition word
- Don't end with "Happy learning!" or "Keep studying!" - be genuine`;

const RESPONSE_TONE = `TONE:
- Conversational but knowledgeable - like a smart senior student explaining to a friend
- Confident when you know the answer - don't hedge unnecessarily
- When uncertain, be honest: "That's a bit outside my wheelhouse" or "I'm not 100% sure on that one"
- Show genuine interest in helping - but naturally, not performatively
- Match the student's energy - casual questions get casual answers, serious ones get serious treatment
- If the student asks something simple, don't be condescending
- Sometimes a direct short answer is better than a long explanation`;

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
- Make important formulas stand out visually`;

const CHECK_FOR_UNDERSTANDING = `CHECK FOR UNDERSTANDING:
- After longer explanations (2+ paragraphs), you MAY include a quick recap table if it genuinely helps retention
- The table should be simple: "Quick Recap" | "Practice Question"
- Skip the table for short answers, definitions, or simple questions
- If in doubt, skip the table - don't force it`;

const MODE_TONE_INSTRUCTIONS: Record<string, string> = {
  study: "Break concepts into digestible pieces. Use relatable examples. Check understanding as you go - ask 'does that make sense?' or 'got it?'",
  deepExplore: "Go deep but keep it flowing. Connect ideas naturally. Build on previous understanding. Show how things relate in the real world.",
  tutor: "Guide through questions - lead them to the answer rather than giving it. Use Socratic method naturally. Say 'what if we thought about it this way...'",
  review: "Be concise and action-oriented. Focus on what matters for exams. Give quick summaries, key formulas, common pitfalls. Quiz them at the end."
};

// ============================================================================
// Base System Prompt
// ============================================================================

const BASE_SYSTEM_PROMPT = `You are an expert Study Tutor. Your goal is to help students visualize and organize information.

You explain things clearly and naturally - the way a skilled teacher would in a one-on-one tutoring session. You're patient but don't over-explain. You use examples from real life when they make things clearer.

Your goal is to help students truly understand, not just memorize. When they struggle, you try different approaches. When they get it, you reinforce the understanding.

${HUMAN_WRITING_GUIDELINES}

${OUTPUT_FORMATTING}

${AI_PATTERNS_TO_AVOID}

${RESPONSE_TONE}

${COMPARATIVE_LEARNING}

${PROCESS_VISUALIZATION}

${MATHEMATICAL_PRECISION}

${SCANNABILITY}

${CHECK_FOR_UNDERSTANDING}`;

const MODE_INSTRUCTIONS: Record<string, string> = {
  study: "Break concepts into digestible pieces. Use relatable examples. Check understanding as you go.",
  deepExplore: "Go deep but keep it flowing. Connect ideas naturally. Build on previous understanding.",
  tutor: "Guide through questions - lead them to the answer rather than giving it outright. Use Socratic method.",
  review: "Be concise and action-oriented. Focus on what matters for exams. Give quick summaries."
};

const RAG_CONTEXT_TEMPLATE = `Reference Material:\n{sources}\n\n{context}`;
const IMPROVED_CONTEXT_INSTRUCTION = "Use the reference material to inform your answer.";
const NO_CONTEXT_INSTRUCTION = "No specific documents available. Use what you know to help.";

function buildSystemPrompt(
  mode: string,
  retrievedContext: string | null,
  sources: Source[],
  academicContext: AcademicContext | null,
  conversationLength: number
): string {
  const promptParts = [
    BASE_SYSTEM_PROMPT,
    "",
    MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.study,
    "",
  ];

  if (conversationLength > 0) {
    promptParts.push(`This is message ${conversationLength + 1} in our conversation.`);
  }

  if (academicContext && academicContext.confidence >= 0.4) {
    const contextString = getContextForPrompt(academicContext);
    if (contextString) {
      promptParts.push("", `Academic Context: ${contextString}`);
    }
  }

  if (retrievedContext && sources.length > 0) {
    const sourceList = sources.map((s, i) => 
      `${i + 1}. ${s.documentName}${s.chunkIndex !== undefined ? ` (Section ${s.chunkIndex + 1})` : ''}`
    ).join('\n');
    
    const contextSection = RAG_CONTEXT_TEMPLATE
      .replace("{sources}", sourceList)
      .replace("{context}", retrievedContext);
    
    promptParts.push("", contextSection);
    promptParts.push("", IMPROVED_CONTEXT_INSTRUCTION);
  } else {
    promptParts.push("", NO_CONTEXT_INSTRUCTION);
  }

  return promptParts.join("\n");
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

    let currentSessionId = sessionId || undefined;
    let conversationLength = 0;
    
    try {
      const session = await getOrCreateSession(userId, currentSessionId);
      currentSessionId = session.id;
      await addMessage(session.id, "user", message);
      
      const messageCount = await getSessionMessageCount(session.id);
      conversationLength = messageCount;
      
      if (messageCount <= 2) {
        const title = await generateSessionTitle(message);
        await updateSession(session.id, { title, mode: mode as ChatMode });
      }
    } catch (e) {
      console.error("[Chat] Session error:", e);
    }

    const academicContext = parseAcademicContext(message);

    const config = getConfig();
    if (!config.apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    const documents = getDocuments();
    const hasDocuments = documents.length > 0;
    const vectorStoreStats = getStats();

    let retrievedContext: string | null = null;
    let sources: Source[] = [];
    let retrievalMetadata: RetrievalMetadata | undefined;

    if (useRag && hasDocuments) {
      try {
        const queryEmbedding = await generateEmbedding(message, {
          apiKey: config.embeddingApiKey || config.apiKey,
          baseUrl: config.embeddingBaseUrl,
          model: config.embeddingModel,
        });

        const retrievalResult = await retrieveContext(message, queryEmbedding, config.embeddingApiKey || config.apiKey, DEFAULT_RAG_CONFIG);
        
        retrievedContext = retrievalResult.context || null;
        sources = retrievalResult.sources;

        retrievalMetadata = {
          retrieved: sources.length > 0,
          sourceCount: sources.length,
          sources: sources,
          retrievalTime: Date.now() - startTime,
        };
      } catch (ragError) {
        console.error("[Chat] RAG error:", ragError);
        retrievalMetadata = {
          retrieved: false,
          sourceCount: 0,
          sources: [],
          retrievalTime: Date.now() - startTime,
        };
      }
    }

    const systemPrompt = buildSystemPrompt(mode, retrievedContext, sources, academicContext, conversationLength);

    let conversationHistory: Message[] = [];
    if (currentSessionId) {
      try {
        const historyMessages = await getConversationContext(currentSessionId, MAX_CHAT_HISTORY_MESSAGES);
        conversationHistory = historyMessages.map(msg => ({
          role: msg.role as "user" | "assistant" | "system",
          content: msg.content,
        }));
      } catch (e) {
        console.error("[Chat] History error:", e);
      }
    }

    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: message },
    ];

    const chatResponse = await fetch(`${config.baseUrl}/chat/completions`, {
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

    if (!chatResponse.ok) {
      const errorData = await chatResponse.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || "AI request failed";
      console.error("[Chat] API Error:", errorMsg);
      return NextResponse.json({ error: errorMsg }, { status: chatResponse.status });
    }

    const responseData = await chatResponse.json();
    let assistantMessage = responseData.choices?.[0]?.message?.content ||
      "I couldn't generate a response. Please try again.";

    assistantMessage = assistantMessage.trim();

    if (currentSessionId) {
      try {
        await addMessage(currentSessionId, "assistant", assistantMessage);
      } catch (e) {
        console.error("[Chat] Save error:", e);
      }
    }

    const totalTime = Date.now() - startTime;

    return NextResponse.json({
      message: assistantMessage,
      mode,
      hasDocuments,
      retrieval: retrievalMetadata,
      academicContext: contextToMetadata(academicContext),
      sessionId: currentSessionId,
    });

  } catch (error) {
    console.error("[Chat] Error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}

