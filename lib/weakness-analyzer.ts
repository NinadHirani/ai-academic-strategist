import {
  getStudentProfile,
  updateStudentProfile,
  addInteraction,
  updateTopic,
  getWeakAreas,
  getStrongAreas,
  isRepeatedTopic,
  WeaknessProfile,
} from "./student-memory";

// ============================================================================
// Types
// ============================================================================

export interface WeaknessAnalysis {
  isRepeated: boolean;
  detectedTopics: string[];
  suggestedWeaknesses: string[];
  needsReinforcement: boolean;
  revisionSuggestions: string[];
}

export interface TopicExtraction {
  topics: Array<{
    name: string;
    category: string;
    confidence: number;
  }>;
  primaryTopic: string | null;
}

// ============================================================================
// Topic Extraction - Extract academic topics from user messages
// ============================================================================

// Common academic subject keywords for topic detection
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

/**
 * Extract topics from user message
 */
export function extractTopics(message: string): TopicExtraction {
  const messageLower = message.toLowerCase();
  const detectedTopics: Array<{ name: string; category: string; confidence: number }> = [];
  
  // Check for subject keywords
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
      const confidence = Math.min(matchCount / keywords.length + 0.3, 1);
      detectedTopics.push({
        name: matchedKeywords[0], // Use first matched keyword as topic name
        category,
        confidence,
      });
    }
  }
  
  // If no subject-specific topics found, try to extract noun phrases
  if (detectedTopics.length === 0) {
    // Extract potential topic words (3+ char words that might be concepts)
    const words = messageLower.split(/\s+/).filter(w => w.length > 3);
    const uniqueWords = [...new Set(words)];
    
    // Filter out common words
    const commonWords = ["what", "when", "where", "why", "how", "explain", "describe", "define", "meaning", "example", "difference", "between", "compare", "understand", "learn"];
    const conceptWords = uniqueWords.filter(w => !commonWords.includes(w));
    
    if (conceptWords.length > 0) {
      detectedTopics.push({
        name: conceptWords[0],
        category: "general",
        confidence: 0.5,
      });
    }
  }
  
  return {
    topics: detectedTopics,
    primaryTopic: detectedTopics.length > 0 ? detectedTopics[0].name : null,
  };
}

// ============================================================================
// Weakness Detection - Identify learning weaknesses
// ============================================================================

/**
 * Analyze message for weakness indicators
 */
export async function analyzeWeakness(
  userId: string,
  message: string,
  previousTopics: string[] = []
): Promise<WeaknessAnalysis> {
  const topicExtraction = extractTopics(message);
  
  // Check for repeated questions
  const isRepeated = topicExtraction.primaryTopic
    ? await isRepeatedTopic(userId, topicExtraction.primaryTopic)
    : false;
  
  // Get current weak areas
  const currentWeakAreas = await getWeakAreas(userId);
  
  // Check if current topics are in weak areas
  const detectedTopics = topicExtraction.topics.map(t => t.name);
  const suggestedWeaknesses = detectedTopics.filter(topic =>
    currentWeakAreas.some(weak => 
      weak.toLowerCase().includes(topic.toLowerCase()) ||
      topic.toLowerCase().includes(weak.toLowerCase())
    )
  );
  
  // Determine if reinforcement is needed
  const needsReinforcement = isRepeated || 
    (topicExtraction.primaryTopic !== null && currentWeakAreas.length > 0);
  
  // Generate revision suggestions based on weak areas
  const revisionSuggestions = await generateRevisionSuggestions(userId, detectedTopics);
  
  return {
    isRepeated,
    detectedTopics,
    suggestedWeaknesses,
    needsReinforcement,
    revisionSuggestions,
  };
}

/**
 * Generate revision suggestions based on weak areas
 */
async function generateRevisionSuggestions(
  userId: string,
  currentTopics: string[]
): Promise<string[]> {
  const weakAreas = await getWeakAreas(userId);
  const suggestions: string[] = [];
  
  // Add suggestions for weak areas not in current discussion
  for (const weakArea of weakAreas.slice(0, 3)) {
    const isCurrentlyDiscussing = currentTopics.some(
      topic => topic.toLowerCase().includes(weakArea.toLowerCase()) ||
               weakArea.toLowerCase().includes(topic.toLowerCase())
    );
    
    if (!isCurrentlyDiscussing) {
      suggestions.push(`Consider reviewing ${weakArea} - this has been a challenging topic`);
    }
  }
  
  return suggestions;
}

// ============================================================================
// Profile Updates - Update student profile after interactions
// ============================================================================

/**
 * Record a user interaction and update the profile
 */
export async function recordInteraction(
  userId: string,
  message: string,
  response: string,
  confidenceLevel?: "high" | "medium" | "low",
  feedback?: "positive" | "negative" | "neutral"
): Promise<WeaknessProfile> {
  // Extract topics from message
  const topicExtraction = extractTopics(message);
  
  // Add interaction to history
  await addInteraction(userId, {
    userMessage: message,
    topic: topicExtraction.primaryTopic || "general",
    confidenceLevel,
    feedback,
  });
  
  // Update each detected topic
  for (const topic of topicExtraction.topics) {
    await updateTopic(userId, topic.name, topic.category, confidenceLevel);
  }
  
  // Update weak/strong areas
  const weakAreas = await getWeakAreas(userId);
  const strongAreas = await getStrongAreas(userId);
  
  await updateStudentProfile(userId, {
    weakAreas,
    strongAreas,
  });
  
  return await getStudentProfile(userId);
}

/**
 * Update confidence after explicit feedback
 */
export async function updateConfidenceAfterFeedback(
  userId: string,
  topic: string,
  wasCorrect: boolean
): Promise<void> {
  const profile = await getStudentProfile(userId);
  const existingTopic = profile.topics[topic];
  
  if (existingTopic) {
    // Adjust confidence based on feedback
    const adjustment = wasCorrect ? 0.1 : -0.15;
    const newConfidence = Math.max(0, Math.min(1, existingTopic.confidenceScore + adjustment));
    
    await updateTopic(userId, topic, existingTopic.category);
    
    // Update the confidence directly in the profile
    // Note: In a real implementation, we'd add a method to update confidence directly
  }
}

// ============================================================================
// Weakness-Aware Prompt Enhancement
// ============================================================================

/**
 * Generate weakness-aware system prompt additions
 */
export async function getWeaknessPromptContext(userId: string): Promise<string> {
  const weakAreas = await getWeakAreas(userId);
  const strongAreas = await getStrongAreas(userId);
  
  if (weakAreas.length === 0 && strongAreas.length === 0) {
    return ""; // No history yet
  }
  
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

/**
 * Check if we should provide reinforcement for weak areas
 */
export async function shouldProvideReinforcement(userId: string, message: string): Promise<boolean> {
  const topicExtraction = extractTopics(message);
  const weakAreas = await getWeakAreas(userId);
  
  // If message topic matches a weak area, provide reinforcement
  for (const topic of topicExtraction.topics) {
    if (weakAreas.some(weak => 
      weak.toLowerCase().includes(topic.name.toLowerCase()) ||
      topic.name.toLowerCase().includes(weak.toLowerCase())
    )) {
      return true;
    }
  }
  
  return false;
}

/**
 * Generate a reinforcement tip for weak areas
 */
export async function getReinforcementTip(userId: string): Promise<string | null> {
  const weakAreas = await getWeakAreas(userId);
  
  if (weakAreas.length === 0) {
    return null;
  }
  
  const tip = `📚 Quick Review: You've asked about ${weakAreas[0]} before. ` +
    "Let me provide some extra practice tips for this topic.";
  
  return tip;
}

