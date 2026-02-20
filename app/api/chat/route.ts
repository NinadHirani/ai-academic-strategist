import { NextRequest, NextResponse } from "next/server";
import { retrieveContext, getDocuments, RAGConfig } from "@/lib/rag";
import { generateEmbedding } from "@/lib/embeddings";
import { parseAcademicContext, getContextForPrompt, AcademicContext } from "@/lib/context-engine";
import { getPYQStore, seedSamplePYQs } from "@/lib/pyq-store";
import { isExamRelated, extractSubjectFromQuery, generateExamStrategy, generatePYQInsights } from "@/lib/pyq-analyzer";
import { analyzeWeakness, recordInteraction, getWeaknessPromptContext, getReinforcementTip, shouldProvideReinforcement } from "@/lib/weakness-analyzer";

// ============================================================================
// Types
// ============================================================================

interface ChatRequestBody {
  message: string;
  mode: "study" | "deepExplore";
  useRag?: boolean;
  userId?: string;
  confidenceLevel?: "high" | "medium" | "low";
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

// PYQ Insight types
interface PYQInsightData {
  hasInsights: boolean;
  isExamRelated: boolean;
  subject?: string;
  strategySummary?: string;
  topUnits?: { unit: string; count: number; percentage: number }[];
  revisionPriorities?: { topic: string; reason: string; suggestedMarks: number }[];
}

// Weakness tracking types
interface WeaknessData {
  tracked: boolean;
  isRepeated: boolean;
  needsReinforcement: boolean;
  reinforcementTip?: string | null;
  suggestedRevisions: string[];
}

interface ChatResponse {
  message: string;
  mode: string;
  hasDocuments: boolean;
  retrieval?: RetrievalMetadata;
  academicContext?: AcademicContextMetadata;
  pyqInsights?: PYQInsightData;
  weaknessData?: WeaknessData;
  error?: string;
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_RAG_CONFIG: RAGConfig = {
  chunkSize: 1000,
  chunkOverlap: 200,
  retrievalK: 5,
  similarityThreshold: 0.3,
};

const DEFAULT_MODEL = "gpt-3.5-turbo";
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_USER_ID = "anonymous";

// ============================================================================
// System Prompts - Clearly Separated
// ============================================================================

const BASE_SYSTEM_PROMPT = `You are an AI Academic Strategist assistant.`;

// Mode-specific instructions
const MODE_INSTRUCTIONS: Record<string, string> = {
  study: `You are in Study Mode. Your role is to help students learn effectively.
You specialize in:
- Flashcard generation
- Quiz creation
- Concept explanations
- Study planning
- Breaking down complex topics into digestible pieces

Be encouraging, clear, and educational in your responses.`,
  deepExplore: `You are in DeepExplore Mode. Your role is to provide deep, analytical, and exploratory academic responses.

When responding in DeepExplore Mode, you MUST use the following structured format with CLEARLY SEPARATED SECTIONS. Use markdown formatting with ## for main section headers.

## REQUIRED SECTIONS (use these exact headings):

## Concept Overview
Provide a comprehensive introduction to the topic. Define key terms and establish the foundational context.

## Key Principles
Break down the fundamental principles and core concepts. Use bullet points or numbered lists where appropriate.

## Related Topics
Explore connections to other topics in the subject area. Identify prerequisites and follow-up topics.

## Common Confusions
Address frequent misunderstandings and mistakes students make. Clarify misconceptions.

## Practical Applications
Show real-world applications and use cases. Include examples from industry or research.

## Exam Relevance
Highlight what's most important for exams. Identify likely exam questions and revision tips.

IMPORTANT:
- Use clear hierarchical headings (## for main sections)
- Each section should have substantial content
- Do NOT skip any section - all 6 must be present`,
};

// RAG context template
const RAG_CONTEXT_TEMPLATE = `## Retrieved Context from Documents
{sources}

---
## Context Content
{context}

// END OF RETRIEVED CONTEXT

When answering:
1. Prioritize information from the retrieved context
2. Clearly cite which document(s) your information comes from
3. If the context doesn't fully address the question, supplement with your knowledge`;

// Academic context template
const ACADEMIC_CONTEXT_TEMPLATE = `## Detected Academic Context
{detectedContext}

// Use this context to tailor your response appropriately.`;

// PYQ Exam Strategy template
const PYQ_STRATEGY_TEMPLATE = `## 📚 PYQ Exam Strategy Insights
Based on past year question analysis:

{strategy}

// Apply these insights to prioritize your preparation effectively.`;

// Weakness-aware template
const WEAKNESS_CONTEXT_TEMPLATE = `## Student Learning Profile
{weaknessInfo}

// Adapt your response to provide targeted help for weak areas.`;

// Fallback instruction when no context is found
const NO_CONTEXT_INSTRUCTION = `\n\nNote: No relevant documents have been uploaded yet. Answer based on your general knowledge.`;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build the complete system prompt with proper separation
 */
function buildSystemPrompt(
  mode: string,
  retrievedContext: string | null,
  sources: Source[],
  academicContext: AcademicContext | null,
  pyqStrategy: string | null,
  weaknessContext: string | null
): string {
  const basePrompt = BASE_SYSTEM_PROMPT;
  const modeInstructions = MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.study;

  const promptParts = [
    basePrompt,
    "",
    modeInstructions,
  ];

  // Add weakness context if available
  if (weaknessContext) {
    const weaknessSection = WEAKNESS_CONTEXT_TEMPLATE.replace("{weaknessInfo}", weaknessContext);
    promptParts.push("", weaknessSection);
  }

  // Add academic context if detected
  if (academicContext && academicContext.confidence >= 0.3) {
    const contextString = getContextForPrompt(academicContext);
    if (contextString) {
      const academicSection = ACADEMIC_CONTEXT_TEMPLATE.replace(
        "{detectedContext}",
        contextString
      );
      promptParts.push("", academicSection);
    }
  }

  // Add PYQ exam strategy if available
  if (pyqStrategy) {
    const pyqSection = PYQ_STRATEGY_TEMPLATE.replace("{strategy}", pyqStrategy);
    promptParts.push("", pyqSection);
  }

  // Add retrieved context if available
  if (retrievedContext && sources.length > 0) {
    const contextSection = RAG_CONTEXT_TEMPLATE
      .replace("{sources}", sources.map((s, i) => `[${i + 1}] ${s.documentName} (chunk ${s.chunkIndex + 1}, similarity: ${s.score.toFixed(3)})`).join("\n"))
      .replace("{context}", retrievedContext);
    
    promptParts.push("", contextSection);
  } else {
    promptParts.push("", NO_CONTEXT_INSTRUCTION);
  }

  return promptParts.join("\n");
}

/**
 * Validate and sanitize the request body
 */
function validateRequest(body: unknown): ChatRequestBody | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const { message, mode, useRag, userId, confidenceLevel } = body as Record<string, unknown>;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return null;
  }

  const validModes: Array<"study" | "deepExplore"> = ["study", "deepExplore"];
  const resolvedMode = validModes.includes(mode as "study" | "deepExplore") 
    ? mode as "study" | "deepExplore" 
    : "study";

  const validConfidenceLevels: Array<"high" | "medium" | "low"> = ["high", "medium", "low"];
  const resolvedConfidence = validConfidenceLevels.includes(confidenceLevel as "high" | "medium" | "low")
    ? confidenceLevel as "high" | "medium" | "low"
    : undefined;

  return {
    message: message.trim(),
    mode: resolvedMode,
    useRag: useRag === undefined ? true : Boolean(useRag),
    userId: typeof userId === "string" ? userId : DEFAULT_USER_ID,
    confidenceLevel: resolvedConfidence,
  };
}

/**
 * Get configuration from environment
 */
function getConfig() {
  // Check for Groq first (has priority), then fall back to OpenAI
  const groqApiKey = process.env.GROQ_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (groqApiKey) {
    return {
      apiKey: groqApiKey,
      baseUrl: "https://api.groq.com/openai/v1",
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      embeddingModel: "text-embedding-3-small",
      // Use OpenAI for embeddings since Groq doesn't support them
      embeddingApiKey: openaiApiKey || groqApiKey,
      embeddingBaseUrl: "https://api.openai.com/v1",
      provider: "groq" as const,
    };
  }
  
  return {
    apiKey: openaiApiKey,
    baseUrl: process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1",
    model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL,
    embeddingApiKey: openaiApiKey,
    embeddingBaseUrl: process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1",
    provider: "openai" as const,
  };
}

/**
 * Convert AcademicContext to metadata for API response
 */
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

/**
 * Initialize PYQ store with sample data if needed
 * Returns null in demo mode (no Supabase)
 */
async function initializePYQStore() {
  const store = getPYQStore();
  
  // Check if Supabase is available
  const stats = await store.getStats();
  
  // Only seed if Supabase is configured and no data exists
  if (stats.totalQuestions === 0 && store instanceof Function === false) {
    try {
      await seedSamplePYQs(store);
    } catch (error) {
      console.log('[PYQ Store] Running in demo mode, skipping seed');
    }
  }
  
  return store;
}

/**
 * Generate PYQ insights for the response
 */
async function getPYQInsightsForResponse(
  message: string,
  pyqStore: ReturnType<typeof getPYQStore>
): Promise<PYQInsightData> {
  const isExam = isExamRelated(message);
  
  if (!isExam) {
    return {
      hasInsights: false,
      isExamRelated: false,
    };
  }

  // In demo mode (no Supabase), return basic exam-related response
  try {
    const availableSubjects = await pyqStore.getSubjects();
    
    // If no subjects available, we're in demo mode
    if (availableSubjects.length === 0) {
      return {
        hasInsights: false,
        isExamRelated: true,
      };
    }
    
    const subjectFromQuery = extractSubjectFromQuery(message, availableSubjects);
    const subject = subjectFromQuery || academicContext?.subject || undefined;

    if (subject) {
      const insights = await generatePYQInsights(pyqStore, { subject });
      const strategy = await generateExamStrategy(pyqStore, subject);
      
      return {
        hasInsights: true,
        isExamRelated: true,
        subject,
        strategySummary: strategy,
        topUnits: insights.mostFrequentUnits.map(u => ({
          unit: u.unit,
          count: u.count,
          percentage: u.percentage,
        })),
        revisionPriorities: insights.revisionPriorities.map(p => ({
          topic: p.topic,
          reason: p.reason,
          suggestedMarks: p.suggestedMarks,
        })),
      };
    }
  } catch (error) {
    console.log('[PYQ Store] Running in demo mode');
  }

  return {
    hasInsights: false,
    isExamRelated: true,
  };
}

// Store reference for subject extraction
let academicContext: AcademicContext | null = null;

// ============================================================================
// Main POST Handler
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<ChatResponse | { error: string }>> {
  const startTime = Date.now();

  try {
    // -------------------------------------------------------------------------
    // Step 1: Parse and validate request
    // -------------------------------------------------------------------------
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const validatedBody = validateRequest(body);
    if (!validatedBody) {
      return NextResponse.json(
        { error: "Invalid request: message is required" },
        { status: 400 }
      );
    }

    const { message, mode, useRag, userId: rawUserId, confidenceLevel } = validatedBody;
    const userId = rawUserId || DEFAULT_USER_ID;

    // -------------------------------------------------------------------------
    // Step 2: Analyze weakness based on user history
    // -------------------------------------------------------------------------
    const weaknessAnalysis = await analyzeWeakness(userId, message);
    const needsReinforcement = await shouldProvideReinforcement(userId, message);
    const reinforcementTip = needsReinforcement ? await getReinforcementTip(userId) : null;
    
    const weaknessData: WeaknessData = {
      tracked: true,
      isRepeated: weaknessAnalysis.isRepeated,
      needsReinforcement,
      reinforcementTip,
      suggestedRevisions: weaknessAnalysis.revisionSuggestions,
    };

    console.log("[Chat API] Weakness analysis:", {
      isRepeated: weaknessAnalysis.isRepeated,
      needsReinforcement,
      detectedTopics: weaknessAnalysis.detectedTopics,
    });

    // -------------------------------------------------------------------------
    // Step 3: Detect Academic Context from user query
    // -------------------------------------------------------------------------
    academicContext = parseAcademicContext(message);
    console.log("[Chat API] Detected academic context:", {
      university: academicContext.university,
      semester: academicContext.semester,
      subject: academicContext.subject,
      intent: academicContext.intent,
      confidence: academicContext.confidence,
    });

    // -------------------------------------------------------------------------
    // Step 4: Get configuration
    // -------------------------------------------------------------------------
    const config = getConfig();

    if (!config.apiKey) {
      console.error("[Chat API] No API key configured (checked OPENAI_API_KEY and GROQ_API_KEY)");
      return NextResponse.json(
        { error: "API key not configured. Please set GROQ_API_KEY or OPENAI_API_KEY in .env.local" },
        { status: 500 }
      );
    }

    // -------------------------------------------------------------------------
    // Step 5: Initialize PYQ store and check for exam-related queries
    // -------------------------------------------------------------------------
    const pyqStore = await initializePYQStore();
    const pyqInsights = await getPYQInsightsForResponse(message, pyqStore);
    
    let pyqStrategy: string | null = null;
    if (pyqInsights.hasInsights && pyqInsights.strategySummary) {
      pyqStrategy = pyqInsights.strategySummary;
    }

    // -------------------------------------------------------------------------
    // Step 6: Check for available documents
    // -------------------------------------------------------------------------
    const documents = getDocuments();
    const hasDocuments = documents.length > 0;

    // -------------------------------------------------------------------------
    // Step 7: Perform RAG if enabled and documents available
    // -------------------------------------------------------------------------
    let retrievedContext: string | null = null;
    let sources: Source[] = [];
    let retrievalMetadata: RetrievalMetadata | undefined;

    if (useRag && hasDocuments) {
      try {
        // Use separate embedding API configuration
        const embeddingApiKey = config.embeddingApiKey || config.apiKey;
        const embeddingBaseUrl = config.embeddingBaseUrl || config.baseUrl;
        
        const queryEmbedding = await generateEmbedding(message, {
          apiKey: embeddingApiKey,
          baseUrl: embeddingBaseUrl,
          model: config.embeddingModel,
        });

        const retrievalResult = await retrieveContext(
          message,
          queryEmbedding,
          embeddingApiKey,
          DEFAULT_RAG_CONFIG
        );

        retrievedContext = retrievalResult.context || null;
        sources = retrievalResult.sources;

        retrievalMetadata = {
          retrieved: sources.length > 0,
          sourceCount: sources.length,
          sources: sources,
          retrievalTime: Date.now() - startTime,
        };
      } catch (ragError) {
        console.error("[Chat API] RAG retrieval error:", ragError);
        retrievalMetadata = {
          retrieved: false,
          sourceCount: 0,
          sources: [],
          retrievalTime: Date.now() - startTime,
        };
      }
    }

    // -------------------------------------------------------------------------
    // Step 8: Get weakness context for prompt
    // -------------------------------------------------------------------------
    const weaknessContext = await getWeaknessPromptContext(userId);

    // -------------------------------------------------------------------------
    // Step 9: Build the complete system prompt with all contexts
    // -------------------------------------------------------------------------
    const systemPrompt = buildSystemPrompt(
      mode, 
      retrievedContext, 
      sources, 
      academicContext,
      pyqStrategy,
      weaknessContext
    );

    // -------------------------------------------------------------------------
    // Step 10: Prepare messages for the LLM
    // -------------------------------------------------------------------------
    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ];

    // -------------------------------------------------------------------------
    // Step 11: Call OpenAI-compatible Chat API
    // -------------------------------------------------------------------------
    const chatResponse = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    // -------------------------------------------------------------------------
    // Step 12: Handle API errors
    // -------------------------------------------------------------------------
    if (!chatResponse.ok) {
      let errorMessage = "Failed to get response from AI";
      
      try {
        const errorData = await chatResponse.json();
        errorMessage = errorData.error?.message || errorData.message || errorMessage;
        console.error("[Chat API] OpenAI API error:", errorData);
      } catch {
        errorMessage = chatResponse.statusText || errorMessage;
      }

      return NextResponse.json(
        { error: `AI request failed: ${errorMessage}` },
        { status: chatResponse.status }
      );
    }

    // -------------------------------------------------------------------------
    // Step 13: Extract response and record interaction
    // -------------------------------------------------------------------------
    const responseData = await chatResponse.json();
    let assistantMessage = responseData.choices?.[0]?.message?.content ||
      "I apologize, but I couldn't generate a response. Please try again.";

    // Add reinforcement tip if needed
    if (reinforcementTip && mode === "study") {
      assistantMessage = `${reinforcementTip}\n\n---\n\n${assistantMessage}`;
    }

    // Record the interaction for weakness tracking
    try {
      await recordInteraction(userId, message, assistantMessage as string, confidenceLevel);
      console.log("[Chat API] Interaction recorded for user:", userId);
    } catch (recordError) {
      console.error("[Chat API] Failed to record interaction:", recordError);
    }

    // -------------------------------------------------------------------------
    // Step 14: Return the response
    // -------------------------------------------------------------------------
    return NextResponse.json({
      message: assistantMessage,
      mode,
      hasDocuments,
      retrieval: retrievalMetadata,
      academicContext: contextToMetadata(academicContext),
      pyqInsights,
      weaknessData,
    });

  } catch (error) {
    console.error("[Chat API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}

