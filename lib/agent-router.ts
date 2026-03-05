/**
 * Agent Router — Unified Tool Dispatch for Chat
 * 
 * Detects user intent from their message and dispatches to the
 * appropriate lib function (copilot-engine, pyq-analyzer, student-memory).
 * Returns structured results that get injected into the LLM's system prompt.
 * 
 * This module is purely ADDITIVE — it does not replace or modify any
 * existing functionality. If no tool intent is detected, it returns null
 * and the chat route proceeds with its normal RAG + LLM flow.
 */

import { runFullPipeline, searchSyllabus, parseSyllabus } from "./copilot-engine";
import { generateExamStrategy, isExamRelated } from "./pyq-analyzer";
import { getPYQStore } from "./pyq-store";
import { getWeakAreas, getStrongAreas, getLearningStats } from "./student-memory";
import type { AcademicContext } from "./context-engine";

// ============================================================================
// Types
// ============================================================================

export type ToolName =
    | "generate_roadmap"
    | "search_syllabus"
    | "analyze_pyq"
    | "get_learning_profile"
    | "build_exam_prompt"
    | "get_daily_tasks"
    | "eli5"
    | "none";

export interface ToolResult {
    tool: ToolName;
    label: string;       // Human-readable badge label for the UI
    emoji: string;       // Emoji for the badge
    context: string;     // Text injected into the LLM system prompt
    data?: unknown;      // Raw structured data (optional, for frontend rendering)
    error?: string;      // If the tool execution failed
}

// ============================================================================
// Intent Detection — Keyword-based (no extra LLM call)
// ============================================================================

interface DetectedIntent {
    tool: ToolName;
    /** The cleaned subject/query extracted from the message */
    extractedQuery: string;
}

const ROADMAP_PATTERNS = [
    /(?:create|make|generate|build|give\s+me)\s+(?:a\s+)?(?:study\s+)?(?:plan|roadmap|schedule|timetable)/i,
    /(?:how\s+should\s+i\s+study|plan\s+my\s+study|study\s+strategy)\s+(?:for\s+)?/i,
    /(?:prepare\s+for|get\s+ready\s+for)\s+(?:my\s+)?(?:\w+\s+)?(?:exam|final|midterm|end\s*sem)/i,
];

const SYLLABUS_PATTERNS = [
    /(?:what(?:'s|\s+is)\s+(?:the\s+)?syllabus|show\s+(?:me\s+)?(?:the\s+)?syllabus|syllabus\s+(?:for|of))/i,
    /(?:what\s+(?:topics|units|chapters)\s+(?:are|do)\s+(?:there|we\s+have|i\s+need))/i,
    /(?:course\s+(?:outline|content|structure|curriculum))/i,
];

const PYQ_PATTERNS = [
    /(?:exam\s+pattern|question\s+pattern|pyq|past\s+year|previous\s+year|question\s+paper)/i,
    /(?:most\s+(?:asked|important|frequent)|frequently\s+asked|high\s+weightage)/i,
    /(?:marks\s+distribution|marks\s+weightage|important\s+(?:topics|units)\s+for\s+exam)/i,
];

const PROFILE_PATTERNS = [
    /(?:what\s+(?:are\s+)?my\s+weak|my\s+(?:weak|strong)\s+(?:topics|areas|subjects|points))/i,
    /(?:my\s+(?:learning|study)\s+(?:stats|statistics|progress|profile))/i,
    /(?:where\s+(?:do\s+)?i\s+(?:need|have)\s+(?:to\s+)?improve|what\s+should\s+i\s+(?:focus|work)\s+on)/i,
    /(?:how\s+(?:am\s+i\s+doing|is\s+my\s+progress))/i,
];

const PROMPT_PATTERNS = [
    /(?:build|create|make|generate)\s+(?:a\s+)?(?:exam\s+)?prompt\s+(?:for\s+)?/i,
    /(?:give\s+me\s+a\s+)(?:exam\s+)?prompt\s+(?:for\s+)?/i,
];

const MENTOR_PATTERNS = [
    /(?:what\s+should\s+i\s+(?:do|study)\s+today)/i,
    /(?:my\s+(?:daily\s+)?tasks)/i,
    /(?:focus\s+session)/i,
    /(?:daily\s+mentor)/i,
];

const ELI5_PATTERNS = [
    /(?:eli5|explain\s+(?:like\s+i'm\s+5|simply|in\s+simple\s+terms))/i,
    /(?:what\s+is\s+this\s+simply|easy\s+explanation)/i,
];

function detectIntent(message: string): DetectedIntent {
    const msg = message.trim();

    // Check roadmap patterns
    for (const pattern of ROADMAP_PATTERNS) {
        if (pattern.test(msg)) {
            // Extract the subject query by removing the trigger phrase
            const cleaned = msg.replace(pattern, "").trim().replace(/^(for|about|in|on)\s+/i, "").trim();
            return { tool: "generate_roadmap", extractedQuery: cleaned || msg };
        }
    }

    // Check syllabus patterns
    for (const pattern of SYLLABUS_PATTERNS) {
        if (pattern.test(msg)) {
            const cleaned = msg.replace(pattern, "").trim().replace(/^(for|about|in|of|on)\s+/i, "").trim();
            return { tool: "search_syllabus", extractedQuery: cleaned || msg };
        }
    }

    // Check PYQ / exam patterns
    for (const pattern of PYQ_PATTERNS) {
        if (pattern.test(msg)) {
            const cleaned = msg.replace(pattern, "").trim().replace(/^(for|about|in|of|on)\s+/i, "").trim();
            return { tool: "analyze_pyq", extractedQuery: cleaned || msg };
        }
    }

    // Check prompt builder patterns
    for (const pattern of PROMPT_PATTERNS) {
        if (pattern.test(msg)) {
            const cleaned = msg.replace(pattern, "").trim().replace(/^(for|about|in|of|on)\s+/i, "").trim();
            return { tool: "build_exam_prompt", extractedQuery: cleaned || msg };
        }
    }

    // Check mentor daily tasks patterns
    for (const pattern of MENTOR_PATTERNS) {
        if (pattern.test(msg)) {
            return { tool: "get_daily_tasks", extractedQuery: msg };
        }
    }

    // Check ELI5 patterns
    for (const pattern of ELI5_PATTERNS) {
        if (pattern.test(msg)) {
            const cleaned = msg.replace(pattern, "").trim().replace(/^(for|about|in|of|on)\s+/i, "").trim();
            return { tool: "eli5", extractedQuery: cleaned || msg };
        }
    }

    return { tool: "none", extractedQuery: msg };
}

// ============================================================================
// Tool Executors
// ============================================================================

async function executeRoadmap(query: string): Promise<ToolResult> {
    try {
        console.log(`[AgentRouter] Executing generate_roadmap for: "${query}"`);
        const { syllabus, roadmap } = await runFullPipeline(query);

        // Build a concise text summary for the LLM to reference
        const unitSummaries = roadmap.units.map(u =>
            `Unit ${u.unitNumber}: ${u.title} (${u.topics.length} topics, ~${u.totalEstimatedMinutes} min)`
        ).join("\n");

        const scheduleSummary = roadmap.suggestedSchedule.slice(0, 7).map(s =>
            `${s.label}: ${s.type} (${s.estimatedMinutes} min)`
        ).join("\n");

        const context = [
            `TOOL RESULT — Study Roadmap Generated Successfully`,
            `Subject: ${syllabus.subject}`,
            `University: ${syllabus.university}`,
            `Semester: ${syllabus.semester}`,
            `Total Topics: ${syllabus.totalTopics}`,
            `Total Estimated Hours: ${roadmap.totalEstimatedHours}`,
            ``,
            `Units:`,
            unitSummaries,
            ``,
            `Suggested Schedule (first week):`,
            scheduleSummary,
            ``,
            `Revision Strategy: ${roadmap.revisionStrategy}`,
            ``,
            `INSTRUCTION: Present this roadmap to the student in a clear, organized format.`,
            `Include the unit breakdown, estimated times, and the suggested schedule.`,
            `Make it motivating and actionable. Use the data above — do NOT fabricate additional details.`,
        ].join("\n");

        return {
            tool: "generate_roadmap",
            label: "Study Roadmap Generated",
            emoji: "📊",
            context,
            data: { syllabus, roadmap },
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        console.error("[AgentRouter] Roadmap error:", errorMsg);
        return {
            tool: "generate_roadmap",
            label: "Roadmap Generation",
            emoji: "📊",
            context: `TOOL ERROR: Failed to generate study roadmap. Error: ${errorMsg}. Please apologize for the error and suggest the student try again with a more specific query like "DBMS, Semester 5, GTU".`,
            error: errorMsg,
        };
    }
}

async function executeSyllabus(query: string): Promise<ToolResult> {
    try {
        console.log(`[AgentRouter] Executing search_syllabus for: "${query}"`);
        const searchData = await searchSyllabus(query);
        const syllabus = await parseSyllabus(
            query,
            searchData.rawText || "",
            searchData.results,
            searchData.parsedQuery
        );

        const unitList = syllabus.units.map(u =>
            `Unit ${u.unitNumber}: ${u.title}\n  Topics: ${u.topics.map(t => t.name).join(", ")}`
        ).join("\n\n");

        const context = [
            `TOOL RESULT — Syllabus Found`,
            `Subject: ${syllabus.subject} ${syllabus.subjectCode ? `(${syllabus.subjectCode})` : ""}`,
            `University: ${syllabus.university}`,
            `Semester: ${syllabus.semester}`,
            `Total Topics: ${syllabus.totalTopics}`,
            ``,
            `Complete Syllabus:`,
            unitList,
            ``,
            `INSTRUCTION: Present this syllabus to the student clearly, organized by units.`,
            `Include all topics and subtopics. Make it scannable and well-structured.`,
        ].join("\n");

        return {
            tool: "search_syllabus",
            label: "Syllabus Found",
            emoji: "📚",
            context,
            data: syllabus,
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        console.error("[AgentRouter] Syllabus error:", errorMsg);
        return {
            tool: "search_syllabus",
            label: "Syllabus Search",
            emoji: "📚",
            context: `TOOL ERROR: Could not find syllabus. Error: ${errorMsg}. Ask the student to provide more details (e.g., subject name, university, semester).`,
            error: errorMsg,
        };
    }
}

async function executePYQAnalysis(query: string): Promise<ToolResult> {
    try {
        console.log(`[AgentRouter] Executing analyze_pyq for: "${query}"`);
        const store = getPYQStore();
        const strategy = await generateExamStrategy(store, query);

        if (!strategy || strategy.trim().length < 20) {
            return {
                tool: "analyze_pyq",
                label: "PYQ Analysis",
                emoji: "📈",
                context: `TOOL RESULT — No PYQ data available yet. No previous year questions have been uploaded or stored for this subject. Inform the student they can upload PYQ documents using the file upload feature, and the system will analyze exam patterns from them.`,
            };
        }

        return {
            tool: "analyze_pyq",
            label: "Exam Pattern Analysis",
            emoji: "📈",
            context: `TOOL RESULT — PYQ Analysis\n\n${strategy}\n\nINSTRUCTION: Present this exam analysis clearly. Highlight the most important topics and revision priorities.`,
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        console.error("[AgentRouter] PYQ error:", errorMsg);
        return {
            tool: "analyze_pyq",
            label: "PYQ Analysis",
            emoji: "📈",
            context: `TOOL ERROR: PYQ analysis failed. Error: ${errorMsg}. Let the student know that PYQ data may not be available yet.`,
            error: errorMsg,
        };
    }
}

async function executeLearningProfile(userId: string): Promise<ToolResult> {
    try {
        console.log(`[AgentRouter] Executing get_learning_profile for user: "${userId}"`);
        const [weakAreas, strongAreas, stats] = await Promise.all([
            getWeakAreas(userId),
            getStrongAreas(userId),
            getLearningStats(userId),
        ]);

        const hasData = stats.totalTopics > 0 || stats.totalInteractions > 0;

        if (!hasData) {
            return {
                tool: "get_learning_profile",
                label: "Learning Profile",
                emoji: "🧠",
                context: `TOOL RESULT — Learning Profile is Empty. The student hasn't interacted enough for the system to build a profile yet. Encourage them to ask more questions, and the system will automatically track their weak and strong areas over time.`,
            };
        }

        const context = [
            `TOOL RESULT — Student Learning Profile`,
            ``,
            `📊 Stats:`,
            `- Total Topics Studied: ${stats.totalTopics}`,
            `- Total Interactions: ${stats.totalInteractions}`,
            `- Average Confidence: ${(stats.averageConfidence * 100).toFixed(0)}%`,
            ``,
            `⚠️ Weak Areas (${weakAreas.length}): ${weakAreas.length > 0 ? weakAreas.join(", ") : "None identified yet"}`,
            `✅ Strong Areas (${strongAreas.length}): ${strongAreas.length > 0 ? strongAreas.join(", ") : "None identified yet"}`,
            ``,
            `INSTRUCTION: Present this profile warmly and constructively.`,
            `Acknowledge strengths, gently highlight weak areas, and suggest focusing on the weak topics.`,
            `If weak areas exist, suggest a study strategy for those specific topics.`,
        ].join("\n");

        return {
            tool: "get_learning_profile",
            label: "Learning Profile",
            emoji: "🧠",
            context,
            data: { weakAreas, strongAreas, stats },
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        console.error("[AgentRouter] Profile error:", errorMsg);
        return {
            tool: "get_learning_profile",
            label: "Learning Profile",
            emoji: "🧠",
            context: `TOOL ERROR: Could not load learning profile. Error: ${errorMsg}.`,
            error: errorMsg,
        };
    }
}

async function executePromptBuilder(query: string): Promise<ToolResult> {
    try {
        console.log(`[AgentRouter] Executing build_exam_prompt for: "${query}"`);

        // Simple logic extracted from sandbox/page.tsx for a generic exam prompt
        const prompt = `Give a concise concept refresh for ${query}. Format: list. Difficulty: medium. Include relevant examples. Limit to 5 sentences, bullet-only. Reveal hints first, then full answer. Provide a brief rubric-style critique for a student attempt. End with a one-line recap. Add 1 follow-up question.`;

        return {
            tool: "build_exam_prompt",
            label: "Exam Prompt Built",
            emoji: "🎯",
            context: `TOOL RESULT — I've built a specialized exam preparation prompt for: "${query}".\n\nGenerated Prompt:\n"${prompt}"\n\nINSTRUCTION: Tell the student you've built an optimized prompt for them. They can click "Use Prompt" to try it out immediately.`,
            data: {
                prompt,
                topic: query
            },
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        return {
            tool: "build_exam_prompt",
            label: "Prompt Builder",
            emoji: "🎯",
            context: `TOOL ERROR: Failed to build prompt. Error: ${errorMsg}`,
            error: errorMsg,
        };
    }
}

async function executeDailyTasks(userId: string): Promise<ToolResult> {
    try {
        console.log(`[AgentRouter] Executing get_daily_tasks for user: "${userId}"`);
        const { getDueReviews } = await import("./srs-engine");
        const dueReviews = await getDueReviews(userId);

        const context = [
            `TOOL RESULT — Daily Tasks Generated`,
            `The student has asked what they should do today.`,
            `You found ${dueReviews.length} topics due for spaced-repetition review.`,
            dueReviews.length > 0 ? `Topics due: ${dueReviews.map(r => r.topic_name).join(", ")}` : "",
            `INSTRUCTION: Act as a strict but encouraging daily study mentor.`,
            `Suggest they start with their due reviews, then move on to 1-2 new topics from their active roadmap.`,
            `Direct them to check the "Focus Session" panel on their Mentor Dashboard.`
        ].join("\n");

        return {
            tool: "get_daily_tasks",
            label: "Daily Plan Ready",
            emoji: "🎯",
            context,
            data: { dueReviews },
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        return {
            tool: "get_daily_tasks",
            label: "Daily Plan",
            emoji: "🎯",
            context: `TOOL ERROR: Could not get daily tasks. Error: ${errorMsg}`,
            error: errorMsg,
        };
    }
}

async function executeELI5(query: string): Promise<ToolResult> {
    try {
        console.log(`[AgentRouter] Executing eli5 for: "${query}"`);

        // We don't need highly complex logic here, just a system prompt instruction
        // The LLM will handle the simplification based on the context provided
        const context = [
            `TOOL RESULT — ELI5 Request for: "${query}"`,
            `INSTRUCTION: Explain this concept as if the student is 5 years old.`,
            `Use simple analogies, avoid technical jargon, and be very concise.`,
            `If the query refers to a specific document or recent topic, use that context.`,
        ].join("\n");

        return {
            tool: "eli5",
            label: "ELI5 Explanation",
            emoji: "👶",
            context,
            data: { topic: query },
        };
    } catch (error) {
        return {
            tool: "eli5",
            label: "ELI5",
            emoji: "👶",
            context: `TOOL ERROR: Failed to prepare ELI5 explanation.`,
        };
    }
}

// ============================================================================
// Main Export — Called from the Chat API Route
// ============================================================================

/**
 * Detect intent from the user's message and execute the appropriate tool.
 * Returns null if no tool intent was detected (normal chat flow continues).
 */
export async function detectAndExecuteTool(
    message: string,
    userId: string,
    academicContext?: AcademicContext | null
): Promise<ToolResult | null> {
    const { tool, extractedQuery } = detectIntent(message);

    if (tool === "none") {
        return null; // No tool detected — proceed with normal chat
    }

    console.log(`[AgentRouter] Detected tool: ${tool}, query: "${extractedQuery}"`);

    // Enrich the query with academic context if available
    let enrichedQuery = extractedQuery;
    if (academicContext) {
        const parts: string[] = [];
        if (academicContext.subject && !extractedQuery.toLowerCase().includes(academicContext.subject.toLowerCase())) {
            parts.push(academicContext.subject);
        }
        if (academicContext.university) {
            parts.push(academicContext.university);
        }
        // Only append extra context if the original query doesn't already have it
        if (parts.length > 0) {
            enrichedQuery = `${extractedQuery}, ${parts.join(", ")}`;
        }
    }

    switch (tool) {
        case "generate_roadmap":
            return executeRoadmap(enrichedQuery);
        case "search_syllabus":
            return executeSyllabus(enrichedQuery);
        case "analyze_pyq":
            return executePYQAnalysis(enrichedQuery);
        case "get_learning_profile":
            return executeLearningProfile(userId);
        case "build_exam_prompt":
            return executePromptBuilder(enrichedQuery);
        case "get_daily_tasks":
            return executeDailyTasks(userId);
        case "eli5":
            return executeELI5(enrichedQuery);
        default:
            return null;
    }
}
