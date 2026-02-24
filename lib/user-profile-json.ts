/**
 * User Profile JSON Storage - Persistent Long-Term Memory
 * Stores user details in a local JSON file for persistence across sessions
 */

import fs from 'fs';
import path from 'path';

// ============================================================================
// Types
// ============================================================================

export interface UserProfileData {
  name?: string;
  university?: string;
  degree?: string;
  location?: string;
  job?: string;
  interests?: string[];
  skills?: string[];
  preferences?: Record<string, any>;
  weakAreas?: string[];
  strongAreas?: string[];
  facts?: string[];
  lastUpdated?: string;
  createdAt?: string;
}

export interface UserProfile {
  [userId: string]: UserProfileData;
}

// ============================================================================
// Configuration
// ============================================================================

const PROFILE_FILE_NAME = 'user_profile.json';
const DATA_DIR = path.join(process.cwd(), 'data');

// Ensure data directory exists
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getProfileFilePath(): string {
  return path.join(DATA_DIR, PROFILE_FILE_NAME);
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Load user profile from JSON file
 * Returns empty profile if file doesn't exist
 */
export function loadUserProfile(): UserProfile {
  ensureDataDir();
  const filePath = getProfileFilePath();

  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[UserProfileJSON] Error loading profile:', error);
  }

  return {};
}

/**
 * Save user profile to JSON file
 */
export function saveUserProfile(profile: UserProfile): void {
  ensureDataDir();
  const filePath = getProfileFilePath();

  try {
    fs.writeFileSync(filePath, JSON.stringify(profile, null, 2), 'utf-8');
    console.log('[UserProfileJSON] Profile saved successfully');
  } catch (error) {
    console.error('[UserProfileJSON] Error saving profile:', error);
  }
}

/**
 * Get a specific user's profile
 */
export function getUserProfile(userId: string): UserProfileData {
  const allProfiles = loadUserProfile();
  return allProfiles[userId] || {};
}

/**
 * Update or create a user's profile
 */
export function updateUserProfile(userId: string, updates: Partial<UserProfileData>): UserProfileData {
  const allProfiles = loadUserProfile();
  
  const currentProfile = allProfiles[userId] || {
    createdAt: new Date().toISOString(),
  };

  const updatedProfile: UserProfileData = {
    ...currentProfile,
    ...updates,
    lastUpdated: new Date().toISOString(),
  };

  allProfiles[userId] = updatedProfile;
  saveUserProfile(allProfiles);

  return updatedProfile;
}

/**
 * Add a single fact to user's profile
 */
export function addUserFact(userId: string, fact: string): UserProfileData {
  const profile = getUserProfile(userId);
  const facts = profile.facts || [];

  // Avoid duplicate facts
  if (!facts.includes(fact)) {
    facts.push(fact);
    return updateUserProfile(userId, { facts });
  }

  return profile;
}

// ============================================================================
// Fact Extraction - Detect new user facts from AI responses
// ============================================================================

// Patterns to detect user facts in conversation - improved regex
const FACT_PATTERNS = {
  // Name patterns - more comprehensive
  name: /(?:my name is|i'm|i am|call me|named|just so you know|btw|by the way)\s+(?:called\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
  
  // University patterns
  university: /(?:i study at|i'm at|i go to|i'm studying at|i attend|i'm currently at)\s+([A-Z][^.]+?)(?:\s+university|\s+college|\s+institute|$)/gi,
  
  // Degree patterns
  degree: /(?:i(?:'m)?\s+(?:doing|pursuing|studying|in))\s+(?:a\s+)?([\w\s-]+?)(?:\s+degree|\s+year|$)/gi,
  
  // Location patterns
  location: /(?:i live in|i'm based in|i'm from|i stay in)\s+([A-Z][^.]+?)(?:\s+city|\s+country|$)/gi,
  
  // Job patterns
  job: /(?:i work (?:as|at)|i'm a|i'm working as|i(?:'m)?\s+(?:a|an))\s+([A-Z][^.]+?)(?:\s+at|\s+in|$)/gi,
  
  // Skills patterns - more flexible
  skills: /(?:i know|i'm skilled in|i'm good at|i'm proficient in|i have experience with)\s+([A-Z][^.]+)/gi,
  
  // Interests patterns
  interests: /(?:i(?:'m)?\s+(?:interested in|like|love|passionate about))\s+([A-Z][^.]+)/gi,
};

/**
 * Extract user facts from a message
 * Returns an object with detected facts
 */
export function extractFactsFromMessage(message: string): Partial<UserProfileData> {
  const extracted: Partial<UserProfileData> = {};
  
  // Clean the message for better matching
  const cleanMessage = message.trim();
  const lowerMessage = cleanMessage.toLowerCase();

  // Extract name - try multiple patterns (works for ANY name)
  const namePatterns = [
    { regex: /my name is\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i, group: 1 },
    { regex: /^i am\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i, group: 1 },
    { regex: /i am\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i, group: 1 },
    { regex: /\b(i'm)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i, group: 2 }, // "I'm John" - avoid "I'm hungry"
    { regex: /call me\s+([a-zA-Z]+)/i, group: 1 },
    { regex: /you can call me\s+([a-zA-Z]+)/i, group: 1 },
    { regex: /name[:\s]+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i, group: 1 },
    { regex: /i go by\s+([a-zA-Z]+)/i, group: 1 },
  ];
  
  for (const { regex, group } of namePatterns) {
    const match = cleanMessage.match(regex);
    if (match && match[group]) {
      const name = match[group].trim();
      // Skip common non-name words
      if (!['a', 'an', 'the', 'student', 'here', 'ready', 'good', 'fine', 'okay'].includes(name.toLowerCase())) {
        extracted.name = name;
        break;
      }
    }
  }

  // Extract university - flexible patterns for ANY university
  const uniPatterns = [
    { regex: /i study at\s+([a-zA-Z]+(?:\s+[a-zA-Z]+){0,3})/i, group: 1 },
    { regex: /i go to\s+([a-zA-Z]+(?:\s+[a-zA-Z]+){0,3})/i, group: 1 },
    { regex: /i attend\s+([a-zA-Z]+(?:\s+[a-zA-Z]+){0,3})/i, group: 1 },
    { regex: /i'm at\s+([a-zA-Z]+(?:\s+[a-zA-Z]+){0,3})/i, group: 1 },
    { regex: /studying at\s+([a-zA-Z]+(?:\s+[a-zA-Z]+){0,3})/i, group: 1 },
  ];
  
  for (const { regex, group } of uniPatterns) {
    const match = cleanMessage.match(regex);
    if (match && match[group]) {
      extracted.university = match[group].trim();
      break;
    }
  }

  // Extract location - works for ANY location
  const locationPatterns = [
    { regex: /i live in\s+([a-zA-Z]+(?:\s+[a-zA-Z]+){0,2})/i, group: 1 },
    { regex: /i'm from\s+([a-zA-Z]+(?:\s+[a-zA-Z]+){0,2})/i, group: 1 },
    { regex: /i'm based in\s+([a-zA-Z]+(?:\s+[a-zA-Z]+){0,2})/i, group: 1 },
  ];
  
  for (const { regex, group } of locationPatterns) {
    const match = cleanMessage.match(regex);
    if (match && match[group]) {
      extracted.location = match[group].trim();
      break;
    }
  }

  // Extract job - works for ANY job
  const jobPatterns = [
    { regex: /i work as\s+(?:a|an)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+){0,3})/i, group: 1 },
    { regex: /i work at\s+([a-zA-Z]+(?:\s+[a-zA-Z]+){0,3})/i, group: 1 },
    { regex: /i'm a\s+([a-zA-Z]+(?:\s+[a-zA-Z]+){0,3})/i, group: 1 },
  ];
  
  for (const { regex, group } of jobPatterns) {
    const match = cleanMessage.match(regex);
    if (match && match[group]) {
      extracted.job = match[group].trim();
      break;
    }
  }

  return extracted;
}

/**
 * Process AI response and extract any new user facts
 * Returns the updated profile
 */
export function processAIResponseForFacts(userId: string, userMessage: string, aiResponse: string): UserProfileData {
  // Check user's message for facts
  const userFacts = extractFactsFromMessage(userMessage);
  
  // If we found facts in user message, update profile
  if (Object.keys(userFacts).length > 0) {
    const currentProfile = getUserProfile(userId);
    const updatedProfile = updateUserProfile(userId, {
      ...currentProfile,
      ...userFacts,
    });
    console.log('[UserProfileJSON] Updated profile with user facts:', userFacts);
    return updatedProfile;
  }

  return getUserProfile(userId);
}

/**
 * Build formatted profile string for system prompt injection
 */
export function getProfileForPrompt(userId: string): string {
  const profile = getUserProfile(userId);

  if (!profile || Object.keys(profile).length === 0) {
    return '[USER_PROFILE]\n- No profile data available yet. Ask friendly questions to learn about the user!';
  }

  const parts: string[] = ['[USER_PROFILE]'];

  if (profile.name) {
    parts.push(`- Name: ${profile.name}`);
  }
  if (profile.university) {
    parts.push(`- University: ${profile.university}`);
  }
  if (profile.degree) {
    parts.push(`- Degree: ${profile.degree}`);
  }
  if (profile.interests && profile.interests.length > 0) {
    parts.push(`- Interests: ${profile.interests.join(', ')}`);
  }
  if (profile.skills && profile.skills.length > 0) {
    parts.push(`- Skills: ${profile.skills.join(', ')}`);
  }
  if (profile.facts && profile.facts.length > 0) {
    parts.push(`- Known Facts: ${profile.facts.join('; ')}`);
  }
  if (profile.weakAreas && profile.weakAreas.length > 0) {
    parts.push(`- Areas to Improve: ${profile.weakAreas.join(', ')}`);
  }

  if (parts.length === 1) {
    parts.push('- No profile data available yet. Ask friendly questions to learn about the user!');
  }

  return parts.join('\n');
}

/**
 * Clear user profile (for testing/reset)
 */
export function clearUserProfile(userId: string): void {
  const allProfiles = loadUserProfile();
  delete allProfiles[userId];
  saveUserProfile(allProfiles);
}

/**
 * Get all profiles (for debugging)
 */
export function getAllProfiles(): UserProfile {
  return loadUserProfile();
}

