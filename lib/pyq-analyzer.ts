/**
 * PYQ (Past Year Question) Intelligence Engine - Analysis Utilities
 * Analyzes PYQ patterns to generate strategic insights for exam preparation
 */

import {
  PYQ,
  PYQStore,
  UnitFrequency,
  TopicFrequency,
  YearAnalysis,
  PYQInsights,
  RevisionPriority,
  PYQStats,
  QuestionType,
} from "./pyq-store";

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG = {
  topUnitsCount: 5,
  topTopicsCount: 10,
  priorityThreshold: 0.6,
  recentYearWeight: 0.4,
  frequencyWeight: 0.3,
  marksWeight: 0.3,
};

// ============================================================================
// Analysis Functions
// ============================================================================

/**
 * Analyze unit-wise frequency from questions
 */
export async function analyzeUnits(store: PYQStore, filters?: { subject?: string; year?: number }): Promise<UnitFrequency[]> {
  const questions = filters 
    ? await store.getFiltered({ ...filters })
    : await store.getAll();

  const unitMap = new Map<string, { count: number; totalMarks: number; years: Set<number> }>();

  questions.forEach((q: PYQ) => {
    const key = q.unit;
    const existing = unitMap.get(key) || { count: 0, totalMarks: 0, years: new Set<number>() };
    existing.count++;
    existing.totalMarks += q.marks;
    existing.years.add(q.year);
    unitMap.set(key, existing);
  });

  const totalQuestions = questions.length;
  
  return Array.from(unitMap.entries())
    .map(([unit, data]) => ({
      unit,
      count: data.count,
      totalMarks: data.totalMarks,
      percentage: (data.count / totalQuestions) * 100,
      years: Array.from(data.years).sort((a, b) => a - b),
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Analyze topic-wise frequency from questions
 */
export async function analyzeTopics(store: PYQStore, filters?: { subject?: string; unit?: string; year?: number }): Promise<TopicFrequency[]> {
  const questions = filters
    ? await store.getFiltered({ ...filters })
    : await store.getAll();

  const topicMap = new Map<string, { 
    topic: string; 
    unit: string;
    count: number; 
    totalMarks: number; 
    years: Set<number> 
  }>();

  questions.forEach((q: PYQ) => {
    const key = `${q.topic}-${q.unit}`;
    const existing = topicMap.get(key) || { 
      topic: q.topic, 
      unit: q.unit,
      count: 0, 
      totalMarks: 0, 
      years: new Set<number>() 
    };
    existing.count++;
    existing.totalMarks += q.marks;
    existing.years.add(q.year);
    topicMap.set(key, existing);
  });

  return Array.from(topicMap.entries())
    .map(([, data]) => ({
      topic: data.topic,
      unit: data.unit,
      count: data.count,
      totalMarks: data.totalMarks,
      averageMarks: data.totalMarks / data.count,
      years: Array.from(data.years).sort((a, b) => a - b),
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Analyze year-wise patterns
 */
export async function analyzeYears(store: PYQStore, filters?: { subject?: string; unit?: string }): Promise<YearAnalysis[]> {
  const questions = filters
    ? await store.getFiltered({ ...filters })
    : await store.getAll();

  const yearMap = new Map<number, { 
    questions: PYQ[]; 
    unitDistribution: Map<string, number> 
  }>();

  questions.forEach((q: PYQ) => {
    const existing = yearMap.get(q.year) || { 
      questions: [], 
      unitDistribution: new Map<string, number>() 
    };
    existing.questions.push(q);
    const unitCount = existing.unitDistribution.get(q.unit) || 0;
    existing.unitDistribution.set(q.unit, unitCount + 1);
    yearMap.set(q.year, existing);
  });

  return Array.from(yearMap.entries())
    .map(([year, data]) => ({
      year,
      totalQuestions: data.questions.length,
      totalMarks: data.questions.reduce((sum, q) => sum + q.marks, 0),
      unitDistribution: Object.fromEntries(data.unitDistribution),
      averageMarksPerQuestion: data.questions.reduce((sum, q) => sum + q.marks, 0) / data.questions.length,
    }))
    .sort((a, b) => b.year - a.year);
}

/**
 * Analyze question type distribution
 */
export async function analyzeQuestionTypes(store: PYQStore, filters?: { subject?: string }): Promise<Record<QuestionType, number>> {
  const questions = filters
    ? await store.getFiltered({ ...filters })
    : await store.getAll();

  const typeCount: Record<QuestionType, number> = {
    short_answer: 0,
    long_answer: 0,
    mcq: 0,
    very_short: 0,
    case_study: 0,
    theory: 0,
  };

  questions.forEach((q: PYQ) => {
    typeCount[q.questionType]++;
  });

  return typeCount;
}

/**
 * Analyze marks distribution
 */
export async function analyzeMarksDistribution(store: PYQStore, filters?: { subject?: string }): Promise<{
  range: string;
  count: number;
  percentage: number;
}[]> {
  const questions = filters
    ? await store.getFiltered({ ...filters })
    : await store.getAll();

  const ranges = [
    { range: "1-5 marks", min: 1, max: 5 },
    { range: "6-10 marks", min: 6, max: 10 },
    { range: "11-15 marks", min: 11, max: 15 },
    { range: "16+ marks", min: 16, max: Infinity },
  ];

  const total = questions.length;
  
  return ranges.map(({ range, min, max }) => {
    const count = questions.filter((q: PYQ) => q.marks >= min && q.marks <= max).length;
    return {
      range,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    };
  });
}

// ============================================================================
// Priority Calculation
// ============================================================================

/**
 * Calculate priority score for revision
 * Combines: frequency, recency, marks weightage
 */
async function calculatePriorityScore(
  topic: string,
  unit: string,
  store: PYQStore,
  config: typeof DEFAULT_CONFIG
): Promise<number> {
  const allQuestions = await store.getAll();
  const years = await store.getYears();
  const currentYear = Math.max(...years);
  
  // Calculate frequency score
  const topicQuestions = allQuestions.filter(
    (q: PYQ) => q.topic.toLowerCase() === topic.toLowerCase()
  );
  const frequencyScore = topicQuestions.length / allQuestions.length;

  // Calculate recency score (more recent = higher score)
  const recentQuestions = topicQuestions.filter((q: PYQ) => q.year >= currentYear - 2);
  const recencyScore = recentQuestions.length / topicQuestions.length;

  // Calculate marks weightage
  const totalMarks = topicQuestions.reduce((sum, q) => sum + q.marks, 0);
  const allTotalMarks = allQuestions.reduce((sum, q) => sum + q.marks, 0);
  const marksScore = allTotalMarks > 0 ? totalMarks / allTotalMarks : 0;

  // Weighted combination
  return (
    recencyScore * config.recentYearWeight +
    frequencyScore * config.frequencyWeight +
    marksScore * config.marksWeight
  );
}

/**
 * Generate revision priorities
 */
export async function generateRevisionPriorities(
  store: PYQStore,
  config: typeof DEFAULT_CONFIG = DEFAULT_CONFIG
): Promise<RevisionPriority[]> {
  const topics = await analyzeTopics(store);
  const priorities: RevisionPriority[] = [];

  for (const topic of topics) {
    const score = await calculatePriorityScore(topic.topic, topic.unit, store, config);
    
    // Determine reason based on patterns
    let reason = "";
    if (topic.count >= 3) {
      reason = `Asked ${topic.count} times in exams`;
    }
    if (topic.years.includes(2023) || topic.years.includes(2022)) {
      reason += reason ? " - Recent exam topic" : "Recent exam topic";
    }
    if (topic.averageMarks >= 8) {
      reason += reason ? ` - High weightage (avg ${topic.averageMarks.toFixed(1)} marks)` : `High weightage (avg ${topic.averageMarks.toFixed(1)} marks)`;
    }

    if (score >= config.priorityThreshold) {
      priorities.push({
        unit: topic.unit,
        topic: topic.topic,
        priorityScore: score,
        reason,
        suggestedMarks: Math.round(topic.averageMarks),
      });
    }
  }

  return priorities
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, config.topTopicsCount);
}

// ============================================================================
// Main Insights Generator
// ============================================================================

/**
 * Generate comprehensive PYQ insights
 */
export async function generatePYQInsights(
  store: PYQStore,
  filters?: { subject?: string; year?: number }
): Promise<PYQInsights> {
  const mostFrequentUnits = (await analyzeUnits(store, filters)).slice(0, DEFAULT_CONFIG.topUnitsCount);
  const highWeightageTopics = (await analyzeTopics(store, filters)).slice(0, DEFAULT_CONFIG.topTopicsCount);
  const revisionPriorities = await generateRevisionPriorities(store);
  const yearTrends = await analyzeYears(store, filters);
  const overallStats = await store.getStats();

  return {
    mostFrequentUnits,
    highWeightageTopics,
    revisionPriorities,
    yearTrends,
    overallStats,
  };
}

/**
 * Generate exam strategy response
 */
export async function generateExamStrategy(
  store: PYQStore,
  subject?: string,
  intent?: string
): Promise<string> {
  const insights = await generatePYQInsights(store, subject ? { subject } : undefined);
  const parts: string[] = [];

  // Overall statistics
  parts.push(`📊 **Exam Analysis Summary**`);
  parts.push(`Total PYQs available: ${insights.overallStats.totalQuestions}`);
  parts.push(`Year range: ${insights.overallStats.yearRange.start} - ${insights.overallStats.yearRange.end}`);
  parts.push("");

  // Most frequent units
  if (insights.mostFrequentUnits.length > 0) {
    parts.push("🎯 **Most Frequently Asked Units**");
    insights.mostFrequentUnits.forEach((unit, i) => {
      parts.push(`${i + 1}. ${unit.unit}: ${unit.count} questions (${unit.percentage.toFixed(1)}%)`);
    });
    parts.push("");
  }

  // High weightage topics
  if (insights.highWeightageTopics.length > 0) {
    parts.push("⭐ **High Weightage Topics**");
    insights.highWeightageTopics.slice(0, 5).forEach((topic, i) => {
      parts.push(`${i + 1}. ${topic.topic} (${topic.unit}): avg ${topic.averageMarks.toFixed(1)} marks`);
    });
    parts.push("");
  }

  // Revision priorities
  if (insights.revisionPriorities.length > 0) {
    parts.push("📚 **Priority Revision Areas**");
    insights.revisionPriorities.slice(0, 5).forEach((p, i) => {
      parts.push(`${i + 1}. ${p.topic}: ${p.reason}`);
    });
    parts.push("");
  }

  // Year trends
  if (insights.yearTrends.length > 0) {
    parts.push("📅 **Recent Exam Trends**");
    insights.yearTrends.slice(0, 3).forEach(year => {
      const topUnit = Object.entries(year.unitDistribution)
        .sort((a, b) => b[1] - a[1])[0];
      if (topUnit) {
        parts.push(`${year.year}: ${topUnit[0]} had most questions (${topUnit[1]})`);
      }
    });
  }

  return parts.join("\n");
}

/**
 * Check if query is exam-related
 */
export function isExamRelated(query: string): boolean {
  const examKeywords = [
    "exam", "question", "pyq", "previous year", "past year",
    "important", "marks", "weightage", "preparation", "prepare",
    "revision", "most asked", "frequently asked", "unit", "topic",
    "chapter", "paper", "semester exam", "midterm", "finals",
    "end sem", "question paper", "solve", "answer"
  ];
  
  const lowerQuery = query.toLowerCase();
  return examKeywords.some(keyword => lowerQuery.includes(keyword));
}

/**
 * Extract subject from query if mentioned
 */
export function extractSubjectFromQuery(query: string, availableSubjects: string[]): string | null {
  const lowerQuery = query.toLowerCase();
  
  for (const subject of availableSubjects) {
    if (lowerQuery.includes(subject.toLowerCase())) {
      return subject;
    }
  }
  
  return null;
}

