/**
 * PYQ (Past Year Question) Intelligence Engine - Supabase Database Integration
 * Uses Supabase PostgreSQL for persistent storage
 */

import { supabase } from './supabase';

// ============================================================================
// Types & Interfaces
// ============================================================================

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

export type QuestionType = 
  | "short_answer"
  | "long_answer"
  | "mcq"
  | "very_short"
  | "case_study"
  | "theory";

export type DifficultyLevel = 
  | "easy"
  | "medium"
  | "hard";

// Analysis result types
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

export interface PersistedPYQOccurrence {
  pyqId?: string;
  year: number;
  marks: number;
  unit: string;
  topic: string;
  questionText: string;
}

export interface PersistedPYQGroup {
  id?: string;
  subject: string;
  canonicalQuestion: string;
  normalizedQuestion: string;
  unit: string;
  topic: string;
  marks: number;
  askedCount: number;
  firstAskedYear: number;
  lastAskedYear: number;
  askedYears: number[];
  matchType: "exact" | "semantic";
  frequencyLabel: string;
  occurrences: PersistedPYQOccurrence[];
}

export interface PersistedGeneratedAnswer {
  id?: string;
  groupId: string;
  question: string;
  answer: string;
  marks: number;
  targetPages: number;
  askedCount: number;
  askedYears: number[];
  figureHint?: string | null;
  tableHint?: string | null;
  sourceGrounded: boolean;
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

// ============================================================================
// Supabase PYQ Store Class
// ============================================================================

export class PYQStore {
  private useSupabase: boolean = true;

  /**
   * Add a new PYQ to the database
   */
  async add(question: Omit<PYQ, "id" | "createdAt">): Promise<PYQ> {
    if (!this.useSupabase) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
      .from('pyqs')
      .insert({
        subject: question.subject,
        unit: question.unit,
        topic: question.topic,
        question_text: question.questionText,
        question_type: question.questionType,
        marks: question.marks,
        year: question.year,
        semester: question.semester,
        university: question.university || 'GTU',
      })
      .select()
      .single();

    if (error) {
      console.error('[PYQ Store] Error adding PYQ:', error);
      throw new Error(`Failed to add PYQ: ${error.message}`);
    }

    return this.mapToPYQ(data);
  }

  /**
   * Add multiple PYQs at once
   */
  async addMany(questions: Omit<PYQ, "id" | "createdAt">[]): Promise<PYQ[]> {
    if (!this.useSupabase) {
      throw new Error('Supabase not configured');
    }

    const pyqData = questions.map(q => ({
      subject: q.subject,
      unit: q.unit,
      topic: q.topic,
      question_text: q.questionText,
      question_type: q.questionType,
      marks: q.marks,
      year: q.year,
      semester: q.semester,
      university: q.university || 'GTU',
    }));

    const { data, error } = await supabase
      .from('pyqs')
      .insert(pyqData)
      .select();

    if (error) {
      console.error('[PYQ Store] Error adding PYQs:', error);
      throw new Error(`Failed to add PYQs: ${error.message}`);
    }

    return data.map((item: Record<string, unknown>) => this.mapToPYQ(item));
  }

  /**
   * Get a question by ID
   */
  async getById(id: string): Promise<PYQ | null> {
    if (!this.useSupabase) return null;

    const { data, error } = await supabase
      .from('pyqs')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapToPYQ(data);
  }

  /**
   * Get all questions
   */
  async getAll(): Promise<PYQ[]> {
    if (!this.useSupabase) return [];

    const { data, error } = await supabase
      .from('pyqs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[PYQ Store] Error fetching all PYQs:', error);
      return [];
    }

    return data.map((item: Record<string, unknown>) => this.mapToPYQ(item));
  }

  /**
   * Get questions by subject
   */
  async getBySubject(subject: string): Promise<PYQ[]> {
    if (!this.useSupabase) return [];

    const { data, error } = await supabase
      .from('pyqs')
      .select('*')
      .ilike('subject', subject)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[PYQ Store] Error fetching PYQs by subject:', error);
      return [];
    }

    return data.map((item: Record<string, unknown>) => this.mapToPYQ(item));
  }

  /**
   * Get questions by subject and optional filters
   */
  async getFiltered(filters: {
    subject?: string;
    unit?: string;
    topic?: string;
    year?: number;
    semester?: number;
    university?: string;
    questionType?: QuestionType;
    minMarks?: number;
    maxMarks?: number;
  }): Promise<PYQ[]> {
    if (!this.useSupabase) return [];

    let query = supabase.from('pyqs').select('*');

    if (filters.subject) {
      query = query.ilike('subject', filters.subject);
    }
    if (filters.unit) {
      query = query.ilike('unit', filters.unit);
    }
    if (filters.topic) {
      query = query.ilike('topic', `%${filters.topic}%`);
    }
    if (filters.year) {
      query = query.eq('year', filters.year);
    }
    if (filters.semester) {
      query = query.eq('semester', filters.semester);
    }
    if (filters.university) {
      query = query.ilike('university', filters.university);
    }
    if (filters.questionType) {
      query = query.eq('question_type', filters.questionType);
    }
    if (filters.minMarks) {
      query = query.gte('marks', filters.minMarks);
    }
    if (filters.maxMarks) {
      query = query.lte('marks', filters.maxMarks);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('[PYQ Store] Error filtering PYQs:', error);
      return [];
    }

    return data.map((item: Record<string, unknown>) => this.mapToPYQ(item));
  }

  /**
   * Update a question
   */
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

    const { data, error } = await supabase
      .from('pyqs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) return null;
    return this.mapToPYQ(data);
  }

  /**
   * Delete a question
   */
  async delete(id: string): Promise<boolean> {
    if (!this.useSupabase) return false;

    const { error } = await supabase
      .from('pyqs')
      .delete()
      .eq('id', id);

    return !error;
  }

  /**
   * Get all unique subjects
   */
  async getSubjects(): Promise<string[]> {
    if (!this.useSupabase) return [];

    const { data, error } = await supabase
      .from('pyqs')
      .select('subject')
      .order('subject');

    if (error) {
      console.error('[PYQ Store] Error fetching subjects:', error);
      return [];
    }

    const subjects = new Set<string>();
    data.forEach((item: Record<string, unknown>) => {
      const value = item.subject;
      if (typeof value === "string") subjects.add(value);
    });
    return Array.from(subjects);
  }

  /**
   * Get all unique units for a subject
   */
  async getUnits(subject: string): Promise<string[]> {
    if (!this.useSupabase) return [];

    const { data, error } = await supabase
      .from('pyqs')
      .select('unit')
      .ilike('subject', subject)
      .order('unit');

    if (error) {
      console.error('[PYQ Store] Error fetching units:', error);
      return [];
    }

    const units = new Set<string>();
    data.forEach((item: Record<string, unknown>) => {
      const value = item.unit;
      if (typeof value === "string") units.add(value);
    });
    return Array.from(units);
  }

  /**
   * Get all unique topics for a subject
   */
  async getTopics(subject: string): Promise<string[]> {
    if (!this.useSupabase) return [];

    const { data, error } = await supabase
      .from('pyqs')
      .select('topic')
      .ilike('subject', subject)
      .order('topic');

    if (error) {
      console.error('[PYQ Store] Error fetching topics:', error);
      return [];
    }

    const topics = new Set<string>();
    data.forEach((item: Record<string, unknown>) => {
      const value = item.topic;
      if (typeof value === "string") topics.add(value);
    });
    return Array.from(topics);
  }

  /**
   * Get years available
   */
  async getYears(): Promise<number[]> {
    if (!this.useSupabase) return [];

    const { data, error } = await supabase
      .from('pyqs')
      .select('year')
      .order('year', { ascending: true });

    if (error) {
      console.error('[PYQ Store] Error fetching years:', error);
      return [];
    }

    const years = new Set<number>();
    data.forEach((item: Record<string, unknown>) => {
      const value = item.year;
      if (typeof value === "number") years.add(value);
    });
    return Array.from(years).sort((a, b) => a - b);
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<PYQStats> {
    if (!this.useSupabase) {
      return {
        totalQuestions: 0,
        totalSubjects: 0,
        totalUnits: 0,
        totalTopics: 0,
        yearRange: { start: 0, end: 0 },
        averageMarksPerQuestion: 0,
        mostCommonQuestionType: "short_answer",
      };
    }

    const all = await this.getAll();
    if (all.length === 0) {
      return {
        totalQuestions: 0,
        totalSubjects: 0,
        totalUnits: 0,
        totalTopics: 0,
        yearRange: { start: 0, end: 0 },
        averageMarksPerQuestion: 0,
        mostCommonQuestionType: "short_answer",
      };
    }

    const subjects = new Set<string>();
    const units = new Set<string>();
    const topics = new Set<string>();
    const questionTypes: Record<string, number> = {
      short_answer: 0,
      long_answer: 0,
      mcq: 0,
      very_short: 0,
      case_study: 0,
      theory: 0,
    };

    let minYear = Infinity;
    let maxYear = -Infinity;
    let totalMarks = 0;

    all.forEach(q => {
      subjects.add(q.subject);
      units.add(q.unit);
      topics.add(q.topic);
      questionTypes[q.questionType]++;
      totalMarks += q.marks;
      if (q.year < minYear) minYear = q.year;
      if (q.year > maxYear) maxYear = q.year;
    });

    const mostCommonType = Object.entries(questionTypes)
      .sort((a, b) => b[1] - a[1])[0][0] as QuestionType;

    return {
      totalQuestions: all.length,
      totalSubjects: subjects.size,
      totalUnits: units.size,
      totalTopics: topics.size,
      yearRange: { start: minYear === Infinity ? 0 : minYear, end: maxYear === -Infinity ? 0 : maxYear },
      averageMarksPerQuestion: totalMarks / all.length,
      mostCommonQuestionType: mostCommonType,
    };
  }

  /**
   * Clear all PYQs from the database
   */
  async clear(): Promise<void> {
    if (!this.useSupabase) return;

    const { error } = await supabase
      .from('pyqs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (this is a workaround since delete all isn't direct)

    if (error) {
      console.error('[PYQ Store] Error clearing PYQs:', error);
    }
  }

  /**
   * Replace consolidated groups and their occurrences for a subject.
   */
  async replaceConsolidatedGroups(subject: string, groups: PersistedPYQGroup[]): Promise<void> {
    if (!this.useSupabase) return;

    const { error: deleteError } = await supabase
      .from("pyq_question_groups")
      .delete()
      .eq("subject", subject);

    if (deleteError) {
      console.error("[PYQ Store] Error clearing existing groups:", deleteError);
      throw new Error(deleteError.message);
    }

    for (const group of groups) {
      const { data: insertedGroup, error: groupError } = await supabase
        .from("pyq_question_groups")
        .insert({
          subject: group.subject,
          canonical_question: group.canonicalQuestion,
          normalized_question: group.normalizedQuestion,
          unit: group.unit,
          topic: group.topic,
          marks: group.marks,
          asked_count: group.askedCount,
          first_asked_year: group.firstAskedYear,
          last_asked_year: group.lastAskedYear,
          asked_years: group.askedYears,
          match_type: group.matchType,
          frequency_label: group.frequencyLabel,
        })
        .select("id")
        .single();

      if (groupError || !insertedGroup) {
        console.error("[PYQ Store] Error inserting group:", groupError);
        throw new Error(groupError?.message || "Failed to insert group");
      }

      if (group.occurrences.length) {
        const occurrenceRows = group.occurrences.map((occ) => ({
          group_id: insertedGroup.id,
          pyq_id: occ.pyqId,
          year: occ.year,
          marks: occ.marks,
          unit: occ.unit,
          topic: occ.topic,
          question_text: occ.questionText,
        }));

        const { error: occError } = await supabase
          .from("pyq_question_occurrences")
          .insert(occurrenceRows);

        if (occError) {
          console.error("[PYQ Store] Error inserting occurrences:", occError);
          throw new Error(occError.message);
        }
      }
    }
  }

  /**
   * Fetch persisted consolidated groups with their occurrences.
   */
  async getConsolidatedGroups(subject?: string): Promise<PersistedPYQGroup[]> {
    if (!this.useSupabase) return [];

    let query = supabase
      .from("pyq_question_groups")
      .select(`
        id,
        subject,
        canonical_question,
        normalized_question,
        unit,
        topic,
        marks,
        asked_count,
        first_asked_year,
        last_asked_year,
        asked_years,
        match_type,
        frequency_label,
        pyq_question_occurrences (
          pyq_id,
          year,
          marks,
          unit,
          topic,
          question_text
        )
      `)
      .order("asked_count", { ascending: false });

    if (subject) {
      query = query.eq("subject", subject);
    }

    const { data, error } = await query;
    if (error || !data) {
      console.error("[PYQ Store] Error fetching consolidated groups:", error);
      return [];
    }

    return data.map((row: Record<string, unknown>) => ({
      id: row.id,
      subject: row.subject,
      canonicalQuestion: row.canonical_question,
      normalizedQuestion: row.normalized_question,
      unit: row.unit || "General",
      topic: row.topic || "General",
      marks: row.marks || 5,
      askedCount: row.asked_count || 1,
      firstAskedYear: row.first_asked_year || 0,
      lastAskedYear: row.last_asked_year || 0,
      askedYears: Array.isArray(row.asked_years) ? row.asked_years : [],
      matchType: row.match_type === "semantic" ? "semantic" : "exact",
      frequencyLabel: row.frequency_label || "Single",
      occurrences: Array.isArray(row.pyq_question_occurrences)
        ? row.pyq_question_occurrences.map((occ: Record<string, unknown>) => ({
            pyqId: occ.pyq_id,
            year: occ.year,
            marks: occ.marks,
            unit: occ.unit,
            topic: occ.topic,
            questionText: occ.question_text,
          }))
        : [],
    }));
  }

  /**
   * Persist generated answer for a consolidated group.
   */
  async saveGeneratedAnswer(input: PersistedGeneratedAnswer): Promise<void> {
    if (!this.useSupabase) return;

    const { error } = await supabase
      .from("pyq_generated_answers")
      .insert({
        group_id: input.groupId,
        question: input.question,
        answer: input.answer,
        marks: input.marks,
        target_pages: input.targetPages,
        asked_count: input.askedCount,
        asked_years: input.askedYears,
        figure_hint: input.figureHint,
        table_hint: input.tableHint,
        source_grounded: input.sourceGrounded,
      });

    if (error) {
      console.error("[PYQ Store] Error saving generated answer:", error);
      throw new Error(error.message);
    }
  }

  /**
   * Retrieve generated answers for a consolidated group.
   */
  async getGeneratedAnswers(groupId: string): Promise<PersistedGeneratedAnswer[]> {
    if (!this.useSupabase) return [];

    const { data, error } = await supabase
      .from("pyq_generated_answers")
      .select("*")
      .eq("group_id", groupId)
      .order("generated_at", { ascending: false });

    if (error || !data) {
      console.error("[PYQ Store] Error fetching generated answers:", error);
      return [];
    }

    return data.map((row: Record<string, unknown>) => ({
      id: row.id,
      groupId: row.group_id,
      question: row.question,
      answer: row.answer,
      marks: row.marks,
      targetPages: Number(row.target_pages) || 0,
      askedCount: row.asked_count,
      askedYears: Array.isArray(row.asked_years) ? row.asked_years : [],
      figureHint: row.figure_hint,
      tableHint: row.table_hint,
      sourceGrounded: row.source_grounded ?? true,
    }));
  }

  /**
   * Map database row to PYQ interface
   */
  private mapToPYQ(data: Record<string, unknown>): PYQ {
    return {
      id: String(data.id || ""),
      subject: String(data.subject || "General"),
      unit: String(data.unit || "General"),
      topic: String(data.topic || "General"),
      questionText: String(data.question_text || ""),
      questionType: String(data.question_type || "short_answer") as QuestionType,
      marks: Number(data.marks || 5),
      year: Number(data.year || new Date().getFullYear()),
      semester: typeof data.semester === "number" ? data.semester : undefined,
      university: typeof data.university === "string" ? data.university : undefined,
      createdAt: new Date(String(data.created_at || new Date().toISOString())),
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let pyqStoreInstance: PYQStore | null = null;

export function getPYQStore(): PYQStore {
  if (!pyqStoreInstance) {
    pyqStoreInstance = new PYQStore();
  }
  return pyqStoreInstance;
}

export function resetPYQStore(): void {
  pyqStoreInstance = null;
}

// ============================================================================
// Sample Data Seeder (for testing)
// ============================================================================

export async function seedSamplePYQs(store: PYQStore): Promise<void> {
  // Check if PYQs already exist
  const stats = await store.getStats();
  if (stats.totalQuestions > 0) {
    console.log('[PYQ Store] PYQs already seeded, skipping...');
    return;
  }

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

