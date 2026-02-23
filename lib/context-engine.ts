/**
 * Academic Context Detection Engine
 * Analyzes user queries to extract structured academic metadata
 */

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

const UNIVERSITY_PATTERNS: Record<string, string> = {
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
  "university": "Generic University",
  "college": "College",
};

const SUBJECT_PATTERNS: Record<string, string> = {
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
  "maths": "Mathematics",
  "math": "Mathematics",
  "mathematics": "Mathematics",
  "physics": "Physics",
  "chem": "Chemistry",
  "chemistry": "Chemistry",
  "dc": "Digital Circuits",
  "microprocessor": "Microprocessor",
  "microcontroller": "Microcontroller",
  "vlsi": "VLSI Design",
  "signals": "Signals and Systems",
  "electronics": "Electronics",
  "circuits": "Circuit Theory",
  "mba": "Management Studies",
  "management": "Management Studies",
  "economics": "Economics",
  "engineering": "Engineering",
  "science": "Science",
  "commerce": "Commerce",
};

const SEMESTER_REGEX = /(?:sem(?:ester)?\.?\s*)(\d{1,2})/gi;

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

function detectUniversity(text: string): { value: string | null; matches: string[] } {
  const lowerText = text.toLowerCase();
  const matches: string[] = [];
  let detected: string | null = null;
  let highestPriority = 0;

  for (const [pattern, fullName] of Object.entries(UNIVERSITY_PATTERNS)) {
    if (lowerText.includes(pattern)) {
      matches.push(pattern);
      if (pattern.length > highestPriority) {
        highestPriority = pattern.length;
        detected = fullName;
      }
    }
  }

  return { value: detected, matches };
}

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

  return {
    value: foundSemesters.length > 0 ? foundSemesters[0] : null,
    matches,
  };
}

function detectSubject(text: string): { value: string | null; code: string | null; matches: string[] } {
  const lowerText = text.toLowerCase();
  const matches: string[] = [];
  let detectedFull: string | null = null;
  let detectedCode: string | null = null;
  let highestPriority = 0;

  for (const [pattern, fullName] of Object.entries(SUBJECT_PATTERNS)) {
    if (lowerText.includes(pattern)) {
      matches.push(pattern);
      if (pattern.length > highestPriority) {
        highestPriority = pattern.length;
        detectedFull = fullName;
        detectedCode = pattern.toUpperCase();
      }
    }
  }

  return { value: detectedFull, code: detectedCode, matches };
}

function detectIntent(text: string): { value: AcademicIntent; confidence: number } {
  const lowerText = text.toLowerCase();
  let bestIntent: AcademicIntent = "general_query";
  let bestScore = 0;

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (intent === "general_query" || intent === "unknown") continue;

    let score = 0;
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        score += keyword.length;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent as AcademicIntent;
    }
  }

  const confidence = bestScore > 0 ? Math.min(0.5 + (bestScore / 50), 0.95) : 0.3;

  return { value: bestIntent, confidence };
}

function calculateOverallConfidence(
  university: string | null,
  semester: number | null,
  subject: string | null,
  intent: AcademicIntent
): number {
  let score = 0.3;

  if (university) score += 0.2;
  if (semester) score += 0.15;
  if (subject) score += 0.25;
  if (intent !== "general_query") score += 0.1;

  return Math.min(score, 1.0);
}

export function parseAcademicContext(query: string): AcademicContext {
  const universityResult = detectUniversity(query);
  const semesterResult = detectSemester(query);
  const subjectResult = detectSubject(query);
  const intentResult = detectIntent(query);

  const rawMatches = [
    ...universityResult.matches,
    ...semesterResult.matches,
    ...subjectResult.matches,
  ];

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

export function getContextForPrompt(context: AcademicContext): string {
  const parts: string[] = [];

  if (context.university) parts.push(`University: ${context.university}`);
  if (context.semester) parts.push(`Semester: ${context.semester}`);
  if (context.subject) parts.push(`Subject: ${context.subject}`);
  if (context.intent !== "general_query") {
    parts.push(`Student Intent: ${context.intent.replace(/_/g, " ")}`);
  }

  return parts.length > 0 ? `Academic Context:\n${parts.join("\n")}` : "";
}

export function addUniversityPattern(code: string, fullName: string): void {
  UNIVERSITY_PATTERNS[code.toLowerCase()] = fullName;
}

export function addSubjectPattern(code: string, fullName: string): void {
  SUBJECT_PATTERNS[code.toLowerCase()] = fullName;
}

export function addIntentKeywords(intent: AcademicIntent, keywords: string[]): void {
  if (INTENT_KEYWORDS[intent]) {
    INTENT_KEYWORDS[intent].push(...keywords);
  }
}

