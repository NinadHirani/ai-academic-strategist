/**
 * AI Academic Copilot — Shared Types
 * Defines all interfaces for the syllabus search, parsing, roadmap, and topic expansion pipeline.
 */

// ============================================================================
// Web Search
// ============================================================================

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: "tavily" | "serpapi" | "google";
}

export interface SyllabusSearchResponse {
  query: string;
  results: SearchResult[];
  syllabusUrl: string | null;
  rawText: string | null;
  error?: string;
}

// ============================================================================
// Syllabus Parsing
// ============================================================================

export interface SubTopic {
  name: string;
  description?: string;
}

export interface Topic {
  id: string;
  name: string;
  subtopics: SubTopic[];
}

export interface Unit {
  id: string;
  unitNumber: number;
  title: string;
  topics: Topic[];
}

export interface ParsedSyllabus {
  subject: string;
  subjectCode?: string;
  university: string;
  semester: string;
  units: Unit[];
  totalTopics: number;
  rawSource?: string;
}

// ============================================================================
// Study Roadmap
// ============================================================================

export type DifficultyLevel = "easy" | "medium" | "hard";
export type TopicStatus = "not-started" | "in-progress" | "completed" | "skipped";

export interface RoadmapTopic {
  id: string;
  unitId: string;
  name: string;
  subtopics: SubTopic[];
  difficulty: DifficultyLevel;
  prerequisites: string[];        // IDs of prerequisite topics
  estimatedMinutes: number;
  recommendedOrder: number;
  status: TopicStatus;
  revisionNotes?: string;
}

export interface RoadmapUnit {
  id: string;
  unitNumber: number;
  title: string;
  topics: RoadmapTopic[];
  totalEstimatedMinutes: number;
}

export interface StudyRoadmap {
  subject: string;
  university: string;
  semester: string;
  units: RoadmapUnit[];
  totalEstimatedHours: number;
  revisionStrategy: string;
  suggestedSchedule: ScheduleBlock[];
}

export interface ScheduleBlock {
  day: number;
  label: string;
  topicIds: string[];
  type: "study" | "revision" | "practice";
  estimatedMinutes: number;
}

// ============================================================================
// Topic Expansion (Deep Dive)
// ============================================================================

export interface WebResource {
  title: string;
  url: string;
  snippet: string;
  type: "article" | "video" | "playlist" | "academic" | "documentation";
  verified: boolean;
}

export interface TopicExpansion {
  topicId: string;
  topicName: string;
  conceptOverview: string;
  mathematicalExplanation?: string;
  examples: string[];
  pastYearPatterns: string;
  articles: WebResource[];
  youtubeResources: WebResource[];
  academicReferences: WebResource[];
  generatedAt: string;
}

// ============================================================================
// API Request / Response Shapes
// ============================================================================

export interface CopilotSearchRequest {
  query: string;    // e.g. "TOC, Semester 6, GTU"
}

export interface CopilotRoadmapRequest {
  syllabus: ParsedSyllabus;
}

export interface CopilotExpandRequest {
  topic: RoadmapTopic;
  subject: string;
  university: string;
}

export interface CopilotPipelineState {
  step: "idle" | "searching" | "parsing" | "roadmap" | "done" | "error";
  query: string;
  searchResults: SearchResult[];
  syllabus: ParsedSyllabus | null;
  roadmap: StudyRoadmap | null;
  expandedTopics: Record<string, TopicExpansion>;
  error?: string;
}
