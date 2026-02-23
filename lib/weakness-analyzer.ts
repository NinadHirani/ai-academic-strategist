/**
 * Weakness Analyzer
 */

import { getStudentProfile, updateStudentProfile, addInteraction, updateTopic, getWeakAreas, getStrongAreas, isRepeatedTopic, WeaknessProfile } from "./student-memory";

export interface WeaknessAnalysis {
  isRepeated: boolean;
  detectedTopics: string[];
  suggestedWeaknesses: string[];
  needsReinforcement: boolean;
  revisionSuggestions: string[];
}

export interface TopicExtraction {
  topics: Array<{ name: string; category: string; confidence: number }>;
  primaryTopic: string | null;
}

const TOPIC_KEYWORDS: Record<string, string[]> = {
  mathematics: ["calculus", "algebra", "geometry", "derivative", "integral", "equation", "function", "matrix", "vector", "probability", "statistics", "theorem", "proof"],
  physics: ["force", "energy", "motion", "velocity", "acceleration", "gravity", "wave", "thermodynamics", "electromagnetism", "quantum", "relativity"],
  chemistry: ["atom", "molecule", "reaction", "bond", "element", "compound", "acid", "base", "oxidation", "reduction", "equilibrium"],
  biology: ["cell", "dna", "rna", "protein", "enzyme", "metabolism", "photosynthesis", "respiration", "genetics", "evolution", "ecosystem"],
  computer_science: ["algorithm", "data structure", "programming", "code", "function", "loop", "array", "object", "class", "database", "network", "security"],
  economics: ["supply", "demand", "market", "price", "cost", "profit", "gdp", "inflation", "tax", "trade", "budget"],
  psychology: ["cognition", "behavior", "memory", "learning", "perception", "emotion", "personality", "motivation", "intelligence"],
  literature: ["poem", "novel", "fiction", "drama", "character", "theme", "metaphor", "symbolism", "narrative"],
  history: ["war", "revolution", "empire", "civilization", "century", "ancient", "medieval", "modern", "colonial"],
};

export function extractTopics(message: string): TopicExtraction {
  const messageLower = message.toLowerCase();
  const detectedTopics: Array<{ name: string; category: string; confidence: number }> = [];
  
  for (const [category, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    let matchCount = 0;
    const matchedKeywords: string[] = [];
    
    for (const keyword of keywords) {
      if (messageLower.includes(keyword)) {
        matchCount++;
        matchedKeywords.push(keyword);
      }
    }
    
    if (matchCount > 0) {
      detectedTopics.push({ name: matchedKeywords[0], category, confidence: Math.min(matchCount / keywords.length + 0.3, 1) });
    }
  }
  
  if (detectedTopics.length === 0) {
    const words = messageLower.split(/\s+/).filter(w => w.length > 3);
    const uniqueWords = [...new Set(words)];
    const commonWords = ["what", "when", "where", "why", "how", "explain", "describe", "define", "meaning", "example", "difference", "between", "compare", "understand", "learn"];
    const conceptWords = uniqueWords.filter(w => !commonWords.includes(w));
    
    if (conceptWords.length > 0) {
      detectedTopics.push({ name: conceptWords[0], category: "general", confidence: 0.5 });
    }
  }
  
  return { topics: detectedTopics, primaryTopic: detectedTopics.length > 0 ? detectedTopics[0].name : null };
}

export async function analyzeWeakness(userId: string, message: string, previousTopics: string[] = []): Promise<WeaknessAnalysis> {
  const topicExtraction = extractTopics(message);
  const isRepeated = topicExtraction.primaryTopic ? await isRepeatedTopic(userId, topicExtraction.primaryTopic) : false;
  const currentWeakAreas = await getWeakAreas(userId);
  const detectedTopics = topicExtraction.topics.map(t => t.name);
  const suggestedWeaknesses = detectedTopics.filter(topic => currentWeakAreas.some(weak => weak.toLowerCase().includes(topic.toLowerCase()) || topic.toLowerCase().includes(weak.toLowerCase())));
  const needsReinforcement = isRepeated || (topicExtraction.primaryTopic !== null && currentWeakAreas.length > 0);
  const revisionSuggestions = await generateRevisionSuggestions(userId, detectedTopics);
  
  return { isRepeated, detectedTopics, suggestedWeaknesses, needsReinforcement, revisionSuggestions };
}

async function generateRevisionSuggestions(userId: string, currentTopics: string[]): Promise<string[]> {
  const weakAreas = await getWeakAreas(userId);
  const suggestions: string[] = [];
  
  for (const weakArea of weakAreas.slice(0, 3)) {
    const isCurrentlyDiscussing = currentTopics.some(topic => topic.toLowerCase().includes(weakArea.toLowerCase()) || weakArea.toLowerCase().includes(topic.toLowerCase()));
    if (!isCurrentlyDiscussing) suggestions.push(`Consider reviewing ${weakArea} - this has been a challenging topic`);
  }
  
  return suggestions;
}

export async function recordInteraction(userId: string, message: string, response: string, confidenceLevel?: "high" | "medium" | "low", feedback?: "positive" | "negative" | "neutral"): Promise<WeaknessProfile> {
  const topicExtraction = extractTopics(message);
  
  await addInteraction(userId, { userMessage: message, topic: topicExtraction.primaryTopic || "general", confidenceLevel, feedback });
  
  for (const topic of topicExtraction.topics) {
    await updateTopic(userId, topic.name, topic.category, confidenceLevel);
  }
  
  const weakAreas = await getWeakAreas(userId);
  const strongAreas = await getStrongAreas(userId);
  
  await updateStudentProfile(userId, { weakAreas, strongAreas });
  return await getStudentProfile(userId);
}

export async function updateConfidenceAfterFeedback(userId: string, topic: string, wasCorrect: boolean): Promise<void> {
  const profile = await getStudentProfile(userId);
  const existingTopic = profile.topics[topic];
  
  if (existingTopic) {
    const adjustment = wasCorrect ? 0.1 : -0.15;
    const newConfidence = Math.max(0, Math.min(1, existingTopic.confidenceScore + adjustment));
    await updateTopic(userId, topic, existingTopic.category);
  }
}

export async function getWeaknessPromptContext(userId: string): Promise<string> {
  const weakAreas = await getWeakAreas(userId);
  const strongAreas = await getStrongAreas(userId);
  
  if (weakAreas.length === 0 && strongAreas.length === 0) return "";
  
  let context = "\n\n## Student Learning Profile\n";
  
  if (weakAreas.length > 0) {
    context += `Areas needing reinforcement: ${weakAreas.slice(0, 5).join(", ")}\n`;
    context += "Tip: Provide extra examples and clarification for these topics.\n";
  }
  
  if (strongAreas.length > 0) {
    context += `Strong areas: ${strongAreas.slice(0, 5).join(", ")}\n`;
    context += "Can move faster through these concepts.\n";
  }
  
  return context;
}

export async function shouldProvideReinforcement(userId: string, message: string): Promise<boolean> {
  const topicExtraction = extractTopics(message);
  const weakAreas = await getWeakAreas(userId);
  
  for (const topic of topicExtraction.topics) {
    if (weakAreas.some(weak => weak.toLowerCase().includes(topic.name.toLowerCase()) || topic.name.toLowerCase().includes(weak.toLowerCase()))) {
      return true;
    }
  }
  
  return false;
}

export async function getReinforcementTip(userId: string): Promise<string | null> {
  const weakAreas = await getWeakAreas(userId);
  
  if (weakAreas.length === 0) return null;
  
  return `📚 Quick Review: You've asked about ${weakAreas[0]} before. Let me provide some extra practice tips for this topic.`;
}

