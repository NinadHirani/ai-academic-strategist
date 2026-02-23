/**
 * Student Memory & Weakness Tracking - Supabase Database Integration
 * Uses Supabase PostgreSQL for persistent storage
 */

import { supabase, UserProfile, UserInteraction } from './supabase';

// ============================================================================
// Types
// ============================================================================

export interface Topic {
  name: string;
  category: string;
  frequency: number;
  lastAsked: number;
  confidenceScore: number;
}

export interface Interaction {
  id: string;
  timestamp: number;
  userMessage: string;
  topic: string;
  wasCorrect?: boolean;
  confidenceLevel?: "high" | "medium" | "low";
  feedback?: "positive" | "negative" | "neutral";
}

export interface WeaknessProfile {
  userId: string;
  createdAt: number;
  updatedAt: number;
  topics: Record<string, Topic>;
  interactions: Interaction[];
  weakAreas: string[];
  strongAreas: string[];
  learningPatterns: {
    repeatedQuestions: string[];
    difficultConcepts: string[];
    averageSessionLength: number;
    totalSessions: number;
  };
}

// ============================================================================
// Supabase-backed Student Memory
// ============================================================================

/**
 * Get or create a student's weakness profile from Supabase
 */
export async function getStudentProfile(userId: string): Promise<WeaknessProfile> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // Create new profile if not found
      return await createNewProfile(userId);
    }

    return {
      userId: data.user_id,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
      topics: data.learning_patterns?.topics || {},
      interactions: [],
      weakAreas: data.weak_topics || [],
      strongAreas: [],
      learningPatterns: data.learning_patterns || {
        repeatedQuestions: [],
        difficultConcepts: [],
        averageSessionLength: 0,
        totalSessions: 0,
      },
    };
  } catch (error) {
    console.error('[StudentMemory] Error fetching profile:', error);
    return createNewProfile(userId);
  }
}

/**
 * Create a new student profile in Supabase
 */
export async function createNewProfile(userId: string): Promise<WeaknessProfile> {
  const newProfile: WeaknessProfile = {
    userId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    topics: {},
    interactions: [],
    weakAreas: [],
    strongAreas: [],
    learningPatterns: {
      repeatedQuestions: [],
      difficultConcepts: [],
      averageSessionLength: 0,
      totalSessions: 0,
    },
  };

  try {
    await supabase.from('user_profiles').insert({
      user_id: userId,
      weak_topics: [],
      repeated_questions: [],
      learning_patterns: newProfile.learningPatterns,
      preferences: {},
    });
  } catch (error) {
    console.error('[StudentMemory] Error creating profile:', error);
  }

  return newProfile;
}

/**
 * Update student profile in Supabase
 */
export async function updateStudentProfile(
  userId: string,
  update: Partial<WeaknessProfile>
): Promise<WeaknessProfile> {
  try {
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (update.weakAreas) {
      updateData.weak_topics = update.weakAreas;
    }

    if (update.learningPatterns) {
      updateData.learning_patterns = update.learningPatterns;
    }

    await supabase
      .from('user_profiles')
      .update(updateData)
      .eq('user_id', userId);
  } catch (error) {
    console.error('[StudentMemory] Error updating profile:', error);
  }

  return await getStudentProfile(userId);
}

/**
 * Add an interaction to Supabase
 */
export async function addInteraction(
  userId: string,
  interaction: Omit<Interaction, "id" | "timestamp">
): Promise<WeaknessProfile> {
  try {
    // First ensure profile exists
    await getStudentProfile(userId);

    // Add interaction record
    await supabase.from('user_interactions').insert({
      user_id: userId,
      message: interaction.userMessage,
      response: '', // Will be updated by caller
      topics_detected: [interaction.topic],
      confidence_level: interaction.confidenceLevel || 'medium',
      mode: 'study',
    });

    // Check if this is a repeated question
    const { data: recentInteractions } = await supabase
      .from('user_interactions')
      .select('message')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    const repeatedQuestions: string[] = [];
    if (recentInteractions && recentInteractions.length > 1) {
      const recentMessages = recentInteractions.map((i: { message: string }) => i.message.toLowerCase());
      const isRepeated = recentMessages.slice(1).some((msg: string) => 
        msg.includes(interaction.userMessage.toLowerCase().split(' ').slice(0, 3).join(' '))
      );
      if (isRepeated) {
        repeatedQuestions.push(interaction.topic);
      }
    }

    // Update profile with repeated questions
    if (repeatedQuestions.length > 0) {
      const profile = await getStudentProfile(userId);
      const existingRepeated = profile.learningPatterns.repeatedQuestions || [];
      await updateStudentProfile(userId, {
        learningPatterns: {
          ...profile.learningPatterns,
          repeatedQuestions: [...new Set([...existingRepeated, ...repeatedQuestions])],
        },
      });
    }
  } catch (error) {
    console.error('[StudentMemory] Error adding interaction:', error);
  }

  return await getStudentProfile(userId);
}

/**
 * Update topic information in Supabase
 */
export async function updateTopic(
  userId: string,
  topicName: string,
  category: string,
  confidenceLevel?: "high" | "medium" | "low"
): Promise<WeaknessProfile> {
  try {
    const profile = await getStudentProfile(userId);
    
    const existingTopic = profile.topics[topicName];
    const now = Date.now();
    
    // Calculate new confidence score
    let newConfidence = confidenceLevel 
      ? (confidenceLevel === "high" ? 1 : confidenceLevel === "medium" ? 0.5 : 0.2)
      : (existingTopic?.confidenceScore || 0.5);
    
    // Decay old confidence slightly over time
    if (existingTopic) {
      const daysSinceLastAsk = (now - existingTopic.lastAsked) / (1000 * 60 * 60 * 24);
      newConfidence = newConfidence * Math.pow(0.95, daysSinceLastAsk);
    }
    
    const updatedTopics = {
      ...profile.topics,
      [topicName]: {
        name: topicName,
        category: category || existingTopic?.category || "general",
        frequency: (existingTopic?.frequency || 0) + 1,
        lastAsked: now,
        confidenceScore: newConfidence,
      },
    };

    // Calculate weak and strong areas
    const allTopics = Object.values(updatedTopics);
    const weakAreas = allTopics
      .filter(t => t.confidenceScore < 0.4)
      .map(t => t.name);
    const strongAreas = allTopics
      .filter(t => t.confidenceScore >= 0.7)
      .map(t => t.name);

    await supabase
      .from('user_profiles')
      .update({
        weak_topics: weakAreas,
        learning_patterns: {
          ...profile.learningPatterns,
          topics: updatedTopics,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    return {
      ...profile,
      topics: updatedTopics,
      weakAreas,
      strongAreas,
    };
  } catch (error) {
    console.error('[StudentMemory] Error updating topic:', error);
    return await getStudentProfile(userId);
  }
}

/**
 * Get weak areas (topics with low confidence)
 */
export async function getWeakAreas(userId: string, threshold: number = 0.4): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('weak_topics')
      .eq('user_id', userId)
      .single();

    if (error || !data) return [];
    return data.weak_topics || [];
  } catch {
    return [];
  }
}

/**
 * Get strong areas (topics with high confidence)
 */
export async function getStrongAreas(userId: string, threshold: number = 0.7): Promise<string[]> {
  try {
    const profile = await getStudentProfile(userId);
        return profile.strongAreas;
  } catch {
    return [];
  }
}

/**
 * Get frequently asked topics
 */
export async function getFrequentTopics(userId: string, limit: number = 10): Promise<Topic[]> {
  try {
    const { data } = await supabase
      .from('user_interactions')
      .select('topics_detected, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!data) return [];

    const topicCounts: Record<string, number> = {};
    data.forEach((interaction: any) => {
      if (interaction.topics_detected) {
        interaction.topics_detected.forEach((topic: string) => {
          topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        });
      }
    });

    return Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name, frequency]) => ({
        name,
        category: 'general',
        frequency,
        lastAsked: Date.now(),
        confidenceScore: 0.5,
      }));
  } catch {
    return [];
  }
}

/**
 * Get recent interactions
 */
export async function getRecentInteractions(userId: string, limit: number = 10): Promise<Interaction[]> {
  try {
    const { data } = await supabase
      .from('user_interactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!data) return [];

    return data.map((interaction: any) => ({
      id: interaction.id,
      timestamp: new Date(interaction.created_at).getTime(),
      userMessage: interaction.message,
      topic: interaction.topics_detected?.[0] || 'general',
      confidenceLevel: interaction.confidence_level,
    }));
  } catch {
    return [];
  }
}

/**
 * Check if user is asking about a repeated topic
 */
export async function isRepeatedTopic(userId: string, topic: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('user_interactions')
      .select('topics_detected')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!data) return false;

    const topicLower = topic.toLowerCase();
    return data.some((interaction: any) => 
      interaction.topics_detected?.some((t: string) => 
        t.toLowerCase().includes(topicLower) ||
        topicLower.includes(t.toLowerCase())
      )
    );
  } catch {
    return false;
  }
}

/**
 * Get learning statistics for a student
 */
export async function getLearningStats(userId: string) {
  try {
    const profile = await getStudentProfile(userId);
    
    const topics = Object.values(profile.topics);
    const weakCount = topics.filter(t => t.confidenceScore < 0.4).length;
    const strongCount = topics.filter(t => t.confidenceScore >= 0.7).length;

    const { data: interactions } = await supabase
      .from('user_interactions')
      .select('id')
      .eq('user_id', userId);
    
    const totalInteractions = interactions?.length || 0;
    
    return {
      totalTopics: topics.length,
      weakAreas: weakCount,
      strongAreas: strongCount,
      totalInteractions,
      averageConfidence: topics.length > 0
        ? topics.reduce((sum, t) => sum + t.confidenceScore, 0) / topics.length
        : 0,
    };
  } catch (error) {
    console.error('[StudentMemory] Error getting stats:', error);
    return {
      totalTopics: 0,
      weakAreas: 0,
      strongAreas: 0,
      totalInteractions: 0,
      averageConfidence: 0,
    };
  }
}

/**
 * Clear all student data (for privacy/reset)
 */
export async function clearStudentData(userId: string): Promise<void> {
  try {
    await supabase.from('user_profiles').delete().eq('user_id', userId);
    await supabase.from('user_interactions').delete().eq('user_id', userId);
  } catch (error) {
    console.error('[StudentMemory] Error clearing data:', error);
  }
}

// ============================================================================
// Sync wrapper functions for backward compatibility
// ============================================================================

// These functions maintain compatibility with the existing code
// They wrap async Supabase calls with sync versions where needed

let memoryCache: Record<string, WeaknessProfile> = {};
const CACHE_TTL = 60000; // 1 minute cache

function getCachedProfile(userId: string): WeaknessProfile | null {
  const cached = memoryCache[userId];
  if (cached && Date.now() - cached.updatedAt < CACHE_TTL) {
    return cached;
  }
  return null;
}

function setCachedProfile(userId: string, profile: WeaknessProfile): void {
  memoryCache[userId] = profile;
}

// Sync wrappers for backward compatibility
export function getStudentProfileSync(userId: string): WeaknessProfile {
  const cached = getCachedProfile(userId);
  if (cached) return cached;
  
  // Return a basic profile synchronously, actual data loads async
  const profile: WeaknessProfile = {
    userId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    topics: {},
    interactions: [],
    weakAreas: [],
    strongAreas: [],
    learningPatterns: {
      repeatedQuestions: [],
      difficultConcepts: [],
      averageSessionLength: 0,
      totalSessions: 0,
    },
  };
  
  setCachedProfile(userId, profile);
  
  // Fire and forget async load
  getStudentProfile(userId).then(profile => {
    setCachedProfile(userId, profile);
  });
  
  return profile;
}

export function updateStudentProfileSync(
  userId: string,
  update: Partial<WeaknessProfile>
): WeaknessProfile {
  const current = getCachedProfile(userId) || getStudentProfileSync(userId);
  const updated = { ...current, ...update, updatedAt: Date.now() };
  setCachedProfile(userId, updated);
  
  // Fire and forget async update
  updateStudentProfile(userId, update);
  
  return updated;
}

export function addInteractionSync(
  userId: string,
  interaction: Omit<Interaction, "id" | "timestamp">
): WeaknessProfile {
  const current = getCachedProfile(userId) || getStudentProfileSync(userId);
  const newInteraction: Interaction = {
    ...interaction,
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
  };
  
  const updated: WeaknessProfile = {
    ...current,
    interactions: [...current.interactions, newInteraction].slice(-100),
    updatedAt: Date.now(),
  };
  
  setCachedProfile(userId, updated);
  
  // Fire and forget async
  addInteraction(userId, interaction);
  
  return updated;
}

export function updateTopicSync(
  userId: string,
  topicName: string,
  category: string,
  confidenceLevel?: "high" | "medium" | "low"
): WeaknessProfile {
  const current = getCachedProfile(userId) || getStudentProfileSync(userId);
  const existingTopic = current.topics[topicName];
  const now = Date.now();
  
  let newConfidence = confidenceLevel 
    ? (confidenceLevel === "high" ? 1 : confidenceLevel === "medium" ? 0.5 : 0.2)
    : (existingTopic?.confidenceScore || 0.5);
  
  if (existingTopic) {
    const daysSinceLastAsk = (now - existingTopic.lastAsked) / (1000 * 60 * 60 * 24);
    newConfidence = newConfidence * Math.pow(0.95, daysSinceLastAsk);
  }
  
  const updatedTopics = {
    ...current.topics,
    [topicName]: {
      name: topicName,
      category: category || existingTopic?.category || "general",
      frequency: (existingTopic?.frequency || 0) + 1,
      lastAsked: now,
      confidenceScore: newConfidence,
    },
  };
  
  const allTopics = Object.values(updatedTopics);
  const weakAreas = allTopics
    .filter(t => t.confidenceScore < 0.4)
    .map(t => t.name);
  const strongAreas = allTopics
    .filter(t => t.confidenceScore >= 0.7)
    .map(t => t.name);
  
  const updated: WeaknessProfile = {
    ...current,
    topics: updatedTopics,
    weakAreas,
    strongAreas,
    updatedAt: now,
  };
  
  setCachedProfile(userId, updated);
  
  // Fire and forget async
  updateTopic(userId, topicName, category, confidenceLevel);
  
  return updated;
}

export function getWeakAreasSync(userId: string, threshold: number = 0.4): string[] {
  const profile = getCachedProfile(userId) || getStudentProfileSync(userId);
  return profile.weakAreas;
}

export function getStrongAreasSync(userId: string, threshold: number = 0.7): string[] {
  const profile = getCachedProfile(userId) || getStudentProfileSync(userId);
  return profile.strongAreas;
}

export function isRepeatedTopicSync(userId: string, topic: string): boolean {
  const profile = getCachedProfile(userId) || getStudentProfileSync(userId);
  const topicLower = topic.toLowerCase();
  
  return profile.interactions
    .slice(-10)
    .some(interaction => 
      interaction.topic.toLowerCase().includes(topicLower) ||
      interaction.userMessage.toLowerCase().includes(topicLower)
    );
}

