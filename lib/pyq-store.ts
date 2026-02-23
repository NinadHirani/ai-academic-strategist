/**
 * PYQ Store - Supabase Database Integration
 */

import { supabase } from './supabase';

export interface PYQ {
  id: string;
  subject: string;
  subjectCode?: string;
  unit: string;
  topic: string;
  questionText: string;
  questionType: QuestionType;
  marks: number;
  year: number;
  semester?: number;
  university?: string;
  difficulty?: DifficultyLevel;
  createdAt: Date;
}

export type QuestionType = "short_answer" | "long_answer" | "mcq" | "very_short" | "case_study" | "theory";
export type DifficultyLevel = "easy" | "medium" | "hard";

export interface UnitFrequency {
  unit: string;
  count: number;
  totalMarks: number;
  percentage: number;
  years: number[];
}

export interface TopicFrequency {
  topic: string;
  unit: string;
  count: number;
  totalMarks: number;
  averageMarks: number;
  years: number[];
}

export interface YearAnalysis {
  year: number;
  totalQuestions: number;
  totalMarks: number;
  unitDistribution: Record<string, number>;
  averageMarksPerQuestion: number;
}

export interface PYQInsights {
  mostFrequentUnits: UnitFrequency[];
  highWeightageTopics: TopicFrequency[];
  revisionPriorities: RevisionPriority[];
  yearTrends: YearAnalysis[];
  overallStats: PYQStats;
}

export interface RevisionPriority {
  unit: string;
  topic: string;
  priorityScore: number;
  reason: string;
  suggestedMarks: number;
}

export interface PYQStats {
  totalQuestions: number;
  totalSubjects: number;
  totalUnits: number;
  totalTopics: number;
  yearRange: { start: number; end: number };
  averageMarksPerQuestion: number;
  mostCommonQuestionType: QuestionType;
}

export class PYQStore {
  private useSupabase: boolean = false;

  constructor() {
    this.useSupabase = supabase !== null;
    if (!this.useSupabase) console.log('[PYQ Store] Running in demo mode (no Supabase)');
  }

  private getClient() {
    if (!supabase) throw new Error('Supabase not configured');
    return supabase;
  }

  async add(question: Omit<PYQ, "id" | "createdAt">): Promise<PYQ> {
    if (!this.useSupabase) throw new Error('Supabase not configured');

    const client = this.getClient();
    const { data, error } = await client.from('pyqs').insert({
      subject: question.subject,
      unit: question.unit,
      topic: question.topic,
      question_text: question.questionText,
      question_type: question.questionType,
      marks: question.marks,
      year: question.year,
      semester: question.semester,
      university: question.university || 'GTU',
    }).select().single();

    if (error) {
      console.error('[PYQ Store] Error adding PYQ:', error);
      throw new Error(`Failed to add PYQ: ${error.message}`);
    }

    return this.mapToPYQ(data);
  }

  async addMany(questions: Omit<PYQ, "id" | "createdAt">[]): Promise<PYQ[]> {
    if (!this.useSupabase) throw new Error('Supabase not configured');

    const pyqData = questions.map(q => ({
      subject: q.subject, unit: q.unit, topic: q.topic,
      question_text: q.questionText, question_type: q.questionType,
      marks: q.marks, year: q.year, semester: q.semester, university: q.university || 'GTU',
    }));

    const client = this.getClient();
    const { data, error } = await client.from('pyqs').insert(pyqData).select();

    if (error) {
      console.error('[PYQ Store] Error adding PYQs:', error);
      throw new Error(`Failed to add PYQs: ${error.message}`);
    }

    return data.map((item: unknown) => this.mapToPYQ(item));
  }

  async getById(id: string): Promise<PYQ | null> {
    if (!this.useSupabase) return null;
    const client = this.getClient();
    const { data, error } = await client.from('pyqs').select('*').eq('id', id).single();
    if (error || !data) return null;
    return this.mapToPYQ(data);
  }

  async getAll(): Promise<PYQ[]> {
    if (!this.useSupabase) return [];
    const client = this.getClient();
    const { data, error } = await client.from('pyqs').select('*').order('created_at', { ascending: false });
    if (error) { console.error('[PYQ Store] Error fetching all PYQs:', error); return []; }
    return data.map((item: unknown) => this.mapToPYQ(item));
  }

  async getBySubject(subject: string): Promise<PYQ[]> {
    if (!this.useSupabase) return [];
    const client = this.getClient();
    const { data, error } = await client.from('pyqs').select('*').ilike('subject', subject).order('created_at', { ascending: false });
    if (error) { console.error('[PYQ Store] Error fetching PYQs by subject:', error); return []; }
    return data.map((item: unknown) => this.mapToPYQ(item));
  }

  async getFiltered(filters: {
    subject?: string; unit?: string; topic?: string; year?: number;
    semester?: number; university?: string; questionType?: QuestionType;
    minMarks?: number; maxMarks?: number;
  }): Promise<PYQ[]> {
    if (!this.useSupabase) return [];
    const client = this.getClient();
    let query = client.from('pyqs').select('*');
    if (filters.subject) query = query.ilike('subject', filters.subject);
    if (filters.unit) query = query.ilike('unit', filters.unit);
    if (filters.topic) query = query.ilike('topic', `%${filters.topic}%`);
    if (filters.year) query = query.eq('year', filters.year);
    if (filters.semester) query = query.eq('semester', filters.semester);
    if (filters.university) query = query.ilike('university', filters.university);
    if (filters.questionType) query = query.eq('question_type', filters.questionType);
    if (filters.minMarks) query = query.gte('marks', filters.minMarks);
    if (filters.maxMarks) query = query.lte('marks', filters.maxMarks);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) { console.error('[PYQ Store] Error filtering PYQs:', error); return []; }
    return data.map((item: unknown) => this.mapToPYQ(item));
  }

  async update(id: string, updates: Partial<Omit<PYQ, "id" | "createdAt">>): Promise<PYQ | null> {
    if (!this.useSupabase) return null;
    const updateData: Record<string, unknown> = {};
    if (updates.subject) updateData.subject = updates.subject;
    if (updates.unit) updateData.unit = updates.unit;
    if (updates.topic) updateData.topic = updates.topic;
    if (updates.questionText) updateData.question_text = updates.questionText;
    if (updates.questionType) updateData.question_type = updates.questionType;
    if (updates.marks) updateData.marks = updates.marks;
    if (updates.year) updateData.year = updates.year;
    if (updates.semester) updateData.semester = updates.semester;
    if (updates.university) updateData.university = updates.university;

    const client = this.getClient();
    const { data, error } = await client.from('pyqs').update(updateData).eq('id', id).select().single();
    if (error || !data) return null;
    return this.mapToPYQ(data);
  }

  async delete(id: string): Promise<boolean> {
    if (!this.useSupabase) return false;
    const client = this.getClient();
    const { error } = await client.from('pyqs').delete().eq('id', id);
    return !error;
  }

  async getSubjects(): Promise<string[]> {
    if (!this.useSupabase) return [];
    const client = this.getClient();
    const { data, error } = await client.from('pyqs').select('subject').order('subject');
    if (error) { console.error('[PYQ Store] Error fetching subjects:', error); return []; }
    const subjects = new Set<string>();
    data.forEach((item: unknown) => subjects.add((item as { subject: string }).subject));
    return Array.from(subjects);
  }

  async getUnits(subject: string): Promise<string[]> {
    if (!this.useSupabase) return [];
    const client = this.getClient();
    const { data, error } = await client.from('pyqs').select('unit').ilike('subject', subject).order('unit');
    if (error) { console.error('[PYQ Store] Error fetching units:', error); return []; }
    const units = new Set<string>();
    data.forEach((item: unknown) => units.add((item as { unit: string }).unit));
    return Array.from(units);
  }

  async getTopics(subject: string): Promise<string[]> {
    if (!this.useSupabase) return [];
    const client = this.getClient();
    const { data, error } = await client.from('pyqs').select('topic').ilike('subject', subject).order('topic');
    if (error) { console.error('[PYQ Store] Error fetching topics:', error); return []; }
    const topics = new Set<string>();
    data.forEach((item: unknown) => topics.add((item as { topic: string }).topic));
    return Array.from(topics);
  }

  async getYears(): Promise<number[]> {
    if (!this.useSupabase) return [];
    const client = this.getClient();
    const { data, error } = await client.from('pyqs').select('year').order('year', { ascending: true });
    if (error) { console.error('[PYQ Store] Error fetching years:', error); return []; }
    const years = new Set<number>();
    data.forEach((item: unknown) => years.add((item as { year: number }).year));
    return Array.from(years).sort((a, b) => a - b);
  }

  async getStats(): Promise<PYQStats> {
    if (!this.useSupabase) {
      return { totalQuestions: 0, totalSubjects: 0, totalUnits: 0, totalTopics: 0, yearRange: { start: 0, end: 0 }, averageMarksPerQuestion: 0, mostCommonQuestionType: "short_answer" };
    }

    const all = await this.getAll();
    if (all.length === 0) {
      return { totalQuestions: 0, totalSubjects: 0, totalUnits: 0, totalTopics: 0, yearRange: { start: 0, end: 0 }, averageMarksPerQuestion: 0, mostCommonQuestionType: "short_answer" };
    }

    const subjects = new Set<string>(), units = new Set<string>(), topics = new Set<string>();
    const questionTypes: Record<string, number> = { short_answer: 0, long_answer: 0, mcq: 0, very_short: 0, case_study: 0, theory: 0 };
    let minYear = Infinity, maxYear = -Infinity, totalMarks = 0;

    all.forEach(q => {
      subjects.add(q.subject); units.add(q.unit); topics.add(q.topic);
      questionTypes[q.questionType]++; totalMarks += q.marks;
      if (q.year < minYear) minYear = q.year;
      if (q.year > maxYear) maxYear = q.year;
    });

    const mostCommonType = Object.entries(questionTypes).sort((a, b) => b[1] - a[1])[0][0] as QuestionType;

    return {
      totalQuestions: all.length, totalSubjects: subjects.size, totalUnits: units.size, totalTopics: topics.size,
      yearRange: { start: minYear === Infinity ? 0 : minYear, end: maxYear === -Infinity ? 0 : maxYear },
      averageMarksPerQuestion: totalMarks / all.length, mostCommonQuestionType: mostCommonType,
    };
  }

  async clear(): Promise<void> {
    if (!this.useSupabase) return;
    const client = this.getClient();
    const { error } = await client.from('pyqs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) console.error('[PYQ Store] Error clearing PYQs:', error);
  }

  private mapToPYQ(data: unknown): PYQ {
    const d = data as Record<string, unknown>;
    return {
      id: d.id as string, subject: d.subject as string, unit: d.unit as string, topic: d.topic as string,
      questionText: d.question_text as string, questionType: d.question_type as QuestionType,
      marks: d.marks as number, year: d.year as number, semester: d.semester as number | undefined,
      university: d.university as string | undefined, createdAt: new Date(d.created_at as string),
    };
  }
}

let pyqStoreInstance: PYQStore | null = null;

export function getPYQStore(): PYQStore {
  if (!pyqStoreInstance) pyqStoreInstance = new PYQStore();
  return pyqStoreInstance;
}

export function resetPYQStore(): void {
  pyqStoreInstance = null;
}

export async function seedSamplePYQs(store: PYQStore): Promise<void> {
  const stats = await store.getStats();
  if (stats.totalQuestions > 0) { console.log('[PYQ Store] PYQs already seeded, skipping...'); return; }

  const sampleQuestions: Omit<PYQ, "id" | "createdAt">[] = [
    { subject: "DSA", unit: "Unit 1", topic: "Arrays", questionText: "Explain the difference between arrays and linked lists.", questionType: "short_answer", marks: 5, year: 2023, semester: 3, university: "GTU" },
    { subject: "DSA", unit: "Unit 1", topic: "Arrays", questionText: "Write a program to find the maximum subarray sum using Kadane's algorithm.", questionType: "long_answer", marks: 10, year: 2023, semester: 3, university: "GTU" },
    { subject: "DSA", unit: "Unit 2", topic: "Linked Lists", questionText: "Implement a doubly linked list with insertion and deletion operations.", questionType: "long_answer", marks: 10, year: 2022, semester: 3, university: "GTU" },
    { subject: "DSA", unit: "Unit 2", topic: "Linked Lists", questionText: "What are the advantages of linked lists over arrays?", questionType: "short_answer", marks: 5, year: 2022, semester: 3, university: "GTU" },
    { subject: "DSA", unit: "Unit 3", topic: "Stacks", questionText: "Explain the concept of stack using an example. State its applications.", questionType: "short_answer", marks: 5, year: 2023, semester: 3, university: "GTU" },
    { subject: "DSA", unit: "Unit 3", topic: "Queues", questionText: "Implement a circular queue with enqueue and dequeue operations.", questionType: "long_answer", marks: 10, year: 2022, semester: 3, university: "GTU" },
    { subject: "DSA", unit: "Unit 4", topic: "Trees", questionText: "Define a binary tree. Explain different tree traversal methods.", questionType: "short_answer", marks: 5, year: 2023, semester: 3, university: "GTU" },
    { subject: "DSA", unit: "Unit 4", topic: "Binary Search Tree", questionText: "Write algorithms for insertion and deletion in BST.", questionType: "long_answer", marks: 10, year: 2022, semester: 3, university: "GTU" },
    { subject: "DSA", unit: "Unit 5", topic: "Graphs", questionText: "Explain BFS and DFS algorithms with examples.", questionType: "short_answer", marks: 5, year: 2023, semester: 3, university: "GTU" },
    { subject: "DSA", unit: "Unit 5", topic: "Graphs", questionText: "Implement Dijkstra's algorithm for shortest path.", questionType: "long_answer", marks: 10, year: 2021, semester: 3, university: "GTU" },
    { subject: "OS", unit: "Unit 1", topic: "Introduction", questionText: "Explain the functions of an operating system.", questionType: "short_answer", marks: 5, year: 2023, semester: 4, university: "GTU" },
    { subject: "OS", unit: "Unit 2", topic: "Process Scheduling", questionText: "Explain FCFS, SJF, and Round Robin scheduling algorithms.", questionType: "short_answer", marks: 5, year: 2022, semester: 4, university: "GTU" },
    { subject: "OS", unit: "Unit 2", topic: "Process Synchronization", questionText: "Explain the producer-consumer problem and its solution.", questionType: "long_answer", marks: 10, year: 2023, semester: 4, university: "GTU" },
    { subject: "OS", unit: "Unit 3", topic: "Deadlock", questionText: "Explain the conditions for deadlock and methods to prevent it.", questionType: "short_answer", marks: 5, year: 2022, semester: 4, university: "GTU" },
    { subject: "OS", unit: "Unit 4", topic: "Memory Management", questionText: "Explain paging and segmentation with advantages.", questionType: "short_answer", marks: 5, year: 2023, semester: 4, university: "GTU" },
    { subject: "OS", unit: "Unit 5", topic: "File Systems", questionText: "Explain file allocation methods (contiguous, linked, indexed).", questionType: "short_answer", marks: 5, year: 2022, semester: 4, university: "GTU" },
    { subject: "AJP", unit: "Unit 1", topic: "JDBC", questionText: "Explain JDBC architecture and drivers.", questionType: "short_answer", marks: 5, year: 2023, semester: 5, university: "GTU" },
    { subject: "AJP", unit: "Unit 1", topic: "JDBC", questionText: "Write a program to perform CRUD operations using JDBC.", questionType: "long_answer", marks: 10, year: 2022, semester: 5, university: "GTU" },
    { subject: "AJP", unit: "Unit 2", topic: "Servlets", questionText: "Explain servlet lifecycle.", questionType: "short_answer", marks: 5, year: 2023, semester: 5, university: "GTU" },
    { subject: "AJP", unit: "Unit 2", topic: "Servlets", questionText: "Explain difference between GET and POST methods.", questionType: "short_answer", marks: 5, year: 2022, semester: 5, university: "GTU" },
    { subject: "IOT", unit: "Unit 1", topic: "Introduction", questionText: "What is IoT? Explain its architecture.", questionType: "short_answer", marks: 5, year: 2023, semester: 6, university: "GTU" },
    { subject: "IOT", unit: "Unit 1", topic: "Introduction", questionText: "Explain IoT enabled devices and sensors.", questionType: "short_answer", marks: 5, year: 2022, semester: 6, university: "GTU" },
    { subject: "IOT", unit: "Unit 2", topic: "Communication", questionText: "Explain MQTT protocol in IoT.", questionType: "short_answer", marks: 5, year: 2023, semester: 6, university: "GTU" },
    { subject: "IOT", unit: "Unit 3", topic: "Cloud", questionText: "Explain IoT cloud platforms.", questionType: "short_answer", marks: 5, year: 2022, semester: 6, university: "GTU" },
    { subject: "IOT", unit: "Unit 4", topic: "Security", questionText: "Explain IoT security challenges.", questionType: "short_answer", marks: 5, year: 2023, semester: 6, university: "GTU" },
  ];

  await store.addMany(sampleQuestions);
  console.log('[PYQ Store] Seeded sample PYQs successfully');
}

