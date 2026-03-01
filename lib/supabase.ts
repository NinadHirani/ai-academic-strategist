import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get Supabase URL and keys from environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Supabase client for browser - only initialize if credentials exist
let _supabase: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] Client not initialized - missing URL or ANON_KEY');
    return null;
  }
  
  if (!_supabase) {
    _supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabase;
}

// Export as a lazy property to avoid initialization errors
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getSupabaseClient();
    if (!client) {
      return () => {}; // Return no-op function for any property access
    }
    return (client as any)[prop];
  }
});

// Supabase admin client for server-side operations (service role key)
export const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
  : null;

// Database table types
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
  user_id: string;
  file_name: string;
  storage_path?: string;
  file_size?: number;
  mime_type?: string;
  type?: string;
  content: string;
  chunk_count: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface ContextPreset {
  id: string;
  university_code: string;
  university_name: string;
  subjects: Record<string, string[]>;
  semesters: number[];
}

// Helper function to check Supabase connection
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('pg_catalog.pg_tables').select('*').limit(1);
    return !error || error.code !== 'PGRST116';
  } catch {
    return false;
  }
}

