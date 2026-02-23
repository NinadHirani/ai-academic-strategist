/**
 * Academic Context Detection Engine
 * Analyzes user queries to extract structured academic metadata
 * 
 * Supported patterns:
 * - University codes (GTU, MIT, Stanford, etc.)
 * - Semester references (Sem 1-8, Semester 1-8)
 * - Subject abbreviations and full names
 * - Intent detection (exam_preparation, homework_help, concept_explanation, etc.)
 */

// ============================================================================
// Types
// ============================================================================

export interface AcademicContext {
  university: string | null;
  semester: number | null;
  subject: string | null;
  subjectCode: string | null;
  intent: AcademicIntent;
  confidence: number;
  rawMatches: string[];
}

export type AcademicIntent = 
  | "exam_preparation"
  | "homework_help"
  | "concept_explanation"
  | "assignment_help"
  | "project_guidance"
  | "lecture_notes"
  | "general_query"
  | "unknown";

// ============================================================================
// University Knowledge Base
// ============================================================================

const UNIVERSITY_PATTERNS: Record<string, string> = {
  // Indian Universities
  "gtu": "Gujarat Technological University",
  "mumbai university": "University of Mumbai",
  "mu": "University of Mumbai",
  "du": "Delhi University",
  "delhi university": "Delhi University",
  "iit": "Indian Institute of Technology",
  "nit": "National Institute of Technology",
  "anna university": "Anna University",
  "vtu": "Visvesvaraya Technological University",
  "jntu": "Jawaharlal Nehru Technological University",
  "rgpv": "Rajiv Gandhi Proudyogiki Vishwavidyalaya",
  "mdu": "Maharshi Dayanand University",
  "kuk": "Kurukshetra University",
  "pu": "Punjab University",
  "bu": "Bangalore University",
  
  // International
  "stanford": "Stanford University",
  "mit": "Massachusetts Institute of Technology",
  "caltech": "California Institute of Technology",
  "harvard": "Harvard University",
  "oxford": "University of Oxford",
  "cambridge": "University of Cambridge",
  "ucb": "University of California Berkeley",
  "ucla": "University of California Los Angeles",
  "columbia": "Columbia University",
  "yale": "Yale University",
  "princeton": "Princeton University",
  
  // Generic
  "university": "Generic University",
  "college": "College",
};

// ============================================================================
// Subject Knowledge Base
// ============================================================================

const SUBJECT_PATTERNS: Record<string, string> = {
  // Computer Science & Programming
  "ajp": "Advanced Java Programming",
  "adv java": "Advanced Java Programming",
  "java": "Java Programming",
  "python": "Python Programming",
  "cpp": "C++ Programming",
  "c++": "C++ Programming",
  "c programming": "C Programming",
  "dsa": "Data Structures and Algorithms",
  "dbms": "Database Management Systems",
  "sql": "Structured Query Language",
  "os": "Operating Systems",
  "cn": "Computer Networks",
  "computer networks": "Computer Networks",
  "se": "Software Engineering",
  "software engineering": "Software Engineering",
  "web tech": "Web Technologies",
  "web technology": "Web Technologies",
  "html": "HTML/CSS",
  "css": "HTML/CSS",
  "js": "JavaScript",
  "javascript": "JavaScript",
  "react": "React.js",
  "node": "Node.js",
  "nodejs": "Node.js",
  "ml": "Machine Learning",
  "ai": "Artificial Intelligence",
  "artificial intelligence": "Artificial Intelligence",
  "dm": "Data Mining",
  "data mining": "Data Mining",
  "cloud": "Cloud Computing",
  "cybersecurity": "Cyber Security",
  "iot": "Internet of Things",
  "blockchain": "Blockchain Technology",
  
  // Engineering
  "maths": "Mathematics",
  "math": "Mathematics",
  "mathematics": "Mathematics",
  "physics": "Physics",
  "chem": "Chemistry",
  "chemistry": "Chemistry",
  
  // Electronics
  "dc": "Digital Circuits",
  "microprocessor": "Microprocessor",
  "microcontroller": "Microcontroller",
  "vlsi": "VLSI Design",
  "signals": "Signals and Systems",
  "electronics": "Electronics",
  "circuits": "Circuit Theory",
  
  // Management
  "mba": "Management Studies",
  "management": "Management Studies",
  "economics": "Economics",
  
  // General
  "engineering": "Engineering",
  "science": "Science",
  "commerce": "Commerce",
};

// ============================================================================
// Semester Patterns
// ============================================================================

const SEMESTER_REGEX = /(?:sem(?:ester)?\.?\s*)(\d{1,2})/gi;

// ============================================================================
// Intent Keywords
// ============================================================================

const INTENT_KEYWORDS: Record<AcademicIntent, string[]> = {
  exam_preparation: [
    "exam", "preparation", "prepare", "question paper", "previous year",
    "pyq", "important questions", "notes for exam", "last minute",
    "semester exam", "midterm", "finals", "end sem"
  ],
  homework_help: [
    "homework", "assignment", "work", "submit", "deadline",
    "question", "solve", "help with", "complete", "do my"
  ],
  concept_explanation: [
    "what is", "explain", "how does", "concept", "understand",
    "meaning", "definition", "explain concept", "tell me about",
    "describe", "difference between", "compare"
  ],
  assignment_help: [
    "assignment", "project work", "report", "presentation",
    "documentation", "submission"
  ],
  project_guidance: [
    "project", "implement", "build", "create", "design project",
    "final year project", "minor project", "major project"
  ],
  lecture_notes: [
    "lecture", "notes", "chapter", "topic", "summary", "recap",
    "what did we learn", "class", "taught"
  ],
  general_query: [],
  unknown: [],
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Detect university from text
 */
function detectUniversity(text: string): { value: string | null; matches: string[] } {
  const lowerText = text.toLowerCase();
  const matches: string[] = [];
  let detected: string | null = null;
  let highestPriority = 0;

  for (const [pattern, fullName] of Object.entries(UNIVERSITY_PATTERNS)) {
    if (lowerText.includes(pattern)) {
      matches.push(pattern);
      // Prioritize longer matches (more specific)
      if (pattern.length > highestPriority) {
        highestPriority = pattern.length;
        detected = fullName;
      }
    }
  }

  return { value: detected, matches };
}

/**
 * Detect semester from text
 */
function detectSemester(text: string): { value: number | null; matches: string[] } {
  const matches: string[] = [];
  const foundSemesters: number[] = [];

  let match;
  const regex = new RegExp(SEMESTER_REGEX);
  while ((match = regex.exec(text)) !== null) {
    const semNum = parseInt(match[1], 10);
    if (semNum >= 1 && semNum <= 12) {
      foundSemesters.push(semNum);
      matches.push(match[0]);
    }
  }

  // Return the first valid semester found (usually the most relevant)
  return {
    value: foundSemesters.length > 0 ? foundSemesters[0] : null,
    matches,
  };
}

/**
 * Detect subject from text
 */
function detectSubject(text: string): { value: string | null; code: string | null; matches: string[] } {
  const lowerText = text.toLowerCase();
  const matches: string[] = [];
  let detectedFull: string | null = null;
  let detectedCode: string | null = null;
  let highestPriority = 0;

  for (const [pattern, fullName] of Object.entries(SUBJECT_PATTERNS)) {
    if (lowerText.includes(pattern)) {
      matches.push(pattern);
      // Prioritize longer matches (more specific)
      if (pattern.length > highestPriority) {
        highestPriority = pattern.length;
        detectedFull = fullName;
        detectedCode = pattern.toUpperCase();
      }
    }
  }

  return { value: detectedFull, code: detectedCode, matches };
}

/**
 * Detect academic intent from text
 */
function detectIntent(text: string): { value: AcademicIntent; confidence: number } {
  const lowerText = text.toLowerCase();
  let bestIntent: AcademicIntent = "general_query";
  let bestScore = 0;

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (intent === "general_query" || intent === "unknown") continue;

    let score = 0;
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        score += keyword.length; // Weight by keyword length
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent as AcademicIntent;
    }
  }

  // Calculate confidence based on keyword matches
  const confidence = bestScore > 0 ? Math.min(0.5 + (bestScore / 50), 0.95) : 0.3;

  return { value: bestIntent, confidence };
}

/**
 * Calculate overall confidence score
 */
function calculateOverallConfidence(
  university: string | null,
  semester: number | null,
  subject: string | null,
  intent: AcademicIntent
): number {
  let score = 0.3; // Base confidence

  if (university) score += 0.2;
  if (semester) score += 0.15;
  if (subject) score += 0.25;
  if (intent !== "general_query") score += 0.1;

  return Math.min(score, 1.0);
}

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * Parse user query and extract academic context
 * 
 * @param query - The user's input message
 * @returns AcademicContext with detected metadata
 */
export function parseAcademicContext(query: string): AcademicContext {
  // Detect each component
  const universityResult = detectUniversity(query);
  const semesterResult = detectSemester(query);
  const subjectResult = detectSubject(query);
  const intentResult = detectIntent(query);

  // Collect all raw matches
  const rawMatches = [
    ...universityResult.matches,
    ...semesterResult.matches,
    ...subjectResult.matches,
  ];

  // Calculate overall confidence
  const confidence = calculateOverallConfidence(
    universityResult.value,
    semesterResult.value,
    subjectResult.value,
    intentResult.value
  );

  return {
    university: universityResult.value,
    semester: semesterResult.value,
    subject: subjectResult.value,
    subjectCode: subjectResult.code,
    intent: intentResult.value,
    confidence,
    rawMatches,
  };
}

/**
 * Generate a context summary string for debugging/logging
 */
export function contextToString(context: AcademicContext): string {
  const parts: string[] = [];

  if (context.university) parts.push(`University: ${context.university}`);
  if (context.semester) parts.push(`Semester: ${context.semester}`);
  if (context.subject) parts.push(`Subject: ${context.subject}`);
  if (context.intent !== "general_query") parts.push(`Intent: ${context.intent}`);

  return parts.length > 0 
    ? `[${parts.join(", ")}] (confidence: ${(context.confidence * 100).toFixed(0)}%)`
    : "[No academic context detected]";
}

/**
 * Get context for prompt injection
 */
export function getContextForPrompt(context: AcademicContext): string {
  const parts: string[] = [];

  if (context.university) {
    parts.push(`University: ${context.university}`);
  }
  if (context.semester) {
    parts.push(`Semester: ${context.semester}`);
  }
  if (context.subject) {
    parts.push(`Subject: ${context.subject}`);
  }
  if (context.intent !== "general_query") {
    parts.push(`Student Intent: ${context.intent.replace(/_/g, " ")}`);
  }

  return parts.length > 0 
    ? `Academic Context:\n${parts.join("\n")}`
    : "";
}

// ============================================================================
// Knowledge Base Extension Helpers
// ============================================================================

/**
 * Add custom university mapping
 */
export function addUniversityPattern(code: string, fullName: string): void {
  UNIVERSITY_PATTERNS[code.toLowerCase()] = fullName;
}

/**
 * Add custom subject mapping
 */
export function addSubjectPattern(code: string, fullName: string): void {
  SUBJECT_PATTERNS[code.toLowerCase()] = fullName;
}

/**
 * Add custom intent keywords
 */
export function addIntentKeywords(intent: AcademicIntent, keywords: string[]): void {
  if (INTENT_KEYWORDS[intent]) {
    INTENT_KEYWORDS[intent].push(...keywords);
  }
}

