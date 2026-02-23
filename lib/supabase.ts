import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY && supabaseUrl
  ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

export interface UserProfile {
  id: string;
  user_id: string;
  weak_topics: string[];
  repeated_questions: string[];
  learning_patterns: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UserInteraction {
  id: string;
  user_id: string;
  message: string;
  response: string;
  topics_detected: string[];
  confidence_level: string;
  created_at: string;
}

export interface PYQ {
  id: string;
  subject: string;
  unit: string;
  topic: string;
  question_text: string;
  question_type: string;
  marks: number;
  year: number;
  semester: number;
  university: string;
  created_at: string;
}

export interface Document {
  id: string;
  name: string;
  type: string;
  content: string;
  chunk_count: number;
  user_id: string;
  created_at: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  embedding: number[];
  created_at: string;
}

export interface ContextPreset {
  id: string;
  university_code: string;
  university_name: string;
  subjects: Record<string, string[]>;
  semesters: number[];
}

export async function checkSupabaseConnection(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('pg_catalog.pg_tables').select('*').limit(1);
    return !error || error.code !== 'PGRST116';
  } catch {
    return false;
  }
}

